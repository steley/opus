/**
 * Opus 后端路由（Hono，同构运行于 Node VPS 与 Cloudflare Workers）。
 * createApp(db) 返回包含 /api/* 与 /p/:id 阅读页的完整应用。
 */
import { Hono } from 'hono'
import { compress } from 'hono/compress'
import { getCookie } from 'hono/cookie'
import { genId, hashPassword, verifyPassword, validatePublish } from './util.js'
import { sanitizePostHtml } from './sanitize.js'
import { articlePage, passwordPage, notFoundPage, aboutPage, termsPage, privacyPage, txt } from './pages.js'

/** 有效期枚举（默认 30 天） */
const EXPIRY_MS = {
  '1h': 3600e3,
  '12h': 12 * 3600e3,
  '24h': 24 * 3600e3,
  '1d': 24 * 3600e3,
  '15d': 15 * 24 * 3600e3,
  '30d': 30 * 24 * 3600e3,
  '90d': 90 * 24 * 3600e3,
  '180d': 180 * 24 * 3600e3,
  '365d': 365 * 24 * 3600e3,
}

/** 内存限流（Workers 上为每 isolate 尽力而为，生产建议前置 CF Rate Limiting 规则） */
function rateLimit({ windowMs, max }) {
  const hits = new Map()
  return async (c, next) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'local'
    const now = Date.now()
    const rec = hits.get(ip)
    if (!rec || now > rec.resetAt) hits.set(ip, { count: 1, resetAt: now + windowMs })
    else if (++rec.count > max) return c.json({ ok: false, error: 'too many requests' }, 429)
    if (hits.size > 5000) hits.clear() // 防内存膨胀
    await next()
  }
}

/** 过期即删（惰性）：首次触碰时物理删除并返回 true */
async function purgeIfExpired(db, post) {
  if (post.expires_at && post.expires_at <= Date.now()) {
    await db.run('DELETE FROM posts WHERE id = ?', post.id)
    return true
  }
  return false
}

