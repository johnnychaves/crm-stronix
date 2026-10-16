// Visitas e aulas experimentais (spec 2026-10-09, submenu 3): os agendamentos
// com data no período, quem veio, quem faltou, os que ficaram sem desfecho e os
// que ainda vão acontecer. Os registros e o status que vale saem da regra do
// painel CRM (appointmentRowsOf, com o effectiveStatus): sem os cancelados e
// sem os marcados a partir da primeira matrícula. O consultor é o dono de hoje
// do lead, como no painel. Puro.
//
// O painel conta, no mês em andamento, só os agendamentos de data já passada.
// O relatório vai até o fim do período, para mostrar os que ainda vão
// acontecer. Por isso, no mês fechado, todos os números são os do painel, e no
// mês em andamento Vieram, Faltaram, Sem desfecho e o comparecimento são os do
// painel, e Marcados soma também os que vão acontecer. O desfecho marcado
// antes da hora já conta aqui; o painel só o conta depois da hora.

import { monthKeyOf, monthRange } from '../../operacional/month.js';
import { AULA_STATUS, isAulaRecord } from '../../aulas.js';
import { appointmentRowsOf, isSoloTrainingRecord } from '../../crm/appointments.js';
import { SOLO_TRAINING_LABEL } from '../../professores.js';
import { crmDelta } from '../../crm/metrics.js';
import { pct, rankCounts } from '../../crm/stats.js';
import { reportIndex } from './janela.js';
import {
  reportScope, namesOf, cutCode, countRows, applyCut, cutLabelOf, contactCells, CONTACT_COLUMNS, fmtDateTime, apptsPartialOf,
} from './base.js';

// Os códigos dos números do topo, escritos uma vez só, como na Conversão.
const SITUACAO = Object.freeze({
  vieram: 'situacao:vieram',
  faltaram: 'situacao:faltaram',
  semDesfecho: 'situacao:sem-desfecho',
  aAcontecer: 'situacao:a-acontecer',
});

// Desfecho de cada agendamento: o recorte do número e o texto da lista.
const OUTCOME_CUT = Object.freeze({
  veio: SITUACAO.vieram,
  faltou: SITUACAO.faltaram,
  'sem-desfecho': SITUACAO.semDesfecho,
  'a-acontecer': SITUACAO.aAcontecer,
});
export const OUTCOME_LABEL = Object.freeze({ veio: 'Veio', faltou: 'Faltou', 'sem-desfecho': 'Sem desfecho', 'a-acontecer': 'A acontecer' });

export const TIPO_LABEL = Object.freeze({ visita: 'Visita', aula: 'Aula experimental' });
const TIPO_PLURAL = Object.freeze({ visita: 'Visitas', aula: 'Aulas experimentais' });

export const VISITAS_COLUMNS = Object.freeze([
  Object.freeze({ key: 'nome', label: 'Nome' }),
  ...CONTACT_COLUMNS,
  Object.freeze({ key: 'tipo', label: 'Tipo' }),
  Object.freeze({ key: 'diaHora', label: 'Dia e hora' }),
  Object.freeze({ key: 'unidade', label: 'Unidade' }),
  Object.freeze({ key: 'modalidade', label: 'Modalidade' }),
  Object.freeze({ key: 'professor', label: 'Professor' }),
  Object.freeze({ key: 'consultor', label: 'Consultor' }),
  Object.freeze({ key: 'desfecho', label: 'Desfecho' }),
]);

const SEM_BASE = Object.freeze({ none: true, text: 'sem base' });

// Até onde a lista vai: o fim do período (fullEnd), com os dias que ainda vão
// acontecer, mas nunca depois do fim do mês atual. Os meses que a tela carrega
// param no mês atual (reportMonthKeys), e pedir o mês seguinte deixaria na
// memória da sessão uma entrada de mês fechado para um mês que ainda vai
// abrir, que o shouldStoreMonthEntry não deixa trocar pela do mês aberto. Só a
// semana que atravessa o fim do mês perde os dias do mês seguinte.
export function visitasEndOf(period, now) {
  const monthEnd = monthRange(monthKeyOf(now)).end;
  return period.fullEnd < monthEnd ? period.fullEnd : monthEnd;
}

// O desfecho de um agendamento. O status que vale decide quem veio e quem
// faltou, mesmo marcado antes da hora (a Agenda de hoje deixa); sem desfecho, a
// data diz se ficou sem desfecho (já passou) ou se ainda vai acontecer.
function outcomeOf(status, at, now) {
  if (status === AULA_STATUS.ATTENDED) return 'veio';
  if (status === AULA_STATUS.NO_SHOW) return 'faltou';
  return at < now ? 'sem-desfecho' : 'a-acontecer';
}

