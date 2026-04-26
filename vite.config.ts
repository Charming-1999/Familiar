import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function inNodeModules(id: string) {
  return id.includes('/node_modules/') || id.includes('\\node_modules\\')
}

function hasPkg(id: string, pkg: string) {
  return id.includes(`/node_modules/${pkg}/`) || id.includes(`\\node_modules\\${pkg}\\`)
}

function matchAny(id: string, pkgs: string[]) {
  return pkgs.some((pkg) => hasPkg(id, pkg))
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!inNodeModules(id)) return

          if (matchAny(id, ['@monaco-editor', 'monaco-editor'])) {
            return 'vendor-monaco'
          }

          if (matchAny(id, ['@supabase'])) {
            return 'vendor-supabase'
          }

          if (matchAny(id, ['react-router', 'react-router-dom'])) {
            return 'vendor-router'
          }

          if (matchAny(id, ['react', 'react-dom', 'scheduler'])) {
            return 'vendor-react'
          }
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