export function createApp(db, registerStatic = null) {
  const app = new Hono()

  // 压缩：Node 运行时启用；Workers 边缘自带压缩，跳过避免双重处理
  if (db.kind !== 'd1') app.use('*', compress())

  // 安全响应头（after-next 写入，对所有响应生效）
  app.use('*', async (c, next) => {
    await next()
    c.res.headers.set('X-Content-Type-Options', 'nosniff')
    c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    c.res.headers.set('X-Frame-Options', 'DENY')
  })

  // 调用者的静态托管注册（serveStatic 找不到文件会 next()，不影响下方 API 路由）
  registerStatic?.(app)

  app.onError((err, c) => {
    console.error(err)
    return c.json({ ok: false, error: 'internal error' }, 500)
  })

  // ---------- SEO：robots.txt / sitemap.xml（仅收录公开文章） ----------
  app.get('/about', c => htmlRes(c, aboutPage(pageLang(c))))
  app.get('/terms', c => htmlRes(c, termsPage(pageLang(c))))
  app.get('/privacy', c => htmlRes(c, privacyPage(pageLang(c))))

  app.get('/robots.txt', c => {
    const o = origin(c)
    return c.body(
      `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${o}/sitemap.xml\n`,
      200,
      { 'content-type': 'text/plain; charset=utf-8' }
    )
  })

  app.get('/sitemap.xml', c => {
    const o = origin(c)
    const paths = ['/', '/about', '/terms', '/privacy']
    const urls = paths.map(p => `  <url><loc>${o}${p}</loc></url>`).join('\n')
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
    return c.body(xml, 200, { 'content-type': 'application/xml; charset=utf-8' })
  })

  app.get('/api/health', c => c.json({ ok: true, db: db.kind }))

  // ---------- 发布 ----------
  app.post('/api/posts', rateLimit({ windowMs: 10 * 60_000, max: 20 }), async c => {
    const body = await c.req.json().catch(() => null)
    if (!body) return c.json({ ok: false, error: 'invalid body' }, 400)

    const check = validatePublish(body)
    if (check.error) return c.json({ ok: false, error: check.error }, 400)
    const { title, author, json, burnAfterRead, viewPassword, managePassword, expiry } = check.fields
    const html = sanitizePostHtml(check.fields.html) // 入库前最终净化（安全边界）

    // 生成不冲突的短 ID（撞车自动换号；72 万亿空间下重试 5 次仍冲突视为异常）
    let id = genId(8)
    for (let i = 0; i < 5 && (await db.get('SELECT id FROM posts WHERE id = ?', id)); i++) id = genId(8)
    if (await db.get('SELECT id FROM posts WHERE id = ?', id)) {
      return c.json({ ok: false, error: 'id space exhausted, try again' }, 503)
    }

    const expiresAt = Date.now() + EXPIRY_MS[expiry]
    await db.run(
      'INSERT INTO posts (id, title, author, html, json, burn_after_read, view_pw, edit_pw, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      id, title, author, html, json, burnAfterRead,
      viewPassword ? await hashPassword(viewPassword) : null,
      await hashPassword(managePassword),
      Date.now(), expiresAt
    )

    return c.json({ ok: true, id, url: `${origin(c)}/${id}`, expiresAt })
  })

  // ---------- 公开读取（JSON） ----------
  app.get('/api/posts/:id', async c => {
    const post = await db.get('SELECT * FROM posts WHERE id = ?', c.req.param('id'))
    if (!post || (await purgeIfExpired(db, post))) return c.json({ ok: false, error: 'not found' }, 404)
    if (post.view_pw) return c.json({ ok: false, error: 'view password required' }, 401)
    return readSuccess(c, db, post)
  })

  // 带查看密码的读取
  app.post('/api/posts/:id/read', rateLimit({ windowMs: 60_000, max: 30 }), async c => {
    const { viewPassword } = await c.req.json().catch(() => ({}))
    const post = await db.get('SELECT * FROM posts WHERE id = ?', c.req.param('id'))
    if (!post || (await purgeIfExpired(db, post))) return c.json({ ok: false, error: 'not found' }, 404)
    if (!post.view_pw) return readSuccess(c, db, post)
    if (!(await verifyPassword(String(viewPassword ?? ''), post.view_pw))) {
      await sleep(300) // 轻微防爆破
      return c.json({ ok: false, error: 'wrong password' }, 401)
    }
    return readSuccess(c, db, post)
  })

  // 编辑器读取（管理密码，不触发焚毁）
  app.post('/api/posts/:id/edit-read', rateLimit({ windowMs: 60_000, max: 30 }), async c => {
    const { managePassword } = await c.req.json().catch(() => ({}))
    const post = await db.get('SELECT * FROM posts WHERE id = ?', c.req.param('id'))
    if (!post || (await purgeIfExpired(db, post))) return c.json({ ok: false, error: 'not found' }, 404)
    if (!(await verifyPassword(String(managePassword ?? ''), post.edit_pw))) {
      await sleep(300)
      return c.json({ ok: false, error: 'wrong password' }, 401)
    }
    return c.json({ ok: true, ...postBody(post) })
  })

  // ---------- 编辑 / 删除（管理密码） ----------
  const requireManagePw = async (c, id) => {
    const { managePassword } = await c.req.json().catch(() => ({}))
    const post = await db.get('SELECT * FROM posts WHERE id = ?', id)
    if (!post || (await purgeIfExpired(db, post))) return { fail: c.json({ ok: false, error: 'not found' }, 404) }
    if (!(await verifyPassword(String(managePassword ?? ''), post.edit_pw))) {
      await sleep(300)
      return { fail: c.json({ ok: false, error: 'wrong password' }, 401) }
    }
    return { post }
  }

  app.put('/api/posts/:id', rateLimit({ windowMs: 60_000, max: 30 }), async c => {
    const id = c.req.param('id')
    const guard = await requireManagePw(c, id)
    if (guard.fail) return guard.fail

    const body = await c.req.json().catch(() => ({}))
    const title = typeof body.title === 'string' ? body.title.slice(0, 200) : guard.post.title
    const author = typeof body.author === 'string' ? body.author.trim().slice(0, 100) : guard.post.author
    let html = guard.post.html
    let json = guard.post.json
    // 字段级尺寸上限：html 与 json 独立校验（任一超限直接拒绝）
    if (typeof body.html === 'string' && body.html.trim()) {
      if (body.html.length > 500_000) return c.json({ ok: false, error: 'content too large' }, 400)
      html = sanitizePostHtml(body.html)
    }
    if (typeof body.json === 'string' && body.json.length > 1_000_000) {
      return c.json({ ok: false, error: 'content too large' }, 400)
    }
    if (typeof body.json === 'string' && body.json.trim()) json = body.json
    await db.run('UPDATE posts SET title = ?, author = ?, html = ?, json = ? WHERE id = ?',
      title, author, html, json, id)
    return c.json({ ok: true })
  })

  app.delete('/api/posts/:id', rateLimit({ windowMs: 60_000, max: 30 }), async c => {
    const guard = await requireManagePw(c, c.req.param('id'))
    if (guard.fail) return guard.fail
    await db.run('DELETE FROM posts WHERE id = ?', c.req.param('id'))
    return c.json({ ok: true })
  })

  // ---------- 阅读页（HTML，规范地址 /:id；旧 /p/:id 重定向） ----------
  // ID 校验放宽到 8-12 位：将来 ID 空间不足时加长 genId 即可，新旧链接共存
  const ID_RE = /^[23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ]{8,12}$/

  const articleGet = async c => {
    const id = c.req.param('id')
    const lang = pageLang(c)
    if (!ID_RE.test(id)) return htmlRes(c, notFoundPage(lang), 404)
    const post = await db.get('SELECT * FROM posts WHERE id = ?', id)
    if (!post || (await purgeIfExpired(db, post))) return htmlRes(c, notFoundPage(lang), 404)
    if (post.view_pw) return htmlRes(c, passwordPage(id, lang))
    return burnAndServe(c, db, post, lang)
  }

  const articlePwSubmit = async c => {
    const id = c.req.param('id')
    const lang = pageLang(c)
    if (!ID_RE.test(id)) return htmlRes(c, notFoundPage(lang), 404)
    const form = await c.req.parseBody().catch(() => ({}))
    const pw = String(form.pw ?? '')
    const post = await db.get('SELECT * FROM posts WHERE id = ?', id)
    if (!post || (await purgeIfExpired(db, post))) return htmlRes(c, notFoundPage(lang), 404)
    if (post.view_pw && !(await verifyPassword(pw, post.view_pw))) {
      await sleep(300)
      return htmlRes(c, passwordPage(id, lang, txt(lang).pwWrong), 401)
    }
    return burnAndServe(c, db, post, lang)
  }

  app.get('/:id', rateLimit({ windowMs: 60_000, max: 120 }), articleGet)
  app.post('/:id', articlePwSubmit)
  // 旧地址兼容：/p/:id 永久重定向到规范地址
  app.get('/p/:id', c => c.redirect(`/${c.req.param('id')}`, 301))
  app.post('/p/:id', articlePwSubmit)

  return app
}

