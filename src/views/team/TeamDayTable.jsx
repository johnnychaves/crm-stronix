import { ChevronDown } from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { ConsultantDayDetail } from './ConsultantDayDetail.jsx';
import { cn } from '../../lib/utils.js';

// Cartão 2 do handoff. A coluna Situação é a que o olho procura, por isso ela
// carrega a cor. Em dia PASSADO a tela degrada e anuncia: o sistema guarda o
// resultado, não as tarefas que existiam naquele dia.
function TeamDayTable({ board, openId, onToggle, slaOverdueDays, appUser }) {
  const { sel, rows } = board;

  return (
    <section className="rounded-[20px] border border-border bg-card shadow-card overflow-hidden">
      <header className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <h3 className="font-display text-[15px] font-bold tracking-tight">Resultados do dia {sel.dayNum}</h3>
        {sel.isToday && (
          <span className="text-[9.5px] font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            Hoje
          </span>
        )}
      </header>

      <ul>
        {rows.map((r) => {
          const aberto = openId === r.user.id;
          const situacao = r.isPast
            ? null
            : r.metaOk
              ? { text: 'meta batida', cls: 'text-emerald-700 dark:text-emerald-400' }
              : r.critCount > 0
                ? { text: `${r.critCount} ${r.critCount === 1 ? 'crítica' : 'críticas'}`, cls: 'text-rose-700 dark:text-rose-300' }
                : { text: `${r.pendCount} ${r.pendCount === 1 ? 'pendente' : 'pendentes'}`, cls: 'text-slate-600 dark:text-slate-300' };
          const barTone = r.metaOk ? 'bg-success' : r.critCount > 0 ? 'bg-danger' : 'bg-brand-200 dark:bg-brand-500/50';

          return (
            <li key={r.user.id} className="border-t border-slate-100 dark:border-white/[0.05] first:border-0">
              <button
                type="button"
                disabled={r.isPast}
                onClick={() => onToggle(aberto ? null : r.user.id)}
                className={cn(
                  'w-full flex items-center gap-4 px-5 py-3 text-left transition',
                  !r.isPast && 'hover:bg-slate-50/70 dark:hover:bg-white/[0.02]',
                  r.perfect && 'bg-emerald-50/50 dark:bg-emerald-500/[0.05]'
                )}
              >
                <div className="shrink-0 w-[186px] flex items-center gap-2.5 min-w-0">
                  <Avatar name={r.user.name} size={30} />
                  <span className="text-[12.5px] font-semibold truncate">
                    {(r.user.name || '').split(' ')[0]}{r.user.id === appUser?.id ? ' (você)' : ''}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  {r.isPast ? (
                    <span className={cn(
                      'text-[12px] font-semibold',
                      r.hitMeta ? 'text-emerald-700 dark:text-emerald-400' : sel.isMetaDay ? 'text-slate-500' : 'text-slate-300 dark:text-slate-600'
                    )}>
                      {r.hitMeta ? 'bateu' : sel.isMetaDay ? 'não bateu' : 'folga'}
                    </span>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <span className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden max-w-[160px]">
                        <span className={cn('block h-full rounded-full', barTone)} style={{ width: `${r.progress}%` }} />
                      </span>
                      <span className="text-[11.5px] num text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {r.doneSlots}/{r.totalSlots} tarefas
                      </span>
                    </div>
                  )}
                </div>

                <div className="shrink-0 w-[120px] text-right">
                  {situacao && <span className={cn('text-[12px] font-semibold', situacao.cls)}>{situacao.text}</span>}
                </div>

                <div className="shrink-0 w-[130px] text-right">
                  <span className={cn(
                    'text-[12px] font-semibold num',
                    !r.hasCota
                      ? 'text-slate-400 dark:text-slate-500'
                      : r.prospHit ? 'text-emerald-700 dark:text-emerald-400' : 'text-accent-600 dark:text-accent-400'
                  )}>
                    {r.hasCota
                      ? (r.isPast ? `${r.prospDone} ${r.prospDone === 1 ? 'ação' : 'ações'}` : `${r.prospDone}/${r.cota}`)
                      : 'sem cota'}
                  </span>
                </div>

                <span className="shrink-0 w-5 grid place-items-center">
                  {!r.isPast && (
                    <ChevronDown size={16} className={cn('text-slate-400 transition-transform duration-150', aberto && 'rotate-180')} />
                  )}
                </span>
              </button>

              {aberto && !r.isPast && <ConsultantDayDetail row={r} slaOverdueDays={slaOverdueDays} />}
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="px-5 py-14 text-center text-[13px] text-slate-400">Nenhum usuário na equipe ainda.</li>
        )}
      </ul>
    </section>
  );
}

export { TeamDayTable };
