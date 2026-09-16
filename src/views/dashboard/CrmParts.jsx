// Peças visuais do CRM portadas do handoff (docs/superpowers/specs/handoff-crm/
// CRM.dc.html): o título de seção com a régua de 2px, a casca de card, o
// cartão tracejado dos vazios e da falta de base, o sobretítulo, a leitura do
// rodapé, a etiqueta de escopo, a pílula de diferença dos cards de velocidade
// e o item de legenda.
import { cn } from '../../lib/utils.js';

const RULE = 'border-slate-100 dark:border-white/[0.06]';

// Título de seção com a pergunta e a régua de 2px (handoff, linhas 219 a 226).
// À direita, a nota do recorte ou a etiqueta (AGORA, na carteira).
export function CrmSection({ title, question, note, tag, children }) {
  return (
    <section>
      <div className="flex items-end justify-between gap-4 border-b-2 border-border pb-[9px]">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <h3 className="m-0 font-display text-[16px] font-bold tracking-[-0.01em]">{title}</h3>
          <span className="text-[12.5px] text-muted-foreground">{question}</span>
        </div>
        {tag ? (
          <span className="flex-none rounded-md bg-brand-50 px-[7px] py-[3px] text-[10px] font-bold uppercase tracking-[0.07em] text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            {tag}
          </span>
        ) : note ? (
          <span className="num hidden truncate text-[11.5px] text-muted-foreground sm:block">{note}</span>
        ) : null}
      </div>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

// Casca de card (handoff, linhas 229 a 239): cabeçalho com título de 14px e a
// dica de 11,5px; o corpo fica por conta de quem usa.
export function CrmCard({ title, hint, action, className, children }) {
  return (
    <section className={cn('flex flex-col rounded-2xl border border-border bg-card shadow-card', className)}>
      <header className={cn('flex items-center justify-between gap-3 border-b px-[18px] py-3.5', RULE)}>
        <div className="min-w-0">
          <h4 className="m-0 text-[14px] font-semibold">{title}</h4>
          {hint && <p className="num mt-0.5 text-[11.5px] text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

// Cartão tracejado dos vazios e da falta de base (handoff, linhas 363 a 368).
export function DashedNote({ title, text, className }) {
  return (
    <div className={cn('rounded-xl border border-dashed border-border px-[22px] py-[34px] text-center', className)}>
      <div className="text-[13px] font-semibold text-foreground/80">{title}</div>
      {text && <p className="mx-auto mt-1.5 max-w-[420px] text-pretty text-[12px] leading-[1.55] text-muted-foreground">{text}</p>}
    </div>
  );
}

export function Eyebrow({ className, children }) {
  return <div className={cn('text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground', className)}>{children}</div>;
}

// Leitura no rodapé do card.
export function ReadText({ className, children }) {
  if (!children) return null;
  return <p className={cn('mt-3 text-pretty text-[11.5px] leading-normal text-muted-foreground', className)}>{children}</p>;
}

// Etiqueta de escopo: âmbar para "academia inteira", neutra para "mediana da academia".
export function ScopeTag({ tone = 'neutral', children }) {
  return (
    <span
      className={cn(
        'flex-none whitespace-nowrap rounded-md px-[7px] py-[3px] text-[10px] font-bold uppercase tracking-[0.05em]',
        tone === 'amber'
          ? 'bg-amber-500/[0.12] text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
          : 'bg-muted text-muted-foreground'
      )}
    >
      {children}
    </span>
  );
}

// Pílula de diferença dos cards de velocidade (handoff, linhas 537 a 539).
// Com lowerBetter, cair é bom.
export function DeltaPill({ delta, lowerBetter = false }) {
  if (!delta) return null;
  const quiet = Boolean(delta.none || delta.flat);
  const good = !quiet && delta.up !== lowerBetter;
  return (
    <span
      className={cn(
        'num inline-flex h-5 flex-none items-center gap-[3px] whitespace-nowrap rounded-md px-1.5 text-[11px] font-semibold',
        quiet ? 'bg-muted text-muted-foreground'
          : good ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
            : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
      )}
    >
      {quiet ? delta.text : `${delta.up ? '▲' : '▼'} ${delta.text}`}
    </span>
  );
}

// Item de legenda: amostra de cor e rótulo (handoff, linhas 236 e 237).
export function Swatch({ className, children }) {
  return (
    <span className="inline-flex items-center gap-[5px] text-[11px] text-muted-foreground">
      <i className={cn('block h-2 w-3.5 rounded-[3px]', className)} />
      {children}
    </span>
  );
}
