# Endereço por tela, PR 3 (Ctrl+clique em tudo que abre ficha) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Todo ponto do Stronilead que abre a ficha vira link de verdade, para Ctrl+clique, botão do meio e "Abrir em nova aba" funcionarem no card do Pipeline, nas listas, na Meta diária, na visão Equipe, na busca, no sino e na ficha. A setinha do rodapé do card do Pipeline passa a abrir a ficha em OUTRA GUIA no clique simples, e é com ela que o consultor dispara vários cards sem sair do Pipeline.

**Architecture:** Nada de peça nova. O `LeadLink` do PR 2 (`src/components/nav/AppLink.jsx`) já monta o endereço da ficha a partir do `LeadProfileContext` e já leva a tela de origem no state. Este PR troca, um arquivo por vez, o `onClick={() => openProfile(id)}` de cada `div`, `button` e `article` por esse link, e apaga o `useLeadProfile` de quem deixa de precisar dele. Onde o card tem botão dentro ou é arrastável, o link ENVOLVE o conteúdo (card do Pipeline) ou vira link esticado com os botões em `relative z-10` (Meta diária). Três blocos de JSX que hoje vivem soltos dentro de telas grandes viram componentes de módulo (`SearchResultRow`, `TomorrowApptRow`, `NotificationRow`), para o teste em node conseguir renderizar cada ponto.

**Tech Stack:** React 19.2.4 + Vite 8 (JS/JSX, sem TypeScript), react-router 7.18.4, Firebase JS 12.11, Tailwind v4 + shadcn/ui, vitest 4 em node sem jsdom (`renderToString` sob `MemoryRouter`), eslint 9 com react-hooks v7.

**Spec:** [`docs/superpowers/specs/2026-09-21-endereco-por-tela-design.md`](../specs/2026-09-21-endereco-por-tela-design.md). Vale para este PR: a decisão 11 ("Decisões do Johnny"), a seção "Links" dentro de "Como funciona por dentro", a entrega 3 de "Entrega em três PRs" e o bloco PR 3 da "Conferência manual no preview da Vercel".

