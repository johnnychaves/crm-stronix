# Histórico de aulas por professor — PR-A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a coleção `stronix_aulas` e escrever nela em paralelo (dual-write) ao agendar, marcar presença e converter, mais o backfill dos dados atuais e a regra do Firestore. O dashboard NÃO muda nesta PR (isso é a PR-B).

**Architecture:** Coleção flat nova `stronix_aulas`; cada aula experimental vira um registro self-contained. O bloco de agendamento do lead continua igual (estado operacional); a coleção é o histórico analítico. Lógica pura em `src/lib/aulas.js` (testada); wrappers Firestore em `src/lib/aulasWrites.js`; integração nos caminhos de escrita existentes. Consultas por campo único (sem índice composto novo).

**Tech Stack:** React 19 + Vite + Firebase/Firestore (SDK web modular) + Vitest. Backfill via firebase-admin (pasta `scripts/`). Spec: `docs/superpowers/specs/2026-07-16-historico-aulas-professor-design.md`.

---

### Task 1: Constante de path + helpers puros (`src/lib/aulas.js`)

**Files:**
- Modify: `src/lib/firebase.js` (bloco de `*_PATH`, ~linhas 63-89)
- Create: `src/lib/aulas.js`
- Test: `src/lib/__tests__/aulas.test.js`

- [ ] **Step 1: Adicionar `AULAS_PATH` em `src/lib/firebase.js`**

Junto das outras constantes (ex.: depois de `CONTRACTS_PATH`):

```js
export const AULAS_PATH = 'stronix_aulas';
```

- [ ] **Step 2: Escrever o teste que falha — `src/lib/__tests__/aulas.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { AULA_STATUS, outcomeToAulaStatus, pickConvertingAula, aulaRecordFields } from '../aulas.js';

describe('outcomeToAulaStatus', () => {
  it('mapeia os desfechos que resolvem a aula', () => {
    expect(outcomeToAulaStatus('attended')).toBe('attended');
    expect(outcomeToAulaStatus('no_show')).toBe('no_show');
    expect(outcomeToAulaStatus('cancelled')).toBe('cancelled');
  });
  it('rescheduled/desconhecido não vira status de aula', () => {
    expect(outcomeToAulaStatus('rescheduled')).toBeNull();
    expect(outcomeToAulaStatus(undefined)).toBeNull();
  });
});

describe('pickConvertingAula', () => {
  const d = (s) => new Date(s);
  it('escolhe a atendida de maior scheduledFor', () => {
    const aulas = [
      { id: 'a', status: 'attended', scheduledFor: d('2026-07-01') },
      { id: 'b', status: 'attended', scheduledFor: d('2026-07-10') },
      { id: 'c', status: 'no_show',  scheduledFor: d('2026-07-20') },
    ];
    expect(pickConvertingAula(aulas).id).toBe('b');
  });
  it('ignora não-atendidas e retorna null se nenhuma foi atendida', () => {
    expect(pickConvertingAula([{ id: 'x', status: 'agendada', scheduledFor: d('2026-07-01') }])).toBeNull();
    expect(pickConvertingAula([])).toBeNull();
    expect(pickConvertingAula(null)).toBeNull();
  });
  it('uma única atendida é a escolhida', () => {
    expect(pickConvertingAula([{ id: 'u', status: 'attended', scheduledFor: d('2026-07-05') }]).id).toBe('u');
  });
});

describe('aulaRecordFields', () => {
  it('preenche defaults e normaliza flags', () => {
    const r = aulaRecordFields({ leadId: 'L1', professorId: 'P1', professorName: 'Ana', modality: 'Musculação', scheduledFor: 'X', status: 'agendada' });
    expect(r).toMatchObject({
      leadId: 'L1', professorId: 'P1', professorName: 'Ana', soloTraining: false,
      modality: 'Musculação', scheduledFor: 'X', status: 'agendada',
      converted: false, convertedAt: null, outcomeAt: null,
    });
  });
  it('sem professor + solo', () => {
    const r = aulaRecordFields({ leadId: 'L1', soloTraining: true, scheduledFor: 'X' });
    expect(r.professorId).toBeNull();
    expect(r.soloTraining).toBe(true);
    expect(r.status).toBe('agendada'); // default
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/aulas.test.js`
Expected: FAIL (`aulas.js` não existe / funções indefinidas).

