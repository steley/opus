# Opus — 落笔即发布

> Write. Publish. Done. — opus.cc

一个 telegra.ph 风格的轻量写作/发布工具：自研 UI 的富文本编辑器 + 匿名发布后端 + 密码保护 + 阅后即焚。**同一套代码，支持 VPS（Node + SQLite）与 Cloudflare Workers（D1）两种部署。**

Slogan：**落笔，即发布。** / *Write. Publish. Done.*（opus.cc）

前端：Vue 3 + Vite + TipTap 3（headless 引擎，UI 全自研，零外部字体/图标库）。

后端：Hono（同构框架，Node 与 Workers 共用同一套路由），数据库适配层同时支持 SQLite 与 D1。

## 功能

### 编辑器
- 正文小节 H2/H3（H1 保留给页面标题，阅读页模板渲染）、粗/斜/下划线/删除线
- 文字颜色 + 背景色（色板 + hex）、有序/无序/checklist、引用、代码块
- URL 图片 / URL 视频（mp4 直链 → `<video>`；YouTube/B 站链接 → sandbox 受限的 embed），**三层白名单**（见下）
- 标题/作者栏回车依次跳转；页面不满一屏时 footer 贴底（非 fixed）
- 双主题：日间「暖纸色」、夜间「柔和暖灰」，系统黑体栈，零外部资源
- 右下角悬浮：夜间切换 / 中英文切换 / 返回顶部

### 发布
- 「发布」→ 确认框（三组、组分隔线）：
  - **阅后即焚**（可选）；
  - **有效期**（默认 30 天，可选 1 小时/12 小时/24 小时/1 天/15 天/30 天/90 天/180 天/365 天，到期自动删除并在阅读页提醒）；
  - **查看密码**（可选 ≥4 位）；
  - **管理密码**（必填 ≥8 位，两次确认；拥有编辑+删除权限）；
- 确认后生成文章短链（`/{8位ID}`，如 `opus.cc/5KHz3FbA`）并自动复制到剪贴板
- 阅后即焚：文章被首次成功阅读后从数据库销毁，链接即刻失效
- 有效期：惰性过期删除——过期后首次被访问时物理删除并 404（无需定时任务，两种运行时通用）
- 查看密码：阅读页出现密码表单（无 JS 流程），错误密码 401 + 延迟响应防爆破
- 管理密码：编辑与删除的唯一凭证，PBKDF2-SHA256 加盐哈希存储

### 编辑与删除
- 阅读页右上角「✎ 编辑」→ 输入管理密码 → 进入编辑模式（`/edit/{id}`）：文章载入编辑器，顶栏「发布」位置变为「删除」「更新」两个按钮
- 「更新」保存修改到服务端（服务端净化后入库）；「删除」弹出确认框后物理删除并回到首页

## 快速开始（本地开发）

前置要求：**Node.js ≥ 22.13**（建议 24.x，后端使用内置 `node:sqlite`）

```bash
npm install
npm run build          # 前端产物 dist/（后端托管它）
npm run dev:server     # 后端 + 静态托管：http://localhost:8787（--watch 自动重启）
npm run dev            # 前端热更新：http://localhost:5173（/api 代理到 8787）
```

## 部署 A：VPS（Node + SQLite）

### 1. 准备服务器

```bash
# 以 Ubuntu/Debian 为例：安装 Node 24
curl -fsSL https://deb.nodesource.com/install_24.x | bash -
apt-get install -y nodejs
```

### 2. 获取代码并构建

```bash
git clone https://github.com/<你的用户名>/opus.git && cd opus
# 或者不上传 git，直接本地 rsync：
# rsync -av --exclude node_modules --exclude dist --exclude opus.db ./ user@vps:/opt/opus/
npm ci
npm run build
```

### 3. systemd 常驻

```ini
# /etc/systemd/system/opus.service
[Unit]
Description=Opus publishing platform
After=network.target

[Service]
WorkingDirectory=/opt/opus
ExecStart=/usr/bin/node server/index.js
Environment=PORT=8787
Environment=WRITE_DB=/opt/opus/opus.db
Restart=on-failure
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
chown -R www-data /opt/opus
systemctl enable --now opus
```

### 4. 域名解析 + 反向代理（HTTPS）

DNS：`A 记录 opus.cc → VPS IP`。

**Caddy（推荐，自动 HTTPS）**——`/etc/caddy/Caddyfile`：

```
opus.cc {
    reverse_proxy 127.0.0.1:8787
}
```

**Nginx + certbot**：

```nginx
server {
    server_name opus.cc;
    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
}
```

> **要点**：反代必须转发 `X-Forwarded-Proto` / `X-Forwarded-Host` 头，文章短链才会按真实域名（而不是 127.0.0.1:8787）生成。

## 部署 B：Cloudflare Workers（D1）

前置：域名 DNS 已托管在 Cloudflare（在 CF 控制台 Add site）。

