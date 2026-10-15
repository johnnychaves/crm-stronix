// Os cards de barras da tela Gerencial (handoff v2, §2 L2 e L3): consultores,
// vencimentos e saídas do mês. Só apresentação: cada total e cada largura de
// barra sai das próprias linhas recebidas, nunca de número pronto.
//
// Contrato importado sem valor se distingue por FORMA, nunca por tom: trilha
// de borda tracejada, sem preenchimento, com a contagem escrita embaixo. Ele é
// gente de verdade que vence, e o dinheiro ainda vai ser preenchido.
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { HELP } from '../../lib/gerencial/texts.js';
import { ChartMark } from './ChartMark.jsx';
import { DashHelpTip } from './DashPrimitives.jsx';
import { ItemDelta } from './ItemDelta.jsx';
import { dashInitials, fmtMoney, fmtMoneyShort } from './dashTokens.js';

const CARD = 'rounded-2xl border border-border bg-card px-[22px] py-5 shadow-card';
const TITLE = 'm-0 font-display text-[15px] font-bold tracking-[-0.01em]';
const RULE = 'border-slate-100 dark:border-white/[0.06]';
const HEAD = 'text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground';
const AMBER_TEXT = 'text-amber-700 dark:text-amber-300';
// A barra sólida para em 74% para sobrar espaço à trilha tracejada.
const SOLID_MAX = 74;
const BLIND_MAX = 16;
const DASHED = 'border-[1.5px] border-dashed border-slate-400 dark:border-slate-500';

const plural = (n, one, many) => `${fmtNum(n)} ${n === 1 ? one : many}`;
const widthOf = (v, max, ceiling) => `${Math.max(Math.round(((Number(v) || 0) / max) * ceiling), 4)}%`;

