// Visitas e aulas experimentais (spec 2026-10-09, submenu 3), no desenho do
// handoff (docs/superpowers/specs/handoff-relatorios/): um painel com o
// comparecimento e os cinco números que filtram a lista (marcados, vieram,
// faltaram, sem desfecho e a acontecer), os recortes em abas (tipo, professor,
// consultor, unidade e modalidade) e a lista dos agendamentos.
//
// A aba aberta segue o recorte do endereço (useCutTab): quem chega por um link
// com professor:<id> vê a aba Por professor, e sem recorte de aba vale a
// primeira. Trocar de relatório remonta a seção e volta à primeira aba.
//
// A visita guarda a unidade e a aula guarda a modalidade e o professor, então a
// célula do que não se aplica é um traço apagado. A linha é um agendamento: o
// link vai para a ficha do lead dele (leadId). O lead não encontrado
// (lead.unknown: excluído, ainda carregando ou com a leitura que falhou) fica só
// com o nome do registro, sem link, porque a ficha pode não abrir.
import { fmtScreenDateTime } from '../../lib/relatorios/leads/base.js';
import { OUTCOME_LABEL, TIPO_LABEL } from '../../lib/relatorios/leads/visitas.js';
import {
  ReportHeader, ReportBand, CutTabs, ReportList, ReportNotice, CellText, StatusPill, NameCell,
} from './ReportParts.jsx';
import { useCutTab } from './useCutTab.js';

const OUTCOME_TONE = Object.freeze({ veio: 'emerald', faltou: 'rose', 'sem-desfecho': 'amber', 'a-acontecer': 'slate' });
const TILE_TONE = Object.freeze({ Vieram: 'emerald', Faltaram: 'rose', 'Sem desfecho': 'amber' });
const TILE_NOTE = Object.freeze({ 'Sem desfecho': 'ninguém marcou', 'A acontecer': 'data ainda vem' });
const TIPO_CURTO = Object.freeze({ [TIPO_LABEL.aula]: 'Aula' });

// O traço da célula que não se aplica ao tipo do agendamento. O leitor de tela
// ouve "não se aplica" no lugar do traço.
const NotApplicable = () => (
  <span className="text-muted-foreground">
    <span aria-hidden="true">—</span>
    <span className="sr-only">não se aplica</span>
  </span>
);
const textOrDash = (text) => (text == null ? <NotApplicable /> : <CellText text={text} />);

const columnsOf = (year) => [
  {
    key: 'nome',
    label: 'Nome',
    className: 'min-w-[10rem]',
    render: (r) => (r.lead.unknown
      ? <span className="block max-w-[16rem] truncate text-[13px] font-semibold text-foreground" title={r.name}>{r.name}</span>
      : <NameCell id={r.leadId} name={r.name} />),
  },
  { key: 'tipo', label: 'Tipo', className: 'whitespace-nowrap', render: (r) => TIPO_CURTO[r.type] ?? r.type },
  { key: 'diaHora', label: 'Dia e hora', className: 'num whitespace-nowrap', render: (r) => fmtScreenDateTime(r.at, year) },
  { key: 'unidade', label: 'Unidade', render: (r) => textOrDash(r.unit) },
  { key: 'modalidade', label: 'Modalidade', render: (r) => textOrDash(r.modality) },
  { key: 'professor', label: 'Professor', render: (r) => textOrDash(r.professor) },
  { key: 'consultor', label: 'Consultor', render: (r) => <CellText text={r.owner} /> },
  {
    key: 'desfecho',
    label: 'Desfecho',
    className: 'whitespace-nowrap',
    render: (r) => <StatusPill tone={OUTCOME_TONE[r.outcome]}>{OUTCOME_LABEL[r.outcome]}</StatusPill>,
  },
];

// O título e a pergunta, na tela e na folha impressa.
const HEADING = Object.freeze({
  title: 'Visitas e aulas experimentais',
  question: 'As visitas e aulas experimentais marcadas para o período e o que aconteceu em cada uma.',
});

export function VisitasSection({ report, compareText, listId, year, onCut, exportAction, apptsPartial = false }) {
  const tabs = [
    { value: 'tipo', label: 'Visita ou aula', rows: report.byType },
    {
      value: 'professor',
      label: 'Por professor',
      kind: 'conv',
      rows: report.byProfessor,
      countLabel: 'Aulas',
      countNoun: ['aula', 'aulas'],
      hint: 'só aulas experimentais · quantos matricularam depois da aula',
      emptyText: 'Nenhuma aula experimental com o lead presente no período.',
    },
    { value: 'consultor', label: 'Por consultor', rows: report.byOwner },
    { value: 'unidade', label: 'Por unidade', rows: report.byUnit, hint: 'só visitas' },
    { value: 'modalidade', label: 'Por modalidade', rows: report.byModality, hint: 'só aulas experimentais' },
  ];
  const [tab, setTab] = useCutTab(tabs, report.cut);

  const cells = report.tiles.map((t) => ({
    key: t.name,
    label: t.name,
    value: t.value,
    tone: TILE_TONE[t.name] ?? 'neutral',
    delta: t.delta,
    lowerBetter: t.lowerBetter,
    // Marcados é o filtro vazio: aceso sem recorte, e o clique limpa.
    note: t.key == null && report.running ? 'com os que virão' : TILE_NOTE[t.name] ?? '',
    title: t.key == null && report.running ? 'Inclui os agendamentos que vão acontecer, por isso fica sem variação.' : undefined,
    active: t.key == null ? report.cut == null : report.cut === t.key,
    onClick: () => onCut(t.key == null || report.cut === t.key ? null : t.key),
  }));

  return (
    <div className="flex flex-col gap-5">
      <ReportHeader {...HEADING} action={exportAction} />
      <ReportBand
        label="Comparecimento"
        value={report.attendance.value}
        percent
        tone="emerald"
        delta={report.attendance.delta}
        sub={compareText ? `vieram ÷ (vieram + faltaram) · ${compareText}` : 'vieram ÷ (vieram + faltaram)'}
        cells={cells}
      />
      {apptsPartial && (
        <ReportNotice>
          Antes de setembro de 2026, os agendamentos estão incompletos: a visita só tem registro desde 18/08/2026.
          {' '}
          Quando o período ou o comparado começa antes disso, a variação dos números aparece como &quot;sem base&quot;.
        </ReportNotice>
      )}
      <CutTabs
        tabs={tabs}
        value={tab}
        onValueChange={setTab}
        activeRow={report.cut}
        onRow={onCut}
      />
      <ReportList
        listId={listId}
        total={report.rows.length}
        noun={report.rows.length === 1 ? 'agendamento' : 'agendamentos'}
        cutLabel={report.cutLabel}
        onClearCut={() => onCut(null)}
        columns={columnsOf(year)}
        rows={report.rows}
        heading={HEADING}
      />
    </div>
  );
}
