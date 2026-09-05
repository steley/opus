import { ref } from 'vue'

/** UI 语言状态：zh / en，模块级单例，各组件直接 import 使用 */
const saved = localStorage.getItem('opus-lang') ?? localStorage.getItem('write-lang') /* 旧键迁移 */
export const lang = ref(saved === 'en' ? 'en' : 'zh')

const messages = {
  zh: {
    publish: '发布',
    title: '标题',
    author: '作者',
    startPlaceholder: '开始写作…',
    about: '关于',
    terms: '服务条款',
    privacy: '隐私政策',
    dark: '夜间模式',
    light: '日间模式',
    switchLang: 'English',
    backTop: '返回顶部',
    undo: '撤销 (⌘Z)',
    redo: '重做 (⌘⇧Z)',
    h2: '二级标题',
    h3: '三级标题',
    paragraph: '正文',
    bold: '加粗 (⌘B)',
    italic: '斜体 (⌘I)',
    underline: '下划线 (⌘U)',
    strike: '删除线 (⌘⇧S)',
    ol: '有序列表',
    ul: '无序列表',
    task: '清单',
    quote: '引用 (⌘⇧B)',
    codeBlock: '代码块 (⌘⌥C)',
    insertImage: '插入图片 URL',
    insertVideo: '插入视频 URL',
    insertImageTitle: '插入图片',
    insertVideoTitle: '插入视频',
    imageUrlPh: 'https:// 图片地址',
    videoUrlPh: 'YouTube / B 站视频页面链接',
    cancel: '取消',
    insert: '插入',
    apply: '应用',
    clear: '清除',
    okPass: '✓ 通过白名单校验',
    okEmbed: '✓ 将以嵌入框插入：{url}',
    whitelistHosts: '白名单',
    close: '关闭',
    textColor: '文字颜色',
    bgColor: '背景颜色',
    errInvalid: 'URL 格式无效',
    errHttps: '仅支持 https 链接',
    errWhitelist: '域名 {host} 不在{kind}白名单内（见 src/config/whitelist.js）',
    image: '图片',
    video: '视频',
    nonHttps: '非 https 链接',
    blocked: '已拦截白名单以外的{kind}（{desc}）',

    publishTitle: '发布文章',
    burnAfterRead: '阅后即焚',
    burnHint: '文章被首次阅读后自动销毁',
    expiry: '有效期',
    exp1h: '1 小时',
    exp12h: '12 小时',
    exp24h: '24 小时',
    exp1d: '1 天',
    exp15d: '15 天',
    exp30d: '30 天',
    exp90d: '90 天',
    exp180d: '180 天',
    exp365d: '365 天',
    viewPassword: '查看密码（可选）',
    pwViewPh: '至少 4 位',
    managePassword: '管理密码（必填）',
    pwEditPh: '至少 8 位',
    managePasswordAgain: '再次确认管理密码',
    manageNote: '管理密码拥有编辑和删除本文的权限，请妥善保管，丢失后无法找回。',
    back: '返回',
    confirm: '确认',
    publishing: '发布中…',
    errManageLen: '管理密码至少 8 位',
    errViewLen: '查看密码至少 4 位',
    errMismatch: '两次输入的管理密码不一致',
    publishedTitle: '文章已发布 ✓',
    validUntil: '有效期至 {date}，到期自动删除。',
    publishedHint: '编辑或删除文章需要管理密码，请妥善保存链接与密码。',
    copyLink: '复制链接',
    copiedTip: '文章链接已复制到剪贴板 ✓',
    copyFailTip: '自动复制失败，请手动复制链接',
    done: '完成',
    errEmpty: '请先写点什么再发布',
    errPublish: '发布失败',

    editPwTitle: '输入管理密码以编辑',
    wrongPw: '密码错误，请重试',
    delete: '删除',
    update: '更新',
    updating: '更新中…',
    updated: '文章已更新 ✓',
    deleted: '文章已删除',
    confirmDeleteText: '确认删除这篇文章？此操作不可恢复。',
    confirmDelete: '确认删除',
  },
  en: {
    publish: 'Publish',
    title: 'Title',
    author: 'Author',
    startPlaceholder: 'Start writing…',
    about: 'About',
    terms: 'Terms',
    privacy: 'Privacy',
    dark: 'Dark mode',
    light: 'Light mode',
    switchLang: '中文',
    backTop: 'Back to top',
    undo: 'Undo (⌘Z)',
    redo: 'Redo (⌘⇧Z)',
    h2: 'Heading 2',
    h3: 'Heading 3',
    paragraph: 'Paragraph',
    bold: 'Bold (⌘B)',
    italic: 'Italic (⌘I)',
    underline: 'Underline (⌘U)',
    strike: 'Strikethrough (⌘⇧S)',
    ol: 'Ordered list',
    ul: 'Bullet list',
    task: 'Checklist',
    quote: 'Quote (⌘⇧B)',
    codeBlock: 'Code block (⌘⌥C)',
    insertImage: 'Insert image URL',
    insertVideo: 'Insert video URL',
    insertImageTitle: 'Insert image',
    insertVideoTitle: 'Insert video',
    imageUrlPh: 'https:// image URL',
    videoUrlPh: 'YouTube / Bilibili video page link',
    cancel: 'Cancel',
    insert: 'Insert',
    apply: 'Apply',
    clear: 'Clear',
    okPass: '✓ Passed whitelist check',
    okEmbed: '✓ Will be inserted as embed: {url}',
    whitelistHosts: 'Whitelist',
    close: 'Close',
    textColor: 'Text color',
    bgColor: 'Background color',
    errInvalid: 'Invalid URL',
    errHttps: 'HTTPS links only',
    errWhitelist: 'Host {host} is not in the {kind} whitelist (see src/config/whitelist.js)',
    image: 'image',
    video: 'video',
    nonHttps: 'non-HTTPS link',
    blocked: 'Blocked {kind} outside the whitelist ({desc})',

    publishTitle: 'Publish Article',
    burnAfterRead: 'Burn after reading',
    burnHint: 'Content is destroyed after first read',
    expiry: 'Expiry',
    exp1h: '1 hour',
    exp12h: '12 hours',
    exp24h: '24 hours',
    exp1d: '1 day',
    exp15d: '15 days',
    exp30d: '30 days',
    exp90d: '90 days',
    exp180d: '180 days',
    exp365d: '365 days',
    viewPassword: 'View password (optional)',
    pwViewPh: 'at least 4 characters',
    managePassword: 'Manage password (required)',
    pwEditPh: 'at least 8 characters',
    managePasswordAgain: 'Confirm manage password',
    manageNote: 'The manage password grants permission to edit and delete this article. Keep it safe — it cannot be recovered.',
    back: 'Back',
    confirm: 'Confirm',
    publishing: 'Publishing…',
    errManageLen: 'Manage password must be at least 8 characters',
    errViewLen: 'View password must be at least 4 characters',
    errMismatch: 'Manage passwords do not match',
    publishedTitle: 'Article published ✓',
    validUntil: 'Valid until {date}, then auto-deleted.',
    publishedHint: 'Editing or deleting the article requires the manage password. Keep the link and password safe.',
    copyLink: 'Copy link',
    copiedTip: 'Article link copied to clipboard ✓',
    copyFailTip: 'Auto-copy failed, please copy the link manually',
    done: 'Done',
    errEmpty: 'Write something before publishing',
    errPublish: 'Publish failed',

    editPwTitle: 'Enter manage password to edit',
    wrongPw: 'Wrong password, try again',
    delete: 'Delete',
    update: 'Update',
    updating: 'Updating…',
    updated: 'Article updated ✓',
    deleted: 'Article deleted',
    confirmDeleteText: 'Delete this article? This cannot be undone.',
    confirmDelete: 'Delete',
  },
}

