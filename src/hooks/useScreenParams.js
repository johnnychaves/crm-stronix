import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { readScreenParams, screenParamsQuery } from '../lib/screenParams.js';

// O filtro da tela sai do endereço a cada render e volta para ele a cada
// escolha. Nada de useState para filtro, nada de ler a URL num effect: é a
// mesma regra que o screenState já segue para a tela e a ficha.
//
// - o destino é montado com o location.pathname de agora, e não com hrefFor:
//   trocar filtro é ficar na mesma tela, e o Operacional tem dois endereços
//   válidos (/<academia> e /<academia>/visao-geral/operacional);
// - replace, para trocar filtro não criar parada no voltar do navegador
//   (decisão 3 do Johnny) e para o idx do histórico, que o Voltar da ficha lê,
//   continuar andando só quando se troca de tela;
// - o state vai explícito, porque o navigate não o repassa sozinho e é nele
//   que vive a tela de origem da ficha.
//
// `ctx` é o que o saneamento precisa saber e só a tela tem. Ele entra em
// dependência de hook, então a tela precisa montá-lo com useMemo.
export function useScreenParams(screen, ctx) {
  const location = useLocation();
  const navigate = useNavigate();
  const { pathname, search, state } = location;

  const values = useMemo(() => readScreenParams(screen, search, ctx), [screen, search, ctx]);

  const setParams = useCallback((patch) => {
    const escolha = typeof patch === 'function' ? patch(values) : patch;
    const next = { ...values, ...escolha };
    const query = screenParamsQuery(screen, next, ctx);
    // Clique que não muda o recorte não navega. Clicar na aba de dia que já
    // está acesa, em "Toda a equipe" sem ninguém escolhido ou em "Limpar" sem
    // nada para limpar daria um replace com chave nova e um render da árvore
    // inteira à toa.
    if (query === search) return;
    navigate(pathname + query, { replace: true, state });
  }, [values, ctx, navigate, pathname, search, state, screen]);

  return [values, setParams];
}
