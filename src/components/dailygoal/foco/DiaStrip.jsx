import { Flame, Zap } from 'lucide-react';
import { cn } from '../../../lib/utils.js';
import { formatHourLabel } from '../../../lib/format.js';
import { volumeBreakdownLabel } from '../../../lib/dailyGoal.js';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover.jsx';

// A faixa fixa do topo da Meta nova (mockup B): a saudação com o dia e o
// frescor dos dados, a prospecção do dia, a sequência e, no canto direito, a
// porcentagem do dia. O progresso aparece uma vez só, aqui.
//
// Fica fixa como a barra dos painéis (FilterBar): o top negativo desconta o
// preenchimento da área que rola (p-4 md:p-8), e o fundo da página por trás
// cobre o que passa por baixo. Com top positivo, ela parava 44 px abaixo da
// borda e o conteúdo aparecia rolando por cima dela.
//
// Frescor: com as leituras ligadas, "Ao vivo". Com a pausa por inatividade, o
// instante parado e o pedido de mexer na tela, como na aba Hoje das Rotinas.

function Bar({ value, max, className, label }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <i className={cn('block h-full rounded-full transition-[width] duration-500', className)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function DiaStrip({ greeting, firstName, todayLabel, live, now, frozenDay, totalSlots, doneSlots, progress, volume, streak }) {
  return (
    <div className="sticky -top-4 z-30 -mx-4 -mt-4 bg-page px-4 pb-3 pt-4 md:-top-8 md:-mx-8 md:-mt-8 md:px-8 md:pt-5">
      <header className="flex items-center gap-[22px] rounded-[18px] border border-border bg-card px-6 py-3.5 shadow-card max-[900px]:flex-wrap">
        <div className="min-w-0">
          <h1 className="font-display text-[21px] font-bold leading-tight tracking-[-0.02em] whitespace-nowrap">{greeting}, {firstName}</h1>
          <p className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted-foreground">
            <span className="first-letter:uppercase">{todayLabel}</span>
            <span className="inline-flex items-center gap-1.5" data-relogio={live ? 'ao-vivo' : 'parado'}>
              <span aria-hidden="true" className={cn('size-[7px] rounded-full', live ? 'bg-emerald-600 ring-[3px] ring-emerald-600/15 dark:bg-emerald-400' : 'bg-muted-foreground/50')} />
              {live
                ? 'Ao vivo'
                : <span>Atualizado{frozenDay && ` ${frozenDay}`} às <span className="num">{formatHourLabel(now)}</span>. Mexa na tela para atualizar</span>}
            </span>
          </p>
        </div>

        {volume.target > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="min-w-[150px] rounded-lg text-left outline-none focus-visible:anel-foco">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap">
                  <Zap size={14} className="text-accent-500" aria-hidden="true" />
                  <span className="num">{volume.count} de {volume.target}</span> ações de prospecção
                </span>
                <span className="mt-2 block"><Bar value={volume.count} max={volume.target} className="bg-accent-500" label="Prospecção do dia" /></span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[300px] text-[13px] leading-snug">
              <p className="font-semibold"><span className="num">{volume.count} de {volume.target}</span> ações de prospecção hoje</p>
              <p className="mt-0.5 text-muted-foreground">{volumeBreakdownLabel(volume.breakdown)}</p>
              <p className="mt-3"><b className="font-semibold">Conta:</b> agendamento criado (visita, aula, mensagem ou ligação) e lead novo cadastrado.</p>
              <p className="mt-1.5 text-muted-foreground"><b className="font-semibold text-foreground">Não conta:</b> concluir tarefa, anotação, adiar e mudar de fase.</p>
            </PopoverContent>
          </Popover>
        )}

        {streak > 0 && (
          <p className="flex items-center gap-1.5 text-[13px] whitespace-nowrap text-muted-foreground">
            <Flame size={16} className="text-amber-500" aria-hidden="true" />
            <b className="num font-display text-[20px] font-bold tracking-[-0.02em] text-foreground">{streak}</b>
            {streak === 1 ? 'dia seguido' : 'dias seguidos'}
          </p>
        )}

        {totalSlots > 0 && (
          <div className="ml-auto min-w-[180px] flex-[0_1_230px]">
            <div className="flex items-center gap-3">
              <b className="num font-display text-[32px] font-bold leading-none tracking-[-0.035em]">{progress}%</b>
              <span className="flex flex-col text-[12.5px] leading-tight text-muted-foreground">
                <span className="num text-[14px] font-bold text-foreground">{doneSlots} de {totalSlots}</span>
                tarefas feitas hoje
              </span>
            </div>
            <div className="mt-2"><Bar value={doneSlots} max={totalSlots} className="bg-brand-600" label="Tarefas feitas hoje" /></div>
          </div>
        )}
      </header>
    </div>
  );
}
