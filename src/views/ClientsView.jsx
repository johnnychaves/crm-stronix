import { useMemo, useState, useEffect, useRef } from 'react';
import { GraduationCap, Layers, Phone, SlidersHorizontal, Check, X } from 'lucide-react';
import { isLeadConverted, isAdminUser } from '../lib/leads.js';
import { LIST_PAGE_SIZE } from '../lib/leadStatus.js';
import { deriveLeadContractStatus, CONTRACT_STATUS, CONTRACT_STATUS_LABEL } from '../lib/contracts.js';
import { ContractAVencerBadge } from '../components/ui/ContractAVencerBadge.jsx';
import { getSafeDateOrNull } from '../lib/dates.js';
import { fmtBRL } from '../lib/format.js';
import { cn } from '@/lib/utils';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { useLeadProfile } from '../contexts/LeadProfileContext.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Btn } from '../components/ui/Btn.jsx';

// Status "vivo" do CLIENTE a partir do resumo denormalizado no lead. Legados
// (Venda antiga sem contrato) não têm endsAt → 'sem_contrato'.
const SEM_CONTRATO = 'sem_contrato';
const clientStatus = (lead, now, threshold) =>
  deriveLeadContractStatus(lead, now, threshold) || SEM_CONTRATO;

const STATUS_TONE = {
  [CONTRACT_STATUS.ATIVO]:    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  [CONTRACT_STATUS.A_VENCER]: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  [CONTRACT_STATUS.VENCIDO]:  'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
  [CONTRACT_STATUS.CANCELADO]:'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400',
  [SEM_CONTRATO]:             'bg-slate-100 text-slate-400 dark:bg-white/[0.04] dark:text-slate-500'
};
const STATUS_LABEL = { ...CONTRACT_STATUS_LABEL, [SEM_CONTRATO]: 'Sem contrato' };

// Ordem das situações na bubble/chips.
const STATUS_OPTIONS = [
  CONTRACT_STATUS.ATIVO,
  CONTRACT_STATUS.A_VENCER,
  CONTRACT_STATUS.VENCIDO,
  CONTRACT_STATUS.CANCELADO,
  SEM_CONTRATO
];

