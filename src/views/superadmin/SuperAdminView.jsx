import { useState, useEffect, useMemo } from 'react';
import { signInWithCustomToken, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { auth } from '../../lib/firebase.js';
import { IMPERSONATION_KEY, slugify, planLabel, tenantSeatLabel, tenantHealth, lastActivityLabel, auditActionLabel } from '../../lib/superadmin.js';
import { timeAgo } from '../../lib/format.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { Btn } from '../../components/ui/Btn.jsx';
import { Field, StyledInput, StyledSelect } from '../../components/ui/Field.jsx';
import { SettingsCard } from '../../components/ui/SettingsCard.jsx';
import { SuperOverviewCards } from './SuperOverviewCards.jsx';
import { SuperPlansTab } from './SuperPlansTab.jsx';
import { SuperFinanceTab } from './SuperFinanceTab.jsx';
import { TenantManageModal } from './TenantManageModal.jsx';
import { GymProfileFields } from '../../components/profile/GymProfileFields.jsx';
import { EMPTY_PROFILE, buildTenantProfilePayload } from '../../lib/gymProfile.js';
import { Activity, AlertCircle, Ban, Building2, Check, Eye, FileText, Globe, Plus, Search, Settings } from 'lucide-react';

function SuperAdminView({ tab, onOpenConsole }) {
  const toast = useToast();
  const [tenants, setTenants] = useState([]);
  const [overview, setOverview] = useState(null);     // totais agregados da plataforma (KPIs)
  const [audit, setAudit] = useState([]);             // log de atividade do super-admin
  const [asaasConfigured, setAsaasConfigured] = useState(false); // gateway Asaas tem chaves?
  const [loadingList, setLoadingList] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ displayName: '', tenantId: '', adminName: '', adminEmail: '', adminPassword: '', plan: 'starter', trialDays: '', ...EMPTY_PROFILE });
  const [slugTouched, setSlugTouched] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [cpfInvalid, setCpfInvalid] = useState(false);
  const [manage, setManage] = useState(null);          // org aberta no painel de detalhe
  const [stats, setStats] = useState(null);            // { loading, data }
  const [manageBusy, setManageBusy] = useState(null);  // ação em andamento no detalhe
  const [search, setSearch] = useState('');            // busca por nome/slug/e-mail
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | trial | suspended | risk | internal
  const [sortBy, setSortBy] = useState('name');        // name | activity | revenue
  const [plans, setPlans] = useState(null);            // planos (GET /api/plans) — null = carregando
  const [paymentFilter, setPaymentFilter] = useState('all'); // all | paid | pending | overdue

  // Copia o link de acesso da academia (stronilead.com.br/<slug>).
  const copyTenantLink = async (slug) => {
    const url = `${window.location.origin}/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`Link copiado: ${url}`);
    } catch {
      toast.info(url);
    }
  };

  const authHeader = async () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${await auth.currentUser.getIdToken()}`
  });

  // "Entrar como": gera o acesso de visualização e troca a sessão para o admin
  // do cliente. Guarda o token de retorno no sessionStorage (o banner e o "sair"
  // ficam no App). A sessão troca e este painel desmonta — não reseto o busy.
  const enterAs = async (tenant) => {
    if (manageBusy) return;
    setManageBusy('impersonate');
    try {
      const res = await fetch('/api/impersonate', {
        method: 'POST', headers: await authHeader(),
        body: JSON.stringify({ tenantId: tenant.id })
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Não foi possível entrar como esta organização.'); setManageBusy(null); return; }
      try {
        // Só metadados de exibição (sem token) — o retorno é emitido on-demand.
        sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify({
          viewing: { id: tenant.id, name: data.tenantName || tenant.displayName },
          at: Date.now()
        }));
      } catch { /* ignore */ }
      // Persistência de SESSÃO (por aba): a sessão impersonada nunca "gruda" além
      // da aba — fechar/reabrir sai da visualização (volta ao login) em vez de
      // prender o dono dentro da conta do cliente.
      try { await setPersistence(auth, browserSessionPersistence); } catch { /* ignore */ }
      await signInWithCustomToken(auth, data.token);
      // onAuthStateChanged remonta o app como o admin do cliente; o banner aparece.
    } catch (e) {
      console.error('enterAs', e);
      toast.error('Não foi possível entrar como esta organização.');
      setManageBusy(null);
    }
  };

  // Carrega a visão geral (totais agregados + tenants enriquecidos) num único GET.
  const loadTenants = async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/super-overview', { headers: await authHeader() });
      const data = await res.json();
      if (res.ok) { setTenants(data.tenants || []); setOverview(data.totals || null); setAudit(data.audit || []); setAsaasConfigured(!!data.asaasConfigured); }
      else toast.error(data.error || 'Erro ao carregar a visão geral.');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar a visão geral.');
    }
    setLoadingList(false);
  };

  // Planos: alimentam a aba Planos e o seletor de plano dinâmico do modal.
  const loadPlans = async () => {
    try {
      const res = await fetch('/api/plans', { headers: await authHeader() });
      const data = await res.json();
      if (res.ok) setPlans(data.plans || []);
      else { toast.error(data.error || 'Erro ao carregar planos.'); setPlans([]); }
    } catch (e) { console.error('loadPlans', e); toast.error('Erro ao carregar planos.'); setPlans([]); }
  };

  useEffect(() => { loadTenants(); loadPlans(); }, []);

  // Abre o painel de detalhe e busca as estatísticas de uso (Admin SDK).
  const openManage = async (t) => {
    setManage(t);
    if (plans === null) loadPlans(); // seletor de plano dinâmico no modal
    setStats({ loading: true });
    try {
      const res = await fetch(`/api/tenant-status?tenantId=${encodeURIComponent(t.id)}`, { headers: await authHeader() });
      const data = await res.json();
      setStats(res.ok ? { data } : { error: data.error || 'Erro ao carregar uso.' });
    } catch (e) {
      console.error(e);
      setStats({ error: 'Erro ao carregar uso.' });
    }
  };
  const closeManage = () => { setManage(null); setStats(null); };

  // Patch genérico no tenant-status (plano / trial / status / arquivar).
  const patchTenant = async (tenantId, body, successMsg, action) => {
    if (manageBusy) return false;
    setManageBusy(action || 'patch');
    let ok = false;
    try {
      const res = await fetch('/api/tenant-status', {
        method: 'POST', headers: await authHeader(),
        body: JSON.stringify({ tenantId, ...body })
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erro ao atualizar organização.'); }
      else {
        ok = true;
        if (successMsg) toast.success(successMsg);
        setManage(m => (m && m.id === tenantId ? { ...m, ...body } : m));
        loadTenants();
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao atualizar organização.');
    }
    setManageBusy(null);
    return ok;
  };

  const extendTrial = (tenantId, days) => patchTenant(tenantId, { trialDays: Number(days) }, Number(days) > 0 ? `Trial de ${days} dias aplicado.` : 'Trial encerrado.', 'trial');
  const setActive = (tenantId, status) => patchTenant(tenantId, { status }, status === 'active' ? 'Organização ativada.' : 'Organização suspensa.', 'status');
  const setArchived = async (tenantId, archived) => {
    if (archived && !window.confirm('Desativar esta organização? Os usuários perdem o acesso (dados preservados). Você pode restaurar depois.')) return;
    const ok = await patchTenant(tenantId, { archived }, archived ? 'Organização desativada.' : 'Organização restaurada.', 'archive');
    if (ok && archived) closeManage();
  };

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const onNameChange = (v) => {
    setForm(f => ({ ...f, displayName: v, tenantId: slugTouched ? f.tenantId : slugify(v) }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.displayName.trim() || !form.tenantId.trim() || !form.adminName.trim() || !form.adminEmail.trim() || !form.adminPassword) {
      toast.warning('Preencha todos os campos.');
      return;
    }
    if (form.adminPassword.length < 6) { toast.warning('Senha precisa ter ao menos 6 caracteres.'); return; }
    if (cpfInvalid) { toast.warning('O CPF do responsável é inválido. Corrija antes de criar.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/provision-tenant', {
        method: 'POST',
        headers: await authHeader(),
        body: JSON.stringify({
          tenantId: form.tenantId.trim(),
          displayName: form.displayName.trim(),
          adminName: form.adminName.trim(),
          adminEmail: form.adminEmail.trim(),
          adminPassword: form.adminPassword,
          plan: form.plan,
          trialDays: form.trialDays ? Number(form.trialDays) : 0,
          ...buildTenantProfilePayload(form),
        })
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erro ao criar organização.'); setSubmitting(false); return; }
      toast.success(`Organização "${form.displayName.trim()}" criada. Admin: ${form.adminEmail.trim()}`, { duration: 8000, title: 'Organização provisionada' });
      setForm({ displayName: '', tenantId: '', adminName: '', adminEmail: '', adminPassword: '', plan: 'starter', trialDays: '', ...EMPTY_PROFILE });
      setSlugTouched(false);
      setProfileOpen(false);
      loadTenants();
    } catch (e2) {
      console.error(e2);
      toast.error('Erro ao criar organização.');
    }
    setSubmitting(false);
  };

  const activeTenants = tenants.filter(t => !t.archived);
  const archivedTenants = tenants.filter(t => t.archived);

  // Busca + filtro + ordenação (client-side, sobre as organizações não arquivadas).
  const visibleTenants = useMemo(() => {
    let list = tenants.filter(t => !t.archived);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(t =>
      t.displayName.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      (t.primaryAdminEmail || '').toLowerCase().includes(q)
    );
    if (statusFilter === 'active') list = list.filter(t => !t.internal && t.status === 'active');
    else if (statusFilter === 'trial') list = list.filter(t => !t.internal && t.status === 'trial');
    else if (statusFilter === 'suspended') list = list.filter(t => t.status === 'suspended');
    else if (statusFilter === 'risk') list = list.filter(t => !t.internal && (t.status === 'active' || t.status === 'trial') && tenantHealth(t.lastActivityAt).key === 'risk');
    else if (statusFilter === 'internal') list = list.filter(t => t.internal);
    if (paymentFilter !== 'all') list = list.filter(t => (t.paymentStatus || 'pending') === paymentFilter);
    const arr = [...list];
    if (sortBy === 'activity') arr.sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0));
    else if (sortBy === 'revenue') arr.sort((a, b) => (b.price || 0) - (a.price || 0));
    else arr.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return arr;
  }, [tenants, search, statusFilter, sortBy, paymentFilter]);

  return (
    <div className="animate-fade-in font-sans space-y-6">
      <section className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Globe size={13} className="text-brand-600" /> Super-admin
          </div>
          <h2 className="mt-1.5 font-display text-[24px] font-semibold tracking-tight leading-tight">Organizações</h2>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
            Crie uma organização nova (cliente) com dados totalmente isolados e o primeiro admin dela.
          </p>
        </div>
        {onOpenConsole && (
          <button onClick={onOpenConsole} className="shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-600/20 transition">
            ✨ Abrir novo Console
            <span className="text-[9.5px] font-bold uppercase tracking-wide bg-white/20 px-1.5 py-0.5 rounded">beta</span>
          </button>
        )}
      </section>

      <div className="space-y-6" key={tab}>
      {tab === 'overview' && (
        <div className="space-y-6">
          <SuperOverviewCards overview={overview} />

          {overview?.trialsExpiring?.length > 0 && (
            <SettingsCard title="Trials vencendo" hint="Próximos 7 dias — aja rápido" icon={<AlertCircle size={16} />}>
              <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                {overview.trialsExpiring.map(tr => (
                  <div key={tr.id} className="flex items-center gap-2 px-1 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">{tr.displayName}</div>
                      <div className="text-[11.5px] text-slate-500 num">{tr.daysLeft <= 0 ? 'vence hoje' : `${tr.daysLeft} dia${tr.daysLeft === 1 ? '' : 's'}`} · {new Date(tr.trialEndsAt).toLocaleDateString('pt-BR')}</div>
                    </div>
                    <button disabled={!!manageBusy} onClick={() => patchTenant(tr.id, { trialDays: 7 }, 'Trial estendido por 7 dias.', 'trial')}
                      className="h-8 px-2.5 rounded-lg text-[11.5px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-200 disabled:opacity-50 transition whitespace-nowrap">+7 dias</button>
                    <button disabled={!!manageBusy} onClick={() => patchTenant(tr.id, { trialDays: 0, status: 'active' }, 'Organização ativada.', 'status')}
                      className="h-8 px-2.5 rounded-lg text-[11.5px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 disabled:opacity-50 transition whitespace-nowrap">Ativar</button>
                  </div>
                ))}
              </div>
            </SettingsCard>
          )}
        </div>
      )}

      {tab === 'finance' && <SuperFinanceTab overview={overview} tenants={tenants} onPatch={patchTenant} busy={manageBusy} />}

      {tab === 'plans' && <SuperPlansTab plans={plans} authHeader={authHeader} onReload={loadPlans} />}

      {tab === 'clients' && (
        <div className="space-y-6">
      <SettingsCard title="Nova organização" hint="Provisiona o tenant + o primeiro admin" icon={<Plus size={16} />}>
        <form onSubmit={submit} className="space-y-4 p-4 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nome da organização">
              <StyledInput placeholder="Ex: Studio Corpo & Movimento" value={form.displayName} onChange={e => onNameChange(e.target.value)} required />
            </Field>
            <Field label="Identificador (slug)" hint="minúsculas, números e hífen">
              <StyledInput placeholder="ex: corpo-e-movimento" value={form.tenantId}
                onChange={e => { setSlugTouched(true); setField('tenantId', slugify(e.target.value)); }} required />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Nome do admin">
              <StyledInput placeholder="Nome completo" value={form.adminName} onChange={e => setField('adminName', e.target.value)} required />
            </Field>
            <Field label="E-mail do admin">
              <StyledInput type="email" placeholder="admin@organizacao.com" value={form.adminEmail} onChange={e => setField('adminEmail', e.target.value)} required />
            </Field>
            <Field label="Senha temporária">
              <StyledInput type="text" placeholder="mín. 6 caracteres" value={form.adminPassword} onChange={e => setField('adminPassword', e.target.value)} required />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Plano">
              <StyledSelect value={form.plan} onChange={e => setField('plan', e.target.value)}>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </StyledSelect>
            </Field>
            <Field label="Dias de teste" hint="0 = já ativa, sem trial">
              <StyledInput type="number" min="0" placeholder="0" value={form.trialDays} onChange={e => setField('trialDays', e.target.value)} />
            </Field>
          </div>
          <details open={profileOpen} onToggle={(e) => setProfileOpen(e.currentTarget.open)}
            className="rounded-xl border border-border bg-white/60 dark:bg-white/[0.02]">
            <summary className="flex items-center gap-2 cursor-pointer select-none px-3.5 py-2.5 text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">
              <Building2 size={15} className="text-brand-600" />
              Dados da empresa
              <span className="font-normal text-slate-400">(opcional — CNPJ, endereço, responsável)</span>
            </summary>
            <div className="px-3.5 pb-4 pt-1">
              <GymProfileFields
                value={form}
                onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                wrapInCards={false}
                onValidityChange={setCpfInvalid}
              />
            </div>
          </details>
          <div className="flex justify-end">
            <Btn kind="brand" type="submit" icon={<Check size={13} />} disabled={submitting}>
              {submitting ? 'Criando...' : 'Criar organização'}
            </Btn>
          </div>
        </form>
      </SettingsCard>

      <SettingsCard
        title="Organizações"
        hint={visibleTenants.length === activeTenants.length
          ? `${activeTenants.length} ativa${activeTenants.length === 1 ? '' : 's'}`
          : `${visibleTenants.length} de ${activeTenants.length} ativas`}
        icon={<Globe size={16} />}
      >
        {/* busca + filtros */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, slug ou e-mail..."
              className="w-full h-9 pl-8 pr-3 rounded-lg text-[12.5px] bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] outline-none focus:border-brand-500" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="h-9 px-2.5 rounded-lg text-[12px] bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] outline-none focus:border-brand-500 cursor-pointer">
            <option value="all">Todas</option>
            <option value="active">Ativas</option>
            <option value="trial">Trial</option>
            <option value="suspended">Suspensas</option>
            <option value="risk">Em risco</option>
            <option value="internal">Internas</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="h-9 px-2.5 rounded-lg text-[12px] bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] outline-none focus:border-brand-500 cursor-pointer">
            <option value="name">Ordenar: Nome</option>
            <option value="activity">Ordenar: Atividade</option>
            <option value="revenue">Ordenar: Receita (MRR)</option>
          </select>
          <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}
            className="h-9 px-2.5 rounded-lg text-[12px] bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] outline-none focus:border-brand-500 cursor-pointer">
            <option value="all">Pgto: Todos</option>
            <option value="paid">Pago</option>
            <option value="pending">Pendente</option>
            <option value="overdue">Inadimplente</option>
          </select>
        </div>

        {loadingList ? (
          <div className="text-center text-[12.5px] text-slate-400 py-10">Carregando...</div>
        ) : activeTenants.length === 0 ? (
          <div className="text-center text-[12.5px] text-slate-400 italic py-10">Nenhuma organização ativa.</div>
        ) : visibleTenants.length === 0 ? (
          <div className="text-center text-[12.5px] text-slate-400 italic py-10">Nenhuma organização encontrada com esses filtros.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
            {visibleTenants.map(t => {
              const statusStyle = t.status === 'active'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                : t.status === 'trial'
                  ? 'bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-400'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
              const statusLabel = t.status === 'active' ? 'Ativa' : t.status === 'trial' ? 'Trial' : t.status === 'suspended' ? 'Suspensa' : t.status;
              const seats = tenantSeatLabel(t);
              // Saúde só para clientes reais (não-internos) ativos/trial.
              const health = (!t.internal && (t.status === 'active' || t.status === 'trial')) ? tenantHealth(t.lastActivityAt) : null;
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-7 h-7 rounded-lg grid place-items-center bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 shrink-0">
                    <Globe size={13} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium text-slate-800 dark:text-slate-100 truncate">
                      {t.displayName}
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{planLabel(t.plan)}</span>
                      {t.internal && <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 dark:bg-white/[0.08] dark:text-slate-400" title="Conta interna/teste — fora dos números de negócio">Interna</span>}
                    </div>
                    <div className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate num">
                      {t.id}{seats ? ` · ${seats}` : ''}
                    </div>
                  </div>
                  {t.internalNotes && <FileText size={13} className="text-slate-400 dark:text-slate-500 shrink-0" title="Tem nota interna" />}
                  {health && health.key !== 'active' && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap ${health.cls}`} title={lastActivityLabel(t.lastActivityAt)}>
                      {health.label}
                    </span>
                  )}
                  <span className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap ${statusStyle}`}>
                    {statusLabel}
                  </span>
                  {!t.archived && (t.status === 'active' || t.status === 'trial') && (
                    <button onClick={() => enterAs(t)} disabled={!!manageBusy} title="Entrar como esta organização (ver o que o cliente vê)"
                      className="text-[11.5px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300 disabled:opacity-50 transition inline-flex items-center gap-1 whitespace-nowrap">
                      <Eye size={12} /> Entrar
                    </button>
                  )}
                  <button onClick={() => copyTenantLink(t.id)} title={`Copiar link de acesso · /${t.id}`}
                    className="text-[11.5px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300 transition whitespace-nowrap">
                    Copiar link
                  </button>
                  <button onClick={() => openManage(t)}
                    className="text-[11.5px] font-semibold px-2.5 py-1 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition inline-flex items-center gap-1 whitespace-nowrap">
                    <Settings size={12} /> Gerenciar
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </SettingsCard>

      {archivedTenants.length > 0 && (
        <SettingsCard title="Desativadas" hint={`${archivedTenants.length} arquivada${archivedTenants.length === 1 ? '' : 's'}`} icon={<Ban size={16} />}>
          <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
            {archivedTenants.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 opacity-90">
                <span className="w-7 h-7 rounded-lg grid place-items-center bg-slate-100 text-slate-400 dark:bg-white/[0.06] dark:text-slate-500 shrink-0">
                  <Ban size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium text-slate-700 dark:text-slate-200 truncate">{t.displayName}</div>
                  <div className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate num">{t.id}</div>
                </div>
                <button onClick={() => setArchived(t.id, false)} disabled={!!manageBusy}
                  className="text-[11.5px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 disabled:opacity-50 transition whitespace-nowrap">
                  Restaurar
                </button>
              </div>
            ))}
          </div>
        </SettingsCard>
      )}

        </div>
      )}

      {tab === 'overview' && audit.length > 0 && (
        <SettingsCard title="Atividade recente" hint="Últimas ações no painel (auditoria)" icon={<Activity size={16} />}>
          <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
            {audit.map(e => (
              <div key={e.id} className="flex items-center gap-3 py-2.5 text-[12.5px]">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${e.action === 'impersonate.start' ? 'bg-amber-500' : 'bg-brand-500'}`} />
                <span className="flex-1 text-slate-700 dark:text-slate-200 truncate">{auditActionLabel(e)}</span>
                <span className="text-[11px] text-slate-400 shrink-0">{timeAgo(e.at)}</span>
              </div>
            ))}
          </div>
        </SettingsCard>
      )}
        </div>

      {manage && (
        <TenantManageModal
          t={manage} stats={stats} busy={manageBusy} plans={plans}
          onClose={closeManage}
          onCopy={() => copyTenantLink(manage.id)}
          onPatch={(body, msg) => patchTenant(manage.id, body, msg, 'edit')}
          onExtendTrial={(d) => extendTrial(manage.id, d)}
          onSetActive={(s) => setActive(manage.id, s)}
          onEnterAs={() => enterAs(manage)}
          onArchive={() => setArchived(manage.id, true)}
          authHeader={authHeader}
          asaasConfigured={asaasConfigured}
          onReload={loadTenants}
        />
      )}
    </div>
  );
}

// Painel de detalhe/gestão de uma organização (super-admin): uso, plano, trial,
// status e desativar. Props são handlers do SuperAdminView.
export { SuperAdminView };
