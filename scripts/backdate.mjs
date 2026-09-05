// 测试辅助：把指定文章的 expires_at 改为过去时间（模拟已过期）
// 用法：node scripts/backdate.mjs <postId>
import { DatabaseSync } from 'node:sqlite'
const db = new DatabaseSync(process.env.WRITE_DB || './opus.db')
db.prepare('UPDATE posts SET expires_at = ? WHERE id = ?').run(1, process.argv[2])
console.log('backdated', process.argv[2])
