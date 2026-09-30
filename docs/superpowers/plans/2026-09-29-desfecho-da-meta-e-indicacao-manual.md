# Marcar desfecho na Meta e indicação à mão — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o switch de presença da Meta Diária pelo botão "Marcar desfecho" com balão e correção que desfaz o Compareceu, e dar à ficha do cliente o cadastro de indicações à mão, em sequência.

**Architecture:** As regras ficam em módulos puros testados em node (`outcomeCorrection.js`, `outcomeMenu.js` e as funções novas de `referrals.js`). A gravação fica em `appointmentOutcome.js`, que ganha `correctAppointmentOutcome`. As telas só apresentam: um `OutcomePopover` serve a Agenda de hoje, o card "A fazer", o Próximo compromisso e o "Feitos hoje". Um `QuickReferralModal` reaproveita `buildNewLeadDoc` e `commitReferralLink`.

**Tech Stack:** React 19, Vite 8, Tailwind v4, shadcn (Popover e Dialog do `radix-ui`), Firebase Web SDK 12, Vitest 4 (node e jsdom).

**Spec:** `docs/superpowers/specs/2026-09-29-desfecho-da-meta-e-indicacao-manual-design.md`

**Linha de base (29/09/2026, depois de `npm ci`):** 141 arquivos, 3099 testes passando. `npx eslint .` com 0 erros e 1 aviso.

**Comandos:**

- Um teste: `npx vitest run src/lib/__tests__/<arquivo>.test.js`
- Todos os testes: `npx vitest run`
- Lint: `npx eslint .` (precisa continuar com 0 erros)
- Build: `npm run build`

**Commits:** em português, formato `tipo: descrição curta`, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/lib/outcomeCorrection.js` | criar | Regras puras: promoção do Compareceu, volta da etapa, o que desfazer, desfecho corrigível, textos |
| `src/lib/outcomeMenu.js` | criar | Opções puras do balão e rótulo do botão |
| `src/lib/appointmentOutcome.js` | alterar | Usa `planPromotion`, grava `appointmentPromotedFrom`, marca de correção, `correctAppointmentOutcome` |
| `src/components/dailygoal/OutcomePopover.jsx` | criar | Botão "Marcar desfecho" e balão (Popover do shadcn) |
| `src/components/dailygoal/DayAgendaCard.jsx` | alterar | Troca o switch pelo `OutcomePopover` e pinta a falta de vermelho |
| `src/components/ui/PresenceSwitch.jsx` | apagar | Só a agenda usava |
| `src/views/DailyGoalView.jsx` | alterar | `TaskCard`, `NextUp` e `DoneCard` com o balão, `markAgendaPresence`, `handleOutcome`, `handleCorrectOutcome` e `handleReschedule` |
| `src/lib/crm/appointments.js` | alterar | Só o comentário do espelho, que ficou velho |
| `src/lib/referrals.js` | alterar | `REFERRAL_SOURCE_NAME`, `quickReferralForm`, `quickReferralIssue` |
| `src/modals/QuickReferralModal.jsx` | criar | Pop-up de cadastro de indicações em sequência |
| `src/components/profile/ReferralsSection.jsx` | alterar | Prop `onAdd`, botão e texto do vazio |
| `src/views/LeadProfileView.jsx` | alterar | Menu "Indicar", estado do pop-up e montagem |
| `src/lib/wiki.js`, `src/components/help/WikiDemo.jsx`, `src/lib/announcements.js`, `docs/indicacoes.md`, `CLAUDE.md` | alterar | Ajuda, novidade e documentação |
| Testes novos | criar | `outcomeCorrection.test.js`, `outcomeMenu.test.js`, `appointmentOutcome.test.js`, `outcomePopover.test.js`, `dayAgendaCard.test.js`, `referralsSection.test.js` |
| Testes alterados | alterar | `crm.appointments.test.js`, `referrals.test.js`, `metaLinks.test.js` |

---

### Task 1: Regras puras da correção (`outcomeCorrection.js`)

**Files:**
- Create: `src/lib/outcomeCorrection.js`
- Test: `src/lib/__tests__/outcomeCorrection.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/__tests__/outcomeCorrection.test.js`:

```js
// Regras puras da correção do desfecho na Meta Diária: para onde o Compareceu
// leva o lead, quando a correção devolve a etapa, o que desfazer e qual
// desfecho o balão ainda pode trocar.
import { describe, it, expect } from 'vitest';
import {
  planPromotion,
  stageToRevert,
  planAttendedUndo,
  correctableOutcome,
  correctionText,
  revertStageText,
} from '../outcomeCorrection.js';
import { DAILY_GOAL_CATEGORIES } from '../leads.js';

const VISITA = DAILY_GOAL_CATEGORIES.VISITA_HOJE;
const AULA = DAILY_GOAL_CATEGORIES.AULA_HOJE;
const STATUSES = [
  { funnelId: 'f1', name: 'Novo' },
  { funnelId: 'f1', name: 'Negociação' },
  { funnelId: 'f2', name: 'Contato' },
];
const entrou = new Date(2026, 8, 20, 10);
const LEAD = { id: 'l1', funnelId: 'f1', status: 'Novo', statusEnteredAt: entrou };
const NENHUMA = { toStatus: null, promotedFrom: null };

describe('planPromotion', () => {
  it('Compareceu de visita leva para Negociação e guarda de onde saiu', () => {
    expect(planPromotion({ lead: LEAD, outcome: 'attended', categorySlug: VISITA, statuses: STATUSES })).toEqual({
      toStatus: 'Negociação',
      promotedFrom: { status: 'Novo', statusEnteredAt: entrou, funnelId: 'f1', toStatus: 'Negociação' },
    });
  });

  it('vale também para aula experimental', () => {
    expect(planPromotion({ lead: LEAD, outcome: 'attended', categorySlug: AULA, statuses: STATUSES }).toStatus)
      .toBe('Negociação');
  });

  it('não promove quem já está em Negociação, Venda ou Perda', () => {
    for (const status of ['Negociação', 'Venda', 'Perda']) {
      expect(planPromotion({ lead: { ...LEAD, status }, outcome: 'attended', categorySlug: VISITA, statuses: STATUSES }))
        .toEqual(NENHUMA);
    }
  });

  it('não promove Não compareceu, Cancelou, outra categoria, promote desligado ou funil sem Negociação', () => {
    expect(planPromotion({ lead: LEAD, outcome: 'no_show', categorySlug: VISITA, statuses: STATUSES })).toEqual(NENHUMA);
    expect(planPromotion({ lead: LEAD, outcome: 'cancelled', categorySlug: VISITA, statuses: STATUSES })).toEqual(NENHUMA);
    expect(planPromotion({ lead: LEAD, outcome: 'attended', categorySlug: DAILY_GOAL_CATEGORIES.CONTATO_HOJE, statuses: STATUSES }))
      .toEqual(NENHUMA);
    expect(planPromotion({ lead: LEAD, outcome: 'attended', categorySlug: VISITA, statuses: STATUSES, promote: false }))
      .toEqual(NENHUMA);
    expect(planPromotion({ lead: { ...LEAD, funnelId: 'f2' }, outcome: 'attended', categorySlug: VISITA, statuses: STATUSES }))
      .toEqual(NENHUMA);
  });

  it('lead sem data de entrada na etapa guarda null', () => {
    const { promotedFrom } = planPromotion({
      lead: { id: 'l1', funnelId: 'f1', status: 'Novo' }, outcome: 'attended', categorySlug: VISITA, statuses: STATUSES,
    });
    expect(promotedFrom.statusEnteredAt).toBeNull();
  });
});

const PROMOVIDO = {
  ...LEAD,
  status: 'Negociação',
  appointmentPromotedFrom: { status: 'Novo', statusEnteredAt: entrou, funnelId: 'f1', toStatus: 'Negociação' },
};

describe('stageToRevert', () => {
  it('devolve de onde saiu quando o lead continua onde o Compareceu o deixou', () => {
    expect(stageToRevert(PROMOVIDO)).toEqual(PROMOVIDO.appointmentPromotedFrom);
  });

  it('não devolve se alguém moveu o lead depois, se o funil mudou, sem o campo ou sem etapa de origem', () => {
    expect(stageToRevert({ ...PROMOVIDO, status: 'Proposta' })).toBeNull();
    expect(stageToRevert({ ...PROMOVIDO, funnelId: 'f2' })).toBeNull();
    expect(stageToRevert({ ...PROMOVIDO, appointmentPromotedFrom: null })).toBeNull();
    expect(stageToRevert({ ...PROMOVIDO, appointmentPromotedFrom: { ...PROMOVIDO.appointmentPromotedFrom, status: '' } }))
      .toBeNull();
    expect(stageToRevert(null)).toBeNull();
  });
});

describe('planAttendedUndo', () => {
  const agendado = new Date(2026, 8, 29, 18);
  const lead = { ...PROMOVIDO, appointmentScheduledFor: agendado, nextFollowUp: null };

  it('Compareceu desfeito: volta a etapa com a data antiga e o próximo contato vira o horário do agendamento', () => {
    expect(planAttendedUndo({ lead, fromOutcome: 'attended' })).toEqual({
      patch: { appointmentPromotedFrom: null, status: 'Novo', statusEnteredAt: entrou, nextFollowUp: agendado },
      revertedTo: 'Novo',
    });
  });

  it('próximo contato já agendado depois do Compareceu fica como está', () => {
    const depois = new Date(2026, 9, 1, 9);
    expect(planAttendedUndo({ lead: { ...lead, nextFollowUp: depois }, fromOutcome: 'attended' }).patch)
      .toEqual({ appointmentPromotedFrom: null, status: 'Novo', statusEnteredAt: entrou });
  });

  it('lead movido depois do Compareceu: a etapa fica, o próximo contato volta', () => {
    expect(planAttendedUndo({ lead: { ...lead, status: 'Proposta' }, fromOutcome: 'attended' })).toEqual({
      patch: { appointmentPromotedFrom: null, nextFollowUp: agendado },
      revertedTo: null,
    });
  });

  it('cliente: nada de etapa nem de próximo contato', () => {
    expect(planAttendedUndo({ lead, fromOutcome: 'attended', isClient: true }))
      .toEqual({ patch: { appointmentPromotedFrom: null }, revertedTo: null });
  });

  it('Não compareceu desfeito não mexe no próximo contato', () => {
    expect(planAttendedUndo({ lead: { ...lead, appointmentPromotedFrom: null, status: 'Novo' }, fromOutcome: 'no_show' }))
      .toEqual({ patch: { appointmentPromotedFrom: null }, revertedTo: null });
  });

  it('origem sem data de entrada: volta só a etapa', () => {
    const semData = { ...lead, appointmentPromotedFrom: { ...lead.appointmentPromotedFrom, statusEnteredAt: null } };
    expect(planAttendedUndo({ lead: semData, fromOutcome: 'attended' }).patch)
      .toEqual({ appointmentPromotedFrom: null, status: 'Novo', nextFollowUp: agendado });
  });
});

describe('correctableOutcome', () => {
  const now = new Date(2026, 8, 29, 15);
  const hoje = (h) => new Date(2026, 8, 29, h);
  const base = { appointmentOutcome: 'attended', appointmentOutcomeAt: hoje(14), appointmentScheduledFor: hoje(13) };

  it('Compareceu ou Não compareceu de hoje, com o agendamento de hoje', () => {
    expect(correctableOutcome(base, now)).toBe('attended');
    expect(correctableOutcome({ ...base, appointmentOutcome: 'no_show' }, now)).toBe('no_show');
  });

  it('nada a corrigir: cancelado, sem desfecho, desfecho de ontem ou agendamento em outro dia', () => {
    expect(correctableOutcome({ ...base, appointmentOutcome: 'cancelled' }, now)).toBeNull();
    expect(correctableOutcome({ ...base, appointmentOutcome: null }, now)).toBeNull();
    expect(correctableOutcome({ ...base, appointmentOutcomeAt: new Date(2026, 8, 28, 14) }, now)).toBeNull();
    expect(correctableOutcome({ ...base, appointmentScheduledFor: new Date(2026, 8, 30, 9) }, now)).toBeNull();
    expect(correctableOutcome(null, now)).toBeNull();
  });
});

