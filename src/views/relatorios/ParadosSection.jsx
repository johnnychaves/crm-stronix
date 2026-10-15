// Leads parados (spec 2026-10-09, submenu 5): quantos leads em aberto estão
// parados agora, os três números que filtram a lista (sem próximo passo,
// contato atrasado e sem registro há mais de N dias), o recorte por consultor e
// a lista. É retrato de agora: sem período, sem comparação e sem variação. O N
// vem do corte da barra. Desenhada com a skill frontend-design, no molde da
// Conversão.
//
// O número grande é a lista sem filtro, com cada lead uma vez, e o texto ao
// lado dá a base ("de 210 em aberto agora"). Os três números ficam numa linha a
// partir de sm (sm:grid-cols-3 e xl:grid-cols-3), sem as colunas vazias da
// grade padrão. Um lead pode estar em mais de um número, e a frase embaixo diz
// isso, porque a soma dos três passa do número grande.
//
// A lista não quebra linha: etapa, dias na etapa, último registro e próximo
// contato numa linha só, e o consultor corta em 9rem. O atraso é o único
// vermelho da lista. O lead sem data de cadastro de verdade não tem dias para
// contar (quiet nulo): a célula do último registro diz "Nenhum", nunca 0.
import { fmtNum } from '../../lib/format.js';
import { plural } from '../../lib/crm/format.js';
import { LeadLink } from '../../components/nav/AppLink.jsx';
import { STAGE_TRACKING_SINCE } from '../../lib/crm/scope.js';
import { fmtScreenDate } from '../../lib/relatorios/leads/base.js';
import { ReportHeader, HeroNumber, NumberTiles, CountBreakdown, ReportList, CellText } from './ReportParts.jsx';

const days = (n) => plural(n, 'dia', 'dias');

// "12/10 · há 3 dias", ou só o dia quando o registro é de hoje (dias do
// calendário, como no rodapé do card do Pipeline). Sem registro nenhum, conta
// do cadastro, quando há data de cadastro (quiet nulo é a falta dela).
function lastRecordText(r, year) {
  const ago = r.quiet != null && r.quiet >= 1 ? `há ${days(r.quiet)}` : null;
  if (!r.lastAt) return ago ? `Nenhum · cadastro ${ago}` : 'Nenhum';
  const day = fmtScreenDate(r.lastAt, year);
  return ago ? `${day} · ${ago}` : day;
}

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
  { key: 'etapa', label: 'Etapa', className: 'whitespace-nowrap', render: (r) => r.stage },
  {
    key: 'naEtapa',
    label: 'Na etapa',
    className: 'num whitespace-nowrap',
    render: (r) => (r.stageDays == null
      ? <span className="text-muted-foreground">{`antes de ${fmtScreenDate(STAGE_TRACKING_SINCE, year)}`}</span>
      : days(r.stageDays)),
  },
  { key: 'registro', label: 'Último registro', className: 'num whitespace-nowrap', render: (r) => lastRecordText(r, year) },
  {
    key: 'proximo',
    label: 'Próximo contato',
    className: 'num whitespace-nowrap',
    render: (r) => {
      if (!r.next) return <span className="text-muted-foreground">Sem próximo passo</span>;
      const day = fmtScreenDate(r.next, year);
      return r.late > 0
        ? <span className="font-semibold text-rose-700 dark:text-rose-400">{`${day} · ${days(r.late)} de atraso`}</span>
        : day;
    },
  },
  { key: 'consultor', label: 'Consultor', render: (r) => <CellText text={r.owner} /> },
];

export function ParadosSection({ report, listId, year, onCut, exportAction }) {
  return (
    <div className="flex flex-col gap-5">
      <ReportHeader
        title="Leads parados"
        question="Quem está em aberto agora sem próximo passo, com contato atrasado ou sem registro há dias."
        action={exportAction}
      />
      <HeroNumber
        value={report.total}
        label={report.total === 1 ? 'lead parado' : 'leads parados'}
        compareText={`de ${fmtNum(report.open)} em aberto agora`}
      />
      <NumberTiles tiles={report.tiles} cut={report.cut} onCut={onCut} className="sm:grid-cols-3 xl:grid-cols-3" />
      <p className="m-0 text-pretty text-[12px] text-muted-foreground">
        Um lead pode estar em mais de um número. A lista mostra cada um uma vez.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <CountBreakdown title="Por consultor" hint="O dono do lead hoje." rows={report.byOwner} cut={report.cut} onCut={onCut} emptyText="Nenhum lead parado agora." />
      </div>
      <ReportList
        listId={listId}
        total={report.rows.length}
        noun={report.rows.length === 1 ? 'lead' : 'leads'}
        cutLabel={report.cutLabel}
        onClearCut={() => onCut(null)}
        columns={columnsOf(year)}
        rows={report.rows}
        emptyTitle={report.cut ? 'Nenhum lead neste filtro.' : 'Nenhum lead parado agora.'}
        emptyText={report.cut ? 'Limpe o filtro da lista para ver todos.' : 'Todos os leads em aberto têm próximo passo, contato em dia e registro recente.'}
      />
    </div>
  );
}
