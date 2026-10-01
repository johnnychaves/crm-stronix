// Gravação de uma matrícula/renovação no Firestore. O QUE gravar é decidido
// por buildMatriculaWrites (lib/contracts.js, puro); aqui fica o COMO —
// o writeBatch com o contrato, o resumo no lead e o evento da timeline.
//
// Existe para que o modal de matrícula e o de renovação compartilhem o mesmo
// caminho de escrita: eram 45 linhas de batch que iam divergir na primeira
// mudança de regra.

import { collection, doc, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { appId, LEADS_PATH, INTERACTIONS_PATH, CONTRACTS_PATH } from './firebase.js';
import { getInteractionSecurityFields } from './leads.js';
import { buildMatriculaWrites } from './contracts.js';
import { markConvertingAula } from './aulasWrites.js';
import { withBucket } from './leadDerived.js';
import { matriculaStageChange } from './stageMove.js';

// Grava um desfecho do contrato VIGENTE (cancelar, trancar, reativar,
// corrigir). O patch vem pronto dos construtores puros de contracts.js —
// aqui só entra o batch: contrato + resumo no lead + evento na timeline.
export async function commitContractPatch({
  db,
  lead,
  appUser,
  contractId,
  contractPatch,
  leadPatch,
  interactionText,
  linkedContractId = null,
  linkedContractPatch = null
}) {
  if (!contractId) throw new Error('Contrato não informado.');
  const batch = writeBatch(db);

  batch.set(
    doc(db, 'artifacts', appId, 'public', 'data', CONTRACTS_PATH, contractId),
    { ...contractPatch, updatedAt: serverTimestamp() },
    { merge: true }
  );

  // Contrato ligado, quando o desfecho mexe em outro contrato: o renovado
  // (cancelar a renovação que não começou, corrigir o início de uma renovação,
  // Ativar agora) ou o próximo (cancelar o contrato em uso tira a marca de
  // emendada da renovação marcada). update, e não set com merge: se o contrato
  // não existir mais, o batch inteiro falha em vez de criar um contrato
  // fantasma só com datas.
  if (linkedContractId && linkedContractPatch) {
    batch.update(
      doc(db, 'artifacts', appId, 'public', 'data', CONTRACTS_PATH, linkedContractId),
      { ...linkedContractPatch, updatedAt: serverTimestamp() }
    );
  }

  batch.set(
    doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
    { ...leadPatch, lastInteractionAt: serverTimestamp(), interactionsCount: increment(1) },
    { merge: true }
  );

  batch.set(
    doc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH)),
    {
      leadId: lead.id,
      consultantName: appUser?.name || null,
      ...getInteractionSecurityFields(lead, appUser),
      actorId: appUser?.id || null,
      actorAuthUid: appUser?.authUid || null,
      text: interactionText,
      type: 'status_change',
      createdAt: serverTimestamp()
    }
  );

  await batch.commit();
}

