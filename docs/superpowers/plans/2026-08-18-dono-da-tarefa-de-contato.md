# Dono da tarefa de contato Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir escolher, ao agendar mensagem ou ligação, para qual consultor vai a tarefa na Meta Diária.

**Architecture:** Dois campos novos no lead (`nextFollowUpOwnerId`, `nextFollowUpOwnerName`), com ausente significando o dono do lead. Uma função pura decide o roteamento, a Meta ganha um segundo laço só para contatos delegados, e o wizard ganha um seletor opcional nos tipos Mensagem e Ligação.

**Tech Stack:** React 19 + Vite, Firestore, Vitest. Sem TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-18-dono-da-tarefa-de-contato-design.md`

Sem query nova, sem índice, sem regra do Firestore, sem migração.

---

### Task 1: `contactOwnerId`, a regra de roteamento

**Files:** Modify `src/lib/leads.js` · Test `src/lib/__tests__/leads.test.js`

- [ ] **Step 1: Teste que falha**

```js
describe('contactOwnerId', () => {
  it('sem campo, a tarefa é do dono do lead', () => {
    expect(contactOwnerId({ consultantId: 'u1' })).toBe('u1');
  });
  it('com campo, a tarefa é de quem foi escolhido', () => {
    expect(contactOwnerId({ consultantId: 'u1', nextFollowUpOwnerId: 'u2' })).toBe('u2');
  });
  it('lead sem consultor e sem escolha devolve null', () => {
    expect(contactOwnerId({})).toBeNull();
    expect(contactOwnerId(null)).toBeNull();
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/__tests__/leads.test.js` → FAIL, `contactOwnerId is not a function`

- [ ] **Step 3: Implementar em `src/lib/leads.js`**

```js
// Dono da TAREFA de contato (mensagem/ligação) na Meta Diária. Ausente
// significa o dono do lead, então lead antigo continua se comportando como
// antes e não precisa de migração. Só vale para contato: visita e aula não têm
// dono de tarefa (ver spec, decisão 1).
export const contactOwnerId = (lead) => lead?.nextFollowUpOwnerId || lead?.consultantId || null;
```

- [ ] **Step 4:** `npx vitest run src/lib/__tests__/leads.test.js` → PASS
- [ ] **Step 5:** `git commit -m "feat(meta): contactOwnerId decide o dono da tarefa de contato"`

---

### Task 2: Roteamento na Meta Diária

**Files:** Modify `src/lib/dailyGoal.js` · Test `src/lib/__tests__/dailyGoal.test.js`

- [ ] **Step 1: Testes que falham**

```js
describe('contato delegado a outro consultor', () => {
  const hoje = new Date(2026, 6, 15, 16, 0);

  it('aparece na Meta de quem RECEBEU, mesmo não sendo dono do lead', () => {
    const l = lead({ consultantId: 'outro', nextFollowUp: hoje, nextFollowUpType: 'Mensagem', nextFollowUpOwnerId: 'u1' });
    expect(byId(slots([l]), l.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.CONTATO_HOJE]);
  });

  it('SOME da Meta do dono do lead quando delegado', () => {
    const l = lead({ consultantId: 'u1', nextFollowUp: hoje, nextFollowUpType: 'Mensagem', nextFollowUpOwnerId: 'outro' });
    expect(byId(slots([l]), l.id)).toBeUndefined();
  });

  it('delegação NÃO arrasta as outras tarefas do lead para quem recebeu', () => {
    const l = lead({
      consultantId: 'outro', nextFollowUp: hoje, nextFollowUpType: 'Mensagem', nextFollowUpOwnerId: 'u1',
      appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 6, 15, 18, 0),
      createdAt: new Date(2026, 6, 14, 12, 0),
    });
    // só o contato: a aula de hoje e o novo 24h continuam sendo do dono do lead
    expect(byId(slots([l]), l.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.CONTATO_HOJE]);
  });

  it('sem o campo, a tarefa continua indo para o dono do lead', () => {
    const l = lead({ consultantId: 'u1', nextFollowUp: hoje, nextFollowUpType: 'Mensagem' });
    expect(byId(slots([l]), l.id).categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.CONTATO_HOJE]);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/__tests__/dailyGoal.test.js` → FAIL nos dois primeiros

- [ ] **Step 3: Implementar em `computeDailyGoalSlots`**

Importar `contactOwnerId` de `./leads.js`. Depois de `myLeads`, acrescentar:

```js
  // Contato DELEGADO: lead de outro consultor cuja tarefa de contato foi
  // atribuída a mim. Não entra em myLeads de propósito — delegar um contato não
  // arrasta visita, aula, atrasado nem novo 24h do lead (spec, decisão 3).
  const delegatedContactLeads = (leads || []).filter(
    l => l.consultantId !== consultantId && l.nextFollowUpOwnerId === consultantId
  );
```

Extrair o corpo da categoria 5 para uma função local, chamada pelos dois laços:

```js
  const addContactTodayIfDue = (lead) => {
    if (contactOwnerId(lead) !== consultantId) return;
    if (lead.status === 'Perda') return;
    if (lead.status === 'Venda' && lead.lifecycleStage !== 'cliente') return;
    if (!lead.nextFollowUp || lead.nextFollowUp < todayStart || lead.nextFollowUp > todayEnd) return;
    if (normalizeAppointmentType(lead.nextFollowUpType)) return; // eco do compromisso
    addTarget(lead, DAILY_GOAL_CATEGORY_LABEL.contato_hoje, DAILY_GOAL_CATEGORIES.CONTATO_HOJE);
  };
```

Dentro do laço de `myLeads`, a categoria 5 vira `addContactTodayIfDue(lead)`. Depois do laço, acrescentar `delegatedContactLeads.forEach(addContactTodayIfDue)`.

- [ ] **Step 4:** `npx vitest run` → PASS, nenhum teste existente quebrado
- [ ] **Step 5:** `git commit -m "feat(meta): contato delegado vai para a Meta de quem recebeu"`

---

### Task 3: Gravar o dono no agendamento

**Files:** Modify `src/lib/schedulePatch.js` · Test `src/lib/__tests__/schedulePatch.test.js`

- [ ] **Step 1: Testes que falham**

```js
describe('buildSchedulePatch — dono da tarefa', () => {
  it('mensagem grava o dono escolhido', () => {
    const p = buildSchedulePatch({ typeLabel: 'Mensagem', date: MSG, contactOwnerId: 'u2', contactOwnerName: 'Maria' });
    expect(p.nextFollowUpOwnerId).toBe('u2');
    expect(p.nextFollowUpOwnerName).toBe('Maria');
  });
  it('sem escolha, grava null (volta para o dono do lead)', () => {
    const p = buildSchedulePatch({ typeLabel: 'Mensagem', date: MSG });
    expect(p.nextFollowUpOwnerId).toBeNull();
    expect(p.nextFollowUpOwnerName).toBeNull();
  });
  it('visita e aula NÃO têm dono de tarefa', () => {
    for (const typeLabel of ['Visita', 'Aula Experimental']) {
      const p = buildSchedulePatch({ typeLabel, date: AULA, contactOwnerId: 'u2' });
      expect(p).not.toHaveProperty('nextFollowUpOwnerId');
    }
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/__tests__/schedulePatch.test.js` → FAIL

- [ ] **Step 3: Implementar**

Acrescentar `contactOwnerId = null, contactOwnerName = null` aos parâmetros. No bloco de contato (antes do `return patch` de mensagem/ligação), gravar:

```js
    // Dono da TAREFA. Explicitamente null quando ninguém escolhe: agendamento
    // novo não pode herdar o delegado do agendamento anterior.
    patch.nextFollowUpOwnerId = contactOwnerId || null;
    patch.nextFollowUpOwnerName = contactOwnerId ? (contactOwnerName || null) : null;
```

- [ ] **Step 4:** `npx vitest run` → PASS
- [ ] **Step 5:** `git commit -m "feat(agendamentos): patch grava o dono da tarefa de contato"`

---

### Task 4: Seletor no wizard e rastro na linha do tempo

**Files:** Modify `src/components/profile/ScheduleWizard.jsx`, `src/views/LeadProfileView.jsx`

- [ ] **Step 1: Seletor no wizard**

No `ScheduleWizard`, estado novo `const [ownerId, setOwnerId] = useState(null)`. No passo `datahora`, visível só quando `type.id === 'mensagem' || type.id === 'ligacao'`, um `<select>` ao lado do campo de observação:

- primeira opção, `value=""`: `Responsável pelo lead`
- demais: os usuários ativos recebidos por prop `usersList`

Incluir no `onConfirm`: `contactOwnerId: ownerId || null`, `contactOwnerName: <nome do escolhido> || null`. Resetar em `resetAll()`.

- [ ] **Step 2: Passar a lista de usuários**

Em `LeadProfileView`, passar `usersList` ao `<ScheduleWizard>`, filtrando só ativos.

- [ ] **Step 3: Rastro na nota**

Em `handleWizardConfirm`, quando `contactOwnerId` existir e for diferente de `lead.consultantId`, acrescentar ao texto: `` ` · tarefa de ${contactOwnerName}` ``.

- [ ] **Step 4:** `npx vitest run && npx eslint . && npm run build` → tudo limpo
- [ ] **Step 5:** `git commit -m "feat(wizard): seletor de dono da tarefa em mensagem e ligação"`

---

### Task 5: Fechamento

- [ ] Suíte completa, lint sem erro novo, build limpo
- [ ] Push e abrir PR linkando o spec
- [ ] No corpo do PR: sem passo de deploy, sem índice, sem regra, sem migração

## Critério de pronto

- [ ] Sem o seletor, comportamento idêntico ao de hoje
- [ ] Contato delegado aparece só para quem recebeu
- [ ] Delegação não arrasta as outras categorias do lead
- [ ] Visita e aula seguem sem dono de tarefa
- [ ] Reagendar pela Meta preserva o dono
