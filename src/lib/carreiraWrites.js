// A gravação de uma trilha do plano de carreira (spec
// 2026-11-26-plano-de-carreira-configuravel, "Onde moram"): troca o campo
// trilhas.<id> de stronix_config/carreira inteiro, pelo caminho do campo e sem
// mesclar, para o nível apagado não deixar meta sobrando e duas abas mexendo
// em trilhas diferentes não se apagarem. O documento que ainda não existe
// nasce com setDoc e merge. As regras do Firestore já deixam o gestor gravar
// stronix_config.
import { doc, FieldPath, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { appId, CONFIG_PATH, PROFESSORS_PATH, USERS_PATH } from './firebase.js';
import { MOTIVO_DO_ARQUIVAR, trilhaParaGravar } from './carreira/rascunho.js';
import { FORA_DO_PLANO } from './carreira/trilhas.js';
import { podeArquivar, problemaDaTrilha } from './carreira/validacao.js';

// A trilha e o nível de uma pessoa (a do pessoasDaTrilha): no professor, em
// stronix_professores; no consultor, em stronix_users, pelo ramo isAdmin das
// regras (a carreiraKept() barra a própria pessoa).
const refPessoa = (db, p) => doc(db, 'artifacts', appId, 'public', 'data', p.tipo === 'professor' ? PROFESSORS_PATH : USERS_PATH, p.id);
export const gravarTrilhaDaPessoa = (db, pessoa, { trilhaId, nivel, desde }) =>
  updateDoc(refPessoa(db, pessoa), { trilhaId, nivel, nivelDesde: Timestamp.fromDate(desde) });
export const tirarDoPlano = (db, pessoa) =>
  updateDoc(refPessoa(db, pessoa), { trilhaId: FORA_DO_PLANO, nivel: null, nivelDesde: null });

const refCarreira = (db) => doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, 'carreira');
// Erro com texto para a tela (o aviso mostra a mensagem), como no npsWrites.
const erroDaTela = (texto) => Object.assign(new Error(texto), { paraTela: true });

// `gravada` é a trilha como está no banco (null na trilha nova), `outras` são
// as demais trilhas da academia e `pessoasPorNivel` conta quem está em cada
// nível da gravada. A conferência roda de novo aqui, e não só na tela.
export async function salvarTrilha(db, { trilha, gravada = null, outras = [], pessoasPorNivel = {}, appUser = null }) {
  const problema = problemaDaTrilha(trilha, { gravada, outras, pessoasPorNivel });
  if (problema) throw erroDaTela(problema.texto);
  if (trilha.arquivada && !gravada?.arquivada && !podeArquivar(pessoasPorNivel)) throw erroDaTela(MOTIVO_DO_ARQUIVAR);
  const dados = { ...trilhaParaGravar(trilha), updatedAt: serverTimestamp(), updatedBy: appUser?.id ?? null };
  const ref = refCarreira(db);
  try {
    await updateDoc(ref, new FieldPath('trilhas', trilha.id), dados);
  } catch (err) {
    if (err?.code !== 'not-found') throw err;
    // shortcut: se outra aba criar o documento entre o updateDoc e este setDoc,
    // o merge mescla a trilha em vez de trocá-la; a próxima gravação acerta.
    await setDoc(ref, { trilhas: { [trilha.id]: dados } }, { merge: true });
  }
}
