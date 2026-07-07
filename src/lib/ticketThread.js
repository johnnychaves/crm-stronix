// Lógica pura da conversa de suporte (tickets). Sem imports de Firebase de
// propósito: os componentes fazem o updateDoc/arrayUnion; aqui vive só a
// regra de negócio (normalização de thread, não-lido e transição de status),
// testável em node puro. Espelha a spec docs/superpowers/specs/2026-07-07.
const MSG_MAX = 2000;

// Thread do ticket. Tickets antigos (sem `mensagens`) viram conversa de 1
// mensagem: o assunto como abertura do cliente.
function ticketMessages(t) {
  if (Array.isArray(t?.mensagens) && t.mensagens.length) return t.mensagens;
  if (!t?.assunto) return [];
  return [{
    de: 'cliente',
    autor: t.createdBy || null,
    texto: t.assunto,
    emMs: t.createdAt?.toMillis ? t.createdAt.toMillis() : 0,
  }];
}

const isUnreadForClient = (t) =>
  t?.lastMsgBy === 'suporte' && (t.lastMsgAt || 0) > (t.clienteLeuEmMs || 0);
const isUnreadForSupport = (t) =>
  t?.lastMsgBy === 'cliente' && (t.lastMsgAt || 0) > (t.suporteLeuEmMs || 0);
const countUnreadForClient = (tickets) => (tickets || []).filter(isUnreadForClient).length;

// Monta a mensagem nova + status resultante (undefined = status não muda).
// Cliente reabre ticket resolvido; resposta do suporte tira de "aberto".
function nextMessageState(ticket, { de, autor, texto, emMs }) {
  const msg = { de, autor: autor || null, texto: String(texto).trim().slice(0, MSG_MAX), emMs };
  let status;
  if (de === 'cliente' && ticket?.status === 'resolvido') status = 'aberto';
  if (de === 'suporte' && (ticket?.status || 'aberto') === 'aberto') status = 'em_andamento';
  return { msg, status };
}

export { ticketMessages, isUnreadForClient, isUnreadForSupport, countUnreadForClient, nextMessageState };
