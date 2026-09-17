// Ranking de quem vendeu (handoff do Gerencial, linhas 410 a 462): uma linha
// por consultor, ordenada pelo vendido no mês.
//
// A tabela tem DUAS colunas de ticket de propósito. O total premia quem atende
// mais; o ticket por venda mostra quem fecha contrato maior e o ticket mensal
// mostra quem vende plano longo. A leitura do rodapé repete a diferença em
// texto, para a conclusão não depender de ler a coluna (README §1).
//
// A participação de cada pessoa sai do vendido das próprias linhas, que somam o
// mês inteiro: nada de porcentagem pronta por prop (README §8).
//
// No celular a coluna de ticket mensal desce para a linha de apoio, e a barra
// fica só na tabela larga, para não repetir parada de teclado.
//
// Props:
//   rows  [{ id, name, role, count, value, perSale, monthly }] — já ordenadas
//   read  a leitura do rodapé
import { Info } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { ChartMark } from './ChartMark.jsx';
import { dashInitials, fmtMoney, fmtMoneyShort } from './dashTokens.js';

const CARD = 'rounded-2xl border border-border bg-card shadow-card';
const RULE = 'border-slate-100 dark:border-white/[0.06]';
const GRID = 'grid grid-cols-[214px_minmax(0,1fr)_76px_104px_104px] items-center gap-3.5';
const HEAD = 'text-[9.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground';
const AVATAR = 'num grid size-[30px] flex-none place-items-center rounded-full bg-brand-50 text-[10.5px] font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300';

const plural = (n, one, many) => `${fmtNum(n)} ${n === 1 ? one : many}`;

export function SellerRankTable({ rows, read }) {
  const total = (rows || []).reduce((s, r) => s + (Number(r.value) || 0), 0);
  const max = Math.max(1, ...(rows || []).map((r) => Number(r.value) || 0));
  const list = (rows || []).map((r, i) => ({
    ...r,
    rank: i + 1,
    share: total > 0 ? Math.round(((Number(r.value) || 0) / total) * 100) : 0,
    width: `${Math.max(Math.round(((Number(r.value) || 0) / max) * 100), 3)}%`
  }));
  const tipOf = (r) => `${r.name}: ${fmtMoney(r.value)} em ${plural(r.count, 'venda', 'vendas')} · ${r.share}% do vendido no mês`;

  return (
    <section className={cn(CARD, 'overflow-hidden')}>
      <div className="flex items-center gap-2.5 px-5 pb-3 pt-3.5">
        <h4 className="m-0 text-[14px] font-semibold">Quem vendeu</h4>
        <div className="flex-1" />
        <span className="hidden whitespace-nowrap text-[11.5px] text-muted-foreground sm:block">o consultor dono do lead na hora da venda</span>
      </div>

      <div className={cn(GRID, 'hidden px-5 pb-2 md:grid', HEAD)}>
        <span>Consultor</span>
        <span>Vendido no mês</span>
        <span className="text-right">Vendas</span>
        <span className="text-right">Ticket da venda</span>
        <span className="text-right">Ticket mensal</span>
      </div>

      {list.map((r, i) => (
        <div key={r.id || r.name} className={cn(GRID, 'hidden border-t px-5 py-[11px] md:grid', RULE)}>
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="num w-[18px] flex-none text-[11px] font-bold text-slate-400 dark:text-slate-500">{r.rank}</span>
            <span className={AVATAR}>{dashInitials(r.name)}</span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold">{r.name}</div>
              <div className="truncate text-[10.5px] text-slate-400 dark:text-slate-500">{r.role}</div>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-[11px]">
            <span className="flex h-4 min-w-0 flex-1 overflow-hidden rounded bg-muted">
              <ChartMark
                tip={tipOf(r)}
                className={cn('block h-full rounded', i === 0 ? 'bg-brand-600' : 'bg-brand-200 dark:bg-brand-500/40')}
                style={{ width: r.width }}
              />
            </span>
            <span className="num w-[82px] flex-none text-right font-display text-[15px] font-bold tracking-[-0.02em]">{fmtMoneyShort(r.value)}</span>
            <span className="num w-[42px] flex-none text-right text-[11.5px] text-muted-foreground">{`${r.share}%`}</span>
          </div>
          <span className="num text-right text-[13px] font-semibold">{fmtNum(r.count)}</span>
          <span className="num text-right text-[13px] font-semibold">{fmtMoney(r.perSale)}</span>
          <span className={cn('num text-right text-[13px] font-semibold', i > 0 && 'text-foreground/80')}>{`${fmtMoney(r.monthly)}/mês`}</span>
        </div>
      ))}

      {list.map((r) => (
        <div key={r.id || r.name} className={cn('flex items-center gap-2.5 border-t px-[18px] py-2.5 md:hidden', RULE)}>
          <span className={AVATAR}>{dashInitials(r.name)}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-semibold">{r.name}</div>
            <div className="num truncate text-[10.5px] text-muted-foreground">
              {`${plural(r.count, 'venda', 'vendas')} · ${fmtMoney(r.perSale)} por venda · ${fmtMoney(r.monthly)}/mês`}
            </div>
          </div>
          <div className="flex-none text-right">
            <div className="num font-display text-[14px] font-bold">{fmtMoneyShort(r.value)}</div>
            <div className="num text-[10.5px] text-muted-foreground">{`${r.share}%`}</div>
          </div>
        </div>
      ))}

      {read && (
        <div className="flex items-start gap-[9px] border-t border-border bg-muted/50 px-5 py-[13px]">
          <Info size={14} strokeWidth={2} className="mt-0.5 flex-none text-slate-400 dark:text-slate-500" />
          <span className="min-w-0 flex-1 text-pretty text-[11.5px] leading-[1.5] text-foreground/80">{read}</span>
        </div>
      )}
    </section>
  );
}
