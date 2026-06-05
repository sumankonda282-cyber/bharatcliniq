import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'BHaratCliniq Ward',
        short_name: 'BH Ward',
        description: 'Ward nursing portal for BHaratCliniq',
        theme_color: '#065F46',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/android-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/android-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: { port: 5177 },
})
