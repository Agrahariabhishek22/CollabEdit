import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  assetsInclude: ['**/*.wasm'], 
  publicDir: 'public',
  server: {
    host: true,
    watch: {
      usePolling: true,
      interval: 2000
    },
  },
})