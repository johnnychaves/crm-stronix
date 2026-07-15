// Janela em que o atalho de presença pode sair do neutro (marcar "veio"/"faltou"):
// de 15 min ANTES até 15 min DEPOIS do horário agendado do compromisso. Fora dela
// o switch fica travado no neutro. Usado só na tela de Visitas/Aulas experimentais.
export const PRESENCE_MARK_WINDOW_MS = 15 * 60 * 1000;

// Aceita Date, Timestamp já convertido, string ISO ou epoch ms. Sem data agendada
// ou com "agora" inválido → retorna false (trava, nunca libera por engano).
export function canMarkPresenceNow(scheduledDate, nowMs, windowMs = PRESENCE_MARK_WINDOW_MS) {
  if (scheduledDate == null || !Number.isFinite(nowMs)) return false;
  const t = scheduledDate instanceof Date ? scheduledDate.getTime() : new Date(scheduledDate).getTime();
  if (!Number.isFinite(t)) return false;
  return nowMs >= t - windowMs && nowMs <= t + windowMs;
}
