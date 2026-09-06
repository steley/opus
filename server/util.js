/** 后端工具：短 ID、PBKDF2 口令哈希、常量时间比较、入参校验、HTML 转义 */

const VIEW_PW_MIN = 4
const EDIT_PW_MIN = 8

const ID_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ' // 去掉易混淆的 0O1lI

export function genId(len = 8) {
  const alphabet = ID_ALPHABET
  const max = 256 - (256 % alphabet.length) // 拒绝采样上限，消除取模偏差
  let out = ''
  while (out.length < len) {
    const bytes = new Uint8Array(len * 2)
    crypto.getRandomValues(bytes)
    for (const b of bytes) {
      if (b < max) out += alphabet[b % alphabet.length]
      if (out.length === len) return out
    }
  }
  return out
}

const enc = new TextEncoder()

// 5000 迭代：Workers 免费版单请求 10ms CPU 限制下的平衡值（随机盐 + 限流兜底）
async function pbkdf2(password, saltBytes, iterations = 5000) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    key, 256
  )
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('')
}

function randomHex(n = 16) {
  const bytes = new Uint8Array(n)
  crypto.getRandomValues(bytes)
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
}

/** 存储格式：saltHex:hashHex */
export async function hashPassword(password) {
  const salt = randomHex(16)
  const hash = await pbkdf2(password, hexBytes(salt))
  return `${salt}:${hash}`
}

export async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false
  const [salt, expected] = stored.split(':')
  const hash = await pbkdf2(password, hexBytes(salt))
  return timingSafeEqual(hash, expected)
}

function hexBytes(hex) {
  return new Uint8Array(hex.match(/.{2}/g).map(h => parseInt(h, 16)))
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** 口令规则：任意可见字符（大小写字母/数字/特殊字符），仅限最小长度 */
function checkPassword(pw, minLen) {
  return typeof pw === 'string' && pw.length >= minLen
}

export function escapeHtml(s = '') {
  return String(s)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

/** 发布入参校验：返回 { error } 或规范化字段 */
const EXPIRY_OPTIONS = ['1h', '12h', '24h', '1d', '15d', '30d', '90d', '180d', '365d']
const EXPIRY_DEFAULT = '30d'

export function validatePublish(body) {
  const title = typeof body.title === 'string' ? body.title.slice(0, 200) : ''
  const author = typeof body.author === 'string' ? body.author.trim().slice(0, 100) : ''
  const html = typeof body.html === 'string' ? body.html : ''
  const json = typeof body.json === 'string' ? body.json : JSON.stringify(body.json ?? [])
  const burnAfterRead = body.burnAfterRead ? 1 : 0

  if (!html.trim() && json === '[]') return { error: 'empty content' }
  // 上限同时约束 html 与 json（json 由客户端可控，防止绕过前端塞入大对象消耗存储/配额）
  if (html.length > 500_000) return { error: 'content too large' }
  if (json.length > 1_000_000) return { error: 'content too large' }
  // 叠加上限：html 与 json 可同时接近各自上限，避免单请求总负载过大
  if (html.length + json.length > 1_200_000) return { error: 'content too large' }

  const viewPassword = typeof body.viewPassword === 'string' ? body.viewPassword : ''
  if (viewPassword && !checkPassword(viewPassword, VIEW_PW_MIN)) return { error: 'view password too short' }
  if (!checkPassword(body.managePassword, EDIT_PW_MIN)) return { error: 'manage password too short' }

  const expiry = EXPIRY_OPTIONS.includes(body.expiry) ? body.expiry : EXPIRY_DEFAULT

  return {
    fields: { title, author, html, json, burnAfterRead, viewPassword, managePassword: body.managePassword, expiry },
  }
}
