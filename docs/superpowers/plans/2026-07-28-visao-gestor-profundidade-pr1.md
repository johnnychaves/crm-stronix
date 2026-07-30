# Visão do gestor com profundidade operacional — PR 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Todo número que o gestor vê passa a abrir a lista de leads por trás dele, e a Meta da equipe ganha a tela do handoff `design_handoff_meta_equipe`.

**Architecture:** Nenhuma leitura nova no Firestore. Todos os dados já estão em memória (`leads`, `interactions`, `teamHistory`); o trabalho é derivar listas onde hoje só existem contagens e renderizar. `DailyGoalTeamView` (385 linhas, faz tudo) se quebra em quatro componentes de apresentação mais um hook de derivação em `src/views/team/`. O painel lateral nasce genérico em `src/components/ui/` para depois servir o Gerencial.

**Tech Stack:** React 19, Vite, Tailwind v4 com tokens semânticos, Vitest, Firestore (só leitura já existente), lucide-react.

**Spec:** `docs/superpowers/specs/2026-07-28-visao-gestor-profundidade-design.md`

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Ação |
| --- | --- | --- |
| `src/lib/dailyGoal.js` | Regra da meta e do volume | Modificar |
| `src/lib/dashboardMetrics.js` | Métricas do dashboard | Modificar |
| `src/components/ui/LeadListPanel.jsx` | Painel lateral genérico de lista de leads | Criar |
| `src/views/dashboard/DashboardOperacionalView.jsx` | Painel do dia do gestor | Modificar |
| `src/views/dashboard/useTeamGoals.js` | Meta por consultor no dashboard | Modificar |
| `src/views/team/useTeamBoard.js` | Deriva asas, régua e linhas do dia | Criar |
| `src/views/team/TeamWings.jsx` | Cartão 1, as duas réguas | Criar |
| `src/views/team/DayRail.jsx` | A régua de dias | Criar |
| `src/views/team/TeamDayTable.jsx` | Cartão 2, tabela do dia | Criar |
| `src/views/team/ConsultantDayDetail.jsx` | A linha aberta | Criar |
| `src/views/DailyGoalTeamView.jsx` | Orquestra a tela | Reescrever |
| `src/lib/__tests__/dailyGoal.test.js` | Testes da meta | Modificar |
| `src/lib/__tests__/dashboardMetrics.test.js` | Testes do dashboard | Modificar |

**Regra de ouro do visual:** `design_handoff_meta_equipe/` é a fonte da verdade. Porte hex, px, pesos e ordem **classe por classe**, não interprete. Onde o handoff usa uma variável CSS, use o token equivalente do projeto (tabela no fim do README do handoff).

---

## Task 0: Trazer o handoff pro repositório

**Files:**
- Create: `design_handoff_meta_equipe/` (cópia da pasta)
- Modify: `.gitignore`

- [ ] **Step 1: Copiar a pasta do handoff pra raiz do worktree**

O zip foi extraído no scratchpad da sessão. Se não estiver mais lá, extraia de novo de `~/Downloads/STRONILEAD.zip`.

```bash
cp -R "/private/tmp/claude-501/-Users-johnnybittencourt-STRONIX-FIRMA-06-sistemas-stronilead--claude-worktrees-dashboard-data-audit-2d6aa5/a5c9719f-3012-4702-94a7-0ff3753bb35d/scratchpad/stronilead_zip/design_handoff_meta_equipe" .
ls design_handoff_meta_equipe
```

Esperado: `Meta da Equipe.dc.html`, `README.md`, `support.js`

- [ ] **Step 2: Ignorar a pasta no git**

O projeto já ignora `design_redesign/` pelo mesmo motivo. Acrescente a linha em `.gitignore`, logo abaixo dela:

```
design_handoff_meta_equipe/
```

- [ ] **Step 3: Conferir que o git não vê a pasta**

Run: `git status --short`
Esperado: `.gitignore` modificado, e **nenhuma** menção a `design_handoff_meta_equipe/`

- [ ] **Step 4: Abrir o mockup e mexer nele antes de codar**

Abra `design_handoff_meta_equipe/Meta da Equipe.dc.html` no navegador. Clique num dia da régua, clique num consultor, troque o tema. A seção que se implementa é a `#3a`; `#1a`, `#1b` e `#2a` são registro da decisão.

- [ ] **Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: ignora a pasta do handoff da Meta da equipe"
```

---

## Task 1: Asas medem só dias encerrados

O `computeRitmo` conta hoje no `monthHits` e no `monthTarget`. As asas precisam medir só dias programados já encerrados, dos dois lados da fração: se o denominador exclui hoje e o numerador não, quem bate a meta de manhã aparece `14/13`.

`streak` e `history14` continuam incluindo hoje, que é o certo pra sequência.

**Files:**
- Modify: `src/lib/dailyGoal.js`
- Test: `src/lib/__tests__/dailyGoal.test.js`

- [ ] **Step 1: Escrever os testes que falham**

O arquivo de teste já fixa o relógio em quarta-feira 15/07/2026 10:00 com `vi.useFakeTimers()`. Julho de 2026 começa numa quarta. Com `metaWeekdays = [1,2,3,4,5]`, os dias úteis até 15/07 são 1, 2, 3, 6, 7, 8, 9, 10, 13, 14, 15 — onze dias, sendo dez encerrados.

Acrescente ao final de `src/lib/__tests__/dailyGoal.test.js`:

```js
describe('computeRitmo — hoje fica fora do mês', () => {
  const WEEKDAYS = [1, 2, 3, 4, 5];

  it('não conta hoje no denominador', () => {
    const { monthTarget } = computeRitmo([], WEEKDAYS);
    // 1,2,3,6,7,8,9,10,13,14 = 10 dias úteis encerrados (15 é hoje).
    expect(monthTarget).toBe(10);
  });

  it('não conta a meta batida hoje no numerador', () => {
    const history = [{ date: '2026-07-14' }, { date: '2026-07-15' }];
    const { monthHits, monthTarget } = computeRitmo(history, WEEKDAYS);
    expect(monthHits).toBe(1);
    expect(monthTarget).toBe(10);
  });

  it('mantém hoje na sequência e na régua de 14 dias', () => {
    const history = [{ date: '2026-07-14' }, { date: '2026-07-15' }];
    const { streak, history14 } = computeRitmo(history, WEEKDAYS);
    expect(streak).toBe(2);
    expect(history14[13]).toMatchObject({ isToday: true, hit: true });
  });
});

describe('countClosedMetaDaysInMonth', () => {
  it('conta só dias programados anteriores a hoje', () => {
    expect(countClosedMetaDaysInMonth([1, 2, 3, 4, 5])).toBe(10);
  });

  it('ignora hoje mesmo quando hoje é dia programado', () => {
    // Só quarta é dia de meta; 1 e 8 encerraram, 15 é hoje.
    expect(countClosedMetaDaysInMonth([3])).toBe(2);
  });

  it('devolve 0 quando a lista de dias está vazia', () => {
    expect(countClosedMetaDaysInMonth([])).toBe(0);
  });
});
```

Acrescente `countClosedMetaDaysInMonth` à lista de imports no topo do arquivo de teste.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- dailyGoal`
Esperado: FAIL. `countClosedMetaDaysInMonth is not a function` e `monthTarget` vindo 11 em vez de 10.

- [ ] **Step 3: Implementar**

Em `src/lib/dailyGoal.js`, logo abaixo de `countMetaDaysInMonth`, acrescente:

```js
// Dias de META já ENCERRADOS no mês (1..ontem). Denominador das asas do painel
// da equipe: hoje ainda está em curso, então não entra nem no numerador nem no
// denominador. Diferente de countMetaDaysInMonth, que inclui hoje e é usada
// onde o numerador também inclui (prospecção do mês na tela do consultor).
export function countClosedMetaDaysInMonth(metaWeekdays, refDate = new Date()) {
  const today = new Date(refDate);
  today.setHours(0, 0, 0, 0);
  let n = 0;
  for (let day = 1; day < today.getDate(); day++) {
    const d = new Date(today.getFullYear(), today.getMonth(), day);
    if ((metaWeekdays || []).includes(d.getDay())) n++;
  }
  return n;
}
```

Em `computeRitmo`, o laço do mês passa a parar antes de hoje. Troque:

```js
  let monthHits = 0, monthTarget = 0;
  for (let day = 1; day <= today.getDate(); day++) {
```

