# Funil VENCIDOS na Meta Diária — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o sétimo funil da Meta Diária, "Vencidos", que cobra todo dia o cliente com contrato vencido e sem renovação, enquanto durar o período configurado pela academia.

**Architecture:** Uma regra pura nova (`src/lib/expiredGoal.js`) decide quem entra, no mesmo formato das outras categorias da Meta. A Renovação ganha um corte limpo no vencimento e o campo `renewalGraceDays` (hoje "tolerância depois do vencimento") passa a governar o funil novo, sem migração de dados. A query que carrega clientes para a Meta alarga a janela para trás, dentro do índice que já existe.

**Tech Stack:** React 19 + Vite, Firebase/Firestore, Vitest, Tailwind v4, shadcn/ui. Sem TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-17-funil-vencidos-design.md`

---

## Antes de começar

Rode uma vez para garantir que a base está verde e que o worktree tem as dependências (o `npm install` deste worktree já veio incompleto antes):

```bash
npx vitest run
```

Se falhar por módulo ausente (`tw-animate-css`, `eslint-plugin-react`), rode `npm install` e repita.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/expiredGoal.js` (novo) | regra pura do funil: quem entra, o rótulo da pílula, a chave de ordenação |
| `src/lib/renewalGoal.js` | passa a parar no vencimento (corte limpo) |
| `src/lib/leads.js` | slug e rótulo da categoria nova |
| `src/lib/dailyGoal.js` | metadados/ordem/tom da categoria, o slot novo, e a tarefa de cliente concluída que fica visível |
| `src/lib/leadQueries.js` | cálculo puro da janela de vencimento que a Meta carrega |
| `src/hooks/useRenewalClients.js` | usa a janela alargada |
| `src/App.jsx` | passa o período ao hook e a base do card de pendências |
| `src/views/DailyGoalView.jsx` | pílula, ordenação e roteamento do desfecho |
| `src/modals/RenewalOutcomeModal.jsx` | variante `vencido` dos três desfechos |
| `src/views/settings/PaceSection.jsx` | painel próprio do período |
| `src/views/dashboard/DashboardOperacionalView.jsx` | card de pendências conta tarefa de cliente |

---

### Task 1: A regra pura do funil

**Files:**
- Create: `src/lib/expiredGoal.js`
- Test: `src/lib/__tests__/expiredGoal.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/expiredGoal.test.js`:

```js
// Testes da regra pura do funil VENCIDOS (expiredGoal.js). Datas sempre em
// horário LOCAL, como o app faz. A fronteira do dia do vencimento é o ponto
// que mais erra, então ela está travada aqui.

import { describe, it, expect } from 'vitest';
import { shouldPromptExpired, expiredLabel, expiredSortKey } from '../expiredGoal.js';

const NOW = new Date(2026, 6, 15, 10, 0, 0); // quarta, 15/07/2026 10:00

// Meia-noite do dia (hoje + offset). É assim que o app grava vigência:
// fromDateInputValue devolve meia-noite local e addMonths preserva a hora.
const dayAt = (offsetDays) => {
  const d = new Date(NOW);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
};

const cliente = (over = {}) => ({
  id: 'c1',
  name: 'Cliente Teste',
  status: 'Venda',
  lifecycleStage: 'cliente',
  currentContractStartsAt: dayAt(-200),
  currentContractEndsAt: dayAt(-4),
  ...over
});

describe('shouldPromptExpired — quem entra no funil Vencidos', () => {
  it('entra: venceu hoje (vigência terminou à meia-noite de hoje)', () => {
    const l = cliente({ currentContractEndsAt: dayAt(0) });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(true);
  });

  it('entra: venceu há 1 dia', () => {
    const l = cliente({ currentContractEndsAt: dayAt(-1) });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(true);
  });

  it('entra: no último dia do período', () => {
    const l = cliente({ currentContractEndsAt: dayAt(-15) });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(true);
  });

  it('sai: um dia depois do período', () => {
    const l = cliente({ currentContractEndsAt: dayAt(-16) });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(false);
  });

  it('a academia manda no período: 7 derruba o que 30 mantém', () => {
    const l = cliente({ currentContractEndsAt: dayAt(-10) });
    expect(shouldPromptExpired(l, NOW, 7)).toBe(false);
    expect(shouldPromptExpired(l, NOW, 30)).toBe(true);
  });

  it('sem informar o período, vale o padrão de 15 dias', () => {
    expect(shouldPromptExpired(cliente({ currentContractEndsAt: dayAt(-10) }), NOW)).toBe(true);
    expect(shouldPromptExpired(cliente({ currentContractEndsAt: dayAt(-40) }), NOW)).toBe(false);
  });

  it('sai: contrato ainda vigente', () => {
    expect(shouldPromptExpired(cliente({ currentContractEndsAt: dayAt(90) }), NOW, 15)).toBe(false);
  });

  it('sai: contrato a vencer (ainda não venceu)', () => {
    expect(shouldPromptExpired(cliente({ currentContractEndsAt: dayAt(10) }), NOW, 15)).toBe(false);
  });

  it('sai: matrícula agendada para o futuro', () => {
    const l = cliente({ currentContractStartsAt: dayAt(5), currentContractEndsAt: dayAt(370) });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(false);
  });

  it('sai: contrato cancelado (cancelar não é vencer)', () => {
    const l = cliente({ currentContractStatus: 'cancelado' });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(false);
  });

  it('sai: contrato trancado (a vigência está congelada)', () => {
    const l = cliente({ currentContractStatus: 'trancado' });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(false);
  });

  it('sai: cliente legado sem vigência gravada', () => {
    const l = cliente({ currentContractEndsAt: null });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(false);
  });

  it('sai: não é cliente (lead em prospecção)', () => {
    const l = cliente({ lifecycleStage: undefined, status: 'Novo' });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(false);
  });

  it('sai: já disse que não vai renovar', () => {
    const l = cliente({ renewalDeclined: true });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(false);
  });

  it('sai: tem contato marcado para hoje (vive em Contatos)', () => {
    const l = cliente({ nextFollowUp: new Date(2026, 6, 15, 9, 0, 0) });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(false);
  });

  it('sai: tem contato marcado para o futuro', () => {
    const l = cliente({ nextFollowUp: dayAt(3) });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(false);
  });

  it('entra: contato marcado passou sem desfecho', () => {
    const l = cliente({ nextFollowUp: dayAt(-2) });
    expect(shouldPromptExpired(l, NOW, 15)).toBe(true);
  });

  it('lead nulo não quebra', () => {
    expect(shouldPromptExpired(null, NOW, 15)).toBe(false);
  });
});

describe('expiredLabel', () => {
  it('dia do vencimento fala "Venceu hoje"', () => {
    expect(expiredLabel(cliente({ currentContractEndsAt: dayAt(0) }), NOW)).toBe('Venceu hoje');
  });

  it('singular no primeiro dia', () => {
    expect(expiredLabel(cliente({ currentContractEndsAt: dayAt(-1) }), NOW)).toBe('Venceu há 1 dia');
  });

  it('plural depois disso', () => {
    expect(expiredLabel(cliente({ currentContractEndsAt: dayAt(-7) }), NOW)).toBe('Venceu há 7 dias');
  });

  it('sem vigência gravada não inventa rótulo', () => {
    expect(expiredLabel(cliente({ currentContractEndsAt: null }), NOW)).toBeNull();
  });
});

describe('expiredSortKey', () => {
  it('ordena o vencimento mais recente primeiro', () => {
    const antigo = cliente({ id: 'a', currentContractEndsAt: dayAt(-12) });
    const recente = cliente({ id: 'b', currentContractEndsAt: dayAt(-1) });
    const ordenado = [antigo, recente].sort((x, y) => expiredSortKey(y) - expiredSortKey(x));
    expect(ordenado.map((l) => l.id)).toEqual(['b', 'a']);
  });

  it('sem vigência vai para o fim', () => {
    expect(expiredSortKey(cliente({ currentContractEndsAt: null }))).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/expiredGoal.test.js`
