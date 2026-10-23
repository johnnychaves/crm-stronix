// Grava um campo do Contexto comercial da ficha. O patch vem de
// buildContextPatch (só o campo). A troca de consultor passa pelo mesmo caminho
// do cadastro completo: nota na linha do tempo e patch do lead no MESMO batch
// (logInteraction), com o carimbo que o sino de quem recebeu lê depois.
// As etiquetas, com o valor da abertura (`from`), gravam só a diferença
// (tagsDiff): a lista inteira apagaria a etiqueta que outra aba gravou com o
// editor aberto. As regras do Firestore não olham as etiquetas, e o professor
// nunca chega aqui (a ficha pede CADASTRO_EDITAR).
import { arrayRemove, arrayUnion, doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { appId, LEADS_PATH } from './firebase.js';
import { logInteraction } from './interactions.js';
import { buildContextPatch, tagsDiff } from './contextPatch.js';
import { ownerChangeFor, ownerChangeNote } from './clientRegistration.js';

export async function saveContextField({ db, lead, appUser, field, value, from, usersList = [], professores = [] }) {
  const patch = buildContextPatch(field, value, { usersList, professores });
  if (!patch) return { ok: false, change: null };
  const ref = doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id);

  if (field === 'tags' && Array.isArray(from)) {
    const { added, removed } = tagsDiff(from, patch.tags);
    if (!added.length && !removed.length) return { ok: true, change: null };
    const batch = writeBatch(db);
    if (removed.length) batch.update(ref, { tags: arrayRemove(...removed) });
    if (added.length) batch.update(ref, { tags: arrayUnion(...added) });
    await batch.commit();
    return { ok: true, change: null };
  }

  if (field === 'consultantId') {
    const change = ownerChangeFor(lead, patch);
    // Escolher quem já é o responsável não muda nada: nem nota, nem carimbo.
    if (!change) return { ok: true, change: null };
    await logInteraction(
      db, lead, appUser,
      { text: ownerChangeNote(change), type: 'status_change' },
      {
        ...patch,
        consultantChangedAt: serverTimestamp(),
        consultantChangedByName: appUser?.name || null,
        consultantChangedByAuthUid: appUser?.authUid || null,
      }
    );
    return { ok: true, change };
  }

  await updateDoc(ref, patch);
  return { ok: true, change: null };
}
