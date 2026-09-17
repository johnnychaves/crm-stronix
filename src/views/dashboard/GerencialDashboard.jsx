// Corpo da tela Gerencial, só apresentação (handoff do Gerencial, linhas 131 a
// 502): as quatro seções, na ordem das quatro perguntas — vendi, tenho, posso
// perder, quem trouxe. Recebe as métricas prontas de DashboardGerencialView e
// não calcula nada; cada card deriva do próprio detalhe o que precisa mostrar.
//
// As seções usam CrmSection e DashedNote de CrmParts.jsx de propósito: o
// handoff pede a MESMA gramática de seção das telas irmãs, título de 16px com a
// pergunta ao lado sobre régua de 2px, e o cartão tracejado dos vazios.
//
// Props:
//   sold     { mix, delta, ticket, discount, clawback }
//   wallet   { items, notes }
//   risk     { horizon, walletMonthly, lapsedCount }
//   exits    { items }
//   sellers  { rows, read }
//   plans    { items, total, eyebrow, sub, footText } — count é dinheiro e
//   sources  times é o número de vendas, que vira "11x" na legenda
//   flags    { gymEmpty, monthNoSales }
//   texts    { emptyMonth, emptyRanking }, cada um { title, text }
import { Route, Tag } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { BreakdownCard } from './DashPrimitives.jsx';
import { CrmSection, DashedNote } from './CrmParts.jsx';
import { SoldHeroCard } from './SoldHeroCard.jsx';
import { WalletBand } from './WalletBand.jsx';
import { ExpiryRunway } from './ExpiryRunway.jsx';
import { ExitsCard } from './ExitsCard.jsx';
import { SellerRankTable } from './SellerRankTable.jsx';
import { GerencialEmpty, LapsedCard } from './GerencialParts.jsx';
import { fmtMoneyShort } from './dashTokens.js';

const WIDE_NARROW = 'grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]';

// Planos e origem são o mesmo card de quebra do CRM, agora servindo dinheiro. A
// linha do líder sai dos próprios itens: "11 vendas · 34% do vendido", com a
// mesma conta de participação que o card já faz por dentro.
function MoneyBreakdown({ icon, title, data }) {
  const items = data?.items || [];
  const total = data?.total || 0;
  const leader = items[0];
  const leaderSub = leader
    ? `${fmtNum(leader.times)} ${leader.times === 1 ? 'venda' : 'vendas'} · ${total > 0 ? Math.round((leader.count / total) * 100) : 0}% do vendido`
    : null;
  return (
    <BreakdownCard
      icon={icon}
      title={title}
      sub={data?.sub}
      eyebrow={data?.eyebrow}
      items={items}
      total={total}
      footText={data?.footText}
      format={fmtMoneyShort}
      leaderSub={leaderSub}
      emptyText="Nenhuma venda no mês."
    />
  );
}

export function GerencialDashboard({ sold, wallet, risk, exits, sellers, plans, sources, flags, texts, onGoToPipeline }) {
  // Os dois vazios são diferentes (README §5). A academia sem contrato nenhum
  // troca o CORPO INTEIRO por um painel só: nem cabeçalho de seção, nem card de
  // zeros, nem tabela com zero linhas.
  if (flags?.gymEmpty) {
    return (
      <div className="px-4 pb-8 pt-5 md:px-8">
        <GerencialEmpty onGoToPipeline={onGoToPipeline} />
      </div>
    );
  }

  // Mês sem venda esvazia só o que descreve a venda do mês. Carteira e risco
  // seguem inteiros, porque olham contratos vigentes, não vendas do mês.
  const noSales = Boolean(flags?.monthNoSales);

  return (
    <div className="flex flex-col gap-[22px] px-4 pb-8 pt-5 md:px-8">
      <CrmSection title="Quanto vendi" question="contratos fechados no mês">
        {noSales ? (
          <DashedNote className="rounded-2xl" title={texts?.emptyMonth?.title} text={texts?.emptyMonth?.text} />
        ) : (
          <SoldHeroCard {...sold} />
        )}
      </CrmSection>

      <CrmSection title="A carteira hoje" question="o que os contratos vigentes geram por mês">
        <WalletBand items={wallet?.items} notes={wallet?.notes} />
      </CrmSection>

      <CrmSection title="Quanto posso perder" question="o que sai da carteira se ninguém renovar">
        {/* align-items start: cada card com a altura que tem, como no CRM. */}
        <div className={cn(WIDE_NARROW, 'items-start')}>
          <ExpiryRunway horizon={risk?.horizon} walletMonthly={risk?.walletMonthly} />
          <div className="flex flex-col gap-3.5">
            <LapsedCard count={risk?.lapsedCount} />
            <ExitsCard items={exits?.items} />
          </div>
        </div>
      </CrmSection>

      <CrmSection title="Quem traz receita" question="as vendas do mês por consultor, plano e origem">
        {noSales ? (
          <DashedNote className="rounded-2xl" title={texts?.emptyRanking?.title} text={texts?.emptyRanking?.text} />
        ) : (
          <div className="flex flex-col gap-3.5">
            <SellerRankTable rows={sellers?.rows} read={sellers?.read} />
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              <MoneyBreakdown icon={Tag} title="Planos mais vendidos" data={plans} />
              <MoneyBreakdown icon={Route} title="Origem do lead que fechou" data={sources} />
            </div>
          </div>
        )}
      </CrmSection>
    </div>
  );
}
