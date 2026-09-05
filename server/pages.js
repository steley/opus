import { escapeHtml } from './util.js'
import { FOOTER_LINKS, SITE_NAME } from '../src/config/site.js'

/** 服务端渲染页面的双语文案（按请求的 Accept-Language 选择） */
const TEXT = {
  zh: {
    protectedTitle: '🔒 受保护的文章',
    protectedDesc: '这篇文章受查看密码保护，请输入密码阅读。',
    pwPlaceholder: '查看密码',
    read: '阅读',
    pwWrong: '密码错误，请重试。',
    expiryReminder: '🕓 本文有效期至 {date}，到期自动删除。',
    editEntry: '✎ 编辑',
    labels: { about: '关于', terms: '服务条款', privacy: '隐私政策' },
    editTitle: '输入管理密码进入编辑',
    notFoundDesc: '文章不存在，或已被焚毁/过期删除。',
    backHome: '返回首页',
    anonymous: 'Anonymous',
    pwPageTitle: '受保护的文章',
  },
  en: {
    protectedTitle: '🔒 Protected article',
    protectedDesc: 'This article is protected by a view password. Enter it to read.',
    pwPlaceholder: 'View password',
    read: 'Read',
    pwWrong: 'Wrong password, please try again.',
    expiryReminder: '🕓 This article expires on {date} and will be auto-deleted.',
    editEntry: '✎ Edit',
    labels: { about: 'About', terms: 'Terms', privacy: 'Privacy' },
    editTitle: 'Enter manage password to edit',
    notFoundDesc: 'This article does not exist, or was burned / expired.',
    backHome: 'Back to home',
    anonymous: 'Anonymous',
    pwPageTitle: 'Protected article',
  },
}

export const txt = lang => TEXT[lang] ?? TEXT.zh

