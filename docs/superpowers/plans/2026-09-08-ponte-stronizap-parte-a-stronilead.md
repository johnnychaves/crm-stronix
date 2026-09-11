# Ponte Stronizap — Parte A, lado Stronilead

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expor `GET /api/zap`, que devolve o cartão de contexto de um lead ou cliente a partir de um telefone, autenticado por uma chave que o admin gera na tela de Configurações.

**Architecture:** Toda a regra vive em módulos puros sob `api/_zap*.js`, testados com vitest e sem dependência de Firebase ou de React. O handler `api/zap.js` é fino: valida a chave, resolve o tenant, lê o lead no Firestore e delega a montagem do cartão. Nada é recalculado que o CRM já saiba: os gatilhos da faixa vêm de `contracts.js`, `renewalGoal.js` e da regra do freepass.

**Tech Stack:** Node 20 (Vercel serverless), Firebase Admin SDK, vitest, React 19 + Tailwind v4 no front.

---

## Contexto que o implementador precisa antes de começar

**Spec:** `docs/superpowers/specs/2026-09-08-ponte-stronizap-design.md`. Leia as seções "Contrato" e "Interface" antes da Task 6.

**Limite de funções da Vercel.** O plano Hobby permite 12 funções e `api/` está com exatamente 12. A Task 5 consolida três em uma antes da Task 6 criar a nova. **Não pule a Task 5**, ou o deploy falha.

**Módulos de `src/lib/` que a função serverless PODE importar:** `contracts.js`, `renewalGoal.js`, `expiredGoal.js`, `leads.js`, `dates.js`, `globalSearch.js`, `format.js`, `referrals.js`. Todos são puros.

**Módulo que ela NÃO PODE importar:** `src/lib/dailyGoal.js`. Ele importa `lucide-react` na primeira linha e quebra em runtime de servidor. Os gatilhos da faixa são derivados dos módulos puros acima, nunca dele.

**Testes:** vitest já está configurado (`npm test` → `vitest run`). Não há bloco `test` em `vite.config.js`, então valem os defaults e testes em `api/__tests__/` são coletados normalmente.

**Convenção do repositório:** trabalho sempre via PR, nunca commit direto na `main`. Arquivos em `api/` com prefixo `_` não viram rota, é assim que `_firebaseAdmin.js` funciona hoje.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `api/_zapAuth.js` | Gerar, hashear e verificar a chave de integração. Sem I/O. |
| `api/_zapPhone.js` | Reduzir um telefone em qualquer formato à chave de casamento. Sem I/O. |
| `api/_zapStrip.js` | Decidir se há faixa e qual, a partir do lead. Sem I/O. |
| `api/_zapCard.js` | Montar o cartão de contexto. Sem I/O. |
| `api/zap.js` | Handler HTTP. Valida chave, resolve tenant, lê Firestore, delega. |
| `api/admin-users.js` | Consolidação dos três endpoints de admin. |
| `src/lib/zapIntegration.js` | Estado da integração para a tela de Configurações. |
| `src/views/settings/ZapIntegrationSection.jsx` | Tela de gerar e revogar a chave. |

Cada `_zap*.js` tem um teste irmão em `api/__tests__/`.

---

## Task 1: Chave de integração

**Files:**
- Create: `api/_zapAuth.js`
- Test: `api/__tests__/zapAuth.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Crie `api/__tests__/zapAuth.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { generateZapKey, hashZapKey, verifyZapKey } from '../_zapAuth.js';

describe('generateZapKey', () => {
  it('gera chave com prefixo szk_ e 52 caracteres', () => {
    const { key } = generateZapKey();
    expect(key.startsWith('szk_')).toBe(true);
    expect(key).toHaveLength(52);
  });

  it('devolve o prefixo visível com 12 caracteres', () => {
    const { key, keyPrefix } = generateZapKey();
    expect(keyPrefix).toBe(key.slice(0, 12));
    expect(keyPrefix).toHaveLength(12);
  });

  it('devolve o hash correspondente à chave', () => {
    const { key, keyHash } = generateZapKey();
    expect(keyHash).toBe(hashZapKey(key));
    expect(keyHash).toHaveLength(64);
  });

  it('nunca repete a mesma chave', () => {
    expect(generateZapKey().key).not.toBe(generateZapKey().key);
  });
});

