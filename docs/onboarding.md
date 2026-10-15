# Primeiro dia

Do clone ao primeiro PR. O passo a passo de super-admin, academia e convites está no `README.md`.

## Pré-requisitos

- Node 22 ou superior (o CI usa 22; o desenvolvimento rodou em 24) e npm.
- Acesso ao repositório e ao projeto Firebase `crm-stronix` (para ler dado e publicar regra).
- Para rodar as funções de `api/` localmente: credenciais do Firebase Admin e a CLI da Vercel (`vercel dev`).

## Preparar

```bash
npm ci
cp .env.example .env.local   # opcional para o front, obrigatório para api/
npm run dev
```

O front funciona sem `.env.local`, porque cai no projeto `crm-stronix` (src/lib/firebase.js).

## Cuidado: o desenvolvimento aponta para produção

Sem variável de ambiente, `npm run dev` lê e escreve no Firebase de produção. A medição de leituras de agosto de 2026 achou uma sessão de desenvolvimento aberta assim entre as causas de um pico; o registro dessa medição não está neste repositório, mas o mecanismo está descrito em `docs/auditoria-leitura-2026-07-28.md` (seção 5.1). Regras:

- Teste escrita só em academia de teste, nunca em conta de cliente real.
- Feche as abas de desenvolvimento ao terminar. A leitura contínua custa cota.
- Prévia da Vercel também usa o Firebase de produção. Use conta de academia de teste.

## Worktree

O trabalho acontece em worktrees do Git (`.claude/worktrees/`). A `node_modules` de uma worktree nova pode estar atrás da `main`. Antes de medir qualquer coisa:

```bash
npm ci
git rev-list --count HEAD..origin/main   # deve ser 0
git status                                # lockfile não deve mudar
```

## Onde ler primeiro

1. `PRODUCT.md`, para saber o que o produto faz e o que não faz.
2. `AGENTS.md`, para comandos e acordos.
3. `docs/architecture.md`, para a estrutura e as fronteiras.
4. A seção do `CLAUDE.md` da área em que for mexer (Meta Diária, contratos, Stronizap, Professor, Rotinas, e assim por diante).
5. A spec da área em `docs/superpowers/specs/`.

## Fluxo de uma mudança

1. Branch a partir da `main` (`claude/<assunto>` ou `feat/<assunto>`).
2. Para feature ou comportamento novo, brainstorming e spec antes do código. Para mudança grande, plano em `docs/superpowers/plans/`.
3. Teste primeiro quando houver lógica. Veja `docs/quality.md`.
4. Rode a base inteira antes de abrir o PR.
5. Atualize o `CLAUDE.md` e os documentos que a mudança toca.
6. Abra o PR. O merge só acontece com aprovação do Johnny.
7. Se o PR mexe em `firestore.rules`, publique no console do Firebase antes do merge. Se mexe em `firestore.indexes.json`, publique por `firebase deploy --only firestore:indexes` ou pelo console (ver `docs/scale-migration.md`).

## Variáveis de ambiente

`.env.example` lista todas as chaves, sem valor, e é a lista completa. A tabela abaixo mostra os grupos principais.

| Grupo | Chaves | Observação |
|---|---|---|
| Firebase Web | `VITE_FIREBASE_*` | Públicas. Opcionais, há fallback |
| Firebase Admin | `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` | Secretas, só no backend. A chave privada mantém os `\n` escapados |
| Asaas | `ASAAS_API_KEY` e a base de URL | Sem a chave, a cobrança fica desligada |
| Asaas, webhook | `ASAAS_WEBHOOK_TOKEN` | Sem ele o webhook de cobrança não valida. `ASAAS_USER_AGENT` identifica as chamadas |
| Resend | `RESEND_API_KEY`, `MAIL_FROM` | A chave só existe em produção, e sem ela o "Esqueci a senha" responde 503. No Preview, sem a chave, o e-mail inteiro vai para o log da Vercel |
| Sentry | `SENTRY_DSN`, `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Os três últimos são do build |
| App Check | `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`, `VITE_APPCHECK_DEBUG_TOKEN` | Ver `docs/APPCHECK_SETUP.md` |

Valor real nunca entra no repositório.

## Ferramentas do agente

Ver a seção "Ferramentas" do `AGENTS.md` e o estado de cada peça em `docs/setup.md`.

## Se algo não funciona

| Sintoma | Primeira coisa a conferir |
|---|---|
| Teste ou build quebra em worktree nova | `npm ci` e a diferença para `origin/main` |
| Função de `api/` falha em produção | `vercel logs --environment production --since 1h --query <rota> --expand`, no checkout principal (procedimento do time, sem registro em outro documento deste repositório; confira as opções com `vercel logs --help`) |
| Tela branca depois de deploy | Aba aberta com a versão antiga. O app recarrega sozinho na volta da pausa. Confira também o papel de quem estava logado |
| Tela branca com texto em inglês | Página traduzida pelo Chrome (`font > font` nos cliques do Sentry) |
| Permissão negada ao gravar | `firestore.rules` publicado e o teste de regras correspondente |
