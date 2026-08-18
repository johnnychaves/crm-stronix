# Agendamentos separados — PR 1 (preparação) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparar a base para a separação entre agendamento e próximo contato, sem mudar nenhum comportamento visível: `stronix_aulas` passa a aceitar visitas, e tudo que hoje assume "todo documento aqui é aula" ganha filtro.

**Architecture:** A coleção `stronix_aulas` ganha `type` (`'aula'` | `'visita'`, ausente significa `'aula'`) e `unit`. Um helper único, `isAulaRecord`, decide o que é aula, sempre client-side. A visita passa a gerar registro no wizard. O espelho do lead não muda neste PR.

**Tech Stack:** React 19 + Vite, Firestore (Web SDK v12), Vitest. Sem TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-18-agendamentos-separados-design.md`

---

## Regra que não pode ser quebrada

**O filtro por tipo é SEMPRE client-side, nunca no `where()` do Firestore.**

Documento antigo de `stronix_aulas` não tem o campo `type`. No Firestore,
`where('type','==','aula')` **exclui documento que não tem o campo**. Uma query
dessas antes do backfill apagaria todo o histórico de aulas da conversão por
professor, sem erro na tela.

Por isso este PR **não** cria índice composto. `isAulaRecord` trata `type`
ausente como `'aula'` e funciona antes e depois do backfill.

---

### Task 1: `isAulaRecord` e os campos novos do registro

**Files:**
- Modify: `src/lib/aulas.js`
- Test: `src/lib/__tests__/aulas.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao fim de `src/lib/__tests__/aulas.test.js`:

```js
describe('isAulaRecord', () => {
  it('type ausente conta como aula (documento histórico)', () => {
    expect(isAulaRecord({ id: 'a', status: 'attended' })).toBe(true);
  });
  it('type explícito decide', () => {
    expect(isAulaRecord({ type: 'aula' })).toBe(true);
    expect(isAulaRecord({ type: 'visita' })).toBe(false);
  });
  it('null/undefined não quebra', () => {
    expect(isAulaRecord(null)).toBe(true);
    expect(isAulaRecord(undefined)).toBe(true);
  });
});

describe('aulaRecordFields — type e unit', () => {
  it('sem type explícito, nasce aula com unit nula', () => {
    const r = aulaRecordFields({ leadId: 'l1' });
    expect(r.type).toBe('aula');
    expect(r.unit).toBeNull();
  });
  it('visita guarda a unidade', () => {
    const r = aulaRecordFields({ leadId: 'l1', type: 'visita', unit: 'Centro' });
    expect(r.type).toBe('visita');
    expect(r.unit).toBe('Centro');
  });
  it('type inválido cai para aula', () => {
    expect(aulaRecordFields({ leadId: 'l1', type: 'mensagem' }).type).toBe('aula');
  });
});
```

Atualizar o import no topo do arquivo para incluir `isAulaRecord`:

```js
import { AULA_STATUS, APPOINTMENT_RECORD_TYPES, isAulaRecord, outcomeToAulaStatus, pickConvertingAula, aulaRecordFields } from '../aulas.js';
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/aulas.test.js
```

Esperado: FAIL com `isAulaRecord is not a function`.

- [ ] **Step 3: Implementar**

Em `src/lib/aulas.js`, logo abaixo de `AULA_STATUS`:

```js
// Tipo do registro de agendamento. `stronix_aulas` guardava só aulas; desde a
// separação entre agendamento e próximo contato ela guarda visitas também.
// AUSENTE SIGNIFICA 'aula': todo documento anterior à mudança continua valendo
// sem ser tocado. Por isso o filtro é sempre client-side (isAulaRecord) e nunca
// um where('type','==','aula'), que no Firestore exclui doc sem o campo.
export const APPOINTMENT_RECORD_TYPES = { AULA: 'aula', VISITA: 'visita' };

export const isAulaRecord = (rec) =>
  (rec?.type ?? APPOINTMENT_RECORD_TYPES.AULA) !== APPOINTMENT_RECORD_TYPES.VISITA;
```

