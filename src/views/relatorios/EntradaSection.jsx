// Entrada de leads (spec 2026-10-09, submenu 1): o total com a variação, os
// recortes por origem, consultor e funil, e a lista. Cada linha de recorte
// filtra a lista. Desenhada com a skill frontend-design.
//
// Os recortes ficam numa coluna no celular, em duas a partir de sm e em três
// só a partir de xl: com a lista de relatórios ao lado, o lg:grid-cols-3 deixava
// uns 33px para o nome a 1280px e nenhum a 1024px. O listId vem da tela e diz
// que lista é esta (o submenu mais o endereço), para o "Mostrar mais" voltar
// aos 50 primeiros quando o filtro ou o período mudam.
//
// A lista não quebra linha: situação e etapa ficam numa linha só, origem,
// consultor e funil cortam em 9rem com o texto inteiro no title, o nome do lead
// não encolhe de 10rem, e a data do ano de agora sai sem o ano ("02/09"). O year
// é o ano de agora, que a tela manda; a planilha continua com a data inteira. O
// compareText é o texto do comparado ("vs. Agosto 2026"), que a tela monta com o
// período e o comparado dos números que estão na tela.
import { cn } from '../../lib/utils.js';
import { LeadLink } from '../../components/nav/AppLink.jsx';
import { fmtScreenDate } from '../../lib/relatorios/leads/base.js';
import { ReportHeader, HeroNumber, CountBreakdown, ReportList, CellText, GREEN_TEXT } from './ReportParts.jsx';

const SITUACAO_TONE = Object.freeze({
  Cliente: GREEN_TEXT,
  Perdido: 'text-rose-700 dark:text-rose-400',
});

const columnsOf = (year) => [
  {
    key: 'nome',
    label: 'Nome',
    className: 'min-w-[10rem]',
    render: (r) => (
      <LeadLink leadId={r.id} className="font-semibold text-foreground hover:text-brand-700 hover:underline dark:hover:text-brand-300">
        {r.name}
      </LeadLink>
    ),
  },
  { key: 'origem', label: 'Origem', render: (r) => <CellText text={r.source} /> },
  { key: 'consultor', label: 'Consultor', render: (r) => <CellText text={r.owner} /> },
  { key: 'funil', label: 'Funil', render: (r) => <CellText text={r.funnel} /> },
  { key: 'etapa', label: 'Etapa', className: 'whitespace-nowrap', render: (r) => r.stage },
  { key: 'cadastro', label: 'Cadastro', className: 'num whitespace-nowrap', render: (r) => fmtScreenDate(r.createdAt, year) },
  {
    key: 'situacao',
    label: 'Situação',
    className: 'whitespace-nowrap',
    render: (r) => <span className={cn('font-semibold', SITUACAO_TONE[r.situation])}>{r.situation}</span>,
  },
];

export function EntradaSection({ report, compareText, listId, year, onCut, exportAction }) {
  return (
    <div className="flex flex-col gap-5">
      <ReportHeader
        title="Entrada de leads"
        question="Quantos leads chegaram no período, de onde e para qual consultor."
        action={exportAction}
      />
      <HeroNumber
        value={report.total}
        label={report.total === 1 ? 'lead novo' : 'leads novos'}
        delta={report.delta}
        compareText={compareText}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <CountBreakdown title="Por origem" rows={report.bySource} cut={report.cut} onCut={onCut} />
        <CountBreakdown title="Por consultor" rows={report.byOwner} cut={report.cut} onCut={onCut} />
        <CountBreakdown title="Por funil" rows={report.byFunnel} cut={report.cut} onCut={onCut} />
      </div>
      <ReportList
        listId={listId}
        total={report.rows.length}
        noun={report.rows.length === 1 ? 'lead' : 'leads'}
        cutLabel={report.cutLabel}
        onClearCut={() => onCut(null)}
        columns={columnsOf(year)}
        rows={report.rows}
        emptyTitle={report.cut ? 'Nenhum lead neste filtro.' : 'Nenhum lead chegou neste período.'}
        emptyText={report.cut ? 'Limpe o filtro da lista para ver todos.' : 'Escolha outro período ou limpe os filtros.'}
      />
    </div>
  );
}
