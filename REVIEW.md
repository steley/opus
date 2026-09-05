# Opus 项目审查报告（Cloudflare Workers 免费版部署视角）

> 审查范围：全仓代码审查（只读，未做任何修改）。
> 部署现实：本项目实际目标运行环境为 **Cloudflare Workers 免费版 + D1 + Workers Static Assets，自定义域名 opus.cc**，本报告以该环境为第一约束展开。

---

## 0. 结论摘要

项目整体结构清晰、分层合理（前后端同构路由、SQLite/D1 适配层、三层 HTML 净化、PBKDF2 口令保护），代码质量在同类规模项目中属中上。但从 **Workers 免费版配额/运行模型** 角度看，存在 **3 个必须处理的问题、数个需重点跟进的风险、若干优化点**。

| 严重级 | 问题 | 位置 |
|---|---|---|
| 🔴 严重 | `verifyTurnstile` 被调用但从未定义/导入 → 一旦配置 Turnstile 密钥发布必然 500 | `server/routes.js:90` |
| 🔴 严重 | Workers **免费版不支持 Scheduled/Cron 触发器** → 已配置 `crons` 每日清理失效 | `wrangler.toml:19`、`worker/index.js:12` |
| 🟠 高 | 内存 Map 限流在 Workers 多 isolate 模型下基本无效（README 自己注明"每 isolate 尽力而为"但生产无兜底） | `server/routes.js` rateLimit |
| 🟠 高 | PBKDF2 5000 迭代 + 多次 300ms `sleep` 接近/超过免费版 **10ms CPU 时间上限**风险 | `server/util.js`、`server/routes.js` |
| 🟡 中 | 阅后即焚"读出即删"+ 无关密码重放，破坏"首次成功阅读即焚"语义且可能被 DDoS 掉文章 | 多个 `/read` `/` 路由 |
| 🟡 中 | `X-Frame-Options: DENY` 与 og:image/share 目标潜在冲突 / 双安全头来源（HTML 由 worker 写头，静态由 `_headers` 写头）两套并存易漂移 | `routes.js` + `_headers` |
| 🔵 低 | `genId` 使用取模有微小偏差；`/p/:id` 兼容 POST 未限流；`about` 等静态文档由代码重复实现 | 多处 |

---

## 1. 🔴 严重问题

### 1.1 `verifyTurnstile` 未定义 —— 人机验证形同虚设且是隐性炸弹
- 证据：`server/routes.js:90` `await verifyTurnstile(env.TURNSTILE_SECRET_KEY, ...)` 被调用；全局 grep 仅在 `routes.js` 出现 1 次（调用点），**全仓没有任何 `function verifyTurnstile` 的定义或 import**。
- 影响：
  - **当前未配置 Turnstile 密钥** → `env.TURNSTILE_SECRET_KEY` 为空，if 分支不进入，正常可用；
  - **一旦按 README 执行 `wrangler secret put TURNSTILE_SECRET_KEY` 并配置站点钥**，任何 POST `/api/posts` 都会抛出 `ReferenceError: verifyTurnstile is not defined` → 被 `app.onError` 捕获 → 一律 500。**整个发布功能瘫掉。**
- 这意味着 README + 前端 PublishDialog（`onMounted` 拉 `/api/config`、加载 Turnstile SDK、`tsSiteKey` 联合校验才允许点确认）精心搭建的人机验证链路**从未能在服务端真正生效**。前端把 token 发来了，后端却判空就过（或直接炸）。
- **建议（仅描述，未修改）**：在 `util.js`（Node 与 Worker 共用，内有 `fetch` 全局）补一个 `verifyTurnstile(secret, token, ip)`：`POST https://challenges.cloudflare.com/turnstile/v0/siteverify`（`form`：`secret, response, remoteip`）返回 `{ success: true }`。注意 `wrangler secret` 中的换行导致 base64 密钥带 `\n` 也被 CF 官方接受即可。

> 重要：因为这是"部署约束 + 断连bug"叠加区，即便你暂时不用 Turnstile，也建议至少把 `verifyTurnstile` 定义补齐，否则功能不可达的信令问题是客观存在的。

### 1.2 Workers 免费版 Cron 触发器不支持 —— 每日过期清理实际不跑
- 证据：`wrangler.toml:19` `crons = ["17 3 * * *"]` + `worker/index.js:12` `async scheduled(...)`。
- 现实约束：**Cloudflare Workers Cron/Scheduled 触发器从免费档移除，需付费（Paid，$5/mo）计划才可用**（自 2023 起 cron 仅在 Workers Paid 提供；免费版无法在 Dashboard/Wrangler 为 workers.dev 分配计划明细，含自定义域）。
- 后果：本仓库真正的兜底物理清理只依赖两层：
  1. `scheduled` cron（免费版不触发 → 无效）；
  2. 惰性清理 `purgeIfExpired`：需**有人先访问该过期文章 URL** 才会物理删除。