describe('verifyZapKey', () => {
  it('aceita a chave certa', () => {
    const { key, keyHash } = generateZapKey();
    expect(verifyZapKey(key, keyHash)).toBe(true);
  });

  it('recusa chave errada', () => {
    const { keyHash } = generateZapKey();
    expect(verifyZapKey('szk_naoehessa', keyHash)).toBe(false);
  });

  it('recusa quando falta chave ou hash', () => {
    const { key, keyHash } = generateZapKey();
    expect(verifyZapKey(null, keyHash)).toBe(false);
    expect(verifyZapKey(key, null)).toBe(false);
    expect(verifyZapKey(key, 'hash-curto')).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Rode: `npm test -- api/__tests__/zapAuth.test.js`
Esperado: FAIL com `Failed to load url ../_zapAuth.js`.

- [ ] **Step 3: Implementar**

Crie `api/_zapAuth.js`:

```js
// Chave de integração do Stronizap. Emitida pelo Stronilead, porque o CRM é
// dono da identidade do tenant. Guardada aqui só como hash: o valor em claro
// aparece uma vez na tela e nunca mais.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const PREFIX = 'szk_';
const SECRET_BYTES = 24; // 48 chars em hex + 4 do prefixo = 52

export function hashZapKey(key) {
  return createHash('sha256').update(String(key ?? ''), 'utf8').digest('hex');
}

export function generateZapKey() {
  const key = `${PREFIX}${randomBytes(SECRET_BYTES).toString('hex')}`;
  return { key, keyPrefix: key.slice(0, 12), keyHash: hashZapKey(key) };
}

// Comparação em tempo constante, no mesmo espírito do verifyWebhookToken que o
// Stronizap já usa no webhook do Asaas.
export function verifyZapKey(key, storedHash) {
  if (typeof key !== 'string' || typeof storedHash !== 'string') return false;
  if (storedHash.length !== 64) return false;
  const a = Buffer.from(hashZapKey(key), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Rodar para confirmar que passa**

Rode: `npm test -- api/__tests__/zapAuth.test.js`
Esperado: PASS, 7 testes.

- [ ] **Step 5: Commit**

```bash
git add api/_zapAuth.js api/__tests__/zapAuth.test.js
git commit -m "feat(zap): chave de integração com hash e comparação em tempo constante"
```

---

## Task 2: Chave de casamento de telefone

O Stronilead guarda `lead.whatsapp` com até 11 dígitos e sem DDI. O Stronizap guarda o identificador do JID, com 55 na frente, e o nono dígito existe em número novo e não existe em número antigo. Os últimos 8 dígitos são a única parte estável entre os dois.

**Files:**
- Create: `api/_zapPhone.js`
- Test: `api/__tests__/zapPhone.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Crie `api/__tests__/zapPhone.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { zapMatchKey } from '../_zapPhone.js';

describe('zapMatchKey', () => {
  it('reduz número com DDI e nono dígito', () => {
    expect(zapMatchKey('5551999998888')).toBe('5199998888');
  });

  it('reduz número com DDI e sem nono dígito ao mesmo valor', () => {
    expect(zapMatchKey('555199998888')).toBe('5199998888');
  });

  it('reduz número sem DDI', () => {
    expect(zapMatchKey('51999998888')).toBe('5199998888');
  });

  it('ignora máscara', () => {
    expect(zapMatchKey('(51) 9 9999-8888')).toBe('5199998888');
  });

  it('não confunde DDD 55 com DDI 55', () => {
    // Santa Maria/RS: 10 dígitos começando com 55, mas é DDD, não país.
    expect(zapMatchKey('5599998888')).toBe('5599998888');
  });

  it('devolve null para entrada vazia ou curta demais', () => {
    expect(zapMatchKey('')).toBeNull();
    expect(zapMatchKey(null)).toBeNull();
    expect(zapMatchKey('99998888')).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Rode: `npm test -- api/__tests__/zapPhone.test.js`
Esperado: FAIL com `Failed to load url ../_zapPhone.js`.

- [ ] **Step 3: Implementar**

Crie `api/_zapPhone.js`:

```js
// Chave de casamento entre lead.whatsapp (Stronilead) e Contact.phone
// (Stronizap): DDD + os últimos 8 dígitos. Os últimos 8 são idênticos com ou
// sem o nono dígito, então são a única parte estável entre os dois formatos.
const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '');

export function zapMatchKey(raw) {
  let d = onlyDigits(raw);
  // O 55 só é DDI quando sobra número suficiente depois dele. Com 10 dígitos,
  // "55" na frente é o DDD de Santa Maria, não o país.
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length < 10) return null;
  return `${d.slice(0, 2)}${d.slice(-8)}`;
}
```

- [ ] **Step 4: Rodar para confirmar que passa**

Rode: `npm test -- api/__tests__/zapPhone.test.js`
Esperado: PASS, 6 testes.

- [ ] **Step 5: Commit**

```bash
git add api/_zapPhone.js api/__tests__/zapPhone.test.js
git commit -m "feat(zap): chave de casamento de telefone por DDD e últimos 8 dígitos"
```

---

## Task 3: Gatilho da faixa

A faixa aparece só quando há prazo curto. Ordem de precedência: compromisso de hoje ganha de tudo, porque acontece nas próximas horas. Depois contrato vencido, depois freepass, depois marco de renovação.

**Files:**
- Create: `api/_zapStrip.js`
- Test: `api/__tests__/zapStrip.test.js`
- Reference: `src/lib/renewalGoal.js:47` (`daysToExpiryOf`), `src/lib/renewalGoal.js:58` (`activeRenewalCheckpoint`)

- [ ] **Step 1: Conferir as assinaturas que vamos reusar**

Abra `src/lib/renewalGoal.js` e leia `daysToExpiryOf` e `activeRenewalCheckpoint`. Anote o que `activeRenewalCheckpoint` devolve: se for um objeto e não um número, ajuste a extração no Step 3 para usar o campo certo. Não invente o formato.

- [ ] **Step 2: Escrever o teste que falha**

Crie `api/__tests__/zapStrip.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildZapStrip } from '../_zapStrip.js';

const HOJE = new Date(2026, 8, 8, 10, 0); // 08/09/2026 10:00

const cliente = (extra = {}) => ({
  lifecycleStage: 'cliente',
  currentContractStatus: 'ativo',
  currentContractStartsAt: new Date(2025, 8, 8),
  currentContractEndsAt: new Date(2027, 8, 8),
  ...extra
});

describe('buildZapStrip', () => {
  it('não devolve faixa quando não há prazo curto', () => {
    expect(buildZapStrip(cliente(), HOJE)).toBeNull();
  });

  it('devolve visita quando há visita marcada para hoje', () => {
    const lead = { appointmentType: 'Visita', appointmentScheduledFor: new Date(2026, 8, 8, 18, 30) };
    expect(buildZapStrip(lead, HOJE)).toEqual({
      kind: 'visita_hoje', tone: 'agendado', text: 'Visita hoje às 18:30'
    });
  });

  it('devolve aula experimental quando há aula marcada para hoje', () => {
    const lead = { appointmentType: 'Aula', appointmentScheduledFor: new Date(2026, 8, 8, 7, 0) };
    expect(buildZapStrip(lead, HOJE)).toEqual({
      kind: 'aula_hoje', tone: 'agendado', text: 'Aula experimental hoje às 07:00'
    });
  });

  it('ignora compromisso que não é hoje', () => {
    const lead = { appointmentType: 'Visita', appointmentScheduledFor: new Date(2026, 8, 10, 18, 30) };
    expect(buildZapStrip(lead, HOJE)).toBeNull();
  });

  it('devolve contrato vencido com a contagem de dias', () => {
    const lead = cliente({ currentContractEndsAt: new Date(2026, 7, 31) });
    expect(buildZapStrip(lead, HOJE)).toEqual({
      kind: 'vencido', tone: 'vencido', text: 'Contrato vencido há 8 dias'
    });
  });

  it('devolve marco de renovação quando o contrato entra em 30 dias', () => {
    const lead = cliente({ currentContractEndsAt: new Date(2026, 9, 8) }); // 08/10/2026
    expect(buildZapStrip(lead, HOJE)).toEqual({
      kind: 'renovacao', tone: 'avencer', text: 'Marco de renovação · 30 dias'
    });
  });

  it('devolve freepass ativo com a contagem', () => {
    // aula em 07/09 com 3 dias de validade: último dia é 09/09, hoje é 08/09.
    const lead = {
      appointmentType: 'Aula',
      appointmentScheduledFor: new Date(2026, 8, 7, 7, 0),
      trialClassesPlanned: 3
    };
    expect(buildZapStrip(lead, HOJE)).toEqual({
      kind: 'freepass', tone: 'avencer', text: 'Freepass até 09/09 · falta 1 dia'
    });
  });

  it('compromisso de hoje ganha do marco de renovação', () => {
    const lead = cliente({
      currentContractEndsAt: new Date(2026, 9, 8),
      appointmentType: 'Visita',
      appointmentScheduledFor: new Date(2026, 8, 8, 9, 0)
    });
    expect(buildZapStrip(lead, HOJE).kind).toBe('visita_hoje');
  });
});
```

- [ ] **Step 3: Rodar para confirmar que falha**

Rode: `npm test -- api/__tests__/zapStrip.test.js`
Esperado: FAIL com `Failed to load url ../_zapStrip.js`.

- [ ] **Step 4: Implementar**

Crie `api/_zapStrip.js`:

```js
// Decide se o cartão mostra faixa de destaque e qual. A faixa só aparece
// quando há prazo curto: destaque permanente vira paisagem e a pessoa para de
// enxergar.
//
// NUNCA importe src/lib/dailyGoal.js aqui — ele traz lucide-react e quebra no
// servidor. Os gatilhos são derivados dos módulos puros.
import { deriveLeadContractStatus, CONTRACT_STATUS } from '../src/lib/contracts.js';
import { DEFAULT_RENEWAL_CHECKPOINTS, daysToExpiryOf, activeRenewalCheckpoint } from '../src/lib/renewalGoal.js';
import { getLeadAppointmentType, getLeadAppointmentDate } from '../src/lib/leads.js';
import { getSafeDateOrNull } from '../src/lib/dates.js';

const DAY_MS = 86400000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const isSameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();
const pad = (n) => String(n).padStart(2, '0');
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const ddmm = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
const contagem = (n) => (n === 1 ? 'falta 1 dia' : `faltam ${n} dias`);

// Espelha passDaysLeft de src/lib/freePass.js: a quantidade configurada é a
// validade em DIAS a partir da aula marcada, e o último dia válido é
// data + (N-1). Mantido aqui em vez de importar porque freePass.js não exporta
// a conta crua, só isPassActive e getTrialPassNote.
function freepassInfo(lead, now) {
  const total = Number(lead?.trialClassesPlanned);
  if (!Number.isFinite(total) || total <= 0) return null;
  const marcada = getLeadAppointmentDate(lead);
  if (!marcada) return null;
  const fim = new Date(startOfDay(marcada).getTime() + (total - 1) * DAY_MS);
  const daysLeft = Math.round((fim.getTime() - startOfDay(now).getTime()) / DAY_MS);
  return { daysLeft, fim };
}

export function buildZapStrip(lead, now = new Date(), checkpoints = DEFAULT_RENEWAL_CHECKPOINTS) {
  if (!lead) return null;

  // 1. Compromisso de hoje ganha de tudo.
  const tipo = getLeadAppointmentType(lead);
  const quando = getLeadAppointmentDate(lead);
  if (tipo && quando && isSameDay(quando, now)) {
    const eAula = String(tipo).toLowerCase().startsWith('aula');
    return {
      kind: eAula ? 'aula_hoje' : 'visita_hoje',
      tone: 'agendado',
      text: `${eAula ? 'Aula experimental' : 'Visita'} hoje às ${hhmm(quando)}`
    };
  }

  const status = deriveLeadContractStatus(lead, now);
  const fim = getSafeDateOrNull(lead?.currentContractEndsAt);

  // 2. Contrato vencido.
  if (status === CONTRACT_STATUS.VENCIDO && fim) {
    const ha = Math.round((startOfDay(now).getTime() - startOfDay(fim).getTime()) / DAY_MS);
    return {
      kind: 'vencido',
      tone: 'vencido',
      text: ha === 1 ? 'Contrato vencido há 1 dia' : `Contrato vencido há ${ha} dias`
    };
  }

  // 3. Freepass ainda válido. Tom segue getTrialPassNote: âmbar com 2 dias ou
  // menos, neutro acima disso (o passe está válido, não é alerta).
  const passe = freepassInfo(lead, now);
  if (passe && passe.daysLeft >= 0) {
    return {
      kind: 'freepass',
      tone: passe.daysLeft <= 2 ? 'avencer' : 'neutro',
      text: passe.daysLeft === 0
        ? 'Freepass termina hoje'
        : `Freepass até ${ddmm(passe.fim)} · ${contagem(passe.daysLeft)}`
    };
  }

  // 4. Marco de renovação (90, 60, 30 por padrão).
  if (status === CONTRACT_STATUS.A_VENCER && fim) {
    const marco = activeRenewalCheckpoint(daysToExpiryOf(fim, now), checkpoints);
    if (marco != null) {
      return { kind: 'renovacao', tone: 'avencer', text: `Marco de renovação · ${marco} dias` };
    }
  }

  return null;
}
```

- [ ] **Step 5: Rodar para confirmar que passa**

Rode: `npm test -- api/__tests__/zapStrip.test.js`
Esperado: PASS, 8 testes.

- [ ] **Step 6: Commit**

```bash
git add api/_zapStrip.js api/__tests__/zapStrip.test.js
git commit -m "feat(zap): gatilho da faixa a partir dos módulos puros do CRM"
```

---

## Task 4: Montagem do cartão

**Files:**
- Create: `api/_zapCard.js`
- Test: `api/__tests__/zapCard.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Crie `api/__tests__/zapCard.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildZapCard } from '../_zapCard.js';

const HOJE = new Date(2026, 8, 8, 10, 0);

describe('buildZapCard', () => {
  it('monta o cartão de um cliente com contrato ativo', () => {
    const lead = {
      id: 'abc123',
      name: 'Maria Eduarda Ramos',
      lifecycleStage: 'cliente',
      consultantName: 'Ana Beatriz',
      currentPlanName: 'Musculação Anual',
      currentContractStatus: 'ativo',
      currentContractStartsAt: new Date(2025, 10, 12),
      currentContractEndsAt: new Date(2026, 10, 12),
      lastInteractionAt: new Date(2026, 8, 7, 14, 22)
    };
    expect(buildZapCard(lead, HOJE)).toMatchObject({
      found: true,
      leadId: 'abc123',
      kind: 'cliente',
      name: 'Maria Eduarda Ramos',
      consultantName: 'Ana Beatriz',
      planName: 'Musculação Anual',
      contractStatus: 'ativo',
      daysLeft: 65,
      strip: null
    });
  });

  it('monta o cartão de um lead com fase e agendamento', () => {
    const lead = {
      id: 'lead9',
      name: 'Camila Prado',
      lifecycleStage: 'lead',
      status: 'Negociação',
      source: 'Instagram',
      consultantName: 'Diego Martins',
      appointmentType: 'Visita',
      appointmentScheduledFor: new Date(2026, 8, 8, 18, 30)
    };
    const card = buildZapCard(lead, HOJE);
    expect(card).toMatchObject({
      found: true,
      kind: 'lead',
      stage: 'Negociação',
      source: 'Instagram',
      strip: { kind: 'visita_hoje', tone: 'agendado', text: 'Visita hoje às 18:30' }
    });
    expect(card.appointment.type).toBe('Visita');
  });

  it('nunca expõe dado sensível', () => {
    const lead = {
      id: 'x', name: 'Fulano', lifecycleStage: 'cliente',
      cpf: '00000000000', address: 'Rua X, 123',
      currentContractValue: 149900, paymentStatus: 'OVERDUE'
    };
    const card = buildZapCard(lead, HOJE);
    const chaves = Object.keys(card);
    expect(chaves).not.toContain('cpf');
    expect(chaves).not.toContain('address');
    expect(chaves).not.toContain('currentContractValue');
    expect(chaves).not.toContain('paymentStatus');
    expect(JSON.stringify(card)).not.toContain('149900');
    expect(JSON.stringify(card)).not.toContain('00000000000');
  });

  it('devolve não encontrado quando não há lead', () => {
    expect(buildZapCard(null, HOJE)).toEqual({ found: false });
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Rode: `npm test -- api/__tests__/zapCard.test.js`
Esperado: FAIL com `Failed to load url ../_zapCard.js`.

- [ ] **Step 3: Implementar**

Crie `api/_zapCard.js`:

```js
// Monta o cartão de contexto que o Stronizap exibe. A lista de campos é
// FECHADA de propósito: nada entra por espalhamento do documento do lead, pra
// não vazar CPF, endereço, valor de contrato ou situação de pagamento numa
// tela de chat. Ver a seção "Interface" da spec.
import { deriveLeadContractStatus } from '../src/lib/contracts.js';
import { getLeadAppointmentType, getLeadAppointmentDate } from '../src/lib/leads.js';
import { getSafeDateOrNull } from '../src/lib/dates.js';
import { buildZapStrip } from './_zapStrip.js';

const DAY_MS = 86400000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const iso = (d) => (d ? d.toISOString() : null);

export function buildZapCard(lead, now = new Date()) {
  if (!lead) return { found: false };

  const eCliente = lead.lifecycleStage === 'cliente';
  const fim = getSafeDateOrNull(lead.currentContractEndsAt);
  const tipo = getLeadAppointmentType(lead);
  const quando = getLeadAppointmentDate(lead);

  const card = {
    found: true,
    leadId: lead.id ?? null,
    kind: eCliente ? 'cliente' : 'lead',
    name: lead.name ?? null,
    consultantName: lead.consultantName ?? null,
    lastInteractionAt: iso(getSafeDateOrNull(lead.lastInteractionAt)),
    appointment: tipo && quando ? { type: tipo, at: iso(quando) } : null,
    strip: buildZapStrip(lead, now)
  };

  if (eCliente) {
    card.planName = lead.currentPlanName ?? null;
    card.contractStatus = deriveLeadContractStatus(lead, now);
    card.contractEndsAt = iso(fim);
    card.daysLeft = fim
      ? Math.round((startOfDay(fim).getTime() - startOfDay(now).getTime()) / DAY_MS)
      : null;
  } else {
    card.stage = lead.status ?? null;
    card.source = lead.source ?? null;
  }

  return card;
}
```

- [ ] **Step 4: Rodar para confirmar que passa**

Rode: `npm test -- api/__tests__/zapCard.test.js`
Esperado: PASS, 4 testes.

- [ ] **Step 5: Commit**

```bash
git add api/_zapCard.js api/__tests__/zapCard.test.js
git commit -m "feat(zap): montagem do cartão com lista fechada de campos"
```

---

## Task 5: Liberar slot na Vercel

`api/` está com 12 funções, o teto do plano Hobby. **Sem esta task, a Task 6 não faz deploy.**

**Files:**
- Create: `api/admin-users.js`
- Delete: `api/admin-create-user.js`, `api/admin-set-password.js`, `api/admin-delete-user.js`
- Modify: os call sites em `src/`

- [ ] **Step 1: Achar os call sites**

```bash
grep -rn "admin-create-user\|admin-set-password\|admin-delete-user" src/
```

Anote cada arquivo e linha. Todos mudam de URL no Step 4.

- [ ] **Step 2: Criar o handler consolidado**

Crie `api/admin-users.js`. A ação vem em `req.body.action`:

```js
// Consolidação de admin-create-user, admin-set-password e admin-delete-user.
// Motivo: o plano Hobby da Vercel permite 12 funções e api/ estava no teto.
// Cada bloco abaixo é o corpo do handler original, sem mudança de regra.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }
  const { action } = req.body ?? {};
  switch (action) {
    case 'create': return handleCreate(req, res);
    case 'set-password': return handleSetPassword(req, res);
    case 'delete': return handleDelete(req, res);
    default:
      res.status(400).json({ error: 'Ação inválida' });
  }
}
```

Copie o corpo de cada arquivo antigo para `handleCreate`, `handleSetPassword` e `handleDelete`, junto com os imports que cada um usava. Preserve validação, verificação de papel e mensagens de erro exatamente como estão. Não reescreva regra nesta task.

- [ ] **Step 3: Apagar os três antigos**

```bash
git rm api/admin-create-user.js api/admin-set-password.js api/admin-delete-user.js
```

- [ ] **Step 4: Atualizar os call sites**

Em cada arquivo do Step 1, troque a URL e acrescente a ação:

```js
// antes
await fetch('/api/admin-create-user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ email, name, role })
});

