/**
 * Cloudflare Workers 入口：D1 数据库 + Workers Static Assets 托管前端。
 * 部署：npm run build && npx wrangler d1 execute opus --remote --file schema.sql && npx wrangler deploy
 * 可选密钥（发布人机验证）：npx wrangler secret put TURNSTILE_SECRET_KEY
 * 可选站点键：wrangler.toml [vars] TURNSTILE_SITE_KEY = "0x..."
 */
import { createApp, purgeExpiredPosts } from '../server/routes.js'
import { createD1Db } from '../server/db.js'

export default {
  // Cron 触发：物理删除已过期文章（wrangler.toml [triggers] 每日执行）
  async scheduled(event, env, ctx) {
    ctx.waitUntil(purgeExpiredPosts(createD1Db(env.DB)))
  },

  async fetch(request, env, ctx) {
    const app = createApp(createD1Db(env.DB), app => {
      // 编辑模式路由：返回前端壳并对爬虫声明 noindex
      app.get('/edit/:id', async c => {
        const res = await c.env.ASSETS.fetch(new URL('/index.html', c.req.url))
        const headers = new Headers(res.headers)
        headers.set('X-Robots-Tag', 'noindex')
        headers.set('Cache-Control', 'no-cache')
        return new Response(res.body, { status: res.status, headers })
      })
    }, env)

    return app.fetch(request, env, ctx)
  },
}
