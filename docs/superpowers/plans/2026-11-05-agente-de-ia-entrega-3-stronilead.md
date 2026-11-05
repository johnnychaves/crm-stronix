# Agente de IA, Entrega 3: marca da IA no Stronilead. Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** As ações `create-lead` e `schedule` do `POST /api/zap` aceitam o pedido feito pela IA do Stronizap em nome do consultor de plantão, gravam a marca `byAi: true` e a ficha mostra a marca da IA ao lado do nome, como já mostra a do Stronizap.

**Architecture:** O dono e o autor já saem do `actor.email` do pedido (`emailFromActor` e `findTeamMember`). Quando é a IA que pede, o Stronizap manda nesse campo o e-mail do consultor de plantão, então o Stronilead não ganha caminho novo para o dono: ganha só o campo `byAi` no corpo, lido em `readCreateLeadBody` e `readScheduleBody`, e repassado à interação que já é gravada (o marco `zap_signup` e a nota do agendamento com `via: 'stronizap'`). A ficha lê `byAi` nas mesmas funções de `src/lib/timeline.js` que já desenham a marca do Stronizap. O `schedule-options` passa a responder `accepts: ['byAi']`, que é como o smoke do Stronizap confere que esta versão está no ar antes da entrega 4 subir.

**Tech Stack:** JavaScript, Vercel serverless (`api/`), Firebase Admin, React 19, Vitest.

**Spec:** `06-sistemas/stronizap/docs/superpowers/specs/2026-10-22-agente-de-ia-primeiro-atendimento-design.md`, seção "Mudança no Stronilead" e entrega 3. Contrato da ponte em `06-sistemas/CLAUDE.md`, "Ponte Stronilead ↔ Stronizap".

---

## Decisões aprovadas pelo Johnny em 05/11/2026 (todas as recomendações)

