// Lógica de domínio de contratos/matrícula. Funções puras — sem React,
// sem SDK do Firestore. Compartilhada pelo modal de matrícula, pela view
// de Clientes, pelo caminho de "venda" do Kanban e pela categoria de
// renovação da Meta Diária, para que a REGRA viva em um único lugar.

import { addDays, addMonths, daysBetween, getSafeDateOrNull } from './dates.js';
import { fmtBRL } from './format.js';
import { referralConvertedText } from './referrals.js';

const fmtDia = (d) => {
  const date = getSafeDateOrNull(d);
  return date ? date.toLocaleDateString('pt-BR') : '';
};

// Slugs canônicos do status do contrato. `cancelado` e `trancado` são os
// estados ARMAZENADOS (alguém decidiu por eles); agendado/ativo/a_vencer/
// vencido saem do tempo.
export const CONTRACT_STATUS = {
  AGENDADO: 'agendado',
  ATIVO: 'ativo',
  A_VENCER: 'a_vencer',
  TRANCADO: 'trancado',
  VENCIDO: 'vencido',
  CANCELADO: 'cancelado'
};

export const CONTRACT_STATUS_LABEL = {
  agendado: 'Agendado',
  ativo: 'Ativo',
  a_vencer: 'A vencer',
  trancado: 'Trancado',
  vencido: 'Vencido',
  cancelado: 'Cancelado'
};

// Motivos de cancelamento e de trancamento. Lista fixa de propósito: o campo
// existe para virar relatório um dia, e texto livre não agrupa.
export const CONTRACT_CANCEL_REASONS = [
  'Financeiro',
  'Mudou de cidade',
  'Insatisfação',
  'Saúde ou lesão',
  'Foi para outra academia',
  'Outro'
];

export const CONTRACT_PAUSE_REASONS = ['Viagem', 'Saúde ou lesão', 'Financeiro', 'Outro'];

// Janela padrão (em dias) para um contrato ser considerado "a vencer".
// A academia pode sobrescrever via stronix_config (geral).
export const DEFAULT_CONTRACT_THRESHOLD_DAYS = 30;

// Fim da vigência = início + duração (em meses). Retorna null se a data
// de início ou a duração forem inválidas. Gravado no doc do contrato (não
// recalculado na leitura) para congelar a vigência mesmo se o plano mudar.
export const computeEndsAt = (startsAt, durationMonths) => {
  const months = Number(durationMonths);
  if (!Number.isFinite(months) || months <= 0) return null;
  return addMonths(startsAt, months);
};

// Deriva o status "vivo" do contrato a partir de { status, endsAt } + uma
// janela de alerta (thresholdDays). Aceita tanto um doc de contrato quanto
// o resumo denormalizado do lead, desde que tenham `status` e `endsAt`.
// Retorna null quando não há vigência registrada (ex.: cliente legado sem
// contrato) — chamadores tratam isso como "sem contrato".
export const deriveContractStatus = (
  contractLike,
  refDate,
  thresholdDays = DEFAULT_CONTRACT_THRESHOLD_DAYS
) => {
  if (!contractLike) return null;
  if (contractLike.status === CONTRACT_STATUS.CANCELADO) return CONTRACT_STATUS.CANCELADO;
  // Trancado congela tudo: enquanto está parado não vence nem entra em
  // "a vencer" — o tempo do contrato não corre.
  if (contractLike.status === CONTRACT_STATUS.TRANCADO) return CONTRACT_STATUS.TRANCADO;
  const endsAt = getSafeDateOrNull(contractLike.endsAt);
  if (!endsAt) return null;
  const now = getSafeDateOrNull(refDate) || new Date();
  if (now.getTime() > endsAt.getTime()) return CONTRACT_STATUS.VENCIDO;
  // Contrato AGENDADO: assinado com início no futuro. Sem isto ele passava por
  // 'ativo' e a ficha mostrava contagem regressiva de uma vigência que ainda
  // não tinha começado. Vem depois de vencido/cancelado — um contrato não pode
  // estar nos dois estados — e antes de a_vencer/ativo.
  const startsAt = getSafeDateOrNull(contractLike.startsAt);
  if (startsAt && now.getTime() < startsAt.getTime()) return CONTRACT_STATUS.AGENDADO;
  const days = Number(thresholdDays);
  const threshold = Number.isFinite(days) ? days : DEFAULT_CONTRACT_THRESHOLD_DAYS;
  const daysLeft = (endsAt.getTime() - now.getTime()) / 86400000;
  if (daysLeft <= threshold) return CONTRACT_STATUS.A_VENCER;
  return CONTRACT_STATUS.ATIVO;
};

// Conveniência: deriva o status a partir do resumo denormalizado gravado
// no doc do lead (currentContractStatus / currentContractEndsAt).
export const deriveLeadContractStatus = (lead, refDate, thresholdDays) =>
  deriveContractStatus(
    {
      status: lead?.currentContractStatus,
      startsAt: lead?.currentContractStartsAt,
      endsAt: lead?.currentContractEndsAt
    },
    refDate,
    thresholdDays
  );

