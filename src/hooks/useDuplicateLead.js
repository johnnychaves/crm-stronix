// Dup-check de cadastro por query remota (G1-flip / PR F). Antes o cadastro
// varria o prop global (findLeadByPhoneDigits) — que com o flip vira só 'ativo',
// deixando passar duplicata de CLIENTE ou PERDA. A consulta cobre TODOS os
// buckets. Igualdade num só campo → índice automático (sem composto).
//
// Desde 09/10/2026 o campo é a chave do telefone (`zapMatchKey`: DDD mais os 8
// últimos dígitos, de api/_zapPhone.js), a mesma do Stronizap. Antes era o
// `whatsappDigits`, por igualdade exata, e o mesmo celular escrito sem o nono
// dígito ou com 55 na frente passava como outra pessoa. Todo lead gravado
// desde 08/09/2026 tem a chave, e os de antes foram preenchidos pelo
// scripts/backfill-zap-match-key.js (STRONIX, Shape One e Artesporte).

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { normalizeLeadDoc } from '../lib/leads.js';
import { zapMatchKey } from '../../api/_zapPhone.js';

const MIN_DIGITS = 10;

// Consulta única (assíncrona) — usada no submit pra um check FRESCO (o hook tem
// debounce; digitar+enviar rápido poderia passar batido). excludeId ignora o
// próprio lead (edição). Retorna o lead duplicado ou null.
export async function findDuplicateLeadRemote({ db, phoneDigits, excludeId = null }) {
  if (!db || !phoneDigits || phoneDigits.length < MIN_DIGITS) return null;
  const key = zapMatchKey(phoneDigits);
  if (!key) return null;
  const colRef = collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH);
  const snap = await getDocs(query(colRef, where('zapMatchKey', '==', key), limit(5)));
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
