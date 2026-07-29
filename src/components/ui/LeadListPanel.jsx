import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useLeadProfile } from '../../contexts/LeadProfileContext.jsx';
import { Avatar } from './Avatar.jsx';

// Painel lateral genérico: "quem está por trás deste número". Recebe a lista
// PRONTA (não faz leitura própria) e uma função que rende a coluna da direita
// de cada linha. Serve qualquer número do dashboard — nasceu pros chips do
// Operacional e atende os KPIs do Gerencial sem mudança.
// Clicar no lead abre a ficha e FECHA o painel: openProfile troca o <main>
// inteiro, então deixar o painel montado por cima não faria sentido.
function LeadListPanel({ open, onClose, title, subtitle, leads = [], renderMeta, emptyText = 'Nada por aqui.' }) {
  const { openProfile } = useLeadProfile();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/25 dark:bg-black/50 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
      />
      <aside
        role="dialog"
        aria-label={title}
        className="relative w-full sm:w-[420px] h-full bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 motion-reduce:animate-none"
      >
        <header className="flex items-start gap-3 px-5 py-4 border-b border-border">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[15px] font-bold tracking-tight truncate">{title}</h2>
            {subtitle && <p className="text-[11.5px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 size-8 rounded-lg grid place-items-center text-muted-foreground hover:bg-slate-100 dark:hover:bg-white/[0.06] transition"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto thin-scroll">
          {leads.length === 0 ? (
            <p className="px-5 py-10 text-center text-[12.5px] text-slate-400 italic">{emptyText}</p>
          ) : (
            <ul>
              {leads.map((lead) => (
                <li key={lead.id} className="border-b border-slate-100 dark:border-white/[0.05] last:border-0">
                  <button
                    type="button"
                    onClick={() => { onClose(); openProfile(lead.id); }}
                    className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/[0.03] transition"
                  >
                    <Avatar name={lead.name} size={32} />
                    <span className="flex-1 min-w-0 text-[13px] font-medium truncate">{lead.name || 'Sem nome'}</span>
                    {renderMeta && <span className="shrink-0 text-[11.5px] num">{renderMeta(lead)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
}

export { LeadListPanel };