**Branch:** `claude/rotas-pr3-ctrl-clique`, criada da main `2822fbc` (PRs #216, #217 e #218 já dentro).

**Base conferida em 2026-09-22 (`a751863`):** `npx vitest run` → `Test Files  100 passed (100)` e `Tests  2066 passed (2066)`. `npm run lint` → `✖ 1 problem (0 errors, 1 warning)`, o aviso antigo de `src/views/superadmin/SuperAdminView.jsx:113` (`react-hooks/exhaustive-deps`, `useEffect` sem `loadPlans` e `loadTenants`).

**Como este plano foi conferido:** cada trecho "Antes" foi copiado do arquivo real nesta branch e conferido como ocorrência única. Os números de linha também são desta branch; se algum não bater porque a main andou, vale o trecho, que é único no arquivo. O que este plano supõe sobre o ambiente foi medido, não lembrado:

- `KanbanCard`, `TaskCard`, `DoneCard`, `LeadsView`, `ClientsView`, `AppointmentTrackingView`, `ConsultantDayDetail`, `ReferralsSection` e `LeadProfileView` renderizam em node com `renderToString` sob `MemoryRouter`, desde que `src/lib/firebase.js` e `src/hooks/usePagedLeads.js` (e `src/hooks/useLeadTimeline.js`, na ficha) sejam trocados por mocks. Sem o mock do `firebase.js` o `getAuth` quebra na importação.
- `LeadProfileView` lê `window.location.origin` no render (linha 425, link de indicação). Em node isso exige `vi.stubGlobal('window', { location: { origin: '...' } })`.
- **A ordem dos atributos no HTML não é a ordem em que a gente escreve as props.** O `Link` do React Router renderiza `<a {...rest} href onClick ref target>`, então `class` e `href` saem DEPOIS de tudo que veio pelo espalhamento. Medido: um `LeadLink` com `draggable`, `tabIndex`, `className` e `title` sai como `<a draggable="false" tabindex="-1" title="..." class="..." href="..." data-discover="true">`. No `<button>` vale a ordem das props, e `type` vem antes de `title`, que vem antes de `class`. Por isso teste de atributo fatia a TAG INTEIRA (`html.slice(abertura, html.indexOf('>', i))`), nunca o pedaço entre a abertura e o `title=`.
- **O `renderToString` separa dois filhos de texto vizinhos com um comentário.** `Indicado por {nome}` sai como `Indicado por <!-- -->Carla Dias`, então procurar a frase inteira devolve -1. Procurar só o pedaço fixo e conferir o nome à parte.
- **A ficha só renderiza os controles de edição quando o `appUser` tem `authUid`** (`canEditLead`, em `src/lib/leads.js:257`). Sem ele a ficha inteira fica em modo de leitura e o lápis do vínculo de indicação nem aparece no HTML.
- `export const KanbanCard = memo(...)` e `export function TaskCard` passam no `npm run lint`: o `react-refresh/only-export-components` aceita vários componentes exportados no mesmo arquivo.
- `KanbanCard.type(props)` devolve o elemento do `<article>` sem renderizar, e hoje `props.onClick` é função. É assim que o teste prova que o `onClick` do container saiu.
- As utilidades `after:absolute` e `after:inset-0` compilam no CSS gerado, então o link esticado da Meta funciona. A regra sai como `.after\:absolute:after{content:var(--tw-content);position:absolute}`, com UM dois-pontos: o lightningcss encurta `::after` para `:after` na minificação.
- `focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/40` já é usado em `src/views/dashboard/TeamMonthTable.jsx:144` e em `PeopleConversionTable.jsx:133`, e `ring-inset` está no CSS gerado.
- `appointmentType` vale `"aula_experimental"` na tela de Aulas e `"visita"` na de Visitas (`src/App.jsx:1733-1734`).

---

## Regras para todas as tarefas

- Sem jsdom. Todo teste roda em node, em `src/lib/__tests__/`, com `renderToString` e `createElement` (sem JSX em `.test.js`). Componente que tenha `AppLink` ou `LeadLink` só renderiza dentro de um Router: envolver sempre com `MemoryRouter`, senão o `useHref` quebra com invariant.
- Zero `eslint-disable` novo. O lint é portão do CI e a config não pode ser rebaixada: `react-hooks/set-state-in-effect`, `refs`, `purity`, `static-components` e `react-refresh/only-export-components` são erro.
- Nenhuma função nova em `api/`, nenhuma regra e nenhum índice novo do Firestore. Este PR não toca em `api/` nem em `src/App.jsx`.
- Quem abre a ficha por link nunca chama `window.open`. O comportamento nativo do `<a>` já dá aba em segundo plano, janela nova com Shift, menu do botão direito e endereço na barra de status.
- Botão continua botão onde a ação não é ir para um endereço: Mover do card, WhatsApp, Ligar, Adiar, desfechos e Remarcar da Meta, lápis do vínculo de indicação, "Ir para o pipeline" do Gerencial, novidades do sino, "Cadastrar novo lead" da busca.
- Texto na tela e comentário: português direto, sem jargão de programação e sem travessão no meio da frase.
- Commits em português, no formato `tipo: descrição`, terminando com a linha `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Um commit por tarefa. Nada de `git push`, de abrir PR e de merge: quem faz isso é o Johnny.
- Nunca usar `git stash` puro (a pilha é compartilhada com os outros worktrees).
- No shell do Claude Code, `grep` é uma função do perfil que às vezes devolve vazio (sempre que o padrão tem `\|`). As buscas deste plano usam `git grep -E`, `/usr/bin/grep` ou `node -e`. Uma busca cujo resultado esperado é "nada" só vale com um desses.
- Se a suíte da base der outro número (a main andou), anote a diferença e some a ela todos os números esperados abaixo.

## Decisões tomadas na montagem

Onde o spec e o desenho deixavam duas saídas, ou onde a revisão do desenho mandou trocar de saída, valeu o que está aqui. A T6 põe o spec e o `CLAUDE.md` em dia com isso.

1. **Card do Pipeline: dois links que envolvem, e não uma camada que estica.** O link esticado (`after:absolute after:inset-0`) cobre o card inteiro e rouba o hit-test: os tooltips dos chips truncados em 112px, o do motivo da perda e o de "Consultor: X" parariam de aparecer, e todo hover do card mostraria o nome. A revisão do desenho mandou envolver. A saída que não mexe em uma linha de layout é ter DOIS `LeadLink` no card: um em volta do bloco de cima (nome, compromisso e chips) e outro no nome do consultor do rodapé. Os dois têm o mesmo destino, os `title` continuam dentro deles (menos no card de id quebrado, que vira `<span>` e perde o tooltip junto com o link) e o rodapé segue sendo uma linha flex com os mesmos filhos na mesma ordem. O do rodapé leva `tabIndex={-1}`, para o Tab parar uma vez por card. A alternativa do desenho (um link só, com as ações tiradas do fluxo por `position: absolute`) mudaria a altura do card no hover e não foi adotada.
2. **O `<article>` perde o `onClick` e continua sendo quem arrasta.** Com o link também chamando o `navigate`, o clique empilharia duas entradas e o voltar do navegador precisaria de dois cliques. Os links levam `draggable={false}`: pela especificação do HTML quem arrasta é o primeiro ancestral com `draggable` verdadeiro, então a imagem arrastada continua sendo o card e o arrasto não leva a URL (soltar em outra aba abriria a ficha).
3. **A setinha abre em outra guia (decisão 11 do Johnny).** `target="_blank"` e `rel="noopener"`, com `title` e `aria-label` dizendo isso. O `AppLink` já não chama `onNavigate` quando o `target` não é `_self`, e o `Link` do React Router não intercepta clique com `target`, então o Pipeline fica intacto na guia atual. Ctrl+clique ou botão do meio na setinha abre a guia em segundo plano: nenhum site consegue forçar segundo plano num clique comum.
4. **O `e.stopPropagation()` do botão Mover sai.** Ele existia só para o clique não subir até o `onClick` do `<article>`, que deixa de existir.
5. **Link esticado fica na Meta diária.** O cabeçalho do `TaskCard` e o corpo do `DoneCard` não têm `title` nenhum, então a camada por cima não apaga tooltip. O container ganha `relative` e os botões de dentro ganham `relative z-10`.
6. **Três blocos viram componente de módulo:** `SearchResultRow` (linha do resultado da busca), `TomorrowApptRow` (linha da prévia de amanhã) e `NotificationRow` (linha do sino, hoje `Row`). Sem isso não há teste em node possível: o dropdown da busca e o conteúdo do sino só existem depois de um evento, e a prévia de amanhã mora dentro de uma tela que precisa do Firestore para montar. São componentes exportados, o que o `react-refresh` aceita.
7. **Componentes-folha exportados para teste:** `KanbanCard`, `TaskCard`, `DoneCard`. Nenhum deles ganha prop nova por causa do teste.
8. **A busca escolhe no clique do link, não mais no `onMouseDown`.** Hoje o `pick` roda no mousedown e limpa a lista antes de o clique chegar, o que mataria o link e faria o botão do meio abrir na mesma guia. O mousedown fica só com o `preventDefault` do botão esquerdo, que mantém o foco no campo. O Enter continua chamando `pick`, que navega na mesma aba.
9. **O `ReferrerPicker` não vira link.** Ele escolhe um indicador e não navega. O resultado da escolha aparece na ficha como "Indicado por", e esse sim vira link.
10. **"Ir para o pipeline" do Gerencial continua `<button>`.** O `gerencial.components.test.js` renderiza o componente com `renderToString` SEM Router e exige `<button type="button"`. Virar link quebraria o teste e faria uma folha depender do roteador.
11. **`group-enabled:group-hover:` não vale em `<a>`.** No `ConsultantDayDetail`, a prospecção usava `:enabled`, que só existe em controle de formulário. No ramo com link a classe vira `group-hover:`, e no ramo sem lead o hover sai de vez (hoje ele também não acontece, porque o botão está `disabled`).
12. **O `openProfile` do contexto continua vivo em dois lugares:** no `App.jsx` (definição e "Ver ficha" do cadastro) e na busca global (Enter). Uma varredura no CI (T6) cobra que nenhum outro arquivo de `src/views` ou `src/components` volte a usá-lo.
13. **Sem mudança no `src/App.jsx`.** O `LeadProfileContext` já entrega `leadHref` e `from` desde o PR 2, e nenhuma das telas convertidas recebe prop do App para isso.

## Mapa de arquivos

| Arquivo | O que faz | Ação | Tarefa |
|---|---|---|---|
| `src/views/KanbanView.jsx` | Card do Pipeline: dois links envolvendo o conteúdo, setinha em outra guia, `onOpenProfile` apagado | Modificar | T1 |
| `src/lib/__tests__/kanbanCardLink.test.js` | Links do card, tooltips, arrasto e a setinha | Criar | T1 |
| `src/views/LeadsView.jsx` | A linha de Todos os leads vira link | Modificar | T2 |
| `src/views/ClientsView.jsx` | A linha de Clientes vira link | Modificar | T2 |
| `src/views/AppointmentTrackingView.jsx` | A linha de Aulas e Visitas vira link | Modificar | T2 |
| `src/lib/__tests__/listRowLinks.test.js` | As quatro listas como link | Criar | T2 |
| `src/views/DailyGoalView.jsx` | `TaskCard`, `DoneCard` e a prévia de amanhã (`TomorrowApptRow`) | Modificar | T3 |
| `src/views/team/ConsultantDayDetail.jsx` | As duas listas da visão Equipe | Modificar | T3 |
| `src/lib/__tests__/metaLinks.test.js` | Meta diária e visão Equipe | Criar | T3 |
| `src/components/layout/GlobalSearch.jsx` | `SearchResultRow` novo, escolha no clique do link | Modificar | T4 |
| `src/components/layout/NotificationBell.jsx` | `Row` vira `NotificationRow` e aceita `leadId` | Modificar | T4 |
| `src/lib/__tests__/searchBellLinks.test.js` | Busca e sino | Criar | T4 |
| `src/views/LeadProfileView.jsx` | "Indicado por" vira link | Modificar | T5 |
| `src/components/profile/ReferralsSection.jsx` | A aba Indicações vira link | Modificar | T5 |
| `src/lib/__tests__/profileLinks.test.js` | Ficha e indicações | Criar | T5 |
| `src/lib/__tests__/leadLinkSweep.test.js` | Varredura: nenhuma tela volta a abrir ficha por `onClick` | Criar | T6 |
| `CLAUDE.md` | Regra dos links de ficha na seção "Endereço de cada tela" | Modificar | T6 |
| `docs/superpowers/specs/2026-09-21-endereco-por-tela-design.md` | Spec em dia com o que foi construído | Modificar | T6 |

## Tarefas e contagem de testes

A contagem é cumulativa: o número da última coluna é o que `npx vitest run` mostra no fim da tarefa.

| Tarefa | O que entrega | Depende de | Testes novos | Arquivos de teste novos | Suíte no fim |
|---|---|---|---|---|---|
| base | branch `claude/rotas-pr3-ctrl-clique` em `a751863` | | | | 100 arquivos, 2066 testes |
| T1 | Card do Pipeline e a setinha (mais 2 testes dos ajustes da revisão) | | 11 | 1 | 101, 2077 |
| T2 | Listas de Leads, Clientes, Aulas e Visitas | | 5 | 1 | 102, 2082 |
| T3 | Meta diária e visão Equipe (mais 1 teste dos ajustes da revisão) | | 10 | 1 | 103, 2092 |
| T4 | Busca global e sino | | 7 | 1 | 104, 2099 |
| T5 | Ficha e indicações | | 5 | 1 | 105, 2104 |
| T6 | Varredura, documentação, verificação final e corpo do PR | T1 a T5 | 2 | 1 | 106, 2106 |
| **Total** | | | **40** | **6** | **106 arquivos, 2106 testes** |

As tarefas T1 a T5 são independentes entre si (arquivos diferentes) e podem rodar em qualquer ordem. A T6 é a última.

---

### Task 1: card do Pipeline e a setinha que abre em outra guia

**Files:**
- Modify: `src/views/KanbanView.jsx` (import da linha 28; assinatura do `KanbanCard` na linha 120; `<article>` nas linhas 155-171; bloco de cima nas linhas 172 e 247; rodapé nas linhas 253-281; assinatura do `KanbanColumn` na linha 301; repasse na linha 383; hook na linha 414; três montagens nas linhas 1453, 1474 e 1502)
- Test: `src/lib/__tests__/kanbanCardLink.test.js` (novo)

O card do Pipeline é o ponto mais delicado do PR, porque ele é arrastável, tem dois botões no rodapé e quatro tooltips. Regras que valem aqui:

- o link precisa CONTER os elementos que têm `title`, senão o tooltip some;
- o `<article>` continua com `draggable`, `onDragStart`, `onDragEnd` e `data-no-pan`, e perde o `onClick`;
- os links levam `draggable={false}`, para o arrasto continuar sendo o do card e não o da URL;
- Mover e a setinha ficam FORA do link;
- a setinha abre em outra guia no clique simples.

Três coisas mudam de comportamento e ficam assim de propósito:

- **Sem "Manter conectado", a guia nova da setinha cai no login.** A sessão de quem entra com a caixa desmarcada mora no `sessionStorage` (`persistenceKind` devolve `session`, e o login grava em `browserSessionPersistence`), e guia aberta por link nasce com esse armazenamento vazio. Tirar o `rel="noopener"` não muda nada: quem zera é o `target="_blank"`, e o Chrome aplica noopener sozinho em link desde a versão 88. Aceito, porque é a decisão 7 do spec aparecendo aqui: quem pediu para não ficar conectado está pedindo isso. O time entra com "Manter conectado", e ali a guia nova abre a ficha direto. Vai para o checklist manual (T6, Step 6).

- **Dois pedaços do rodapé deixam de abrir a ficha.** O `onClick` cobria o card inteiro e o link do rodapé cobre só o nome do consultor, então saem da conta o avatar de iniciais (irmão anterior do link) e o número da direita, valor da venda ou dias de silêncio (irmão posterior). O número já era inalcançável na prática, porque some justamente no hover e no toque (`group-hover:hidden`, `group-focus-within:hidden`, `pointer-coarse:hidden`). A perda real é o avatar de 17px, e ali do lado é onde ficam as ações. Vai para o checklist manual do corpo do PR (T6, Step 6).
- **Id que não serve para endereço perde o tooltip junto com o link.** O ramo sem href do `LeadLink` devolve `<span className={className}>{children}</span>` e joga fora o resto das props, então num card com id quebrado o `title` do consultor some do HTML. Guardar o tooltip exigiria mexer no `AppLink.jsx`, que é arquivo do PR 2 e está fora do escopo deste. Fica anotado no spec (T6, Step 4); na prática é card que já não abria ficha nenhuma.

**Ajustes da revisão de qualidade (22/09, depois do commit da Task 1).** O código final do card difere do escrito nos Steps abaixo nestes cinco pontos:

- A setinha ganha `pointer-coarse:hidden`. No toque ela ficava sempre visível e um toque passou a abrir guia nova do navegador, com o app carregando do zero e sem o Voltar. Abrir vários cards é uso de mouse, e no toque o corpo do card já abre a ficha.
- `group-focus-within:flex` e `group-focus-within:hidden` do rodapé viram `group-has-[:focus-visible]:flex` e `group-has-[:focus-visible]:hidden`. Depois do clique o foco fica no link, e o card ficava travado mostrando as ações e escondendo o valor ou os dias sem contato. Com foco visível o teclado continua abrindo as ações. O `has-[:focus-visible]` já era usado em `src/App.jsx`, e o CSS gerado confirma a variante.
- O link do corpo ganha `rounded-t-[10px]`: o anel de foco era quadrado dentro de um card arredondado e o `overflow-hidden` do `<article>` cortava os cantos.
- O link do nome do consultor ganha um `aria-label` que começa pelo texto da tela e termina no destino ("Bruno Souza, abrir ficha de Ana Lima"). Sem ele o leitor de tela anuncia um link chamado "Sem responsável" que não diz para onde vai; e um rótulo que trocasse o nome do consultor pelo destino apagaria da leitura quem é o dono do lead. O `title` continua sendo o tooltip do mouse.
- O `data-no-pan` da setinha continua onde está, com comentário dizendo que é redundância proposital, a mesma do botão Mover ao lado.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/__tests__/kanbanCardLink.test.js`:

```js
// O card do Pipeline virou link de verdade: Ctrl+clique, botão do meio e
// "Abrir em nova aba" abrem a ficha, e a setinha do rodapé abre em OUTRA GUIA
// já no clique simples. O link ENVOLVE o conteúdo em vez de esticar uma camada
// por cima, senão os tooltips do card (chips, motivo da perda e consultor)
// somem. O card continua sendo o que se arrasta.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

// O KanbanView importa src/lib/firebase.js, que inicializa o Firebase ao ser
// importado e quebra em node. O card não usa nada disso.
vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', db: {}, auth: {}, storage: {},
}));

const { KanbanCard } = await import('../../views/KanbanView.jsx');

const TENANT = 'acad';
const profile = {
  openProfile: () => {},
  leadHref: (leadId) => hrefFor(TENANT, 'ficha', { leadId }),
  from: 'kanban',
};

const LEAD = {
  id: 'abc123',
  name: 'Ana Lima',
  status: 'Perda',
  lossReason: 'Achou caro para o orçamento dela',
  source: 'Instagram',
  modalidade: 'Musculação e pilates',
  consultantName: 'Bruno Souza',
};

function render(lead = LEAD) {
  return renderToString(
    createElement(MemoryRouter, { initialEntries: ['/acad/pipeline'] },
      createElement(LeadProfileContext.Provider, { value: profile },
        createElement(KanbanCard, {
          lead,
          columnColor: 'blue',
          isDragging: false,
          lastDate: null,
          onDragStart: () => {},
          onDragEnd: () => {},
          onMoveRequest: () => {},
        }))));
}

// O primeiro <a> do card é o que envolve o bloco de cima.
function primeiroLink(html) {
  const inicio = html.indexOf('<a ');
  return html.slice(inicio, html.indexOf('</a>', inicio));
}

describe('card do Pipeline', () => {
  it('o corpo do card é um link para a ficha', () => {
    const html = render();
    expect(html).toContain('href="/acad/ficha/abc123"');
    // Corpo, nome do consultor e setinha.
    expect(html.match(/<a /g)).toHaveLength(3);
  });

  it('os tooltips do bloco de cima continuam dentro do link', () => {
    const corpo = primeiroLink(render());
    expect(corpo).toContain('title="Ana Lima"');
    expect(corpo).toContain('title="Achou caro para o orçamento dela"');
    expect(corpo).toContain('title="Instagram"');
    expect(corpo).toContain('title="Musculação e pilates"');
  });

  it('o nome do consultor é link com o tooltip e fora da ordem do Tab', () => {
    const html = render();
    const i = html.indexOf('title="Consultor: Bruno Souza"');
    expect(i).toBeGreaterThan(-1);
    // A TAG INTEIRA, não o pedaço até o title: class e href saem depois do
    // espalhamento das props, então parar no title não acharia nenhum dos dois.
    const abertura = html.lastIndexOf('<a ', i);
    const tag = html.slice(abertura, html.indexOf('>', i));
    expect(tag).toContain('tabindex="-1"');
    expect(tag).toContain('href="/acad/ficha/abc123"');
  });

  it('os links do card não são arrastáveis, e o card é', () => {
    const html = render();
    expect(html.match(/draggable="false"/g)).toHaveLength(3);
    expect(html).toContain('<article');
    expect(html).toContain('draggable="true"');
  });

  it('o card não abre mais a ficha pelo onClick do container', () => {
    const el = KanbanCard.type({
      lead: LEAD, columnColor: 'blue', isDragging: false, lastDate: null,
      onDragStart: () => {}, onDragEnd: () => {}, onMoveRequest: () => {},
    });
    expect(el.type).toBe('article');
    expect(el.props.onClick).toBeUndefined();
    expect(el.props.draggable).toBe(true);
    expect(el.props['data-no-pan']).toBe('true');
  });

  it('a setinha abre a ficha em outra guia', () => {
    const html = render();
    const i = html.indexOf('target="_blank"');
    expect(i).toBeGreaterThan(-1);
    const abertura = html.lastIndexOf('<a ', i);
    const setinha = html.slice(abertura, html.indexOf('</a>', i));
    expect(setinha).toContain('href="/acad/ficha/abc123"');
    expect(setinha).toContain('rel="noopener"');
  });

  it('o rótulo da setinha avisa que abre em outra guia', () => {
    const html = render();
    expect(html).toContain('title="Abrir ficha em outra guia"');
    expect(html).toContain('aria-label="Abrir ficha em outra guia"');
  });

  it('Mover continua botão', () => {
    const html = render();
    expect(html).toContain('aria-label="Mover lead para outra etapa"');
    const i = html.indexOf('aria-label="Mover lead para outra etapa"');
    expect(html.lastIndexOf('<button', i)).toBeGreaterThan(html.lastIndexOf('<a ', i));
  });

  it('id que não serve para endereço vira texto sem link', () => {
    const html = render({ ...LEAD, id: 'a/b' });
    expect(html).not.toContain('<a ');
    expect(html).toContain('Ana Lima');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/kanbanCardLink.test.js
```

Esperado: falha na importação, porque `KanbanCard` ainda não é exportado (`Element type is invalid` ou `KanbanCard is not a function`).

- [ ] **Step 3: Trocar o import do contexto pelo do link**

Em `src/views/KanbanView.jsx`, linha 28. Antes:

```jsx
import { useLeadProfile } from '../contexts/LeadProfileContext.jsx';
```

Depois:

```jsx
import { LeadLink } from '../components/nav/AppLink.jsx';
```

- [ ] **Step 4: Exportar o card e tirar a prop `onOpenProfile`**

Linha 120. Antes:

```jsx
const KanbanCard = memo(function KanbanCard({ lead, columnColor, isDragging, lastDate, onDragStart, onDragEnd, onOpenProfile, onMoveRequest }) {
```

Depois:

```jsx
// Exportado para o teste em node conferir os links do card sem montar a tela.
export const KanbanCard = memo(function KanbanCard({ lead, columnColor, isDragging, lastDate, onDragStart, onDragEnd, onMoveRequest }) {
```

- [ ] **Step 5: Tirar o `onClick` do `<article>`**

Linhas 155-161. Antes:

```jsx
    <article
      data-no-pan="true"
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onDragEnd={onDragEnd}
      onClick={() => onOpenProfile(lead.id)}
      className={cn(
```

Depois:

```jsx
    <article
      data-no-pan="true"
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onDragEnd={onDragEnd}
      className={cn(
```

- [ ] **Step 6: Envolver o bloco de cima com o link**

Linha 172. Antes:

```jsx
      <div className="px-[11px] pt-2.5 pb-[9px]">
```

Depois:

```jsx
      {/* O link ENVOLVE o conteúdo em vez de esticar uma camada por cima: com
          uma camada, os tooltips dos chips, do motivo da perda e do consultor
          parariam de aparecer. draggable={false} deixa o arrasto com o
          <article>, então a imagem arrastada continua sendo o card e o arrasto
          não leva a URL. */}
      <LeadLink
        leadId={lead.id}
        draggable={false}
        className="block px-[11px] pt-2.5 pb-[9px] cursor-grab active:cursor-grabbing outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/40"
      >
```

- [ ] **Step 7: Fechar o link do bloco de cima**

Linhas 245-249 (o fim dos chips, o fim do bloco de cima e o começo do rodapé). Antes:

```jsx
          </div>
        )}
      </div>

      <div className={cn(
```

Depois:

```jsx
          </div>
        )}
      </LeadLink>

      <div className={cn(
```

- [ ] **Step 8: Nome do consultor como link, com o mesmo tooltip**

Linhas 253-256. Antes:

```jsx
        {lead.consultantName && <InitialsAvatar name={lead.consultantName} size={17} textSize={8} />}
        <span className="flex-1 min-w-0 truncate text-slate-500 dark:text-neutral-400" title={lead.consultantName ? `Consultor: ${lead.consultantName}` : undefined}>
          {lead.consultantName || 'Sem responsável'}
        </span>
```

Depois:

```jsx
        {lead.consultantName && <InitialsAvatar name={lead.consultantName} size={17} textSize={8} />}
        {/* Segundo link do card, para o lado esquerdo do rodapé também abrir a
            ficha. Fora da ordem do Tab: o teclado para uma vez por card, no
            link de cima. */}
        <LeadLink
          leadId={lead.id}
          draggable={false}
          tabIndex={-1}
          className="flex-1 min-w-0 truncate text-slate-500 dark:text-neutral-400 cursor-grab active:cursor-grabbing outline-none"
          title={lead.consultantName ? `Consultor: ${lead.consultantName}` : undefined}
        >
          {lead.consultantName || 'Sem responsável'}
        </LeadLink>
```

- [ ] **Step 9: Setinha em outra guia, e Mover sem o `stopPropagation`**

Linhas 260-281. Antes:

```jsx
        <span className="shrink-0 hidden group-hover:flex group-focus-within:flex pointer-coarse:flex items-center gap-0.5">
          <button
            type="button"
            data-no-pan="true"
            onClick={(e) => { e.stopPropagation(); onMoveRequest(lead); }}
            title="Mover para outra etapa"
            aria-label="Mover lead para outra etapa"
            className="size-[25px] grid place-items-center rounded-[7px] text-slate-400 hover:bg-[#EAF0FF] hover:text-brand-600 dark:hover:bg-brand-500/15 dark:hover:text-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 transition-colors"
          >
            <ArrowRightLeft className="size-3" />
          </button>
          <button
            type="button"
            data-no-pan="true"
            onClick={(e) => { e.stopPropagation(); onOpenProfile(lead.id); }}
            title="Abrir perfil"
            aria-label="Abrir perfil do lead"
            className="size-[25px] grid place-items-center rounded-[7px] text-slate-400 hover:bg-[#EAF0FF] hover:text-brand-600 dark:hover:bg-brand-500/15 dark:hover:text-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 transition-colors"
          >
            <ArrowUpRight className="size-3" />
          </button>
        </span>
```

Depois:

```jsx
        <span className="shrink-0 hidden group-hover:flex group-focus-within:flex pointer-coarse:flex items-center gap-0.5">
          <button
            type="button"
            data-no-pan="true"
            onClick={() => onMoveRequest(lead)}
            title="Mover para outra etapa"
            aria-label="Mover lead para outra etapa"
            className="size-[25px] grid place-items-center rounded-[7px] text-slate-400 hover:bg-[#EAF0FF] hover:text-brand-600 dark:hover:bg-brand-500/15 dark:hover:text-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 transition-colors"
          >
            <ArrowRightLeft className="size-3" />
          </button>
          {/* Clique simples aqui abre a ficha em OUTRA GUIA e o Pipeline fica
              intacto nesta. É assim que o consultor abre vários cards sem sair
              do quadro. Ctrl+clique e botão do meio abrem a guia em segundo
              plano, coisa que nenhum site consegue forçar num clique comum. */}
          <LeadLink
            leadId={lead.id}
            draggable={false}
            data-no-pan="true"
            target="_blank"
            rel="noopener"
            title="Abrir ficha em outra guia"
            aria-label="Abrir ficha em outra guia"
            className="size-[25px] grid place-items-center rounded-[7px] text-slate-400 hover:bg-[#EAF0FF] hover:text-brand-600 dark:hover:bg-brand-500/15 dark:hover:text-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 transition-colors"
          >
            <ArrowUpRight className="size-3" />
          </LeadLink>
        </span>
```

- [ ] **Step 10: Tirar a prop do `KanbanColumn`**

Linha 301. Antes:

```jsx
  onDragStart, onDragEnd, onOpenProfile, onMoveRequest,
```

Depois:

```jsx
  onDragStart, onDragEnd, onMoveRequest,
```

Linha 383 (o repasse ao card). Antes:

```jsx
                onOpenProfile={onOpenProfile}
```

Depois: apagar a linha.

- [ ] **Step 11: Tirar o hook e as três montagens**

Linha 414. Antes:

```jsx
  const { openProfile } = useLeadProfile();
```

Depois: apagar a linha.

Apagar também as três linhas `onOpenProfile={openProfile}` das montagens do `KanbanColumn` (uma na lista de colunas e uma em cada coluna fixa, Venda e Perda). Conferir que não sobrou nenhuma:

```bash
git grep -n "onOpenProfile" src/views/KanbanView.jsx
```

Esperado: nenhuma linha.

- [ ] **Step 12: Rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/kanbanCardLink.test.js
```

Esperado: `Test Files  1 passed (1)` e `Tests  9 passed (9)`.

- [ ] **Step 13: Suíte inteira e lint**

```bash
npx vitest run && npm run lint
```

Esperado: `Test Files  101 passed (101)`, `Tests  2075 passed (2075)`, e o lint com `✖ 1 problem (0 errors, 1 warning)` (o aviso antigo do `SuperAdminView.jsx`).

- [ ] **Step 14: Commit**

```bash
git add -A && git commit -m "$(cat <<'EOF'
feat: card do Pipeline vira link e a setinha abre a ficha em outra guia

O corpo do card e o nome do consultor viram links de verdade, então
Ctrl+clique, botão do meio e "Abrir em nova aba" funcionam. O link envolve o
conteúdo em vez de esticar uma camada por cima, para os tooltips dos chips, do
motivo da perda e do consultor continuarem aparecendo. O <article> perde o
onClick e continua sendo o que se arrasta, com os links não arrastáveis.

A setinha do rodapé abre a ficha em outra guia já no clique simples, com o
rótulo dizendo isso: é assim que se abre vários cards sem sair do Pipeline.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: listas de Todos os leads, Clientes, Aulas e Visitas

**Files:**
- Modify: `src/views/LeadsView.jsx` (import da linha 16; hook da linha 27; linha 338-342; fechamento na linha 384)
- Modify: `src/views/ClientsView.jsx` (import da linha 12; hook da linha 76; linha 338-342; fechamento na linha 380)
- Modify: `src/views/AppointmentTrackingView.jsx` (import da linha 12; hook da linha 124; linha 658-665; fechamento na linha 759)
- Test: `src/lib/__tests__/listRowLinks.test.js` (novo)

As três linhas são o caso fácil: não há nada clicável dentro delas, então o `<div>` vira `<LeadLink>` direto, com as mesmas classes. `<a>` com `<div>` dentro é HTML válido, e o preflight do Tailwind já faz o link herdar cor e decoração.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/__tests__/listRowLinks.test.js`:

```js
// As linhas de Todos os leads, Clientes, Aulas e Visitas viraram link de
// verdade. As telas inteiras são renderizadas em node: o Firestore entra
// mockado, e o que se confere é o <a href> da linha.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

const h = vi.hoisted(() => ({ items: [] }));

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/usePagedLeads.js', () => ({
  usePagedLeads: () => ({ items: h.items, loading: false, hasMore: false, loadMore: () => {} }),
}));

