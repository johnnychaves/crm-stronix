// Peças da tela de Relatórios (spec 2026-10-09), desenhadas com a skill
// frontend-design no molde dos painéis (CrmCard, DeltaPill): o cabeçalho de
// cada submenu, o número grande, os números que filtram a lista, os recortes
// em barras, a lista de nomes, o exportar e o aviso do dado. A marca da tela é
// a lista que repete o número de que veio e o filtro aplicado: cada número e
// cada linha de recorte é um filtro dessa lista. A barra mostra sempre o mesmo
// número que está ao lado dela, e matrícula e conversão são verdes, como nos
// painéis.
import { useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Download, X } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { CrmCard, DashedNote, DeltaPill } from '../dashboard/CrmParts.jsx';

const TONE_TEXT = Object.freeze({
  good: 'text-emerald-600 dark:text-emerald-400',
  bad: 'text-rose-600 dark:text-rose-400',
});
// O verde das tabelas do painel (ChannelTable e PeopleConversionTable). É o
// único verde do texto pequeno: matrícula e conversão dos recortes, a situação
// e o desfecho da lista usam este. Os números grandes têm o TONE_TEXT.good.
export const GREEN_TEXT = 'text-emerald-700 dark:text-emerald-300';
const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40';
const RULE = 'border-slate-100 dark:border-white/[0.06]';
// A margem das células da lista: 12px entre as colunas, e a primeira e a última
// alinhadas com o cabeçalho do cartão (px-[18px]). Com 16px de cada lado, a
// coluna do nome ficava com uns 120px a 1280px, na Conversão, e quebrava o nome
// em duas e três linhas.
const CELL = 'px-3 py-2.5 first:pl-[18px] last:pr-[18px]';
const ROW_ON = 'bg-brand-50 hover:bg-brand-50 dark:bg-brand-500/15 dark:hover:bg-brand-500/15';
// A linha da lista recebe o foco por código (tabIndex -1), nunca pelo Tab.
const ROW_FOCUS = 'outline-none focus-visible:bg-brand-50 dark:focus-visible:bg-brand-500/10';

// Título do submenu, a pergunta que ele responde e, à direita, o exportar.
export function ReportHeader({ title, question, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="m-0 font-display text-[22px] font-bold tracking-[-0.015em]">{title}</h2>
        <p className="mt-1 text-pretty text-[13px] text-muted-foreground">{question}</p>
      </div>
      {action}
    </div>
  );
}

// O número que abre o submenu, com a variação contra o período anterior. Em
// lowerBetter (as perdas), subir é ruim e a variação sai vermelha. Sem base,
// o texto fica apagado: a cor do tom diria que há um resultado bom ou ruim.
export function HeroNumber({ value, label, delta = null, lowerBetter = false, compareText = null, percent = false, tone = null }) {
  const empty = value == null;
  const text = empty ? 'sem base' : percent ? `${value}%` : fmtNum(value);
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5">
      <span className={cn('num font-display text-[40px] font-bold leading-none tracking-[-0.03em]', empty ? 'text-muted-foreground' : TONE_TEXT[tone])}>{text}</span>
      <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
      {delta && <DeltaPill delta={delta} lowerBetter={lowerBetter} />}
      {compareText && <span className="text-[12px] text-muted-foreground">{compareText}</span>}
    </div>
  );
}

// Os números do topo. Cada um é também o filtro da lista: clicar mostra
// embaixo só os nomes dele, e clicar de novo volta para todos. O número sem
// filtro próprio (key null) é o total, aceso quando a lista não tem recorte.
// O número que é melhor quando cai (lowerBetter, como os que perderam) pinta
// a variação ao contrário: subir fica vermelho. O número sem variação (Em
// aberto) guarda o lugar dela, com a altura da pílula (h-5), para o número
// ficar na mesma linha dos outros.
export function NumberTiles({ tiles, cut, onCut }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t) => {
        const active = t.key === null ? cut === null : cut === t.key;
        return (
          <button
            key={t.key ?? 'total'}
            type="button"
            aria-pressed={active}
            onClick={() => onCut(t.key === null || active ? null : t.key)}
            className={cn(
              'flex min-h-[96px] flex-col items-start justify-between gap-2 rounded-2xl border bg-card px-4 py-3.5 text-left shadow-card transition-colors motion-reduce:transition-none',
              FOCUS,
              active ? 'border-brand-600 ring-1 ring-brand-600 dark:border-brand-400 dark:ring-brand-400' : 'border-border hover:border-brand-300 dark:hover:border-brand-500/40'
            )}
          >
            <span className="text-[11.5px] font-semibold text-muted-foreground">{t.name}</span>
            <span className={cn('num font-display text-[28px] font-bold leading-none tracking-[-0.02em]', TONE_TEXT[t.tone])}>{fmtNum(t.value)}</span>
            {t.delta ? <DeltaPill delta={t.delta} lowerBetter={t.lowerBetter} /> : <span aria-hidden="true" className="h-5" />}
          </button>
        );
      })}
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

