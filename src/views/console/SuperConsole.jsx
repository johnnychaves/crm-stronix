import { useEffect, useMemo, useState } from 'react';
import { auth } from '../../lib/firebase.js';
import { planLabel } from '../../lib/superadmin.js';
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

// ---------- Shell ----------
function SuperConsole({ appUser, onClose }) {
  const [route, setRoute] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await auth.currentUser.getIdToken();
        const res = await fetch('/api/super-overview', { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (alive && res.ok) { setOverview(json.totals || null); setTenants(json.tenants || []); }
      } catch (e) { console.error('console super-overview', e); }
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
          {route === 'overview'
            ? <Overview overview={overview} tenants={tenants} loading={loading} go={go} />
            : <Placeholder route={route} />}
        </main>
      </div>
    </div>
  );
}

export { SuperConsole };
