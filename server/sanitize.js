/**
 * 服务端 HTML 净化 —— 安全边界（第三层白名单）。
 * 前端编辑器/粘贴的白名单都可以被绕过（直接调 API），
 * 入库前必须在这里做最终过滤。规则与编辑器 schema 对齐。
 */
import sanitizeHtml from 'sanitize-html'
import { whitelist } from '../src/config/whitelist.js'

// iframe 只允许白名单嵌入域名（sanitize-html 支持精确域名，不含通配）
const iframeHosts = whitelist.embedHosts.filter(h => !h.startsWith('*.'))

// 图片域名白名单（sanitize-html 无内建 img 域名过滤，transform 拒之）
const imageHostSet = new Set(whitelist.imageHosts)
function hostAllowed(hostname) {
  return imageHostSet.has(hostname)
}

export function sanitizePostHtml(html) {
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'h2', 'h3', 'br', 'strong', 'em', 'u', 's',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr',
      'img', 'div', 'iframe', 'span', 'label', 'input', 'a',
    ],
    allowedAttributes: {
      img: ['src', 'alt'],
      a: ['href', 'rel', 'target'],
      iframe: ['src', 'sandbox', 'referrerpolicy', 'allowfullscreen', 'frameborder', 'loading'],
      div: ['class', 'data-video'],
      ul: ['data-type'],
      li: ['data-checked'],
      span: ['style'],
      input: ['type', 'checked', 'disabled'],
      label: [],
    },
    // 颜色类内联样式只放行 hex 颜色值
    allowedStyles: {
      span: {
        color: [/^#[0-9a-fA-F]{3,8}$/],
        'background-color': [/^#[0-9a-fA-F]{3,8}$/],
      },
    },
    allowedSchemes: ['https'],
    allowedSchemesByTag: { img: ['https'], a: ['https'] },
    allowedIframeHostnames: iframeHosts,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'nofollow noopener noreferrer', target: '_blank' }),
      // iframe 强制受限 sandbox（服务端才是安全边界；前端只给体验，直连 API 需在此兜底）
      iframe: (tagName, attribs) => {
        attribs.sandbox = 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-presentation allow-top-navigation'
        attribs.referrerpolicy = 'strict-origin-when-cross-origin'
        return { tagName, attribs }
      },
      // div 仅放行编辑器固定使用的两个 class（video-embed / video-file），其余剔除，
      // 防作者在正文伪造 .pw-card/.edit-link 等真实样式做 UI 钓鱼
      div: (tagName, attribs) => {
        if (!['video-embed', 'video-file'].includes(attribs.class)) delete attribs.class
        return { tagName, attribs }
      },
      // 阅读页复选框一律禁用，不可交互
      input: (tagName, attribs) => ({ ...attribs, disabled: 'disabled' }),
      // 图片域名不在白名单则整个移除（iframe 域名由 allowedIframeHostnames 把关）
      img: (tagName, attribs) => {
        try {
          if (attribs.src && hostAllowed(new URL(attribs.src).hostname)) return { tagName, attribs }
        } catch { /* 非法 src 交由 allowedSchemes 拒绝 */ }
        return { tagName: 'span', attribs: {}, text: '' } // 降级为空 span，等效移除
      },
    },
  })
}
