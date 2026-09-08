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
      // 仅保留平台嵌入 iframe；直链 <video> 已废弃（服务端会剥，无可靠持存）
      { tag: 'iframe[src]', getAttrs: el => ({ src: el.getAttribute('src'), embed: el.getAttribute('src') }) },
    ]
  },

  renderHTML({ node }) {
    // 视频直链能力已废弃，仅支持平台嵌入。兼容旧节点时退化为 iframe(src)。
    const src = node.attrs.embed || node.attrs.src
    if (!src) return ['div', { class: 'video-embed' }]
    return ['div', { 'data-video': node.attrs.src || src, class: 'video-embed' },
      ['iframe', {
        src,
        sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups',
        referrerpolicy: 'no-referrer',
        allowfullscreen: 'true',
        frameborder: '0',
        loading: 'lazy',
      }],
    ]
  },

  addCommands() {
    return {
      insertVideo: attrs => ({ commands }) =>
        commands.insertContent({ type: this.name, attrs }),
    }
  },
})