describe('textos', () => {
  it('a marca de correção diz o desfecho novo, de onde veio e a categoria', () => {
    expect(correctionText({ outcome: 'no_show', sourceLabel: 'Agenda do dia', categoryLabel: 'Visita hoje' }))
      .toBe('↩️ Desfecho corrigido: ❌ Não veio · Agenda do dia (Visita hoje)');
    expect(correctionText({ outcome: 'attended', sourceLabel: 'Meta Diária', categoryLabel: 'Aula hoje' }))
      .toBe('↩️ Desfecho corrigido: ✅ Compareceu · Meta Diária (Aula hoje)');
  });

  it('a volta de etapa diz para onde', () => {
    expect(revertStageText('Novo')).toBe('Fase voltou para [Novo] após correção do desfecho.');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/outcomeCorrection.test.js`
Expected: FAIL, "Failed to resolve import ../outcomeCorrection.js".

- [ ] **Step 3: Implementar**

Criar `src/lib/outcomeCorrection.js`:

```js
// Correção do desfecho de visita e aula na Meta Diária. Puro: sem React e sem
// SDK, testado em node. Quem grava é src/lib/appointmentOutcome.js.
//
// O Compareceu de um lead leva ele para Negociação. Para a correção conseguir
// desfazer isso, o lead guarda de onde saiu em `appointmentPromotedFrom`
// ({ status, statusEnteredAt, funnelId, toStatus }). Toda gravação de desfecho
// escreve o campo, com null quando não houve promoção. Assim ele sempre fala do
// desfecho atual, e nunca de um agendamento antigo.

import { DAILY_GOAL_CATEGORIES, getAppointmentOutcomeMeta, getLeadAppointmentDate } from './leads.js';
import { getSafeDateOrNull } from './dates.js';

const isApptCategory = (slug) =>
  slug === DAILY_GOAL_CATEGORIES.VISITA_HOJE || slug === DAILY_GOAL_CATEGORIES.AULA_HOJE;

const sameLocalDay = (a, b) =>
  a instanceof Date && b instanceof Date &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

// Promoção do Compareceu: a etapa Negociação do funil do lead, quando ela
// existe e o lead ainda não está nela, em Venda ou em Perda. Com `promote`
// desligado (cliente na agenda), nunca promove.
export function planPromotion({ lead, outcome, categorySlug, statuses, promote = true }) {
  const none = { toStatus: null, promotedFrom: null };
  if (!promote || outcome !== 'attended' || !isApptCategory(categorySlug)) return none;
  const neg = (statuses || []).find(
    (s) => s.funnelId === lead?.funnelId && (s.name || '').trim().toLowerCase() === 'negociação'
  );
  if (!neg || lead.status === neg.name || lead.status === 'Venda' || lead.status === 'Perda') return none;
  return {
    toStatus: neg.name,
    promotedFrom: {
      status: lead.status ?? null,
      statusEnteredAt: lead.statusEnteredAt ?? null,
      funnelId: lead.funnelId ?? null,
      toStatus: neg.name,
    },
  };
}

// Etapa para onde a correção devolve o lead, ou null. Só devolve quando o lead
// continua onde o Compareceu o deixou: mesma etapa e mesmo funil. Se alguém o
// moveu depois, a escolha dessa pessoa vale mais que a correção.
export function stageToRevert(lead) {
  const from = lead?.appointmentPromotedFrom;
  if (!from || typeof from.status !== 'string' || !from.status) return null;
  if (!from.toStatus || lead.status !== from.toStatus) return null;
  if ((lead.funnelId ?? null) !== (from.funnelId ?? null)) return null;
  return from;
}

// O que tirar do lead ao trocar para Não compareceu ou ao desfazer a marca.
// `patch` vai junto da gravação e `revertedTo` é a etapa devolvida, ou null.
// O próximo contato volta ao horário do agendamento quando o desfeito é um
// Compareceu de quem não é cliente e ninguém agendou outro contato depois,
// porque o Compareceu o tinha limpado.
export function planAttendedUndo({ lead, fromOutcome, isClient = false }) {
  const patch = { appointmentPromotedFrom: null };
  const from = isClient ? null : stageToRevert(lead);
  if (from) {
    patch.status = from.status;
    if (from.statusEnteredAt) patch.statusEnteredAt = from.statusEnteredAt;
  }
  if (fromOutcome === 'attended' && !isClient && !lead?.nextFollowUp && lead?.appointmentScheduledFor) {
    patch.nextFollowUp = lead.appointmentScheduledFor;
  }
  return { patch, revertedTo: from ? from.status : null };
}

// Desfecho que o balão de correção pode trocar: Compareceu ou Não compareceu
// registrado hoje, com o agendamento do lead ainda hoje. Depois de remarcar ou
// de cancelar não sobra o que corrigir.
export function correctableOutcome(lead, now) {
  const outcome = lead?.appointmentOutcome;
  if (outcome !== 'attended' && outcome !== 'no_show') return null;
  if (!sameLocalDay(getSafeDateOrNull(lead.appointmentOutcomeAt), now)) return null;
  if (!sameLocalDay(getLeadAppointmentDate(lead), now)) return null;
  return outcome;
}

export const correctionText = ({ outcome, sourceLabel, categoryLabel }) => {
  const meta = getAppointmentOutcomeMeta(outcome);
  return `↩️ Desfecho corrigido: ${meta.icon} ${meta.label} · ${sourceLabel} (${categoryLabel})`;
};

export const revertStageText = (status) => `Fase voltou para [${status}] após correção do desfecho.`;
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/outcomeCorrection.test.js`
Expected: PASS, todos os testes.

Se `DAILY_GOAL_CATEGORIES.CONTATO_HOJE` não existir com esse nome, conferir em `src/lib/leads.js` e usar a chave de contato que existe (é a categoria "Contato hoje").

- [ ] **Step 5: Commit**

```bash
git add src/lib/outcomeCorrection.js src/lib/__tests__/outcomeCorrection.test.js
git commit -m "feat: regras puras da correção do desfecho da Meta

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Opções do balão (`outcomeMenu.js`)

**Files:**
- Create: `src/lib/outcomeMenu.js`
- Test: `src/lib/__tests__/outcomeMenu.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/__tests__/outcomeMenu.test.js`:

```js
// Opções do balão "Marcar desfecho" em cada estado, e o rótulo do botão.
import { describe, it, expect } from 'vitest';
import { outcomeMenuItems, outcomeTriggerLabel } from '../outcomeMenu.js';

const ids = (items) => items.map((i) => i.id);

describe('outcomeMenuItems', () => {
  it('sem desfecho: Compareceu e Não compareceu', () => {
    expect(outcomeMenuItems({})).toEqual([
      { id: 'attended', label: 'Compareceu', tone: 'success' },
      { id: 'no_show', label: 'Não compareceu', tone: 'danger' },
    ]);
  });

  it('card A fazer: Remarcou e Cancelou embaixo', () => {
    expect(ids(outcomeMenuItems({ withMore: true }))).toEqual(['attended', 'no_show', 'rescheduled', 'cancelled']);
  });

  it('marcado: só a troca, e o desfazer quando a tela permite', () => {
    expect(outcomeMenuItems({ outcome: 'attended' })).toEqual([
      { id: 'no_show', label: 'Trocar para não compareceu', tone: 'danger' },
    ]);
    expect(outcomeMenuItems({ outcome: 'no_show', canUndo: true })).toEqual([
      { id: 'attended', label: 'Trocar para compareceu', tone: 'success' },
      { id: 'undo', label: 'Desfazer marcação', tone: 'neutral' },
    ]);
  });

  it('marcado ignora o withMore', () => {
    expect(ids(outcomeMenuItems({ outcome: 'attended', withMore: true }))).toEqual(['no_show']);
  });
});

describe('outcomeTriggerLabel', () => {
  it('mostra o desfecho, ou o convite quando não há', () => {
    expect(outcomeTriggerLabel(null)).toBe('Marcar desfecho');
    expect(outcomeTriggerLabel('attended')).toBe('Compareceu');
    expect(outcomeTriggerLabel('no_show')).toBe('Não compareceu');
    expect(outcomeTriggerLabel('cancelled')).toBe('Marcar desfecho');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/outcomeMenu.test.js`
Expected: FAIL, "Failed to resolve import ../outcomeMenu.js".

- [ ] **Step 3: Implementar**

Criar `src/lib/outcomeMenu.js`:

```js
// Opções do balão "Marcar desfecho" da Meta Diária (OutcomePopover). Puro.
//   outcome  : desfecho atual ('attended', 'no_show' ou null)
//   withMore : sem desfecho, oferece também Remarcou e Cancelou (card A fazer
//              e Próximo compromisso)
//   canUndo  : com desfecho, oferece Desfazer marcação (só a Agenda de hoje)
// Os ids são o que o onPick recebe: 'attended', 'no_show', 'rescheduled',
// 'cancelled' e 'undo'.

const LABEL = { attended: 'Compareceu', no_show: 'Não compareceu' };

export function outcomeMenuItems({ outcome = null, withMore = false, canUndo = false } = {}) {
  if (outcome === 'attended' || outcome === 'no_show') {
    const other = outcome === 'attended' ? 'no_show' : 'attended';
    const items = [{
      id: other,
      label: `Trocar para ${LABEL[other].toLowerCase()}`,
      tone: other === 'attended' ? 'success' : 'danger',
    }];
    if (canUndo) items.push({ id: 'undo', label: 'Desfazer marcação', tone: 'neutral' });
    return items;
  }
  const items = [
    { id: 'attended', label: LABEL.attended, tone: 'success' },
    { id: 'no_show', label: LABEL.no_show, tone: 'danger' },
  ];
  if (withMore) {
    items.push({ id: 'rescheduled', label: 'Remarcou', tone: 'neutral' });
    items.push({ id: 'cancelled', label: 'Cancelou', tone: 'neutral' });
  }
  return items;
}

export const outcomeTriggerLabel = (outcome) => LABEL[outcome] || 'Marcar desfecho';
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/outcomeMenu.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/outcomeMenu.js src/lib/__tests__/outcomeMenu.test.js
git commit -m "feat: opções do balão de desfecho da Meta

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Gravação e correção do desfecho (`appointmentOutcome.js`)

**Files:**
- Modify: `src/lib/appointmentOutcome.js` (arquivo inteiro reescrito abaixo)
- Test: `src/lib/__tests__/appointmentOutcome.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/__tests__/appointmentOutcome.test.js`:

```js
// Gravação do desfecho e da correção, sem Firebase de verdade: o SDK, o
// firebase.js, o logInteraction e o histórico de aulas são falsos e anotam o
// que receberam.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ updates: [], adds: [], logs: [], aula: [] }));

vi.mock('../firebase.js', () => ({ appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter' }));
vi.mock('firebase/firestore', () => ({
  doc: (...p) => ({ path: p.slice(1).join('/') }),
  collection: (...p) => ({ path: p.slice(1).join('/') }),
  updateDoc: async (ref, data) => { m.updates.push({ path: ref.path, data }); },
  addDoc: async (ref, data) => { m.adds.push({ path: ref.path, data }); return { id: 'novo' }; },
  serverTimestamp: () => 'TS',
}));
vi.mock('../interactions.js', () => ({
  logInteraction: async (_db, lead, _user, payload, patch = null) => {
    m.logs.push({ leadId: lead.id, payload, patch });
    return 'i1';
  },
}));
vi.mock('../aulasWrites.js', () => ({
  applyOutcomeToAula: async ({ outcome }) => { m.aula.push(['apply', outcome]); },
  clearAulaOutcome: async () => { m.aula.push(['clear']); },
}));

const { writeAppointmentOutcome, correctAppointmentOutcome } = await import('../appointmentOutcome.js');
const { DAILY_GOAL_CATEGORIES } = await import('../leads.js');

const VISITA = DAILY_GOAL_CATEGORIES.VISITA_HOJE;
const AULA = DAILY_GOAL_CATEGORIES.AULA_HOJE;
const USER = { id: 'u1', authUid: 'auth1', name: 'Lucas' };
const STATUSES = [{ funnelId: 'f1', name: 'Novo' }, { funnelId: 'f1', name: 'Negociação' }];
const entrou = new Date(2026, 8, 20, 10);
const agendado = new Date(2026, 8, 29, 18);
const NOVO = {
  id: 'l1', name: 'Ana', funnelId: 'f1', status: 'Novo', statusEnteredAt: entrou,
  consultantId: 'c1', consultantAuthUid: 'a1', appointmentScheduledFor: agendado, nextFollowUp: agendado,
};
const PROMOVIDO = {
  ...NOVO,
  status: 'Negociação',
  nextFollowUp: null,
  appointmentOutcome: 'attended',
  appointmentPromotedFrom: { status: 'Novo', statusEnteredAt: entrou, funnelId: 'f1', toStatus: 'Negociação' },
};

beforeEach(() => { m.updates.length = 0; m.adds.length = 0; m.logs.length = 0; m.aula.length = 0; });

describe('writeAppointmentOutcome', () => {
  it('Compareceu promove e guarda de onde o lead saiu', async () => {
    await writeAppointmentOutcome({ db: {}, lead: NOVO, outcome: 'attended', categorySlug: VISITA, appUser: USER, statuses: STATUSES });
    expect(m.updates[0].data).toMatchObject({
      appointmentOutcome: 'attended',
      status: 'Negociação',
      appointmentPromotedFrom: { status: 'Novo', statusEnteredAt: entrou, funnelId: 'f1', toStatus: 'Negociação' },
      nextFollowUp: null,
    });
    const tipos = m.adds.map((a) => a.data.type);
    expect(tipos).toEqual(['daily_goal_done', 'status_change']);
    expect(m.adds[0].data.outcomeCorrection).toBeUndefined();
  });

  it('desfecho sem promoção grava appointmentPromotedFrom null', async () => {
    await writeAppointmentOutcome({ db: {}, lead: NOVO, outcome: 'no_show', categorySlug: VISITA, appUser: USER, statuses: STATUSES });
    expect(m.updates[0].data.appointmentPromotedFrom).toBeNull();
    expect(m.updates[0].data.status).toBeUndefined();
  });

  it('com correction a marca do dia leva o texto e a marca de correção', async () => {
    await writeAppointmentOutcome({
      db: {}, lead: NOVO, outcome: 'attended', categorySlug: VISITA, appUser: USER, statuses: STATUSES,
      sourceLabel: 'Meta Diária', correction: true,
    });
    expect(m.adds[0].data).toMatchObject({
      type: 'daily_goal_done', appointmentOutcome: 'attended', outcomeCorrection: true,
    });
    expect(m.adds[0].data.text).toMatch(/^↩️ Desfecho corrigido: ✅ Compareceu · Meta Diária/);
  });
});

describe('correctAppointmentOutcome', () => {
  it('Compareceu para Não compareceu: volta a etapa, repõe o próximo contato e registra a correção', async () => {
    const r = await correctAppointmentOutcome({
      db: {}, lead: PROMOVIDO, from: 'attended', to: 'no_show', categorySlug: VISITA, appUser: USER,
      statuses: STATUSES, sourceLabel: 'Agenda do dia',
    });
    expect(r.revertedTo).toBe('Novo');
    expect(m.logs).toHaveLength(2);
    expect(m.logs[0].payload).toMatchObject({
      type: 'daily_goal_done', dailyGoalCategory: VISITA, appointmentOutcome: 'no_show', outcomeCorrection: true,
    });
    expect(m.logs[0].payload.text).toMatch(/^↩️ Desfecho corrigido: ❌ Não veio · Agenda do dia/);
    expect(m.logs[0].patch).toMatchObject({
      appointmentOutcome: 'no_show', appointmentOutcomeAt: 'TS', appointmentOutcomeBy: 'auth1',
      appointmentPromotedFrom: null, status: 'Novo', statusEnteredAt: entrou, nextFollowUp: agendado,
    });
    expect(m.logs[1].payload).toMatchObject({
      type: 'status_change', fromStatus: 'Negociação', toStatus: 'Novo', funnelId: 'f1',
      text: 'Fase voltou para [Novo] após correção do desfecho.',
    });
    expect(m.aula).toEqual([]);
  });

  it('na aula experimental, o registro da aula vira falta', async () => {
    await correctAppointmentOutcome({ db: {}, lead: PROMOVIDO, from: 'attended', to: 'no_show', categorySlug: AULA, appUser: USER });
    expect(m.aula).toEqual([['apply', 'no_show']]);
  });

  it('cliente: troca o desfecho sem mexer em etapa nem em próximo contato', async () => {
    const r = await correctAppointmentOutcome({
      db: {}, lead: { ...PROMOVIDO, status: 'Venda' }, from: 'attended', to: 'no_show', categorySlug: VISITA,
      appUser: USER, isClient: true,
    });
    expect(r.revertedTo).toBeNull();
    expect(m.logs).toHaveLength(1);
    expect(m.logs[0].patch.status).toBeUndefined();
    expect(m.logs[0].patch.nextFollowUp).toBeUndefined();
  });

  it('Não compareceu para Compareceu: é um Compareceu com a marca de correção', async () => {
    const faltou = { ...NOVO, appointmentOutcome: 'no_show', appointmentPromotedFrom: null };
    const r = await correctAppointmentOutcome({
      db: {}, lead: faltou, from: 'no_show', to: 'attended', categorySlug: VISITA, appUser: USER, statuses: STATUSES,
    });
    expect(r).toEqual({ revertedTo: null, promotedTo: 'Negociação' });
    expect(m.updates[0].data).toMatchObject({ appointmentOutcome: 'attended', status: 'Negociação' });
    expect(m.adds[0].data).toMatchObject({ type: 'daily_goal_done', outcomeCorrection: true });
  });

  it('Desfazer um Compareceu: limpa o desfecho, volta a etapa e registra a volta', async () => {
    const r = await correctAppointmentOutcome({
      db: {}, lead: PROMOVIDO, from: 'attended', to: null, categorySlug: AULA, appUser: USER,
    });
    expect(r.revertedTo).toBe('Novo');
    expect(m.updates[0].data).toMatchObject({
      appointmentOutcome: null, appointmentOutcomeAt: null, appointmentOutcomeBy: null,
      appointmentPromotedFrom: null, status: 'Novo', nextFollowUp: agendado,
    });
    expect(m.aula).toEqual([['clear']]);
    expect(m.logs.map((l) => l.payload.type)).toEqual(['status_change']);
  });

  it('Desfazer um Não compareceu não grava marca na linha do tempo', async () => {
    const faltou = { ...NOVO, appointmentOutcome: 'no_show', appointmentPromotedFrom: null };
    await correctAppointmentOutcome({ db: {}, lead: faltou, from: 'no_show', to: null, categorySlug: VISITA, appUser: USER });
    expect(m.updates[0].data).toEqual({
      appointmentPromotedFrom: null, appointmentOutcome: null, appointmentOutcomeAt: null, appointmentOutcomeBy: null,
    });
    expect(m.logs).toEqual([]);
  });

  it('trocar para o mesmo desfecho não grava nada', async () => {
    await correctAppointmentOutcome({ db: {}, lead: PROMOVIDO, from: 'attended', to: 'attended', categorySlug: VISITA, appUser: USER });
    expect(m.updates).toEqual([]);
    expect(m.adds).toEqual([]);
    expect(m.logs).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/appointmentOutcome.test.js`
Expected: FAIL. `correctAppointmentOutcome` não existe e `appointmentPromotedFrom` não é gravado.

- [ ] **Step 3: Implementar**

Substituir o conteúdo inteiro de `src/lib/appointmentOutcome.js` por:

```js
// Escrita do desfecho de um agendamento (visita/aula) — fonte ÚNICA para os
// lugares que confirmam presença na Meta Diária: a Agenda de hoje e a correção
// do "Feitos hoje". O card "A fazer" grava pelo handleOutcome do
// DailyGoalView, com a mesma regra de promoção (planPromotion).
//
// A rule de leads permite qualquer membro do tenant dar UPDATE desde que o
// DONO (consultantAuthUid) fique inalterado — este helper nunca o toca, então
// funciona mesmo quando quem marca não é o dono (agenda compartilhada). O
// crédito da Meta vem da interaction daily_goal_done, que é lida por
// leadId+categoria (o autor não importa), então cai na Meta do DONO do lead.
//
// Flags:
//   consumeAppointment — tira o lead de "Atrasado"/"Contato Hoje" limpando o
//     nextFollowUp. Comparecimento PRESERVA appointmentScheduledFor+appointmentType
//     (a pessoa nunca some da tela Visitas/Aulas — o desfecho reflete lá e na
//     Meta); só o cancelamento zera o agendamento de vez.
//   promote — em comparecimento de visita/aula, empurra o lead para a etapa
//     "Negociação" do funil e guarda de onde ele saiu (appointmentPromotedFrom).
//   writeGoalDone — grava a interaction daily_goal_done (crédito da Meta).
//     A agenda passa false quando a categoria já foi concluída hoje, p/ não
//     duplicar a marca no feed a cada clique.
//   correction — a marca do dia é de correção: texto "↩️ Desfecho corrigido" e
//     outcomeCorrection: true.
//
// Correção (correctAppointmentOutcome): regras puras em outcomeCorrection.js.

import { doc, collection, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { stageChangeFields } from './stageMove.js';
import { appId, LEADS_PATH, INTERACTIONS_PATH } from './firebase.js';
import {
  APPOINTMENT_OUTCOMES,
  getAppointmentOutcomeMeta,
  getInteractionSecurityFields,
  DAILY_GOAL_CATEGORY_LABEL,
  outcomeAppliesToAula
} from './leads.js';
import { applyOutcomeToAula, clearAulaOutcome } from './aulasWrites.js';
import { logInteraction } from './interactions.js';
import { withBucket } from './leadDerived.js';
import { planPromotion, planAttendedUndo, correctionText, revertStageText } from './outcomeCorrection.js';

const leadRef = (db, id) => doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, id);

// Desmarca o desfecho (volta para "aguardando"). Só zera os campos de
// desfecho no lead, mais o que vier em extraPatch (a correção manda a volta
// da etapa e do próximo contato). A marca daily_goal_done do dia (se houver)
// não é apagada aqui (delete de interaction é restrito ao dono/admin pela
// rule); some sozinha na virada do dia. Preserva o DONO, então funciona para
// qualquer membro do tenant.
export async function clearAppointmentOutcome({ db, lead, categorySlug = null, extraPatch = null }) {
  await updateDoc(leadRef(db, lead.id), {
    ...(extraPatch || {}),
    appointmentOutcome: null,
    appointmentOutcomeAt: null,
    appointmentOutcomeBy: null
  });
  // Dual-write best-effort: só desfecho de aula toca o histórico (guarda #1).
  if (outcomeAppliesToAula(categorySlug)) {
    try { await clearAulaOutcome({ db, lead }); } catch (e) { console.error('clearAulaOutcome falhou', e); }
  }
}

export async function writeAppointmentOutcome({
  db,
  lead,
  outcome,
  categorySlug,
  appUser,
  statuses = null,
  consumeAppointment = true,
  promote = true,
  writeGoalDone = true,
  sourceLabel = 'Meta Diária',
  correction = false
}) {
  if (!APPOINTMENT_OUTCOMES.includes(outcome)) {
    throw new Error(`Desfecho inválido: ${outcome}`);
  }
  const meta = getAppointmentOutcomeMeta(outcome);
  const categoryLabel = DAILY_GOAL_CATEGORY_LABEL[categorySlug] || categorySlug;
  const { toStatus, promotedFrom } = planPromotion({ lead, outcome, categorySlug, statuses, promote });

  const leadUpdate = {
    appointmentOutcome: outcome,
    appointmentOutcomeAt: serverTimestamp(),
    appointmentOutcomeBy: appUser.authUid || appUser.id || null,
    appointmentPromotedFrom: promotedFrom
  };
  if (toStatus) {
    leadUpdate.status = toStatus;
    leadUpdate.statusEnteredAt = serverTimestamp();
  }
  // Comparecimento PRESERVA o agendamento (appointmentScheduledFor+appointmentType)
  // para a pessoa NUNCA sumir da tela Visitas/Aulas e o desfecho refletir lá e na
  // Meta (regra do Johnny). Limpa só o nextFollowUp — o que já tira de "Atrasado"/
  // "Contato Hoje". Cancelamento remove o compromisso de vez.
  if (consumeAppointment && (outcome === 'attended' || outcome === 'cancelled')) {
    leadUpdate.nextFollowUp = null;
    if (outcome === 'cancelled') {
      leadUpdate.appointmentScheduledFor = null;
      leadUpdate.appointmentType = null;
    }
  }
  await updateDoc(leadRef(db, lead.id), leadUpdate);
  // Dual-write best-effort: SÓ desfecho de aula toca o histórico de aulas
  // (guarda #1 — desfecho de visita não pode mexer numa aula antiga do lead).
  if (outcomeAppliesToAula(categorySlug)) {
    try { await applyOutcomeToAula({ db, lead, outcome }); } catch (e) { console.error('applyOutcomeToAula falhou', e); }
  }

  if (writeGoalDone) {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
      leadId: lead.id,
      consultantName: appUser.name,
      ...getInteractionSecurityFields(lead, appUser),
      text: correction
        ? correctionText({ outcome, sourceLabel, categoryLabel })
        : `${meta.icon} ${meta.label} — ${sourceLabel} (${categoryLabel})`,
      type: 'daily_goal_done',
      dailyGoalCategory: categorySlug,
      appointmentOutcome: outcome,
      ...(correction ? { outcomeCorrection: true } : {}),
      createdAt: serverTimestamp()
    });
  }

  if (toStatus) {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
      leadId: lead.id,
      consultantName: appUser.name,
      ...getInteractionSecurityFields(lead, appUser),
      text: `Fase alterada para [${toStatus}] após comparecimento em ${categoryLabel}.`,
      type: 'status_change',
      ...stageChangeFields(lead, toStatus),
      createdAt: serverTimestamp()
    });
  }

  return { promoted: Boolean(toStatus), negStatusName: toStatus };
}

// Corrige o desfecho de hoje, pela Agenda de hoje ou pelo "Feitos hoje".
//   from: o desfecho gravado ('attended' ou 'no_show')
//   to  : 'attended', 'no_show', ou null para desfazer
// Trocar para Compareceu é um Compareceu comum, com a marca de correção.
// Trocar para Não compareceu e desfazer tiram o que o Compareceu fez: a etapa
// e a limpeza do próximo contato (planAttendedUndo). A marca de correção é
// uma daily_goal_done: o relatório de visitas fica com o último desfecho do
// dia (visitOutcomesByLead) e o Operacional não conta de novo a tarefa da
// mesma pessoa no mesmo dia (tasksByType). Desfazer não grava marca, como antes.
export async function correctAppointmentOutcome({
  db,
  lead,
  from,
  to,
  categorySlug,
  appUser,
  statuses = null,
  isClient = false,
  sourceLabel = 'Meta Diária'
}) {
  if (from === to) return { revertedTo: null, promotedTo: null };
  if (to === 'attended') {
    const { negStatusName } = await writeAppointmentOutcome({
      db, lead, outcome: 'attended', categorySlug, appUser, statuses,
      promote: !isClient, consumeAppointment: !isClient, writeGoalDone: true, sourceLabel, correction: true
    });
    return { revertedTo: null, promotedTo: negStatusName };
  }
  if (to !== 'no_show' && to !== null) throw new Error(`Correção inválida: ${to}`);

  const { patch, revertedTo } = planAttendedUndo({ lead, fromOutcome: from, isClient });
  // lifecycleBucket só recalcula quando a etapa muda.
  const bucketed = (p) => (p.status ? withBucket(p, lead) : p);

  if (to === 'no_show') {
    const categoryLabel = DAILY_GOAL_CATEGORY_LABEL[categorySlug] || categorySlug;
    await logInteraction(
      db, lead, appUser,
      {
        text: correctionText({ outcome: 'no_show', sourceLabel, categoryLabel }),
        type: 'daily_goal_done',
        dailyGoalCategory: categorySlug,
        appointmentOutcome: 'no_show',
        outcomeCorrection: true
      },
      bucketed({
        ...patch,
        appointmentOutcome: 'no_show',
        appointmentOutcomeAt: serverTimestamp(),
        appointmentOutcomeBy: appUser.authUid || appUser.id || null
      })
    );
    if (outcomeAppliesToAula(categorySlug)) {
      try { await applyOutcomeToAula({ db, lead, outcome: 'no_show' }); } catch (e) { console.error('applyOutcomeToAula falhou', e); }
    }
  } else {
    await clearAppointmentOutcome({ db, lead, categorySlug, extraPatch: bucketed(patch) });
  }

  if (revertedTo) {
    await logInteraction(db, lead, appUser, {
      text: revertStageText(revertedTo),
      type: 'status_change',
      ...stageChangeFields(lead, revertedTo)
    });
  }
  return { revertedTo, promotedTo: null };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/appointmentOutcome.test.js src/lib/__tests__/outcomeCorrection.test.js`
Expected: PASS.

Se o teste "Desfazer um Compareceu" reclamar de `lifecycleBucket` a mais no `toMatchObject`, está certo: o `toMatchObject` aceita campo a mais. Se o teste "Desfazer um Não compareceu" falhar por um campo a mais, é sinal de que o `bucketed` foi aplicado sem etapa; corrigir o código, não o teste.

- [ ] **Step 5: Rodar a suíte para ver que nada mais quebrou**

Run: `npx vitest run`
Expected: PASS em tudo, com os testes novos somados à linha de base.

- [ ] **Step 6: Commit**

```bash
git add src/lib/appointmentOutcome.js src/lib/__tests__/appointmentOutcome.test.js
git commit -m "feat: correção do desfecho devolve a etapa e registra a troca

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Relatório de visitas com a marca de correção

**Files:**
- Modify: `src/lib/crm/appointments.js` (comentário acima de `MIRROR_OUTCOMES`)
- Test: `src/lib/__tests__/crm.appointments.test.js`

- [ ] **Step 1: Escrever o teste**

Em `src/lib/__tests__/crm.appointments.test.js`, dentro do `describe('desfecho corrigido no espelho do lead', ...)`, logo depois do teste `'espelho de outra data não vale: o lead já está em outro agendamento'`, acrescentar:

```js
  it('a marca de correção da Meta ganha do Compareceu do mesmo dia quando o lead já foi remarcado', () => {
    // Compareceu às 18h, corrigido para Não compareceu às 19h pela Meta, e a
    // remarcação levou o lead para outro dia: decide a linha do tempo.
    const corrigido = visitOutcomesByLead([
      G('g1', 'v1', 'attended', D(9, 3, 18)),
      { ...G('g2', 'v1', 'no_show', D(9, 3, 19)), outcomeCorrection: true },
    ]);
    expect(effectiveStatus(V('1'), corrigido, mirror({ appointmentScheduledFor: D(9, 4, 18), appointmentOutcome: null })))
      .toBe('no_show');
  });
```

- [ ] **Step 2: Rodar**

Run: `npx vitest run src/lib/__tests__/crm.appointments.test.js`
Expected: PASS. É um teste de trava: o relatório já pega o último desfecho do dia, e a correção nova depende disso.

- [ ] **Step 3: Atualizar o comentário**

Em `src/lib/crm/appointments.js`, trocar o comentário que começa em `// Desfecho que o próprio lead guarda para o registro:` e termina em `// appointmentScheduledFor e segue pela linha do tempo.` por:

```js
// Desfecho que o próprio lead guarda para o registro: vale quando o
// agendamento do lead (appointmentScheduledFor) é o mesmo instante do registro
// e o desfecho é "veio" ou "não veio". Todo desfecho grava o lead. A correção
// pela Meta (correctAppointmentOutcome, desde 29/09/2026) também grava uma
// marca daily_goal_done com outcomeCorrection, então a linha do tempo fica com
// o último desfecho mesmo depois de remarcar. Correção de antes disso chegava
// só ao lead. O cancelamento limpa o appointmentScheduledFor e segue pela
// linha do tempo.
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/crm/appointments.js src/lib/__tests__/crm.appointments.test.js
git commit -m "test: relatório de visitas fica com a correção do desfecho

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Componente `OutcomePopover`

**Files:**
- Create: `src/components/dailygoal/OutcomePopover.jsx`
- Test: `src/lib/__tests__/outcomePopover.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/__tests__/outcomePopover.test.js`:

```js
// @vitest-environment jsdom
// Botão "Marcar desfecho": o rótulo segue o desfecho, o clique abre o balão
// com as opções certas e escolher uma fecha o balão e avisa quem grava.
import { describe, it, expect, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O Popper do Radix mede o conteúdo com ResizeObserver, que o jsdom não tem.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const { OutcomePopover } = await import('../../components/dailygoal/OutcomePopover.jsx');

let root = null;
async function montar(props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(h(OutcomePopover, props)); });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
});

const gatilho = () => document.querySelector('[data-slot="popover-trigger"]');
const opcoes = () => [...document.querySelectorAll('[data-outcome-item]')].map((b) => b.textContent.trim());
const clicar = async (el) => { await act(async () => { el.click(); }); };

describe('OutcomePopover', () => {
  it('sem desfecho mostra Marcar desfecho e abre Compareceu e Não compareceu', async () => {
    await montar({ onPick: () => {} });
    expect(gatilho().textContent).toContain('Marcar desfecho');
    await clicar(gatilho());
    expect(opcoes()).toEqual(['Compareceu', 'Não compareceu']);
  });

  it('com withMore traz Remarcou e Cancelou', async () => {
    await montar({ withMore: true, onPick: () => {} });
    await clicar(gatilho());
    expect(opcoes()).toEqual(['Compareceu', 'Não compareceu', 'Remarcou', 'Cancelou']);
  });

  it('marcado mostra o desfecho e oferece a troca e o desfazer', async () => {
    await montar({ outcome: 'attended', canUndo: true, onPick: () => {} });
    expect(gatilho().textContent).toContain('Compareceu');
    expect(gatilho().getAttribute('aria-label')).toBe('Compareceu. Abrir para corrigir');
    await clicar(gatilho());
    expect(opcoes()).toEqual(['Trocar para não compareceu', 'Desfazer marcação']);
  });

  it('escolher avisa o id e fecha o balão', async () => {
    const escolhas = [];
    await montar({ outcome: 'no_show', onPick: (id) => escolhas.push(id) });
    await clicar(gatilho());
    await clicar(document.querySelector('[data-outcome-item="attended"]'));
    expect(escolhas).toEqual(['attended']);
    expect(document.querySelector('[data-outcome-item]')).toBeNull();
  });

  it('gravando, o botão fica desligado', async () => {
    await montar({ saving: true, onPick: () => {} });
    expect(gatilho().disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/outcomePopover.test.js`
Expected: FAIL, "Failed to resolve import ../../components/dailygoal/OutcomePopover.jsx".

- [ ] **Step 3: Implementar**

Criar `src/components/dailygoal/OutcomePopover.jsx`:

```jsx
import { useState } from 'react';
import { ArrowLeftRight, Ban, CalendarClock, Check, ChevronDown, Undo2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover.jsx';
import { outcomeMenuItems, outcomeTriggerLabel } from '../../lib/outcomeMenu.js';

// Botão "Marcar desfecho" da Meta Diária, com o balão de Compareceu e Não
// compareceu. Depois de marcado, o botão mostra o desfecho e o mesmo balão
// corrige. Só apresenta: quem grava é a tela, pelo onPick(id), com os ids de
// outcomeMenuItems ('attended', 'no_show', 'rescheduled', 'cancelled', 'undo').
// Substituiu o switch de presença, cujo gesto de segurar para desmarcar
// ninguém descobria. O mesmo componente serve a Agenda de hoje, o card
// "A fazer", o Próximo compromisso e o "Feitos hoje".

const TRIGGER_TONE = {
  attended: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30 dark:hover:bg-emerald-500/15',
  no_show: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30 dark:hover:bg-rose-500/15',
  none: 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-white/[0.04] dark:text-slate-200 dark:border-white/10 dark:hover:bg-white/[0.08]',
};

const ITEM_TONE = {
  success: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/15',
  danger: 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15',
  neutral: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06]',
};

const ITEM_ICON = { attended: Check, no_show: X, rescheduled: CalendarClock, cancelled: Ban, undo: Undo2 };

export function OutcomePopover({
  outcome = null,
  title = null,
  withMore = false,
  canUndo = false,
  saving = false,
  size = 'md',
  className,
  onPick,
}) {
  const [open, setOpen] = useState(false);
  const marked = outcome === 'attended' || outcome === 'no_show' ? outcome : null;
  const items = outcomeMenuItems({ outcome: marked, withMore, canUndo });
  const label = outcomeTriggerLabel(marked);

  const pick = (id) => {
    setOpen(false);
    if (onPick) onPick(id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={saving}
        aria-label={marked ? `${label}. Abrir para corrigir` : 'Marcar desfecho'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border font-semibold whitespace-nowrap transition active:scale-[.98] disabled:opacity-60 disabled:cursor-default',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50',
          size === 'sm' ? 'h-7 px-2 text-[11.5px]' : 'h-8 px-3 text-[12px]',
          TRIGGER_TONE[marked || 'none'],
          className
        )}
      >
        {marked === 'attended' && <Check size={13} />}
        {marked === 'no_show' && <X size={13} />}
        <span>{label}</span>
        <ChevronDown size={13} className="opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-56 p-2 rounded-xl">
        {title && (
          <div className="px-1.5 pb-1.5 text-[11.5px] text-muted-foreground truncate">{title}</div>
        )}
        <div className="flex flex-col gap-1">
          {items.map((item) => {
            // Com desfecho marcado, a opção colorida é a troca.
            const Icon = marked && (item.id === 'attended' || item.id === 'no_show') ? ArrowLeftRight : ITEM_ICON[item.id];
            return (
              <button
                key={item.id}
                type="button"
                data-outcome-item={item.id}
                onClick={() => pick(item.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12.5px] font-semibold text-left transition',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50',
                  ITEM_TONE[item.tone]
                )}
              >
                <Icon size={14} className="shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/outcomePopover.test.js`
Expected: PASS.

Se o clique não abrir o balão no jsdom (o `opcoes()` volta vazio), ver o HTML com `console.log(document.body.innerHTML)` depois do clique. Se o conteúdo aparecer só depois de um tique, trocar o `clicar` por `await act(async () => { el.click(); await new Promise((r) => setTimeout(r, 0)); });`.

- [ ] **Step 5: Commit**

```bash
git add src/components/dailygoal/OutcomePopover.jsx src/lib/__tests__/outcomePopover.test.js
git commit -m "feat: botão Marcar desfecho com balão

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Agenda de hoje com o balão

**Files:**
- Modify: `src/components/dailygoal/DayAgendaCard.jsx`
- Delete: `src/components/ui/PresenceSwitch.jsx`
- Modify: `src/views/DailyGoalView.jsx` (`markAgendaPresence`, imports)
- Test: `src/lib/__tests__/dayAgendaCard.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/__tests__/dayAgendaCard.test.js`:

```js
// Agenda de hoje: cada linha tem o botão de desfecho (o switch saiu) e a
// bolinha ao lado da hora fica vermelha na falta, verde no comparecimento.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { DayAgendaCard } from '../../components/dailygoal/DayAgendaCard.jsx';
import { DAILY_GOAL_CATEGORIES } from '../leads.js';

const row = (id, outcome, h) => ({
  id, name: `Pessoa ${id}`, outcome, categorySlug: DAILY_GOAL_CATEGORIES.VISITA_HOJE,
  scheduledAt: new Date(2026, 8, 29, h), isMine: true, ownerName: 'Lucas',
});

const html = () => renderToString(createElement(DayAgendaCard, {
  rows: [row('a', null, 9), row('b', 'attended', 10), row('c', 'no_show', 11)],
  pending: 1, nextIndex: 0, savingId: null, onMark: () => {},
}));

// Classe da bolinha de cada linha, na ordem das linhas.
const dots = (out) => [...out.matchAll(/class="(mt-1\.5 size-\[7px\][^"]*)"/g)].map((m) => m[1]);

describe('DayAgendaCard', () => {
  it('cada linha mostra o botão com o desfecho, e não o switch', () => {
    const out = html();
    expect(out).toContain('Marcar desfecho');
    expect(out).toContain('Compareceu');
    expect(out).toContain('Não compareceu');
    expect(out).not.toContain('segure para desmarcar');
  });

  it('a bolinha da falta é vermelha e a do comparecimento é verde', () => {
    const [, veio, faltou] = dots(html());
    expect(veio).toContain('bg-emerald-500');
    expect(faltou).toContain('bg-rose-500');
    expect(faltou).not.toContain('bg-emerald-500');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/dayAgendaCard.test.js`
Expected: FAIL. A linha ainda tem o switch e a bolinha da falta é verde.

- [ ] **Step 3: Trocar o switch no `DayAgendaCard.jsx`**

Em `src/components/dailygoal/DayAgendaCard.jsx`:

1. Trocar o import `import { PresenceSwitch } from '../ui/PresenceSwitch.jsx';` por `import { OutcomePopover } from './OutcomePopover.jsx';`.
2. Trocar a bolinha:

```jsx
                  <span
                    className={cn(
                      'mt-1.5 size-[7px] rounded-full shrink-0',
                      row.outcome === 'no_show'
                        ? 'bg-rose-500'
                        : row.outcome
                          ? 'bg-emerald-500'
                          : isNext ? 'bg-accent-500' : 'bg-slate-300 dark:bg-neutral-600'
                    )}
                  />
```

3. Trocar o bloco `<PresenceSwitch ... />` por:

```jsx
                  <OutcomePopover
                    size="sm"
                    outcome={row.outcome}
                    canUndo
                    saving={savingId === row.id}
                    title={`${row.categorySlug === DAILY_GOAL_CATEGORIES.VISITA_HOJE ? 'Visita' : 'Aula exp.'} de ${row.name || 'sem nome'} · ${hourLabel(row.scheduledAt)}`}
                    onPick={(choice) => onMark(row, choice)}
                  />
```

4. Apagar o arquivo do switch:

```bash
git rm src/components/ui/PresenceSwitch.jsx
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/dayAgendaCard.test.js`
Expected: PASS.

- [ ] **Step 5: Reescrever `markAgendaPresence` no `DailyGoalView.jsx`**

Em `src/views/DailyGoalView.jsx`:

1. Trocar o import `import { writeAppointmentOutcome, clearAppointmentOutcome } from '../lib/appointmentOutcome.js';` por:

```js
import { writeAppointmentOutcome, correctAppointmentOutcome } from '../lib/appointmentOutcome.js';
```

2. Substituir a função `markAgendaPresence` inteira (de `const markAgendaPresence = async (row, outcome) => {` até o `};` que fecha o `finally`) por:

```js
  // Agenda de hoje. Linha sem desfecho: grava o escolhido. Linha já marcada:
  // o balão corrige (troca ou desfaz) pelo correctAppointmentOutcome, que
  // devolve a etapa e o próximo contato que o Compareceu tinha mudado.
  const markAgendaPresence = async (row, choice) => {
    if (savingAgendaId) return;
    setSavingAgendaId(row.id);
    try {
      // CLIENTE é caso à parte: ele está na agenda só para upsell de modalidade,
      // não para prospecção. A presença dele registra o desfecho e a timeline e
      // para por aí — não mexe em etapa do funil (promote) e não consome o
      // compromisso (consumeAppointment), que zeraria o próximo contato dele.
      // Sem isso, confirmar a presença de um aluno apagava um contato agendado
      // e podia empurrá-lo de volta para o funil de vendas.
      const quem = row.isMine ? '' : ` (meta de ${row.ownerName})`;
      const isCliente = row.isClient;

      if (row.outcome) {
        const to = choice === 'undo' ? null : choice;
        if (to === row.outcome) return;
        const { revertedTo } = await correctAppointmentOutcome({
          db, lead: row, from: row.outcome, to, categorySlug: row.categorySlug, appUser, statuses,
          isClient: isCliente, sourceLabel: 'Agenda do dia',
        });
        const volta = revertedTo ? ` Voltou para ${revertedTo}.` : '';
        if (to === null) toast.success(`Marcação de ${row.name} desfeita${quem}.${volta}`);
        else if (to === 'attended') toast.success(`Desfecho de ${row.name} corrigido para compareceu${quem}.`);
        else toast.success(`Desfecho de ${row.name} corrigido para não compareceu${quem}.${volta}`);
        // Mesmo passo do Não compareceu normal: sem nova data o lead fica parado.
        if (to === 'no_show') {
          setRescheduleTarget({ lead: row, categorySlug: row.categorySlug, flow: 'after_no_show' });
        }
        return;
      }

      if (choice !== 'attended' && choice !== 'no_show') return;
      // Não regrava a marca da Meta se já existe uma de hoje nesta categoria.
      // Sem isso, dois consultores confirmando a mesma linha (que é o cenário
      // normal de uma agenda compartilhada) empilham registros na timeline.
      const jaTemMarcaHoje = hasGoalDoneToday(
        row,
        row.categorySlug,
        (interactions || []).filter((i) => i.leadId === row.id),
        new Date(now.getFullYear(), now.getMonth(), now.getDate())
      );
      await writeAppointmentOutcome({
        db, lead: row, outcome: choice, categorySlug: row.categorySlug, appUser, statuses,
        promote: !isCliente,
        consumeAppointment: !isCliente,
        writeGoalDone: !jaTemMarcaHoje,
        sourceLabel: 'Agenda do dia',
      });
      toast.success(choice === 'attended'
        ? `Presença de ${row.name} confirmada${quem}.`
        : `${row.name} marcado como não veio${quem}.`);
      // Quem não veio precisa de nova data, senão o lead fica parado sem
      // próximo passo. Abre a remarcação na hora — fechar a janela é o
      // "deixo pra marcar depois". Mesmo comportamento do handleOutcome da
      // Meta; comparecimento não pergunta nada, só aplica o que já é regra.
      if (choice === 'no_show') {
        setRescheduleTarget({ lead: row, categorySlug: row.categorySlug, flow: 'after_no_show' });
      }
    } catch (err) {
      console.error('markAgendaPresence', err);
      toast.error('Não foi possível salvar a presença. Tente novamente.');
    } finally {
      setSavingAgendaId(null);
    }
  };
```

- [ ] **Step 6: Rodar testes e lint**

Run: `npx vitest run && npx eslint .`
Expected: testes PASS; lint com 0 erros. `grep -rn PresenceSwitch src` precisa voltar vazio.

- [ ] **Step 7: Commit**

```bash
git add -A src/components/dailygoal/DayAgendaCard.jsx src/components/ui/PresenceSwitch.jsx src/views/DailyGoalView.jsx src/lib/__tests__/dayAgendaCard.test.js
git commit -m "feat: Agenda de hoje marca e corrige o desfecho pelo balão

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Card "A fazer", Próximo compromisso e "Feitos hoje"

**Files:**
- Modify: `src/views/DailyGoalView.jsx` (`NextUp`, `TaskCard`, `DoneCard`, `handleOutcome`, `handleReschedule`, novo `handleCorrectOutcome`, barra lateral, imports)
- Test: `src/lib/__tests__/metaLinks.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/__tests__/metaLinks.test.js`, dentro do `describe('Meta diária', ...)`, acrescentar no fim:

```js
  it('TaskCard de visita: os quatro botões viraram o Marcar desfecho', () => {
    const html = render(createElement(TaskCard, {
      task: { ...TASK, categorySlugs: ['visita_hoje'] }, slug: 'visita_hoje', now: new Date('2026-09-22T10:00:00'),
    }));
    expect(html).toContain('Marcar desfecho');
    expect(html).not.toContain('>Não veio<');
    expect(html).not.toContain('>Remarcou<');
  });

  it('DoneCard: desfecho de hoje vira o botão de correção, por cima do link', () => {
    const now = new Date('2026-09-22T15:00:00');
    const html = render(createElement(DoneCard, {
      lead: {
        ...TASK, categorySlugs: ['visita_hoje'], categoryStatus: { visita_hoje: true },
        appointmentOutcome: 'attended',
        appointmentOutcomeAt: new Date('2026-09-22T14:00:00'),
        appointmentScheduledFor: new Date('2026-09-22T13:00:00'),
      },
      now,
      onReschedule: () => {},
      onCorrect: () => {},
    }));
    const i = html.indexOf('aria-label="Compareceu. Abrir para corrigir"');
    expect(i).toBeGreaterThan(-1);
    const b = html.lastIndexOf('<button', i);
    expect(html.slice(b, html.indexOf('>', i))).toContain('relative z-10');
  });

  it('DoneCard sem onCorrect continua mostrando só o texto do desfecho', () => {
    const html = render(createElement(DoneCard, {
      lead: {
        ...TASK, categorySlugs: ['visita_hoje'], categoryStatus: { visita_hoje: true },
        appointmentOutcome: 'attended',
        appointmentOutcomeAt: new Date('2026-09-22T14:00:00'),
        appointmentScheduledFor: new Date('2026-09-22T13:00:00'),
      },
      onReschedule: () => {},
    }));
    expect(html).not.toContain('Abrir para corrigir');
    expect(html).toContain('Compareceu');
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/metaLinks.test.js`
Expected: FAIL nos dois primeiros testes novos (o terceiro já passa e fica de trava).

- [ ] **Step 3: Imports do `DailyGoalView.jsx`**

1. No import de `../lib/leads.js`, acrescentar `isClientLead`.
2. Acrescentar, junto dos outros imports de `../lib/`:

```js
import { planPromotion, correctableOutcome } from '../lib/outcomeCorrection.js';
```

3. Acrescentar, junto do import do `DayAgendaCard`:

```js
import { OutcomePopover } from '../components/dailygoal/OutcomePopover.jsx';
```

- [ ] **Step 4: `NextUp` com o balão**

Na assinatura, acrescentar `onReschedule`:

```jsx
function NextUp({ task, slug, countdownLabel, appointmentLabel, onWhatsapp, onOutcome, onReschedule }) {
```

Trocar o comentário e o `<Btn kind="success" ...>Compareceu</Btn>` do rodapé por:

```jsx
        {/* NextUp deriva de pendingBySlug (categoria sempre pendente). O campo
            appointmentOutcome no doc pode estar stale de um agendamento anterior,
            por isso o balão abre sempre sem desfecho. */}
        <OutcomePopover
          withMore
          title={`${typeLabel} de ${task.name || 'lead sem nome'}`}
          onPick={(id) => {
            if (id === 'rescheduled') { if (onReschedule) onReschedule(task, slug); }
            else if (onOutcome) onOutcome(task, id, slug);
          }}
        />
```

- [ ] **Step 5: `TaskCard` com o balão**

Trocar, no rodapé do `TaskCard`, o `isAppt ? ( <> ...quatro Btn... </> ) : (` por:

```jsx
          {isAppt ? (
            <OutcomePopover
              withMore
              title={`${slug === DAILY_GOAL_CATEGORIES.AULA_HOJE ? 'Aula experimental' : 'Visita'} de ${task.name || 'lead sem nome'}`}
              onPick={(id) => {
                if (id === 'rescheduled') { if (onReschedule) onReschedule(task, slug); }
                else if (onOutcome) onOutcome(task, id, slug);
              }}
            />
          ) : (
```

O `TaskCard` continua sem hook: o teste `'os containers não voltam a ter onClick'` chama o componente como função.

- [ ] **Step 6: `DoneCard` com a correção**

Substituir a função `DoneCard` inteira por:

```jsx
// `now`, `saving` e `onCorrect` ligam a correção do desfecho: sem onCorrect o
// card só mostra o texto, como antes. Sem hook, porque o metaLinks.test chama
// o componente como função.
export function DoneCard({ lead, now = null, saving = false, onReschedule, onCorrect }) {
  const firstDoneSlug = (lead.categorySlugs || []).find(s => lead.categoryStatus?.[s]);
  const outcomeMeta = lead.appointmentOutcome ? getAppointmentOutcomeMeta(lead.appointmentOutcome) : null;
  const apptSlug = (lead.categorySlugs || []).find(
    s => s === DAILY_GOAL_CATEGORIES.VISITA_HOJE || s === DAILY_GOAL_CATEGORIES.AULA_HOJE
  );
  const correctable = apptSlug && onCorrect && now ? correctableOutcome(lead, now) : null;
  // relative: base da camada do link esticado. Sem o onClick do container o
  // clique simples empilha uma entrada só no histórico.
  return (
    <div className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.05] cursor-pointer hover:bg-white dark:hover:bg-white/[0.04] transition">
      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 grid place-items-center pop">
        <Check size={13} />
      </div>
      <Avatar name={lead.name} size={28} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* draggable={false}: mesma razão do TaskCard, a camada cobre o
              card inteiro e sem isto o card vira um endereço arrastável. */}
          <LeadLink
            leadId={lead.id}
            stretched
            draggable={false}
            className="font-medium text-[13px] text-slate-800 dark:text-slate-100 line-through decoration-slate-400/60 truncate outline-none after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-brand-500/40"
          >
            {lead.name}
          </LeadLink>
          {firstDoneSlug && <DgCategoryChip slug={firstDoneSlug} />}
        </div>
        {correctable ? (
          // relative z-10: por cima da camada do link esticado, igual ao Remarcar.
          <div className="mt-1">
            <OutcomePopover
              size="sm"
              outcome={correctable}
              saving={saving}
              className="relative z-10"
              title={`Desfecho de ${lead.name || 'lead sem nome'}`}
              onPick={(to) => onCorrect(lead, apptSlug, to)}
            />
          </div>
        ) : outcomeMeta ? (
          <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{outcomeMeta.icon} {outcomeMeta.label}</div>
        ) : (
          <div className="text-[11.5px] text-slate-500 dark:text-slate-400">Concluído</div>
        )}
      </div>
      {apptSlug && onReschedule && (
        <button
          type="button"
          onClick={() => onReschedule(lead, apptSlug)}
          title="Remarcar agendamento"
          className="relative z-10 w-7 h-7 grid place-items-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] transition shrink-0"
        >
          <RefreshCw size={13} />
        </button>
      )}
      <ChevronRight size={16} className="text-slate-400" />
    </div>
  );
}
```

- [ ] **Step 7: `handleOutcome` com `planPromotion`**

Dentro de `handleOutcome`, trocar o bloco que calcula `isAttendedAppt`, `negStatus` e `shouldPromoteToNegociacao` (com os comentários acima dele) por:

```js
    // Auto-move "Compareceu" em visita/aula → Negociação no mesmo funil. A
    // regra e o registro de onde o lead saiu (para a correção poder voltar)
    // moram em planPromotion (src/lib/outcomeCorrection.js), a mesma da Agenda.
    const { toStatus: promoteTo, promotedFrom } = planPromotion({ lead, outcome, categorySlug, statuses });
```

E, dentro do `try`:

- trocar o `leadUpdate` inicial e o `if (shouldPromoteToNegociacao) { leadUpdate.status ... }` por:

```js
      const leadUpdate = {
        appointmentOutcome: outcome,
        appointmentOutcomeAt: serverTimestamp(),
        appointmentOutcomeBy: appUser.authUid || appUser.id || null,
        appointmentPromotedFrom: promotedFrom
      };
      if (promoteTo) {
        leadUpdate.status = promoteTo;
        leadUpdate.statusEnteredAt = serverTimestamp();
      }
```

- trocar o bloco `if (shouldPromoteToNegociacao) { await logInteraction(... status_change ...) }` por:

```js
      if (promoteTo) {
        await logInteraction(db, lead, appUser, {
          text: `Fase alterada para [${promoteTo}] após comparecimento em ${DAILY_GOAL_CATEGORY_LABEL[categorySlug] || categorySlug}.`,
          type: 'status_change',
          ...stageChangeFields(lead, promoteTo)
        });
      }
```

- trocar o `if (shouldPromoteToNegociacao) { toast... } else { toast... }` por:

```js
      if (promoteTo) {
        toast.success(`${meta.label} registrado. ${lead.name} → ${promoteTo}.`);
      } else {
        toast.success(`${meta.label} registrado para ${lead.name}.`);
      }
```

Depois disso, `grep -n "shouldPromoteToNegociacao\|negStatus" src/views/DailyGoalView.jsx` precisa voltar vazio.

- [ ] **Step 8: `handleReschedule` zera a promoção**

No `leadUpdate` de `handleReschedule`, logo depois de `appointmentOutcomeBy: null,`, acrescentar:

```js
        appointmentPromotedFrom: null,
```

- [ ] **Step 9: `handleCorrectOutcome`**

Logo depois da função `handleOutcome`, acrescentar:

```js
  // "Feitos hoje": corrige o desfecho de visita ou aula marcado hoje. Usa o
  // mesmo estado de gravação da Agenda (savingAgendaId), porque as duas mexem
  // no desfecho do mesmo lead. Depois da correção, o passo seguinte é o do
  // card "A fazer": Não compareceu pede a remarcação e Compareceu pergunta o
  // próximo contato.
  const handleCorrectOutcome = async (lead, categorySlug, to) => {
    if (savingAgendaId) return;
    const from = correctableOutcome(lead, now);
    if (!from || from === to || (to !== 'attended' && to !== 'no_show')) return;
    setSavingAgendaId(lead.id);
    try {
      const { revertedTo } = await correctAppointmentOutcome({
        db, lead, from, to, categorySlug, appUser, statuses,
        isClient: isClientLead(lead), sourceLabel: 'Meta Diária',
      });
      const volta = revertedTo ? ` Voltou para ${revertedTo}.` : '';
      if (to === 'attended') toast.success(`Desfecho de ${lead.name} corrigido para compareceu.`);
      else toast.success(`Desfecho de ${lead.name} corrigido para não compareceu.${volta}`);
      if (to === 'no_show') {
        setRescheduleTarget({ lead, categorySlug, flow: 'after_no_show' });
      } else {
        setNextContactTarget({ lead, categorySlug, flow: 'after_outcome', contextLabel: 'Comparecimento registrado' });
      }
    } catch (err) {
      console.error('handleCorrectOutcome', err);
      toast.error('Não foi possível corrigir o desfecho. Tente novamente.');
    } finally {
      setSavingAgendaId(null);
    }
  };
```

- [ ] **Step 10: Ligar a barra lateral**

No `<NextUp ... />`, acrescentar a prop:

```jsx
            onReschedule={(t, s) => setRescheduleTarget({ lead: t, categorySlug: s })}
```

No `done.map(...)`, trocar o `<DoneCard ... />` por:

```jsx
                  <DoneCard
                    key={lead.id}
                    lead={lead}
                    now={now}
                    saving={savingAgendaId === lead.id}
                    onReschedule={(l, s) => setRescheduleTarget({ lead: l, categorySlug: s })}
                    onCorrect={handleCorrectOutcome}
                  />
```

- [ ] **Step 11: Rodar testes e lint**

Run: `npx vitest run && npx eslint .`
Expected: PASS e 0 erros. O lint vai acusar imports que ficaram sem uso no `lucide-react` (por exemplo `X`, se nenhum outro ponto do arquivo usar). Tirar do import só o que o lint apontar.

- [ ] **Step 12: Commit**

```bash
git add src/views/DailyGoalView.jsx src/lib/__tests__/metaLinks.test.js
git commit -m "feat: Marcar desfecho no card da Meta e correção no Feitos hoje

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Regras puras da indicação rápida (`referrals.js`)

**Files:**
- Modify: `src/lib/referrals.js`
- Test: `src/lib/__tests__/referrals.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Em `src/lib/__tests__/referrals.test.js`, acrescentar `quickReferralForm`, `quickReferralIssue` e `REFERRAL_SOURCE_NAME` ao import de `'../referrals.js'`, e no fim do arquivo:

```js
describe('indicação rápida pela ficha', () => {
  const alvo = { funnelId: 'fRef', entryStageName: 'Aguardando ação' };

  it('monta o formulário do Novo lead no funil Indicações, na entrada, com origem Indicação', () => {
    expect(quickReferralForm({ name: '  Juliana Prado ', whatsapp: '(51) 9 9812-4410', dor: 'Dor nas costas', modalidade: 'Pilates' }, alvo))
      .toEqual({
        name: 'Juliana Prado',
        whatsapp: '(51) 9 9812-4410',
        source: 'Indicação',
        funnelId: 'fRef',
        status: 'Aguardando ação',
        dor: 'Dor nas costas',
        modalidade: 'Pilates',
      });
    expect(REFERRAL_SOURCE_NAME).toBe('Indicação');
  });

  it('dor e modalidade são opcionais', () => {
    const form = quickReferralForm({ name: 'Ana', whatsapp: '51998124410' }, alvo);
    expect(form.dor).toBe('');
    expect(form.modalidade).toBe('');
  });

  it('diz o que falta: nome com 2 letras ou mais, WhatsApp com 10 dígitos ou mais', () => {
    expect(quickReferralIssue({ name: 'A', whatsapp: '(51) 9 9812-4410' })).toBe('name');
    expect(quickReferralIssue({ name: '   ', whatsapp: '(51) 9 9812-4410' })).toBe('name');
    expect(quickReferralIssue({ name: 'Ana', whatsapp: '(51) 9981' })).toBe('whatsapp');
    expect(quickReferralIssue({ name: 'Ana', whatsapp: '(51) 3333-4444' })).toBeNull();
    expect(quickReferralIssue({ name: 'Ana', whatsapp: '(51) 9 9812-4410' })).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/referrals.test.js`
Expected: FAIL, `quickReferralForm is not a function`.

- [ ] **Step 3: Implementar**

Em `src/lib/referrals.js`, logo depois de `export const REFERRAL_ENTRY_NAME = 'Aguardando ação';`, acrescentar:

```js
// Origem gravada no lead indicado. O setup do funil cria uma origem com esse
// nome quando nenhuma do catálogo casa com /indica/.
export const REFERRAL_SOURCE_NAME = 'Indicação';
```

E no fim do arquivo:

```js
// Cadastro rápido de indicação pela ficha do cliente (menu Indicar e aba
// Indicações). Monta o formulário no formato do Novo lead, para o
// buildNewLeadDoc gravar igual aos outros cadastros: funil Indicações, etapa
// de entrada e origem Indicação. Dor e modalidade são opcionais.
export const quickReferralForm = ({ name = '', whatsapp = '', dor = '', modalidade = '' } = {}, { funnelId = null, entryStageName = '' } = {}) => ({
  name: String(name || '').trim(),
  whatsapp: whatsapp || '',
  source: REFERRAL_SOURCE_NAME,
  funnelId,
  status: entryStageName || '',
  dor: dor || '',
  modalidade: modalidade || '',
});

// O que falta para gravar: 'name' (menos de 2 letras, a regra do Novo lead) ou
// 'whatsapp' (menos de 10 dígitos). null quando dá para gravar.
export const quickReferralIssue = ({ name = '', whatsapp = '' } = {}) => {
  if (String(name || '').trim().length < 2) return 'name';
  if (String(whatsapp || '').replace(/\D/g, '').length < 10) return 'whatsapp';
  return null;
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/referrals.test.js src/lib/__tests__/referralApiMirror.test.js`
Expected: PASS nos dois.

- [ ] **Step 5: Commit**

```bash
git add src/lib/referrals.js src/lib/__tests__/referrals.test.js
git commit -m "feat: regras do cadastro rápido de indicação

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Pop-up `QuickReferralModal`

**Files:**
- Create: `src/modals/QuickReferralModal.jsx`

A lógica que dá para testar em node já está na Task 8. O pop-up é conferido no navegador na Task 12.

- [ ] **Step 1: Criar o componente**

Criar `src/modals/QuickReferralModal.jsx`:

```jsx
import { useRef, useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { CheckCircle2, Plus } from 'lucide-react';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { useDuplicateLead, findDuplicateLeadRemote } from '../hooks/useDuplicateLead.js';
import { buildNewLeadDoc } from '../lib/newLead.js';
import { formatPhone } from '../lib/masks.js';
import { quickReferralForm, quickReferralIssue } from '../lib/referrals.js';
import { commitReferralLink } from '../lib/referralsWrites.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog.jsx';
import { LeadLink } from '../components/nav/AppLink.jsx';
import { Btn } from '../components/ui/Btn.jsx';

// Cadastro de indicações à mão, pela ficha do cliente (menu Indicar e aba
// Indicações). Um indicado depois do outro: Cadastrar grava, limpa os campos e
// volta o cursor para o Nome, e cada gravado entra em "Cadastradas agora".
// O lead sai do mesmo montador do Novo lead (buildNewLeadDoc), no funil
// Indicações, com quem cadastra de dono (as rules só deixam o consultor criar
// lead em nome dele mesmo). O vínculo com o cliente sai do commitReferralLink,
// que grava referredAt e o 🤝 nas duas linhas do tempo. `referrer` é o doc do
// cliente inteiro: o commitReferralLink tira dele os campos de segurança da
// interação que vai para a linha do tempo do cliente.

const EMPTY = { name: '', whatsapp: '', modalidade: '', dor: '' };
const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
const INPUT = 'w-full h-9 rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40';

function Field({ label, required = false, children }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[11.5px] font-medium text-muted-foreground">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

export function QuickReferralModal({ db, appUser, referrer, referralFunnelId, entryStageName, onClose, onCreated }) {
  const toast = useToast();
  const { modalities = [], dores = [] } = useGeneralConfig();
  const [form, setForm] = useState(EMPTY);
  const [created, setCreated] = useState([]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const nameRef = useRef(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const digits = onlyDigits(form.whatsapp);
  const { duplicate } = useDuplicateLead({ db, phoneDigits: digits });
  const canSubmit = !quickReferralIssue(form) && !duplicate && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      // O aviso ao vivo tem espera de 300 ms: digitar e apertar Enter rápido
      // passaria por ele, então confere de novo na hora de gravar.
      const dup = await findDuplicateLeadRemote({ db, phoneDigits: digits });
      if (dup) {
        toast.warning(`Já existe um cadastro com este WhatsApp: ${dup.name}.`);
        return;
      }
      const leadForm = quickReferralForm(form, { funnelId: referralFunnelId, entryStageName });
      const ref = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH), {
        ...buildNewLeadDoc(leadForm, { owner: appUser, referrer }),
        createdAt: serverTimestamp(),
        statusEnteredAt: serverTimestamp(),
      });
      // Best-effort, como no Novo lead: o vínculo já está no doc criado acima.
      try {
        await commitReferralLink({
          db,
          lead: { id: ref.id, name: leadForm.name, consultantId: appUser.id, consultantAuthUid: appUser.authUid },
          appUser,
          referrer,
        });
      } catch (err) {
        console.error('commitReferralLink falhou', err);
      }
      setCreated((list) => [...list, { id: ref.id, name: leadForm.name, whatsapp: form.whatsapp }]);
      setForm(EMPTY);
      if (onCreated) onCreated();
      setTimeout(() => nameRef.current?.focus(), 0);
    } catch (err) {
      console.error('QuickReferralModal', err);
      toast.error('Não foi possível cadastrar a indicação. Tente novamente.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[480px] rounded-2xl p-5 gap-0">
        <DialogTitle className="text-[16px] font-bold tracking-tight pr-6">
          Indicações de {referrer?.name || 'cliente'}
        </DialogTitle>
        <DialogDescription className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-1">
          Entram no funil Indicações, com você de responsável.
        </DialogDescription>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nome" required>
              <input
                ref={nameRef}
                autoFocus
                className={INPUT}
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Juliana Prado"
              />
            </Field>
            <Field label="WhatsApp" required>
              <input
                type="tel"
                inputMode="numeric"
                className={INPUT}
                value={formatPhone(form.whatsapp)}
                onChange={(e) => set({ whatsapp: formatPhone(e.target.value) })}
                placeholder="(51) 9 9812-4410"
              />
            </Field>
            {modalities.length > 0 && (
              <Field label="Modalidade de interesse">
                <select className={INPUT} value={form.modalidade} onChange={(e) => set({ modalidade: e.target.value })}>
                  <option value="">Escolher</option>
                  {modalities.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              </Field>
            )}
            {dores.length > 0 && (
              <Field label="Dor">
                <select className={INPUT} value={form.dor} onChange={(e) => set({ dor: e.target.value })}>
                  <option value="">Escolher</option>
                  {dores.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </Field>
            )}
          </div>

          {duplicate && (
            <p className="text-[12px] text-rose-600 dark:text-rose-400">
              Já existe:{' '}
              <LeadLink leadId={duplicate.id} target="_blank" rel="noopener" className="font-semibold underline">
                {duplicate.name || 'sem nome'}
              </LeadLink>
            </p>
          )}

          <div className="flex justify-end">
            <Btn kind="brand" type="submit" icon={<Plus size={14} />} disabled={!canSubmit}>
              {saving ? 'Cadastrando…' : 'Cadastrar'}
            </Btn>
          </div>
        </form>

        {created.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <div className="text-[11.5px] font-medium text-muted-foreground mb-1">
              Cadastradas agora · {created.length}
            </div>
            <ul className="flex flex-col">
              {created.map((c) => (
                <li key={c.id}>
                  <LeadLink
                    leadId={c.id}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center gap-2 py-1.5 text-[13px] rounded-md hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                  >
                    <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="num text-[12px] text-muted-foreground">{c.whatsapp}</span>
                  </LeadLink>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Btn kind="secondary" onClick={onClose}>Concluir</Btn>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

Os links de "Já existe" e de "Cadastradas agora" abrem em outra guia, para o pop-up continuar aberto na ficha do cliente.

- [ ] **Step 2: Lint**

Run: `npx eslint src/modals/QuickReferralModal.jsx`
Expected: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/modals/QuickReferralModal.jsx
git commit -m "feat: pop-up de cadastro de indicações em sequência

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Ficha do cliente: menu "Indicar" e aba Indicações

**Files:**
- Modify: `src/components/profile/ReferralsSection.jsx`
- Modify: `src/views/LeadProfileView.jsx`
- Test: `src/lib/__tests__/referralsSection.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/__tests__/referralsSection.test.js`:

```js
// Aba Indicações: o botão de cadastro à mão aparece quando a ficha passa
// onAdd, na lista e no aviso de vazio.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

vi.mock('../firebase.js', () => ({ appId: 'acad', LEADS_PATH: 'leads', db: {}, auth: {}, storage: {} }));

const { ReferralsSection } = await import('../../components/profile/ReferralsSection.jsx');

const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: 'profile' };
const render = (props) => renderToString(
  createElement(MemoryRouter, { initialEntries: ['/acad/ficha/c1/indicacoes'] },
    createElement(LeadProfileContext.Provider, { value: profile }, createElement(ReferralsSection, props))));

describe('ReferralsSection', () => {
  it('vazio com onAdd: convida a cadastrar e cita o Indicar', () => {
    const html = render({ items: [], loading: false, onAdd: () => {} });
    expect(html).toContain('Cadastrar indicação');
    expect(html).toContain('Indicar');
  });

  it('lista com onAdd: o botão fica em cima', () => {
    const html = render({ items: [{ id: 'l1', name: 'Juliana', status: 'Aguardando ação' }], loading: false, onAdd: () => {} });
    expect(html.indexOf('Cadastrar indicação')).toBeGreaterThan(-1);
    expect(html.indexOf('Cadastrar indicação')).toBeLessThan(html.indexOf('Juliana'));
  });

  it('sem onAdd, nada de botão', () => {
    expect(render({ items: [], loading: false })).not.toContain('Cadastrar indicação');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/referralsSection.test.js`
Expected: FAIL nos dois testes com `onAdd`.

- [ ] **Step 3: `ReferralsSection` com `onAdd`**

Em `src/components/profile/ReferralsSection.jsx`:

1. Trocar `import { Handshake } from 'lucide-react';` por `import { Handshake, UserPlus } from 'lucide-react';` e acrescentar `import { Btn } from '../ui/Btn.jsx';`.
2. Trocar o comentário e o começo do componente:

```jsx
// Conteúdo da aba Indicações da ficha do CLIENTE: resumo + lista dos indicados.
// O menu Indicar vive no cabeçalho da ficha, ao lado do WhatsApp. `onAdd`
// (opcional) liga o botão de cadastrar indicação à mão; a ficha só passa
// quando a academia tem o funil Indicações e a pessoa pode editar.
// O estado de cada indicado é derivado AO VIVO do doc dele (deriveLeadState/
// isClientLead) — desfazer uma Venda reflete aqui sozinho.
export function ReferralsSection({ items, loading, onAdd = null }) {
  const { contractThresholdDays } = useGeneralConfig();
  const summary = useMemo(() => summarizeReferrals(items || []), [items]);
  const now = new Date();
  const addButton = onAdd ? (
    <Btn kind="brand" icon={<UserPlus size={14} />} onClick={onAdd}>Cadastrar indicação</Btn>
  ) : null;
```

3. No bloco do vazio, trocar o `<p>` do texto e acrescentar o botão logo depois dele:

```jsx
        <p className="text-[12.5px] text-muted-foreground mt-1 max-w-[420px] mx-auto leading-relaxed">
          Use o botão Indicar, no topo da ficha, para cadastrar as indicações do cliente ou mandar o link para ele convidar os amigos. Também dá para cadastrar um lead novo com o interruptor “É uma indicação?”. Os indicados aparecem aqui com o andamento de cada um.
        </p>
        {addButton && <div className="mt-4 flex justify-center">{addButton}</div>}
```

4. Na lista, logo depois de `<section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">` e antes do comentário `{/* Resumo */}`, acrescentar:

```jsx
        {addButton && (
          <div className="px-5 sm:px-8 pt-4 flex justify-end">{addButton}</div>
        )}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/referralsSection.test.js`
Expected: PASS.

- [ ] **Step 5: Ligar na `LeadProfileView.jsx`**

Em `src/views/LeadProfileView.jsx`:

1. Imports:
   - no import de `'../lib/referrals.js'`, acrescentar `getReferralEntryStage`;
   - acrescentar `import { QuickReferralModal } from '../modals/QuickReferralModal.jsx';` junto dos outros modais;
   - no import do `lucide-react`, tirar `Link2` (só o menu usava).

2. Logo depois da linha do `useReferrals(...)`, acrescentar:

```js
  // Cadastro à mão de indicações (menu Indicar e aba Indicações). Só existe
  // com o funil Indicações e a etapa de entrada, a mesma trava do "É uma
  // indicação?" do Novo lead, e só para quem pode editar.
  const referralEntry = referralFunnel ? getReferralEntryStage(statuses, referralFunnel.id) : null;
  const canQuickReferral = isClient && !isReadOnly && Boolean(referralFunnel && referralEntry);
  const [quickReferralOpen, setQuickReferralOpen] = useState(false);
```

3. No menu do cabeçalho, trocar o conteúdo do `DropdownMenuTrigger` (`<Link2 size={14} /> Link de indicação`) por `<Handshake size={14} /> Indicar`, e acrescentar como primeiro filho do `DropdownMenuContent`:

```jsx
                    {canQuickReferral && (
                      <DropdownMenuItem onSelect={() => setQuickReferralOpen(true)} className="cursor-pointer">
                        <UserPlus className="size-4 text-brand-600 dark:text-brand-300" /> Cadastrar indicação
                      </DropdownMenuItem>
                    )}
```

4. Na aba Indicações, trocar `<ReferralsSection items={referralItems} loading={referralsLoading} />` por:

```jsx
            <ReferralsSection
              items={referralItems}
              loading={referralsLoading}
              onAdd={canQuickReferral ? () => setQuickReferralOpen(true) : null}
            />
```

5. Logo antes de `{referrerDialogOpen && (`, acrescentar:

```jsx
      {quickReferralOpen && (
        <QuickReferralModal
          db={db}
          appUser={appUser}
          referrer={lead}
          referralFunnelId={referralFunnel?.id}
          entryStageName={referralEntry?.name}
          onClose={() => setQuickReferralOpen(false)}
          onCreated={reloadReferrals}
        />
      )}
```

- [ ] **Step 6: Rodar testes e lint**

Run: `npx vitest run && npx eslint .`
Expected: PASS e 0 erros.

- [ ] **Step 7: Commit**

```bash
git add src/components/profile/ReferralsSection.jsx src/views/LeadProfileView.jsx src/lib/__tests__/referralsSection.test.js
git commit -m "feat: Indicar na ficha do cliente com cadastro de indicação à mão

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Ajuda, novidade e documentação

**Files:**
- Modify: `src/lib/wiki.js`
- Modify: `src/components/help/WikiDemo.jsx`
- Modify: `src/lib/announcements.js`
- Modify: `docs/indicacoes.md`
- Modify: `CLAUDE.md` (o do Stronilead, na raiz do repositório)

- [ ] **Step 1: Artigo de agendamentos (`wiki.js`)**

No artigo `id: 'agendamentos'`, trocar o `demo` e o `steps` logo abaixo de `{ t: 'h', text: 'Registrando o desfecho' }` por:

```js
      { t: 'demo', name: 'desfecho', caption: 'Marcar desfecho abre o balão. Compareceu avança a pessoa para Negociação.' },
      { t: 'steps', items: [
        'Clique em Marcar desfecho, no card da Meta, no Próximo compromisso ou na Agenda de hoje.',
        'Compareceu: a pessoa avança sozinha para Negociação e a aula fica registrada no histórico do professor.',
        'Não compareceu: fica registrado e a Meta já abre a remarcação.',
        'Remarcou: escolha a data nova e o compromisso se move.',
        'Cancelou: encerra o agendamento sem mover a pessoa no funil.',
      ] },

      { t: 'h', text: 'Corrigindo no mesmo dia' },
      { t: 'p', text: 'Marcou errado? Clique no desfecho, na Agenda de hoje ou em Feitos hoje, e troque. Trocar Compareceu por Não compareceu devolve a pessoa para a etapa em que estava, se ninguém a moveu depois, e a linha do tempo registra a correção. Na Agenda de hoje também dá para desfazer a marcação.' },
```

- [ ] **Step 2: Artigos de indicações (`wiki.js`)**

No artigo `id: 'indicacoes'`:

1. Logo depois do `steps` da seção `'1. Registrando a indicação'` (o que termina em `'Salve. Não precisa escolher funil nem etapa: o sistema já sabe para onde vai.'`), acrescentar:

```js
      { t: 'p', text: 'Quando o aluno passa vários nomes de uma vez, é mais rápido pela ficha dele:' },
      { t: 'steps', items: [
        'Abra a ficha do aluno que indicou.',
        'Clique em Indicar, no cabeçalho, e escolha Cadastrar indicação. A aba Indicações tem o mesmo botão.',
        'Preencha nome e WhatsApp. Modalidade e dor são opcionais.',
        'Clique em Cadastrar. Os campos limpam para o próximo, e cada cadastrado aparece na lista embaixo.',
      ] },
```

2. Na seção `'2. Para onde o indicado vai'`, trocar o primeiro `p` por:

```js
      { t: 'p', text: 'O lead entra no funil Indicações, na etapa Aguardando ação, com a origem Indicação. Quem cadastrou fica responsável por ele. Pelo link do aluno, fica o consultor responsável pelo aluno que indicou. As indicações ficam todas juntas, num funil que a equipe trabalha sabendo que aquela pessoa chegou por confiança.' },
```

No artigo `id: 'link-indicacao'`, trocar `'Clique em Link de indicação, no cabeçalho, ao lado do WhatsApp.'` por `'Clique em Indicar, no cabeçalho, ao lado do WhatsApp.'`.

- [ ] **Step 3: Demo do desfecho (`WikiDemo.jsx`)**

Trocar o `case 'desfecho':` inteiro por:

```jsx
    case 'desfecho':
      return (
        <Screen>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400">Aula de Ana Prado</div>
            <span className="h-6 px-2 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-neutral-800 grid place-items-center text-[9px] font-semibold text-slate-600 dark:text-slate-300">Marcar desfecho ▾</span>
          </div>
          <div className="ml-auto w-[70%] rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-neutral-800 p-1.5 flex flex-col gap-1">
            <span className="h-6 rounded-md grid place-items-center text-[9px] font-semibold text-white bg-emerald-500" style={A('wdPop')}>Compareceu</span>
            <span className="h-6 rounded-md grid place-items-center text-[9px] font-semibold text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/10">Não compareceu</span>
          </div>
          <div className="mt-2 text-[9px] text-slate-500 dark:text-slate-400" style={A('wdPop')}>
            → Ana avança para <span className="font-semibold text-violet-600 dark:text-violet-400">Negociação</span>
          </div>
        </Screen>
      );
```

- [ ] **Step 4: Novidade no sino (`announcements.js`)**

Acrescentar como primeiro item do array `ANNOUNCEMENTS`:

```js
  {
    id: 'desfecho-e-indicacao-manual-2026-09',
    audience: 'todos',
    date: '2026-09-29',
    articleId: 'agendamentos',
    eyebrow: 'Novidade',
    title: 'Marcar desfecho na Meta e cadastrar indicações pela ficha',
    summary:
      'Na Meta Diária, visita e aula experimental agora têm o botão Marcar desfecho, que abre Compareceu e Não compareceu. Marcou errado? Clique no desfecho e troque: a pessoa volta para a etapa em que estava. O switch da Agenda de hoje e o gesto de segurar para desmarcar saíram. Na ficha do aluno, o botão Indicar ganhou Cadastrar indicação, para lançar os indicados um depois do outro.',
  },
```

- [ ] **Step 5: `docs/indicacoes.md`**

1. Na seção `## Fase 2 — link compartilhável`, trocar `caixa "Link de indicação" da aba Indicações da ficha` por `menu "Indicar" do cabeçalho da ficha`.
2. No fim do arquivo, acrescentar:

```markdown
## Fase 3 — cadastro à mão pela ficha (2026-09-29)

Terceira forma de entrada, ao lado do "É uma indicação?" do Novo lead e do link.
Na ficha do cliente, o menu "Indicar" (antes "Link de indicação") e a aba
Indicações têm "Cadastrar indicação", que abre `src/modals/QuickReferralModal.jsx`.
O pop-up pede nome e WhatsApp (obrigatórios), modalidade e dor (opcionais), e
fica aberto para o próximo indicado depois de cada cadastro.

- O formulário sai de `quickReferralForm` (`src/lib/referrals.js`) e o doc, de
  `buildNewLeadDoc`: funil Indicações, etapa de entrada, origem "Indicação".
- O dono é quem cadastra, como no Novo lead. As rules só deixam o consultor
  criar lead em nome dele mesmo.
- WhatsApp repetido barra, como no Novo lead (`useDuplicateLead` ao vivo e
  `findDuplicateLeadRemote` na hora de gravar).
- `commitReferralLink` grava `referredAt` e o 🤝 nos dois lados. Não há
  `referralVia`: o sino só avisa o que chega pelo link.
- Só aparece com o funil Indicações e a etapa de entrada, e para quem pode
  editar a ficha.
```

- [ ] **Step 6: `CLAUDE.md` do Stronilead**

Em `CLAUDE.md` (raiz do repositório), na seção `## Convenções gerais`, acrescentar ao fim da lista:

```markdown
- O desfecho de visita e aula na Meta Diária é marcado pelo botão "Marcar desfecho" (`src/components/dailygoal/OutcomePopover.jsx`), na Agenda de hoje, no card "A fazer", no Próximo compromisso e no "Feitos hoje". A gravação mora em `src/lib/appointmentOutcome.js` e as regras, em `src/lib/outcomeCorrection.js`. Quando o Compareceu leva o lead para Negociação, o lead guarda de onde saiu em `appointmentPromotedFrom`, e toda gravação de desfecho escreve esse campo (null sem promoção). A correção para Não compareceu, ou o desfazer, devolve a etapa só se o lead continua em Negociação no mesmo funil, e grava uma `daily_goal_done` com `outcomeCorrection: true`, que o relatório de visitas lê como o último desfecho do dia.
```

- [ ] **Step 7: Rodar testes e lint**

Run: `npx vitest run && npx eslint .`
Expected: PASS (inclui `wiki.test.js`) e 0 erros.

- [ ] **Step 8: Commit**

```bash
git add src/lib/wiki.js src/components/help/WikiDemo.jsx src/lib/announcements.js docs/indicacoes.md CLAUDE.md
git commit -m "docs: ajuda, novidade e documentação do desfecho e da indicação à mão

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Verificação completa e conferência no navegador

**Files:** nenhum arquivo do app. A tela de teste é montada com arquivos temporários que não entram em commit.

- [ ] **Step 1: Suíte, lint e build**

Run: `npx vitest run && npx eslint . && npm run build`
Expected: todos os testes passando (linha de base 3099 mais os novos), lint com 0 erros e build sem erro.

- [ ] **Step 2: Montar a tela de teste sem login**

Criar, sem commitar:

`src/__repro__/firebaseFake.js`:

```js
export const appId = 'acad';
export const LEADS_PATH = 'leads';
export const INTERACTIONS_PATH = 'inter';
export const CONTRACTS_PATH = 'contracts';
export const DAILY_GOAL_HISTORY_PATH = 'hist';
export const db = {};
export const auth = {};
export const storage = {};
```

`src/__repro__/firestoreFake.js`:

```js
// Firestore de mentira: anota as gravações em window.__writes e responde
// "ninguém com esse WhatsApp", menos para 51999990000, que já existe.
const log = (op, data) => { (window.__writes ||= []).push({ op, data }); };
export const collection = (...p) => ({ path: p.slice(1).join('/') });
export const doc = (...p) => ({ path: p.slice(1).join('/'), id: `id${Math.random().toString(36).slice(2, 8)}` });
export const query = (ref, ...c) => ({ ref, c });
export const where = (f, op, v) => ({ f, op, v });
export const limit = (n) => ({ n });
export const serverTimestamp = () => new Date();
export const increment = (n) => n;
export const getDocs = async (q) => {
  const hit = (q.c || []).some((c) => c?.f === 'whatsappDigits' && c.v === '51999990000');
  return { docs: hit ? [{ id: 'dup1', data: () => ({ name: 'Carlos Já Cadastrado', createdAt: new Date() }) }] : [] };
};
export const addDoc = async (ref, data) => { log('add', { path: ref.path, data }); return { id: `novo${Math.random().toString(36).slice(2, 6)}` }; };
export const updateDoc = async (ref, data) => { log('update', { path: ref.path, data }); };
export const writeBatch = () => {
  const ops = [];
  return { set: (ref, data) => ops.push({ ref, data }), update: (ref, data) => ops.push({ ref, data }), commit: async () => log('batch', ops) };
};
export const getDoc = async () => ({ exists: () => false, data: () => ({}) });
export const onSnapshot = () => () => {};
```

`src/__repro__/harness.jsx`:

```jsx
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import '../index.css';
import { ToastProvider } from '../contexts/ToastContext.jsx';
import { LeadProfileContext } from '../contexts/LeadProfileContext.jsx';
import { GeneralConfigContext } from '../contexts/GeneralConfigContext.jsx';
import { DayAgendaCard } from '../components/dailygoal/DayAgendaCard.jsx';
import { TaskCard, DoneCard } from '../views/DailyGoalView.jsx';
import { QuickReferralModal } from '../modals/QuickReferralModal.jsx';
import { ReferralsSection } from '../components/profile/ReferralsSection.jsx';

const now = new Date();
const at = (h, m = 0) => { const d = new Date(now); d.setHours(h, m, 0, 0); return d; };
const profile = { openProfile: () => {}, leadHref: (id) => `/acad/ficha/${id}`, from: 'dailyGoal' };
const config = {
  modalities: [{ id: 'm1', name: 'Pilates' }, { id: 'm2', name: 'Musculação' }],
  dores: [{ id: 'd1', name: 'Dor nas costas' }, { id: 'd2', name: 'Emagrecer' }],
  trialClassOptions: [1, 2, 3], units: [], metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3, dailyVolumeTarget: 0,
  planos: [], contratos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30], renewalGraceDays: 15, professores: [],
};

function Meta() {
  const [rows, setRows] = useState([
    { id: 'a', name: 'Ana Souza', outcome: null, categorySlug: 'visita_hoje', scheduledAt: at(18), isMine: true, ownerName: 'Lucas' },
    { id: 'b', name: 'Bruno Lima', outcome: 'attended', categorySlug: 'aula_hoje', scheduledAt: at(19, 30), isMine: false, ownerName: 'Paula', appointmentModality: 'Pilates' },
    { id: 'c', name: 'Carla Dias', outcome: 'no_show', categorySlug: 'visita_hoje', scheduledAt: at(20), isMine: true, ownerName: 'Lucas' },
  ]);
  const onMark = (row, choice) => setRows((rs) => rs.map((r) => (r.id !== row.id ? r : { ...r, outcome: choice === 'undo' ? null : choice })));
  const done = {
    id: 'd', name: 'Diego Alves', categorySlugs: ['visita_hoje'], categoryStatus: { visita_hoje: true },
    appointmentOutcome: 'attended', appointmentOutcomeAt: at(9), appointmentScheduledFor: at(8),
  };
  return (
    <div className="grid grid-cols-12 gap-4 p-6">
      <div className="col-span-8 flex flex-col gap-3">
        <TaskCard task={{ id: 't1', name: 'Eva Ramos', whatsapp: '51998887766', createdAt: now, categorySlugs: ['visita_hoje'], categoryStatus: {} }}
          slug="visita_hoje" now={now} onOutcome={(t, id) => console.log('onOutcome', id)} onReschedule={() => console.log('onReschedule')} />
      </div>
      <div className="col-span-4 flex flex-col gap-3">
        <DayAgendaCard rows={rows} pending={rows.filter((r) => !r.outcome).length} nextIndex={0} savingId={null} onMark={onMark} />
        <DoneCard lead={done} now={now} onReschedule={() => {}} onCorrect={(l, s, to) => console.log('onCorrect', to)} />
      </div>
    </div>
  );
}

function Indicacoes() {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-6 max-w-[760px]">
      <ReferralsSection items={[]} loading={false} onAdd={() => setOpen(true)} />
      {open && (
        <QuickReferralModal db={{}} appUser={{ id: 'u1', authUid: 'auth1', name: 'Lucas' }}
          referrer={{ id: 'c1', name: 'Carla Mendes', consultantId: 'u1', consultantAuthUid: 'auth1' }}
          referralFunnelId="fRef" entryStageName="Aguardando ação" onClose={() => setOpen(false)} onCreated={() => console.log('onCreated')} />
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <MemoryRouter>
    <ToastProvider>
      <GeneralConfigContext.Provider value={config}>
        <LeadProfileContext.Provider value={profile}>
          <Meta />
          <Indicacoes />
        </LeadProfileContext.Provider>
      </GeneralConfigContext.Provider>
    </ToastProvider>
  </MemoryRouter>
);
```

`repro.html` (na raiz):

```html
<!doctype html>
<html lang="pt-BR" translate="no">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Harness</title></head>
  <body class="bg-background"><div id="root"></div><script type="module" src="/src/__repro__/harness.jsx"></script></body>
</html>
```

`vite.repro.config.js` (na raiz):

```js
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIREBASE_FAKE = path.resolve(__dirname, 'src/__repro__/firebaseFake.js');
const FIRESTORE_FAKE = path.resolve(__dirname, 'src/__repro__/firestoreFake.js');

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'repro-fakes',
      enforce: 'pre',
      async resolveId(source, importer, options) {
        if (source === 'firebase/firestore') return FIRESTORE_FAKE;
        const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
        if (resolved && resolved.id.endsWith(`${path.sep}src${path.sep}lib${path.sep}firebase.js`)) return FIREBASE_FAKE;
        return resolved;
      },
    },
  ],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: 5199, open: false },
});
```

`.claude/launch.json` (na worktree):

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "harness", "runtimeExecutable": "npx", "runtimeArgs": ["vite", "--config", "vite.repro.config.js"], "port": 5199 }
  ]
}
```

Se o `ToastProvider` exigir props, ler `src/contexts/ToastContext.jsx` e passar o que ele pede. Se o `DailyGoalView.jsx` importar do Firestore alguma função que o fake não tem, acrescentar ao `firestoreFake.js` uma versão vazia com o mesmo nome.

- [ ] **Step 3: Conferir no navegador**

Subir com `preview_start` (nome `harness`) e abrir `http://localhost:5199/repro.html`. Conferir, com captura de tela em cada passo:

1. **Agenda de hoje:**
   - "Marcar desfecho" na linha da Ana;
   - "Compareceu" verde na do Bruno;
   - "Não compareceu" vermelho na da Carla;
   - bolinha vermelha na Carla;
   - o botão cabe na linha sem cortar o nome;
   - clicar abre o balão ao lado, e escolher fecha o balão e muda a linha;
   - "Desfazer marcação" volta ao cinza.
2. **Card "A fazer"** da Eva: um "Marcar desfecho" no lugar dos 4 botões. O balão tem as 4 opções, e o console mostra `onOutcome` ou `onReschedule`.
3. **Feitos hoje** do Diego: o chip "Compareceu" abre "Trocar para não compareceu", sem "Desfazer", e o console mostra `onCorrect no_show`.
4. **Indicações:**
   - "Cadastrar indicação" no vazio abre o pop-up;
   - o cursor já está no Nome;
   - o Enter com nome e WhatsApp válidos cadastra, e a lista "Cadastradas agora" cresce, os campos limpam e o cursor volta para o Nome;
   - o WhatsApp `(51) 9 9999-0000` mostra "Já existe: Carlos Já Cadastrado" e desliga o Cadastrar;
   - "Concluir" fecha.
   - Conferir `window.__writes` no console, com o JavaScript do navegador: um `add` em `leads` com `source: 'Indicação'`, `funnelId: 'fRef'`, `status: 'Aguardando ação'`, `referredById: 'c1'`, e um `batch` com as duas interações `referral`.
5. **Tema escuro:** repetir as capturas com `resize_window` e `colorScheme: 'dark'`.
6. **Celular:** repetir com `resize_window` e `preset: 'mobile'` e conferir o balão e o pop-up. Depois voltar com `preset: 'desktop'`.

- [ ] **Step 4: Menu do cabeçalho abrindo o pop-up**

O menu "Indicar" da ficha não entra na tela de teste, porque a ficha precisa de dados demais. O risco conhecido é o do Radix: um Dialog aberto por item de DropdownMenu às vezes deixa `pointer-events: none` no `<body>` depois de fechar. Para conferir, acrescentar à tela de teste um `DropdownMenu` (de `src/components/ui/dropdown-menu.jsx`) com um item que chama `setOpen(true)` no `onSelect`, abrir, fechar o pop-up e rodar `getComputedStyle(document.body).pointerEvents` no console.

- Se voltar `'none'`, trocar na `LeadProfileView.jsx` o `<DropdownMenu>` do Indicar por `<DropdownMenu modal={false}>`.
- Refazer a conferência e commitar a troca com `fix: menu Indicar não trava a página depois do pop-up`.

- [ ] **Step 5: Limpar a tela de teste**

```bash
rm -rf src/__repro__ repro.html vite.repro.config.js .claude/launch.json
git status --short
```

Expected: `git status` limpo (só o que já foi commitado).

---

### Task 13: Abrir o PR

- [ ] **Step 1: Subir a branch**

```bash
git push -u origin claude/daily-meta-manual-referrals-ea5bac
```

- [ ] **Step 2: Abrir o PR**

Título: `Meta: Marcar desfecho com correção, e indicação cadastrada à mão pela ficha`

Corpo, em português, sem travessão no meio das frases:

```markdown
## O que muda

**Meta Diária**

- O switch de presença da Agenda de hoje saiu. Visita e aula experimental agora têm o botão "Marcar desfecho", que abre um balão com Compareceu e Não compareceu.
- O card "A fazer" e o Próximo compromisso também usam o balão, com Remarcou e Cancelou embaixo.
- Depois de marcado, o botão mostra o desfecho e reabre o balão para corrigir. Isso vale na Agenda de hoje e no "Feitos hoje".
- Trocar Compareceu por Não compareceu:
  - devolve o lead para a etapa em que estava, se ele continua em Negociação no mesmo funil;
  - repõe o próximo contato quando ele está vazio;
  - registra a correção na linha do tempo, que o relatório de visitas lê.
- Na Agenda de hoje dá para desfazer a marcação, no lugar do gesto escondido de segurar o botão.

**Ficha do cliente**

- O "Link de indicação" virou "Indicar", com "Cadastrar indicação" como primeira opção. A aba Indicações tem o mesmo botão.
- O pop-up pede nome e WhatsApp, e modalidade e dor opcionais. Ele fica aberto para o próximo indicado e mostra a lista do que foi cadastrado.
- O lead entra no funil Indicações, na etapa de entrada, com quem cadastrou de responsável e o 🤝 nas duas linhas do tempo.

## Dados

- Campo novo no lead: `appointmentPromotedFrom` (`status`, `statusEnteredAt`, `funnelId` e `toStatus`), gravado em todo desfecho.
- Campo novo na interação: `outcomeCorrection: true`.
- Nenhuma regra do Firestore muda, nenhum índice novo e nenhuma função nova na Vercel.

## Spec e plano

- `docs/superpowers/specs/2026-09-29-desfecho-da-meta-e-indicacao-manual-design.md`
- `docs/superpowers/plans/2026-09-29-desfecho-da-meta-e-indicacao-manual.md`

## Como foi testado

- `npx vitest run`: <número> testes passando.
- `npx eslint .`: 0 erros.
- `npm run build`: sem erro.
- Tela de teste sem login, em claro, escuro e celular: agenda, card, "Feitos hoje" e o pop-up de indicações.

## Para testar depois do deploy

- Marcar Compareceu numa visita de teste, trocar para Não compareceu e conferir a etapa e a linha do tempo.
- Cadastrar duas indicações seguidas pela ficha de um cliente de teste.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Criar com `gh pr create --base main --title "<título>" --body "<corpo>"`, trocando `<número>` pelo total real da Task 12. Depois, no app, rodar `get_status` do ccd_pr e, se o PR não aparecer, `bind_pr`.

---

## Self-review do plano

- **Cobertura da spec:**
  - switch trocado e apagado: Task 6;
  - balão nos quatro lugares: Tasks 6 e 7;
  - `appointmentPromotedFrom` em toda gravação e zerado na remarcação: Tasks 3 e 7;
  - regras de volta da etapa e do próximo contato: Tasks 1 e 3;
  - marca de correção lida pelo relatório: Tasks 3 e 4;
  - desfazer só na agenda: Tasks 6 e 7, pelo `canUndo`;
  - passo seguinte depois da correção: Tasks 6 e 7;
  - bolinha vermelha: Task 6;
  - "Indicar" com a opção nova e botão na aba: Task 10;
  - pop-up em sequência com os quatro campos e o bloqueio de duplicado: Task 9;
  - gravação pelo `buildNewLeadDoc` e pelo `commitReferralLink`, com quem cadastra de dono: Tasks 8 e 9;
  - trava do funil e de quem pode editar: Task 10;
  - ajuda, novidade e documentação: Task 11;
  - testes: Tasks 1 a 10 e conferência na Task 12.
- **Nomes conferidos entre tarefas:**
  - `planPromotion`, `planAttendedUndo`, `correctableOutcome`, `correctionText` e `revertStageText` (Task 1);
  - `outcomeMenuItems` e `outcomeTriggerLabel` (Task 2);
  - `correctAppointmentOutcome` e `clearAppointmentOutcome({ extraPatch })` (Task 3);
  - `OutcomePopover` com `outcome`, `title`, `withMore`, `canUndo`, `saving`, `size`, `className` e `onPick` (Task 5);
  - `quickReferralForm`, `quickReferralIssue` e `REFERRAL_SOURCE_NAME` (Task 8);
  - `QuickReferralModal` com `db`, `appUser`, `referrer`, `referralFunnelId`, `entryStageName`, `onClose` e `onCreated` (Task 9).
