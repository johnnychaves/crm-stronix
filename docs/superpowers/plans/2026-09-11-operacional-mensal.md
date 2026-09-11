# Operacional por competência · plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a tela Operacional (hoje uma tela do dia, diferente por papel) por uma tela mensal igual para todos, com comparativo entre meses e filtro de pessoa, fiel ao handoff do Claude Design.

**Architecture:** A matemática mora em módulos puros em `src/lib/operacional/` (sem React, sem Firestore), com uma função `metricsOf(mês, pessoa)` que serve ao mês exibido, ao comparado e às tendências. Um hook carrega as fontes de cada mês (contratos já em memória; interações, leads criados e histórico de metas por consulta de campo único, com cache de mês fechado conferido por contagem). A tela é montada com componentes portados classe a classe do handoff.

**Tech Stack:** React 19, Vite, Tailwind v4 (tokens em `src/index.css`), shadcn/ui, Firebase Firestore (SDK web), Vitest.

**Documentos de referência (ler antes de começar):**
- Especificação: `docs/superpowers/specs/2026-09-11-operacional-mensal-design.md`
- Handoff (fonte da verdade visual e de textos): `docs/superpowers/specs/handoff-operacional/README.md` e `docs/superpowers/specs/handoff-operacional/Operacional.dc.html` (a lógica de exemplo está nas linhas 866 a 1712; os dados de exemplo NÃO são para copiar)
- Regras do projeto: `CLAUDE.md` da raiz da pasta do Stronilead

---

## Convenções para todas as tarefas

- Testes: `npm test` roda `vitest run`. Um arquivo só: `npx vitest run src/lib/__tests__/<arquivo>.test.js`.
- Lint: `npm run lint`. Build: `npm run build`.
- Commits em português, formato `tipo: descrição curta`, terminando com a linha `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Nunca commitar na `main`; a branch é `claude/operational-dashboard-redesign-7508c0`.
- O hook GateGuard desta máquina pode bloquear o primeiro Bash da sessão e a primeira criação ou edição de cada arquivo, pedindo "fatos" (quem importa o arquivo, API afetada, dados, instrução do usuário). Responda os fatos em texto e repita a mesma operação.
- UI nova segue o `CLAUDE.md`: `cn()` para classe condicional, tokens semânticos (`bg-card`, `text-muted-foreground`, `border-border`), `flex gap-*` no lugar de `space-*`, `size-N` no lugar de `w-N h-N`, ramp laranja sempre com sufixo (`accent-500`).
- Todo texto de interface em português do Brasil, sem travessão no meio de frase e sem emoji. Os textos finais estão no README do handoff, §7.
- Datas: todo cálculo em horário local. Chave de mês `'YYYY-MM'`, chave de dia `'YYYY-MM-DD'`.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/operacional/month.js` (novo) | chaves de mês, janelas, corte pró-rata, dias de meta, opções de comparação, rótulos |
| `src/lib/operacional/base.js` (novo) | vigência por pessoa, ponte do mês, churn, cancelamentos, matrículas e upgrades por vendedor |
| `src/lib/operacional/renewal.js` (novo) | coorte de renovação, desfechos, quando renovou, taxa, motivos, marcos, a vencer |
| `src/lib/operacional/routine.js` (novo) | meta diária e calendário, prospecção (total e por dia), tarefas por tipo, atrasados agora |
| `src/lib/operacional/metrics.js` (novo) | `metricsOf`, diferenças, destaques e tendências |
| `src/lib/operacional/queries.js` (novo) | especificações das consultas por mês e busca com cache conferido por contagem |
| `src/hooks/useOperacionalSources.js` (novo) | carrega as fontes de cada mês e os leads da carteira |
| `src/lib/dailyGoalHistory.js` (novo) | monta e grava o doc do dia de meta batida (extraído do `DailyGoalView`) |
| `src/lib/renewalGoal.js` (alterado) | `renewalDecline` passa a gravar motivo e data |
| `src/modals/RenewalOutcomeModal.jsx` (alterado) | motivo de "não vai renovar" vira lista fixa |
| `src/views/DailyGoalView.jsx` (alterado) | usa `recordGoalHit` da lib |
| `src/App.jsx` (alterado) | grava o dia batido de qualquer tela; props iguais para todos no Operacional |
| `firestore.rules` (alterado) | histórico de metas legível por qualquer membro |
| `src/components/ui/checkbox.jsx` (novo, via shadcn) | caixa "Comparar" |
| `src/views/dashboard/OperacionalToolbar.jsx` (novo) | barra fixa de controles |
| `src/views/dashboard/DashSummaryBand.jsx` (novo) | faixa de 5 números num objeto só |
| `src/views/dashboard/DashHighlights.jsx` (novo) | 3 destaques do mês |
| `src/views/dashboard/ChartMark.jsx` (novo) | marca de gráfico focável com dica do shadcn |
| `src/views/dashboard/ProspectionByDay.jsx` (novo) | colunas por dia com linha de alvo |
| `src/views/dashboard/MetaDaysCalendar.jsx` (novo) | régua de dias de meta |
| `src/views/dashboard/BaseBridge.jsx` (novo) | ponte do movimento da base |
| `src/views/dashboard/RenewalOutcomeBar.jsx` (novo) | barra de desfecho e "quando renovou" |
| `src/views/dashboard/MilestoneBars.jsx` (novo) | contatos nos marcos |
| `src/views/dashboard/TeamMonthTable.jsx` (novo) | tabela da equipe no mês |
| `src/views/dashboard/DashboardOperacionalView.jsx` (reescrito) | monta a tela |
| `src/lib/dashboardMetrics.js`, `src/views/dashboard/DashPrimitives.jsx`, `src/components/ui/LeadListPanel.jsx` (limpeza) | saem as peças que só a tela antiga usava |
| Testes em `src/lib/__tests__/` | `operacional.month.test.js`, `operacional.base.test.js`, `operacional.renewal.test.js`, `operacional.routine.test.js`, `operacional.metrics.test.js`, `operacional.queries.test.js`, `dailyGoalHistory.test.js` |

---

### Task 0: Preparação

**Files:**
- Create: `src/components/ui/checkbox.jsx` (gerado pelo shadcn)
- Commit: especificação, prompt e handoff já escritos em `docs/superpowers/specs/`

- [ ] **Step 1: Conferir a base**

Run: `git status --short && git rev-list --count HEAD..origin/main`
Expected: só os arquivos de `docs/superpowers/` como não rastreados, e `0` commits atrás da main. Se estiver atrás, rode `git merge origin/main` antes de seguir.

- [ ] **Step 2: Instalar as dependências e rodar a suíte inteira como linha de base**

Run: `npm install && npm test`
Expected: todos os testes passam. Anote o total (a suíte tinha perto de 1100 testes em 2026-09-11).

- [ ] **Step 3: Adicionar o checkbox do shadcn**

Run: `npx shadcn@latest add checkbox`
Expected: cria `src/components/ui/checkbox.jsx` e não altera outros arquivos além do `package.json`/`package-lock.json` se precisar de dependência nova. Se o CLI perguntar sobre sobrescrever arquivos, responda não.

- [ ] **Step 4: Commit dos documentos e do checkbox**

```bash
git add docs/superpowers/specs/2026-09-11-operacional-mensal-design.md docs/superpowers/specs/2026-09-11-operacional-prompt-claude-design.md docs/superpowers/specs/handoff-operacional/ docs/superpowers/plans/2026-09-11-operacional-mensal.md src/components/ui/checkbox.jsx package.json package-lock.json
git commit -m "docs: especificação, handoff e plano do Operacional por competência" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 1: Meses de competência (`month.js`)

**Files:**
- Create: `src/lib/operacional/month.js`
- Test: `src/lib/__tests__/operacional.month.test.js`

- [ ] **Step 1: Escrever o teste que falha**

```js
import { describe, it, expect } from 'vitest';
import {
  dayKeyOf, monthKeyOf, monthRange, addMonthsToKey, isCurrentMonthKey,
  effectiveEnd, comparisonCut, metaDaysOfMonth, compareOptions, monthLabel
} from '../operacional/month.js';

const NOW = new Date(2026, 8, 11, 14, 0); // 11/09/2026 14:00, sexta
const WEEKDAYS = [1, 2, 3, 4, 5];