Expected: FAIL — "Failed to resolve import '../expiredGoal.js'"

- [ ] **Step 3: Write the implementation**

Create `src/lib/expiredGoal.js`:

```js
// Regra pura do funil VENCIDOS da Meta Diária: o CLIENTE cujo contrato venceu e
// que ainda não renovou. Complementa src/lib/renewalGoal.js — lá é a cobrança
// ANTES do vencimento (marcos 90/60/30, uma vez por marco), aqui é a cobrança
// DEPOIS, todo dia programado, enquanto durar o período configurado.
//
// Corte limpo: a partir do dia do vencimento o cliente sai de Renovações e
// entra aqui. Ninguém aparece nos dois.
//
// Ver spec: docs/superpowers/specs/2026-08-17-funil-vencidos-design.md
//
// Campos do lead que a regra lê (todos já existem):
//   currentContractEndsAt / currentContractStatus / currentContractStartsAt
//   renewalDeclined — "não vai renovar/voltar" (reseta em buildMatriculaWrites)
//   nextFollowUp — contato marcado; enquanto for hoje ou futuro, o cliente é
//     cobrado na categoria Contatos, não aqui (evita tarefa dobrada).

import { getSafeDateOrNull, daysBetween } from './dates.js';
import { deriveLeadContractStatus, CONTRACT_STATUS } from './contracts.js';
import {
  daysToExpiryOf,
  normalizeRenewalGraceDays,
  DEFAULT_RENEWAL_GRACE_DAYS
} from './renewalGoal.js';

// O período do funil é o MESMO campo que a academia já configurava como
// "tolerância depois do vencimento" (renewalGraceDays em stronix_config). Só o
// dono mudou: agora ele governa este funil. Trocar o nome exigiria migração.
export const DEFAULT_EXPIRED_WINDOW_DAYS = DEFAULT_RENEWAL_GRACE_DAYS;
export const normalizeExpiredWindowDays = normalizeRenewalGraceDays;

// `now` deve ser um horário REAL, não a meia-noite do dia: a vigência termina à
// meia-noite do dia gravado em endsAt, então às 00:00 desse dia o contrato já
// está vencido (é o que deriveContractStatus enxerga, e é o que a ficha mostra
// como INATIVO). Passar meia-noite aqui empataria a comparação e atrasaria a
// entrada do cliente em um dia.
export function shouldPromptExpired(lead, now, windowDays = DEFAULT_EXPIRED_WINDOW_DAYS) {
  if (!lead) return false;
  if (lead.lifecycleStage !== 'cliente') return false;
  if (lead.renewalDeclined) return false;

  const ref = getSafeDateOrNull(now) || new Date();

  // Fonte única do "venceu" — a mesma que pinta INATIVO na ficha. De graça
  // exclui cancelado, trancado, agendado, ativo, a vencer e o legado sem
  // vigência gravada (que devolve null).
  if (deriveLeadContractStatus(lead, ref) !== CONTRACT_STATUS.VENCIDO) return false;

  const daysToExpiry = daysToExpiryOf(lead.currentContractEndsAt, ref);
  if (!Number.isFinite(daysToExpiry)) return false;
  if (daysToExpiry < -normalizeExpiredWindowDays(windowDays)) return false;

  // Contato marcado para hoje ou para frente: a cobrança de hoje é da categoria
  // Contatos. Contato que já passou sem desfecho volta a ser cobrado aqui.
  const todayStart = new Date(ref);
  todayStart.setHours(0, 0, 0, 0);
  const nextFollowUp = getSafeDateOrNull(lead.nextFollowUp);
  if (nextFollowUp && nextFollowUp >= todayStart) return false;

  return true;
}

// Rótulo da pílula do card e do selo do popup. Conta por DIA de calendário com
// daysBetween (que arredonda o pulo de 1h do horário de verão).
export function expiredLabel(lead, now = new Date()) {
  const endsAt = getSafeDateOrNull(lead?.currentContractEndsAt);
  if (!endsAt) return null;
  const ref = getSafeDateOrNull(now) || new Date();
  const endDay = new Date(endsAt);
  endDay.setHours(0, 0, 0, 0);
  const today = new Date(ref);
  today.setHours(0, 0, 0, 0);
  const days = daysBetween(endDay, today);
  if (!Number.isFinite(days) || days <= 0) return 'Venceu hoje';
  return `Venceu há ${days} ${days === 1 ? 'dia' : 'dias'}`;
}

// Chave de ordenação da lista: o vencimento mais recente primeiro (ordenar
// DESC por esta chave). É o inverso dos Atrasados, de propósito — a chance de
// reativação cai a cada dia fora. Sem vigência gravada vai para o fim.
export const expiredSortKey = (lead) => {
  const d = getSafeDateOrNull(lead?.currentContractEndsAt);
  return d ? d.getTime() : 0;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/expiredGoal.test.js`
