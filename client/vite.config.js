import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Proxy /assets để client lấy watermark mặc định từ server
      '/assets': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})