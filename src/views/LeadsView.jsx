import { useState, useEffect, useMemo, useRef } from 'react';
import { AlertCircle, Calendar, Check, Download, Phone, SlidersHorizontal, Users, X } from 'lucide-react';
import { isAdminUser } from '../lib/leads.js';
import { LIST_PAGE_SIZE, buildInteractionIndex, isHotLeadFromDate } from '../lib/leadStatus.js';
import { getDefaultFunnel, isItemInFunnel } from '../lib/funnels.js';
import { getKanbanColumnAccent } from '../lib/kanban.js';
import { cn } from '@/lib/utils';
import { useToast } from '../contexts/ToastContext.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Btn } from '../components/ui/Btn.jsx';
import { StatusBadge } from '../components/ui/Badges.jsx';
import { FunnelTabs } from '../components/layout/FunnelTabs.jsx';
import { useLeadProfile } from '../contexts/LeadProfileContext.jsx';

// Cor da etapa (para chip de fase e dot). Venda/Perda mapeiam para os mesmos
// tokens usados no Kanban; as demais vêm da cor configurada da etapa.
const statusColorOf = (name, statuses) =>
  name === 'Venda' ? 'green'
    : name === 'Perda' ? 'gray'
      : (statuses || []).find(s => s.name === name)?.color || 'gray';

