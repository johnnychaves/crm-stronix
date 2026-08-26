# Funil Renovações Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o funil de sistema "Renovações" no board do Kanban, com colunas derivadas dos marcos de renovação, fechando a esteira automática lead → cliente → renovação → vencidos.

**Architecture:** O cliente não é movido para o funil, ele é **projetado** nele — mesmo molde de `src/lib/expiredFunnel.js`. O `status` do documento continua `Venda` e o `lifecycleBucket` continua `cliente`; só o status EXIBIDO muda, em memória. As colunas são **virtuais** (nenhum documento em `stronix_statuses`): o board lê `renewalCheckpoints` da config e desenha uma coluna por marco. Cada coluna tem sua própria query paginada sobre uma faixa de `currentContractEndsAt`, usando o índice #4 que já existe.

**Tech Stack:** React 19 + Vite, Firebase Firestore (JS SDK v9 modular), Vitest, Tailwind v4. Sem TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-20-funil-renovacoes-design.md`

---

## Contexto que o implementador precisa antes de começar

**Leia estes três arquivos primeiro. Eles são o molde e as respostas para 90% das dúvidas:**

1. `src/lib/expiredFunnel.js` — o funil de sistema irmão (Vencidos). Cada função aqui tem uma equivalente lá. Os comentários explicam POR QUE cada decisão foi tomada.
2. `src/lib/renewalGoal.js` — onde mora `activeRenewalCheckpoint`, a função que decide o marco ativo. **Não reimplemente essa lógica**: a Meta Diária usa ela, e board e Meta precisam contar a mesma história.
3. `src/views/KanbanView.jsx:400-430` e `:659-690` — o bloco do funil Vencidos no board (carga e arrasto). O bloco de Renovações fica ao lado, no mesmo estilo.

**Convenções do repo que valem para tudo neste plano:**

- Sem TypeScript. Arquivos `.js` para lógica pura, `.jsx` para componentes.
- Comentários em português, explicando o PORQUÊ e não o O QUE. O repo tem comentários densos de propósito.
- `cn()` de `@/lib/utils` para classe condicional, nunca template literal com ternário.
- Testes com Vitest em `src/lib/__tests__/`. Rodar com `npm test`.
- Commits em português, formato `tipo: descrição curta` (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`).
- **Nunca commitar na main.** O trabalho é em branch e vira PR.

**Vocabulário do domínio:**

- **Marco (checkpoint):** quantos dias antes do vencimento o consultor deve tocar o cliente. Padrão 90/60/30, configurável em Configurações → Metas & ritmo.
- **Marco ativo:** `min{ C ∈ marcos : C >= diasParaVencer }`. Com marcos [90,60,30], quem tem 87 dias para vencer está no marco 90.
- **`lifecycleBucket`:** `'ativo' | 'cliente' | 'perda'`. Cliente é quem já matriculou.
- **Funil de sistema:** funil criado e mantido pelo app, discriminado pela flag `systemKind` e **nunca pelo nome**. Já existem dois: `'referral'` e `'expired'`.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/renewalFunnel.js` (**novo**) | Regras puras: discriminador do funil, colunas derivadas dos marcos, projeção dos cards, plano do provisionamento. Sem React, sem Firestore. |
| `src/lib/__tests__/renewalFunnel.test.js` (**novo**) | Testes das regras puras. |
| `src/lib/leadQueries.js` (modificar) | Ganha `renewalColumnQuerySpec` — a faixa de datas de uma coluna. Spec pura, sem Firestore. |
| `src/lib/__tests__/leadQueries.test.js` (modificar) | Testes da faixa e da não sobreposição com o funil Vencidos. |
| `src/hooks/useRenewalBoard.js` (**novo**) | Carga: N queries (uma por coluna), um cursor por coluna. É o único código sem precedente direto no repo. |
| `src/views/KanbanView.jsx` (modificar) | Desvio do funil de sistema: colunas virtuais, cards projetados, arrasto. |
| `src/App.jsx` (modificar) | Provisionamento do funil, encadeado depois do Vencidos. |
| `src/views/settings/FunnelsSection.jsx` (modificar) | Nota no lugar da lista de etapas vazia e avisos genéricos por nome de funil. |

---

## Task 1: Regras puras do funil (`renewalFunnel.js`)

**Files:**
- Create: `src/lib/renewalFunnel.js`
- Test: `src/lib/__tests__/renewalFunnel.test.js`

- [ ] **Step 1: Escreva o teste que falha**

Crie `src/lib/__tests__/renewalFunnel.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  RENEWAL_FUNNEL_KIND, RENEWAL_FUNNEL_NAME, RENEWAL_MAX_COLUMNS,
  isRenewalFunnel, getRenewalFunnel,
  renewalColumnsFromCheckpoints,
  isRenewalEligible, splitRenewalForBoard, planRenewalSetupOps,
} from '../renewalFunnel.js';
import { activeRenewalCheckpoint } from '../renewalGoal.js';

describe('isRenewalFunnel', () => {
  it('casa pela flag, NUNCA pelo nome', () => {
    expect(isRenewalFunnel({ systemKind: RENEWAL_FUNNEL_KIND })).toBe(true);
    // funil que a academia criou à mão com o mesmo nome NÃO é o do sistema
    expect(isRenewalFunnel({ name: 'Renovações' })).toBe(false);
    expect(isRenewalFunnel({ systemKind: 'expired' })).toBe(false);
    expect(isRenewalFunnel(null)).toBe(false);
  });
});

describe('getRenewalFunnel', () => {
  it('duplicata resolve pelo createdAt mais antigo', () => {
    const novo = { id: 'b', systemKind: RENEWAL_FUNNEL_KIND, createdAt: 2000 };
    const velho = { id: 'a', systemKind: RENEWAL_FUNNEL_KIND, createdAt: 1000 };
    expect(getRenewalFunnel([novo, velho]).id).toBe('a');
  });
  it('sem funil de sistema devolve null', () => {
    expect(getRenewalFunnel([{ id: 'x', name: 'Renovações' }])).toBeNull();
    expect(getRenewalFunnel([])).toBeNull();
  });
});

describe('renewalColumnsFromCheckpoints', () => {
  it('uma coluna por marco, do maior para o menor', () => {
    const cols = renewalColumnsFromCheckpoints([30, 90, 60]);
    expect(cols.map(c => c.days)).toEqual([90, 60, 30]);
    expect(cols.map(c => c.name)).toEqual(['90 dias', '60 dias', '30 dias']);
  });

  it('a faixa de cada coluna encosta na de baixo, sem buraco', () => {
    const cols = renewalColumnsFromCheckpoints([90, 60, 30]);
    // prevDays é o piso EXCLUSIVO da faixa; a menor coluna começa em 0.
    expect(cols.map(c => [c.prevDays, c.days])).toEqual([[60, 90], [30, 60], [0, 30]]);
  });

  it('descarta marco inválido e deduplica', () => {
    const cols = renewalColumnsFromCheckpoints([90, 90, 0, -5, null, 'abc', 30]);
    expect(cols.map(c => c.days)).toEqual([90, 30]);
  });

  it('sem marco algum cai no padrão 90/60/30', () => {
    expect(renewalColumnsFromCheckpoints([]).map(c => c.days)).toEqual([90, 60, 30]);
    expect(renewalColumnsFromCheckpoints(null).map(c => c.days)).toEqual([90, 60, 30]);
  });

  it('corta em 6 colunas mantendo as MAIORES', () => {
    const cols = renewalColumnsFromCheckpoints([120, 90, 60, 45, 30, 15, 7]);
    expect(cols).toHaveLength(RENEWAL_MAX_COLUMNS);
    expect(cols.map(c => c.days)).toEqual([120, 90, 60, 45, 30, 15]);
    // a menor coluna que sobrou absorve TUDO abaixo dela: ninguém fica órfão
    expect(cols[cols.length - 1].prevDays).toBe(0);
  });
});

