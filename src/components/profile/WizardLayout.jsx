import { Check } from 'lucide-react';
import { cn } from '../../lib/utils.js';

// As peças que o Agendar (ScheduleWizard) e o Mudar fase (PhaseChanger)
// dividem. O desenho A2 tira a pilha vertical de passos, que fazia a tela crescer
// para baixo: os passos viram uma linha numerada no topo, só o passo atual
// aparece embaixo, e o resumo, o progresso e os botões ficam numa coluna à
// direita. A altura mínima é fixa, então trocar de passo não empurra a página.
//
// `tone` tem o mesmo formato dos tons do app: { strong, ring, text, darkText,
// soft, darkSoft } (WZ_TONES no ScheduleWizard, getTone em lib/leadState.js).

export function WizardFrame({ stepper, stage, aside }) {
  return (
    <div className="grid grid-cols-1 gap-7 lg:min-h-[412px] lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
        {stepper}
        <div className="min-w-0">{stage}</div>
      </div>
      <aside className="flex flex-col gap-3">{aside}</aside>
    </div>
  );
}

function StepDot({ state, n, tone }) {
  if (state === 'done') {
    return (
      <span className={cn('grid size-7 flex-none place-items-center rounded-full text-white', tone.strong)}>
        <Check size={14} strokeWidth={2.6} aria-hidden="true" />
      </span>
    );
  }
  if (state === 'active') {
    return (
      <span className={cn('num grid size-7 flex-none place-items-center rounded-full bg-card text-[12.5px] font-bold ring-2', tone.ring, tone.text, tone.darkText)}>
        {n}
      </span>
    );
  }
  return (
    <span className="num grid size-7 flex-none place-items-center rounded-full bg-slate-100 text-[12.5px] font-bold text-slate-400 dark:bg-white/[0.05] dark:text-slate-500">
      {n}
    </span>
  );
}

// steps: [{ key, title, value, state: 'done' | 'active' | 'locked', onEdit }].
// O passo concluído é um botão (clicar edita), e traz o título pequeno e o valor
// escolhido. O atual e o bloqueado mostram só o título.
export function WizardStepper({ steps, label, tone }) {
  return (
    <ol aria-label={label} className="mb-[18px] flex items-center border-b border-border pb-4">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const text = (
          <span className="min-w-0 text-left">
            {s.value ? (
              <>
                <small className="block text-[12px] leading-tight text-muted-foreground">{s.title}</small>
                <b className={cn('block max-w-[132px] truncate text-[13.5px] font-semibold leading-tight', s.state === 'done' && cn(tone.text, tone.darkText))}>{s.value}</b>
              </>
            ) : (
              <b className={cn('block max-w-[132px] truncate text-[13.5px] leading-tight', s.state === 'active' ? 'font-semibold' : 'font-medium text-slate-400 dark:text-slate-500')}>{s.title}</b>
            )}
          </span>
        );
        return (
          <li key={s.key} aria-current={s.state === 'active' ? 'step' : undefined} className={cn('flex min-w-0 items-center', !last && 'flex-1')}>
            {s.state === 'done' ? (
              <button
                type="button"
                onClick={s.onEdit}
                title={`Editar ${s.title.toLowerCase()}`}
                className="-my-1.5 -ml-1.5 flex min-w-0 items-center gap-2.5 rounded-xl py-1.5 pl-1.5 pr-2.5 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:anel-foco dark:hover:bg-white/[0.05]"
              >
                <StepDot state={s.state} n={i + 1} tone={tone} />
                {text}
              </button>
            ) : (
              <span className="flex min-w-0 items-center gap-2.5">
                <StepDot state={s.state} n={i + 1} tone={tone} />
                {text}
              </span>
            )}
            {!last && (
              <i
                aria-hidden="true"
                className={cn('mx-2 h-0.5 min-w-3 flex-1 rounded-full transition-colors', s.state === 'done' ? tone.strong : 'bg-slate-200 dark:bg-white/[0.08]')}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export const StageHead = ({ title, hint }) => (
  <div className="mb-3 mt-0.5">
    <div className="text-[15px] font-semibold">{title}</div>
    {hint && <div className="mt-px text-[13px] text-muted-foreground">{hint}</div>}
  </div>
);

// O cartão de resumo da coluna da direita. Fica cinza enquanto falta algo e
// ganha o tom do assistente quando está completo.
export function WizardSummary({ tone, Icon, label, title, complete, children }) {
  return (
    <div className={cn('flex gap-3 rounded-2xl border p-3.5 transition', complete ? cn(tone.soft, tone.darkSoft, 'border-transparent') : 'border-border bg-slate-50 dark:bg-white/[0.02]')}>
      <span className={cn('grid size-9 flex-none place-items-center rounded-[11px]', complete ? cn(tone.strong, 'text-white') : 'bg-card text-muted-foreground')}>
        <Icon size={17} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-muted-foreground">{label}</div>
        {title && <div className="mt-px text-[15px] font-semibold">{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function WizardProgress({ done, total, tone }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-baseline justify-between text-[13px] text-muted-foreground">
        <span>Progresso</span>
        <b className="num font-semibold text-foreground">{done}/{total}</b>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.05]"
        role="progressbar"
        aria-label="Progresso"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div className={cn('h-full transition-[width] duration-300 motion-reduce:transition-none', tone.strong)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function WizardNote({ id, label, placeholder, value, onChange }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[12.5px] text-muted-foreground">{label}</label>
      <textarea
        id={id}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full resize-none rounded-xl border border-border bg-slate-50 px-3.5 py-2.5 text-[14px] outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus-visible:anel-foco dark:bg-white/[0.03]"
      />
    </div>
  );
}

// Um cartão de opção (fase, funil, Venda, Perda). `tile` troca o ícone por um
// nó (o número da etapa). `current` é a fase em que a pessoa já está: aparece
// tracejada e desligada.
export function WizardOption({ tone, Icon, tile, label, hint, selected = false, current = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={current}
      aria-pressed={selected}
      className={cn(
        'relative flex min-w-0 items-center gap-3 rounded-[14px] border p-3 text-left transition focus-visible:outline-none focus-visible:anel-foco',
        selected
          ? cn(tone.soft, tone.darkSoft, 'border-transparent ring-2', tone.ring)
          : current
            ? 'cursor-default border-dashed border-border bg-slate-50 dark:bg-white/[0.02]'
            : 'border-border bg-card hover:border-slate-300 dark:hover:border-white/15'
      )}
    >
      <span className={cn('grid size-9 flex-none place-items-center rounded-[11px]', selected ? cn(tone.strong, 'text-white') : 'bg-slate-100 text-muted-foreground dark:bg-white/[0.06]')}>
        {tile ?? (Icon && <Icon size={17} aria-hidden="true" />)}
      </span>
      <span className="min-w-0 flex-1">
        <b className={cn('block text-[14px] font-semibold leading-tight', selected && cn(tone.text, tone.darkText))}>{label}</b>
        {hint && <small className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">{hint}</small>}
      </span>
      {selected && (
        <span className={cn('grid size-5 flex-none place-items-center rounded-full text-white', tone.strong)}>
          <Check size={12} strokeWidth={2.8} aria-hidden="true" />
        </span>
      )}
    </button>
  );
}
