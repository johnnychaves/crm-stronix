// Ficha do lead por id (G1-flip). Antes a ficha resolvia o lead achando-o no prop
// global (find por id); com o flip o prop vira só 'ativo', então clientes/perdas
// (abertos pela aba Clientes, Busca, Leads, coluna Perda) sumiriam da ficha.
// Aqui assinamos o DOC ÚNICO por id (onSnapshot) — ao vivo como antes (reflete
// edições na hora), 1 listener só enquanto a ficha está aberta, e cobre QUALQUER
// bucket. Independe do prop global, então sobrevive ao flip.

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { normalizeLeadDoc } from '../lib/leads.js';

// useProfileLead({ db, leadId }) -> { lead, loading }
export function useProfileLead({ db, leadId }) {
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Sem ficha aberta: não assina. O render gateia por profileLeadId, então um
    // `lead` obsoleto não aparece — não precisa resetar aqui.
    if (!db || !leadId) return undefined;
    // setState síncrono ao montar uma assinatura onSnapshot: a regra do React 19
    // marca como possível cascata (o snapshot pode vir do cache na hora), mas é o
    // padrão de subscription correto — o MESMO das assinaturas do App.jsx. As 2
    // renders (loader → ficha) são o comportamento desejado.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const ref = doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, leadId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setLead(snap.exists() ? normalizeLeadDoc(snap) : null);
        setLoading(false);
      },
      (e) => {
        console.error('useProfileLead', e);
        setLead(null);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [db, leadId]);

  // Só devolve o lead quando ele corresponde AO id pedido: com leadId nulo (ficha
  // fechada) ou durante a troca A→B (lead ainda é o antigo), devolve null. Isso
  // faz o gate do render (`profileLead ? ficha : ...`) liberar a navegação ao
  // fechar — sem isso o `lead` obsoleto travava a tela na ficha — e evita piscar
  // o lead anterior ao reabrir. (Substitui o reset síncrono no efeito, que a
  // regra set-state-in-effect barrava.)
  return { lead: lead && lead.id === leadId ? lead : null, loading };
}
