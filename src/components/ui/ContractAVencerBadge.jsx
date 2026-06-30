import { AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils.js';

// "A vencer" é um SUB-ESTADO de ATIVO (contrato segue ativo, só perto do fim).
// Pra não confundir, o badge mostra as duas tags juntas num pill dividido:
// metade verde (Ativo) + metade amarela (A vencer).
// variant: 'pill' (rounded-full, ficha) | 'tag' (rounded-md, listas).
export function ContractAVencerBadge({ variant = 'pill', className }) {
  const radius = variant === 'tag' ? 'rounded-md' : 'rounded-full';
  const sizing = variant === 'tag' ? 'text-[11px] h-6' : 'text-[12px] h-[26px]';
  return (
    <span className={cn('inline-flex items-center overflow-hidden font-semibold whitespace-nowrap align-middle', radius, sizing, className)}>
      <span className="inline-flex items-center gap-1 h-full px-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Ativo
      </span>
      <span className="inline-flex items-center gap-1 h-full px-2 bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
        <AlertTriangle size={11} />A vencer
      </span>
    </span>
  );
}
