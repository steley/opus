/**
 * VPS / 自托管入口：Node + 内置 SQLite（node:sqlite）+ 静态托管 dist/。
 * 运行：npm run build && npm run start   （默认 http://localhost:8787）
 * 数据库文件路径用环境变量 WRITE_DB 指定，默认 ./opus.db
 */
import { readFileSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createApp } from './routes.js'
import { createSqliteDb } from './db-sqlite.js'

const dbPath = process.env.WRITE_DB || './opus.db'

const app = createApp(createSqliteDb(dbPath), app => {
  // 编辑模式路由：返回前端壳并对爬虫声明 noindex
  app.get('/edit/:id', c => {
    c.header('X-Robots-Tag', 'noindex')
    c.header('Cache-Control', 'no-cache')
    return c.html(readFileSync('./dist/index.html', 'utf-8'))
  })

  // 指纹静态资源长缓存
  app.use('/assets/*', async (c, next) => {
    await next()
    if (c.res.status === 200) c.header('Cache-Control', 'public, max-age=31536000, immutable')
  })

  // 前端静态资源（找不到文件会 next()，落到 API/阅读页路由）
  app.use('*', serveStatic({ root: './dist' }))
})

// 404 兜底必须最后注册（否则会抢占 /:id 等路由）
app.get('*', c => c.text('Not Found', 404))

const port = Number(process.env.PORT || 8787)
serve({ fetch: app.fetch, port }, info => {
  console.log(`✒️ Opus server running at http://localhost:${info.port}  (db: ${dbPath})`)
})