// A PONTE COM A META DIÁRIA. A faixa (prevDays, days] de cada coluna é a
// tradução fiel de activeRenewalCheckpoint — a mesma função que decide o marco
// na Meta. Não existe função de ponte no código de propósito: recalcular a
// coluna com um "agora" diferente do corte da query discordaria na borda. O que
// garante que os dois concordam é ESTE teste. Se ele cair, board e Meta passam
// a colocar o mesmo cliente em marcos diferentes, e ninguém percebe até um
// consultor reclamar.
describe('as faixas das colunas traduzem activeRenewalCheckpoint', () => {
  const marcos = [90, 60, 30];
  const cols = renewalColumnsFromCheckpoints(marcos);

  // Espelha a faixa da query: aberta embaixo, fechada em cima, e a MENOR coluna
  // (prevDays 0) inclui o próprio dia do vencimento.
  const colunaDaFaixa = (dias) =>
    cols.find(c => (c.prevDays === 0 ? dias >= 0 : dias > c.prevDays) && dias <= c.days) || null;

  it('todo prazo de 0 a 90 dias cai na coluna do marco ativo', () => {
    for (let dias = 0; dias <= 90; dias++) {
      expect(colunaDaFaixa(dias)?.days).toBe(activeRenewalCheckpoint(dias, marcos));
    }
  });

  it('prazo maior que o maior marco não cai em coluna nenhuma, e a Meta concorda', () => {
    expect(colunaDaFaixa(91)).toBeNull();
    expect(activeRenewalCheckpoint(91, marcos)).toBeNull();
  });

  it('vale também com o teto de 6 aplicado', () => {
    const muitos = [120, 90, 60, 45, 30, 15, 7];
    const cortadas = renewalColumnsFromCheckpoints(muitos);
    const usados = cortadas.map(c => c.days);
    const faixa = (dias) =>
      cortadas.find(c => (c.prevDays === 0 ? dias >= 0 : dias > c.prevDays) && dias <= c.days) || null;
    for (let dias = 0; dias <= 120; dias++) {
      expect(faixa(dias)?.days).toBe(activeRenewalCheckpoint(dias, usados));
    }
  });
});

describe('isRenewalEligible', () => {
  it('contrato cancelado ou trancado não renova', () => {
    expect(isRenewalEligible({ currentContractStatus: 'cancelado' })).toBe(false);
    expect(isRenewalEligible({ currentContractStatus: 'trancado' })).toBe(false);
  });
  it('contrato ativo renova', () => {
    expect(isRenewalEligible({ currentContractStatus: 'ativo' })).toBe(true);
    expect(isRenewalEligible({})).toBe(true);
  });
});

describe('splitRenewalForBoard', () => {
  const cols = renewalColumnsFromCheckpoints([90, 60, 30]);

  it('projeta o status EXIBIDO no nome da coluna e marca o card', () => {
    const pages = { 90: [{ id: 'a', name: 'Ana', status: 'Venda' }] };
    const { cardsByColumn } = splitRenewalForBoard(pages, cols);
    const card = cardsByColumn.get('90 dias')[0];
    expect(card.status).toBe('90 dias');
    expect(card._renewalCard).toBe(true);
    expect(card._renewalDays).toBe(90);
  });

  it('quem recusou vai para a Perda e sai da coluna', () => {
    const pages = { 60: [
      { id: 'a', name: 'Ana', status: 'Venda' },
      { id: 'b', name: 'Beto', status: 'Venda', renewalDeclined: true },
    ] };
    const { cardsByColumn, declined } = splitRenewalForBoard(pages, cols);
    expect(cardsByColumn.get('60 dias').map(l => l.id)).toEqual(['a']);
    expect(declined.map(l => l.id)).toEqual(['b']);
    // o recusado também é card de renovação — o drop precisa saber disso
    expect(declined[0]._renewalCard).toBe(true);
    expect(declined[0]._renewalDays).toBe(60);
  });

  it('cancelado e trancado somem do board inteiro', () => {
    const pages = { 30: [
      { id: 'a', status: 'Venda', currentContractStatus: 'ativo' },
      { id: 'b', status: 'Venda', currentContractStatus: 'cancelado' },
      { id: 'c', status: 'Venda', currentContractStatus: 'trancado' },
    ] };
    const { cardsByColumn, declined } = splitRenewalForBoard(pages, cols);
    expect(cardsByColumn.get('30 dias').map(l => l.id)).toEqual(['a']);
    expect(declined).toEqual([]);
  });

  it('NÃO altera o documento original (a projeção é em memória)', () => {
    const original = { id: 'a', status: 'Venda' };
    splitRenewalForBoard({ 90: [original] }, cols);
    expect(original.status).toBe('Venda');
    expect(original._renewalCard).toBeUndefined();
  });

  it('coluna sem página carregada devolve lista vazia, não undefined', () => {
    const { cardsByColumn } = splitRenewalForBoard({}, cols);
    expect(cardsByColumn.get('90 dias')).toEqual([]);
  });
});

describe('planRenewalSetupOps', () => {
  it('academia sem o funil: cria o funil e NENHUMA etapa', () => {
    const plan = planRenewalSetupOps({ funnels: [{ id: 'x', name: 'Vendas' }] });
    expect(plan.createFunnel).toEqual({
      name: RENEWAL_FUNNEL_NAME, systemKind: RENEWAL_FUNNEL_KIND, order: 98,
    });
  });
  it('academia que já tem o funil: não cria nada', () => {
    const plan = planRenewalSetupOps({ funnels: [{ id: 'r', systemKind: RENEWAL_FUNNEL_KIND }] });
    expect(plan.createFunnel).toBeNull();
  });
  it('funil da academia com o mesmo NOME não conta como provisionado', () => {
    const plan = planRenewalSetupOps({ funnels: [{ id: 'r', name: 'Renovações' }] });
    expect(plan.createFunnel).not.toBeNull();
  });
});
```

- [ ] **Step 2: Rode o teste para ver falhar**

```bash
npm test -- src/lib/__tests__/renewalFunnel.test.js
```

Esperado: FAIL com `Failed to resolve import "../renewalFunnel.js"`.

- [ ] **Step 3: Escreva a implementação**

Crie `src/lib/renewalFunnel.js`:

```js
// Regras puras do funil de sistema RENOVAÇÕES no board (pipeline): discriminador,
// colunas derivadas dos marcos, projeção dos cards e o plano idempotente do
// provisionamento. Sem React e sem Firestore — o COMO gravar fica nos callers.
//
// Espelha src/lib/expiredFunnel.js, o irmão que cobre o outro lado do corte.
// A diferença que simplifica tudo: aqui NINGUÉM arrasta entre colunas, então
// não existe campo de etapa gravada (o Vencidos precisa de reactivationStageId
// e de zerá-lo em buildMatriculaWrites). A coluna é 100% derivada, sempre.
//
// NÃO confundir com src/lib/renewalGoal.js: lá é a TAREFA diária da Meta, que
// cobra o cliente uma vez em cada marco e solta. Aqui é a COLUNA do board, onde
// ele fica parado até renovar ou vencer.

import { DEFAULT_RENEWAL_CHECKPOINTS } from './renewalGoal.js';
import { CONTRACT_STATUS } from './contracts.js';

