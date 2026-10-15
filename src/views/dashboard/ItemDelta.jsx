// Variação de uma linha ou fatia contra o mês comparado (tipo de venda,
// consultor, plano, origem, saída). A conta é do viewModel (`pctDelta`); aqui é
// só o desenho: seta, porcentagem e a base na dica.
//
// A cor diz se a mudança é boa ou ruim, não se subiu ou desceu: saída que
// cresce é ruim, venda que cresce é boa. "novo" e "igual" ficam neutros.
import { cn } from '../../lib/utils.js';

const TONES = {
  good: 'text-emerald-700 dark:text-emerald-300',
  bad: 'text-rose-700 dark:text-rose-300',
  quiet: 'text-muted-foreground'
};

export function ItemDelta({ delta, className }) {
  if (!delta) return null;
  const arrow = delta.tone === 'quiet' ? '' : delta.up ? '▲ ' : '▼ ';
  return (
    <span
      title={delta.baseline}
      className={cn('num flex-none whitespace-nowrap text-[11px] font-semibold', TONES[delta.tone] || TONES.quiet, className)}
    >
      {`${arrow}${delta.text}`}
    </span>
  );
}
