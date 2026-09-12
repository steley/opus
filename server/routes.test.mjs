/**
 * 路由/鉴权/焚毁回归测试（node:test + 内存 sqlite + Hono app.request，无真实网络）。
 * 对应审查 P2-5：给近期与安全相关的核心路径补最小回归，防日后改动悄悄弄坏。
 * 覆盖：空/坏 json 发布校验、PUT json 双形态、阅后即焚不被预览 bot 提前烧毁。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSqliteDb } from './db-sqlite.js'
import { createApp } from './routes.js'

// 每个测试独立 app + db（内存 sqlite），避免状态串扰
function make() {
  const db = createSqliteDb(':memory:')
  return { db, app: createApp(db, null, {}) }
}

async function publish(t, overrides = {}, headers = {}) {
  const res = await t.app.request('/api/posts', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({
      title: 'hi',
      html: '<p>正文 text</p>',
      json: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '正文 text' }] }] },
      managePassword: 'managepass',
      ...overrides,
    }),
  })
  const data = await res.json().catch(() => ({}))
  return { res, data }
}

test('正常发布成功并返回短 id', async () => {
  const t = make()
  const { res, data } = await publish(t)
  assert.equal(res.status, 200)
  assert.equal(data.ok, true)
  assert.match(data.id, /^[23456789abcdefghjkmnpqrstuvwxyz]{8}$/i)
})

test('空内容被拒 (html:""+json:"" 与 [] 均 400)', async () => {
  for (const payload of [{ html: '', json: '' }, { html: '<p></p>', json: [] }]) {
    const t = make()
    const { res, data } = await publish(t, payload)
    assert.equal(res.status, 400, JSON.stringify(payload))
    assert.equal(data.error, 'empty content')
  }
})

test('非法 json 字符串被拒 400', async () => {
  const t = make()
  const { res, data } = await publish(t, { html: '<p>x</p>', json: '{oops' })
  assert.equal(res.status, 400)
  assert.equal(data.error, 'invalid json')
})

test('PUT 兼容对象 json 并保存', async () => {
  const t = make()
  const { data: pub } = await publish(t)
  const id = pub.id
  const newDoc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'edited' }] }] }
  const up = await t.app.request(`/api/posts/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ managePassword: 'managepass', title: 'h2', json: newDoc }),
  })
  assert.equal(up.status, 200)
  const read = await t.app.request(`/api/posts/${id}`, { headers: { 'content-type': 'application/json' } })
  const body = await read.json()
  assert.equal(read.status, 200)
  assert.equal(JSON.stringify(body.json), JSON.stringify(newDoc), 'PUT object json 应被保存')
})

test('PUT 坏字符串 json 被拒 400', async () => {
  const t = make()
  const { data: pub } = await publish(t)
  const id = pub.id
  const up = await t.app.request(`/api/posts/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ managePassword: 'managepass', html: '<p>y</p>', json: '[unclosed' }),
  })
  assert.equal(up.status, 400)
})

test('阅后即焚：预览爬虫 GET 不焚毁、不泄正文；真人浏览器 GET 才焚毁', async () => {
  const t = make()
  const { data: pub, res } = await publish(t, { burnAfterRead: true, html: '<p>secret body</p>' })
  assert.equal(res.status, 200)
  const id = pub.id

  // 1) 预览爬虫（Telegram）+ Accept 非 html → 404，且不删
  const bot = await t.app.request(`/${id}`, {
    headers: { 'user-agent': 'TelegramBot (like TwitterBot)', accept: 'image/*,%20*/*;q=0.8' },
  })
  assert.equal(bot.status, 404)
  const existsAfterBot = await t.db.get('SELECT id FROM posts WHERE id = ?', id)
  assert.ok(existsAfterBot, '爬虫访问后焚文必须还在（未被烧毁）')

  // 2) 真人浏览器 GET → 200 全文，同时焚毁
  const human = await t.app.request(`/${id}`, {
    headers: { accept: 'text/html,application/xhtml+xml' },
  })
  assert.equal(human.status, 200)
  const humanHtml = await human.text()
  assert.ok(humanHtml.includes('secret body'), '真人应拿到正文')
  const gone = await t.db.get('SELECT id FROM posts WHERE id = ?', id)
  assert.equal(gone, null, '真人访问后焚文应被物理删除')

  // 3) 再 GET → 404
  const second = await t.app.request(`/${id}`)
  assert.equal(second.status, 404)
})

test('并发焚毁：多个真人 GET 只有一个 200，其余 404，且行被物理删除', async () => {
  const t = make()
  const { data: pub, res } = await publish(t, { burnAfterRead: true, html: '<p>only-once</p>' })
  assert.equal(res.status, 200)
  const id = pub.id

  const human = { accept: 'text/html,application/xhtml+xml' }
  const results = await Promise.all(
    Array.from({ length: 8 }, () => t.app.request(`/${id}`, { headers: human }))
  )
  const okCount = results.filter(r => r.status === 200).length
  const notFound = results.filter(r => r.status === 404).length
  assert.equal(okCount, 1, `应恰有 1 个请求拿到正文，实际 ${okCount}`)
  assert.equal(notFound, 7, `其余应为 404，实际 ${notFound}`)

  // 拿到正文的那一个确实包含内容（而非空壳 200）
  const okRes = results.find(r => r.status === 200)
  assert.ok((await okRes.text()).includes('only-once'))

  // 行已被物理删除
  const gone = await t.db.get('SELECT id FROM posts WHERE id = ?', id)
  assert.equal(gone, null)
})

