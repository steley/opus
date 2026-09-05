import { checkImageUrl, checkVideoUrl } from '../config/whitelist.js'

function hostOf(src) {
  try {
    return new URL(src, location.href).hostname
  } catch {
    return src
  }
}

/**
 * 粘贴/拖拽 HTML 时的媒体白名单过滤（ProseMirror editorProps）。
 * 不在白名单内的 img / iframe / video 直接从粘贴内容中剔除，
 * onBlocked 收到结构化信息 { media, code, host }，文案由 i18n 层处理。
 */
export function createPasteFilter({ onBlocked } = {}) {
  return {
    transformPastedHTML(html) {
      const doc = new DOMParser().parseFromString(html, 'text/html')

      doc.querySelectorAll('img').forEach(el => {
        const src = el.getAttribute('src') || ''
        const res = checkImageUrl(src)
        if (!res.ok) {
          el.remove()
          if (src) onBlocked?.({ media: 'image', code: res.error.code, host: hostOf(src) })
        }
      })

      doc.querySelectorAll('iframe, video').forEach(el => {
        const src = el.getAttribute('src') || el.querySelector('source')?.getAttribute('src') || ''
        if (!src) {
          el.remove()
          return
        }
        const res = checkVideoUrl(src)
        if (!res.ok) {
          el.remove()
          onBlocked?.({ media: 'video', code: res.error.code, host: hostOf(src) })
        }
      })

      return doc.body.innerHTML
    },
  }
}
