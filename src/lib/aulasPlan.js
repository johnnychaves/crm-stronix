// As contas do "Marcar as aulas" do Agendar (AulasPlanner, mockup A,
// #marcar-aulas): o freepass por aulas nasce com todas as aulas marcadas. Cada
// linha tem dia, horário e professor. A linha que a pessoa ainda não mexeu
// (`auto`) segue a anterior: mesmo horário, mesmo professor e o mesmo dia da
// semana seguinte. Mexeu, ela fica com o que tem.
import { addDays, calendarDaysBetween, getSafeDateOrNull, startOfLocalDay } from './dates.js';
import { SOLO_TRAINING } from './professores.js';

// A primeira linha nasce às 18:00, como o cartão "Hoje" do passo de dia e hora.
export const emptyAulaRows = (n) =>
  Array.from({ length: Math.max(1, n) }, (_, i) => (i === 0 ? { date: null, time: '18:00', professor: '' } : { auto: true }));

export function resolveAulaRows(rows) {
  const out = [];
  (rows || []).forEach((r, i) => {
    const prev = out[i - 1];
    if (prev && r.auto) out.push({ auto: true, date: prev.date ? addDays(prev.date, 7) : null, time: prev.time, professor: prev.professor });
    else out.push({ auto: false, date: r.date || null, time: r.time || '', professor: r.professor || '' });
  });
  return out;
}

const at = (date, time) => {
  const [h, m] = String(time).split(':').map(Number);
  const d = new Date(date);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};

// O que falta ou está errado, uma coisa por vez. null quando dá para agendar.
// `first` é o número da primeira linha ("aula 2" no Remarcar de uma aula do
// freepass), e `taken` os dias das outras aulas do freepass, que não se repetem.
export function aulasProblem(resolved, now = new Date(), { first = 1, taken = [] } = {}) {
  const n = (i) => first + i;
  for (const [i, r] of resolved.entries()) {
    if (!r.date) return `Escolha o dia da aula ${n(i)}.`;
    if (!r.time) return `Escolha o horário da aula ${n(i)}.`;
    if (!r.professor) return `Escolha o professor da aula ${n(i)}.`;
  }
  for (const [i, r] of resolved.entries()) {
    const j = resolved.findIndex((o, k) => k < i && calendarDaysBetween(o.date, r.date) === 0);
    if (j !== -1) return `A aula ${n(i)} está no mesmo dia da aula ${n(j)}. Escolha outro dia.`;
    if (taken.some((d) => calendarDaysBetween(d, r.date) === 0)) return `A aula ${n(i)} está no mesmo dia de outra aula do freepass. Escolha outro dia.`;
  }
  for (const [i, r] of resolved.entries()) {
    if (at(r.date, r.time) <= now) return `A aula ${n(i)} já passou. Escolha outro dia ou horário.`;
  }
  return null;
}

// Os cartões de dia do Agendar e do "Marcar as aulas": DISTINTOS e
// consecutivos (não repete "Amanhã"). Começa em HOJE quando ainda dá tempo no
// dia (antes das 18h); à noite começa direto em AMANHÃ. Rótulos: Hoje / Amanhã
// / dia da semana (Terça-feira, Quarta-feira…). metaWeekdays = dias da semana
// programados na Meta Diária (getDay(): 0=dom..6=sáb); definido, os cartões só
// sugerem dias programados. Limite de 90 dias de busca para a lista vazia ou
// estranha não virar laço infinito.
export function dayOptions(count = 5, metaWeekdays = null) {
  const onMeta = (d) => !metaWeekdays || metaWeekdays.length === 0 || metaWeekdays.includes(d.getDay());
  const startOff = new Date().getHours() >= 18 ? 1 : 0;
  const out = [];
  for (let k = 0; out.length < count && k < 90; k++) {
    const off = startOff + k;
    const d = new Date(); d.setDate(d.getDate() + off); d.setHours(0, 0, 0, 0);
    if (!onMeta(d)) continue;
    let label;
    if (off === 0) label = 'Hoje';
    else if (off === 1) label = 'Amanhã';
    else { label = d.toLocaleDateString('pt-BR', { weekday: 'long' }); label = label.charAt(0).toUpperCase() + label.slice(1); }
    out.push({ off, label, date: d });
  }
  return out;
}

// A linha do planner de um registro de aula que já existe (o Remarcar).
export const aulaRowOf = (rec) => {
  const d = getSafeDateOrNull(rec?.scheduledFor);
  const p = (x) => String(x).padStart(2, '0');
  return {
    date: d ? startOfLocalDay(d) : null,
    time: d ? `${p(d.getHours())}:${p(d.getMinutes())}` : '18:00',
    professor: rec?.soloTraining ? SOLO_TRAINING : (rec?.professorId || ''),
  };
};

// As aulas do onConfirm, em ordem de data: a primeira é a aula da vez.
export const aulasForConfirm = (resolved) => resolved
  .map((r) => ({ date: at(r.date, r.time), professorId: r.professor === SOLO_TRAINING ? null : r.professor, soloTraining: r.professor === SOLO_TRAINING }))
  .sort((a, b) => a.date - b.date);

// "sex 27/11"
export const shortDay = (d) => `${d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')} ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;

const listText = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`);
export const aulasCountText = (n) => `${n} ${n === 1 ? 'aula' : 'aulas'}`;

export const aulasSentence = (firstName, aulas) =>
  `${firstName || 'O lead'} vira Visitante com ${aulasCountText(aulas.length)}: ${listText(aulas.map((a) => shortDay(a.date)))}.`;

export const aulasRangeText = (aulas) => (aulas.length === 1
  ? `1 aula, ${shortDay(aulas[0].date)}`
  : `${aulasCountText(aulas.length)}, de ${shortDay(aulas[0].date)} a ${shortDay(aulas[aulas.length - 1].date)}`);
