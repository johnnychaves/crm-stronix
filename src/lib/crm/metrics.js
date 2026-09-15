// Dashboard CRM: uma função calcula tudo (README do handoff §6). O mês
// exibido, o comparado, cada ponto de tendência e cada linha da tabela chamam
// metricsOf. A fonte é sempre o detalhe; nenhuma taxa nem mediana é guardada.
//
// ctx = { now, users, funnels, statuses, liveLeads, leadsById, months }
//   months[chave] = { interactions, leadsCreated, converted, lost, aulas, failed? }
//   leadsById = a versão mais nova de cada lead conhecido (useCrmSources).

import { fmtNum } from '../format.js';
import { monthRange, effectiveEnd, isCurrentMonthKey, addMonthsToKey } from '../operacional/month.js';
import { pct } from './stats.js';
import { fmtDuration, fmtDays } from './format.js';
import { OTHERS_ID, STAGE_TRACKING_MONTH, APPTS_COMPLETE_MONTH, makeScope, leadFunnelsOf, funnelStagesOf } from './scope.js';
import { newLeadsOf, enrollmentsOf, lossesOf, outcomeAt, channelsOf, daysToEnrollOf } from './cohort.js';
import { appointmentsOf, recordsByLeadOf, cohortMilestones, professorsOf, visitOutcomesByLead } from './appointments.js';
import { contactTimesByLead, firstContactOf } from './contact.js';
import { movesByLead, stagePassageOf, lossStagesOf, pipelineNowOf } from './stages.js';

export { OTHERS_ID };

// Índices de toda a carga, por ctx (WeakMap: ctx novo, cache novo). Um
// desenho da tela chama metricsOf dezenas de vezes; o resultado fica guardado
// por mês, pessoa, funil e corte, e é compartilhado: não mutar. Trocar um
// insumo no mesmo objeto de ctx zera o cache.
const caches = new WeakMap();

function cacheOf(ctx) {
  const sig = [ctx.now?.getTime(), ctx.users, ctx.funnels, ctx.statuses, ctx.liveLeads, ctx.leadsById, ctx.months];
  let cache = caches.get(ctx);
  if (!cache || cache.sig.some((v, i) => v !== sig[i])) {
    const loaded = Object.values(ctx.months || {});
    const interactions = loaded.flatMap((m) => m.interactions || []);
    cache = {
      sig,
      results: new Map(),
      professors: new Map(),
      moves: movesByLead(interactions),
      contactTimes: contactTimesByLead(interactions),
      visitOutcomes: visitOutcomesByLead(interactions),
      recordsByLead: recordsByLeadOf(loaded.flatMap((m) => m.aulas || [])),
      leadFunnels: leadFunnelsOf(ctx.funnels)
    };
    caches.set(ctx, cache);
  }
  return cache;
}

export function metricsOf(ctx, { monthKey, userId = null, funnelId = null, cutEnd = null }) {
  const cache = cacheOf(ctx);
  const key = `${monthKey}|${userId ?? ''}|${funnelId ?? ''}|${cutEnd?.getTime() ?? ''}`;
  const hit = cache.results.get(key);
  if (hit) return hit;
  const value = computeMetrics(ctx, cache, { monthKey, userId, funnelId, cutEnd });
  cache.results.set(key, value);
  return value;
}

// Professores: da academia inteira, iguais para qualquer pessoa e funil.
function professorsOfMonth(cache, src, { monthKey, start, end }) {
  if (!src) return null;
  const key = `${monthKey}|${end.getTime()}`;
  if (!cache.professors.has(key)) cache.professors.set(key, professorsOf(src.aulas, { start, end }));
  return cache.professors.get(key);
}

