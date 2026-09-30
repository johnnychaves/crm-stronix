// Lógica de domínio de contratos/matrícula. Funções puras — sem React,
// sem SDK do Firestore. Compartilhada pelo modal de matrícula, pela view
// de Clientes, pelo caminho de "venda" do Kanban e pela categoria de
// renovação da Meta Diária, para que a REGRA viva em um único lugar.

import { addDays, addMonths, calendarDaysBetween, daysBetween, getSafeDateOrNull } from './dates.js';
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

// Como a renovação encosta no contrato que ela renova, em dias do calendário.
// Emendada: começa no dia seguinte ao fim, e não é agendada (decisão do
// Johnny, 28/09/2026). Sobreposta: começa no dia do fim ou antes, e o contrato
// renovado passa a terminar na véspera do novo. Regra única do modal e da
// gravação. Mora aqui, e não em renewal.js, porque contracts.js não pode
// importar renewal.js (ciclo).
export function renewalJoinOf(prevEndsAt, startsAt) {
  const diff = calendarDaysBetween(prevEndsAt, startsAt);
  if (diff == null) return { seamless: false, overlaps: false, previousEndsAt: null };
  return {
    seamless: diff === 1,
    overlaps: diff <= 0,
    previousEndsAt: diff <= 0 ? addDays(startsAt, -1) : null
  };
}

export const isSeamlessStart = (prevEndsAt, startsAt) => renewalJoinOf(prevEndsAt, startsAt).seamless;

// A véspera da renovação sobreposta precisa cair dentro da vigência do
// contrato renovado: antes do fim e depois do início. Começar no início dele,
// ou antes, deixaria um contrato de duração zero ou negativa. Vale na gravação
// da renovação (buildMatriculaWrites) e na correção dela (buildContractEdit).
const eveFitsIn = (join, prevStart, prevEnd) => Boolean(
  join.overlaps && prevStart && prevEnd
  && join.previousEndsAt.getTime() < prevEnd.getTime()
  && join.previousEndsAt.getTime() > prevStart.getTime()
);

// Por que uma renovação não pode ser gravada, ou null. Recebe o status GRAVADO
// e o início do contrato renovado, do documento dele ou do resumo do lead.
// Contrato trancado: o fim dele ainda anda na reativação, então emendar ou
// encurtar daria conta errada. Contrato cancelado: o cliente volta por uma
// matrícula nova. A lista da Meta Diária e o quadro de Renovações carregam uma
// vez por dia, e o contrato pode ter sido cancelado depois. Contrato que ainda
// não começou (instante do início depois de `now`), mesmo o emendado: trocar o
// plano ou a data dele é pelo Corrigir. A renovação começa no mínimo dois dias
// depois do início do contrato renovado, em dias do calendário. No dia do
// início, ou antes, ela encurtaria esse contrato para antes de ele começar. No
// dia seguinte, a véspera dela cairia no próprio início, o contrato renovado
// não teria como ser encurtado (buildMatriculaWrites) e os dois valeriam
// juntos. Renovar um contrato um dia depois de ele começar é engano, e o
// Corrigir da ficha resolve.
// `correcting`: a mesma regra no Corrigir da renovação (ContractEditModal). Lá
// o texto para na regra, porque mandar usar o Corrigir de dentro dele não
// ajuda, e o cancelado e o que ainda não começou não barram: são travas de
// renovar, e a renovação corrigida já existe.
export function renewalStartProblem({ status, startsAt: prevStartsAt } = {}, startsAt, { correcting = false, now = new Date() } = {}) {
  if (status === CONTRACT_STATUS.TRANCADO) return 'Este contrato está trancado. Reative o contrato antes de renovar.';
  const prevStart = getSafeDateOrNull(prevStartsAt);
  if (!correcting) {
    if (status === CONTRACT_STATUS.CANCELADO) return 'Este contrato foi cancelado. Para o cliente voltar, faça uma nova matrícula pela ficha.';
    const ref = getSafeDateOrNull(now) || new Date();
    if (prevStart && prevStart.getTime() > ref.getTime()) {
      return `Este contrato ainda não começou (começa em ${fmtDia(prevStart)}). Para trocar o plano ou a data, use Corrigir na ficha do cliente.`;
    }
  }
  const diff = calendarDaysBetween(prevStart, startsAt);
  if (diff != null && diff <= 1) {
    const regra = `A renovação precisa começar a partir de ${fmtDia(addDays(prevStart, 2))}, dois dias depois do início do contrato renovado.`;
    return correcting ? regra : `${regra} Para trocar o plano desse contrato, use Corrigir na ficha do cliente.`;
  }
  return null;
}

// A renovação ainda de pé de um contrato: a primeira que o renova
// (renewedFromId) e não foi cancelada, ou null. Contrato que já tem renovação
// não cancelada não pode ser renovado de novo. O Kanban e a Meta Diária passam
// o lead da lista, e o resumo dele ainda pode apontar para o contrato antigo.
export function liveRenewalOf(contractId, contracts) {
  if (!contractId || !Array.isArray(contracts)) return null;
  return contracts.find(c => c?.renewedFromId === contractId && c?.status !== CONTRACT_STATUS.CANCELADO) || null;
}

// Contrato que nunca valeu: cancelado no instante do início ou antes dele, como
// a renovação de que o cliente desistiu. Regra única da ficha, dos modais e dos
// painéis (Operacional e Gerencial). Aceita o doc cru do Firestore (Timestamp)
// ou o contrato normalizado (Date).
export const neverTookEffect = (c) => {
  const cancelled = getSafeDateOrNull(c?.cancelledAt);
  const start = getSafeDateOrNull(c?.startsAt);
  return Boolean(cancelled && start && cancelled.getTime() <= start.getTime());
};