1. **Agendamento da IA num lead que já tem dono.** Hoje, quando um consultor agenda no lead de outro, a tarefa do dia vai para quem agendou (`appointmentTaskOwnerFor`, PR #243). Com a IA, quem "agenda" é o consultor de plantão, então num lead que já é da Ana, agendado pela IA no plantão do Hosiel, a visita sai da Meta da Ana e vai para a do Hosiel. A spec diz que "o dono do lead e quem agendou são o consultor de plantão", sem tratar o lead que já tem dono. **Recomendação:** deixar a regra de hoje (a tarefa vai para o plantão), porque foi ele quem deu o horário e quem acompanha o desfecho no dia. Este plano não muda nada nessa regra. Se o Johnny preferir a tarefa com o dono, a mudança é uma linha em `buildScheduleWrites` (`taskOwner = byAi ? null : appointmentTaskOwnerFor(...)`) e um teste.
2. **A IA nunca escolhe outro dono.** O `create-lead` com `byAi: true` e `lead.ownerId` preenchido é recusado. Assim, mesmo que o plantão seja um gestor, o lead fica com ele, e nunca com alguém que a IA escolheu. **Recomendação:** manter.
3. **Desenho da marca.** A regra do repositório pede mockup para UI nova. A marca da IA é uma pílula "IA" do mesmo tamanho e cor do círculo do Stronizap (`StronizapBadge`), ao lado dele. **Recomendação:** seguir sem rodada de mockup, por ser um selo de 17 px que repete um desenho já aprovado. Se o Johnny quiser ver antes, a Task 6 é a única com tela e pode esperar.
4. **Sem campo no lead.** A marca fica só nas interações (o marco do cadastro e a nota do agendamento). O lead não ganha `createdByAi`. Relatório "leads da IA" no Stronilead, se for pedido, lê o marco. **Recomendação:** manter assim nesta entrega.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `api/_zapLead.js` | Modificar | `readCreateLeadBody` lê `byAi`; `zapSignupText` e `buildZapSignupInteraction` gravam a marca; mensagens novas |
| `api/_zapSchedule.js` | Modificar | `readScheduleBody` lê `byAi`; `buildScheduleWrites` grava a marca; `buildScheduleOptions` responde `accepts` |
| `api/zap.js` | Modificar | `handleCreateLead` recusa dono escolhido com `byAi` e repassa a marca; `handleSchedule` repassa a marca |
| `api/__tests__/zapLead.test.js` | Modificar | Leitura do corpo e marco com a marca |
| `api/__tests__/zapSchedule.test.js` | Modificar | Leitura do corpo, gravação com a marca e `accepts` |
| `api/__tests__/zapRoute.test.js` | Modificar | Ponta a ponta das duas ações com `byAi` |
| `src/lib/leads.js` | Modificar | `isAiInteraction` |
| `src/lib/timeline.js` | Modificar | Textos da pílula, do detalhe do autor e do rodapé do desfecho com a IA |
| `src/lib/__tests__/timeline.test.js` | Modificar | Testes dos textos |
| `src/components/brand/AiBadge.jsx` | Criar | Pílula "IA" |
| `src/components/profile/TimelineAuthor.jsx` | Modificar | Marca da IA ao lado da do Stronizap |
| `src/components/profile/TimelineEvent.jsx` | Modificar | Passa a marca ao autor e ao rodapé do desfecho |
| `src/components/profile/ZapSignupMarker.jsx` | Modificar | Marca da IA no marco de início |
| `src/views/LeadProfileView.jsx:864-878` | Modificar | `outcomeOrigin` leva `byAi` |
| `src/lib/__tests__/timelineEvent.test.js` | Modificar | Render com a marca |
| `CLAUDE.md` (do Stronilead) | Modificar | Regra da marca da IA na seção da ponte |

Antes de começar: o checkout local está atrás da `origin/main`. Crie a branch a partir dela.

```bash
cd /Users/johnnybittencourt/STRONIX-FIRMA/06-sistemas/stronilead
git fetch origin && git switch -c claude/agente-ia-marca-da-ia origin/main
npm ci
```

---

### Task 1: O corpo do cadastro aceita `byAi`

**Files:**
- Modify: `api/_zapLead.js` (`ZAP_LEAD_MESSAGES` e `readCreateLeadBody`)
- Test: `api/__tests__/zapLead.test.js` (bloco `describe('readCreateLeadBody: só o formato do pedido'`)

- [ ] **Step 1: Testes que falham.** No fim do bloco `describe('readCreateLeadBody: só o formato do pedido', ...)`, acrescente:

```js
  it('pedido da IA: byAi true entra no valor; sem o campo, a chave nem aparece', () => {
    expect(readCreateLeadBody(corpo({}, { byAi: true })).value.byAi).toBe(true);
    expect('byAi' in readCreateLeadBody(corpo()).value).toBe(false);
    expect('byAi' in readCreateLeadBody(corpo({}, { byAi: false })).value).toBe(false);
  });

  it('byAi que não é true nem false é recusado', () => {
    for (const byAi of ['true', 1, null, {}]) {
      expect(readCreateLeadBody(corpo({}, { byAi })).refusal).toEqual(invalidData('byAi', ZAP_LEAD_MESSAGES.byAi));
    }
  });

  it('pela IA, o dono não é escolhido: ownerId preenchido é recusado', () => {
    expect(readCreateLeadBody(corpo({ ownerId: 'u-bruno' }, { byAi: true })).refusal)
      .toEqual(invalidData('ownerId', ZAP_LEAD_MESSAGES.aiOwner));
  });
```

O `null` entra na lista de recusas de propósito: o Stronizap nunca manda `byAi: null`, e um valor que não é `true` nem `false` indica que o pedido foi montado errado.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/zapLead.test.js -t "readCreateLeadBody"`
Expected: FAIL nos três testes novos (`ZAP_LEAD_MESSAGES.byAi` é `undefined` e `byAi` não aparece no valor).

- [ ] **Step 3: Mensagens.** Em `ZAP_LEAD_MESSAGES`, logo depois de `minor: ...`, acrescente:

```js
  byAi: 'A marca da IA veio num formato que o Stronilead não aceita.',
  aiOwner: 'Pela IA, o dono do lead é sempre o consultor de plantão.',
```

- [ ] **Step 4: Leitura.** Em `readCreateLeadBody`, logo depois da conferência do `channel` (o `if (channel != null && typeof channel !== 'string')`), acrescente:

```js
  // Pedido feito pela IA do Stronizap em nome do consultor de plantão. Só
  // true ou false; sem o campo, é o pedido de sempre.
  if (body.byAi !== undefined && typeof body.byAi !== 'boolean') {
    return { refusal: invalidData('byAi', ZAP_LEAD_MESSAGES.byAi) };
  }
  const byAi = body.byAi === true;
```

Depois da conferência de tipos dos campos do lead (o laço `for (const field of ['source', ...])`), acrescente:

```js
  // A IA nunca passa o lead para outra pessoa: o dono é quem está no actor.
  if (byAi && textOrEmpty(lead.ownerId).trim()) {
    return { refusal: invalidData('ownerId', ZAP_LEAD_MESSAGES.aiOwner) };
  }
```

No `return { value: { ... } }`, logo depois de `channelName: ...,`, acrescente:

```js
      // A chave só aparece no pedido da IA, para o pedido de sempre ficar igual.
      ...(byAi ? { byAi: true } : {}),
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run api/__tests__/zapLead.test.js`
Expected: PASS, inclusive o `toEqual` do "pedido certo", que não mudou.

- [ ] **Step 6: Commit**

```bash
git add api/_zapLead.js api/__tests__/zapLead.test.js
git commit -m "feat: cadastro pelo Stronizap aceita a marca da IA"
```

---

### Task 2: O marco do cadastro leva a marca

**Files:**
- Modify: `api/_zapLead.js` (`zapSignupText` e `buildZapSignupInteraction`)
- Test: `api/__tests__/zapLead.test.js` (bloco `describe('buildZapSignupInteraction: o marco de início'`)

- [ ] **Step 1: Teste que falha.** No fim do bloco `describe('buildZapSignupInteraction: o marco de início', ...)`, acrescente:

```js
  it('cadastro da IA: a marca e o texto dizem que foi a IA, no plantão de quem ficou com o lead', () => {
    const marco = buildZapSignupInteraction({
      leadId: 'L1', leadName: 'Mariana Souza', actor: ANA, owner: ANA, channelName: 'Recepção', serverTime: HORA, byAi: true
    });
    expect(marco).toMatchObject({
      consultantName: 'Ana Souza', actorId: 'u-ana', leadConsultantId: 'u-ana', byAi: true,
      text: 'Cadastrado pela IA do Stronizap no plantão de Ana Souza. Canal Recepção.'
    });
  });

  it('sem a marca, o marco sai sem a chave byAi', () => {
    const marco = buildZapSignupInteraction({ leadId: 'L1', leadName: 'M', actor: ANA, owner: ANA, channelName: null, serverTime: HORA });
    expect('byAi' in marco).toBe(false);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/zapLead.test.js -t "o marco de início"`
Expected: FAIL no "cadastro da IA" (sem `byAi` e com o texto antigo).

- [ ] **Step 3: Implementação.** Troque `zapSignupText` e `buildZapSignupInteraction` por:

```js
// O `text` do marco, para qualquer tela que ainda não conheça o tipo. Pela IA,
// quem aparece é o consultor de plantão, que é o dono do lead.
export function zapSignupText({ actorName, ownerName = null, channelName = null, byAi = false }) {
  const quem = byAi
    ? (actorName ? `Cadastrado pela IA do Stronizap no plantão de ${actorName}.` : 'Cadastrado pela IA do Stronizap.')
    : (actorName ? `Cadastrado pelo Stronizap por ${actorName}.` : 'Cadastrado pelo Stronizap.');
  return [
    quem,
    ownerName ? `Consultor responsável: ${ownerName}.` : null,
    channelName ? `Canal ${channelName}.` : null
  ].filter(Boolean).join(' ');
}
```

```js
export function buildZapSignupInteraction({ leadId, leadName, actor, owner, channelName = null, serverTime, byAi = false }) {
  const otherOwner = owner.id !== actor.id;
  return {
    leadId,
    leadName: leadName || null,
    consultantName: actor.name ?? null,
    ...getInteractionSecurityFields({ consultantId: owner.id, consultantAuthUid: owner.authUid }, actor),
    actorId: actor.id,
    actorAuthUid: actor.authUid ?? null,
    type: ZAP_SIGNUP_TYPE,
    text: zapSignupText({ actorName: actor.name, ownerName: otherOwner ? owner.name : null, channelName, byAi }),
    ...(otherOwner ? { ownerName: owner.name ?? null } : {}),
    zapChannelName: channelName || null,
    // A marca da IA (spec do agente de IA, entrega 3). A ficha a desenha ao lado do nome.
    ...(byAi ? { byAi: true } : {}),
    createdAt: serverTime
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run api/__tests__/zapLead.test.js`
Expected: PASS, inclusive os dois testes antigos do marco, que usam `toEqual` e continuam sem `byAi`.

- [ ] **Step 5: Commit**

```bash
git add api/_zapLead.js api/__tests__/zapLead.test.js
git commit -m "feat: marco do cadastro feito pela IA leva a marca"
```

---

### Task 3: O agendamento aceita e grava a marca, e o `schedule-options` avisa que aceita

**Files:**
- Modify: `api/_zapSchedule.js` (`ZAP_SCHEDULE_MESSAGES`, `readScheduleBody`, `buildScheduleWrites`, `buildScheduleOptions`)
- Test: `api/__tests__/zapSchedule.test.js`

- [ ] **Step 1: Testes que falham.** No fim do bloco `describe('readScheduleBody: só o formato do pedido', ...)`, acrescente:

```js
  it('pedido da IA: byAi true entra no valor; sem o campo, a chave nem aparece', () => {
    expect(readScheduleBody(corpo({}, { byAi: true })).value.byAi).toBe(true);
    expect('byAi' in readScheduleBody(corpo()).value).toBe(false);
  });

  it('byAi que não é true nem false é recusado', () => {
    expect(recusa(corpo({}, { byAi: 'sim' }))).toEqual(invalidData('byAi', ZAP_LEAD_MESSAGES.byAi));
  });
```

No fim do bloco `describe('buildScheduleWrites: o que o assistente grava, numa gravação só', ...)`, acrescente:

```js
  it('agendamento da IA: a interação leva a marca, e o resto não muda', () => {
    const comIa = gravar({ schedule: VISITA, at: atVisita, newRecordId: 'rec-novo', byAi: true });
    const semIa = gravar({ schedule: VISITA, at: atVisita, newRecordId: 'rec-novo' });
    expect(comIa.interaction).toEqual({ ...semIa.interaction, byAi: true });
    expect(comIa.leadPatch).toEqual(semIa.leadPatch);
    expect(comIa.record).toEqual(semIa.record);
    expect('byAi' in semIa.interaction).toBe(false);
  });
```

No teste `it('consultora em dia de meta, com a Mariana e o Pedro no número', ...)` do bloco `buildScheduleOptions`, acrescente ao objeto esperado, logo antes de `days: [`:

```js
      accepts: ['byAi'],
```

O arquivo ainda não importa `invalidData` nem `ZAP_LEAD_MESSAGES`. Acrescente, logo depois do import de `'../_zapSchedule.js'`:

```js
import { invalidData, ZAP_LEAD_MESSAGES } from '../_zapLead.js';
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/zapSchedule.test.js`
Expected: FAIL nos três testes novos e no `buildScheduleOptions` (falta `accepts`).

- [ ] **Step 3: Leitura.** Em `readScheduleBody`, logo depois da conferência do `channel`, acrescente:

```js
  // Pedido feito pela IA do Stronizap em nome do consultor de plantão.
  if (body.byAi !== undefined && typeof body.byAi !== 'boolean') {
    return { refusal: invalidData('byAi', ZAP_LEAD_MESSAGES.byAi) };
  }
```

No `return { value: { ... } }`, logo depois de `channelName: ...,`, acrescente:

```js
      ...(body.byAi === true ? { byAi: true } : {}),
```

- [ ] **Step 4: Gravação.** Em `buildScheduleWrites`, acrescente `byAi = false` à lista de parâmetros (depois de `newRecordId = null,`) e, no objeto `interaction`, logo depois de `zapChannelName: channelName || null`, acrescente:

```js
    ,
    // A marca da IA. A ficha desenha a pílula "IA" ao lado da marca do Stronizap.
    ...(byAi ? { byAi: true } : {})
```

(Ajuste a vírgula: o objeto fica `via: ZAP_VIA, zapChannelName: channelName || null, ...(byAi ? { byAi: true } : {})`.)

- [ ] **Step 5: O aviso de que aceita.** Em `buildScheduleOptions`, logo antes de `days: suggestedDays(...)`, acrescente:

```js
    // O que esta versão da ponte aceita além do pedido de sempre. O smoke do
    // Stronizap confere o byAi antes de a IA começar a gravar.
    accepts: ['byAi'],
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run api/__tests__/zapSchedule.test.js api/__tests__/zapProfessor.test.js src/lib/__tests__/zapScheduleTimeline.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/_zapSchedule.js api/__tests__/zapSchedule.test.js
git commit -m "feat: agendamento pelo Stronizap aceita e grava a marca da IA"
```

---

### Task 4: A rota repassa a marca

**Files:**
- Modify: `api/zap.js` (`handleCreateLead` e `handleSchedule`)
- Test: `api/__tests__/zapRoute.test.js`

- [ ] **Step 1: Testes que falham.** No fim do bloco `describe('POST /api/zap com action create-lead', ...)`, acrescente:

```js
  it('pedido da IA no plantão da Ana: o lead é dela e o marco leva a marca da IA', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ byAi: true }), res);

    expect(res.statusCode).toBe(201);
    const [lead] = leadsDaAcademia();
    expect(lead).toMatchObject({ consultantId: 'u-ana', consultantName: 'Ana Souza' });
    expect(marcosDaAcademia()).toEqual([expect.objectContaining({
      type: 'zap_signup', byAi: true, consultantName: 'Ana Souza',
      text: 'Cadastrado pela IA do Stronizap no plantão de Ana Souza. Canal Recepção.'
    })]);
  });

  it('pedido da IA com dono escolhido é recusado e não grava nada', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ byAi: true, lead: { ownerId: 'u-bruno' } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: 'dados_invalidos', field: 'ownerId' });
    expect(leadsDaAcademia()).toEqual([]);
    expect(marcosDaAcademia()).toEqual([]);
  });
