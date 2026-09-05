import { Node } from '@tiptap/core'

/**
 * 自定义视频节点（TipTap 无官方视频扩展）。
 * - 直链视频 → <video controls>
 * - 平台视频 → <iframe embed>（sandbox 限制 + no-referrer）
 * src 永远保留原始 URL，embed 才是 iframe 实际地址。
 */
export const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      embed: { default: null },
    }
  },

  parseHTML() {
    return [
      { tag: 'video[src]', getAttrs: el => ({ src: el.getAttribute('src'), embed: null }) },
      { tag: 'iframe[src]', getAttrs: el => ({ src: el.getAttribute('src'), embed: el.getAttribute('src') }) },
    ]
  },

  renderHTML({ node }) {
    if (node.attrs.embed) {
      return ['div', { 'data-video': node.attrs.src, class: 'video-embed' },
        ['iframe', {
          src: node.attrs.embed,
          sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups',
          referrerpolicy: 'no-referrer',
          allowfullscreen: 'true',
          frameborder: '0',
          loading: 'lazy',
        }],
      ]
    }
    return ['div', { 'data-video': node.attrs.src, class: 'video-file' },
      ['video', { src: node.attrs.src, controls: 'true', preload: 'metadata' }],
    ]
  },

  addCommands() {
    return {
      insertVideo: attrs => ({ commands }) =>
        commands.insertContent({ type: this.name, attrs }),
    }
  },
})