// Deriva o status "vivo" do contrato a partir de { status, startsAt, endsAt,
// seamless } + uma janela de alerta (thresholdDays). Aceita tanto um doc de
// contrato quanto o resumo denormalizado do lead, desde que tenham `status` e
// `endsAt`; `startsAt` decide o agendado, e `seamless` (renovação emendada)
// tira dele o contrato que começa no dia seguinte ao fim do anterior.
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
  // O emendado (seamless) não é agendado: o cliente não fica um dia sem
  // contrato, então segue para as regras de "A vencer" e "Ativo" pelo fim dele.
  const startsAt = getSafeDateOrNull(contractLike.startsAt);
  if (startsAt && now.getTime() < startsAt.getTime() && !contractLike.seamless) return CONTRACT_STATUS.AGENDADO;
  const days = Number(thresholdDays);
  const threshold = Number.isFinite(days) ? days : DEFAULT_CONTRACT_THRESHOLD_DAYS;
  const daysLeft = (endsAt.getTime() - now.getTime()) / 86400000;
  if (daysLeft <= threshold) return CONTRACT_STATUS.A_VENCER;
  return CONTRACT_STATUS.ATIVO;
};

// ---------------------------------------------------------------------------
// Bloco "em uso" do resumo do lead
// ---------------------------------------------------------------------------
// Enquanto o último contrato (currentContractId) ainda não começou, o resumo
// guarda também o contrato que o cliente usa hoje: id, status gravado (ativo,
// trancado ou cancelado) e fim. É uma cópia: quem grava é a renovação, o
// trancar, o reativar e o cancelar do contrato em uso e o corrigir da
// renovação; matrícula, importação, cancelar a renovação e Ativar agora limpam.
// A ficha não lê o bloco, porque lê os contratos; as listas, a Meta Diária e o
// cartão do Stronizap leem, por deriveLeadContractStatus.
export const CLEAR_IN_USE_BLOCK = Object.freeze({ inUseContractId: null, inUseContractStatus: null, inUseContractEndsAt: null });

const storedStatusOf = (status) => (
  status === CONTRACT_STATUS.TRANCADO || status === CONTRACT_STATUS.CANCELADO ? status : CONTRACT_STATUS.ATIVO
);

// O bloco a partir do documento do contrato em uso. `overrides` troca o status
// ou o fim quando a gravação os muda no mesmo lote (trancar, reativar,
// cancelar, encurtar).
export const inUseBlockOf = (contract, overrides = {}) => ({
  inUseContractId: contract?.id || null,
  inUseContractStatus: storedStatusOf(contract?.status),
  inUseContractEndsAt: getSafeDateOrNull(contract?.endsAt),
  ...overrides
});

// O estado do cliente pelo bloco, ou null quando o bloco não decide. Vale só
// com o último contrato ainda por começar (por instante), o bloco apontando um
// contrato e o último não cancelado. Trancado dá trancado. Cancelado dá
// agendado: o cliente fica sem contrato até a renovação começar. Valendo, dá
// ativo, e nunca "a vencer", porque o cliente já renovou. Com o fim já passado,
// a emendada continua com a marca (currentContractSeamless) decidindo, como
// antes desta entrega, senão o dia entre o fim do contrato em uso e o início
// dela apareceria como agendado; sem a marca, é o intervalo: agendado.
// Comparação por instante, nunca por dia do calendário: o cartão do Stronizap
// roda em UTC.
const inUseStatusOf = (lead, refDate) => {
  if (!lead?.inUseContractId || lead.currentContractStatus === CONTRACT_STATUS.CANCELADO) return null;
  const start = getSafeDateOrNull(lead.currentContractStartsAt);
  const now = getSafeDateOrNull(refDate) || new Date();
  if (!start || start.getTime() <= now.getTime()) return null;
  if (lead.inUseContractStatus === CONTRACT_STATUS.TRANCADO) return CONTRACT_STATUS.TRANCADO;
  if (lead.inUseContractStatus === CONTRACT_STATUS.CANCELADO) return CONTRACT_STATUS.AGENDADO;
  const end = getSafeDateOrNull(lead.inUseContractEndsAt);
  if (end && now.getTime() <= end.getTime()) return CONTRACT_STATUS.ATIVO;
  return lead.currentContractSeamless ? null : CONTRACT_STATUS.AGENDADO;
};

// Conveniência: deriva o status a partir do resumo denormalizado gravado no
// doc do lead. O bloco "em uso" decide primeiro (inUseStatusOf); sem ele, o
// último contrato (currentContractStatus / currentContractEndsAt).
export const deriveLeadContractStatus = (lead, refDate, thresholdDays) =>
  inUseStatusOf(lead, refDate) || deriveContractStatus(
    {
      status: lead?.currentContractStatus,
      startsAt: lead?.currentContractStartsAt,
      endsAt: lead?.currentContractEndsAt,
      seamless: lead?.currentContractSeamless
    },
    refDate,
    thresholdDays
  );

// Contrato "vivo": o que ainda vale ou vai valer. Decide se fechar pelo funil
// Upgrade é renovação (liga ao atual e emenda a vigência) ou nova matrícula.
export const hasLiveContract = (lead, refDate, thresholdDays) => {
  if (!lead?.currentContractId) return false;
  const cs = deriveLeadContractStatus(lead, refDate, thresholdDays);
  return cs === CONTRACT_STATUS.ATIVO || cs === CONTRACT_STATUS.A_VENCER
    || cs === CONTRACT_STATUS.AGENDADO || cs === CONTRACT_STATUS.TRANCADO;
};

