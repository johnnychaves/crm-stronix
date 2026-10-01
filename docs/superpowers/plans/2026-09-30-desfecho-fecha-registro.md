# Desfecho fecha o registro ao agendar de novo · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agendar de novo pelo assistente da ficha ou pelo Stronizap, depois de um "Compareceu" ou de um "Não veio", deixa de apagar o desfecho do Dashboard CRM: o registro do agendamento antigo em `stronix_aulas` fecha com o desfecho antes de o agendamento novo abrir outro, na regra do Remarcar da Meta Diária (PR #237).

**Architecture:** A regra fica pura em `src/lib/aulas.js`. O `rescheduleRecordPlan` do #237 passa a ler o desfecho e o instante do agendamento, o `recordPlanFor` aplica a regra a um lead e o `recordMatchesAppointment` é a guarda da data. O navegador grava pelo `recordNewAppointment` (`src/lib/aulasWrites.js`), que o `handleWizardConfirm` chama. A ponte decide pelo `scheduleRecordChanges` (`api/_zapSchedule.js`) e grava o fechamento na mesma transação de `api/zap.js`, com toda leitura antes de qualquer escrita.

**Tech Stack:** React 19, Vite, Firebase (Firestore no navegador, firebase-admin na `api/`), Vercel serverless, Vitest.

**Pedido:** Johnny, 30/09/2026, sobre a limitação registrada no `CLAUDE.md` (seção "Agendamento pelo Stronizap"). Não há spec: as decisões estão nas notas de abertura.

**Repositório, branch e base:** `~/STRONIX-FIRMA/06-sistemas/stronilead`, worktree `.claude/worktrees/desfecho-fecha-registro`, branch `claude/desfecho-fecha-registro`. O pedido era criar o branch a partir do `claude/agendamento-pelo-zap` e apontar a base do PR para ele, porque o PR #239 ainda não tinha entrado. Isso mudou no mesmo dia: o #239 entrou na main às 16:36 (com a cabeça em `c874d1f`), e o que veio depois nesse branch (a revisão final do `ja_agendado` e as notas do `CLAUDE.md`) entrou pelo PR #240 às 18:45, no merge `c08cd44`. O worktree e o branch já existem, criados da main em `c08cd44`, e a árvore desse commit é igual à do `734bbda`, a última do `claude/agendamento-pelo-zap`. Por isso a base do PR é a `main`. As linhas citadas são as de `c08cd44`, e os caminhos são relativos à raiz do worktree.

**PRs abertos que mexem perto:** #234 e #235 (aba Contratos da ficha) mexem em `src/views/LeadProfileView.jsx` e no `CLAUDE.md`. Se entrarem antes, o conflito provável é nos imports do topo do `LeadProfileView.jsx`: mantenha os dois lados. #196 não toca nada daqui.

**Regras do projeto que valem aqui** (do `CLAUDE.md`):
- nenhum arquivo de `api/` chega a `src/lib/aulasWrites.js`, `src/lib/interactions.js`, `src/lib/firebase.js`, `src/lib/dailyGoal.js` ou `src/lib/funnels.js`; a `api/` importa só módulos puros de `src/lib`, e o `src/lib/__tests__/newLeadImports.test.js` segue o grafo do `api/_zapSchedule.js`;
- em `api/`, `snap.exists` é propriedade; em `src/`, `snap.exists()` é função;
- na transação da ponte, toda leitura vem antes de qualquer escrita, e nenhum campo vai `undefined`: o banco falso de `api/__tests__/zapRoute.test.js` recusa as duas coisas, como o firebase-admin;
- o dual-write do navegador em `stronix_aulas` é best-effort: falha ali vai para o console e não derruba o agendamento do lead;
- limite de 12 funções na Vercel, hoje 11: nada de função nova;
- regras e índices do Firestore não mudam: a única consulta é a de `stronix_aulas` por `leadId`, de campo único, que o navegador e a ponte já fazem;
- textos em português, diretos, sem travessão no meio da frase;
- trabalho por PR, nunca commit na main; o merge é do Johnny.

---

## Notas de abertura: o que o código mostra e a decisão

1. **O #237 fecha a falta pelo fluxo, e não pelo desfecho do lead.** O `rescheduleRecordPlan({ previousType, finalType, afterNoShow })` (`src/lib/aulas.js:46-52`) só fecha como falta quando o Remarcar abre logo depois do "Não veio" ou da correção para "Não compareceu" (`afterNoShow`, `src/views/DailyGoalView.jsx:1518`, a partir dos `setRescheduleTarget(... flow: 'after_no_show')` das linhas 1115, 1145, 1312 e 1342). O `lead` desse fluxo é o de antes da gravação do desfecho, e por isso o #237 usa a bandeira e não o `appointmentOutcome`. O "Compareceu" não fecha nada, e na troca de tipo o registro fecha como cancelado mesmo quando a visita aconteceu.

2. **A regra vale para o "Compareceu" também.** O defeito é o mesmo. O `effectiveStatus` do Dashboard CRM (`src/lib/crm/appointments.js:92-105`) acha o desfecho da visita pelo espelho do lead ou pela linha do tempo do dia marcado, e as duas leituras dependem de o registro continuar na data da visita. Movido para a data nova, o registro sai do mês original com a falta ou com o comparecimento, e o "Compareceu" sai também dos marcos da safra (`cohortMilestones`). Decisão: o registro fecha com os dois desfechos. "Cancelou" não fecha pelo desfecho, porque ele apaga o tipo e a data do lead, e "rescheduled" é dado antigo, sem desfecho.

3. **O desfecho ganha da troca de tipo.** Levar a troca de tipo do #237 sem essa ordem pioraria o que existe. Hoje, no assistente, a visita que aconteceu e deu lugar a uma aula continua "agendada" na data dela, e o painel acha o "Compareceu" pela linha do tempo. Fechada como cancelada, ela sairia da conta. A ordem fica assim: primeiro o "Não veio" que a Meta acabou de gravar (`afterNoShow`), depois o desfecho que o lead tem, e por último a troca de tipo (cancelado). O `afterNoShow` vem na frente porque, na correção de "Compareceu" para "Não compareceu", o lead do fluxo ainda diz "Compareceu".

4. **O mesmo agendamento não fecha nada.** O desfecho pode ser marcado no mesmo dia, antes do horário (Agenda de hoje, "Marcar desfecho" ou correção), e desde o PR #240 o pedido do Stronizap no mesmo horário grava e zera o desfecho (`hasSameAppointment`, com o teste "visita de hoje com 'Não compareceu' já marcado e o mesmo horário pedido" em `api/__tests__/zapRoute.test.js`). Nesse caso o desfecho foi marcado antes da hora e o agendamento continua. Decisão: agendamento novo do mesmo tipo e no mesmo instante do que o lead tem não fecha o registro. Ele continua em aberto, e o painel o trata como o desfazer (`undoneOnLead`, `src/lib/crm/appointments.js:76-80`). Fechar contaria uma falta que não aconteceu e duas visitas no mesmo horário. Aquele teste da rota continua como está. É um dos pontos para o Johnny, abaixo.

5. **A aula não precisa de mudança no caminho normal.** O desfecho da aula já fecha o registro: o `writeAppointmentOutcome` (`src/lib/appointmentOutcome.js:111-113`) e o `handleOutcome` da Meta (`src/views/DailyGoalView.jsx:1291-1293`) chamam o `applyOutcomeToAula` quando a categoria é `aula_hoje`, com a guarda da data, e o agendamento seguinte não acha o registro em aberto e abre outro. O defeito é da visita, cujo desfecho nunca chega ao registro (`outcomeAppliesToAula`, `src/lib/leads.js:246-247`). A regra nova vale para os dois tipos, como o #237 já fazia com a "aula depois do 'Não veio'": na aula, ela só fecha o registro que continua em aberto na data do agendamento, ou seja, quando o `applyOutcomeToAula` (best-effort) falhou.

6. **Uma regra pura, usada pelos dois lados.** O `src/lib/aulas.js` ganha três coisas. O `rescheduleRecordPlan` passa a aceitar `outcome`, `previousAt` e `finalAt`, os três opcionais, então a chamada da Meta continua igual. O `recordPlanFor(lead, { type, at, afterNoShow })` lê do lead o tipo (normalizado, porque lead antigo pode guardar "Visita"), o desfecho e o instante. O `recordMatchesAppointment(record, lead)` é a guarda da data que o `closeOpenAppointment` fazia com `millisOf`. O arquivo passa a importar `getLeadAppointmentType` e `getLeadAppointmentDate` de `./leads.js`. Não há ciclo (`leads.js` chega só a `dates.js`, `globalSearch.js` e `guardian.js`), e o `api/_zapSchedule.js` já importava `leads.js`, então o grafo da `api/` continua sem pacote. O navegador grava pelo `recordNewAppointment` (`src/lib/aulasWrites.js`): fecha pelo `closeOpenAppointment` e move ou abre pelos upserts de sempre, cada passo best-effort. A ponte decide pelo `scheduleRecordChanges` (`api/_zapSchedule.js`), com a mesma regra, e grava na transação.

7. **A ponte lê os registros do lead numa consulta só.** Hoje a visita lê `stronix_aulas` por `leadId` e a aula lê o documento do `currentAulaId`. Com a troca de tipo, a ponte precisa das duas coisas, e a consulta por `leadId` traz as duas: o registro do `currentAulaId` que pode ser fechado ou reaproveitado é sempre deste lead (`isOpenAulaRecord`). Registro de outro lead, registro sem `leadId` e id estragado no lead não aparecem na consulta e dão no mesmo que hoje: não são reaproveitados nem fechados, e a aula nasce num registro próprio. A leitura continua dentro da transação e antes de qualquer escrita. O `isDocId` sai do import de `api/zap.js` (continua exportado e usado no `readScheduleBody`), e o `pickOpenVisitaId` e o `isOpenAulaRecord` passam a ser usados dentro do `scheduleRecordChanges`, com os testes de sempre. O `buildScheduleWrites` recebe o `close` e devolve `closed`, a gravação do fechamento (`status` e `outcomeAt` com a hora do servidor, como o `closeOpenAppointment`).

8. **Registros antigos não são consertados.** As visitas com desfecho que o assistente ou a ponte já moveram continuam na data nova, sem o desfecho no mês original. Um script de acerto precisaria refazer a data e o status de cada registro pela linha do tempo, e fica fora deste PR.

9. **O Remarcar da Meta pelo "Feitos hoje" tem o mesmo defeito.** O botão "Remarcar agendamento" do `DoneCard` (`src/views/DailyGoalView.jsx:575-584`) abre o Remarcar sem o `afterNoShow` num lead que já tem desfecho. Hoje ele move o registro (o `CLAUDE.md` já registra isso) e, na troca de tipo depois de um "Compareceu", fecha como cancelada a visita que aconteceu. Com a regra nova, a correção é trocar uma chamada: o Remarcar passa a usar `recordPlanFor(lead, { type, at, afterNoShow })`. O pedido do Johnny foi o assistente e a ponte, então essa troca fica na Task 7, que só roda com o sim dele.

10. **O que não muda:** o `buildSchedulePatch` (continua zerando o desfecho do lead), o `hasSameAppointment`, o contrato da ponte (a resposta do `schedule` é a mesma), o "Cancelou" e o "Adiar para amanhã" da Meta (os dois apagam o agendamento do lead, e o registro em aberto continua sendo reaproveitado pelo agendamento seguinte, como hoje, sem desfecho a perder), as regras e os índices do Firestore.

## Pontos que dependem do Johnny

- **Task 7 (recomendado: sim).** O Remarcar do "Feitos hoje" passa a fechar o registro de quem já tem desfecho, como o assistente e a ponte. Sem ela, o painel continua perdendo o desfecho por esse caminho.
- **Desfecho marcado antes da hora (nota 4).** Com o mesmo tipo no mesmo horário, o registro continua em aberto e o desfecho precipitado não conta. Se o Johnny preferir contar sempre o que foi marcado, sai a condição do mesmo instante no `rescheduleRecordPlan`, e mudam dois testes da Task 1, um da Task 2, um da Task 4 e o teste da rota citado na nota 4.
- **Registros já movidos (nota 8):** ficam como estão, sem script.

## O que muda no Dashboard CRM

