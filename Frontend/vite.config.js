import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss(),],
  server: {
    host: true, // Ye --host 0.0.0.0 wala kaam karta hai
    watch: {
      usePolling: true, // Ye line zaroori hai Docker ke liye
      interval:2000
    },
  },
})
