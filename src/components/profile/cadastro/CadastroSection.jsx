import { Briefcase, Check, MapPin, Pencil, Phone, Plus, User } from 'lucide-react';
import { CADASTRO_SECTIONS, LOCKED_HINT, sectionStatus, viewRowsOf } from '../../../lib/cadastroSections.js';
import { cn } from '../../../lib/utils.js';
import { Btn } from '../../ui/Btn.jsx';

const ICONS = { identidade: User, endereco: MapPin, emergencia: Phone, pessoais: Briefcase };

// Um cartão do Cadastro: cabeçalho com o estado ("Falta RG e sexo" ou
// "Completo"), a leitura em linhas e, quando a seção está aberta, o formulário
// (children) com Cancelar e Salvar. `whole` é o formulário do lead inteiro,
// lido de readClientRegistration: dele saem o estado e as linhas da leitura.
// `locked` desliga o Editar e os "Adicionar" enquanto outra seção está aberta.
// O foco de abrir e de fechar é da aba (CadastroTab), pelo `sectionRef`: o
// Editar leva `data-cadastro-edit` para ela o achar na volta.
export function CadastroSection({ id, whole, editing, locked, saving, canSave, onEdit, onAdd, onCancel, onSave, sectionRef, children }) {
  const section = CADASTRO_SECTIONS.find((s) => s.id === id);
  const status = sectionStatus(id, whole);
  const Icon = status.ok ? Check : ICONS[id];
  const rows = viewRowsOf(id, whole);
  return (
    <section
      ref={sectionRef}
      aria-label={section.title}
      className={cn('overflow-hidden rounded-2xl border bg-card shadow-card', editing ? 'border-brand-300 dark:border-brand-500/50' : 'border-border')}
    >
      <header className="flex items-center gap-3 px-5 py-4">
        <span className={cn(
          'grid size-8 flex-none place-items-center rounded-lg',
          status.ok ? 'bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-300' : 'bg-brand-500/10 text-brand-700 dark:text-brand-300'
        )}>
          <Icon size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14.5px] font-semibold leading-tight">{section.title}</h3>
          <p className={cn('text-[12.5px]', status.ok ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-300')}>{status.text}</p>
        </div>
        {!editing && (
          <button
            type="button"
            data-cadastro-edit=""
            disabled={locked}
            onClick={onEdit}
            aria-label={`Editar ${section.title.toLowerCase()}`}
            title={locked ? LOCKED_HINT : undefined}
            className="inline-flex h-8 flex-none items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:anel-foco disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
          >
            <Pencil size={13} aria-hidden="true" />
            Editar
          </button>
        )}
      </header>

      {editing ? (
        <>
          {/* Durante a gravação o formulário fica parado: o que fosse digitado
              depois do Salvar sumiria quando a seção fecha. */}
          <div inert={saving || undefined} className="@container border-t border-border px-5 py-4">{children}</div>
          <footer className="flex justify-end gap-2 border-t border-border bg-slate-50 px-5 py-3 dark:bg-white/[0.03]">
            {/* Ligado durante o envio: sem internet a gravação só termina quando
                o servidor confirma, e fechar não a desfaz. */}
            <Btn kind="soft" size="md" onClick={onCancel}>{saving ? 'Fechar' : 'Cancelar'}</Btn>
            <Btn kind="brand" size="md" icon={<Check size={14} aria-hidden="true" />} onClick={onSave} disabled={saving || !canSave}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Btn>
          </footer>
        </>
      ) : (
        <dl className="divide-y divide-border/60 border-t border-border px-5">
          {rows.map((r) => (
            <div key={r.key} className="flex items-baseline gap-3 py-2.5">
              <dt className="w-[112px] flex-none text-[12.5px] text-muted-foreground">{r.label}</dt>
              <dd className="min-w-0 flex-1 break-words text-[13.5px]">
                {r.value ?? (
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => onAdd(r.field)}
                    title={locked ? LOCKED_HINT : undefined}
                    className="inline-flex items-center gap-1 rounded text-[13px] font-semibold text-brand-700 hover:underline focus-visible:outline-none focus-visible:anel-foco disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-300"
                  >
                    <Plus size={12} aria-hidden="true" />
                    {r.addLabel || 'Adicionar'}
                  </button>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
