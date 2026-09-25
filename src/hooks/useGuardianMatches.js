// Quem já usa um telefone: o lead dono do número (whatsappDigits) e os menores
// que o têm como responsável (guardianPhoneDigits). Serve aos avisos do
// cadastro e da edição, que nunca barram. Igualdade num campo só, então o
// índice é o automático, igual ao useDuplicateLead.
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { normalizeLeadDoc } from '../lib/leads.js';

const MIN_DIGITS = 10;
const VAZIO = { owner: null, wards: [] };

export function useGuardianMatches({ db, phoneDigits, excludeId = null, debounceMs = 300 }) {
  const [matches, setMatches] = useState(VAZIO);

  useEffect(() => {
    if (!db || !phoneDigits || phoneDigits.length < MIN_DIGITS) {
      setMatches(VAZIO);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const colRef = collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH);
        const [donos, menores] = await Promise.all([
          getDocs(query(colRef, where('whatsappDigits', '==', phoneDigits), limit(5))),
          getDocs(query(colRef, where('guardianPhoneDigits', '==', phoneDigits), limit(10))),
        ]);
        if (cancelled) return;
        const fora = (l) => l.id !== excludeId;
        setMatches({
          owner: donos.docs.map(normalizeLeadDoc).find(fora) || null,
          wards: menores.docs.map(normalizeLeadDoc).filter(fora),
        });
      } catch (e) {
        console.error('useGuardianMatches', e);
        if (!cancelled) setMatches(VAZIO);
      }
    }, debounceMs);
    return () => { cancelled = true; clearTimeout(t); };
  }, [db, phoneDigits, excludeId, debounceMs]);

  return matches;
}
