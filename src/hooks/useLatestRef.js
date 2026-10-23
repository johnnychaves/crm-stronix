import { useLayoutEffect, useRef } from 'react';

// Um ref que guarda sempre o valor da última renderização. Serve a callback que chega tarde:
// ela foi criada numa renderização antiga e, sozinha, enxerga as funções e os dados de lá. Quem a
// chama por `ref.current` usa as de agora. O ref é escrito num efeito de layout, depois do commit
// (escrever o ref durante o render reprova o lint `react-hooks/refs`), então só vale fora do render.
export function useLatestRef(value) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
