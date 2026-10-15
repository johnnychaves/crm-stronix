// Conversão (spec 2026-10-09, submenu 2), no desenho do handoff
// (docs/superpowers/specs/handoff-relatorios/): o painel com a conversão da
// safra e as etapas ligadas por seta (Leads da safra, Agendaram, Vieram,
// Matricularam), depois de uma régua Perderam e Em aberto, que não são etapa.
// Cada célula filtra a lista, e clicar de novo limpa. Embaixo, os recortes em
// abas (origem, consultor e rapidez do primeiro contato) e a lista.
//
// O aviso dos agendamentos fica sob o painel, só quando o período ou o
// comparado começa antes de setembro de 2026. A lista não quebra linha, como a
// da Entrada, e o primeiro contato diz quanto levou e em que dia ("30 min ·
// 02/09"). O year é o ano de agora, que a tela manda.
import { fmtDuration } from '../../lib/crm/format.js';
import { fmtScreenDate } from '../../lib/relatorios/leads/base.js';
import { OUTCOME_LABEL } from '../../lib/relatorios/leads/conversao.js';
import { ReportHeader, ReportBand, CutTabs, ReportList, ReportNotice, StatusPill, NameCell, CellText } from './ReportParts.jsx';
import { useCutTab } from './useCutTab.js';

const OUTCOME_TONE = Object.freeze({ enrolled: 'emerald', lost: 'rose', open: 'slate' });

// O que cada número do painel desenha além do que a conta traz: a seta das
// etapas, a régua antes do que não é etapa, a cor e a nota no lugar da variação.
const CELL_LOOK = Object.freeze({
  'situacao:agendaram': { arrow: true },
  'situacao:vieram': { arrow: true },
  'situacao:matricularam': { arrow: true, tone: 'emerald' },
  'situacao:perderam': { rule: true },
  'situacao:em-aberto': { note: 'ainda no funil' },
});

// "30 min · 02/09": quanto levou até o primeiro contato e em que dia ele foi.
const firstContactText = (r, year) => {
  const day = fmtScreenDate(r.firstContactAt, year);
  return day ? `${fmtDuration(r.firstContactMin)} · ${day}` : fmtDuration(r.firstContactMin);
};

const yesNo = (yes) => <span className={yes ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{yes ? 'Sim' : 'Não'}</span>;

const columnsOf = (year) => [
  { key: 'nome', label: 'Nome', className: 'min-w-[10rem]', render: (r) => <NameCell id={r.id} name={r.name} /> },
  { key: 'origem', label: 'Origem', render: (r) => <CellText text={r.source} /> },
  { key: 'consultor', label: 'Consultor', render: (r) => <CellText text={r.owner} /> },
  { key: 'cadastro', label: 'Cadastro', className: 'num whitespace-nowrap', render: (r) => fmtScreenDate(r.createdAt, year) },
  {
    key: 'contato',
    label: '1º contato',
    className: 'num whitespace-nowrap',
    render: (r) => (r.firstContactMin == null
      ? <span className="text-muted-foreground">Sem contato</span>
      : firstContactText(r, year)),
  },
  { key: 'agendou', label: 'Agend.', className: 'whitespace-nowrap', render: (r) => yesNo(r.booked) },
  { key: 'veio', label: 'Veio', className: 'whitespace-nowrap', render: (r) => yesNo(r.attended) },
  {
    key: 'desfecho',
    label: 'Desfecho',
    className: 'whitespace-nowrap',
    render: (r) => (
      <StatusPill tone={OUTCOME_TONE[r.outcome]}>
        {r.outcomeAt ? `${OUTCOME_LABEL[r.outcome]} em ${fmtScreenDate(r.outcomeAt, year)}` : OUTCOME_LABEL[r.outcome]}
      </StatusPill>
    ),
  },
];

// O título e a pergunta, na tela e na folha impressa.
const HEADING = Object.freeze({
  title: 'Conversão',
  question: 'Dos leads que chegaram no período, quantos agendaram, vieram e se matricularam até hoje.',
});

export function ConversaoSection({ report, compareText, listId, year, onCut, exportAction, apptsPartial = false }) {
  const cells = report.tiles.map((t) => {
    const active = t.key === null ? report.cut === null : report.cut === t.key;
    return {
      key: t.key ?? 'total',
      label: t.name,
      value: t.value,
      delta: t.delta ?? null,
      lowerBetter: t.lowerBetter,
      active,
      onClick: () => onCut(t.key === null || active ? null : t.key),
      title: t.key === null ? 'Cadastrados no período, acompanhados até hoje' : undefined,
      ...CELL_LOOK[t.key],
    };
  });
  const tabs = [
    { value: 'origem', label: 'Por origem', kind: 'conv', rows: report.bySource },
    { value: 'consultor', label: 'Por consultor', kind: 'conv', rows: report.byOwner },
    // As quatro faixas existem sempre, mas sem leads no período a aba diz
    // "Nada no período." como as outras, em vez de quatro linhas zeradas.
    {
      value: 'rapidez',
      label: 'Rapidez do 1º contato',
      kind: 'conv',
      hint: 'do cadastro à primeira interação da equipe',
      rows: report.totals.leads > 0 ? report.bySpeed : [],
    },
  ];
  const [tab, onTab] = useCutTab(tabs, report.cut);
  const total = report.rows.length;
  return (
    <div className="flex flex-col gap-4">
      <ReportHeader {...HEADING} action={exportAction} />
      <div className="flex flex-col gap-2.5">
        <ReportBand
          label="Conversão da safra"
          value={report.conversion.value}
          percent
          tone="emerald"
          delta={report.conversion.delta}
          sub={compareText}
          cells={cells}
        />
        {apptsPartial && (
          <ReportNotice>
            Antes de setembro de 2026, os agendamentos estão incompletos: a visita só tem registro desde 18/08/2026.
            {' '}
            Quando o período ou o comparado começa antes disso, a variação de Agendaram e Vieram fica sem base.
          </ReportNotice>
        )}
      </div>
      <CutTabs tabs={tabs} value={tab} onValueChange={onTab} activeRow={report.cut} onRow={onCut} />
      <ReportList
        listId={listId}
        total={total}
        noun={total === 1 ? 'lead da safra' : 'leads da safra'}
        cutLabel={report.cutLabel}
        onClearCut={() => onCut(null)}
        columns={columnsOf(year)}
        rows={report.rows}
        heading={HEADING}
      />
    </div>
  );
}
