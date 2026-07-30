# Agenda do dia — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a presença cruzada por turno por um painel compartilhado na Meta Diária que lista todas as visitas e aulas experimentais de hoje na academia, com registro de presença aberto a qualquer consultor.

**Architecture:** Uma função pura (`computeDayAgenda`) monta as linhas a partir de duas fontes unidas por id: a assinatura viva de leads ativos que o app já tem em memória, e uma consulta ao vivo da janela de hoje que traz também cliente. Um hook isola a consulta, um card apresenta, e a escrita reusa `writeAppointmentOutcome`, que já credita o dono do lead.

**Tech Stack:** React 19, Vite, Tailwind v4, Firestore (SDK web modular), vitest.

**Spec:** `docs/superpowers/specs/2026-07-30-agenda-do-dia-design.md`

---

## Contexto que o executor precisa saber

O app é multi-tenant. Toda coleção vive em
`artifacts/{appId}/public/data/{PATH}`, onde `appId` vem de `src/lib/firebase.js`
(é mutável, `setTenantId` troca no login). Nunca montar caminho na mão fora
desse padrão.

Datas: o app trabalha em horário **local**, nunca UTC. `normalizeLeadDoc`
(`src/lib/leads.js`) converte os `Timestamp` do Firestore em `Date`. Toda função
pura recebe `now` por parâmetro em vez de chamar `new Date()` dentro, para o
teste poder fixar o relógio sem `vi.useFakeTimers()`.

Testes: `npm test` roda `vitest run`. Os testes existentes ficam em
`src/lib/__tests__/`, escritos em português, e testam **só funções puras**. Não
há teste de hook nem de componente no projeto, então não invente um harness novo:
hook e card são verificados rodando o app.

O projeto não tem TypeScript. Não adicione anotações de tipo.

Estilo: tokens semânticos do Tailwind (`bg-card`, `text-muted-foreground`,
`border-border`), `cn()` para classe condicional, `flex gap-*` em vez de
`space-x/y-*`, `size-N` em vez de `w-N h-N`. O ramp laranja da marca é
`accent-50..600` **sempre com sufixo numérico**.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/dayAgenda.js` (novo) | Regra pura: une as fontes, filtra o dia, resolve desfecho e ordena. Sem React, sem Firestore. |
| `src/lib/__tests__/dayAgenda.test.js` (novo) | Testes da regra pura. |
| `src/hooks/useDayAgenda.js` (novo) | Só a consulta ao vivo da janela de hoje. Nenhuma regra de negócio. |
| `src/components/dailygoal/DayAgendaCard.jsx` (novo) | Só apresentação e o clique. Recebe linhas prontas. |
| `src/views/DailyGoalView.jsx` (modificar) | Monta o hook, chama a regra, renderiza o card, grava a presença. Remove o card antigo. |
| `src/App.jsx` (modificar) | Passa `listenersActive` para a `DailyGoalView`. |
| `src/lib/dailyGoal.js` (modificar) | Remove o bloco de presença cruzada. |
| `src/lib/__tests__/dailyGoal.test.js` (modificar) | Remove os testes do bloco removido. |

---

### Task 1: Regra pura — união das fontes e recorte do dia

**Files:**
- Create: `src/lib/dayAgenda.js`
- Test: `src/lib/__tests__/dayAgenda.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/__tests__/dayAgenda.test.js`:

```js
// Testes da AGENDA DO DIA (dayAgenda.js). Todas as funções recebem `now` por
// parâmetro, então não há relógio falso aqui. Datas sempre em horário LOCAL,
// como o app faz.

import { describe, it, expect } from 'vitest';
import { computeDayAgenda } from '../dayAgenda.js';

const NOW = new Date(2026, 6, 30, 18, 52); // qui 30/07/2026 18:52 local
const at = (h, m = 0) => new Date(2026, 6, 30, h, m);

const users = new Map([
  ['u1', { name: 'Rafael' }],
  ['u2', { name: 'Carla' }],
  ['auth-u2', { name: 'Carla' }],
]);

