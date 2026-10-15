// As faixas de barras da tela Gerencial (mockup A): quem vendeu, e o que vence
// e o que sai. Só apresentação: cada total e cada largura de barra sai das
// próprias linhas recebidas, nunca de número pronto.
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { HELP } from '../../lib/gerencial/texts.js';
import { Band } from './Band.jsx';
import { ChartMark } from './ChartMark.jsx';
import { ItemDelta } from './ItemDelta.jsx';
import { dashInitials, fmtMoney, fmtMoneyShort } from './dashTokens.js';

const RULE = 'border-slate-100 dark:border-white/[0.06]';
const HEAD = 'text-[12px] text-muted-foreground';
const AMBER_TEXT = 'text-amber-700 dark:text-amber-300';

const plural = (n, one, many) => `${fmtNum(n)} ${n === 1 ? one : many}`;

// Props:
//   rows  [{ id, name, role, count, value, monthly, delta }] — já ordenadas pelo vendido
export function SellersCard({ rows }) {
  const list = rows || [];
  const total = list.reduce((s, r) => s + (Number(r.value) || 0), 0);
  const max = Math.max(1, ...list.map((r) => Number(r.value) || 0));

  return (
    <Band title="Quem vendeu" help={HELP.sellers} question="O consultor dono do lead na hora da venda.">
      <div className={cn('grid grid-cols-[34px_minmax(0,1fr)_48px_72px] gap-x-3.5 pb-1.5', HEAD)}>
        <span />
        <span />
        <span className="text-right">Vendas</span>
        <span className="text-right">Ticket/mês</span>
      </div>
      <div className="flex flex-col">
        {list.map((r, i) => {
          const share = total > 0 ? Math.round(((Number(r.value) || 0) / total) * 100) : 0;
          const tip = `${r.name}${r.role ? ` (${r.role})` : ''}: ${fmtMoney(r.value)} em ${plural(r.count, 'venda', 'vendas')} · ${share}% do vendido no mês`;
          return (
            <div key={r.id || r.name} className={cn('grid grid-cols-[34px_minmax(0,1fr)_48px_72px] items-center gap-x-3.5 border-t py-[11px] first:border-t-0', RULE)}>
              <span className="num grid size-[34px] place-items-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                {dashInitials(r.name)}
              </span>
              <div className="min-w-0">
                <div className="mb-1.5 flex items-baseline gap-2.5">
                  <b className="min-w-0 flex-1 truncate font-semibold">{r.name}</b>
                  <ItemDelta delta={r.delta} />
                  <span className="num flex-none font-display font-bold">{fmtMoneyShort(r.value)}</span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                  <ChartMark
                    tip={tip}
                    className={cn('block h-full rounded-full', i === 0 ? 'bg-brand-600' : 'bg-brand-200 dark:bg-brand-500/40')}
                    style={{ width: `${Math.max(Math.round(((Number(r.value) || 0) / max) * 100), 3)}%` }}
                  />
                </div>
              </div>
              <span className="num text-right font-semibold">{fmtNum(r.count)}</span>
              <span className="num text-right font-semibold">{fmtMoney(r.monthly)}</span>
            </div>
          );
        })}
      </div>
    </Band>
  );
}

const EXIT_TONES = {
  cancelamento: { text: 'text-rose-700 dark:text-rose-300', fill: 'bg-danger dark:bg-[#E11D48]' },
  // Trancado é amarelo no app inteiro (ficha, Clientes e Gerencial).
  trancamento: { text: 'text-yellow-700 dark:text-yellow-300', fill: 'bg-yellow-500' }
};

// Uma linha de barra: rótulo, barra, contagem (com a variação, quando há) e
// valor por mês. As duas listas do card usam a mesma grade, para as barras
// começarem e terminarem juntas.
function BarLine({ label, tip, width, fill, count, delta, value, valueClass }) {
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2 sm:grid-cols-[112px_minmax(0,1fr)_132px_84px]">
      <span className="whitespace-nowrap font-semibold text-foreground/80">{label}</span>
      <span className="order-last col-span-3 flex h-3 overflow-hidden rounded-full bg-muted sm:order-none sm:col-span-1">
        <ChartMark tip={tip} className={cn('block h-full rounded-full', fill)} style={{ width }} />
      </span>
      <span className="num hidden items-center justify-end gap-1.5 text-[12px] text-muted-foreground sm:flex">
        {count}
        <ItemDelta delta={delta} />
      </span>
      <span className={cn('num text-right font-display text-[14px] font-bold', valueClass)}>{value}</span>
    </div>
  );
}

// Props:
//   horizon  [{ days, label, count, v }] — v é o valor por mês
//   exits    [{ kind, label, count, v, delta }] — 'cancelamento' ou 'trancamento'
export function ExpiryExitsCard({ horizon, exits }) {
  const hz = horizon || [];
  const ex = exits || [];
  const hzMax = Math.max(1, ...hz.map((h) => Number(h.v) || 0));
  const exMax = Math.max(1, ...ex.map((e) => Number(e.v) || 0));
  const hzCount = hz.reduce((s, h) => s + (Number(h.count) || 0), 0);
  const exTotal = ex.reduce((s, e) => s + (Number(e.v) || 0), 0);

  return (
    <Band title="O que vence e o que sai" help={HELP.expiry} question="Próximos 90 dias, e o que saiu neste mês.">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="font-semibold">Vence nos próximos 90 dias</span>
        <span className="num text-[12px] text-muted-foreground">{plural(hzCount, 'contrato', 'contratos')}</span>
      </div>
      {hz.map((h) => (
        <BarLine
          key={h.days || h.label}
          label={h.label}
          tip={`${h.label}: ${plural(h.count, 'contrato', 'contratos')} valendo ${fmtMoney(h.v)} por mês`}
          width={`${Math.max(Math.round(((Number(h.v) || 0) / hzMax) * 100), 4)}%`}
          fill="bg-amber-500"
          count={plural(h.count, 'contrato', 'contratos')}
          value={fmtMoney(h.v)}
          valueClass={AMBER_TEXT}
        />
      ))}

      <div className={cn('mb-1 mt-5 flex items-baseline justify-between gap-3 border-t pt-4', RULE)}>
        <span className="font-semibold">Saiu neste mês</span>
        <span className="num text-[12px] text-muted-foreground">{`${fmtMoney(exTotal)}/mês`}</span>
      </div>
      {ex.map((e) => {
        const tone = EXIT_TONES[e.kind] || EXIT_TONES.trancamento;
        return (
          <BarLine
            key={e.kind || e.label}
            label={e.label}
            tip={`${e.label}: ${plural(e.count, 'contrato', 'contratos')}, ${fmtMoney(e.v)} por mês`}
            width={`${Math.max(Math.round(((Number(e.v) || 0) / exMax) * 100), 4)}%`}
            fill={tone.fill}
            count={plural(e.count, 'contrato', 'contratos')}
            delta={e.delta}
            value={fmtMoney(e.v)}
            valueClass={tone.text}
          />
        );
      })}
    </Band>
  );
}
