// Período dos Relatórios e da Visão geral: o mês de competência de sempre, um
// atalho curto (Hoje, Ontem, Esta semana, Semana passada) ou um intervalo livre
// (de/até). Módulo puro, sem React e sem Firebase, testado em node. Datas
// locais, com meia-noite local, como no resto do app. Regra da spec
// docs/superpowers/specs/2026-09-25-periodo-personalizado-visao-geral-design.md;
// os Relatórios são os primeiros a usar (spec 2026-10-09).
//
// Um período é { kind, start, fullEnd, end, running, monthKey, label, days }:
// - start: o início, meia-noite local;
// - fullEnd: o fim nominal, exclusivo (fim do mês, do dia, da semana ou o dia
//   seguinte ao "até");
// - end: o fim efetivo, exclusivo. Agora, no período em andamento; o corte, no
//   período comparado; senão, o próprio fullEnd. É o papel que o effectiveEnd
//   tem no mês;
// - running: o período contém agora;
// - monthKey: só no modo mês;
// - label: o texto do botão;
// - days: os dias de calendário entre start e fullEnd.
// O intervalo leva também `de` e `ate`, como vieram do endereço.

import {
  addMonthsToKey, comparisonCut, dayKeyOf, effectiveEnd, isCurrentMonthKey, monthKeyOf, monthLabel, monthRange
} from './operacional/month.js';

// Os atalhos do endereço (`periodo`). O mês e o intervalo não entram: o mês é
// a ausência de período, e o intervalo vem por `de` e `ate`.
export const PERIOD_SHORTCUTS = Object.freeze(['hoje', 'ontem', 'semana', 'semana-passada']);

