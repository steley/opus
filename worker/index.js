/**
 * Cloudflare Workers 入口：D1 数据库 + Workers Static Assets 托管前端。
 * 部署：npm run build && npx wrangler d1 execute opus --remote --file schema.sql && npx wrangler deploy
 */
import { createApp } from '../server/routes.js'
import { createD1Db } from '../server/db.js'

export default {
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
    })

    return app.fetch(request, env, ctx)
  },
}