// Contrato em vigor em `at`: ativo ou a vencer pelo status derivado, ou
// vencido no próprio dia do fim (`end`, o mesmo fim que deu o status). Só ele é
// emendado ou encurtado por uma renovação (buildMatriculaWrites e
// buildContractEdit, que usam esta função e renewalTakeoverAt para as duas
// contas não se separarem). O fim gravado à meia-noite deixa o contrato vencido
// durante o último dia inteiro, e renovar nesse dia é comum: sem o último dia,
// a renovação emendada apareceria agendada até a meia-noite. Cancelado,
// trancado e agendado ficam de fora: emendar neles deixaria o lead ativo com o
// Operacional contando o cliente fora da base, e encurtar mexeria no fim de um
// contrato que não vale. A renovação emendada que ainda não começou deriva como
// ativa, então a corrente de renovações segue.
const isInForce = (status, end, at) => status === CONTRACT_STATUS.ATIVO
  || status === CONTRACT_STATUS.A_VENCER
  || (status === CONTRACT_STATUS.VENCIDO && calendarDaysBetween(at, end) === 0);

// O instante em que o contrato renovado precisa estar em vigor (isInForce).
// Com o início da renovação já chegado, a véspera dele: é ali que a renovação
// assume, e a sobreposição se decide ali mesmo que o renovado tenha vencido
// depois. Encerrar na véspera não tem exceção para o vencido (decisão do
// Johnny, 29/09/2026), e é o caso da renovação lançada depois do vencimento,
// com o início que o aluno pagou, e da correção feita meses depois. Com o
// início no futuro, agora. Nos dois casos a trava da lista velha continua:
// cancelado e trancado derivam assim em qualquer data, e o que ainda não
// começou agora também não tinha começado na véspera.
const renewalTakeoverAt = (start, now) => {
  const ref = getSafeDateOrNull(now) || new Date();
  return start.getTime() <= ref.getTime() ? addDays(start, -1) : ref;
};

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
// `previousContract`: o DOC do contrato atual, quando o chamador o tem. É dele
// que saem o fim e o início usados na emenda e no encurtamento. Sem ele (ou com
// um doc que não é o atual do lead), a renovação não encurta nada.
// `now`: a hora da gravação. Com o início já chegado, o contrato atual precisa
// estar em vigor na véspera dele para ser emendado ou encurtado; com o início
// no futuro, agora (renewalTakeoverAt). Padrão: o relógio.
export const buildMatriculaWrites = ({
  lead,
  plan,
  value,
  startsAt,
  appUser,
  mode = 'matricula',
  renewedFromId = null,
  previousContract = null,
  now = new Date()
}) => {
  const isRenewal = mode === 'renovacao';
  const start = getSafeDateOrNull(startsAt) || new Date();
  const durationMonths = Number(plan?.durationMonths) || 0;
  const endsAt = computeEndsAt(start, durationMonths);
  const finalValue = Number.isFinite(Number(value)) ? Number(value) : (Number(plan?.value) || 0);
  const listValue = Number(plan?.value) || 0;

  // Renovação: como o contrato novo encosta no atual (renewalJoinOf). A
  // emendada conta como ativa desde já. A sobreposta encurta o atual para a
  // véspera do novo, e o fim de antes fica guardado para a renovação poder ser
  // desfeita (buildRenewalCancel). Encurtado o atual, o novo começa no dia
  // seguinte ao fim dele e também conta como emendado (seamless, abaixo).
  // As datas saem do DOCUMENTO do contrato atual quando o chamador o tem. O
  // Kanban e a Meta Diária passam o lead da lista, e o resumo dele pode estar
  // velho: um fim velho mais tarde faria o "encurtamento" esticar o contrato e
  // guardar um fim original falso. Sem o documento, o resumo do lead decide só
  // a marca de emendada, e nada é encurtado: o id do lead pode ser velho, e o
  // encurtamento vai por update, que num contrato que não existe derrubaria a
  // renovação inteira.
  const currentDoc = isRenewal && previousContract?.id && previousContract.id === lead?.currentContractId ? previousContract : null;
  const currentEnd = isRenewal && lead?.currentContractId
    ? getSafeDateOrNull(currentDoc ? currentDoc.endsAt : lead?.currentContractEndsAt)
    : null;
  const join = currentEnd ? renewalJoinOf(currentEnd, start) : { seamless: false, overlaps: false, previousEndsAt: null };
  // Só o contrato em vigor quando a renovação assume (isInForce, no instante de
  // renewalTakeoverAt) é emendado ou encurtado. O vencido que ainda valia na
  // véspera de um início que já chegou entra: a renovação lançada depois do
  // vencimento, com início antes do fim, encurta o vencido. O status sai da
  // mesma fonte das datas: o documento, quando ele é usado, senão o resumo do
  // lead. O lead da lista pode dizer ativo com o documento já cancelado.
  const at = renewalTakeoverAt(start, now);
  const inForce = isRenewal && isInForce(
    currentDoc ? deriveContractStatus(currentDoc, at) : deriveLeadContractStatus(lead, at),
    currentEnd,
    at
  );
  // A véspera do novo precisa cair dentro da vigência do atual (eveFitsIn).
  // Importado pode vir sem início, e aí vale a criação, como no Operacional
  // (operacional/base.js).
  const currentStart = getSafeDateOrNull(currentDoc?.startsAt) || getSafeDateOrNull(currentDoc?.createdAt);
  // Contrato que outra renovação já encurtou (shortenedById) não é encurtado de
  // novo: o originalEndsAt passaria a guardar o fim encurtado, e o fim original
  // de verdade se perderia. Isso acontece com o lead velho da lista, que ainda
  // aponta para ele. Desfeita a renovação, a marca volta a null e ele encurta.
  const canShorten = Boolean(inForce && currentDoc && !currentDoc.shortenedById && eveFitsIn(join, currentStart, currentEnd));
  // A sobreposta que encurta o atual também é emendada: o atual passa a
  // terminar na véspera do novo, então o novo começa no dia seguinte ao fim
  // dele e não fica agendado. Sem encurtar (sem o documento, ou com ele já
  // encurtado por outra renovação), os dois valem juntos e a marca fica false.
  // Fora de vigor, nem a emenda marca: o novo fica agendado até começar.
  const seamless = inForce && (join.seamless || canShorten);
  // O bloco "em uso" do resumo (inUseBlockOf): com a renovação começando depois
  // de agora e o contrato renovado em vigor, o cliente segue usando o renovado
  // até ela começar, com o fim encurtado quando a gravação encurta. Sem o
  // documento, o id e o fim saem do resumo do lead, como a marca. Renovação
  // que já começa valendo, e matrícula, limpam o bloco.
  const ref = getSafeDateOrNull(now) || new Date();
  const inUseBlock = inForce && start.getTime() > ref.getTime()
    ? inUseBlockOf({ id: lead.currentContractId, status: CONTRACT_STATUS.ATIVO, endsAt: canShorten ? join.previousEndsAt : currentEnd })
    : CLEAR_IN_USE_BLOCK;

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
    seamless,
    // Fechou de dentro do funil Upgrade (decisão 9 do spec): a marca vem do
    // funil, não do plano. Renovação continua sendo renewedFromId; o mesmo
    // contrato pode ser os dois, e é uma venda só.
    closedFromUpgrade: Boolean(lead?.upgradeStageId),
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
    currentContractSeamless: seamless,
    ...inUseBlock,
    // Novo ciclo de contrato = marcos de renovação zerados. Vale tanto para
    // matrícula (lead novo, campos já nascem assim) quanto para renovação
    // (o ciclo anterior pode ter deixado marcos tratados/declínio gravados —
    // ver src/lib/renewalGoal.js).
    renewalHandledCheckpoints: [],
    renewalDeclined: false,
    renewalDeclinedAt: null,
    renewalDeclineReason: null,
    // Etapa no funil VENCIDOS do board (src/lib/expiredFunnel.js). Sem esta
    // limpeza, o cliente que voltou e vencesse de novo daqui a dois anos
    // reapareceria na etapa da vida passada — bug silencioso de longo prazo.
    reactivationStageId: null,
    // Funil UPGRADE (src/lib/upgradeFunnel.js): contrato novo, venha de onde
    // vier, tira o cliente do funil. Sem isto, quem fechou pela ficha ou pelo
    // Vencidos continuaria parado no Upgrade com um contrato novo.
    upgradeStageId: null,
    upgradeEnteredAt: null
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
    referrerInteractionText: referralConvertedText(lead?.name),
    // Sobreposição: o contrato atual a encurtar. O caller grava no mesmo batch
    // e acrescenta shortenedById com o id do contrato novo.
    previousContractId: canShorten ? lead.currentContractId : null,
    previousPatch: canShorten ? { endsAt: join.previousEndsAt, originalEndsAt: currentEnd } : null
  };
};

