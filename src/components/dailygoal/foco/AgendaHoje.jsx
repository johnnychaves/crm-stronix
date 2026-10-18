import { Check, X } from 'lucide-react';
import { cn } from '../../../lib/utils.js';
import { agendaSubtitle } from '../../../lib/dayAgenda.js';
import { DAILY_GOAL_CATEGORIES as C } from '../../../lib/leads.js';
import { formatHourLabel } from '../../../lib/format.js';
import { OutcomePopover } from '../OutcomePopover.jsx';

// A Agenda de hoje da Meta nova (mockup B): todas as visitas e aulas do dia na
// academia, numa lista curta com a hora, um ponto do estado, quem é e o que
// falta. As linhas chegam prontas de computeDayAgenda e quem grava é o
// markAgendaPresence da Meta, o mesmo do card da tela de hoje.
//
// O ponto: verde compareceu, vermelho faltou, âmbar passou da hora sem
// desfecho, azul o próximo e cinza o resto. À direita:
// - com desfecho, a etiqueta ("Compareceu" ou "Não veio"), que abre o balão
//   para trocar ou desfazer, como no card de hoje;
// - a sua que passou da hora, os botões de Compareceu e Não compareceu;
// - a de um colega que passou da hora, "Sem desfecho", que abre o mesmo balão:
//   a agenda é de todos, e quem está na recepção confirma por quem não está.
// O que ainda vai acontecer não mostra ação: a sua se marca pelo Agora.

const DOT = {
  ok: 'bg-emerald-500',
  bad: 'bg-rose-500',
  pend: 'bg-amber-500',
  next: 'bg-brand-600 dark:bg-brand-400',
  later: 'bg-slate-300 dark:bg-white/20',
};

const MARK = 'grid size-[30px] place-items-center rounded-[9px] border border-border bg-card text-slate-600 transition outline-none focus-visible:anel-foco disabled:opacity-60 dark:text-slate-300';

function stateOf(row, now, next) {
  if (row.outcome === 'attended') return 'ok';
  if (row.outcome === 'no_show') return 'bad';
  if (row.scheduledAt < now) return 'pend';
  return row === next ? 'next' : 'later';
}

export function AgendaHoje({ rows, now, savingId, onMark }) {
  if (!rows || rows.length === 0) return null;
  const next = rows.find((r) => !r.outcome && r.scheduledAt >= now) || null;

  return (
    <section aria-labelledby="meta-agenda-titulo" className="rounded-2xl border border-border bg-card px-[18px] py-4 shadow-card">
      <div className="mb-2 flex items-baseline justify-between gap-2.5">
        <h3 id="meta-agenda-titulo" className="font-display text-[14px] font-bold tracking-[-0.01em]">Agenda de hoje</h3>
        <small className="text-[12px] text-muted-foreground">Visitas e aulas da academia</small>
      </div>
      <ul className="max-h-[340px] overflow-y-auto overscroll-y-contain thin-scroll">
        {rows.map((row) => {
          const estado = stateOf(row, now, next);
          const tipo = row.categorySlug === C.VISITA_HOJE ? 'Visita' : 'Aula exp.';
          const title = `${tipo} de ${row.name || 'sem nome'} · ${formatHourLabel(row.scheduledAt)}`;
          const saving = savingId === row.id;
          let acao = null;
          if (row.outcome || (estado === 'pend' && !row.isMine)) {
            acao = <OutcomePopover tag outcome={row.outcome} canUndo saving={saving} title={title} onPick={(c) => onMark(row, c)} />;
          } else if (estado === 'pend') {
            acao = (
              <span className="flex gap-1">
                <button type="button" disabled={saving} aria-label={`Compareceu: ${row.name || 'sem nome'}`} title="Compareceu" onClick={() => onMark(row, 'attended')} className={cn(MARK, 'hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300')}>
                  <Check size={14} aria-hidden="true" />
                </button>
                <button type="button" disabled={saving} aria-label={`Não compareceu: ${row.name || 'sem nome'}`} title="Não compareceu" onClick={() => onMark(row, 'no_show')} className={cn(MARK, 'hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-300')}>
                  <X size={14} aria-hidden="true" />
                </button>
              </span>
            );
          }
          return (
            <li key={row.id} data-estado={estado} className="grid grid-cols-[38px_10px_minmax(0,1fr)_auto] items-start gap-2 py-[7px]">
              <span className={cn('num pt-px text-[12px]', estado === 'next' ? 'font-bold text-brand-700 dark:text-brand-300' : 'text-muted-foreground')}>
                {formatHourLabel(row.scheduledAt)}
              </span>
              <span aria-hidden="true" className={cn('mt-1.5 size-2 rounded-full', DOT[estado])} />
              <div className="min-w-0">
                <b className="flex items-center gap-1.5 text-[13px] font-semibold leading-[1.3]">
                  <span className="truncate">{row.name || 'Sem nome'}</span>
                  {row.isClient && <span className="flex-none rounded bg-slate-100 px-1 text-[10px] font-normal text-muted-foreground dark:bg-white/[0.08]">cliente</span>}
                </b>
                <small className="block truncate text-[11.5px] leading-[1.3] text-muted-foreground">{agendaSubtitle(row)}</small>
              </div>
              {acao}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