| Situação | Hoje | Com este PR |
|---|---|---|
| Visita de 28/09 com "Não veio" e outra visita marcada para outubro, pelo assistente ou pelo Stronizap | o registro vai para outubro: setembro perde a falta, outubro conta uma pendente | setembro conta a falta (o registro fecha como `no_show`), outubro conta a pendente (registro novo) |
| O mesmo com "Compareceu" | setembro perde o comparecimento | setembro conta o comparecimento |
| Visita com "Compareceu" e depois uma aula | a visita continua "agendada", e o painel acha o "Compareceu" pela linha do tempo | a visita fecha como compareceu |
| Visita em aberto, sem desfecho, trocada por aula | a visita continua "agendada" na data dela e conta como pendente para sempre | a visita fecha como cancelada e sai da conta |
| Visita sem desfecho remarcada | o registro muda de data | igual |
| Desfecho marcado antes da hora e a mesma visita pedida no mesmo horário | o registro continua em aberto | igual |

## Mapa de arquivos

| Arquivo | O que muda |
|---|---|
| `src/lib/aulas.js` | `rescheduleRecordPlan` com o desfecho e o instante; `recordPlanFor` e `recordMatchesAppointment` (novos) |
| `src/lib/aulasWrites.js` | `closeOpenAppointment` usa o `recordMatchesAppointment`; `recordNewAppointment` (novo) |
| `src/views/LeadProfileView.jsx` | o `handleWizardConfirm` grava o registro pelo `recordNewAppointment` |
| `api/_zapSchedule.js` | `scheduleRecordChanges` (novo); `buildScheduleWrites` com `close` e `closed` |
| `api/zap.js` | a transação do `schedule` lê os registros do lead por `leadId` e grava o fechamento |
| `src/views/DailyGoalView.jsx` | só na Task 7: o Remarcar lê a regra pelo lead |
| `src/lib/__tests__/aulas.test.js` | a regra com desfecho e instante, o `recordPlanFor` e a guarda da data |
| `src/lib/__tests__/aulasWrites.test.js` | o banco falso aplica as gravações; `recordNewAppointment` e o Dashboard CRM pelo caminho do assistente |
| `src/lib/__tests__/registroDoAgendamento.sweep.test.js` (novo) | o assistente (e, na Task 7, o Remarcar) grava pela regra única |
| `api/__tests__/zapSchedule.test.js` | `scheduleRecordChanges` e o `closed` do `buildScheduleWrites` |
| `api/__tests__/zapRoute.test.js` | remarcação com desfecho, troca de tipo e o Dashboard CRM pelo caminho da ponte |
| `CLAUDE.md` | a regra nova no lugar da limitação |

---

### Task 0: Preparação

**Files:** nenhum arquivo de código

- [ ] **Step 1: O worktree e o branch**

```bash
cd /Users/johnnybittencourt/STRONIX-FIRMA/06-sistemas/stronilead
git fetch origin
git worktree list | grep desfecho-fecha-registro
```

Expected: a linha `.../.claude/worktrees/desfecho-fecha-registro  c08cd44 [claude/desfecho-fecha-registro]`. Se ela não aparecer, crie o worktree a partir da main:

```bash
git worktree add -b claude/desfecho-fecha-registro .claude/worktrees/desfecho-fecha-registro origin/main
```

Depois:

```bash
cd /Users/johnnybittencourt/STRONIX-FIRMA/06-sistemas/stronilead/.claude/worktrees/desfecho-fecha-registro
git branch --show-current
git status --short
git merge --ff-only origin/main
```

Expected: `claude/desfecho-fecha-registro`, status limpo (ou só este plano em `docs/superpowers/plans/`) e "Already up to date.". Se a main andou, o merge avança e as linhas citadas podem mudar: procure pelo trecho.

- [ ] **Step 2: Commit do plano**

Se o plano já estiver em `docs/superpowers/plans/2026-09-30-desfecho-fecha-registro.md` e fora do git, faça o commit. Se o status vier limpo, pule.

```bash
git add docs/superpowers/plans/2026-09-30-desfecho-fecha-registro.md
git commit -m "docs: plano do desfecho que fecha o registro ao agendar de novo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Dependências e suíte de partida**

```bash
test -d node_modules || npm ci
npm test
```

Expected: em `c08cd44`, `Test Files  155 passed (155)` e `Tests  3551 passed (3551)`. Com a main mais nova, são mais. Este plano soma 1 arquivo e 50 testes (51 com a Task 7). Se a suíte falhar aqui, pare e reporte: a falha é anterior a este trabalho.

---

### Task 1: A regra pura (`src/lib/aulas.js`)

**Files:**
- Modify: `src/lib/aulas.js:3` (imports) e `src/lib/aulas.js:35-52` (`rescheduleRecordPlan`)
- Test: `src/lib/__tests__/aulas.test.js` (import da linha 2 e três blocos no fim)

- [ ] **Step 1: Escrever os testes**

Em `src/lib/__tests__/aulas.test.js`, trocar a linha 2:

```js
import { AULA_STATUS, isAulaRecord, outcomeToAulaStatus, pickConvertingAula, pickMirrorAppointment, aulaRecordFields, rescheduleRecordPlan } from '../aulas.js';
```

por:

```js
import {
  AULA_STATUS, isAulaRecord, outcomeToAulaStatus, pickConvertingAula, pickMirrorAppointment, aulaRecordFields, rescheduleRecordPlan,
  recordPlanFor, recordMatchesAppointment
} from '../aulas.js';
```

E acrescentar no fim do arquivo:

```js

// Agendar de novo depois de um desfecho: o registro do agendamento que teve
// "Compareceu" ou "Não veio" fecha com esse desfecho antes de o agendamento
// novo abrir outro. Sem isso, o registro da visita ia para a data nova, e o
// Dashboard CRM perdia a falta ou o comparecimento no mês original.
describe('rescheduleRecordPlan com o desfecho que o lead já tem', () => {
  const SET_28 = new Date(2026, 8, 28, 18, 0);
  const OUT_06 = new Date(2026, 9, 6, 18, 0);
  const plano = (extra) => rescheduleRecordPlan({
    previousType: 'visita', finalType: 'visita', previousAt: SET_28, finalAt: OUT_06, ...extra,
  });

  it('visita com "Não veio" e outra visita em outro dia: a que faltou fecha como falta', () => {
    expect(plano({ outcome: 'no_show' })).toEqual({ close: { type: 'visita', status: 'no_show' }, upsertVisita: true });
  });

  it('visita com "Compareceu" e outra visita em outro dia: a que aconteceu fecha como compareceu', () => {
    expect(plano({ outcome: 'attended' })).toEqual({ close: { type: 'visita', status: 'attended' }, upsertVisita: true });
  });

  it('o mesmo tipo no mesmo instante: o desfecho foi marcado antes da hora e o registro fica em aberto', () => {
    expect(plano({ outcome: 'no_show', finalAt: new Date(2026, 8, 28, 18, 0) })).toEqual({ close: null, upsertVisita: true });
    expect(plano({ outcome: 'attended', finalAt: { toDate: () => new Date(2026, 8, 28, 18, 0) } }))
      .toEqual({ close: null, upsertVisita: true });
  });

  it('outro tipo no mesmo instante não é o mesmo agendamento: fecha com o desfecho', () => {
    expect(plano({ outcome: 'no_show', finalType: 'aula_experimental', finalAt: SET_28 }))
      .toEqual({ close: { type: 'visita', status: 'no_show' }, upsertVisita: false });
  });

  it('na troca de tipo, o desfecho ganha do cancelado: a visita que aconteceu não vira cancelada', () => {
    expect(plano({ outcome: 'attended', finalType: 'aula_experimental' }))
      .toEqual({ close: { type: 'visita', status: 'attended' }, upsertVisita: false });
    expect(rescheduleRecordPlan({
      previousType: 'aula_experimental', finalType: 'visita', outcome: 'no_show', previousAt: SET_28, finalAt: OUT_06,
    })).toEqual({ close: { type: 'aula', status: 'no_show' }, upsertVisita: true });
  });

  it('o "Não veio" que a Meta acabou de gravar ganha do desfecho antigo do lead (a correção de "Compareceu" para "Não compareceu")', () => {
    expect(plano({ afterNoShow: true, outcome: 'attended' })).toEqual({ close: { type: 'visita', status: 'no_show' }, upsertVisita: true });
  });

  it('"Cancelou", "rescheduled" e sem desfecho não fecham pelo desfecho: vale a regra da troca de tipo', () => {
    for (const outcome of ['cancelled', 'rescheduled', null, undefined]) {
      expect(plano({ outcome })).toEqual({ close: null, upsertVisita: true });
      expect(plano({ outcome, finalType: 'aula_experimental' }))
        .toEqual({ close: { type: 'visita', status: 'cancelled' }, upsertVisita: false });
    }
  });

  it('sem agendamento anterior, nada fecha, com ou sem desfecho', () => {
    expect(plano({ previousType: null, outcome: 'no_show' })).toEqual({ close: null, upsertVisita: true });
  });
});

describe('recordPlanFor: a regra lida do lead', () => {
  const SET_28 = new Date(2026, 8, 28, 18, 0);
  const OUT_06 = new Date(2026, 9, 6, 18, 0);
  const lead = (extra = {}) => ({
    id: 'L1', appointmentType: 'visita', appointmentScheduledFor: { toDate: () => SET_28 }, appointmentOutcome: 'no_show', ...extra,
  });

  it('usa o tipo, o desfecho e o instante do agendamento do lead, com a data como o Firestore devolve', () => {
    expect(recordPlanFor(lead(), { type: 'visita', at: OUT_06 }))
      .toEqual({ close: { type: 'visita', status: 'no_show' }, upsertVisita: true });
    expect(recordPlanFor(lead(), { type: 'visita', at: SET_28 })).toEqual({ close: null, upsertVisita: true });
  });

  it('lead antigo com "Visita" no tipo e a data só no próximo contato também entra na regra', () => {
    const antigo = { id: 'L2', appointmentType: 'Visita', nextFollowUp: SET_28, appointmentOutcome: 'attended' };
    expect(recordPlanFor(antigo, { type: 'visita', at: OUT_06 }))
      .toEqual({ close: { type: 'visita', status: 'attended' }, upsertVisita: true });
  });

  it('repassa o afterNoShow do Remarcar', () => {
    expect(recordPlanFor(lead({ appointmentOutcome: null }), { type: 'visita', at: SET_28, afterNoShow: true }))
      .toEqual({ close: { type: 'visita', status: 'no_show' }, upsertVisita: true });
  });

  it('lead sem agendamento não fecha nada', () => {
    expect(recordPlanFor({ id: 'L3' }, { type: 'aula_experimental', at: OUT_06 })).toEqual({ close: null, upsertVisita: false });
  });
});

