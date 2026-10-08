import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.jsx';
import { Button } from './ui/button.jsx';
import { cn } from '../lib/utils.js';
import { toDateInputValue } from '../lib/dates.js';

// Balão "Novo" de uma tela nova. Fica no canto da tela até o dia `until`
// (AAAA-MM-DD, inclusive, no dia do aparelho) e, no clique, abre um pop-up que
// explica a tela. Substitui o pop-up de novidade que abria sozinho: aqui quem
// quer saber clica, e o sino continua com o histórico das novidades.
// Data fora do formato não mostra o balão, para ele nunca ficar para sempre.
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function NewFeatureBadge({ until, now = new Date(), title, description, children, className }) {
  if (typeof until !== 'string' || !DAY_RE.test(until)) return null;
  if (toDateInputValue(now) > until) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Novo: o que é esta tela"
          className={cn(
            'relative inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5',
            'border-accent-500/30 bg-accent-500/10 text-orange-700 dark:text-accent-400',
            'text-[10.5px] font-semibold uppercase leading-none tracking-wider',
            'transition-colors hover:bg-accent-500/20',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            // Área de toque maior que o desenho, para o dedo no celular.
            'after:absolute after:-inset-2',
            className,
          )}
        >
          <span aria-hidden="true" className="size-1.5 rounded-full bg-accent-500 ring-[3px] ring-accent-500/20" />
          Novo
        </button>
      </DialogTrigger>
      {/* border-border: o `border` do DialogContent sozinho pega a cor do texto e fica branco no escuro. */}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border-border sm:max-w-[480px]">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-[20px] tracking-tight">{title}</DialogTitle>
          {description && <DialogDescription className="text-[13.5px] leading-relaxed">{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <DialogFooter>
          <DialogClose asChild>
            <Button>Entendi</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { NewFeatureBadge };
