# Funil Upgrade no board — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um funil de sistema "Upgrade" no Pipeline onde o consultor coloca clientes à mão para vender um plano melhor, sem que a pessoa deixe de ser cliente em momento algum.

**Architecture:** Cópia do molde do funil Vencidos: a etapa do cliente mora num campo próprio do lead (`upgradeStageId`), o board carrega quem tem o campo e projeta o nome da etapa no card em memória, e o `status` real nunca é tocado. Regras puras em `src/lib/upgradeFunnel.js` e `src/lib/stageMove.js`; o Kanban e a ficha só chamam. Fechar é o modal de contrato que já existe; todo contrato novo limpa o funil e grava `closedFromUpgrade`.

**Tech Stack:** React 19 + Vite, Firebase Firestore (SDK web), Vitest. JS/JSX sem TypeScript. Spec: `docs/superpowers/specs/2026-09-08-funil-upgrade-design.md`.

---

## Antes de começar

- Branch: `claude/funil-upgrade` (já existe, com o spec). Confira que está em cima da main: `git rev-list --count HEAD..origin/main` deve dar `0`.
- Rode `npm test` uma vez: deve terminar com `Tests  993 passed` (ou mais). Se `vitest` não existir em `node_modules/.bin`, rode `npm install`.
- Convenções do repositório: sem TypeScript; comentários em português; `cn()` para classes; tokens semânticos em código novo; commits em português no formato `tipo: descrição`, terminando com a linha `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Nada de Firestore rules nem índice novo: a única consulta nova é `where('upgradeStageId', '!=', null)` com `orderBy('upgradeStageId')`, coberta pelo índice automático de campo único, e as rules de `stronix_leads` e `stronix_contratos` não fecham lista de campos.
- Texto de evento na linha do tempo NUNCA leva colchetes: `extractStageNameFromInteractionText` (`src/lib/timeline.js:5`) extrai `[etapa]` para montar a cadeia de fases de lead.

## Mapa de arquivos

| Arquivo | Papel |
|---|---|
| `src/lib/upgradeFunnel.js` (novo) | Discriminador, entrada, plano de provisionamento, projeção do card. Puro. |
| `src/lib/__tests__/upgradeFunnel.test.js` (novo) | Testes do módulo acima. |
| `src/lib/leadQueries.js` | `upgradeClientsQuerySpec` (quem está no funil). |
| `src/lib/stageMove.js` | `planUpgradeMove`, `planUpgradeDecline`, `planLoss` com `kind`, mensagens. |
| `src/lib/contracts.js` | `buildMatriculaWrites` limpa o funil e marca o contrato; `hasLiveContract`. |
| `src/App.jsx` | Provisionamento do funil no primeiro login de gestor. |
| `src/views/KanbanView.jsx` | Aba Upgrade: carga, projeção, contagem, arrasto, Mover, Venda, Perda. |
| `src/views/LeadProfileView.jsx` | Entrada e saída pela ficha, chip no cabeçalho, aviso do "Mudar fase". |
| `src/lib/wiki.js` | Artigo da Central de ajuda. |

---

### Task 1: Módulo puro `upgradeFunnel.js`

**Files:**
- Create: `src/lib/upgradeFunnel.js`
- Test: `src/lib/__tests__/upgradeFunnel.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/lib/__tests__/upgradeFunnel.test.js`:

```js
// Testes do funil de sistema UPGRADE (src/lib/upgradeFunnel.js). Espelho dos
// testes do Vencidos: a diferença é que aqui só a entrada nasce, e o card só
// existe depois que alguém grava upgradeStageId.

import { describe, it, expect } from 'vitest';
import {
  UPGRADE_FUNNEL_KIND, UPGRADE_FUNNEL_NAME, UPGRADE_ENTRY_NAME, UPGRADE_FUNNEL_ORDER,
  isUpgradeFunnel, getUpgradeFunnel, getUpgradeEntryStage,
  planUpgradeSetupOps, upgradeStageIdOf, projectUpgradeLeads,
} from '../upgradeFunnel.js';
import { partitionLeadsByStatus } from '../kanban.js';

describe('isUpgradeFunnel', () => {
  it('casa pela flag, NUNCA pelo nome', () => {
    expect(isUpgradeFunnel({ systemKind: 'upgrade' })).toBe(true);
    expect(isUpgradeFunnel({ name: 'Upgrade' })).toBe(false);
    expect(isUpgradeFunnel(null)).toBe(false);
  });
});

describe('getUpgradeFunnel', () => {
  it('duplicata resolve pelo createdAt mais antigo', () => {
    const novo = { id: 'b', systemKind: 'upgrade', createdAt: 2000 };
    const velho = { id: 'a', systemKind: 'upgrade', createdAt: 1000 };
    expect(getUpgradeFunnel([novo, velho]).id).toBe('a');
  });
  it('sem funil de sistema devolve null', () => {
    expect(getUpgradeFunnel([{ id: 'x', name: 'Upgrade' }])).toBeNull();
    expect(getUpgradeFunnel([])).toBeNull();
    expect(getUpgradeFunnel(null)).toBeNull();
  });
});

describe('getUpgradeEntryStage', () => {
  const f = 'f1';
  it('acha pela flag isEntry', () => {
    const st = [{ id: 's1', funnelId: f, isEntry: true }, { id: 's2', funnelId: f }];
    expect(getUpgradeEntryStage(st, f).id).toBe('s1');
  });
  it('self-heal: sem isEntry, cai no isSystem com o nome padrão', () => {
    const st = [{ id: 's2', funnelId: f, order: 1 }, { id: 's1', funnelId: f, isSystem: true, name: 'Aguardando contato' }];
    expect(getUpgradeEntryStage(st, f).id).toBe('s1');
  });
  it('self-heal final: cai na de menor order', () => {
    const st = [{ id: 's2', funnelId: f, order: 3 }, { id: 's1', funnelId: f, order: 1 }];
    expect(getUpgradeEntryStage(st, f).id).toBe('s1');
  });
  it('sem funil ou sem etapa devolve null', () => {
    expect(getUpgradeEntryStage([], null)).toBeNull();
    expect(getUpgradeEntryStage([], 'f1')).toBeNull();
  });
});

describe('planUpgradeSetupOps', () => {
  it('base zerada: cria o funil (ordem 97) e SÓ a entrada', () => {
    const plan = planUpgradeSetupOps({ funnels: [], statuses: [] });
    expect(plan.createFunnel).toEqual({ name: UPGRADE_FUNNEL_NAME, systemKind: UPGRADE_FUNNEL_KIND, order: UPGRADE_FUNNEL_ORDER });
    expect(UPGRADE_FUNNEL_ORDER).toBe(97);
    expect(plan.createStages.map(s => s.name)).toEqual([UPGRADE_ENTRY_NAME]);
    expect(UPGRADE_ENTRY_NAME).toBe('Aguardando contato');
  });

  it('a entrada nasce protegida; Venda e Perda não são etapas', () => {
    const stages = planUpgradeSetupOps({ funnels: [], statuses: [] }).createStages;
    expect(stages[0]).toMatchObject({ isSystem: true, isEntry: true, order: 0 });
    expect(stages.some(s => s.name === 'Venda' || s.name === 'Perda')).toBe(false);
  });

  it('idempotente: com funil e entrada não cria nada', () => {
    const funnels = [{ id: 'f1', systemKind: UPGRADE_FUNNEL_KIND }];
    const statuses = [{ id: 'a', funnelId: 'f1', name: UPGRADE_ENTRY_NAME, isSystem: true, isEntry: true }];
    const plan = planUpgradeSetupOps({ funnels, statuses });
    expect(plan.createFunnel).toBeNull();
    expect(plan.createStages).toEqual([]);
  });

  it('self-heal: funil existe mas a ENTRADA sumiu', () => {
    const funnels = [{ id: 'f1', systemKind: UPGRADE_FUNNEL_KIND }];
    const statuses = [{ id: 'b', funnelId: 'f1', name: 'Em contato' }];
    const plan = planUpgradeSetupOps({ funnels, statuses });
    expect(plan.createFunnel).toBeNull();
    expect(plan.createStages.map(s => s.name)).toEqual([UPGRADE_ENTRY_NAME]);
    expect(plan.createStages[0].funnelId).toBe('f1');
  });

  it('etapas de OUTRO funil não contam como existentes', () => {
    const funnels = [{ id: 'f1', systemKind: UPGRADE_FUNNEL_KIND }];
    const statuses = [{ id: 'x', funnelId: 'outro', name: UPGRADE_ENTRY_NAME, isEntry: true }];
    expect(planUpgradeSetupOps({ funnels, statuses }).createStages.map(s => s.name)).toEqual([UPGRADE_ENTRY_NAME]);
  });
});

