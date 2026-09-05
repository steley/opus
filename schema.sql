-- Cloudflare D1 建表脚本
-- 本地：npx wrangler d1 execute opus --local --file schema.sql
-- 线上：npx wrangler d1 execute opus --remote --file schema.sql
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
-- 旧库迁移（列已存在时会报错，忽略即可）：
-- ALTER TABLE posts ADD COLUMN expires_at INTEGER;
