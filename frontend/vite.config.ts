import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    // shell aplikasi (React, router, Radix, zod) ±160 KB gzip; halaman berat sudah dipisah per rute
    chunkSizeWarningLimit: 600,
  },
})
