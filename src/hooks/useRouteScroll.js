import { useCallback, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';
import { parseAppPath, screenKey, scrollActionFor } from '../lib/routes.js';

// Rolagem do container compartilhado do App. O navegador só devolve a rolagem
// da janela, e o app rola dentro de um div, então a memória é nossa: uma
// posição por entrada do histórico (location.key), guardada só nesta aba.
// Ir para outra tela vai ao topo. Voltar ou avançar devolve a posição daquela
// entrada. Na mesma tela, não mexe. Containers internos (colunas da Meta,
// board do Pipeline) ficam de fora nesta entrega.

const MAX_ENTRIES = 100;
const RESTORE_TIMEOUT_MS = 1500;
// Qualquer um destes quer dizer que a pessoa começou a rolar por conta própria.
const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'keydown', 'mousedown'];

// Guarda as últimas `max` posições. Lembrar de novo uma entrada a põe no fim
// da fila, e a mais antiga sai quando passa do teto.
export function createScrollMemory(max = MAX_ENTRIES) {
  const positions = new Map();
  return {
    remember(key, top) {
      positions.delete(key);
      positions.set(key, top);
      if (positions.size > max) positions.delete(positions.keys().next().value);
    },
    recall(key) {
      return positions.get(key) ?? 0;
    },
  };
}

const memory = createScrollMemory();

// A lista da tela pode chegar depois (getDocs) e ainda não ter altura para a
// posição guardada. Tenta de novo a cada quadro, até chegar lá, até passar
// timeoutMs ou até a pessoa rolar. É por quadro, e não por ResizeObserver,
// porque o filho do div que rola tem h-full: a lista pode crescer por dentro
// sem mudar o tamanho da caixa dele. Devolve a função que para as tentativas.
export function restoreWhenTall(el, top, timeoutMs = RESTORE_TIMEOUT_MS) {
  el.scrollTop = top;
  const reached = () => el.scrollTop >= top - 1;
  if (reached() || typeof requestAnimationFrame === 'undefined') return () => {};

  let frame = 0;
  let timer = null;
  const stop = () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    for (const type of USER_SCROLL_EVENTS) el.removeEventListener(type, stop);
  };
  const retry = () => {
    el.scrollTop = top;
    if (reached()) stop();
    else frame = requestAnimationFrame(retry);
  };

  frame = requestAnimationFrame(retry);
  timer = setTimeout(stop, timeoutMs);
  for (const type of USER_SCROLL_EVENTS) el.addEventListener(type, stop, { passive: true });
  return stop;
}

// useRouteScroll(ref) devolve o onScroll do div que rola. A primeira passada
// (montagem) só registra a tela, sem mexer na rolagem.
export function useRouteScroll(ref) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const locationKey = location.key;
  const key = screenKey(parseAppPath(location.pathname));
  const prevKeyRef = useRef(null);

  useLayoutEffect(() => {
    const prevScreenKey = prevKeyRef.current;
    prevKeyRef.current = key;
    const el = ref.current;
    if (!el || prevScreenKey === null) return undefined;

    const action = scrollActionFor({ navigationType, prevScreenKey, screenKey: key });
    if (action === 'top') {
      el.scrollTop = 0;
      return undefined;
    }
    if (action === 'restore') return restoreWhenTall(el, memory.recall(locationKey));
    return undefined;
  }, [ref, navigationType, key, locationKey]);

  return useCallback((event) => {
    memory.remember(locationKey, event.currentTarget.scrollTop);
  }, [locationKey]);
}