// Discriminador. NUNCA casar por nome: a academia pode ter um funil "Renovações"
// próprio — os dois convivem e só este flag diferencia.
export const RENEWAL_FUNNEL_KIND = 'renewal';
export const RENEWAL_FUNNEL_NAME = 'Renovações';
// Entre Indicações e Vencidos (order 99) na barra de funis: é a ordem da esteira.
export const RENEWAL_FUNNEL_ORDER = 98;

// Teto de colunas. Os marcos são configuráveis e normalizeRenewalCheckpoints
// (src/lib/leadStatus.js) limita o VALOR de cada um (1..365) mas não QUANTOS —
// inofensivo enquanto eles só alimentavam a Meta, caro agora que cada marco vira
// uma query. Corta-se por CIMA: a menor coluna que sobra cobre [0, C_min] e
// absorve todo mundo abaixo dela, então nenhum card fica órfão. Cortar os
// maiores encolheria a janela do board e deixaria cliente sem lugar nenhum.
export const RENEWAL_MAX_COLUMNS = 6;

// Cor de cada coluna, do marco mais distante ao mais próximo: quanto menos
// tempo sobra, mais quente. Casa com a paleta de getKanbanColumnAccent.
const COLUMN_COLORS = ['slate', 'blue', 'teal', 'amber', 'orange', 'rose'];

export const isRenewalFunnel = (f) => f?.systemKind === RENEWAL_FUNNEL_KIND;

// createdAt em ms aceitando Timestamp ({toMillis}/{seconds}), Date ou número.
const createdAtMs = (f) => {
  const v = f?.createdAt;
  if (!v) return Infinity;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  return Infinity;
};

// Duplicata (corrida do provisionamento em duas abas de admin) resolve
// determinístico: vence o createdAt mais antigo.
export const getRenewalFunnel = (funnels) => {
  const list = (funnels || []).filter(isRenewalFunnel);
  if (!list.length) return null;
  return list.reduce((best, f) => (createdAtMs(f) < createdAtMs(best) ? f : best));
};

// As COLUNAS do board, derivadas dos marcos. Nenhum documento em
// stronix_statuses: mudou a config, muda o board no render seguinte.
//
// Cada coluna carrega a faixa que ela cobre: (prevDays, days]. A menor tem
// prevDays 0, então ela pega todo mundo entre hoje e o menor marco.
//
// Essa faixa é a tradução fiel de activeRenewalCheckpoint (src/lib/renewalGoal.js),
// a função que a Meta Diária usa para decidir o marco. NÃO existe função de ponte
// aqui de propósito: recalcular a coluna do card com um "agora" diferente do corte
// da query discordaria na borda. Quem garante que board e Meta concordam é o teste
// "as faixas das colunas traduzem activeRenewalCheckpoint".
export const renewalColumnsFromCheckpoints = (checkpoints) => {
  const limpos = Array.from(new Set(
    (Array.isArray(checkpoints) ? checkpoints : [])
      .map((n) => Math.floor(Number(n)))
      .filter((n) => Number.isFinite(n) && n > 0)
  )).sort((a, b) => b - a);

  const usados = (limpos.length ? limpos : DEFAULT_RENEWAL_CHECKPOINTS)
    .slice(0, RENEWAL_MAX_COLUMNS);

  return usados.map((days, i) => ({
    // id sintético: as colunas não existem no banco, mas o React precisa de key.
    id: `ck:${days}`,
    name: `${days} ${days === 1 ? 'dia' : 'dias'}`,
    days,
    // Piso EXCLUSIVO da faixa. A última coluna desce até 0 e absorve o resto.
    prevDays: i === usados.length - 1 ? 0 : usados[i + 1],
    color: COLUMN_COLORS[Math.min(i, COLUMN_COLORS.length - 1)],
    order: i,
  }));
};

// Cliente que não tem o que renovar some do board inteiro. Espelha o que
// shouldPromptRenewal (renewalGoal.js) já exclui da Meta: contrato cancelado
// pelo próprio consultor, ou trancado (a vigência está congelada e volta a
// correr na reativação).
export const isRenewalEligible = (lead) =>
  lead?.currentContractStatus !== CONTRACT_STATUS.CANCELADO &&
  lead?.currentContractStatus !== CONTRACT_STATUS.TRANCADO;

// Projeta os clientes como cards do board, coluna a coluna.
//
// `pagesByDays` é { [days]: lead[] } — a página que a query daquela coluna
// trouxe. A coluna NÃO é recalculada aqui: a faixa da query já garante o
// pertencimento, e recalcular com um "agora" diferente do corte da query
// discordaria na borda.
//
// As colunas do Kanban casam por NOME e os cards são agrupados por `lead.status`
// (ver partitionLeadsByStatus). Cliente é `status: 'Venda'`, então sem projeção
// todos cairiam na coluna Venda. Aqui o status EXIBIDO vira o nome da coluna.
//
// A projeção é SÓ EM MEMÓRIA: o `status` real do documento continua 'Venda', e é
// o que preserva o estado de cliente e a aba Clientes.
//
// `_renewalCard` marca o card projetado e `_renewalDays` carrega o marco ativo —
// o handler de drop precisa dele para gravar renewalDecline.
export const splitRenewalForBoard = (pagesByDays, columns) => {
  const cols = Array.isArray(columns) ? columns : [];
  const cardsByColumn = new Map();
  const declined = [];

  cols.forEach((col) => {
    const page = (pagesByDays?.[col.days] || []).filter(isRenewalEligible);
    const cards = [];
    page.forEach((lead) => {
      const marcado = { ...lead, _renewalCard: true, _renewalDays: col.days };
      // Quem recusou sai das colunas e vai para a Perda, que o board já
      // renderiza em todo funil. Ele continua CLIENTE — muda só onde o card
      // aparece, nunca o lifecycleBucket.
      if (lead?.renewalDeclined) declined.push(marcado);
      else cards.push({ ...marcado, status: col.name });
    });
    cardsByColumn.set(col.name, cards);
  });

  return { cardsByColumn, declined };
};