// Desconto de um contrato: tabela menos o valor fechado, a mesma conta do
// Gerencial (gerencial/sales.js). O discountValue gravado não é lido: depois
// de uma correção ele podia guardar o desconto antigo. Sem tabela, zero.
export const contractDiscountOf = (contract) => {
  const value = Number(contract?.value) || 0;
  const list = Number(contract?.listValue) || value;
  return Math.max(Math.round((list - value) * 100) / 100, 0);
};

// ---------------------------------------------------------------------------
// Desfechos do contrato vigente: cancelar, trancar, reativar e corrigir.
// Cada um devolve { contractPatch, leadPatch, interactionText } — o caller só
// injeta os serverTimestamp() e comita. Puros para caberem em teste.
// ---------------------------------------------------------------------------

// Cancelamento. O motivo era gravado como null desde sempre; sem ele a ficha
// mostrava "Cancelado em 14/05" e ninguém sabia por quê.
// `role`: 'current' (padrão) grava o resumo do último contrato, como sempre;
// 'inUse' cancela o contrato em uso com a renovação marcada (`next`): grava só
// o bloco "em uso" do resumo, e precisa do `contract` para montá-lo. A
// renovação continua marcada; a emendada perde a marca, no contrato
// (`nextPatch`) e no resumo, porque passa a existir um intervalo até ela
// começar. O texto ganha a frase da renovação, lida por contractEventOf.
export const buildContractCancel = ({ planName, cancelledAt, reason, note, role = 'current', contract = null, next = null } = {}) => {
  const when = getSafeDateOrNull(cancelledAt) || new Date();
  const motivo = reason ? ` — ${reason}` : '';
  const inUse = role === 'inUse';
  const nextStart = inUse ? getSafeDateOrNull(next?.startsAt) : null;
  const dropSeam = Boolean(inUse && next?.seamless);
  return {
    contractPatch: {
      status: CONTRACT_STATUS.CANCELADO,
      cancelledAt: when,
      cancelReason: reason || null,
      cancelNote: note || null
    },
    leadPatch: inUse
      ? { ...inUseBlockOf(contract, { inUseContractStatus: CONTRACT_STATUS.CANCELADO }), ...(dropSeam ? { currentContractSeamless: false } : {}) }
      : { currentContractStatus: CONTRACT_STATUS.CANCELADO },
    nextPatch: dropSeam ? { seamless: false } : null,
    interactionText: `Contrato cancelado${planName ? ` — Plano ${planName}` : ''}${motivo}. Encerrado em ${fmtDia(when)}.${nextStart ? ` A renovação continua marcada para ${fmtDia(nextStart)}.` : ''}`
  };
};