export function t(key) {
  return messages[lang.value][key] ?? messages.zh[key] ?? key
}

/** 后端错误码 → 当前语言文案（匹配不到时原样显示） */
const API_ERRORS = {
  zh: {
    'empty content': '内容为空',
    'content too large': '内容过大',
    'view password too short': '查看密码至少 4 位',
    'manage password too short': '管理密码至少 8 位',
    'too many requests': '操作过于频繁，请稍后再试',
    'not found': '文章不存在或已删除',
    'wrong password': '密码错误',
    'invalid body': '请求无效',
    'id space exhausted': '链接 ID 空间暂时不可用，请重试',
    'internal error': '服务器内部错误',
  },
}

export function apiErrorText(serverMsg) {
  return API_ERRORS[lang.value]?.[serverMsg] ?? serverMsg
}

/** 媒体校验错误 → 当前语言文案（err = { code, host? }） */
export function mediaErrorText(err, kind = 'image') {
  const kindText = t(kind)
  if (err.code === 'invalid') return t('errInvalid')
  if (err.code === 'https') return t('errHttps')
  return t('errWhitelist').replace('{host}', err.host ?? '').replace('{kind}', kindText)
}

/** 粘贴拦截提示（info = { media, code, host }） */
export function blockedText(info) {
  const desc = info.code === 'https' ? t('nonHttps') : info.host
  return t('blocked')
    .replace('{kind}', t(info.media))
    .replace('{desc}', desc)
}

export function toggleLang() {
  lang.value = lang.value === 'zh' ? 'en' : 'zh'
  localStorage.setItem('opus-lang', lang.value)
  // 同步 cookie，服务端渲染的页面（阅读页/文档页）跟随语言选择
  document.cookie = `opus-lang=${lang.value};max-age=31536000;path=/`
  applyLang()
}

export function applyLang() {
  document.documentElement.lang = lang.value === 'zh' ? 'zh-CN' : 'en'
  document.title = lang.value === 'zh' ? 'Opus — 落笔即发布' : 'Opus — Write. Publish. Done.'
}

applyLang()
