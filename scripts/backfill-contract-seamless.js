// Marca as renovações emendadas gravadas antes da regra de 28/09/2026.
//
// CONTEXTO: desde 28/09/2026, a renovação que começa no dia seguinte ao fim do
// contrato renovado é gravada com seamless: true no contrato e
// currentContractSeamless: true no lead, e deixa de aparecer como agendada. As
// renovações gravadas antes não têm a marca: até a data de início, o cliente
// aparece como "CONTRATO AGENDADO", com o anel roxo em Clientes. Este script
// grava a marca nelas.
//
// Não grava false em ninguém e não encurta sobreposição antiga (decisão do
// Johnny, 28/09/2026). Não marca a renovação de contrato trancado, cancelado
// antes do fim previsto ou que ainda não começou. A decisão de quem recebe a
// marca mora em src/lib/seamlessBackfill.js, com teste. Quem já tem a marca
// não entra, então rodar de novo é seguro.
//
// Cada documento é gravado com a precondição da hora da última gravação que a
// leitura viu (lastUpdateTime). O que mudou depois da leitura derruba o lote
// inteiro, em vez de receber a marca de um plano velho, e o script para e diz
// o que fazer.
//
// Uso (mesmas credenciais Admin das funções api/):
//   FIREBASE_ADMIN_PROJECT_ID=... \
//   FIREBASE_ADMIN_CLIENT_EMAIL=... \
//   FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
//   node scripts/backfill-contract-seamless.js <tenantId> [<tenantId> ...] [--apply]
//
//   - Sem --apply: DRY-RUN, só lista o que mudaria e não grava nada. (padrão)
//   - --apply:     grava as marcas. Só com o ok do Johnny, depois do DRY-RUN.
//   - tenantId:    um ou mais, obrigatório. Não existe padrão: errar o alvo
//                  aqui varre a academia errada.
//
// Lê a coleção inteira de contratos e os leads com contrato atual. Grava em
// lotes de 400 (limite de 500 escritas por batch do Firestore, com folga). A
// saída mostra ids, plano, datas e o status do contrato renovado, nunca o nome
// do cliente.

import process from 'node:process';
import admin from 'firebase-admin';
import { CONTRACT_STATUS } from '../src/lib/contracts.js';
import { getSafeDateOrNull } from '../src/lib/dates.js';
import { planSeamlessBackfill } from '../src/lib/seamlessBackfill.js';

// "Dia seguinte ao fim" é dia do calendário no horário das academias, o do
// navegador que grava a renovação. Com o fuso fixo, a resposta é a mesma em
// qualquer máquina: em UTC, uma renovação gravada às 22h30 de Brasília cairia
// no dia seguinte.
process.env.TZ = 'America/Sao_Paulo';

const USO = 'Uso: node scripts/backfill-contract-seamless.js <tenantId> [<tenantId> ...] [--apply]';
const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const APPLY = flags.includes('--apply');
const TENANTS = [...new Set(args.filter((a) => !a.startsWith('--')))];

const LEADS_PATH = 'stronix_leads';
const CONTRACTS_PATH = 'stronix_contratos';
const BATCH_SIZE = 400;

// Opção com erro de digitação não pode virar outra coisa em silêncio.
const desconhecidas = flags.filter((f) => f !== '--apply');
if (desconhecidas.length) {
  console.error(`Opção desconhecida: ${desconhecidas.join(', ')}`);
  console.error(USO);
  process.exit(1);
}

