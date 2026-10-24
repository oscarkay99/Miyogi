import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Set VITE_BASE_PATH to /<repository>/ in the Pages build. Locally it stays at /.
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
