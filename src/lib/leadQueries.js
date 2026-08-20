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

import { LIST_PAGE_SIZE, DAY_MS } from './leadStatus.js';

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

// LeadsView "Todos os leads" (G1a) — TODOS os leads de TODOS os buckets de uma
// vez. SEM where e SEM orderBy DE PROPÓSITO: a tela mostra todos os status
// (inclui Venda/Perda), então um where cortaria buckets que ela exibe; e um
// orderBy derrubaria legados sem o campo (Firestore filtra por existência).
// A tela filtra/ordena/pagina client-side EXATAMENTE como hoje — só troca a
// fonte (query própria em vez do prop global). Coleção inteira sem constraint é
// sempre runnable (não exige índice composto). A leitura desta tela só cai com a
// paginação real (server-side), que fica pro H; aqui getDocs carrega tudo uma
// vez, ON-DEMAND (ao abrir a aba), já melhor que a assinatura global ao vivo.
export const allLeadsQuerySpec = () => ({ wheres: [] });

// Clientes "a vencer" (E2c) — clientes cujo contrato vence numa JANELA de datas,
// pro badge clientsAVencer. Casa com o índice #4 (lifecycleBucket ASC,
// currentContractEndsAt ASC): igualdade no balde + range/orderBy no vencimento.
// A janela é um SUPERCONJUNTO de A_VENCER; o caller refina com
// deriveLeadContractStatus client-side (exclui CANCELADO/VENCIDO na borda).
// Cliente sem currentContractEndsAt não é A_VENCER (deriveContractStatus dá
// null), então já é ignorado hoje E some do range — a contagem casa mesmo sem
// backfill do campo. start/end em ms viram Date pro Firestore.

// Janela de vencimento que a META precisa carregar, em ms:
//   para FRENTE  → até o maior entre contractThresholdDays e os marcos de
//     renovação, porque o marco mais distante (ex.: 90) dispara antes do
//     threshold do sistema (ex.: 30).
//   para TRÁS    → até o período do funil Vencidos (expiredWindowDays), senão
//     o cliente que venceu não é carregado e o funil aparece vazio. Era o furo
//     que a tolerância antiga tinha: a janela começava em ontem.
// 1 dia de folga em cada ponta para a borda não escapar por causa de hora.
// Puro de propósito: este cálculo já morou dentro de um useMemo do hook, onde
// ninguém conseguia ver que estava errado.
export const renewalWindowMs = (nowMs, { contractThresholdDays, renewalCheckpoints, expiredWindowDays } = {}) => {
  const forward = [Number(contractThresholdDays) || 0, ...(Array.isArray(renewalCheckpoints) ? renewalCheckpoints.map(Number) : [])]
    .filter((n) => Number.isFinite(n) && n > 0);
  const maxForward = forward.length ? Math.max(...forward) : 0;
  const backNum = Number(expiredWindowDays);
  const back = Number.isFinite(backNum) && backNum > 0 ? backNum : 0;
  return {
    start: nowMs - (back + 1) * DAY_MS,
    end: nowMs + (maxForward + 1) * DAY_MS
  };
};

export const renewalClientsQuerySpec = (startMs, endMs, pageSize = null) => ({
  wheres: [
    { field: 'lifecycleBucket', op: '==', value: LIFECYCLE_BUCKETS.CLIENTE },
    { field: 'currentContractEndsAt', op: '>=', value: new Date(startMs) },
    { field: 'currentContractEndsAt', op: '<', value: new Date(endMs) },
  ],
  orderBy: { field: 'currentContractEndsAt', dir: 'asc' },
  ...(pageSize ? { limit: pageSize } : {}),
});

