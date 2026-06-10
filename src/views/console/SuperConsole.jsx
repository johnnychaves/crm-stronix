import { useEffect, useMemo, useState } from 'react';
import { auth, db } from '../../lib/firebase.js';
import { collection, onSnapshot, doc, getDoc, setDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { signInWithCustomToken, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { planLabel, auditActionLabel, IMPERSONATION_KEY } from '../../lib/superadmin.js';
import { Icon } from './consoleIcons.jsx';
import './console.css';

// ============================================================
// STRONILEAD · Console (super-admin) — takeover dark dedicado.
// Fundação: shell (sidebar+topbar+nav+roteamento) + Visão geral em DADOS REAIS.
// As demais telas entram tela a tela (placeholder por ora).
// ============================================================

const NAV = [
  { group: 'Plataforma', items: [
    { id: 'overview', label: 'Visão geral', icon: 'overview' },
    { id: 'tenants', label: 'Academias', icon: 'tenants' },
    { id: 'plans', label: 'Planos & assinaturas', icon: 'plans' },
    { id: 'billing', label: 'Faturamento', icon: 'billing' },
  ] },
  { group: 'Operação', items: [
    { id: 'support', label: 'Suporte', icon: 'support' },
    { id: 'flags', label: 'Feature flags', icon: 'flags' },
    { id: 'logs', label: 'Logs & auditoria', icon: 'logs' },
    { id: 'health', label: 'Saúde do sistema', icon: 'health' },
  ] },
];
const TITLES = { overview: 'Visão geral', tenants: 'Academias', plans: 'Planos & assinaturas', billing: 'Faturamento', support: 'Suporte', flags: 'Feature flags', logs: 'Logs & auditoria', health: 'Saúde do sistema' };

const brl = (n) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR');
const TONES = [['#D6E1FF', '#2557E6'], ['#FFE0D1', '#F2541A'], ['#E7F8F1', '#0E9E6E'], ['#F1ECFE', '#7C3AED'], ['#FFE7EA', '#E11D48']];
const tone = (id) => { let h = 0; for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return TONES[h % TONES.length]; };
const initials = (s) => String(s || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const PLAN_PAL = ['#2B59FF', '#FF6A2B', '#5A6378', '#1FCB8B', '#A07CF5'];

function GymCell({ t, size = 34, sub }) {
  const [bg, fg] = tone(t.id);
  return (
    <div className="gym">
      <span className="gym-logo" style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.4 }}>{initials(t.displayName)}</span>
      <div style={{ minWidth: 0 }}><div className="gym-n">{t.displayName}</div>{sub && <div className="gym-c">{sub}</div>}</div>
    </div>
  );
}

function statusBadge(t) {
  if (t.archived || t.status === 'suspended') return <span className="badge b-cancel"><span className="bd" style={{ background: 'currentColor' }} />{t.archived ? 'Cancelada' : 'Suspensa'}</span>;
  if (t.paymentStatus === 'overdue') return <span className="badge b-inad"><span className="bd" style={{ background: 'currentColor' }} />Inadimplente</span>;
  if (t.status === 'trial') return <span className="badge b-trial"><span className="bd" style={{ background: 'currentColor' }} />Trial</span>;
  return <span className="badge b-ativa"><span className="bd" style={{ background: 'currentColor' }} />Ativa</span>;
}
const planChip = (slug) => <span className="plan-chip" style={{ background: 'rgba(43,89,255,.16)', color: '#9FBCFF' }}>{planLabel(slug)}</span>;
const statusKey = (t) => (t.archived || t.status === 'suspended') ? 'cancelada' : t.paymentStatus === 'overdue' ? 'inadimplente' : t.status === 'trial' ? 'trial' : 'ativa';
const payBadge = (s) => s === 'paid' ? <span className="badge b-paga">Pago</span> : s === 'overdue' ? <span className="badge b-atrasada">Atrasado</span> : s === 'pending' ? <span className="badge b-pendente">Pendente</span> : <span className="muted">—</span>;

const pct = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

function Kpi({ label, icon, tint, val, delta, deltaCls, foot }) {
  return (
    <div className="kpi">
      <div className="kpi-top"><span className="kpi-label">{label}</span><span className={`kpi-ic ${tint}`}><Icon name={icon} /></span></div>
      <div className="kpi-val">{val}</div>
      <div className="kpi-foot">{delta != null && <span className={`delta ${deltaCls}`}>{delta}</span>} {foot}</div>
    </div>
  );
}

// ---------- Visão geral (dados reais) ----------
function Overview({ overview, tenants, loading, go }) {
  const data = useMemo(() => {
    const o = overview || {};
    const series = Array.isArray(o.mrrByMonth) ? o.mrrByMonth : [];
    const last = series[series.length - 1] || {};
    const prev = series[series.length - 2] || {};
    const list = (tenants || []).filter((t) => !t.internal);
    const overdue = list.filter((t) => !t.archived && t.paymentStatus === 'overdue');
    const byPlanRev = {};
    list.forEach((t) => { if (!t.archived && t.status === 'active') byPlanRev[t.plan] = (byPlanRev[t.plan] || 0) + (t.price || 0); });
    const receitaPlano = Object.entries(byPlanRev).sort((a, b) => b[1] - a[1]).map(([slug, v], i) => ({ n: planLabel(slug), v, c: PLAN_PAL[i % PLAN_PAL.length] }));
    const recent = [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5);
    return {
      mrr: o.mrr || 0, mrrPct: pct(last.mrr, prev.mrr),
      active: o.active || 0, activePct: pct(last.active, prev.active),
      trial: o.trial || 0, atRisk: o.atRisk || 0, churn: o.churn30d || 0,
      newThisMonth: (o.newByMonth || []).slice(-1)[0]?.count || 0,
      mrrSerie: series.map((m) => m.mrr || 0), meses: series.map((m) => m.label),
      receitaPlano, recent, overdue, trialsExpiring: o.trialsExpiring || [],
    };
  }, [overview, tenants]);

  if (loading && !overview) return <div className="empty">Carregando o painel…</div>;
  const d = data;
  const maxBar = Math.max(1, ...d.mrrSerie);

  return (
    <>
      <div className="ph">
        <div><h1>Visão geral</h1><p>Saúde do negócio · Plataforma STRONILEAD</p></div>
        <div className="ph-actions">
          <button className="btn btn-ghost"><Icon name="download" size={16} /> Exportar</button>
          <button className="btn btn-primary"><Icon name="overview" size={16} /> Relatório mensal</button>
        </div>
      </div>

      <div className="grid kpis">
        <Kpi label="MRR" icon="money" tint="t-success" val={brl(d.mrr)} delta={d.mrrPct != null ? `${d.mrrPct >= 0 ? '▲ +' : '▼ '}${d.mrrPct}%` : null} deltaCls={d.mrrPct >= 0 ? 'up' : 'down'} foot="vs. mês anterior" />
        <Kpi label="Academias ativas" icon="building" tint="t-brand" val={d.active} delta={d.activePct != null ? `${d.activePct >= 0 ? '▲ +' : '▼ '}${d.activePct}%` : null} deltaCls={d.activePct >= 0 ? 'up' : 'down'} foot={`novas este mês: ${d.newThisMonth}`} />
        <Kpi label="Em trial" icon="zap" tint="t-accent" val={d.trial} delta={null} foot="em teste agora" />
        <Kpi label="Em risco" icon="churn" tint="t-danger" val={d.atRisk} delta={null} foot="sem uso há 14+ dias" />
      </div>

      <div className="grid col-2" style={{ gridTemplateColumns: '1.6fr 1fr', marginTop: 16 }}>
        <div className="card">
          <div className="card-h"><h3>Receita recorrente (MRR)</h3><span className="sub">Últimos {d.mrrSerie.length} meses</span></div>
          <div className="card-pad">
            <div className="bars">
              {d.mrrSerie.map((v, i) => <div key={i} className="bar" style={{ height: `${(v / maxBar) * 100}%` }} title={brl(v)} />)}
            </div>
            <div className="bar-x">{d.meses.map((m, i) => <span key={i} style={{ textTransform: 'capitalize' }}>{m.replace('.', '')}</span>)}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h3>Receita por plano</h3></div>
          <div className="card-pad">
            {d.receitaPlano.length ? (
              <div className="donut-wrap">
                <Donut parts={d.receitaPlano} size={150} />
                <div className="legend" style={{ flex: 1 }}>
                  {d.receitaPlano.map((p) => <div key={p.n} className="legend-row"><span className="dt" style={{ background: p.c }} /><span className="ln">{p.n}</span><span className="lv">{brl(p.v)}</span></div>)}
                </div>
              </div>
            ) : <div className="empty" style={{ padding: 30 }}>Sem receita por plano ainda.</div>}
          </div>
        </div>
      </div>

      <div className="grid col-2" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 16 }}>
        <div className="card">
          <div className="card-h"><h3>Novas academias</h3><a className="sub" style={{ color: 'var(--brand-300)' }} onClick={() => go('tenants')}>Ver todas →</a></div>
          <table className="tbl"><tbody>
            {d.recent.length ? d.recent.map((t) => (
              <tr key={t.id} onClick={() => go('tenants')}>
                <td><GymCell t={t} sub={[t.settings?.city, t.settings?.state].filter(Boolean).join(' · ') || t.id} /></td>
                <td>{planChip(t.plan)}</td>
                <td>{statusBadge(t)}</td>
                <td className="tnum muted" style={{ textAlign: 'right' }}>{t.lastActivityAt ? new Date(t.lastActivityAt).toLocaleDateString('pt-BR') : '—'}</td>
              </tr>
            )) : <tr><td className="muted" style={{ padding: 20 }}>Nenhuma academia ainda.</td></tr>}
          </tbody></table>
        </div>
        <div className="card">
          <div className="card-h"><h3>Precisa de atenção</h3></div>
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Attn icon="alert" tint="t-danger" title={`${d.overdue.length} academia${d.overdue.length === 1 ? '' : 's'} inadimplente${d.overdue.length === 1 ? '' : 's'}`} sub={d.overdue.slice(0, 2).map((t) => t.displayName).join(' · ') || 'nenhuma'} onGo={() => go('billing')} />
            <Attn icon="zap" tint="t-warn" title={`${d.trialsExpiring.length} trial${d.trialsExpiring.length === 1 ? '' : 's'} terminando`} sub={d.trialsExpiring.slice(0, 2).map((t) => `${t.displayName} (${t.daysLeft <= 0 ? 'hoje' : t.daysLeft + 'd'})`).join(' · ') || 'nenhum'} onGo={() => go('tenants')} />
            <Attn icon="churn" tint="t-danger" title={`${d.atRisk} em risco de churn`} sub="sem uso há 14+ dias" onGo={() => go('tenants')} />
          </div>
        </div>
      </div>
    </>
  );
}

