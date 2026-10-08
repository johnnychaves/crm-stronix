import { useEffect, useState } from 'react';

// Relógio que anda a cada minuto, no ritmo da Meta diária. Serve às telas que
// mostram o estado da tarefa na hora de agora: a aba Hoje e a prévia do modelo
// aberto, nas Rotinas.
export function useMinuteClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