if (TENANTS.length === 0) {
  console.error(USO);
  console.error('O tenant é obrigatório. Não existe padrão: errar o alvo aqui varre a academia errada.');
  process.exit(1);
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('Faltam env vars: FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

const db = admin.firestore();

const dataCol = (tenantId, path) => db
  .collection('artifacts').doc(tenantId)
  .collection('public').doc('data')
  .collection(path);

// Tenant inexistente varre um caminho vazio e conclui "0 a marcar" como se
// tivesse dado certo. Já aconteceu no backfill-zap-match-key.js: rodaram com
// `stronix` quando o slug real era `stronix-crm-app`. Todos os ids são
// conferidos antes de varrer qualquer um, para o --apply não parar no meio.
const inexistentes = [];
for (const tenantId of TENANTS) {
  const tenantDoc = await db.collection('tenants').doc(tenantId).get();
  if (!tenantDoc.exists) inexistentes.push(tenantId);
}
if (inexistentes.length) {
  for (const tenantId of inexistentes) console.error(`Tenant "${tenantId}" não existe na coleção 'tenants'.`);
  const todos = await db.collection('tenants').listDocuments();
  if (todos.length) {
    console.error('Tenants cadastrados:');
    for (const t of todos) console.error(`  ${t.id}`);
  }
  process.exit(1);
}

const diaDe = (value) => getSafeDateOrNull(value)?.toLocaleDateString('pt-BR') || 'sem data';

// O contrato renovado, na linha de cada renovação: o status gravado, o dia do
// cancelamento, quando cancelado, o início e o fim previsto. É o que o plano
// confere antes de marcar (seamlessBackfill.js).
const anteriorDe = (prev) => {
  const cancelado = prev.status === CONTRACT_STATUS.CANCELADO ? ` em ${diaDe(prev.cancelledAt)}` : '';
  return `anterior ${prev.id} ${prev.status || 'sem status'}${cancelado}, início ${diaDe(prev.startsAt)}, fim previsto ${diaDe(prev.originalEndsAt || prev.endsAt)}`;
};

// Códigos do Firestore (gRPC) para a precondição que falhou: o documento mudou
// depois da leitura (FAILED_PRECONDITION) ou sumiu (NOT_FOUND).
const PRECONDICAO_FALHOU = new Set([9, 5]);

// Lote recusado pela precondição. Leva a mensagem pronta para quem roda.
class LoteRecusado extends Error {}

async function sweep(tenantId) {
  const [contractsSnap, leadsSnap] = await Promise.all([
    dataCol(tenantId, CONTRACTS_PATH).get(),
    dataCol(tenantId, LEADS_PATH).where('currentContractId', '!=', null).get()
  ]);
  const contracts = contractsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const leads = leadsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // A hora da última gravação de cada documento, como a leitura viu.
  const lidoEm = new Map([...contractsSnap.docs, ...leadsSnap.docs].map((d) => [d.ref.path, d.updateTime]));
  const { contractIds, leadIds } = planSeamlessBackfill(contracts, leads);
  const byId = new Map(contracts.map((c) => [c.id, c]));
  const tag = APPLY ? 'GRAVA' : 'DRY  ';

  for (const id of contractIds) {
    const c = byId.get(id);
    console.log(`  [${tag}] contrato ${id} · ${c.planName || 'sem plano'} · início ${diaDe(c.startsAt)} · ${anteriorDe(byId.get(c.renewedFromId))}: seamless = true`);
  }
  for (const id of leadIds) console.log(`  [${tag}] lead ${id}: currentContractSeamless = true`);

  if (APPLY) {
    // update, e não set com merge: um documento que sumiu entre a leitura e a
    // gravação derruba o lote, em vez de virar um documento só com a marca.
    // A precondição lastUpdateTime vai além: o documento precisa estar como a
    // leitura o viu. Sem a hora da leitura o script para, porque uma
    // precondição vazia tiraria até a exigência de o documento existir.
    const precondicao = (ref) => {
      const lastUpdateTime = lidoEm.get(ref.path);
      if (!lastUpdateTime) throw new Error(`Sem a hora da leitura de ${ref.path}. Nada deste lote foi gravado.`);
      return { lastUpdateTime };
    };
    const writes = [
      ...contractIds.map((id) => [dataCol(tenantId, CONTRACTS_PATH).doc(id), { seamless: true }]),
      ...leadIds.map((id) => [dataCol(tenantId, LEADS_PATH).doc(id), { currentContractSeamless: true }])
    ];
    const lotes = Math.ceil(writes.length / BATCH_SIZE);
    for (let i = 0; i < writes.length; i += BATCH_SIZE) {
      const lote = i / BATCH_SIZE + 1;
      const batch = db.batch();
      for (const [ref, data] of writes.slice(i, i + BATCH_SIZE)) batch.update(ref, data, precondicao(ref));
      try {
        await batch.commit();
      } catch (err) {
        if (!PRECONDICAO_FALHOU.has(err?.code)) throw err;
        const anteriores = lote - 1;
        throw new LoteRecusado([
          `Tenant "${tenantId}": o lote ${lote} de ${lotes} foi recusado. Um contrato ou lead mudou, ou foi apagado, depois da leitura. Nada desse lote foi gravado.`,
          anteriores === 1 ? 'O lote anterior deste tenant já está gravado.' : null,
          anteriores > 1 ? `Os ${anteriores} lotes anteriores deste tenant já estão gravados.` : null,
          'Rode de novo, primeiro sem --apply, para conferir a lista atualizada. Quem já tem a marca não entra de novo.',
          `Detalhe do Firestore: ${err.message}`
        ].filter(Boolean).join('\n'));
      }
    }
  }

  return { contracts: contracts.length, leads: leads.length, contractIds, leadIds };
}

async function run() {
  console.log(`\nMarca das renovações emendadas antigas. Modo: ${APPLY ? 'GRAVAR' : 'DRY-RUN'}\n`);
  const feitos = [];
  for (const tenantId of TENANTS) {
    console.log(`Tenant "${tenantId}"`);
    let r;
    try {
      r = await sweep(tenantId);
    } catch (err) {
      if (err instanceof LoteRecusado && feitos.length) {
        err.message += `\nOs tenants anteriores desta execução foram gravados por inteiro: ${feitos.join(', ')}.`;
      }
      throw err;
    }
    feitos.push(tenantId);
    console.log(`  Lidos: ${r.contracts} contratos e ${r.leads} leads com contrato atual. ${APPLY ? 'Marcados' : 'A marcar'}: ${r.contractIds.length} contratos e ${r.leadIds.length} leads.\n`);
  }
  if (APPLY) console.log('Concluído.');
  else console.log('DRY-RUN: nada foi gravado. Revise a lista acima e rode de novo com --apply para gravar.');
}

run().then(() => process.exit(0)).catch((err) => {
  if (err instanceof LoteRecusado) console.error(`\n${err.message}`);
  else console.error(err);
  process.exit(1);
});