function Attn({ icon, tint, title, sub, onGo }) {
  return (
    <div className="urow" style={{ paddingTop: 0 }}>
      <span className={`kpi-ic ${tint}`} style={{ width: 32, height: 32 }}><Icon name={icon} size={16} /></span>
      <div className="ucol"><div className="un">{title}</div><div className="gym-c">{sub}</div></div>
      <button className="btn btn-ghost btn-sm" onClick={onGo}>Ver</button>
    </div>
  );
}

function Donut({ parts, size = 150 }) {
  const total = parts.reduce((s, p) => s + p.v, 0) || 1;
  const r = size / 2 - 9, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
  const lens = parts.map((p) => (p.v / total) * C);
  const offsets = lens.map((_, i) => lens.slice(0, i).reduce((s, v) => s + v, 0));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="13" />
      {parts.map((p, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={p.c} strokeWidth="13" strokeDasharray={`${lens[i]} ${C - lens[i]}`} strokeDashoffset={-offsets[i]} transform={`rotate(-90 ${cx} ${cy})`} />
      ))}
      <text x={cx} y={cy - 3} textAnchor="middle" fontFamily="Space Grotesk" fontWeight="700" fontSize="20" fill="#EAEEF9">{brl(total).replace('R$ ', 'R$ ')}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="#8A93B0">MRR / mês</text>
    </svg>
  );
}

// ---------- Placeholder (telas em construção) ----------
function Placeholder({ route }) {
  return (
    <>
      <div className="ph"><div><h1>{TITLES[route]}</h1><p>Esta tela entra em breve no novo visual.</p></div></div>
      <div className="card"><div className="empty">
        <div style={{ opacity: .5, marginBottom: 10 }}><Icon name={(NAV.flatMap((g) => g.items).find((i) => i.id === route) || {}).icon || 'overview'} size={30} /></div>
        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{TITLES[route]} — em construção</div>
        <div style={{ marginTop: 6, fontSize: 13 }}>Próxima fase do console. A Visão geral já está com dados reais.</div>
      </div></div>
    </>
  );
}