```

No fim do bloco `describe('POST /api/zap com action schedule', ...)`, acrescente:

```js
  it('pedido da IA: a interação do agendamento leva a marca da IA e a do Stronizap', async () => {
    const res = resposta();

    await handler(pedidoAgenda({ byAi: true }), res);

    expect(res.statusCode).toBe(201);
    expect(interacoesDaAcademia()).toEqual([expect.objectContaining({ via: 'stronizap', byAi: true, consultantName: 'Ana Souza' })]);
  });
```

O `400` com `dados_invalidos` é o que o `invalidData` de `api/_zapLead.js` responde. Confira no `responder` de `api/zap.js` se o corpo da recusa leva `error` e `field` com esses nomes; se o formato for outro, ajuste o `toMatchObject` ao que os testes de recusa de formato que já existem no arquivo esperam.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/zapRoute.test.js -t "pedido da IA"`
Expected: FAIL (o marco e a interação saem sem `byAi`). O teste da recusa já passa, porque a leitura da Task 1 recusa.

- [ ] **Step 3: Implementação.** Em `handleCreateLead`, troque a linha da desestruturação por:

```js
    const { phone, matchKey, email, actorName, channelName, byAi = false } = read.value;
```

e acrescente `byAi` na chamada de `buildZapSignupInteraction`:

