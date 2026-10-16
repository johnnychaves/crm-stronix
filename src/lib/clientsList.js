// Vigência de cada linha da lista de Clientes: o texto de quanto falta (ou
// passou) do contrato e a régua de quanto dele já correu. A situação vem de
// fora, de deriveLeadContractStatus, para a lista e este texto nunca
// discordarem. Os dias são do calendário, como no resto do app.
import { CONTRACT_STATUS } from './contracts.js';
import { calendarDaysBetween, getSafeDateOrNull } from './dates.js';

function textFor(status, left, start, now) {
  if (status === CONTRACT_STATUS.TRANCADO) return 'contrato trancado';
  if (status === CONTRACT_STATUS.CANCELADO) return 'contrato cancelado';
  if (status === CONTRACT_STATUS.AGENDADO) {
    const n = start ? calendarDaysBetween(now, start) : null;
    if (n == null) return 'contrato agendado';
    return n <= 0 ? 'começa hoje' : n === 1 ? 'começa amanhã' : `começa em ${n} dias`;
  }
  if (left > 0) return left === 1 ? 'vence amanhã' : `vence em ${left} dias`;
  if (left === 0) return status === CONTRACT_STATUS.VENCIDO ? 'venceu hoje' : 'vence hoje';
  return left === -1 ? 'venceu ontem' : `venceu há ${-left} dias`;
}

// null quando o lead não tem data de fim: a lista mostra um traço.
// pct é de 0 a 1 (null sem data de início) e warn pinta o texto do "a vencer".
export function vigenciaOf(lead, status, now) {
  let end = getSafeDateOrNull(lead?.currentContractEndsAt);
  let start = getSafeDateOrNull(lead?.currentContractStartsAt);
  // Renovação marcada: a situação vem do contrato em uso (inUseStatusOf, em
  // contracts.js), então o fim também. Os campos "current" são os da renovação,
  // que ainda não começou, e dariam "vence em 390 dias" e uma régua vazia.
  const inUseEnd = getSafeDateOrNull(lead?.inUseContractEndsAt);
  if (
    lead?.inUseContractId && status !== CONTRACT_STATUS.AGENDADO && inUseEnd
    && start && start.getTime() > now.getTime() && inUseEnd.getTime() >= now.getTime()
  ) {
    end = inUseEnd;
    start = null;
  }
  if (!end) return null;
  const total = start ? end.getTime() - start.getTime() : 0;
  // Trancado não corre e cancelado já parou: a régua só vale para o que está em curso.
  const runs = status !== CONTRACT_STATUS.TRANCADO && status !== CONTRACT_STATUS.CANCELADO;
  return {
    text: textFor(status, calendarDaysBetween(now, end), start, now),
    dateText: end.toLocaleDateString('pt-BR'),
    pct: runs && total > 0 ? Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / total)) : null,
    warn: status === CONTRACT_STATUS.A_VENCER,
  };
}