const PREFIX = Object.freeze({ hoje: 'Hoje', ontem: 'Ontem', semana: 'Esta semana', 'semana-passada': 'Semana passada' });
const SHORT_MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIA_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
// Segunda-feira da semana de `d`: a semana vai de segunda a domingo.
const mondayOf = (d) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
// Dias de calendário de `a` até `b`, contados pela data e não pelos
// milissegundos, para o horário de verão não mudar a conta.
const daysBetween = (a, b) => Math.round(
  (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000
);
// Último dia que a janela [start, end) toca. Janela vazia fica no dia do início.
const lastDayOf = (start, end) => startOfDay(new Date(Math.max(start.getTime(), end.getTime() - 1)));

// 'AAAA-MM-DD' que existe no calendário vira a meia-noite local dele; o resto, null.
export function dateFromDayKey(key) {
  if (!DIA_RE.test(key || '')) return null;
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getDate() === d ? date : null;
}

// Primeiro dia que o intervalo livre aceita: o dia 1 do mês de 11 meses atrás,
// a mesma janela de 12 meses da lista de meses.
export function oldestDayKey(todayKey) {
  return `${addMonthsToKey(todayKey.slice(0, 7), -11)}-01`;
}

const dayKeyText = (key) => `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`;

// Motivo da recusa do intervalo, ou null quando ele vale. A regra é uma só: o
// endereço (screenParams) cai no mês atual quando há motivo, e o balão do
// Personalizado mostra o texto embaixo dos campos.
export function intervalRefusal(de, ate, todayKey) {
  if (!de || !ate) return 'Escolha as duas datas.';
  if (!dateFromDayKey(de) || !dateFromDayKey(ate)) return 'Essa data não existe.';
  if (ate < de) return 'A data final vem antes da inicial.';
  const oldest = oldestDayKey(todayKey);
  if (de < oldest) return `O período cabe nos últimos 12 meses: comece em ${dayKeyText(oldest)} ou depois.`;
  if (ate > todayKey) return 'A data final não pode passar de hoje.';
  return null;
}

const dayMonth = (d) => `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;

// Texto de um trecho de dias, com o último dia incluído: "25 set", "21 a 25
// set", "28 ago a 3 set". Com os dois lados em anos diferentes, os dois levam
// o ano; num trecho inteiro de outro ano que não o de agora, o ano vai no fim.
export function rangeLabel(first, last, now) {
  if (first.getFullYear() !== last.getFullYear()) {
    return `${dayMonth(first)} ${first.getFullYear()} a ${dayMonth(last)} ${last.getFullYear()}`;
  }
  const tail = last.getFullYear() !== now.getFullYear() ? ` ${last.getFullYear()}` : '';
  if (dayKeyOf(first) === dayKeyOf(last)) return `${dayMonth(first)}${tail}`;
  if (first.getMonth() === last.getMonth()) return `${first.getDate()} a ${dayMonth(last)}${tail}`;
  return `${dayMonth(first)} a ${dayMonth(last)}${tail}`;
}

// O mês de competência, igual ao que as telas sempre mostraram: fim efetivo em
// agora no mês em andamento e o texto com o " · em andamento".
export function monthPeriod(key, now) {
  const { start, end: fullEnd } = monthRange(key);
  const running = isCurrentMonthKey(key, now);
  return {
    kind: 'mes',
    start,
    fullEnd,
    end: effectiveEnd(key, now),
    running,
    monthKey: key,
    label: `${monthLabel(key)}${running ? ' · em andamento' : ''}`,
    days: daysBetween(start, fullEnd)
  };
}

function windowPeriod(kind, start, fullEnd, now, extra = {}) {
  const running = start <= now && now < fullEnd;
  const end = running ? now : fullEnd;
  const range = rangeLabel(start, lastDayOf(start, end), now);
  return {
    kind,
    start,
    fullEnd,
    end,
    running,
    monthKey: null,
    label: PREFIX[kind] ? `${PREFIX[kind]} · ${range}` : range,
    days: daysBetween(start, fullEnd),
    ...extra
  };
}

// O período escolhido. Precedência: `de`/`ate` antes de `periodo`, que vem
// antes de `monthKey`. Intervalo recusado cai no mês atual, sem aviso. Os
// atalhos são relativos: `hoje` aberto amanhã é o dia de amanhã.
export function periodFromParams({ periodo = null, de = null, ate = null, monthKey = null } = {}, now) {
  const today = startOfDay(now);
  if (de || ate) {
    if (intervalRefusal(de, ate, dayKeyOf(now)) !== null) return monthPeriod(monthKeyOf(now), now);
    return windowPeriod('intervalo', dateFromDayKey(de), addDays(dateFromDayKey(ate), 1), now, { de, ate });
  }
  if (periodo === 'hoje') return windowPeriod('hoje', today, addDays(today, 1), now);
  if (periodo === 'ontem') return windowPeriod('ontem', addDays(today, -1), today, now);
  if (periodo === 'semana') {
    const monday = mondayOf(now);
    return windowPeriod('semana', monday, addDays(monday, 7), now);
  }
  if (periodo === 'semana-passada') {
    const monday = addDays(mondayOf(now), -7);
    return windowPeriod('semana-passada', monday, addDays(monday, 7), now);
  }
  return monthPeriod(monthKey || monthKeyOf(now), now);
}

// O período de comparação. No modo mês, a regra de sempre: o mês escolhido
// (o anterior por padrão) com o corte pró-rata do mês em andamento. Fora dele,
// os mesmos dias logo antes, sem escolha; com o período em andamento, o
// comparado para no mesmo ponto (ontem até a mesma hora, a semana passada até
// o mesmo dia da semana e a mesma hora).
export function previousPeriod(period, now, { compareKey = null } = {}) {
  if (period.kind === 'mes') {
    const key = compareKey || addMonthsToKey(period.monthKey, -1);
    const { start, end: fullEnd } = monthRange(key);
    return {
      kind: 'mes',
      start,
      fullEnd,
      end: comparisonCut(period.monthKey, key, now),
      running: false,
      monthKey: key,
      label: monthLabel(key),
      days: daysBetween(start, fullEnd)
    };
  }
  const start = addDays(period.start, -period.days);
  const fullEnd = period.start;
  const elapsed = Math.max(0, now.getTime() - period.start.getTime());
  const end = period.running ? new Date(Math.min(start.getTime() + elapsed, fullEnd.getTime())) : fullEnd;
  return {
    kind: 'intervalo',
    start,
    fullEnd,
    end,
    running: false,
    monthKey: null,
    label: rangeLabel(start, lastDayOf(start, end), now),
    days: period.days
  };
}

// Chaves 'AAAA-MM' dos meses que a janela [start, end) toca, em ordem. Janela
// vazia toca o mês do início.
export function monthsCovering(start, end) {
  const last = monthKeyOf(new Date(Math.max(start.getTime(), end.getTime() - 1)));
  const keys = [];
  for (let k = monthKeyOf(start); k <= last; k = addMonthsToKey(k, 1)) keys.push(k);
  return keys;
}

// O período passa de um mês para outro.
export const crossesMonths = (period) =>
  monthKeyOf(period.start) !== monthKeyOf(new Date(period.fullEnd.getTime() - 1));

// Dia de uma chave 'AAAA-MM-DD' para rótulo curto: "3", ou "3/10" com o mês.
export function dayLabelOf(key, withMonth = false) {
  const day = String(Number(key.slice(8, 10)));
  return withMonth ? `${day}/${Number(key.slice(5, 7))}` : day;
}