```js
    const mark = buildZapSignupInteraction({
      leadId: leadRef.id, leadName: newLead.name, actor, owner: ownership.owner, channelName, serverTime, byAi
    });
```

Em `handleSchedule`, troque a desestruturação por:

```js
    const { matchKey, email, actorName, channelName, at, byAi = false } = read.value;
```

e acrescente `byAi` na chamada de `buildScheduleWrites`:

```js
      const writes = buildScheduleWrites({
        lead, actor, schedule, at, professors: catalogs.professors, channelName, close,
        openRecordId, newRecordId: newRecordRef ? newRecordRef.id : null, serverTime, increment, byAi
      });
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run api/__tests__/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/zap.js api/__tests__/zapRoute.test.js
git commit -m "feat: a ponte repassa a marca da IA ao cadastro e ao agendamento"
```

---

### Task 5: Os textos da ficha com a IA

**Files:**
- Modify: `src/lib/leads.js` (depois de `ZAP_VIA`)
- Modify: `src/lib/timeline.js` (`zapSignupPillText`, `zapScheduleTitle`, `appointmentOriginText`)
- Test: `src/lib/__tests__/timeline.test.js`

- [ ] **Step 1: Testes que falham.** No bloco `describe('agendamento feito pelo Stronizap', ...)` de `src/lib/__tests__/timeline.test.js`, acrescente:

