import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        // strategy stays 'generateSW' (default) until real server push exists —
        // switch to 'injectManifest' then to add a push/notificationclick listener.
        devOptions: {enabled: true},
        includeAssets: ['favicon.ico', 'icon-source.svg', 'apple-touch-icon-180x180.png'],
        manifest: {
          name: 'Residencial Village Azaleia',
          short_name: 'Village Azaleia',
          description:
            'PWA e Sistema de Gestão Inteligente de Encomendas do Condomínio Residencial Village Azaleia — Portaria, Totem, Morador e Síndico.',
          theme_color: '#0D3823',
          background_color: '#F8F9FA',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          lang: 'pt-BR',
          icons: [
            {src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png'},
            {src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png'},
            {src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png'},
            {src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
          ],
        },
        workbox: {
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {cacheName: 'google-fonts-stylesheets'},
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: {maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365},
                cacheableResponse: {statuses: [0, 200]},
              },
            },
            {
              urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'sample-package-photos',
                expiration: {maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30},
                cacheableResponse: {statuses: [0, 200]},
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
