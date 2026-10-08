import { useEffect, useState } from 'react';

// Relógio que anda a cada minuto, no começo do minuto. Serve às telas que
// mostram o estado da tarefa na hora de agora: a aba Hoje e a prévia do modelo
// aberto, nas Rotinas. O primeiro tique espera só até o próximo :00 e dali em
// diante é um intervalo de 60 segundos, então o "Ao vivo · 10:48" troca quando
// o relógio do computador troca, e não até 59 segundos depois. A folga de 50 ms
// existe porque o timer pode disparar um instante antes do relógio de parede, e
// aí o minuto mostrado seria o de antes, por mais um minuto inteiro.
const MINUTE_MS = 60_000;
const SLACK_MS = 50;

export function useMinuteClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let interval = null;
    const first = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), MINUTE_MS);
    }, MINUTE_MS - (Date.now() % MINUTE_MS) + SLACK_MS);
    return () => {
      clearTimeout(first);
      if (interval !== null) clearInterval(interval);
    };
  }, []);
  return now;
}

// O instante que a tela usa de verdade. Enquanto `active` é verdadeiro, é o
// relógio de agora. Quando vira falso (o portão de ociosidade derrubou as
// assinaturas, src/lib/activityGate.js), guarda o instante em que isso
// aconteceu e devolve sempre ele: os dados pararam de chegar, e o relógio
// seguindo adiante transformaria em atrasada, sozinha, toda tarefa que o
// consultor fez depois da pausa. Ao voltar a ser verdadeiro, volta ao relógio.
// O instante guardado é derivado no próprio render, o mesmo padrão do
// useFreshModel da RotinasView, sem setState dentro de effect.
export function useFrozenWhileIdle(now, active) {
  const [frozen, setFrozen] = useState(null);
  if (!active && frozen === null) setFrozen(now);
  if (active && frozen !== null) setFrozen(null);
  return active ? now : (frozen ?? now);
}
