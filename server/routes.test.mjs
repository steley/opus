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

// ---------- Shield 门控一致性 ----------
// /api/config 只在两把 key 成对配置时下发 sitekey，发布 gate 必须用同一条件，
// 否则「只配 secret」时客户端无 sitekey、服务端却校验 token → 静默全 403。
test('只配 SHIELD_SECRET_KEY 缺 sitekey：发布不拦截、config 不下发、对称告警', async () => {
  const db = createSqliteDb(':memory:')
  const app = createApp(db, null, { SHIELD_SECRET_KEY: 'es_secret_test' })
  // 捕获结构化告警，断言缺 sitekey 方向有日志（与 shield_secret_missing 对称）
  const logs = []
  const realErr = console.error
  console.error = (...args) => { logs.push(args.join(' ')) }
  try {
    const { res, data } = await publish({ app })
    assert.equal(res.status, 200, `secret-only 配置不应触发 token 校验: ${JSON.stringify(data)}`)
    assert.equal(data.ok, true)

    const cfg = await app.request('/api/config')
    assert.equal((await cfg.json()).shieldSiteKey, null, '缺 sitekey 时不下发')
  } finally {
    console.error = realErr
  }
  assert.ok(logs.some(l => l.includes('shield_sitekey_missing')), `应输出 shield_sitekey_missing 告警: ${logs.join('\n')}`)
})

test('两把 key 成对配置：无/坏 token 403，siteverify 通过则放行', async () => {
  const db = createSqliteDb(':memory:')
  const app = createApp(db, null, { SHIELD_SITE_KEY: 'es_site', SHIELD_SECRET_KEY: 'es_secret' })
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    assert.ok(String(url).includes('siteverify'), '应调用 siteverify')
    return new Response(JSON.stringify({ success: true, score: 0.9 }), { headers: { 'content-type': 'application/json' } })
  }
  try {
    const denied = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'hi', html: '<p>x</p>', json: [], managePassword: 'managepass' }),
    })
    assert.equal(denied.status, 403, '无 token 应被拒')

    const ok = await publish({ app }, { shieldToken: 'tok' })
    assert.equal(ok.res.status, 200, 'siteverify 成功应放行')
    assert.equal(ok.data.ok, true)
  } finally {
    globalThis.fetch = realFetch
  }
})

// ---------- 审计修复回归（AUDIT-001/002/004/010） ----------
test('焚文经 JSON 端点：预览爬虫 404 不焚毁，非 bot 读取即焚（AUDIT-001）', async () => {
  const t = make()
  const { data: a } = await publish(t, { burnAfterRead: true, html: '<p>burn-a</p>' })
  const bot = await t.app.request(`/api/posts/${a.id}`, { headers: { accept: '*/*', 'user-agent': 'curl/8.1' } })
  assert.equal(bot.status, 404, 'bot 形态应 404 且不焚毁')
  assert.ok(await t.db.get('SELECT id FROM posts WHERE id = ?', a.id), 'bot 读取后文章应仍在')

  const human = await t.app.request(`/api/posts/${a.id}`) // 无 accept 头：非 bot 形态
  assert.equal(human.status, 200, '真人形态读取成功')
  const gone = await t.app.request(`/api/posts/${a.id}`)
  assert.equal(gone.status, 404, '读取后即焚毁')

  const { data: b } = await publish(t, { burnAfterRead: true, html: '<p>burn-b</p>' })
  const botRead = await t.app.request(`/api/posts/${b.id}/read`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: '*/*', 'user-agent': 'curl/8.1' },
    body: JSON.stringify({}),
  })
  assert.equal(botRead.status, 404, '/read 的 bot 形态同样 404 不焚毁')
  assert.ok(await t.db.get('SELECT id FROM posts WHERE id = ?', b.id), '/read bot 读取后文章应仍在')
  const human2 = await t.app.request(`/api/posts/${b.id}`)
  assert.equal(human2.status, 200, '非 bot /read 前的 JSON 直读即焚')
})

test('PUT expiry 拒绝原型链键（AUDIT-004）', async () => {
  const t = make()
  const { data } = await publish(t)
  const bad = await t.app.request(`/api/posts/${data.id}`, {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ managePassword: 'managepass', expiry: 'toString' }),
  })
  assert.equal(bad.status, 400)
  const ok = await t.app.request(`/api/posts/${data.id}`, {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ managePassword: 'managepass', expiry: '30d' }),
  })
  assert.equal(ok.status, 200)
})

test('/p/:id 拦截协议相对跳转；合法 id 正常 301（AUDIT-010）', async () => {
  const t = make()
  const bad = await t.app.request('/p/%2Fevil.com')
  assert.equal(bad.status, 404)
  const { data } = await publish(t)
  const red = await t.app.request(`/p/${data.id}`, { redirect: 'manual' })
  assert.equal(red.status, 301)
  assert.equal(red.headers.get('location'), `/${data.id}`)
})

test('APP_ORIGIN 固定对外域名，发布响应与 canonical 均不再反射请求头（AUDIT-002）', async () => {
  const db = createSqliteDb(':memory:')
  const app = createApp(db, null, { APP_ORIGIN: 'https://orig.example' })
  const res = await app.request('/api/posts', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 't', html: '<p>x</p>', json: [], managePassword: 'managepass' }),
  })
  const data = await res.json()
  assert.ok(data.url.startsWith('https://orig.example/'), `url 应使用 APP_ORIGIN: ${data.url}`)
  const page = await app.request(`/${data.id}`, { headers: { accept: 'text/html', 'x-forwarded-host': 'attacker.example' } })
  const html = await page.text()
  assert.ok(html.includes('href="https://orig.example/'), 'canonical 应使用 APP_ORIGIN')
  assert.ok(!html.includes('attacker.example'), '不应反射伪造头')
})
