import { useEffect, useState } from 'react';

// Diz se o elemento (o cabeçalho da ficha) saiu da tela POR CIMA. Usa um
// IntersectionObserver e não um evento de rolagem: o observador recorta pelo
// contêiner que rola (a área de conteúdo do App), então "não visível" quer
// dizer fora dela. O `top` negativo separa o que saiu por cima do que ainda
// está embaixo. Sem IntersectionObserver (testes, navegador muito antigo)
// devolve sempre false, e a barra fina nunca aparece.
export function useHeaderGone(ref) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => {
      setGone(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return gone;
}
