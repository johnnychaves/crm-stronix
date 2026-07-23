// Lógica de domínio de contratos/matrícula. Funções puras — sem React,
// sem SDK do Firestore. Compartilhada pelo modal de matrícula, pela view
// de Clientes, pelo caminho de "venda" do Kanban e pela categoria de
// renovação da Meta Diária, para que a REGRA viva em um único lugar.

import { addMonths, getSafeDateOrNull } from './dates.js';
import { fmtBRL } from './format.js';

// Slugs canônicos do status do contrato. `cancelado` é o único estado
// terminal ARMAZENADO; ativo/a_vencer/vencido são derivados do tempo.
export const CONTRACT_STATUS = {
  ATIVO: 'ativo',
  A_VENCER: 'a_vencer',
  VENCIDO: 'vencido',
  CANCELADO: 'cancelado'
};

export const CONTRACT_STATUS_LABEL = {
  ativo: 'Ativo',
  a_vencer: 'A vencer',
  vencido: 'Vencido',
  cancelado: 'Cancelado'
};

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
  const endsAt = getSafeDateOrNull(contractLike.endsAt);
  if (!endsAt) return null;
  const now = getSafeDateOrNull(refDate) || new Date();
  if (now.getTime() > endsAt.getTime()) return CONTRACT_STATUS.VENCIDO;
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
    { status: lead?.currentContractStatus, endsAt: lead?.currentContractEndsAt },
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
    stampClienteSince: !lead?.clienteSince
  };
};
