// Regras e cálculos das métricas do Dashboard — fonte única, funções puras
// (sem React, sem Firestore), no mesmo espírito de dailyGoal.js.
//
// Cada métrica declara sua BASE:
//   EVENTO — a data do acontecimento caiu no período selecionado
//            ("o que aconteceu no período": leads captados, visitas/aulas
//            marcadas para o período, matrículas fechadas no período).
//   SAFRA  — leads CAPTADOS no período, desfecho até agora
//            ("aproveitamento da captação": funil, taxas de conversão).
//
// Misturar as duas bases num mesmo número foi a origem dos bugs corrigidos
// aqui (taxa > 100%, dois valores de "Matrículas" na mesma tela). Toda taxa
// usa numerador e denominador da MESMA base.

import { getSafeDateOrNull } from './dates.js';
import {
  getLeadAppointmentType,
  getLeadAppointmentDate,
  getLeadConversionDate,
  isLeadAttended,
  isLeadConverted
} from './leads.js';

const DAY_MS = 86400000;

// Janela do período selecionado. Presets casam com o calendário civil em
// horário LOCAL (parse de 'yyyy-mm-dd' como meia-noite local evita o shift
// de 1 dia do UTC-3). Retorna null para custom incompleto/inválido.
export function buildPeriodRange(preset, { customStart, customEnd, now = new Date() } = {}) {
  if (preset === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (preset === 'weekly') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day; // semana iniciando na segunda
    start.setDate(start.getDate() + diff);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (preset === 'custom') {
    if (!customStart || !customEnd) return null;
    const start = new Date(`${customStart}T00:00:00`);
    const end = new Date(`${customEnd}T23:59:59.999`);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return null;
    return { start, end };
  }

  if (preset === 'monthlyPrev') {
    // Mês civil anterior completo (jan → dez do ano anterior auto-rola
    // pelo construtor Date).
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start, end };
  }

  // Default: 'monthly' (mês atual).
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

// Período equivalente anterior usado nos deltas (▲▼ dos KPIs), por PRESET
// para casar com o calendário civil.
//
// PRO-RATA: se o período exibido ainda está EM CURSO, o anterior é cortado
// no mesmo ponto decorrido (dia 9 do mês compara com os 9 primeiros dias do
// mês anterior) — comparar trecho parcial contra mês inteiro criava um viés
// negativo sistemático nos deltas. O corte é clampado no fim do período
// anterior (mês de 31 dias vs 30). Período já encerrado compara inteiro
// contra inteiro. `partial` diz qual dos dois casos aconteceu (a UI usa
// para legendar "vs. mesmo ponto do período anterior").
export function buildPreviousRange(preset, range, now = new Date()) {
  if (!range) return null;

  let prevStart;
  let prevFullEnd;

  if (preset === 'today') {
    prevStart = new Date(range.start);
    prevStart.setDate(prevStart.getDate() - 1);
    prevFullEnd = new Date(prevStart);
    prevFullEnd.setHours(23, 59, 59, 999);
  } else if (preset === 'weekly') {
    prevStart = new Date(range.start);
    prevStart.setDate(prevStart.getDate() - 7);
    prevFullEnd = new Date(prevStart);
    prevFullEnd.setDate(prevFullEnd.getDate() + 6);
    prevFullEnd.setHours(23, 59, 59, 999);
  } else if (preset === 'monthly' || preset === 'monthlyPrev') {
    // Sempre o mês civil completo IMEDIATAMENTE ANTES do mês exibido.
    const y = range.start.getFullYear();
    const m = range.start.getMonth();
    prevStart = new Date(y, m - 1, 1, 0, 0, 0, 0);
    prevFullEnd = new Date(y, m, 0, 23, 59, 59, 999);
  } else {
    // 'custom' — janela de mesma duração imediatamente antes.
    const span = range.end.getTime() - range.start.getTime();
    prevStart = new Date(range.start.getTime() - span - 1);
    prevFullEnd = new Date(range.start.getTime() - 1);
  }

  if (range.end < now) {
    return { start: prevStart, end: prevFullEnd, partial: false };
  }

  const elapsed = Math.max(0, now.getTime() - range.start.getTime());
  const proRataEnd = Math.min(prevStart.getTime() + elapsed, prevFullEnd.getTime());
  return { start: prevStart, end: new Date(proRataEnd), partial: true };
}

// Span [startMs, endMs] que cobre TODAS as datas que as métricas de período
// leem, para o dashboard ADMIN buscar a UNIÃO de janelas de campo
// (leadQueries.adminDashboardWindowSpecs) em vez do prop global (G1c):
//   • período ATUAL — captação/agendamento/matrícula/perda;
//   • período ANTERIOR — deltas (buildPreviousRange começa no início do período
//     anterior completo, mesmo em curso/pró-rata);
//   • janela do SPARKLINE — período encerrado acompanha o próprio período; em
//     curso são os últimos 14 dias até hoje (pode começar ANTES do período).
// Pega o menor início entre esses três e o fim do período. Puro/testável;
// retorna null se não há período (custom incompleto).
export function computeAdminDashboardSpan(range, previousRange, now = new Date()) {
  if (!range) return null;
  const inProgress = range.end >= now;
  let sparkStart;
  if (inProgress) {
    sparkStart = new Date(now);
    sparkStart.setHours(0, 0, 0, 0);
    sparkStart.setDate(sparkStart.getDate() - 13); // mesma janela de computeSparklines
  } else {
    sparkStart = range.start;
  }
  const starts = [range.start, sparkStart];
  if (previousRange) starts.push(previousRange.start);
  const startMs = Math.min(...starts.map((d) => d.getTime()));
  return { startMs, endMs: range.end.getTime() };
}

// Janela (em ms) para a query de aulas por trás da conversão por professor:
// início do período selecionado até min(fim do período, agora) — aula futura
// não é comparecimento nem falta. Mesmo corte que computeProfessorConversion
// aplica internamente; feito aqui (função pura, `now` como parâmetro) porque
// chamar `new Date()`/`Date.now()` direto dentro de um componente/hook viola
// a regra de pureza (react-hooks v7). Retorna null sem período selecionado.
export function computeAulasWindowMs(range, now = new Date()) {
  if (!range) return null;
  const startMs = range.start.getTime();
  const endMs = Math.min(range.end.getTime(), now.getTime());
  return { startMs, endMs };
}

// Inclusivo nas duas pontas; aceita Date, Timestamp do Firestore ou string.
export function isWithinRange(dateLike, range) {
  const d = getSafeDateOrNull(dateLike);
  if (!range || !d) return false;
  return d >= range.start && d <= range.end;
}

// EVENTO (captação): createdAt dentro do período. Leads sem createdAt real
// (flag createdAtMissing, marcada no snapshot do App) ficam de fora — o
// fallback "agora" do getSafeDate os faria contar como captados hoje.
export function computeCapturedLeads(leads, range) {
  return (leads || []).filter(l => !l.createdAtMissing && isWithinRange(l.createdAt, range));
}

// EVENTO (agendamento): visita/aula com data marcada dentro do período,
// independente de quando o lead chegou.
export function computeScheduledLeads(leads, range) {
  return (leads || []).filter(l => {
    const type = getLeadAppointmentType(l);
    const date = getLeadAppointmentDate(l);
    return Boolean(type && date && isWithinRange(date, range));
  });
}

// EVENTO (matrícula): fechamentos dentro do período, de qualquer safra.
// getLeadConversionDate cai no createdAt quando falta convertedAt — ou seja,
// lead legado convertido sem carimbo fica atribuído ao período de CAPTAÇÃO
// (decisão explícita: melhor que espalhar pelo período errado; a escrita
// agora carimba convertedAt, então o caso só existe em dados antigos).
export function computeConvertedLeads(leads, range) {
  return (leads || []).filter(l => isLeadConverted(l) && isWithinRange(getLeadConversionDate(l), range));
}

// Números dos KPIs e taxas da safra. Recebe as três coortes já computadas
// (a view também as usa para as listas clicáveis do funil).
export function computeDashboardStats({ capturedLeads, scheduledLeads, convertedLeads, now = new Date() }) {
  const total = capturedLeads.length;

  // EVENTO — valores absolutos dos KPIs.
  const visitas = scheduledLeads.filter(l => getLeadAppointmentType(l) === 'visita');
  const aulas = scheduledLeads.filter(l => getLeadAppointmentType(l) === 'aula_experimental');
  const agendadosVisita = visitas.length;
  const agendadosAula = aulas.length;
  const visitasRealizadas = visitas.filter(l => getLeadAppointmentDate(l) <= now).length;
  const aulasRealizadas = aulas.filter(l => getLeadAppointmentDate(l) <= now).length;
  const visitasFuturas = agendadosVisita - visitasRealizadas;
  const aulasFuturas = agendadosAula - aulasRealizadas;

  const convertidos = convertedLeads.length;
  // Decomposição do KPI "Matrículas no período": quantos fechamentos vieram
  // da safra do próprio período e quantos são leads antigos. Soma sempre
  // bate com `convertidos` — o card se explica sozinho.
  const capturedIds = new Set(capturedLeads.map(l => l.id));
  const convertidosDaSafra = convertedLeads.filter(l => capturedIds.has(l.id)).length;
  const convertidosAntigos = convertidos - convertidosDaSafra;

  // SAFRA — numerador e denominador da MESMA coorte de captação. Evita o
  // paradoxo de "150% de conversão" quando o numerador vem de uma coorte e
  // o denominador de outra.
  const coorteVisita = capturedLeads.filter(l =>
    getLeadAppointmentType(l) === 'visita' && getLeadAppointmentDate(l)
  ).length;
  const coorteAula = capturedLeads.filter(l =>
    getLeadAppointmentType(l) === 'aula_experimental' && getLeadAppointmentDate(l)
  ).length;
  const coorteConvertidos = capturedLeads.filter(isLeadConverted).length;

  const txAgVisita = total > 0 ? Math.round((coorteVisita / total) * 100) : 0;
  const txAgAula = total > 0 ? Math.round((coorteAula / total) * 100) : 0;
  const txConv = total > 0 ? Math.round((coorteConvertidos / total) * 100) : 0;

  return {
    total,
    agendadosVisita,
    agendadosAula,
    visitasRealizadas,
    visitasFuturas,
    aulasRealizadas,
    aulasFuturas,
    convertidos,
    convertidosDaSafra,
    convertidosAntigos,
    coorteVisita,
    coorteAula,
    coorteConvertidos,
    txAgVisita,
    txAgAula,
    txConv
  };
}

// SAFRA: etapas do funil como LISTAS de leads (a view usa os counts e as
// listas no drill-down). Etapa N ⊆ etapa N-1, exceto Matrículas, que pode
// superar Compareceram (lead que fechou sem a visita/aula ter acontecido) —
// comportamento honesto, documentado no tooltip da view.
//
// "Compareceram" exige data do agendamento JÁ PASSADA além da presença:
// isLeadAttended considera qualquer convertido como presente, então sem o
// corte de data um agendamento futuro de lead matriculado contava como
// comparecido (mesma regra que o card Taxa de comparecimento sempre usou).
export function computeFunnelSteps({ capturedLeads, now = new Date() }) {
  const agendamento = capturedLeads.filter(l => {
    const t = getLeadAppointmentType(l);
    return (t === 'visita' || t === 'aula_experimental') && getLeadAppointmentDate(l);
  });
  const compareceram = agendamento.filter(l => {
    const d = getLeadAppointmentDate(l);
    return d && d <= now && isLeadAttended(l);
  });
  const matriculas = capturedLeads.filter(isLeadConverted);
  return { agendamento, compareceram, matriculas };
}

// EVENTO (só datas passadas): taxa de comparecimento com numerador e
// denominador da mesma base — agendamentos cuja data já passou. Futuros
// entram só como "+N futuros" na view.
export function computeAttendance({ scheduledLeads, now = new Date() }) {
  const passados = scheduledLeads.filter(l => {
    const t = getLeadAppointmentType(l);
    const d = getLeadAppointmentDate(l);
    return (t === 'visita' || t === 'aula_experimental') && d && d <= now;
  });
  return {
    compareceram: passados.filter(isLeadAttended).length,
    apptPassados: passados.length
  };
}

// Desempenho por consultor. Contagens são EVENTO (como os KPIs globais);
// a conversão é SAFRA por consultor: dos leads que ELE captou no período,
// quantos já converteram — nunca passa de 100%. `null` quando não houve
// captação no período (a UI mostra travessão em vez de um 0% injusto para
// quem fechou leads captados antes).
export function computeTeamMetrics({ capturedLeads, scheduledLeads, convertedLeads }) {
  const metrics = {};

  const ensureConsultant = (lead) => {
    const cId = lead.consultantId || 'unassigned';
    if (!metrics[cId]) {
      metrics[cId] = {
        consultantId: cId, // p/ cruzar com a meta/volume de HOJE no card
        name: lead.consultantName || 'Desconhecido',
        total: 0,
        agendadosVisita: 0,
        agendadosAula: 0,
        convertidos: 0,
        coorteConvertidos: 0,
        coortePerdidos: 0,
        txConversaoGlobal: null
      };
    }
    return cId;
  };

  [...capturedLeads, ...scheduledLeads, ...convertedLeads].forEach(ensureConsultant);

  capturedLeads.forEach(l => {
    const cId = ensureConsultant(l);
    metrics[cId].total += 1;
    if (isLeadConverted(l)) metrics[cId].coorteConvertidos += 1;
    else if (l.status === 'Perda') metrics[cId].coortePerdidos += 1;
  });

  scheduledLeads.forEach(l => {
    const cId = ensureConsultant(l);
    const type = getLeadAppointmentType(l);
    if (type === 'visita') metrics[cId].agendadosVisita += 1;
    if (type === 'aula_experimental') metrics[cId].agendadosAula += 1;
  });

  convertedLeads.forEach(l => {
    const cId = ensureConsultant(l);
    metrics[cId].convertidos += 1;
  });

  Object.values(metrics).forEach(m => {
    m.txConversaoGlobal = m.total > 0 ? Math.round((m.coorteConvertidos / m.total) * 100) : null;
  });

  return Object.values(metrics).sort(
    (a, b) => b.convertidos - a.convertidos || b.total - a.total
  );
}

// Uma linha da tabela "Métricas por funil" a partir dos leads JÁ escopados
// ao funil (o escopo por funil fica na view, que tem isItemInFunnel).
// Contagens EVENTO; taxa SAFRA (antes dividia fechamentos do período por
// captados do período — mesma mistura de bases da conversão da equipe).
export function computeFunnelRowMetrics(scopedLeads, range) {
  const captured = computeCapturedLeads(scopedLeads, range);
  const scheduled = computeScheduledLeads(scopedLeads, range);
  const visits = scheduled.filter(l => getLeadAppointmentType(l) === 'visita').length;
  const classes = scheduled.filter(l => getLeadAppointmentType(l) === 'aula_experimental').length;
  const converted = computeConvertedLeads(scopedLeads, range).length;
  const coorteConvertidos = captured.filter(isLeadConverted).length;
  const rate = captured.length > 0 ? Math.round((coorteConvertidos / captured.length) * 100) : 0;
  return { captured: captured.length, visits, classes, converted, coorteConvertidos, rate };
}

// Totais da tabela. Taxa recalculada do agregado (não média de taxas) —
// Simpson's paradox.
export function computeFunnelComparisonTotals(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const sum = rows.reduce((acc, r) => ({
    captured: acc.captured + r.captured,
    visits: acc.visits + r.visits,
    classes: acc.classes + r.classes,
    converted: acc.converted + r.converted,
    coorteConvertidos: acc.coorteConvertidos + (r.coorteConvertidos || 0)
  }), { captured: 0, visits: 0, classes: 0, converted: 0, coorteConvertidos: 0 });
  const rate = sum.captured > 0 ? Math.round((sum.coorteConvertidos / sum.captured) * 100) : 0;
  return { ...sum, rate };
}

// Delta % vs período anterior equivalente (pro-rata quando em curso — ver
// buildPreviousRange). Ambos os lados usam as MESMAS regras de coorte.
export function computeDeltas({ leads, range, previousRange }) {
  if (!previousRange) return { leads: null, visitas: null, aulas: null, matriculas: null };

  const countIn = (r) => {
    const scheduled = computeScheduledLeads(leads, r);
    return {
      leads: computeCapturedLeads(leads, r).length,
      visitas: scheduled.filter(l => getLeadAppointmentType(l) === 'visita').length,
      aulas: scheduled.filter(l => getLeadAppointmentType(l) === 'aula_experimental').length,
      matriculas: computeConvertedLeads(leads, r).length
    };
  };

  const curr = countIn(range);
  const prev = countIn(previousRange);
  const pct = (c, p) => (p > 0 ? ((c - p) / p) * 100 : (c > 0 ? 100 : null));

  return {
    leads: pct(curr.leads, prev.leads),
    visitas: pct(curr.visitas, prev.visitas),
    aulas: pct(curr.aulas, prev.aulas),
    matriculas: pct(curr.matriculas, prev.matriculas)
  };
}

// Série diária dos sparklines. Período ENCERRADO: acompanha o próprio
// período, dia a dia. Período em curso: últimos 14 dias até hoje (tendência
// recente "cheia", sem a zona morta dos dias que ainda não chegaram).
export function computeSparklines({ leads, range, now = new Date() }) {
  let firstDay;
  let nDays;
  if (range && range.end < now) {
    const start = new Date(range.start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(range.end);
    end.setHours(0, 0, 0, 0);
    nDays = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
    firstDay = start;
  } else {
    firstDay = new Date(now);
    firstDay.setHours(0, 0, 0, 0);
    firstDay.setDate(firstDay.getDate() - 13);
    nDays = 14;
  }

  const series = { leads: [], visitas: [], aulas: [], matriculas: [] };
  for (let i = 0; i < nDays; i++) {
    const dayStart = new Date(firstDay);
    dayStart.setDate(dayStart.getDate() + i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    const dayRange = { start: dayStart, end: dayEnd };

    const scheduled = computeScheduledLeads(leads, dayRange);
    series.leads.push(computeCapturedLeads(leads, dayRange).length);
    series.visitas.push(scheduled.filter(l => getLeadAppointmentType(l) === 'visita').length);
    series.aulas.push(scheduled.filter(l => getLeadAppointmentType(l) === 'aula_experimental').length);
    series.matriculas.push(computeConvertedLeads(leads, dayRange).length);
  }
  return series;
}

// SAFRA: captados do período agrupados por origem, ordenados por volume.
export function computeSourceMetrics(capturedLeads) {
  const metrics = {};
  (capturedLeads || []).forEach(l => {
    const src = l.source || 'Desconhecida';
    metrics[src] = (metrics[src] || 0) + 1;
  });
  return Object.entries(metrics)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

// Breakdown de aulas experimentais agendadas por modalidade (recebe os
// agendados do período).
export function computeAulasPorModalidade(scheduledLeads) {
  const map = new Map();
  (scheduledLeads || []).forEach(l => {
    if (getLeadAppointmentType(l) !== 'aula_experimental') return;
    const key = (l.appointmentModality || '').trim() || 'Sem modalidade';
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

// EVENTO (hoje): visitas e aulas com data marcada para HOJE, em ordem de
// horário — a "linha do dia" da tela Operacional.
export function computeTodayAgenda(leads, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return computeScheduledLeads(leads, { start, end }).sort(
    (a, b) => getLeadAppointmentDate(a).getTime() - getLeadAppointmentDate(b).getTime()
  );
}

// Não-comparecimentos recentes de leads AINDA EM JOGO (nem matrícula nem
// perda), do mais novo para o mais antigo — a fila de retrabalho da tela
// Operacional. Sem appointmentOutcomeAt não há como saber se é recente,
// então fica de fora.
export function computeNoShowsToRework(leads, { now = new Date(), days = 14 } = {}) {
  const cutoff = new Date(now.getTime() - days * DAY_MS);
  return (leads || [])
    .filter(l => {
      if (l.appointmentOutcome !== 'no_show') return false;
      if (l.status === 'Perda' || isLeadConverted(l)) return false;
      const outcomeAt = getSafeDateOrNull(l.appointmentOutcomeAt);
      return Boolean(outcomeAt && outcomeAt >= cutoff && outcomeAt <= now);
    })
    .sort((a, b) => getSafeDateOrNull(b.appointmentOutcomeAt) - getSafeDateOrNull(a.appointmentOutcomeAt));
}

// Sem período (por design): pendências futuras/atrasadas de leads ainda em
// jogo, ordenadas da mais próxima para a mais distante. nextFollowUp chega
// como Date normalizado do snapshot do App.
export function computePendingFollowUps(leads) {
  return (leads || [])
    .filter(l =>
      l.status !== 'Venda' &&
      l.status !== 'Perda' &&
      l.nextFollowUp instanceof Date &&
      !isNaN(l.nextFollowUp.getTime())
    )
    .sort((a, b) => a.nextFollowUp.getTime() - b.nextFollowUp.getTime());
}

function buildDayRange(now) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// Conversão por PROFESSOR nas aulas experimentais. Lê registros da coleção
// stronix_aulas (um documento por aula realizada/agendada), não mais o
// agendamento único do lead — permite histórico multi-aula por lead. A janela
// é o PERÍODO selecionado no Gerencial (decisão do Johnny, 2026-07-12: as
// datas do Gerencial mexem em todos os resultados, inclusive este card). Só
// entram aulas cuja data JÁ PASSOU — aula futura não é comparecimento nem
// falta —, então o fim efetivo é min(range.end, agora). Sem range, cai numa
// janela móvel de 90 dias (fallback dos consumidores que não passam período).
// Aula sem professor (soloTraining ou sem professorId) cai na linha de
// REFERÊNCIA "Treina sozinho", fora do ranking. Conversão = matrículas ÷
// compareceram (só aula com status 'attended' conta como comparecimento; o
// campo `converted` do próprio registro marca a matrícula).
export function computeProfessorConversion(aulas, { range = null, now = new Date(), days = 90 } = {}) {
  const start = range ? range.start : new Date(now.getTime() - days * DAY_MS);
  const rawEnd = range ? range.end : now;
  const end = rawEnd < now ? rawEnd : now;
  const byProf = new Map();
  let solo = null;

  const makeBucket = (professorId, name, isSolo) => ({
    professorId,
    name,
    isSolo,
    aulas: 0,
    compareceram: 0,
    matriculas: 0,
    convPct: null,
    basePequena: false,
    deltaVsSolo: null
  });

  (aulas || []).forEach(aula => {
    const d = getSafeDateOrNull(aula.scheduledFor);
    if (!d || d < start || d > end) return;

    let bucket;
    if (aula.soloTraining || !aula.professorId) {
      if (!solo) solo = makeBucket(null, 'Treina sozinho', true);
      bucket = solo;
    } else {
      const key = aula.professorId;
      if (!byProf.has(key)) {
        byProf.set(key, makeBucket(key, aula.professorName || 'Professor', false));
      }
      bucket = byProf.get(key);
    }

    bucket.aulas += 1;
    if (aula.status === 'attended') {
      bucket.compareceram += 1;
      if (aula.converted === true) bucket.matriculas += 1;
    }
  });

  const finalize = (b) => {
    b.convPct = b.compareceram > 0 ? Math.round((b.matriculas / b.compareceram) * 100) : null;
    b.basePequena = b.compareceram > 0 && b.compareceram < 3;
  };
  byProf.forEach(finalize);
  if (solo) finalize(solo);

  const rows = Array.from(byProf.values()).sort((a, b) => {
    const ca = a.convPct == null ? -1 : a.convPct;
    const cb = b.convPct == null ? -1 : b.convPct;
    return cb - ca || b.compareceram - a.compareceram || a.name.localeCompare(b.name);
  });

  if (solo && solo.convPct != null) {
    rows.forEach(r => {
      if (r.convPct != null) r.deltaVsSolo = r.convPct - solo.convPct;
    });
  }

  const all = solo ? [...rows, solo] : rows;
  const totals = all.reduce(
    (acc, b) => ({
      aulas: acc.aulas + b.aulas,
      compareceram: acc.compareceram + b.compareceram,
      matriculas: acc.matriculas + b.matriculas
    }),
    { aulas: 0, compareceram: 0, matriculas: 0 }
  );
  totals.convPct = totals.compareceram > 0 ? Math.round((totals.matriculas / totals.compareceram) * 100) : null;
  totals.attendancePct = totals.aulas > 0 ? Math.round((totals.compareceram / totals.aulas) * 100) : null;

  return { windowStart: start, windowEnd: end, totals, rows, solo };
}

// EVENTO: perdas com lostAt dentro do período, agrupadas pelo motivo
// registrado. Perda sem lostAt fica de fora (sem data não há como saber o
// período); perda sem motivo entra em "Sem motivo".
export function computeLossReasons(leads, range) {
  const map = new Map();
  let total = 0;
  (leads || []).forEach(l => {
    if (l.status !== 'Perda') return;
    if (!isWithinRange(l.lostAt, range)) return;
    const key = String(l.lossReason || '').trim() || 'Sem motivo';
    map.set(key, (map.get(key) || 0) + 1);
    total += 1;
  });
  const rows = Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { total, rows };
}

// EVENTO (hoje): o funil do dia da barra de progresso do Operacional —
// Novos → Agendados → Compareceram → Matrículas, mais o andamento da agenda
// (quantos agendamentos de hoje já ficaram para trás no relógio). Sem índice
// composto: só contagens diretas.
export function computeDayFunnel(leads, now = new Date()) {
  const dayRange = buildDayRange(now);
  const agenda = computeTodayAgenda(leads, now);
  const realizados = agenda.filter(l => getLeadAppointmentDate(l) <= now);
  return {
    novos: computeCapturedLeads(leads, dayRange).length,
    agendados: agenda.length,
    compareceram: realizados.filter(isLeadAttended).length,
    matriculas: computeConvertedLeads(leads, dayRange).length,
    agendaRealizados: realizados.length,
    agendaTotal: agenda.length
  };
}

// Contadores por consultor para os cards "Time agora" do Operacional:
// funil de HOJE (agendou/compareceu/matrículas) + backlog acumulado
// (follow-ups atrasados e no-shows recentes a reagendar). Meta/prospecção e
// "última ação" ficam na view (dependem de interactions e da lib da Meta).
export function computeConsultantDayBoard(leads, { now = new Date(), noShowDays = 14 } = {}) {
  const board = {};
  const ensure = (lead) => {
    const id = lead.consultantId || 'unassigned';
    if (!board[id]) {
      board[id] = {
        consultantId: id,
        name: lead.consultantName || 'Desconhecido',
        agendou: 0,
        compareceu: 0,
        matriculas: 0,
        followUpsAtrasados: 0,
        noShows: 0
      };
    }
    return board[id];
  };

  computeTodayAgenda(leads, now).forEach(l => {
    const b = ensure(l);
    b.agendou += 1;
    const d = getLeadAppointmentDate(l);
    if (d <= now && isLeadAttended(l)) b.compareceu += 1;
  });

  computeConvertedLeads(leads, buildDayRange(now)).forEach(l => {
    ensure(l).matriculas += 1;
  });

  computePendingFollowUps(leads).forEach(l => {
    if (l.nextFollowUp < now) ensure(l).followUpsAtrasados += 1;
  });

  computeNoShowsToRework(leads, { now, days: noShowDays }).forEach(l => {
    ensure(l).noShows += 1;
  });

  return board;
}
