// Quem já usa um telefone: o lead dono do número (whatsappDigits) e os menores
// que o têm como responsável (guardianPhoneDigits). Serve aos avisos do
// cadastro e da edição, que nunca barram. Igualdade num campo só, então o
// índice é o automático, igual ao useDuplicateLead. withOwner: false pula a
// consulta do dono (o campo do próprio WhatsApp já usa useDuplicateLead para
// isso). pending: true enquanto a chave atual ainda não tem resposta.
//
// A resposta é guardada junto com a chave que a pediu (derive-in-render): o
// effect só escreve no fim da consulta assíncrona, dentro do setTimeout,
// nunca de forma síncrona no corpo dele, então não há setState dentro do
// effect em si, só na sua callback assíncrona.
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { normalizeLeadDoc } from '../lib/leads.js';
import { hasPhone } from '../lib/guardian.js';

const VAZIO = { owner: null, wards: [], pending: false };
const PENDENTE = { owner: null, wards: [], pending: true };

export function useGuardianMatches({ db, phoneDigits, excludeId = null, withOwner = true, debounceMs = 300 }) {
  const ativo = Boolean(db) && hasPhone(phoneDigits);
  const chave = ativo ? `${phoneDigits}|${excludeId ?? ''}|${withOwner}` : null;
  const [achado, setAchado] = useState({ chave: null, ...VAZIO });

  useEffect(() => {
    if (!chave) return undefined;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const colRef = collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH);
        const consultas = [
          withOwner
            ? getDocs(query(colRef, where('whatsappDigits', '==', phoneDigits), limit(5)))
            : null,
          getDocs(query(colRef, where('guardianPhoneDigits', '==', phoneDigits), limit(10))),
        ];
        const [donos, menores] = await Promise.all(consultas);
        if (cancelled) return;
        const fora = (l) => l.id !== excludeId;
        setAchado({
          chave,
          owner: donos ? donos.docs.map(normalizeLeadDoc).find(fora) || null : null,
          wards: menores.docs.map(normalizeLeadDoc).filter(fora),
          pending: false,
        });
      } catch (e) {
        console.error('useGuardianMatches', e);
        if (!cancelled) setAchado({ chave, ...VAZIO });
      }
    }, debounceMs);
    return () => { cancelled = true; clearTimeout(t); };
  }, [db, chave, phoneDigits, excludeId, withOwner, debounceMs]);

  // Estável: sem chave devolve sempre a mesma constante VAZIO; com chave sem
  // resposta ainda, sempre a mesma PENDENTE. O campo `chave` extra em achado
  // é inofensivo (nenhum consumidor lê ele).
  return chave ? (achado.chave === chave ? achado : PENDENTE) : VAZIO;
}