// depois
await fetch('/api/admin-users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ action: 'create', email, name, role })
});
```

Mesmo padrão para `set-password` e `delete`.

- [ ] **Step 5: Verificar**

```bash
find api -maxdepth 2 -name "*.js" ! -name "_*" ! -path "*__tests__*" | wc -l
```
Esperado: `10`.

```bash
grep -rn "admin-create-user\|admin-set-password\|admin-delete-user" src/ api/ || echo "nenhuma referência sobrou"
```
Esperado: `nenhuma referência sobrou`.

```bash
npm run lint && npm test
```
Esperado: sem erro.

- [ ] **Step 6: Commit**

```bash
git add -A api/ src/
git commit -m "refactor(api): consolida os três endpoints de admin em admin-users"
```

---

## Task 6: Handler GET /api/zap

**Files:**
- Create: `api/zap.js`
- Modify: `src/lib/leadDerived.js`
- Modify: `firestore.indexes.json`
- Create: `scripts/backfill-zap-match-key.js`
- Reference: `api/_firebaseAdmin.js`, `api/tenant-resolve.js`

- [ ] **Step 1: Ler os padrões existentes**

Abra `api/_firebaseAdmin.js` e `api/tenant-resolve.js`. Anote como o Admin SDK é inicializado e como o documento do tenant é lido. Reuse, não recrie.

- [ ] **Step 2: Gravar `zapMatchKey` na escrita do lead**

A consulta do handler depende de um campo indexado. Em `src/lib/leadDerived.js`, acrescente a chave em `buildLeadSearchFields`, que já roda em toda escrita de lead:

```js
import { zapMatchKey } from '../../api/_zapPhone.js';

