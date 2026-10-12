import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 打包后资源用相对路径（dist/index.html 引用 ./assets/...，可放任意子目录/直接打开）
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1', port: 5176, strictPort: true,
    // Replacing large GLBs can briefly lock files on Windows; reload after export.
    watch: { ignored: ['**/public/models/**'] },
  },
  preview: { host: '127.0.0.1', port: 5177, strictPort: true },
})