Expected: PASS — 25 testes verdes

- [ ] **Step 5: Commit**

```bash
git add src/lib/expiredGoal.js src/lib/__tests__/expiredGoal.test.js
git commit -m "feat(meta): regra pura do funil Vencidos"
```

---

### Task 2: Corte limpo na Renovação

A Renovação para de cobrar no vencimento. Os três testes de tolerância existentes viram testes do corte limpo.

**Files:**
- Modify: `src/lib/renewalGoal.js:81-101`
- Modify: `src/lib/__tests__/renewalGoal.test.js:81-107`

- [ ] **Step 1: Rewrite the tolerance tests as clean-cut tests**

Em `src/lib/__tests__/renewalGoal.test.js`, substitua o bloco inteiro
`describe('shouldPromptRenewal — tolerância depois do vencimento', ...)`
(linhas 81 a 107) por:

```js
describe('shouldPromptRenewal — corte limpo no vencimento', () => {
  it('vencido não cobra renovação: a cobrança é do funil Vencidos', () => {
    const l = cliente({ currentContractEndsAt: endsInDays(-1) });
    expect(shouldPromptRenewal(l, NOW, [90, 60, 30])).toBe(false);
  });

  it('vencido há muito tempo também fica fora', () => {
    const l = cliente({ currentContractEndsAt: endsInDays(-20) });
    expect(shouldPromptRenewal(l, NOW, [90, 60, 30])).toBe(false);
  });

  it('o último dia de vigência ainda cobra renovação', () => {
    const l = cliente({ currentContractEndsAt: endsInDays(1) });
    expect(shouldPromptRenewal(l, NOW, [90, 60, 30])).toBe(true);
  });

  it('contrato trancado não se renova — a vigência está congelada', () => {
    const l = cliente({ currentContractEndsAt: endsInDays(15), currentContractStatus: 'trancado' });
    expect(shouldPromptRenewal(l, NOW, [90, 60, 30])).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/renewalGoal.test.js`
Expected: FAIL — os dois primeiros casos ainda devolvem `true` (a regra antiga cobrava vencido dentro da tolerância)

- [ ] **Step 3: Add the clean-cut guard**

Em `src/lib/renewalGoal.js`, dentro de `shouldPromptRenewal`, logo depois de
`const ref = getSafeDateOrNull(now) || new Date();`, insira:

```js
  // Corte limpo no vencimento: a partir do dia em que o contrato vence a
  // cobrança passa para o funil VENCIDOS (src/lib/expiredGoal.js). Sem isto os
  // dois funis cobrariam o mesmo cliente. Mesma fonte do "venceu" que a ficha
  // usa para mostrar INATIVO.
  if (deriveLeadContractStatus(lead, ref) === CONTRACT_STATUS.VENCIDO) return false;
```

Ainda no mesmo arquivo, **remova** o bloco da tolerância antiga (agora código
morto, o vencido nunca chega até aqui):

```js
  // REMOVER estas linhas:
  // Vencido há mais tempo que a tolerância: virou inativo. Sem isto o cliente
  // que saiu há meses continuava aparecendo na Meta como renovação pendente.
  if (Number.isFinite(daysToExpiry) && daysToExpiry < -normalizeRenewalGraceDays(graceDays)) return false;
```

Ajuste a assinatura, que não precisa mais do período (o quarto argumento que os
callers ainda passam é ignorado pelo JS, então nada quebra):

```js
export function shouldPromptRenewal(lead, now, checkpoints) {
```

E o import no topo do arquivo passa a trazer o derivador de status:

```js
import { deriveLeadContractStatus, CONTRACT_STATUS } from './contracts.js';
```

Atualize também o comentário de cabeçalho da função, item 2, para citar o corte
limpo, e mantenha `normalizeRenewalGraceDays` / `DEFAULT_RENEWAL_GRACE_DAYS`
exportados: quem consome agora é `src/lib/expiredGoal.js`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/renewalGoal.test.js src/lib/__tests__/expiredGoal.test.js`
Expected: PASS nos dois arquivos

- [ ] **Step 5: Commit**

```bash
git add src/lib/renewalGoal.js src/lib/__tests__/renewalGoal.test.js
git commit -m "feat(meta): Renovação para no vencimento (corte limpo)"
```

---

### Task 3: A categoria nova na Meta

**Files:**
- Modify: `src/lib/leads.js:87-106`
- Modify: `src/lib/dailyGoal.js:1-47` (imports, metadados, ordem, tons)
- Modify: `src/lib/dailyGoal.js:277-394` (o slot novo)
- Test: `src/lib/__tests__/dailyGoal.test.js`

- [ ] **Step 1: Write the failing test**

Adicione ao fim de `src/lib/__tests__/dailyGoal.test.js`:

```js
describe('computeDailyGoalSlots — funil Vencidos', () => {
  const CONSULTOR = 'u1';

  const clienteVencido = (over = {}) => {
    const endsAt = new Date();
    endsAt.setHours(0, 0, 0, 0);
    endsAt.setDate(endsAt.getDate() - 3);
    return {
      id: 'v1',
      name: 'Cliente Vencido',
      consultantId: CONSULTOR,
      status: 'Venda',
      lifecycleStage: 'cliente',
      createdAt: new Date(2025, 0, 10),
      currentContractStartsAt: new Date(2025, 0, 10),
      currentContractEndsAt: endsAt,
      ...over
    };
  };

  const slugsOf = (leads, id) => {
    const found = leads.find((l) => l.id === id);
    return found ? found.categorySlugs : [];
  };

  it('cliente vencido aparece em Vencidos e não em Renovações', () => {
    const out = computeDailyGoalSlots([clienteVencido()], new Map(), CONSULTOR, [90, 60, 30], 15);
    expect(slugsOf(out, 'v1')).toContain(DAILY_GOAL_CATEGORIES.VENCIDO);
    expect(slugsOf(out, 'v1')).not.toContain(DAILY_GOAL_CATEGORIES.RENOVACAO);
  });

  it('fora do período não aparece em nenhum dos dois', () => {
    const endsAt = new Date();
    endsAt.setHours(0, 0, 0, 0);
    endsAt.setDate(endsAt.getDate() - 40);
    const out = computeDailyGoalSlots([clienteVencido({ currentContractEndsAt: endsAt })], new Map(), CONSULTOR, [90, 60, 30], 15);
    expect(slugsOf(out, 'v1')).toEqual([]);
  });

  it('cliente vencido com contato marcado para hoje aparece só em Contatos', () => {
    const hoje = new Date();
    hoje.setHours(9, 0, 0, 0);
    const out = computeDailyGoalSlots([clienteVencido({ nextFollowUp: hoje, nextFollowUpType: 'Mensagem' })], new Map(), CONSULTOR, [90, 60, 30], 15);
    expect(slugsOf(out, 'v1')).toContain(DAILY_GOAL_CATEGORIES.CONTATO_HOJE);
    expect(slugsOf(out, 'v1')).not.toContain(DAILY_GOAL_CATEGORIES.VENCIDO);
  });

  it('a categoria entra na ordem e nos metadados visuais', () => {
    expect(DG_CATEGORY_ORDER).toContain(DAILY_GOAL_CATEGORIES.VENCIDO);
    const meta = DG_CATEGORY_META[DAILY_GOAL_CATEGORIES.VENCIDO];
    expect(meta.short).toBe('Vencidos');
    expect(COLOR_TONES[meta.color]).toBeTruthy();
  });
});
```

Confira o topo do arquivo de teste: se `DG_CATEGORY_ORDER`, `DG_CATEGORY_META`,
`COLOR_TONES` ou `DAILY_GOAL_CATEGORIES` não estiverem importados, acrescente-os
aos imports existentes (`../dailyGoal.js` e `../leads.js`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/dailyGoal.test.js`
Expected: FAIL — `DAILY_GOAL_CATEGORIES.VENCIDO` é `undefined`

