import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        host: true,
        port: 5173,
        proxy: {
            '/api': { target: 'http://localhost:3265', changeOrigin: true },
            '/uploads': { target: 'http://localhost:3265', changeOrigin: true },
        },
    },
    build: {
        target: 'es2020',
        sourcemap: false,
        chunkSizeWarningLimit: 700,
        rollupOptions: {
            output: {
                manualChunks: {
                    react: ['react', 'react-dom', 'react-router-dom'],
                    dates: ['date-fns'],
                },
            },
        },
    },
});
