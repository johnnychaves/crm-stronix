import { ZAP_SIGNAL_TYPE, isZapSignalInteraction } from '../src/lib/leads.js';

// Contas do console de super-admin sobre as interações (api/super-overview.js e
// api/tenant-status.js). A linha de sinal da conversa pelo Stronizap só diz que
// o lead escreveu ou que a equipe enviou: não é atividade de quem atende, então
// fica fora da última atividade da academia e do total de interações.
// Módulo com `_` na frente: não vira função da Vercel.

// Leitura da última atividade: páginas de 100, da mais nova para a mais antiga.
export const ACTIVITY_PAGE_SIZE = 100;
export const ACTIVITY_MAX_PAGES = 10;

const millisOf = (doc) => {
  const ts = doc?.data?.()?.createdAt;
  return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : null;
};

// `docs`: interações já ordenadas da mais nova para a mais antiga (a ordem do
// Firestore por createdAt desc). Devolve o createdAt, em milissegundos, da
// primeira que NÃO é sinal; documento sem type conta como de quem atende. Sem
// nenhuma, null. Com `capped` (a leitura parou no teto de páginas, ainda com
// documentos por ler), devolve o createdAt da mais antiga lida: é um limite
// superior da última atividade real, porque se houvesse algo mais novo e de
// quem atende, teria sido achado.
export function pickLastHumanInteractionMillis(docs, { capped = false } = {}) {
  const list = docs || [];
  const human = list.find((d) => !isZapSignalInteraction(d?.data?.()));
  if (human) return millisOf(human);
  return capped && list.length ? millisOf(list[list.length - 1]) : null;
}

// Última atividade de quem atende na coleção de interações da academia.
// shortcut: lê no máximo 10 páginas de 100 (1.000 documentos) por academia e, se
// só achar sinais, devolve o limite superior (o createdAt do mais antigo lido);
// melhorar quando uma academia passar de mil sinais seguidos, gravando a data
// da última interação de quem atende no próprio cadastro da academia.
// Não usa where('type', '!=', ...): o Firestore exigiria ordenar por `type`
// primeiro e descartaria os documentos sem `type`.
export async function lastHumanInteractionMillis(interactionsCol) {
  let cursor = null;
  for (let page = 1; page <= ACTIVITY_MAX_PAGES; page += 1) {
    let query = interactionsCol.orderBy('createdAt', 'desc').limit(ACTIVITY_PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const { docs } = await query.get();
    const full = docs.length === ACTIVITY_PAGE_SIZE;
    const ms = pickLastHumanInteractionMillis(docs, { capped: full && page === ACTIVITY_MAX_PAGES });
    if (ms != null || !full) return ms;
    cursor = docs[docs.length - 1];
  }
  return null;
}

// Total de interações que alguém registrou: o total menos as linhas de sinal.
export const humanInteractionCount = (total, signals) => Math.max(0, (total || 0) - (signals || 0));

// Quantas linhas de sinal a coleção tem. Um campo só (sem índice composto).
// Best-effort como o countOr: se falhar, devolve 0 e o total fica como está.
export async function zapSignalCount(interactionsCol) {
  try { return (await interactionsCol.where('type', '==', ZAP_SIGNAL_TYPE).count().get()).data().count || 0; }
  catch { return 0; }
}
