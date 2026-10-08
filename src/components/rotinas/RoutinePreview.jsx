import { useId } from 'react';
import { cn } from '@/lib/utils';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { useMinuteClock } from '../../hooks/useMinuteClock.js';
import { stateText, taskStateAt, tasksForDay } from '../../lib/rotinas.js';
import { StateMark } from './StateMark.jsx';

// Quantas tarefas a prévia mostra. O resto vira "E mais 2 hoje.".
const PREVIEW_MAX = 6;

const TIME_TONE = {
  now: 'text-brand-600 dark:text-brand-300',
  late: 'text-rose-600 dark:text-rose-300',
};

// "Como o consultor vê · na Meta diária", no modelo aberto (mockup
// 2026-10-08-rotinas-intro-e-polimento.html, Página B): as tarefas de hoje
// deste modelo no desenho do cartão da Meta, com o estado da hora de agora. É
// só leitura e sem os checks de ninguém: mostra o que aparece hoje e em que
// ordem, e não quem fez. Quem fez está na aba Hoje. Por isso o cabeçalho diz
// quantas tarefas são, e não "0 de 5".
export function RoutinePreview({ model }) {
  const titleId = useId();
  const now = useMinuteClock();
  const { metaWeekdays = [1, 2, 3, 4, 5] } = useGeneralConfig();
  const tasks = tasksForDay(model, now, metaWeekdays);

  return (
    <section aria-labelledby={titleId}>
      <p id={titleId} className="mb-2 flex items-baseline justify-between gap-2 px-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        Como o consultor vê <span className="font-medium normal-case tracking-normal">na Meta diária</span>
      </p>
      <div className="rounded-2xl border border-border bg-card p-3.5 shadow-card">
        <p className="flex items-baseline justify-between gap-2">
          <span className="font-display text-[13px] font-semibold">Rotina de hoje</span>
          <span className="num text-[11px] text-muted-foreground">{tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'}</span>
        </p>
        {tasks.length === 0 ? (
          <p className="mt-2 text-[12px] text-muted-foreground">Hoje este modelo não tem tarefa.</p>
        ) : (
          <ul className="mt-2.5 flex flex-col gap-1">
            {tasks.slice(0, PREVIEW_MAX).map((task) => {
              const state = taskStateAt(task, null, now);
              return (
                <li
                  key={task.id}
                  className={cn(
                    'grid grid-cols-[38px_18px_minmax(0,1fr)] items-center gap-2 rounded-lg px-1.5 py-[5px] text-[12px]',
                    state === 'now' && 'bg-brand-600/[0.08] shadow-[inset_2px_0_0_var(--color-brand-600)]',
                  )}
                >
                  <span className={cn('num text-right text-[11px] font-medium', TIME_TONE[state] ?? 'text-muted-foreground')}>{task.time ?? ''}</span>
                  <StateMark state={state} />
                  {/* O estado por escrito, o mesmo texto do cartão do consultor:
                      sem ele, "agora" e "atrasada" só existiriam na cor. */}
                  <span className="min-w-0 truncate">
                    {task.title}
                    <span className="sr-only">. {stateText(task, state, now, now)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {tasks.length > PREVIEW_MAX && (
          <p className="mt-1.5 px-1.5 text-[11px] text-muted-foreground">E mais {tasks.length - PREVIEW_MAX} hoje.</p>
        )}
      </div>
    </section>
  );
}
