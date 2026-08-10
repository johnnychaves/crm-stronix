import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// A Vercel já sabe se o deploy é produção ou preview, então o ambiente do
// Sentry sai daí por padrão. VITE_SENTRY_ENVIRONMENT continua valendo como
// sobrescrita manual, para build fora da Vercel.
const SENTRY_ENV =
  process.env.VITE_SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || 'development'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Só entra quando o token existe. Em build local e em fork sem segredo,
    // o plugin nem carrega e o build segue normal.
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          // Sobe o mapa e apaga do dist. Sem isso o código-fonte fica
          // público em produção.
          sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
        })]
      : []),
  ],
  define: {
    // Identifica qual deploy gerou o erro.
    'import.meta.env.VITE_APP_RELEASE': JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_SHA || 'dev'
    ),
    'import.meta.env.VITE_SENTRY_ENVIRONMENT': JSON.stringify(SENTRY_ENV),
  },
  resolve: {
    // Alias padrão shadcn (@/ → src/) — usado pelos componentes do registry
    // e pelo components.json. Imports relativos existentes seguem valendo.
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    // Mapa de código só é gerado quando o plugin do Sentry vai rodar, ou seja,
    // quando há token. Sem token não adianta gerar: ninguém sobe e o arquivo
    // só ocuparia espaço no deploy. 'hidden' gera sem deixar o comentário
    // sourceMappingURL no bundle, já que o Sentry usa o mapa que recebeu no
    // build e o navegador não precisa ir atrás. O script de build ainda apaga
    // dist/assets/*.map no fim, como segunda trava.
    //
    // ATENÇÃO ao testar se um mapa está publicado: o vercel.json manda tudo
    // que não é /api/ para o index.html, então requisição a arquivo inexistente
    // responde 200 com HTML, nunca 404. Conferir o CONTEÚDO, não o status.
    sourcemap: process.env.SENTRY_AUTH_TOKEN ? 'hidden' : false,
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