// Plano idempotente do provisionamento. Só o FUNIL — as colunas são virtuais,
// então não há etapa nenhuma para criar.
export const planRenewalSetupOps = ({ funnels } = {}) => {
  if (getRenewalFunnel(funnels)) return { createFunnel: null };
  return {
    createFunnel: {
      name: RENEWAL_FUNNEL_NAME,
      systemKind: RENEWAL_FUNNEL_KIND,
      order: RENEWAL_FUNNEL_ORDER,
    },
  };
};
```

- [ ] **Step 4: Rode o teste para ver passar**

```bash
npm test -- src/lib/__tests__/renewalFunnel.test.js
```

Esperado: PASS, todos os testes verdes.

- [ ] **Step 5: Rode a suíte inteira**

```bash
npm test
```

Esperado: PASS. Nenhum teste existente quebra (o arquivo é novo e ninguém importa ele ainda).

- [ ] **Step 6: Commit**

```bash
git add src/lib/renewalFunnel.js src/lib/__tests__/renewalFunnel.test.js
git commit -m "feat: regras puras do funil Renovações"
```

---

## Task 2: A faixa de query de cada coluna

**Files:**
- Modify: `src/lib/leadQueries.js` (adicionar depois de `expiredClientsQuerySpec`, hoje na linha 103)
- Test: `src/lib/__tests__/leadQueries.test.js`

- [ ] **Step 1: Escreva o teste que falha**

Adicione no fim de `src/lib/__tests__/leadQueries.test.js`:

```js
describe('renewalColumnQuerySpec', () => {
  const DIA = 86400000;
  const corte = new Date('2026-08-20T12:00:00Z').getTime();

  it('a coluna do meio é uma faixa aberta embaixo e fechada em cima', () => {
    const spec = renewalColumnQuerySpec(corte, 60, 30, 10);
    expect(spec.wheres).toEqual([
      { field: 'lifecycleBucket', op: '==', value: 'cliente' },
      { field: 'currentContractEndsAt', op: '>', value: new Date(corte + 30 * DIA) },
      { field: 'currentContractEndsAt', op: '<=', value: new Date(corte + 60 * DIA) },
    ]);
    expect(spec.orderBy).toEqual({ field: 'currentContractEndsAt', dir: 'asc' });
    expect(spec.limit).toBe(10);
  });

  it('a coluna menor começa NO corte, inclusive: quem vence hoje ainda renova', () => {
    const spec = renewalColumnQuerySpec(corte, 30, 0, 10);
    expect(spec.wheres[1]).toEqual({
      field: 'currentContractEndsAt', op: '>=', value: new Date(corte),
    });
  });

  it('sem pageSize não emite limit', () => {
    expect(renewalColumnQuerySpec(corte, 30, 0).limit).toBeUndefined();
  });

  // A INVARIANTE DA ESTEIRA: Renovações e Vencidos partem o mesmo eixo no
  // mesmo ponto. Se este teste cair, ou um cliente aparece nos dois boards, ou
  // some dos dois.
  it('não sobrepõe nem deixa buraco com o funil Vencidos', () => {
    const colunas = [
      renewalColumnQuerySpec(corte, 90, 60),
      renewalColumnQuerySpec(corte, 60, 30),
      renewalColumnQuerySpec(corte, 30, 0),
    ];
    const vencidos = expiredClientsQuerySpec(corte);

    const casa = (spec, ms) => {
      const d = new Date(ms);
      return spec.wheres.filter(w => w.field === 'currentContractEndsAt').every(w => {
        if (w.op === '>') return d > w.value;
        if (w.op === '>=') return d >= w.value;
        if (w.op === '<') return d < w.value;
        if (w.op === '<=') return d <= w.value;
        return true;
      });
    };

    const pontos = [
      corte - DIA, corte - 1, corte, corte + 1,
      corte + 30 * DIA, corte + 30 * DIA + 1,
      corte + 60 * DIA, corte + 60 * DIA + 1,
      corte + 90 * DIA,
    ];

    pontos.forEach(ms => {
      const emColuna = colunas.filter(c => casa(c, ms)).length;
      const emVencidos = casa(vencidos, ms) ? 1 : 0;
      // exatamente UM lugar para cada instante dentro do alcance do board
      expect(emColuna + emVencidos).toBe(1);
    });
  });

  it('quem vence depois do maior marco não entra em coluna nenhuma', () => {
    const spec = renewalColumnQuerySpec(corte, 90, 60);
    const depois = new Date(corte + 91 * DIA);
    expect(depois <= spec.wheres[2].value).toBe(false);
  });
});
```

**Atenção:** o `import` no topo de `leadQueries.test.js` precisa incluir `renewalColumnQuerySpec` e `expiredClientsQuerySpec`. Confira a linha de import existente e acrescente os dois nomes se faltarem.

- [ ] **Step 2: Rode o teste para ver falhar**

```bash
npm test -- src/lib/__tests__/leadQueries.test.js
```

Esperado: FAIL com `renewalColumnQuerySpec is not a function` (ou erro de import).

- [ ] **Step 3: Escreva a implementação**

Em `src/lib/leadQueries.js`, logo depois de `expiredClientsQuerySpec` (que termina na linha 103):

```js
// UMA COLUNA do funil RENOVAÇÕES do board. Cada marco busca a própria faixa de
// vencimento, com o próprio cursor, então todas as colunas nascem cheias em vez
// de a mais urgente comer a página inteira.
//
// A faixa é (corte + prevDays, corte + days] — aberta embaixo para não repetir o
// cliente que está na fronteira com a coluna de baixo. A MENOR coluna passa
// prevDays 0 e vira `>=` no próprio corte: quem vence hoje ainda é renovação, e
// só vira Vencidos a partir do instante seguinte.
//
// ESTA É A INVARIANTE DA ESTEIRA: aqui `>= corte`, no expiredClientsQuerySpec
// `< corte`. Nunca sobrepõe, nunca deixa buraco. Tem teste travando isso.
//
// Coberta pelo índice #4 (lifecycleBucket ASC, currentContractEndsAt ASC):
// igualdade no balde mais range e ordenação no mesmo campo. NENHUM índice novo.
export const renewalColumnQuerySpec = (cutoffMs, days, prevDays = 0, pageSize = null) => ({
  wheres: [
    { field: 'lifecycleBucket', op: '==', value: LIFECYCLE_BUCKETS.CLIENTE },
    {
      field: 'currentContractEndsAt',
      op: prevDays > 0 ? '>' : '>=',
      value: new Date(cutoffMs + prevDays * DAY_MS),
    },
    { field: 'currentContractEndsAt', op: '<=', value: new Date(cutoffMs + days * DAY_MS) },
  ],
  // Vencimento mais próximo no topo da coluna: dentro da mesma faixa, quem
  // vence antes precisa de contato antes.
  orderBy: { field: 'currentContractEndsAt', dir: 'asc' },
  ...(pageSize ? { limit: pageSize } : {}),
});
```

- [ ] **Step 4: Rode o teste para ver passar**

```bash
npm test -- src/lib/__tests__/leadQueries.test.js
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/leadQueries.js src/lib/__tests__/leadQueries.test.js
git commit -m "feat: faixa de query por coluna do funil Renovações"
```

---

## Task 3: O hook de carga (`useRenewalBoard`)

**Files:**
- Create: `src/hooks/useRenewalBoard.js`

**Por que este arquivo existe:** o número de marcos é configurável, então o número de queries é variável — e hook do React **não pode ser chamado em laço**. Por isso não dá para usar `usePagedLeads` uma vez por coluna. Este hook dispara as N faixas num só effect e guarda um cursor por coluna.

Ele reusa `specToConstraints` (exportado de `usePagedLeads.js`) para a tradução spec → Firestore, então a lógica de risco continua num lugar só.

**Este passo não tem teste automatizado.** O repo não tem infraestrutura de teste para hooks com Firestore (nenhum `.test.js` existente monta hook); a lógica testável já foi extraída para as funções puras das Tasks 1 e 2, que é o padrão do repo. A verificação é ao vivo, na Task 9.

- [ ] **Step 1: Escreva o hook**

Crie `src/hooks/useRenewalBoard.js`:

```js
// Carga do funil RENOVAÇÕES do board: uma query por coluna, cada uma com seu
// cursor e seu "carregar mais".
//
// POR QUE NÃO usePagedLeads: o número de colunas vem da config (marcos de
// renovação) e muda em tempo de execução. Hook não roda em laço, então não dá
// para chamar usePagedLeads uma vez por coluna. Aqui as N faixas rodam num só
// effect e os cursores vivem num ref indexado por marco.
//
// Reusa specToConstraints (usePagedLeads.js) para a tradução spec → Firestore:
// a lógica de risco (campo/op/orderBy, casamento com o índice #4) continua nas
// specs puras de leadQueries.js, cobertas por teste.
//
// NÃO é ao vivo (getDocs, não onSnapshot): o board é uma foto do dia, e uma
// assinatura por coluna multiplicaria a leitura pelo tempo de tela aberta.

