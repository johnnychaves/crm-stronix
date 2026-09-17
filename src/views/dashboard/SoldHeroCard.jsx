// Painel da venda do mês (handoff do Gerencial, linhas 161 a 231): o herói com
// o vendido, o ticket e o desconto à esquerda; a cápsula dos tipos de venda com
// a legenda à direita; a nota de venda cancelada depois no pé.
//
// Duas regras do README moram na marcação, não no texto. O sufixo "/mês" é um
// elemento irmão do número, no mesmo baseline, para nunca se soltar dele (§1).
// E nenhuma porcentagem chega pronta: o vendido, a contagem e a participação de
// cada tipo saem do próprio mix, que é partição fechada das vendas do mês (§8).
//
// Props:
//   mix       [{ type, count, value }] — nova, renovacao, upgrade e retorno
//   delta     { up, text, baseline } — com Comparar desligado vem null, e some
//             a pílula junto com a linha de base
//   ticket    ticket mensal médio das vendas, em número
//   discount  { pct, abs }
//   clawback  a frase pronta das vendas já canceladas, ou vazio
import { RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { ChartMark } from './ChartMark.jsx';
import { DeltaPill } from './CrmParts.jsx';
import { fmtMoney, fmtMoneyShort } from './dashTokens.js';

const CARD = 'rounded-2xl border border-border bg-card shadow-card';
const RULE = 'border-slate-100 dark:border-white/[0.06]';
const CAPS = 'text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground';
const FAINT = 'text-slate-400 dark:text-slate-500';

// Os quatro tipos de venda do handoff §3. Rótulo e cor são apresentação: o mix
// chega só com o tipo, a contagem e o valor.
const TYPES = {
  nova: { label: 'Matrícula nova', fill: 'bg-brand-600 dark:bg-brand-500' },
  renovacao: { label: 'Renovação', fill: 'bg-success dark:bg-[#0E9F6E]' },
  upgrade: { label: 'Upgrade', fill: 'bg-violet-500' },
  retorno: { label: 'Retorno de ex-cliente', fill: 'bg-slate-400 dark:bg-slate-500' }
};

const plural = (n, one, many) => `${fmtNum(n)} ${n === 1 ? one : many}`;

export function SoldHeroCard({ mix, delta, ticket, discount, clawback }) {
  const list = (mix || []).map((m) => ({
    ...m,
    label: TYPES[m.type]?.label || m.type,
    fill: TYPES[m.type]?.fill || 'bg-slate-400 dark:bg-slate-500'
  }));
  const sold = list.reduce((s, m) => s + (Number(m.value) || 0), 0);
  const count = list.reduce((s, m) => s + (Number(m.count) || 0), 0);
  const pctOf = (v) => (sold > 0 ? Math.round(((Number(v) || 0) / sold) * 100) : 0);
  const disc = discount || {};
  // Acima de 12% o desconto deixa de ser rotina e ganha o âmbar do risco.
  const heavyDiscount = (Number(disc.pct) || 0) >= 12;

  return (
    <section className={cn(CARD, 'overflow-hidden')}>
      <div className="flex flex-col md:flex-row md:items-stretch">
        <div className={cn('w-full flex-none border-b px-6 pb-[22px] pt-5 md:w-[330px] md:border-b-0 md:border-r', RULE)}>
          <div className="text-[12px] font-medium text-muted-foreground">Vendido no mês</div>
          <div className="mt-[9px] flex flex-wrap items-end gap-2.5">
            <span className="num font-display text-[44px] font-bold leading-[0.95] tracking-[-0.035em]">{fmtMoney(sold)}</span>
            {delta && <span className="mb-[5px] flex-none"><DeltaPill delta={delta} /></span>}
          </div>
          <div className="num mt-[7px] text-[12px] text-muted-foreground">{plural(count, 'contrato', 'contratos')}</div>
          {delta?.baseline && <div className={cn('num mt-[3px] text-[11.5px]', FAINT)}>{delta.baseline}</div>}

          <div className={cn('mt-5 flex items-stretch border-t pt-4', RULE)}>
            <div className="min-w-0 flex-1">
              <div className={CAPS}>Ticket mensal</div>
              <div className="mt-1.5 flex items-baseline gap-0.5">
                <span className="num text-[19px] font-semibold tracking-[-0.02em]">{fmtMoney(ticket)}</span>
                <span className="num text-[13px] font-semibold text-muted-foreground">/mês</span>
              </div>
              <div className={cn('mt-0.5 text-[10.5px]', FAINT)}>média das vendas</div>
            </div>
            <span className={cn('mx-4 w-px flex-none border-l', RULE)} />
            <div className="min-w-0 flex-1">
              <div className={CAPS}>Desconto</div>
              <div className={cn('num mt-1.5 text-[19px] font-semibold tracking-[-0.02em]', heavyDiscount && 'text-amber-700 dark:text-amber-300')}>
                {`${fmtNum(disc.pct || 0)}%`}
              </div>
              <div className={cn('num mt-0.5 text-[10.5px]', FAINT)}>{`${fmtMoney(disc.abs)} abaixo da tabela`}</div>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 px-6 pb-[22px] pt-5">
          <div className="flex items-baseline gap-2.5">
            <span className="text-[13.5px] font-semibold">De onde veio a venda</span>
            <div className="flex-1" />
            <span className="hidden whitespace-nowrap text-[11.5px] text-muted-foreground sm:block">cada contrato entra em um tipo só</span>
          </div>

          <div className="mt-3.5 flex h-11 overflow-hidden rounded-xl bg-muted">
            {list.map((m) => (
              <ChartMark
                key={m.type}
                tip={`${m.label}: ${plural(m.count, 'contrato', 'contratos')} · ${fmtMoney(m.value)} · ${pctOf(m.value)}% do vendido`}
                className={cn('flex h-full min-w-[8px] items-center border-l-2 border-white px-2.5 first:border-l-0 dark:border-ink-800', m.fill)}
                style={{ width: `${pctOf(m.value)}%` }}
              >
                {/* Abaixo de 12% o segmento é estreito demais para o rótulo caber: o número fica só na legenda. */}
                {pctOf(m.value) >= 12 && (
                  <span className="num whitespace-nowrap font-display text-[12px] font-bold text-white">{`${pctOf(m.value)}%`}</span>
                )}
              </ChartMark>
            ))}
          </div>

          <div className="mt-[15px] grid grid-cols-1 gap-x-[22px] gap-y-[9px] sm:grid-cols-2">
            {list.map((m, i) => (
              <div key={m.type} className="flex items-center gap-[9px]">
                <i className={cn('block size-[9px] flex-none rounded-[3px]', m.fill)} />
                <span className={cn('min-w-0 flex-1 truncate text-[13px]', i === 0 ? 'font-semibold' : 'text-foreground/80')}>{m.label}</span>
                <span className="num flex-none text-[12.5px] text-muted-foreground">{plural(m.count, 'venda', 'vendas')}</span>
                <span className="num w-[76px] flex-none text-right font-display text-[13.5px] font-bold">{fmtMoneyShort(m.value)}</span>
              </div>
            ))}
          </div>

          {clawback && (
            <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-border bg-muted/50 px-[13px] py-[11px]">
              <RotateCcw size={15} strokeWidth={2.1} className="flex-none text-rose-700 dark:text-rose-300" />
              <span className="min-w-0 flex-1 text-pretty text-[12px] leading-[1.45] text-foreground/80">{clawback}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
