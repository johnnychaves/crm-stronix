// Regra do passe livre (Aulas experimentais): a quantidade configurada em
// Opções → Regras gerais (trialClassOptions, ex.: 1/2/7/15) é a VALIDADE do
// passe em DIAS, gravada por agendamento em `trialClassesPlanned`. Último dia
// válido = data da aula marcada + (N-1) dias. Extraído de
// AppointmentTrackingView (era local ali) para ser reusado pela aba "Em
// andamento" e pelo relatório exportável sem duplicar a conta de dias.
import { getLeadAppointmentDate } from './leads.js';

const DAY_MS = 86400000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Núcleo puro e único do cálculo: quantos dias faltam para o passe expirar.
// null quando o agendamento não registrou a quantidade (trialClassesPlanned
// ausente/inválida) ou não tem data marcada — nesses casos não há passe a
// mostrar/considerar. 0 = expira hoje; negativo = já expirou.
function passDaysLeft(lead, now) {
  const days = Number(lead?.trialClassesPlanned);
  if (!Number.isFinite(days) || days <= 0) return null;
  const d = getLeadAppointmentDate(lead);
  if (!d) return null;
  const endDay = new Date(startOfDay(d).getTime() + (days - 1) * DAY_MS);
  return { daysLeft: Math.round((endDay.getTime() - startOfDay(now).getTime()) / DAY_MS), endDay };
}

// True quando o passe da aula AINDA NÃO expirou (daysLeft >= 0). Base da aba
// "Em andamento" e do filtro do relatório exportável. Sem quantidade
// registrada = sem passe = não ativo.
export function isPassActive(lead, now = new Date()) {
  const r = passDaysLeft(lead, now);
  return Boolean(r) && r.daysLeft >= 0;
}

// Nota do passe livre pra exibir na coluna "Passe livre" (Aulas): mostra o
// término e um contador regressivo. Retorna null quando o agendamento não
// registrou a quantidade (mesma regra de isPassActive, sem duplicar a conta).
export function getTrialPassNote(lead, now = new Date()) {
  const r = passDaysLeft(lead, now);
  if (!r) return null;
  const { daysLeft, endDay } = r;
  const fmt = endDay.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  if (daysLeft < 0) return { text: `passe expirou ${fmt}`, cls: 'text-rose-700 dark:text-rose-400' };
  if (daysLeft === 0) return { text: 'passe termina hoje', cls: 'text-amber-700 dark:text-amber-400' };
  const conta = daysLeft === 1 ? 'falta 1 dia' : `faltam ${daysLeft} dias`;
  return {
    text: `até ${fmt} · ${conta}`,
    cls: daysLeft <= 2 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-neutral-400'
  };
}
