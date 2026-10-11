import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const keyPath = path.resolve(__dirname, 'certs/dev-key.pem')
const certPath = path.resolve(__dirname, 'certs/dev.pem')
const https =
  fs.existsSync(keyPath) && fs.existsSync(certPath)
    ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }
    : undefined

export default defineConfig({
  server: {
    host: true,
    https,
  },
  preview: {
    host: true,
    https,
    port: 5173,
    strictPort: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '型紙チェック',
        short_name: '型紙チェック',
        description: '裁縫本の型紙が生地に収まるか確認するアプリ',
        theme_color: '#7c3aed',
        background_color: '#fafafa',
        display: 'standalone',
        lang: 'ja',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],
})
