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
        chunkSizeWarningLimit: 650
    },
    server: {
        port: 1420,
        strictPort: true,
        hmr: {
            port: 1421
        }
    }
});
