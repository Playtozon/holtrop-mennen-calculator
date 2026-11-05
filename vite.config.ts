import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: { charts: ['recharts'], katex: ['katex'] },
      },
    },
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: 'node',
  },
} as never);