// CLIENTES VENCIDOS — funil Vencidos do board (pipeline). Do vencimento mais
// RECENTE para o mais antigo: a chance de reativação cai a cada dia fora da
// academia, então quem saiu ontem aparece antes de quem saiu há dois meses.
//
// Sem janela para trás de propósito: o funil é PERMANENTE, ao contrário da
// tarefa da Meta, que cobra por N dias e solta.
//
// Coberta pelo índice #4 (lifecycleBucket ASC, currentContractEndsAt ASC):
// igualdade no balde mais range e ordenação no mesmo campo. NENHUM índice novo.
export const expiredClientsQuerySpec = (beforeMs, pageSize = null) => ({
  wheres: [
    { field: 'lifecycleBucket', op: '==', value: LIFECYCLE_BUCKETS.CLIENTE },
    { field: 'currentContractEndsAt', op: '<', value: new Date(beforeMs) },
  ],
  orderBy: { field: 'currentContractEndsAt', dir: 'desc' },
  ...(pageSize ? { limit: pageSize } : {}),
});

// UMA COLUNA do funil RENOVAÇÕES do board. Cada marco busca a própria faixa de
// vencimento, com o próprio cursor, então todas as colunas nascem cheias em vez
// de a mais urgente comer a página inteira.
//
// A faixa é (corte + prevDays, corte + days] — aberta embaixo para não repetir o
// cliente que está na fronteira com a coluna de baixo. A MENOR coluna passa
// prevDays 0 e vira `>=` no próprio corte: quem vence hoje ainda é renovação, e
// só vira Vencidos a partir do instante seguinte.
//
// ESTA É A INVARIANTE DA ESTEIRA: aqui `>= corte`, no expiredClientsQuerySpec
// `< corte`. Nunca sobrepõe, nunca deixa buraco. Tem teste travando isso.
//
// Coberta pelo índice #4 (lifecycleBucket ASC, currentContractEndsAt ASC):
// igualdade no balde mais range e ordenação no mesmo campo. NENHUM índice novo.
export const renewalColumnQuerySpec = (cutoffMs, days, prevDays = 0, pageSize = null) => ({
  wheres: [
    { field: 'lifecycleBucket', op: '==', value: LIFECYCLE_BUCKETS.CLIENTE },
    {
      field: 'currentContractEndsAt',
      op: prevDays > 0 ? '>' : '>=',
      value: new Date(cutoffMs + prevDays * DAY_MS),
    },
    { field: 'currentContractEndsAt', op: '<=', value: new Date(cutoffMs + days * DAY_MS) },
  ],
  // Vencimento mais próximo no topo da coluna: dentro da mesma faixa, quem
  // vence antes precisa de contato antes.
  orderBy: { field: 'currentContractEndsAt', dir: 'asc' },
  ...(pageSize ? { limit: pageSize } : {}),
});

// CLIENTES com contato marcado para HOJE (Meta Diária). Existe porque a base da
// Meta só carrega cliente que está numa janela de vencimento de contrato
// (renewalClientsQuerySpec). Aluno com contrato longe de vencer ficava de fora,
// e o contato marcado com ele sumia da Meta em silêncio — mesmo a categoria
// "Contato Hoje" tendo uma exceção explícita para cliente.
//
// Igualdade num campo + range em outro: precisa do índice composto
// (lifecycleBucket ASC, nextFollowUp ASC), declarado em firestore.indexes.json.
// O recorte é pequeno por natureza: só quem tem toque marcado para hoje.
export const clientsWithContactTodayQuerySpec = (startMs, endMs) => ({
  wheres: [
    { field: 'lifecycleBucket', op: '==', value: LIFECYCLE_BUCKETS.CLIENTE },
    { field: 'nextFollowUp', op: '>=', value: new Date(startMs) },
    { field: 'nextFollowUp', op: '<=', value: new Date(endMs) },
  ],
  orderBy: { field: 'nextFollowUp', dir: 'asc' },
});