export const buildLeadSearchFields = ({ name, whatsapp, cpf } = {}) => {
  // ... tudo que já existe permanece igual
  return {
    // ... campos existentes
    zapMatchKey: zapMatchKey(whatsapp)
  };
};
```

Acrescente o índice em `firestore.indexes.json`:

```json
{
  "collectionGroup": "leads",
  "queryScope": "COLLECTION",
  "fields": [{ "fieldPath": "zapMatchKey", "order": "ASCENDING" }]
}
```

- [ ] **Step 3: Escrever o backfill**

Crie `scripts/backfill-zap-match-key.js` seguindo a estrutura de `scripts/backfill-tenant-claims.js`: recebe o slug do tenant por argumento, varre `artifacts/{tenant}/public/data/leads` em lotes de 400, calcula `zapMatchKey(lead.whatsapp)` e grava com `writeBatch`. Pule documentos onde a chave dá `null` ou já está igual.

- [ ] **Step 4: Implementar o handler**

Crie `api/zap.js`:

```js
// Ponte com o Stronizap. Um sentido só nesta Parte A: o Zap pergunta quem é a
// pessoa por trás de um telefone e recebe o cartão de contexto.
//
// Autenticação por chave emitida no Stronilead (Configurações → Integrações),
// guardada aqui só como hash em tenants/{id}.integrations.zap.keyHash.
import { db } from './_firebaseAdmin.js';
import { verifyZapKey } from './_zapAuth.js';
import { zapMatchKey } from './_zapPhone.js';
import { buildZapCard } from './_zapCard.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const chave = req.headers['x-stronizap-key'];
  const tenantId = String(req.query.tenant ?? '').trim();
  const matchKey = zapMatchKey(req.query.phone);

  if (!chave || !tenantId) {
    res.status(401).json({ error: 'Credencial ausente' });
    return;
  }
  if (!matchKey) {
    res.status(400).json({ error: 'Telefone inválido' });
    return;
  }

  const tenantSnap = await db.collection('tenants').doc(tenantId).get();
  // Tenant inexistente responde igual a chave errada: não confirmamos quais
  // academias existem para quem não tem credencial.
  const zap = tenantSnap.exists ? tenantSnap.data()?.integrations?.zap : null;
  if (!zap?.keyHash || zap.revokedAt || !verifyZapKey(chave, zap.keyHash)) {
    res.status(401).json({ error: 'Credencial inválida' });
    return;
  }

  const leadsRef = db.collection('artifacts').doc(tenantId)
    .collection('public').doc('data').collection('leads');
  const achados = await leadsRef.where('zapMatchKey', '==', matchKey).limit(1).get();

  if (achados.empty) {
    res.status(200).json({ found: false });
    return;
  }

  const doc = achados.docs[0];
  const lead = { id: doc.id, ...doc.data() };
  // Firestore devolve Timestamp; os módulos puros esperam Date.
  for (const campo of [
    'currentContractStartsAt', 'currentContractEndsAt',
    'appointmentScheduledFor', 'nextFollowUp', 'lastInteractionAt'
  ]) {
    if (lead[campo]?.toDate) lead[campo] = lead[campo].toDate();
  }

  res.setHeader('Cache-Control', 'private, max-age=120');
  res.status(200).json(buildZapCard(lead, new Date()));
}
```

- [ ] **Step 5: Testar contra o ambiente local**

```bash
vercel dev
```

Semeie um `keyHash` à mão no documento do tenant (use `hashZapKey` no console do Node para gerar o hash de uma chave de teste). Depois:

```bash
curl -i "http://localhost:3000/api/zap?tenant=stronix-crm-app&phone=5551999998888" \
  -H "x-stronizap-key: szk_a-chave-de-teste"
