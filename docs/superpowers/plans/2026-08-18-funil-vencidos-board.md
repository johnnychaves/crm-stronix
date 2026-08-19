# Funil Vencidos no board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um funil de sistema "Vencidos" no pipeline, onde o cliente com contrato vencido cai sozinho e pode ser trabalhado para reconquista.

**Architecture:** Funil de sistema no molde do de Indicações (`src/lib/referrals.js`): discriminador por flag `systemKind`, etapas com `isSystem`/`isEntry`, provisionamento one-shot idempotente. O card é DERIVADO do vencimento (sem escrita) até alguém arrastar; a partir daí a etapa mora em `reactivationStageId`.

**Tech Stack:** React 19 + Vite, Firestore, Vitest. Sem TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-17-funil-vencidos-board-design.md`

Sem índice novo (o #4 já cobre), sem regra do Firestore, sem backfill.

---

## Duas armadilhas que valem para o plano inteiro

**1. Nunca casar funil por NOME.** A academia pode ter um funil "Vencidos" próprio.
O discriminador é `systemKind === 'expired'`, igual ao `REFERRAL_FUNNEL_KIND`.

**2. Cliente é `status: 'Venda'`.** Gravar a etapa do board em `lead.status`
corromperia o estado de cliente e a aba Clientes. Por isso existe
`reactivationStageId`, campo separado — e por isso o arrastar precisa de uma
bifurcação.

---

### Task 1: Regras puras do funil

**Files:** Create `src/lib/expiredFunnel.js` · Test `src/lib/__tests__/expiredFunnel.test.js`

Espelha `src/lib/referrals.js` linha a linha no que dá.

- [ ] **Step 1: Escrever os testes que falham**

```js
import { describe, it, expect } from 'vitest';
import {
  EXPIRED_FUNNEL_KIND, EXPIRED_FUNNEL_NAME, EXPIRED_ENTRY_NAME,
  isExpiredFunnel, getExpiredFunnel, getExpiredEntryStage, planExpiredSetupOps,
} from '../expiredFunnel.js';

describe('isExpiredFunnel', () => {
  it('casa pela flag, NUNCA pelo nome', () => {
    expect(isExpiredFunnel({ systemKind: 'expired' })).toBe(true);
    // funil que o usuário criou à mão com o mesmo nome não é o do sistema
    expect(isExpiredFunnel({ name: 'Vencidos' })).toBe(false);
    expect(isExpiredFunnel(null)).toBe(false);
  });
});

describe('getExpiredFunnel', () => {
  it('duplicata resolve pelo createdAt mais antigo', () => {
    const novo = { id: 'b', systemKind: 'expired', createdAt: 2000 };
    const velho = { id: 'a', systemKind: 'expired', createdAt: 1000 };
    expect(getExpiredFunnel([novo, velho]).id).toBe('a');
  });
  it('sem funil de sistema devolve null', () => {
    expect(getExpiredFunnel([{ id: 'x', name: 'Vencidos' }])).toBeNull();
    expect(getExpiredFunnel([])).toBeNull();
  });
});

describe('getExpiredEntryStage', () => {
  const f = 'f1';
  it('acha pela flag isEntry', () => {
    const st = [{ id: 's1', funnelId: f, isEntry: true }, { id: 's2', funnelId: f }];
    expect(getExpiredEntryStage(st, f).id).toBe('s1');
  });
  it('self-heal: sem isEntry, cai no isSystem com o nome padrão', () => {
    const st = [{ id: 's2', funnelId: f, order: 1 }, { id: 's1', funnelId: f, isSystem: true, name: 'Vencido' }];
    expect(getExpiredEntryStage(st, f).id).toBe('s1');
  });
  it('self-heal final: cai na de menor order', () => {
    const st = [{ id: 's2', funnelId: f, order: 3 }, { id: 's1', funnelId: f, order: 1 }];
    expect(getExpiredEntryStage(st, f).id).toBe('s1');
  });
  it('sem funil devolve null', () => {
    expect(getExpiredEntryStage([], null)).toBeNull();
  });
});