// Renovação cancelada antes de começar: nunca valeu, e o cliente volta ao
// contrato que ela renovava. Vale quando o contrato renovado existe, é o ligado
// e não foi cancelado, e o cancelamento cai no instante do início ou antes dele
// (neverTookEffect, a mesma regra dos painéis). A data do modal é a meia-noite
// do dia escolhido, então o próprio dia do início ainda desfaz a renovação.
export function isRenewalNotStarted(contract, previous, at) {
  if (!contract?.renewedFromId || !previous || previous.id !== contract.renewedFromId) return false;
  if (previous.status === CONTRACT_STATUS.CANCELADO || contract.status === CONTRACT_STATUS.CANCELADO) return false;
  return neverTookEffect({ cancelledAt: at, startsAt: contract.startsAt });
}

// Desfaz a renovação que ainda não começou. O fim do contrato renovado volta
// ao original, se foi esta renovação que o encurtou, e o resumo do lead volta
// para ele. Os marcos de renovação seguem zerados, como a renovação deixou: se
// o contrato renovado estiver perto do fim, a Meta Diária volta a cobrar.
// Os textos da linha do tempo são lidos por contractEventOf (timeline.js): o
// plano da renovação vem logo depois dos dois-pontos e para em ", motivo " ou
// em ". O contrato". Mudou um texto aqui, mude o leitor e o timeline.test.js.
export function buildRenewalCancel({ contract, previous, cancelledAt, reason, note } = {}) {
  const when = getSafeDateOrNull(cancelledAt) || new Date();
  const original = getSafeDateOrNull(previous?.originalEndsAt);
  const restores = Boolean(original && contract?.id && previous?.shortenedById === contract.id);
  const end = restores ? original : getSafeDateOrNull(previous?.endsAt);
  // Importado pode vir sem valor, e aí o resumo fica sem valor, como a
  // importação grava. Number(null) daria zero.
  const value = previous?.value == null ? null : Number(previous.value);

  const renovacao = contract?.planName ? `Plano ${contract.planName}` : 'renovação';
  const motivo = reason ? `, motivo ${reason}` : '';
  const anterior = previous?.planName ? `Plano ${previous.planName}` : 'anterior';
  // O contrato renovado pode ter vencido antes do cancelamento, quando a
  // renovação começaria depois de um intervalo. O último dia ainda é dele.
  const volta = !end
    ? `O contrato ${anterior} volta a ser o atual.`
    : calendarDaysBetween(when, end) < 0
      ? `O contrato ${anterior}, que venceu em ${fmtDia(end)}, volta a ser o atual.`
      : `O contrato ${anterior} volta a valer até ${fmtDia(end)}.`;

  return {
    contractPatch: {
      status: CONTRACT_STATUS.CANCELADO,
      cancelledAt: when,
      cancelReason: reason || null,
      cancelNote: note || null
    },
    previousPatch: restores ? { endsAt: original, originalEndsAt: null, shortenedById: null } : null,
    leadPatch: {
      currentContractId: previous?.id || null,
      currentPlanName: previous?.planName || null,
      currentContractValue: Number.isFinite(value) ? value : null,
      currentContractStartsAt: getSafeDateOrNull(previous?.startsAt) || getSafeDateOrNull(previous?.createdAt),
      currentContractEndsAt: end,
      currentContractStatus: previous?.status || CONTRACT_STATUS.ATIVO,
      currentContractSeamless: Boolean(previous?.seamless),
      // O resumo volta ao contrato renovado, que passa a ser o último: sem bloco.
      ...CLEAR_IN_USE_BLOCK
    },
    interactionText: `Renovação cancelada antes de começar: ${renovacao}${motivo}. ${volta}`
  };
}

// Trancamento. Congela a vigência: enquanto está parado o contrato não corre,
// e o término é empurrado na reativação pelos dias efetivamente parados.
// `role` 'inUse' (o contrato em uso, com renovação marcada) grava só o bloco
// "em uso" do resumo, montado do `contract`.
export const buildContractPause = ({ planName, pausedAt, reason, role = 'current', contract = null } = {}) => {
  const when = getSafeDateOrNull(pausedAt) || new Date();
  const motivo = reason ? ` — ${reason}` : '';
  return {
    contractPatch: {
      status: CONTRACT_STATUS.TRANCADO,
      pausedAt: when,
      pauseReason: reason || null
    },
    leadPatch: role === 'inUse'
      ? inUseBlockOf(contract, { inUseContractStatus: CONTRACT_STATUS.TRANCADO })
      : { currentContractStatus: CONTRACT_STATUS.TRANCADO },
    interactionText: `Contrato trancado a partir de ${fmtDia(when)}${planName ? ` — Plano ${planName}` : ''}${motivo}.`
  };
};

// Contrato que veio de planilha (clientImport.js). Importado entra na base,
// mas nunca conta como venda, cancelamento ou trancamento feito no sistema.
export const isImportedContract = (c) => Boolean(c?.importBatchId || c?.importSource || c?.importedBy);