describe('month.js', () => {
  it('monta chaves de dia e de mês no horário local', () => {
    expect(dayKeyOf(new Date(2026, 8, 1, 0, 30))).toBe('2026-09-01');
    expect(monthKeyOf(NOW)).toBe('2026-09');
  });

  it('janela do mês é [dia 1, dia 1 do mês seguinte)', () => {
    const { start, end } = monthRange('2026-09');
    expect(start).toEqual(new Date(2026, 8, 1));
    expect(end).toEqual(new Date(2026, 9, 1));
  });

  it('anda meses atravessando o ano', () => {
    expect(addMonthsToKey('2026-01', -1)).toBe('2025-12');
    expect(addMonthsToKey('2025-12', 1)).toBe('2026-01');
  });

  it('fim efetivo é agora no mês em andamento e o fim do mês nos fechados', () => {
    expect(isCurrentMonthKey('2026-09', NOW)).toBe(true);
    expect(effectiveEnd('2026-09', NOW)).toEqual(NOW);
    expect(effectiveEnd('2026-08', NOW)).toEqual(new Date(2026, 8, 1));
  });

  it('corte pró-rata anda o mesmo tempo no mês comparado', () => {
    expect(comparisonCut('2026-09', '2026-08', NOW)).toEqual(new Date(2026, 7, 11, 14, 0));
  });

  it('corte pró-rata não passa do fim do mês comparado', () => {
    const now = new Date(2026, 2, 31, 12, 0); // 31/03
    expect(comparisonCut('2026-03', '2026-02', now)).toEqual(new Date(2026, 2, 1));
  });

  it('mês exibido fechado compara com o mês inteiro', () => {
    expect(comparisonCut('2026-08', '2026-07', NOW)).toEqual(new Date(2026, 7, 1));
  });

  it('dias de meta de setembro/2026: 22 dias, 8 fechados, hoje é o dia 11', () => {
    const days = metaDaysOfMonth('2026-09', WEEKDAYS, NOW);
    expect(days).toHaveLength(22);
    expect(days.filter((d) => d.state === 'closed').map((d) => d.day)).toEqual([1, 2, 3, 4, 7, 8, 9, 10]);
    expect(days.find((d) => d.state === 'today').day).toBe(11);
    expect(days[0]).toMatchObject({ key: '2026-09-01', weekday: 2 });
  });

  it('opções de comparação: 12 meses para trás, com o mesmo mês do ano anterior', () => {
    const opts = compareOptions('2026-09');
    expect(opts[0]).toBe('2026-08');
    expect(opts).toContain('2025-09');
    expect(opts).toHaveLength(12);
  });

  it('rótulo do mês em português', () => {
    expect(monthLabel('2026-09')).toBe('Setembro 2026');
    expect(monthLabel('2026-08', { capitalized: false, withYear: false })).toBe('agosto');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/operacional.month.test.js`
Expected: FAIL com "Failed to resolve import ../operacional/month.js".

- [ ] **Step 3: Implementar**

```js
// Meses de competência do Operacional. Chave 'YYYY-MM', janelas [início, fim)
// em horário local e o corte pró-rata do mês comparado. Funções puras.

const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const pad = (n) => String(n).padStart(2, '0');

export const dayKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const monthKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export function parseMonthKey(key) {
  const [year, month] = String(key).split('-').map(Number);
  return { year, monthIndex: month - 1 };
}

export function monthRange(key) {
  const { year, monthIndex } = parseMonthKey(key);
  return { start: new Date(year, monthIndex, 1), end: new Date(year, monthIndex + 1, 1) };
}

export function addMonthsToKey(key, n) {
  const { year, monthIndex } = parseMonthKey(key);
  return monthKeyOf(new Date(year, monthIndex + n, 1));
}

export const isCurrentMonthKey = (key, now) => key === monthKeyOf(now);

// Agora, no mês em andamento; o fim do mês, nos fechados.
export function effectiveEnd(key, now) {
  const { end } = monthRange(key);
  return isCurrentMonthKey(key, now) && now < end ? now : end;
}

// O mês comparado anda o mesmo tempo que o exibido já andou (dia 11 às 14h
// contra dia 11 às 14h do outro mês). Mês exibido fechado compara inteiro.
export function comparisonCut(shownKey, compareKey, now) {
  const cmp = monthRange(compareKey);
  if (!isCurrentMonthKey(shownKey, now)) return cmp.end;
  const elapsed = Math.max(0, now.getTime() - monthRange(shownKey).start.getTime());
  return new Date(Math.min(cmp.start.getTime() + elapsed, cmp.end.getTime()));
}

// Dias de meta do mês (metaWeekdays: 0 = domingo ... 6 = sábado) com o estado
// em relação ao corte: 'closed' (acabou antes), 'today' (o corte cai nele) ou
// 'future'. Fim de semana fora da meta nunca aparece e nunca conta como falha.
export function metaDaysOfMonth(key, metaWeekdays, cutEnd) {
  const { start, end } = monthRange(key);
  const out = [];
  for (let d = new Date(start); d < end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    if (!(metaWeekdays || []).includes(d.getDay())) continue;
    const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    const state = dayEnd <= cutEnd ? 'closed' : d < cutEnd ? 'today' : 'future';
    out.push({ key: dayKeyOf(d), day: d.getDate(), weekday: d.getDay(), start: new Date(d), end: dayEnd, state });
  }
  return out;
}

// "Comparar com": os 12 meses anteriores (o 12º é o mesmo mês do ano anterior).
export function compareOptions(shownKey, maxBack = 12) {
  const opts = [];
  for (let i = 1; i <= maxBack; i++) opts.push(addMonthsToKey(shownKey, -i));
  const lastYear = addMonthsToKey(shownKey, -12);
  if (!opts.includes(lastYear)) opts.push(lastYear);
  return opts;
}

export function monthLabel(key, { capitalized = true, withYear = true } = {}) {
  const { year, monthIndex } = parseMonthKey(key);
  const name = MONTH_NAMES[monthIndex];
  const txt = capitalized ? name[0].toUpperCase() + name.slice(1) : name;
  return withYear ? `${txt} ${year}` : txt;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/operacional.month.test.js`
Expected: PASS (10 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/operacional/month.js src/lib/__tests__/operacional.month.test.js
git commit -m "feat: meses de competência do Operacional" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Base de clientes (`base.js`)

Regras (especificação §5.5): cliente vigente em t, ponte por transição de estado (fecha sempre), churn por saída definitiva, cancelamentos por motivo, matrículas e upgrades por vendedor. Importado nunca conta como matrícula, retorno, cancelamento ou trancamento.

**Files:**
- Create: `src/lib/operacional/base.js`
- Test: `src/lib/__tests__/operacional.base.test.js`

- [ ] **Step 1: Escrever o teste que falha**

```js
import { describe, it, expect } from 'vitest';
import {
  normalizeContract, contractStateAt, countActiveAt, countLockedAt,
  computeBaseMovement, computeChurn, cancellationsByReason, salesInWindow
} from '../operacional/base.js';

const D = (y, m, d, h = 12) => new Date(y, m - 1, d, h);
const C = (id, over = {}) => normalizeContract({
  id, leadId: id, consultantId: 'ana', status: 'ativo',
  startsAt: D(2026, 1, 1), endsAt: D(2027, 1, 1), createdAt: over.startsAt || D(2026, 1, 1),
  ...over
});
const SEP = { start: new Date(2026, 8, 1), end: new Date(2026, 9, 1), graceDays: 15 };

describe('contractStateAt', () => {
  it('vigente dentro da vigência, nada fora dela', () => {
    const c = C('a', { startsAt: D(2026, 8, 1), endsAt: D(2026, 11, 1) });
    expect(contractStateAt(c, D(2026, 9, 5))).toBe('vigente');
    expect(contractStateAt(c, D(2026, 7, 31))).toBe(null);
    expect(contractStateAt(c, D(2026, 11, 2))).toBe(null);
  });

  it('trancado entre a pausa e a reativação', () => {
    const c = C('a', { pausedAt: D(2026, 9, 3), resumedAt: D(2026, 9, 20) });
    expect(contractStateAt(c, D(2026, 9, 10))).toBe('trancado');
    expect(contractStateAt(c, D(2026, 9, 21))).toBe('vigente');
  });

  it('pausa atual depois de uma reativação antiga continua trancada', () => {
    const c = C('a', { resumedAt: D(2026, 5, 1), pausedAt: D(2026, 9, 3) });
    expect(contractStateAt(c, D(2026, 9, 10))).toBe('trancado');
  });

  it('cancelado deixa de valer no cancelamento', () => {
    const c = C('a', { status: 'cancelado', cancelledAt: D(2026, 9, 10) });
    expect(contractStateAt(c, D(2026, 9, 9))).toBe('vigente');
    expect(contractStateAt(c, D(2026, 9, 11))).toBe(null);
  });
});

describe('contagem por pessoa', () => {
  it('dois contratos do mesmo lead contam uma pessoa', () => {
    const list = [C('c1', { leadId: 'L' }), C('c2', { leadId: 'L', startsAt: D(2026, 2, 1) })];
    expect(countActiveAt(list, D(2026, 9, 1))).toBe(1);
  });

  it('trancado conta à parte', () => {
    const list = [C('a'), C('b', { pausedAt: D(2026, 8, 1) })];
    expect(countActiveAt(list, D(2026, 9, 1))).toBe(1);
    expect(countLockedAt(list, D(2026, 9, 1))).toBe(1);
  });
});

describe('computeBaseMovement (ponte do mês)', () => {
  const contracts = [
    C('fica'),                                                                              // vigente o mês todo
    C('novo', { startsAt: D(2026, 9, 5), createdAt: D(2026, 9, 5), endsAt: D(2026, 12, 5) }), // primeira matrícula
    C('volta-antigo', { leadId: 'V', startsAt: D(2026, 1, 1), endsAt: D(2026, 6, 1) }),
    C('volta-novo', { leadId: 'V', startsAt: D(2026, 9, 10), createdAt: D(2026, 9, 10), endsAt: D(2026, 12, 10) }),
    C('cancela', { status: 'cancelado', cancelledAt: D(2026, 9, 15), cancelReason: 'Financeiro' }),
    C('vence', { endsAt: D(2026, 9, 20) }),
    C('tranca', { pausedAt: D(2026, 9, 12) }),
    C('destranca', { pausedAt: D(2026, 8, 1), resumedAt: D(2026, 9, 8) })
  ];

  it('classifica cada pessoa que mudou de lado', () => {
    const r = computeBaseMovement(contracts, SEP);
    expect(r.steps).toEqual({ entraram: 1, voltaram: 1, cancelaram: 1, venceram: 1, trancamentos: 0 });
    expect(r.trancaram).toBe(1);
    expect(r.destrancaram).toBe(1);
  });

  it('a conta fecha: início + passos = fim', () => {
    const r = computeBaseMovement(contracts, SEP);
    const s = r.steps;
    expect(r.startCount + s.entraram + s.voltaram - s.cancelaram - s.venceram + s.trancamentos).toBe(r.endCount);
    expect(r.endCount).toBe(countActiveAt(contracts, new Date(SEP.end.getTime() - 1)));
  });

  it('cancelamento de contrato importado sai como vencido, nunca como cancelamento', () => {
    const list = [C('imp', { status: 'cancelado', cancelledAt: D(2026, 9, 15), importBatchId: 'lote-1' })];
    expect(computeBaseMovement(list, SEP).steps).toMatchObject({ cancelaram: 0, venceram: 1 });
  });
});

describe('computeChurn', () => {
  it('conta cancelamento no mês e vencido que passou da tolerância no mês', () => {
    const list = [
      C('base1'), C('base2'), C('base3'), C('base4'),
      C('cancela', { status: 'cancelado', cancelledAt: D(2026, 9, 15) }),
      C('vence-agosto', { endsAt: D(2026, 8, 25) }),                    // tolerância acaba em 09/09
      C('vence-setembro', { endsAt: D(2026, 9, 25) }),                  // tolerância acaba em outubro
      C('voltou-antigo', { leadId: 'R', endsAt: D(2026, 8, 20) }),
      C('voltou-novo', { leadId: 'R', startsAt: D(2026, 8, 28), createdAt: D(2026, 8, 28), endsAt: D(2026, 11, 28) })
    ];
    const r = computeChurn(list, SEP);
    expect(r.exits).toBe(2);
    expect(r.base).toBe(countActiveAt(list, SEP.start));
    expect(r.pct).toBe(Math.round((2 / r.base) * 1000) / 10);
  });
});

describe('cancellationsByReason', () => {
  it('agrupa por motivo, sem importados, "Outro" quando falta motivo', () => {
    const list = [
      C('a', { status: 'cancelado', cancelledAt: D(2026, 9, 3), cancelReason: 'Financeiro' }),
      C('b', { status: 'cancelado', cancelledAt: D(2026, 9, 4), cancelReason: 'Financeiro' }),
      C('c', { status: 'cancelado', cancelledAt: D(2026, 9, 5) }),
      C('d', { status: 'cancelado', cancelledAt: D(2026, 9, 6), cancelReason: 'Financeiro', importSource: 'NextFit' }),
      C('e', { status: 'cancelado', cancelledAt: D(2026, 8, 6), cancelReason: 'Financeiro' })
    ];
    expect(cancellationsByReason(list, SEP)).toEqual({
      total: 3,
      items: [{ name: 'Financeiro', count: 2 }, { name: 'Outro', count: 1 }]
    });
  });
});

describe('salesInWindow', () => {
  it('matrícula só na primeira vez da pessoa; upgrade por vendedor; importado nunca', () => {
    const list = [
      C('primeira', { consultantId: 'ana', startsAt: D(2026, 9, 2), createdAt: D(2026, 9, 2) }),
      C('antiga', { leadId: 'X', consultantId: 'diego', createdAt: D(2026, 2, 1) }),
      C('rematricula', { leadId: 'X', consultantId: 'diego', startsAt: D(2026, 9, 3), createdAt: D(2026, 9, 3) }),
      C('renova', { consultantId: 'diego', renewedFromId: 'antiga', createdAt: D(2026, 9, 4) }),
      C('upgrade', { consultantId: 'ana', renewedFromId: 'y', closedFromUpgrade: true, createdAt: D(2026, 9, 5) }),
      C('importado', { consultantId: 'ana', createdAt: D(2026, 9, 6), importBatchId: 'lote' })
    ];
    const r = salesInWindow(list, SEP);
    expect(Object.fromEntries(r.entered)).toEqual({ ana: 1 });
    expect(Object.fromEntries(r.upgrades)).toEqual({ ana: 1 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/operacional.base.test.js`
Expected: FAIL com "Failed to resolve import ../operacional/base.js".

- [ ] **Step 3: Implementar**

```js
// Base de clientes a partir de stronix_contratos (coleção inteira, já em
// memória). Vigência por pessoa num instante, ponte do mês por transição de
// estado (fecha por construção), churn por saída definitiva, cancelamentos por
// motivo, matrículas e upgrades por vendedor. Importado de planilha entra na
// base, mas nunca conta como matrícula, retorno, cancelamento ou trancamento.

import { getSafeDateOrNull } from '../dates.js';

const DAY_MS = 86400000;

export function normalizeContract(c) {
  const d = (v) => getSafeDateOrNull(v);
  const endsAt = d(c.endsAt);
  return {
    ...c,
    startsAt: d(c.startsAt),
    endsAt,
    createdAt: d(c.createdAt),
    // Cancelado sem data (legado): trata como encerrado no fim, sem efeito na ponte.
    cancelledAt: d(c.cancelledAt) || (c.status === 'cancelado' ? endsAt : null),
    pausedAt: d(c.pausedAt),
    resumedAt: d(c.resumedAt),
    imported: Boolean(c.importBatchId || c.importSource || c.importedBy),
    personKey: c.leadId || `contrato:${c.id}`
  };
}

// 'vigente' | 'trancado' | null no instante t.
export function contractStateAt(c, t) {
  if (!c.startsAt || !c.endsAt) return null;
  if (t < c.startsAt || t >= c.endsAt) return null;
  if (c.cancelledAt && c.cancelledAt <= t) return null;
  const paused = c.pausedAt && c.pausedAt <= t && (!c.resumedAt || c.resumedAt < c.pausedAt || c.resumedAt > t);
  return paused ? 'trancado' : 'vigente';
}

// Estado de cada pessoa no instante t: vigente vence trancado.
export function personStatesAt(contracts, t) {
  const map = new Map();
  (contracts || []).forEach((c) => {
    const s = contractStateAt(c, t);
    if (!s) return;
    if (s === 'vigente' || !map.has(c.personKey)) map.set(c.personKey, s);
  });
  return map;
}

const vigentSet = (states) => new Set([...states].filter(([, s]) => s === 'vigente').map(([k]) => k));

export const countActiveAt = (contracts, t) => vigentSet(personStatesAt(contracts, t)).size;

export const countLockedAt = (contracts, t) =>
  [...personStatesAt(contracts, t).values()].filter((s) => s === 'trancado').length;

const firstMoment = (c) => c.createdAt || c.startsAt;

export function contractsByPerson(contracts) {
  const m = new Map();
  (contracts || []).forEach((c) => {
    const arr = m.get(c.personKey);
    if (arr) arr.push(c); else m.set(c.personKey, [c]);
  });
  m.forEach((arr) => arr.sort((a, b) => (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0)));
  return m;
}

// Ponte do mês: A = vigentes no início, B = vigentes no fim efetivo. Quem muda de
// lado ganha um motivo, então início + passos = fim sempre.
export function computeBaseMovement(contracts, { start, end }) {
  const tEnd = new Date(end.getTime() - 1);
  const A = personStatesAt(contracts, start);
  const B = personStatesAt(contracts, tEnd);
  const vA = vigentSet(A);
  const vB = vigentSet(B);
  const people = contractsByPerson(contracts);
  const n = { entraram: 0, voltaram: 0, cancelaram: 0, venceram: 0, trancaram: 0, destrancaram: 0 };

  vB.forEach((key) => {
    if (vA.has(key)) return;
    if (A.get(key) === 'trancado') { n.destrancaram += 1; return; }
    const list = people.get(key) || [];
    const current = list.find((c) => contractStateAt(c, tEnd) === 'vigente');
    const hadBefore = list.some((c) => c !== current && c.startsAt && current?.startsAt && c.startsAt < current.startsAt);
    if (hadBefore) n.voltaram += 1; else n.entraram += 1;
  });

  vA.forEach((key) => {
    if (vB.has(key)) return;
    if (B.get(key) === 'trancado') { n.trancaram += 1; return; }
    const list = people.get(key) || [];
    const cancelledHere = list.some((c) => !c.imported && c.cancelledAt && c.cancelledAt >= start && c.cancelledAt < end);
    if (cancelledHere) n.cancelaram += 1; else n.venceram += 1;
  });

  return {
    startCount: vA.size,
    endCount: vB.size,
    steps: {
      entraram: n.entraram,
      voltaram: n.voltaram,
      cancelaram: n.cancelaram,
      venceram: n.venceram,
      trancamentos: n.destrancaram - n.trancaram
    },
    trancaram: n.trancaram,
    destrancaram: n.destrancaram
  };
}

// Saída definitiva no mês: cancelamento sem outro contrato vigente logo depois,
// ou fim da tolerância de um contrato vencido sem retorno. ÷ vigentes no início.
export function computeChurn(contracts, { start, end, graceDays }) {
  const graceMs = (Number(graceDays) || 0) * DAY_MS;
  const vigentAt = (list, t) => list.some((c) => contractStateAt(c, t) === 'vigente');
  let exits = 0;
  contractsByPerson(contracts).forEach((list) => {
    const hit = list.some((c) => {
      if (c.cancelledAt && !c.imported && c.endsAt && c.cancelledAt < c.endsAt) {
        return c.cancelledAt >= start && c.cancelledAt < end && !vigentAt(list, c.cancelledAt);
      }
      if (!c.endsAt) return false;
      const x = new Date(c.endsAt.getTime() + graceMs);
      if (x < start || x >= end) return false;
      const returned = list.some((o) => o !== c && o.startsAt && o.startsAt >= c.endsAt && o.startsAt <= x);
      return !returned && !vigentAt(list, x);
    });
    if (hit) exits += 1;
  });
  const base = countActiveAt(contracts, start);
  return { exits, base, pct: base > 0 ? Math.round((exits / base) * 1000) / 10 : null };
}

const sortItems = (map) => [...map].map(([name, count]) => ({ name, count }))
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

export function cancellationsByReason(contracts, { start, end }) {
  const map = new Map();
  (contracts || []).forEach((c) => {
    if (c.imported || !c.cancelledAt || c.cancelledAt < start || c.cancelledAt >= end) return;
    const name = c.cancelReason || 'Outro';
    map.set(name, (map.get(name) || 0) + 1);
  });
  const items = sortItems(map);
  return { total: items.reduce((s, r) => s + r.count, 0), items };
}

// Matrículas (primeiro contrato da pessoa) e upgrades do mês, por vendedor: o
// consultor gravado no contrato, o mesmo nome da comissão.
export function salesInWindow(contracts, { start, end }) {
  const people = contractsByPerson(contracts);
  const entered = new Map();
  const upgrades = new Map();
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  (contracts || []).forEach((c) => {
    const t = firstMoment(c);
    if (c.imported || !t || t < start || t >= end) return;
    const seller = c.consultantId || 'sem-consultor';
    if (c.closedFromUpgrade) bump(upgrades, seller);
    if (!c.renewedFromId) {
      const earlier = (people.get(c.personKey) || []).some((o) => o !== c && firstMoment(o) && firstMoment(o) < t);
      if (!earlier) bump(entered, seller);
    }
  });
  return { entered, upgrades };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/operacional.base.test.js`
Expected: PASS. Se o teste da ponte falhar, confira primeiro a classificação de cada pessoa com um `console.table` temporário; a invariante `início + passos = fim` não pode quebrar.

- [ ] **Step 5: Commit**

```bash
git add src/lib/operacional/base.js src/lib/__tests__/operacional.base.test.js
git commit -m "feat: base de clientes do Operacional (ponte, churn, cancelamentos, vendas)" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Renovação (`renewal.js`)

Regras (especificação §5.6 a §5.8): coorte = contratos com fim no mês (inclui importados), exceto os cancelados antes do fim. Desfecho por contrato. Taxa = renovados ÷ contratos com desfecho (no mês fechado, isso é a coorte inteira). A carteira é do responsável atual pelo cliente (doc do lead), com o consultor do contrato como reserva. "Não vai renovar" lê o lead (`renewalDeclined`, `renewalDeclinedAt`, `renewalDeclineReason`) e só vale para o contrato mais recente da pessoa; sem motivo gravado, entra como "Outro".

**Files:**
- Create: `src/lib/operacional/renewal.js`
- Test: `src/lib/__tests__/operacional.renewal.test.js`

- [ ] **Step 1: Escrever o teste que falha**

```js
import { describe, it, expect } from 'vitest';
import { normalizeContract } from '../operacional/base.js';
import { ownerOf, renewalCohort, summarizeCohort, milestones, upcomingExpirations } from '../operacional/renewal.js';

const D = (y, m, d, h = 12) => new Date(y, m - 1, d, h);
const C = (id, over = {}) => normalizeContract({
  id, leadId: id, consultantId: 'ana', status: 'ativo',
  startsAt: D(2026, 3, 1), endsAt: D(2026, 9, 20), createdAt: D(2026, 3, 1), ...over
});
const SEP = { start: new Date(2026, 8, 1), end: new Date(2026, 9, 1), graceDays: 15 };

describe('renewalCohort', () => {
  const contracts = [
    C('antes'), C('antes-r', { leadId: 'antes', renewedFromId: 'antes', startsAt: D(2026, 9, 20), endsAt: D(2027, 3, 20), createdAt: D(2026, 9, 5) }),
    C('dia'), C('dia-r', { leadId: 'dia', renewedFromId: 'dia', startsAt: D(2026, 9, 20), endsAt: D(2027, 3, 20), createdAt: D(2026, 9, 20, 18) }),
    C('depois'), C('depois-r', { leadId: 'depois', startsAt: D(2026, 9, 25), endsAt: D(2027, 3, 25), createdAt: D(2026, 9, 25) }),
    C('nao'),
    C('venceu', { endsAt: D(2026, 9, 5) }),
    C('pendente', { endsAt: D(2026, 9, 28) }),
    C('cancelado', { status: 'cancelado', cancelledAt: D(2026, 9, 2) })
  ];
  const leadsById = new Map([
    ['nao', { id: 'nao', consultantId: 'diego', renewalDeclined: true, renewalDeclineReason: 'Financeiro' }],
    ['venceu', { id: 'venceu', consultantId: 'ana' }]
  ]);
  const rows = renewalCohort(contracts, { ...SEP, asOf: D(2026, 9, 26), leadsById });
  const byId = Object.fromEntries(rows.map((r) => [r.contract.id, r]));

  it('fica fora quem foi cancelado antes do fim', () => {
    expect(byId.cancelado).toBeUndefined();
    expect(rows).toHaveLength(6);
  });

  it('classifica desfecho e quando renovou', () => {
    expect(byId.antes).toMatchObject({ outcome: 'renew', when: 'antes' });
    expect(byId.dia).toMatchObject({ outcome: 'renew', when: 'no' });
    expect(byId.depois).toMatchObject({ outcome: 'renew', when: 'depois' });
    expect(byId.nao).toMatchObject({ outcome: 'wont', reason: 'Financeiro', owner: 'diego' });
    expect(byId.venceu.outcome).toBe('lapsed');
    expect(byId.pendente.outcome).toBe('pending');
  });

  it('declínio sem motivo vira "Outro"; declínio depois do corte ainda não vale', () => {
    const list = [C('x', { endsAt: D(2026, 9, 5) })];
    const legacy = new Map([['x', { id: 'x', renewalDeclined: true }]]);
    expect(renewalCohort(list, { ...SEP, asOf: D(2026, 9, 26), leadsById: legacy })[0]).toMatchObject({ outcome: 'wont', reason: 'Outro' });
    const later = new Map([['x', { id: 'x', renewalDeclined: true, renewalDeclinedAt: D(2026, 9, 27) }]]);
    expect(renewalCohort(list, { ...SEP, asOf: D(2026, 9, 26), leadsById: later })[0].outcome).toBe('lapsed');
  });

  it('declínio do lead não vale para um contrato que não é o mais recente', () => {
    const list = [
      C('velho', { leadId: 'P', endsAt: D(2026, 9, 5) }),
      C('novo', { leadId: 'P', startsAt: D(2026, 12, 1), endsAt: D(2027, 6, 1), createdAt: D(2026, 12, 1) })
    ];
    const leads = new Map([['P', { id: 'P', renewalDeclined: true }]]);
    expect(renewalCohort(list, { ...SEP, asOf: D(2026, 9, 26), leadsById: leads })[0].outcome).toBe('lapsed');
  });
});

describe('summarizeCohort', () => {
  it('taxa = renovados ÷ com desfecho; filtro por responsável atual', () => {
    const rows = [
      { owner: 'ana', outcome: 'renew', when: 'antes', reason: null },
      { owner: 'ana', outcome: 'renew', when: 'depois', reason: null },
      { owner: 'ana', outcome: 'lapsed', when: null, reason: null },
      { owner: 'ana', outcome: 'pending', when: null, reason: null },
      { owner: 'diego', outcome: 'wont', when: null, reason: 'Financeiro' }
    ];
    const team = summarizeCohort(rows);
    expect(team).toMatchObject({ cohort: 5, decided: 4, rate: 50, counts: { renew: 2, wont: 1, lapsed: 1, pending: 1 }, when: { antes: 1, no: 0, depois: 1 } });
    expect(team.wontReasons).toEqual({ total: 1, items: [{ name: 'Financeiro', count: 1 }] });
    expect(summarizeCohort(rows, { owner: 'ana' })).toMatchObject({ cohort: 4, decided: 3, rate: 67 });
  });

  it('sem desfecho a taxa é nula', () => {
    expect(summarizeCohort([]).rate).toBe(null);
  });
});

describe('ownerOf', () => {
  it('responsável atual do lead vence o consultor do contrato', () => {
    const c = C('z', { consultantId: 'ana' });
    expect(ownerOf(c, new Map([['z', { consultantId: 'larissa' }]]))).toBe('larissa');
    expect(ownerOf(c, new Map())).toBe('ana');
  });
});

describe('milestones', () => {
  it('conta quem cruzou o marco no mês e quem teve contato de renovação até o próximo marco', () => {
    const contracts = [
      C('m1', { endsAt: D(2026, 10, 20) }),  // marco de 30 dias em 20/09
      C('m2', { endsAt: D(2026, 10, 25) }),  // marco de 30 dias em 25/09, sem contato
      C('m3', { endsAt: D(2026, 10, 22) }),  // renovou antes do marco: fica fora
      C('m3-r', { leadId: 'm3', renewedFromId: 'm3', startsAt: D(2026, 10, 22), endsAt: D(2027, 4, 22), createdAt: D(2026, 9, 1) })
    ];
    const interactions = [
      { type: 'daily_goal_done', dailyGoalCategory: 'renovacao', leadId: 'm1', createdAt: D(2026, 9, 22) }
    ];
    const r = milestones(contracts, { start: SEP.start, end: SEP.end, checkpoints: [90, 60, 30], interactions, leadsById: new Map() });
    const m30 = r.find((m) => m.days === 30);
    expect(m30).toEqual({ days: 30, total: 2, done: 1, pct: 50 });
    expect(r.map((m) => m.days)).toEqual([90, 60, 30]);
  });
});

describe('upcomingExpirations', () => {
  it('faixas sem sobreposição a partir de agora, só o contrato mais recente da pessoa', () => {
    const now = D(2026, 9, 11);
    const contracts = [
      C('a', { endsAt: D(2026, 9, 30) }),
      C('b', { endsAt: D(2026, 11, 1) }),
      C('c', { endsAt: D(2026, 11, 30) }),
      C('d', { endsAt: D(2027, 3, 1) }),
      C('e', { endsAt: D(2026, 9, 25) }),
      C('e-r', { leadId: 'e', renewedFromId: 'e', startsAt: D(2026, 9, 25), endsAt: D(2027, 3, 25), createdAt: D(2026, 9, 2) })
    ];
    expect(upcomingExpirations(contracts, { now, leadsById: new Map() })).toEqual({ d30: 1, d60: 1, d90: 1 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/operacional.renewal.test.js`
Expected: FAIL com "Failed to resolve import ../operacional/renewal.js".

- [ ] **Step 3: Implementar**

```js
// Renovação a partir dos contratos: coorte do mês (fim da vigência no mês),
// desfecho de cada contrato, quando renovou, taxa, motivos de quem não vai
// renovar, contatos nos marcos e a vencer. A carteira é do responsável ATUAL
// pelo cliente (doc do lead); sem o doc, vale o consultor do contrato.

import { getSafeDateOrNull } from '../dates.js';
import { contractStateAt } from './base.js';
import { dayKeyOf } from './month.js';

const DAY_MS = 86400000;
const OTHER_REASON = 'Outro';

export function ownerOf(contract, leadsById) {
  return leadsById?.get(contract.leadId)?.consultantId || contract.consultantId || 'sem-consultor';
}

const isLatestOfPerson = (c, contracts) =>
  !contracts.some((o) => o !== c && o.personKey === c.personKey && o.startsAt && c.startsAt && o.startsAt > c.startsAt);

// Sucessor = renovação ligada (renewedFromId) ou outro contrato da mesma pessoa
// criado até o fim + tolerância (cobre a reativação feita pela ficha, que nasce
// como matrícula). Só conta o que já existia no corte (asOf).
function successorOf(c, contracts, graceMs, asOf) {
  const limit = c.endsAt ? c.endsAt.getTime() + graceMs : null;
  const cands = contracts.filter((o) => {
    if (o === c || !o.createdAt || o.createdAt > asOf) return false;
    if (o.renewedFromId === c.id) return true;
    return o.personKey === c.personKey && o.startsAt && c.startsAt && o.startsAt > c.startsAt
      && limit != null && o.createdAt.getTime() <= limit;
  });
  return cands.sort((a, b) => a.createdAt - b.createdAt)[0] || null;
}

function declineOf(c, contracts, leadsById, asOf) {
  const lead = leadsById?.get(c.leadId);
  if (!lead?.renewalDeclined || !isLatestOfPerson(c, contracts)) return null;
  const at = getSafeDateOrNull(lead.renewalDeclinedAt);
  if (at && at > asOf) return null;
  return { reason: lead.renewalDeclineReason || OTHER_REASON };
}

export function renewalCohort(contracts, { start, end, asOf, graceDays, leadsById }) {
  const graceMs = (Number(graceDays) || 0) * DAY_MS;
  const rows = [];
  (contracts || []).forEach((c) => {
    if (!c.endsAt || c.endsAt < start || c.endsAt >= end) return;
    if (c.cancelledAt && c.cancelledAt < c.endsAt) return;
    const s = successorOf(c, contracts, graceMs, asOf);
    let outcome;
    let when = null;
    let reason = null;
    if (s) {
      outcome = 'renew';
      const sk = dayKeyOf(s.createdAt);
      const ek = dayKeyOf(c.endsAt);
      when = sk < ek ? 'antes' : sk === ek ? 'no' : 'depois';
    } else {
      const decline = declineOf(c, contracts, leadsById, asOf);
      if (decline) { outcome = 'wont'; reason = decline.reason; }
      else outcome = c.endsAt <= asOf ? 'lapsed' : 'pending';
    }
    rows.push({ contract: c, owner: ownerOf(c, leadsById), outcome, when, reason });
  });
  return rows;
}

export function summarizeCohort(rows, { owner = null } = {}) {
  const pick = owner ? rows.filter((r) => r.owner === owner) : rows;
  const counts = { renew: 0, wont: 0, lapsed: 0, pending: 0 };
  const when = { antes: 0, no: 0, depois: 0 };
  const reasons = new Map();
  pick.forEach((r) => {
    counts[r.outcome] += 1;
    if (r.when) when[r.when] += 1;
    if (r.reason) reasons.set(r.reason, (reasons.get(r.reason) || 0) + 1);
  });
  const decided = counts.renew + counts.wont + counts.lapsed;
  return {
    counts,
    when,
    cohort: pick.length,
    decided,
    rate: decided > 0 ? Math.round((counts.renew / decided) * 100) : null,
    wontReasons: {
      total: counts.wont,
      items: [...reasons].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    }
  };
}

// Marco C cruza em fim − C dias. Chegou ao marco no mês quem estava vigente e
// ainda sem renovação nesse dia. Feito = tarefa de renovação concluída (ou
// renovação) entre o cruzamento e o marco seguinte, dentro da janela do mês.
export function milestones(contracts, { start, end, checkpoints, interactions, leadsById, owner = null }) {
  const cps = [...new Set((checkpoints || []).map(Number).filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => b - a);
  const doneByLead = new Map();
  (interactions || []).forEach((i) => {
    if (i.type !== 'daily_goal_done' || i.dailyGoalCategory !== 'renovacao' || !(i.createdAt instanceof Date)) return;
    const arr = doneByLead.get(i.leadId);
    if (arr) arr.push(i.createdAt); else doneByLead.set(i.leadId, [i.createdAt]);
  });
  return cps.map((cp, idx) => {
    const next = cps[idx + 1];
    let total = 0;
    let done = 0;
    (contracts || []).forEach((c) => {
      if (!c.endsAt || (owner && ownerOf(c, leadsById) !== owner)) return;
      const x = new Date(c.endsAt.getTime() - cp * DAY_MS);
      if (x < start || x >= end || contractStateAt(c, x) !== 'vigente') return;
      if (contracts.some((o) => o.renewedFromId === c.id && o.createdAt && o.createdAt < x)) return;
      total += 1;
      const until = new Date(Math.min(next ? c.endsAt.getTime() - next * DAY_MS : c.endsAt.getTime(), end.getTime()));
      const contacted = (doneByLead.get(c.leadId) || []).some((t) => t >= x && t < until);
      const renewed = contracts.some((o) => o.renewedFromId === c.id && o.createdAt && o.createdAt >= x && o.createdAt < until);
      if (contacted || renewed) done += 1;
    });
    return { days: cp, total, done, pct: total > 0 ? Math.round((done / total) * 100) : null };
  });
}

// Contratos vigentes, sem o próximo já fechado, em faixas a partir de agora.
export function upcomingExpirations(contracts, { now, leadsById, owner = null }) {
  const buckets = { d30: 0, d60: 0, d90: 0 };
  (contracts || []).forEach((c) => {
    if (!c.endsAt || contractStateAt(c, now) !== 'vigente' || !isLatestOfPerson(c, contracts)) return;
    if (owner && ownerOf(c, leadsById) !== owner) return;
    const days = (c.endsAt.getTime() - now.getTime()) / DAY_MS;
    if (days <= 30) buckets.d30 += 1;
    else if (days <= 60) buckets.d60 += 1;
    else if (days <= 90) buckets.d90 += 1;
  });
  return buckets;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/operacional.renewal.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/operacional/renewal.js src/lib/__tests__/operacional.renewal.test.js
git commit -m "feat: renovação do Operacional (coorte, desfechos, marcos, a vencer)" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Rotina (`routine.js`)

Regras (especificação §5.1 a §5.4): dias de meta fechados e batidos pelo histórico; prospecção = leads criados (dono) + interações com `volumeKind` (quem fez), só em dias de meta, hoje parcial; tarefas por tipo pelo `daily_goal_done`, uma por lead, categoria e dia; atrasados agora com a mesma condição da categoria Atrasados da Meta (`src/lib/dailyGoal.js:368`).

**Files:**
- Create: `src/lib/operacional/routine.js`
- Test: `src/lib/__tests__/operacional.routine.test.js`

- [ ] **Step 1: Escrever o teste que falha**

```js
import { describe, it, expect } from 'vitest';
import { metaDaysOfMonth } from '../operacional/month.js';
import {
  TASK_ROWS, metaDaysSummary, pickMeta, metaCalendar,
  prospectionSummary, pickProspection, tasksByType, overdueNow
} from '../operacional/routine.js';

const NOW = new Date(2026, 8, 11, 14, 0);
const D = (d, h = 10) => new Date(2026, 8, d, h);
const USERS = [
  { id: 'ana', authUid: 'u-ana', name: 'Ana Ribeiro', dailyVolumeTarget: 10 },
  { id: 'marcos', authUid: 'u-marcos', name: 'Marcos Lima', dailyVolumeTarget: 0 }
];
const DAYS = metaDaysOfMonth('2026-09', [1, 2, 3, 4, 5], NOW);

describe('meta diária', () => {
  const history = [
    { consultantId: 'ana', date: '2026-09-01' },
    { consultantId: 'ana', date: '2026-09-02' },
    { consultantId: 'ana', date: '2026-09-11' },   // hoje: não entra na conta
    { consultantId: 'ana', date: '2026-08-31' },   // outro mês
    { consultantId: 'marcos', date: '2026-09-01' }
  ];
  const meta = metaDaysSummary({ users: USERS, history, metaDays: DAYS });

  it('conta só os dias fechados', () => {
    expect(meta.closedCount).toBe(8);
    expect(pickMeta(meta, 'ana')).toEqual({ done: 2, total: 8, pct: 25 });
  });

  it('equipe é a soma dos dias-pessoa', () => {
    expect(pickMeta(meta, null)).toEqual({ done: 3, total: 16, pct: 19 });
  });

  it('calendário diz quantos bateram e se a pessoa bateu', () => {
    const cal = metaCalendar({ metaDays: DAYS, hitsBy: meta.hitsBy, userId: 'ana' });
    expect(cal[0]).toMatchObject({ key: '2026-09-01', hits: 2, me: true, state: 'closed' });
    expect(cal.find((c) => c.day === 11)).toMatchObject({ state: 'today', me: true });
  });
});

describe('prospecção', () => {
  const leadsCreated = [
    { id: 'l1', consultantId: 'ana', createdAt: D(1) },
    { id: 'l1', consultantId: 'ana', createdAt: D(1) },            // duplicado: conta uma vez
    { id: 'l2', consultantId: 'ana', createdAt: D(5) },            // sábado: fora da meta
    { id: 'l3', consultantId: 'marcos', createdAt: D(2) }
  ];
  const interactions = [
    { volumeKind: 'mensagem', actorAuthUid: 'u-ana', createdAt: D(2) },
    { volumeKind: 'ligacao', leadConsultantAuthUid: 'u-ana', createdAt: D(11, 9) }, // hoje, sem ator: vale o dono do lead
    { volumeKind: null, actorAuthUid: 'u-ana', createdAt: D(2) },
    { volumeKind: 'visita', actorAuthUid: 'u-marcos', createdAt: D(3) }
  ];
  const summary = prospectionSummary({ users: USERS, interactions, leadsCreated, metaDays: DAYS });

  it('conta ações por dia de meta, hoje entra parcial', () => {
    const ana = pickProspection(summary, 'ana');
    expect(ana).toMatchObject({ on: true, done: 3, target: 90, dailyTarget: 10, pct: 3 });
    expect(ana.perDay.slice(0, 2)).toEqual([1, 1]);
    expect(ana.perDay[8]).toBe(1);
  });

  it('alvo 0 é prospecção desligada e fica fora da equipe', () => {
    expect(pickProspection(summary, 'marcos').on).toBe(false);
    expect(pickProspection(summary, null)).toMatchObject({ done: 3, target: 90, dailyTarget: 10 });
  });
});

describe('tarefas por tipo', () => {
  const interactions = [
    { type: 'daily_goal_done', dailyGoalCategory: 'contato_hoje', leadId: 'a', actorAuthUid: 'u-ana', createdAt: D(2) },
    { type: 'daily_goal_done', dailyGoalCategory: 'contato_hoje', leadId: 'a', actorAuthUid: 'u-ana', createdAt: D(2, 16) }, // repetida no dia
    { type: 'daily_goal_done', dailyGoalCategory: 'visita_hoje', leadId: 'b', actorAuthUid: 'u-ana', createdAt: D(3) },
    { type: 'daily_goal_done', dailyGoalCategory: 'aula_hoje', leadId: 'c', leadConsultantAuthUid: 'u-marcos', createdAt: D(3) },
    { type: 'note', leadId: 'd', actorAuthUid: 'u-ana', createdAt: D(3) }
  ];
  const range = { start: new Date(2026, 8, 1), end: NOW };

  it('uma por lead, categoria e dia; visitas e aulas juntas', () => {
    const team = tasksByType({ interactions, users: USERS, ...range });
    expect(team).toMatchObject({ contatos: 1, agenda: 2, total: 3 });
    expect(TASK_ROWS.map((r) => r.id)).toEqual(['novos', 'contatos', 'agenda', 'atrasados', 'renovacoes', 'vencidos']);
  });

  it('pessoa: só as tarefas que ela fez', () => {
    expect(tasksByType({ interactions, users: USERS, userId: 'marcos', ...range })).toMatchObject({ agenda: 1, total: 1 });
  });
});

describe('atrasados agora', () => {
  it('mesma condição da categoria Atrasados da Meta', () => {
    const liveLeads = [
      { consultantId: 'ana', status: 'Negociação', nextFollowUp: D(10) },
      { consultantId: 'ana', status: 'Negociação', nextFollowUp: D(11, 8) },   // hoje: não é atrasado
      { consultantId: 'ana', status: 'Venda', nextFollowUp: D(1) },
      { consultantId: 'marcos', status: 'Novo', nextFollowUp: D(3) }
    ];
    const r = overdueNow({ liveLeads, users: USERS, now: NOW });
    expect(r.total).toBe(2);
    expect(Object.fromEntries(r.byUser)).toEqual({ ana: 1, marcos: 1 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/operacional.routine.test.js`
Expected: FAIL com "Failed to resolve import ../operacional/routine.js".

- [ ] **Step 3: Implementar**

```js
// Rotina do Operacional: meta diária e régua de dias, prospecção (total e por
// dia), tarefas concluídas por tipo e atrasados agora. Mesmas réguas da Meta
// Diária (src/lib/dailyGoal.js); a equipe é sempre a soma das pessoas.

import { volumeTargetFor, interactionOwnerAuthUid } from '../dailyGoal.js';
import { dayKeyOf } from './month.js';

export const TASK_ROWS = [
  { id: 'novos', label: 'Novos leads' },
  { id: 'contatos', label: 'Contatos' },
  { id: 'agenda', label: 'Visitas e aulas' },
  { id: 'atrasados', label: 'Atrasados' },
  { id: 'renovacoes', label: 'Renovações' },
  { id: 'vencidos', label: 'Vencidos' }
];

const TASK_OF_CATEGORY = {
  novo_24h: 'novos',
  contato_hoje: 'contatos',
  visita_hoje: 'agenda',
  aula_hoje: 'agenda',
  atrasado: 'atrasados',
  renovacao: 'renovacoes',
  vencido: 'vencidos'
};

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);

// hitsBy: userId → Set de dias batidos no mês (inclui hoje, para a régua).
export function metaDaysSummary({ users, history, metaDays }) {
  const closed = metaDays.filter((d) => d.state === 'closed');
  const monthDays = new Set(metaDays.map((d) => d.key));
  const hitsBy = new Map((users || []).map((u) => [u.id, new Set()]));
  (history || []).forEach((h) => {
    const set = hitsBy.get(h.consultantId);
    if (set && monthDays.has(h.date)) set.add(h.date);
  });
  const byUser = new Map();
  hitsBy.forEach((set, id) => {
    byUser.set(id, { done: closed.filter((d) => set.has(d.key)).length, total: closed.length });
  });
  return { closedCount: closed.length, hitsBy, byUser };
}

export function pickMeta(summary, userId = null) {
  const rows = userId ? [summary.byUser.get(userId)].filter(Boolean) : [...summary.byUser.values()];
  const done = rows.reduce((a, r) => a + r.done, 0);
  const total = rows.reduce((a, r) => a + r.total, 0);
  return { done, total, pct: pct(done, total) };
}

export function metaCalendar({ metaDays, hitsBy, userId = null }) {
  return metaDays.map((d) => ({
    key: d.key,
    day: d.day,
    weekday: d.weekday,
    state: d.state,
    hits: [...hitsBy.values()].filter((s) => s.has(d.key)).length,
    me: userId ? Boolean(hitsBy.get(userId)?.has(d.key)) : null
  }));
}

// Ações por dia de meta (fechados + hoje): lead criado (dono = consultantId,
// qualquer balde) e interação com volumeKind (dono = quem fez).
export function prospectionSummary({ users, interactions, leadsCreated, metaDays }) {
  const days = metaDays.filter((d) => d.state !== 'future');
  const idxOf = new Map(days.map((d, i) => [d.key, i]));
  const byUser = new Map((users || []).map((u) => [u.id, { target: volumeTargetFor(u), perDay: days.map(() => 0) }]));
  const userOfAuth = new Map((users || []).map((u) => [u.authUid, u.id]));
  const seenLead = new Set();
  (leadsCreated || []).forEach((l) => {
    if (!l?.id || seenLead.has(l.id) || l.createdAtMissing || !(l.createdAt instanceof Date)) return;
    seenLead.add(l.id);
    const i = idxOf.get(dayKeyOf(l.createdAt));
    const row = byUser.get(l.consultantId);
    if (i != null && row) row.perDay[i] += 1;
  });
  (interactions || []).forEach((it) => {
    if (!it.volumeKind || !(it.createdAt instanceof Date)) return;
    const i = idxOf.get(dayKeyOf(it.createdAt));
    const row = byUser.get(userOfAuth.get(interactionOwnerAuthUid(it)));
    if (i != null && row) row.perDay[i] += 1;
  });
  byUser.forEach((row) => {
    row.on = row.target > 0;
    row.done = row.perDay.reduce((a, b) => a + b, 0);
    row.targetTotal = row.target * days.length;
  });
  return { days, byUser };
}

// Equipe = só quem tem alvo. Alvo 0 é prospecção desligada, não 0%.
export function pickProspection(summary, userId = null) {
  const rows = userId ? [summary.byUser.get(userId)].filter(Boolean) : [...summary.byUser.values()];
  const on = rows.filter((r) => r.on);
  const done = on.reduce((a, r) => a + r.done, 0);
  const target = on.reduce((a, r) => a + r.targetTotal, 0);
  return {
    on: on.length > 0,
    done,
    target,
    dailyTarget: on.reduce((a, r) => a + r.target, 0),
    pct: pct(done, target),
    perDay: summary.days.map((_, i) => on.reduce((a, r) => a + r.perDay[i], 0)),
    days: summary.days
  };
}

export function tasksByType({ interactions, users, userId = null, start, end }) {
  const auth = userId ? (users || []).find((u) => u.id === userId)?.authUid : null;
  const out = Object.fromEntries(TASK_ROWS.map((r) => [r.id, 0]));
  const seen = new Set();
  (interactions || []).forEach((i) => {
    if (i.type !== 'daily_goal_done' || !(i.createdAt instanceof Date) || i.createdAt < start || i.createdAt >= end) return;
    const task = TASK_OF_CATEGORY[i.dailyGoalCategory];
    if (!task) return;
    if (userId && interactionOwnerAuthUid(i) !== auth) return;
    const key = `${i.leadId}|${i.dailyGoalCategory}|${dayKeyOf(i.createdAt)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out[task] += 1;
  });
  out.total = TASK_ROWS.reduce((a, r) => a + out[r.id], 0);
  return out;
}

// Mesma condição da categoria Atrasados da Meta Diária: lead fora de Venda e
// Perda com próximo contato antes do início de hoje.
export function overdueNow({ liveLeads, users, now }) {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const byUser = new Map((users || []).map((u) => [u.id, 0]));
  (liveLeads || []).forEach((l) => {
    if (l.status === 'Venda' || l.status === 'Perda') return;
    if (!(l.nextFollowUp instanceof Date) || l.nextFollowUp >= todayStart) return;
    if (byUser.has(l.consultantId)) byUser.set(l.consultantId, byUser.get(l.consultantId) + 1);
  });
  return { total: [...byUser.values()].reduce((a, b) => a + b, 0), byUser };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/operacional.routine.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/operacional/routine.js src/lib/__tests__/operacional.routine.test.js
git commit -m "feat: rotina do Operacional (meta, prospecção, tarefas, atrasados)" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `metricsOf`, diferenças, destaques e tendências (`metrics.js`)

Regra de ouro (README do handoff §6): uma função só, `metricsOf`, para o mês exibido, o comparado e cada ponto de tendência. Com pessoa filtrada, Rotina, Renovação, Upgrades e Entraram passam a ser dela; a Base (ativos, ponte, churn, cancelamentos, trancamentos) continua da academia. Totais da equipe incluem vendas de quem já saiu da equipe; a tabela lista só os usuários atuais.

Contexto (`ctx`) que a view monta e passa:

```js
{
  now: Date,
  users: [{ id, authUid, name, role, dailyVolumeTarget }],
  config: { metaWeekdays: number[], renewalCheckpoints: number[], renewalGraceDays: number },
  contracts: [/* normalizeContract(...) de base.js */],
  leadsById: Map /* leadId → lead (responsável atual e campos de renovação) */,
  liveLeads: [/* metaLeads do App */],
  months: { 'YYYY-MM': { interactions: [], leadsCreated: [], history: [] } }
}
```

**Files:**
- Create: `src/lib/operacional/metrics.js`
- Test: `src/lib/__tests__/operacional.metrics.test.js`

- [ ] **Step 1: Escrever o teste que falha**

```js
import { describe, it, expect } from 'vitest';
import { normalizeContract } from '../operacional/base.js';
import { metricsOf, deltaOf, buildHighlights, seriesOf } from '../operacional/metrics.js';

const NOW = new Date(2026, 8, 11, 14, 0);
const D = (m, d, h = 10) => new Date(2026, m - 1, d, h);
const USERS = [
  { id: 'ana', authUid: 'u-ana', name: 'Ana Ribeiro', dailyVolumeTarget: 10 },
  { id: 'diego', authUid: 'u-diego', name: 'Diego Santos', dailyVolumeTarget: 10 }
];
const C = (id, over = {}) => normalizeContract({
  id, leadId: id, consultantId: 'ana', status: 'ativo',
  startsAt: D(1, 1), endsAt: D(12, 31), createdAt: D(1, 1), ...over
});

function makeCtx() {
  return {
    now: NOW,
    users: USERS,
    config: { metaWeekdays: [1, 2, 3, 4, 5], renewalCheckpoints: [90, 60, 30], renewalGraceDays: 15 },
    contracts: [
      C('a1'), C('a2', { consultantId: 'diego' }),
      C('novo', { startsAt: D(9, 2), createdAt: D(9, 2), consultantId: 'diego' }),
      C('vence', { endsAt: D(9, 5), consultantId: 'ana' })
    ],
    leadsById: new Map([['vence', { id: 'vence', consultantId: 'diego' }]]),
    liveLeads: [{ consultantId: 'ana', status: 'Novo', nextFollowUp: D(9, 1) }],
    months: {
      '2026-09': {
        history: [{ consultantId: 'ana', date: '2026-09-01' }, { consultantId: 'diego', date: '2026-09-02' }],
        interactions: [{ type: 'daily_goal_done', dailyGoalCategory: 'contato_hoje', leadId: 'x', actorAuthUid: 'u-ana', createdAt: D(9, 2) }],
        leadsCreated: []
      },
      '2026-08': { history: [], interactions: [], leadsCreated: [] }
    }
  };
}

describe('metricsOf', () => {
  const ctx = makeCtx();
  const team = metricsOf(ctx, { monthKey: '2026-09' });
  const ana = metricsOf(ctx, { monthKey: '2026-09', userId: 'ana' });
  const diego = metricsOf(ctx, { monthKey: '2026-09', userId: 'diego' });

  it('equipe é a soma das pessoas na rotina', () => {
    expect(team.meta.done).toBe(ana.meta.done + diego.meta.done);
    expect(team.meta.total).toBe(ana.meta.total + diego.meta.total);
    expect(team.tasks.total).toBe(ana.tasks.total + diego.tasks.total);
  });

  it('com pessoa filtrada a base continua da academia', () => {
    expect(ana.base.active).toBe(team.base.active);
    expect(ana.base.churn).toEqual(team.base.churn);
  });

  it('renovação segue o responsável atual pelo cliente', () => {
    expect(diego.renewal.cohort).toBe(1);
    expect(ana.renewal.cohort).toBe(0);
  });

  it('matrícula por vendedor do contrato', () => {
    expect(diego.entered).toBe(1);
    expect(team.entered).toBe(1);
  });

  it('retratos do agora só no mês em andamento sem corte', () => {
    expect(team.late.total).toBe(1);
    expect(team.upcoming).not.toBeNull();
    expect(metricsOf(ctx, { monthKey: '2026-08' }).late).toBeNull();
    expect(metricsOf(ctx, { monthKey: '2026-08', cutEnd: D(8, 11, 14) }).upcoming).toBeNull();
  });

  it('mês sem fonte carregada não inventa rotina', () => {
    const r = metricsOf(ctx, { monthKey: '2026-07' });
    expect(r.meta).toBeNull();
    expect(r.prosp).toBeNull();
    expect(r.tasks).toBeNull();
  });
});

describe('deltaOf', () => {
  it('sem base quando falta o comparado', () => {
    expect(deltaOf(10, null)).toEqual({ none: true, text: 'sem base' });
  });
  it('igual quando não mudou', () => {
    expect(deltaOf(5, 5)).toMatchObject({ flat: true, text: 'igual' });
  });
  it('p.p. para taxa e absoluto para contagem', () => {
    expect(deltaOf(82, 74, { kind: 'pp' })).toMatchObject({ up: true, text: '+8 p.p.' });
    expect(deltaOf(0.5, 1.2, { kind: 'pp' })).toMatchObject({ up: false, text: '−0,7 p.p.' });
    expect(deltaOf(419, 417)).toMatchObject({ up: true, text: '+2' });
  });
});

describe('buildHighlights', () => {
  const base = { cancels: { items: [] } };
  const mk = (over) => ({
    tasks: { novos: 10, contatos: 10, agenda: 10, atrasados: 10, renovacoes: 10, vencidos: 10 },
    milestones: [{ days: 30, pct: 70 }],
    upgrades: 5,
    base,
    renewal: { when: { antes: 4, no: 2, depois: 1 } },
    ...over
  });

  it('escolhe as maiores mudanças e marca o que piorou', () => {
    const cur = mk({ milestones: [{ days: 30, pct: 56 }], upgrades: 8, base: { cancels: { items: [{ name: 'Financeiro', count: 6 }] } } });
    const prev = mk({ base: { cancels: { items: [{ name: 'Financeiro', count: 3 }] } } });
    const h = buildHighlights(cur, prev);
    expect(h).toHaveLength(3);
    expect(h.map((x) => x.text)).toContain('Contatos no marco de 30 dias: de 70% para 56%');
    const cancel = h.find((x) => x.text.startsWith('Cancelamentos'));
    expect(cancel).toMatchObject({ up: true, bad: true, text: 'Cancelamentos por motivo financeiro: de 3 para 6' });
  });

  it('nada mudou, nenhum destaque; sem comparado, nenhum destaque', () => {
    expect(buildHighlights(mk({}), mk({}))).toEqual([]);
    expect(buildHighlights(mk({}), null)).toEqual([]);
  });
});

describe('seriesOf', () => {
  it('pula meses sem fonte e respeita a ordem dos meses', () => {
    const ctx = makeCtx();
    const s = seriesOf(ctx, { monthKey: '2026-09', pick: (m) => m.meta?.pct ?? null });
    expect(s.map((p) => p.key)).toEqual(['2026-08', '2026-09']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/operacional.metrics.test.js`
Expected: FAIL com "Failed to resolve import ../operacional/metrics.js".

- [ ] **Step 3: Implementar**

```js
// Uma função calcula tudo (README do handoff §6): o mês exibido, o comparado e
// cada ponto de tendência chamam metricsOf. A fonte é sempre o detalhe; o
// número da equipe é a soma; nenhuma taxa é guardada.

import { monthRange, effectiveEnd, metaDaysOfMonth, isCurrentMonthKey, addMonthsToKey } from './month.js';
import { computeBaseMovement, computeChurn, cancellationsByReason, salesInWindow, countLockedAt } from './base.js';
import { renewalCohort, summarizeCohort, milestones, upcomingExpirations } from './renewal.js';
import { metaDaysSummary, pickMeta, metaCalendar, prospectionSummary, pickProspection, tasksByType, overdueNow } from './routine.js';

const sumMap = (m) => [...m.values()].reduce((a, b) => a + b, 0);

export function metricsOf(ctx, { monthKey, userId = null, cutEnd = null }) {
  const { start, end: monthEnd } = monthRange(monthKey);
  const running = isCurrentMonthKey(monthKey, ctx.now);
  const end = cutEnd || effectiveEnd(monthKey, ctx.now);
  // Desfecho de renovação: no corte pró-rata vale o que existia no corte; nos
  // demais casos, o que existe hoje (renovação atrasada ainda conta).
  const asOf = end < monthEnd ? end : ctx.now;
  const snapshot = running && !cutEnd;
  const src = ctx.months?.[monthKey] || null;
  const users = ctx.users || [];
  const contracts = ctx.contracts || [];
  const grace = ctx.config?.renewalGraceDays;
  const metaDays = metaDaysOfMonth(monthKey, ctx.config?.metaWeekdays || [], end);

  const meta = src ? metaDaysSummary({ users, history: src.history, metaDays }) : null;
  const prospSummary = src ? prospectionSummary({ users, interactions: src.interactions, leadsCreated: src.leadsCreated, metaDays }) : null;

  const baseKnown = contracts.some((c) => c.startsAt && c.startsAt < end);
  const movement = computeBaseMovement(contracts, { start, end });
  const sales = salesInWindow(contracts, { start, end });
  const cohortRows = renewalCohort(contracts, { start, end: monthEnd, asOf, graceDays: grace, leadsById: ctx.leadsById });

  return {
    monthKey,
    running,
    start,
    end,
    hasSource: Boolean(src),
    meta: meta ? pickMeta(meta, userId) : null,
    calendar: meta ? metaCalendar({ metaDays, hitsBy: meta.hitsBy, userId }) : [],
    prosp: prospSummary ? pickProspection(prospSummary, userId) : null,
    tasks: src ? tasksByType({ interactions: src.interactions, users, userId, start, end }) : null,
    late: snapshot ? overdueNow({ liveLeads: ctx.liveLeads, users, now: ctx.now }) : null,
    base: {
      known: baseKnown,
      active: baseKnown ? movement.endCount : null,
      movement,
      locked: countLockedAt(contracts, new Date(end.getTime() - 1)),
      churn: computeChurn(contracts, { start, end, graceDays: grace }),
      cancels: cancellationsByReason(contracts, { start, end })
    },
    entered: userId ? (sales.entered.get(userId) || 0) : sumMap(sales.entered),
    enteredBy: sales.entered,
    upgrades: userId ? (sales.upgrades.get(userId) || 0) : sumMap(sales.upgrades),
    upgradesBy: sales.upgrades,
    renewal: summarizeCohort(cohortRows, { owner: userId }),
    milestones: src
      ? milestones(contracts, { start, end, checkpoints: ctx.config?.renewalCheckpoints, interactions: src.interactions, leadsById: ctx.leadsById, owner: userId })
      : null,
    upcoming: snapshot ? upcomingExpirations(contracts, { now: ctx.now, leadsById: ctx.leadsById, owner: userId }) : null
  };
}

const ppText = (v) => `${String(v).replace('.', ',')} p.p.`;

export function deltaOf(cur, prev, { kind = 'count' } = {}) {
  if (cur == null || prev == null) return { none: true, text: 'sem base' };
  const d = Math.round((cur - prev) * 10) / 10;
  if (d === 0) return { flat: true, value: 0, text: 'igual' };
  const abs = Math.abs(d);
  const num = kind === 'pp' ? ppText(abs) : abs.toLocaleString('pt-BR');
  return { up: d > 0, value: d, text: `${d > 0 ? '+' : '−'}${num}` };
}

const TASK_TEXT = {
  novos: 'Tarefas de novos leads concluídas',
  contatos: 'Contatos concluídos',
  agenda: 'Visitas e aulas concluídas',
  atrasados: 'Tarefas de atrasados concluídas',
  renovacoes: 'Tarefas de renovação concluídas',
  vencidos: 'Tarefas de vencidos concluídas'
};

const CANCEL_TEXT = {
  Financeiro: 'por motivo financeiro',
  'Mudou de cidade': 'por mudança de cidade',
  'Insatisfação': 'por insatisfação',
  'Saúde ou lesão': 'por saúde ou lesão',
  'Foi para outra academia': 'para outra academia',
  Outro: 'por outros motivos'
};

// Destaques NÃO repetem as 5 métricas da faixa: só o que está no fundo da tela.
export function buildHighlights(cur, prev, { limit = 3 } = {}) {
  if (!cur || !prev) return [];
  const out = [];
  const add = (label, c, p, { kind = 'count', unit = ['', ''], goodUp = true } = {}) => {
    if (c == null || p == null) return;
    const d = Math.round((c - p) * 10) / 10;
    if (d === 0) return;
    const abs = Math.abs(d);
    const show = (v) => (kind === 'pp' ? `${v}%` : v.toLocaleString('pt-BR'));
    out.push({
      text: `${label}: de ${show(p)} para ${show(c)}`,
      delta: kind === 'pp' ? ppText(abs) : `${abs.toLocaleString('pt-BR')} ${abs === 1 ? unit[0] : unit[1]}`.trim(),
      up: d > 0,
      bad: (d > 0) !== goodUp,
      score: kind === 'pp' ? abs : (abs / Math.max(p, 4)) * 60
    });
  };
  if (cur.tasks && prev.tasks) {
    Object.entries(TASK_TEXT).forEach(([k, label]) => add(label, cur.tasks[k], prev.tasks[k], { unit: ['tarefa', 'tarefas'] }));
  }
  (cur.milestones || []).forEach((m) => {
    const pm = (prev.milestones || []).find((x) => x.days === m.days);
    add(`Contatos no marco de ${m.days} dias`, m.pct, pm?.pct ?? null, { kind: 'pp' });
  });
  add('Upgrades', cur.upgrades, prev.upgrades, { unit: ['venda', 'vendas'] });
  const count = (m, name) => m.base?.cancels?.items?.find((r) => r.name === name)?.count || 0;
  const names = new Set([...(cur.base?.cancels?.items || []), ...(prev.base?.cancels?.items || [])].map((r) => r.name));
  names.forEach((n) => add(`Cancelamentos ${CANCEL_TEXT[n] || `(${n})`}`, count(cur, n), count(prev, n), { unit: ['pessoa', 'pessoas'], goodUp: false }));
  if (cur.renewal?.when && prev.renewal?.when) {
    add('Renovações fechadas antes de vencer', cur.renewal.when.antes, prev.renewal.when.antes, { unit: ['contrato', 'contratos'] });
    add('Renovações no dia do vencimento', cur.renewal.when.no, prev.renewal.when.no, { unit: ['contrato', 'contratos'] });
    add('Renovações depois de vencer', cur.renewal.when.depois, prev.renewal.when.depois, { unit: ['contrato', 'contratos'] });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

// Tendência dos `months` meses até o exibido. Mês sem valor fica fora; o rótulo
// da tela diz quantos meses entraram.
export function seriesOf(ctx, { monthKey, userId = null, pick, months = 6 }) {
  const keys = [];
  for (let i = months - 1; i >= 0; i--) keys.push(addMonthsToKey(monthKey, -i));
  return keys
    .map((key) => ({ key, value: pick(metricsOf(ctx, { monthKey: key, userId })) }))
    .filter((p) => p.value != null);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/operacional.metrics.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/operacional/metrics.js src/lib/__tests__/operacional.metrics.test.js
git commit -m "feat: metricsOf, diferenças, destaques e tendências do Operacional" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Carga dos dados (`queries.js` + `useOperacionalSources`)

Regras (especificação §6): consultas de campo único (índice automático, nenhum índice composto novo). Mês fechado usa o cache persistente do Firestore (`src/lib/firebase.js:50`) conferido por `getCountFromServer`. Mês corrente: interações ao vivo vindas do App, leads criados buscados uma vez e unidos aos leads ao vivo, histórico ao vivo. Leads da carteira buscados por id em lotes de 30, também com a conferência por contagem.

**Files:**
- Create: `src/lib/operacional/queries.js`
- Create: `src/hooks/useOperacionalSources.js`
- Test: `src/lib/__tests__/operacional.queries.test.js`

- [ ] **Step 1: Escrever o teste que falha**

```js
import { describe, it, expect, vi } from 'vitest';
import {
  monthWindowSpec, interactionsInMonthSpec, leadsCreatedInMonthSpec, goalHistorySinceSpec,
  chunk, loadWithCountCheck, leadIdsForRenewal
} from '../operacional/queries.js';
import { normalizeContract } from '../operacional/base.js';

describe('specs de consulta', () => {
  it('toda consulta por mês é de campo único: range e orderBy no mesmo campo', () => {
    const specs = [
      interactionsInMonthSpec(0, 10),
      leadsCreatedInMonthSpec(0, 10),
      goalHistorySinceSpec('2026-04-01'),
      monthWindowSpec('createdAt', 0, 10)
    ];
    specs.forEach((s) => {
      expect(new Set(s.wheres.map((w) => w.field))).toEqual(new Set([s.orderBy.field]));
      expect(s.wheres.every((w) => w.op !== '==')).toBe(true);
    });
  });

  it('janela do mês é [início, fim)', () => {
    const s = interactionsInMonthSpec(Date.UTC(2026, 8, 1), Date.UTC(2026, 9, 1));
    expect(s.wheres.map((w) => w.op)).toEqual(['>=', '<']);
  });

  it('lotes de 30 ids', () => {
    const ids = Array.from({ length: 65 }, (_, i) => `id${i}`);
    expect(chunk(ids).map((c) => c.length)).toEqual([30, 30, 5]);
  });
});

describe('loadWithCountCheck', () => {
  it('usa o cache quando a contagem do servidor bate', async () => {
    const fromServer = vi.fn();
    const r = await loadWithCountCheck({ fromCache: async () => [1, 2], countOnServer: async () => 2, fromServer });
    expect(r).toEqual({ docs: [1, 2], source: 'cache' });
    expect(fromServer).not.toHaveBeenCalled();
  });

  it('busca do servidor quando a contagem difere, o cache está vazio ou falha', async () => {
    const fromServer = async () => [1, 2, 3];
    expect((await loadWithCountCheck({ fromCache: async () => [1, 2], countOnServer: async () => 3, fromServer })).source).toBe('server');
    expect((await loadWithCountCheck({ fromCache: async () => [], countOnServer: async () => 0, fromServer })).source).toBe('server');
    expect((await loadWithCountCheck({ fromCache: async () => { throw new Error('x'); }, countOnServer: async () => 3, fromServer })).docs).toEqual([1, 2, 3]);
  });
});

describe('leadIdsForRenewal', () => {
  it('pega leads de contratos que vencem entre o início do mês mais antigo e 91 dias depois do mais novo, sem os já carregados', () => {
    const D = (y, m, d) => new Date(y, m - 1, d);
    const contracts = [
      normalizeContract({ id: 'a', leadId: 'A', startsAt: D(2026, 1, 1), endsAt: D(2026, 4, 10) }),
      normalizeContract({ id: 'b', leadId: 'B', startsAt: D(2026, 1, 1), endsAt: D(2026, 12, 10) }),
      normalizeContract({ id: 'c', leadId: 'C', startsAt: D(2026, 1, 1), endsAt: D(2027, 6, 1) }),
      normalizeContract({ id: 'd', leadId: 'D', startsAt: D(2026, 1, 1), endsAt: D(2026, 9, 15) })
    ];
    const ids = leadIdsForRenewal(contracts, { monthKeys: ['2026-04', '2026-09'], known: new Set(['D']) });
    expect(ids.sort()).toEqual(['A', 'B']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/operacional.queries.test.js`
Expected: FAIL com "Failed to resolve import ../operacional/queries.js".

- [ ] **Step 3: Implementar `queries.js`**

```js
// Consultas do Operacional por mês. Todas de campo único (range e orderBy no
// mesmo campo): usam o índice automático do Firestore, sem índice composto e
// sem publicação manual. Puras, sem SDK: o hook traduz com specToConstraints.

import { monthRange } from './month.js';

const DAY_MS = 86400000;

export const monthWindowSpec = (field, startMs, endMs) => ({
  wheres: [
    { field, op: '>=', value: new Date(startMs) },
    { field, op: '<', value: new Date(endMs) }
  ],
  orderBy: { field, dir: 'asc' }
});

export const interactionsInMonthSpec = (startMs, endMs) => monthWindowSpec('createdAt', startMs, endMs);
export const leadsCreatedInMonthSpec = (startMs, endMs) => monthWindowSpec('createdAt', startMs, endMs);
export const goalHistorySinceSpec = (fromDayKey) => ({
  wheres: [{ field: 'date', op: '>=', value: fromDayKey }],
  orderBy: { field: 'date', dir: 'asc' }
});

export function chunk(list, size = 30) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// Mês fechado: tenta o cache local e confere com a contagem do servidor (uma
// leitura por até mil docs). Contagem igual: usa o cache. Qualquer falha ou
// diferença: busca do servidor.
export async function loadWithCountCheck({ fromCache, fromServer, countOnServer }) {
  let cached = null;
  try { cached = await fromCache(); } catch { cached = null; }
  if (cached && cached.length) {
    try {
      if ((await countOnServer()) === cached.length) return { docs: cached, source: 'cache' };
    } catch { /* sem contagem: segue para o servidor */ }
  }
  return { docs: await fromServer(), source: 'server' };
}

// Leads cujo responsável atual a renovação precisa: contratos que vencem entre o
// início do mês mais antigo pedido e 91 dias depois do fim do mais novo (cobre
// coorte, marcos e a vencer). `known` = ids já em memória (metaLeads).
export function leadIdsForRenewal(contracts, { monthKeys, known = new Set() }) {
  if (!monthKeys?.length) return [];
  const sorted = [...monthKeys].sort();
  const from = monthRange(sorted[0]).start.getTime();
  const to = monthRange(sorted[sorted.length - 1]).end.getTime() + 91 * DAY_MS;
  const ids = new Set();
  (contracts || []).forEach((c) => {
    if (!c.leadId || !c.endsAt || known.has(c.leadId)) return;
    const t = c.endsAt.getTime();
    if (t >= from && t < to) ids.add(c.leadId);
  });
  return [...ids];
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/operacional.queries.test.js`
Expected: PASS.

- [ ] **Step 5: Implementar o hook `useOperacionalSources`**

Sem teste unitário (depende do SDK); a lógica testável ficou em `queries.js`. Verificação ao vivo na Task 13.

```js
// Fontes do Operacional por mês. Mês corrente: interações ao vivo (do App),
// leads criados buscados uma vez e unidos aos ao vivo, histórico ao vivo. Meses
// fechados: cache local conferido por contagem (queries.loadWithCountCheck).
// Também busca os docs dos leads da carteira de renovação (responsável atual).

import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, documentId, getCountFromServer, getDocsFromCache, onSnapshot, query, where } from 'firebase/firestore';
import { appId, LEADS_PATH, INTERACTIONS_PATH, DAILY_GOAL_HISTORY_PATH } from '../lib/firebase.js';
import { specToConstraints, getDocsWithAuthRetry } from './usePagedLeads.js';
import { normalizeLeadDoc } from '../lib/leads.js';
import { getSafeDate } from '../lib/dates.js';
import { monthRange, monthKeyOf } from '../lib/operacional/month.js';
import {
  interactionsInMonthSpec, leadsCreatedInMonthSpec, goalHistorySinceSpec,
  loadWithCountCheck, chunk, leadIdsForRenewal
} from '../lib/operacional/queries.js';

const mapInteraction = (d) => {
  const data = d.data();
  return { id: d.id, ...data, createdAt: getSafeDate(data.createdAt) };
};

export function useOperacionalSources({ db, enabled = true, now, monthKeys, liveInteractions, liveLeads, contracts, appUser }) {
  const currentKey = monthKeyOf(now);
  const ref = (p) => collection(db, 'artifacts', appId, 'public', 'data', p);

  // --- histórico de metas: uma assinatura desde o mês mais antigo pedido.
  const oldestKey = useMemo(() => [...(monthKeys || [])].sort()[0] || currentKey, [monthKeys, currentKey]);
  const [history, setHistory] = useState([]);
  const [historyScope, setHistoryScope] = useState('all');
  useEffect(() => {
    if (!db || !enabled) return undefined;
    const all = query(ref(DAILY_GOAL_HISTORY_PATH), ...specToConstraints(goalHistorySinceSpec(`${oldestKey}-01`)));
    let unsub = onSnapshot(all, (snap) => { setHistoryScope('all'); setHistory(snap.docs.map((d) => d.data())); }, () => {
      // Regra antiga (só o próprio histórico) ainda publicada: cai para os docs da pessoa.
      if (!appUser?.authUid) return;
      setHistoryScope('own');
      unsub = onSnapshot(
        query(ref(DAILY_GOAL_HISTORY_PATH), where('consultantAuthUid', '==', appUser.authUid)),
        (snap) => setHistory(snap.docs.map((d) => d.data())),
        () => setHistory([])
      );
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref() é estável por db/appId
  }, [db, enabled, oldestKey, appUser?.authUid]);

  // --- meses fechados e leads criados no mês corrente.
  const [months, setMonths] = useState({});
  const loadingRef = useRef(new Set());
  useEffect(() => {
    if (!db || !enabled) return;
    (monthKeys || []).forEach((key) => {
      if (months[key] || loadingRef.current.has(key)) return;
      loadingRef.current.add(key);
      const { start, end } = monthRange(key);
      const qI = query(ref(INTERACTIONS_PATH), ...specToConstraints(interactionsInMonthSpec(start.getTime(), end.getTime())));
      const qL = query(ref(LEADS_PATH), ...specToConstraints(leadsCreatedInMonthSpec(start.getTime(), end.getTime())));
      const closed = key !== currentKey;
      const load = (q, mapDoc) => (closed
        ? loadWithCountCheck({
            fromCache: async () => (await getDocsFromCache(q)).docs.map(mapDoc),
            fromServer: async () => (await getDocsWithAuthRetry(q)).docs.map(mapDoc),
            countOnServer: async () => (await getCountFromServer(q)).data().count
          }).then((r) => r.docs)
        : getDocsWithAuthRetry(q).then((snap) => snap.docs.map(mapDoc)));
      Promise.all([closed ? load(qI, mapInteraction) : Promise.resolve(null), load(qL, normalizeLeadDoc)])
        .then(([interactions, leadsCreated]) => {
          setMonths((prev) => ({ ...prev, [key]: { interactions, leadsCreated } }));
        })
        .catch((e) => console.error('operacional fontes', key, e))
        .finally(() => loadingRef.current.delete(key));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- months entra só como guarda de "já carregado"
  }, [db, enabled, monthKeys, currentKey]);

  // --- leads da carteira (responsável atual), por id, em lotes de 30.
  const [fetchedLeads, setFetchedLeads] = useState(() => new Map());
  const askedRef = useRef(new Set());
  useEffect(() => {
    if (!db || !enabled) return;
    const known = new Set((liveLeads || []).map((l) => l.id));
    askedRef.current.forEach((id) => known.add(id));
    const ids = leadIdsForRenewal(contracts, { monthKeys, known });
    if (!ids.length) return;
    ids.forEach((id) => askedRef.current.add(id));
    chunk(ids).forEach((part) => {
      const q = query(ref(LEADS_PATH), where(documentId(), 'in', part));
      loadWithCountCheck({
        fromCache: async () => (await getDocsFromCache(q)).docs.map(normalizeLeadDoc),
        fromServer: async () => (await getDocsWithAuthRetry(q)).docs.map(normalizeLeadDoc),
        countOnServer: async () => (await getCountFromServer(q)).data().count
      })
        .then(({ docs }) => setFetchedLeads((prev) => {
          const next = new Map(prev);
          docs.forEach((l) => next.set(l.id, l));
          return next;
        }))
        .catch((e) => console.error('operacional carteira', e));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref() é estável por db/appId
  }, [db, enabled, contracts, monthKeys, liveLeads]);

  // --- saída no formato de ctx.months e ctx.leadsById.
  return useMemo(() => {
    const byMonth = {};
    (monthKeys || []).forEach((key) => {
      const loaded = months[key];
      if (!loaded) return;
      const isCurrent = key === currentKey;
      const { start, end } = monthRange(key);
      const liveCreated = isCurrent
        ? (liveLeads || []).filter((l) => l.createdAt instanceof Date && l.createdAt >= start && l.createdAt < end)
        : [];
      const leadsCreated = [...new Map([...(loaded.leadsCreated || []), ...liveCreated].map((l) => [l.id, l])).values()];
      byMonth[key] = {
        interactions: isCurrent ? (liveInteractions || []) : (loaded.interactions || []),
        leadsCreated,
        history: history.filter((h) => typeof h.date === 'string' && h.date.startsWith(key))
      };
    });
    const leadsById = new Map(fetchedLeads);
    (liveLeads || []).forEach((l) => leadsById.set(l.id, l));
    const loading = (monthKeys || []).some((k) => !months[k]);
    return { months: byMonth, leadsById, loading, historyScope };
  }, [monthKeys, months, currentKey, liveLeads, liveInteractions, history, fetchedLeads, historyScope]);
}
```

- [ ] **Step 6: Conferir lint e testes do bloco**

Run: `npx eslint src/hooks/useOperacionalSources.js src/lib/operacional && npx vitest run src/lib/__tests__/operacional.*.test.js`
Expected: lint sem erro novo; todos os testes do Operacional passando.

- [ ] **Step 7: Commit**

```bash
git add src/lib/operacional/queries.js src/hooks/useOperacionalSources.js src/lib/__tests__/operacional.queries.test.js
git commit -m "feat: carga das fontes do Operacional com cache de mês fechado" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Histórico de metas legível por todos (`firestore.rules`)

**Files:**
- Modify: `firestore.rules` (bloco `stronix_daily_goal_history`, perto da linha 195)

- [ ] **Step 1: Trocar a regra de leitura**

Substituir:

```
    // Histórico do "Ritmo do mês" da Meta Diária. Cada consultor grava só os
    // seus próprios dias (consultantAuthUid == uid); admin lê os de todos.
    // Não há delete (o histórico é imutável). ID = `${consultantId}_${data}`.
    match /artifacts/{appId}/public/data/stronix_daily_goal_history/{id} {
      allow read: if inTenant(appId) && tenantActive(appId)
        && (isAdmin(appId) || resource.data.consultantAuthUid == request.auth.uid);
```

por:

```
    // Histórico do "Ritmo do mês" da Meta Diária. Cada consultor grava só os
    // seus próprios dias (consultantAuthUid == uid). Qualquer membro lê todos:
    // o Operacional mostra a meta de toda a equipe para todo mundo.
    // Não há delete (o histórico é imutável). ID = `${consultantId}_${data}`.
    match /artifacts/{appId}/public/data/stronix_daily_goal_history/{id} {
      allow read: if inTenant(appId) && tenantActive(appId);
```

- [ ] **Step 2: Commit**

```bash
git add firestore.rules
git commit -m "feat: histórico de metas legível por qualquer membro da academia" -m "Publicação manual no console do Firebase." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

Não publique a regra. A publicação é manual, pelo Johnny, no console do Firebase (ver `CLAUDE.md`). Até lá, o hook da Task 6 cai para o histórico da própria pessoa.

---

### Task 8: "Não vai renovar" com motivo da lista fixa

**Files:**
- Modify: `src/lib/renewalGoal.js` (`renewalDecline`)
- Modify: `src/lib/contracts.js` (`buildMatriculaWrites`, `leadPatch`)
- Modify: `src/modals/RenewalOutcomeModal.jsx` (desfecho `NAO_RENOVA`, as duas variantes)
- Test: `src/lib/__tests__/renewalGoal.test.js` (criar o bloco se o arquivo não tiver) e `src/lib/__tests__/contracts.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar em `src/lib/__tests__/renewalGoal.test.js`:

```js
import { renewalDecline } from '../renewalGoal.js';

describe('renewalDecline com motivo', () => {
  it('grava motivo e data junto com o marco tratado', () => {
    const at = new Date(2026, 8, 11, 10);
    expect(renewalDecline({ renewalHandledCheckpoints: [90] }, 60, { reason: 'Financeiro', at })).toEqual({
      renewalDeclined: true,
      renewalHandledCheckpoints: [90, 60],
      renewalDeclinedAt: at,
      renewalDeclineReason: 'Financeiro'
    });
  });

  it('sem motivo vira "Outro"', () => {
    expect(renewalDecline({}, 30, { at: new Date(0) }).renewalDeclineReason).toBe('Outro');
  });
});
```

E em `src/lib/__tests__/contracts.test.js`, no bloco que já confere `leadPatch.renewalDeclined` (linha ~245), acrescentar:

```js
    expect(leadPatch.renewalDeclinedAt).toBe(null);
    expect(leadPatch.renewalDeclineReason).toBe(null);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/renewalGoal.test.js src/lib/__tests__/contracts.test.js`
Expected: FAIL nos testes novos.

- [ ] **Step 3: Implementar**

Em `src/lib/renewalGoal.js`, trocar `renewalDecline` por:

```js
// Patch do desfecho "Não vai renovar": marca o ciclo como declinado, some o
// marco atual dos próximos marcos (idempotente) e grava QUANDO e POR QUÊ, com o
// motivo da mesma lista fixa do cancelamento (CONTRACT_CANCEL_REASONS). NÃO
// mexe em status/lifecycleStage: perda de venda != perda de funil.
export function renewalDecline(lead, activeCheckpoint, { reason = null, at = new Date() } = {}) {
  const handled = Array.isArray(lead?.renewalHandledCheckpoints) ? lead.renewalHandledCheckpoints : [];
  const next = (activeCheckpoint != null && !handled.includes(activeCheckpoint))
    ? [...handled, activeCheckpoint]
    : handled;
  return {
    renewalDeclined: true,
    renewalHandledCheckpoints: next,
    renewalDeclinedAt: at,
    renewalDeclineReason: reason || 'Outro'
  };
}
```

Em `src/lib/contracts.js`, no `leadPatch` de `buildMatriculaWrites`, logo depois de `renewalDeclined: false,`:

```js
    renewalDeclinedAt: null,
    renewalDeclineReason: null,
```

Em `src/modals/RenewalOutcomeModal.jsx`:
1. Importar `CONTRACT_CANCEL_REASONS` de `../lib/contracts.js`.
2. Novo estado `const [motivoLista, setMotivoLista] = useState('');`.
3. No bloco `{outcome === OUTCOMES.NAO_RENOVA && (...)}` (perto da linha 275), trocar o `<textarea>` do motivo por um seletor dos seis motivos (mesmo visual de botões/segmentos que o modal já usa, ou o `Select` do shadcn de `src/components/ui/select.jsx`) e, abaixo, um `<textarea>` opcional com o placeholder "Observação (opcional)" ligado ao `motivo` que já existe.
4. `canSubmit` para `NAO_RENOVA` passa a ser `motivoLista.length > 0`.
5. No `handleConfirm`, ramo `NAO_RENOVA`:

```js
        const patch = renewalDecline(lead, activeCheckpoint, { reason: motivoLista });
        await logInteraction(db, lead, appUser, {
          text: `Motivo da perda de renovação: ${motivoLista}.${motivoTrimmed ? ` ${motivoTrimmed}` : ''}`,
          type: 'note',
          renewalOutcome: 'declined',
          renewalDeclineReason: motivoLista
        }, patch);
```

(o segundo `logInteraction`, do `daily_goal_done`, fica como está).

- [ ] **Step 4: Rodar e ver passar, junto com os testes vizinhos**

Run: `npx vitest run src/lib/__tests__/renewalGoal.test.js src/lib/__tests__/contracts.test.js src/lib/__tests__/clientImport.test.js src/lib/__tests__/dailyGoal.test.js src/lib/__tests__/expiredGoal.test.js`
Expected: PASS. Se `clientImport.test.js` (perto da linha 693) falhar porque confere as mesmas chaves do `leadPatch` da matrícula, acrescente `renewalDeclinedAt: null, renewalDeclineReason: null` também no `leadPatch` da importação em `src/lib/clientImport.js` e rode de novo.

- [ ] **Step 5: Commit**

```bash
git add src/lib/renewalGoal.js src/lib/contracts.js src/lib/clientImport.js src/modals/RenewalOutcomeModal.jsx src/lib/__tests__/renewalGoal.test.js src/lib/__tests__/contracts.test.js src/lib/__tests__/clientImport.test.js
git commit -m "feat: motivo de não vai renovar vira lista fixa, com data" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Dia de meta batida gravado de qualquer tela

**Files:**
- Create: `src/lib/dailyGoalHistory.js`
- Test: `src/lib/__tests__/dailyGoalHistory.test.js`
- Modify: `src/views/DailyGoalView.jsx` (callback `recordGoalHit`, perto da linha 932)
- Modify: `src/App.jsx` (perto de `dailyGoalPending`, linha ~1389, e do `useRenewalClients`, linha ~1368)

- [ ] **Step 1: Escrever o teste que falha**

```js
import { describe, it, expect } from 'vitest';
import { buildGoalHitDoc } from '../dailyGoalHistory.js';

describe('buildGoalHitDoc', () => {
  const user = { id: 'ana', authUid: 'u-ana', name: 'Ana Ribeiro' };

  it('id determinístico por pessoa e dia', () => {
    expect(buildGoalHitDoc(user, '2026-09-11')).toEqual({
      id: 'ana_2026-09-11',
      data: { consultantId: 'ana', consultantAuthUid: 'u-ana', consultantName: 'Ana Ribeiro', date: '2026-09-11' }
    });
  });

  it('volume só quando há alvo', () => {
    expect(buildGoalHitDoc(user, '2026-09-11', { volumeCount: 12, volumeTarget: 10 }).data)
      .toMatchObject({ volumeCount: 12, volumeTarget: 10 });
    expect(buildGoalHitDoc(user, '2026-09-11', { volumeCount: 3, volumeTarget: 0 }).data.volumeCount).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/dailyGoalHistory.test.js`
Expected: FAIL com "Failed to resolve import".

- [ ] **Step 3: Implementar a lib**

```js
// Doc do dia de meta batida (stronix_daily_goal_history). Um por pessoa por dia,
// id determinístico: gravar de novo não duplica. Saiu do DailyGoalView para
// o App gravar de qualquer tela quando as pendências do dia chegam a zero.

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { appId, DAILY_GOAL_HISTORY_PATH } from './firebase.js';
import { dgDateKey } from './dailyGoal.js';

export function buildGoalHitDoc(appUser, dateKey, { volumeCount = null, volumeTarget = null } = {}) {
  return {
    id: `${appUser.id}_${dateKey}`,
    data: {
      consultantId: appUser.id,
      consultantAuthUid: appUser.authUid,
      consultantName: appUser.name || null,
      date: dateKey,
      ...(volumeTarget > 0 ? { volumeCount, volumeTarget } : {})
    }
  };
}

export async function recordGoalHit(db, appUser, { date = new Date(), volumeCount = null, volumeTarget = null } = {}) {
  if (!db || !appUser?.id || !appUser?.authUid) return;
  const { id, data } = buildGoalHitDoc(appUser, dgDateKey(date), { volumeCount, volumeTarget });
  try {
    await setDoc(
      doc(db, 'artifacts', appId, 'public', 'data', DAILY_GOAL_HISTORY_PATH, id),
      { ...data, hitAt: serverTimestamp() },
      { merge: true }
    );
  } catch { /* regra ainda não publicada: silencioso, como antes */ }
}
```

- [ ] **Step 4: Usar a lib no `DailyGoalView`**

Trocar o corpo do `useCallback` de `recordGoalHit` (linhas ~932 a 949) por:

```js
  const recordGoalHit = useCallback(
    (volCount = null, volTarget = null) => recordGoalHitDoc(db, appUser, { volumeCount: volCount, volumeTarget: volTarget }),
    [db, appUser]
  );
```

com `import { recordGoalHit as recordGoalHitDoc } from '../lib/dailyGoalHistory.js';` e removendo os imports que ficarem sem uso (`setDoc`, `serverTimestamp`, `doc` só se nada mais usar; confira com `grep -n "setDoc\|serverTimestamp\|\bdoc(" src/views/DailyGoalView.jsx`).

- [ ] **Step 5: Gravar a partir do App**

Em `src/App.jsx`:

1. Na chamada de `useRenewalClients` (linha ~1368), pegar também o `loading`: `const { clients: renewalClients, candidates: renewalCandidates, loading: renewalLoading } = useRenewalClients({ ... })`.
2. Trocar o memo `dailyGoalPending` por um que devolve total e pendentes, mantendo o nome `dailyGoalPending` para quem já usa:

```js
  const dailyGoalProgress = useMemo(() => {
    if (!appUser?.id) return { total: 0, pending: 0 };
    void dayKey; // recalcula na virada do dia
    const slots = computeDailyGoalSlots(metaLeads, buildInteractionsByLead(interactions), appUser.id, renewalCheckpoints, renewalGraceDays);
    const { totalSlots, doneSlots } = slotTotals(slots);
    return { total: totalSlots, pending: totalSlots - doneSlots };
  }, [metaLeads, interactions, appUser, dayKey, renewalCheckpoints, renewalGraceDays]);
  const dailyGoalPending = dailyGoalProgress.pending;

  // Dia batido gravado de QUALQUER tela: antes só a Meta Diária aberta gravava,
  // e quem fechava a última tarefa pelo Pipeline ficava sem o dia. Só grava com
  // a base carregada (senão uma pendência ainda não carregada parece zerada).
  useEffect(() => {
    if (!db || !appUser?.id || !listenersActive || loadingData || renewalLoading) return;
    if (dailyGoalProgress.total > 0 && dailyGoalProgress.pending === 0) recordGoalHitDoc(db, appUser);
  }, [db, appUser, listenersActive, loadingData, renewalLoading, dailyGoalProgress, dayKey]);
```

com `import { recordGoalHit as recordGoalHitDoc } from './lib/dailyGoalHistory.js';`. Confira os nomes `loadingData` e `listenersActive` no próprio `App.jsx` (`grep -n "const \[loadingData\|listenersActive" src/App.jsx`); se o hook das atividades usar outro nome, use o que existe.

- [ ] **Step 6: Rodar testes e lint**

Run: `npx vitest run src/lib/__tests__/dailyGoalHistory.test.js src/lib/__tests__/dailyGoal.test.js && npx eslint src/App.jsx src/views/DailyGoalView.jsx src/lib/dailyGoalHistory.js`
Expected: PASS e nenhum erro de lint novo (compare com `npm run lint` da Task 0).

- [ ] **Step 7: Commit**

```bash
git add src/lib/dailyGoalHistory.js src/lib/__tests__/dailyGoalHistory.test.js src/views/DailyGoalView.jsx src/App.jsx
git commit -m "feat: dia de meta batida gravado de qualquer tela" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Tarefas de interface (10 a 12): como portar o handoff

O handoff é a fonte da verdade. Porte classe a classe, sem reinterpretar: mesmos tamanhos, pesos, espaçamentos, raios e textos. O mockup usa HTML puro com variáveis CSS; no app vira JSX com Tailwind e os tokens de `src/index.css`. Use esta tabela de conversão:

| Handoff | App |
|---|---|
| `var(--bg)` | `bg-background` |
| `var(--card)` | `bg-card` |
| `var(--fg)` | `text-foreground` |
| `var(--fg2)` | `text-foreground/80` |
| `var(--muted)`, `var(--faint)` | `text-muted-foreground` (nunca `slate-400` em rótulo pequeno, README §3) |
| `var(--border)` | `border-border` |
| `var(--rule)` | `border-slate-100 dark:border-white/[0.06]` (igual ao `DashCard`) |
| `var(--soft)` | `bg-slate-50 dark:bg-white/[0.03]` |
| `var(--soft2)` | `bg-muted` |
| `var(--hover)` | `hover:bg-muted/70` |
| `var(--brand)` | `bg-brand-600` / `text-brand-600` |
| `var(--brand-50)` | `bg-brand-50 dark:bg-brand-500/15` |
| `var(--brand-100)` | `bg-brand-100 dark:bg-brand-500/25` |
| `var(--brand-200)` | `bg-brand-200 dark:bg-brand-500/40` |
| `var(--brand-700)` | `text-brand-700 dark:text-brand-300` |
| `var(--orange)` | `bg-accent-500 dark:bg-accent-600` |
| `var(--orange-t)` | `bg-accent-50 dark:bg-accent-500/15` |
| `var(--orange-700)` | `text-accent-600 dark:text-accent-400` |
| `var(--green)` | `bg-success dark:bg-[#0E9F6E]` |
| `var(--green-t)` | `bg-emerald-50 dark:bg-emerald-500/10` |
| `var(--green-700)` | `text-emerald-700 dark:text-emerald-300` |
| `var(--red)` | `bg-danger dark:bg-[#E11D48]` |
| `var(--red-t)` | `bg-rose-50 dark:bg-rose-500/10` |
| `var(--red-700)` | `text-rose-700 dark:text-rose-300` |
| `var(--amber)` | `bg-amber-500 dark:bg-amber-600` |
| `var(--amber-700)` | `text-amber-700 dark:text-amber-300` |
| `var(--grey)` | `bg-slate-400 dark:bg-slate-500` |
| `var(--shadow-card)` | `shadow-card` |
| `font-family:'Space Grotesk'` | `font-display` |
| classe `num` | `num` (já existe no app) |
| classe `tr` | `truncate` |
| atributo `title` + `tabindex` numa marca | `<ChartMark tip="...">` (Task 10) |
| `<select>` nativo | `Select` do shadcn (`src/components/ui/select.jsx`) |
| caixa "Comparar" | `Checkbox` do shadcn (Task 0) |

Os `{{ holes }}` do handoff viram props. Os valores vêm de `metricsOf` (Task 5); a lógica de exemplo do fim do `.dc.html` (linhas 866 a 1712) mostra só como cada valor vira classe, largura ou texto, e os dados dela NÃO entram no app.

---

### Task 10: Topo da tela (`ChartMark`, `OperacionalToolbar`, `DashSummaryBand`, `DashHighlights`)

**Files:**
- Create: `src/views/dashboard/ChartMark.jsx`
- Create: `src/views/dashboard/OperacionalToolbar.jsx` (handoff linhas 79 a 129)
- Create: `src/views/dashboard/DashSummaryBand.jsx` (handoff linhas 155 a 188; README §2 "Faixa de resumo")
- Create: `src/views/dashboard/DashHighlights.jsx` (handoff linhas 131 a 149; celular: README §5)

- [ ] **Step 1: `ChartMark`, a marca focável com dica**

```jsx
// Marca de gráfico com valor: focável e com dica do shadcn no hover E no foco
// do teclado (o title nativo do handoff não dispara no foco, README §4).
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip.jsx';
import { cn } from '../../lib/utils.js';

export function ChartMark({ tip, as: Comp = 'span', className, style, children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Comp
          tabIndex={0}
          role="img"
          aria-label={tip}
          className={cn('cursor-help outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40', className)}
          style={style}
        >
          {children}
        </Comp>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 whitespace-normal text-[11.5px] leading-relaxed">{tip}</TooltipContent>
    </Tooltip>
  );
}
```

- [ ] **Step 2: `OperacionalToolbar`**

Props:

```js
{
  monthKey, monthOptions /* [{ key, label }] */, onMonth, canPrev, canNext, onPrev, onNext,
  compareOn, onCompareOn, compareKey, compareOptions /* [{ key, label }] */, onCompare,
  person /* 'all' | userId */, people /* [{ id, name }] */, onPerson,
  note /* texto da direita */
}
```

Porte as linhas 86 a 129: barra `sticky top-0 z-30`, `px-8 py-2.5`, `border-t` (rule) + `border-b border-border`, `bg-card`. Mês: botões ‹ › (ícones `ChevronLeft`/`ChevronRight` da lucide, 15px) em volta de um `Select` com as opções. "Comparar": `Checkbox` + rótulo; ligado, a caixa inteira fica `border-brand-600 bg-brand-50 text-brand-700` e aparece o `Select` do mês comparado. Pessoa: ícone `User` + `Select` com "Equipe toda" (`value="all"`) e as pessoas; com pessoa escolhida, a caixa fica no tom azul. À direita, `note` em `text-[11.5px] text-muted-foreground truncate max-w-[420px]`.

Abaixo de 768px (README §5): os três controles viram um botão com ícone (`SlidersHorizontal`) que abre um `Popover` (`src/components/ui/popover.jsx`) com os mesmos três controles empilhados.

- [ ] **Step 3: `DashSummaryBand`**

Props:

```js
{
  items: [{
    key, label, help,
    value /* string */, muted /* bool: "Desligada" */, sub,
    delta /* resultado de deltaOf ou null */, goodUp /* bool */,
    series /* number[] ou null */, seriesFrom, seriesTo, seriesLabel
  }]
}
```

Um `section` só: `rounded-2xl border border-border bg-card shadow-card overflow-hidden flex`, cinco células `flex-1 min-w-0 px-[18px] py-4`, a partir da segunda com `border-l` (rule). Dentro de cada célula, o vocabulário do `DashKpiCard` (README §2): rótulo `text-[12px] font-medium text-muted-foreground` com `DashHelpTip`; valor `num text-[32px] font-semibold tracking-tight leading-none` (Geist, não Space Grotesk; `text-muted-foreground` quando `muted`); pílula `inline-flex items-center gap-1 px-1.5 h-5 rounded-md text-[11px] font-semibold num`. Pílula verde quando `delta.up === goodUp`, vermelha quando o contrário e cinza (`bg-muted text-muted-foreground`) quando `delta.flat`. Sem pílula quando `delta` é nulo ou `delta.none`. `sub` `text-[11.5px] text-muted-foreground truncate`. Tendência: `<div className={cn('mt-3 -mx-1 [&_svg]:w-full [&_svg]:h-[42px]', DASH_TONES.brand.stroke)}><Sparkline data={series} width={120} height={42} strokeWidth={1.75} /></div>` quando `series?.length > 1`, com `seriesFrom`/`seriesTo` em `text-[9.5px] text-muted-foreground` nas pontas e o conteúdo inteiro dentro de um `ChartMark` com `tip={seriesLabel}`.

Abaixo de 768px: grade de 2 colunas (`grid grid-cols-2`), cada célula como card próprio, sem tendência (handoff linhas 729 a 762).

- [ ] **Step 4: `DashHighlights`**

Props: `{ items: [{ text, delta, up, bad }] }`. Porte as linhas 132 a 148: grade de 3 (`grid grid-cols-3 gap-3`), cada item `rounded-2xl border border-border px-[15px] py-[13px] flex gap-3`, fundo `bg-rose-50 dark:bg-rose-500/10` quando `bad`, senão `bg-emerald-50 dark:bg-emerald-500/10`; quadrado de 26px com seta (`ArrowUp`/`ArrowDown` da lucide) em `bg-danger`/`bg-success`; texto `text-[12.5px] font-semibold`; linha de baixo `▲`/`▼` + `delta` + ponto + "piorou"/"melhorou" em `text-rose-700`/`text-emerald-700` (com os pares escuros da tabela). Sem itens, não renderiza nada.

Abaixo de 768px: carrossel horizontal (`flex overflow-x-auto snap-x snap-mandatory`), com os itens reordenados para o pior primeiro: `[...items].sort((a, b) => Number(b.bad) - Number(a.bad))`.

- [ ] **Step 5: Lint e commit**

Run: `npx eslint src/views/dashboard/ChartMark.jsx src/views/dashboard/OperacionalToolbar.jsx src/views/dashboard/DashSummaryBand.jsx src/views/dashboard/DashHighlights.jsx`
Expected: sem erro. Confira na mão que nenhum import com letra maiúscula ficou sem uso (o lint do repo ignora esses, ver memória `agenda-do-dia-meta-diaria`).

```bash
git add src/views/dashboard/ChartMark.jsx src/views/dashboard/OperacionalToolbar.jsx src/views/dashboard/DashSummaryBand.jsx src/views/dashboard/DashHighlights.jsx
git commit -m "feat: topo do Operacional (barra de controles, faixa de resumo, destaques)" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Gráficos (`ProspectionByDay`, `MetaDaysCalendar`, `BaseBridge`, `RenewalOutcomeBar`, `MilestoneBars`)

Todos com casca `rounded-2xl border border-border bg-card shadow-card px-[18px] pt-4 pb-3.5` e título `text-[13.5px] font-semibold` (handoff), e cada marca com valor dentro de um `ChartMark`.

**Files:**
- Create: `src/views/dashboard/ProspectionByDay.jsx` (handoff linhas 199 a 227; lógica 1320 a 1332 e 1497 a 1512)
- Create: `src/views/dashboard/MetaDaysCalendar.jsx` (linhas 229 a 257; lógica 1514 a 1564)
- Create: `src/views/dashboard/BaseBridge.jsx` (linhas 338 a 362; lógica 1334 a 1349 e 1593 a 1614)
- Create: `src/views/dashboard/RenewalOutcomeBar.jsx` (linhas 441 a 483; lógica 1351 a 1354 e 1632 a 1648)
- Create: `src/views/dashboard/MilestoneBars.jsx` (linhas 485 a 506; lógica 1649 a 1662)

- [ ] **Step 1: `ProspectionByDay`**

Props: `{ days /* prosp.days */, values /* prosp.perDay */, dailyTarget }`. Geometria (igual ao handoff):

```js
const max = Math.max(...values, dailyTarget, 1);
const barH = (v) => `${Math.max(Math.round((v / max) * 108), 3)}px`;
const targetBottom = `${Math.round((dailyTarget / max) * 108)}px`;
const showValues = days.length <= 14;          // com mais de 14 colunas o número sai de cima
const gap = days.length > 14 ? 'gap-[3px]' : 'gap-1.5';
const tone = (v, isToday) => (isToday ? 'bg-accent-50 dark:bg-accent-500/15'
  : v >= dailyTarget ? 'bg-accent-500 dark:bg-accent-600' : 'bg-brand-200 dark:bg-brand-500/40');
const tip = (d, v) => `Dia ${d.day}: ${v.toLocaleString('pt-BR')} ações${d.state === 'today' ? ' até agora (hoje)' : ''} · alvo ${dailyTarget.toLocaleString('pt-BR')}`;
```

Área de 132px com a linha de alvo (`h-0.5 bg-foreground/80 opacity-55`) em `bottom: targetBottom`; colunas `flex-1 max-w-6 rounded-t` com a altura acima; dias embaixo `text-[9.5px]`, o de hoje em negrito. Legenda no topo: traço + "alvo N/dia".

- [ ] **Step 2: `MetaDaysCalendar`**

Props: `{ cells /* metrics.calendar */, teamSize, person /* bool */ }`. Grade `grid grid-cols-5 gap-1.5 max-w-[470px]` com cabeçalho Seg a Sex. Teto na grade, card livre (README §2). Célula `h-[52px] rounded-[10px] flex flex-col items-center justify-center gap-[3px]`. Mapeamento:

```js
const SCALE = ['bg-[#8FB0FF] dark:bg-[#2B59FF]', 'bg-[#5A7FFF] dark:bg-[#5A7FFF]', 'bg-[#2B59FF] dark:bg-[#8FB0FF]', 'bg-[#1C3FC4] dark:bg-[#C9D8FF]'];
const scaleIdx = (hits) => Math.min(3, Math.max(0, Math.ceil((hits / Math.max(teamSize, 1)) * 4) - 1));
const lead = cells.length ? cells[0].weekday - 1 : 0;   // segunda = 0 casas vazias
// futuro: borda tracejada, só o número; hoje: 'bg-brand-50 border border-dashed border-brand-600' com "hoje";
// pessoa: bateu = 'bg-brand-600 text-white' com "bateu", não = 'bg-muted' com "não";
// equipe: hits > 0 = SCALE[scaleIdx(hits)] com o número (texto branco quando hits/teamSize >= 0.75), 0 = 'bg-muted'.
const tip = (c) => c.state === 'future' ? `Dia ${c.day}: ainda não aconteceu`
  : person ? `Dia ${c.day}: ${c.state === 'today' ? 'hoje, ainda em curso' : c.me ? 'bateu a meta' : 'não bateu'}`
  : `Dia ${c.day}: ${c.hits} de ${teamSize} bateram${c.state === 'today' ? ' até agora (hoje)' : ''}`;
```

Complete com casas vazias até um múltiplo de 5. Legenda embaixo: "quantos bateram" com as quatro amostras (rótulo = `Math.ceil(teamSize * (i + 1) / 4)`) mais o zero, ou "bateu / não bateu". Abaixo de 768px, a grade rola na horizontal com `snap-x`.

- [ ] **Step 3: `BaseBridge`**

Props: `{ startCount, endCount, steps /* movement.steps */ }`. Geometria:

```js
const items = [
  { name: 'Início', kind: 'level', v: startCount },
  { name: 'Entraram', kind: 'in', v: steps.entraram },
  { name: 'Voltaram', kind: 'in', v: steps.voltaram },
  { name: 'Cancelaram', kind: 'out', v: -steps.cancelaram },
  { name: 'Venceram', kind: 'out', v: -steps.venceram },
  { name: 'Trancamentos', kind: steps.trancamentos >= 0 ? 'in' : 'out', v: steps.trancamentos },
  { name: 'Fim', kind: 'level', v: endCount }
];
let run = startCount;
const spans = items.map((b) => {
  if (b.kind === 'level') return { from: b.v, to: b.v, val: b.v };
  const from = run; run += b.v;
  return { from: Math.min(from, run), to: Math.max(from, run), val: run };
});
const all = spans.flatMap((s) => [s.from, s.to]);
const lo = Math.min(...all), hi = Math.max(...all);
const pad = Math.max(Math.round((hi - lo) * 0.35), 3);
const floor = lo - pad, ceil = hi + pad, H = 144;
const y = (v) => ((v - floor) / (ceil - floor)) * H;
// nível: bottom 0, altura y(val), 'bg-muted', rótulo = valor;
// entrada/saída: bottom y(from), altura max(y(to) - y(from), 3), 'bg-brand-600' ou 'bg-danger',
// rótulo "+N"/"−N" em text-brand-700/text-rose-700; largura max 24px, rounded.
const tip = (b, s) => b.kind === 'level' ? `${b.name}: ${b.v.toLocaleString('pt-BR')} clientes ativos`
  : `${b.name}: ${b.v > 0 ? '+' : '−'}${Math.abs(b.v)} · base em ${s.val.toLocaleString('pt-BR')}`;
```

Legenda "entrou" (azul) e "saiu" (vermelho) no topo e a nota do handoff (linha 361) embaixo. A invariante da Task 2 garante que o último nível bate com o `run`.

- [ ] **Step 4: `RenewalOutcomeBar`**

Props: `{ counts, when, running, summary }`. Fatias na ordem renovou, não vai, venceu e, só com `running`, ainda vai vencer. Cores: `bg-success`, `bg-amber-500`, `bg-danger`, `bg-slate-400` (pares escuros da tabela). Barra `flex h-[26px] gap-0.5`, cada fatia `rounded` com largura `${(n / total) * 100}%` e o número dentro quando a largura passa de 10%. Legenda com contagem colorida (`text-emerald-700`, `text-amber-700`, `text-rose-700`, `text-muted-foreground`). Bloco "Quando renovou" com três barras verdes: "Antes de vencer", "No vencimento" e "Depois, na tolerância". Dicas: `${rótulo}: ${n} de ${total} contratos` e `${rótulo}: ${n} renovações`. No mês fechado, uma linha de nota `text-[10.5px] text-muted-foreground` no fim: "O número de um mês fechado ainda pode subir enquanto houver contrato dentro da tolerância." (especificação §5.6).

- [ ] **Step 5: `MilestoneBars`**

Props: `{ items /* metrics.milestones */ }`. Uma linha por marco: "90 dias antes", porcentagem e "N de M"; barra de 10px, `bg-brand-600` com `text-brand-700` quando `pct >= 70`, senão `bg-amber-500` com `text-amber-700`. Dica: `Marco de ${days} dias: ${done} contatos feitos de ${total} clientes que chegaram ao marco`. Marco com `total` 0 mostra "—" e barra vazia.

- [ ] **Step 6: Lint e commit**

Run: `npx eslint src/views/dashboard/ProspectionByDay.jsx src/views/dashboard/MetaDaysCalendar.jsx src/views/dashboard/BaseBridge.jsx src/views/dashboard/RenewalOutcomeBar.jsx src/views/dashboard/MilestoneBars.jsx`
Expected: sem erro.

```bash
git add src/views/dashboard/ProspectionByDay.jsx src/views/dashboard/MetaDaysCalendar.jsx src/views/dashboard/BaseBridge.jsx src/views/dashboard/RenewalOutcomeBar.jsx src/views/dashboard/MilestoneBars.jsx
git commit -m "feat: gráficos do Operacional portados do handoff" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Tabela da equipe, montagem da tela e ligação no App

**Files:**
- Create: `src/views/dashboard/TeamMonthTable.jsx` (handoff linhas 583 a 661; lógica 1673 a 1706)
- Rewrite: `src/views/dashboard/DashboardOperacionalView.jsx`
- Modify: `src/App.jsx` (linha ~1696, render do Operacional)

- [ ] **Step 1: `TeamMonthTable`**

Props: `{ rows /* [{ user, m }] */, total /* metrics da equipe */, running, onPick }`. Colunas e larguras do handoff: Pessoa 206px, Meta diária 132px, Prospecção 132px, Taxa de renovação flex, Entraram 78px, Upgrades 78px e, só com `running`, Atrasados agora 92px. Cada linha é um `<button>` que chama `onPick(user.id)`. Monograma com `dashInitials`. Meta com barra azul, prospecção com barra laranja ou a etiqueta cinza "Desligada" quando `m.prosp?.on` é falso. Renovação verde quando `rate >= 75`, âmbar abaixo, "—" quando nula. Atrasados da pessoa: `total.late?.byUser.get(user.id)` (o `late` de `metricsOf` é da equipe inteira, com o número de cada um em `byUser`; o card "Atrasados agora" com pessoa filtrada usa `cur.late.byUser.get(userId)`), em `text-rose-700` a partir de 8. Rodapé "Equipe toda" com os totais de `total`. O papel embaixo do nome sai de `user.role === 'admin' ? 'Gestor' : 'Consultor'`. Abaixo de 768px, vira lista com as três taxas numa linha de texto (handoff linhas 780 a 800).

- [ ] **Step 2: Reescrever `DashboardOperacionalView.jsx`**

```jsx
// Tela OPERACIONAL (Visão geral · Operacional): o trabalho feito e a saúde da
// base de clientes, por mês de competência, igual para todos os perfis, com
// comparativo e filtro de pessoa. Visual e textos: handoff do Claude Design
// (docs/superpowers/specs/handoff-operacional/). Toda a matemática vem de
// src/lib/operacional/ (metricsOf); aqui é só orquestração e apresentação.

import { useEffect, useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import { BreakdownCard } from './DashPrimitives.jsx';
import { useOperacionalSources } from '../../hooks/useOperacionalSources.js';
import { normalizeContract } from '../../lib/operacional/base.js';
import { monthKeyOf, addMonthsToKey, comparisonCut, compareOptions, monthLabel, monthRange } from '../../lib/operacional/month.js';
import { metricsOf, deltaOf, buildHighlights, seriesOf } from '../../lib/operacional/metrics.js';
import { TASK_ROWS } from '../../lib/operacional/routine.js';
import { cn } from '../../lib/utils.js';
import { OperacionalToolbar } from './OperacionalToolbar.jsx';
import { DashSummaryBand } from './DashSummaryBand.jsx';
import { DashHighlights } from './DashHighlights.jsx';
import { ProspectionByDay } from './ProspectionByDay.jsx';
import { MetaDaysCalendar } from './MetaDaysCalendar.jsx';
import { BaseBridge } from './BaseBridge.jsx';
import { RenewalOutcomeBar } from './RenewalOutcomeBar.jsx';
import { MilestoneBars } from './MilestoneBars.jsx';
import { TeamMonthTable } from './TeamMonthTable.jsx';

const SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const shortOf = (key) => SHORT[Number(key.slice(5, 7)) - 1];

function DashboardOperacionalView({ appUser, usersList, liveLeads, interactions, db, listenersActive = true }) {
  const { contratos, metaWeekdays = [1, 2, 3, 4, 5], renewalCheckpoints = [90, 60, 30], renewalGraceDays = 15 } = useGeneralConfig();

  // Relógio da tela: vira o minuto (marca de hoje, mês em andamento, pró-rata).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const currentKey = monthKeyOf(now);
  const [monthKey, setMonthKey] = useState(currentKey);
  const [compareOn, setCompareOn] = useState(true);
  const [compareKey, setCompareKey] = useState(null); // null = mês anterior
  const [person, setPerson] = useState('all');
  const userId = person === 'all' ? null : person;
  const cmpKey = compareKey || addMonthsToKey(monthKey, -1);

  const seriesKeys = useMemo(() => Array.from({ length: 6 }, (_, i) => addMonthsToKey(monthKey, i - 5)), [monthKey]);
  const monthKeys = useMemo(() => [...new Set([...seriesKeys, cmpKey])], [seriesKeys, cmpKey]);
  const contracts = useMemo(() => (contratos || []).map(normalizeContract), [contratos]);
  const users = useMemo(() => (usersList || []).filter((u) => u?.id), [usersList]);

  const sources = useOperacionalSources({
    db, enabled: listenersActive, now, monthKeys, liveInteractions: interactions, liveLeads, contracts, appUser
  });

  const ctx = useMemo(() => ({
    now, users, contracts, liveLeads,
    config: { metaWeekdays, renewalCheckpoints, renewalGraceDays },
    leadsById: sources.leadsById,
    months: sources.months
  }), [now, users, contracts, liveLeads, metaWeekdays, renewalCheckpoints, renewalGraceDays, sources.leadsById, sources.months]);

  const cur = useMemo(() => metricsOf(ctx, { monthKey, userId }), [ctx, monthKey, userId]);
  const cmp = useMemo(
    () => (compareOn ? metricsOf(ctx, { monthKey: cmpKey, userId, cutEnd: comparisonCut(monthKey, cmpKey, now) }) : null),
    [compareOn, ctx, cmpKey, userId, monthKey, now]
  );
  const highlights = useMemo(() => (compareOn ? buildHighlights(cur, cmp) : []), [compareOn, cur, cmp]);
  const series = useMemo(() => ({
    meta: seriesOf(ctx, { monthKey, userId, pick: (m) => m.meta?.pct ?? null }),
    prosp: seriesOf(ctx, { monthKey, userId, pick: (m) => (m.prosp?.on ? m.prosp.pct : null) }),
    active: seriesOf(ctx, { monthKey, pick: (m) => m.base.active }),
    churn: seriesOf(ctx, { monthKey, pick: (m) => m.base.churn.pct }),
    renew: seriesOf(ctx, { monthKey, userId, pick: (m) => m.renewal.rate })
  }), [ctx, monthKey, userId]);
  const teamRows = useMemo(
    () => (userId ? [] : users.map((u) => ({ user: u, m: metricsOf(ctx, { monthKey, userId: u.id }) }))),
    [ctx, monthKey, userId, users]
  );

  // Textos do regime de comparação (README §7).
  const running = cur.running;
  const dayN = now.getDate();
  const range = running ? `1 a ${dayN} de ${monthLabel(monthKey, { capitalized: false, withYear: false })}` : `${monthLabel(monthKey, { capitalized: false, withYear: false })} inteiro`;
  const cmpName = monthLabel(cmpKey, { capitalized: false, withYear: cmpKey.slice(0, 4) !== monthKey.slice(0, 4) });
  const subline = compareOn
    ? (running ? `${range} comparado com os ${dayN} primeiros dias de ${cmpName}. O mês está em andamento, então a comparação é pró-rata.` : `${range} comparado com ${cmpName}. Mês fechado.`)
    : (running ? `${range}. O mês está em andamento: hoje conta à parte.` : `${range}. Mês fechado.`);
  const note = compareOn ? (running ? `Comparação pró-rata: mesmos ${dayN} primeiros dias` : 'Mês fechado contra mês fechado') : 'Sem comparativo';

  const spark = (points, fmt) => ({
    series: points.length > 1 ? points.map((p) => p.value) : null,
    seriesFrom: points[0] ? shortOf(points[0].key) : '',
    seriesTo: points.length ? `${shortOf(points[points.length - 1].key)}${running ? ' · parcial' : ''}` : '',
    seriesLabel: `${points.length} ${points.length === 1 ? 'mês' : 'meses'} · ${points.map((p) => `${shortOf(p.key)} ${fmt(p.value)}`).join(' · ')}`
  });
  const pctFmt = (v) => `${String(v).replace('.', ',')}%`;
  const brFmt = (v) => v.toLocaleString('pt-BR');
  const d = (a, b, kind) => (compareOn ? deltaOf(a, b, { kind }) : null);

  const summary = [
    { key: 'meta', label: 'Meta diária', goodUp: true, help: 'Dias com meta batida ÷ dias de meta do mês. No mês em andamento conta só os dias já fechados; hoje aparece à parte na régua de dias.',
      value: cur.meta?.pct != null ? `${cur.meta.pct}%` : '—', sub: cur.meta ? `${brFmt(cur.meta.done)} de ${brFmt(cur.meta.total)} ${userId ? 'dias' : 'dias-pessoa'}` : 'carregando',
      delta: d(cur.meta?.pct, cmp?.meta?.pct, 'pp'), ...spark(series.meta, pctFmt) },
    cur.prosp && !cur.prosp.on
      ? { key: 'prosp', label: 'Prospecção', value: 'Desligada', muted: true, sub: 'alvo 0 no cadastro', delta: null, series: null,
          help: 'Alvo diário 0 no cadastro: a pessoa está sem cota de prospecção. Não é 0%.' }
      : { key: 'prosp', label: 'Prospecção', goodUp: true, help: 'Ações de prospecção ÷ alvo do mês (alvo diário da pessoa × dias de meta).',
          value: cur.prosp?.pct != null ? `${cur.prosp.pct}%` : '—', sub: cur.prosp ? `${brFmt(cur.prosp.done)} de ${brFmt(cur.prosp.target)} ações` : 'carregando',
          delta: d(cur.prosp?.pct, cmp?.prosp?.pct, 'pp'), ...spark(series.prosp, pctFmt) },
    { key: 'active', label: 'Clientes ativos', goodUp: true, help: 'Pessoas com contrato vigente no fim do mês. Quem está trancado conta à parte.',
      value: cur.base.active != null ? brFmt(cur.base.active) : '—',
      sub: userId ? 'base da academia, não da carteira' : running ? 'com contrato vigente hoje' : 'no fim do mês',
      delta: d(cur.base.active, cmp?.base.active, 'count'), ...spark(series.active, brFmt) },
    { key: 'churn', label: 'Churn', goodUp: false, help: 'Cancelamentos mais vencidos que passaram da tolerância ÷ clientes ativos no início do mês.',
      value: cur.base.churn.pct != null ? pctFmt(cur.base.churn.pct) : '—', sub: userId ? 'base da academia' : 'saídas definitivas',
      delta: d(cur.base.churn.pct, cmp?.base.churn.pct, 'pp'), ...spark(series.churn, pctFmt) },
    { key: 'renew', label: 'Taxa de renovação', goodUp: true, help: 'Renovados ÷ vencendo. No mês em andamento, renovados ÷ contratos que já tiveram desfecho.',
      value: cur.renewal.rate != null ? `${cur.renewal.rate}%` : '—',
      sub: `${brFmt(cur.renewal.counts.renew)} de ${brFmt(cur.renewal.decided)} ${running ? 'com desfecho' : 'vencendo'}`,
      delta: d(cur.renewal.rate, cmp?.renewal.rate, 'pp'), ...spark(series.renew, pctFmt) }
  ];

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => addMonthsToKey(currentKey, -i)).map((k) => ({ key: k, label: `${monthLabel(k)}${k === currentKey ? ' · em andamento' : ''}` })),
    [currentKey]
  );
  const cmpOptions = compareOptions(monthKey).map((k) => ({ key: k, label: monthLabel(k) }));
  const people = users.map((u) => ({ id: u.id, name: u.name || 'Sem nome' }));

  return (
    <TooltipProvider delayDuration={150}>
      <div className="font-sans">
        <header className="px-8 pt-5 pb-4 bg-card">
          <h2 className="m-0 font-display text-[24px] font-bold tracking-tight">Operacional</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground leading-normal max-w-[820px]">{subline}</p>
        </header>
        <OperacionalToolbar
          monthKey={monthKey} monthOptions={monthOptions} onMonth={(k) => { setMonthKey(k); setCompareKey(null); }}
          canPrev onPrev={() => { setMonthKey(addMonthsToKey(monthKey, -1)); setCompareKey(null); }}
          canNext={monthKey < currentKey} onNext={() => { if (monthKey < currentKey) { setMonthKey(addMonthsToKey(monthKey, 1)); setCompareKey(null); } }}
          compareOn={compareOn} onCompareOn={setCompareOn}
          compareKey={cmpKey} compareOptions={cmpOptions} onCompare={setCompareKey}
          person={person} people={people} onPerson={setPerson}
          note={note}
        />
        <div className="relative">
          {sources.loading && (
            <div className="absolute inset-x-0 top-0 h-0.5 bg-brand-100 overflow-hidden" aria-hidden="true">
              <span className="block h-full w-2/5 bg-brand-600 motion-safe:animate-pulse" />
            </div>
          )}
          <div className={cn('transition-opacity', sources.loading && 'opacity-35')} aria-busy={sources.loading}>
            {compareOn && highlights.length > 0 && <div className="px-8 pt-[18px]"><DashHighlights items={highlights} /></div>}
            <div className="px-8 pt-5 pb-8 flex flex-col gap-[22px]">
              <DashSummaryBand items={summary} />
              {/* Rotina, Base de clientes, Renovação e Equipe no mês: portar a
                  ordem, as grades (1.55fr/1fr) e os títulos de seção com régua
                  de 2px das linhas 190 a 661 do handoff, usando os componentes
                  das Tasks 10 e 11, BreakdownCard para os dois cards de motivos
                  e os cards tracejados de mês fechado (linhas 315 a 325 e 569 a
                  579, ícone Lock). Dados: cur.prosp, cur.calendar, cur.tasks
                  (+ cmp.tasks para a marca e a coluna de diferença), cur.late,
                  cur.base.movement, cur.base.cancels, cur.upgrades, cur.base
                  (trancaram/destrancaram em cur.base.movement), cur.renewal,
                  cur.milestones, cur.upcoming, teamRows. */}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export { DashboardOperacionalView };
```

Complete o miolo indicado no comentário seguindo o handoff:
- Grade da Rotina: `minmax(0,1.55fr) minmax(0,1fr)`. Com a prospecção desligada, use `minmax(0,505px) minmax(0,1fr)`.
- As tarefas ocupam `span 2` quando o mês está em andamento e a equipe está na tela.
- O card "Atrasados agora" só aparece com uma pessoa filtrada. Com a equipe, o número vai para a coluna da tabela.
- Os cards de motivos usam `BreakdownCard`:
  - Cancelamentos: `items={cur.base.cancels.items}`, `total={cur.base.cancels.total}`, `eyebrow="Motivo mais comum"`, `sub={\`${total} cancelamentos\`}`, `emptyText="Nenhum cancelamento neste mês."`, `icon={TrendingDown}`.
  - Não vai renovar: `items={cur.renewal.wontReasons.items}`, `emptyText="Ninguém declarou que não vai renovar neste mês."`.
- "A vencer" usa `cur.upcoming`, com os rótulos "até 30 dias", "31 a 60 dias" e "61 a 90 dias".
- "Upgrades e trancamentos":
  - Upgrades: `cur.upgrades`, com a diferença contra `cmp?.upgrades`.
  - Trancamentos: saldo `cur.base.movement.steps.trancamentos`, com o detalhe "`N trancaram · M destrancaram`".
- "Equipe no mês" só aparece com "Equipe toda".

- [ ] **Step 3: Ligar no `App.jsx`**

Trocar a linha do Operacional (perto da 1696) por:

```jsx
              {resolvedTab === 'dashOperacional' && <DashboardOperacionalView appUser={appUser} usersList={usersList} liveLeads={metaLeads} interactions={interactions} db={db} listenersActive={listenersActive} />}
```

A tela é a mesma para todos. As interações do mês corrente vão sem filtro, porque as regras já deixam qualquer membro ler.

- [ ] **Step 4: Build, lint e commit**

Run: `npm run lint && npm run build`
Expected: nenhum erro novo de lint e build verde.

```bash
git add src/views/dashboard/TeamMonthTable.jsx src/views/dashboard/DashboardOperacionalView.jsx src/App.jsx
git commit -m "feat: nova tela Operacional por competência" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: Limpeza do que só a tela antiga usava

**Files:**
- Modify: `src/lib/dashboardMetrics.js` (remover `computeTodayAgenda`, `computeNoShowsToRework`, `computePendingFollowUps`, `buildDayRange`, `computeDayFunnel`, `computeConsultantDayBoard`)
- Modify: `src/lib/__tests__/dashboardMetrics.test.js` (remover os imports e os `describe` dessas funções, linhas ~24 a 30, ~365 a 405, ~485 a 625)
- Modify: `src/views/dashboard/DashPrimitives.jsx` (remover `DashTimeline`, `TL_DOT`, `timelineBadge`, `timelineSub` e os imports que ficarem sem uso: `getLeadAppointmentType`, `getLeadAppointmentDate`, `getAppointmentOutcomeMeta`, `formatHourLabel`)
- Delete: `src/components/ui/LeadListPanel.jsx` (se `grep -rn LeadListPanel src` não mostrar outro uso)

- [ ] **Step 1: Confirmar que ninguém mais usa**

Run: `grep -rn "computeTodayAgenda\|computeNoShowsToRework\|computePendingFollowUps\|computeDayFunnel\|computeConsultantDayBoard\|DashTimeline\|LeadListPanel" src | grep -v __tests__`
Expected: só as definições que vão sair.

- [ ] **Step 2: Remover e rodar a suíte inteira**

Run: `npm test && npm run lint && npm run build`
Expected: tudo verde. O total de testes cai pelos testes removidos e sobe pelos novos das Tasks 1 a 9.

- [ ] **Step 3: Commit**

```bash
git add -A src/lib/dashboardMetrics.js src/lib/__tests__/dashboardMetrics.test.js src/views/dashboard/DashPrimitives.jsx src/components/ui/LeadListPanel.jsx
git commit -m "refactor: remove as peças da tela Operacional antiga" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 14: Verificação final e PR

- [ ] **Step 1: Suíte, lint e build**

Run: `npm test && npm run lint && npm run build`
Expected: tudo verde.

- [ ] **Step 2: Olhar a tela ao vivo (preview)**

O preview local aponta para o Firebase de produção e precisa do `.env.local` do checkout principal (ver memória `funil-upgrade`). Suba com o `preview_start` e confira, logado:
- mês em andamento com "Equipe toda" e comparação ligada;
- troca para um mês fechado (os cards tracejados aparecem);
- "Comparar" desligado (os destaques somem);
- uma pessoa filtrada (a tabela some e a base continua da academia);
- uma pessoa com a prospecção desligada;
- celular a 390px;
- tema escuro;
- dica no foco do teclado de uma barra.

Derrube o servidor ao terminar.

- [ ] **Step 3: Abrir a PR (sem merge)**

```bash
git push -u origin claude/operational-dashboard-redesign-7508c0
gh pr create --title "Operacional por competência" --body "$(cat <<'EOF'
Nova tela Operacional: mensal, igual para todos, com comparativo entre meses e filtro de pessoa, portada do handoff do Claude Design.

- Matemática em src/lib/operacional/ (metricsOf: uma função para o mês, o comparado e as tendências)
- Carga por mês com cache de mês fechado conferido por contagem
- "Não vai renovar" com motivo da lista fixa
- Dia de meta batida gravado de qualquer tela
- Remove a tela do dia antiga

Antes do merge:
- publicar a regra nova de stronix_daily_goal_history no console do Firebase
- teste ao vivo logado (gestor e consultor)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR aberta contra `main`. Merge só com a aprovação do Johnny.
