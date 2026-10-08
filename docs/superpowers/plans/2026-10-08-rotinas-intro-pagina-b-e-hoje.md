# Rotinas dos consultores, parte 2: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o balão "Novo" do menu abre uma apresentação em seis passos, a lista de modelos e o modelo aberto ganham o desenho da linha do dia (Página B), e o gestor acompanha a rotina da equipe na aba Hoje (`/<academia>/rotinas/hoje`).

**Architecture:** as contas novas são puras e moram em `src/lib/rotinasTela.js`, que só importa `./rotinas.js`: a regra do dia continua num lugar só. A aba Hoje lê os checks de hoje da academia por uma assinatura nova (`useTeamRoutineMarks`, `date` igual a hoje, presa ao `listenersActive`) e desenha um cartão por consultor e uma lateral, sem gravar nada. A aba mora no endereço (`ROTINAS_TABS.hoje`), com o `Tabs` do shadcn e o `goToSub` do App, que troca o endereço com replace. A apresentação usa o `NewFeatureBadge` com um conteúdo próprio (`renderContent`). Nenhuma regra do Firestore muda e nenhuma função da Vercel nasce.

**Tech Stack:** React 19 + Vite (JS/JSX), Tailwind v4 com os tokens do app, shadcn/ui (`Tabs`, `Dialog`, `Button`, `Select`), Firebase modular no navegador, React Router 7 sem `<Routes>`, Vitest (node e jsdom com `react-dom/client`).

**Spec:** `docs/superpowers/specs/2026-10-06-rotinas-dos-consultores-design.md` (seções "Apresentação", "Aba Modelos", "Dentro de um modelo", "Aba Hoje", atualizadas na Task 1). **Mockups aprovados em 08/10/2026:**
- `docs/superpowers/specs/mockups/2026-10-08-rotinas-intro-e-polimento.html`: **Pop-up 1 · Carrossel** e **Página B · Linha do dia**.
- `docs/superpowers/specs/mockups/2026-10-08-rotinas-aba-hoje.html`: **Hoje A · Por pessoa** e **Pop-up · passo da aba Hoje**.

Abra os dois no navegador, nos dois temas, antes das Tasks 7, 9, 10 e 11. A decisão do Johnny, ao escolher a Hoje A: "Escolho A, porém quero que tu tire aquela linha do tempo logo abaixo do nome do consultor." Nenhum cartão de pessoa na aba Hoje tem linha do dia, e o desenho do último passo da apresentação também não.

**Fora desta parte:** o histórico no Operacional (parte 3), a Hoje B (faixa "O dia da equipe"), a visão em quadro e a linha do dia no cartão de cada pessoa.

---

## Fatos conferidos

Conferidos no código da branch `claude/rotinas-consultores-fc6a14` em 08/10/2026 (último commit `6437dfd`), antes de escrever as tasks:

- `src/lib/rotinas.js` exporta, com estas assinaturas: `routineDayKey(date)`, `markDoneAt(mark, dateKey)` (devolve a hora do check só quando ela cai no próprio dia, senão `null`), `minutesOf('HH:MM')`, `hhmmOf(minutes)`, `byTime(a, b)`, `routineParticipants(users)`, `taskRunsOn`, `tasksForDay(model, date, metaWeekdays)` (ativas do dia, em ordem de horário, sem horário no fim), `taskStateAt(task, doneAt, now)` (`'done' | 'doneLate' | 'now' | 'late' | 'later' | 'open'`), `durationText(minutes)` (`'47 min'`, `'1h 5min'`), `daysText(days)`, `stateText(task, state, doneAt, now)`, `spanText(model)`, `firstName(name)`, `namesText(names)`, `modelOfUser(models, userId)`. O arquivo só importa `./acesso.js` e `./operacional/month.js` (`rotinasImports.test.js`).
- `spanText` só é usado por `ModelCard.jsx` e `ConsultantsList.jsx`. Depois da Task 9 ninguém mais usa, e ele sai.
- `useRoutineModels({ db, enabled, tenantId })` devolve `{ models, loading, error }` e guarda a resposta com a academia. `useMyRoutine` guarda a resposta com a pessoa e o dia. O hook novo segue o mesmo molde.
- `firestore.rules`: `stronix_rotina_marcas` tem `allow read: if inTenant(appId) && tenantActive(appId)`. O gestor lê os checks de todos. A consulta `where('date', '==', dia)` é de campo único e não precisa de índice. `ROUTINE_MARKS_PATH = 'stronix_rotina_marcas'` mora em `src/lib/firebase.js`.
- `src/lib/routes.js`: `ROTINAS_TABS = { modelos: 'modelos' }`, `SCREENS.rotinas` com `subs: ROTINAS_TABS` e `subPadrao: 'modelos'`; `readScreen` lê `/rotinas/modelos/<id>` à parte e passa o resto ao `readSub`; `screenKey` devolve `'rotinas'` para a lista e `rotinas:<id>` para o modelo aberto; `routeTemplate` devolve `/:tenant/rotinas`. O `routes.test.js` congela `hrefFor(T, 'rotinas', { sub: 'modelos' })` como `/${T}/rotinas/modelos`: por isso a aba Modelos manda `null` como sub, e o endereço dela continua `/<academia>/rotinas`.
- `src/lib/appShell.js`: `screenState` devolve `sub` (com o `subPadrao` quando o endereço não traz) e `modelId`.
- `src/App.jsx`: `goToSub(screen, subId, extra)` navega para `hrefFor(sessionTenant, screen, { sub: subId, ...extra })` com `replace: shown.screen === screen` e `state: location.state`. A `RotinasView` é montada com `db`, `appUser`, `usersList`, `modelId`, `tenantId` e `listenersActive`, sem a sub.
- `src/views/DailyGoalView.jsx` tem o relógio próprio (`setInterval` de 60 s) e lê `metaWeekdays` do `useGeneralConfig()`, cujo padrão sem Provider é `[1, 2, 3, 4, 5]`. O `RoutineCard` recebe `now` e `metaWeekdays` por prop.
- `src/components/NewFeatureBadge.jsx`: `NewFeatureBadge({ until, now, tone, title, description, children, className })`, `Dialog` sem controle, nome acessível "Novo: o que é esta tela", tons `soft` e `alert`. Ele só é usado pelo `RotinasNovo` (`src/components/rotinas/RotinasIntro.jsx`), que o App põe no item Rotinas do menu (`<RotinasNovo tone="alert" />`, congelado no `professorShell.test.js`).
- O `rotinasIntro.test.js` e o `sidebarNovo.test.js` esperam hoje o título "Rotinas" e o botão Entendi no pop-up. Com a apresentação em passos, o primeiro título é "O que é a rotina" e o Entendi só existe no último passo: os dois testes mudam na Task 11.
- O `rotinasView.test.js` usa `button('Duplicar modelo')`, `button('Excluir modelo')` e `button('Renomear')`, e confere o cabeçalho de uma linha. A Página B troca esses botões ("Duplicar", "Excluir" e o lápis com `aria-label="Renomear"`), e as abas entram no topo: o teste muda nas Tasks 8 e 10.
- O cartão do modelo é um link, e o teste dele reprova `div`, `p` e `h1` a `h4` dentro. O `Avatar.jsx` do app desenha uma `div`: o rosto das rotinas é um `span` novo (`PersonInitials`), com a mesma conta de cor do avatar do Pipeline (`getKanbanAvatarPalette` e `getKanbanInitials`, de `src/lib/kanban.js`, que não toca no Firebase).
- O `Tabs` do shadcn existe (`src/components/ui/tabs.jsx`), e a ficha usa `<Tabs value={tab} onValueChange={onTab}>`. O gatilho do Radix ativa a aba no `mousedown` (botão esquerdo, sem Ctrl), e não no `click`: no jsdom, o teste dispara `mousedown`.
- `filtrosNoEndereco.sweep.test.js`: nas views e no `App.jsx`, linha com `key={` não pode ter `sub`, `person`, `funnel` e outros nomes de filtro; e nenhum `navigate` de `src/` pode ter `replace` com state próprio. `overscrollGuard.test.js` cobra `overscroll-x-contain` de todo `overflow-x-auto`: este plano não cria rolador horizontal.
- `lucide-react` tem `ArrowRight`, `Building2`, `Check`, `ChevronDown`, `Clock`, `Copy`, `Dumbbell`, `ListChecks`, `Pencil`, `Phone`, `Plus` e `Repeat`. O app já usa as variantes `pointer-coarse:`, `group-has-[:focus-visible]:`, `bg-gradient-to-b` e `shadow-[inset_..._var(--color-brand-600)]`.
- Linha de base: `npx vitest run` com 209 arquivos e 4693 testes passando.
- Só dois mockups estavam fora do git (`2026-10-08-rotinas-aba-hoje.html` e `2026-10-08-rotinas-intro-e-polimento.html`). O `2026-10-08-balao-novo-rotinas.html` já estava no repositório.
- O código deste plano foi aplicado, task por task, numa cópia do repositório (fora do git) em 08/10/2026: a suíte passa ao fim de cada task (de 210 a 214 arquivos, 4786 testes no fim), o lint fica sem erro e o build passa. Se um passo "rodar e ver passar" falhar, o código foi copiado diferente do plano, ou a main trouxe mudança nos mesmos arquivos.

## Decisões deste plano

O que o pedido e os mockups não fecharam, e a escolha feita aqui:

1. As contas da tela moram num módulo novo, `src/lib/rotinasTela.js`, e não em `rotinas.js`: a `api/` lê `rotinas.js`, e as contas de tela não precisam ir junto. O módulo só importa `./rotinas.js`, travado no `rotinasImports.test.js`.
2. A aba Modelos fica em `/<academia>/rotinas` (a `RotinasView` manda `null` como sub), e `/<academia>/rotinas/modelos` continua abrindo a lista, como hoje.
3. As abas são o `Tabs` do shadcn (botões), como as abas da ficha, e não links. Trocar de aba é replace, pelo `goToSub`.
4. O `NewFeatureBadge` passa a controlar o próprio pop-up e ganha `renderContent({ close })` e `contentClassName`. O pop-up padrão (título, descrição, corpo e Entendi) não muda.
5. Na apresentação, o botão principal é o mesmo elemento em todos os passos ("Ver como configurar", "Próximo", "Entendi"), para o foco não se perder. O Voltar fica invisível no primeiro passo, e quem volta para ele leva o foco ao botão principal. Os pontinhos têm o título do passo como nome e `aria-current="step"`.
6. O resumo do cartão do modelo conta as tarefas com horário, como no mockup ("8 tarefas · das 06:00 às 13:00 · 3 a qualquer hora"). Só sem horário: "2 tarefas a qualquer hora". Sem tarefa: "Nenhuma tarefa ainda". Só pausadas: "Nenhuma tarefa ativa".
7. A linha do dia do cartão mostra os rótulos das pontas (06h e 21h) e do primeiro e do último horário, quando eles ficam a 8% ou mais de outro rótulo.
8. As tarefas pausadas saem da linha do modelo aberto e vão para um grupo "Pausadas", no fim do cartão, com o tratamento de hoje (pino cinza, nome apagado e o selo "Pausada").
9. Os quadrinhos de "A qualquer hora do dia" mostram também a frequência, que o mockup não tinha: sem ela, a tarefa sem horário de segunda e terça ficaria igual à de todo dia.
10. A prévia "Como o consultor vê" não tem check de ninguém, então o cabeçalho diz "5 tarefas", e não "0 de 5". Mostra até seis tarefas e, depois, "E mais N hoje.". O horário fica azul na tarefa "agora" e vermelho na atrasada.
11. Na aba Hoje, quem está sem modelo vai para o fim, e o resto segue a ordem da equipe. "A rotina começa às" só aparece quando nada foi feito ainda: com uma tarefa sem horário já feita, a lista aparece. Sem tarefa com horário, não há linha do agora. Modelo sem tarefa hoje: "Nenhuma tarefa hoje neste modelo.", sem contagem.
12. Textos dos casos sem conta: "Nenhum consultor na equipe ainda." com "Cadastre os consultores em Configurações, em Equipe & acessos, e escolha o modelo de cada um na aba Modelos."; "Ninguém segue um modelo ainda."; "Hoje não tem tarefa da rotina para a equipe."; "Carregando a rotina de hoje…"; "Não deu para carregar os checks de hoje. Recarregue a página.". Com uma tarefa só no total, o título diz "1 tarefa", no singular.
13. Observações de hoje: a mais recente primeiro. Atrasadas agora: em ordem de horário, e de nome no empate.
14. A tarefa escolhida fica no estado da aba, e não no endereço. O detalhe fica num `aria-live="polite"` que existe desde a montagem.
15. A aba Hoje só assina os checks enquanto está aberta: o `TabsContent` inativo sai da tela.
16. Os tons dos estados saem do `RoutineCard` para `src/components/rotinas/routineTones.js`, divididos com a aba Hoje, a prévia e a apresentação.
17. O link do modelo no cartão da pessoa leva `fromList`, então o Voltar do modelo volta para a aba Hoje.
18. O aviso do modelo aberto passa a ser o do mockup B: "O que você muda aqui vale a partir de hoje. Os dias anteriores continuam como estavam."

---

## Antes de começar

- [ ] Leia o `CLAUDE.md` do Stronilead (raiz do repositório), em especial "Rotinas dos consultores", "Endereço de cada tela" e "Padrão de UI — shadcn/ui". Regras que pesam aqui: trabalho só via PR, sem merge sem o ok do Johnny; texto de tela em português, sem travessão no meio da frase; `cn()`, tokens semânticos, `size-N` e `flex gap`; listas de pessoas pelo `routineParticipants` (que passa pelo `isSeller`); abrir modelo é link (`AppLink`).
- [ ] Na worktree: `git fetch origin && git rev-list --count HEAD..origin/main`. Se der mais que 0, traga a main (`git merge origin/main`) e procure pelo texto, não pela linha, os trechos citados abaixo.
- [ ] `npm install` e confira que o `package-lock.json` não mudou (`git status`).
- [ ] Linha de base: `npx vitest run` (209 arquivos, 4693 testes) e `npm run lint` sem erro. Anote os números.

## Mapa de arquivos

| Arquivo | Papel |
|---|---|
| `src/lib/rotinasTela.js` (novo) | Contas puras da tela: linha do dia, resumos, dia do modelo, dia de cada pessoa, equipe, título da aba Hoje. |
| `src/hooks/useTeamRoutineMarks.js` (novo) | Assinatura dos checks de hoje da academia. |
| `src/hooks/useMinuteClock.js` (novo) | Relógio que anda a cada minuto. |
| `src/components/rotinas/routineTones.js` (novo) | Tons dos estados, divididos com o `RoutineCard`. |
| `src/components/rotinas/StateMark.jsx` (novo) | Círculo do estado, só de leitura. |
| `src/components/rotinas/PersonInitials.jsx` (novo) | Rosto de iniciais, todo de span. |
| `src/components/rotinas/TodayTab.jsx` (novo) | Aba Hoje: topo, cartões e lateral. |
| `src/components/rotinas/PersonDayCard.jsx` (novo) | Cartão de um consultor na aba Hoje. |
| `src/components/rotinas/TodayAside.jsx` (novo) | Lateral da aba Hoje: detalhe, atrasadas, observações. |
| `src/components/rotinas/RoutinePreview.jsx` (novo) | "Como o consultor vê" no modelo aberto. |
| `src/components/rotinas/IntroIllustrations.jsx` (novo) | Os seis desenhos da apresentação. |
| `src/components/rotinas/RotinasIntro.jsx` | O balão "Novo" abre a apresentação em passos. |
| `src/components/NewFeatureBadge.jsx` | `renderContent` e `contentClassName`. |
| `src/components/rotinas/ModelCard.jsx`, `ConsultantsList.jsx`, `ModelDetail.jsx` | Página B. |
| `src/components/dailygoal/RoutineCard.jsx` | Passa a importar os tons. |
| `src/views/RotinasView.jsx` | Abas Modelos e Hoje. |
| `src/lib/routes.js` | `ROTINAS_TABS.hoje`. |
| `src/App.jsx` | `tab` e `onTab` da `RotinasView`. |
| `src/lib/rotinas.js` | Sai o `spanText`. |
| `src/lib/announcements.js`, `CLAUDE.md` | Novidade no sino e regras. |

---

### Task 1: spec e mockups

**Files:**
- Modify: `docs/superpowers/specs/2026-10-06-rotinas-dos-consultores-design.md`
- Add: `docs/superpowers/specs/mockups/2026-10-08-rotinas-aba-hoje.html`, `docs/superpowers/specs/mockups/2026-10-08-rotinas-intro-e-polimento.html`

Feita junto com este plano, no mesmo commit.

- [x] **Step 1: atualizar a spec.** A lista de mockups ganhou os três de 08/10/2026; "Menu e endereço" diz que o balão abre a apresentação e que trocar de aba é replace, com Modelos em `/<academia>/rotinas`; entrou a seção "Apresentação (o balão "Novo")" com os seis passos e os textos; "Aba Modelos" e "Dentro de um modelo" viraram a Página B; "Aba Hoje" virou a Hoje A sem a linha do dia no cartão, com os casos sem conta; "Leituras", "Entrega em três partes", "Fora do escopo" e "Testes" foram atualizados.
- [x] **Step 2: commit** dos dois mockups que estavam fora do git, com a spec e este plano:

```bash
git add docs/superpowers/plans/2026-10-08-rotinas-intro-pagina-b-e-hoje.md docs/superpowers/specs/2026-10-06-rotinas-dos-consultores-design.md docs/superpowers/specs/mockups/2026-10-08-*.html
git commit -m "docs: plano da apresentação, do polimento e da aba Hoje das rotinas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: as contas da Página B (`src/lib/rotinasTela.js`)

**Files:**
- Create: `src/lib/rotinasTela.js`
- Test: `src/lib/__tests__/rotinasTela.test.js`
- Modify: `src/lib/__tests__/rotinasImports.test.js`

- [ ] **Step 1: escrever os testes**

Crie `src/lib/__tests__/rotinasTela.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { ALL_DAYS } from '../rotinas.js';
import {
  DAY_LINE_END, DAY_LINE_START, MODEL_GAP_MINUTES, dayLineLabels, dayLinePct, gapText, hourLabel, modelCardSummary,
  modelChips, modelDayRows, modelFreeTasks, modelPausedTasks, modelSummary, modelTimes, personTodayText,
} from '../rotinasTela.js';

// 06/10/2026 é terça; 07/10/2026 é quarta; 10/10/2026 é sábado.
const at = (hhmm, day = 6) => { const [h, m] = hhmm.split(':').map(Number); return new Date(2026, 9, day, h, m); };
const task = (id, time, over = {}) => ({ id, title: `Tarefa ${id}`, how: '', days: ALL_DAYS, time, active: true, ...over });
const SEG_A_SEX = [1, 2, 3, 4, 5];
// O "Consultor manhã" do mockup: 8 com horário, das 06:00 às 13:00, e 3 a qualquer hora.
const MANHA = {
  id: 'm1',
  name: 'Consultor manhã',
  tasks: [
    task('a', '06:00'), task('b', '06:30'), task('c', '07:00'), task('d', '07:30'), task('e', '10:00'),
    task('f', '11:00'), task('g', '12:00', { days: [1, 3, 5] }), task('h', '13:00'),
    task('i', null), task('j', null), task('k', null),
  ],
};

describe('a linha do dia do cartão', () => {
  it('vai das 06h às 21h, e o que passa das pontas fica na ponta', () => {
    expect(DAY_LINE_START).toBe(360);
    expect(DAY_LINE_END).toBe(1260);
    expect(dayLinePct(360)).toBe(0);
    expect(dayLinePct(1260)).toBe(100);
    expect(dayLinePct(810)).toBe(50);
    expect(dayLinePct(300)).toBe(0);
    expect(dayLinePct(1380)).toBe(100);
  });

  it('os rótulos das horas', () => {
    expect(hourLabel(360)).toBe('06h');
    expect(hourLabel(780)).toBe('13h');
    expect(hourLabel(810)).toBe('13h30');
  });

  it('os horários do modelo são os das tarefas ativas com horário, em ordem', () => {
    const model = { tasks: [task('a', '10:00'), task('b', '07:30'), task('c', null), task('d', '08:00', { active: false })] };
    expect(modelTimes(model)).toEqual([450, 600]);
    expect(modelTimes(null)).toEqual([]);
  });

  it('rótulos: as pontas sempre, e o primeiro e o último horário quando não encostam em outro rótulo', () => {
    // Manhã: o 06:00 cai em cima do 06h; o 13:00 ganha rótulo.
    expect(dayLineLabels(modelTimes(MANHA)).map((l) => l.text)).toEqual(['06h', '13h', '21h']);
    // Tarde: o 13:00 ganha rótulo; o 21:00 cai em cima do 21h.
    expect(dayLineLabels([780, 840, 960, 1080, 1170, 1260]).map((l) => l.text)).toEqual(['06h', '13h', '21h']);
    expect(dayLineLabels([480, 1020]).map((l) => l.text)).toEqual(['06h', '08h', '17h', '21h']);
    // Um horário só aparece uma vez, e dois horários colados ficam com um rótulo.
    expect(dayLineLabels([720]).map((l) => l.text)).toEqual(['06h', '12h', '21h']);
    expect(dayLineLabels([720, 760]).map((l) => l.text)).toEqual(['06h', '12h', '21h']);
    // Perto das pontas, só as pontas.
    expect(dayLineLabels([400, 1240]).map((l) => l.text)).toEqual(['06h', '21h']);
    expect(dayLineLabels([])).toEqual([
      { pct: 0, text: '06h', align: 'start' },
      { pct: 100, text: '21h', align: 'end' },
    ]);
    expect(dayLineLabels([720]).find((l) => l.text === '12h')).toEqual({ pct: 40, text: '12h', align: 'center' });
  });
});

describe('os textos do modelo', () => {
  it('o resumo do cartão', () => {
    expect(modelSummary(MANHA)).toEqual({ timed: 8, free: 3, first: '06:00', last: '13:00' });
    expect(modelCardSummary(MANHA)).toBe('8 tarefas · das 06:00 às 13:00 · 3 a qualquer hora');
    expect(modelCardSummary({ tasks: [task('a', '13:00'), task('b', '21:00')] })).toBe('2 tarefas · das 13:00 às 21:00');
    expect(modelCardSummary({ tasks: [task('a', '08:00'), task('b', null)] })).toBe('1 tarefa · às 08:00 · 1 a qualquer hora');
    expect(modelCardSummary({ tasks: [task('a', null), task('b', null)] })).toBe('2 tarefas a qualquer hora');
    expect(modelCardSummary({ tasks: [task('a', '08:00', { active: false })] })).toBe('Nenhuma tarefa ativa');
    expect(modelCardSummary({ tasks: [] })).toBe('Nenhuma tarefa ainda');
  });

  it('as etiquetas do modelo aberto', () => {
    expect(modelChips(MANHA)).toEqual(['8 tarefas no horário, das 06:00 às 13:00', '3 a qualquer hora']);
    expect(modelChips({ tasks: [task('a', '08:00')] })).toEqual(['1 tarefa no horário, às 08:00']);
    expect(modelChips({ tasks: [task('a', null)] })).toEqual(['1 a qualquer hora']);
    expect(modelChips({ tasks: [] })).toEqual([]);
  });

  it('o dia do modelo: as tarefas com horário em ordem, com o vão de 90 minutos ou mais', () => {
    const rows = modelDayRows(MANHA);
    expect(rows.map((r) => (r.kind === 'gap' ? gapText(r.minutes) : r.task.time))).toEqual([
      '06:00', '06:30', '07:00', '07:30', '2h30 sem tarefa', '10:00', '11:00', '12:00', '13:00',
    ]);
    expect(rows.find((r) => r.kind === 'gap')).toEqual({ kind: 'gap', key: 'vao-d', minutes: 150 });
  });

  it('o vão começa em 90 minutos, e as pausadas e as sem horário ficam fora da linha', () => {
    expect(MODEL_GAP_MINUTES).toBe(90);
    const model = { tasks: [task('a', '08:00'), task('b', '09:29'), task('c', '10:59'), task('p', '09:00', { active: false }), task('s', null)] };
    expect(modelDayRows(model).map((r) => r.key)).toEqual(['a', 'b', 'vao-b', 'c']);
    expect(gapText(90)).toBe('1h30 sem tarefa');
    expect(gapText(180)).toBe('3h sem tarefa');
    expect(gapText(125)).toBe('2h05 sem tarefa');
  });

  it('os grupos de baixo: as sem horário ativas, na ordem do modelo, e as pausadas, em ordem de horário', () => {
    const model = { tasks: [task('a', null), task('b', '08:00', { active: false }), task('c', null, { active: false }), task('d', '07:00', { active: false }), task('e', '09:00'), task('f', null)] };
    expect(modelFreeTasks(model).map((t) => t.id)).toEqual(['a', 'f']);
    expect(modelPausedTasks(model).map((t) => t.id)).toEqual(['d', 'b', 'c']);
  });

  it('a linha de cada consultor diz o dia de hoje dele', () => {
    // Terça: a tarefa de segunda, quarta e sexta não vale.
    expect(personTodayText(MANHA, at('09:00'), SEG_A_SEX)).toBe('10 tarefas hoje · das 06:00 às 13:00');
    expect(personTodayText(MANHA, at('09:00', 7), SEG_A_SEX)).toBe('11 tarefas hoje · das 06:00 às 13:00');
    expect(personTodayText(MANHA, at('09:00', 10), SEG_A_SEX)).toBe('Nenhuma tarefa hoje');
    expect(personTodayText({ tasks: [task('a', '08:00')] }, at('09:00'), SEG_A_SEX)).toBe('1 tarefa hoje · às 08:00');
    expect(personTodayText({ tasks: [task('a', null)] }, at('09:00'), SEG_A_SEX)).toBe('1 tarefa hoje');
  });
});
```

- [ ] **Step 2: travar os imports do módulo novo**

Em `src/lib/__tests__/rotinasImports.test.js`, logo depois da linha `const MONTH_PATH = fileURLToPath(new URL('../operacional/month.js', import.meta.url));`, acrescente:

```js
const TELA_PATH = fileURLToPath(new URL('../rotinasTela.js', import.meta.url));
```

E, dentro do `describe('rotinas.js só importa módulos puros', ...)`, logo depois do teste `it('operacional/month.js não importa nada', ...)`, acrescente:

```js
  // As contas da tela Rotinas (src/lib/rotinasTela.js) leem a regra do dia e
  // não podem ter outra: só importam rotinas.js.
  it('rotinasTela.js só importa ./rotinas.js', () => {
    const text = readFileSync(TELA_PATH, 'utf8');
    expect(specifiersOf(text)).toEqual(['./rotinas.js']);
  });
