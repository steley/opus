/**
 * sanitize-html 净化白名单回归测试。
 * 作用：把“恶意输入 → 净化输出”的关键路径锁下来，一旦未来白名单或 transform
 * 被改宽（XSS 风险），此测试会先红，防止 regressions 悄然上线。
 * 运行：npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizePostHtml } from './sanitize.js'

test('脚本标签被剥离（不留可执行内容）', () => {
  const out = sanitizePostHtml('<p>hi</p><script>alert(1)</script><p>x</p>')
  assert.ok(!/script/i.test(out), 'out should not contain script tag: ' + out)
})

test('img onerror 事件属性被去掉', () => {
  const out = sanitizePostHtml('<img src="https://i.imgur.com/a.png" onerror="alert(1)">')
  assert.ok(!/onerror/i.test(out), 'onerror must be stripped: ' + out)
})

test('非白名单图片域名被整体移除（降级为空 span）', () => {
  const out = sanitizePostHtml('<p>a</p><img src="https://evil.example/x.png"><p>b</p>')
  assert.ok(!/evil\.example/.test(out), 'foreign host removed: ' + out)
})

test('javascript: 链接方案被拒绝（href 被剥落）', () => {
  const out = sanitizePostHtml('<a href="javascript:alert(1)">x</a>')
  assert.ok(!/javascript:/.test(out) && !/href=/.test(out), out)
})

test('javascript: 图片地址被移除', () => {
  const out = sanitizePostHtml('<img src="javascript:alert(1)">')
  assert.ok(!/javascript:/.test(out), out)
})

test('白名单 iframe 域名被保留', () => {
  const out = sanitizePostHtml('<iframe src="https://www.youtube.com/embed/abc123"></iframe>')
  assert.ok(out.includes('https://www.youtube.com/embed/abc123'), out)
})

test('非白名单 iframe 域名 src 被清空', () => {
  const out = sanitizePostHtml('<iframe src="https://evil.example/x"></iframe>')
  assert.ok(!/evil\.example/.test(out), out)
})

test('内联样式仅放行 hex 颜色（javascript:url 被去掉）', () => {
  const out = sanitizePostHtml('<span style="background:url(javascript:alert(1));color:#ff0000">t</span>')
  assert.ok(!/javascript:/.test(out), out)
  assert.ok(out.includes('color:#ff0000'), out)
})

test('合法 hex 内联颜色保留', () => {
  const out = sanitizePostHtml('<span style="color:#ff0000;background-color:#00ff00">t</span>')
  assert.ok(out.includes('color:#ff0000') && out.includes('background-color:#00ff00'), out)
})

test('svg 标签及嵌套脚本整体剥离（防 data:image/svg+xml XSS）', () => {
  const out = sanitizePostHtml('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
  assert.equal(out, '')
  const out2 = sanitizePostHtml('<p>t</p><svg viewBox="0 0 64 64"><rect width="64"/></svg><p>u</p>')
  assert.ok(!/<svg/i.test(out2) && /<p>t<\/p>/.test(out2), out2)
})

test('math 标签及嵌套 HTML 脚本整体剥离', () => {
  const out = sanitizePostHtml('<math><annotation-xml encoding="text/html"><script>alert(1)</script></annotation-xml></math>')
  assert.equal(out, '')
})

test('data:image 内嵌图被移除（降级为空 span）', () => {
  const out = sanitizePostHtml('<p>x</p><img src="data:image/png;base64,AAAA"><p>y</p>')
  assert.ok(!/data:/.test(out) && /<span><\/span>/.test(out), out)
})

test('样式里的 data:url 被去掉', () => {
  const out = sanitizePostHtml('<span style="background:url(data:image/svg+xml;base64,AAAA)">t</span>')
  assert.ok(!/data:/.test(out) && out.includes('>t</span>'), out)
})
