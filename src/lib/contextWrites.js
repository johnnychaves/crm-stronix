// Grava um campo do Contexto comercial da ficha. O patch vem de
// buildContextPatch (só o campo). A troca de consultor passa pelo mesmo caminho
// do cadastro completo: nota na linha do tempo e patch do lead no MESMO batch
// (logInteraction), com o carimbo que o sino de quem recebeu lê depois.
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { appId, LEADS_PATH } from './firebase.js';
import { logInteraction } from './interactions.js';
import { buildContextPatch } from './contextPatch.js';
import { ownerChangeFor, ownerChangeNote } from './clientRegistration.js';

export async function saveContextField({ db, lead, appUser, field, value, usersList = [], professores = [] }) {
  const patch = buildContextPatch(field, value, { usersList, professores });
  if (!patch) return { ok: false, change: null };

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

  await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), patch);
  return { ok: true, change: null };
}
