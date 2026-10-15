// Peças da tela de Relatórios (spec 2026-10-09), no desenho do handoff
// (docs/superpowers/specs/handoff-relatorios/): o cabeçalho de cada submenu, o
// painel de números (ReportBand, BandCell e DayBars), os recortes em abas
// (CutTabs), a lista de nomes com o selo de situação (StatusPill) e a célula do
// nome (NameCell), o exportar e o aviso do dado. A marca da tela é a lista que
// repete o número de que veio e o filtro aplicado: cada célula do painel e cada
// linha de recorte é um filtro dessa lista. A barra mostra sempre o mesmo
// número que está ao lado dela, e matrícula e conversão são verdes, como nos
// painéis.
import { useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ChevronRight, CircleAlert, Download, X } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { FOCUS_RING } from '../../components/focusRing.js';
import { LeadLink } from '../../components/nav/AppLink.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs.jsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip.jsx';
import { DeltaPill } from '../dashboard/CrmParts.jsx';

// O verde das tabelas do painel (ChannelTable e PeopleConversionTable). É o
// único verde do texto pequeno: matrícula e conversão dos recortes, a situação
// e o desfecho da lista usam este.
export const GREEN_TEXT = 'text-emerald-700 dark:text-emerald-300';
const RULE = 'border-slate-100 dark:border-white/[0.06]';
// A margem das células da lista: 12px entre as colunas, e a primeira e a última
// alinhadas com o cabeçalho do cartão (px-[18px]). Com 16px de cada lado, a
// coluna do nome ficava com uns 120px a 1280px, na Conversão, e quebrava o nome
// em duas e três linhas.
// A linha tem 46px no mínimo (o h-[46px] da célula vale como altura mínima).
const CELL = 'px-3 py-[7px] first:pl-[18px] last:pr-[18px]';
const ROW_ON = 'bg-brand-50 hover:bg-brand-50 dark:bg-brand-500/15 dark:hover:bg-brand-500/15';
// A linha da lista recebe o foco por código (tabIndex -1), nunca pelo Tab.
const ROW_FOCUS = 'outline-none focus-visible:bg-brand-50 dark:focus-visible:bg-brand-500/10';

// Título do submenu, a pergunta que ele responde e, à direita, o exportar.
export function ReportHeader({ title, question, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="m-0 font-display text-[24px] font-bold tracking-[-0.02em]">{title}</h2>
        <p className="mt-[5px] text-pretty text-[13px] leading-normal text-muted-foreground">{question}</p>
      </div>
      {action}
    </div>
  );
}

// O texto pequeno ao lado do nome da linha: o canal da origem, ou a explicação
// da linha Outros (note). O title leva o nome e a explicação, porque a letra
// menor é a primeira a ser cortada; o canal fica de fora do title, como sempre.
const sideTextOf = (r) => r.channel || r.note || '';
const rowTitleOf = (r) => (r.note ? `${r.name}, ${r.note}` : r.name);
// Um espaço de verdade separa o texto pequeno do nome: só com a margem, o leitor
// de tela lia "InstagramPago" e "Outrosfora da equipe ou sem responsável". O
// espaço ocupa uns 3px, e a margem de 3px completa os 6px que a linha tinha.
function SideText({ row }) {
  const text = sideTextOf(row);
  return text ? <>{' '}<span className="ml-[3px] text-[11px] font-normal text-muted-foreground">{text}</span></> : null;
}

