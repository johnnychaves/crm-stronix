// Contas de cada linha de Todos os leads: o que diz a próxima ação, há quanto
// tempo o lead foi cadastrado e o trilho da fase no funil. Puro, sem tela.
import { calendarDaysBetween, getSafeDateOrNull } from './dates.js';

const timeOf = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dayOf = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

// Próxima ação: `text` diz quando e `sub` a data. `overdue` vem da tela, que já
// aplica a regra (fora Venda e Perda, e a data já passou). tone: late, today,
// soon (até uma semana), later e none.
export function nextActionOf(lead, now, overdue) {
  const at = getSafeDateOrNull(lead?.nextFollowUp);
  if (!at) return { text: 'Sem agendamento', sub: '', tone: 'none' };
  const days = calendarDaysBetween(now, at);
  const time = timeOf(at);
  if (overdue) {
    return days === 0
      ? { text: 'Atrasado', sub: `era hoje às ${time}`, tone: 'late' }
      : { text: `Atrasado há ${-days} ${-days === 1 ? 'dia' : 'dias'}`, sub: `${dayOf(at)} às ${time}`, tone: 'late' };
  }
  if (days === 0) return { text: `Hoje às ${time}`, sub: '', tone: 'today' };
  if (days === 1) return { text: `Amanhã às ${time}`, sub: dayOf(at), tone: 'soon' };
  return { text: `Em ${days} dias`, sub: `${dayOf(at)} às ${time}`, tone: days <= 7 ? 'soon' : 'later' };
}

// Há quanto tempo o lead foi cadastrado, em dias do calendário.
export function createdAgoOf(createdAt, now) {
  const days = calendarDaysBetween(createdAt, now);
  if (days == null) return '';
  return days <= 0 ? 'hoje' : days === 1 ? 'ontem' : `há ${days} dias`;
}

const closed = (l) => l.status === 'Venda' || l.status === 'Perda';
// Milissegundos da data, ou null (o `timeOf` daqui de cima é só a hora escrita).
const msOf = (d) => getSafeDateOrNull(d)?.getTime() ?? null;
const cmp = (x, y) => (x === y ? 0 : x < y ? -1 : 1);

// A ordem da lista, em cópia nova. 'cadastro' é o mais novo primeiro. 'acao'
// põe quem tem próxima ação na frente, pela data (o atrasado vem antes de
// todos, por ser a data mais antiga), depois quem não tem agendamento, e
// Venda e Perda por último. 'contato' começa por quem está há mais tempo sem
// registro (`lastContactOf` dá a última interação, e sem ela vale o
// cadastro), com os encerrados no fim. O desempate é sempre o cadastro mais novo.
export function sortLeads(leads, ordem, lastContactOf = () => null) {
  const byCreated = (a, b) => cmp(msOf(b.createdAt) ?? 0, msOf(a.createdAt) ?? 0);
  if (ordem === 'acao') {
    const rank = (l) => (closed(l) ? 2 : l.nextFollowUp ? 0 : 1);
    return [...leads].sort((a, b) => cmp(rank(a), rank(b))
      || (rank(a) === 0 ? cmp(msOf(a.nextFollowUp), msOf(b.nextFollowUp)) : 0)
      || byCreated(a, b));
  }
  if (ordem === 'contato') {
    // Uma conta por lead, e não uma por comparação. Sem nenhuma data (nem
    // interação, nem cadastro), a pausa é desconhecida e vai para o fim dos abertos.
    const since = new Map(leads.map((l) => [l, msOf(lastContactOf(l)) ?? msOf(l.createdAt) ?? Infinity]));
    return [...leads].sort((a, b) => cmp(closed(a), closed(b)) || cmp(since.get(a), since.get(b)) || byCreated(a, b));
  }
  return [...leads].sort(byCreated);
}

// O trilho: uma barra por fase aberta do funil, cheia até a fase do lead.
// Venda enche todas e Perda também, só que marcada como perdida. Fase que não
// está na lista (lead antigo) fica sem barra cheia e sem posição.
export function trailOf(status, stageNames) {
  const total = stageNames.length;
  if (status === 'Venda') return { kind: 'venda', filled: total, total, position: null };
  if (status === 'Perda') return { kind: 'perda', filled: total, total, position: null };
  const at = stageNames.indexOf(status);
  return { kind: 'open', filled: at + 1, total, position: at >= 0 ? at + 1 : null };
}
