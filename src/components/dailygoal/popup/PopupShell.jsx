import { useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../ui/dialog.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { cn } from '../../../lib/utils.js';
import { onRadioKeyDown, radioTabIndex, POPUP_FIELD } from './popupKit.js';

// A família dos pop-ups da Meta Diária (mockup B, 16/10/2026): título, quem é o
// lead com o contexto, corpo e o rodapé que diz o que falta. É o Dialog do
// shadcn, então tem role="dialog", o Esc fecha e o foco fica preso dentro. O
// foco abre no elemento com data-autofocus (a opção escolhida), e sem ele no
// primeiro que recebe foco. Enquanto grava (`busy`), fechar não faz nada.

const LABEL = 'mb-2 block text-[13px] font-semibold text-foreground';

export function PopupShell({ title, lead, context, chip = null, busy = false, onClose, hint = '', actions, children }) {
  const contentRef = useRef(null);
  return (
    <Dialog open onOpenChange={(next) => { if (!next && !busy) onClose?.(); }}>
      <DialogContent
        ref={contentRef}
        overlayClassName="z-[210] bg-slate-900/40 backdrop-blur-[5px] dark:bg-black/60"
        className="z-[210] flex max-h-[calc(100dvh-2rem)] flex-col gap-0 rounded-[20px] bg-popover p-0 text-popover-foreground shadow-2xl sm:max-w-[440px]"
        onOpenAutoFocus={(e) => {
          const target = contentRef.current?.querySelector('[data-autofocus]');
          if (target) { e.preventDefault(); target.focus(); }
        }}
      >
        <div className="px-5 pt-5 pr-12">
          <DialogTitle className="font-display text-[19px] font-semibold leading-tight tracking-[-0.015em]">{title}</DialogTitle>
        </div>
        <div className="mx-5 mt-3.5 flex items-center gap-3 rounded-[14px] bg-muted px-3 py-2.5">
          <Avatar name={lead?.name} size={38} />
          <DialogDescription asChild>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold leading-tight text-foreground">{lead?.name || 'Lead sem nome'}</span>
              {context && <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">{context}</span>}
            </div>
          </DialogDescription>
          {chip && (
            <span className={cn(
              'shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold',
              chip.muted
                ? 'bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-slate-200'
                : 'bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-[#9FBCFF]'
            )}>
              {chip.text}
            </span>
          )}
        </div>
        <div className="grid gap-[18px] overflow-y-auto px-5 pb-1.5 pt-[18px]">{children}</div>
        <div className="flex flex-wrap items-center gap-3 px-5 pb-[18px] pt-4">
          {/* Existe desde o começo, para o leitor de tela ler o que falta quando muda. */}
          <p role="status" className="min-w-0 flex-1 text-[12.5px] leading-snug text-rose-700 dark:text-rose-300">{hint}</p>
          <div className="ml-auto flex gap-2">{actions}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// O azul é o botão principal de todo pop-up, e só o "Registrar perda" é
// vermelho (`danger`). O fantasma é o de sair.
export function PopupButton({ kind = 'primary', className, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        'h-10 whitespace-nowrap rounded-xl px-4 text-[14px] font-semibold transition disabled:cursor-not-allowed',
        'outline-none focus-visible:anel-foco focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        kind === 'primary' && 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/40 disabled:hover:bg-brand-600/40',
        kind === 'danger' && 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-600/40 disabled:hover:bg-rose-600/40',
        kind === 'ghost' && 'text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}

const NOTE_TONE = {
  info: 'bg-brand-50 text-slate-700 dark:bg-brand-600/15 dark:text-slate-200 [&>svg]:text-brand-700 dark:[&>svg]:text-[#9FBCFF]',
  bad: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
};

export function PopupNote({ tone = 'info', icon: Icon = Info, children }) {
  return (
    <div className={cn('flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-[13px] leading-snug', NOTE_TONE[tone])}>
      <Icon size={16} className="mt-px shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function PopupLabel({ htmlFor, id, children }) {
  return htmlFor
    ? <label htmlFor={htmlFor} id={id} className={LABEL}>{children}</label>
    : <span id={id} className={LABEL}>{children}</span>;
}

// Escolha única em pílulas (os atalhos de dia e o motivo da perda).
export function ChoiceChips({ options, value, onChange, labelledBy, autoFocusSelected = false }) {
  const ids = options.map((o) => o.id);
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={radioTabIndex(o.id, ids, value)}
            data-autofocus={autoFocusSelected && on ? '' : undefined}
            onClick={() => onChange(o.id)}
            onKeyDown={(e) => onRadioKeyDown(e, ids, value, onChange)}
            className={cn(
              'h-[34px] rounded-full border px-[13px] text-[13px] transition outline-none focus-visible:anel-foco',
              on
                ? 'border-brand-200 bg-brand-50 font-semibold text-brand-700 dark:border-brand-500/45 dark:bg-brand-600/20 dark:text-[#9FBCFF]'
                : 'border-border bg-card font-medium text-foreground hover:border-brand-200 dark:hover:border-brand-500/45'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const LINK = 'justify-self-start rounded-md text-[13px] font-semibold text-brand-700 hover:underline outline-none focus-visible:anel-foco dark:text-[#9FBCFF]';

// A observação opcional fica escondida atrás de "+ Adicionar observação", para
// o pop-up nascer curto. Abrir leva o foco ao campo.
export function NoteToggle({ placeholder, value, onChange }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!open) {
    return <button type="button" className={LINK} onClick={() => setOpen(true)}>+ Adicionar observação</button>;
  }
  return (
    <div>
      <PopupLabel htmlFor={id}>Observação <span className="font-medium text-muted-foreground">(opcional)</span></PopupLabel>
      <textarea
        id={id}
        autoFocus
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(POPUP_FIELD, 'h-auto w-full resize-none py-2.5 leading-[1.45]')}
      />
    </div>
  );
}

// Atalhos que escrevem o motivo mais comum, e o campo para o resto.
const QUICK_REASONS = ['Não atendeu', 'Pediu para ligar depois', 'Sem resposta'];

export function MotivoField({ value, onChange }) {
  const id = useId();
  return (
    <div>
      <PopupLabel htmlFor={id}>Motivo do reagendamento</PopupLabel>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {QUICK_REASONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onChange(value.trim() ? `${value.trim()}. ${q}` : q)}
            className="h-7 rounded-full border border-dashed border-border px-2.5 text-[12.5px] text-muted-foreground transition hover:border-brand-500 hover:text-brand-700 outline-none focus-visible:anel-foco dark:hover:text-[#9FBCFF]"
          >
            {q}
          </button>
        ))}
      </div>
      <textarea
        id={id}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Escreva o motivo do reagendamento"
        className={cn(POPUP_FIELD, 'h-auto w-full resize-none py-2.5 leading-[1.45]')}
      />
    </div>
  );
}
