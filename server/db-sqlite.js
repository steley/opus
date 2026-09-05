/**
 * SQLite 适配器（仅 VPS/Node 使用，node:sqlite 为 Node 内置模块）。
 * Cloudflare Workers 入口请使用 db.js 中的 createD1Db，避免打包 node:sqlite。
 */
import { DatabaseSync } from 'node:sqlite'

export function createSqliteDb(path) {
  const db = new DatabaseSync(path)
  db.exec(SCHEMA_SQL)
  migrate(db)
  return {
    kind: 'sqlite',
    async run(sql, ...params) {
      db.prepare(sql).run(...params)
    },
    async get(sql, ...params) {
      return db.prepare(sql).get(...params) ?? null
    },
    async all(sql, ...params) {
      return db.prepare(sql).all(...params)
    },
  }
}

/** 旧库补列（幂等） */
function migrate(db) {
  const cols = db.prepare('PRAGMA table_info(posts)').all().map(c => c.name)
  if (!cols.includes('expires_at')) {
    db.exec('ALTER TABLE posts ADD COLUMN expires_at INTEGER')
  }
}

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  html TEXT NOT NULL,
  json TEXT NOT NULL DEFAULT '[]',
  burn_after_read INTEGER NOT NULL DEFAULT 0,
  view_pw TEXT,
  edit_pw TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);
`
