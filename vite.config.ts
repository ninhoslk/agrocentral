/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'AgroCentral',
        short_name: 'AgroCentral',
        description: 'Sua fazenda, seus dados, suas decisões.',
        lang: 'pt-BR',
        theme_color: '#14532d',
        background_color: '#f6f7f4',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Instalação leve: pré-cache só do núcleo; demais arquivos (mapas, gráficos, PDF/Excel) entram no cache quando usados
        globPatterns: ['index.html', 'assets/index-*.{js,css}', 'assets/react-*.js', 'assets/supabase-*.js', 'assets/rolldown-runtime-*.js', 'favicon.svg', 'icons/*.png'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Dados da API nunca são servidos do cache do service worker (evita exibir dado velho como atual)
        runtimeCaching: [
          { urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/assets/'), handler: 'CacheFirst', options: { cacheName: 'agro-assets', expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 60 } } },
          { urlPattern: ({ url }) => /tile\.openstreetmap\.org|arcgisonline\.com/.test(url.hostname), handler: 'CacheFirst', options: { cacheName: 'agro-tiles', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 14 }, cacheableResponse: { statuses: [0, 200] } } },
        ],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Só o núcleo vai em chunks fixos; mapas, gráficos e exportação ficam nas rotas que os usam (carga sob demanda)
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@supabase')) return 'supabase'
          if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) return 'react'
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