function computeMetrics(ctx, cache, { monthKey, userId, funnelId, cutEnd }) {
  const { start, end: monthEnd } = monthRange(monthKey);
  const end = cutEnd || effectiveEnd(monthKey, ctx.now);
  const asOf = end < monthEnd ? end : ctx.now;
  const running = isCurrentMonthKey(monthKey, ctx.now);
  const src = ctx.months?.[monthKey] || null;
  const scope = makeScope({ users: ctx.users, funnels: ctx.funnels, userId, funnelId });
  const stageBase = monthKey >= STAGE_TRACKING_MONTH;
  const base = {
    monthKey,
    running,
    start,
    end,
    asOf,
    hasSource: Boolean(src),
    failed: Boolean(src?.failed),
    apptsBase: monthKey >= APPTS_COMPLETE_MONTH,
    stageBase,
    professors: professorsOfMonth(cache, src, { monthKey, start, end }),
    // Retrato de agora: só no mês em andamento e sem corte.
    now: running && !cutEnd ? pipelineNowOf(ctx.liveLeads, {
      funnelId,
      funnels: cache.leadFunnels,
      defaultFunnelId: scope.defaultFunnelId,
      stages: funnelId ? funnelStagesOf(ctx.statuses, funnelId, scope.defaultFunnelId) : [],
      ownerOk: scope.ownerOk,
      funnelOk: scope.funnelOk
    }) : null
  };
  if (!src) {
    return {
      ...base, leads: null, channels: [], appts: null, enroll: null, fromCohort: null, cohort: null,
      losses: null, lossStages: null, firstContact: null, daysToEnroll: null, passage: null
    };
  }

  const leadOf = (id) => ctx.leadsById?.get(id) || { id, unknown: true };
  const fresh = (list) => (list || []).map((l) => ctx.leadsById?.get(l.id) || l);
  const cohortLeads = newLeadsOf(fresh(src.leadsCreated), { start, end, inScope: scope.inScope });
  const cohortIds = new Set(cohortLeads.map((l) => l.id));
  const enrollments = enrollmentsOf(fresh(src.converted), { start, end, inScope: scope.inScope });
  const outcomes = cohortLeads.map((l) => outcomeAt(l, asOf));
  const enrolled = outcomes.filter((o) => o === 'enrolled').length;
  const lost = outcomes.filter((o) => o === 'lost').length;
  const miles = cohortMilestones(cohortLeads, {
    asOf, cut: Boolean(cutEnd), recordsByLead: cache.recordsByLead, visitOutcomes: cache.visitOutcomes
  });
  // O primeiro contato olha o mês do cadastro e o seguinte, até o corte.
  const limit = Math.min(asOf.getTime(), monthRange(addMonthsToKey(monthKey, 1)).end.getTime());

  return {
    ...base,
    leads: cohortLeads.length,
    channels: channelsOf(cohortLeads, asOf),
    appts: appointmentsOf(src.aulas, { start, end, leadOf, inScope: scope.inScope, visitOutcomes: cache.visitOutcomes }),
    enroll: enrollments.length,
    fromCohort: enrollments.filter((l) => cohortIds.has(l.id)).length,
    cohort: {
      leads: cohortLeads.length,
      sched: miles.sched,
      came: miles.came,
      enrolled,
      lost,
      open: cohortLeads.length - enrolled - lost,
      conv: pct(enrolled, cohortLeads.length)
    },
    losses: lossesOf(fresh(src.lost), { start, end, inScope: scope.inScope }),
    lossStages: stageBase ? lossStagesOf({ moves: cache.moves, start, end, inScope: scope.inScope, leadOf }) : null,
    firstContact: firstContactOf(cohortLeads, { contactTimes: cache.contactTimes, limit }),
    daysToEnroll: daysToEnrollOf(enrollments),
    passage: funnelId && stageBase ? stagePassageOf({
      moves: cache.moves,
      funnelId,
      defaultFunnelId: scope.defaultFunnelId,
      stages: funnelStagesOf(ctx.statuses, funnelId, scope.defaultFunnelId),
      start,
      end,
      asOf,
      ownerOk: scope.ownerOk,
      leadOf
    }) : null
  };
}

const comma = (v) => String(v).replace('.', ',');
const ZERO = { pct: '0%', pp: '0 p.p.', min: '0 min', days: '0 dias' };