```js
  it('zapScheduleTitle: agendamento da IA diz que foi a IA', () => {
    expect(zapScheduleTitle({ via: 'stronizap', byAi: true, zapChannelName: 'Recepção' })).toBe('Agendado pela IA do Stronizap, canal Recepção');
    expect(zapScheduleTitle({ via: 'stronizap', byAi: true })).toBe('Agendado pela IA do Stronizap');
  });

  it('appointmentOriginText: o rodapé do desfecho diz quando foi a IA', () => {
    const at = new Date(2026, 8, 29, 15, 42);
    expect(appointmentOriginText({ at, by: 'Ana Souza', via: 'stronizap', byAi: true }))
      .toBe('Agendada em 29/09 por Ana Souza, pela IA do Stronizap');
  });
```

No bloco que testa `zapSignupPillText` (o que tem `it('pílula: quem cadastrou, o dia e a hora', ...)`), acrescente:

```js
  it('pílula do cadastro da IA: no plantão de quem ficou com o lead', () => {
    expect(zapSignupPillText({ ...MARCO, byAi: true })).toBe('cadastrado pela IA do Stronizap no plantão de Johnny em 28/09 às 14:32');
  });
```

E um teste para o predicado novo, no mesmo arquivo, num bloco próprio:

```js
describe('isAiInteraction', () => {
  it('só byAi true conta', () => {
    expect(isAiInteraction({ byAi: true })).toBe(true);
    expect(isAiInteraction({ byAi: 'true' })).toBe(false);
    expect(isAiInteraction({})).toBe(false);
    expect(isAiInteraction(null)).toBe(false);
  });
});
```

