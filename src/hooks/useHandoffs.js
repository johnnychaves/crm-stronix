// Leads e clientes que outra pessoa passou pra SUA carteira. Alimenta o grupo
// "Passaram para você" do sino.
//
// Por que uma consulta própria em vez de filtrar o que está em memória: a
// assinatura ao vivo só carrega o balde ATIVO (App.jsx, flip do G1), então
// cliente reatribuído nunca apareceria. É um getDocs por sessão, limitado a 15
// docs e à janela de 30 dias — leitura desprezível perto do tráfego do app.
//
// O `where` em consultantChangedAt exclui de graça todo lead que nunca trocou
// de dono (documento sem o campo não entra em where — a armadilha de sempre,
// aqui a nosso favor).

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { normalizeLeadDoc } from '../lib/leads.js';

const WINDOW_DAYS = 30;
const MAX = 15;

export function useHandoffs({ db, appUser, enabled = true }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!enabled || !db || !appUser?.id) return;
    let cancelled = false;
    const cutoff = Timestamp.fromMillis(Date.now() - WINDOW_DAYS * 86_400_000);
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH);
    getDocs(query(
      colRef,
      where('consultantId', '==', appUser.id),
      where('consultantChangedAt', '>=', cutoff),
      orderBy('consultantChangedAt', 'desc'),
      limit(MAX)
    ))
      .then((snap) => { if (!cancelled) setItems(snap.docs.map(normalizeLeadDoc)); })
      .catch((e) => { console.error('useHandoffs', e); });
    return () => { cancelled = true; };
  }, [db, appUser?.id, enabled]);

  return items;
}
