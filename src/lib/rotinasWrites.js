// Gravações das rotinas dos consultores. O QUE gravar sai de rotinas.js
// (puro); aqui fica o COMO. Toda gravação de modelo passa por commitModels:
// lê os modelos numa transação, grava o modelo e a versão do dia juntos, e
// assim duas abas do gestor não deixam ninguém em dois modelos.
import { collection, deleteDoc, doc, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { appId, ROUTINE_MARKS_PATH, ROUTINE_MODELS_PATH, ROUTINE_VERSIONS_PATH } from './firebase.js';
import { NOTE_MAX, copyName, followerChanges, markIdOf, modelDocs, newTaskId, routineDayKey } from './rotinas.js';

const modelsCol = (db) => collection(db, 'artifacts', appId, 'public', 'data', ROUTINE_MODELS_PATH);
const modelRef = (db, id) => doc(db, 'artifacts', appId, 'public', 'data', ROUTINE_MODELS_PATH, id);
const versionRef = (db, id) => doc(db, 'artifacts', appId, 'public', 'data', ROUTINE_VERSIONS_PATH, id);
const markRef = (db, id) => doc(db, 'artifacts', appId, 'public', 'data', ROUTINE_MARKS_PATH, id);

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
  await commitModels(db, appUser, (models || []).map((m) => m.id), (fresh) => {
    const source = copyFrom ? fresh.find((m) => m.id === copyFrom) : null;
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

// edit(modeloAtual) devolve só o que muda: { name } ou { tasks }.
export async function updateModel({ db, appUser, modelId, edit, now = new Date() }) {
  await commitModels(db, appUser, [modelId], (fresh) => {
    const m = fresh.find((x) => x.id === modelId);
    if (!m) throw new Error('modelo-sumiu');
    return { [modelId]: { ...pick(m), ...edit(m) } };
  }, now);
}

// modelId null tira a pessoa do modelo que ela segue ("Sem modelo").
export async function setPersonModel({ db, appUser, models, userId, modelId, now = new Date() }) {
  await commitModels(db, appUser, (models || []).map((m) => m.id), (fresh) => {
    if (modelId === null) {
      const from = fresh.find((m) => (m.followerIds || []).includes(userId));
      return from ? { [from.id]: { ...pick(from), followerIds: from.followerIds.filter((x) => x !== userId) } } : {};
    }
    if (!fresh.some((m) => m.id === modelId)) throw new Error('modelo-sumiu');
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
  updateDoc(markRef(db, markId), { note: String(note ?? '').trim().slice(0, NOTE_MAX) });

export const undoMark = ({ db, markId }) => deleteDoc(markRef(db, markId));