/** 阅读页基础样式（与编辑器排版观感一致，纯内联不依赖外部资源） */
const READER_CSS = `
:root{
  color-scheme:light;
  --paper:#f7f3ea;--surface:#fdfbf5;--ink:#3d3a34;--ink-2:#75705f;--line:#e6e0d2;
  --accent:#4a708c;--hover:#ede7d9;--code-bg:#efeadd;--inline-code:#9c5535;
  --muted:#a39a85;--hint-bad:#b8614b;--ph:#b9b19d;--btn-border:#1a1a1a;
  --font-ui:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif;
}
:root.dark{
  color-scheme:dark;
  --paper:#22262a;--surface:#2b3034;--ink:#c9cbc4;--ink-2:#969b92;--line:#3a3f42;
  --accent:#86a9c5;--hover:#343a3f;--code-bg:#2a2f33;--inline-code:#d3a17d;
  --muted:#84898c;--hint-bad:#d98d77;--ph:#6b7176;--btn-border:#ffffff;
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.9 var(--font-ui);-webkit-font-smoothing:antialiased;transition:background-color .2s,color .2s}
main{max-width:680px;margin:0 auto;padding:48px 20px 80px}
h1{font-size:30px;line-height:1.4;margin:0 0 10px}
.meta-row{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}
address{font-style:normal;color:var(--ink-2);font-size:14px;margin:0}
.edit-link{flex:none;font-size:13px;color:var(--ink);text-decoration:none;border:1px solid var(--btn-border);border-radius:8px;padding:5px 12px;background:var(--paper);transition:all .15s}
.edit-link:hover{color:var(--accent);border-color:var(--accent)}
p{margin:.55em 0}
h2{font-size:1.35em;margin:1.1em 0 .4em}
h3{font-size:1.12em;margin:1em 0 .35em}
blockquote{margin:.9em 0;padding:2px 0 2px 16px;border-left:3px solid var(--line);color:var(--ink-2)}
pre{background:var(--code-bg);border:1px solid var(--line);border-radius:9px;padding:13px 16px;overflow-x:auto;font-size:13.5px;line-height:1.65;font-family:ui-monospace,"SF Mono",Menlo,Consolas,"Cascadia Mono","PingFang SC","Microsoft YaHei",monospace}
code{background:var(--hover);border-radius:4px;padding:.15em .4em;font-size:.88em;font-family:ui-monospace,"SF Mono",Menlo,Consolas,"Cascadia Mono","PingFang SC","Microsoft YaHei",monospace;color:var(--inline-code)}
pre code{background:none;border:none;padding:0;color:inherit}
ul[data-type=taskList]{list-style:none;padding-left:.2em}
ul[data-type=taskList] li{display:flex;gap:9px;align-items:flex-start}
img{max-width:100%;height:auto;border-radius:8px}
.video-embed{position:relative;aspect-ratio:16/9;margin:.8em 0;border-radius:9px;overflow:hidden;background:#000}
.video-embed iframe{width:100%;height:100%;border:0}
.video-file video{width:100%;border-radius:9px}
hr{border:none;border-top:1px solid var(--line);margin:1.6em 0}
a{color:var(--accent)}
.expiry{font-size:13px;color:var(--muted);margin:0 0 26px}
.home-link{display:inline-block;font-size:13px;color:var(--ink);text-decoration:none;border:1px solid var(--btn-border);border-radius:8px;padding:7px 16px;background:var(--paper);transition:all .15s}
.home-link:hover{color:var(--accent);border-color:var(--accent)}
.pw-card{max-width:380px;margin:18vh auto 0;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:26px;box-shadow:0 8px 28px rgba(0,0,0,.18)}
.pw-card h1{font-size:18px}
.pw-card p{font-size:14px;color:var(--ink-2)}
.pw-card input{width:100%;border:1px solid var(--line);border-radius:8px;padding:10px 12px;font-size:16px;margin:14px 0;box-sizing:border-box;background:var(--surface);color:var(--ink)}
.pw-card button{width:100%;border:none;border-radius:8px;padding:10px;background:var(--accent);color:var(--paper);font-size:16px;cursor:pointer}
.err{color:var(--hint-bad);font-size:13px;margin:0 0 10px}
.muted{color:var(--muted)}
@media(max-width:560px){main{padding:32px 16px 60px}h1{font-size:24px}}

.footer{max-width:680px;margin:0 auto;padding:22px 20px 44px;display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:14px 48px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}
.footer-links{display:flex;gap:22px}
.footer a{color:var(--ink-2);text-decoration:none;transition:color .15s}
.footer a:hover{color:var(--accent)}
.copyright{letter-spacing:.2px}

.float-actions{position:fixed;right:22px;bottom:28px;z-index:40;display:flex;flex-direction:column;gap:10px}
.fab{width:42px;height:42px;border-radius:50%;border:1px solid var(--btn-border);background:var(--paper);color:var(--ink-2);cursor:pointer;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;transition:all .15s;padding:0}
.fab:hover{color:var(--accent);border-color:var(--accent);transform:translateY(-1px)}
.fab .icon-sun{display:none}
:root.dark .fab .icon-sun{display:block}
:root.dark .fab .icon-moon{display:none}
`

const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%231f1c17'/%3E%3Cpath d='M32 9c7.4 4.9 11.6 11.5 11.6 19 0 6.8-4.2 12.6-11.6 26-7.4-13.4-11.6-19.2-11.6-26C20.4 20.5 24.6 13.9 32 9Z' fill='%23f7f3ea'/%3E%3Ccircle cx='32' cy='28.5' r='3.6' fill='%231f1c17'/%3E%3Cpath d='M32 32.5V49.5' stroke='%231f1c17' stroke-width='2.8'/%3E%3C/svg%3E"