// Resolve tudo num único batch e devolve o id do contrato criado.
// `contractExtra` carrega os campos que só a renovação preenche (modo e valor
// do desconto, motivo) — o payload base continua vindo de buildMatriculaWrites.
// `previousContract` é o doc do contrato atual: sem ele, a renovação que
// sobrepõe o atual não encurta nada (evita gravar um contrato fantasma).
// `now` é a hora da gravação, que buildMatriculaWrites usa para saber se o
// contrato atual está em vigor. Padrão: o relógio.
export async function commitMatricula({
  db,
  lead,
  appUser,
  plan,
  value,
  startsAt,
  mode = 'matricula',
  renewedFromId = null,
  previousContract = null,
  contractExtra = null,
  now = new Date()
}) {
  const {
    contract,
    leadPatch,
    interactionText,
    stampConvertedAt,
    setStatusVenda,
    stampClienteSince,
    notifyReferrerId,
    referrerInteractionText,
    previousContractId,
    previousPatch
  } = buildMatriculaWrites({ lead, plan, value, startsAt, appUser, mode, renewedFromId, previousContract, now });

  // Troca de etapa para Venda (base do CRM). null na renovação, quando o lead
  // já está em Venda, e também quando quem matricula já é cliente — o card
  // projetado dos funis Renovações, Vencidos e Upgrade chega com o nome da
  // coluna em `status`, e essa matrícula não é troca de etapa de lead.
  const stageChange = matriculaStageChange(lead, setStatusVenda);

  const batch = writeBatch(db);

  // (1) Contrato — id gerado client-side para já referenciá-lo no lead.
  const contractRef = doc(collection(db, 'artifacts', appId, 'public', 'data', CONTRACTS_PATH));
  batch.set(contractRef, { ...contract, ...(contractExtra || {}), createdAt: serverTimestamp() });

  // (1b) Renovação que começa antes do fim do atual: o atual passa a terminar
  //      na véspera do novo, no mesmo batch, e guarda quem o encurtou. update, e
  //      não set com merge: se o contrato não existir mais, o batch inteiro
  //      falha em vez de criar um contrato fantasma só com datas.
  if (previousContractId && previousPatch) {
    batch.update(
      doc(db, 'artifacts', appId, 'public', 'data', CONTRACTS_PATH, previousContractId),
      { ...previousPatch, shortenedById: contractRef.id, updatedAt: serverTimestamp() }
    );
  }

  // (2) Resumo denormalizado no lead. Os campos que dependem do SDK
  //     (serverTimestamp / status de venda) entram aqui conforme os sinais
  //     retornados por buildMatriculaWrites.
  const leadRef = doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id);
  const leadUpdate = {
    ...leadPatch,
    currentContractId: contractRef.id,
    lastInteractionAt: serverTimestamp(),
    interactionsCount: increment(1)
  };
  if (setStatusVenda) {
    leadUpdate.status = 'Venda';
    leadUpdate.isConverted = true;
    leadUpdate.lossReason = null;
    leadUpdate.lostAt = null;
    leadUpdate.nextFollowUp = null;
  }
  if (stampConvertedAt) leadUpdate.convertedAt = serverTimestamp();
  if (stampClienteSince) leadUpdate.clienteSince = serverTimestamp();
  if (stageChange) leadUpdate.statusEnteredAt = serverTimestamp();
  // lifecycleBucket derivado do estado RESULTANTE (o patch muda
  // lifecycleStage/status/isConverted) — sempre 'cliente' aqui.
  batch.set(leadRef, withBucket(leadUpdate, lead), { merge: true });

  // (3) Timeline — mantém o histórico e (na matrícula) o auto-fechar da Meta.
  const interactionRef = doc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH));
  batch.set(interactionRef, {
    leadId: lead.id,
    consultantName: appUser?.name || null,
    ...getInteractionSecurityFields(lead, appUser),
    actorId: appUser?.id || null,
    actorAuthUid: appUser?.authUid || null,
    text: interactionText,
    type: 'status_change',
    ...stageChange,
    createdAt: serverTimestamp()
  });

  // (4) Indicação: 🎉 na timeline do INDICADOR quando o indicado fecha a 1ª
  //     matrícula. Só o doc de interação — nada de patch no doc do indicador
  //     (indicação não é contato real; ver hasActiveInteractionToday). O
  //     leadName evita evento anônimo no extrato: o indicador é cliente e não
  //     está na base ativa em memória.
  if (notifyReferrerId) {
    const referrerInteractionRef = doc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH));
    batch.set(referrerInteractionRef, {
      leadId: notifyReferrerId,
      leadName: lead.referredByName || null,
      consultantName: appUser?.name || null,
      ...getInteractionSecurityFields(lead, appUser),
      actorId: appUser?.id || null,
      actorAuthUid: appUser?.authUid || null,
      text: referrerInteractionText,
      type: 'referral',
      createdAt: serverTimestamp()
    });
  }

  await batch.commit();

  // Histórico de aulas (dual-write best-effort): só na matrícula (não
  // renovação) — atribui a conversão à última aula atendida do lead.
  if (setStatusVenda) {
    try { await markConvertingAula({ db, leadId: lead.id }); } catch (e) { console.error('markConvertingAula falhou', e); }
  }

  return { contractId: contractRef.id };
}
