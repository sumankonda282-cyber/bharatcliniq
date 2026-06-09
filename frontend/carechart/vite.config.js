import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        // Never cache index.html — always fetch fresh from network
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
      },
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'BHaratCliniq CareChart',
        short_name: 'BH CareChart',
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
