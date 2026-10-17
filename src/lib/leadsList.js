// Contas de cada linha de Todos os leads: o que diz a próxima ação, há quanto
// tempo o lead foi cadastrado e o trilho da fase no funil. Puro, sem tela.
import { calendarDaysBetween, getSafeDateOrNull } from './dates.js';
import { newLeadDueOf } from './dailyGoal.js';

const timeOf = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dayOf = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const closed = (l) => l.status === 'Venda' || l.status === 'Perda';

// O lead está atrasado? O próximo contato já passou, ou é o lead novo sem
// próximo passo que a Meta cobra em Atrasados (newLeadDueOf, em dailyGoal.js),
// passada a janela de 24h do cadastro. Venda e Perda nunca.
export function isLeadOverdue(lead, now) {
  if (!lead || closed(lead)) return false;
  const next = getSafeDateOrNull(lead.nextFollowUp);
  if (next) return next < now;
  const due = newLeadDueOf(lead);
  return Boolean(due && due < now);
}

// Próxima ação: `text` diz quando e `sub` a data. `overdue` vem da tela, pelo
// isLeadOverdue. tone: late, today, soon (até uma semana), later e none.
export function nextActionOf(lead, now, overdue) {
  const at = getSafeDateOrNull(lead?.nextFollowUp);
  if (!at) {
    // O lead novo sem próximo passo, atrasado desde o fim da janela de 24h.
    const due = overdue ? newLeadDueOf(lead) : null;
    if (!due) return { text: 'Sem agendamento', sub: '', tone: 'none' };
    const late = -calendarDaysBetween(now, due);
    return { text: late > 0 ? `Atrasado há ${late} ${late === 1 ? 'dia' : 'dias'}` : 'Atrasado', sub: 'sem próximo passo', tone: 'late' };
  }
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

// Milissegundos da data, ou null (o `timeOf` daqui de cima é só a hora escrita).
const msOf = (d) => getSafeDateOrNull(d)?.getTime() ?? null;
const cmp = (x, y) => (x === y ? 0 : x < y ? -1 : 1);

// A ordem da lista, em cópia nova. 'cadastro' é o mais novo primeiro. 'acao'
// põe quem tem próxima ação na frente, pela data (o atrasado vem antes de
// todos, por ser a data mais antiga), depois quem não tem agendamento, e
// Venda e Perda por último. O lead novo sem próximo passo que já está atrasado
// (isLeadOverdue) entra com os que têm data, pelo fim da janela de 24h, como
// na Meta. 'contato' começa por quem está há mais tempo sem registro
// (`lastContactOf` dá a última interação, e sem ela vale o cadastro), com os
// encerrados no fim. O desempate é sempre o cadastro mais novo.
export function sortLeads(leads, ordem, lastContactOf = () => null, now = new Date()) {
  const byCreated = (a, b) => cmp(msOf(b.createdAt) ?? 0, msOf(a.createdAt) ?? 0);
  if (ordem === 'acao') {
    const actionAt = new Map(leads.map((l) => [
      l,
      msOf(l.nextFollowUp) ?? (isLeadOverdue(l, now) ? msOf(newLeadDueOf(l)) : null),
    ]));
    const rank = (l) => (closed(l) ? 2 : actionAt.get(l) != null ? 0 : 1);
    return [...leads].sort((a, b) => cmp(rank(a), rank(b))
      || (rank(a) === 0 ? cmp(actionAt.get(a), actionAt.get(b)) : 0)
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