```

Esperado: `200` com o JSON do cartão.
Sem o header: `401`.
Com `phone=999`: `400`.
Com telefone que não existe na base: `200` com `{"found":false}`.

- [ ] **Step 6: Commit**

```bash
git add api/zap.js src/lib/leadDerived.js firestore.indexes.json scripts/backfill-zap-match-key.js
git commit -m "feat(zap): GET /api/zap devolve o cartão de contexto por telefone"
```

---

## Task 7: Tela de Integrações

**Files:**
- Create: `src/lib/zapIntegration.js`
- Create: `src/views/settings/ZapIntegrationSection.jsx`
- Modify: `api/zap.js` — acrescentar `POST`
- Modify: a view de Configurações, para montar a seção
- Test: `src/lib/__tests__/zapIntegration.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/lib/__tests__/zapIntegration.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { zapIntegrationState, ZAP_STATE } from '../zapIntegration.js';

describe('zapIntegrationState', () => {
  it('sem configuração é desconectado', () => {
    expect(zapIntegrationState(undefined)).toBe(ZAP_STATE.DESCONECTADO);
    expect(zapIntegrationState({})).toBe(ZAP_STATE.DESCONECTADO);
  });

  it('com chave válida é conectado', () => {
    expect(zapIntegrationState({ keyHash: 'a'.repeat(64), keyPrefix: 'szk_abc123' }))
      .toBe(ZAP_STATE.CONECTADO);
  });

  it('com chave revogada é revogado', () => {
    expect(zapIntegrationState({ keyHash: 'a'.repeat(64), revokedAt: new Date() }))
      .toBe(ZAP_STATE.REVOGADO);
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Rode: `npm test -- src/lib/__tests__/zapIntegration.test.js`
Esperado: FAIL com `Failed to load url ../zapIntegration.js`.

- [ ] **Step 3: Implementar o estado**

Crie `src/lib/zapIntegration.js`:

```js
// Estado da integração com o Stronizap, para a tela de Configurações.
// O valor da chave em claro nunca chega aqui: o front só conhece o prefixo.
export const ZAP_STATE = {
  DESCONECTADO: 'desconectado',
  CONECTADO: 'conectado',
  REVOGADO: 'revogado'
};

export const ZAP_STATE_LABEL = {
  desconectado: 'Não conectado',
  conectado: 'Conectado',
  revogado: 'Chave revogada'
};

export function zapIntegrationState(zap) {
  if (!zap?.keyHash) return ZAP_STATE.DESCONECTADO;
  if (zap.revokedAt) return ZAP_STATE.REVOGADO;
  return ZAP_STATE.CONECTADO;
}
```

- [ ] **Step 4: Rodar para confirmar que passa**

Rode: `npm test -- src/lib/__tests__/zapIntegration.test.js`
Esperado: PASS, 3 testes.

- [ ] **Step 5: Acrescentar POST ao handler**

Em `api/zap.js`, acrescente os imports e a função, e roteie no topo do `handler` com `if (req.method === 'POST') return handlePost(req, res);`

```js
import { verifyRequest } from './_firebaseAdmin.js';
import { generateZapKey } from './_zapAuth.js';
import { FieldValue } from 'firebase-admin/firestore';

async function handlePost(req, res) {
  const user = await verifyRequest(req); // 401 se o token não valer
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Só o admin da academia pode alterar a integração' });
    return;
  }
  const tenantRef = db.collection('tenants').doc(user.tenantId);
  const { action } = req.body ?? {};

  if (action === 'generate') {
    const { key, keyPrefix, keyHash } = generateZapKey();
    await tenantRef.set({
      integrations: {
        zap: {
          keyHash, keyPrefix, revokedAt: null,
          createdAt: FieldValue.serverTimestamp(),
          createdBy: user.uid
        }
      }
    }, { merge: true });
    // Única vez que a chave em claro sai daqui.
    res.status(200).json({ key, keyPrefix });
    return;
  }

  if (action === 'revoke') {
    await tenantRef.set({
      integrations: { zap: { revokedAt: FieldValue.serverTimestamp() } }
    }, { merge: true });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(400).json({ error: 'Ação inválida' });
}
```

Confira em `api/_firebaseAdmin.js` o que `verifyRequest` devolve e ajuste os nomes de `role`, `tenantId` e `uid` para os campos reais.

- [ ] **Step 6: Construir a tela**

Crie `src/views/settings/ZapIntegrationSection.jsx`. Abra uma seção vizinha de Configurações e copie a estrutura. Comportamento exigido:

- Mostrar o estado com `ZAP_STATE_LABEL` e o `keyPrefix` quando conectado.
- Botão "Gerar chave" chama `POST /api/zap` com `{ action: 'generate' }`.
- A chave em claro aparece **uma vez**, num bloco com botão de copiar e o aviso: "Copie agora. Ela não será mostrada de novo."
- Botão "Revogar" pede confirmação antes de chamar `{ action: 'revoke' }`.
- Mostrar o endereço que o Stronizap precisa: `https://crm-stronix.vercel.app/api/zap`.
- Primitivo novo (o diálogo de confirmação) vem do shadcn, conforme o `CLAUDE.md`.

- [ ] **Step 7: Verificar na tela**

```bash
npm run dev
```

Logado como admin, vá em Configurações → Integrações. Gere a chave, confirme que ela aparece uma vez, recarregue e confirme que só o prefixo permanece. Revogue e confirme que o estado muda. Confirme que um consultor não vê a seção.

- [ ] **Step 8: Commit**

```bash
git add src/lib/zapIntegration.js src/lib/__tests__/zapIntegration.test.js src/views/settings/ZapIntegrationSection.jsx api/zap.js
git commit -m "feat(zap): tela de integração com geração e revogação de chave"
```

---

## Task 8: Fechamento

- [ ] **Step 1: Suíte inteira**

```bash
npm test && npm run lint && npm run build
```
Esperado: tudo verde.

- [ ] **Step 2: Contagem de funções**

```bash
find api -maxdepth 2 -name "*.js" ! -name "_*" ! -path "*__tests__*" | wc -l
```
Esperado: `11`. Sobra uma antes do teto, que é onde o `POST` de eventos da Parte B vai entrar.

- [ ] **Step 3: Publicar regras e índice**

Publique manualmente no console do Firebase o conteúdo de `firestore.rules` e o índice novo de `firestore.indexes.json`. O repositório não publica por CLI.

- [ ] **Step 4: Rodar o backfill em produção**

```bash
node scripts/backfill-zap-match-key.js stronix-crm-app
```

Sem isso, leads antigos não são encontrados pela consulta e o cartão volta `found: false` para gente que está na base.

- [ ] **Step 5: Abrir o PR**

```bash
git push -u origin feat/ponte-stronizap-parte-a
gh pr create --title "feat: ponte Stronizap Parte A — cartão de contexto" \
  --body "Implementa docs/superpowers/plans/2026-09-08-ponte-stronizap-parte-a-stronilead.md"
```

Merge só com aprovação do Johnny.

---

## O que este plano NÃO cobre

**O lado Stronizap.** Consumir o `GET`, guardar a chave cifrada com `lib/crypto.ts`, e a interface: pílula no header, seção no painel do contato, faixa condicionada e anel neutro no avatar. É repositório separado, com deploy próprio, e ganha plano próprio depois que este estiver em produção.

**A Parte B inteira.** Eventos, outbox, interação automática, Meta Diária, fila de contatos a classificar. Ver a spec.
