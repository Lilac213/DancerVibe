
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'GrooveGrid - 街舞课表管理',
        short_name: 'GrooveGrid',
        theme_color: '#6366f1',
        icons: [
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  define: {
    'process.env.NEWAPI_BASE_URL': JSON.stringify(process.env.NEWAPI_BASE_URL || 'https://docs.newapi.pro'),
    'process.env.NEWAPI_API_KEY': JSON.stringify(process.env.NEWAPI_API_KEY || '')
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