const { LeadsView } = await import('../../views/LeadsView.jsx');
const { ClientsView } = await import('../../views/ClientsView.jsx');
const { AppointmentTrackingView } = await import('../../views/AppointmentTrackingView.jsx');

const TENANT = 'acad';
const profile = {
  openProfile: () => {},
  leadHref: (leadId) => hrefFor(TENANT, 'ficha', { leadId }),
  from: 'leads',
};
const appUser = { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad' };

function lead(extra = {}) {
  return {
    id: 'abc123', name: 'Ana Lima', whatsapp: '11999990000', status: 'Novo',
    consultantName: 'Bruno Souza', createdAt: new Date('2026-09-01'), ...extra,
  };
}

function render(element) {
  return renderToString(
    createElement(MemoryRouter, { initialEntries: ['/acad/leads'] },
      createElement(LeadProfileContext.Provider, { value: profile }, element)));
}

const listaProps = {
  interactions: [], appUser, statuses: [], usersList: [], funnels: [],
  selectedFunnelId: null, setSelectedFunnelId: () => {}, db: {},
};

describe('linhas das listas', () => {
  it('Todos os leads: a linha é um link para a ficha', () => {
    h.items = [lead()];
    const html = render(createElement(LeadsView, listaProps));
    expect(html).toContain('href="/acad/ficha/abc123"');
    expect(html).toContain('Ana Lima');
  });

  it('Todos os leads: a linha mantém a grade e o fundo de hover', () => {
    h.items = [lead()];
    const html = render(createElement(LeadsView, listaProps));
    const i = html.indexOf('href="/acad/ficha/abc123"');
    const linha = html.slice(html.lastIndexOf('<a ', i), i + 400);
    expect(linha).toContain('grid grid-cols-1');
    expect(linha).toContain('hover:bg-slate-50');
  });

  it('Clientes: a linha é um link para a ficha', () => {
    h.items = [lead({ lifecycleStage: 'cliente' })];
    const html = render(createElement(ClientsView, listaProps));
    expect(html).toContain('href="/acad/ficha/abc123"');
    expect(html).toContain('Ana Lima');
  });

  it('Aulas: a linha é um link para a ficha', () => {
    h.items = [lead({ appointmentType: 'aula_experimental', appointmentScheduledFor: new Date() })];
    const html = render(createElement(AppointmentTrackingView, {
      appUser, usersList: [], db: {}, appointmentType: 'aula_experimental',
    }));
    expect(html).toContain('href="/acad/ficha/abc123"');
  });

  it('Visitas: a linha é um link para a ficha', () => {
    h.items = [lead({ appointmentType: 'visita', appointmentScheduledFor: new Date() })];
    const html = render(createElement(AppointmentTrackingView, {
      appUser, usersList: [], db: {}, appointmentType: 'visita',
    }));
    expect(html).toContain('href="/acad/ficha/abc123"');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/listRowLinks.test.js
```

Esperado: os cinco testes falham, porque as linhas ainda são `<div>` com `onClick` e o html não tem `href`.

- [ ] **Step 3: Todos os leads**

Em `src/views/LeadsView.jsx`, linha 16. Antes:

```jsx
import { useLeadProfile } from '../contexts/LeadProfileContext.jsx';
```

Depois:

```jsx
import { LeadLink } from '../components/nav/AppLink.jsx';
```

Linha 27. Antes:

```jsx
  const { openProfile } = useLeadProfile();
```

Depois: apagar a linha.

Linhas 338-342. Antes:

```jsx
                <div
                  key={l.id}
                  onClick={() => openProfile(l.id)}
                  className="grid grid-cols-1 gap-2 md:gap-0 md:grid-cols-[1.7fr_1.15fr_1.25fr_0.75fr] md:items-center px-5 py-[11px] border-b border-slate-100 dark:border-neutral-800 last:border-b-0 cursor-pointer bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                >
```

Depois:

```jsx
                <LeadLink
                  key={l.id}
                  leadId={l.id}
                  className="grid grid-cols-1 gap-2 md:gap-0 md:grid-cols-[1.7fr_1.15fr_1.25fr_0.75fr] md:items-center px-5 py-[11px] border-b border-slate-100 dark:border-neutral-800 last:border-b-0 cursor-pointer bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                >
```

Fechamento, linhas 384-388. Antes:

```jsx
                </div>
              );
            })
          )}
        </div>
```

Depois:

```jsx
                </LeadLink>
              );
            })
          )}
        </div>
```

- [ ] **Step 4: Clientes**

Em `src/views/ClientsView.jsx`, linha 12. Antes:

```jsx
import { useLeadProfile } from '../contexts/LeadProfileContext.jsx';
```

Depois:

```jsx
import { LeadLink } from '../components/nav/AppLink.jsx';
```

Linha 76. Antes:

```jsx
  const { openProfile } = useLeadProfile();
```

Depois: apagar a linha.

Linhas 338-342. Antes:

```jsx
                <div
                  key={c.id}
                  onClick={() => openProfile(c.id)}
                  className="grid grid-cols-1 gap-2 md:gap-0 md:grid-cols-[1.8fr_1.2fr_0.9fr_0.9fr] md:items-center px-5 py-[11px] border-b border-slate-100 dark:border-neutral-800 last:border-b-0 cursor-pointer bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                >