```

- [ ] **Step 3: rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/rotinasTela.test.js src/lib/__tests__/rotinasImports.test.js`
Expected: FAIL, porque `../rotinasTela.js` não existe.

- [ ] **Step 4: escrever o módulo**

Crie `src/lib/rotinasTela.js`:

```js
// O que a tela Rotinas do gestor desenha a partir da regra do dia
// (src/lib/rotinas.js): a linha do dia e os resumos do cartão do modelo, o dia
// do modelo aberto e, na aba Hoje, o dia de cada consultor e o da equipe. Puro
// e testado em node (src/lib/__tests__/rotinasTela.test.js). Só importa
// ./rotinas.js, e o src/lib/__tests__/rotinasImports.test.js trava isso: a
// regra do dia continua num lugar só.
// Spec: docs/superpowers/specs/2026-10-06-rotinas-dos-consultores-design.md.
// Mockups: 2026-10-08-rotinas-intro-e-polimento.html (Página B · Linha do dia)
// e 2026-10-08-rotinas-aba-hoje.html (Hoje A · Por pessoa).
import { byTime, minutesOf, tasksForDay } from './rotinas.js';

// A linha do dia do cartão do modelo vai das 06h às 21h.
export const DAY_LINE_START = 6 * 60;
export const DAY_LINE_END = 21 * 60;
// Distância mínima entre dois rótulos da linha, em % da largura, para um não
// encostar no outro.
const LABEL_GAP_PCT = 8;
// No modelo aberto, duas tarefas seguidas a essa distância ou mais ganham,
// entre elas, a linha "2h30 sem tarefa".
export const MODEL_GAP_MINUTES = 90;

const pad = (n) => String(n).padStart(2, '0');
const isActive = (task) => task?.active !== false;
const isTimed = (task) => minutesOf(task?.time) != null;
const tarefas = (n) => `${n} ${n === 1 ? 'tarefa' : 'tarefas'}`;
const windowText = (first, last) => (first === last ? `às ${first}` : `das ${first} às ${last}`);

// Posição de um horário (minutos do dia) na linha, em %. O que passa das
// pontas fica na ponta.
export const dayLinePct = (minutes) =>
  ((Math.min(Math.max(minutes, DAY_LINE_START), DAY_LINE_END) - DAY_LINE_START) / (DAY_LINE_END - DAY_LINE_START)) * 100;

// "06h", "13h", "13h30".
export const hourLabel = (minutes) => `${pad(Math.floor(minutes / 60))}h${minutes % 60 ? pad(minutes % 60) : ''}`;

// Os horários das tarefas ativas do modelo, em minutos e em ordem.
export const modelTimes = (model) =>
  (model?.tasks || []).filter((t) => isActive(t) && isTimed(t)).map((t) => minutesOf(t.time)).sort((a, b) => a - b);

// Os rótulos da linha do dia: as pontas (06h e 21h) sempre, e o primeiro e o
// último horário do modelo quando não encostam num rótulo que já está ali.
// align diz onde o texto fica em relação ao ponto: start (começa nele), end
// (termina nele) e center (centrado nele).
export function dayLineLabels(times) {
  const labels = [
    { pct: 0, text: hourLabel(DAY_LINE_START), align: 'start' },
    { pct: 100, text: hourLabel(DAY_LINE_END), align: 'end' },
  ];
  const sorted = [...(times || [])].sort((a, b) => a - b);
  for (const minutes of [sorted[0], sorted[sorted.length - 1]]) {
    if (minutes == null) continue;
    const pct = dayLinePct(minutes);
    if (labels.every((l) => Math.abs(l.pct - pct) >= LABEL_GAP_PCT)) labels.push({ pct, text: hourLabel(minutes), align: 'center' });
  }
  return labels.sort((a, b) => a.pct - b.pct);
}

// As tarefas ativas do modelo: quantas têm horário, quantas valem a qualquer
// hora, e o primeiro e o último horário.
export function modelSummary(model) {
  const active = (model?.tasks || []).filter(isActive);
  const timed = active.filter(isTimed).sort(byTime);
  return {
    timed: timed.length,
    free: active.length - timed.length,
    first: timed[0]?.time ?? null,
    last: timed[timed.length - 1]?.time ?? null,
  };
}

// O resumo do cartão do modelo na lista:
// "8 tarefas · das 06:00 às 13:00 · 3 a qualquer hora".
export function modelCardSummary(model) {
  const s = modelSummary(model);
  if (!s.timed && !s.free) return (model?.tasks || []).length ? 'Nenhuma tarefa ativa' : 'Nenhuma tarefa ainda';
  if (!s.timed) return `${tarefas(s.free)} a qualquer hora`;
  const parts = [tarefas(s.timed), windowText(s.first, s.last)];
  if (s.free) parts.push(`${s.free} a qualquer hora`);
  return parts.join(' · ');
}

// As etiquetas do modelo aberto:
// ["8 tarefas no horário, das 06:00 às 13:00", "3 a qualquer hora"].
export function modelChips(model) {
  const s = modelSummary(model);
  const chips = [];
  if (s.timed) chips.push(`${tarefas(s.timed)} no horário, ${windowText(s.first, s.last)}`);
  if (s.free) chips.push(`${s.free} a qualquer hora`);
  return chips;
}

// "O dia do modelo": as tarefas ativas com horário, em ordem, e um vão entre
// duas seguidas que ficam MODEL_GAP_MINUTES ou mais longe uma da outra. A
// pausada não entra, porque não aparece na Meta.
export function modelDayRows(model) {
  const timed = (model?.tasks || []).filter((t) => isActive(t) && isTimed(t)).sort(byTime);
  const rows = [];
  timed.forEach((task, i) => {
    rows.push({ kind: 'task', key: task.id, task });
    const next = timed[i + 1];
    const gap = next ? minutesOf(next.time) - minutesOf(task.time) : 0;
    if (gap >= MODEL_GAP_MINUTES) rows.push({ kind: 'gap', key: `vao-${task.id}`, minutes: gap });
  });
  return rows;
}

// "2h30 sem tarefa", "3h sem tarefa".
export const gapText = (minutes) => `${Math.floor(minutes / 60)}h${minutes % 60 ? pad(minutes % 60) : ''} sem tarefa`;

// Os grupos de baixo do modelo aberto: as ativas sem horário, na ordem do
// modelo, e as pausadas, em ordem de horário.
export const modelFreeTasks = (model) => (model?.tasks || []).filter((t) => isActive(t) && !isTimed(t));
export const modelPausedTasks = (model) => (model?.tasks || []).filter((t) => !isActive(t)).sort(byTime);

// A linha de cada consultor na lista: o dia de hoje dele no modelo,
// "11 tarefas hoje · das 06:00 às 13:00".
export function personTodayText(model, now, metaWeekdays) {
  const today = tasksForDay(model, now, metaWeekdays);
  if (!today.length) return 'Nenhuma tarefa hoje';
  const head = `${tarefas(today.length)} hoje`;
  const timed = today.filter(isTimed);
  return timed.length ? `${head} · ${windowText(timed[0].time, timed[timed.length - 1].time)}` : head;
}
```

- [ ] **Step 5: rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/rotinasTela.test.js src/lib/__tests__/rotinasImports.test.js`
Expected: PASS.

- [ ] **Step 6: commit**

```bash
git add src/lib/rotinasTela.js src/lib/__tests__/rotinasTela.test.js src/lib/__tests__/rotinasImports.test.js
git commit -m "feat: contas da linha do dia e dos resumos dos modelos das rotinas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: as contas da aba Hoje (`src/lib/rotinasTela.js`)

**Files:**
- Modify: `src/lib/rotinasTela.js` (linha do import e fim do arquivo)
- Test: `src/lib/__tests__/rotinasTela.test.js` (fim do arquivo)

- [ ] **Step 1: escrever os testes**

No topo de `src/lib/__tests__/rotinasTela.test.js`, troque o import de `../rotinasTela.js` por:

```js
import {
  DAY_LINE_END, DAY_LINE_START, MODEL_GAP_MINUTES, clockText, dayLineLabels, dayLinePct, findSelection, gapText, hourLabel,
  isDoneState, lateText, modelCardSummary, modelChips, modelDayRows, modelFreeTasks, modelPausedTasks, modelSummary,
  modelTimes, personDay, personTodayText, teamToday, todayHeadline,
} from '../rotinasTela.js';
```

E acrescente no fim do arquivo:

```js
// ---------- A aba Hoje (mockup 2026-10-08-rotinas-aba-hoje.html) ----------

const mark = (hhmm, note = '', day = 6) => ({ id: `c-${hhmm}`, doneAt: at(hhmm, day), note });
const marksOf = (obj) => new Map(Object.entries(obj));
// Os dados do mockup, às 10:47 de uma terça.
const NOW = at('10:47');
const MANHA_HOJE = {
  id: 'manha',
  name: 'Consultor manhã',
  followerIds: ['ana', 'bruno'],
  tasks: [
    task('t1', '06:00'), task('t2', '06:30'), task('t3', '07:00'), task('t4', '07:30'), task('t5', '10:00'),
    task('t6', '10:30'), task('t7', '11:00'), task('t8', '12:00'), task('t9', '13:00'), task('t10', null), task('t11', null),
  ],
};
const TARDE = {
  id: 'tarde',
  name: 'Consultor tarde',
  followerIds: ['carla'],
  tasks: [task('u1', '13:00'), task('u2', '14:00'), task('u3', '16:00'), task('u4', '18:00'), task('u5', '20:30'), task('u6', null)],
};
const ANA_MARKS = marksOf({ t1: mark('06:04'), t2: mark('06:41'), t3: mark('07:58', 'Lista com 42 leads.'), t4: mark('08:20'), t10: mark('09:15', 'Pedi para 3 alunos.') });
const BRUNO_MARKS = marksOf({ t1: mark('06:02'), t2: mark('06:33'), t3: mark('07:05'), t4: mark('07:40'), t5: mark('10:12'), t11: mark('09:30') });

describe('o dia de uma pessoa', () => {
  it('conta o que foi feito e o que está atrasado, com o estado de cada tarefa', () => {
    const day = personDay(MANHA_HOJE, ANA_MARKS, NOW, SEG_A_SEX);
    expect(day).toMatchObject({ total: 11, done: 5, late: 1 });
    expect(day.rows.map((r) => r.state)).toEqual(['done', 'done', 'doneLate', 'doneLate', 'late', 'now', 'later', 'later', 'later', 'done', 'open']);
    expect(day.timed.map((r) => r.task.id)).toEqual(['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9']);
    expect(day.free.map((r) => r.task.id)).toEqual(['t10', 't11']);
    expect(day.rows.find((r) => r.task.id === 't3')).toMatchObject({ note: 'Lista com 42 leads.', doneAt: at('07:58') });
  });

  it('a linha do agora entra antes da primeira tarefa com horário que ainda não chegou', () => {
    expect(personDay(MANHA_HOJE, ANA_MARKS, NOW, SEG_A_SEX).nowIndex).toBe(6);
    // Às 11:00 o t7 já chegou: a linha vai para antes do t8.
    expect(personDay(MANHA_HOJE, ANA_MARKS, at('11:00'), SEG_A_SEX).nowIndex).toBe(7);
    // Depois da última, a linha fica no fim.
    expect(personDay(MANHA_HOJE, ANA_MARKS, at('15:00'), SEG_A_SEX).nowIndex).toBe(9);
    // Sem tarefa com horário, não tem linha.
    expect(personDay({ tasks: [task('s', null)] }, null, NOW, SEG_A_SEX).nowIndex).toBeNull();
  });

  it('antes da primeira tarefa e sem nada feito, diz quando a rotina começa', () => {
    expect(personDay(TARDE, null, NOW, SEG_A_SEX).startsAt).toBe('13:00');
    expect(personDay(TARDE, marksOf({ u6: mark('10:00') }), NOW, SEG_A_SEX).startsAt).toBeNull();
    expect(personDay(TARDE, null, at('13:00'), SEG_A_SEX).startsAt).toBeNull();
    expect(personDay(TARDE, null, at('13:10'), SEG_A_SEX).startsAt).toBeNull();
  });

  it('o check de outro dia não conta, e a observação dele vai junto', () => {
    const day = personDay(MANHA_HOJE, marksOf({ t1: mark('06:04', 'de ontem', 5), t2: mark('06:31') }), NOW, SEG_A_SEX);
    expect(day.done).toBe(1);
    expect(day.rows[0]).toMatchObject({ state: 'late', doneAt: null, note: '' });
  });

  it('sem tarefa hoje, a conta é zero', () => {
    expect(personDay(MANHA_HOJE, ANA_MARKS, at('10:47', 10), SEG_A_SEX)).toMatchObject({ total: 0, done: 0, late: 0, nowIndex: null, startsAt: null });
  });

  it('feita e feita depois do horário são feitas', () => {
    expect(['done', 'doneLate'].map(isDoneState)).toEqual([true, true]);
    expect(['now', 'late', 'later', 'open'].map(isDoneState)).toEqual([false, false, false, false]);
  });

  it('os textos de hora da lateral', () => {
    expect(lateText(task('x', '10:00'), NOW)).toBe('Era às 10:00, há 47 min');
    expect(lateText(task('x', '06:00'), at('11:45'))).toBe('Era às 06:00, há 5h 45min');
    expect(clockText(at('07:58'))).toBe('07:58');
  });
});

describe('a equipe hoje', () => {
  // Na ordem da equipe, com o Diego (sem modelo) primeiro.
  const people = [
    { id: 'diego', name: 'Diego Rocha' },
    { id: 'ana', name: 'Ana Souza' },
    { id: 'bruno', name: 'Bruno Lima' },
    { id: 'carla', name: 'Carla Dias' },
  ];
  const team = (now = NOW, marksByPerson = new Map([['ana', ANA_MARKS], ['bruno', BRUNO_MARKS]])) =>
    teamToday({ people, models: [MANHA_HOJE, TARDE], marksByPerson, now, metaWeekdays: SEG_A_SEX });

  it('um cartão por pessoa, na ordem da equipe, e quem está sem modelo no fim', () => {
    const t = team();
    expect(t.cards.map((c) => c.person.id)).toEqual(['ana', 'bruno', 'carla', 'diego']);
    expect(t.cards.map((c) => c.model?.id ?? null)).toEqual(['manha', 'manha', 'tarde', null]);
    expect(t.cards.map((c) => c.done ?? null)).toEqual([5, 6, 0, null]);
    expect(t).toMatchObject({ done: 11, total: 28, late: 1, following: 3, withoutModel: 1 });
  });

  it('as atrasadas em ordem de horário, e de nome no empate', () => {
    expect(team().lateRows.map((r) => [r.person.id, r.task.id, r.text])).toEqual([['ana', 't5', 'Era às 10:00, há 47 min']]);
    const late = team(at('11:45'), new Map()).lateRows;
    expect(late).toHaveLength(14);
    expect(late.slice(0, 3).map((r) => [r.person.id, r.task.id])).toEqual([['ana', 't1'], ['bruno', 't1'], ['ana', 't2']]);
  });

  it('as observações, a mais recente primeiro', () => {
    expect(team().notes.map((n) => [n.person.id, n.task.id, n.note])).toEqual([
      ['ana', 't10', 'Pedi para 3 alunos.'],
      ['ana', 't3', 'Lista com 42 leads.'],
    ]);
  });

  it('acha a tarefa escolhida, e devolve null quando ela sumiu', () => {
    const { cards } = team();
    expect(findSelection(cards, { personId: 'ana', taskId: 't3' })).toMatchObject({
      person: { id: 'ana' }, task: { id: 't3' }, state: 'doneLate', note: 'Lista com 42 leads.',
    });
    expect(findSelection(cards, { personId: 'ana', taskId: 'u1' })).toBeNull();
    expect(findSelection(cards, { personId: 'diego', taskId: 't1' })).toBeNull();
    expect(findSelection(cards, null)).toBeNull();
  });
});

describe('o título da aba Hoje', () => {
  const texto = (args) => todayHeadline(args).map((p) => p.text).join('');

  it('com atrasadas, com uma só e sem nenhuma', () => {
    expect(texto({ peopleCount: 4, following: 3, done: 11, total: 28, late: 4 })).toBe('A equipe fez 11 de 28 tarefas da rotina até agora, e 4 estão atrasadas.');
    expect(texto({ peopleCount: 4, following: 3, done: 11, total: 28, late: 1 })).toBe('A equipe fez 11 de 28 tarefas da rotina até agora, e 1 está atrasada.');
    expect(texto({ peopleCount: 4, following: 3, done: 28, total: 28, late: 0 })).toBe('A equipe fez 28 de 28 tarefas da rotina até agora. Nenhuma está atrasada.');
    expect(texto({ peopleCount: 1, following: 1, done: 0, total: 1, late: 0 })).toBe('A equipe fez 0 de 1 tarefa da rotina até agora. Nenhuma está atrasada.');
  });

  it('o que leva destaque', () => {
    expect(todayHeadline({ peopleCount: 4, following: 3, done: 7, total: 26, late: 4 }).filter((p) => p.em)).toEqual([
      { text: '7 de 26', em: 'brand' },
      { text: '4 estão atrasadas', em: 'late' },
    ]);
  });

  it('os casos sem conta', () => {
    expect(texto({ peopleCount: 0, following: 0, done: 0, total: 0, late: 0 })).toBe('Nenhum consultor na equipe ainda.');
    expect(texto({ peopleCount: 3, following: 0, done: 0, total: 0, late: 0 })).toBe('Ninguém segue um modelo ainda.');
    expect(texto({ peopleCount: 3, following: 2, done: 0, total: 0, late: 0 })).toBe('Hoje não tem tarefa da rotina para a equipe.');
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/rotinasTela.test.js`
Expected: FAIL, com `personDay is not a function` (e as outras funções novas).

- [ ] **Step 3: escrever as contas**

Em `src/lib/rotinasTela.js`, troque a linha do import por:

```js
import { byTime, durationText, hhmmOf, markDoneAt, minutesOf, modelOfUser, routineDayKey, taskStateAt, tasksForDay } from './rotinas.js';
```

E acrescente no fim do arquivo:

```js
// ---------- A aba Hoje ----------

const minutesOfDay = (date) => date.getHours() * 60 + date.getMinutes();
// A hora de um instante: o "Às 07:58" das observações e o "Ao vivo · 10:47".
export const clockText = (date) => hhmmOf(minutesOfDay(date));
export const isDoneState = (state) => state === 'done' || state === 'doneLate';

// O dia de uma pessoa: as tarefas de hoje do modelo que ela segue, com o check
// e o estado de cada uma no instante `now`. marks é o Map tarefa -> check da
// pessoa no dia ({ doneAt, note }), do useTeamRoutineMarks. O check só conta
// quando a hora dele cai no próprio dia (markDoneAt, a mesma regra do cartão
// da Meta); o que não conta fica fora, e a observação dele vai junto.
export function personDay(model, marks, now, metaWeekdays) {
  const dayKey = routineDayKey(now);
  const nowMinutes = minutesOfDay(now);
  const rows = tasksForDay(model, now, metaWeekdays).map((task) => {
    const mark = marks?.get(task.id) || null;
    const doneAt = mark ? markDoneAt(mark, dayKey) : null;
    return { task, doneAt, note: doneAt ? (mark.note || '') : '', state: taskStateAt(task, doneAt, now) };
  });
  const timed = rows.filter((r) => isTimed(r.task));
  const done = rows.filter((r) => isDoneState(r.state)).length;
  const firstAt = timed.length ? minutesOf(timed[0].task.time) : null;
  const later = timed.findIndex((r) => minutesOf(r.task.time) > nowMinutes);
  return {
    rows,
    timed,
    free: rows.filter((r) => !isTimed(r.task)),
    done,
    late: rows.filter((r) => r.state === 'late').length,
    total: rows.length,
    // Onde a linha do agora entra entre as tarefas com horário: antes da
    // primeira que ainda não chegou, ou no fim. Sem tarefa com horário, null.
    nowIndex: timed.length ? (later === -1 ? timed.length : later) : null,
    // Antes da primeira tarefa com horário, e sem nada feito, o cartão só diz
    // quando a rotina começa.
    startsAt: firstAt != null && firstAt > nowMinutes && done === 0 ? timed[0].task.time : null,
  };
}

// "Era às 10:00, há 47 min", na lista "Atrasadas agora".
export const lateText = (task, now) => `Era às ${task.time}, há ${durationText(minutesOfDay(now) - minutesOf(task.time))}`;

const byPersonName = (a, b) => String(a.person.name || '').localeCompare(String(b.person.name || ''), 'pt-BR');

// A equipe hoje. people são os consultores que podem seguir modelo
// (routineParticipants), na ordem da equipe; marksByPerson é o Map consultor ->
// (Map tarefa -> check). Devolve um cartão por pessoa, com quem está sem
// modelo no fim; a soma de quem segue modelo; as atrasadas em ordem de horário
// (e de nome no empate); e as observações, a mais recente primeiro.
export function teamToday({ people, models, marksByPerson, now, metaWeekdays }) {
  const cards = (people || []).map((person) => {
    const model = modelOfUser(models, person.id);
    return model
      ? { person, model, ...personDay(model, marksByPerson?.get(person.id), now, metaWeekdays) }
      : { person, model: null };
  });
  cards.sort((a, b) => Number(!a.model) - Number(!b.model));
  const following = cards.filter((c) => c.model);
  const sum = (key) => following.reduce((acc, c) => acc + c[key], 0);
  const lateRows = following
    .flatMap((c) => c.rows.filter((r) => r.state === 'late').map((r) => ({ person: c.person, task: r.task, text: lateText(r.task, now) })))
    .sort((a, b) => byTime(a.task, b.task) || byPersonName(a, b));
  const notes = following
    .flatMap((c) => c.rows.filter((r) => r.note).map((r) => ({ person: c.person, task: r.task, doneAt: r.doneAt, note: r.note })))
    .sort((a, b) => b.doneAt - a.doneAt);
  return {
    cards,
    lateRows,
    notes,
    done: sum('done'),
    total: sum('total'),
    late: sum('late'),
    following: following.length,
    withoutModel: cards.length - following.length,
  };
}

// A frase do topo da aba Hoje, em pedaços. O pedaço com destaque leva em:
// 'brand' (a conta) ou 'late' (as atrasadas). A frase é a junção dos textos.
export function todayHeadline({ peopleCount, following, done, total, late }) {
  if (!peopleCount) return [{ text: 'Nenhum consultor na equipe ainda.' }];
  if (!following) return [{ text: 'Ninguém segue um modelo ainda.' }];
  if (!total) return [{ text: 'Hoje não tem tarefa da rotina para a equipe.' }];
  const head = [
    { text: 'A equipe fez ' },
    { text: `${done} de ${total}`, em: 'brand' },
    { text: ` ${total === 1 ? 'tarefa' : 'tarefas'} da rotina até agora` },
  ];
  if (!late) return [...head, { text: '. Nenhuma está atrasada.' }];
  return [...head, { text: ', e ' }, { text: `${late} ${late === 1 ? 'está atrasada' : 'estão atrasadas'}`, em: 'late' }, { text: '.' }];
}

// A tarefa escolhida na aba Hoje ({ personId, taskId }), com o dia dela. null
// quando nada foi escolhido ou quando ela sumiu (o modelo mudou, a pessoa
// trocou de modelo ou saiu da equipe).
export function findSelection(cards, selected) {
  if (!selected) return null;
  const card = (cards || []).find((c) => c.model && c.person.id === selected.personId);
  const row = card?.rows.find((r) => r.task.id === selected.taskId);
  return row ? { person: card.person, ...row } : null;
}
```

- [ ] **Step 4: rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/rotinasTela.test.js src/lib/__tests__/rotinasImports.test.js`
Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add src/lib/rotinasTela.js src/lib/__tests__/rotinasTela.test.js
git commit -m "feat: contas do dia de cada consultor e da equipe na aba Hoje das rotinas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: os checks de hoje da academia e o relógio de minuto

**Files:**
- Create: `src/hooks/useTeamRoutineMarks.js`
- Create: `src/hooks/useMinuteClock.js`
- Test: `src/lib/__tests__/useTeamRoutineMarks.test.js`

- [ ] **Step 1: escrever os testes**

Crie `src/lib/__tests__/useTeamRoutineMarks.test.js`:

```js
// @vitest-environment jsdom
// Os checks de hoje da academia (aba Hoje das Rotinas) e o relógio de minuto.
// Mesmo molde do useMyRoutine.test.js: o Firestore trocado por um dublê que
// guarda cada assinatura, para o teste responder por ela na hora que quiser.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';

const { listeners } = vi.hoisted(() => ({ listeners: [] }));

vi.mock('../firebase.js', () => ({ appId: 'app-teste', ROUTINE_MARKS_PATH: 'stronix_rotina_marcas' }));
vi.mock('firebase/firestore', () => ({
  collection: (db, ...path) => ({ kind: 'collection', path }),
  where: (field, op, value) => ({ kind: 'where', field, op, value }),
  query: (ref, ...wheres) => ({ kind: 'query', ref, wheres }),
  onSnapshot: (q, next, err) => {
    const unsub = vi.fn();
    listeners.push({ q, next, err, unsub });
    return unsub;
  },
}));

const { useTeamRoutineMarks } = await import('../../hooks/useTeamRoutineMarks.js');
const { useMinuteClock } = await import('../../hooks/useMinuteClock.js');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const db = {};
let root = null;
let result = null;

function ProbeMarks(props) {
  result = useTeamRoutineMarks(props);
  return null;
}
function ProbeClock() {
  result = useMinuteClock();
  return null;
}

async function montar(Probe, props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(h(Probe, props)); });
}
const renderizar = (Probe, props) => act(async () => { root.render(h(Probe, props)); });

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  result = null;
  listeners.length = 0;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const ultima = () => listeners.at(-1);
const responder = (listener, snap) => act(async () => { listener.next(snap); });
const falhar = (listener) => act(async () => { listener.err(new Error('permission-denied')); });
const docCheck = (id, data) => ({
  id,
  data: (opts) => {
    expect(opts).toEqual({ serverTimestamps: 'estimate' });
    return data;
  },
});
const quando = (hh, mm) => ({ toDate: () => new Date(2026, 9, 6, hh, mm) });
const DIA_1 = '2026-10-06';
const DIA_2 = '2026-10-07';

