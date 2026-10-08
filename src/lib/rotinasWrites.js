// Gravações das rotinas dos consultores. O QUE gravar sai de rotinas.js
// (puro); aqui fica o COMO. Toda gravação de modelo passa por commitModels:
// lê os modelos numa transação e grava o modelo e a versão do dia juntos. A
// transação lê os modelos que quem chama passa (a lista inteira que a tela
// tem) e repete se algum deles mudou nesse meio tempo. Um modelo criado em
// outra aba um instante antes, que ainda não está na lista, não é lido: o SDK
// do navegador não consulta coleção dentro da transação. Escolher o modelo
// de novo resolve.
import { collection, deleteDoc, doc, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { appId, ROUTINE_MARKS_PATH, ROUTINE_MODELS_PATH, ROUTINE_VERSIONS_PATH, USERS_PATH } from './firebase.js';
import { NOTE_MAX, copyName, followerChanges, markIdOf, modelDocs, newTaskId, routineDayKey } from './rotinas.js';
import { INTROS_DISMISSED_FIELD, ROTINAS_INTRO_ID } from './rotinasIntro.js';

const modelsCol = (db) => collection(db, 'artifacts', appId, 'public', 'data', ROUTINE_MODELS_PATH);
const modelRef = (db, id) => doc(db, 'artifacts', appId, 'public', 'data', ROUTINE_MODELS_PATH, id);
const versionRef = (db, id) => doc(db, 'artifacts', appId, 'public', 'data', ROUTINE_VERSIONS_PATH, id);
const markRef = (db, id) => doc(db, 'artifacts', appId, 'public', 'data', ROUTINE_MARKS_PATH, id);
const userRef = (db, id) => doc(db, 'artifacts', appId, 'public', 'data', USERS_PATH, id);

// Modelo que alguém apagou entre a tela abrir e o gestor gravar.
export const MODEL_GONE = 'modelo-sumiu';
const modelGone = () => Object.assign(new Error(MODEL_GONE), { code: MODEL_GONE });
// Tarefa que outra aba apagou enquanto o painel dela estava aberto, e modelo
// que chegou ao máximo de tarefas pelas mãos de outra pessoa. Quem lança é o
// edit do updateModel, que confere o modelo lido na transação, e não a cópia
// da tela.
export const TASK_GONE = 'tarefa-sumiu';
export const taskGone = () => Object.assign(new Error(TASK_GONE), { code: TASK_GONE });
export const TASK_LIMIT = 'limite-de-tarefas';
export const taskLimit = () => Object.assign(new Error(TASK_LIMIT), { code: TASK_LIMIT });

const pick = (m) => ({ name: m.name, tasks: m.tasks || [], followerIds: m.followerIds || [] });

// change(fresh) recebe os modelos lidos na transação e devolve
// { [modelId]: { name, tasks, followerIds, deleted?, isNew? } }.
async function commitModels(db, appUser, modelIds, change, now) {
  const dateKey = routineDayKey(now);
  await runTransaction(db, async (tx) => {
    const snaps = await Promise.all(modelIds.map((id) => tx.get(modelRef(db, id))));
    const fresh = snaps.filter((snap) => snap.exists()).map((snap) => ({ id: snap.id, ...snap.data() }));
    const next = change(fresh);
    for (const [id, m] of Object.entries(next)) {
      const { model, version } = modelDocs({ modelId: id, ...m, userId: appUser.id, dateKey });
      if (m.deleted) {
        tx.delete(modelRef(db, id));
      } else {
        const stamp = { updatedAt: serverTimestamp(), updatedBy: appUser.id };
        const created = m.isNew ? { createdAt: serverTimestamp(), createdBy: appUser.id } : {};
        tx.set(modelRef(db, id), { ...model, ...stamp, ...created }, { merge: true });
      }
      tx.set(versionRef(db, version.id), { ...version.data, savedAt: serverTimestamp() });
    }
  });
}

export async function createModel({ db, appUser, models, name, copyFrom = null, followerIds = [], now = new Date() }) {
  const id = doc(modelsCol(db)).id;
  // O modelo copiado é lido na transação mesmo que a tela não o tenha na lista.
  const ids = [...new Set([...(models || []).map((m) => m.id), copyFrom].filter(Boolean))];
  await commitModels(db, appUser, ids, (fresh) => {
    const source = copyFrom ? fresh.find((m) => m.id === copyFrom) : null;
    if (copyFrom && !source) throw modelGone();
    const tasks = source ? (source.tasks || []).map((t) => ({ ...t, id: newTaskId() })) : [];
    const all = [...fresh, { id, name, tasks, followerIds: [] }];
    const out = {};
    for (const [mid, ids] of followerChanges(all, id, followerIds)) {
      const m = all.find((x) => x.id === mid);
      out[mid] = { ...pick(m), followerIds: ids, isNew: mid === id };
    }
    return out;
  }, now);
  return id;
}

export const duplicateModel = ({ db, appUser, models, source, now = new Date() }) =>
  createModel({ db, appUser, models, name: copyName(source.name, models), copyFrom: source.id, now });

// edit(modeloAtual) devolve só o que muda: { name } ou { tasks }. Qualquer
// outra chave é ignorada. O edit pode rodar mais de uma vez quando a transação
// repete: tem de ser pura e só muda nome e tarefas. Para desistir, o edit lança
// um erro com código (taskGone, taskLimit), que chega a quem chamou.
export async function updateModel({ db, appUser, modelId, edit, now = new Date() }) {
  await commitModels(db, appUser, [modelId], (fresh) => {
    const m = fresh.find((x) => x.id === modelId);
    if (!m) throw modelGone();
    const { name, tasks } = edit(m) || {};
    return { [modelId]: { ...pick(m), ...(name !== undefined ? { name } : {}), ...(tasks !== undefined ? { tasks } : {}) } };
  }, now);
}

// modelId null tira a pessoa de todo modelo que ela segue ("Sem modelo").
export async function setPersonModel({ db, appUser, models, userId, modelId, now = new Date() }) {
  await commitModels(db, appUser, (models || []).map((m) => m.id), (fresh) => {
    if (modelId === null) {
      const out = {};
      for (const m of fresh.filter((x) => (x.followerIds || []).includes(userId))) {
        out[m.id] = { ...pick(m), followerIds: m.followerIds.filter((x) => x !== userId) };
      }
      return out;
    }
    if (!fresh.some((m) => m.id === modelId)) throw modelGone();
    const out = {};
    for (const [mid, ids] of followerChanges(fresh, modelId, [userId])) {
      out[mid] = { ...pick(fresh.find((x) => x.id === mid)), followerIds: ids };
    }
    return out;
  }, now);
}

export async function deleteModel({ db, appUser, modelId, now = new Date() }) {
  await commitModels(db, appUser, [modelId], (fresh) => {
    const m = fresh.find((x) => x.id === modelId);
    return m ? { [modelId]: { ...pick(m), deleted: true } } : {};
  }, now);
}

// O check do consultor. As regras do Firestore exigem a hora do servidor e a
// observação vazia na criação, e só deixam mudar a observação depois.
export async function markDone({ db, appUser, model, task, now = new Date() }) {
  const dateKey = routineDayKey(now);
  const id = markIdOf(appUser.id, dateKey, task.id);
  await setDoc(markRef(db, id), {
    consultantId: appUser.id,
    consultantAuthUid: appUser.authUid,
    date: dateKey,
    modelId: model.id,
    taskId: task.id,
    taskTitle: task.title,
    taskTime: task.time ?? null,
    doneAt: serverTimestamp(),
    note: '',
  });
  return id;
}

export const saveMarkNote = ({ db, markId, note }) =>
  updateDoc(markRef(db, markId), { note: String(note ?? '').trim().slice(0, NOTE_MAX).trimEnd() });

export const undoMark = ({ db, markId }) => deleteDoc(markRef(db, markId));

// "Não mostrar novamente" da apresentação das Rotinas (src/lib/rotinasIntro.js).
// Grava no cadastro da própria pessoa, para valer em qualquer aparelho, pelo
// mesmo caminho do "já li" do sino (useNotificationsSeen): setDoc com merge,
// que junta o mapa introsDismissed sem apagar outra apresentação dispensada e
// não toca em papel, academia nem chave. As regras de stronix_users deixam o
// gestor (isAdmin) e a própria pessoa (cadastro com id igual ao uid) gravarem
// isso. Conta antiga, com o id do cadastro diferente do uid, é recusada, e a
// tela avisa que a apresentação pode voltar.
export async function dismissRotinasIntro({ db, userId }) {
  if (!userId) throw new Error('Sem o cadastro de quem dispensou a apresentação.');
  await setDoc(userRef(db, userId), { [INTROS_DISMISSED_FIELD]: { [ROTINAS_INTRO_ID]: true } }, { merge: true });
}