```

Depois:

```jsx
                <LeadLink
                  key={c.id}
                  leadId={c.id}
                  className="grid grid-cols-1 gap-2 md:gap-0 md:grid-cols-[1.8fr_1.2fr_0.9fr_0.9fr] md:items-center px-5 py-[11px] border-b border-slate-100 dark:border-neutral-800 last:border-b-0 cursor-pointer bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                >
```

Fechamento, linhas 380-384. Antes:

```jsx
                </div>
              );
            })
          )}
        </div>
```

Depois:

```jsx
                </LeadLink>
              );
            })
          )}
        </div>
```

- [ ] **Step 5: Aulas e Visitas**

Em `src/views/AppointmentTrackingView.jsx`, linha 12. Antes:

```jsx
import { useLeadProfile } from '../contexts/LeadProfileContext.jsx';
```

Depois:

```jsx
import { LeadLink } from '../components/nav/AppLink.jsx';
```

Linha 124. Antes:

```jsx
  const { openProfile } = useLeadProfile();
```

Depois: apagar a linha.

Linhas 658-665. Antes:

```jsx
                  <div
                    key={l.id}
                    onClick={() => openProfile(l.id)}
                    className={cn(
                      'grid grid-cols-1 gap-2 md:gap-0 md:items-center px-5 py-3 border-b border-slate-100 dark:border-neutral-800 last:border-b-0 cursor-pointer bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors',
                      isAula ? 'md:grid-cols-[1.5fr_0.95fr_1fr_1fr_1.3fr_0.85fr]' : 'md:grid-cols-[1.5fr_0.95fr_1fr_1.3fr_0.85fr]'
                    )}
                  >
```

Depois:

```jsx
                  <LeadLink
                    key={l.id}
                    leadId={l.id}
                    className={cn(
                      'grid grid-cols-1 gap-2 md:gap-0 md:items-center px-5 py-3 border-b border-slate-100 dark:border-neutral-800 last:border-b-0 cursor-pointer bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors',
                      isAula ? 'md:grid-cols-[1.5fr_0.95fr_1fr_1fr_1.3fr_0.85fr]' : 'md:grid-cols-[1.5fr_0.95fr_1fr_1.3fr_0.85fr]'
                    )}
                  >
```

Fechamento, linhas 759-763. Antes:

```jsx
                  </div>
                );
              })
            )}
          </div>
```

Depois:

```jsx
                  </LeadLink>
                );
              })
            )}
          </div>
```

- [ ] **Step 6: Rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/listRowLinks.test.js
```

Esperado: `Test Files  1 passed (1)` e `Tests  5 passed (5)`.

- [ ] **Step 7: Suíte inteira e lint**

```bash
npx vitest run && npm run lint
```

Esperado: `Test Files  102 passed (102)`, `Tests  2080 passed (2080)`, lint com `✖ 1 problem (0 errors, 1 warning)`.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "$(cat <<'EOF'
feat: linhas de leads, clientes, aulas e visitas viram link

Cada linha das quatro listas passa a ser um <a href> da ficha, com as mesmas
classes de antes. Ctrl+clique, botão do meio e "Abrir em nova aba" funcionam,
e a lista continua onde estava.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Meta diária e visão Equipe

**Files:**
- Modify: `src/views/DailyGoalView.jsx` (import da linha 23; `TaskCard` nas linhas 338, 379-380, 384 e 453; `DoneCard` nas linhas 482, 489-492, 499 e 509-514; `TomorrowApptRow` novo antes do `DailyGoalView`; hook da linha 881; montagem do `TaskCard` na linha 1572; prévia de amanhã nas linhas 1673-1698; montagem do `DoneCard` na linha 1775)
- Modify: `src/views/team/ConsultantDayDetail.jsx` (import da linha 1; hook da linha 43; carteira nas linhas 86-106; prospecção nas linhas 141-158)
- Test: `src/lib/__tests__/metaLinks.test.js` (novo)

Aqui o link esticado pode ficar: nem o cabeçalho do `TaskCard` nem o corpo do `DoneCard` têm `title`, então a camada por cima não apaga tooltip nenhum. O container ganha `relative` (é ele que o `after:inset-0` usa de referência) e perde o `onClick`, senão o clique empilha duas entradas no histórico. Os botões de dentro ganham `relative z-10`, senão ficam por baixo da camada e param de responder.

**Ajustes da revisão de qualidade (22/09, depois do commit da Task 3).** O código e o teste finais diferem do escrito nos Steps abaixo nestes seis pontos:

- O teste da ação de prospecção sem lead subia até o `<span` mais próximo, que é o span interno do texto e nunca tem `href`. Ele passava mesmo com a regressão. A âncora agora é o `<li>`, que contém o wrapper inteiro, e a asserção procura `<a `. Comprovado sabotando o código: com o wrapper virando link de verdade, o teste falha.
- Um teste novo trava o risco principal do padrão esticado: os dois containers não podem voltar a ter `onClick`, senão o clique empilha duas entradas e o voltar do navegador passa a exigir dois cliques. O `renderToString` não mostra handler, então ele chama `TaskCard` e `DoneCard` como função (nenhum dos dois usa hook) e olha o elemento.
- O teste dos botões do rodapé conferia dois dos quatro que o nome prometia. Ligar e Adiar são `IconBtn` e ficariam sem guarda; agora os quatro entram no laço.
- Os dois links esticados ganham `draggable={false}`. Como o `::after` é da âncora, arrastar em qualquer ponto do cabeçalho do `TaskCard` ou do corpo do `DoneCard` viraria arrasto do endereço da ficha. O card do Kanban já resolveu isso na T1.
- O atalho do canto ganha `aria-label={`Abrir ficha de ${task.name}`}`, mesma saída da revisão da T1. Sem o nome, quem navega por lista de links ouve "Abrir ficha" repetido em cada card. O `title` continua sendo o tooltip do mouse.
- Os `e.stopPropagation()` do rodapé do `TaskCard` saíram, junto com o `e` que eles pediam em `handleSnooze`, `handleOutcome` e `handleGoalDone`. Eles existiam por causa de um `onClick` de cabeçalho que nunca foi ancestral do rodapé e agora nem existe. O `text-left` que veio dos `<button>` antigos também saiu: só o botão centraliza texto por padrão, em `<a>` e em `<span>` a classe não faz nada.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/__tests__/metaLinks.test.js`:

```js
// Meta diária e visão Equipe: todo nome que abre a ficha virou link. No
// TaskCard e no DoneCard o link é esticado (after:absolute after:inset-0) sobre
// um container com relative, e os botões de dentro sobem com relative z-10.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter',
  DAILY_GOAL_HISTORY_PATH: 'hist', db: {}, auth: {}, storage: {},
}));

const { TaskCard, DoneCard, TomorrowApptRow } = await import('../../views/DailyGoalView.jsx');
const { ConsultantDayDetail } = await import('../../views/team/ConsultantDayDetail.jsx');

const TENANT = 'acad';
const profile = {
  openProfile: () => {},
  leadHref: (leadId) => hrefFor(TENANT, 'ficha', { leadId }),
  from: 'dailyGoal',
};

const TASK = {
  id: 'abc123', name: 'Ana Lima', whatsapp: '11999990000',
  createdAt: new Date('2026-09-22T08:00:00'), categorySlugs: ['novo_24h'], categoryStatus: {},
};

function render(element) {
  return renderToString(
    createElement(MemoryRouter, { initialEntries: ['/acad/meta-diaria'] },
      createElement(LeadProfileContext.Provider, { value: profile }, element)));
}

const taskCard = () => render(createElement(TaskCard, {
  task: TASK, slug: 'novo_24h', now: new Date('2026-09-22T10:00:00'),
}));

const doneCard = () => render(createElement(DoneCard, {
  lead: { ...TASK, categorySlugs: ['visita_hoje'], categoryStatus: { visita_hoje: true } },
  onReschedule: () => {},
}));

describe('Meta diária', () => {
  it('TaskCard: o nome é link esticado para a ficha', () => {
    const html = taskCard();
    const i = html.indexOf('href="/acad/ficha/abc123"');
    expect(i).toBeGreaterThan(-1);
    const abertura = html.lastIndexOf('<a ', i);
    expect(html.slice(abertura, html.indexOf('</a>', i))).toContain('after:absolute after:inset-0');
  });

  it('TaskCard: o cabeçalho é o ancestral posicionado do link', () => {
    expect(taskCard()).toContain('class="relative p-3.5 flex items-start gap-3 cursor-pointer"');
  });

  it('TaskCard: o atalho do canto abre a ficha por cima do link esticado', () => {
    const html = taskCard();
    const i = html.indexOf('title="Abrir ficha"');
    expect(i).toBeGreaterThan(-1);
    // A tag inteira: o class sai depois do title no HTML renderizado.
    const abertura = html.lastIndexOf('<a ', i);
    expect(html.slice(abertura, html.indexOf('>', i))).toContain('relative z-10');
  });

  it('TaskCard: WhatsApp, Ligar, Adiar e Concluir continuam botões', () => {
    const html = taskCard();
    for (const rotulo of ['WhatsApp', 'Concluir']) {
      const i = html.indexOf(rotulo);
      expect(html.lastIndexOf('<button', i)).toBeGreaterThan(html.lastIndexOf('<a ', i));
    }
  });

  it('DoneCard: o nome é link esticado sobre um container posicionado', () => {
    const html = doneCard();
    expect(html).toContain('href="/acad/ficha/abc123"');
    expect(html).toContain('after:absolute after:inset-0');
    expect(html).toContain('relative flex items-center gap-3');
  });

  it('DoneCard: Remarcar continua botão por cima do link', () => {
    const html = doneCard();
    const i = html.indexOf('title="Remarcar agendamento"');
    expect(i).toBeGreaterThan(-1);
    const b = html.lastIndexOf('<button', i);
    expect(b).toBeGreaterThan(html.lastIndexOf('<a ', i));
    // No <button> o React respeita a ordem das props, e class vem depois de
    // title, então de novo a tag inteira.
    expect(html.slice(b, html.indexOf('>', i))).toContain('relative z-10');
  });

  it('prévia de amanhã: a linha é link para a ficha', () => {
    const html = render(createElement(TomorrowApptRow, {
      lead: { id: 'abc123', name: 'Ana Lima', whatsapp: '11999990000' },
      when: new Date('2026-09-23T09:00:00'),
    }));
    expect(html).toContain('href="/acad/ficha/abc123"');
    expect(html).toContain('Ana Lima');
  });
});

