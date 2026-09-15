// Dashboard CRM: uma função calcula tudo (README do handoff §6). O mês
// exibido, o comparado, cada ponto de tendência e cada linha da tabela chamam
// metricsOf. A fonte é sempre o detalhe; nenhuma taxa nem mediana é guardada.
//
// ctx = { now, users, funnels, statuses, liveLeads, leadsById, months }
//   months[chave] = { interactions, leadsCreated, converted, lost, aulas, failed? }
//   leadsById = a versão mais nova de cada lead conhecido (useCrmSources).

import { fmtNum } from '../format.js';
import { monthRange, effectiveEnd, isCurrentMonthKey, addMonthsToKey, monthKeyOf } from '../operacional/month.js';
import { pct } from './stats.js';
import { fmtDuration, fmtDays } from './format.js';
import {
  OTHERS_ID, STAGE_TRACKING_MONTH, STAGE_TRACKING_SINCE, APPTS_COMPLETE_MONTH, makeScope, leadFunnelsOf, funnelStagesOf
} from './scope.js';
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

// Registros de agendamento de todos os meses carregados, sem repetir id, com a
// cópia do mês mais novo. O registro remarcado de 30/08 para 03/09 continua na
// lista de agosto (memória da sessão ou cache do aparelho) e contaria nos dois
// meses. Com a cópia mais nova, a janela por scheduledFor põe cada registro no
// mês da data atual.
function newestRecordsOf(months) {
  const seen = new Set();
  const out = [];
  Object.keys(months || {}).sort().reverse().forEach((key) => {
    (months[key]?.aulas || []).forEach((r) => {
      if (!r?.id || seen.has(r.id)) return;
      seen.add(r.id);
      out.push(r);
    });
  });
  return out;
}

// Começo seguro da passagem pelo cadastro: o início da sequência contínua de
// meses carregados e sem falha que termina no mês corrente, andando para trás
// a partir dele. Quem foi cadastrado a partir desse instante tem todas as
// trocas de etapa nos meses carregados, então a primeira troca carregada é
// mesmo a primeira da vida dele. Quem foi cadastrado antes pode ter trocado de
// etapa num mês fora da carga: o comparado de 8 a 12 meses atrás entra só com
// o mês seguinte a ele, e a partir de 2027 o mês mais antigo carregado passa
// de setembro de 2026. Mês corrente ausente ou que falhou: a sequência fica
// vazia e o início é o fim do mês corrente, que não deixa ninguém entrar pelo
// cadastro.
export function loadedRunStart(months, currentKey) {
  const limit = Object.keys(months || {}).length;
  let first = null;
  let key = currentKey;
  for (let i = 0; i < limit && months[key] && !months[key].failed; i++) {
    first = key;
    key = addMonthsToKey(key, -1);
  }
  return first ? monthRange(first).start : monthRange(currentKey).end;
}

function cacheOf(ctx) {
  const sig = [ctx.now?.getTime(), ctx.users, ctx.funnels, ctx.statuses, ctx.liveLeads, ctx.leadsById, ctx.months];
  let cache = caches.get(ctx);
  if (!cache || cache.sig.some((v, i) => v !== sig[i])) {
    const loaded = Object.values(ctx.months || {});
    const interactions = loaded.flatMap((m) => m.interactions || []);
    const records = newestRecordsOf(ctx.months);
    cache = {
      sig,
      results: new Map(),
      professors: new Map(),
      moves: movesByLead(interactions),
      contactTimes: contactTimesByLead(interactions),
      visitOutcomes: visitOutcomesByLead(interactions),
      records,
      recordsByLead: recordsByLeadOf(records),
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

// Professores: da academia inteira, iguais para qualquer pessoa e funil. Os
// registros são os de todos os meses carregados, com a cópia mais nova de cada
// um; a janela por scheduledFor escolhe os do mês.
function professorsOfMonth(cache, src, { monthKey, start, end }) {
  if (!src || src.failed) return null;
  const key = `${monthKey}|${end.getTime()}`;
  if (!cache.professors.has(key)) cache.professors.set(key, professorsOf(cache.records, { start, end }));
  return cache.professors.get(key);
}

function computeMetrics(ctx, cache, { monthKey, userId, funnelId, cutEnd }) {
  const { start, end: monthEnd } = monthRange(monthKey);
  const end = cutEnd || effectiveEnd(monthKey, ctx.now);
  // Com corte (comparado de um mês em andamento), a safra é acompanhada até o
  // corte, mesmo quando ele cai no fim do mês comparado (dia 31 contra mês de
  // 30 dias, ou outubro contra fevereiro). Sem corte, até o fim efetivo ou
  // agora. A tela passa o corte só quando o mês exibido está em andamento.
  const asOf = cutEnd ? cutEnd : (end < monthEnd ? end : ctx.now);
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
      funnelOk: scope.funnelOk,
      now: ctx.now
    }) : null
  };
  // Mês sem fonte, ou que falhou em todas as tentativas: sem número. O que
  // falhou segue com fonte (a tela não fica esperando) e marcado, para a tela
  // mostrar "—" com o aviso em vez de zeros; a tendência pula ele.
  if (!src || src.failed) {
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
  // O espelho do lead é o retrato de agora: vale só quando a safra vai até
  // agora. O corte sai do instante, e não do fim < fim do mês, que no mês em
  // andamento daria corte e tiraria o agendamento em aberto.
  const miles = cohortMilestones(cohortLeads, {
    asOf, cut: asOf.getTime() < ctx.now.getTime(), recordsByLead: cache.recordsByLead, visitOutcomes: cache.visitOutcomes
  });
  // O primeiro contato olha o mês do cadastro e o seguinte, até o corte. Se a
  // safra passa do fim do mês e o seguinte não carregou ou falhou, fica sem
  // número em vez de menor.
  const limit = Math.min(asOf.getTime(), monthRange(addMonthsToKey(monthKey, 1)).end.getTime());
  const nextSrc = ctx.months?.[addMonthsToKey(monthKey, 1)];
  const contactOk = asOf.getTime() <= monthEnd.getTime() || Boolean(nextSrc && !nextSrc.failed);
  const losses = lossesOf(fresh(src.lost), { start, end, inScope: scope.inScope });
  // A entrada pelo cadastro e a mediana desde o cadastro valem para quem foi
  // cadastrado depois do início do registro das trocas e dentro dos meses
  // carregados que chegam ao mês corrente (loadedRunStart).
  const runStart = loadedRunStart(ctx.months, monthKeyOf(ctx.now));
  const trackingSince = runStart > STAGE_TRACKING_SINCE ? runStart : STAGE_TRACKING_SINCE;

  return {
    ...base,
    leads: cohortLeads.length,
    channels: channelsOf(cohortLeads, asOf),
    appts: appointmentsOf(cache.records, { start, end, leadOf, inScope: scope.inScope, visitOutcomes: cache.visitOutcomes }),
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
    losses,
    // A etapa da perda sai dos mesmos leads do card de perdas.
    lossStages: stageBase ? lossStagesOf({ lostLeads: losses.leads, moves: cache.moves, start, end }) : null,
    firstContact: contactOk ? firstContactOf(cohortLeads, { contactTimes: cache.contactTimes, limit }) : null,
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
      leadOf,
      // A função recorta funil e pessoa pelo funil de nascimento.
      newLeads: fresh(src.leadsCreated),
      trackingSince
    }) : null
  };
}

