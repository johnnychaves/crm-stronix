import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { appId, DAILY_GOAL_HISTORY_PATH } from '../lib/firebase.js';
import { DAILY_GOAL_CATEGORIES } from '../lib/leads.js';
import { DG_CATEGORY_META, DG_CATEGORY_ORDER, COLOR_TONES, buildInteractionsByLead, computeDailyGoalSlots, slotTotals, computeRitmo, overdueDaysOf, DEFAULT_SLA_OVERDUE_DAYS } from '../lib/dailyGoal.js';
import { Avatar } from '../components/ui/Avatar.jsx';
import { AlertCircle, AlertTriangle, CheckCircle, ChevronDown, Flame, Shield, Target, Trophy, Users } from 'lucide-react';

// ============================================================================
// PAINEL DA EQUIPE — visão do GESTOR sobre a meta diária dos consultores.
// LEITURA apenas: concluir tarefa continua sendo ato do consultor (filosofia
// Meta-only); o gestor acompanha, expande o detalhe e cobra com contexto.
// Tudo calculado client-side: o admin já tem leads+interações de toda a
// equipe carregados (base compartilhada) e a regra do Firestore permite o
// admin ler o histórico de metas batidas de todos.
// ============================================================================

// Mesmo glyph da tela da Meta (DailyGoalView) — duplicado de propósito para
// não mexer naquele arquivo aqui; extrair p/ components/ui se ganhar 3º uso.
function WhatsappGlyph({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12a8 8 0 1 1-3.2-6.4L20 4l-1.4 3.2A8 8 0 0 1 20 12z" />
      <path d="M8.5 9.5c0 3 2 5 5 5l1.5-1.5-2-1-1 1c-1 0-2-1-2-2l1-1-1-2L9 7c-.5 1-.5 2-.5 2.5z" />
    </svg>
  );
}

function TeamStat({ icon, label, value, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300',
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <span className={`w-9 h-9 rounded-lg grid place-items-center ${tones[tone]}`}>{icon}</span>
      <div className="min-w-0">
        <div className="num text-[17px] font-bold text-slate-900 dark:text-white leading-tight">{value}</div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}</div>
      </div>
    </div>
  );
}

