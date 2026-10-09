// Entrada de leads (spec 2026-10-09, submenu 1): o total com a variação, os
// recortes por origem, consultor e funil, e a lista. Cada linha de recorte
// filtra a lista. Desenhada com a skill frontend-design.
//
// Os recortes ficam numa coluna no celular, em duas a partir de sm e em três
// só a partir de xl: com a lista de relatórios ao lado, o lg:grid-cols-3 deixava
// uns 33px para o nome a 1280px e nenhum a 1024px. O listId vem da tela e diz
// que lista é esta (o submenu mais o endereço), para o "Mostrar mais" voltar
// aos 50 primeiros quando o filtro ou o período mudam.
import { cn } from '../../lib/utils.js';
import { LeadLink } from '../../components/nav/AppLink.jsx';
import { fmtDate } from '../../lib/relatorios/leads/base.js';
import { ReportHeader, HeroNumber, CountBreakdown, ReportList } from './ReportParts.jsx';

const SITUACAO_TONE = Object.freeze({
  Cliente: 'text-emerald-700 dark:text-emerald-400',
  Perdido: 'text-rose-700 dark:text-rose-400',
});

const COLUMNS = [
  {
    key: 'nome',
    label: 'Nome',
    render: (r) => (
      <LeadLink leadId={r.id} className="font-semibold text-foreground hover:text-brand-700 hover:underline dark:hover:text-brand-300">
        {r.name}
      </LeadLink>
    ),
  },
  { key: 'origem', label: 'Origem', render: (r) => r.source },
  { key: 'consultor', label: 'Consultor', render: (r) => r.owner },
  { key: 'funil', label: 'Funil', render: (r) => r.funnel },
  { key: 'etapa', label: 'Etapa', render: (r) => r.stage },
  { key: 'cadastro', label: 'Cadastro', className: 'num whitespace-nowrap', render: (r) => fmtDate(r.createdAt) },
  {
    key: 'situacao',
    label: 'Situação',
    render: (r) => <span className={cn('font-semibold', SITUACAO_TONE[r.situation])}>{r.situation}</span>,
  },
];

export function EntradaSection({ report, cmp, listId, onCut, exportAction }) {
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
        compareText={cmp ? `vs. ${cmp.label}` : null}
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
        columns={COLUMNS}
        rows={report.rows}
        emptyTitle={report.cut ? 'Nenhum lead neste filtro.' : 'Nenhum lead chegou neste período.'}
        emptyText={report.cut ? 'Limpe o filtro da lista para ver todos.' : 'Escolha outro período ou limpe os filtros.'}
      />
    </div>
  );
}
