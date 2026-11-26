// O que a importação da Next Fit lê antes da prévia e de novo antes de gravar
// (spec docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "As
// importações"). SDK do navegador; o par puro é o planoImportacao.js.
//
// Tudo vem do servidor (getDocsFromServer): o plano decide quem voltou, quem
// troca de marco e o que já está gravado pelo estado de agora, e um cache
// velho do aparelho planejaria em cima do que já mudou. Sem conexão, a leitura
// falha e a janela pede para tentar de novo.
//
// A academia vem congelada de quem chama e nunca do appId vivo: a importação
// inteira é de uma academia só.
//
// Custo, numa importação da STRONIX: os clientes (cerca de 600), todos os
// estados de falta (um por aluno que já faltou), todos os nomes guardados da
// Next Fit, a configuração e as presenças dos meses do arquivo. A janela lê
// uma vez para a prévia e outra no Confirmar, porque a gravação planeja de
// novo em cima do estado de agora. É uma vez por semana.

import { collection, doc, getDocFromServer, getDocsFromServer, query, where } from 'firebase/firestore';
import {
  LEADS_PATH, CONFIG_PATH, CONFIG_FALTOSOS_ID, FALTOSOS_PATH, PRESENCAS_PATH, NEXTFIT_ALUNOS_PATH,
} from '../firebase.js';
import { LIFECYCLE_BUCKETS } from '../leadQueries.js';
import { isClientLead, normalizeLeadDoc } from '../leads.js';
import { chunk } from '../operacional/queries.js';

const col = (db, tenant, path) => collection(db, 'artifacts', tenant, 'public', 'data', path);

// O `in` do Firestore aceita até 30 valores; o Presenças de uma semana cobre um
// ou dois meses.
const MESES_POR_CONSULTA = 30;

// Devolve:
// - clientes: os leads com lifecycleBucket 'cliente', normalizados como na
//   aba Clientes (só cliente entra na ligação dos alunos);
// - estadosAtuais: { [leadId]: estado } de stronix_faltosos, de todo status;
// - nomesGuardados: { [nomeChave]: { nomeNextFit, leadIds, origem } } de
//   stronix_nextfit_alunos;
// - presencasAtuais: { [`${leadId}_${mês}`]: doc } dos meses pedidos;
// - configDoc: stronix_config/faltosos como está gravado ({} quando não
//   existe). O plano normaliza o que usa dela.
export async function lerBaseDaImportacao({ db, tenant, mesesPresencas = [] }) {
  if (!tenant) throw new Error('Academia da importação não informada.');
  const meses = [...new Set((mesesPresencas || []).filter(Boolean))];
  const [clientesSnap, estadosSnap, alunosSnap, configSnap, ...presencasSnaps] = await Promise.all([
    getDocsFromServer(query(col(db, tenant, LEADS_PATH), where('lifecycleBucket', '==', LIFECYCLE_BUCKETS.CLIENTE))),
    getDocsFromServer(col(db, tenant, FALTOSOS_PATH)),
    getDocsFromServer(col(db, tenant, NEXTFIT_ALUNOS_PATH)),
    getDocFromServer(doc(db, 'artifacts', tenant, 'public', 'data', CONFIG_PATH, CONFIG_FALTOSOS_ID)),
    ...chunk(meses, MESES_POR_CONSULTA).map((parte) => getDocsFromServer(query(col(db, tenant, PRESENCAS_PATH), where('mes', 'in', parte)))),
  ]);

  const presencasAtuais = {};
  for (const snap of presencasSnaps) for (const d of snap.docs) presencasAtuais[d.id] = d.data();

  return {
    // A mesma rede de segurança da aba Clientes: o balde 'cliente' é, por
    // construção, isClientLead.
    clientes: clientesSnap.docs.map(normalizeLeadDoc).filter((l) => isClientLead(l)),
    estadosAtuais: Object.fromEntries(estadosSnap.docs.map((d) => [d.id, d.data()])),
    nomesGuardados: Object.fromEntries(alunosSnap.docs.map((d) => [d.id, d.data()])),
    presencasAtuais,
    configDoc: configSnap.exists() ? (configSnap.data() || {}) : {},
  };
}
