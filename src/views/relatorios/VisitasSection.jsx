// Visitas e aulas experimentais (spec 2026-10-09, submenu 3): o comparecimento
// com a variação, os cinco números que filtram a lista (marcados, vieram,
// faltaram, sem desfecho e a acontecer), os recortes por tipo, consultor,
// unidade e modalidade, e a lista dos agendamentos. Desenhada com a skill
// frontend-design, no molde da Conversão.
//
// Os cinco números ficam numa linha só a partir de xl (xl:grid-cols-5), sem a
// sexta coluna vazia da grade padrão. Os quatro recortes ficam em duas colunas a
// partir de sm, como uma grade dois por dois. A visita guarda a unidade e a aula
// guarda a modalidade e o professor, então cada cartão diz de quem é o dado, e a
// célula do que não se aplica é um traço apagado.
//
// A lista não quebra linha, como as outras: tipo, dia e hora e desfecho numa
// linha só, unidade, modalidade, professor e consultor cortam em 9rem com o
// texto inteiro no title, e o nome do lead não encolhe de 10rem. A linha é um
// agendamento: o link vai para a ficha do lead dele (leadId). O lead que não
// existe mais (lead.unknown) fica só com o nome do registro, sem link, porque a
// ficha dele não abriria. "Sem desfecho" é o único âmbar da lista, porque é o
// que ainda pede alguém marcar.
import { cn } from '../../lib/utils.js';
import { LeadLink } from '../../components/nav/AppLink.jsx';
import { fmtScreenDateTime } from '../../lib/relatorios/leads/base.js';
import { OUTCOME_LABEL } from '../../lib/relatorios/leads/visitas.js';
import {
  ReportHeader, HeroNumber, NumberTiles, CountBreakdown, ReportList, ReportNotice, CellText, GREEN_TEXT,
} from './ReportParts.jsx';

const OUTCOME_TONE = Object.freeze({
  veio: GREEN_TEXT,
  faltou: 'text-rose-700 dark:text-rose-400',
  'sem-desfecho': 'text-amber-700 dark:text-amber-300',
  'a-acontecer': 'text-muted-foreground',
});

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
      ? <span className="font-semibold text-foreground">{r.name}</span>
      : (
        <LeadLink leadId={r.leadId} className="font-semibold text-foreground hover:text-brand-700 hover:underline dark:hover:text-brand-300">
          {r.name}
        </LeadLink>
      )),
  },
  { key: 'tipo', label: 'Tipo', className: 'whitespace-nowrap', render: (r) => r.type },
  { key: 'diaHora', label: 'Dia e hora', className: 'num whitespace-nowrap', render: (r) => fmtScreenDateTime(r.at, year) },
  { key: 'unidade', label: 'Unidade', render: (r) => textOrDash(r.unit) },
  { key: 'modalidade', label: 'Modalidade', render: (r) => textOrDash(r.modality) },
  { key: 'professor', label: 'Professor', render: (r) => textOrDash(r.professor) },
  { key: 'consultor', label: 'Consultor', render: (r) => <CellText text={r.owner} /> },
  {
    key: 'desfecho',
    label: 'Desfecho',
    className: 'whitespace-nowrap',
    render: (r) => <span className={cn('font-semibold', OUTCOME_TONE[r.outcome])}>{OUTCOME_LABEL[r.outcome]}</span>,
  },
];

export function VisitasSection({ report, compareText, listId, year, onCut, exportAction, apptsPartial = false }) {
  return (
    <div className="flex flex-col gap-5">
      <ReportHeader
        title="Visitas e aulas experimentais"
        question="Quantos agendamentos o período teve, quem veio, quem faltou e quem ainda vem."
        action={exportAction}
      />
      <HeroNumber
        value={report.attendance.value}
        percent
        tone="good"
        label="de comparecimento"
        delta={report.attendance.delta}
        compareText={compareText}
      />
      {apptsPartial && (
        <ReportNotice>
          Antes de setembro de 2026, os agendamentos estão incompletos: a visita só tem registro desde 18/08/2026.
          {' '}
          Quando o período ou o comparado começa antes disso, os números ficam sem variação.
        </ReportNotice>
      )}
      <NumberTiles tiles={report.tiles} cut={report.cut} onCut={onCut} className="xl:grid-cols-5" />
      {report.running && (
        <p className="m-0 text-pretty text-[12px] text-muted-foreground">
          O período ainda está em andamento: Marcados inclui os agendamentos que vão acontecer e por isso fica sem variação.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <CountBreakdown title="Por tipo" rows={report.byType} cut={report.cut} onCut={onCut} />
        <CountBreakdown title="Por consultor" rows={report.byOwner} cut={report.cut} onCut={onCut} />
        <CountBreakdown title="Por unidade" hint="Só a visita guarda a unidade." rows={report.byUnit} cut={report.cut} onCut={onCut} />
        <CountBreakdown title="Por modalidade" hint="Só a aula experimental guarda a modalidade." rows={report.byModality} cut={report.cut} onCut={onCut} />
      </div>
      <ReportList
        listId={listId}
        total={report.rows.length}
        noun={report.rows.length === 1 ? 'agendamento' : 'agendamentos'}
        cutLabel={report.cutLabel}
        onClearCut={() => onCut(null)}
        columns={columnsOf(year)}
        rows={report.rows}
        emptyTitle={report.cut ? 'Nenhum agendamento neste filtro.' : 'Nenhum agendamento neste período.'}
        emptyText={report.cut ? 'Limpe o filtro da lista para ver todos.' : 'Escolha outro período ou limpe os filtros.'}
      />
    </div>
  );
}
