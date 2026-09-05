/**
 * Opus 后端路由（Hono，同构运行于 Node VPS 与 Cloudflare Workers）。
 * createApp(db) 返回包含 /api/* 与 /p/:id 阅读页的完整应用。
 */
import { Hono } from 'hono'
import { compress } from 'hono/compress'
import { getCookie } from 'hono/cookie'
import { genId, hashPassword, verifyPassword, timingSafeEqual, validatePublish } from './util.js'
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

export function createApp(db, registerStatic = null, env = {}) {
  const app = new Hono()

  // 压缩：Node 运行时启用；Workers 边缘自带压缩，跳过避免双重处理
  if (db.kind !== 'd1') app.use('*', compress())

  // 安全响应头（after-next 写入，对所有响应生效）
  // 注意：Workers 模式下静态资产绕过本中间件，安全头由 public/_headers 提供——两处需保持一致
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

  app.get('/about', c => htmlRes(c, aboutPage(pageLang(c))))
  app.get('/terms', c => htmlRes(c, termsPage(pageLang(c))))
  app.get('/privacy', c => htmlRes(c, privacyPage(pageLang(c))))

  // ---------- 反滥用挑战（未启用 Turnstile 时的轻量验证：算术题 + HMAC 签名） ----------
  app.get('/api/challenge', async c => {
    const a = 2 + Math.floor(Math.random() * 8) // 2-9
    const b = 2 + Math.floor(Math.random() * 8) // 2-9
    const nonce = genId(12)
    const exp = Date.now() + 10 * 60_000
    const sig = await hmacHex(`${a}+${b}:${nonce}:${exp}`, String(env.CHALLENGE_SECRET || 'opus-challenge-v1'))
    return c.json({ ok: true, a, b, nonce, exp, sig })
  })

  app.get('/api/health', c => c.json({ ok: true, db: db.kind }))

  // ---------- 公开配置（前端读取人机验证站点密钥；两者都配置才启用） ----------
  app.get('/api/config', c => c.json({
    ok: true,
    turnstileSiteKey: env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY ? env.TURNSTILE_SITE_KEY : null,
  }))

  // ---------- 发布 ----------
  app.post('/api/posts', rateLimit({ windowMs: 10 * 60_000, max: 20 }), async c => {
    const body = await c.req.json().catch(() => null)
    if (!body) return c.json({ ok: false, error: 'invalid body' }, 400)

    // 人机验证：Turnstile 优先；未配置时使用算术挑战（HMAC 签名防伪造，10 分钟防重放）
    if (env.TURNSTILE_SECRET_KEY) {
      const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      const ok = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, String(body.turnstileToken ?? ''), ip)
      if (!ok) {
        await sleep(300)
        return c.json({ ok: false, error: 'turnstile failed' }, 403)
      }
    } else {
      const err = await verifyArithmeticChallenge(body.challenge, env)
      if (err) {
        await sleep(200)
        return c.json({ ok: false, error: err }, 400)
      }
    }

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
  app.post('/p/:id', rateLimit({ windowMs: 60_000, max: 30 }), articlePwSubmit)

  return app
}

// ---------- 辅助 ----------

/** Cloudflare Turnstile 服务端校验 */
async function verifyTurnstile(secret, token, ip) {
  if (!token) return false
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
    })
    const data = await res.json()
    return data.success === true
  } catch {
    return false
  }
}

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
  // 阅后即焚：原子焚毁（DELETE...RETURNING，并发请求只有一个能读到内容）
  if (post.burn_after_read) {
    const rows = await db.all('DELETE FROM posts WHERE id = ? AND burn_after_read = 1 RETURNING *', post.id)
    if (!rows.length) return c.json({ ok: false, error: 'not found' }, 404)
    post = rows[0]
  }
  return c.json({ ok: true, ...postBody(post) })
}

async function burnAndServe(c, db, post, lang = 'zh') {
  if (post.burn_after_read) await db.run('DELETE FROM posts WHERE id = ?', post.id)
  c.header('Vary', 'Accept-Language, Cookie')
  return c.html(articlePage(post, lang, origin(c)))
}

/** HMAC-SHA256 签名（hex） */
async function hmacHex(payload, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

const CHALLENGE_TTL = 10 * 60_000

/** 校验算术挑战（发布接口用）：返回错误文案或 null */
async function verifyArithmeticChallenge(ch, env) {
  if (!ch || typeof ch !== 'object') return 'challenge required'
  const a = Number(ch.a), b = Number(ch.b)
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 2 || b < 2 || a > 9 || b > 9) return 'challenge invalid'
  if (!Number.isInteger(ch.exp) || ch.exp < Date.now() || ch.exp > Date.now() + 15 * 60_000) return 'challenge expired'
  const expected = await hmacHex(`${a}+${b}:${ch.nonce}:${ch.exp}`, String(env.CHALLENGE_SECRET || 'opus-challenge-v1'))
  if (!timingSafeEqual(String(ch.sig), expected)) return 'challenge sig mismatch'
  if (Number(ch.answer) !== a + b) return 'challenge answer wrong'
  return null
}

/** 定期清理：物理删除已过期文章（Workers Cron / VPS 启动时调用） */
export async function purgeExpiredPosts(db) {
  await db.run('DELETE FROM posts WHERE expires_at IS NOT NULL AND expires_at <= ?', Date.now())
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}