const HALF_DAY_MS = 43200000;

// `at` cai no dia civil (horário local) de `day`, com folga opcional.
const onDayOf = (at, day, slackMs = 0) => {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
  return at.getTime() + slackMs >= start && at.getTime() - slackMs < end;
};

// Pausa gravada pela importação. O trancado da planilha vira pausedAt = hora
// da importação (clientImport.js), sem data real e sem motivo, e o contrato
// nasce com importedAt no mesmo dia (clientImportWrites.js). Então é da
// importação a pausa de contrato importado que começa no dia em que ele foi
// gravado (importedAt; sem ele, createdAt).
// Na pausa atual (sem folga) o motivo também decide: a ficha sempre grava um
// (ContractOutcomeModal) e a importação nunca grava, então trancar pela ficha
// no dia da importação é pausa de verdade. Na pausa refeita o motivo não serve,
// porque a reativação não o apaga e ele fica de uma pausa para a outra.
// `slackMs` é para esse início refeito pelo total de dias, que arredonda para
// dias inteiros e erra até meio dia.
export const isImportPause = (contract, pausedAt, slackMs = 0) => {
  if (!isImportedContract(contract)) return false;
  if (!slackMs && contract?.pauseReason) return false;
  const at = getSafeDateOrNull(pausedAt);
  const day = getSafeDateOrNull(contract?.importedAt) || getSafeDateOrNull(contract?.createdAt);
  return Boolean(at && day && onDayOf(at, day, slackMs));
};

// Cancelamento gravado pela importação: o cancelado da planilha vira
// cancelledAt = endsAt, sem motivo (clientImport.js). O que o app grava depois,
// mesmo em contrato importado, é cancelamento como outro qualquer.
export const isImportCancel = (contract) => {
  if (!isImportedContract(contract) || contract?.cancelReason) return false;
  const at = getSafeDateOrNull(contract?.cancelledAt);
  const end = getSafeDateOrNull(contract?.endsAt);
  return Boolean(at && end && onDayOf(at, end));
};

// Pausa de contrato de antes do histórico, refeita a partir da última
// reativação e do total de dias parados. Várias pausas antigas viram uma. A
// reativação grava esta conta no histórico e o Operacional faz a mesma ao ler.
export const reconstructedPauseOf = (contract) => {
  const resumedAt = getSafeDateOrNull(contract?.resumedAt);
  const days = Number(contract?.pausedDaysTotal) || 0;
  if (!resumedAt || days <= 0) return null;
  const pausedAt = addDays(resumedAt, -days);
  return { pausedAt, resumedAt, fromImport: isImportPause(contract, pausedAt, HALF_DAY_MS) };
};

// Pausas já encerradas, para o Operacional saber em que meses o cliente
// esteve trancado. Contrato de antes do histórico começa com UM item refeito.
const closedPausesOf = (contract) => {
  if (Array.isArray(contract?.pauseHistory) && contract.pauseHistory.length) return contract.pauseHistory;
  const r = reconstructedPauseOf(contract);
  return r
    ? [{ pausedAt: r.pausedAt, resumedAt: r.resumedAt, reconstructed: true, ...(r.fromImport ? { fromImport: true } : {}) }]
    : [];
};

// Reativação. O cliente pagou por N meses de treino, não por N meses de
// calendário: o término anda para frente pelos dias parados. `pausedDaysTotal`
// acumula porque o contrato pode ser trancado mais de uma vez. O contrato que
// uma renovação encurtou (originalEndsAt) anda o fim original pelos mesmos
// dias, para o "Cancelar renovação" devolver a data certa depois. `role`
// 'inUse' grava só o bloco "em uso" do resumo, com o fim novo.
export const buildContractResume = ({ contract, resumedAt, role = 'current' } = {}) => {
  const back = getSafeDateOrNull(resumedAt) || new Date();
  const pausedAt = getSafeDateOrNull(contract?.pausedAt);
  const endsAt = getSafeDateOrNull(contract?.endsAt);
  const pausedDays = pausedAt ? Math.max(0, daysBetween(pausedAt, back) || 0) : 0;
  const newEndsAt = endsAt && pausedDays > 0 ? addDays(endsAt, pausedDays) : endsAt;
  const total = (Number(contract?.pausedDaysTotal) || 0) + pausedDays;
  // A pausa gravada pela importação usa a hora da importação, não a data real.
  const fromImport = isImportPause(contract, pausedAt);
  const original = getSafeDateOrNull(contract?.originalEndsAt);

  return {
    pausedDays,
    newEndsAt,
    contractPatch: {
      status: CONTRACT_STATUS.ATIVO,
      pausedAt: null,
      resumedAt: back,
      pausedDaysTotal: total,
      ...(newEndsAt ? { endsAt: newEndsAt } : {}),
      ...(original && pausedDays > 0 ? { originalEndsAt: addDays(original, pausedDays) } : {}),
      ...(pausedAt ? {
        pauseHistory: [
          ...closedPausesOf(contract),
          { pausedAt, resumedAt: back, ...(fromImport ? { fromImport: true } : {}) }
        ]
      } : {})
    },
    leadPatch: role === 'inUse'
      ? inUseBlockOf(contract, { inUseContractStatus: CONTRACT_STATUS.ATIVO, inUseContractEndsAt: newEndsAt || endsAt })
      : {
        currentContractStatus: CONTRACT_STATUS.ATIVO,
        ...(newEndsAt ? { currentContractEndsAt: newEndsAt } : {})
      },
    interactionText: pausedDays > 0
      ? `Contrato reativado após ${pausedDays} ${pausedDays === 1 ? 'dia' : 'dias'} trancado. Vigência estendida até ${fmtDia(newEndsAt)}.`
      : `Contrato reativado. Vigência mantida até ${fmtDia(newEndsAt || endsAt)}.`
  };
};

