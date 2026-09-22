import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useToast } from '../contexts/ToastContext.jsx';
import { ROUTE_NOTICES } from '../lib/routes.js';

// Troca o endereço barrado pelo destino da decisão de rota (routeDecision) e
// mostra o aviso, quando há. Não desenha nada: o App já desenha a tela de
// destino no mesmo render, então a tela barrada nunca pisca. O App monta este
// componente com key={location.key}, e cada endereço barrado ganha instância
// nova. A troca passa pelo navigate de propósito: um history.replaceState
// cru apagaria o idx que o Voltar da ficha lê.
// toast.warning e navigate não são setState de useState, então a regra
// react-hooks/set-state-in-effect não se aplica. No dev, o StrictMode roda o
// effect duas vezes e o aviso aparece em dobro. Em produção, uma vez.
export function RouteRedirect({ to, notice }) {
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    const message = notice ? ROUTE_NOTICES[notice] : null;
    if (message) toast.warning(message);
    navigate(to, { replace: true });
  }, [to, notice, navigate, toast]);

  return null;
}
