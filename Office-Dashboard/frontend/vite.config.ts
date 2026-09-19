import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api/v1'),
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Strip ALL headers that can cause 431
            proxyReq.removeHeader('cookie');
            proxyReq.removeHeader('referer');
            proxyReq.removeHeader('origin');
            proxyReq.setHeader('x-forwarded-for', '127.0.0.1');
          });
        },
      },
    },
  },
});
