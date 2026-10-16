// Leads parados (spec 2026-10-09, submenu 5), no desenho do handoff
// (docs/superpowers/specs/handoff-relatorios/): um painel com quantos leads em
// aberto estão parados agora e os três números que filtram a lista (sem próximo
// passo, contato atrasado e sem registro há mais de N dias), o recorte por
// consultor e a lista. É retrato de agora: sem período, sem comparação e sem
// variação. O N vem do corte da barra.
//
// O número grande é a lista sem filtro, com cada lead uma vez, e o texto dele dá
// a base e o instante do retrato. Um lead pode estar em mais de um número, então
// a soma dos três passa do número grande.
//
// O lead sem data de cadastro de verdade não tem dias para contar (quiet nulo):
// a célula do último registro diz "Nenhum", nunca 0. Quem entrou na etapa hoje
// está "hoje" na etapa, nunca "0 dias".
import { fmtNum } from '../../lib/format.js';
import { plural } from '../../lib/crm/format.js';
import { STAGE_TRACKING_SINCE } from '../../lib/crm/scope.js';
import { fmtScreenDate } from '../../lib/relatorios/leads/base.js';
import { cn } from '../../lib/utils.js';
import {
  ReportHeader, ReportBand, CutTabs, ReportList, CellText, StatusPill, NameCell,
} from './ReportParts.jsx';

const days = (n) => plural(n, 'dia', 'dias');
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// "12/10 · há 3 dias", ou só o dia quando o registro é de hoje (dias do
// calendário, como no rodapé do card do Pipeline). Sem registro nenhum, conta
// do cadastro, quando há data de cadastro (quiet nulo é a falta dela).
function lastRecordText(r, year) {
  const ago = r.quiet != null && r.quiet >= 1 ? `há ${days(r.quiet)}` : null;
  if (!r.lastAt) return ago ? `Nenhum · cadastro ${ago}` : 'Nenhum';
  const day = fmtScreenDate(r.lastAt, year);
  return ago ? `${day} · ${ago}` : day;
}

const columnsOf = (report, year) => {
  const today = fmtScreenDate(report.at, year);
  return [
    { key: 'nome', label: 'Nome', className: 'min-w-[10rem]', render: (r) => <NameCell id={r.id} name={r.name} /> },
    { key: 'etapa', label: 'Etapa', render: (r) => <CellText text={r.stage} /> },
    {
      key: 'naEtapa',
      label: 'Na etapa',
      className: 'num whitespace-nowrap',
      render: (r) => (r.stageDays == null
        ? <span className="text-muted-foreground">{`antes de ${fmtScreenDate(STAGE_TRACKING_SINCE, year)}`}</span>
        : r.stageDays === 0 ? 'hoje' : days(r.stageDays)),
    },
    {
      key: 'registro',
      label: 'Último registro',
      className: 'num whitespace-nowrap',
      // Quem passou do corte da barra fica em destaque, como no handoff.
      render: (r) => <span className={cn(r.quiet != null && r.quiet > report.dias && 'font-semibold text-foreground')}>{lastRecordText(r, year)}</span>,
    },
    {
      key: 'proximo',
      label: 'Próximo contato',
      className: 'num whitespace-nowrap',
      render: (r) => {
        if (!r.next) return <StatusPill tone="amber">Sem próximo passo</StatusPill>;
        if (r.late > 0) return <StatusPill tone="rose" mark="!">{`Atrasado ${days(r.late)}`}</StatusPill>;
        const day = fmtScreenDate(r.next, year);
        return day === today ? 'hoje' : day;
      },
    },
    { key: 'consultor', label: 'Consultor', render: (r) => <CellText text={r.owner} /> },
  ];
};

// O tom e a nota de cada número, na ordem do paradosReport.
const TILE_LOOK = Object.freeze([
  { tone: 'amber', note: 'fora quem chegou há menos de 24h' },
  { tone: 'rose', note: 'a data já passou' },
  { tone: 'neutral', note: 'nada na ficha' },
]);

// O título e a pergunta, na tela e na folha impressa.
const HEADING = Object.freeze({
  title: 'Leads parados',
  question: 'Quem está em aberto agora sem próximo passo, com contato atrasado ou sem registro há dias.',
});

export function ParadosSection({ report, listId, year, onCut, exportAction }) {
  const cells = report.tiles.map((t, i) => ({
    key: t.key,
    // O nome inteiro, igual ao título e ao chip da lista; na célula estreita ele quebra em duas linhas.
    label: t.name,
    value: t.value,
    ...TILE_LOOK[i],
    active: report.cut === t.key,
    onClick: () => onCut(report.cut === t.key ? null : t.key),
  }));
  const at = `${fmtScreenDate(report.at, year)} às ${hhmm(report.at)}`;
  const tabs = [{ value: 'consultor', label: 'Por consultor', rows: report.byOwner, hint: 'o dono de hoje, mesmo com o contato delegado', emptyText: 'Nenhum lead parado agora.' }];

  return (
    <div className="flex flex-col gap-5">
      <ReportHeader {...HEADING} action={exportAction} />
      <ReportBand
        label="Leads parados"
        value={report.total}
        sub={`de ${fmtNum(report.open)} em aberto agora, ${at} · cada lead conta uma vez`}
        cells={cells}
      />
      <CutTabs tabs={tabs} value="consultor" onValueChange={() => {}} activeRow={report.cut} onRow={onCut} />
      <ReportList
        listId={listId}
        total={report.rows.length}
        noun={report.rows.length === 1 ? 'lead parado' : 'leads parados'}
        cutLabel={report.cutLabel}
        onClearCut={() => onCut(null)}
        columns={columnsOf(report, year)}
        rows={report.rows}
        heading={HEADING}
        emptyTitle={report.cut ? undefined : 'Nenhum lead parado.'}
        emptyText={report.cut ? undefined : 'Todos os leads em aberto têm próximo passo, contato em dia e registro recente.'}
      />
    </div>
  );
}
