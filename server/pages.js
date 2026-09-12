import { escapeHtml } from './util.js'
import { FOOTER_LINKS, SITE_NAME } from '../src/config/site.js'

/** 服务端页面双语文案（zh/en 同时渲染进 HTML，客户端按 opus-lang cookie 切换显示） */
const TEXT = {
  zh: {
    protectedTitle: '🔒 受保护的文章',
    protectedDesc: '这篇文章受查看密码保护，请输入密码阅读。',
    pwPlaceholder: '查看密码',
    read: '阅读',
    pwWrong: '密码错误，请重试。',
    expiryReminder: '🕓 本文有效期至 {date}，到期自动删除。',
    burnReminder: '🔥 阅后即焚：首次打开后即被销毁；若无人阅读，将保留至 {date} 到期自动删除。',
    editEntry: '✎ 编辑',
    editTitle: '输入管理密码进入编辑',
    reportLink: '举报',
    reportSubjectPrefix: '[Opus 举报] ',
    labels: { about: '关于', terms: '服务条款', privacy: '隐私政策' },
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
    burnReminder: '🔥 Burn after reading: deleted on first open. If never opened, it stays until auto-deleted on {date}.',
    editEntry: '✎ Edit',
    editTitle: 'Enter manage password to edit',
    reportLink: 'Report',
    reportSubjectPrefix: '[Opus Report] ',
    labels: { about: 'About', terms: 'Terms', privacy: 'Privacy' },
    notFoundDesc: 'This article does not exist, or was burned / expired.',
    backHome: 'Back to home',
    anonymous: 'Anonymous',
    pwPageTitle: 'Protected article',
  },
}

/** 双语对：zh/en 各渲染一份（.t-en 默认 hidden），客户端内联脚本按 cookie 切换。
 *  页面因此与语言/cookie 解耦，成为可被浏览器与边缘共享缓存的同一段字节。 */