Acrescente `import { isAiInteraction } from '../leads.js';` no topo do arquivo.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/timeline.test.js`
Expected: FAIL (`isAiInteraction` não existe e os textos são os antigos).

- [ ] **Step 3: Predicado.** Em `src/lib/leads.js`, logo depois de `export const ZAP_VIA = 'stronizap';`, acrescente:

```js
// Interação gravada pela IA do Stronizap em nome do consultor de plantão
// (api/zap.js, create-lead e schedule com byAi). A ficha desenha a pílula "IA"
// ao lado da marca do Stronizap.
export const isAiInteraction = (i) => i?.byAi === true;
```

- [ ] **Step 4: Textos.** Em `src/lib/timeline.js`, troque o import de `./leads.js` por:

```js
import { ZAP_SIGNUP_TYPE, ZAP_VIA, isAiInteraction } from './leads.js';
```

Troque `zapSignupPillText` por:

```js
export const zapSignupPillText = (i) => {
  const d = validDate(i?.createdAt);
  const autor = String(i?.consultantName || '').trim();
  const ia = isAiInteraction(i);
  return [
    ia ? 'cadastrado pela IA do Stronizap' : 'cadastrado pelo Stronizap',
    autor ? (ia ? `no plantão de ${autor}` : `por ${autor}`) : null,
    d ? `em ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} às ${pad2(d.getHours())}:${pad2(d.getMinutes())}` : null
  ].filter(Boolean).join(' ');
};
```

Troque `zapScheduleTitle` por:

```js
export const zapScheduleTitle = (i) => {
  if (i?.via !== ZAP_VIA) return null;
  const canal = String(i?.zapChannelName || '').trim();
  const quem = isAiInteraction(i) ? 'Agendado pela IA do Stronizap' : 'Agendado pelo Stronizap';
  return canal ? `${quem}, canal ${canal}` : quem;
};
```

Troque `appointmentOriginText` por:

```js
export const appointmentOriginText = ({ at, by = null, via = null, byAi = false } = {}) => {
  const d = validDate(at);
  if (!d) return '';
  const quem = String(by || '').trim();
  const origem = byAi === true ? ', pela IA do Stronizap' : via === ZAP_VIA ? ', pelo Stronizap' : '';
  return [`Agendada em ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`, quem ? ` por ${quem}` : '', origem].join('');
};
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/timeline.test.js`
Expected: PASS, inclusive os testes antigos dos três textos.

- [ ] **Step 6: Commit**

```bash
git add src/lib/leads.js src/lib/timeline.js src/lib/__tests__/timeline.test.js
git commit -m "feat: textos da ficha dizem quando a IA cadastrou ou agendou"
```

---

### Task 6: A pílula "IA" na ficha

**Files:**
- Create: `src/components/brand/AiBadge.jsx`
- Modify: `src/components/profile/TimelineAuthor.jsx`
- Modify: `src/components/profile/TimelineEvent.jsx`
- Modify: `src/components/profile/ZapSignupMarker.jsx`
- Modify: `src/views/LeadProfileView.jsx:873`
- Test: `src/lib/__tests__/timelineEvent.test.js`

- [ ] **Step 1: Testes que falham.** No fim do `describe('TimelineEvent', ...)` de `src/lib/__tests__/timelineEvent.test.js`, acrescente:

```js
  it('agendamento da IA: a pílula IA ao lado da marca do Stronizap, e o detalhe para o leitor de tela', () => {
    const out = html({
      id: 'a1', type: 'note', volumeKind: 'visita', via: 'stronizap', byAi: true, zapChannelName: 'Recepção',
      text: '🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 18:00.', consultantName: 'Ana Souza', createdAt: D(9, 29, 15, 42)
    });
    expect(out).toContain('>IA<');
    expect(out).toContain('Agendado pela IA do Stronizap, canal Recepção');
  });

  it('agendamento do Stronizap sem a IA não mostra a pílula', () => {
    const out = html({
      id: 'a2', type: 'note', volumeKind: 'visita', via: 'stronizap', zapChannelName: 'Recepção',
      text: '🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 18:00.', consultantName: 'Ana Souza', createdAt: D(9, 29, 15, 42)
    });
    expect(out).not.toContain('>IA<');
  });

  it('marco do cadastro da IA: a pílula IA e o texto do plantão', () => {
    const out = html({ id: 'z1', type: 'zap_signup', byAi: true, consultantName: 'Ana Souza', createdAt: D(9, 28, 14, 32) });
    expect(out).toContain('>IA<');
    expect(out).toContain('cadastrado pela IA do Stronizap no plantão de Ana Souza');
  });

  it('rodapé do desfecho de um agendamento da IA leva a pílula', () => {
    const i = { id: 'd1', type: 'daily_goal_done', text: '✅ Compareceu', appointmentOutcome: 'attended', consultantName: 'Ana', createdAt: D(10, 1, 18, 30) };
    const out = html(i, { outcomeOrigin: { d1: { at: D(9, 29, 15, 42), by: 'Ana Souza', via: 'stronizap', byAi: true } } });
    expect(out).toContain('pela IA do Stronizap');
    expect(out).toContain('>IA<');
  });