// A lista de nomes por trás dos números. O cabeçalho repete o número que ela
// mostra e o filtro aplicado, com o botão de limpar. Mostra 50 nomes por vez,
// e o exportar leva todos. O listId diz que lista é esta (o submenu mais o
// filtro que a pessoa escolheu): quando ele muda, a lista volta aos 50
// primeiros, e enquanto ele é o mesmo o "Mostrar mais" se mantém, mesmo que
// chegue lead novo e os dados mudem. Os dois botões que saem de cena levam o
// foco com eles: limpar o filtro leva ao número da lista, e "Mostrar mais"
// leva à primeira linha que apareceu. A tabela se chama pelo número do
// cabeçalho ("120 leads"). Sem emptyTitle e emptyText, a lista vazia usa os
// textos do handoff: "Ninguém neste filtro." com filtro e "Nada neste
// período." sem ele (Leads parados passa "Nenhum lead parado.").
export function ReportList({ listId = '', total, noun, cutLabel = null, onClearCut, columns, rows, emptyTitle, emptyText, pageSize = 50 }) {
  const [more, setMore] = useState({ listId, extra: 0 });
  if (more.listId !== listId) setMore({ listId, extra: 0 });
  const extra = more.listId === listId ? more.extra : 0;
  const countRef = useRef(null);
  const bodyRef = useRef(null);
  const countId = useId();
  const shown = rows.slice(0, pageSize + extra);
  const left = rows.length - shown.length;

  // O botão de limpar sai de cena junto com o filtro, então o foco passa ao
  // número. O filtro limpa primeiro, na hora (flushSync), e o foco vem depois:
  // com o foco primeiro, o leitor de tela chegava ao número ainda com o total
  // antigo e só depois lia o novo. Os dois acontecem no mesmo gesto, então o
  // foco não chega a ficar no body.
  const clearCut = () => {
    flushSync(() => onClearCut?.());
    countRef.current?.focus();
  };
  // A linha nova só existe no DOM depois de renderizar. O flushSync a faz
  // aparecer na hora, para o foco ter onde pousar.
  const showMore = () => {
    const first = shown.length;
    flushSync(() => setMore({ listId, extra: extra + pageSize }));
    bodyRef.current?.rows[first]?.focus();
  };

  const title = emptyTitle ?? (cutLabel ? 'Ninguém neste filtro.' : 'Nada neste período.');
  const text = emptyText ?? (cutLabel ? 'Limpe o filtro da lista para ver todos.' : 'Escolha outro período ou limpe os filtros da barra.');
  const shownText = rows.length === 0 ? '' : left > 0 ? `mostrando ${fmtNum(shown.length)} de ${fmtNum(rows.length)}` : 'todos na tela';

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-[18px] py-3.5">
        {/* O espaço entre o número e o nome não aparece (os dois são itens do flex), mas
            faz o texto ler "120 leads", que é também o nome da tabela. O número recebe o
            foco quando o filtro é limpo, e quem limpou pelo teclado vê o anel, como nos botões. */}
        <p id={countId} ref={countRef} tabIndex={-1} className={cn('m-0 flex items-baseline gap-2 rounded-md', FOCUS_RING)} aria-live="polite">
          <span className="num font-display text-[23px] font-bold leading-none tracking-[-0.02em]">{fmtNum(total)}</span>
          {' '}
          <span className="text-[13px] font-semibold text-muted-foreground">{noun}</span>
        </p>
        {cutLabel && (
          <span className="inline-flex h-7 max-w-full items-center gap-1 whitespace-nowrap rounded-full bg-brand-50 pl-3 pr-1 text-[12px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            <span className="min-w-0 truncate">{cutLabel}</span>
            <button
              type="button"
              onClick={clearCut}
              aria-label="Limpar filtro da lista"
              className={cn('grid size-5 flex-none place-items-center rounded-full transition-colors hover:bg-brand-100 motion-reduce:transition-none dark:hover:bg-brand-500/25', FOCUS_RING)}
            >
              <X size={11} strokeWidth={2.8} aria-hidden="true" />
            </button>
          </span>
        )}
        {shownText && <span className="num ml-auto whitespace-nowrap text-[11.5px] text-muted-foreground">{shownText}</span>}
      </header>
      {rows.length === 0 ? (
        <div className="mx-4 mb-4 mt-1 rounded-[14px] border-[1.5px] border-dashed border-border px-[18px] py-[26px] text-center">
          <div className="text-[13.5px] font-semibold">{title}</div>
          {text && <p className="m-0 mt-1 text-pretty text-[12.5px] text-muted-foreground">{text}</p>}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto overscroll-x-contain">
            <table aria-labelledby={countId} className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className={cn('border-t bg-muted/50', RULE)}>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      className={cn('whitespace-nowrap py-[9px] text-[9.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground', CELL, c.className)}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody ref={bodyRef}>
                {shown.map((r) => (
                  <tr key={r.id} tabIndex={-1} className={cn('border-t transition-colors hover:bg-muted/40 motion-reduce:transition-none', ROW_FOCUS, RULE)}>
                    {columns.map((c) => (
                      <td key={c.key} className={cn('h-[46px] text-[12.5px] text-foreground/80', CELL, c.className)}>{c.render(r)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {left > 0 && (
            <div className={cn('flex justify-center border-t p-3', RULE)}>
              <button
                type="button"
                onClick={showMore}
                className={cn('h-9 rounded-full border border-border bg-card px-4 text-[12.5px] font-semibold text-foreground/80 transition-colors hover:bg-muted hover:text-foreground motion-reduce:transition-none', FOCUS_RING)}
              >
                {`Mostrar mais ${Math.min(pageSize, left)}`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// Texto de célula da lista que corta em vez de quebrar a linha (origem,
// consultor e funil), com o texto inteiro no title. Sem o corte, uma origem de
// nome comprido quebrava em duas e três linhas e a lista ficava com linhas de
// alturas diferentes. O corte de 9rem deixa espaço para o nome do lead quando as
// três colunas têm nome comprido: com 11rem, ele ficava com uns 107px a 1280px e
// quebrava em 42 de 50 linhas.
export function CellText({ text }) {
  return <span className="block max-w-[9rem] truncate" title={text}>{text}</span>;
}

export function ExportButton({ onExport, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onExport}
      disabled={disabled}
      className={cn('inline-flex h-[38px] flex-none items-center gap-2 whitespace-nowrap rounded-full bg-brand-600 px-4 text-[12.5px] font-bold text-white transition-colors hover:bg-brand-700 motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-40', FOCUS_RING)}
    >
      <Download size={14} strokeWidth={2.2} aria-hidden="true" />
      Exportar lista
    </button>
  );
}

// Aviso do dado, na faixa âmbar logo abaixo do painel de números: visitas antes
// de 18/08/2026, etapa da perda antes de 14/09/2026, perda que voltou ao funil.
// O ícone é decorativo: o texto diz tudo.
export function ReportNotice({ children }) {
  return (
    <p className="m-0 flex items-start gap-[9px] rounded-xl border border-amber-500/30 bg-amber-500/[0.13] px-3.5 py-2.5 dark:border-amber-500/40 dark:bg-amber-500/[0.18]">
      <CircleAlert size={14} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 flex-none text-amber-700 dark:text-amber-300" />
      <span className="min-w-0 flex-1 text-pretty text-[12.5px] leading-normal text-foreground/80">{children}</span>
    </p>
  );
}

// ─── Peças do redesenho (handoff dos Relatórios) ────────────────────────────

// O texto colorido fica sempre no passo 700 (300 no escuro), como o GREEN_TEXT.
const TONE_700 = Object.freeze({
  neutral: '',
  emerald: GREEN_TEXT,
  rose: 'text-rose-700 dark:text-rose-300',
  amber: 'text-amber-700 dark:text-amber-300',
  brand: 'text-brand-700 dark:text-brand-300',
  slate: 'text-slate-700 dark:text-slate-300',
});

const ddmm = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

/**
 * Uma célula do painel de números, que também filtra a lista. É um botão com
 * aria-pressed; quem decide o filtro é a seção, no onClick (clicar de novo na
 * célula acesa limpa o filtro).
 *
 * @param {object} props
 * @param {string} props.label O rótulo ("Agendaram").
 * @param {number} props.value O número.
 * @param {'neutral'|'emerald'|'rose'|'amber'} [props.tone] Cor do número: emerald para veio e matriculou, rose para faltou e perdeu, amber para sem desfecho.
 * @param {object|null} [props.delta] A variação (o formato do crmDelta), na DeltaPill.
 * @param {boolean} [props.lowerBetter] Subir é ruim (perderam, faltaram): a variação pinta ao contrário.
 * @param {string} [props.note] Texto pequeno no lugar da variação, quando ela não existe ("ainda no funil").
 * @param {boolean} [props.active] A célula é o filtro aceso da lista.
 * @param {() => void} props.onClick
 * @param {boolean} [props.arrow] Seta antes da célula: ela é a etapa seguinte da anterior.
 * @param {boolean} [props.rule] Régua antes da célula: ela não é etapa (Perderam e Em aberto na Conversão).
 * @param {string} [props.title] Explicação no title do botão.
 */
export function BandCell({ label, value, tone = 'neutral', delta = null, lowerBetter = false, note = '', active = false, onClick, arrow = false, rule = false, title }) {
  return (
    <div className="flex min-w-[104px] grow basis-0 items-stretch xl:min-w-0">
      {arrow && (
        <span aria-hidden="true" className="grid w-3.5 flex-none place-items-center text-slate-400 xl:w-3 dark:text-slate-500">
          <ChevronRight size={12} strokeWidth={2.4} />
        </span>
      )}
      {rule && <span aria-hidden="true" className="mx-1.5 my-3.5 w-px flex-none bg-border" />}
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        title={title}
        className={cn(
          'relative flex min-w-0 flex-1 flex-col items-start px-3.5 pb-3.5 pt-[18px] text-left xl:px-2 transition-[background-color,box-shadow] duration-200 motion-reduce:transition-none',
          'hover:inset-ring hover:inset-ring-brand-200 dark:hover:inset-ring-brand-500/50',
          FOCUS_RING,
          active && 'bg-brand-50 dark:bg-brand-500/15'
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-x-2.5 top-0 h-[3px] origin-top rounded-b-[3px] bg-brand-600 transition-[opacity,transform] duration-200 motion-reduce:transition-none dark:bg-brand-400',
            active ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'
          )}
        />
        <span className={cn('max-w-full truncate text-[11.5px] font-semibold transition-colors motion-reduce:transition-none', active ? 'text-brand-700 dark:text-brand-300' : 'text-muted-foreground')}>
          {label}
        </span>
        <span className={cn('num mt-2.5 font-display text-[27px] font-bold leading-none tracking-[-0.025em]', TONE_700[tone])}>{fmtNum(value)}</span>
        <span className="mt-2.5 flex min-h-5 max-w-full items-center">
          {delta ? <DeltaPill delta={delta} lowerBetter={lowerBetter} />
            : note ? <span className="line-clamp-2 text-[11px] leading-[1.3] text-muted-foreground">{note}</span> : null}
        </span>
      </button>
    </div>
  );
}

// Uma barra do gráfico por dia. É focável e mostra a dica do shadcn no hover e
// no foco do teclado: o title nativo não aparece no foco (README do handoff, §2).
function DayBar({ day, max, unit }) {
  const tip = `${ddmm(day.date)}: ${fmtNum(day.count)} ${day.count === 1 ? unit[0] : unit[1]}${day.today ? ' até agora' : ''}`;
  const weekend = day.date.getDay() === 0 || day.date.getDay() === 6;
  // Dia zerado no tom mais claro, hoje (ainda correndo) e fim de semana no
  // azul claro, e os outros dias no azul cheio, como no mockup.
  const fill = day.count === 0 ? 'bg-muted'
    : day.today ? 'bg-brand-300 dark:bg-brand-500'
      : weekend ? 'bg-brand-200 dark:bg-brand-500/50'
        : 'bg-brand-600';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} role="img" aria-label={tip} className={cn('group flex min-w-0 flex-1 cursor-default items-end justify-center self-stretch rounded-[5px]', FOCUS_RING)}>
          <span
            className={cn(
              'block w-full max-w-6 rounded-b-[2px] rounded-t-[4px] transition-[height,background-color] duration-300 ease-out motion-reduce:transition-none',
              fill,
              day.count > 0 && 'group-hover:bg-brand-700 group-focus-visible:bg-brand-700 dark:group-hover:bg-brand-400 dark:group-focus-visible:bg-brand-400'
            )}
            style={{ height: `${Math.max(3, Math.round((day.count / max) * 72))}px` }}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent className="text-[11.5px] motion-reduce:animate-none">{tip}</TooltipContent>
    </Tooltip>
  );
}

/**
 * O gráfico de colunas por dia, à direita do herói na Entrada e nas Perdas.
 * Não desenha nada com menos de 2 dias (Hoje, Ontem) nem com mais de
 * DAY_BARS_MAX: no Personalizado longo as colunas sumiriam e o fim do período
 * ficaria cortado. Nos dois casos o herói fica sozinho.
 *
 * @param {object} props
 * @param {Array<{key: string, date: Date, count: number, today: boolean}>} props.days O resultado de porDia(...).
 * @param {string} props.label O título do gráfico ("Por dia de cadastro").
 * @param {[string, string]} [props.unit] O nome no singular e no plural, para a dica ("lead", "leads").
 * @param {string} [props.className]
 */
// Até dois meses de colunas cabem no painel; acima disso o gráfico sai.
export const DAY_BARS_MAX = 62;
const chartFits = (days) => (days?.length ?? 0) >= 2 && days.length <= DAY_BARS_MAX;

export function DayBars({ days, label, unit = ['lead', 'leads'], className }) {
  if (!chartFits(days)) return null;
  const max = Math.max(1, ...days.map((d) => d.count));
  const peak = days.reduce((top, d) => (d.count > top.count ? d : top), days[0]);
  const last = days.at(-1);
  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn('flex min-w-0 flex-1 flex-col', className)}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[12px] font-semibold text-muted-foreground">{label}</span>
          {peak.count > 0 && <span className="num whitespace-nowrap text-[11.5px] text-muted-foreground">{`pico de ${fmtNum(peak.count)} em ${ddmm(peak.date)}`}</span>}
        </div>
        <div role="group" aria-label={label} className="mt-2.5 flex min-h-[78px] flex-1 items-end gap-[3px]">
          {days.map((d) => <DayBar key={d.key} day={d} max={max} unit={unit} />)}
        </div>
        <div className={cn('mt-[7px] flex justify-between gap-2 border-t pt-1.5', RULE)}>
          <span className="num text-[10.5px] text-muted-foreground">{ddmm(days[0].date)}</span>
          <span className="num text-[10.5px] text-muted-foreground">{last.today ? `hoje, ${ddmm(last.date)}` : ddmm(last.date)}</span>
        </div>
      </div>
    </TooltipProvider>
  );
}

/**
 * O painel de números do relatório, num cartão só: o herói à esquerda (236px)
 * e, à direita, as células que filtram a lista ou o gráfico por dia. Sem os
 * dois (ou com o gráfico de um dia só), o herói ocupa a largura.
 *
 * @param {object} props
 * @param {string} props.label O rótulo do herói ("Leads novos", "Conversão da safra").
 * @param {number|null} props.value O número do herói; null mostra "sem base", apagado e sem a pílula.
 * @param {boolean} [props.percent] Escreve o número com %.
 * @param {'neutral'|'emerald'|'rose'|'amber'} [props.tone] Cor do número.
 * @param {object|null} [props.delta] A variação (crmDelta), na DeltaPill.
 * @param {boolean} [props.lowerBetter] Subir é ruim (perdas).
 * @param {import('react').ReactNode} [props.sub] O texto do comparado ou uma nota, ao lado da pílula.
 * @param {Array<object & {key: string}>} [props.cells] As células: as props de BandCell, cada uma com `key`.
 * @param {{days: object[], label: string, unit?: [string, string]}} [props.chart] O gráfico por dia: as props de DayBars.
 * @param {string} [props.className]
 */
export function ReportBand({ label, value, percent = false, tone = 'neutral', delta = null, lowerBetter = false, sub = null, cells = null, chart = null, className }) {
  const empty = value == null;
  const text = empty ? 'sem base' : percent ? `${value}%` : fmtNum(value);
  const hasCells = Boolean(cells?.length);
  const hasChart = !hasCells && chartFits(chart?.days);
  const side = cn('flex min-w-0 flex-1 border-t md:border-l md:border-t-0', RULE);
  return (
    <section className={cn('flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card md:flex-row', className)}>
      <div className={cn('flex-none px-[22px] py-[18px]', (hasCells || hasChart) && 'md:w-[236px]')}>
        <div className="text-[12px] font-semibold text-muted-foreground">{label}</div>
        <div className={cn('num mt-2.5 font-display text-[42px] font-bold leading-none tracking-[-0.035em]', empty ? 'text-muted-foreground' : TONE_700[tone])}>{text}</div>
        <div className="mt-2.5 flex min-h-5 flex-wrap items-center gap-1.5">
          {delta && !empty && <DeltaPill delta={delta} lowerBetter={lowerBetter} />}
          {sub && <span className="num text-pretty text-[11.5px] leading-[1.35] text-muted-foreground">{sub}</span>}
        </div>
      </div>
      {hasCells && (
        <div className={cn(side, 'flex-wrap')}>
          {cells.map(({ key, ...cell }) => <BandCell key={key} {...cell} />)}
        </div>
      )}
      {hasChart && (
        <div className={cn(side, 'px-[22px] pb-3 pt-4')}>
          <DayBars {...chart} />
        </div>
      )}
    </section>
  );
}

const COUNT_GRID = 'grid grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)_48px_44px] items-center gap-x-3.5';
const CONV_ROW_GRID = 'grid grid-cols-[minmax(0,1.15fr)_60px_60px_minmax(0,1.6fr)_44px] items-center gap-x-3.5';
const CUT_ROW = 'w-full min-w-0 overflow-hidden rounded-[10px] px-2.5 py-[9px] text-left transition-colors hover:bg-muted/70 motion-reduce:transition-none';
const BAR_TRACK = 'flex h-2.5 overflow-hidden rounded-[4px] bg-muted';
const BAR_FILL = 'rounded-[4px] transition-[width] duration-500 ease-out motion-reduce:transition-none';
const sideOf = sideTextOf;
const shareOf = (n, total) => (total > 0 ? Math.round((n / total) * 100) : 0);

function CountRows({ tab, activeRow, onRow }) {
  const total = tab.total ?? tab.rows.reduce((s, r) => s + r.count, 0);
  const max = Math.max(1, ...tab.rows.map((r) => r.count));
  return (
    <ul className="m-0 flex list-none flex-col gap-0.5 px-2 pb-2 pt-1.5">
      {tab.rows.map((r) => {
        const active = activeRow === r.key;
        const share = shareOf(r.count, total);
        return (
          <li key={r.key}>
            <button
              type="button"
              aria-pressed={active}
              aria-label={`${r.name}${sideOf(r) ? ` (${sideOf(r)})` : ''}: ${fmtNum(r.count)} de ${fmtNum(total)}, ${share}%`}
              onClick={() => onRow(active ? null : r.key)}
              className={cn(COUNT_GRID, CUT_ROW, FOCUS_RING, active && ROW_ON)}
            >
              <span className={cn('truncate text-[13px]', active ? 'font-bold' : 'font-medium')} title={rowTitleOf(r)}>
                {r.name}
                <SideText row={r} />
              </span>
              <span aria-hidden="true" className={BAR_TRACK}>
                <span
                  className={cn(BAR_FILL, active ? 'bg-brand-600 dark:bg-brand-400' : 'bg-brand-300 dark:bg-brand-500/70')}
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </span>
              <span className="num text-right font-display text-[14px] font-bold">{fmtNum(r.count)}</span>
              <span className="num text-right text-[11.5px] text-muted-foreground">{`${share}%`}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ConvRows({ tab, activeRow, onRow }) {
  const [one, many] = tab.countNoun ?? ['lead', 'leads'];
  const label = (r) => {
    const n = `${fmtNum(r.leads)} ${r.leads === 1 ? one : many}`;
    const enrolled = `${fmtNum(r.enrolled)} ${r.enrolled === 1 ? 'matrícula' : 'matrículas'}`;
    const conv = r.conv == null ? 'sem conversão' : `${r.conv}% de conversão`;
    return `${r.name}${sideOf(r) ? ` (${sideOf(r)})` : ''}: ${n}, ${enrolled}, ${conv}`;
  };
  return (
    <>
      <div aria-hidden="true" className={cn(CONV_ROW_GRID, 'overflow-hidden px-[18px] pb-1 pt-2.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground')}>
        <span />
        <span className="text-right">{tab.countLabel ?? 'Leads'}</span>
        <span className="text-right">Matr.</span>
        <span>Conversão</span>
        <span />
      </div>
      <ul className="m-0 flex list-none flex-col gap-0.5 px-2 pb-2">
        {tab.rows.map((r) => {
          const active = activeRow === r.key;
          return (
            <li key={r.key}>
              <button
                type="button"
                aria-pressed={active}
                aria-label={label(r)}
                onClick={() => onRow(active ? null : r.key)}
                className={cn(CONV_ROW_GRID, CUT_ROW, FOCUS_RING, active && ROW_ON)}
              >
                <span className={cn('truncate text-[13px]', active ? 'font-bold' : 'font-medium')} title={rowTitleOf(r)}>
                  {r.name}
                  <SideText row={r} />
                </span>
                <span className="num text-right text-[13px]">{fmtNum(r.leads)}</span>
                <span className={cn('num text-right text-[13px] font-semibold', GREEN_TEXT)}>{fmtNum(r.enrolled)}</span>
                <span aria-hidden="true" className={BAR_TRACK}>
                  <span className={cn(BAR_FILL, 'bg-emerald-500')} style={{ width: `${r.conv ?? 0}%` }} />
                </span>
                <span className={cn('num text-right font-display text-[14px] font-bold', r.conv == null ? 'text-muted-foreground' : GREEN_TEXT)}>
                  {r.conv == null ? '—' : `${r.conv}%`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/**
 * Os recortes em abas, um por vez, na largura inteira. Cada linha é um botão
 * com aria-pressed que filtra a lista; clicar de novo na linha acesa limpa
 * (onRow recebe null). Tudo controlado: a aba aberta e a linha acesa vêm da
 * seção. Aba que não existe mais abre a primeira.
 *
 * Cada aba: `{ value, label, rows, kind?, hint?, total?, countLabel?, countNoun?, emptyText? }`.
 * - `kind: 'count'` (padrão): linhas `{ key, name, count, channel?, note? }`, com a
 *   barra, o número e a fatia de `total` (sem ele, a soma das linhas).
 * - `kind: 'conv'`: linhas `{ key, name, leads, enrolled, conv, channel?, note? }`,
 *   com a barra verde da conversão. `countLabel` é o cabeçalho da coluna de
 *   número ("Aulas" em Por professor; padrão "Leads") e `countNoun` o nome dela
 *   para o leitor de tela (`['aula', 'aulas']`; padrão lead, leads).
 * - `hint`: o que a aba conta, antes de "clique numa linha para filtrar a lista".
 * - `emptyText`: o texto da aba sem linhas (padrão "Nada no período.").
 *
 * @param {object} props
 * @param {object[]} props.tabs
 * @param {string} props.value A aba aberta.
 * @param {(value: string) => void} props.onValueChange
 * @param {string|null} props.activeRow A key da linha acesa (o recorte da lista).
 * @param {(key: string|null) => void} props.onRow
 * @param {string} [props.className]
 */
export function CutTabs({ tabs, value, onValueChange, activeRow = null, onRow, className }) {
  const current = tabs.find((t) => t.value === value) ?? tabs[0];
  if (!current) return null;
  const hint = current.hint ? `${current.hint} · clique numa linha para filtrar a lista` : 'Clique numa linha para filtrar a lista';
  return (
    <Tabs value={current.value} onValueChange={onValueChange} className={cn('gap-0 overflow-hidden rounded-2xl border border-border bg-card shadow-card', className)}>
      <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3', RULE)}>
        <TabsList aria-label="Recortes" className="h-auto max-w-full justify-start gap-0.5 overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-[11px] p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className={cn(
                'h-[30px] flex-none rounded-[8px] px-[13px] text-[12.5px] font-semibold text-muted-foreground transition-[color,background-color,box-shadow] duration-200 hover:text-foreground motion-reduce:transition-none',
                'data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-card dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-white/[0.08]',
                FOCUS_RING
              )}
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <span className="ml-auto min-w-0 text-pretty text-right text-[11.5px] text-muted-foreground">{hint}</span>
      </div>
      {tabs.map((t) => (
        // O painel não entra na ordem do Tab: as linhas, que são botões, entram.
        <TabsContent key={t.value} value={t.value} tabIndex={-1}>
          {t.rows.length === 0 ? (
            <p className="m-0 p-[18px] text-[12.5px] text-muted-foreground">{t.emptyText ?? 'Nada no período.'}</p>
          ) : t.kind === 'conv' ? (
            <ConvRows tab={t} activeRow={activeRow} onRow={onRow} />
          ) : (
            <CountRows tab={t} activeRow={activeRow} onRow={onRow} />
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

const PILL_TONE = Object.freeze({
  emerald: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/15', dot: 'bg-emerald-500' },
  rose: { bg: 'bg-rose-500/10 dark:bg-rose-500/15', dot: 'bg-rose-500' },
  amber: { bg: 'bg-amber-500/[0.13] dark:bg-amber-500/15', dot: 'bg-amber-500' },
  brand: { bg: 'bg-brand-50 dark:bg-brand-500/15', dot: 'bg-brand-600 dark:bg-brand-400' },
  slate: { bg: 'bg-slate-500/[0.12] dark:bg-slate-400/15', dot: 'bg-slate-400' },
});

/**
 * O selo de situação da lista: um ponto e o texto escrito. A cor só reforça,
 * quem informa é o texto.
 *
 * @param {object} props
 * @param {'emerald'|'rose'|'amber'|'brand'|'slate'} [props.tone] emerald para cliente, veio e matriculou; rose para perdido, faltou e atrasado; amber para sem desfecho e sem próximo passo; brand para a acontecer; slate para em aberto.
 * @param {import('react').ReactNode} props.children O texto ("Matriculou em 02/09").
 */
export function StatusPill({ tone = 'slate', children }) {
  const t = PILL_TONE[tone] ?? PILL_TONE.slate;
  return (
    <span className={cn('num inline-flex h-6 max-w-full items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-[7px] px-[9px] text-[11.5px] font-semibold', t.bg, TONE_700[tone] ?? TONE_700.slate)}>
      <span aria-hidden="true" className={cn('size-1.5 flex-none rounded-full', t.dot)} />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

const initialsOf = (name) => {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return `${words[0][0]}${words.length > 1 ? words.at(-1)[0] : ''}`.toUpperCase();
};

/**
 * A célula do nome na lista: as iniciais num círculo e o nome, que é o link da
 * ficha (LeadLink, então o Ctrl+clique abre em outra aba). O nome corta em vez
 * de quebrar, com o nome inteiro no title.
 *
 * @param {object} props
 * @param {string} props.id O id do lead.
 * @param {string} props.name O nome.
 */
export function NameCell({ id, name }) {
  return (
    <LeadLink leadId={id} title={name} className="group flex min-w-0 max-w-[16rem] items-center gap-[9px] text-foreground">
      <span aria-hidden="true" className="grid size-7 flex-none place-items-center rounded-full bg-muted text-[10px] font-bold text-foreground/70">
        {initialsOf(name)}
      </span>
      <span className="min-w-0 truncate text-[13px] font-semibold transition-colors group-hover:text-brand-700 group-hover:underline motion-reduce:transition-none dark:group-hover:text-brand-300">
        {name}
      </span>
    </LeadLink>
  );
}
