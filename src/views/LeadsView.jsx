import { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { AlertCircle, Check, Clock, Download, Filter, Phone, Plus, Search, Tag, Users, X } from 'lucide-react';
import { isAdminUser } from '../lib/leads.js';
import { LIST_PAGE_SIZE, buildInteractionIndex, isHotLeadFromDate } from '../lib/leadStatus.js';
import { getDefaultFunnel, isItemInFunnel } from '../lib/funnels.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Btn } from '../components/ui/Btn.jsx';
import { FunnelSelector } from '../components/ui/FunnelSelector.jsx';
import { StatPill } from '../components/ui/StatPill.jsx';
import { StatusBadge, LeadTemperatureBadge, DaysSinceContactBadge, FollowUpIcon } from '../components/ui/Badges.jsx';
import { LeadDetailsModal } from '../modals/LeadDetailsModal.jsx';

function ActiveFilterChip({ label, onRemove, accent = 'slate' }) {
  const tones = {
    brand:   'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
    amber:   'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    rose:    'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    slate:   'bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-slate-200'
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 h-7 rounded-md text-[11.5px] font-medium ${tones[accent] || tones.slate}`}>
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="opacity-60 hover:opacity-100 transition"
        title="Remover filtro"
      >
        <X size={11} />
      </button>
    </span>
  );
}

function LeadsView({ leads, interactions, appUser, sources, statuses, usersList, tags, lossReasons, db, funnels, selectedFunnelId, setSelectedFunnelId, onAddLeadClick }) {
  const toast = useToast();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [statusFilters, setStatusFilters] = useState([]);
  const [consultantFilters, setConsultantFilters] = useState([]);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [hotOnly, setHotOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);
  // O AddLeadModal mora no App-level. O botão local apenas dispara o
  // callback `onAddLeadClick` recebido por prop.

  const defaultFunnelId = useMemo(() => getDefaultFunnel(funnels)?.id || null, [funnels]);
  const hasFunnels = (funnels || []).length > 0;

  // Quando o funil ativo muda, limpamos filtros de status para evitar listar etapas inexistentes
  useEffect(() => {
    setStatusFilters([]);
  }, [selectedFunnelId]);

  // Índice leadId -> última interação, construído uma vez (O(interações)).
  // Alimenta o filtro "Apenas Hot" e os badges da tabela sem recomputar
  // interactions.filter() por linha (era O(leads × interações) a cada tecla).
  const interactionIndex = useMemo(() => buildInteractionIndex(interactions), [interactions]);

  // Busca deferida: o input atualiza na hora (searchTerm), mas a filtragem
  // pesada da base roda sobre o valor deferido — o React mantém a digitação
  // fluida e refiltra quando sobra tempo, sem debounce manual/timeout.
  const deferredSearch = useDeferredValue(searchTerm);

  const filteredLeads = useMemo(() => {
    const lowerSearch = deferredSearch.toLowerCase();
    const searchDigits = deferredSearch.replace(/\D/g, '');
    return (leads || []).filter(l => {
      const matchFunnel = isItemInFunnel(l, selectedFunnelId, defaultFunnelId);
      const matchSearch =
        (l.name || '').toLowerCase().includes(lowerSearch) ||
        (l.whatsapp || '').includes(deferredSearch) ||
        (searchDigits && String(l.whatsapp || '').replace(/\D/g, '').includes(searchDigits));
      const matchStatus = statusFilters.length === 0 || statusFilters.includes(l.status);
      const matchConsultant = consultantFilters.length === 0 || consultantFilters.includes(l.consultantId);
      const isOverdue = l.status !== 'Venda' && l.status !== 'Perda' && l.nextFollowUp && l.nextFollowUp < new Date();
      const matchOverdue = !overdueOnly || isOverdue;
      const matchHot = !hotOnly || isHotLeadFromDate(l, interactionIndex.get(l.id)?.lastDate);
      return matchFunnel && matchSearch && matchStatus && matchOverdue && matchConsultant && matchHot;
    }).sort((a,b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0));
  }, [leads, interactionIndex, deferredSearch, statusFilters, overdueOnly, hotOnly, consultantFilters, selectedFunnelId, defaultFunnelId]);

  // Paginação "carregar mais": renderiza só os primeiros visibleCount leads.
  // O usuário expande sob demanda; ao estreitar a busca/filtros a lista
  // encolhe sozinha (slice de um conjunto menor), mantendo o DOM leve sem
  // precisar resetar estado num efeito.
  const visibleLeads = filteredLeads.slice(0, visibleCount);

  const toggleStatus = (s) => setStatusFilters(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleConsultant = (id) => setConsultantFilters(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const statusesForFunnel = (statuses || []).filter(s => isItemInFunnel(s, selectedFunnelId, defaultFunnelId));
  const allStatuses = [...statusesForFunnel.map(s=>s.name), 'Venda', 'Perda'];

  // EXPORTAÇÃO CSV
  const exportToCSV = () => {
    if (!filteredLeads || filteredLeads.length === 0) {
      toast.warning("Não há leads para exportar com os filtros atuais.");
      return;
    }
    
    // Sanitiza cada célula: escapa aspas (em TODOS os campos) e neutraliza
    // fórmulas (CSV injection) — um valor começando com = + - @ tab/CR seria
    // executado pelo Excel/Sheets ao abrir o arquivo. Tudo entre aspas.
    const csvCell = (value) => {
      let s = String(value ?? '');
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };
    // Separador ';' — o Excel em pt-BR usa ponto-e-vírgula como separador de
    // lista; com vírgula o arquivo abriria tudo numa coluna só.
    const SEP = ';';
    const headers = ["Nome", "WhatsApp", "Origem", "Fase do Funil", "Consultor", "Data Cadastro", "Observação", "Motivo Perda"];
    const csvRows = filteredLeads.map(l => [
      l.name, l.whatsapp, l.source, l.status, l.consultantName,
      l.createdAt ? l.createdAt.toLocaleDateString('pt-BR') : '',
      l.observation, l.lossReason
    ].map(csvCell).join(SEP));

    const csvContent = [headers.map(csvCell).join(SEP), ...csvRows].join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // \uFEFF força o Excel a ler UTF-8
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `leads_stronix_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Counts for hero stat pills.
  const baseLeads = (leads || []).filter(l => isItemInFunnel(l, selectedFunnelId, defaultFunnelId));
  const totalLeads = baseLeads.length;
  const ativos = baseLeads.filter(l => l.status !== 'Venda' && l.status !== 'Perda').length;
  const overdueCount = baseLeads.filter(l => l.status !== 'Venda' && l.status !== 'Perda' && l.nextFollowUp && l.nextFollowUp < new Date()).length;
  const vendas = baseLeads.filter(l => l.status === 'Venda').length;

  const filterCount = statusFilters.length + consultantFilters.length + (overdueOnly ? 1 : 0) + (hotOnly ? 1 : 0);
  const clearAllFilters = () => { setStatusFilters([]); setConsultantFilters([]); setOverdueOnly(false); setHotOnly(false); };

  return (
    <div className="h-full flex flex-col space-y-4 animate-fade-in relative font-sans">
      {/* Page hero */}
      <section className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
            <Users size={13} className="text-brand-600" /> Base de leads
          </div>
          <h2 className="mt-1.5 font-display text-[24px] font-semibold tracking-tight leading-tight">
            Todos os leads
          </h2>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
            Pesquise, filtre e gerencie toda a sua base em um só lugar.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatPill label="Total" value={totalLeads} accent="brand" />
          <StatPill label="Ativos" value={ativos} accent="amber" />
          <StatPill label="Em atraso" value={overdueCount} accent="rose" />
          <StatPill label="Vendas" value={vendas} accent="emerald" />
        </div>
      </section>

      {/* Toolbar */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-card p-3 flex flex-col md:flex-row gap-2 items-stretch md:items-center">
        {hasFunnels && (
          <FunnelSelector
            funnels={funnels}
            value={selectedFunnelId}
            onChange={setSelectedFunnelId}
            variant="soft"
            className="w-full md:w-[220px]"
          />
        )}
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-600 transition pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] pl-9 pr-3 placeholder:text-slate-400 transition"
          />
        </div>
        <div className="flex items-center gap-2">
          <Btn kind="secondary" icon={<Download size={13} />} onClick={exportToCSV}>Exportar</Btn>
          <Btn
            kind={filterCount > 0 ? 'primary' : 'soft'}
            icon={<Filter size={13} />}
            onClick={() => setIsFilterOpen(true)}
          >
            Filtros{filterCount > 0 ? ` (${filterCount})` : ''}
          </Btn>
          <Btn kind="brand" icon={<Plus size={13} />} onClick={() => onAddLeadClick && onAddLeadClick()}>Novo lead</Btn>
        </div>
      </div>

      {/* Active filter chips */}
      {filterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1">Filtros ativos</span>
          {hotOnly && <ActiveFilterChip label="🔥 Hot leads" onRemove={() => setHotOnly(false)} accent="amber" />}
          {overdueOnly && <ActiveFilterChip label="Em atraso" onRemove={() => setOverdueOnly(false)} accent="rose" />}
          {statusFilters.map(s => (
            <ActiveFilterChip key={s} label={s} onRemove={() => toggleStatus(s)} accent="brand" />
          ))}
          {consultantFilters.map(id => {
            const u = (usersList || []).find(x => x.id === id);
            return (
              <ActiveFilterChip key={id} label={u?.name || id} onRemove={() => toggleConsultant(id)} />
            );
          })}
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-[11.5px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white ml-1 whitespace-nowrap"
          >
            Limpar tudo
          </button>
        </div>
      )}

      {/* Results count */}
      <div className="text-[12.5px] text-slate-500 dark:text-slate-400">
        Exibindo <span className="num font-semibold text-slate-700 dark:text-slate-200">{visibleLeads.length}</span> de <span className="num">{filteredLeads.length}</span> leads
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-card overflow-hidden flex-1">
        <div className="overflow-x-auto h-full thin-scroll">
          <table className="w-full text-left min-w-[950px]">
            <thead className="sticky top-0 bg-white dark:bg-white/[0.02] z-10 border-b border-slate-100 dark:border-white/[0.05]">
              <tr className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <th className="py-3 pl-5 pr-3">Informações do aluno</th>
                <th className="py-3 px-3 text-center">Status no funil</th>
                <th className="py-3 px-3">Ação agendada</th>
                <th className="py-3 pr-5 pl-3 text-right">Data de cadastro</th>
              </tr>
            </thead>
            <tbody>
              {visibleLeads.map(l => {
                const isOverdue = l.status !== 'Venda' && l.status !== 'Perda' && l.nextFollowUp && l.nextFollowUp < new Date();
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
                          <div className={`text-[13.5px] font-semibold tracking-tight ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>{l.name}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400 num flex-wrap">
                            <span className="inline-flex items-center gap-1"><Phone size={11} /> {l.whatsapp}</span>
                            {l.consultantName && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-white/20"></span>
                                <span className="text-[11px] text-brand-600 dark:text-brand-300">@{l.consultantName}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                        <StatusBadge statusName={l.status} statusesArray={statuses} />
                        <LeadTemperatureBadge lead={l} lastInteractionDate={interactionIndex.get(l.id)?.lastDate} compact />
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      {l.nextFollowUp ? (
                        <div className={`inline-flex items-center gap-1.5 text-[12px] font-medium num whitespace-nowrap ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {isOverdue ? <AlertCircle size={13} /> : <FollowUpIcon type={l.nextFollowUpType} className="w-3.5 h-3.5" />}
                          <span>
                            {l.nextFollowUp.toLocaleDateString('pt-BR')} às {l.nextFollowUp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="text-[11.5px] text-slate-400 dark:text-slate-500 italic">Sem agendamento</span>
                          <DaysSinceContactBadge lead={l} lastInteractionDate={interactionIndex.get(l.id)?.lastDate} />
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 pr-5 pl-3 text-right num text-[12px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {l.createdAt?.toLocaleDateString('pt-BR') || ''}
                    </td>
                  </tr>
                );
              })}
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-16 text-center text-slate-400">
                    <div className="grid place-items-center gap-2">
                      <Search size={22} className="opacity-40" />
                      <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Nenhum lead encontrado</p>
                      <p className="text-[12.5px]">Ajuste a busca ou limpe os filtros.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredLeads.length > visibleCount && (
        <div className="flex justify-center">
          <Btn kind="soft" onClick={() => setVisibleCount(c => c + LIST_PAGE_SIZE)}>
            Carregar mais ({visibleLeads.length} de {filteredLeads.length})
          </Btn>
        </div>
      )}

      {isFilterOpen && (
        <div className="fixed inset-0 z-[120] overflow-hidden flex justify-end animate-fade-in">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={()=>setIsFilterOpen(false)} />
          <div className="relative w-full max-w-sm bg-paper-50 dark:bg-neutral-950 shadow-[0_0_50px_rgba(0,0,0,0.5)] border-l border-gray-200 dark:border-neutral-800 p-8 flex flex-col h-full animate-slide-in-right">
            
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-wider">Filtros</h3>
                <p className="text-xs font-medium text-gray-500 dark:text-neutral-400 mt-1">Otimize sua visão</p>
              </div>
              <button onClick={()=>setIsFilterOpen(false)} className="p-2 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white dark:text-white bg-white dark:bg-neutral-900 rounded-xl transition-all shadow-xl active:scale-90"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 space-y-8 overflow-y-auto pr-2 custom-scrollbar">
              <section>
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-brand-600 mb-4 flex items-center gap-2"><Clock className="w-3 h-3" /> Situação Operacional</p>
                <div className="grid grid-cols-1 gap-2">
                  <button onClick={()=>setHotOnly(!hotOnly)} className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${hotOnly ? 'bg-accent-500/10 border-accent-500/50 text-accent-500' : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800'}`}>
                    <span className="font-bold text-xs uppercase tracking-widest flex items-center gap-2">🔥 Apenas Hot Leads</span>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 ${hotOnly ? 'bg-accent-500 border-accent-500 text-white' : 'border-gray-300 dark:border-neutral-700'}`}>{hotOnly && <Check className="w-3 h-3 font-bold" />}</div>
                  </button>
                  <button onClick={()=>setOverdueOnly(!overdueOnly)} className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${overdueOnly ? 'bg-red-500/10 border-red-500/50 text-red-400' : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800'}`}>
                    <span className="font-bold text-xs uppercase tracking-widest">Em Atraso</span>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 ${overdueOnly ? 'bg-red-500 border-red-500 text-white' : 'border-gray-300 dark:border-neutral-700'}`}>{overdueOnly && <Check className="w-3 h-3 font-bold" />}</div>
                  </button>
                </div>
              </section>

              {isAdminUser(appUser) && (
                <section>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-brand-600 mb-4 flex items-center gap-2"><Users className="w-3 h-3" /> Consultores</p>
                  <div className="grid grid-cols-1 gap-2">
                    {(usersList || []).map(u => (
                      <button key={u.id} onClick={()=>toggleConsultant(u.id)} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${consultantFilters.includes(u.id) ? 'bg-brand-500/10 border-brand-500/50 text-brand-400' : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800'}`}>
                        <span className="text-xs font-semibold">{u.name}</span>
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 ${consultantFilters.includes(u.id) ? 'bg-brand-500 border-brand-500 text-white' : 'border-gray-300 dark:border-neutral-700'}`}>{consultantFilters.includes(u.id) && <Check className="w-3 h-3" />}</div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-brand-600 mb-4 flex items-center gap-2"><Tag className="w-3 h-3" /> Fase do Funil</p>
                <div className="grid grid-cols-1 gap-2">
                  {allStatuses.map(s => (
                    <button key={s} onClick={()=>toggleStatus(s)} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${statusFilters.includes(s) ? 'bg-brand-600/10 border-brand-600/50 text-brand-500' : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800'}`}>
                      <span className="text-xs font-semibold">{s}</span>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 ${statusFilters.includes(s) ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-300 dark:border-neutral-700'}`}>{statusFilters.includes(s) && <Check className="w-3 h-3" />}</div>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <div className="pt-6 mt-4 border-t border-gray-200 dark:border-neutral-800 grid grid-cols-2 gap-3">
              <button onClick={()=>{setStatusFilters([]); setOverdueOnly(false); setHotOnly(false); setConsultantFilters([]);}} className="py-3 rounded-xl text-gray-400 dark:text-neutral-500 font-bold hover:bg-white dark:bg-neutral-900 transition-all text-[10px] uppercase tracking-[0.2em]">Limpar</button>
              <button onClick={()=>setIsFilterOpen(false)} className="py-3 rounded-xl bg-brand-600 text-gray-900 dark:text-white font-bold shadow-xl text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all">Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {selectedLead && <LeadDetailsModal lead={selectedLead} interactions={interactions.filter(i => i.leadId === selectedLead.id).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0))} onClose={() => setSelectedLead(null)} appUser={appUser} statuses={statuses} tags={tags} lossReasons={lossReasons} db={db} funnels={funnels} />}
    </div>
  );
}
export { LeadsView };
