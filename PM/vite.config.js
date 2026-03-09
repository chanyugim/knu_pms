import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 네트워크의 다른 기기(스마트폰 등)에서 접속을 허용합니다.
    port: 5173, // 기본 포트 명시 (선택사항)
  },
  build: {
    outDir: '../server/public',
    emptyOutDir: true,
  }
})