// ---------- 辅助 ----------

function htmlRes(c, html, status = 200) {
  c.header('Vary', 'Accept-Language, Cookie')
  return c.html(html, status)
}

/** 服务端页面语言：cookie（语言按钮写入）优先，其次 Accept-Language，默认 zh */
function pageLang(c) {
  const cookie = getCookie(c, 'opus-lang')
  if (cookie === 'zh' || cookie === 'en') return cookie
  const al = (c.req.header('accept-language') || '').toLowerCase()
  if (al.includes('zh')) return 'zh'
  if (al.includes('en')) return 'en'
  return 'zh'
}

function origin(c) {
  const proto = c.req.header('x-forwarded-proto') || new URL(c.req.url).protocol.replace(':', '')
  const host = c.req.header('x-forwarded-host') || c.req.header('host') || new URL(c.req.url).host
  return `${proto}://${host}`
}

function postBody(post) {
  return {
    id: post.id,
    title: post.title,
    author: post.author,
    html: post.html,
    json: JSON.parse(post.json || '[]'),
    burnAfterRead: !!post.burn_after_read,
    hasViewPassword: !!post.view_pw,
    expiresAt: post.expires_at ?? null,
  }
}

/** 成功读取：阅后即焚的文章在成功取出的同时销毁 */
async function readSuccess(c, db, post) {
  if (post.burn_after_read) await db.run('DELETE FROM posts WHERE id = ?', post.id)
  return c.json({ ok: true, ...postBody(post) })
}

async function burnAndServe(c, db, post, lang = 'zh') {
  if (post.burn_after_read) await db.run('DELETE FROM posts WHERE id = ?', post.id)
  c.header('Vary', 'Accept-Language, Cookie')
  return c.html(articlePage(post, lang, origin(c)))
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}
