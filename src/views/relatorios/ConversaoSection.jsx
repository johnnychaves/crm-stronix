// Conversão (spec 2026-10-09, submenu 2): a conversão da safra com a variação,
// os números que filtram a lista (agendaram, vieram, matricularam, perderam,
// em aberto), os recortes por origem, consultor e rapidez do primeiro contato,
// e a lista. Desenhada com a skill frontend-design.
//
// Cada recorte da conversão tem quatro colunas (nome, leads, matrículas e a
// barra da conversão), então nunca ficam três lado a lado: uma coluna até xl e
// duas a partir dele. O listId vem da tela e diz que lista é esta (o submenu
// mais o endereço), para o "Mostrar mais" voltar aos 50 primeiros quando o
// filtro ou o período mudam.
//
// A lista não quebra linha, como a da Entrada: as colunas de sim ou não, o
// primeiro contato e o desfecho ficam numa linha só, origem e consultor cortam
// em 9rem com o texto inteiro no title, o nome do lead não encolhe de 10rem, e a
// data do ano de agora sai sem o ano ("02/09", "Matriculou em 05/09"). O
// primeiro contato diz quanto levou e em que dia ("30 min · 02/09"). O year é o
// ano de agora, que a tela manda. O compareText é o texto do comparado ("vs.
// Agosto 2026"), que a tela monta com o período e o comparado dos números que
// estão na tela.
import { cn } from '../../lib/utils.js';
import { LeadLink } from '../../components/nav/AppLink.jsx';
import { fmtDuration } from '../../lib/crm/format.js';
import { fmtScreenDate } from '../../lib/relatorios/leads/base.js';
import { OUTCOME_LABEL } from '../../lib/relatorios/leads/conversao.js';
import {
  ReportHeader, HeroNumber, NumberTiles, ConversionBreakdown, ReportList, ReportNotice, CellText, GREEN_TEXT,
} from './ReportParts.jsx';

const OUTCOME_TONE = Object.freeze({
  enrolled: GREEN_TEXT,
  lost: 'text-rose-700 dark:text-rose-400',
});

// "30 min · 02/09": quanto levou até o primeiro contato e em que dia ele foi.
const firstContactText = (r, year) => {
  const day = fmtScreenDate(r.firstContactAt, year);
  return day ? `${fmtDuration(r.firstContactMin)} · ${day}` : fmtDuration(r.firstContactMin);
};

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
  { key: 'cadastro', label: 'Cadastro', className: 'num whitespace-nowrap', render: (r) => fmtScreenDate(r.createdAt, year) },
  {
    key: 'contato',
    label: '1º contato',
    className: 'num whitespace-nowrap',
    render: (r) => (r.firstContactMin == null
      ? <span className="text-muted-foreground">Sem contato</span>
      : firstContactText(r, year)),
  },
  { key: 'agendou', label: 'Agend.', className: 'whitespace-nowrap', render: (r) => (r.booked ? 'Sim' : 'Não') },
  { key: 'veio', label: 'Veio', className: 'whitespace-nowrap', render: (r) => (r.attended ? 'Sim' : 'Não') },
  {
    key: 'desfecho',
    label: 'Desfecho',
    className: 'whitespace-nowrap',
    render: (r) => (
      <span className={cn('font-semibold', OUTCOME_TONE[r.outcome])}>
        {r.outcomeAt ? `${OUTCOME_LABEL[r.outcome]} em ${fmtScreenDate(r.outcomeAt, year)}` : OUTCOME_LABEL[r.outcome]}
      </span>
    ),
  },
];

export function ConversaoSection({ report, compareText, listId, year, onCut, exportAction, apptsPartial = false }) {
  return (
    <div className="flex flex-col gap-5">
      <ReportHeader
        title="Conversão"
        question="Dos leads que chegaram no período, quantos viraram matrícula até agora."
        action={exportAction}
      />
      <HeroNumber
        value={report.conversion.value}
        percent
        tone="good"
        label="de conversão da safra"
        delta={report.conversion.delta}
        compareText={compareText}
      />
      {apptsPartial && (
        <ReportNotice>
          Antes de setembro de 2026, os agendamentos estão incompletos: a visita só tem registro desde 18/08/2026.
          {' '}
          Quando o período ou o comparado começa antes disso, a variação de Agendaram e Vieram fica sem base.
        </ReportNotice>
      )}
      <NumberTiles tiles={report.tiles} cut={report.cut} onCut={onCut} />
      <div className="grid gap-4 xl:grid-cols-2">
        <ConversionBreakdown title="Por origem" rows={report.bySource} cut={report.cut} onCut={onCut} />
        <ConversionBreakdown title="Por consultor" rows={report.byOwner} cut={report.cut} onCut={onCut} />
        {/* As quatro faixas existem sempre, mas sem leads no período o cartão diz
            "Nada no período." como os outros dois, em vez de quatro linhas zeradas. */}
        <ConversionBreakdown
          title="Rapidez do primeiro contato"
          hint="Do cadastro à primeira conversa registrada."
          rows={report.totals.leads > 0 ? report.bySpeed : []}
          cut={report.cut}
          onCut={onCut}
        />
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