```

O desfecho usa o mesmo formato do teste de desfecho que já existe no arquivo (`daily_goal_done` com `appointmentOutcome`).

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/timelineEvent.test.js`
Expected: FAIL nos três testes que esperam `>IA<`.

- [ ] **Step 3: A pílula.** Crie `src/components/brand/AiBadge.jsx`:

```jsx
// A marca da IA do Stronizap na ficha: uma pílula "IA" do tamanho do círculo
// do Stronizap (StronizapBadge), ao lado dele. Vai no autor de um agendamento
// que a IA fez, no rodapé do desfecho desse agendamento e no marco de início
// do lead que a IA cadastrou. O texto inteiro ("Agendado pela IA do
// Stronizap") fica no title e no sr-only de quem a usa.
import { cn } from '@/lib/utils';

export function AiBadge({ className }) {
  return (
    <span
      aria-hidden="true"
      className={cn('grid h-[17px] shrink-0 place-items-center rounded-full bg-muted px-1.5 text-[9.5px] font-semibold leading-none text-foreground', className)}
    >
      IA
    </span>
  );
}
```

- [ ] **Step 4: O autor.** Troque `TimelineAuthor` em `src/components/profile/TimelineAuthor.jsx` por (o comentário do topo ganha uma linha: "Agendamento feito pela IA leva também a pílula IA."):

```jsx
import { cn } from '@/lib/utils';
import { AiBadge } from '../brand/AiBadge.jsx';
import { StronizapBadge } from '../brand/StronizapMark.jsx';

// A classe da coluna como ela era na ficha: a linha sem marca sai igual.
const COLUNA = 'text-[11px] text-slate-500 dark:text-slate-400 text-right truncate pt-0.5';

// `zapTitle` é o detalhe que zapScheduleTitle (lib/timeline.js) devolve, ou null
// quando a linha não é um agendamento do Stronizap. `ai` diz se foi a IA.
export function TimelineAuthor({ author, zapTitle = null, ai = false }) {
  return (
    <div
      className={cn(COLUNA, zapTitle && 'flex items-center justify-end gap-[5px]')}
      title={zapTitle || author}
    >
      {zapTitle ? (
        <>
          <StronizapBadge />
          {ai && <AiBadge />}
          <span className="truncate" title={author}>{author}</span>
          <span className="sr-only">{zapTitle}</span>
        </>
      ) : author}
    </div>
  );
}
```

- [ ] **Step 5: O evento.** Em `src/components/profile/TimelineEvent.jsx`:

Troque o import de `../../lib/leads.js` por:

```js
import { ZAP_VIA, isAiInteraction } from '../../lib/leads.js';
```

Acrescente o import:

```js
import { AiBadge } from '../brand/AiBadge.jsx';
```

Logo depois da linha `const zapTitle = i._kind === 'appointment' ? zapScheduleTitle(i) : null;`, acrescente:

```js
  const zapAi = Boolean(zapTitle) && isAiInteraction(i);
```

Troque `<TimelineAuthor author={author} zapTitle={zapTitle} />` por:

```jsx
            <TimelineAuthor author={author} zapTitle={zapTitle} ai={zapAi} />
```

No rodapé do desfecho, troque a linha `{origin.via === ZAP_VIA && <StronizapBadge />}` por:

```jsx
            {origin.via === ZAP_VIA && <StronizapBadge />}
            {origin.byAi === true && <AiBadge />}
```

- [ ] **Step 6: O marco.** Em `src/components/profile/ZapSignupMarker.jsx`, acrescente os imports:

