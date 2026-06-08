import { useState } from 'react';
import { Ban, Check, Eye } from 'lucide-react';
import { planLabel, slugify } from '../../lib/superadmin.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { Btn } from '../../components/ui/Btn.jsx';
import { Field, StyledInput, StyledSelect } from '../../components/ui/Field.jsx';

function TenantManageModal({ t, stats, busy, plans, onClose, onCopy, onPatch, onExtendTrial, onSetActive, onEnterAs, onArchive }) {
  const [sub, setSub] = useState('visao');
  const [trialDays, setTrialDays] = useState('');
  const [f, setF] = useState({
    displayName: t.displayName || '',
    city: t.settings?.city || '',
    state: t.settings?.state || '',
    logoUrl: t.settings?.logoUrl || '',
    paymentStatus: t.paymentStatus || '',
    nextBillingAt: t.nextBillingAt ? new Date(t.nextBillingAt).toISOString().slice(0, 10) : '',
    notes: t.internalNotes || '',
    price: t.monthlyPrice != null ? String(t.monthlyPrice) : '',
  });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const d = stats?.data;
  const seatLabel = d ? (d.maxUsers == null ? `${d.userCount} (ilimitado)` : `${d.userCount}/${d.maxUsers}`) : '—';
  const planOptions = (() => {
    const list = (plans || []).filter(p => p.isActive !== false || p.slug === t.plan);
    return list.length ? list : ['starter', 'pro', 'enterprise'].map(s => ({ slug: s, name: planLabel(s) }));
  })();

  const saveBilling = () => onPatch({
    paymentStatus: f.paymentStatus || null,
    nextBillingAt: f.nextBillingAt ? new Date(f.nextBillingAt + 'T12:00:00').getTime() : null,
    monthlyPrice: f.price === '' ? null : Number(f.price),
    internalNotes: f.notes,
  }, 'Cobrança atualizada.');
  const saveConfig = () => {
    if (!f.displayName.trim()) return;
    onPatch({ displayName: f.displayName.trim(), settings: { city: f.city.trim(), state: f.state.trim(), logoUrl: f.logoUrl.trim() } }, 'Configurações salvas.');
  };

  const statBox = (label, value) => (
    <div className="rounded-xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] p-3 text-center">
      <div className="num text-[18px] font-semibold tracking-tight text-slate-900 dark:text-white">{value}</div>
      <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">{label}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/55 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative w-full max-w-[540px] max-h-[92vh] overflow-y-auto custom-scrollbar rounded-2xl bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/[0.08] shadow-[0_30px_80px_-20px_rgba(8,13,34,.55)]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200/80 dark:border-white/[0.07]">
          <div className="min-w-0">
            <h2 className="font-display text-[17px] font-bold tracking-tight truncate text-gray-900 dark:text-white">{t.displayName}</h2>
            <div className="text-[11.5px] text-slate-500 dark:text-slate-400 num truncate">{t.id}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-white/[0.06] transition shrink-0"><X size={17} /></button>
        </div>

        {/* sub-abas */}
        <div className="px-5 pt-3 flex gap-1 flex-wrap border-b border-slate-200/80 dark:border-white/[0.07]">
          {[{ id: 'visao', label: 'Visão Geral' }, { id: 'plano', label: 'Plano & Cobrança' }, { id: 'config', label: 'Configurações' }, { id: 'acoes', label: 'Ações' }].map(s => (
            <button key={s.id} type="button" onClick={() => setSub(s.id)}
              className={`px-3 h-8 text-[12px] font-semibold transition -mb-px border-b-2 ${sub === s.id ? 'border-brand-600 text-brand-700 dark:text-brand-300' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {sub === 'visao' && (
            <>
              <div className="grid grid-cols-3 gap-2.5">
                {statBox('Leads', d ? d.leadCount : (stats?.loading ? '…' : '—'))}
                {statBox('Interações', d ? d.interactionCount : (stats?.loading ? '…' : '—'))}
                {statBox('Usuários', d ? seatLabel : (stats?.loading ? '…' : '—'))}
              </div>
              <div className="space-y-1.5 text-[12.5px]">
                <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">Plano</span><span className="font-medium text-slate-800 dark:text-slate-100">{planLabel(t.plan)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">Admin principal</span><span className="font-medium text-slate-800 dark:text-slate-100 truncate">{t.primaryAdminEmail || '—'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">Criada em</span><span className="num text-slate-800 dark:text-slate-100">{t.createdAt ? new Date(t.createdAt).toLocaleDateString('pt-BR') : '—'}</span></div>
                <div className="flex justify-between gap-3 items-center"><span className="text-slate-500 dark:text-slate-400">Link de acesso</span><button onClick={onCopy} className="font-semibold text-brand-700 dark:text-brand-300 hover:underline num">copiar /{t.id}</button></div>
              </div>
              {stats?.error && <p className="text-[11.5px] text-rose-600 dark:text-rose-400">{stats.error}</p>}
            </>
          )}

          {sub === 'plano' && (
            <>
              <div>
                <div className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Plano</div>
                <div className="flex gap-1.5 flex-wrap">
                  {planOptions.map(p => (
                    <button key={p.slug} type="button" disabled={!!busy} onClick={() => p.slug !== t.plan && onPatch({ plan: p.slug }, `Plano alterado para ${p.name || p.slug}.`)}
                      className={`h-9 px-3 rounded-lg text-[12.5px] font-semibold transition disabled:opacity-50 ${t.plan === p.slug ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.04] dark:text-slate-300'}`}>
                      {p.name || p.slug}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Trial</span>
                  {t.status === 'trial' && t.trialEndsAt && (
                    <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">{(() => { const left = Math.max(0, Math.ceil((t.trialEndsAt - Date.now()) / 86400000)); return left <= 0 ? 'termina hoje' : `${left} dia${left === 1 ? '' : 's'} restante${left === 1 ? '' : 's'}`; })()}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" value={trialDays} onChange={e => setTrialDays(e.target.value)} placeholder="dias"
                    className="w-24 h-9 px-3 rounded-lg text-[13px] num bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] outline-none focus:border-brand-500" />
                  <button type="button" disabled={!!busy || trialDays === ''} onClick={() => { onExtendTrial(trialDays); setTrialDays(''); }}
                    className="h-9 px-3 rounded-lg text-[12.5px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-200 disabled:opacity-50 transition">Aplicar</button>
                  <span className="text-[11px] text-slate-400">0 = ativa</span>
                </div>
              </div>
              <div className="space-y-3 rounded-xl border border-slate-200 dark:border-white/[0.07] p-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Pagamento">
                    <StyledSelect value={f.paymentStatus} onChange={e => set('paymentStatus', e.target.value)}>
                      <option value="">—</option>
                      <option value="paid">Pago</option>
                      <option value="pending">Pendente</option>
                      <option value="overdue">Inadimplente</option>
                    </StyledSelect>
                  </Field>
                  <Field label="Próxima cobrança"><StyledInput type="date" value={f.nextBillingAt} onChange={e => set('nextBillingAt', e.target.value)} /></Field>
                </div>
                <Field label="Valor negociado (R$/mês)" hint="vazio = preço do plano · entra no MRR">
                  <StyledInput type="number" min="0" value={f.price} onChange={e => set('price', e.target.value)} placeholder={`padrão (${planLabel(t.plan)})`} />
                </Field>
                <Field label="Notas internas (só você vê)">
                  <textarea value={f.notes} onChange={e => set('notes', e.target.value)} rows={3} maxLength={2000}
                    className="w-full px-3 py-2 rounded-lg text-[12.5px] bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] outline-none focus:border-brand-500 resize-none custom-scrollbar" placeholder="Contato, negociação, observações..." />
                </Field>
                <div className="flex justify-end"><Btn kind="brand" icon={<Check size={13} />} onClick={saveBilling} disabled={!!busy}>Salvar cobrança</Btn></div>
              </div>
            </>
          )}

          {sub === 'config' && (
            <div className="space-y-3">
              <Field label="Nome da organização"><StyledInput value={f.displayName} onChange={e => set('displayName', e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cidade"><StyledInput value={f.city} onChange={e => set('city', e.target.value)} placeholder="Ex: Porto Alegre" /></Field>
                <Field label="Estado"><StyledInput value={f.state} onChange={e => set('state', e.target.value)} placeholder="Ex: RS" /></Field>
              </div>
              <Field label="Logo (URL)" hint="opcional"><StyledInput value={f.logoUrl} onChange={e => set('logoUrl', e.target.value)} placeholder="https://..." /></Field>
              <div className="flex justify-end"><Btn kind="brand" icon={<Check size={13} />} onClick={saveConfig} disabled={!!busy}>Salvar configurações</Btn></div>
              <p className="text-[11px] text-slate-400">O identificador (slug <span className="num">{t.id}</span>) é imutável.</p>
            </div>
          )}

          {sub === 'acoes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-white/[0.07] px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Conta interna / teste</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500">Fora do MRR e dos KPIs de negócio.</div>
                </div>
                <button type="button" disabled={!!busy} onClick={() => onPatch({ internal: !t.internal }, t.internal ? 'Voltou a contar como cliente.' : 'Marcada como interna/teste.')}
                  role="switch" aria-checked={!!t.internal}
                  className={`relative w-11 h-6 rounded-full transition shrink-0 disabled:opacity-50 ${t.internal ? 'bg-brand-600' : 'bg-slate-300 dark:bg-white/[0.15]'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${t.internal ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={onCopy} className="h-9 px-3 rounded-lg text-[12.5px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-200 transition">Copiar link</button>
                {!t.archived && (t.status === 'active' || t.status === 'trial') && (
                  <button onClick={onEnterAs} disabled={!!busy}
                    className="h-9 px-3 rounded-lg text-[12.5px] font-semibold bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-300 disabled:opacity-50 transition inline-flex items-center gap-1"><Eye size={13} /> Entrar como</button>
                )}
                {t.status === 'suspended' ? (
                  <button onClick={() => onSetActive('active')} disabled={!!busy}
                    className="h-9 px-3 rounded-lg text-[12.5px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 disabled:opacity-50 transition">Reativar</button>
                ) : (
                  <button onClick={() => onSetActive('suspended')} disabled={!!busy}
                    className="h-9 px-3 rounded-lg text-[12.5px] font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300 disabled:opacity-50 transition inline-flex items-center gap-1"><Ban size={13} /> Suspender</button>
                )}
                <button onClick={onArchive} disabled={!!busy}
                  className="ml-auto h-9 px-3 rounded-lg text-[12.5px] font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 disabled:opacity-50 transition">Desativar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Modal de criar/editar um plano (super-admin). POST/PUT em /api/plans.
function PlanFormModal({ plan, authHeader, onClose, onSaved }) {
  const toast = useToast();
  const editing = !!plan?.id;
  const [form, setForm] = useState({
    name: plan?.name || '',
    slug: plan?.slug || '',
    unlimited: plan?.maxUsers == null && editing,
    maxUsers: plan?.maxUsers != null ? String(plan.maxUsers) : '',
    priceMonthly: plan?.priceMonthly != null ? String(plan.priceMonthly) : '',
    priceAnnual: plan?.priceAnnual != null ? String(plan.priceAnnual) : '',
    extraUserPrice: plan?.extraUserPrice != null ? String(plan.extraUserPrice) : '',
    maxExtraUsers: plan?.maxExtraUsers != null ? String(plan.maxExtraUsers) : '',
    isActive: plan?.isActive !== false,
    isDefault: plan?.isDefault === true,
    order: plan?.order != null ? String(plan.order) : '0',
    features: Array.isArray(plan?.features) ? plan.features.join('\n') : '',
  });
  const [slugTouched, setSlugTouched] = useState(editing);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const onName = (v) => setForm(f => ({ ...f, name: v, slug: slugTouched ? f.slug : slugify(v) }));

  const save = async () => {
    if (!form.name.trim()) { toast.warning('Informe o nome do plano.'); return; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) { toast.warning('Slug inválido: minúsculas, números e hífen.'); return; }
    setSaving(true);
    const body = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      maxUsers: form.unlimited ? null : (form.maxUsers === '' ? 1 : Number(form.maxUsers)),
      priceMonthly: form.priceMonthly === '' ? 0 : Number(form.priceMonthly),
      priceAnnual: form.priceAnnual === '' ? null : Number(form.priceAnnual),
      extraUserPrice: form.extraUserPrice === '' ? null : Number(form.extraUserPrice),
      maxExtraUsers: form.maxExtraUsers === '' ? null : Number(form.maxExtraUsers),
      isActive: form.isActive,
      isDefault: form.isDefault,
      order: form.order === '' ? 0 : Number(form.order),
      features: form.features.split('\n').map(s => s.trim()).filter(Boolean),
    };
    try {
      const res = await fetch('/api/plans', {
        method: editing ? 'PUT' : 'POST',
        headers: await authHeader(),
        body: JSON.stringify(editing ? { planId: plan.id, ...body } : body),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erro ao salvar o plano.'); setSaving(false); return; }
      toast.success(editing ? 'Plano atualizado.' : 'Plano criado.');
      onSaved();
    } catch (e) { console.error('plan save', e); toast.error('Erro ao salvar o plano.'); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/55 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative w-full max-w-[480px] max-h-[92vh] overflow-y-auto custom-scrollbar rounded-2xl bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/[0.08] shadow-[0_30px_80px_-20px_rgba(8,13,34,.55)]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200/80 dark:border-white/[0.07]">
          <h2 className="font-display text-[17px] font-bold tracking-tight text-gray-900 dark:text-white">{editing ? 'Editar plano' : 'Novo plano'}</h2>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-white/[0.06] transition"><X size={17} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome"><StyledInput value={form.name} onChange={e => onName(e.target.value)} placeholder="Ex: Pro Anual" /></Field>
            <Field label="Slug" hint="referenciado no tenant"><StyledInput value={form.slug} onChange={e => { setSlugTouched(true); set('slug', slugify(e.target.value)); }} placeholder="pro-anual" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Máx. usuários">
              <div className="flex items-center gap-2">
                <StyledInput type="number" min="1" value={form.unlimited ? '' : form.maxUsers} onChange={e => set('maxUsers', e.target.value)} disabled={form.unlimited} placeholder={form.unlimited ? 'Ilimitado' : 'ex: 10'} className="flex-1" />
                <label className="flex items-center gap-1.5 text-[11.5px] text-slate-600 dark:text-slate-300 whitespace-nowrap cursor-pointer">
                  <input type="checkbox" checked={form.unlimited} onChange={e => set('unlimited', e.target.checked)} /> ∞
                </label>
              </div>
            </Field>
            <Field label="Ordem"><StyledInput type="number" value={form.order} onChange={e => set('order', e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço mensal (R$)"><StyledInput type="number" min="0" value={form.priceMonthly} onChange={e => set('priceMonthly', e.target.value)} placeholder="197" /></Field>
            <Field label="Preço anual (R$)" hint="opcional"><StyledInput type="number" min="0" value={form.priceAnnual} onChange={e => set('priceAnnual', e.target.value)} placeholder="—" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço usuário extra" hint="opcional"><StyledInput type="number" min="0" value={form.extraUserPrice} onChange={e => set('extraUserPrice', e.target.value)} placeholder="—" /></Field>
            <Field label="Máx. extras" hint="opcional"><StyledInput type="number" min="0" value={form.maxExtraUsers} onChange={e => set('maxExtraUsers', e.target.value)} placeholder="—" /></Field>
          </div>
          <Field label="Features (uma por linha)" hint="exibidas na UI">
            <textarea value={form.features} onChange={e => set('features', e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded-lg text-[12.5px] bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] outline-none focus:border-brand-500 resize-none custom-scrollbar" placeholder={'Suporte prioritário\nRelatórios avançados'} />
          </Field>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-slate-200 cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} /> Ativo
            </label>
            <label className="flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-slate-200 cursor-pointer">
              <input type="checkbox" checked={form.isDefault} onChange={e => set('isDefault', e.target.checked)} /> Padrão ao criar org
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Btn kind="soft" onClick={onClose}>Cancelar</Btn>
            <Btn kind="brand" icon={<Check size={13} />} onClick={save} disabled={saving}>{saving ? 'Salvando...' : (editing ? 'Salvar' : 'Criar plano')}</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// Aba "Planos" do super-admin: lista os planos (GET /api/plans, semeia se vazio)
// e abre o PlanFormModal para criar/editar. Excluir é bloqueado pela API se o
// plano estiver em uso por alguma organização.
export { TenantManageModal, PlanFormModal };