// Props:
//   rows  [{ id, name, role, count, value, monthly, delta }] — já ordenadas pelo vendido
export function SellersCard({ rows }) {
  const list = rows || [];
  const total = list.reduce((s, r) => s + (Number(r.value) || 0), 0);
  const max = Math.max(1, ...list.map((r) => Number(r.value) || 0));

  return (
    <section className={CARD}>
      <div className="flex items-center gap-3.5">
        <div className="flex flex-1 items-center gap-2">
          <h3 className={TITLE}>Consultores</h3>
          <DashHelpTip text={HELP.sellers} label='O que é "Consultores"?' />
        </div>
        <span className={cn(HEAD, 'w-[60px] text-right')}>Vendas</span>
        <span className={cn(HEAD, 'w-[90px] text-right')}>Ticket/mês</span>
      </div>

      <div className="mt-2.5 flex flex-col">
        {list.map((r, i) => {
          const share = total > 0 ? Math.round(((Number(r.value) || 0) / total) * 100) : 0;
          const tip = `${r.name}${r.role ? ` (${r.role})` : ''}: ${fmtMoney(r.value)} em ${plural(r.count, 'venda', 'vendas')} · ${share}% do vendido no mês`;
          return (
            <div key={r.id || r.name} className={cn('flex items-center gap-3.5 border-t py-[11px]', RULE)}>
              <span className="num grid size-8 flex-none place-items-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                {dashInitials(r.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{r.name}</span>
                  <ItemDelta delta={r.delta} />
                  <span className="num flex-none font-display text-[14px] font-bold">{fmtMoneyShort(r.value)}</span>
                </div>
                <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-muted">
                  <ChartMark
                    tip={tip}
                    className={cn('block h-full rounded-full', i === 0 ? 'bg-brand-600' : 'bg-brand-200 dark:bg-brand-500/40')}
                    style={{ width: `${Math.max(Math.round(((Number(r.value) || 0) / max) * 100), 3)}%` }}
                  />
                </div>
              </div>
              <span className="num w-[60px] flex-none text-right text-[13px] font-semibold">{fmtNum(r.count)}</span>
              <span className="num w-[90px] flex-none text-right text-[13px] font-semibold">{fmtMoney(r.monthly)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Props:
//   horizon  [{ days, label, count, v, blind }] — v é o valor por mês
export function ExpiryCard({ horizon }) {
  const list = horizon || [];
  const count = list.reduce((s, h) => s + (Number(h.count) || 0), 0);
  const blind = list.reduce((s, h) => s + (Number(h.blind) || 0), 0);
  const moneyMax = Math.max(1, ...list.map((h) => Number(h.v) || 0));
  const blindMax = Math.max(1, ...list.map((h) => Number(h.blind) || 0));

  return (
    <section className={CARD}>
      <div className="flex items-baseline gap-2.5">
        <h3 className={TITLE}>Vencimentos</h3>
        <DashHelpTip text={HELP.expiry} label='O que é "Vencimentos"?' />
        <div className="flex-1" />
        <span className="num whitespace-nowrap text-[12px] text-muted-foreground">{plural(count, 'contrato', 'contratos')}</span>
      </div>

      <div className="mt-4 flex flex-col gap-3.5">
        {list.map((h) => (
          <div key={h.days || h.label} className="flex items-center gap-3.5">
            <span className="w-[78px] flex-none text-[12.5px] font-semibold text-foreground/80">{h.label}</span>
            <div className="flex h-2.5 min-w-0 flex-1 items-center gap-[5px]">
              <ChartMark
                tip={`${h.label}: ${plural(h.count, 'contrato', 'contratos')} valendo ${fmtMoney(h.v)} por mês`}
                className="block h-2.5 rounded-full bg-amber-500"
                style={{ width: widthOf(h.v, moneyMax, SOLID_MAX) }}
              />
              {h.blind > 0 && (
                <ChartMark
                  tip={`${h.label}: mais ${plural(h.blind, 'contrato importado sem valor', 'contratos importados sem valor')}. Contam como pessoas que vencem, não entram no valor por mês.`}
                  className={cn('block h-2.5 rounded-full', DASHED)}
                  style={{ width: widthOf(h.blind, blindMax, BLIND_MAX) }}
                />
              )}
            </div>
            <span className={cn('num w-[92px] flex-none text-right font-display text-[13.5px] font-bold', AMBER_TEXT)}>{fmtMoney(h.v)}</span>
          </div>
        ))}
      </div>

      {blind > 0 && (
        <div className={cn('mt-4 flex items-center gap-[7px] border-t pt-3 text-[12px] text-muted-foreground', RULE)}>
          <span className={cn('block h-2 w-3.5 rounded-full', DASHED)} />
          {plural(blind, 'contrato importado sem valor', 'contratos importados sem valor')}
        </div>
      )}
    </section>
  );
}

const EXIT_TONES = {
  cancelamento: { text: 'text-rose-700 dark:text-rose-300', fill: 'bg-danger dark:bg-[#E11D48]' },
  // Trancado é amarelo no app inteiro (ficha, Clientes e Gerencial).
  trancamento: { text: 'text-yellow-700 dark:text-yellow-300', fill: 'bg-yellow-500' }
};

// Props:
//   items  [{ kind, label, count, v, delta }] — kind 'cancelamento' ou 'trancamento'
export function ExitsCard({ items }) {
  const list = items || [];
  const total = list.reduce((s, e) => s + (Number(e.v) || 0), 0);
  const max = Math.max(1, ...list.map((e) => Number(e.v) || 0));

  return (
    <section className={CARD}>
      <div className="flex items-baseline gap-2.5">
        <h3 className={TITLE}>Saídas do mês</h3>
        <DashHelpTip text={HELP.exits} label='O que é "Saídas do mês"?' />
        <div className="flex-1" />
        <span className="num whitespace-nowrap text-[12px] text-muted-foreground">{`${fmtMoney(total)}/mês`}</span>
      </div>

      <div className="mt-4 flex flex-col gap-3.5">
        {list.map((e) => {
          const tone = EXIT_TONES[e.kind] || EXIT_TONES.trancamento;
          return (
            <div key={e.kind || e.label} className="flex items-center gap-3.5">
              <span className="w-[110px] flex-none text-[12.5px] font-semibold text-foreground/80">{e.label}</span>
              <div className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                <ChartMark
                  tip={`${e.label}: ${plural(e.count, 'contrato', 'contratos')}, ${fmtMoney(e.v)} por mês`}
                  className={cn('block h-full rounded-full', tone.fill)}
                  style={{ width: `${Math.max(Math.round(((Number(e.v) || 0) / max) * 100), 4)}%` }}
                />
              </div>
              {list.some((x) => x.delta) && <span className="w-[54px] flex-none text-right"><ItemDelta delta={e.delta} /></span>}
              <span className={cn('num w-7 flex-none text-right text-[13px] font-bold', tone.text)}>{fmtNum(e.count)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
