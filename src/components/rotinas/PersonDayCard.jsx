import { Fragment } from 'react';
import { cn } from '@/lib/utils';
import { stateText } from '../../lib/rotinas.js';
import { clockText, isDoneState } from '../../lib/rotinasTela.js';
import { AppLink } from '../nav/AppLink.jsx';
import { PersonInitials } from './PersonInitials.jsx';
import { StateMark } from './StateMark.jsx';
import { META_TONE } from './routineTones.js';

// O cartão de um consultor na aba Hoje (mockup 2026-10-08-rotinas-aba-hoje.html,
// Hoje A). Sem a linha do dia logo abaixo do nome: o Johnny a tirou ao
// escolher a Hoje A, em 08/10/2026. Cada tarefa é um botão que mostra o
// detalhe na lateral (aria-pressed diz qual está aberta). Nenhum botão marca o
// check: quem marca é o consultor, na Meta diária.

// A linha do agora, com a hora, entre as tarefas com horário.
function NowLine({ now }) {
  return (
    <li aria-hidden="true" data-agora="" className="grid grid-cols-[42px_minmax(0,1fr)] items-center gap-[9px] px-2 py-0.5">
      <span className="num text-right text-[10.5px] font-semibold text-brand-600 dark:text-brand-300">{clockText(now)}</span>
      <span className="relative h-0.5 rounded bg-brand-600">
        <span className="absolute -left-[3px] -top-[3px] size-2 rounded-full bg-brand-600" />
      </span>
    </li>
  );
}

function TaskRow({ row, now, pressed, onSelect }) {
  const { task, state, doneAt, note } = row;
  return (
    <li>
      <button
        type="button"
        aria-pressed={pressed}
        onClick={onSelect}
        className={cn(
          'grid w-full grid-cols-[42px_18px_minmax(0,1fr)] items-center gap-[9px] rounded-[9px] px-2 py-1.5 text-left transition hover:bg-muted/60',
          pressed && 'bg-brand-600/[0.08] shadow-[inset_2px_0_0_var(--color-brand-600)] hover:bg-brand-600/[0.08]',
        )}
      >
        <span className="num text-right text-[11.5px] font-medium text-muted-foreground">{task.time ?? ''}</span>
        <StateMark state={state} />
        <span className="min-w-0">
          <span className={cn('block text-[13px] font-medium', isDoneState(state) && 'text-muted-foreground')}>{task.title}</span>
          <span className={cn('block text-[11px]', META_TONE[state])}>
            {stateText(task, state, doneAt ?? now, now)}
            {note && <span className="font-normal text-muted-foreground"> · com observação</span>}
          </span>
        </span>
      </button>
    </li>
  );
}

function Head({ person, children }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 px-3.5 pb-2.5 pt-3">
      <PersonInitials name={person.name} size={30} />
      {children}
    </div>
  );
}

export function PersonDayCard({ card, now, selectedTaskId, onSelect, modelLink, onChooseModel }) {
  const { person, model } = card;

  if (!model) {
    return (
      <section aria-label={person.name} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <Head person={person}>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold">{person.name}</p>
            <p className="text-[11.5px] font-semibold text-amber-700 dark:text-amber-300">Sem modelo</p>
          </div>
        </Head>
        <div className="flex flex-col items-start gap-2.5 border-t border-border bg-amber-500/[0.06] px-3.5 py-3.5 text-[12.5px] text-muted-foreground">
          A Meta diária não mostra rotina para essa pessoa.
          <button
            type="button"
            onClick={onChooseModel}
            className="h-8 rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-medium text-foreground"
          >
            Escolher modelo
          </button>
        </div>
      </section>
    );
  }

  const { timed, free, done, total, late, nowIndex, startsAt } = card;
  const rowEl = (row) => (
    <TaskRow
      key={row.task.id}
      row={row}
      now={now}
      pressed={selectedTaskId === row.task.id}
      onSelect={() => onSelect(person.id, row.task.id)}
    />
  );

  return (
    <section aria-label={person.name} className="rounded-2xl border border-border bg-card shadow-card">
      <Head person={person}>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">{person.name}</p>
          <AppLink {...modelLink(model.id)} className="block truncate text-[11.5px] font-semibold text-brand-600 dark:text-brand-300">
            {model.name}
          </AppLink>
        </div>
        {total > 0 && (
          <p className="text-right">
            <span className="num block font-display text-[18px] font-semibold leading-none">
              {done} <span className="text-[12px] font-medium text-muted-foreground">de {total}</span>
            </span>
            {late > 0
              ? <span className="mt-1 block text-[11px] font-semibold text-rose-600 dark:text-rose-300">{late} {late === 1 ? 'atrasada' : 'atrasadas'}</span>
              : <span className="mt-1 block text-[11px] text-muted-foreground">nada atrasado</span>}
          </p>
        )}
      </Head>
      <div className="border-t border-border px-1.5 pb-2 pt-1.5">
        {total === 0 && <p className="px-2 py-1.5 text-[12px] text-muted-foreground">Nenhuma tarefa hoje neste modelo.</p>}
        {total > 0 && startsAt && (
          <p className="px-2 py-1.5 text-[12px] text-muted-foreground">
            A rotina começa às {startsAt}. {total} {total === 1 ? 'tarefa' : 'tarefas'} hoje.
          </p>
        )}
        {total > 0 && !startsAt && (
          <>
            {timed.length > 0 && (
              <ol>
                {timed.map((row, i) => (
                  <Fragment key={row.task.id}>
                    {i === nowIndex && <NowLine now={now} />}
                    {rowEl(row)}
                  </Fragment>
                ))}
                {nowIndex === timed.length && <NowLine now={now} />}
              </ol>
            )}
            {free.length > 0 && (
              <>
                <p className="pb-0.5 pl-[59px] pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">A qualquer hora</p>
                <ol>{free.map(rowEl)}</ol>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