describe('visão Equipe', () => {
  const row = {
    cota: 3, prospDone: 1, hasCota: true, isPast: false,
    processed: [{ ...TASK }],
    prospAcoes: [
      { leadId: 'abc123', leadName: 'Ana Lima', label: 'Mensagem', at: new Date('2026-09-22T09:00:00') },
      { leadId: null, leadName: '', label: 'Ligação', at: new Date('2026-09-22T09:30:00') },
    ],
  };
  const detalhe = () => render(createElement(ConsultantDayDetail, { row, slaOverdueDays: 3 }));

  it('a carteira do dia vira link', () => {
    const html = detalhe();
    expect(html).toContain('href="/acad/ficha/abc123"');
    expect(html.match(/href="\/acad\/ficha\/abc123"/g).length).toBeGreaterThanOrEqual(2);
  });

  it('a prospecção sem lead fica sem link e sem hover de link', () => {
    const html = detalhe();
    const i = html.indexOf('Ligação');
    const abertura = html.lastIndexOf('<span', i);
    expect(html.slice(abertura, i)).not.toContain('href');
    expect(html).not.toContain('group-enabled:');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/metaLinks.test.js
```

Esperado: falha na importação, porque `TaskCard`, `DoneCard` e `TomorrowApptRow` ainda não são exportados.

- [ ] **Step 3: Trocar o import do contexto pelo do link**

Em `src/views/DailyGoalView.jsx`, linha 23. Antes:

```jsx
import { useLeadProfile } from '../contexts/LeadProfileContext.jsx';
```

Depois:

```jsx
import { LeadLink } from '../components/nav/AppLink.jsx';
```

- [ ] **Step 4: `TaskCard` sem `onOpen`, com o cabeçalho posicionado**

Linha 338. Antes:

```jsx
function TaskCard({ task, slug, now, slaOverdueDays = DEFAULT_SLA_OVERDUE_DAYS, onOpen, onSnooze, onOutcome, onReschedule, onGoalDone, onWhatsapp, onCall }) {
```

Depois:

```jsx
// Exportado para o teste em node conferir os links sem montar a tela inteira.
export function TaskCard({ task, slug, now, slaOverdueDays = DEFAULT_SLA_OVERDUE_DAYS, onSnooze, onOutcome, onReschedule, onGoalDone, onWhatsapp, onCall }) {
```

Linha 380. Antes:

```jsx
      <div className="p-3.5 flex items-start gap-3 cursor-pointer" onClick={() => onOpen && onOpen(task)}>
```

Depois:

```jsx
      {/* relative: é este cabeçalho que a camada do link esticado cobre. O
          onClick saiu, senão o clique empilharia duas entradas no histórico. */}
      <div className="relative p-3.5 flex items-start gap-3 cursor-pointer">
```

- [ ] **Step 5: O nome do `TaskCard` vira o link esticado**

Linha 384. Antes:

```jsx
            <span className="font-semibold text-[14px] text-slate-900 dark:text-white truncate">{task.name}</span>
```

Depois:

```jsx
            <LeadLink
              leadId={task.id}
              stretched
              className="font-semibold text-[14px] text-slate-900 dark:text-white truncate outline-none after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-brand-500/40"
            >
              {task.name}
            </LeadLink>
```

- [ ] **Step 6: O atalho do canto vira link**

Linha 453. Antes:

```jsx
          <IconBtn icon={<MoreHorizontal size={16} />} title="Mais" onClick={(e) => { e.stopPropagation(); onOpen && onOpen(task); }} />
```

Depois:

```jsx
          {/* relative z-10: sem isto ele fica por baixo da camada do link
              esticado e para de responder. */}
          <LeadLink
            leadId={task.id}
            tabIndex={-1}
            title="Abrir ficha"
            aria-label="Abrir ficha"
            className="relative z-10 w-8 h-8 grid place-items-center rounded-lg transition text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06]"
          >
            <MoreHorizontal size={16} />
          </LeadLink>
```

- [ ] **Step 7: `DoneCard` sem `onOpen`**

Linha 482. Antes:

```jsx
function DoneCard({ lead, onOpen, onReschedule }) {
```

Depois:

```jsx
export function DoneCard({ lead, onReschedule }) {
```

Linhas 489-492. Antes:

```jsx
    <div
      onClick={() => onOpen && onOpen(lead)}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.05] cursor-pointer hover:bg-white dark:hover:bg-white/[0.04] transition"
    >
```

Depois:

```jsx
    <div className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.05] cursor-pointer hover:bg-white dark:hover:bg-white/[0.04] transition">
```

Linha 499. Antes:

```jsx
          <span className="font-medium text-[13px] text-slate-800 dark:text-slate-100 line-through decoration-slate-400/60 truncate">{lead.name}</span>
```

Depois:

```jsx
          <LeadLink
            leadId={lead.id}
            stretched
            className="font-medium text-[13px] text-slate-800 dark:text-slate-100 line-through decoration-slate-400/60 truncate outline-none after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-brand-500/40"
          >
            {lead.name}
          </LeadLink>
```

Linhas 509-514 (o botão Remarcar). Antes:

```jsx
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onReschedule(lead, apptSlug); }}
          title="Remarcar agendamento"
          className="w-7 h-7 grid place-items-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] transition shrink-0"
        >
```

Depois:

```jsx
        <button
          type="button"
          onClick={() => onReschedule(lead, apptSlug)}
          title="Remarcar agendamento"
          className="relative z-10 w-7 h-7 grid place-items-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] transition shrink-0"
        >
```

- [ ] **Step 8: Criar o `TomorrowApptRow`**

Logo depois do `DoneCard` (a linha em branco antes do comentário `// Build a YYYY-MM-DDTHH:MM string in LOCAL time`), colar:

```jsx
// Uma linha da prévia de amanhã. É link de verdade, como as outras entradas da
// ficha, e fica num componente próprio para o teste em node conseguir
// renderizá-la sem montar a Meta inteira.
export function TomorrowApptRow({ lead, when }) {
  const { Icon, label } = dgApptTypeMeta(lead);
  return (
    <LeadLink
      leadId={lead.id}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] hover:border-slate-300 dark:hover:border-white/10 transition text-left"
    >
      <Avatar name={lead.name} size={38} />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-slate-900 dark:text-white truncate">{lead.name}</div>
        <div className="text-[12px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1"><Icon size={12} /> {label}</span>
          {lead.whatsapp && (
            <>
              <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-white/20" />
              <span className="num">{lead.whatsapp}</span>
            </>
          )}
        </div>
      </div>
      <span className="num text-[12.5px] font-semibold text-slate-600 dark:text-slate-300 shrink-0">{formatHourLabel(when)}</span>
    </LeadLink>
  );
}
```

- [ ] **Step 9: Tirar o hook e as três montagens**

Linha 881. Antes:

```jsx
  const { openProfile } = useLeadProfile();
```

Depois: apagar a linha.

Linha 1572 (dentro do `renderTaskCard`). Antes:

```jsx
      onOpen={(t) => openProfile(t.id)}
```

Depois: apagar a linha.

Linhas 1673-1698 (a prévia de amanhã). Antes:

```jsx
                    {tomorrowAppts.map(({ lead, when }) => {
                      const { Icon, label } = dgApptTypeMeta(lead);
                      return (
                        <button
                          key={lead.id}
                          type="button"
                          onClick={() => openProfile(lead.id)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] hover:border-slate-300 dark:hover:border-white/10 transition text-left"
                        >
                          <Avatar name={lead.name} size={38} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[14px] font-semibold text-slate-900 dark:text-white truncate">{lead.name}</div>
                            <div className="text-[12px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1"><Icon size={12} /> {label}</span>
                              {lead.whatsapp && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-white/20" />
                                  <span className="num">{lead.whatsapp}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <span className="num text-[12.5px] font-semibold text-slate-600 dark:text-slate-300 shrink-0">{formatHourLabel(when)}</span>
                        </button>
                      );
                    })}
```

Depois:

```jsx
                    {tomorrowAppts.map(({ lead, when }) => (
                      <TomorrowApptRow key={lead.id} lead={lead} when={when} />
                    ))}
```

Linha 1775 (a montagem do `DoneCard`). Antes:

```jsx
                    onOpen={(l) => openProfile(l.id)}
```

Depois: apagar a linha.

Conferir que não sobrou nada:

```bash
git grep -n -E "openProfile|onOpen=" src/views/DailyGoalView.jsx
```

Esperado: nenhuma linha.

- [ ] **Step 10: Visão Equipe, a carteira do dia**

Em `src/views/team/ConsultantDayDetail.jsx`, linha 1. Antes:

```jsx
import { useLeadProfile } from '../../contexts/LeadProfileContext.jsx';
```

Depois:

```jsx
import { LeadLink } from '../../components/nav/AppLink.jsx';
```

Linha 43. Antes:

```jsx
  const { openProfile } = useLeadProfile();
```

Depois: apagar a linha.

Linhas 86-106. Antes:

```jsx
                      <button
                        type="button"
                        onClick={() => openProfile(lead.id)}
                        className="w-full flex items-center gap-2 text-left group"
                      >
                        <i
                          className={cn('size-[7px] rounded-full shrink-0', done ? 'bg-success' : critical ? 'bg-danger' : 'bg-brand-200 dark:bg-brand-500/50')}
                          aria-hidden="true"
                        />
                        {/* Concluído recua: é lista de trabalho, não relatório —
                            o olho tem que cair no que falta. */}
                        <span className={cn(
                          'flex-1 min-w-0 truncate text-[12px] transition group-hover:text-brand-600 dark:group-hover:text-brand-400',
                          done && 'line-through opacity-55'
                        )}>
                          {lead.name || 'Sem nome'}
                        </span>
                        <span className={cn('shrink-0 text-[10.5px] num', critical ? 'text-rose-700 dark:text-rose-300 font-semibold' : 'text-slate-400 dark:text-slate-500')}>
                          {text}
                        </span>
                      </button>
```

Depois:

```jsx
                      <LeadLink leadId={lead.id} className="w-full flex items-center gap-2 text-left group">
                        <i
                          className={cn('size-[7px] rounded-full shrink-0', done ? 'bg-success' : critical ? 'bg-danger' : 'bg-brand-200 dark:bg-brand-500/50')}
                          aria-hidden="true"
                        />
                        {/* Concluído recua: é lista de trabalho, não relatório —
                            o olho tem que cair no que falta. */}
                        <span className={cn(
                          'flex-1 min-w-0 truncate text-[12px] transition group-hover:text-brand-600 dark:group-hover:text-brand-400',
                          done && 'line-through opacity-55'
                        )}>
                          {lead.name || 'Sem nome'}
                        </span>
                        <span className={cn('shrink-0 text-[10.5px] num', critical ? 'text-rose-700 dark:text-rose-300 font-semibold' : 'text-slate-400 dark:text-slate-500')}>
                          {text}
                        </span>
                      </LeadLink>
```

- [ ] **Step 11: Visão Equipe, a prospecção do dia**

Linhas 141-158. O conteúdo da linha é o mesmo nos dois ramos, então ele sai do JSX e vira uma variável do próprio `map`. Nada de função dentro do render, que o `react-hooks/static-components` reprova. Antes:

```jsx
                const temNome = Boolean(a.leadName) && a.leadName !== '—';
                return (
                  <li key={`${a.leadId || 'sem'}-${i}`}>
                    <button
                      type="button"
                      disabled={!a.leadId}
                      onClick={() => a.leadId && openProfile(a.leadId)}
                      className="w-full flex items-center gap-2 text-left group disabled:cursor-default"
                    >
                      <i className="size-[7px] rounded-full bg-accent-500 shrink-0" aria-hidden="true" />
                      <span className={cn(
                        'flex-1 min-w-0 truncate text-[12px] transition group-enabled:group-hover:text-brand-600 dark:group-enabled:group-hover:text-brand-400',
                        !temNome && 'text-slate-500 dark:text-slate-400'
                      )}>
                        {temNome ? a.leadName : a.label}
                      </span>
                      <span className="shrink-0 text-[10.5px] num text-slate-400 dark:text-slate-500">{fmtHora(a.at)}</span>
                    </button>
```

Depois:

```jsx
                const temNome = Boolean(a.leadName) && a.leadName !== '—';
                // A cor de hover deixa de depender de group-enabled: ":enabled"
                // só existe em controle de formulário, nunca num <a>.
                const conteudo = (
                  <>
                    <i className="size-[7px] rounded-full bg-accent-500 shrink-0" aria-hidden="true" />
                    <span className={cn(
                      'flex-1 min-w-0 truncate text-[12px] transition',
                      a.leadId && 'group-hover:text-brand-600 dark:group-hover:text-brand-400',
                      !temNome && 'text-slate-500 dark:text-slate-400'
                    )}>
                      {temNome ? a.leadName : a.label}
                    </span>
                    <span className="shrink-0 text-[10.5px] num text-slate-400 dark:text-slate-500">{fmtHora(a.at)}</span>
                  </>
                );
                return (
                  <li key={`${a.leadId || 'sem'}-${i}`}>
                    {/* Ação cujo lead saiu da base não vira link. */}
                    {a.leadId ? (
                      <LeadLink leadId={a.leadId} className="w-full flex items-center gap-2 text-left group">
                        {conteudo}
                      </LeadLink>
                    ) : (
                      <span className="w-full flex items-center gap-2 text-left group cursor-default">
                        {conteudo}
                      </span>
                    )}
```

- [ ] **Step 12: Rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/metaLinks.test.js
```

Esperado: `Test Files  1 passed (1)` e `Tests  10 passed (10)`.

- [ ] **Step 13: Suíte inteira e lint**

```bash
npx vitest run && npm run lint
```

Esperado: `Test Files  103 passed (103)`, `Tests  2092 passed (2092)`, lint com `✖ 1 problem (0 errors, 1 warning)`.

- [ ] **Step 14: Commit**

```bash
git add -A && git commit -m "$(cat <<'EOF'
feat: Meta diária e visão Equipe abrem a ficha por link

TaskCard, DoneCard, a prévia de amanhã e as duas listas da visão Equipe passam
a abrir a ficha por <a href>. Nos cards o link é esticado sobre o container, que
ganha relative e perde o onClick, e os botões de dentro sobem com relative z-10
para continuarem respondendo.

Na prospecção da Equipe a cor de hover deixa de depender de group-enabled, que
não vale em link, e a ação sem lead vira texto sem link.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: busca global e sino

**Files:**
- Modify: `src/components/layout/GlobalSearch.jsx` (import da linha 7; `SearchResultRow` novo antes do `GlobalSearch`; `pick` e `close` nas linhas 118-122; a lista nas linhas 186-214)
- Modify: `src/components/layout/NotificationBell.jsx` (import da linha 6; `Row` nas linhas 36-57; hook da linha 61; as três montagens nas linhas 120-166)
- Test: `src/lib/__tests__/searchBellLinks.test.js` (novo)

A busca tem uma armadilha própria: hoje a escolha acontece no `onMouseDown` do `<li>`, que limpa a busca e desmonta a lista antes de o clique chegar. Um link ali nunca receberia o clique, e Ctrl+clique ou botão do meio abririam a ficha na mesma guia. A escolha passa para o clique do link, e o mousedown fica só com o `preventDefault` do botão esquerdo, que é o que mantém o foco no campo.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/__tests__/searchBellLinks.test.js`:

```js
// Busca global e sino. Nos dois, Ctrl+clique precisa abrir a ficha em outra aba
// E deixar a lista aberta, para dar para abrir várias. O Link do React Router é
// embrulhado por um espião, para simular o clique chamando o onClick que o
// AppLink entregou a ele.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { deriveLeadState, getTone } from '../leadState.js';
import { hrefFor } from '../routes.js';

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

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', db: {}, auth: {}, storage: {},
}));

const { SearchResultRow } = await import('../../components/layout/GlobalSearch.jsx');
const { NotificationRow } = await import('../../components/layout/NotificationBell.jsx');

const TENANT = 'acad';
const profile = {
  openProfile: () => {},
  leadHref: (leadId) => hrefFor(TENANT, 'ficha', { leadId }),
  from: 'kanban',
};

const LEAD = { id: 'abc123', name: 'Ana Lima', whatsapp: '11999990000', status: 'Novo', createdAt: new Date('2026-09-20') };

function linhaDaBusca() {
  const state = deriveLeadState(LEAD, new Date(), 30);
  return { lead: LEAD, matchKind: 'phone', matchRange: null, state, tone: getTone(state.tone), splitHex: null };
}

function render(element) {
  return renderToString(
    createElement(MemoryRouter, { initialEntries: ['/acad/pipeline'] },
      createElement(LeadProfileContext.Provider, { value: profile }, element)));
}

function click(overrides = {}) {
  return {
    button: 0, metaKey: false, altKey: false, ctrlKey: false, shiftKey: false,
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    ...overrides,
  };
}

const ultimoLink = () => m.linkProps[m.linkProps.length - 1];

beforeEach(() => { m.linkProps.length = 0; });

describe('busca global', () => {
  it('o resultado é um link para a ficha, fora da ordem do Tab', () => {
    const html = render(createElement(SearchResultRow, {
      row: linhaDaBusca(), active: true, onHover: () => {}, onNavigate: () => {},
    }));
    expect(html).toContain('href="/acad/ficha/abc123"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('Ana Lima');
  });

  it('o mousedown do botão esquerdo segura o foco no campo', () => {
    const el = SearchResultRow({ row: linhaDaBusca(), active: false, onHover: () => {}, onNavigate: () => {} });
    const evento = click();
    el.props.onMouseDown(evento);
    expect(evento.defaultPrevented).toBe(true);
  });

  it('o mousedown do botão do meio fica com o navegador', () => {
    const el = SearchResultRow({ row: linhaDaBusca(), active: false, onHover: () => {}, onNavigate: () => {} });
    const evento = click({ button: 1 });
    el.props.onMouseDown(evento);
    expect(evento.defaultPrevented).toBe(false);
  });

  it('o clique simples fecha a busca e o Ctrl+clique não', () => {
    const onNavigate = vi.fn();
    render(createElement(SearchResultRow, {
      row: linhaDaBusca(), active: false, onHover: () => {}, onNavigate,
    }));
    ultimoLink().onClick(click());
    expect(onNavigate).toHaveBeenCalledTimes(1);
    ultimoLink().onClick(click({ ctrlKey: true }));
    ultimoLink().onClick(click({ button: 1 }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});

describe('sino', () => {
  const linha = (props) => render(createElement(NotificationRow, {
    icon: null, tone: 'bg-brand-50', title: 'Ana Lima é sua responsabilidade agora',
    subtitle: 'Passado por Bruno', time: 'há 2 h', unread: true, ...props,
  }));

  it('"Passaram para você" é link para a ficha', () => {
    const html = linha({ leadId: 'abc123', action: 'Abrir ficha', onNavigate: () => {} });
    expect(html).toContain('href="/acad/ficha/abc123"');
    expect(html).toContain('Ana Lima é sua responsabilidade agora');
  });

  it('a novidade, sem lead, continua botão', () => {
    const html = linha({ title: 'Novidade do sistema', onClick: () => {} });
    expect(html).toContain('<button');
    expect(html).not.toContain('<a ');
  });

  it('o clique simples fecha o sino e o Ctrl+clique não', () => {
    const onNavigate = vi.fn();
    linha({ leadId: 'abc123', onNavigate });
    ultimoLink().onClick(click());
    expect(onNavigate).toHaveBeenCalledTimes(1);
    ultimoLink().onClick(click({ metaKey: true }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/searchBellLinks.test.js
```

Esperado: falha na importação, porque `SearchResultRow` e `NotificationRow` ainda não existem.

- [ ] **Step 3: Importar o link na busca**

Em `src/components/layout/GlobalSearch.jsx`, linha 7. Antes:

```jsx
import { useLeadProfile } from '../../contexts/LeadProfileContext.jsx';
```

Depois:

```jsx
import { useLeadProfile } from '../../contexts/LeadProfileContext.jsx';
import { LeadLink } from '../nav/AppLink.jsx';
```

O `useLeadProfile` fica: o Enter continua abrindo na mesma aba pelo `openProfile`.

- [ ] **Step 4: Criar o `SearchResultRow`**

Logo depois do `HighlightedName` (antes do comentário `// Barra de busca global fixa no header`), colar:

```jsx
// Uma linha do resultado. O conteúdo é um link de verdade, então Ctrl+clique e
// botão do meio abrem a ficha em outra aba e a lista continua aberta com o
// texto digitado, para dar para abrir várias. O mousedown só segura o foco no
// campo: quem escolhe é o clique do link. Antes a escolha acontecia no
// mousedown, e a lista sumia antes de o clique chegar.
export function SearchResultRow({ row, active, onHover, onNavigate }) {
  const lead = row.lead;
  const sub = row.matchKind === 'cpf'
    ? `CPF ${fmtCpf(lead.cpf)}`
    : (fmtPhone(lead.whatsapp) || row.state.hint);
  return (
    <li
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onMouseDown={(e) => { if (e.button === 0) e.preventDefault(); }}
    >
      <LeadLink
        leadId={lead.id}
        tabIndex={-1}
        onNavigate={onNavigate}
        className={cn('flex items-center gap-3 px-2.5 py-2 rounded-xl cursor-pointer', active && 'bg-slate-100 dark:bg-white/[0.05]')}
      >
        <StateRingAvatar name={lead.name} toneName={row.state.tone} splitHex={row.splitHex} size={30} photoUrl={lead.photoUrl} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] text-gray-900 dark:text-white truncate">
            <HighlightedName name={lead.name || 'Sem nome'} range={row.matchRange} />
          </div>
          <div className="text-[11.5px] text-slate-400 truncate">{sub}</div>
        </div>
        <span className={cn('text-[10.5px] font-semibold px-2 py-0.5 rounded-lg shrink-0 whitespace-nowrap', row.tone.soft, row.tone.text, row.tone.darkSoft, row.tone.darkText)}>
          {row.state.label}
        </span>
      </LeadLink>
    </li>
  );
}
```

- [ ] **Step 5: `close` separado do `pick`**

Linhas 118-122. Antes:

```jsx
  const pick = useCallback((lead) => {
    if (!lead) return;
    openProfile(lead.id);
    setQuery(''); setOpen(false); setMobileOpen(false);
  }, [openProfile]);
```

Depois:

```jsx
  // Fecha e limpa a barra. Roda só no clique que abre a ficha nesta aba: com
  // Ctrl+clique ou botão do meio a lista continua aberta.
  const close = useCallback(() => { setQuery(''); setOpen(false); setMobileOpen(false); }, []);

  // Só o Enter ainda navega por aqui. O clique do mouse é do link.
  const pick = useCallback((lead) => {
    if (!lead) return;
    openProfile(lead.id);
    close();
  }, [openProfile, close]);
```

- [ ] **Step 6: A lista usa o `SearchResultRow`**

Linhas 186-214. Antes:

```jsx
        <ul id="global-search-list" role="listbox" className="max-h-[380px] overflow-y-auto p-1.5 custom-scrollbar">
          {rows.map((r, i) => {
            const lead = r.lead;
            const sub = r.matchKind === 'cpf'
              ? `CPF ${fmtCpf(lead.cpf)}`
              : (fmtPhone(lead.whatsapp) || r.state.hint);
            return (
              <li
                key={lead.id}
                role="option"
                aria-selected={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(lead); }}
                className={cn('flex items-center gap-3 px-2.5 py-2 rounded-xl cursor-pointer', i === activeIndex && 'bg-slate-100 dark:bg-white/[0.05]')}
              >
                <StateRingAvatar name={lead.name} toneName={r.state.tone} splitHex={r.splitHex} size={30} photoUrl={lead.photoUrl} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-gray-900 dark:text-white truncate">
                    <HighlightedName name={lead.name || 'Sem nome'} range={r.matchRange} />
                  </div>
                  <div className="text-[11.5px] text-slate-400 truncate">{sub}</div>
                </div>
                <span className={cn('text-[10.5px] font-semibold px-2 py-0.5 rounded-lg shrink-0 whitespace-nowrap', r.tone.soft, r.tone.text, r.tone.darkSoft, r.tone.darkText)}>
                  {r.state.label}
                </span>
              </li>
            );
          })}
        </ul>
```

Depois:

```jsx
        <ul id="global-search-list" role="listbox" className="max-h-[380px] overflow-y-auto p-1.5 custom-scrollbar">
          {rows.map((r, i) => (
            <SearchResultRow
              key={r.lead.id}
              row={r}
              active={i === activeIndex}
              onHover={() => setActiveIndex(i)}
              onNavigate={close}
            />
          ))}
        </ul>
```

- [ ] **Step 7: Sino, o import**

Em `src/components/layout/NotificationBell.jsx`, linha 6. Antes:

```jsx
import { useLeadProfile } from '../../contexts/LeadProfileContext.jsx';
```

Depois:

```jsx
import { LeadLink } from '../nav/AppLink.jsx';
```

Linha 61. Antes:

```jsx
  const { openProfile } = useLeadProfile();
```

Depois: apagar a linha.

- [ ] **Step 8: `Row` vira `NotificationRow` e aceita `leadId`**

Linhas 36-57. Antes:

```jsx
function Row({ icon, tone, title, subtitle, time, unread, action, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.04]"
    >
      {unread && <span className="absolute left-1 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-brand-600 dark:bg-brand-400" />}
      <span className={cn('size-8 rounded-[10px] grid place-items-center shrink-0', tone)}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold leading-snug text-slate-900 dark:text-white">{title}</span>
        {subtitle && <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">{subtitle}</span>}
        {action && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-300 mt-1">
            {action} <ArrowRight size={11} />
          </span>
        )}
        {time && <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{time}</span>}
      </span>
    </button>
  );
}
```

Depois:

```jsx
// Uma linha do sino. Com leadId é link de verdade: Ctrl+clique abre a ficha em
// outra aba e o sino continua aberto, então dá para abrir várias. Sem leadId
// continua botão, que é o caso da novidade abrindo a Central de ajuda.
export function NotificationRow({ icon, tone, title, subtitle, time, unread, action, onClick, leadId = null, onNavigate }) {
  const classes = 'relative w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.04]';
  const conteudo = (
    <>
      {unread && <span className="absolute left-1 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-brand-600 dark:bg-brand-400" />}
      <span className={cn('size-8 rounded-[10px] grid place-items-center shrink-0', tone)}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold leading-snug text-slate-900 dark:text-white">{title}</span>
        {subtitle && <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">{subtitle}</span>}
        {action && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-300 mt-1">
            {action} <ArrowRight size={11} />
          </span>
        )}
        {time && <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{time}</span>}
      </span>
    </>
  );

  if (leadId) {
    return (
      <LeadLink leadId={leadId} onNavigate={onNavigate} className={classes}>
        {conteudo}
      </LeadLink>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {conteudo}
    </button>
  );
}
```

- [ ] **Step 9: As três montagens do sino**

Linhas 120-135 (novidades). Antes:

```jsx
            <Row
              key={n.id}
```

Depois:

```jsx
            <NotificationRow
              key={n.id}
```

Linhas 138-151 ("Passaram para você"). Antes:

```jsx
            <Row
              key={h.id}
              icon={<UserRoundPlus size={15} />}
              tone="bg-brand-50 text-brand-600 dark:bg-brand-500/12 dark:text-brand-300"
              title={`${h.name} é sua responsabilidade agora`}
              subtitle={[h.byName ? `Passado por ${h.byName}` : null, h.isClient ? 'Aluno' : null]
                .filter(Boolean).join(' · ') || null}
              time={relTime(h.at)}
              unread={h.unread}
              action="Abrir ficha"
              onClick={() => { setOpen(false); openProfile(h.id); }}
            />
```

Depois:

```jsx
            <NotificationRow
              key={h.id}
              icon={<UserRoundPlus size={15} />}
              tone="bg-brand-50 text-brand-600 dark:bg-brand-500/12 dark:text-brand-300"
              title={`${h.name} é sua responsabilidade agora`}
              subtitle={[h.byName ? `Passado por ${h.byName}` : null, h.isClient ? 'Aluno' : null]
                .filter(Boolean).join(' · ') || null}
              time={relTime(h.at)}
              unread={h.unread}
              action="Abrir ficha"
              leadId={h.id}
              onNavigate={() => setOpen(false)}
            />
```

Linhas 154-166 (indicações). Antes:

```jsx
            <Row
              key={r.id}
              icon={<Handshake size={15} />}
              tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-300"
              title={`${r.name} entrou por indicação`}
              subtitle={[r.referredByName ? `Indicado por ${r.referredByName}` : null, r.modalidade]
                .filter(Boolean).join(' · ') || null}
              time={relTime(r.at)}
              unread={r.unread}
              onClick={() => { setOpen(false); openProfile(r.id); }}
            />
```

Depois:

```jsx
            <NotificationRow
              key={r.id}
              icon={<Handshake size={15} />}
              tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-300"
              title={`${r.name} entrou por indicação`}
              subtitle={[r.referredByName ? `Indicado por ${r.referredByName}` : null, r.modalidade]
                .filter(Boolean).join(' · ') || null}
              time={relTime(r.at)}
              unread={r.unread}
              leadId={r.id}
              onNavigate={() => setOpen(false)}
            />
```

- [ ] **Step 10: Rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/searchBellLinks.test.js
```

Esperado: `Test Files  1 passed (1)` e `Tests  7 passed (7)`.

- [ ] **Step 11: Suíte inteira e lint**

```bash
npx vitest run && npm run lint
```

Esperado: `Test Files  104 passed (104)`, `Tests  2096 passed (2096)`, lint com `✖ 1 problem (0 errors, 1 warning)`.

- [ ] **Step 12: Commit**

```bash
git add -A && git commit -m "$(cat <<'EOF'
feat: busca global e sino abrem a ficha por link

Na busca, a escolha sai do mousedown e vai para o clique do link: antes a lista
sumia antes de o clique chegar, e Ctrl+clique abria na mesma guia. O mousedown
fica só com o preventDefault do botão esquerdo, que segura o foco no campo.

No sino, "Passaram para você" e as indicações viram link. O clique simples fecha
o sino; com Ctrl ele continua aberto, para abrir várias fichas.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: ficha e indicações

**Files:**
- Modify: `src/views/LeadProfileView.jsx` (import da linha 27; hook da linha 121; "Indicado por" nas linhas 1222-1228)
- Modify: `src/components/profile/ReferralsSection.jsx` (import da linha 9; hook da linha 33; o item nas linhas 79-83 e 101-103)
- Test: `src/lib/__tests__/profileLinks.test.js` (novo)

De ficha para ficha. O "Indicado por" e a aba Indicações são os dois caminhos, e o lápis do vínculo, que é irmão do texto, continua botão.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/__tests__/profileLinks.test.js`:

```js
// Da ficha para outra ficha: "Indicado por" e a aba Indicações. O LeadProfileView
// lê window.location.origin no render (link de indicação), por isso o window
// falso.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

// CONTRACTS_PATH entra porque a ficha o importa. Hoje ela não o usa no render,
// mas sem ele no mock o dia em que voltar a usar quebra este teste aqui, longe
// de onde a mudança aconteceu.
vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useLeadTimeline.js', () => ({ useLeadTimeline: () => [] }));
vi.stubGlobal('window', { location: { origin: 'https://stronilead.com.br' } });

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');
const { ReferralsSection } = await import('../../components/profile/ReferralsSection.jsx');

const TENANT = 'acad';
const profile = {
  openProfile: () => {},
  leadHref: (leadId) => hrefFor(TENANT, 'ficha', { leadId }),
  from: null,
};

const LEAD = {
  id: 'abc123', name: 'Ana Lima', whatsapp: '11999990000', status: 'Novo',
  createdAt: new Date('2026-09-01'), referredById: 'zzz999', referredByName: 'Carla Dias',
};

function render(element) {
  return renderToString(
    createElement(MemoryRouter, { initialEntries: ['/acad/ficha/abc123'] },
      createElement(LeadProfileContext.Provider, { value: profile }, element)));
}

// authUid é o que faz a ficha renderizar em modo de edição (canEditLead). Sem
// ele o lápis do vínculo nem aparece no HTML.
const ficha = (lead = LEAD) => render(createElement(LeadProfileView, {
  lead, onBack: () => {}, appUser: { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad', authUid: 'auth-1' },
  statuses: [], tags: [], lossReasons: [], usersList: [], db: {}, funnels: [],
}));

describe('ficha', () => {
  // "Indicado por {nome}" são dois filhos de texto, e o renderToString os
  // separa com um comentário: o HTML real é "Indicado por <!-- -->Carla Dias".
  // Por isso a busca é só pelo pedaço fixo, e o nome se confere à parte.
  it('"Indicado por" é link para a ficha de quem indicou', () => {
    const html = ficha();
    const i = html.indexOf('Indicado por');
    expect(i).toBeGreaterThan(-1);
    const abertura = html.lastIndexOf('<a ', i);
    expect(html.slice(abertura, i)).toContain('href="/acad/ficha/zzz999"');
    expect(html).toContain('Carla Dias');
  });

  it('indicação sem id fica texto sem link', () => {
    const html = ficha({ ...LEAD, referredById: null });
    const i = html.indexOf('Indicado por');
    expect(i).toBeGreaterThan(-1);
    expect(html.slice(html.lastIndexOf('<', i), i)).not.toContain('href');
  });

  it('o lápis do vínculo continua botão', () => {
    const html = ficha();
    const i = html.indexOf('title="Editar vínculo de indicação"');
    expect(i).toBeGreaterThan(-1);
    expect(html.lastIndexOf('<button', i)).toBeGreaterThan(html.lastIndexOf('<a ', i));
  });
});

describe('aba Indicações', () => {
  const lista = () => render(createElement(ReferralsSection, {
    items: [{ id: 'zzz999', name: 'Carla Dias', referredAt: new Date('2026-09-10') }],
    loading: false,
  }));

  it('cada indicado é um link para a ficha', () => {
    const html = lista();
    expect(html).toContain('href="/acad/ficha/zzz999"');
    expect(html).toContain('Carla Dias');
  });

  it('a linha mantém as classes de antes', () => {
    const html = lista();
    const i = html.indexOf('href="/acad/ficha/zzz999"');
    const linha = html.slice(html.lastIndexOf('<a ', i), i + 300);
    expect(linha).toContain('w-full flex items-center gap-3');
    expect(linha).toContain('hover:bg-slate-50');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/profileLinks.test.js
```

Esperado: os cinco testes falham (hoje os dois pontos são `<button>`, então não há `href`).

- [ ] **Step 3: "Indicado por" na ficha**

Em `src/views/LeadProfileView.jsx`, linha 27. Antes:

```jsx
import { useLeadProfile } from '../contexts/LeadProfileContext.jsx';
```

Depois:

```jsx
import { LeadLink } from '../components/nav/AppLink.jsx';
```

Linha 121. Antes:

```jsx
  const { openProfile } = useLeadProfile();
```

Depois: apagar a linha.

Linhas 1222-1228. Antes:

```jsx
                    <button
                      type="button"
                      onClick={() => lead.referredById && openProfile(lead.referredById)}
                      className={cn('hover:underline', !lead.referredById && 'pointer-events-none')}
                    >
                      Indicado por {lead.referredByName || 'cliente'}
                    </button>
```

Depois:

```jsx
                    <LeadLink
                      leadId={lead.referredById}
                      className={cn('hover:underline', !lead.referredById && 'pointer-events-none')}
                    >
                      Indicado por {lead.referredByName || 'cliente'}
                    </LeadLink>
```

- [ ] **Step 4: A aba Indicações**

Em `src/components/profile/ReferralsSection.jsx`, linha 9. Antes:

```jsx
import { useLeadProfile } from '../../contexts/LeadProfileContext.jsx';
```

Depois:

```jsx
import { LeadLink } from '../nav/AppLink.jsx';
```

Linha 33. Antes:

```jsx
  const { openProfile } = useLeadProfile();
```

Depois: apagar a linha.

Linhas 79-83. Antes:

```jsx
                <button
                  type="button"
                  onClick={() => openProfile(l.id)}
                  className="w-full flex items-center gap-3 px-5 sm:px-8 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/[0.03] transition"
                >
```

Depois:

```jsx
                <LeadLink
                  leadId={l.id}
                  className="w-full flex items-center gap-3 px-5 sm:px-8 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/[0.03] transition"
                >
```

Linhas 101-103. Antes:

```jsx
                  </span>
                </button>
              </li>
```

Depois:

```jsx
                  </span>
                </LeadLink>
              </li>
```

- [ ] **Step 5: Rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/profileLinks.test.js
```

Esperado: `Test Files  1 passed (1)` e `Tests  5 passed (5)`.

- [ ] **Step 6: Suíte inteira e lint**

```bash
npx vitest run && npm run lint
```

Esperado: `Test Files  105 passed (105)`, `Tests  2101 passed (2101)`, lint com `✖ 1 problem (0 errors, 1 warning)`.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "$(cat <<'EOF'
feat: "Indicado por" e a aba Indicações abrem a ficha por link

Os dois caminhos de ficha para ficha viram <a href>. O lápis do vínculo, que é
irmão do texto, continua botão, e indicação sem id continua texto sem link.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: varredura, documentação, verificação final e corpo do PR

**Files:**
- Test: `src/lib/__tests__/leadLinkSweep.test.js` (novo)
- Modify: `CLAUDE.md` (o item "Links" da seção "Endereço de cada tela")
- Modify: `docs/superpowers/specs/2026-09-21-endereco-por-tela-design.md` (a decisão 11, o item "Card do Pipeline" de "Links" e a entrega 3)
- Criar fora do repositório: `/private/tmp/claude-501/-Users-johnnybittencourt-STRONIX-FIRMA-06-sistemas-stronilead--claude-worktrees-unruffled-chatterjee-6036f8/2eddd9e5-4fce-4c8d-ac5f-ba368c8db54e/scratchpad/pr3-body.md`

**Depende de:** T1 a T5.

- [ ] **Step 1: A varredura que segura a regra**

Criar `src/lib/__tests__/leadLinkSweep.test.js`:

```js
// Abrir a ficha é ir para um endereço, então o caminho é sempre um link. Esta
// varredura cobra isso de toda tela e todo componente: quem abrir ficha por
// onClick={() => openProfile(id)} de novo derruba o CI. Fora da lista ficam o
// App.jsx (dono do openProfile, que o cadastro usa em "Ver ficha") e a busca
// global (o Enter do teclado navega na mesma aba).
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

function usamOpenProfile(pasta) {
  return sourceFiles(join(SRC, pasta))
    .filter((file) => readFileSync(file, 'utf8').includes('openProfile'))
    .map((file) => relative(SRC, file))
    .sort();
}

describe('ficha se abre por link', () => {
  it('só a busca global ainda chama openProfile fora do App', () => {
    expect([...usamOpenProfile('views'), ...usamOpenProfile('components')])
      .toEqual(['components/layout/GlobalSearch.jsx']);
  });

  it('a varredura não está cega: o App e o contexto continuam com openProfile', () => {
    expect(readFileSync(join(SRC, 'App.jsx'), 'utf8')).toContain('openProfile');
    expect(readFileSync(join(SRC, 'contexts/LeadProfileContext.jsx'), 'utf8')).toContain('openProfile');
  });
});
```

- [ ] **Step 2: Rodar a varredura**

```bash
npx vitest run src/lib/__tests__/leadLinkSweep.test.js
```

Esperado: `Test Files  1 passed (1)` e `Tests  2 passed (2)`. Se a lista vier maior, algum ponto das T1 a T5 ficou para trás: o próprio erro mostra qual arquivo.

- [ ] **Step 3: `CLAUDE.md`**

Na seção "Endereço de cada tela", o item que começa com `- **Links.**`. Antes:

```md
- **Links.** `AppLink` e `LeadLink` (`src/components/nav/AppLink.jsx`) ficam por cima do `Link` do React Router, que só intercepta o clique esquerdo simples. Por isso Ctrl+clique, botão do meio e "Abrir em nova aba" funcionam. `onNavigate` roda só quando o clique troca de tela nesta aba. O `App.jsx` monta os links do menu com `hrefFor` e a academia do claim, nunca a da barra, porque hook que lê contexto não enxerga o Provider do próprio componente. Quem está abaixo dele usa `LeadLink`, que lê `leadHref` e `from` do `LeadProfileContext`.
```

Depois:

```md
- **Links.** `AppLink` e `LeadLink` (`src/components/nav/AppLink.jsx`) ficam por cima do `Link` do React Router, que só intercepta o clique esquerdo simples. Por isso Ctrl+clique, botão do meio e "Abrir em nova aba" funcionam. `onNavigate` roda só quando o clique troca de tela nesta aba. O `App.jsx` monta os links do menu com `hrefFor` e a academia do claim, nunca a da barra, porque hook que lê contexto não enxerga o Provider do próprio componente. Quem está abaixo dele usa `LeadLink`, que lê `leadHref` e `from` do `LeadProfileContext`.
- **Abrir a ficha é sempre um link.** Card do Pipeline, listas de Leads, Clientes, Aulas e Visitas, Meta diária, visão Equipe, busca, sino, aba Indicações e "Indicado por" são `<a href>`. O `leadLinkSweep.test.js` cobra isso: fora do `App.jsx` (dono do `openProfile`, que o cadastro usa em "Ver ficha") e da busca global (o Enter navega na mesma aba), nenhum arquivo de `src/views` ou `src/components` pode voltar a chamar `openProfile`. Três regras aprendidas aqui: (1) no card do Pipeline o link ENVOLVE o conteúdo, porque uma camada esticada por cima apaga os tooltips dos chips, do motivo da perda e do consultor; (2) o container que ganhou link perde o `onClick`, senão o clique empilha duas entradas e o voltar precisa de dois cliques; (3) link dentro de card arrastável leva `draggable={false}`, senão o arrasto passa a levar a URL e a imagem arrastada vira o texto do link. Onde o link é esticado (Meta diária), o container leva `relative` e os botões de dentro, `relative z-10`.
- **A setinha do card do Pipeline abre em outra guia** (`target="_blank"` e `rel="noopener"`), já no clique simples, e o rótulo diz isso. É o caminho para abrir vários cards sem sair do quadro: nenhum site consegue forçar segundo plano num clique comum, então quem quer a guia atrás usa Ctrl+clique.
- **Componente com `AppLink` ou `LeadLink` só renderiza dentro de um Router.** Teste em node desses componentes precisa de `MemoryRouter`, e de mock de `src/lib/firebase.js` quando o arquivo o importa. É por isso que "Ir para o pipeline" do Gerencial continua `<button>`: o teste dele roda sem Router.
```

- [ ] **Step 4: Spec em dia**

No spec, o item `- **Card do Pipeline:**` da seção "Links". Antes:

```md
- **Card do Pipeline:** o link envolve o bloco de cima e o lado esquerdo do rodapé, com `draggable={false}`. Mover e Abrir ficam fora do link. O `article` perde o `onClick` e continua sendo o que se arrasta. Os tooltips do card (motivo da perda, chips, consultor) continuam funcionando. A setinha do rodapé vira um link com `target="_blank"` e `rel="noopener"` (decisão 11), com o rótulo dizendo que abre em outra guia.
```

Depois:

```md
- **Card do Pipeline:** são DOIS links com o mesmo destino, um em volta do bloco de cima e outro no nome do consultor do rodapé, os dois com `draggable={false}` (implementado assim em 22/09; um link só exigiria tirar as ações do fluxo com `position: absolute`, o que mudaria a altura do card no hover). O do rodapé leva `tabIndex={-1}`, para o Tab parar uma vez por card. Mover e a setinha ficam fora do link. O `article` perde o `onClick` e continua sendo o que se arrasta. Os tooltips do card (motivo da perda, chips, consultor) continuam funcionando porque estão DENTRO dos links, com uma exceção: id que não serve para endereço vira `<span>` e leva o `title` junto, porque o ramo sem href do `LeadLink` só repassa `className` e os filhos. Dois pedaços do rodapé deixaram de abrir a ficha, de propósito: o avatar de iniciais do consultor e o número da direita, que é onde ficam as ações (o número já sumia no hover). A setinha do rodapé vira um link com `target="_blank"` e `rel="noopener"` (decisão 11), com o rótulo dizendo que abre em outra guia.
```

Na mesma seção, o item `- **Listas**`. Antes:

```md
- **Listas** (Leads, Clientes, Aulas, Visitas), prévia de amanhã, listas da visão Equipe, aba Indicações e "Indicado por": `LeadLink` direto. No `ConsultantDayDetail`, `group-enabled:group-hover:` vira `group-hover:` no ramo com link.
```

Depois:

```md
- **Listas** (Leads, Clientes, Aulas, Visitas), prévia de amanhã, listas da visão Equipe, aba Indicações e "Indicado por": `LeadLink` direto. No `ConsultantDayDetail`, `group-enabled:group-hover:` vira `group-hover:` no ramo com link. Três blocos viraram componente de módulo para o teste em node conseguir renderizá-los sem montar a tela inteira: `SearchResultRow` (busca), `TomorrowApptRow` (prévia de amanhã) e `NotificationRow` (sino, antes `Row`). `KanbanCard`, `TaskCard` e `DoneCard` passaram a ser exportados pelo mesmo motivo.
```

Em "Entrega em três PRs", o item 3. Antes:

```md
3. **Ctrl+clique em tudo que abre ficha.** Card do Pipeline, listas, Meta, visão Equipe, busca, sino, Indicações e "Indicado por".
```

Depois:

```md
3. **Ctrl+clique em tudo que abre ficha.** Card do Pipeline, listas, Meta, visão Equipe, busca, sino, Indicações e "Indicado por". Entregue em 22/09/2026, com a setinha do card abrindo em outra guia (decisão 11) e uma varredura no CI cobrando que nenhuma tela volte a abrir ficha por `onClick`.
```

- [ ] **Step 5: Verificação final**

```bash
npx vitest run && npm run lint && npm run build && npm run verificar:sentry
```

Esperado: `Test Files  106 passed (106)`, `Tests  2105 passed (2105)`, lint com `✖ 1 problem (0 errors, 1 warning)`, build sem erro e o verificador do Sentry verde.

Conferir também que a camada do link esticado da Meta compila:

```bash
/usr/bin/grep -o 'after\\:absolute:after{[^}]*}' dist/assets/*.css
```

Esperado: uma linha, `after\:absolute:after{content:var(--tw-content);position:absolute}`. Dois detalhes desse comando, os dois medidos: o padrão tem UM dois-pontos antes de `after` porque o lightningcss encurta `::after` para `:after` na minificação, e `-o` está no lugar de `-c` porque contagem sobre um glob passa a sair como `arquivo:número` no dia em que o build gerar mais de um CSS.

E que nenhum `openProfile` sobrou onde não devia:

```bash
git grep -n "openProfile" -- src | /usr/bin/grep -v -E "App.jsx|LeadProfileContext.jsx|GlobalSearch.jsx|__tests__"
```

Esperado: nenhuma linha.

- [ ] **Step 6: Escrever o corpo do PR**

Gravar em `/private/tmp/claude-501/-Users-johnnybittencourt-STRONIX-FIRMA-06-sistemas-stronilead--claude-worktrees-unruffled-chatterjee-6036f8/2eddd9e5-4fce-4c8d-ac5f-ba368c8db54e/scratchpad/pr3-body.md`:

```md
## O que muda para quem usa

Abrir a ficha deixa de ser um clique que só funciona de um jeito. Em todo lugar
que abre ficha (card do Pipeline, listas de Leads, Clientes, Aulas e Visitas,
Meta diária, visão Equipe, busca, sino, aba Indicações e "Indicado por") agora
existe um link de verdade, então Ctrl+clique, botão do meio, Shift+clique e
"Abrir link em nova aba" do botão direito funcionam, e passar o mouse mostra o
endereço na barra de status.

**A setinha do canto do card do Pipeline abre a ficha em OUTRA GUIA já no
clique simples**, e o Pipeline fica intacto na guia atual. É com ela que dá para
disparar vários cards sem sair do quadro. Quem quiser a guia atrás usa
Ctrl+clique nela: nenhum site consegue forçar segundo plano num clique comum.
O clique no corpo do card continua abrindo na mesma guia, como sempre.

Na busca e no sino, Ctrl+clique abre a ficha em outra aba e a lista continua
aberta, com o texto digitado. Clique simples continua fechando.

## Como foi feito

- O `LeadLink` do PR #218 já montava o endereço da ficha e já levava a tela de
  origem. Este PR só troca o `onClick` de cada ponto por esse link.
- **No card do Pipeline o link envolve o conteúdo, em vez de esticar uma camada
  por cima.** Com a camada, os tooltips dos chips truncados, do motivo da perda
  e de "Consultor: X" parariam de aparecer, e todo hover do card mostraria o
  nome. São dois links com o mesmo destino: um no bloco de cima e outro no nome
  do consultor. O do rodapé fica fora da ordem do Tab, então o teclado continua
  parando uma vez por card.
- **O `<article>` perdeu o `onClick` e continua sendo quem se arrasta.** Com os
  dois (link e container) navegando, o clique empilharia duas entradas e o
  voltar do navegador precisaria de dois cliques. Os links levam
  `draggable={false}`, senão o arrasto passaria a levar a URL (soltar em outra
  aba abriria a ficha) e a imagem arrastada viraria o texto do link.
- **Na Meta diária o link é esticado**, porque ali não há tooltip para apagar. O
  container ganhou `relative` e os botões (WhatsApp, Ligar, Adiar, desfechos,
  Remarcar) ganharam `relative z-10` para continuarem respondendo.
- **Na busca, a escolha saiu do `onMouseDown`.** Ela limpava a busca e desmontava
  a lista antes de o clique chegar, então o link nunca receberia o clique e
  Ctrl+clique abriria na mesma guia. O mousedown ficou só com o `preventDefault`
  do botão esquerdo, que é o que mantém o foco no campo.
- Continuam botão: Mover do card, as ações da Meta, o lápis do vínculo de
  indicação, as novidades do sino, "Cadastrar novo lead" e "Ir para o pipeline"
  do Gerencial.
- Uma varredura no CI cobra que nenhuma tela volte a abrir ficha por `onClick`.

## Testes

37 testes novos em 6 arquivos, todos em node com `renderToString` sob
`MemoryRouter`, sem jsdom. Suíte: **106 arquivos, 2103 testes**. Lint com 0
erros (segue o mesmo aviso antigo do `SuperAdminView.jsx`). Build e
`verificar:sentry` verdes.

## Conferência manual no preview (o que eu não consigo testar)

**Pipeline, no Chrome, no Safari e no Firefox**
- [ ] Arrastar o card pelo nome, pelo corpo e pelo rodapé move de coluna, sem
      abrir a ficha e sem arrastar a URL (soltar em outra janela não pode abrir
      nada).
- [ ] A imagem arrastada é o card, não o texto do link.
- [ ] Passar o mouse nos chips de origem e modalidade, no motivo da perda e no
      nome do consultor ainda mostra o tooltip com o texto inteiro.
- [ ] Clique simples no corpo abre a ficha na mesma guia. Ctrl+clique (Cmd no
      Mac) e botão do meio abrem em outra aba.
- [ ] Clicar no avatar de iniciais do consultor e no número da direita do
      rodapé NÃO abre mais a ficha. É de propósito: ali do lado é onde ficam as
      ações, e o número já sumia no hover. Confirmar que isso não incomoda.
- [ ] **A setinha abre outra guia no clique simples**, e com Ctrl+clique a guia
      abre em segundo plano (dá para disparar três ou quatro cards seguidos sem
      sair do Pipeline).
- [ ] Entrar SEM "Manter conectado" e clicar na setinha: a guia nova pede
      login. É o esperado (decisão 7 do spec, a sessão vive só naquela aba).
      Entrar COM "Manter conectado" e repetir: a guia nova abre a ficha direto.
      Confirmar que ninguém do time trabalha com a caixa desmarcada.
- [ ] Depois de clicar na setinha, ou de dar Ctrl+clique no corpo, tirar o
      mouse do card: ele volta ao normal, mostrando o valor ou os dias sem
      contato, em vez de ficar travado com as ações à mostra.
- [ ] Com o Tab, ao parar no card as ações aparecem e o anel de foco segue o
      canto arredondado do card, sem corte.
- [ ] Mover abre o menu e não navega.
- [ ] Rolar o quadro até a borda e insistir no trackpad não troca de tela.
- [ ] No iPad e no Android, segurar o card para arrastar não abre prévia nem
      menu de link.
- [ ] No iPad e no Android a setinha não aparece no rodapé do card (só o
      Mover), e o toque no corpo abre a ficha na mesma tela.

**Listas, Meta e Equipe**
- [ ] Linha de Leads, Clientes, Aulas e Visitas: clique abre, Ctrl+clique abre
      em outra aba.
- [ ] No iPhone e no Android, segurar o dedo na linha de Aulas e de Visitas
      mostra a prévia do link e o menu de abrir em nova aba. É comportamento
      novo do celular, herdado de a linha inteira ser link: conferir se
      atrapalha a rolagem da lista.
- [ ] Meta: nome e corpo do card abrem a ficha; WhatsApp, Ligar, Adiar,
      Concluir, Compareceu, Não veio, Remarcou e Cancelou NÃO abrem.
- [ ] Meta: no card concluído, Remarcar não abre a ficha e o resto abre.
- [ ] Prévia de amanhã e as duas listas da visão Equipe abrem a ficha.
- [ ] Na Equipe, ação de prospecção sem lead continua sem clique.
- [ ] No iPhone e no Android, segurar o dedo no corpo do card da Meta mostra a
      prévia do link e o menu de abrir em nova aba. É comportamento novo do
      celular, herdado do link esticado: conferir se atrapalha a rolagem. O
      toque simples tem que abrir a ficha na mesma tela.
- [ ] Lead com id que não serve para endereço: o cabeçalho do card e o corpo do
      card concluído continuam com cara de clicável (`cursor-pointer`) e o
      atalho do canto continua com cara de botão, mas nada abre, porque o
      `LeadLink` vira `<span>` e joga fora `title` e `aria-label`. É a mesma
      troca aceita na T1 para o Kanban; na prática é card que já não abria
      ficha nenhuma.

**Busca e sino**
- [ ] Busca: clique simples abre e limpa o campo; Ctrl+clique e botão do meio
      abrem em outra aba e a lista continua aberta com o texto; Enter abre na
      mesma aba.
- [ ] Sino: clique simples abre e fecha o sino; Ctrl+clique mantém o sino
      aberto; as novidades continuam abrindo a Central de ajuda.

**Ficha e histórico**
- [ ] "Indicado por" e a aba Indicações abrem a outra ficha, e o lápis do
      vínculo continua abrindo o diálogo.
- [ ] Abrir ficha pela lista, pelo card e pela Meta e voltar com UM clique no
      voltar do navegador (nada de entrada duplicada).
- [ ] No celular, tocar em qualquer um desses pontos abre normal.

## Observação

Cada guia aberta pela setinha paga um carregamento inteiro do app e abre as
próprias assinaturas, e a ficha não obedece ao portão de ociosidade. O volume
cresce com o uso que a setinha incentiva, então vale olhar o gráfico de leitura
depois que o time pegar o hábito.

Sem "Manter conectado" a guia nova pede login, porque a sessão fica presa
àquela aba. É a decisão 7 do spec e está no checklist acima.
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "$(cat <<'EOF'
docs: varredura e documentação dos links de ficha

Uma varredura no CI cobra que nenhuma tela de src/views ou src/components volte
a abrir a ficha por onClick. O CLAUDE.md ganha a regra dos links de ficha, com
as três armadilhas (camada esticada apaga tooltip, container com link não pode
manter onClick, link dentro de card arrastável leva draggable=false), e o spec
fica em dia com o que foi construído.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Fim**

Sem `git push`, sem abrir PR e sem merge. Avisar o Johnny que a branch
`claude/rotas-pr3-ctrl-clique` está pronta, com o corpo do PR em
`scratchpad/pr3-body.md` e o checklist manual para o preview.