- [ ] **Step 4: Implementar `src/lib/aulas.js`**

```js
// Helpers do histórico de aulas experimentais (coleção stronix_aulas). Puros
// aqui; a escrita no Firestore fica em aulasWrites.js.
import { getSafeDateOrNull } from './dates.js';

export const AULA_STATUS = { AGENDADA: 'agendada', ATTENDED: 'attended', NO_SHOW: 'no_show', CANCELLED: 'cancelled' };

// Desfecho do agendamento (appointmentOutcome) -> status da aula. 'rescheduled'
// não resolve a aula (o reagendamento move a aula, não a fecha).
export function outcomeToAulaStatus(outcome) {
  if (outcome === 'attended') return AULA_STATUS.ATTENDED;
  if (outcome === 'no_show') return AULA_STATUS.NO_SHOW;
  if (outcome === 'cancelled') return AULA_STATUS.CANCELLED;
  return null;
}

// A aula que leva o crédito da conversão: a atendida de maior scheduledFor.
// null se nenhuma foi atendida.
export function pickConvertingAula(aulas) {
  const attended = (aulas || []).filter((a) => a && a.status === AULA_STATUS.ATTENDED);
  if (!attended.length) return null;
  return attended.reduce((best, a) => {
    const ad = getSafeDateOrNull(a.scheduledFor);
    const bd = getSafeDateOrNull(best.scheduledFor);
    if (!ad) return best;
    if (!bd) return a;
    return ad > bd ? a : best;
  });
}

// Monta os campos de um registro de aula. Puro: recebe valores já resolvidos,
// devolve objeto plano (o caller adiciona createdAt/serverTimestamp e grava).
export function aulaRecordFields({
  leadId, leadName = null, professorId = null, professorName = null, soloTraining = false,
  modality = null, scheduledFor = null, status = AULA_STATUS.AGENDADA, outcomeAt = null,
  converted = false, convertedAt = null,
  consultantId = null, consultantAuthUid = null, consultantName = null,
} = {}) {
  return {
    leadId: leadId || null,
    leadName: leadName || null,
    professorId: professorId || null,
    professorName: professorName || null,
    soloTraining: Boolean(soloTraining),
    modality: modality || null,
    scheduledFor: scheduledFor || null,
    status: status || AULA_STATUS.AGENDADA,
    outcomeAt: outcomeAt || null,
    converted: Boolean(converted),
    convertedAt: convertedAt || null,
    consultantId: consultantId || null,
    consultantAuthUid: consultantAuthUid || null,
    consultantName: consultantName || null,
  };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/aulas.test.js`
Expected: PASS (todos).

- [ ] **Step 6: Commit**

```bash
git add src/lib/firebase.js src/lib/aulas.js src/lib/__tests__/aulas.test.js
git commit -m "feat(aulas): path stronix_aulas + helpers puros (status, pick converting, record)"
```

---

### Task 2: Wrappers Firestore (`src/lib/aulasWrites.js`)

**Files:**
- Create: `src/lib/aulasWrites.js`

Estes tocam Firestore (não têm teste unitário; verificados no preview na Task 8). Consultas por **campo único** (sem índice composto).

- [ ] **Step 1: Implementar `src/lib/aulasWrites.js`**

