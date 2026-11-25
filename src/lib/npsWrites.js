// As gravações da pesquisa de NPS pelo gestor (plano
// 2026-11-25-perfil-do-professor-04-pesquisas). As regras do Firestore travam
// o que importa: rascunho nasce rascunho, a pesquisa aberta não troca
// perguntas nem turmas e só vai para encerrada, e só o rascunho se apaga.
import { addDoc, collection, deleteDoc, doc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { appId, NPS_PESQUISAS_PATH, PROFESSORS_PATH } from './firebase.js';
import { gerarNpsCode } from './npsLink.js';
import { dayKeyOf } from './operacional/month.js';
import { estadoDaPesquisa, paraGravar, problemaDaPesquisa } from './professor/pesquisas.js';

const colecao = (db) => collection(db, 'artifacts', appId, 'public', 'data', NPS_PESQUISAS_PATH);
const refDe = (db, id) => doc(colecao(db), id);

// Erro com texto para a tela (o toast mostra a mensagem).
const erroDaTela = (texto) => Object.assign(new Error(texto), { paraTela: true });

// Cria o rascunho (sem id) ou atualiza o que existe. Devolve o id.
export async function salvarRascunho(db, id, form, autorId = null) {
  const dados = { ...paraGravar(form), situacao: 'rascunho', atualizadaEm: serverTimestamp(), atualizadaPor: autorId };
  if (id) {
    await updateDoc(refDe(db, id), dados);
    return id;
  }
  const novo = await addDoc(colecao(db), { ...dados, criadaEm: serverTimestamp() });
  return novo.id;
}

// Abre o rascunho com a turma de cada professor. A transação relê o rascunho e
// as pesquisas que a tela conhece, e recusa se alguma está aberta pela conta.
// shortcut: uma pesquisa aberta em outra aba que a tela ainda não recebeu fica
// fora da conta, como nas rotinas; se um dia houver mais de um gestor abrindo
// pesquisa, o servidor passa a abrir.
export async function abrirPesquisa(db, id, { turmas, conhecidas = [], agora = new Date() }) {
  if (!Object.keys(turmas || {}).length) throw erroDaTela('Nenhum professor tem aluno ativo agora.');
  const hoje = dayKeyOf(agora);
  const outras = [...new Set(conhecidas.map((p) => p.id))].filter((i) => i && i !== id);
  await runTransaction(db, async (tx) => {
    const alvo = await tx.get(refDe(db, id));
    const snaps = await Promise.all(outras.map((i) => tx.get(refDe(db, i))));
    if (!alvo.exists() || alvo.data().situacao !== 'rascunho') throw erroDaTela('Essa pesquisa não é mais um rascunho.');
    if (problemaDaPesquisa(alvo.data())) throw erroDaTela('Complete a pesquisa antes de abrir.');
    if (snaps.some((s) => s.exists() && estadoDaPesquisa(s.data(), hoje) === 'aberta')) {
      throw erroDaTela('Já tem uma pesquisa aberta. Encerre ela antes de abrir outra.');
    }
    tx.update(alvo.ref, { situacao: 'aberta', turmas, abertaEm: serverTimestamp() });
  });
}

export const encerrarPesquisa = (db, id) => updateDoc(refDe(db, id), { situacao: 'encerrada', encerradaEm: serverTimestamp() });

export const excluirRascunho = (db, id) => deleteDoc(refDe(db, id));

// O link antigo para de funcionar: o servidor acha o professor pelo código.
export async function gerarNovoLink(db, profId) {
  const npsCode = gerarNpsCode();
  await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', PROFESSORS_PATH, profId), { npsCode, npsCodeEm: serverTimestamp() });
  return npsCode;
}
