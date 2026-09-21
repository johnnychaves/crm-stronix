# Várias abas sem susto (PR 1 do endereço por tela) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abrir uma segunda aba deixa de deslogar a primeira, e a configuração de funis do primeiro login de gestor deixa de criar funis e etapas em dobro quando duas abas (ou dois gestores) rodam juntas.

**Architecture:** Duas correções independentes, sem tocar em tela. (1) O login com "Manter conectado" passa a gravar a sessão no IndexedDB, o mesmo lugar que o `getAuth` vigia; a escolha é uma função pura (`src/lib/authPersistence.js`) mais a fiação em `src/lib/firebase.js`. (2) As cinco configurações de funil em `src/App.jsx` passam a gravar com id fixo, numa transação que só cria o doc se ele ainda não existir; o que gravar sai de um módulo puro novo (`src/lib/funnelSetup.js`) e o como gravar de `src/lib/funnelSetupWrites.js`. Cada execução congela a academia no início.

**Tech Stack:** React 19 + Vite, Firebase JS SDK 12.11 (`firebase/auth` 1.12.2, `firebase/firestore`), vitest 4 em node (sem jsdom), eslint 9 com react-hooks v7.

**Spec:** `docs/superpowers/specs/2026-09-21-endereco-por-tela-design.md`, seção "Várias abas".

**Base conferida em 2026-09-21:** `npx vitest run` → 81 arquivos, 1675 testes verdes. `npm run lint` → 0 erros, 1 aviso (antigo, em `useEffect` com `loadPlans`/`loadTenants`). As regras do Firestore (`firestore.rules:136-163, 189-191`) deixam o admin gravar em `stronix_funnels`, `stronix_statuses`, `stronix_sources` e `stronix_config` sem validar campos, então `setDoc` com id escolhido passa sem regra nova.

---

## Mapa de arquivos

| Arquivo | O que faz | Ação |
|---|---|---|
| `src/lib/authPersistence.js` | Decide o tipo de persistência do login (`session`, `indexedDB`, `local`). Puro. | Criar |
| `src/lib/__tests__/authPersistence.test.js` | Testes da decisão | Criar |
| `src/lib/firebase.js` | Ganha `persistenceFor(remember)`, que devolve a classe de persistência do SDK | Modificar |
| `src/views/auth/LoginScreen.jsx` | Usa `persistenceFor` no login | Modificar |
| `src/App.jsx` | "Sair da visualização" na ordem nova; cinco configurações de funil com id fixo e academia congelada | Modificar |
| `src/lib/funnelSetup.js` | Ids fixos e planos puros (`setupStageId`, `toSetupWrites`, `planDefaultFunnel`, `planNegociacaoStages`) | Criar |
| `src/lib/__tests__/funnelSetup.test.js` | Testes, incluindo a convergência de duas abas | Criar |
| `src/lib/funnelSetupWrites.js` | Grava os planos só criando (transação), numa academia congelada | Criar |
| `CLAUDE.md` | Duas regras novas em "Convenções gerais" | Modificar |

---

### Task 0: Branch

- [ ] **Step 1: Criar a branch do PR 1 a partir do commit do spec**

```bash
git switch -c claude/rotas-pr1-varias-abas
git log --oneline -2
```

Expected: o topo é `docs: plano do PR 1 ...` ou `docs: desenho da entrega 1 do endereço por tela`.

- [ ] **Step 2: Conferir que a branch não está atrás da main**

```bash
git fetch origin -q && git rev-list --count HEAD..origin/main
```

Expected: `0`. Se der mais que zero, rodar `git merge origin/main` antes de seguir.

---

### Task 1: Decisão pura da persistência do login

**Files:**
- Create: `src/lib/authPersistence.js`
- Test: `src/lib/__tests__/authPersistence.test.js`

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/__tests__/authPersistence.test.js`:

```js
// Onde o login grava a sessão. Com "Manter conectado", tem de ser o MESMO lugar
// que o getAuth escolheu ao abrir a página (o IndexedDB), senão a aba seguinte
// muda a sessão de lugar e derruba a primeira.

import { describe, it, expect } from 'vitest';
import { persistenceKind } from '../authPersistence.js';