```js
// Escrita no histórico de aulas (stronix_aulas). Dual-write: chamado ao lado
// das escritas existentes do lead. Consultas por campo único (índice automático).
import { collection, doc, addDoc, getDoc, getDocs, updateDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { appId, AULAS_PATH } from './firebase.js';
import { AULA_STATUS, outcomeToAulaStatus, pickConvertingAula, aulaRecordFields } from './aulas.js';

const aulasCol = (db) => collection(db, 'artifacts', appId, 'public', 'data', AULAS_PATH);
const aulaDoc = (db, id) => doc(db, 'artifacts', appId, 'public', 'data', AULAS_PATH, id);

// Ao agendar: atualiza o registro atual se ele ainda estiver 'agendada' (só
// ajuste antes da aula acontecer); senão cria um novo. Devolve o aulaId — o
// caller grava em lead.currentAulaId.
export async function upsertScheduledAula({ db, lead, fields }) {
  const currentId = lead.currentAulaId;
  const patch = {
    professorId: fields.professorId || null,
    professorName: fields.professorName || null,
    soloTraining: Boolean(fields.soloTraining),
    modality: fields.modality || null,
    scheduledFor: fields.scheduledFor || null,
  };
  if (currentId) {
    const snap = await getDoc(aulaDoc(db, currentId));
    if (snap.exists() && snap.data().status === AULA_STATUS.AGENDADA) {
      await updateDoc(aulaDoc(db, currentId), patch);
      return currentId;
    }
  }
  const record = aulaRecordFields({
    leadId: lead.id,
    leadName: lead.name || lead.nome || null,
    consultantId: lead.consultantId || null,
    consultantAuthUid: lead.consultantAuthUid || null,
    consultantName: lead.consultantName || null,
    status: AULA_STATUS.AGENDADA,
    ...patch,
  });
  const ref = await addDoc(aulasCol(db), { ...record, createdAt: serverTimestamp() });
  return ref.id;
}

// Ao marcar presença: aplica attended/no_show/cancelled no registro atual.
export async function applyOutcomeToAula({ db, lead, outcome }) {
  const status = outcomeToAulaStatus(outcome);
  if (!status || !lead?.currentAulaId) return;
  await updateDoc(aulaDoc(db, lead.currentAulaId), { status, outcomeAt: serverTimestamp() });
}

// Ao desfazer o desfecho (atalho reversível das Aulas): volta pra 'agendada'.
export async function clearAulaOutcome({ db, lead }) {
  if (!lead?.currentAulaId) return;
  await updateDoc(aulaDoc(db, lead.currentAulaId), { status: AULA_STATUS.AGENDADA, outcomeAt: null });
}

// Ao converter: marca a última aula atendida do lead como convertida.
export async function markConvertingAula({ db, leadId }) {
  if (!leadId) return;
  const snap = await getDocs(query(aulasCol(db), where('leadId', '==', leadId)));
  const aulas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const chosen = pickConvertingAula(aulas);
  if (!chosen) return;
  await updateDoc(aulaDoc(db, chosen.id), { converted: true, convertedAt: serverTimestamp() });
}

// Ao desfazer a venda: desmarca a(s) aula(s) convertida(s) do lead. Filtro de
// converted client-side p/ não exigir índice composto (leadId+converted).
export async function unmarkConvertedAula({ db, leadId }) {
  if (!leadId) return;
  const snap = await getDocs(query(aulasCol(db), where('leadId', '==', leadId)));
  await Promise.all(
    snap.docs.filter((d) => d.data().converted).map((d) => updateDoc(aulaDoc(db, d.id), { converted: false, convertedAt: null }))
  );
}
```

- [ ] **Step 2: Lint + build**

