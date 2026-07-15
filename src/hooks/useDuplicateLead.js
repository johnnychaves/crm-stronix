// Dup-check de cadastro por query remota (G1-flip / PR F). Antes o cadastro
// varria o prop global (findLeadByPhoneDigits) — que com o flip vira só 'ativo',
// deixando passar duplicata de CLIENTE ou PERDA. Aqui consultamos o campo
// materializado `whatsappDigits` (dígitos completos do WhatsApp), que cobre
// TODOS os buckets. Igualdade num só campo → índice automático (sem composto).
//
// Semântica idêntica ao findLeadByPhoneDigits: match EXATO dos dígitos completos.

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { normalizeLeadDoc } from '../lib/leads.js';

const MIN_DIGITS = 10;

// Consulta única (assíncrona) — usada no submit pra um check FRESCO (o hook tem
// debounce; digitar+enviar rápido poderia passar batido). excludeId ignora o
// próprio lead (edição). Retorna o lead duplicado ou null.
export async function findDuplicateLeadRemote({ db, phoneDigits, excludeId = null }) {
  if (!db || !phoneDigits || phoneDigits.length < MIN_DIGITS) return null;
  const colRef = collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH);
  const snap = await getDocs(query(colRef, where('whatsappDigits', '==', phoneDigits), limit(5)));
  return snap.docs.map(normalizeLeadDoc).find((l) => l.id !== excludeId) || null;
}

// Hook reativo (debounce) pro aviso "já existe" enquanto o usuário digita.
export function useDuplicateLead({ db, phoneDigits, excludeId = null, debounceMs = 300 }) {
  const [duplicate, setDuplicate] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!db || !phoneDigits || phoneDigits.length < MIN_DIGITS) {
      setDuplicate(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const hit = await findDuplicateLeadRemote({ db, phoneDigits, excludeId });
        if (!cancelled) setDuplicate(hit);
      } catch (e) {
        console.error('useDuplicateLead', e);
        if (!cancelled) setDuplicate(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, debounceMs);
    return () => { cancelled = true; clearTimeout(t); };
  }, [db, phoneDigits, excludeId, debounceMs]);

  return { duplicate, loading };
}
