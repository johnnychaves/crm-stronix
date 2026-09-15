// Textos da tela do CRM que dependem dos números: o regime de comparação, a
// nota do recorte, a leitura dos canais e as cinco células da faixa de resumo
// (README do handoff, §7). Puro; a tela só posiciona.

import { fmtNum } from '../format.js';
import { addMonthsToKey } from '../operacional/month.js';
import { pct } from './stats.js';
import { APPTS_COMPLETE_MONTH } from './scope.js';
import { crmDelta, bestChannelOf } from './metrics.js';

const SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const shortOf = (key) => SHORT[Number(key.slice(5, 7)) - 1];

const HELP = {
  leads: 'Leads cadastrados no mês, pela data de cadastro. O filtro de pessoa usa o dono do lead e o de funil, o funil em que ele está.',
  appts: 'Visitas e aulas experimentais marcadas para o mês, sem as canceladas. No mês em andamento, entram só as de data já passada. Conta pela data do agendamento, não pela data do cadastro do lead.',
  attend: 'Quem veio ÷ quem veio mais quem faltou, entre os agendamentos com data já passada. Agendamento sem desfecho registrado fica fora da conta e aparece na linha de baixo.',
  enroll: 'Leads que viraram cliente no mês, de qualquer safra. É o resultado do mês, não a conversão da turma que entrou no mês.',
  conv: 'Dos leads cadastrados no mês, quantos já matricularam. No mês em andamento ela ainda sobe: quem segue em jogo pode fechar depois. A comparação pró-rata mede a safra do outro mês com a mesma idade.'
};

// O subtítulo do cabeçalho e a nota da barra, pelo regime de comparação.
export function regimeTexts({ running, compareOn, dayN, shownName, cmpName, apptsPartial = false }) {
  const range = running ? (dayN === 1 ? `1 de ${shownName}` : `1 a ${dayN} de ${shownName}`) : `${shownName} inteiro`;
  const firstDays = dayN === 1 ? 'o primeiro dia' : `os ${dayN} primeiros dias`;
  let subline;
  if (running && compareOn) {
    subline = `${range} comparado com ${firstDays} de ${cmpName}. O mês está em andamento, então a comparação é pró-rata e a conversão da safra ainda vai subir.`;
  } else if (running) {
    subline = `${range}. O mês está em andamento: a conversão da safra de ${shownName} ainda vai subir.`;
  } else if (compareOn) {
    subline = `${range} comparado com ${cmpName}. Mês fechado.`;
  } else {
    subline = `${range}. Mês fechado.`;
  }
  if (apptsPartial) subline += ` Os agendamentos de ${shownName} estão incompletos no histórico.`;
  let note;
  if (!compareOn) note = `Sem comparativo · ${range}`;
  else if (running) note = `Pró-rata: ${dayN === 1 ? 'mesmo primeiro dia' : `mesmos ${dayN} primeiros dias`} de ${cmpName}`;
  else note = 'Mês fechado contra mês fechado';
  return { range, subline, note };
}

// Nota do recorte, à direita do título de cada seção.
export const scopeNote = (personName, funnelName) => `${personName || 'Equipe toda'} · ${funnelName || 'Todos os funis'}`;

// Leitura da tabela de canais: quem traz volume e quem traz resultado.
export function channelRead(m) {
  const rows = m?.channels || [];
  const best = bestChannelOf(m);
  const biggest = rows[0];
  if (!best || !biggest) return 'Poucos leads no período para comparar canais.';
  if (best.name === biggest.name) return `${best.name} é ao mesmo tempo o canal de maior volume e o de melhor conversão.`;
  const bigConv = pct(biggest.enrolled, biggest.leads);
  if (!bigConv) return `${biggest.name} traz o volume e ${best.name} traz o resultado: ${biggest.name} ainda não teve matrícula na safra.`;
  const ratio = Math.round((best.conv / bigConv) * 10) / 10;
  return ratio >= 1.1
    ? `${biggest.name} traz o volume e ${best.name} traz o resultado: a conversão de ${best.name} é ${String(ratio).replace('.', ',')} vezes a de ${biggest.name}.`
    : `${biggest.name} traz o volume e ${best.name} traz o resultado: a conversão de ${best.name} é um pouco maior que a de ${biggest.name}.`;
}