const pageShell = (title, body, { lang = 'zh', head = '' } = {}) => {
  const m = txt(lang)
  const year = new Date().getFullYear()
  const footerLinks = FOOTER_LINKS
    .map(l => `<a href="${l.path}">${escapeHtml(txt(lang).labels?.[l.labelKey] ?? l.labelKey)}</a>`)
    .join('\n    ')
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" type="image/svg+xml" href="${FAVICON}">
<title>${escapeHtml(title)}</title>
<script>(function(){try{var t=localStorage.getItem('opus-theme');var d=t?t==='dark':(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');var m=document.querySelector('meta[name=theme-color]');if(m)m.content='#22262a'}}catch(e){}})();</script>
<meta name="theme-color" content="#f7f3ea">
${head}
<style>${READER_CSS}</style>
</head>
<body>${body}
<footer class="footer">
  <nav class="footer-links">
    ${footerLinks}
  </nav>
  <span class="copyright">© ${year} ${escapeHtml(SITE_NAME)}</span>
</footer>
<div class="float-actions">
  <button class="fab" id="fab-theme" aria-label="theme">
    <svg class="icon-moon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.9 9.9A6.2 6.2 0 0 1 6.1 2.1 6.2 6.2 0 1 0 13.9 9.9Z"/></svg>
    <svg class="icon-sun" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 1.2v1.8M8 13v1.8M1.2 8H3M13 8h1.8M3.2 3.2l1.3 1.3M11.5 11.5l1.3 1.3M12.8 3.2l-1.3 1.3M4.5 11.5l-1.3 1.3"/></svg>
  </button>
  <button class="fab" id="fab-lang" aria-label="language">${lang === 'zh' ? 'EN' : '中'}</button>
  <button class="fab" id="fab-top" aria-label="top">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13.5v-11M3.8 6.7 8 2.5l4.2 4.2"/></svg>
  </button>
</div>
<script>
(function(){
  function on(id, fn, unlockMs){
    var el = document.getElementById(id);
    el.addEventListener('click', function(){
      if (el.dataset.busy) return;
      el.dataset.busy = '1';
      fn();
      if (unlockMs) setTimeout(function(){ delete el.dataset.busy; }, unlockMs);
    });
  }
  on('fab-theme', function(){
    var dark = document.documentElement.classList.toggle('dark');
    try{ localStorage.setItem('opus-theme', dark ? 'dark' : 'light') }catch(e){}
    var m = document.querySelector('meta[name=theme-color]');
    if (m) m.content = dark ? '#22262a' : '#f7f3ea';
  }, 400);
  on('fab-lang', function(){
    var next = document.documentElement.getAttribute('lang') === 'zh' ? 'en' : 'zh';
    document.cookie = 'opus-lang=' + next + ';max-age=31536000;path=/';
    location.reload();
  });
  on('fab-top', function(){
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
</script>
</body>
</html>`
}

function fmtDate(ms) {
  const d = new Date(ms)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 从 HTML 提取纯文本摘要（正文前 160 字） */
function plainText(html, max = 160) {
  return (html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/** 文章阅读页：产品决策——所有文章一律不进搜索引擎索引；OG/Twitter 仅用于分享预览 */
export function articlePage(post, lang = 'zh', origin = '') {
  const m = txt(lang)
  const description = plainText(post.html) || m.expiryReminder.replace('{date}', fmtDate(post.expires_at))
  const url = `${origin}/${post.id}`
  const head = `<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="noindex, nofollow">
<link rel="canonical" href="${escapeHtml(url)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${escapeHtml(post.title || 'Untitled')}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:image" content="${escapeHtml(origin)}/og.png">
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="article:published_time" content="${new Date(post.created_at).toISOString()}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${escapeHtml(origin)}/og.png">
<meta name="twitter:title" content="${escapeHtml(post.title || 'Untitled')}">
<meta name="twitter:description" content="${escapeHtml(description)}">`
  const expiry = post.expires_at
    ? `<p class="expiry">${m.expiryReminder.replace('{date}', fmtDate(post.expires_at))}</p>`
    : ''
  const editLink = `<a class="edit-link" href="/edit/${escapeHtml(post.id)}" title="${escapeHtml(m.editTitle)}">${m.editEntry}</a>`
  const body = `<main>
<h1>${escapeHtml(post.title)}</h1>
<div class="meta-row">
<address>${post.author ? escapeHtml(post.author) : m.anonymous}</address>
${editLink}
</div>
${expiry}
<div class="content">${post.html}</div>
</main>`
  return pageShell(post.title || 'Untitled', body, { lang, head })
}

/** 查看密码中间页（表单 POST 回本页，无需 JS） */
export function passwordPage(id, lang = 'zh', errorMsg = '') {
  const m = txt(lang)
  const body = `<main>
<div class="pw-card">
<h1>${m.protectedTitle}</h1>
<p>${m.protectedDesc}</p>
${errorMsg ? `<p class="err">${escapeHtml(errorMsg)}</p>` : ''}
<form method="post" action="/${escapeHtml(id)}">
<input type="password" name="pw" placeholder="${m.pwPlaceholder}" autofocus required>
<button type="submit">${m.read}</button>
</form>
</div>
</main>`
  return pageShell(m.pwPageTitle, body, {
    lang,
    head: '<meta name="robots" content="noindex, nofollow">',
  })
}

export function notFoundPage(lang = 'zh') {
  const m = txt(lang)
  const body = `<main>
<div class="pw-card">
<h1>404</h1>
<p class="muted" style="font-size:14px">${m.notFoundDesc}</p>
<a class="home-link" href="/">← ${m.backHome}</a>
</div>
</main>`
  return pageShell('404', body, { lang })
}

// ---------- 静态文档页（关于 / 服务条款 / 隐私政策） ----------
const LAST_UPDATED = '2026-09-05'

const DOCS = {
  zh: {
    backHome: '← 返回首页',
    updated: '更新于 2026-09-05',
    about: {
      title: '关于 Opus',
      sections: [
        ['什么是 Opus', ['Opus（opus.cc）是一个极简的匿名写作与发布平台：无需注册，打开即写，落笔即发布。生成的每篇文章都有独立短链，可分享到任何地方。']],
        ['特性', ['免注册、免登录的匿名发布', '查看密码与阅后即焚，敏感内容可控', '有效期自动删除（1 小时至 365 天）', '管理密码保护下的编辑与删除', '富文本编辑器：标题、列表、代码块、图片与视频', '日间 / 夜间双主题，移动端适配']],
        ['名字的由来', ['Opus，拉丁语意为"作品"。我们相信每一篇文章都值得被认真对待——写下，即是作品。']],
        ['反馈', ['如对内容或服务有任何问题，欢迎写信至 hello@opus.cc。']],
      ],
    },
    terms: {
      title: '服务条款',
      sections: [
        ['条款的接受', ['访问或使用 Opus 即表示你已阅读并同意本服务条款。若不同意任何条款，请停止使用本服务。']],
        ['内容责任', ['所有文章内容由发布者自行提供并承担全部责任。Opus 仅提供技术发布工具，不对任何内容的真实性、合法性、适用性作任何背书或保证。']],
        ['使用规范', ['你承诺不利用本服务发布、存储或传播：违反任何适用法律法规的内容；侵犯他人知识产权、隐私权、名誉权等合法权益的内容；恶意程序、垃圾信息或其他滥用行为。对违规内容，管理员有权在不通知的情况下删除并限制相关访问。']],
        ['服务的提供与变更', ['本服务按"现状"提供，不保证服务不间断、无错误或绝对安全。我们保留随时修改、暂停或终止全部或部分服务的权利。']],
        ['责任限制', ['在适用法律允许的最大范围内，Opus 对因使用或无法使用本服务而产生的任何直接、间接、附带或后果性损失不承担责任。']],
        ['条款变更', ['本条款可能不时更新，更新后将在本页公布。更新后继续使用本服务即视为接受变更后的条款。']],
        ['联系', ['如对本条款有疑问，请联系 hello@opus.cc。']],
        ['联系', ['如对本条款有疑问，请联系 hello@opus.cc。']],
      ],
    },
    privacy: {
      title: '隐私政策',
      sections: [
        ['我们不需要你的身份', ['使用 Opus 无需注册：不收集姓名、邮箱、手机号或任何账号信息。']],
        ['我们收集的信息', ['你主动发布的内容（标题、署名、正文）；粗略的技术日志（如 IP 地址，仅用于限流防滥用，短期保留后自动清除）；浏览器发送的语言偏好（用于页面语言选择）。']],
        ['密码的存储', ['查看密码与管理密码均经 PBKDF2-SHA256 加盐哈希后存储，明文不会以任何形式保存。管理密码丢失后无法找回，届时将无法编辑或删除对应文章。']],
        ['本地存储', ['你的浏览器 localStorage 中仅保存两项偏好：夜间模式与界面语言。不包含任何个人数据。']],
        ['第三方', ['本站不含广告、统计分析和第三方追踪 Cookie。文章中的外部媒体（图片/视频）由相应第三方域名提供，其行为受各自政策约束。']],
        ['数据的删除', ['阅后即焚：首次成功阅读后立即销毁；有效期：到期后首次被访问时物理删除；手动删除：可随时使用管理密码删除文章。删除即从数据库中移除，不可恢复。']],
        ['政策更新', ['本政策可能不时更新，更新后将在本页公布。']],
        ['联系', ['如对本政策有疑问，请联系 hello@opus.cc。']],
        ['联系', ['如对本政策有疑问，请联系 hello@opus.cc。']],
      ],
    },
  },
  en: {
    backHome: '← Back to home',
    updated: 'Updated 2026-09-05',
    about: {
      title: 'About Opus',
      sections: [
        ['What is Opus', ['Opus (opus.cc) is a minimal anonymous publishing platform: no sign-up, open the page and write, publish with one click. Every article gets its own short link, shareable anywhere.']],
        ['Features', ['Anonymous publishing without registration', 'View password & burn-after-reading for sensitive content', 'Auto-expiry (1 hour to 365 days)', 'Edit & delete protected by the manage password', 'Rich editor: headings, lists, code blocks, images and video', 'Light / dark themes, mobile friendly']],
        ['Why the name', ['Opus is Latin for "a work". We believe every article deserves to be treated as one — once written, it is a work.']],
        ['Feedback', ['For any questions about content or the service, write to hello@opus.cc.']],
      ],
    },
    terms: {
      title: 'Terms of Service',
      sections: [
        ['Acceptance', ['By accessing or using Opus you agree to these terms. If you disagree with any part, please stop using the service.']],
        ['Content Responsibility', ['All article content is provided and owned by its publisher. Opus only supplies the publishing tool and does not endorse or guarantee the truthfulness, legality or fitness of any content.']],
        ['Acceptable Use', ['You agree not to publish, store or distribute: content that violates any applicable law; content infringing intellectual property, privacy or reputation rights of others; malware, spam or other abuse. Violating content may be removed without notice and access restricted.']],
        ['Service Availability', ['The service is provided "as is", without guarantees of uninterrupted or error-free operation. We may modify, suspend or discontinue all or part of the service at any time.']],
        ['Limitation of Liability', ['To the maximum extent permitted by law, Opus shall not be liable for any direct, indirect, incidental or consequential damages arising from the use of, or inability to use, the service.']],
        ['Changes', ['These terms may be updated from time to time. Continued use after an update constitutes acceptance of the revised terms.']],
        ['Contact', ['Questions about these terms: write to hello@opus.cc.']],
        ['Contact', ['Questions about these terms: hello@opus.cc.']],
      ],
    },
    privacy: {
      title: 'Privacy Policy',
      sections: [
        ['We do not want your identity', ['Opus requires no registration: no name, no email, no phone number, no accounts.']],
        ['What we collect', ['The content you publish (title, byline, body); rough technical logs (such as IP addresses, used only for rate limiting and abuse prevention, purged after a short period); your browser language preference (used to pick the page language).']],
        ['Password storage', ['View and manage passwords are stored as PBKDF2-SHA256 salted hashes. Plaintext is never kept. A lost manage password cannot be recovered — the article can then no longer be edited or deleted.']],
        ['Local storage', ['Your browser localStorage holds exactly two preferences: theme and interface language. No personal data.']],
        ['Third parties', ['No ads, no analytics, no third-party tracking cookies. External media embedded in articles (images/video) is served by those third-party domains under their own policies.']],
        ['Data deletion', ['Burn after reading: destroyed right after the first successful read. Expiry: physically deleted on first access past the deadline. Manual: delete anytime with the manage password. Deletion removes the row from the database permanently.']],
        ['Changes', ['This policy may be updated from time to time; updates are published on this page.']],
        ['Contact', ['Questions about this policy: write to hello@opus.cc.']],
        ['Contact', ['Questions about this policy: hello@opus.cc.']],
      ],
    },
  }
}

function docPage(lang, doc) {
  const m = txt(lang)
  const sections = doc.sections
    .map(([h, ps]) => `<h2>${escapeHtml(h)}</h2>\n${ps.map(p => `<p>${escapeHtml(p)}</p>`).join('\n')}`)
    .join('\n')
  const body = `<main>
<h1>${escapeHtml(doc.title)}</h1>
<div class="meta-row">
<address>Opus · opus.cc</address>
<a class="home-link" href="/">${escapeHtml(m.backHome)}</a>
</div>
<p class="expiry">${escapeHtml(DOCS[lang]?.updated ?? DOCS.zh.updated)}</p>
${sections}
<p class="contact">📮 <a href="mailto:hello@opus.cc">hello@opus.cc</a></p>
</main>`
  return pageShell(doc.title, body, { lang })
}

export function aboutPage(lang = 'zh') {
  return docPage(lang, (DOCS[lang] ?? DOCS.zh).about)
}

export function termsPage(lang = 'zh') {
  return docPage(lang, (DOCS[lang] ?? DOCS.zh).terms)
}

export function privacyPage(lang = 'zh') {
  return docPage(lang, (DOCS[lang] ?? DOCS.zh).privacy)
}