// Tabela que vale na correção. Mesmo plano: a tabela gravada no contrato, a do
// dia da venda, porque o catálogo pode ter sido reajustado depois e corrigir
// só a data não pode mudar o desconto. Plano trocado: a tabela do plano novo.
export const editListValueOf = (contract, plan) => {
  const samePlan = Boolean(plan?.id && contract?.planId && plan.id === contract.planId);
  const own = Number(contract?.listValue) || 0;
  return (samePlan && own) || Number(plan?.value) || own;
};

// Na correção, o motivo do desconto só é obrigatório quando o negócio muda
// (outro plano ou outro valor) ou quando o contrato já tinha motivo, que vem
// marcado. Corrigir só a data de um contrato antigo, com desconto sem motivo,
// não pode travar.
export const correctionNeedsReason = ({ contract, plan, value, hasDiscount }) => {
  if (!hasDiscount) return false;
  const dealChanged = plan?.id !== contract?.planId || value !== (Number(contract?.value) || 0);
  return dealChanged || Boolean(contract?.discountReason);
};

// A correção muda o início? Conta por dia do calendário: o campo de data do
// modal dá a meia-noite, e o mesmo dia com outra hora não é mudança. Sem início
// gravado, conta como mudança. Só um início novo recalcula a emenda
// (buildContractEdit) e passa pela regra de início da renovação no modal de
// correção (ContractEditModal).
export const correctionMovesStart = (contract, startsAt) => calendarDaysBetween(contract?.startsAt, startsAt) !== 0;

// O patch muda alguma coisa no contrato renovado? Mesmo fim (o instante), mesmo
// fim original e a mesma marca de quem encurtou: não há o que gravar nele.
const sameInstant = (a, b) => (getSafeDateOrNull(a)?.getTime() ?? null) === (getSafeDateOrNull(b)?.getTime() ?? null);
const changesPrevious = (previous, patch) => !(
  sameInstant(previous?.endsAt, patch.endsAt)
  && sameInstant(previous?.originalEndsAt, patch.originalEndsAt)
  && (previous?.shortenedById || null) === (patch.shortenedById || null)
);

