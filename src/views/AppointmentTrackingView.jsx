import { useState, useMemo } from 'react';
import { Ban, BookOpen, Building2, Calendar, Clock, Dumbbell, Phone, Search, TrendingUp } from 'lucide-react';
import { getAppointmentOutcomeMeta, getLeadAppointmentDate, getLeadAppointmentType, isAdminUser, isLeadConverted } from '../lib/leads.js';
import { LIST_PAGE_SIZE } from '../lib/leadStatus.js';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Btn } from '../components/ui/Btn.jsx';
import { StatPill } from '../components/ui/StatPill.jsx';
import { LeadDetailsModal } from '../modals/LeadDetailsModal.jsx';

// ==========================================
// APPOINTMENT TRACKING VIEW (AULAS EXPERIMENTAIS / VISITAS)
// ==========================================
// Tela SOMENTE LEITURA: lista os leads agendados para um tipo de
// compromisso ('aula_experimental' ou 'visita'), mostrando data marcada,
// comparecimento e finalização. NADA é criado aqui — o cadastro e o
// acompanhamento continuam pela Linha do Tempo (LeadDetailsModal) e pela
// Meta Diária. Clicar numa linha apenas abre o perfil do lead p/ consulta.
// Os dados já chegam escopados por consultor (regra do Firestore): admin
// vê todos, consultor vê só os seus.