Em `aulaRecordFields`, acrescentar `type` e `unit` à assinatura e ao retorno:

```js
export function aulaRecordFields({
  leadId, leadName = null, professorId = null, professorName = null, soloTraining = false,
  modality = null, scheduledFor = null, status = AULA_STATUS.AGENDADA, outcomeAt = null,
  converted = false, convertedAt = null,
  consultantId = null, consultantAuthUid = null, consultantName = null,
  type = APPOINTMENT_RECORD_TYPES.AULA, unit = null,
} = {}) {
  return {
    type: type === APPOINTMENT_RECORD_TYPES.VISITA
      ? APPOINTMENT_RECORD_TYPES.VISITA
      : APPOINTMENT_RECORD_TYPES.AULA,
    unit: unit || null,
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

- [ ] **Step 4: Rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/aulas.test.js
```

Esperado: PASS.

- [ ] **Step 5: Commitar**

```bash
git add src/lib/aulas.js src/lib/__tests__/aulas.test.js
git commit -m "feat(aulas): registro ganha type e unit, com isAulaRecord"
```

---

### Task 2: `pickConvertingAula` ignora visita

Esta é a guarda mais importante do PR. `markConvertingAula` chama
`pickConvertingAula` para decidir qual aula levou a conversão e carimba o
professor na carteira do lead. Sem o filtro, uma visita marcada como
"compareceu" rouba o crédito e a carteira fica errada em silêncio.

**Files:**
- Modify: `src/lib/aulas.js`
- Test: `src/lib/__tests__/aulas.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar dentro do `describe('pickConvertingAula', ...)` existente:

```js
  it('ignora visita mesmo com data maior (contaminação)', () => {
    const aulas = [
      { id: 'aula', type: 'aula', status: 'attended', scheduledFor: d('2026-07-01') },
      { id: 'visita', type: 'visita', status: 'attended', scheduledFor: d('2026-07-20') },
    ];
    expect(pickConvertingAula(aulas).id).toBe('aula');
  });
  it('só visitas atendidas devolve null', () => {
    expect(pickConvertingAula([
      { id: 'v', type: 'visita', status: 'attended', scheduledFor: d('2026-07-20') },
    ])).toBeNull();
  });
  it('documento histórico sem type continua valendo como aula', () => {
    expect(pickConvertingAula([
      { id: 'legado', status: 'attended', scheduledFor: d('2026-07-01') },
    ]).id).toBe('legado');
  });
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/lib/__tests__/aulas.test.js -t "contaminação"
```

Esperado: FAIL, `expected 'visita' to be 'aula'`.

- [ ] **Step 3: Implementar**

Em `src/lib/aulas.js`, na primeira linha de `pickConvertingAula`, trocar o filtro:

```js
export function pickConvertingAula(aulas) {
  // isAulaRecord: visita mora na mesma coleção desde a separação de agendamentos
  // e NÃO pode levar o crédito da conversão nem carimbar carteira de professor.
  const attended = (aulas || []).filter((a) => a && isAulaRecord(a) && a.status === AULA_STATUS.ATTENDED);
  if (!attended.length) return null;
  return attended.reduce((best, a) => {
    const ad = getSafeDateOrNull(a.scheduledFor);
    const bd = getSafeDateOrNull(best.scheduledFor);
    if (!ad) return best;
    if (!bd) return a;
    return ad > bd ? a : best;
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/aulas.test.js
```

Esperado: PASS.

- [ ] **Step 5: Commitar**

```bash
git add src/lib/aulas.js src/lib/__tests__/aulas.test.js
git commit -m "fix(aulas): visita não leva o crédito da conversão"
```

---

### Task 3: Filtro nos dois consumidores que varrem a coleção

`unmarkConvertedAula` varre por `leadId` e desmarca o que tiver `converted`.
`useAulasInWindow` alimenta a conversão por professor do Gerencial. Os dois
precisam do filtro client-side.

**Files:**
- Modify: `src/lib/aulasWrites.js`
- Modify: `src/hooks/useAulasInWindow.js`

- [ ] **Step 1: Filtrar em `unmarkConvertedAula`**

Em `src/lib/aulasWrites.js`, importar o helper e filtrar:

```js
import { AULA_STATUS, APPOINTMENT_RECORD_TYPES, isAulaRecord, outcomeToAulaStatus, pickConvertingAula, aulaRecordFields } from './aulas.js';
```

```js
export async function unmarkConvertedAula({ db, leadId }) {
  if (!leadId) return;
  const snap = await getDocs(query(aulasCol(db), where('leadId', '==', leadId)));
  await Promise.all(
    snap.docs
      // Só aula tem conversão. O filtro é redundante hoje (pickConvertingAula já
      // nunca marca visita), e fica como segunda trava contra dado legado.
      .filter((d) => isAulaRecord(d.data()) && d.data().converted)
      .map((d) => updateDoc(aulaDoc(db, d.id), { converted: false, convertedAt: null }))
  );
}
```

- [ ] **Step 2: Filtrar em `useAulasInWindow`**

Em `src/hooks/useAulasInWindow.js`, importar `isAulaRecord` e filtrar depois do
`getDocs`, mantendo a guarda de corrida:

```js
import { isAulaRecord } from '../lib/aulas.js';
```

```js
      if (reqId !== reqIdRef.current) return;
      setAulas(
        snap.docs
          // Visita mora na mesma coleção. O filtro é CLIENT-SIDE de propósito:
          // where('type','==','aula') excluiria os documentos anteriores ao
          // backfill, que não têm o campo, e o Gerencial perderia histórico.
          .filter((d) => isAulaRecord(d.data()))
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              scheduledFor: getSafeDateOrNull(data.scheduledFor),
              convertedAt: getSafeDateOrNull(data.convertedAt)
            };
          })
      );
