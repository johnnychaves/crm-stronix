// Especificações PURAS de query dos consumidores paginados da PR E — separadas
// da execução (firebase) para (a) serem testáveis sem Firestore e (b) travar em
// teste o casamento com os índices compostos de firestore.indexes.json (a PR D).
// Enquanto a assinatura da coleção inteira segue intacta (até a PR G), estas
// specs alimentam usePagedLeads nas telas que migrarem (Clientes, coluna Perda
// do Kanban, ...). NÃO importa firebase aqui — o hook traduz a spec.
//
// Descritor de spec:
//   { wheres: [{ field, op, value }], orderBy: { field, dir }, limit }
// A ordem dos `wheres` (igualdades) seguida do `orderBy` espelha a ordem dos
// campos no índice composto correspondente.

import { LIST_PAGE_SIZE } from './leadStatus.js';

export const LIFECYCLE_BUCKETS = { ATIVO: 'ativo', PERDA: 'perda', CLIENTE: 'cliente' };

// Aba Clientes — casa com o índice #3 (lifecycleBucket ASC, convertedAt DESC).
export const clientsQuerySpec = (pageSize = LIST_PAGE_SIZE) => ({
  wheres: [{ field: 'lifecycleBucket', op: '==', value: LIFECYCLE_BUCKETS.CLIENTE }],
  orderBy: { field: 'convertedAt', dir: 'desc' },
  limit: pageSize,
});

// Aba Clientes (E1b, Opção A) — TODOS os clientes de uma vez, para os filtros
// (situação do contrato é DERIVADA, não é campo do Firestore) e a ordenação
// seguirem client-side na tela. NÃO ordena no servidor de propósito: um orderBy
// (ex.: convertedAt) excluiria os clientes 'Venda' legados que não têm o campo
// ordenado — Firestore filtra por existência do campo do orderBy — e eles
// precisam aparecer. Uma igualdade num só campo roda com o índice automático
// (sem índice composto). Paginação real e ordenada fica pro H (clientsQuerySpec).
export const clientsAllQuerySpec = () => ({
  wheres: [{ field: 'lifecycleBucket', op: '==', value: LIFECYCLE_BUCKETS.CLIENTE }],
});

// Clientes "a vencer" (E2c) — clientes cujo contrato vence numa JANELA de datas,
// pro badge clientsAVencer. Casa com o índice #4 (lifecycleBucket ASC,
// currentContractEndsAt ASC): igualdade no balde + range/orderBy no vencimento.
// A janela é um SUPERCONJUNTO de A_VENCER; o caller refina com
// deriveLeadContractStatus client-side (exclui CANCELADO/VENCIDO na borda).
// Cliente sem currentContractEndsAt não é A_VENCER (deriveContractStatus dá
// null), então já é ignorado hoje E some do range — a contagem casa mesmo sem
// backfill do campo. start/end em ms viram Date pro Firestore.
export const renewalClientsQuerySpec = (startMs, endMs, pageSize = null) => ({
  wheres: [
    { field: 'lifecycleBucket', op: '==', value: LIFECYCLE_BUCKETS.CLIENTE },
    { field: 'currentContractEndsAt', op: '>=', value: new Date(startMs) },
    { field: 'currentContractEndsAt', op: '<', value: new Date(endMs) },
  ],
  orderBy: { field: 'currentContractEndsAt', dir: 'asc' },
  ...(pageSize ? { limit: pageSize } : {}),
});

// Coluna Perda do Kanban por funil — casa com o índice #1
// (lifecycleBucket ASC, funnelId ASC, lostAt DESC).
export const lostByFunnelQuerySpec = (funnelId, pageSize = LIST_PAGE_SIZE) => ({
  wheres: [
    { field: 'lifecycleBucket', op: '==', value: LIFECYCLE_BUCKETS.PERDA },
    { field: 'funnelId', op: '==', value: funnelId },
  ],
  orderBy: { field: 'lostAt', dir: 'desc' },
  limit: pageSize,
});

// Paginação genérica de perda/cliente por funil (Carregar mais em coluna cheia)
// — casa com o índice #2 (lifecycleBucket ASC, funnelId ASC, createdAt DESC).
export const bucketByFunnelQuerySpec = (bucket, funnelId, pageSize = LIST_PAGE_SIZE) => ({
  wheres: [
    { field: 'lifecycleBucket', op: '==', value: bucket },
    { field: 'funnelId', op: '==', value: funnelId },
  ],
  orderBy: { field: 'createdAt', dir: 'desc' },
  limit: pageSize,
});

// AppointmentTrackingView (E2b) — agendamentos de UM tipo numa JANELA de datas,
// pra alimentar as tabs Hoje/Ontem/Amanhã e o range custom (≤30d) sem carregar
// todo o histórico (agendamentos crescem sem limite). Casa com o índice #5
// (appointmentType ASC, appointmentScheduledFor ASC): igualdade no tipo + range
// e orderBy no MESMO campo do agendamento (Firestore permite range no campo do
// orderBy). start/end em ms (a view calcula as janelas) viram Date pro Firestore
// comparar Timestamp. pageSize null = carrega a janela inteira (as contagens de
// dia precisam de tudo; a janela por data já limita o tamanho).
export const appointmentsInWindowQuerySpec = (appointmentType, startMs, endMs, pageSize = null) => ({
  wheres: [
    { field: 'appointmentType', op: '==', value: appointmentType },
    { field: 'appointmentScheduledFor', op: '>=', value: new Date(startMs) },
    { field: 'appointmentScheduledFor', op: '<', value: new Date(endMs) },
  ],
  orderBy: { field: 'appointmentScheduledFor', dir: 'asc' },
  ...(pageSize ? { limit: pageSize } : {}),
});

// Contagem por funil (getCountFromServer) — só as igualdades, sem orderBy/limit.
// Usa o mesmo prefixo dos índices #1/#2, então não exige índice novo.
export const bucketByFunnelCountSpec = (bucket, funnelId) => ({
  wheres: [
    { field: 'lifecycleBucket', op: '==', value: bucket },
    { field: 'funnelId', op: '==', value: funnelId },
  ],
});
