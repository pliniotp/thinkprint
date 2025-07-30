import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration for the dashboard app.  Specifies the React
// plugin and default server port.  When deploying with Vercel the
// build output will be served statically.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
});