- 也就是说：到期文章在 URL 不再被访问时**永不清理**，会无限堆积在 D1，直至撞上 D1 免费版**行数上限（500 万行）与写入配额**。对"落笔即发布"的匿名短链站，这是一条必然越积越高的路。
- **建议（仅描述）**：
  - 迁移到 Workers Paid 计划以启用 cron（最简单）；
  - 或改静态「准时任务」为**访问时概率性清理**——在每次读到的请求里，以低成本 `DELETE` 扫表（D1 免费版 SQL 写入计费，需谨慎控制频率/批次以免打爆当天 10 万次写入配额）；
  - 或部署外部定时 HTTP 健康探针站点（如 UptimeRobot / GitHub Actions cron）周期性 `GET /api/health`，同时由 Worker 在 health 分支内做清理；注意 health 路径是动态 worker 路由，可复用。

---

## 2. 🟠 高/中风险项

### 2.1 内存 Map 限流 —— 多 isolate 下无全局约束
- `rateLimit` 的 `hits` Map 是**每 isolate 内内存对象**。Workers 免费版请求会被分发到**成百上千个冷热 isolate**，每个 isolate 的 Map 独立且会在空闲后回收。
- 一个能拿到共享 IP 池的脚本绕开个别 isolate 后，Map 几乎形同虚设。README 亦自述"生产建议前置 CF Rate Limiting 规则"。
- 免费版建议：在 Cloudflare Dashboard 为 `opus.cc` 配 **WAF Rate Limiting rules**（针对 `/api/*` 写接口与 POST 表单；免费版自带一定额度）作为**真正的第一道阀**，代码内 Map 作为兜底即可。
- 特别地：`POST /api/posts/:id/read`、`PUT/DELETE /api/posts/:id`、`GET /:id`、密码 POST 都依赖这层限流来防暴力爆破/防 DDoS。缺全局限流时，暴力尝试查看/管理口令的代价被低估。

### 2.2 PBKDF2 5000 迭代 + 多次 300ms sleep vs 免费版 CPU 上限
- Workers 免费版单请求 **CPU 时间约 10ms**（超时即 503）。注释也写了"按 10ms 限制调优"，但实际上：
  - 每次口令校验做 1 次 PBKDF2-SHA256(5000 迭代)。**每次发布会做 2 次哈希**（view 密码 + manage 密码），每次校验做 1 次。5000 迭代 SHA-256 在 V8/Workers 上通常约数 ms，叠加后单请求多口令校验可能逼近甚至超出 10ms 余量（尤其 Cold start + 并发）。
  - 更重要的是：`verify` 前后再垫 `sleep(300)` **300ms 是真实墙钟等待**，虽然不计 CPU 时间，但挤占请求时长预算与免费版并发（免费版需在合理时间内返回）；攻击者可并发打满被迫限流的请求，让服务器持续处于"等待中"。
- **建议（仅描述）**：免费版更稳健方案是把口令做**单向强校验与限流分离**——校验本身可再降迭代到 ~2k-3k（仍远高于明文），或改用受 D1/CF Access 保护的 KV/内置 KV 存单次 brute 计数；把 300ms sleep 改为固定 30-50ms + WAF 暴力规则，兼顾体验与成本。

### 2.3 阅后即焚"读出即删"语义在新/旧路线有可被利用的空间，且有并发双读洞
- 多个路由在"取到文章后、返回内容前"就 `DELETE`：
  - `readSuccess`（`/api/posts/:id/read`、`/api/read` 公开读）→ 读到即焚；
  - `articleGet`/`burnAndServe`（HTML 阅读页）→ 读到即焚。
- 存在的偏差与洞：
  1. **公开无密码的 `GET /api/posts/:id`**：也调用 `readSuccess` → 也焚。这意味着任何人只要 curl API 一下链接就把文章删了（等同"阅读"）。若业务想要"只有 HTML 页被打开才算阅读"，这里是漏洞；若非则无歧义，只是 `burn_after_read` 名不副实。
  2. **并发双读**：文章带密码时，POST `/read` 先 `verifyPassword` 判成功再焚。两个不同"阅读者"**同时**都通过校验后都能拿到全文再各自焚——读到即焚的严格"首读即焚"在多请求并发下不成立（无原子 `UPDATE ... WHERE not burned` / RETURNING）。高价值"阅后即焚"内容存在并发泄露窗口。
  3. **删除后仍返回内容**：`burnAndServe` 先 `DELETE` 再 `c.html(articlePage(post,...))`，本地/缓存副本仍在当前响应共存——可接受但语义上是"先销毁后交付"。
- **建议（仅描述）**：若需"仅首次成功阅读即焚"，把焚改为 `UPDATE posts SET burned=1 WHERE id=? AND burned=0` 的原子 CAS（成功后只首读返回真），或加 `burned` 标记列；并决定 `GET /api/posts/:id` 是否应算"阅读"。

### 2.4 双安全头来源会漂移
- 服务端 HTML/API 响应：Hono 中间件在 `routes.js` 统一写 `X-Content-Type-Options / Referrer-Policy / X-Frame-Options`。
- 静态资源（Worker Static Assets 由 `_headers` 文件）也同样是这三条。
- 两处为**并列复制**同一组头，改动时易只改其一。建议收敛到单一来源（例如静态资源不写，统一由 worker 中间件覆盖；或反之），并补 `Cache-Control` 仅在 `/assets/*`。
- X-Frame-Options:DENY 会让文章无法被任何页面 iframe（包括分享卡片预览不涉及），这个是安全取向，合理；但若未来接 Office/Notion 预览采集就会有坑——届时建议改用 CSP `frame-ancestors`。