import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { specToConstraints } from './usePagedLeads.js';
import { renewalColumnQuerySpec } from '../lib/leadQueries.js';
import { LEADS_PATH, appId } from '../lib/firebase.js';
import { normalizeLeadDoc } from '../lib/leads.js';

// useRenewalBoard({ db, columns, cutoffMs, pageSize, enabled })
//   columns : saída de renewalColumnsFromCheckpoints (precisa de .days/.prevDays)
//   cutoffMs: o "hoje" do board, fixado uma vez na montagem da tela
// Devolve { pages, hasMore, loading, loadMore(days) }, todos indexados pelo
// MARCO (days), que é a chave estável da coluna.
export function useRenewalBoard({ db, columns, cutoffMs, pageSize = 10, enabled = true }) {
  const [pages, setPages] = useState({});
  const [hasMore, setHasMore] = useState({});
  const [loading, setLoading] = useState(false);
  const cursors = useRef({});

  // Chave estável do conjunto de colunas: muda quando a config muda, e é o que
  // dispara a recarga. Depender do array `columns` faria refetch a cada render,
  // porque ele é recriado toda vez.
  const columnsKey = (columns || []).map((c) => `${c.prevDays}-${c.days}`).join('|');

  const fetchColumn = useCallback(async (col, reset) => {
    const spec = renewalColumnQuerySpec(cutoffMs, col.days, col.prevDays, pageSize);
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH);
    const cursor = reset ? null : cursors.current[col.days];
    const snap = await getDocs(query(colRef, ...specToConstraints(spec, cursor)));
    const page = snap.docs.map(normalizeLeadDoc);
    cursors.current[col.days] = snap.docs[snap.docs.length - 1] || cursors.current[col.days];
    setPages((prev) => ({
      ...prev,
      [col.days]: reset ? page : [...(prev[col.days] || []), ...page],
    }));
    // Página cheia ⇒ pode haver mais; menos que o limite ⇒ acabou.
    setHasMore((prev) => ({ ...prev, [col.days]: snap.size === pageSize }));
  }, [db, cutoffMs, pageSize]);

  useEffect(() => {
    if (!enabled || !db || !(columns || []).length) return;
    let cancelado = false;
    cursors.current = {};
    setLoading(true);
    // As colunas são independentes: em paralelo, não em fila. São 3 a 6 queries
    // pequenas e o board só fica pronto quando a última volta.
    Promise.all((columns || []).map((col) => fetchColumn(col, true)))
      .catch((err) => console.error('useRenewalBoard', err))
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
    // columnsKey representa `columns`; fetchColumn é derivado de db/cutoffMs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, db, columnsKey, cutoffMs]);

  const loadMore = useCallback((days) => {
    const col = (columns || []).find((c) => c.days === days);
    if (!col || loading || !hasMore[days]) return;
    setLoading(true);
    fetchColumn(col, false)
      .catch((err) => console.error('useRenewalBoard loadMore', err))
      .finally(() => setLoading(false));
  }, [columns, loading, hasMore, fetchColumn]);

  return { pages, hasMore, loading, loadMore };
}
```

- [ ] **Step 2: Verifique que o lint passa**

```bash
npx eslint src/hooks/useRenewalBoard.js
```

Esperado: nenhum erro. Se aparecer erro de `react-hooks/exhaustive-deps` fora do bloco já silenciado, **não silencie**: ajuste as dependências. O repo protege essa regra por hook de configuração (ver a memória `lint-audit-react-hooks-v7`).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useRenewalBoard.js
git commit -m "feat: hook de carga por coluna do funil Renovações"
```

---

## Task 4: O board — colunas virtuais e cards

**Files:**
- Modify: `src/views/KanbanView.jsx`

- [ ] **Step 1: Acrescente os imports**

Em `src/views/KanbanView.jsx`, junto dos imports existentes (o do funil Vencidos está na linha 10):

```js
import { getRenewalFunnel, renewalColumnsFromCheckpoints, splitRenewalForBoard } from '../lib/renewalFunnel.js';
import { useRenewalBoard } from '../hooks/useRenewalBoard.js';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
```

**Antes de escrever:** confira se `useGeneralConfig` já está importado no arquivo. Se estiver, não duplique o import — só use o que já existe.

- [ ] **Step 2: Monte as colunas e a carga**

Logo **depois** do bloco do funil Vencidos (que termina em `const expiredLeads = expiredSplit.cards;`, hoje na linha 428), acrescente:

```js
  // FUNIL RENOVAÇÕES (funil de sistema): cliente cujo contrato entrou na janela
  // dos marcos. Mesmo molde do Vencidos — projeção em memória, o status real
  // continua 'Venda' — com uma diferença: as COLUNAS são virtuais, derivadas
  // dos marcos da config, e ninguém arrasta entre elas. Regras em
  // lib/renewalFunnel.js.
  const { renewalCheckpoints } = useGeneralConfig();
  const renewalFunnel = useMemo(() => getRenewalFunnel(funnels), [funnels]);
  const isRenewalView = Boolean(renewalFunnel && selectedFunnelId === renewalFunnel.id);
  const renewalColumns = useMemo(
    // `[]` literal é estável aqui porque está dentro do useMemo (EMPTY_LEADS é
    // para leads e o nome mentiria).
    () => (isRenewalView ? renewalColumnsFromCheckpoints(renewalCheckpoints) : []),
    [isRenewalView, renewalCheckpoints]
  );
  // Mesmo corte do Vencidos, fixado uma vez na montagem: os dois boards partem o
  // eixo no MESMO ponto, senão um cliente aparece nos dois ou some dos dois.
  const {
    pages: renewalPages, hasMore: renewalHasMore, loadMore: renewalLoadMore,
  } = useRenewalBoard({
    db, columns: renewalColumns, cutoffMs: expiredCutoffMs,
    pageSize: KANBAN_PAGE_SIZE, enabled: !!db && isRenewalView,
  });
  const renewalSplit = useMemo(() => {
    if (!isRenewalView) return { cardsByColumn: new Map(), declined: EMPTY_LEADS };
    const { cardsByColumn, declined } = splitRenewalForBoard(renewalPages, renewalColumns);
    if (respFilter.length === 0) return { cardsByColumn, declined };
    const meu = (l) => respFilter.includes(l.consultantId);
    const filtrado = new Map();
    cardsByColumn.forEach((cards, nome) => filtrado.set(nome, cards.filter(meu)));
    return { cardsByColumn: filtrado, declined: declined.filter(meu) };
  }, [isRenewalView, renewalPages, renewalColumns, respFilter]);
```

- [ ] **Step 3: Injete os cards no agrupamento por status**

Localize (hoje na linha 798):

```js
  const leadsByStatus = useMemo(() => partitionLeadsByStatus(kanbanLeads), [kanbanLeads]);
```

Troque por:

```js
  // No funil Renovações o agrupamento já vem pronto por coluna (cada coluna tem
  // sua própria query), então não há o que particionar.
  const leadsByStatus = useMemo(
    () => (isRenewalView ? renewalSplit.cardsByColumn : partitionLeadsByStatus(kanbanLeads)),
    [isRenewalView, renewalSplit, kanbanLeads]
  );
```

- [ ] **Step 4: Troque as colunas do board**

Localize (hoje na linha 801):

```js
  const pipelineColumns = (statuses || []).filter(s => isItemInFunnel(s, selectedFunnelId, defaultFunnelId));
```

Troque por:

```js
  // No funil Renovações as colunas NÃO vêm de stronix_statuses: são derivadas
  // dos marcos, em memória. Nos demais, seguem sendo as etapas do funil.
  const pipelineColumns = isRenewalView
    ? renewalColumns
    : (statuses || []).filter(s => isItemInFunnel(s, selectedFunnelId, defaultFunnelId));
```

- [ ] **Step 5: Ligue o "carregar mais" de cada coluna**

Localize o `<KanbanColumn>` do laço de `pipelineColumns` (hoje na linha 981) e troque as duas props de paginação:

```jsx
                hasMore={isExpiredView && column.isEntry ? expiredHasMore : false}
                onLoadMore={isExpiredView && column.isEntry ? expiredLoadMore : null}
```

por:

```jsx
                // Vencidos: o volume mora na coluna de entrada, e é ela que
                // pagina. Renovações: cada coluna tem sua query e pagina sozinha.
                hasMore={
                  isRenewalView ? Boolean(renewalHasMore[column.days])
                    : isExpiredView && column.isEntry ? expiredHasMore
                      : false
                }
                onLoadMore={
                  isRenewalView ? () => renewalLoadMore(column.days)
                    : isExpiredView && column.isEntry ? expiredLoadMore
                      : null
                }
```

- [ ] **Step 6: Ligue a coluna Perda**

Localize (hoje na linha 1032):

```jsx
              columnLeads={isExpiredView ? expiredSplit.declined : lostLeads}
```

Troque por:

```jsx
              columnLeads={
                isRenewalView ? renewalSplit.declined
                  : isExpiredView ? expiredSplit.declined
                    : lostLeads
              }
```

- [ ] **Step 7: Verifique que o lint passa**

```bash
npx eslint src/views/KanbanView.jsx
```

Esperado: nenhum erro novo. O arquivo pode ter avisos pré-existentes; compare com `git stash && npx eslint src/views/KanbanView.jsx && git stash pop` se houver dúvida.

- [ ] **Step 8: Commit**

```bash
git add src/views/KanbanView.jsx
git commit -m "feat: colunas virtuais e cards do funil Renovações no board"
```

---

## Task 5: O board — arrasto

**Files:**
- Modify: `src/views/KanbanView.jsx`

- [ ] **Step 1: Acrescente o import da regra de recusa**

```js
import { renewalDecline } from '../lib/renewalGoal.js';
```

- [ ] **Step 2: Recuse o arrasto entre marcos**

Em `handleDrop` (hoje na linha 659), **antes** do bloco `if (lead._expiredCard)`, acrescente:

```js
    // FUNIL RENOVAÇÕES: as colunas são faixas de tempo, não etapas de conversa.
    // Mover à mão mentiria na tela — o card voltaria para a coluna do relógio na
    // próxima carga. A única volta permitida é sair da Perda (desfazer a recusa).
    if (lead._renewalCard) {
      if (newStatus === 'Perda' || newStatus === 'Venda') return; // tratados pelos handlers próprios
      if (!lead.renewalDeclined) {
        toast.warning('As colunas de Renovações seguem o vencimento do contrato e não podem ser movidas à mão.');
        return;
      }
      updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), {
        renewalDeclined: false
      }).catch(err => {
        console.error('Erro ao desfazer a recusa de renovação', err);
        toast.error('Não foi possível mover o card.');
      });
      return;
    }
```

- [ ] **Step 3: Trate o drop na Perda**

Em `handleLossDrop` (hoje na linha 703), **antes** do bloco `if (alvo?._expiredCard)`, acrescente:

```js
    // FUNIL RENOVAÇÕES: "não vai renovar" é a MESMA flag que a Meta Diária usa.
    // A pessoa NÃO vira lead perdido — segue cliente, com ficha e contratos, e
    // continua na aba Clientes. Perda de venda != perda de funil.
    if (alvo?._renewalCard) {
      updateDoc(
        doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, alvo.id),
        // Marca o marco atual como tratado junto: sem isso o cliente continuaria
        // sendo cobrado hoje na Meta, no mesmo marco que ele acabou de recusar.
        renewalDecline(alvo, alvo._renewalDays)
      ).catch(err => {
        console.error('Erro ao marcar recusa de renovação', err);
        toast.error('Não foi possível marcar a recusa.');
      });
      return;
    }
```

- [ ] **Step 4: Abra a renovação no drop da Venda**

O `handleWinDrop` (hoje na linha 694) já chama `openMatricula(lead)`, e o `ContractModal` é montado com `mode="matricula"` (linha 1060). Para o card de renovação ele precisa abrir em `mode="renovacao"`.

Localize a montagem do modal (linha 1059):

```jsx
      {matriculaLead && (
        <ContractModal
          mode="matricula"
```

Troque a prop `mode` por:

```jsx
      {matriculaLead && (
        <ContractModal
          // Card do funil Renovações: é renovação, não primeira matrícula. O
          // modal em modo renovação NÃO carimba convertedAt e emenda a vigência
          // no fim do contrato atual (ver src/lib/renewal.js, seamStart).
          mode={matriculaLead._renewalCard ? 'renovacao' : 'matricula'}
```

- [ ] **Step 5: Feche o menu "Mover" (toque e teclado)**

**Este é o passo mais importante da task.** O arrasto nativo não dispara em tela
de toque, então o card tem um menu "Mover" que chama `moveLeadToStatus` (linha
647) — e ele cai em `applyMoveToStage`, que grava `status: newStatus` **no
documento de verdade** (linha 604). Num card projetado isso escreveria
`status: '90 dias'` num CLIENTE, e ainda carimbaria `funnelId` do funil de
sistema (linha 605). É a corrupção que a projeção existe para evitar.

Troque `moveLeadToStatus` (linhas 647-656) por:

```js
  const moveLeadToStatus = (lead, statusName) => {
    if (!lead || lead.status === statusName) return;
    if (!canEditLead(appUser, lead)) {
      toast.warning('Você não tem permissão para mover este lead.');
      return;
    }
    // BIFURCAÇÃO do card projetado do funil Renovações. applyMoveToStage grava
    // `status` no documento, e o status real de um cliente é 'Venda' — gravar o
    // nome da coluna ali corromperia o estado de cliente e a aba Clientes.
    if (lead._renewalCard) {
      if (statusName === 'Venda') return openMatricula(lead);
      if (statusName === 'Perda') {
        updateDoc(
          doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
          renewalDecline(lead, lead._renewalDays)
        ).catch(err => {
          console.error('Erro ao marcar recusa de renovação', err);
          toast.error('Não foi possível marcar a recusa.');
        });
        return;
      }
      toast.warning('As colunas de Renovações seguem o vencimento do contrato e não podem ser movidas à mão.');
      return;
    }
    if (statusName === 'Venda') return openMatricula(lead);
    if (statusName === 'Perda') { setLossModalLeadId(lead.id); return; }
    return applyMoveToStage(lead, statusName);
  };
```

**Nota para quem for revisar:** o funil **Vencidos** tem exatamente o mesmo furo
hoje em produção — `moveLeadToStatus` não checa `_expiredCard`, então mover um
card de lá pelo menu de toque grava o nome da etapa no `status` do cliente.
**Não conserte aqui.** É bug pré-existente, de outro funil, e misturar os dois
numa PR só atrapalha a revisão. Está registrado para virar trabalho próprio.

- [ ] **Step 6: Rode a suíte**

```bash
npm test
```

Esperado: PASS. Nenhum teste toca esses handlers, então o objetivo aqui é só garantir que nada quebrou por importação circular.

- [ ] **Step 7: Verifique o lint**

```bash
npx eslint src/views/KanbanView.jsx
```

Esperado: nenhum erro novo.

- [ ] **Step 8: Commit**

```bash
git add src/views/KanbanView.jsx
git commit -m "feat: arrasto do funil Renovações (venda, recusa e desfazer)"
```

---

## Task 6: O card — "Vence em Xd" e selo de marco tratado

**Files:**
- Modify: `src/views/KanbanView.jsx`

**Contexto:** `cardBadge()` (linha 44) devolve a etiqueta do topo do card a partir do estado de follow-up. Para cliente em renovação, "Sem agenda" e "Atrasado" não dizem nada útil — o que importa é quanto falta para vencer.

- [ ] **Step 1: Estenda `cardBadge`**

Troque a função inteira (linhas 44-51) por:

```js
function cardBadge({ isWon, isLost, isOverdue, isToday, hasFollowUp, renewalDaysLeft }) {
  // Card do funil Renovações: o que importa é o relógio do contrato, não o
  // follow-up. Quanto menos tempo sobra, mais quente a etiqueta.
  if (Number.isFinite(renewalDaysLeft)) {
    const tom = renewalDaysLeft <= 7
      ? 'bg-rose-500/[0.07] text-[#E11D48] dark:text-rose-400'
      : renewalDaysLeft <= 30
        ? 'bg-amber-500/10 text-[#B45309] dark:text-amber-300'
        : 'bg-[#EAF0FF] text-[#1C3FC4] dark:bg-brand-500/15 dark:text-brand-300';
    return { label: `Vence em ${renewalDaysLeft}d`, className: tom };
  }
  if (isWon) return { label: 'Matriculado', className: 'bg-emerald-500/[0.08] text-[#0F9D6E] dark:text-emerald-300' };
  if (isLost) return { label: 'Perdido', className: 'bg-[#eef0f5] text-slate-500 dark:bg-white/[0.06] dark:text-neutral-400' };
  if (isOverdue) return { label: 'Atrasado', className: 'bg-rose-500/[0.07] text-[#E11D48] dark:text-rose-400' };
  if (isToday) return { label: 'Hoje', className: 'bg-[#EAF0FF] text-[#1C3FC4] dark:bg-brand-500/15 dark:text-brand-300' };
  if (!hasFollowUp) return { label: 'Sem agenda', className: 'bg-amber-500/10 text-[#B45309] dark:text-amber-300' };
  return null;
}
```

- [ ] **Step 2: Calcule os dias e o selo no card**

No `KanbanCard` (linha 98), acrescente **depois** da linha `const convertedAt = getSafeDateOrNull(lead.convertedAt);`:

```js
  // Card projetado do funil Renovações: dias até vencer e se o marco daquela
  // coluna já foi tratado (a Meta grava isso em renewalHandledCheckpoints).
  const renewalDaysLeft = lead._renewalCard
    ? daysToExpiryOf(lead.currentContractEndsAt, now)
    : null;
  const marcoTratado = Boolean(
    lead._renewalCard &&
    Array.isArray(lead.renewalHandledCheckpoints) &&
    lead.renewalHandledCheckpoints.includes(lead._renewalDays)
  );
```

E troque a linha que chama `cardBadge` (linha 109) por:

```js
  const badge = cardBadge({ isWon, isLost, isOverdue, isToday, hasFollowUp, renewalDaysLeft });
```

Acrescente o import de `daysToExpiryOf` junto dos outros:

```js
import { renewalDecline, daysToExpiryOf } from '../lib/renewalGoal.js';
```

(A Task 5 já criou esse import com só `renewalDecline` — acrescente `daysToExpiryOf` na mesma linha em vez de criar outra.)

- [ ] **Step 3: Mostre o selo na linha de compromisso**

O card tem uma linha logo abaixo do nome que hoje mostra follow-up, matrícula ou perda (linha 161). Para o card de renovação, ela mostra se o marco já foi tratado.

Localize a abertura do bloco:

```jsx
          {isWon ? (
```

Troque por:

```jsx
          {lead._renewalCard ? (
            marcoTratado ? (
              <>
                <Check className="size-[11px] shrink-0" strokeWidth={2.2} />
                <span className="truncate">Marco de {lead._renewalDays} dias tratado</span>
              </>
            ) : (
              <>
                <AlertCircle className="size-[11px] shrink-0" strokeWidth={2.2} />
                <span className="truncate">Aguardando contato</span>
              </>
            )
          ) : isWon ? (
```

`Check` e `AlertCircle` já estão importados no arquivo (linha 21).

- [ ] **Step 4: Verifique o lint**

```bash
npx eslint src/views/KanbanView.jsx
```

Esperado: nenhum erro novo.

- [ ] **Step 5: Rode a suíte**

```bash
npm test
```

Esperado: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/views/KanbanView.jsx
git commit -m "feat: card do funil Renovações com dias para vencer e marco tratado"
```

---

## Task 7: Provisionamento do funil

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Acrescente o import**

Junto do import do funil Vencidos (linha 56):

```js
import { planRenewalSetupOps } from './lib/renewalFunnel.js';
```

- [ ] **Step 2: Acrescente o estado**

Junto dos estados de provisionamento (linhas 337-339):

```js
  const [renewalSetupDone, setRenewalSetupDone] = useState(null);
  const [renewalFunnelStatus, setRenewalFunnelStatus] = useState('idle');
```

- [ ] **Step 3: Leia a marca da config**

No `onSnapshot` da config (logo depois da linha 781, `setExpiredSetupDone(...)`):

```js
      setRenewalSetupDone(!!data?.renewalFunnelSetupDoneAt);
```

- [ ] **Step 4: Escreva o effect de provisionamento**

Logo **depois** do effect do funil Vencidos (que termina na linha 1145), acrescente:

```js
  // Funil RENOVAÇÕES do board. Mesmo desenho dos dois provisionamentos acima, e
  // guardado pelo Vencidos estar 'done' para as escritas não correrem juntas no
  // primeiro login de admin de uma academia nova.
  //
  // Mais simples que os irmãos: as colunas deste funil são VIRTUAIS (derivadas
  // dos marcos de renovação), então não há etapa nenhuma para criar.
  useEffect(() => {
    if (!appUser || !isAdminUser(appUser)) return;
    if (loadingData) return;
    if (expiredFunnelStatus !== 'done') return;
    if (renewalFunnelStatus !== 'idle') return;
    if (renewalSetupDone === null) return;
    if (renewalSetupDone) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- encerra a máquina de estados; guardado por status !== 'idle'.
      setRenewalFunnelStatus('done');
      return;
    }

    setRenewalFunnelStatus('running');

    (async () => {
      try {
        // Snapshot fresco por getDocs (não o prop): elimina a corrida com a
        // assinatura ao vivo ainda vazia no boot.
        const funnelsSnap = await getDocs(
          collection(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH)
        );
        const plan = planRenewalSetupOps({
          funnels: funnelsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        });

        if (plan.createFunnel) {
          await addDoc(
            collection(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH),
            { ...plan.createFunnel, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
          );
        }

        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CONFIG_GENERAL_ID),
          { renewalFunnelSetupDoneAt: serverTimestamp() },
          { merge: true }
        );

        setRenewalFunnelStatus('done');
      } catch (err) {
        console.error('Erro no provisionamento do funil de renovações', err);
        setRenewalFunnelStatus('error');
      }
    })();
  }, [appUser, loadingData, expiredFunnelStatus, renewalFunnelStatus, renewalSetupDone]);