Run: `npx eslint src/lib/aulasWrites.js && npx vite build`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/aulasWrites.js
git commit -m "feat(aulas): wrappers Firestore (upsert agendada, outcome, conversão)"
```

---

### Task 3: Integrar criação/atualização da aula ao AGENDAR

**Files:**
- Modify: `src/views/LeadProfileView.jsx` (`handleWizardConfirm`, ~358-417)
- Modify: `src/views/DailyGoalView.jsx` (`handleReschedule`, ~1299-1378)

Antes de editar, LEIA a função atual. A ideia: quando `isAula`, chamar `upsertScheduledAula` ANTES de montar/gravar o `up` do lead, e incluir `currentAulaId` no `up`.

- [ ] **Step 1: `handleWizardConfirm` (LeadProfileView)** — importar e chamar

Adicionar no topo: `import { upsertScheduledAula } from '../lib/aulasWrites.js';`

Dentro do `try`, quando `isAula`, ANTES do objeto `up` (linha ~382), calcular o aulaId:

```js
let currentAulaId = lead.currentAulaId || null;
if (isAula) {
  currentAulaId = await upsertScheduledAula({
    db, lead,
    fields: {
      professorId: professorId || null,
      professorName: professorId ? professorNameById(professores, professorId) : null,
      soloTraining: Boolean(soloTraining),
      modality: modalidade || null,
      scheduledFor: date,
    },
  });
}
```

E incluir no objeto `up`: `currentAulaId,` (junto dos demais campos, ~linha 395).

- [ ] **Step 2: `handleReschedule` (DailyGoalView)** — mesmo padrão

Importar `upsertScheduledAula`. Quando o tipo for aula (`finalApptType === 'aula_experimental'`), antes do `leadUpdate` (~1324): chamar `upsertScheduledAula({ db, lead, fields: { professorId, professorName, soloTraining, modality, scheduledFor: newDate } })` e incluir `currentAulaId: <retorno>` no `leadUpdate`.

- [ ] **Step 3: Lint + build**

Run: `npx eslint src/views/LeadProfileView.jsx src/views/DailyGoalView.jsx && npx vite build`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/views/LeadProfileView.jsx src/views/DailyGoalView.jsx
git commit -m "feat(aulas): grava registro de aula ao agendar/reagendar (+currentAulaId no lead)"
```

---

### Task 4: Integrar desfecho da aula ao MARCAR PRESENÇA

**Files:**
- Modify: `src/lib/appointmentOutcome.js` (`writeAppointmentOutcome`, `clearAppointmentOutcome`)
- Modify: `src/views/DailyGoalView.jsx` (`handleOutcome`, ~1091-1171)
- Modify: `src/views/AppointmentTrackingView.jsx` (caminho do `clearAppointmentOutcome`, ~152)

**Nota de risco:** o toque da Meta (`handleOutcome`) é um fluxo crítico. Em vez de refatorá-lo pra usar o helper agora (risco de regressão sob mudança de modelo), adiciono a escrita da aula nos 3 sites de desfecho. A consolidação do `handleOutcome` no helper fica como cleanup posterior.

- [ ] **Step 1: `writeAppointmentOutcome`** — cobre presença cruzada + atalho Aulas

Importar `import { applyOutcomeToAula } from './aulasWrites.js';`. Depois do `updateDoc(...leadUpdate)` (o que grava o desfecho no lead), adicionar:

```js
await applyOutcomeToAula({ db, lead, outcome });
```

- [ ] **Step 2: `clearAppointmentOutcome`** — desfazer

Importar `clearAulaOutcome`. Depois do `updateDoc` que zera o desfecho no lead, adicionar `await clearAulaOutcome({ db, lead });`.

- [ ] **Step 3: `handleOutcome` (Meta tap, DailyGoalView)** — o único caminho inline

Importar `applyOutcomeToAula`. Depois do `updateDoc`/`logInteraction` que grava o desfecho, adicionar `await applyOutcomeToAula({ db, lead, outcome });` (usar a mesma variável de outcome do handler).

- [ ] **Step 4: Lint + build**

