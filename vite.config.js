import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: true,
    port: 5173,
    // 开发期把 /api 转发到本地后端（npm run dev:server）
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
