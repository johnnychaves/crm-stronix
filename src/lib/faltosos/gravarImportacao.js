// Gravação da importação das planilhas da Next Fit no Firestore. O QUE gravar
// vem do plano (planoImportacao.js) e a forma de cada gravação, de
// lotesImportacao.js (puro); aqui fica o COMO: as leituras que a gravação
// precisa, os lotes e a ordem. Spec em
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "A
// gravação".
//
// Roda no navegador do gestor, sem função na Vercel. As regras deixam o gestor
// gravar as coleções do módulo com o módulo ligado (firestore.rules), e a
// linha "Voltou a treinar" entra como qualquer interação de membro.
//
// Recebe a academia CONGELADA por quem chama (a janela guarda a academia na
// abertura) e nunca lê o appId vivo: se a sessão trocar de academia no meio
// ("Acessar como" em outra aba), as regras recusam o lote seguinte em vez de a
// importação continuar na academia nova. Molde do funnelSetupWrites.js.
//
// A ordem:
//   1. confere o plano confirmado na prévia (com recusa ou com professor novo
//      sem ligação, nem começa);
//   2. lê do servidor se o registro desta importação já existe, a última
//      importação gravada e o estado de todos os alunos. Sem internet, para
//      aqui sem gravar nada. Se outra importação entrou depois que a janela
//      abriu, também para, sem gravar nada;
//   3. roda o plano de novo com os estados lidos agora (replanejar), para não
//      sobrescrever o que mudou entre a prévia e o Confirmar, e grava esse
//      plano refeito. O registro guarda os números da prévia confirmada;
//   4. grava as ligações e os alunos em lotes de até 500, cada aluno inteiro
//      num lote só;
//   5. por último, num lote só, o registro da importação e a última importação
//      em stronix_config/faltosos.
// Falhou um lote: devolve até onde foi. Os alunos dos lotes anteriores ficam
// gravados por inteiro, e o registro não, então a próxima importação continua
// contando os marcos a partir do Faltantes anterior. Tentar de novo com o
// mesmo plano completa o que faltou, sem duplicar: os ids são fixos, e o plano
// refeito vê o que já entrou.

import { collection, doc, getDocFromServer, getDocsFromServer, serverTimestamp, writeBatch } from 'firebase/firestore';
import {
  CONFIG_PATH,
  CONFIG_FALTOSOS_ID,
  FALTOSOS_PATH,
  PRESENCAS_PATH,
  IMPORTACOES_NEXTFIT_PATH,
  NEXTFIT_ALUNOS_PATH,
  INTERACTIONS_PATH,
} from '../firebase.js';
import {
  ERRO_OUTRA_IMPORTACAO,
  MENSAGEM_OUTRA_IMPORTACAO,
  conferirPlano,
  empacotarEmLotes,
  erroDaGravacao,
  montarGravacoes,
  outraImportacaoEntrou,
} from './lotesImportacao.js';

const CAMINHOS = {
  faltosos: FALTOSOS_PATH,
  presencas: PRESENCAS_PATH,
  alunos: NEXTFIT_ALUNOS_PATH,
  importacoes: IMPORTACOES_NEXTFIT_PATH,
  interacoes: INTERACTIONS_PATH,
};

const docDa = (db, tenant, path, id) => doc(db, 'artifacts', tenant, 'public', 'data', path, id);

// 'config' é sempre o doc único stronix_config/faltosos.
const refDa = (db, tenant, op) => (op.colecao === 'config'
  ? docDa(db, tenant, CONFIG_PATH, CONFIG_FALTOSOS_ID)
  : docDa(db, tenant, CAMINHOS[op.colecao], op.id));