function PendingCatChip({ slug, count }) {
  const m = DG_CATEGORY_META[slug];
  if (!m || !count) return null;
  const t = COLOR_TONES[m.color];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap ${t.soft} ${t.text} ${t.darkSoft} ${t.darkText}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`}></span>
      {count} {m.short.toLowerCase()}
    </span>
  );
}

function statusBadge(row) {
  if (row.totalSlots === 0) {
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">Sem tarefas hoje</span>;
  }
  if (row.progress === 100) {
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><CheckCircle size={11} /> Meta batida</span>;
  }
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Em andamento</span>;
}

function DailyGoalTeamView({ leads, interactions, usersList, metaWeekdays, slaOverdueDays = DEFAULT_SLA_OVERDUE_DAYS, db, appUser, onOpenLead }) {
  const [expandedId, setExpandedId] = useState(null);
  const [teamHistory, setTeamHistory] = useState([]);

  // Histórico de metas batidas da EQUIPE inteira (sem filtro de consultor —
  // a regra publicada permite o admin ler todos; consultor lê só o próprio).
  useEffect(() => {
    const ref = collection(db, 'artifacts', appId, 'public', 'data', DAILY_GOAL_HISTORY_PATH);
    const unsub = onSnapshot(
      ref,
      (snap) => setTeamHistory(snap.docs.map(d => d.data())),
      (e) => console.error('team history', e)
    );
    return () => unsub();
  }, [db]);

  const rows = useMemo(() => {
    const byLead = buildInteractionsByLead(interactions);
    const historyByConsultant = new Map();
    teamHistory.forEach(h => {
      if (!h?.consultantId) return;
      const arr = historyByConsultant.get(h.consultantId);
      if (arr) arr.push(h); else historyByConsultant.set(h.consultantId, [h]);
    });
    return (usersList || [])
      .map(u => {
        const processed = computeDailyGoalSlots(leads, byLead, u.id);
        const { totalSlots, doneSlots, progress } = slotTotals(processed);
        const pendingByCat = {};
        processed.forEach(l => l.categorySlugs.forEach(s => {
          if (!l.categoryStatus?.[s]) pendingByCat[s] = (pendingByCat[s] || 0) + 1;
        }));
        // SLA: atrasados pendentes com idade >= limiar viram "críticos".
        const critical = processed.filter(l =>
          l.categorySlugs.includes(DAILY_GOAL_CATEGORIES.ATRASADO) &&
          !l.categoryStatus?.[DAILY_GOAL_CATEGORIES.ATRASADO] &&
          overdueDaysOf(l) >= slaOverdueDays
        ).length;
        const ritmo = computeRitmo(historyByConsultant.get(u.id) || [], metaWeekdays);
        return { user: u, processed, totalSlots, doneSlots, progress, pendingByCat, critical, ritmo };
      })
      // Quem precisa de atenção primeiro: menor progresso no topo; depois mais
      // pendências; "sem tarefas hoje" vai para o fim.
      .sort((a, b) => {
        const aEmpty = a.totalSlots === 0, bEmpty = b.totalSlots === 0;
        if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
        if (a.progress !== b.progress) return a.progress - b.progress;
        return (b.totalSlots - b.doneSlots) - (a.totalSlots - a.doneSlots);
      });
  }, [leads, interactions, usersList, teamHistory, metaWeekdays, slaOverdueDays]);

  const team = useMemo(() => {
    const withTasks = rows.filter(r => r.totalSlots > 0);
    const totalSlots = withTasks.reduce((s, r) => s + r.totalSlots, 0);
    const doneSlots = withTasks.reduce((s, r) => s + r.doneSlots, 0);
    const overdue = rows.reduce((s, r) => s + (r.pendingByCat[DAILY_GOAL_CATEGORIES.ATRASADO] || 0), 0);
    const critical = rows.reduce((s, r) => s + r.critical, 0);
    const hit = withTasks.filter(r => r.progress === 100).length;
    return {
      totalSlots, doneSlots, overdue, critical, hit,
      withTasks: withTasks.length,
      progress: totalSlots > 0 ? Math.round((doneSlots / totalSlots) * 100) : 100,
    };
  }, [rows]);

  return (
    <div className="flex flex-col gap-6">
      {/* Resumo do time */}
      <div className="rounded-2xl border border-border bg-card shadow-card p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900 dark:text-white inline-flex items-center gap-2">
              <Users size={17} className="text-brand-600" /> Meta da equipe — hoje
            </h2>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
              Acompanhamento em tempo real. Concluir tarefa é ato do consultor — aqui você acompanha e cobra.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="num text-[22px] font-bold text-slate-900 dark:text-white leading-none">{team.progress}%</div>
              <div className="text-[11px] text-slate-400">{team.doneSlots} de {team.totalSlots} tarefas</div>
            </div>
            <div className="w-28 h-2 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
              <div className={`h-full rounded-full ${team.progress === 100 ? 'bg-emerald-500' : 'bg-brand-600'}`} style={{ width: `${team.progress}%`, transition: 'width .6s cubic-bezier(.2,.7,.2,1)' }} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <TeamStat icon={<Target size={16} />} tone="brand" value={`${team.doneSlots}/${team.totalSlots}`} label="tarefas do dia" />
          <TeamStat icon={<Trophy size={16} />} tone="emerald" value={`${team.hit} de ${team.withTasks}`} label="bateram a meta" />
          <TeamStat icon={<AlertCircle size={16} />} tone={team.overdue > 0 ? 'rose' : 'slate'} value={team.overdue} label="leads atrasados" />
          <TeamStat icon={<Users size={16} />} tone="slate" value={rows.length} label="pessoas na equipe" />
        </div>
      </div>

      {/* Alerta de SLA: leads atrasados além do limiar da academia */}
      {team.critical > 0 && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/[0.08] px-5 py-4 flex items-start gap-3">
          <span className="w-9 h-9 rounded-lg grid place-items-center bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300 shrink-0">
            <AlertTriangle size={17} />
          </span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-rose-800 dark:text-rose-200">
              {team.critical} lead{team.critical === 1 ? '' : 's'} atrasado{team.critical === 1 ? '' : 's'} há {slaOverdueDays}+ dia{slaOverdueDays === 1 ? '' : 's'} — fora do SLA da academia
            </div>
            <div className="text-[12px] text-rose-600 dark:text-rose-300/90 mt-0.5">
              {rows.filter(r => r.critical > 0).map(r => `${(r.user.name || '').split(' ')[0]} (${r.critical})`).join(' · ')} — expanda o card para cobrar pelo WhatsApp ou redistribuir.
            </div>
          </div>
        </div>
      )}

      {/* Um card por pessoa */}
      <div className="flex flex-col gap-3">
        {rows.map((r) => {
          const u = r.user;
          const expanded = expandedId === u.id;
          // Slots pendentes com a idade do atraso (SLA); os mais críticos primeiro.
          const pendingSlots = r.processed
            .flatMap(l => l.categorySlugs.filter(s => !l.categoryStatus?.[s]).map(s => ({
              lead: l, slug: s,
              overdue: s === DAILY_GOAL_CATEGORIES.ATRASADO ? overdueDaysOf(l) : 0,
            })))
            .sort((a, b) => b.overdue - a.overdue);
          const doneSlotsList = r.processed
            .flatMap(l => l.categorySlugs.filter(s => l.categoryStatus?.[s]).map(s => ({ lead: l, slug: s })));
          return (
            <div key={u.id} className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : u.id)}
                className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition"
              >
                <Avatar name={u.name} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-semibold text-slate-900 dark:text-white truncate">
                      {u.name}{u.id === appUser?.id ? ' (você)' : ''}
                    </span>
                    {u.role === 'admin' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"><Shield size={10} /> Gestor</span>
                    )}
                    {statusBadge(r)}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="flex-1 max-w-[260px] h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                      <div className={`h-full rounded-full ${r.totalSlots === 0 ? 'bg-slate-300 dark:bg-white/[0.12]' : r.progress === 100 ? 'bg-emerald-500' : 'bg-brand-600'}`} style={{ width: `${r.totalSlots === 0 ? 100 : r.progress}%`, transition: 'width .6s' }} />
                    </div>
                    <span className="num text-[12px] font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {r.totalSlots === 0 ? '—' : `${r.doneSlots} de ${r.totalSlots}`}
                    </span>
                  </div>
                  {(Object.keys(r.pendingByCat).length > 0 || r.critical > 0) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.critical > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap bg-rose-600 text-white">
                          <AlertTriangle size={10} /> {r.critical} há {slaOverdueDays}+ dias
                        </span>
                      )}
                      {DG_CATEGORY_ORDER.map(slug => <PendingCatChip key={slug} slug={slug} count={r.pendingByCat[slug]} />)}
                    </div>
                  )}
                </div>
                <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                  <span className="num text-[12px] text-slate-500 dark:text-slate-400">{r.ritmo.monthHits} de {r.ritmo.monthTarget} no mês</span>
                  {r.ritmo.streak > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-amber-600 dark:text-amber-400"><Flame size={12} /> {r.ritmo.streak} {r.ritmo.streak === 1 ? 'dia' : 'dias'} seguidos</span>
                  )}
                  {/* Régua dos últimos 14 dias — mesmo código de cores do "Ritmo
                      do mês" da visão pessoal (verde=batida, claro=não, apagado=
                      fora da meta, anel=hoje). Leitura de padrão num bater de olho. */}
                  <div className="flex gap-[3px] mt-0.5">
                    {r.ritmo.history14.map((day, i) => (
                      <div
                        key={i}
                        className={`w-[9px] h-3 rounded-[2px] ${
                          day.isToday ? 'bg-brand-600/20 ring-1 ring-brand-500'
                            : day.hit ? 'bg-emerald-500/80'
                              : day.active ? 'bg-slate-100 dark:bg-white/[0.05]'
                                : 'bg-slate-50 dark:bg-white/[0.02]'
                        }`}
                        title={`${day.label}${day.hit ? ' · meta batida' : day.active ? ' · não batida' : ' · fora da meta'}`}
                      />
                    ))}
                  </div>
                </div>
                <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>

              {expanded && (
                <div className="border-t border-slate-100 dark:border-white/[0.05] px-5 py-4 bg-slate-50/50 dark:bg-white/[0.01]">
                  {r.totalSlots === 0 ? (
                    <p className="text-[12.5px] text-slate-400">Nenhuma tarefa na meta de hoje.</p>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Pendentes ({pendingSlots.length})</div>
                        {pendingSlots.length === 0 ? (
                          <p className="text-[12.5px] text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1.5"><CheckCircle size={13} /> Tudo concluído.</p>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {pendingSlots.map(({ lead, slug, overdue }) => {
                              const waNum = String(lead.whatsapp || '').replace(/\D/g, '');
                              const isCritical = overdue >= slaOverdueDays;
                              return (
                                <div
                                  key={`${lead.id}-${slug}`}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-white/[0.03] border transition ${
                                    isCritical
                                      ? 'border-rose-300 dark:border-rose-500/40 hover:border-rose-400 dark:hover:border-rose-500/60'
                                      : 'border-slate-200/80 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/10'
                                  }`}
                                >
                                  <button type="button" onClick={() => onOpenLead?.(lead)} className="flex-1 min-w-0 text-left">
                                    <span className="block text-[12.5px] font-medium text-slate-800 dark:text-slate-100 truncate">{lead.name}</span>
                                  </button>
                                  {overdue > 0 && (
                                    <span className={`num text-[11px] font-semibold whitespace-nowrap ${isCritical ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                      há {overdue} {overdue === 1 ? 'dia' : 'dias'}
                                    </span>
                                  )}
                                  <PendingCatChip slug={slug} count={1} />
                                  {waNum && (
                                    <button
                                      type="button"
                                      title="Chamar no WhatsApp"
                                      onClick={() => window.open(`https://wa.me/${waNum}`, '_blank', 'noopener,noreferrer')}
                                      className="w-7 h-7 grid place-items-center rounded-md shrink-0 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition"
                                    >
                                      <WhatsappGlyph size={15} />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Concluídas ({doneSlotsList.length})</div>
                        {doneSlotsList.length === 0 ? (
                          <p className="text-[12.5px] text-slate-400">Nada concluído ainda.</p>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {doneSlotsList.map(({ lead, slug }) => (
                              <button
                                key={`${lead.id}-${slug}`}
                                type="button"
                                onClick={() => onOpenLead?.(lead)}
                                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/60 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04] hover:border-slate-300 dark:hover:border-white/10 transition text-left opacity-75"
                              >
                                <span className="text-[12.5px] font-medium text-slate-600 dark:text-slate-300 truncate inline-flex items-center gap-1.5">
                                  <CheckCircle size={13} className="text-emerald-500 shrink-0" /> {lead.name}
                                </span>
                                <span className="text-[11px] text-slate-400 whitespace-nowrap">{DG_CATEGORY_META[slug]?.short}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="py-14 grid place-items-center text-slate-400 rounded-2xl border border-border">
            <p className="text-[13px]">Nenhum usuário na equipe ainda.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export { DailyGoalTeamView };
