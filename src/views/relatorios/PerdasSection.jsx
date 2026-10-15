// Perdas (spec 2026-10-09, submenu 4): o total com a variação (cair é bom), o
// aviso fixo de quem volta ao funil, os recortes por motivo, etapa, origem e
// consultor, e a lista de repescagem. Desenhada com a skill frontend-design, no
// molde da Entrada de leads.
//
// O número grande não leva cor: um zero vermelho diria que algo deu errado. A
// variação diz se piorou ou melhorou (lowerBetter). Os quatro recortes ficam em
// duas colunas a partir de sm. A etapa só é gravada desde 14/09/2026: o período
// que acaba antes fica sem base (o cartão, a lista e a planilha dizem
// STAGE_NO_BASE_TEXT), e o que atravessa a data diz que é parcial.
//
// A lista não quebra linha, como as outras: motivo, etapa, origem e consultor
// cortam em 9rem com o texto inteiro no title, e a perda diz o dia e há quanto
// tempo ("12/09 · há 8 dias").
import { LeadLink } from '../../components/nav/AppLink.jsx';
import { fmtScreenDate, STAGE_SINCE_TEXT } from '../../lib/relatorios/leads/base.js';
import { STAGE_NO_BASE_TEXT } from '../../lib/relatorios/leads/perdas.js';
import { plural } from '../../lib/crm/format.js';
import { ReportHeader, HeroNumber, CountBreakdown, ReportList, ReportNotice, CellText } from './ReportParts.jsx';

const sinceText = (days) => (days === 0 ? 'hoje' : `há ${plural(days, 'dia', 'dias')}`);

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
  { key: 'motivo', label: 'Motivo', render: (r) => <CellText text={r.reason} /> },
  { key: 'etapa', label: 'Etapa', render: (r) => <CellText text={r.stage} /> },
  {
    key: 'perda',
    label: 'Perda',
    className: 'num whitespace-nowrap',
    render: (r) => `${fmtScreenDate(r.lostAt, year)} · ${sinceText(r.days)}`,
  },
  { key: 'origem', label: 'Origem', render: (r) => <CellText text={r.source} /> },
  { key: 'consultor', label: 'Consultor', render: (r) => <CellText text={r.owner} /> },
];

const STAGE_HINT = Object.freeze({
  partial: `Parcial: a etapa só é gravada desde ${STAGE_SINCE_TEXT}. As perdas de antes ficam em Sem etapa.`,
});

export function PerdasSection({ report, compareText, listId, year, onCut, exportAction }) {
  return (
    <div className="flex flex-col gap-5">
      <ReportHeader
        title="Perdas"
        question="Quantos leads se perderam no período, por qual motivo e em que etapa."
        action={exportAction}
      />
      <HeroNumber
        value={report.total}
        label={report.total === 1 ? 'perda' : 'perdas'}
        delta={report.delta}
        lowerBetter
        compareText={compareText}
      />
      <ReportNotice>
        Esta conta mostra só quem continua perdido hoje. Quando um lead perdido volta ao funil ou matricula, o sistema apaga a data e o motivo da perda, e ele sai daqui.
      </ReportNotice>
      <div className="grid gap-4 sm:grid-cols-2">
        <CountBreakdown title="Por motivo" rows={report.byReason} cut={report.cut} onCut={onCut} />
        <CountBreakdown
          title="Por etapa"
          hint={STAGE_HINT[report.stageBase]}
          rows={report.byStage}
          cut={report.cut}
          onCut={onCut}
          emptyText={report.stageBase === 'none' ? `${STAGE_NO_BASE_TEXT}: a etapa da perda só é gravada desde ${STAGE_SINCE_TEXT}.` : 'Nada no período.'}
        />
        <CountBreakdown title="Por origem" rows={report.bySource} cut={report.cut} onCut={onCut} />
        <CountBreakdown title="Por consultor" rows={report.byOwner} cut={report.cut} onCut={onCut} />
      </div>
      <ReportList
        listId={listId}
        total={report.rows.length}
        noun={report.rows.length === 1 ? 'lead' : 'leads'}
        cutLabel={report.cutLabel}
        onClearCut={() => onCut(null)}
        columns={columnsOf(year)}
        rows={report.rows}
        emptyTitle={report.cut ? 'Nenhum lead neste filtro.' : 'Nenhuma perda neste período.'}
        emptyText={report.cut ? 'Limpe o filtro da lista para ver todos.' : 'Escolha outro período ou limpe os filtros.'}
      />
    </div>
  );
}
