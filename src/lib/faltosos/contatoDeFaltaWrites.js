// Grava o contato de falta e o "Já voltou" num lote só: a interação e a tarefa
// do aluno, ou nada. Não toca o lead (decisão P1 do plano do 2B).
//
// shortcut: a importação da Next Fit relê os estados do servidor e grava cada um
// inteiro, sem merge; um contato gravado entre a leitura dela e o fim do lote
// dela se perde no estado (a interação fica). Aceito por ser uma janela de
// segundos por semana; se acontecer, trocar a gravação da importação por
// transação.
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { appId, FALTOSOS_PATH, INTERACTIONS_PATH } from '../firebase.js';
import { montarContato, montarJaVoltou } from './contatoDeFalta.js';

const col = (db, path) => collection(db, 'artifacts', appId, 'public', 'data', path);

export async function registrarContatoDeFalta(db, { lead, estado, quem, canal, resultado, observacao }) {
  const { interacao, estadoPatch } = montarContato({ lead, estado, quem, canal, resultado, observacao, agora: serverTimestamp() });
  const batch = writeBatch(db);
  batch.set(doc(col(db, INTERACTIONS_PATH)), interacao);
  batch.update(doc(col(db, FALTOSOS_PATH), estado.leadId || estado.id), estadoPatch);
  await batch.commit();
}

export async function marcarJaVoltou(db, { estado, quem }) {
  const batch = writeBatch(db);
  batch.update(doc(col(db, FALTOSOS_PATH), estado.leadId || estado.id), montarJaVoltou({ estado, quem, agora: serverTimestamp() }));
  await batch.commit();
}