describe('persistenceKind', () => {
  it('sem "Manter conectado" a sessão fica só nesta aba', () => {
    expect(persistenceKind({ remember: false, indexedDbOk: true })).toBe('session');
    expect(persistenceKind({ remember: false, indexedDbOk: false })).toBe('session');
  });

  it('com "Manter conectado" usa o IndexedDB, o lugar que o getAuth vigia', () => {
    expect(persistenceKind({ remember: true, indexedDbOk: true })).toBe('indexedDB');
  });

  it('com "Manter conectado" e sem IndexedDB cai para o localStorage', () => {
    expect(persistenceKind({ remember: true, indexedDbOk: false })).toBe('local');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/authPersistence.test.js`
Expected: FAIL, "Failed to resolve import ../authPersistence.js".

- [ ] **Step 3: Implementar**

`src/lib/authPersistence.js`:

```js
// Onde o login grava a sessão do Firebase Auth. Puro, sem importar o SDK: a
// tradução para a classe de persistência fica em firebase.js (persistenceFor).
//
// Por que existe: o getAuth abre a página vigiando o IndexedDB, e o vigia fica
// preso a esse lugar (PersistenceUserManager do @firebase/auth 1.12.2). O login
// com "Manter conectado" gravava no localStorage. A aba seguinte achava a sessão
// ali, movia para o IndexedDB e apagava do localStorage, e a primeira aba lia o
// localStorage vazio e deslogava. Gravar no IndexedDB fecha isso.
export function persistenceKind({ remember, indexedDbOk }) {
  if (!remember) return 'session';
  return indexedDbOk ? 'indexedDB' : 'local';
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/authPersistence.test.js`
Expected: PASS, 3 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/authPersistence.js src/lib/__tests__/authPersistence.test.js
git commit -m "fix(login): decisão pura de onde gravar a sessão

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Login e "Sair da visualização" gravando no lugar certo

**Files:**
- Modify: `src/lib/firebase.js:7` (import) e depois da linha 35 (`export const auth = getAuth(app);`)
- Modify: `src/views/auth/LoginScreen.jsx:2-3` (imports) e `:33-35`
- Modify: `src/App.jsx:4-10` (imports), bloco de import de `./lib/firebase.js` (`:27-50`) e dentro de `stopImpersonation` (`:1299-1301`)

Não há teste automático aqui: `firebase.js` inicializa o Firebase ao ser importado e não roda em node. A garantia é o teste manual do PR mais lint e build.

- [ ] **Step 1: `src/lib/firebase.js`, import**

Trocar a linha 7:

```js
import { getAuth } from 'firebase/auth';
```

por:

```js
import { getAuth, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { persistenceKind } from './authPersistence.js';
```

- [ ] **Step 2: `src/lib/firebase.js`, `persistenceFor`**

Logo depois de `export const auth = getAuth(app);` (linha 35), inserir:

```js

// Onde o login grava a sessão (ver authPersistence.js). O getAuth acima NÃO
// muda: ele já procura a sessão no IndexedDB, no localStorage e no
// sessionStorage, e migra quem estiver logado hoje sem deslogar ninguém.
const PERSISTENCE_BY_KIND = {
  indexedDB: indexedDBLocalPersistence,
  local: browserLocalPersistence,
  session: browserSessionPersistence,
};

// Teste por abertura real, num banco próprio. Nunca abre o banco do SDK, que é
// apagado e recriado quando aberto sem a estrutura esperada. O teto de 1,5 s
// evita que um IndexedDB travado segure o login.
let indexedDbCheck = null;
function indexedDbWorks() {
  if (!indexedDbCheck) {
    indexedDbCheck = new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 1500);
      const done = (ok) => { clearTimeout(timer); resolve(ok); };
      try {
        const name = 'stronilead-teste-idb';
        const req = indexedDB.open(name);
        req.onsuccess = () => {
          try { req.result.close(); indexedDB.deleteDatabase(name); } catch { /* noop */ }
          done(true);
        };
        req.onerror = () => done(false);
        req.onblocked = () => done(false);
      } catch {
        done(false);
      }
    });
  }
  return indexedDbCheck;
}

export async function persistenceFor(remember) {
  const indexedDbOk = remember ? await indexedDbWorks() : false;
  return PERSISTENCE_BY_KIND[persistenceKind({ remember, indexedDbOk })];
}
```

- [ ] **Step 3: `src/views/auth/LoginScreen.jsx`, imports**

Trocar as linhas 2-3:

```js
import { signInWithEmailAndPassword, sendPasswordResetEmail, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { auth } from '../../lib/firebase.js';
```

por:

```js
import { signInWithEmailAndPassword, sendPasswordResetEmail, setPersistence } from 'firebase/auth';
import { auth, persistenceFor } from '../../lib/firebase.js';
```

- [ ] **Step 4: `src/views/auth/LoginScreen.jsx`, o login**

Trocar as linhas 33-35:

```js
    // "Manter conectado": local (padrão do Firebase = comportamento atual)
    // quando marcado; sessão quando desmarcado. Falha aqui não bloqueia o login.
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence).catch(() => {});
```

por:

```js
    // "Manter conectado" grava no mesmo lugar que o getAuth vigia (IndexedDB),
    // senão abrir outra aba derruba esta. Desmarcado, a sessão fica só nesta
    // aba. Falha aqui não bloqueia o login.
    await setPersistence(auth, await persistenceFor(remember)).catch(() => {});
```

- [ ] **Step 5: `src/App.jsx`, imports**

Trocar as linhas 4-10:

```js
import {
  onAuthStateChanged,
  signInWithCustomToken,
  signOut,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
```

por:

```js
import {
  onAuthStateChanged,
  signInWithCustomToken,
  signOut,
  setPersistence
} from 'firebase/auth';
```

E no bloco `import { ... } from './lib/firebase.js';` (linhas 27-50), acrescentar `persistenceFor,` logo depois de `setTenantId,`:

```js
  setTenantId,
  persistenceFor,
```

- [ ] **Step 6: `src/App.jsx`, ordem do "Sair da visualização"**

Dentro de `stopImpersonation`, trocar:

```js
      if (res.ok && data.returnToken) {
        try { await setPersistence(auth, browserLocalPersistence); } catch { /* ignore */ }
        await signInWithCustomToken(auth, data.returnToken);
      } else {
```

por:

```js
      if (res.ok && data.returnToken) {
        // Primeiro volta à conta do super-admin, ainda na sessão desta aba, e só
        // depois leva a conta para o armazenamento que as outras abas vigiam. Na
        // ordem inversa a conta do cliente passaria por lá e as outras abas
        // entrariam como o cliente por um instante.
        await signInWithCustomToken(auth, data.returnToken);
        try { await setPersistence(auth, await persistenceFor(true)); } catch { /* ignore */ }
      } else {
```

- [ ] **Step 7: Conferir que não sobrou uso das persistências antigas nesses arquivos**

Run: `grep -n "browserLocalPersistence" src/App.jsx src/views/auth/LoginScreen.jsx`
Expected: nenhuma linha. (`SuperAdminView.jsx` e `SuperConsole.jsx` continuam com `browserSessionPersistence` no "Acessar como", de propósito: a sessão assumida é por aba.)

- [ ] **Step 8: Lint e testes**

Run: `npm run lint && npx vitest run`
Expected: lint com 0 erros (o aviso antigo continua); 1678 testes verdes.

- [ ] **Step 9: Commit**

```bash
git add src/lib/firebase.js src/views/auth/LoginScreen.jsx src/App.jsx
git commit -m "fix(login): abrir outra aba deixa de deslogar a primeira

Com \"Manter conectado\", o login grava a sessão no IndexedDB, o mesmo
lugar que o getAuth vigia. Antes gravava no localStorage, a aba nova
movia a sessão para o IndexedDB e a primeira aba deslogava. O \"Sair da
visualização\" volta à conta do super-admin antes de mudar a persistência.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Ids fixos e `toSetupWrites`

**Files:**
- Create: `src/lib/funnelSetup.js`
- Test: `src/lib/__tests__/funnelSetup.test.js`

- [ ] **Step 1: Escrever os testes que falham**

`src/lib/__tests__/funnelSetup.test.js`:

```js
// Configuração de funis com id FIXO (src/lib/funnelSetup.js). Duas abas, dois
// computadores ou dois gestores gravam no mesmo documento, então o resultado é
// sempre um funil só. Id publicado não muda nunca.

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FUNNEL_ID, SYSTEM_FUNNEL_IDS, REFERRAL_SOURCE_ID,
  setupStageId, toSetupWrites,
} from '../funnelSetup.js';
import { ALL_FUNNELS_ID } from '../funnels.js';
import { planUpgradeSetupOps } from '../upgradeFunnel.js';
import { planReferralSetupOps } from '../referrals.js';
import { planRenewalSetupOps } from '../renewalFunnel.js';

describe('ids fixos', () => {
  it('são estes e não mudam (mudar cria um segundo funil em toda academia)', () => {
    expect(DEFAULT_FUNNEL_ID).toBe('funil-padrao');
    expect(SYSTEM_FUNNEL_IDS).toEqual({
      referral: 'funil-sistema-indicacoes',
      upgrade: 'funil-sistema-upgrade',
      renewal: 'funil-sistema-renovacoes',
      expired: 'funil-sistema-vencidos',
    });
    expect(REFERRAL_SOURCE_ID).toBe('origem-indicacao');
  });

  it('são ids válidos no Firestore e distintos entre si', () => {
    const ids = [DEFAULT_FUNNEL_ID, ...Object.values(SYSTEM_FUNNEL_IDS), REFERRAL_SOURCE_ID];
    for (const id of ids) {
      expect(id).not.toContain('/');
      expect(id).not.toBe('.');
      expect(id).not.toBe('..');
      expect(id).not.toMatch(/^__.*__$/);
      expect(new TextEncoder().encode(id).length).toBeLessThan(1500);
      expect(id).not.toBe(ALL_FUNNELS_ID);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('setupStageId', () => {
  it('a entrada tem id próprio, que não muda quando ela é renomeada', () => {
    expect(setupStageId('f1', { name: 'Vencido', isEntry: true })).toBe('f1--entrada');
    expect(setupStageId('f1', { name: 'Aguardando contato', isEntry: true })).toBe('f1--entrada');
  });

  it('as outras etapas usam o nome sem acento', () => {
    expect(setupStageId('f1', { name: 'Negociação' })).toBe('f1--etapa-negociacao');
    expect(setupStageId('f1', { name: 'Em contato' })).toBe('f1--etapa-em-contato');
  });

  it('uma etapa chamada "Entrada" não colide com a entrada', () => {
    expect(setupStageId('f1', { name: 'Entrada' })).not.toBe(setupStageId('f1', { name: 'X', isEntry: true }));
  });

  it('nome vazio ganha um id estável', () => {
    expect(setupStageId('f1', { name: '' })).toBe('f1--etapa-sem-nome');
  });
});

describe('toSetupWrites', () => {
  it('funil novo leva o id pelo tipo, e as etapas herdam esse id', () => {
    const writes = toSetupWrites(planUpgradeSetupOps({ funnels: [], statuses: [] }), 'ts');
    expect(writes).toEqual([
      {
        collection: 'funnels',
        id: 'funil-sistema-upgrade',
        data: { name: 'Upgrade', systemKind: 'upgrade', order: 97, createdAt: 'ts', updatedAt: 'ts' },
      },
      {
        collection: 'statuses',
        id: 'funil-sistema-upgrade--entrada',
        data: { name: 'Aguardando contato', color: 'slate', order: 0, isSystem: true, isEntry: true, funnelId: 'funil-sistema-upgrade' },
      },
    ]);
  });

  it('etapa de um funil antigo (id aleatório) usa o id dele', () => {
    const legado = { id: 'Ab12Cd', systemKind: 'upgrade', name: 'Upgrade' };
    const writes = toSetupWrites(planUpgradeSetupOps({ funnels: [legado], statuses: [] }), 'ts');
    expect(writes).toHaveLength(1);
    expect(writes[0].id).toBe('Ab12Cd--entrada');
    expect(writes[0].data.funnelId).toBe('Ab12Cd');
  });

  it('a origem Indicação tem id fixo', () => {
    const writes = toSetupWrites(planReferralSetupOps({ funnels: [], statuses: [], sources: [] }), 'ts');
    const origem = writes.find((w) => w.collection === 'sources');
    expect(origem).toEqual({ collection: 'sources', id: 'origem-indicacao', data: { name: 'Indicação', createdAt: 'ts' } });
  });

  it('o carimbo de hora vai no funil e na origem, nunca na etapa', () => {
    const writes = toSetupWrites(planReferralSetupOps({ funnels: [], statuses: [], sources: [] }), 'ts');
    for (const w of writes.filter((x) => x.collection === 'statuses')) {
      expect(w.data).not.toHaveProperty('createdAt');
    }
  });

  it('plano vazio não grava nada', () => {
    const existente = [{ id: 'r', systemKind: 'renewal' }];
    expect(toSetupWrites(planRenewalSetupOps({ funnels: existente }), 'ts')).toEqual([]);
    expect(toSetupWrites(null, 'ts')).toEqual([]);
  });

  it('tipo de funil sem id fixo é erro, não um id inventado', () => {
    expect(() => toSetupWrites({ createFunnel: { systemKind: 'novo' } }, 'ts')).toThrow(/sem id fixo/);
  });

  it('etapa sem funil é erro', () => {
    expect(() => toSetupWrites({ createStages: [{ name: 'X' }] }, 'ts')).toThrow(/sem funil/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/funnelSetup.test.js`
Expected: FAIL, "Failed to resolve import ../funnelSetup.js".

- [ ] **Step 3: Implementar**

`src/lib/funnelSetup.js`:

```js
// Configuração de funis do primeiro login de gestor (App.jsx), com id FIXO.
// Duas abas, dois computadores ou dois gestores rodando ao mesmo tempo gravam
// no MESMO documento, e o resultado é sempre um funil só. Antes era addDoc, e
// cada aba criava o seu.
//
// Id publicado não muda nunca: trocar um id aqui cria um segundo funil em toda
// academia. Puro: sem React e sem Firestore (a gravação fica em
// funnelSetupWrites.js).

import { isSystemFunnel } from './funnels.js';
import { normalize } from './globalSearch.js';

export const DEFAULT_FUNNEL_ID = 'funil-padrao';

export const SYSTEM_FUNNEL_IDS = Object.freeze({
  referral: 'funil-sistema-indicacoes',
  upgrade: 'funil-sistema-upgrade',
  renewal: 'funil-sistema-renovacoes',
  expired: 'funil-sistema-vencidos',
});

export const REFERRAL_SOURCE_ID = 'origem-indicacao';

const slug = (s) => normalize(s).trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Id da etapa, prefixado pelo funil. A entrada tem id próprio, que não muda
// quando ela é renomeada ('Vencido' → 'Aguardando contato'). O prefixo 'etapa-'
// impede que uma etapa chamada 'Entrada' colida com a entrada.
export const setupStageId = (funnelId, stage) =>
  `${funnelId}--${stage?.isEntry ? 'entrada' : `etapa-${slug(stage?.name) || 'sem-nome'}`}`;

// Plano de um funil de sistema (plan*SetupOps) → gravações com id fixo.
// ts é o carimbo de hora de quem executa (serverTimestamp() no app).
export function toSetupWrites(plan, ts) {
  const writes = [];
  let newFunnelId = null;
  if (plan?.createFunnel) {
    newFunnelId = SYSTEM_FUNNEL_IDS[plan.createFunnel.systemKind];
    if (!newFunnelId) throw new Error(`funil de sistema sem id fixo: ${plan.createFunnel.systemKind}`);
    writes.push({
      collection: 'funnels',
      id: newFunnelId,
      data: { ...plan.createFunnel, createdAt: ts, updatedAt: ts },
    });
  }
  for (const stage of plan?.createStages || []) {
    const funnelId = stage.funnelId || newFunnelId;
    if (!funnelId) throw new Error(`etapa sem funil: ${stage.name}`);
    writes.push({ collection: 'statuses', id: setupStageId(funnelId, stage), data: { ...stage, funnelId } });
  }
  if (plan?.createSource) {
    writes.push({ collection: 'sources', id: REFERRAL_SOURCE_ID, data: { ...plan.createSource, createdAt: ts } });
  }
  return writes;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/funnelSetup.test.js`
Expected: PASS, 13 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/funnelSetup.js src/lib/__tests__/funnelSetup.test.js
git commit -m "fix(funis): ids fixos para a configuração dos funis de sistema

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Funil padrão e Negociação como planos puros

Hoje os passos 1 e 4 da migração de funis vivem dentro do `useEffect` (`src/App.jsx:897-949` e `:975-998`). Eles viram funções puras com o mesmo critério, mais duas mudanças do spec: o funil criado ganha id fixo, e a Negociação deixa de entrar em funil de sistema.

**Files:**
- Modify: `src/lib/funnelSetup.js` (acrescentar no fim)
- Test: `src/lib/__tests__/funnelSetup.test.js` (acrescentar no fim)

- [ ] **Step 1: Escrever os testes que falham**

No topo de `src/lib/__tests__/funnelSetup.test.js`, trocar o import de `../funnelSetup.js` por:

```js
import {
  DEFAULT_FUNNEL_ID, SYSTEM_FUNNEL_IDS, REFERRAL_SOURCE_ID,
  setupStageId, toSetupWrites, planDefaultFunnel, planNegociacaoStages,
} from '../funnelSetup.js';
```

E acrescentar no fim do arquivo:

```js
describe('planDefaultFunnel (passo 1 da migração de funis)', () => {
  it('um padrão só: mantém e não grava nada', () => {
    expect(planDefaultFunnel([{ id: 'a', isDefault: true }, { id: 'b' }])).toEqual({
      defaultId: 'a', create: null, promoteId: null, demoteIds: [],
    });
  });

  it('vários padrões: fica o criado primeiro e os outros são rebaixados', () => {
    const plan = planDefaultFunnel([
      { id: 'novo', isDefault: true, createdAt: { seconds: 200 }, order: 0 },
      { id: 'velho', isDefault: true, createdAt: { seconds: 100 }, order: 5 },
    ]);
    expect(plan.defaultId).toBe('velho');
    expect(plan.demoteIds).toEqual(['novo']);
    expect(plan.create).toBeNull();
  });

  it('vários padrões com a mesma data: desempata pela menor ordem', () => {
    const plan = planDefaultFunnel([
      { id: 'b', isDefault: true, createdAt: { seconds: 100 }, order: 3 },
      { id: 'a', isDefault: true, createdAt: { seconds: 100 }, order: 1 },
    ]);
    expect(plan.defaultId).toBe('a');
  });

  it('padrão sem data perde para o que tem data', () => {
    const plan = planDefaultFunnel([
      { id: 'semData', isDefault: true },
      { id: 'comData', isDefault: true, createdAt: { toMillis: () => 5 } },
    ]);
    expect(plan.defaultId).toBe('comData');
  });

  it('nenhum padrão: promove o funil próprio de menor ordem, nunca um de sistema', () => {
    const plan = planDefaultFunnel([
      { id: 'sis', systemKind: 'referral', order: 0 },
      { id: 'b', order: 3 },
      { id: 'c', order: 1 },
    ]);
    expect(plan).toEqual({ defaultId: 'c', create: null, promoteId: 'c', demoteIds: [] });
  });

  it('nenhum funil próprio: cria o Comercial com o id fixo', () => {
    const esperado = {
      defaultId: DEFAULT_FUNNEL_ID,
      create: { name: 'Comercial', order: 0, isDefault: true },
      promoteId: null,
      demoteIds: [],
    };
    expect(planDefaultFunnel([])).toEqual(esperado);
    expect(planDefaultFunnel(null)).toEqual(esperado);
    expect(planDefaultFunnel([{ id: 'sis', systemKind: 'expired', order: 99 }])).toEqual(esperado);
  });
});

describe('planNegociacaoStages (passo 4 da migração de funis)', () => {
  it('cria a Negociação no funil próprio que não tem, na última posição', () => {
    const writes = planNegociacaoStages({
      funnels: [{ id: 'f1' }],
      statuses: [{ id: 's1', funnelId: 'f1', name: 'Novo' }, { id: 's2', funnelId: 'f1', name: 'Visita' }],
    });
    expect(writes).toEqual([{
      collection: 'statuses',
      id: 'f1--etapa-negociacao',
      data: { name: 'Negociação', color: 'purple', order: 2, funnelId: 'f1', isSystem: true },
    }]);
  });

  it('pula o funil que já tem Negociação, com espaço ou maiúscula', () => {
    const writes = planNegociacaoStages({
      funnels: [{ id: 'f1' }],
      statuses: [{ id: 's1', funnelId: 'f1', name: '  NEGOCIAÇÃO ' }],
    });
    expect(writes).toEqual([]);
  });

  it('pula todo funil de sistema', () => {
    const writes = planNegociacaoStages({
      funnels: [
        { id: 'i', systemKind: 'referral' },
        { id: 'v', systemKind: 'expired' },
        { id: 'r', systemKind: 'renewal' },
        { id: 'u', systemKind: 'upgrade' },
      ],
      statuses: [],
    });
    expect(writes).toEqual([]);
  });

  it('rodar duas vezes sobre o mesmo estado dá os mesmos ids', () => {
    const estado = { funnels: [{ id: 'f1' }, { id: 'f2' }], statuses: [] };
    expect(planNegociacaoStages(estado).map((w) => w.id)).toEqual(planNegociacaoStages(estado).map((w) => w.id));
  });

  it('funil sem id e entrada vazia não quebram', () => {
    expect(planNegociacaoStages({ funnels: [{ name: 'sem id' }], statuses: [] })).toEqual([]);
    expect(planNegociacaoStages()).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/funnelSetup.test.js`
Expected: FAIL, "planDefaultFunnel is not a function" (e o mesmo para `planNegociacaoStages`).

- [ ] **Step 3: Implementar**

Acrescentar no fim de `src/lib/funnelSetup.js`:

```js

// createdAt em ms aceitando Timestamp ({toMillis}/{seconds}), Date ou número.
// Sem data → Infinity: perde o desempate para quem tem data real.
const createdAtMs = (f) => {
  const c = f?.createdAt;
  if (!c) return Number.POSITIVE_INFINITY;
  if (typeof c.toMillis === 'function') return c.toMillis();
  if (c.seconds) return c.seconds * 1000;
  if (c instanceof Date) return c.getTime();
  return Number(c) || Number.POSITIVE_INFINITY;
};

// Passo 1 da migração de funis: garantir EXATAMENTE um funil padrão.
// - um padrão: mantém;
// - vários: fica o criado primeiro (empate pela menor ordem) e os outros são
//   rebaixados;
// - nenhum: promove o funil PRÓPRIO de menor ordem (funil de sistema nunca vira
//   padrão, senão o fallback de isItemInFunnel despejaria nele os leads sem
//   funnelId);
// - nenhum funil próprio: cria o Comercial com o id fixo.
export function planDefaultFunnel(funnels) {
  const list = Array.isArray(funnels) ? funnels : [];
  const defaults = list.filter((f) => f?.isDefault === true);

  if (defaults.length === 1) {
    return { defaultId: defaults[0].id, create: null, promoteId: null, demoteIds: [] };
  }
  if (defaults.length > 1) {
    const sorted = [...defaults].sort((a, b) => {
      const ta = createdAtMs(a);
      const tb = createdAtMs(b);
      if (ta !== tb) return ta - tb;
      return (a.order || 0) - (b.order || 0);
    });
    return { defaultId: sorted[0].id, create: null, promoteId: null, demoteIds: sorted.slice(1).map((f) => f.id) };
  }

  const own = list.filter((f) => f?.id && !isSystemFunnel(f));
  if (own.length > 0) {
    const promote = [...own].sort((a, b) => (a.order || 0) - (b.order || 0))[0];
    return { defaultId: promote.id, create: null, promoteId: promote.id, demoteIds: [] };
  }

  return {
    defaultId: DEFAULT_FUNNEL_ID,
    create: { name: 'Comercial', order: 0, isDefault: true },
    promoteId: null,
    demoteIds: [],
  };
}

// Passo 4 da migração de funis: a etapa de sistema "Negociação" em todo funil
// PRÓPRIO que não tem. Funil de sistema cuida das próprias etapas (Vencidos e
// Upgrade não têm Negociação por decisão do Johnny), e uma aba atrasada não
// pode enfiar uma Negociação protegida neles. Mesma comparação de nome de antes.
export function planNegociacaoStages({ funnels, statuses } = {}) {
  const byFunnel = new Map();
  for (const s of statuses || []) {
    if (!byFunnel.has(s.funnelId)) byFunnel.set(s.funnelId, []);
    byFunnel.get(s.funnelId).push(s);
  }
  const writes = [];
  for (const f of funnels || []) {
    if (!f?.id || isSystemFunnel(f)) continue;
    const stages = byFunnel.get(f.id) || [];
    const hasNegociacao = stages.some((s) => (s.name || '').trim().toLowerCase() === 'negociação');
    if (hasNegociacao) continue;
    const data = { name: 'Negociação', color: 'purple', order: stages.length, funnelId: f.id, isSystem: true };
    writes.push({ collection: 'statuses', id: setupStageId(f.id, data), data });
  }
  return writes;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/funnelSetup.test.js`
Expected: PASS, 24 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/funnelSetup.js src/lib/__tests__/funnelSetup.test.js
git commit -m "fix(funis): funil padrão e Negociação viram planos puros com id fixo

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Teste de convergência de duas abas

Este é o teste que prova a correção. Ele simula a aba A gravando o plano dela e a aba B lendo o banco depois de cada uma das gravações de A (inclusive antes da primeira, que é o caso de dois computadores lendo ao mesmo tempo), e aplica o resto nas duas ordens. O banco falso tem a mesma semântica do `setDoc` com merge.

**Files:**
- Test: `src/lib/__tests__/funnelSetup.test.js` (acrescentar no fim)

- [ ] **Step 1: Acrescentar os imports que faltam**

No topo de `src/lib/__tests__/funnelSetup.test.js`, trocar a linha:

```js
import { planRenewalSetupOps } from '../renewalFunnel.js';
```

por:

```js
import { planRenewalSetupOps } from '../renewalFunnel.js';
import { planExpiredSetupOps } from '../expiredFunnel.js';
import { normalize } from '../globalSearch.js';
```

- [ ] **Step 2: Escrever o teste**

Acrescentar no fim de `src/lib/__tests__/funnelSetup.test.js`:

```js
// Banco falso com a semântica do setDoc(..., { merge: true }).
const emptyDb = () => ({ funnels: new Map(), statuses: new Map(), sources: new Map() });
const applyWrite = (db, w) => {
  const col = db[w.collection];
  col.set(w.id, { ...(col.get(w.id) || {}), ...w.data, id: w.id });
};
const view = (db) => ({
  funnels: [...db.funnels.values()],
  statuses: [...db.statuses.values()],
  sources: [...db.sources.values()],
});
// Academia como fica depois da migração de funis: o Comercial padrão.
const baseDb = () => {
  const db = emptyDb();
  applyWrite(db, { collection: 'funnels', id: DEFAULT_FUNNEL_ID, data: { name: 'Comercial', order: 0, isDefault: true } });
  return db;
};

const SYSTEM_KINDS = [
  { kind: 'referral', plan: planReferralSetupOps, entries: 1 },
  { kind: 'expired', plan: planExpiredSetupOps, entries: 1 },
  { kind: 'renewal', plan: planRenewalSetupOps, entries: 0 },
  { kind: 'upgrade', plan: planUpgradeSetupOps, entries: 1 },
];

describe.each(SYSTEM_KINDS)('duas abas configurando o funil $kind ao mesmo tempo', ({ kind, plan, entries }) => {
  const writesA = toSetupWrites(plan(view(baseDb())), 'ts');

  for (let p = 0; p <= writesA.length; p += 1) {
    for (const ordem of ['resto de A primeiro', 'B primeiro']) {
      it(`B lê depois de ${p} gravação(ões) de A, ${ordem}: sobra um funil só`, () => {
        const db = baseDb();
        writesA.slice(0, p).forEach((w) => applyWrite(db, w));
        const writesB = toSetupWrites(plan(view(db)), 'ts');
        const restoA = writesA.slice(p);
        const sequencia = ordem === 'B primeiro' ? [...writesB, ...restoA] : [...restoA, ...writesB];
        sequencia.forEach((w) => applyWrite(db, w));

        const funis = [...db.funnels.values()].filter((f) => f.systemKind === kind);
        expect(funis).toHaveLength(1);
        expect(funis[0].id).toBe(SYSTEM_FUNNEL_IDS[kind]);

        const etapas = [...db.statuses.values()].filter((s) => s.funnelId === funis[0].id);
        expect(etapas.filter((s) => s.isEntry)).toHaveLength(entries);
        const nomes = etapas.map((s) => normalize(s.name).trim());
        expect(new Set(nomes).size).toBe(nomes.length);

        if (kind === 'referral') {
          expect(nomes.filter((n) => n === 'negociacao')).toHaveLength(1);
          const origens = [...db.sources.values()].filter((s) => normalize(s.name).includes('indica'));
          expect(origens).toHaveLength(1);
        }
      });
    }
  }
});

describe('duas abas rodando a migração de funis numa academia nova', () => {
  it('as duas criam o mesmo Comercial e a mesma Negociação', () => {
    const db = emptyDb();
    const a = planDefaultFunnel(view(db).funnels);
    const b = planDefaultFunnel(view(db).funnels);
    expect(a.defaultId).toBe(DEFAULT_FUNNEL_ID);
    expect(b.defaultId).toBe(DEFAULT_FUNNEL_ID);
    for (const s of [a, b]) applyWrite(db, { collection: 'funnels', id: s.defaultId, data: s.create });
    expect(db.funnels.size).toBe(1);

    const negA = planNegociacaoStages(view(db));
    const negB = planNegociacaoStages(view(db));
    [...negA, ...negB].forEach((w) => applyWrite(db, w));
    const negociacoes = [...db.statuses.values()].filter((s) => s.funnelId === DEFAULT_FUNNEL_ID && s.name === 'Negociação');
    expect(negociacoes).toHaveLength(1);
  });

  it('a aba atrasada não põe Negociação nos funis de sistema que a outra já criou', () => {
    const db = baseDb();
    applyWrite(db, { collection: 'statuses', id: `${DEFAULT_FUNNEL_ID}--etapa-negociacao`, data: { name: 'Negociação', funnelId: DEFAULT_FUNNEL_ID } });
    for (const { plan } of SYSTEM_KINDS) {
      toSetupWrites(plan(view(db)), 'ts').forEach((w) => applyWrite(db, w));
    }
    expect(planNegociacaoStages(view(db))).toEqual([]);
  });
});
```

- [ ] **Step 3: Rodar**

Run: `npx vitest run src/lib/__tests__/funnelSetup.test.js`
Expected: PASS. Contagem: 24 anteriores + 2 da migração + os casos de convergência (referral: 4 gravações de A, com a origem → 5 leituras de B × 2 ordens = 10; expired: 3 → 8; renewal: 1 → 4; upgrade: 2 → 6), total 54.

Se algum caso de convergência falhar, é bug do plano ou do id: não afrouxe o teste. Leia qual `p` e qual ordem falharam e corrija `setupStageId` ou `toSetupWrites`.

- [ ] **Step 4: Prova de que o teste enxerga a duplicação**

Troque temporariamente, em `toSetupWrites`, a linha `id: newFunnelId,` por `id: \`${newFunnelId}-${Math.random()}\`,` e rode de novo.

Run: `npx vitest run src/lib/__tests__/funnelSetup.test.js`
Expected: FAIL nos casos de convergência com "expected [...] to have a length of 1". Desfaça a troca (`git diff src/lib/funnelSetup.js` deve voltar a vazio) e rode de novo para ver PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/__tests__/funnelSetup.test.js
git commit -m "test(funis): duas abas configurando juntas convergem num funil só

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Gravação com academia congelada

**Files:**
- Create: `src/lib/funnelSetupWrites.js`

Sem teste unitário: é só a transação do Firestore, que não roda em node sem o Firebase. O que ele grava já está coberto pelas Tasks 3 a 5.

- [ ] **Step 1: Criar o arquivo**

`src/lib/funnelSetupWrites.js`:

```js
// Gravação da configuração de funis do primeiro login de gestor. O QUE gravar
// vem de funnelSetup.js (puro, com id fixo); aqui fica o COMO. Padrão de
// referrals.js / referralsWrites.js.
//
// Recebe a academia CONGELADA por quem chama e nunca lê o appId vivo: se a
// conta trocar no meio da execução (outra aba, "Acessar como"), a regra do
// Firestore nega e a execução falha sem carimbar, em vez de gravar na academia
// nova com o plano calculado na anterior.

import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db, FUNNELS_PATH, STATUSES_PATH, SOURCES_PATH } from './firebase.js';
import { toSetupWrites } from './funnelSetup.js';

const PATH_BY_COLLECTION = { funnels: FUNNELS_PATH, statuses: STATUSES_PATH, sources: SOURCES_PATH };

export const tenantCol = (tenant, path) => collection(db, 'artifacts', tenant, 'public', 'data', path);
export const tenantDoc = (tenant, path, id) => doc(db, 'artifacts', tenant, 'public', 'data', path, id);

// Só cria. A transação confere se o doc do id fixo já existe e, se existir, não
// mexe: a segunda aba (ou um notebook que acordou com a gravação na fila) nunca
// sobrescreve o que a primeira gravou, nem uma edição do gestor feita no meio.
// Custa uma leitura por doc, uma vez na vida de cada academia. Sem internet a
// transação falha, a configuração não carimba e roda de novo na próxima carga.
export async function writeSetupWrites(tenant, writes) {
  for (const w of writes) {
    const ref = tenantDoc(tenant, PATH_BY_COLLECTION[w.collection], w.id);
    await runTransaction(db, async (tx) => {
      if (!(await tx.get(ref)).exists()) tx.set(ref, w.data);
    });
  }
}

// Plano de um funil de sistema (plan*SetupOps) gravado com id fixo.
export const writeSetupPlan = (tenant, plan) => writeSetupWrites(tenant, toSetupWrites(plan, serverTimestamp()));
```

- [ ] **Step 2: Lint do arquivo**

Run: `npx eslint src/lib/funnelSetupWrites.js`
Expected: sem saída.

- [ ] **Step 3: Commit**

```bash
git add src/lib/funnelSetupWrites.js
git commit -m "fix(funis): gravação da configuração com academia congelada

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Migração de funis (passos 1 a 4) com id fixo

**Files:**
- Modify: `src/App.jsx:63-64` (imports) e o IIFE da migração de funis (`:895-1017`)

- [ ] **Step 1: Imports**

Logo depois da linha 64 (`import { planReferralSetupOps } from './lib/referrals.js';`), acrescentar:

```js
import { planDefaultFunnel, planNegociacaoStages } from './lib/funnelSetup.js';
import { tenantCol, tenantDoc, writeSetupWrites, writeSetupPlan } from './lib/funnelSetupWrites.js';
```

(`writeSetupPlan` é usado na Task 8. As Tasks 7 e 8 vão no mesmo commit.)

- [ ] **Step 2: Passo 1 com id fixo e academia congelada**

No IIFE da migração de funis, trocar o trecho que vai de `// Passo 1: garantir EXATAMENTE um funil default` até `const defaultId = defaultFunnel.id;` (linhas 897-951) por:

```js
        // Academia congelada no início: toda leitura e gravação desta execução
        // vai para ela, mesmo que a conta troque no meio (ver funnelSetupWrites.js).
        const tenant = appId;

        // Passo 1: garantir EXATAMENTE um funil default. O Comercial criado tem
        // id fixo e só é criado se ainda não existir, então duas abas rodando
        // juntas caem no mesmo documento.
        const funnelsSnap = await getDocs(tenantCol(tenant, FUNNELS_PATH));
        const step1 = planDefaultFunnel(funnelsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        if (step1.create) {
          await writeSetupWrites(tenant, [{
            collection: 'funnels',
            id: step1.defaultId,
            data: { ...step1.create, createdAt: serverTimestamp() },
          }]);
        }
        if (step1.promoteId) {
          // updateDoc, não setDoc: se o funil foi apagado no meio, falha em vez
          // de recriar um doc sem nome marcado como padrão.
          await updateDoc(tenantDoc(tenant, FUNNELS_PATH, step1.promoteId), { isDefault: true });
        }
        if (step1.demoteIds.length) {
          await commitOpsInChunks(
            db,
            step1.demoteIds.map(id => ({ ref: tenantDoc(tenant, FUNNELS_PATH, id), data: { isDefault: false } })),
            400
          );
        }

        const defaultId = step1.defaultId;
```

- [ ] **Step 3: Passos 2 e 3 lendo da academia congelada**

Trocar:

```js
        const statusesSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH));
```

por:

```js
        const statusesSnap = await getDocs(tenantCol(tenant, STATUSES_PATH));
```

E trocar:

```js
        const leadsSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH));
```

por:

```js
        const leadsSnap = await getDocs(tenantCol(tenant, LEADS_PATH));
```

(As gravações dos passos 2 e 3 usam `d.ref`, que já aponta para a academia lida. Não mudam.)

- [ ] **Step 4: Passo 4 sem Negociação em funil de sistema**

Trocar o trecho que vai de `// Passo 4: garantir que TODO funil tem a etapa de sistema "Negociação"` até o `}` que fecha o `for (const fId of allFunnelIds)` (linhas 975-998) por:

```js
        // Passo 4: garantir que todo funil PRÓPRIO tem a etapa de sistema
        // "Negociação". Funil de sistema cuida das próprias etapas, e uma aba
        // atrasada não pode enfiar Negociação em Vencidos ou Upgrade. Id fixo:
        // duas abas gravam a mesma etapa.
        const [statusesAfter, funnelsAfter] = await Promise.all([
          getDocs(tenantCol(tenant, STATUSES_PATH)),
          getDocs(tenantCol(tenant, FUNNELS_PATH)),
        ]);
        await writeSetupWrites(tenant, planNegociacaoStages({
          funnels: funnelsAfter.docs.map(d => ({ id: d.id, ...d.data() })),
          statuses: statusesAfter.docs.map(d => ({ id: d.id, ...d.data() })),
        }));
```

- [ ] **Step 5: Carimbo na academia congelada**

No mesmo IIFE, trocar:

```js
        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CONFIG_GENERAL_ID),
          { funnelsSetupDoneAt: serverTimestamp() },
          { merge: true }
        );
```

por:

```js
        await setDoc(
          tenantDoc(tenant, CONFIG_PATH, CONFIG_GENERAL_ID),
          { funnelsSetupDoneAt: serverTimestamp() },
          { merge: true }
        );
```

- [ ] **Step 6: Conferir o bloco**

Run: `awk '/Migração idempotente: cria funil "Comercial"/,/}, \[appUser, funnels, loadingData, funnelsMigrationStatus, funnelsSetupDone\]\);/' src/App.jsx | grep -n "appId\|addDoc"`
Expected: uma linha só, `const tenant = appId;`.

Não faça commit ainda: siga para a Task 8.

---

### Task 8: Os quatro funis de sistema com id fixo

**Files:**
- Modify: `src/App.jsx` (IIFEs de Indicações, Vencidos, Renovações e Upgrade) e o import de `firebase/firestore` (`:12-24`)

- [ ] **Step 1: Indicações**

No IIFE da migração de indicações, trocar tudo entre o `try {` e o `setReferralMigrationStatus('done');` (as leituras, o `let newFunnelId`, os `addDoc` e o carimbo) por:

```js
        // Academia congelada no início (ver funnelSetupWrites.js).
        const tenant = appId;
        // Snapshots frescos por getDocs (não os props): elimina a corrida com
        // as assinaturas ao vivo ainda vazias no boot. Três leituras pequenas,
        // uma única vez por tenant na vida.
        const [funnelsSnap, statusesSnap, sourcesSnap] = await Promise.all([
          getDocs(tenantCol(tenant, FUNNELS_PATH)),
          getDocs(tenantCol(tenant, STATUSES_PATH)),
          getDocs(tenantCol(tenant, SOURCES_PATH))
        ]);
        const plan = planReferralSetupOps({
          funnels: funnelsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          statuses: statusesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          sources: sourcesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        });

        // Id fixo no funil, nas etapas e na origem: duas abas gravam o mesmo doc.
        await writeSetupPlan(tenant, plan);

        // Carimba a flag própria — impede qualquer leitura nas cargas futuras.
        await setDoc(
          tenantDoc(tenant, CONFIG_PATH, CONFIG_GENERAL_ID),
          { referralSetupDoneAt: serverTimestamp() },
          { merge: true }
        );

```

(O `setReferralMigrationStatus('done');` e o `catch` continuam como estão.)

- [ ] **Step 2: Vencidos**

No IIFE do funil de vencidos, trocar tudo entre o `try {` e o `setExpiredFunnelStatus('done');` por:

```js
        // Academia congelada no início (ver funnelSetupWrites.js).
        const tenant = appId;
        // Snapshots frescos por getDocs (não os props): elimina a corrida com
        // as assinaturas ao vivo ainda vazias no boot.
        const [funnelsSnap, statusesSnap] = await Promise.all([
          getDocs(tenantCol(tenant, FUNNELS_PATH)),
          getDocs(tenantCol(tenant, STATUSES_PATH))
        ]);
        const plan = planExpiredSetupOps({
          funnels: funnelsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          statuses: statusesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        });

        // Id fixo no funil e nas etapas: duas abas gravam o mesmo doc.
        await writeSetupPlan(tenant, plan);
        for (const ren of (plan.renameStages || [])) {
          await updateDoc(tenantDoc(tenant, STATUSES_PATH, ren.id), { name: ren.name });
        }

        await setDoc(
          tenantDoc(tenant, CONFIG_PATH, CONFIG_GENERAL_ID),
          { expiredFunnelSetupV2DoneAt: serverTimestamp() },
          { merge: true }
        );

```

- [ ] **Step 3: Renovações**

No IIFE do funil de renovações, trocar tudo entre o `try {` e o `setRenewalFunnelStatus('done');` por:

```js
        // Academia congelada no início (ver funnelSetupWrites.js).
        const tenant = appId;
        // Snapshot fresco por getDocs (não o prop): elimina a corrida com a
        // assinatura ao vivo ainda vazia no boot.
        const funnelsSnap = await getDocs(tenantCol(tenant, FUNNELS_PATH));
        const plan = planRenewalSetupOps({
          funnels: funnelsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        });

        // Id fixo no funil: duas abas gravam o mesmo doc.
        await writeSetupPlan(tenant, plan);

        await setDoc(
          tenantDoc(tenant, CONFIG_PATH, CONFIG_GENERAL_ID),
          { renewalFunnelSetupDoneAt: serverTimestamp() },
          { merge: true }
        );

```

- [ ] **Step 4: Upgrade**

No IIFE do funil de upgrade, trocar tudo entre o `try {` e o `setUpgradeFunnelStatus('done');` por:

```js
        // Academia congelada no início (ver funnelSetupWrites.js).
        const tenant = appId;
        // Snapshots frescos por getDocs (não os props): elimina a corrida com
        // as assinaturas ao vivo ainda vazias no boot.
        const [funnelsSnap, statusesSnap] = await Promise.all([
          getDocs(tenantCol(tenant, FUNNELS_PATH)),
          getDocs(tenantCol(tenant, STATUSES_PATH))
        ]);
        const plan = planUpgradeSetupOps({
          funnels: funnelsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          statuses: statusesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        });

        // Id fixo no funil e na entrada: duas abas gravam o mesmo doc.
        await writeSetupPlan(tenant, plan);

        await setDoc(
          tenantDoc(tenant, CONFIG_PATH, CONFIG_GENERAL_ID),
          { upgradeFunnelSetupDoneAt: serverTimestamp() },
          { merge: true }
        );

```

- [ ] **Step 5: Tirar o `addDoc` do import**

Run: `grep -n "addDoc" src/App.jsx`
Expected: só a linha do import (`  addDoc,`). Apagar essa linha do bloco `import { ... } from 'firebase/firestore';`.

- [ ] **Step 6: Conferir que nenhuma configuração lê o appId vivo**

Run: `awk '/Migração idempotente: cria funil "Comercial"/,/}, \[appUser, loadingData, renewalFunnelStatus, upgradeFunnelStatus, upgradeSetupDone\]\);/' src/App.jsx | grep -n "appId"`
Expected: exatamente cinco linhas, todas `const tenant = appId;`.

- [ ] **Step 7: Lint, testes e build**

Run: `npm run lint && npx vitest run && npm run build`
Expected: lint com 0 erros (o aviso antigo continua); todos os testes verdes (1675 da base + 3 da Task 1 + 112 do `funnelSetup.test.js`, já com o teste de convergência reforçado na revisão = 1790); build termina sem erro.

- [ ] **Step 8: Commit das Tasks 7 e 8**

```bash
git add src/App.jsx
git commit -m "fix(funis): configuração do primeiro login grava com id fixo

As cinco configurações de funil (padrão, Indicações, Vencidos,
Renovações e Upgrade) passam a gravar com id fixo, só criando. Duas
abas, dois computadores ou dois gestores rodando juntos caem no mesmo
documento. Cada execução congela a academia no início, e a Negociação
deixa de entrar em funil de sistema.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Documentação e entrega

**Files:**
- Modify: `CLAUDE.md` (seção "Convenções gerais")

- [ ] **Step 1: Duas regras no `CLAUDE.md` do Stronilead**

No fim da lista de "## Convenções gerais" (depois do item da Meta Diária em `src/lib/dailyGoal.js`), acrescentar:

```markdown
- A configuração de funis do primeiro login de gestor (`App.jsx`) grava com id fixo (`src/lib/funnelSetup.js`, gravação em `src/lib/funnelSetupWrites.js`). Assim duas abas, dois computadores ou dois gestores rodando juntos caem no mesmo documento e não duplicam funil nem etapa. Não voltar a usar `addDoc` ali e nunca mudar um id já publicado, porque isso cria um segundo funil em toda academia. Cada execução congela a academia no início.
- O login com "Manter conectado" grava a sessão no IndexedDB (`persistenceFor`, em `src/lib/firebase.js`), o mesmo lugar que o `getAuth` vigia. Quando gravava no localStorage, abrir uma segunda aba deslogava a primeira. O `getAuth` não muda: é ele que migra quem já está logado.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: regras dos funis com id fixo e da sessão no IndexedDB

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Verificação final**

Run: `npm run lint && npx vitest run && npm run build && npm run verificar:sentry`
Expected: tudo verde. Copie a contagem de testes para a descrição do PR.

- [ ] **Step 4: Push e PR**

```bash
git push -u origin claude/rotas-pr1-varias-abas
gh pr create --base main --title "Várias abas sem susto: login e funis" --body "$(cat <<'EOF'
Primeiro PR do endereço por tela (spec em `docs/superpowers/specs/2026-09-21-endereco-por-tela-design.md`). Não mexe em tela.

## O que muda
- Abrir uma segunda aba deixa de deslogar a primeira. O login com "Manter conectado" grava a sessão no IndexedDB, o mesmo lugar que o `getAuth` vigia. Antes gravava no localStorage, a aba nova movia a sessão e a primeira aba caía para o login (conferido no `@firebase/auth` 1.12.2).
- A configuração de funis do primeiro login de gestor grava com id fixo. Duas abas, dois computadores ou dois gestores rodando juntos caem no mesmo documento. Cada execução congela a academia no início, e a Negociação deixa de entrar em funil de sistema.
- Nenhuma regra do Firestore nova. Nenhuma academia existente roda configuração por causa deste PR (as flags já estão carimbadas).

## Testes
- `authPersistence.test.js` e `funnelSetup.test.js`, incluindo a convergência de duas abas em todos os pontos de corrida dos quatro funis de sistema e do funil padrão.

## Para conferir no preview antes do merge
- [ ] Entrar com "Manter conectado", abrir uma segunda aba, voltar à primeira: continua logada.
- [ ] Entrar sem "Manter conectado": a aba nova pede login e a primeira continua logada.
- [ ] Sair numa aba: a outra cai no login.
- [ ] Um navegador logado em produção antes do deploy continua logado depois do F5.
- [ ] Academia de teste: apagar `upgradeFunnelSetupDoneAt` do `stronix_config/general`, apagar o funil Upgrade e a etapa dele, abrir três abas juntas como gestor: sobra um funil `funil-sistema-upgrade` com uma etapa `funil-sistema-upgrade--entrada`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: o `gh` imprime o link do PR.

- [ ] **Step 5: Depois do merge (Johnny)**

- Acrescentar uma linha na tabela "Últimas Atualizações" do `CLAUDE.md` raiz do STRONIX-FIRMA.
- Pedir um F5 geral para a equipe: abas abertas antes do deploy rodam o código antigo até o F5.