- [ ] **Step 3: Add the category**

Em `src/lib/leads.js`, dentro de `DAILY_GOAL_CATEGORIES`, depois de `RENOVACAO`:

```js
  // Cliente com contrato VENCIDO ainda sem renovação (funil Vencidos). Segunda
  // categoria cujo alvo é um CLIENTE, e a única cobrada TODO dia enquanto
  // durar o período. Regra em src/lib/expiredGoal.js.
  VENCIDO: 'vencido'
```

E em `DAILY_GOAL_CATEGORY_LABEL`:

```js
  vencido: 'Contrato vencido'
```

Em `src/lib/dailyGoal.js`, no import do lucide (linha 1), acrescente `UserX`:

```js
import { AlertCircle, BookOpen, Building2, MessageSquare, RefreshCw, UserX, Zap } from 'lucide-react';
```

Importe a regra nova junto dos imports de `./renewalGoal.js`:

```js
import { shouldPromptExpired } from './expiredGoal.js';
```

Em `DG_CATEGORY_META`, depois da entrada de `RENOVACAO`:

```js
  [DAILY_GOAL_CATEGORIES.VENCIDO]: { label: DAILY_GOAL_CATEGORY_LABEL.vencido, short: 'Vencidos', color: 'slate', Icon: UserX }
```

Em `DG_CATEGORY_ORDER`, como último item:

```js
  DAILY_GOAL_CATEGORIES.VENCIDO
```

Em `COLOR_TONES`, acrescente o tom (espelha o slate de `leadState.TONES`, que já
é o tom do estado INATIVO na ficha):

```js
  slate: { dot: 'bg-slate-500', text: 'text-slate-700', soft: 'bg-slate-100', strong: 'bg-slate-500', border: 'border-slate-200', darkText: 'dark:text-slate-300', darkSoft: 'dark:bg-white/[0.06]' }
```

- [ ] **Step 4: Add the slot in computeDailyGoalSlots**

Em `src/lib/dailyGoal.js`, dentro de `computeDailyGoalSlots`, junto das outras
âncoras de tempo no topo da função (perto de `todayStart`/`todayEnd`):

```js
  // Horário REAL, não meia-noite: a regra de vencidos compara a vigência com o
  // instante atual (ver o cabeçalho de shouldPromptExpired). Passar todayStart
  // atrasaria em um dia a entrada de quem vence hoje.
  const nowRef = new Date();
```

E depois do bloco `// 6. Renovação`, ainda dentro do `myLeads.forEach`:

```js
    // 7. Vencidos — CLIENTE com contrato vencido dentro do período configurado
    // (renewalGraceDays) e sem contato marcado para hoje/futuro. Cobrado TODO
    // dia enquanto durar o período; sai por desfecho (reativou / não vai voltar
    // / reagendou) ou quando o período acaba. Regra em src/lib/expiredGoal.js.
    if (shouldPromptExpired(lead, nowRef, renewalGraceDays)) {
      addTarget(lead, DAILY_GOAL_CATEGORY_LABEL.vencido, DAILY_GOAL_CATEGORIES.VENCIDO);
    }
```