describe('planExpiredSetupOps', () => {
  it('base zerada: cria o funil e as QUATRO etapas', () => {
    const plan = planExpiredSetupOps({ funnels: [], statuses: [] });
    expect(plan.createFunnel).toMatchObject({ name: EXPIRED_FUNNEL_NAME, systemKind: EXPIRED_FUNNEL_KIND });
    expect(plan.createStages.map(s => s.name)).toEqual([EXPIRED_ENTRY_NAME, 'Em contato', 'Venda', 'Perda']);
  });

  it('entrada, Venda e Perda nascem protegidas; a do meio NÃO', () => {
    const plan = planExpiredSetupOps({ funnels: [], statuses: [] });
    const by = Object.fromEntries(plan.createStages.map(s => [s.name, s]));
    expect(by[EXPIRED_ENTRY_NAME]).toMatchObject({ isSystem: true, isEntry: true });
    expect(by['Venda'].isSystem).toBe(true);
    expect(by['Perda'].isSystem).toBe(true);
    expect(by['Em contato'].isSystem).toBeFalsy();
  });

  it('idempotente: com tudo pronto não cria nada', () => {
    const funnels = [{ id: 'f1', systemKind: EXPIRED_FUNNEL_KIND }];
    const statuses = [
      { id: 'a', funnelId: 'f1', name: EXPIRED_ENTRY_NAME, isSystem: true, isEntry: true },
      { id: 'b', funnelId: 'f1', name: 'Em contato' },
      { id: 'c', funnelId: 'f1', name: 'Venda', isSystem: true },
      { id: 'd', funnelId: 'f1', name: 'Perda', isSystem: true },
    ];
    const plan = planExpiredSetupOps({ funnels, statuses });
    expect(plan.createFunnel).toBeNull();
    expect(plan.createStages).toEqual([]);
  });

  it('self-heal: funil existe mas alguém apagou a Perda pelo console', () => {
    const funnels = [{ id: 'f1', systemKind: EXPIRED_FUNNEL_KIND }];
    const statuses = [
      { id: 'a', funnelId: 'f1', name: EXPIRED_ENTRY_NAME, isSystem: true, isEntry: true },
      { id: 'c', funnelId: 'f1', name: 'Venda', isSystem: true },
    ];
    const plan = planExpiredSetupOps({ funnels, statuses });
    expect(plan.createFunnel).toBeNull();
    expect(plan.createStages.map(s => s.name)).toEqual(['Perda']);
    expect(plan.createStages[0].funnelId).toBe('f1');
  });

  it('NÃO recria a etapa do meio se a academia apagou (ela é livre)', () => {
    const funnels = [{ id: 'f1', systemKind: EXPIRED_FUNNEL_KIND }];
    const statuses = [
      { id: 'a', funnelId: 'f1', name: EXPIRED_ENTRY_NAME, isSystem: true, isEntry: true },
      { id: 'c', funnelId: 'f1', name: 'Venda', isSystem: true },
      { id: 'd', funnelId: 'f1', name: 'Perda', isSystem: true },
    ];
    expect(planExpiredSetupOps({ funnels, statuses }).createStages).toEqual([]);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/__tests__/expiredFunnel.test.js` → FAIL, módulo não existe

- [ ] **Step 3: Implementar `src/lib/expiredFunnel.js`**

```js
// Regras puras do funil de sistema VENCIDOS no board (pipeline): discriminador,
// etapa de entrada, plano idempotente do provisionamento e a etapa derivada do
// card. Sem React e sem Firestore — o COMO gravar fica nos callers.
//
// Espelha src/lib/referrals.js, que é o molde de funil de sistema deste repo.
//
// NÃO confundir com src/lib/expiredGoal.js: lá é a TAREFA diária da Meta, que
// cobra por N dias e solta. Aqui é a COLUNA do board, permanente.

import { normalize } from './globalSearch.js';

// Discriminador. NUNCA casar por nome: a academia pode ter um funil "Vencidos"
// próprio — os dois convivem e só este flag diferencia.
export const EXPIRED_FUNNEL_KIND = 'expired';
export const EXPIRED_FUNNEL_NAME = 'Vencidos';
// Etapa 1 (fixa). Onde o cliente cai sozinho ao vencer.
export const EXPIRED_ENTRY_NAME = 'Vencido';
// Etapas terminais, protegidas como a entrada (decisão do Johnny em 18/08: o
// funil tem a forma padrão dos outros).
export const EXPIRED_WON_NAME = 'Venda';
export const EXPIRED_LOST_NAME = 'Perda';
// Semeada só para o funil não nascer com um vão. NÃO é protegida: a academia
// renomeia ou apaga à vontade, e o provisionamento não a recria.
export const EXPIRED_SEED_MIDDLE_NAME = 'Em contato';

export const isExpiredFunnel = (f) => f?.systemKind === EXPIRED_FUNNEL_KIND;

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
export const getExpiredFunnel = (funnels) => {
  const list = (funnels || []).filter(isExpiredFunnel);
  if (!list.length) return null;
  return list.reduce((best, f) => (createdAtMs(f) < createdAtMs(best) ? f : best));
};

const sameStageName = (name, target) => normalize(name).trim() === normalize(target).trim();

// Self-heal caso a flag/etapa se perca por fora (console):
// isEntry → isSystem com o nome padrão → menor order.
export const getExpiredEntryStage = (statuses, funnelId) => {
  if (!funnelId) return null;
  const inFunnel = (statuses || []).filter((s) => s?.funnelId === funnelId);
  if (!inFunnel.length) return null;
  return (
    inFunnel.find((s) => s.isEntry) ||
    inFunnel.find((s) => s.isSystem && sameStageName(s.name, EXPIRED_ENTRY_NAME)) ||
    inFunnel.reduce((best, s) => ((s.order ?? 99) < (best.order ?? 99) ? s : best))
  );
};

// Plano idempotente do provisionamento. Só as etapas PROTEGIDAS são garantidas:
// a do meio é semeada na criação e nunca recriada, senão o app ressuscitaria uma
// etapa que a academia apagou de propósito.
export const planExpiredSetupOps = ({ funnels, statuses } = {}) => {
  const existing = getExpiredFunnel(funnels);
  const createFunnel = existing
    ? null
    : { name: EXPIRED_FUNNEL_NAME, systemKind: EXPIRED_FUNNEL_KIND, order: 99 };

  if (!existing) {
    return {
      createFunnel,
      createStages: [
        { name: EXPIRED_ENTRY_NAME, color: 'slate', order: 0, isSystem: true, isEntry: true },
        { name: EXPIRED_SEED_MIDDLE_NAME, color: 'amber', order: 1 },
        { name: EXPIRED_WON_NAME, color: 'emerald', order: 98, isSystem: true },
        { name: EXPIRED_LOST_NAME, color: 'rose', order: 99, isSystem: true },
      ],
    };
  }

  const inFunnel = (statuses || []).filter((s) => s?.funnelId === existing.id);
  const has = (target, alsoFlag) =>
    inFunnel.some((s) => sameStageName(s.name, target) || (alsoFlag && s[alsoFlag]));

  const createStages = [];
  if (!has(EXPIRED_ENTRY_NAME, 'isEntry')) {
    createStages.push({ name: EXPIRED_ENTRY_NAME, color: 'slate', order: 0, funnelId: existing.id, isSystem: true, isEntry: true });
  }
  if (!has(EXPIRED_WON_NAME)) {
    createStages.push({ name: EXPIRED_WON_NAME, color: 'emerald', order: 98, funnelId: existing.id, isSystem: true });
  }
  if (!has(EXPIRED_LOST_NAME)) {
    createStages.push({ name: EXPIRED_LOST_NAME, color: 'rose', order: 99, funnelId: existing.id, isSystem: true });
  }
  return { createFunnel: null, createStages };
};
```

- [ ] **Step 4:** `npx vitest run src/lib/__tests__/expiredFunnel.test.js` → PASS
- [ ] **Step 5:** `git commit -m "feat(vencidos): regras puras do funil de sistema"`

---

### Task 2: `isExpiredClient` — a base compartilhada

O spec pede separar as duas perguntas que hoje moram dentro de
`shouldPromptExpired`: "é cliente vencido?" (o funil usa) e "cobra hoje?" (a Meta
usa). Comportamento da Meta **não pode mudar**.

**Files:** Modify `src/lib/expiredGoal.js` · Test `src/lib/__tests__/expiredGoal.test.js`

- [ ] **Step 1: Testes que falham**

```js
describe('isExpiredClient', () => {
  const venceuOntem = { lifecycleStage: 'cliente', currentContractEndsAt: new Date(2026, 7, 17) };
  const AGORA = new Date(2026, 7, 18, 10, 0);

  it('cliente com contrato vencido conta, SEM janela de tempo', () => {
    expect(isExpiredClient(venceuOntem, AGORA)).toBe(true);
    // um ano depois continua contando: o funil é permanente, a Meta que solta
    expect(isExpiredClient(venceuOntem, new Date(2027, 7, 18))).toBe(true);
  });
  it('quem não é cliente fica de fora', () => {
    expect(isExpiredClient({ ...venceuOntem, lifecycleStage: null }, AGORA)).toBe(false);
  });
  it('renewalDeclined NÃO exclui do funil (só da Meta)', () => {
    expect(isExpiredClient({ ...venceuOntem, renewalDeclined: true }, AGORA)).toBe(true);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/__tests__/expiredGoal.test.js` → FAIL

- [ ] **Step 3: Implementar** em `src/lib/expiredGoal.js`

```js
// Base compartilhada: é cliente e o contrato venceu. SEM janela de tempo e SEM
// olhar renewalDeclined ou contato marcado — essas são condições da COBRANÇA
// diária, não do fato. O funil do board consome esta; a Meta consome
// shouldPromptExpired, que é esta MAIS as condições da cobrança.
export function isExpiredClient(lead, now) {
  if (!lead) return false;
  if (lead.lifecycleStage !== 'cliente') return false;
  const ref = getSafeDateOrNull(now) || new Date();
  return deriveLeadContractStatus(lead, ref) === CONTRACT_STATUS.VENCIDO;
}
```

E `shouldPromptExpired` passa a se apoiar nela, substituindo as três primeiras
checagens:

```js
export function shouldPromptExpired(lead, now, windowDays = DEFAULT_EXPIRED_WINDOW_DAYS) {
  if (!isExpiredClient(lead, now)) return false;
  if (lead.renewalDeclined) return false;
  const ref = getSafeDateOrNull(now) || new Date();
  // ... resto IDÊNTICO ao de hoje (janela, contato marcado)
}
```

- [ ] **Step 4:** `npx vitest run` → PASS. **Nenhum teste da Meta pode quebrar** — se quebrar, a extração mudou comportamento e está errada.
- [ ] **Step 5:** `git commit -m "refactor(vencidos): extrai isExpiredClient da regra da Meta"`

---

### Task 3: Provisionamento one-shot

**Files:** Modify `src/App.jsx`

Espelha o bloco do funil de Indicações (`src/App.jsx:1002-1071`): roda só para
admin, depois da migração de funis, uma vez por tenant, com snapshots frescos por
`getDocs` para não correr com as assinaturas ainda vazias no boot.

- [ ] **Step 1: Estado e efeito**

Acrescentar `const [expiredFunnelStatus, setExpiredFunnelStatus] = useState('idle');`
junto dos outros status de migração.

Copiar o efeito do referral trocando: `planExpiredSetupOps` no lugar de
`planReferralSetupOps`, sem `sources` (o funil de vencidos não cria origem), e
guardado por `referralMigrationStatus === 'done'` para as duas migrações não
correrem juntas.

- [ ] **Step 2:** `npx vitest run && npx eslint src/App.jsx` → limpo
- [ ] **Step 3:** `git commit -m "feat(vencidos): provisiona o funil de sistema uma vez por academia"`

---

### Task 4: A etapa derivada do card

**Files:** Modify `src/lib/expiredFunnel.js` · Test `src/lib/__tests__/expiredFunnel.test.js`

- [ ] **Step 1: Testes que falham**

```js
describe('expiredStageIdOf', () => {
  const stages = [
    { id: 'entrada', funnelId: 'f1', isEntry: true, name: 'Vencido' },
    { id: 'perda', funnelId: 'f1', isSystem: true, name: 'Perda' },
  ];
  it('sem toque, nasce na entrada', () => {
    expect(expiredStageIdOf({}, stages, 'f1')).toBe('entrada');
  });
  it('quem recusou na Meta já nasce em Perda', () => {
    expect(expiredStageIdOf({ renewalDeclined: true }, stages, 'f1')).toBe('perda');
  });
  it('depois do primeiro arrasto, manda o campo gravado', () => {
    expect(expiredStageIdOf({ reactivationStageId: 'meio', renewalDeclined: true }, stages, 'f1')).toBe('meio');
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/__tests__/expiredFunnel.test.js` → FAIL

- [ ] **Step 3: Implementar**

```js
// Etapa do card. DERIVADA enquanto ninguém arrasta — é o que faz o funil
// funcionar retroativo, sem backfill e sem card órfão. O primeiro arrasto grava
// reactivationStageId e a partir daí ele manda.
export const expiredStageIdOf = (lead, statuses, funnelId) => {
  if (lead?.reactivationStageId) return lead.reactivationStageId;
  const inFunnel = (statuses || []).filter((s) => s?.funnelId === funnelId);
  if (lead?.renewalDeclined) {
    const perda = inFunnel.find((s) => s.isSystem && normalize(s.name).trim() === normalize(EXPIRED_LOST_NAME).trim());
    if (perda) return perda.id;
  }
  return getExpiredEntryStage(statuses, funnelId)?.id || null;
};
```

- [ ] **Step 4:** `npx vitest run` → PASS
- [ ] **Step 5:** `git commit -m "feat(vencidos): etapa derivada do card até o primeiro arrasto"`

---

### Task 5: O board carrega e desenha o funil

**Files:** Modify `src/lib/leadQueries.js`, `src/views/KanbanView.jsx` · Test `src/lib/__tests__/leadQueries.test.js`

- [ ] **Step 1: Query spec + teste**

```js
// leadQueries.js — clientes vencidos, do vencimento mais RECENTE para o mais
// antigo (a chance de reativação cai a cada dia fora). Coberta pelo índice #4
// (lifecycleBucket ASC, currentContractEndsAt ASC): igualdade no balde mais
// range e ordenação no mesmo campo. NENHUM índice novo.
export const expiredClientsQuerySpec = (beforeMs, pageSize = null) => ({
  wheres: [
    { field: 'lifecycleBucket', op: '==', value: LIFECYCLE_BUCKETS.CLIENTE },
    { field: 'currentContractEndsAt', op: '<', value: new Date(beforeMs) },
  ],
  orderBy: { field: 'currentContractEndsAt', dir: 'desc' },
  ...(pageSize ? { limit: pageSize } : {}),
});
```

Teste: confere os wheres, a ordenação `desc` e que o índice #4 cobre.

- [ ] **Step 2: Ligar no KanbanView**

Query disparada **só quando o funil Vencidos está selecionado** (`enabled`), via
`usePagedLeads`. Quem nunca abrir a aba não paga leitura.

As colunas do board vêm dos statuses do funil, como nos outros. O card vai para a
coluna dada por `expiredStageIdOf`.

**O funil NÃO entra em "Todos os funis"** — só aparece quando selecionado.
Misturar cliente inativo com prospecção desfaria a separação entre lead e cliente.

- [ ] **Step 3:** `npx vitest run && npx eslint .` → limpo
- [ ] **Step 4:** `git commit -m "feat(vencidos): board carrega e desenha o funil"`

---

### Task 6: A bifurcação do arrastar

**O ponto mais delicado da feature.** Cliente é `status: 'Venda'`; gravar a etapa
em `status` corromperia o estado de cliente e a aba Clientes.

**Files:** Modify `src/views/KanbanView.jsx`

- [ ] **Step 1: Bifurcar a escrita**

No handler de drop: quando o funil aberto é o Vencidos, gravar
`{ reactivationStageId: novaEtapaId }`. Em qualquer outro funil, o
comportamento de hoje (`status`), intocado.

- [ ] **Step 2: Venda abre o contrato**

Soltar na coluna **Venda** abre o `ContractModal` (decisão do Johnny em 18/08),
em vez de só reposicionar. Registrado o contrato, a vigência futura tira o
cliente de vencido e o card sai da query sozinho.

- [ ] **Step 3:** `npx vitest run && npx eslint .` → limpo
- [ ] **Step 4:** `git commit -m "feat(vencidos): arrastar grava reactivationStageId; Venda abre contrato"`

---

### Task 7: Proteções nas Configurações

**Files:** Modify `src/views/settings/FunnelsSection.jsx`

- [ ] **Step 1:** Onde hoje há `isReferralFunnel(f)`, aceitar também
  `isExpiredFunnel(f)`: não excluir o funil, nome travado, entrada fixada em
  primeiro. Extrair um `isSystemFunnel(f)` para não duplicar a condição em oito
  lugares.

- [ ] **Step 2:** As etapas protegidas já são cobertas pelo `isSystemStage()`
  (`src/lib/funnels.js:21`), que lê `isSystem` — nada a fazer, mas **conferir na
  tela** que entrada, Venda e Perda aparecem bloqueadas e "Em contato" editável.

- [ ] **Step 3:** `git commit -m "feat(vencidos): funil e etapas protegidos nas Configurações"`

---

### Task 8: Limpeza na volta

**Files:** Modify o arquivo de `buildMatriculaWrites` · Test correspondente

- [ ] **Step 1: Teste que falha**

```js
it('matrícula limpa o reactivationStageId', () => {
  const w = buildMatriculaWrites({ /* ...args de hoje... */ });
  expect(w.reactivationStageId).toBeNull();
});
```

Sem isso, o cliente que voltou e vencesse de novo daqui a dois anos reapareceria
na etapa da vida passada — bug silencioso de longo prazo.

- [ ] **Step 2:** Implementar, rodar, commitar.

---

### Task 9: Fechamento

- [ ] Suíte completa, `eslint .` sem erro novo, `npm run build` limpo
- [ ] Push e PR linkando o spec
- [ ] No corpo do PR: sem índice, sem regra, sem backfill; o funil se provisiona sozinho no primeiro acesso de admin

## Critério de pronto

- [ ] Funil "Vencidos" aparece no board, só quando selecionado
- [ ] Cliente vencido aparece na entrada sem ninguém criar nada
- [ ] Quem recusou na Meta nasce em Perda
- [ ] Arrastar grava `reactivationStageId`, nunca `status`
- [ ] Soltar em Venda abre o `ContractModal`; registrado o contrato, o card sai sozinho
- [ ] Nas Configurações: entrada, Venda e Perda bloqueadas; "Em contato" editável
- [ ] Nenhum teste da Meta Diária quebrado
