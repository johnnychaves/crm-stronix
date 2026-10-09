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
import { cn } from '../../lib/utils.js';
import { LeadLink } from '../../components/nav/AppLink.jsx';
import { fmtDuration } from '../../lib/crm/format.js';
import { fmtDate } from '../../lib/relatorios/leads/base.js';
import { OUTCOME_LABEL } from '../../lib/relatorios/leads/conversao.js';
import { ReportHeader, HeroNumber, NumberTiles, ConversionBreakdown, ReportList, ReportNotice } from './ReportParts.jsx';

const OUTCOME_TONE = Object.freeze({
  enrolled: 'text-emerald-700 dark:text-emerald-400',
  lost: 'text-rose-700 dark:text-rose-400',
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
  { key: 'cadastro', label: 'Cadastro', className: 'num whitespace-nowrap', render: (r) => fmtDate(r.createdAt) },
  {
    key: 'contato',
    label: '1º contato',
    className: 'num whitespace-nowrap',
    render: (r) => (r.firstContactMin == null
      ? <span className="text-muted-foreground">Sem contato</span>
      : fmtDuration(r.firstContactMin)),
  },
  { key: 'agendou', label: 'Agend.', render: (r) => (r.booked ? 'Sim' : 'Não') },
  { key: 'veio', label: 'Veio', render: (r) => (r.attended ? 'Sim' : 'Não') },
  {
    key: 'desfecho',
    label: 'Desfecho',
    className: 'whitespace-nowrap',
    render: (r) => (
      <span className={cn('font-semibold', OUTCOME_TONE[r.outcome])}>
        {r.outcomeAt ? `${OUTCOME_LABEL[r.outcome]} em ${fmtDate(r.outcomeAt)}` : OUTCOME_LABEL[r.outcome]}
      </span>
    ),
  },
];

export function ConversaoSection({ report, cmp, listId, onCut, exportAction, apptsPartial = false }) {
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
        compareText={cmp ? `vs. ${cmp.label}` : null}
      />
      {apptsPartial && (
        <ReportNotice>
          Antes de setembro de 2026, os agendamentos estão incompletos: a visita só tem registro desde 18/08/2026.
        </ReportNotice>
      )}
      <NumberTiles tiles={report.tiles} cut={report.cut} onCut={onCut} />
      <div className="grid gap-4 xl:grid-cols-2">
        <ConversionBreakdown title="Por origem" rows={report.bySource} cut={report.cut} onCut={onCut} />
        <ConversionBreakdown title="Por consultor" rows={report.byOwner} cut={report.cut} onCut={onCut} />
        <ConversionBreakdown
          title="Rapidez do primeiro contato"
          hint="Do cadastro à primeira conversa registrada."
          rows={report.bySpeed}
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
        columns={COLUMNS}
        rows={report.rows}
        emptyTitle={report.cut ? 'Nenhum lead neste filtro.' : 'Nenhum lead chegou neste período.'}
        emptyText={report.cut ? 'Limpe o filtro da lista para ver todos.' : 'Escolha outro período ou limpe os filtros.'}
      />
    </div>
  );
}
