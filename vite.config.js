import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const googleMapsKey = (
    env.VITE_GOOGLE_MAPS_API_KEY ||
    env.GOOGLE_MAPS_API_KEY ||
    env.VITE_GOOGLE_MAP_API_KEY ||
    env.GOOGLE_MAP_API_KEY ||
    env.VITE_MAPS_API_KEY ||
    env.MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAP_API_KEY ||
    process.env.GOOGLE_MAP_API_KEY ||
    process.env.VITE_MAPS_API_KEY ||
    process.env.MAPS_API_KEY ||
    ''
  ).trim();

  return {
    plugins: [react()],
    define: {
      '__GOOGLE_MAPS_API_KEY__': JSON.stringify(googleMapsKey),
    },
    envPrefix: ['VITE_', 'GOOGLE_'],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      host: true,
      allowedHosts: ['smartcivicportal', 'localhost'],
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-ui': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-popover',
              '@radix-ui/react-select',
              '@radix-ui/react-tabs',
              '@radix-ui/react-tooltip',
              'lucide-react',
            ],
            'vendor-charts': ['recharts'],
            'vendor-pdf': ['jspdf', 'html2canvas'],
          },
        },
      },
    },
  };
});
