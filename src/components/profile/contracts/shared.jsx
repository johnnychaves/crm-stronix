// Componentes pequenos que a aba Contratos divide entre o card, a faixa do
// próximo e a tabela do Histórico.
import { GraduationCap, LogIn, RefreshCw, TrendingUp } from 'lucide-react';
import { CONTRACT_STATUS, CONTRACT_STATUS_LABEL } from '../../../lib/contracts.js';
import { CONTRACT_ORIGIN, HISTORY_STATUS_LABEL } from '../../../lib/contractHistory.js';
import { cn } from '../../../lib/utils.js';
import { CONTRACT_TONE } from './tone.js';

// Rótulo de dado, em minúsculas. Sempre no tom `muted`: 12,5 px passa contraste
// sobre o card e sobre o cinza da tabela, e é o que faz a faixa ler como colunas.
export const FieldLabel = ({ children }) => (
  <div className="text-[12.5px] font-medium text-muted-foreground whitespace-nowrap">
    {children}
  </div>
);

// Selo de situação, em pílula: o status do contrato ou o selo do Histórico (Em
// uso, Renovado), no tom da situação.
export function StatusChip({ status, className }) {
  const tone = CONTRACT_TONE[status] || CONTRACT_TONE[CONTRACT_STATUS.VENCIDO];
  return (
    <span className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold whitespace-nowrap', tone.block, tone.fg, className)}>
      {CONTRACT_STATUS_LABEL[status] || HISTORY_STATUS_LABEL[status]}
    </span>
  );
}

// Ícone da origem do contrato.
export function OriginIcon({ kind, size = 14 }) {
  if (kind === CONTRACT_ORIGIN.RETORNO) return <LogIn size={size} aria-hidden="true" />;
  if (kind === CONTRACT_ORIGIN.UPGRADE) return <TrendingUp size={size} aria-hidden="true" />;
  if (kind === CONTRACT_ORIGIN.RENOVACAO) return <RefreshCw size={size} aria-hidden="true" />;
  return <GraduationCap size={size} aria-hidden="true" />;
}