// Tendência de uma célula: os pontos, os rótulos das pontas e a dica.
function sparkOf(points, fmt) {
  if (!points || points.length < 2) return { series: null };
  const first = points[0];
  const last = points[points.length - 1];
  return {
    series: points.map((p) => p.value),
    seriesFrom: `${shortOf(first.key)} ${fmt(first.value)}`,
    seriesTo: `${shortOf(last.key)} ${fmt(last.value)}`,
    seriesLabel: `Tendência de ${points.length} meses: ${points.map((p) => `${shortOf(p.key)} ${fmt(p.value)}`).join(', ')}`
  };
}

// As cinco células da faixa de resumo, no formato do DashSummaryBand.
export function summaryItems({ cur, cmp, series, compareOn, shownName }) {
  // Mês que falhou não está carregando: a tela mostra o aviso sob a barra.
  const waiting = cur.failed ? 'não carregou' : 'carregando';
  const num = (v) => (v == null ? '—' : fmtNum(v));
  const pctText = (v) => (v == null ? '—' : `${v}%`);
  const pctFmt = (v) => `${v}%`;
  const d = (a, b, kind) => (compareOn ? crmDelta(a, b, { kind }) : null);
  // Agendamento sem base num dos lados (antes de agosto de 2026): sem base.
  const apptsOk = cur.apptsBase && (!cmp || cmp.apptsBase);
  const da = (a, b, kind) => (compareOn ? (apptsOk ? crmDelta(a, b, { kind }) : { none: true, text: 'sem base' }) : null);
  const flag = cur.apptsBase ? null : 'incompleto';
  const empty = 'Sem base para a tendência';
  const apptsEmpty = addMonthsToKey(cur.monthKey, -5) < APPTS_COMPLETE_MONTH ? 'Sem base antes de setembro de 2026' : empty;
  const top = (cur.channels || [])[0];
  const a = cur.appts;
  const c = cur.cohort;
  let enrollSub = waiting;
  if (c) {
    enrollSub = cur.running
      ? `${fmtNum(cur.fromCohort)} da safra de ${shownName} · ${fmtNum(cur.enroll - cur.fromCohort)} de safras anteriores`
      : `da safra de ${shownName}: ${fmtNum(c.enrolled)} ${c.enrolled === 1 ? 'já matriculou' : 'já matricularam'}`;
  }
  return [
    {
      key: 'leads', label: 'Leads novos', goodUp: true, tone: 'brand', showNone: true, help: HELP.leads,
      value: num(cur.leads),
      sub: cur.leads == null ? waiting : (top ? `${top.name} lidera com ${fmtNum(top.leads)}` : 'nenhum lead no período'),
      delta: d(cur.leads, cmp?.leads, 'pct'), emptySeries: empty, ...sparkOf(series.leads, fmtNum)
    },
    {
      key: 'appts', label: 'Agendamentos', goodUp: true, tone: 'accent', showNone: true, flag, help: HELP.appts,
      value: num(a?.total),
      sub: a ? `${fmtNum(a.came)} vieram · ${fmtNum(a.missed)} faltaram · ${fmtNum(a.pending)} sem desfecho` : waiting,
      delta: da(a?.total, cmp?.appts?.total, 'pct'), emptySeries: apptsEmpty, ...sparkOf(series.appts, fmtNum)
    },
    {
      key: 'attend', label: 'Comparecimento', goodUp: true, tone: 'emerald', showNone: true, flag, help: HELP.attend,
      value: pctText(a?.rate),
      sub: a ? `${fmtNum(a.came)} de ${fmtNum(a.decided)} com data já passada` : waiting,
      delta: da(a?.rate, cmp?.appts?.rate, 'pp'), emptySeries: apptsEmpty, ...sparkOf(series.attend, pctFmt)
    },
    {
      key: 'enroll', label: 'Matrículas', goodUp: true, tone: 'emerald', showNone: true, help: HELP.enroll,
      value: num(cur.enroll),
      sub: enrollSub,
      delta: d(cur.enroll, cmp?.enroll, 'pct'), emptySeries: empty, ...sparkOf(series.enroll, fmtNum)
    },
    {
      key: 'conv', label: 'Conversão da safra', goodUp: true, tone: 'brand', showNone: true, help: HELP.conv,
      value: pctText(c?.conv),
      sub: c ? `${fmtNum(c.enrolled)} de ${fmtNum(c.leads)} · ${fmtNum(c.open)} ${cur.running ? 'ainda em jogo' : 'seguem em jogo'}` : waiting,
      delta: d(c?.conv, cmp?.cohort?.conv, 'pp'), emptySeries: empty, ...sparkOf(series.conv, pctFmt)
    }
  ];
}