```

- [ ] **Step 5: Verifique o lint**

```bash
npx eslint src/App.jsx
```

Esperado: nenhum erro novo.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: provisionamento do funil Renovações"
```

---

## Task 8: Configurações → Funis

**Files:**
- Modify: `src/views/settings/FunnelsSection.jsx`

- [ ] **Step 1: Acrescente o import**

```js
import { isRenewalFunnel } from '../../lib/renewalFunnel.js';
```

- [ ] **Step 2: Generalize os três avisos**

Hoje eles citam Indicações na unha, e agora são três funis de sistema.

Linha 66, troque:

```js
          toast.warning('O funil de Indicações é do sistema e não pode ser renomeado.');
```

por:

```js
          toast.warning(`O funil "${funnelDialog.funnel.name}" é do sistema e não pode ser renomeado.`);
```

Linha 103, troque:

```js
      toast.warning('O funil de Indicações não pode ser o padrão.');
```

por:

```js
      toast.warning(`O funil "${f.name}" é do sistema e não pode ser o padrão.`);
```

O aviso da linha 118 (`'Este funil é do sistema e não pode ser excluído.'`) já é genérico — não mexa.

- [ ] **Step 3: Corrija o `title` do selo Sistema**

Linha 286, troque:

```jsx
                      title="Funil do sistema para indicações — só as etapas do meio são configuráveis"
```

