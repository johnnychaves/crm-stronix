// Meses de competência do Operacional. Chave 'YYYY-MM', janelas [início, fim)
// em horário local e o corte pró-rata do mês comparado. Funções puras.

const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const pad = (n) => String(n).padStart(2, '0');

export const dayKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const monthKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export function parseMonthKey(key) {
  const [year, month] = String(key).split('-').map(Number);
  return { year, monthIndex: month - 1 };
}

export function monthRange(key) {
  const { year, monthIndex } = parseMonthKey(key);
  return { start: new Date(year, monthIndex, 1), end: new Date(year, monthIndex + 1, 1) };
}

export function addMonthsToKey(key, n) {
  const { year, monthIndex } = parseMonthKey(key);
  return monthKeyOf(new Date(year, monthIndex + n, 1));
}

export const isCurrentMonthKey = (key, now) => key === monthKeyOf(now);

// Agora, no mês em andamento; o fim do mês, nos fechados.
export function effectiveEnd(key, now) {
  const { end } = monthRange(key);
  return isCurrentMonthKey(key, now) && now < end ? now : end;
}

// O mês comparado anda o mesmo tempo que o exibido já andou (dia 11 às 14h
// contra dia 11 às 14h do outro mês). Mês exibido fechado compara inteiro.
export function comparisonCut(shownKey, compareKey, now) {
  const cmp = monthRange(compareKey);
  if (!isCurrentMonthKey(shownKey, now)) return cmp.end;
  const elapsed = Math.max(0, now.getTime() - monthRange(shownKey).start.getTime());
  return new Date(Math.min(cmp.start.getTime() + elapsed, cmp.end.getTime()));
}

// Dias de meta do mês (metaWeekdays: 0 = domingo ... 6 = sábado) com o estado
// em relação ao corte: 'closed' (acabou antes), 'today' (o corte cai nele) ou
// 'future'. Fim de semana fora da meta nunca aparece e nunca conta como falha.
export function metaDaysOfMonth(key, metaWeekdays, cutEnd) {
  const { start, end } = monthRange(key);
  const out = [];
  for (let d = new Date(start); d < end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    if (!(metaWeekdays || []).includes(d.getDay())) continue;
    const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    const state = dayEnd <= cutEnd ? 'closed' : d < cutEnd ? 'today' : 'future';
    out.push({ key: dayKeyOf(d), day: d.getDate(), weekday: d.getDay(), start: new Date(d), end: dayEnd, state });
  }
  return out;
}

// "Comparar com": os 12 meses anteriores (o 12º é o mesmo mês do ano anterior).
export function compareOptions(shownKey, maxBack = 12) {
  const opts = [];
  for (let i = 1; i <= maxBack; i++) opts.push(addMonthsToKey(shownKey, -i));
  const lastYear = addMonthsToKey(shownKey, -12);
  if (!opts.includes(lastYear)) opts.push(lastYear);
  return opts;
}

export function monthLabel(key, { capitalized = true, withYear = true } = {}) {
  const { year, monthIndex } = parseMonthKey(key);
  const name = MONTH_NAMES[monthIndex];
  const txt = capitalized ? name[0].toUpperCase() + name.slice(1) : name;
  return withYear ? `${txt} ${year}` : txt;
}
