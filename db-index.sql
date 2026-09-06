-- D1 索引迁移（幂等，可重复执行）
-- 提升 expires_at 筛选、惰性过期判断与定时清理 purgeExpiredPosts 性能，
-- 避免帖子增多后退化为全表扫描。id 为主键已自动含索引，无需另建。
CREATE INDEX IF NOT EXISTS idx_posts_expires_at ON posts(expires_at);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
