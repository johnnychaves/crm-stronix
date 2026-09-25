// Quem já usa um telefone: o lead dono do número (whatsappDigits) e os menores
// que o têm como responsável (guardianPhoneDigits). Serve aos avisos do
// cadastro e da edição, que nunca barram. Igualdade num campo só, então o
// índice é o automático, igual ao useDuplicateLead.
// A resposta é guardada junto com a chave que a pediu (derive-in-render): o
// effect só escreve no fim da consulta assíncrona (dentro do setTimeout),
// nunca de forma síncrona no corpo dele, então não há setState dentro do
// effect em si — só na sua callback assíncrona.
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { normalizeLeadDoc } from '../lib/leads.js';

const MIN_DIGITS = 10;
const VAZIO = { owner: null, wards: [] };

export function useGuardianMatches({ db, phoneDigits, excludeId = null, debounceMs = 300 }) {
  const ativo = Boolean(db) && typeof phoneDigits === 'string' && phoneDigits.length >= MIN_DIGITS;
  const chave = ativo ? `${phoneDigits}|${excludeId ?? ''}` : null;
  const [achado, setAchado] = useState({ chave: null, ...VAZIO });

  useEffect(() => {
    if (!chave) return undefined;
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
        setAchado({
          chave,
          owner: donos.docs.map(normalizeLeadDoc).find(fora) || null,
          wards: menores.docs.map(normalizeLeadDoc).filter(fora),
        });
      } catch (e) {
        console.error('useGuardianMatches', e);
        if (!cancelled) setAchado({ chave, ...VAZIO });
      }
    }, debounceMs);
    return () => { cancelled = true; clearTimeout(t); };
  }, [db, chave, phoneDigits, excludeId, debounceMs]);

  // A resposta só vale para o telefone que a pediu: trocou ou apagou o número,
  // o aviso antigo some no mesmo render, sem setState dentro do effect.
  return chave && achado.chave === chave ? { owner: achado.owner, wards: achado.wards } : VAZIO;
}