por:

```js
  // Hoje fica fora dos dois lados: o dia ainda está em curso e contá-lo faria
  // o time começar toda manhã devendo um dia que nem começou.
  let monthHits = 0, monthTarget = 0;
  for (let day = 1; day < today.getDate(); day++) {
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- dailyGoal`
Esperado: PASS, incluindo os testes de caracterização que já existiam.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Esperado: PASS. Se algum teste de outra suíte quebrar por causa do `monthTarget`, ele está congelando o comportamento antigo — atualize o número esperado e deixe um comentário dizendo que hoje saiu da conta.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dailyGoal.js src/lib/__tests__/dailyGoal.test.js
git commit -m "fix(meta): dias encerrados no ritmo do mes, hoje fica de fora"
```

---

## Task 2: Renovação volta pra Meta do gestor

`computeDailyGoalSlots` recebe `renewalCheckpoints` como quarto argumento, com `DEFAULT_RENEWAL_CHECKPOINTS` como padrão. Duas chamadas não passam o parâmetro, então a Meta que o gestor vê usa o padrão em vez da configuração da academia e diverge da tela do consultor.

**Files:**
- Modify: `src/views/dashboard/useTeamGoals.js:73`
- Modify: `src/views/DailyGoalTeamView.jsx:228`
- Test: `src/lib/__tests__/dailyGoal.test.js`

- [ ] **Step 1: Escrever o teste de caracterização**

Acrescente ao final de `src/lib/__tests__/dailyGoal.test.js`:

```js
describe('computeDailyGoalSlots — marcos de renovação vêm da configuração', () => {
  const cliente = (endsAt) => ({
    id: 'c1',
    name: 'Cliente Teste',
    consultantId: 'u1',
    status: 'Venda',
    lifecycleStage: 'cliente',
    createdAt: new Date(2026, 0, 10),
    contractEndsAt: endsAt,
  });

  it('não surfa o cliente quando o marco configurado ainda não chegou', () => {
    // Contrato vence em 2026-09-13, 60 dias depois de hoje (15/07/2026).
    const leads = [cliente(new Date(2026, 8, 13))];
    const slots = computeDailyGoalSlots(leads, new Map(), 'u1', [30]);
    expect(slots).toHaveLength(0);
  });

  it('surfa o cliente quando o marco configurado é o de 60 dias', () => {
    const leads = [cliente(new Date(2026, 8, 13))];
    const slots = computeDailyGoalSlots(leads, new Map(), 'u1', [60]);
    expect(slots).toHaveLength(1);
    expect(slots[0].categorySlugs).toContain(DAILY_GOAL_CATEGORIES.RENOVACAO);
  });
});
```

Importe `DAILY_GOAL_CATEGORIES` de `../leads.js` se ainda não estiver importado no arquivo de teste.

- [ ] **Step 2: Rodar e conferir o comportamento**

Run: `npm test -- dailyGoal`
Esperado: PASS nos dois. Este teste não falha — ele **caracteriza** que a função respeita o parâmetro. O bug está em quem chama, e é o que os próximos passos consertam. Se algum dos dois falhar, pare: o campo do fim do contrato tem outro nome ou a regra de `shouldPromptRenewal` mudou. Confirme com `grep -n "contractEndsAt\|endsAt" src/lib/renewalGoal.js` e ajuste o fixture antes de seguir.

- [ ] **Step 3: Passar a configuração em useTeamGoals**

Em `src/views/dashboard/useTeamGoals.js`, a linha 25 já lê o config geral. Acrescente `renewalCheckpoints` à desestruturação:

```js
  const { metaWeekdays = [1, 2, 3, 4, 5], dailyVolumeTarget = 0, renewalCheckpoints = [90, 60, 30] } = useGeneralConfig();
```

Na linha 73, passe o parâmetro:

```js
      const { totalSlots, doneSlots } = slotTotals(computeDailyGoalSlots(myLeads, byLead, u.id, renewalCheckpoints));
```

E acrescente `renewalCheckpoints` ao array de dependências do `useMemo` na linha 93.

- [ ] **Step 4: Passar a configuração em DailyGoalTeamView**

`DailyGoalTeamView` recebe config por prop, não por contexto. Confirme como `renewalCheckpoints` chega até ela:

Run: `grep -n "DailyGoalTeamView" -A 12 src/App.jsx`

Se a prop não existir, acrescente-a na chamada em `App.jsx` do mesmo jeito que `metaWeekdays` e `dailyVolumeTarget` já são passadas, e na assinatura do componente com o padrão `renewalCheckpoints = [90, 60, 30]`.

Na linha 228, passe o parâmetro:

```js
        const processed = computeDailyGoalSlots(myLeads, byLead, u.id, renewalCheckpoints);
```

E acrescente `renewalCheckpoints` ao array de dependências do `useMemo` na linha 261.

- [ ] **Step 5: Rodar a suíte e o lint**

Run: `npm test && npm run lint`
Esperado: testes PASS. O lint pode acusar erros pré-existentes de `react-hooks` (são 15 conhecidos, ver a auditoria de lint); o que não pode aparecer é erro novo em arquivo que você tocou.

- [ ] **Step 6: Commit**

```bash
git add src/views/dashboard/useTeamGoals.js src/views/DailyGoalTeamView.jsx src/lib/__tests__/dailyGoal.test.js src/App.jsx
git commit -m "fix(meta): gestor passa a ver a categoria Renovacao"
```

---

## Task 3: Tirar o laço duplicado

`computeDailyGoalSlots` tem o mesmo bloco de reconciliação escrito duas vezes, nas linhas 367 a 374 e 382 a 389, com o mesmo comentário. `addTarget` deduplica, então o resultado é idêntico — só dobra o trabalho.

**Files:**
- Modify: `src/lib/dailyGoal.js:376-389`

- [ ] **Step 1: Confirmar que os dois blocos são idênticos**

Run: `sed -n '365,390p' src/lib/dailyGoal.js`
Esperado: dois `myLeads.forEach` iguais, separados só pelo comentário repetido.

- [ ] **Step 2: Apagar o segundo bloco**

Remova o segundo comentário e o segundo `myLeads.forEach` (linhas 376 a 389). O primeiro bloco e seu comentário ficam.

- [ ] **Step 3: Rodar a suíte**

Run: `npm test`
Esperado: PASS, sem nenhuma mudança de número. Os testes de caracterização de `dailyGoal` cobrem a reconciliação; se algum quebrar, os blocos não eram idênticos e você removeu o errado.

- [ ] **Step 4: Commit**

```bash
git add src/lib/dailyGoal.js
git commit -m "refactor(meta): remove laco de reconciliacao duplicado"
```

---

## Task 4: computeConsultantDayBoard devolve as listas

Hoje a função devolve só contagens. Os leads que compõem cada número são conhecidos dentro dela e jogados fora. Passa a devolver as listas junto, sem leitura nova.

**Files:**
- Modify: `src/lib/dashboardMetrics.js:645-683`
- Test: `src/lib/__tests__/dashboardMetrics.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Acrescente ao final de `src/lib/__tests__/dashboardMetrics.test.js`:

```js
describe('computeConsultantDayBoard — listas junto das contagens', () => {
  const now = new Date(2026, 6, 15, 10, 0, 0);

  it('devolve os leads de follow-up atrasado, não só o total', () => {
    const leads = [
      { id: 'l1', name: 'Ana', consultantId: 'u1', consultantName: 'Marta',
        status: 'Novo', nextFollowUp: new Date(2026, 6, 10) },
      { id: 'l2', name: 'Bruno', consultantId: 'u1', consultantName: 'Marta',
        status: 'Novo', nextFollowUp: new Date(2026, 6, 12) },
    ];
    const board = computeConsultantDayBoard(leads, { now });
    expect(board.u1.followUpsAtrasados).toBe(2);
    expect(board.u1.leads.followUpsAtrasados.map((l) => l.id).sort()).toEqual(['l1', 'l2']);
  });

  it('não cria entrada de consultor quando não há lead', () => {
    expect(computeConsultantDayBoard([], { now })).toEqual({});
  });

  it('cada lista tem exatamente o tamanho da contagem correspondente', () => {
    const leads = [
      { id: 'l1', name: 'Ana', consultantId: 'u1', consultantName: 'Marta',
        status: 'Novo', nextFollowUp: new Date(2026, 6, 10) },
    ];
    const b = computeConsultantDayBoard(leads, { now }).u1;
    expect(b.leads.followUpsAtrasados).toHaveLength(b.followUpsAtrasados);
    expect(b.leads.agendou).toHaveLength(b.agendou);
    expect(b.leads.compareceu).toHaveLength(b.compareceu);
    expect(b.leads.matriculas).toHaveLength(b.matriculas);
    expect(b.leads.noShows).toHaveLength(b.noShows);
  });
});
```

