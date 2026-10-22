import { BookOpen, Building2, MessageCircle, Phone } from 'lucide-react';
import { getTone } from '../../lib/leadState.js';
import { cn } from '../../lib/utils.js';
import { OutcomePopover } from '../dailygoal/OutcomePopover.jsx';

// O que está marcado para a pessoa, no topo do registro. Os itens vêm de
// upNextOf (lib/upNext.js), que lê os campos do lead. A cor e o ícone seguem o
// tipo, como na lista de Próximos agendamentos que existia na aba CRM.
// As ações são opcionais: sem a função, o botão não existe.
//   onReschedule(item)       Remarcar: a ficha abre o Agendar no tipo do item.
//   onOutcome(item, choice)  Marcar desfecho ('attended' ou 'no_show'), só no
//                            item com canOutcome (só o de hoje) e quando a
//                            prop canOutcome, a permissão de mudar fase, deixa.
const KIND = {
  class: { tone: 'teal', Icon: BookOpen },
  visit: { tone: 'violet', Icon: Building2 },
  call: { tone: 'amber', Icon: Phone },
  msg: { tone: 'emerald', Icon: MessageCircle },
};
const dm = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const hm = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const weekday = (d) => d.toLocaleDateString('pt-BR', { weekday: 'long' });

export function UpNextList({ items, canOutcome = false, savingId = null, onReschedule = null, onOutcome = null }) {
  if (!items || items.length === 0) return null;
  return (
    <section aria-label="A seguir" className="px-8 pb-1 pt-4">
      <header className="flex items-center gap-2 py-2">
        <h4 className="text-[13px] font-semibold">A seguir</h4>
        <span className="num text-[12.5px] text-muted-foreground">{items.length === 1 ? '1 agendado' : `${items.length} agendados`}</span>
        <div className="h-px flex-1 bg-border" />
      </header>
      <ul className="flex flex-col gap-2 pb-3">
        {items.map((item) => {
          const k = KIND[item.kind] || KIND.msg;
          const tone = getTone(k.tone);
          const { Icon } = k;
          const showOutcome = Boolean(canOutcome && item.canOutcome && onOutcome);
          return (
            <li key={item.id} className="flex items-center gap-3.5 rounded-xl border border-dashed border-border px-3.5 py-2.5">
              <div className="w-12 flex-none text-center">
                <div className="num text-[13px] font-semibold leading-tight">{dm(item.when)}</div>
                <div className="num text-[12px] text-muted-foreground">{hm(item.when)}</div>
              </div>
              <span className={cn('grid size-9 flex-none place-items-center rounded-lg', tone.soft, tone.text, tone.darkSoft, tone.darkText)}>
                <Icon size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-semibold">{item.title}</span>
                  {item.overdue && (
                    <span className="inline-flex h-5 items-center rounded-full bg-amber-500/12 px-2 text-[11.5px] font-semibold text-amber-700 dark:text-amber-300">
                      Atrasado
                    </span>
                  )}
                </div>
                <div className="line-clamp-2 text-[12.5px] text-muted-foreground" title={item.detail || undefined}>
                  {[weekday(item.when), item.detail].filter(Boolean).join(' · ')}
                </div>
              </div>
              {(onReschedule || showOutcome) && (
                <div className="flex flex-none items-center gap-1.5">
                  {onReschedule && (
                    <button
                      type="button"
                      aria-label={`Remarcar: ${item.title}`}
                      onClick={() => onReschedule(item)}
                      className="inline-flex h-7 items-center rounded-lg px-2.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:anel-foco dark:text-slate-200 dark:hover:bg-white/[0.06]"
                    >
                      Remarcar
                    </button>
                  )}
                  {showOutcome && (
                    <OutcomePopover
                      title={item.title}
                      size="sm"
                      saving={savingId === item.id}
                      onPick={(choice) => onOutcome(item, choice)}
                    />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