// Diferença entre o mês e o comparado no formato do handoff: contagem em %
// ("12,5%"), taxa em pontos ("+8 p.p."), duração ("40 min") e dias ("1,5
// dias"). Sem um dos lados, ou contagem comparada com zero: "sem base".
export function crmDelta(cur, prev, { kind = 'pct' } = {}) {
  if (cur == null || prev == null) return { none: true, text: 'sem base' };
  if (kind === 'pct' && prev === 0) return { none: true, text: 'sem base' };
  const diff = kind === 'pct' ? ((cur - prev) / prev) * 100 : cur - prev;
  if (Math.abs(diff) < 0.05) return { flat: true, value: 0, text: `= ${ZERO[kind]}` };
  const abs = Math.abs(diff);
  let text;
  if (kind === 'pct') text = `${comma(Math.round(abs * 10) / 10)}%`;
  else if (kind === 'pp') text = `${diff > 0 ? '+' : '−'}${comma(Math.round(abs * 10) / 10)} p.p.`;
  else if (kind === 'min') text = fmtDuration(abs);
  else text = fmtDays(abs);
  return { up: diff > 0, value: diff, text };
}

// O canal de melhor conversão da safra, entre os que trouxeram ao menos 5
// leads: com menos, uma matrícula decide a taxa.
export function bestChannelOf(m) {
  return (m?.channels || [])
    .map((c) => ({ ...c, conv: pct(c.enrolled, c.leads) }))
    .filter((c) => c.leads >= 5 && c.conv != null)
    .sort((a, b) => b.conv - a.conv || b.leads - a.leads)[0] || null;
}

// Destaques (Decisão 1 do plano): os leads que passaram de 24 horas sem
// primeiro contato e o canal de melhor conversão, cada um contra o mês
// comparado. Só entra o que tem base dos dois lados. `rank` ordena o
// carrossel do celular com o pior primeiro.
export function buildCrmHighlights(cur, cmp, { cmpName }) {
  if (!cur?.hasSource || !cmp?.hasSource) return [];
  const out = [];
  const add = (text, delta, lowerBetter) => {
    if (!delta || delta.none) return;
    const tone = delta.flat ? 'flat' : (delta.up !== lowerBetter ? 'good' : 'bad');
    out.push({
      text,
      delta: delta.flat ? delta.text : `${delta.up ? '▲' : '▼'} ${delta.text}`,
      tone,
      verdict: tone === 'good' ? `melhor que ${cmpName}` : tone === 'bad' ? `pior que ${cmpName}` : `igual a ${cmpName}`,
      rank: tone === 'bad' ? 0 : tone === 'flat' ? 1 : 2
    });
  };
  const fc = cur.firstContact;
  const pfc = cmp.firstContact;
  if (fc?.total > 0 && pfc) {
    const late = fc.over + fc.none;
    add(
      `${fmtNum(late)} dos ${fmtNum(fc.total)} leads ${late === 1 ? 'passou' : 'passaram'} de 24 horas sem primeiro contato`,
      crmDelta(late, pfc.over + pfc.none, { kind: 'pct' }),
      true
    );
  }
  const best = bestChannelOf(cur);
  if (best) {
    const prev = (cmp.channels || []).find((c) => c.name === best.name);
    add(
      `${best.name} converteu ${best.conv}%, a melhor taxa entre os canais`,
      crmDelta(best.conv, prev ? pct(prev.enrolled, prev.leads) : null, { kind: 'pp' }),
      false
    );
  }
  return out;
}

// Tendência dos `months` meses até o exibido. Mês sem valor fica fora. Nos
// números de agendamento, os meses antes de agosto de 2026 também saem
// (histórico incompleto), e a série encurta.
export function seriesOf(ctx, { monthKey, userId = null, funnelId = null, pick, months = 6, apptsBased = false }) {
  const keys = [];
  for (let i = months - 1; i >= 0; i--) keys.push(addMonthsToKey(monthKey, -i));
  return keys
    .filter((key) => !apptsBased || key >= APPTS_COMPLETE_MONTH)
    .map((key) => ({ key, value: pick(metricsOf(ctx, { monthKey: key, userId, funnelId })) }))
    .filter((p) => p.value != null);
}
