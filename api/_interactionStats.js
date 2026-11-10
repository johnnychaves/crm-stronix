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
// primeira que NÃO é sinal; documento sem type conta como de quem atende.
// `null` quer dizer só "nenhuma interação de quem atende encontrada nesta
// lista": nunca devolve a data de um sinal.
export function pickLastHumanInteractionMillis(docs) {
  const human = (docs || []).find((d) => !isZapSignalInteraction(d?.data?.()));
  return human ? millisOf(human) : null;
}

// Última atividade de quem atende na coleção de interações da academia.
// Primeiro uma leitura só, como antes do sinal: a academia sem sinal no topo
// paga o mesmo de sempre. Só se o topo for sinal lê páginas de 100, da mais nova
// para a mais antiga, até achar uma que não seja.
// shortcut: com 1.000 sinais seguidos sem nenhuma interação de quem atende a
// função devolve null e o console mostra a data de criação, nunca uma data
// levantada pelo sinal; quando melhorar: gravar a última atividade de quem
// atende no cadastro da academia.
// Não usa where('type', '!=', ...): o Firestore exigiria ordenar por `type`
// primeiro e descartaria os documentos sem `type`.
export async function lastHumanInteractionMillis(interactionsCol) {
  const newest = interactionsCol.orderBy('createdAt', 'desc');
  const first = await newest.limit(1).get();
  if (first.empty) return null;
  if (!isZapSignalInteraction(first.docs[0].data())) return millisOf(first.docs[0]);
  let cursor = first.docs[0];
  for (let page = 1; page <= ACTIVITY_MAX_PAGES; page += 1) {
    const { docs } = await newest.startAfter(cursor).limit(ACTIVITY_PAGE_SIZE).get();
    const ms = pickLastHumanInteractionMillis(docs);
    if (ms != null || docs.length < ACTIVITY_PAGE_SIZE) return ms;
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
  catch (err) {
    console.error('zapSignalCount', err?.message || err);
    return 0;
  }
}