const lead = (over = {}) => ({
  id: 'l1',
  name: 'Bruno Salgado',
  consultantId: 'u1',
  status: 'Novo',
  appointmentType: 'aula_experimental',
  appointmentScheduledFor: at(19),
  ...over,
});

describe('computeDayAgenda — união das fontes e recorte do dia', () => {
  it('une as duas fontes e desduplica por id, a fonte viva vencendo', () => {
    const vivo = lead({ id: 'l1', name: 'Bruno (vivo)' });
    const consulta = lead({ id: 'l1', name: 'Bruno (consulta)' });
    const soConsulta = lead({ id: 'l2', name: 'Thiago', consultantId: 'u2' });

    const { rows } = computeDayAgenda({
      liveLeads: [vivo],
      agendaLeads: [consulta, soConsulta],
      usersById: users,
      viewerId: 'u2',
      now: NOW,
    });

    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === 'l1').name).toBe('Bruno (vivo)');
  });

  it('mantém só visita e aula experimental', () => {
    const msg = lead({ id: 'l3', appointmentType: null, nextFollowUpType: 'Mensagem', nextFollowUp: at(19) });
    const visita = lead({ id: 'l4', appointmentType: 'visita' });

    const { rows } = computeDayAgenda({
      liveLeads: [msg, visita], agendaLeads: [], usersById: users, viewerId: 'u1', now: NOW,
    });

    expect(rows.map((r) => r.id)).toEqual(['l4']);
  });

  it('registro antigo só com nextFollowUp entra pelo fallback', () => {
    const legado = lead({ id: 'l5', appointmentType: null, appointmentScheduledFor: null, nextFollowUpType: 'Aula experimental', nextFollowUp: at(15) });

    const { rows } = computeDayAgenda({
      liveLeads: [legado], agendaLeads: [], usersById: users, viewerId: 'u1', now: NOW,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].categorySlug).toBe('aula_hoje');
  });

  it('ontem e amanhã ficam de fora', () => {
    const ontem = lead({ id: 'l6', appointmentScheduledFor: new Date(2026, 6, 29, 19, 0) });
    const amanha = lead({ id: 'l7', appointmentScheduledFor: new Date(2026, 6, 31, 19, 0) });

    const { rows } = computeDayAgenda({
      liveLeads: [ontem, amanha], agendaLeads: [], usersById: users, viewerId: 'u1', now: NOW,
    });

    expect(rows).toHaveLength(0);
  });

  it('ordena por horário crescente', () => {
    const tarde = lead({ id: 'l8', appointmentScheduledFor: at(20) });
    const cedo = lead({ id: 'l9', appointmentScheduledFor: at(14, 30) });

    const { rows } = computeDayAgenda({
      liveLeads: [tarde, cedo], agendaLeads: [], usersById: users, viewerId: 'u1', now: NOW,
    });

    expect(rows.map((r) => r.id)).toEqual(['l9', 'l8']);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx vitest run src/lib/__tests__/dayAgenda.test.js
```

Esperado: FAIL. A mensagem é sobre não conseguir resolver `../dayAgenda.js`,
porque o arquivo ainda não existe.

- [ ] **Step 3: Escrever a implementação mínima**

Criar `src/lib/dayAgenda.js`:

```js
// AGENDA DO DIA — todas as visitas e aulas experimentais marcadas para HOJE na
// academia, de qualquer consultor, para o painel compartilhado da Meta Diária.
//
// SUBSTITUI a presença cruzada por turno, que só delegava quando o dono do lead
// tinha turno cadastrado E estava fora dele no horário. Na prática isso deixava
// de fora o que o gestor marca (gestor não tem turno), o lead sem dono e o
// agendamento feito em cliente. Aqui não existe regra de horário: quem abre a
// Meta vê o dia inteiro e pode registrar presença de qualquer linha.
//
// Nada disto conta na meta de quem confirma. O crédito vai para o DONO do lead,
// via writeAppointmentOutcome (src/lib/appointmentOutcome.js).

import {
  DAILY_GOAL_CATEGORIES,
  getLeadAppointmentDate,
  getLeadAppointmentType,
} from './leads.js';

// Mesmo dia em horário LOCAL (nunca UTC — o dia tem que bater com o fuso de quem
// está na recepção).
const isSameLocalDay = (a, b) =>
  a instanceof Date && b instanceof Date &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

// `usersById` aceita Map ou objeto simples. Quem monta o índice deve indexar
// pelo id do doc do usuário E pelo authUid, porque appointmentOutcomeBy grava
// authUid (ver src/lib/appointmentOutcome.js) e consultantId grava o id do doc.
const lookupUser = (usersById, key) => {
  if (!key) return null;
  return (usersById instanceof Map ? usersById.get(key) : (usersById || {})[key]) || null;
};

export function computeDayAgenda({
  liveLeads,
  agendaLeads,
  usersById,
  viewerId,
  now = new Date(),
}) {
  // União por id. A fonte VIVA vence: é a mesma coleção, mas chega por snapshot
  // e reflete a última escrita antes da consulta.
  const byId = new Map();
  (agendaLeads || []).forEach((l) => { if (l?.id) byId.set(l.id, l); });
  (liveLeads || []).forEach((l) => { if (l?.id) byId.set(l.id, l); });

  const rows = [];
  byId.forEach((lead) => {
    if (lead.status === 'Perda') return;

    const type = getLeadAppointmentType(lead);
    if (type !== 'visita' && type !== 'aula_experimental') return;

    const scheduledAt = getLeadAppointmentDate(lead);
    if (!isSameLocalDay(scheduledAt, now)) return;

    const owner = lookupUser(usersById, lead.consultantId);

    // O desfecho SÓ vale se foi registrado hoje. Comparecimento preserva o
    // agendamento e o wizard não limpa appointmentOutcome ao remarcar, então sem
    // esta trava um lead que veio semana passada e tem aula nova hoje apareceria
    // já resolvido e ninguém confirmaria a presença dele.
    const outcome = isSameLocalDay(lead.appointmentOutcomeAt, now)
      ? (lead.appointmentOutcome || null)
      : null;
    const outcomeBy = outcome ? lookupUser(usersById, lead.appointmentOutcomeBy) : null;

    rows.push({
      ...lead,
      scheduledAt,
      categorySlug: type === 'visita'
        ? DAILY_GOAL_CATEGORIES.VISITA_HOJE
        : DAILY_GOAL_CATEGORIES.AULA_HOJE,
      ownerName: owner?.name || lead.consultantName || 'sem consultor',
      isMine: Boolean(viewerId) && lead.consultantId === viewerId,
      isClient: lead.lifecycleStage === 'cliente' || lead.status === 'Venda',
      outcome,
      outcomeByName: outcomeBy?.name || null,
    });
  });

  rows.sort((a, b) => a.scheduledAt - b.scheduledAt);

  const pending = rows.filter((r) => !r.outcome).length;
  const nextIndex = rows.findIndex((r) => r.scheduledAt >= now);

  return { rows, pending, nextIndex };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx vitest run src/lib/__tests__/dayAgenda.test.js
```

Esperado: PASS, 5 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dayAgenda.js src/lib/__tests__/dayAgenda.test.js
git commit -m "feat(agenda): regra pura da agenda do dia com união das fontes"
```

---

### Task 2: Regra pura — cliente, perda, desfecho do dia e próxima linha

**Files:**
- Modify: `src/lib/__tests__/dayAgenda.test.js`
- Modify: `src/lib/dayAgenda.js` (só se algum teste falhar)

- [ ] **Step 1: Escrever os testes que faltam**

Acrescentar ao fim de `src/lib/__tests__/dayAgenda.test.js`:

```js
describe('computeDayAgenda — cliente, perda e desfecho', () => {
  it('cliente matriculado entra e vem marcado', () => {
    const cliente = lead({ id: 'c1', name: 'Thiago Melo', status: 'Venda', lifecycleStage: 'cliente' });

    const { rows } = computeDayAgenda({
      liveLeads: [], agendaLeads: [cliente], usersById: users, viewerId: 'u2', now: NOW,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].isClient).toBe(true);
  });

  it('lead perdido fica de fora', () => {
    const perdido = lead({ id: 'p1', status: 'Perda' });

    const { rows } = computeDayAgenda({
      liveLeads: [perdido], agendaLeads: [], usersById: users, viewerId: 'u1', now: NOW,
    });

    expect(rows).toHaveLength(0);
  });

  it('desfecho de HOJE marca a linha como resolvida e nomeia quem registrou', () => {
    const veio = lead({
      id: 'd1',
      appointmentOutcome: 'attended',
      appointmentOutcomeAt: at(19, 12),
      appointmentOutcomeBy: 'auth-u2',
    });

    const { rows, pending } = computeDayAgenda({
      liveLeads: [veio], agendaLeads: [], usersById: users, viewerId: 'u1', now: NOW,
    });

    expect(rows[0].outcome).toBe('attended');
    expect(rows[0].outcomeByName).toBe('Carla');
    expect(pending).toBe(0);
  });

  it('desfecho de OUTRO dia não resolve a linha de hoje (caso da remarcação)', () => {
    // Veio numa aula da semana passada; o agendamento foi remarcado para hoje e o
    // wizard não limpa appointmentOutcome. A linha de hoje tem que estar PENDENTE.
    const remarcado = lead({
      id: 'd2',
      appointmentOutcome: 'attended',
      appointmentOutcomeAt: new Date(2026, 6, 23, 19, 10),
    });

    const { rows, pending } = computeDayAgenda({
      liveLeads: [remarcado], agendaLeads: [], usersById: users, viewerId: 'u1', now: NOW,
    });

    expect(rows[0].outcome).toBeNull();
    expect(rows[0].outcomeByName).toBeNull();
    expect(pending).toBe(1);
  });

  it('isMine marca só as linhas do viewer, e o dono é nomeado pelo índice', () => {
    const meu = lead({ id: 'm1', consultantId: 'u2' });
    const dele = lead({ id: 'm2', consultantId: 'u1' });

    const { rows } = computeDayAgenda({
      liveLeads: [meu, dele], agendaLeads: [], usersById: users, viewerId: 'u2', now: NOW,
    });

    expect(rows.find((r) => r.id === 'm1').isMine).toBe(true);
    expect(rows.find((r) => r.id === 'm2').isMine).toBe(false);
    expect(rows.find((r) => r.id === 'm2').ownerName).toBe('Rafael');
  });

  it('lead sem consultor não quebra e recebe rótulo neutro', () => {
    const orfao = lead({ id: 'o1', consultantId: null });

    const { rows } = computeDayAgenda({
      liveLeads: [orfao], agendaLeads: [], usersById: users, viewerId: 'u1', now: NOW,
    });

    expect(rows[0].ownerName).toBe('sem consultor');
    expect(rows[0].isMine).toBe(false);
  });

  it('nextIndex aponta a primeira linha a partir de agora, e -1 se o dia acabou', () => {
    const passou = lead({ id: 'n1', appointmentScheduledFor: at(14, 30) });
    const vem = lead({ id: 'n2', appointmentScheduledFor: at(19) });

    const agora = computeDayAgenda({
      liveLeads: [passou, vem], agendaLeads: [], usersById: users, viewerId: 'u1', now: NOW,
    });
    expect(agora.rows[agora.nextIndex].id).toBe('n2');

    const fimDoDia = computeDayAgenda({
      liveLeads: [passou, vem], agendaLeads: [], usersById: users, viewerId: 'u1', now: at(22),
    });
    expect(fimDoDia.nextIndex).toBe(-1);
  });
});
```

- [ ] **Step 2: Rodar os testes**

```bash
npx vitest run src/lib/__tests__/dayAgenda.test.js
```

Esperado: PASS, 12 testes. A implementação da Task 1 já cobre todos esses casos.
Se algum falhar, corrigir `src/lib/dayAgenda.js` até passar, sem mexer no teste.

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/dayAgenda.test.js src/lib/dayAgenda.js
git commit -m "test(agenda): cobre cliente, perda, desfecho do dia e próxima linha"
```

---

### Task 3: Hook da consulta do dia

**Files:**
- Create: `src/hooks/useDayAgenda.js`

Sem teste automatizado: o projeto não testa hooks, e esse aqui é fina camada
sobre o SDK do Firestore. A verificação é na Task 7, rodando o app.

- [ ] **Step 1: Escrever o hook**

Criar `src/hooks/useDayAgenda.js`:

```js
// Consulta AO VIVO dos agendamentos de HOJE — a fonte extra da agenda do dia.
//
// Por que existe: a assinatura global do App carrega só `lifecycleBucket ==
// 'ativo'` (flip da PR #144), então cliente e perda não estão em memória. Esta
// consulta pega a janela do dia sem filtrar balde, e a regra pura une as duas.
//
// Índice: range em UM campo só (appointmentScheduledFor) usa índice automático
// do Firestore. NÃO precisa publicar índice no console.
//
// IMPORTANTE: `enabled` tem que receber o portão de atividade (listenersActive
// do App). Sem isso, uma aba esquecida aberta mantém o listener a noite toda e
// desfaz a economia da PR #164 (o Firestore recobra a query inteira quando o
// listener fica desconectado por mais de 30 min).

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { normalizeLeadDoc } from '../lib/leads.js';

export function useDayAgenda({ db, enabled = true, dayKey }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !enabled) return undefined;
    // dayKey não é lido aqui: entra só como dependência para a janela ser
    // recriada na virada da meia-noite com a aba aberta.
    void dayKey;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH),
      where('appointmentScheduledFor', '>=', start),
      where('appointmentScheduledFor', '<=', end)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map(normalizeLeadDoc));
        setLoading(false);
      },
      (err) => {
        console.error('useDayAgenda onSnapshot falhou', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [db, enabled, dayKey]);

  return { items, loading };
}
```

- [ ] **Step 2: Conferir que o lint aceita**

```bash
npx eslint src/hooks/useDayAgenda.js
```

Esperado: nenhum erro. Se `react-hooks/exhaustive-deps` reclamar de `dayKey`, o
`void dayKey` dentro do effect já é o padrão usado no resto do projeto e resolve.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useDayAgenda.js
git commit -m "feat(agenda): hook da consulta ao vivo dos agendamentos de hoje"
```