// Dashboard do CONSULTOR (E2a) — todos os leads do próprio consultor, pra as
// funções de dashboardMetrics fatiarem por janela em memória como já fazem (não
// reescrever a matemática, só a fonte). Sem orderBy DE PROPÓSITO: as métricas
// usam createdAt/convertedAt/appointmentScheduledFor com fallbacks — um orderBy
// num desses derrubaria leads legados sem o campo. Igualdade num só campo usa o
// índice automático (os índices #6/#7/#8 por janela ficam pra quando/se a
// visão paginar por período; hoje o consultor tem conjunto limitado). Admin NÃO
// usa esta spec (agrega todos + não-atribuídos — fica no prop global no E).
export const consultantLeadsQuerySpec = (consultantId) => ({
  wheres: [{ field: 'consultantId', op: '==', value: consultantId }],
});

// Dashboards ADMIN (G1c) — o admin agrega TODOS os leads da academia (mais os
// não-atribuídos) num PERÍODO, então não dá pra escopar por consultantId como o
// E2a fez pro consultor. dashboardMetrics.js fatia os leads por QUATRO campos de
// data diferentes dentro do período: createdAt (captação), convertedAt via
// getLeadConversionDate (matrícula), appointmentScheduledFor (agendamento) e
// lostAt (perda) — além do período ANTERIOR (deltas) e das sub-janelas do
// sparkline. Uma única query de janela não cobre as quatro datas, então buscamos
// a UNIÃO de quatro janelas de campo único abrangendo [startMs, endMs]
// (superconjunto do período atual + anterior + sparkline; ver
// computeAdminDashboardSpan em dashboardMetrics.js) e deduplicamos por id no hook.
//
// Cada janela é um range num só campo (>= start, <= end, orderBy nesse campo) →
// usa o índice de campo único AUTOMÁTICO do Firestore (fieldOverrides vazio em
// firestore.indexes.json), SEM índice composto novo nem publicação manual.
//
// Faithfulness: leads legados sem convertedAt/lostAt só entram pela janela de
// createdAt (se criados no span) — exatamente o comportamento em memória de hoje
// (getLeadConversionDate cai no createdAt; isWithinRange(undefined) é false).
// start/end em ms viram Date pro Firestore comparar Timestamp.
export const ADMIN_DASHBOARD_WINDOW_FIELDS = ['createdAt', 'convertedAt', 'appointmentScheduledFor', 'lostAt'];

export const adminDashboardWindowSpecs = (startMs, endMs) =>
  ADMIN_DASHBOARD_WINDOW_FIELDS.map((field) => ({
    wheres: [
      { field, op: '>=', value: new Date(startMs) },
      { field, op: '<=', value: new Date(endMs) },
    ],
    orderBy: { field, dir: 'asc' },
  }));

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

// Coluna Venda do Kanban — matrículas fechadas DENTRO de uma janela (o mês
// corrente). Casa com o índice #3 já existente (lifecycleBucket ASC,
// convertedAt DESC): igualdade no balde + range/orderBy no MESMO campo, então
// não exige índice novo nem publicação manual.
//
// Sem funnelId de propósito: metê-lo aqui pediria um índice novo
// (lifecycleBucket, funnelId, convertedAt) e um mês de vendas é pequeno — o
// caller refina por funil em memória sobre a janela INTEIRA, o que dá contagem
// exata (diferente da coluna Perda, que refina sobre uma página).
//
// Sem limit: carrega o mês inteiro. Cliente sem convertedAt (legado, anterior ao
// carimbo) fica fora do range — a coluna mostra o que foi fechado no mês, e quem
// não tem data não tem mês.
export const wonInMonthQuerySpec = (startMs, endMs) => ({
  wheres: [
    { field: 'lifecycleBucket', op: '==', value: LIFECYCLE_BUCKETS.CLIENTE },
    { field: 'convertedAt', op: '>=', value: new Date(startMs) },
    { field: 'convertedAt', op: '<', value: new Date(endMs) },
  ],
  orderBy: { field: 'convertedAt', dir: 'desc' },
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
