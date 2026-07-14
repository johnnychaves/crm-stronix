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

// Contagem por funil (getCountFromServer) — só as igualdades, sem orderBy/limit.
// Usa o mesmo prefixo dos índices #1/#2, então não exige índice novo.
export const bucketByFunnelCountSpec = (bucket, funnelId) => ({
  wheres: [
    { field: 'lifecycleBucket', op: '==', value: bucket },
    { field: 'funnelId', op: '==', value: funnelId },
  ],
});