Atualize o comentário do parâmetro `renewalGraceDays` na assinatura da função
para dizer que ele governa o funil Vencidos, não mais a Renovação.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/dailyGoal.test.js src/lib/__tests__/leads.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/leads.js src/lib/dailyGoal.js src/lib/__tests__/dailyGoal.test.js
git commit -m "feat(meta): categoria Vencidos nos slots da Meta Diária"
```

---

### Task 4: Tarefa de cliente concluída fica marcada como feita

Hoje o laço que mantém tarefas concluídas visíveis pula quem tem `status: 'Venda'`, ou seja, todo cliente — então o cartão de uma renovação concluída some da tela em vez de ficar marcado.

**Files:**
- Modify: `src/lib/dailyGoal.js:402-409`
- Test: `src/lib/__tests__/dailyGoal.test.js`

- [ ] **Step 1: Write the failing test**

Adicione ao `describe('computeDailyGoalSlots — funil Vencidos', ...)` criado na Task 3:

```js
  it('tarefa de cliente concluída hoje continua visível como feita', () => {
    const hoje = new Date();
    hoje.setHours(11, 0, 0, 0);
    const endsAt = new Date();
    endsAt.setHours(0, 0, 0, 0);
    endsAt.setDate(endsAt.getDate() - 3);
    // O desfecho "não vai voltar" grava renewalDeclined (tira da condição viva)
    // e a marca daily_goal_done. Sem o conserto, o cartão sumia da tela.
    const lead = clienteVencido({ renewalDeclined: true, currentContractEndsAt: endsAt });
    const byLead = new Map([[lead.id, [{
      leadId: lead.id,
      type: 'daily_goal_done',
      dailyGoalCategory: DAILY_GOAL_CATEGORIES.VENCIDO,
      createdAt: hoje
    }]]]);
    const out = computeDailyGoalSlots([lead], byLead, CONSULTOR, [90, 60, 30], 15);
    expect(slugsOf(out, 'v1')).toContain(DAILY_GOAL_CATEGORIES.VENCIDO);
    const found = out.find((l) => l.id === 'v1');
    expect(found.categoryStatus[DAILY_GOAL_CATEGORIES.VENCIDO]).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/dailyGoal.test.js`
Expected: FAIL — o slug não aparece (o laço pula cliente)

- [ ] **Step 3: Fix the loop**

Em `src/lib/dailyGoal.js`, substitua o laço que mantém as tarefas concluídas
visíveis (o segundo `myLeads.forEach`, hoje em ~402-409) por:

```js
  // Categorias cujo alvo é CLIENTE. Cliente é status 'Venda', então o guard
  // abaixo o excluía do laço e a tarefa concluída hoje SUMIA da tela em vez de
  // ficar marcada como feita. Aqui ele mantém visível só o que concluiu nestas
  // duas — nada de lead muda de comportamento.
  const CLIENT_CATEGORY_SLUGS = [DAILY_GOAL_CATEGORIES.RENOVACAO, DAILY_GOAL_CATEGORIES.VENCIDO];
  myLeads.forEach(lead => {
    const isCliente = lead.lifecycleStage === 'cliente';
    if (!isCliente && (lead.status === 'Venda' || lead.status === 'Perda')) return;
    const slugs = isCliente ? CLIENT_CATEGORY_SLUGS : Object.values(DAILY_GOAL_CATEGORIES);
    slugs.forEach(slug => {
      if (hasGoalDoneToday(lead, slug, leadInteractions(lead.id), todayStart)) {
        addTarget(lead, DAILY_GOAL_CATEGORY_LABEL[slug] || slug, slug);
      }
    });
  });
```

- [ ] **Step 4: Run the whole suite (this touches the Renovação too)**

Run: `npx vitest run`
Expected: PASS em todos os arquivos. Se algum teste de contagem de slots da
Renovação quebrar, é o efeito esperado deste conserto: a tarefa concluída passa
a contar no total E no feito. Atualize a expectativa do teste somando 1 nos dois
lados, nunca só em um.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dailyGoal.js src/lib/__tests__/dailyGoal.test.js
git commit -m "fix(meta): tarefa de cliente concluída não desaparece mais da Meta"
```

---

### Task 5: Alargar a janela que carrega os clientes

Sem isto o funil fica vazio: cliente vencido há mais de um dia não é carregado.

**Files:**
- Modify: `src/lib/leadQueries.js` (função pura nova)
- Modify: `src/hooks/useRenewalClients.js`
- Modify: `src/App.jsx:1160`
- Test: `src/lib/__tests__/leadQueries.test.js`

- [ ] **Step 1: Write the failing test**

Adicione ao fim de `src/lib/__tests__/leadQueries.test.js` (acrescente
`renewalWindowMs` aos imports de `../leadQueries.js`):

```js
describe('renewalWindowMs', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const NOW = new Date(2026, 6, 15, 10, 0, 0).getTime();

  it('vai para frente até o maior marco e para trás até o período de vencidos', () => {
    const w = renewalWindowMs(NOW, { contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30], expiredWindowDays: 15 });
    expect(w.start).toBe(NOW - 16 * DAY);
    expect(w.end).toBe(NOW + 91 * DAY);
  });

  it('o threshold do sistema entra na conta quando é maior que os marcos', () => {
    const w = renewalWindowMs(NOW, { contractThresholdDays: 120, renewalCheckpoints: [30], expiredWindowDays: 7 });
    expect(w.end).toBe(NOW + 121 * DAY);
    expect(w.start).toBe(NOW - 8 * DAY);
  });

  it('ignora marco inválido, zero e negativo', () => {
    const w = renewalWindowMs(NOW, { contractThresholdDays: 0, renewalCheckpoints: [0, -5, NaN, 'x', 45], expiredWindowDays: 0 });
    expect(w.end).toBe(NOW + 46 * DAY);
    expect(w.start).toBe(NOW - 1 * DAY);
  });

  it('sem nada configurado ainda devolve a folga de 1 dia em cada ponta', () => {
    const w = renewalWindowMs(NOW, {});
    expect(w.start).toBe(NOW - 1 * DAY);
    expect(w.end).toBe(NOW + 1 * DAY);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/leadQueries.test.js`
Expected: FAIL — `renewalWindowMs is not a function`

- [ ] **Step 3: Write the pure window function**

Em `src/lib/leadQueries.js`, acrescente `DAY_MS` ao import de `./leadStatus.js` e
adicione, logo acima de `renewalClientsQuerySpec`:

```js
// Janela de vencimento que a META precisa carregar, em ms:
//   para FRENTE  → até o maior entre contractThresholdDays e os marcos de
//     renovação, porque o marco mais distante (ex.: 90) dispara antes do
//     threshold do sistema (ex.: 30).
//   para TRÁS    → até o período do funil Vencidos (expiredWindowDays), senão
//     o cliente que venceu não é carregado e o funil aparece vazio. Era o furo
//     que a tolerância antiga tinha: a janela começava em ontem.
// 1 dia de folga em cada ponta para a borda não escapar por causa de hora.
// Puro de propósito: este cálculo já morou dentro de um useMemo do hook, onde
// ninguém conseguia ver que estava errado.
export const renewalWindowMs = (nowMs, { contractThresholdDays, renewalCheckpoints, expiredWindowDays } = {}) => {
  const forward = [Number(contractThresholdDays) || 0, ...(Array.isArray(renewalCheckpoints) ? renewalCheckpoints.map(Number) : [])]
    .filter((n) => Number.isFinite(n) && n > 0);
  const maxForward = forward.length ? Math.max(...forward) : 0;
  const backNum = Number(expiredWindowDays);
  const back = Number.isFinite(backNum) && backNum > 0 ? backNum : 0;
  return {
    start: nowMs - (back + 1) * DAY_MS,
    end: nowMs + (maxForward + 1) * DAY_MS
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/leadQueries.test.js`
Expected: PASS

- [ ] **Step 5: Use it in the hook**

Em `src/hooks/useRenewalClients.js`: troque o `useMemo` da janela pela função
pura, receba o período novo e inclua-o no `specKey`.

```js
import { renewalClientsQuerySpec, renewalWindowMs } from '../lib/leadQueries.js';
import { normalizeExpiredWindowDays } from '../lib/expiredGoal.js';
```

```js
export function useRenewalClients({ db, contractThresholdDays, renewalCheckpoints, expiredWindowDays, enabled = true, reloadKey = 0 }) {
  const win = useMemo(
    () => renewalWindowMs(Date.now(), {
      contractThresholdDays,
      renewalCheckpoints,
      // Normaliza aqui (0-90, padrão 15) para a janela não encolher quando a
      // config ainda não chegou do Firestore.
      expiredWindowDays: normalizeExpiredWindowDays(expiredWindowDays)
    }),
    // reloadKey entra pra recomputar a janela (novo "now") na virada do dia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contractThresholdDays, renewalCheckpoints, expiredWindowDays, reloadKey]
  );
```

E no `specKey` do `usePagedLeads`, acrescente o período:

```js
    specKey: `renewal:${contractThresholdDays}:${(renewalCheckpoints || []).join(',')}:${expiredWindowDays}:${reloadKey}`,
```

Atualize o comentário de cabeçalho do arquivo: a janela agora cobre também os
vencidos recentes, que alimentam o funil Vencidos da Meta.

- [ ] **Step 6: Pass the period from App.jsx**

Em `src/App.jsx:1160`, acrescente o parâmetro na chamada do hook:

```js
  const { clients: renewalClients, candidates: renewalCandidates } = useRenewalClients({ db, contractThresholdDays, renewalCheckpoints, expiredWindowDays: renewalGraceDays, reloadKey: dayKey, enabled: !!appUser });
```

- [ ] **Step 7: Verify the suite and the lint**

Run: `npx vitest run && npx eslint src/hooks/useRenewalClients.js src/lib/leadQueries.js src/App.jsx`
Expected: PASS e nenhum erro novo de lint

- [ ] **Step 8: Commit**

```bash
git add src/lib/leadQueries.js src/hooks/useRenewalClients.js src/App.jsx src/lib/__tests__/leadQueries.test.js
git commit -m "fix(meta): carregar os clientes vencidos que o funil precisa"
```

---

### Task 6: A aba, a pílula e o roteamento na tela da Meta

**Files:**
- Modify: `src/views/DailyGoalView.jsx` (imports, TaskCard, pendingBySlug, handleGoalDone, render do modal)

- [ ] **Step 1: Import the rule helpers**

Acrescente em `src/views/DailyGoalView.jsx`:

```js
import { expiredLabel, expiredSortKey } from '../lib/expiredGoal.js';
```

- [ ] **Step 2: Add the pill in TaskCard**

Em `TaskCard`, junto das outras flags de categoria (perto de
`const isContato = ...`):

```js
  const isExpired = slug === DAILY_GOAL_CATEGORIES.VENCIDO;
```

E na linha de chips, depois do bloco `{isOverdue && overdueDays > 0 && (...)}`:

```jsx
            {isExpired && (
              <TimePill icon={<Clock size={11} />}>
                {expiredLabel(task, now)}
                {task.currentPlanName ? <span className="opacity-60"> · {task.currentPlanName}</span> : null}
              </TimePill>
            )}
```

`TimePill` já nasce no tom slate, então não precisa de tom novo. `now` vem da
prop do card (atualizada por minuto), não de `Date.now()` no render.

- [ ] **Step 3: Sort the group, most recent first**

Em `pendingBySlug`, logo depois da ordenação dos Atrasados:

```js
    // Vencidos: o vencimento mais RECENTE primeiro — o inverso dos Atrasados,
    // de propósito: a chance de reativação cai a cada dia fora da academia.
    groups[DAILY_GOAL_CATEGORIES.VENCIDO].sort((a, b) => expiredSortKey(b) - expiredSortKey(a));
```

- [ ] **Step 4: Route "Concluir" to the outcome popup**

Em `handleGoalDone`, logo depois do bloco `if (categorySlug === DAILY_GOAL_CATEGORIES.RENOVACAO) {...}`:

```js
    // Vencidos: mesmo popup de desfecho da Renovação, na variante 'vencido'
    // (Reativou / Não vai voltar / Reagendar contato). Não há marco a tratar —
    // a saída do funil vem do nextFollowUp e do renewalDeclined.
    if (categorySlug === DAILY_GOAL_CATEGORIES.VENCIDO) {
      setRenewalTarget({ lead, activeCheckpoint: null, variant: 'vencido' });
      return;
    }
```

- [ ] **Step 5: Pass the variant to the modal**

Encontre o uso do componente:

```bash
grep -n "RenewalOutcomeModal" src/views/DailyGoalView.jsx
```

No JSX `<RenewalOutcomeModal ... />`, acrescente a prop:

```jsx
          variant={renewalTarget?.variant || 'renovacao'}
```

- [ ] **Step 6: Lint the file**

Run: `npx eslint src/views/DailyGoalView.jsx`
Expected: nenhum erro novo

- [ ] **Step 7: Commit**

```bash
git add src/views/DailyGoalView.jsx
git commit -m "feat(meta): aba Vencidos, pílula do vencimento e roteamento do desfecho"
```

---

### Task 7: A variante do popup de desfecho

**Files:**
- Modify: `src/modals/RenewalOutcomeModal.jsx`

- [ ] **Step 1: Add the variant copy table**

Em `src/modals/RenewalOutcomeModal.jsx`, depois de `FOOTER_LABEL`, acrescente:

```js
// Os dois funis de CLIENTE usam o mesmo popup: a mecânica dos três desfechos é
// idêntica, muda o vocabulário. 'renovacao' cobra antes de vencer; 'vencido'
// cobra depois (ver src/lib/expiredGoal.js).
const VARIANTS = {
  renovacao: {
    title: 'Renovação de contrato',
    question: 'Qual o desfecho desta renovação?',
    category: DAILY_GOAL_CATEGORIES.RENOVACAO,
    categoryLabel: 'Renovação',
    okLabel: 'Renovou',
    noLabel: 'Não vai renovar',
    okFooter: 'Renovar',
    okHint: 'Ao confirmar, abrimos o fluxo de nova matrícula com os dados do cliente.',
    noDoneText: '✅ Renovação — Meta Diária concluída (não vai renovar).',
    noToast: 'Perda de renovação registrada. O cliente continua ativo, só sai desta cobrança.'
  },
  vencido: {
    title: 'Contrato vencido',
    question: 'Qual o desfecho deste contrato vencido?',
    category: DAILY_GOAL_CATEGORIES.VENCIDO,
    categoryLabel: 'Contrato vencido',
    okLabel: 'Reativou',
    noLabel: 'Não vai voltar',
    okFooter: 'Reativar',
    okHint: 'Ao confirmar, abrimos o fluxo de matrícula para reativar este cliente.',
    noDoneText: '✅ Contrato vencido — Meta Diária concluída (não vai voltar).',
    noToast: 'Registrado. Este cliente sai da cobrança de vencidos.'
  }
};
```

Acrescente o import do rótulo do vencimento:

```js
import { expiredLabel } from '../lib/expiredGoal.js';
```

- [ ] **Step 2: Wire the variant into the component**

Na assinatura, receba a prop com o padrão de hoje:

```js
function RenewalOutcomeModal({ open = true, onClose, lead, appUser, db, activeCheckpoint, variant = 'renovacao', onDone }) {
  const v = VARIANTS[variant] || VARIANTS.renovacao;
```

Substitua os textos fixos pelos da variante:

- os rótulos dos segmentos e do rodapé passam a vir de `v`:

```js
  const segments = [
    { key: OUTCOMES.RENOVOU, label: v.okLabel, Icon: CheckCircle2, tone: 'emerald' },
    { key: OUTCOMES.NAO_RENOVA, label: v.noLabel, Icon: Ban, tone: 'rose' },
    { key: OUTCOMES.REAGENDAR, label: 'Reagendar contato', Icon: Calendar, tone: 'amber' }
  ];
  const footerLabel = { ...FOOTER_LABEL, [OUTCOMES.RENOVOU]: v.okFooter };
```

Use `segments` no lugar de `SEGMENTS` nas duas ocorrências (no
`<SegmentedOutcome segments={...}>` e no `outcomeButtonClass(...)` do botão do
rodapé) e `footerLabel[outcome]` no lugar de `FOOTER_LABEL[outcome]`.

- o título e a pergunta:

```jsx
              <span className="block">{v.title}</span>
```

```jsx
          question={v.question}
```

- o selo à direita do resumo do plano: marco na Renovação, vencimento no
  Vencidos. Calcule o rótulo dentro de `useMemo`, no mesmo padrão do
  `todayStart` do arquivo, para o render não chamar `new Date()`:

```js
  const expiredBadge = useMemo(
    () => (variant === 'vencido' ? expiredLabel(lead) : null),
    [variant, lead]
  );
```

```jsx
            {expiredBadge ? (
              <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-slate-200 whitespace-nowrap">
                {expiredBadge}
              </span>
            ) : activeCheckpoint != null && (
              <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-[#9FBCFF] whitespace-nowrap">
                Marco de {activeCheckpoint} dias
              </span>
            )}
```

- o painel de dica do desfecho "Renovou/Reativou": troque o texto fixo por
  `{v.okHint}`.

- na gravação do "não renova / não volta", troque as três constantes:

```js
        await logInteraction(db, lead, appUser, {
          text: v.noDoneText,
          type: 'daily_goal_done',
          dailyGoalCategory: v.category
        });
        toast.success(v.noToast);
```

- na gravação do reagendamento, o texto e a categoria também vêm da variante:

```js
        await logInteraction(db, lead, appUser, {
          text: `✅ ${v.categoryLabel} — Meta Diária concluída (contato reagendado para ${dateFmt}).`,
          type: 'daily_goal_done',
          dailyGoalCategory: v.category
        });
```

O `activeCheckpoint` chega `null` na variante Vencidos, e `renewalDecline`/
`renewalReschedule` já tratam `null` sem tocar em `renewalHandledCheckpoints`.
Nenhum construtor novo, nenhum campo novo.

- [ ] **Step 3: Lint and run the suite**

Run: `npx eslint src/modals/RenewalOutcomeModal.jsx && npx vitest run`
Expected: sem erro novo de lint, testes verdes

- [ ] **Step 4: Commit**

```bash
git add src/modals/RenewalOutcomeModal.jsx
git commit -m "feat(meta): variante Vencidos no popup de desfecho"
```

---

### Task 8: O período em Configurações

**Files:**
- Modify: `src/views/settings/PaceSection.jsx:136-144` (toast), `:289-353` (painéis)

- [ ] **Step 1: Move the control into its own panel**

Em `src/views/settings/PaceSection.jsx`:

1. Acrescente `UserX` ao import de `lucide-react`.
2. **Remova** do painel "Marcos de renovação" o bloco inteiro da tolerância (a
   `div` com `border-t border-border` que contém "Tolerância depois do
   vencimento" e os botões 7/15/30, hoje em ~326-352), junto do comentário
   acima dela.
3. No `hint` do painel "Marcos de renovação", deixe explícito o limite:

```jsx
        hint={<>Dias antes do vencimento em que o cliente entra na tarefa de Renovação. Ele aparece <b>uma vez</b> em cada marco, não todo dia. Vale só até o contrato vencer: depois disso a cobrança segue no funil <b>Vencidos</b>.</>}
```

4. Logo depois do `</SettingsPanel>` dos marcos, acrescente o painel novo:

```jsx
      <SettingsPanel
        icon={<UserX size={16} />}
        iconTone="brand"
        title="Funil de vencidos"
        hint={<>Por quantos dias o cliente com contrato vencido continua sendo cobrado, <b>todo dia</b>, na Meta Diária. Passando disso ele sai da meta: a conversa deixa de ser renovação e vira reativação.</>}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap px-6 py-5 border-t border-border">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold">Período de cobrança</div>
            <p className="text-[11.5px] text-muted-foreground mt-0.5 max-w-[420px] text-pretty">
              Vale do dia do vencimento em diante. Quem reativa, diz que não volta ou tem contato reagendado sai antes do prazo.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {[7, 15, 30].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => persistGraceDays(n)}
                aria-pressed={graceDays === n}
                className={cn(
                  'num h-9 px-3.5 rounded-[10px] text-[13px] font-semibold transition border',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                  graceDays === n
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted'
                )}
              >
                {n} dias
              </button>
            ))}
          </div>
        </div>
      </SettingsPanel>
```

5. Atualize o toast de `persistGraceDays`, que ainda fala de renovação:

```js
      toast.success(`Vencidos ficam ${n} dias na Meta Diária.`);
```

O campo gravado no Firestore continua `renewalGraceDays` — sem migração, cada
academia mantém o número que já escolheu.

- [ ] **Step 2: Lint**

Run: `npx eslint src/views/settings/PaceSection.jsx`
Expected: nenhum erro novo

- [ ] **Step 3: Commit**

```bash
git add src/views/settings/PaceSection.jsx
git commit -m "feat(config): período do funil Vencidos em painel próprio"
```

---

### Task 9: O card de pendências do gestor conta tarefa de cliente

Conserto cirúrgico: só o card recebe a base completa, que já está na memória. Custo zero de leitura. Nenhum outro número da tela é tocado — eles dependem da mesma lista e precisam de auditoria própria (ver o achado registrado no spec).

**Files:**
- Modify: `src/App.jsx:1478`
- Modify: `src/views/dashboard/DashboardOperacionalView.jsx:283-327` (`PlacarDoDia`), `:458`, `:620`

- [ ] **Step 1: Pass the Meta base as a separate prop**

Em `src/App.jsx:1478`, na renderização de `DashboardOperacionalView`, acrescente
a prop (mantendo `leads` como está):

```jsx
metaLeads={metaLeads}
```

- [ ] **Step 2: Forward it only to the pendências card**

Em `src/views/dashboard/DashboardOperacionalView.jsx`:

```js
function DashboardOperacionalView({ leads, metaLeads, interactions, appUser, usersList, db, onNavigate, listenersActive = true }) {
```

E no uso de `<PlacarDoDia ... leads={leads}`, acrescente:

```jsx
            metaLeads={metaLeads}
```

- [ ] **Step 3: Use it for the slots only**

Em `PlacarDoDia`:

```js
function PlacarDoDia({ leads, metaLeads, interactions, appUser, db, onNavigate, now }) {
```

E na conta das pendências, troque a base:

```js
    // Pendências vêm da base da META (ativos + clientes em renovação/vencidos),
    // não da fatia de prospecção: senão as tarefas de CLIENTE não entram no
    // número e o card do gestor fica menor que a Meta dele.
    const { totalSlots, doneSlots } = slotTotals(computeDailyGoalSlots(metaLeads || leads, byLead, appUser.id, renewalCheckpoints, renewalGraceDays));
```

O volume de prospecção (`computeDailyVolume` / `computeVolumeInRange`) **continua
em `leads`**, de propósito: a base da Meta não traz o cliente cujo contrato está
longe de vencer, e trocar ali poderia derrubar um lead novo da contagem do dia.

Acrescente `metaLeads` ao array de dependências do `useMemo` que envolve essa
conta.

- [ ] **Step 4: Lint and run the suite**

Run: `npx eslint src/App.jsx src/views/dashboard/DashboardOperacionalView.jsx && npx vitest run`
Expected: sem erro novo, testes verdes

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/views/dashboard/DashboardOperacionalView.jsx
git commit -m "fix(dashboard): card de pendências conta as tarefas de cliente"
```

---

### Task 10: Verificação final

**Files:** nenhum (só verificação)

- [ ] **Step 1: Full suite and lint**

```bash
npx vitest run && npx eslint .
```

Expected: todos os testes verdes; o lint sem erro NOVO (o repositório já
convive com 15 erros conhecidos das regras do react-hooks v7 — não tente
consertá-los aqui).

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: build sem erro. Se falhar por dependência ausente (`tw-animate-css`),
rode `npm install` e repita.

- [ ] **Step 3: Smoke test na tela**

```bash
npm run dev
```

Abra a Meta Diária (porta configurada em `.claude/launch.json`) e confira:

1. A aba **Vencidos** aparece no cabeçalho de funis, em cinza, como última.
2. Um cliente com contrato vencido dentro do período aparece na lista, com a
   pílula "Venceu há N dias" e o nome do plano.
3. "Concluir" abre o popup com **Reativou / Não vai voltar / Reagendar contato**,
   e o selo mostra o vencimento em vez do marco.
4. "Não vai voltar" com motivo: o cartão fica marcado como feito (não some) e a
   nota entra na linha do tempo do cliente.
5. "Reagendar contato" para uma data futura: sai de Vencidos na hora e aparece
   em Contatos no dia escolhido.
6. Em Configurações → Metas & ritmo existe o painel **Funil de vencidos**;
   trocar de 15 para 7 muda quem aparece na lista.
7. O mesmo cliente **não** aparece em Renovações e em Vencidos ao mesmo tempo.

- [ ] **Step 4: Commit any fix from the smoke test, then push for PR**

O merge é sempre por PR, com aprovação do Johnny (convenção do repositório).

```bash
git push -u origin claude/expired-customers-funnel-978641
```

---

## Auto-revisão do plano

**Cobertura do spec:** regra pura (Task 1), corte limpo (Task 2), categoria e
slot (Task 3), conserto da tarefa concluída (Task 4), janela da query (Task 5),
UI da Meta (Task 6), popup (Task 7), configuração (Task 8), card do gestor
(Task 9), verificação (Task 10). Todas as seções do spec têm tarefa.

**Sem placeholder:** cada passo que muda código traz o código.

**Consistência de nomes entre tarefas:** `shouldPromptExpired`, `expiredLabel`,
`expiredSortKey`, `normalizeExpiredWindowDays`, `DEFAULT_EXPIRED_WINDOW_DAYS`
(Task 1) são exatamente os nomes usados nas Tasks 3, 5, 6 e 7.
`renewalWindowMs` (Task 5) casa com o import do hook. `DAILY_GOAL_CATEGORIES.VENCIDO`
e o slug `'vencido'` são os mesmos da Task 3 à Task 7. A prop `variant` da Task 6
casa com a assinatura da Task 7, e `metaLeads` da Task 9 casa entre App e view.
