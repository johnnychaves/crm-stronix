# Endereço por tela, PR 2 (endereços) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada tela do menu e cada ficha do Stronilead ganham endereço próprio (`/<academia>/pipeline`, `/<academia>/ficha/<id>`), com F5, voltar e avançar do navegador e Ctrl+clique no menu funcionando, sem abrir caminho novo para dado que a pessoa não via.

**Architecture:** O React Router 7 entra só para ler e trocar o endereço: `<BrowserRouter useTransitions={false}>` em `src/main.jsx` e nenhum `<Routes>`. Um módulo puro, `src/lib/routes.js`, guarda a tabela de telas, lê e monta endereços e decide a cada render se o endereço vale para a sessão (`routeDecision`). O `App.jsx` calcula `activeTab`, `profileLeadId` e `superTab` a partir do endereço e já desenha a tela de destino, enquanto o `RouteRedirect` troca o endereço com replace. A ficha vira uma rota própria (`LeadProfileRoute`, com estados puros em `src/lib/fichaState.js`), o Sentry passa a ver só o molde da tela, e o menu como link, o sair com recarga, a volta do "Acessar como" e o corte de leituras se apoiam nessas peças.

**Tech Stack:** React 19.2.4 + Vite 8 (JS/JSX, sem TypeScript), react-router 7.18.4 (novo, fixado em `~7.18.4`), Firebase JS 12.11, @sentry/react 10.69, Tailwind v4 + shadcn/ui, vitest 4 em node sem jsdom (`renderToString` sob `MemoryRouter`), eslint 9 com react-hooks v7.

**Spec:** [`docs/superpowers/specs/2026-09-21-endereco-por-tela-design.md`](../specs/2026-09-21-endereco-por-tela-design.md). Vale para este PR: "Endereços", "Decisões do Johnny", "Como funciona por dentro" (menos "Várias abas", que foi o PR 1), "Testes automáticos" e "Conferência manual no preview da Vercel", parte PR 2. O PR 1 (#216) e a configuração de funis por academia (#217) já estão na main.

**Branch:** `claude/rotas-pr2-enderecos`, criada da main `f509d9e`.

**Base conferida em 2026-09-22 (`f509d9e`):** `npx vitest run` → `Test Files  85 passed (85)` e `Tests  1824 passed (1824)`. `npm run lint` → `✖ 1 problem (0 errors, 1 warning)`, o aviso antigo de `src/views/superadmin/SuperAdminView.jsx:111` (`react-hooks/exhaustive-deps`, `useEffect` sem `loadPlans` e `loadTenants`).

**Como este plano foi conferido:** o código de todas as tarefas rodou, na ordem T1 a T13, numa cópia do repositório em `f509d9e` com o `react-router` 7.18.4 instalado. Cada trecho "Antes" apareceu uma vez só no arquivo, no estado deixado pelas tarefas anteriores, e cada arquivo novo é o bloco de código da tarefa. No fim: `Test Files  100 passed (100)`, `Tests  2070 passed (2070)`, lint com 0 erros e o mesmo aviso antigo, `npm run build` sem erro, CSS com `overscroll-behavior-x:contain` e `npm run verificar:sentry` verde. Depois dessa rodada, a revisão mudou o código em cinco pontos, que não passaram pela cópia: a Parte B da T13 saiu (12 testes a menos), a T5 ganhou um teste (doc ausente só no cache), o `screenKey` deixou a subaba do super-admin de fora (T4), a volta da visualização ficou presa à entrada do histórico em que foi pedida (T11) e a ficha passou a esperar os contratos (T10). Os números esperados abaixo já contam isso: o total passa a ser 100 arquivos e 2059 testes.

---

## Regras para todas as tarefas

- Sem jsdom. Todo teste roda em node, em `src/lib/__tests__/` ou `api/__tests__/`. Componente se testa com `renderToString` e `createElement` (sem JSX em `.test.js`), sob `MemoryRouter` quando usa o roteador.
- Zero `eslint-disable` novo. O lint é portão do CI e a config não pode ser rebaixada: `react-hooks/set-state-in-effect`, `refs`, `purity`, `static-components` e `react-refresh/only-export-components` são erro. Três `eslint-disable` antigos saem (T9 e T10).
- Nenhuma função nova em `api/`: a Vercel está em 11 de 12. Arquivo de teste em `api/__tests__/` não conta como função.
- Nenhuma regra nem índice novo do Firestore (eles são publicados à mão).
- Nunca rodar `npm run dev` apontado para a produção. A conferência na tela é no preview da Vercel, pelo checklist do PR (T14).
- No shell do Claude Code, `grep` é uma função do perfil que às vezes devolve vazio (sempre que o padrão tem `\|`). As buscas deste plano usam `git grep -E`, `/usr/bin/grep` ou `node -e`. Uma busca cujo resultado esperado é "nada" só vale com um desses.
- Todo replace de endereço passa pelo `navigate` do React Router. `history.replaceState` cru apaga o `idx` que o Voltar da ficha lê.
- Texto na tela e comentário: português direto, sem jargão na tela e sem travessão no meio da frase.
- Commits em português, no formato `tipo: descrição`, terminando com a linha `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Nada de merge: quem mergeia é o Johnny.
- As tarefas seguem a ordem T1 a T14 (a tabela "Tarefas e contagem de testes" diz de quais cada uma depende). Entre o commit da T9 e o da T10 a ficha não abre no app (ver T9): não suba preview no meio.
- Se a suíte da base der outro número (a main andou), anote a diferença e some a ela todos os números esperados abaixo.

## Decisões tomadas na montagem

Onde o contrato entre as partes do plano ou o texto do spec não batiam com o que o código precisa, valeu o que está aqui. A T14 põe o spec em dia com isso.

1. **Decisão de rota (T4).** A numeração aqui é a do `routeDecision` em `routes.js`, que conta a falta de sessão como regra 1 (no spec, que começa no super-admin puro, cada regra tem um número a menos). A trava contra laço vale a partir da regra 3, e não só na 5: sem isso, uma sessão assumida numa academia de id fora do formato entraria em laço de replace, porque o `RouteRedirect` remonta a cada `location.key`. A regra 5 já sai com as regras 6 e 7 aplicadas ao endereço corrigido: consultor em `/configuracoes` vai direto a `/<academia>` com o aviso, num redirect só, e um teste garante que o destino de todo redirect é aceito de primeira. A regra 4 (`returnTo`) só vale quando `fromTenant` é diferente da academia da sessão, limpa o caminho guardado para uma barra só (o `navigate` recusa `//host`) e só usa caminho que a decisão aceite. A correção de academia mantém os segmentos crus, para o id da ficha não mudar de codificação. Caminho sem academia que não é tela (`/assets`, `/api/x`) vai para `/<academia>` sem aviso.
2. **Leitura do endereço (T3).** Nos grupos (`visao-geral`, `leads`, `super-admin`), segmento a mais depois do filho é endereço desconhecido; só as telas-folha guardam `rest`. Na raiz, `rest` é `[]`. `hrefFor` também devolve `null` quando o `encodeURIComponent` não consegue codificar (metade de um emoji). `tenantSlugProblem` não normaliza, porque quem chama já passa o id em minúsculas; `isReservedTenantSlug` ignora caixa e espaço.
3. **Sentry (T6).** O `beforeStartSpan` usa `routeTemplate(options.name)`, e não `routeTemplate(window.location.pathname)`, como diziam o contrato e o spec. Conferido no `@sentry/browser` 10.69.0: na navegação o SDK chama o gancho antes do `pushState` e do `replaceState` de verdade (`@sentry/browser-utils/build/esm/instrument/history.js:35-37`) e passa o destino em `options.name` (`browserTracingIntegration.js:300`); no pageload, `options.name` é o próprio `window.location.pathname` (linha 278). Com `window.location`, toda navegação sairia com o molde da tela anterior. O teste da fiação cobre o caso da navegação. E, com o `browserTracingIntegration`, o replace do `RouteRedirect` também vira transação de navegação (o spec dizia que o Sentry ignorava replace).
4. **Voltar da ficha (T4, T9).** `backTarget({ historyState, isClient, tenantId })` devolve `{ type: 'back' }` ou `{ type: 'replace', href }` (o spec descrevia `{ historyIdx }` devolvendo `-1` ou o endereço). O Voltar e o fim da exclusão moram na `LeadProfileRoute`, e o `App.jsx` perde o `closeProfile` e a chamada do `useProfileLead`. No aviso "Essa ficha foi excluída" o hook devolve o último lead (`nextProfileSnap` guarda o lead em `deleted`), para o Voltar de uma ficha aberta direto saber se a pessoa era cliente. `FichaPanel` também é exportado, para testar o "Excluindo a ficha…".
5. **`src/lib/appShell.js` (T10, T11).** Módulo puro que o contrato não previa, com o que a casca do App tira do endereço e da sessão: `screenState`, `fichaOrigin`, `sessionKeyFor`, `loginTenantSlug`, `loginBrand`, `logoutDestination`, `returnToFrom`, `savedFunnelKey` e `readSavedFunnel`. `fichaOrigin` só aceita no `state.from` uma tela conhecida, diferente da ficha e que a sessão pode ver, porque o state mora no histórico do navegador e pode vir forjado.
6. **Título de `/<academia>` (T10).** Sai "Operacional · <Academia> · STRONILEAD", porque o App passa `resolvedTab` ao `documentTitle`. O título "Visão geral" de `SCREENS.dashboard` não aparece na aba.
7. **Links (T7, T12).** O `AppLink` só roda o `onNavigate` com `target` vazio ou `_self`, igual ao `Link` do React Router. O `LeadLink` usa `leadHref?.(leadId)`, para não quebrar entre a T7 e a T10. O teste do `SidebarItem` fica em `src/lib/__tests__/menuLinks.test.js` (o spec o punha no `appLink.test.js`), e o da decisão de rota em `routes.decision.test.js`, separado do `routes.test.js`, para nenhuma tarefa editar o arquivo de teste de outra.
8. **Gesto de voltar (T13).** O `FunnelTabs` não rola para o lado (o excedente vai para o menu "+N"), então o `overscroll-x-contain` vai nos dez roladores de verdade, e uma varredura no CI cobra a classe de todo `overflow-x-auto` que nascer depois.
9. **Custo (T13).** O pool de renovação e o contato de hoje continuam ligando com o `appUser`, como na main. O portão no config que o spec pede ficou para uma tarefa separada (ver o começo da T13), e a T14 tira essa promessa do spec.
10. **Saem três `eslint-disable`**, e não dois como dizia o spec: o do `useProfileLead` (T9), o do effect do `justCreatedLeadId` e o do effect que forçava a tela do super-admin (T10).
11. **Linhas citadas pelo spec.** O container que rola, que o spec cita em `App.jsx:1667`, está na linha 1632 da main (1673 depois da T10). Os trechos de `App.jsx` são localizados pelo código, nunca só pelo número.
12. **Depois da revisão (T4, T5, T10, T11).** A subaba do super-admin fica fora do `screenKey`: com ela na chave, cada clique em Visão Geral, Clientes, Financeiro ou Planos remontaria o `SuperAdminView`, que busca `/api/super-overview` e `/api/plans` ao montar. A volta da visualização (`returnTo`) vale só na entrada do histórico em que foi pedida (`location.key`). Doc ausente que só o cache respondeu vira o painel de erro, e não "Ficha não encontrada" (o spec aceitava esse risco). E a ficha espera também os contratos da academia, e não só o `loadingData`, que vira `false` com os leads ativos.

## Mapa de arquivos

| Arquivo | O que faz | Ação | Tarefa |
|---|---|---|---|
| `package.json`, `package-lock.json` | `react-router` fixado em `~7.18.4` | Modificar | T1 |
| `src/main.jsx` | `<BrowserRouter useTransitions={false}>` em volta do `<App/>` | Modificar | T1 |
| `src/lib/tenantSlug.js` | Formato do identificador da academia e palavras reservadas. Puro e sem import | Criar | T2 |
| `src/lib/__tests__/tenantSlug.test.js` | Formato, reservadas e a guarda de que toda tela está reservada | Criar (T2), Modificar (T3) | T2, T3 |
| `api/provision-tenant.js` | Recusa identificador reservado (é a autoridade) | Modificar | T2 |
| `api/tenant-resolve.js` | Palavra reservada responde `found: false` sem limitador e sem banco | Modificar | T2 |
| `api/__tests__/provisionTenant.test.js`, `api/__tests__/tenantResolve.test.js` | As duas rotas com banco falso | Criar | T2 |
| `src/views/console/SuperConsole.jsx` | Nova academia usa a regra do `tenantSlug.js` (T2); "Acessar como" grava `returnPath` (T11) | Modificar | T2, T11 |
| `scripts/register-tenant.js` | Recusa id fora do formato ou reservado | Modificar | T2 |
| `src/lib/routes.js` | Tabela de telas, leitura e montagem de endereço, decisão de rota, Voltar, título, molde do Sentry e rolagem. Puro | Criar (T3), Modificar (T4) | T3, T4 |
| `src/lib/__tests__/routes.test.js` | Tabela, leitura, montagem, ida e volta e o contrato do `idx` | Criar | T3 |
| `src/lib/__tests__/routes.decision.test.js` | Decisão de rota por papel, Voltar, chave, título, molde e rolagem | Criar | T4 |
| `src/lib/fichaState.js` | Estados puros da ficha (chave da assinatura, resposta, status, o que desenhar) | Criar | T5 |
| `src/lib/__tests__/fichaState.test.js` | Os estados da ficha | Criar | T5 |
| `src/lib/sentryScrub.js` | `url.path` e `lcp.url`, seletor do LCP e do CLS, `scrubLeadPath`, `scrubLeadPathsDeep` e `scrubSpan` | Modificar | T6 |
| `src/lib/sentry.js` | `beforeStartSpan` com o molde da tela e `beforeSendSpan: scrubSpan` | Modificar | T6 |
| `src/lib/__tests__/sentryScrub.test.js` | 25 casos novos | Modificar | T6 |
| `src/lib/__tests__/sentryInit.test.js` | Fiação dos ganchos do Sentry | Criar | T6 |
| `src/contexts/LeadProfileContext.jsx` | Valor `{ openProfile, leadHref, from }` | Modificar | T7 |
| `src/components/nav/AppLink.jsx` | `AppLink` e `LeadLink` por cima do `Link` | Criar | T7 |
| `src/lib/__tests__/appLink.test.js` | Links sob `MemoryRouter` | Criar | T7 |
| `src/components/RouteRedirect.jsx` | Troca o endereço barrado com replace e mostra o aviso | Criar | T8 |
| `src/lib/__tests__/routeRedirect.test.js` | O aviso e o replace | Criar | T8 |
| `src/hooks/useRouteScroll.js` | Rolagem por entrada do histórico no container do app | Criar | T8 |
| `src/lib/__tests__/useRouteScroll.test.js` | Memória, nova tentativa e as três ações | Criar | T8 |
| `src/hooks/useProfileLead.js` | `{ status, lead, retry }`, chave da sessão e portão de ociosidade | Modificar (reescrito) | T9 |
| `src/lib/__tests__/useProfileLead.test.js` | Primeiro render do hook | Criar | T9 |
| `src/hooks/useLeadTimeline.js` | Parâmetro `active` | Modificar | T9 |
| `src/views/LeadProfileView.jsx` | `onDeleteStart`, `onDeleteFailed` e `listenersActive` (T9); `overscroll-x-contain` nas abas (T13) | Modificar | T9, T13 |
| `src/components/ui/Skeleton.jsx` | `ProfileSkeleton` | Modificar | T9 |
| `src/views/LeadProfileRoute.jsx` | A ficha da rota e os avisos (`FichaPanel`) | Criar | T9 |
| `src/lib/__tests__/leadProfileRoute.test.js` | O que a rota desenha em cada estado | Criar | T9 |
| `src/lib/appShell.js` | O que a casca do App tira do endereço e da sessão. Puro | Criar (T10), Modificar (T11) | T10, T11 |
| `src/lib/__tests__/appShell.test.js` | Tela acesa, origem da ficha, sessão, login, sair, volta e funil salvo | Criar (T10), Modificar (T11) | T10, T11 |
| `src/App.jsx` | Tela derivada do endereço, ficha pela rota (esperando os contratos), redirect, título e rolagem (T10); sair, volta da visualização, login e funil salvo (T11); menu e Configurações (T12) | Modificar | T10, T11, T12 |
| `src/views/superadmin/SuperAdminView.jsx` | "Acessar como" grava `returnPath` | Modificar | T11 |
| `src/components/layout/Sidebar.jsx` | Item com `href` vira `AppLink` com `aria-current` | Modificar | T12 |
| `src/components/layout/PersonaMenu.jsx` | Perfil da academia e Plano e faturas como links | Modificar | T12 |
| `src/components/layout/Banners.jsx` | "Ver faturas" como link | Modificar | T12 |
| `src/lib/__tests__/menuLinks.test.js` | Itens do menu e aviso de mensalidade | Criar | T12 |
| `src/lib/__tests__/overscrollGuard.test.js` | Varredura: `overflow-x-auto` sem `overscroll-x-contain` quebra o CI | Criar | T13 |
| `src/views/KanbanView.jsx`, `src/views/dashboard/DashHighlights.jsx`, `src/views/dashboard/TeamMonthTable.jsx`, `src/views/dashboard/PeopleConversionTable.jsx`, `src/views/dashboard/MetaDaysCalendar.jsx`, `src/views/team/DayRail.jsx`, `src/components/profile/PhaseChanger.jsx`, `src/modals/ClientRegistrationModal.jsx`, `src/modals/AddLeadModal.jsx` | Rolador horizontal ganha `overscroll-x-contain` | Modificar | T13 |
| `CLAUDE.md` | Stack com React Router e a seção "Endereço de cada tela" | Modificar | T14 |
| `README.md` | Stack, estrutura de pastas e regra do slug | Modificar | T14 |
| `docs/superpowers/specs/2026-09-21-endereco-por-tela-design.md` | Em dia com as decisões da montagem | Modificar | T14 |

## Tarefas e contagem de testes

A contagem é cumulativa: o número da última coluna é o que `npx vitest run` mostra no fim da tarefa.

| Tarefa | O que entrega | Depende de | Testes novos | Arquivos de teste novos | Suíte no fim |
|---|---|---|---|---|---|
| base | main `f509d9e` | | | | 85 arquivos, 1824 testes |
| T1 | `react-router` e `BrowserRouter` | | 0 | 0 | 85, 1824 |
| T2 | `tenantSlug.js` e validação do identificador | T1 (só a ordem) | 21 | 3 | 88, 1845 |
| T3 | `routes.js`, parte 1 | T1, T2 | 36 | 1 | 89, 1881 |
| T4 | `routes.js`, parte 2 | T3 | 39 | 1 | 90, 1920 |
| T5 | `fichaState.js` | T3 | 24 | 1 | 91, 1944 |
| T6 | Sentry com endereço por tela | T4 | 29 | 1 | 92, 1973 |
| T7 | `AppLink`, `LeadLink` e `LeadProfileContext` | T1, T3 | 13 | 1 | 93, 1986 |
| T8 | `RouteRedirect` e `useRouteScroll` | T1, T4 | 16 | 2 | 95, 2002 |
| T9 | Ficha por endereço | T1, T3, T4, T5 | 15 | 2 | 97, 2017 |
| T10 | `App.jsx`, núcleo | T1 a T9 | 17 | 1 | 98, 2034 |
| T11 | `App.jsx`, sessão | T10 | 13 | 0 | 98, 2047 |
| T12 | Menu como link, menu do celular e Configurações | T7, T10, T11 | 10 | 1 | 99, 2057 |
| T13 | Gesto de voltar do trackpad | T9 | 2 | 1 | 100, 2059 |
| T14 | Documentação, verificação final e PR | T1 a T13 | 0 | 0 | 100, 2059 |
| **Total** | | | **235** | **15** | **100 arquivos, 2059 testes** |

---

### Task 1: dependência `react-router` e `BrowserRouter`

**Por que:** a peça de rotas é o React Router 7, fixado em `~7.18.4` (a 8 exige React 19.2.7, e o repo está em 19.2.4). O `BrowserRouter` entra em `src/main.jsx`, dentro do `StrictMode` e em volta do `<App/>`, para `useLocation`, `useNavigate` e `Link` valerem em qualquer lugar da árvore, inclusive em modais e portais. Conferido no fonte da 7.18.4 (`dist/development/chunk-OB3PAWPO.mjs:10492`): a prop `useTransitions` existe; com `false` o roteador chama o `setState` direto, e sem ela embrulha toda troca de endereço em `React.startTransition`. Vai `false` para a troca de tela continuar síncrona, como o `setActiveTab` de hoje.

Não há teste em node para esta task: o `BrowserRouter` precisa de `window` e `document`. O comportamento da biblioteca que o app usa (o `idx` do histórico) ganha teste próprio na T3. Nesta task o app continua igual: o `App.jsx` ainda não lê o roteador, e o `replaceState` cru dele (`src/App.jsx:273`) segue apagando o `idx` até a T10 tirá-lo, sem efeito porque ninguém lê o `idx` antes da T10.

**Files:**
- Modify: `package.json` (bloco `dependencies`, linha 26)
- Modify: `package-lock.json` (pelo `npm install`)
- Modify: `src/main.jsx` (arquivo inteiro)

**Depende de:** nada. É a primeira tarefa.

- [ ] **Step 1: Conferir a base e registrar o plano na branch**

```bash
git branch --show-current
git status --short
```

Esperado: `claude/rotas-pr2-enderecos` e, no máximo, a linha `?? docs/superpowers/plans/2026-09-22-rotas-pr2-enderecos.md` (este plano). Se ela aparecer, registre o plano antes de mexer em código:

```bash
git add docs/superpowers/plans/2026-09-22-rotas-pr2-enderecos.md
git commit -F - <<'EOF'
docs: plano do PR 2 do endereço por tela (endereços)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

Depois confira a base:

```bash
git log --oneline -2
npx vitest run 2>&1 | tail -4
npm run lint 2>&1 | tail -2
```

Esperado: o commit do plano em cima do merge da main `f509d9e`; `Test Files  85 passed (85)` e `Tests  1824 passed (1824)`; `✖ 1 problem (0 errors, 1 warning)`. Se a contagem for outra (a main andou), anote a diferença e some a ela todos os números esperados do plano.

- [ ] **Step 2: Instalar o `react-router` com til**

```bash
npm install react-router@7.18.4 --save-prefix='~' --no-audit --no-fund
npm ls react-router
git diff package.json
```

Esperado: `npm ls` mostra `└── react-router@7.18.4`. O `git diff package.json` mostra uma linha só, dentro de `dependencies`, logo depois de `react-dom`:

```diff
     "react": "^19.2.4",
     "react-dom": "^19.2.4",
+    "react-router": "~7.18.4",
     "tailwind-merge": "^3.6.0",
```

O `package-lock.json` ganha três pacotes: `react-router` 7.18.4 e as duas dependências dele, `cookie` 1.1.1 e `set-cookie-parser` 2.7.2 (simulado com `--package-lock-only` numa cópia do lock). Se o `package.json` sair com `^7.18.4`, troque à mão para `~7.18.4` e rode `npm install` de novo.

- [ ] **Step 3: Conferir no pacote instalado a prop e o `idx`**

```bash
node -e "const f=require('fs');const d='node_modules/react-router/dist/development/';const s=f.readdirSync(d).filter(n=>/^chunk-.*\.mjs$/.test(n)).map(n=>f.readFileSync(d+n,'utf8')).join('');console.log('useTransitions:', s.includes('useTransitions === false'), '| idx:', s.includes('idx: index'), '| v5Compat:', s.includes('createBrowserHistory({ window: window2, v5Compat: true })'))"
node -e "import('react-router').then(m=>console.log('UNSAFE_createBrowserHistory:', typeof m.UNSAFE_createBrowserHistory))"
```

Esperado: `useTransitions: true | idx: true | v5Compat: true` e `UNSAFE_createBrowserHistory: function`. Se `useTransitions` der `false`, a prop não existe nessa versão: siga com `<BrowserRouter>` sem a prop e registre na descrição do PR.

- [ ] **Step 4: Envolver o app no `BrowserRouter`**

Antes (`src/main.jsx`, arquivo inteiro):

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { initSentry } from './lib/sentry.js'
import App from './App.jsx'
import './index.css'

// Antes do render, para que erro durante o boot da árvore seja capturado.
initSentry()

// React 19 expõe três ganchos de erro no createRoot. Sem eles, erro capturado
// por ErrorBoundary não chega ao Sentry, porque o React o considera tratado.
ReactDOM.createRoot(document.getElementById('root'), {
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

Depois (arquivo inteiro):

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { BrowserRouter } from 'react-router'
import { initSentry } from './lib/sentry.js'
import App from './App.jsx'
import './index.css'

// Antes do render, para que erro durante o boot da árvore seja capturado.
initSentry()

// React 19 expõe três ganchos de erro no createRoot. Sem eles, erro capturado
// por ErrorBoundary não chega ao Sentry, porque o React o considera tratado.
ReactDOM.createRoot(document.getElementById('root'), {
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <React.StrictMode>
    {/* Troca de tela síncrona, como era antes do roteador: sem
        startTransition, o clique duplo não empilha duas entradas e a
        rolagem e o redirect leem o endereço já trocado. */}
    <BrowserRouter useTransitions={false}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
```

- [ ] **Step 5: Rodar testes, lint e build**

```bash
npx vitest run 2>&1 | tail -4
npm run lint 2>&1 | tail -2
npm run build 2>&1 | tail -4
```

Esperado: `Tests  1824 passed (1824)`; `✖ 1 problem (0 errors, 1 warning)`; o build termina com `✓ built in ...`. O aviso de chunk maior que 500 kB já existia. O `react-router` cai no chunk `vendor`, porque o teste `/react/` do `manualChunks` (`vite.config.js:62-71`) não casa com `/react-router/`. Nenhuma mudança de config.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/main.jsx
git commit -F - <<'EOF'
feat: adiciona react-router e envolve o app no BrowserRouter

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 2: `tenantSlug.js` e a validação do identificador da academia

**Por que:** o endereço passa a ler `/pipeline` como tela sem academia, então nenhuma academia pode ter um id igual a uma palavra de tela, a `api`, a `assets` (que a Vercel serve antes do app) ou a `console` (endereço futuro do super-admin). A regra mora num módulo puro e sem import, `src/lib/tenantSlug.js`, que o front e a `api/` importam (a `api/` já importa de `src/lib`, como em `api/_auth.js:2` e `api/_zapCard.js:5`, então não nasce função nova na Vercel). O provisionamento é a autoridade: é o único ponto que cria `tenants/{id}`. O Console avisa antes de mandar. O `register-tenant.js` hoje aceita qualquer texto. O `tenant-resolve` deixa de gastar o limitador por IP (60 a cada 5 minutos) e uma leitura quando alguém abre `/pipeline` sem a academia.

As cinco academias de produção (conferidas em 21/09/2026: `academia-power-club`, `academia-shape-one`, `academia-teste`, `petros-barbell-club`, `stronix-crm-app`) estão no formato e fora da lista. O teste trava isso.

`tenantSlugProblem` não normaliza o que recebe: `'Console'` dá `'formato'` e `'console'` dá `'reservado'`. Quem chama passa o id do jeito que vai gravar: o provisionamento já apara e passa para minúsculas (`api/provision-tenant.js:132`), e o Console passa o valor do `slugify` (`SuperConsole.jsx:399`), sempre minúsculo. Já `isReservedTenantSlug` ignora caixa e espaço, porque só responde "é reservada".

**Files:**
- Create: `src/lib/tenantSlug.js`
- Create: `src/lib/__tests__/tenantSlug.test.js`
- Create: `api/__tests__/tenantResolve.test.js`
- Create: `api/__tests__/provisionTenant.test.js`
- Modify: `api/provision-tenant.js` (import na linha 8; constante nas linhas 17-18; validação nas linhas 177-181)
- Modify: `api/tenant-resolve.js` (import na linha 4; `SLUG_RE` na linha 31; começo do GET nas linhas 44-52)
- Modify: `src/views/console/SuperConsole.jsx` (import na linha 6; validação na linha 628)
- Modify: `scripts/register-tenant.js` (imports nas linhas 14-15; checagem depois da linha 24)

**Depende de:** nada no código (vem depois da T1 só pela ordem do plano).

- [ ] **Step 1: Escrever o teste do módulo**

Crie `src/lib/__tests__/tenantSlug.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  TENANT_SLUG_READ_RE, TENANT_SLUG_CREATE_RE, RESERVED_TENANT_SLUGS,
  isReservedTenantSlug, tenantSlugProblem,
} from '../tenantSlug.js';

// As cinco academias de produção, conferidas em 21/09/2026. Se alguma palavra
// reservada nova bater com uma delas, o link dessa academia quebra.
const PRODUCAO = ['academia-power-club', 'academia-shape-one', 'academia-teste', 'petros-barbell-club', 'stronix-crm-app'];

describe('TENANT_SLUG_READ_RE (leitura do endereço)', () => {
  it('aceita as academias de hoje e slug curto antigo', () => {
    for (const id of [...PRODUCAO, 'a', 'x1', 'abc-']) expect(TENANT_SLUG_READ_RE.test(id), id).toBe(true);
    expect(TENANT_SLUG_READ_RE.test('a'.repeat(64))).toBe(true);
  });

  it('recusa maiúscula, sublinhado, espaço, hífen no começo e mais de 64', () => {
    for (const id of ['Stronix', 'academia_legada', 'a b', '-abc', '', 'a'.repeat(65)]) {
      expect(TENANT_SLUG_READ_RE.test(id), id).toBe(false);
    }
  });
});

describe('TENANT_SLUG_CREATE_RE (academia nova)', () => {
  it('de 3 a 40 caracteres, sem hífen nas pontas', () => {
    for (const id of ['abc', 'a1b', 'corpo-e-movimento', 'a'.repeat(40)]) expect(TENANT_SLUG_CREATE_RE.test(id), id).toBe(true);
    for (const id of ['ab', 'a'.repeat(41), '-abc', 'abc-', 'Abc', 'a_b_c']) expect(TENANT_SLUG_CREATE_RE.test(id), id).toBe(false);
  });
});

describe('RESERVED_TENANT_SLUGS', () => {
  it('é congelada, sem repetição e em minúsculas', () => {
    expect(Object.isFrozen(RESERVED_TENANT_SLUGS)).toBe(true);
    expect(new Set(RESERVED_TENANT_SLUGS).size).toBe(RESERVED_TENANT_SLUGS.length);
    for (const w of RESERVED_TENANT_SLUGS) expect(w, w).toBe(w.toLowerCase());
  });

  it('toda palavra reservada tem o formato de leitura, senão a leitura do endereço nem chegaria a ela', () => {
    for (const w of RESERVED_TENANT_SLUGS) expect(TENANT_SLUG_READ_RE.test(w), w).toBe(true);
  });

  it('traz as obrigatórias: o que a Vercel serve antes do app, o console e a indicação', () => {
    for (const w of ['api', 'assets', 'console', 'super-admin', 'ficha', 'i', 'invite']) {
      expect(RESERVED_TENANT_SLUGS, w).toContain(w);
    }
  });

  it('nenhuma academia de produção está reservada', () => {
    for (const id of PRODUCAO) expect(isReservedTenantSlug(id), id).toBe(false);
  });
});

describe('isReservedTenantSlug', () => {
  it('não diferencia maiúscula e ignora espaço nas pontas', () => {
    expect(isReservedTenantSlug('API')).toBe(true);
    expect(isReservedTenantSlug(' pipeline ')).toBe(true);
    expect(isReservedTenantSlug('Console')).toBe(true);
  });

  it('o que não é texto não é reservado', () => {
    expect(isReservedTenantSlug(null)).toBe(false);
    expect(isReservedTenantSlug(undefined)).toBe(false);
    expect(isReservedTenantSlug(42)).toBe(false);
  });
});

describe('tenantSlugProblem', () => {
  it('academia de produção serve', () => {
    for (const id of PRODUCAO) expect(tenantSlugProblem(id), id).toBeNull();
  });

  it('formato: curto, comprido, hífen na ponta, maiúscula, vazio ou não texto', () => {
    for (const id of ['ab', 'a'.repeat(41), '-abc', 'abc-', 'Console', 'minha academia', '', null, undefined, 123]) {
      expect(tenantSlugProblem(id), String(id)).toBe('formato');
    }
  });

  it('reservado: toda palavra reservada com formato de criação', () => {
    const comFormato = RESERVED_TENANT_SLUGS.filter((w) => TENANT_SLUG_CREATE_RE.test(w));
    expect(comFormato.length).toBeGreaterThan(30);
    for (const w of comFormato) expect(tenantSlugProblem(w), w).toBe('reservado');
  });

  it('palavra reservada curta demais para criar cai no formato', () => {
    expect(tenantSlugProblem('i')).toBe('formato');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/tenantSlug.test.js 2>&1 | tail -6
```

Esperado: `FAIL  src/lib/__tests__/tenantSlug.test.js` com `Error: Cannot find module '../tenantSlug.js'`.

- [ ] **Step 3: Criar o módulo**

Crie `src/lib/tenantSlug.js`:

```js
// Identificador da academia no endereço (stronilead.com.br/<academia>/...).
// Puro e sem import: o front (leitura do endereço e formulário do Console), as
// funções da api/ (provision-tenant e tenant-resolve) e os scripts importam
// daqui, para a regra nunca divergir entre eles.

// Leitura do endereço. Mais larga que a de criação para continuar aceitando
// qualquer academia antiga que já tenha link circulando.
export const TENANT_SLUG_READ_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

// Criação de academia nova: de 3 a 40 caracteres, minúsculas, números e hífen,
// sem hífen nas pontas.
export const TENANT_SLUG_CREATE_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

// Palavras que nunca podem ser academia, porque o endereço já usa ou vai usar:
// - api e assets: a Vercel serve esses caminhos antes do app;
// - as palavras de tela do primeiro nível (pipeline, clientes, ficha...): é o
//   que deixa o app ler /pipeline como tela sem academia. Tela nova com
//   primeiro segmento novo entra aqui, e o tenantSlug.test.js quebra se faltar;
// - i, convite e invite: indicação pública e convite;
// - console e super-admin: endereços do super-admin;
// - o resto é precaução.
// Antes de acrescentar uma palavra, confira que nenhuma academia usa esse id,
// senão o link dela passa a abrir outra coisa.
export const RESERVED_TENANT_SLUGS = Object.freeze([
  'api', 'assets', 'static', 'public', 'index', 'favicon', 'robots', 'sitemap', 'manifest', 'service-worker',
  'i', 'convite', 'invite', 'indicacao', 'login', 'entrar', 'sair', 'logout', 'cadastro', 'ativar', 'recuperar-senha',
  'visao-geral', 'pipeline', 'clientes', 'meta-diaria', 'leads', 'configuracoes', 'perfil-da-academia', 'plano-e-faturas', 'ficha', 'super-admin',
  'console', 'admin', 'superadmin', 'painel', 'app', 'www', 'suporte', 'ajuda', 'status', 'stronilead',
]);

const RESERVED = new Set(RESERVED_TENANT_SLUGS);

// Não diferencia maiúscula e ignora espaço nas pontas: 'API' também é reservada.
export function isReservedTenantSlug(s) {
  return typeof s === 'string' && RESERVED.has(s.trim().toLowerCase());
}

// Por que um id NÃO pode virar academia nova: 'formato', 'reservado' ou null
// quando ele serve. Recebe o id do jeito que vai ser gravado (o provisionamento
// já passa aparado e em minúsculas), então não normaliza nada: 'Console' dá
// 'formato', e 'console' dá 'reservado'.
export function tenantSlugProblem(s) {
  if (typeof s !== 'string' || !TENANT_SLUG_CREATE_RE.test(s)) return 'formato';
  if (RESERVED.has(s)) return 'reservado';
  return null;
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/tenantSlug.test.js 2>&1 | tail -4
```

Esperado: `Tests  13 passed (13)`.

- [ ] **Step 5: Escrever os testes das duas rotas da `api/`**

Os dois usam um banco falso no formato do SDK de servidor (`snap.exists` é propriedade, como no `api/__tests__/zapRoute.test.js`) que anota cada leitura, para provar que a palavra reservada não toca no banco.

Crie `api/__tests__/tenantResolve.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../tenant-resolve.js';

// A leitura pública da marca da academia (GET /api/tenant-resolve?slug=).
// Palavra reservada (/pipeline, /api, /console) nunca é academia: a rota
// responde na hora, sem gastar o limitador por IP e sem ler o banco.

const banco = vi.hoisted(() => ({ tenants: {}, leituras: [] }));
const limitador = vi.hoisted(() => ({ chamadas: 0 }));

vi.mock('../_firebaseAdmin.js', () => {
  const ref = (caminho) => ({
    collection: (nome) => ref([...caminho, nome]),
    doc: (id) => ref([...caminho, id]),
    get: async () => {
      banco.leituras.push(caminho.join('/'));
      const dados = caminho[0] === 'tenants' ? banco.tenants[caminho[1]] : undefined;
      return { id: caminho.at(-1), exists: dados != null, data: () => dados };
    },
  });
  return { adminDb: ref([]), adminAuth: {}, admin: {} };
});

vi.mock('../_rateLimit.js', () => ({
  checkRateLimit: async () => { limitador.chamadas += 1; return { ok: true }; },
  clientIp: () => '203.0.113.7',
}));

const pedido = (slug) => ({ method: 'GET', headers: {}, query: { slug } });
const resposta = () => ({
  statusCode: 0,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});

describe('GET /api/tenant-resolve', () => {
  beforeEach(() => {
    banco.tenants = { 'academia-teste': { displayName: 'Academia Teste' } };
    banco.leituras = [];
    limitador.chamadas = 0;
  });

  it('palavra reservada responde found false sem limitador e sem banco', async () => {
    for (const slug of ['pipeline', 'CONSOLE', 'api', 'super-admin']) {
      const res = resposta();
      await handler(pedido(slug), res);
      expect(res.statusCode, slug).toBe(200);
      expect(res.body, slug).toEqual({ found: false });
    }
    expect(limitador.chamadas).toBe(0);
    expect(banco.leituras).toEqual([]);
  });

  it('academia que existe continua devolvendo a marca', async () => {
    const res = resposta();
    await handler(pedido('academia-teste'), res);
    expect(res.body).toEqual({ found: true, tenantId: 'academia-teste', displayName: 'Academia Teste' });
    expect(limitador.chamadas).toBe(1);
    expect(banco.leituras).toEqual(['tenants/academia-teste']);
  });

  it('academia que não existe lê o banco e responde found false', async () => {
    const res = resposta();
    await handler(pedido('nao-existe'), res);
    expect(res.body).toEqual({ found: false });
    expect(banco.leituras).toEqual(['tenants/nao-existe']);
  });

  it('formato inválido continua 400', async () => {
    const res = resposta();
    await handler(pedido('Academia_Legada!'), res);
    expect(res.statusCode).toBe(400);
    expect(banco.leituras).toEqual([]);
  });
});
```

Crie `api/__tests__/provisionTenant.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../provision-tenant.js';

// O provisionamento é a autoridade sobre o identificador da academia: é o
// único ponto que cria tenants/{id}. Palavra reservada (pipeline, console...)
// vira academia só se passar por aqui, então a recusa mora aqui, antes de
// qualquer leitura.

const banco = vi.hoisted(() => ({ tenants: {}, leituras: [] }));

vi.mock('../_firebaseAdmin.js', () => {
  const ref = (caminho) => ({
    collection: (nome) => ref([...caminho, nome]),
    doc: (id) => ref([...caminho, id]),
    get: async () => {
      banco.leituras.push(caminho.join('/'));
      const dados = caminho[0] === 'tenants' ? banco.tenants[caminho[1]] : undefined;
      return { id: caminho.at(-1), exists: dados != null, data: () => dados };
    },
  });
  return {
    adminDb: ref([]),
    adminAuth: {},
    admin: { firestore: { FieldValue: { serverTimestamp: () => 'agora' } } },
    // Só o super-admin chega ao POST.
    verifyRequest: async () => ({ uid: 'super-1', superAdmin: true }),
  };
});

vi.mock('../_plans.js', () => ({
  loadPlans: async () => { banco.leituras.push('plans'); return new Map(); },
}));

const pedido = (tenantId) => ({
  method: 'POST',
  headers: { authorization: 'Bearer x' },
  body: { tenantId, displayName: 'Academia Nova', adminEmail: 'dono@academia.com' },
});
const resposta = () => ({
  statusCode: 0,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});

describe('POST /api/provision-tenant: identificador', () => {
  beforeEach(() => {
    banco.tenants = {};
    banco.leituras = [];
  });

  it('palavra reservada é recusada antes de qualquer leitura', async () => {
    const res = resposta();
    await handler(pedido('pipeline'), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('O identificador "pipeline" é usado pelo sistema. Escolha outro.');
    expect(banco.leituras).toEqual([]);
  });

  it('a recusa vale depois de aparar e passar para minúsculas', async () => {
    const res = resposta();
    await handler(pedido('  Console '), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('O identificador "console" é usado pelo sistema. Escolha outro.');
  });

  it('formato inválido mantém a mensagem de hoje', async () => {
    const res = resposta();
    await handler(pedido('ab'), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Identificador inválido. Use minúsculas, números e hífen (3–40 caracteres).');
    expect(banco.leituras).toEqual([]);
  });

  it('identificador livre passa da validação e chega à checagem de duplicado', async () => {
    banco.tenants['academia-nova'] = { displayName: 'Já existe' };
    const res = resposta();
    await handler(pedido('academia-nova'), res);
    expect(res.statusCode).toBe(409);
    expect(banco.leituras).toEqual(['plans', 'tenants/academia-nova']);
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

```bash
npx vitest run api/__tests__/tenantResolve.test.js api/__tests__/provisionTenant.test.js 2>&1 | tail -30
```

Esperado: `Tests  3 failed | 5 passed (8)`. As falhas:

- `palavra reservada responde found false sem limitador e sem banco`: `AssertionError: expected 4 to be +0` (o limitador rodou 4 vezes);
- `palavra reservada é recusada antes de qualquer leitura` e `a recusa vale depois de aparar e passar para minúsculas`: `AssertionError: expected 500 to be 400`.

O log `provision-tenant POST TypeError: tenantsCol(...).doc(...).create is not a function` também aparece: é o banco falso, que não tem `create`, porque o código de hoje deixa `pipeline` passar até a gravação. Some depois do Step 8.

- [ ] **Step 7: Recusar palavra reservada no provisionamento**

Em `api/provision-tenant.js`, três trocas.

(a) Import. Antes (linha 8):

```js
import { withSentry } from './_sentry.js';
```

Depois:

```js
import { withSentry } from './_sentry.js';
import { tenantSlugProblem } from '../src/lib/tenantSlug.js';
```

(b) A constante local sai, porque a regra passa a vir de `tenantSlug.js`. Antes (linhas 17-19):

```js
// slug do tenant: minúsculas, números e hífen; 3–40 chars; sem hífen nas pontas.
const TENANT_ID_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
```

Depois:

```js
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
```

(c) Validação. Antes (linhas 177-181):

```js
      if (!TENANT_ID_RE.test(slug)) {
        return res.status(400).json({
          error: 'Identificador inválido. Use minúsculas, números e hífen (3–40 caracteres).'
        });
      }
```

Depois:

```js
      // Formato e palavras reservadas moram em src/lib/tenantSlug.js, a mesma
      // regra que o app usa para ler o endereço. Palavra reservada (pipeline,
      // console...) viraria um endereço que abre uma tela, não a academia.
      const slugProblem = tenantSlugProblem(slug);
      if (slugProblem === 'formato') {
        return res.status(400).json({
          error: 'Identificador inválido. Use minúsculas, números e hífen (3–40 caracteres).'
        });
      }
      if (slugProblem === 'reservado') {
        return res.status(400).json({ error: `O identificador "${slug}" é usado pelo sistema. Escolha outro.` });
      }
```

O caminho `resendInvite` (linhas 135-166) trabalha com academia que já existe e não passa por aqui, de propósito.

- [ ] **Step 8: Responder palavra reservada na hora no `tenant-resolve`**

Em `api/tenant-resolve.js`, três trocas.

(a) Import. Antes (linha 4):

```js
import { withSentry } from './_sentry.js';
```

Depois:

```js
import { withSentry } from './_sentry.js';
import { TENANT_SLUG_READ_RE, isReservedTenantSlug } from '../src/lib/tenantSlug.js';
```

(b) A regex local passa a ser a de leitura do módulo (ela continua servindo às actions da indicação, na linha 91). Antes (linha 31):

```js
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
```

Depois:

```js
// Mesma regra de leitura do endereço do app (src/lib/tenantSlug.js).
const SLUG_RE = TENANT_SLUG_READ_RE;
```

(c) Começo do GET: a leitura do slug sobe para antes do limitador, e a palavra reservada responde antes dele. Antes (linhas 44-52):

```js
  // Endpoint público — limita enumeração de slugs por IP (limite generoso, é
  // chamado a cada abertura da tela de login). Fail-open se a checagem falhar.
  const rl = await checkRateLimit(`tenant-resolve:${clientIp(req)}`, { limit: 60, windowMs: 5 * 60 * 1000 });
  if (!rl.ok) {
    return res.status(429).json({ error: 'Muitas requisições. Aguarde um momento.' });
  }

  const slug = String(req.query?.slug || '').trim().toLowerCase();
  if (!slug || !SLUG_RE.test(slug)) {
```

Depois:

```js
  const slug = String(req.query?.slug || '').trim().toLowerCase();

  // Palavra reservada (pipeline, api, console...) nunca é academia: é alguém
  // que abriu /pipeline sem o nome da academia. Responde na hora, sem gastar
  // o limitador por IP e sem ler o banco.
  if (isReservedTenantSlug(slug)) {
    return res.status(200).json({ found: false });
  }

  // Endpoint público — limita enumeração de slugs por IP (limite generoso, é
  // chamado a cada abertura da tela de login). Fail-open se a checagem falhar.
  const rl = await checkRateLimit(`tenant-resolve:${clientIp(req)}`, { limit: 60, windowMs: 5 * 60 * 1000 });
  if (!rl.ok) {
    return res.status(429).json({ error: 'Muitas requisições. Aguarde um momento.' });
  }

  if (!slug || !SLUG_RE.test(slug)) {
```

As actions POST da indicação (`referral-info` e `referral-signup`) não mudam.

- [ ] **Step 9: Rodar e ver passar**

```bash
npx vitest run api/__tests__/tenantResolve.test.js api/__tests__/provisionTenant.test.js 2>&1 | tail -4
```

Esperado: `Tests  8 passed (8)`, sem o log de `TypeError`.

- [ ] **Step 10: Mesma regra no formulário do Console**

Em `src/views/console/SuperConsole.jsx`, duas trocas.

(a) Import. Antes (linha 6):

```jsx
import { planLabel, auditActionLabel, IMPERSONATION_KEY } from '../../lib/superadmin.js';
```

Depois:

```jsx
import { planLabel, auditActionLabel, IMPERSONATION_KEY } from '../../lib/superadmin.js';
import { tenantSlugProblem } from '../../lib/tenantSlug.js';
```

(b) Validação dentro de `save`, no `NewTenantPanel`. Antes (linha 628):

```jsx
    if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(f.tenantId)) { setErr('Identificador inválido: 3–40 caracteres, minúsculas, números e hífen.'); return; }
```

Depois:

```jsx
    const slugProblem = tenantSlugProblem(f.tenantId);
    if (slugProblem === 'formato') { setErr('Identificador inválido: 3–40 caracteres, minúsculas, números e hífen.'); return; }
    if (slugProblem === 'reservado') { setErr('Esse identificador é usado pelo sistema. Escolha outro.'); return; }
```

O texto de formato continua o de hoje. O `slugify` (linha 399) monta o id a partir do nome, então uma academia chamada "Console" ou "Pipeline" cai no aviso novo antes de chamar a `api/`, que recusaria do mesmo jeito. O `SuperAdminView.jsx` legado não muda: o servidor já recusa por ele. Não há teste automático para esta tela (ela depende do Firebase). A conferência é no preview, na T14: Console, Nova academia, nome "Console", o aviso "Esse identificador é usado pelo sistema. Escolha outro." aparece e nada é criado.

- [ ] **Step 11: Mesma regra no `register-tenant.js`**

Em `scripts/register-tenant.js`, duas trocas.

(a) Imports. Antes (linhas 14-15):

```js
import process from 'node:process';
import admin from 'firebase-admin';
```

Depois:

```js
import process from 'node:process';
import admin from 'firebase-admin';
import { TENANT_SLUG_READ_RE, isReservedTenantSlug } from '../src/lib/tenantSlug.js';
```

(b) Checagem logo depois da de argumentos. Antes (linhas 21-24):

```js
if (!tenantId || !displayName) {
  console.error('Uso: node scripts/register-tenant.js <tenantId> <displayName> [primaryAdminEmail]');
  process.exit(1);
}
```

Depois:

```js
if (!tenantId || !displayName) {
  console.error('Uso: node scripts/register-tenant.js <tenantId> <displayName> [primaryAdminEmail]');
  process.exit(1);
}

// O id vira o endereço da academia (stronilead.com.br/<id>). Fora do formato de
// leitura o endereço não abre a academia, e palavra reservada abre uma tela.
// A regra mora em src/lib/tenantSlug.js.
if (!TENANT_SLUG_READ_RE.test(tenantId) || isReservedTenantSlug(tenantId)) {
  console.error(`Identificador "${tenantId}" inválido ou reservado. Use minúsculas, números e hífen, fora da lista de src/lib/tenantSlug.js.`);
  process.exit(1);
}
```

Conferir sem tocar no Firebase (o `env -u` garante que o script para antes de conectar):

```bash
env -u FIREBASE_ADMIN_PROJECT_ID node scripts/register-tenant.js pipeline "Teste"; echo "saida=$?"
env -u FIREBASE_ADMIN_PROJECT_ID node scripts/register-tenant.js Academia_X "Teste"; echo "saida=$?"
env -u FIREBASE_ADMIN_PROJECT_ID node scripts/register-tenant.js stronix-crm-app "Stronix"; echo "saida=$?"
```

Esperado: as duas primeiras imprimem `Identificador "pipeline" inválido ou reservado. ...` e `Identificador "Academia_X" inválido ou reservado. ...` com `saida=1`. A terceira passa da checagem e para em `Faltam env vars: FIREBASE_ADMIN_PROJECT_ID / ...` com `saida=1`, que prova que `stronix-crm-app` foi aceito.

- [ ] **Step 12: Suite inteira e lint**

```bash
npx vitest run 2>&1 | tail -4
npm run lint 2>&1 | tail -2
```

Esperado: `Test Files  88 passed (88)` e `Tests  1845 passed (1845)` (1824 + 21); `✖ 1 problem (0 errors, 1 warning)`.

- [ ] **Step 13: Commit**

```bash
git add src/lib/tenantSlug.js src/lib/__tests__/tenantSlug.test.js api/__tests__/tenantResolve.test.js api/__tests__/provisionTenant.test.js api/provision-tenant.js api/tenant-resolve.js src/views/console/SuperConsole.jsx scripts/register-tenant.js
git commit -F - <<'EOF'
feat: reserva as palavras do endereço e valida o identificador da academia

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 3: `routes.js`, parte 1 (tabela de telas, leitura e montagem de endereço, contrato do `idx`)

**Por que:** um módulo puro, sem React e sem Firebase, concentra a tabela de telas e as regras de ler e montar endereço. As decisões que o código abaixo toma, todas cobertas por teste:

- `SCREENS` usa como chave os mesmos valores de `activeTab` de hoje. `LEAVES` e `GROUPS` são tirados de `SCREENS`, então tela nova é uma linha na tabela (mais a reserva na `tenantSlug.js`, que o teste da guarda cobra).
- A leitura decodifica segmento por segmento. Segmento malformado vira `null` e invalida só ele: `/<t>/%E0%A4%A` mantém a academia e cai em desconhecido, e um malformado no `rest` fica como `null` na lista.
- `tenantSlug` é o 1º segmento em minúsculas quando tem o formato de leitura e não é reservado. Senão fica `null` e o 1º segmento é lido como tela (`/pipeline`, `/ficha/<id>`).
- Só as telas-folha da spec (pipeline, clientes, meta-diaria, configuracoes, perfil-da-academia, plano-e-faturas e ficha/<id>) aceitam segmentos a mais, em `rest`. Nos grupos (visao-geral, leads, super-admin), filho desconhecido ou segmento depois do filho é endereço desconhecido.
- Ficha sem id ou com id que não passa em `isValidLeadId` dá `screen: 'ficha'` e `leadId: null`, que é "Ficha não encontrada" e não endereço desconhecido.
- Nome de propriedade do JavaScript (`constructor`, `__proto__`, `toString`) nunca vira tela: toda busca nas tabelas passa por `hasOwnProperty`.
- `hrefFor` aceita qualquer academia não vazia, com `encodeURIComponent`, para o link nunca sair quebrado; academia com id fora do formato de leitura fica sempre no Operacional, porque o endereço não relê o id (hoje nenhuma está nesse caso, e a T2 impede criar outra). Devolve `null` também quando o `encodeURIComponent` não consegue codificar (metade de um emoji).
- `isValidLeadId` recusa `.` e `..` porque o `navigate` do React Router resolve esses segmentos (`resolvePath`, `chunk-OB3PAWPO.mjs:877`) e o link iria para outro lugar.

**Contrato do `idx`** (conferido no fonte da 7.18.4, `chunk-OB3PAWPO.mjs`): `getHistoryState` grava `{ usr, key, idx, masked }` (linha 222); na carga, se o `idx` não existe, `replaceState({ ...state, idx: 0 }, "")` sem trocar o endereço (linha 288); `push` grava `idx` atual + 1; `replace` mantém o `idx`; `location.key` vem de `state.key` ou é `"default"`. O `UNSAFE_createBrowserHistory` é exportado por `react-router` (`index.mjs:189`), e o `BrowserRouter` usa o mesmo `createBrowserHistory({ window, v5Compat: true })` (linha 10500). O teste abaixo roda esse código de verdade contra uma janela falsa.

Depende da T1 (o teste importa `react-router`) e da T2 (`tenantSlug.js`).

**Files:**
- Create: `src/lib/routes.js`
- Create: `src/lib/__tests__/routes.test.js`
- Modify: `src/lib/__tests__/tenantSlug.test.js` (import no topo; `describe` novo no fim)

- [ ] **Step 1: Escrever o teste da parte 1**

Crie `src/lib/__tests__/routes.test.js`. Os caracteres de controle e a metade de emoji são montados com `String.fromCharCode`, para o arquivo não levar byte invisível.

```js
import { describe, it, expect } from 'vitest';
import { UNSAFE_createBrowserHistory } from 'react-router';
import {
  HOME_SCREEN, SCREENS, SUPER_TABS, FIRST_LEVEL_SEGMENTS,
  isValidLeadId, parseAppPath, hrefFor, canGoBackInApp,
} from '../routes.js';

const T = 'stronix-crm-app';
// Caracteres montados pelo código para o arquivo não ter byte invisível.
const NUL = String.fromCharCode(0);
const DEL = String.fromCharCode(0x7f);
// Metade de um emoji: o encodeURIComponent não consegue codificar.
const MEIO_EMOJI = String.fromCharCode(0xd800);

// Os mesmos valores de activeTab que o App.jsx usa hoje.
const TELAS = [
  'dashboard', 'dashOperacional', 'dashCrm', 'dashGerencial', 'kanban', 'clientes', 'dailyGoal',
  'leads', 'aulas', 'visitas', 'settings', 'profile', 'billing', 'superadmin', 'ficha',
];

describe('SCREENS', () => {
  it('tem exatamente as telas de hoje, congeladas', () => {
    expect(Object.keys(SCREENS).sort()).toEqual([...TELAS].sort());
    expect(Object.isFrozen(SCREENS)).toBe(true);
    for (const id of TELAS) {
      expect(Object.isFrozen(SCREENS[id]), id).toBe(true);
      expect(Object.isFrozen(SCREENS[id].segs), id).toBe(true);
    }
    expect(HOME_SCREEN).toBe('dashboard');
  });

  it('trava de gestor só em Configurações, Perfil da academia e Plano e faturas; super-admin só na dele', () => {
    const gestor = TELAS.filter((id) => SCREENS[id].gestor === true);
    const superAdmin = TELAS.filter((id) => SCREENS[id].superAdmin === true);
    expect(gestor.sort()).toEqual(['billing', 'profile', 'settings']);
    expect(superAdmin).toEqual(['superadmin']);
  });

  it('títulos da aba sem travessão', () => {
    for (const id of TELAS) expect(SCREENS[id].title, id).not.toMatch(/[—–]/);
    expect(SCREENS.dailyGoal.title).toBe('Meta diária');
    expect(SCREENS.ficha.title).toBe('Ficha');
  });

  it('primeiro segmento de cada tela, sem repetição', () => {
    expect([...FIRST_LEVEL_SEGMENTS].sort()).toEqual([
      'clientes', 'configuracoes', 'ficha', 'leads', 'meta-diaria', 'perfil-da-academia',
      'pipeline', 'plano-e-faturas', 'super-admin', 'visao-geral',
    ]);
    expect(Object.isFrozen(FIRST_LEVEL_SEGMENTS)).toBe(true);
  });

  it('subabas do super-admin em português', () => {
    expect(SUPER_TABS).toEqual({ overview: 'visao-geral', clients: 'clientes', finance: 'financeiro', plans: 'planos' });
  });
});

describe('isValidLeadId', () => {
  it('aceita id automático do Firestore e o que a regra do Firestore aceita', () => {
    for (const id of ['Ab12', 'kX3a9LmQ2rT7vW1yZ0bC', 'João Silva', 'a.b', '...', '___', '100%', 'a'.repeat(128)]) {
      expect(isValidLeadId(id), id).toBe(true);
    }
  });

  it('recusa vazio, barra, . e .., __x__, controle, mais de 128 e o que não é texto', () => {
    for (const id of ['', 'a/b', '/', '.', '..', '__x__', '____', `a${NUL}b`, 'a\nb', DEL, 'a'.repeat(129), null, undefined, 42]) {
      expect(isValidLeadId(id), JSON.stringify(id)).toBe(false);
    }
  });
});

describe('parseAppPath', () => {
  it('raiz: tudo vazio e não é endereço desconhecido', () => {
    for (const p of ['/', '']) {
      expect(parseAppPath(p)).toEqual({
        pathname: p, tenantSlug: null, screen: null, leadId: null, superTab: null, rest: [], unknown: false,
      });
    }
  });

  it('/<academia> é a tela inicial, com qualquer caixa e barra no fim', () => {
    expect(parseAppPath(`/${T}`)).toMatchObject({ tenantSlug: T, screen: 'dashboard', unknown: false });
    expect(parseAppPath('/STRONIX-CRM-APP/')).toMatchObject({ tenantSlug: T, screen: 'dashboard' });
  });

  it('lê cada endereço da tabela', () => {
    const casos = {
      [`/${T}/visao-geral/operacional`]: 'dashOperacional',
      [`/${T}/visao-geral`]: 'dashOperacional',
      [`/${T}/visao-geral/crm`]: 'dashCrm',
      [`/${T}/visao-geral/gerencial`]: 'dashGerencial',
      [`/${T}/pipeline`]: 'kanban',
      [`/${T}/clientes`]: 'clientes',
      [`/${T}/meta-diaria`]: 'dailyGoal',
      [`/${T}/leads`]: 'leads',
      [`/${T}/leads/aulas`]: 'aulas',
      [`/${T}/leads/visitas`]: 'visitas',
      [`/${T}/configuracoes`]: 'settings',
      [`/${T}/perfil-da-academia`]: 'profile',
      [`/${T}/plano-e-faturas`]: 'billing',
      [`/${T}/super-admin`]: 'superadmin',
      [`/${T}/ficha/Ab12`]: 'ficha',
    };
    for (const [p, screen] of Object.entries(casos)) {
      expect(parseAppPath(p), p).toMatchObject({ tenantSlug: T, screen, unknown: false });
    }
  });

  it('subabas do super-admin', () => {
    expect(parseAppPath(`/${T}/super-admin`).superTab).toBe('overview');
    expect(parseAppPath(`/${T}/super-admin/visao-geral`).superTab).toBe('overview');
    expect(parseAppPath(`/${T}/super-admin/clientes`).superTab).toBe('clients');
    expect(parseAppPath(`/${T}/super-admin/financeiro`).superTab).toBe('finance');
    expect(parseAppPath(`/${T}/super-admin/PLANOS`).superTab).toBe('plans');
  });

  it('segmento de tela ignora caixa; id da ficha não', () => {
    expect(parseAppPath(`/${T}/PIPELINE`).screen).toBe('kanban');
    expect(parseAppPath(`/${T}/Leads/Aulas`).screen).toBe('aulas');
    expect(parseAppPath(`/${T}/Ficha/AbC123xyz`)).toMatchObject({ screen: 'ficha', leadId: 'AbC123xyz' });
  });

  it('ficha: id decodificado; sem id ou com id inválido é não encontrada, não desconhecido', () => {
    expect(parseAppPath(`/${T}/ficha/Jo%C3%A3o%20Silva`).leadId).toBe('João Silva');
    expect(parseAppPath(`/${T}/ficha/100%25`).leadId).toBe('100%');
    for (const p of [`/${T}/ficha`, `/${T}/ficha/a%2Fb`, `/${T}/ficha/%2E%2E`, `/${T}/ficha/__x__`, `/${T}/ficha/%E0%A4%A`]) {
      expect(parseAppPath(p), p).toMatchObject({ tenantSlug: T, screen: 'ficha', leadId: null, unknown: false });
    }
  });

  it('segmento malformado invalida só ele mesmo', () => {
    expect(parseAppPath(`/${T}/%E0%A4%A`)).toMatchObject({ tenantSlug: T, screen: null, unknown: true });
    expect(parseAppPath('/%E0%A4%A/pipeline')).toMatchObject({ tenantSlug: null, screen: null, unknown: true });
    expect(parseAppPath(`/${T}/configuracoes/%E0%A4%A`)).toMatchObject({ screen: 'settings', rest: [null] });
  });

  it('telas-folha guardam o resto para a entrega 2', () => {
    expect(parseAppPath(`/${T}/configuracoes/equipe`)).toMatchObject({ screen: 'settings', rest: ['equipe'] });
    expect(parseAppPath(`/${T}/meta-diaria/equipe`)).toMatchObject({ screen: 'dailyGoal', rest: ['equipe'] });
    expect(parseAppPath(`/${T}/pipeline/a/b`)).toMatchObject({ screen: 'kanban', rest: ['a', 'b'] });
    expect(parseAppPath(`/${T}/ficha/Ab12/contratos`)).toMatchObject({ screen: 'ficha', leadId: 'Ab12', rest: ['contratos'] });
  });

  it('grupo com filho desconhecido ou segmento a mais é endereço desconhecido', () => {
    for (const p of [
      `/${T}/leads/visita`, `/${T}/visao-geral/financeiro`, `/${T}/super-admin/xyz`,
      `/${T}/leads/aulas/x`, `/${T}/visao-geral/crm/x`, `/${T}/super-admin/planos/x`, `/${T}/xyz`,
    ]) {
      expect(parseAppPath(p), p).toMatchObject({ tenantSlug: T, screen: null, unknown: true });
    }
  });

  it('nome de propriedade do JavaScript não vira tela', () => {
    for (const p of [
      `/${T}/constructor`, `/${T}/__proto__`, `/${T}/toString`, `/${T}/leads/constructor`,
      `/${T}/visao-geral/__proto__`, `/${T}/super-admin/hasOwnProperty`,
    ]) {
      expect(parseAppPath(p), p).toMatchObject({ screen: null, unknown: true });
    }
  });

  it('palavra de tela no começo é tela sem academia', () => {
    expect(parseAppPath('/pipeline')).toMatchObject({ tenantSlug: null, screen: 'kanban', unknown: false });
    expect(parseAppPath('/Pipeline')).toMatchObject({ tenantSlug: null, screen: 'kanban' });
    expect(parseAppPath('/visao-geral/crm')).toMatchObject({ tenantSlug: null, screen: 'dashCrm' });
    expect(parseAppPath('/ficha/Ab12')).toMatchObject({ tenantSlug: null, screen: 'ficha', leadId: 'Ab12' });
    expect(parseAppPath('/super-admin/planos')).toMatchObject({ tenantSlug: null, screen: 'superadmin', superTab: 'plans' });
    for (const seg of FIRST_LEVEL_SEGMENTS) expect(parseAppPath(`/${seg}`).tenantSlug, seg).toBeNull();
  });

  it('palavra reservada que não é tela e 1º segmento fora do formato: sem academia e desconhecido', () => {
    for (const p of ['/api', '/assets/index.js', '/i/stronix-crm-app', '/console', '/Foo_Bar/pipeline', '/-abc']) {
      expect(parseAppPath(p), p).toMatchObject({ tenantSlug: null, screen: null, unknown: true });
    }
  });

  it('guarda o caminho original', () => {
    expect(parseAppPath('/STRONIX-CRM-APP/Pipeline').pathname).toBe('/STRONIX-CRM-APP/Pipeline');
  });
});

describe('hrefFor', () => {
  it('monta os endereços da tabela', () => {
    expect(hrefFor(T, 'dashboard')).toBe(`/${T}`);
    expect(hrefFor(T, 'dashOperacional')).toBe(`/${T}`);
    expect(hrefFor(T, 'dashCrm')).toBe(`/${T}/visao-geral/crm`);
    expect(hrefFor(T, 'kanban')).toBe(`/${T}/pipeline`);
    expect(hrefFor(T, 'aulas')).toBe(`/${T}/leads/aulas`);
    expect(hrefFor(T, 'billing')).toBe(`/${T}/plano-e-faturas`);
    expect(hrefFor(T, 'ficha', { leadId: 'Ab12' })).toBe(`/${T}/ficha/Ab12`);
    expect(hrefFor(T, 'superadmin')).toBe(`/${T}/super-admin/visao-geral`);
    expect(hrefFor(T, 'superadmin', { superTab: 'plans' })).toBe(`/${T}/super-admin/planos`);
    expect(hrefFor(T, 'superadmin', { superTab: 'xyz' })).toBe(`/${T}/super-admin/visao-geral`);
  });

  it('codifica o id da ficha', () => {
    expect(hrefFor(T, 'ficha', { leadId: 'João Silva' })).toBe(`/${T}/ficha/Jo%C3%A3o%20Silva`);
    expect(hrefFor(T, 'ficha', { leadId: '100%' })).toBe(`/${T}/ficha/100%25`);
    expect(hrefFor(T, 'ficha', { leadId: 'x?y#z' })).toBe(`/${T}/ficha/x%3Fy%23z`);
  });

  it('aceita academia fora do formato, com encode, para o link nunca sair quebrado', () => {
    expect(hrefFor('Academia_Legada', 'kanban')).toBe('/Academia_Legada/pipeline');
    expect(hrefFor('a b', 'clientes')).toBe('/a%20b/clientes');
  });

  it('tela desconhecida vira a inicial', () => {
    expect(hrefFor(T, 'nao-existe')).toBe(`/${T}`);
    expect(hrefFor(T, 'constructor')).toBe(`/${T}`);
    expect(hrefFor(T, undefined)).toBe(`/${T}`);
  });

  it('null quando não dá para montar', () => {
    expect(hrefFor('', 'kanban')).toBeNull();
    expect(hrefFor(null, 'kanban')).toBeNull();
    expect(hrefFor(undefined, 'kanban')).toBeNull();
    expect(hrefFor(T, 'ficha')).toBeNull();
    expect(hrefFor(T, 'ficha', { leadId: 'a/b' })).toBeNull();
    expect(hrefFor(T, 'ficha', { leadId: MEIO_EMOJI })).toBeNull();
  });

  it('terceiro argumento nulo não quebra', () => {
    expect(hrefFor(T, 'kanban', null)).toBe(`/${T}/pipeline`);
  });
});

describe('ida e volta hrefFor e parseAppPath', () => {
  it('toda tela volta como ela mesma (o Operacional volta como a tela inicial)', () => {
    for (const screen of TELAS) {
      const extra = screen === 'ficha' ? { leadId: 'Ab12' } : {};
      const href = hrefFor(T, screen, extra);
      const volta = parseAppPath(href);
      expect(volta.tenantSlug, href).toBe(T);
      expect(volta.unknown, href).toBe(false);
      expect(volta.screen, href).toBe(screen === 'dashOperacional' ? 'dashboard' : screen);
    }
  });

  it('toda subaba do super-admin volta igual', () => {
    for (const superTab of Object.keys(SUPER_TABS)) {
      const volta = parseAppPath(hrefFor(T, 'superadmin', { superTab }));
      expect(volta).toMatchObject({ screen: 'superadmin', superTab });
    }
  });

  it('id com espaço, acento, %, ?, # e emoji volta igual', () => {
    const ids = ['Ab12', 'João Silva', 'ação', '100%', '%41', 'a%2Fb', 'x?y#z', 'emoji 😀', '...', 'a'.repeat(128)];
    for (const leadId of ids) {
      const href = hrefFor(T, 'ficha', { leadId });
      expect(parseAppPath(href), leadId).toMatchObject({ tenantSlug: T, screen: 'ficha', leadId });
    }
  });

  it('as cinco academias de produção voltam iguais', () => {
    for (const t of ['academia-power-club', 'academia-shape-one', 'academia-teste', 'petros-barbell-club', 'stronix-crm-app']) {
      expect(parseAppPath(hrefFor(t, 'kanban'))).toMatchObject({ tenantSlug: t, screen: 'kanban' });
    }
  });
});

describe('canGoBackInApp', () => {
  it('só com idx inteiro maior que zero', () => {
    expect(canGoBackInApp({ idx: 1 })).toBe(true);
    expect(canGoBackInApp({ usr: null, key: 'x9k2', idx: 4 })).toBe(true);
    // Aba nova depois do replace da correção de endereço: key nova, idx 0.
    expect(canGoBackInApp({ key: 'x9k2', idx: 0 })).toBe(false);
    for (const s of [null, undefined, {}, { idx: '2' }, { idx: 1.5 }, { idx: -1 }]) {
      expect(canGoBackInApp(s), JSON.stringify(s)).toBe(false);
    }
  });
});

// Contrato do idx: o Voltar da ficha depende do idx que o React Router grava em
// window.history.state. Ele é detalhe interno da biblioteca, então este teste
// roda o createBrowserHistory de verdade (o mesmo que o <BrowserRouter> usa,
// com v5Compat) contra uma janela falsa. Se quebrar depois de atualizar o
// react-router, confira o getUrlBasedHistory da versão nova antes de mexer no
// teste: com o idx errado, o Voltar cai sempre na lista de reserva.
function janelaFalsa(caminho) {
  const origem = 'https://stronilead.com.br';
  const entradas = [{ state: null }];
  let atual = 0;
  const location = { origin: origem, href: origem + caminho, pathname: caminho, search: '', hash: '' };
  const irPara = (url) => {
    if (!url) return;
    const u = new URL(url, origem);
    Object.assign(location, { href: u.href, pathname: u.pathname, search: u.search, hash: u.hash });
  };
  const history = {
    get state() { return entradas[atual].state; },
    get length() { return entradas.length; },
    // Igual ao navegador: o state é copiado, e o push descarta o "avançar".
    pushState(state, _titulo, url) {
      entradas.splice(atual + 1);
      entradas.push({ state: structuredClone(state) });
      atual += 1;
      irPara(url);
    },
    replaceState(state, _titulo, url) {
      entradas[atual] = { state: structuredClone(state) };
      irPara(url);
    },
    go() {},
  };
  return { location, history, addEventListener() {}, removeEventListener() {} };
}

describe('contrato do idx com o react-router instalado', () => {
  const historico = (janela) => UNSAFE_createBrowserHistory({ window: janela, v5Compat: true });

  it('a carga grava idx 0 sem trocar o endereço', () => {
    const w = janelaFalsa(`/${T}/pipeline`);
    historico(w);
    expect(w.history.state.idx).toBe(0);
    expect(w.location.pathname).toBe(`/${T}/pipeline`);
    expect(canGoBackInApp(w.history.state)).toBe(false);
  });

  it('o push soma 1 e leva o state da tela de origem', () => {
    const w = janelaFalsa(`/${T}/pipeline`);
    const h = historico(w);
    h.push(`/${T}/ficha/Ab12`, { from: 'kanban' });
    expect(w.history.state.idx).toBe(1);
    expect(w.history.state.usr).toEqual({ from: 'kanban' });
    expect(w.location.pathname).toBe(`/${T}/ficha/Ab12`);
    expect(canGoBackInApp(w.history.state)).toBe(true);
  });

  it('o replace mantém o idx, mesmo trocando a key', () => {
    const w = janelaFalsa('/');
    const h = historico(w);
    expect(h.location.key).toBe('default');
    h.replace(`/${T}`); // a correção de / para /<academia> numa aba nova
    expect(h.location.key).not.toBe('default');
    expect(w.history.state.idx).toBe(0);
    expect(canGoBackInApp(w.history.state)).toBe(false);
    h.push(`/${T}/clientes`);
    h.replace(`/${T}/clientes`);
    expect(w.history.state.idx).toBe(1);
  });

  it('o F5 mantém o idx da entrada', () => {
    const w = janelaFalsa(`/${T}/pipeline`);
    historico(w).push(`/${T}/ficha/Ab12`, { from: 'kanban' });
    historico(w); // a página carrega de novo na mesma entrada
    expect(w.history.state.idx).toBe(1);
    expect(w.history.state.usr).toEqual({ from: 'kanban' });
  });
});
```

- [ ] **Step 2: Acrescentar a guarda das telas ao teste da `tenantSlug`**

Em `src/lib/__tests__/tenantSlug.test.js`, o import. Antes:

```js
import {
  TENANT_SLUG_READ_RE, TENANT_SLUG_CREATE_RE, RESERVED_TENANT_SLUGS,
  isReservedTenantSlug, tenantSlugProblem,
} from '../tenantSlug.js';
```

Depois:

```js
import {
  TENANT_SLUG_READ_RE, TENANT_SLUG_CREATE_RE, RESERVED_TENANT_SLUGS,
  isReservedTenantSlug, tenantSlugProblem,
} from '../tenantSlug.js';
import { FIRST_LEVEL_SEGMENTS } from '../routes.js';
```

E no fim do arquivo, depois do último `});`, acrescente:

```js
describe('guarda das telas', () => {
  it('todo primeiro segmento de tela está reservado (tela nova sem reserva quebra aqui)', () => {
    expect(FIRST_LEVEL_SEGMENTS.length).toBeGreaterThan(0);
    for (const seg of FIRST_LEVEL_SEGMENTS) expect(isReservedTenantSlug(seg), seg).toBe(true);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/routes.test.js src/lib/__tests__/tenantSlug.test.js 2>&1 | tail -8
```

Esperado: os dois arquivos em `FAIL` com `Error: Cannot find module '../routes.js'`.

- [ ] **Step 4: Criar `src/lib/routes.js` (parte 1)**

```js
// Endereços do app. Tabela única das telas e as regras de ler e montar
// endereço. Puro de propósito (sem React, sem Firebase, sem window): o App lê o
// endereço com parseAppPath e monta link com hrefFor, e tudo isso roda em teste
// no node.
//
// Regras que não podem mudar:
// - O endereço nunca escolhe a academia dos dados. Quem escolhe é o claim
//   tenantId da sessão. O slug do endereço só é conferido contra ele.
// - Nome, telefone, CPF e texto de busca nunca entram no endereço. A ficha leva
//   só o id do documento (isValidLeadId).
// - Parâmetro de query novo nunca pode se chamar invite, t ou ref: o App decide
//   o convite e a indicação pública por eles, antes do roteador.
// - Tela nova com primeiro segmento novo entra também em RESERVED_TENANT_SLUGS
//   (src/lib/tenantSlug.js). O tenantSlug.test.js quebra se faltar.

import { TENANT_SLUG_READ_RE, isReservedTenantSlug } from './tenantSlug.js';

const own = (obj, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key);

// Tela do endereço curto /<academia>. Mostra o Operacional.
export const HOME_SCREEN = 'dashboard';

const tela = (segs, title, trava = {}) => Object.freeze({ segs: Object.freeze(segs), title, ...trava });

// id da tela (os mesmos valores de activeTab de sempre) para os segmentos
// depois da academia, o título da aba e a trava de acesso.
export const SCREENS = Object.freeze({
  dashboard: tela([], 'Visão geral'),
  dashOperacional: tela(['visao-geral', 'operacional'], 'Operacional'),
  dashCrm: tela(['visao-geral', 'crm'], 'CRM'),
  dashGerencial: tela(['visao-geral', 'gerencial'], 'Gerencial'),
  kanban: tela(['pipeline'], 'Pipeline'),
  clientes: tela(['clientes'], 'Clientes'),
  dailyGoal: tela(['meta-diaria'], 'Meta diária'),
  leads: tela(['leads'], 'Leads'),
  aulas: tela(['leads', 'aulas'], 'Aulas'),
  visitas: tela(['leads', 'visitas'], 'Visitas'),
  settings: tela(['configuracoes'], 'Configurações', { gestor: true }),
  profile: tela(['perfil-da-academia'], 'Perfil da academia', { gestor: true }),
  billing: tela(['plano-e-faturas'], 'Plano e faturas', { gestor: true }),
  superadmin: tela(['super-admin'], 'Super-admin', { superAdmin: true }),
  ficha: tela(['ficha'], 'Ficha'),
});

// Subabas do super-admin membro de academia: id interno para o segmento.
export const SUPER_TABS = Object.freeze({ overview: 'visao-geral', clients: 'clientes', finance: 'financeiro', plans: 'planos' });
const SUPER_TAB_BY_SEGMENT = Object.fromEntries(Object.entries(SUPER_TABS).map(([id, seg]) => [seg, id]));

// Primeiro segmento de cada tela. Todos precisam estar reservados.
export const FIRST_LEVEL_SEGMENTS = Object.freeze([
  ...new Set(Object.values(SCREENS).map((s) => s.segs[0]).filter(Boolean)),
]);

// Índices de leitura, tirados de SCREENS para a tabela morar num lugar só.
// LEAVES: telas de um segmento que aceitam segmentos a mais (vão para `rest`,
// a vaga da entrega 2: /configuracoes/equipe, /ficha/<id>/contratos).
// GROUPS: o segundo segmento escolhe a tela, e filho desconhecido é endereço
// desconhecido, para erro de digitação não cair calado na tela-mãe.
const SPECIAL = new Set(['ficha', 'superadmin']);
const LEAVES = {};
const GROUPS = {};
for (const [id, def] of Object.entries(SCREENS)) {
  if (def.segs.length !== 2) continue;
  if (!own(GROUPS, def.segs[0])) GROUPS[def.segs[0]] = { alone: null, children: {} };
  GROUPS[def.segs[0]].children[def.segs[1]] = id;
}
for (const [id, def] of Object.entries(SCREENS)) {
  if (def.segs.length !== 1 || SPECIAL.has(id)) continue;
  if (own(GROUPS, def.segs[0])) GROUPS[def.segs[0]].alone = id;
  else LEAVES[def.segs[0]] = id;
}
// /visao-geral sozinho abre o Operacional.
GROUPS['visao-geral'].alone = 'dashOperacional';

// Regra do Firestore para id de documento, com teto de 128 caracteres. É o
// único validador de id de lead do app: quem monta e quem lê o endereço usam
// este mesmo.
const CONTROL_CHAR_RE = /\p{Cc}/u;
export function isValidLeadId(id) {
  return typeof id === 'string'
    && id.length >= 1
    && id.length <= 128
    && !id.includes('/')
    && id !== '.'
    && id !== '..'
    && !/^__.*__$/.test(id)
    && !CONTROL_CHAR_RE.test(id);
}

// Segmentos crus do caminho, sem os vazios de barra dupla ou final.
const rawSegments = (pathname) => String(pathname ?? '').split('/').filter(Boolean);

// Segmento malformado (% quebrado) vira null e invalida só ele mesmo.
const decodeSegment = (raw) => {
  try { return decodeURIComponent(raw); } catch { return null; }
};

const lower = (s) => (typeof s === 'string' ? s.toLowerCase() : null);

// Lê a tela a partir dos segmentos depois da academia (ou do começo, na tela
// sem academia). Segmento de tela ignora caixa; o id da ficha não, porque id
// do Firestore diferencia maiúscula.
function readScreen(segs, out) {
  const head = lower(segs[0]);
  if (head === 'ficha') {
    out.screen = 'ficha';
    out.leadId = isValidLeadId(segs[1]) ? segs[1] : null;
    out.rest = segs.slice(2);
    return;
  }
  if (head === 'super-admin') {
    const child = lower(segs[1]);
    const tab = segs.length === 1 ? 'overview'
      : (segs.length === 2 && own(SUPER_TAB_BY_SEGMENT, child) ? SUPER_TAB_BY_SEGMENT[child] : null);
    if (tab) {
      out.screen = 'superadmin';
      out.superTab = tab;
    } else {
      out.unknown = true;
    }
    return;
  }
  if (own(GROUPS, head)) {
    const { alone, children } = GROUPS[head];
    const child = lower(segs[1]);
    const screen = segs.length === 1 ? alone
      : (segs.length === 2 && own(children, child) ? children[child] : null);
    if (screen) out.screen = screen;
    else out.unknown = true;
    return;
  }
  if (own(LEAVES, head)) {
    out.screen = LEAVES[head];
    out.rest = segs.slice(1);
    return;
  }
  out.unknown = true;
}

// parseAppPath('/stronix-crm-app/ficha/AbC') →
//   { pathname, tenantSlug, screen, leadId, superTab, rest, unknown }
// - raiz: tudo null e unknown false;
// - tenantSlug: o 1º segmento em minúsculas quando tem formato de academia e
//   não é palavra reservada. Senão fica null e o 1º segmento é lido como tela
//   (tela sem academia, como /pipeline);
// - ficha com id inválido ou sem id: screen 'ficha' e leadId null, que é
//   "ficha não encontrada" e não endereço desconhecido.
export function parseAppPath(pathname) {
  const out = {
    pathname: typeof pathname === 'string' ? pathname : '',
    tenantSlug: null, screen: null, leadId: null, superTab: null, rest: [], unknown: false,
  };
  const segs = rawSegments(pathname).map(decodeSegment);
  if (segs.length === 0) return out;
  const first = lower(segs[0]);
  if (first !== null && TENANT_SLUG_READ_RE.test(first) && !isReservedTenantSlug(first)) {
    out.tenantSlug = first;
    if (segs.length === 1) {
      out.screen = HOME_SCREEN;
      return out;
    }
    readScreen(segs.slice(1), out);
    return out;
  }
  readScreen(segs, out);
  return out;
}

const encode = (s) => {
  try { return encodeURIComponent(s); } catch { return null; }
};

// hrefFor('stronix-crm-app', 'kanban') → '/stronix-crm-app/pipeline'.
// Aceita qualquer academia não vazia, com encode, para o link nunca sair
// quebrado; academia com id fora do formato de leitura fica sempre no
// Operacional, porque o endereço não relê o id (hoje nenhuma está nesse caso,
// e a validação do tenantSlug.js impede criar outra). null quando não dá para
// montar (sem academia, ficha sem id válido): quem chama não navega. Tela
// desconhecida vira a inicial.
export function hrefFor(tenantId, screen, opts = {}) {
  const { leadId, superTab } = opts || {};
  if (typeof tenantId !== 'string' || tenantId === '') return null;
  const t = encode(tenantId);
  if (t === null) return null;
  const base = `/${t}`;
  if (!own(SCREENS, screen) || screen === HOME_SCREEN || screen === 'dashOperacional') return base;
  if (screen === 'ficha') {
    const id = isValidLeadId(leadId) ? encode(leadId) : null;
    return id === null ? null : `${base}/ficha/${id}`;
  }
  if (screen === 'superadmin') {
    return `${base}/super-admin/${own(SUPER_TABS, superTab) ? SUPER_TABS[superTab] : SUPER_TABS.overview}`;
  }
  return `${base}/${SCREENS[screen].segs.join('/')}`;
}

// O Voltar da ficha só volta pelo navegador quando há tela do app antes dela
// nesta aba. Quem diz isso é o idx que o React Router grava em
// window.history.state: 0 na primeira entrada da aba, +1 a cada push, igual no
// replace. location.key não serve, porque o replace da correção de endereço
// troca a key e mantém o idx. O routes.test.js trava esse contrato na versão
// instalada do react-router.
export function canGoBackInApp(historyState) {
  return Number.isInteger(historyState?.idx) && historyState.idx > 0;
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/routes.test.js src/lib/__tests__/tenantSlug.test.js 2>&1 | tail -4
```

Esperado: `Tests  49 passed (49)` (35 do `routes.test.js` e 14 do `tenantSlug.test.js`).

- [ ] **Step 6: Suite inteira e lint**

```bash
npx vitest run 2>&1 | tail -4
npm run lint 2>&1 | tail -2
```

Esperado: `Test Files  89 passed (89)` e `Tests  1881 passed (1881)` (1845 + 36); `✖ 1 problem (0 errors, 1 warning)`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/routes.js src/lib/__tests__/routes.test.js src/lib/__tests__/tenantSlug.test.js
git commit -F - <<'EOF'
feat: tabela de telas e leitura do endereço em routes.js

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 4: `routes.js`, parte 2 (acesso, decisão de rota, Voltar, chave, título, molde e rolagem)

**Por que:** o App roda `routeDecision` a cada render e desenha `target` já no mesmo render, então a regra precisa ser pura, testada e sem laço. Pontos em que o código abaixo detalha o contrato, todos cobertos por teste:

- **Trava contra laço antes da regra 3.** O contrato põe a trava na regra 5, mas a regra 3 também redireciona pelo slug: numa sessão assumida de academia com id fora do formato, o `RouteRedirect` (montado com `key={location.key}`) remontaria a cada replace para sempre. A trava roda logo depois da regra 2 e vale para 3 a 7. Para as cinco academias de hoje não muda nada.
- **Regra 4 sem armadilha.** O `returnTo` só vale quando `fromTenant` é diferente da academia da sessão (senão ele puxaria a pessoa de volta a cada navegação dentro da própria academia), o caminho guardado é limpo para uma barra só (o `navigate` recusa `//host` com "External navigation is not allowed", `chunk-OB3PAWPO.mjs:1378`) e só é usado se a decisão sobre ele for `ok`.
- **Regra 5 já sai com 6 e 7 aplicadas ao endereço corrigido.** Consultor em `/configuracoes` vai direto para `/<t>` com o aviso "Essa tela é só do gestor.", em vez de passar por `/<t>/configuracoes`. O resultado para a pessoa é o mesmo do contrato em dois passos, sem desenhar a tela proibida por um render e com a garantia testada de que o destino de todo redirect é aceito de primeira.
- **Regra 5 mantém os segmentos crus.** Mesma academia com outra caixa troca só o slug; tela sem academia ganha a academia na frente (`/Pipeline` vira `/<t>/Pipeline`, que abre o Pipeline); outra academia mantém a tela e o `rest` e descarta ficha e super-admin. Caminho sem academia que não é tela (`/assets`, `/Foo_Bar/x`) vai para `/<t>` sem aviso.
- `routeTemplate` deixa o `rest` de fora, porque na entrega 2 ele pode levar dado.
- `screenKey` deixa de fora o `rest` e a subaba do super-admin. A chave vira a `key` do `AppErrorBoundary` (T10), e com a subaba nela cada clique em Visão Geral, Clientes, Financeiro ou Planos remontaria o `SuperAdminView`, que busca `/api/super-overview` e `/api/plans` ao montar e guarda a busca e os filtros em memória. Trocar de subaba também não leva a rolagem ao topo, igual à main.
- `scrollActionFor` devolve `none` quando não há tela anterior (a primeira tela da aba).

Depende da T3.

**Files:**
- Modify: `src/lib/routes.js` (import no topo; bloco novo no fim)
- Create: `src/lib/__tests__/routes.decision.test.js`

- [ ] **Step 1: Escrever o teste da parte 2**

Crie `src/lib/__tests__/routes.decision.test.js` (arquivo separado, no padrão `crm.metrics.test.js` do repo, para a T3 não precisar ser editada):

```js
import { describe, it, expect } from 'vitest';
import {
  SCREENS, parseAppPath, canAccess, routeDecision, ROUTE_NOTICES,
  backTarget, screenKey, documentTitle, routeTemplate, scrollActionFor,
} from '../routes.js';

const T = 'stronix-crm-app';
const admin = { id: 'u1', role: 'admin', tenantId: T };
const consultor = { id: 'u2', role: 'consultor', tenantId: T };
const superMembro = { id: 'u3', role: 'admin', tenantId: T, superAdmin: true };
const superPuro = { id: 'u4', role: 'admin', superAdmin: true, superAdminOnly: true, tenantId: null };
// "Acessar como" a academia-teste: a sessão assumida é admin de lá, sem superAdmin.
const assumida = { id: 'u5', role: 'admin', tenantId: 'academia-teste', impersonating: true };
const legado = { id: 'u9', role: 'admin', tenantId: 'Academia_Legada' };

const decide = (path, user, opts) => routeDecision(parseAppPath(path), user, opts);
const casa = (to, target, notice = null) => ({ kind: 'redirect', to, target: { leadId: null, superTab: null, ...target }, notice });

describe('canAccess', () => {
  it('telas de gestor só para quem é admin', () => {
    for (const s of ['settings', 'profile', 'billing']) {
      expect(canAccess(s, admin), s).toBe(true);
      expect(canAccess(s, consultor), s).toBe(false);
      expect(canAccess(s, null), s).toBe(false);
    }
  });

  it('super-admin só com o claim, e nunca na sessão assumida', () => {
    expect(canAccess('superadmin', superMembro)).toBe(true);
    expect(canAccess('superadmin', admin)).toBe(false);
    expect(canAccess('superadmin', assumida)).toBe(false);
  });

  it('o resto passa para qualquer um', () => {
    for (const s of ['dashboard', 'dashOperacional', 'dashCrm', 'dashGerencial', 'kanban', 'clientes', 'dailyGoal', 'leads', 'aulas', 'visitas', 'ficha']) {
      expect(canAccess(s, consultor), s).toBe(true);
    }
    expect(canAccess(null, consultor)).toBe(true);
    expect(canAccess('constructor', consultor)).toBe(true);
  });
});

describe('ROUTE_NOTICES', () => {
  it('textos aprovados, sem travessão', () => {
    expect(ROUTE_NOTICES).toEqual({
      'so-gestor': 'Essa tela é só do gestor.',
      'nao-encontrada': 'Não achamos essa tela. Abrimos o Operacional.',
    });
    for (const txt of Object.values(ROUTE_NOTICES)) expect(txt).not.toMatch(/[—–]/);
    expect(Object.isFrozen(ROUTE_NOTICES)).toBe(true);
  });
});

describe('routeDecision 1: sem sessão', () => {
  it('o login aparece em qualquer endereço e não mexe nele', () => {
    for (const p of ['/', `/${T}/configuracoes`, '/outra/ficha/Ab12', '/xyz', '/pipeline']) {
      expect(decide(p, null), p).toEqual({ kind: 'ok' });
    }
  });
});

describe('routeDecision 2: super-admin puro', () => {
  it('o console só existe em /', () => {
    expect(decide('/', superPuro)).toEqual({ kind: 'ok' });
    expect(decide('/', superPuro, { search: '?a=1' })).toEqual({ kind: 'ok' });
    expect(decide(`/${T}/pipeline`, superPuro)).toEqual(casa('/', { screen: null }));
    expect(decide('/academia-teste/super-admin/planos', superPuro)).toEqual(casa('/', { screen: null }));
  });
});

describe('routeDecision 3: sessão assumida', () => {
  it('endereço de outra academia vai para a tela inicial da assumida, sem aviso', () => {
    expect(decide(`/${T}/super-admin/clientes`, assumida)).toEqual(casa('/academia-teste', { screen: 'dashboard' }));
    expect(decide(`/${T}/pipeline`, assumida)).toEqual(casa('/academia-teste', { screen: 'dashboard' }));
    expect(decide('/', assumida)).toEqual(casa('/academia-teste', { screen: 'dashboard' }));
  });

  it('F5 durante a visualização fica onde está', () => {
    expect(decide('/academia-teste/pipeline', assumida)).toEqual({ kind: 'ok' });
    expect(decide('/ACADEMIA-TESTE/pipeline', assumida)).toEqual(casa('/academia-teste/pipeline', { screen: 'kanban' }));
  });

  it('assumiu a própria academia: o super-admin some em silêncio', () => {
    const propria = { ...assumida, tenantId: T };
    expect(decide(`/${T}/super-admin/clientes`, propria)).toEqual(casa(`/${T}`, { screen: 'dashboard' }));
  });
});

describe('routeDecision 4: volta da visualização', () => {
  const returnTo = { fromTenant: 'academia-teste', path: `/${T}/super-admin/clientes` };

  it('ainda no endereço da academia assumida: volta ao caminho guardado', () => {
    expect(decide('/academia-teste/pipeline', superMembro, { returnTo })).toEqual(
      casa(`/${T}/super-admin/clientes`, { screen: 'superadmin', superTab: 'clients' }),
    );
    expect(decide('/academia-teste', superMembro, { returnTo, search: '?a=1' }).to).toBe(`/${T}/super-admin/clientes`);
  });

  it('já na própria academia ou vindo de uma terceira: o caminho guardado não manda', () => {
    expect(decide(`/${T}/pipeline`, superMembro, { returnTo })).toEqual({ kind: 'ok' });
    expect(decide('/terceira/pipeline', superMembro, { returnTo })).toEqual(casa(`/${T}/pipeline`, { screen: 'kanban' }));
  });

  it('caminho guardado de outra academia, que a sessão não vê, ou torto: ignorado', () => {
    const outra = { fromTenant: 'academia-teste', path: '/terceira/pipeline' };
    expect(decide('/academia-teste/pipeline', superMembro, { returnTo: outra })).toEqual(casa(`/${T}/pipeline`, { screen: 'kanban' }));
    const deGestor = { fromTenant: 'academia-teste', path: `/${T}/configuracoes` };
    expect(decide('/academia-teste/pipeline', consultor, { returnTo: deGestor })).toEqual(casa(`/${T}/pipeline`, { screen: 'kanban' }));
    const semPath = { fromTenant: 'academia-teste' };
    expect(decide('/academia-teste/pipeline', superMembro, { returnTo: semPath })).toEqual(casa(`/${T}/pipeline`, { screen: 'kanban' }));
  });

  it('barra dupla no caminho guardado vira uma barra só (o navigate recusa //host)', () => {
    const torto = { fromTenant: 'academia-teste', path: `//${T}//super-admin/planos` };
    expect(decide('/academia-teste', superMembro, { returnTo: torto }).to).toBe(`/${T}/super-admin/planos`);
  });

  it('returnTo da própria academia nunca prende a pessoa numa tela', () => {
    const proprio = { fromTenant: T, path: `/${T}/pipeline` };
    expect(decide(`/${T}/clientes`, superMembro, { returnTo: proprio })).toEqual({ kind: 'ok' });
  });
});

describe('routeDecision 5: endereço sem a academia da sessão', () => {
  it('raiz vai para a tela inicial, mantendo a query', () => {
    expect(decide('/', consultor, { search: '?x=1' })).toEqual(casa(`/${T}?x=1`, { screen: 'dashboard' }));
  });

  it('mesma academia com outra caixa: troca só o slug e mantém o resto', () => {
    expect(decide('/STRONIX-CRM-APP/ficha/AbC', consultor, { search: '?x=1' })).toEqual(
      casa(`/${T}/ficha/AbC?x=1`, { screen: 'ficha', leadId: 'AbC' }),
    );
    expect(decide('/Stronix-Crm-App', consultor)).toEqual(casa(`/${T}`, { screen: 'dashboard' }));
  });

  it('tela sem academia ganha a academia na frente', () => {
    expect(decide('/pipeline', consultor)).toEqual(casa(`/${T}/pipeline`, { screen: 'kanban' }));
    expect(decide('/visao-geral/crm', consultor)).toEqual(casa(`/${T}/visao-geral/crm`, { screen: 'dashCrm' }));
    expect(decide('/ficha/Jo%C3%A3o', consultor)).toEqual(casa(`/${T}/ficha/Jo%C3%A3o`, { screen: 'ficha', leadId: 'João' }));
    expect(decide('/super-admin/planos', superMembro)).toEqual(casa(`/${T}/super-admin/planos`, { screen: 'superadmin', superTab: 'plans' }));
  });

  it('outra academia: mantém a tela e descarta ficha e super-admin', () => {
    expect(decide('/outra/pipeline', consultor)).toEqual(casa(`/${T}/pipeline`, { screen: 'kanban' }));
    expect(decide('/outra/leads/aulas', consultor)).toEqual(casa(`/${T}/leads/aulas`, { screen: 'aulas' }));
    expect(decide('/outra/configuracoes/equipe', admin)).toEqual(casa(`/${T}/configuracoes/equipe`, { screen: 'settings' }));
    expect(decide('/outra/ficha/AbC', consultor)).toEqual(casa(`/${T}`, { screen: 'dashboard' }));
    expect(decide('/outra/super-admin/planos', superMembro)).toEqual(casa(`/${T}`, { screen: 'dashboard' }));
    expect(decide('/outra', consultor, { search: '?x=1' })).toEqual(casa(`/${T}?x=1`, { screen: 'dashboard' }));
  });

  it('palavra reservada que não é tela e endereço torto sem academia: tela inicial, sem aviso', () => {
    for (const p of ['/assets', '/api/x', '/Foo_Bar/pipeline', '/outra/xyz', '/%E0%A4%A']) {
      expect(decide(p, consultor), p).toEqual(casa(`/${T}`, { screen: 'dashboard' }));
    }
  });

  it('endereço corrigido que cai numa tela de gestor já sai com o aviso, sem passo intermediário', () => {
    expect(decide('/configuracoes', consultor, { search: '?x=1' })).toEqual(casa(`/${T}`, { screen: 'dashboard' }, 'so-gestor'));
    expect(decide('/outra/plano-e-faturas', consultor)).toEqual(casa(`/${T}`, { screen: 'dashboard' }, 'so-gestor'));
  });
});

describe('routeDecision 6: trava de acesso', () => {
  it('consultor em tela de gestor cai no Operacional com aviso', () => {
    for (const p of [`/${T}/configuracoes`, `/${T}/perfil-da-academia`, `/${T}/plano-e-faturas`, `/${T}/configuracoes/equipe`]) {
      expect(decide(p, consultor, { search: '?x=1' }), p).toEqual(casa(`/${T}`, { screen: 'dashboard' }, 'so-gestor'));
    }
  });

  it('super-admin sem o claim cai no Operacional sem aviso', () => {
    expect(decide(`/${T}/super-admin/planos`, admin)).toEqual(casa(`/${T}`, { screen: 'dashboard' }));
  });

  it('quem pode, fica', () => {
    expect(decide(`/${T}/configuracoes`, admin)).toEqual({ kind: 'ok' });
    expect(decide(`/${T}/super-admin/planos`, superMembro)).toEqual({ kind: 'ok' });
    expect(decide(`/${T}/ficha/Ab12`, consultor)).toEqual({ kind: 'ok' });
    expect(decide(`/${T}`, consultor)).toEqual({ kind: 'ok' });
  });
});

describe('routeDecision 7: endereço desconhecido', () => {
  it('tela inicial com aviso', () => {
    for (const p of [`/${T}/xyz`, `/${T}/leads/visita`, `/${T}/constructor`, `/${T}/%E0%A4%A`, `/${T}/leads/aulas/x`]) {
      expect(decide(p, admin), p).toEqual(casa(`/${T}`, { screen: 'dashboard' }, 'nao-encontrada'));
    }
  });

  it('ficha sem id ou com id inválido não é desconhecido: a ficha mostra "não encontrada"', () => {
    expect(decide(`/${T}/ficha`, consultor)).toEqual({ kind: 'ok' });
    expect(decide(`/${T}/ficha/a%2Fb`, consultor)).toEqual({ kind: 'ok' });
  });
});

describe('routeDecision: trava contra laço', () => {
  it('academia com id que não relê como ela mesma: o endereço não manda em nada', () => {
    for (const p of ['/', '/academia_legada/pipeline', `/${T}/configuracoes`, '/xyz']) {
      expect(decide(p, legado), p).toEqual({ kind: 'ok' });
      expect(decide(p, { ...legado, impersonating: true }), p).toEqual({ kind: 'ok' });
    }
    expect(decide('/', { id: 'u', role: 'admin', tenantId: 'pipeline' })).toEqual({ kind: 'ok' });
    expect(decide('/', { id: 'u', role: 'admin' })).toEqual({ kind: 'ok' });
  });

  it('o destino de todo redirect é aceito de primeira, com o alvo certo e visível', () => {
    const caminhos = [
      '/', '/outra', `/${T}/xyz`, `/${T}/configuracoes`, `/${T}/super-admin/planos`, `/${T}/ficha/a%2Fb`,
      '/Foo_Bar/pipeline', '/outra/ficha/Ab12', `/${T}/leads/visita`, '/pipeline', '/configuracoes',
      '/STRONIX-CRM-APP/leads/aulas', '/academia-teste/pipeline', '/api', '/%E0%A4%A', `//${T}//pipeline`,
    ];
    const retornos = [null, { fromTenant: 'academia-teste', path: `/${T}/super-admin/clientes` }];
    for (const user of [admin, consultor, superMembro, superPuro, assumida, legado]) {
      for (const returnTo of retornos) {
        for (const p of caminhos) {
          const d = decide(p, user, { search: '?a=1', returnTo });
          if (d.kind !== 'redirect') continue;
          const rotulo = `${user.id} ${p} -> ${d.to}`;
          expect(d.to.startsWith('//'), rotulo).toBe(false);
          const [path] = d.to.split('?');
          expect(decide(path, user, { returnTo }), rotulo).toEqual({ kind: 'ok' });
          const destino = parseAppPath(path);
          expect(d.target, rotulo).toEqual({ screen: destino.screen, leadId: destino.leadId, superTab: destino.superTab });
          if (d.target.screen) expect(canAccess(d.target.screen, user), rotulo).toBe(true);
        }
      }
    }
  });
});

describe('backTarget', () => {
  it('com tela do app antes: voltar do navegador', () => {
    expect(backTarget({ historyState: { idx: 3 }, isClient: true, tenantId: T })).toEqual({ type: 'back' });
  });

  it('aba nova: Clientes para cliente, Pipeline para lead', () => {
    expect(backTarget({ historyState: { idx: 0 }, isClient: true, tenantId: T })).toEqual({ type: 'replace', href: `/${T}/clientes` });
    expect(backTarget({ historyState: null, isClient: false, tenantId: T })).toEqual({ type: 'replace', href: `/${T}/pipeline` });
  });

  it('academia fora do formato ainda tem para onde voltar', () => {
    expect(backTarget({ historyState: { idx: 0 }, isClient: false, tenantId: 'Academia_Legada' })).toEqual({ type: 'replace', href: '/Academia_Legada/pipeline' });
  });
});

describe('screenKey', () => {
  it('/<academia> e /visao-geral/operacional são a mesma tela', () => {
    expect(screenKey(parseAppPath(`/${T}`))).toBe('dashOperacional');
    expect(screenKey(parseAppPath(`/${T}/visao-geral/operacional`))).toBe('dashOperacional');
  });

  it('o resto e a subaba do super-admin não trocam a chave; outra ficha troca', () => {
    expect(screenKey(parseAppPath(`/${T}/configuracoes/equipe`))).toBe('settings');
    expect(screenKey(parseAppPath(`/${T}/ficha/a`))).toBe('ficha:a');
    expect(screenKey(parseAppPath(`/${T}/ficha/a`))).not.toBe(screenKey(parseAppPath(`/${T}/ficha/b`)));
    expect(screenKey(parseAppPath(`/${T}/super-admin/planos`))).toBe('superadmin');
    expect(screenKey(parseAppPath(`/${T}/super-admin/clientes`))).toBe('superadmin');
  });

  it('alvo de redirect e tela vazia', () => {
    expect(screenKey({ screen: 'kanban', leadId: null, superTab: null })).toBe('kanban');
    expect(screenKey({ screen: null })).toBe('dashboard');
    expect(screenKey(null)).toBe('dashboard');
  });
});

describe('documentTitle', () => {
  it('tela, academia e marca', () => {
    expect(documentTitle({ screen: 'dailyGoal', tenantName: 'STRONIX' })).toBe('Meta diária · STRONIX · STRONILEAD');
    expect(documentTitle({ screen: 'ficha', tenantName: 'STRONIX' })).toBe('Ficha · STRONIX · STRONILEAD');
    expect(documentTitle({ screen: 'kanban' })).toBe('Pipeline · STRONILEAD');
  });

  it('antes do login fica igual a hoje', () => {
    expect(documentTitle({ tenantName: 'STRONIX' })).toBe('STRONIX · STRONILEAD');
    expect(documentTitle({})).toBe('STRONILEAD');
    expect(documentTitle()).toBe('STRONILEAD');
    expect(documentTitle({ screen: 'constructor', tenantName: 'STRONIX' })).toBe('STRONIX · STRONILEAD');
  });

  it('todo título de tela existe', () => {
    for (const s of Object.keys(SCREENS)) expect(documentTitle({ screen: s }), s).toBe(`${SCREENS[s].title} · STRONILEAD`);
  });
});

describe('routeTemplate', () => {
  it('moldes com /:tenant e :leadId', () => {
    expect(routeTemplate('/')).toBe('/');
    expect(routeTemplate('')).toBe('/');
    expect(routeTemplate(`/${T}`)).toBe('/:tenant');
    expect(routeTemplate(`/${T}/pipeline`)).toBe('/:tenant/pipeline');
    expect(routeTemplate(`/${T}/leads/aulas`)).toBe('/:tenant/leads/aulas');
    expect(routeTemplate(`/${T}/visao-geral`)).toBe('/:tenant/visao-geral/operacional');
    expect(routeTemplate(`/${T}/ficha/Ab12`)).toBe('/:tenant/ficha/:leadId');
    expect(routeTemplate(`/${T}/ficha/Ab12/contratos`)).toBe('/:tenant/ficha/:leadId');
    expect(routeTemplate(`/${T}/configuracoes/equipe`)).toBe('/:tenant/configuracoes');
    expect(routeTemplate(`/${T}/super-admin`)).toBe('/:tenant/super-admin/visao-geral');
    expect(routeTemplate(`/${T}/xyz/11999990000`)).toBe('/:tenant/*');
    expect(routeTemplate('/ficha/Ab12')).toBe('/ficha/:leadId');
    expect(routeTemplate('/pipeline')).toBe('/pipeline');
    expect(routeTemplate('/i/stronix-crm-app')).toBe('/*');
  });

  it('nunca devolve dado real', () => {
    const caminhos = [
      `/${T}/ficha/Jo%C3%A3o%20Silva`, `/${T}/ficha/11999990000/contratos`, `/${T}/ficha/a%2Fb`,
      `/${T}/configuracoes/joao@x.com`, `/${T}/xyz/joao`, '/ficha/joao', '/joao-da-silva/pipeline', '/i/joao?ref=abc',
    ];
    for (const p of caminhos) {
      const molde = routeTemplate(p);
      expect(molde, p).not.toMatch(/joao|jo%c3|11999990000|stronix|a%2fb|@/i);
    }
  });
});

describe('scrollActionFor', () => {
  it('outra tela vai ao topo; voltar restaura; mesma tela e primeira tela não mexem', () => {
    expect(scrollActionFor({ navigationType: 'PUSH', prevScreenKey: 'kanban', screenKey: 'clientes' })).toBe('top');
    expect(scrollActionFor({ navigationType: 'REPLACE', prevScreenKey: 'settings', screenKey: 'dashOperacional' })).toBe('top');
    expect(scrollActionFor({ navigationType: 'POP', prevScreenKey: 'ficha:a', screenKey: 'kanban' })).toBe('restore');
    expect(scrollActionFor({ navigationType: 'PUSH', prevScreenKey: 'kanban', screenKey: 'kanban' })).toBe('none');
    expect(scrollActionFor({ navigationType: 'POP', prevScreenKey: 'kanban', screenKey: 'kanban' })).toBe('none');
    expect(scrollActionFor({ navigationType: 'POP', prevScreenKey: null, screenKey: 'kanban' })).toBe('none');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/routes.decision.test.js 2>&1 | tail -6
```

Esperado: `Tests  39 failed (39)`, a primeira com `TypeError: canAccess is not a function`.

- [ ] **Step 3: Importar `isAdminUser` em `routes.js`**

Antes (topo de `src/lib/routes.js`):

```js
import { TENANT_SLUG_READ_RE, isReservedTenantSlug } from './tenantSlug.js';
```

Depois:

```js
import { TENANT_SLUG_READ_RE, isReservedTenantSlug } from './tenantSlug.js';
import { isAdminUser } from './leads.js';
```

`src/lib/leads.js` é puro (importa só `./dates.js` e `./globalSearch.js`), então o módulo continua rodando em node.

- [ ] **Step 4: Acrescentar o bloco no fim de `routes.js`**

Depois da função `canGoBackInApp`, que é a última do arquivo, acrescente:

```js
// Quem pode ver cada tela. Repete as travas que o App já faz no render
// (isAdminUser nas telas de gestor, appUser.superAdmin no super-admin). Tela
// sem trava, e id que não é tela, passam.
export function canAccess(screen, appUser) {
  if (!own(SCREENS, screen)) return true;
  const def = SCREENS[screen];
  if (def.gestor) return isAdminUser(appUser);
  if (def.superAdmin) return appUser?.superAdmin === true;
  return true;
}

// Avisos da troca de endereço. O App mostra com toast.warning.
export const ROUTE_NOTICES = Object.freeze({
  'so-gestor': 'Essa tela é só do gestor.',
  'nao-encontrada': 'Não achamos essa tela. Abrimos o Operacional.',
});

const OK = Object.freeze({ kind: 'ok' });

// `path` é sempre um caminho limpo, que começa com uma barra só (o navigate do
// React Router recusa //host como destino externo). O alvo é a tela que o App
// desenha já neste render, antes de o endereço trocar.
function redirectTo(path, { search = '', notice = null } = {}) {
  const r = parseAppPath(path);
  return { kind: 'redirect', to: path + search, target: { screen: r.screen, leadId: r.leadId, superTab: r.superTab }, notice };
}

const joinPath = (base, raw) => (raw.length ? `${base}/${raw.join('/')}` : base);

// Regras 6 e 7, sobre um endereço que já é da academia da sessão.
function accessRedirect(route, appUser, home) {
  if (route.screen && !canAccess(route.screen, appUser)) {
    return redirectTo(home, { notice: SCREENS[route.screen].gestor ? 'so-gestor' : null });
  }
  if (route.unknown) return redirectTo(home, { notice: 'nao-encontrada' });
  return null;
}

// Regra 4, a volta da visualização. Só vale enquanto o endereço ainda é da
// academia que estava assumida, e o caminho guardado é da academia da sessão e
// abre de primeira. Sem isso, o caminho guardado prenderia a pessoa nele.
function returnPathFor(route, appUser, returnTo) {
  const from = returnTo?.fromTenant;
  if (typeof from !== 'string' || from === '' || from === appUser.tenantId) return null;
  if (route.tenantSlug !== from || typeof returnTo.path !== 'string') return null;
  const path = `/${rawSegments(returnTo.path).join('/')}`;
  return routeDecision(parseAppPath(path), appUser).kind === 'ok' ? path : null;
}

// Regra 5: o endereço não é da academia da sessão. Devolve o caminho corrigido,
// ou null quando o endereço já é dela. Os segmentos depois da academia vão
// crus, do jeito que chegaram, para o id da ficha não mudar.
function sessionPathFor(route, tenantId, home) {
  const raw = rawSegments(route.pathname);
  if (raw.length === 0) return home;
  if (route.tenantSlug === tenantId) {
    // Mesma academia com outra caixa (/STRONIX/...): troca só o slug.
    return decodeSegment(raw[0]) === tenantId ? null : joinPath(home, raw.slice(1));
  }
  // Tela sem academia (/pipeline, /ficha/<id>): põe a academia na frente.
  if (route.tenantSlug === null) return route.unknown ? home : joinPath(home, raw);
  // Outra academia: a tela vem junto, a ficha e o super-admin não, porque são
  // dados da outra academia.
  const keepsScreen = route.screen && route.screen !== 'ficha' && route.screen !== 'superadmin';
  return keepsScreen ? joinPath(home, raw.slice(1)) : home;
}

// O que fazer com o endereço atual nesta sessão. Roda a cada render do app
// logado e para na primeira regra que se aplica:
// 1. sem sessão: ok (o login aparece em qualquer endereço e volta para ele);
// 2. super-admin puro: o console só existe em '/';
// 3. sessão assumida ("Acessar como") com o endereço de outra academia: vai
//    para a tela inicial da assumida;
// 4. volta da visualização: vai para o caminho guardado na entrada;
// 5. endereço sem a academia da sessão: corrige o slug, sem aviso;
// 6. tela que a sessão não vê: tela inicial, com aviso se for de gestor;
// 7. endereço desconhecido: tela inicial, com aviso.
// A regra 5 já sai com as regras 6 e 7 aplicadas ao endereço corrigido, então o
// destino de todo redirect é aceito de primeira: nada pisca e nada entra em
// laço. Devolve { kind: 'ok' } ou { kind: 'redirect', to, target, notice }.
export function routeDecision(route, appUser, opts = {}) {
  const { search = '', returnTo = null } = opts || {};
  if (!appUser) return OK;
  if (appUser.superAdminOnly) return route.pathname === '/' ? OK : redirectTo('/');
  const tenantId = appUser.tenantId;
  const home = hrefFor(tenantId, HOME_SCREEN);
  // Trava contra laço: academia cujo id não relê como ela mesma (fora do
  // formato ou palavra reservada) não é mandada pelo endereço. Sem isso, o
  // redirect cairia nele mesmo para sempre. Vale para as regras 3 a 7.
  if (!home || parseAppPath(home).tenantSlug !== tenantId) return OK;
  if (appUser.impersonating && route.tenantSlug !== tenantId) return redirectTo(home);
  const back = returnPathFor(route, appUser, returnTo);
  if (back) return redirectTo(back);
  const fixed = sessionPathFor(route, tenantId, home);
  if (fixed !== null) return accessRedirect(parseAppPath(fixed), appUser, home) ?? redirectTo(fixed, { search });
  return accessRedirect(route, appUser, home) ?? OK;
}

// Voltar da ficha: pelo navegador quando há tela do app antes dela nesta aba;
// senão, troca a entrada por Clientes (cliente) ou Pipeline (lead).
export function backTarget({ historyState, isClient, tenantId } = {}) {
  if (canGoBackInApp(historyState)) return { type: 'back' };
  return { type: 'replace', href: hrefFor(tenantId, isClient ? 'clientes' : 'kanban') };
}

// Chave da tela mostrada, para a key do AppErrorBoundary e para a rolagem.
// /<academia> e /visao-geral/operacional são a mesma tela, o `rest` e a subaba
// do super-admin não trocam a chave (o SuperAdminView não remonta nem refaz a
// busca a cada subaba), outra ficha troca.
export function screenKey(route) {
  const screen = route?.screen;
  if (screen === 'ficha') return `ficha:${route.leadId}`;
  if (screen === HOME_SCREEN || screen === 'dashOperacional') return 'dashOperacional';
  return screen || 'dashboard';
}

// Título da aba do navegador: tela primeiro, para distinguir várias abas.
// Nunca leva nome de lead, porque o histórico do navegador guarda o título.
export function documentTitle({ screen, tenantName } = {}) {
  const parts = [];
  if (own(SCREENS, screen)) parts.push(SCREENS[screen].title);
  if (tenantName) parts.push(tenantName);
  parts.push('STRONILEAD');
  return parts.join(' · ');
}

// Molde do endereço para o Sentry: '/:tenant' no lugar da academia e ':leadId'
// no lugar do id da ficha. O `rest` fica de fora. Nunca devolve dado real.
export function routeTemplate(pathname) {
  const r = parseAppPath(pathname);
  if (rawSegments(r.pathname).length === 0) return '/';
  const prefix = r.tenantSlug ? '/:tenant' : '';
  if (r.unknown || !r.screen) return `${prefix}/*`;
  if (r.screen === 'ficha') return `${prefix}/ficha/:leadId`;
  if (r.screen === 'superadmin') return `${prefix}/super-admin/${SUPER_TABS[r.superTab]}`;
  const segs = SCREENS[r.screen].segs;
  return segs.length ? `${prefix}/${segs.join('/')}` : prefix;
}

// Rolagem do container compartilhado. Outra tela por push ou replace: topo.
// Voltar ou avançar para outra tela: devolve a posição daquela entrada. Mesma
// tela, ou a primeira tela da aba: não mexe.
export function scrollActionFor({ navigationType, prevScreenKey, screenKey: key } = {}) {
  if (prevScreenKey == null || prevScreenKey === key) return 'none';
  return navigationType === 'POP' ? 'restore' : 'top';
}
```

`returnPathFor` chama `routeDecision`, que está declarada mais abaixo no mesmo arquivo. Funciona porque declaração de função sobe para o topo do módulo, e o lint do repo não tem `no-use-before-define`.

- [ ] **Step 5: Rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/routes.decision.test.js src/lib/__tests__/routes.test.js src/lib/__tests__/tenantSlug.test.js 2>&1 | tail -4
```

Esperado: `Tests  88 passed (88)` (39 + 35 + 14).

- [ ] **Step 6: Suite inteira, lint, build e o verificador do Sentry**

```bash
npx vitest run 2>&1 | tail -4
npm run lint 2>&1 | tail -2
npm run build 2>&1 | tail -2
npm run verificar:sentry 2>&1 | tail -3
```

Esperado: `Test Files  90 passed (90)` e `Tests  1920 passed (1920)` (1881 + 39); `✖ 1 problem (0 errors, 1 warning)`; build com `✓ built in ...`; o verificador termina com "Sentry não recebe a chave do Zap nem telefone, e a sabotagem prova que esta verificação enxergaria se recebesse." (é o mesmo passo do CI, que roda em Node 22).

- [ ] **Step 7: Commit**

```bash
git add src/lib/routes.js src/lib/__tests__/routes.decision.test.js
git commit -F - <<'EOF'
feat: decisão de rota, voltar da ficha, título e molde do Sentry em routes.js

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Estado puro da ficha (`src/lib/fichaState.js`)

**Depende de:** T3 (`isValidLeadId` em `src/lib/routes.js`).

**Files:**
- Create: `src/lib/fichaState.js`
- Test: `src/lib/__tests__/fichaState.test.js`

Os sete status da ficha: `invalid` (id que o Firestore não aceita), `waiting` (sem sessão ainda), `loading` (sem resposta para a chave atual), `ready`, `missing` (doc não existe), `deleted` (doc sumiu com a ficha aberta) e `error`. A rota transforma o status em uma de seis telas: `deleting`, `missing`, `deleted`, `error`, `ready` ou `loading`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/__tests__/fichaState.test.js`:

```js
// Estados da ficha aberta por endereço. O hook (useProfileLead) e a rota
// (LeadProfileRoute) só ligam fios: tudo que decide o que aparece na tela
// mora aqui e roda em node, sem Firebase e sem jsdom.
import { describe, it, expect } from 'vitest';
import {
  profileSubscriptionKey,
  nextProfileSnap,
  profileStatusFor,
  resolveFichaView,
} from '../fichaState.js';

const LEAD = { id: 'AbC123xyz', name: 'Ana Duarte' };
const KEY = profileSubscriptionKey({ sessionKey: 'acad:u1', leadId: 'AbC123xyz', attempt: 0 });

describe('profileSubscriptionKey', () => {
  it('junta sessão, id e tentativa num texto só', () => {
    expect(KEY).toBe(JSON.stringify(['acad:u1', 'AbC123xyz', 0]));
  });

  it('é null sem sessão: a assinatura espera o login terminar', () => {
    for (const sessionKey of [null, undefined, '']) {
      expect(profileSubscriptionKey({ sessionKey, leadId: 'AbC123xyz', attempt: 0 })).toBeNull();
    }
  });

  it('é null com id inválido: o doc() nunca recebe caminho quebrado', () => {
    for (const leadId of [null, undefined, '', 'a/b', '.', '..', '__x__', 'x'.repeat(129)]) {
      expect(profileSubscriptionKey({ sessionKey: 'acad:u1', leadId, attempt: 0 })).toBeNull();
    }
  });

  it('muda quando muda a sessão, o id ou a tentativa', () => {
    const base = { sessionKey: 'acad:u1', leadId: 'AbC123xyz', attempt: 0 };
    expect(profileSubscriptionKey({ ...base, sessionKey: 'outra:u1' })).not.toBe(KEY);
    expect(profileSubscriptionKey({ ...base, leadId: 'Outro99' })).not.toBe(KEY);
    expect(profileSubscriptionKey({ ...base, attempt: 1 })).not.toBe(KEY);
  });

  it('não confunde sessão e id que formariam o mesmo texto emendados', () => {
    const a = profileSubscriptionKey({ sessionKey: 'acad:u1', leadId: 'x', attempt: 0 });
    const b = profileSubscriptionKey({ sessionKey: 'acad', leadId: 'u1:x', attempt: 0 });
    expect(a).not.toBe(b);
  });
});

describe('nextProfileSnap', () => {
  it('doc presente fica pronto', () => {
    expect(nextProfileSnap(null, KEY, LEAD)).toEqual({ key: KEY, status: 'ready', lead: LEAD });
  });

  it('doc que nunca existiu é "não encontrada"', () => {
    expect(nextProfileSnap(null, KEY, null)).toEqual({ key: KEY, status: 'missing', lead: null });
  });

  it('doc que some com a ficha aberta é "excluída" e guarda o último lead para o Voltar', () => {
    const shown = nextProfileSnap(null, KEY, LEAD);
    expect(nextProfileSnap(shown, KEY, null)).toEqual({ key: KEY, status: 'deleted', lead: LEAD });
  });

  it('continua "excluída" em mais um aviso de doc ausente', () => {
    const deleted = { key: KEY, status: 'deleted', lead: LEAD };
    expect(nextProfileSnap(deleted, KEY, null)).toEqual(deleted);
  });

  it('doc ausente depois de outra ficha pronta é "não encontrada", nunca "excluída"', () => {
    const other = profileSubscriptionKey({ sessionKey: 'acad:u1', leadId: 'Outro99', attempt: 0 });
    const prev = { key: other, status: 'ready', lead: { id: 'Outro99' } };
    expect(nextProfileSnap(prev, KEY, null)).toEqual({ key: KEY, status: 'missing', lead: null });
  });

  it('continua "não encontrada" se o doc segue ausente', () => {
    const prev = { key: KEY, status: 'missing', lead: null };
    expect(nextProfileSnap(prev, KEY, null)).toEqual({ key: KEY, status: 'missing', lead: null });
  });

  it('doc que volta (exclusão recusada pelo servidor) fica pronto de novo', () => {
    const deleted = { key: KEY, status: 'deleted', lead: LEAD };
    const back = { ...LEAD, name: 'Ana Duarte Silva' };
    expect(nextProfileSnap(deleted, KEY, back)).toEqual({ key: KEY, status: 'ready', lead: back });
  });

  it('doc ausente só no cache é erro de conexão, não não encontrada', () => {
    // Sem internet, o Firestore responde do cache com o doc ausente. O servidor
    // ainda não disse que ele não existe: é o painel "Não deu para abrir a ficha".
    expect(nextProfileSnap(null, KEY, null, { fromCache: true })).toEqual({ key: KEY, status: 'error', lead: null });
    const other = profileSubscriptionKey({ sessionKey: 'acad:u1', leadId: 'Outro99', attempt: 0 });
    const otherReady = { key: other, status: 'ready', lead: { id: 'Outro99' } };
    expect(nextProfileSnap(otherReady, KEY, null, { fromCache: true })).toEqual({ key: KEY, status: 'error', lead: null });
    // Com esta ficha já na tela, o doc que some continua sendo "excluída".
    const shown = nextProfileSnap(null, KEY, LEAD);
    expect(nextProfileSnap(shown, KEY, null, { fromCache: true })).toEqual({ key: KEY, status: 'deleted', lead: LEAD });
    // Doc que está no cache abre normalmente.
    expect(nextProfileSnap(null, KEY, LEAD, { fromCache: true })).toEqual({ key: KEY, status: 'ready', lead: LEAD });
  });
});

describe('profileStatusFor', () => {
  const ready = { key: KEY, status: 'ready', lead: LEAD };

  it('id inválido é "invalid" mesmo sem sessão', () => {
    expect(profileStatusFor({ leadId: 'a/b', sessionKey: null, key: null, snap: null })).toBe('invalid');
    expect(profileStatusFor({ leadId: null, sessionKey: 'acad:u1', key: null, snap: null })).toBe('invalid');
  });

  it('sem sessão é "waiting"', () => {
    expect(profileStatusFor({ leadId: 'AbC123xyz', sessionKey: null, key: null, snap: null })).toBe('waiting');
  });

  it('sem resposta ainda é "loading"', () => {
    expect(profileStatusFor({ leadId: 'AbC123xyz', sessionKey: 'acad:u1', key: KEY, snap: null })).toBe('loading');
  });

  it('resposta de outra chave é "loading" e nunca mostra o lead velho', () => {
    const cases = [
      { sessionKey: 'outra:u9', leadId: 'AbC123xyz', attempt: 0 }, // sessão anterior
      { sessionKey: 'acad:u1', leadId: 'AbC123xyz', attempt: 1 }, // tentativa anterior
      { sessionKey: 'acad:u1', leadId: 'Outro99', attempt: 0 }, // id anterior
    ];
    for (const c of cases) {
      const key = profileSubscriptionKey(c);
      expect(profileStatusFor({ leadId: c.leadId, sessionKey: c.sessionKey, key, snap: ready })).toBe('loading');
    }
  });

  it('resposta da mesma chave manda o status dela', () => {
    for (const status of ['ready', 'missing', 'deleted', 'error']) {
      const snap = { key: KEY, status, lead: status === 'ready' ? LEAD : null };
      expect(profileStatusFor({ leadId: 'AbC123xyz', sessionKey: 'acad:u1', key: KEY, snap })).toBe(status);
    }
  });
});

describe('resolveFichaView', () => {
  const ALL = ['invalid', 'waiting', 'loading', 'ready', 'missing', 'deleted', 'error'];

  it('"Excluindo a ficha" ganha de qualquer status', () => {
    for (const status of ALL) {
      expect(resolveFichaView({ status, dataReady: true, deleting: true })).toBe('deleting');
      expect(resolveFichaView({ status, dataReady: false, deleting: true })).toBe('deleting');
    }
  });

  it('id inválido e doc ausente mostram "não encontrada" sem esperar a carga', () => {
    expect(resolveFichaView({ status: 'invalid', dataReady: false, deleting: false })).toBe('missing');
    expect(resolveFichaView({ status: 'missing', dataReady: false, deleting: false })).toBe('missing');
  });

  it('excluída e erro aparecem sem esperar a carga', () => {
    expect(resolveFichaView({ status: 'deleted', dataReady: false, deleting: false })).toBe('deleted');
    expect(resolveFichaView({ status: 'error', dataReady: false, deleting: false })).toBe('error');
  });

  it('ficha pronta só aparece com os catálogos da academia carregados', () => {
    expect(resolveFichaView({ status: 'ready', dataReady: false, deleting: false })).toBe('loading');
    expect(resolveFichaView({ status: 'ready', dataReady: true, deleting: false })).toBe('ready');
  });

  it('esperando sessão ou resposta é "loading", com ou sem carga', () => {
    for (const status of ['waiting', 'loading']) {
      expect(resolveFichaView({ status, dataReady: true, deleting: false })).toBe('loading');
      expect(resolveFichaView({ status, dataReady: false, deleting: false })).toBe('loading');
    }
  });

  it('nunca devolve "ready" para status que não é "ready"', () => {
    for (const status of ALL.filter((s) => s !== 'ready')) {
      expect(resolveFichaView({ status, dataReady: true, deleting: false })).not.toBe('ready');
    }
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/__tests__/fichaState.test.js`
Expected: FAIL, com `Error: Cannot find module '../fichaState.js' imported from .../src/lib/__tests__/fichaState.test.js` e `Test Files  1 failed (1)`.

- [ ] **Step 3: Escrever a implementação**

Criar `src/lib/fichaState.js`:

```js
// Estados da ficha aberta por endereço (/<academia>/ficha/<id>). Puro: sem
// React e sem Firebase. O useProfileLead guarda a última resposta do Firestore
// e a LeadProfileRoute escolhe o que desenhar, os dois com estas funções.
//
// Status da ficha:
//   invalid  id do endereço que o Firestore não aceita (nem chega a ler)
//   waiting  login ainda terminando: sem sessão, não assina
//   loading  assinatura pedida e ainda sem resposta para ESTA chave
//   ready    doc existe
//   missing  doc não existe (link errado, de outra academia ou excluído antes)
//   deleted  doc sumiu com a ficha aberta (alguém excluiu agora)
//   error    a leitura falhou (internet, permissão), ou só o cache respondeu
//            e sem o doc (sem internet)

import { isValidLeadId } from './routes.js';

// Chave de uma assinatura: sessão, id e tentativa. Trocar qualquer um dos três
// (Sair e entrar, "Acessar como", outra ficha, "Tentar de novo") gera chave nova,
// e resposta de chave velha nunca aparece na tela. JSON e não texto emendado,
// para 'acad:u1' + 'x' não virar o mesmo que 'acad' + 'u1:x'.
export function profileSubscriptionKey({ sessionKey, leadId, attempt }) {
  if (!sessionKey || !isValidLeadId(leadId)) return null;
  return JSON.stringify([sessionKey, leadId, attempt]);
}

// Próxima resposta guardada, a partir da anterior e do doc que chegou (lead
// normalizado ou null). Só é "excluída" quando ESTA chave já mostrou a ficha:
// o doc estava na tela e sumiu. Guarda o último lead para o Voltar saber se a
// pessoa era cliente (volta para Clientes) ou lead (volta para o Pipeline).
// Doc ausente que veio só do cache (fromCache, sem internet) é erro de conexão,
// e não "não encontrada": o servidor ainda não disse que o doc não existe.
export function nextProfileSnap(prev, key, lead, { fromCache = false } = {}) {
  if (lead) return { key, status: 'ready', lead };
  if (fromCache && !(prev?.key === key && (prev.status === 'ready' || prev.status === 'deleted'))) return { key, status: 'error', lead: null };
  const wasShown = prev?.key === key && (prev.status === 'ready' || prev.status === 'deleted');
  if (wasShown) return { key, status: 'deleted', lead: prev.lead ?? null };
  return { key, status: 'missing', lead: null };
}

// Status que vale neste render. Resposta de outra chave conta como "loading":
// é assim que o hook não precisa zerar estado dentro do effect.
export function profileStatusFor({ leadId, sessionKey, key, snap }) {
  if (!isValidLeadId(leadId)) return 'invalid';
  if (!sessionKey || !key) return 'waiting';
  if (!snap || snap.key !== key) return 'loading';
  return snap.status;
}

// O que a rota desenha. A ficha pronta espera os catálogos da academia
// (dataReady), senão mostraria cliente sem contrato e etapa sem cor por um
// instante. "Não encontrada", "excluída" e erro aparecem sem esperar.
export function resolveFichaView({ status, dataReady, deleting }) {
  if (deleting) return 'deleting';
  if (status === 'invalid' || status === 'missing') return 'missing';
  if (status === 'deleted' || status === 'error') return status;
  if (status === 'ready' && dataReady) return 'ready';
  return 'loading';
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/lib/__tests__/fichaState.test.js`
Expected: PASS, `Tests  24 passed (24)`.

- [ ] **Step 5: Lint dos arquivos novos**

Run: `npx eslint src/lib/fichaState.js src/lib/__tests__/fichaState.test.js`
Expected: nenhuma saída (0 erros, 0 avisos).

- [ ] **Step 6: Suíte inteira**

Run: `npx vitest run`
Expected: `Test Files  91 passed (91)` e `Tests  1944 passed (1944)` (1920 + 24).

- [ ] **Step 7: Commit**

```bash
git add src/lib/fichaState.js src/lib/__tests__/fichaState.test.js
git commit -m "$(cat <<'EOF'
feat: estado puro da ficha aberta por endereço

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Sentry com endereço por tela

**Files:**
- Modify: `src/lib/sentryScrub.js` (quatro trechos: `URL_KEYS` e começo do `stripUrlsIn` nas linhas 51-59; bloco novo antes de `export function maskSensitive` na linha 80; fim do `scrubEvent` nas linhas 192-198; fim do `scrubBreadcrumb` nas linhas 216-222)
- Modify: `src/lib/sentry.js` (arquivo inteiro, 64 linhas)
- Test: `src/lib/__tests__/sentryScrub.test.js` (import da linha 2 e bloco novo no fim do arquivo)
- Test: `src/lib/__tests__/sentryInit.test.js` (novo)

Com o endereço por tela, a ficha vira `/<academia>/ficha/<id do lead>`. O id não pode sair para o Sentry em campo nenhum. A regra de limpeza é a regex `/(\/ficha\/)[^/?#\s"'<>]+/gi`, que troca o id por `:leadId`, a mesma marca do molde de rota. O slug da academia fica, porque é o mesmo valor da tag `tenant` que já vai hoje.

**Depende de:** T4 (`routeTemplate` em `src/lib/routes.js`).

**Fatos do SDK que explicam o desenho** (lidos em `node_modules/@sentry/*` 10.69.0, não na documentação):

- O `browserTracingIntegration` aplica o `beforeStartSpan` só ao nome da span. O nome gravado no escopo continua cru: `scope.setTransactionName(spanOptions.name)` em `@sentry/browser/build/npm/esm/dev/tracing/browserTracingIntegration.js:334` e `:346`. Como o escopo vai em todo erro, `event.transaction` sai com `/<academia>/ficha/<id>` se ninguém limpar. Por isso a rede final no `scrubEvent` é obrigatória.
- `url.path` e `url.full` entram no contexto da span a partir da URL crua (`browserTracingIntegration.js:88-92`).
- Com `beforeSendSpan` devolvendo `null`, o SDK manda a span ORIGINAL (`@sentry/core/build/esm/envelope.js:67-73` e `client.js:747-770`). Por isso o `scrubSpan` nunca devolve `null`.
- O `beforeSendSpan` também recebe a span raiz de cada transação (`client.js:739-754`), antes do `beforeSendTransaction`. A limpeza é idempotente, então passar duas vezes não muda nada.
- Na navegação, o SDK chama os handlers de histórico ANTES do `pushState` e do `replaceState` de verdade (`@sentry/browser-utils/build/esm/instrument/history.js:35-37`) e passa o caminho de destino em `options.name` (`browserTracingIntegration.js:300`). No pageload, `options.name` é o próprio `window.location.pathname` (linha 278). Por isso o `beforeStartSpan` usa `routeTemplate(options.name)`: com `window.location.pathname`, como diziam o contrato e o spec, toda navegação por link, `navigate` ou `RouteRedirect` sairia com o molde da tela anterior. Não é vazamento (continua molde), mas deixaria o painel de Performance errado.
- Com o `browserTracingIntegration`, o `replaceState` também é instrumentado: o replace do `RouteRedirect` vira transação de navegação, amostrada a 10% como as outras.

- [ ] **Step 1: Trocar o import do teste do sentryScrub**

Em `src/lib/__tests__/sentryScrub.test.js`, linha 2. Antes:

```js
import { maskSensitive, scrubDeep, isNoise, scrubEvent, stripQuery, scrubBreadcrumb } from '../sentryScrub.js';
```

Depois:

```js
import {
  maskSensitive, scrubDeep, isNoise, scrubEvent, stripQuery, scrubBreadcrumb,
  scrubLeadPath, scrubLeadPathsDeep, scrubSpan
} from '../sentryScrub.js';
```

- [ ] **Step 2: Acrescentar os testes novos no fim do mesmo arquivo**

Depois do último `});` do arquivo (o que fecha o `describe('scrubBreadcrumb', ...)`), deixar uma linha em branco e colar:

```js
// Com endereço por tela, a ficha vira /<academia>/ficha/<id do lead>. O id não
// pode sair para o Sentry em campo nenhum. As formas abaixo são as que o SDK
// 10.69 produz de verdade (request.url, nome da transação no escopo, migalha
// de navegação, url.path, span do documento, span do INP e medidas de LCP).
const ID = 'Ab12Cd34Ef56Gh78Ij90';
const FICHA = `/stronix-crm-app/ficha/${ID}`;

describe('scrubLeadPath', () => {
  it('troca o id da ficha pela marca :leadId e mantém o resto', () => {
    expect(scrubLeadPath(`https://stronilead.com.br${FICHA}?x=1`))
      .toBe('https://stronilead.com.br/stronix-crm-app/ficha/:leadId?x=1');
  });

  it('é idempotente e não mexe no molde de rota', () => {
    expect(scrubLeadPath('/:tenant/ficha/:leadId')).toBe('/:tenant/ficha/:leadId');
    expect(scrubLeadPath(scrubLeadPath(FICHA))).toBe('/stronix-crm-app/ficha/:leadId');
  });

  it('não distingue maiúscula', () => {
    expect(scrubLeadPath('/S/FICHA/Ab12')).toBe('/S/FICHA/:leadId');
  });

  it('para em espaço e aspas quando o caminho está no meio de uma frase', () => {
    expect(scrubLeadPath('falhou ao abrir /s/ficha/Ab12 agora')).toBe('falhou ao abrir /s/ficha/:leadId agora');
    expect(scrubLeadPath('href="/s/ficha/Ab12" quebrou')).toBe('href="/s/ficha/:leadId" quebrou');
  });

  it('pega id com caractere codificado', () => {
    expect(scrubLeadPath('/s/ficha/Jos%C3%A9%2050%25')).toBe('/s/ficha/:leadId');
  });

  it('deixa as outras telas, o slug e o que não é texto como estão', () => {
    expect(scrubLeadPath('/stronix-crm-app/pipeline')).toBe('/stronix-crm-app/pipeline');
    expect(scrubLeadPath('/s/leads/aulas')).toBe('/s/leads/aulas');
    expect(scrubLeadPath('/s/fichas/x')).toBe('/s/fichas/x');
    expect(scrubLeadPath('/stronix-crm-app')).toBe('/stronix-crm-app');
    expect(scrubLeadPath(null)).toBe(null);
    expect(scrubLeadPath(42)).toBe(42);
  });
});

describe('scrubLeadPathsDeep', () => {
  it('troca em campo que não está em lista nenhuma, em qualquer profundidade', () => {
    const event = { contexts: { qualquer: { a: { b: { c: { d: { e: { f: FICHA } } } } } } } };
    expect(scrubLeadPathsDeep(event).contexts.qualquer.a.b.c.d.e.f).toBe('/stronix-crm-app/ficha/:leadId');
  });

  it('aguenta referência circular', () => {
    const node = { url: FICHA };
    node.self = node;
    expect(() => scrubLeadPathsDeep(node)).not.toThrow();
    expect(node.url).toBe('/stronix-crm-app/ficha/:leadId');
  });

  it('não entra no sdkProcessingMetadata, que guarda objeto vivo do SDK', () => {
    const vivo = { url: FICHA };
    const event = { sdkProcessingMetadata: { normalizedRequest: vivo } };
    scrubLeadPathsDeep(event);
    expect(event.sdkProcessingMetadata.normalizedRequest).toBe(vivo);
    expect(vivo.url).toBe(FICHA);
  });

  it('não grava em objeto congelado quando não há nada a trocar', () => {
    const congelado = Object.freeze({ url: '/stronix-crm-app/pipeline' });
    expect(() => scrubLeadPathsDeep({ congelado })).not.toThrow();
  });
});

describe('scrubEvent: id do lead no endereço', () => {
  it('tira o id e a query do request.url', () => {
    const event = { request: { url: `https://stronilead.com.br${FICHA}?invite=x` } };
    expect(scrubEvent(event).request.url).toBe('https://stronilead.com.br/stronix-crm-app/ficha/:leadId');
  });

  it('troca o id no nome da transação que o SDK copia para todo erro', () => {
    expect(scrubEvent({ transaction: FICHA }).transaction).toBe('/stronix-crm-app/ficha/:leadId');
    expect(scrubEvent({ transaction: '/:tenant/ficha/:leadId' }).transaction).toBe('/:tenant/ficha/:leadId');
  });

  it('troca o id nas migalhas de navegação guardadas no evento', () => {
    const event = { breadcrumbs: [{ category: 'navigation', data: { from: '/s/pipeline', to: '/s/ficha/Ab12' } }] };
    const crumb = scrubEvent(event).breadcrumbs[0];
    expect(crumb.data.to).toBe('/s/ficha/:leadId');
    expect(crumb.data.from).toBe('/s/pipeline');
  });

  it('limpa url.path e url.full no contexto da transação', () => {
    const event = {
      type: 'transaction',
      contexts: { trace: { data: { 'url.path': '/s/ficha/Ab12', 'url.full': 'https://stronilead.com.br/s/ficha/Ab12?invite=abc' } } }
    };
    const data = scrubEvent(event).contexts.trace.data;
    expect(data['url.path']).toBe('/s/ficha/:leadId');
    expect(data['url.full']).toBe('https://stronilead.com.br/s/ficha/:leadId');
  });

  it('limpa a descrição da span do documento', () => {
    const event = { type: 'transaction', spans: [{ op: 'browser.request', description: 'https://stronilead.com.br/s/ficha/Ab12?invite=abc' }] };
    expect(scrubEvent(event).spans[0].description).toBe('https://stronilead.com.br/s/ficha/:leadId');
  });

  it('não deixa sair o Referer, que numa aba aberta pela ficha leva o endereço dela', () => {
    const event = { request: { url: 'https://stronilead.com.br/s/pipeline', headers: { Referer: 'https://stronilead.com.br/s/ficha/Ab12', 'User-Agent': 'x' } } };
    expect(scrubEvent(event).request.headers).toEqual({ 'User-Agent': 'x' });
  });

  it('troca o id na mensagem da exceção e mantém os frames inteiros', () => {
    const event = {
      exception: {
        values: [{
          value: 'falhou ao abrir /s/ficha/Ab12 agora',
          stacktrace: { frames: [{ filename: 'https://stronilead.com.br/assets/index.js', function: 'abrir', lineno: 10 }] }
        }]
      }
    };
    const entry = scrubEvent(event).exception.values[0];
    expect(entry.value).toBe('falhou ao abrir /s/ficha/:leadId agora');
    expect(entry.stacktrace.frames[0]).toEqual({ filename: 'https://stronilead.com.br/assets/index.js', function: 'abrir', lineno: 10 });
  });

  it('mantém o slug da academia e as outras telas', () => {
    const event = { request: { url: 'https://stronilead.com.br/stronix-crm-app/leads/aulas' }, transaction: '/stronix-crm-app/pipeline' };
    const out = scrubEvent(event);
    expect(out.request.url).toBe('https://stronilead.com.br/stronix-crm-app/leads/aulas');
    expect(out.transaction).toBe('/stronix-crm-app/pipeline');
  });

  it('redige o seletor do LCP e do CLS e tira o token da foto do cliente', () => {
    const event = {
      type: 'transaction',
      contexts: {
        trace: {
          data: {
            'lcp.element': 'div > img[alt="Maria Souza"]',
            'lcp.url': 'https://firebasestorage.googleapis.com/v0/b/b/o/tenants%2Fs%2Fleads%2FAb12%2Favatar.jpg?alt=media&token=t',
            'cls.source.1': 'div.card > span[title="Maria Souza"]'
          }
        }
      }
    };
    const data = scrubEvent(event).contexts.trace.data;
    expect(data['lcp.element']).toBe('div > img[alt="[redigido]"]');
    expect(data['lcp.url']).toBe('https://firebasestorage.googleapis.com/v0/b/b/o/tenants%2Fs%2Fleads%2FAb12%2Favatar.jpg');
    expect(data['cls.source.1']).toBe('div.card > span[title="[redigido]"]');
  });
});

describe('scrubBreadcrumb: id do lead no endereço', () => {
  it('troca o id no destino da navegação e deixa a origem', () => {
    const crumb = { category: 'navigation', data: { from: '/s/pipeline', to: '/s/ficha/Ab12' } };
    const out = scrubBreadcrumb(crumb);
    expect(out.data.to).toBe('/s/ficha/:leadId');
    expect(out.data.from).toBe('/s/pipeline');
  });
});

describe('scrubSpan', () => {
  it('limpa a span do INP: nome do cliente no seletor e caminho da tela', () => {
    const span = { op: 'ui.interaction.click', description: 'body > div > span[title="Maria Souza"]', data: { transaction: '/s/ficha/Ab12' } };
    const out = scrubSpan(span);
    expect(out).toBe(span);
    expect(out.description).toBe('body > div > span[title="[redigido]"]');
    expect(out.data.transaction).toBe('/s/ficha/:leadId');
  });

  it('tira query e id da span que descreve uma URL', () => {
    const out = scrubSpan({ op: 'browser.request', description: 'https://stronilead.com.br/s/ficha/Ab12?invite=abc', data: { 'url.full': 'https://stronilead.com.br/s/ficha/Ab12?invite=abc' } });
    expect(out.description).toBe('https://stronilead.com.br/s/ficha/:leadId');
    expect(out.data['url.full']).toBe('https://stronilead.com.br/s/ficha/:leadId');
  });

  it('redige o seletor e a URL do LCP que vêm em span', () => {
    const out = scrubSpan({ op: 'ui.webvital.lcp', description: 'div > img[alt="Maria Souza"]', data: { 'lcp.element': 'img[alt="Maria Souza"]', 'lcp.url': 'https://x.com/a.jpg?token=t' } });
    expect(out.description).toBe('div > img[alt="[redigido]"]');
    expect(out.data['lcp.element']).toBe('img[alt="[redigido]"]');
    expect(out.data['lcp.url']).toBe('https://x.com/a.jpg');
  });

  it('devolve o que recebeu quando não é objeto', () => {
    expect(scrubSpan(null)).toBe(null);
    expect(scrubSpan(undefined)).toBe(undefined);
  });

  it('nunca devolve null nem lança: na falha sai uma casca sem descrição e sem data', () => {
    const span = {
      span_id: 's1',
      trace_id: 't1',
      op: 'ui.interaction.click',
      get description() { throw new Error('boom'); }
    };
    const out = scrubSpan(span);
    expect(out).toEqual({ span_id: 's1', trace_id: 't1', op: 'ui.interaction.click', description: '[redigido]', data: {} });
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/sentryScrub.test.js`

Expected: FAIL com `Tests  23 failed | 44 passed (67)`. As falhas são `TypeError: scrubLeadPath is not a function`, `scrubLeadPathsDeep is not a function`, `scrubSpan is not a function` e asserções do tipo `expected '/s/ficha/Ab12' to be '/s/ficha/:leadId'`. Os dois testes novos que já passam ("não deixa sair o Referer" e "mantém o slug da academia e as outras telas") são trava de comportamento que já existe e não pode mudar.

- [ ] **Step 4: Chaves de URL e seletor de LCP e CLS no `stripUrlsIn`**

Em `src/lib/sentryScrub.js`, linhas 51-59. Antes:

```js
// Chaves em que o SDK guarda URL dentro de span, contexto de trace e breadcrumb.
const URL_KEYS = ['url', 'url.full', 'http.url', 'to', 'from'];

function stripUrlsIn(bag) {
  if (!bag || typeof bag !== 'object') return bag;
  for (const key of URL_KEYS) {
    if (typeof bag[key] === 'string') bag[key] = stripQuery(bag[key]);
  }
  delete bag['url.query'];
```

Depois:

```js
// Chaves em que o SDK guarda URL dentro de span, contexto de trace e breadcrumb.
// url.path é o caminho da tela, que o SDK grava no contexto de toda transação
// de navegação. lcp.url é a maior imagem da tela no pageload: com a foto do
// cliente, é o endereço do Storage com o token de download na query.
const URL_KEYS = ['url', 'url.full', 'url.path', 'http.url', 'to', 'from', 'lcp.url'];

// Seletor do elemento que o SDK anexa às medidas de LCP (lcp.element) e de
// CLS (cls.source.1, cls.source.2...). Leva title e alt do elemento, e o
// Avatar põe o nome do cliente no alt.
function isDomSelectorKey(key) {
  return key === 'lcp.element' || key.startsWith('cls.source.');
}

function stripUrlsIn(bag) {
  if (!bag || typeof bag !== 'object') return bag;
  for (const key of URL_KEYS) {
    if (typeof bag[key] === 'string') bag[key] = stripQuery(bag[key]);
  }
  for (const key of Object.keys(bag)) {
    if (isDomSelectorKey(key) && typeof bag[key] === 'string') bag[key] = redactDomAttrs(bag[key]);
  }
  delete bag['url.query'];
```

O `redactDomAttrs` é declarado mais abaixo com `export function`, então está disponível aqui (declaração de função sobe para o topo do módulo).

- [ ] **Step 5: `scrubLeadPath` e `scrubLeadPathsDeep`**

Em `src/lib/sentryScrub.js`, linha 80. Antes:

```js
export function maskSensitive(value) {
```

Depois (o bloco novo entra logo acima da linha, que continua igual):

```js
// O endereço da ficha leva o id do lead (/<academia>/ficha/<id>). O SDK copia
// o caminho cru para request.url, para o nome da transação no escopo (que vai
// em todo erro), para as migalhas de navegação e para url.path. A troca usa a
// mesma marca do molde de rota (routeTemplate), então é idempotente e a URL
// limpa agrupa igual à transação. Não distingue maiúscula, porque o endereço
// também é lido sem distinguir. Para em espaço e aspas para não comer o resto
// da frase quando o caminho aparece numa mensagem de erro.
const LEAD_PATH_RE = /(\/ficha\/)[^/?#\s"'<>]+/gi;

export function scrubLeadPath(text) {
  if (typeof text !== 'string' || !text) return text;
  return text.replace(LEAD_PATH_RE, '$1:leadId');
}

// Rede final: troca o id da ficha em qualquer texto do evento, inclusive em
// campo que o SDK venha a acrescentar sem avisar (url.path entrou assim).
// Não usa scrubDeep porque ele para em MAX_DEPTH níveis e apagaria os frames
// do stacktrace. Pula sdkProcessingMetadata: ali ficam objetos vivos do SDK
// (escopo, span), que ele mesmo apaga antes do envio. O WeakSet segura
// referência circular. Só grava quando o texto muda, para não tropeçar em
// objeto congelado que não tinha nada a trocar.
export function scrubLeadPathsDeep(node, seen = new WeakSet()) {
  if (!node || typeof node !== 'object' || seen.has(node) || ArrayBuffer.isView(node)) return node;
  seen.add(node);
  for (const key of Object.keys(node)) {
    if (key === 'sdkProcessingMetadata') continue;
    const value = node[key];
    if (typeof value === 'string') {
      const clean = scrubLeadPath(value);
      if (clean !== value) node[key] = clean;
    } else if (value && typeof value === 'object') {
      scrubLeadPathsDeep(value, seen);
    }
  }
  return node;
}

export function maskSensitive(value) {
```

- [ ] **Step 6: Rede final no fim do `scrubEvent`**

Em `src/lib/sentryScrub.js`, linhas 192-198. Antes:

```js
  if (event.contexts?.trace) {
    stripUrlsIn(event.contexts.trace.data);
    stripUrlsIn(event.contexts.trace.attributes);
  }

  return event;
}
```

Depois:

```js
  if (event.contexts?.trace) {
    stripUrlsIn(event.contexts.trace.data);
    stripUrlsIn(event.contexts.trace.attributes);
  }

  // Por último, a rede do id da ficha no evento inteiro: event.transaction,
  // request.url, migalhas, contexto de trace e o que mais vier.
  return scrubLeadPathsDeep(event);
}
```

Se a rede lançar exceção dentro do `beforeSend`, o SDK descarta o evento (falha fechada). O `api/_sentry.js` usa o mesmo `scrubEvent`, e o `verificar:sentry` do Step 13 confere que o lado do servidor continua inteiro.

- [ ] **Step 7: Rede final no `scrubBreadcrumb` e `scrubSpan` novo**

Em `src/lib/sentryScrub.js`, linhas 216-222 (o fim do arquivo). Antes:

```js
    if (crumb.data) crumb.data = stripUrlsIn(scrubDeep(crumb.data));

    return crumb;
  } catch {
    return null;
  }
}
```

Depois:

```js
    if (crumb.data) crumb.data = stripUrlsIn(scrubDeep(crumb.data));

    // Migalha de navegação leva o endereço de origem e de destino (from/to).
    return scrubLeadPathsDeep(crumb);
  } catch {
    return null;
  }
}

// Campos que a span leva quando a limpeza falha: só identificação e tempo.
const SPAN_SHELL_KEYS = ['span_id', 'trace_id', 'parent_span_id', 'start_timestamp', 'timestamp', 'op', 'origin', 'status'];

function spanShell(span) {
  const shell = { description: '[redigido]', data: {} };
  for (const key of SPAN_SHELL_KEYS) {
    try {
      const value = span[key];
      if (typeof value === 'string' || typeof value === 'number') shell[key] = value;
    } catch {
      // campo que não dá para ler fica de fora
    }
  }
  return shell;
}

// beforeSendSpan do Sentry. A span do INP sai num envelope só dela e não passa
// pelo beforeSend nem pelo beforeSendTransaction. A descrição dela é o seletor
// do elemento tocado (com o alt do Avatar, que é o nome do cliente) e
// data.transaction é o caminho da tela. O SDK também passa por aqui cada span
// de transação antes do beforeSendTransaction, o que não atrapalha, porque a
// limpeza é idempotente. Nunca devolve null: com null o SDK manda a span
// ORIGINAL, sem limpeza. Na falha devolve uma casca sem descrição e sem data.
export function scrubSpan(span) {
  if (!span || typeof span !== 'object') return span;
  try {
    if (typeof span.description === 'string') {
      span.description = maskSensitive(redactDomAttrs(span.description));
      if (span.description.includes('://')) span.description = stripQuery(span.description);
    }
    stripUrlsIn(span.data);
    return scrubLeadPathsDeep(span);
  } catch {
    return spanShell(span);
  }
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/sentryScrub.test.js`

Expected: PASS com `Tests  67 passed (67)`.

- [ ] **Step 9: Escrever o teste da fiação do Sentry**

Criar `src/lib/__tests__/sentryInit.test.js`:

```js
// Fiação do Sentry do front (src/lib/sentry.js) com o SDK simulado. Quem
// limpa o dado é o sentryScrub, testado à parte. Aqui a trava é outra: que os
// ganchos continuem ligados. Tirar o beforeSendSpan, por exemplo, deixa a
// span do INP sair sem limpeza nenhuma, e nenhum outro teste veria isso.
// O sentry.js lê o DSN quando é carregado, por isso cada caso limpa o
// registro de módulos e importa de novo depois de trocar a variável.
import { describe, it, expect, vi, afterEach } from 'vitest';

const m = vi.hoisted(() => ({
  init: vi.fn(),
  tracing: vi.fn((options) => ({ name: 'BrowserTracing', options })),
  setUser: vi.fn(),
  setTags: vi.fn(),
}));

vi.mock('@sentry/react', () => ({
  init: m.init,
  browserTracingIntegration: m.tracing,
  setUser: m.setUser,
  setTags: m.setTags,
}));

async function loadWithDsn(dsn) {
  vi.resetModules();
  vi.stubEnv('VITE_SENTRY_DSN', dsn);
  const sentry = await import('../sentry.js');
  const scrub = await import('../sentryScrub.js');
  const routes = await import('../routes.js');
  return { sentry, scrub, routes };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('initSentry', () => {
  it('com DSN, liga os quatro ganchos de limpeza no init', async () => {
    const { sentry, scrub } = await loadWithDsn('https://publica@o0.ingest.sentry.io/0');
    expect(sentry.initSentry()).toBe(true);
    expect(m.init).toHaveBeenCalledTimes(1);
    const options = m.init.mock.calls[0][0];
    expect(options.dsn).toBe('https://publica@o0.ingest.sentry.io/0');
    expect(options.beforeSend).toBe(scrub.scrubEvent);
    expect(options.beforeSendTransaction).toBe(scrub.scrubEvent);
    expect(options.beforeSendSpan).toBe(scrub.scrubSpan);
    expect(options.beforeBreadcrumb).toBe(scrub.scrubBreadcrumb);
    expect(options.dataCollection).toEqual({ userInfo: false, httpBodies: [] });
    expect(options.tracesSampleRate).toBe(0.1);
  });

  it('usa a integração de navegação do navegador, com o molde da tela no nome', async () => {
    const { sentry } = await loadWithDsn('https://publica@o0.ingest.sentry.io/0');
    sentry.initSentry();
    expect(m.tracing).toHaveBeenCalledTimes(1);
    expect(typeof m.tracing.mock.calls[0][0].beforeStartSpan).toBe('function');
    const options = m.init.mock.calls[0][0];
    expect(options.integrations).toEqual([m.tracing.mock.results[0].value]);
  });

  it('o nome da span é o molde da tela de destino, sem academia e sem id do lead', async () => {
    const { sentry, routes } = await loadWithDsn('https://publica@o0.ingest.sentry.io/0');
    sentry.initSentry();
    const { beforeStartSpan } = m.tracing.mock.calls[0][0];
    const path = '/stronix-crm-app/ficha/Ab12Cd34Ef56Gh78Ij90';
    // Na navegação o SDK chama o gancho antes de o endereço trocar: a barra
    // ainda está na tela de antes, e o destino vem em options.name. O nome
    // sai do destino, senão a transação levaria o molde da tela anterior.
    vi.stubGlobal('window', { location: { pathname: '/stronix-crm-app/pipeline' } });
    const attributes = { 'sentry.source': 'url' };
    const out = beforeStartSpan({ name: path, op: 'navigation', attributes });
    expect(out.name).toBe('/:tenant/ficha/:leadId');
    expect(out.name).toBe(routes.routeTemplate(path));
    expect(out.op).toBe('navigation');
    expect(out.attributes).toBe(attributes);
    expect(out.name).not.toContain('Ab12Cd34Ef56Gh78Ij90');
    expect(out.name).not.toContain('stronix-crm-app');
  });

  it('sem DSN, não sobe nada', async () => {
    const { sentry } = await loadWithDsn('');
    expect(sentry.initSentry()).toBe(false);
    expect(m.init).not.toHaveBeenCalled();
    expect(m.tracing).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 10: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/sentryInit.test.js`

Expected: FAIL com `Tests  3 failed | 1 passed (4)`. As falhas: `AssertionError: expected undefined to be [Function scrubSpan]`, `TypeError: Cannot read properties of undefined (reading 'beforeStartSpan')` e `TypeError: Cannot destructure property 'beforeStartSpan' of 'm.tracing.mock.calls[0][0]' as it is undefined`. O caso "sem DSN" já passa.

- [ ] **Step 11: Reescrever `src/lib/sentry.js`**

Substituir o arquivo inteiro por:

```js
// Fiação do Sentry no front. Único arquivo do front que importa o SDK.
// A lógica de limpeza mora em sentryScrub.js, que é puro e testado.

import * as Sentry from '@sentry/react';
import { scrubEvent, scrubBreadcrumb, scrubSpan } from './sentryScrub.js';
import { routeTemplate } from './routes.js';

const env = import.meta.env || {};
const DSN = env.VITE_SENTRY_DSN || '';

// Sem DSN o Sentry não sobe. É o botão de desligar: basta remover a variável
// no painel da Vercel e redeployar, sem tocar em código. Também mantém o
// `npm run dev` mudo por padrão.
export function initSentry() {
  if (!DSN) return false;

  Sentry.init({
    dsn: DSN,
    environment: env.VITE_SENTRY_ENVIRONMENT || 'production',
    release: env.VITE_APP_RELEASE || undefined,

    // Corta na origem o que o SDK coletaria sozinho: e-mail, nome de usuário
    // e IP (userInfo), e corpo de requisição e de resposta (httpBodies).
    // Substitui o sendDefaultPii, que saiu de uso na v10.57 e some na v11.
    // O scrubEvent continua como segunda camada, para o que passar daqui.
    dataCollection: {
      userInfo: false,
      httpBodies: [],
    },

    // Session Replay fica de fora. Ele grava a tela, e a tela tem ficha de
    // lead aberta. Decisão de privacidade, não de esforço.
    integrations: [
      Sentry.browserTracingIntegration({
        // O nome da transação é o molde da tela (/:tenant/pipeline,
        // /:tenant/ficha/:leadId), nunca o endereço de verdade. O nome vai
        // no cabeçalho de amostragem, que não passa pelo beforeSend, então
        // não pode levar academia nem id de lead. O molde sai de
        // options.name, que é o caminho da página no pageload e o caminho de
        // DESTINO na navegação. O SDK chama este gancho antes de o endereço
        // trocar, então ler window.location aqui daria o molde da tela de
        // antes. A integração do React Router do Sentry não entra porque
        // exige <Routes>, e o app não usa. O SDK ainda grava o caminho cru no
        // escopo (vai em todo erro) e em url.path: quem limpa isso é o
        // sentryScrub.
        beforeStartSpan: (options) => ({ ...options, name: routeTemplate(options.name) }),
      }),
    ],
    tracesSampleRate: 0.1,

    beforeSend: scrubEvent,
    // O beforeSend só vale para evento de ERRO. Sem esta linha, a amostra de
    // 10% das transações sairia sem limpeza nenhuma, levando a URL inteira
    // (e o token de convite que viaja nela) para o Sentry.
    beforeSendTransaction: scrubEvent,
    // A span do INP sai num envelope só dela, sem passar pelo beforeSend nem
    // pelo beforeSendTransaction, levando o seletor do elemento tocado (com o
    // nome do cliente no alt do Avatar) e o caminho da tela.
    beforeSendSpan: scrubSpan,
    // Redige nome de cliente e o campo "dor" que o SDK captura sozinho dos
    // atributos title/alt/aria-label do elemento clicado.
    beforeBreadcrumb: scrubBreadcrumb,
  });

  return true;
}

// Só uid, tenantId e role. Nome e e-mail ficam no nosso banco; o cruzamento
// com a pessoa é feito lá, não no Sentry.
export function setSentryUser({ uid, tenantId, role, impersonating }) {
  if (!DSN) return;
  Sentry.setUser(uid ? { id: uid } : null);
  Sentry.setTags({
    tenant: tenantId || 'sem-tenant',
    role: role || 'desconhecido',
    impersonating: impersonating ? 'sim' : 'nao',
  });
}

export function clearSentryUser() {
  if (!DSN) return;
  Sentry.setUser(null);
  Sentry.setTags({ tenant: 'sem-tenant', role: 'desconhecido', impersonating: 'nao' });
}
```

O que mudou em relação ao arquivo de hoje: o import de `scrubSpan` e de `routeTemplate`, o `browserTracingIntegration` com `beforeStartSpan` e a linha `beforeSendSpan: scrubSpan`. O resto (DSN, `dataCollection`, amostra de 10%, `setSentryUser`, `clearSentryUser`) fica igual. A integração de React Router do Sentry (`reactRouterBrowserTracingIntegration` e `wrapReactRouterRouting`) NÃO entra: ela exige `<Routes>`, e o app não usa. Sem `export let AppRoutes`.

- [ ] **Step 12: Rodar os dois arquivos e ver passar**

Run: `npx vitest run src/lib/__tests__/sentryInit.test.js src/lib/__tests__/sentryScrub.test.js`

Expected: PASS com `Tests  71 passed (71)`.

- [ ] **Step 13: Conferir o lado do servidor com o SDK de verdade**

Run: `npm run verificar:sentry`

Expected: sai com código 0 e as três últimas linhas são:

```
rodada normal:    OK — nenhuma marca encontrada — rodada normal limpa
rodada sabotagem: OK — a sabotagem vazou, como esperado: a verificação enxergaria se o vazamento real voltasse
Sentry não recebe a chave do Zap nem telefone, e a sabotagem prova que esta verificação enxergaria se recebesse.
```

(O texto com travessão é saída do script que já existe, não texto novo.)

- [ ] **Step 14: Lint e suíte inteira**

Run: `npx eslint src/lib/sentry.js src/lib/sentryScrub.js src/lib/__tests__/sentryScrub.test.js src/lib/__tests__/sentryInit.test.js`

Expected: nenhuma saída (0 erros, 0 avisos).

Run: `npx vitest run`

Expected: `Test Files  92 passed (92)` e `Tests  1973 passed (1973)` (1944 + 29).

Run: `npm run lint`

Expected: `✖ 1 problem (0 errors, 1 warning)`, o aviso antigo de `SuperAdminView.jsx:111`.

- [ ] **Step 15: Commit**

```bash
git add src/lib/sentryScrub.js src/lib/sentry.js src/lib/__tests__/sentryScrub.test.js src/lib/__tests__/sentryInit.test.js
git commit -m "$(cat <<'EOF'
feat: sentry sem id do lead no endereço

O nome da transação vira o molde da tela e o sentryScrub troca o id da
ficha por :leadId em qualquer campo do evento, da migalha e da span.
Entra o beforeSendSpan para a span do INP, que levava o nome do cliente
pelo alt do Avatar.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

**Por que `options.name`, e não `window.location.pathname` como dizia o contrato:** está nos fatos do SDK, no começo desta tarefa. O teste do Step 9 põe a barra na tela de antes (`/stronix-crm-app/pipeline`) e o destino em `options.name`: com `window.location.pathname` o nome sairia `/:tenant/pipeline`, e o teste pega.

---

### Task 7: AppLink, LeadLink e o LeadProfileContext com endereço

**Files:**
- Modify: `src/contexts/LeadProfileContext.jsx` (arquivo inteiro, 15 linhas)
- Create: `src/components/nav/AppLink.jsx`
- Test: `src/lib/__tests__/appLink.test.js` (novo)

**Depende de:** T1 (`Link` e `MemoryRouter`) e T3 (`hrefFor` e `parseAppPath`).

O `AppLink` é uma casca fina sobre o `<Link>` do React Router 7.18.4. Conferido no fonte (`chunk-OB3PAWPO.mjs:7428-7436` e `:10602-10676`): o `Link` chama o `onClick` de quem usa primeiro e só navega se o clique não foi cancelado e se `shouldProcessLinkClick` aceita (botão 0, sem Ctrl, Cmd, Shift e Alt, sem `target` de outra janela). Quando o destino é o endereço atual, o `useLinkClickHandler` já troca push por replace (`chunk-OB3PAWPO.mjs:10879-10900`). O resto (aba nova, botão do meio, menu do botão direito) fica com o navegador. O `onNavigate` segue a mesma regra, então só roda quando o clique troca de tela nesta aba.

O `LeadLink` só é usado de verdade no PR 3. Neste PR entram o componente e o teste. Nenhum teste de componente-folha pode renderizar `LeadLink` com id válido fora de um Router, porque o `Link` usa `useHref`, que exige Router. Com id inválido ou fora do Provider ele vira `<span>` e não chama o `Link`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/__tests__/appLink.test.js`:

```js
// AppLink e LeadLink em node, sem jsdom: renderToString dentro de um
// MemoryRouter. O Link do React Router é embrulhado por um espião que guarda
// as props, para conferir o state levado e para simular o clique chamando o
// onClick que o AppLink entregou ao Link.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { AppLink, LeadLink } from '../../components/nav/AppLink.jsx';
import { LeadProfileContext, useLeadProfile } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor, parseAppPath } from '../routes.js';

const m = vi.hoisted(() => ({ linkProps: [] }));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal();
  const { createElement: h } = await import('react');
  function SpyLink(props) {
    m.linkProps.push(props);
    return h(actual.Link, props);
  }
  return { ...actual, Link: SpyLink };
});

const TENANT = 'acad';
const profile = (from = 'kanban') => ({
  openProfile: () => {},
  leadHref: (leadId) => hrefFor(TENANT, 'ficha', { leadId }),
  from,
});

function render(element, { value = profile(), path = '/acad/pipeline' } = {}) {
  return renderToString(
    createElement(MemoryRouter, { initialEntries: [path] },
      createElement(LeadProfileContext.Provider, { value }, element)));
}

function click(overrides = {}) {
  return {
    button: 0,
    metaKey: false,
    altKey: false,
    ctrlKey: false,
    shiftKey: false,
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    ...overrides,
  };
}

const lastLinkProps = () => m.linkProps[m.linkProps.length - 1];

beforeEach(() => {
  m.linkProps.length = 0;
});

describe('AppLink', () => {
  it('é um <a> com o endereço de destino', () => {
    const html = render(createElement(AppLink, { to: '/acad/pipeline', className: 'px-2' }, 'Pipeline'));
    expect(html).toContain('<a');
    expect(html).toContain('href="/acad/pipeline"');
    expect(html).toContain('class="px-2"');
    expect(html).toContain('>Pipeline</a>');
  });

  it('stretched estica a área do link sobre o card', () => {
    const html = render(createElement(AppLink, { to: '/acad/clientes', stretched: true, className: 'font-semibold' }, 'Ana'));
    expect(html).toContain('class="after:absolute after:inset-0 font-semibold"');
  });

  it('repassa ao Link o que não é dele (aria-current, tabIndex, draggable, title, ref)', () => {
    const ref = { current: null };
    const html = render(createElement(AppLink, { to: '/acad', 'aria-current': 'page', tabIndex: -1, draggable: false, title: 'Operacional', ref }, 'Início'));
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('draggable="false"');
    expect(html).toContain('title="Operacional"');
    expect(lastLinkProps().ref).toBe(ref);
  });

  it('onNavigate roda no clique esquerdo simples, depois do onClick', () => {
    const calls = [];
    render(createElement(AppLink, {
      to: '/acad/pipeline',
      onClick: () => calls.push('onClick'),
      onNavigate: () => calls.push('onNavigate'),
    }, 'Pipeline'));
    lastLinkProps().onClick(click());
    expect(calls).toEqual(['onClick', 'onNavigate']);
  });

  it('onNavigate não roda com Ctrl, Cmd, Shift, Alt, botão do meio ou botão direito', () => {
    const onNavigate = vi.fn();
    const onClick = vi.fn();
    render(createElement(AppLink, { to: '/acad/pipeline', onClick, onNavigate }, 'Pipeline'));
    const handle = lastLinkProps().onClick;
    handle(click({ ctrlKey: true }));
    handle(click({ metaKey: true }));
    handle(click({ shiftKey: true }));
    handle(click({ altKey: true }));
    handle(click({ button: 1 }));
    handle(click({ button: 2 }));
    expect(onClick).toHaveBeenCalledTimes(6);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('onNavigate não roda quando o onClick cancela o clique', () => {
    const onNavigate = vi.fn();
    render(createElement(AppLink, { to: '/acad/pipeline', onClick: (e) => e.preventDefault(), onNavigate }, 'Pipeline'));
    lastLinkProps().onClick(click());
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('onNavigate não roda quando o link abre em outra janela', () => {
    const onNavigate = vi.fn();
    render(createElement(AppLink, { to: '/acad/pipeline', target: '_blank', onNavigate }, 'Pipeline'));
    lastLinkProps().onClick(click());
    expect(onNavigate).not.toHaveBeenCalled();
  });
});

describe('LeadProfileContext', () => {
  it('sem Provider, não monta endereço e não tem tela de origem', () => {
    function Probe() {
      const { leadHref, from, openProfile } = useLeadProfile();
      return createElement('i', null, `${leadHref('abc123')}|${from}|${typeof openProfile}`);
    }
    expect(renderToString(createElement(Probe))).toBe('<i>null|null|function</i>');
  });
});

describe('LeadLink', () => {
  it('aponta para a ficha e leva a tela de origem no state', () => {
    const html = render(createElement(LeadLink, { leadId: 'abc123', className: 'grid' }, 'Ana Lima'));
    expect(html).toContain('href="/acad/ficha/abc123"');
    expect(html).toContain('class="grid"');
    expect(lastLinkProps().to).toBe('/acad/ficha/abc123');
    expect(lastLinkProps().state).toEqual({ from: 'kanban' });
  });

  it('o endereço volta como a mesma ficha, com espaço, acento e %', () => {
    for (const leadId of ['id com espaço', 'José', '50%', 'Ab12Cd34Ef56Gh78Ij90']) {
      const html = render(createElement(LeadLink, { leadId }, 'x'));
      const href = html.match(/href="([^"]*)"/)[1];
      const route = parseAppPath(href);
      expect(route.screen).toBe('ficha');
      expect(route.leadId).toBe(leadId);
    }
  });

  it('id que não serve para endereço vira texto sem link', () => {
    for (const leadId of ['', 'a/b', '..', '__x__', null, undefined]) {
      const html = render(createElement(LeadLink, { leadId, className: 'truncate' }, 'Ana'));
      expect(html).toBe('<span class="truncate">Ana</span>');
    }
    expect(m.linkProps).toHaveLength(0);
  });

  it('fora do Provider vira texto sem link', () => {
    const html = renderToString(
      createElement(MemoryRouter, null, createElement(LeadLink, { leadId: 'abc123' }, 'Ana')));
    expect(html).toBe('<span>Ana</span>');
  });

  it('repassa onNavigate e tabIndex ao AppLink', () => {
    const onNavigate = vi.fn();
    const html = render(createElement(LeadLink, { leadId: 'abc123', tabIndex: -1, onNavigate }, 'Ana'));
    expect(html).toContain('tabindex="-1"');
    lastLinkProps().onClick(click());
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/appLink.test.js`

Expected: FAIL com `Error: Cannot find module '/src/components/nav/AppLink.jsx' imported from .../src/lib/__tests__/appLink.test.js`, `Test Files  1 failed (1)` e `Tests  no tests`.

- [ ] **Step 3: Reescrever `src/contexts/LeadProfileContext.jsx`**

Antes (arquivo inteiro):

```jsx
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react';

// Navegação para a ficha-página (lead/cliente). Exposto via Context para que
// qualquer tela (Kanban, listas, Meta, Dashboard...) abra o perfil sem
// prop-drilling. `openProfile(leadId)` troca o conteúdo do <main> pela
// LeadProfileView; o "Voltar" volta à aba de origem. Espelha o padrão do
// GeneralConfigContext (funciona através de portais).
const LeadProfileContext = createContext({ openProfile: () => {} });

function useLeadProfile() {
  return useContext(LeadProfileContext) || { openProfile: () => {} };
}

export { LeadProfileContext, useLeadProfile };
```

Depois (arquivo inteiro):

```jsx
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react';

// A ficha do lead ou cliente é um endereço (/<academia>/ficha/<id>), e este
// contexto é o caminho de qualquer tela até ela, sem prop-drilling:
// - openProfile(leadId) navega para a ficha, para o clique que não é link;
// - leadHref(leadId) monta o endereço da ficha, ou devolve null quando o id
//   não serve para endereço;
// - from é o id da tela de onde a ficha é aberta. Vai no state da navegação
//   para o menu continuar aceso e o cabeçalho manter o título da origem.
// Fora do Provider, leadHref devolve null e o LeadLink vira texto sem link.
// Espelha o padrão do GeneralConfigContext (funciona através de portais).
const NO_PROFILE = Object.freeze({ openProfile: () => {}, leadHref: () => null, from: null });

const LeadProfileContext = createContext(NO_PROFILE);

function useLeadProfile() {
  return useContext(LeadProfileContext) || NO_PROFILE;
}

export { LeadProfileContext, useLeadProfile };
```

O `eslint-disable react-refresh/only-export-components` da linha 1 já existe hoje e continua. Não é disable novo. Os consumidores atuais (`NotificationBell`, `GlobalSearch`, `ReferralsSection`, `LeadProfileView`, `DailyGoalView`, `KanbanView`, `LeadsView`, `ClientsView`, `AppointmentTrackingView`, `ConsultantDayDetail`) só leem `openProfile` e continuam funcionando sem mudança.

- [ ] **Step 4: Criar `src/components/nav/AppLink.jsx`**

```jsx
import { Link } from 'react-router';
import { cn } from '../../lib/utils.js';
import { useLeadProfile } from '../../contexts/LeadProfileContext.jsx';

// A mesma regra do Link do React Router (shouldProcessLinkClick): só o clique
// esquerdo sem Ctrl, Cmd, Shift ou Alt, e sem mandar para outra janela, troca
// de tela nesta aba. O resto (aba nova, janela nova, botão do meio) fica com
// o navegador.
function opensHere(event, target) {
  return event.button === 0
    && (!target || target === '_self')
    && !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}

// Link interno do app. É um <a href> de verdade, então Ctrl+clique, botão do
// meio e "Abrir em nova aba" funcionam. onNavigate roda só quando o clique
// troca de tela nesta aba (fechar o sino, a busca, o menu do celular): com
// Ctrl+clique a lista continua aberta para abrir outras fichas.
// stretched estica a área do link sobre o card inteiro. O card precisa de
// `relative`, e os botões de dentro dele, de `relative z-10`.
export function AppLink({ to, onNavigate, onClick, stretched = false, className, ref, ...rest }) {
  function handleClick(event) {
    onClick?.(event);
    if (onNavigate && !event.defaultPrevented && opensHere(event, rest.target)) onNavigate(event);
  }

  return (
    <Link
      {...rest}
      ref={ref}
      to={to}
      onClick={handleClick}
      className={cn(stretched && 'after:absolute after:inset-0', className) || undefined}
    />
  );
}

// Link para a ficha do lead ou cliente. O endereço e a tela de origem vêm do
// LeadProfileContext, e a origem vai no state da navegação (só o id da tela,
// nunca dado da pessoa). Id que não serve para endereço vira texto sem link,
// e fora do Provider também.
export function LeadLink({ leadId, children, className, ...rest }) {
  const { leadHref, from } = useLeadProfile();
  const href = leadHref?.(leadId) ?? null;

  if (!href) return <span className={className}>{children}</span>;

  return (
    <AppLink {...rest} to={href} state={{ from: from ?? null }} className={className}>
      {children}
    </AppLink>
  );
}
```

O arquivo só exporta componentes, então passa no `react-refresh/only-export-components` sem disable. A regra do clique (`opensHere`) fica interna de propósito: exportar função que não é componente de um `.jsx` quebraria essa regra. O `leadHref?.(leadId)` protege o intervalo entre esta tarefa e a T10: até a T10, o `App.jsx` fornece `{ openProfile }` sem `leadHref`, e o `LeadLink` vira texto em vez de quebrar.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/appLink.test.js`

Expected: PASS com `Tests  13 passed (13)`.

- [ ] **Step 6: Lint e suíte inteira**

Run: `npx eslint src/contexts/LeadProfileContext.jsx src/components/nav/AppLink.jsx src/lib/__tests__/appLink.test.js`

Expected: nenhuma saída.

Run: `npx vitest run`

Expected: `Test Files  93 passed (93)` e `Tests  1986 passed (1986)` (1973 + 13).

- [ ] **Step 7: Commit**

```bash
git add src/contexts/LeadProfileContext.jsx src/components/nav/AppLink.jsx src/lib/__tests__/appLink.test.js
git commit -m "$(cat <<'EOF'
feat: links de verdade para telas e fichas

AppLink por cima do Link do React Router, com onNavigate só no clique que
troca de tela nesta aba, e LeadLink que monta o endereço da ficha e leva
a tela de origem no state. O LeadProfileContext ganha leadHref e from.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: RouteRedirect e rolagem por tela

**Files:**
- Create: `src/components/RouteRedirect.jsx`
- Create: `src/hooks/useRouteScroll.js`
- Test: `src/lib/__tests__/routeRedirect.test.js` (novo)
- Test: `src/lib/__tests__/useRouteScroll.test.js` (novo)

**Depende de:** T1 (`useNavigate`, `useLocation`, `useNavigationType`) e T4 (`ROUTE_NOTICES`, `screenKey` e `scrollActionFor`).

O `renderToString` não roda effect, e o repositório não tem jsdom. Por isso os dois testes simulam os hooks com `vi.mock('react')` (mantendo o resto do React de verdade) e rodam o effect guardado como o React faria depois do commit. As partes puras da rolagem (`createScrollMemory` e `restoreWhenTall`) são exportadas do `useRouteScroll.js` e testadas contra um div falso. O `react-refresh/only-export-components` não olha arquivo `.js`, então o hook pode exportar essas funções.

- [ ] **Step 1: Escrever o teste do RouteRedirect**

Criar `src/lib/__tests__/routeRedirect.test.js`:

```js
// RouteRedirect em node, sem jsdom. O renderToString não roda effect, então os
// hooks são simulados: o useEffect guarda a função, o teste a roda como o
// React faria depois do commit, e confere o aviso e a troca de endereço.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RouteRedirect } from '../../components/RouteRedirect.jsx';
import { ROUTE_NOTICES } from '../routes.js';

const m = vi.hoisted(() => ({
  effect: null,
  deps: null,
  navigate: vi.fn(),
  toast: { warning: vi.fn() },
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useEffect: (effect, deps) => {
      m.effect = effect;
      m.deps = deps;
    },
  };
});

vi.mock('react-router', () => ({ useNavigate: () => m.navigate }));
vi.mock('../../contexts/ToastContext.jsx', () => ({ useToast: () => m.toast }));

function mountAndCommit(props) {
  const output = RouteRedirect(props);
  m.effect();
  return output;
}

beforeEach(() => {
  m.effect = null;
  m.deps = null;
  m.navigate.mockClear();
  m.toast.warning.mockClear();
});

describe('RouteRedirect', () => {
  it('mostra o aviso de gestor e troca o endereço sem empilhar histórico', () => {
    const output = mountAndCommit({ to: '/acad', notice: 'so-gestor' });
    expect(output).toBe(null);
    expect(m.toast.warning).toHaveBeenCalledWith(ROUTE_NOTICES['so-gestor']);
    expect(m.toast.warning).toHaveBeenCalledWith('Essa tela é só do gestor.');
    expect(m.navigate).toHaveBeenCalledWith('/acad', { replace: true });
  });

  it('sem aviso, só troca o endereço', () => {
    mountAndCommit({ to: '/acad/pipeline', notice: null });
    expect(m.toast.warning).not.toHaveBeenCalled();
    expect(m.navigate).toHaveBeenCalledWith('/acad/pipeline', { replace: true });
  });

  it('aviso que não existe não mostra nada e ainda troca o endereço', () => {
    mountAndCommit({ to: '/acad', notice: 'xyz' });
    expect(m.toast.warning).not.toHaveBeenCalled();
    expect(m.navigate).toHaveBeenCalledWith('/acad', { replace: true });
  });

  it('o effect depende do destino e do aviso', () => {
    mountAndCommit({ to: '/acad', notice: 'nao-encontrada' });
    expect(m.deps).toEqual(['/acad', 'nao-encontrada', m.navigate, m.toast]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/routeRedirect.test.js`

Expected: FAIL com `Error: Cannot find module '/src/components/RouteRedirect.jsx' imported from .../src/lib/__tests__/routeRedirect.test.js` e `Tests  no tests`.

- [ ] **Step 3: Criar `src/components/RouteRedirect.jsx`**

```jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useToast } from '../contexts/ToastContext.jsx';
import { ROUTE_NOTICES } from '../lib/routes.js';

// Troca o endereço barrado pelo destino da decisão de rota (routeDecision) e
// mostra o aviso, quando há. Não desenha nada: o App já desenha a tela de
// destino no mesmo render, então a tela barrada nunca pisca. O App monta este
// componente com key={location.key}, e cada endereço barrado ganha instância
// nova. A troca passa pelo navigate de propósito: um history.replaceState
// cru apagaria o idx que o Voltar da ficha lê.
// toast.warning e navigate não são setState de useState, então a regra
// react-hooks/set-state-in-effect não se aplica. No dev, o StrictMode roda o
// effect duas vezes e o aviso aparece em dobro. Em produção, uma vez.
export function RouteRedirect({ to, notice }) {
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    const message = notice ? ROUTE_NOTICES[notice] : null;
    if (message) toast.warning(message);
    navigate(to, { replace: true });
  }, [to, notice, navigate, toast]);

  return null;
}
```

O lint `react-hooks/set-state-in-effect` só marca o setter de `useState`. `toast.warning` vem de contexto e `navigate` vem do React Router, então o effect passa sem disable (conferido com o plugin 7.0.1 do repositório).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/routeRedirect.test.js`

Expected: PASS com `Tests  4 passed (4)`.

- [ ] **Step 5: Commit do RouteRedirect**

```bash
git add src/components/RouteRedirect.jsx src/lib/__tests__/routeRedirect.test.js
git commit -m "$(cat <<'EOF'
feat: troca de endereço barrado com aviso

RouteRedirect troca o endereço pelo destino da decisão de rota sempre com
replace pelo navigate, que preserva o idx do histórico, e mostra o aviso
de tela de gestor ou de tela não encontrada.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Escrever o teste da rolagem**

Criar `src/lib/__tests__/useRouteScroll.test.js`:

```js
// Rolagem por tela em node, sem jsdom. As peças puras (memória e restauração)
// rodam contra um div falso que imita o scrollTop do navegador: ele não passa
// do tamanho do conteúdo. O hook roda com os hooks do React e do React Router
// simulados: cada "render" lê a location e roda o layout effect como o React
// faria depois do commit.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createScrollMemory, restoreWhenTall, useRouteScroll } from '../../hooks/useRouteScroll.js';

const m = vi.hoisted(() => ({
  location: { pathname: '/', key: 'default' },
  navigationType: 'POP',
  prevRef: null,
  layoutEffect: null,
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useRef: (initial) => {
      if (!m.prevRef) m.prevRef = { current: initial };
      return m.prevRef;
    },
    useCallback: (fn) => fn,
    useLayoutEffect: (effect) => {
      m.layoutEffect = effect;
    },
  };
});

vi.mock('react-router', () => ({
  useLocation: () => m.location,
  useNavigationType: () => m.navigationType,
}));

// Div que rola: scrollTop fica entre 0 e (conteúdo - janela), como no navegador.
function fakeScroller({ contentHeight = 5000, viewport = 600 } = {}) {
  const listeners = new Map();
  return {
    contentHeight,
    viewport,
    top: 0,
    get scrollTop() { return this.top; },
    set scrollTop(value) { this.top = Math.max(0, Math.min(value, Math.max(0, this.contentHeight - this.viewport))); },
    addEventListener(type, fn) { listeners.set(type, [...(listeners.get(type) || []), fn]); },
    removeEventListener(type, fn) { listeners.set(type, (listeners.get(type) || []).filter((f) => f !== fn)); },
    fire(type) { for (const fn of listeners.get(type) || []) fn(); },
    listenerCount() { return [...listeners.values()].reduce((n, list) => n + list.length, 0); },
  };
}

// Fila de quadros controlada pelo teste, no lugar do requestAnimationFrame.
function fakeFrames() {
  let nextId = 1;
  const queue = new Map();
  return {
    request: (fn) => {
      const id = nextId++;
      queue.set(id, fn);
      return id;
    },
    cancel: (id) => { queue.delete(id); },
    pending: () => queue.size,
    runNext() {
      const callbacks = [...queue.values()];
      queue.clear();
      for (const fn of callbacks) fn();
    },
  };
}

let frames;

beforeEach(() => {
  frames = fakeFrames();
  vi.stubGlobal('requestAnimationFrame', frames.request);
  vi.stubGlobal('cancelAnimationFrame', frames.cancel);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('createScrollMemory', () => {
  it('lembra a posição de cada entrada e devolve 0 para a desconhecida', () => {
    const memory = createScrollMemory();
    memory.remember('k1', 700);
    expect(memory.recall('k1')).toBe(700);
    expect(memory.recall('k2')).toBe(0);
  });

  it('passando do teto, esquece a entrada lembrada há mais tempo', () => {
    const memory = createScrollMemory(2);
    memory.remember('a', 1);
    memory.remember('b', 2);
    memory.remember('a', 3);
    memory.remember('c', 4);
    expect(memory.recall('b')).toBe(0);
    expect(memory.recall('a')).toBe(3);
    expect(memory.recall('c')).toBe(4);
  });
});

describe('restoreWhenTall', () => {
  it('com o conteúdo já alto, volta de uma vez e não pede quadro nenhum', () => {
    const el = fakeScroller();
    restoreWhenTall(el, 900);
    expect(el.scrollTop).toBe(900);
    expect(frames.pending()).toBe(0);
    expect(el.listenerCount()).toBe(0);
  });

  it('com o conteúdo ainda baixo, tenta de novo a cada quadro e para ao chegar', () => {
    const el = fakeScroller({ contentHeight: 800 });
    restoreWhenTall(el, 900);
    expect(el.scrollTop).toBe(200);
    frames.runNext();
    expect(el.scrollTop).toBe(200);
    expect(frames.pending()).toBe(1);
    el.contentHeight = 5000;
    frames.runNext();
    expect(el.scrollTop).toBe(900);
    expect(frames.pending()).toBe(0);
    expect(el.listenerCount()).toBe(0);
  });

  it('desiste depois do tempo máximo', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const el = fakeScroller({ contentHeight: 800 });
    restoreWhenTall(el, 900, 1500);
    vi.advanceTimersByTime(1500);
    expect(frames.pending()).toBe(0);
    expect(el.listenerCount()).toBe(0);
    el.contentHeight = 5000;
    frames.runNext();
    expect(el.scrollTop).toBe(200);
  });

  it('desiste quando a pessoa rola por conta própria', () => {
    const el = fakeScroller({ contentHeight: 800 });
    restoreWhenTall(el, 900);
    el.fire('wheel');
    expect(frames.pending()).toBe(0);
    expect(el.listenerCount()).toBe(0);
  });

  it('sem requestAnimationFrame, volta o quanto dá e não quebra', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    const el = fakeScroller({ contentHeight: 800 });
    const stop = restoreWhenTall(el, 900);
    expect(el.scrollTop).toBe(200);
    expect(() => stop()).not.toThrow();
  });
});

// Faz as vezes do componente que usa o hook: o React chamaria esta função a
// cada render.
function ScrollProbe({ el }) {
  return useRouteScroll({ current: el });
}

describe('useRouteScroll', () => {
  let cleanup;

  // Um render seguido do commit: roda a limpeza do effect anterior e o effect
  // novo, e devolve o onScroll da vez.
  function renderAt(pathname, key, navigationType, el) {
    m.location = { pathname, key };
    m.navigationType = navigationType;
    const onScroll = ScrollProbe({ el });
    cleanup?.();
    cleanup = m.layoutEffect();
    return onScroll;
  }

  function scrollBy(onScroll, el, top) {
    el.scrollTop = top;
    onScroll({ currentTarget: el });
  }

  beforeEach(() => {
    m.prevRef = null;
    cleanup = undefined;
  });

  it('a primeira montagem não mexe na rolagem', () => {
    const el = fakeScroller();
    el.scrollTop = 300;
    renderAt('/acad/pipeline', 'm1', 'POP', el);
    expect(el.scrollTop).toBe(300);
  });

  it('ir para outra tela vai ao topo, e voltar devolve a posição daquela entrada', () => {
    const el = fakeScroller();
    const onPipeline = renderAt('/acad/pipeline', 'p1', 'POP', el);
    scrollBy(onPipeline, el, 700);
    const onClientes = renderAt('/acad/clientes', 'p2', 'PUSH', el);
    expect(el.scrollTop).toBe(0);
    scrollBy(onClientes, el, 250);
    renderAt('/acad/pipeline', 'p1', 'POP', el);
    expect(el.scrollTop).toBe(700);
    renderAt('/acad/clientes', 'p2', 'POP', el);
    expect(el.scrollTop).toBe(250);
  });

  it('na mesma tela não mexe, mesmo com endereço diferente', () => {
    const el = fakeScroller();
    const onHome = renderAt('/acad', 's1', 'POP', el);
    scrollBy(onHome, el, 400);
    renderAt('/acad/visao-geral/operacional', 's2', 'REPLACE', el);
    expect(el.scrollTop).toBe(400);
  });

  it('cada ficha é uma tela: ir de uma ficha a outra vai ao topo', () => {
    const el = fakeScroller();
    const onFichaA = renderAt('/acad/ficha/A', 'f1', 'POP', el);
    scrollBy(onFichaA, el, 500);
    renderAt('/acad/ficha/B', 'f2', 'PUSH', el);
    expect(el.scrollTop).toBe(0);
  });

  it('sem o div montado (tela de login), não faz nada', () => {
    renderAt('/acad/pipeline', 'l1', 'POP', null);
    expect(() => renderAt('/acad/clientes', 'l2', 'PUSH', null)).not.toThrow();
  });
});
```

A função `ScrollProbe` existe porque o `react-hooks/rules-of-hooks` reprova chamar `useRouteScroll` direto de dentro de um helper comum como `renderAt`. Com nome de componente, o lint aceita, e o teste lê como o React usaria o hook.

- [ ] **Step 7: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/useRouteScroll.test.js`

Expected: FAIL com `Error: Cannot find module '/src/hooks/useRouteScroll.js' imported from .../src/lib/__tests__/useRouteScroll.test.js` e `Tests  no tests`.

- [ ] **Step 8: Criar `src/hooks/useRouteScroll.js`**

```js
import { useCallback, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';
import { parseAppPath, screenKey, scrollActionFor } from '../lib/routes.js';

// Rolagem do container compartilhado do App. O navegador só devolve a rolagem
// da janela, e o app rola dentro de um div, então a memória é nossa: uma
// posição por entrada do histórico (location.key), guardada só nesta aba.
// Ir para outra tela vai ao topo. Voltar ou avançar devolve a posição daquela
// entrada. Na mesma tela, não mexe. Containers internos (colunas da Meta,
// board do Pipeline) ficam de fora nesta entrega.

const MAX_ENTRIES = 100;
const RESTORE_TIMEOUT_MS = 1500;
// Qualquer um destes quer dizer que a pessoa começou a rolar por conta própria.
const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'keydown', 'mousedown'];

// Guarda as últimas `max` posições. Lembrar de novo uma entrada a põe no fim
// da fila, e a mais antiga sai quando passa do teto.
export function createScrollMemory(max = MAX_ENTRIES) {
  const positions = new Map();
  return {
    remember(key, top) {
      positions.delete(key);
      positions.set(key, top);
      if (positions.size > max) positions.delete(positions.keys().next().value);
    },
    recall(key) {
      return positions.get(key) ?? 0;
    },
  };
}

const memory = createScrollMemory();

// A lista da tela pode chegar depois (getDocs) e ainda não ter altura para a
// posição guardada. Tenta de novo a cada quadro, até chegar lá, até passar
// timeoutMs ou até a pessoa rolar. É por quadro, e não por ResizeObserver,
// porque o filho do div que rola tem h-full: a lista pode crescer por dentro
// sem mudar o tamanho da caixa dele. Devolve a função que para as tentativas.
export function restoreWhenTall(el, top, timeoutMs = RESTORE_TIMEOUT_MS) {
  el.scrollTop = top;
  const reached = () => el.scrollTop >= top - 1;
  if (reached() || typeof requestAnimationFrame === 'undefined') return () => {};

  let frame = 0;
  let timer = null;
  const stop = () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    for (const type of USER_SCROLL_EVENTS) el.removeEventListener(type, stop);
  };
  const retry = () => {
    el.scrollTop = top;
    if (reached()) stop();
    else frame = requestAnimationFrame(retry);
  };

  frame = requestAnimationFrame(retry);
  timer = setTimeout(stop, timeoutMs);
  for (const type of USER_SCROLL_EVENTS) el.addEventListener(type, stop, { passive: true });
  return stop;
}

// useRouteScroll(ref) devolve o onScroll do div que rola. A primeira passada
// (montagem) só registra a tela, sem mexer na rolagem.
export function useRouteScroll(ref) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const locationKey = location.key;
  const key = screenKey(parseAppPath(location.pathname));
  const prevKeyRef = useRef(null);

  useLayoutEffect(() => {
    const prevScreenKey = prevKeyRef.current;
    prevKeyRef.current = key;
    const el = ref.current;
    if (!el || prevScreenKey === null) return undefined;

    const action = scrollActionFor({ navigationType, prevScreenKey, screenKey: key });
    if (action === 'top') {
      el.scrollTop = 0;
      return undefined;
    }
    if (action === 'restore') return restoreWhenTall(el, memory.recall(locationKey));
    return undefined;
  }, [ref, navigationType, key, locationKey]);

  return useCallback((event) => {
    memory.remember(locationKey, event.currentTarget.scrollTop);
  }, [locationKey]);
}
```

Por que passa no lint v7: `ref.current` e `prevKeyRef.current` só são lidos e gravados dentro do layout effect, nunca no render; a memória de posições é um objeto de módulo alterado só no `onScroll` (evento), nunca no render; e não há `setState` nenhum. A primeira passada só registra a tela e não chama `scrollActionFor`, então a montagem (inclusive o effect em dobro do StrictMode no dev) nunca mexe na rolagem.

Por que por quadro, e não por `ResizeObserver` como no desenho: lá a nova tentativa vinha de um `ResizeObserver` no primeiro filho do div que rola. No `App.jsx` esse filho é o `<div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto w-full h-full ...">` logo abaixo do `<AppErrorBoundary>`, e com `h-full` a caixa dele pode ficar do mesmo tamanho enquanto a lista cresce por dentro, e aí o observador não dispara. Por isso a nova tentativa é por quadro (`requestAnimationFrame`), com o mesmo teto de 1,5 s.

- [ ] **Step 9: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/useRouteScroll.test.js`

Expected: PASS com `Tests  12 passed (12)`.

- [ ] **Step 10: Lint e suíte inteira**

Run: `npx eslint src/components/RouteRedirect.jsx src/hooks/useRouteScroll.js src/lib/__tests__/routeRedirect.test.js src/lib/__tests__/useRouteScroll.test.js`

Expected: nenhuma saída.

Run: `npx vitest run`

Expected: `Test Files  95 passed (95)` e `Tests  2002 passed (2002)` (1986 + 16).

Run: `npm run lint`

Expected: `✖ 1 problem (0 errors, 1 warning)`, o aviso antigo de `SuperAdminView.jsx:111`.

- [ ] **Step 11: Commit da rolagem**

```bash
git add src/hooks/useRouteScroll.js src/lib/__tests__/useRouteScroll.test.js
git commit -m "$(cat <<'EOF'
feat: rolagem por tela no container do app

Ir para outra tela vai ao topo. Voltar e avançar devolvem a posição
daquela entrada do histórico, tentando de novo por até 1,5 s enquanto a
lista carrega ou até a pessoa rolar. Na mesma tela a rolagem não muda.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Ficha por endereço (hook, rota, esqueleto e ajustes da ficha)

**Depende de:** T1 (`useNavigate` na rota e `MemoryRouter` no teste), T3 e T4 (`hrefFor` e `backTarget` em `src/lib/routes.js`) e T5 (`src/lib/fichaState.js`). Vem depois da T8 só pela ordem do plano.

**Files:**
- Modify: `src/hooks/useProfileLead.js` (reescrito inteiro)
- Modify: `src/hooks/useLeadTimeline.js` (comentário do topo, assinatura, guarda e deps do effect)
- Modify: `src/views/LeadProfileView.jsx` (assinatura do componente na linha 111, chamada do `useLeadTimeline` na linha 115, `handleDelete` nas linhas 216 a 239)
- Modify: `src/components/ui/Skeleton.jsx` (novo `ProfileSkeleton` antes do `ViewSkeleton`, e o export da linha 128)
- Create: `src/views/LeadProfileRoute.jsx`
- Test: `src/lib/__tests__/useProfileLead.test.js`
- Test: `src/lib/__tests__/leadProfileRoute.test.js`

**Estado intermediário esperado, entre o commit da T9 e o da T10.** O `App.jsx` ainda chama `useProfileLead({ db, leadId: profileLeadId })` (linha 1304) e lê `{ lead, loading }`. Com o hook novo, sem `sessionKey`, essa chamada fica em `waiting` e nunca devolve lead, então clicar num lead não abre a ficha até a T10 trocar essa chamada pela `LeadProfileRoute`. Testes, lint e build continuam verdes. Não suba preview entre as duas tarefas. A T9 não toca no `App.jsx` de propósito: os trechos "antes" da T10 continuam valendo.

#### Parte A: `useProfileLead` reescrito

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/__tests__/useProfileLead.test.js`:

```js
// O primeiro render do useProfileLead, sem Firebase de verdade e sem jsdom.
// O renderToString não roda effect, então aqui se confere o que a tela mostra
// antes de qualquer resposta: nunca um lead, e o status certo para cada caso.
// As respostas do Firestore são cobertas pelas funções puras (fichaState).
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('../firebase.js', () => ({ appId: 'acad', LEADS_PATH: 'stronix_leads' }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
}));

const { useProfileLead } = await import('../../hooks/useProfileLead.js');

function Probe(props) {
  const { status, lead, retry } = useProfileLead(props);
  return createElement('output', null, `${status}|${lead ? lead.id : 'sem-lead'}|${typeof retry}`);
}

const render = (props) => renderToString(createElement(Probe, { db: {}, active: true, ...props }));

describe('useProfileLead (primeiro render)', () => {
  it('com sessão e id válido começa carregando, sem lead', () => {
    expect(render({ leadId: 'AbC123xyz', sessionKey: 'acad:u1' })).toContain('loading|sem-lead|function');
  });

  it('sem sessão espera o login', () => {
    expect(render({ leadId: 'AbC123xyz', sessionKey: null })).toContain('waiting|sem-lead|function');
  });

  it('id inválido do endereço é "invalid", com ou sem sessão', () => {
    expect(render({ leadId: 'a/b', sessionKey: 'acad:u1' })).toContain('invalid|sem-lead|function');
    expect(render({ leadId: null, sessionKey: null })).toContain('invalid|sem-lead|function');
  });

  it('com o portão de ociosidade fechado continua carregando, sem lead', () => {
    expect(render({ leadId: 'AbC123xyz', sessionKey: 'acad:u1', active: false })).toContain('loading|sem-lead|function');
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/__tests__/useProfileLead.test.js`
Expected: FAIL, `Tests  4 failed (4)`. O primeiro erro é `AssertionError: expected '<output>undefined|sem-lead|undefined<…' to contain 'loading|sem-lead|function'`, porque o hook de hoje devolve `{ lead, loading }`, sem `status` nem `retry`.

- [ ] **Step 3: Reescrever o hook**

Trocar o conteúdo inteiro de `src/hooks/useProfileLead.js` por:

```js
// Ficha do lead por id, ao vivo. Assina o DOC ÚNICO (onSnapshot), então abre
// qualquer balde (ativo, cliente, perdido, vencido) e reflete na hora o que
// outra pessoa mudar. Quem chama é a LeadProfileRoute, que só existe com o
// login feito: nada daqui sobrevive ao Sair.
//
// Nada de setState dentro do effect. A última resposta fica guardada com a
// chave (sessão, id, tentativa) que a pediu, e o status sai da comparação no
// render (src/lib/fichaState.js). Resposta de chave velha vira "loading".
//
// `sessionKey` vem só do appUser (`${tenantId}:${authUid || id}`), nunca do
// firebaseUser: ele muda antes de o appId trocar de academia, e a leitura iria
// para o caminho errado. `active` é o portão de ociosidade do App: desligado,
// a assinatura cai e a tela fica com a última resposta.

import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { normalizeLeadDoc } from '../lib/leads.js';
import { profileSubscriptionKey, nextProfileSnap, profileStatusFor } from '../lib/fichaState.js';

// useProfileLead({ db, leadId, sessionKey, active }) -> { status, lead, retry }
// lead vem com status 'ready' e, em 'deleted', é o último que apareceu.
export function useProfileLead({ db, leadId, sessionKey, active = true }) {
  const [attempt, setAttempt] = useState(0);
  const [snap, setSnap] = useState(null);
  const key = profileSubscriptionKey({ sessionKey, leadId, attempt });

  useEffect(() => {
    if (!db || !key || !active) return undefined;
    const ref = doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, leadId);
    return onSnapshot(
      ref,
      (s) => setSnap((prev) => nextProfileSnap(prev, key, s.exists() ? normalizeLeadDoc(s) : null, { fromCache: s.metadata.fromCache })),
      (e) => {
        console.error('useProfileLead', e);
        setSnap({ key, status: 'error', lead: null });
      }
    );
  }, [db, key, leadId, active]);

  // "Tentar de novo": tentativa nova é chave nova, e o effect assina de novo.
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const status = profileStatusFor({ leadId, sessionKey, key, snap });
  const lead = status === 'ready' || status === 'deleted' ? snap.lead : null;
  return { status, lead, retry };
}
```

Por que assim: o `active` fica fora da chave. Quando o portão de ociosidade derruba a assinatura e depois religa, a chave é a mesma, a ficha continua na tela sem piscar, e uma exclusão feita durante a ociosidade chega como `deleted`. O `fromCache` vai junto para o `nextProfileSnap`: sem internet, o Firestore responde do cache com o doc ausente depois de alguns segundos, e isso vira o painel "Não deu para abrir a ficha", e não "Ficha não encontrada". O `setLoading(true)` síncrono e o `eslint-disable-next-line react-hooks/set-state-in-effect` da versão antiga saem.

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/lib/__tests__/useProfileLead.test.js`
Expected: PASS, `Tests  4 passed (4)`.

- [ ] **Step 5: Conferir que o eslint-disable saiu e que o lint aceita o hook**

Run: `/usr/bin/grep -n "eslint-disable" src/hooks/useProfileLead.js; npx eslint src/hooks/useProfileLead.js src/lib/__tests__/useProfileLead.test.js`
Expected: nenhuma saída nos dois comandos.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useProfileLead.js src/lib/__tests__/useProfileLead.test.js
git commit -m "$(cat <<'EOF'
refactor: ficha lê o lead com status, nova tentativa e portão de ociosidade

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

#### Parte B: linha do tempo e exclusão obedecem à rota

Sem teste automático nesta parte: o `renderToString` não roda effect, e a `LeadProfileView` importa `src/lib/firebase.js`, que liga o Firebase ao ser importado. As três props novas são conferidas pelo teste da `LeadProfileRoute` (Parte C, "ficha pronta com a carga feita") e o resto pelo lint e pela conferência manual depois da T10.

- [ ] **Step 7: `useLeadTimeline` ganha `active`**

Em `src/hooks/useLeadTimeline.js`, trocar:

```js
// A ficha (LeadProfileView) remonta por lead (key={lead.id}), então o hook não
// precisa resetar entre leads. Sem flag de loading → sem sync-setState no efeito.
```

por:

```js
// A ficha (LeadProfileView) remonta por lead (key={lead.id}), então o hook não
// precisa resetar entre leads. Sem flag de loading → sem sync-setState no efeito.
//
// `active` é o portão de ociosidade do App (15 minutos sem ninguém mexer).
// Desligado, a assinatura cai e a lista fica como estava; religado, assina de
// novo. Uma ficha esquecida numa aba deixa de ficar assinada a noite toda.
```

Depois trocar:

```js
// useLeadTimeline({ db, leadId }) -> interactions[] (mesma forma do prop antigo:
// { id, ...data, createdAt: Date }), ordenadas por createdAt desc.
export function useLeadTimeline({ db, leadId }) {
  const [interactions, setInteractions] = useState([]);

  useEffect(() => {
    if (!db || !leadId) return undefined;
```

por:

```js
// useLeadTimeline({ db, leadId, active }) -> interactions[] (mesma forma do prop
// antigo: { id, ...data, createdAt: Date }), ordenadas por createdAt desc.
export function useLeadTimeline({ db, leadId, active = true }) {
  const [interactions, setInteractions] = useState([]);

  useEffect(() => {
    if (!db || !leadId || !active) return undefined;
```

E trocar:

```js
    return () => unsub();
  }, [db, leadId]);
```

por:

```js
    return () => unsub();
  }, [db, leadId, active]);
```

- [ ] **Step 8: `LeadProfileView` ganha `onDeleteStart`, `onDeleteFailed` e `listenersActive`**

Em `src/views/LeadProfileView.jsx`, trocar (linhas 111 a 115):

```jsx
function LeadProfileView({ lead, onBack, appUser, statuses, tags, lossReasons, usersList, db, funnels }) {
  // Timeline por query própria (G2): histórico COMPLETO do lead (índice #10),
  // ao vivo. Antes vinha do prop global filtrado por leadId — que pós-G2 é só o
  // mês corrente. A ficha remonta por lead (key), então o hook não reseta.
  const interactions = useLeadTimeline({ db, leadId: lead?.id });
```

por:

```jsx
// onBack é o Voltar da rota (voltar do navegador, ou a lista quando a ficha
// abriu direto numa aba nova). onDeleteStart e onDeleteFailed avisam a rota
// para trocar a ficha por "Excluindo a ficha…" e devolver se a exclusão falhar.
// listenersActive é o portão de ociosidade do App, repassado à linha do tempo.
function LeadProfileView({ lead, onBack, onDeleteStart, onDeleteFailed, listenersActive = true, appUser, statuses, tags, lossReasons, usersList, db, funnels }) {
  // Timeline por query própria (G2): histórico COMPLETO do lead (índice #10),
  // ao vivo. Antes vinha do prop global filtrado por leadId — que pós-G2 é só o
  // mês corrente. A ficha remonta por lead (key), então o hook não reseta.
  const interactions = useLeadTimeline({ db, leadId: lead?.id, active: listenersActive });
```

(O travessão do comentário do meio já existia e não é deste PR.)

Depois, no `handleDelete`, trocar:

```jsx
  const handleDelete = async () => {
    if (!window.confirm("Excluir este lead permanentemente? Não dá pra desfazer.")) return;
    setLoading(true);
```

por:

```jsx
  const handleDelete = async () => {
    if (!window.confirm("Excluir este lead permanentemente? Não dá pra desfazer.")) return;
    // A rota troca a ficha por "Excluindo a ficha…" até terminar. Sem isso, o
    // aviso de doc apagado chega antes do fim e a tela piscaria "excluída".
    onDeleteStart?.();
    setLoading(true);
```

E trocar:

```jsx
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id));
      onBack();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao excluir o lead. Tente novamente.');
      setLoading(false);
    }
  };
```

por:

```jsx
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id));
      onBack();
    } catch (e) {
      console.error(e);
      onDeleteFailed?.();
      toast.error('Erro ao excluir o lead. Tente novamente.');
      setLoading(false);
    }
  };
```

O fim com sucesso continua `onBack()`, que na rota é o mesmo Voltar do botão. O "Indicado por" (linha 1216, `openProfile(lead.referredById)`) não muda aqui: quem passa a empilhar o endereço é o `openProfile` da T10.

- [ ] **Step 9: Lint e suíte**

Run: `npx eslint src/hooks/useLeadTimeline.js src/views/LeadProfileView.jsx && npx vitest run`
Expected: o eslint sem saída, e a suíte com `Test Files  96 passed (96)` e `Tests  2006 passed (2006)` (2002 do fim da T8 mais os 4 da Parte A; esta parte não cria teste).

- [ ] **Step 10: Commit**

```bash
git add src/hooks/useLeadTimeline.js src/views/LeadProfileView.jsx
git commit -m "$(cat <<'EOF'
feat: linha do tempo da ficha obedece ao portão de ociosidade e exclusão avisa a rota

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

#### Parte C: `ProfileSkeleton` e `LeadProfileRoute`

- [ ] **Step 11: Escrever o teste da rota, que falha**

Criar `src/lib/__tests__/leadProfileRoute.test.js`:

```js
// O que a rota da ficha desenha em cada estado, renderizado sem jsdom. O hook
// de leitura e a LeadProfileView são falsos: o hook devolve o status que o
// teste mandar, e a view falsa mostra as props que recebeu. Assim o teste não
// precisa de Firebase e confere a ligação inteira da rota.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';

const m = vi.hoisted(() => ({ hook: { status: 'loading', lead: null, retry: () => {} }, calls: [] }));

vi.mock('../../hooks/useProfileLead.js', () => ({
  useProfileLead: (args) => { m.calls.push(args); return m.hook; },
}));
vi.mock('../../views/LeadProfileView.jsx', () => ({
  LeadProfileView: (p) => createElement(
    'div',
    { 'data-ficha': p.lead.id },
    `ficha ${p.lead.name} ativa=${String(p.listenersActive)} voltar=${typeof p.onBack} ` +
    `inicio-exclusao=${typeof p.onDeleteStart} falha-exclusao=${typeof p.onDeleteFailed}`
  ),
}));

const { LeadProfileRoute, FichaPanel } = await import('../../views/LeadProfileRoute.jsx');

const LEAD = { id: 'AbC123xyz', name: 'Ana Duarte', lifecycleStage: 'cliente' };
const BASE = {
  leadId: 'AbC123xyz', tenantId: 'stronix-crm-app', sessionKey: 'stronix-crm-app:u1',
  dataReady: true, listenersActive: true, db: {}, appUser: { id: 'u1', tenantId: 'stronix-crm-app' },
  statuses: [], tags: [], lossReasons: [], usersList: [], funnels: [],
};

const renderRoute = (props = {}) => renderToString(
  createElement(MemoryRouter, { initialEntries: ['/stronix-crm-app/ficha/AbC123xyz'] },
    createElement(LeadProfileRoute, { ...BASE, ...props }))
);
const setHook = (status, lead = null) => { m.hook = { status, lead, retry: () => {} }; };

beforeEach(() => { m.calls.length = 0; setHook('loading'); });

describe('LeadProfileRoute', () => {
  it('passa id, sessão e o portão de ociosidade para a leitura', () => {
    renderRoute({ listenersActive: false });
    expect(m.calls[0]).toEqual({ db: BASE.db, leadId: 'AbC123xyz', sessionKey: 'stronix-crm-app:u1', active: false });
  });

  it('carregando mostra o esqueleto da ficha', () => {
    const html = renderRoute();
    expect(html).toContain('Carregando ficha…');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('data-ficha');
  });

  it('ficha pronta espera os catálogos da academia', () => {
    setHook('ready', LEAD);
    const html = renderRoute({ dataReady: false });
    expect(html).toContain('Carregando ficha…');
    expect(html).not.toContain('data-ficha');
  });

  it('ficha pronta com a carga feita mostra a ficha com os avisos de exclusão e o portão', () => {
    setHook('ready', LEAD);
    const html = renderRoute();
    expect(html).toContain('data-ficha="AbC123xyz"');
    expect(html).toContain('ficha Ana Duarte ativa=true voltar=function inicio-exclusao=function falha-exclusao=function');
  });

  it('doc ausente mostra "não encontrada" sem esperar a carga', () => {
    setHook('missing');
    const html = renderRoute({ dataReady: false });
    expect(html).toContain('Ficha não encontrada');
    expect(html).toContain('Essa pessoa pode ter sido excluída, ou o link é de outra academia.');
    expect(html).toContain('Ir para o início');
    expect(html).not.toContain('Tentar de novo');
    expect(html).not.toContain('Voltar');
  });

  it('id inválido do endereço mostra o mesmo "não encontrada"', () => {
    setHook('invalid');
    expect(renderRoute({ leadId: null })).toContain('Ficha não encontrada');
  });

  it('doc excluído com a ficha aberta avisa e oferece Voltar e início', () => {
    setHook('deleted', LEAD);
    const html = renderRoute({ dataReady: false });
    expect(html).toContain('Essa ficha foi excluída');
    expect(html).toContain('Alguém da equipe excluiu esse cadastro enquanto ele estava aberto.');
    expect(html).toContain('Voltar');
    expect(html).toContain('Ir para o início');
    expect(html).not.toContain('data-ficha');
  });

  it('erro de leitura oferece Tentar de novo e início', () => {
    setHook('error');
    const html = renderRoute({ dataReady: false });
    expect(html).toContain('Não deu para abrir a ficha');
    expect(html).toContain('Pode ser a internet. Tente de novo em alguns segundos.');
    expect(html).toContain('Tentar de novo');
    expect(html).toContain('Ir para o início');
  });
});

describe('FichaPanel', () => {
  const noop = () => {};

  it('durante a exclusão mostra "Excluindo a ficha…" sem botão', () => {
    const html = renderToString(createElement(FichaPanel, { view: 'deleting', onBack: noop, onHome: noop, onRetry: noop }));
    expect(html).toContain('Excluindo a ficha…');
    expect(html).toContain('role="status"');
    expect(html).not.toContain('<button');
  });

  it('os botões são botões de verdade, com type="button"', () => {
    const html = renderToString(createElement(FichaPanel, { view: 'deleted', onBack: noop, onHome: noop, onRetry: noop }));
    expect(html.match(/<button\b[^>]*\btype="button"/g)).toHaveLength(2);
  });

  it('nenhum texto dos avisos usa travessão', () => {
    for (const view of ['deleting', 'deleted', 'error', 'missing']) {
      const html = renderToString(createElement(FichaPanel, { view, onBack: noop, onHome: noop, onRetry: noop }));
      expect(html).not.toMatch(/[—–]/);
    }
  });
});
```

O "Excluindo a ficha…" é testado pelo `FichaPanel` direto porque, no `renderToString`, não dá para disparar o `onDeleteStart` da ficha. A decisão de mostrar esse painel já está coberta pelo `resolveFichaView` (T5).

- [ ] **Step 12: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/__tests__/leadProfileRoute.test.js`
Expected: FAIL, com `Error: Cannot find module '/src/views/LeadProfileRoute.jsx' imported from .../src/lib/__tests__/leadProfileRoute.test.js` e `Tests  no tests`.

- [ ] **Step 13: Criar o `ProfileSkeleton`**

Em `src/components/ui/Skeleton.jsx`, trocar:

```jsx
function ViewSkeleton({ activeTab }) {
```

por:

```jsx
// Esqueleto da ficha, no desenho da LeadProfileView (Voltar, cartão do
// cabeçalho com avatar e as quatro células, abas e a linha do tempo), para a
// troca não pular. Aparece enquanto o doc do lead ou os catálogos da academia
// ainda não chegaram.
function ProfileSkeleton() {
  return (
    <div role="status" aria-busy="true" className="animate-fade-in max-w-[1160px] mx-auto w-full">
      <span className="sr-only">Carregando ficha…</span>
      <Skeleton className="h-8 w-20 mb-3" rounded="rounded-lg" />
      <div className="rounded-2xl border border-border bg-card shadow-card p-5 sm:p-6 mb-5">
        <div className="flex items-start gap-4 sm:gap-5">
          <Skeleton className="size-16 shrink-0" rounded="rounded-full" />
          <div className="flex-1 min-w-0 flex flex-col gap-2 pt-1">
            <Skeleton className="h-3 w-24" rounded="rounded-md" />
            <Skeleton className="h-7 w-64 max-w-full" rounded="rounded-lg" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-2.5 w-16" rounded="rounded" />
              <Skeleton className="h-4 w-28 max-w-full" rounded="rounded-md" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4 h-11 border-b border-border mb-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-24" rounded="rounded-md" />
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card shadow-card p-5 flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10" rounded="rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function ViewSkeleton({ activeTab }) {
```

E trocar a última linha:

```jsx
export { Skeleton, DashboardSkeleton, KanbanSkeleton, LeadsSkeleton, DailyGoalSkeleton, SettingsSkeleton, ViewSkeleton };
```

por:

```jsx
export { Skeleton, DashboardSkeleton, KanbanSkeleton, LeadsSkeleton, DailyGoalSkeleton, SettingsSkeleton, ProfileSkeleton, ViewSkeleton };
```

O `ViewSkeleton` não ganha caso `ficha`: a ficha é desenhada antes do portão do `loadingData` (T10), então o `ViewSkeleton` nunca é chamado para ela.

- [ ] **Step 14: Criar a `LeadProfileRoute`**

Criar `src/views/LeadProfileRoute.jsx`:

```jsx
// Ficha por endereço: /<academia>/ficha/<id>. Só existe dentro do app logado,
// então nada da ficha sobrevive ao Sair. O App monta com key pelo id do
// endereço: pular de uma ficha para outra começa do zero (leitura e exclusão).
//
// O documento começa a ser lido na hora, mas a ficha só aparece com os
// catálogos da academia prontos (dataReady). Até lá fica o ProfileSkeleton.
// "Não encontrada", "excluída" e erro aparecem sem esperar a carga.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, House, LoaderCircle, RefreshCw, SearchX, Trash2, WifiOff } from 'lucide-react';
import { Button } from '../components/ui/button.jsx';
import { ProfileSkeleton } from '../components/ui/Skeleton.jsx';
import { useProfileLead } from '../hooks/useProfileLead.js';
import { resolveFichaView } from '../lib/fichaState.js';
import { backTarget, hrefFor } from '../lib/routes.js';
import { isClientLead } from '../lib/leads.js';
import { cn } from '../lib/utils.js';
import { LeadProfileView } from './LeadProfileView.jsx';

// Moldura dos avisos: ícone, título, texto e botões, centralizados na área da
// tela. Mesmo desenho do "Essa tela travou" (ErrorBoundary.jsx).
function PanelShell({ icon, tone = 'muted', title, text, busy = false, children }) {
  return (
    <div role={busy ? 'status' : undefined} className="grid place-items-center h-full py-24 px-6">
      <div className="w-full max-w-[420px] text-center">
        <span
          className={cn(
            'inline-grid place-items-center size-12 rounded-2xl mb-4',
            tone === 'destructive' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
          )}
        >
          {icon}
        </span>
        <h2 className="font-display text-[20px] font-semibold tracking-tight text-foreground">{title}</h2>
        {text && <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{text}</p>}
        {children && <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{children}</div>}
      </div>
    </div>
  );
}

// Aviso no lugar da ficha. view vem do resolveFichaView: 'deleting', 'deleted',
// 'error' ou 'missing' (que já inclui o id inválido do endereço).
export function FichaPanel({ view, onBack, onHome, onRetry }) {
  if (view === 'deleting') {
    return <PanelShell busy icon={<LoaderCircle className="size-6 animate-spin" />} title="Excluindo a ficha…" />;
  }
  if (view === 'deleted') {
    return (
      <PanelShell
        icon={<Trash2 className="size-6" />}
        title="Essa ficha foi excluída"
        text="Alguém da equipe excluiu esse cadastro enquanto ele estava aberto."
      >
        <Button type="button" variant="outline" onClick={onBack}><ArrowLeft /> Voltar</Button>
        <Button type="button" onClick={onHome}><House /> Ir para o início</Button>
      </PanelShell>
    );
  }
  if (view === 'error') {
    return (
      <PanelShell
        icon={<WifiOff className="size-6" />}
        tone="destructive"
        title="Não deu para abrir a ficha"
        text="Pode ser a internet. Tente de novo em alguns segundos."
      >
        <Button type="button" onClick={onRetry}><RefreshCw /> Tentar de novo</Button>
        <Button type="button" variant="outline" onClick={onHome}><House /> Ir para o início</Button>
      </PanelShell>
    );
  }
  return (
    <PanelShell
      icon={<SearchX className="size-6" />}
      title="Ficha não encontrada"
      text="Essa pessoa pode ter sido excluída, ou o link é de outra academia."
    >
      <Button type="button" onClick={onHome}><House /> Ir para o início</Button>
    </PanelShell>
  );
}

export function LeadProfileRoute({
  leadId, tenantId, sessionKey, dataReady, listenersActive,
  db, appUser, statuses, tags, lossReasons, usersList, funnels,
}) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const { status, lead, retry } = useProfileLead({ db, leadId, sessionKey, active: listenersActive });
  const view = resolveFichaView({ status, dataReady, deleting });

  // A exclusão termina depois de vários await. Se a pessoa já saiu da ficha
  // nesse meio tempo, o Voltar do fim da exclusão não pode mexer no histórico
  // da tela em que ela está agora.
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Voltar: o histórico é lido na hora do clique, nunca no render. Com uma tela
  // do app antes desta, é o voltar do navegador. Aberta direto numa aba nova,
  // troca a ficha pela lista (Clientes para cliente, Pipeline para lead).
  const goBack = () => {
    if (!mountedRef.current) return;
    const target = backTarget({ historyState: window.history.state, isClient: isClientLead(lead), tenantId });
    if (target.type === 'back') navigate(-1);
    else if (target.href) navigate(target.href, { replace: true });
  };
  const goHome = () => {
    const href = hrefFor(tenantId, 'dashboard');
    if (href) navigate(href, { replace: true });
  };

  if (view === 'loading') return <ProfileSkeleton />;
  if (view !== 'ready') return <FichaPanel view={view} onBack={goBack} onHome={goHome} onRetry={retry} />;
  return (
    <LeadProfileView
      key={lead.id}
      lead={lead}
      onBack={goBack}
      onDeleteStart={() => setDeleting(true)}
      onDeleteFailed={() => setDeleting(false)}
      listenersActive={listenersActive}
      appUser={appUser}
      statuses={statuses}
      tags={tags}
      lossReasons={lossReasons}
      usersList={usersList}
      db={db}
      funnels={funnels}
    />
  );
}
```

Por que cada escolha:

- **`mountedRef` no `goBack`.** Conferido no fonte do `react-router` 7.18.4 (`dist/development/chunk-OB3PAWPO.mjs`, linhas 6006 a 6013): o `useNavigate` liga um `activeRef` num layout effect e nunca desliga no desmonte. Sem a guarda, quem clica em Excluir e vai para o Pipeline antes de a exclusão terminar levaria um `navigate(-1)` atrasado e voltaria para a ficha apagada. O lint do repositório aceita a leitura do ref dentro do handler (conferido com a config do CI).
- **Durante a exclusão a `LeadProfileView` sai da tela.** O "Excluindo a ficha…" entra no lugar dela, o que também derruba a assinatura da linha do tempo enquanto as interações são apagadas. Se a exclusão falhar, `onDeleteFailed` devolve a ficha, que volta na aba Linha do tempo.
- **`deleted` guarda o último lead** (T5), então o Voltar do aviso sabe se era cliente e cai em Clientes quando a ficha foi aberta direto numa aba nova.
- **"Ir para o início" usa `replace`.** O endereço da ficha que não abre não fica na pilha do voltar.
- **`FichaPanel` é exportado** para o teste do "Excluindo a ficha…". O arquivo só exporta componentes, então a regra `react-refresh/only-export-components` passa sem exceção.
- **Botões:** `Button` do shadcn com `type="button"`; o tamanho do ícone vem da própria classe do `Button` (`[&_svg:not([class*='size-'])]:size-4`), por isso os ícones dentro dos botões não levam classe.

- [ ] **Step 15: Rodar o teste e ver passar**

Run: `npx vitest run src/lib/__tests__/leadProfileRoute.test.js`
Expected: PASS, `Tests  11 passed (11)`.

- [ ] **Step 16: Lint dos arquivos da tarefa**

Run: `npx eslint src/views/LeadProfileRoute.jsx src/components/ui/Skeleton.jsx src/hooks/useProfileLead.js src/hooks/useLeadTimeline.js src/views/LeadProfileView.jsx src/lib/fichaState.js src/lib/__tests__/leadProfileRoute.test.js src/lib/__tests__/useProfileLead.test.js src/lib/__tests__/fichaState.test.js`
Expected: nenhuma saída.

- [ ] **Step 17: Suíte inteira e lint do repositório**

Run: `npx vitest run && npm run lint`
Expected: `Test Files  97 passed (97)` e `Tests  2017 passed (2017)` (2002 do fim da T8 mais 15: 4 da Parte A e 11 da Parte C). O lint termina com `✖ 1 problem (0 errors, 1 warning)`, o aviso antigo de `src/views/superadmin/SuperAdminView.jsx:111`.

- [ ] **Step 18: Commit**

```bash
git add src/components/ui/Skeleton.jsx src/views/LeadProfileRoute.jsx src/lib/__tests__/leadProfileRoute.test.js
git commit -m "$(cat <<'EOF'
feat: ficha por endereço com esqueleto próprio e avisos de não encontrada, excluída e erro

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: App.jsx, núcleo (tela, ficha e subaba derivadas do endereço)

O `AppInner` deixa de guardar a tela em estado. A cada render ele lê `useLocation()`, passa o caminho por `parseAppPath` e `routeDecision` (T3/T4) e desenha a tela mostrada (`shown`): a do endereço, ou a de destino quando o endereço não vale para a sessão. `activeTab`, `resolvedTab`, `profileLeadId` e `superTab` continuam com esses nomes, então as views e as cerca de 60 leituras não mudam. Um módulo puro novo, `src/lib/appShell.js`, guarda a parte testável dessa derivação (a origem da ficha, a chave da sessão e a academia do endereço para a tela de login).

Pré-requisitos no repositório: T1 (react-router e `BrowserRouter`), T2 (`src/lib/tenantSlug.js`), T3 e T4 (`src/lib/routes.js`), T7 (`LeadProfileContext` com `leadHref` e `from`), T8 (`RouteRedirect` e `useRouteScroll`) e T9 (`LeadProfileRoute` e o `useProfileLead` novo). Os trechos "Antes" abaixo são os da main `f509d9e`. Nenhuma task anterior mexe em `src/App.jsx`; se alguma tiver mexido num desses trechos, refaça o "Antes" pelo arquivo real antes de editar.

**Files:**
- Create: `src/lib/appShell.js`
- Test: `src/lib/__tests__/appShell.test.js`
- Modify: `src/App.jsx` (imports 1-109; `App()` 115-127; `getTenantSlug` 149-165; estados 179-201 e 367 (`loadingData`); efeitos do slug e do título 253-281; `justCreatedLeadId` 375-384 e 860-871; assinatura dos contratos 772-779; login 407-413 e 495-508; navegação 1279-1306; efeito do super-admin 1405-1409; casca 1441-1442, 1511-1516, 1551-1552, 1632-1694 e 1698-1712)

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/lib/__tests__/appShell.test.js` com este conteúdo:

```js
// A casca do App lê a tela, a ficha e a subaba do super-admin do endereço
// (src/lib/appShell.js). Estes testes travam o que o menu acende e o que a ficha
// recebe, sem montar o App, que depende do Firebase.

import { describe, it, expect } from 'vitest';
import { parseAppPath } from '../routes.js';
import { fichaOrigin, screenState, sessionKeyFor, loginTenantSlug } from '../appShell.js';

const T = 'stronix-crm-app';
const consultor = { id: 'u1', authUid: 'uid-1', role: 'consultor', tenantId: T };
const gestor = { id: 'u2', authUid: 'uid-2', role: 'admin', tenantId: T };
const superMembro = { id: 'u3', authUid: 'uid-3', role: 'admin', tenantId: T, superAdmin: true };

describe('screenState', () => {
  it('tela comum: o menu acende a tela do endereço e não há ficha', () => {
    const s = screenState(parseAppPath(`/${T}/pipeline`), null, consultor);
    expect(s).toEqual({ fichaOpen: false, profileLeadId: null, activeTab: 'kanban', resolvedTab: 'kanban', superTab: 'overview' });
  });

  it('endereço curto da academia abre o Operacional', () => {
    const s = screenState(parseAppPath(`/${T}`), null, consultor);
    expect(s.activeTab).toBe('dashboard');
    expect(s.resolvedTab).toBe('dashOperacional');
  });

  it('ficha aberta a partir de uma tela mantém a tela de origem acesa', () => {
    const s = screenState(parseAppPath(`/${T}/ficha/AbC123`), { from: 'dailyGoal' }, consultor);
    expect(s.fichaOpen).toBe(true);
    expect(s.profileLeadId).toBe('AbC123');
    expect(s.activeTab).toBe('dailyGoal');
    expect(s.resolvedTab).toBe('dailyGoal');
  });

  it('ficha aberta direto numa aba nova vira a tela "ficha"', () => {
    const s = screenState(parseAppPath(`/${T}/ficha/AbC123`), null, consultor);
    expect(s.activeTab).toBe('ficha');
    expect(s.resolvedTab).toBe('ficha');
  });

  it('id de ficha inválido deixa a ficha aberta sem id (painel de não encontrada)', () => {
    const s = screenState(parseAppPath(`/${T}/ficha/..`), null, consultor);
    expect(s.fichaOpen).toBe(true);
    expect(s.profileLeadId).toBeNull();
  });

  it('subaba do super-admin vem do endereço', () => {
    expect(screenState(parseAppPath(`/${T}/super-admin/planos`), null, superMembro).superTab).toBe('plans');
    expect(screenState(parseAppPath(`/${T}/super-admin`), null, superMembro).superTab).toBe('overview');
  });

  it('sem tela conhecida (antes do login, endereço estranho) cai na tela inicial', () => {
    const s = screenState({ screen: null, leadId: null, superTab: null }, null, null);
    expect(s.activeTab).toBe('dashboard');
    expect(s.fichaOpen).toBe(false);
  });
});

describe('fichaOrigin', () => {
  it('aceita tela conhecida que a sessão vê', () => {
    expect(fichaOrigin({ from: 'kanban' }, consultor)).toBe('kanban');
    expect(fichaOrigin({ from: 'dashCrm' }, consultor)).toBe('dashCrm');
  });

  it('tela de gestor só vale para gestor', () => {
    expect(fichaOrigin({ from: 'settings' }, consultor)).toBeNull();
    expect(fichaOrigin({ from: 'settings' }, gestor)).toBe('settings');
  });

  it('recusa a própria ficha, tela desconhecida, nome herdado do objeto e lixo', () => {
    expect(fichaOrigin({ from: 'ficha' }, gestor)).toBeNull();
    expect(fichaOrigin({ from: 'xyz' }, gestor)).toBeNull();
    expect(fichaOrigin({ from: 'toString' }, gestor)).toBeNull();
    expect(fichaOrigin({ from: 42 }, gestor)).toBeNull();
    expect(fichaOrigin(null, gestor)).toBeNull();
    expect(fichaOrigin('kanban', gestor)).toBeNull();
  });
});

describe('sessionKeyFor', () => {
  it('academia mais o uid do login', () => {
    expect(sessionKeyFor(consultor)).toBe(`${T}:uid-1`);
  });

  it('sem authUid usa o id do usuário', () => {
    expect(sessionKeyFor({ id: 'u9', tenantId: T })).toBe(`${T}:u9`);
  });

  it('sem sessão de academia não há chave', () => {
    expect(sessionKeyFor(null)).toBeNull();
    expect(sessionKeyFor({ id: 'x', authUid: 'x', superAdminOnly: true, tenantId: null })).toBeNull();
    expect(sessionKeyFor({ tenantId: T })).toBeNull();
  });
});

describe('loginTenantSlug', () => {
  it('lê a academia do caminho, em minúsculas', () => {
    expect(loginTenantSlug({ pathname: '/Stronix-CRM-App/ficha/AbC', hash: '' })).toBe(T);
    expect(loginTenantSlug({ pathname: `/${T}` })).toBe(T);
  });

  it('palavra de tela no caminho não é academia', () => {
    expect(loginTenantSlug({ pathname: '/pipeline', hash: '' })).toBeNull();
    expect(loginTenantSlug({ pathname: '/', hash: '' })).toBeNull();
  });

  it('mantém o hash dos links antigos', () => {
    expect(loginTenantSlug({ pathname: '/', hash: '#academia-power-club' })).toBe('academia-power-club');
    expect(loginTenantSlug({ pathname: '/', hash: '#/t/petros-barbell-club' })).toBe('petros-barbell-club');
    expect(loginTenantSlug({ pathname: '/', hash: '#/Academia-Shape-One?x=1' })).toBe('academia-shape-one');
  });

  it('hash com palavra reservada ou fora do formato não vale', () => {
    expect(loginTenantSlug({ pathname: '/', hash: '#pipeline' })).toBeNull();
    expect(loginTenantSlug({ pathname: '/', hash: '#ab c' })).toBeNull();
    expect(loginTenantSlug({})).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/__tests__/appShell.test.js`
Expected: FAIL com `Error: Cannot find module '../appShell.js'` e `Test Files  1 failed (1)`.

- [ ] **Step 3: Criar o módulo**

Crie `src/lib/appShell.js`:

```js
// O que o App (src/App.jsx) tira do endereço e da sessão a cada render. Puro de
// propósito, sem React e sem Firebase, para ser testado em node. A tabela de
// telas e a decisão de rota moram em routes.js; aqui fica só o que é da casca
// do App: qual tela o menu acende, qual ficha está aberta e a chave da sessão.

import { HOME_SCREEN, SCREENS, canAccess, parseAppPath } from './routes.js';
import { TENANT_SLUG_READ_RE, isReservedTenantSlug } from './tenantSlug.js';

const isScreenId = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(SCREENS, id);

// Tela de onde a ficha foi aberta, guardada no state da navegação
// ({ from: 'kanban' }). Mantém o menu aceso e o título do cabeçalho da origem.
// O state vive no histórico do navegador e pode vir de qualquer lugar, então só
// vale tela conhecida, que não seja a ficha e que esta sessão possa ver.
export function fichaOrigin(state, appUser) {
  const from = state && typeof state === 'object' ? state.from : null;
  if (!isScreenId(from) || from === 'ficha') return null;
  return canAccess(from, appUser) ? from : null;
}

// Os nomes de sempre do App, agora calculados a partir da tela mostrada
// (shown: a do endereço, ou a de destino quando routeDecision redireciona).
// - activeTab: com a ficha aberta, a tela de origem, ou 'ficha' quando ela foi
//   aberta direto numa aba nova. 'dashboard' é o endereço curto /<academia>.
// - resolvedTab: troca 'dashboard' pelo Operacional, como antes.
// - profileLeadId: id da ficha, ou null quando o id do endereço é inválido
//   (a ficha continua aberta e mostra "Ficha não encontrada").
export function screenState(shown, locationState, appUser) {
  const fichaOpen = shown?.screen === 'ficha';
  const activeTab = fichaOpen
    ? (fichaOrigin(locationState, appUser) ?? 'ficha')
    : (shown?.screen ?? HOME_SCREEN);
  return {
    fichaOpen,
    profileLeadId: fichaOpen ? (shown.leadId ?? null) : null,
    activeTab,
    resolvedTab: activeTab === HOME_SCREEN ? 'dashOperacional' : activeTab,
    superTab: shown?.superTab ?? 'overview',
  };
}

// Chave da sessão para a ficha (useProfileLead). Sai só do appUser, nunca do
// firebaseUser: no "Acessar como" o usuário do Firebase troca antes de a
// academia do módulo (appId) trocar, e a ficha leria a academia errada.
export function sessionKeyFor(appUser) {
  if (!appUser || appUser.superAdminOnly || !appUser.tenantId) return null;
  const who = appUser.authUid || appUser.id;
  return who ? `${appUser.tenantId}:${who}` : null;
}

// Academia do endereço, só para a marca da tela de login. Primeiro o caminho
// (/<academia>/...), depois o hash dos links antigos (#<academia>, #/<academia>,
// #/t/<academia>). Palavra de tela (/pipeline, #pipeline) não é academia.
export function loginTenantSlug({ pathname = '', hash = '' } = {}) {
  const fromPath = parseAppPath(pathname).tenantSlug;
  if (fromPath) return fromPath;
  const raw = String(hash || '').replace(/^#\/?(t\/)?/i, '').trim().toLowerCase();
  const slug = raw.split(/[/?#&]/)[0];
  return TENANT_SLUG_READ_RE.test(slug) && !isReservedTenantSlug(slug) ? slug : null;
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/lib/__tests__/appShell.test.js`
Expected: `Tests  17 passed (17)`.

- [ ] **Step 5: Imports do App.jsx**

Em `src/App.jsx`, cinco trocas.

Antes:

```jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
```

Depois:

```jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
```

Antes:

```jsx
import { useProfileLead } from './hooks/useProfileLead.js';
```

Depois:

```jsx
import { useRouteScroll } from './hooks/useRouteScroll.js';
```

Antes:

```jsx
import { IDLE_RUN, runStatusFor, settleRun, EMPTY_SETUP_FLAGS, setupFlagsFromConfig, setupFlagFor } from './lib/setupRun.js';
```

Depois:

```jsx
import { IDLE_RUN, runStatusFor, settleRun, EMPTY_SETUP_FLAGS, setupFlagsFromConfig, setupFlagFor } from './lib/setupRun.js';
import { parseAppPath, routeDecision, hrefFor, screenKey, documentTitle } from './lib/routes.js';
import { screenState, sessionKeyFor, loginTenantSlug } from './lib/appShell.js';
```

Antes:

```jsx
import { LeadProfileView } from './views/LeadProfileView.jsx';
```

Depois:

```jsx
import { LeadProfileRoute } from './views/LeadProfileRoute.jsx';
```

Antes:

```jsx
import { AppErrorBoundary } from './components/ErrorBoundary.jsx';
```

Depois:

```jsx
import { AppErrorBoundary } from './components/ErrorBoundary.jsx';
import { RouteRedirect } from './components/RouteRedirect.jsx';
```

- [ ] **Step 6: Comentários do `App()` e fim do `getTenantSlug`**

O `App()` externo continua decidindo `/i/<slug>` e `?invite=&t=` uma vez só, pelo `window.location`, antes do `AppInner`. Só os comentários mudam.

Antes:

```jsx
  // Roteamento mínimo por query-param (app single-page, sem react-router):
  // /?invite=<token>&t=<tenantId> abre a tela pública de aceite de convite.
```

Depois:

```jsx
  // Rotas públicas, decididas uma vez aqui e fora das telas do app logado
  // (src/lib/routes.js). /?invite=<token>&t=<tenantId> abre o aceite de
  // convite. Por isso invite, t e ref nunca podem virar parâmetro de tela.
```

Antes:

```jsx
  // /i/<slug>?ref=<idDoCliente> abre a página PÚBLICA de indicação (fase 2).
  // O segmento "i" é reservado: tem 1 letra e slugs reais têm 3+ (TENANT_ID_RE
  // do provisionamento), então o getTenantSlug abaixo nunca colide com ele.
```

Depois:

```jsx
  // /i/<slug>?ref=<idDoCliente> abre a página PÚBLICA de indicação (fase 2).
  // O segmento "i" é palavra reservada (src/lib/tenantSlug.js): nenhuma
  // academia pode ter esse identificador.
```

O `getTenantSlug` sai. A leitura da academia do endereço passa a ser `loginTenantSlug` (appShell.js), que usa o `parseAppPath` e mantém o hash dos links antigos. A diferença: palavra de tela (`/pipeline`) deixa de virar marca de academia no login.

Antes:

```jsx
// Lê o slug da academia da URL: primeiro o PATH (stronilead.com.br/<slug>) e,
// como compatibilidade com links antigos, o HASH (#<slug>, #/slug, #/t/slug).
// Retorna '' se não houver/for inválido.
function getTenantSlug() {
  const re = /^[a-z0-9][a-z0-9-]{0,63}$/;
  try {
    // 1) path-based: /<slug>
    const seg = String(window.location.pathname || '').replace(/^\/+/, '').split('/')[0].trim().toLowerCase();
    if (re.test(seg)) return seg;
    // 2) fallback: hash
    const raw = String(window.location.hash || '').replace(/^#\/?(t\/)?/i, '').trim().toLowerCase();
    const h = raw.split(/[/?#&]/)[0];
    return re.test(h) ? h : '';
  } catch {
    return '';
  }
}

function AppInner() {
```

Depois:

```jsx
function AppInner() {
```

- [ ] **Step 7: Marca do login e nome da academia da sessão**

Antes:

```jsx
  // Academia identificada pela URL (#<slug>) — só para exibir a MARCA no login.
  // NÃO controla acesso (isso continua sendo o claim tenantId + as rules).
  // Formato: { slug, loading? , found?, displayName? }. Init lazy a partir do hash.
  const [urlTenant, setUrlTenant] = useState(() => {
    const slug = getTenantSlug();
    return slug ? { slug, loading: true } : null;
  });
```

Depois:

```jsx
  // Academia identificada pelo endereço, só para exibir a MARCA no login.
  // NÃO controla acesso (isso continua sendo o claim tenantId + as rules).
  // Formato: { slug, loading? , found?, displayName? }.
  const [urlTenant, setUrlTenant] = useState(() => {
    const slug = loginTenantSlug(window.location);
    return slug ? { slug, loading: true } : null;
  });
  // Nome da academia da sessão, lido do doc tenants/{id} no login. Vai no
  // título da aba.
  const [tenantDisplayName, setTenantDisplayName] = useState('');
```

- [ ] **Step 8: Tela, ficha e subaba derivadas do endereço**

Este bloco substitui os `useState` de `activeTab` e `profileLeadId`. As linhas de `settingsTab` que vêm logo depois ficam como estão (a T12 cuida delas).

Antes:

```jsx
  const [activeTab, setActiveTab] = useState('dashboard');
  // 'dashboard' é um SENTINEL (estado inicial e pós-logout): a Visão geral abre
  // no Operacional para todo mundo. CRM e Gerencial estão "Em breve".
  const resolvedTab = activeTab === 'dashboard' ? 'dashOperacional' : activeTab;
  // As três abas da Visão geral. O grupo do menu fica aberto enquanto uma
  // delas está ativa; fora delas, vale o toggle do usuário.
  const isDashTab = resolvedTab === 'dashOperacional' || resolvedTab === 'dashCrm' || resolvedTab === 'dashGerencial';
  // Ficha-página (lead/cliente): id em foco. A ficha SOBREPÕE o conteúdo da
  // aba ativa (não troca activeTab), então o "Voltar" só limpa este id e a
  // aba reaparece sozinha.
  const [profileLeadId, setProfileLeadId] = useState(null);
```

Depois:

```jsx
  // O endereço manda na tela (src/lib/routes.js). Nada disto é estado: a tela,
  // a ficha e a subaba do super-admin saem do endereço a cada render, e
  // routeDecision diz se o endereço vale para esta sessão. Quando não vale, a
  // tela de destino já é desenhada neste render (shown) e o <RouteRedirect>
  // troca o endereço com replace. Assim a tela barrada nunca pisca e nenhum
  // effect lê o endereço para dar setState.
  const location = useLocation();
  const navigate = useNavigate();
  const route = useMemo(() => parseAppPath(location.pathname), [location.pathname]);
  const decision = routeDecision(route, appUser, { search: location.search });
  const shown = decision.kind === 'redirect' && decision.target ? decision.target : route;
  // activeTab, resolvedTab, profileLeadId e superTab continuam com os nomes de
  // sempre (src/lib/appShell.js). 'dashboard' é o endereço curto /<academia> e
  // abre o Operacional. Com a ficha aberta, activeTab é a tela de onde ela foi
  // aberta (menu aceso e título da origem), ou 'ficha' quando ela foi aberta
  // direto numa aba nova.
  const { fichaOpen, profileLeadId, activeTab, resolvedTab, superTab } = screenState(shown, location.state, appUser);
  // As três abas da Visão geral. O grupo do menu fica aberto enquanto uma
  // delas está ativa; fora delas, vale o toggle do usuário.
  const isDashTab = resolvedTab === 'dashOperacional' || resolvedTab === 'dashCrm' || resolvedTab === 'dashGerencial';
  // Academia da sessão para montar endereços. Vem do claim, nunca do endereço.
  const sessionTenant = appUser && !appUser.superAdminOnly ? appUser.tenantId : null;
  // Chave da sessão da ficha: sair e entrar, ou o "Acessar como", refazem a
  // leitura da ficha na academia certa mesmo com o mesmo id no endereço.
  const sessionKey = sessionKeyFor(appUser);
  // Rolagem do conteúdo por entrada do histórico: voltar devolve a posição.
  const contentScrollRef = useRef(null);
  const onContentScroll = useRouteScroll(contentScrollRef);
```

Apague a linha do estado da subaba do super-admin (ela vem do endereço agora):

Apagar este trecho:

```jsx
  const [superTab, setSuperTab] = useState('overview'); // sub-seção do super-admin (no menu lateral)
```

- [ ] **Step 9: Efeitos do slug e do título**

O effect do `/api/tenant-resolve` continua rodando uma vez no mount nesta task (a T11 o restringe à tela de login). Só troca a leitura:

Antes:

```jsx
  // Resolve a academia do hash da URL (#<slug>) para exibir o nome na tela de
  // login. Público (pré-auth) via /api/tenant-resolve. Roda uma vez no mount.
  useEffect(() => {
    const slug = getTenantSlug();
    if (!slug) return;
```

Depois:

```jsx
  // Resolve a academia do endereço para exibir o nome na tela de login.
  // Público (pré-auth) via /api/tenant-resolve. Roda uma vez no mount.
  useEffect(() => {
    const slug = loginTenantSlug(window.location);
    if (!slug) return;
```

O `replaceState` cru sai. Ele apagava o resto do caminho e o `history.state` do roteador (`usr`, `key`, `idx`), e o Voltar da ficha depende do `idx`. A correção do slug agora é o `routeDecision` com o `RouteRedirect`. O título passa a dizer a tela.

Antes:

```jsx
  // Mantém a URL (/<slug>) em sincronia com o tenant real após o login — cada
  // academia fica com um link próprio e bookmarkável (stronilead.com.br/<slug>).
  // O acesso vem do claim; se a URL apontava para outra academia, é apenas
  // corrigida (sem bloquear ninguém). replaceState não recarrega a página.
  useEffect(() => {
    if (appUser && !appUser.superAdminOnly && appUser.tenantId) {
      if (getTenantSlug() !== appUser.tenantId) {
        try { window.history.replaceState(null, '', '/' + appUser.tenantId + window.location.search); } catch { /* noop */ }
      }
    }
  }, [appUser]);

  // Título da aba do navegador: nome da academia (quando resolvido) + STRONILEAD.
  useEffect(() => {
    document.title = urlTenant?.displayName ? `${urlTenant.displayName} · STRONILEAD` : 'STRONILEAD';
  }, [urlTenant]);
```

Depois:

```jsx
  // Título da aba: "<Tela> · <Academia> · STRONILEAD". Na ficha, só "Ficha",
  // nunca o nome da pessoa, porque o título fica no histórico do navegador.
  // Antes do login continua "<Academia> · STRONILEAD".
  const titleScreen = appUser && !appUser.superAdminOnly && !tenantBlock ? (fichaOpen ? 'ficha' : resolvedTab) : null;
  const titleTenant = appUser ? (appUser.superAdminOnly ? '' : tenantDisplayName) : (urlTenant?.displayName || '');
  useEffect(() => {
    document.title = documentTitle({ screen: titleScreen, tenantName: titleTenant });
  }, [titleScreen, titleTenant]);
```

- [ ] **Step 10: Sai o `justCreatedLeadId`**

O "Ver ficha" do cadastro navega direto (Step 15). O estado e o effect que esperava o lead aparecer na lista de ativos saem, com o `eslint-disable` dele.

Antes:

```jsx
  const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState(false);

  // Após criar o lead, abrimos a ficha-página dele automaticamente. Como o
  // `addDoc` retorna só o ref, esperamos o lead aparecer em `leads` via
  // onSnapshot (geralmente <100ms). justCreatedLeadId é o ID alvo; ao chegar,
  // viramos profileLeadId (abre a LeadProfileView).
  const [justCreatedLeadId, setJustCreatedLeadId] = useState(null);
```

Depois:

```jsx
  const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState(false);
```

Apagar este trecho e também a linha em branco que vem logo depois dele:

```jsx
  // Quando um lead é criado pelo AddLeadModal global, ele guarda o ID em
  // justCreatedLeadId. Aqui esperamos o doc aparecer em `leads` (via
  // onSnapshot) e abrimos o perfil dele automaticamente.
  useEffect(() => {
    if (!justCreatedLeadId) return;
    const lead = (leads || []).find(l => l.id === justCreatedLeadId);
    if (lead) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reage à chegada assíncrona do lead via onSnapshot; abrir a ficha só quando o doc aparece exige effect.
      setProfileLeadId(lead.id);
      setJustCreatedLeadId(null);
    }
  }, [justCreatedLeadId, leads]);
```

- [ ] **Step 11: Nome da academia gravado no login**

Dentro do callback do `onAuthStateChanged` (setState em callback assíncrono, o mesmo padrão dos vizinhos, que o lint aceita).

Antes:

```jsx
    if (!currentUser) {
      setAppUser(null);
      setTenantBlock(null);
      setTrialEndsAtMs(null);
      setIsAuthChecking(false);
      return;
    }
```

Depois:

```jsx
    if (!currentUser) {
      setAppUser(null);
      setTenantBlock(null);
      setTrialEndsAtMs(null);
      setTenantDisplayName('');
      setIsAuthChecking(false);
      return;
    }
```

Antes:

```jsx
          setTenantBlock(block);
          setTrialEndsAtMs(trialMs);
          setBillingDue(billingWarn);
        } catch (statusErr) {
          console.warn('Falha ao ler status do tenant; liberando acesso.', statusErr);
          setTenantBlock(null);
          setTrialEndsAtMs(null);
          setBillingDue(null);
        }
      } else {
        setTenantBlock(null);
        setTrialEndsAtMs(null);
        setBillingDue(null);
      }
```

Depois:

```jsx
          setTenantBlock(block);
          setTrialEndsAtMs(trialMs);
          setBillingDue(billingWarn);
          setTenantDisplayName(tData?.displayName || tenantId);
        } catch (statusErr) {
          console.warn('Falha ao ler status do tenant; liberando acesso.', statusErr);
          setTenantBlock(null);
          setTrialEndsAtMs(null);
          setBillingDue(null);
          setTenantDisplayName(tenantId);
        }
      } else {
        setTenantBlock(null);
        setTrialEndsAtMs(null);
        setBillingDue(null);
        setTenantDisplayName('');
      }
```

- [ ] **Step 12: Navegação por endereço**

O `handleLogout` perde o `setActiveTab` (a T11 reescreve a função inteira):

Antes:

```jsx
  setAppUser(null);
  setActiveTab('dashboard');
};
```

Depois:

```jsx
  setAppUser(null);
};
```

`changeTab` e `openProfile` passam a navegar. O `closeProfile` sai: o Voltar da ficha é da `LeadProfileRoute` (T9), que lê o `idx` no clique pelo `backTarget`. O `useProfileLead` sai do App e vive na `LeadProfileRoute`. A linha do `openSettingsTab` logo abaixo do trecho fica igual.

Antes:

```jsx
  // Trocar de aba SEMPRE fecha a ficha-página aberta (senão o gate profileLead
  // continuaria sobrepondo o conteúdo e a navegação parecia "travada").
  const changeTab = (tab) => { setActiveTab(tab); setProfileLeadId(null); setIsMobileMenuOpen(false); }
  // Abre a ficha-página de um lead/cliente (sobrepõe o conteúdo da aba ativa);
  // lembra a aba de origem para o "Voltar". closeProfile volta para ela.
  const openProfile = useCallback((leadId) => {
    if (leadId) setProfileLeadId(leadId);
  }, []);
  const closeProfile = useCallback(() => { setProfileLeadId(null); }, []);
  const leadProfileValue = useMemo(() => ({ openProfile }), [openProfile]);
  // Lead/cliente em foco na ficha-página (G1-flip): assina o DOC ÚNICO por id
  // (useProfileLead, onSnapshot ao vivo) em vez de achar no prop global — assim a
  // ficha de cliente/perda abre mesmo com o prop reduzido a 'ativo' no flip.
  // profileLoading cobre o instante da 1ª leitura (evita piscar a aba por baixo).
  const { lead: profileLead, loading: profileLoading } = useProfileLead({ db, leadId: profileLeadId });
  // Abre Configurações já numa aba específica (sidebar e link "Regras gerais" do Perfil).
```

Depois:

```jsx
  // Trocar de tela é trocar de endereço. Clicar na tela em que já se está troca
  // a entrada atual em vez de empilhar outra (senão o voltar parece não fazer
  // nada). extra leva a subaba do super-admin: { superTab: 'plans' }.
  const changeTab = (tab, extra) => {
    const href = hrefFor(sessionTenant, tab, extra);
    if (href) navigate(href, { replace: href === location.pathname });
    setIsMobileMenuOpen(false);
  };
  // Tela de onde a próxima ficha é aberta. Vai no state da navegação (só o id
  // da tela, nunca dado da pessoa) para o menu continuar aceso e o título
  // continuar o da origem. Numa ficha aberta direto não há origem.
  const profileFrom = activeTab === 'ficha' ? null : activeTab;
  // Abrir a ficha empilha o endereço /<academia>/ficha/<id>, e o Voltar da ficha
  // é o voltar do navegador (LeadProfileRoute). A mesma ficha não empilha de
  // novo. Continua memoizado: o KanbanCard é memo e recebe esta função.
  const openProfile = useCallback((leadId) => {
    const href = hrefFor(sessionTenant, 'ficha', { leadId });
    if (!href) return;
    navigate(href, { replace: href === location.pathname, state: profileFrom ? { from: profileFrom } : null });
  }, [navigate, sessionTenant, location.pathname, profileFrom]);
  // Endereço da ficha, para os links que abrem em outra aba (LeadLink).
  const leadHref = useCallback((leadId) => hrefFor(sessionTenant, 'ficha', { leadId }), [sessionTenant]);
  const leadProfileValue = useMemo(() => ({ openProfile, leadHref, from: profileFrom }), [openProfile, leadHref, profileFrom]);
  // Abre Configurações já numa aba específica (sidebar e link "Regras gerais" do Perfil).
```

- [ ] **Step 13: Sai o effect que forçava a tela do super-admin**

Ele era a origem da tela em branco depois do "Acessar como". O super-admin puro nunca chega à casca (retorna o `SuperConsole` antes), então nada mais depende dele.

Apagar este trecho e também a linha em branco que vem logo depois dele:

```jsx
  // Super-admin sem tenant entra direto na tela "Organizações" (única que vê).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- redireciona o superadmin-only para sua única aba ao montar/resolver o appUser.
    if (appUser?.superAdminOnly) setActiveTab('superadmin');
  }, [appUser]);
```

- [ ] **Step 14: Casca: troca de endereço, menu do super-admin e título "Ficha"**

Antes:

```jsx
    <GeneralConfigContext.Provider value={generalConfigValue}>
    <LeadProfileContext.Provider value={leadProfileValue}>
```

Depois:

```jsx
    <GeneralConfigContext.Provider value={generalConfigValue}>
    <LeadProfileContext.Provider value={leadProfileValue}>
    {/* Endereço que não vale para esta sessão: a tela de destino já está
        desenhada abaixo, e isto só troca o endereço (replace) e mostra o
        aviso. A key nova a cada endereço dá uma troca por endereço barrado. */}
    {decision.kind === 'redirect' && <RouteRedirect key={location.key} to={decision.to} notice={decision.notice} />}
```

O `RouteRedirect` fica dentro do `ToastProvider`, que o `App()` já põe em volta do `AppInner` (`src/App.jsx:139`). Fora dele o `useToast` devolveria objeto novo a cada render, e o effect do redirect rodaria de novo a cada render.

Os itens do grupo Organizações passam a subaba pelo endereço (a T12 transforma esses itens em link):

Antes:

```jsx
                    onToggle={() => { changeTab('superadmin'); setSuperTab('overview'); }}
                  >
                    <SidebarSubItem label="Visão Geral" active={activeTab === 'superadmin' && superTab === 'overview'} onClick={() => { changeTab('superadmin'); setSuperTab('overview'); }} />
                    <SidebarSubItem label="Clientes" active={activeTab === 'superadmin' && superTab === 'clients'} onClick={() => { changeTab('superadmin'); setSuperTab('clients'); }} />
                    <SidebarSubItem label="Financeiro" active={activeTab === 'superadmin' && superTab === 'finance'} onClick={() => { changeTab('superadmin'); setSuperTab('finance'); }} />
                    <SidebarSubItem label="Planos" active={activeTab === 'superadmin' && superTab === 'plans'} onClick={() => { changeTab('superadmin'); setSuperTab('plans'); }} />
```

Depois:

```jsx
                    onToggle={() => changeTab('superadmin', { superTab: 'overview' })}
                  >
                    <SidebarSubItem label="Visão Geral" active={activeTab === 'superadmin' && superTab === 'overview'} onClick={() => changeTab('superadmin', { superTab: 'overview' })} />
                    <SidebarSubItem label="Clientes" active={activeTab === 'superadmin' && superTab === 'clients'} onClick={() => changeTab('superadmin', { superTab: 'clients' })} />
                    <SidebarSubItem label="Financeiro" active={activeTab === 'superadmin' && superTab === 'finance'} onClick={() => changeTab('superadmin', { superTab: 'finance' })} />
                    <SidebarSubItem label="Planos" active={activeTab === 'superadmin' && superTab === 'plans'} onClick={() => changeTab('superadmin', { superTab: 'plans' })} />
```

Ficha aberta direto numa aba nova: o cabeçalho diz "Ficha".

Antes:

```jsx
              {activeTab === 'superadmin' && (({ overview: 'Visão Geral', clients: 'Clientes', finance: 'Financeiro', plans: 'Planos' }[superTab] || 'Organizações') + ' · Super-admin')}
            </h2>
```

Depois:

```jsx
              {activeTab === 'superadmin' && (({ overview: 'Visão Geral', clients: 'Clientes', finance: 'Financeiro', plans: 'Planos' }[superTab] || 'Organizações') + ' · Super-admin')}
              {activeTab === 'ficha' && 'Ficha'}
            </h2>
```

- [ ] **Step 15: Conteúdo: rolagem, tela de erro por tela e ficha antes do carregamento**

O ramo `appUser.superAdminOnly` dentro da casca era código morto (o super-admin puro retorna o `SuperConsole` antes) e sai. A ficha vem antes do `loadingData`. O fragmento que envolvia as views some junto com o ternário antigo, então o fechamento também muda.

A ficha também espera os contratos da academia. O `loadingData` vira `false` com os leads ativos, e os contratos (na STRONIX, os 494 importados mais os vendidos desde junho) chegam por outra assinatura, em geral depois. Sem essa espera, a ficha de um cliente aberta direto numa aba nova mostraria a aba Contratos com 0, e o trancamento e o "renovado de" vazios, por um instante. Primeiro, dois trechos antes da casca.

Antes:

```jsx
  const [loadingData, setLoadingData] = useState(true);
```

Depois:

```jsx
  const [loadingData, setLoadingData] = useState(true);
  // Academia cujos contratos já chegaram. A ficha espera por eles, e não só
  // pelo loadingData, que vira false com os leads ativos: sem isso, a ficha de
  // um cliente aberta direto numa aba nova mostraria a aba Contratos vazia.
  const [contractsTenant, setContractsTenant] = useState(null);
```

No effect de leitura de dados, o callback da assinatura dos contratos. Antes:

```jsx
  const unsubContratos = onSnapshot(
    collection(db, 'artifacts', appId, 'public', 'data', CONTRACTS_PATH),
    (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setContratos(data);
    },
    onSnapErr('contratos')
  );
```

Depois:

```jsx
  const unsubContratos = onSnapshot(
    collection(db, 'artifacts', appId, 'public', 'data', CONTRACTS_PATH),
    (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setContratos(data);
      setContractsTenant(configTenant);
    },
    onSnapErr('contratos')
  );
```

O `configTenant` é a `const configTenant = appId;` do mesmo effect, declarada antes das assinaturas. É setState dentro do callback do `onSnapshot`, igual aos vizinhos, e não no corpo do effect: o `react-hooks/set-state-in-effect` não reclama. No "Acessar como", `contractsTenant` fica com a academia anterior até os contratos da assumida chegarem, e a ficha espera. Se alguma assinatura falhar (`loadError`), a ficha não fica presa no esqueleto.

Agora a casca. Antes:

```jsx
        <div className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 relative custom-scrollbar">
          {/* Envolve só o conteúdo, não o shell: view que quebra não leva
              junto a barra lateral nem o cabeçalho. */}
          <AppErrorBoundary>
          {appUser.superAdminOnly ? (
            <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto w-full h-full">
              <SuperAdminView tab={superTab} onOpenConsole={() => setConsoleOpen(true)} />
            </div>
          ) : loadingData ? (
            <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto w-full h-full">
              <ViewSkeleton activeTab={activeTab} />
            </div>
          ) : (
            <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto w-full h-full transition-all duration-300">
              {profileLead ? (
                <LeadProfileView
                  key={profileLead.id}
                  lead={profileLead}
                  onBack={closeProfile}
                  appUser={appUser}
                  statuses={statuses}
                  tags={tags}
                  lossReasons={lossReasons}
                  usersList={usersList}
                  db={db}
                  funnels={funnels}
                />
              ) : (profileLeadId && profileLoading) ? (
                <div className="grid place-items-center h-full py-24 text-[13px] text-slate-400 dark:text-neutral-500 animate-pulse">Carregando ficha…</div>
              ) : (<>
```

Depois:

```jsx
        <div ref={contentScrollRef} onScroll={onContentScroll} className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 relative custom-scrollbar">
          {/* Envolve só o conteúdo, não o shell: view que quebra não leva
              junto a barra lateral nem o cabeçalho. A key é a tela mostrada:
              trocar de tela limpa a tela de erro, sem precisar do "Tentar de novo". */}
          <AppErrorBoundary key={screenKey(shown)}>
          {fichaOpen ? (
            // A ficha vem antes do loadingData: a leitura do documento começa na
            // hora, mas ela só aparece pronta depois dos catálogos e dos
            // contratos (dataReady). "Não encontrada" e erro não esperam a carga.
            <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto w-full h-full">
              <LeadProfileRoute
                key={profileLeadId ?? 'sem-id'}
                leadId={profileLeadId}
                tenantId={appUser.tenantId}
                sessionKey={sessionKey}
                dataReady={!loadingData && (contractsTenant === appUser.tenantId || loadError)}
                listenersActive={listenersActive}
                db={db}
                appUser={appUser}
                statuses={statuses}
                tags={tags}
                lossReasons={lossReasons}
                usersList={usersList}
                funnels={funnels}
              />
            </div>
          ) : loadingData ? (
            <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto w-full h-full">
              <ViewSkeleton activeTab={activeTab} />
            </div>
          ) : (
            <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto w-full h-full transition-all duration-300">
```

Antes:

```jsx
              {activeTab === 'superadmin' && appUser?.superAdmin && <SuperAdminView tab={superTab} onOpenConsole={() => setConsoleOpen(true)} />}
              </>)}
            </div>
```

Depois:

```jsx
              {activeTab === 'superadmin' && appUser?.superAdmin && <SuperAdminView tab={superTab} onOpenConsole={() => setConsoleOpen(true)} />}
            </div>
```

Antes:

```jsx
      {/* Quick-add lead, alcançável de qualquer aba pelo botão do menu lateral
          ou pelo botão da LeadsView. Ao salvar, abrimos automaticamente o
          perfil do lead recém-criado (via justCreatedLeadId → useEffect). */}
```

Depois:

```jsx
      {/* Quick-add lead, alcançável de qualquer aba pelo botão do menu lateral
          ou pelo botão da LeadsView. O "Ver ficha" abre na hora a ficha do lead
          recém-criado, porque ela lê o documento pelo id. */}
```

Antes:

```jsx
          onCreated={(newLeadId) => setJustCreatedLeadId(newLeadId)}
```

Depois:

```jsx
          onCreated={openProfile}
```

- [ ] **Step 16: Conferir que nenhum nome antigo sobrou**

Run: `git grep -n -E "getTenantSlug|setActiveTab|setProfileLeadId|setSuperTab|justCreatedLeadId|profileLoading|closeProfile|useProfileLead\(|LeadProfileView" -- src/App.jsx`
Expected: nenhuma linha (código de saída 1).

Run: `/usr/bin/grep -c "eslint-disable" src/App.jsx`
Expected: `10` (eram 12 na main: saíram o do effect do `justCreatedLeadId` e o do effect que forçava `activeTab = 'superadmin'`, os dois `react-hooks/set-state-in-effect`; nenhum entrou).

- [ ] **Step 17: Lint, testes e build**

Run: `npm run lint`
Expected: `✖ 1 problem (0 errors, 1 warning)`, só o aviso antigo de `src/views/superadmin/SuperAdminView.jsx` (useEffect sem `loadPlans` e `loadTenants`).

Run: `npx vitest run`
Expected: `Test Files  98 passed (98)` e `Tests  2034 passed (2034)` (2017 + 17).

Run: `npm run build`
Expected: termina com `✓ built in ...` e sai com código 0.

- [ ] **Step 18: Commit**

```bash
git add src/lib/appShell.js src/lib/__tests__/appShell.test.js src/App.jsx
git commit -m "$(cat <<'EOF'
feat: app lê a tela, a ficha e a subaba do endereço

O App deixa de guardar a tela em estado: activeTab, profileLeadId e
superTab saem do endereço a cada render, com routeDecision e RouteRedirect
no lugar do replaceState cru. A ficha abre pela LeadProfileRoute antes do
carregamento e só aparece com os contratos da academia na mão, o título da
aba diz a tela e trocar de tela limpa a tela de erro. Saem o justCreatedLeadId e o effect que forçava a tela do super-admin.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

**Para o checklist do PR (fica para a T14, não fazer agora).** Nunca com o dev local apontado para a produção. O preview usa o Firebase de produção (`src/lib/firebase.js` cai no projeto `crm-stronix`). Tudo que cria ou apaga dado é feito na `academia-teste`, com um lead cadastrado só para o teste.
- F5 em `/<academia>`, `/<academia>/pipeline`, `/<academia>/leads/aulas`, `/<academia>/visao-geral/crm` e `/<academia>/super-admin/planos` (super-admin membro): a tela fica e o menu acende o item certo.
- Voltar e avançar do navegador entre Pipeline, Clientes e Meta diária.
- Abrir uma ficha pela Meta: o item Meta diária continua aceso e o cabeçalho continua "Sua Meta Diária". Colar o endereço da ficha numa aba nova: o cabeçalho diz "Ficha" e o título da aba é "Ficha · <Academia> · STRONILEAD".
- Consultor em `/<academia>/configuracoes`: aparece o Operacional sem piscar Configurações, o endereço vira `/<academia>` e o aviso "Essa tela é só do gestor." aparece.
- `/<academia>/xyz`: Operacional com "Não achamos essa tela. Abrimos o Operacional.". `/`, `/pipeline` e `/outra-academia/pipeline` logado: vai para a academia da sessão, sem aviso.
- Na `academia-teste`, Cadastrar lead e clicar em "Ver ficha": a ficha abre na hora.
- Rolar o Operacional, abrir uma ficha pela busca e voltar: a rolagem volta.

---

### Task 11: App.jsx, sessão (sair com recarga, volta do "Acessar como", login e funil salvo)

Quatro consertos de sessão que o endereço exige. Sair recarrega a página no login da academia, para nada da sessão anterior sobrar na memória num computador compartilhado. O "Sair da visualização" volta ao endereço de onde o super-admin entrou. O `/api/tenant-resolve` só é chamado quando a tela de login vai aparecer. E o funil escolhido no Pipeline é relido no login, com a academia certa, para o F5 não perder a escolha.

**Files:**
- Modify: `src/lib/appShell.js` (criado na T10)
- Test: `src/lib/__tests__/appShell.test.js` (criado na T10)
- Modify: `src/App.jsx` (estados perto do topo, efeito da marca do login, funil 326-332 e 851-858, callback do login na linha `setTenantId(...)`, `stopImpersonation` e `handleLogout`, carregando e bloco do `superAdminOnly`)
- Modify: `src/views/console/SuperConsole.jsx:1144` (1141 na main; a T2 acrescenta três linhas acima)
- Modify: `src/views/superadmin/SuperAdminView.jsx:67-68`

**Depende de:** T10. Os trechos "Antes" de `src/App.jsx` são os que a T10 deixou. O do `SuperAdminView.jsx` é o da main. O do `SuperConsole.jsx` também: a T2 mexe nele em outras linhas (import e validação da Nova academia).

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/__tests__/appShell.test.js`, troque o import:

```js
import { fichaOrigin, screenState, sessionKeyFor, loginTenantSlug } from '../appShell.js';
```

por:

```js
import {
  fichaOrigin, screenState, sessionKeyFor, loginTenantSlug,
  loginBrand, logoutDestination, returnToFrom, savedFunnelKey, readSavedFunnel,
} from '../appShell.js';
```

E acrescente no fim do arquivo:

```js

describe('loginBrand', () => {
  it('sem academia no endereço, sem marca', () => {
    expect(loginBrand(null, { slug: T, found: true, displayName: 'STRONIX' })).toBeNull();
  });

  it('carregando até a resposta daquela academia chegar', () => {
    expect(loginBrand(T, null)).toEqual({ slug: T, loading: true });
    expect(loginBrand(T, { slug: 'outra', found: true, displayName: 'Outra' })).toEqual({ slug: T, loading: true });
  });

  it('com a resposta da mesma academia, a resposta', () => {
    const r = { slug: T, found: true, displayName: 'STRONIX' };
    expect(loginBrand(T, r)).toBe(r);
    expect(loginBrand('xyz', { slug: 'xyz', found: false })).toEqual({ slug: 'xyz', found: false });
  });
});

describe('logoutDestination', () => {
  it('membro volta para o login da própria academia', () => {
    expect(logoutDestination(consultor)).toBe(`/${T}`);
    expect(logoutDestination(gestor)).toBe(`/${T}`);
  });

  it('super-admin puro e sessão assumida vão para o login geral', () => {
    expect(logoutDestination({ id: 'x', superAdminOnly: true, tenantId: null })).toBe('/');
    expect(logoutDestination({ ...gestor, tenantId: 'academia-shape-one', impersonating: true })).toBe('/');
  });

  it('sem sessão, login geral', () => {
    expect(logoutDestination(null)).toBe('/');
  });
});

describe('returnToFrom', () => {
  const assumida = { ...gestor, tenantId: 'academia-shape-one', impersonating: true };

  it('guarda a academia assumida e o endereço de onde o super-admin entrou', () => {
    expect(returnToFrom({ viewing: { id: 'academia-shape-one' }, returnPath: `/${T}/super-admin/clientes` }, assumida))
      .toEqual({ fromTenant: 'academia-shape-one', path: `/${T}/super-admin/clientes` });
    expect(returnToFrom({ returnPath: '/' }, assumida)).toEqual({ fromTenant: 'academia-shape-one', path: '/' });
  });

  it('entrada antiga sem returnPath não tem volta', () => {
    expect(returnToFrom({ viewing: { id: 'academia-shape-one' } }, assumida)).toBeNull();
    expect(returnToFrom(null, assumida)).toBeNull();
  });

  it('só aceita caminho do próprio site', () => {
    expect(returnToFrom({ returnPath: '//evil.example/x' }, assumida)).toBeNull();
    expect(returnToFrom({ returnPath: 'https://evil.example/' }, assumida)).toBeNull();
    expect(returnToFrom({ returnPath: '/\\evil.example' }, assumida)).toBeNull();
    expect(returnToFrom({ returnPath: 42 }, assumida)).toBeNull();
  });

  it('sem academia na sessão não há volta', () => {
    expect(returnToFrom({ returnPath: `/${T}` }, null)).toBeNull();
  });
});

describe('funil salvo', () => {
  const storage = (data) => ({ getItem: (k) => (k in data ? data[k] : null) });

  it('a chave é por academia', () => {
    expect(savedFunnelKey('academia-shape-one')).toBe('crm-selected-funnel:academia-shape-one');
  });

  it('lê o funil salvo da academia certa', () => {
    const s = storage({ 'crm-selected-funnel:academia-shape-one': 'f-shape', [`crm-selected-funnel:${T}`]: 'f-stronix' });
    expect(readSavedFunnel(s, 'academia-shape-one')).toBe('f-shape');
    expect(readSavedFunnel(s, T)).toBe('f-stronix');
  });

  it('nada salvo, sem academia ou armazenamento bloqueado dá null', () => {
    expect(readSavedFunnel(storage({}), T)).toBeNull();
    expect(readSavedFunnel(storage({ x: 'y' }), '')).toBeNull();
    expect(readSavedFunnel({ getItem: () => { throw new Error('bloqueado'); } }, T)).toBeNull();
    expect(readSavedFunnel(null, T)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/appShell.test.js`
Expected: FAIL com `TypeError: loginBrand is not a function` (e os equivalentes das outras funções), `Tests  13 failed | 17 passed (30)`.

- [ ] **Step 3: Acrescentar as funções ao módulo**

Em `src/lib/appShell.js`, troque o import de rotas:

```js
import { HOME_SCREEN, SCREENS, canAccess, parseAppPath } from './routes.js';
```

por:

```js
import { HOME_SCREEN, SCREENS, canAccess, hrefFor, parseAppPath } from './routes.js';
```

E acrescente no fim do arquivo:

```js
// Marca da academia na tela de login: nada sem academia no endereço, "carregando"
// até a resposta do /api/tenant-resolve daquela academia chegar, e a resposta
// só quando ela é da academia do endereço de agora.
export function loginBrand(slug, resolved) {
  if (!slug) return null;
  if (resolved && resolved.slug === slug) return resolved;
  return { slug, loading: true };
}

// Para onde o Sair leva, com recarga da página: o login da própria academia
// para quem é membro, e o login geral (/) para o super-admin puro e para quem
// está vendo outra academia pelo "Acessar como".
export function logoutDestination(appUser) {
  if (!appUser || appUser.superAdminOnly || appUser.impersonating || !appUser.tenantId) return '/';
  return hrefFor(appUser.tenantId, HOME_SCREEN) || '/';
}

// Volta do "Sair da visualização": o endereço gravado no "Acessar como"
// (returnPath) e a academia assumida, que é a do endereço no momento da volta.
// routeDecision só usa quando o endereço ainda é da academia assumida e o
// caminho é da academia da sessão. Só aceita caminho do próprio site.
export function returnToFrom(record, appUser) {
  const path = record && typeof record === 'object' ? record.returnPath : null;
  const fromTenant = appUser?.tenantId || null;
  if (!fromTenant || typeof path !== 'string') return null;
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null;
  return { fromTenant, path };
}

// Funil escolhido no Pipeline, salvo por academia no navegador.
export const savedFunnelKey = (tenantId) => `crm-selected-funnel:${tenantId}`;

export function readSavedFunnel(storage, tenantId) {
  if (!tenantId) return null;
  try { return storage?.getItem(savedFunnelKey(tenantId)) || null; } catch { return null; }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/appShell.test.js`
Expected: `Tests  30 passed (30)`.

- [ ] **Step 5: Imports e estados novos do App.jsx**

Antes:

```jsx
import { screenState, sessionKeyFor, loginTenantSlug } from './lib/appShell.js';
```

Depois:

```jsx
import {
  screenState, sessionKeyFor, loginTenantSlug,
  loginBrand, logoutDestination, returnToFrom, savedFunnelKey, readSavedFunnel,
} from './lib/appShell.js';
```

Antes:

```jsx
  const [isAuthChecking, setIsAuthChecking] = useState(true);
```

Depois:

```jsx
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  // Saindo (Sair, ou fim da visualização sem volta): a página vai recarregar no
  // login. Até lá, nada de tela de login nem de /api/tenant-resolve.
  const [leaving, setLeaving] = useState(false);
```

A marca do login deixa de ser estado com valor inicial lido do endereço. Fica só a resposta do `/api/tenant-resolve`, e a marca mostrada é calculada (Step 6). O estado da volta do "Acessar como" entra aqui, antes da decisão de rota, que lê ele.

Antes:

```jsx
  // Academia identificada pelo endereço, só para exibir a MARCA no login.
  // NÃO controla acesso (isso continua sendo o claim tenantId + as rules).
  // Formato: { slug, loading? , found?, displayName? }.
  const [urlTenant, setUrlTenant] = useState(() => {
    const slug = loginTenantSlug(window.location);
    return slug ? { slug, loading: true } : null;
  });
```

Depois:

```jsx
  // Resposta do /api/tenant-resolve para a MARCA da academia na tela de login:
  // { slug, found, displayName? }. NÃO controla acesso (isso continua sendo o
  // claim tenantId + as rules). A marca mostrada (urlTenant) é derivada abaixo.
  const [resolvedBrand, setResolvedBrand] = useState(null);
  // Volta do "Sair da visualização": { fromTenant, path, key }. routeDecision
  // leva ao endereço do "Acessar como", só na entrada do histórico `key`.
  const [returnTo, setReturnTo] = useState(null);
```

Antes:

```jsx
  const decision = routeDecision(route, appUser, { search: location.search });
```

Depois:

```jsx
  const decision = routeDecision(route, appUser, { search: location.search, returnTo: returnTo?.key === location.key ? returnTo : null });
```

O `location` já existe aqui: a T10 o declara logo acima, no bloco que substituiu o estado da tela. A volta só vale na entrada do histórico em que o "Sair da visualização" foi clicado (Step 8). Depois do replace para o caminho guardado a `key` muda, e voltar do navegador até as entradas da academia que estava assumida, ou colar um endereço dela, segue as regras de sempre.

- [ ] **Step 6: `/api/tenant-resolve` só na tela de login**

Com sessão, o nome da academia vem do `tenantDisplayName` (T10). O "carregando" é derivado por `loginBrand`, sem setState síncrono no effect.

Antes:

```jsx
  // Resolve a academia do endereço para exibir o nome na tela de login.
  // Público (pré-auth) via /api/tenant-resolve. Roda uma vez no mount.
  useEffect(() => {
    const slug = loginTenantSlug(window.location);
    if (!slug) return;
    let alive = true;
    fetch(`/api/tenant-resolve?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(d => { if (alive) setUrlTenant(d?.found ? { slug, found: true, displayName: d.displayName } : { slug, found: false }); })
      .catch(() => { if (alive) setUrlTenant({ slug, found: false }); });
    return () => { alive = false; };
  }, []);
```

Depois:

```jsx
  // Marca da academia na tela de login. O /api/tenant-resolve só é chamado
  // quando a tela de login vai aparecer: com sessão, o nome vem do doc
  // tenants/{id} que o login já lê (tenantDisplayName), e o F5 de quem já está
  // logado deixa de gastar a cota por IP da recepção. Enquanto a resposta não
  // chega, a marca fica "carregando" (loginBrand), sem setState no effect.
  const loginSlug = !isAuthChecking && !appUser && !leaving ? loginTenantSlug(location) : null;
  useEffect(() => {
    if (!loginSlug) return undefined;
    let alive = true;
    fetch(`/api/tenant-resolve?slug=${encodeURIComponent(loginSlug)}`)
      .then(r => r.json())
      .then(d => { if (alive) setResolvedBrand(d?.found ? { slug: loginSlug, found: true, displayName: d.displayName } : { slug: loginSlug, found: false }); })
      .catch(() => { if (alive) setResolvedBrand({ slug: loginSlug, found: false }); });
    return () => { alive = false; };
  }, [loginSlug]);
  const urlTenant = loginBrand(loginSlug, resolvedBrand);
```

- [ ] **Step 7: Funil salvo relido no login**

Hoje o estado inicial lê a chave com o `appId` padrão, porque o `setTenantId` ainda não rodou, e o F5 no Pipeline volta ao funil padrão em toda academia que não é a STRONIX.

Antes:

```jsx
  // Seleção de funil persistida POR TENANT (a chave inclui o appId). No init o
  // tenant ainda não foi resolvido (appId = default), o que é correto para o
  // tenant #1; para outros tenants, um id de funil "estranho" é auto-corrigido
  // pelo effect de validação de funil (cai no default).
  const [selectedFunnelId, setSelectedFunnelId] = useState(() => {
    try { return localStorage.getItem(`crm-selected-funnel:${appId}`) || null; } catch { return null; }
  });
```

Depois:

```jsx
  // Seleção de funil persistida POR ACADEMIA (savedFunnelKey). Começa vazia: a
  // academia só é conhecida no login, e é lá que o funil salvo é lido
  // (readSavedFunnel, logo depois do setTenantId). Sem nada salvo, o effect de
  // validação de funil escolhe o padrão.
  const [selectedFunnelId, setSelectedFunnelId] = useState(null);
```

No callback do `onAuthStateChanged`, logo depois do `setTenantId`:

Antes:

```jsx
      setTenantId(tenantId || DEFAULT_TENANT_ID);
```

Depois:

```jsx
      setTenantId(tenantId || DEFAULT_TENANT_ID);
      // Funil escolhido no Pipeline, salvo por academia. Só aqui se sabe qual é
      // a academia; lida antes disso, a chave era a da academia padrão e o F5
      // perdia a escolha em toda academia que não é a STRONIX.
      setSelectedFunnelId(readSavedFunnel(localStorage, tenantId || DEFAULT_TENANT_ID));
```

No effect que grava a escolha:

Antes:

```jsx
        localStorage.setItem(`crm-selected-funnel:${appId}`, selectedFunnelId);
```

Depois:

```jsx
        localStorage.setItem(savedFunnelKey(appId), selectedFunnelId);
```

- [ ] **Step 8: Sair com recarga e volta do "Acessar como"**

A ordem do "Sair da visualização" que o PR 1 deixou (`signInWithCustomToken` antes do `setPersistence`) não muda.

Antes:

```jsx
  const stopImpersonation = async () => {
    setExitingImpersonation(true);
    try { sessionStorage.removeItem(IMPERSONATION_KEY); } catch { /* ignore */ }
```

Depois:

```jsx
  // Sai da conta e recarrega a página no destino. A recarga zera a ficha, as
  // listas em memória, a academia do módulo (appId) e as configurações de
  // funil: num computador de recepção, quem entra depois não vê nada da sessão
  // anterior. O await garante que a sessão já saiu do navegador antes da recarga.
  const leaveTo = async (destino) => {
    setLeaving(true);
    try { await signOut(auth); } catch (e) { console.error('Erro ao sair do sistema', e); }
    try { sessionStorage.removeItem(IMPERSONATION_KEY); } catch { /* ignore */ }
    window.location.replace(destino);
  };

  const stopImpersonation = async () => {
    setExitingImpersonation(true);
    // Endereço de onde o super-admin entrou na visualização (returnPath, gravado
    // no "Acessar como"). Sem ele, a volta cai na tela inicial da academia.
    const back = returnToFrom(readImpersonation(), appUser);
    // Vale só nesta entrada do histórico: depois do replace da volta, a key muda
    // e o caminho guardado deixa de mandar.
    setReturnTo(back && { ...back, key: location.key });
    try { sessionStorage.removeItem(IMPERSONATION_KEY); } catch { /* ignore */ }
```

Antes:

```jsx
      } else {
        // Retorno indisponível (claim já expirado): sai com segurança para o login.
        await signOut(auth);
      }
    } catch (e) {
      console.error('stopImpersonation', e);
      try { await signOut(auth); } catch { /* ignore */ }
    }
    setImpersonation(null);
    setExitingImpersonation(false);
  };

  const handleLogout = async () => {
  try {
    await signOut(auth);
  } catch (e) {
    console.error('Erro ao sair do sistema', e);
  }

  setAppUser(null);
};
```

Depois:

```jsx
      } else {
        // Retorno indisponível (claim já expirado): sai com segurança para o
        // login geral, e não para o da academia que estava sendo vista.
        await leaveTo('/');
        return;
      }
    } catch (e) {
      console.error('stopImpersonation', e);
      await leaveTo('/');
      return;
    }
    setImpersonation(null);
    setExitingImpersonation(false);
  };

  // Sair: login da própria academia para membro, login geral para o super-admin
  // puro e para quem está vendo outra academia (logoutDestination).
  const handleLogout = () => leaveTo(logoutDestination(appUser));
```

- [ ] **Step 9: Tela de carregando ao sair e super-admin puro sempre em "/"**

Antes:

```jsx
  if (isAuthChecking) {
```

Depois:

```jsx
  if (isAuthChecking || leaving) {
```

Antes:

```jsx
  if (appUser.superAdminOnly) {
    return <SuperConsole appUser={appUser} onClose={handleLogout} />;
  }
```

Depois:

```jsx
  if (appUser.superAdminOnly) {
    // O Console não tem endereços nesta entrega: a barra fica em "/", para não
    // mostrar a academia da visualização de onde o super-admin acabou de sair.
    return (
      <>
        {decision.kind === 'redirect' && <RouteRedirect key={location.key} to={decision.to} notice={decision.notice} />}
        <SuperConsole appUser={appUser} onClose={handleLogout} />
      </>
    );
  }
```

- [ ] **Step 10: "Acessar como" grava o endereço de volta**

Os dois caminhos de entrada gravam `returnPath` no objeto da `IMPERSONATION_KEY`. É leitura de `window.location` dentro do handler, sem roteador, e o lint aceita sem `eslint-disable` novo.

Em `src/views/console/SuperConsole.jsx`:

Antes:

```jsx
      try { sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify({ viewing: { id: t.id, name: data.tenantName || t.displayName } })); } catch { /* ignore */ }
```

Depois:

```jsx
      // returnPath: o "Sair da visualização" volta para este endereço.
      try { sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify({ viewing: { id: t.id, name: data.tenantName || t.displayName }, returnPath: window.location.pathname })); } catch { /* ignore */ }
```

Em `src/views/superadmin/SuperAdminView.jsx` (o `eslint-disable` de `react-hooks/purity` da linha do `at: Date.now()` já existe e continua logo acima dela):

Antes:

```jsx
        sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify({
          viewing: { id: tenant.id, name: data.tenantName || tenant.displayName },
```

Depois:

```jsx
        sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify({
          viewing: { id: tenant.id, name: data.tenantName || tenant.displayName },
          // O "Sair da visualização" volta para este endereço.
          returnPath: window.location.pathname,
```

- [ ] **Step 11: Conferir que nada antigo sobrou**

Run: `git grep -n -E "setUrlTenant|crm-selected-funnel" -- src/App.jsx`
Expected: nenhuma linha (código de saída 1).

Run: `/usr/bin/grep -c "eslint-disable" src/App.jsx`
Expected: `10` (igual ao fim da T10: nenhum entrou nem saiu).

- [ ] **Step 12: Lint, testes e build**

Run: `npm run lint`
Expected: `✖ 1 problem (0 errors, 1 warning)`, o mesmo aviso antigo, agora em `src/views/superadmin/SuperAdminView.jsx:113` (duas linhas abaixo, por causa do Step 10).

Run: `npx vitest run`
Expected: `Test Files  98 passed (98)` e `Tests  2047 passed (2047)` (2034 + 13).

Run: `npm run build`
Expected: termina com `✓ built in ...` e sai com código 0.

- [ ] **Step 13: Commit**

```bash
git add src/lib/appShell.js src/lib/__tests__/appShell.test.js src/App.jsx src/views/console/SuperConsole.jsx src/views/superadmin/SuperAdminView.jsx
git commit -m "$(cat <<'EOF'
feat: sair recarrega no login da academia e a visualização volta ao lugar

Sair espera o signOut, limpa a visualização e recarrega em /<academia>
(ou em / para super-admin), então nada da sessão anterior sobra na
memória. O Acessar como grava o endereço de volta e o Sair da
visualização retorna a ele. O super-admin puro fica sempre em /, o
tenant-resolve só roda na tela de login e o funil do Pipeline é relido
no login com a academia certa.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

**Para o checklist do PR (fica para a T14, não fazer agora).** Nunca com o dev local apontado para a produção.
- Sair pelo menu da conta: a tela recarrega no login da academia, em `/<academia>`, com o nome dela. Entrar com outra conta na mesma aba: nada da conta anterior aparece. No DevTools, Application, Session Storage: a chave `crm-impersonation` não existe depois de sair.
- Deslogado, abrir `/<academia>/ficha/<id>`: login com a marca da academia e, depois de entrar, a própria ficha.
- Logado, dar F5 no Pipeline: nenhuma chamada a `/api/tenant-resolve` na aba Network. Deslogado em `/<academia>`: uma chamada.
- Academia que não é a STRONIX: escolher outro funil no Pipeline e dar F5. O funil escolhido continua.
- Super-admin puro: "Acessar como" pelo Console abre `/<academia assumida>` no Operacional, sem tela em branco. "Sair da visualização" volta ao Console, com a barra em `/`.
- Super-admin membro: em `/<sua academia>/super-admin/clientes`, "Acessar como" abre o Operacional da academia assumida; "Sair da visualização" volta para `/<sua academia>/super-admin/clientes`.
- Sair durante a visualização: vai para o login geral em `/`.

---

### Task 12: Menu, menu da conta e aviso de mensalidade como links; menu do celular e Configurações pelo endereço

**Depende de:** T7 (`AppLink`), T10 e T11 (os nomes que a T10 cria no `AppInner`, na tabela abaixo).

#### Encaixe com a T10 e a T11

A T12 usa estes nomes, que a T10 cria no `AppInner` (conferido no estado em que a T10 e a T11 deixam o arquivo):

| Nome | O que é | Onde a T12 usa |
|---|---|---|
| `location` | `const location = useLocation();`, declarado ANTES do estado do menu do celular | `isMobileMenuOpen`, botão que abre o menu, `SettingsView`, `openGoalSettings` |
| `navigate` | `const navigate = useNavigate();` | `openGoalSettings` |
| `hrefFor` | importado de `./lib/routes.js` | `menuHref` |
| `sessionTenant` | `appUser && !appUser.superAdminOnly ? appUser.tenantId : null` | `menuHref` |
| `changeTab(tab, extra)` | navega para `hrefFor(sessionTenant, tab, extra)` com replace quando o destino é o endereço atual, e fecha o menu do celular | continua no acordeão Organizações e no `onNavigate` do Gerencial; a T12 troca a linha que fecha o menu |
| `activeTab`, `resolvedTab`, `superTab`, `isDashTab` | derivados do endereço | `active` dos itens do menu |
| `openProfile(leadId)` | memoizado, navega para a ficha com `state: { from }` | `AddLeadModal onCreated` (a T10 já liga) |

A T11 não mexe em nada do que a T12 toca.

**Files:**
- Modify: `src/components/layout/Sidebar.jsx` (arquivo inteiro)
- Modify: `src/components/layout/PersonaMenu.jsx:1-11, 35-45`
- Modify: `src/components/layout/Banners.jsx:1-2, 28-31, 57-61`
- Modify: `src/App.jsx` (trechos localizados pelo código abaixo)
- Test: `src/lib/__tests__/menuLinks.test.js` (novo)

- [ ] **Step 1: Conferir o encaixe com a T10**

```bash
git grep -n -E "const location = useLocation\(\);|const navigate = useNavigate\(\);|const sessionTenant = |const \[isMobileMenuOpen, setIsMobileMenuOpen\] = useState\(false\);" -- src/App.jsx
```

Expected: quatro linhas, e as três primeiras com número MENOR que a do `isMobileMenuOpen` (depois da T10 e da T11: 189, 190, 204 e 245). Se `location` vier depois do estado do menu, pare e alinhe com a T10: o `isMobileMenuOpen` derivado desta tarefa lê `location.key`.

```bash
git grep -n -E "from './lib/routes.js'|const changeTab = \(tab, extra\)|setIsMobileMenuOpen\(false\);$|justCreatedLeadId|onCreated=" -- src/App.jsx
```

Expected: o import de `./lib/routes.js` listando `hrefFor`; `const changeTab = (tab, extra) => {`; uma linha `    setIsMobileMenuOpen(false);` (dentro do `changeTab`); `          onCreated={openProfile}`; e nenhuma linha com `justCreatedLeadId`. Se `justCreatedLeadId` aparecer, a T10 ficou incompleta: volte aos Steps 10 e 15 da T10 antes de seguir.

- [ ] **Step 2: Escrever o teste que falha**

Criar `src/lib/__tests__/menuLinks.test.js`:

```js
// Menu lateral e aviso de mensalidade como links de verdade (endereço por
// tela, PR 2). Com link, Ctrl+clique, botão do meio e "Abrir em nova aba"
// funcionam. Render sem jsdom (renderToString) dentro de um MemoryRouter,
// porque o Link do React Router só existe dentro de um roteador.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { SidebarItem, SidebarSubItem } from '../../components/layout/Sidebar.jsx';
import { PaymentDueBanner } from '../../components/layout/Banners.jsx';

const render = (el) => renderToString(createElement(MemoryRouter, { initialEntries: ['/acad'] }, el));
// Classes do elemento de fora: o primeiro class="" do html.
const rootClass = (html) => html.match(/class="([^"]*)"/)?.[1];
const DAY = 24 * 60 * 60 * 1000;

describe('SidebarItem', () => {
  it('com endereço vira link e marca a tela atual', () => {
    const html = render(createElement(SidebarItem, { label: 'Pipeline', href: '/acad/pipeline', active: true }));
    expect(html.startsWith('<a ')).toBe(true);
    expect(html).toContain('href="/acad/pipeline"');
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('<button');
  });

  it('link de uma tela que não é a atual não leva aria-current', () => {
    const html = render(createElement(SidebarItem, { label: 'Pipeline', href: '/acad/pipeline', active: false }));
    expect(html.startsWith('<a ')).toBe(true);
    expect(html).not.toContain('aria-current');
  });

  it('sem endereço continua botão, para o que abre janela (Suporte)', () => {
    const html = render(createElement(SidebarItem, { label: 'Suporte', active: false, onClick: () => {} }));
    expect(html.startsWith('<button type="button"')).toBe(true);
    expect(html).not.toContain('href=');
  });

  it('link e botão têm a mesma aparência, ativo ou não', () => {
    for (const active of [true, false]) {
      const link = render(createElement(SidebarItem, { label: 'Pipeline', href: '/acad/pipeline', active }));
      const button = render(createElement(SidebarItem, { label: 'Pipeline', active }));
      expect(rootClass(link)).toBe(rootClass(button));
    }
  });

  it('o selo de pendências continua dentro do link', () => {
    const html = render(createElement(SidebarItem, { label: 'Meta diária', href: '/acad/meta-diaria', active: false, badge: 3 }));
    expect(html.startsWith('<a ')).toBe(true);
    expect(html).toContain('>3</span>');
  });
});

describe('SidebarSubItem', () => {
  it('com endereço vira link e marca a tela atual', () => {
    const html = render(createElement(SidebarSubItem, { label: 'Aulas experimentais', href: '/acad/leads/aulas', active: true }));
    expect(html.startsWith('<a ')).toBe(true);
    expect(html).toContain('href="/acad/leads/aulas"');
    expect(html).toContain('aria-current="page"');
  });

  it('sem endereço continua botão, com a mesma aparência do link', () => {
    const button = render(createElement(SidebarSubItem, { label: 'CRM', active: false, onClick: () => {} }));
    const link = render(createElement(SidebarSubItem, { label: 'CRM', href: '/acad/visao-geral/crm', active: false }));
    expect(button.startsWith('<button type="button"')).toBe(true);
    expect(rootClass(link)).toBe(rootClass(button));
  });
});

describe('PaymentDueBanner', () => {
  const dueSoon = () => Date.now() + 2 * DAY;

  it('sem fatura, "Ver faturas" é link para Plano e faturas', () => {
    const html = render(createElement(PaymentDueBanner, {
      dueAtMs: dueSoon(), overdue: false, invoiceUrl: null, billingHref: '/acad/plano-e-faturas',
    }));
    expect(html).toContain('href="/acad/plano-e-faturas"');
    expect(html).toContain('Ver faturas');
    expect(html).not.toContain('<button');
  });

  it('com fatura, mostra só o link de pagar, que abre fora do app', () => {
    const html = render(createElement(PaymentDueBanner, {
      dueAtMs: dueSoon(), overdue: false, invoiceUrl: 'https://www.asaas.com/i/abc123', billingHref: '/acad/plano-e-faturas',
    }));
    expect(html).toContain('href="https://www.asaas.com/i/abc123"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('Pagar fatura');
    expect(html).not.toContain('Ver faturas');
  });

  it('sem fatura e sem endereço não mostra um "Ver faturas" que não leva a lugar nenhum', () => {
    const html = render(createElement(PaymentDueBanner, { dueAtMs: dueSoon(), overdue: false, invoiceUrl: null }));
    expect(html).toContain('Sua mensalidade vence em 2 dias');
    expect(html).not.toContain('Ver faturas');
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/menuLinks.test.js`
Expected: FAIL, `Tests  8 failed | 2 passed (10)`. Os itens ainda devolvem `<button>` sem `type` e ignoram `href`, e o aviso ainda mostra o botão "Ver faturas". Passam só "link e botão têm a mesma aparência" (hoje os dois são botão) e "com fatura, mostra só o link de pagar".

- [ ] **Step 4: Reescrever `src/components/layout/Sidebar.jsx`**

Substituir o arquivo inteiro por:

```jsx
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppLink } from '../nav/AppLink.jsx';

// Elementos "só expandido" da sidebar: no desktop o trilho recolhido os
// esconde; hover (ou foco de teclado via :has(:focus-visible)) revela.
// No mobile (drawer) ficam sempre visíveis. Compartilhado com o App.jsx
// (wordmark, títulos de seção, rodapé).
const SIDEBAR_EXPANDED_ONLY =
  'transition-opacity duration-200 md:opacity-0 md:group-hover/sidebar:opacity-100 md:group-has-[:focus-visible]/sidebar:opacity-100';

// Item do menu. Com `href` é um link de verdade: Ctrl+clique, botão do meio e
// "Abrir em nova aba" funcionam, e a tela atual leva aria-current="page".
// `onNavigate` roda só quando o clique troca de tela nesta aba (o App fecha o
// menu do celular por ele). Sem `href` continua botão, para o que abre janela
// em vez de trocar de tela (Suporte). Link e botão têm a mesma aparência.
function SidebarItem({ icon, label, active, badge, href, onNavigate, onClick }) {
  const className = cn(
    'group relative w-full h-11 pl-3.5 pr-3 rounded-xl flex items-center gap-3 text-[13.5px] font-medium transition-all',
    active
      ? 'bg-brand-600 text-white shadow-[0_6px_16px_-6px_rgba(43,89,255,.65)]'
      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-neutral-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
  );
  const content = (
    <>
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-accent-500" />}
      <span className={active ? 'text-white' : 'text-gray-400 group-hover:text-brand-600 dark:text-neutral-500 dark:group-hover:text-white transition-colors'}>{icon}</span>
      <span className={cn('flex-1 text-left whitespace-nowrap tracking-tight', SIDEBAR_EXPANDED_ONLY)}>{label}</span>
      {badge != null && (
        <span
          className={cn(
            'text-[10.5px] font-bold px-1.5 h-[18px] rounded-md min-w-[18px] grid place-items-center tabular-nums shrink-0',
            active ? 'bg-white/20 text-white' : 'bg-accent-500/12 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400',
            SIDEBAR_EXPANDED_ONLY
          )}
        >
          {badge}
        </span>
      )}
      {/* Ponto de notificação do trilho recolhido. O selo acima some junto
          com os rótulos, e o ponto faz o caminho inverso no hover. */}
      {badge != null && (
        <span
          aria-hidden="true"
          className="hidden md:block absolute top-2 left-[26px] size-2 rounded-full bg-accent-500 pointer-events-none transition-opacity duration-200 md:group-hover/sidebar:opacity-0 md:group-has-[:focus-visible]/sidebar:opacity-0"
        />
      )}
    </>
  );
  if (href) {
    return (
      <AppLink to={href} onNavigate={onNavigate} aria-current={active ? 'page' : undefined} className={className}>
        {content}
      </AppLink>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

// Item-pai recolhível: abre um "slide para baixo" com os sub-itens.
// No trilho recolhido o slide fica fechado mesmo com open=true e
// reabre animado quando a sidebar expande no hover.
function SidebarGroup({ icon, label, active, open, onToggle, children }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className={`group w-full h-11 pl-3.5 pr-3 rounded-xl flex items-center gap-3 text-[13.5px] font-medium transition-all ${active
          ? 'bg-brand-50 text-brand-700 dark:bg-white/[0.06] dark:text-brand-300'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-neutral-300 dark:hover:bg-white/[0.06] dark:hover:text-white'}`}
      >
        <span className={active ? 'text-brand-600 dark:text-brand-300' : 'text-gray-400 group-hover:text-brand-600 dark:text-neutral-500 dark:group-hover:text-white transition-colors'}>{icon}</span>
        <span className={`flex-1 text-left whitespace-nowrap tracking-tight ${SIDEBAR_EXPANDED_ONLY}`}>{label}</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${active ? 'text-brand-500 dark:text-brand-300' : 'text-gray-400 dark:text-neutral-500'} ${SIDEBAR_EXPANDED_ONLY}`} />
      </button>
      <div className={`grid transition-all duration-200 ease-in-out ${open
        ? 'grid-rows-[1fr] opacity-100 mt-1 md:grid-rows-[0fr] md:opacity-0 md:group-hover/sidebar:grid-rows-[1fr] md:group-hover/sidebar:opacity-100 md:group-has-[:focus-visible]/sidebar:grid-rows-[1fr] md:group-has-[:focus-visible]/sidebar:opacity-100'
        : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="ml-[26px] pl-3 border-l border-slate-200 dark:border-white/[0.08] space-y-0.5 py-0.5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-item de um grupo do menu. Mesma regra do SidebarItem: com `href` é
// link, sem `href` é botão, e os dois têm a mesma aparência.
function SidebarSubItem({ label, active, href, onNavigate, onClick }) {
  const className = cn(
    'group w-full flex items-center gap-2.5 pl-3 pr-2.5 h-9 rounded-lg text-[13px] font-medium transition-all',
    active
      ? 'bg-brand-600 text-white'
      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-white'
  );
  const content = (
    <>
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', active ? 'bg-white' : 'bg-gray-300 group-hover:bg-brand-500 dark:bg-neutral-600')} />
      <span className="tracking-tight truncate">{label}</span>
    </>
  );
  if (href) {
    return (
      <AppLink to={href} onNavigate={onNavigate} aria-current={active ? 'page' : undefined} className={className}>
        {content}
      </AppLink>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
export { SidebarItem, SidebarGroup, SidebarSubItem, SIDEBAR_EXPANDED_ONLY };
```

Notas: o `SidebarGroup` fica como está (acordeão continua botão, legado). As classes passaram de template literal para `cn()`, e o resultado foi conferido com o `tailwind-merge` do repositório: nenhuma classe some nem muda em nenhuma das combinações (item ativo e inativo, selo, rótulo, ponto do sub-item).

- [ ] **Step 5: "Ver faturas" como link em `src/components/layout/Banners.jsx`**

Antes (linhas 1-2):

```jsx
import { useState } from 'react';
import { Clock, CreditCard, Eye, LogOut } from 'lucide-react';
```

Depois:

```jsx
import { useState } from 'react';
import { Clock, CreditCard, Eye, LogOut } from 'lucide-react';
import { AppLink } from '../nav/AppLink.jsx';
```

Antes (linhas 28-31):

```jsx
// Aviso de vencimento da mensalidade (mostrado só ao ADMIN da academia quando a
// próxima cobrança vence em <= 7 dias, ou já venceu). Brand (7–4 dias) →
// âmbar (<= 3 dias) → rose (vencida; o acesso é cortado após 3 dias de carência).
function PaymentDueBanner({ dueAtMs, overdue, invoiceUrl, onOpenBilling }) {
```

Depois:

```jsx
// Aviso de vencimento da mensalidade (mostrado só ao ADMIN da academia quando a
// próxima cobrança vence em <= 7 dias, ou já venceu). Brand (7–4 dias) →
// âmbar (<= 3 dias) → rose (vencida; o acesso é cortado após 3 dias de carência).
// Com fatura em aberto, o link é o de pagar, fora do app. Sem fatura, "Ver
// faturas" é link para Plano e faturas (billingHref, montado pelo App com a
// academia da sessão), então Ctrl+clique abre em outra aba.
function PaymentDueBanner({ dueAtMs, overdue, invoiceUrl, billingHref }) {
```

Antes (linhas 57-61):

```jsx
      {invoiceUrl ? (
        <a href={invoiceUrl} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2 hover:opacity-80">Pagar fatura</a>
      ) : (
        <button onClick={onOpenBilling} className="font-semibold underline underline-offset-2 hover:opacity-80">Ver faturas</button>
      )}
```

Depois:

```jsx
      {invoiceUrl ? (
        <a href={invoiceUrl} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2 hover:opacity-80">Pagar fatura</a>
      ) : billingHref ? (
        <AppLink to={billingHref} className="font-semibold underline underline-offset-2 hover:opacity-80">Ver faturas</AppLink>
      ) : null}
```

- [ ] **Step 6: Perfil da academia e Plano & faturas como links em `src/components/layout/PersonaMenu.jsx`**

Antes (linhas 6-11):

```jsx
} from '../ui/dropdown-menu.jsx';

// Menu da conta no canto superior direito (ícone de persona). Reúne o perfil da
// academia + Plano & faturas (só para o admin) e o logout. Consultor vê apenas
// a própria identidade + Sair. Super-admin puro não tem academia → sem perfil.
function PersonaMenu({ appUser, isAdmin, onProfile, onBilling, onLogout, onHelp, onToggleTheme, isDarkMode }) {
```

Depois:

```jsx
} from '../ui/dropdown-menu.jsx';
import { AppLink } from '../nav/AppLink.jsx';

// Menu da conta no canto superior direito (ícone de persona). Reúne o perfil da
// academia + Plano & faturas (só para o admin) e o logout. Consultor vê apenas
// a própria identidade + Sair. Super-admin puro não tem academia → sem perfil.
// Perfil da academia e Plano & faturas são links (profileHref e billingHref,
// montados pelo App com a academia da sessão): Ctrl+clique abre em outra aba.
// O item do menu empresta o papel e o foco ao link (asChild) e fecha o menu no
// clique. Enter pelo teclado abre na mesma aba.
function PersonaMenu({ appUser, isAdmin, profileHref, billingHref, onLogout, onHelp, onToggleTheme, isDarkMode }) {
```

Antes (linhas 35-45):

```jsx
        {isAdmin && !superOnly && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onProfile} className="cursor-pointer">
              <Building2 className="size-4 text-slate-500" /> Perfil da academia
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onBilling} className="cursor-pointer">
              <CreditCard className="size-4 text-slate-500" /> Plano &amp; faturas
            </DropdownMenuItem>
          </>
        )}
```

Depois:

```jsx
        {isAdmin && !superOnly && (profileHref || billingHref) && (
          <>
            <DropdownMenuSeparator />
            {profileHref && (
              <DropdownMenuItem asChild className="cursor-pointer">
                <AppLink to={profileHref}>
                  <Building2 className="size-4 text-slate-500" /> Perfil da academia
                </AppLink>
              </DropdownMenuItem>
            )}
            {billingHref && (
              <DropdownMenuItem asChild className="cursor-pointer">
                <AppLink to={billingHref}>
                  <CreditCard className="size-4 text-slate-500" /> Plano &amp; faturas
                </AppLink>
              </DropdownMenuItem>
            )}
          </>
        )}
```

Por que funciona: o `Slot` do Radix passa ao `AppLink` o `className`, o `ref`, o papel `menuitem` e o `onClick` do item. O `AppLink` repassa tudo ao `Link`. O clique do item fecha o menu sem `preventDefault` (conferido no desenho em `@radix-ui/react-menu`, `dist/index.mjs:374-410`), então o `Link` navega no clique simples e deixa o navegador abrir outra aba no Ctrl+clique. Enter e Espaço chamam `click()` no elemento, que o `Link` trata como clique simples.

- [ ] **Step 7: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/menuLinks.test.js`
Expected: PASS, `Tests  10 passed (10)`.

- [ ] **Step 8: Commit dos componentes**

```bash
git add src/components/layout/Sidebar.jsx src/components/layout/Banners.jsx src/components/layout/PersonaMenu.jsx src/lib/__tests__/menuLinks.test.js
git commit -m "$(cat <<'EOF'
feat: itens do menu, menu da conta e aviso de mensalidade viram links

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

Até o Step 12, o menu da conta esconde Perfil da academia e Plano e faturas, e o aviso de mensalidade esconde o "Ver faturas", porque o `App.jsx` ainda passa `onProfile`, `onBilling` e `onOpenBilling`. O Step 9 liga as props novas.

- [ ] **Step 9: Ligar o menu, o menu do celular e as Configurações ao endereço em `src/App.jsx`**

Cada troca abaixo tem o trecho "antes" exato, como ele está depois da T10 e da T11. Todos aparecem uma vez só no arquivo.

**9a. `settingsTab` sai.** Antes:

```jsx
  // Aba-alvo ao abrir Configurações de fora (ex.: link "Regras gerais" do Perfil).
  // SettingsView remonta ao entrar na view e aplica este initialTab no mount.
  const [settingsTab, setSettingsTab] = useState('users');
```

Depois: apagar as três linhas (a linha seguinte, `const [consoleOpen, setConsoleOpen] = useState(false); ...`, fica onde está).

**9b. Menu do celular derivado do endereço.** Antes:

```jsx
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
```

Depois:

```jsx
  // Menu do celular: aberto enquanto o endereço for o mesmo em que ele abriu
  // (location.key). Qualquer troca de endereço fecha o menu sozinha, inclusive
  // o voltar do navegador e o replace de um aviso de rota, sem effect. Os links
  // do menu zeram a chave no clique (onNavigate), então voltar até a entrada
  // onde ele abriu não o reabre.
  const [drawerKey, setDrawerKey] = useState(null);
  const isMobileMenuOpen = drawerKey !== null && drawerKey === location.key;
  const closeDrawer = () => setDrawerKey(null);
```

**9c. O `changeTab` da T10 fecha o menu pelo `closeDrawer`.** Antes:

```jsx
    if (href) navigate(href, { replace: href === location.pathname });
    setIsMobileMenuOpen(false);
  };
```

Depois:

```jsx
    if (href) navigate(href, { replace: href === location.pathname });
    closeDrawer();
  };
```

**9d. `openSettingsTab` dá lugar a `menuHref` e `openGoalSettings`.** Antes:

```jsx
  // Abre Configurações já numa aba específica (sidebar e link "Regras gerais" do Perfil).
  const openSettingsTab = (tab) => { setSettingsTab(tab); changeTab('settings'); };
```

Depois:

```jsx
  // Endereço dos itens do menu, do menu da conta e do aviso de mensalidade.
  // Sai da academia da sessão (claim), nunca da barra de endereço.
  const menuHref = (screen, extra) => hrefFor(sessionTenant, screen, extra);
  // "Configurar agora" da novidade abre Configurações já em Metas e ritmo. A
  // seção vai no state da navegação (SettingsView lê location.state.secao), e
  // o menu, sem state, abre em Equipe e acessos. Com Configurações já aberta
  // nada muda, igual a antes: a seção no endereço é da entrega 2.
  const openGoalSettings = () => {
    const href = menuHref('settings');
    if (href) navigate(href, { state: { secao: 'general' }, replace: href === location.pathname });
    closeDrawer();
  };
```

**9e. Fundo escuro do menu do celular.** Antes:

```jsx
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />}
```

Depois:

```jsx
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity" onClick={closeDrawer} />}
```

**9f. Botão X do menu do celular.** Antes:

```jsx
          <button className="md:hidden text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white p-1 shrink-0" onClick={() => setIsMobileMenuOpen(false)}><X className="w-5 h-5" /></button>
```

Depois:

```jsx
          <button className="md:hidden text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white p-1 shrink-0" onClick={closeDrawer}><X className="w-5 h-5" /></button>
```

**9g. Comentário do menu.** Antes:

```jsx
        {/* Navegação */}
```

Depois:

```jsx
        {/* Navegação. Cada tela é um link de verdade: Ctrl+clique, botão do
            meio e "Abrir em nova aba" funcionam. onNavigate fecha o menu do
            celular quando o clique troca de tela nesta aba. Os acordeões
            (Visão geral, Leads, Organizações) e o Suporte continuam botão. */}
```

**9h. Itens da Visão geral.** Antes:

```jsx
                  <SidebarSubItem label="Operacional" active={resolvedTab === 'dashOperacional'} onClick={() => changeTab('dashOperacional')} />
                  <SidebarSubItem label="CRM" active={resolvedTab === 'dashCrm'} onClick={() => changeTab('dashCrm')} />
                  <SidebarSubItem label="Gerencial" active={resolvedTab === 'dashGerencial'} onClick={() => changeTab('dashGerencial')} />
```

Depois:

```jsx
                  <SidebarSubItem label="Operacional" href={menuHref('dashOperacional')} onNavigate={closeDrawer} active={resolvedTab === 'dashOperacional'} />
                  <SidebarSubItem label="CRM" href={menuHref('dashCrm')} onNavigate={closeDrawer} active={resolvedTab === 'dashCrm'} />
                  <SidebarSubItem label="Gerencial" href={menuHref('dashGerencial')} onNavigate={closeDrawer} active={resolvedTab === 'dashGerencial'} />
```

(`menuHref('dashOperacional')` dá `/<academia>`, o mesmo endereço da tela inicial, então clicar em Operacional estando nela não empilha entrada: o `Link` troca push por replace quando o destino é o endereço atual.)

**9i. Pipeline, Clientes e Meta diária.** Antes:

```jsx
                <SidebarItem icon={<Kanban className="w-[18px] h-[18px]" />} label="Pipeline" active={activeTab === 'kanban'} onClick={() => changeTab('kanban')} />
                <SidebarItem icon={<GraduationCap className="w-[18px] h-[18px]" />} label="Clientes" badge={clientsAVencer > 0 ? clientsAVencer : null} active={activeTab === 'clientes'} onClick={() => changeTab('clientes')} />
                <SidebarItem icon={<Target className="w-[18px] h-[18px]" />} label="Meta diária" badge={dailyGoalPending > 0 ? dailyGoalPending : null} active={activeTab === 'dailyGoal'} onClick={() => changeTab('dailyGoal')} />
```

Depois:

```jsx
                <SidebarItem icon={<Kanban className="w-[18px] h-[18px]" />} label="Pipeline" href={menuHref('kanban')} onNavigate={closeDrawer} active={activeTab === 'kanban'} />
                <SidebarItem icon={<GraduationCap className="w-[18px] h-[18px]" />} label="Clientes" badge={clientsAVencer > 0 ? clientsAVencer : null} href={menuHref('clientes')} onNavigate={closeDrawer} active={activeTab === 'clientes'} />
                <SidebarItem icon={<Target className="w-[18px] h-[18px]" />} label="Meta diária" badge={dailyGoalPending > 0 ? dailyGoalPending : null} href={menuHref('dailyGoal')} onNavigate={closeDrawer} active={activeTab === 'dailyGoal'} />
```

**9j. Leads, Aulas e Visitas.** Antes:

```jsx
                  <SidebarSubItem label="Todos os leads" active={activeTab === 'leads'} onClick={() => changeTab('leads')} />
                  <SidebarSubItem label="Aulas experimentais" active={activeTab === 'aulas'} onClick={() => changeTab('aulas')} />
                  <SidebarSubItem label="Visitas" active={activeTab === 'visitas'} onClick={() => changeTab('visitas')} />
```

Depois:

```jsx
                  <SidebarSubItem label="Todos os leads" href={menuHref('leads')} onNavigate={closeDrawer} active={activeTab === 'leads'} />
                  <SidebarSubItem label="Aulas experimentais" href={menuHref('aulas')} onNavigate={closeDrawer} active={activeTab === 'aulas'} />
                  <SidebarSubItem label="Visitas" href={menuHref('visitas')} onNavigate={closeDrawer} active={activeTab === 'visitas'} />
```

O Suporte (`label="Suporte" ... onClick={() => setTicketModalOpen(true)}`) não muda: abre janela, continua botão.

**9k. Configurações.** Antes:

```jsx
                  <SidebarItem icon={<Settings className="w-[18px] h-[18px]" />} label="Configurações" active={activeTab === 'settings'} onClick={() => openSettingsTab('users')} />
```

Depois:

```jsx
                  <SidebarItem icon={<Settings className="w-[18px] h-[18px]" />} label="Configurações" href={menuHref('settings')} onNavigate={closeDrawer} active={activeTab === 'settings'} />
```

**9l. Subabas do super-admin.** O acordeão Organizações (`onToggle={() => changeTab('superadmin', { superTab: 'overview' })}`, da T10) continua botão e não muda. Antes (como a T10 deixou):

```jsx
                    <SidebarSubItem label="Visão Geral" active={activeTab === 'superadmin' && superTab === 'overview'} onClick={() => changeTab('superadmin', { superTab: 'overview' })} />
                    <SidebarSubItem label="Clientes" active={activeTab === 'superadmin' && superTab === 'clients'} onClick={() => changeTab('superadmin', { superTab: 'clients' })} />
                    <SidebarSubItem label="Financeiro" active={activeTab === 'superadmin' && superTab === 'finance'} onClick={() => changeTab('superadmin', { superTab: 'finance' })} />
                    <SidebarSubItem label="Planos" active={activeTab === 'superadmin' && superTab === 'plans'} onClick={() => changeTab('superadmin', { superTab: 'plans' })} />
```

Depois:

```jsx
                    <SidebarSubItem label="Visão Geral" href={menuHref('superadmin', { superTab: 'overview' })} onNavigate={closeDrawer} active={activeTab === 'superadmin' && superTab === 'overview'} />
                    <SidebarSubItem label="Clientes" href={menuHref('superadmin', { superTab: 'clients' })} onNavigate={closeDrawer} active={activeTab === 'superadmin' && superTab === 'clients'} />
                    <SidebarSubItem label="Financeiro" href={menuHref('superadmin', { superTab: 'finance' })} onNavigate={closeDrawer} active={activeTab === 'superadmin' && superTab === 'finance'} />
                    <SidebarSubItem label="Planos" href={menuHref('superadmin', { superTab: 'plans' })} onNavigate={closeDrawer} active={activeTab === 'superadmin' && superTab === 'plans'} />
```

**9m. Botão que abre o menu do celular.** Antes:

```jsx
            <button className="md:hidden mr-4 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white dark:text-white p-1" onClick={() => setIsMobileMenuOpen(true)}><Menu className="w-6 h-6" /></button>
```

Depois:

```jsx
            <button className="md:hidden mr-4 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white dark:text-white p-1" onClick={() => setDrawerKey(location.key)}><Menu className="w-6 h-6" /></button>
```

**9n. Menu da conta.** Antes:

```jsx
              onProfile={() => changeTab('profile')}
              onBilling={() => changeTab('billing')}
```

Depois:

```jsx
              profileHref={menuHref('profile')}
              billingHref={menuHref('billing')}
```

**9o. Aviso de mensalidade.** Antes:

```jsx
            onOpenBilling={() => changeTab('billing')}
```

Depois:

```jsx
            billingHref={menuHref('billing')}
```

**9p. Seção de entrada das Configurações.** Na linha `{activeTab === 'settings' && isAdminUser(appUser) && <SettingsView initialTab={settingsTab} sources={sources} ... />}`, trocar só o começo. Antes:

```jsx
<SettingsView initialTab={settingsTab} 
```

Depois:

```jsx
<SettingsView initialTab={location.state?.secao ?? 'users'} 
```

(O `SettingsView` traduz `'users'` para Equipe e acessos e `'general'` para Metas e ritmo pelo `LEGACY_TABS`, `src/views/settings/SettingsView.jsx:36-46`, e lê a prop só na montagem, como hoje.)

**9q. "Configurar agora" da novidade.** Antes:

```jsx
      <WhatsNewModal appUser={appUser} onConfigure={() => openSettingsTab('general')} />
```

Depois:

```jsx
      <WhatsNewModal appUser={appUser} onConfigure={openGoalSettings} />
```

O `WhatsNewModal.jsx` não muda: ele já chama `onConfigure` depois de marcar a novidade como vista.

- [ ] **Step 10: Conferir que não sobrou nada do jeito antigo**

```bash
git grep -n -E "setIsMobileMenuOpen|settingsTab|openSettingsTab|onOpenBilling|onProfile=|onBilling=" -- src
```

Expected: nenhuma linha (saída vazia, código de saída 1).

```bash
git grep -n -E "drawerKey|closeDrawer|menuHref\(" -- src/App.jsx | wc -l
```

Expected: `25` (estado, derivação e `closeDrawer`; o `changeTab`; duas linhas do `openGoalSettings`; fundo e X; 15 itens do menu; menu da conta e aviso de mensalidade).

- [ ] **Step 11: Testes, lint e build**

```bash
npx vitest run 2>&1 | tail -5
npm run lint 2>&1 | tail -4
npm run build 2>&1 | tail -3
```

Expected: `Test Files  99 passed (99)` e `Tests  2057 passed (2057)` (2047 + 10); lint `✖ 1 problem (0 errors, 1 warning)`, o aviso antigo do `SuperAdminView.jsx` (linha 113 desde a T11); build terminando em `✓ built in ...`, sem erro.

Conferência visual (menu, menu da conta, celular) fica para o preview da Vercel, no checklist do PR (T14). Não rodar `npm run dev` apontado para a produção.

- [ ] **Step 12: Commit do App**

```bash
git add src/App.jsx
git commit -m "$(cat <<'EOF'
feat: menu com endereço da sessão, menu do celular pelo endereço e Configurações por state

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Gesto de voltar do trackpad

**Fora deste PR, de propósito.** A primeira versão desta tarefa também fazia o pool de renovação e o contato de hoje esperarem o config da academia. Saiu: o portão abria um render em que `renewalLoading` e `contactTodayLoading` já eram `false` com as listas ainda vazias, e o effect do dia batido podia gravar "meta batida" com renovação ou contato de cliente pendente (a revisão reproduziu isso em jsdom; a main não faz). Vai ser uma tarefa separada. Esta tarefa não toca no `App.jsx`.

**Files:**
- Create: `src/lib/__tests__/overscrollGuard.test.js`
- Modify (uma classe em cada): `src/views/KanbanView.jsx:1428`, `src/views/dashboard/DashHighlights.jsx:60`, `src/views/dashboard/TeamMonthTable.jsx:126`, `src/views/dashboard/PeopleConversionTable.jsx:110`, `src/views/dashboard/MetaDaysCalendar.jsx:91`, `src/views/team/DayRail.jsx:16`, `src/views/LeadProfileView.jsx:810` (802 na main; a T9 acrescenta oito linhas acima), `src/components/profile/PhaseChanger.jsx:233`, `src/modals/ClientRegistrationModal.jsx:131`, `src/modals/AddLeadModal.jsx:203`

**Depende de:** T9 (a linha do `LeadProfileView.jsx` que a T9 moveu). Vem depois da T12 só pela ordem do plano.

Sobre o `FunnelTabs`: ele não rola para o lado. Quando as abas não cabem, o excedente vai para o menu "+N" (`src/components/layout/FunnelTabs.jsx:145-190`), e nenhum ancestral dele no Pipeline ou em Leads tem `overflow-x`. O `overscroll-behavior` só vale em quem rola, então a classe ali não faria nada. A trava fica nos dez roladores de verdade, e a varredura garante que um rolador novo não nasce sem ela.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/__tests__/overscrollGuard.test.js`:

```js
// Gesto de voltar do trackpad. Com endereço por tela sempre existe uma tela
// anterior dentro do app, e rolar um quadro para o lado até a borda e
// insistir fazia o navegador voltar de tela no meio do trabalho. Todo
// rolador horizontal leva overscroll-x-contain, que segura o gesto dentro
// dele. Esta varredura cobra isso de todo overflow-x-auto de src/, inclusive
// dos que forem criados depois.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../..', import.meta.url));

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== '__tests__') out.push(...sourceFiles(full));
    } else if (/\.jsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

// Cada texto entre aspas, apóstrofos ou crases que liga a rolagem lateral.
const SCROLL_X_RE = /(['"`])([^'"`]*?\boverflow-x-(?:auto|scroll)\b[^'"`]*?)\1/g;
const CONTAINED_RE = /\boverscroll-x-(?:contain|none)\b/;

describe('rolagem lateral segura o gesto de voltar do navegador', () => {
  it('todo overflow-x-auto vem com overscroll-x-contain na mesma lista de classes', () => {
    const faltando = [];
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(SCROLL_X_RE)) {
        if (!CONTAINED_RE.test(m[2])) {
          const line = text.slice(0, m.index).split('\n').length;
          faltando.push(`${relative(SRC, file)}:${line}`);
        }
      }
    }
    expect(faltando).toEqual([]);
  });

  it('a varredura enxerga o board do Pipeline (não está cega)', () => {
    const text = readFileSync(join(SRC, 'views/KanbanView.jsx'), 'utf8');
    expect([...text.matchAll(SCROLL_X_RE)].length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/overscrollGuard.test.js`
Expected: FAIL, `Tests  1 failed | 1 passed (2)`, com `expected [ …(10) ] to deeply equal []`. Os dez são (a ordem pode variar; a linha do `LeadProfileView.jsx` é 810 porque a T9 acrescentou oito linhas acima dela):

```
components/profile/PhaseChanger.jsx:233
modals/AddLeadModal.jsx:203
modals/ClientRegistrationModal.jsx:131
views/KanbanView.jsx:1428
views/LeadProfileView.jsx:810
views/dashboard/DashHighlights.jsx:60
views/dashboard/MetaDaysCalendar.jsx:91
views/dashboard/PeopleConversionTable.jsx:110
views/dashboard/TeamMonthTable.jsx:126
views/team/DayRail.jsx:16
```

- [ ] **Step 3: Pôr `overscroll-x-contain` nos dez roladores**

Cada trecho "antes" aparece uma vez só no arquivo.

`src/views/KanbanView.jsx` (board do Pipeline). Antes:

```jsx
            'flex-1 min-h-0 overflow-x-auto overflow-y-hidden custom-scrollbar select-none px-4 md:px-7 pt-5 pb-6',
```

Depois:

```jsx
            'flex-1 min-h-0 overflow-x-auto overscroll-x-contain overflow-y-hidden custom-scrollbar select-none px-4 md:px-7 pt-5 pb-6',
```

`src/views/dashboard/DashHighlights.jsx` (destaques no celular). Antes:

```jsx
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto md:hidden">
```

Depois:

```jsx
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain md:hidden">
```

`src/views/dashboard/TeamMonthTable.jsx` (tabela da equipe). Antes:

```jsx
        <div className="overflow-x-auto">
```

Depois:

```jsx
        <div className="overflow-x-auto overscroll-x-contain">
```

`src/views/dashboard/PeopleConversionTable.jsx` (conversão por pessoa). Antes:

```jsx
        <div className="hidden overflow-x-auto md:block">
```

Depois:

```jsx
        <div className="hidden overflow-x-auto overscroll-x-contain md:block">
```

`src/views/dashboard/MetaDaysCalendar.jsx` (calendário de dias batidos). Antes:

```jsx
      <div className="mt-3.5 overflow-x-auto snap-x">
```

Depois:

```jsx
      <div className="mt-3.5 overflow-x-auto overscroll-x-contain snap-x">
```

`src/views/team/DayRail.jsx` (faixa de dias da visão Equipe). Antes:

```jsx
      <div className="flex-1 flex gap-1 overflow-x-auto thin-scroll snap-x">
```

Depois:

```jsx
      <div className="flex-1 flex gap-1 overflow-x-auto overscroll-x-contain thin-scroll snap-x">
```

`src/views/LeadProfileView.jsx` (abas da ficha). Antes:

```jsx
      <div className="px-4 pt-3 flex items-center gap-1 border-b border-slate-100 dark:border-white/[0.05] overflow-x-auto thin-scroll">
```

Depois:

```jsx
      <div className="px-4 pt-3 flex items-center gap-1 border-b border-slate-100 dark:border-white/[0.05] overflow-x-auto overscroll-x-contain thin-scroll">
```

`src/components/profile/PhaseChanger.jsx` (etapas no "Mudar fase" da ficha; um voltar acidental ali perderia a janela aberta). Antes:

```jsx
      <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/60 dark:bg-white/[0.02] p-4 overflow-x-auto thin-scroll">
```

Depois:

```jsx
      <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/60 dark:bg-white/[0.02] p-4 overflow-x-auto overscroll-x-contain thin-scroll">
```

`src/modals/ClientRegistrationModal.jsx` (abas do cadastro completo). Antes:

```jsx
        <div className="shrink-0 flex gap-1 px-4 py-2.5 border-b border-slate-100 dark:border-white/[0.05] overflow-x-auto thin-scroll">
```

Depois:

```jsx
        <div className="shrink-0 flex gap-1 px-4 py-2.5 border-b border-slate-100 dark:border-white/[0.05] overflow-x-auto overscroll-x-contain thin-scroll">
```

`src/modals/AddLeadModal.jsx` (etapas no cadastro de lead). Antes:

```jsx
          <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/60 dark:bg-white/[0.02] p-4 overflow-x-auto thin-scroll">
```

Depois:

```jsx
          <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/60 dark:bg-white/[0.02] p-4 overflow-x-auto overscroll-x-contain thin-scroll">
```

O utilitário existe no Tailwind 4.2.2 do repositório: `overscroll-x-contain` gera `overscroll-behavior-x: contain` (`node_modules/tailwindcss/dist/lib.js`). Nada muda na aparência, porque nenhum ancestral desses roladores rola para o lado.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/overscrollGuard.test.js`
Expected: PASS, `Tests  2 passed (2)`.

- [ ] **Step 5: Suíte inteira, lint e build**

```bash
npx vitest run 2>&1 | tail -5
npm run lint 2>&1 | tail -4
npm run build 2>&1 | tail -3
```

Expected: `Test Files  100 passed (100)` e `Tests  2059 passed (2059)` (2057 + 2); lint `✖ 1 problem (0 errors, 1 warning)`, o aviso antigo do `SuperAdminView.jsx`; build `✓ built in ...`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/__tests__/overscrollGuard.test.js src/views/KanbanView.jsx src/views/dashboard/DashHighlights.jsx src/views/dashboard/TeamMonthTable.jsx src/views/dashboard/PeopleConversionTable.jsx src/views/dashboard/MetaDaysCalendar.jsx src/views/team/DayRail.jsx src/views/LeadProfileView.jsx src/components/profile/PhaseChanger.jsx src/modals/ClientRegistrationModal.jsx src/modals/AddLeadModal.jsx
git commit -m "$(cat <<'EOF'
fix: rolagem lateral segura o gesto de voltar do trackpad

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Documentação, verificação final e PR

**Files:**
- Modify: `CLAUDE.md:3` e nova seção antes de `## Ponte com o Stronizap — Parte A, em produção desde 2026-09-09`
- Modify: `README.md:10-11, 71-73, 110`
- Modify: `docs/superpowers/specs/2026-09-21-endereco-por-tela-design.md` (linhas 96, 97, 101, 129, 146, 189, 220, 227, 237, 245, 246, 287 e 290)

**Depende de:** T1 a T13.

A nota dos funis com id fixo pedida em "Documentação a atualizar" do spec já entrou no PR 1 (`CLAUDE.md:29`). Esta tarefa não mexe nela.

- [ ] **Step 1: Stack no topo do `CLAUDE.md`**

Antes (linha 3):

```markdown
React 19 + Vite + Tailwind v4 (tokens em `src/index.css` via `@theme`) + Firebase (Firestore/Auth) + Vercel serverless (`api/`, **limite 12 funções** no plano Hobby — consolidar antes de criar função nova). Multi-tenant por claim `tenantId`. Sem TypeScript (JS/JSX).
```

Depois:

```markdown
React 19 + Vite + Tailwind v4 (tokens em `src/index.css` via `@theme`) + Firebase (Firestore/Auth) + React Router 7 (`~7.18.4`, endereço por tela sem `<Routes>`) + Vercel serverless (`api/`, **limite 12 funções** no plano Hobby — consolidar antes de criar função nova). Multi-tenant por claim `tenantId`. Sem TypeScript (JS/JSX).
```

- [ ] **Step 2: Seção "Endereço de cada tela" no `CLAUDE.md`**

Antes:

```markdown
## Ponte com o Stronizap — Parte A, em produção desde 2026-09-09
```

Depois:

```markdown
## Endereço de cada tela

Cada tela do menu e cada ficha têm endereço próprio, com o identificador da academia na frente: `/<academia>/pipeline`, `/<academia>/leads/aulas`, `/<academia>/ficha/<id>`. F5 mantém a tela, e o voltar e o avançar do navegador andam entre as telas. Spec em `docs/superpowers/specs/2026-09-21-endereco-por-tela-design.md`.

- **A tabela mora em `src/lib/routes.js`** (`SCREENS`): id da tela (os mesmos valores de `activeTab`), segmentos do endereço, título da aba e trava (`gestor`, `superAdmin`). No mesmo módulo, puro e testado em node, ficam a leitura do endereço (`parseAppPath`), a montagem (`hrefFor`) e a decisão de rota (`routeDecision`). Tela nova entra ali, e o primeiro segmento dela entra em `RESERVED_TENANT_SLUGS` (`src/lib/tenantSlug.js`), senão o `tenantSlug.test.js` quebra: nenhuma academia pode ter o identificador igual a uma palavra de tela.
- **O endereço manda.** `activeTab`, `resolvedTab`, `profileLeadId` e `superTab` do `App.jsx` são calculados no render a partir de `useLocation()`, pelo `screenState` de `src/lib/appShell.js`. Esse módulo puro guarda o que a casca tira do endereço e da sessão: tela acesa, origem da ficha, chave da sessão, marca do login, destino do Sair, volta do "Acessar como" e funil salvo. Não existe `setActiveTab`: trocar de tela é navegar. Nada de ler a URL num effect para dar setState. O lint reprova, e esse padrão já deu defeito nas Configurações.
- **Sem `<Routes>`.** O `BrowserRouter` fica em `src/main.jsx`, com `useTransitions={false}`, e o `AppInner` lê o endereço direto. Com `<Routes>`, corrigir `/` para `/<academia>` remontaria o `AppInner`, que guarda o login e as assinaturas. Versão fixada em `~7.18.4`, porque a 8 exige React 19.2.7.
- **Uma decisão de rota por render**, nesta ordem: super-admin puro fica em `/` (o Console não tem endereço); sessão assumida vai para a academia assumida; a volta da visualização vai ao endereço guardado no "Acessar como"; academia do endereço diferente da sessão é corrigida sem aviso; tela de gestor mostra "Essa tela é só do gestor." e vai para `/<academia>`; endereço desconhecido mostra "Não achamos essa tela. Abrimos o Operacional.". A tela de destino já é desenhada no mesmo render, e o `RouteRedirect` troca o endereço com replace.
- **Todo replace passa pelo `navigate`.** O React Router grava a posição da entrada (`idx`) no `history.state`, e o Voltar da ficha depende dela: com `idx` maior que zero volta uma entrada, e sem isso vai para Clientes (cliente) ou Pipeline (lead), nunca para fora do app. Um `history.replaceState` cru apaga o `idx`. O `routes.test.js` trava esse contrato na versão instalada.
- **Nada de dado pessoal no endereço nem no título.** Nome, telefone, CPF e texto de busca nunca vão para o caminho nem para a query. Da ficha só vai o id, que é aleatório. O título da aba na ficha é "Ficha · <Academia> · STRONILEAD", sem o nome, porque o histórico do navegador da recepção guarda o título.
- **`invite`, `t` e `ref` são nomes reservados de query.** São do convite (`/?invite=&t=`) e da indicação pública (`/i/<slug>?ref=`), decididos uma vez no `App()`, fora do roteador. Filtro futuro no endereço usa outro nome.
- **Links.** `AppLink` e `LeadLink` (`src/components/nav/AppLink.jsx`) ficam por cima do `Link` do React Router, que só intercepta o clique esquerdo simples. Por isso Ctrl+clique, botão do meio e "Abrir em nova aba" funcionam. `onNavigate` roda só quando o clique troca de tela nesta aba. O `App.jsx` monta os links do menu com `hrefFor` e a academia do claim, nunca a da barra, porque hook que lê contexto não enxerga o Provider do próprio componente. Quem está abaixo dele usa `LeadLink`, que lê `leadHref` e `from` do `LeadProfileContext`.
- **Menu do celular** fica aberto enquanto `drawerKey === location.key`. Qualquer troca de endereço fecha o menu, sem effect.
- **Configurações** abre na seção de `location.state.secao` e, sem state, em Equipe e acessos. "Configurar agora" da novidade navega com `state: { secao: 'general' }`.
- **Ficha.** `src/views/LeadProfileRoute.jsx`, com `key` pelo id do endereço e só dentro do app logado, então nada dela sobrevive ao Sair. `useProfileLead` é chaveado pela sessão (academia mais `authUid` ou `id` do `appUser`, nunca do `firebaseUser`), obedece ao portão de ociosidade junto com a linha do tempo e só mostra a ficha com os catálogos e os contratos da academia carregados. Os estados são funções puras em `src/lib/fichaState.js`. Sem internet, o doc que só o cache diz que não existe vira o painel "Não deu para abrir a ficha", nunca "Ficha não encontrada".
- **Sair recarrega a página** (`window.location.replace`) depois do `signOut` e cai no login da academia. É isso que limpa listas, ficha e configurações da memória num computador compartilhado.
- **Rolador horizontal leva `overscroll-x-contain`.** Sem isso, rolar um quadro até a borda no trackpad dispara o voltar do navegador e troca de tela. O `overscrollGuard.test.js` cobra isso de todo `overflow-x-auto` em `src/`.
- **Custo.** O `/api/tenant-resolve` só é chamado quando a tela de login vai aparecer: o F5 de quem já está logado não gasta a cota por IP. A subaba do super-admin fica fora do `screenKey`, senão cada clique nela remontaria o `SuperAdminView` e refaria a busca do `/api/super-overview`.
- **Sentry e o id da ficha.** Continua o `Sentry.browserTracingIntegration()`, com `beforeStartSpan` dando à transação o nome do molde da tela (`routeTemplate(options.name)`, como `/:tenant/ficha/:leadId`). O molde sai de `options.name`, que na navegação é o destino: o SDK chama o gancho antes de o endereço trocar, então `window.location` daria a tela de antes. Todo push e todo replace com endereço, inclusive o do aviso de rota, vira transação de navegação (amostra de 10%). O SDK ainda grava o caminho cru no escopo, então `src/lib/sentryScrub.js` troca `/ficha/<id>` por `/ficha/:leadId` no evento inteiro, nas migalhas, em `url.path` e no LCP, e `beforeSendSpan: scrubSpan` limpa a span do INP, que pode levar o nome do cliente pelo `alt` do avatar. O `scrubSpan` nunca devolve `null`, porque com `null` o SDK manda a span original. Segmento novo de endereço que leve id entra na `LEAD_PATH_RE` do `sentryScrub.js`, com teste. Não trocar pela integração do React Router: ela exige `<Routes>` e, sem ele, desliga a navegação do Sentry.

## Ponte com o Stronizap — Parte A, em produção desde 2026-09-09
```

- [ ] **Step 3: `README.md`**

Antes (linhas 10-11):

```markdown
- **Frontend:** React 19 + Vite + Tailwind CSS v4 + lucide-react. Toda a UI vive
  em `src/App.jsx` (single-file, navegação por abas — **sem react-router**).
```

Depois:

```markdown
- **Frontend:** React 19 + Vite + Tailwind CSS v4 + lucide-react + React Router 7.
  A casca vive em `src/App.jsx`. Cada tela tem endereço próprio, sem `<Routes>`:
  a tabela de telas e a decisão de rota moram em `src/lib/routes.js`.
```

Antes (linhas 71-73):

```
src/
  App.jsx                 Toda a UI (single-file)
  lib/                    firebase.js, leads.js, funnels.js, dates.js, constants.js, auth.js
```

Depois:

```
src/
  App.jsx                 Casca do app: login, menu, decisão de rota e telas
  lib/routes.js           Endereço de cada tela (tabela, leitura, links, decisão)
  lib/tenantSlug.js       Formato e palavras reservadas do identificador da academia
  lib/appShell.js         O que a casca do App tira do endereço e da sessão
  lib/                    firebase.js, leads.js, funnels.js, dates.js, constants.js, auth.js
```

Antes (linha 110):

```markdown
1. Valida o slug (único, `[a-z0-9-]`, 3–40 chars).
```

Depois:

```markdown
1. Valida o slug (único, 3 a 40 caracteres em `[a-z0-9-]`, começando e terminando
   com letra ou número, e fora das palavras reservadas de `src/lib/tenantSlug.js`,
   que são as telas do app).
```

- [ ] **Step 4: Spec em dia com o que foi feito**

O spec continua sendo a fonte do que o PR entrega. Treze trechos dele descrevem um detalhe que a montagem do plano ou a revisão mudou (ver "Decisões tomadas na montagem", no começo do plano). Em `docs/superpowers/specs/2026-09-21-endereco-por-tela-design.md`, troque cada trecho abaixo; o da linha 290 sai inteiro. Cada um aparece uma vez só no arquivo; nas linhas 189 e 237 a troca é só do começo da linha, e o resto dela fica igual.

Antes (linha 96):

```markdown
- `parseAppPath(pathname)` → `{ tenantSlug, screen, leadId, superTab, rest }`. Decodifica segmento por segmento. Segmento malformado invalida só a si mesmo.
```

Depois:

```markdown
- `parseAppPath(pathname)` → `{ pathname, tenantSlug, screen, leadId, superTab, rest, unknown }`. Decodifica segmento por segmento. Segmento malformado invalida só a si mesmo.
```

Antes (linha 97):

```markdown
- `hrefFor(tenantId, screen, { leadId, superTab })`. Aceita qualquer `tenantId` não vazio, com `encodeURIComponent`, para uma academia com id fora do padrão nunca perder o menu. `hrefFor(t, 'dashOperacional')` devolve `/<t>`.
```

Depois:

```markdown
- `hrefFor(tenantId, screen, { leadId, superTab })`. Aceita qualquer `tenantId` não vazio, com `encodeURIComponent`, para o link nunca sair quebrado; academia com id fora do formato de leitura fica sempre no Operacional, porque o endereço não relê o id (hoje nenhuma está nesse caso, e a validação do provisionamento impede criar outra). `hrefFor(t, 'dashOperacional')` devolve `/<t>`.
```

Antes (linha 101):

```markdown
- `backTarget({ historyIdx, isClient, tenantId })`: `-1` ou o endereço de reserva.
```

Depois:

```markdown
- `backTarget({ historyState, isClient, tenantId })`: `{ type: 'back' }` ou `{ type: 'replace', href }` com o endereço de reserva.
```

Antes (linha 129):

```markdown
Se o id da academia do claim não relê como a academia do endereço, a decisão devolve `ok` para não entrar em laço. Hoje as cinco academias estão no formato.
```

Depois:

```markdown
Se o id da academia do claim não relê como a academia do endereço, a decisão devolve `ok` a partir da regra 2, para não entrar em laço. Hoje as cinco academias estão no formato. Quando a regra 4 corrige a academia e o endereço corrigido cai numa tela de gestor ou num endereço desconhecido, o aviso sai no mesmo redirect: o destino de todo redirect é aceito de primeira. A volta da visualização (regra 3) só vale na entrada do histórico em que ela foi pedida e enquanto o endereço ainda é da academia que estava assumida.
```

Antes (linha 146):

```markdown
- A leitura do documento começa na hora, mas a ficha só aparece com `ready` e `!loadingData`, com um `ProfileSkeleton` no lugar. Assim ela não mostra cliente sem contrato nem etapa sem cor enquanto os catálogos chegam. "Não encontrada" e erro aparecem sem esperar.
```

Depois:

```markdown
- A leitura do documento começa na hora, mas a ficha só aparece pronta depois dos catálogos e dos contratos da academia (`ready`, `!loadingData` e os contratos já chegados), com um `ProfileSkeleton` no lugar. Assim ela não mostra cliente sem contrato nem etapa sem cor enquanto os catálogos chegam. "Não encontrada" e erro aparecem sem esperar. Sem internet, doc ausente que só o cache respondeu mostra o erro, e não "Não encontrada".
```

Antes (linha 189):

```markdown
- Continua `Sentry.browserTracingIntegration()`, agora com `beforeStartSpan: (o) => ({ ...o, name: routeTemplate(window.location.pathname) })`. Os moldes usam
```

Depois:

```markdown
- Continua `Sentry.browserTracingIntegration()`, agora com `beforeStartSpan: (o) => ({ ...o, name: routeTemplate(o.name) })`. O `o.name` é o caminho da página no pageload e o de destino na navegação. `window.location.pathname` não serve, porque o SDK chama o gancho antes de o endereço trocar e daria a tela de antes. Os moldes usam
```

Antes (linha 220):

```markdown
- O pool de renovação e o contato de hoje só disparam depois de o config da academia chegar. Hoje eles buscam duas vezes em academia com marcos próprios, a cada F5 e a cada aba nova.
```

Depois:

```markdown
- O pool de renovação e o contato de hoje esperarem o config da academia fica para uma tarefa separada, fora deste PR: a primeira tentativa abria uma janela em que a Meta podia gravar meta batida antes da hora. Hoje eles buscam duas vezes em academia com marcos próprios, a cada F5 e a cada aba nova.
```

Antes (linha 227):

```markdown
- **Gesto de voltar do trackpad e do iPhone.** `overscroll-x-contain` no board do Pipeline, no `FunnelTabs` e nas tabelas com rolagem lateral, para o gesto não trocar de tela.
```

Depois:

```markdown
- **Gesto de voltar do trackpad e do iPhone.** `overscroll-x-contain` no board do Pipeline e em todo rolador horizontal (tabelas, abas da ficha e dos cadastros), para o gesto não trocar de tela. O `FunnelTabs` não rola para o lado: o excedente vai para o menu "+N". Uma varredura nos testes cobra a classe de todo `overflow-x-auto`.
```

Antes (linha 237):

```markdown
- `routes.test.js`: cada endereço da tabela;
```

Depois:

```markdown
- `routes.test.js` e `routes.decision.test.js`: cada endereço da tabela;
```

Antes (linha 245):

```markdown
- `appLink.test.js` com `renderToString` sob `MemoryRouter`: href certo, `LeadLink` com id inválido vira `<span>`, `LeadLink` leva o state, `SidebarItem` com `href` é `<a aria-current="page">` e sem `href` é `<button>`.
```

Depois:

```markdown
- `appLink.test.js` com `renderToString` sob `MemoryRouter`: href certo, `LeadLink` com id inválido vira `<span>` e `LeadLink` leva o state. `menuLinks.test.js`: `SidebarItem` com `href` é `<a aria-current="page">` e sem `href` é `<button>`.
```

Antes (linha 246):

```markdown
- `npm run lint` sem eslint-disable novo. Saem dois (o do `useProfileLead` e o do `justCreatedLeadId`).
```

Depois:

```markdown
- `npm run lint` sem eslint-disable novo. Saem três (o do `useProfileLead`, o do `justCreatedLeadId` e o do effect que forçava a tela do super-admin).
```

Antes (linha 287):

```markdown
- O Sentry ignora navegação por replace, então depois do aviso de gestor um erro sai com o nome da tela anterior. É diagnóstico, não privacidade.
```

Depois:

```markdown
- Todo push e todo replace com endereço, inclusive o do aviso de rota, vira transação de navegação no Sentry. O nome sai do destino (`options.name`), porque o SDK chama o gancho antes de o endereço trocar.
```

Linha 290, apagar inteira (a T5 tirou esse risco):

```markdown
- Sem internet, uma ficha fora do cache pode aparecer como não encontrada.
```

Conferir:

```bash
node -e "const s=require('fs').readFileSync('docs/superpowers/specs/2026-09-21-endereco-por-tela-design.md','utf8');for (const t of ['historyIdx','routeTemplate(window.location.pathname)','nunca perder o menu','a ficha só aparece com ','só disparam depois de o config','no board do Pipeline, no ','Saem dois','O Sentry ignora','pode aparecer como não encontrada']) console.log(t, s.includes(t))"
```

Expected: nove linhas, todas terminando em `false`.

- [ ] **Step 5: Conferir que tudo que a documentação cita existe**

```bash
for f in src/lib/routes.js src/lib/tenantSlug.js src/lib/appShell.js src/lib/fichaState.js src/views/LeadProfileRoute.jsx src/components/nav/AppLink.jsx src/components/RouteRedirect.jsx src/hooks/useRouteScroll.js src/lib/sentryScrub.js src/lib/__tests__/routes.test.js src/lib/__tests__/tenantSlug.test.js src/lib/__tests__/overscrollGuard.test.js; do test -f "$f" || echo "FALTA $f"; done
git grep -n -E "export function (routeTemplate|hrefFor|parseAppPath|routeDecision)|export const (SCREENS|RESERVED_TENANT_SLUGS)" -- src/lib
```

Expected: o laço não imprime nada; o `git grep` mostra as seis exportações. Se algum nome ou arquivo das outras tarefas saiu diferente do contrato, corrija o texto da seção nova antes do commit.

- [ ] **Step 6: Passar o humanizer**

Invocar a skill `anthropic-skills:humanizer` sobre o texto novo do `CLAUDE.md`, do `README.md` e do spec (regra do `CLAUDE.md` raiz do STRONIX-FIRMA: sem travessão no meio da frase, sem frase de efeito, direto). Aplicar só o que ela apontar no texto novo desta tarefa; o que já existia no arquivo fica como está.

- [ ] **Step 7: Commit da documentação**

```bash
git add CLAUDE.md README.md docs/superpowers/specs/2026-09-21-endereco-por-tela-design.md
git commit -m "$(cat <<'EOF'
docs: endereço de cada tela no CLAUDE.md, no README e no spec

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: A branch não está atrás da main**

```bash
git fetch origin -q && git rev-list --count HEAD..origin/main
```

Expected: `0`. Se der mais que zero: `git merge origin/main`, resolver conflito se houver, e refazer os Steps 9 a 13.

- [ ] **Step 9: Testes e lint**

```bash
npx vitest run 2>&1 | tail -5
npm run lint 2>&1 | tail -4
```

Expected: `Test Files  100 passed (100)` e `Tests  2059 passed (2059)` (1824 mais os 235 novos da tabela "Tarefas e contagem de testes"), sem nenhum `failed`; lint `✖ 1 problem (0 errors, 1 warning)`, o aviso antigo do `SuperAdminView.jsx` (linha 113 desde a T11, `react-hooks/exhaustive-deps`).

- [ ] **Step 10: Nenhum `eslint-disable` novo, e os velhos que deviam sair saíram**

```bash
git diff origin/main -U0 -- src api scripts | awk '/^\+[^+]/ && /eslint-disable/'
git diff origin/main -U0 -- src api scripts | awk '/^-[^-]/ && /eslint-disable/'
```

Expected: o primeiro não imprime nada. O segundo imprime exatamente três linhas, todas de `react-hooks/set-state-in-effect`: a do effect do `justCreatedLeadId` e a do effect que forçava a tela do super-admin, as duas do `src/App.jsx`, e a do `src/hooks/useProfileLead.js`.

- [ ] **Step 11: Nada de navegação por fora do roteador nem resto do estado antigo**

```bash
git grep -n -E "history\.(replaceState|pushState)\(" -- src ':(exclude)src/**/__tests__/**'
git grep -n -E "setActiveTab|setProfileLeadId|setSuperTab|setSettingsTab|openSettingsTab|justCreatedLeadId|setIsMobileMenuOpen" -- src
```

Expected: as duas buscas sem saída (a primeira procura chamada, com o parêntese, porque o comentário do `RouteRedirect.jsx` cita `history.replaceState`). Um `history.replaceState` cru apagaria o `idx` do React Router e o Voltar da ficha passaria a cair sempre na lista de reserva.

- [ ] **Step 12: Build e trava do gesto no CSS**

```bash
npm run build 2>&1 | tail -3
/usr/bin/grep -l 'overscroll-behavior-x:contain' dist/assets/*.css
```

Expected: `✓ built in ...` e o nome de um arquivo `dist/assets/index-*.css`.

- [ ] **Step 13: Sentry**

Run: `npm run verificar:sentry 2>&1 | tail -4`
Expected: termina em `Sentry não recebe a chave do Zap nem telefone, e a sabotagem prova que esta verificação enxergaria se recebesse.`, com `rodada normal:    OK` e `rodada sabotagem: OK`.

- [ ] **Step 14: Publicar a branch**

```bash
git push -u origin claude/rotas-pr2-enderecos
```

Expected: `branch 'claude/rotas-pr2-enderecos' set up to track 'origin/claude/rotas-pr2-enderecos'`.

- [ ] **Step 15: Abrir o PR (o merge é do Johnny)**

Montar o corpo num arquivo fora do repositório, com os números da suíte e a lista de testes novos saindo dos comandos, e abrir o PR:

```bash
BODY=$(mktemp -t pr2-body)
RES=$(npx vitest run 2>&1 | tail -6)
ARQ=$(echo "$RES" | awk '/Test Files/{print $3}')
TST=$(echo "$RES" | awk '/Tests /{print $2}')
SAIRAM=$(git diff origin/main -U0 -- src api scripts | awk '/^-[^-]/ && /eslint-disable/' | wc -l | tr -d ' ')
{
cat <<'EOF'
Segundo PR do endereço por tela (spec em `docs/superpowers/specs/2026-09-21-endereco-por-tela-design.md`, plano em `docs/superpowers/plans/2026-09-22-rotas-pr2-enderecos.md`). O PR 1 (#216) deixou várias abas abertas sem susto. Este dá endereço a cada tela e a cada ficha. Ctrl+clique nas listas, nos cards, na Meta, na busca e no sino fica para o PR 3.

## O que muda para quem usa

- Cada tela do menu e cada ficha têm endereço, com a academia na frente: `/<academia>/pipeline`, `/<academia>/meta-diaria`, `/<academia>/ficha/<id>`. F5 mantém a tela.
- Voltar e avançar do navegador andam entre as telas visitadas.
- Ctrl+clique, botão do meio e "Abrir em nova aba" funcionam no menu lateral, em Perfil da academia e Plano e faturas (menu da conta) e no "Ver faturas" do aviso de mensalidade.
- A ficha abre direto pelo link, de lead ativo, cliente, perdido ou vencido. Link errado ou de outra academia mostra "Ficha não encontrada". Ficha excluída por outra pessoa enquanto estava aberta mostra "Essa ficha foi excluída". Falha de rede mostra "Não deu para abrir a ficha", com "Tentar de novo".
- O Voltar da ficha faz o mesmo que o voltar do navegador. Ficha aberta direto numa aba nova volta para Clientes (cliente) ou Pipeline (lead), nunca para fora do app.
- Depois do login a pessoa cai no endereço que tentou abrir, inclusive uma ficha.
- Consultor que abre endereço de gestor vê "Essa tela é só do gestor." e cai no Operacional, sem a tela de gestor piscar. Endereço desconhecido mostra "Não achamos essa tela. Abrimos o Operacional."
- O título da aba diz a tela: "Meta diária · STRONIX · STRONILEAD". Na ficha, só "Ficha", sem o nome da pessoa.
- Sair recarrega a página e cai no login da academia. Quem entra depois no mesmo computador não vê nada da sessão anterior.
- "Acessar como" abre o Operacional da academia assumida, sem a tela em branco de antes, e "Sair da visualização" volta para onde o super-admin estava.
- O menu do celular fecha ao trocar de tela e com o voltar do navegador.
- Configurações pelo menu abre em Equipe e acessos. "Configurar agora" de uma novidade abre em Metas e ritmo.
- O Pipeline volta no funil escolhido depois do F5 em toda academia. Antes isso só funcionava na STRONIX.
- Ir para outra tela abre no topo. Voltar devolve a rolagem da página (Operacional, CRM, Gerencial, listas). O quadro do Pipeline, as colunas da Meta e o que veio pelo "carregar mais" ainda voltam do começo: isso é da entrega 2.
- Tela que quebrou deixa de ficar presa: trocar de tela pelo menu limpa o erro.
- Rolar um quadro para o lado até a borda, no trackpad do Mac, deixa de voltar de tela.

## Como funciona por dentro

- React Router fixado em `~7.18.4` (a 8 exige React 19.2.7), com `<BrowserRouter useTransitions={false}>` em `src/main.jsx` e sem `<Routes>`. O `AppInner` lê `useLocation()` e calcula `activeTab`, `resolvedTab`, `profileLeadId` e `superTab` no render. Nenhum effect lê a URL para dar setState.
- `src/lib/routes.js` (puro): tabela de telas, leitura e montagem de endereço, decisão de rota, Voltar pelo `idx` do `history.state`, título da aba, molde para o Sentry e decisão de rolagem.
- `src/lib/appShell.js` (puro): o que a casca do App tira do endereço e da sessão (tela acesa no menu, origem da ficha, chave da sessão, marca do login, destino do Sair, volta da visualização e funil salvo).
- `src/lib/tenantSlug.js` (puro): formato e palavras reservadas do identificador da academia, usado no provisionamento, no Console, no `scripts/register-tenant.js` e no `/api/tenant-resolve` (palavra reservada responde "não achei" sem ler o banco).
- `RouteRedirect` troca o endereço com replace e mostra o aviso, uma vez por endereço barrado.
- Ficha: `LeadProfileRoute` com `key` pelo id, `useProfileLead` reescrito com os estados em `src/lib/fichaState.js`, sem setState síncrono em effect.
- Links: `AppLink` e `LeadLink` (`src/components/nav/AppLink.jsx`) por cima do `Link` do React Router. O menu monta os endereços com a academia do claim, nunca a da barra.
- Sentry: a navegação sai com o nome do molde da tela de destino (`/:tenant/ficha/:leadId`), e `sentryScrub.js` tira o id da ficha do evento, das migalhas, de `url.path`, do LCP e da span do INP.

## Custo de leitura

- Ficha e linha do tempo obedecem ao portão de 15 minutos de ociosidade. Uma ficha esquecida numa aba deixa de ficar assinada a noite toda.
- O `/api/tenant-resolve` só é chamado quando a tela de login vai aparecer. O F5 de quem já está logado deixa de gastar a cota de 60 chamadas por IP a cada 5 minutos.

## O que não muda

- Regras e índices do Firestore: nada para publicar.
- Funções da Vercel: continuam 11 de 12.
- Console do super-admin sem endereço. Convite (`/?invite=&t=`) e indicação pública (`/i/<slug>?ref=`) como hoje, e `invite`, `t` e `ref` ficam reservados.
- Nenhum caminho novo em que o consultor veja o que não via: as travas continuam, a ficha lê pela academia do claim, e nome, telefone e CPF nunca vão para o endereço nem para o título.

## Testes

EOF
echo "- \`npx vitest run\`: $ARQ arquivos, $TST testes verdes (antes 85 e 1824)."
echo "- Arquivos de teste novos:"
git diff --name-only --diff-filter=A origin/main -- '*.test.js' | sed 's/^/  - `/; s/$/`/'
echo "- Arquivos de teste que ganharam casos:"
git diff --name-only --diff-filter=M origin/main -- '*.test.js' | sed 's/^/  - `/; s/$/`/'
echo "- \`npm run lint\`: 0 erros, 1 aviso antigo no \`SuperAdminView\`. Nenhum \`eslint-disable\` novo, e saíram $SAIRAM."
cat <<'EOF'
- `npm run build` e `npm run verificar:sentry` ok.
- Conferência de produção em 21/09 (só leitura): as cinco academias estão no formato de identificador e nenhuma usa palavra reservada.

## Para conferir no preview antes do merge

Nunca com o dev local apontado para a produção. O preview usa o Firebase de produção (`src/lib/firebase.js` cai no projeto `crm-stronix`). Tudo que cria ou apaga dado é feito na `academia-teste`, com um lead cadastrado só para o teste.

- [ ] F5 em cada endereço mantém a tela: `/<academia>`, `/visao-geral/operacional`, `/visao-geral/crm`, `/visao-geral/gerencial`, `/pipeline`, `/clientes`, `/meta-diaria`, `/leads`, `/leads/aulas`, `/leads/visitas`, `/configuracoes`, `/perfil-da-academia`, `/plano-e-faturas`, `/ficha/<id>` e, como super-admin membro, `/super-admin/visao-geral`, `/clientes`, `/financeiro` e `/planos`.
- [ ] Voltar e avançar entre Pipeline, Clientes e Meta.
- [ ] Super-admin membro: trocar entre Visão Geral, Clientes, Financeiro e Planos não mostra carregando e não faz nova chamada a `/api/super-overview` na aba Rede. A busca digitada em Clientes continua lá ao voltar da subaba Planos.
- [ ] Menu com Ctrl+clique, botão do meio e botão direito abre outra aba no endereço certo. O mesmo em Perfil da academia e Plano e faturas (menu da conta) e no "Ver faturas" do aviso de mensalidade.
- [ ] Deslogado, abrir uma ficha pelo link: login com a marca da academia e depois a ficha.
- [ ] Ficha colada numa aba nova: Voltar leva a Clientes (cliente) ou Pipeline (lead). Aberta pelo app, o Voltar volta para a tela de antes.
- [ ] Abrir ficha pelo clique no card do Pipeline e pelo botão Abrir do card, pelas listas de Clientes, Leads, Aulas e Visitas, pelo card da Meta e pela visão Equipe, pela busca (clique e Enter), pelo sino (Passaram para você e Indicações) e pela aba Indicações da ficha. Em cada um, o item do menu da origem continua aceso e o Voltar da ficha volta para a origem com um clique.
- [ ] Na ficha, clicar em "Indicado por" abre a ficha de quem indicou, e o Voltar leva de volta à primeira ficha. Clicar de novo na ficha que já está aberta (pelo sino ou pela busca) não cria entrada nova no voltar.
- [ ] Na Meta, WhatsApp, Ligar, Adiar, os desfechos e Remarcar continuam funcionando sem abrir a ficha.
- [ ] Deslogado, abrir `/i/<academia>?ref=<id de um cliente da academia-teste>`: a página pública de indicação abre com o nome de quem indicou. Abrir um link de convite gerado em Configurações da academia-teste: a tela de aceite aparece.
- [ ] Consultor em `/configuracoes`: aviso "Essa tela é só do gestor." e Operacional, sem piscar Configurações.
- [ ] `/<academia>/xyz` mostra o aviso de tela não encontrada. `/<academia>/ficha/idQueNaoExiste`, `/<academia>/ficha/a%2Fb`, `/<academia>/ficha/__x__`, `/<academia>/ficha` sem id e o id de uma ficha de outra academia mostram "Ficha não encontrada", sem "Essa tela travou" e sem o aviso de tela não encontrada.
- [ ] F5 numa ficha de lead ativo, cliente, perdido e vencido mantém a ficha. Aba nova com rede lenta (DevTools, Slow 3G): aparece o esqueleto da ficha, e ela surge já com etapas, etiquetas e contratos.
- [ ] Na `academia-teste`, com um lead criado para o teste: Excluir pela ficha mostra "Excluindo a ficha…" e depois volta. Clicar no Pipeline no meio da exclusão: a pessoa fica no Pipeline. Com outro lead de teste aberto numa aba, excluí-lo em outra aba mostra "Essa ficha foi excluída".
- [ ] DevTools offline e F5 numa ficha fora do cache: "Não deu para abrir a ficha", e não "Ficha não encontrada"; religar a rede e clicar em "Tentar de novo" abre a ficha.
- [ ] Título da aba diz a tela ("Meta diária · <Academia> · STRONILEAD"). Ficha aberta pela Meta: o item Meta diária continua aceso e o cabeçalho continua "Sua Meta Diária". Ficha colada numa aba nova: cabeçalho e título dizem "Ficha".
- [ ] Sair: login da academia. Entrar com outra conta não mostra nada da anterior, e a chave `crm-impersonation` some do Session Storage. Sair durante a visualização vai para o login geral em `/`.
- [ ] Logado, F5 no Pipeline: nenhuma chamada a `/api/tenant-resolve` na aba Rede. Deslogado em `/<academia>`: uma chamada.
- [ ] "Acessar como" pelo Console e pela tela de super-admin abre o Operacional da academia assumida. "Sair da visualização" volta ao lugar de antes.
- [ ] Celular: tocar no item ativo fecha o menu. Voltar com o menu aberto fecha o menu.
- [ ] Configurações pelo menu abre em Equipe e acessos. "Configurar agora" de uma novidade abre em Metas e ritmo.
- [ ] Na `academia-teste`, Cadastrar lead e clicar em "Ver ficha": a ficha abre na hora.
- [ ] Pipeline em academia que não é a STRONIX: escolher um funil e dar F5 mantém o funil.
- [ ] Arrastar card no Pipeline continua leve.
- [ ] Mac, Chrome e Safari: rolar o Pipeline até a borda e insistir não troca de tela.
- [ ] Erro de teste no console com a ficha aberta: o envelope do Sentry não tem o id do lead (no preview com `VITE_SENTRY_DSN`: F5 em `/<academia>/ficha/<id>`, rodar `setTimeout(() => { throw new Error('teste-endereco-sentry') })` no console e procurar o id no corpo do envio para o Sentry, na aba Rede).
- [ ] Console, Nova academia com o nome "Console": aparece "Esse identificador é usado pelo sistema. Escolha outro." e nada é criado (a recusa acontece antes de chamar a `api/`).
- [ ] Rolar o Operacional, abrir uma ficha pela busca e voltar devolve a rolagem.
- [ ] Custo: fora do horário de uso (depois das 22h), na `academia-teste`, anotar as leituras do painel do Firestore em 5 minutos sem mexer em nada e depois em 5 minutos abrindo 5 fichas em 5 abas (colando o endereço, porque o Ctrl+clique na busca é do PR 3). O número da PR é a diferença: ___

## Riscos conhecidos

- O Voltar da ficha depende do `idx` que o React Router grava no `history.state`. O teste do contrato trava isso na 7.18.4. Se um dia falhar, o Voltar cai em Clientes ou Pipeline e nunca sai do app.
- Voltar do navegador com uma janela aberta dentro de uma tela ou da ficha (contrato, desfecho da Meta) fecha a tela e perde o que foi digitado. Antes o voltar saía do app inteiro, então não piora, mas passa a acontecer dentro dele. Vale avisar a equipe.
- Cadastrar lead, Central de ajuda, Suporte, sino, menu da conta e a busca do celular ficam por cima de tudo. O voltar do navegador (e o botão de voltar do Android) troca a tela de trás e a janela continua aberta, com o que foi digitado. Fechar essas janelas pelo voltar é de uma entrega futura.
- Voltar até a entrada onde o menu do celular foi aberto e depois avançar reabre o menu. Fecha com um toque.
- No iPhone e no Android, o gesto de voltar pela borda da tela é do sistema e continua voltando de tela. O `overscroll-x-contain` segura o gesto de rolagem do trackpad. O Safari do Mac pode não respeitar a trava: o checklist confere.
- Depois do "Configurar agora", um F5 em Configurações reabre em Metas e ritmo, porque a seção fica no histórico da aba. Pelo menu volta para Equipe e acessos.
- Depois de uma troca de conta na mesma aba, entradas antigas do histórico são reescritas para a academia atual quando o voltar chega nelas.
- Cada troca de tela vira transação de navegação no Sentry, amostrada a 10%, inclusive o replace do aviso de rota. Olhar a cota depois de uns dias.
- "Acessar como" continua derrubando as outras abas do super-admin, e Ctrl+clique durante a visualização abre o login.
- Se a exclusão pela ficha falhar, a ficha volta na aba Linha do tempo e perde o que estava na tela (aba escolhida, rascunho da nota).
- Corrigir só as maiúsculas do endereço de uma ficha (`/STRONIX-CRM-APP/ficha/<id>`) perde a tela de origem: o cabeçalho passa a dizer "Ficha".
- Com o `/api/tenant-resolve` só na tela de login, a marca da academia aparece um instante depois do fim da checagem da sessão.
- O menu monta o link de uma academia com id fora do formato para o link nunca sair quebrado; academia com id fora do formato de leitura fica sempre no Operacional, porque o endereço não relê o id (hoje nenhuma está nesse caso, e a validação nova do identificador impede criar outra).

## Depois do merge

- Linha na tabela "Últimas Atualizações" do `CLAUDE.md` raiz do STRONIX-FIRMA, e React Router na stack do Stronilead em `06-sistemas/CLAUDE.md`.
- Avisar a equipe do voltar do navegador com janela aberta.
- PR 3: Ctrl+clique em tudo que abre ficha.
- Pool de renovação e contato de hoje só depois do config: fica para uma tarefa separada (a primeira tentativa abria uma janela em que a Meta podia gravar meta batida antes da hora).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
} > "$BODY"
echo "arquivos=$ARQ testes=$TST eslint-disable-que-sairam=$SAIRAM"
gh pr create --base main --head claude/rotas-pr2-enderecos --title "Endereço por tela: cada tela e cada ficha com link próprio" --body-file "$BODY"
```

Expected: o `echo` mostra três números (nenhum vazio; se algum vier vazio, rodar de novo o `npx vitest run` e conferir o formato do resumo antes de abrir o PR); o `gh` imprime a URL do PR. Antes de rodar, conferir o nome do arquivo do plano citado na primeira linha do corpo com `ls docs/superpowers/plans/` e passar o humanizer no corpo (mesma regra do Step 6).

- [ ] **Step 16: Parar aqui**

Não fazer merge. Mandar ao Johnny a URL do PR e lembrar dos três pontos que dependem dele: o checklist no preview, a medição de leituras e o merge.

---

## Resumo dos testes novos

| Tarefa | Arquivo | Testes |
|---|---|---|
| T2 | `src/lib/__tests__/tenantSlug.test.js` (novo) | 13 |
| T2 | `api/__tests__/tenantResolve.test.js` (novo) | 4 |
| T2 | `api/__tests__/provisionTenant.test.js` (novo) | 4 |
| T3 | `src/lib/__tests__/routes.test.js` (novo) | 35 |
| T3 | `src/lib/__tests__/tenantSlug.test.js` (guarda das telas) | 1 |
| T4 | `src/lib/__tests__/routes.decision.test.js` (novo) | 39 |
| T5 | `src/lib/__tests__/fichaState.test.js` (novo) | 24 |
| T6 | `src/lib/__tests__/sentryScrub.test.js` (de 42 para 67) | 25 |
| T6 | `src/lib/__tests__/sentryInit.test.js` (novo) | 4 |
| T7 | `src/lib/__tests__/appLink.test.js` (novo) | 13 |
| T8 | `src/lib/__tests__/routeRedirect.test.js` (novo) | 4 |
| T8 | `src/lib/__tests__/useRouteScroll.test.js` (novo) | 12 |
| T9 | `src/lib/__tests__/useProfileLead.test.js` (novo) | 4 |
| T9 | `src/lib/__tests__/leadProfileRoute.test.js` (novo) | 11 |
| T10 | `src/lib/__tests__/appShell.test.js` (novo) | 17 |
| T11 | `src/lib/__tests__/appShell.test.js` | 13 |
| T12 | `src/lib/__tests__/menuLinks.test.js` (novo) | 10 |
| T13 | `src/lib/__tests__/overscrollGuard.test.js` (novo) | 2 |
| **Total** | 15 arquivos novos | **235** |

A suíte vai de 85 arquivos e 1824 testes para 100 arquivos e 2059 testes.