---

### Task 4: Card da agenda

**Files:**
- Create: `src/components/dailygoal/DayAgendaCard.jsx`

Layout aprovado: trilho do dia, com a **hora dentro do trilho** (não como coluna
da linha), bolinha por estado e destaque na próxima.

- [ ] **Step 1: Adicionar o primitivo do shadcn**

```bash
npx shadcn@latest add toggle-group
```

Esperado: cria `src/components/ui/toggle-group.jsx`. Se pedir confirmação de
sobrescrita de outro componente, recusar.

- [ ] **Step 2: Escrever o componente**

Criar `src/components/dailygoal/DayAgendaCard.jsx`:

```jsx
import { useState } from 'react';
import { BookOpen, Building2, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { PresenceSwitch } from '../ui/PresenceSwitch.jsx';
import { DAILY_GOAL_CATEGORIES } from '../../lib/leads.js';

// Agenda do dia compartilhada (painel da Meta Diária). Só apresenta: as linhas
// chegam prontas de computeDayAgenda e o clique sobe para o pai. NÃO conta na
// meta de quem está olhando — quem confirma credita o DONO do lead.

const hourLabel = (d) =>
  d instanceof Date
    ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : '';

// Linha secundária: tipo, modalidade, professor e dono, sem repetir o óbvio.
const subtitleOf = (row) => {
  const parts = [];
  if (row.categorySlug === DAILY_GOAL_CATEGORIES.VISITA_HOJE) {
    parts.push('Visita');
    if (row.appointmentUnit) parts.push(row.appointmentUnit);
  } else {
    parts.push(row.appointmentModality || 'Aula exp.');
    if (row.appointmentProfessorName) parts.push(row.appointmentProfessorName);
  }
  parts.push(row.isMine ? 'sua' : `de ${row.ownerName}`);
  if (row.outcomeByName) parts.push(`conf. ${row.outcomeByName}`);
  return parts.join(' · ');
};

export function DayAgendaCard({ rows, pending, nextIndex, savingId, onMark }) {
  const [filter, setFilter] = useState('pending');
  if (!rows || rows.length === 0) return null;

  const visible = filter === 'pending' ? rows.filter((r) => !r.outcome) : rows;
  const nextId = rows[nextIndex]?.id;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-100 dark:border-white/[0.05]">
        <span className="size-6 rounded-md grid place-items-center bg-accent-500/15 text-accent-600 dark:text-accent-400 shrink-0">
          <CalendarDays size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13.5px] font-semibold">Agenda de hoje</h3>
          <p className="text-[11px] text-muted-foreground truncate">
            Visitas e aulas da academia · não conta na sua meta
          </p>
        </div>
        {pending > 0 && (
          <span className="num text-[11px] px-1.5 h-[18px] rounded-md grid place-items-center bg-accent-500/15 text-accent-700 dark:text-accent-300 shrink-0">
            {pending}
          </span>
        )}
      </div>

      <div className="px-2.5 pt-2.5">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => v && setFilter(v)}
          className="w-full gap-1"
        >
          <ToggleGroupItem value="pending" className="flex-1 h-7 text-[11.5px]">
            Pendentes
          </ToggleGroupItem>
          <ToggleGroupItem value="all" className="flex-1 h-7 text-[11.5px]">
            Todos
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="p-2.5 max-h-[280px] overflow-y-auto thin-scroll">
        {visible.length === 0 ? (
          <div className="py-6 text-center text-[12px] text-muted-foreground">
            Tudo com presença registrada.
          </div>
        ) : (
          visible.map((row) => {
            const isNext = row.id === nextId;
            const Icon = row.categorySlug === DAILY_GOAL_CATEGORIES.VISITA_HOJE ? Building2 : BookOpen;
            return (
              <div key={row.id} className="flex gap-2">
                {/* Trilho: hora + bolinha de estado. A hora mora AQUI para a
                    linha de conteúdo ficar com a largura toda. */}
                <div className="w-[44px] shrink-0 flex flex-col items-center pt-1.5">
                  <span
                    className={cn(
                      'num text-[11px] leading-none',
                      isNext ? 'text-accent-600 dark:text-accent-400 font-semibold' : 'text-muted-foreground'
                    )}
                  >
                    {hourLabel(row.scheduledAt)}
                  </span>
                  <span
                    className={cn(
                      'mt-1.5 size-[7px] rounded-full shrink-0',
                      row.outcome ? 'bg-emerald-500' : isNext ? 'bg-accent-500' : 'bg-slate-300 dark:bg-neutral-600'
                    )}
                  />
                  <span className="flex-1 w-px bg-slate-100 dark:bg-white/[0.06] min-h-[10px]" />
                </div>

                <div
                  className={cn(
                    'flex-1 min-w-0 mb-1.5 flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-white/[0.03] border',
                    isNext ? 'border-accent-300 dark:border-accent-500/40' : 'border-slate-200/70 dark:border-white/[0.06]',
                    row.isMine && 'border-l-2 border-l-accent-500 rounded-l-none'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                      {row.name}
                      {row.isClient && (
                        <span className="text-[9.5px] font-normal px-1 rounded bg-slate-100 dark:bg-white/[0.08] text-muted-foreground shrink-0">
                          cliente
                        </span>
                      )}
                    </div>
                    <div className="text-[10.5px] text-muted-foreground truncate flex items-center gap-1">
                      <Icon size={11} className="shrink-0" />
                      {subtitleOf(row)}
                    </div>
                  </div>
                  <PresenceSwitch
                    attKey={row.outcome}
                    saving={savingId === row.id}
                    onMark={(o) => onMark(row, o)}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Conferir que compila e passa no lint**

```bash
npx eslint src/components/dailygoal/DayAgendaCard.jsx && npx vite build
```

Esperado: build conclui sem erro. Se o build reclamar de dependência faltando
(`tw-animate-css`, `eslint-plugin-react`), rodar `npm install` antes.

- [ ] **Step 4: Commit**

```bash
git add src/components/dailygoal/DayAgendaCard.jsx src/components/ui/toggle-group.jsx
git commit -m "feat(agenda): card do trilho do dia com filtro de pendentes"
```

---

### Task 5: Fiação na Meta Diária

**Files:**
- Modify: `src/App.jsx` (a linha que renderiza a `DailyGoalView`, hoje ~1342)
- Modify: `src/views/DailyGoalView.jsx`

- [ ] **Step 1: Passar o portão de atividade para a view**

Em `src/App.jsx`, acrescentar a prop `listenersActive` na renderização:

```jsx
{activeTab === 'dailyGoal' && <DailyGoalView leads={metaLeads} interactions={interactions} appUser={appUser} statuses={statuses} db={db} tags={tags} lossReasons={lossReasons} usersList={usersList} funnels={funnels} listenersActive={listenersActive} />}
```

- [ ] **Step 2: Trocar imports e assinatura na view**

Em `src/views/DailyGoalView.jsx`, remover `computeDelegatedPresenceSlots` da
lista importada de `../lib/dailyGoal.js` e acrescentar:

```jsx
import { computeDayAgenda } from '../lib/dayAgenda.js';
import { useDayAgenda } from '../hooks/useDayAgenda.js';
import { DayAgendaCard } from '../components/dailygoal/DayAgendaCard.jsx';
```

Trocar a assinatura do componente:

```jsx
function DailyGoalView({ leads, interactions, appUser, statuses, db, usersList, listenersActive = true }) {
```

- [ ] **Step 3: Trocar o bloco de presença cruzada pelo da agenda**

Substituir o bloco que hoje monta `savingDelegatedId`, `usersById`,
`delegatedPresence` e `markDelegated` por:

```jsx
  // Agenda do dia (painel compartilhado): todas as visitas e aulas de HOJE na
  // academia, de qualquer consultor. Calculada à parte — NÃO entra em
  // processedLeads/totalSlots, não conta na minha meta. Quem confirma credita o
  // DONO do lead (writeAppointmentOutcome).
  const [savingAgendaId, setSavingAgendaId] = useState(null);

  // Índice de usuários por doc id E por authUid: consultantId guarda o id do
  // doc, appointmentOutcomeBy guarda o authUid. Uma entrada por chave, mesmo
  // objeto, para a regra pura resolver os dois nomes com um lookup só.
  const usersById = useMemo(() => {
    const m = new Map();
    (usersList || []).forEach((u) => {
      const entry = { name: u.name };
      m.set(u.id, entry);
      if (u.authUid) m.set(u.authUid, entry);
    });
    return m;
  }, [usersList]);

  const { items: agendaLeads } = useDayAgenda({ db, enabled: listenersActive, dayKey: todayKey });

  const dayAgenda = useMemo(
    () => computeDayAgenda({ liveLeads: leads, agendaLeads, usersById, viewerId: appUser.id, now }),
    [leads, agendaLeads, usersById, appUser, now]
  );

  const markAgendaPresence = async (row, outcome) => {
    if (savingAgendaId) return;
    setSavingAgendaId(row.id);
    try {
      await writeAppointmentOutcome({
        db, lead: row, outcome, categorySlug: row.categorySlug, appUser, statuses,
        sourceLabel: 'Agenda do dia',
      });
      const quem = row.isMine ? '' : ` (meta de ${row.ownerName})`;
      toast.success(outcome === 'attended'
        ? `Presença de ${row.name} confirmada${quem}.`
        : `${row.name} marcado como não veio${quem}.`);
    } catch (err) {
      console.error('markAgendaPresence', err);
      toast.error('Não foi possível salvar a presença. Tente novamente.');
    } finally {
      setSavingAgendaId(null);
    }
  };
```

- [ ] **Step 4: Trocar o card na coluna da direita**

Remover a linha do `DelegatedPresenceCard` e colocar a agenda logo **depois do
`NextUp` e antes do `StreakCard`**:

```jsx
          <DayAgendaCard
            rows={dayAgenda.rows}
            pending={dayAgenda.pending}
            nextIndex={dayAgenda.nextIndex}
            savingId={savingAgendaId}
            onMark={markAgendaPresence}
          />
```

- [ ] **Step 5: Apagar o componente antigo**

Apagar a função `DelegatedPresenceCard` inteira de `src/views/DailyGoalView.jsx`
(hoje começa em `function DelegatedPresenceCard({ items, savingId, onMark }) {`).
Se o import de `Users` do lucide-react ficar sem uso, remover também.

- [ ] **Step 6: Conferir build e lint**

```bash
npx eslint src/views/DailyGoalView.jsx src/App.jsx && npx vite build
```

Esperado: sem erro. Erro de variável não usada indica sobra do bloco antigo.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/views/DailyGoalView.jsx
git commit -m "feat(agenda): agenda do dia substitui a presença cruzada na Meta"
```

---

### Task 6: Remover a regra de turno

**Files:**
- Modify: `src/lib/dailyGoal.js`
- Modify: `src/lib/__tests__/dailyGoal.test.js`

- [ ] **Step 1: Apagar o bloco de presença cruzada**

Em `src/lib/dailyGoal.js`, apagar tudo a partir do cabeçalho de comentário
`// PRESENÇA CRUZADA (turno)` até o fim do arquivo. Isso remove `shiftMinutes`,
`isTimeWithinShift` e `computeDelegatedPresenceSlots`.

- [ ] **Step 2: Apagar os testes correspondentes**

Em `src/lib/__tests__/dailyGoal.test.js`, apagar os dois blocos
`describe('isTimeWithinShift', ...)` e
`describe('computeDelegatedPresenceSlots (presença cruzada por turno)', ...)`,
mais os imports dessas duas funções no topo do arquivo.

- [ ] **Step 3: Confirmar que ninguém mais usa**

```bash
grep -rn "computeDelegatedPresenceSlots\|isTimeWithinShift" src
```

Esperado: nenhum resultado.

- [ ] **Step 4: Rodar a suíte inteira**

```bash
npm test
```

Esperado: PASS. Saem 10 testes (7 de presença cruzada, 3 de `isTimeWithinShift`)
e entram 12 novos de `dayAgenda`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dailyGoal.js src/lib/__tests__/dailyGoal.test.js
git commit -m "refactor(agenda): remove a presença cruzada por turno"
```

---

### Task 7: Verificação no app

**Files:** nenhum. Verificação manual guiada.

- [ ] **Step 1: Subir o preview**

Usar `preview_start` com o nome configurado em `.claude/launch.json` (porta
5180). Não subir servidor por `Bash`.

- [ ] **Step 2: Conferir console e rede**

Abrir a Meta Diária e ler o console. Esperado: nenhum `permission-denied` e
nenhum aviso de índice faltando. Se o Firestore pedir índice, o filtro virou
composto por engano — revisar a Task 3.

- [ ] **Step 3: Conferir o caminho que motivou a feature**

Agendar uma aula experimental para hoje num lead de outro consultor e confirmar
que a linha aparece na agenda **sem recarregar a página**, em qualquer horário,
independente de turno.

- [ ] **Step 4: Conferir o crédito**

Registrar presença numa linha que não é sua. Esperado: o toast nomeia o dono, e a
tarefa aparece como feita na Meta **do dono**, não na sua.

- [ ] **Step 5: Conferir o portão de atividade**

Confirmar que o `enabled` do `useDayAgenda` está ligado em `listenersActive`.
Esta é a regressão mais fácil de cometer no plano inteiro.

- [ ] **Step 6: Screenshot**

Tirar screenshot do card renderizado para anexar na PR.

---

## Pendências para a PR

- Invocar a skill `frontend-design` antes de dar o card por fechado e apresentar
  o resultado renderizado para o Johnny aprovar. O mockup foi aprovado, o render
  no app ainda não.
- Nenhuma regra do Firestore para publicar. Nenhum índice para criar.
- Descrever no corpo da PR que a regra de turno saiu e que os campos de turno em
  Configurações viraram informação, sem lógica pendurada.