// Correção de um contrato já gravado (erro de digitação em plano, valor ou
// início). NÃO é renovação: não cria contrato novo, não mexe em marcos de
// renovação e não recarimba conversão. Preserva os dias já trancados.
// O desconto é recalculado junto (tabela menos o valor corrigido). 'nenhum' e
// 'final' são os valores de DISCOUNT_MODES (renewal.js), escritos aqui porque
// importar renewal.js fecharia um ciclo.
// `previous`: o DOC do contrato que esta renovação renova, quando o chamador o
// tem. Com ele vem `previousPatch`, o que gravar nele, ou null.
// `now`: a hora da correção. Com o início novo já chegado, o anterior precisa
// estar em vigor na véspera dele para a renovação ser emendada ou encurtá-lo;
// com o início novo no futuro, agora (renewalTakeoverAt). Padrão: o relógio.
export const buildContractEdit = ({ contract, plan, value, startsAt, discountReason, previous = null, now = new Date() } = {}) => {
  const start = getSafeDateOrNull(startsAt) || getSafeDateOrNull(contract?.startsAt) || new Date();
  const durationMonths = Number(plan?.durationMonths) || Number(contract?.durationMonths) || 0;
  const base = computeEndsAt(start, durationMonths);
  const pausedDaysTotal = Number(contract?.pausedDaysTotal) || 0;
  const endsAt = base && pausedDaysTotal > 0 ? addDays(base, pausedDaysTotal) : base;
  const finalValue = Number.isFinite(Number(value)) ? Number(value) : (Number(contract?.value) || 0);
  const listValue = editListValueOf(contract, plan);
  const discountValue = contractDiscountOf({ value: finalValue, listValue });
  const hasDiscount = discountValue > 0.005;
  const sameDeal = finalValue === (Number(contract?.value) || 0) && listValue === (Number(contract?.listValue) || 0);
  const priorMode = contract?.discountMode && contract.discountMode !== 'nenhum' ? contract.discountMode : null;

  // Renovação com o início corrigido: a marca de emendada e o fim do contrato
  // renovado acompanham o início novo, com as mesmas regras da gravação da
  // renovação (buildMatriculaWrites). Se foi esta renovação que encurtou o
  // anterior, a conta parte do fim original dele, para o fim de verdade nunca
  // se perder. Sobrepondo, o anterior termina na véspera do novo, e o novo
  // conta como emendado. Não se encurta o que outra renovação encurtou, e só o
  // anterior em vigor quando a renovação assume (isInForce, no instante de
  // renewalTakeoverAt) é emendado ou encurtado: trancado (o fim ainda anda na
  // reativação), cancelado e agendado ficam de fora. O vencido não fica: a
  // correção feita depois de o anterior vencer encurta como a gravação
  // encurtaria. O fim que esta renovação encurtou só volta ao original quando o
  // início novo não sobrepõe ou quando o anterior não pode ser encurtado.
  // Só um início novo recalcula (correctionMovesStart). Com o mesmo início, ou
  // sem o anterior ligado, a marca fica como estava e nenhum outro contrato é
  // gravado: corrigir só o valor de uma renovação antiga não encurta a
  // sobreposição dela (decisão do Johnny, 28/09/2026).
  const startChanged = correctionMovesStart(contract, start);
  let seamless = Boolean(contract?.seamless);
  let previousPatch = null;
  // O bloco "em uso" do resumo: null é "não mexer".
  let inUseBlock = null;
  if (startChanged && contract?.renewedFromId && previous?.id === contract.renewedFromId) {
    const original = getSafeDateOrNull(previous.originalEndsAt);
    const shortenedByThis = Boolean(original && previous.shortenedById && previous.shortenedById === contract.id);
    const shortenedByOther = Boolean(previous.shortenedById && previous.shortenedById !== contract.id);
    const refEnd = shortenedByThis ? original : getSafeDateOrNull(previous.endsAt);
    // Em vigor pelo fim de referência. Pelo fim encurtado, o anterior que esta
    // renovação encurtou e cujo fim novo já passou leria como vencido, e a
    // correção de volta para a emenda perderia a marca.
    const at = renewalTakeoverAt(start, now);
    const inForce = isInForce(deriveContractStatus({ ...previous, endsAt: refEnd }, at), refEnd, at);
    const prevStart = getSafeDateOrNull(previous.startsAt) || getSafeDateOrNull(previous.createdAt);
    const join = renewalJoinOf(refEnd, start);
    const canShorten = inForce && !shortenedByOther && eveFitsIn(join, prevStart, refEnd);
    seamless = inForce && (join.seamless || canShorten);
    let patch = null;
    if (canShorten) patch = { endsAt: join.previousEndsAt, originalEndsAt: refEnd, shortenedById: contract.id };
    else if (shortenedByThis) patch = { endsAt: refEnd, originalEndsAt: null, shortenedById: null };
    previousPatch = patch && changesPrevious(previous, patch) ? patch : null;
    // Com o início novo ainda no futuro e o anterior já começado, o bloco
    // aponta o anterior com o status dele (trancado e cancelado inclusive) e o
    // fim depois desta correção: o encurtado, o devolvido ou o de sempre. Com
    // o início novo já chegado, o último contrato passou a valer: bloco limpo.
    const ref = getSafeDateOrNull(now) || new Date();
    const started = Boolean(prevStart && prevStart.getTime() <= ref.getTime());
    inUseBlock = start.getTime() > ref.getTime() && started
      ? inUseBlockOf(previous, { inUseContractEndsAt: patch ? patch.endsAt : refEnd })
      : CLEAR_IN_USE_BLOCK;
  }

  return {
    contractPatch: {
      planId: plan?.id ?? contract?.planId ?? null,
      planName: plan?.name ?? contract?.planName ?? null,
      value: finalValue,
      listValue,
      durationMonths,
      startsAt: start,
      endsAt,
      seamless,
      discountMode: hasDiscount ? ((sameDeal && priorMode) || 'final') : 'nenhum',
      discountValue: hasDiscount ? discountValue : 0,
      discountReason: hasDiscount ? (discountReason ?? contract?.discountReason ?? null) : null
    },
    leadPatch: {
      currentPlanName: plan?.name ?? contract?.planName ?? null,
      currentContractValue: finalValue,
      currentContractStartsAt: start,
      currentContractEndsAt: endsAt,
      currentContractSeamless: seamless,
      ...(inUseBlock || {})
    },
    previousPatch,
    interactionText: `Contrato corrigido — Plano ${plan?.name ?? contract?.planName ?? '—'} (${fmtBRL(finalValue)}), vigência ${fmtDia(start)} → ${fmtDia(endsAt)}.`
  };
};

// Ativar agora: o contrato que ainda não começou passa a começar agora, com a
// duração vendida; plano, valor e desconto não mudam. É a correção do início
// (buildContractEdit), com as mesmas regras do contrato em uso (`previous`, o
// que este contrato renova): em vigor, ele passa a terminar ontem, com
// originalEndsAt e shortenedById, e o ativado leva a marca de emendado;
// trancado ou cancelado, nada é encurtado. O bloco "em uso" do lead é limpo,
// porque o último contrato passou a valer. Começa "agora" com a hora, como o
// "Começar hoje" do ContractModal. `daysLost`: os dias do contrato em uso que
// se perdem no encurtamento, para o modal; `scheduledFor`: a data que estava
// marcada. O texto da linha do tempo é lido por contractEventOf (tipo
// `ativacao`): mudou aqui, mude lá e no timeline.test.js.
export function buildContractActivate({ contract, previous = null, now = new Date() } = {}) {
  const at = getSafeDateOrNull(now) || new Date();
  const edit = buildContractEdit({
    contract, plan: null, value: contract?.value, startsAt: at,
    discountReason: contract?.discountReason ?? null, previous, now: at
  });
  const shortened = Boolean(edit.previousPatch?.shortenedById);
  const original = getSafeDateOrNull(previous?.originalEndsAt);
  const plannedEnd = original && previous?.shortenedById === contract?.id ? original : getSafeDateOrNull(previous?.endsAt);
  const daysLost = shortened ? Math.max(0, calendarDaysBetween(edit.previousPatch.endsAt, plannedEnd) || 0) : 0;
  const { planName, value, endsAt } = edit.contractPatch;
  return {
    ...edit,
    scheduledFor: getSafeDateOrNull(contract?.startsAt),
    daysLost,
    leadPatch: { ...edit.leadPatch, ...CLEAR_IN_USE_BLOCK },
    interactionText: `Contrato ativado antes da data marcada — Plano ${planName ?? '—'} (${fmtBRL(value)}), vigência ${fmtDia(at)} → ${fmtDia(endsAt)}.`
  };
}
