// As faixas de venda da tela Gerencial (mockup A): de onde veio a venda por
// tipo, e planos e origem em barras ordenadas. Planos e origem eram pizza no
// handoff v2; cinco fatias de pizza se leem pior que cinco barras alinhadas,
// e a barra deixa ver a variação ao lado de cada linha.
//
// Toda porcentagem sai do valor das próprias linhas: nada de número pronto.
import { RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { HELP } from '../../lib/gerencial/texts.js';
import { Band } from './Band.jsx';
import { ChartMark } from './ChartMark.jsx';
import { ItemDelta } from './ItemDelta.jsx';
import { fmtMoney, fmtMoneyShort } from './dashTokens.js';

// Os quatro tipos de venda. Rótulo e cor são apresentação: o mix chega só com
// o tipo, a contagem e o valor.
const TYPES = {
  nova: { label: 'Matrícula nova', fill: 'bg-brand-600 dark:bg-brand-500' },
  renovacao: { label: 'Renovação', fill: 'bg-success dark:bg-[#0E9F6E]' },
  upgrade: { label: 'Upgrade', fill: 'bg-violet-500' },
  retorno: { label: 'Retorno de ex-cliente', fill: 'bg-slate-400 dark:bg-slate-500' }
};

const plural = (n, one, many) => `${fmtNum(n)} ${n === 1 ? one : many}`;
const pctOf = (v, total) => (total > 0 ? Math.round(((Number(v) || 0) / total) * 100) : 0);

// Props:
//   mix       [{ type, count, value, delta }] — nova, renovacao, upgrade e retorno
//   discount  { pct, abs, prevPct }
//   clawback  { count, value } — vendas do mês que já foram canceladas
export function SalesTypeCard({ mix, discount, clawback }) {
  const list = (mix || []).map((m) => ({ ...m, label: TYPES[m.type]?.label || m.type, fill: TYPES[m.type]?.fill || TYPES.retorno.fill }));
  const sold = list.reduce((s, m) => s + (Number(m.value) || 0), 0);
  const pct = Number(discount?.pct) || 0;
  const heavy = pct >= 12;

  return (
    <Band
      title="De onde veio a venda"
      help={HELP.mix}
      question={
        <>
          {'Cada contrato entra em um tipo só. Desconto médio de '}
          <b
            className={cn('font-semibold text-foreground', heavy && 'text-amber-700 dark:text-amber-300')}
            title={discount?.prevPct != null ? `Mês comparado: ${fmtNum(discount.prevPct)}%` : undefined}
          >
            {`${fmtNum(pct)}%`}
          </b>
          {' sobre a tabela.'}
        </>
      }
    >
      <div className="flex h-[34px] overflow-hidden rounded-[10px] bg-muted">
        {list.map((m) => (
          <ChartMark
            key={m.type}
            tip={`${m.label}: ${plural(m.count, 'contrato', 'contratos')} · ${fmtMoney(m.value)} · ${pctOf(m.value, sold)}% do vendido`}
            className={cn('flex h-full min-w-[6px] items-center border-l-2 border-card px-2.5 first:border-l-0', m.fill)}
            style={{ width: `${pctOf(m.value, sold)}%` }}
          >
            {pctOf(m.value, sold) >= 10 && <span className="num whitespace-nowrap font-display text-[12px] font-bold text-white">{`${pctOf(m.value, sold)}%`}</span>}
          </ChartMark>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-5 md:grid-cols-4">
        {list.map((m) => (
          <div key={m.type} className="min-w-0">
            <div className="flex items-center gap-2 font-medium text-foreground/80">
              <i className={cn('block size-2.5 flex-none rounded-[3px]', m.fill)} />
              <span className="truncate">{m.label}</span>
            </div>
            <div className="num mb-0.5 mt-1.5 font-display text-[24px] font-bold leading-tight tracking-[-0.02em] sm:text-[26px]">{fmtMoneyShort(m.value)}</div>
            <div className="num flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-muted-foreground">
              {`${plural(m.count, 'contrato', 'contratos')} · ${pctOf(m.value, sold)}%`}
              <ItemDelta delta={m.delta} />
            </div>
          </div>
        ))}
      </div>

      {clawback?.count > 0 && (
        <div className="num mt-5 flex items-center gap-2 text-[13px] text-rose-700 dark:text-rose-300">
          <RotateCcw size={14} strokeWidth={2.1} className="flex-none" />
          {`${plural(clawback.count, 'venda deste mês já foi cancelada', 'vendas deste mês já foram canceladas')}, somando ${fmtMoney(clawback.value)}.`}
        </div>
      )}
    </Band>
  );
}

// Planos ou origem: uma barra por linha, a primeira em azul cheio, e ao lado o
// valor, a participação e a variação. Grandeza é valor vendido; `times` é o
// número de vendas e entra só na dica.
//
// Props:
//   title, question, help, total
//   items  [{ name, count (valor), times, delta }] — já ordenados, o líder primeiro
export function RankCard({ title, question, help, items, total }) {
  const list = items || [];
  const max = Math.max(1, ...list.map((it) => Number(it.count) || 0));
  return (
    <Band title={title} question={question} help={help}>
      {list.length === 0 && <span className="text-[13px] text-muted-foreground">Nenhuma venda no mês.</span>}
      <div className="flex flex-col">
        {list.map((it, i) => (
          <div
            key={it.name}
            className="grid grid-cols-[minmax(0,1fr)_84px] items-center gap-x-3 gap-y-1.5 border-t border-slate-100 py-[9px] first:border-t-0 dark:border-white/[0.06] sm:grid-cols-[minmax(150px,1fr)_minmax(60px,1.4fr)_84px_40px_52px]"
          >
            <span className="min-w-0 truncate font-medium">{it.name}</span>
            <span className="num text-right font-display text-[14px] font-bold sm:order-3">{fmtMoneyShort(it.count)}</span>
            <span className="col-span-2 flex h-2 overflow-hidden rounded-full bg-muted sm:order-2 sm:col-span-1">
              <ChartMark
                tip={`${it.name}: ${fmtMoney(it.count)} em ${plural(it.times, 'venda', 'vendas')} · ${pctOf(it.count, total)}% do vendido`}
                className={cn('block h-full rounded-full', i === 0 ? 'bg-brand-600' : 'bg-brand-200 dark:bg-brand-500/40')}
                style={{ width: `${Math.max(Math.round(((Number(it.count) || 0) / max) * 100), 3)}%` }}
              />
            </span>
            <span className="num hidden text-right text-[12px] text-muted-foreground sm:order-4 sm:block">{`${pctOf(it.count, total)}%`}</span>
            <span className="hidden text-right sm:order-5 sm:block"><ItemDelta delta={it.delta} /></span>
          </div>
        ))}
      </div>
    </Band>
  );
}
