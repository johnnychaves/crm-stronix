import { useEffect, useMemo } from 'react';
import { buildInteractionsByLead, computeDailyGoalSlots, slotTotals } from '../../lib/dailyGoal.js';
import { pendingEntries, urgentCount } from '../../lib/metaFoco.js';
import { useMinuteClock } from '../../hooks/useMinuteClock.js';

// Quantas tarefas da Meta estão urgentes agora (metaFoco.urgentCount: visita ou
// aula que passou da hora, ou o que vence em até 90 minutos). O número vai para
// o título da aba ("(2) Pipeline · Academia · STRONILEAD"), que avisa com a aba
// em segundo plano, em qualquer tela. Só o número: nunca nome de lead.
//
// Mora num componente à parte, que não desenha nada, por causa do relógio: no
// App, o relógio por minuto redesenharia o app inteiro a cada minuto. Aqui ele
// redesenha só este componente, e o App só redesenha quando o número muda.
//
// As categorias saem do computeDailyGoalSlots com este relógio, como na tela da
// Meta, e não das do selo do menu, que só recalculam com dado novo: o Novo lead
// vira Atrasado quando a janela de 24h fecha, e com as categorias velhas ele
// seguiria contando como urgente com o prazo vencido.
//
// O relógio não congela na pausa por inatividade, ao contrário da tela da Meta:
// a aba em segundo plano é justamente a que fica parada, e é nela que o número
// precisa andar. Com as leituras pausadas, uma tarefa feita em outro aparelho
// pode continuar contando até a pessoa voltar à aba.
//
// O mesmo cálculo dá o total e as pendências do dia (`onProgress`), que o App
// usa no selo do menu e na gravação do dia batido. Até 21/10/2026 o App
// calculava os dois sem relógio, e o dia não batia quando só o relógio mudava a
// Meta. O aviso leva as listas de onde saiu (`leads` e `interactions`), para o
// App não gravar o dia com a conta de uma base que ainda estava chegando.
export function MetaUrgentCount({ leads, interactions, userId, renewalCheckpoints, renewalGraceDays, onChange, onProgress }) {
  const now = useMinuteClock();
  const byLead = useMemo(() => buildInteractionsByLead(interactions), [interactions]);
  const { n, total, pending } = useMemo(() => {
    const slots = computeDailyGoalSlots(leads, byLead, userId, renewalCheckpoints, renewalGraceDays, now);
    const { totalSlots, doneSlots } = slotTotals(slots);
    return { n: urgentCount(pendingEntries(slots), now), total: totalSlots, pending: totalSlots - doneSlots };
  }, [leads, byLead, userId, renewalCheckpoints, renewalGraceDays, now]);
  useEffect(() => { onChange(n); }, [n, onChange]);
  useEffect(() => () => onChange(0), [onChange]);
  useEffect(() => {
    if (onProgress) onProgress({ leads, interactions, total, pending });
  }, [leads, interactions, total, pending, onProgress]);
  return null;
}