```

- [ ] **Step 3: Rodar a suíte inteira**

```bash
npx vitest run
```

Esperado: PASS, 689 ou mais testes. Nenhum teste existente pode quebrar: este PR não muda comportamento.

- [ ] **Step 4: Rodar o lint**

```bash
npx eslint src/lib/aulasWrites.js src/hooks/useAulasInWindow.js src/lib/aulas.js
```

Esperado: sem erro novo.

- [ ] **Step 5: Commitar**

```bash
git add src/lib/aulasWrites.js src/hooks/useAulasInWindow.js
git commit -m "fix(aulas): filtra visita na varredura e na janela do Gerencial"
```

---

### Task 4: Visita passa a gerar registro

Generaliza `upsertScheduledAula` para os dois tipos. Aula mantém o atalho pelo
`currentAulaId`. Visita **não** ganha ponteiro no lead neste PR: acha o registro
aberto por query em `leadId`. Assim o documento do lead não muda em nada, e o PR
segue sem mudança de comportamento.

**Files:**
- Modify: `src/lib/aulasWrites.js`
- Modify: `src/views/LeadProfileView.jsx`

- [ ] **Step 1: Generalizar o upsert**

Em `src/lib/aulasWrites.js`, substituir `upsertScheduledAula` por:

```js
// Ao agendar: atualiza o registro em aberto se houver, senão cria um novo.
// Devolve o id do registro.
//   aula   → acha o atual pelo lead.currentAulaId (atalho barato que já existia)
//   visita → acha o atual por query em leadId, porque o lead ainda não guarda
//            ponteiro de visita (só passa a guardar no PR da virada)
export async function upsertScheduledAppointment({ db, lead, type = APPOINTMENT_RECORD_TYPES.AULA, fields }) {
  const isVisita = type === APPOINTMENT_RECORD_TYPES.VISITA;
  const patch = isVisita
    ? { unit: fields.unit || null, scheduledFor: fields.scheduledFor || null }
    : {
        professorId: fields.professorId || null,
        professorName: fields.professorName || null,
        soloTraining: Boolean(fields.soloTraining),
        modality: fields.modality || null,
        scheduledFor: fields.scheduledFor || null,
      };

  const openId = isVisita
    ? await findOpenVisitaId(db, lead.id)
    : await findOpenAulaId(db, lead.currentAulaId);
  if (openId) {
    await updateDoc(aulaDoc(db, openId), patch);
    return openId;
  }

  const record = aulaRecordFields({
    type,
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

// Compatibilidade: os chamadores de aula continuam com a assinatura antiga.
export const upsertScheduledAula = ({ db, lead, fields }) =>
  upsertScheduledAppointment({ db, lead, type: APPOINTMENT_RECORD_TYPES.AULA, fields });

async function findOpenAulaId(db, currentId) {
  if (!currentId) return null;
  const snap = await getDoc(aulaDoc(db, currentId));
  return snap.exists() && snap.data().status === AULA_STATUS.AGENDADA ? currentId : null;
}

async function findOpenVisitaId(db, leadId) {
  const snap = await getDocs(query(aulasCol(db), where('leadId', '==', leadId)));
  const open = snap.docs.find(
    (d) => !isAulaRecord(d.data()) && d.data().status === AULA_STATUS.AGENDADA
  );
  return open ? open.id : null;
}
```

- [ ] **Step 2: Chamar no wizard para visita**

Em `src/views/LeadProfileView.jsx`, dentro de `handleWizardConfirm`, logo depois
do bloco `if (isAula) { ... }` do `upsertScheduledAula`, acrescentar o gêmeo da
visita. Importar `upsertScheduledAppointment` no topo, junto do import atual de
`aulasWrites.js`.

```js
      // Dual-write da VISITA (espelha o da aula, ver comentário acima). O lead
      // ainda não guarda ponteiro de visita: o registro é achado por leadId.
      // Best-effort pelo mesmo motivo — falha aqui não pode derrubar o
      // agendamento do lead.
      if (isVisita) {
        try {
          await upsertScheduledAppointment({
            db, lead,
            type: 'visita',
            fields: { unit: unidade || null, scheduledFor: date },
          });
        } catch (e) {
          console.error('upsertScheduledAppointment (visita) falhou', e);
        }
      }
```

- [ ] **Step 3: Rodar a suíte e o lint**

```bash
npx vitest run && npx eslint src/lib/aulasWrites.js src/views/LeadProfileView.jsx
```

Esperado: PASS, sem erro de lint. O comportamento visível do app não muda: o
registro novo de visita ainda não é lido por ninguém.

- [ ] **Step 4: Commitar**

```bash
git add src/lib/aulasWrites.js src/views/LeadProfileView.jsx
git commit -m "feat(agendamentos): visita passa a gerar registro no histórico"
```

---

### Task 5: Script de backfill (escrito, não rodado)

Cria registro para todo lead que tem compromisso no espelho e ainda não tem
registro correspondente, e carimba `type: 'aula'` nos registros existentes.

**Files:**
- Create: `scripts/backfill-appointments.js`

- [ ] **Step 1: Escrever o script**

Copiar a estrutura de `scripts/backfill-aulas.js` (cabeçalho de uso, `parseArgs`
com `--tenant` e `--commit`, inicialização do `firebase-admin`, dry-run por
padrão) e trocar a lógica de seleção por:

```js
// Duas passadas, ambas idempotentes:
//
// (1) CARIMBO: todo doc de stronix_aulas sem o campo `type` recebe
//     type:'aula'. Documento anterior à separação de agendamentos é aula por
//     definição. Rodar de novo não muda nada (o filtro é "sem o campo").
//
// (2) VISITAS FALTANDO: todo lead com appointmentType=='visita' e
//     appointmentScheduledFor preenchido que ainda NÃO tenha um doc de visita
//     com o mesmo scheduledFor ganha um. A chave de idempotência é o par
//     (leadId, scheduledFor): rodar duas vezes não duplica.
//
// NÃO cria aula faltando: isso já é trabalho do backfill-aulas.js, que roda
// pelo currentAulaId. Rodar os dois é seguro e independente.
```

O laço de leads deve montar o registro com os mesmos campos de
`aulaRecordFields`, incluindo `type: 'visita'`, `unit: lead.appointmentUnit`,
`status` derivado de `outcomeToAulaStatus(lead.appointmentOutcome)` com fallback
`'agendada'`, e `outcomeAt: lead.appointmentOutcomeAt || null`. Os helpers puros
entram como cópia verbatim no topo, seguindo a convenção declarada no
`backfill-aulas.js` (script admin não importa de `src/`).

O relatório final imprime: docs carimbados, visitas criadas, leads pulados por
já terem registro, e uma amostra de 5 linhas.

- [ ] **Step 2: Rodar em dry-run contra produção**

```bash
GOOGLE_APPLICATION_CREDENTIALS=/caminho/serviceAccount.json node scripts/backfill-appointments.js --tenant=stronix-crm-app
```

Esperado: relatório sem gravar nada. Conferir se o número de visitas a criar
bate com a ordem de grandeza esperada da base.

- [ ] **Step 3: Commitar sem rodar com `--commit`**

O `--commit` só roda depois do merge do PR 1, conforme o spec.

```bash
git add scripts/backfill-appointments.js
git commit -m "chore(scripts): backfill de visitas e carimbo de type"
```

---

### Task 6: Corrigir o spec (índice removido)

**Files:**
- Modify: `docs/superpowers/specs/2026-08-18-agendamentos-separados-design.md`

- [ ] **Step 1: Substituir a seção do índice**

Trocar o bloco do índice composto por:

```markdown
Nenhum índice novo. O filtro por tipo é **sempre client-side**, via
`isAulaRecord`. Um `where('type','==','aula')` excluiria os documentos anteriores
ao backfill, que não têm o campo, e a conversão por professor perderia histórico
em silêncio. A janela de datas já limita o volume lido.
```

Trocar também o item 4 da lista do PR 1 (índice) por "sem índice novo, filtro
client-side".

- [ ] **Step 2: Commitar**

```bash
git add docs/superpowers/specs/2026-08-18-agendamentos-separados-design.md
git commit -m "docs: spec não pede índice, o filtro por tipo é client-side"
```

---

### Task 7: Fechamento do PR 1

- [ ] **Step 1: Suíte completa e lint**

```bash
npx vitest run && npx eslint .
```

Esperado: todos os testes passam. Lint sem erro **novo** (o repo tem 15 erros
conhecidos de `react-hooks` v7, registrados em memória; não corrigir aqui).

- [ ] **Step 2: Build**

```bash
npm run build
```

Esperado: build limpo.

- [ ] **Step 3: Abrir o PR**

```bash
git push -u origin claude/experimental-class-scheduling-bug-55dbf5
```

Corpo do PR: linkar o spec, deixar explícito que **não há mudança de
comportamento**, e que o backfill roda **depois do merge**, antes do PR 2.

---

## Critério de pronto

- [ ] Suíte verde, sem teste existente quebrado
- [ ] Visita agendada pelo wizard cria doc em `stronix_aulas` com `type: 'visita'`
- [ ] Conversão por professor do Gerencial ignora visita
- [ ] `pickConvertingAula` ignora visita e ainda aceita doc legado sem `type`
- [ ] Nenhuma mudança visível no app
- [ ] Nenhum índice novo, nenhuma regra do Firestore nova
- [ ] Backfill escrito, testado em dry-run, **não** rodado com `--commit`
