import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Mọi yêu cầu bắt đầu bằng /api được chuyển sang backend (cổng 5000),
    // nhờ vậy frontend gọi "/api/..." mà không cần ghi đầy đủ địa chỉ backend.
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000', // file giấy tờ thiết bị đã tải lên
    },
  },
})
