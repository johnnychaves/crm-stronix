# Tela Gerencial — plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development para executar tarefa a tarefa. Os passos usam caixinha (`- [ ]`).

**Objetivo:** substituir a página "Em breve" da aba Gerencial pela tela do dinheiro vendido, fiel ao handoff do Claude Design.

**Arquitetura:** matemática pura e testada em `src/lib/gerencial/`, uma função `metricsOf` que devolve o mês inteiro; apresentação em componentes novos de `src/views/dashboard/`; estado e carga em `DashboardGerencialView.jsx`, no molde do CRM. Os contratos e os planos já chegam pelo `useGeneralConfig()`, então a tela não abre consulta nova, tirando os docs de lead das vendas do mês (origem), buscados por id com o cache de sessão.

**Stack:** React 19, Tailwind v4 com tokens do `src/index.css`, shadcn (`Tooltip`, `Checkbox`, `Separator`), Vitest com `renderToString`.

**Fontes da verdade:**
- Handoff: `docs/superpowers/specs/handoff-gerencial/README.md` e `Gerencial.dc.html` (protótipo; servir em `http://localhost:5198/Gerencial.dc.html` pelo `handoff-gerencial` do `.claude/launch.json`).
- Spec: `docs/superpowers/specs/2026-09-17-dashboard-gerencial-design.md`.
- Telas irmãs, como molde de código: `src/views/dashboard/DashboardCrmView.jsx`, `CrmDashboard.jsx`, `DashPrimitives.jsx`, `src/lib/crm/metrics.js`.

---

## Desvios do handoff, decididos antes de começar

1. **Sem seletor de academia.** No protótipo ele existe só para demonstrar as três bases. Em produção cada academia tem seu login (`tenantId`). Os três estados viram condição de dado, não controle.
2. **Sem generalizar a barra para `DashToolbar`.** O handoff sugere unificar com a do Operacional. Mexer numa barra que serve duas telas em produção é risco sem ganho nesta entrega. Criamos `GerencialToolbar.jsx` no mesmo molde visual do `CrmToolbar`, com o chip fixo de aviso. A unificação fica anotada como follow-up.
3. **Ticket mensal por consultor é conta exata, não média de duração.** O handoff usa `AVG_MONTHS` como stand-in e pede para substituir. A conta certa é a soma dos tickets mensais das vendas da pessoa dividida pelo número de vendas. Nada de duração média.
4. **Upgrade fica em `violet-500`**, como o handoff desenhou.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/gerencial/scope.js` (criar) | O que é venda, tipo da venda, ticket mensal, contrato sem valor |
| `src/lib/gerencial/sales.js` (criar) | Venda do mês: total, contagem, ticket, desconto, mix, cancelado depois |
| `src/lib/gerencial/wallet.js` (criar) | Carteira: contratos vigentes, valor por mês, ticket médio, trancados, sobreposição, sem valor |
| `src/lib/gerencial/risk.js` (criar) | 30/60/90, % da carteira, já venceu sem sucessor, saídas do mês |
| `src/lib/gerencial/people.js` (criar) | Ranking de consultor, planos e origem |
| `src/lib/gerencial/queries.js` (criar) | Ids de lead das vendas do mês (origem) |
| `src/lib/gerencial/texts.js` (criar) | Sublines, dicas e notas do §6 do handoff |
| `src/lib/gerencial/metrics.js` (criar) | `metricsOf(ctx, { monthKey, cutEnd })` e `deltaOf` |
| `src/views/dashboard/SoldHeroCard.jsx` (criar) | Painel da venda do mês |
| `src/views/dashboard/WalletBand.jsx` (criar) | Faixa de 4 células da carteira |
| `src/views/dashboard/ExpiryRunway.jsx` (criar) | Esteira 30/60/90 com trilha tracejada |
| `src/views/dashboard/ExitsCard.jsx` (criar) | Cancelamentos e trancamentos |
| `src/views/dashboard/SellerRankTable.jsx` (criar) | Ranking com as duas colunas de ticket |
| `src/views/dashboard/GerencialParts.jsx` (criar) | `BlindValueNote` e `GerencialEmpty` |
| `src/views/dashboard/GerencialToolbar.jsx` (criar) | Barra fixa: mês, comparar, chip de aviso |
| `src/views/dashboard/GerencialDashboard.jsx` (criar) | Corpo da tela, monta as quatro seções |
| `src/views/dashboard/DashboardGerencialView.jsx` (SUBSTITUIR) | Hoje é código morto do dashboard antigo. Vira estado, carga e orquestração |
| `src/views/dashboard/DashboardComingSoonView.jsx` (apagar) | Fica sem uso quando a aba Gerencial ganha tela |
| `src/App.jsx:82,1706` (editar) | Trocar o "Em breve" pela tela |
| `CLAUDE.md` (editar) | Seção do Gerencial, no molde da seção do CRM |

---

## Task 1: scope.js, as regras de recorte

**Arquivos:**
- Criar: `src/lib/gerencial/scope.js`
- Testar: `src/lib/gerencial/__tests__/scope.test.js`

Contexto: os contratos chegam já normalizados por `normalizeContracts` (`src/lib/operacional/base.js`), que dá `startsAt`, `endsAt`, `createdAt`, `cancelledAt`, `pauses`, `imported`, `cancelFromImport` e `personKey`, tudo com `Date` ou null.

- [ ] **Passo 1: escrever o teste que falha**

```js
// src/lib/gerencial/__tests__/scope.test.js
import { describe, it, expect } from 'vitest';
import { SALE_TYPES, saleMoment, monthlyTicket, hasValue, saleTypeOf } from '../scope.js';
import { indexContracts } from '../../operacional/base.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const c = (over) => ({ id: 'c1', personKey: 'p1', value: 1200, durationMonths: 12, startsAt: D(2026, 9, 1), createdAt: D(2026, 9, 1), ...over });

