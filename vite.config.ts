import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
        'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
        'process.env.VITE_APP_BASE_URL': JSON.stringify(env.VITE_APP_BASE_URL),
        'process.env.VITE_CLIENT_BASE_URL': JSON.stringify(env.VITE_CLIENT_BASE_URL),
        'process.env.VITE_CLIENT_PUBLIC_URL': JSON.stringify(env.VITE_CLIENT_PUBLIC_URL),
        'process.env.VITE_APP_MODE': JSON.stringify(env.VITE_APP_MODE)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