// Texto humano gravado na timeline (interaction) na matrícula/renovação.
export const buildMatriculaInteractionText = ({ planName, value, endsAt, isRenewal }) => {
  const verb = isRenewal ? 'Renovação registrada' : 'Matrícula realizada';
  const plano = planName ? ` — Plano ${planName}` : '';
  const valorFmt = Number.isFinite(Number(value)) ? ` (${fmtBRL(value)})` : '';
  const endDate = getSafeDateOrNull(endsAt);
  const venc = endDate ? `. Vigência até ${endDate.toLocaleDateString('pt-BR')}.` : '.';
  return `${verb}${plano}${valorFmt}${venc}`;
};

// Monta, em UM só lugar, tudo que uma matrícula/renovação precisa gravar:
//   - `contract`: payload do doc em stronix_contratos (sem createdAt — o
//      caller adiciona serverTimestamp()).
//   - `leadPatch`: campos denormalizados a setar no doc do lead (sem
//      timestamps de SDK e sem currentContractId — o caller injeta o id do
//      doc criado e os serverTimestamp() conforme os sinais abaixo).
//   - `interactionText`: texto da timeline.
//   - sinais para o caller decidir os campos que dependem do SDK:
//       * stampConvertedAt — só na MATRÍCULA. Na RENOVAÇÃO é false de
//         propósito: re-carimbar convertedAt faria isLeadResolvedToday
//         auto-concluir a tarefa de renovação na Meta Diária.
//       * setStatusVenda  — só a matrícula seta status:'Venda'/isConverted.
//       * stampClienteSince — só se o lead ainda não tem clienteSince.
//
// `mode`: 'matricula' (padrão) | 'renovacao'.
export const buildMatriculaWrites = ({
  lead,
  plan,
  value,
  startsAt,
  appUser,
  mode = 'matricula',
  renewedFromId = null
}) => {
  const isRenewal = mode === 'renovacao';
  const start = getSafeDateOrNull(startsAt) || new Date();
  const durationMonths = Number(plan?.durationMonths) || 0;
  const endsAt = computeEndsAt(start, durationMonths);
  const finalValue = Number.isFinite(Number(value)) ? Number(value) : (Number(plan?.value) || 0);
  const listValue = Number(plan?.value) || 0;

  const contract = {
    leadId: lead?.id || null,
    leadName: lead?.name || null,
    planId: plan?.id || null,
    planName: plan?.name || null,
    value: finalValue,
    listValue,
    durationMonths,
    startsAt: start,
    endsAt,
    status: CONTRACT_STATUS.ATIVO,
    cancelledAt: null,
    cancelReason: null,
    renewedFromId: renewedFromId || null,
    // O contrato espelha o CONSULTOR DO LEAD (não quem clicou): garante
    // ranking correto quando um admin matricula em nome de outro consultor
    // e satisfaz a regra de create (consultantAuthUid == auth.uid OU admin).
    // Fallback no appUser cobre leads legados sem esses campos.
    consultantId: lead?.consultantId ?? appUser?.id ?? null,
    consultantName: lead?.consultantName ?? appUser?.name ?? null,
    consultantAuthUid: lead?.consultantAuthUid ?? appUser?.authUid ?? null
  };

  const leadPatch = {
    lifecycleStage: 'cliente',
    currentPlanName: plan?.name || null,
    currentContractValue: finalValue,
    currentContractStartsAt: start,
    currentContractEndsAt: endsAt,
    currentContractStatus: CONTRACT_STATUS.ATIVO,
    // Novo ciclo de contrato = marcos de renovação zerados. Vale tanto para
    // matrícula (lead novo, campos já nascem assim) quanto para renovação
    // (o ciclo anterior pode ter deixado marcos tratados/declínio gravados —
    // ver src/lib/renewalGoal.js).
    renewalHandledCheckpoints: [],
    renewalDeclined: false
  };

  return {
    contract,
    leadPatch,
    interactionText: buildMatriculaInteractionText({
      planName: plan?.name,
      value: finalValue,
      endsAt,
      isRenewal
    }),
    stampConvertedAt: !isRenewal,
    setStatusVenda: !isRenewal,
    stampClienteSince: !lead?.clienteSince,
    // Indicação: na 1ª matrícula (não renovação) o caller grava o 🎉 na
    // timeline do INDICADOR. Id e texto nascem aqui, dos campos denormalizados
    // do lead, para o batch não precisar ler doc nenhum.
    notifyReferrerId: (!isRenewal && lead?.referredById) || null,
    referrerInteractionText: referralConvertedText(lead?.name)
  };
};

// ---------------------------------------------------------------------------
// Desfechos do contrato vigente: cancelar, trancar, reativar e corrigir.
// Cada um devolve { contractPatch, leadPatch, interactionText } — o caller só
// injeta os serverTimestamp() e comita. Puros para caberem em teste.
// ---------------------------------------------------------------------------