describe('upgradeStageIdOf', () => {
  const stages = [
    { id: 'entrada', funnelId: 'f1', isEntry: true, name: 'Aguardando contato' },
    { id: 'meio', funnelId: 'f1', name: 'Em contato' },
  ];
  it('manda o campo gravado', () => {
    expect(upgradeStageIdOf({ upgradeStageId: 'meio' }, stages, 'f1')).toBe('meio');
  });
  it('etapa apagada em Configurações cai na entrada', () => {
    expect(upgradeStageIdOf({ upgradeStageId: 'sumiu' }, stages, 'f1')).toBe('entrada');
  });
  it('sem etapas devolve null em vez de quebrar', () => {
    expect(upgradeStageIdOf({ upgradeStageId: 'meio' }, [], 'f1')).toBeNull();
  });
});

describe('projectUpgradeLeads', () => {
  const stages = [
    { id: 'entrada', funnelId: 'f1', isEntry: true, name: 'Aguardando contato' },
    { id: 'meio', funnelId: 'f1', name: 'Em contato' },
  ];
  const leads = [
    { id: 'l1', name: 'Ana', status: 'Venda', upgradeStageId: 'entrada' },
    { id: 'l2', name: 'Bia', status: 'Venda', upgradeStageId: 'meio' },
  ];

  it('o status EXIBIDO vira o nome da etapa e o card ganha _upgradeCard', () => {
    const cards = projectUpgradeLeads(leads, stages, 'f1');
    expect(cards.map(c => c.status)).toEqual(['Aguardando contato', 'Em contato']);
    expect(cards.every(c => c._upgradeCard === true)).toBe(true);
  });

  it('não muda o objeto original (o status real segue Venda)', () => {
    projectUpgradeLeads(leads, stages, 'f1');
    expect(leads[0].status).toBe('Venda');
  });

  it('sem funil devolve vazio', () => {
    expect(projectUpgradeLeads(leads, stages, null)).toEqual([]);
  });

  it('cai direto nas colunas do board (partitionLeadsByStatus agrupa pelo nome)', () => {
    const by = partitionLeadsByStatus(projectUpgradeLeads(leads, stages, 'f1'));
    expect(by.get('Aguardando contato').map(l => l.id)).toEqual(['l1']);
    expect(by.get('Em contato').map(l => l.id)).toEqual(['l2']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/upgradeFunnel.test.js`
Expected: `Test Files  1 failed` com erro de módulo não encontrado (`../upgradeFunnel.js`).

- [ ] **Step 3: Escrever o módulo**

Crie `src/lib/upgradeFunnel.js`:

```js
// Regras puras do funil de sistema UPGRADE no board (pipeline): discriminador,
// etapa de entrada, plano idempotente do provisionamento e a projeção do card.
// Sem React e sem Firestore — o COMO gravar fica nos callers.
//
// Espelha src/lib/expiredFunnel.js, o molde de funil de sistema deste repo,
// com uma diferença: lá o card é DERIVADO do vencimento e ninguém precisa criar
// nada; aqui a entrada é decisão do consultor, então o card só existe depois
// que alguém grava `upgradeStageId` (ficha, "Mudar fase"). Não há retroativo.
//
// O que este funil respeita (PR #197): cliente não volta a ser lead. Mover
// aqui grava só upgradeStageId; sair zera só ele; fechar é o modal de contrato
// de sempre. `status`, `funnelId`, `lifecycleStage` e `isConverted` não são
// tocados por nada deste módulo.

import { normalize } from './globalSearch.js';

// Discriminador. NUNCA casar por nome: a academia pode ter um funil "Upgrade"
// próprio — os dois convivem e só este flag diferencia.
export const UPGRADE_FUNNEL_KIND = 'upgrade';
export const UPGRADE_FUNNEL_NAME = 'Upgrade';
// Entre Indicações e Renovações (98) na barra de funis.
export const UPGRADE_FUNNEL_ORDER = 97;
// Etapa 1 (fixa). A ÚNICA semeada: as demais a academia decide (decisão do
// Johnny, 08/09/2026).
export const UPGRADE_ENTRY_NAME = 'Aguardando contato';

// VENDA e PERDA não são etapas deste funil. O board renderiza as duas como
// colunas ESPECIAIS em todo funil — criá-las aqui produziria colunas duplicadas.

export const isUpgradeFunnel = (f) => f?.systemKind === UPGRADE_FUNNEL_KIND;

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
export const getUpgradeFunnel = (funnels) => {
  const list = (funnels || []).filter(isUpgradeFunnel);
  if (!list.length) return null;
  return list.reduce((best, f) => (createdAtMs(f) < createdAtMs(best) ? f : best));
};

const sameStageName = (name, target) => normalize(name).trim() === normalize(target).trim();

// Self-heal caso a flag ou a etapa se percam por fora (console):
// isEntry -> isSystem com o nome padrão -> menor order.
export const getUpgradeEntryStage = (statuses, funnelId) => {
  if (!funnelId) return null;
  const inFunnel = (statuses || []).filter((s) => s?.funnelId === funnelId);
  if (!inFunnel.length) return null;
  return (
    inFunnel.find((s) => s.isEntry) ||
    inFunnel.find((s) => s.isSystem && sameStageName(s.name, UPGRADE_ENTRY_NAME)) ||
    inFunnel.reduce((best, s) => ((s.order ?? 99) < (best.order ?? 99) ? s : best))
  );
};

// Plano idempotente do provisionamento. Só a ENTRADA é garantida: ela é
// protegida e o funil não funciona sem ela. Nada mais é semeado, e nada volta
// se a academia apagar.
export const planUpgradeSetupOps = ({ funnels, statuses } = {}) => {
  const existing = getUpgradeFunnel(funnels);
  const entrada = { name: UPGRADE_ENTRY_NAME, color: 'slate', order: 0, isSystem: true, isEntry: true };

  if (!existing) {
    return {
      createFunnel: { name: UPGRADE_FUNNEL_NAME, systemKind: UPGRADE_FUNNEL_KIND, order: UPGRADE_FUNNEL_ORDER },
      createStages: [entrada],
    };
  }

  const inFunnel = (statuses || []).filter((s) => s?.funnelId === existing.id);
  const temEntrada = inFunnel.some((s) => s.isEntry || sameStageName(s.name, UPGRADE_ENTRY_NAME));
  return {
    createFunnel: null,
    createStages: temEntrada ? [] : [{ ...entrada, funnelId: existing.id }],
  };
};

// Etapa do card. É o campo gravado; se ele aponta para uma etapa que a
// academia apagou em Configurações, o card cai na entrada (o primeiro arrasto
// corrige o campo).
export const upgradeStageIdOf = (lead, statuses, funnelId) => {
  const inFunnel = (statuses || []).filter((s) => s?.funnelId === funnelId);
  if (lead?.upgradeStageId && inFunnel.some((s) => s.id === lead.upgradeStageId)) return lead.upgradeStageId;
  return getUpgradeEntryStage(statuses, funnelId)?.id || null;
};

// Projeta clientes do funil como cards do board.
//
// As colunas do Kanban casam por NOME e os cards são agrupados por
// `lead.status` (ver partitionLeadsByStatus). Cliente é `status: 'Venda'`, então
// sem projeção todos cairiam na coluna Venda. Aqui o status EXIBIDO vira o nome
// da etapa. A projeção é SÓ EM MEMÓRIA: o `status` real continua 'Venda'.
//
// `_upgradeCard` marca o card projetado — os handlers usam para saber que
// precisam gravar upgradeStageId em vez de status.
export const projectUpgradeLeads = (leads, statuses, funnelId) => {
  if (!funnelId) return [];
  const inFunnel = (statuses || []).filter((s) => s?.funnelId === funnelId);
  const nameById = new Map(inFunnel.map((s) => [s.id, s.name]));
  return (leads || []).map((lead) => {
    const stageId = upgradeStageIdOf(lead, statuses, funnelId);
    const name = stageId ? nameById.get(stageId) : null;
    return name ? { ...lead, status: name, _upgradeCard: true } : null;
  }).filter(Boolean);
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/upgradeFunnel.test.js`
Expected: `Tests  19 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/upgradeFunnel.js src/lib/__tests__/upgradeFunnel.test.js
git commit -m "feat(upgrade): regras puras do funil Upgrade (provisionamento e projeção)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Consulta `upgradeClientsQuerySpec`

**Files:**
- Modify: `src/lib/leadQueries.js` (logo depois de `expiredClientsQuerySpec`, por volta da linha 110)
- Test: `src/lib/__tests__/leadQueries.test.js`

- [ ] **Step 1: Escrever o teste que falha**

No topo de `src/lib/__tests__/leadQueries.test.js`, acrescente `upgradeClientsQuerySpec` ao `import { ... } from '../leadQueries.js'`. No fim do arquivo, adicione:

```js
describe('upgradeClientsQuerySpec', () => {
  // '!=' null só devolve docs em que o campo existe e não é nulo: exatamente
  // "quem está no funil". Só cliente recebe o campo, então não cruza com o balde.
  it('filtra quem tem upgradeStageId gravado', () => {
    expect(upgradeClientsQuerySpec().wheres).toEqual([
      { field: 'upgradeStageId', op: '!=', value: null },
    ]);
  });

  // O Firestore exige que o primeiro orderBy seja o campo da desigualdade.
  it('ordena pelo próprio campo da desigualdade e não pagina', () => {
    const spec = upgradeClientsQuerySpec();
    expect(spec.orderBy).toEqual({ field: 'upgradeStageId', dir: 'asc' });
    expect(spec.limit).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/leadQueries.test.js`
Expected: falha com `upgradeClientsQuerySpec is not a function`.

- [ ] **Step 3: Implementar**

Em `src/lib/leadQueries.js`, logo após a função `expiredClientsQuerySpec`, adicione:

```js
// FUNIL UPGRADE do board (src/lib/upgradeFunnel.js): cliente que o consultor
// colocou à mão. Só quem tem `upgradeStageId` gravado. '!=' null devolve só docs
// em que o campo existe e não é nulo, e só cliente recebe o campo — por isso
// não cruza com lifecycleBucket, e não precisa de índice manual (campo único).
//
// Sem limit de propósito: o funil guarda quem está sendo trabalhado, não a base
// inteira. O orderBy pelo próprio campo é exigência do Firestore para
// desigualdade, não uma escolha de ordem (a coluna é decidida pela projeção).
export const upgradeClientsQuerySpec = () => ({
  wheres: [{ field: 'upgradeStageId', op: '!=', value: null }],
  orderBy: { field: 'upgradeStageId', dir: 'asc' },
});
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/leadQueries.test.js`
Expected: todos verdes, incluindo os 2 novos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/leadQueries.js src/lib/__tests__/leadQueries.test.js
git commit -m "feat(upgrade): consulta de quem está no funil Upgrade

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Regras de escrita em `stageMove.js`

**Files:**
- Modify: `src/lib/stageMove.js`
- Test: `src/lib/__tests__/stageMove.test.js`

- [ ] **Step 1: Ajustar o teste existente de `planLoss` e escrever os novos**

Em `src/lib/__tests__/stageMove.test.js`, troque o import por:

```js
import { planStageMove, planLoss, planUpgradeMove, planUpgradeDecline, stageMoveBlockMessage, STAGE_MOVE_BLOCK } from '../stageMove.js';
```

Dentro de `describe('planLoss — cliente não vira lead perdido', ...)`, substitua o primeiro `it` por:

```js
  it('lead em etapa comum pode ser marcado como Perda', () => {
    expect(planLoss(leadEmEtapa)).toEqual({ ok: true, kind: 'lead' });
  });

  it('cliente no funil Upgrade: a Perda é sair do Upgrade, e a pessoa segue cliente', () => {
    expect(planLoss({ ...clienteComContrato, upgradeStageId: 'st1' })).toEqual({ ok: true, kind: 'upgrade' });
  });
```

No fim do arquivo, adicione:

```js
describe('planUpgradeMove — entrar e mover no funil Upgrade', () => {
  const entrada = { id: 'st-entrada', name: 'Aguardando contato' };
  const meio = { id: 'st-meio', name: 'Em contato' };

  it('cliente fora do funil entra: patch só com a etapa, entering true, texto sem colchetes', () => {
    const plan = planUpgradeMove(clienteComContrato, entrada);
    expect(plan.ok).toBe(true);
    expect(plan.entering).toBe(true);
    expect(plan.patch).toEqual({ upgradeStageId: 'st-entrada' });
    expect(plan.interactionText).toBe('Upgrade: entrou na etapa Aguardando contato.');
    expect(plan.interactionText).not.toMatch(/[[\]]/);
  });

  it('cliente já no funil só muda de etapa: entering false', () => {
    const plan = planUpgradeMove({ ...clienteComContrato, upgradeStageId: 'st-entrada' }, meio);
    expect(plan.entering).toBe(false);
    expect(plan.patch).toEqual({ upgradeStageId: 'st-meio' });
    expect(plan.interactionText).toBe('Upgrade: movido para a etapa Em contato.');
  });

  it('nunca toca status, funil ou marcas de cliente', () => {
    const plan = planUpgradeMove(clienteComContrato, meio);
    expect(Object.keys(plan.patch)).toEqual(['upgradeStageId']);
  });

  it('lead ainda não é cliente: bloqueia', () => {
    const plan = planUpgradeMove(leadEmEtapa, entrada);
    expect(plan.ok).toBe(false);
    expect(plan.reason).toBe(STAGE_MOVE_BLOCK.UPGRADE_SO_CLIENTE);
  });

  it('etapa inexistente: bloqueia', () => {
    expect(planUpgradeMove(clienteComContrato, null).reason).toBe(STAGE_MOVE_BLOCK.UPGRADE_ETAPA_INVALIDA);
    expect(planUpgradeMove(clienteComContrato, { name: 'sem id' }).ok).toBe(false);
  });
});

describe('planUpgradeDecline — não quis o upgrade', () => {
  it('zera a etapa e a entrada, e o texto leva o motivo', () => {
    const plan = planUpgradeDecline({ ...clienteComContrato, upgradeStageId: 'st1' }, 'Preço');
    expect(plan.patch).toEqual({ upgradeStageId: null, upgradeEnteredAt: null });
    expect(plan.interactionText).toBe('Upgrade: não quis. Motivo: Preço.');
  });

  it('sem motivo o texto fecha sem o "Motivo:"', () => {
    expect(planUpgradeDecline(clienteComContrato, '').interactionText).toBe('Upgrade: não quis.');
  });
});

describe('stageMoveBlockMessage — razões do Upgrade', () => {
  it('lead no funil Upgrade fala em lead, não em cliente', () => {
    const msg = stageMoveBlockMessage(leadEmEtapa, STAGE_MOVE_BLOCK.UPGRADE_SO_CLIENTE);
    expect(msg).toContain('Ana');
    expect(msg).toContain('ainda é lead');
  });
  it('etapa inválida pede para recarregar', () => {
    expect(stageMoveBlockMessage({}, STAGE_MOVE_BLOCK.UPGRADE_ETAPA_INVALIDA)).toContain('Recarregue');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/stageMove.test.js`
Expected: falhas em `planLoss` (esperava `kind`) e `planUpgradeMove is not a function`.

- [ ] **Step 3: Implementar**

Em `src/lib/stageMove.js`, substitua o bloco `STAGE_MOVE_BLOCK`, a função `planLoss` e a função `stageMoveBlockMessage`, e acrescente as duas funções novas. Do `export const STAGE_MOVE_BLOCK` em diante o arquivo fica assim (mantenha `planStageMove` exatamente como está):

```js
export const STAGE_MOVE_BLOCK = {
  CLIENTE_NAO_VOLTA_A_LEAD: 'cliente_nao_volta_a_lead',
  CLIENTE_NAO_VIRA_PERDA: 'cliente_nao_vira_perda',
  UPGRADE_SO_CLIENTE: 'upgrade_so_cliente',
  UPGRADE_ETAPA_INVALIDA: 'upgrade_etapa_invalida'
};

export function planStageMove(lead, targetStatus, { funnelId = null } = {}) {
  // ... (sem mudança)
}

// Perda: lead comum vira Perda; cliente no funil Upgrade sai do Upgrade
// (planUpgradeDecline); cliente fora dele continua barrado.
export function planLoss(lead) {
  if (!isClientLead(lead)) return { ok: true, kind: 'lead' };
  if (lead?.upgradeStageId) return { ok: true, kind: 'upgrade' };
  return { ok: false, reason: STAGE_MOVE_BLOCK.CLIENTE_NAO_VIRA_PERDA };
}

// Entrar no funil Upgrade ou mudar de etapa dentro dele. O patch leva SÓ
// upgradeStageId; quando está entrando, o caller acrescenta
// `upgradeEnteredAt: serverTimestamp()` (é do SDK, não cabe aqui). O texto do
// evento não usa colchetes de propósito: a linha do tempo reconstrói a cadeia
// de fases de LEAD a partir de "[etapa]" (src/lib/timeline.js), e a etapa de
// Upgrade não pode entrar nessa cadeia.
export function planUpgradeMove(lead, stage) {
  if (!isClientLead(lead)) return { ok: false, reason: STAGE_MOVE_BLOCK.UPGRADE_SO_CLIENTE };
  if (!stage?.id) return { ok: false, reason: STAGE_MOVE_BLOCK.UPGRADE_ETAPA_INVALIDA };
  const entering = !lead?.upgradeStageId;
  return {
    ok: true,
    entering,
    patch: { upgradeStageId: stage.id },
    interactionText: entering
      ? `Upgrade: entrou na etapa ${stage.name}.`
      : `Upgrade: movido para a etapa ${stage.name}.`
  };
}

// "Não quis o upgrade": sai do funil e mais nada. A pessoa segue cliente. O
// caller acrescenta `upgradeDeclinedAt: serverTimestamp()`.
export function planUpgradeDecline(lead, reason) {
  const motivo = String(reason || '').trim();
  return {
    patch: { upgradeStageId: null, upgradeEnteredAt: null },
    interactionText: motivo ? `Upgrade: não quis. Motivo: ${motivo}.` : 'Upgrade: não quis.'
  };
}

// Texto do aviso quando o movimento é bloqueado. Um lugar só, para o Kanban e a
// ficha dizerem a mesma coisa.
export function stageMoveBlockMessage(lead, reason) {
  const firstName = String(lead?.name || '').trim().split(/\s+/)[0];
  const quem = firstName || 'Este cliente';
  if (reason === STAGE_MOVE_BLOCK.CLIENTE_NAO_VOLTA_A_LEAD) {
    const como = lead?.currentContractId
      ? ' Para encerrar a matrícula, cancele o contrato na aba Contratos.'
      : '';
    return `${quem} é cliente e não volta a ser lead.${como}`;
  }
  if (reason === STAGE_MOVE_BLOCK.CLIENTE_NAO_VIRA_PERDA) {
    return `${quem} é cliente e não vira lead perdido. Para encerrar, cancele o contrato na aba Contratos ou use a coluna Perda dos funis Renovações e Vencidos.`;
  }
  if (reason === STAGE_MOVE_BLOCK.UPGRADE_SO_CLIENTE) {
    return `${firstName || 'Esta pessoa'} ainda é lead. O funil Upgrade é para quem já é cliente.`;
  }
  if (reason === STAGE_MOVE_BLOCK.UPGRADE_ETAPA_INVALIDA) {
    return 'Essa etapa não existe mais no funil Upgrade. Recarregue a página e tente de novo.';
  }
  return 'Não foi possível mover para esta etapa.';
}
```

No comentário de cabeçalho do arquivo, acrescente uma linha: "`planUpgradeMove` e `planUpgradeDecline` são o único caminho de escrita da etapa de Upgrade (`upgradeStageId`)."

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/stageMove.test.js`
Expected: todos verdes (28 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stageMove.js src/lib/__tests__/stageMove.test.js
git commit -m "feat(upgrade): regras de entrar, mover e sair do funil Upgrade

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Fechamento em `contracts.js`

**Files:**
- Modify: `src/lib/contracts.js` (`buildMatriculaWrites`, por volta das linhas 160-185; e uma função nova após `deriveLeadContractStatus`)
- Test: `src/lib/__tests__/contracts.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/__tests__/contracts.test.js`, acrescente `hasLiveContract` ao import de `'../contracts.js'`. No fim do arquivo, adicione:

```js
describe('buildMatriculaWrites — funil Upgrade', () => {
  const plan = { id: 'p2', name: 'Trimestral', value: 500, durationMonths: 3 };
  const noFunil = { id: 'l1', name: 'Carla', upgradeStageId: 'st1', currentContractId: 'k1' };
  const foraDoFunil = { id: 'l2', name: 'Bruno', currentContractId: 'k2' };

  it('todo contrato novo limpa a etapa e a entrada do Upgrade', () => {
    const { leadPatch } = buildMatriculaWrites({ lead: noFunil, plan, value: 500, startsAt: D(2026, 9, 1), appUser: {} });
    expect(leadPatch.upgradeStageId).toBeNull();
    expect(leadPatch.upgradeEnteredAt).toBeNull();
  });

  it('marca o contrato como fechado pelo Upgrade quando o cliente estava no funil (decisão 9)', () => {
    const { contract } = buildMatriculaWrites({ lead: noFunil, plan, value: 500, startsAt: D(2026, 9, 1), appUser: {}, mode: 'renovacao', renewedFromId: 'k1' });
    expect(contract.closedFromUpgrade).toBe(true);
    // Uma venda só: continua sendo renovação também.
    expect(contract.renewedFromId).toBe('k1');
  });

  it('fora do funil, o contrato NÃO é upgrade, mesmo que o plano seja maior', () => {
    const { contract } = buildMatriculaWrites({ lead: foraDoFunil, plan, value: 500, startsAt: D(2026, 9, 1), appUser: {}, mode: 'renovacao' });
    expect(contract.closedFromUpgrade).toBe(false);
  });
});

describe('hasLiveContract', () => {
  const base = { currentContractId: 'k1', currentContractStartsAt: D(2026, 1, 10), currentContractEndsAt: D(2027, 1, 10) };
  it('ativo, a vencer, agendado e trancado são contrato vivo', () => {
    expect(hasLiveContract(base, NOW)).toBe(true);
    expect(hasLiveContract({ ...base, currentContractEndsAt: D(2026, 8, 20) }, NOW)).toBe(true);
    expect(hasLiveContract({ ...base, currentContractStartsAt: D(2026, 9, 1) }, NOW)).toBe(true);
    expect(hasLiveContract({ ...base, currentContractStatus: 'trancado' }, NOW)).toBe(true);
  });
  it('vencido, cancelado e sem contrato não são', () => {
    expect(hasLiveContract({ ...base, currentContractEndsAt: D(2026, 1, 10) }, NOW)).toBe(false);
    expect(hasLiveContract({ ...base, currentContractStatus: 'cancelado' }, NOW)).toBe(false);
    expect(hasLiveContract({ name: 'sem contrato' }, NOW)).toBe(false);
  });
});
```

(`D` e `NOW` já existem no topo desse arquivo: `NOW` é 28/07/2026.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/contracts.test.js`
Expected: falhas em `closedFromUpgrade`, `upgradeStageId` e `hasLiveContract is not a function`.

- [ ] **Step 3: Implementar**

Em `src/lib/contracts.js`, logo após `deriveLeadContractStatus`, adicione:

```js
// Contrato "vivo": o que ainda vale ou vai valer. Decide se fechar pelo funil
// Upgrade é renovação (liga ao atual e emenda a vigência) ou nova matrícula.
export const hasLiveContract = (lead, refDate, thresholdDays) => {
  if (!lead?.currentContractId) return false;
  const cs = deriveLeadContractStatus(lead, refDate, thresholdDays);
  return cs === CONTRACT_STATUS.ATIVO || cs === CONTRACT_STATUS.A_VENCER
    || cs === CONTRACT_STATUS.AGENDADO || cs === CONTRACT_STATUS.TRANCADO;
};
```

Em `buildMatriculaWrites`, no objeto `contract`, depois de `renewedFromId: renewedFromId || null,`, adicione:

```js
    // Fechou de dentro do funil Upgrade (decisão 9 do spec): a marca vem do
    // funil, não do plano. Renovação continua sendo renewedFromId; o mesmo
    // contrato pode ser os dois, e é uma venda só.
    closedFromUpgrade: Boolean(lead?.upgradeStageId),
```

No objeto `leadPatch`, troque a última chave `reactivationStageId: null` por:

```js
    reactivationStageId: null,
    // Funil UPGRADE (src/lib/upgradeFunnel.js): contrato novo, venha de onde
    // vier, tira o cliente do funil. Sem isto, quem fechou pela ficha ou pelo
    // Vencidos continuaria parado no Upgrade com um contrato novo.
    upgradeStageId: null,
    upgradeEnteredAt: null
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/contracts.test.js`
Expected: todos verdes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contracts.js src/lib/__tests__/contracts.test.js
git commit -m "feat(upgrade): contrato novo limpa o funil e grava closedFromUpgrade

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Linha do tempo: o evento do Upgrade não entra na cadeia de fases

**Files:**
- Test: `src/lib/__tests__/timeline.test.js` (só teste; o código já se comporta assim)

- [ ] **Step 1: Escrever os testes**

Dentro de `describe('buildStageTransitions — origem e tempo na etapa anterior', ...)`, adicione:

```js
  it('evento do funil Upgrade (sem colchetes) não vira origem nem quebra a cadeia', () => {
    const upgrade = { id: 'u', createdAt: new Date(2026, 6, 10, 10, 0), text: 'Upgrade: entrou na etapa Aguardando contato.' };
    const out = buildStageTransitions([t('a', 1, 'Contato feito'), upgrade, t('c', 20, 'Negociação')], CADASTRO);
    expect(out.c.from).toBe('Contato feito');
    expect(out.c.days).toBe(19);
  });
```

E, no `describe` de `classifyInteraction` (procure `describe('classifyInteraction`), adicione:

```js
  it('eventos do funil Upgrade são marcos (status), não contrato', () => {
    expect(classifyInteraction({ type: 'status_change', text: 'Upgrade: entrou na etapa Aguardando contato.' })).toBe('status');
    expect(classifyInteraction({ type: 'status_change', text: 'Upgrade: não quis. Motivo: Preço.' })).toBe('status');
  });
```

Se `classifyInteraction` ainda não estiver no import do teste, acrescente.

- [ ] **Step 2: Rodar e ver passar (é caracterização)**

Run: `npx vitest run src/lib/__tests__/timeline.test.js`
Expected: todos verdes. Se o segundo teste falhar com `'contract'`, é porque o texto casou com `CONTRACT_RE` (`/matrícula|matricula|renova(ç|c)ão|contrato cancelado|plano /i`); os textos acima não casam. Um motivo de recusa que contenha "plano " cai em contrato: limitação conhecida, aceita no spec.

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/timeline.test.js
git commit -m "test(upgrade): evento do funil Upgrade fica fora da cadeia de fases

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Provisionamento no `App.jsx`

**Files:**
- Modify: `src/App.jsx` (import na linha 57; estados nas linhas 343-344; leitura da config na linha 787; efeito novo depois do efeito de Renovações, que termina na linha 1211)

- [ ] **Step 1: Import**

Depois de `import { planRenewalSetupOps } from './lib/renewalFunnel.js';` adicione:

```js
import { planUpgradeSetupOps } from './lib/upgradeFunnel.js';
```

- [ ] **Step 2: Estados**

Depois de `const [renewalFunnelStatus, setRenewalFunnelStatus] = useState('idle');` adicione:

```js
  const [upgradeSetupDone, setUpgradeSetupDone] = useState(null);
  const [upgradeFunnelStatus, setUpgradeFunnelStatus] = useState('idle');
```

- [ ] **Step 3: Leitura do carimbo**

Depois de `setRenewalSetupDone(!!data?.renewalFunnelSetupDoneAt);` adicione:

```js
      setUpgradeSetupDone(!!data?.upgradeFunnelSetupDoneAt);
```

- [ ] **Step 4: O efeito**

Logo depois do `useEffect` do funil Renovações (o que termina com `}, [appUser, loadingData, expiredFunnelStatus, renewalFunnelStatus, renewalSetupDone]);`), adicione:

```js
  // Funil UPGRADE do board. Mesmo desenho dos três provisionamentos acima, e
  // guardado pelo Renovações estar 'done' para as escritas não correrem juntas
  // no primeiro login de admin de uma academia nova. Só a etapa de entrada
  // nasce; as demais a academia cria em Configurações.
  useEffect(() => {
    if (!appUser || !isAdminUser(appUser)) return;
    if (loadingData) return;
    if (renewalFunnelStatus !== 'done') return;
    if (upgradeFunnelStatus !== 'idle') return;
    if (upgradeSetupDone === null) return;
    if (upgradeSetupDone) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- encerra a máquina de estados; guardado por status !== 'idle'.
      setUpgradeFunnelStatus('done');
      return;
    }

    setUpgradeFunnelStatus('running');

    (async () => {
      try {
        // Snapshots frescos por getDocs (não os props): elimina a corrida com
        // as assinaturas ao vivo ainda vazias no boot.
        const [funnelsSnap, statusesSnap] = await Promise.all([
          getDocs(collection(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH)),
          getDocs(collection(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH))
        ]);
        const plan = planUpgradeSetupOps({
          funnels: funnelsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          statuses: statusesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        });

        let newFunnelId = null;
        if (plan.createFunnel) {
          const ref = await addDoc(
            collection(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH),
            { ...plan.createFunnel, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
          );
          newFunnelId = ref.id;
        }
        for (const stage of plan.createStages) {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH), {
            ...stage,
            // Etapa planejada junto com o funil novo vem sem funnelId — o id só
            // existe depois do addDoc acima.
            funnelId: stage.funnelId || newFunnelId
          });
        }

        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CONFIG_GENERAL_ID),
          { upgradeFunnelSetupDoneAt: serverTimestamp() },
          { merge: true }
        );

        setUpgradeFunnelStatus('done');
      } catch (err) {
        console.error('Erro no provisionamento do funil de upgrade', err);
        setUpgradeFunnelStatus('error');
      }
    })();
  }, [appUser, loadingData, renewalFunnelStatus, upgradeFunnelStatus, upgradeSetupDone]);
```

- [ ] **Step 5: Lint**

Run: `npx eslint src/App.jsx`
Expected: sem erros novos (erro zero; avisos antigos podem aparecer).

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat(upgrade): provisiona o funil Upgrade no primeiro login de gestor

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Kanban, parte 1: carregar, projetar e contar

**Files:**
- Modify: `src/views/KanbanView.jsx`

Âncoras atuais (HEAD `8217034`): imports nas linhas 1-29; `useGeneralConfig()` na 482; bloco do Vencidos 445-475; `kanbanLeads` 512-517; `draggableById` 579-607; contagens 636-680; `pipelineColumns` 1067; `filterSummary` 1082-1100; coluna Perda no render por volta de 1315. Se as linhas mudaram, procure pelo texto citado em cada passo.

- [ ] **Step 1: Imports**

Substitua a linha `import { getExpiredFunnel, splitExpiredForBoard } from '../lib/expiredFunnel.js';` por:

```js
import { getExpiredFunnel, splitExpiredForBoard } from '../lib/expiredFunnel.js';
import { getUpgradeFunnel, projectUpgradeLeads } from '../lib/upgradeFunnel.js';
```

Na linha do import de `leadQueries.js`, acrescente `upgradeClientsQuerySpec`:

```js
import { bucketByFunnelQuerySpec, wonInMonthQuerySpec, LIFECYCLE_BUCKETS, expiredClientsQuerySpec, upgradeClientsQuerySpec } from '../lib/leadQueries.js';
```

Substitua o import de `stageMove.js` por:

```js
import { planStageMove, planLoss, planUpgradeMove, planUpgradeDecline, stageMoveBlockMessage } from '../lib/stageMove.js';
```

Acrescente, junto aos imports de lib:

```js
import { hasLiveContract } from '../lib/contracts.js';
```

- [ ] **Step 2: Carga e projeção**

Logo depois de `const expiredLeads = expiredSplit.cards;` (fim do bloco do Vencidos), adicione:

```js
  // FUNIL UPGRADE (funil de sistema): cliente que o consultor colocou à mão
  // para vender um plano melhor. Mesmo molde do Vencidos — query própria só
  // com a aba aberta, projeção em memória, o status real continua 'Venda' —
  // com uma diferença: ninguém cai aqui sozinho, a entrada é pela ficha e
  // grava upgradeStageId. Regras em lib/upgradeFunnel.js.
  const upgradeFunnel = useMemo(() => getUpgradeFunnel(funnels), [funnels]);
  const isUpgradeView = Boolean(upgradeFunnel && selectedFunnelId === upgradeFunnel.id);
  const upgradeSpec = useMemo(() => (isUpgradeView ? upgradeClientsQuerySpec() : null), [isUpgradeView]);
  const {
    items: upgradeDocs, reload: upgradeReload, patchItem: upgradePatchLead,
  } = usePagedLeads({
    db, path: LEADS_PATH, spec: upgradeSpec, specKey: `upgrade:${isUpgradeView ? '1' : '0'}`,
    enabled: !!db && isUpgradeView,
  });
  // Mesmo recorte do Vencidos: respFilter vale, onlyOverdue é ignorado (cliente
  // não tem follow-up de prospecção). A coluna Perda deste funil fica vazia:
  // quem recusou sai do funil, não muda de coluna.
  const upgradeLeads = useMemo(() => {
    if (!isUpgradeView) return EMPTY_LEADS;
    const cards = projectUpgradeLeads(upgradeDocs || [], statuses, upgradeFunnel?.id);
    return respFilter.length === 0 ? cards : cards.filter((l) => respFilter.includes(l.consultantId));
  }, [isUpgradeView, upgradeDocs, statuses, upgradeFunnel, respFilter]);
```

- [ ] **Step 3: `kanbanLeads`**

Substitua o `useMemo` de `kanbanLeads` por:

```js
  const kanbanLeads = useMemo(
    // Nos funis Vencidos e Upgrade os cards vêm da query própria já projetada,
    // não da assinatura de leads ativos — cliente não está no board de prospecção.
    () => (isExpiredView ? expiredLeads : isUpgradeView ? upgradeLeads : filterKanbanLeads(funnelLeads, { respFilter, onlyOverdue })),
    [isExpiredView, expiredLeads, isUpgradeView, upgradeLeads, funnelLeads, respFilter, onlyOverdue]
  );
```

- [ ] **Step 4: `draggableById`**

Dentro do `useMemo` de `draggableById`, depois do bloco `if (isExpiredView) { ... }`, adicione:

```js
    // Mesma coisa para o funil UPGRADE: o cliente que fechou contrato ESTE mês
    // está em wonDocs como doc cru, sem a flag _upgradeCard.
    if (isUpgradeView) {
      upgradeLeads.forEach((l) => m.set(l.id, l));
    }
```

e acrescente `isUpgradeView, upgradeLeads` ao array de dependências desse `useMemo`.

- [ ] **Step 5: Contagem na barra**

Depois do bloco de `expiredCount` (o `useLeadCount` dos vencidos), adicione:

```js
  // Total do funil UPGRADE para o badge da aba: agregação no servidor, 1
  // leitura. O board não exclui ninguém no cliente, então o número bate.
  const upgradeCountSpec = useMemo(() => (upgradeFunnel ? upgradeClientsQuerySpec() : null), [upgradeFunnel]);
  const upgradeCount = useLeadCount({
    db, path: LEADS_PATH, spec: upgradeCountSpec,
    specKey: 'upgrade', enabled: !!db && !!upgradeFunnel,
  });
```

No `useMemo` de `funnelCounts`, depois de `if (renewalFunnel) map.set(renewalFunnel.id, renewalTotal);`, adicione:

```js
    if (upgradeFunnel) map.set(upgradeFunnel.id, upgradeCount);
```

e acrescente `upgradeFunnel, upgradeCount` ao array de dependências.

- [ ] **Step 6: Resumo do filtro e coluna Perda**

Em `filterSummary`, troque `if (isRenewalView && !hasActiveFilters) return '';` por:

```js
    if ((isRenewalView || isUpgradeView) && !hasActiveFilters) return '';
```

e acrescente `isUpgradeView` ao array de dependências desse `useMemo`.

No render da coluna Perda (`key="__perda"`), troque o `columnLeads` por:

```js
              columnLeads={
                isRenewalView ? renewalSplit.declined
                  : isExpiredView ? expiredSplit.declined
                    : isUpgradeView ? EMPTY_LEADS
                      : lostLeads
              }
```

- [ ] **Step 7: Lint**

Run: `npx eslint src/views/KanbanView.jsx`
Expected: pode acusar `planUpgradeMove`, `planUpgradeDecline`, `hasLiveContract`, `upgradeReload` e `upgradePatchLead` como não usados; eles entram na Task 8. Nenhum outro erro.

- [ ] **Step 8: Commit parcial**

```bash
git add src/views/KanbanView.jsx
git commit -m "feat(upgrade): aba Upgrade no board carrega, projeta e conta

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Kanban, parte 2: mover, Venda e Perda

**Files:**
- Modify: `src/views/KanbanView.jsx` (handlers entre `declineExpired` e `declineRenewal`; `moveLeadToStatus`; `handleDrop`; `confirmKanbanLoss`; `ContractModal` no fim)

- [ ] **Step 1: `contractThresholdDays`**

Troque `const { renewalCheckpoints } = useGeneralConfig();` por:

```js
  const { renewalCheckpoints, contractThresholdDays } = useGeneralConfig();
```

- [ ] **Step 2: Handlers do Upgrade**

Logo depois de `declineExpired` (antes do comentário `// "Não vai renovar": a MESMA flag...`), adicione:

```js
  // ── Desfechos do card projetado do funil UPGRADE ────────────────────────
  // Arrasto e menu "Mover" passam por aqui. A etapa mora em upgradeStageId; o
  // status real continua 'Venda' (regra em lib/stageMove.js). Cada movimento
  // deixa evento na linha do tempo, por isso logInteraction e não updateDoc.
  const moveUpgradeToStage = useCallback((lead, statusName) => {
    if (!canEditLead(appUser)) {
      toast.warning('Você não tem permissão para mover este lead.');
      return;
    }
    const etapa = (statuses || []).find(
      (st) => st.funnelId === upgradeFunnel?.id && st.name === statusName
    );
    const plan = planUpgradeMove(lead, etapa);
    if (!plan.ok) { toast.warning(stageMoveBlockMessage(lead, plan.reason)); return; }
    const patch = plan.entering ? { ...plan.patch, upgradeEnteredAt: serverTimestamp() } : plan.patch;
    logInteraction(db, lead, appUser, { text: plan.interactionText, type: 'status_change' }, patch)
      .then(() => upgradePatchLead(lead.id, plan.patch))
      .catch((err) => {
        console.error('Erro ao mover card do funil Upgrade', err);
        toast.error('Não foi possível mover o card.');
      });
  }, [appUser, db, toast, statuses, upgradeFunnel, upgradePatchLead]);

  // "Não quis o upgrade": sai do funil e mais nada — a pessoa segue cliente.
  // Recarrega o board porque o card precisa sumir de verdade.
  const declineUpgrade = useCallback(async (lead, reason) => {
    if (!canEditLead(appUser)) {
      toast.warning('Você não tem permissão para alterar este lead.');
      return;
    }
    const plan = planUpgradeDecline(lead, reason);
    try {
      await logInteraction(
        db, lead, appUser,
        { text: plan.interactionText, type: 'status_change' },
        { ...plan.patch, upgradeDeclinedAt: serverTimestamp() }
      );
      upgradeReload();
    } catch (err) {
      console.error('Erro ao registrar recusa de upgrade', err);
      toast.error('Não foi possível registrar a recusa.');
    }
  }, [appUser, db, toast, upgradeReload]);
```

- [ ] **Step 3: Menu "Mover"**

Em `moveLeadToStatus`, logo depois do bloco `if (lead._expiredCard) { ... }` e antes de `if (statusName === 'Venda') return openMatricula(lead);`, adicione:

```js
    // Funil UPGRADE: Venda abre o contrato, Perda pede o motivo e tira do
    // funil, etapa grava upgradeStageId.
    if (lead._upgradeCard) {
      if (statusName === 'Venda') return openMatricula(lead);
      if (statusName === 'Perda') { setLossModalLeadId(lead.id); return; }
      return moveUpgradeToStage(lead, statusName);
    }
```

- [ ] **Step 4: Arrasto**

Em `handleDrop`, logo depois de `if (lead._expiredCard) return moveExpiredToStage(lead, newStatus);`, adicione:

```js
    if (lead._upgradeCard) return moveUpgradeToStage(lead, newStatus);
```

e acrescente `moveUpgradeToStage` ao array de dependências de `handleDrop`.

Em `handleLossDrop` nada muda: o caminho genérico já chama `planLoss(alvo)`, que devolve `kind: 'upgrade'` para o card do Upgrade, e o modal de motivo abre.

- [ ] **Step 5: Confirmar a Perda**

Substitua o início de `confirmKanbanLoss` (da assinatura até `if (!lead) return;`) por:

```js
  const confirmKanbanLoss = async (reason) => {
    if (!lossModalLeadId) return;
    // draggableById e não `leads`: o card projetado do Upgrade e o doc cru da
    // coluna Venda do mês não estão no prop de leads ativos.
    const lead = draggableById.get(lossModalLeadId);
    if (!lead) return;
    const loss = planLoss(lead);
    if (!loss.ok) { setLossModalLeadId(null); toast.warning(stageMoveBlockMessage(lead, loss.reason)); return; }
    // Cliente no funil Upgrade: a Perda é "não quis o upgrade". Sai do funil
    // com o motivo e segue cliente — nada de status Perda.
    if (loss.kind === 'upgrade') {
      setLossModalLeadId(null);
      await declineUpgrade(lead, reason);
      return;
    }
```

O `try { ... }` que grava a Perda de lead continua igual logo abaixo.

- [ ] **Step 6: Modal de contrato**

No `<ContractModal ...>` do fim do arquivo, troque a prop `mode` (e o comentário acima dela) por:

```js
          // Card do funil Renovações é renovação. Card do funil Upgrade é
          // renovação quando há contrato vivo (liga ao atual e emenda a
          // vigência) e nova matrícula quando o contrato venceu ou foi
          // cancelado. O modal em modo renovação NÃO carimba convertedAt.
          mode={
            matriculaLead._renewalCard || (matriculaLead._upgradeCard && hasLiveContract(matriculaLead, new Date(), contractThresholdDays))
              ? 'renovacao'
              : 'matricula'
          }
```

Dentro de `onDone`, depois de `const wasRenewal = Boolean(matriculaLead?._renewalCard);`, adicione:

```js
            // Fechou pelo Upgrade: o contrato novo tirou o cliente do funil
            // (buildMatriculaWrites), então o board precisa recarregar.
            const wasUpgrade = Boolean(matriculaLead?._upgradeCard);
```

e depois de `if (wasRenewal) renewalReload();` adicione:

```js
            if (wasUpgrade) upgradeReload();
```

- [ ] **Step 7: Lint e testes**

Run: `npx eslint src/views/KanbanView.jsx && npx vitest run`
Expected: lint sem erros; testes todos verdes.

- [ ] **Step 8: Commit**

```bash
git add src/views/KanbanView.jsx
git commit -m "feat(upgrade): arrastar, mover, fechar e recusar no funil Upgrade

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Ficha: entrar, mover e sair pelo "Mudar fase"

**Files:**
- Modify: `src/views/LeadProfileView.jsx` (imports 1-56; `confirmLoss` ~271; `handlePhaseConfirm` ~308; derivados ~626-660; composer, aba `status` ~826-848; cabeçalho ~1133-1141)

- [ ] **Step 1: Imports**

Substitua o import de `stageMove.js` por:

```js
import { planStageMove, planLoss, planUpgradeMove, planUpgradeDecline, stageMoveBlockMessage } from '../lib/stageMove.js';
```

Na linha do import de `'../lib/contracts.js'`, acrescente `hasLiveContract`:

```js
import { deriveContractStatus, deriveLeadContractStatus, hasLiveContract, CONTRACT_STATUS, CONTRACT_STATUS_LABEL } from '../lib/contracts.js';
```

Depois do import de `referrals.js`, adicione:

```js
import { getUpgradeFunnel } from '../lib/upgradeFunnel.js';
```

- [ ] **Step 2: Derivados**

Logo depois de `const isClient = lead.lifecycleStage === 'cliente' || isLeadConverted(lead);`, adicione:

```js
  // Funil UPGRADE (lib/upgradeFunnel.js): é o único funil que um cliente pode
  // ocupar, e a etapa dele mora em upgradeStageId, não em status.
  const upgradeFunnel = getUpgradeFunnel(safeFunnels);
  const upgradeStage = lead.upgradeStageId
    ? (statuses || []).find((s) => s.id === lead.upgradeStageId) || null
    : null;
  // O PhaseChanger destaca a etapa atual pelo `status`. Para o cliente, passa
  // uma cópia com o status igual ao nome da etapa de Upgrade, só para o
  // destaque — a escrita continua em upgradeStageId (handlePhaseConfirm).
  const phaseChangerLead = isClient
    ? { ...lead, funnelId: upgradeFunnel?.id || '', status: upgradeStage?.name || '' }
    : lead;
  const phaseChangerFunnels = isClient ? (upgradeFunnel ? [upgradeFunnel] : []) : safeFunnels;
```

- [ ] **Step 3: `handlePhaseConfirm`**

Substitua as duas primeiras linhas da função (os `if` de Venda e Perda) por:

```js
    if (targetStatus === 'Venda') {
      // Cliente com contrato vivo renova (o contrato novo se liga ao atual);
      // lead, ou cliente vencido/cancelado, faz matrícula.
      setMatriculaMode(isClient && hasLiveContract(lead, new Date(), contractThresholdDays) ? 'renovacao' : 'matricula');
      setMatriculaOpen(true);
      return;
    }
    if (targetStatus === 'Perda') {
      const loss = planLoss(lead);
      if (!loss.ok) { toast.warning(stageMoveBlockMessage(lead, loss.reason)); return; }
      setLossModalOpen(true);
      return;
    }
    // Cliente só anda no funil UPGRADE, e a etapa mora em upgradeStageId.
    if (isClient) {
      if (!canTimeline) { toast.warning('Você não tem permissão para registrar interações neste lead.'); return; }
      const etapa = (statuses || []).find((s) => s.funnelId === upgradeFunnel?.id && s.name === targetStatus);
      const plan = planUpgradeMove(lead, etapa);
      if (!plan.ok) { toast.warning(stageMoveBlockMessage(lead, plan.reason)); return; }
      setLoading(true);
      try {
        const patch = plan.entering ? { ...plan.patch, upgradeEnteredAt: serverTimestamp() } : plan.patch;
        await logInteraction(db, lead, appUser,
          { text: `${plan.interactionText}${phaseNote ? ` Obs: ${phaseNote}` : ''}`, type: 'status_change' },
          patch
        );
        setComposerTab('note');
      } catch (e) {
        console.error(e);
        toast.error('Não foi possível mudar a etapa. Tente novamente.');
      } finally {
        setLoading(false);
      }
      return;
    }
```

O resto da função (o caminho de lead, com `planStageMove`) fica como está.

- [ ] **Step 4: `confirmLoss`**

Substitua as linhas de guarda no início de `confirmLoss` (de `const loss = planLoss(lead);` até o `return; }` seguinte) por:

```js
    const loss = planLoss(lead);
    if (!loss.ok) { toast.warning(stageMoveBlockMessage(lead, loss.reason)); setLossModalOpen(false); return; }
    // Cliente no funil Upgrade: a Perda é "não quis o upgrade". Sai do funil
    // com o motivo e segue cliente — nada de status Perda.
    if (loss.kind === 'upgrade') {
      setLoading(true);
      try {
        const plan = planUpgradeDecline(lead, reason);
        await logInteraction(db, lead, appUser,
          { text: plan.interactionText, type: 'status_change' },
          { ...plan.patch, upgradeDeclinedAt: serverTimestamp() }
        );
        setLossModalOpen(false);
      } catch (e) {
        console.error(e);
        toast.error('Não foi possível registrar a recusa.');
      } finally {
        setLoading(false);
      }
      return;
    }
```

- [ ] **Step 5: Composer, aba "Mudar fase"**

Substitua o bloco `{composerTab === 'status' && ( <> ... </> )}` inteiro por:

```jsx
            {composerTab === 'status' && (
              <>
                {/* Cliente: só o funil Upgrade. O aviso vem ANTES para a pessoa
                    não montar a mudança inteira e descobrir no confirmar. */}
                {isClient && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12.5px] leading-[1.45] text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                    <FileText size={14} className="mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold">{firstName} é cliente e não volta a ser lead.</span>{' '}
                      {upgradeFunnel
                        ? 'Aqui você coloca o cliente no funil Upgrade ou muda a etapa dele lá. A matrícula e o contrato ficam na '
                        : 'O funil Upgrade ainda não foi criado nesta academia: ele nasce quando um gestor abre o app. A matrícula e o contrato ficam na '}
                      <button type="button" onClick={() => setActiveProfileTab('contratos')} className="font-semibold underline underline-offset-2">aba Contratos</button>.
                    </div>
                  </div>
                )}
                <PhaseChanger
                  lead={phaseChangerLead}
                  db={db}
                  funnels={phaseChangerFunnels}
                  statuses={statuses}
                  onConfirm={handlePhaseConfirm}
                  onCancel={() => setComposerTab('note')}
                />
              </>
            )}
```

- [ ] **Step 6: Chip no cabeçalho**

No cabeçalho, logo depois do `<span ...>{profileState.label}</span>` (o selo com `profileTone`), e antes do `<span className="text-[11.5px] text-slate-400 ...">· {profileState.hint}</span>`, adicione:

```jsx
                {upgradeStage && (
                  <span className="inline-flex items-center gap-1 h-[18px] px-1.5 rounded-md text-[10px] font-bold uppercase tracking-[.05em] shrink-0 bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                    <TrendingUp size={10} /> Upgrade · {upgradeStage.name}
                  </span>
                )}
```

- [ ] **Step 7: Lint e testes**

Run: `npx eslint src/views/LeadProfileView.jsx && npx vitest run`
Expected: lint sem erros; testes todos verdes.

- [ ] **Step 8: Commit**

```bash
git add src/views/LeadProfileView.jsx
git commit -m "feat(upgrade): ficha coloca o cliente no funil Upgrade, move e recusa

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Central de ajuda

**Files:**
- Modify: `src/lib/wiki.js` (novo artigo depois do artigo `id: 'renovacao'`, antes de `id: 'vencidos'`)
- Test: `src/lib/__tests__/wiki.test.js` (já valida ids, categorias e blocos; só rodar)

- [ ] **Step 1: Artigo**

Em `src/lib/wiki.js`, logo antes do objeto `{ id: 'vencidos', ...`, adicione:

```js
  {
    id: 'upgrade',
    category: 'fechamento',
    title: 'Funil Upgrade: um plano melhor para quem já é cliente',
    summary: 'Onde colocar o cliente que você quer levar a um plano maior, como trabalhar a esteira e o que Venda e Perda fazem ali.',
    blocks: [
      { t: 'p', text: 'Quem virou cliente não volta para as fases de lead. Quando o consultor quer vender um plano maior ou mais longo para alguém que já treina, o lugar é o funil Upgrade, no Pipeline. A pessoa continua cliente o tempo todo: com ficha, contrato e histórico, e seguindo na aba Clientes.' },

      { t: 'h', text: 'Como colocar um cliente' },
      { t: 'steps', items: [
        'Abra a ficha do cliente e vá em Mudar fase. Para cliente, o único funil que aparece é o Upgrade.',
        'Escolha a etapa e confirme. O card aparece na aba Upgrade do Pipeline e a ficha ganha o chip "Upgrade" no cabeçalho.',
        'Qualquer cliente entra, inclusive quem já está em Renovações ou em Vencidos. Ele aparece nos dois lugares; o time combina quem conversa.',
      ] },

      { t: 'h', text: 'Trabalhando a esteira' },
      { t: 'p', text: 'A primeira etapa, "Aguardando contato", é fixa. As demais a academia cria em Configurações, Funis, como em qualquer funil. Arraste o card entre as etapas ou use Mover no celular. Cada movimento fica na linha do tempo.' },

      { t: 'h', text: 'Os dois desfechos' },
      { t: 'steps', items: [
        'Venda: abre o contrato. Com contrato vigente é uma renovação, ligada ao contrato atual; com contrato vencido ou cancelado é uma nova matrícula. O cliente sai do funil sozinho.',
        'Perda: quer dizer "não quis o upgrade". Peça o motivo e registre. O cliente sai do funil e segue cliente, com o contrato que já tinha.',
      ] },
      { t: 'tip', text: 'Um contrato fechado por quem estava no Upgrade conta como upgrade. Se a pessoa também estava na janela de renovação, conta como renovação. É uma venda só.' },
      { t: 'warn', text: 'Contrato fechado fora do funil não conta como upgrade, mesmo que o plano seja maior. O que marca o upgrade é ter passado pelo funil.' },
    ],
  },
```

- [ ] **Step 2: Rodar o teste da Central**

Run: `npx vitest run src/lib/__tests__/wiki.test.js`
Expected: verde. Ele confere id único, título, resumo, blocos e categoria válida.

- [ ] **Step 3: Commit**

```bash
git add src/lib/wiki.js
git commit -m "docs(ajuda): artigo do funil Upgrade na Central de ajuda

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Verificação final, smoke logado e PR

**Files:**
- Nenhum arquivo novo.

- [ ] **Step 1: Suíte e lint completos**

Run: `npm run lint && npx vitest run`
Expected: lint com `0 errors` (o aviso antigo em `SuperAdminView` é conhecido); testes todos verdes, com pelo menos 30 a mais que os 993 do início.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: termina sem erro. Se faltar dependência no worktree (`tw-animate-css`, `eslint-plugin-react`), rode `npm install` e repita.

- [ ] **Step 3: Smoke logado (Johnny, no preview da Vercel ou em `npm run dev` apontado para a academia de teste)**

Roteiro, na ordem:

1. Logar como gestor. Conferir em Configurações, Funis, que "Upgrade" apareceu com o cadeado e a etapa "Aguardando contato" protegida. Criar uma etapa "Em contato".
2. Abrir a ficha de um cliente ativo. "Mudar fase" mostra o aviso âmbar e só o funil Upgrade. Escolher "Aguardando contato" e confirmar. Conferir: chip "Upgrade · Aguardando contato" no cabeçalho; evento "Upgrade: entrou na etapa Aguardando contato." na linha do tempo, sem colchetes; cliente continua na aba Clientes.
3. Pipeline, aba Upgrade: o card está lá e a barra mostra 1. Arrastar para "Em contato". Recarregar: continua em "Em contato". Filtro de responsável funciona.
4. Menu Mover (celular ou clique no botão do card): mover de volta. Mover para Perda: o modal de motivo abre; confirmar. O card some; a ficha mostra "Upgrade: não quis. Motivo: X." e o chip sumiu; a pessoa segue cliente ativo.
5. Colocar de novo pela ficha. No board, soltar em Venda: o modal abre em modo "Renovar contrato". Fechar com um plano maior. Conferir: card sumiu do Upgrade; apareceu na coluna Venda do mês; na aba Contratos o contrato novo está ligado ao anterior; no Firestore o contrato tem `closedFromUpgrade: true`.
6. Cliente com contrato vencido: colocar no Upgrade e soltar em Venda. O modal abre em "Matricular cliente".
7. Lead comum: mover entre etapas, marcar Perda e desfazer seguem como antes. Para lead, o funil Upgrade não aparece no "Mudar fase".

- [ ] **Step 4: Abrir a PR**

```bash
git push -u origin claude/funil-upgrade
gh pr create --base main --title "feat: funil Upgrade no board para venda adicional a clientes" --body-file - <<'EOF'
## O que é

Funil de sistema "Upgrade" no Pipeline, onde o consultor coloca clientes à mão para vender um plano melhor. A pessoa continua cliente o tempo todo. Spec: `docs/superpowers/specs/2026-09-08-funil-upgrade-design.md`.

## Como funciona

- A etapa do cliente mora em `upgradeStageId`; `status`, `funnelId` e as marcas de cliente não são tocados. Molde do funil Vencidos.
- Entrada pela ficha ("Mudar fase" mostra só o Upgrade para cliente). Board carrega quem tem o campo, projeta a etapa no card, arrasta e move gravando só o campo.
- Venda abre o modal de contrato: renovação com contrato vivo, nova matrícula sem. Perda pede o motivo e tira do funil.
- Todo contrato novo limpa o funil e grava `closedFromUpgrade`. Renovação segue sendo `renewedFromId`. Uma venda só.
- Provisionamento no primeiro login de gestor, só a etapa "Aguardando contato". Sem regra nem índice novo.

## Testes

Puros: upgradeFunnel, leadQueries, stageMove, contracts, timeline, wiki. Smoke logado no roteiro da Task 11 do plano.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

- [ ] **Step 5: Memória**

Atualizar a memória do projeto (um arquivo novo `funil-upgrade.md` e a linha no índice) com: PR aberta, branch, o que ficou para a segunda entrega (relatório de upgrades, chips cruzados, ação em massa na aba Clientes).

---

## Autorrevisão do plano

**Cobertura do spec.** Decisões 1 a 9: funil de sistema e etapa fixa (Tasks 1 e 6); qualquer cliente entra pela ficha (Task 9); coexistência com Renovações sem remoção automática (nada remove; Task 8 só recarrega o próprio board); contagem por processo com `closedFromUpgrade` (Task 4); mecânica por campo próprio (Tasks 1, 3, 7, 8, 9); consulta sem índice (Task 2); Venda em modo renovação ou matrícula (Tasks 8 e 9 via `hasLiveContract`); Perda com motivo e saída (Tasks 3, 8, 9); chip no cabeçalho e aviso (Task 9); Central de ajuda (Task 10); texto sem colchetes (Tasks 3 e 5); contagem na barra (Task 7).

**Placeholders.** Nenhum "TBD", "TODO" ou "similar à Task N". Todo passo de código traz o código.

**Consistência de nomes.** `planUpgradeMove(lead, stage)` devolve `{ ok, entering, patch, interactionText }` nas Tasks 3, 8 e 9. `planUpgradeDecline(lead, reason)` devolve `{ patch, interactionText }` nas Tasks 3, 8 e 9. `planLoss` devolve `kind` em 3, 8 e 9. `hasLiveContract(lead, refDate, thresholdDays)` em 4, 8 e 9. `projectUpgradeLeads(leads, statuses, funnelId)` e `getUpgradeFunnel(funnels)` em 1, 7 e 9. `upgradeClientsQuerySpec()` em 2 e 7. Campos: `upgradeStageId`, `upgradeEnteredAt`, `upgradeDeclinedAt`, `closedFromUpgrade`, `upgradeFunnelSetupDoneAt`.
