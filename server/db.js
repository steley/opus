/**
 * 数据库适配层：
 *  - createD1Db(d1)：Cloudflare Workers（D1 绑定），Worker 入口使用
 *  - createSqliteDb(path)：VPS/Node（node:sqlite），见 db-sqlite.js
 * 统一接口：run(sql, ...params) / get(sql, ...params) / all(sql, ...params)
 * D1 建表用 wrangler 执行 schema.sql；SQLite 启动时自动建表。
 */

export function createD1Db(d1) {
  return {
    kind: 'd1',
    async run(sql, ...params) {
      await d1.prepare(sql).bind(...params).run()
    },
    async get(sql, ...params) {
      return (await d1.prepare(sql).bind(...params).first()) ?? null
    },
    async all(sql, ...params) {
      const res = await d1.prepare(sql).bind(...params).all()
      return res.results ?? []
    },
  }
}
