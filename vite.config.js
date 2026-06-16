import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Alias padrão shadcn (@/ → src/) — usado pelos componentes do registry
    // e pelo components.json. Imports relativos existentes seguem valendo.
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    rollupOptions: {
      output: {
        // Separa as libs grandes em chunks próprios: melhora o cache (ao publicar
        // uma nova versão do app, o usuário só rebaixa o chunk do app, não o
        // firebase/react) e o download paralelo. Sem mudança de comportamento.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'firebase';
          if (id.includes('/lucide-react/')) return 'icons';
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'react';
          return 'vendor';
        },
      },
    },
  },
})
