// Os quatro números da tela Gerencial (handoff v2, §2 L1): vendido no mês,
// carteira mensal, o que está em risco nos próximos 90 dias e o que já venceu
// sem renovar. Só apresentação: cada valor sai das props que o viewModel monta.
//
// Duas moedas que nunca se somam: "Vendido" é valor de contrato inteiro, e
// carteira e risco são valor por mês. O "/mês" fica num elemento irmão do
// número, no mesmo baseline, para nunca se soltar dele.
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { HELP } from '../../lib/gerencial/texts.js';
import { DashHelpTip } from './DashPrimitives.jsx';
import { fmtMoney, fmtMoneyShort } from './dashTokens.js';

export const CASH_WARNING = 'Valor de contrato vendido, não caixa recebido';

const CARD = 'rounded-2xl border border-border bg-card px-4 py-5 shadow-card sm:px-[22px]';
// No celular os cards da segunda linha dividem a largura: o número não quebra.
const VALUE = 'num whitespace-nowrap font-display text-[22px] font-bold leading-none tracking-[-0.03em] sm:text-[30px]';
const LABEL = 'text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground';
const SUB = 'num mt-2.5 text-[12.5px] text-muted-foreground';
const plural = (n, one, many) => `${fmtNum(n)} ${n === 1 ? one : many}`;

// Variação sobre o mês comparado. Sem base (mês comparado sem venda) a pílula
// fica neutra, e o `title` diz de onde a variação saiu.
function SoldDelta({ delta }) {
  const quiet = Boolean(delta.none);
  return (
    <span
      title={delta.baseline}
      className={cn(
        'num inline-flex h-6 flex-none items-center whitespace-nowrap rounded-lg px-2 text-[12.5px] font-bold',
        quiet ? 'bg-muted text-muted-foreground'
          : delta.up ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
            : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
      )}
    >
      {quiet ? delta.text : `${delta.up ? '▲' : '▼'} ${delta.text}`}
    </span>
  );
}

// Props:
//   sold    { mix, ticket, delta } — o vendido e a contagem saem do mix
//   wallet  { count, monthly, lockedCount }
//   risk    { horizon, walletMonthly, lapsedCount }
export function GerencialKpis({ sold, wallet, risk }) {
  const mix = sold?.mix || [];
  const soldTotal = mix.reduce((s, m) => s + (Number(m.value) || 0), 0);
  const soldCount = mix.reduce((s, m) => s + (Number(m.count) || 0), 0);
  const horizon = risk?.horizon || [];
  const riskValue = horizon.reduce((s, h) => s + (Number(h.v) || 0), 0);
  const walletMonthly = Number(risk?.walletMonthly) || 0;
  const share = walletMonthly > 0 ? Math.round((riskValue / walletMonthly) * 100) : 0;
  const lapsed = Number(risk?.lapsedCount) || 0;

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-[minmax(0,1.35fr)_repeat(3,minmax(0,1fr))]">
      <section className={cn(CARD, 'col-span-2 border-t-[3px] border-t-brand-600 xl:col-span-1')}>
        <div className="flex items-center gap-2">
          <span className={LABEL}>Vendido no mês</span>
          <DashHelpTip text={HELP.sold} label='O que é "Vendido no mês"?' />
          <div className="flex-1" />
          <span
            title={CASH_WARNING}
            className="whitespace-nowrap rounded-full bg-amber-500/10 px-2 py-[3px] text-[10.5px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
          >
            não é caixa
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <span className="num font-display text-[40px] font-bold leading-none tracking-[-0.035em]">{fmtMoney(soldTotal)}</span>
          {sold?.delta && <SoldDelta delta={sold.delta} />}
        </div>
        <div className={SUB}>{`${plural(soldCount, 'contrato', 'contratos')} · ticket ${fmtMoney(sold?.ticket)}/mês`}</div>
      </section>

      <section className={CARD}>
        <div className="flex items-center gap-1.5">
          <span className={LABEL}>Carteira mensal</span>
          <DashHelpTip text={HELP.wallet} label='O que é "Carteira mensal"?' />
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
          <span className={VALUE}>{fmtMoneyShort(wallet?.monthly)}</span>
          <span className="text-[13px] font-semibold text-muted-foreground">/mês</span>
        </div>
        <div className={SUB}>{`${plural(wallet?.count, 'contrato', 'contratos')} · ${fmtNum(wallet?.lockedCount)} ${Number(wallet?.lockedCount) === 1 ? 'trancado' : 'trancados'}`}</div>
      </section>

      <section className={CARD}>
        <div className="flex items-center gap-1.5">
          <span className={LABEL}>Em risco · 90 dias</span>
          <DashHelpTip text={HELP.risk} label='O que é "Em risco · 90 dias"?' />
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-1 gap-y-0.5 text-amber-700 dark:text-amber-300">
          <span className={VALUE}>{fmtMoneyShort(riskValue)}</span>
          <span className="text-[13px] font-semibold">/mês</span>
        </div>
        <div className={SUB}>{`${share}% da carteira`}</div>
      </section>

      <section className={cn(CARD, 'col-span-2 xl:col-span-1')}>
        <div className="flex items-center gap-1.5">
          <span className={LABEL}>Vencidos sem renovar</span>
          <DashHelpTip text={HELP.lapsed} label='O que é "Vencidos sem renovar"?' />
        </div>
        <div className="mt-3">
          <span className={cn(VALUE, 'text-rose-700 dark:text-rose-300')}>{fmtNum(lapsed)}</span>
        </div>
        <div className={SUB}>{lapsed === 1 ? 'contrato para recuperar' : 'contratos para recuperar'}</div>
      </section>
    </div>
  );
}