test('过期删除：expires_at 已过 → GET 404 且行被惰性物理删除', async () => {
  const t = make()
  const { data: pub, res } = await publish(t, { html: '<p>expired</p>' })
  assert.equal(res.status, 200)
  const id = pub.id

  // 直接把有效期改到过去，模拟已过期
  await t.db.run('UPDATE posts SET expires_at = ? WHERE id = ?', Date.now() - 1000, id)

  const page = await t.app.request(`/${id}`, { headers: { accept: 'text/html' } })
  assert.equal(page.status, 404)

  const gone = await t.db.get('SELECT id FROM posts WHERE id = ?', id)
  assert.equal(gone, null, '访问过期文章后应被惰性物理删除')
})

test('请求体超限：Content-Length 过大直接 413（不先解析 JSON）', async () => {
  const t = make()
  const res = await t.app.request('/api/posts', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': '2000000' },
    body: JSON.stringify({ title: 'x', html: '<p>x</p>', json: [], managePassword: 'managepass' }),
  })
  assert.equal(res.status, 413)
  const data = await res.json().catch(() => ({}))
  assert.equal(data.error, 'content too large')
})

test('PUT 修改有效期：从现在起重新计时并返回新 expiresAt；非法枚举 400', async () => {
  const t = make()
  const { data: pub } = await publish(t)
  const id = pub.id
  const before = (await t.db.get('SELECT expires_at FROM posts WHERE id = ?', id)).expires_at
  const up = await t.app.request(`/api/posts/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ managePassword: 'managepass', expiry: '365d' }),
  })
  assert.equal(up.status, 200)
  const data = await up.json()
  const after = (await t.db.get('SELECT expires_at FROM posts WHERE id = ?', id)).expires_at
  assert.ok(after > before, '新有效期应晚于原值（默认 30d → 365d）')
  assert.ok(Math.abs(data.expiresAt - after) < 5, '响应应返回新的 expiresAt')
  assert.ok(after - Date.now() <= 365 * 24 * 3600e3 + 2000, '365d 应从现在起计')

  const bad = await t.app.request(`/api/posts/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ managePassword: 'managepass', expiry: '2h' }),
  })
  assert.equal(bad.status, 400)
})

test('PUT 修改/移除查看密码：设置后匿名读 401、带密码读 200；空串移除恢复公开', async () => {
  const t = make()
  const { data: pub } = await publish(t)
  const id = pub.id

  // 设置查看密码
  const set = await t.app.request(`/api/posts/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ managePassword: 'managepass', viewPassword: 'viewpw' }),
  })
  assert.equal(set.status, 200)
  const noPw = await t.app.request(`/api/posts/${id}`)
  assert.equal(noPw.status, 401, '设置后匿名读取应 401')

  // 过短被拒
  const short = await t.app.request(`/api/posts/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ managePassword: 'managepass', viewPassword: 'abc' }),
  })
  assert.equal(short.status, 400)

  // 带密码读成功（走 /read）
  const withPw = await t.app.request(`/api/posts/${id}/read`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ viewPassword: 'viewpw' }),
  })
  assert.equal(withPw.status, 200)

  // 空串移除 → 恢复公开
  const remove = await t.app.request(`/api/posts/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ managePassword: 'managepass', viewPassword: '' }),
  })
  assert.equal(remove.status, 200)
  const open = await t.app.request(`/api/posts/${id}`)
  assert.equal(open.status, 200, '移除后匿名读取应恢复 200')
})

test('普通文章页下发可缓存头且无 Vary；焚文/密码页 no-store', async () => {
  const t = make()
  const { data: pub } = await publish(t, { html: '<p>cacheable</p>' })
  const page = await t.app.request(`/${pub.id}`, { headers: { accept: 'text/html' } })
  assert.equal(page.status, 200)
  assert.match(page.headers.get('cache-control'), /s-maxage=300/)
  // 语言/cookie 解耦后不再因内容协商分裂缓存（compress 的 Accept-Encoding 属正常传输协商，允许）
  assert.doesNotMatch(page.headers.get('vary') ?? '', /cookie|accept-language/i)

  const { data: burn } = await publish(t, { burnAfterRead: true, html: '<p>burn</p>' })
  const burnPage = await t.app.request(`/${burn.id}`, { headers: { accept: 'text/html' } })
  assert.equal(burnPage.headers.get('cache-control'), 'no-store')

  const { data: locked } = await publish(t, { viewPassword: 'viewpw', html: '<p>locked</p>' })
  const pwPage = await t.app.request(`/${locked.id}`, { headers: { accept: 'text/html' } })
  assert.equal(pwPage.status, 200)
  assert.equal(pwPage.headers.get('cache-control'), 'no-store')
})
