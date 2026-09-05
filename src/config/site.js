/**
 * 站点级单一数据源：名称、域名、页脚链接。
 * 前端（App.vue）与服务端页面模板（server/pages.js）共同引用，
 * 修改页脚链接 / 站点名只需改这一个文件。
 */
export const SITE_NAME = 'Opus'
export const SITE_DOMAIN = 'opus.cc'

export const FOOTER_LINKS = [
  { path: '/about', labelKey: 'about' },
  { path: '/terms', labelKey: 'terms' },
  { path: '/privacy', labelKey: 'privacy' },
]