// Os totais no formato do appts do painel, mais os que vão acontecer.
function totalsOf(list) {
  const by = (o) => list.filter((x) => x.outcome === o).length;
  const came = by('veio');
  const missed = by('faltou');
  return {
    total: list.length,
    came,
    missed,
    pending: by('sem-desfecho'),
    upcoming: by('a-acontecer'),
    decided: came + missed,
    rate: pct(came, came + missed),
  };
}

const tipoOf = (x) => (isAulaRecord(x.record) ? 'aula' : 'visita');
// Só a visita guarda a unidade, e só a aula guarda a modalidade e o professor
// (aulasWrites.js, schedulePatch.js e o agendamento pelo Stronizap).
const unitOf = (x) => String(x.record.unit || '').trim() || 'Sem unidade';
const modalityOf = (x) => String(x.record.modality || '').trim() || 'Sem modalidade';
const professorOf = (r) => (isSoloTrainingRecord(r) ? SOLO_TRAINING_LABEL : (r.professorName || 'Professor'));

// A aba Por professor (handoff dos Relatórios, §4): as aulas experimentais em
// que o lead veio, por professor, e quantos desses leads matricularam depois,
// pelo `converted` do registro (pickConvertingAula marca a última aula atendida
// antes da matrícula). A falta não depende do professor e não pesa contra ele.
// Quem treinou sozinho (isSoloTrainingRecord) é uma linha à parte, no fim. A
// linha sai das mesmas linhas da lista, e o recorte dela (professor:<id>, ou o
// SOLO_CUT) filtra a lista com a mesma regra, então a linha e a lista nunca
// discordam. O código do sozinho não leva o prefixo professor, porque o id do
// cadastro poderia ser qualquer texto, e o chip dele diz só "Treinou sozinho".
//
// É a conta do cartão de professores do painel (professorsOf, em
// src/lib/crm/appointments.js), com quatro diferenças, todas por ser a lista:
// - a barra vale (consultor, funil e origem); o painel conta a academia
//   inteira. Sem filtro, "Todos os funis" ainda deixa de fora Renovações,
//   Vencidos e Upgrade;
// - fica fora a aula com data na primeira matrícula do lead ou depois dela
//   (appointmentRowsOf), que o painel conta;
// - o professor que só teve falta no período não aparece, porque a linha conta
//   as aulas em que o lead veio; no painel ele aparece com zero realizadas;
// - a ordem é a mesma (conversão, aulas e nome), com quem treinou sozinho no fim.
// O relatoriosLeads.professor.test.js compara as duas contas.
export const SOLO_CUT = 'sozinho:sim';
export const SOLO_NAME = 'Treinou sozinho';
const professorCutOf = (r) => (isSoloTrainingRecord(r) ? SOLO_CUT : cutCode('professor', r.professorId));
const cameToAula = (x) => tipoOf(x) === 'aula' && x.outcome === 'veio';

export function professorRowsOf(list) {
  const map = new Map();
  list.filter(cameToAula).forEach((x) => {
    const r = x.record;
    const key = professorCutOf(r);
    const row = map.get(key) || { key, solo: key === SOLO_CUT, name: key === SOLO_CUT ? SOLO_NAME : (r.professorName || 'Professor'), leads: 0, enrolled: 0, mods: new Map() };
    row.leads += 1;
    if (r.converted === true) row.enrolled += 1;
    row.mods.set(modalityOf(x), (row.mods.get(modalityOf(x)) || 0) + 1);
    map.set(key, row);
  });
  return [...map.values()].map((row) => {
    const mods = rankCounts(row.mods);
    return { ...row, mods, conv: pct(row.enrolled, row.leads), ...(row.solo ? { note: 'sem professor' } : { channel: mods.map((m) => m.name).join(', ') }) };
  }).sort((a, b) => Number(a.solo) - Number(b.solo) || (b.conv ?? -1) - (a.conv ?? -1) || b.leads - a.leads || a.name.localeCompare(b.name, 'pt-BR'));
}

// Ordem da lista: a data, depois o nome e o id do registro.
const byDate = (a, b) => a.at - b.at || a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id);

