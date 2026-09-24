# Filtros no endereço e sub-telas no caminho, entrega 2 PR 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O que a pessoa escolhe dentro de uma tela passa a morar no endereço. F5 mantém o recorte, o link mandado para um colega abre igual, e cada aba pode estar num recorte diferente. As Configurações ganham endereço por seção e a ficha por aba. Quem abre um link com valor estranho vê a tela funcionando no padrão, sem aviso e sem erro.

**Architecture:** Nenhuma peça nova de roteamento. `src/lib/routes.js` continua dono do caminho e ganha a sub-tela no molde que a subaba do super-admin já usa (`SCREENS[x].subs`, `parseAppPath` devolvendo `sub`, `hrefFor` montando o segmento). A query ganha um módulo puro irmão, `src/lib/screenParams.js`, com a tabela de parâmetros por tela, a leitura (query para os valores da tela, já saneados contra o contexto) e a montagem (valores para query, omitindo o que é padrão). Um hook fino, `src/hooks/useScreenParams.js`, liga os dois à tela: deriva os valores no render a partir de `useLocation()` e troca filtro com `navigate(pathname + query, { replace: true })`. Nenhuma tela guarda filtro em `useState`, nenhuma lê a URL num effect, e nada disso entra em `screenKey`, na key do `AppErrorBoundary` nem em key de componente.

**Tech Stack:** React 19.2.4 + Vite 8 (JS/JSX, sem TypeScript), react-router 7.18.4 sem `<Routes>`, Firebase JS 12.11, Tailwind v4 + shadcn/ui, vitest 4 em node sem jsdom, eslint 9 com react-hooks v7 como portão do CI.

**Spec:** [`docs/superpowers/specs/2026-09-23-filtros-no-endereco-design.md`](../specs/2026-09-23-filtros-no-endereco-design.md). Vale para este PR tudo menos a seção "A lista viva por trás da ficha", que é o PR 2.

