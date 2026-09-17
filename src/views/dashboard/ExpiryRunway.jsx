// Esteira de vencimento (handoff do Gerencial, linhas 286 a 340): o acumulado
// de 90 dias no topo e as três faixas embaixo. Não são três cartões iguais lado
// a lado de propósito: o que importa é o acumulado e a proporção sobre a
// carteira, e este é o segundo número mais forte da tela porque é o único que
// gera ação hoje (README §1).
//
// O total, a contagem, a soma sem valor e a fatia da carteira saem da própria
// esteira: receber qualquer um deles pronto abriria espaço para o número do
// topo divergir das três barras logo abaixo (README §8). O único dado de fora é
// o valor por mês da carteira, que é o denominador da fatia.
//
// A trilha tracejada NÃO compartilha o eixo de dinheiro da barra sólida: ela
// mede gente, tem escala própria e se distingue por forma, nunca por tom.
//
// Props:
//   horizon        [{ days, label, count, v, blind }] — v é o valor por mês
//   walletMonthly  valor por mês da carteira; sem ele a fatia não aparece
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { ChartMark } from './ChartMark.jsx';
import { Swatch } from './CrmParts.jsx';
import { BlindValueNote } from './GerencialParts.jsx';
import { fmtMoney } from './dashTokens.js';

const CARD = 'rounded-2xl border border-border bg-card shadow-card';
const RULE = 'border-slate-100 dark:border-white/[0.06]';
const AMBER_TEXT = 'text-amber-700 dark:text-amber-300';
// Hachura a 135° com borda tracejada: a forma que marca contrato sem valor.
const HATCH = 'border-[1.5px] border-dashed border-slate-400 bg-[repeating-linear-gradient(135deg,var(--muted)_0_4px,transparent_4px_8px)] dark:border-slate-500';
// A barra sólida para em 74% para sobrar espaço à trilha e ao rótulo dela.
const SOLID_MAX = 74;
const BLIND_MAX = 16;

const plural = (n, one, many) => `${fmtNum(n)} ${n === 1 ? one : many}`;
const widthOf = (v, max, ceiling) => `${Math.max(Math.round(((Number(v) || 0) / max) * ceiling), 4)}%`;

export function ExpiryRunway({ horizon, walletMonthly }) {
  const list = horizon || [];
  const value = list.reduce((s, h) => s + (Number(h.v) || 0), 0);
  const count = list.reduce((s, h) => s + (Number(h.count) || 0), 0);
  const blind = list.reduce((s, h) => s + (Number(h.blind) || 0), 0);
  const moneyMax = Math.max(1, ...list.map((h) => Number(h.v) || 0));
  const blindMax = Math.max(1, ...list.map((h) => Number(h.blind) || 0));
  const wallet = Number(walletMonthly) || 0;
  const share = wallet > 0 ? Math.round((value / wallet) * 100) : null;

  return (
    <section className={cn(CARD, 'px-5 pb-4 pt-[18px]')}>
      <div className="flex flex-col items-start gap-3.5 sm:flex-row">
        <div className="min-w-0 flex-1">
          <span className="text-[13.5px] font-semibold">Vencendo nos próximos 90 dias</span>
          <div className="mt-[9px] flex flex-wrap items-baseline gap-2">
            <span className={cn('num font-display text-[32px] font-bold leading-none tracking-[-0.03em]', AMBER_TEXT)}>{fmtMoney(value)}</span>
            <span className={cn('num text-[14px] font-semibold', AMBER_TEXT)}>/mês</span>
            <span className="num text-[12px] text-muted-foreground">{`em ${plural(count, 'contrato', 'contratos')}`}</span>
          </div>
          {share != null && <div className="num mt-1.5 text-[12px] text-foreground/80">{`${share}% da carteira`}</div>}
        </div>
        {blind > 0 && <BlindValueNote count={blind} context="vencem no período e não entram na conta acima" />}
      </div>

      <div className={cn('mt-5 flex flex-col gap-3 border-t pt-4', RULE)}>
        {list.map((h) => (
          <div key={h.days || h.label}>
            <div className="flex items-baseline gap-[9px]">
              <span className="whitespace-nowrap text-[12.5px] font-semibold">{h.label}</span>
              <span className="num text-[11.5px] text-muted-foreground">{plural(h.count, 'contrato', 'contratos')}</span>
              <div className="flex-1" />
              <span className={cn('num font-display text-[14px] font-bold', AMBER_TEXT)}>{fmtMoney(h.v)}</span>
              <span className="num text-[11px] text-muted-foreground">/mês</span>
            </div>
            <div className="mt-1.5 flex h-4 items-center gap-[5px]">
              <ChartMark
                tip={`${h.label}: ${plural(h.count, 'contrato', 'contratos')} valendo ${fmtMoney(h.v)} por mês`}
                className="block h-4 rounded bg-amber-500"
                style={{ width: widthOf(h.v, moneyMax, SOLID_MAX) }}
              />
              {h.blind > 0 && (
                <>
                  <ChartMark
                    tip={`${h.label}: mais ${plural(h.blind, 'contrato importado sem valor', 'contratos importados sem valor')}. Contam como pessoas que vencem, não entram no valor por mês.`}
                    className={cn('block h-4 rounded', HATCH)}
                    style={{ width: widthOf(h.blind, blindMax, BLIND_MAX) }}
                  />
                  <span className="num flex-none whitespace-nowrap text-[10.5px] text-muted-foreground">{`+${fmtNum(h.blind)} sem valor`}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={cn('mt-[15px] flex flex-wrap items-center gap-3.5 border-t pt-3', RULE)}>
        <Swatch className="size-2.5 rounded-[3px] bg-amber-500">valor por mês em risco</Swatch>
        {/* Explicar um símbolo ausente seria o oposto do argumento: sem contrato sem valor, o item sai. */}
        {blind > 0 && <Swatch className={cn('size-2.5 rounded-[3px]', HATCH)}>contrato importado sem valor</Swatch>}
      </div>
    </section>
  );
}
