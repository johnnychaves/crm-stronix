// O topo da tela Gerencial (mockup A, "Placar"): o herói escuro com o vendido
// do mês e a curva dele contra o mês comparado, e logo abaixo a faixa dos
// quatro números sem caixa: carteira, ticket médio, churn e vencidos.
//
// Duas moedas que nunca se somam: "Vendido" é valor de contrato inteiro, e
// carteira e ticket são valor por mês. O "/mês" fica num elemento irmão do
// número, para nunca se soltar dele. Só apresentação: cada valor sai das props
// que o viewModel monta.
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { HELP } from '../../lib/gerencial/texts.js';
import { DashHelpTip } from './DashPrimitives.jsx';
import { ItemDelta } from './ItemDelta.jsx';
import { SalesCurve } from './SalesCurve.jsx';
import { fmtMoney, fmtMoneyShort } from './dashTokens.js';

export const CASH_WARNING = 'Valor de contrato vendido, não caixa recebido';

const plural = (n, one, many) => `${fmtNum(n)} ${n === 1 ? one : many}`;
const LABEL = 'text-[13px] font-medium text-muted-foreground';
const VALUE = 'num whitespace-nowrap font-display text-[24px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[36px]';

// Props:
//   sold    { mix, delta } — o vendido e a contagem saem do mix
//   period  { monthName, running, day }
//   curve   { days, cur, cutDay, prev, prevName }
export function SoldHero({ sold, period, curve }) {
  const mix = sold?.mix || [];
  const total = mix.reduce((s, m) => s + (Number(m.value) || 0), 0);
  const count = mix.reduce((s, m) => s + (Number(m.count) || 0), 0);
  const delta = sold?.delta;
  const monthName = period?.monthName || '';
  const head = period?.running ? `Vendido em ${monthName}, até o dia ${period.day}` : `Vendido em ${monthName}`;

  return (
    <section className="grid grid-cols-1 items-center gap-8 rounded-[22px] bg-ink-900 bg-[radial-gradient(900px_340px_at_85%_-20%,#22357a_0,transparent_60%)] px-6 py-8 text-white md:px-[38px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div>
        <div className="flex items-center gap-2 text-[15px] text-white/70">
          {head}
          <DashHelpTip text={HELP.sold} label='O que é "Vendido no mês"?' />
        </div>
        <div className="num mt-3.5 font-display text-[clamp(52px,7vw,92px)] font-bold leading-[0.95] tracking-[-0.045em]">{fmtMoney(total)}</div>
        <div className="mt-[18px] flex flex-wrap items-center gap-3">
          {delta && (
            <span
              title={delta.baseline}
              className={cn(
                'num inline-flex h-[26px] items-center whitespace-nowrap rounded-lg px-2.5 text-[12.5px] font-bold',
                delta.none ? 'bg-white/10 text-white/70'
                  : delta.up ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300'
              )}
            >
              {delta.none ? delta.text : `${delta.up ? '▲' : '▼'} ${delta.text} sobre ${delta.name}`}
            </span>
          )}
          <span className="num text-white/80">{plural(count, 'contrato', 'contratos')}</span>
        </div>
        <p className="mt-4 text-[13px] text-white/60" title={CASH_WARNING}>Valor de contrato fechado, não dinheiro que já entrou no caixa.</p>
      </div>
      {curve && curve.days > 0 && (
        <SalesCurve days={curve.days} cur={curve.cur} prev={curve.prev} cutDay={curve.cutDay} curName={monthName} prevName={curve.prevName} />
      )}
    </section>
  );
}

function Cell({ label, help, helpLabel, children, className }) {
  return (
    <div className={cn('min-w-0 px-1 py-1 md:border-l md:border-border md:px-6 md:first:border-l-0 md:first:pl-1', className)}>
      <div className="flex items-center gap-1.5">
        <span className={LABEL}>{label}</span>
        <DashHelpTip text={help} label={helpLabel || `O que é "${label}"?`} />
      </div>
      {children}
    </div>
  );
}

// Props:
//   wallet  { count, monthly, ticket, lockedCount }
//   risk    { lapsedCount }
//   churn   { pct, exits, base, delta }
export function GerencialTape({ wallet, risk, churn }) {
  const lapsed = Number(risk?.lapsedCount) || 0;
  const churnBase = Number(churn?.base) || 0;
  const churnExits = Number(churn?.exits) || 0;
  const locked = Number(wallet?.lockedCount) || 0;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4 md:gap-x-0">
      <Cell label="Carteira mensal" help={HELP.wallet}>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5">
          <span className={VALUE}>{fmtMoneyShort(wallet?.monthly)}</span>
          <span className="text-[14px] font-semibold text-muted-foreground">/mês</span>
        </div>
        <div className="num text-[13px] text-muted-foreground">{`${plural(wallet?.count, 'contrato', 'contratos')} · ${plural(locked, 'trancado', 'trancados')}`}</div>
      </Cell>
      <Cell label="Ticket médio mensal" help={HELP.ticket}>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5">
          <span className={VALUE}>{fmtMoney(wallet?.ticket)}</span>
          <span className="text-[14px] font-semibold text-muted-foreground">/mês</span>
        </div>
        <div className="text-[13px] text-muted-foreground">média por contrato</div>
      </Cell>
      <Cell label="Churn" help={HELP.churn}>
        <div className="mt-1.5">
          <span className={VALUE}>{churn?.pct == null ? '—' : `${churn.pct.toLocaleString('pt-BR')}%`}</span>
        </div>
        <div className="num flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
          {churnBase > 0
            ? `${fmtNum(churnExits)} de ${fmtNum(churnBase)} ${churnExits === 1 ? 'cliente saiu' : 'clientes saíram'}`
            : 'sem clientes ativos no início'}
          <ItemDelta delta={churn?.delta} />
        </div>
      </Cell>
      <Cell label="Vencidos sem renovar" help={HELP.lapsed}>
        <div className="mt-1.5">
          <span className={cn(VALUE, 'text-rose-700 dark:text-rose-300')}>{fmtNum(lapsed)}</span>
        </div>
        <div className="text-[13px] text-muted-foreground">{lapsed === 1 ? 'contrato para recuperar' : 'contratos para recuperar'}</div>
      </Cell>
    </div>
  );
}