// Cancelamento. O motivo era gravado como null desde sempre; sem ele a ficha
// mostrava "Cancelado em 14/05" e ninguém sabia por quê.
export const buildContractCancel = ({ planName, cancelledAt, reason, note } = {}) => {
  const when = getSafeDateOrNull(cancelledAt) || new Date();
  const motivo = reason ? ` — ${reason}` : '';
  return {
    contractPatch: {
      status: CONTRACT_STATUS.CANCELADO,
      cancelledAt: when,
      cancelReason: reason || null,
      cancelNote: note || null
    },
    leadPatch: { currentContractStatus: CONTRACT_STATUS.CANCELADO },
    interactionText: `Contrato cancelado${planName ? ` — Plano ${planName}` : ''}${motivo}. Encerrado em ${fmtDia(when)}.`
  };
};

// Trancamento. Congela a vigência: enquanto está parado o contrato não corre,
// e o término é empurrado na reativação pelos dias efetivamente parados.
export const buildContractPause = ({ planName, pausedAt, reason } = {}) => {
  const when = getSafeDateOrNull(pausedAt) || new Date();
  const motivo = reason ? ` — ${reason}` : '';
  return {
    contractPatch: {
      status: CONTRACT_STATUS.TRANCADO,
      pausedAt: when,
      pauseReason: reason || null
    },
    leadPatch: { currentContractStatus: CONTRACT_STATUS.TRANCADO },
    interactionText: `Contrato trancado a partir de ${fmtDia(when)}${planName ? ` — Plano ${planName}` : ''}${motivo}.`
  };
};

// Reativação. O cliente pagou por N meses de treino, não por N meses de
// calendário: o término anda para frente pelos dias parados. `pausedDaysTotal`
// acumula porque o contrato pode ser trancado mais de uma vez.
export const buildContractResume = ({ contract, resumedAt } = {}) => {
  const back = getSafeDateOrNull(resumedAt) || new Date();
  const pausedAt = getSafeDateOrNull(contract?.pausedAt);
  const endsAt = getSafeDateOrNull(contract?.endsAt);
  const pausedDays = pausedAt ? Math.max(0, daysBetween(pausedAt, back) || 0) : 0;
  const newEndsAt = endsAt && pausedDays > 0 ? addDays(endsAt, pausedDays) : endsAt;
  const total = (Number(contract?.pausedDaysTotal) || 0) + pausedDays;

  return {
    pausedDays,
    newEndsAt,
    contractPatch: {
      status: CONTRACT_STATUS.ATIVO,
      pausedAt: null,
      resumedAt: back,
      pausedDaysTotal: total,
      ...(newEndsAt ? { endsAt: newEndsAt } : {})
    },
    leadPatch: {
      currentContractStatus: CONTRACT_STATUS.ATIVO,
      ...(newEndsAt ? { currentContractEndsAt: newEndsAt } : {})
    },
    interactionText: pausedDays > 0
      ? `Contrato reativado após ${pausedDays} ${pausedDays === 1 ? 'dia' : 'dias'} trancado. Vigência estendida até ${fmtDia(newEndsAt)}.`
      : `Contrato reativado. Vigência mantida até ${fmtDia(newEndsAt || endsAt)}.`
  };
};

// Correção de um contrato já gravado (erro de digitação em plano, valor ou
// início). NÃO é renovação: não cria contrato novo, não mexe em marcos de
// renovação e não recarimba conversão. Preserva os dias já trancados.
export const buildContractEdit = ({ contract, plan, value, startsAt } = {}) => {
  const start = getSafeDateOrNull(startsAt) || getSafeDateOrNull(contract?.startsAt) || new Date();
  const durationMonths = Number(plan?.durationMonths) || Number(contract?.durationMonths) || 0;
  const base = computeEndsAt(start, durationMonths);
  const pausedDaysTotal = Number(contract?.pausedDaysTotal) || 0;
  const endsAt = base && pausedDaysTotal > 0 ? addDays(base, pausedDaysTotal) : base;
  const finalValue = Number.isFinite(Number(value)) ? Number(value) : (Number(contract?.value) || 0);

  return {
    contractPatch: {
      planId: plan?.id ?? contract?.planId ?? null,
      planName: plan?.name ?? contract?.planName ?? null,
      value: finalValue,
      listValue: Number(plan?.value) || Number(contract?.listValue) || 0,
      durationMonths,
      startsAt: start,
      endsAt
    },
    leadPatch: {
      currentPlanName: plan?.name ?? contract?.planName ?? null,
      currentContractValue: finalValue,
      currentContractStartsAt: start,
      currentContractEndsAt: endsAt
    },
    interactionText: `Contrato corrigido — Plano ${plan?.name ?? contract?.planName ?? '—'} (${fmtBRL(finalValue)}), vigência ${fmtDia(start)} → ${fmtDia(endsAt)}.`
  };
};