```bash
npm install -g wrangler
npx wrangler login

# 1. 创建 D1 数据库，把返回的 database_id 填入 wrangler.toml
npx wrangler d1 create opus

# 2. 初始化表结构（首次）
npx wrangler d1 execute opus --remote --file schema.sql

# 3. 构建并部署（前端静态资源 + API 同一个 Worker）
npm run build
npm run deploy
```

绑定自有域名：在 `wrangler.toml` 追加，然后重新 `npm run deploy`：

```toml
routes = [
  { pattern = "opus.cc", custom_domain = true }
]
```
（或在 Dashboard：Workers & Pages → opus → Settings → Domains & Routes）

本地调试 Worker 路径：`npx wrangler dev`（本地模拟 D1）。注意：本地 `opus.db` 与 D1 **不互通**，D1 是全新数据库。

## 上传到 GitHub

```bash
gh repo create opus --public --source=. --push    # 需要 gh CLI
# 或手动：git init && git add . && git commit -m "Opus" && git remote add origin <url> && git push -u origin main
```

`node_modules/`、`dist/`、`opus.db` 已被 .gitignore 排除，克隆者拿到纯源码，按上面「部署 A / B」自行构建部署（README 即文档）。

可选：GitHub Actions 自动部署到 Workers——仓库 Settings → Secrets 添加 `CLOUDFLARE_API_TOKEN`（权限含 Workers 与 D1 编辑），新建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: npm ci
      - run: npm run build
      - run: npx wrangler d1 execute opus --remote --file schema.sql
      - run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/posts` | 发布：`{ title, author, html, json, burnAfterRead, expiry('1h'|'12h'|'24h'|'1d'|'15d'|'30d'|'90d'|'180d'|'365d'，默认 '30d'), viewPassword?, managePassword }` → `{ id, url, expiresAt }` |
| GET | `/api/posts/:id` | 公开读取（有查看密码时 401） |
| POST | `/api/posts/:id/read` | `{ viewPassword }` 带密码读取；**阅后即焚/已过期在成功访问时物理删除** |
| POST | `/api/posts/:id/edit-read` | `{ managePassword }` 编辑器读取（不触发焚毁） |
| PUT | `/api/posts/:id` | `{ managePassword, title?, author?, html?, json? }` 编辑 |
| DELETE | `/api/posts/:id` | `{ managePassword }` 删除 |
| GET | `/p/:id` | **已废弃**：301 重定向到 `/:id` |
| GET | `/:id` | 阅读页（HTML；受保护时返回密码表单；显示有效期提醒与编辑入口） |
| POST | `/:id` | 查看密码表单提交（无 JS 流程，旧 `/p/:id` 表单同样兼容） |
| GET | `/edit/:id` | 编辑模式（前端应用，管理密码门） |

错误统一 `{ ok: false, error }`；发布与敏感读取有内存限流（Workers 上为每 isolate 尽力而为，生产建议前置 Cloudflare Rate Limiting 规则）。

## 安全模型（三层白名单）

1. **编辑器 schema**：未注册的标签/属性在解析层即被丢弃
2. **粘贴过滤**：粘贴/拖拽 HTML 中不在白名单的媒体直接剔除（前端体验层）
3. **服务端净化（真正安全边界）**：`server/sanitize.js` 用 sanitize-html 在入库前最终过滤——标签白名单、iframe 仅白名单嵌入域名、style 仅 hex 颜色、scheme 仅 https、复选框强制禁用。**匿名发布接口可被绕过前端直接调用，这一层不可省略**

密码存储：PBKDF2-SHA256（5000 迭代 + 随机盐，迭代数按 Workers 免费版 10ms CPU 限制调优），校验用常量时间比较；错误密码响应延迟 300ms。

## 目录结构

```
├── src/                    # 前端
│   ├── App.vue             # 编辑器初始化、发布流程、toast
│   ├── styles.css          # 明暗双主题 + 全部样式
│   ├── i18n.js / theme.js  # 中英文案 / 夜间模式（localStorage 记忆）
│   ├── api.js              # 后端 API 封装 + 剪贴板
│   ├── config/whitelist.js # 媒体 URL 白名单（前端两层共用，第三层见 server/sanitize.js）
│   ├── editor/             # 视频节点、粘贴过滤
│   └── components/         # Toolbar / ColorMenu / MediaDialog / PublishDialog / FloatActions
├── server/                 # 后端（Node 与 Workers 共用）
│   ├── routes.js           # 全部 API + 阅读页（Hono 同构）
│   ├── db.js               # SQLite / D1 适配器
│   ├── sanitize.js         # 服务端 HTML 净化（安全边界）
│   ├── pages.js            # 阅读页 / 密码页 / 404 模板
│   ├── util.js             # 短 ID / PBKDF2 / 校验 / 转义
│   ├── db-sqlite.js        # SQLite 适配器（node:sqlite，仅 VPS 用）
│   └── index.js            # VPS 入口（静态托管 + 压缩 + 缓存头）
├── worker/index.js         # Cloudflare Workers 入口（D1 + Assets）
├── schema.sql              # D1 建表脚本
└── wrangler.toml           # Workers 部署配置
```
