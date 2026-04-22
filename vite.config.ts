import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@radix-ui/')) {
            return 'radix';
          }
          if (id.includes('/react-dom/') || id.includes('/react/')) {
            return 'react-vendor';
          }
          if (id.includes('/@tanstack/react-query/')) {
            return 'tanstack';
          }
          if (id.includes('/dayjs/')) {
            return 'dayjs';
          }
          if (
            id.includes('/zod/') ||
            id.includes('/react-hook-form/') ||
            id.includes('/@hookform/resolvers/')
          ) {
            return 'zod-forms';
          }
          return undefined;
        }
      }
    }
  },
  server: {
    port: 1420,
    strictPort: true,
    hmr: {
      port: 1421
    }
  }
});