Run: `npx eslint src/lib/appointmentOutcome.js src/views/DailyGoalView.jsx src/views/AppointmentTrackingView.jsx && npx vite build`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/lib/appointmentOutcome.js src/views/DailyGoalView.jsx src/views/AppointmentTrackingView.jsx
git commit -m "feat(aulas): atualiza status da aula ao marcar/desfazer presença (3 sites)"
```

---

### Task 5: Integrar atribuição da CONVERSÃO

**Files:**
- Modify: `src/modals/MatriculaModal.jsx` (`handleConfirm`, ~64-142)
- Modify: `src/views/KanbanView.jsx` (`applyMoveToStage` convert/leave-Venda, `confirmKanbanLoss`)
- Modify: `src/views/LeadProfileView.jsx` (`handlePhaseConfirm`/`saveInteraction` convert/leave-Venda)

Regra: ao CONVERTER → `markConvertingAula`; ao SAIR de convertido (Venda→outra etapa, ou Perda) → `unmarkConvertedAula`.

- [ ] **Step 1: MatriculaModal** — após o `writeBatch` commitar, só na matrícula (não renovação)

Importar `import { markConvertingAula } from '../lib/aulasWrites.js';`. No fim do `handleConfirm`, quando for matrícula (o mesmo guard de `setStatusVenda`/`stampConvertedAt`, i.e. NÃO renovação):

```js
await markConvertingAula({ db, leadId: lead.id });
```

- [ ] **Step 2: Kanban** — converter e desfazer

Importar `markConvertingAula, unmarkConvertedAula`. Em `applyMoveToStage`, quando `destinoConvertido && !existing` (stamp de convertedAt): `await markConvertingAula({ db, leadId: lead.id })`. Quando sai de convertido (o ramo que zera `isConverted:false, convertedAt:null`) e em `confirmKanbanLoss` (vai pra Perda): `await unmarkConvertedAula({ db, leadId: lead.id })`. (A rota 'Venda' abre o MatriculaModal, coberto no Step 1 — não duplicar lá.)

- [ ] **Step 3: LeadProfileView** — converter (custom) e desfazer

Importar `markConvertingAula, unmarkConvertedAula`. Nos ramos de etapa convertida custom (`handlePhaseConfirm` ~291 / `saveInteraction` ~323-332) que fazem stamp de `convertedAt`: `markConvertingAula`. Nos ramos que saem de convertido (`~280-286`) e viram Perda: `unmarkConvertedAula`. (A rota 'Venda' abre o modal — coberta no Step 1.)

- [ ] **Step 4: Lint + build**

Run: `npx eslint src/modals/MatriculaModal.jsx src/views/KanbanView.jsx src/views/LeadProfileView.jsx && npx vite build`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/modals/MatriculaModal.jsx src/views/KanbanView.jsx src/views/LeadProfileView.jsx
git commit -m "feat(aulas): atribui/retira a conversão da última aula atendida"
```

---

### Task 6: Backfill script (`scripts/backfill-aulas.js`)

**Files:**
- Create: `scripts/backfill-aulas.js`

Segue o padrão dos backfills existentes (`scripts/backfill-scale-fields.js`): firebase-admin, `GOOGLE_APPLICATION_CREDENTIALS` ou `serviceAccount.json`, flag `--commit` (dry-run por padrão), lote por `appId`.

- [ ] **Step 1: Ler `scripts/backfill-scale-fields.js`** para copiar o boilerplate de init/args/commit e o caminho `artifacts/{appId}/public/data/...`.

- [ ] **Step 2: Implementar `scripts/backfill-aulas.js`**

Lógica: para cada lead com `appointmentType === 'aula_experimental'` (ou `nextFollowUpType` que normalize p/ aula) E sem `currentAulaId`, criar UM doc em `stronix_aulas`:
- `status`: `appointmentOutcome === 'attended' ? 'attended' : appointmentOutcome === 'no_show' ? 'no_show' : appointmentOutcome === 'cancelled' ? 'cancelled' : 'agendada'`.
- `converted`: `isConverted(lead) && status === 'attended'` → `true`; `convertedAt`: `lead.convertedAt || null`.
- Campos: `leadId`, `leadName`, `professorId`, `professorName`, `soloTraining`, `modality: appointmentModality`, `scheduledFor: appointmentScheduledFor`, `outcomeAt: appointmentOutcomeAt || null`, `consultantId/AuthUid/Name`, `createdAt: now`.
- Depois: `update` no lead com `currentAulaId = novoId`.
- Dry-run imprime contagem; `--commit` grava em lote (batch ≤ 400).

