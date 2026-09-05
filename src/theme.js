import { ref } from 'vue'

/** 夜间模式状态：localStorage 记忆，首次访问跟随系统偏好 */
const saved = localStorage.getItem('opus-theme') ?? localStorage.getItem('write-theme') /* 旧键迁移 */
const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
export const dark = ref(saved ? saved === 'dark' : !!prefersDark)

export function applyTheme() {
  document.documentElement.classList.toggle('dark', dark.value)
}

export function toggleDark() {
  dark.value = !dark.value
  localStorage.setItem('opus-theme', dark.value ? 'dark' : 'light')
  applyTheme()
}

applyTheme()
