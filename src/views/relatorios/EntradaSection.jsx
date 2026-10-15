// Entrada de leads (spec 2026-10-09, submenu 1), no desenho do handoff
// (docs/superpowers/specs/handoff-relatorios/): o painel com o total, a
// variação e o gráfico por dia de cadastro, os recortes em abas (origem,
// consultor e funil) e a lista. Cada linha de recorte filtra a lista.
//
// O gráfico é o total distribuído pelo dia do cadastro (porDia), então ele sai
// das linhas sem o recorte da lista (allRows): filtrar a lista não muda o total
// nem o gráfico. O listId vem da tela e diz que lista é esta, para o "Mostrar
// mais" voltar aos 50 primeiros quando o filtro ou o período mudam. A lista não
// quebra linha: origem, consultor e funil cortam em 9rem com o texto inteiro no
// title, e a data do ano de agora sai sem o ano ("02/09").
import { fmtScreenDate } from '../../lib/relatorios/leads/base.js';
import { porDia } from '../../lib/relatorios/leads/porDia.js';
import { ReportHeader, ReportBand, CutTabs, ReportList, StatusPill, NameCell, CellText } from './ReportParts.jsx';
import { useCutTab } from './useCutTab.js';

const SITUACAO_TONE = Object.freeze({ Cliente: 'emerald', Perdido: 'rose' });

const columnsOf = (year) => [
  { key: 'nome', label: 'Nome', className: 'min-w-[10rem]', render: (r) => <NameCell id={r.id} name={r.name} /> },
  { key: 'origem', label: 'Origem', render: (r) => <CellText text={r.source} /> },
  { key: 'consultor', label: 'Consultor', render: (r) => <CellText text={r.owner} /> },
  { key: 'funil', label: 'Funil', render: (r) => <CellText text={r.funnel} /> },
  { key: 'etapa', label: 'Etapa', className: 'whitespace-nowrap', render: (r) => r.stage },
  { key: 'cadastro', label: 'Cadastro', className: 'num whitespace-nowrap', render: (r) => fmtScreenDate(r.createdAt, year) },
  {
    key: 'situacao',
    label: 'Situação',
    className: 'whitespace-nowrap',
    render: (r) => <StatusPill tone={SITUACAO_TONE[r.situation] ?? 'slate'}>{r.situation}</StatusPill>,
  },
];

export function EntradaSection({ report, compareText, listId, year, onCut, exportAction, allRows, period, now }) {
  const tabs = [
    { value: 'origem', label: 'Por origem', rows: report.bySource },
    { value: 'consultor', label: 'Por consultor', rows: report.byOwner },
    { value: 'funil', label: 'Por funil', rows: report.byFunnel },
  ];
  const [tab, onTab] = useCutTab(tabs, report.cut);
  const days = period && now ? porDia(allRows ?? report.rows, period, (r) => r.createdAt, now) : null;
  return (
    <div className="flex flex-col gap-4">
      <ReportHeader
        title="Entrada de leads"
        question="Quantos leads chegaram no período, de onde e para qual consultor."
        action={exportAction}
      />
      <ReportBand
        label={report.total === 1 ? 'Lead novo' : 'Leads novos'}
        value={report.total}
        delta={report.delta}
        sub={compareText}
        chart={days && { days, label: 'Por dia de cadastro', unit: ['lead', 'leads'] }}
      />
      <CutTabs tabs={tabs} value={tab} onValueChange={onTab} activeRow={report.cut} onRow={onCut} />
      <ReportList
        listId={listId}
        total={report.rows.length}
        noun={report.rows.length === 1 ? 'lead' : 'leads'}
        cutLabel={report.cutLabel}
        onClearCut={() => onCut(null)}
        columns={columnsOf(year)}
        rows={report.rows}
      />
    </div>
  );
}
