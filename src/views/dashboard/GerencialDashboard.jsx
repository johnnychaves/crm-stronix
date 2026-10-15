// Corpo da tela Gerencial, só apresentação (handoff v2, §1): quatro linhas por
// ordem de importância. Os quatro números no topo, a venda no meio, o risco
// detalhado e, por último, planos e origem. Recebe as métricas prontas de
// DashboardGerencialView e não calcula nada; cada card deriva do próprio
// detalhe o que precisa mostrar.
//
// Props:
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
import { GerencialKpis } from './GerencialKpis.jsx';
import { SalesTypeCard, PieCard } from './GerencialPies.jsx';
import { SellersCard, ExpiryCard, ExitsCard, ChurnCard } from './GerencialRows.jsx';
import { GerencialEmpty } from './GerencialParts.jsx';

const ROW_2 = 'grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]';
const ROW_3 = 'grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]';
const ROW_4 = 'grid grid-cols-1 gap-4 xl:grid-cols-2';

export function GerencialDashboard({ sold, wallet, risk, exits, churn, sellers, plans, sources, flags, texts, onGoToPipeline }) {
  // A academia sem contrato nenhum troca o CORPO INTEIRO por um painel só: nem
  // card de zeros, nem tabela com zero linhas.
  if (flags?.gymEmpty) {
    return (
      <div className="px-4 pb-8 pt-[22px] md:px-8">
        <GerencialEmpty onGoToPipeline={onGoToPipeline} />
      </div>
    );
  }

  // Mês sem venda esvazia só o que descreve a venda do mês (linhas 2 e 4).
  // Carteira, risco e saídas seguem inteiros, porque olham contratos vigentes.
  const noSales = Boolean(flags?.monthNoSales);

  return (
    <div className="flex flex-col gap-5 px-4 pb-8 pt-[22px] md:px-8">
      <GerencialKpis sold={sold} wallet={wallet} risk={risk} />

      {noSales ? (
        <div className="rounded-2xl border border-border bg-card px-7 py-7 text-center shadow-card">
          <div className="text-[13.5px] font-semibold">{texts?.emptyMonth?.title}</div>
          {texts?.emptyMonth?.text && (
            <p className="mx-auto mt-1.5 max-w-[520px] text-pretty text-[12.5px] leading-relaxed text-muted-foreground">{texts.emptyMonth.text}</p>
          )}
        </div>
      ) : (
        <div className={ROW_2}>
          <SalesTypeCard mix={sold?.mix} discount={sold?.discount} clawback={sold?.clawback} />
          <SellersCard rows={sellers?.rows} />
        </div>
      )}

      <div className={ROW_3}>
        <ExpiryCard horizon={risk?.horizon} />
        <div className="flex flex-col gap-4">
          <ChurnCard churn={churn} />
          <ExitsCard items={exits?.items} />
        </div>
      </div>

      {!noSales && (
        <div className={ROW_4}>
          <PieCard title="Planos" variant="pie" items={plans?.items} total={plans?.total} />
          <PieCard title="Origem das vendas" variant="half" items={sources?.items} total={sources?.total} />
        </div>
      )}
    </div>
  );
}