describe('useTeamRoutineMarks: os checks de hoje da academia', () => {
  it('antes da resposta: carregando, sem checks, e a consulta é só pelo dia', async () => {
    await montar(ProbeMarks, { db, tenantId: 'academia-a', dayKey: DIA_1 });
    expect(result).toEqual({ marks: new Map(), loading: true, error: false });
    expect(ultima().q.ref.path).toEqual(['artifacts', 'app-teste', 'public', 'data', 'stronix_rotina_marcas']);
    expect(ultima().q.wheres.map((w) => [w.field, w.op, w.value])).toEqual([['date', '==', DIA_1]]);
  });

  it('separa os checks por pessoa e por tarefa', async () => {
    await montar(ProbeMarks, { db, tenantId: 'academia-a', dayKey: DIA_1 });
    await responder(ultima(), {
      docs: [
        docCheck('ana_2026-10-06_t1', { consultantId: 'ana', taskId: 't1', doneAt: quando(6, 4), note: '' }),
        docCheck('ana_2026-10-06_t3', { consultantId: 'ana', taskId: 't3', doneAt: quando(7, 58), note: 'Lista com 42 leads.' }),
        docCheck('bruno_2026-10-06_t1', { consultantId: 'bruno', taskId: 't1', doneAt: quando(6, 2) }),
      ],
    });
    expect(result.loading).toBe(false);
    expect(result.error).toBe(false);
    expect([...result.marks.keys()]).toEqual(['ana', 'bruno']);
    expect([...result.marks.get('ana').keys()]).toEqual(['t1', 't3']);
    expect(result.marks.get('ana').get('t3')).toEqual({ id: 'ana_2026-10-06_t3', doneAt: new Date(2026, 9, 6, 7, 58), note: 'Lista com 42 leads.' });
    expect(result.marks.get('bruno').get('t1').note).toBe('');
  });

  it('check sem pessoa ou sem tarefa fica de fora, e check sem hora chega sem hora', async () => {
    await montar(ProbeMarks, { db, tenantId: 'academia-a', dayKey: DIA_1 });
    await responder(ultima(), {
      docs: [
        docCheck('x1', { taskId: 't1', doneAt: quando(6, 4) }),
        docCheck('x2', { consultantId: 'ana', doneAt: quando(6, 4) }),
        docCheck('x3', { consultantId: 'ana', taskId: 't2', doneAt: null }),
      ],
    });
    expect([...result.marks.keys()]).toEqual(['ana']);
    expect(result.marks.get('ana').get('t2')).toEqual({ id: 'x3', doneAt: null, note: '' });
  });

  it('o dia vira com a assinatura desligada: os checks de ontem não aparecem', async () => {
    await montar(ProbeMarks, { db, tenantId: 'academia-a', dayKey: DIA_1 });
    const deOntem = ultima();
    await responder(deOntem, { docs: [docCheck('c1', { consultantId: 'ana', taskId: 't1', doneAt: quando(6, 4) })] });
    expect(result.marks.size).toBe(1);
    await renderizar(ProbeMarks, { db, tenantId: 'academia-a', dayKey: DIA_2, enabled: false });
    expect(deOntem.unsub).toHaveBeenCalled();
    expect(result.marks.size).toBe(0);
    expect(result.loading).toBe(true);
  });

  it('o dia vira com a assinatura ligada: assina o dia novo', async () => {
    await montar(ProbeMarks, { db, tenantId: 'academia-a', dayKey: DIA_1 });
    await responder(ultima(), { docs: [] });
    await renderizar(ProbeMarks, { db, tenantId: 'academia-a', dayKey: DIA_2 });
    expect(ultima().q.wheres[0].value).toBe(DIA_2);
    expect(result.loading).toBe(true);
    await responder(ultima(), { docs: [] });
    expect(result.loading).toBe(false);
  });

  it('outra academia (Acessar como): sem os checks da anterior até a resposta da nova', async () => {
    await montar(ProbeMarks, { db, tenantId: 'academia-a', dayKey: DIA_1 });
    const daA = ultima();
    await responder(daA, { docs: [docCheck('c1', { consultantId: 'ana', taskId: 't1', doneAt: quando(6, 4) })] });
    await renderizar(ProbeMarks, { db, tenantId: 'academia-b', dayKey: DIA_1 });
    expect(daA.unsub).toHaveBeenCalled();
    expect(result.marks.size).toBe(0);
    expect(result.loading).toBe(true);
  });

  it('a assinatura falha: error true, sem checks e sem carregar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await montar(ProbeMarks, { db, tenantId: 'academia-a', dayKey: DIA_1 });
    await falhar(ultima());
    expect(result).toEqual({ marks: new Map(), loading: false, error: true });
    expect(console.error).toHaveBeenCalled();
  });

  it('desligada desde o começo: não assina nada', async () => {
    await montar(ProbeMarks, { db, tenantId: 'academia-a', dayKey: DIA_1, enabled: false });
    expect(listeners).toHaveLength(0);
    expect(result.loading).toBe(true);
  });
});

describe('useMinuteClock', () => {
  it('anda a cada minuto e para de andar ao sair da tela', async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 6, 10, 47, 30) });
    await montar(ProbeClock, {});
    expect(result.getMinutes()).toBe(47);
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(result.getMinutes()).toBe(48);
    expect(vi.getTimerCount()).toBe(1);
    await act(async () => { root.unmount(); });
    root = null;
    expect(vi.getTimerCount()).toBe(0);
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/useTeamRoutineMarks.test.js`
Expected: FAIL, porque os dois hooks não existem.

- [ ] **Step 3: escrever `src/hooks/useTeamRoutineMarks.js`**

```js
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { appId, ROUTINE_MARKS_PATH } from '../lib/firebase.js';

// Os checks de hoje da academia inteira, para a aba Hoje da tela Rotinas. A
// consulta é só pelo dia (`date` igual à chave do dia), campo único, que o
// Firestore resolve sem índice, e as regras deixam qualquer membro da academia
// ler. enabled recebe o listenersActive: sem ele, uma aba esquecida aberta
// mantém a assinatura a noite toda.
//
// Devolve marks: Map consultor -> (Map tarefa -> { id, doneAt, note }). O
// doneAt sai com serverTimestamps 'estimate', como no useMyRoutine. Quem decide
// se o check conta é o markDoneAt (src/lib/rotinas.js), na conta da aba.
//
// A resposta fica guardada com a academia e o dia, e só é lida no render
// quando a chave bate com a de agora: o dia que vira com a assinatura desligada
// não entrega os checks de ontem, e o "Acessar como", que troca de academia
// sem recarregar a página, não mostra os checks da academia anterior. Nada de
// setState no corpo do effect: o estado só muda nas respostas da assinatura.

const EMPTY = new Map();

export function useTeamRoutineMarks({ db, enabled = true, tenantId, dayKey }) {
  const [snap, setSnap] = useState(null);

  useEffect(() => {
    if (!db || !enabled || !dayKey) return undefined;
    const key = `${tenantId}|${dayKey}`;
    const ref = collection(db, 'artifacts', appId, 'public', 'data', ROUTINE_MARKS_PATH);
    const unsub = onSnapshot(
      query(ref, where('date', '==', dayKey)),
      (res) => {
        const next = new Map();
        res.docs.forEach((d) => {
          const data = d.data({ serverTimestamps: 'estimate' });
          if (!data.consultantId || !data.taskId) return;
          const doneAt = typeof data.doneAt?.toDate === 'function' ? data.doneAt.toDate() : null;
          if (!next.has(data.consultantId)) next.set(data.consultantId, new Map());
          next.get(data.consultantId).set(data.taskId, { id: d.id, doneAt, note: data.note || '' });
        });
        setSnap({ key, marks: next, error: false });
      },
      (err) => {
        console.error('useTeamRoutineMarks onSnapshot falhou', err);
        setSnap({ key, marks: EMPTY, error: true });
      },
    );
    return () => unsub();
  }, [db, enabled, tenantId, dayKey]);

  const key = dayKey ? `${tenantId}|${dayKey}` : null;
  const current = snap !== null && key !== null && snap.key === key;
  return { marks: current ? snap.marks : EMPTY, loading: !current, error: current ? snap.error : false };
}
```

- [ ] **Step 4: escrever `src/hooks/useMinuteClock.js`**

```js
import { useEffect, useState } from 'react';

// Relógio que anda a cada minuto, no ritmo da Meta diária. Serve às telas que
// mostram o estado da tarefa na hora de agora: a aba Hoje e a prévia do modelo
// aberto, nas Rotinas.
export function useMinuteClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
```

- [ ] **Step 5: rodar e ver passar, e o lint**

Run: `npx vitest run src/lib/__tests__/useTeamRoutineMarks.test.js && npx eslint src/hooks/useTeamRoutineMarks.js src/hooks/useMinuteClock.js`
Expected: PASS e lint sem erro.

- [ ] **Step 6: commit**

```bash
git add src/hooks/useTeamRoutineMarks.js src/hooks/useMinuteClock.js src/lib/__tests__/useTeamRoutineMarks.test.js
git commit -m "feat: assinatura dos checks de hoje da academia e relógio de minuto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: o endereço da aba Hoje

**Files:**
- Modify: `src/lib/routes.js` (`ROTINAS_TABS`)
- Test: `src/lib/__tests__/routes.test.js`, `src/lib/__tests__/routes.decision.test.js`, `src/lib/__tests__/routes.professor.test.js`, `src/lib/__tests__/appShell.test.js`

- [ ] **Step 1: escrever os testes**

Em `src/lib/__tests__/routes.test.js`:

1. No teste `it('a tabela de sub-telas é congelada e o padrão de cada uma existe nela', ...)`, troque `for (const id of ['settings', 'ficha']) {` por `for (const id of ['settings', 'ficha', 'rotinas']) {`.
2. Dentro do `describe('Rotinas no endereço', ...)`, logo depois do teste `it('lê a lista, a aba Modelos e o modelo aberto', ...)`, acrescente:

```js
  it('lê e monta a aba Hoje', () => {
    expect(parseAppPath(`/${T}/rotinas/hoje`)).toMatchObject({ screen: 'rotinas', sub: 'hoje', subUnknown: false, unknown: false });
    expect(parseAppPath(`/${T}/rotinas/HOJE`)).toMatchObject({ screen: 'rotinas', sub: 'hoje' });
    expect('modelId' in parseAppPath(`/${T}/rotinas/hoje`)).toBe(false);
    expect(parseAppPath(`/${T}/rotinas/hoje/x`)).toMatchObject({ screen: 'rotinas', subUnknown: true });
    expect(hrefFor(T, 'rotinas', { sub: 'hoje' })).toBe(`/${T}/rotinas/hoje`);
    // A aba Modelos manda sub null: o endereço dela é o curto, o mesmo do menu.
    expect(hrefFor(T, 'rotinas', { sub: null })).toBe(`/${T}/rotinas`);
    expect(parseAppPath(hrefFor(T, 'rotinas', { sub: 'hoje' }))).toMatchObject({ screen: 'rotinas', sub: 'hoje' });
    // O modelo aberto ganha da aba: o endereço do modelo é um só.
    expect(hrefFor(T, 'rotinas', { sub: 'hoje', modelId: 'AbC' })).toBe(`/${T}/rotinas/modelos/AbC`);
  });
```

Em `src/lib/__tests__/routes.decision.test.js`, dentro do `describe('Rotinas na decisão de rota', ...)`, logo depois do teste `it('o gestor abre a lista e o modelo aberto de primeira', ...)`, acrescente:

```js
  it('a aba Hoje abre de primeira para o gestor, e só para ele', () => {
    expect(decide(`/${T}/rotinas/hoje`, admin)).toEqual({ kind: 'ok' });
    expect(decide(`/${T}/rotinas/hoje`, consultor)).toEqual(casa(`/${T}`, { screen: 'dashboard' }, 'so-gestor'));
    expect(decide('/rotinas/hoje', admin)).toEqual(casa(`/${T}/rotinas/hoje`, { screen: 'rotinas', sub: 'hoje' }));
    expect(decide('/outra/rotinas/hoje', admin)).toEqual(casa(`/${T}/rotinas/hoje`, { screen: 'rotinas', sub: 'hoje' }));
    expect(decide(`/${T}/rotinas/hoje/x`, admin)).toEqual(casa(`/${T}/rotinas`, { screen: 'rotinas' }));
  });

  it('a aba Hoje tem a mesma chave e o mesmo molde da lista: trocar de aba não remonta a tela', () => {
    expect(screenKey(parseAppPath(`/${T}/rotinas/hoje`))).toBe('rotinas');
    expect(routeTemplate(`/${T}/rotinas/hoje`)).toBe('/:tenant/rotinas');
  });
```

Em `src/lib/__tests__/routes.professor.test.js`, no teste `it('Rotinas é do gestor: ...')`, troque a lista do `for` por:

```js
    for (const p of [`/${T}/rotinas`, `/${T}/rotinas/modelos`, `/${T}/rotinas/modelos/M1`, `/${T}/rotinas/hoje`, `/${T}/rotinas/xyz`]) {
```

Em `src/lib/__tests__/appShell.test.js`, dentro do `describe('Rotinas', ...)`, acrescente no fim:

```js
  it('a aba Hoje vem do endereço, sem modelo aberto', () => {
    expect(screenState(parseAppPath(`/${T}/rotinas/hoje`), null, gestor)).toMatchObject({ activeTab: 'rotinas', sub: 'hoje', modelId: null });
  });
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/routes.test.js src/lib/__tests__/routes.decision.test.js src/lib/__tests__/routes.professor.test.js src/lib/__tests__/appShell.test.js`
Expected: FAIL nos testes novos (`/rotinas/hoje` vira `subUnknown`).

- [ ] **Step 3: a aba no `routes.js`**

Em `src/lib/routes.js`, troque o bloco do `ROTINAS_TABS` (comentário incluído) por:

```js
// Abas da tela Rotinas (spec 2026-10-06): Modelos e Hoje. O modelo aberto mora
// em /rotinas/modelos/<id>, lido à parte em readScreen. A aba Modelos é o
// endereço curto /<academia>/rotinas: a RotinasView manda sub null para ela, e
// /rotinas/modelos continua abrindo a lista.
export const ROTINAS_TABS = Object.freeze({
  modelos: 'modelos',
  hoje: 'hoje',
});
```

- [ ] **Step 4: rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/routes.test.js src/lib/__tests__/routes.decision.test.js src/lib/__tests__/routes.professor.test.js src/lib/__tests__/appShell.test.js src/lib/__tests__/sentryScrub.test.js src/lib/__tests__/tenantSlug.test.js`
Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add src/lib/routes.js src/lib/__tests__/routes.test.js src/lib/__tests__/routes.decision.test.js src/lib/__tests__/routes.professor.test.js src/lib/__tests__/appShell.test.js
git commit -m "feat: endereço da aba Hoje das rotinas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: as peças divididas (tons, círculo do estado e rosto)

**Files:**
- Create: `src/components/rotinas/routineTones.js`
- Create: `src/components/rotinas/StateMark.jsx`
- Create: `src/components/rotinas/PersonInitials.jsx`
- Modify: `src/components/dailygoal/RoutineCard.jsx` (os três blocos de tom saem, e entra o import)
- Test: `src/lib/__tests__/rotinasPecas.test.js`

- [ ] **Step 1: escrever o teste**

Crie `src/lib/__tests__/rotinasPecas.test.js`:

```js
// @vitest-environment jsdom
// As peças das telas das rotinas: o círculo do estado, só de leitura, com os
// tons do cartão da Meta, e o rosto de iniciais, todo de span (ele mora também
// dentro do link do cartão do modelo, e link não aceita div).
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StateMark } from '../../components/rotinas/StateMark.jsx';
import { PersonInitials } from '../../components/rotinas/PersonInitials.jsx';
import { CHECK_TONE } from '../../components/rotinas/routineTones.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const montar = async (el) => { await act(async () => { root.render(el); }); };
const classes = (el) => el.className.split(/\s+/);

describe('StateMark', () => {
  it.each(['done', 'doneLate'])('%s leva o visto e o tom de feita', async (state) => {
    await montar(h(StateMark, { state }));
    const mark = container.firstElementChild;
    expect(mark.tagName).toBe('SPAN');
    expect(mark.getAttribute('aria-hidden')).toBe('true');
    expect(mark.querySelector('svg')).not.toBeNull();
    expect(classes(mark)).toContain('bg-emerald-600');
  });

  it.each(['late', 'now', 'later', 'open'])('%s não leva o visto e usa o tom do cartão da Meta', async (state) => {
    await montar(h(StateMark, { state }));
    const mark = container.firstElementChild;
    expect(mark.querySelector('svg')).toBeNull();
    expect(classes(mark)).toEqual(expect.arrayContaining(CHECK_TONE[state].split(' ')));
  });

  it('não é botão: quem olha não marca', async () => {
    await montar(h(StateMark, { state: 'late' }));
    expect(container.querySelector('button')).toBeNull();
  });
});

