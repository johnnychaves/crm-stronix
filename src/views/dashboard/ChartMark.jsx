// Marca de gráfico com valor: focável e com dica do shadcn no hover E no foco
// do teclado (o title nativo do handoff não dispara no foco, README §4).
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip.jsx';
import { cn } from '../../lib/utils.js';

export function ChartMark({ tip, as: Comp = 'span', className, style, children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Comp
          tabIndex={0}
          role="img"
          aria-label={tip}
          className={cn('cursor-help outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40', className)}
          style={style}
        >
          {children}
        </Comp>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 whitespace-normal text-[11.5px] leading-relaxed">{tip}</TooltipContent>
    </Tooltip>
  );
}