function ContractStatusBadge({ status }) {
  // "A vencer" mostra ambas as tags (Ativo + A vencer) — ver ContractAVencerBadge.
  if (status === CONTRACT_STATUS.A_VENCER) return <ContractAVencerBadge variant="tag" />;
  return (
    <span className={`inline-flex items-center px-2 h-6 rounded-md text-[11px] font-semibold ${STATUS_TONE[status] || STATUS_TONE[SEM_CONTRATO]}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function ClientsView({ leads, appUser, usersList }) {
  const { contractThresholdDays } = useGeneralConfig();
  const { openProfile } = useLeadProfile();
  const isAdmin = isAdminUser(appUser);

  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilters, setStatusFilters] = useState([]);     // situação do contrato (multi)
  const [consultantFilters, setConsultantFilters] = useState([]); // responsável (multi)
  const [planFilters, setPlanFilters] = useState([]);         // plano (multi)
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);

  const now = new Date();

  // Bubble de filtros fecha em clique fora / Esc (padrão das outras telas).
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

  // Clientes = matriculados. Opção 1: leads 'Venda' legados também entram
  // (aparecem como "Sem contrato"). A timeline é preservada (mesmo doc).
  const clientes = useMemo(
    () => (leads || []).filter(l => l.lifecycleStage === 'cliente' || isLeadConverted(l)),
    [leads]
  );

  // Planos distintos presentes nos clientes (para o filtro de plano).
  const planNames = useMemo(() => {
    const set = new Set();
    clientes.forEach(c => { if (c.currentPlanName) set.add(c.currentPlanName); });
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [clientes]);

  const filtered = useMemo(() => {
    return clientes.filter(c => {
      const st = clientStatus(c, now, contractThresholdDays);
      const matchStatus = statusFilters.length === 0 || statusFilters.includes(st);
      const matchConsultant = consultantFilters.length === 0 || consultantFilters.includes(c.consultantId);
      const matchPlan = planFilters.length === 0 || planFilters.includes(c.currentPlanName);
      return matchStatus && matchConsultant && matchPlan;
    }).sort((a, b) => {
      // Ordena por vencimento mais próximo primeiro; quem não tem vai ao fim.
      const ea = getSafeDateOrNull(a.currentContractEndsAt)?.getTime() ?? Infinity;
      const eb = getSafeDateOrNull(b.currentContractEndsAt)?.getTime() ?? Infinity;
      return ea - eb;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes, statusFilters, consultantFilters, planFilters, contractThresholdDays]);

  const visible = filtered.slice(0, visibleCount);

  const toggleStatus = (s) => setStatusFilters(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleConsultant = (id) => setConsultantFilters(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const togglePlan = (p) => setPlanFilters(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const filterCount = statusFilters.length + consultantFilters.length + planFilters.length;
  const hasActiveFilters = filterCount > 0;
  const clearAllFilters = () => { setStatusFilters([]); setConsultantFilters([]); setPlanFilters([]); };

  // Chips de filtros ativos (removem individualmente).
  const activeChips = [];
  statusFilters.forEach(s => activeChips.push({ key: `st:${s}`, label: STATUS_LABEL[s] || s, cls: STATUS_TONE[s] || STATUS_TONE[SEM_CONTRATO], remove: () => toggleStatus(s) }));
  consultantFilters.forEach(id => {
    const u = (usersList || []).find(x => x.id === id);
    activeChips.push({ key: `co:${id}`, label: u?.name || id, cls: 'bg-slate-100 text-gray-700 dark:bg-white/[0.06] dark:text-neutral-200', remove: () => toggleConsultant(id) });
  });
  planFilters.forEach(p => activeChips.push({ key: `pl:${p}`, label: p, cls: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300', remove: () => togglePlan(p) }));

  return (
    <div className="-m-4 md:-m-8 h-[calc(100vh-4rem)] flex flex-col animate-fade-in">
      {/* Header da página: resumo + filtro único */}
      <div className="h-16 shrink-0 relative z-20 bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 flex items-center gap-3 md:gap-5 px-4 md:px-7">
        <div className="flex-1" />

        <div className="hidden md:block text-[11.5px] text-slate-500 dark:text-neutral-400 whitespace-nowrap tabular-nums shrink-0">
          <span className="font-semibold text-gray-700 dark:text-neutral-200">{filtered.length}</span> de {clientes.length} clientes
        </div>

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
                {/* Situação do contrato */}
                <div className="px-2 pt-2.5 pb-1">
                  <div className="px-1.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[.07em] text-gray-400 dark:text-neutral-500">Situação do contrato</div>
                  <div className="flex flex-wrap gap-[5px] px-1.5 pb-2">
                    {STATUS_OPTIONS.map(s => {
                      const selected = statusFilters.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleStatus(s)}
                          className={cn(
                            'h-[26px] px-2.5 rounded-full text-[11.5px] font-semibold whitespace-nowrap transition-colors border',
                            selected
                              ? `${STATUS_TONE[s]} border-transparent`
                              : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700 text-slate-500 dark:text-neutral-400 hover:border-brand-200'
                          )}
                        >
                          {STATUS_LABEL[s] || s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Responsável (admin) */}
                {isAdmin && (usersList || []).length > 0 && (
                  <>
                    <div className="mx-3.5 my-1 border-t border-slate-100 dark:border-white/10" />
                    <div className="px-2 pt-1.5 pb-1">
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

                {/* Plano */}
                {planNames.length > 0 && (
                  <>
                    <div className="mx-3.5 my-1 border-t border-slate-100 dark:border-white/10" />
                    <div className="px-2 pt-1.5 pb-3">
                      <div className="px-1.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[.07em] text-gray-400 dark:text-neutral-500">Plano</div>
                      <div className="flex flex-wrap gap-[5px] px-1.5">
                        {planNames.map(p => {
                          const selected = planFilters.includes(p);
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => togglePlan(p)}
                              className={cn(
                                'h-[26px] px-2.5 rounded-full text-[11.5px] font-semibold whitespace-nowrap transition-colors border',
                                selected
                                  ? 'bg-brand-50 text-brand-700 border-transparent dark:bg-brand-500/15 dark:text-brand-300'
                                  : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700 text-slate-500 dark:text-neutral-400 hover:border-brand-200'
                              )}
                            >
                              {p}
                            </button>
                          );
                        })}
                      </div>
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
          <div className="hidden md:grid grid-cols-[1.7fr_1.1fr_0.8fr_0.9fr_0.9fr] px-5 py-3 border-b border-slate-100 dark:border-neutral-800 text-[10.5px] font-semibold uppercase tracking-[.07em] text-gray-400 dark:text-neutral-500">
            <span>Cliente</span><span>Plano</span><span className="text-right">Valor</span><span className="text-right">Vencimento</span><span>Contrato</span>
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center grid place-items-center gap-2">
              <GraduationCap className="size-[22px] opacity-40 text-slate-400" />
              <p className="text-[14px] font-semibold text-gray-700 dark:text-neutral-200">Nenhum cliente encontrado</p>
              <p className="text-[12.5px] text-slate-400 dark:text-neutral-500">Matricule um lead pelo Kanban ou pela ficha para vê-lo aqui.</p>
            </div>
          ) : (
            visible.map(c => {
              const st = clientStatus(c, now, contractThresholdDays);
              const endsAt = getSafeDateOrNull(c.currentContractEndsAt);
              const consultantFirst = (c.consultantName || '').trim().split(/\s+/)[0] || '';
              const hasValue = Number.isFinite(Number(c.currentContractValue)) && c.currentContractValue != null;
              return (
                <div
                  key={c.id}
                  onClick={() => openProfile(c.id)}
                  className="grid grid-cols-1 gap-2 md:gap-0 md:grid-cols-[1.7fr_1.1fr_0.8fr_0.9fr_0.9fr] md:items-center px-5 py-[11px] border-b border-slate-100 dark:border-neutral-800 last:border-b-0 cursor-pointer bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                >
                  {/* Cliente */}
                  <div className="flex items-center gap-[11px] min-w-0">
                    <Avatar name={c.name} size={32} />
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-semibold text-slate-900 dark:text-white truncate">{c.name}</div>
                      <div className="mt-px flex items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-neutral-400 tabular-nums">
                        <span className="inline-flex items-center gap-1"><Phone className="size-[11px]" /> {c.whatsapp}</span>
                        {consultantFirst && (
                          <>
                            <span className="size-1 rounded-full bg-slate-300 dark:bg-white/20" />
                            <span className="text-[11px] text-brand-600 dark:text-brand-300">@{consultantFirst}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Plano */}
                  <div className="min-w-0">
                    {c.currentPlanName ? (
                      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-700 dark:text-neutral-200 truncate">
                        <Layers className="size-3 text-slate-400 shrink-0" /> <span className="truncate">{c.currentPlanName}</span>
                      </span>
                    ) : (
                      <span className="text-[11.5px] text-slate-400 italic">—</span>
                    )}
                  </div>

                  {/* Valor */}
                  <div className="md:text-right text-[12.5px] tabular-nums text-slate-700 dark:text-neutral-200">
                    {hasValue ? fmtBRL(c.currentContractValue) : '—'}
                  </div>

                  {/* Vencimento */}
                  <div className="md:text-right text-[12px] tabular-nums text-slate-500 dark:text-neutral-400 whitespace-nowrap">
                    {endsAt ? endsAt.toLocaleDateString('pt-BR') : '—'}
                  </div>

                  {/* Contrato */}
                  <div>
                    <ContractStatusBadge status={st} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {filtered.length > visibleCount && (
          <div className="flex justify-center pt-4">
            <Btn kind="soft" onClick={() => setVisibleCount(c => c + LIST_PAGE_SIZE)}>
              Carregar mais ({visible.length} de {filtered.length})
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}

export { ClientsView };