const dual = (zh, en) => `<span class="t-zh">${zh}</span><span class="t-en" hidden>${en}</span>`

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
.meta-actions{display:inline-flex;align-items:center;gap:10px;flex:none}
.report-link{font-size:12px;color:var(--hint-bad);text-decoration:none;border:1px solid var(--hint-bad);border-radius:8px;padding:6px 16px;background:var(--paper)}
.report-link:hover{background:var(--hint-bad);color:var(--paper)}
.report-row{display:flex;justify-content:flex-start;margin-top:52px}
p{margin:.55em 0}
.content pre{position:relative}
.code-copy{position:absolute;top:8px;right:8px;width:28px;height:28px;border:1px solid var(--line);border-radius:7px;background:var(--surface);color:var(--ink-2);cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s,color .15s;padding:0}
.content pre:hover .code-copy,.code-copy:focus-visible{opacity:1}
.code-copy:hover{color:var(--accent);border-color:var(--accent)}
.code-copy.ok{color:var(--accent);border-color:var(--accent);opacity:1}
@media(hover:none){.code-copy{opacity:.75}}
.content img{cursor:zoom-in}
.lightbox{position:fixed;inset:0;z-index:100;background:rgba(20,18,14,.88);display:flex;align-items:center;justify-content:center;cursor:zoom-out;opacity:0;visibility:hidden;transition:opacity .18s,visibility .18s}
.lightbox.show{opacity:1;visibility:visible}
.lightbox img{max-width:95vw;max-height:95vh;border-radius:8px;box-shadow:0 12px 48px rgba(0,0,0,.4)}
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
html{scroll-behavior:smooth}
h2[id],h3[id]{scroll-margin-top:16px}
.toc{background:var(--hover);border:1px solid var(--line);border-radius:10px;padding:10px 16px;margin:0 0 26px;font-size:14px}
.toc summary{cursor:pointer;color:var(--ink-2);font-size:13px;letter-spacing:.5px}
.toc nav{display:flex;flex-direction:column;gap:2px;margin-top:8px}
.toc a{color:var(--ink);text-decoration:none;border-radius:6px;padding:3px 8px}
.toc a:hover{background:var(--surface);color:var(--accent)}
.toc a.toc-lv3{padding-left:24px;font-size:13px;color:var(--ink-2)}
.expiry{font-size:13px;color:var(--muted);margin:0 0 26px}
.expiry.burn{color:#a4501a;font-weight:600}
:root.dark .expiry.burn{color:#e89a63}
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

// 语言切换：读 opus-lang cookie，切换 .t-zh/.t-en 的 hidden 与 html[lang]，无刷新。
// 双语文案已在 HTML 内（dual()），页面字节与语言无关 → 可被浏览器/边缘缓存。
const LANG_JS = `
(function(){
  function readLang(){ try{ var m=/(?:^|;\\s*)opus-lang=(zh|en)/.exec(document.cookie); return m?m[1]:'zh' }catch(e){ return 'zh' } }
  function apply(lang){
    document.documentElement.setAttribute('lang',lang);
    var zh=document.querySelectorAll('.t-zh'),en=document.querySelectorAll('.t-en'),i;
    for(i=0;i<zh.length;i++) zh[i].hidden=lang!=='zh';
    for(i=0;i<en.length;i++) en[i].hidden=lang!=='en';
    var ps=document.querySelectorAll('[data-ph-zh]');
    for(i=0;i<ps.length;i++) ps[i].placeholder=ps[i].getAttribute(lang==='zh'?'data-ph-zh':'data-ph-en')||'';
    var b=document.getElementById('fab-lang'); if(b) b.textContent=lang==='zh'?'EN':'中';
  }
  apply(readLang());
  var btn=document.getElementById('fab-lang');
  if(btn) btn.addEventListener('click',function(){
    if(btn.dataset.busy) return; btn.dataset.busy='1';
    var next=document.documentElement.getAttribute('lang')==='zh'?'en':'zh';
    try{ document.cookie='opus-lang='+next+';max-age=31536000;path=/' }catch(e){}
    apply(next);
    setTimeout(function(){ delete btn.dataset.busy },300);
  });
})();`

const pageShell = (title, body, { head = '' } = {}) => {
  const zh = TEXT.zh, en = TEXT.en
  const year = new Date().getFullYear()
  const footerLinks = FOOTER_LINKS
    .map(l => `<a href="${l.path}">${dual(escapeHtml(zh.labels?.[l.labelKey] ?? l.labelKey), escapeHtml(en.labels?.[l.labelKey] ?? l.labelKey))}</a>`)
    .join('\n    ')
  return `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" type="image/svg+xml" href="${FAVICON}">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
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
  <button class="fab" id="fab-lang" aria-label="language">EN</button>
  <button class="fab" id="fab-top" aria-label="top">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13.5v-11M3.8 6.7 8 2.5l4.2 4.2"/></svg>
  </button>
</div>
<script>
(function(){
  function on(id, fn, unlockMs){
    var el = document.getElementById(id);
    if (!el) return;
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
  on('fab-top', function(){
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
</script>
<script>${LANG_JS}</script>
</body>
</html>`
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

/** 长文目录：给 h2/h3 注入锚点 id 并收集条目（正文 HTML 已净化，标签仅用于提取纯文本标题） */
function buildToc(html) {
  const items = []
  const newHtml = (html || '').replace(/<h([23])((?:\s[^>]*)?)>([\s\S]*?)<\/h\1>/gi, (m, lv, attrs, inner) => {
    const id = `h-${items.length}`
    const text = inner.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    items.push({ lv: +lv, id, text })
    return `<h${lv}${attrs || ''} id="${id}">${inner}</h${lv}>`
  })
  return { html: newHtml, items }
}

/** 阅读页增强（零依赖内联 JS）：代码块一键复制 + 图片灯箱。仅文章页引入。 */
const READER_ENHANCE_JS = `
(function(){
  /* 代码块一键复制：图标按钮，成功后短暂显示 ✓（图标化避免双语问题） */
  var ICON='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  document.querySelectorAll('.content pre').forEach(function(pre){
    if (pre.querySelector('.code-copy')) return;
    var btn=document.createElement('button');
    btn.type='button'; btn.className='code-copy'; btn.innerHTML=ICON;
    btn.setAttribute('aria-label','copy code');
    function done(){ btn.classList.add('ok'); btn.textContent='\\u2713'; setTimeout(function(){ btn.classList.remove('ok'); btn.innerHTML=ICON; },1500); }
    function fallback(text){
      var ta=document.createElement('textarea'); ta.value=text;
      ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.select();
      try{ document.execCommand('copy'); done() }catch(e){}
      ta.remove();
    }
    btn.addEventListener('click',function(){
      var text=pre.innerText.replace(/\\n$/,'');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done,function(){ fallback(text) });
      else fallback(text);
    });
    pre.appendChild(btn);
  });
  /* 图片灯箱：点击放大，点击任意处/Esc 关闭 */
  var imgs=document.querySelectorAll('.content img');
  if (imgs.length){
    var box=document.createElement('div'); box.className='lightbox';
    var big=document.createElement('img');
    box.appendChild(big);
    box.addEventListener('click',function(){ box.classList.remove('show'); });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape') box.classList.remove('show'); });
    imgs.forEach(function(img){
      img.addEventListener('click',function(){
        big.src=img.currentSrc||img.src;
        big.alt=img.alt||'';
        box.classList.add('show');
      });
    });
    document.body.appendChild(box);
  }
})();`

/** 文章阅读页：产品决策——所有文章一律不进搜索引擎索引；OG/Twitter 仅用于分享预览 */
export function articlePage(post, origin = '') {
  const zh = TEXT.zh, en = TEXT.en
  const description = plainText(post.html) || '落笔，即发布。Write. Publish. Done.'
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
  // 到期时间必须在浏览器按“访客本地时区”格式化——SSR 侧不知访客时区，只透传 epoch 毫秒给 <time> data-ms
  const dateTimeJs = `<script>(function(){var es=document.querySelectorAll('.expiry-ts');if(!es.length)return;for(var i=0;i<es.length;i++){var ms=Number(es[i].getAttribute('data-ms'));if(!ms)continue;var d=new Date(ms),p=function(n){return String(n).padStart(2,'0')};es[i].textContent=d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes())}})();</script>`
  const dateEl = '<time class="expiry-ts" data-ms="' + post.expires_at + '"></time>'
  // 焚文用专属提示强调“阅后即焚”（首读即删），普通文才是“到期自动删除”；zh/en 各渲染一份
  const expiryCls = post.burn_after_read ? 'expiry burn' : 'expiry'
  const rem = (m) => (post.burn_after_read ? m.burnReminder : m.expiryReminder).replace('{date}', dateEl)
  const expiry = post.expires_at
    ? `<p class="${expiryCls} t-zh">${rem(zh)}</p><p class="${expiryCls} t-en" hidden>${rem(en)}</p>${dateTimeJs}`
    : ''
  const editLink = `<a class="edit-link" href="/edit/${escapeHtml(post.id)}" title="${escapeHtml(zh.editTitle)} / ${escapeHtml(en.editTitle)}">${dual(zh.editEntry, en.editEntry)}</a>`
  const reportHref = `mailto:hello@opus.cc?subject=${encodeURIComponent(zh.reportSubjectPrefix + url)}`
  const reportLink = `<a class="report-link" href="${escapeHtml(reportHref)}" rel="noopener noreferrer">${dual(zh.reportLink, en.reportLink)}</a>`
  const authorLine = post.author ? escapeHtml(post.author) : zh.anonymous
  // 长文目录：≥3 个 h2/h3 才显示（<details> 原生折叠，零 JS）
  const { html: contentHtml, items: tocItems } = buildToc(post.html)
  const toc = tocItems.length >= 3
    ? `<details class="toc">
<summary>${dual('目录', 'Contents')}</summary>
<nav>${tocItems.map(it => `<a class="toc-lv${it.lv}" href="#${it.id}">${escapeHtml(it.text || '…')}</a>`).join('')}</nav>
</details>`
    : ''
  const body = `<main>
<h1>${escapeHtml(post.title)}</h1>
<div class="meta-row">
<address>${authorLine}</address>
<div class="meta-actions">
${editLink}
</div>
</div>
${expiry}
${toc}
<div class="content">${contentHtml}</div>
<div class="report-row">
${reportLink}
</div>
</main>
<script>${READER_ENHANCE_JS}</script>`
  return pageShell(post.title || 'Untitled', body, { head })
}

/** 查看密码中间页（表单 POST 回本页，无需 JS）；errorKey 固定为 'pwWrong'，双语文案 */
export function passwordPage(id, errorKey = '') {
  const zh = TEXT.zh, en = TEXT.en
  const err = errorKey
    ? `<p class="err">${dual(zh[errorKey] ?? '', en[errorKey] ?? '')}</p>`
    : ''
  const body = `<main>
<div class="pw-card">
<h1>${dual(zh.protectedTitle, en.protectedTitle)}</h1>
<p>${dual(zh.protectedDesc, en.protectedDesc)}</p>
${err}
<form method="post" action="/${escapeHtml(id)}">
<input type="password" name="pw" data-ph-zh="${escapeHtml(zh.pwPlaceholder)}" data-ph-en="${escapeHtml(en.pwPlaceholder)}" autofocus required>
<button type="submit">${dual(zh.read, en.read)}</button>
</form>
</div>
</main>`
  return pageShell(zh.pwPageTitle, body, {
    head: '<meta name="robots" content="noindex, nofollow">',
  })
}

export function notFoundPage() {
  const zh = TEXT.zh, en = TEXT.en
  const body = `<main>
<div class="pw-card">
<h1>404</h1>
<p class="muted" style="font-size:14px">${dual(zh.notFoundDesc, en.notFoundDesc)}</p>
<a class="home-link" href="/">← ${dual(zh.backHome, en.backHome)}</a>
</div>
</main>`
  return pageShell('404', body)
}

// ---------- 静态文档页（关于 / 服务条款 / 隐私政策） ----------
const DOCS = {
  zh: {
    updated: '更新于 2026-09-05',
    backHome: '← 返回首页',
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
      ],
    },
  },
  en: {
    updated: 'Updated 2026-09-05',
    backHome: '← Back to home',
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
      ],
    },
  },
}

const docSections = doc =>
  doc.sections.map(([h, ps]) => `<h2>${escapeHtml(h)}</h2>\n${ps.map(p => `<p>${escapeHtml(p)}</p>`).join('\n')}`).join('\n')

function docPage(key) {
  const zh = DOCS.zh[key], en = DOCS.en[key]
  const body = `<main>
<h1>${dual(zh.title, en.title)}</h1>
<div class="meta-row">
<address>Opus · opus.cc</address>
<a class="home-link" href="/">← ${dual(TEXT.zh.backHome, TEXT.en.backHome)}</a>
</div>
<p class="expiry">${dual(DOCS.zh.updated, DOCS.en.updated)}</p>
<div class="t-zh">${docSections(zh)}</div>
<div class="t-en" hidden>${docSections(en)}</div>
<p class="contact">📮 <a href="mailto:hello@opus.cc">hello@opus.cc</a></p>
</main>`
  return pageShell(zh.title, body)
}

export function aboutPage() {
  return docPage('about')
}

export function termsPage() {
  return docPage('terms')
}

export function privacyPage() {
  return docPage('privacy')
}