**Branch:** `claude/rotas-e2-filtros`, criada da main `7cccd0e` (PRs #216, #217, #218 e #219 já dentro).

**Base conferida em 2026-09-23 (`fda9f27`):** `npx vitest run` → `Test Files  106 passed (106)` e `Tests  2118 passed (2118)`. `npm run lint` → `✖ 1 problem (0 errors, 1 warning)`, o aviso antigo de `src/views/superadmin/SuperAdminView.jsx:113` (`react-hooks/exhaustive-deps`).

**Como este plano foi conferido:** cada trecho "Antes" foi copiado do arquivo real nesta branch e conferido como ocorrência única. Os números de linha são desta branch; se algum não bater porque a main andou, vale o trecho. O que o plano supõe sobre o código foi medido:

- `parseAppPath` já devolve `rest` para a ficha e para as telas-folha, e ninguém consome esse `rest` (`src/lib/routes.js:107-110` e `133-136`). `/configuracoes/equipe` e `/ficha/<id>/contratos` já leem hoje, e os testes das linhas 137-141 de `routes.test.js` travam isso.
- `screenKey` ignora `rest` de propósito (`routes.js:317-322`), então sub-tela não remonta o `AppErrorBoundary` nem zera a rolagem.
- `redirectTo` monta o `target` com `screen`, `leadId` e `superTab` e NÃO leva o `rest` (`routes.js:230-233`). Sem levar o `sub` junto, a correção de academia desenharia a seção padrão por um render antes de saltar para a certa.
- O helper `casa()` de `routes.decision.test.js:18` preenche `{ leadId: null, superTab: null, ...target }`. Campo novo no `target` entra ali, num lugar só.
- `screenState` é comparado com `toEqual` exato em `appShell.test.js:20`. Campo novo entra ali também.
- Dois testes de hoje comparam objeto INTEIRO com `toEqual` e quebram assim que o objeto ganha campo: a raiz em `routes.test.js:75-77` (`parseAppPath` sem `sub`) e o alvo de todo redirect pelo `casa()`. Os dois são editados no mesmo passo em que o campo nasce, e por isso aparecem no "ver a cor vermelha". O state do link em `appLink.test.js:138` (`{ from: 'kanban' }` sem `search`) ficou fora: com a T8 revertida, o campo `search` não nasce e o arquivo não muda em PR nenhum desta entrega.
- O `describe('backTarget')` de `routes.decision.test.js:229-242` tem TRÊS testes, e o terceiro é o da academia fora do formato (`Academia_Legada`). Nenhuma tarefa mexe nele: a T8 chegou a reescrever o bloco e foi revertida.
- `usersList` começa `[]`, vira `[appUser]` e só fica completa no `getDocs` (`App.jsx:302` e `845-848`). Funis, etapas e contratos chegam por assinatura. Todo saneamento depende desses dados, então o primeiro render de um link com filtro lê no padrão (decisão 17).
- `useSearchParams` não é usado em lugar nenhum de `src/`, e não deve ser: medido em `node_modules/react-router/dist/development/chunk-OB3PAWPO.mjs:10931-10962`, o `setSearchParams` navega sem `state` (apaga o `from` da ficha), não é referencialmente estável, a forma funcional lê o closure do render e o padrão dele é push.
- `navigate(to, { replace: true })` sem `state` APAGA o `location.state`. Toda navegação de filtro e de sub-tela deste plano passa `state: location.state` de propósito.
- O `person` do Operacional NÃO é saneado contra `users` hoje (`DashboardOperacionalView.jsx:309`), ao contrário do CRM (`DashboardCrmView.jsx:51-52`). Com a pessoa no endereço isso vira defeito visível, e o módulo puro passa a sanear os dois.
- Nenhum filtro de hoje vira consulta nova por causa deste PR: mês, comparativo e o período de Aulas e Visitas já eram consulta antes, e o resto é recorte em memória.
- `api/` não é tocado. Nenhuma função nova na Vercel (11 de 12 continuam), nenhuma regra e nenhum índice novo do Firestore.

---

## Regras para todas as tarefas

- Sem jsdom. Todo teste roda em node, em `src/lib/__tests__/`, com `createElement` e `renderToString` quando precisar de componente (sem JSX em `.test.js`), e com `MemoryRouter` em volta de qualquer coisa que tenha link.
- Zero `eslint-disable` novo. `react-hooks/set-state-in-effect`, `refs`, `purity`, `static-components`, `immutability` e `react-refresh/only-export-components` são erro e a config não pode ser rebaixada.
- **Nada deste PR entra em `screenKey`, na key do `AppErrorBoundary` (`src/App.jsx:1682`) nem em key de view.** Filtro em key faz Todos os leads e Configurações relerem a coleção inteira a cada clique. Não quebra nada, não aparece no console, só na fatura.
- **Filtro e sub-tela navegam com `replace: true` e com `state: location.state`.** Replace por causa da decisão 3 do Johnny (trocar filtro não cria parada no voltar) e porque o `idx` do history é o que o Voltar da ficha lê. O `state` explícito porque o `navigate` não o repassa sozinho, e é nele que vive o `from` da ficha.
- **A tela nunca lê a query direto.** Quem lê é `src/lib/screenParams.js`, pelo hook. Nenhum arquivo de `src/views/` pode conter `location.search` depois deste PR (a varredura da T9 cobra).
- Nada de dado pessoal no endereço: nome, telefone, CPF e texto de busca ficam de fora. Id de pessoa da equipe entra, como o id do lead já entra.
- Nome novo de parâmetro nunca pode ser `invite`, `t` ou `ref`.
- Texto na tela e comentário em português direto, sem jargão de programação e sem travessão no meio da frase.
- Commits em português, formato `tipo: descrição`, terminando com `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Um commit por tarefa. Nada de `git push`, de abrir PR e de merge.
- Nunca usar `git stash` puro (a pilha é compartilhada com os outros worktrees).
- No shell do Claude Code, `grep` é função do perfil e às vezes devolve vazio quando o padrão tem `\|`. Busca cujo resultado esperado é "nada" usa `git grep -E`, `/usr/bin/grep` ou `node -e`.
- Se a suíte da base der outro número porque a main andou, anote a diferença e some a ela todos os números esperados abaixo.

## Decisões tomadas na montagem

Onde o spec deixava duas saídas, valeu o que está aqui. A T9 põe o `CLAUDE.md` e o spec em dia com isso.

1. **A tela monta o endereço com `location.pathname` + query, não com `hrefFor`.** Trocar filtro é ficar na mesma tela, então o caminho de agora já é o certo. Com `hrefFor` o Operacional cairia sempre em `/<academia>` (routes.js:187) e um filtro clicado em `/<academia>/visao-geral/operacional` mudaria o endereço canônico no meio da sessão, o que empilharia entrada nova com a mesma `screenKey` e cairia na armadilha da memória de rolagem.
2. **Filtro e sub-tela usam replace.** Vale também para a seção das Configurações e para a aba da ficha: com push, o Voltar da ficha passaria a andar entre abas em vez de voltar para a lista.
3. **A query sobrevive só onde o redirect mantém a tela, que é o que `routeDecision` já faz hoje.** A correção de academia (regra 5) repassa a query (`routes.js:302`); os outros quatro redirects vão para outra tela e a descartam. Quando a correção de academia perde a tela (ficha de outra academia vira a tela inicial), a query vai junto e é inofensiva: todo parâmetro é saneado contra os dados da academia da sessão, e nome desconhecido é ignorado. Fica travado por teste em vez de mudar o código.
4. **Sub-tela desconhecida abre a tela-mãe, com replace e sem aviso.** `/configuracoes/xyz` vai para `/configuracoes`, `/ficha/<id>/xyz` para `/ficha/<id>`. O aviso "não achamos essa tela" continua só para endereço de tela. É o mesmo tratamento que `hrefFor` já dá a subaba de super-admin fora da tabela.
5. **`resp` tem três estados e o padrão é por papel só no Pipeline.** Ausente é o padrão do papel (`defaultRespFilterFor`), `resp=` é "toda a equipe" e com ids é a lista. Nas outras telas o padrão é lista vazia, então `resp=` e ausente querem dizer a mesma coisa.
6. **Filtro de responsável e de professor é ignorado para quem não vê o controle.** Em Clientes, Todos os leads, Aulas e Visitas a seção Responsável é de gestor (`ClientsView.jsx:232`, `LeadsView.jsx:263`, `AppointmentTrackingView.jsx:503`, e nas duas últimas é o botão inteiro de filtros). Sem isso, um link de gestor prenderia o consultor num recorte que ele não tem como limpar. No Pipeline o controle é de todos desde o PR #189, então ali o parâmetro vale sempre.
7. **O funil das telas de lista é escrito no endereço sempre que é válido, e essa é a única exceção à regra "o padrão nunca é escrito".** O padrão dele é por pessoa (o último funil usado, guardado no localStorage por academia), então omitir faria o mesmo link abrir em funis diferentes para duas pessoas. Ler continua obedecendo a decisão 4 do Johnny: link sem `funil` usa o último funil usado.
8. **Trocar o funil na tela continua gravando no localStorage, e o cadastro rápido passa a seguir o funil do endereço.** `setSelectedFunnelId` é chamado junto com a navegação, então os dois effects corretivos de funil (`App.jsx:879-900`) continuam funcionando como hoje, sem nenhum effect novo lendo a URL. Só que `rememberFunnel` só roda no CLIQUE: abrir `/<academia>/pipeline?funil=f2` por link, ou dar F5 ali, deixaria o quadro em `f2` e o `selectedFunnelId` do App em `f1`, e o "Novo lead" (`App.jsx:1758`) nasceria no funil errado. Hoje os dois nunca divergem e não podem passar a divergir, então o App deriva o funil da tela de lista no render (`funnelFromSearch`, T4 Step 4) e alimenta com ele o `AddLeadModal`. Fora das telas de lista o endereço não tem funil, e ali vale o guardado, como sempre valeu.
9. **O filtro de fase de Todos os leads viaja como código e a tela traduz.** O estado da tela continua guardando NOME de etapa; o endereço leva o id do documento da etapa, mais os códigos `venda` e `perda` para as duas colunas terminais, que não têm id. Renomear a etapa não quebra o link.
10. **A limpeza da fase ao trocar de funil deixa de ser ajuste de estado no render e vira parte da mesma navegação.** Um clique no funil escreve `funil` e apaga `fase` numa entrada só.
11. **`dia` e o par `de`/`ate` são exclusivos, e o par ganha.** Período inválido (data torta, fim antes do início, mais de 30 dias) cai fora inteiro e a tela abre no atalho de dia padrão, sem erro na tela.
12. **A visão Equipe da Meta fica fora (decisão 6 do Johnny), e o filtro de plano de Clientes também (decisão 7).** Os dois continuam em `useState`.
13. **A aba Indicações da ficha só existe para cliente.** Endereço com ela numa ficha de lead abre a Linha do tempo, sem redirect: se é cliente ou não só se sabe depois de o documento carregar, e um redirect ali viraria endereço trocado toda vez que a ficha demora.
14. **Clicar no item de menu da tela em que já se está limpa os filtros, e isso cria uma parada no voltar.** O item do menu é um `AppLink` para o endereço limpo da tela (`SidebarItem`/`SidebarSubItem` com `menuHref`, `App.jsx:1520-1561`), e o `Link` do React Router empilha. Então de `/<academia>/pipeline?funil=f2` o clique em Pipeline vai para `/<academia>/pipeline` e o voltar devolve o quadro filtrado; de `/<academia>/configuracoes/catalogos` o clique em Configurações vai para `/<academia>/configuracoes` e o voltar devolve Catálogos. É o mesmo comportamento nas duas, é o que já acontece hoje em toda troca de tela, e não conflita com a decisão 3 do Johnny, que é sobre TROCAR FILTRO. O `changeTab` (`App.jsx:1312-1316`) não é o caminho do menu: ele serve só ao interruptor do grupo do super-admin e ao "Ir para o pipeline" do Gerencial, e fica como está.
15. **A armadilha antiga da memória de rolagem não é deste PR.** `scrollActionFor` devolve `'none'` quando a `screenKey` não muda e o ramo final grava por cima (`useRouteScroll.js:111`), o que apaga a posição no POP de um push para a mesma tela. Isso já é alcançável hoje pelo item Operacional do menu vindo de `/visao-geral/operacional`, e não é criado aqui porque filtro usa replace: o replace nasce com chave nova e grava a posição de agora, sem tocar na chave anterior. Fica registrado na T9 como dívida conhecida.
16. **O endereço NÃO é reescrito na entrada.** O spec diz que valor inválido "é corrigido com replace"; aqui ele é só ignorado na leitura, e some do endereço na primeira escolha de filtro que a pessoa fizer. Um link com `?mes=2099-01`, `?funil=apagado` ou `?pessoa=<quem saiu>` abre a tela funcionando no padrão, com o valor ruim ainda visível na barra até o primeiro clique. Corrigir na entrada exigiria um effect lendo a URL para navegar, que é exatamente o padrão que esta entrega existe para tirar do app e que o lint reprova, e criaria replace em laço enquanto o dado de saneamento ainda está carregando (decisão 17). A T9 acerta a frase do spec.
17. **O saneamento depende de dado que chega depois, e isso tem consequência visível.** `usersList` começa vazia e só fica completa no `getDocs` (`App.jsx:302` e `845-848`); funis, etapas e contratos vêm de assinatura. No primeiro render, um link com `?pessoa=<colega>`, `?funil=f2`, `?fase=s1` ou `?comparar-com=` lê como padrão e só acerta quando o dado chega, o que nos dashboards aparece como uma piscada. E se a pessoa clicar em qualquer filtro dentro dessa janela, a montagem descarta o parâmetro que ainda não pôde ser validado e ele some do endereço de vez. Fica registrado, entra nos riscos do spec na T9 e vira item da conferência manual.

## Mapa de arquivos

| Arquivo | O que faz | Ação | Tarefa |
|---|---|---|---|
| `src/lib/routes.js` | `subs` em `SCREENS`, `sub`/`subUnknown` no parse, `sub` em `hrefFor` e no `target`, sub desconhecida indo para a tela-mãe; comentário do `backTarget` na T8 | Modificar | T1, T8 |
| `src/lib/appShell.js` | `screenState` devolve `sub` | Modificar | T1 |
| `src/lib/__tests__/routes.test.js` | Sub-tela no parse e no `hrefFor`; as duas medições do `idx` contra o react-router instalado na T8 | Modificar | T1, T8 |
| `src/lib/__tests__/routes.decision.test.js` | `sub` no `target`, sub desconhecida, `screenKey` e `routeTemplate` sem a sub-tela, query nos redirects | Modificar | T1 |
| `src/lib/__tests__/appShell.test.js` | `sub` no `screenState` | Modificar | T1 |
| `src/lib/screenParams.js` | Tabela de parâmetros por tela, leitura e montagem | Criar | T2 |
| `src/lib/__tests__/screenParams.test.js` | O módulo puro, tela por tela | Criar | T2 |
| `src/hooks/useScreenParams.js` | Deriva os valores no render e navega com replace | Criar | T2 |
| `src/views/dashboard/DashboardOperacionalView.jsx` | Mês, comparativo e pessoa vindos do endereço | Modificar | T3 |
| `src/views/dashboard/DashboardCrmView.jsx` | Mês, comparativo, pessoa e funil vindos do endereço | Modificar | T3 |
| `src/views/dashboard/DashboardGerencialView.jsx` | Mês e comparativo vindos do endereço | Modificar | T3 |
| `src/views/KanbanView.jsx` | Funil, responsável e atraso vindos do endereço | Modificar | T4 |
| `src/views/ClientsView.jsx` | Situação e responsável vindos do endereço | Modificar | T4 |
| `src/views/LeadsView.jsx` | Funil, fase, responsável, atraso e quente vindos do endereço | Modificar | T5 |
| `src/views/DailyGoalView.jsx` | Categoria vinda do endereço | Modificar | T5 |
| `src/views/AppointmentTrackingView.jsx` | Dia, período, responsável e professor vindos do endereço | Modificar | T6 |
| `src/views/settings/SettingsView.jsx` | Seção vinda do caminho, por prop | Modificar | T7 |
| `src/views/LeadProfileView.jsx` | Aba vinda do caminho, por prop | Modificar | T7 |
| `src/views/LeadProfileRoute.jsx` | Repassa a aba da ficha | Modificar | T7 |
| `src/App.jsx` | Passa `sub` e os filtros às telas | Modificar | T3 a T7 |
| `src/lib/__tests__/sentryScrub.test.js` | A query de filtro é cortada antes de ir ao Sentry | Modificar | T9 |
| `src/lib/__tests__/filtrosNoEndereco.sweep.test.js` | Varredura: nenhuma tela guarda filtro em estado nem lê a URL | Criar | T9 |
| `CLAUDE.md` | Regras dos filtros no endereço | Modificar | T9 |
| `docs/superpowers/specs/2026-09-23-filtros-no-endereco-design.md` | Spec em dia com o que foi construído | Modificar | T9 |

## Tarefas e contagem de testes

A contagem é cumulativa: o número da última coluna é o que `npx vitest run` mostra no fim da tarefa. As linhas da T1 à T7 são a estimativa da montagem; o medido no fim da T8 é 108 arquivos e 2221 testes, porque a T7 acabou criando `settingsRail.test.js`, que a estimativa não previa. As linhas da T8 e da T9 já saem do medido.

| Tarefa | O que entrega | Depende de | Testes novos | Arquivos de teste novos | Suíte no fim |
|---|---|---|---|---|---|
| base | branch `claude/rotas-e2-filtros` em `fda9f27` | | | | 106 arquivos, 2118 testes |
| T1 | Sub-tela no endereço (routes e appShell) | | 18 | 0 | 106, 2136 |
| T2 | `screenParams.js` e o hook | | 36 | 1 | 107, 2172 |
| T3 | Os três dashboards | T2 | 9 | 0 | 107, 2181 |
| T4 | Pipeline e Clientes | T2 | 8 | 0 | 107, 2189 |
| T5 | Todos os leads e Meta diária | T2 | 9 | 0 | 107, 2198 |
| T6 | Aulas e Visitas | T2 | 10 | 0 | 107, 2208 |
| T7 | Configurações por seção e ficha por aba | T1 | 8 | 0 | 107, 2216 |
| T8 | Por que o Voltar da ficha não leva o filtro (só comentário, teste e spec) | | 1 | 0 | 108, 2221 (medido) |
| T9 | Varredura, documentação, verificação final e corpo do PR | T1 a T8 | 9 | 1 | 109, 2230 |
| **Total** | | | **112** | **3** | **109 arquivos, 2230 testes** |

T1 e T2 são independentes. T3 a T6 dependem só da T2 e são independentes entre si (arquivos diferentes). T7 depende da T1. A T8 não depende de tarefa nenhuma: sobrou nela só comentário, teste e spec, sem código de feature. T9 é a última.

---

### Task 1: sub-tela no endereço, no molde da subaba do super-admin

**Files:**
- Modify: `src/lib/routes.js` (tabela `SCREENS` nas linhas 28-44; `readScreen` nas linhas 104-139; `parseAppPath` na linha 149; `hrefFor` nas linhas 181-196; `redirectTo` nas linhas 230-233; `accessRedirect` nas linhas 238-244; `routeDecision` nas linhas 288-304)
- Modify: `src/lib/appShell.js` (`screenState`, linhas 28-40)
- Test: `src/lib/__tests__/routes.test.js` (modificar)
- Test: `src/lib/__tests__/routes.decision.test.js` (modificar)
- Test: `src/lib/__tests__/appShell.test.js` (modificar)

As Configurações e a ficha ganham sub-tela no caminho. O super-admin já faz isso hoje e é o molde: tabela de segmentos, leitura no parse, montagem no `hrefFor`, derivação sem estado no `screenState`, e `screenKey` deliberadamente cego para ela.

Três coisas precisam ficar valendo, e as três viram teste:

- `screenKey` continua devolvendo `settings` e `ficha:<id>` com ou sem sub-tela, senão trocar de seção remonta o `AppErrorBoundary` e refaz o `getDocs` da coleção inteira de leads das Configurações.
- `routeTemplate` continua cortando a sub-tela fora, então nada muda no Sentry.
- `redirectTo` passa a levar o `sub` no `target`, senão a correção de academia desenha a seção padrão por um render antes de saltar para a certa.

A Meta diária NÃO ganha sub-tela: a visão Equipe ficou fora desta entrega (decisão 6 do Johnny).

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/__tests__/routes.test.js`, primeiro trocar a asserção exata da raiz (linhas 75-77), que compara o retorno inteiro de `parseAppPath` e quebra assim que o objeto ganha dois campos:

Antes:

```js
      expect(parseAppPath(p)).toEqual({
        pathname: p, tenantSlug: null, screen: null, leadId: null, superTab: null, rest: [], unknown: false,
      });
```

Depois:

```js
      expect(parseAppPath(p)).toEqual({
        pathname: p, tenantSlug: null, screen: null, leadId: null, superTab: null, rest: [], unknown: false,
        sub: null, subUnknown: false,
      });
```

Depois, acrescentar ao fim do mesmo arquivo:

```js
describe('sub-tela no caminho', () => {
  it('Configurações lê as dez seções e devolve o id interno', () => {
    const pares = [
      ['visao-geral', 'overview'], ['equipe', 'team'], ['transferencia', 'transfer'],
      ['indicacoes', 'referral-owners'], ['importacao', 'import'], ['ritmo', 'pace'],
      ['agenda', 'sched'], ['funis', 'funnels'], ['catalogos', 'catalogs'], ['stronizap', 'zap'],
    ];
    for (const [seg, id] of pares) {
      const r = parseAppPath(`/${T}/configuracoes/${seg}`);
      expect([r.screen, r.sub, r.subUnknown], seg).toEqual(['settings', id, false]);
    }
  });

  it('a ficha lê as quatro abas', () => {
    const pares = [['linha-do-tempo', 'timeline'], ['crm', 'crm'], ['contratos', 'contratos'], ['indicacoes', 'referrals']];
    for (const [seg, id] of pares) {
      const r = parseAppPath(`/${T}/ficha/AbC/${seg}`);
      expect([r.screen, r.leadId, r.sub], seg).toEqual(['ficha', 'AbC', id]);
    }
  });

  it('sem sub-tela no endereço, sub é null e subUnknown é false', () => {
    for (const p of [`/${T}/configuracoes`, `/${T}/ficha/AbC`]) {
      const r = parseAppPath(p);
      expect([r.sub, r.subUnknown], p).toEqual([null, false]);
    }
  });

  it('segmento de sub-tela ignora caixa, como o de tela', () => {
    expect(parseAppPath(`/${T}/configuracoes/EQUIPE`).sub).toBe('team');
    expect(parseAppPath(`/${T}/ficha/AbC/Contratos`).sub).toBe('contratos');
  });

  it('sub-tela desconhecida e segmento a mais marcam subUnknown, sem virar endereço desconhecido', () => {
    for (const p of [`/${T}/configuracoes/xyz`, `/${T}/configuracoes/equipe/demais`, `/${T}/ficha/AbC/xyz`, `/${T}/ficha/AbC/crm/demais`]) {
      const r = parseAppPath(p);
      expect([r.sub, r.subUnknown, r.unknown], p).toEqual([null, true, false]);
    }
  });

  it('tela sem tabela de sub-tela continua ignorando o resto calado', () => {
    const r = parseAppPath(`/${T}/pipeline/a/b`);
    expect([r.screen, r.rest, r.sub, r.subUnknown, r.unknown]).toEqual(['kanban', ['a', 'b'], null, false, false]);
  });

  it('o rest cru continua como era, para o id da ficha nunca ser reescrito', () => {
    expect(parseAppPath(`/${T}/configuracoes/equipe`).rest).toEqual(['equipe']);
    expect(parseAppPath(`/${T}/ficha/AbC/contratos`).rest).toEqual(['contratos']);
  });

  it('hrefFor monta a sub-tela e cai na tela-mãe quando o valor não existe', () => {
    expect(hrefFor(T, 'settings', { sub: 'catalogs' })).toBe(`/${T}/configuracoes/catalogos`);
    expect(hrefFor(T, 'settings', { sub: 'team' })).toBe(`/${T}/configuracoes/equipe`);
    expect(hrefFor(T, 'settings')).toBe(`/${T}/configuracoes`);
    expect(hrefFor(T, 'settings', { sub: 'xyz' })).toBe(`/${T}/configuracoes`);
    expect(hrefFor(T, 'ficha', { leadId: 'AbC', sub: 'contratos' })).toBe(`/${T}/ficha/AbC/contratos`);
    expect(hrefFor(T, 'ficha', { leadId: 'AbC', sub: 'xyz' })).toBe(`/${T}/ficha/AbC`);
    expect(hrefFor(T, 'kanban', { sub: 'equipe' })).toBe(`/${T}/pipeline`);
  });

  it('ida e volta: todo segmento montado relê como o mesmo id', () => {
    for (const id of Object.keys(SCREENS.settings.subs)) {
      expect(parseAppPath(hrefFor(T, 'settings', { sub: id })).sub, id).toBe(id);
    }
    for (const id of Object.keys(SCREENS.ficha.subs)) {
      expect(parseAppPath(hrefFor(T, 'ficha', { leadId: 'AbC', sub: id })).sub, id).toBe(id);
    }
  });

  it('a tabela de sub-telas é congelada e o padrão de cada uma existe nela', () => {
    for (const id of ['settings', 'ficha']) {
      expect(Object.isFrozen(SCREENS[id].subs), id).toBe(true);
      expect(Object.keys(SCREENS[id].subs), id).toContain(SCREENS[id].subPadrao);
    }
  });

  it('nenhuma outra tela tem sub-tela nesta entrega', () => {
    const comSub = Object.keys(SCREENS).filter((id) => SCREENS[id].subs);
    expect(comSub.sort()).toEqual(['ficha', 'settings']);
  });
});
```

Em `src/lib/__tests__/routes.decision.test.js`, trocar o helper `casa` e acrescentar um bloco:

```js
const casa = (to, target, notice = null) => ({ kind: 'redirect', to, target: { leadId: null, superTab: null, sub: null, ...target }, notice });
```

```js
describe('sub-tela na decisão de rota', () => {
  it('a correção de academia leva a sub-tela no destino e no alvo desenhado', () => {
    expect(decide(`/outra/configuracoes/catalogos`, admin)).toEqual(
      casa(`/${T}/configuracoes/catalogos`, { screen: 'settings', sub: 'catalogs' }),
    );
    expect(decide('/configuracoes/equipe', admin)).toEqual(
      casa(`/${T}/configuracoes/equipe`, { screen: 'settings', sub: 'team' }),
    );
  });

  it('sub-tela desconhecida abre a tela-mãe, com a query e sem aviso', () => {
    expect(decide(`/${T}/configuracoes/xyz`, admin, { search: '?sit=ativo' })).toEqual(
      casa(`/${T}/configuracoes?sit=ativo`, { screen: 'settings' }),
    );
    expect(decide(`/${T}/ficha/AbC/xyz`, consultor)).toEqual(
      casa(`/${T}/ficha/AbC`, { screen: 'ficha', leadId: 'AbC' }),
    );
  });

  it('a trava de tela ganha da sub-tela: consultor em Configurações continua caindo no Operacional com aviso', () => {
    expect(decide(`/${T}/configuracoes/xyz`, consultor)).toEqual(casa(`/${T}`, { screen: 'dashboard' }, 'so-gestor'));
  });

  it('endereço com sub-tela conhecida é aceito de primeira', () => {
    expect(decide(`/${T}/configuracoes/funis`, admin)).toEqual({ kind: 'ok' });
    expect(decide(`/${T}/ficha/AbC/contratos`, consultor)).toEqual({ kind: 'ok' });
  });

  it('a sub-tela não entra na screenKey, senão trocar de seção remontaria a tela', () => {
    expect(screenKey(parseAppPath(`/${T}/configuracoes/catalogos`))).toBe('settings');
    expect(screenKey(parseAppPath(`/${T}/ficha/AbC/contratos`))).toBe('ficha:AbC');
  });

  it('a sub-tela continua fora do molde do Sentry', () => {
    expect(routeTemplate(`/${T}/configuracoes/catalogos`)).toBe('/:tenant/configuracoes');
    expect(routeTemplate(`/${T}/ficha/AbC/contratos`)).toBe('/:tenant/ficha/:leadId');
  });
});
```

Em `src/lib/__tests__/appShell.test.js`, trocar a asserção exata da linha 20 e acrescentar um caso:

```js
    expect(s).toEqual({ fichaOpen: false, profileLeadId: null, activeTab: 'kanban', resolvedTab: 'kanban', superTab: 'overview', sub: null });
```

```js
  it('a sub-tela sai do endereço e cai no padrão da tela quando não vem', () => {
    expect(screenState(parseAppPath(`/${T}/configuracoes/catalogos`), null, gestor).sub).toBe('catalogs');
    expect(screenState(parseAppPath(`/${T}/configuracoes`), null, gestor).sub).toBe('team');
    expect(screenState(parseAppPath(`/${T}/ficha/AbC/contratos`), null, consultor).sub).toBe('contratos');
    expect(screenState(parseAppPath(`/${T}/ficha/AbC`), null, consultor).sub).toBe('timeline');
    expect(screenState(parseAppPath(`/${T}/pipeline`), null, consultor).sub).toBeNull();
  });
```

Rodar e ver a cor vermelha:

```bash
npx vitest run src/lib/__tests__/routes.test.js src/lib/__tests__/routes.decision.test.js src/lib/__tests__/appShell.test.js
# Esperado: falhas em routes.test.js (SCREENS.settings.subs indefinido, e a
# asserção da raiz agora pedindo sub e subUnknown que o parse ainda não devolve),
# routes.decision.test.js (target sem sub) e appShell.test.js (screenState sem sub).
```

- [ ] **Step 2: A tabela de sub-telas em `SCREENS`**

Antes (`src/lib/routes.js:24-48`):

```js
const tela = (segs, title, trava = {}) => Object.freeze({ segs: Object.freeze(segs), title, ...trava });

// id da tela (os mesmos valores de activeTab de sempre) para os segmentos
// depois da academia, o título da aba e a trava de acesso.
export const SCREENS = Object.freeze({
  dashboard: tela([], 'Visão geral'),
```

Depois:

```js
const tela = (segs, title, trava = {}) => Object.freeze({ segs: Object.freeze(segs), title, ...trava });

// Sub-telas: id interno para o segmento em português. Molde da subaba do
// super-admin (SUPER_TABS, abaixo). Elas NÃO entram na screenKey nem no molde
// do Sentry: trocar de seção ou de aba não pode remontar a tela.
export const SETTINGS_SECTIONS = Object.freeze({
  overview: 'visao-geral',
  team: 'equipe',
  transfer: 'transferencia',
  'referral-owners': 'indicacoes',
  import: 'importacao',
  pace: 'ritmo',
  sched: 'agenda',
  funnels: 'funis',
  catalogs: 'catalogos',
  zap: 'stronizap',
});
export const FICHA_TABS = Object.freeze({
  timeline: 'linha-do-tempo',
  crm: 'crm',
  contratos: 'contratos',
  referrals: 'indicacoes',
});

// id da tela (os mesmos valores de activeTab de sempre) para os segmentos
// depois da academia, o título da aba, a trava de acesso e, onde existe, a
// tabela de sub-telas com o padrão de quem abre sem sub-tela no endereço.
export const SCREENS = Object.freeze({
  dashboard: tela([], 'Visão geral'),
```

Na mesma tabela, trocar as duas linhas que ganham sub-tela.

Antes:

```js
  settings: tela(['configuracoes'], 'Configurações', { gestor: true }),
```

Depois:

```js
  settings: tela(['configuracoes'], 'Configurações', { gestor: true, subs: SETTINGS_SECTIONS, subPadrao: 'team' }),
```

Antes:

```js
  ficha: tela(['ficha'], 'Ficha'),
```

Depois:

```js
  ficha: tela(['ficha'], 'Ficha', { subs: FICHA_TABS, subPadrao: 'timeline' }),
```

Logo depois da linha do `SUPER_TAB_BY_SEGMENT`, o índice inverso das sub-telas:

Antes (`src/lib/routes.js:47-48`):

```js
export const SUPER_TABS = Object.freeze({ overview: 'visao-geral', clients: 'clientes', finance: 'financeiro', plans: 'planos' });
const SUPER_TAB_BY_SEGMENT = Object.fromEntries(Object.entries(SUPER_TABS).map(([id, seg]) => [seg, id]));
```

Depois:

```js
export const SUPER_TABS = Object.freeze({ overview: 'visao-geral', clients: 'clientes', finance: 'financeiro', plans: 'planos' });
const SUPER_TAB_BY_SEGMENT = Object.fromEntries(Object.entries(SUPER_TABS).map(([id, seg]) => [seg, id]));

// Índice inverso das sub-telas, por tela: segmento em português para id interno.
const SUB_BY_SEGMENT = Object.fromEntries(
  Object.entries(SCREENS)
    .filter(([, def]) => def.subs)
    .map(([id, def]) => [id, Object.fromEntries(Object.entries(def.subs).map(([sub, seg]) => [seg, sub]))]),
);

// Lê o segmento de sub-tela de uma tela que tem tabela. Devolve o id interno,
// ou marca subUnknown quando o segmento não existe ou vem segmento a mais.
// Tela sem tabela continua ignorando o resto calado, como sempre ignorou.
function readSub(screen, extras, out) {
  if (!own(SUB_BY_SEGMENT, screen) || extras.length === 0) return;
  const seg = lower(extras[0]);
  const sub = extras.length === 1 && own(SUB_BY_SEGMENT[screen], seg) ? SUB_BY_SEGMENT[screen][seg] : null;
  if (sub) out.sub = sub;
  else out.subUnknown = true;
}
```

- [ ] **Step 3: O parse devolve `sub` e `subUnknown`**

Antes (`src/lib/routes.js:104-111`, dentro de `readScreen`):

```js
function readScreen(segs, out) {
  const head = lower(segs[0]);
  if (head === 'ficha') {
    out.screen = 'ficha';
    out.leadId = isValidLeadId(segs[1]) ? segs[1] : null;
    out.rest = segs.slice(2);
    return;
  }
```

Depois:

```js
function readScreen(segs, out) {
  const head = lower(segs[0]);
  if (head === 'ficha') {
    out.screen = 'ficha';
    out.leadId = isValidLeadId(segs[1]) ? segs[1] : null;
    out.rest = segs.slice(2);
    readSub('ficha', out.rest, out);
    return;
  }
```

Antes (`src/lib/routes.js:133-138`):

```js
  if (own(LEAVES, head)) {
    out.screen = LEAVES[head];
    out.rest = segs.slice(1);
    return;
  }
  out.unknown = true;
```

Depois:

```js
  if (own(LEAVES, head)) {
    out.screen = LEAVES[head];
    out.rest = segs.slice(1);
    readSub(out.screen, out.rest, out);
    return;
  }
  out.unknown = true;
```

Antes (`src/lib/routes.js:149-153`, dentro de `parseAppPath`):

```js
  const out = {
    pathname: typeof pathname === 'string' ? pathname : '',
    tenantSlug: null, screen: null, leadId: null, superTab: null, rest: [], unknown: false,
  };
```

Depois:

```js
  const out = {
    pathname: typeof pathname === 'string' ? pathname : '',
    tenantSlug: null, screen: null, leadId: null, superTab: null, rest: [], unknown: false,
    // Sub-tela: id interno quando o segmento existe na tabela da tela, e
    // subUnknown quando veio segmento que ela não conhece.
    sub: null, subUnknown: false,
  };
```

Acrescentar o comentário do contrato logo acima de `parseAppPath`, junto dos que já estão lá:

```js
// - sub: a seção das Configurações ou a aba da ficha, quando o endereço traz
//   um segmento a mais que a tabela da tela conhece. Segmento desconhecido não
//   é endereço desconhecido: vira subUnknown e a decisão de rota abre a
//   tela-mãe com replace, sem aviso.
```

- [ ] **Step 4: `hrefFor` monta a sub-tela**

Antes (`src/lib/routes.js:181-196`):

```js
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
```

Depois:

```js
export function hrefFor(tenantId, screen, opts = {}) {
  const { leadId, superTab, sub } = opts || {};
  if (typeof tenantId !== 'string' || tenantId === '') return null;
  const t = encode(tenantId);
  if (t === null) return null;
  const base = `/${t}`;
  if (!own(SCREENS, screen) || screen === HOME_SCREEN || screen === 'dashOperacional') return base;
  // Sub-tela fora da tabela some do endereço e a tela abre no padrão dela, do
  // mesmo jeito que a subaba do super-admin cai em visao-geral.
  const subs = SCREENS[screen].subs;
  const trecho = subs && own(subs, sub) ? `/${subs[sub]}` : '';
  if (screen === 'ficha') {
    const id = isValidLeadId(leadId) ? encode(leadId) : null;
    return id === null ? null : `${base}/ficha/${id}${trecho}`;
  }
  if (screen === 'superadmin') {
    return `${base}/super-admin/${own(SUPER_TABS, superTab) ? SUPER_TABS[superTab] : SUPER_TABS.overview}`;
  }
  return `${base}/${SCREENS[screen].segs.join('/')}${trecho}`;
}
```

- [ ] **Step 5: o `sub` no alvo do redirect e a sub-tela desconhecida indo para a tela-mãe**

Antes (`src/lib/routes.js:230-233`):

```js
function redirectTo(path, { search = '', notice = null } = {}) {
  const r = parseAppPath(path);
  return { kind: 'redirect', to: path + search, target: { screen: r.screen, leadId: r.leadId, superTab: r.superTab }, notice };
}
```

Depois:

```js
function redirectTo(path, { search = '', notice = null } = {}) {
  const r = parseAppPath(path);
  // O `sub` vai no alvo junto com a tela: sem ele, a correção de academia
  // desenharia a seção padrão por um render antes de saltar para a certa.
  return { kind: 'redirect', to: path + search, target: { screen: r.screen, leadId: r.leadId, superTab: r.superTab, sub: r.sub }, notice };
}
```

Antes (`src/lib/routes.js:238-244`):

```js
// Regras 6 e 7, sobre um endereço que já é da academia da sessão.
function accessRedirect(route, appUser, home) {
  if (route.screen && !canAccess(route.screen, appUser)) {
    return redirectTo(home, { notice: SCREENS[route.screen].gestor ? 'so-gestor' : null });
  }
  if (route.unknown) return redirectTo(home, { notice: 'nao-encontrada' });
  return null;
}
```

Depois:

```js
// Regras 6, 7 e 8, sobre um endereço que já é da academia da sessão. A trava de
// tela vem antes da sub-tela: quem não pode ver a tela vai para a inicial com
// aviso, e não para a tela-mãe de uma seção que ele não abriria.
function accessRedirect(route, appUser, home, { tenantId = null, search = '' } = {}) {
  if (route.screen && !canAccess(route.screen, appUser)) {
    return redirectTo(home, { notice: SCREENS[route.screen].gestor ? 'so-gestor' : null });
  }
  if (route.unknown) return redirectTo(home, { notice: 'nao-encontrada' });
  // Regra 8: sub-tela desconhecida abre a tela-mãe, com replace e sem aviso.
  // Erro de digitação na seção não pode punir com perda de contexto, e o aviso
  // de "não achamos essa tela" continua só para endereço de tela.
  if (route.subUnknown) {
    const mae = hrefFor(tenantId, route.screen, { leadId: route.leadId });
    if (mae) return redirectTo(mae, { search });
  }
  return null;
}
```

Antes (`src/lib/routes.js:301-303`, as três últimas linhas de `routeDecision`):

```js
  const fixed = sessionPathFor(route, tenantId, home);
  if (fixed !== null) return accessRedirect(parseAppPath(fixed), appUser, home) ?? redirectTo(fixed, { search });
  return accessRedirect(route, appUser, home) ?? OK;
```

Depois:

```js
  const fixed = sessionPathFor(route, tenantId, home);
  const extra = { tenantId, search };
  if (fixed !== null) return accessRedirect(parseAppPath(fixed), appUser, home, extra) ?? redirectTo(fixed, { search });
  return accessRedirect(route, appUser, home, extra) ?? OK;
```

No comentário numerado logo acima de `routeDecision`, acrescentar a regra 8 depois da 7:

```js
// 8. sub-tela desconhecida: a tela-mãe, sem aviso.
```

- [ ] **Step 6: `screenState` devolve o `sub`**

Antes (`src/lib/appShell.js:28-40`):

```js
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
```

Depois:

```js
export function screenState(shown, locationState, appUser) {
  const fichaOpen = shown?.screen === 'ficha';
  const activeTab = fichaOpen
    ? (fichaOrigin(locationState, appUser) ?? 'ficha')
    : (shown?.screen ?? HOME_SCREEN);
  // Sub-tela da tela mostrada (seção das Configurações, aba da ficha). Sem
  // segmento no endereço vale o padrão da tabela, e tela sem sub-tela devolve
  // null. Sai do `shown`, igual ao resto, então não existe estado espelhado.
  // O `isScreenId` da linha 9 é o mesmo guarda do `fichaOrigin`: indexar
  // SCREENS direto devolveria o construtor herdado do Object para um
  // `screen: 'constructor'` que viesse do alvo de um redirect.
  const def = isScreenId(shown?.screen) ? SCREENS[shown.screen] : null;
  return {
    fichaOpen,
    profileLeadId: fichaOpen ? (shown.leadId ?? null) : null,
    activeTab,
    resolvedTab: activeTab === HOME_SCREEN ? 'dashOperacional' : activeTab,
    superTab: shown?.superTab ?? 'overview',
    sub: def?.subs ? (shown.sub ?? def.subPadrao) : null,
  };
}
```

O import da primeira linha do arquivo já traz `SCREENS`, e `isScreenId` já é declarado na linha 9, então nada muda ali.

- [ ] **Step 7: Verificar e commitar**

```bash
npx vitest run
# Esperado: Test Files  106 passed (106) · Tests  2136 passed (2136)
npm run lint
# Esperado: ✖ 1 problem (0 errors, 1 warning)
git add -A && git commit -m "$(cat <<'MSGEOF'
feat: seção das Configurações e aba da ficha no caminho do endereço

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSGEOF
)"
```

---

### Task 2: `screenParams.js`, o módulo puro, e o hook que liga às telas

**Files:**
- Create: `src/lib/screenParams.js`
- Create: `src/lib/__tests__/screenParams.test.js`
- Create: `src/hooks/useScreenParams.js`

O módulo é a tradução inteira entre a query e os valores da tela, e é puro: sem React, sem Firebase, sem `window`. Ele conhece a tabela de parâmetros de cada tela, lê (`readScreenParams`) e monta (`screenParamsQuery`). O que o saneamento precisa saber e só a tela tem (lista de usuários, funis, etapas, meses comparáveis, se a pessoa vê o controle) chega num `ctx`, que a tela monta com `useMemo` e passa no render.

O hook é fino de propósito: deriva no render, navega com replace e repassa o `state`. Ele NÃO usa `useSearchParams` (medido: apaga o `state`, não é estável, a forma funcional lê o closure e o padrão dele é push).

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/__tests__/screenParams.test.js`:

```js
// Filtro de cada tela no endereço: leitura, montagem, ida e volta, e o
// saneamento contra o que só a tela sabe. Tudo puro, tudo em node.
import { describe, it, expect } from 'vitest';
import {
  readScreenParams, screenParamsQuery, funnelFromSearch, SCREEN_PARAM_NAMES, FASE_VENDA, FASE_PERDA,
} from '../screenParams.js';
import { CONTRACT_STATUS } from '../contracts.js';
import { SOLO_TRAINING } from '../professores.js';

const users = [{ id: 'u1', name: 'Ana' }, { id: 'u2', name: 'Bruno' }];
const funis = [{ id: 'f1', name: 'Comercial' }, { id: 'f2', name: 'Vencidos' }];
const etapas = [{ id: 's1', name: 'Novo' }, { id: 's2', name: 'Em negociação' }];
const situacoes = [CONTRACT_STATUS.ATIVO, CONTRACT_STATUS.A_VENCER, 'sem_contrato'];
const HOJE = '2026-09';

const dash = { currentKey: HOJE, users };
const ler = (tela, q, ctx) => readScreenParams(tela, q, ctx);
const montar = (tela, v, ctx) => screenParamsQuery(tela, v, ctx);
// Ida e volta: montar o que foi lido devolve a mesma query normalizada.
const volta = (tela, q, ctx) => montar(tela, ler(tela, q, ctx), ctx);

describe('tabela de parâmetros', () => {
  it('cada tela tem os nomes do spec, e nenhum deles é invite, t ou ref', () => {
    expect(SCREEN_PARAM_NAMES.dashOperacional).toEqual(['mes', 'comparar', 'comparar-com', 'pessoa']);
    expect(SCREEN_PARAM_NAMES.dashCrm).toEqual(['mes', 'comparar', 'comparar-com', 'pessoa', 'funil']);
    expect(SCREEN_PARAM_NAMES.dashGerencial).toEqual(['mes', 'comparar', 'comparar-com']);
    expect(SCREEN_PARAM_NAMES.kanban).toEqual(['funil', 'resp', 'atraso']);
    expect(SCREEN_PARAM_NAMES.clientes).toEqual(['sit', 'resp']);
    expect(SCREEN_PARAM_NAMES.leads).toEqual(['funil', 'fase', 'resp', 'atraso', 'quente']);
    expect(SCREEN_PARAM_NAMES.aulas).toEqual(['dia', 'de', 'ate', 'resp', 'prof']);
    expect(SCREEN_PARAM_NAMES.visitas).toEqual(['dia', 'de', 'ate', 'resp']);
    expect(SCREEN_PARAM_NAMES.dailyGoal).toEqual(['cat']);
    const proibidos = ['invite', 't', 'ref'];
    for (const nomes of Object.values(SCREEN_PARAM_NAMES)) {
      for (const n of nomes) expect(proibidos, n).not.toContain(n);
    }
  });

  it('o endereço curto da academia lê a mesma tabela do Operacional', () => {
    expect(SCREEN_PARAM_NAMES.dashboard).toEqual(SCREEN_PARAM_NAMES.dashOperacional);
    expect(ler('dashboard', '?mes=2026-08', dash).monthKey).toBe('2026-08');
  });

  it('tela sem filtro devolve objeto vazio e query vazia', () => {
    for (const tela of ['settings', 'ficha', 'superadmin', 'xyz']) {
      expect(ler(tela, '?mes=2026-08', dash), tela).toEqual({});
      expect(montar(tela, { monthKey: '2026-08' }, dash), tela).toBe('');
    }
  });

  it('endereço limpo devolve o padrão de cada tela', () => {
    expect(ler('dashOperacional', '', dash)).toEqual({ monthKey: HOJE, compareOn: true, compareKey: null, person: 'all' });
    expect(ler('clientes', '', { users, situacoes, podeResp: true, respPadrao: [] })).toEqual({ status: [], resp: [] });
    expect(ler('dailyGoal', '', {})).toEqual({ cat: 'all' });
  });

  it('o padrão nunca é escrito no endereço', () => {
    expect(montar('dashOperacional', ler('dashOperacional', '', dash), dash)).toBe('');
    expect(montar('clientes', ler('clientes', '', { users, situacoes, podeResp: true, respPadrao: [] }), { users, situacoes, podeResp: true, respPadrao: [] })).toBe('');
    expect(montar('dailyGoal', { cat: 'all' }, {})).toBe('');
  });
});

describe('mês, comparativo e pessoa', () => {
  it('mês dentro da janela de 12 meses vale, e fora dela cai no mês de hoje', () => {
    expect(ler('dashOperacional', '?mes=2026-08', dash).monthKey).toBe('2026-08');
    expect(ler('dashOperacional', '?mes=2025-10', dash).monthKey).toBe('2025-10');
    for (const m of ['2025-09', '2026-10', '2023-05', 'banana', '2026-13', '']) {
      expect(ler('dashOperacional', `?mes=${m}`, dash).monthKey, m).toBe(HOJE);
    }
  });

  it('comparar só é escrito desligado, e qualquer outro valor liga', () => {
    expect(ler('dashOperacional', '?comparar=0', dash).compareOn).toBe(false);
    for (const v of ['1', 'sim', '']) expect(ler('dashOperacional', `?comparar=${v}`, dash).compareOn, v).toBe(true);
    expect(montar('dashOperacional', { ...ler('dashOperacional', '', dash), compareOn: false }, dash)).toBe('?comparar=0');
  });

  it('comparar-com aceita mês comparável e ignora o resto', () => {
    const ctx = { ...dash };
    expect(ler('dashOperacional', '?comparar-com=2026-07', ctx).compareKey).toBe('2026-07');
    for (const m of ['2026-09', '2026-11', 'banana']) {
      expect(ler('dashOperacional', `?comparar-com=${m}`, ctx).compareKey, m).toBeNull();
    }
  });

  it('comparar-com do Gerencial passa pela peneira dos meses com venda', () => {
    const ctx = { currentKey: HOJE, mesesComparaveis: () => ['2026-07', '2026-05'] };
    expect(ler('dashGerencial', '?comparar-com=2026-07', ctx).compareKey).toBe('2026-07');
    expect(ler('dashGerencial', '?comparar-com=2026-05', ctx).compareKey).toBe('2026-05');
    expect(ler('dashGerencial', '?comparar-com=2026-08', ctx).compareKey).toBeNull();
    expect(volta('dashGerencial', '?comparar-com=2026-08', ctx)).toBe('');
  });

  it('o mês da comparação que já é o padrão da tela não é escrito', () => {
    // O padrão é sempre o primeiro da lista de comparáveis: o mês anterior no
    // Operacional e no CRM, o mês anterior COM VENDA no Gerencial. Escolher na
    // barra justamente a opção que já estava marcada não pode sujar o endereço.
    const v = ler('dashOperacional', '?mes=2026-08', dash);
    expect(montar('dashOperacional', { ...v, compareKey: '2026-07' }, dash)).toBe('?mes=2026-08');
    expect(montar('dashOperacional', { ...v, compareKey: '2026-06' }, dash)).toBe('?mes=2026-08&comparar-com=2026-06');
    const ger = { currentKey: HOJE, mesesComparaveis: () => ['2026-07', '2026-05'] };
    expect(montar('dashGerencial', { monthKey: HOJE, compareOn: true, compareKey: '2026-07' }, ger)).toBe('');
    expect(montar('dashGerencial', { monthKey: HOJE, compareOn: true, compareKey: '2026-05' }, ger)).toBe('?comparar-com=2026-05');
  });

  it('comparar-com é peneirado contra o mês exibido que veio na mesma query', () => {
    expect(ler('dashOperacional', '?mes=2026-05&comparar-com=2026-04', dash).compareKey).toBe('2026-04');
    expect(ler('dashOperacional', '?mes=2026-05&comparar-com=2026-08', dash).compareKey).toBeNull();
  });

  it('pessoa que não está na lista cai em todos, inclusive no Operacional', () => {
    for (const tela of ['dashOperacional', 'dashCrm']) {
      expect(ler(tela, '?pessoa=u1', { ...dash, funis }).person, tela).toBe('u1');
      expect(ler(tela, '?pessoa=sumiu', { ...dash, funis }).person, tela).toBe('all');
      expect(volta(tela, '?pessoa=sumiu', { ...dash, funis }), tela).toBe('');
    }
  });

  it('funil do CRM é recorte e cai em todos quando o funil sumiu', () => {
    const ctx = { ...dash, funis };
    expect(ler('dashCrm', '?funil=f1', ctx).funnel).toBe('f1');
    expect(ler('dashCrm', '?funil=apagado', ctx).funnel).toBe('all');
    expect(montar('dashCrm', { ...ler('dashCrm', '', ctx), funnel: 'f1' }, ctx)).toBe('?funil=f1');
  });

  it('a ordem dos parâmetros é a da tabela, não a de quem escreveu', () => {
    // 2026-06, e não 2026-07: o mês anterior ao exibido é o padrão e some.
    const v = { monthKey: '2026-08', compareOn: false, compareKey: '2026-06', person: 'u2' };
    expect(montar('dashOperacional', v, dash)).toBe('?mes=2026-08&comparar=0&comparar-com=2026-06&pessoa=u2');
  });
});

describe('responsável, nos três estados', () => {
  const kanban = { users, funis, podeResp: true, respPadrao: ['u2'], funilPadrao: 'f1' };

  it('ausente é o padrão do papel, vazio é toda a equipe, e com ids é a lista', () => {
    expect(ler('kanban', '', kanban).resp).toEqual(['u2']);
    expect(ler('kanban', '?resp=', kanban).resp).toEqual([]);
    expect(ler('kanban', '?resp=u1,u2', kanban).resp).toEqual(['u1', 'u2']);
  });

  it('a lista vazia só é escrita quando o padrão do papel não é vazia', () => {
    expect(montar('kanban', { ...ler('kanban', '', kanban), resp: [] }, kanban)).toBe('?funil=f1&resp=');
    const gestor = { ...kanban, respPadrao: [] };
    expect(montar('kanban', { ...ler('kanban', '', gestor), resp: [] }, gestor)).toBe('?funil=f1');
  });

  it('id de quem saiu é descartado, e só o padrão volta quando nenhum sobra', () => {
    expect(ler('kanban', '?resp=u1,sumiu', kanban).resp).toEqual(['u1']);
    expect(ler('kanban', '?resp=sumiu', kanban).resp).toEqual(['u2']);
  });

  it('quem não vê o controle não é recortado pelo endereço, e o parâmetro não é escrito', () => {
    const consultor = { users, situacoes, podeResp: false, respPadrao: [] };
    expect(ler('clientes', '?resp=u1', consultor).resp).toEqual([]);
    expect(montar('clientes', { status: [], resp: ['u1'] }, consultor)).toBe('');
  });
});

describe('listas de valor fechado', () => {
  const cli = { users, situacoes, podeResp: true, respPadrao: [] };
  const lea = { users, funis, etapas, podeResp: true, respPadrao: [], funilPadrao: 'f1' };

  it('situação aceita só os valores do catálogo de contrato', () => {
    expect(ler('clientes', '?sit=ativo,a_vencer', cli).status).toEqual(['ativo', 'a_vencer']);
    expect(ler('clientes', '?sit=ativo,banana', cli).status).toEqual(['ativo']);
    expect(ler('clientes', '?sit=banana', cli).status).toEqual([]);
    expect(montar('clientes', { status: ['ativo', 'a_vencer'], resp: [] }, cli)).toBe('?sit=ativo,a_vencer');
  });

  it('fase viaja como código e a tela recebe o nome da etapa', () => {
    expect(ler('leads', '?fase=s1', lea).stage).toEqual(['Novo']);
    expect(ler('leads', `?fase=s2,${FASE_VENDA},${FASE_PERDA}`, lea).stage).toEqual(['Em negociação', 'Venda', 'Perda']);
    expect(montar('leads', { ...ler('leads', '', lea), stage: ['Novo', 'Venda'] }, lea)).toBe(`?funil=f1&fase=s1,${FASE_VENDA}`);
  });

  it('etapa que saiu do funil some do filtro, e renomear a etapa não quebra o link', () => {
    expect(ler('leads', '?fase=apagada', lea).stage).toEqual([]);
    const renomeada = { ...lea, etapas: [{ id: 's1', name: 'Primeiro contato' }] };
    expect(ler('leads', '?fase=s1', renomeada).stage).toEqual(['Primeiro contato']);
  });

  it('categoria da Meta aceita as sete do dia, amanhã e todos', () => {
    expect(ler('dailyGoal', '?cat=renovacao', {}).cat).toBe('renovacao');
    expect(ler('dailyGoal', '?cat=amanha', {}).cat).toBe('tomorrow');
    expect(ler('dailyGoal', '?cat=banana', {}).cat).toBe('all');
    expect(montar('dailyGoal', { cat: 'tomorrow' }, {})).toBe('?cat=amanha');
    expect(montar('dailyGoal', { cat: 'vencido' }, {})).toBe('?cat=vencido');
  });

  it('booleano só é escrito ligado', () => {
    expect(ler('leads', '?atraso=1&quente=1', lea).overdue).toBe(true);
    expect(ler('leads', '?atraso=0', lea).overdue).toBe(false);
    expect(montar('leads', { ...ler('leads', '', lea), overdue: true, hot: true }, lea)).toBe('?funil=f1&atraso=1&quente=1');
  });
});

describe('funil das telas de lista', () => {
  const lea = { users, funis, etapas, podeResp: true, respPadrao: [], funilPadrao: 'f1' };

  it('sem funil no endereço vale o último funil usado', () => {
    expect(ler('leads', '', lea).funnel).toBe('f1');
    expect(ler('leads', '?funil=f2', lea).funnel).toBe('f2');
    expect(ler('leads', '?funil=apagado', lea).funnel).toBe('f1');
  });

  it('o funil válido é sempre escrito, porque o padrão dele é de cada pessoa', () => {
    expect(montar('leads', ler('leads', '', lea), lea)).toBe('?funil=f1');
    expect(montar('kanban', ler('kanban', '?funil=f2', { ...lea, funilPadrao: 'f1' }), { ...lea, funilPadrao: 'f1' })).toBe('?funil=f2');
  });

  it('sem funil nenhum na academia o parâmetro não é escrito', () => {
    const vazio = { ...lea, funis: [], funilPadrao: null };
    expect(ler('leads', '?funil=f1', vazio).funnel).toBeNull();
    expect(montar('leads', ler('leads', '', vazio), vazio)).toBe('');
  });

  it('o funil da tela de lista é legível de fora, para o cadastro rápido não abrir no funil de antes', () => {
    const ctx = { funis, funilPadrao: 'f1' };
    expect(funnelFromSearch('kanban', '?funil=f2', ctx)).toBe('f2');
    expect(funnelFromSearch('leads', '?funil=f2&atraso=1', ctx)).toBe('f2');
    expect(funnelFromSearch('leads', '?funil=apagado', ctx)).toBe('f1');
    expect(funnelFromSearch('leads', '', ctx)).toBe('f1');
    // Tela sem funil de lista (o do CRM é recorte do dashboard, não é o mesmo
    // estado) e tela sem parâmetro nenhum devolvem o último funil usado.
    for (const tela of ['dashCrm', 'clientes', 'ficha', 'xyz']) {
      expect(funnelFromSearch(tela, '?funil=f2', ctx), tela).toBe('f1');
    }
    expect(funnelFromSearch('kanban', '?funil=f2', { funis, funilPadrao: null })).toBe('f2');
    expect(funnelFromSearch('kanban', '', {})).toBeNull();
  });
});

describe('dia e período de Aulas e Visitas', () => {
  const aulas = { users, podeResp: true, respPadrao: [], professores: [{ id: 'p1' }], temAndamento: true };
  const visitas = { users, podeResp: true, respPadrao: [], temAndamento: false };

  it('atalho de dia traduz o código do endereço para o id da tela', () => {
    const pares = [['hoje', 'today'], ['ontem', 'yesterday'], ['amanha', 'tomorrow'], ['andamento', 'ongoing']];
    for (const [cod, id] of pares) expect(ler('aulas', `?dia=${cod}`, aulas).day, cod).toBe(id);
    expect(ler('aulas', '?dia=banana', aulas).day).toBe('today');
  });

  it('em andamento só existe em Aulas', () => {
    expect(ler('visitas', '?dia=andamento', visitas).day).toBe('today');
    expect(montar('visitas', { day: 'ongoing', de: null, ate: null, resp: [] }, visitas)).toBe('');
  });

  it('período válido ganha do atalho de dia', () => {
    const v = ler('aulas', '?dia=ontem&de=2026-09-01&ate=2026-09-20', aulas);
    expect([v.day, v.de, v.ate]).toEqual([null, '2026-09-01', '2026-09-20']);
    expect(montar('aulas', v, aulas)).toBe('?de=2026-09-01&ate=2026-09-20');
  });

  it('período torto cai fora inteiro e a tela abre no dia padrão', () => {
    const tortos = [
      '?de=2026-09-20&ate=2026-09-01',
      '?de=2026-08-01&ate=2026-09-20',
      '?de=2026-09-01',
      '?ate=2026-09-20',
      '?de=banana&ate=2026-09-20',
      '?de=2026-09-31&ate=2026-10-01',
    ];
    for (const q of tortos) {
      const v = ler('aulas', q, aulas);
      expect([v.day, v.de, v.ate], q).toEqual(['today', null, null]);
      expect(volta('aulas', q, aulas), q).toBe('');
    }
  });

  it('o teto é de 30 dias, e trinta dias certos passam', () => {
    expect(ler('aulas', '?de=2026-09-01&ate=2026-10-01', aulas).de).toBe('2026-09-01');
    expect(ler('aulas', '?de=2026-09-01&ate=2026-10-02', aulas).de).toBeNull();
  });

  it('professor aceita os do catálogo e o treina sozinho, e some para quem não filtra', () => {
    expect(ler('aulas', `?prof=p1,${SOLO_TRAINING}`, aulas).prof).toEqual(['p1', SOLO_TRAINING]);
    expect(ler('aulas', '?prof=p9', aulas).prof).toEqual([]);
    expect(ler('aulas', '?prof=p1', { ...aulas, podeResp: false }).prof).toEqual([]);
  });
});

describe('ida e volta de tudo', () => {
  it('ler e montar de novo devolve a mesma query, para toda tela', () => {
    const ctx = {
      currentKey: HOJE, users, funis, etapas, situacoes, professores: [{ id: 'p1' }],
      podeResp: true, respPadrao: [], funilPadrao: 'f1', temAndamento: true,
    };
    const casos = [
      ['dashOperacional', '?mes=2026-08&comparar=0&comparar-com=2026-06&pessoa=u1'],
      ['dashCrm', '?mes=2026-08&pessoa=u1&funil=f2'],
      ['dashGerencial', '?mes=2026-08&comparar=0'],
      ['kanban', '?funil=f2&resp=u1&atraso=1'],
      ['clientes', '?sit=ativo&resp=u1,u2'],
      ['leads', '?funil=f1&fase=s1&resp=u2&atraso=1&quente=1'],
      ['aulas', '?de=2026-09-01&ate=2026-09-10&resp=u1&prof=p1'],
      ['visitas', '?dia=ontem&resp=u1'],
      ['dailyGoal', '?cat=atrasado'],
    ];
    // Só o Gerencial peneira o mês da comparação pelos meses com venda; as
    // outras telas usam os doze meses anteriores ao mês exibido.
    for (const [tela, q] of casos) {
      const c = tela === 'dashGerencial' ? { ...ctx, mesesComparaveis: () => ['2026-07', '2026-05'] } : ctx;
      expect(volta(tela, q, c), tela).toBe(q);
    }
  });

  it('valor com caractere especial volta legível, e a vírgula não vira código', () => {
    const ctx = { users: [{ id: 'a b' }, { id: 'c&d' }], podeResp: true, respPadrao: [], situacoes };
    const q = montar('clientes', { status: [], resp: ['a b', 'c&d'] }, ctx);
    expect(q).toBe('?resp=a%20b,c%26d');
    expect(ler('clientes', q, ctx).resp).toEqual(['a b', 'c&d']);
  });

  it('nome que a tela não conhece é ignorado, e some na próxima montagem', () => {
    expect(ler('dailyGoal', '?cat=vencido&mes=2026-08&invite=x', {})).toEqual({ cat: 'vencido' });
    expect(volta('dailyGoal', '?cat=vencido&mes=2026-08&invite=x', {})).toBe('?cat=vencido');
  });
});
```

Rodar e ver a cor vermelha:

```bash
npx vitest run src/lib/__tests__/screenParams.test.js
# Esperado: falha de importação, o módulo ainda não existe.
```

- [ ] **Step 2: Escrever `src/lib/screenParams.js`**

```js
// Filtro de cada tela no endereço. Tabela única do que cada tela guarda na
// query, a leitura (query para os valores da tela) e a montagem (valores para
// query). Puro de propósito (sem React, sem Firebase, sem window): a tela
// deriva o filtro no render e troca filtro navegando.
//
// Regras que não podem mudar:
// - Ausente é o padrão, e o padrão nunca é escrito. A única exceção é o funil
//   das telas de lista, cujo padrão é de cada pessoa (o último funil usado):
//   omitir faria o mesmo link abrir em funis diferentes para duas pessoas.
// - Valor inválido ou que sumiu cai no padrão, sem aviso e sem erro na tela.
// - Nome, telefone, CPF e texto de busca nunca entram na query (ver routes.js).
// - Nome de parâmetro novo nunca pode ser invite, t ou ref: o App decide o
//   convite e a indicação pública por eles, antes do roteador.
// - O saneamento depende de dado que só a tela tem (usuários, funis, etapas,
//   meses comparáveis, se a pessoa vê o controle). Isso chega no `ctx`, que a
//   tela monta com useMemo e passa no render.

import { CONTRACT_STATUS } from './contracts.js';
import { DAILY_GOAL_CATEGORIES } from './leads.js';
import { SOLO_TRAINING } from './professores.js';
import { addMonthsToKey, compareOptions } from './operacional/month.js';

const own = (obj, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key);

const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DIA_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// Lista separada por vírgula, sem vazio e sem espaço em volta.
const lista = (raw) => String(raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const mesmaLista = (a = [], b = []) => a.length === b.length && a.every((x, i) => x === b[i]);

// Código da situação do contrato mais o sentinela de quem nunca teve contrato.
export const SEM_CONTRATO = 'sem_contrato';
export const SITUACOES = Object.freeze([...Object.values(CONTRACT_STATUS), SEM_CONTRATO]);

// As duas colunas terminais de Todos os leads não são etapa cadastrada, então
// não têm id de documento: viajam por código.
export const FASE_VENDA = 'venda';
export const FASE_PERDA = 'perda';

// Atalho de dia de Aulas e Visitas: código do endereço para o id da tela.
const DIA_POR_CODIGO = Object.freeze({ hoje: 'today', ontem: 'yesterday', amanha: 'tomorrow', andamento: 'ongoing' });
const CODIGO_POR_DIA = Object.freeze(Object.fromEntries(Object.entries(DIA_POR_CODIGO).map(([c, d]) => [d, c])));

// Categoria da Meta diária: os sete slugs do dia, mais a prévia de amanhã.
const CAT_POR_CODIGO = Object.freeze({
  ...Object.fromEntries(Object.values(DAILY_GOAL_CATEGORIES).map((s) => [s, s])),
  amanha: 'tomorrow',
});
const CODIGO_POR_CAT = Object.freeze(Object.fromEntries(Object.entries(CAT_POR_CODIGO).map(([c, v]) => [v, c])));

// Definição de um parâmetro: em que campo da tela ele cai, como se lê um valor
// cru (null quando o nome não está no endereço) e como se escreve de volta
// (null quando é o padrão, ou quando não vale). As duas funções recebem o ctx
// e o que já foi lido nesta passada, porque comparar-com depende do mês.
const param = (campo, ler, escrever) => Object.freeze({ campo, ler, escrever });

const janelaDoMes = (v, ctx) =>
  MES_RE.test(v || '') && v <= ctx.currentKey && v >= addMonthsToKey(ctx.currentKey, -11);

const mes = param(
  'monthKey',
  (raw, ctx) => (janelaDoMes(raw, ctx) ? raw : ctx.currentKey),
  (v, ctx) => (janelaDoMes(v, ctx) && v !== ctx.currentKey ? v : null),
);

const comparar = param(
  'compareOn',
  (raw) => raw !== '0',
  (v) => (v === false ? '0' : null),
);

// Mês da comparação. O Gerencial passa a própria peneira (só mês com venda);
// as outras duas telas usam os doze meses anteriores ao mês exibido.
const mesesComparaveis = (ctx, monthKey) =>
  (typeof ctx.mesesComparaveis === 'function' ? ctx.mesesComparaveis(monthKey) : compareOptions(monthKey)) || [];

// O padrão é sempre o PRIMEIRO da lista de comparáveis: o mês anterior no
// Operacional e no CRM, o mês anterior com venda no Gerencial. Ele não é
// escrito, senão escolher na barra justamente a opção que já estava marcada
// sujaria o endereço com um valor que ninguém mudou.
const compararCom = param(
  'compareKey',
  (raw, ctx, ja) => (mesesComparaveis(ctx, ja.monthKey).includes(raw) ? raw : null),
  (v, ctx, ja) => {
    const opts = mesesComparaveis(ctx, ja.monthKey);
    return v && opts.includes(v) && v !== opts[0] ? v : null;
  },
);

const existe = (fonte, id) => (fonte || []).some((x) => x?.id === id);

const pessoa = param(
  'person',
  (raw, ctx) => (existe(ctx.users, raw) ? raw : 'all'),
  (v, ctx) => (v && v !== 'all' && existe(ctx.users, v) ? v : null),
);

// Funil do recorte do dashboard CRM: "todos" é o padrão, e funil apagado
// também vale "todos".
const funilRecorte = param(
  'funnel',
  (raw, ctx) => (existe(ctx.funis, raw) ? raw : 'all'),
  (v, ctx) => (v && v !== 'all' && existe(ctx.funis, v) ? v : null),
);

// Funil do Pipeline e de Todos os leads. O padrão é o último funil usado por
// esta pessoa, então ele é escrito sempre que vale, para o link querer dizer a
// mesma coisa para quem abrir do outro lado.
const funilDaTela = param(
  'funnel',
  (raw, ctx) => (existe(ctx.funis, raw) ? raw : (ctx.funilPadrao ?? null)),
  (v, ctx) => (existe(ctx.funis, v) ? v : null),
);

// Responsável, nos três estados: ausente é o padrão do papel, vazio é toda a
// equipe, e com ids é a lista escolhida. Quem não vê o controle na tela não é
// recortado por link nenhum.
const resp = param(
  'resp',
  (raw, ctx) => {
    const padrao = ctx.respPadrao || [];
    if (!ctx.podeResp || raw === null) return padrao;
    if (raw === '') return [];
    const ids = lista(raw).filter((id) => existe(ctx.users, id));
    return ids.length ? ids : padrao;
  },
  (v, ctx) => {
    if (!ctx.podeResp) return null;
    const ids = (Array.isArray(v) ? v : []).filter((id) => existe(ctx.users, id));
    return mesmaLista(ids, ctx.respPadrao || []) ? null : ids.join(',');
  },
);

const prof = param(
  'prof',
  (raw, ctx) => {
    if (!ctx.podeResp || !raw) return [];
    const podem = [SOLO_TRAINING, ...(ctx.professores || []).map((p) => p?.id)];
    return lista(raw).filter((id) => podem.includes(id));
  },
  (v, ctx) => {
    if (!ctx.podeResp) return null;
    const podem = [SOLO_TRAINING, ...(ctx.professores || []).map((p) => p?.id)];
    const ids = (Array.isArray(v) ? v : []).filter((id) => podem.includes(id));
    return ids.length ? ids.join(',') : null;
  },
);

const sit = param(
  'status',
  (raw, ctx) => (raw ? lista(raw).filter((s) => (ctx.situacoes || SITUACOES).includes(s)) : []),
  (v, ctx) => {
    const ids = (Array.isArray(v) ? v : []).filter((s) => (ctx.situacoes || SITUACOES).includes(s));
    return ids.length ? ids.join(',') : null;
  },
);

// Fase do funil. A tela guarda o NOME da etapa e o endereço leva o CÓDIGO (o id
// do documento, ou venda e perda nas duas colunas terminais), então renomear a
// etapa não quebra o link.
// A lista de etapas depende do funil, e o funil é lido antes da fase na mesma
// passada. Por isso ctx.etapas pode ser a lista pronta ou uma função que
// recebe o funil escolhido, que é como a tela de Todos os leads passa.
//
// As duas terminais vêm POR ÚLTIMO de propósito. O catálogo de etapas é livre,
// então nada impede uma academia de cadastrar uma etapa chamada "Venda". Na
// tela as duas já são a mesma opção (o filtro guarda o nome), e aqui o mapa de
// escrita é por nome, com o último ganhando: assim esse nome sempre vira o
// código `venda`, que é curto, estável e não muda se a etapa for apagada.
const codigosDeFase = (ctx, ja) => {
  const etapas = typeof ctx.etapas === 'function' ? ctx.etapas(ja?.funnel ?? null) : ctx.etapas;
  const pares = [];
  for (const e of etapas || []) if (e?.id && e?.name) pares.push([e.id, e.name]);
  pares.push([FASE_VENDA, 'Venda'], [FASE_PERDA, 'Perda']);
  return pares;
};

const fase = param(
  'stage',
  (raw, ctx, ja) => {
    if (!raw) return [];
    const por = new Map(codigosDeFase(ctx, ja));
    return lista(raw).filter((c) => por.has(c)).map((c) => por.get(c));
  },
  (v, ctx, ja) => {
    const por = new Map(codigosDeFase(ctx, ja).map(([c, nome]) => [nome, c]));
    const cods = (Array.isArray(v) ? v : []).filter((nome) => por.has(nome)).map((nome) => por.get(nome));
    return cods.length ? cods.join(',') : null;
  },
);

const ligado = (campo, quando = '1') => param(
  campo,
  (raw) => raw === quando,
  (v) => (v === true ? quando : null),
);

const dia = param(
  'day',
  (raw, ctx) => {
    const id = own(DIA_POR_CODIGO, raw) ? DIA_POR_CODIGO[raw] : null;
    if (id === 'ongoing' && !ctx.temAndamento) return 'today';
    return id || 'today';
  },
  (v, ctx) => {
    if (v === 'ongoing' && !ctx.temAndamento) return null;
    return v && v !== 'today' && own(CODIGO_POR_DIA, v) ? CODIGO_POR_DIA[v] : null;
  },
);

const dataDoPeriodo = (campo) => param(
  campo,
  (raw) => (DIA_RE.test(raw || '') ? raw : null),
  (v) => (DIA_RE.test(v || '') ? v : null),
);

const cat = param(
  'cat',
  (raw) => (own(CAT_POR_CODIGO, raw) ? CAT_POR_CODIGO[raw] : 'all'),
  (v) => (v && v !== 'all' && own(CODIGO_POR_CAT, v) ? CODIGO_POR_CAT[v] : null),
);

// Um dia em milissegundos, para o teto de 30 dias do período. As datas são
// lidas em UTC de propósito: só interessa a distância entre elas, e assim o
// horário de verão não muda a conta.
const DIA_MS = 24 * 60 * 60 * 1000;
const emUTC = (s) => {
  const [a, m, d] = s.split('-').map(Number);
  const t = Date.UTC(a, m - 1, d);
  return new Date(t).getUTCDate() === d ? t : NaN;
};

// Regra que cruza dois parâmetros de Aulas e Visitas: o par de datas ganha do
// atalho de dia, e período torto (data que não existe, fim antes do início,
// mais de 30 dias, metade do par) cai fora inteiro, sem erro na tela.
function ajustaPeriodo(valores) {
  const ini = valores.de ? emUTC(valores.de) : NaN;
  const fim = valores.ate ? emUTC(valores.ate) : NaN;
  const vale = Number.isFinite(ini) && Number.isFinite(fim) && fim >= ini && (fim - ini) / DIA_MS <= 30;
  if (!vale) return { ...valores, de: null, ate: null };
  return { ...valores, day: null };
}

// Tabela por tela. A ordem aqui é a ordem no endereço.
const TABELA = {
  dashOperacional: { mes, comparar, 'comparar-com': compararCom, pessoa },
  dashCrm: { mes, comparar, 'comparar-com': compararCom, pessoa, funil: funilRecorte },
  dashGerencial: { mes, comparar, 'comparar-com': compararCom },
  kanban: { funil: funilDaTela, resp, atraso: ligado('overdue') },
  clientes: { sit, resp },
  leads: { funil: funilDaTela, fase, resp, atraso: ligado('overdue'), quente: ligado('hot') },
  aulas: { dia, de: dataDoPeriodo('de'), ate: dataDoPeriodo('ate'), resp, prof },
  visitas: { dia, de: dataDoPeriodo('de'), ate: dataDoPeriodo('ate'), resp },
  dailyGoal: { cat },
};
// O endereço curto /<academia> é a mesma tela do Operacional.
TABELA.dashboard = TABELA.dashOperacional;
Object.freeze(TABELA);

const AJUSTES = Object.freeze({ aulas: ajustaPeriodo, visitas: ajustaPeriodo });

// Os nomes de cada tela, na ordem do endereço. Serve à varredura e ao teste.
export const SCREEN_PARAM_NAMES = Object.freeze(
  Object.fromEntries(Object.entries(TABELA).map(([tela, defs]) => [tela, Object.freeze(Object.keys(defs))])),
);

// Valores da tela a partir da query. Tela sem filtro devolve objeto vazio.
export function readScreenParams(screen, search, ctx = {}) {
  const defs = own(TABELA, screen) ? TABELA[screen] : null;
  if (!defs) return {};
  const q = new URLSearchParams(typeof search === 'string' ? search : '');
  const out = {};
  for (const [nome, def] of Object.entries(defs)) {
    out[def.campo] = def.ler(q.has(nome) ? q.get(nome) : null, ctx, out);
  }
  return own(AJUSTES, screen) ? AJUSTES[screen](out, ctx) : out;
}

// A vírgula separa lista e fica legível no endereço; o resto é codificado.
const escapa = (s) => encodeURIComponent(String(s)).replace(/%2C/g, ',');

// Query a partir dos valores da tela, na ordem da tabela e sem o que é padrão.
// Devolve '' ou '?a=b&c=d', pronto para colar depois do caminho.
export function screenParamsQuery(screen, valores, ctx = {}) {
  const defs = own(TABELA, screen) ? TABELA[screen] : null;
  if (!defs) return '';
  const v = valores || {};
  const partes = [];
  for (const [nome, def] of Object.entries(defs)) {
    const escrito = def.escrever(v[def.campo], ctx, v);
    if (escrito !== null && escrito !== undefined) partes.push(`${nome}=${escapa(escrito)}`);
  }
  return partes.length ? `?${partes.join('&')}` : '';
}

// O funil que uma tela de lista está mostrando, do endereço ou do último funil
// usado. É o único pedaço do filtro que faz sentido fora da tela: o App precisa
// dele para o cadastro rápido nascer no mesmo funil do quadro. Sem isso, abrir
// /leads?funil=<outro> por link e clicar em "Novo lead" cadastraria no funil
// de antes, porque o localStorage só muda quando alguém clica na aba de funil.
export function funnelFromSearch(screen, search, ctx = {}) {
  const defs = own(TABELA, screen) ? TABELA[screen] : null;
  if (!defs || defs.funil !== funilDaTela) return ctx.funilPadrao ?? null;
  const q = new URLSearchParams(typeof search === 'string' ? search : '');
  return funilDaTela.ler(q.has('funil') ? q.get('funil') : null, ctx);
}
```

- [ ] **Step 3: Escrever `src/hooks/useScreenParams.js`**

```js
import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { readScreenParams, screenParamsQuery } from '../lib/screenParams.js';

// O filtro da tela sai do endereço a cada render e volta para ele a cada
// escolha. Nada de useState para filtro, nada de ler a URL num effect: é a
// mesma regra que o screenState já segue para a tela e a ficha.
//
// - o destino é montado com o location.pathname de agora, e não com hrefFor:
//   trocar filtro é ficar na mesma tela, e o Operacional tem dois endereços
//   válidos (/<academia> e /<academia>/visao-geral/operacional);
// - replace, para trocar filtro não criar parada no voltar do navegador
//   (decisão 3 do Johnny) e para o idx do histórico, que o Voltar da ficha lê,
//   continuar andando só quando se troca de tela;
// - o state vai explícito, porque o navigate não o repassa sozinho e é nele
//   que vive a tela de origem da ficha.
//
// `ctx` é o que o saneamento precisa saber e só a tela tem. Ele entra em
// dependência de hook, então a tela precisa montá-lo com useMemo.
export function useScreenParams(screen, ctx) {
  const location = useLocation();
  const navigate = useNavigate();
  const { pathname, search, state } = location;

  const values = useMemo(() => readScreenParams(screen, search, ctx), [screen, search, ctx]);

  const setParams = useCallback((patch) => {
    const escolha = typeof patch === 'function' ? patch(values) : patch;
    const next = { ...values, ...escolha };
    navigate(pathname + screenParamsQuery(screen, next, ctx), { replace: true, state });
  }, [values, ctx, navigate, pathname, state, screen]);

  return [values, setParams];
}
```

- [ ] **Step 4: Verificar e commitar**

```bash
npx vitest run
# Esperado: Test Files  107 passed (107) · Tests  2172 passed (2172)
npm run lint
# Esperado: ✖ 1 problem (0 errors, 1 warning)
git add -A && git commit -m "$(cat <<'MSGEOF'
feat: módulo puro dos filtros de tela no endereço e o hook que liga às telas

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSGEOF
)"
```

---

### Task 3: os três dashboards derivando mês, comparativo, pessoa e funil do endereço

**Files:**
- Modify: `src/views/dashboard/DashboardOperacionalView.jsx` (estado nas linhas 305-308; `users` na linha 326; `changeMonth` na linha 491; barra nas linhas 517-519; `onPick` de "Equipe no mês" na linha 624)
- Modify: `src/views/dashboard/DashboardCrmView.jsx` (estado nas linhas 41-52; `changeMonth` e `pickPerson` nas linhas 130-132; barra nas linhas 148-151; `onClear` na linha 177)
- Modify: `src/views/dashboard/DashboardGerencialView.jsx` (estado nas linhas 38-40; `earlierWithSales` nas linhas 58-66; `changeMonth` na linha 98; barra nas linhas 115-116)
- Test: `src/lib/__tests__/screenParams.test.js` (modificar)

As três telas perdem quatro, cinco e três `useState`. Nenhuma outra linha delas muda: `cmpKey`, `monthKeys`, `userId`, `funnelId` e as contas continuam iguais, só que alimentadas pelo endereço.

Duas coisas mudam de comportamento de propósito:

- **A pessoa passa a ser saneada também no Operacional.** Hoje a linha 309 é `person === 'all' ? null : person`, sem conferir contra `users`, então um `?pessoa=` de quem foi desligado mostraria a tela inteira zerada com o seletor em branco. Agora cai em "toda a equipe", como no CRM.
- **O mês passa a ser preso na janela de 12 meses mesmo vindo do endereço.** Hoje a única contenção é a seta e a lista do seletor.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao fim de `src/lib/__tests__/screenParams.test.js`:

```js
describe('contrato do contexto dos três dashboards', () => {
  // A tela monta a lista de meses com 12 opções a partir do mês corrente
  // (Array.from({length: 12}, (_, i) => addMonthsToKey(currentKey, -i))) e a
  // seta trava em addMonthsToKey(currentKey, -11). O endereço obedece à mesma
  // janela, senão um link abriria um mês que o seletor não sabe mostrar.
  it('a janela do mês do endereço é a mesma lista de 12 meses da barra', () => {
    const doze = Array.from({ length: 12 }, (_, i) => {
      const [a, m] = HOJE.split('-').map(Number);
      const d = new Date(a, m - 1 - i, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    for (const m of doze) expect(ler('dashOperacional', `?mes=${m}`, dash).monthKey, m).toBe(m);
    const antesDaLista = doze[doze.length - 1];
    expect(ler('dashOperacional', `?mes=${antesDaLista}`, dash).monthKey).toBe(antesDaLista);
  });

  it('trocar de mês limpa o mês da comparação, como a barra já fazia', () => {
    const v = ler('dashOperacional', '?mes=2026-08&comparar-com=2026-07', dash);
    expect(montar('dashOperacional', { ...v, monthKey: '2026-06', compareKey: null }, dash)).toBe('?mes=2026-06');
  });

  it('o Gerencial sem nenhum mês com venda não escreve comparativo nenhum', () => {
    const ctx = { currentKey: HOJE, mesesComparaveis: () => [] };
    expect(ler('dashGerencial', '?comparar-com=2026-07', ctx).compareKey).toBeNull();
    expect(montar('dashGerencial', { monthKey: HOJE, compareOn: true, compareKey: '2026-07' }, ctx)).toBe('');
  });

  it('o Gerencial não tem filtro de pessoa, e um pessoa no endereço dele é ignorado', () => {
    expect(ler('dashGerencial', '?pessoa=u1', { currentKey: HOJE })).toEqual({ monthKey: HOJE, compareOn: true, compareKey: null });
  });

  it('o funil do CRM é o recorte do dashboard e não conhece o último funil usado', () => {
    const ctx = { ...dash, funis, funilPadrao: 'f2' };
    expect(ler('dashCrm', '', ctx).funnel).toBe('all');
    expect(montar('dashCrm', ler('dashCrm', '', ctx), ctx)).toBe('');
  });

  it('desligar o comparativo e escolher pessoa cabem na mesma query', () => {
    expect(montar('dashCrm', { monthKey: HOJE, compareOn: false, compareKey: null, person: 'u1', funnel: 'all' }, { ...dash, funis }))
      .toBe('?comparar=0&pessoa=u1');
  });

  it('clicar na linha da pessoa e clicar de novo limpa: os dois estados cabem no endereço', () => {
    const ctx = { ...dash, funis };
    const escolhida = { ...ler('dashCrm', '', ctx), person: 'u2' };
    expect(montar('dashCrm', escolhida, ctx)).toBe('?pessoa=u2');
    expect(montar('dashCrm', { ...escolhida, person: 'all' }, ctx)).toBe('');
  });

  it('pessoa desligada no meio da sessão some do endereço na próxima escolha', () => {
    const antes = { ...dash, users: [...users, { id: 'u9' }] };
    const depois = dash;
    const v = ler('dashOperacional', '?pessoa=u9', antes);
    expect(v.person).toBe('u9');
    expect(montar('dashOperacional', v, depois)).toBe('');
    expect(ler('dashOperacional', '?pessoa=u9', depois).person).toBe('all');
  });

  it('o endereço curto da academia e o endereço longo do Operacional leem igual', () => {
    const q = '?mes=2026-08&comparar=0&pessoa=u1';
    expect(ler('dashboard', q, dash)).toEqual(ler('dashOperacional', q, dash));
  });
});
```

```bash
npx vitest run src/lib/__tests__/screenParams.test.js
# Esperado: verde já neste passo (o módulo da T2 cobre), e é isso que prova
# que o contexto que as telas vão montar é o que o módulo espera.
```

- [ ] **Step 2: O Operacional**

Antes (`src/views/dashboard/DashboardOperacionalView.jsx:304-310`):

```js
  const currentKey = monthKeyOf(now);
  const [monthKey, setMonthKey] = useState(currentKey);
  const [compareOn, setCompareOn] = useState(true);
  const [compareKey, setCompareKey] = useState(null); // null = mês anterior
  const [person, setPerson] = useState('all');
  const userId = person === 'all' ? null : person;
  const cmpKey = compareKey || addMonthsToKey(monthKey, -1);
```

Depois:

```js
  const currentKey = monthKeyOf(now);
  const users = useMemo(() => (usersList || []).filter((u) => u?.id), [usersList]);
  // Mês, comparativo e pessoa vêm do endereço: F5 mantém, o link abre igual e
  // cada aba pode estar num recorte diferente. Pessoa que saiu da equipe e mês
  // fora da janela de 12 meses caem no padrão, sem aviso (src/lib/screenParams.js).
  const paramsCtx = useMemo(() => ({ currentKey, users }), [currentKey, users]);
  const [{ monthKey, compareOn, compareKey, person }, setParams] = useScreenParams('dashOperacional', paramsCtx);
  const userId = person === 'all' ? null : person;
  const cmpKey = compareKey || addMonthsToKey(monthKey, -1);
```

A linha que declarava `users` mais abaixo sai, porque subiu.

Antes (`src/views/dashboard/DashboardOperacionalView.jsx:325-327`):

```js
  const contracts = useMemo(() => normalizeContracts(contratos), [contratos]);
  const users = useMemo(() => (usersList || []).filter((u) => u?.id), [usersList]);
  const personUser = userId ? users.find((u) => u.id === userId) || null : null;
```

Depois:

```js
  const contracts = useMemo(() => normalizeContracts(contratos), [contratos]);
  const personUser = userId ? users.find((u) => u.id === userId) || null : null;
```

Antes (`src/views/dashboard/DashboardOperacionalView.jsx:491`):

```js
  const changeMonth = (k) => { setMonthKey(k); setCompareKey(null); };
```

Depois:

```js
  // Trocar de mês zera o mês da comparação, como sempre zerou. É uma navegação
  // só: os dois parâmetros trocam juntos.
  const changeMonth = (k) => setParams({ monthKey: k, compareKey: null });
```

Antes (`src/views/dashboard/DashboardOperacionalView.jsx:517-519`):

```js
          compareOn={compareOn} onCompareOn={setCompareOn}
          compareKey={cmpKey} compareOptions={cmpOptions} onCompare={setCompareKey}
          person={person} people={people} onPerson={setPerson}
```

Depois:

```js
          compareOn={compareOn} onCompareOn={(v) => setParams({ compareOn: v })}
          compareKey={cmpKey} compareOptions={cmpOptions} onCompare={(k) => setParams({ compareKey: k })}
          person={person} people={people} onPerson={(id) => setParams({ person: id })}
```

Falta o terceiro ponto que escolhe pessoa: o clique na linha de "Equipe no mês", anunciado na própria tela ("clique numa linha para filtrar a tela por essa pessoa").

Antes (`src/views/dashboard/DashboardOperacionalView.jsx:624`):

```js
                  <TeamMonthTable rows={team.rows} others={team.others} total={cur} running={running} onPick={setPerson} />
```

Depois:

```js
                  <TeamMonthTable rows={team.rows} others={team.others} total={cur} running={running} onPick={(id) => setParams({ person: id })} />
```

No import do topo, acrescentar o hook:

```js
import { useScreenParams } from '../../hooks/useScreenParams.js';
```

- [ ] **Step 3: O CRM**

Antes (`src/views/dashboard/DashboardCrmView.jsx:40-53`):

```js
  const currentKey = monthKeyOf(now);
  const [monthKey, setMonthKey] = useState(currentKey);
  const [compareOn, setCompareOn] = useState(true);
  const [compareKey, setCompareKey] = useState(null); // null = mês anterior
  const [person, setPerson] = useState('all');
  const [funnel, setFunnel] = useState('all');

  const users = useMemo(() => (usersList || []).filter((u) => u?.id), [usersList]);
  const leadFunnels = useMemo(() => leadFunnelsOf(funnels), [funnels]);
  // Pessoa ou funil que saiu da lista (usuário removido, funil apagado) vale "todos".
  const userId = person !== 'all' && users.some((u) => u.id === person) ? person : null;
  const funnelId = funnel !== 'all' && leadFunnels.some((f) => f.id === funnel) ? funnel : null;
  const cmpKey = compareKey || addMonthsToKey(monthKey, -1);
```

Depois:

```js
  const currentKey = monthKeyOf(now);
  const users = useMemo(() => (usersList || []).filter((u) => u?.id), [usersList]);
  const leadFunnels = useMemo(() => leadFunnelsOf(funnels), [funnels]);
  // Mês, comparativo, pessoa e funil vêm do endereço. Pessoa ou funil que saiu
  // da lista (usuário removido, funil apagado) já chega como "todos", que é o
  // mesmo saneamento de antes, agora no módulo puro.
  const paramsCtx = useMemo(() => ({ currentKey, users, funis: leadFunnels }), [currentKey, users, leadFunnels]);
  const [{ monthKey, compareOn, compareKey, person, funnel }, setParams] = useScreenParams('dashCrm', paramsCtx);
  const userId = person === 'all' ? null : person;
  const funnelId = funnel === 'all' ? null : funnel;
  const cmpKey = compareKey || addMonthsToKey(monthKey, -1);
```

Antes (`src/views/dashboard/DashboardCrmView.jsx:129-132`):

```js
  const changeMonth = (k) => { setMonthKey(k); setCompareKey(null); };
  // Clicar na linha da pessoa filtra; clicar de novo na mesma linha limpa.
  const pickPerson = (id) => setPerson((p) => (p === id ? 'all' : id));
```

Depois:

```js
  const changeMonth = (k) => setParams({ monthKey: k, compareKey: null });
  // Clicar na linha da pessoa filtra; clicar de novo na mesma linha limpa.
  const pickPerson = (id) => setParams((v) => ({ person: v.person === id ? 'all' : id }));
```

Antes (`src/views/dashboard/DashboardCrmView.jsx:148-151`):

```js
          compareOn={compareOn} onCompareOn={setCompareOn}
          compareKey={cmpKey} compareOptions={cmpOptions} onCompare={setCompareKey}
          person={userId || 'all'} people={people} onPerson={setPerson}
          funnel={funnelId || 'all'} funnels={leadFunnels} onFunnel={setFunnel}
```

Depois:

```js
          compareOn={compareOn} onCompareOn={(v) => setParams({ compareOn: v })}
          compareKey={cmpKey} compareOptions={cmpOptions} onCompare={(k) => setParams({ compareKey: k })}
          person={userId || 'all'} people={people} onPerson={(id) => setParams({ person: id })}
          funnel={funnelId || 'all'} funnels={leadFunnels} onFunnel={(id) => setParams({ funnel: id })}
```

Antes (`src/views/dashboard/DashboardCrmView.jsx:177`):

```js
              onClear={() => setPerson('all')}
```

Depois:

```js
              onClear={() => setParams({ person: 'all' })}
```

No import do topo, acrescentar o hook:

```js
import { useScreenParams } from '../../hooks/useScreenParams.js';
```

- [ ] **Step 4: O Gerencial**

Antes (`src/views/dashboard/DashboardGerencialView.jsx:37-40`):

```js
  const currentKey = monthKeyOf(now);
  const [monthKey, setMonthKey] = useState(currentKey);
  const [compareOn, setCompareOn] = useState(true);
  const [compareKey, setCompareKey] = useState(null); // null = o mês anterior com venda
```

Depois:

```js
  const currentKey = monthKeyOf(now);
```

Os três `useState` somem daqui, porque o mês da comparação precisa da peneira
dos meses com venda, que só existe depois dos contratos. A leitura do endereço
entra logo abaixo do `saleMonths`.

Antes (`src/views/dashboard/DashboardGerencialView.jsx:58-66`):

```js
  const earlierWithSales = useMemo(
    () => [...saleMonths].filter((k) => k < monthKey).sort().reverse(),
    [saleMonths, monthKey]
  );
  const canCompare = earlierWithSales.length > 0;
  const cmpKey = canCompare
    ? (compareKey && earlierWithSales.includes(compareKey) ? compareKey : earlierWithSales[0])
    : null;
  const comparing = compareOn && Boolean(cmpKey);
```

Depois:

```js
  // Mês e comparativo vêm do endereço. O mês da comparação passa pela mesma
  // peneira da barra: só mês que teve venda antes do mês exibido. Um
  // comparar-com fora dela cai no padrão, que é o mês anterior com venda.
  const paramsCtx = useMemo(() => ({
    currentKey,
    mesesComparaveis: (k) => [...saleMonths].filter((m) => m < k).sort().reverse(),
  }), [currentKey, saleMonths]);
  const [{ monthKey, compareOn, compareKey }, setParams] = useScreenParams('dashGerencial', paramsCtx);

  const earlierWithSales = useMemo(
    () => [...saleMonths].filter((k) => k < monthKey).sort().reverse(),
    [saleMonths, monthKey]
  );
  const canCompare = earlierWithSales.length > 0;
  const cmpKey = canCompare ? (compareKey || earlierWithSales[0]) : null;
  const comparing = compareOn && Boolean(cmpKey);
```

Antes (`src/views/dashboard/DashboardGerencialView.jsx:98`):

```js
  const changeMonth = (k) => { setMonthKey(k); setCompareKey(null); };
```

Depois:

```js
  const changeMonth = (k) => setParams({ monthKey: k, compareKey: null });
```

Antes (`src/views/dashboard/DashboardGerencialView.jsx:115-116`):

```js
          compareOn={compareOn} onCompareOn={setCompareOn}
          compareKey={cmpKey || ''} compareOptions={cmpOptions} onCompare={setCompareKey}
```

Depois:

```js
          compareOn={compareOn} onCompareOn={(v) => setParams({ compareOn: v })}
          compareKey={cmpKey || ''} compareOptions={cmpOptions} onCompare={(k) => setParams({ compareKey: k })}
```

No import do topo, acrescentar o hook:

```js
import { useScreenParams } from '../../hooks/useScreenParams.js';
```

- [ ] **Step 5: Verificar e commitar**

Conferir que nenhum dos três guarda mais filtro em estado nem lê a URL:

```bash
/usr/bin/grep -nE "setMonthKey|setCompareOn|setCompareKey|setPerson|setFunnel\b|location\.search" src/views/dashboard/DashboardOperacionalView.jsx src/views/dashboard/DashboardCrmView.jsx src/views/dashboard/DashboardGerencialView.jsx
# Esperado: nada. Se sobrar um setter, é ponto de escolha que ficou para trás
# (o onPick de "Equipe no mês" foi o que quase passou batido).
```

```bash
npx vitest run
# Esperado: Test Files  107 passed (107) · Tests  2181 passed (2181)
npm run lint
# Esperado: ✖ 1 problem (0 errors, 1 warning)
git add -A && git commit -m "$(cat <<'MSGEOF'
feat: mês, comparativo, pessoa e funil dos dashboards no endereço

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSGEOF
)"
```

---

### Task 4: Pipeline e Clientes

**Files:**
- Modify: `src/views/KanbanView.jsx` (assinatura na linha 458; estado nas linhas 463-465; `toggleResp` e `clearFilters` nas linhas 1289-1298; abas de funil nas linhas 1308-1312; "Toda a equipe" na linha 1364; interruptor de atraso na linha 1413)
- Modify: `src/views/ClientsView.jsx` (estado nas linhas 78-82; `toggle*` e `clearAllFilters` nas linhas 143-149)
- Modify: `src/App.jsx` (funil do cadastro rápido: perto do `menuHref`, e o `selectedFunnelId` do `AddLeadModal` na linha 1758)
- Test: `src/lib/__tests__/screenParams.test.js` (modificar)

O Pipeline é a única lista em que a seção Responsável é de todos (desde o PR #189), então é a única em que `resp` num link é honesto para qualquer papel. Clientes esconde a seção de quem não é gestor, então ali o parâmetro é ignorado para o consultor.

Duas coisas ficam fora desta tarefa de propósito: o `visibleCount` por coluna do Pipeline e o `visibleCount` de Clientes (não são escolha, são posição de leitura, e são do PR 2), e o filtro de plano de Clientes (decisão 7 do Johnny: o dado guarda o NOME do plano).

O funil do Pipeline continua sendo gravado no localStorage por academia a cada troca, então o cadastro rápido, os dois effects corretivos do App e as outras telas não mudam nada.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao fim de `src/lib/__tests__/screenParams.test.js`:

```js
describe('contrato do contexto do Pipeline e de Clientes', () => {
  const kanban = { users, funis, podeResp: true, respPadrao: ['u2'], funilPadrao: 'f1' };
  const gestorNoKanban = { ...kanban, respPadrao: [] };

  it('o consultor abre na própria carteira e o gestor na equipe, sem nada no endereço', () => {
    expect(ler('kanban', '', kanban).resp).toEqual(['u2']);
    expect(ler('kanban', '', gestorNoKanban).resp).toEqual([]);
  });

  it('o consultor que abre o board para a equipe inteira fica com isso no endereço', () => {
    expect(montar('kanban', { ...ler('kanban', '', kanban), resp: [] }, kanban)).toBe('?funil=f1&resp=');
  });

  it('limpar devolve o board ao padrão do papel, e o endereço só guarda o funil', () => {
    const limpo = { funnel: 'f1', resp: ['u2'], overdue: false };
    expect(montar('kanban', limpo, kanban)).toBe('?funil=f1');
  });

  it('o Pipeline não tem fase, situação nem quente no endereço', () => {
    expect(ler('kanban', '?fase=s1&sit=ativo&quente=1', kanban)).toEqual({ funnel: 'f1', resp: ['u2'], overdue: false });
  });

  it('Clientes junta situação e responsável na mesma query, na ordem da tabela', () => {
    const ctx = { users, situacoes, podeResp: true, respPadrao: [] };
    expect(montar('clientes', { status: ['ativo', 'a_vencer'], resp: ['u1'] }, ctx)).toBe('?sit=ativo,a_vencer&resp=u1');
  });

  it('link de gestor aberto por consultor mostra a lista inteira em Clientes', () => {
    const consultor = { users, situacoes, podeResp: false, respPadrao: [] };
    const v = ler('clientes', '?sit=ativo&resp=u1', consultor);
    expect(v).toEqual({ status: ['ativo'], resp: [] });
    expect(montar('clientes', v, consultor)).toBe('?sit=ativo');
  });

  it('sem contrato é uma situação de tela, não de contrato, e passa pelo endereço', () => {
    const ctx = { users, situacoes, podeResp: true, respPadrao: [] };
    expect(ler('clientes', '?sit=sem_contrato', ctx).status).toEqual(['sem_contrato']);
  });

  it('o filtro de plano não existe no endereço nesta entrega', () => {
    const ctx = { users, situacoes, podeResp: true, respPadrao: [] };
    expect(ler('clientes', '?plano=Clube%2B', ctx)).toEqual({ status: [], resp: [] });
  });
});
```

- [ ] **Step 2: O Pipeline**

Antes (`src/views/KanbanView.jsx:458-465`):

```js
function KanbanView({ leads, interactions, appUser, statuses, usersList, lossReasons, db, funnels, selectedFunnelId, setSelectedFunnelId }) {
  const toast = useToast();
  const [moveLead, setMoveLead] = useState(null); // lead com o menu "Mover" aberto (toque/teclado)
  // Filtro de responsáveis multi-seleção: conjunto vazio = toda a equipe. Abre
  // na carteira do próprio consultor (o gestor abre na equipe inteira) e daí em
  // diante é ele quem manda — regra em lib/kanban.js.
  const [respFilter, setRespFilter] = useState(() => defaultRespFilterFor(appUser));
  const [onlyOverdue, setOnlyOverdue] = useState(false);
```

Depois:

```js
function KanbanView({ leads, interactions, appUser, statuses, usersList, lossReasons, db, funnels, selectedFunnelId: savedFunnelId, setSelectedFunnelId: rememberFunnel }) {
  const toast = useToast();
  const [moveLead, setMoveLead] = useState(null); // lead com o menu "Mover" aberto (toque/teclado)
  // Funil, responsáveis e atraso vêm do endereço: F5 mantém, o link abre igual
  // e cada aba pode estar num recorte diferente. Sem funil no endereço vale o
  // último funil usado, que o App guarda por academia no navegador.
  // Responsável: conjunto vazio é toda a equipe, e sem nada no endereço vale o
  // padrão do papel (a carteira do consultor, a equipe do gestor), regra em
  // lib/kanban.js. Aqui a seção Responsável é de todos, então o parâmetro vale
  // para qualquer papel.
  const paramsCtx = useMemo(() => ({
    users: usersList,
    funis: funnels,
    funilPadrao: savedFunnelId,
    podeResp: true,
    respPadrao: defaultRespFilterFor(appUser),
  }), [usersList, funnels, savedFunnelId, appUser]);
  const [{ funnel, resp: respFilter, overdue: onlyOverdue }, setParams] = useScreenParams('kanban', paramsCtx);
  const selectedFunnelId = funnel;
```

Antes (`src/views/KanbanView.jsx:1289-1298`):

```js
  const toggleResp = (id) => {
    setRespFilter(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  // "Limpar" devolve a tela ao estado de abertura do papel — para o consultor
  // isso é a própria carteira, não a equipe inteira.
  const clearFilters = () => {
    setRespFilter(defaultRespFilterFor(appUser));
    setOnlyOverdue(false);
  };
```

Depois:

```js
  const toggleResp = (id) => {
    setParams((v) => ({ resp: v.resp.includes(id) ? v.resp.filter(x => x !== id) : [...v.resp, id] }));
  };

  // "Limpar" devolve a tela ao estado de abertura do papel — para o consultor
  // isso é a própria carteira, não a equipe inteira.
  const clearFilters = () => setParams({ resp: defaultRespFilterFor(appUser), overdue: false });

  // Trocar de funil guarda a escolha no navegador (é ela que vale quando o
  // link não traz funil) e escreve no endereço.
  const pickFunnel = (id) => { rememberFunnel(id); setParams({ funnel: id }); };
```

Antes (`src/views/KanbanView.jsx:1308-1312`):

```js
          <FunnelTabs
            funnels={funnels}
            counts={funnelCounts}
            selectedId={selectedFunnelId}
            onSelect={setSelectedFunnelId}
          />
```

Depois:

```js
          <FunnelTabs
            funnels={funnels}
            counts={funnelCounts}
            selectedId={selectedFunnelId}
            onSelect={pickFunnel}
          />
```

Antes (`src/views/KanbanView.jsx:1364`):

```js
                    onClick={() => setRespFilter([])}
```

Depois:

```js
                    onClick={() => setParams({ resp: [] })}
```

Antes (`src/views/KanbanView.jsx:1413`):

```js
                    onClick={() => setOnlyOverdue(o => !o)}
```

Depois:

```js
                    onClick={() => setParams((v) => ({ overdue: !v.overdue }))}
```

No import do topo, acrescentar o hook:

```js
import { useScreenParams } from '../hooks/useScreenParams.js';
```

- [ ] **Step 3: Clientes**

Antes (`src/views/ClientsView.jsx:74-82`):

```js
function ClientsView({ appUser, usersList, db }) {
  const { contractThresholdDays } = useGeneralConfig();
  const isAdmin = isAdminUser(appUser);

  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilters, setStatusFilters] = useState([]);     // situação do contrato (multi)
  const [consultantFilters, setConsultantFilters] = useState([]); // responsável (multi)
  const [planFilters, setPlanFilters] = useState([]);         // plano (multi)
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);
```

Depois:

```js
function ClientsView({ appUser, usersList, db }) {
  const { contractThresholdDays } = useGeneralConfig();
  const isAdmin = isAdminUser(appUser);

  const [filterOpen, setFilterOpen] = useState(false);
  // Situação e responsável vêm do endereço. O filtro de responsável só vale
  // para quem vê a seção na bolha, que aqui é o gestor: um link de gestor
  // aberto por consultor mostra a lista inteira, em vez de prender num recorte
  // que ele não teria como limpar. O filtro de plano fica fora desta entrega,
  // porque o dado guarda o nome do plano e não o id.
  const paramsCtx = useMemo(() => ({
    users: usersList, situacoes: STATUS_OPTIONS, podeResp: isAdmin, respPadrao: [],
  }), [usersList, isAdmin]);
  const [{ status: statusFilters, resp: consultantFilters }, setParams] = useScreenParams('clientes', paramsCtx);
  const [planFilters, setPlanFilters] = useState([]);         // plano (multi)
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);
```

Antes (`src/views/ClientsView.jsx:143-148`):

```js
  const toggleStatus = (s) => setStatusFilters(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleConsultant = (id) => setConsultantFilters(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const togglePlan = (p) => setPlanFilters(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const filterCount = statusFilters.length + consultantFilters.length + planFilters.length;
  const hasActiveFilters = filterCount > 0;
  const clearAllFilters = () => { setStatusFilters([]); setConsultantFilters([]); setPlanFilters([]); };
```

Depois:

```js
  const toggleStatus = (s) => setParams((v) => ({ status: v.status.includes(s) ? v.status.filter(x => x !== s) : [...v.status, s] }));
  const toggleConsultant = (id) => setParams((v) => ({ resp: v.resp.includes(id) ? v.resp.filter(x => x !== id) : [...v.resp, id] }));
  const togglePlan = (p) => setPlanFilters(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const filterCount = statusFilters.length + consultantFilters.length + planFilters.length;
  const hasActiveFilters = filterCount > 0;
  const clearAllFilters = () => { setPlanFilters([]); setParams({ status: [], resp: [] }); };
```

No import do topo, acrescentar o hook:

```js
import { useScreenParams } from '../hooks/useScreenParams.js';
```

- [ ] **Step 4: O funil do cadastro rápido segue o do endereço**

O botão "Novo lead" vive no cabeçalho do App e na busca global, e o modal nasce
no funil que o App tem guardado. O `rememberFunnel` só roda quando alguém clica
numa aba de funil, então abrir `/<academia>/pipeline?funil=f2` num link ou dar
F5 ali deixaria o quadro em `f2` e o cadastro rápido em `f1`. Hoje os dois nunca
divergem, e não podem passar a divergir agora.

Antes (`src/App.jsx:1332-1334`, logo abaixo do `leadProfileValue`):

```js
  // Endereço dos itens do menu, do menu da conta e do aviso de mensalidade.
  // Sai da academia da sessão (claim), nunca da barra de endereço.
  const menuHref = (screen, extra) => hrefFor(sessionTenant, screen, extra);
```

Depois:

```js
  // Endereço dos itens do menu, do menu da conta e do aviso de mensalidade.
  // Sai da academia da sessão (claim), nunca da barra de endereço.
  const menuHref = (screen, extra) => hrefFor(sessionTenant, screen, extra);
  // Funil em que o cadastro rápido nasce: o do endereço quando a tela de lista
  // traz um, e senão o último funil usado. O "Novo lead" do cabeçalho e o da
  // busca global aparecem em qualquer tela, e fora das telas de lista o
  // endereço não tem funil, então ali vale o guardado, como sempre valeu.
  const entryFunnelId = funnelFromSearch(resolvedTab, location.search, { funis: funnels, funilPadrao: selectedFunnelId });
```

Antes (`src/App.jsx:1758`):

```js
          selectedFunnelId={selectedFunnelId}
```

Depois:

```js
          selectedFunnelId={entryFunnelId}
```

No bloco de imports, acrescentar:

```js
import { funnelFromSearch } from './lib/screenParams.js';
```

- [ ] **Step 5: Verificar e commitar**

O `visibleCount` das duas telas continua onde está, e continua fora do endereço:

```bash
/usr/bin/grep -nE "setRespFilter|setOnlyOverdue|setStatusFilters|setConsultantFilters|location\.search" src/views/KanbanView.jsx src/views/ClientsView.jsx
# Esperado: nada.
/usr/bin/grep -nE "visibleCount" src/views/KanbanView.jsx src/views/ClientsView.jsx
# Esperado: só as linhas de useState e de slice. O "carregar mais" é posição de
# leitura, não escolha, e é do PR 2.
```

```bash
npx vitest run
# Esperado: Test Files  107 passed (107) · Tests  2189 passed (2189)
npm run lint
# Esperado: ✖ 1 problem (0 errors, 1 warning)
git add -A && git commit -m "$(cat <<'MSGEOF'
feat: funil, responsavel, atraso e situacao do Pipeline e de Clientes no endereço

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSGEOF
)"
```

---

### Task 5: Todos os leads e Meta diária

**Files:**
- Modify: `src/views/LeadsView.jsx` (assinatura na linha 25; estado nas linhas 40-55; `toggle*` nas linhas 102-103; `clearAllFilters` na linha 110; chips de filtro ativo nas linhas 148-149; abas de funil na linha 160; interruptores da bolha nas linhas 217 e 226)
- Modify: `src/views/DailyGoalView.jsx` (estado na linha 948; chips nas linhas 1698-1718)
- Test: `src/lib/__tests__/screenParams.test.js` (modificar)

Em Todos os leads morre o ajuste de estado no render que limpava a fase ao trocar de funil: agora o clique no funil escreve `funil` e apaga `fase` na mesma navegação. E a fase deixa de ser guardada como texto no endereço: viaja como código (id da etapa, ou `venda` e `perda`), então renomear a etapa em Configurações não quebra um link guardado.

Na Meta só a categoria entra. A visão Equipe (`view`) fica em `useState`, por decisão 6 do Johnny.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao fim de `src/lib/__tests__/screenParams.test.js`:

```js
describe('contrato do contexto de Todos os leads e da Meta', () => {
  // A tela passa as etapas como FUNÇÃO do funil escolhido, porque a lista de
  // etapas depende do funil e o funil é lido antes da fase na mesma passada.
  const porFunil = { f1: [{ id: 's1', name: 'Novo' }], f2: [{ id: 's9', name: 'Cobrança' }] };
  const lea = {
    users, funis, situacoes, podeResp: true, respPadrao: [], funilPadrao: 'f1',
    etapas: (fid) => porFunil[fid] || [],
  };

  it('a fase é peneirada contra as etapas do funil que veio na mesma query', () => {
    expect(ler('leads', '?funil=f1&fase=s1', lea).stage).toEqual(['Novo']);
    expect(ler('leads', '?funil=f2&fase=s1', lea).stage).toEqual([]);
    expect(ler('leads', '?funil=f2&fase=s9', lea).stage).toEqual(['Cobrança']);
  });

  it('venda e perda valem em qualquer funil, porque não são etapa cadastrada', () => {
    expect(ler('leads', `?funil=f2&fase=${FASE_VENDA},${FASE_PERDA}`, lea).stage).toEqual(['Venda', 'Perda']);
  });

  it('trocar de funil e limpar a fase cabem numa navegação só', () => {
    const antes = ler('leads', '?funil=f1&fase=s1&atraso=1', lea);
    expect(montar('leads', { ...antes, funnel: 'f2', stage: [] }, lea)).toBe('?funil=f2&atraso=1');
  });

  it('fase de um funil que não é mais o escolhido some sozinha na montagem', () => {
    expect(montar('leads', { funnel: 'f2', stage: ['Novo'], resp: [], overdue: false, hot: false }, lea)).toBe('?funil=f2');
  });

  it('quente e atraso convivem com a fase, na ordem da tabela', () => {
    expect(montar('leads', { funnel: 'f1', stage: ['Novo'], resp: ['u1'], overdue: true, hot: true }, lea))
      .toBe('?funil=f1&fase=s1&resp=u1&atraso=1&quente=1');
  });

  it('o responsável de Todos os leads também é de gestor', () => {
    const consultor = { ...lea, podeResp: false };
    expect(ler('leads', '?resp=u1', consultor).resp).toEqual([]);
  });

  it('etapa cadastrada com o nome de uma coluna terminal não rouba o código dela', () => {
    // O catálogo de etapas é livre, e a tela já trata as duas como a mesma
    // opção (o filtro guarda o NOME). No endereço o nome vira sempre o código
    // curto, que não some quando a etapa é apagada.
    const comVenda = { ...lea, etapas: () => [{ id: 'sX', name: 'Venda' }] };
    expect(montar('leads', { funnel: 'f1', stage: ['Venda'], resp: [], overdue: false, hot: false }, comVenda))
      .toBe(`?funil=f1&fase=${FASE_VENDA}`);
    expect(ler('leads', `?funil=f1&fase=${FASE_VENDA}`, comVenda).stage).toEqual(['Venda']);
    expect(ler('leads', '?funil=f1&fase=sX', comVenda).stage).toEqual(['Venda']);
  });

  it('a categoria da Meta cobre as sete do dia, e cada uma volta pelo mesmo código', () => {
    const sete = ['novo_24h', 'visita_hoje', 'aula_hoje', 'contato_hoje', 'atrasado', 'renovacao', 'vencido'];
    for (const slug of sete) {
      expect(ler('dailyGoal', `?cat=${slug}`, {}).cat, slug).toBe(slug);
      expect(volta('dailyGoal', `?cat=${slug}`, {}), slug).toBe(`?cat=${slug}`);
    }
  });

  it('a visão Equipe da Meta ficou fora desta entrega e não tem parâmetro', () => {
    expect(SCREEN_PARAM_NAMES.dailyGoal).toEqual(['cat']);
    expect(ler('dailyGoal', '?visao=equipe&dia=14', {})).toEqual({ cat: 'all' });
  });
});
```

- [ ] **Step 2: Todos os leads**

Antes (`src/views/LeadsView.jsx:39-55`):

```js
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilters, setStatusFilters] = useState([]);
  const [consultantFilters, setConsultantFilters] = useState([]);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [hotOnly, setHotOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);

  const defaultFunnelId = useMemo(() => getDefaultFunnel(funnels)?.id || null, [funnels]);

  // Ao trocar de funil, limpa o filtro de fase (as etapas mudam): ajuste de
  // estado durante o render (padrão oficial do React), no lugar de um effect.
  const [prevFunnelId, setPrevFunnelId] = useState(selectedFunnelId);
  if (selectedFunnelId !== prevFunnelId) {
    setPrevFunnelId(selectedFunnelId);
    setStatusFilters([]);
  }
```

Depois:

```js
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);

  const defaultFunnelId = useMemo(() => getDefaultFunnel(funnels)?.id || null, [funnels]);

  // Funil, fase, responsável, atraso e quente vêm do endereço. A fase viaja
  // como CÓDIGO (o id da etapa, mais venda e perda nas duas colunas terminais)
  // e a tela recebe o nome, que é o que ela guarda: renomear a etapa em
  // Configurações não quebra um link guardado. As etapas vão como função do
  // funil, porque o funil é lido antes da fase na mesma passada, e é isso que
  // apaga sozinha a fase de um funil que deixou de ser o escolhido.
  const paramsCtx = useMemo(() => ({
    users: usersList,
    funis: funnels,
    funilPadrao: savedFunnelId,
    podeResp: isAdmin,
    respPadrao: [],
    etapas: (fid) => (statuses || []).filter(s => isItemInFunnel(s, fid, defaultFunnelId)),
  }), [usersList, funnels, savedFunnelId, isAdmin, statuses, defaultFunnelId]);
  const [{ funnel, stage: statusFilters, resp: consultantFilters, overdue: overdueOnly, hot: hotOnly }, setParams] =
    useScreenParams('leads', paramsCtx);
  const selectedFunnelId = funnel;

  // Trocar de funil guarda a escolha no navegador e limpa a fase na mesma
  // navegação: as etapas do funil novo são outras.
  const pickFunnel = (id) => { rememberFunnel(id); setParams({ funnel: id, stage: [] }); };
```

A assinatura da função também muda, para o nome do funil do endereço não brigar com o prop.

Antes (`src/views/LeadsView.jsx:25`):

```js
function LeadsView({ interactions, appUser, statuses, usersList, funnels, selectedFunnelId, setSelectedFunnelId, db }) {
```

Depois:

```js
function LeadsView({ interactions, appUser, statuses, usersList, funnels, selectedFunnelId: savedFunnelId, setSelectedFunnelId: rememberFunnel, db }) {
```

Antes (`src/views/LeadsView.jsx:102-106`):

```js
  const toggleStatus = (s) => setStatusFilters(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleConsultant = (id) => setConsultantFilters(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const statusesForFunnel = (statuses || []).filter(s => isItemInFunnel(s, selectedFunnelId, defaultFunnelId));
  const phaseOptions = [...statusesForFunnel.map(s => s.name), 'Venda', 'Perda'];
```

Depois:

```js
  const toggleStatus = (s) => setParams((v) => ({ stage: v.stage.includes(s) ? v.stage.filter(x => x !== s) : [...v.stage, s] }));
  const toggleConsultant = (id) => setParams((v) => ({ resp: v.resp.includes(id) ? v.resp.filter(x => x !== id) : [...v.resp, id] }));

  const statusesForFunnel = (statuses || []).filter(s => isItemInFunnel(s, selectedFunnelId, defaultFunnelId));
  const phaseOptions = [...statusesForFunnel.map(s => s.name), 'Venda', 'Perda'];
```

Antes (`src/views/LeadsView.jsx:110-112`):

```js
  const filterCount = statusFilters.length + consultantFilters.length + (overdueOnly ? 1 : 0) + (hotOnly ? 1 : 0);
  const hasActiveFilters = filterCount > 0;
  const clearAllFilters = () => { setStatusFilters([]); setConsultantFilters([]); setOverdueOnly(false); setHotOnly(false); };
```

Depois:

```js
  const filterCount = statusFilters.length + consultantFilters.length + (overdueOnly ? 1 : 0) + (hotOnly ? 1 : 0);
  const hasActiveFilters = filterCount > 0;
  const clearAllFilters = () => setParams({ stage: [], resp: [], overdue: false, hot: false });
```

Antes (`src/views/LeadsView.jsx:160`):

```js
        <FunnelTabs funnels={funnels} counts={funnelCounts} selectedId={selectedFunnelId} onSelect={setSelectedFunnelId} />
```

Depois:

```js
        <FunnelTabs funnels={funnels} counts={funnelCounts} selectedId={selectedFunnelId} onSelect={pickFunnel} />
```

Antes (`src/views/LeadsView.jsx:148-149`, os chips de filtro ativo que somem com um clique no X):

```js
  if (hotOnly) activeChips.push({ key: 'hot', label: '🔥 Hot leads', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', remove: () => setHotOnly(false) });
  if (overdueOnly) activeChips.push({ key: 'overdue', label: 'Em atraso', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', remove: () => setOverdueOnly(false) });
```

Depois:

```js
  if (hotOnly) activeChips.push({ key: 'hot', label: '🔥 Hot leads', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', remove: () => setParams({ hot: false }) });
  if (overdueOnly) activeChips.push({ key: 'overdue', label: 'Em atraso', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', remove: () => setParams({ overdue: false }) });
```

Antes (`src/views/LeadsView.jsx:217` e `226`, os dois interruptores da bolha):

```js
                    onClick={() => setHotOnly(v => !v)}
```

```js
                    onClick={() => setOverdueOnly(v => !v)}
```

Depois:

```js
                    onClick={() => setParams((v) => ({ hot: !v.hot }))}
```

```js
                    onClick={() => setParams((v) => ({ overdue: !v.overdue }))}
```

No import do topo, acrescentar o hook:

```js
import { useScreenParams } from '../hooks/useScreenParams.js';
```

- [ ] **Step 3: A Meta diária**

Antes (`src/views/DailyGoalView.jsx:946-949`):

```js
function DailyGoalView({ leads, interactions, appUser, statuses, db, usersList, listenersActive = true }) {
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('mine'); // 'mine' | 'team' (team = só gestor)
```

Depois:

```js
function DailyGoalView({ leads, interactions, appUser, statuses, db, usersList, listenersActive = true }) {
  const toast = useToast();
  // A categoria aberta vem do endereço: F5 mantém e o link abre na mesma
  // categoria. A visão Equipe ficou fora desta entrega e continua em estado.
  const paramsCtx = useMemo(() => ({}), []);
  const [{ cat: filter }, setParams] = useScreenParams('dailyGoal', paramsCtx);
  const setFilter = (v) => setParams({ cat: v });
  const [view, setView] = useState('mine'); // 'mine' | 'team' (team = só gestor)
```

O resto da tela não muda: as sete chamadas de `setFilter` das linhas 1698 a 1718 continuam escritas do mesmo jeito.

No import do topo, acrescentar o hook:

```js
import { useScreenParams } from '../hooks/useScreenParams.js';
```

- [ ] **Step 4: Verificar e commitar**

O ajuste de estado no render tem que ter sumido de Todos os leads:

```bash
/usr/bin/grep -n "prevFunnelId" src/views/LeadsView.jsx
# Esperado: nada.
```

```bash
npx vitest run
# Esperado: Test Files  107 passed (107) · Tests  2198 passed (2198)
npm run lint
# Esperado: ✖ 1 problem (0 errors, 1 warning)
git add -A && git commit -m "$(cat <<'MSGEOF'
feat: filtros de Todos os leads e a categoria da Meta diária no endereço

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSGEOF
)"
```

---

### Task 6: Aulas e Visitas

**Files:**
- Modify: `src/views/AppointmentTrackingView.jsx` (estado nas linhas 149-158; `pickDayTab`, `applyRange`, `clearRange` e `toggleResp` nas linhas 351-378; os quatro botões da bolha que mexem em filtro, nas linhas 532, 544, 591 e 604)
- Test: `src/lib/__tests__/screenParams.test.js` (modificar)

A mesma tela serve Aulas (`aula_experimental`) e Visitas (`visita`), e as duas têm endereço próprio, então o mesmo componente lê tabelas diferentes: `aulas` tem `prof` e o atalho "Em andamento", `visitas` não.

O par `de`/`ate` é o único filtro desta tela que muda consulta de verdade (entra na janela do `usePagedLeads`). A validação que hoje mora no `applyRange` (data válida, fim depois do início, teto de 30 dias) passa a valer também para o que vem do endereço, no módulo puro: um período de 40 dias colado na barra abre a tela no atalho de dia padrão, sem erro na tela e sem janela enorme sobre a coleção de leads.

O botão de filtros inteiro é de gestor nesta tela (`isAdmin` na linha 503), e é ele que carrega responsável e professor. Por isso os dois parâmetros são ignorados para consultor.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao fim de `src/lib/__tests__/screenParams.test.js`:

```js
describe('contrato do contexto de Aulas e Visitas', () => {
  const aulas = { users, podeResp: true, respPadrao: [], professores: [{ id: 'p1' }, { id: 'p2' }], temAndamento: true };
  const visitas = { users, podeResp: true, respPadrao: [], temAndamento: false };

  it('as duas telas leem tabelas diferentes: professor e em andamento só em Aulas', () => {
    expect(SCREEN_PARAM_NAMES.aulas).toContain('prof');
    expect(SCREEN_PARAM_NAMES.visitas).not.toContain('prof');
  });

  it('o atalho de dia padrão é hoje e não é escrito', () => {
    expect(ler('visitas', '', visitas)).toEqual({ day: 'today', de: null, ate: null, resp: [] });
    expect(montar('visitas', ler('visitas', '', visitas), visitas)).toBe('');
  });

  it('escolher um dia apaga o período, e escolher período apaga o dia', () => {
    const comPeriodo = ler('aulas', '?de=2026-09-01&ate=2026-09-10', aulas);
    expect(montar('aulas', { ...comPeriodo, day: 'yesterday', de: null, ate: null }, aulas)).toBe('?dia=ontem');
    const comDia = ler('aulas', '?dia=ontem', aulas);
    expect(montar('aulas', { ...comDia, day: null, de: '2026-09-01', ate: '2026-09-10' }, aulas)).toBe('?de=2026-09-01&ate=2026-09-10');
  });

  it('limpar o período volta para hoje e deixa o endereço limpo', () => {
    const v = ler('aulas', '?de=2026-09-01&ate=2026-09-10&resp=u1', aulas);
    expect(montar('aulas', { ...v, de: null, ate: null, day: 'today' }, aulas)).toBe('?resp=u1');
  });

  it('só de, só ate e data que não existe caem fora juntos', () => {
    for (const q of ['?de=2026-09-01', '?ate=2026-09-01', '?de=2026-02-30&ate=2026-03-01']) {
      const v = ler('aulas', q, aulas);
      expect([v.de, v.ate, v.day], q).toEqual([null, null, 'today']);
    }
  });

  it('período de exatamente 30 dias passa e o de 40 não', () => {
    expect(ler('aulas', '?de=2026-09-01&ate=2026-10-01', aulas).ate).toBe('2026-10-01');
    expect(ler('aulas', '?de=2026-09-01&ate=2026-10-11', aulas).ate).toBeNull();
  });

  it('em andamento sobrevive em Aulas e vira hoje em Visitas', () => {
    expect(ler('aulas', '?dia=andamento', aulas).day).toBe('ongoing');
    expect(ler('visitas', '?dia=andamento', visitas).day).toBe('today');
  });

  it('o consultor não é recortado por responsável nem por professor', () => {
    const consultor = { ...aulas, podeResp: false };
    const v = ler('aulas', '?resp=u1&prof=p1&dia=ontem', consultor);
    expect([v.resp, v.prof, v.day]).toEqual([[], [], 'yesterday']);
    expect(montar('aulas', { ...v, resp: ['u1'], prof: ['p1'] }, consultor)).toBe('?dia=ontem');
  });

  it('professor e responsável juntos, na ordem da tabela', () => {
    expect(montar('aulas', { day: 'today', de: null, ate: null, resp: ['u1'], prof: ['p1', SOLO_TRAINING] }, aulas))
      .toBe(`?resp=u1&prof=p1,${SOLO_TRAINING}`);
  });

  it('professor que saiu do catálogo some do filtro', () => {
    expect(ler('aulas', '?prof=p1,apagado', aulas).prof).toEqual(['p1']);
  });
});
```

- [ ] **Step 2: A tela**

Antes (`src/views/AppointmentTrackingView.jsx:148-159`):

```js
  // Atalho de dia e período personalizado são mutuamente exclusivos.
  const [dayTab, setDayTab] = useState('today'); // 'today' | 'yesterday' | 'tomorrow' | null
  const [range, setRange] = useState(null); // { start: Date, end: Date } | null
  const [rangeOpen, setRangeOpen] = useState(false);
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [rangeErr, setRangeErr] = useState('');
  const [respFilter, setRespFilter] = useState([]); // vazio = toda a equipe
  const [profFilter, setProfFilter] = useState([]); // ids de professor + SOLO_TRAINING (só Aulas)
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);
```

Depois:

```js
  // Atalho de dia, período, responsável e professor vêm do endereço. O atalho
  // de dia e o período continuam mutuamente exclusivos, e o período ganha:
  // período torto (data que não existe, fim antes do início, mais de 30 dias,
  // metade do par) cai fora inteiro e a tela abre no atalho padrão, sem erro.
  // O botão de filtros é de gestor, então responsável e professor num link
  // aberto por consultor são ignorados.
  const paramsCtx = useMemo(() => ({
    users: usersList,
    podeResp: isAdmin,
    respPadrao: [],
    professores,
    temAndamento: isAula,
  }), [usersList, isAdmin, professores, isAula]);
  const [{ day: dayTab, de, ate, resp: respFilter, prof: profFilter }, setParams] =
    useScreenParams(isAula ? 'aulas' : 'visitas', paramsCtx);
  // A tela trabalha com Date; o endereço guarda AAAA-MM-DD.
  const range = useMemo(
    () => (de && ate ? { start: fromDateInput(de), end: fromDateInput(ate) } : null),
    [de, ate],
  );
  const [rangeOpen, setRangeOpen] = useState(false);
  // Rascunho dos dois campos do popover. Começa com o período do endereço só
  // como semente: quem digita manda, e o filtro de verdade é o do endereço.
  const [draftStart, setDraftStart] = useState(() => de || '');
  const [draftEnd, setDraftEnd] = useState(() => ate || '');
  const [rangeErr, setRangeErr] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);
```

Antes (`src/views/AppointmentTrackingView.jsx:353-378`):

```js
  const pickDayTab = (id) => {
    setDayTab(id);
    setRange(null);
  };

  const applyRange = () => {
    const start = fromDateInput(draftStart);
    const end = fromDateInput(draftEnd);
    if (!start || !end) { setRangeErr('Informe início e fim.'); return; }
    if (end.getTime() < start.getTime()) { setRangeErr('O fim precisa ser depois do início.'); return; }
    if ((end.getTime() - start.getTime()) / DAY_MS > 30) { setRangeErr('Período máximo de 30 dias.'); return; }
    setRangeErr('');
    setRange({ start, end });
    setDayTab(null);
    setRangeOpen(false);
  };

  const clearRange = () => {
    setDraftStart('');
    setDraftEnd('');
    setRangeErr('');
    setRange(null);
    if (!dayTab) setDayTab('today');
  };

  const toggleResp = (id) => {
    setRespFilter(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };
```

Depois:

```js
  const pickDayTab = (id) => setParams({ day: id, de: null, ate: null });

  // As três recusas continuam aparecendo no popover, com a mesma mensagem: é
  // aqui que a pessoa digita, e o aviso é o que ensina o limite. O que vem
  // pelo endereço não avisa nada, só cai no padrão.
  const applyRange = () => {
    const start = fromDateInput(draftStart);
    const end = fromDateInput(draftEnd);
    if (!start || !end) { setRangeErr('Informe início e fim.'); return; }
    if (end.getTime() < start.getTime()) { setRangeErr('O fim precisa ser depois do início.'); return; }
    if ((end.getTime() - start.getTime()) / DAY_MS > 30) { setRangeErr('Período máximo de 30 dias.'); return; }
    setRangeErr('');
    setRangeOpen(false);
    setParams({ de: draftStart, ate: draftEnd, day: null });
  };

  const clearRange = () => {
    setDraftStart('');
    setDraftEnd('');
    setRangeErr('');
    setParams({ de: null, ate: null, day: 'today' });
  };

  const toggleResp = (id) => {
    setParams((v) => ({ resp: v.resp.includes(id) ? v.resp.filter(x => x !== id) : [...v.resp, id] }));
  };
```

Faltam os quatro botões da bolha de filtros que mexem em estado de filtro. São quatro pontos concretos, não uma busca para fazer na hora, e o primeiro mexe nos dois filtros de uma vez.

Antes (`src/views/AppointmentTrackingView.jsx:532`, o "Limpar" da bolha):

```js
                      onClick={() => { setRespFilter([]); setProfFilter([]); }}
```

Depois:

```js
                      onClick={() => setParams({ resp: [], prof: [] })}
```

Antes (`src/views/AppointmentTrackingView.jsx:544`, o "Toda a equipe"):

```js
                      onClick={() => setRespFilter([])}
```

Depois:

```js
                      onClick={() => setParams({ resp: [] })}
```

Antes (`src/views/AppointmentTrackingView.jsx:591`, cada professor do catálogo):

```js
                            onClick={() => setProfFilter(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
```

Depois:

```js
                            onClick={() => setParams((v) => ({ prof: v.prof.includes(p.id) ? v.prof.filter(x => x !== p.id) : [...v.prof, p.id] }))}
```

Antes (`src/views/AppointmentTrackingView.jsx:604`, o "Treina sozinho"):

```js
                        onClick={() => setProfFilter(prev => prev.includes(SOLO_TRAINING) ? prev.filter(x => x !== SOLO_TRAINING) : [...prev, SOLO_TRAINING])}
```

Depois:

```js
                        onClick={() => setParams((v) => ({ prof: v.prof.includes(SOLO_TRAINING) ? v.prof.filter(x => x !== SOLO_TRAINING) : [...v.prof, SOLO_TRAINING] }))}
```

Conferir que não sobrou nenhum:

```bash
/usr/bin/grep -n "setProfFilter\|setRespFilter\|setDayTab\|setRange(" src/views/AppointmentTrackingView.jsx
# Esperado: nada. O setRangeOpen (o popover abre e fecha) continua, e não é
# filtro: ele não muda o que a lista mostra.
```

No import do topo, acrescentar o hook:

```js
import { useScreenParams } from '../hooks/useScreenParams.js';
```

- [ ] **Step 3: Verificar e commitar**

```bash
npx vitest run
# Esperado: Test Files  107 passed (107) · Tests  2208 passed (2208)
npm run lint
# Esperado: ✖ 1 problem (0 errors, 1 warning)
git add -A && git commit -m "$(cat <<'MSGEOF'
feat: dia, período, responsável e professor de Aulas e Visitas no endereço

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSGEOF
)"
```

---

### Task 7: Configurações por seção e ficha por aba

**Files:**
- Modify: `src/App.jsx` (`screenState` na linha 199; `openGoalSettings` nas linhas 1335-1343; `LeadProfileRoute` nas linhas 1687-1701; `SettingsView` na linha 1735)
- Modify: `src/views/settings/SettingsView.jsx` (LEGACY nas linhas 34-47; assinatura na linha 49; estado nas linhas 66-67; `goTo` nas linhas 75-78; `canImport` na linha 92; trilho na linha 105 e corpo na linha 179)
- Modify: `src/views/LeadProfileView.jsx` (assinatura na linha 115; estado na linha 152; link do aviso na linha 881; `Tabs` na linha 1386; botão Agendar na linha 1579)
- Modify: `src/views/LeadProfileRoute.jsx` (assinatura na linha 84; repasse na linha 121)
- Test: `src/lib/__tests__/routes.decision.test.js` (modificar)

Esta é a tarefa que conserta um defeito antigo: hoje a seção das Configurações é lida UMA vez, no inicializador do `useState`, a partir de `location.state.secao`. Com a tela já aberta, navegar de novo com outra seção não troca nada, e o próprio App documenta isso na linha 1338. Com a seção no caminho, o "Configurar agora" da novidade passa a funcionar com a tela aberta.

As duas sub-telas navegam com **replace**: na ficha, push faria o Voltar andar entre abas em vez de voltar para a lista.

Nenhuma das duas entra em key: `screenKey` já ignora o `rest` (travado por teste na T1), a key do `LeadProfileRoute` no App continua sendo só o id, e a do `LeadProfileView` dentro dele continua sendo `lead.id`. Trocar de aba não reabre a assinatura da linha do tempo nem refaz o `getDocs` da coleção inteira das Configurações.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao bloco `describe('sub-tela na decisão de rota', ...)` de `src/lib/__tests__/routes.decision.test.js`:

```js
  it('a seção e a aba não trocam a chave da tela, então nada remonta', () => {
    const chaves = [`/${T}/configuracoes`, `/${T}/configuracoes/equipe`, `/${T}/configuracoes/catalogos`];
    for (const p of chaves) expect(screenKey(parseAppPath(p)), p).toBe('settings');
    const daFicha = [`/${T}/ficha/AbC`, `/${T}/ficha/AbC/crm`, `/${T}/ficha/AbC/contratos`];
    for (const p of daFicha) expect(screenKey(parseAppPath(p)), p).toBe('ficha:AbC');
  });

  it('a aba da ficha sobrevive ao mascaramento do id no Sentry', () => {
    expect(routeTemplate(`/${T}/ficha/AbC/indicacoes`)).toBe('/:tenant/ficha/:leadId');
  });

  it('o título da aba do navegador continua sem a sub-tela e sem nome de gente', () => {
    expect(documentTitle({ screen: 'settings', tenantName: 'STRONIX' })).toBe('Configurações · STRONIX · STRONILEAD');
    expect(documentTitle({ screen: 'ficha', tenantName: 'STRONIX' })).toBe('Ficha · STRONIX · STRONILEAD');
  });

  it('a academia corrigida leva a aba da ficha junto', () => {
    expect(decide('/ficha/AbC/contratos', consultor)).toEqual(
      casa(`/${T}/ficha/AbC/contratos`, { screen: 'ficha', leadId: 'AbC', sub: 'contratos' }),
    );
  });

  it('o item do menu aponta para a tela-mãe, e o endereço com seção continua sendo a mesma tela', () => {
    // O item do menu é um AppLink para /configuracoes. Quem está em
    // /configuracoes/catalogos continua na tela `settings`, então o item fica
    // aceso (activeTab) e o clique nele é a volta ao estado zero da tela.
    for (const p of [`/${T}/configuracoes`, `/${T}/configuracoes/catalogos`]) {
      expect(parseAppPath(p).screen, p).toBe('settings');
    }
  });
```

Acrescentar, no mesmo arquivo, um bloco sobre o que continua valendo na query dos redirects (decisão 3 da montagem):

```js
describe('query nos redirects, decidido de propósito', () => {
  it('a correção de academia leva o filtro junto quando a tela continua a mesma', () => {
    expect(decide('/outra/clientes', admin, { search: '?sit=ativo&resp=u1' })).toEqual(
      casa(`/${T}/clientes?sit=ativo&resp=u1`, { screen: 'clientes' }),
    );
    expect(decide('/pipeline', consultor, { search: '?funil=f2&atraso=1' })).toEqual(
      casa(`/${T}/pipeline?funil=f2&atraso=1`, { screen: 'kanban' }),
    );
  });

  it('quem cai na tela inicial por trava ou por endereço desconhecido perde a query', () => {
    expect(decide(`/${T}/configuracoes`, consultor, { search: '?sit=ativo' })).toEqual(casa(`/${T}`, { screen: 'dashboard' }, 'so-gestor'));
    expect(decide(`/${T}/visao-geral/xyz`, consultor, { search: '?mes=2026-08' })).toEqual(casa(`/${T}`, { screen: 'dashboard' }, 'nao-encontrada'));
  });

  it('a ficha de outra academia vira a tela inicial e o filtro que sobra é inofensivo, porque tudo é saneado contra a sessão', () => {
    expect(decide('/outra/ficha/AbC', consultor, { search: '?pessoa=u-de-outra' })).toEqual(
      casa(`/${T}?pessoa=u-de-outra`, { screen: 'dashboard' }),
    );
  });
});
```

- [ ] **Step 2: A seção no App**

Antes (`src/App.jsx:199`):

```js
  const { fichaOpen, profileLeadId, activeTab, resolvedTab, superTab } = screenState(shown, location.state, appUser);
```

Depois:

```js
  // `sub` é a seção das Configurações ou a aba da ficha, já com o padrão da
  // tela quando o endereço não traz segmento. Ela NÃO entra na screenKey: o
  // AppErrorBoundary e a rolagem não podem remontar a cada troca de seção.
  const { fichaOpen, profileLeadId, activeTab, resolvedTab, superTab, sub } = screenState(shown, location.state, appUser);
```

Antes (`src/App.jsx:1335-1343`):

```js
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

Depois:

```js
  // Trocar de seção das Configurações ou de aba da ficha é trocar o endereço,
  // com replace: sub-tela não é tela, então o voltar continua levando à tela
  // anterior, e na ficha ele continua levando à lista. O state vai explícito
  // porque o navigate não o repassa sozinho, e é nele que vive a origem da
  // ficha.
  const goToSub = (screen, subId, extra) => {
    const href = hrefFor(sessionTenant, screen, { sub: subId, ...extra });
    if (href) navigate(href, { replace: true, state: location.state });
  };
  // "Configurar agora" da novidade abre Configurações já em Metas e ritmo, e
  // agora troca a seção com a tela já aberta, porque a seção está no endereço.
  const openGoalSettings = () => {
    goToSub('settings', 'pace');
    closeDrawer();
  };
```

Antes (`src/App.jsx:1735`):

```js
              {activeTab === 'settings' && isAdminUser(appUser) && <SettingsView initialTab={location.state?.secao ?? 'users'} sources={sources} statuses={statuses} db={db} usersList={usersList} appUser={appUser} tags={tags} lossReasons={lossReasons} dores={dores} funnels={funnels} modalities={modalities} planos={planos} trialClassOptions={trialClassOptions} units={units} metaWeekdays={metaWeekdays} />}
```

Depois:

```js
              {activeTab === 'settings' && isAdminUser(appUser) && <SettingsView section={sub} onSection={(id) => goToSub('settings', id)} sources={sources} statuses={statuses} db={db} usersList={usersList} appUser={appUser} tags={tags} lossReasons={lossReasons} dores={dores} funnels={funnels} modalities={modalities} planos={planos} trialClassOptions={trialClassOptions} units={units} metaWeekdays={metaWeekdays} />}
```

Antes (`src/App.jsx:1688-1691`):

```js
              <LeadProfileRoute
                key={profileLeadId ?? 'sem-id'}
                leadId={profileLeadId}
                tenantId={appUser.tenantId}
```

Depois:

```js
              <LeadProfileRoute
                key={profileLeadId ?? 'sem-id'}
                leadId={profileLeadId}
                tab={sub}
                onTab={(id) => goToSub('ficha', id, { leadId: profileLeadId })}
                tenantId={appUser.tenantId}
```

- [ ] **Step 3: SettingsView recebe a seção por prop**

Antes (`src/views/settings/SettingsView.jsx:33-46`):

```js
// Mapa do tab antigo (App.jsx ainda navega por ele) para o destino novo.
const LEGACY_TABS = {
  users: 'team',
  transfer: 'transfer',
  general: 'pace',
  statuses: 'funnels',
  tags: 'catalogs',
  sources: 'catalogs',
  plans: 'catalogs',
  lossReasons: 'catalogs',
  dores: 'catalogs'
};

const LEGACY_FOCUS = { tags: 'tags', sources: 'sources', plans: 'plans', lossReasons: 'loss', dores: 'dores' };
```

Depois: apagar os dois mapas. O App não navega mais por nome antigo de aba, e a seção vem do endereço.

Antes (`src/views/settings/SettingsView.jsx:48-50`):

```js
function SettingsView({
  initialTab, db, statuses, sources, usersList, appUser, tags, lossReasons,
  dores, funnels, modalities, planos, trialClassOptions, units, metaWeekdays
}) {
```

Depois:

```js
function SettingsView({
  section, onSection, db, statuses, sources, usersList, appUser, tags, lossReasons,
  dores, funnels, modalities, planos, trialClassOptions, units, metaWeekdays
}) {
```

Antes (`src/views/settings/SettingsView.jsx:66-79`):

```js
  const [section, setSection] = useState(() => LEGACY_TABS[initialTab] || 'overview');
  const [focus, setFocus] = useState(() => LEGACY_FOCUS[initialTab] || null);

  const setup = useMemo(() => buildSetupState({
    funnels, statuses, sources, modalities, planos, lossReasons,
    metaWeekdays, slaOverdueDays, usersList,
  }), [funnels, statuses, sources, modalities, planos, lossReasons, metaWeekdays, slaOverdueDays, usersList]);

  // Atalhos da Visão geral: trocam a seção e, quando dá, apontam o item citado.
  const goTo = useCallback((next, focusId = null) => {
    setSection(next);
    setFocus(focusId);
  }, []);
```

Depois:

```js
  // A seção vem do endereço (/configuracoes/<secao>), então trocar de seção é
  // navegar. Antes ela era lida uma vez só no inicializador do useState, e por
  // isso o "Configurar agora" de uma novidade não trocava a seção com a tela
  // já aberta. O `focus` continua aqui: ele aponta um item dentro da seção, é
  // apagado assim que a seção o usa, e não tem o que fazer num link.
  const [focus, setFocus] = useState(null);

  const setup = useMemo(() => buildSetupState({
    funnels, statuses, sources, modalities, planos, lossReasons,
    metaWeekdays, slaOverdueDays, usersList,
  }), [funnels, statuses, sources, modalities, planos, lossReasons, metaWeekdays, slaOverdueDays, usersList]);

  // Atalhos da Visão geral: trocam a seção e, quando dá, apontam o item citado.
  const goTo = useCallback((next, focusId = null) => {
    setFocus(focusId);
    onSection(next);
  }, [onSection]);
```

Falta a seção que pode não existir para quem abriu o endereço. Hoje Importar clientes é dupla-travada: o item some do trilho quando `canImport` é falso (linha 105) e o corpo dela só desenha com `canImport` (linha 179). Enquanto a seção morava em estado, esse destino era inalcançável. Com a seção no caminho, qualquer gestor pode abrir `/<academia>/configuracoes/importacao` em produção, onde `canImport` exige a sessão assumida do super console, e veria o trilho com o lado direito EM BRANCO: sem aviso, sem redirect e sem tela. A seção efetiva passa a ser derivada, e é ela que manda no trilho e no corpo.

Antes (`src/views/settings/SettingsView.jsx:92`):

```js
  const canImport = Boolean(appUser?.impersonating) || import.meta.env.DEV;
```

Depois:

```js
  const canImport = Boolean(appUser?.impersonating) || import.meta.env.DEV;
  // Seção que a tela realmente desenha. O endereço pede uma seção, mas
  // Importar clientes só existe na sessão assumida do super console: sem ela,
  // /configuracoes/importacao deixaria o lado direito em branco. Cai na seção
  // padrão, do mesmo jeito calado que uma sub-tela desconhecida cai na
  // tela-mãe. O endereço não é reescrito (decisão 16): ele se acerta no
  // primeiro clique do trilho.
  const secao = section === 'import' && !canImport ? 'team' : section;
```

Daqui para baixo, no trilho e no corpo, quem vale é `secao`. São dois pontos: a marca de item aceso do trilho e cada linha `{section === '...' && ...}` do corpo (linhas 155 a 200). Conferir com uma busca:

```bash
/usr/bin/grep -n "section" src/views/settings/SettingsView.jsx
# Esperado: só a prop na assinatura, a linha do `secao` e o `onSection` do
# goTo. Nenhuma comparação solta de `section` sobrando.
```

O resto da tela não muda: o trilho já chama `goTo(item.id)` e o corpo já escolhe por seção.

- [ ] **Step 4: A ficha recebe a aba por prop**

Antes (`src/views/LeadProfileRoute.jsx:84-87`):

```js
export function LeadProfileRoute({
  leadId, tenantId, sessionKey, dataReady, listenersActive,
  db, appUser, statuses, tags, lossReasons, usersList, funnels,
}) {
```

Depois:

```js
export function LeadProfileRoute({
  leadId, tab, onTab, tenantId, sessionKey, dataReady, listenersActive,
  db, appUser, statuses, tags, lossReasons, usersList, funnels,
}) {
```

Antes (`src/views/LeadProfileRoute.jsx:120-124`):

```js
    <LeadProfileView
      key={lead.id}
      lead={lead}
      onBack={goBack}
      onDeleteStart={() => setDeleting(true)}
```

Depois:

```js
    <LeadProfileView
      key={lead.id}
      lead={lead}
      tab={tab}
      onTab={onTab}
      onBack={goBack}
      onDeleteStart={() => setDeleting(true)}
```

A key continua sendo só o id: a aba não pode remontar a ficha, senão trocar de aba reabriria a assinatura da linha do tempo.

Antes (`src/views/LeadProfileView.jsx:115`):

```js
function LeadProfileView({ lead, onBack, onDeleteStart, onDeleteFailed, listenersActive = true, appUser, statuses, tags, lossReasons, usersList, db, funnels }) {
```

Depois:

```js
function LeadProfileView({ lead, tab, onTab, onBack, onDeleteStart, onDeleteFailed, listenersActive = true, appUser, statuses, tags, lossReasons, usersList, db, funnels }) {
```

Antes (`src/views/LeadProfileView.jsx:151-152`):

```js
  // Aba ativa da ficha (timeline | crm | contratos | referrals).
  const [activeProfileTab, setActiveProfileTab] = useState('timeline');
```

Depois: apagar as duas linhas. A aba passa a sair do endereço, e o valor usado é derivado no render, logo abaixo de onde `isClient` já é calculado.

Antes (`src/views/LeadProfileView.jsx:661`):

```js
  const isClient = lead.lifecycleStage === 'cliente' || isLeadConverted(lead);
```

Depois:

```js
  const isClient = lead.lifecycleStage === 'cliente' || isLeadConverted(lead);
  // Aba ativa da ficha, vinda do endereço. A aba Indicações só existe para
  // cliente, então um link dela numa ficha de lead abre a Linha do tempo. Não é
  // redirect de propósito: se a pessoa é cliente só se sabe depois de o
  // documento carregar, e um redirect ali trocaria o endereço toda vez que a
  // ficha demora.
  const activeProfileTab = tab === 'referrals' && !isClient ? 'timeline' : (tab || 'timeline');
```

Antes (`src/views/LeadProfileView.jsx:1386`):

```js
      <Tabs value={activeProfileTab} onValueChange={setActiveProfileTab}>
```

Depois:

```js
      <Tabs value={activeProfileTab} onValueChange={onTab}>
```

Faltam os outros dois pontos que trocavam de aba na mão. Sem eles o identificador deixa de existir: o `no-undef` do `js.configs.recommended` derruba o `npm run lint`, e a ficha lança em runtime ao renderizar.

Antes (`src/views/LeadProfileView.jsx:881`, o link "aba Contratos" do aviso de cliente):

```js
                      <button type="button" onClick={() => setActiveProfileTab('contratos')} className="font-semibold underline underline-offset-2">aba Contratos</button>.
```

Depois:

```js
                      <button type="button" onClick={() => onTab('contratos')} className="font-semibold underline underline-offset-2">aba Contratos</button>.
```

Antes (`src/views/LeadProfileView.jsx:1579`, o botão Agendar dos próximos agendamentos):

```js
                  <Btn kind="soft" size="sm" icon={<Plus size={13} />} onClick={() => { setActiveProfileTab('crm'); setComposerTab('schedule'); }}>Agendar</Btn>
```

Depois:

```js
                  <Btn kind="soft" size="sm" icon={<Plus size={13} />} onClick={() => { onTab('crm'); setComposerTab('schedule'); }}>Agendar</Btn>
```

Os outros usos de `activeProfileTab` (linhas 693, 1394, 1409 e 1418) só LEEM o valor e continuam como estão.

```bash
/usr/bin/grep -n "setActiveProfileTab" src/views/LeadProfileView.jsx
# Esperado: nada.
```

- [ ] **Step 5: Verificar e commitar**

O nome antigo da seção tem que ter sumido do App e da tela:

```bash
/usr/bin/grep -rn "secao\|initialTab\|LEGACY_TABS\|LEGACY_FOCUS\|setActiveProfileTab" src/
# Esperado: nada.
```

```bash
npx vitest run
# Esperado: Test Files  107 passed (107) · Tests  2216 passed (2216)
npm run lint
# Esperado: ✖ 1 problem (0 errors, 1 warning)
git add -A && git commit -m "$(cat <<'MSGEOF'
feat: seção das Configurações e aba da ficha saindo do endereço

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSGEOF
)"
```

---

### Task 8: por que o Voltar da ficha não leva o filtro (nada a construir)

**Files:**
- Modify: `src/lib/routes.js` (comentário do `backTarget`)
- Modify: `src/lib/__tests__/routes.test.js` (bloco "contrato do idx com o react-router instalado")
- Modify: `docs/superpowers/specs/2026-09-23-filtros-no-endereco-design.md` (risco da ficha aberta em outra guia)

A tarefa tinha sido escrita para o `backTarget` devolver a tela de origem com o filtro dela, com o par `from`/`search` viajando no state da navegação, do `LeadLink` ao `LeadProfileRoute`. Foi construída e revertida no mesmo dia, porque o ramo é código morto no app de hoje: state literal só nasce no caminho da ficha (o `openProfile` do `App.jsx` e o `state` do `LeadLink`), sempre num push, e todo push soma 1 no `idx`, então o `backTarget` devolve `'back'` antes de olhar a origem. Os replaces do app não mandam state (`RouteRedirect`, `LeadProfileRoute`), repassam o `location.state` do momento (`useScreenParams`, `goToSub` do `App.jsx`), que na primeira entrada da aba é nulo, ou mandam nulo: é o caso do único replace do `openProfile`, o da mesma ficha já aberta, onde o `profileFrom` é nulo. Em guia nova o documento é outro e não há state nenhum para ler.

**Cuidado ao reabrir isso:** a premissa é convenção do app, não garantia do react-router. Medido na 7.18.4 em 23/09/2026, `h.replace('/x', { from: 'kanban' })` na primeira entrada grava `{"usr":{"from":"kanban"},"key":"...","idx":0}`. Basta um `navigate(x, { replace: true, state: { ... } })` numa primeira entrada, ou um `replace` condicional com objeto literal no state, para o par "tem state, logo dá para voltar" deixar de valer.

O que ficou no lugar da feature:

- o comentário do `backTarget` em `src/lib/routes.js` diz por que a origem não atravessa para a guia nova e que quem garante isso é o app;
- o bloco "contrato do idx com o react-router instalado" do `routes.test.js` registra as duas medições, inclusive a de que a biblioteca aceita state numa entrada de `idx` 0;
- o risco "ficha aberta em outra guia" do spec passou a listar os dois caminhos possíveis, com o preço de cada um, para o Johnny decidir: origem e filtro no endereço da própria ficha, ou memória por academia no navegador, no molde do `savedFunnelKey`.

A trava do lado do app fica com a varredura da Task 9: fora do `openProfile` do `App.jsx`, que ela congela por texto, nenhum `navigate(` de `src/` pode passar replace que não seja `false` escrito junto com state próprio, isto é, state que não seja o `location.state` repassado, o `state` do hook ou nulo. É essa forma, e não só o `replace: true` literal, que derruba a premissa do `backTarget`.

- [ ] **Step 1: Verificar e commitar**

Não há código de feature aqui, e a suíte ganha um teste: o do contrato do idx com o react-router instalado.

```bash
npx vitest run
# Esperado: Test Files  108 passed (108) · Tests  2221 passed (2221)
npm run lint
# Esperado: ✖ 1 problem (0 errors, 1 warning)
git add -A && git commit -m "$(cat <<'MSGEOF'
docs: registrar por que o Voltar da ficha não leva o filtro para a guia nova

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSGEOF
)"
```

---

### Task 9: varredura, documentação, verificação final e corpo do PR

**Files:**
- Create: `src/lib/__tests__/filtrosNoEndereco.sweep.test.js`
- Modify: `src/lib/__tests__/sentryScrub.test.js` (a query de filtro)
- Modify: `CLAUDE.md` (seção "Endereço de cada tela")
- Modify: `docs/superpowers/specs/2026-09-23-filtros-no-endereco-design.md`
- Create: `/private/tmp/claude-501/-Users-johnnybittencourt-STRONIX-FIRMA-06-sistemas-stronilead--claude-worktrees-unruffled-chatterjee-6036f8/2eddd9e5-4fce-4c8d-ac5f-ba368c8db54e/scratchpad/e2-pr1-body.md`

A varredura é o que impede a volta do padrão antigo em tela nova: filtro guardado em `useState`, URL lida num effect, ou nome de parâmetro dentro de uma `key`. É o mesmo tipo de teste do `leadLinkSweep.test.js` e do `overscrollGuard.test.js`, que já rodam no CI.

**Vindo da Task 8, antes de tudo:** a Task 8 já mexeu no spec, que aqui é da Task 9. Ela reescreveu o risco "ficha aberta em outra guia" (agora com os dois caminhos possíveis e a decisão em aberto do Johnny) e o item 1 de "Entrega em dois PRs", que passou a dizer "saneamento silencioso, sem reescrever o endereço". Ler os dois trechos antes de escrever por cima. Ela também deixou para cá uma trava: a varredura precisa cobrar que nenhum `navigate(` de `src/` passe replace que não seja `false` escrito junto com state próprio (nem `location.state`, nem o `state` do hook, nem nulo), senão a premissa do `backTarget` cai. A única exceção é o `openProfile` do `App.jsx`, que faz replace condicional com state literal e é seguro porque nesse ramo o `profileFrom` é nulo; a varredura pula essa chamada e um teste irmão congela o texto dela.

**Vindo da revisão da Task 7, para não se perder aqui:**

- O `CLAUDE.md`, na seção "Endereço de cada tela", ainda diz que Configurações abre na seção de `location.state.secao` e que "Configurar agora" navega com `state: { secao: 'general' }`. As duas frases ficaram falsas: a seção vem do endereço (`/configuracoes/<secao>`) e o "Configurar agora" navega para Metas & ritmo. Vale citar também a aba da ficha no endereço e o par `SETTINGS_SECTIONS`/`FICHA_TABS` com os testes que o cobram (`src/lib/__tests__/settingsRail.test.js` e o bloco de abas em `profileLinks.test.js`).
- A decisão 2 da montagem (replace sempre) mudou na prática: o `goToSub` do `App.jsx` faz `replace: shown.screen === screen`. Quem já está na tela troca a entrada; quem vem de outra tela empilha, senão o "Configurar agora" apagaria do histórico a tela em que a pessoa estava. Registrar assim nas decisões.
- Item para a conferência manual no preview: com `/ficha/<id>/indicacoes` aberto numa ficha que ainda é lead, a aba mostrada é a Linha do tempo; se a pessoa virar cliente com a ficha aberta, a aba pula sozinha para Indicações, porque o endereço não foi corrigido. É estreito e não trava nada, mas é bom ver ao vivo antes de dar como pronto.

- [ ] **Step 1: Escrever a varredura e o teste da query no Sentry**

Criar `src/lib/__tests__/filtrosNoEndereco.sweep.test.js`:

```js
// Filtro de tela mora no endereço, e só lá. Esta varredura cobra isso de toda
// tela, inclusive das que forem criadas depois: nenhuma view lê a query direto,
// nenhuma guarda em estado o que agora é parâmetro, e nenhum parâmetro entra
// numa key de componente (key com filtro faz a tela remontar e reler a coleção
// inteira a cada clique, o que não quebra nada e não aparece no console).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCREEN_PARAM_NAMES } from '../screenParams.js';
import { SCREENS } from '../routes.js';

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

const views = sourceFiles(join(SRC, 'views')).map((f) => [relative(SRC, f), readFileSync(f, 'utf8')]);
// `src/` inteiro, para a regra do navigate: o state da ficha nasce fora das
// views (App.jsx e o LeadLink).
const fontes = sourceFiles(SRC).map((f) => [relative(SRC, f), readFileSync(f, 'utf8')]);
const hook = readFileSync(join(SRC, 'hooks', 'useScreenParams.js'), 'utf8');
const app = readFileSync(join(SRC, 'App.jsx'), 'utf8');

describe('varredura dos filtros no endereço', () => {
  it('nenhuma tela lê a query direto: quem lê é o screenParams, pelo hook', () => {
    for (const [nome, texto] of views) {
      expect(texto.includes('location.search'), nome).toBe(false);
      expect(texto.includes('useSearchParams'), nome).toBe(false);
    }
  });

  it('nenhuma tela guarda em estado o que virou parâmetro do endereço', () => {
    // Os nomes que sumiram das telas na entrega 2. Voltar com qualquer um
    // deles é voltar a ter filtro que não sobrevive a um F5.
    const proibidos = [
      'setMonthKey', 'setCompareOn', 'setCompareKey', 'setPerson', 'setFunnel',
      'setRespFilter', 'setOnlyOverdue', 'setStatusFilters', 'setConsultantFilters',
      'setOverdueOnly', 'setHotOnly', 'setDayTab', 'setProfFilter', 'setActiveProfileTab',
    ];
    // Palavra inteira: `setFunnelDialog` e `setFunnelName` da seção de Funis
    // contêm `setFunnel` como pedaço e não são filtro de tela nenhum.
    for (const [nome, texto] of views) {
      for (const p of proibidos) {
        expect(new RegExp(`\\b${p}\\b`).test(texto), `${nome} tem ${p}`).toBe(false);
      }
    }
  });

  it('nenhum parâmetro entra numa key de componente', () => {
    // Lista curada e conferida: os nomes curtos do endereço (`de`, `dia`,
    // `mes`, `cat`) aparecem como pedaço de outras palavras e dariam alarme
    // falso (`m.de` do Console, `d.day` da régua de dias da visão Equipe, que
    // ficou fora desta entrega).
    const alvos = [
      'monthKey', 'compareKey', 'compareOn', 'respFilter', 'statusFilters', 'consultantFilters',
      'profFilter', 'overdueOnly', 'onlyOverdue', 'hotOnly', 'dayTab', 'selectedFunnelId',
      'funnelId', 'funil', 'resp', 'atraso', 'quente', 'fase', 'pessoa', 'comparar',
    ];
    for (const [nome, texto] of views) {
      for (const linha of texto.split('\n')) {
        if (!linha.includes('key={')) continue;
        for (const p of alvos) {
          expect(new RegExp(`\\b${p}\\b`).test(linha), `${nome}: ${linha.trim()}`).toBe(false);
        }
      }
    }
  });

  it('a troca de filtro é sempre replace e leva o state junto', () => {
    expect(hook.includes('navigate(')).toBe(true);
    expect(/\{\s*replace:\s*true,\s*state\s*\}/.test(hook)).toBe(true);
    // O destino sai do caminho de agora, nunca de hrefFor: o Operacional tem
    // dois endereços válidos e trocar entre eles empilharia entrada nova com a
    // mesma chave de tela.
    expect(hook.includes('hrefFor')).toBe(false);
  });

  // O `openProfile` do App.jsx é a única chamada com replace condicional e
  // state próprio. Ela é segura porque no ramo do replace (a mesma ficha já
  // aberta) o `profileFrom` é nulo, então a varredura a pula e o teste
  // seguinte congela o texto dela.
  const OPEN_PROFILE = "navigate(href, { replace: href === location.pathname, state: profileFrom ? { from: profileFrom } : null })";

  it('nenhum navigate de src/ grava state próprio numa entrada que pode ser a primeira', () => {
    // A premissa do backTarget (ver o comentário dele em routes.js) é que só o
    // push grava state, e push sempre soma 1 no idx. O react-router NÃO garante
    // isso: medido na 7.18.4, um replace com state na primeira entrada grava o
    // state com idx 0. Quem garante é o app, e este teste é a cobrança. Por
    // isso o replace só passa quando é `replace: false` escrito, e o state só
    // passa quando é o `location.state` repassado, o `state` do hook ou nulo:
    // `replace: <condição>` com objeto literal é a forma que derruba a
    // premissa e ela não pode entrar sem ser vista.
    for (const [nome, texto] of fontes) {
      for (const trecho of texto.split('navigate(').slice(1)) {
        const chamada = trecho.slice(0, 200);
        if (`navigate(${chamada}`.startsWith(OPEN_PROFILE)) continue;
        // Pelo valor escrito, e não por lookahead: `/replace:\s*(?!false\b)/`
        // parece servir e passa em tudo, porque o `\s*` volta atrás e o
        // lookahead cai no espaço depois dos dois-pontos. Medido em 23/09/2026.
        const replaceDito = chamada.match(/replace:\s*([\w.$]+)/)?.[1] ?? null;
        const stateDito = chamada.match(/state:\s*([\w.$]+|\{)/)?.[1] ?? null;
        const temReplace = replaceDito !== null && replaceDito !== 'false';
        const temStateProprio = stateDito !== null && !['location.state', 'state', 'null'].includes(stateDito);
        expect(temReplace && temStateProprio, `${nome}: navigate(${chamada.split('\n')[0]}`).toBe(false);
      }
    }
  });

  it('o openProfile continua gravando origem só quando a ficha veio de outra tela', () => {
    // Mexer nestas duas linhas deixa a varredura vermelha, que é o ponto: o
    // dia em que o `profileFrom` puder ser não nulo no ramo do replace, o
    // backTarget precisa do ramo do `from` de volta.
    expect(app.includes("const profileFrom = activeTab === 'ficha' ? null : activeTab;")).toBe(true);
    expect(app.includes(OPEN_PROFILE)).toBe(true);
  });

  it('a chave da tela continua saindo só da tela mostrada', () => {
    expect(app.includes('screenKey(shown)')).toBe(true);
    for (const trecho of app.split('\n').filter((l) => l.includes('screenKey('))) {
      expect(trecho.includes('search'), trecho.trim()).toBe(false);
    }
  });

  it('toda tela com parâmetro existe na tabela de telas, e o apelido do endereço curto bate', () => {
    for (const tela of Object.keys(SCREEN_PARAM_NAMES)) {
      expect(Object.prototype.hasOwnProperty.call(SCREENS, tela), tela).toBe(true);
    }
    expect(SCREEN_PARAM_NAMES.dashboard).toEqual(SCREEN_PARAM_NAMES.dashOperacional);
  });
});
```

```bash
npx vitest run src/lib/__tests__/filtrosNoEndereco.sweep.test.js
# Esperado: 8 passed. Se alguma falhar, é tela que ficou para trás nas T3 a T7,
# ou um navigate novo gravando state próprio num replace, ou o openProfile
# mudando de forma.
```

A query do app passa a ter conteúdo novo: `pessoa=<uid de colega>`, `resp=<uids>`, `funil=<id>` e `fase=<id da etapa>`. Quem corta isso antes do Sentry é o `stripQuery` do `sentryScrub.js`, que já roda em `request.url`, no `url.path` e nas migalhas de navegação (`URL_KEYS` inclui `to` e `from`), e é o mesmo módulo dos dois lados. Nada muda no código; muda o que precisa continuar valendo, então isso vira teste.

Acrescentar ao fim do bloco que já cobre o mascaramento no `src/lib/__tests__/sentryScrub.test.js`:

```js
  it('a query de filtro não chega ao Sentry, nem na URL, nem na migalha, nem em url.path', () => {
    // A entrega 2 pôs id de colega e id de funil na query. Pela régua do
    // projeto, id que identifica uma pessoa tem o mesmo peso do id do lead.
    const q = '?pessoa=uid-do-colega&resp=uid1,uid2&funil=f2';
    const event = {
      request: { url: `https://stronilead.com.br/stronix-crm-app/clientes${q}` },
      contexts: { trace: { data: { 'url.path': `/stronix-crm-app/clientes${q}` } } },
    };
    const out = scrubEvent(event);
    expect(out.request.url).toBe('https://stronilead.com.br/stronix-crm-app/clientes');
    expect(out.contexts.trace.data['url.path']).toBe('/stronix-crm-app/clientes');
    const crumb = scrubBreadcrumb({ category: 'navigation', data: { from: '/stronix-crm-app/pipeline', to: `/stronix-crm-app/leads${q}` } });
    expect(crumb.data.to).toBe('/stronix-crm-app/leads');
  });
```

- [ ] **Step 2: O `CLAUDE.md`**

Na seção "Endereço de cada tela", depois do item que começa com "**Links.**", acrescentar cinco marcadores:

```markdown
- **O filtro da tela mora no endereço.** A tabela de parâmetros de cada tela, a leitura e a montagem moram em `src/lib/screenParams.js`, puro e testado em node; `src/hooks/useScreenParams.js` liga isso à tela. Parâmetro novo entra na tabela de lá, nunca espalhado na view, e nome novo jamais pode ser `invite`, `t` ou `ref`. Quem escolhe filtro navega: nada de `useState` para filtro e nada de ler a URL num effect. Ausente é o padrão e o padrão nunca é escrito, com uma exceção escrita na tabela, o funil das telas de lista, cujo padrão é de cada pessoa. Valor inválido ou que sumiu (consultor desligado, funil apagado, etapa que mudou de código, mês fora da janela de 12 meses, período maior que 30 dias) cai no padrão, sem aviso. `resp` tem três estados: ausente é o padrão do papel, `resp=` é toda a equipe, com ids é a lista. O filtro de responsável e o de professor são ignorados para quem não vê o controle na tela, senão um link de gestor prende o consultor num recorte que ele não teria como limpar.
- **Trocar filtro é `navigate(location.pathname + query, { replace: true, state })`.** Replace porque trocar filtro não pode criar parada no voltar do navegador, e porque o `idx` do histórico é o que o Voltar da ficha lê. O caminho de agora, e não `hrefFor`, porque o Operacional tem dois endereços válidos e trocar entre eles empilharia entrada nova com a mesma chave de tela. O `state` explícito porque o `navigate` não o repassa sozinho e é nele que vive a origem da ficha.
- **Nada de filtro nem de sub-tela em `key`.** `screenKey` continua cega para o `rest` e para a query, e a key do `AppErrorBoundary` sai dela. Filtro numa key faz Todos os leads e Configurações relerem a coleção inteira a cada clique e a cada voltar. O `filtrosNoEndereco.sweep.test.js` cobra isso de toda tela nova.
- **Sub-tela no caminho: `/configuracoes/<secao>` (dez seções) e `/ficha/<id>/<aba>` (linha-do-tempo, crm, contratos, indicacoes).** A tabela é `SCREENS[x].subs`, com o padrão em `subPadrao`, no molde da subaba do super-admin. Sub-tela desconhecida abre a tela-mãe com replace e sem aviso; o aviso de "não achamos essa tela" continua só para endereço de tela. A aba Indicações só existe para cliente, e numa ficha de lead ela cai na Linha do tempo sem trocar o endereço. Importar clientes só existe na sessão assumida do super console, e sem ela `/configuracoes/importacao` cai na seção padrão: sub-tela que a tela não desenha precisa ter para onde cair, senão o lado direito fica em branco. Elas navegam com replace, senão o Voltar da ficha passaria a andar entre abas.
- **O endereço não é reescrito na entrada.** Valor inválido é ignorado na leitura e some na primeira escolha de filtro. Corrigir na entrada exigiria effect lendo a URL para navegar, que é o padrão que esta entrega tirou do app. Como o saneamento depende de dado que chega depois (a equipe vem de uma leitura, funis e etapas de assinatura), o primeiro render de um link com filtro mostra o padrão e acerta quando o dado chega, e quem clicar noutro filtro nessa janela perde o parâmetro ainda não validado. O funil da tela de lista é derivado do endereço também fora dela (`funnelFromSearch`, no `App.jsx`), para o cadastro rápido nascer no funil do quadro e não no último funil usado.
```

No item que começa com "**Ficha.**" não se mexe: o Voltar continua como sempre foi (voltar do navegador quando há tela do app antes; senão Clientes para cliente, Pipeline para lead). O motivo de ele não levar o filtro está no comentário do `backTarget` e no risco da ficha aberta em outra guia do spec, os dois escritos na Task 8.

Na tabela "Últimas Atualizações" do `CLAUDE.md` da raiz do monorepo não se mexe: quem faz isso é o Johnny no merge.

- [ ] **Step 3: O spec em dia**

No spec `docs/superpowers/specs/2026-09-23-filtros-no-endereco-design.md`, trocar `status: revisão` por `status: ativo`.

Em "Regras de leitura dos parâmetros", a frase "a tela abre funcionando com o padrão, e o endereço é corrigido com replace" descreve algo que não foi construído, e não vai ser (decisão 16). Trocar o marcador inteiro.

Antes:

```markdown
- **Valor inválido ou que sumiu cai no padrão, sem aviso.** Consultor desligado, funil apagado, etapa que mudou de código, mês fora da janela de 12 meses, período maior que 30 dias em Aulas e Visitas, data invertida: a tela abre funcionando com o padrão, e o endereço é corrigido com replace. O aviso de "não achamos essa tela" continua valendo só para tela desconhecida, não para filtro.
```

Depois:

```markdown
- **Valor inválido ou que sumiu cai no padrão, sem aviso.** Consultor desligado, funil apagado, etapa que mudou de código, mês fora da janela de 12 meses, período maior que 30 dias em Aulas e Visitas, data invertida: a tela abre funcionando com o padrão. O endereço NÃO é reescrito na entrada: o valor ruim continua na barra até a primeira escolha de filtro, e some ali. Corrigir na entrada exigiria um effect lendo a URL para navegar, que é o padrão que esta entrega existe para tirar do app. O aviso de "não achamos essa tela" continua valendo só para tela desconhecida, não para filtro.
```

Depois disso, acrescentar ao fim da seção "Como funciona por dentro" um bloco com o que a montagem decidiu e o desenho não dizia:

```markdown
### Decidido na montagem do PR 1

- O endereço é montado com o caminho de agora, e não com `hrefFor`: o Operacional tem dois endereços válidos (`/<academia>` e `/<academia>/visao-geral/operacional`) e trocar entre eles no meio da sessão empilharia entrada nova com a mesma chave de tela.
- Sub-tela também usa replace. Com push, o Voltar da ficha andaria entre abas em vez de voltar para a lista.
- O funil das telas de lista é escrito sempre que vale, e é a única exceção à regra "o padrão nunca é escrito": o padrão dele é o último funil usado por cada pessoa, então omitir faria o mesmo link abrir em funis diferentes para duas pessoas.
- A fase de Todos os leads aceita lista de códigos separados por vírgula, e não um só, porque o filtro da tela sempre foi de múltipla escolha.
- O filtro que vem do endereço continua sobrevivendo só ao redirect que mantém a tela (a correção de academia). Os outros quatro vão para outra tela e descartam, que é o que já acontecia. Quando a correção perde a tela, a query que sobra é inofensiva, porque todo parâmetro é saneado contra os dados da academia da sessão e nome desconhecido é ignorado.
- Clicar no item do menu da tela em que já se está limpa os filtros e cria uma parada no voltar, porque o item do menu é um link e o link empilha. O item do menu é o estado zero da tela, e o voltar devolve a tela filtrada.
- O endereço não é reescrito na entrada. Valor inválido é ignorado na leitura e some na primeira escolha de filtro.
- A seção Importar clientes das Configurações só existe na sessão assumida do super console. Com a seção no caminho, quem abrir `/configuracoes/importacao` sem essa sessão cai na seção padrão, calado, em vez de ver o lado direito em branco.

### O saneamento depende de dado que chega depois

Acrescentar também aos "Riscos conhecidos" do spec:

```markdown
- O saneamento de cada parâmetro depende de dado que chega depois do primeiro render (a equipe vem de uma leitura, funis e etapas de assinatura). Um link com `pessoa`, `funil` ou `fase` abre no padrão e acerta quando o dado chega, o que nos dashboards aparece como uma piscada. Quem clicar em outro filtro dentro dessa janela perde o parâmetro ainda não validado, que some do endereço. Corrigir isso exigiria segurar a tela até o dado chegar, o que é pior do que a piscada.
```

### Dívida conhecida que este PR não criou e não consertou

`scrollActionFor` devolve `'none'` quando a chave da tela não muda, e nesse ramo o `useRouteScroll` grava a posição por cima, inclusive no voltar. Num push para a mesma tela isso apaga a posição guardada daquela entrada. Já é alcançável hoje pelo item Operacional do menu vindo de `/visao-geral/operacional`, e o filtro não piora nada porque usa replace, que nasce com chave nova. Fica para o PR 2, junto com a rolagem dos containers internos.
```

- [ ] **Step 4: Verificação final**

```bash
npx vitest run
# Esperado: Test Files  109 passed (109) · Tests  2230 passed (2230)
npm run lint
# Esperado: ✖ 1 problem (0 errors, 1 warning), o aviso antigo do SuperAdminView
npm run build
# Esperado: build sem erro
git grep -nE "eslint-disable" -- src/lib/screenParams.js src/hooks/useScreenParams.js
# Esperado: nada. Zero eslint-disable novo.
git diff --stat main -- api/ firestore.rules firestore.indexes.json
# Esperado: nada. Nenhuma função nova na Vercel, nenhuma regra e nenhum índice.
```

Conferir que o Sentry continua limpo, já que a query passa a ter conteúdo:

```bash
npm run verificar:sentry
# Esperado: passa. Esse script sobe o SDK de verdade contra um receptor falso e
# confere as funções da api/, não o navegador (diz isso no próprio cabeçalho).
# Quem cobre o navegador é o sentryScrub.test.js, incluindo o teste da query de
# filtro escrito no Step 1 desta tarefa.
```

- [ ] **Step 5: Escrever o corpo do PR**

Gravar em `/private/tmp/claude-501/-Users-johnnybittencourt-STRONIX-FIRMA-06-sistemas-stronilead--claude-worktrees-unruffled-chatterjee-6036f8/2eddd9e5-4fce-4c8d-ac5f-ba368c8db54e/scratchpad/e2-pr1-body.md`:

```markdown
## O que muda para quem usa

O que você escolhe na tela fica no endereço. F5 mantém, o link mandado para um colega abre igual, e cada aba pode estar num recorte diferente. As Configurações passam a ter endereço por seção e a ficha por aba. Nada muda para quem só usa os padrões: link limpo abre a tela como sempre abriu.

Entra no endereço, tela por tela:

| Tela | Caminho | Query |
|---|---|---|
| Operacional | `/<academia>` | `mes` · `comparar=0` · `comparar-com` · `pessoa` |
| CRM | `/<academia>/visao-geral/crm` | `mes` · `comparar` · `comparar-com` · `pessoa` · `funil` |
| Gerencial | `/<academia>/visao-geral/gerencial` | `mes` · `comparar` · `comparar-com` |
| Pipeline | `/<academia>/pipeline` | `funil` · `resp` · `atraso=1` |
| Clientes | `/<academia>/clientes` | `sit` · `resp` |
| Todos os leads | `/<academia>/leads` | `funil` · `fase` · `resp` · `atraso=1` · `quente=1` |
| Aulas | `/<academia>/leads/aulas` | `dia` OU `de`+`ate` · `resp` · `prof` |
| Visitas | `/<academia>/leads/visitas` | `dia` OU `de`+`ate` · `resp` |
| Meta diária | `/<academia>/meta-diaria` | `cat` |
| Configurações | `/<academia>/configuracoes/<secao>` | nenhuma |
| Ficha | `/<academia>/ficha/<id>/<aba>` | nenhuma |

Vêm junto dois consertos: a seção das Configurações passa a trocar com a tela já aberta (o "Configurar agora" de uma novidade não funcionava) e a pessoa escolhida no Operacional passa a ser conferida contra a equipe (antes um id de quem saiu deixava a tela zerada com o seletor em branco).

Fica para o PR 2 da entrega 2: a lista viva por trás da ficha, o "carregar mais" e a rolagem preservados no voltar, e a linha da pessoa mexida atualizada na hora.

## O que muda por dentro

- `src/lib/screenParams.js` (novo, puro, testado em node) guarda a tabela de parâmetros de cada tela, a leitura e a montagem. `src/hooks/useScreenParams.js` liga isso à tela: deriva no render e navega com replace.
- `src/lib/routes.js` ganha sub-tela no caminho (`SCREENS[x].subs`), no molde da subaba do super-admin. Sub-tela desconhecida abre a tela-mãe, sem aviso.
- Nenhuma tela guarda mais filtro em `useState` e nenhuma lê a URL num effect. Uma varredura no CI cobra isso das telas novas.
- Nada disso entra em `screenKey`, na key do `AppErrorBoundary` nem em key de view, então trocar filtro não relê coleção nenhuma.
- Nenhuma função nova na Vercel (11 de 12), nenhuma regra e nenhum índice novo do Firestore.

## Conferência manual no preview

Sempre no preview da Vercel, nunca com o dev local apontado para a produção. O que cria ou apaga dado é feito na `academia-teste`.

- [ ] Operacional: escolher mês, comparativo e pessoa, dar F5 e ver tudo igual. Copiar o endereço para outra aba e ver abrir igual.
- [ ] Trocar oito filtros seguidos e apertar voltar uma vez: sai da tela, não desfaz filtro.
- [ ] Pipeline: escolher funil, dar F5, e abrir o mesmo link em outra aba com outro funil escolhido nela.
- [ ] Todos os leads: filtrar por fase, renomear a etapa em Configurações e reabrir o link. A tela abre na fase certa.
- [ ] Link com `resp` de um gestor aberto por um consultor: em Clientes, Todos os leads, Aulas e Visitas a lista aparece inteira. No Pipeline o recorte vale, e dá para limpar no filtro.
- [ ] Aulas: `?de=2026-09-01&ate=2026-10-11` (40 dias) abre no atalho Hoje, sem erro na tela. `?dia=andamento` em Visitas abre em Hoje.
- [ ] Configurações: link direto para `/configuracoes/funis`, e "Configurar agora" de uma novidade trocando a seção com a tela já aberta.
- [ ] Ficha: link direto para a aba Contratos; trocar de aba não recarrega a ficha e não troca a entrada do histórico.
- [ ] Ficha aberta na mesma aba a partir de uma lista filtrada: o Voltar devolve a lista com o filtro, porque é o voltar do navegador. Aberta em guia nova (Ctrl+clique, setinha do card), cai em Clientes ou Pipeline sem filtro, como antes.
- [ ] `/configuracoes/xyz` abre Configurações na seção padrão, sem aviso. `/visao-geral/xyz` continua avisando "Não achamos essa tela".
- [ ] `/configuracoes/importacao` com um gestor comum (sem "Acessar como") abre a seção padrão, com a tela desenhada. O lado direito não pode ficar em branco.
- [ ] Abrir um link com `?pessoa=<colega>` e clicar em outro filtro no primeiro segundo: a pessoa some do endereço, porque a equipe ainda não tinha chegado. É o comportamento esperado (decisão 17), e o que se confere é que a tela continua funcionando.
- [ ] Novo lead a partir de `/pipeline?funil=<outro funil>` aberto por link: o cadastro nasce nesse funil, e não no último funil usado.
- [ ] Menu: estando em Pipeline com filtro, clicar em Pipeline no menu limpa os filtros, e o voltar devolve o quadro filtrado.
- [ ] "Acessar como" outra academia com filtro na barra: a tela abre funcionando, com os filtros da outra academia caindo no padrão.
- [ ] Celular: filtrar, voltar e conferir que o menu fecha sozinho e a tela não fica presa.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

- [ ] **Step 6: Commitar**

```bash
git add -A && git commit -m "$(cat <<'MSGEOF'
docs: varredura dos filtros no endereço e documentação da entrega 2 PR 1

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSGEOF
)"
```

Nada de `git push`, de abrir PR e de merge: quem faz isso é o Johnny.
