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
  // A resposta guarda a chave da leitura que a trouxe. O App, que não remonta
  // no "Acessar como", passa a sessão no `dayKey`: até a leitura nova chegar, a
  // lista é vazia, e nunca a da academia ou do dia de antes. Com a leitura
  // pausada (`enabled` falso, a pausa por inatividade) a última resposta fica.
  const key = String(dayKey);
  const [data, setData] = useState({ key: null, items: [], loaded: false });

  useEffect(() => {
    if (!db || !enabled) return undefined;
    // dayKey recria a janela na virada da meia-noite com a aba aberta e marca
    // de que leitura veio a resposta.

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
        setData({ key: String(dayKey), items: snap.docs.map(normalizeLeadDoc), loaded: true });
      },
      (err) => {
        console.error('useDayAgenda onSnapshot falhou', err);
        setData((prev) => (prev.key === String(dayKey) ? { ...prev, loaded: true } : { key: String(dayKey), items: [], loaded: true }));
      }
    );

    return () => unsub();
  }, [db, enabled, dayKey]);

  const current = data.key === key;
  return { items: current ? data.items : [], loading: !(current && data.loaded) };
}