// O registro desta importação, ou null. Do servidor, porque é ele que diz se
// a importação já foi gravada. A tela pode usar antes do Confirmar, para
// avisar que a importação já foi feita.
export async function lerRegistroDaImportacao({ db, tenant, id }) {
  const snap = await getDocFromServer(docDa(db, tenant, IMPORTACOES_NEXTFIT_PATH, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function lerUltimaImportacao({ db, tenant }) {
  const snap = await getDocFromServer(docDa(db, tenant, CONFIG_PATH, CONFIG_FALTOSOS_ID));
  return snap.exists() ? (snap.data()?.ultimaImportacao ?? null) : null;
}

// Todos os estados, de qualquer status: o plano precisa do estado de quem está
// no arquivo e de todo aluno faltando.
async function lerEstadosAtuais({ db, tenant }) {
  const snap = await getDocsFromServer(collection(db, 'artifacts', tenant, 'public', 'data', FALTOSOS_PATH));
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
}

const gravarLote = async (db, tenant, ops) => {
  const batch = writeBatch(db);
  for (const op of ops) {
    const ref = refDa(db, tenant, op);
    if (op.apagar) batch.delete(ref);
    else if (op.merge) batch.set(ref, op.dados, { merge: true });
    else batch.set(ref, op.dados);
  }
  await batch.commit();
};

// Grava a importação confirmada na prévia.
//
// Recebe:
// - db e tenant: o Firestore e a academia congelada na abertura da janela;
// - plano: o plano que a prévia mostrou e o gestor confirmou;
// - replanejar(estadosAtuais): roda o mesmo plano de novo, com os mesmos
//   arquivos, ligações e configuração da prévia, trocando só os estados pelos
//   lidos do servidor ({ [leadId]: doc }). Devolve o plano novo;
// - ultimaImportacaoLida: a stronix_config/faltosos.ultimaImportacao que a
//   janela leu na abertura, ou null na primeira importação;
// - quem: { uid, id, nome } de quem importa;
// - onProgress(gravadas, total): roda depois de cada lote.
//
// Devolve { ok, importacaoId, gravadas, total, lote, lotes, jaExistia, erro }:
// - ok: tudo gravado, inclusive o fecho;
// - lote: o lote que falhou (1 a `lotes`, contando o do fecho), ou null;
// - jaExistia: o registro desta importação já estava gravado. Os alunos são
//   gravados de novo, e do registro só mudam os não ligados e a hora em que
//   foi refeita;
// - erro: o erro do Firestore, ou o de código ERRO_OUTRA_IMPORTACAO, ou null.
// Plano com defeito lança erro antes de gravar qualquer coisa.
export async function gravarImportacao({
  db, tenant, plano, replanejar, ultimaImportacaoLida, quem, onProgress = null,
}) {
  if (!tenant) throw new Error('importação sem a academia');
  if (!quem?.uid) throw new Error('importação sem quem importa');
  if (typeof replanejar !== 'function') throw new Error('importação sem o replanejar');
  if (ultimaImportacaoLida === undefined) throw new Error('importação sem a última importação lida na abertura');
  const importacaoId = conferirPlano(plano);
  const falhou = (erro, extra = {}) => ({
    ok: false, importacaoId, gravadas: 0, total: 0, lote: null, lotes: 0, jaExistia: null, erro, ...extra,
  });

  let jaExistia;
  let ultimaNoServidor;
  let estadosAtuais;
  try {
    jaExistia = Boolean(await lerRegistroDaImportacao({ db, tenant, id: importacaoId }));
    ultimaNoServidor = await lerUltimaImportacao({ db, tenant });
    estadosAtuais = await lerEstadosAtuais({ db, tenant });
  } catch (erro) {
    return falhou(erro);
  }
  if (outraImportacaoEntrou({ noServidor: ultimaNoServidor, lida: ultimaImportacaoLida, importacaoId })) {
    return falhou(erroDaGravacao(ERRO_OUTRA_IMPORTACAO, MENSAGEM_OUTRA_IMPORTACAO), { jaExistia });
  }

  const refeito = await replanejar(estadosAtuais);
  if (conferirPlano(refeito) !== importacaoId) throw new Error('o plano refeito antes de gravar é de outra importação');
  const { unidades, fecho } = montarGravacoes({
    plano: refeito, registro: plano.registro, quem, registroJaExiste: jaExistia, carimbo: serverTimestamp(),
  });
  const lotes = [...empacotarEmLotes(unidades), fecho];
  const total = lotes.reduce((n, l) => n + l.length, 0);

  let gravadas = 0;
  for (let i = 0; i < lotes.length; i += 1) {
    try {
      await gravarLote(db, tenant, lotes[i]);
    } catch (erro) {
      return { ok: false, importacaoId, gravadas, total, lote: i + 1, lotes: lotes.length, jaExistia, erro };
    }
    gravadas += lotes[i].length;
    if (onProgress) onProgress(gravadas, total);
  }
  return { ok: true, importacaoId, gravadas, total, lote: null, lotes: lotes.length, jaExistia, erro: null };
}
