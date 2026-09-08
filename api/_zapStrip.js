// Decide se o cartão mostra faixa de destaque e qual. A faixa só aparece
// quando há prazo curto: destaque permanente vira paisagem e a pessoa para de
// enxergar.
//
// NUNCA importe src/lib/dailyGoal.js aqui — ele traz lucide-react e quebra no
// servidor. Os gatilhos são derivados dos módulos puros.
import { deriveLeadContractStatus, CONTRACT_STATUS } from '../src/lib/contracts.js';
import { DEFAULT_RENEWAL_CHECKPOINTS, daysToExpiryOf, activeRenewalCheckpoint } from '../src/lib/renewalGoal.js';
import { getLeadAppointmentType, getLeadAppointmentDate } from '../src/lib/leads.js';
import { getSafeDateOrNull } from '../src/lib/dates.js';

const DAY_MS = 86400000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const isSameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();
const pad = (n) => String(n).padStart(2, '0');
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const ddmm = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
const contagem = (n) => (n === 1 ? 'falta 1 dia' : `faltam ${n} dias`);

// Espelha passDaysLeft de src/lib/freePass.js: a quantidade configurada é a
// validade em DIAS a partir da aula marcada, e o último dia válido é
// data + (N-1). Mantido aqui porque freePass.js não exporta a conta crua.
function freepassInfo(lead, now) {
  const total = Number(lead?.trialClassesPlanned);
  if (!Number.isFinite(total) || total <= 0) return null;
  const marcada = getLeadAppointmentDate(lead);
  if (!marcada) return null;
  const fim = new Date(startOfDay(marcada).getTime() + (total - 1) * DAY_MS);
  const daysLeft = Math.round((fim.getTime() - startOfDay(now).getTime()) / DAY_MS);
  return { daysLeft, fim };
}

export function buildZapStrip(lead, now = new Date(), checkpoints = DEFAULT_RENEWAL_CHECKPOINTS) {
  if (!lead) return null;

  // 1. Compromisso de hoje ganha de tudo.
  const tipo = getLeadAppointmentType(lead);
  const quando = getLeadAppointmentDate(lead);
  if (tipo && quando && isSameDay(quando, now)) {
    const eAula = String(tipo).toLowerCase().startsWith('aula');
    return {
      kind: eAula ? 'aula_hoje' : 'visita_hoje',
      tone: 'agendado',
      text: `${eAula ? 'Aula experimental' : 'Visita'} hoje às ${hhmm(quando)}`
    };
  }

  const status = deriveLeadContractStatus(lead, now);
  const fim = getSafeDateOrNull(lead?.currentContractEndsAt);

  // 2. Contrato vencido.
  if (status === CONTRACT_STATUS.VENCIDO && fim) {
    const ha = Math.round((startOfDay(now).getTime() - startOfDay(fim).getTime()) / DAY_MS);
    return {
      kind: 'vencido',
      tone: 'vencido',
      text: ha === 1 ? 'Contrato vencido há 1 dia' : `Contrato vencido há ${ha} dias`
    };
  }

  // 3. Freepass ainda válido. Tom segue getTrialPassNote: âmbar com 2 dias ou
  // menos, neutro acima disso (o passe está válido, não é alerta).
  const passe = freepassInfo(lead, now);
  if (passe && passe.daysLeft >= 0) {
    return {
      kind: 'freepass',
      tone: passe.daysLeft <= 2 ? 'avencer' : 'neutro',
      text: passe.daysLeft === 0
        ? 'Freepass termina hoje'
        : `Freepass até ${ddmm(passe.fim)} · ${contagem(passe.daysLeft)}`
    };
  }

  // 4. Marco de renovação (90, 60, 30 por padrão).
  if (status === CONTRACT_STATUS.A_VENCER && fim) {
    const marco = activeRenewalCheckpoint(daysToExpiryOf(fim, now), checkpoints);
    if (marco != null) {
      return { kind: 'renovacao', tone: 'avencer', text: `Marco de renovação · ${marco} dias` };
    }
  }

  return null;
}
