import { useEffect, useMemo, useState } from 'react';
import { auth } from '../../lib/firebase.js';
import { planLabel, auditActionLabel } from '../../lib/superadmin.js';
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
function Tenants({ tenants }) {
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
              <tr key={t.id}>
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

// ---------- Planos & assinaturas (dados reais) ----------
function Plans({ plans }) {
  if (!plans) return <div className="empty">Carregando planos…</div>;
  const active = plans.filter((p) => p.isActive !== false);
  const totalOrgs = plans.reduce((s, p) => s + (p.tenantCount || 0), 0) || 1;
  return (
    <>
      <div className="ph">
        <div><h1>Planos & assinaturas</h1><p>Gerencie os planos comerciais da plataforma</p></div>
        <div className="ph-actions"><button className="btn btn-primary"><Icon name="plus" size={16} /> Novo plano</button></div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 18 }}>
        {active.map((p, i) => {
          const color = PLAN_PAL[i % PLAN_PAL.length];
          return (
            <div key={p.id} className="card card-pad" style={{ position: 'relative', ...(p.isDefault ? { borderColor: 'var(--brand)', boxShadow: '0 24px 60px -34px rgba(43,89,255,.6)' } : {}) }}>
              {p.isDefault && <span className="badge b-trial" style={{ position: 'absolute', top: 16, right: 16 }}>Padrão</span>}
              <div style={{ fontFamily: 'var(--head)', fontWeight: 700, fontSize: 19, color }}>{p.name}</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{p.maxUsers == null ? 'Usuários ilimitados' : `até ${p.maxUsers} usuários`}</div>
              <div style={{ fontFamily: 'var(--head)', fontWeight: 700, fontSize: 38, letterSpacing: '-.02em', margin: '14px 0 2px' }}>
                {p.priceMonthly ? brl(p.priceMonthly) : 'Sob medida'}
                {p.priceMonthly ? <span style={{ fontSize: 15, color: 'var(--muted)', fontWeight: 500, fontFamily: 'var(--ui)' }}>/mês</span> : null}
              </div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>{p.tenantCount || 0} academias ativas</div>
              {Array.isArray(p.features) && p.features.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                  {p.features.map((f, j) => <div key={j} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13 }}><span style={{ color: 'var(--success)', marginTop: 2 }}><Icon name="check" size={14} /></span>{f}</div>)}
                </div>
              )}
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
    </>
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

// ---------- Shell ----------
function SuperConsole({ appUser, onClose }) {
  const [route, setRoute] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [audit, setAudit] = useState([]);
  const [plans, setPlans] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await auth.currentUser.getIdToken();
        const res = await fetch('/api/super-overview', { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (alive && res.ok) { setOverview(json.totals || null); setTenants(json.tenants || []); setAudit(json.audit || []); }
        const pRes = await fetch('/api/plans', { headers: { Authorization: `Bearer ${token}` } });
        const pJson = await pRes.json().catch(() => null);
        if (alive && pRes.ok) setPlans(Array.isArray(pJson) ? pJson : (pJson?.plans || []));
      } catch (e) { console.error('console fetch', e); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const go = (r) => { setRoute(r); document.querySelector('.console-root .main')?.scrollTo(0, 0); };

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
                <button key={it.id} className={`nav-item${route === it.id ? ' active' : ''}`} onClick={() => go(it.id)}>
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
          <div className="crumb">Console / <b>{TITLES[route]}</b></div>
          <span className="env-pill"><span className="d" /> PRODUÇÃO</span>
          <div className="top-search"><Icon name="search" size={16} /><input placeholder="Buscar academia, fatura, ticket…" /></div>
          <button className="top-ic" title="Voltar ao painel" onClick={onClose}><Icon name="close" size={18} /></button>
        </header>
        <main className="view">
          {route === 'overview' && <Overview overview={overview} tenants={tenants} loading={loading} go={go} />}
          {route === 'tenants' && <Tenants tenants={tenants} />}
          {route === 'plans' && <Plans plans={plans} />}
          {route === 'billing' && <Billing overview={overview} tenants={tenants} />}
          {route === 'logs' && <Logs audit={audit} />}
          {!['overview', 'tenants', 'plans', 'billing', 'logs'].includes(route) && <Placeholder route={route} />}
        </main>
      </div>
    </div>
  );
}

export { SuperConsole };
