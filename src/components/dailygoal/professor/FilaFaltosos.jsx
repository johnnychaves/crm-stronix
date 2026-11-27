import { Avatar } from '../../ui/Avatar.jsx';
import { cn } from '../../../lib/utils.js';
import { fraseDe } from '../../../lib/faltosos/metaProfessor.js';

export function FilaFaltosos({ itens, leadsById, hojeDia, onPick, voltouId }) {
  if (!itens.length) return null;
  return (
    <section aria-label="Depois" className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-baseline justify-between px-[22px] pt-4 pb-2.5">
        <h3 className="font-display text-[15px] font-bold">Depois</h3>
        <span className="num text-[12.5px] text-muted-foreground">{itens.length}</span>
      </div>
      {itens.map((d) => {
        const lead = leadsById.get(d.id);
        const f = fraseDe(d, hojeDia);
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => onPick(d.id)}
            className={cn('grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3.5 border-t border-border px-[22px] py-[11px] text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:anel-foco focus-visible:ring-inset', d.id === voltouId && 'meta-voltou')}
          >
            <Avatar name={lead?.name || ''} size={30} photoUrl={lead?.photoUrl} />
            <span className="min-w-0">
              <b className="block truncate text-[14px] font-semibold">{lead?.name || 'Aluno'}</b>
              <span className={cn('text-[12.5px]', d.urgente ? 'font-semibold text-rose-700 dark:text-rose-300' : 'text-muted-foreground')}>
                Não vem há <span className="num">{f.dias} dias</span>{f.termina && <>, contrato termina em <span className="num">{f.termina}</span></>}
              </span>
            </span>
          </button>
        );
      })}
    </section>
  );
}
