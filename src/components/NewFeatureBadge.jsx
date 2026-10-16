import { useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.jsx';
import { Button } from './ui/button.jsx';
import { cn } from '../lib/utils.js';
import { isNewFeatureOn } from '../lib/newFeature.js';

// Balão "Novo" de uma tela nova. Aparece até o dia `until` (AAAA-MM-DD,
// inclusive, no dia do aparelho, pela conta de `isNewFeatureOn`) e, no clique,
// abre um pop-up que explica a tela. Substitui o pop-up de novidade que abria
// sozinho: aqui quem quer saber clica, e o sino continua com o histórico das
// novidades.
//
// O pop-up padrão tem título, descrição, o corpo (children) e o Entendi. Quem
// precisa de outro desenho (a apresentação em passos das Rotinas) passa
// renderContent: ele recebe { close } e desenha o pop-up inteiro, inclusive o
// DialogTitle e o DialogDescription, que o leitor de tela usa como nome e
// descrição do pop-up. contentClassName ajusta a caixa (o padding e a
// largura). O conteúdo sai da tela quando o pop-up fecha, então quem tem
// passos reabre sempre no primeiro.

// soft: laranja suave, para o balão no meio da tela.
// alert: vermelho cheio, para chamar atenção no menu. A borda branca de dentro
// separa o vermelho do azul do item aceso, e some no menu branco; o halo
// vermelho de fora destaca no fundo claro e no escuro.
const TONES = {
  soft: {
    button: cn(
      'h-6 gap-1.5 px-2.5 text-[10.5px] font-semibold',
      'border-accent-500/30 bg-accent-500/10 text-orange-700 hover:bg-accent-500/20 dark:text-accent-400',
    ),
    dot: 'bg-accent-500 ring-[3px] ring-accent-500/20',
  },
  alert: {
    button: cn(
      'h-5 gap-1 px-2 text-[10px] font-bold',
      'border-transparent bg-red-600 text-white hover:bg-red-700',
      'shadow-[0_0_0_1.5px_rgba(255,255,255,.9),0_0_0_4px_rgba(220,38,38,.25)]',
      'dark:shadow-[0_0_0_1.5px_rgba(14,26,64,.9),0_0_0_4px_rgba(248,113,113,.35)]',
    ),
    dot: 'bg-white ring-2 ring-white/35',
  },
};

function NewFeatureBadge({ until, now = new Date(), tone = 'soft', title, description, children, renderContent, contentClassName, className }) {
  const [open, setOpen] = useState(false);
  if (!isNewFeatureOn(until, now)) return null;
  const look = TONES[tone] ?? TONES.soft;
  const close = () => setOpen(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Novo: o que é esta tela"
          className={cn(
            'relative inline-flex shrink-0 items-center rounded-full border uppercase tracking-wider transition-colors',
            look.button,
            // Depois do tamanho da letra do tom: o cn() tira o leading que vem antes dele.
            'leading-none',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            // Área de toque maior que o desenho, para o dedo no celular.
            'after:absolute after:-inset-2',
            className,
          )}
        >
          <span aria-hidden="true" className={cn('size-1.5 rounded-full', look.dot)} />
          Novo
        </button>
      </DialogTrigger>
      <DialogContent className={cn('max-h-[calc(100dvh-2rem)] overflow-y-auto border-border sm:max-w-[480px]', contentClassName)}>
        {renderContent ? renderContent({ close }) : (
          <>
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { NewFeatureBadge };