por:

```jsx
                      title={isRenewalFunnel(f)
                        ? 'Funil do sistema — as colunas são os marcos de renovação, configurados em Metas & ritmo'
                        : 'Funil do sistema — só as etapas do meio são configuráveis'}
```

- [ ] **Step 4: Troque o painel de etapas para o funil de Renovações**

Localize o `SettingsPanel` (linha 318) e troque a `hint` e a `action`:

```jsx
            hint={isSystemFunnel(selected)
              ? `${REFERRAL_ENTRY_NAME} é a porta de entrada das indicações; Negociação, Venda e Perda também são do sistema. Configure as etapas do meio.`
              : 'Arraste para reordenar. Negociação, Venda e Perda são etapas do sistema.'}
            action={<SettingsBtn size={34} icon={<Plus size={13} />} onClick={() => openStage(null)}>Nova etapa</SettingsBtn>}
```

por:

```jsx
            hint={isRenewalFunnel(selected)
              ? 'As colunas deste funil são os marcos de renovação, configurados em Metas & ritmo. Elas mudam sozinhas quando você muda os marcos.'
              : isSystemFunnel(selected)
                ? `${REFERRAL_ENTRY_NAME} é a porta de entrada das indicações; Negociação, Venda e Perda também são do sistema. Configure as etapas do meio.`
                : 'Arraste para reordenar. Negociação, Venda e Perda são etapas do sistema.'}
            // Funil de Renovações não tem etapa no banco: criar uma aqui geraria
            // uma coluna que o board nunca renderiza.
            action={isRenewalFunnel(selected) ? null : (
              <SettingsBtn size={34} icon={<Plus size={13} />} onClick={() => openStage(null)}>Nova etapa</SettingsBtn>
            )}
```

