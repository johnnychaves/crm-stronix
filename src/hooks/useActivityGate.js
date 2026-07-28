// Diz se as assinaturas ao vivo devem estar ligadas. A regra pura (e o porquê
// disso existir) vive em src/lib/activityGate.js; aqui é só a fiação com o DOM.
//
// Retorna `true` enquanto tem gente mexendo e `false` depois de IDLE_TIMEOUT_MS
// sem nenhum sinal de vida. Quem consome usa o valor como dependência do effect
// de assinatura: ao virar false o cleanup do React derruba os listeners; ao
// virar true eles voltam. A SESSÃO não é tocada — ninguém é deslogado.

import { useEffect, useRef, useState } from 'react';
import {
  ACTIVITY_EVENTS,
  IDLE_CHECK_MS,
  IDLE_TIMEOUT_MS,
  shouldListen
} from '../lib/activityGate.js';

export function useActivityGate(idleTimeoutMs = IDLE_TIMEOUT_MS) {
  // Começa ligado: quem acabou de abrir o app está mexendo.
  const [active, setActive] = useState(true);
  // Inicia em 0 e recebe o relógio no effect — Date.now() durante o render é
  // função impura (react-hooks v7 barra). Até o effect montar, `active` já é
  // true, então o 0 nunca é lido.
  const lastActivityRef = useRef(0);

  useEffect(() => {
    // Monte = atividade: é o instante em que a pessoa abriu ou recarregou.
    lastActivityRef.current = Date.now();

    // Sinal de vida. Escreve só no ref porque mousemove dispara às centenas por
    // segundo e não pode custar um render cada. O setActive é guardado pra não
    // re-renderizar quando já está ligado (o caso comum, de longe).
    const markActive = () => {
      lastActivityRef.current = Date.now();
      setActive((prev) => (prev ? prev : true));
    };

    // Voltar pra aba conta como atividade mesmo sem mouse: a pessoa está ali.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') markActive();
    };

    // capture: true porque `scroll` não borbulha — sem isso, rolar uma lista
    // interna não seria visto como atividade e a tela cairia com gente usando.
    const opts = { passive: true, capture: true };
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, markActive, opts));
    document.addEventListener('visibilitychange', onVisibility);

    // Relógio de ociosidade. Só compara números em memória — não encosta no
    // Firestore. Enquanto a máquina dorme ele não roda; ao acordar, a primeira
    // batida já enxerga o buraco e desliga (a menos que a pessoa mexa antes).
    const id = setInterval(() => {
      setActive(shouldListen({
        lastActivityMs: lastActivityRef.current,
        nowMs: Date.now(),
        idleTimeoutMs
      }));
    }, IDLE_CHECK_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, markActive, opts));
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(id);
    };
  }, [idleTimeoutMs]);

  return active;
}