### 2.5 og:image 指向 `/og.png` 但受保护文章无图封面 —— 可接受但需知
- 受密码文章在 og:description/title 下也不该暴露正文，目前受密码的 HTML 页不输出正文（好），但 og meta 只在未受保护文章页输出。位于正常逻辑内。无重大风险，属观察项。

---

## 3. 🔵 低优先级 / 代码健壮性观察

### 3.1 `genId` 取模偏差（不影响可用性）
- `ID_ALPHABET[b % ID_ALPHABET.length]`：`b ∈ [0,255]`，字母表长度 56，256 不能被 56 整除 ⇒ 尾部字符（映射到余 0~39）偏多、前部（40~55）略少。8 位 ID 总量 ~2.1e13，偏差对撞车影响可忽略。属纯净随机合规性瑕疵，若要严格的 56 字母均匀可用 rejection sampling。非必要不修。

### 3.2 兼容性 POST `/p/:id` 未套 `rateLimit`
- `app.post('/p/:id', articlePwSubmit)` 和 `app.post('/:id', articlePwSubmit)` 中，后者未注册 `rateLimit`（读页 `GET /:id` 有限流，POST 却没有）。用作密码表单/旧链接入口，缺少与读 API 一致的最大速率保护。观察项。

### 3.3 文档静态页（about/terms/privacy）在 `routes.js`/`pages.js` 双份成本
- 内容嵌在 TS 对象里（含中英全文），改动即需重编译 + 重部署 Worker（动态）。由于这些页面本可就做成静态置于 `public/`（Worker Static Assets 已配 `dist`），现在却每次走 worker 计算。非缺陷，属结构选择。

### 3.4 `@api /api/config` 公开返回 `turnstileSiteKey`
- 这是 Turnstile 正确做法（sitekey 本就要暴露给浏览器），无泄露。配合 1.1 缺失的 `verifyTurnstile`，等于**只暴露了 sitekey 而秘钥校验从未工作**，攻击者在未补 1.1 前唯一瓶颈只有代码限流层。

### 3.5 数据模型与配额
- D1 免费版（500 万行 + 读/写配额）对短链博客足够，但综合 1.2 惰性清理问题，**无限膨胀的文章行会持续消耗存储 + 每次 `GET /api/posts`/`/:id` 都做一次读**。长期建议把过期即焚文章的清理成本前沿化（2.2/1.2 已述）。

---

## 4. Cloudflare Workers 免费版专项核对

| 能力 | 本项目使用情况 | 免费版可用性 | 结论 |
|---|---|---|---|
| Workers Static Assets | `dist/`，绑定 ASSETS；fallback `/edit/:id` 手动 fetch index.html | ✔ 可用 | ✅ |
| D1（单个绑定） | 单库 `opus` | ✔ 免费版 500 万行/天读等限制 | ✅ 需 1.2 清理 |
| Scheduled / Cron | `wrangler.toml [triggers]` | ✘ 免费版不支持 | 🔴 **已配置将无效** |
| 自定义域名 | `routes = [{ custom_domain = true }]` | ✔ 可用（不占 workers.dev 子域的 100 域） | ✅ |
| Turnstile siteverify | `verifyTurnstile()` | 免费 | 🔴 **函数缺失** |
| 100,000 req/day 限制 | 短链站通常 < 万级/日 | ✔ | ✅（被人扫/爬可能耗尽）|
| max 请求 CPU ~10ms | PBKDF2/300ms sleep | 边界 | 🟠 见 2.2 |
| 头部托管 + CSP | `_headers` + 中间件两套 | ✔ | 🟡 见 2.4 |

---

## 5. 建议处置优先级

**P0（阻断/功能性）**
1. 补齐 `verifyTurnstile` 定义（或明确暂时彻底移除 Turnstile 相关前端/后端逻辑，避免"看起来有用其实没用/一开启即崩"）。
2. 处理 cron 在免费版不可用：若不升付费，落地"访问时概率清理"或外部探针触发的惰性清理。

**P1（安全/成本）**
3. 补全局触发面的限流：接入 Cloudflare WAF/RL 规则作为第一道闸，代码 Map 仅兜底；给 `POST /:id`、`/p/:id` 也加限流。
4. 重新校准 PBKDF2 迭代，避免单请求在 10ms CPU 预算边缘；把 300ms sleep 下调并配合 WAF 暴力检测。

**P2（语义/健壮）**
5. 阅后即焚改为原子 CAS（先标记再返回），明确 `GET /api/posts/:id` 是否计入"阅读"。
6. 收敛安全头到单一来源，防止 `_headers` 与中间件漂移。

**P3（可选）**
7. `genId` 均匀性、`/p/:id` 兼容限流、文档页静态化——不作为发布阻塞项。

---

*本报告仅为代码审查产出，未对仓库做任何改动。*
