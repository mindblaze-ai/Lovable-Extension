import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { readFileSync } from 'fs';

// Read manifest.json manually to avoid assert issues
const manifest = JSON.parse(readFileSync('./manifest.json', 'utf-8'));

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173
    },
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization'
    }
  },
  define: {
    __DEV__: true
  }
});
