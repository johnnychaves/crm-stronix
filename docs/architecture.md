# Arquitetura

Visão de conjunto. O detalhe de cada área, com as decisões e os porquês, está no `CLAUDE.md` e nas specs de `docs/superpowers/specs/`.

## Peças

| Peça | Onde | O que faz |
|---|---|---|
| App web | `src/` | React 19 + Vite. A casca é o `src/App.jsx`, e cada tela tem endereço próprio. |
| Funções serverless | `api/` | Vercel com Firebase Admin SDK. Todo arquivo que começa com `_` é módulo de apoio, não vira função. |
| Dados e login | Firebase | Firestore, Authentication e Storage (foto do cliente). Regras do Firestore em `firestore.rules`, índices em `firestore.indexes.json`. As regras do Storage não têm arquivo no repositório e vivem no console. |
| Scripts | `scripts/` | Utilitários de Admin rodados à mão: backfills, correção de dados e criação de super-admin. Cada um tem o próprio gatilho de gravação, descrito em `docs/quality.md`. |
| Erros | Sentry | `@sentry/react` no app e `@sentry/node` na `api/`, com limpeza de dado pessoal (`src/lib/sentryScrub.js`, `api/_sentry.js`). |

## Multi-tenant por claim

- Cada academia é um tenant com um identificador (`slug`). O isolamento é pelo claim `tenantId` do token, nunca pela URL.
- Os dados da academia ficam em `artifacts/{tenantId}/public/data/{coleção}`. As regras exigem `request.auth.token.tenantId == appId`.
- O super-admin tem o claim `superAdmin: true`. O Console dele não tem endereço e só aparece fora de uma academia.
- O papel de quem usa (gestor, consultor, professor) é decidido em um lugar só, `src/lib/acesso.js`. As regras do Firestore leem o mesmo papel do cadastro, com comparação exata. Testes que leem o texto das regras (`professorRules`, `rotinaRules` e `modules`) travam as listas de campos e de módulos. As regras não são executadas em teste.
- Módulos por academia (hoje só `faltosos`) moram em `tenants/{id}.modules` e passam por `src/lib/modules.js`.

## Telas e endereço

- Tabela de telas, leitura do endereço e decisão de rota em `src/lib/routes.js`. Filtros de tela em `src/lib/screenParams.js`.
- O endereço manda: a tela acesa, a ficha aberta e os filtros saem de `useLocation()`. Não existe `<Routes>` nem `setActiveTab`.
- Trocar filtro é `navigate(..., { replace: true, state })`. Abrir ficha é sempre um link.
- Spec em `docs/superpowers/specs/2026-09-21-endereco-por-tela-design.md`.

## Camadas do código

```
src/
  App.jsx           casca: login, menu, decisão de rota, assinaturas de dados
  views/            uma tela por arquivo (Meta diária, Kanban, ficha, Configurações...)
  components/       peças de tela, com ui/ para os componentes shadcn
  modals/           janelas de ação (matrícula, contrato, novo lead...)
  hooks/            leituras do Firestore e estado de tela
  contexts/         contexto da ficha e outros
  lib/              regras puras e gravações; é aqui que mora a regra de negócio
  lib/crm, lib/gerencial, lib/operacional   contas dos três dashboards, puras e testadas
api/                funções e módulos de apoio
```

Regra de negócio fica em `src/lib/`, em módulos em geral puros (`dailyGoal.js` é a exceção, porque importa `lucide-react`), e as telas só chamam. Exemplos: `dailyGoal.js` (Meta Diária), `contracts.js` e `contractHistory.js` (contratos), `leads.js` e `leadDerived.js` (lead).

## Fronteiras que não se cruzam

- `api/` só importa de `src/lib/` arquivos puros e sem pacote. `dailyGoal.js` importa `lucide-react` e quebra a função, então nenhum arquivo de `api/` o importa. Testes de importação travam isso por arquivo (`acessoImports`, `rotinasImports`, `newLeadImports`, `teamRolesImports` e `guardianImports`): o que a `api/` lê desses módulos não importa pacote.
- Quem grava `role` e `professorId` de `stronix_users`, e quem cria ou apaga cadastro de equipe, é só o servidor: `api/admin-users.js` (`create`, `set-role` e `delete`), `api/invite-accept.js` e `api/provision-tenant.js`. O navegador não faz isso.
- Dado pessoal não entra em URL, título de aba, query nem evento do Sentry.
- No servidor, `snap.exists` é propriedade. No navegador, é função.

## A `api/`

Onze funções, de um limite de doze no plano Hobby: `admin-users`, `asaas`, `impersonate`, `invite-accept`, `invite-create`, `plans`, `provision-tenant`, `super-overview`, `tenant-resolve`, `tenant-status` e `zap`. Ação nova entra numa função existente, como o `password-reset-*` entrou no `tenant-resolve` e o cadastro e o agendamento do Stronizap entraram no `zap`. `tenant-resolve` e `zap` têm `maxDuration` de 30 s no `vercel.json`.

## Integrações

| Integração | Como | Detalhe |
|---|---|---|
| Stronizap | `api/zap.js`, autenticado por chave da academia | `CLAUDE.md`, seção "Ponte com o Stronizap". O contrato são os arquivos `api/_zap*.js`. |
| Asaas | `api/asaas.js` | Cobrança das academias. Desligada sem `ASAAS_API_KEY`. Ver `docs/ASAAS_SETUP.md`. |
| Resend | `api/_mail.js` | E-mail do "Esqueci a senha", de `nao-responda@stronilead.com.br`. |
| App Check | `src/lib/appCheck.js` | Ver `docs/APPCHECK_SETUP.md`. |
| Sentry | `@sentry/*` | `npm run verificar:sentry` confere, no Sentry da `api/` e no formato do `api/zap.js`, que a chave do Zap, a chave do Resend e o telefone não saem. |

## Deploy e publicação

- A Vercel publica o app e as funções no merge na `main`.
- As `firestore.rules` são publicadas à mão, pelo console do Firebase, e não pela CLI (regra do `README.md` e do `CLAUDE.md`). Os índices saem por `firebase deploy --only firestore:indexes` ou pelo console. Em qualquer caso, antes do merge de quem depende deles.
- Versão nova do app entra sozinha na volta da pausa por inatividade (`src/lib/appUpdate.js`), lendo o `version.json` do build.

## Onde achar a decisão

| Assunto | Onde |
|---|---|
| Endereço por tela e filtros | `docs/superpowers/specs/2026-09-21-endereco-por-tela-design.md` |
| Professor e faltosos | `docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md` |
| Rotinas dos consultores | `docs/superpowers/specs/2026-10-06-rotinas-dos-consultores-design.md` |
| Agendamento pelo Stronizap | `docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md` |
| Dashboards CRM e Gerencial | `docs/superpowers/specs/2026-09-14-dashboard-crm-design.md` e `docs/superpowers/specs/2026-09-17-dashboard-gerencial-design.md` |
| Escala (leads por `lifecycleBucket`) | `docs/scale-migration.md` |
| Indicações | `docs/indicacoes.md` |