describe('saleMoment', () => {
  it('é a criação do contrato, com o início da vigência de reserva', () => {
    expect(saleMoment(c({ createdAt: D(2026, 8, 20) }))).toEqual(D(2026, 8, 20));
    expect(saleMoment(c({ createdAt: null }))).toEqual(D(2026, 9, 1));
    expect(saleMoment(c({ createdAt: null, startsAt: null }))).toBeNull();
  });
});

describe('monthlyTicket', () => {
  it('divide o valor pela duração', () => {
    expect(monthlyTicket(c({ value: 1200, durationMonths: 12 }))).toBe(100);
    expect(monthlyTicket(c({ value: 249, durationMonths: 1 }))).toBe(249);
  });
  it('sem duração, o valor inteiro vale por um mês', () => {
    expect(monthlyTicket(c({ value: 300, durationMonths: 0 }))).toBe(300);
  });
  it('contrato sem valor não gera ticket', () => {
    expect(monthlyTicket(c({ value: 0, durationMonths: 12 }))).toBe(0);
    expect(hasValue(c({ value: 0 }))).toBe(false);
    expect(hasValue(c({ value: 1200 }))).toBe(true);
  });
});

describe('saleTypeOf', () => {
  const byPerson = (list) => indexContracts(list).byPerson;

  it('contrato ligado a outro é renovação, mesmo vindo do upgrade', () => {
    const list = [c({ id: 'a' }), c({ id: 'b', renewedFromId: 'a', closedFromUpgrade: true, createdAt: D(2026, 9, 5), startsAt: D(2026, 9, 5) })];
    expect(saleTypeOf(list[1], byPerson(list))).toBe(SALE_TYPES.RENOVACAO);
  });

  it('fechado dentro do funil Upgrade, sem contrato de origem, é upgrade', () => {
    const list = [c({ id: 'a' }), c({ id: 'b', closedFromUpgrade: true, createdAt: D(2026, 9, 5), startsAt: D(2026, 9, 5) })];
    expect(saleTypeOf(list[1], byPerson(list))).toBe(SALE_TYPES.UPGRADE);
  });

  it('primeiro contrato da pessoa é matrícula nova', () => {
    const list = [c({ id: 'a' })];
    expect(saleTypeOf(list[0], byPerson(list))).toBe(SALE_TYPES.NOVA);
  });

  it('contrato novo de quem já teve outro antes é retorno', () => {
    const list = [c({ id: 'a', createdAt: D(2025, 3, 1), startsAt: D(2025, 3, 1) }), c({ id: 'b' })];
    expect(saleTypeOf(list[1], byPerson(list))).toBe(SALE_TYPES.RETORNO);
  });

  it('pessoas diferentes não se misturam', () => {
    const list = [c({ id: 'a', personKey: 'p2', createdAt: D(2025, 3, 1) }), c({ id: 'b' })];
    expect(saleTypeOf(list[1], byPerson(list))).toBe(SALE_TYPES.NOVA);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/lib/gerencial/__tests__/scope.test.js`
Esperado: falha com "Failed to resolve import ../scope.js".

- [ ] **Passo 3: implementar**

```js
// src/lib/gerencial/scope.js
// Regras de recorte do Gerencial. A lista chega normalizada por
// normalizeContracts (src/lib/operacional/base.js): datas viram Date, a pausa
// do trancamento já está montada e o importado vem marcado.

export const SALE_TYPES = { NOVA: 'nova', RENOVACAO: 'renovacao', UPGRADE: 'upgrade', RETORNO: 'retorno' };

// A venda conta no instante em que o contrato foi fechado. Contrato antigo sem
// createdAt cai no início da vigência, igual ao Operacional.
export const saleMoment = (c) => c?.createdAt || c?.startsAt || null;

// Contrato importado veio sem valor (494 na STRONIX). Ele é gente de verdade e
// entra na contagem, mas nunca na soma de dinheiro nem no denominador do ticket.
export const hasValue = (c) => Number(c?.value) > 0;

// Quanto o contrato vale por mês. Plano sem duração gravada vale por um mês, que
// é o pior caso e não infla a carteira.
export const monthlyTicket = (c) => {
  const value = Number(c?.value) || 0;
  const months = Number(c?.durationMonths) || 0;
  return months > 0 ? value / months : value;
};

// Cada contrato entra em um tipo só, nesta ordem. Renovação ganha do upgrade
// porque o mesmo contrato pode ser os dois, e é uma venda só.
export function saleTypeOf(c, byPerson) {
  if (c?.renewedFromId) return SALE_TYPES.RENOVACAO;
  if (c?.closedFromUpgrade) return SALE_TYPES.UPGRADE;
  const t = saleMoment(c);
  const earlier = (byPerson?.get(c?.personKey) || []).some((o) => {
    const ot = saleMoment(o);
    return o !== c && ot && t && ot < t;
  });
  return earlier ? SALE_TYPES.RETORNO : SALE_TYPES.NOVA;
}

export const inWindow = (d, start, end) => Boolean(d) && d >= start && d < end;
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run src/lib/gerencial/__tests__/scope.test.js`
Esperado: 8 testes verdes.

- [ ] **Passo 5: commitar**

```bash
git add src/lib/gerencial/scope.js src/lib/gerencial/__tests__/scope.test.js
git commit -m "feat(gerencial): regras de recorte da venda, ticket mensal e contrato sem valor"
```

---

## Task 2: sales.js, a venda do mês

**Arquivos:**
- Criar: `src/lib/gerencial/sales.js`
- Testar: `src/lib/gerencial/__tests__/sales.test.js`

O protótipo (`Gerencial.dc.html:790`) define o formato: `{ sold, count, ticket, discPct, discAbs, mix, clawCount, clawValue }`.

- [ ] **Passo 1: escrever o teste que falha**

```js
// src/lib/gerencial/__tests__/sales.test.js
import { describe, it, expect } from 'vitest';
import { salesOf } from '../sales.js';
import { SALE_TYPES } from '../scope.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const start = D(2026, 9, 1);
const end = D(2026, 10, 1);
const c = (over) => ({ id: 'c', personKey: 'p', value: 1200, listValue: 1200, durationMonths: 12, createdAt: D(2026, 9, 10), startsAt: D(2026, 9, 10), ...over });

describe('salesOf', () => {
  it('soma o que foi fechado dentro da janela', () => {
    const r = salesOf([c({ id: 'a' }), c({ id: 'b', personKey: 'p2', value: 600, durationMonths: 6 })], { start, end });
    expect(r.sold).toBe(1800);
    expect(r.count).toBe(2);
  });

  it('a renovação assinada antes conta no mês em que foi fechada', () => {
    const fora = c({ id: 'x', createdAt: D(2026, 8, 28), startsAt: D(2026, 9, 15) });
    expect(salesOf([fora], { start, end }).count).toBe(0);
  });

  it('o ticket é a média dos tickets mensais, não o total dividido pelos meses', () => {
    const r = salesOf([c({ id: 'a', value: 1200, durationMonths: 12 }), c({ id: 'b', personKey: 'p2', value: 300, durationMonths: 1 })], { start, end });
    expect(r.ticket).toBe(200); // (100 + 300) / 2
  });

  it('desconto é a tabela menos o fechado', () => {
    const r = salesOf([c({ value: 1100, listValue: 1200 })], { start, end });
    expect(r.discAbs).toBe(100);
    expect(r.discPct).toBe(8);
  });

  it('cada contrato entra num tipo só e o mix fecha com o total', () => {
    const list = [
      c({ id: 'a' }),
      c({ id: 'b', personKey: 'p2', renewedFromId: 'z' }),
      c({ id: 'c', personKey: 'p3', closedFromUpgrade: true })
    ];
    const r = salesOf(list, { start, end });
    expect(r.mix.reduce((s, m) => s + m.count, 0)).toBe(3);
    expect(r.mix.reduce((s, m) => s + m.value, 0)).toBe(r.sold);
    expect(r.mix.find((m) => m.type === SALE_TYPES.RENOVACAO).count).toBe(1);
  });

  it('venda cancelada depois continua no total, com a marca', () => {
    const r = salesOf([c({ id: 'a' }), c({ id: 'b', personKey: 'p2', cancelledAt: D(2026, 9, 20) })], { start, end });
    expect(r.count).toBe(2);
    expect(r.sold).toBe(2400);
    expect(r.clawCount).toBe(1);
    expect(r.clawValue).toBe(1200);
  });

  it('contrato importado não é venda', () => {
    expect(salesOf([c({ imported: true })], { start, end }).count).toBe(0);
  });

  it('mês sem venda devolve zeros, não null', () => {
    const r = salesOf([], { start, end });
    expect(r).toMatchObject({ sold: 0, count: 0, ticket: 0, discAbs: 0, discPct: 0, clawCount: 0 });
    expect(r.mix).toEqual([]);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/lib/gerencial/__tests__/sales.test.js`
Esperado: falha por import não resolvido.

- [ ] **Passo 3: implementar**

```js
// src/lib/gerencial/sales.js
// A venda do mês: o que foi fechado entre start e end. Nada aqui olha vigência,
// só o instante do fechamento.

import { indexContracts } from '../operacional/base.js';
import { SALE_TYPES, saleMoment, monthlyTicket, saleTypeOf, inWindow } from './scope.js';

const ORDER = [SALE_TYPES.NOVA, SALE_TYPES.RENOVACAO, SALE_TYPES.UPGRADE, SALE_TYPES.RETORNO];

export function soldContracts(contracts, { start, end }) {
  return (contracts || []).filter((c) => !c.imported && inWindow(saleMoment(c), start, end));
}

export function salesOf(contracts, { start, end }) {
  const rows = soldContracts(contracts, { start, end });
  const { byPerson } = indexContracts(contracts || []);
  const sold = rows.reduce((s, c) => s + (Number(c.value) || 0), 0);
  const count = rows.length;
  const list = rows.reduce((s, c) => s + (Number(c.listValue) || Number(c.value) || 0), 0);
  const discAbs = Math.max(0, list - sold);
  const byType = new Map();
  rows.forEach((c) => {
    const type = saleTypeOf(c, byPerson);
    const cur = byType.get(type) || { type, count: 0, value: 0 };
    cur.count += 1;
    cur.value += Number(c.value) || 0;
    byType.set(type, cur);
  });
  const claw = rows.filter((c) => c.cancelledAt);
  return {
    rows,
    sold,
    count,
    // Média dos tickets mensais das vendas: um anual e um mensal pesam igual.
    ticket: count ? rows.reduce((s, c) => s + monthlyTicket(c), 0) / count : 0,
    discAbs,
    discPct: list > 0 ? Math.round((discAbs / list) * 100) : 0,
    mix: ORDER.map((type) => byType.get(type)).filter(Boolean).map((m) => ({
      ...m,
      pct: sold > 0 ? (m.value / sold) * 100 : 0
    })),
    clawCount: claw.length,
    clawValue: claw.reduce((s, c) => s + (Number(c.value) || 0), 0)
  };
}
```

Nada de guardar o tipo dentro do objeto do contrato: a lista vem do estado do React e é tratada como imutável.

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run src/lib/gerencial/__tests__/sales.test.js`
Esperado: 8 testes verdes.

- [ ] **Passo 5: commitar**

```bash
git add src/lib/gerencial/sales.js src/lib/gerencial/__tests__/sales.test.js
git commit -m "feat(gerencial): venda do mês com mix por tipo e cancelamento posterior"
```

---

## Task 3: wallet.js, a carteira hoje

**Arquivos:**
- Criar: `src/lib/gerencial/wallet.js`
- Testar: `src/lib/gerencial/__tests__/wallet.test.js`

Formato alvo (`Gerencial.dc.html:836`): `{ count, monthly, ticket, lockedCount, lockedMonthly, overlap, blind }`.

Regras, do §8 do handoff: o ticket médio é `monthly ÷ contratos COM valor`, nunca ÷ total. Trancado conta na carteira, com a contagem à parte. A carteira soma contrato, não pessoa, e `overlap` é quantas pessoas têm dois ou mais contratos ali dentro.

- [ ] **Passo 1: escrever o teste que falha**

```js
// src/lib/gerencial/__tests__/wallet.test.js
import { describe, it, expect } from 'vitest';
import { walletAt } from '../wallet.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const now = D(2026, 9, 17);
const c = (over) => ({ id: 'c', personKey: 'p', value: 1200, durationMonths: 12, startsAt: D(2026, 1, 1), endsAt: D(2027, 1, 1), pauses: [], ...over });

describe('walletAt', () => {
  it('conta contrato vigente e soma o ticket mensal', () => {
    const w = walletAt([c({ id: 'a' }), c({ id: 'b', personKey: 'p2', value: 600, durationMonths: 6 })], now);
    expect(w.count).toBe(2);
    expect(w.monthly).toBe(200);
    expect(w.ticket).toBe(100);
  });

  it('contrato que ainda não começou ou já acabou fica fora', () => {
    const w = walletAt([c({ startsAt: D(2026, 10, 1), endsAt: D(2027, 10, 1) }), c({ id: 'b', personKey: 'p2', endsAt: D(2026, 8, 1) })], now);
    expect(w.count).toBe(0);
  });

  it('trancado continua na carteira e aparece à parte', () => {
    const w = walletAt([c({ id: 'a' }), c({ id: 'b', personKey: 'p2', pauses: [{ from: D(2026, 8, 1), to: null }] })], now);
    expect(w.count).toBe(2);
    expect(w.lockedCount).toBe(1);
    expect(w.lockedMonthly).toBe(100);
    expect(w.monthly).toBe(200);
  });

  it('contrato sem valor entra na contagem e fica fora do dinheiro e do ticket', () => {
    const w = walletAt([c({ id: 'a' }), c({ id: 'b', personKey: 'p2', value: 0, durationMonths: 0 })], now);
    expect(w.count).toBe(2);
    expect(w.blind).toBe(1);
    expect(w.monthly).toBe(100);
    expect(w.ticket).toBe(100); // 100 ÷ 1 contrato com valor, nunca ÷ 2
  });

  it('duas vigências da mesma pessoa contam duas vezes e viram sobreposição', () => {
    const w = walletAt([c({ id: 'a' }), c({ id: 'b' })], now);
    expect(w.count).toBe(2);
    expect(w.overlap).toBe(1);
  });

  it('cancelado sai na hora do cancelamento', () => {
    expect(walletAt([c({ cancelledAt: D(2026, 9, 1) })], now).count).toBe(0);
  });

  it('base vazia devolve zeros', () => {
    expect(walletAt([], now)).toMatchObject({ count: 0, monthly: 0, ticket: 0, blind: 0, overlap: 0 });
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/lib/gerencial/__tests__/wallet.test.js`

- [ ] **Passo 3: implementar**

```js
// src/lib/gerencial/wallet.js
// A carteira num instante: quantos contratos estão de pé e quanto valem por
// mês. Soma contrato e não pessoa, porque contrato paralelo é permitido.

import { contractStateAt } from '../operacional/base.js';
import { hasValue, monthlyTicket } from './scope.js';

export function walletAt(contracts, t) {
  const inside = [];
  (contracts || []).forEach((c) => {
    const state = contractStateAt(c, t);
    if (state) inside.push({ c, state });
  });
  const withValue = inside.filter(({ c }) => hasValue(c));
  const monthly = withValue.reduce((s, { c }) => s + monthlyTicket(c), 0);
  const locked = inside.filter(({ state }) => state === 'trancado');
  const people = new Map();
  inside.forEach(({ c }) => people.set(c.personKey, (people.get(c.personKey) || 0) + 1));
  return {
    count: inside.length,
    monthly,
    // Contrato sem valor não pode entrar no denominador (§8 do handoff).
    ticket: withValue.length ? monthly / withValue.length : 0,
    lockedCount: locked.length,
    lockedMonthly: locked.filter(({ c }) => hasValue(c)).reduce((s, { c }) => s + monthlyTicket(c), 0),
    blind: inside.length - withValue.length,
    overlap: [...people.values()].filter((n) => n > 1).length
  };
}
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run src/lib/gerencial/__tests__/wallet.test.js`
Esperado: 7 testes verdes.

- [ ] **Passo 5: commitar**

```bash
git add src/lib/gerencial/wallet.js src/lib/gerencial/__tests__/wallet.test.js
git commit -m "feat(gerencial): carteira por valor mensal, com trancado dentro e sem valor à parte"
```

---

## Task 4: risk.js, o que posso perder

**Arquivos:**
- Criar: `src/lib/gerencial/risk.js`
- Testar: `src/lib/gerencial/__tests__/risk.test.js`

Formato alvo (`Gerencial.dc.html:839`): `horizon: [{ label, count, v, blind }]`, mais `expired` (já venceu e ninguém renovou) e `exits` (cancelamentos e trancamentos do mês).

Regras: só contrato vigente vence; trancado não vence enquanto está parado, porque o fim anda na reativação. Sucessor é a renovação ligada (`renewedFromId`) ou outro contrato da mesma pessoa que comece depois. A porcentagem da carteira é a soma dos três horizontes dividida pelo valor por mês da carteira, calculada no `metrics.js`, nunca gravada.

- [ ] **Passo 1: escrever o teste que falha**

```js
// src/lib/gerencial/__tests__/risk.test.js
import { describe, it, expect } from 'vitest';
import { expiryHorizons, expiredWithoutSuccessor, exitsInWindow } from '../risk.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const now = D(2026, 9, 17);
const c = (over) => ({ id: 'c', personKey: 'p', value: 1200, durationMonths: 12, startsAt: D(2025, 10, 1), endsAt: D(2026, 10, 1), pauses: [], ...over });

describe('expiryHorizons', () => {
  it('separa 30, 60 e 90 dias e soma o valor por mês', () => {
    const list = [
      c({ id: 'a', endsAt: D(2026, 10, 1) }),
      c({ id: 'b', personKey: 'p2', endsAt: D(2026, 11, 1) }),
      c({ id: 'd', personKey: 'p3', endsAt: D(2026, 12, 10) })
    ];
    const h = expiryHorizons(list, now);
    expect(h.map((x) => x.count)).toEqual([1, 1, 1]);
    expect(h[0].v).toBe(100);
  });

  it('contrato sem valor entra em blind, nunca no valor', () => {
    const h = expiryHorizons([c({ value: 0, durationMonths: 0 })], now);
    expect(h[0].blind).toBe(1);
    expect(h[0].count).toBe(0);
    expect(h[0].v).toBe(0);
  });

  it('trancado não vence', () => {
    const h = expiryHorizons([c({ pauses: [{ from: D(2026, 8, 1), to: null }] })], now);
    expect(h[0].count).toBe(0);
  });

  it('o que vence depois de 90 dias fica fora', () => {
    expect(expiryHorizons([c({ endsAt: D(2027, 3, 1) })], now).every((h) => h.count === 0)).toBe(true);
  });
});

describe('expiredWithoutSuccessor', () => {
  it('conta quem passou do fim sem contrato seguinte', () => {
    const r = expiredWithoutSuccessor([c({ endsAt: D(2026, 7, 1) })], now);
    expect(r.count).toBe(1);
  });

  it('com renovação ligada, não conta', () => {
    const list = [c({ id: 'a', endsAt: D(2026, 7, 1) }), c({ id: 'b', renewedFromId: 'a', startsAt: D(2026, 7, 1), endsAt: D(2027, 7, 1) })];
    expect(expiredWithoutSuccessor(list, now).count).toBe(0);
  });

  it('com outro contrato da pessoa começando depois, não conta', () => {
    const list = [c({ id: 'a', endsAt: D(2026, 7, 1) }), c({ id: 'b', startsAt: D(2026, 8, 1), endsAt: D(2027, 8, 1) })];
    expect(expiredWithoutSuccessor(list, now).count).toBe(0);
  });
});

describe('exitsInWindow', () => {
  const start = D(2026, 9, 1);
  const end = D(2026, 10, 1);

  it('cancelamento do mês, com o valor mensal', () => {
    const r = exitsInWindow([c({ cancelledAt: D(2026, 9, 5) })], { start, end });
    expect(r.items[0]).toMatchObject({ kind: 'cancelamento', count: 1, v: 100 });
  });

  it('trancamento do mês entra como parada', () => {
    const r = exitsInWindow([c({ pauses: [{ from: D(2026, 9, 3), to: null }] })], { start, end });
    expect(r.items[1]).toMatchObject({ kind: 'trancamento', count: 1, v: 100 });
  });

  it('cancelamento e pausa vindos da importação não contam', () => {
    const r = exitsInWindow([
      c({ cancelledAt: D(2026, 9, 5), cancelFromImport: true }),
      c({ id: 'b', personKey: 'p2', pauses: [{ from: D(2026, 9, 3), to: null, fromImport: true }] })
    ], { start, end });
    expect(r.total).toBe(0);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/lib/gerencial/__tests__/risk.test.js`

- [ ] **Passo 3: implementar**

```js
// src/lib/gerencial/risk.js
// O que sai da carteira: o que vence nos próximos 90 dias, o que já venceu sem
// sucessor e o que saiu neste mês.

import { contractStateAt, indexContracts } from '../operacional/base.js';
import { hasValue, monthlyTicket, inWindow } from './scope.js';

const DAY = 24 * 60 * 60 * 1000;
export const HORIZON_DAYS = [30, 60, 90];

// Só contrato vigente vence. Trancado não: o fim dele anda quando reativar.
export function expiryHorizons(contracts, t) {
  const edges = HORIZON_DAYS.map((d) => new Date(t.getTime() + d * DAY));
  const rows = HORIZON_DAYS.map((days) => ({ days, label: `Em ${days} dias`, count: 0, v: 0, blind: 0 }));
  (contracts || []).forEach((c) => {
    if (contractStateAt(c, t) !== 'vigente' || !c.endsAt) return;
    const i = edges.findIndex((edge) => c.endsAt < edge);
    if (i < 0) return;
    if (hasValue(c)) {
      rows[i].count += 1;
      rows[i].v += monthlyTicket(c);
    } else {
      rows[i].blind += 1;
    }
  });
  return rows;
}

// Sucessor: a renovação ligada ou outro contrato da pessoa que começa depois
// deste. Mesma ideia de src/lib/operacional/renewal.js, simplificada porque
// aqui só importa existir ou não.
function hasSuccessor(c, index) {
  if ((index.byRenewedFrom.get(c.id) || []).length) return true;
  return (index.byPerson.get(c.personKey) || []).some((o) => o !== c && o.startsAt && c.startsAt && o.startsAt > c.startsAt);
}

export function expiredWithoutSuccessor(contracts, t) {
  const index = indexContracts(contracts || []);
  const rows = (contracts || []).filter((c) => (
    c.endsAt && c.endsAt <= t && !c.cancelledAt && !hasSuccessor(c, index)
  ));
  return { count: rows.length, v: rows.filter(hasValue).reduce((s, c) => s + monthlyTicket(c), 0) };
}

export function exitsInWindow(contracts, { start, end }) {
  const cancels = [];
  const locks = [];
  (contracts || []).forEach((c) => {
    if (c.cancelledAt && !c.cancelFromImport && inWindow(c.cancelledAt, start, end)) cancels.push(c);
    if ((c.pauses || []).some((p) => !p.fromImport && inWindow(p.from, start, end))) locks.push(c);
  });
  const money = (list) => list.filter(hasValue).reduce((s, c) => s + monthlyTicket(c), 0);
  const items = [
    { kind: 'cancelamento', label: 'Cancelamentos', count: cancels.length, v: money(cancels) },
    { kind: 'trancamento', label: 'Trancamentos', count: locks.length, v: money(locks) }
  ];
  return { items, total: items.reduce((s, i) => s + i.v, 0) };
}
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run src/lib/gerencial/__tests__/risk.test.js`
Esperado: 10 testes verdes.

- [ ] **Passo 5: commitar**

```bash
git add src/lib/gerencial/risk.js src/lib/gerencial/__tests__/risk.test.js
git commit -m "feat(gerencial): vencimentos em 30/60/90, já vencido sem sucessor e saídas do mês"
```

---

## Task 5: people.js, quem traz receita

**Arquivos:**
- Criar: `src/lib/gerencial/people.js`
- Testar: `src/lib/gerencial/__tests__/people.test.js`

Três rankings, todos sobre as vendas do mês (`rows` do `salesOf`): consultor, plano e origem do lead.

Colunas do consultor, do §7 do handoff: `value` (vendido), `count` (vendas), `perSale` (value ÷ count), `monthly` (média dos tickets mensais das vendas da pessoa) e `share` (value ÷ vendido no mês). Nada de duração média.

- [ ] **Passo 1: escrever o teste que falha**

```js
// src/lib/gerencial/__tests__/people.test.js
import { describe, it, expect } from 'vitest';
import { sellersOf, plansOf, sourcesOf } from '../people.js';

const c = (over) => ({ id: 'c', value: 1200, durationMonths: 12, consultantId: 'u1', consultantName: 'Ana Ribeiro', planId: 'anual', planName: 'Anual Musculação', leadId: 'l1', ...over });

describe('sellersOf', () => {
  it('agrupa por consultor com as duas colunas de ticket', () => {
    const rows = [c({ id: 'a' }), c({ id: 'b', value: 600, durationMonths: 6 })];
    const [ana] = sellersOf(rows, 1800);
    expect(ana).toMatchObject({ id: 'u1', name: 'Ana Ribeiro', count: 2, value: 1800, perSale: 900, monthly: 100, share: 100 });
  });

  it('ordena por valor e guarda o lugar', () => {
    const rows = [c({ id: 'a', value: 600 }), c({ id: 'b', consultantId: 'u2', consultantName: 'Diego Santos', value: 1200 })];
    expect(sellersOf(rows, 1800).map((r) => r.name)).toEqual(['Diego Santos', 'Ana Ribeiro']);
  });

  it('venda sem consultor vira "Sem consultor"', () => {
    expect(sellersOf([c({ consultantId: null, consultantName: null })], 1200)[0].name).toBe('Sem consultor');
  });
});

describe('plansOf', () => {
  it('a combinação de modalidades é um grupo próprio', () => {
    const rows = [
      c({ id: 'a', planId: 'musc', planName: 'Anual Musculação' }),
      c({ id: 'b', planId: 'mp', planName: 'Musculação + Pilates', value: 1800 })
    ];
    const out = plansOf(rows, 3000);
    expect(out.map((p) => p.name)).toEqual(['Musculação + Pilates', 'Anual Musculação']);
    expect(out[0].count).toBe(1);
  });

  it('plano apagado ainda soma pelo nome gravado no contrato', () => {
    expect(plansOf([c({ planId: null, planName: 'Plano antigo' })], 1200)[0].name).toBe('Plano antigo');
  });
});

describe('sourcesOf', () => {
  it('usa a origem do lead que fechou', () => {
    const leadsById = new Map([['l1', { source: 'Instagram' }], ['l2', { source: 'Indicação' }]]);
    const rows = [c({ id: 'a' }), c({ id: 'b', leadId: 'l2', value: 600 })];
    const out = sourcesOf(rows, 1800, leadsById);
    expect(out.map((s) => s.name)).toEqual(['Instagram', 'Indicação']);
  });

  it('lead que ainda não chegou fica em "Sem origem"', () => {
    expect(sourcesOf([c({})], 1200, new Map())[0].name).toBe('Sem origem');
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/lib/gerencial/__tests__/people.test.js`

- [ ] **Passo 3: implementar**

`src/lib/gerencial/people.js` com um agrupador comum. Cada linha sai com `{ id, name, count, value, share }`; o consultor ganha `perSale` e `monthly`. Ordenar por `value` decrescente e, no empate, por nome. `share` em porcentagem do total do mês. Use `monthlyTicket` de `./scope.js` e `dashInitials` fica na camada visual, não aqui.

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run src/lib/gerencial/__tests__/people.test.js`
Esperado: 7 testes verdes.

- [ ] **Passo 5: commitar**

```bash
git add src/lib/gerencial/people.js src/lib/gerencial/__tests__/people.test.js
git commit -m "feat(gerencial): ranking de consultor, plano e origem das vendas do mês"
```

---

## Task 6: queries.js, os leads das vendas

**Arquivos:**
- Criar: `src/lib/gerencial/queries.js`
- Testar: `src/lib/gerencial/__tests__/queries.test.js`

Espelha `leadIdsForRenewal` (`src/lib/operacional/queries.js`): devolve os ids de lead dos contratos fechados nos meses abertos na tela, sem os que já estão no cache.

- [ ] **Passo 1: escrever o teste que falha**

```js
// src/lib/gerencial/__tests__/queries.test.js
import { describe, it, expect } from 'vitest';
import { leadIdsForSales } from '../queries.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const c = (over) => ({ id: 'c', leadId: 'l1', createdAt: D(2026, 9, 10), startsAt: D(2026, 9, 10), ...over });

describe('leadIdsForSales', () => {
  it('pega os leads dos contratos fechados nos meses abertos', () => {
    expect(leadIdsForSales([c({})], { monthKeys: ['2026-09'] })).toEqual(['l1']);
  });
  it('ignora contrato de fora dos meses', () => {
    expect(leadIdsForSales([c({ createdAt: D(2026, 7, 1) })], { monthKeys: ['2026-09'] })).toEqual([]);
  });
  it('ignora importado, repetido e o que já está em mãos', () => {
    const list = [c({}), c({ id: 'b' }), c({ id: 'i', imported: true, leadId: 'l9' })];
    expect(leadIdsForSales(list, { monthKeys: ['2026-09'], known: new Set(['l1']) })).toEqual([]);
  });
  it('sem meses, não busca nada', () => {
    expect(leadIdsForSales([c({})], { monthKeys: [] })).toEqual([]);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/lib/gerencial/__tests__/queries.test.js`

- [ ] **Passo 3: implementar**

Use `monthRange` de `../operacional/month.js` para achar o início do mês mais antigo e o fim do mais novo, e `saleMoment` de `./scope.js` para a data. Sem `leadId`, sem entrada.

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run src/lib/gerencial/__tests__/queries.test.js`
Esperado: 4 testes verdes.

- [ ] **Passo 5: commitar**

```bash
git add src/lib/gerencial/queries.js src/lib/gerencial/__tests__/queries.test.js
git commit -m "feat(gerencial): ids de lead das vendas do mês para a origem"
```

---

## Task 7: metrics.js e texts.js, o mês inteiro e as frases

**Arquivos:**
- Criar: `src/lib/gerencial/metrics.js`, `src/lib/gerencial/texts.js`
- Testar: `src/lib/gerencial/__tests__/metrics.test.js`, `src/lib/gerencial/__tests__/texts.test.js`

`metricsOf(ctx, { monthKey, cutEnd })` devolve `{ sold, wallet, risk, exits, sellers, plans, sources, flags }`, no molde de `src/lib/crm/metrics.js`, com cache por `ctx` em `WeakMap`. `ctx` = `{ now, contracts, leadsById }`.

Regras que vivem aqui e em lugar nenhum:
- `risk.share` = soma dos três horizontes ÷ `wallet.monthly`, arredondada na hora de mostrar.
- `flags.gymEmpty` = nenhum contrato na academia. `flags.monthNoSales` = `sold.count === 0`.
- No mês em andamento, `cutEnd` é agora; no fechado, o fim do mês. A carteira e o risco sempre olham `now`, nunca o mês escolhido, porque são retrato de hoje (o handoff diz isso na dica do "já venceu").
- `deltaOf(cur, prev)` no molde do Operacional, para a pílula de variação.

Os textos do §6 do handoff ficam em `texts.js`, cada um em função pura: `monthSubline({ running, elapsed, monthKey, compareOn, cmpKey })`, `clawbackNote`, `overlapNote`, `blindNote`, `expiredNote`, `exitsNote`, `plansNote`, `sourcesNote`, `emptyGym`, `emptyMonth`, `emptyRanking`. Copie as frases exatas do README, sem travessão no meio da frase.

- [ ] **Passo 1: escrever os testes que falham**

Cubra: mês em andamento contra pró-rata do comparado; mês fechado contra o mês inteiro; academia sem contrato levantando `gymEmpty`; mês sem venda com carteira cheia levantando só `monthNoSales`; `share` batendo com a soma dos horizontes; cada frase do §6 saindo literal para os estados descritos.

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/lib/gerencial/__tests__/`

- [ ] **Passo 3: implementar**

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run src/lib/gerencial/__tests__/`

- [ ] **Passo 5: commitar**

```bash
git add src/lib/gerencial/metrics.js src/lib/gerencial/texts.js src/lib/gerencial/__tests__/metrics.test.js src/lib/gerencial/__tests__/texts.test.js
git commit -m "feat(gerencial): metricsOf com o mês inteiro e os textos do handoff"
```

---

## Task 8 a 12: os componentes

Cada tarefa segue o mesmo rito: abrir o protótipo servido em `http://localhost:5198/Gerencial.dc.html`, achar o trecho, portar classe por classe para Tailwind com os tokens do app, e testar a renderização com `renderToString` (sem jsdom), envolvendo em `TooltipProvider` quando houver dica.

Regras que valem para todos:
- `cn()` para classe condicional, `size-N` no lugar de `w-N h-N`, `flex gap-*` no lugar de `space-x/y-*`.
- Texto colorido usa o passo 700 (`text-emerald-700`, `text-amber-700`, `text-accent-600`), nunca a cor base.
- Todo número com a classe `num`.
- Nenhum agregado recebido pronto por prop quando ele pode sair do detalhe (§8 do handoff).
- Toda marca de gráfico é focável e tem dica pelo `Tooltip` do shadcn, com `outline` visível no foco. Reuse `ChartMark` (`src/views/dashboard/ChartMark.jsx`), que o CRM já usa para isso.
- Informação nunca só pela cor: legenda com rótulo e número ao lado de cada barra ou cápsula; contrato sem valor se distingue pela hachura e pela borda tracejada.

| Task | Componente | Trecho do protótipo | Cuidado principal |
|---|---|---|---|
| 8 | `SoldHeroCard.jsx` | linhas 156 a 245 | O `/mês` do ticket é irmão do número, no mesmo baseline. A cápsula de tipos tem separador de 2px na cor do card e a legenda embaixo repete rótulo, contagem e valor |
| 9 | `WalletBand.jsx` | 247 a 285 | Quatro células baixas, `Geist 600 28px`. As notas de sobreposição e de importados entram por prop, vindas do `texts.js` |
| 10 | `ExpiryRunway.jsx` + `BlindValueNote` | 286 a 388 | A trilha tracejada NÃO compartilha o eixo da barra sólida. Quando não há contrato sem valor, o item de legenda some |
| 11 | `ExitsCard.jsx` | 330 a 388 | Cancelamento em `danger`, trancamento em `amber`, com a nota dizendo que trancamento continua na carteira |
| 12 | `SellerRankTable.jsx` + `GerencialParts.jsx` | 390 a 520 e 100 a 150 | As duas colunas de ticket; no celular a coluna mensal desce para a linha de apoio. `GerencialEmpty` substitui o corpo inteiro |

Planos e origem reusam `BreakdownCard` de `DashPrimitives.jsx` como está, com a adição da coluna de contagem (`11x`) entre o rótulo e o valor.

Cada tarefa termina com:

```bash
npx vitest run src/views/dashboard/__tests__/<arquivo>.test.jsx
git add src/views/dashboard/<Componente>.jsx src/views/dashboard/__tests__/<arquivo>.test.jsx
git commit -m "feat(gerencial): <componente>"
```

---

## Task 13: GerencialToolbar

**Arquivos:**
- Criar: `src/views/dashboard/GerencialToolbar.jsx`
- Testar: `src/views/dashboard/__tests__/gerencialToolbar.test.jsx`

Molde: `src/views/dashboard/CrmToolbar.jsx`. Mês com setas e lista, caixa Comparar com o mês comparado, e o chip fixo âmbar "Valor de contrato vendido, não caixa recebido", 30px de altura, sem botão de fechar. Sem seletor de academia e sem filtro de pessoa.

Quando não existe mês anterior com venda, o controle Comparar sai inteiro e no lugar entra "Não há mês anterior com venda para comparar".

---

## Task 14: GerencialDashboard e DashboardGerencialView

**Arquivos:**
- Criar: `src/views/dashboard/GerencialDashboard.jsx`
- Substituir: `src/views/dashboard/DashboardGerencialView.jsx` (hoje é o dashboard antigo, sem nenhum import vivo)
- Testar: `src/views/dashboard/__tests__/gerencialDashboard.test.jsx`

`DashboardGerencialView` faz o que o `DashboardCrmView` faz: relógio de minuto, estado do mês e da comparação, `useGeneralConfig()` para `contratos` e `planos`, `normalizeContracts` uma vez em `useMemo`, busca dos leads das vendas por id (Task 6) e montagem do `ctx` do `metricsOf`.

`GerencialDashboard` recebe o resultado pronto e desenha as quatro seções, cada uma com título de 16px, pergunta de 12.5px e régua de 2px.

Dois vazios, e eles são diferentes (§5 do handoff):
- `gymEmpty` substitui o corpo inteiro pelo painel "Ainda não há contratos" com o botão "Ir para o pipeline" (usar `onNavigate`).
- `monthNoSales` troca só o herói e o ranking; carteira e risco continuam inteiros.

---

## Task 15: ligar no App e apagar o que ficou sem uso

**Arquivos:**
- Modificar: `src/App.jsx:82` (import) e `src/App.jsx:1706` (render)
- Apagar: `src/views/dashboard/DashboardComingSoonView.jsx`

```jsx
{resolvedTab === 'dashGerencial' && <DashboardGerencialView usersList={usersList} db={db} listenersActive={listenersActive} onNavigate={changeTab} />}
```

Confira com `grep -rn "DashboardComingSoonView" src` que ninguém mais usa antes de apagar.

- [ ] Rodar `npm test`, `npm run lint` e `npm run build`, todos verdes.

---

## Task 16: documentação

**Arquivos:**
- Modificar: `CLAUDE.md` (seção nova "Dashboard Gerencial", no molde da seção do CRM)
- Já no repositório: a spec e o handoff, que entram no mesmo commit

A seção do `CLAUDE.md` precisa dizer: o que a tela mede, onde estão as contas, que a carteira soma contrato e não pessoa, que contrato sem valor nunca entra no dinheiro, que a venda conta pela data do fechamento e que a tela não abre consulta nova porque os contratos já chegam pelo `useGeneralConfig`.

---

## Verificação final

- [ ] `npm test` verde (os 1.499 de hoje mais os novos)
- [ ] `npm run lint` sem erro novo (o aviso do SuperAdminView já existia)
- [ ] `npm run build` verde
- [ ] Preview aberto em 1440 e em 390, claro e escuro, comparando com o protótipo lado a lado
- [ ] Conferir os dois vazios com dado de verdade: nenhuma academia de teste tem contrato, e maio de 2026 não tem venda
- [ ] PR aberto, merge só com a aprovação do Johnny
