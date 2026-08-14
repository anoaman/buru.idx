import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { disclosureLocalApi } from './vite.disclosure-plugin.js';

export default defineConfig({
  plugins: [react(), disclosureLocalApi()],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    pool: 'forks',
    poolOptions: {
      forks: { minForks: 1, maxForks: 2 },
    },
  },
});
