
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Safely inject specific environment variables as strings
    // Fallback to empty string to prevent JSON.stringify(undefined)
    'process.env.NEWAPI_BASE_URL': JSON.stringify(process.env.NEWAPI_BASE_URL || 'https://docs.newapi.pro'),
    'process.env.NEWAPI_API_KEY': JSON.stringify(process.env.NEWAPI_API_KEY || '')
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
