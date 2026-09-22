// Gravação da configuração de funis do primeiro login de gestor. O QUE gravar
// vem de funnelSetup.js (puro, com id fixo); aqui fica o COMO. Padrão de
// referrals.js / referralsWrites.js.
//
// Recebe a academia CONGELADA por quem chama e nunca lê o appId vivo: se a
// conta trocar no meio da execução (outra aba, "Acessar como"), a regra do
// Firestore nega e a execução falha sem carimbar, em vez de gravar na academia
// nova com o plano calculado na anterior.

import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db, FUNNELS_PATH, STATUSES_PATH, SOURCES_PATH } from './firebase.js';
import { toSetupWrites } from './funnelSetup.js';

const PATH_BY_COLLECTION = { funnels: FUNNELS_PATH, statuses: STATUSES_PATH, sources: SOURCES_PATH };

export const tenantCol = (tenant, path) => collection(db, 'artifacts', tenant, 'public', 'data', path);
export const tenantDoc = (tenant, path, id) => doc(db, 'artifacts', tenant, 'public', 'data', path, id);

// Só cria. A transação confere se o doc do id fixo já existe e, se existir, não
// mexe: a segunda aba (ou um notebook que acordou com a gravação na fila) nunca
// sobrescreve o que a primeira gravou, nem uma edição do gestor feita no meio.
// Custa uma leitura por doc, uma vez na vida de cada academia. Sem internet a
// transação falha, a configuração não carimba e roda de novo na próxima carga.
export async function writeSetupWrites(tenant, writes) {
  for (const w of writes) {
    const ref = tenantDoc(tenant, PATH_BY_COLLECTION[w.collection], w.id);
    await runTransaction(db, async (tx) => {
      if (!(await tx.get(ref)).exists()) tx.set(ref, w.data);
    });
  }
}

// Plano de um funil de sistema (plan*SetupOps) gravado com id fixo.
export const writeSetupPlan = (tenant, plan) => writeSetupWrites(tenant, toSetupWrites(plan, serverTimestamp()));
