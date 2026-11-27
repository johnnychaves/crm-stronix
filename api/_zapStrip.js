// Decide se o cartão mostra faixa de destaque e qual. A faixa só aparece
// quando há prazo curto: destaque permanente vira paisagem e a pessoa para de
// enxergar.
//
// NUNCA importe src/lib/dailyGoal.js aqui — ele traz lucide-react e quebra no
// servidor. Os gatilhos são derivados dos módulos puros.
//
// Hora escrita e conta de dias saem do horário de Brasília
// (_horarioDeBrasilia.js), nunca de getHours()/getDate(): a função da Vercel
// roda em UTC.
import { deriveLeadContractStatus, CONTRACT_STATUS } from '../src/lib/contracts.js';
import { DEFAULT_RENEWAL_CHECKPOINTS, daysToExpiryOf, activeRenewalCheckpoint } from '../src/lib/renewalGoal.js';
import { normalizeRenewalCheckpoints } from '../src/lib/leadStatus.js';
import { getLeadAppointmentType, getLeadAppointmentDate } from '../src/lib/leads.js';
import { getSafeDateOrNull } from '../src/lib/dates.js';
import { visitorOf, FREEPASS_KINDS } from '../src/lib/visitante.js';
import { diaDeBrasilia, horaDeBrasilia, ddmmDoDia, meiaNoiteDoDia } from './_horarioDeBrasilia.js';

const contagem = (n) => (n === 1 ? 'falta 1 dia' : `faltam ${n} dias`);

// Espelha passDaysLeft de src/lib/freePass.js: a quantidade configurada é a
// validade em DIAS a partir da aula marcada, e o último dia válido é
// data + (N-1). Mantido aqui porque freePass.js não exporta a conta crua. A
// tela conta no fuso do navegador; aqui os dias são os do calendário de
// Brasília. Devolve o último dia válido (número de diaDeBrasilia), ou null.
function freepassInfo(lead) {
  const total = Number(lead?.trialClassesPlanned);
  if (!Number.isFinite(total) || total <= 0) return null;
  const marcada = getLeadAppointmentDate(lead);
  if (!marcada) return null;
  return diaDeBrasilia(marcada) + (total - 1);
}

// A faixa do freepass por dias, do último dia válido (número de diaDeBrasilia).
// Tom segue getTrialPassNote: âmbar com 2 dias ou menos, neutro acima disso (o
// passe está válido, não é alerta).
function porDias(fimDia, now) {
  const daysLeft = Math.round(fimDia - diaDeBrasilia(now));
  if (daysLeft < 0) return null;
  return {
    kind: 'freepass',
    tone: daysLeft <= 2 ? 'avencer' : 'neutro',
    text: daysLeft === 0 ? 'Freepass termina hoje' : `Freepass até ${ddmmDoDia(fimDia)} · ${contagem(daysLeft)}`
  };
}

// Com o resumo do freepass no lead (entrega 2 do Visitante), a faixa sai dele,
// pelo visitorOf: por dias, o último dia; por aulas, quantas já foram marcadas.
// Sem o resumo, vale a conta antiga do trialClassesPlanned.
function faixaDoFreepass(lead, now) {
  if (!lead.freepassId) {
    const fimDia = freepassInfo(lead);
    return fimDia == null ? null : porDias(fimDia, now);
  }
  // shortcut: o visitorOf lê o dia no fuso do processo. A meia-noite de
  // Brasília e as datas do freepass (gravadas na meia-noite de Brasília) caem no
  // mesmo dia em UTC e em Brasília; vale para esses dois fusos.
  const v = visitorOf(lead, meiaNoiteDoDia(diaDeBrasilia(now)));
  if (!v) return null;
  if (v.kind === FREEPASS_KINDS.AULAS) {
    return { kind: 'freepass', tone: 'neutro', text: `Freepass · ${v.aulas ?? 0} de ${v.total} ${v.total === 1 ? 'aula' : 'aulas'}` };
  }
  const fim = getSafeDateOrNull(v.endsAt);
  return fim ? porDias(diaDeBrasilia(fim), now) : null;
}

export function buildZapStrip(lead, now = new Date(), checkpoints = DEFAULT_RENEWAL_CHECKPOINTS) {
  if (!lead) return null;

  // Marcos configurados pela academia (Configurações → Metas & ritmo). Mesma
  // normalização de PaceSection.jsx: array vazio, valores fora de 1..365 ou
  // lixo (string, negativo) cai no padrão 90/60/30 — nunca desliga a faixa.
  const marcos = normalizeRenewalCheckpoints(checkpoints);

  // 1. Compromisso de hoje ganha de tudo.
  const tipo = getLeadAppointmentType(lead);
  const quando = getLeadAppointmentDate(lead);
  if (tipo && quando && diaDeBrasilia(quando) === diaDeBrasilia(now)) {
    const eAula = String(tipo).toLowerCase().startsWith('aula');
    return {
      kind: eAula ? 'aula_hoje' : 'visita_hoje',
      tone: 'agendado',
      text: `${eAula ? 'Aula experimental' : 'Visita'} hoje às ${horaDeBrasilia(quando)}`
    };
  }

  const status = deriveLeadContractStatus(lead, now);
  const fim = getSafeDateOrNull(lead?.currentContractEndsAt);

  // 2. Contrato vencido.
  if (status === CONTRACT_STATUS.VENCIDO && fim) {
    const ha = diaDeBrasilia(now) - diaDeBrasilia(fim);
    return {
      kind: 'vencido',
      tone: 'vencido',
      text: ha === 1 ? 'Contrato vencido há 1 dia' : `Contrato vencido há ${ha} dias`
    };
  }

  // 3. Freepass ainda válido.
  const passe = faixaDoFreepass(lead, now);
  if (passe) return passe;

  // 4. Marco de renovação (90, 60, 30 por padrão, ou os marcos da academia).
  // Gatilho INDEPENDENTE do status "a vencer" do sistema (que usa o threshold
  // fixo de 30 dias — contracts.js) — mesma regra de shouldPromptRenewal em
  // renewalGoal.js: o marco mais distante (ex.: 90 dias) precisa disparar bem
  // antes do threshold de 30, senão nenhum marco > 30 nunca aparece. Só fica
  // de fora quem não tem vigência correndo: cancelado, trancado ou agendado
  // (vencido já saiu na checagem 2, acima). A renovação emendada que ainda não
  // começou (currentContractSeamless) não é agendada: o resumo do lead dá
  // ativo ou a vencer, então a faixa pode mostrar o marco de renovação, igual
  // à Meta Diária (shouldPromptRenewal).
  if (
    fim &&
    status !== CONTRACT_STATUS.CANCELADO &&
    status !== CONTRACT_STATUS.TRANCADO &&
    status !== CONTRACT_STATUS.AGENDADO
  ) {
    const marco = activeRenewalCheckpoint(daysToExpiryOf(fim, now), marcos);
    if (marco != null) {
      return { kind: 'renovacao', tone: 'avencer', text: `Marco de renovação · ${marco} dias` };
    }
  }

  return null;
}
