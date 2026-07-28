// Peças compartilhadas pelas sete seções das Configurações (redesign 2026-07).
//
// O mockup tem densidades próprias (botões de 38/36/34px, ações de 30px com
// borda, tiles tracejados) que não existem no `Btn` global — ficam aqui, perto
// de quem usa, em vez de inchar o componente compartilhado do app.
//
// Formulários: o handoff não desenhou os modos de criar/editar de equipe,
// modalidade, unidade, professor, funil e etapa. Todos usam o mesmo diálogo
// (shadcn) — um só idioma para o que não foi desenhado.

import { Info, Plus } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '../../components/ui/dialog.jsx';

const BTN_KINDS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
  secondary: 'bg-card text-slate-700 border border-border hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.06]',
  soft: 'bg-muted text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-white/[0.1]',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
  dashed: 'border border-dashed border-border text-muted-foreground hover:border-brand-600 hover:text-brand-600'
};

const BTN_SIZES = { 38: 'h-[38px] px-4 text-[13px]', 36: 'h-9 px-3.5 text-[12.5px]', 34: 'h-[34px] px-3.5 text-[12.5px]' };

// Botão das seções — altura vem do mockup, por isso é explícita.
function SettingsBtn({ kind = 'secondary', size = 34, icon, children, className = '', ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[10px] font-semibold whitespace-nowrap transition active:scale-[.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        BTN_SIZES[size] || BTN_SIZES[34], BTN_KINDS[kind] || BTN_KINDS.secondary, className
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// Botão `+` quadrado do cabeçalho de Modalidades/Unidades.
function SettingsAddBtn({ label = 'Adicionar', ...props }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      {...props}
      className="size-8 grid place-items-center rounded-[10px] border border-border bg-card text-muted-foreground transition hover:border-brand-600 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
    >
      <Plus size={15} />
    </button>
  );
}

const ROW_ACTION_KINDS = {
  edit: 'hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/15 dark:hover:text-brand-300',
  danger: 'hover:bg-rose-500/[0.12] hover:text-rose-500 dark:hover:text-rose-400',
  neutral: 'hover:bg-muted hover:text-foreground'
};

// Ação de linha: com borda (tabelas) ou fantasma (grades e listas densas).
function RowAction({ icon, title, kind = 'edit', ghost = false, size = 30, ...props }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      {...props}
      style={{ width: size, height: size }}
      className={cn(
        'grid place-items-center rounded-lg text-slate-400 transition shrink-0',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
        !ghost && 'border border-border bg-card',
        ROW_ACTION_KINDS[kind] || ROW_ACTION_KINDS.edit
      )}
    >
      {icon}
    </button>
  );
}

// Tile tracejado que fecha as grades ("Novo professor", "Novo pacote").
function DashedTile({ icon, title, hint, className = '', ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'group flex flex-col items-start justify-center gap-1 p-4 rounded-[14px] border border-dashed border-border text-left transition',
        'hover:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
        className
      )}
    >
      <span className="text-slate-400 transition group-hover:text-brand-600">{icon}</span>
      <span className="text-[13px] font-semibold transition group-hover:text-brand-600">{title}</span>
      {hint && <span className="text-[11px] text-slate-400 dark:text-slate-500">{hint}</span>}
    </button>
  );
}

// Cabeçalho de tabela: rótulos em caixa alta sobre a faixa clara.
function TableHeadRow({ columns, template, className = '' }) {
  return (
    <div
      className={cn('grid gap-3 px-5 py-2.5 bg-muted/60 border-b border-border', className)}
      style={{ gridTemplateColumns: template }}
    >
      {columns.map((c, i) => (
        <div
          key={c.key ?? `col-${i}`}
          className={cn(
            'text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400 dark:text-slate-500 truncate',
            c.align === 'right' && 'text-right'
          )}
        >
          {c.label}
        </div>
      ))}
    </div>
  );
}

// Rodapé de nota do card (fundo claro + ícone de info).
function PanelNote({ children }) {
  return (
    <div className="px-5 py-3 bg-muted/60 border-t border-border flex items-start gap-2 text-[11.5px] text-muted-foreground">
      <Info size={13} className="shrink-0 mt-px" />
      <span>{children}</span>
    </div>
  );
}

// Vazio de tabela/lista — o handoff não desenhou, então é sóbrio de propósito.
function EmptyState({ children }) {
  return <div className="px-5 py-12 text-center text-[12.5px] text-muted-foreground">{children}</div>;
}

// Diálogo de formulário: uma casca para os fluxos que o handoff não desenhou.
function FormDialog({
  open, onOpenChange, title, description, children,
  onSubmit, submitLabel = 'Salvar', submitting = false, submitDisabled = false, footerLeft, size = 'md'
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('gap-5 rounded-2xl', size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
        <DialogHeader>
          <DialogTitle className="text-[16px]">{title}</DialogTitle>
          {description && <DialogDescription className="text-[12.5px]">{description}</DialogDescription>}
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); onSubmit?.(e); }}
          className="flex flex-col gap-4"
        >
          {children}
          <DialogFooter className="pt-1 items-center">
            {footerLeft && <div className="sm:mr-auto">{footerLeft}</div>}
            <SettingsBtn kind="soft" size={36} type="button" onClick={() => onOpenChange(false)}>Cancelar</SettingsBtn>
            <SettingsBtn kind="primary" size={36} type="submit" disabled={submitting || submitDisabled}>
              {submitting ? 'Salvando…' : submitLabel}
            </SettingsBtn>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Campo do diálogo. `hint` explica a regra quando ela não é óbvia.
function DialogField({ label, hint, children, className = '' }) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-[11.5px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

const FIELD_INPUT = 'w-full h-10 px-3 rounded-[10px] bg-card border border-border text-[13px] outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20';

export {
  SettingsBtn, SettingsAddBtn, RowAction, DashedTile, TableHeadRow,
  PanelNote, EmptyState, FormDialog, DialogField, FIELD_INPUT
};
