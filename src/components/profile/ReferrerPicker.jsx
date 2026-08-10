import { useMemo, useRef, useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { searchPeople } from '../../lib/globalSearch.js';
import { useLeadSearch } from '../../hooks/useLeadSearch.js';
import { deriveLeadState, getTone } from '../../lib/leadState.js';
import { isClientLead } from '../../lib/leads.js';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { StateRingAvatar } from '../ui/StateRingAvatar.jsx';

// Combobox "Quem indicou?" — molde do GlobalSearch (mesma busca por nome/CPF/
// telefone, mesmo ranking), restrito a CLIENTES: só aluno matriculado pode ser
// indicador. Controlado: `value` é o cliente escolhido (ou null) e onSelect
// troca/limpa. `excludeId` barra a auto-indicação no vínculo retroativo.
export function ReferrerPicker({ db, value, onSelect, excludeId = null, autoFocus = false }) {
  const { contractThresholdDays } = useGeneralConfig();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  // Página de candidatos maior que a busca global (20→30): o filtro de cliente
  // roda client-side e nomes comuns não podem esconder o aluno procurado.
  const { candidates, loading } = useLeadSearch({ db, query, candidatePageSize: 30 });
  const clientCandidates = useMemo(
    () => (candidates || []).filter((l) => isClientLead(l) && l.id !== excludeId),
    [candidates, excludeId]
  );
  const { results } = useMemo(
    () => searchPeople(clientCandidates, query, { limit: 6 }),
    [clientCandidates, query]
  );
  const rows = useMemo(() => {
    const now = new Date();
    return results.map((r) => {
      const state = deriveLeadState(r.lead, now, contractThresholdDays);
      return { ...r, state, tone: getTone(state.tone) };
    });
  }, [results, contractThresholdDays]);

  const showDropdown = open && query.trim().length >= 2;

  // Reset do destaque quando a busca muda (padrão do GlobalSearch: ajuste
  // durante o render, sem effect).
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setActiveIndex(0);
  }

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (lead) => {
    if (!lead) return;
    onSelect(lead);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!showDropdown || rows.length === 0) {
      if (e.key === 'Escape') { setQuery(''); setOpen(false); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(rows[activeIndex]?.lead || rows[0]?.lead); }
    else if (e.key === 'Escape') { setQuery(''); setOpen(false); }
  };

  // Cliente escolhido: card compacto com anel de estado + trocar (X).
  if (value) {
    const state = deriveLeadState(value, new Date(), contractThresholdDays);
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/25 dark:bg-emerald-500/[0.06] px-3 py-2.5">
        <StateRingAvatar name={value.name} toneName={state.tone} size={30} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">{value.name}</div>
          <div className="text-[11.5px] text-emerald-700 dark:text-emerald-400">Cliente indicador</div>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-label="Trocar indicador"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-white/[0.06] transition"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="size-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="referrer-picker-list"
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Buscar cliente por nome, CPF ou telefone"
          className="w-full h-11 pl-10 pr-3.5 rounded-xl text-[14px] font-medium bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-normal outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12"
        />
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-white/[0.08] shadow-[0_16px_40px_-12px_rgba(2,6,23,0.35)] overflow-hidden">
          {loading && rows.length === 0 ? (
            <div className="px-3.5 py-5 text-center text-[13px] text-slate-500 dark:text-neutral-400">Buscando…</div>
          ) : rows.length === 0 ? (
            <div className="px-3.5 py-5 text-center">
              <p className="text-[13px] text-slate-500 dark:text-neutral-400">Nenhum cliente encontrado</p>
              <p className="text-[11.5px] text-slate-400 dark:text-neutral-500 mt-1">Só alunos matriculados podem indicar.</p>
            </div>
          ) : (
            <ul id="referrer-picker-list" role="listbox" className="max-h-[260px] overflow-y-auto p-1.5 custom-scrollbar">
              {rows.map((r, i) => (
                <li
                  key={r.lead.id}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseDown={(e) => { e.preventDefault(); pick(r.lead); }}
                  className={cn(
                    'flex items-center gap-3 px-2.5 py-2 rounded-xl cursor-pointer',
                    i === activeIndex && 'bg-slate-100 dark:bg-white/[0.05]'
                  )}
                >
                  <StateRingAvatar name={r.lead.name} toneName={r.state.tone} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-gray-900 dark:text-white truncate">{r.lead.name || 'Sem nome'}</div>
                    <div className="text-[11.5px] text-slate-400 truncate">{r.state.hint || r.state.label}</div>
                  </div>
                  <span className={cn('text-[10.5px] font-semibold px-2 py-0.5 rounded-lg shrink-0 whitespace-nowrap', r.tone.soft, r.tone.text, r.tone.darkSoft, r.tone.darkText)}>
                    {r.state.label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
