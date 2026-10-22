import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // Usaremos o nosso service-worker.js dedicado para Web Push
      manifest: {
        name: 'Tarefas Residenciais MVP',
        short_name: 'TarefasCasa',
        description: 'Gestão de tarefas residenciais partilhadas',
        theme_color: '#4f46e5',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})