- [ ] **Step 5: Troque o estado vazio**

Localize (linha 327):

```jsx
              {selectedStages.length === 0 ? (
                <EmptyState>Nenhuma etapa neste funil ainda — crie a primeira.</EmptyState>
```

Troque por:

```jsx
              {selectedStages.length === 0 ? (
                <EmptyState>
                  {isRenewalFunnel(selected)
                    ? 'Este funil não tem etapas para configurar: as colunas do board são os marcos de renovação.'
                    : 'Nenhuma etapa neste funil ainda — crie a primeira.'}
                </EmptyState>
```

- [ ] **Step 6: Verifique o lint**

```bash
npx eslint src/views/settings/FunnelsSection.jsx
```

Esperado: nenhum erro novo.

- [ ] **Step 7: Rode a suíte inteira**

```bash
npm test
```

Esperado: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/views/settings/FunnelsSection.jsx
git commit -m "feat: funil Renovações em Configurações sem etapas configuráveis"
```

---

## Task 9: Verificação ao vivo

**Nada de código aqui.** O board depende de dados reais (clientes com contrato em faixas diferentes), e nenhum teste automatizado cobre o caminho de escrita.

- [ ] **Step 1: Suba o preview**

```bash
npm run dev
```

Se der erro de dependência faltando, rode `npm install` antes — worktree costuma vir com `node_modules` incompleto (ver a memória `worktree-build-missing-deps`).

- [ ] **Step 2: Confira o provisionamento**

Entre como **admin**. O funil "Renovações" deve aparecer na barra de funis, entre Indicações e Vencidos. Recarregue a página: ele **não** pode duplicar.

- [ ] **Step 3: Confira a distribuição pelas colunas**

Abra a aba Renovações. Para cada card, abra a ficha e confira que a data de fim do contrato bate com a coluna onde ele está:

| Coluna | Vencimento esperado |
|---|---|
| 90 dias | entre 61 e 90 dias a partir de hoje |
| 60 dias | entre 31 e 60 dias |
| 30 dias | de hoje até 30 dias |

- [ ] **Step 4: Confira que o cliente continua cliente**

Abra a aba Clientes. Todos os que aparecem no board de Renovações precisam continuar listados lá, com contrato ativo. **Este é o teste que pega o pior bug possível** (a projeção gravando `status` de verdade).

- [ ] **Step 5: Teste o arrasto recusado**

Arraste um card de "90 dias" para "60 dias". Esperado: o card volta e aparece o aviso de que as colunas seguem o vencimento.

- [ ] **Step 6: Teste a recusa e o desfazer**

Arraste um card para **Perda**. Esperado: ele sai da coluna do marco e aparece na Perda; a ficha mostra "não vai renovar"; ele **continua** na aba Clientes. Arraste de volta para uma coluna de marco: a recusa desfaz.

- [ ] **Step 6b: Teste o menu "Mover" (o caminho de toque)**

No card, abra o menu "Mover" (o ícone de setas no rodapé). Escolha uma coluna de
marco: esperado o mesmo aviso do arrasto, **sem gravar nada**. Depois abra a
ficha desse cliente e confirme que o contrato e o estado de cliente seguem
intactos. Este é o caminho que corrompia o documento.

- [ ] **Step 7: Teste a renovação**

Arraste um card para **Venda**. Esperado: abre o modal de contrato **em modo renovação** (o início da vigência já vem emendado no fim do contrato atual, não na data de hoje). Feche sem salvar.

- [ ] **Step 8: Teste a config**

Em Configurações → Metas & ritmo, mude os marcos para 120/90/60/30. Volte ao board: devem aparecer quatro colunas. Devolva a config para 90/60/30 no fim.

- [ ] **Step 9: Confira Configurações → Funis**

O funil Renovações precisa aparecer com o selo "Sistema", sem botão "Nova etapa", com a nota explicando que as colunas são os marcos.

- [ ] **Step 10: Abra o PR**

```bash
git push -u origin HEAD
```

Depois abra o PR com `gh pr create`, descrevendo: o que o funil faz, que não há índice nem regra nova para publicar, e o roteiro de verificação acima para o Johnny repetir.

---

## Checklist final antes do merge

- [ ] `npm test` verde
- [ ] `npx eslint .` sem erro novo
- [ ] Nenhum índice novo em `firestore.indexes.json`
- [ ] Nenhuma regra do Firestore para publicar no console
- [ ] Nenhum campo novo gravado no lead (só `renewalDeclined` e `renewalHandledCheckpoints`, que já existiam)
- [ ] O cliente do board continua aparecendo na aba Clientes
