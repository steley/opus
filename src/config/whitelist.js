/**
 * 媒体 URL 白名单 —— 前端所有校验共用这一份配置。
 *
 * 三层校验：
 *   1. 插入时校验（MediaDialog，体验层）
 *   2. 粘贴/拖拽 HTML 过滤（editor/paste.js，体验层）
 *   3. 服务端入库前校验（安全层，必须做——匿名发布接口可被绕过前端直接调用，
 *      上线时应把这份配置同步给后端，用 DOMPurify + 相同域名规则二次过滤）
 *
 * 域名规则：精确匹配，或 "*.example.com" 通配子域；仅允许 https。
 */

export const whitelist = {
  /** true 时允许任意 https 图片源（开发期方便）；上线前改为 false */
  allowAnyImageHost: false,

  /** 图片直链域名 */
  imageHosts: [
    'i.imgur.com',
  ],

  /** 视频直链域名（渲染为 <video>）——当前为空，视频仅支持下方平台嵌入 */
  videoHosts: [],

  /** 平台嵌入域名（渲染为 <iframe>，转换结果必须落在这里） */
  embedHosts: [
    'www.youtube.com', 'www.youtube-nocookie.com',
    'player.bilibili.com',
  ],

  /** 域名展示名（发布框"白名单"区显示用） */
  hostNames: {
    'i.imgur.com': 'imgur',
    'www.youtube.com': 'YouTube',
    'www.youtube-nocookie.com': 'YouTube',
    'player.bilibili.com': 'bilibili',
  },
}

/** 平台页面 URL → embed 地址的转换规则，转换结果域名必须收录在 embedHosts */
const embedRules = [
  {
    test: /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/,
    build: id => `https://www.youtube.com/embed/${id}`,
  },
  {
    test: /bilibili\.com\/video\/(BV[\w]+)/,
    build: id => `https://player.bilibili.com/player.html?bvid=${id}&autoplay=0`,
  },
]

const VIDEO_FILE_EXT = /\.(mp4|webm|ogv|ogg|mov|m4v|m3u8)([?#]|$)/i

function hostAllowed(hostname, patterns) {
  return patterns.some(p =>
    p.startsWith('*.')
      ? hostname === p.slice(2) || hostname.endsWith('.' + p.slice(2))
      : hostname === p
  )
}

function parseUrl(url) {
  try {
    const u = new URL(url, location.href)
    if (u.protocol !== 'https:') return { error: { code: 'https' } }
    return { u }
  } catch {
    return { error: { code: 'invalid' } }
  }
}

/** 校验图片 URL，返回 { ok, url } 或 { ok: false, error: { code, host? } }，文案由 i18n 层处理 */
export function checkImageUrl(url) {
  const parsed = parseUrl(url)
  if (parsed.error) return { ok: false, error: parsed.error }
  const { u } = parsed
  if (whitelist.allowAnyImageHost || hostAllowed(u.hostname, whitelist.imageHosts)) {
    return { ok: true, url: u.href }
  }
  return { ok: false, error: { code: 'whitelist', host: u.hostname } }
}

/**
 * 校验视频 URL：
 *   - 平台页面（YouTube/B 站）→ 转换为 embed 地址，渲染为受 sandbox 限制的 iframe
 *   - 视频直链（mp4/webm/m3u8 等）→ 渲染为 <video>
 * 返回 { ok, kind: 'embed'|'file', src, embed? } 或 { ok: false, error: { code, host? } }
 */
export function checkVideoUrl(url) {
  const parsed = parseUrl(url)
  if (parsed.error) return { ok: false, error: parsed.error }
  const { u } = parsed
  const { hostname } = u

  for (const rule of embedRules) {
    const match = u.href.match(rule.test)
    if (match) {
      const embed = rule.build(match[1])
      if (hostAllowed(new URL(embed).hostname, whitelist.embedHosts)) {
        return { ok: true, kind: 'embed', src: u.href, embed }
      }
    }
  }

  if (VIDEO_FILE_EXT.test(u.pathname) && hostAllowed(hostname, whitelist.videoHosts)) {
    return { ok: true, kind: 'file', src: u.href }
  }

  if (hostAllowed(hostname, whitelist.embedHosts)) {
    return { ok: true, kind: 'embed', src: u.href, embed: u.href }
  }

  return { ok: false, error: { code: 'whitelist', host: hostname } }
}
