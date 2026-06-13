import { useState } from 'react';
import { Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext.jsx';
import { Btn, IconBtn } from '../../components/ui/Btn.jsx';
import { SettingsCard } from '../../components/ui/SettingsCard.jsx';
import { PlanFormModal } from './TenantManageModal.jsx';

function SuperPlansTab({ plans, authHeader, onReload }) {
  const toast = useToast();
  const [editing, setEditing] = useState(undefined); // undefined = fechado · null = novo · obj = editar

  const del = async (p) => {
    if (p.tenantCount > 0) { toast.warning(`"${p.name}" tem ${p.tenantCount} organização(ões). Migre-as antes de excluir.`); return; }
    if (!window.confirm(`Excluir o plano "${p.name}"?`)) return;
    try {
      const res = await fetch('/api/plans', { method: 'DELETE', headers: await authHeader(), body: JSON.stringify({ planId: p.id }) });
      const data = await res.json();
      if (!res.ok) toast.error(data.error || 'Erro ao excluir.');
      else { toast.success('Plano excluído.'); onReload(); }
    } catch (e) { console.error('plan del', e); toast.error('Erro ao excluir.'); }
  };

  return (
    <SettingsCard
      title="Planos"
      hint="Crie e edite os planos oferecidos aos clientes"
      icon={<Tag size={16} />}
      action={<Btn kind="brand" icon={<Plus size={13} />} onClick={() => setEditing(null)}>Novo plano</Btn>}
    >
      {plans === null ? (
        <div className="text-center text-[12.5px] text-slate-400 py-10">Carregando...</div>
      ) : plans.length === 0 ? (
        <div className="text-center text-[12.5px] text-slate-400 italic py-10">Nenhum plano ainda. Crie o primeiro.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {plans.map(p => (
            <div key={p.id} className="group rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-semibold text-slate-900 dark:text-white">{p.name}</span>
                    {p.isDefault && <span className="text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">Padrão</span>}
                    {p.isActive === false && <span className="text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 dark:bg-white/[0.08] dark:text-slate-400">Inativo</span>}
                  </div>
                  <div className="text-[11.5px] text-slate-500 dark:text-slate-400 num mt-0.5">{p.slug}</div>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                  <IconBtn icon={<Pencil size={13} />} kind="edit" title="Editar" onClick={() => setEditing(p)} />
                  <IconBtn icon={<Trash2 size={13} />} kind="danger" title="Excluir" onClick={() => del(p)} />
                </div>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <span className="num text-[18px] font-bold text-slate-900 dark:text-white">R$ {Number(p.priceMonthly || 0).toLocaleString('pt-BR')}</span>
                  <span className="text-[11px] text-slate-400">/mês</span>
                  {Number(p.priceAnnual) > 0 && (
                    <div className="text-[11px] text-slate-400 num mt-0.5">R$ {Number(p.priceAnnual).toLocaleString('pt-BR')}/ano</div>
                  )}
                </div>
                <div className="text-right text-[11.5px] text-slate-500 dark:text-slate-400 num">
                  <div>{p.maxUsers == null ? 'Usuários ilimitados' : `${p.maxUsers} usuários`}</div>
                  <div>{p.tenantCount} org{p.tenantCount === 1 ? '' : 's'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing !== undefined && (
        <PlanFormModal plan={editing} authHeader={authHeader} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); onReload(); }} />
      )}
    </SettingsCard>
  );
}

// Aba "Financeiro" do super-admin. Lê os totais do super-overview (já carregado)
// + a lista de tenants. Cobrança é MANUAL (sem gateway): "Marcar pago" / "Suspender"
// usam o patch genérico (tenant-status). Receita por plano = soma do preço efetivo
// dos clientes ativos.
export { SuperPlansTab };
