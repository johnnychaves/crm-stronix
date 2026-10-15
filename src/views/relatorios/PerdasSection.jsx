// Perdas (spec 2026-10-09, submenu 4), no desenho do handoff
// (docs/superpowers/specs/handoff-relatorios/): o painel com o total, a
// variação (cair é bom, então subir sai vermelho) e o gráfico por dia da perda,
// os avisos sob o painel, os recortes em abas (motivo, etapa, origem e
// consultor) e a lista de repescagem.
//
// O número grande não leva cor: um zero vermelho diria que algo deu errado. O
// gráfico é o total distribuído pelo dia da perda, das linhas sem o recorte da
// lista (allRows). A etapa só é gravada desde 14/09/2026: o período que acaba
// antes fica sem base (a aba, a lista e a planilha dizem STAGE_NO_BASE_TEXT), e
// o que atravessa a data diz que é parcial. O aviso de quem volta ao funil é
// fixo. A lista não quebra linha, e a perda diz o dia e há quanto tempo ("06/09"
// e "14 dias", ou "hoje").
import { fmtScreenDate, STAGE_SINCE_TEXT } from '../../lib/relatorios/leads/base.js';
import { STAGE_NO_BASE_TEXT } from '../../lib/relatorios/leads/perdas.js';
import { porDia } from '../../lib/relatorios/leads/porDia.js';
import { plural } from '../../lib/crm/format.js';
import { ReportHeader, ReportBand, CutTabs, ReportList, ReportNotice, NameCell, CellText } from './ReportParts.jsx';
import { useCutTab } from './useCutTab.js';

// Há quanto tempo foi a perda: "hoje" no próprio dia, nunca "0 dias".
const sinceText = (days) => (days == null ? '' : days <= 0 ? 'hoje' : plural(days, 'dia', 'dias'));

const columnsOf = (year) => [
  { key: 'nome', label: 'Nome', className: 'min-w-[10rem]', render: (r) => <NameCell id={r.id} name={r.name} /> },
  { key: 'motivo', label: 'Motivo', className: 'font-semibold text-foreground', render: (r) => <CellText text={r.reason} /> },
  {
    key: 'etapa',
    label: 'Etapa',
    render: (r) => (r.stage === STAGE_NO_BASE_TEXT ? <span className="text-muted-foreground">{r.stage}</span> : <CellText text={r.stage} />),
  },
  { key: 'perda', label: 'Perdeu em', className: 'num whitespace-nowrap', render: (r) => fmtScreenDate(r.lostAt, year) },
  { key: 'ha', label: 'Há', className: 'num whitespace-nowrap text-muted-foreground', render: (r) => sinceText(r.days) },
  { key: 'origem', label: 'Origem', render: (r) => <CellText text={r.source} /> },
  { key: 'consultor', label: 'Consultor', render: (r) => <CellText text={r.owner} /> },
];

const STAGE_NOTICE = Object.freeze({
  partial: `A etapa da perda só é gravada desde ${STAGE_SINCE_TEXT}. As perdas de antes ficam em Sem etapa.`,
  none: `A etapa da perda só é gravada desde ${STAGE_SINCE_TEXT}. Neste período ela fica como ${STAGE_NO_BASE_TEXT}.`,
});

// O título e a pergunta, na tela e na folha impressa.
const HEADING = Object.freeze({
  title: 'Perdas',
  question: 'Os leads perdidos no período, com o motivo e a etapa em que saíram.',
});

export function PerdasSection({ report, compareText, listId, year, onCut, exportAction, allRows, period, now }) {
  const tabs = [
    { value: 'motivo', label: 'Por motivo', rows: report.byReason },
    {
      value: 'etapa',
      label: 'Por etapa',
      rows: report.byStage,
      emptyText: report.stageBase === 'none'
        ? `${STAGE_NO_BASE_TEXT}: a etapa da perda só é gravada desde ${STAGE_SINCE_TEXT}.`
        : 'Nada no período.',
    },
    { value: 'origem', label: 'Por origem', rows: report.bySource },
    { value: 'consultor', label: 'Por consultor', rows: report.byOwner },
  ];
  const [tab, onTab] = useCutTab(tabs, report.cut);
  const days = period && now ? porDia(allRows ?? report.rows, period, (r) => r.lostAt, now) : null;
  const total = report.rows.length;
  return (
    <div className="flex flex-col gap-4">
      <ReportHeader {...HEADING} action={exportAction} />
      <div className="flex flex-col gap-2.5">
        <ReportBand
          label={report.total === 1 ? 'Perda' : 'Perdas'}
          value={report.total}
          delta={report.delta}
          lowerBetter
          sub={compareText}
          chart={days && { days, label: 'Por dia da perda', unit: ['perda', 'perdas'] }}
        />
        <ReportNotice>
          Esta conta mostra só quem continua perdido hoje. Quando um lead perdido volta ao funil ou matricula, o sistema apaga a data e o motivo da perda, e ele sai daqui.
        </ReportNotice>
        {STAGE_NOTICE[report.stageBase] && <ReportNotice>{STAGE_NOTICE[report.stageBase]}</ReportNotice>}
      </div>
      <CutTabs tabs={tabs} value={tab} onValueChange={onTab} activeRow={report.cut} onRow={onCut} />
      <ReportList
        listId={listId}
        total={total}
        noun={total === 1 ? 'lead perdido' : 'leads perdidos'}
        cutLabel={report.cutLabel}
        onClearCut={() => onCut(null)}
        columns={columnsOf(year)}
        rows={report.rows}
        heading={HEADING}
      />
    </div>
  );
}
