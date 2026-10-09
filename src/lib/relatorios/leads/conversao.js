// Conversão (spec 2026-10-09, submenu 2): dos leads que chegaram no período (a
// safra), quantos agendaram, vieram, matricularam, se perderam ou seguem em
// aberto, acompanhados até agora. As contas são as do painel CRM, lead por
// lead: outcomeAt para o desfecho, cohortMilestoneOf para agendou e veio e
// firstContactMinutesOf para o primeiro contato. No mês inteiro, os números
// são os do painel. Puro.

import { addMonthsToKey, monthKeyOf, monthRange } from '../../operacional/month.js';
import { outcomeAt, firstEnrolledAtOf, lostAtOf } from '../../crm/cohort.js';
import { cohortMilestoneOf } from '../../crm/appointments.js';
import { firstContactMinutesOf, FIRST_CONTACT_LIMITS } from '../../crm/contact.js';
import { crmDelta } from '../../crm/metrics.js';
import { pct } from '../../crm/stats.js';
import { fmtDuration } from '../../crm/format.js';
import { reportIndex } from './janela.js';
import {
  reportScope, newLeadsIn, namesOf, cutCode, applyCut, cutLabelOf, contactCells, CONTACT_COLUMNS, fmtDate, byNewest,
} from './base.js';

// Faixas da rapidez do primeiro contato, as do painel (firstContactOf), com os
// limites e os nomes dele.
export const SPEED_BUCKETS = Object.freeze([
  Object.freeze({ id: 'ate-1h', label: 'Até 1 hora', test: (m) => m != null && m <= FIRST_CONTACT_LIMITS.h1 }),
  Object.freeze({
    id: 'ate-24h',
    label: 'Até 24 horas',
    test: (m) => m != null && m > FIRST_CONTACT_LIMITS.h1 && m <= FIRST_CONTACT_LIMITS.h24,
  }),
  Object.freeze({ id: 'mais-24h', label: 'Mais de 24 horas', test: (m) => m != null && m > FIRST_CONTACT_LIMITS.h24 }),
  Object.freeze({ id: 'sem-contato', label: 'Sem contato', test: (m) => m == null }),
]);

// Os códigos de recorte dos números do topo, escritos uma vez só. O número, o
// desfecho e a linha da lista saem daqui, então um erro de digitação não faz um
// número filtrar para uma lista vazia.
const SITUACAO = Object.freeze({
  agendaram: 'situacao:agendaram',
  vieram: 'situacao:vieram',
  matricularam: 'situacao:matricularam',
  perderam: 'situacao:perderam',
  emAberto: 'situacao:em-aberto',
});

// Recorte e texto de cada desfecho.
const OUTCOME_CUT = Object.freeze({
  enrolled: SITUACAO.matricularam,
  lost: SITUACAO.perderam,
  open: SITUACAO.emAberto,
});
export const OUTCOME_LABEL = Object.freeze({ enrolled: 'Matriculou', lost: 'Perdeu', open: 'Em aberto' });

export const CONVERSAO_COLUMNS = Object.freeze([
  Object.freeze({ key: 'nome', label: 'Nome' }),
  ...CONTACT_COLUMNS,
  Object.freeze({ key: 'origem', label: 'Origem' }),
  Object.freeze({ key: 'consultor', label: 'Consultor' }),
  Object.freeze({ key: 'cadastro', label: 'Cadastro' }),
  Object.freeze({ key: 'primeiroContato', label: 'Primeiro contato' }),
  Object.freeze({ key: 'tempoPrimeiroContato', label: 'Tempo até o primeiro contato' }),
  Object.freeze({ key: 'agendou', label: 'Agendou' }),
  Object.freeze({ key: 'veio', label: 'Veio' }),
  Object.freeze({ key: 'desfecho', label: 'Desfecho' }),
  Object.freeze({ key: 'dataDesfecho', label: 'Data do desfecho' }),
]);

// O primeiro contato olha até o fim do mês seguinte ao do cadastro de cada
// lead, ou até o instante da safra, o que vier antes (a regra do painel).
const contactLimitOf = (lead, asOf) => Math.min(
  asOf.getTime(),
  monthRange(addMonthsToKey(monthKeyOf(lead.createdAt), 1)).end.getTime(),
);

// A safra da janela, lead por lead, no instante asOf. O corte vale quando a
// safra é acompanhada até antes de agora (o comparado do período em
// andamento): aí o agendamento em aberto no próprio lead não conta.
function cohortOf(ctx, scope, index, win, asOf) {
  const cut = asOf.getTime() < ctx.now.getTime();
  return newLeadsIn(ctx, scope, win).map((l) => {
    const m = cohortMilestoneOf(l, { asOf, cut, recordsByLead: index.recordsByLead, visitOutcomes: index.visitOutcomes });
    return {
      lead: l,
      outcome: outcomeAt(l, asOf),
      booked: m.booked,
      attended: m.attended,
      minutes: firstContactMinutesOf(l, { contactTimes: index.contactTimes, limit: contactLimitOf(l, asOf) }),
    };
  });
}

function totalsOf(list) {
  const leads = list.length;
  const enrolled = list.filter((x) => x.outcome === 'enrolled').length;
  const lost = list.filter((x) => x.outcome === 'lost').length;
  return {
    leads,
    sched: list.filter((x) => x.booked).length,
    came: list.filter((x) => x.attended).length,
    enrolled,
    lost,
    open: leads - enrolled - lost,
    conv: pct(enrolled, leads),
  };
}