export function visitasReport(ctx, { period, cmp = null, userIds = [], funnelId = null, origem = null, recorte = null }) {
  const scope = reportScope({ users: ctx.users, funnels: ctx.funnels, userIds, funnelId, origem });
  const names = namesOf(ctx);
  const index = reportIndex(ctx.months);
  const leadOf = (id) => ctx.leadsById?.get(id) || { id, unknown: true };
  const rowsIn = (start, end) => appointmentRowsOf(index.records, { start, end, leadOf, inScope: scope.inScope, visitOutcomes: index.visitOutcomes })
    .map((x) => ({ ...x, outcome: outcomeOf(x.status, x.record.scheduledFor, ctx.now) }));

  const window = { start: period.start, end: visitasEndOf(period, ctx.now) };
  const list = rowsIn(window.start, window.end);
  const totals = totalsOf(list);
  // O comparado vai até o mesmo ponto quando o período está em andamento (cmp.end).
  const before = cmp ? totalsOf(rowsIn(cmp.start, cmp.end)) : null;
  const partial = apptsPartialOf(period, cmp);
  const delta = (k, opts) => (before ? (partial ? SEM_BASE : crmDelta(totals[k], before[k], opts)) : null);

  // Com o período em andamento, Marcados soma os que ainda vão acontecer, e o
  // comparado cortado no mesmo ponto não tem esses: fica sem variação.
  const tiles = [
    { key: null, name: 'Marcados', value: totals.total, delta: period.running ? null : delta('total') },
    { key: SITUACAO.vieram, name: 'Vieram', value: totals.came, tone: 'good', delta: delta('came') },
    { key: SITUACAO.faltaram, name: 'Faltaram', value: totals.missed, tone: 'bad', delta: delta('missed'), lowerBetter: true },
    { key: SITUACAO.semDesfecho, name: 'Sem desfecho', value: totals.pending, delta: delta('pending'), lowerBetter: true },
    { key: SITUACAO.aAcontecer, name: 'A acontecer', value: totals.upcoming },
  ];
  const byType = countRows(list, tipoOf, (id) => TIPO_PLURAL[id], 'tipo');
  const byOwner = countRows(list, (x) => names.ownerKey(x.lead), names.ownerName, 'consultor', (id) => ({ note: names.ownerNote(id) }));
  const byUnit = countRows(list.filter((x) => tipoOf(x) === 'visita'), unitOf, (id) => id, 'unidade');
  const byModality = countRows(list.filter((x) => tipoOf(x) === 'aula'), modalityOf, (id) => id, 'modalidade');
  const byProfessor = professorRowsOf(list);

  const rows = list.map((x) => {
    const r = x.record;
    const aula = tipoOf(x) === 'aula';
    return {
      // A lista tem um agendamento por linha: o mesmo lead pode ter visita e aula no período.
      id: r.id,
      leadId: r.leadId,
      lead: x.lead,
      name: x.lead.name || r.leadName || 'Sem nome',
      type: TIPO_LABEL[tipoOf(x)],
      at: r.scheduledFor,
      unit: aula ? null : unitOf(x),
      modality: aula ? modalityOf(x) : null,
      professor: aula ? professorOf(r) : null,
      owner: names.ownerLabel(x.lead),
      outcome: x.outcome,
      cuts: [
        OUTCOME_CUT[x.outcome],
        cutCode('tipo', tipoOf(x)),
        cutCode('consultor', names.ownerKey(x.lead)),
        aula ? cutCode('modalidade', modalityOf(x)) : cutCode('unidade', unitOf(x)),
        ...(cameToAula(x) ? [professorCutOf(r)] : []),
      ],
    };
  }).sort(byDate);

  const items = [...tiles.filter((t) => t.key), ...byType, ...byOwner, ...byUnit, ...byModality, ...byProfessor];
  const { cut, rows: visible } = applyCut(rows, recorte, new Set(items.map((i) => i.key)));

  return {
    totals,
    before,
    running: period.running,
    window,
    attendance: { value: totals.rate, delta: delta('rate', { kind: 'pp' }) },
    tiles,
    byType,
    byOwner,
    byUnit,
    byModality,
    byProfessor,
    cut,
    cutLabel: cut ? cutLabelOf(cut, items) : null,
    rows: visible,
    exportColumns: VISITAS_COLUMNS,
    exportRows: visible.map((r) => ({
      nome: r.name,
      ...contactCells(r.lead, ctx.now),
      tipo: r.type,
      diaHora: fmtDateTime(r.at),
      unidade: r.unit ?? '',
      modalidade: r.modality ?? '',
      professor: r.professor ?? '',
      consultor: r.owner,
      desfecho: OUTCOME_LABEL[r.outcome],
    })),
  };
}
