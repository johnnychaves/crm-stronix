// Saídas do mês (handoff do Gerencial, linhas 358 a 384): cancelamentos e
// trancamentos, com o valor por mês que cada um leva embora.
//
// As duas saídas não são a mesma coisa e a nota do pé diz isso: trancamento é
// reversível e continua contando na carteira, cancelamento sai. A cor separa os
// dois, mas rótulo, contagem e valor ficam escritos em todas as linhas.
//
// O total sai da soma das saídas recebidas, nunca por prop (README §8).
//
// Props:
//   items  [{ kind, label, count, v }] — kind 'cancelamento' ou 'trancamento'
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { ChartMark } from './ChartMark.jsx';
import { fmtMoney } from './dashTokens.js';

const CARD = 'rounded-2xl border border-border bg-card shadow-card';
const RULE = 'border-slate-100 dark:border-white/[0.06]';
const TONES = {
  cancelamento: { text: 'text-rose-700 dark:text-rose-300', fill: 'bg-danger dark:bg-[#E11D48]' },
  trancamento: { text: 'text-amber-700 dark:text-amber-300', fill: 'bg-amber-500' }
};

const plural = (n, one, many) => `${fmtNum(n)} ${n === 1 ? one : many}`;

export function ExitsCard({ items }) {
  const list = items || [];
  const total = list.reduce((s, e) => s + (Number(e.v) || 0), 0);
  const max = Math.max(1, ...list.map((e) => Number(e.v) || 0));

  return (
    <section className={cn(CARD, 'px-[18px] py-4')}>
      <div className="flex items-baseline gap-2.5">
        <span className="text-[13.5px] font-semibold">Saiu neste mês</span>
        <div className="flex-1" />
        <span className="num flex-none text-[12px] text-muted-foreground">{`${fmtMoney(total)}/mês`}</span>
      </div>

      <div className="mt-3.5 flex flex-col gap-2.5">
        {list.map((e) => {
          const tone = TONES[e.kind] || TONES.trancamento;
          return (
            <div key={e.kind || e.label}>
              <div className="flex items-baseline gap-[9px]">
                <span className="text-[12.5px] font-semibold">{e.label}</span>
                <span className="num text-[11.5px] text-muted-foreground">{plural(e.count, 'contrato', 'contratos')}</span>
                <div className="flex-1" />
                <span className={cn('num font-display text-[13.5px] font-bold', tone.text)}>{fmtMoney(e.v)}</span>
                <span className="num text-[11px] text-muted-foreground">/mês</span>
              </div>
              <div className="mt-[5px] flex h-3 overflow-hidden rounded bg-muted">
                <ChartMark
                  tip={`${e.label}: ${plural(e.count, 'contrato', 'contratos')}, ${fmtMoney(e.v)} por mês`}
                  className={cn('block h-full rounded', tone.fill)}
                  style={{ width: `${Math.max(Math.round(((Number(e.v) || 0) / max) * 100), 4)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className={cn('mt-3 border-t pt-2.5 text-[11px] leading-[1.5] text-muted-foreground', RULE)}>
        Trancamento é reversível e continua contando na carteira. Cancelamento sai.
      </div>
    </section>
  );
}