Escrever o script completo espelhando `backfill-scale-fields.js` (init do admin, iteração de leads por `appId`, `--commit`, log). Mapear `appointmentOutcome`→`status` e `converted` conforme acima. `isConverted` = `lead.isConverted || lead.status === 'Venda' || /convertid|matricul/i.test(lead.status||'')`.

- [ ] **Step 3: Dry-run local** (não commita dados)

Run: `node scripts/backfill-aulas.js` (sem `--commit`)
Expected: imprime quantos leads receberiam registro, sem escrever.

- [ ] **Step 4: Commit do script (o RUN com --commit é feito depois do deploy da regra)**

```bash
git add scripts/backfill-aulas.js
git commit -m "feat(aulas): script de backfill (1 aula/lead do agendamento atual)"
```

---

### Task 7: Regra do Firestore + PR

**Files:**
- Modify: `firestore.rules` (adicionar bloco `stronix_aulas`)

- [ ] **Step 1: Adicionar a regra** (modelo = `stronix_leads`; update por qualquer membro preservando o dono — pra presença cruzada e conversão por qualquer consultor)

```
    // Histórico de aulas experimentais. Leitura por membro do tenant; create/
    // update por qualquer membro preservando consultantAuthUid (presença
    // cruzada / conversão por qualquer consultor). Sem delete pelo cliente.
    match /artifacts/{appId}/public/data/stronix_aulas/{id} {
      allow read: if inTenant(appId) && tenantActive(appId);
      allow create: if inTenant(appId) && tenantActive(appId);
      allow update: if inTenant(appId) && tenantActive(appId)
        && request.resource.data.consultantAuthUid == resource.data.consultantAuthUid;
      allow delete: if false;
    }
```

- [ ] **Step 2: Commit da regra**

```bash
git add firestore.rules
git commit -m "feat(aulas): regra Firestore de stronix_aulas (publicar manual)"
```

- [ ] **Step 3: Push + abrir a PR-A**

```bash
git push -u origin claude/historico-aulas-professor
gh pr create --base main --title "feat: histórico de aulas (PR-A: coleção + dual-write + backfill)" --body-file <corpo>
```

No corpo da PR, deixar explícito para o Johnny: **publicar a regra manualmente** no console Firebase ANTES do uso em prod, e rodar `node scripts/backfill-aulas.js --commit` DEPOIS do deploy.

---

### Task 8: Verificação no preview (smoke test das escritas)

**Files:** nenhum (verificação).

- [ ] **Step 1:** Subir o dev server (`.claude/launch.json` → `stronilead-dev`, porta 5173) e logar.
- [ ] **Step 2:** Agendar uma aula experimental num lead → conferir no console Firestore que nasceu 1 doc em `stronix_aulas` com `status:'agendada'` e que o lead ganhou `currentAulaId`.
- [ ] **Step 3:** Marcar presença (compareceu) → o mesmo doc vira `status:'attended'` com `outcomeAt`.
- [ ] **Step 4:** Reagendar antes de marcar → o MESMO doc atualiza (não duplica). Marcar presença, depois agendar OUTRA aula → nasce um doc novo.
- [ ] **Step 5:** Matricular o lead → a última aula atendida vira `converted:true`. Desfazer a venda → volta `converted:false`.
- [ ] **Step 6:** `npx vitest run` (suíte inteira verde) + `npx eslint .` + `npx vite build`.

---

## Notas de execução

- **Ordem de deploy:** publicar a regra manualmente ANTES de qualquer escrita em prod; rodar o backfill com `--commit` DEPOIS do deploy da regra + código. Sem a regra, os writes de aula falham com permission-denied — mas o dual-write é best-effort (envolver cada chamada de aulasWrites num try/catch nos call sites p/ NÃO quebrar o fluxo do lead se a aula falhar).
- **PR-B (separada):** virar `computeProfessorConversion` pra ler `stronix_aulas` (janela por `scheduledFor`), depois que a PR-A estiver em prod e os dados acumulando. Plano próprio.
- **Cleanup posterior:** consolidar o `handleOutcome` da Meta no helper `writeAppointmentOutcome` (removido do escopo da PR-A por risco de regressão).
