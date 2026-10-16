// O total do relatório distribuído por dia, para o gráfico de colunas da
// Entrada e das Perdas (handoff dos Relatórios, §1). Não é número novo: cada
// linha do relatório cai no dia da data dela, então a soma dos dias é o total.
// Puro. Os dias são os do calendário local, contados pela data e não pelos
// milissegundos, para o horário de verão não pular nem repetir um dia.

import { dayKeyOf } from '../../operacional/month.js';

const isDate = (d) => d instanceof Date && !Number.isNaN(d.getTime());
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// Um item por dia do período, do início até o último dia dele, sem passar de
// hoje: { key: 'AAAA-MM-DD', date (meia-noite local), count, today }. `rows`
// são as linhas do relatório, já recortadas pelo período; `dateOf(row)` diz o
// dia de cada uma (Date). Linha sem data, ou com data fora dos dias, não conta.
export function porDia(rows, period, dateOf, now) {
  const first = startOfDay(period.start);
  const lastOfPeriod = startOfDay(new Date(Math.max(period.start.getTime(), period.fullEnd.getTime() - 1)));
  const today = startOfDay(now);
  const last = lastOfPeriod < today ? lastOfPeriod : today;
  const todayKey = dayKeyOf(today);

  const days = [];
  const byKey = new Map();
  for (let d = first, i = 0; d <= last; i += 1, d = addDays(first, i)) {
    const day = { key: dayKeyOf(d), date: d, count: 0, today: dayKeyOf(d) === todayKey };
    days.push(day);
    byKey.set(day.key, day);
  }
  for (const row of rows) {
    const when = dateOf(row);
    if (!isDate(when)) continue;
    const day = byKey.get(dayKeyOf(when));
    if (day) day.count += 1;
  }
  return days;
}
