-- D1 索引迁移（幂等，可重复执行）
-- 提升 expires_at 筛选、惰性过期判断与定时清理 purgeExpiredPosts 性能，
-- 避免帖子增多后退化为全表扫描。id 为主键已自动含索引，无需另建。
-- 注：曾建的 idx_posts_created_at 已移除（全库无 ORDER BY created_at，无读取收益，徒增写放大）。
-- 如需清理线上残留：npx wrangler d1 execute opus --remote --command "DROP INDEX IF EXISTS idx_posts_created_at"
CREATE INDEX IF NOT EXISTS idx_posts_expires_at ON posts(expires_at);
