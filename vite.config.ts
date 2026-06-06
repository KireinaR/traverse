import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { createApp } from './src/server';

export default defineConfig({
  plugins: [
    react(),
    {
      // Mounts the Express API inside the Vite dev server — one process, one port.
      name: 'traverse-api',
      configureServer(server) {
        server.middlewares.use('/api', createApp());
      },
    },
  ],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
  },
});
