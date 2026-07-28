import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase.js';

// Limites de assento do plano (gestores/consultores inclusos + preço do extra),
// via GET /api/asaas. Duas telas precisam do mesmo dado — a faixa de assentos da
// Equipe e o atalho "Cadastrar consultor" da Visão geral — então a busca vive
// aqui em vez de duplicada nas duas.
//
// Degrada em silêncio: sem resposta, os contadores somem da tela e o limite
// segue valendo no servidor (que é quem realmente barra).
function useSeatLimits() {
  const [seats, setSeats] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch('/api/asaas', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => null);
        if (alive && res.ok && data?.seatLimits) setSeats({ ...data.seatLimits, planName: data.planName });
      } catch (err) {
        console.error('seat limits', err);
      }
    })();
    return () => { alive = false; };
  }, []);

  return seats;
}

export { useSeatLimits };
