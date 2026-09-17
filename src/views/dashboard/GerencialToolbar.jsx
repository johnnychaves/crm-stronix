// Barra fixa do Gerencial: mês de competência, comparativo e o aviso de que
// todo número da tela é contrato vendido, não dinheiro recebido (handoff §1).
// O aviso mora aqui, e não em nota de rodapé, porque o número grande desta
// tela é dinheiro e a ressalva precisa ser lida no mesmo movimento do olho.
//
// Não tem filtro de pessoa, porque "quem traz receita" já abre por consultor,
// nem seletor de academia: no protótipo ele servia só para demonstrar as três
// bases, e em produção cada academia entra pelo próprio login.
import { CircleAlert, SlidersHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover.jsx';
import { MonthControl, CompareControl } from './OperacionalToolbar.jsx';

export const CASH_WARNING = 'Valor de contrato vendido, não caixa recebido';
export const NO_COMPARE = 'Não há mês anterior com venda para comparar';

function CashChip() {
  return (
    <span
      role="note"
      className="flex h-[30px] flex-none items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 text-[11.5px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
    >
      <CircleAlert size={13} strokeWidth={2.2} className="flex-none" />
      <span className="truncate">{CASH_WARNING}</span>
    </span>
  );
}

// Sem mês anterior com venda, o controle inteiro sai e a frase toma o lugar
// (handoff §5): oferecer comparação com um mês que não existe é pior que não
// oferecer nada.
export function GerencialToolbar(props) {
  const { canCompare = true } = props;
  return (
    <div className="sticky -top-4 md:-top-8 z-30 flex flex-col gap-2 border-t border-b border-t-slate-100 border-b-border bg-card px-4 md:px-8 py-2.5 md:flex-row md:items-center md:gap-2.5 dark:border-t-white/[0.06] dark:bg-[#0D1226]">
      <div className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1 md:hidden">
          <MonthControl {...props} compact />
        </div>
        <div className="hidden md:block">
          <MonthControl {...props} />
        </div>

        {canCompare ? (
          <>
            <div className="hidden md:block">
              <CompareControl {...props} />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Comparação"
                  className={cn(
                    'grid h-10 w-11 flex-none place-items-center rounded-xl border md:hidden',
                    props.compareOn
                      ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                      : 'border-border bg-card text-muted-foreground'
                  )}
                >
                  <SlidersHorizontal size={17} strokeWidth={2} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto">
                <CompareControl {...props} />
              </PopoverContent>
            </Popover>
          </>
        ) : (
          <span className="hidden text-[12px] text-muted-foreground md:block">{NO_COMPARE}</span>
        )}
      </div>

      <div className="hidden flex-1 md:block" />
      <CashChip />
    </div>
  );
}