function LeadsView({ leads, interactions, appUser, statuses, usersList, funnels, selectedFunnelId, setSelectedFunnelId }) {
  const toast = useToast();
  const { openProfile } = useLeadProfile();
  const isAdmin = isAdminUser(appUser);

  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilters, setStatusFilters] = useState([]);
  const [consultantFilters, setConsultantFilters] = useState([]);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [hotOnly, setHotOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);

  const defaultFunnelId = useMemo(() => getDefaultFunnel(funnels)?.id || null, [funnels]);

  // Ao trocar de funil, limpa o filtro de fase (as etapas mudam).
  useEffect(() => {
    setStatusFilters([]);
  }, [selectedFunnelId]);

  // Bubble de filtros fecha em clique fora / Esc (mesmo padrão das outras telas).
  const filterWrapRef = useRef(null);
  useEffect(() => {
    if (!filterOpen) return;
    const onPointerDown = (e) => { if (!filterWrapRef.current?.contains(e.target)) setFilterOpen(false); };
    const onKeyDown = (e) => { if (e.key === 'Escape') setFilterOpen(false); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [filterOpen]);

  // Índice leadId → última interação (O(interações)); alimenta o filtro "hot"
  // e o 🔥 da tabela sem recomputar interactions.filter() por linha.
  const interactionIndex = useMemo(() => buildInteractionIndex(interactions), [interactions]);

  // Filtragem 100% pela bubble (sem busca textual — removida no redesign 6a).
  const filteredLeads = useMemo(() => {
    return (leads || []).filter(l => {
      const matchFunnel = isItemInFunnel(l, selectedFunnelId, defaultFunnelId);
      const matchStatus = statusFilters.length === 0 || statusFilters.includes(l.status);
      const matchConsultant = consultantFilters.length === 0 || consultantFilters.includes(l.consultantId);
      const isOverdue = l.status !== 'Venda' && l.status !== 'Perda' && l.nextFollowUp && l.nextFollowUp < new Date();
      const matchOverdue = !overdueOnly || isOverdue;
      const matchHot = !hotOnly || isHotLeadFromDate(l, interactionIndex.get(l.id)?.lastDate);
      return matchFunnel && matchStatus && matchOverdue && matchConsultant && matchHot;
    }).sort((a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0));
  }, [leads, interactionIndex, statusFilters, overdueOnly, hotOnly, consultantFilters, selectedFunnelId, defaultFunnelId]);

  const visibleLeads = filteredLeads.slice(0, visibleCount);

  // Contagem por funil (pill das abas).
  const funnelCounts = useMemo(() => {
    const map = new Map();
    (funnels || []).forEach(f => map.set(f.id, (leads || []).filter(l => isItemInFunnel(l, f.id, defaultFunnelId)).length));
    return map;
  }, [funnels, leads, defaultFunnelId]);

  const baseLeads = useMemo(
    () => (leads || []).filter(l => isItemInFunnel(l, selectedFunnelId, defaultFunnelId)),
    [leads, selectedFunnelId, defaultFunnelId]
  );

  const toggleStatus = (s) => setStatusFilters(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleConsultant = (id) => setConsultantFilters(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const statusesForFunnel = (statuses || []).filter(s => isItemInFunnel(s, selectedFunnelId, defaultFunnelId));
  const phaseOptions = [...statusesForFunnel.map(s => s.name), 'Venda', 'Perda'];

  const filterCount = statusFilters.length + consultantFilters.length + (overdueOnly ? 1 : 0) + (hotOnly ? 1 : 0);
  const hasActiveFilters = filterCount > 0;
  const clearAllFilters = () => { setStatusFilters([]); setConsultantFilters([]); setOverdueOnly(false); setHotOnly(false); };

  // EXPORTAÇÃO CSV — respeita os filtros aplicados.
  const exportToCSV = () => {
    if (!filteredLeads || filteredLeads.length === 0) {
      toast.warning('Não há leads para exportar com os filtros atuais.');
      return;
    }
    // Sanitiza cada célula: escapa aspas e neutraliza fórmulas (CSV injection) —
    // um valor começando com = + - @ tab/CR seria executado pelo Excel/Sheets.
    const csvCell = (value) => {
      let s = String(value ?? '');
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };
    // Separador ';' — o Excel pt-BR usa ponto-e-vírgula como separador de lista.
    const SEP = ';';
    const headers = ['Nome', 'WhatsApp', 'Origem', 'Fase do Funil', 'Consultor', 'Data Cadastro', 'Observação', 'Motivo Perda'];
    const csvRows = filteredLeads.map(l => [
      l.name, l.whatsapp, l.source, l.status, l.consultantName,
      l.createdAt ? l.createdAt.toLocaleDateString('pt-BR') : '',
      l.observation, l.lossReason
    ].map(csvCell).join(SEP));

    const csvContent = [headers.map(csvCell).join(SEP), ...csvRows].join('\r\n');
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM força o Excel a ler UTF-8
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `leads_stronix_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Chips de filtros ativos (removem individualmente).
  const activeChips = [];
  if (hotOnly) activeChips.push({ key: 'hot', label: '🔥 Hot leads', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', remove: () => setHotOnly(false) });
  if (overdueOnly) activeChips.push({ key: 'overdue', label: 'Em atraso', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', remove: () => setOverdueOnly(false) });
  statusFilters.forEach(s => activeChips.push({ key: `st:${s}`, label: s, cls: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300', remove: () => toggleStatus(s) }));
  consultantFilters.forEach(id => {
    const u = (usersList || []).find(x => x.id === id);
    activeChips.push({ key: `co:${id}`, label: u?.name || id, cls: 'bg-slate-100 text-gray-700 dark:bg-white/[0.06] dark:text-neutral-200', remove: () => toggleConsultant(id) });
  });

  return (
    <div className="-m-4 md:-m-8 h-[calc(100vh-4rem)] flex flex-col animate-fade-in">
      {/* Header da página: abas de funil + resumo + exportar + filtro */}
      <div className="h-16 shrink-0 relative z-20 bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 flex items-center gap-3 md:gap-5 px-4 md:px-7">
        <FunnelTabs funnels={funnels} counts={funnelCounts} selectedId={selectedFunnelId} onSelect={setSelectedFunnelId} />

        <div className="hidden md:block text-[11.5px] text-slate-500 dark:text-neutral-400 whitespace-nowrap tabular-nums shrink-0">
          <span className="font-semibold text-gray-700 dark:text-neutral-200">{filteredLeads.length}</span> de {baseLeads.length} leads
        </div>

        <button
          type="button"
          onClick={exportToCSV}
          title="Exportar CSV"
          aria-label="Exportar CSV"
          className="size-[38px] rounded-[11px] border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 grid place-items-center shrink-0 transition-colors hover:border-brand-200 hover:text-brand-700 dark:hover:border-brand-500/40 dark:hover:text-brand-300"
        >
          <Download className="size-4" />
        </button>

        <div ref={filterWrapRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setFilterOpen(o => !o)}
            title="Filtros"
            aria-haspopup="dialog"
            aria-expanded={filterOpen}
            className={cn(
              'relative size-[38px] rounded-[11px] border grid place-items-center transition-colors',
              hasActiveFilters
                ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-500/15 dark:border-brand-500/30 dark:text-brand-300'
                : 'bg-paper-50 border-slate-200 text-gray-600 hover:border-brand-200 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-brand-500/40'
            )}
          >
            <SlidersHorizontal className="size-[17px]" />
            {hasActiveFilters && (
              <span className="absolute -top-[5px] -right-[5px] min-w-4 h-4 px-1 rounded-full bg-accent-500 text-white text-[9.5px] font-bold grid place-items-center ring-2 ring-white dark:ring-neutral-900 tabular-nums">
                {filterCount}
              </span>
            )}
          </button>

          {filterOpen && (
            <div className="absolute right-0 top-[46px] w-[280px] rounded-[14px] bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-700 shadow-[0_16px_40px_-8px_rgba(14,26,64,.22)] overflow-hidden z-30">
              <div className="px-3.5 pt-3 pb-2.5 flex items-center justify-between border-b border-slate-100 dark:border-white/10">
                <span className="text-[12.5px] font-bold text-gray-900 dark:text-white">Filtros</span>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-[11.5px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
                >
                  Limpar
                </button>
              </div>

              <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
                {/* Situação */}
                <div className="pt-2.5 px-2 pb-1">
                  <div className="px-1.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[.07em] text-gray-400 dark:text-neutral-500">Situação</div>
                  <button
                    type="button"
                    onClick={() => setHotOnly(v => !v)}
                    className={cn('w-full flex items-center gap-[9px] px-2 py-[7px] rounded-[9px] text-left transition-colors', hotOnly ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-paper-50 dark:hover:bg-white/5')}
                  >
                    <span className="size-6 rounded-full grid place-items-center bg-accent-50 dark:bg-accent-500/15 text-[12px] shrink-0">🔥</span>
                    <span className={cn('flex-1 text-[12.5px] text-gray-900 dark:text-white', hotOnly ? 'font-bold' : 'font-medium')}>Apenas hot leads</span>
                    {hotOnly && <Check className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" strokeWidth={2.6} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverdueOnly(v => !v)}
                    className={cn('w-full flex items-center gap-[9px] px-2 py-[7px] rounded-[9px] text-left transition-colors', overdueOnly ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-paper-50 dark:hover:bg-white/5')}
                  >
                    <span className="size-6 rounded-full grid place-items-center bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 shrink-0"><AlertCircle className="size-[13px]" /></span>
                    <span className={cn('flex-1 text-[12.5px] text-gray-900 dark:text-white', overdueOnly ? 'font-bold' : 'font-medium')}>Somente em atraso</span>
                    {overdueOnly && <Check className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" strokeWidth={2.6} />}
                  </button>
                </div>

                <div className="mx-3.5 my-1.5 border-t border-slate-100 dark:border-white/10" />

                {/* Fase do funil */}
                <div className="px-2 pb-1">
                  <div className="px-1.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[.07em] text-gray-400 dark:text-neutral-500">Fase do funil</div>
                  <div className="flex flex-wrap gap-[5px] px-1.5 pb-2">
                    {phaseOptions.map(s => {
                      const selected = statusFilters.includes(s);
                      const hex = getKanbanColumnAccent(statusColorOf(s, statuses)).border;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleStatus(s)}
                          style={selected ? { backgroundColor: `${hex}22`, color: hex, borderColor: 'transparent' } : undefined}
                          className={cn(
                            'h-[26px] px-2.5 rounded-full border text-[11.5px] font-semibold whitespace-nowrap transition-colors',
                            !selected && 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700 text-slate-500 dark:text-neutral-400 hover:border-brand-200'
                          )}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Responsável (admin) */}
                {isAdmin && (usersList || []).length > 0 && (
                  <>
                    <div className="mx-3.5 my-1 border-t border-slate-100 dark:border-white/10" />
                    <div className="px-2 pt-1.5 pb-3">
                      <div className="px-1.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[.07em] text-gray-400 dark:text-neutral-500">Responsável</div>
                      {(usersList || []).map(u => {
                        const selected = consultantFilters.includes(u.id);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => toggleConsultant(u.id)}
                            className={cn('w-full flex items-center gap-[9px] px-2 py-[7px] rounded-[9px] text-left transition-colors', selected ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-paper-50 dark:hover:bg-white/5')}
                          >
                            <Avatar name={u.name} size={24} />
                            <span className={cn('flex-1 text-[12.5px] text-gray-900 dark:text-white truncate', selected ? 'font-bold' : 'font-medium')}>{u.name}</span>
                            {selected && <Check className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" strokeWidth={2.6} />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chips de filtros ativos */}
      {hasActiveFilters && (
        <div className="shrink-0 px-4 md:px-7 pt-3 flex flex-wrap items-center gap-1.5">
          {activeChips.map(c => (
            <span key={c.key} className={cn('inline-flex items-center gap-1.5 h-[26px] pl-2.5 pr-2 rounded-full text-[11.5px] font-semibold', c.cls)}>
              {c.label}
              <button type="button" onClick={c.remove} title="Remover filtro" className="opacity-60 hover:opacity-100 transition-opacity grid place-items-center">
                <X className="size-[11px]" strokeWidth={2.6} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-[11.5px] font-semibold text-slate-500 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-white px-1 whitespace-nowrap"
          >
            Limpar tudo
          </button>
        </div>
      )}

      {/* Tabela em card */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 md:px-7 pt-4 pb-7">
        <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,.06)]">
          <div className="hidden md:grid grid-cols-[1.7fr_1.15fr_1.25fr_0.75fr] px-5 py-3 border-b border-slate-100 dark:border-neutral-800 text-[10.5px] font-semibold uppercase tracking-[.07em] text-gray-400 dark:text-neutral-500">
            <span>Lead</span><span>Status no funil</span><span>Ação agendada</span><span className="text-right">Cadastro</span>
          </div>

          {filteredLeads.length === 0 ? (
            <div className="py-16 text-center grid place-items-center gap-2">
              <Users className="size-[22px] opacity-40 text-slate-400" />
              <p className="text-[14px] font-semibold text-gray-700 dark:text-neutral-200">Nenhum lead encontrado</p>
              <p className="text-[12.5px] text-slate-400 dark:text-neutral-500">Limpe os filtros.</p>
            </div>
          ) : (
            visibleLeads.map(l => {
              const isOverdue = l.status !== 'Venda' && l.status !== 'Perda' && l.nextFollowUp && l.nextFollowUp < new Date();
              const isHot = isHotLeadFromDate(l, interactionIndex.get(l.id)?.lastDate);
              const consultantFirst = (l.consultantName || '').trim().split(/\s+/)[0] || '';
              return (
                <div
                  key={l.id}
                  onClick={() => openProfile(l.id)}
                  className="grid grid-cols-1 gap-2 md:gap-0 md:grid-cols-[1.7fr_1.15fr_1.25fr_0.75fr] md:items-center px-5 py-[11px] border-b border-slate-100 dark:border-neutral-800 last:border-b-0 cursor-pointer bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                >
                  {/* Lead */}
                  <div className="flex items-center gap-[11px] min-w-0">
                    <Avatar name={l.name} size={32} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={cn('text-[13.5px] font-semibold truncate', isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white')}>{l.name}</span>
                        {isHot && <span className="text-[10px] shrink-0" title="Lead com atividade recente ou agendamento próximo" aria-label="Lead quente">🔥</span>}
                      </div>
                      <div className="mt-px flex items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-neutral-400 tabular-nums">
                        <span className="inline-flex items-center gap-1"><Phone className="size-[11px]" /> {l.whatsapp}</span>
                        {consultantFirst && (
                          <>
                            <span className="size-1 rounded-full bg-slate-300 dark:bg-white/20" />
                            <span className="text-[11px] text-brand-600 dark:text-brand-300">@{consultantFirst}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status no funil */}
                  <div>
                    <StatusBadge statusName={l.status} statusesArray={statuses} />
                  </div>

                  {/* Ação agendada */}
                  <div>
                    {l.nextFollowUp ? (
                      <div className={cn('inline-flex items-center gap-1.5 text-[12px] font-semibold tabular-nums whitespace-nowrap', isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400')}>
                        {isOverdue ? <AlertCircle className="size-[13px] shrink-0" /> : <Calendar className="size-[13px] shrink-0" />}
                        {l.nextFollowUp.toLocaleDateString('pt-BR')} às {l.nextFollowUp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    ) : (
                      <span className="text-[11.5px] italic text-slate-400 dark:text-neutral-500">Sem agendamento</span>
                    )}
                  </div>

                  {/* Cadastro */}
                  <div className="md:text-right text-[12px] text-slate-500 dark:text-neutral-400 tabular-nums whitespace-nowrap">
                    {l.createdAt?.toLocaleDateString('pt-BR') || ''}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {filteredLeads.length > visibleCount && (
          <div className="flex justify-center pt-4">
            <Btn kind="soft" onClick={() => setVisibleCount(c => c + LIST_PAGE_SIZE)}>
              Carregar mais ({visibleLeads.length} de {filteredLeads.length})
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}
export { LeadsView };
