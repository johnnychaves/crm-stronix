// Faixa da carteira (handoff do Gerencial, linhas 247 a 285): quatro células
// baixas com o que os contratos vigentes geram por mês, e as notas tracejadas
// logo abaixo. É contexto, não alarme, por isso nada aqui tem número grande.
//
// A unidade das células é por mês, e o sufixo "/mês" fica em elemento irmão do
// número para não se soltar dele (README §1). A dica de cada célula é a do §6,
// e o rótulo da própria célula vira o aria-label do "?".
//
// Props:
//   items  [{ key, label, value, money, unit, sub, help, tone }] — value é
//          número; money manda formatar em real; tone 'amber' é o trancado
//   notes  frases prontas do texts.js (sobreposição, importados)
import { Info } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { DashHelpTip } from './DashPrimitives.jsx';
import { fmtMoney } from './dashTokens.js';

const CARD = 'rounded-2xl border border-border bg-card shadow-card';
const RULE = 'border-slate-100 dark:border-white/[0.06]';

export function WalletBand({ items, notes }) {
  const cells = items || [];
  const lines = notes || [];
  return (
    <>
      <div className={cn(CARD, 'flex flex-col overflow-hidden sm:flex-row sm:items-stretch')}>
        {cells.map((c, i) => (
          <div
            key={c.key || c.label}
            className={cn('min-w-0 flex-1 px-5 py-[17px]', i > 0 && cn('border-t sm:border-l sm:border-t-0', RULE))}
          >
            <div className="flex items-center gap-[5px]">
              <span className="truncate text-[12px] font-medium text-muted-foreground">{c.label}</span>
              {c.help && <DashHelpTip text={c.help} label={`O que é "${c.label}"?`} />}
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className={cn('num text-[28px] font-semibold leading-none tracking-[-0.025em]', c.tone === 'amber' && 'text-amber-700 dark:text-amber-300')}>
                {c.money ? fmtMoney(c.value) : fmtNum(c.value)}
              </span>
              {c.unit && <span className="num text-[13px] font-semibold text-muted-foreground">{c.unit}</span>}
            </div>
            <div className="num mt-[5px] truncate text-[11.5px] text-muted-foreground">{c.sub}</div>
          </div>
        ))}
      </div>

      {lines.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2.5">
          {lines.map((text) => (
            <div key={text} className="flex min-w-[280px] flex-1 items-start gap-2.5 rounded-[14px] border border-dashed border-border bg-muted/50 px-3.5 py-[11px]">
              <Info size={14} strokeWidth={2} className="mt-0.5 flex-none text-slate-400 dark:text-slate-500" />
              <span className="min-w-0 flex-1 text-pretty text-[11.5px] leading-[1.5] text-foreground/80">{text}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