// Recorte com leads, matrículas e conversão, na ordem do channelsOf do painel:
// mais leads primeiro, no empate mais matrículas, e depois o nome.
function convRows(list, keyOf, nameOf, tipo) {
  const map = new Map();
  list.forEach((x) => {
    const id = keyOf(x.lead);
    const row = map.get(id) || { key: cutCode(tipo, id), id, name: nameOf(id), leads: 0, enrolled: 0 };
    row.leads += 1;
    if (x.outcome === 'enrolled') row.enrolled += 1;
    map.set(id, row);
  });
  return [...map.values()]
    .map((r) => ({ ...r, conv: pct(r.enrolled, r.leads) }))
    .sort((a, b) => b.leads - a.leads || b.enrolled - a.enrolled || a.name.localeCompare(b.name, 'pt-BR'));
}

export function conversaoReport(ctx, { period, cmp = null, userIds = [], funnelId = null, origem = null, recorte = null }) {
  const scope = reportScope({ users: ctx.users, funnels: ctx.funnels, userIds, funnelId, origem });
  const names = namesOf(ctx);
  const index = reportIndex(ctx.months);
  const list = cohortOf(ctx, scope, index, period, ctx.now);
  const totals = totalsOf(list);
  // O comparado é acompanhado até o mesmo ponto quando o período está em
  // andamento, e até agora quando o período já fechou, como no painel.
  const before = cmp ? totalsOf(cohortOf(ctx, scope, index, cmp, period.running ? cmp.end : ctx.now)) : null;
  const delta = (k) => (before ? crmDelta(totals[k], before[k]) : null);

  const tiles = [
    { key: null, name: 'Leads da safra', value: totals.leads, delta: delta('leads') },
    { key: SITUACAO.agendaram, name: 'Agendaram', value: totals.sched, delta: delta('sched') },
    { key: SITUACAO.vieram, name: 'Vieram', value: totals.came, delta: delta('came') },
    { key: SITUACAO.matricularam, name: 'Matricularam', value: totals.enrolled, tone: 'good', delta: delta('enrolled') },
    { key: SITUACAO.perderam, name: 'Perderam', value: totals.lost, tone: 'bad', delta: delta('lost'), lowerBetter: true },
    { key: SITUACAO.emAberto, name: 'Em aberto', value: totals.open },
  ];
  const bySource = convRows(list, names.sourceName, (id) => id, 'origem');
  const byOwner = convRows(list, names.ownerKey, names.ownerName, 'consultor');
  const bySpeed = SPEED_BUCKETS.map((b) => {
    const inIt = list.filter((x) => b.test(x.minutes));
    const enrolled = inIt.filter((x) => x.outcome === 'enrolled').length;
    return { key: cutCode('faixa', b.id), id: b.id, name: b.label, leads: inIt.length, enrolled, conv: pct(enrolled, inIt.length) };
  });

  const rows = list.map((x) => {
    const l = x.lead;
    const speed = SPEED_BUCKETS.find((b) => b.test(x.minutes));
    const cuts = [
      OUTCOME_CUT[x.outcome],
      cutCode('origem', names.sourceName(l)),
      cutCode('consultor', names.ownerKey(l)),
      cutCode('faixa', speed.id),
    ];
    if (x.booked) cuts.push(SITUACAO.agendaram);
    if (x.attended) cuts.push(SITUACAO.vieram);
    return {
      id: l.id,
      lead: l,
      name: l.name || 'Sem nome',
      source: names.sourceName(l),
      owner: names.ownerLabel(l),
      createdAt: l.createdAt,
      firstContactAt: x.minutes == null ? null : new Date(l.createdAt.getTime() + x.minutes * 60000),
      firstContactMin: x.minutes,
      booked: x.booked,
      attended: x.attended,
      outcome: x.outcome,
      outcomeAt: x.outcome === 'enrolled' ? firstEnrolledAtOf(l) : x.outcome === 'lost' ? lostAtOf(l) : null,
      cuts,
    };
  }).sort(byNewest);

  const items = [...tiles.filter((t) => t.key), ...bySource, ...byOwner, ...bySpeed];
  const { cut, rows: visible } = applyCut(rows, recorte, new Set(items.map((i) => i.key)));

  return {
    totals,
    before,
    conversion: { value: totals.conv, delta: before ? crmDelta(totals.conv, before.conv, { kind: 'pp' }) : null },
    tiles,
    bySource,
    byOwner,
    bySpeed,
    cut,
    cutLabel: cut ? cutLabelOf(cut, items) : null,
    rows: visible,
    exportColumns: CONVERSAO_COLUMNS,
    exportRows: visible.map((r) => ({
      nome: r.name,
      ...contactCells(r.lead, ctx.now),
      origem: r.source,
      consultor: r.owner,
      cadastro: fmtDate(r.createdAt),
      primeiroContato: fmtDate(r.firstContactAt),
      tempoPrimeiroContato: r.firstContactMin == null ? '' : fmtDuration(r.firstContactMin),
      agendou: r.booked ? 'Sim' : 'Não',
      veio: r.attended ? 'Sim' : 'Não',
      desfecho: OUTCOME_LABEL[r.outcome],
      dataDesfecho: fmtDate(r.outcomeAt),
    })),
  };
}