// Estado de comparecimento derivado do appointmentOutcome persistido no lead
// (ou de conversão legada). Helpers puros, fora do componente.
function getApptAttendanceState(lead) {
  const outcome = lead.appointmentOutcome;
  const meta = outcome ? getAppointmentOutcomeMeta(outcome) : null;
  if (meta) return { key: outcome, label: meta.label, icon: meta.icon, badgeClass: meta.badgeClass };
  // Sem desfecho explícito: se converteu, obviamente compareceu (legado).
  if (isLeadConverted(lead)) {
    const a = getAppointmentOutcomeMeta('attended');
    return { key: 'attended', label: a.label, icon: a.icon, badgeClass: a.badgeClass };
  }
  const d = getLeadAppointmentDate(lead);
  if (d && d.getTime() < Date.now()) {
    return { key: 'pending', label: 'Aguardando desfecho', icon: '⏳', badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' };
  }
  return { key: 'scheduled', label: 'Agendado', icon: '📅', badgeClass: 'bg-brand-500/10 text-brand-700 dark:text-brand-300' };
}

function getApptFinalState(lead) {
  if (lead.status === 'Venda' || isLeadConverted(lead)) return { label: 'Matriculado', Icon: TrendingUp, tone: 'emerald' };
  if (lead.status === 'Perda') return { label: 'Perdido', Icon: Ban, tone: 'rose', reason: lead.lossReason };
  return { label: 'Em andamento', Icon: Clock, tone: 'slate' };
}

function isApptSameDay(d, ref = new Date()) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return false;
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

function AppointmentTrackingView({ leads, interactions, appUser, statuses, tags, lossReasons, db, funnels, usersList, appointmentType }) {
  const [selectedLead, setSelectedLead] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [consultantFilter, setConsultantFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | today | waiting | attended | finished
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);

  const isAdmin = isAdminUser(appUser);
  const isAula = appointmentType === 'aula_experimental';
  const typeLabelSingular = isAula ? 'aula experimental' : 'visita';
  const typeLabelPlural = isAula ? 'aulas experimentais' : 'visitas';
  const HeaderIcon = isAula ? BookOpen : Building2;

  // 1) Leads do tipo de compromisso (com data marcada).
  const typeLeads = useMemo(
    () => (leads || []).filter(l => getLeadAppointmentType(l) === appointmentType && getLeadAppointmentDate(l)),
    [leads, appointmentType]
  );

  // 2) Escopo por consultor (admin) — "de quem são os agendamentos".
  //    Aplica ANTES dos contadores, pra que StatPills e chips reflitam o
  //    consultor selecionado. Sem isso, o chip dizia "Hoje 12" e o clique
  //    entregava 3 (o filtro só agia na lista, não no badge). A busca textual
  //    é uma lupa à parte: mexe só na lista, não nos contadores — mesmo
  //    padrão do LeadsView.
  const scopedLeads = useMemo(
    () => (consultantFilter ? typeLeads.filter(l => l.consultantId === consultantFilter) : typeLeads),
    [typeLeads, consultantFilter]
  );

  // 3) Contadores para stats + chips (sobre o escopo de consultor).
  const counts = useMemo(() => {
    let attended = 0, waiting = 0, finished = 0, today = 0, matriculados = 0;
    scopedLeads.forEach(l => {
      const a = getApptAttendanceState(l);
      if (a.key === 'attended') attended++;
      if (a.key === 'scheduled' || a.key === 'pending') waiting++;
      if (l.status === 'Venda' || l.status === 'Perda') finished++;
      if (l.status === 'Venda' || isLeadConverted(l)) matriculados++;
      if (isApptSameDay(getLeadAppointmentDate(l))) today++;
    });
    return { total: scopedLeads.length, attended, waiting, finished, today, matriculados };
  }, [scopedLeads]);

  // 4) Busca (nome ou telefone) + filtro de status + ordenação (futuros mais
  //    próximos no topo; depois passados mais recentes). O telefone casa tanto
  //    pelo texto cru quanto pelos dígitos normalizados, então "(51) 99999-8888"
  //    e "5199999" acham o mesmo lead (mesmo padrão canônico do LeadsView).
  const filtered = useMemo(() => {
    let list = scopedLeads;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const digits = searchTerm.replace(/\D/g, '');
      list = list.filter(l =>
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.whatsapp && l.whatsapp.includes(searchTerm)) ||
        (digits && String(l.whatsapp || '').replace(/\D/g, '').includes(digits))
      );
    }
    if (statusFilter === 'today') list = list.filter(l => isApptSameDay(getLeadAppointmentDate(l)));
    else if (statusFilter === 'waiting') list = list.filter(l => { const k = getApptAttendanceState(l).key; return k === 'scheduled' || k === 'pending'; });
    else if (statusFilter === 'attended') list = list.filter(l => getApptAttendanceState(l).key === 'attended');
    else if (statusFilter === 'finished') list = list.filter(l => l.status === 'Venda' || l.status === 'Perda');

    const now = Date.now();
    return [...list].sort((a, b) => {
      const da = getLeadAppointmentDate(a)?.getTime() ?? 0;
      const db2 = getLeadAppointmentDate(b)?.getTime() ?? 0;
      const aF = da >= now, bF = db2 >= now;
      if (aF !== bF) return aF ? -1 : 1;
      return aF ? (da - db2) : (db2 - da);
    });
  }, [scopedLeads, searchTerm, statusFilter]);

  // Paginação "carregar mais": renderiza só os primeiros visibleCount.
  // (Sem reset em efeito; ao filtrar, o slice já opera sobre um conjunto menor.)
  const visibleRows = filtered.slice(0, visibleCount);

  const chips = [
    { id: 'all', label: 'Todos', count: counts.total },
    { id: 'today', label: 'Hoje', count: counts.today },
    { id: 'waiting', label: 'Aguardando', count: counts.waiting },
    { id: 'attended', label: 'Compareceram', count: counts.attended },
    { id: 'finished', label: 'Finalizados', count: counts.finished },
  ];

  const finToneClass = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    slate: 'bg-slate-100 text-slate-600 dark:bg-white/[0.05] dark:text-slate-300',
  };

  return (
    <>
      <div className="animate-fade-in space-y-5">
        {/* Header + stats */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl grid place-items-center bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300 shrink-0">
              <HeaderIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">{typeLabelPlural}</h3>
              <p className="text-xs font-medium text-gray-500 dark:text-neutral-400 mt-0.5">
                Controle de {typeLabelPlural} agendadas (somente leitura)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatPill label="Total" value={counts.total} />
            <StatPill label="Compareceram" value={counts.attended} accent="emerald" />
            <StatPill label="Aguardando" value={counts.waiting} accent="amber" />
            <StatPill label="Matriculados" value={counts.matriculados} accent="brand" />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-600 transition pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] pl-9 pr-3 placeholder:text-slate-400 transition"
            />
          </div>
          {isAdmin && (
            <select
              value={consultantFilter}
              onChange={(e) => setConsultantFilter(e.target.value)}
              className="h-10 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] outline-none text-[13px] pl-3 pr-8 text-slate-700 dark:text-slate-200 cursor-pointer font-medium"
            >
              <option value="">Todos os consultores</option>
              {(usersList || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <div className="flex-1" />
          <div className="text-[11.5px] text-slate-500 dark:text-slate-400 whitespace-nowrap num">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{filtered.length}</span> de {counts.total}
          </div>
        </div>

        {/* Filtros (chips) */}
        <div className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07]">
          {chips.map(c => {
            const active = statusFilter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setStatusFilter(c.id)}
                className={`h-8 px-3 rounded-md text-[12px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition ${active ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
              >
                {c.label}
                <span className={`num text-[10.5px] px-1 h-[15px] rounded grid place-items-center min-w-[15px] ${active ? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900' : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'}`}>{c.count}</span>
              </button>
            );
          })}
        </div>

        {/* Tabela */}
        <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="bg-card border-b border-slate-100 dark:border-white/[0.05]">
                <tr className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <th className="py-3 pl-5 pr-3">Aluno</th>
                  <th className="py-3 px-3">Data marcada</th>
                  {isAula && <th className="py-3 px-3">Modalidade</th>}
                  <th className="py-3 px-3 text-center">Compareceu</th>
                  <th className="py-3 pr-5 pl-3 text-center">Finalizou</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(l => {
                  const d = getLeadAppointmentDate(l);
                  const att = getApptAttendanceState(l);
                  const fin = getApptFinalState(l);
                  const FinIcon = fin.Icon;
                  const isPast = att.key === 'pending';
                  return (
                    <tr
                      key={l.id}
                      onClick={() => setSelectedLead(l)}
                      className="border-t border-slate-100 dark:border-white/[0.05] hover:bg-slate-50/60 dark:hover:bg-white/[0.02] cursor-pointer transition"
                    >
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={l.name} size={32} />
                          <div className="min-w-0">
                            <div className="text-[13.5px] font-semibold tracking-tight text-slate-900 dark:text-white truncate">{l.name}</div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400 num flex-wrap">
                              <span className="inline-flex items-center gap-1"><Phone size={11} /> {l.whatsapp}</span>
                              {isAdmin && l.consultantName && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-white/20" />
                                  <span className="text-[11px] text-brand-600 dark:text-brand-300">@{l.consultantName}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        {d ? (
                          <div className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium num whitespace-nowrap ${isPast ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'}`}>
                            <Calendar size={13} />
                            <span>{d.toLocaleDateString('pt-BR')} às {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        ) : (
                          <span className="text-[11.5px] text-slate-400 italic">—</span>
                        )}
                      </td>
                      {isAula && (
                        <td className="py-3.5 px-3">
                          {l.appointmentModality ? (
                            <div className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-700 dark:text-slate-200">
                              <Dumbbell size={12} className="text-brand-600 dark:text-brand-300 shrink-0" />
                              <span className="truncate max-w-[140px]">{l.appointmentModality}</span>
                              {Number(l.trialClassesPlanned) > 0 && (
                                <span className="num text-[10.5px] font-semibold px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300 whitespace-nowrap">{l.trialClassesPlanned}x</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11.5px] text-slate-400 italic">—</span>
                          )}
                        </td>
                      )}
                      <td className="py-3.5 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${att.badgeClass}`}>
                          <span aria-hidden="true">{att.icon}</span> {att.label}
                        </span>
                      </td>
                      <td className="py-3.5 pr-5 pl-3 text-center">
                        <span title={fin.reason || ''} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${finToneClass[fin.tone]}`}>
                          <FinIcon size={12} /> {fin.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={isAula ? 5 : 4} className="py-16 text-center text-slate-400">
                      <div className="grid place-items-center gap-2">
                        <HeaderIcon size={22} className="opacity-40" />
                        <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Nenhuma {typeLabelSingular} por aqui</p>
                        <p className="text-[12.5px]">As {typeLabelPlural} agendadas pela Linha do Tempo e Meta Diária aparecem aqui.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {filtered.length > visibleCount && (
          <div className="flex justify-center pt-1">
            <Btn kind="soft" onClick={() => setVisibleCount(c => c + LIST_PAGE_SIZE)}>
              Carregar mais ({visibleRows.length} de {filtered.length})
            </Btn>
          </div>
        )}
      </div>

      {selectedLead && (
        <LeadDetailsModal
          lead={selectedLead}
          interactions={(interactions || []).filter(i => i.leadId === selectedLead.id).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))}
          onClose={() => setSelectedLead(null)}
          appUser={appUser}
          statuses={statuses}
          tags={tags}
          lossReasons={lossReasons}
          db={db}
          funnels={funnels}
        />
      )}
    </>
  );
}
export { AppointmentTrackingView };