describe('PersonInitials', () => {
  it('é um span decorativo com as iniciais e o tamanho pedido', async () => {
    await montar(h(PersonInitials, { name: 'Ana Souza', size: 30 }));
    const face = container.firstElementChild;
    expect(face.tagName).toBe('SPAN');
    expect(face.getAttribute('aria-hidden')).toBe('true');
    expect(face.textContent).toBe('AS');
    expect(face.style.width).toBe('30px');
    expect(face.style.height).toBe('30px');
  });

  it('a cor sai do nome: o mesmo nome tem sempre a mesma cor', async () => {
    await montar(h('div', null, h(PersonInitials, { name: 'Ana Souza' }), h(PersonInitials, { name: 'Ana Souza' })));
    const [a, b] = container.firstElementChild.children;
    expect(a.style.background).not.toBe('');
    expect(a.style.background).toBe(b.style.background);
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/rotinasPecas.test.js`
Expected: FAIL, porque os arquivos não existem.

- [ ] **Step 3: `src/components/rotinas/routineTones.js`**

```js
// Os tons de cada estado da tarefa da rotina ('done', 'doneLate', 'late',
// 'now', 'later' e 'open', os da regra do dia em src/lib/rotinas.js). Divididos
// pelo cartão "Rotina de hoje" da Meta diária e pela tela Rotinas do gestor (a
// aba Hoje, a prévia do modelo aberto e a apresentação): um estado tem uma cor
// só no app inteiro.

// O círculo do estado. No escuro o bg-card é translúcido e a régua da linha do
// tempo aparece por dentro do círculo vazio, por isso os estados sem check
// levam fundo sólido.
export const CHECK_TONE = {
  done: 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500',
  doneLate: 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500',
  late: 'border-rose-400 bg-rose-50 dark:bg-[#2a1326]',
  now: 'border-brand-600 bg-card ring-4 ring-brand-600/15 dark:bg-[#0c1126]',
  later: 'border-slate-300 bg-card dark:border-white/20 dark:bg-[#0c1126]',
  open: 'border-slate-300 bg-card dark:border-white/20 dark:bg-[#0c1126]',
};

// O texto do estado, embaixo do nome da tarefa.
export const META_TONE = {
  done: 'text-emerald-700 dark:text-emerald-300',
  doneLate: 'text-amber-700 dark:text-amber-300',
  late: 'text-rose-600 dark:text-rose-300',
  now: 'font-medium text-brand-600 dark:text-brand-300',
  later: 'text-muted-foreground',
  open: 'text-muted-foreground',
};

// As barrinhas da contagem, no cabeçalho do cartão da Meta.
export const SEG_TONE = {
  done: 'bg-emerald-600 dark:bg-emerald-500',
  doneLate: 'bg-emerald-600 dark:bg-emerald-500',
  late: 'bg-rose-500',
  now: 'bg-brand-600',
  later: 'bg-slate-200 dark:bg-white/15',
  open: 'bg-slate-200 dark:bg-white/15',
};
```

- [ ] **Step 4: o `RoutineCard` passa a importar os tons**

Em `src/components/dailygoal/RoutineCard.jsx`, logo depois da linha `import { markDone, saveMarkNote, undoMark } from '../../lib/rotinasWrites.js';`, acrescente:

```js
import { CHECK_TONE, META_TONE, SEG_TONE } from '../rotinas/routineTones.js';
```

E troque este bloco inteiro:

```js
const DONE = new Set(['done', 'doneLate']);

// No escuro o bg-card é translúcido e a régua da linha do tempo aparece por
// dentro do círculo vazio, por isso os estados sem check levam fundo sólido.
const CHECK_TONE = {
  done: 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500',
  doneLate: 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500',
  late: 'border-rose-400 bg-rose-50 dark:bg-[#2a1326]',
  now: 'border-brand-600 bg-card ring-4 ring-brand-600/15 dark:bg-[#0c1126]',
  later: 'border-slate-300 bg-card dark:border-white/20 dark:bg-[#0c1126]',
  open: 'border-slate-300 bg-card dark:border-white/20 dark:bg-[#0c1126]',
};

const META_TONE = {
  done: 'text-emerald-700 dark:text-emerald-300',
  doneLate: 'text-amber-700 dark:text-amber-300',
  late: 'text-rose-600 dark:text-rose-300',
  now: 'font-medium text-brand-600 dark:text-brand-300',
  later: 'text-muted-foreground',
  open: 'text-muted-foreground',
};

const SEG_TONE = {
  done: 'bg-emerald-600 dark:bg-emerald-500',
  doneLate: 'bg-emerald-600 dark:bg-emerald-500',
  late: 'bg-rose-500',
  now: 'bg-brand-600',
  later: 'bg-slate-200 dark:bg-white/15',
  open: 'bg-slate-200 dark:bg-white/15',
};
```

por:

```js
const DONE = new Set(['done', 'doneLate']);
```

- [ ] **Step 5: `src/components/rotinas/StateMark.jsx`**

```jsx
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isDoneState } from '../../lib/rotinasTela.js';
import { CHECK_TONE } from './routineTones.js';

// O círculo do estado da tarefa, só de leitura: a aba Hoje, a prévia do modelo
// aberto e a apresentação. O círculo que marca e desmarca é o botão do cartão
// "Rotina de hoje" da Meta diária, e ele não mora aqui. É decorativo: o estado
// está sempre escrito ao lado.
export function StateMark({ state, className }) {
  return (
    <span
      aria-hidden="true"
      className={cn('grid size-[18px] shrink-0 place-items-center rounded-full border-2', CHECK_TONE[state], className)}
    >
      {isDoneState(state) && <Check size={10} strokeWidth={3.2} />}
    </span>
  );
}
```

- [ ] **Step 6: `src/components/rotinas/PersonInitials.jsx`**

```jsx
import { cn } from '@/lib/utils';
import { getKanbanAvatarPalette, getKanbanInitials } from '../../lib/kanban.js';

// O rosto de iniciais das telas das rotinas. É todo de span, porque mora
// também dentro do link do cartão do modelo, e link não aceita div (o Avatar
// do app é uma div). A cor sai do nome, com a mesma conta do avatar do
// Pipeline, e a cor do texto muda no tema escuro. É decorativo: o nome da
// pessoa está sempre escrito ao lado.
export function PersonInitials({ name, size = 26, className }) {
  const [bg, fg, fgDark] = getKanbanAvatarPalette(String(name || ''));
  return (
    <span
      aria-hidden="true"
      className={cn('grid shrink-0 place-items-center rounded-full font-bold [color:var(--pi-fg)] dark:[color:var(--pi-fg-dark)]', className)}
      style={{ width: size, height: size, background: bg, fontSize: Math.round(size * 0.38), '--pi-fg': fg, '--pi-fg-dark': fgDark || fg }}
    >
      {getKanbanInitials(name)}
    </span>
  );
}
```

- [ ] **Step 7: rodar e ver passar, com o cartão da Meta junto**

Run: `npx vitest run src/lib/__tests__/rotinasPecas.test.js src/lib/__tests__/routineCard.test.js && npx eslint src/components/rotinas src/components/dailygoal/RoutineCard.jsx`
Expected: PASS e lint sem erro.

- [ ] **Step 8: commit**

```bash
git add src/components/rotinas/routineTones.js src/components/rotinas/StateMark.jsx src/components/rotinas/PersonInitials.jsx src/components/dailygoal/RoutineCard.jsx src/lib/__tests__/rotinasPecas.test.js
git commit -m "refactor: tons da rotina divididos, círculo do estado e rosto de iniciais

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: a aba Hoje (componentes)

**Files:**
- Create: `src/components/rotinas/TodayTab.jsx`
- Create: `src/components/rotinas/PersonDayCard.jsx`
- Create: `src/components/rotinas/TodayAside.jsx`
- Test: `src/lib/__tests__/todayTab.test.js`

Antes de escrever, abra `docs/superpowers/specs/mockups/2026-10-08-rotinas-aba-hoje.html` na aba **Hoje A**, nos dois temas. O cartão de cada pessoa **não** tem a linha do dia (`.prail` do mockup): tire-a do desenho.

- [ ] **Step 1: escrever o teste**

Crie `src/lib/__tests__/todayTab.test.js`:

```js
// @vitest-environment jsdom
// A aba Hoje da tela Rotinas (spec 2026-10-06, "Aba Hoje"; mockup
// 2026-10-08-rotinas-aba-hoje.html, Hoje A, sem a linha do dia no cartão de
// cada pessoa). Os dados são os do mockup, às 10:47 de uma terça: a Ana e o
// Bruno seguem o Consultor manhã, a Carla o Consultor tarde, e o Diego está sem
// modelo. Os checks chegam por um useTeamRoutineMarks falso.
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const s = vi.hoisted(() => ({ marks: new Map(), loading: false, error: false, args: null }));
vi.mock('../../hooks/useTeamRoutineMarks.js', () => ({
  useTeamRoutineMarks: (args) => {
    s.args = args;
    return { marks: s.marks, loading: s.loading, error: s.error };
  },
}));

const { TodayTab } = await import('../../components/rotinas/TodayTab.jsx');

const DB = {};
const at = (hhmm, day = 6) => { const [hh, mm] = hhmm.split(':').map(Number); return new Date(2026, 9, day, hh, mm); };
const NOW = at('10:47');
const t = (id, time, title) => ({ id, title, how: '', days: 'all', time, active: true });
const MANHA = {
  id: 'manha',
  name: 'Consultor manhã',
  followerIds: ['ana', 'bruno'],
  tasks: [
    t('t1', '06:00', 'Abrir a recepção'),
    t('t2', '06:30', 'Conferir a agenda de aulas'),
    t('t3', '07:00', 'Montar a lista de contatos do dia'),
    t('t4', '07:30', 'Responder os follow-ups'),
    t('t5', '10:00', 'Ligações para leads novos'),
    t('t6', '10:30', 'Conferir as visitas da tarde'),
    t('t7', '11:00', 'Intervalo'),
    t('t8', '12:00', 'Contato com inativos'),
    t('t9', '13:00', 'Renovações do mês'),
    t('t10', null, 'Pedir indicações'),
    t('t11', null, 'Postar o story da aula'),
  ],
};
const TARDE = {
  id: 'tarde',
  name: 'Consultor tarde',
  followerIds: ['carla'],
  tasks: [
    t('u1', '13:00', 'Conferir a agenda da tarde'),
    t('u2', '14:00', 'Ligações para leads novos'),
    t('u3', '16:00', 'Follow-ups da tarde'),
    t('u4', '18:00', 'Receber as visitas'),
    t('u5', '20:30', 'Resumo do dia no grupo'),
    t('u6', null, 'Atualizar o Stronilead'),
  ],
};
// Na ordem da equipe, com o Diego antes: quem está sem modelo vai para o fim.
const PEOPLE = [
  { id: 'diego', name: 'Diego Rocha' },
  { id: 'ana', name: 'Ana Souza' },
  { id: 'bruno', name: 'Bruno Lima' },
  { id: 'carla', name: 'Carla Dias' },
];
const check = (hhmm, note = '', day = 6) => ({ id: `c-${hhmm}`, doneAt: at(hhmm, day), note });
const MARKS = () => new Map([
  ['ana', new Map([
    ['t1', check('06:04')], ['t2', check('06:41')], ['t3', check('07:58', 'Lista com 42 leads, começando pelos parados.')],
    ['t4', check('08:20')], ['t10', check('09:15', 'Pedi para 3 alunos da turma das 7h.')],
  ])],
  ['bruno', new Map([
    ['t1', check('06:02')], ['t2', check('06:33')], ['t3', check('07:05')], ['t4', check('07:40')], ['t5', check('10:12')], ['t11', check('09:30')],
  ])],
]);

let container;
let root;
let onChooseModel;
beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  s.marks = MARKS();
  s.loading = false;
  s.error = false;
  s.args = null;
  onChooseModel = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

const render = async (props = {}) => {
  await act(async () => {
    root.render(h(MemoryRouter, null, h(TodayTab, {
      db: DB,
      people: PEOPLE,
      models: [MANHA, TARDE],
      modelsLoading: false,
      tenantId: 'acad',
      listenersActive: true,
      modelLink: (id) => ({ to: `/acad/rotinas/modelos/${id}`, state: { fromList: true } }),
      onChooseModel,
      ...props,
    })));
  });
};
const card = (name) => container.querySelector(`section[aria-label="${name}"]`);
const rowOf = (section, title) => [...section.querySelectorAll('button')].find((b) => b.textContent.includes(title));
const side = (title) => [...container.querySelectorAll('h2')].find((el) => el.textContent.startsWith(title))?.closest('section');
const detalhe = () => container.querySelector('[aria-label="Detalhe da tarefa"]');
const click = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.click(); });
};

describe('a leitura', () => {
  it('lê os checks de hoje da academia, presa ao portão de ociosidade', async () => {
    await render();
    expect(s.args).toEqual({ db: DB, enabled: true, tenantId: 'acad', dayKey: '2026-10-06' });
    await render({ listenersActive: false });
    expect(s.args.enabled).toBe(false);
  });

  it('carregando os modelos ou os checks, e a falha', async () => {
    await render({ modelsLoading: true });
    expect(container.textContent).toBe('Carregando a rotina de hoje…');
    s.loading = true;
    await render();
    expect(container.textContent).toBe('Carregando a rotina de hoje…');
    s.loading = false;
    s.error = true;
    await render();
    expect(container.textContent).toBe('Não deu para carregar os checks de hoje. Recarregue a página.');
  });
});

describe('o topo', () => {
  it('a conta da equipe, com o destaque, e o Ao vivo', async () => {
    await render();
    const titulo = container.querySelector('h1');
    expect(titulo.textContent).toBe('A equipe fez 11 de 28 tarefas da rotina até agora, e 1 está atrasada.');
    expect([...titulo.querySelectorAll('em')].map((em) => em.textContent)).toEqual(['11 de 28', '1 está atrasada']);
    expect(container.textContent).toContain('Ao vivo · 10:47');
  });

  it('o relógio anda sozinho a cada minuto', async () => {
    vi.useFakeTimers({ now: NOW });
    await render();
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(container.textContent).toContain('Ao vivo · 10:48');
  });
});

describe('o cartão de cada consultor', () => {
  it('um por pessoa, na ordem da equipe, e quem está sem modelo no fim', async () => {
    await render();
    const nomes = [...container.querySelectorAll('section[aria-label]')].map((el) => el.getAttribute('aria-label'));
    expect(nomes.filter((n) => PEOPLE.some((p) => p.name === n))).toEqual(['Ana Souza', 'Bruno Lima', 'Carla Dias', 'Diego Rocha']);
  });

  it('o modelo é um link para o modelo aberto, e a contagem diz o que está atrasado', async () => {
    await render();
    const ana = card('Ana Souza');
    const link = ana.querySelector('a');
    expect(link.textContent).toBe('Consultor manhã');
    expect(link.getAttribute('href')).toBe('/acad/rotinas/modelos/manha');
    expect(ana.textContent).toContain('5 de 11');
    expect(ana.textContent).toContain('1 atrasada');
    expect(card('Bruno Lima').textContent).toContain('6 de 11');
    expect(card('Bruno Lima').textContent).toContain('nada atrasado');
  });

  it('cada tarefa com o horário, o texto do estado e a observação', async () => {
    await render();
    const ana = card('Ana Souza');
    expect(rowOf(ana, 'Abrir a recepção').textContent).toBe('06:00Abrir a recepçãoFeita às 06:04');
    expect(rowOf(ana, 'Montar a lista de contatos do dia').textContent)
      .toBe('07:00Montar a lista de contatos do diaFeita às 07:58, depois do horário · com observação');
    expect(rowOf(ana, 'Ligações para leads novos').textContent).toBe('10:00Ligações para leads novosEra às 10:00, atrasada há 47 min');
    expect(rowOf(ana, 'Conferir as visitas da tarde').textContent).toBe('10:30Conferir as visitas da tardeÉ agora');
    expect(rowOf(ana, 'Intervalo').textContent).toBe('11:00IntervaloEm 13 min');
    expect(rowOf(ana, 'Postar o story da aula').textContent).toBe('Postar o story da aulaAté o fim do dia');
    expect(ana.textContent).toContain('A qualquer hora');
  });

  it('a linha do agora entra antes da primeira tarefa que ainda não chegou', async () => {
    await render();
    const ana = card('Ana Souza');
    expect(ana.querySelectorAll('[data-agora]')).toHaveLength(1);
    const agora = ana.querySelector('[data-agora]');
    expect(agora.textContent).toBe('10:47');
    expect(agora.previousElementSibling.textContent).toContain('Conferir as visitas da tarde');
    expect(agora.nextElementSibling.textContent).toContain('Intervalo');
  });

  it('o cartão não tem a linha do dia: só o cabeçalho e a lista', async () => {
    await render();
    const ana = card('Ana Souza');
    expect([...ana.children].map((el) => el.tagName)).toEqual(['DIV', 'DIV']);
    expect(ana.querySelector('[style*="left"]')).toBeNull();
  });

  it('antes da rotina começar, e sem nada feito, só diz quando ela começa', async () => {
    await render();
    const carla = card('Carla Dias');
    expect(carla.textContent).toContain('0 de 6');
    expect(carla.textContent).toContain('A rotina começa às 13:00. 6 tarefas hoje.');
    expect(carla.querySelectorAll('button')).toHaveLength(0);
  });

  it('quem está sem modelo: o aviso e o Escolher modelo, que leva à aba Modelos', async () => {
    await render();
    const diego = card('Diego Rocha');
    expect(diego.textContent).toContain('Sem modelo');
    expect(diego.textContent).toContain('A Meta diária não mostra rotina para essa pessoa.');
    expect(diego.querySelector('a')).toBeNull();
    await click([...diego.querySelectorAll('button')].find((b) => b.textContent === 'Escolher modelo'));
    expect(onChooseModel).toHaveBeenCalledTimes(1);
  });

  it('o check de outro dia não conta', async () => {
    s.marks.get('bruno').set('t11', check('09:30', '', 5));
    await render();
    expect(card('Bruno Lima').textContent).toContain('5 de 11');
  });

  it('modelo sem tarefa hoje', async () => {
    vi.useFakeTimers({ now: at('10:47', 10), toFake: ['Date'] });
    await render();
    expect(card('Ana Souza').textContent).toContain('Nenhuma tarefa hoje neste modelo.');
    expect(card('Ana Souza').textContent).not.toContain(' de ');
  });
});

describe('o gestor só acompanha', () => {
  it('nenhum botão de check, e as tarefas são botões de mostrar o detalhe', async () => {
    await render();
    expect(container.querySelector('[aria-label^="Feita:"]')).toBeNull();
    const botoes = [...card('Ana Souza').querySelectorAll('button')];
    expect(botoes).toHaveLength(11);
    expect(botoes.every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true);
  });

  it('tocar numa tarefa mostra o detalhe no topo da lateral, e Fechar ou tocar de novo fecha', async () => {
    await render();
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
    await click(rowOf(card('Ana Souza'), 'Montar a lista de contatos do dia'));
    expect(rowOf(card('Ana Souza'), 'Montar a lista de contatos do dia').getAttribute('aria-pressed')).toBe('true');
    expect(detalhe().textContent).toContain('Detalhe');
    expect(detalhe().textContent).toContain('Ana Souza');
    expect(detalhe().textContent).toContain('07:00 · Montar a lista de contatos do dia');
    expect(detalhe().textContent).toContain('Feita às 07:58, depois do horário');
    expect(detalhe().textContent).toContain('Lista com 42 leads, começando pelos parados.');
    await click([...detalhe().querySelectorAll('button')].find((b) => b.textContent === 'Fechar'));
    expect(detalhe()).toBeNull();
    await click(rowOf(card('Ana Souza'), 'Intervalo'));
    expect(detalhe().textContent).toContain('Em 13 min');
    await click(rowOf(card('Ana Souza'), 'Intervalo'));
    expect(detalhe()).toBeNull();
  });
});

describe('a lateral', () => {
  it('Atrasadas agora, com quem, qual tarefa e há quanto tempo', async () => {
    await render();
    const atrasadas = side('Atrasadas agora');
    expect(atrasadas.querySelector('h2').textContent).toBe('Atrasadas agora 1');
    expect(atrasadas.textContent).toContain('Ana · Ligações para leads novos');
    expect(atrasadas.textContent).toContain('Era às 10:00, há 47 min');
  });

  it('Observações de hoje, a mais recente primeiro', async () => {
    await render();
    const notas = side('Observações de hoje');
    expect(notas.querySelector('h2').textContent).toBe('Observações de hoje 2');
    const texto = notas.textContent;
    expect(texto).toContain('Ana · Pedir indicações');
    expect(texto).toContain('Pedi para 3 alunos da turma das 7h.');
    expect(texto.indexOf('Às 09:15')).toBeLessThan(texto.indexOf('Às 07:58'));
  });

  it('sem atrasadas e sem observações', async () => {
    vi.useFakeTimers({ now: at('06:10'), toFake: ['Date'] });
    s.marks = new Map();
    await render();
    expect(container.querySelector('h1').textContent).toBe('A equipe fez 0 de 28 tarefas da rotina até agora. Nenhuma está atrasada.');
    expect(side('Atrasadas agora').textContent).toContain('Ninguém com tarefa atrasada.');
    expect(side('Observações de hoje').textContent).toContain('Nenhuma observação até agora.');
  });
});

describe('os casos sem conta', () => {
  it('sem consultor na equipe', async () => {
    await render({ people: [] });
    expect(container.querySelector('h1').textContent).toBe('Nenhum consultor na equipe ainda.');
    expect(container.textContent).toContain('Cadastre os consultores em Configurações, em Equipe & acessos, e escolha o modelo de cada um na aba Modelos.');
    expect(container.querySelector('section')).toBeNull();
  });

  it('ninguém segue um modelo', async () => {
    await render({ models: [{ ...MANHA, followerIds: [] }, { ...TARDE, followerIds: [] }] });
    expect(container.querySelector('h1').textContent).toBe('Ninguém segue um modelo ainda.');
    expect([...container.querySelectorAll('button')].filter((b) => b.textContent === 'Escolher modelo')).toHaveLength(4);
  });

  it('ninguém tem tarefa hoje', async () => {
    vi.useFakeTimers({ now: at('10:47', 10), toFake: ['Date'] });
    await render();
    expect(container.querySelector('h1').textContent).toBe('Hoje não tem tarefa da rotina para a equipe.');
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/todayTab.test.js`
Expected: FAIL, porque `TodayTab.jsx` não existe.

- [ ] **Step 3: `src/components/rotinas/PersonDayCard.jsx`**

```jsx
import { Fragment } from 'react';
import { cn } from '@/lib/utils';
import { stateText } from '../../lib/rotinas.js';
import { clockText, isDoneState } from '../../lib/rotinasTela.js';
import { AppLink } from '../nav/AppLink.jsx';
import { PersonInitials } from './PersonInitials.jsx';
import { StateMark } from './StateMark.jsx';
import { META_TONE } from './routineTones.js';

// O cartão de um consultor na aba Hoje (mockup 2026-10-08-rotinas-aba-hoje.html,
// Hoje A). Sem a linha do dia logo abaixo do nome: o Johnny a tirou ao
// escolher a Hoje A, em 08/10/2026. Cada tarefa é um botão que mostra o
// detalhe na lateral (aria-pressed diz qual está aberta). Nenhum botão marca o
// check: quem marca é o consultor, na Meta diária.

// A linha do agora, com a hora, entre as tarefas com horário.
function NowLine({ now }) {
  return (
    <li aria-hidden="true" data-agora="" className="grid grid-cols-[42px_minmax(0,1fr)] items-center gap-[9px] px-2 py-0.5">
      <span className="num text-right text-[10.5px] font-semibold text-brand-600 dark:text-brand-300">{clockText(now)}</span>
      <span className="relative h-0.5 rounded bg-brand-600">
        <span className="absolute -left-[3px] -top-[3px] size-2 rounded-full bg-brand-600" />
      </span>
    </li>
  );
}

function TaskRow({ row, now, pressed, onSelect }) {
  const { task, state, doneAt, note } = row;
  return (
    <li>
      <button
        type="button"
        aria-pressed={pressed}
        onClick={onSelect}
        className={cn(
          'grid w-full grid-cols-[42px_18px_minmax(0,1fr)] items-center gap-[9px] rounded-[9px] px-2 py-1.5 text-left transition hover:bg-muted/60',
          pressed && 'bg-brand-600/[0.08] shadow-[inset_2px_0_0_var(--color-brand-600)] hover:bg-brand-600/[0.08]',
        )}
      >
        <span className="num text-right text-[11.5px] font-medium text-muted-foreground">{task.time ?? ''}</span>
        <StateMark state={state} />
        <span className="min-w-0">
          <span className={cn('block text-[13px] font-medium', isDoneState(state) && 'text-muted-foreground')}>{task.title}</span>
          <span className={cn('block text-[11px]', META_TONE[state])}>
            {stateText(task, state, doneAt ?? now, now)}
            {note && <span className="font-normal text-muted-foreground"> · com observação</span>}
          </span>
        </span>
      </button>
    </li>
  );
}

function Head({ person, children }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 px-3.5 pb-2.5 pt-3">
      <PersonInitials name={person.name} size={30} />
      {children}
    </div>
  );
}

export function PersonDayCard({ card, now, selectedTaskId, onSelect, modelLink, onChooseModel }) {
  const { person, model } = card;

  if (!model) {
    return (
      <section aria-label={person.name} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <Head person={person}>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold">{person.name}</p>
            <p className="text-[11.5px] font-semibold text-amber-700 dark:text-amber-300">Sem modelo</p>
          </div>
        </Head>
        <div className="flex flex-col items-start gap-2.5 border-t border-border bg-amber-500/[0.06] px-3.5 py-3.5 text-[12.5px] text-muted-foreground">
          A Meta diária não mostra rotina para essa pessoa.
          <button
            type="button"
            onClick={onChooseModel}
            className="h-8 rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-medium text-foreground"
          >
            Escolher modelo
          </button>
        </div>
      </section>
    );
  }

  const { timed, free, done, total, late, nowIndex, startsAt } = card;
  const rowEl = (row) => (
    <TaskRow
      key={row.task.id}
      row={row}
      now={now}
      pressed={selectedTaskId === row.task.id}
      onSelect={() => onSelect(person.id, row.task.id)}
    />
  );

  return (
    <section aria-label={person.name} className="rounded-2xl border border-border bg-card shadow-card">
      <Head person={person}>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">{person.name}</p>
          <AppLink {...modelLink(model.id)} className="block truncate text-[11.5px] font-semibold text-brand-600 dark:text-brand-300">
            {model.name}
          </AppLink>
        </div>
        {total > 0 && (
          <p className="text-right">
            <span className="num block font-display text-[18px] font-semibold leading-none">
              {done} <span className="text-[12px] font-medium text-muted-foreground">de {total}</span>
            </span>
            {late > 0
              ? <span className="mt-1 block text-[11px] font-semibold text-rose-600 dark:text-rose-300">{late} {late === 1 ? 'atrasada' : 'atrasadas'}</span>
              : <span className="mt-1 block text-[11px] text-muted-foreground">nada atrasado</span>}
          </p>
        )}
      </Head>
      <div className="border-t border-border px-1.5 pb-2 pt-1.5">
        {total === 0 && <p className="px-2 py-1.5 text-[12px] text-muted-foreground">Nenhuma tarefa hoje neste modelo.</p>}
        {total > 0 && startsAt && (
          <p className="px-2 py-1.5 text-[12px] text-muted-foreground">
            A rotina começa às {startsAt}. {total} {total === 1 ? 'tarefa' : 'tarefas'} hoje.
          </p>
        )}
        {total > 0 && !startsAt && (
          <>
            {timed.length > 0 && (
              <ol>
                {timed.map((row, i) => (
                  <Fragment key={row.task.id}>
                    {i === nowIndex && <NowLine now={now} />}
                    {rowEl(row)}
                  </Fragment>
                ))}
                {nowIndex === timed.length && <NowLine now={now} />}
              </ol>
            )}
            {free.length > 0 && (
              <>
                <p className="pb-0.5 pl-[59px] pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">A qualquer hora</p>
                <ol>{free.map(rowEl)}</ol>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: `src/components/rotinas/TodayAside.jsx`**

```jsx
import { useId } from 'react';
import { cn } from '@/lib/utils';
import { firstName, stateText } from '../../lib/rotinas.js';
import { clockText } from '../../lib/rotinasTela.js';
import { PersonInitials } from './PersonInitials.jsx';

// A lateral da aba Hoje: o detalhe da tarefa escolhida (no topo), as
// atrasadas de agora e as observações de hoje. O detalhe mora numa região
// aria-live que existe desde a montagem, para o leitor de tela ler o detalhe
// que aparece.

function Count({ n, late = false }) {
  return (
    <span
      className={cn(
        'num rounded-md px-[7px] py-[3px] font-sans text-[11px] font-semibold',
        late && n > 0 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300' : 'bg-muted text-muted-foreground',
      )}
    >
      {n}
    </span>
  );
}

function Quote({ children }) {
  return (
    <span className="mt-1.5 block rounded-[9px] border-l-2 border-brand-600 bg-muted px-2.5 py-1.5 text-[12px] text-foreground">
      {children}
    </span>
  );
}

function Row({ person, children }) {
  return (
    <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-[9px] text-[12.5px]">
      <PersonInitials name={person.name} size={24} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Card({ title, count, late = false, children }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="rounded-2xl border border-border bg-card px-3.5 pb-3 pt-3.5 shadow-card">
      <h2 id={titleId} className="flex items-center gap-2 font-display text-[14px] font-semibold">
        {title} <Count n={count} late={late} />
      </h2>
      {children}
    </section>
  );
}

export function TodayAside({ team, detail, now, onClose }) {
  return (
    <aside className="flex flex-col gap-3 lg:sticky lg:top-4">
      <div aria-live="polite">
        {detail && (
          <section aria-label="Detalhe da tarefa" className="rounded-2xl border border-brand-600/45 bg-card px-3.5 pb-3 pt-3.5 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-300">Detalhe</p>
              <button type="button" onClick={onClose} className="text-[12px] text-muted-foreground hover:text-foreground">Fechar</button>
            </div>
            <Row person={detail.person}>
              <p className="font-semibold">{detail.person.name}</p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">{detail.task.time ? `${detail.task.time} · ` : ''}{detail.task.title}</p>
              <p className={cn('mt-0.5 text-[11.5px]', detail.state === 'late' ? 'font-semibold text-rose-600 dark:text-rose-300' : 'text-muted-foreground')}>
                {stateText(detail.task, detail.state, detail.doneAt ?? now, now)}
              </p>
              {detail.note && <Quote>{detail.note}</Quote>}
            </Row>
          </section>
        )}
      </div>

      <Card title="Atrasadas agora" count={team.lateRows.length} late>
        {team.lateRows.length === 0 && <p className="mt-2.5 text-[12px] text-muted-foreground">Ninguém com tarefa atrasada.</p>}
        {team.lateRows.map((r) => (
          <Row key={`${r.person.id}-${r.task.id}`} person={r.person}>
            <p><b className="font-semibold">{firstName(r.person.name)}</b> · {r.task.title}</p>
            <p className="mt-0.5 text-[11.5px] font-semibold text-rose-600 dark:text-rose-300">{r.text}</p>
          </Row>
        ))}
      </Card>

      <Card title="Observações de hoje" count={team.notes.length}>
        {team.notes.length === 0 && <p className="mt-2.5 text-[12px] text-muted-foreground">Nenhuma observação até agora.</p>}
        {team.notes.map((n) => (
          <Row key={`${n.person.id}-${n.task.id}`} person={n.person}>
            <p><b className="font-semibold">{firstName(n.person.name)}</b> · {n.task.title}</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">Às {clockText(n.doneAt)}</p>
            <Quote>{n.note}</Quote>
          </Row>
        ))}
      </Card>
    </aside>
  );
}
```

- [ ] **Step 5: `src/components/rotinas/TodayTab.jsx`**

```jsx
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { useMinuteClock } from '../../hooks/useMinuteClock.js';
import { useTeamRoutineMarks } from '../../hooks/useTeamRoutineMarks.js';
import { routineDayKey } from '../../lib/rotinas.js';
import { clockText, findSelection, teamToday, todayHeadline } from '../../lib/rotinasTela.js';
import { PersonDayCard } from './PersonDayCard.jsx';
import { TodayAside } from './TodayAside.jsx';

// Aba Hoje da tela Rotinas (spec 2026-10-06, "Aba Hoje"; mockup
// 2026-10-08-rotinas-aba-hoje.html, Hoje A · Por pessoa, sem a linha do dia
// no cartão de cada pessoa). O gestor acompanha a rotina da equipe: ele nunca
// marca nem desmarca o check de ninguém, e esta aba não importa nada de
// rotinasWrites.js. O relógio anda a cada minuto, como na Meta diária, e os
// checks de hoje da academia chegam por assinatura, presa ao portão de
// ociosidade. As contas moram em src/lib/rotinasTela.js. A tarefa escolhida
// fica no estado da aba, e não no endereço: é passageira, como um menu aberto.
export function TodayTab({ db, people, models, modelsLoading = false, tenantId, listenersActive = true, modelLink, onChooseModel }) {
  const now = useMinuteClock();
  const { metaWeekdays = [1, 2, 3, 4, 5] } = useGeneralConfig();
  const { marks, loading, error } = useTeamRoutineMarks({ db, enabled: listenersActive, tenantId, dayKey: routineDayKey(now) });
  const [selected, setSelected] = useState(null); // { personId, taskId }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-[13.5px] shadow-card">
        Não deu para carregar os checks de hoje. Recarregue a página.
      </div>
    );
  }
  if (modelsLoading || loading) return <p className="py-6 text-[13.5px] text-muted-foreground">Carregando a rotina de hoje…</p>;

  const team = teamToday({ people, models, marksByPerson: marks, now, metaWeekdays });
  const headline = todayHeadline({ peopleCount: people.length, following: team.following, done: team.done, total: team.total, late: team.late });
  const detail = findSelection(team.cards, selected);
  const toggle = (personId, taskId) =>
    setSelected((cur) => (cur?.personId === personId && cur?.taskId === taskId ? null : { personId, taskId }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="max-w-[640px] font-display text-[26px] font-medium leading-tight tracking-tight">
          {headline.map((part) => (part.em
            ? (
              <em
                key={part.text}
                className={cn('font-bold not-italic', part.em === 'late' ? 'text-rose-600 dark:text-rose-300' : 'text-brand-600 dark:text-brand-300')}
              >
                {part.text}
              </em>
            )
            : <span key={part.text}>{part.text}</span>))}
        </h1>
        <p className="inline-flex items-center gap-2 whitespace-nowrap text-[12px] text-muted-foreground">
          <span aria-hidden="true" className="size-[7px] rounded-full bg-emerald-600 ring-[3px] ring-emerald-600/15 dark:bg-emerald-400" />
          <span>Ao vivo · <span className="num">{clockText(now)}</span></span>
        </p>
      </div>

      {people.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-[13px] text-muted-foreground">
          Cadastre os consultores em Configurações, em Equipe & acessos, e escolha o modelo de cada um na aba Modelos.
        </p>
      ) : (
        <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid items-start gap-3.5 xl:grid-cols-2">
            {team.cards.map((c) => (
              <PersonDayCard
                key={c.person.id}
                card={c}
                now={now}
                selectedTaskId={selected?.personId === c.person.id ? selected.taskId : null}
                onSelect={toggle}
                modelLink={modelLink}
                onChooseModel={onChooseModel}
              />
            ))}
          </div>
          <TodayAside team={team} detail={detail} now={now} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  );
}
```

O `key={part.text}` do título é único: os pedaços de cada frase nunca se repetem.

- [ ] **Step 6: rodar e ver passar, e o lint**

Run: `npx vitest run src/lib/__tests__/todayTab.test.js && npx eslint src/components/rotinas`
Expected: PASS e lint sem erro.

- [ ] **Step 7: commit**

```bash
git add src/components/rotinas/TodayTab.jsx src/components/rotinas/PersonDayCard.jsx src/components/rotinas/TodayAside.jsx src/lib/__tests__/todayTab.test.js
git commit -m "feat: aba Hoje das rotinas com o dia de cada consultor, atrasadas e observações

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: as abas Modelos e Hoje na tela

**Files:**
- Modify: `src/views/RotinasView.jsx`
- Modify: `src/App.jsx` (o bloco `{activeTab === 'rotinas' && isGestor(appUser) && (` com a `<RotinasView`)
- Test: `src/lib/__tests__/rotinasAbas.test.js`
- Modify: `src/lib/__tests__/rotinasView.test.js` (o teste do cabeçalho)

- [ ] **Step 1: escrever o teste das abas**

Crie `src/lib/__tests__/rotinasAbas.test.js`:

```js
// @vitest-environment jsdom
// As abas Modelos e Hoje da tela Rotinas moram no endereço (spec 2026-10-06,
// "Menu e endereço"): /<academia>/rotinas é Modelos, /<academia>/rotinas/hoje é
// Hoje, e trocar de aba troca o endereço com replace, como o goToSub do App. A
// aba Hoje só lê os checks com ela aberta, e o link do modelo no cartão da
// pessoa abre o modelo com o Voltar de volta para a Hoje.
import { act, createElement as h, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from 'react-router';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const s = vi.hoisted(() => ({ models: [], loading: false, marksArgs: null }));
vi.mock('../../hooks/useRoutineModels.js', () => ({
  useRoutineModels: () => ({ models: s.models, loading: s.loading, error: false }),
}));
vi.mock('../../hooks/useTeamRoutineMarks.js', () => ({
  useTeamRoutineMarks: (args) => {
    s.marksArgs = args;
    return { marks: new Map(), loading: false, error: false };
  },
}));
vi.mock('../firebase.js', () => ({
  appId: 'acad',
  ROUTINE_MODELS_PATH: 'stronix_rotina_modelos',
  ROUTINE_VERSIONS_PATH: 'stronix_rotina_versoes',
  ROUTINE_MARKS_PATH: 'stronix_rotina_marcas',
  db: {},
  auth: {},
}));
vi.mock('../rotinasWrites.js', async (importOriginal) => ({
  ...(await importOriginal()),
  createModel: vi.fn(),
  duplicateModel: vi.fn(),
  deleteModel: vi.fn(),
  updateModel: vi.fn(),
  setPersonModel: vi.fn(),
}));
// O MemoryRouter não grava o idx no window.history: quem diz se dá para voltar
// dentro do app é o teste.
vi.mock('../routes.js', async (importOriginal) => ({
  ...(await importOriginal()),
  canGoBackInApp: vi.fn(() => true),
}));

const { hrefFor } = await import('../routes.js');
const { ToastContext } = await import('../../contexts/ToastContext.jsx');
const { RotinasView } = await import('../../views/RotinasView.jsx');

// No jsdom o new URL relativo não é file:, então o caminho sai do import.meta.url como texto.
const APP = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../App.jsx'), 'utf8');
const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const GESTOR = { id: 'g1', authUid: 'g1', name: 'Bruno Gestor', role: 'admin' };
const EQUIPE = [
  GESTOR,
  { id: 'carla', authUid: 'carla', name: 'Carla Souza', role: 'consultant' },
  { id: 'diego', authUid: 'diego', name: 'Diego Lima', role: 'consultant' },
];
const M1 = {
  id: 'm1',
  name: 'Manhã',
  followerIds: ['carla'],
  tasks: [{ id: 't1', title: 'Conferir a agenda', how: '', days: 'all', time: '08:00', active: true }],
};
const LIST = '/acad/rotinas';
const HOJE = '/acad/rotinas/hoje';

const nav = { location: null, type: null };
function Screen() {
  const location = useLocation();
  const type = useNavigationType();
  const navigate = useNavigate();
  useEffect(() => {
    nav.location = location;
    nav.type = type;
  });
  const modelId = location.pathname.match(/\/rotinas\/modelos\/([^/]+)$/)?.[1];
  const tab = location.pathname.endsWith('/rotinas/hoje') ? 'hoje' : 'modelos';
  // O mesmo que o goToSub do App faz com a tela já aberta: replace, com o state de agora.
  const onTab = (subId) => navigate(hrefFor('acad', 'rotinas', { sub: subId }), { replace: true, state: location.state });
  return h(RotinasView, {
    key: modelId ?? 'lista', db: {}, appUser: GESTOR, usersList: EQUIPE, modelId, tab, onTab, tenantId: 'acad', listenersActive: true,
  });
}

let container;
let root;
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: new Date(2026, 9, 6, 10, 47), toFake: ['Date'] });
  s.models = [M1];
  s.loading = false;
  s.marksArgs = null;
  nav.location = null;
  nav.type = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

const render = async (entry) => {
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: [entry] }, h(ToastContext.Provider, { value: toast }, h(Screen))));
  });
};
const tabs = () => [...document.body.querySelectorAll('[role="tab"]')];
const tab = (nome) => tabs().find((el) => el.textContent.startsWith(nome));
// O Radix troca de aba no mousedown do botão esquerdo, e não no click.
const pressTab = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 })); });
};
const button = (label) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
const click = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.click(); });
};

describe('as abas no endereço', () => {
  it('/acad/rotinas abre Modelos, e a aba Hoje troca o endereço por /acad/rotinas/hoje, com replace', async () => {
    await render(LIST);
    expect(tabs().map((el) => el.textContent)).toEqual(['Modelos', 'Hoje 1 sem modelo']);
    expect(tab('Modelos').getAttribute('aria-selected')).toBe('true');
    expect(button('Novo modelo')).toBeTruthy();
    await pressTab(tab('Hoje'));
    expect(nav.location.pathname).toBe(HOJE);
    expect(nav.type).toBe('REPLACE');
    expect(tab('Hoje').getAttribute('aria-selected')).toBe('true');
    expect(document.body.querySelector('h1').textContent).toBe('A equipe fez 0 de 1 tarefa da rotina até agora, e 1 está atrasada.');
    expect(button('Novo modelo')).toBeUndefined();
  });

  it('/acad/rotinas/hoje abre a Hoje, e a aba Modelos volta para /acad/rotinas, com replace', async () => {
    await render(HOJE);
    expect(tab('Hoje').getAttribute('aria-selected')).toBe('true');
    await pressTab(tab('Modelos'));
    expect(nav.location.pathname).toBe(LIST);
    expect(nav.type).toBe('REPLACE');
    expect(button('Novo modelo')).toBeTruthy();
  });

  it('a aba Hoje só lê os checks com ela aberta', async () => {
    await render(LIST);
    expect(s.marksArgs).toBeNull();
    await pressTab(tab('Hoje'));
    expect(s.marksArgs).toEqual({ db: {}, enabled: true, tenantId: 'acad', dayKey: '2026-10-06' });
  });

  it('o selo da aba diz quantos estão sem modelo, e some com todos num modelo ou enquanto carrega', async () => {
    await render(LIST);
    expect(tab('Hoje').textContent).toBe('Hoje 1 sem modelo');
    s.models = [{ ...M1, followerIds: ['carla', 'diego'] }];
    await render(LIST);
    expect(tab('Hoje').textContent).toBe('Hoje');
    s.models = [];
    s.loading = true;
    await render(LIST);
    expect(tab('Hoje').textContent).toBe('Hoje');
  });

  it('Escolher modelo, no cartão de quem está sem modelo, leva à aba Modelos com replace', async () => {
    await render(HOJE);
    const diego = document.body.querySelector('section[aria-label="Diego Lima"]');
    await click([...diego.querySelectorAll('button')].find((b) => b.textContent === 'Escolher modelo'));
    expect(nav.location.pathname).toBe(LIST);
    expect(nav.type).toBe('REPLACE');
  });

  it('o modelo no cartão da pessoa abre o modelo, e o Voltar volta para a Hoje', async () => {
    await render(HOJE);
    const link = document.body.querySelector('section[aria-label="Carla Souza"] a');
    expect(link.getAttribute('href')).toBe('/acad/rotinas/modelos/m1');
    await click(link);
    expect(nav.type).toBe('PUSH');
    expect(nav.location.pathname).toBe('/acad/rotinas/modelos/m1');
    expect(nav.location.state).toEqual({ fromList: true });
    await click(button('Voltar'));
    expect(nav.type).toBe('POP');
    expect(nav.location.pathname).toBe(HOJE);
  });
});

describe('a casca liga a aba ao endereço', () => {
  it('o App passa a sub-tela como aba e troca de aba pelo goToSub', () => {
    const inicio = APP.indexOf('<RotinasView');
    const bloco = APP.slice(inicio, APP.indexOf('/>', inicio));
    expect(bloco).toContain('tab={sub}');
    expect(bloco).toContain("onTab={(subId) => goToSub('rotinas', subId)}");
  });
});
```

- [ ] **Step 2: mudar o teste do cabeçalho**

Em `src/lib/__tests__/rotinasView.test.js`, troque o teste inteiro:

```js
  it('o cabeçalho volta a ter uma linha só: o título à esquerda e o Novo modelo à direita', async () => {
    await render(LIST);
    const novo = button('Novo modelo');
    const linha = novo.parentElement;
    expect(linha.querySelector('h1')).not.toBeNull();
    expect(linha.textContent).toContain('Rotinas');
    expect(linha.lastElementChild).toBe(novo);
  });
```

por:

```js
  it('as abas ficam embaixo do sobretítulo, e a linha do título tem o título à esquerda e o Novo modelo à direita', async () => {
    await render(LIST);
    const novo = button('Novo modelo');
    const linha = novo.parentElement;
    expect(linha.querySelector('h1')).not.toBeNull();
    expect(linha.lastElementChild).toBe(novo);
    const abas = document.body.querySelector('[role="tablist"]');
    expect([...abas.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(['Modelos', 'Hoje 1 sem modelo']);
    expect(abas.parentElement.previousElementSibling.textContent.trim()).toBe('Rotinas');
    expect(abas.compareDocumentPosition(novo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
```

- [ ] **Step 3: rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/rotinasAbas.test.js src/lib/__tests__/rotinasView.test.js`
Expected: FAIL (não há abas na tela, e o App não passa `tab` nem `onTab`).

- [ ] **Step 4: as abas na `RotinasView`**

Troque o conteúdo de `src/views/RotinasView.jsx` por:

```jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ListChecks, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRoutineModels } from '../hooks/useRoutineModels.js';
import { canGoBackInApp, hrefFor } from '../lib/routes.js';
import { firstName, modelOfUser, namesText, routineParticipants } from '../lib/rotinas.js';
import { ModelCard } from '../components/rotinas/ModelCard.jsx';
import { ConsultantsList } from '../components/rotinas/ConsultantsList.jsx';
import { ModelDetail } from '../components/rotinas/ModelDetail.jsx';
import { NewModelSheet } from '../components/rotinas/NewModelSheet.jsx';
import { TodayTab } from '../components/rotinas/TodayTab.jsx';

// Tela Rotinas do gestor (spec 2026-10-06; mockups 2026-10-06-tela-rotinas-gestor.html,
// 2026-10-08-rotinas-intro-e-polimento.html e 2026-10-08-rotinas-aba-hoje.html).
// As abas Modelos e Hoje moram no endereço (/rotinas e /rotinas/hoje): quem
// troca é o App (goToSub), com replace, e a aba não troca a chave da tela, então
// trocar de aba não remonta esta view. O modelo aberto em /rotinas/modelos/<id>
// é outra tela no endereço (screenKey rotinas:<id>): abrir empilha no histórico,
// rola para o topo e remonta esta view. Por isso o que passa da lista para o
// modelo vai no state da navegação:
//   - fromList: o modelo foi aberto pela lista (cartão, "Abrir modelo", o
//     modelo no cartão da pessoa na aba Hoje ou criado no Novo modelo). Só aí
//     o Voltar do modelo volta uma entrada do histórico. Os links (modelLink)
//     mandam o state só no clique que troca de tela nesta aba: o modelo aberto
//     em outra aba chega sem a marca, e o Voltar dele troca o endereço pela
//     lista. O modelo aberto pelo Duplicar não leva a marca, senão o Voltar
//     levaria para o modelo de origem, e não para a lista.
//   - rotinaNova e at: o modelo acabou de ser criado ou duplicado, no instante
//     `at`. A transação só aparece na lista quando o servidor confirma; até lá
//     a tela fica em branco, sem o aviso de modelo excluído. A espera dura até
//     o modelo aparecer pela primeira vez nesta montagem ou até FRESH_MS
//     depois de `at`, o que vier antes. O state sobrevive ao F5 e ao voltar e
//     avançar do navegador: sem o prazo, o modelo novo excluído em outra aba
//     deixaria a tela em branco para sempre.
//   - renomear: abre o modelo com o nome em edição (depois de duplicar). Vale
//     só durante a espera, então o F5 depois do prazo não reabre o nome.
const FRESH_MS = 15_000;

// As abas, no desenho das abas da ficha: o traço azul embaixo da aba aberta.
const TAB_TRIGGER = 'h-10 flex-none rounded-t-lg px-3 text-[13.5px] font-medium text-muted-foreground hover:text-foreground data-[state=active]:font-semibold data-[state=active]:text-foreground after:rounded-full after:bg-brand-600 group-data-[orientation=horizontal]/tabs:after:bottom-[-1px]';

// A espera do modelo recém-criado. O prazo é conferido na montagem e depois
// por um timer, porque nenhuma resposta da assinatura vai chegar para
// redesenhar a tela quando o modelo não existe. A primeira vez que o modelo
// aparece é guardada no estado durante o render (o padrão do React para
// derivar estado), junto com o renomear daquele instante: é ele que o
// ModelDetail recebe ao montar. O estado vale para um modelo só, porque a view
// remonta a cada modelo aberto (screenKey rotinas:<id>).
function useFreshModel(nova, modelPresent) {
  const at = Number.isFinite(nova?.at) ? nova.at : null;
  const [expired, setExpired] = useState(() => at === null || Date.now() - at >= FRESH_MS);
  const [firstSight, setFirstSight] = useState(null);
  const waiting = !expired && firstSight === null;
  if (modelPresent && firstSight === null) setFirstSight({ renomear: waiting && nova?.renomear === true });

  useEffect(() => {
    if (!waiting) return undefined;
    const timer = setTimeout(() => setExpired(true), Math.max(0, at + FRESH_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [waiting, at]);

  return { fresh: waiting, renomear: firstSight?.renomear === true };
}

function Headline({ people, models }) {
  if (people.length === 0) return <>Nenhum consultor na equipe ainda.</>;
  const without = people.filter((p) => !modelOfUser(models, p.id));
  const withModel = people.length - without.length;
  return (
    <>
      <em className="font-bold not-italic text-brand-600 dark:text-brand-300">{withModel} de {people.length}</em> consultores seguem um modelo
      {without.length
        ? <>. <em className="font-bold not-italic text-amber-700 dark:text-amber-300">{namesText(without.map((p) => firstName(p.name)))}</em> ainda {without.length === 1 ? 'está' : 'estão'} sem rotina.</>
        : '. Todos têm rotina.'}
    </>
  );
}

export function RotinasView({ db, appUser, usersList, modelId, tab = 'modelos', onTab, tenantId, listenersActive }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { models, loading, error } = useRoutineModels({ db, enabled: listenersActive, tenantId });
  const people = useMemo(() => routineParticipants(usersList), [usersList]);
  const [creatingKey, setCreatingKey] = useState(null);
  const newModelRef = useRef(null);
  const model = modelId ? models.find((m) => m.id === modelId) : undefined;
  const nova = modelId && location.state?.rotinaNova === modelId ? location.state : null;
  const { fresh, renomear } = useFreshModel(nova, Boolean(model));

  const modelLink = (id) => ({ to: hrefFor(tenantId, 'rotinas', { modelId: id }), state: { fromList: true } });
  const openNew = (id, { renomear: rename = false, fromList = false } = {}) =>
    navigate(hrefFor(tenantId, 'rotinas', { modelId: id }), { state: { rotinaNova: id, at: Date.now(), renomear: rename, fromList } });
  const toList = () => navigate(hrefFor(tenantId, 'rotinas'), { replace: true });
  // Voltar do modelo, como na ficha, mas só quando ele foi aberto pela lista:
  // aí a entrada de trás é a lista. Senão (link direto, F5 sem histórico,
  // modelo aberto pelo Duplicar), troca o endereço pela lista.
  const back = () => (location.state?.fromList && canGoBackInApp(window.history.state) ? navigate(-1) : toList());
  // O foco volta ao Novo modelo quando o painel fecha sem criar. Depois de
  // criar, a tela troca pelo modelo novo e o botão não existe mais.
  const restoreFocus = (event) => {
    event.preventDefault();
    if (newModelRef.current?.isConnected) newModelRef.current.focus();
  };

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-[13.5px] shadow-card">
        Não deu para carregar as rotinas. Recarregue a página.
      </div>
    );
  }

  if (modelId) {
    if (!model) {
      if (loading || fresh) return null;
      return (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-6 shadow-card">
          <p className="text-[14px] font-semibold">Esse modelo não existe mais.</p>
          <button type="button" onClick={toList} className="h-[38px] rounded-[10px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white">Voltar para Modelos</button>
        </div>
      );
    }
    return (
      <ModelDetail
        db={db}
        appUser={appUser}
        model={model}
        models={models}
        people={people}
        startRenaming={renomear}
        onBack={back}
        onDeleted={toList}
        onDuplicated={(id) => openNew(id, { renomear: true })}
      />
    );
  }

  const withoutModel = loading ? 0 : people.filter((p) => !modelOfUser(models, p.id)).length;
  // A aba Modelos é o endereço curto /<academia>/rotinas, o mesmo do menu e do
  // Voltar do modelo, e a Hoje é /<academia>/rotinas/hoje. Quem troca o
  // endereço é o App (goToSub), com replace: trocar de aba não cria parada no
  // voltar do navegador.
  const goTab = (id) => onTab?.(id === 'hoje' ? 'hoje' : null);

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        <ListChecks size={14} /> Rotinas
      </p>
      <Tabs value={tab === 'hoje' ? 'hoje' : 'modelos'} onValueChange={goTab} className="gap-5">
        <TabsList variant="line" className="w-full justify-start gap-1 rounded-none border-b border-border p-0 group-data-[orientation=horizontal]/tabs:h-10">
          <TabsTrigger value="modelos" className={TAB_TRIGGER}>Modelos</TabsTrigger>
          <TabsTrigger value="hoje" className={TAB_TRIGGER}>
            Hoje
            {withoutModel > 0 && (
              <>
                {' '}
                <span className="rounded-full bg-amber-500/15 px-[7px] py-1 text-[10.5px] font-semibold leading-none text-amber-700 dark:text-amber-300">
                  {withoutModel} sem modelo
                </span>
              </>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="modelos" className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h1 className="max-w-[720px] font-display text-[27px] font-medium leading-tight tracking-tight">
              {loading
                ? <span className="text-muted-foreground">Carregando as rotinas…</span>
                : <Headline people={people} models={models} />}
            </h1>
            <button type="button" ref={newModelRef} onClick={() => setCreatingKey(Date.now())} className="inline-flex h-[38px] items-center gap-2 rounded-[10px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white">
              <Plus size={15} /> Novo modelo
            </button>
          </div>

          {models.length > 0 && (
            <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
              {models.map((m) => <ModelCard key={m.id} model={m} people={people} link={modelLink(m.id)} />)}
            </div>
          )}
          {!loading && models.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-6 text-[13px] text-muted-foreground">
              Nenhum modelo ainda. Crie o primeiro no botão Novo modelo e escolha quem segue.
            </div>
          )}

          <ConsultantsList db={db} appUser={appUser} people={people} models={models} loading={loading} modelLink={modelLink} />
        </TabsContent>

        <TabsContent value="hoje">
          <TodayTab
            db={db}
            people={people}
            models={models}
            modelsLoading={loading}
            tenantId={tenantId}
            listenersActive={listenersActive}
            modelLink={modelLink}
            onChooseModel={() => goTab('modelos')}
          />
        </TabsContent>
      </Tabs>

      {creatingKey && (
        <NewModelSheet
          key={creatingKey}
          open
          onOpenChange={(open) => { if (!open) setCreatingKey(null); }}
          onCloseAutoFocus={restoreFocus}
          db={db}
          appUser={appUser}
          models={models}
          people={people}
          onCreated={(id) => openNew(id, { fromList: true })}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: o App passa a aba e a troca**

Em `src/App.jsx`, troque:

```jsx
              {activeTab === 'rotinas' && isGestor(appUser) && (
                <RotinasView
                  db={db}
                  appUser={appUser}
                  usersList={usersList}
                  modelId={modelId}
                  tenantId={sessionTenant}
                  listenersActive={listenersActive}
                />
              )}
```

por:

```jsx
              {activeTab === 'rotinas' && isGestor(appUser) && (
                <RotinasView
                  db={db}
                  appUser={appUser}
                  usersList={usersList}
                  modelId={modelId}
                  tab={sub}
                  onTab={(subId) => goToSub('rotinas', subId)}
                  tenantId={sessionTenant}
                  listenersActive={listenersActive}
                />
              )}
```

- [ ] **Step 6: rodar e ver passar, com as varreduras**

Run: `npx vitest run src/lib/__tests__/rotinasAbas.test.js src/lib/__tests__/rotinasView.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js src/lib/__tests__/professorShell.test.js src/lib/__tests__/acessoSweep.test.js src/lib/__tests__/leadLinkSweep.test.js src/lib/__tests__/overscrollGuard.test.js && npx eslint src/views/RotinasView.jsx src/App.jsx`
Expected: PASS e lint sem erro.

- [ ] **Step 7: commit**

```bash
git add src/views/RotinasView.jsx src/App.jsx src/lib/__tests__/rotinasAbas.test.js src/lib/__tests__/rotinasView.test.js
git commit -m "feat: abas Modelos e Hoje na tela Rotinas, com a aba no endereço

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Página B, a lista

**Files:**
- Modify: `src/components/rotinas/ModelCard.jsx` (todo)
- Modify: `src/components/rotinas/ConsultantsList.jsx` (todo)
- Modify: `src/views/RotinasView.jsx` (a grade dos cartões)
- Modify: `src/lib/rotinas.js` (sai o `spanText`)
- Test: `src/lib/__tests__/rotinasView.test.js`, `src/lib/__tests__/rotinas.test.js`

Antes de escrever, abra `docs/superpowers/specs/mockups/2026-10-08-rotinas-intro-e-polimento.html` na aba **Página B · Linha do dia**, quadro "Lista", nos dois temas.

- [ ] **Step 1: escrever os testes**

No fim de `src/lib/__tests__/rotinasView.test.js`, acrescente:

```js
describe('Página B: a lista', () => {
  const hoje = () => vi.useFakeTimers({ now: new Date(2026, 9, 6, 10, 47), toFake: ['Date'] });
  const M3 = {
    id: 'm3',
    name: 'Tarde',
    followerIds: ['diego'],
    tasks: [{ ...TASK, id: 'a', time: '13:00' }, { ...TASK, id: 'b', time: '17:30' }, { ...TASK, id: 'c', time: null }],
  };

  it('o cartão tem o resumo, a linha do dia com os rótulos e quem segue com o rosto', async () => {
    hoje();
    s.models = [M1, M2, M3];
    await render(LIST);
    const manha = card('Manhã');
    expect(manha.textContent).toContain('1 tarefa · às 08:00');
    expect(manha.textContent).toContain('Carla');
    expect([...manha.querySelectorAll('span[aria-hidden="true"]')].some((el) => el.textContent === 'CS')).toBe(true);
    const tarde = card('Tarde');
    expect(tarde.textContent).toContain('2 tarefas · das 13:00 às 17:30 · 1 a qualquer hora');
    expect(tarde.textContent).toContain('13h');
    expect(tarde.textContent).toContain('17h30');
    expect(card('Cópia de Manhã').textContent).toContain('Ninguém segue ainda');
  });

  it('a grade dos cartões é larga, mas não passa da tela no celular', async () => {
    await render(LIST);
    expect(card('Manhã').parentElement.className).toContain('[grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr))]');
  });

  it('na lista de consultores, o rosto, o dia de hoje e o Abrir modelo com a seta', async () => {
    hoje();
    await render(LIST);
    expect(text()).toContain('1 tarefa hoje · às 08:00');
    expect(link('Abrir modelo').querySelector('svg')).not.toBeNull();
    expect(text()).toContain('Sem rotina na Meta diária');
    const linhaDaCarla = [...document.body.querySelectorAll('p')].find((p) => p.textContent === 'Carla Souza').closest('div').parentElement;
    expect(linhaDaCarla.querySelector('span[aria-hidden="true"]').textContent).toBe('CS');
  });
});
```

Em `src/lib/__tests__/rotinas.test.js`, tire `spanText,` do import (a linha `modelNameProblem, modelOfUser, newTaskId, normalizeTask, removeTask, routineDayKey, routineParticipants, spanText,` fica `modelNameProblem, modelOfUser, newTaskId, normalizeTask, removeTask, routineDayKey, routineParticipants,`) e apague o teste inteiro:

```js
  it('o horário do modelo', () => {
    const model = { tasks: [task({ time: '07:30' }), task({ time: '12:30' }), task({ time: null }), task({ time: '09:00', active: false })] };
    expect(spanText(model)).toBe('07:30 às 12:30 · 1 sem horário');
    expect(spanText({ tasks: [task({ time: '18:00' })] })).toBe('às 18:00');
    expect(spanText({ tasks: [] })).toBe('');
  });

```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/rotinasView.test.js`
Expected: FAIL nos três testes novos (resumo antigo, grade de 300px, sem rosto).

- [ ] **Step 3: o cartão do modelo**

Troque o conteúdo de `src/components/rotinas/ModelCard.jsx` por:

```jsx
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { firstName, namesText } from '../../lib/rotinas.js';
import { dayLineLabels, dayLinePct, modelCardSummary, modelTimes } from '../../lib/rotinasTela.js';
import { AppLink } from '../nav/AppLink.jsx';
import { PersonInitials } from './PersonInitials.jsx';

// Quantos rostos o cartão empilha. Os nomes de todos vêm escritos ao lado.
const FACES_MAX = 4;

// A linha do dia (mockup 2026-10-08-rotinas-intro-e-polimento.html, Página B):
// das 06h às 21h, um ponto por tarefa com horário, o trecho entre a primeira e
// a última em azul claro e os rótulos das pontas e do primeiro e do último
// horário (dayLineLabels). É toda de span e sem nada clicável, porque mora
// dentro do link do cartão, e link não aceita outro elemento interativo
// dentro. O trilho fica em slate-100 (white/[0.07] no escuro), e não no
// bg-muted: no escuro o token é white/[0.04], e o trilho de 2px quase some
// sobre o cartão.
export function DayLine({ model }) {
  const times = modelTimes(model);
  return (
    <span className="relative mt-2 block h-[30px]" aria-hidden="true">
      <span className="absolute inset-x-0 top-[7px] h-0.5 rounded bg-slate-100 dark:bg-white/[0.07]" />
      {times.length > 1 && (
        <span
          className="absolute top-[7px] h-0.5 rounded bg-brand-600/35"
          style={{ left: `${dayLinePct(times[0])}%`, width: `${dayLinePct(times[times.length - 1]) - dayLinePct(times[0])}%` }}
        />
      )}
      {times.map((m, i) => (
        <span
          key={`${m}-${i}`}
          className="absolute top-[3px] -ml-[5px] size-2.5 rounded-full border-2 border-brand-600 bg-card dark:bg-[#0c1126]"
          style={{ left: `${dayLinePct(m)}%` }}
        />
      ))}
      {dayLineLabels(times).map((l) => (
        <span
          key={l.pct}
          className={cn('num absolute top-4 text-[9.5px] text-muted-foreground', l.align === 'center' && '-translate-x-1/2', l.align === 'end' && '-translate-x-full')}
          style={{ left: `${l.pct}%` }}
        >
          {l.text}
        </span>
      ))}
    </span>
  );
}

// O cartão inteiro é o link do modelo (`link` traz o endereço e o state da
// navegação, montados pela RotinasView), então Ctrl+clique, botão do meio e
// "Abrir em nova aba" abrem o modelo em outra aba. O "Abrir" de dentro é só
// texto: um link só por cartão.
export function ModelCard({ model, people, link }) {
  const followers = people.filter((p) => (model.followerIds || []).includes(p.id));
  return (
    <AppLink
      {...link}
      className="flex flex-col gap-1 rounded-2xl border border-border bg-card px-4 pb-3.5 pt-4 text-left shadow-card transition hover:border-brand-500/50 hover:shadow-[0_8px_20px_-12px_rgba(43,89,255,.45)]"
    >
      <span className="flex items-baseline justify-between gap-2.5">
        <span className="min-w-0 truncate font-display text-[16px] font-semibold tracking-tight">{model.name}</span>
        <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-brand-600 dark:text-brand-300">
          Abrir <ArrowRight aria-hidden="true" className="size-[13px]" />
        </span>
      </span>
      <span className="num block text-[12px] text-muted-foreground">{modelCardSummary(model)}</span>
      <DayLine model={model} />
      <span className="mt-1.5 flex items-center gap-2 border-t border-border pt-2.5 text-[12px] text-muted-foreground">
        {followers.length ? (
          <>
            <span className="flex">
              {followers.slice(0, FACES_MAX).map((p, i) => (
                <PersonInitials key={p.id} name={p.name} className={cn('ring-2 ring-card', i > 0 && '-ml-[7px]')} />
              ))}
            </span>
            <span className="min-w-0 truncate">{namesText(followers.map((p) => firstName(p.name)))}</span>
          </>
        ) : (
          <span className="inline-flex h-[22px] items-center rounded-full bg-amber-500/[0.12] px-2 text-[11px] font-medium text-amber-700 dark:text-amber-300">
            Ninguém segue ainda
          </span>
        )}
      </span>
    </AppLink>
  );
}
```

- [ ] **Step 4: a lista de consultores**

Troque o conteúdo de `src/components/rotinas/ConsultantsList.jsx` por:

```jsx
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { firstName, modelOfUser } from '../../lib/rotinas.js';
import { personTodayText } from '../../lib/rotinasTela.js';
import { MODEL_GONE, setPersonModel } from '../../lib/rotinasWrites.js';
import { AppLink } from '../nav/AppLink.jsx';
import { PersonInitials } from './PersonInitials.jsx';

const NONE = 'sem-modelo';

// A lista de consultores da aba Modelos (Página B do mockup
// 2026-10-08-rotinas-intro-e-polimento.html): o rosto, o nome, o dia de hoje
// da pessoa no modelo que ela segue, o seletor do modelo e o "Abrir modelo".
// Enquanto os modelos não chegam (loading), a lista não diz quem está sem
// rotina: sem os modelos, todo mundo pareceria sem modelo. modelLink(id)
// devolve o endereço e o state do "Abrir modelo", que é link de verdade.
export function ConsultantsList({ db, appUser, people, models, loading = false, modelLink }) {
  const toast = useToast();
  const { metaWeekdays = [1, 2, 3, 4, 5] } = useGeneralConfig();
  const [busy, setBusy] = useState(null);
  const now = new Date();

  const change = async (person, value) => {
    const modelId = value === NONE ? null : value;
    setBusy(person.id);
    try {
      await setPersonModel({ db, appUser, models, userId: person.id, modelId });
      const name = firstName(person.name);
      toast.success(modelId ? `${name} agora segue o modelo ${models.find((m) => m.id === modelId)?.name}.` : `${name} ficou sem modelo.`);
    } catch (err) {
      console.error('rotinas: troca de modelo falhou', err);
      toast.error(err?.code === MODEL_GONE ? 'Esse modelo foi excluído.' : 'Não deu para trocar o modelo. Tente de novo.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h2 className="font-display text-[16px] font-semibold">Consultores</h2>
        <p className="text-[12.5px] text-muted-foreground">Cada um segue um modelo. Trocar aqui muda a rotina da pessoa a partir de hoje.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {loading && <p className="p-5 text-[13px] text-muted-foreground">Carregando os modelos de cada consultor…</p>}
        {!loading && people.length === 0 && (
          <p className="p-5 text-[13px] text-muted-foreground">Nenhum consultor na equipe ainda. Cadastre em Configurações, em Equipe & acessos.</p>
        )}
        {!loading && people.map((person) => {
          const model = modelOfUser(models, person.id);
          return (
            <div
              key={person.id}
              className={cn(
                'grid grid-cols-1 items-center gap-3 border-t border-border px-4 py-2.5 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_240px_130px]',
                !model && 'bg-amber-500/[0.06]',
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <PersonInitials name={person.name} size={28} />
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold">{person.name}</p>
                  <p className={cn('num text-[11.5px]', model ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-300')}>
                    {model ? personTodayText(model, now, metaWeekdays) : 'Sem rotina na Meta diária'}
                  </p>
                </div>
              </div>
              <Select value={model?.id ?? NONE} onValueChange={(v) => change(person, v)} disabled={busy === person.id}>
                <SelectTrigger aria-label={`Modelo que ${firstName(person.name)} segue`} className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem modelo</SelectItem>
                  {models.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="sm:text-right">
                {model && (
                  <AppLink {...modelLink(model.id)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-600 dark:text-brand-300">
                    Abrir modelo
                    <ArrowRight aria-hidden="true" className="size-[13px]" />
                  </AppLink>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: a grade dos cartões na `RotinasView`**

Em `src/views/RotinasView.jsx`, troque:

```jsx
            <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
```

por:

```jsx
            <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr))]">
```

- [ ] **Step 6: sai o `spanText`**

Em `src/lib/rotinas.js`, apague a função inteira (ninguém mais a usa):

```js
export function spanText(model) {
  const active = (model?.tasks || []).filter((t) => t.active !== false);
  const timed = active.filter((t) => minutesOf(t.time) != null).sort(byTime);
  const free = active.length - timed.length;
  const parts = [];
  if (timed.length === 1) parts.push(`às ${timed[0].time}`);
  if (timed.length > 1) parts.push(`${timed[0].time} às ${timed[timed.length - 1].time}`);
  if (free) parts.push(`${free} sem horário`);
  return parts.join(' · ');
}

```

Confira que ninguém mais chama: `grep -rn "spanText" src api` não deve achar nada.

- [ ] **Step 7: rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/rotinasView.test.js src/lib/__tests__/rotinas.test.js src/lib/__tests__/rotinasImports.test.js && npx eslint src/components/rotinas src/views/RotinasView.jsx src/lib/rotinas.js`
Expected: PASS e lint sem erro.

- [ ] **Step 8: commit**

```bash
git add src/components/rotinas/ModelCard.jsx src/components/rotinas/ConsultantsList.jsx src/views/RotinasView.jsx src/lib/rotinas.js src/lib/__tests__/rotinasView.test.js src/lib/__tests__/rotinas.test.js
git commit -m "feat: lista de modelos com a linha do dia, rostos e o dia de hoje de cada consultor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Página B, o modelo aberto

**Files:**
- Modify: `src/components/rotinas/ModelDetail.jsx` (todo)
- Create: `src/components/rotinas/RoutinePreview.jsx`
- Test: `src/lib/__tests__/rotinasView.test.js`

Antes de escrever, abra a **Página B · Linha do dia**, quadro "Modelo aberto", nos dois temas, e passe o mouse nas linhas para ver o lápis acender.

- [ ] **Step 1: ajustar os testes que já existem e escrever os novos**

Em `src/lib/__tests__/rotinasView.test.js`:

1. Troque todas as ocorrências de `button('Duplicar modelo')` por `button('Duplicar')` (duas: no `describe('Duplicar modelo', ...)` e no teste "depois de duplicar, vai para a lista...").
2. No `describe('Duplicar modelo', ...)`, troque `expect(button('Excluir modelo').disabled).toBe(true);` por `expect(button('Excluir').disabled).toBe(true);`.
3. No `describe('Renomear', ...)`, troque as duas ocorrências de `await click(button('Renomear'));` por `await click(labelled('Renomear'));`.

E acrescente no fim do arquivo:

```js
describe('Página B: o modelo aberto', () => {
  const hoje = (date = new Date(2026, 9, 6, 10, 47)) => vi.useFakeTimers({ now: date, toFake: ['Date'] });
  const DIA = {
    id: 'm5',
    name: 'Consultor manhã',
    followerIds: ['carla'],
    tasks: [
      { ...TASK, id: 'a', time: '06:00', title: 'Abrir a recepção' },
      { ...TASK, id: 'b', time: '07:30', title: 'Responder os follow-ups' },
      { ...TASK, id: 'c', time: '10:00', title: 'Ligações para leads novos' },
      { ...TASK, id: 'd', time: '10:30', title: 'Conferir as visitas' },
      { ...TASK, id: 'e', time: null, title: 'Pedir indicações', how: 'Pelo menos uma por dia.' },
      { ...TASK, id: 'f', time: '09:00', title: 'Organizar o mural', active: false },
    ],
  };
  const secao = (inicio) => [...document.body.querySelectorAll('section')].find((el) => el.textContent.startsWith(inicio));
  beforeEach(() => { s.models = [M1, DIA]; });

  it('o título tem o lápis de Renomear e as etiquetas, e ao lado ficam Duplicar e Excluir', async () => {
    await render('/acad/rotinas/modelos/m5');
    const titulo = document.body.querySelector('h1');
    expect(titulo.textContent).toBe('Consultor manhã');
    expect(titulo.querySelector('button[aria-label="Renomear"]')).not.toBeNull();
    expect(button('Renomear')).toBeUndefined();
    expect(text()).toContain('4 tarefas no horário, das 06:00 às 10:30');
    expect(text()).toContain('1 a qualquer hora');
    expect(button('Duplicar')).toBeTruthy();
    expect(button('Excluir')).toBeTruthy();
    expect(button('Voltar')).toBeTruthy();
  });

  it('Excluir pede a confirmação, que tem o Excluir modelo', async () => {
    await render('/acad/rotinas/modelos/m5');
    await click(button('Excluir'));
    expect(text()).toContain('Carla fica sem rotina até você escolher outro modelo.');
    expect(button('Excluir modelo')).toBeTruthy();
  });

  it('o dia do modelo desce em ordem, com o vão de 90 minutos ou mais, e as pausadas ficam no fim', async () => {
    await render('/acad/rotinas/modelos/m5');
    const dia = secao('O dia do modelo');
    expect(dia.querySelector('h2').textContent).toBe('O dia do modelo 5');
    const linhas = [...dia.querySelector('ol').children].map((li) => li.textContent);
    expect(linhas.map((l) => l.slice(0, 5))).toEqual(['06:00', '1h30 ', '07:30', '2h30 ', '10:00', '10:30']);
    expect(linhas.filter((l) => l.endsWith('sem tarefa'))).toEqual(['1h30 sem tarefa', '2h30 sem tarefa']);
    expect(dia.textContent).toContain('A qualquer hora do dia');
    expect(dia.textContent).toContain('Pelo menos uma por dia.');
    expect(dia.textContent).toContain('Pausadas');
    expect(dia.textContent).toContain('Pausada');
    expect(linhas.join(' ')).not.toContain('Organizar o mural');
  });

  it('o lápis de editar acende no hover e no foco, e fica à vista no toque', async () => {
    await render('/acad/rotinas/modelos/m5');
    for (const nome of ['Abrir a recepção', 'Pedir indicações', 'Organizar o mural']) {
      const lapis = labelled(`Editar ${nome}`);
      expect(lapis, nome).not.toBeNull();
      expect(lapis.textContent, nome).toBe('');
      expect(lapis.className.split(/\s+/), nome).toEqual(expect.arrayContaining([
        'opacity-0', 'group-hover:opacity-100', 'group-has-[:focus-visible]:opacity-100', 'pointer-coarse:opacity-100',
      ]));
    }
  });

  it('quem segue com o rosto, a prévia de como o consultor vê e o aviso', async () => {
    hoje();
    await render('/acad/rotinas/modelos/m5');
    const quemSegue = secao('Quem segue');
    expect(quemSegue.querySelector('span[aria-hidden="true"]').textContent).toBe('CS');
    expect(labelled('Tirar Carla Souza do modelo')).not.toBeNull();
    const previa = secao('Como o consultor vê');
    expect(previa.textContent).toContain('Rotina de hoje');
    expect(previa.textContent).toContain('5 tarefas');
    expect(previa.textContent).toContain('Abrir a recepção');
    expect(previa.textContent).not.toContain('Organizar o mural');
    // Só leitura: nenhum botão, e nenhum check.
    expect(previa.querySelector('button')).toBeNull();
    expect(text()).toContain('O que você muda aqui vale a partir de hoje. Os dias anteriores continuam como estavam.');
  });

  it('a prévia mostra até seis tarefas, e diz quantas faltam', async () => {
    hoje();
    s.models = [{ ...DIA, tasks: Array.from({ length: 8 }, (_, i) => ({ ...TASK, id: `x${i}`, time: `${String(8 + i).padStart(2, '0')}:00`, title: `Tarefa ${i}` })) }];
    await render('/acad/rotinas/modelos/m5');
    const previa = secao('Como o consultor vê');
    expect(previa.querySelectorAll('li')).toHaveLength(6);
    expect(previa.textContent).toContain('E mais 2 hoje.');
  });

  it('a prévia num dia sem tarefa', async () => {
    hoje(new Date(2026, 9, 10, 10, 0));
    await render('/acad/rotinas/modelos/m5');
    expect(secao('Como o consultor vê').textContent).toContain('Hoje este modelo não tem tarefa.');
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/rotinasView.test.js`
Expected: FAIL (botões com o texto antigo, sem "O dia do modelo", sem prévia).

- [ ] **Step 3: `src/components/rotinas/RoutinePreview.jsx`**

```jsx
import { useId } from 'react';
import { cn } from '@/lib/utils';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { useMinuteClock } from '../../hooks/useMinuteClock.js';
import { taskStateAt, tasksForDay } from '../../lib/rotinas.js';
import { StateMark } from './StateMark.jsx';

// Quantas tarefas a prévia mostra. O resto vira "E mais 2 hoje.".
const PREVIEW_MAX = 6;

const TIME_TONE = {
  now: 'text-brand-600 dark:text-brand-300',
  late: 'text-rose-600 dark:text-rose-300',
};

// "Como o consultor vê · na Meta diária", no modelo aberto (mockup
// 2026-10-08-rotinas-intro-e-polimento.html, Página B): as tarefas de hoje
// deste modelo no desenho do cartão da Meta, com o estado da hora de agora. É
// só leitura e sem os checks de ninguém: mostra o que aparece hoje e em que
// ordem, e não quem fez. Quem fez está na aba Hoje. Por isso o cabeçalho diz
// quantas tarefas são, e não "0 de 5".
export function RoutinePreview({ model }) {
  const titleId = useId();
  const now = useMinuteClock();
  const { metaWeekdays = [1, 2, 3, 4, 5] } = useGeneralConfig();
  const tasks = tasksForDay(model, now, metaWeekdays);

  return (
    <section aria-labelledby={titleId}>
      <p id={titleId} className="mb-2 flex items-baseline justify-between gap-2 px-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        Como o consultor vê <span className="font-medium normal-case tracking-normal">na Meta diária</span>
      </p>
      <div className="rounded-2xl border border-border bg-card p-3.5 shadow-card">
        <p className="flex items-baseline justify-between gap-2">
          <span className="font-display text-[13px] font-semibold">Rotina de hoje</span>
          <span className="num text-[11px] text-muted-foreground">{tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'}</span>
        </p>
        {tasks.length === 0 ? (
          <p className="mt-2 text-[12px] text-muted-foreground">Hoje este modelo não tem tarefa.</p>
        ) : (
          <ul className="mt-2.5 flex flex-col gap-1">
            {tasks.slice(0, PREVIEW_MAX).map((task) => {
              const state = taskStateAt(task, null, now);
              return (
                <li
                  key={task.id}
                  className={cn(
                    'grid grid-cols-[38px_18px_minmax(0,1fr)] items-center gap-2 rounded-lg px-1.5 py-[5px] text-[12px]',
                    state === 'now' && 'bg-brand-600/[0.08] shadow-[inset_2px_0_0_var(--color-brand-600)]',
                  )}
                >
                  <span className={cn('num text-right text-[11px] font-medium', TIME_TONE[state] ?? 'text-muted-foreground')}>{task.time ?? ''}</span>
                  <StateMark state={state} />
                  <span className="min-w-0 truncate">{task.title}</span>
                </li>
              );
            })}
          </ul>
        )}
        {tasks.length > PREVIEW_MAX && (
          <p className="mt-1.5 px-1.5 text-[11px] text-muted-foreground">E mais {tasks.length - PREVIEW_MAX} hoje.</p>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: o modelo aberto**

Troque o conteúdo de `src/components/rotinas/ModelDetail.jsx` por:

```jsx
import { useId, useRef, useState } from 'react';
import { ArrowLeft, Clock, Copy, Pencil, Plus, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '../../contexts/ToastContext.jsx';
import { MODEL_NAME_MAX, daysText, firstName, modelNameProblem, modelOfUser, namesText } from '../../lib/rotinas.js';
import { gapText, modelChips, modelDayRows, modelFreeTasks, modelPausedTasks } from '../../lib/rotinasTela.js';
import { MODEL_GONE, deleteModel, duplicateModel, setPersonModel, updateModel } from '../../lib/rotinasWrites.js';
import { FieldError } from './FormBits.jsx';
import { PersonInitials } from './PersonInitials.jsx';
import { RoutinePreview } from './RoutinePreview.jsx';
import { TaskSheet } from './TaskSheet.jsx';

// Dentro de um modelo (spec 2026-10-06, "Dentro de um modelo"; mockup
// 2026-10-08-rotinas-intro-e-polimento.html, Página B · Linha do dia): o dia
// do modelo numa linha que desce, com os vãos de 90 minutos ou mais
// (modelDayRows), as tarefas sem horário em quadrinhos, as pausadas no fim, e
// ao lado quem segue, a prévia da Meta diária e o aviso.

// O lápis de editar aparece ao passar o mouse na linha ou no foco do teclado
// (o grupo tem um :focus-visible dentro). No toque (pointer-coarse) fica
// sempre à vista, porque ali não existe hover.
const EDIT_REVEAL = 'opacity-0 transition-opacity group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 pointer-coarse:opacity-100';
const SECTION_LABEL = 'text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground';

function EditButton({ task, onEdit, className }) {
  return (
    <button
      type="button"
      aria-label={`Editar ${task.title}`}
      onClick={(e) => onEdit(task, e.currentTarget)}
      className={cn('grid size-[30px] shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground', EDIT_REVEAL, className)}
    >
      <Pencil aria-hidden="true" className="size-4" />
    </button>
  );
}

// Uma tarefa com horário na linha do dia, ou uma pausada no grupo do fim (com
// o pino cinza, o nome apagado e o selo, o mesmo tratamento de antes).
function DayRow({ task, onEdit }) {
  const paused = task.active === false;
  return (
    <li className="group grid grid-cols-[62px_22px_minmax(0,1fr)_auto] items-start gap-3 rounded-[10px] py-[9px] pl-2.5 pr-3.5 hover:bg-muted/60">
      <span className={cn('num pt-px text-right text-[13px] font-semibold leading-[1.6]', paused && 'text-muted-foreground')}>
        {task.time ?? <Repeat aria-label="Sem horário" className="ml-auto mt-1 size-[13px]" />}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'relative z-10 ml-[5px] mt-[5px] size-3 rounded-full border-[2.5px] bg-card dark:bg-[#0c1126]',
          paused ? 'border-slate-300 dark:border-white/20' : 'border-brand-600',
        )}
      />
      <div className="min-w-0">
        <p className={cn('text-[13.5px] font-semibold', paused && 'text-muted-foreground')}>{task.title}</p>
        {task.how && <p className="mt-0.5 text-[12px] text-muted-foreground">{task.how}</p>}
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex h-[22px] items-center rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground">{daysText(task.days)}</span>
          {paused && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold">Pausada</span>}
        </p>
      </div>
      <EditButton task={task} onEdit={onEdit} />
    </li>
  );
}

function GapRow({ minutes }) {
  return (
    <li className="grid grid-cols-[62px_22px_minmax(0,1fr)] gap-3 py-0.5 pl-2.5 pr-3.5 text-[11px] italic text-muted-foreground">
      <span />
      <span />
      <span>{gapText(minutes)}</span>
    </li>
  );
}

function AnyTimeTile({ task, onEdit }) {
  return (
    <li className="group relative rounded-xl border border-border bg-muted/50 py-[11px] pl-3 pr-10">
      <p className="text-[13px] font-semibold">{task.title}</p>
      {task.how && <p className="mt-[3px] text-[11.5px] text-muted-foreground">{task.how}</p>}
      <p className="mt-1.5 text-[11px] text-muted-foreground">{daysText(task.days)}</p>
      <EditButton task={task} onEdit={onEdit} className="absolute right-1.5 top-1.5" />
    </li>
  );
}

export function ModelDetail({ db, appUser, model, models, people, startRenaming = false, onBack, onDeleted, onDuplicated }) {
  const toast = useToast();
  const [renaming, setRenaming] = useState(startRenaming);
  const [nameDraft, setNameDraft] = useState(model.name);
  const [nameError, setNameError] = useState(null);
  const nameErrorId = useId();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sheet, setSheet] = useState(null); // { key, task }
  // Renomear, duplicar e excluir: uma gravação de cada vez. O estado desliga
  // os botões; a ref barra o segundo clique que chega antes do render, que
  // criaria dois modelos com o mesmo nome e empilharia duas entradas.
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  // O foco volta para quem abriu o painel (Nova tarefa ou o lápis da linha).
  // Sem SheetTrigger, o Radix o mandaria para o <body>.
  const openerRef = useRef(null);
  const newTaskRef = useRef(null);
  const followers = people.filter((p) => (model.followerIds || []).includes(p.id));
  const others = people.filter((p) => !(model.followerIds || []).includes(p.id));
  const activeCount = (model.tasks || []).filter((t) => t.active !== false).length;
  const dayRows = modelDayRows(model);
  const timedCount = dayRows.filter((r) => r.kind === 'task').length;
  const free = modelFreeTasks(model);
  const paused = modelPausedTasks(model);
  const chips = modelChips(model);

  const run = async (fn, ok, fail) => {
    try {
      await fn();
      if (ok) toast.success(ok);
      return true;
    } catch (err) {
      console.error('rotinas:', err);
      toast.error(err?.code === MODEL_GONE ? 'Esse modelo foi excluído.' : fail);
      return false;
    }
  };

  const guarded = async (fn) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const startRename = () => {
    setNameDraft(model.name);
    setNameError(null);
    setRenaming(true);
  };
  const cancelRename = () => {
    setRenaming(false);
    setNameDraft(model.name);
    setNameError(null);
  };

  const saveName = () => guarded(async () => {
    const problem = modelNameProblem(nameDraft, models, model.id);
    setNameError(problem);
    if (problem) return;
    const ok = await run(() => updateModel({ db, appUser, modelId: model.id, edit: () => ({ name: nameDraft.trim() }) }), 'Nome salvo.', 'Não deu para salvar o nome. Tente de novo.');
    if (ok) setRenaming(false);
  });

  const duplicate = () => guarded(async () => {
    try {
      const id = await duplicateModel({ db, appUser, models, source: model });
      toast.success('Modelo duplicado. Dê um nome e escolha quem segue.');
      onDuplicated(id);
    } catch (err) {
      console.error('rotinas: duplicar falhou', err);
      toast.error(err?.code === MODEL_GONE ? 'Esse modelo foi excluído.' : 'Não deu para duplicar o modelo. Tente de novo.');
    }
  });

  const remove = () => guarded(async () => {
    const ok = await run(() => deleteModel({ db, appUser, modelId: model.id }), 'Modelo excluído. O histórico continua com ele.', 'Não deu para excluir o modelo. Tente de novo.');
    if (ok) onDeleted();
  });

  const unfollow = (p) => run(
    () => setPersonModel({ db, appUser, models, userId: p.id, modelId: null }),
    `${firstName(p.name)} ficou sem modelo.`,
    'Não deu para tirar a pessoa do modelo. Tente de novo.',
  );

  const follow = (pid) => {
    const p = people.find((x) => x.id === pid);
    if (!p) return;
    run(
      () => setPersonModel({ db, appUser, models, userId: pid, modelId: model.id }),
      `${firstName(p.name)} agora segue o modelo ${model.name}.`,
      'Não deu para pôr a pessoa no modelo. Tente de novo.',
    );
  };

  const openTask = (task, opener) => {
    openerRef.current = opener ?? null;
    setSheet({ key: `${task?.id ?? 'nova'}-${Date.now()}`, task });
  };
  // A tarefa excluída leva junto o lápis que abriu o painel: o foco vai para
  // o Nova tarefa.
  const taskRemoved = () => { openerRef.current = newTaskRef.current; };
  const restoreFocus = (event) => {
    event.preventDefault();
    const target = openerRef.current?.isConnected ? openerRef.current : newTaskRef.current;
    if (target?.isConnected) target.focus();
  };

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      {/* O mesmo Voltar da ficha: volta para a lista de modelos. */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-8 items-center gap-1.5 self-start whitespace-nowrap rounded-lg px-2.5 text-[12.5px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft size={14} /> Voltar
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        {renaming ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                autoFocus
                value={nameDraft}
                maxLength={MODEL_NAME_MAX}
                aria-label="Nome do modelo"
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? nameErrorId : undefined}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName();
                  if (e.key === 'Escape') cancelRename();
                }}
                className="h-11 min-w-[280px] font-display text-[22px] font-semibold"
              />
              <button type="button" disabled={busy} onClick={saveName} className="h-[38px] rounded-[10px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white disabled:opacity-60">Salvar nome</button>
              <button type="button" disabled={busy} onClick={cancelRename} className="h-[38px] rounded-[10px] border border-border bg-card px-3.5 text-[13px] font-medium disabled:opacity-60">Cancelar</button>
            </div>
            <FieldError id={nameErrorId}>{nameError}</FieldError>
          </div>
        ) : (
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 font-display text-[28px] font-semibold leading-tight tracking-tight">
              <span className="min-w-0 break-words">{model.name}</span>
              <button
                type="button"
                aria-label="Renomear"
                disabled={busy}
                onClick={startRename}
                className="grid size-[30px] shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
              >
                <Pencil aria-hidden="true" className="size-4" />
              </button>
            </h1>
            {chips.length > 0 && (
              <p className="mt-1.5 flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <span key={c} className="num inline-flex h-[22px] items-center rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground">{c}</span>
                ))}
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          <button type="button" disabled={busy} onClick={duplicate} className="inline-flex h-[38px] items-center gap-1.5 rounded-[10px] border border-border bg-card px-3.5 text-[13px] font-medium disabled:opacity-60">
            <Copy size={15} /> Duplicar
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)} className="h-[38px] rounded-[10px] px-2.5 text-[13px] font-medium text-rose-600 hover:bg-rose-500/10 disabled:opacity-60 dark:text-rose-300">
            Excluir
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-destructive/10 px-3.5 py-3 text-[13px]">
          <span>
            {followers.length
              ? `${namesText(followers.map((p) => firstName(p.name)))} ${followers.length === 1 ? 'fica' : 'ficam'} sem rotina até você escolher outro modelo.`
              : 'Ninguém segue este modelo.'}{' '}
            O histórico dos dias anteriores continua.
          </span>
          <span className="flex gap-1.5">
            <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)} className="h-[34px] rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-medium disabled:opacity-60">Cancelar</button>
            <button type="button" disabled={busy} onClick={remove} className="h-[34px] rounded-[9px] bg-rose-600 px-3 text-[12.5px] font-medium text-white disabled:opacity-60">Excluir modelo</button>
          </span>
        </div>
      )}

      <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_310px]">
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between gap-2.5 border-b border-border py-3 pl-4 pr-3.5">
            <h2 className="flex items-center gap-2 font-display text-[14px] font-semibold">
              O dia do modelo <span className="num rounded-md bg-muted px-[7px] py-[3px] font-sans text-[11px] text-muted-foreground">{activeCount}</span>
            </h2>
            <button type="button" ref={newTaskRef} onClick={(e) => openTask(null, e.currentTarget)} className="inline-flex h-[38px] items-center gap-2 rounded-[10px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white">
              <Plus size={15} /> Nova tarefa
            </button>
          </div>
          {(model.tasks || []).length === 0 && <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">Este modelo ainda não tem tarefa. Crie a primeira.</p>}
          {dayRows.length > 0 && (
            <div className="relative pb-1 pt-1.5">
              {/* A linha que desce, do primeiro ao último pino. Fica fora da
                  lista: <ol> só aceita <li>. */}
              {timedCount > 1 && <span aria-hidden="true" className="absolute bottom-[26px] left-[94px] top-[22px] w-0.5 rounded bg-gradient-to-b from-brand-600 to-brand-600/25" />}
              <ol>
                {dayRows.map((row) => (row.kind === 'gap'
                  ? <GapRow key={row.key} minutes={row.minutes} />
                  : <DayRow key={row.key} task={row.task} onEdit={openTask} />))}
              </ol>
            </div>
          )}
          {free.length > 0 && (
            <div className="mt-1.5 border-t border-border px-3.5 pb-3.5 pt-3">
              <h3 className={SECTION_LABEL}>A qualquer hora do dia</h3>
              <ul className="mt-2.5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {free.map((t) => <AnyTimeTile key={t.id} task={t} onEdit={openTask} />)}
              </ul>
            </div>
          )}
          {paused.length > 0 && (
            <div className="border-t border-dashed border-border pb-1.5 pt-2.5">
              <h3 className={cn(SECTION_LABEL, 'px-4')}>Pausadas</h3>
              <ol className="mt-1">{paused.map((t) => <DayRow key={t.id} task={t} onEdit={openTask} />)}</ol>
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-3">
          <section className="rounded-2xl border border-border bg-card px-4 py-3.5 shadow-card">
            <h2 className="flex items-center gap-2 font-display text-[14px] font-semibold">
              Quem segue <span className="num rounded-md bg-muted px-[7px] py-[3px] font-sans text-[11px] text-muted-foreground">{followers.length}</span>
            </h2>
            {followers.length === 0 && <p className="mt-2.5 text-[12px] text-muted-foreground">Ninguém segue este modelo ainda.</p>}
            {followers.map((p) => (
              <div key={p.id} className="mt-2.5 flex items-center gap-2.5 text-[13px]">
                <PersonInitials name={p.name} size={26} />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <button type="button" aria-label={`Tirar ${p.name} do modelo`} onClick={() => unfollow(p)} className="text-[12px] text-muted-foreground hover:text-rose-600 dark:hover:text-rose-300">Tirar</button>
              </div>
            ))}
            {others.length > 0 && (
              <Select value="" onValueChange={follow}>
                <SelectTrigger aria-label="Pôr um consultor neste modelo" className="mt-3 h-9 w-full">
                  <SelectValue placeholder="Pôr um consultor neste modelo" />
                </SelectTrigger>
                <SelectContent>
                  {others.map((p) => {
                    const current = modelOfUser(models, p.id);
                    return <SelectItem key={p.id} value={p.id}>{p.name} {current ? `(sai do ${current.name})` : '(sem modelo)'}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            )}
          </section>
          <RoutinePreview model={model} />
          <p className="flex gap-2.5 rounded-xl border border-dashed border-border px-3.5 py-3 text-[12px] text-muted-foreground">
            <Clock aria-hidden="true" className="mt-px size-4 shrink-0" />
            O que você muda aqui vale a partir de hoje. Os dias anteriores continuam como estavam.
          </p>
        </aside>
      </div>

      {sheet && (
        <TaskSheet
          key={sheet.key}
          open
          onOpenChange={(open) => { if (!open) setSheet(null); }}
          onCloseAutoFocus={restoreFocus}
          onTaskRemoved={taskRemoved}
          db={db}
          appUser={appUser}
          model={model}
          followers={followers}
          task={sheet.task}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/rotinasView.test.js src/lib/__tests__/rotinasAbas.test.js && npx eslint src/components/rotinas`
Expected: PASS e lint sem erro.

- [ ] **Step 6: commit**

```bash
git add src/components/rotinas/ModelDetail.jsx src/components/rotinas/RoutinePreview.jsx src/lib/__tests__/rotinasView.test.js
git commit -m "feat: modelo aberto com o dia numa linha, as pausadas no fim e a prévia da Meta diária

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: a apresentação em passos

**Files:**
- Modify: `src/components/NewFeatureBadge.jsx` (todo)
- Create: `src/components/rotinas/IntroIllustrations.jsx`
- Modify: `src/components/rotinas/RotinasIntro.jsx` (todo)
- Test: `src/lib/__tests__/newFeatureBadge.test.js`, `src/lib/__tests__/rotinasIntro.test.js` (todo), `src/lib/__tests__/sidebarNovo.test.js`

Antes de escrever, abra `2026-10-08-rotinas-intro-e-polimento.html` na aba **Pop-up 1 · Carrossel** e passe pelos passos, nos dois temas, e o `2026-10-08-rotinas-aba-hoje.html` na aba **Pop-up · passo da aba Hoje**. O desenho do último passo é o do pedido, sem a linha do dia: uma pessoa por linha com a contagem e a linha vermelha da tarefa atrasada.

- [ ] **Step 1: o teste do conteúdo próprio no `NewFeatureBadge`**

Em `src/lib/__tests__/newFeatureBadge.test.js`, troque o import do React por:

```js
import { act, createElement as h, Fragment } from 'react';
```

acrescente, depois do import do `NewFeatureBadge`:

```js
import { DialogDescription, DialogTitle } from '../../components/ui/dialog.jsx';
```

e acrescente no fim do arquivo:

```js
describe('o pop-up com conteúdo próprio', () => {
  it('renderContent desenha o pop-up inteiro e recebe o close, e contentClassName ajusta a caixa', async () => {
    await act(async () => {
      root.render(h(NewFeatureBadge, {
        until: ATE,
        now: new Date(2026, 9, 8, 9, 0),
        contentClassName: 'p-0 sm:max-w-[520px]',
        renderContent: ({ close }) => h(Fragment, null,
          h(DialogTitle, null, 'Passo um'),
          h(DialogDescription, null, 'O que o passo diz.'),
          h('button', { type: 'button', onClick: close }, 'Pronto')),
      }));
    });
    await clicar(balao());
    expect(dialogo().querySelector('h2').textContent).toBe('Passo um');
    expect(botao('Entendi')).toBeUndefined();
    const caixa = dialogo().className.split(/\s+/);
    expect(caixa).toEqual(expect.arrayContaining(['p-0', 'sm:max-w-[520px]']));
    expect(caixa).not.toContain('p-6');
    expect(caixa).not.toContain('sm:max-w-[480px]');
    await clicar(botao('Pronto'));
    expect(dialogo()).toBeNull();
    expect(balao()).not.toBeNull();
  });
});
```

- [ ] **Step 2: o teste da apresentação**

Troque o conteúdo de `src/lib/__tests__/rotinasIntro.test.js` por:

```js
// @vitest-environment jsdom
// O balão "Novo" das Rotinas (RotinasNovo), no item Rotinas do menu (mockup
// 2026-10-08-balao-novo-rotinas.html, opção C): aparece até 07/11/2026,
// inclusive, e no clique abre a apresentação em seis passos (mockup
// 2026-10-08-rotinas-intro-e-polimento.html, Pop-up 1, com o passo da aba Hoje
// do 2026-10-08-rotinas-aba-hoje.html).
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NOVO_ATE, RotinasNovo } from '../../components/rotinas/RotinasIntro.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

const HOJE = new Date(2026, 9, 8, 9, 0);
const montar = async (props) => {
  await act(async () => { root.render(h(RotinasNovo, props)); });
};
const balao = () => document.body.querySelector('[aria-label="Novo: o que é esta tela"]');
const dialogo = () => document.body.querySelector('[role="dialog"]');
const botao = (rotulo) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
const clicar = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.click(); });
};
const passo = () => {
  const titulo = dialogo().querySelector('h2');
  return { kicker: titulo.previousElementSibling.textContent, titulo: titulo.textContent };
};
const descricao = () => document.getElementById(dialogo().getAttribute('aria-describedby')).textContent;
const ilustracao = () => dialogo().querySelector('[data-ilustracao]');
const abrir = async () => {
  await montar({ now: HOJE, tone: 'alert' });
  await clicar(balao());
};
const ateOUltimo = async () => {
  await clicar(botao('Ver como configurar'));
  for (let i = 0; i < 4; i += 1) await clicar(botao('Próximo'));
};

describe('RotinasNovo', () => {
  it('vale até 07/11/2026', () => {
    expect(NOVO_ATE).toBe('2026-11-07');
  });

  it.each([
    ['um mês antes', new Date(2026, 9, 8, 9, 0)],
    ['no último dia, à noite', new Date(2026, 10, 7, 23, 59)],
  ])('aparece %s', async (_quando, now) => {
    await montar({ now });
    expect(balao()).not.toBeNull();
    expect(balao().textContent.trim()).toBe('Novo');
  });

  it('some no dia seguinte ao último', async () => {
    await montar({ now: new Date(2026, 10, 8, 0, 0) });
    expect(balao()).toBeNull();
    expect(container.innerHTML).toBe('');
  });

  it('repassa o tom ao balão', async () => {
    await montar({ now: HOJE, tone: 'alert' });
    expect(balao().className).toContain('bg-red-600');
  });
});

describe('a apresentação em passos', () => {
  it('abre no primeiro passo: o que é a rotina', async () => {
    await abrir();
    expect(passo()).toEqual({ kicker: 'Novidade', titulo: 'O que é a rotina' });
    expect(descricao()).toContain('São as tarefas que o consultor faz todo dia e que não dependem de um lead, como abrir a recepção, postar o story da aula ou atualizar o Stronilead antes de sair.');
    expect(descricao()).toContain('Você monta a lista uma vez, num modelo.');
    expect(descricao()).toContain('Ela aparece todo dia na Meta diária de quem segue o modelo, num cartão à parte.');
    expect(descricao()).toContain('O consultor marca o que fez. A meta de leads não muda, e a rotina não conta para o dia batido.');
    expect(ilustracao().textContent).toContain('Meta diária · leads');
    expect(ilustracao().textContent).toContain('Rotina · o dia');
    expect(botao('Ver como configurar')).toBeTruthy();
    expect(botao('Voltar').className).toContain('invisible');
    expect(botao('Entendi')).toBeUndefined();
  });

  it('os quatro passos de configurar, com Voltar e Próximo', async () => {
    await abrir();
    await clicar(botao('Ver como configurar'));
    expect(passo()).toEqual({ kicker: 'Como configurar · 1 de 4', titulo: 'Crie um modelo' });
    expect(descricao()).toBe('Aqui em Rotinas, clique em Novo modelo e dê um nome, como "Consultor manhã". Pode começar em branco ou copiar um modelo que já existe.');
    expect(botao('Voltar').className).not.toContain('invisible');
    await clicar(botao('Próximo'));
    expect(passo()).toEqual({ kicker: 'Como configurar · 2 de 4', titulo: 'Coloque as tarefas' });
    expect(descricao()).toBe('Dentro do modelo, clique em Nova tarefa. Escreva o que fazer, explique como fazer se precisar, escolha os dias e, se quiser, o horário.');
    await clicar(botao('Próximo'));
    expect(passo()).toEqual({ kicker: 'Como configurar · 3 de 4', titulo: 'Escolha quem segue' });
    expect(descricao()).toBe('Na lista Consultores, escolha o modelo de cada pessoa. Cada consultor segue um modelo só, e um modelo pode ter várias pessoas. Para alguém com uma rotina diferente, duplique o modelo e ajuste a cópia.');
    await clicar(botao('Próximo'));
    expect(passo()).toEqual({ kicker: 'Como configurar · 4 de 4', titulo: 'Pronto: o consultor dá check' });
    expect(descricao()).toContain('No mesmo dia, a rotina aparece na Meta diária do consultor. A tarefa com horário fica em destaque até 30 minutos depois e, passado isso, aparece como atrasada. Ele marca o que fez e pode deixar uma observação.');
    expect(descricao()).toContain('Bom saber: o que você muda num modelo vale a partir de hoje. Os dias anteriores ficam como estavam.');
  });

  it('o último passo mostra a aba Hoje sem a linha do dia, e o Entendi fecha', async () => {
    await abrir();
    await ateOUltimo();
    expect(passo()).toEqual({ kicker: 'Acompanhar', titulo: 'Acompanhe o dia na aba Hoje' });
    expect(descricao()).toBe('Na aba Hoje, aqui em Rotinas, você vê quanto cada consultor já fez, o que está atrasado agora e as observações que eles deixaram. A tela se atualiza sozinha. Você acompanha, mas o check é sempre de quem fez a tarefa.');
    const desenho = ilustracao().textContent;
    for (const trecho of ['Ana', '5 de 11', '1 atrasada', 'Bruno', '6 de 11', 'em dia', 'Ana · Ligações para leads novos · atrasada há 47 min']) {
      expect(desenho).toContain(trecho);
    }
    // Sem trilho com pontos: nada posicionado na horizontal.
    expect(ilustracao().querySelector('[style*="left"]')).toBeNull();
    expect(botao('Próximo')).toBeUndefined();
    await clicar(botao('Entendi'));
    expect(dialogo()).toBeNull();
    expect(balao()).not.toBeNull();
  });

  it('o botão principal é o mesmo em todos os passos, para o foco não se perder', async () => {
    await abrir();
    const principal = botao('Ver como configurar');
    await clicar(principal);
    expect(botao('Próximo')).toBe(principal);
    for (let i = 0; i < 4; i += 1) await clicar(botao('Próximo'));
    expect(botao('Entendi')).toBe(principal);
  });

  it('o Voltar volta um passo e, no primeiro, leva o foco ao botão principal', async () => {
    await abrir();
    await clicar(botao('Ver como configurar'));
    await clicar(botao('Próximo'));
    await clicar(botao('Voltar'));
    expect(passo().titulo).toBe('Crie um modelo');
    await clicar(botao('Voltar'));
    expect(passo().titulo).toBe('O que é a rotina');
    expect(document.activeElement).toBe(botao('Ver como configurar'));
  });

  it('os pontinhos levam direto a cada passo', async () => {
    await abrir();
    const grupo = dialogo().querySelector('[role="group"][aria-label="Passos"]');
    const pontos = () => [...grupo.querySelectorAll('button')];
    expect(pontos().map((p) => p.getAttribute('aria-label'))).toEqual([
      'O que é a rotina', 'Crie um modelo', 'Coloque as tarefas', 'Escolha quem segue', 'Pronto: o consultor dá check', 'Acompanhe o dia na aba Hoje',
    ]);
    expect(pontos().map((p) => p.getAttribute('aria-current'))).toEqual(['step', null, null, null, null, null]);
    await clicar(pontos()[3]);
    expect(passo().titulo).toBe('Escolha quem segue');
    expect(pontos().map((p) => p.getAttribute('aria-current'))).toEqual([null, null, null, 'step', null, null]);
  });

  it('fechar no meio e reabrir volta ao primeiro passo', async () => {
    await abrir();
    await clicar(botao('Ver como configurar'));
    await clicar(botao('Próximo'));
    await clicar(botao('Fechar'));
    expect(dialogo()).toBeNull();
    await clicar(balao());
    expect(passo().titulo).toBe('O que é a rotina');
  });

  it('o desenho fica fora do leitor de tela', async () => {
    await abrir();
    expect(ilustracao().getAttribute('aria-hidden')).toBe('true');
  });
});
```

- [ ] **Step 3: o item do menu fecha pelo X**

Em `src/lib/__tests__/sidebarNovo.test.js`, no teste `it('o clique no balão abre a explicação e não troca de tela, nem no Entendi', ...)`:

1. troque o nome do teste por `'o clique no balão abre a apresentação e não troca de tela, nem no Fechar'`;
2. troque `expect(dialogo().querySelector('h2').textContent).toBe('Rotinas');` por `expect(dialogo().querySelector('h2').textContent).toBe('O que é a rotina');`;
3. troque `await clicar(botao('Entendi'));` por `await clicar(botao('Fechar'));`.

- [ ] **Step 4: rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/newFeatureBadge.test.js src/lib/__tests__/rotinasIntro.test.js src/lib/__tests__/sidebarNovo.test.js`
Expected: FAIL (sem `renderContent`, e o pop-up ainda é o antigo).

- [ ] **Step 5: o `NewFeatureBadge`**

Troque o conteúdo de `src/components/NewFeatureBadge.jsx` por:

```jsx
import { useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.jsx';
import { Button } from './ui/button.jsx';
import { cn } from '../lib/utils.js';
import { isNewFeatureOn } from '../lib/newFeature.js';

// Balão "Novo" de uma tela nova. Aparece até o dia `until` (AAAA-MM-DD,
// inclusive, no dia do aparelho, pela conta de `isNewFeatureOn`) e, no clique,
// abre um pop-up que explica a tela. Substitui o pop-up de novidade que abria
// sozinho: aqui quem quer saber clica, e o sino continua com o histórico das
// novidades.
//
// O pop-up padrão tem título, descrição, o corpo (children) e o Entendi. Quem
// precisa de outro desenho (a apresentação em passos das Rotinas) passa
// renderContent: ele recebe { close } e desenha o pop-up inteiro, inclusive o
// DialogTitle e o DialogDescription, que o leitor de tela usa como nome e
// descrição do pop-up. contentClassName ajusta a caixa (o padding e a
// largura). O conteúdo sai da tela quando o pop-up fecha, então quem tem
// passos reabre sempre no primeiro.

// soft: laranja suave, para o balão no meio da tela.
// alert: vermelho cheio, para chamar atenção no menu. A borda branca de dentro
// separa o vermelho do azul do item aceso, e some no menu branco; o halo
// vermelho de fora destaca no fundo claro e no escuro.
const TONES = {
  soft: {
    button: cn(
      'h-6 gap-1.5 px-2.5 text-[10.5px] font-semibold',
      'border-accent-500/30 bg-accent-500/10 text-orange-700 hover:bg-accent-500/20 dark:text-accent-400',
    ),
    dot: 'bg-accent-500 ring-[3px] ring-accent-500/20',
  },
  alert: {
    button: cn(
      'h-5 gap-1 px-2 text-[10px] font-bold',
      'border-transparent bg-red-600 text-white hover:bg-red-700',
      'shadow-[0_0_0_1.5px_rgba(255,255,255,.9),0_0_0_4px_rgba(220,38,38,.25)]',
      'dark:shadow-[0_0_0_1.5px_rgba(14,26,64,.9),0_0_0_4px_rgba(248,113,113,.35)]',
    ),
    dot: 'bg-white ring-2 ring-white/35',
  },
};

function NewFeatureBadge({ until, now = new Date(), tone = 'soft', title, description, children, renderContent, contentClassName, className }) {
  const [open, setOpen] = useState(false);
  if (!isNewFeatureOn(until, now)) return null;
  const look = TONES[tone] ?? TONES.soft;
  const close = () => setOpen(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Novo: o que é esta tela"
          className={cn(
            'relative inline-flex shrink-0 items-center rounded-full border uppercase tracking-wider transition-colors',
            look.button,
            // Depois do tamanho da letra do tom: o cn() tira o leading que vem antes dele.
            'leading-none',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            // Área de toque maior que o desenho, para o dedo no celular.
            'after:absolute after:-inset-2',
            className,
          )}
        >
          <span aria-hidden="true" className={cn('size-1.5 rounded-full', look.dot)} />
          Novo
        </button>
      </DialogTrigger>
      {/* border-border: o `border` do DialogContent sozinho pega a cor do texto e fica branco no escuro. */}
      <DialogContent className={cn('max-h-[calc(100dvh-2rem)] overflow-y-auto border-border sm:max-w-[480px]', contentClassName)}>
        {renderContent ? renderContent({ close }) : (
          <>
            <DialogHeader className="text-left">
              <DialogTitle className="font-display text-[20px] tracking-tight">{title}</DialogTitle>
              {description && <DialogDescription className="text-[13.5px] leading-relaxed">{description}</DialogDescription>}
            </DialogHeader>
            {children}
            <DialogFooter>
              <DialogClose asChild>
                <Button>Entendi</Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { NewFeatureBadge };
```

- [ ] **Step 6: os desenhos dos passos**

Crie `src/components/rotinas/IntroIllustrations.jsx`:

```jsx
import { Building2, Check, ChevronDown, Dumbbell, Phone, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { firstName } from '../../lib/rotinas.js';
import { PersonInitials } from './PersonInitials.jsx';
import { StateMark } from './StateMark.jsx';

// Os desenhos da apresentação das Rotinas, um por passo (mockup
// 2026-10-08-rotinas-intro-e-polimento.html, Pop-up 1, e o passo da aba Hoje
// do 2026-10-08-rotinas-aba-hoje.html). São desenhos: os nomes e os números
// são inventados, e o pop-up os esconde do leitor de tela (aria-hidden no
// lugar deles). O do último passo não tem a linha do dia de ninguém, como a
// aba Hoje.

const MINI = 'w-full rounded-[14px] border border-border bg-card p-3.5 text-left shadow-[0_12px_30px_-14px_rgba(14,26,64,.35)]';
const FIELD_LABEL = 'mb-1 mt-2.5 text-[10.5px] font-semibold text-muted-foreground';
const FAKE_INPUT = 'flex h-[30px] items-center rounded-lg border border-border bg-card px-[9px] text-[12px]';
const FOCUS = 'border-brand-600 ring-[3px] ring-brand-600/10';

function MiniHead({ title, children }) {
  return (
    <p className="flex items-baseline justify-between gap-2">
      <span className="font-display text-[13.5px] font-semibold">{title}</span>
      {children}
    </p>
  );
}

// O botão de verdade que o passo manda clicar ("+ Novo modelo").
function Where({ children }) {
  return (
    <span className="inline-flex h-[22px] items-center gap-[5px] whitespace-nowrap rounded-[7px] bg-brand-600 px-2 text-[11px] font-semibold text-white">
      <Plus className="size-3" />
      {children}
    </span>
  );
}

function MiniCheck({ done }) {
  return (
    <span
      className={cn(
        'grid size-3.5 shrink-0 place-items-center rounded-full border-2',
        done ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500' : 'border-slate-300 dark:border-white/20',
      )}
    >
      {done && <Check className="size-2" strokeWidth={3.5} />}
    </span>
  );
}

// Passo 0: a Meta diária (leads) e a Rotina (o dia) lado a lado.
export function IntroWhat() {
  const leads = [[Building2, 'Visita da Marina, 18h'], [Phone, 'Ligar para o Rafael'], [Dumbbell, 'Aula experimental da Bia']];
  const rotina = [[true, 'Abrir a recepção'], [false, 'Postar o story da aula'], [false, 'Atualizar o Stronilead']];
  return (
    <div className="grid w-full max-w-[440px] grid-cols-2 gap-2.5">
      <div className="min-w-0">
        <p className="mb-[5px] ml-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Meta diária · leads</p>
        <ul className={cn(MINI, 'flex flex-col gap-[5px] p-2.5 opacity-75 shadow-none')}>
          {leads.map(([Icon, label]) => (
            <li key={label} className="flex items-center gap-[7px] rounded-[7px] px-[5px] py-1 text-[11.5px]">
              <span className="grid size-[18px] shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                <Icon className="size-[11px]" />
              </span>
              <span className="min-w-0 truncate">{label}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="min-w-0">
        <p className="mb-[5px] ml-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-300">Rotina · o dia</p>
        <ul className={cn(MINI, 'flex flex-col gap-[5px] border-brand-600/45 p-2.5 shadow-[0_12px_30px_-14px_rgba(43,89,255,.55)]')}>
          {rotina.map(([done, label]) => (
            <li key={label} className="flex items-center gap-[7px] rounded-[7px] px-[5px] py-1 text-[11.5px]">
              <MiniCheck done={done} />
              <span className={cn('min-w-0 truncate', done && 'text-muted-foreground line-through decoration-muted-foreground/60')}>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Passo 1: o painel Novo modelo.
export function IntroCreateModel() {
  return (
    <div className={cn(MINI, 'max-w-[300px]')}>
      <MiniHead title="Novo modelo"><Where>Novo modelo</Where></MiniHead>
      <p className={FIELD_LABEL}>Nome do modelo</p>
      <p className={cn(FAKE_INPUT, FOCUS)}>Consultor manhã</p>
      <p className={FIELD_LABEL}>Começar</p>
      <p className="grid grid-cols-2 gap-[3px] rounded-[9px] bg-muted p-[3px] text-center text-[11px]">
        <span className="rounded-[7px] bg-card py-[5px] font-semibold shadow-card">Em branco</span>
        <span className="py-[5px] text-muted-foreground">Cópia de um modelo</span>
      </p>
      <p className="mt-3 grid h-[30px] place-items-center rounded-lg bg-brand-600 text-[12px] font-semibold text-white">Criar modelo</p>
    </div>
  );
}

// Passo 2: o painel Nova tarefa.
export function IntroAddTasks() {
  const days = [['Seg', true], ['Ter', true], ['Qua', true], ['Qui', true], ['Sex', true], ['Sáb', false]];
  return (
    <div className={cn(MINI, 'max-w-[300px]')}>
      <MiniHead title="Nova tarefa"><Where>Nova tarefa</Where></MiniHead>
      <p className={FIELD_LABEL}>O que fazer</p>
      <p className={cn(FAKE_INPUT, FOCUS)}>Postar o story da aula</p>
      <p className={FIELD_LABEL}>Dias</p>
      <p className="flex gap-1">
        {days.map(([day, on]) => (
          <span key={day} className={cn('grid h-6 w-[30px] place-items-center rounded-[7px] text-[10.5px] font-semibold', on ? 'bg-brand-600 text-white' : 'bg-muted text-muted-foreground')}>
            {day}
          </span>
        ))}
      </p>
      <p className={FIELD_LABEL}>Horário (se quiser)</p>
      <p className={cn(FAKE_INPUT, 'w-[90px]')}>09:00</p>
    </div>
  );
}

// Passo 3: a lista Consultores, com quem está sem modelo em destaque.
export function IntroFollowers() {
  const rows = [['Ana Souza', 'Consultor manhã', false], ['Bruno Lima', 'Consultor manhã', false], ['Carla Dias', 'Escolher modelo', true]];
  return (
    <div className={cn(MINI, 'max-w-[320px]')}>
      <MiniHead title="Consultores"><span className="text-[11px] font-medium text-muted-foreground">um modelo para cada</span></MiniHead>
      <ul className="mt-2">
        {rows.map(([name, pick, off]) => (
          <li key={name} className={cn('flex items-center gap-2 rounded-[9px] border-t border-border px-2 py-[7px] text-[12px] first:border-t-0', off && 'bg-amber-500/[0.06]')}>
            <PersonInitials name={name} size={26} />
            <span className="min-w-0 truncate">{name}</span>
            <span
              className={cn(
                'ml-auto inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-[7px] border border-border bg-card px-2 text-[11px]',
                off && 'border-brand-600 font-semibold text-brand-600 ring-[3px] ring-brand-600/10 dark:text-brand-300',
              )}
            >
              {pick}
              <ChevronDown className="size-3.5" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Passo 4: o cartão "Rotina de hoje" da Meta diária, com uma observação.
export function IntroCheck() {
  const rows = [['06:00', 'Abrir a recepção', 'done'], ['06:30', 'Conferir a agenda', 'done'], ['07:00', 'Lista de contatos', 'now'], ['07:30', 'Follow-ups', 'later']];
  return (
    <div className={cn(MINI, 'max-w-[280px]')}>
      <p className="flex items-baseline justify-between">
        <span className="font-display text-[13px] font-semibold">Rotina de hoje</span>
        <span className="text-[11px] text-muted-foreground">2 de 8</span>
      </p>
      <ul className="mt-2.5 flex flex-col gap-1">
        {rows.map(([time, label, state]) => (
          <li
            key={time}
            className={cn('grid grid-cols-[38px_18px_minmax(0,1fr)] items-center gap-2 rounded-lg px-1.5 py-[5px] text-[12px]', state === 'now' && 'bg-brand-600/[0.08] shadow-[inset_2px_0_0_var(--color-brand-600)]')}
          >
            <span className="num text-[11px] font-medium text-muted-foreground">{time}</span>
            <StateMark state={state} className="size-4" />
            <span className={cn('min-w-0 truncate', state === 'done' && 'text-muted-foreground line-through decoration-muted-foreground/60')}>
              {label}
              {state === 'now' && <span className="ml-1.5 text-[9.5px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-300">agora</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="ml-16 mt-0.5 text-[11px] italic text-muted-foreground">“3 experimentais hoje”</p>
    </div>
  );
}

// Passo 5: a aba Hoje em miniatura, uma pessoa por linha com a contagem, e a
// tarefa atrasada em vermelho. Sem linha do dia.
export function IntroToday() {
  const rows = [['Ana Souza', '5 de 11', '1 atrasada', true], ['Bruno Lima', '6 de 11', 'em dia', false], ['Carla Dias', '0 de 6', 'em dia', false]];
  return (
    <div className={cn(MINI, 'max-w-[330px] py-3')}>
      <p className="flex items-baseline justify-between">
        <span className="font-display text-[13px] font-semibold">Hoje</span>
        <span className="text-[11px] text-muted-foreground">Ao vivo · 10:47</span>
      </p>
      <ul className="mt-1.5">
        {rows.map(([name, count, status, late]) => (
          <li key={name} className="flex items-center gap-2 border-t border-border py-1.5 text-[12px] first:border-t-0">
            <PersonInitials name={name} size={24} />
            <span className="font-semibold">{firstName(name)}</span>
            <span className="num ml-auto font-display font-semibold">{count}</span>
            <span className={cn('w-[68px] text-right text-[10.5px]', late ? 'font-semibold text-rose-600 dark:text-rose-300' : 'text-muted-foreground')}>{status}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 rounded-[9px] bg-rose-50 px-[9px] py-[7px] text-[11.5px] font-semibold text-rose-600 dark:bg-[#2a1326] dark:text-rose-300">
        Ana · Ligações para leads novos · atrasada há 47 min
      </p>
    </div>
  );
}
```

- [ ] **Step 7: a apresentação**

Troque o conteúdo de `src/components/rotinas/RotinasIntro.jsx` por:

```jsx
import { useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button.jsx';
import { DialogDescription, DialogTitle } from '../ui/dialog.jsx';
import { NewFeatureBadge } from '../NewFeatureBadge.jsx';
import { IntroAddTasks, IntroCheck, IntroCreateModel, IntroFollowers, IntroToday, IntroWhat } from './IntroIllustrations.jsx';

// O balão "Novo" da tela Rotinas, no item Rotinas do menu lateral (mockup
// 2026-10-08-balao-novo-rotinas.html, opção C, em vermelho). O clique no
// balão abre a apresentação em seis passos (mockup
// 2026-10-08-rotinas-intro-e-polimento.html, Pop-up 1, escolhido pelo Johnny
// em 08/10/2026, com o passo da aba Hoje do 2026-10-08-rotinas-aba-hoje.html);
// o clique no resto do item abre a tela.

// Último dia do balão "Novo" (e do ponto vermelho do menu recolhido): aparece
// por 30 dias depois do lançamento.
export const NOVO_ATE = '2026-11-07';

function B({ children }) {
  return <b className="font-semibold text-foreground">{children}</b>;
}

// Os passos, com os textos aprovados no mockup.
const PASSOS = [
  {
    kicker: 'Novidade',
    title: 'O que é a rotina',
    Illustration: IntroWhat,
    text: <>São as tarefas que o consultor faz todo dia e que <B>não dependem de um lead</B>, como abrir a recepção, postar o story da aula ou atualizar o Stronilead antes de sair.</>,
    points: [
      'Você monta a lista uma vez, num modelo.',
      'Ela aparece todo dia na Meta diária de quem segue o modelo, num cartão à parte.',
      'O consultor marca o que fez. A meta de leads não muda, e a rotina não conta para o dia batido.',
    ],
  },
  {
    kicker: 'Como configurar · 1 de 4',
    title: 'Crie um modelo',
    Illustration: IntroCreateModel,
    text: <>Aqui em Rotinas, clique em <B>Novo modelo</B> e dê um nome, como "Consultor manhã". Pode começar em branco ou copiar um modelo que já existe.</>,
  },
  {
    kicker: 'Como configurar · 2 de 4',
    title: 'Coloque as tarefas',
    Illustration: IntroAddTasks,
    text: <>Dentro do modelo, clique em <B>Nova tarefa</B>. Escreva o que fazer, explique como fazer se precisar, escolha os dias e, se quiser, o horário.</>,
  },
  {
    kicker: 'Como configurar · 3 de 4',
    title: 'Escolha quem segue',
    Illustration: IntroFollowers,
    text: <>Na lista <B>Consultores</B>, escolha o modelo de cada pessoa. Cada consultor segue um modelo só, e um modelo pode ter várias pessoas. Para alguém com uma rotina diferente, duplique o modelo e ajuste a cópia.</>,
  },
  {
    kicker: 'Como configurar · 4 de 4',
    title: 'Pronto: o consultor dá check',
    Illustration: IntroCheck,
    text: <>No mesmo dia, a rotina aparece na <B>Meta diária</B> do consultor. A tarefa com horário fica em destaque até 30 minutos depois e, passado isso, aparece como atrasada. Ele marca o que fez e pode deixar uma observação.</>,
    good: <><B>Bom saber:</B> o que você muda num modelo vale a partir de hoje. Os dias anteriores ficam como estavam.</>,
  },
  {
    kicker: 'Acompanhar',
    title: 'Acompanhe o dia na aba Hoje',
    Illustration: IntroToday,
    text: <>Na aba <B>Hoje</B>, aqui em Rotinas, você vê quanto cada consultor já fez, o que está <B>atrasado agora</B> e as observações que eles deixaram. A tela se atualiza sozinha. Você acompanha, mas o check é sempre de quem fez a tarefa.</>,
  },
];

// O pop-up em passos. Abre sempre no primeiro: o conteúdo do pop-up sai da
// tela quando ele fecha. O botão principal é o mesmo elemento em todos os
// passos ("Ver como configurar", "Próximo" e, no último, "Entendi", que
// fecha), para o foco não se perder na troca. O Voltar fica invisível no
// primeiro passo, e quem volta para ele leva o foco ao botão principal. O
// texto do passo é a descrição do pop-up e mora numa região aria-live, para o
// leitor de tela ler o passo novo.
function RotinasIntroCarousel({ close }) {
  const [step, setStep] = useState(0);
  const primaryRef = useRef(null);
  const passo = PASSOS[step];
  const last = step === PASSOS.length - 1;
  const Illustration = passo.Illustration;

  const back = () => {
    if (step === 1) primaryRef.current?.focus();
    setStep((s) => Math.max(0, s - 1));
  };

  return (
    <>
      <div
        data-ilustracao=""
        aria-hidden="true"
        className="grid h-[200px] place-items-center overflow-hidden border-b border-border bg-gradient-to-b from-brand-600/[0.08] to-transparent px-4 sm:h-[250px]"
      >
        <div key={step} className="flex w-full justify-center animate-fade-in motion-reduce:animate-none">
          <Illustration />
        </div>
      </div>
      <div className="min-h-[168px] px-6 py-5">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300">{passo.kicker}</p>
        <DialogTitle className="mt-1.5 font-display text-[21px] font-semibold leading-tight tracking-tight">{passo.title}</DialogTitle>
        <DialogDescription asChild className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
          <div aria-live="polite">
            <p>{passo.text}</p>
            {passo.points && (
              <ul className="mt-2.5 flex flex-col gap-1.5">
                {passo.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-foreground">
                    <Check aria-hidden="true" className="mt-1 size-3.5 shrink-0 text-brand-600 dark:text-brand-300" />
                    {p}
                  </li>
                ))}
              </ul>
            )}
            {passo.good && <p className="mt-2.5 rounded-[10px] bg-muted px-3 py-2.5 text-[12px]">{passo.good}</p>}
          </div>
        </DialogDescription>
      </div>
      <div className="flex items-center justify-between gap-3 px-6 pb-5">
        <div role="group" aria-label="Passos" className="flex items-center gap-1.5">
          {PASSOS.map((p, i) => (
            <button
              key={p.title}
              type="button"
              aria-label={p.title}
              aria-current={i === step ? 'step' : undefined}
              onClick={() => setStep(i)}
              className={cn(
                'relative h-2 rounded-full transition-[width,background-color] duration-200 after:absolute after:-inset-2 motion-reduce:transition-none',
                i === step ? 'w-[22px] bg-brand-600' : 'w-2 bg-slate-200 dark:bg-white/15',
              )}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={back} className={cn('border-border', step === 0 && 'invisible')}>
            Voltar
          </Button>
          <Button ref={primaryRef} type="button" onClick={last ? close : () => setStep((s) => s + 1)}>
            {step === 0 ? 'Ver como configurar' : last ? 'Entendi' : 'Próximo'}
          </Button>
        </div>
      </div>
    </>
  );
}

// `tone`, `now` e `className` vão direto para o NewFeatureBadge.
export function RotinasNovo(props) {
  return (
    <NewFeatureBadge
      {...props}
      until={NOVO_ATE}
      contentClassName="gap-0 rounded-[18px] p-0 sm:max-w-[520px]"
      renderContent={({ close }) => <RotinasIntroCarousel close={close} />}
    />
  );
}
```

- [ ] **Step 8: rodar e ver passar, com o menu e a casca**

Run: `npx vitest run src/lib/__tests__/newFeatureBadge.test.js src/lib/__tests__/rotinasIntro.test.js src/lib/__tests__/sidebarNovo.test.js src/lib/__tests__/professorShell.test.js src/lib/__tests__/rotinasView.test.js && npx eslint src/components/NewFeatureBadge.jsx src/components/rotinas`
Expected: PASS e lint sem erro. Um aviso do `react-refresh` sobre o `RotinasIntro.jsx` exportar `NOVO_ATE` não aparece, porque constante de texto é permitida (`allowConstantExport`).

- [ ] **Step 9: commit**

```bash
git add src/components/NewFeatureBadge.jsx src/components/rotinas/IntroIllustrations.jsx src/components/rotinas/RotinasIntro.jsx src/lib/__tests__/newFeatureBadge.test.js src/lib/__tests__/rotinasIntro.test.js src/lib/__tests__/sidebarNovo.test.js
git commit -m "feat: balão Novo das rotinas abre a apresentação em seis passos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: novidade no sino, CLAUDE.md e as conferências

**Files:**
- Modify: `src/lib/announcements.js` (a entrada `rotinas-dos-consultores-2026-10`)
- Test: `src/lib/__tests__/announcements.test.js`
- Modify: `CLAUDE.md` (seção "Rotinas dos consultores")

- [ ] **Step 1: o teste da novidade**

No fim de `src/lib/__tests__/announcements.test.js`, acrescente:

```js
describe('a novidade das rotinas', () => {
  it('fala da aba Hoje numa frase', () => {
    const rotinas = ANNOUNCEMENTS.find((a) => a.id === 'rotinas-dos-consultores-2026-10');
    expect(rotinas.summary).toContain('Na aba Hoje, você acompanha o que cada um já fez, o que está atrasado e as observações do dia.');
  });
});
```

Run: `npx vitest run src/lib/__tests__/announcements.test.js`
Expected: FAIL.

- [ ] **Step 2: a frase nova no sino**

Em `src/lib/announcements.js`, na entrada `rotinas-dos-consultores-2026-10`, troque o `summary` por:

```js
    summary:
      'Em Rotinas, no menu, você cria modelos com as tarefas do dia que não envolvem lead, como conferir a recepção ou postar o story da aula, e escolhe quem segue cada modelo. O consultor dá check na Meta diária, num cartão próprio, e a rotina não conta para o dia batido. Na aba Hoje, você acompanha o que cada um já fez, o que está atrasado e as observações do dia.',
```

Run: `npx vitest run src/lib/__tests__/announcements.test.js`
Expected: PASS.

- [ ] **Step 3: o CLAUDE.md**

Na seção `## Rotinas dos consultores` do `CLAUDE.md`, troque o parágrafo de abertura:

```
O gestor monta modelos de rotina (tarefas recorrentes sem lead) e escolhe quem segue cada um, e o consultor dá check na Meta diária. Spec em `docs/superpowers/specs/2026-10-06-rotinas-dos-consultores-design.md`, mockups em `docs/superpowers/specs/mockups/2026-10-06-*`, plano da parte 1 em `docs/superpowers/plans/2026-10-06-rotinas-parte-1.md`. As partes 2 (aba Hoje) e 3 (histórico no Operacional) vêm depois.
```

por:

```
O gestor monta modelos de rotina (tarefas recorrentes sem lead) e escolhe quem segue cada um, o consultor dá check na Meta diária, e o gestor acompanha o dia da equipe na aba Hoje. Spec em `docs/superpowers/specs/2026-10-06-rotinas-dos-consultores-design.md`, mockups em `docs/superpowers/specs/mockups/2026-10-06-*` e `2026-10-08-*`, plano da parte 1 em `docs/superpowers/plans/2026-10-06-rotinas-parte-1.md` e da parte 2 (apresentação em passos, Página B e aba Hoje) em `docs/superpowers/plans/2026-10-08-rotinas-intro-pagina-b-e-hoje.md`. A parte 3 (histórico no Operacional) vem depois.
```

E, logo antes do item que começa com `- **Quem vira professor, volta de professor a consultor ou é excluído sai do modelo**`, acrescente estes itens:

```
- **As abas Modelos e Hoje** são o `Tabs` do shadcn, como as abas da ficha, e a aba mora no endereço: `ROTINAS_TABS` (`src/lib/routes.js`) tem `modelos` e `hoje`, o App passa `tab={sub}` e `onTab={(subId) => goToSub('rotinas', subId)}`, e trocar de aba é replace. A aba Modelos é `/<academia>/rotinas`: a `RotinasView` manda `null` como sub para ela, porque o `hrefFor` com `sub: 'modelos'` monta `/rotinas/modelos`, que também abre a lista. A aba não entra na `screenKey`, então trocar de aba não remonta a tela nem relê os modelos. O Radix ativa a aba no `mousedown`, e não no `click`: teste em jsdom dispara `mousedown`.
- **A aba Hoje** (`src/components/rotinas/TodayTab.jsx`, com `PersonDayCard.jsx` e `TodayAside.jsx`) lê os checks de hoje da academia pelo `useTeamRoutineMarks` (`date` igual ao dia, campo único, sem índice), só com a aba aberta (o `TabsContent` inativo sai da tela) e preso ao `listenersActive`. A resposta fica guardada com a academia e o dia, como no `useMyRoutine`. As contas moram em `src/lib/rotinasTela.js`, puro, que só importa `./rotinas.js` (o `rotinasImports.test.js` trava): o dia de cada pessoa (`personDay`), a equipe (`teamToday`), o título (`todayHeadline`) e o detalhe (`findSelection`). O check conta pelo `markDoneAt`, como no cartão da Meta. O relógio anda a cada minuto (`src/hooks/useMinuteClock.js`). O cartão de cada consultor não tem a linha do dia (decisão do Johnny, 08/10/2026). O gestor nunca marca nem desmarca: a aba não importa `rotinasWrites.js` e não tem botão de check.
- **Os tons do estado da tarefa** moram em `src/components/rotinas/routineTones.js`, divididos pelo cartão da Meta diária, pela aba Hoje, pela prévia do modelo e pela apresentação. O círculo só de leitura é o `StateMark.jsx`, e o rosto de iniciais das rotinas é o `PersonInitials.jsx`, todo de span, porque mora também dentro do link do cartão do modelo (o `Avatar` do app é uma div).
- **O modelo aberto** desenha "O dia do modelo" pelo `modelDayRows` (vão de 90 minutos ou mais, `MODEL_GAP_MINUTES`), as tarefas sem horário em quadrinhos e as pausadas no grupo "Pausadas", no fim. O lápis de editar acende no hover ou no foco do teclado e fica à vista no toque (`pointer-coarse`). A prévia "Como o consultor vê" (`RoutinePreview.jsx`) é só leitura: as tarefas de hoje do modelo com o estado da hora de agora, sem os checks de ninguém.
- **O balão "Novo"** do item Rotinas abre a apresentação em seis passos (`RotinasIntro.jsx`, com os desenhos em `IntroIllustrations.jsx`). O `NewFeatureBadge` aceita `renderContent({ close })`, que desenha o pop-up inteiro com o próprio `DialogTitle` e `DialogDescription`, e `contentClassName`. O botão principal é o mesmo elemento em todos os passos, para o foco não se perder.
```

- [ ] **Step 4: as conferências do que mexeu**

Run: `npx vitest run src/lib/__tests__/announcements.test.js src/lib/__tests__/acessoSweep.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js src/lib/__tests__/leadLinkSweep.test.js src/lib/__tests__/overscrollGuard.test.js src/lib/__tests__/protecaoDeErro.sweep.test.js src/lib/__tests__/professorShell.test.js src/lib/__tests__/rotinasImports.test.js`
Expected: PASS.

Confira também, à mão, que nenhum texto de tela novo tem travessão no meio da frase: `grep -rn "—" src/components/rotinas src/views/RotinasView.jsx src/components/NewFeatureBadge.jsx` não deve achar nada.

- [ ] **Step 5: commit**

```bash
git add src/lib/announcements.js src/lib/__tests__/announcements.test.js CLAUDE.md
git commit -m "docs: novidade das rotinas fala da aba Hoje e CLAUDE.md com a parte 2

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: verificação final, push e teste no preview

**Files:** nenhum arquivo novo.

- [ ] **Step 1: lint, testes e build**

Run: `npm run lint && npx vitest run && npm run build`
Expected: lint sem erro (o aviso antigo do `SuperAdminView.jsx` continua); 214 arquivos de teste passando, uns 4786 testes (os 209 arquivos da linha de base mais `rotinasTela`, `useTeamRoutineMarks`, `rotinasPecas`, `todayTab` e `rotinasAbas`); build sem erro. Se algum teste fora das rotinas quebrar, pare e investigue antes de seguir (superpowers:systematic-debugging).

- [ ] **Step 2: conferir o que não pode ter mudado**

Run: `git log --oneline --no-merges 6437dfd..HEAD -- firestore.rules api/ && ls api/*.js | grep -v '/_' | wc -l`
Expected: o `git log` não lista nenhum commit desta parte (se a main entrou num merge em "Antes de começar", os commits dela podem aparecer, e só eles), e a contagem dá 11, as funções da Vercel de sempre (os arquivos que começam com `_` são ajudantes, não funções). Esta parte não precisa de regra nova: a leitura dos checks já é liberada para a academia.

- [ ] **Step 3: push**

```bash
git push origin claude/rotinas-consultores-fc6a14
```

A PR #250 já existe e recebe os commits. Acrescente à descrição dela a parte 2:

```bash
gh pr view 250 --json body -q .body > "$TMPDIR/pr250.md"
cat >> "$TMPDIR/pr250.md" <<'EOF'

## Parte 2: apresentação, Página B e aba Hoje

- O balão "Novo" do menu abre a apresentação em seis passos (o que é a rotina, os quatro passos de configurar e a aba Hoje).
- A lista de modelos e o modelo aberto ganham a linha do dia (Página B), com os rostos de quem segue e a prévia de como o consultor vê.
- Aba Hoje em `/<academia>/rotinas/hoje`: um cartão por consultor, sem linha do dia, com as tarefas, a linha do agora, as atrasadas e as observações. O gestor só acompanha.
- Nenhuma regra do Firestore nova e nenhuma função nova na Vercel.

Plano: `docs/superpowers/plans/2026-10-08-rotinas-intro-pagina-b-e-hoje.md`.
EOF
gh pr edit 250 --body-file "$TMPDIR/pr250.md"
```

Antes do `gh pr edit`, leia o arquivo e confira que a descrição de antes continua inteira e que a linha `🤖 Generated with [Claude Code](https://claude.com/claude-code)` continua no fim da descrição original (se ela estava no fim, mova-a para depois da seção nova).

- [ ] **Step 4: teste no preview da Vercel, com o Johnny**

As regras da parte 1 precisam estar publicadas (com o ok do Johnny) antes do teste, senão a leitura dos checks é recusada. Use uma academia de teste ou a STRONIX, com um gestor e um consultor em navegadores diferentes. Confira:

1. **Apresentação:** o balão "Novo" do item Rotinas abre o passo "O que é a rotina"; "Ver como configurar", Próximo e Voltar andam pelos passos; os pontinhos pulam; o último passo é "Acompanhe o dia na aba Hoje", sem linha do dia no desenho, e o Entendi fecha; o X fecha em qualquer passo e reabrir volta ao primeiro; o foco não se perde ao trocar de passo (Tab e Enter); tema escuro; no celular (375px), o pop-up rola por dentro e nada passa da tela.
2. **Lista (Página B):** cartões largos, dois por linha quando cabem, com o resumo, a linha do dia das 06h às 21h com os rótulos e os rostos de quem segue; "Ninguém segue ainda" no modelo sem ninguém; Ctrl+clique no cartão abre o modelo em outra aba; a lista de consultores com rosto, o dia de hoje ("11 tarefas hoje · das 06:00 às 13:00") e "Abrir modelo →"; no celular, um cartão por linha, sem rolagem lateral.
3. **Modelo aberto (Página B):** Voltar; o lápis renomeia; as etiquetas; Duplicar abre a cópia com o nome em edição; Excluir pede a confirmação; "O dia do modelo" com a linha, os pinos e o "2h30 sem tarefa"; o lápis de cada tarefa acende no hover e no Tab e, no celular, fica sempre à vista; "A qualquer hora do dia" em quadrinhos; "Pausadas" no fim; Quem segue com Tirar e o seletor; a prévia "Como o consultor vê" com as tarefas de hoje e o estado de agora; o aviso tracejado.
4. **Aba Hoje:** a aba troca o endereço para `/rotinas/hoje`; o F5 mantém a aba; o voltar do navegador não para na troca de aba; o selo "N sem modelo"; o título com a conta e "Ao vivo · HH:MM", que anda a cada minuto; com o consultor dando check e escrevendo uma observação na Meta diária, o cartão dele e a lateral mudam na hora, sem F5; uma tarefa atrasada aparece em "Atrasadas agora"; tocar numa tarefa mostra o Detalhe, e Fechar fecha; "Escolher modelo" leva à aba Modelos; o modelo no cartão da pessoa abre o modelo, e o Voltar volta para a Hoje; antes do horário da primeira tarefa, "A rotina começa às…"; nenhum botão marca check.
5. **Acesso:** o consultor que abre `/<academia>/rotinas/hoje` cai no Operacional com "Essa tela é só do gestor.".
6. **Console:** sem erro de índice do Firestore nem de permissão ao abrir a aba Hoje.

Anote o que o Johnny pedir e só faça o merge com o ok dele.