Acrescente `computeConsultantDayBoard` aos imports do arquivo de teste, se não estiver lá.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- dashboardMetrics`
Esperado: FAIL com `Cannot read properties of undefined (reading 'followUpsAtrasados')`.

- [ ] **Step 3: Implementar**

Em `src/lib/dashboardMetrics.js`, dentro de `computeConsultantDayBoard`, o objeto criado por `ensure` ganha o balde de listas:

```js
      board[id] = {
        consultantId: id,
        name: lead.consultantName || 'Desconhecido',
        agendou: 0,
        compareceu: 0,
        matriculas: 0,
        followUpsAtrasados: 0,
        noShows: 0,
        // Os mesmos leads que produziram cada contagem acima. O gestor clica no
        // número e vê quem está por trás — sem leitura nova, já estão em memória.
        leads: { agendou: [], compareceu: [], matriculas: [], followUpsAtrasados: [], noShows: [] }
      };
```

E cada acumulação passa a empurrar o lead na lista correspondente:

```js
  computeTodayAgenda(leads, now).forEach(l => {
    const b = ensure(l);
    b.agendou += 1;
    b.leads.agendou.push(l);
    const d = getLeadAppointmentDate(l);
    if (d <= now && isLeadAttended(l)) {
      b.compareceu += 1;
      b.leads.compareceu.push(l);
    }
  });

  computeConvertedLeads(leads, buildDayRange(now)).forEach(l => {
    const b = ensure(l);
    b.matriculas += 1;
    b.leads.matriculas.push(l);
  });

  computePendingFollowUps(leads).forEach(l => {
    if (l.nextFollowUp < now) {
      const b = ensure(l);
      b.followUpsAtrasados += 1;
      b.leads.followUpsAtrasados.push(l);
    }
  });

  computeNoShowsToRework(leads, { now, days: noShowDays }).forEach(l => {
    const b = ensure(l);
    b.noShows += 1;
    b.leads.noShows.push(l);
  });
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- dashboardMetrics`
Esperado: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboardMetrics.js src/lib/__tests__/dashboardMetrics.test.js
git commit -m "feat(dash): board do consultor devolve os leads de cada numero"
```

---

## Task 5: O painel lateral

Componente genérico. Recebe uma lista de leads e como rotular a coluna da direita. Nasce em `components/ui/` porque depois vai servir o Gerencial.

**Files:**
- Create: `src/components/ui/LeadListPanel.jsx`

- [ ] **Step 1: Conferir a assinatura do avatar com anel de estado**

Run: `grep -n "function StateRingAvatar" -A 6 src/components/ui/StateRingAvatar.jsx`
Esperado: ver quais props ele recebe. O componente do próximo passo assume `lead` e `size`. Se a assinatura for outra, ajuste a chamada; se ele não servir aqui, troque por `<Avatar name={lead.name} size={32} />` de `./Avatar.jsx`.

- [ ] **Step 2: Criar o componente**

```jsx
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useLeadProfile } from '../../contexts/LeadProfileContext.jsx';
import { StateRingAvatar } from './StateRingAvatar.jsx';
import { cn } from '../../lib/utils.js';

// Painel lateral genérico: "quem está por trás deste número". Recebe a lista
// pronta (nada de leitura própria) e uma função que rende a coluna da direita
// de cada linha. Clicar no lead abre a ficha — o painel fecha junto, porque
// openProfile troca o <main> inteiro.
function LeadListPanel({ open, onClose, title, subtitle, leads = [], renderMeta, emptyText = 'Nada por aqui.' }) {
  const { openProfile } = useLeadProfile();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/25 dark:bg-black/50 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
      />
      <aside
        role="dialog"
        aria-label={title}
        className="relative w-full sm:w-[420px] h-full bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 motion-reduce:animate-none"
      >
        <header className="flex items-start gap-3 px-5 py-4 border-b border-border">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[15px] font-bold tracking-tight truncate">{title}</h2>
            {subtitle && <p className="text-[11.5px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 size-8 rounded-lg grid place-items-center text-muted-foreground hover:bg-slate-100 dark:hover:bg-white/[0.06] transition"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto thin-scroll">
          {leads.length === 0 ? (
            <p className="px-5 py-10 text-center text-[12.5px] text-slate-400 italic">{emptyText}</p>
          ) : (
            <ul>
              {leads.map((lead) => (
                <li key={lead.id} className="border-b border-slate-100 dark:border-white/[0.05] last:border-0">
                  <button
                    type="button"
                    onClick={() => { onClose(); openProfile(lead.id); }}
                    className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/[0.03] transition"
                  >
                    <StateRingAvatar lead={lead} size={32} />
                    <span className="flex-1 min-w-0 text-[13px] font-medium truncate">{lead.name || 'Sem nome'}</span>
                    {renderMeta && <span className="shrink-0 text-[11.5px] num">{renderMeta(lead)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
}

export { LeadListPanel };
```

- [ ] **Step 3: Rodar o lint**

Run: `npm run lint`
Esperado: nenhum erro novo no arquivo criado.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/LeadListPanel.jsx
git commit -m "feat(ui): painel lateral de lista de leads"
```

---

## Task 6: Números do Operacional passam a abrir

**Files:**
- Modify: `src/views/dashboard/DashboardOperacionalView.jsx`

- [ ] **Step 1: Acrescentar os imports**

No topo de `src/views/dashboard/DashboardOperacionalView.jsx`:

- acrescente `overdueDaysOf` à lista que já vem de `'../../lib/dailyGoal.js'`
- acrescente `getLeadAppointmentDate` à lista que já vem de `'../../lib/leads.js'`
- acrescente a linha nova:

```jsx
import { LeadListPanel } from '../../components/ui/LeadListPanel.jsx';
```

- [ ] **Step 2: Guardar qual número está aberto**

Em `DashboardOperacionalView`, junto dos outros `useState`:

```jsx
  // { title, subtitle, leads, renderMeta } ou null. Um painel por vez.
  const [panel, setPanel] = useState(null);
```

- [ ] **Step 3: Passar as listas pro card**

No `useMemo` de `consultantCards`, o objeto devolvido ganha as listas que a Task 4 criou:

```jsx
          backlog: {
            followUps: b?.followUpsAtrasados || 0,
            noShows: b?.noShows || 0
          },
          leadsBy: b?.leads || { agendou: [], compareceu: [], matriculas: [], followUpsAtrasados: [], noShows: [] },
          last: lastActionByUser[u.id] || null
