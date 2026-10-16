// Perdas (spec 2026-10-09, submenu 4): os leads com a data da perda no período,
// por motivo, pela etapa em que se perderam, por origem e por consultor. As
// perdas saem da regra do painel CRM (lossesOf: quem está em Perda hoje e não é
// cliente) e a etapa, do lossStageOf, a conta do card de perdas lead por lead.
// No mês inteiro, os números são os do painel. Filtrar um motivo e exportar dá a
// lista de repescagem. Puro.
//
// Até o PR 4 da entrega A, a perda não é guardada como fato: quem volta ao
// funil ou matricula perde a data e o motivo da perda (planStageMove, em
// stageMove.js, e commitMatricula, em contractsWrites.js, apagam lostAt e
// lossReason) e sai desta conta. A tela diz isso num aviso fixo.

import { calendarDaysBetween } from '../../dates.js';
import { STAGE_TRACKING_SINCE } from '../../crm/scope.js';
import { lossesOf, lossReasonOf, lostAtOf } from '../../crm/cohort.js';
import { lossStageOf } from '../../crm/stages.js';
import { crmDelta } from '../../crm/metrics.js';
import { reportIndex } from './janela.js';
import {
  reportScope, freshLeadsOf, namesOf, cutCode, countRows, applyCut, cutLabelOf, contactCells, CONTACT_COLUMNS, fmtDate,
} from './base.js';

export const PERDAS_COLUMNS = Object.freeze([
  Object.freeze({ key: 'nome', label: 'Nome' }),
  ...CONTACT_COLUMNS,
  Object.freeze({ key: 'motivo', label: 'Motivo' }),
  Object.freeze({ key: 'etapa', label: 'Etapa' }),
  Object.freeze({ key: 'dataPerda', label: 'Data da perda' }),
  Object.freeze({ key: 'diasPerda', label: 'Dias desde a perda' }),
  Object.freeze({ key: 'origem', label: 'Origem' }),
  Object.freeze({ key: 'consultor', label: 'Consultor' }),
]);

// Quanto do período tem a etapa da perda (STAGE_TRACKING_SINCE, 14/09/2026):
// 'none' quando ele acaba antes disso, 'partial' quando começa antes e acaba
// depois, e 'full' quando começa depois. No parcial, as perdas de antes ficam em
// "Sem etapa", como no card do painel, e o motivo e a etapa somam o mesmo total.
export function stageBaseOf(period) {
  if (period.end <= STAGE_TRACKING_SINCE) return 'none';
  return period.start < STAGE_TRACKING_SINCE ? 'partial' : 'full';
}

// O que a etapa diz quando o período não tem base nenhuma: o cartão da tela, a
// linha da lista e a planilha usam este texto, para não dizerem coisas
// diferentes ("Sem base" no cartão e "Sem etapa" na linha). No parcial, o
// "Sem etapa" é o do card do painel (lossStageOf), e a tela o mostra como está.
export const STAGE_NO_BASE_TEXT = 'Sem base';

// Ordem da lista: a perda mais recente primeiro, depois o nome e o id.
const byLatestLoss = (a, b) => (b.lostAt?.getTime?.() ?? 0) - (a.lostAt?.getTime?.() ?? 0)
  || a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id);

export function perdasReport(ctx, { period, cmp = null, userIds = [], funnelId = null, origem = null, recorte = null }) {
  const scope = reportScope({ users: ctx.users, funnels: ctx.funnels, userIds, funnelId, origem });
  const names = namesOf(ctx);
  const index = reportIndex(ctx.months);
  const lostIn = ({ start, end }) => lossesOf(freshLeadsOf(ctx, 'lost'), { start, end, inScope: scope.inScope }).leads;
  const leads = lostIn(period);
  const before = cmp ? lostIn(cmp).length : null;
  const stageBase = stageBaseOf(period);
  const stageOf = (l) => (stageBase === 'none'
    ? STAGE_NO_BASE_TEXT
    : lossStageOf(l, { moves: index.moves, start: period.start, end: period.end }));

  const byReason = countRows(leads, lossReasonOf, (id) => id, 'motivo');
  const byStage = stageBase === 'none' ? [] : countRows(leads, stageOf, (id) => id, 'etapa');
  const bySource = countRows(leads, names.sourceName, (id) => id, 'origem');
  const byOwner = countRows(leads, names.ownerKey, names.ownerName, 'consultor', (id) => ({ note: names.ownerNote(id) }));

  const rows = leads.map((l) => {
    const lostAt = lostAtOf(l);
    return {
      id: l.id,
      lead: l,
      name: l.name || 'Sem nome',
      reason: lossReasonOf(l),
      stage: stageOf(l),
      lostAt,
      days: calendarDaysBetween(lostAt, ctx.now),
      source: names.sourceName(l),
      owner: names.ownerLabel(l),
      cuts: [
        cutCode('motivo', lossReasonOf(l)),
        cutCode('etapa', stageOf(l)),
        cutCode('origem', names.sourceName(l)),
        cutCode('consultor', names.ownerKey(l)),
      ],
    };
  }).sort(byLatestLoss);

  const items = [...byReason, ...byStage, ...bySource, ...byOwner];
  const { cut, rows: visible } = applyCut(rows, recorte, new Set(items.map((i) => i.key)));

  return {
    total: leads.length,
    delta: before === null ? null : crmDelta(leads.length, before),
    stageBase,
    byReason,
    byStage,
    bySource,
    byOwner,
    cut,
    cutLabel: cut ? cutLabelOf(cut, items) : null,
    rows: visible,
    exportColumns: PERDAS_COLUMNS,
    exportRows: visible.map((r) => ({
      nome: r.name,
      ...contactCells(r.lead, ctx.now),
      motivo: r.reason,
      etapa: r.stage,
      dataPerda: fmtDate(r.lostAt),
      diasPerda: r.days ?? '',
      origem: r.source,
      consultor: r.owner,
    })),
  };
}