// Recorte em barras: cada linha filtra a lista. A barra é o próprio número ao
// lado dela. A linha corta o que não cabe (overflow-hidden) em vez de vazar do
// cartão, e o nome inteiro fica no title. O cartão é um título de nível 3,
// abaixo do título do relatório.
export function CountBreakdown({ title, hint, rows, cut, onCut, emptyText = 'Nada no período.' }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <CrmCard title={title} hint={hint} headingLevel={3} className="min-w-0">
      {rows.length === 0 ? (
        <p className="px-[18px] py-4 text-[12.5px] text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-2">
          {rows.map((r) => {
            const active = cut === r.key;
            return (
              <li key={r.key}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onCut(active ? null : r.key)}
                  className={cn('flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-lg px-2.5 py-2 text-left hover:bg-muted/70', FOCUS, active && ROW_ON)}
                >
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium" title={rowTitleOf(r)}>
                    {r.name}
                    <SideText row={r} />
                  </span>
                  <span className="h-2 w-20 shrink-0 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <span className="block h-full rounded-full bg-brand-500" style={{ width: `${(r.count / max) * 100}%` }} />
                  </span>
                  <span className="num w-9 shrink-0 text-right text-[13px] font-semibold">{fmtNum(r.count)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </CrmCard>
  );
}

const CONV_GRID = 'grid grid-cols-[minmax(0,1fr)_40px_40px_104px] items-center gap-x-2';

// A linha é uma tabela feita de spans, e lida pelo conteúdo soaria como uma
// fila de números soltos. O leitor de tela recebe a frase inteira.
function conversionLabel(r) {
  const leads = `${fmtNum(r.leads)} ${r.leads === 1 ? 'lead' : 'leads'}`;
  const enrolled = `${fmtNum(r.enrolled)} ${r.enrolled === 1 ? 'matrícula' : 'matrículas'}`;
  const conv = r.conv == null ? 'sem conversão' : `${r.conv}% de conversão`;
  return `${r.name}${r.note ? ` (${r.note})` : ''}: ${leads}, ${enrolled}, ${conv}`;
}

// Recorte da conversão: leads, matrículas e a conversão, com a barra sendo a
// própria conversão, em verde. Cada linha filtra a lista. Como no recorte em
// barras, a linha corta o que não cabe em vez de vazar do cartão, e o cartão é
// um título de nível 3.
export function ConversionBreakdown({ title, hint, rows, cut, onCut, emptyText = 'Nada no período.' }) {
  return (
    <CrmCard title={title} hint={hint} headingLevel={3} className="min-w-0">
      {rows.length === 0 ? (
        <p className="px-[18px] py-4 text-[12.5px] text-muted-foreground">{emptyText}</p>
      ) : (
        <>
          <div aria-hidden="true" className={cn(CONV_GRID, 'overflow-hidden px-[18px] pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground')}>
            <span />
            <span className="text-right">Leads</span>
            <span className="text-right">Matr.</span>
            <span className="text-right">Conv.</span>
          </div>
          <ul className="m-0 flex list-none flex-col gap-0.5 px-2 pb-2">
            {rows.map((r) => {
              const active = cut === r.key;
              return (
                <li key={r.key}>
                  <button
                    type="button"
                    aria-pressed={active}
                    aria-label={conversionLabel(r)}
                    onClick={() => onCut(active ? null : r.key)}
                    className={cn(CONV_GRID, 'w-full min-w-0 overflow-hidden rounded-lg px-2.5 py-2 text-left hover:bg-muted/70', FOCUS, active && ROW_ON)}
                  >
                    <span className="truncate text-[12.5px] font-medium" title={rowTitleOf(r)}>
                      {r.name}
                      <SideText row={r} />
                    </span>
                    <span className="num text-right text-[12.5px]">{fmtNum(r.leads)}</span>
                    <span className={cn('num text-right text-[12.5px] font-semibold', GREEN_TEXT)}>{fmtNum(r.enrolled)}</span>
                    <span className="flex items-center justify-end gap-2">
                      <span className="h-2 w-12 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${r.conv ?? 0}%` }} />
                      </span>
                      <span className={cn('num w-9 text-right text-[12.5px] font-semibold', r.conv == null ? 'text-muted-foreground' : GREEN_TEXT)}>
                        {r.conv == null ? '—' : `${r.conv}%`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </CrmCard>
  );
}

// A lista de nomes por trás dos números. O cabeçalho repete o número que ela
// mostra e o filtro aplicado, com o botão de limpar. Mostra 50 nomes por vez,
// e o exportar leva todos. O listId diz que lista é esta (o submenu mais o
// filtro que a pessoa escolheu): quando ele muda, a lista volta aos 50
// primeiros, e enquanto ele é o mesmo o "Mostrar mais" se mantém, mesmo que
// chegue lead novo e os dados mudem. Os dois botões que saem de cena levam o
// foco com eles: limpar o filtro leva ao número da lista, e "Mostrar mais"
// leva à primeira linha que apareceu. A tabela se chama pelo número do
// cabeçalho ("120 leads").
export function ReportList({ listId = '', total, noun, cutLabel = null, onClearCut, columns, rows, emptyTitle, emptyText, pageSize = 50 }) {
  const [more, setMore] = useState({ listId, extra: 0 });
  if (more.listId !== listId) setMore({ listId, extra: 0 });
  const extra = more.listId === listId ? more.extra : 0;
  const countRef = useRef(null);
  const bodyRef = useRef(null);
  const countId = useId();
  const shown = rows.slice(0, pageSize + extra);
  const left = rows.length - shown.length;

  // O botão de limpar sai de cena junto com o filtro: o foco passa ao número
  // antes, senão cairia no body.
  const clearCut = () => {
    countRef.current?.focus();
    onClearCut?.();
  };
  // A linha nova só existe no DOM depois de renderizar. O flushSync a faz
  // aparecer na hora, para o foco ter onde pousar.
  const showMore = () => {
    const first = shown.length;
    flushSync(() => setMore({ listId, extra: extra + pageSize }));
    bodyRef.current?.rows[first]?.focus();
  };

  return (
    <section className="rounded-2xl border border-border bg-card shadow-card">
      <header className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-[18px] py-3.5', RULE)}>
        {/* O espaço entre o número e o nome não aparece (os dois são itens do flex), mas
            faz o texto ler "120 leads", que é também o nome da tabela. O número recebe o
            foco quando o filtro é limpo, e quem limpou pelo teclado vê o anel, como nos botões. */}
        <p id={countId} ref={countRef} tabIndex={-1} className={cn('m-0 flex items-baseline gap-2 rounded-md', FOCUS)} aria-live="polite">
          <span className="num font-display text-[24px] font-bold leading-none tracking-[-0.02em]">{fmtNum(total)}</span>
          {' '}
          <span className="text-[13px] font-semibold text-muted-foreground">{noun}</span>
        </p>
        {cutLabel && (
          <span className="inline-flex h-7 items-center gap-1 rounded-full bg-brand-50 pl-3 pr-1 text-[12px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            {cutLabel}
            <button
              type="button"
              onClick={clearCut}
              aria-label="Limpar filtro da lista"
              className={cn('grid size-5 place-items-center rounded-full hover:bg-brand-100 dark:hover:bg-brand-500/25', FOCUS)}
            >
              <X size={12} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </span>
        )}
      </header>
      {rows.length === 0 ? (
        <DashedNote className="m-4" title={emptyTitle} text={emptyText} />
      ) : (
        <>
          <div className="overflow-x-auto overscroll-x-contain">
            <table aria-labelledby={countId} className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      className={cn('whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground', CELL, c.className)}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody ref={bodyRef}>
                {shown.map((r) => (
                  <tr key={r.id} tabIndex={-1} className={cn('border-t', ROW_FOCUS, RULE)}>
                    {columns.map((c) => (
                      <td key={c.key} className={cn('text-[12.5px]', CELL, c.className)}>{c.render(r)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {left > 0 && (
            <div className={cn('border-t p-3 text-center', RULE)}>
              <button
                type="button"
                onClick={showMore}
                className={cn('h-9 rounded-full border border-border px-4 text-[12.5px] font-semibold hover:bg-muted/70', FOCUS)}
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
      className={cn('inline-flex h-9 items-center gap-2 rounded-full bg-brand-600 px-4 text-[12.5px] font-bold text-white hover:bg-brand-700 disabled:pointer-events-none disabled:opacity-40', FOCUS)}
    >
      <Download size={14} strokeWidth={2.2} aria-hidden="true" />
      Exportar lista
    </button>
  );
}

// Aviso do dado, como o agendamento incompleto antes de setembro de 2026.
export function ReportNotice({ children }) {
  return (
    <p className="m-0 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-2.5 text-[12.5px] text-amber-800 dark:text-amber-200">
      {children}
    </p>
  );
}