// ---------- Academias (lista, dados reais) ----------
const CHIPS = [['todas', 'Todas'], ['ativa', 'Ativas'], ['trial', 'Trial'], ['inadimplente', 'Inadimplentes'], ['cancelada', 'Canceladas']];
function Tenants({ tenants, go }) {
  const [filter, setFilter] = useState('todas');
  const [q, setQ] = useState('');
  const list = (tenants || []).filter((t) => !t.internal);
  const counts = { todas: list.length, ativa: 0, trial: 0, inadimplente: 0, cancelada: 0 };
  list.forEach((t) => { counts[statusKey(t)] += 1; });
  const shown = list
    .filter((t) => filter === 'todas' || statusKey(t) === filter)
    .filter((t) => !q || (t.displayName || '').toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div className="ph">
        <div><h1>Academias</h1><p>{list.length} clientes na plataforma · {counts.ativa} ativas</p></div>
        <div className="ph-actions"><button className="btn btn-ghost"><Icon name="download" size={16} /> CSV</button><button className="btn btn-primary"><Icon name="plus" size={16} /> Nova academia</button></div>
      </div>
      <div className="toolbar">
        {CHIPS.map(([k, label]) => (
          <button key={k} className={`chip${filter === k ? ' active' : ''}`} onClick={() => setFilter(k)}>{label} <span className="cn">{counts[k]}</span></button>
        ))}
        <div className="search-box"><Icon name="search" size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar academia…" /></div>
      </div>
      <div className="card">
        <table className="tbl">
          <thead><tr><th>Academia</th><th>Plano</th><th>Status</th><th style={{ textAlign: 'right' }}>MRR</th><th>Pagamento</th><th>Cliente desde</th><th>Último acesso</th></tr></thead>
          <tbody>
            {shown.length ? shown.map((t) => (
              <tr key={t.id} onClick={() => go('tenant', t.id)}>
                <td><GymCell t={t} sub={[t.settings?.city, t.settings?.state].filter(Boolean).join(' · ') || t.id} /></td>
                <td>{planChip(t.plan)}</td>
                <td>{statusBadge(t)}</td>
                <td className="tnum" style={{ textAlign: 'right' }}>{t.price ? brl(t.price) : '—'}</td>
                <td>{payBadge(t.paymentStatus)}</td>
                <td className="muted tnum">{t.createdAt ? new Date(t.createdAt).toLocaleDateString('pt-BR') : '—'}</td>
                <td className="muted">{t.lastActivityAt ? new Date(t.lastActivityAt).toLocaleDateString('pt-BR') : '—'}</td>
              </tr>
            )) : <tr><td colSpan={7} className="empty">Nenhuma academia encontrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------- Logs & auditoria (dados reais) ----------
function detailStr(d) {
  if (!d || typeof d !== 'object') return '';
  if (Array.isArray(d.changed)) return d.changed.join(', ');
  return Object.entries(d).map(([k, v]) => `${k}: ${v}`).slice(0, 3).join(' · ');
}
function Logs({ audit }) {
  const list = audit || [];
  return (
    <>
      <div className="ph"><div><h1>Logs & auditoria</h1><p>Trilha de auditoria da plataforma · ações administrativas</p></div></div>
      <div className="card">
        <table className="tbl">
          <thead><tr><th>Quando</th><th>Ator</th><th>Ação</th><th>Alvo</th><th>Detalhe</th></tr></thead>
          <tbody>
            {list.length ? list.map((l) => (
              <tr key={l.id}>
                <td className="tnum muted" style={{ whiteSpace: 'nowrap' }}>{l.at ? new Date(l.at).toLocaleString('pt-BR') : '—'}</td>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>{l.actorUid ? String(l.actorUid).slice(0, 8) : 'sistema'}</td>
                <td><span className="log-act">{auditActionLabel(l.action) || l.action}</span></td>
                <td style={{ fontWeight: 600 }}>{l.tenantId || '—'}</td>
                <td className="muted">{detailStr(l.details)}</td>
              </tr>
            )) : <tr><td colSpan={5} className="empty">Sem registros de auditoria ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------- Planos & assinaturas (dados reais + CRUD) ----------
// Vagas por papel do plano (docs legados só têm maxUsers → 1 gestor + resto).
const planSeats = (p) => {
  if (!p) return { mg: 1, co: null };
  if (p.maxManagers !== undefined || p.maxConsultants !== undefined) return { mg: p.maxManagers ?? null, co: p.maxConsultants ?? null };
  return p.maxUsers == null ? { mg: null, co: null } : { mg: 1, co: Math.max(0, p.maxUsers - 1) };
};
const seatText = (p) => {
  const { mg, co } = planSeats(p);
  if (mg == null && co == null) return 'Gestores e consultores ilimitados';
  const mgTxt = mg == null ? 'gestores ilimitados' : `${mg} gestor${mg === 1 ? '' : 'es'}`;
  const coTxt = co == null ? 'consultores ilimitados' : `${co} consultor${co === 1 ? '' : 'es'}`;
  return `${mgTxt} + ${coTxt}`;
};

function Plans({ plans, onReload }) {
  const [editing, setEditing] = useState(undefined); // undefined = fechado · null = novo · obj = editar
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState(null);

  // Excluir: a API bloqueia se houver academias no slug; aqui antecipamos a
  // mensagem (tenantCount vem do GET) para não pedir confirmação à toa.
  const del = async (p) => {
    setErr('');
    if ((p.tenantCount || 0) > 0) {
      setErr(`Não dá para excluir "${p.name}": ${p.tenantCount} academia${p.tenantCount === 1 ? '' : 's'} usa${p.tenantCount === 1 ? '' : 'm'} este plano. Migre-as para outro plano antes (Academias → Gerenciar plano).`);
      return;
    }
    if (!window.confirm(`Excluir o plano "${p.name}"?${p.isDefault ? '\nAtenção: ele está marcado como plano padrão.' : ''}\nEssa ação não pode ser desfeita.`)) return;
    setBusyId(p.id);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/plans', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ planId: p.id }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setErr(data.error || 'Erro ao excluir o plano.');
      else onReload?.();
    } catch (e) { console.error('plan del', e); setErr('Erro ao excluir o plano.'); }
    finally { setBusyId(null); }
  };

  if (!plans) return <div className="empty">Carregando planos…</div>;
  const totalOrgs = plans.reduce((s, p) => s + (p.tenantCount || 0), 0) || 1;
  return (
    <>
      <div className="ph">
        <div><h1>Planos & assinaturas</h1><p>Gerencie os planos comerciais da plataforma</p></div>
        <div className="ph-actions"><button className="btn btn-primary" onClick={() => setEditing(null)}><Icon name="plus" size={16} /> Novo plano</button></div>
      </div>
      {err && <div className="card card-pad" style={{ marginBottom: 16, borderColor: 'rgba(225,29,72,.4)', color: '#FF8497', fontSize: 13 }}>{err}</div>}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 18 }}>
        {plans.map((p, i) => {
          const color = PLAN_PAL[i % PLAN_PAL.length];
          const inactive = p.isActive === false;
          return (
            <div key={p.id} className="card card-pad" style={{ position: 'relative', display: 'flex', flexDirection: 'column', ...(p.isDefault ? { borderColor: 'var(--brand)', boxShadow: '0 24px 60px -34px rgba(43,89,255,.6)' } : {}), ...(inactive ? { opacity: .68 } : {}) }}>
              {(p.isDefault || inactive) && (
                <span style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 6 }}>
                  {p.isDefault && <span className="badge b-trial">Padrão</span>}
                  {inactive && <span className="badge b-cancel">Inativo</span>}
                </span>
              )}
              <div style={{ fontFamily: 'var(--head)', fontWeight: 700, fontSize: 19, color }}>{p.name}</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                {seatText(p)}
                {Number(p.extraUserPrice) > 0 && <> · extra {brl(p.extraUserPrice)}/mês{p.maxExtraUsers != null ? ` (até ${p.maxExtraUsers})` : ''}</>}
              </div>
              <div style={{ fontFamily: 'var(--head)', fontWeight: 700, fontSize: 38, letterSpacing: '-.02em', margin: '14px 0 2px' }}>
                {p.priceMonthly ? brl(p.priceMonthly) : 'Sob medida'}
                {p.priceMonthly ? <span style={{ fontSize: 15, color: 'var(--muted)', fontWeight: 500, fontFamily: 'var(--ui)' }}>/mês</span> : null}
              </div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
                {p.tenantCount || 0} academias ativas
                {Number(p.priceAnnual) > 0 && <> · {brl(p.priceAnnual)}/ano</>}
              </div>
              {Array.isArray(p.features) && p.features.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                  {p.features.map((f, j) => <div key={j} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13 }}><span style={{ color: 'var(--success)', marginTop: 2 }}><Icon name="check" size={14} /></span>{f}</div>)}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}><Icon name="edit" size={14} /> Editar</button>
                <button
                  className="btn btn-ghost btn-sm" style={{ color: '#FF8497' }} disabled={busyId === p.id}
                  title={(p.tenantCount || 0) > 0 ? `${p.tenantCount} academia(s) usam este plano — migre antes de excluir` : 'Excluir o plano'}
                  onClick={() => del(p)}
                ><Icon name="trash" size={14} /> {busyId === p.id ? 'Excluindo…' : 'Excluir'}</button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="card">
        <div className="card-h"><h3>Distribuição de assinaturas</h3></div>
        <div className="card-pad">
          {plans.map((p, i) => (
            <div key={p.id} className="urow">
              <span className="un" style={{ flex: 'none', width: 120, fontWeight: 600 }}>{p.name}</span>
              <span className="ubar" style={{ flex: 1 }}><span className="prog"><i style={{ width: `${((p.tenantCount || 0) / totalOrgs) * 100}%`, background: PLAN_PAL[i % PLAN_PAL.length] }} /></span></span>
              <span className="uv">{p.tenantCount || 0} academias{p.priceMonthly ? ` · ${brl(p.priceMonthly * (p.tenantCount || 0))}/mês` : ''}</span>
            </div>
          ))}
        </div>
      </div>
      {editing !== undefined && <PlanFormPanel plan={editing} onClose={() => setEditing(undefined)} onDone={() => { setEditing(undefined); onReload?.(); }} />}
    </>
  );
}

// ---------- Criar/editar plano (modal nativo do console) ----------
const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function PlanFormPanel({ plan, onClose, onDone }) {
  const editing = !!plan?.id;
  // Renomear o slug com academias no plano é bloqueado pela API (o campo
  // `plan` dos tenants referencia o slug) — então já travamos o input.
  const slugLocked = editing && (plan?.tenantCount || 0) > 0;
  const seats = planSeats(editing ? plan : null); // novo plano: 1 gestor por padrão
  const [f, setF] = useState({
    name: plan?.name || '',
    slug: plan?.slug || '',
    managersUnlimited: editing && seats.mg == null,
    maxManagers: seats.mg != null ? String(seats.mg) : '',
    consultantsUnlimited: editing && seats.co == null,
    maxConsultants: seats.co != null ? String(seats.co) : '',
    priceMonthly: plan?.priceMonthly != null ? String(plan.priceMonthly) : '',
    priceAnnual: plan?.priceAnnual ? String(plan.priceAnnual) : '',
    extraUserPrice: plan?.extraUserPrice != null ? String(plan.extraUserPrice) : '',
    maxExtraUsers: plan?.maxExtraUsers != null ? String(plan.maxExtraUsers) : '',
    isActive: plan?.isActive !== false,
    isDefault: plan?.isDefault === true,
    order: plan?.order != null ? String(plan.order) : '',
    features: Array.isArray(plan?.features) ? plan.features.join('\n') : '',
  });
  const [slugTouched, setSlugTouched] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const onName = (v) => setF((s) => ({ ...s, name: v, slug: slugTouched ? s.slug : slugify(v) }));

  const m = Number(f.priceMonthly) || 0;
  const a = Number(f.priceAnnual) || 0;
  const eqMonthly = a > 0 ? Math.round(a / 12) : null;
  const discount = a > 0 && m > 0 ? Math.round((1 - a / (m * 12)) * 100) : null;

  const save = async () => {
    if (!f.name.trim()) { setErr('Informe o nome do plano.'); return; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(f.slug)) { setErr('Identificador inválido: use minúsculas, números e hífen (ex.: pro-anual).'); return; }
    if (!f.managersUnlimited && (f.maxManagers === '' || Number(f.maxManagers) < 1)) { setErr('Informe o nº de gestores inclusos (ou marque Ilimitado).'); return; }
    if (!f.consultantsUnlimited && (f.maxConsultants === '' || Number(f.maxConsultants) < 0)) { setErr('Informe o nº de consultores inclusos (ou marque Ilimitado).'); return; }
    setSaving(true); setErr('');
    const body = {
      name: f.name.trim(),
      slug: f.slug,
      maxManagers: f.managersUnlimited ? null : Number(f.maxManagers),
      maxConsultants: f.consultantsUnlimited ? null : Number(f.maxConsultants),
      priceMonthly: f.priceMonthly === '' ? 0 : Number(f.priceMonthly),
      priceAnnual: f.priceAnnual === '' ? null : Number(f.priceAnnual),
      extraUserPrice: f.extraUserPrice === '' ? null : Number(f.extraUserPrice),
      maxExtraUsers: f.maxExtraUsers === '' ? null : Number(f.maxExtraUsers),
      isActive: f.isActive,
      isDefault: f.isDefault,
      order: f.order === '' ? 0 : Number(f.order),
      features: f.features.split('\n').map((s) => s.trim()).filter(Boolean),
    };
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/plans', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editing ? { planId: plan.id, ...body } : body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error || 'Erro ao salvar o plano.'); setSaving(false); return; }
      onDone();
    } catch (e) { console.error('plan save', e); setErr('Erro ao salvar o plano.'); setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(7,11,24,.6)', backdropFilter: 'blur(3px)' }} onClick={onClose} />
      <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 540, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="card-h"><h3>{editing ? `Editar plano — ${plan.name}` : 'Novo plano'}</h3><button className="icon-btn" onClick={onClose}><Icon name="close" size={15} /></button></div>
        <div className="card-pad" style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}><span className="muted" style={{ fontSize: 12 }}>Nome do plano</span>
              <input style={FLAG_INPUT} value={f.name} onChange={(e) => onName(e.target.value)} placeholder="Ex.: Pro" autoFocus />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="muted" style={{ fontSize: 12 }}>Identificador{slugLocked ? ` · em uso por ${plan.tenantCount} academia${plan.tenantCount === 1 ? '' : 's'}` : ' (slug)'}</span>
              <input style={{ ...FLAG_INPUT, ...(slugLocked ? { opacity: .55, cursor: 'not-allowed' } : {}) }} value={f.slug} disabled={slugLocked} onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)); }} placeholder="ex.: pro" />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}><span className="muted" style={{ fontSize: 12 }}>Valor mensal (R$)</span>
              <input style={FLAG_INPUT} type="number" min="0" value={f.priceMonthly} onChange={(e) => set('priceMonthly', e.target.value)} placeholder="197" />
            </label>
            <label style={{ display: 'grid', gap: 6 }}><span className="muted" style={{ fontSize: 12 }}>Valor anual (R$/ano · opcional)</span>
              <input style={FLAG_INPUT} type="number" min="0" value={f.priceAnnual} onChange={(e) => set('priceAnnual', e.target.value)} placeholder="—" />
            </label>
          </div>
          {(m > 0 || a > 0) && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="muted">Mensal</span><b className="tnum">{brl(m)}/mês</b></div>
              {a > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 6 }}>
                  <span className="muted">Anual{eqMonthly != null && <span style={{ opacity: .8 }}> (≈ {brl(eqMonthly)}/mês)</span>}</span>
                  <b className="tnum">{brl(a)}/ano{discount > 0 && <span style={{ color: 'var(--success)', marginLeft: 6 }}>−{discount}%</span>}</b>
                </div>
              )}
              <div className="muted" style={{ fontSize: 11 }}>O valor mensal alimenta o MRR das academias deste plano (sem preço negociado por academia).</div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <span className="muted" style={{ fontSize: 12 }}>Gestores inclusos</span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input style={{ ...FLAG_INPUT, width: '100%', ...(f.managersUnlimited ? { opacity: .55 } : {}) }} type="number" min="1" disabled={f.managersUnlimited} value={f.managersUnlimited ? '' : f.maxManagers} onChange={(e) => set('maxManagers', e.target.value)} placeholder={f.managersUnlimited ? 'Ilimitado' : 'ex.: 1'} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer' }}>
                  <input type="checkbox" checked={f.managersUnlimited} onChange={(e) => set('managersUnlimited', e.target.checked)} style={{ accentColor: '#3B6DF5' }} /> ∞
                </label>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <span className="muted" style={{ fontSize: 12 }}>Consultores inclusos</span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input style={{ ...FLAG_INPUT, width: '100%', ...(f.consultantsUnlimited ? { opacity: .55 } : {}) }} type="number" min="0" disabled={f.consultantsUnlimited} value={f.consultantsUnlimited ? '' : f.maxConsultants} onChange={(e) => set('maxConsultants', e.target.value)} placeholder={f.consultantsUnlimited ? 'Ilimitado' : 'ex.: 4'} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer' }}>
                  <input type="checkbox" checked={f.consultantsUnlimited} onChange={(e) => set('consultantsUnlimited', e.target.checked)} style={{ accentColor: '#3B6DF5' }} /> ∞
                </label>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}><span className="muted" style={{ fontSize: 12 }}>Consultor extra (R$/mês · opcional)</span>
              <input style={FLAG_INPUT} type="number" min="0" value={f.extraUserPrice} onChange={(e) => set('extraUserPrice', e.target.value)} placeholder="—" />
            </label>
            <label style={{ display: 'grid', gap: 6 }}><span className="muted" style={{ fontSize: 12 }}>Máx. de consultores extras (opcional)</span>
              <input style={FLAG_INPUT} type="number" min="0" value={f.maxExtraUsers} onChange={(e) => set('maxExtraUsers', e.target.value)} placeholder="—" />
            </label>
          </div>
          {Number(f.extraUserPrice) > 0 && !f.consultantsUnlimited && (
            <div className="muted" style={{ fontSize: 11.5, marginTop: -6 }}>
              Consultores além dos {f.maxConsultants || 0} inclusos entram como extras de {brl(Number(f.extraUserPrice))}/mês cada{f.maxExtraUsers !== '' ? ` (até ${f.maxExtraUsers})` : ''} — somados automaticamente à mensalidade.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}><span className="muted" style={{ fontSize: 12 }}>Ordem de exibição</span>
              <input style={FLAG_INPUT} type="number" value={f.order} onChange={(e) => set('order', e.target.value)} placeholder="0" />
            </label>
          </div>
          <label style={{ display: 'grid', gap: 6 }}><span className="muted" style={{ fontSize: 12 }}>Recursos do plano — um por linha (aparecem no card)</span>
            <textarea style={{ ...FLAG_INPUT, height: 92, padding: '10px 12px', resize: 'vertical', lineHeight: 1.5 }} value={f.features} onChange={(e) => set('features', e.target.value)} placeholder={'Suporte prioritário\nRelatórios avançados'} />
          </label>
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className={`sw${f.isActive ? ' on' : ''}`} onClick={() => set('isActive', !f.isActive)} />
              <div><div style={{ fontSize: 13, fontWeight: 600 }}>Plano ativo</div><div className="muted" style={{ fontSize: 11 }}>disponível para novas academias</div></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className={`sw${f.isDefault ? ' on' : ''}`} onClick={() => set('isDefault', !f.isDefault)} />
              <div><div style={{ fontSize: 13, fontWeight: 600 }}>Plano padrão</div><div className="muted" style={{ fontSize: 11 }}>pré-selecionado ao criar academia</div></div>
            </div>
          </div>
          {err && <div style={{ color: 'var(--danger)', fontSize: 12.5 }}>{err}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar plano'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Faturamento (dados reais) ----------
const PAID_EV = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_RECEIVED_IN_CASH']);
function Billing({ overview, tenants }) {
  const o = overview || {};
  const list = (tenants || []).filter((t) => !t.internal);
  const overdue = list.filter((t) => !t.archived && t.paymentStatus === 'overdue');
  const overdueVal = overdue.reduce((s, t) => s + (t.price || 0), 0);
  const recent = o.recentPayments || [];
  const recebido = recent.filter((p) => PAID_EV.has(p.event)).reduce((s, p) => s + (p.value || 0), 0);
  const nameOf = Object.fromEntries(list.map((t) => [t.id, t.displayName]));
  const upcoming = o.upcomingBilling || [];
  return (
    <>
      <div className="ph">
        <div><h1>Faturamento</h1><p>Cobrança e receita recorrente</p></div>
        <div className="ph-actions"><button className="btn btn-ghost"><Icon name="download" size={16} /> Exportar</button></div>
      </div>
      <div className="grid kpis">
        <div className="kpi"><div className="kpi-top"><span className="kpi-label">MRR</span><span className="kpi-ic t-brand"><Icon name="money" /></span></div><div className="kpi-val">{brl(o.mrr)}</div><div className="kpi-foot">receita recorrente/mês</div></div>
        <div className="kpi"><div className="kpi-top"><span className="kpi-label">ARR</span><span className="kpi-ic t-success"><Icon name="money" /></span></div><div className="kpi-val">{brl(o.arr || (o.mrr || 0) * 12)}</div><div className="kpi-foot">anualizado</div></div>
        <div className="kpi"><div className="kpi-top"><span className="kpi-label">Recebido (recente)</span><span className="kpi-ic t-success"><Icon name="check" /></span></div><div className="kpi-val">{brl(recebido)}</div><div className="kpi-foot">últimos pagamentos Asaas</div></div>
        <div className="kpi"><div className="kpi-top"><span className="kpi-label">Inadimplência</span><span className="kpi-ic t-danger"><Icon name="alert" /></span></div><div className="kpi-val">{brl(overdueVal)}</div><div className="kpi-foot"><span className="delta down">{overdue.length} academia{overdue.length === 1 ? '' : 's'}</span> em atraso</div></div>
      </div>
      <div className="grid col-2" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 16 }}>
        <div className="card">
          <div className="card-h"><h3>Próximos vencimentos</h3><span className="sub">30 dias</span></div>
          {upcoming.length ? <table className="tbl"><tbody>{upcoming.map((u) => (
            <tr key={u.id}><td style={{ fontWeight: 600 }}>{u.displayName}</td><td className="tnum muted" style={{ textAlign: 'right' }}>{u.nextBillingAt ? new Date(u.nextBillingAt).toLocaleDateString('pt-BR') : '—'}</td><td style={{ textAlign: 'right', width: 70 }}><span className={`badge ${u.daysLeft <= 3 ? 'b-atrasada' : 'b-pendente'}`}>{u.daysLeft <= 0 ? 'hoje' : u.daysLeft + 'd'}</span></td></tr>
          ))}</tbody></table> : <div className="empty" style={{ padding: 30 }}>Nenhum vencimento em 30 dias.</div>}
        </div>
        <div className="card">
          <div className="card-h"><h3>Inadimplentes</h3></div>
          {overdue.length ? <table className="tbl"><tbody>{overdue.map((t) => (
            <tr key={t.id}><td><GymCell t={t} size={28} /></td><td className="tnum" style={{ textAlign: 'right' }}>{brl(t.price)}/mês</td></tr>
          ))}</tbody></table> : <div className="empty" style={{ padding: 30 }}>Ninguém em atraso 🎉</div>}
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h"><h3>Pagamentos recentes</h3><span className="sub">via Asaas</span></div>
        {recent.length ? <table className="tbl">
          <thead><tr><th>Academia</th><th>Evento</th><th style={{ textAlign: 'right' }}>Valor</th><th>Quando</th></tr></thead>
          <tbody>{recent.slice(0, 15).map((p) => (
            <tr key={p.id}><td style={{ fontWeight: 600 }}>{nameOf[p.tenantId] || p.tenantId || '—'}</td><td className="muted">{p.event}</td><td className="tnum" style={{ textAlign: 'right' }}>{p.value != null ? brl(p.value) : '—'}</td><td className="muted tnum">{p.at ? new Date(p.at).toLocaleDateString('pt-BR') : ''}</td></tr>
          ))}</tbody>
        </table> : <div className="empty">Nenhum pagamento registrado ainda.</div>}
      </div>
    </>
  );
}