```js
import { isAiInteraction } from '../../lib/leads.js';
import { AiBadge } from '../brand/AiBadge.jsx';
```

e, logo depois do `<span>` que envolve `<StronizapMark size={13} />` (o círculo de 22 px), acrescente:

```jsx
          {isAiInteraction(interaction) && <AiBadge />}
```

- [ ] **Step 7: A origem do desfecho.** Em `src/views/LeadProfileView.jsx`, na montagem do `outcomeOrigin`, troque:

```js
        map[i.id] = { at: lastScheduled.createdAt, by: lastScheduled.consultantName, via: lastScheduled.via ?? null };
```

por:

```js
        map[i.id] = { at: lastScheduled.createdAt, by: lastScheduled.consultantName, via: lastScheduled.via ?? null, byAi: lastScheduled.byAi === true };
```

e acrescente "`byAi` diz se foi a IA." ao fim do comentário que explica o `via`, logo acima.

- [ ] **Step 8: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/timelineEvent.test.js src/lib/__tests__/timeline.test.js src/lib/__tests__/profileTimeline.test.js`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/brand/AiBadge.jsx src/components/profile/TimelineAuthor.jsx src/components/profile/TimelineEvent.jsx src/components/profile/ZapSignupMarker.jsx src/views/LeadProfileView.jsx src/lib/__tests__/timelineEvent.test.js
git commit -m "feat: ficha mostra a marca da IA ao lado da do Stronizap"
```

---

### Task 7: Documentar e conferir a base

**Files:**
- Modify: `CLAUDE.md` (seção da ponte com o Stronizap; procure pelo título que fala de `api/zap.js` e do cadastro de lead pelo Stronizap)

- [ ] **Step 1: Documento.** Acrescente este parágrafo na seção da ponte com o Stronizap do `CLAUDE.md`:

```markdown
- **A marca da IA** (agente de IA do Stronizap, entrega 3). O `create-lead` e o `schedule` aceitam `byAi: true` no corpo. Quem pede é a IA do Stronizap, em nome do consultor de plantão, que vem no `actor.email` como sempre: ele é o dono do lead, o autor das interações e quem ganha o ponto na Meta. Com `byAi`, o `create-lead` recusa `lead.ownerId` preenchido (a IA nunca escolhe outro dono). A marca vai só nas interações (`byAi: true` no marco `zap_signup` e na nota do agendamento com `via: 'stronizap'`), e só quando é true, para o pedido de sempre gravar igual. A ficha desenha a pílula "IA" (`AiBadge`) ao lado da marca do Stronizap, no autor do agendamento, no rodapé do desfecho e no marco de início, pelos textos de `src/lib/timeline.js` (`isAiInteraction`, em `src/lib/leads.js`). O `schedule-options` responde `accepts: ['byAi']`, que o smoke do Stronizap confere antes de a IA gravar. Agendamento da IA num lead de outro consultor segue a regra do PR #243: a tarefa vai para o plantão.
```

Acrescente também uma linha na tabela de últimas atualizações do `CLAUDE.md` da raiz do STRONIX-FIRMA quando o PR entrar na `main` (fora deste repositório: avise o Johnny no PR).

- [ ] **Step 2: Conferir a base, igual ao CI**

```bash
npm run lint && npm test && npm run verificar:sentry && npm run build
```

Expected: tudo verde.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: registra a marca da IA na ponte com o Stronizap"
```

- [ ] **Step 4: PR.** Abra o PR com o título "feat: marca da IA no cadastro e no agendamento pelo Stronizap". No corpo, diga que esta entrega sobe antes da entrega 4 do Stronizap e que, sem o Stronizap mandar `byAi`, nada muda para as academias. O merge depende do OK do Johnny. As regras do Firestore não mudam, porque quem grava é o Admin SDK da ponte.

---

## Ordem de deploy

1. Este PR entra na `main` e a Vercel publica. Nada muda na tela: o Stronizap de produção não manda `byAi`.
2. No servidor do Stronizap, o smoke da entrega 4 (bloco [5]) passa a conferir `accepts: ['byAi']`. Só depois disso a entrega 4 liga o envio real.

## Conferência deste plano contra a spec

- "e-mail do consultor de plantão como dono e autor, quando o pedido vem da IA": já era o caminho do `actor.email`; a Task 1 só impede que a IA escolha outro dono.
- "a marca 'feito pela IA'": Tasks 2 a 6.
- "o Stronilead sobe primeiro": seção Ordem de deploy e o `accepts` da Task 3.