```

- [ ] **Step 4: Tornar o trio clicável**

`ConsultantCard` passa a receber `onOpen`. A assinatura vira `function ConsultantCard({ card, onOpen })`.

O array que alimenta o trio ganha as listas:

```jsx
        {[
          { value: card.funnel.agendou, label: 'Agendou', leads: card.leadsBy.agendou },
          { value: card.funnel.compareceu, label: 'Compareceu', leads: card.leadsBy.compareceu },
          { value: card.funnel.matriculas, label: 'Matrículas', win: true, leads: card.leadsBy.matriculas }
        ].map((t, i) => (
```

E cada célula vira botão — troque a `<div>` de cada item por:

```jsx
          <button
            key={t.label}
            type="button"
            disabled={t.value === 0}
            onClick={() => onOpen({
              title: `${t.label} · ${card.name}`,
              subtitle: `${t.value} ${t.value === 1 ? 'lead' : 'leads'} hoje`,
              leads: t.leads,
              renderMeta: null
            })}
            className={cn(
              'flex-1 py-2 text-center transition',
              i > 0 && 'border-l border-slate-200/70 dark:border-white/[0.06]',
              t.value > 0 && 'hover:bg-slate-100/70 dark:hover:bg-white/[0.05] cursor-pointer'
            )}
          >
```

O fechamento `</div>` correspondente vira `</button>`.

- [ ] **Step 5: Tornar os dois chips clicáveis**

O chip de follow-ups:

```jsx
        <button
          type="button"
          disabled={card.backlog.followUps === 0}
          onClick={() => onOpen({
            title: `Follow-ups atrasados · ${card.name}`,
            subtitle: `${card.backlog.followUps} ${card.backlog.followUps === 1 ? 'lead parado' : 'leads parados'} · ordenados por dias de atraso`,
            leads: [...card.leadsBy.followUpsAtrasados].sort((a, b) => a.nextFollowUp - b.nextFollowUp),
            renderMeta: (lead) => (
              <span className="text-rose-600 dark:text-rose-300 font-semibold">{overdueDaysOf(lead)}d</span>
            )
          })}
          className={cn('flex-1 flex items-center gap-2 px-2.5 py-2 rounded-[10px] border text-[11.5px] text-left transition', chipClass, card.backlog.followUps > 0 && 'hover:brightness-95')}
        >
          <b className={cn('font-display text-[16px] font-bold num', stopped ? 'text-rose-600 dark:text-rose-300' : 'text-foreground')}>{card.backlog.followUps}</b>
          follow-ups atrasados
        </button>
```

O chip de no-shows:

```jsx
        <button
          type="button"
          disabled={card.backlog.noShows === 0}
          onClick={() => onOpen({
            title: `No-shows a reagendar · ${card.name}`,
            subtitle: `${card.backlog.noShows} ${card.backlog.noShows === 1 ? 'lead faltou' : 'leads faltaram'}`,
            leads: card.leadsBy.noShows,
            renderMeta: (lead) => {
              const d = getLeadAppointmentDate(lead);
              return <span className="text-muted-foreground">{d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'}</span>;
            }
          })}
          className={cn('flex-1 flex items-center gap-2 px-2.5 py-2 rounded-[10px] border text-[11.5px] text-left transition', chipClass, card.backlog.noShows > 0 && 'hover:brightness-95')}
        >
          <b className={cn('font-display text-[16px] font-bold num', stopped ? 'text-rose-600 dark:text-rose-300' : 'text-foreground')}>{card.backlog.noShows}</b>
          {card.backlog.noShows === 1 ? 'no-show a reagendar' : 'no-shows a reagendar'}
        </button>
```

- [ ] **Step 6: Renderizar o painel**

Na lista de cards, passe o handler:

```jsx
              {consultantCards.map((card) => <ConsultantCard key={card.key} card={card} onOpen={setPanel} />)}
```

E antes do `<footer>`, monte o painel:

```jsx
      <LeadListPanel
        open={Boolean(panel)}
        onClose={() => setPanel(null)}
        title={panel?.title}
        subtitle={panel?.subtitle}
        leads={panel?.leads || []}
        renderMeta={panel?.renderMeta}
        emptyText="Nenhum lead neste grupo."
      />
```

- [ ] **Step 7: Rodar o lint**

Run: `npm run lint`
Esperado: nenhum erro novo no arquivo.

- [ ] **Step 8: Verificar no navegador**

Suba o preview (`.claude/launch.json`, porta 5180). Logado como gestor, na Visão geral · Operacional: clique em "follow-ups atrasados" de um consultor. O painel abre pela direita com a lista. Clique num nome: a ficha abre. Volte: o dashboard aparece com o painel fechado. Confira que um número zerado não abre nada.

- [ ] **Step 9: Commit**

```bash
git add src/views/dashboard/DashboardOperacionalView.jsx
git commit -m "feat(dash): numeros do card do consultor abrem a lista de leads"
```

---

## Task 7: O hook que deriva a tela da equipe

Todo o cálculo da tela nova num lugar só. `DailyGoalTeamView` vira orquestração.

**Files:**
- Create: `src/views/team/useTeamBoard.js`

- [ ] **Step 1: Criar o hook**

```js
// Deriva TUDO que a tela "Meta da equipe" mostra, a partir do que já está em
// memória: as asas do mês (só dias encerrados), a régua de dias programados e
// as linhas do dia selecionado. Nenhuma leitura própria — o histórico vem por
// parâmetro, assinado pela view.
import { useMemo } from 'react';
import { DAILY_GOAL_CATEGORIES } from '../../lib/leads.js';
import {
  buildInteractionsByLead, computeDailyGoalSlots, slotTotals, computeRitmo,
  overdueDaysOf, dgDateKey, computeDailyVolume, computeVolumeInRange,
  listVolumeActionsInRange, volumeTargetFor, countClosedMetaDaysInMonth,
  interactionOwnerAuthUid,
} from '../../lib/dailyGoal.js';

// Fatiar leads e interações por dono UMA vez, em vez de re-varrer tudo por
// usuário. Mesmo critério que useTeamGoals usa — se divergir, a fatia não bate
// com o filtro interno das funções de meta e volume.
function sliceByOwner(leads, interactions) {
  const leadsByConsultant = new Map();
  (leads || []).forEach((l) => {
    const arr = leadsByConsultant.get(l.consultantId);
    if (arr) arr.push(l); else leadsByConsultant.set(l.consultantId, [l]);
  });
  const interactionsByAuth = new Map();
  (interactions || []).forEach((i) => {
    const owner = interactionOwnerAuthUid(i);
    const arr = interactionsByAuth.get(owner);
    if (arr) arr.push(i); else interactionsByAuth.set(owner, [i]);
  });
  return { leadsByConsultant, interactionsByAuth };
}

export function useTeamBoard({
  leads, interactions, usersList, teamHistory,
  metaWeekdays, slaOverdueDays, renewalCheckpoints, selectedDay, now,
}) {
  return useMemo(() => {
    const ref = now || new Date();
    const todayNum = ref.getDate();
    const year = ref.getFullYear(), month = ref.getMonth();
    const todayStart = new Date(year, month, todayNum);
    const monthStart = new Date(year, month, 1);
    const closedDays = countClosedMetaDaysInMonth(metaWeekdays, ref);

    const byLead = buildInteractionsByLead(interactions);
    const { leadsByConsultant, interactionsByAuth } = sliceByOwner(leads, interactions);

    const historyByConsultant = new Map();
    (teamHistory || []).forEach((h) => {
      if (!h?.consultantId) return;
      const arr = historyByConsultant.get(h.consultantId);
      if (arr) arr.push(h); else historyByConsultant.set(h.consultantId, [h]);
    });

    // Dia em foco. null = hoje.
    const isToday = selectedDay == null || selectedDay === todayNum;
    const dayNum = isToday ? todayNum : selectedDay;
    const from = new Date(year, month, dayNum);
    const to = new Date(year, month, dayNum + 1);
    const sel = {
      isToday, dayNum, dateKey: dgDateKey(from), from, to,
      isMetaDay: (metaWeekdays || []).includes(from.getDay()),
    };

    // Dias PROGRAMADOS do mês até hoje. Folga não é célula vazia: é ausência.
    const scheduled = [];
    for (let d = 1; d <= todayNum; d++) {
      const day = new Date(year, month, d);
      if ((metaWeekdays || []).includes(day.getDay())) scheduled.push(d);
    }

    const hitsByDate = new Map();
    (teamHistory || []).forEach((h) => {
      if (!h?.date) return;
      hitsByDate.set(h.date, (hitsByDate.get(h.date) || 0) + 1);
    });

    const rows = (usersList || []).map((u) => {
      const myLeads = leadsByConsultant.get(u.id) || [];
      const myInteractions = interactionsByAuth.get(u.authUid) || [];
      const history = historyByConsultant.get(u.id) || [];
      const ritmo = computeRitmo(history, metaWeekdays);
      const cota = volumeTargetFor(u);
      const hasCota = cota > 0;

      // ── Asas: só dias ENCERRADOS, dos dois lados da fração.
      const metaPct = closedDays > 0 ? Math.round((ritmo.monthHits / closedDays) * 100) : null;
      const prospMes = hasCota
        ? computeVolumeInRange(myLeads, myInteractions, u.id, u.authUid, monthStart, todayStart, metaWeekdays).total
        : 0;
      const prospAlvoMes = cota * closedDays;
      const prospPct = hasCota && prospAlvoMes > 0 ? Math.round((prospMes / prospAlvoMes) * 100) : null;
      const asas = { metaPct, metaHits: ritmo.monthHits, closedDays, prospMes, prospAlvoMes, prospPct };

      // ── Dia selecionado: HOJE tem a carteira completa.
      if (sel.isToday) {
        const processed = computeDailyGoalSlots(myLeads, byLead, u.id, renewalCheckpoints);
        const { totalSlots, doneSlots, progress } = slotTotals(processed);
        let pendCount = 0, critCount = 0;
        processed.forEach((l) => l.categorySlugs.forEach((slug) => {
          if (l.categoryStatus?.[slug]) return;
          pendCount++;
          if (slug === DAILY_GOAL_CATEGORIES.ATRASADO && overdueDaysOf(l, ref) >= slaOverdueDays) critCount++;
        }));
        const prospVol = hasCota ? computeDailyVolume(myLeads, myInteractions, u.id, u.authUid, ref) : null;
        const prospDone = prospVol?.total || 0;
        const prospAcoes = hasCota
          ? listVolumeActionsInRange(myLeads, myInteractions, u.id, u.authUid, sel.from, sel.to)
          : [];
        const prospHit = hasCota && prospDone >= cota;
        // metaOk = sem pendência (quem não tem tarefa hoje está em dia).
        // dailyHit = bateu de fato, o que exige ter tido tarefa.
        const metaOk = progress === 100;
        const dailyHit = totalSlots > 0 && progress === 100;
        return {
          user: u, isPast: false, hasCota, cota, ritmo, ...asas,
          processed, totalSlots, doneSlots, progress, pendCount, critCount,
          prospDone, prospVol, prospAcoes, prospHit, metaOk, dailyHit,
          // Regra mantida do sistema atual: sem cota, sem dia perfeito.
          perfect: dailyHit && prospHit,
        };
      }

      // ── Dia PASSADO: só o resultado. A carteira não é reconstruível.
      const hitMeta = history.some((h) => h.date === sel.dateKey);
      const prospVol = hasCota
        ? computeVolumeInRange(myLeads, myInteractions, u.id, u.authUid, sel.from, sel.to)
        : null;
      const prospDone = prospVol?.total || 0;
      const prospHit = hasCota && prospDone >= cota;
      return {
        user: u, isPast: true, hasCota, cota, ritmo, ...asas,
        hitMeta, prospDone, prospVol, prospHit,
        metaOk: hitMeta, dailyHit: hitMeta, perfect: hitMeta && prospHit,
      };
    });

    const teamSize = rows.length;
    const rail = scheduled.map((d) => {
      const key = dgDateKey(new Date(year, month, d));
      const isTodayCell = d === todayNum;
      const n = isTodayCell ? rows.filter((r) => r.metaOk).length : (hitsByDate.get(key) || 0);
      return {
        day: d, key, n, isToday: isTodayCell,
        selected: d === sel.dayNum,
        title: isTodayCell ? `Hoje · ${n} de ${teamSize} em dia` : `Dia ${d} · ${n} de ${teamSize} bateram`,
      };
    });

    const sorted = [...rows].sort((a, b) => {
      if (sel.isToday) {
        const aEmpty = a.totalSlots === 0, bEmpty = b.totalSlots === 0;
        if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
        return a.progress - b.progress; // quem precisa de atenção primeiro
      }
      return (Number(b.hitMeta) - Number(a.hitMeta)) || (b.prospDone - a.prospDone) ||
        (a.user.name || '').localeCompare(b.user.name || '');
    });

    return {
      sel, rail, rows: sorted, teamSize, closedDays,
      okNow: rows.filter((r) => r.metaOk).length,
      critTotal: rows.reduce((acc, r) => acc + (r.critCount || 0), 0),
      perfectCount: rows.filter((r) => r.perfect).length,
    };
  }, [leads, interactions, usersList, teamHistory, metaWeekdays, slaOverdueDays, renewalCheckpoints, selectedDay, now]);
}
```

- [ ] **Step 2: Rodar o lint**

Run: `npm run lint`
Esperado: nenhum erro novo. O `now` precisa vir de estado na view, não de `new Date()` inline, senão o `useMemo` recalcula a cada render.

- [ ] **Step 3: Commit**

```bash
git add src/views/team/useTeamBoard.js
git commit -m "feat(equipe): hook que deriva asas, regua e linhas do dia"
```

---

## Task 8: As asas e a régua

**Files:**
- Create: `src/views/team/TeamWings.jsx`
- Create: `src/views/team/DayRail.jsx`

Fonte visual: `design_handoff_meta_equipe/README.md`, seções "Cartão 1" e "A régua de dias".

- [ ] **Step 1: Criar TeamWings**

```jsx
import { Check } from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { cn } from '../../lib/utils.js';

// Cartão 1 do handoff: as duas réguas do MÊS crescendo em direções opostas a
// partir do nome. Barra curta de um lado só diz o assunto da conversa — quem
// falha na carteira e quem falha na cota são dois problemas diferentes.
// Mede só dias ENCERRADOS: hoje vive na régua e na tabela.
function Wing({ pct, label, tone, side, hasCota = true }) {
  const low = pct != null && pct < 60;
  const barTone = low ? 'bg-danger' : tone === 'brand' ? 'bg-brand-600' : 'bg-accent-500';
  const labelTone = !hasCota
    ? 'text-slate-400 dark:text-slate-500'
    : low ? 'text-rose-700 dark:text-rose-300' : 'text-slate-600 dark:text-slate-300';
  return (
    <div className={cn('flex items-center gap-2.5 min-w-0', side === 'right' && 'flex-row-reverse')}>
      <span className={cn('shrink-0 text-[11px] font-semibold num whitespace-nowrap', labelTone)}>{label}</span>
      <div className={cn(
        'flex-1 h-[18px] rounded-md overflow-hidden flex',
        hasCota ? 'bg-slate-100 dark:bg-white/[0.06]' : 'bg-transparent',
        side === 'left' && 'justify-end'
      )}>
        {hasCota && pct != null && (
          <span className={cn('h-full rounded-md', barTone)} style={{ width: `${Math.min(100, pct)}%` }} />
        )}
      </div>
    </div>
  );
}

function TeamWings({ rows, closedDays }) {
  return (
    <section className="px-5 pt-4 pb-3">
      <div className="grid grid-cols-[1fr_150px_1fr] gap-3 pb-3 border-b border-slate-100 dark:border-white/[0.05]">
        <div className="text-right">
          <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-brand-700 dark:text-brand-300 whitespace-nowrap">Meta diária</div>
          <div className="text-[10.5px] text-slate-400 dark:text-slate-500 whitespace-nowrap num">dias batidos de {closedDays} encerrados</div>
        </div>
        <div className="text-center">
          <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">Consultor</div>
          <div className="text-[10.5px] text-slate-400 dark:text-slate-500 whitespace-nowrap inline-flex items-center gap-1">
            <i className="size-1.5 rounded-full bg-success" aria-hidden="true" /> dia perfeito hoje
          </div>
        </div>
        <div>
          <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-accent-600 dark:text-accent-400 whitespace-nowrap">Prospecção</div>
          <div className="text-[10.5px] text-slate-400 dark:text-slate-500 whitespace-nowrap">ações do mês sobre a cota acumulada</div>
        </div>
      </div>

      <ul>
        {rows.map((r) => (
          <li
            key={r.user.id}
            className={cn(
              'grid grid-cols-1 sm:grid-cols-[1fr_150px_1fr] gap-2 sm:gap-3 items-center py-2.5',
              r.perfect && 'bg-emerald-50/60 dark:bg-emerald-500/[0.07] rounded-lg'
            )}
          >
            <div className="order-2 sm:order-1">
              <Wing
                side="left"
                tone="brand"
                pct={r.metaPct}
                label={`${r.metaHits}/${r.closedDays} · ${r.metaPct == null ? '—' : `${r.metaPct}%`}`}
              />
            </div>

            <div className="order-1 sm:order-2 flex items-center justify-start sm:justify-center gap-2 min-w-0">
              <span className="relative shrink-0">
                <Avatar name={r.user.name} size={30} />
                {r.perfect && (
                  <span className="absolute -right-0.5 -bottom-0.5 size-[13px] rounded-full bg-success grid place-items-center ring-2 ring-card">
                    <Check size={8} strokeWidth={3.5} className="text-white" />
                  </span>
                )}
              </span>
              <span className={cn('text-[12.5px] font-semibold truncate', r.perfect ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground')}>
                {(r.user.name || '').split(' ')[0]}
              </span>
            </div>

            <div className="order-3">
              <Wing
                side="right"
                tone="accent"
                hasCota={r.hasCota}
                pct={r.prospPct}
                label={r.hasCota ? `${r.prospMes}/${r.prospAlvoMes} · ${r.prospPct == null ? '—' : `${r.prospPct}%`}` : 'sem cota'}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export { TeamWings };
```

- [ ] **Step 2: Criar DayRail**

```jsx
import { cn } from '../../lib/utils.js';

// A dobradiça: fecha o gráfico e abre a tabela. Um botão por dia PROGRAMADO —
// folga não é célula vazia, é ausência. Sem o rótulo da esquerda a régua não se
// explica; foi a primeira coisa que o cliente não entendeu no mockup.
function DayRail({ rail, teamSize, onPick }) {
  return (
    <div className="flex items-stretch gap-3 pt-3 mt-1 border-t border-slate-100 dark:border-white/[0.05]">
      <div className="shrink-0 self-center">
        <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400 whitespace-nowrap">Dia do mês</div>
        <div className="text-[10.5px] text-slate-400 dark:text-slate-500 whitespace-nowrap num">quantos bateram, de {teamSize}</div>
      </div>
      <div className="flex-1 flex gap-1 overflow-x-auto thin-scroll snap-x">
        {rail.map((d) => {
          const fill = d.n <= 2 ? 'bg-danger' : d.n >= 4 ? 'bg-success' : 'bg-brand-200 dark:bg-brand-500/50';
          return (
            <button
              key={d.day}
              type="button"
              title={d.title}
              onClick={() => onPick(d.day)}
              className={cn(
                'flex-1 min-w-[26px] h-[38px] rounded-lg flex flex-col items-center justify-center gap-1 snap-start transition',
                d.selected
                  ? 'bg-brand-600'
                  : d.isToday
                    ? 'bg-brand-50 dark:bg-brand-500/15'
                    : 'hover:bg-slate-100 dark:hover:bg-white/[0.05]'
              )}
            >
              <span className={cn(
                'text-[11px] num leading-none',
                d.selected
                  ? 'text-white font-bold'
                  : d.isToday
                    ? 'text-brand-700 dark:text-brand-300 font-semibold'
                    : 'text-slate-500 dark:text-slate-400 font-medium'
              )}>
                {d.day}
              </span>
              <span className={cn('w-[22px] h-[4px] rounded-full overflow-hidden', d.selected ? 'bg-white/35' : 'bg-slate-200 dark:bg-white/[0.10]')}>
                <span
                  className={cn('block h-full rounded-full', d.selected ? 'bg-white' : fill)}
                  style={{ width: `${teamSize > 0 ? Math.round((d.n / teamSize) * 100) : 0}%` }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { DayRail };
```

- [ ] **Step 3: Rodar o lint**

Run: `npm run lint`
Esperado: nenhum erro novo nos dois arquivos.

- [ ] **Step 4: Commit**

```bash
git add src/views/team/TeamWings.jsx src/views/team/DayRail.jsx
git commit -m "feat(equipe): as duas reguas do mes e a regua de dias"
```

---

## Task 9: A linha aberta

**Files:**
- Create: `src/views/team/ConsultantDayDetail.jsx`

- [ ] **Step 1: Conferir o nome do campo de modalidade**

Run: `grep -n "modalidade" src/lib/leads.js | head -5`
Esperado: encontrar o campo real usado pela aula experimental. O componente do próximo passo assume `lead.modalidade`. Se o nome for outro, ajuste; se não existir campo de modalidade, deixe só a hora.

- [ ] **Step 2: Criar o componente**

```jsx
import { useLeadProfile } from '../../contexts/LeadProfileContext.jsx';
import { DG_CATEGORY_ORDER, DG_CATEGORY_META, overdueDaysOf } from '../../lib/dailyGoal.js';
import { DAILY_GOAL_CATEGORIES, getLeadAppointmentDate, getLeadAppointmentType } from '../../lib/leads.js';
import { cn } from '../../lib/utils.js';

const fmtHora = (d) => d instanceof Date
  ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  : '';

// O que vai à direita de cada lead: hora do compromisso, dias de atraso ou a
// hora em que o lead entrou. É o que diz ao gestor se aquilo já queimou.
function metaDoLead(lead, slug, slaOverdueDays) {
  if (slug === DAILY_GOAL_CATEGORIES.ATRASADO) {
    const dias = overdueDaysOf(lead);
    return { text: `atrasado ${dias}d`, critical: dias >= slaOverdueDays };
  }
  if (slug === DAILY_GOAL_CATEGORIES.NOVO_24H) {
    return { text: `entrou ${fmtHora(lead.createdAt)}`, critical: false };
  }
  if (slug === DAILY_GOAL_CATEGORIES.VISITA_HOJE || slug === DAILY_GOAL_CATEGORIES.AULA_HOJE) {
    const hora = fmtHora(getLeadAppointmentDate(lead));
    const tipo = getLeadAppointmentType(lead);
    return {
      text: tipo === 'aula_experimental' && lead.modalidade ? `${hora} · ${lead.modalidade}` : hora,
      critical: false
    };
  }
  if (slug === DAILY_GOAL_CATEGORIES.CONTATO_HOJE) {
    return { text: fmtHora(lead.nextFollowUp), critical: false };
  }
  return { text: '', critical: false };
}

// A linha aberta: à esquerda a carteira do dia em 6 categorias, à direita o
// extrato de prospecção. Os dois lados são NOMINAIS e clicáveis — o handoff
// supõe que a prospecção não tem nome de lead, mas tem: listVolumeActionsInRange
// devolve leadId e leadName desde a PR C.
function ConsultantDayDetail({ row, slaOverdueDays }) {
  const { openProfile } = useLeadProfile();

  const porCategoria = DG_CATEGORY_ORDER.map((slug) => {
    const itens = (row.processed || [])
      .filter((l) => l.categorySlugs.includes(slug))
      .map((l) => ({ lead: l, done: Boolean(l.categoryStatus?.[slug]), ...metaDoLead(l, slug, slaOverdueDays) }));
    return { slug, meta: DG_CATEGORY_META[slug], itens, done: itens.filter((i) => i.done).length };
  }).filter((c) => c.itens.length > 0);

  const faltam = Math.max(0, row.cota - row.prospDone);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_314px] gap-6 bg-paper-50 dark:bg-white/[0.02] px-5 py-4 border-t border-border">
      <div>
        <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400 mb-3">
          Meta diária · carteira do dia
        </div>
        {porCategoria.length === 0 ? (
          <p className="text-[12px] text-slate-400 italic">Nenhuma tarefa na meta de hoje.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-[22px] gap-y-[14px]">
            {porCategoria.map((c) => (
              <div key={c.slug}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{c.meta.label}</span>
                  <span className={cn('text-[11px] num font-semibold', c.done === c.itens.length ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400')}>
                    {c.done}/{c.itens.length}
                  </span>
                </div>
                <div className="h-px bg-slate-200 dark:bg-white/[0.08] my-1.5" />
                <ul className="space-y-1">
                  {c.itens.map(({ lead, done, text, critical }) => (
                    <li key={lead.id}>
                      <button
                        type="button"
                        onClick={() => openProfile(lead.id)}
                        className="w-full flex items-center gap-2 text-left group"
                      >
                        <i
                          className={cn('size-[7px] rounded-full shrink-0', done ? 'bg-success' : critical ? 'bg-danger' : 'bg-brand-200 dark:bg-brand-500/50')}
                          aria-hidden="true"
                        />
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
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="lg:border-l lg:border-slate-200 dark:lg:border-white/[0.06] lg:pl-6">
        <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400 mb-3">
          Prospecção · ações do dia
        </div>
        {!row.hasCota ? (
          <p className="text-[12px] text-slate-400 italic">Sem cota de prospecção.</p>
        ) : (
          <>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-[30px] font-bold leading-none num">{row.prospDone}</span>
              <span className="text-[12px] text-slate-400 num">de {row.cota}</span>
            </div>
            <div className={cn('text-[11.5px] font-semibold mt-1', faltam > 0 ? 'text-accent-600 dark:text-accent-400' : 'text-emerald-700 dark:text-emerald-400')}>
              {faltam > 0 ? `faltam ${faltam} ${faltam === 1 ? 'ação' : 'ações'}` : 'cota do dia cumprida'}
            </div>
            <div className="h-2 rounded-full bg-slate-200/70 dark:bg-white/[0.08] overflow-hidden mt-2">
              <div className="h-full rounded-full bg-accent-500" style={{ width: `${Math.min(100, Math.round((row.prospDone / row.cota) * 100))}%` }} />
            </div>

            <ul className="mt-3 space-y-1.5">
              {row.prospAcoes.map((a, i) => {
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
                      <span className="flex-1 min-w-0 truncate text-[12px] transition group-enabled:group-hover:text-brand-600 dark:group-enabled:group-hover:text-brand-400">
                        {temNome ? a.leadName : a.label}
                      </span>
                      <span className="shrink-0 text-[10.5px] num text-slate-400 dark:text-slate-500">{fmtHora(a.at)}</span>
                    </button>
                    {temNome && (
                      <span className="block pl-[15px] text-[10.5px] text-slate-400 dark:text-slate-500">{a.label}</span>
                    )}
                  </li>
                );
              })}
              {row.prospAcoes.length === 0 && (
                <li className="text-[12px] text-slate-400 italic">Nenhuma ação registrada hoje.</li>
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

export { ConsultantDayDetail };
```

- [ ] **Step 3: Rodar o lint**

Run: `npm run lint`
Esperado: nenhum erro novo.

- [ ] **Step 4: Commit**

```bash
git add src/views/team/ConsultantDayDetail.jsx
git commit -m "feat(equipe): linha aberta com a carteira e a prospeccao nominal"
```

---

## Task 10: A tabela do dia

**Files:**
- Create: `src/views/team/TeamDayTable.jsx`

- [ ] **Step 1: Criar o componente**

```jsx
import { ChevronDown } from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { ConsultantDayDetail } from './ConsultantDayDetail.jsx';
import { cn } from '../../lib/utils.js';

// Cartão 2 do handoff. A coluna Situação é a que o olho procura, por isso ela
// carrega a cor. Em dia PASSADO a tela degrada e anuncia: o sistema guarda o
// resultado, não as tarefas que existiam.
function TeamDayTable({ board, openId, onToggle, slaOverdueDays, appUser }) {
  const { sel, rows } = board;

  return (
    <section className="rounded-[20px] border border-border bg-card shadow-card overflow-hidden">
      <header className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <h3 className="font-display text-[15px] font-bold tracking-tight">Resultados do dia {sel.dayNum}</h3>
        {sel.isToday && (
          <span className="text-[9.5px] font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            Hoje
          </span>
        )}
      </header>

      <ul>
        {rows.map((r) => {
          const aberto = openId === r.user.id;
          const situacao = r.isPast
            ? null
            : r.metaOk
              ? { text: 'meta batida', cls: 'text-emerald-700 dark:text-emerald-400' }
              : r.critCount > 0
                ? { text: `${r.critCount} ${r.critCount === 1 ? 'crítica' : 'críticas'}`, cls: 'text-rose-700 dark:text-rose-300' }
                : { text: `${r.pendCount} ${r.pendCount === 1 ? 'pendente' : 'pendentes'}`, cls: 'text-slate-600 dark:text-slate-300' };
          const barTone = r.metaOk ? 'bg-success' : r.critCount > 0 ? 'bg-danger' : 'bg-brand-200 dark:bg-brand-500/50';

          return (
            <li key={r.user.id} className="border-t border-slate-100 dark:border-white/[0.05] first:border-0">
              <button
                type="button"
                disabled={r.isPast}
                onClick={() => onToggle(aberto ? null : r.user.id)}
                className={cn(
                  'w-full flex items-center gap-4 px-5 py-3 text-left transition',
                  !r.isPast && 'hover:bg-slate-50/70 dark:hover:bg-white/[0.02]',
                  r.perfect && 'bg-emerald-50/50 dark:bg-emerald-500/[0.05]'
                )}
              >
                <div className="shrink-0 w-[186px] flex items-center gap-2.5 min-w-0">
                  <Avatar name={r.user.name} size={30} />
                  <span className="text-[12.5px] font-semibold truncate">
                    {(r.user.name || '').split(' ')[0]}{r.user.id === appUser?.id ? ' (você)' : ''}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  {r.isPast ? (
                    <span className={cn(
                      'text-[12px] font-semibold',
                      r.hitMeta ? 'text-emerald-700 dark:text-emerald-400' : sel.isMetaDay ? 'text-slate-500' : 'text-slate-300 dark:text-slate-600'
                    )}>
                      {r.hitMeta ? 'bateu' : sel.isMetaDay ? 'não bateu' : 'folga'}
                    </span>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <span className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden max-w-[160px]">
                        <span className={cn('block h-full rounded-full', barTone)} style={{ width: `${r.progress}%` }} />
                      </span>
                      <span className="text-[11.5px] num text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {r.doneSlots}/{r.totalSlots} tarefas
                      </span>
                    </div>
                  )}
                </div>

                <div className="shrink-0 w-[120px] text-right">
                  {situacao && <span className={cn('text-[12px] font-semibold', situacao.cls)}>{situacao.text}</span>}
                </div>

                <div className="shrink-0 w-[130px] text-right">
                  <span className={cn(
                    'text-[12px] font-semibold num',
                    !r.hasCota
                      ? 'text-slate-400 dark:text-slate-500'
                      : r.prospHit ? 'text-emerald-700 dark:text-emerald-400' : 'text-accent-600 dark:text-accent-400'
                  )}>
                    {r.hasCota ? (r.isPast ? `${r.prospDone} ações` : `${r.prospDone}/${r.cota}`) : 'sem cota'}
                  </span>
                </div>

                <span className="shrink-0 w-5 grid place-items-center">
                  {!r.isPast && (
                    <ChevronDown size={16} className={cn('text-slate-400 transition-transform duration-150', aberto && 'rotate-180')} />
                  )}
                </span>
              </button>

              {aberto && !r.isPast && <ConsultantDayDetail row={r} slaOverdueDays={slaOverdueDays} />}
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="px-5 py-14 text-center text-[13px] text-slate-400">Nenhum usuário na equipe ainda.</li>
        )}
      </ul>
    </section>
  );
}

export { TeamDayTable };
```

- [ ] **Step 2: Rodar o lint**

Run: `npm run lint`
Esperado: nenhum erro novo.

- [ ] **Step 3: Commit**

```bash
git add src/views/team/TeamDayTable.jsx
git commit -m "feat(equipe): tabela do dia com linha expansivel"
```

---

## Task 11: Montar a tela

**Files:**
- Modify: `src/views/DailyGoalTeamView.jsx` (reescrever)

Saem inteiros: `MonthTrajectory`, `MetaDiariaCell`, `MetaPastCell`, `MetaProspCell`, `PerfectPill`, `Rail` e o memo `prospByDay`. Toda a derivação foi pro hook.

- [ ] **Step 1: Reescrever a view**

```jsx
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, Target } from 'lucide-react';
import { appId, DAILY_GOAL_HISTORY_PATH } from '../lib/firebase.js';
import { DEFAULT_SLA_OVERDUE_DAYS } from '../lib/dailyGoal.js';
import { useTeamBoard } from './team/useTeamBoard.js';
import { TeamWings } from './team/TeamWings.jsx';
import { DayRail } from './team/DayRail.jsx';
import { TeamDayTable } from './team/TeamDayTable.jsx';

// ============================================================================
// PAINEL DA EQUIPE — o gestor bate o olho e sabe se precisa chamar alguém.
//   • ASAS (cartão 1): as duas metas do MÊS por consultor, crescendo em
//     direções opostas a partir do nome. Só dias ENCERRADOS: hoje ainda está em
//     curso e contá-lo faria todo mundo começar a manhã devendo.
//   • RÉGUA: um botão por dia PROGRAMADO (folga é ausência, não célula vazia).
//     É a dobradiça — fecha o gráfico e abre a tabela.
//   • TABELA (cartão 2): o dia selecionado. A linha expande com a carteira
//     nominal do consultor e o extrato de prospecção. Nome abre a ficha.
//   ⚠️ Dia PASSADO guarda o resultado, não as tarefas: a linha não expande e a
//     coluna Meta vira bateu/não bateu. A tela anuncia isso em vez de esconder.
// LEITURA apenas: concluir tarefa é ato do consultor.
// ============================================================================

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function DailyGoalTeamView({
  leads, interactions, usersList, metaWeekdays,
  slaOverdueDays = DEFAULT_SLA_OVERDUE_DAYS,
  renewalCheckpoints = [90, 60, 30],
  db, appUser,
}) {
  const [teamHistory, setTeamHistory] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null); // null = hoje
  const [openId, setOpenId] = useState(null);

  // Relógio da tela em estado: entra no hook como dependência estável.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const ref = collection(db, 'artifacts', appId, 'public', 'data', DAILY_GOAL_HISTORY_PATH);
    const unsub = onSnapshot(
      ref,
      (snap) => setTeamHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.error('team history', e)
    );
    return () => unsub();
  }, [db]);

  const board = useTeamBoard({
    leads, interactions, usersList, teamHistory,
    metaWeekdays, slaOverdueDays, renewalCheckpoints, selectedDay, now,
  });

  const totalProgramados = useMemo(() => {
    const y = now.getFullYear(), m = now.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    let n = 0;
    for (let d = 1; d <= last; d++) {
      if ((metaWeekdays || []).includes(new Date(y, m, d).getDay())) n++;
    }
    return n;
  }, [now, metaWeekdays]);

  // Trocar de dia fecha a linha aberta: o detalhe só existe pra hoje.
  const pickDay = (d) => {
    setSelectedDay(d === now.getDate() ? null : d);
    setOpenId(null);
  };

  const selecionado = board.rail.find((d) => d.selected);

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-display tracking-tight text-[20px] font-bold inline-flex items-center gap-2">
            <Target size={18} className="text-brand-600" /> Meta da equipe
          </h2>
          <p className="text-[11.5px] text-muted-foreground mt-0.5 num">
            {MESES[now.getMonth()]} · {board.closedDays} {board.closedDays === 1 ? 'dia programado encerrado' : 'dias programados encerrados'} de {totalProgramados} · hoje em curso
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {!board.sel.isToday && (
            <button
              type="button"
              onClick={() => pickDay(now.getDate())}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-border bg-card text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/10 transition"
            >
              <ArrowLeft size={13} /> Voltar pra hoje
            </button>
          )}
          <div className="rounded-xl bg-paper-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06] px-3.5 py-2 text-right">
            <div className="font-display text-[19px] font-bold leading-none num">{board.okNow}</div>
            <div className="text-[11.5px] font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">em dia agora</div>
            <div className="text-[10.5px] text-slate-400 dark:text-slate-500 whitespace-nowrap num">de {board.teamSize}</div>
          </div>
          <div className="rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 px-3.5 py-2 text-right">
            <div className="font-display text-[19px] font-bold leading-none num text-rose-700 dark:text-rose-300">{board.critTotal}</div>
            <div className="text-[11.5px] font-semibold text-rose-700 dark:text-rose-300 whitespace-nowrap">
              {board.critTotal === 1 ? 'crítica' : 'críticas'}
            </div>
            <div className="text-[10.5px] text-slate-400 dark:text-slate-500 whitespace-nowrap num">atrasadas {slaOverdueDays}d+</div>
          </div>
        </div>
      </div>

      <div className="rounded-[22px] border border-border bg-card shadow-card">
        <TeamWings rows={board.rows} closedDays={board.closedDays} />
        <div className="px-5 pb-4">
          <DayRail rail={board.rail} teamSize={board.teamSize} onPick={pickDay} />
        </div>
      </div>

      <TeamDayTable
        board={board}
        openId={openId}
        onToggle={setOpenId}
        slaOverdueDays={slaOverdueDays}
        appUser={appUser}
      />

      {!board.sel.isToday && (
        <p className="text-[11.5px] text-slate-500 dark:text-slate-400 px-1">
          Dia {board.sel.dayNum} selecionado: {selecionado?.n ?? 0} de {board.teamSize} bateram.
          A tabela mostra só bateu ou não bateu e a prospecção do dia — o sistema não guarda quais tarefas existiam.
        </p>
      )}
    </div>
  );
}

export { DailyGoalTeamView };
```

- [ ] **Step 2: Conferir as props que a App passa**

Run: `grep -n "DailyGoalTeamView" -A 12 src/App.jsx`
Esperado: ver a chamada. Garanta que `renewalCheckpoints` está sendo passada (foi acrescentada na Task 2) e que `dailyVolumeTarget`, que a view não usa mais, saiu da chamada.

- [ ] **Step 3: Rodar testes e lint**

Run: `npm test && npm run lint`
Esperado: testes PASS. Lint sem erro novo nos arquivos tocados.

- [ ] **Step 4: Commit**

```bash
git add src/views/DailyGoalTeamView.jsx src/App.jsx
git commit -m "feat(equipe): tela nova da Meta da equipe conforme o handoff"
```

---

## Task 12: Verificação na tela

**Files:** nenhum

- [ ] **Step 1: Subir o preview**

Use o preview configurado (`.claude/launch.json`, porta 5180) em vez de rodar servidor pela mão.

- [ ] **Step 2: Conferir a Meta da equipe, logado como gestor**

1. O cabeçalho mostra o mês, os dias encerrados e os dois números da direita.
2. Nenhuma asa passa de 100%. Se alguém aparecer com 14/13, o numerador está contando hoje.
3. Consultor sem cota mostra "sem cota" à direita, com a trilha transparente, nunca 0%.
4. A régua não tem célula de sábado nem de domingo.
5. Clicar num dia passado: a tabela troca, as linhas param de expandir, a coluna Meta vira bateu/não bateu, e a frase de apoio aparece embaixo.
6. Voltar pra hoje: a linha volta a expandir.
7. Abrir uma linha: as 6 categorias aparecem à esquerda com os nomes, e a prospecção à direita com nome de lead.
8. Abrir outra linha: a primeira fecha.
9. Clicar num nome: a ficha do lead abre. Voltar: a tela aparece com a linha fechada.
10. Um consultor com tarefa concluída mostra o nome riscado e esmaecido.

- [ ] **Step 3: Conferir a Visão geral · Operacional**

1. Clicar em "follow-ups atrasados" abre o painel pela direita com a lista ordenada por dias de atraso.
2. Clicar em "no-shows a reagendar" abre com a data da falta.
3. Clicar em Agendou, Compareceu e Matrículas abre cada lista.
4. Número zerado não abre nada.
5. Esc fecha o painel. Clique fora fecha o painel.
6. Clicar num lead abre a ficha.

- [ ] **Step 4: Conferir a tela do consultor**

Logado como consultor, abra a Meta Diária. O "X/Y metas no mês" mudou de denominador (hoje saiu). Confirme que o número faz sentido e que a categoria Renovação aparece pra quem tem cliente em marco.

- [ ] **Step 5: Conferir no celular e no tema escuro**

Redimensione pra 375px. As asas empilham (nome como cabeçalho, meta e prospecção embaixo), a régua rola na horizontal, o painel lateral ocupa a tela toda. Troque pro tema escuro e confira que nenhum texto some.

- [ ] **Step 6: Commit de qualquer ajuste**

```bash
git add -A
git commit -m "fix(equipe): ajustes do teste na tela"
```

---

## Autorrevisão do plano

**Cobertura do spec:**

| Requisito do spec | Task |
| --- | --- |
| Cabeçalho com os dois números | 11 |
| Cartão 1, as duas réguas | 8 |
| Alvo 0 com trilha transparente | 8 |
| Dia perfeito exigindo cota | 7 |
| Régua de dias programados | 8 |
| Cartão 2, tabela do dia | 10 |
| Linha aberta com as 6 categorias | 9 |
| Nome do lead abre a ficha | 5, 9 |
| Prospecção nominal | 9 |
| Degradação por dia passado | 7, 10 |
| Painel lateral genérico | 5 |
| Números do Operacional clicáveis | 6 |
| Renovação na Meta do gestor | 2 |
| Denominador do mês | 1 |
| Laço duplicado | 3 |
| `MonthTrajectory` sai | 11 |

**Conferências durante a execução**, cada uma como passo dentro da task: assinatura do `StateRingAvatar` (Task 5), campo do fim do contrato no fixture de renovação (Task 2), campo de modalidade do lead (Task 9), props que `App.jsx` passa pra `DailyGoalTeamView` (Tasks 2 e 11).

**Fora de escopo, confirmado:** cobrança leve (PR 2), Gerencial, central de notificação, subcontagem de lead novo na prospecção do mês (aceita, documentada no spec).