// ---------- Gerenciar plano/cobrança (modal nativo do console) ----------
function ManagePanel({ tenant, plans, asaasConfigured, onClose, onDone }) {
  const baseStatus = tenant.archived ? 'suspended' : (tenant.status || 'active');
  const [f, setF] = useState({ plan: tenant.plan || '', status: baseStatus, trialDays: '', paymentStatus: tenant.paymentStatus || '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [asaas, setAsaas] = useState({ cpfCnpj: '', email: tenant.primaryAdminEmail || '', cycle: 'monthly' });
  const [asaasBusy, setAsaasBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const callAsaas = async (method, extra) => {
    setAsaasBusy(true); setErr('');
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/asaas', { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ tenantId: tenant.id, ...extra }) });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Erro no Asaas.'); setAsaasBusy(false); return; }
      onDone();
    } catch (e) { console.error('asaas', e); setErr('Falha ao falar com o Asaas.'); setAsaasBusy(false); }
  };
  const save = async () => {
    setSaving(true); setErr('');
    const body = { tenantId: tenant.id };
    if (f.plan && f.plan !== tenant.plan) body.plan = f.plan;
    if (f.status !== baseStatus) body.status = f.status;
    if (f.trialDays !== '') body.trialDays = Number(f.trialDays);
    if (f.paymentStatus !== (tenant.paymentStatus || '')) body.paymentStatus = f.paymentStatus || null;
    if (Object.keys(body).length === 1) { onClose(); return; }
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/tenant-status', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Erro ao salvar.'); setSaving(false); return; }
      onDone();
    } catch (e) { console.error('manage save', e); setErr('Erro ao salvar.'); setSaving(false); }
  };
  const planList = (plans || []).filter((p) => p.isActive !== false || p.slug === tenant.plan);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(7,11,24,.6)', backdropFilter: 'blur(3px)' }} onClick={onClose} />
      <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 460 }}>
        <div className="card-h"><h3>Gerenciar — {tenant.displayName}</h3><button className="icon-btn" onClick={onClose}><Icon name="close" size={15} /></button></div>
        <div className="card-pad" style={{ display: 'grid', gap: 14 }}>
          <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.5 }}>O acesso é controlado <b style={{ color: 'var(--text)' }}>automaticamente</b> pela cobrança: <b style={{ color: 'var(--success)' }}>pago</b> libera · <b style={{ color: '#FF8497' }}>inadimplente + 3 dias</b> bloqueia o app. Os campos abaixo são p/ ajuste manual em casos especiais.</div>
          <label style={{ display: 'grid', gap: 6 }}><span className="muted" style={{ fontSize: 12 }}>Plano</span>
            <select style={FLAG_INPUT} value={f.plan} onChange={(e) => set('plan', e.target.value)}>
              {planList.length === 0 && <option value={tenant.plan}>{tenant.plan}</option>}
              {planList.map((p) => <option key={p.id || p.slug} value={p.slug}>{p.name}{p.priceMonthly ? ` · ${brl(p.priceMonthly)}/mês` : ''}</option>)}
            </select>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}><span className="muted" style={{ fontSize: 12 }}>Status</span>
              <select style={FLAG_INPUT} value={f.status} onChange={(e) => set('status', e.target.value)}>
                <option value="active">Ativa</option><option value="suspended">Suspensa</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}><span className="muted" style={{ fontSize: 12 }}>Pagamento</span>
              <select style={FLAG_INPUT} value={f.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value)}>
                <option value="">—</option><option value="paid">Pago</option><option value="pending">Pendente</option><option value="overdue">Inadimplente</option>
              </select>
            </label>
          </div>
          <label style={{ display: 'grid', gap: 6 }}><span className="muted" style={{ fontSize: 12 }}>Trial (dias) — vazio = não mexe · 0 = encerra</span>
            <input style={FLAG_INPUT} type="number" min="0" value={f.trialDays} onChange={(e) => set('trialDays', e.target.value)} placeholder="—" />
          </label>
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8, fontWeight: 600 }}>Cobrança automática (Asaas)</div>
            {!asaasConfigured ? (
              <div className="muted" style={{ fontSize: 12 }}>Asaas não configurado (defina as chaves no Vercel).</div>
            ) : tenant.asaasSubscriptionId ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="badge b-paga">assinatura {tenant.billingCycle === 'annual' ? 'anual' : 'mensal'} ativa</span>
                {tenant.lastInvoiceUrl && <button className="btn btn-ghost btn-sm" onClick={() => { try { navigator.clipboard?.writeText(tenant.lastInvoiceUrl); } catch { /* ignore */ } }}>Copiar fatura</button>}
                <button className="btn btn-ghost btn-sm" onClick={() => { if (window.confirm('Cancelar a assinatura no Asaas?')) callAsaas('DELETE', {}); }} disabled={asaasBusy}>Cancelar</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input style={FLAG_INPUT} placeholder="CPF/CNPJ" value={asaas.cpfCnpj} onChange={(e) => setAsaas((s) => ({ ...s, cpfCnpj: e.target.value }))} />
                  <select style={FLAG_INPUT} value={asaas.cycle} onChange={(e) => setAsaas((s) => ({ ...s, cycle: e.target.value }))}><option value="monthly">Mensal</option><option value="annual">Anual</option></select>
                </div>
                <input style={FLAG_INPUT} type="email" placeholder="E-mail do responsável" value={asaas.email} onChange={(e) => setAsaas((s) => ({ ...s, email: e.target.value }))} />
                <button className="btn btn-primary btn-sm" style={{ justifySelf: 'start' }} onClick={() => callAsaas('POST', { cpfCnpj: asaas.cpfCnpj, email: asaas.email, cycle: asaas.cycle })} disabled={asaasBusy}>{asaasBusy ? 'Criando…' : 'Criar assinatura no Asaas'}</button>
              </div>
            )}
          </div>
          {err && <div style={{ color: 'var(--danger)', fontSize: 12.5 }}>{err}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Academia (detalhe, tela cheia) ----------
function Detail({ tenantId, tenants, overview, audit, plans, asaasConfigured, go, reload }) {
  const t = (tenants || []).find((x) => x.id === tenantId);
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [manageOpen, setManageOpen] = useState(false);
  useEffect(() => {
    if (!tenantId) return undefined;
    let alive = true;
    (async () => {
      try {
        const token = await auth.currentUser.getIdToken();
        const res = await fetch(`/api/tenant-status?tenantId=${encodeURIComponent(tenantId)}`, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (alive && res.ok) setStats(json);
      } catch (e) { console.error('console tenant-status', e); }
    })();
    return () => { alive = false; };
  }, [tenantId]);

  if (!t) return <div className="empty">Academia não encontrada.</div>;
  // "Acessar como" (impersonar): reusa /api/impersonate; ao entrar, o App remonta
  // como o admin do cliente e este console fecha sozinho (deixa de ser super-admin).
  const enterAs = async () => {
    if (busy) return;
    setErr(''); setBusy(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/impersonate', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ tenantId: t.id }) });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Não foi possível entrar.'); setBusy(false); return; }
      try { sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify({ viewing: { id: t.id, name: data.tenantName || t.displayName } })); } catch { /* ignore */ }
      try { await setPersistence(auth, browserSessionPersistence); } catch { /* ignore */ }
      await signInWithCustomToken(auth, data.token);
    } catch (e) { console.error('enterAs', e); setErr('Falha ao entrar como a organização.'); setBusy(false); }
  };
  const [bg, fg] = tone(t.id);
  const pays = (overview?.recentPayments || []).filter((p) => p.tenantId === tenantId).slice(0, 6);
  const events = (audit || []).filter((l) => l.tenantId === tenantId).slice(0, 6);
  const usage = [
    { n: 'Leads cadastrados', v: stats?.leadCount ?? null, max: Math.max(100, stats?.leadCount || 0) },
    { n: 'Gestores', v: stats?.managers ?? null, max: stats?.maxManagers || Math.max(1, stats?.managers || 0) },
    {
      n: stats?.extraConsultants > 0 ? `Consultores (${stats.extraConsultants} extra${stats.extraConsultants === 1 ? '' : 's'})` : 'Consultores',
      v: stats?.consultants ?? null,
      max: stats?.maxConsultants != null ? stats.maxConsultants + (stats?.extraConsultants || 0) : Math.max(3, stats?.consultants || 0),
    },
    { n: 'Interações registradas', v: stats?.interactionCount ?? null, max: Math.max(100, stats?.interactionCount || 0) },
  ];
  return (
    <>
      <div className="ph">
        <div className="detail-hero">
          <span className="dh-logo" style={{ background: bg, color: fg }}>{initials(t.displayName)}</span>
          <div>
            <h1>{t.displayName} {statusBadge(t)}</h1>
            <div className="dh-meta">
              <span><Icon name="building" size={14} /> {[t.settings?.city, t.settings?.state].filter(Boolean).join(' · ') || t.id}</span>
              <span>Plano <b>{planLabel(t.plan)}</b></span>
              <span>MRR <b>{t.price ? brl(t.price) : '—'}</b></span>
              <span>Desde <b>{t.createdAt ? new Date(t.createdAt).toLocaleDateString('pt-BR') : '—'}</b></span>
            </div>
          </div>
        </div>
        <div className="ph-actions">
          {err && <span style={{ color: 'var(--danger)', fontSize: 12, alignSelf: 'center', maxWidth: 220 }}>{err}</span>}
          <button className="btn btn-ghost" onClick={enterAs} disabled={busy}><Icon name="ext" size={16} /> {busy ? 'Entrando…' : 'Acessar como'}</button>
          <button className="btn btn-primary" onClick={() => setManageOpen(true)}><Icon name="plans" size={16} /> Gerenciar plano</button>
        </div>
      </div>
      {manageOpen && <ManagePanel tenant={t} plans={plans} asaasConfigured={asaasConfigured} onClose={() => setManageOpen(false)} onDone={() => { setManageOpen(false); reload?.(); }} />}

      <div className="grid mini-grid" style={{ marginBottom: 16 }}>
        <div className="mini"><div className="mini-l">Usuários</div><div className="mini-v">{stats?.userCount ?? '—'}</div></div>
        <div className="mini"><div className="mini-l">Leads</div><div className="mini-v">{stats?.leadCount != null ? stats.leadCount.toLocaleString('pt-BR') : '—'}</div></div>
        <div className="mini"><div className="mini-l">Interações</div><div className="mini-v">{stats?.interactionCount != null ? stats.interactionCount.toLocaleString('pt-BR') : '—'}</div></div>
        <div className="mini"><div className="mini-l">Pagamento</div><div className="mini-v" style={{ fontSize: 15, marginTop: 11 }}>{payBadge(t.paymentStatus)}</div></div>
      </div>

      <div className="grid col-2" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-h"><h3>Uso da plataforma</h3>{!stats && <span className="sub">carregando…</span>}</div>
            <div className="card-pad">
              {usage.map((u) => (
                <div key={u.n} className="urow">
                  <span className="un" style={{ flex: 1 }}>{u.n}</span>
                  <span className="ubar"><span className="prog"><i style={{ width: `${u.v != null ? Math.min(100, (u.v / u.max) * 100) : 0}%` }} /></span></span>
                  <span className="uv">{u.v != null ? u.v.toLocaleString('pt-BR') : '—'}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-h"><h3>Pagamentos</h3><a className="sub" style={{ color: 'var(--brand-300)' }} onClick={() => go('billing')}>Faturamento →</a></div>
            {pays.length ? <table className="tbl"><tbody>{pays.map((p) => (
              <tr key={p.id}><td className="muted">{p.event}</td><td className="tnum" style={{ textAlign: 'right' }}>{p.value != null ? brl(p.value) : '—'}</td><td className="muted tnum" style={{ textAlign: 'right' }}>{p.at ? new Date(p.at).toLocaleDateString('pt-BR') : ''}</td></tr>
            ))}</tbody></table> : <div className="empty" style={{ padding: 24 }}>Sem pagamentos registrados.</div>}
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h3>Atividade recente</h3></div>
          <div className="card-pad">
            <div className="tl">
              <div className="tl-item"><span className="tl-dot" /><div className="tl-t">Último acesso — {t.lastActivityAt ? new Date(t.lastActivityAt).toLocaleString('pt-BR') : '—'}</div><div className="tl-s">app.stronilead.com</div></div>
              {events.map((l) => (
                <div key={l.id} className="tl-item"><span className="tl-dot" style={{ background: 'var(--accent)' }} /><div className="tl-t">{auditActionLabel(l.action) || l.action}</div><div className="tl-s">{l.at ? new Date(l.at).toLocaleString('pt-BR') : ''}{detailStr(l.details) ? ' · ' + detailStr(l.details) : ''}</div></div>
              ))}
              <div className="tl-item"><span className="tl-dot" style={{ background: 'var(--muted)' }} /><div className="tl-t">Conta criada</div><div className="tl-s">{t.createdAt ? new Date(t.createdAt).toLocaleDateString('pt-BR') : '—'}</div></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------- Feature flags (Firestore direto, CRUD real) ----------
const FLAG_INPUT = { height: 38, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '0 12px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'var(--ui)' };
function FlagsScreen() {
  const [flags, setFlags] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ key: '', name: '', desc: '', scope: 'Todos' });
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'flags'),
      (snap) => setFlags(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => { console.error('flags', e); setFlags([]); });
    return () => unsub();
  }, []);
  const toggle = (f) => setDoc(doc(db, 'flags', f.id), { enabled: !f.enabled, updatedAt: serverTimestamp() }, { merge: true }).catch((e) => console.error('flag toggle', e));
  const setRollout = (f, v) => setDoc(doc(db, 'flags', f.id), { rollout: v, updatedAt: serverTimestamp() }, { merge: true }).catch((e) => console.error('flag rollout', e));
  const remove = (f) => { if (window.confirm(`Excluir a flag "${f.name}"?`)) deleteDoc(doc(db, 'flags', f.id)).catch((e) => console.error('flag del', e)); };
  const create = () => {
    const key = (form.key || form.name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!key || !form.name.trim()) return;
    setDoc(doc(db, 'flags', key), { name: form.name.trim(), desc: form.desc.trim(), scope: form.scope.trim() || 'Todos', rollout: 0, enabled: false, createdAt: serverTimestamp() })
      .then(() => { setShowNew(false); setForm({ key: '', name: '', desc: '', scope: 'Todos' }); })
      .catch((e) => console.error('flag create', e));
  };
  return (
    <>
      <div className="ph">
        <div><h1>Feature flags</h1><p>Controle de funcionalidades e rollout gradual</p></div>
        <div className="ph-actions"><button className="btn btn-primary" onClick={() => setShowNew((s) => !s)}><Icon name="plus" size={16} /> Nova flag</button></div>
      </div>
      {showNew && (
        <div className="card card-pad" style={{ marginBottom: 16, display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
          <input style={FLAG_INPUT} placeholder="Nome (ex: Templates WhatsApp)" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
          <input style={FLAG_INPUT} placeholder="Chave (auto se vazio)" value={form.key} onChange={(e) => setForm((s) => ({ ...s, key: e.target.value }))} />
          <input style={{ ...FLAG_INPUT, gridColumn: '1 / 3' }} placeholder="Descrição" value={form.desc} onChange={(e) => setForm((s) => ({ ...s, desc: e.target.value }))} />
          <input style={FLAG_INPUT} placeholder="Escopo (ex: Pro, Rede, Todos)" value={form.scope} onChange={(e) => setForm((s) => ({ ...s, scope: e.target.value }))} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm" onClick={create}>Criar flag</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowNew(false)}>Cancelar</button>
          </div>
        </div>
      )}
      <div className="card">
        {flags === null ? <div className="empty">Carregando…</div>
          : flags.length === 0 ? <div className="empty">Nenhuma flag ainda. Crie a primeira em “Nova flag”.</div>
            : flags.map((f) => (
              <div className="flag" key={f.id}>
                <div className="flag-main">
                  <div className="flag-name">{f.name} <span className="flag-key">{f.id}</span> <span className={`badge ${f.enabled ? 'b-paga' : 'b-cancel'}`}>{f.enabled ? 'Ativo' : 'Inativo'}</span></div>
                  <div className="flag-desc">{f.desc || '—'}</div>
                  <div className="flag-roll">
                    <input type="range" min="0" max="100" value={f.rollout || 0} onChange={(e) => setRollout(f, Number(e.target.value))} style={{ flex: 1, accentColor: '#3B6DF5' }} />
                    <span className="pct">{f.rollout || 0}%</span>
                    <span className="muted" style={{ fontSize: 11.5 }}>· {f.scope || 'Todos'}</span>
                    <button className="icon-btn" title="Excluir" onClick={() => remove(f)}><Icon name="close" size={14} /></button>
                  </div>
                </div>
                <div className={`sw${f.enabled ? ' on' : ''}`} onClick={() => toggle(f)} />
              </div>
            ))}
      </div>
    </>
  );
}

// ---------- Suporte (tickets, Firestore direto) ----------
const PRI = { alta: { c: 'b-inad', t: 'Alta' }, media: { c: 'b-pendente', t: 'Média' }, baixa: { c: 'b-cancel', t: 'Baixa' } };
const TST = { aberto: { c: 'b-trial', t: 'Aberto' }, em_andamento: { c: 'b-pendente', t: 'Em andamento' }, resolvido: { c: 'b-paga', t: 'Resolvido' } };
const NEXT_ST = { aberto: 'em_andamento', em_andamento: 'resolvido', resolvido: 'aberto' };
function SupportScreen({ tenants }) {
  const [tickets, setTickets] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ tenantId: '', assunto: '', prioridade: 'media' });
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tickets'),
      (snap) => setTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))),
      (e) => { console.error('tickets', e); setTickets([]); });
    return () => unsub();
  }, []);
  const list = (tenants || []).filter((t) => !t.internal);
  const nameOf = Object.fromEntries((tenants || []).map((x) => [x.id, x.displayName]));
  const open = (tickets || []).filter((t) => t.status !== 'resolvido').length;
  const highPri = (tickets || []).filter((t) => t.prioridade === 'alta' && t.status !== 'resolvido').length;
  const cycleStatus = (t) => setDoc(doc(db, 'tickets', t.id), { status: NEXT_ST[t.status] || 'aberto', updatedAt: serverTimestamp() }, { merge: true }).catch((e) => console.error('ticket status', e));
  const create = () => {
    if (!form.tenantId || !form.assunto.trim()) return;
    const ten = list.find((t) => t.id === form.tenantId);
    addDoc(collection(db, 'tickets'), { tenantId: form.tenantId, academia: ten?.displayName || form.tenantId, assunto: form.assunto.trim(), prioridade: form.prioridade, status: 'aberto', agente: '—', createdAt: serverTimestamp() })
      .then(() => { setShowNew(false); setForm({ tenantId: '', assunto: '', prioridade: 'media' }); })
      .catch((e) => console.error('ticket create', e));
  };
  return (
    <>
      <div className="ph">
        <div><h1>Suporte</h1><p>{open} tickets abertos · {highPri} de alta prioridade</p></div>
        <div className="ph-actions"><button className="btn btn-primary" onClick={() => setShowNew((s) => !s)}><Icon name="plus" size={16} /> Novo ticket</button></div>
      </div>
      {showNew && (
        <div className="card card-pad" style={{ marginBottom: 16, display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
          <select style={FLAG_INPUT} value={form.tenantId} onChange={(e) => setForm((s) => ({ ...s, tenantId: e.target.value }))}>
            <option value="">Academia…</option>
            {list.map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}
          </select>
          <select style={FLAG_INPUT} value={form.prioridade} onChange={(e) => setForm((s) => ({ ...s, prioridade: e.target.value }))}>
            <option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option>
          </select>
          <input style={{ ...FLAG_INPUT, gridColumn: '1 / 3' }} placeholder="Assunto do ticket" value={form.assunto} onChange={(e) => setForm((s) => ({ ...s, assunto: e.target.value }))} />
          <div style={{ display: 'flex', gap: 8 }}><button className="btn btn-primary btn-sm" onClick={create}>Abrir ticket</button><button className="btn btn-ghost btn-sm" onClick={() => setShowNew(false)}>Cancelar</button></div>
        </div>
      )}
      <div className="card">
        <table className="tbl">
          <thead><tr><th>Ticket</th><th>Academia</th><th>Assunto</th><th>Prioridade</th><th>Status</th><th>Aberto</th></tr></thead>
          <tbody>
            {tickets === null ? <tr><td colSpan={6} className="empty">Carregando…</td></tr>
              : tickets.length === 0 ? <tr><td colSpan={6} className="empty">Nenhum ticket ainda. Abra o primeiro em “Novo ticket”.</td></tr>
                : tickets.map((t) => (
                  <tr key={t.id}>
                    <td className="tnum" style={{ fontWeight: 600 }}>#{String(t.id).slice(0, 5)}</td>
                    <td style={{ fontWeight: 600 }}>{nameOf[t.tenantId] || t.academia || t.tenantId}</td>
                    <td style={{ maxWidth: 280 }}>{t.assunto}</td>
                    <td><span className={`badge ${(PRI[t.prioridade] || PRI.media).c}`}>{(PRI[t.prioridade] || PRI.media).t}</span></td>
                    <td><button className={`badge ${(TST[t.status] || TST.aberto).c}`} style={{ cursor: 'pointer', border: 0 }} title="Clique p/ avançar o status" onClick={() => cycleStatus(t)}>{(TST[t.status] || TST.aberto).t}</button></td>
                    <td className="muted tnum">{t.createdAt?.toMillis ? new Date(t.createdAt.toMillis()).toLocaleDateString('pt-BR') : '—'}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------- Saúde do sistema (medição ao vivo no navegador) ----------
const HEALTH_ST = { operacional: { c: 'op', t: 'Operacional', b: 'b-paga' }, degradado: { c: 'dg', t: 'Degradado', b: 'b-pendente' }, fora: { c: 'down', t: 'Fora do ar', b: 'b-inad' } };
function HealthScreen() {
  const [checks, setChecks] = useState(null);
  const [ranAt, setRanAt] = useState('');
  const run = async () => {
    const token = await auth.currentUser.getIdToken().catch(() => null);
    setChecks(null);
    const probe = async (label, fn) => {
      const t0 = performance.now();
      try { const ok = await fn(); return { label, lat: Math.round(performance.now() - t0), estado: ok ? 'operacional' : 'degradado' }; }
      catch { return { label, lat: Math.round(performance.now() - t0), estado: 'fora' }; }
    };
    const results = await Promise.all([
      probe('App · stronilead.com.br', async () => (await fetch('/', { cache: 'no-store' })).ok),
      probe('API · Visão geral', async () => (await fetch('/api/super-overview', { headers: token ? { Authorization: `Bearer ${token}` } : {} })).ok),
      probe('Gateway Asaas', async () => { const r = await fetch('/api/asaas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); return r.status === 401 || r.ok; }),
      probe('Banco · Firestore', async () => { await getDoc(doc(db, 'tenants', 'healthcheck-probe')); return true; }),
    ]);
    setChecks(results);
    setRanAt(new Date().toLocaleTimeString('pt-BR'));
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect -- run() é fetch async; só faz setState após await
  useEffect(() => { run(); }, []);
  const measured = (checks || []).filter((c) => c.lat != null);
  const avg = measured.length ? Math.round(measured.reduce((s, c) => s + c.lat, 0) / measured.length) : null;
  const down = (checks || []).filter((c) => c.estado === 'fora').length;
  return (
    <>
      <div className="ph">
        <div><h1>Saúde do sistema</h1><p>Medição ao vivo (do seu navegador){ranAt ? ` · ${ranAt}` : ''}</p></div>
        <div className="ph-actions"><button className="btn btn-ghost" onClick={run}><Icon name="health" size={16} /> Medir de novo</button></div>
      </div>
      <div className="grid kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 16 }}>
        <div className="kpi"><div className="kpi-top"><span className="kpi-label">Serviços OK</span><span className="kpi-ic t-success"><Icon name="check" /></span></div><div className="kpi-val">{checks ? `${checks.filter((c) => c.estado === 'operacional').length}/${checks.length}` : '—'}</div><div className="kpi-foot">medido agora</div></div>
        <div className="kpi"><div className="kpi-top"><span className="kpi-label">Latência média</span><span className="kpi-ic t-brand"><Icon name="zap" /></span></div><div className="kpi-val">{avg != null ? avg : '—'}<small>ms</small></div><div className="kpi-foot">navegador → serviço</div></div>
        <div className="kpi"><div className="kpi-top"><span className="kpi-label">Fora do ar</span><span className="kpi-ic t-danger"><Icon name="alert" /></span></div><div className="kpi-val">{down}</div><div className="kpi-foot">serviços agora</div></div>
      </div>
      <div className="card">
        <div className="card-h"><h3>Serviços</h3><span className="sub">{checks ? 'medido agora' : 'medindo…'}</span></div>
        <div>
          {checks ? checks.map((c) => { const st = HEALTH_ST[c.estado]; return (
            <div className="svc" key={c.label}>
              <span className={`svc-dot ${st.c}`} />
              <div><div className="svc-n">{c.label}</div></div>
              <div className="svc-m"><span>lat <b>{c.lat != null ? c.lat + ' ms' : '—'}</b></span><span className={`badge ${st.b}`}>{st.t}</span></div>
            </div>
          ); }) : <div className="empty">Medindo serviços…</div>}
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-pad muted" style={{ fontSize: 12.5 }}>
          ℹ️ Medição feita ao vivo do seu navegador (a latência inclui a rede). <b>Uptime histórico</b> (gráfico de 60 dias) precisa de cron + armazenamento — fica como próximo passo quando fizer sentido.
        </div>
      </div>
    </>
  );
}

// ---------- Shell ----------
function SuperConsole({ appUser, onClose }) {
  const [route, setRoute] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [audit, setAudit] = useState([]);
  const [plans, setPlans] = useState(null);
  const [asaasConfigured, setAsaasConfigured] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/super-overview', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (res.ok) { setOverview(json.totals || null); setTenants(json.tenants || []); setAudit(json.audit || []); setAsaasConfigured(!!json.asaasConfigured); }
      const pRes = await fetch('/api/plans', { headers: { Authorization: `Bearer ${token}` } });
      const pJson = await pRes.json().catch(() => null);
      if (pRes.ok) setPlans(Array.isArray(pJson) ? pJson : (pJson?.plans || []));
    } catch (e) { console.error('console fetch', e); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadData(); }, []);

  const go = (r, arg) => { setRoute(r); if (arg !== undefined) setSelectedTenant(arg); document.querySelector('.console-root .main')?.scrollTo(0, 0); };

  return (
    <div className="console-root">
      <aside className="side">
        <div className="side-brand">
          <span className="smk">
            <svg viewBox="0 0 48 48" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 39 L24 29 L37 39" stroke="#fff" strokeWidth="4.4" />
              <path d="M13.5 30 L24 21.5 L34.5 30" stroke="#fff" strokeWidth="4.4" />
              <path d="M16 21 L24 14 L32 21" stroke="#FF6A2B" strokeWidth="4.4" />
            </svg>
          </span>
          <div className="sbrand-tx">
            <span className="sbrand-wm">STRONI<span className="b">LEAD</span></span>
            <span className="sbrand-tag">Console · Plataforma</span>
          </div>
        </div>
        <div className="side-scroll">
          {NAV.map((g) => (
            <div className="nav-group" key={g.group}>
              <div className="nav-label">{g.group}</div>
              {g.items.map((it) => (
                <button key={it.id} className={`nav-item${(route === 'tenant' ? 'tenants' : route) === it.id ? ' active' : ''}`} onClick={() => go(it.id)}>
                  <span className="ni-ic"><Icon name={it.icon} /></span>
                  <span>{it.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="side-foot">
          <div className="who">
            <span className="who-av">{initials(appUser?.name || 'Super Admin')}</span>
            <div className="who-tx">
              <div className="who-n">{appUser?.name || 'Super Admin'}</div>
              <div className="who-r">{appUser?.email || 'platform@stronilead.com'}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="top">
          <div className="crumb">
            {route === 'tenant'
              ? <>Console / <a onClick={() => go('tenants')}>Academias</a> / <b>{(tenants.find((t) => t.id === selectedTenant) || {}).displayName || 'Detalhe'}</b></>
              : <>Console / <b>{TITLES[route]}</b></>}
          </div>
          <span className="env-pill"><span className="d" /> PRODUÇÃO</span>
          <div className="top-search"><Icon name="search" size={16} /><input placeholder="Buscar academia, fatura, ticket…" /></div>
          <button className="top-ic" title="Sair" onClick={onClose}><Icon name="close" size={18} /></button>
        </header>
        <main className="view">
          {route === 'overview' && <Overview overview={overview} tenants={tenants} loading={loading} go={go} />}
          {route === 'tenants' && <Tenants tenants={tenants} go={go} />}
          {route === 'tenant' && <Detail tenantId={selectedTenant} tenants={tenants} overview={overview} audit={audit} plans={plans} asaasConfigured={asaasConfigured} go={go} reload={loadData} />}
          {route === 'plans' && <Plans plans={plans} onReload={loadData} />}
          {route === 'billing' && <Billing overview={overview} tenants={tenants} />}
          {route === 'support' && <SupportScreen tenants={tenants} />}
          {route === 'flags' && <FlagsScreen />}
          {route === 'health' && <HealthScreen />}
          {route === 'logs' && <Logs audit={audit} />}
          {!['overview', 'tenants', 'tenant', 'plans', 'billing', 'support', 'flags', 'health', 'logs'].includes(route) && <Placeholder route={route} />}
        </main>
      </div>
    </div>
  );
}

export { SuperConsole };