describe('recordMatchesAppointment: a guarda da data', () => {
  const SET_28 = new Date(2026, 8, 28, 18, 0);

  it('registro da mesma data do agendamento do lead vale, com Date ou Timestamp dos dois lados', () => {
    expect(recordMatchesAppointment({ scheduledFor: SET_28 }, { appointmentScheduledFor: { toDate: () => new Date(SET_28) } })).toBe(true);
  });

  it('registro de outra data não vale: pode ser histórico antigo', () => {
    expect(recordMatchesAppointment({ scheduledFor: new Date(2026, 8, 20, 18, 0) }, { appointmentScheduledFor: SET_28 })).toBe(false);
  });

  it('sem uma das duas datas não há o que comparar, e vale', () => {
    expect(recordMatchesAppointment({ scheduledFor: null }, { appointmentScheduledFor: SET_28 })).toBe(true);
    expect(recordMatchesAppointment({ scheduledFor: SET_28 }, {})).toBe(true);
    expect(recordMatchesAppointment(null, null)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/aulas.test.js`
Expected: FAIL, `Tests  11 failed | 39 passed (50)`. As falhas são `TypeError: recordPlanFor is not a function`, `TypeError: recordMatchesAppointment is not a function` e os casos de desfecho do `rescheduleRecordPlan` recebendo `close: null`. Os quatro testes novos que passam (mesmo instante, `afterNoShow`, "Cancelou" e sem agendamento anterior) travam a ordem da regra e já valem hoje.

- [ ] **Step 3: Implementar**

Em `src/lib/aulas.js`, trocar a linha 3:

```js
import { getSafeDateOrNull } from './dates.js';
```

por:

```js
import { getSafeDateOrNull, normalizeAppointmentType } from './dates.js';
import { getLeadAppointmentType, getLeadAppointmentDate } from './leads.js';
```

E trocar o bloco das linhas 35 a 52:

```js
// O que o Remarcar da Meta Diária faz em stronix_aulas para o registro seguir
// o agendamento do lead, como o assistente da ficha já faz. Até 2026-09-29 só
// a aula acompanhava, e a visita remarcada ficava com a data velha no
// registro: o Dashboard CRM a contava no dia antigo e perdia o comparecimento.
//   close: o registro em aberto do tipo anterior a fechar, ou null.
//     - depois do "Não veio", fecha como falta: o desfecho da visita não é
//       gravado no registro, e mover o registro apagaria a falta do painel;
//     - na troca de tipo, fecha como cancelado: aquele agendamento não
//       acontece mais.
//   upsertVisita: a visita do tipo novo move o registro aberto ou cria um.
//     A aula continua com o upsertScheduledAula de sempre.
export function rescheduleRecordPlan({ previousType, finalType, afterNoShow }) {
  const previous = recordTypeOf(previousType);
  let close = null;
  if (previous && afterNoShow) close = { type: previous, status: AULA_STATUS.NO_SHOW };
  else if (previous && previousType !== finalType) close = { type: previous, status: AULA_STATUS.CANCELLED };
  return { close, upsertVisita: finalType === 'visita' };
}
```

por:

```js
// Desfecho do lead que fecha o registro: só "Compareceu" e "Não veio". O
// "Cancelou" apaga o agendamento do lead, e "rescheduled" é dado antigo, sem
// desfecho.
const closingStatusOf = (outcome) =>
  (outcome === 'attended' || outcome === 'no_show' ? outcomeToAulaStatus(outcome) : null);

const sameInstant = (a, b) => {
  const x = getSafeDateOrNull(a);
  const y = getSafeDateOrNull(b);
  return Boolean(x && y) && x.getTime() === y.getTime();
};

// O que um agendamento novo faz em stronix_aulas para o registro seguir o
// agendamento do lead. Vale para o Remarcar da Meta Diária, o assistente da
// ficha e o agendamento pelo Stronizap. O desfecho da visita não é gravado no
// registro quando é marcado: mover o registro de uma visita com desfecho para
// a data nova apagaria a falta ou o comparecimento do Dashboard CRM no mês
// original.
//   close: o registro em aberto do tipo anterior a fechar, ou null.
//     - depois do "Não veio" (afterNoShow, o Remarcar que a Meta abre logo em
//       seguida), fecha como falta;
//     - com o desfecho que o lead já tem ("Compareceu" ou "Não veio"), fecha
//       com esse desfecho, a não ser que o agendamento novo seja o mesmo (mesmo
//       tipo e mesmo instante): aí o desfecho foi marcado antes da hora, o
//       agendamento continua e o registro fica em aberto;
//     - na troca de tipo sem desfecho, fecha como cancelado: aquele
//       agendamento não acontece mais.
//   upsertVisita: a visita do tipo novo move o registro aberto ou cria um.
//     A aula continua com o upsertScheduledAula de sempre.
export function rescheduleRecordPlan({
  previousType, finalType, afterNoShow = false, outcome = null, previousAt = null, finalAt = null,
}) {
  const previous = recordTypeOf(previousType);
  const outcomeStatus = closingStatusOf(outcome);
  const sameAppointment = previousType === finalType && sameInstant(previousAt, finalAt);
  let close = null;
  if (previous && afterNoShow) close = { type: previous, status: AULA_STATUS.NO_SHOW };
  else if (previous && outcomeStatus && !sameAppointment) close = { type: previous, status: outcomeStatus };
  else if (previous && previousType !== finalType) close = { type: previous, status: AULA_STATUS.CANCELLED };
  return { close, upsertVisita: finalType === 'visita' };
}

// A regra acima para um lead: o tipo, o desfecho e o instante do agendamento
// que ele tem hoje contra o agendamento novo. É a entrada do assistente da
// ficha (recordNewAppointment, em aulasWrites.js) e do Stronizap
// (scheduleRecordChanges, em api/_zapSchedule.js). Os tipos passam por
// normalizeAppointmentType porque lead antigo pode guardar "Visita".
export function recordPlanFor(lead, { type, at, afterNoShow = false }) {
  return rescheduleRecordPlan({
    previousType: normalizeAppointmentType(getLeadAppointmentType(lead)),
    finalType: normalizeAppointmentType(type),
    afterNoShow,
    outcome: lead?.appointmentOutcome ?? null,
    previousAt: getLeadAppointmentDate(lead),
    finalAt: at,
  });
}

// O registro em aberto é o do agendamento que o lead tem hoje: a guarda do
// applyOutcomeToAula e do closeOpenAppointment. Registro com data diferente da
// do agendamento do lead pode ser histórico antigo e não é fechado. Sem uma
// das duas datas não há o que comparar, e vale.
export function recordMatchesAppointment(record, lead) {
  const registro = getSafeDateOrNull(record?.scheduledFor);
  const compromisso = getSafeDateOrNull(lead?.appointmentScheduledFor);
  return !registro || !compromisso || registro.getTime() === compromisso.getTime();
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/aulas.test.js src/lib/__tests__/newLeadImports.test.js src/lib/__tests__/guardianImports.test.js`
Expected: PASS, com `src/lib/__tests__/aulas.test.js (50 tests)`. As duas varreduras de import continuam verdes: o `aulas.js` agora chega a `leads.js`, que o `api/_zapSchedule.js` já alcançava.

- [ ] **Step 5: Commit**

```bash
git add src/lib/aulas.js src/lib/__tests__/aulas.test.js
git commit -m "feat: regra do registro do agendamento lê o desfecho e o instante do lead

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: O registro do agendamento novo no navegador (`src/lib/aulasWrites.js`)

**Files:**
- Modify: `src/lib/aulasWrites.js:5` (import) e `src/lib/aulasWrites.js:66-76` (a guarda do `closeOpenAppointment`, com o `recordNewAppointment` novo logo depois dele)
- Test: `src/lib/__tests__/aulasWrites.test.js` (cabeçalho, banco falso, `beforeEach` e um bloco no fim)

- [ ] **Step 1: Escrever os testes**

Em `src/lib/__tests__/aulasWrites.test.js`, o banco falso passa a aplicar as gravações no Map, para o teste do painel ler os registros como ficaram, e aprende a recusar a gravação. Trocar as linhas 1 a 7:

```js
// Gravação no histórico de aulas (stronix_aulas) usada pelo Remarcar da Meta
// Diária. Sem Firebase de verdade: firebase/firestore e ../firebase.js são
// falsos, e os registros vivem num Map em memória.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ docs: new Map(), updates: [], adds: [] }));
```

por:

```js
// Gravação no histórico de aulas (stronix_aulas) usada pelo Remarcar da Meta
// Diária e pelo assistente de agendamento da ficha. Sem Firebase de verdade:
// firebase/firestore e ../firebase.js são falsos, e os registros vivem num Map
// em memória. As gravações ficam anotadas em `updates` e `adds` e também valem
// no Map, para o teste do Dashboard CRM ler os registros como ficaram.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appointmentsOf } from '../crm/appointments.js';
import { buildSchedulePatch } from '../schedulePatch.js';

const m = vi.hoisted(() => ({ docs: new Map(), updates: [], adds: [], recusar: false }));
```

Trocar:

```js
  updateDoc: async (ref, patch) => { m.updates.push({ id: ref.id, patch }); },
  addDoc: async (_col, data) => { m.adds.push(data); return { id: 'novo' }; },
  serverTimestamp: () => 'TS',
}));

const { upsertScheduledAppointment, closeOpenAppointment } = await import('../aulasWrites.js');
```

por:

```js
  updateDoc: async (ref, patch) => {
    if (m.recusar) throw new Error('permission-denied');
    m.updates.push({ id: ref.id, patch });
    m.docs.set(ref.id, { ...m.docs.get(ref.id), ...patch });
  },
  addDoc: async (_col, data) => {
    if (m.recusar) throw new Error('permission-denied');
    m.adds.push(data);
    const id = m.adds.length === 1 ? 'novo' : `novo-${m.adds.length}`;
    m.docs.set(id, data);
    return { id };
  },
  serverTimestamp: () => 'TS',
}));

const { upsertScheduledAppointment, closeOpenAppointment, recordNewAppointment } = await import('../aulasWrites.js');
```

Trocar:

```js
beforeEach(() => {
  m.docs.clear();
  m.updates.length = 0;
  m.adds.length = 0;
});
```

por:

```js
beforeEach(() => {
  m.docs.clear();
  m.updates.length = 0;
  m.adds.length = 0;
  m.recusar = false;
});
```

E acrescentar no fim do arquivo:

```js

// O assistente de agendamento da ficha (handleWizardConfirm) grava o registro
// por aqui, na regra do Remarcar da Meta Diária (recordPlanFor, em aulas.js).
describe('recordNewAppointment: o registro do agendamento novo do assistente', () => {
  // Setembro e outubro no horário local, como o Dashboard CRM conta.
  const SET_28 = new Date(2026, 8, 28, 18, 0);
  const OUT_06 = new Date(2026, 9, 6, 18, 0);
  const comVisita = (extra = {}) => ({
    ...lead, appointmentType: 'visita', appointmentScheduledFor: SET_28, appointmentUnit: 'Centro', ...extra,
  });
  const visita = (extra = {}) => ({ type: 'visita', leadId: 'lead-1', status: 'agendada', unit: 'Centro', scheduledFor: SET_28, ...extra });
  const novaVisita = { unit: 'Centro', scheduledFor: OUT_06 };
  const novaAula = { professorId: 'p1', professorName: 'Carla Dias', soloTraining: false, modality: 'Pilates', scheduledFor: OUT_06 };

  it('visita com "Não veio" e outra visita em outro dia: a que faltou fecha como falta, e a data nova abre outro registro', async () => {
    m.docs.set('v1', visita());

    const aulaId = await recordNewAppointment({ db: {}, lead: comVisita({ appointmentOutcome: 'no_show' }), appointmentType: 'visita', fields: novaVisita });

    expect(m.updates).toEqual([{ id: 'v1', patch: { status: 'no_show', outcomeAt: 'TS' } }]);
    expect(m.adds).toHaveLength(1);
    expect(m.adds[0]).toMatchObject({ type: 'visita', leadId: 'lead-1', status: 'agendada', unit: 'Centro', scheduledFor: OUT_06 });
    expect(m.docs.get('v1')).toMatchObject({ status: 'no_show', scheduledFor: SET_28 });
    // A visita não mexe no ponteiro da aula.
    expect(aulaId).toBe('a1');
  });

  it('visita com "Compareceu" e outra visita: a que aconteceu fecha como compareceu', async () => {
    m.docs.set('v1', visita());

    await recordNewAppointment({ db: {}, lead: comVisita({ appointmentOutcome: 'attended' }), appointmentType: 'visita', fields: novaVisita });

    expect(m.docs.get('v1')).toMatchObject({ status: 'attended', scheduledFor: SET_28 });
    expect(m.adds).toHaveLength(1);
  });

  it('visita sem desfecho remarcada: o registro em aberto só muda de data, como antes', async () => {
    m.docs.set('v1', visita());

    await recordNewAppointment({ db: {}, lead: comVisita(), appointmentType: 'visita', fields: novaVisita });

    expect(m.updates).toEqual([{ id: 'v1', patch: { unit: 'Centro', scheduledFor: OUT_06 } }]);
    expect(m.adds).toEqual([]);
  });

  it('o mesmo horário com o desfecho marcado antes da hora: o registro continua em aberto e é o mesmo', async () => {
    m.docs.set('v1', visita());

    await recordNewAppointment({
      db: {}, lead: comVisita({ appointmentOutcome: 'no_show' }), appointmentType: 'visita', fields: { unit: 'Centro', scheduledFor: new Date(SET_28) },
    });

    expect(m.docs.get('v1')).toMatchObject({ status: 'agendada' });
    expect(m.adds).toEqual([]);
  });

  it('visita trocada por aula: a visita fecha como cancelada, e o lead passa a apontar para a aula nova', async () => {
    m.docs.set('v1', visita());

    const aulaId = await recordNewAppointment({ db: {}, lead: comVisita({ currentAulaId: null }), appointmentType: 'aula_experimental', fields: novaAula });

    expect(m.docs.get('v1')).toMatchObject({ status: 'cancelled' });
    expect(aulaId).toBe('novo');
    expect(m.docs.get('novo')).toMatchObject({ type: 'aula', status: 'agendada', professorId: 'p1', modality: 'Pilates', scheduledFor: OUT_06 });
  });

  it('visita com "Compareceu" trocada por aula: a visita fecha como compareceu, e não como cancelada', async () => {
    m.docs.set('v1', visita());

    await recordNewAppointment({
      db: {}, lead: comVisita({ appointmentOutcome: 'attended', currentAulaId: null }), appointmentType: 'aula_experimental', fields: novaAula,
    });

    expect(m.docs.get('v1')).toMatchObject({ status: 'attended' });
  });

  it('aula trocada por visita: a aula do currentAulaId fecha como cancelada, e o ponteiro continua o do lead', async () => {
    m.docs.set('a1', { type: 'aula', leadId: 'lead-1', status: 'agendada', scheduledFor: SET_28 });
    const comAula = { ...lead, appointmentType: 'aula_experimental', appointmentScheduledFor: SET_28 };

    const aulaId = await recordNewAppointment({ db: {}, lead: comAula, appointmentType: 'visita', fields: novaVisita });

    expect(m.docs.get('a1')).toMatchObject({ status: 'cancelled' });
    expect(m.adds[0]).toMatchObject({ type: 'visita', scheduledFor: OUT_06 });
    expect(aulaId).toBe('a1');
  });

  it('aula com "Não veio" que não chegou ao registro: fecha como falta, e a aula nova nasce noutro registro', async () => {
    m.docs.set('a1', { type: 'aula', leadId: 'lead-1', status: 'agendada', scheduledFor: SET_28 });
    const comAula = { ...lead, appointmentType: 'aula_experimental', appointmentScheduledFor: SET_28, appointmentOutcome: 'no_show' };

    const aulaId = await recordNewAppointment({ db: {}, lead: comAula, appointmentType: 'aula_experimental', fields: novaAula });

    expect(m.docs.get('a1')).toMatchObject({ status: 'no_show', scheduledFor: SET_28 });
    expect(aulaId).toBe('novo');
  });

  it('mensagem e ligação não mexem em registro', async () => {
    m.docs.set('v1', visita());

    expect(await recordNewAppointment({ db: {}, lead: comVisita({ appointmentOutcome: 'no_show' }), appointmentType: null, fields: { scheduledFor: OUT_06 } }))
      .toBe('a1');
    expect(m.updates).toEqual([]);
    expect(m.adds).toEqual([]);
  });

  it('gravação recusada não derruba o agendamento: cada falha vai para o console e o ponteiro da aula fica o do lead', async () => {
    m.docs.set('v1', visita());
    m.recusar = true;
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(recordNewAppointment({
      db: {}, lead: comVisita({ appointmentOutcome: 'no_show' }), appointmentType: 'aula_experimental', fields: novaAula,
    })).resolves.toBe('a1');
    expect(erro.mock.calls.map(([texto]) => texto)).toEqual(['closeOpenAppointment falhou', 'upsertScheduledAula falhou']);
    erro.mockRestore();
  });

  // O que o Johnny pediu: agendar de novo depois de um desfecho não apaga o
  // desfecho do painel. O lead depois do assistente é o do buildSchedulePatch,
  // e os registros chegam ao painel como o useCrmSources entrega.
  it.each([
    ['a falta', 'no_show', { missed: 1, came: 0 }],
    ['o comparecimento', 'attended', { missed: 0, came: 1 }]
  ])('Dashboard CRM: %s de setembro continua em setembro depois de agendar de novo em outubro', async (_, appointmentOutcome, setembro) => {
    m.docs.set('v1', visita());
    const antes = comVisita({ appointmentOutcome });

    const currentAulaId = await recordNewAppointment({ db: {}, lead: antes, appointmentType: 'visita', fields: novaVisita });
    const depois = { ...antes, ...buildSchedulePatch({ typeLabel: 'Visita', date: OUT_06, unidade: 'Centro', currentAulaId }) };

    const registros = [...m.docs.entries()].map(([id, d]) => ({ id, ...d }));
    const noMes = (start, end) => appointmentsOf(registros, { start, end, leadOf: () => depois, inScope: () => true });
    expect(noMes(new Date(2026, 8, 1), new Date(2026, 9, 1))).toMatchObject({ total: 1, pending: 0, ...setembro });
    expect(noMes(new Date(2026, 9, 1), new Date(2026, 10, 1))).toMatchObject({ total: 1, missed: 0, came: 0, pending: 1 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/aulasWrites.test.js`
Expected: FAIL, `Tests  12 failed | 7 passed (19)`, com `TypeError: recordNewAppointment is not a function`. Os 7 testes de antes passam com o banco falso novo.

- [ ] **Step 3: Implementar**

Em `src/lib/aulasWrites.js`, trocar a linha 5:

```js
import { AULA_STATUS, APPOINTMENT_RECORD_TYPES, isAulaRecord, outcomeToAulaStatus, pickConvertingAula, aulaRecordFields } from './aulas.js';
```

por:

```js
import {
  AULA_STATUS, APPOINTMENT_RECORD_TYPES, isAulaRecord, outcomeToAulaStatus, pickConvertingAula, aulaRecordFields,
  recordPlanFor, recordMatchesAppointment
} from './aulas.js';
```

No `closeOpenAppointment`, trocar:

```js
  const snap = await getDoc(aulaDoc(db, openId));
  const registroMs = millisOf(snap.exists() ? snap.data().scheduledFor : null);
  const compromissoMs = millisOf(lead.appointmentScheduledFor);
  if (registroMs !== null && compromissoMs !== null && registroMs !== compromissoMs) {
    console.warn('closeOpenAppointment: registro aberto de outra data; não fechado', { leadId: lead.id, aulaId: openId });
    return null;
  }

  await updateDoc(aulaDoc(db, openId), { status, outcomeAt: serverTimestamp() });
  return openId;
}
```

por (o `millisOf` continua no arquivo, porque o `applyOutcomeToAula` usa):

```js
  const snap = await getDoc(aulaDoc(db, openId));
  if (!recordMatchesAppointment(snap.exists() ? snap.data() : null, lead)) {
    console.warn('closeOpenAppointment: registro aberto de outra data; não fechado', { leadId: lead.id, aulaId: openId });
    return null;
  }

  await updateDoc(aulaDoc(db, openId), { status, outcomeAt: serverTimestamp() });
  return openId;
}

// O registro em stronix_aulas de um agendamento novo de visita ou aula pelo
// assistente da ficha (handleWizardConfirm), na regra do Remarcar da Meta
// Diária (recordPlanFor, em aulas.js): primeiro fecha o registro do agendamento
// que o lead tinha, quando ele não vai mais acontecer (com o desfecho que o
// lead tem, ou cancelado na troca de tipo), e depois move o registro em aberto
// do tipo novo ou abre um. A ponte com o Stronizap faz o mesmo numa transação
// (scheduleRecordChanges, em api/_zapSchedule.js): mudou aqui, mude lá.
// Best-effort como todo o dual-write: o passo que falha vai para o console e
// não derruba o agendamento do lead. Mensagem e ligação não têm registro.
// Devolve o currentAulaId que o lead passa a guardar: o registro da aula
// agendada, ou o que ele já tinha.
export async function recordNewAppointment({ db, lead, appointmentType, fields }) {
  const kept = lead.currentAulaId || null;
  if (appointmentType !== 'visita' && appointmentType !== 'aula_experimental') return kept;

  const plan = recordPlanFor(lead, { type: appointmentType, at: fields.scheduledFor });
  if (plan.close) {
    try {
      await closeOpenAppointment({ db, lead, ...plan.close });
    } catch (e) {
      console.error('closeOpenAppointment falhou', e);
    }
  }

  if (plan.upsertVisita) {
    try {
      await upsertScheduledAppointment({ db, lead, type: APPOINTMENT_RECORD_TYPES.VISITA, fields });
    } catch (e) {
      console.error('upsertScheduledAppointment (visita) falhou', e);
    }
    return kept;
  }
  try {
    return await upsertScheduledAula({ db, lead, fields });
  } catch (e) {
    console.error('upsertScheduledAula falhou', e);
    return kept;
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/aulasWrites.test.js src/lib/__tests__/crm.appointments.test.js`
Expected: PASS, com `src/lib/__tests__/aulasWrites.test.js (19 tests)`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/aulasWrites.js src/lib/__tests__/aulasWrites.test.js
git commit -m "feat: recordNewAppointment fecha o registro do agendamento com desfecho antes de abrir outro

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: O assistente da ficha grava pela regra (`src/views/LeadProfileView.jsx`)

**Files:**
- Create: `src/lib/__tests__/registroDoAgendamento.sweep.test.js`
- Modify: `src/views/LeadProfileView.jsx:24` (import) e `src/views/LeadProfileView.jsx:538-573` (o dual-write do `handleWizardConfirm`)

O `handleWizardConfirm` vive dentro da view e não roda em teste de node. A regra dele já está coberta pela Task 2; a varredura trava que ele continue passando pelo `recordNewAppointment`.

- [ ] **Step 1: Escrever a varredura**

Criar `src/lib/__tests__/registroDoAgendamento.sweep.test.js`:

```js
// Quem agenda visita ou aula grava o registro em stronix_aulas pela regra
// única de src/lib/aulas.js (recordPlanFor). Sem ela, agendar de novo depois de
// um "Compareceu" ou de um "Não veio" move o registro para a data nova, e o
// Dashboard CRM perde o desfecho no mês original. Esta varredura lê o código e
// reprova quem voltar a gravar o registro por conta própria.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ler = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

// O corpo de um handler `const nome = async (...) => { ... };` da view, até a
// primeira linha que só fecha a função com dois espaços de recuo.
function corpoDe(fonte, nome) {
  const inicio = fonte.indexOf(`const ${nome} = async`);
  expect(inicio, nome).toBeGreaterThan(-1);
  return fonte.slice(inicio, fonte.indexOf('\n  };\n', inicio));
}

describe('o registro do agendamento passa pela regra única', () => {
  it('o assistente da ficha grava pelo recordNewAppointment, e não chama os upserts direto', () => {
    const corpo = corpoDe(ler('../../views/LeadProfileView.jsx'), 'handleWizardConfirm');
    expect(corpo).toContain('recordNewAppointment({');
    expect(corpo).not.toMatch(/upsertScheduledAula|upsertScheduledAppointment|closeOpenAppointment/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/registroDoAgendamento.sweep.test.js`
Expected: FAIL, `Tests  1 failed (1)`, com `expected '...' to contain 'recordNewAppointment({'`.

- [ ] **Step 3: Implementar**

Em `src/views/LeadProfileView.jsx`, trocar a linha 24:

```js
import { upsertScheduledAula, upsertScheduledAppointment, markConvertingAula } from '../lib/aulasWrites.js';
```

por:

```js
import { recordNewAppointment, markConvertingAula } from '../lib/aulasWrites.js';
```

E, no `handleWizardConfirm`, trocar as linhas 538 a 573:

```js
      // Dual-write best-effort no histórico de aulas (stronix_aulas): a regra
      // do Firestore pode ainda não estar publicada, então falha aqui NÃO
      // pode quebrar o agendamento do lead — por isso o try/catch isolado.
      let currentAulaId = lead.currentAulaId || null;
      if (isAula) {
        try {
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
        } catch (e) {
          console.error('upsertScheduledAula falhou', e);
        }
      }

      // Dual-write da VISITA, espelhando o da aula acima. O lead ainda não
      // guarda ponteiro de visita, então o registro em aberto é achado por
      // leadId. Best-effort pelo mesmo motivo: falha aqui não pode derrubar o
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

por:

```js
      // Dual-write best-effort no histórico de aulas (stronix_aulas), na regra
      // do Remarcar da Meta Diária (recordNewAppointment, em
      // lib/aulasWrites.js): o registro do agendamento que o lead tinha fecha
      // quando ele não vai mais acontecer (com o "Compareceu" ou o "Não veio"
      // que o lead tem, ou cancelado na troca de tipo), e o do tipo novo muda
      // de data ou nasce. Falha ali não derruba o agendamento do lead.
      // Mensagem e ligação não têm registro.
      const currentAulaId = await recordNewAppointment({
        db, lead, appointmentType,
        fields: isAula
          ? {
              professorId: professorId || null,
              professorName: professorId ? professorNameById(professores, professorId) : null,
              soloTraining: Boolean(soloTraining),
              modality: modalidade || null,
              scheduledFor: date,
            }
          : { unit: unidade || null, scheduledFor: date },
      });
```

O `isVisita` continua em uso no texto da interação (`else if (isVisita && unidade)`), e o `currentAulaId` segue para o `buildSchedulePatch` como antes.

- [ ] **Step 4: Rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/registroDoAgendamento.sweep.test.js src/lib/__tests__/profile src/lib/__tests__/leadProfileRoute.test.js
npx eslint src/views/LeadProfileView.jsx
```

Expected: tudo verde (a varredura com 1 teste, e os testes que desenham a ficha continuam passando); o eslint sem erro.

- [ ] **Step 5: Commit**

```bash
git add src/views/LeadProfileView.jsx src/lib/__tests__/registroDoAgendamento.sweep.test.js
git commit -m "fix: agendar de novo pela ficha não apaga o desfecho do Dashboard CRM

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: A ponte, regras puras (`api/_zapSchedule.js`)

**Files:**
- Modify: `api/_zapSchedule.js:8` (comentário do topo), `:30` (import), bloco novo depois do `isOpenAulaRecord` (linha 459) e `buildScheduleWrites` (`:461-538`)
- Test: `api/__tests__/zapSchedule.test.js` (a linha 18 do import, um bloco antes do `describe('buildScheduleWrites...` da linha 855 e um teste depois do de "visita remarcada", linha 921)

- [ ] **Step 1: Escrever os testes**

Em `api/__tests__/zapSchedule.test.js`, trocar a linha 18:

```js
  scheduleInteractionText, pickOpenVisitaId, isOpenAulaRecord, buildScheduleWrites, alreadyScheduledBody
```

por:

```js
  scheduleInteractionText, pickOpenVisitaId, isOpenAulaRecord, scheduleRecordChanges, buildScheduleWrites, alreadyScheduledBody
```

Logo antes da linha `describe('buildScheduleWrites: o que o assistente grava, numa gravação só', () => {`, acrescentar:

```js
// Agendar de novo depois de um desfecho: o registro do agendamento que teve
// "Compareceu" ou "Não veio" fecha com esse desfecho antes de o agendamento
// novo abrir outro, como no assistente da ficha (recordNewAppointment). Os
// registros chegam como a consulta por leadId devolve, com a data em Timestamp.
describe('scheduleRecordChanges: o registro que fecha e o que é reaproveitado', () => {
  const ts = (d) => ({ toDate: () => d });
  // A visita da Mariana na segunda, 28/09, às 18:00, e a data nova, quinta, 01/10, às 18:00.
  const SEG = brt('2026-09-28T18:00');
  const QUI = brt('2026-10-01T18:00');
  const lead = (extra = {}) => ({
    id: 'L1', appointmentType: 'visita', appointmentScheduledFor: SEG, appointmentUnit: 'Centro', currentAulaId: null, ...extra
  });
  const visita = (id, extra = {}) => ({ id, type: 'visita', leadId: 'L1', status: 'agendada', scheduledFor: ts(SEG), ...extra });
  const aula = (id, extra = {}) => ({ id, type: 'aula', leadId: 'L1', status: 'agendada', scheduledFor: ts(SEG), ...extra });
  const VISITA = { type: 'visita' };
  const AULA = { type: 'aula_experimental' };
  const mudancas = (l, schedule, records, at = QUI) => scheduleRecordChanges({ lead: l, schedule, at, records });

  it('visita sem desfecho remarcada: nada fecha, e o registro em aberto é reaproveitado', () => {
    expect(mudancas(lead(), VISITA, [visita('v1')])).toEqual({ close: null, openRecordId: 'v1' });
  });

  it.each([
    ['"Não veio"', 'no_show'],
    ['"Compareceu"', 'attended']
  ])('visita com %s e outra visita em outro dia: o registro fecha com o desfecho, e nasce outro', (_, appointmentOutcome) => {
    expect(mudancas(lead({ appointmentOutcome }), VISITA, [visita('v1')]))
      .toEqual({ close: { id: 'v1', status: appointmentOutcome }, openRecordId: null });
  });

  it('o mesmo instante com o desfecho marcado antes da hora: nada fecha, e o registro continua o mesmo', () => {
    expect(mudancas(lead({ appointmentOutcome: 'no_show' }), VISITA, [visita('v1')], SEG)).toEqual({ close: null, openRecordId: 'v1' });
  });

  it('visita trocada por aula: a visita fecha como cancelada, e a aula aberta do currentAulaId é reaproveitada', () => {
    expect(mudancas(lead({ currentAulaId: 'a1' }), AULA, [visita('v1'), aula('a1', { scheduledFor: ts(brt('2026-09-20T10:00')) })]))
      .toEqual({ close: { id: 'v1', status: 'cancelled' }, openRecordId: 'a1' });
  });

  it('visita com "Compareceu" trocada por aula: fecha como compareceu, e não como cancelada', () => {
    expect(mudancas(lead({ appointmentOutcome: 'attended' }), AULA, [visita('v1')]))
      .toEqual({ close: { id: 'v1', status: 'attended' }, openRecordId: null });
  });

  it('aula trocada por visita: a aula do currentAulaId fecha como cancelada, e a visita em aberto é reaproveitada', () => {
    const comAula = lead({ appointmentType: 'aula_experimental', currentAulaId: 'a1' });
    expect(mudancas(comAula, VISITA, [aula('a1'), visita('v0', { scheduledFor: ts(brt('2026-09-10T18:00')) })]))
      .toEqual({ close: { id: 'a1', status: 'cancelled' }, openRecordId: 'v0' });
  });

  it('aula com "Não veio" que não chegou ao registro fecha como falta; a que já fechou fica como está', () => {
    const comAula = lead({ appointmentType: 'aula_experimental', currentAulaId: 'a1', appointmentOutcome: 'no_show' });
    expect(mudancas(comAula, AULA, [aula('a1')])).toEqual({ close: { id: 'a1', status: 'no_show' }, openRecordId: null });
    expect(mudancas(comAula, AULA, [aula('a1', { status: 'no_show' })])).toEqual({ close: null, openRecordId: null });
  });

  it('registro em aberto de outra data não fecha, como no closeOpenAppointment, e continua sendo o reaproveitado', () => {
    const antigo = visita('v1', { scheduledFor: ts(brt('2026-09-20T18:00')) });
    expect(mudancas(lead({ appointmentOutcome: 'no_show' }), VISITA, [antigo])).toEqual({ close: null, openRecordId: 'v1' });
  });

  it('duas visitas em aberto: fecha a do agendamento e reaproveita a outra, como o assistente, que fecha antes de procurar', () => {
    const outra = visita('v2', { scheduledFor: ts(brt('2026-09-10T18:00')) });
    expect(mudancas(lead({ appointmentOutcome: 'no_show' }), VISITA, [visita('v1'), outra]))
      .toEqual({ close: { id: 'v1', status: 'no_show' }, openRecordId: 'v2' });
  });

  it('o registro de outro lead no currentAulaId não fecha nem é reaproveitado', () => {
    const comAula = lead({ appointmentType: 'aula_experimental', currentAulaId: 'a9', appointmentOutcome: 'no_show' });
    expect(mudancas(comAula, AULA, [aula('a9', { leadId: 'L9' })])).toEqual({ close: null, openRecordId: null });
  });

  it('lead sem agendamento, ou com o agendamento cancelado, não fecha nada', () => {
    expect(mudancas({ id: 'L1' }, VISITA, [visita('v1')])).toEqual({ close: null, openRecordId: 'v1' });
    const cancelado = lead({ appointmentType: null, appointmentScheduledFor: null, appointmentOutcome: 'cancelled' });
    expect(mudancas(cancelado, VISITA, [visita('v1')])).toEqual({ close: null, openRecordId: 'v1' });
  });

  it('lead antigo com "Visita" no tipo também fecha', () => {
    expect(mudancas(lead({ appointmentType: 'Visita', appointmentOutcome: 'no_show' }), VISITA, [visita('v1')]))
      .toEqual({ close: { id: 'v1', status: 'no_show' }, openRecordId: null });
  });

  it('sem registros, nada fecha e nada é reaproveitado', () => {
    expect(mudancas(lead({ appointmentOutcome: 'no_show' }), VISITA, [])).toEqual({ close: null, openRecordId: null });
    expect(mudancas(lead({ appointmentOutcome: 'no_show' }), VISITA, undefined)).toEqual({ close: null, openRecordId: null });
  });
});

```

E, dentro do `describe('buildScheduleWrites...`, logo depois do teste que termina assim:

```js
  it('visita remarcada: o registro em aberto só troca a unidade e a data', () => {
    const { record } = gravar({ schedule: VISITA, at: atVisita, openRecordId: 'visita-aberta', newRecordId: 'rec-novo' });
    expect(record).toEqual({ id: 'visita-aberta', update: { unit: 'Centro', scheduledFor: atVisita } });
  });
```

acrescentar:

```js

  it('com o registro a fechar: ele leva o status e a hora do servidor, e sem ele nada fecha', () => {
    const { closed, record } = gravar({ schedule: VISITA, at: atVisita, close: { id: 'visita-velha', status: 'no_show' }, newRecordId: 'rec-novo' });
    expect(closed).toEqual({ id: 'visita-velha', update: { status: 'no_show', outcomeAt: HORA } });
    expect(record.id).toBe('rec-novo');
    expect(gravar({ schedule: VISITA, at: atVisita, newRecordId: 'rec-novo' }).closed).toBeNull();
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/zapSchedule.test.js`
Expected: FAIL, `Tests  15 failed | 154 passed (169)`, com `TypeError: scheduleRecordChanges is not a function` e, no teste do `closed`, `expected undefined to deeply equal { id: 'visita-velha', … }`.

- [ ] **Step 3: Implementar**

Em `api/_zapSchedule.js`, no comentário do topo, trocar:

```js
// src/views/LeadProfileView.jsx, mais o upsertScheduledAppointment de
```

por:

```js
// src/views/LeadProfileView.jsx, mais o recordNewAppointment de
```

Trocar a linha 30:

```js
import { AULA_STATUS, APPOINTMENT_RECORD_TYPES, aulaRecordFields, isAulaRecord } from '../src/lib/aulas.js';
```

por:

```js
import {
  AULA_STATUS, APPOINTMENT_RECORD_TYPES, aulaRecordFields, isAulaRecord, recordPlanFor, recordMatchesAppointment
} from '../src/lib/aulas.js';
```

Logo depois do `isOpenAulaRecord`, que termina assim:

```js
export const isOpenAulaRecord = (record, leadId) =>
  Boolean(record) && Boolean(leadId) && record.leadId === leadId
  && record.status === AULA_STATUS.AGENDADA && isAulaRecord(record);
```

acrescentar:

```js

// O registro em aberto de um tipo entre os registros do lead: a visita é a
// primeira visita agendada (pickOpenVisitaId), e a aula, o registro do
// currentAulaId quando ele ainda é uma aula agendada deste lead
// (isOpenAulaRecord).
function openRecordOf(recordType, records, lead) {
  if (recordType === APPOINTMENT_RECORD_TYPES.VISITA) {
    const id = pickOpenVisitaId(records);
    return records.find((r) => r.id === id) ?? null;
  }
  const aula = records.find((r) => r.id === lead.currentAulaId);
  return aula && isOpenAulaRecord(aula, lead.id) ? aula : null;
}

// Os registros de stronix_aulas que o agendamento mexe, na regra do assistente
// da ficha (recordNewAppointment, em src/lib/aulasWrites.js):
//   - close: o registro do agendamento que o lead tinha e o status com que ele
//     fecha (recordPlanFor: o "Compareceu" ou o "Não veio" do lead ou, na troca
//     de tipo, cancelado), ou null. Só fecha registro em aberto e da mesma data
//     do agendamento do lead (recordMatchesAppointment), como o
//     closeOpenAppointment;
//   - openRecordId: o registro em aberto do tipo novo, que o agendamento
//     reaproveita, ou null para nascer outro. O que acabou de fechar não conta,
//     como no assistente, que fecha antes de procurar.
// `records` são todos os registros do lead (a consulta por leadId), lidos na
// mesma transação da gravação.
export function scheduleRecordChanges({ lead, schedule, at, records = [] }) {
  const list = records || [];
  const plan = recordPlanFor(lead, { type: schedule.type, at });
  let close = null;
  if (plan.close) {
    const target = openRecordOf(plan.close.type, list, lead);
    if (target && recordMatchesAppointment(target, lead)) close = { id: target.id, status: plan.close.status };
  }
  const rest = close ? list.filter((r) => r.id !== close.id) : list;
  const newType = schedule.type === 'aula_experimental' ? APPOINTMENT_RECORD_TYPES.AULA : APPOINTMENT_RECORD_TYPES.VISITA;
  const reused = openRecordOf(newType, rest, lead);
  return { close, openRecordId: reused ? reused.id : null };
}
```

No comentário do `buildScheduleWrites`, trocar:

```js
// O que a ação schedule grava numa transação só, o mesmo que o assistente
// grava em três passos:
//   - record: o registro em stronix_aulas. Com `openRecordId` (a aula do
```

por:

```js
// O que a ação schedule grava numa transação só, o mesmo que o assistente
// grava em três passos:
//   - closed: com `close` (scheduleRecordChanges), o registro do agendamento
//     que o lead tinha fecha com o status e a hora do servidor, como o
//     closeOpenAppointment; sem ele, null;
//   - record: o registro em stronix_aulas. Com `openRecordId` (a aula do
```

Na assinatura, trocar:

```js
  lead, actor, schedule, at, professors = [], channelName = null, openRecordId = null, newRecordId = null,
```

por:

```js
  lead, actor, schedule, at, professors = [], channelName = null, close = null, openRecordId = null, newRecordId = null,
```

E, no fim da função, trocar:

```js
  return { record, interaction, leadPatch };
}
```

por:

```js
  const closed = close ? { id: close.id, update: { status: close.status, outcomeAt: serverTime } } : null;
  return { closed, record, interaction, leadPatch };
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npx vitest run api/__tests__/zapSchedule.test.js src/lib/__tests__/newLeadImports.test.js src/lib/__tests__/zapScheduleTimeline.test.js src/lib/__tests__/profileZapSchedule.test.js
```

Expected: PASS, com `api/__tests__/zapSchedule.test.js (169 tests)`. A varredura de imports continua verde: o `api/_zapSchedule.js` chega a `src/lib/aulas.js` e a `src/lib/leads.js`, e nunca a `aulasWrites.js`.

- [ ] **Step 5: Commit**

```bash
git add api/_zapSchedule.js api/__tests__/zapSchedule.test.js
git commit -m "feat: ponte decide o registro que fecha e o que é reaproveitado (scheduleRecordChanges)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: A ponte, a rota (`api/zap.js`)

**Files:**
- Modify: `api/zap.js:32-36` (import) e `api/zap.js:614-633` (a transação do `handleSchedule`)
- Test: `api/__tests__/zapRoute.test.js` (imports das linhas 19-20 e o teste da linha 2062)

- [ ] **Step 1: Escrever os testes**

Em `api/__tests__/zapRoute.test.js`, trocar:

```js
import { buildNewLeadDoc } from '../../src/lib/newLead.js';
import { buildNotificationFeed } from '../../src/lib/notifications.js';
```

por:

```js
import { buildNewLeadDoc } from '../../src/lib/newLead.js';
import { buildNotificationFeed } from '../../src/lib/notifications.js';
import { appointmentsOf } from '../../src/lib/crm/appointments.js';
import { getSafeDateOrNull } from '../../src/lib/dates.js';
```

O teste da linha 2062 trava o defeito (a visita com "Não compareceu" tem o registro movido para a data nova). Trocar o teste inteiro:

```js
  it('remarcar visita: o registro em aberto troca de data, o desfecho anterior sai e a linha do tempo ganha outro registro', async () => {
    banco.leads[TENANT] = [marianaLead({
      appointmentType: 'visita', appointmentScheduledFor: ts(new Date('2026-09-30T21:00:00.000Z')),
      appointmentUnit: 'Zona Sul', appointmentOutcome: 'no_show', appointmentOutcomeAt: ts(new Date('2026-09-28T21:00:00.000Z'))
    })];
    banco.aulas[TENANT] = [
      registro('v-velha', { status: 'no_show', scheduledFor: ts(new Date('2026-09-20T21:00:00.000Z')) }),
      registro('v-aberta', { unit: 'Zona Sul' })
    ];
    const res = resposta();

    await handler(pedidoAgenda(), res);

    expect(res.statusCode).toBe(201);
    expect(aulasDaAcademia()).toHaveLength(2);
    expect(aulasDaAcademia().find((a) => a.id === 'v-aberta')).toMatchObject({ unit: 'Centro', scheduledFor: QUINTA_18H, status: 'agendada' });
    expect(aulasDaAcademia().find((a) => a.id === 'v-velha').status).toBe('no_show');
    expect(leadDaAcademia('L1')).toMatchObject({
      appointmentScheduledFor: QUINTA_18H, appointmentUnit: 'Centro', appointmentOutcome: null, appointmentOutcomeAt: null
    });
    expect(interacoesDaAcademia()).toHaveLength(1);
  });
```

por:

```js
  it('remarcar visita sem desfecho: o registro em aberto troca de data e de unidade, e a linha do tempo ganha outro registro', async () => {
    banco.leads[TENANT] = [marianaLead({
      appointmentType: 'visita', appointmentScheduledFor: ts(new Date('2026-09-30T21:00:00.000Z')), appointmentUnit: 'Zona Sul'
    })];
    banco.aulas[TENANT] = [
      registro('v-velha', { status: 'no_show', scheduledFor: ts(new Date('2026-09-20T21:00:00.000Z')) }),
      registro('v-aberta', { unit: 'Zona Sul' })
    ];
    const res = resposta();

    await handler(pedidoAgenda(), res);

    expect(res.statusCode).toBe(201);
    expect(aulasDaAcademia()).toHaveLength(2);
    expect(aulasDaAcademia().find((a) => a.id === 'v-aberta')).toMatchObject({ unit: 'Centro', scheduledFor: QUINTA_18H, status: 'agendada' });
    expect(aulasDaAcademia().find((a) => a.id === 'v-velha').status).toBe('no_show');
    expect(leadDaAcademia('L1')).toMatchObject({ appointmentScheduledFor: QUINTA_18H, appointmentUnit: 'Centro', appointmentOutcome: null });
    expect(interacoesDaAcademia()).toHaveLength(1);
  });

  // O desfecho da visita não é gravado no registro quando é marcado. Mover o
  // registro para a data nova apagaria a falta ou o comparecimento do Dashboard
  // CRM no mês da visita: ele fecha com o desfecho, e a data nova abre outro.
  it.each([
    ['"Não compareceu"', 'no_show'],
    ['"Compareceu"', 'attended']
  ])('visita com %s e outra visita em outro dia: o registro dela fecha com o desfecho, na data dela, e a data nova abre outro', async (_, appointmentOutcome) => {
    banco.leads[TENANT] = [marianaLead({
      appointmentType: 'visita', appointmentScheduledFor: ts(new Date('2026-09-28T21:00:00.000Z')), appointmentUnit: 'Zona Sul',
      appointmentOutcome, appointmentOutcomeAt: ts(new Date('2026-09-28T22:00:00.000Z'))
    })];
    banco.aulas[TENANT] = [registro('v-set', { unit: 'Zona Sul', scheduledFor: ts(new Date('2026-09-28T21:00:00.000Z')) })];
    const res = resposta();

    await handler(pedidoAgenda(), res);

    expect(res.statusCode).toBe(201);
    expect(aulasDaAcademia()).toHaveLength(2);
    const velha = aulasDaAcademia().find((a) => a.id === 'v-set');
    expect(velha).toMatchObject({ status: appointmentOutcome, outcomeAt: HORA, unit: 'Zona Sul' });
    expect(velha.scheduledFor.toDate()).toEqual(new Date('2026-09-28T21:00:00.000Z'));
    const nova = aulasDaAcademia().find((a) => a.id !== 'v-set');
    expect(nova).toMatchObject({ type: 'visita', leadId: 'L1', unit: 'Centro', scheduledFor: QUINTA_18H, status: 'agendada' });
    expect(leadDaAcademia('L1')).toMatchObject({ appointmentScheduledFor: QUINTA_18H, appointmentOutcome: null });
    // Uma gravação a mais que a visita nova sem nada a fechar: 4 no lugar de 3.
    expect(banco.gravacoes).toHaveLength(4);
  });

  it('visita em aberto trocada por aula: a visita fecha como cancelada, e a aula nasce', async () => {
    banco.leads[TENANT] = [marianaLead({
      appointmentType: 'visita', appointmentScheduledFor: ts(new Date('2026-09-30T21:00:00.000Z')), appointmentUnit: 'Centro'
    })];
    banco.aulas[TENANT] = [registro('v-aberta')];

    await handler(pedidoAgenda({ schedule: AULA_DA_CARLA }), resposta());

    expect(aulasDaAcademia().find((a) => a.id === 'v-aberta')).toMatchObject({ status: 'cancelled', outcomeAt: HORA });
    const aula = aulasDaAcademia().find((a) => a.id !== 'v-aberta');
    expect(aula).toMatchObject({ type: 'aula', status: 'agendada', scheduledFor: SEXTA_19H });
    expect(leadDaAcademia('L1').currentAulaId).toBe(aula.id);
  });

  it('visita com "Compareceu" e depois uma aula: a visita fecha como compareceu, e não como cancelada', async () => {
    banco.leads[TENANT] = [marianaLead({
      appointmentType: 'visita', appointmentScheduledFor: ts(new Date('2026-09-28T21:00:00.000Z')), appointmentUnit: 'Centro',
      appointmentOutcome: 'attended'
    })];
    banco.aulas[TENANT] = [registro('v-set', { scheduledFor: ts(new Date('2026-09-28T21:00:00.000Z')) })];

    await handler(pedidoAgenda({ schedule: AULA_DA_CARLA }), resposta());

    expect(aulasDaAcademia().find((a) => a.id === 'v-set')).toMatchObject({ status: 'attended' });
  });

  it('aula em aberto trocada por visita: a aula do currentAulaId fecha como cancelada, e o lead continua apontando para ela', async () => {
    banco.leads[TENANT] = [marianaLead({
      appointmentType: 'aula_experimental', appointmentScheduledFor: ts(SEXTA_19H), currentAulaId: 'a-aberta'
    })];
    banco.aulas[TENANT] = [registro('a-aberta', {
      type: 'aula', unit: null, professorId: 'p1', professorName: 'Carla Dias', modality: 'Pilates', scheduledFor: ts(SEXTA_19H)
    })];

    await handler(pedidoAgenda(), resposta());

    expect(aulasDaAcademia().find((a) => a.id === 'a-aberta')).toMatchObject({ status: 'cancelled', outcomeAt: HORA });
    expect(aulasDaAcademia().find((a) => a.id !== 'a-aberta')).toMatchObject({ type: 'visita', scheduledFor: QUINTA_18H, status: 'agendada' });
    expect(leadDaAcademia('L1')).toMatchObject({ appointmentType: 'visita', currentAulaId: 'a-aberta' });
  });

  // O que o Johnny pediu: agendar de novo depois de um desfecho não apaga o
  // desfecho do painel. Os registros chegam ao painel como o useCrmSources
  // entrega (datas em Date), com o lead de depois do agendamento.
  it.each([
    ['a falta', 'no_show', { missed: 1, came: 0 }],
    ['o comparecimento', 'attended', { missed: 0, came: 1 }]
  ])('Dashboard CRM: %s de setembro continua em setembro depois de agendar de novo em outubro', async (_, appointmentOutcome, setembro) => {
    banco.leads[TENANT] = [marianaLead({
      appointmentType: 'visita', appointmentScheduledFor: ts(new Date('2026-09-28T21:00:00.000Z')), appointmentUnit: 'Centro',
      appointmentOutcome
    })];
    banco.aulas[TENANT] = [registro('v-set', { scheduledFor: ts(new Date('2026-09-28T21:00:00.000Z')) })];

    await handler(pedidoAgenda(), resposta());

    const registros = aulasDaAcademia().map((r) => ({
      ...r, scheduledFor: getSafeDateOrNull(r.scheduledFor), createdAt: getSafeDateOrNull(r.createdAt)
    }));
    const lead = leadDaAcademia('L1');
    const noMes = (start, end) => appointmentsOf(registros, { start, end, leadOf: () => lead, inScope: () => true });
    expect(noMes(new Date(2026, 8, 1), new Date(2026, 9, 1))).toMatchObject({ total: 1, pending: 0, ...setembro });
    expect(noMes(new Date(2026, 9, 1), new Date(2026, 10, 1))).toMatchObject({ total: 1, missed: 0, came: 0, pending: 1 });
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/__tests__/zapRoute.test.js`
Expected: FAIL, `Tests  7 failed | 183 passed (190)`. Falham os dois do desfecho, os três da troca de tipo e os dois do Dashboard CRM. O de "remarcar visita sem desfecho" passa antes e depois, porque esse caminho não muda.

- [ ] **Step 3: Implementar**

Em `api/zap.js`, trocar:

```js
import {
  SCHEDULE_LIMIT, ZAP_SCHEDULE_MESSAGES, unitsView, readScheduleOptionsBody, buildScheduleOptions, isDocId,
  readScheduleBody, readStatusBody, checkScheduleCatalog, checkFuture, leadBelongsToNumber, hasSameAppointment,
  isOpenAulaRecord, pickOpenVisitaId, buildScheduleWrites, appointmentDetailOf, alreadyScheduledBody
} from './_zapSchedule.js';
```

por:

```js
import {
  SCHEDULE_LIMIT, ZAP_SCHEDULE_MESSAGES, unitsView, readScheduleOptionsBody, buildScheduleOptions,
  readScheduleBody, readStatusBody, checkScheduleCatalog, checkFuture, leadBelongsToNumber, hasSameAppointment,
  scheduleRecordChanges, buildScheduleWrites, appointmentDetailOf, alreadyScheduledBody
} from './_zapSchedule.js';
```

E, na transação do `handleSchedule`, trocar:

```js
      // O registro em aberto que o assistente reaproveitaria: a aula do
      // currentAulaId ainda agendada, ou a visita agendada do lead. A api/
      // grava com poder de admin, então o registro que o currentAulaId aponta
      // só é reaproveitado se for mesmo uma aula deste lead (isOpenAulaRecord).
      // Se não for, conta como sem registro em aberto, e nasce outro.
      let openRecordId = null;
      if (schedule.type === 'aula_experimental') {
        if (isDocId(lead.currentAulaId)) {
          const aulaSnap = await tx.get(aulas.doc(lead.currentAulaId));
          if (aulaSnap.exists && isOpenAulaRecord(aulaSnap.data(), lead.id)) openRecordId = lead.currentAulaId;
        }
      } else {
        openRecordId = pickOpenVisitaId(docsOf(await tx.get(aulas.where('leadId', '==', lead.id))));
      }
      const newRecordRef = openRecordId ? null : aulas.doc();
      const writes = buildScheduleWrites({
        lead, actor, schedule, at, professors: catalogs.professors, channelName,
        openRecordId, newRecordId: newRecordRef ? newRecordRef.id : null, serverTime, increment
      });
      if (openRecordId) tx.update(aulas.doc(openRecordId), writes.record.update);
```

por:

```js
      // Os registros do lead em stronix_aulas, lidos antes de qualquer
      // gravação. Deles sai o que o assistente da ficha faria
      // (scheduleRecordChanges): o registro do agendamento que o lead tinha
      // fecha quando ele não vai mais acontecer (com o "Compareceu" ou o "Não
      // veio" do lead, ou cancelado na troca de tipo), e o registro em aberto
      // do tipo novo é reaproveitado. A api/ grava com poder de admin, então a
      // aula só reaproveita o registro do currentAulaId se ele for mesmo uma
      // aula deste lead (isOpenAulaRecord); senão, nasce outro.
      const records = docsOf(await tx.get(aulas.where('leadId', '==', lead.id)));
      const { close, openRecordId } = scheduleRecordChanges({ lead, schedule, at, records });
      const newRecordRef = openRecordId ? null : aulas.doc();
      const writes = buildScheduleWrites({
        lead, actor, schedule, at, professors: catalogs.professors, channelName, close,
        openRecordId, newRecordId: newRecordRef ? newRecordRef.id : null, serverTime, increment
      });
      if (writes.closed) tx.update(aulas.doc(writes.closed.id), writes.closed.update);
      if (openRecordId) tx.update(aulas.doc(openRecordId), writes.record.update);
```

O resto da transação (`tx.create` do registro novo, da interação e o `tx.update` do lead) fica como está.

- [ ] **Step 4: Rodar e ver passar**

```bash
npx vitest run api/__tests__
npx eslint api
```

Expected: PASS, com `api/__tests__/zapRoute.test.js (190 tests)` e os outros arquivos da `api/` verdes. Continuam passando, sem mudança, os testes do `currentAulaId` de outro lead, sem dono, de visita e estragado (7, `a/b`, `__x__`), o do "Tentar de novo" com `ja_agendado`, o de "dois pedidos ao mesmo tempo" e o de "visita de hoje com 'Não compareceu' já marcado e o mesmo horário pedido". O eslint sai sem erro: o `isDocId`, o `isOpenAulaRecord` e o `pickOpenVisitaId` saíram do import da rota.

- [ ] **Step 5: Commit**

```bash
git add api/zap.js api/__tests__/zapRoute.test.js
git commit -m "fix: agendar de novo pelo Stronizap não apaga o desfecho do Dashboard CRM

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Documentação (`CLAUDE.md`)

**Files:**
- Modify: `CLAUDE.md` (do Stronilead, na raiz do worktree): linha 120 (seção "Agendamento pelo Stronizap") e linhas 155 e 156 (seção "Dashboard CRM")

Não mexer no `06-sistemas/CLAUDE.md` nem no `CLAUDE.md` da raiz da STRONIX-FIRMA: eles não são git e mudam só depois do recurso em produção (ver "Fora deste plano").

- [ ] **Step 1: O item "O que é gravado espelha o assistente" (linha 120)**

Trocar o trecho:

```markdown
o registro em `stronix_aulas` (a aula reaproveita o registro do `currentAulaId` quando ele ainda está agendado, é de aula e é deste lead, e a visita, a primeira visita agendada do lead, como o `upsertScheduledAppointment`), a interação
```

por:

```markdown
o registro em `stronix_aulas`, a interação
```

E trocar, no mesmo item, do "Mudou o `handleWizardConfirm`" até o fim da linha:

```markdown
Mudou o `handleWizardConfirm`, o `upsertScheduledAppointment` ou o `logInteraction`, mude o `api/_zapSchedule.js`. Agendar de novo pelo Stronizap faz o que o assistente faz, e não o Remarcar da Meta Diária (`rescheduleRecordPlan`): trocar de tipo não fecha o registro do tipo antigo. O mesmo vale para o desfecho da visita, que não fecha o registro em `stronix_aulas`: agendar de novo depois de uma falta ou de um comparecimento move o registro para a data nova, igual ao assistente da ficha, e o Dashboard CRM perde a falta ou o comparecimento no mês original. É uma limitação conhecida, e o Johnny decidiu em 30/09 corrigir num PR próprio, levando a regra do PR #237 ao assistente e à ponte. Hoje só o "Remarcar" que abre logo depois do "Não veio" (ou da correção para "Não compareceu") fecha a falta antes de mover; o "Remarcar agendamento" do card "Feitos hoje" move o registro, igual ao assistente. A conferência do lead e do tipo do registro do `currentAulaId` (`isOpenAulaRecord`) é só da ponte: a `api/` grava com poder de admin, e o assistente olha só o status. Registro de outro lead, de visita ou sem `leadId` não é reaproveitado, e a aula nasce num registro próprio.
```

por:

```markdown
Mudou o `handleWizardConfirm`, o `recordNewAppointment` (`src/lib/aulasWrites.js`) ou o `logInteraction`, mude o `api/_zapSchedule.js`. O registro segue a mesma regra do assistente e do Remarcar da Meta Diária (ver "O registro acompanha o agendamento novo", no Dashboard CRM): a transação lê todos os registros do lead numa consulta por `leadId`, antes de gravar, e o `scheduleRecordChanges` diz qual fecha e qual é reaproveitado. O registro do agendamento que o lead tinha fecha com o "Compareceu" ou o "Não veio" que o lead tem, ou como cancelado na troca de tipo. O registro em aberto do tipo novo é reaproveitado (na aula, o do `currentAulaId`; na visita, a primeira visita agendada do lead), e sem ele nasce outro. A conferência do lead e do tipo do registro do `currentAulaId` (`isOpenAulaRecord`) é só da ponte: a `api/` grava com poder de admin, e o assistente olha só o status. Registro de outro lead, de visita ou sem `leadId` não é reaproveitado nem fechado, e a aula nasce num registro próprio.
```

- [ ] **Step 2: Os itens do Dashboard CRM (linhas 155 e 156)**

Trocar:

```markdown
- **Desfecho da visita:** ainda não é gravado no registro de `stronix_aulas`. O CRM usa o desfecho do espelho do lead (`appointmentOutcome`) quando ele é da mesma visita e, senão, a última interação `daily_goal_done` de `visita_hoje` do dia marcado ou do seguinte. Gravar o desfecho no próprio registro fica para uma PR separada.
- **O registro acompanha a remarcação da Meta Diária.** O "Remarcar" segue `rescheduleRecordPlan` (`src/lib/aulas.js`): visita remarcada move o registro em aberto para a data nova, como o assistente da ficha já fazia; depois do "Não veio", o registro da visita que faltou fecha como falta antes de a data nova abrir outro, senão mover o registro apagaria a falta do painel; e a troca de tipo fecha o registro antigo como cancelado. `closeOpenAppointment` (`src/lib/aulasWrites.js`) só fecha registro com a mesma data do agendamento do lead, a mesma guarda do `applyOutcomeToAula`, e o Remarcar, que não escolhe unidade, mantém a do registro. Até 2026-09-29 a visita remarcada pela Meta ficava com a data velha no registro, e o painel a contava no dia antigo e perdia o comparecimento. Os registros dessa época continuam com a data velha.
```

por:

```markdown
- **Desfecho da visita:** não é gravado no registro de `stronix_aulas` na hora em que é marcado. Enquanto a visita é o agendamento do lead, o CRM usa o desfecho do espelho do lead (`appointmentOutcome`) quando ele é da mesma visita e, senão, a última interação `daily_goal_done` de `visita_hoje` do dia marcado ou do seguinte. O registro só recebe o desfecho quando o lead ganha outro agendamento (item abaixo). Gravar o desfecho no registro na hora da marcação fica para uma PR separada.
- **O registro acompanha o agendamento novo.** O Remarcar da Meta Diária, o assistente da ficha (`recordNewAppointment`, em `src/lib/aulasWrites.js`) e o agendamento pelo Stronizap (`scheduleRecordChanges`, em `api/_zapSchedule.js`) seguem a mesma regra, `rescheduleRecordPlan` (`src/lib/aulas.js`). O assistente e o Stronizap a leem do lead por `recordPlanFor`, com o tipo, o desfecho e o instante do agendamento que ele tem. Visita remarcada sem desfecho move o registro em aberto para a data nova. O registro do agendamento que teve "Compareceu" ou "Não veio" fecha com esse desfecho antes de a data nova abrir outro, senão mover o registro apagaria o desfecho do mês original. O desfecho ganha da troca de tipo: a visita que aconteceu e deu lugar a uma aula fecha como compareceu. A troca de tipo sem desfecho fecha o registro antigo como cancelado. Agendamento novo do mesmo tipo e no mesmo instante não fecha nada, porque aí o desfecho foi marcado antes da hora e o agendamento continua com o mesmo registro. O Remarcar que a Meta abre logo depois do "Não veio" (ou da correção para "Não compareceu") fecha como falta em qualquer caso (`afterNoShow`). O "Remarcar agendamento" do card "Feitos hoje" ainda passa só o `afterNoShow` e por isso move o registro de quem já tem desfecho. `closeOpenAppointment` e `scheduleRecordChanges` só fecham registro com a mesma data do agendamento do lead (`recordMatchesAppointment`, a mesma guarda do `applyOutcomeToAula`), e o Remarcar, que não escolhe unidade, mantém a do registro. A aula já recebe o desfecho no registro pelo `applyOutcomeToAula`, e a regra só a fecha quando essa gravação falhou. Até 2026-09-29 a visita remarcada pela Meta ficava com a data velha no registro, e o painel a contava no dia antigo e perdia o comparecimento. Os registros dessa época continuam com a data velha, e as visitas com desfecho que o assistente ou o Stronizap moveram antes desta regra continuam na data nova, sem o desfecho no mês original: nenhum script os acerta.
```

- [ ] **Step 3: Conferir e commitar**

```bash
grep -n -e 'o `upsertScheduledAppointment` ou o `logInteraction`' -e 'limitação conhecida, e o Johnny' CLAUDE.md
git diff CLAUDE.md | grep '^+' | grep -c '—'
git diff --stat
git add CLAUDE.md
git commit -m "docs: o registro fecha com o desfecho ao agendar de novo, no CLAUDE.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: o primeiro `grep` não acha nada; o segundo imprime `0` (as linhas novas não têm travessão); o `--stat` mostra só o `CLAUDE.md`.

---

### Task 7: O Remarcar da Meta também lê o desfecho (só com o sim do Johnny)

Pule esta tarefa se o Johnny não tiver aprovado. Ela corrige o "Remarcar agendamento" do card "Feitos hoje" (nota 9): hoje ele move o registro de quem já tem desfecho e, na troca de tipo depois de um "Compareceu", fecha como cancelada a visita que aconteceu.

**Files:**
- Modify: `src/views/DailyGoalView.jsx:20` (import) e `src/views/DailyGoalView.jsx:1533-1544` (o plano do registro no `handleReschedule`)
- Modify: `CLAUDE.md` (a frase do "Feitos hoje" escrita na Task 6)
- Test: `src/lib/__tests__/registroDoAgendamento.sweep.test.js`

A regra já está testada na Task 1 (desfecho, ordem do `afterNoShow`, troca de tipo e mesmo instante). A varredura trava que o Remarcar passe o lead para ela.

- [ ] **Step 1: Escrever o teste**

Em `src/lib/__tests__/registroDoAgendamento.sweep.test.js`, trocar:

```js
    expect(corpo).not.toMatch(/upsertScheduledAula|upsertScheduledAppointment|closeOpenAppointment/);
  });
});
```

por:

```js
    expect(corpo).not.toMatch(/upsertScheduledAula|upsertScheduledAppointment|closeOpenAppointment/);
  });

  // O "Remarcar agendamento" do "Feitos hoje" abre o Remarcar sem o afterNoShow
  // num lead que já tem "Compareceu" ou "Não veio": sem o desfecho do lead, a
  // regra moveria o registro, e na troca de tipo fecharia a visita que
  // aconteceu como cancelada.
  it('o Remarcar da Meta Diária lê a regra pelo lead, com o instante novo e o afterNoShow', () => {
    const corpo = corpoDe(ler('../../views/DailyGoalView.jsx'), 'handleReschedule');
    expect(corpo).toContain('recordPlanFor(lead, { type: finalApptType, at: newDate, afterNoShow: isAfterNoShow })');
    expect(corpo).not.toContain('rescheduleRecordPlan(');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/registroDoAgendamento.sweep.test.js`
Expected: FAIL, `Tests  1 failed | 1 passed (2)`, no teste do Remarcar.

- [ ] **Step 3: Implementar**

Em `src/views/DailyGoalView.jsx`, trocar a linha 20:

```js
import { rescheduleRecordPlan } from '../lib/aulas.js';
```

por:

```js
import { recordPlanFor } from '../lib/aulas.js';
```

E, no `handleReschedule`, trocar:

```js
      // Dual-write best-effort no histórico de aulas (stronix_aulas): a regra
      // do Firestore pode ainda não estar publicada, então falha aqui NÃO
      // pode quebrar o reagendamento do lead — por isso o try/catch isolado.
      // O registro segue o agendamento do lead, como no assistente da ficha
      // (rescheduleRecordPlan, em lib/aulas.js): o que não vai mais acontecer
      // fecha (falta depois do "Não veio", cancelado na troca de tipo) e a
      // visita nova move o registro aberto ou abre um.
      const recordPlan = rescheduleRecordPlan({
        previousType: getLeadAppointmentType(lead),
        finalType: finalApptType,
        afterNoShow: isAfterNoShow,
      });
```

por:

```js
      // Dual-write best-effort no histórico de aulas (stronix_aulas): a regra
      // do Firestore pode ainda não estar publicada, então falha aqui não
      // pode quebrar o reagendamento do lead, por isso o try/catch isolado.
      // O registro segue o agendamento do lead, como no assistente da ficha
      // (recordPlanFor, em lib/aulas.js): o que não vai mais acontecer fecha
      // (falta depois do "Não veio"; o "Compareceu" ou o "Não veio" que o lead
      // já tem, quando o agendamento muda, como no "Remarcar agendamento" do
      // "Feitos hoje"; cancelado na troca de tipo) e a visita nova move o
      // registro aberto ou abre um.
      const recordPlan = recordPlanFor(lead, { type: finalApptType, at: newDate, afterNoShow: isAfterNoShow });
```

O `getLeadAppointmentType` continua importado, porque a view o usa em outros pontos (linhas 273, 1523 e 1947).

- [ ] **Step 4: Rodar e ver passar**

```bash
npx vitest run src/lib/__tests__/registroDoAgendamento.sweep.test.js src/lib/__tests__/metaLinks.test.js src/lib/__tests__/aulas.test.js
npx eslint src/views/DailyGoalView.jsx
```

Expected: PASS (a varredura com 2 testes) e o eslint sem erro.

- [ ] **Step 5: O `CLAUDE.md`**

No item "O registro acompanha o agendamento novo" (seção Dashboard CRM), trocar:

```markdown
O assistente e o Stronizap a leem do lead por `recordPlanFor`, com o tipo, o desfecho e o instante do agendamento que ele tem.
```

por:

```markdown
Os três a leem do lead por `recordPlanFor`, com o tipo, o desfecho e o instante do agendamento que ele tem.
```

E trocar:

```markdown
O "Remarcar agendamento" do card "Feitos hoje" ainda passa só o `afterNoShow` e por isso move o registro de quem já tem desfecho.
```

por:

```markdown
O "Remarcar agendamento" do card "Feitos hoje", que abre o Remarcar num lead que já tem desfecho, fecha o registro como o assistente.
```

- [ ] **Step 6: Commit**

```bash
git add src/views/DailyGoalView.jsx src/lib/__tests__/registroDoAgendamento.sweep.test.js CLAUDE.md
git commit -m "fix: Remarcar do Feitos hoje fecha o registro de quem já tem desfecho

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Verificação completa

**Files:** nenhum

- [ ] **Step 1: Suíte, lint, build e Sentry**

```bash
npm test
npm run lint
npm run build
npm run verificar:sentry
```

Expected:
- `npm test`: tudo verde, com 1 arquivo e 50 testes a mais que na Task 0 (em cima de `c08cd44`: `Test Files  156 passed (156)` e `Tests  3601 passed (3601)`; com a Task 7, `3602`);
- `npm run lint`: 0 erros. O aviso de `react-hooks/exhaustive-deps` em `src/views/superadmin/SuperAdminView.jsx` já existe na main;
- `npm run build`: `✓ built`, com o aviso de pedaço maior que 500 kB que a main já tem;
- `npm run verificar:sentry`: `rodada normal: OK` e `rodada sabotagem: OK`.

- [ ] **Step 2: Travas da casa**

```bash
ls api/*.js | grep -v '^api/_' | wc -l
git diff origin/main --stat -- firestore.rules firestore.indexes.json vercel.json package.json package-lock.json
git diff origin/main --stat
```

Expected: `11` funções; nenhuma mudança em regras, índices, Vercel ou dependências; e o `--stat` só com os arquivos do "Mapa de arquivos" (o `DailyGoalView.jsx` só se a Task 7 entrou), mais este plano em `docs/`.

- [ ] **Step 3: Reler o diff contra as notas de abertura**

Run: `git diff origin/main -- src/lib/aulas.js src/lib/aulasWrites.js api/_zapSchedule.js api/zap.js src/views/LeadProfileView.jsx`
Expected: a ordem da regra é a da nota 3 (o `afterNoShow`, depois o desfecho, depois a troca de tipo), o mesmo instante não fecha (nota 4), a ponte faz uma leitura só, antes das escritas (nota 7), e nada mudou no `buildSchedulePatch` nem no `hasSameAppointment` (nota 10).

---

### Task 9: PR e o teste de verdade

**Files:** nenhum

- [ ] **Step 1: Abrir o PR (sem merge; o merge é do Johnny)**

Se a main andou desde a Task 0, traga antes: `git fetch origin && git merge --no-edit origin/main`, e rode `npm test` de novo. No corpo abaixo, a linha que começa com "(só se a Task 7 entrou)" sai inteira se a Task 7 não entrou; se entrou, sai só a marca entre parênteses.

```bash
git push -u origin claude/desfecho-fecha-registro
gh pr create --base main --title "fix: agendar de novo depois de um desfecho não apaga o desfecho do Dashboard CRM" --body "$(cat <<'EOF'
Agendar de novo pelo assistente da ficha ou pelo Stronizap, depois de um "Compareceu" ou de um "Não veio", movia o registro da visita em `stronix_aulas` para a data nova. O Dashboard CRM perdia a falta ou o comparecimento no mês da visita e contava uma visita pendente no mês novo. Agora o registro fecha com o desfecho antes de o agendamento novo abrir outro, na regra do Remarcar da Meta Diária (PR #237).

- regra única e pura em `src/lib/aulas.js`: o `rescheduleRecordPlan` lê o desfecho e o instante, o `recordPlanFor` aplica a regra ao lead e o `recordMatchesAppointment` é a guarda da data
- assistente da ficha: grava pelo `recordNewAppointment` (`src/lib/aulasWrites.js`), best-effort como antes
- Stronizap: o `schedule` lê os registros do lead numa consulta só, dentro da transação e antes das escritas, e grava o fechamento junto (`scheduleRecordChanges`, em `api/_zapSchedule.js`)
- vale para "Compareceu" e "Não veio"; o desfecho ganha da troca de tipo, então a visita que aconteceu e deu lugar a uma aula fecha como compareceu, e não como cancelada; a troca de tipo sem desfecho fecha como cancelada
- o mesmo tipo no mesmo instante não fecha nada: o desfecho foi marcado antes da hora e o agendamento continua
- a aula já recebia o desfecho no registro (`applyOutcomeToAula`); a regra só a fecha quando essa gravação falhou
- (só se a Task 7 entrou) o "Remarcar agendamento" do "Feitos hoje" passa a fechar o registro de quem já tem desfecho
- nada muda no contrato da ponte, nas regras e nos índices do Firestore, nem no número de funções da Vercel (11)

**Fica como está:** as visitas com desfecho que já foram movidas continuam na data nova. Não há script de acerto.

**Pontos para o Johnny:** a Task 7 do plano (o Remarcar do "Feitos hoje"), se ainda não decidida, e o caso do desfecho marcado antes da hora com a mesma visita pedida no mesmo horário, em que o registro continua em aberto e o desfecho precipitado não conta.

Plano: `docs/superpowers/plans/2026-09-30-desfecho-fecha-registro.md`

Verificação: `npm test`, `npm run lint`, `npm run build` e `npm run verificar:sentry` verdes. Os testes provam pelos dois caminhos que a falta e o comparecimento de setembro continuam em setembro depois de agendar de novo em outubro.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: o link do PR. Não fazer merge.

- [ ] **Step 2: O teste de verdade (Johnny, depois do merge, ou no Preview com uma academia de teste)**

O Preview usa o Firebase de produção: nele, só com conta de academia de teste. Na STRONIX, com um lead de teste:

1. Marque pela ficha uma visita para hoje. Na Agenda de hoje, marque "Não veio" e feche o Remarcar sem escolher data.
2. Na ficha, agende outra visita para outro dia pelo assistente.
3. No Firestore, em `stronix_aulas`, o registro da visita de hoje fica com `status: 'no_show'` e a data de hoje, e a visita nova tem registro próprio. No Dashboard CRM, o mês de hoje conta a falta, e o mês da visita nova conta uma visita pendente.
4. Repita com "Compareceu" e, depois dele, uma aula experimental: o registro da visita fica `attended`, e não `cancelled`.
5. Com o agendamento do Stronizap no ar, repita os passos 1 a 3 agendando de novo pelo "Agendar" da conversa.
6. Se a Task 7 entrou, repita os passos 1 a 3 pelo "Remarcar agendamento" do card "Feitos hoje", no lugar do assistente.

Defeito vira PR novo aqui, no mesmo formato deste plano.

---

## Fora deste plano

- **Acerto dos registros já movidos.** Um script teria de refazer a data e o status de cada visita pela linha do tempo. Não foi pedido.
- **Gravar o desfecho da visita no registro na hora em que é marcado**, a PR separada que o `CLAUDE.md` já cita. Aí o registro teria o desfecho desde a marcação, e a correção e o desfazer precisariam mexer nele também.
- **A Task 7**, se o Johnny não aprovar.
- **Depois do recurso em produção:** uma linha na tabela "Últimas Atualizações" do `~/STRONIX-FIRMA/CLAUDE.md` (não é git), com a data do deploy, o número do PR do `crm-stronix` e o que mudou para quem usa: agendar de novo pela ficha ou pelo Stronizap não apaga mais a falta nem o comparecimento do Dashboard CRM.
