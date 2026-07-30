// Consulta AO VIVO dos agendamentos de HOJE — a fonte extra da agenda do dia.
//
// Por que existe: a assinatura global do App carrega só `lifecycleBucket ==
// 'ativo'` (flip da PR #144), então cliente e perda não estão em memória. Esta
// consulta pega a janela do dia sem filtrar balde, e a regra pura une as duas.
//
// Índice: range em UM campo só (appointmentScheduledFor) usa índice automático
// do Firestore. NÃO precisa publicar índice no console.
//
// IMPORTANTE: `enabled` tem que receber o portão de atividade (listenersActive
// do App). Sem isso, uma aba esquecida aberta mantém o listener a noite toda e
// desfaz a economia da PR #164 (o Firestore recobra a query inteira quando o
// listener fica desconectado por mais de 30 min).

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { normalizeLeadDoc } from '../lib/leads.js';

export function useDayAgenda({ db, enabled = true, dayKey }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !enabled) return undefined;
    // dayKey não é lido aqui: entra só como dependência para a janela ser
    // recriada na virada da meia-noite com a aba aberta.
    void dayKey;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH),
      where('appointmentScheduledFor', '>=', start),
      where('appointmentScheduledFor', '<=', end)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map(normalizeLeadDoc));
        setLoading(false);
      },
      (err) => {
        console.error('useDayAgenda onSnapshot falhou', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [db, enabled, dayKey]);

  return { items, loading };
}