const comma = (v) => String(v).replace('.', ',');
const ZERO = { pct: '0%', pp: '0 p.p.', min: '0 min', days: '0 dias' };

// Diferença que o texto mostraria como zero é "igual": a duração sai em
// minutos inteiros e os dias com uma casa. Contagem e taxa: abaixo de 0,05.
function isFlat(diff, kind) {
  const abs = Math.abs(diff);
  if (kind === 'min') return Math.round(abs) === 0;
  if (kind === 'days') return Math.round(abs * 10) === 0;
  return abs < 0.05;
}

// Diferença entre o mês e o comparado no formato do handoff: contagem em %
// ("12,5%"), taxa em pontos ("+8 p.p."), duração ("40 min") e dias ("1,5
// dias"). Sem um dos lados, ou contagem comparada com zero: "sem base".
export function crmDelta(cur, prev, { kind = 'pct' } = {}) {
  if (cur == null || prev == null) return { none: true, text: 'sem base' };
  if (kind === 'pct' && prev === 0) return { none: true, text: 'sem base' };
  const diff = kind === 'pct' ? ((cur - prev) / prev) * 100 : cur - prev;
  if (isFlat(diff, kind)) return { flat: true, value: 0, text: `= ${ZERO[kind]}` };
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
const MIN_CHANNEL_LEADS = 5;
export function bestChannelOf(m) {
  return (m?.channels || [])
    .map((c) => ({ ...c, conv: pct(c.enrolled, c.leads) }))
    .filter((c) => c.leads >= MIN_CHANNEL_LEADS && c.conv != null)
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
    // Passaram de 24 horas: o primeiro contato veio depois de 24 horas, ou o
    // lead segue sem contato e já tinha mais de 24 horas no limite. O lead de
    // poucas horas sem contato ainda está no prazo.
    const late = fc.over + fc.noneLate;
    add(
      `${fmtNum(late)} dos ${fmtNum(fc.total)} leads ${late === 1 ? 'passou' : 'passaram'} de 24 horas sem primeiro contato`,
      crmDelta(late, pfc.over + pfc.noneLate, { kind: 'pct' }),
      true
    );
  }
  // O comparado só vale com amostra comparável: o mesmo canal, com ao menos 5
  // leads também lá. Sem isso o destaque de canal sai.
  const best = bestChannelOf(cur);
  const prev = best && (cmp.channels || []).find((c) => c.name === best.name);
  if (best && prev && prev.leads >= MIN_CHANNEL_LEADS) {
    add(
      `${best.name} converteu ${best.conv}%, a melhor taxa entre os canais`,
      crmDelta(best.conv, pct(prev.enrolled, prev.leads), { kind: 'pp' }),
      false
    );
  }
  return out;
}

// Tendência dos `months` meses até o exibido. Mês sem valor fica fora. Nos
// números de agendamento, os meses antes de setembro de 2026 também saem
// (histórico incompleto, APPTS_COMPLETE_MONTH), e a série encurta.
export function seriesOf(ctx, { monthKey, userId = null, funnelId = null, pick, months = 6, apptsBased = false }) {
  const keys = [];
  for (let i = months - 1; i >= 0; i--) keys.push(addMonthsToKey(monthKey, -i));
  return keys
    .filter((key) => !apptsBased || key >= APPTS_COMPLETE_MONTH)
    .map((key) => ({ key, value: pick(metricsOf(ctx, { monthKey: key, userId, funnelId })) }))
    .filter((p) => p.value != null);
}
