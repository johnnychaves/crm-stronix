// Diz se as assinaturas ao vivo devem estar ligadas. A regra pura (e o porquê
// disso existir) vive em src/lib/activityGate.js; aqui é só a fiação com o DOM.
//
// Retorna `true` enquanto tem gente mexendo e `false` depois de IDLE_TIMEOUT_MS
// sem nenhum sinal de vida. Quem consome usa o valor como dependência do effect
// de assinatura: ao virar false o cleanup do React derruba os listeners; ao
// virar true eles voltam. A SESSÃO não é tocada — ninguém é deslogado.
//
// `beforeResume(resume)`, opcional, roda na volta da pausa, antes de religar.
// Quem passa decide: chama `resume()` para religar, ou não chama (a página vai
// recarregar). Enquanto ele não responde, o portão continua desligado, nenhum
// outro sinal de vida o chama de novo e o relógio não religa. Depois de
// RESUME_HOLD_MAX_MS sem resposta, religa sozinho. É o que o App usa para
// recarregar quando saiu versão nova (src/hooks/useReloadOnUpdate.js) sem
// religar as assinaturas antes, o que faria o Firestore ler tudo duas vezes.

import { useEffect, useRef, useState } from 'react';
import {
  ACTIVITY_EVENTS,
  IDLE_CHECK_MS,
  IDLE_TIMEOUT_MS,
  RESUME_HOLD_MAX_MS,
  shouldListen
} from '../lib/activityGate.js';

export function useActivityGate(idleTimeoutMs = IDLE_TIMEOUT_MS, { beforeResume } = {}) {
  // Começa ligado: quem acabou de abrir o app está mexendo.
  const [active, setActive] = useState(true);
  // Inicia em 0 e recebe o relógio no effect — Date.now() durante o render é
  // função impura (react-hooks v7 barra). Até o effect montar, `active` já é
  // true, então o 0 nunca é lido.
  const lastActivityRef = useRef(0);
  // Espelho do `active` para os ouvintes, que não re-renderizam.
  const activeRef = useRef(true);
  // Timer da volta que espera o beforeResume; null quando nenhuma espera.
  const holdRef = useRef(null);
  // O beforeResume mais recente, sem refazer os ouvintes a cada render.
  const beforeResumeRef = useRef(beforeResume);
  useEffect(() => { beforeResumeRef.current = beforeResume; }, [beforeResume]);

  useEffect(() => {
    // Monte = atividade: é o instante em que a pessoa abriu ou recarregou.
    lastActivityRef.current = Date.now();

    // Religa. Pode ser chamado duas vezes (o beforeResume e o limite de
    // espera): a segunda não muda nada.
    const resume = () => {
      clearTimeout(holdRef.current);
      holdRef.current = null;
      activeRef.current = true;
      setActive(true);
    };

    // Sinal de vida. Escreve só no ref porque mousemove dispara às centenas por
    // segundo e não pode custar um render cada. Com o portão ligado (o caso
    // comum, de longe) não faz mais nada.
    const markActive = () => {
      lastActivityRef.current = Date.now();
      if (activeRef.current || holdRef.current) return;
      const hold = beforeResumeRef.current;
      if (!hold) { resume(); return; }
      holdRef.current = setTimeout(resume, RESUME_HOLD_MAX_MS);
      hold(resume);
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
    // Durante a espera do beforeResume ele não mexe: quem religa é o resume.
    const id = setInterval(() => {
      if (holdRef.current) return;
      const next = shouldListen({
        lastActivityMs: lastActivityRef.current,
        nowMs: Date.now(),
        idleTimeoutMs
      });
      activeRef.current = next;
      setActive(next);
    }, IDLE_CHECK_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, markActive, opts));
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(id);
      clearTimeout(holdRef.current);
      holdRef.current = null;
    };
  }, [idleTimeoutMs]);

  return active;
}
