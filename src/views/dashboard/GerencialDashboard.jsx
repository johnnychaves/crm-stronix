// Corpo da tela Gerencial, só apresentação (mockup A, "Placar"): o herói com a
// venda do mês e a curva dele, a faixa dos quatro números, e abaixo as faixas
// de venda (tipo, consultores, planos e origem) e a do que vence e do que sai.
// Recebe as métricas prontas de DashboardGerencialView e não calcula nada.
//
// Props:
//   period   { monthName, running, day }
//   curve    { days, cur, cutDay, prev, prevName }
//   sold     { mix, delta, discount, clawback: { count, value } }
//   wallet   { count, monthly, ticket, lockedCount }
//   risk     { horizon, walletMonthly, lapsedCount }
//   exits    { items }
//   churn    { pct, exits, base, delta }
//   sellers  { rows }
//   plans    { items, total } — count é dinheiro e times é o número de vendas
//   sources  { items, total }
//   flags    { gymEmpty, monthNoSales }
//   texts    { emptyMonth: { title, text } }
import { GerencialTape, SoldHero } from './GerencialKpis.jsx';
import { SalesTypeCard, RankCard } from './GerencialPies.jsx';
import { SellersCard, ExpiryExitsCard } from './GerencialRows.jsx';
import { GerencialEmpty } from './GerencialParts.jsx';
import { HELP } from '../../lib/gerencial/texts.js';

const TWO = 'grid grid-cols-1 items-start gap-5 xl:grid-cols-2';

export function GerencialDashboard({ period, curve, sold, wallet, risk, exits, churn, sellers, plans, sources, flags, texts, onGoToPipeline }) {
  // A academia sem contrato nenhum troca o CORPO INTEIRO por um painel só: nem
  // número zerado, nem tabela com zero linhas.
  if (flags?.gymEmpty) {
    return (
      <div className="px-4 pb-8 pt-[22px] md:px-8">
        <GerencialEmpty onGoToPipeline={onGoToPipeline} />
      </div>
    );
  }

  // Mês sem venda esvazia só o que descreve a venda do mês. A faixa de
  // números e o que vence e sai seguem inteiros, porque olham contratos
  // vigentes, não as vendas do mês.
  const noSales = Boolean(flags?.monthNoSales);

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 pt-[22px] md:px-8">
      {noSales ? (
        <div className="rounded-[22px] border border-border bg-card px-7 py-10 text-center shadow-card">
          <div className="font-display text-[19px] font-bold tracking-[-0.02em]">{texts?.emptyMonth?.title}</div>
          {texts?.emptyMonth?.text && (
            <p className="mx-auto mt-2 max-w-[560px] text-pretty text-[13.5px] leading-relaxed text-muted-foreground">{texts.emptyMonth.text}</p>
          )}
        </div>
      ) : (
        <SoldHero sold={sold} period={period} curve={curve} />
      )}

      <GerencialTape wallet={wallet} risk={risk} churn={churn} />

      {!noSales && <SalesTypeCard mix={sold?.mix} discount={sold?.discount} clawback={sold?.clawback} />}

      <div className={TWO}>
        {!noSales && <SellersCard rows={sellers?.rows} />}
        <ExpiryExitsCard horizon={risk?.horizon} exits={exits?.items} />
      </div>

      {!noSales && (
        <div className={TWO}>
          <RankCard title="Planos" question="Valor vendido no mês, por plano." help={HELP.plans} items={plans?.items} total={plans?.total} />
          <RankCard title="Origem das vendas" question="De onde veio o lead que fechou." help={HELP.sources} items={sources?.items} total={sources?.total} />
        </div>
      )}
    </div>
  );
}
