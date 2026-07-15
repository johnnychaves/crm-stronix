import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Search, X, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { searchPeople, onlyDigits } from '../../lib/globalSearch.js';
import { useLeadSearch } from '../../hooks/useLeadSearch.js';
import { deriveLeadState, getTone } from '../../lib/leadState.js';
import { useLeadProfile } from '../../contexts/LeadProfileContext.jsx';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { StateRingAvatar } from '../ui/StateRingAvatar.jsx';

// Telefone BR: (11) 9 8888-7766 ou (11) 3333-4444.
const fmtPhone = (raw) => {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length < 10) return String(raw || '');
  const ddd = d.slice(0, 2);
  const r = d.slice(2);
  return r.length === 9
    ? `(${ddd}) ${r[0]} ${r.slice(1, 5)}-${r.slice(5)}`
    : `(${ddd}) ${r.slice(0, 4)}-${r.slice(4)}`;
};
const fmtCpf = (raw) => {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length !== 11) return String(raw || '');
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

// Nome com o trecho encontrado destacado (matchRange aponta para o nome original).
function HighlightedName({ name, range }) {
  if (!range) return name;
  const [s, e] = range;
  return (
    <>
      {name.slice(0, s)}
      <mark className="bg-brand-100 dark:bg-brand-500/30 text-inherit rounded-[3px] font-semibold">{name.slice(s, e)}</mark>
      {name.slice(e)}
    </>
  );
}

// Barra de busca global fixa no header. Acha leads e clientes por nome,
// sobrenome, CPF ou telefone e abre a ficha. Desktop = barra inline; mobile =
// lupa que expande uma barra sobre o header.
export function GlobalSearch({ onAddLead, db }) {
  const { openProfile } = useLeadProfile();
  const { contractThresholdDays } = useGeneralConfig();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const wrapRef = useRef(null);
  const deskInputRef = useRef(null);
  const mobInputRef = useRef(null);

  // Fonte (G1b): candidatos por query própria (prefixo/token nos search fields)
  // em vez do prop global. searchPeople roda sobre os candidatos e reproduz o
  // MESMO ranking/tier/destaque de antes — o render abaixo não muda.
  const { candidates, loading: searchLoading } = useLeadSearch({ db, query });
  const { results, total } = useMemo(
    () => searchPeople(candidates, query, { limit: 8 }),
    [candidates, query]
  );

  // Enriquece cada resultado com o estado (tom do anel + rótulo do chip).
  const rows = useMemo(() => {
    const now = new Date();
    return results.map((r) => {
      const state = deriveLeadState(r.lead, now, contractThresholdDays);
      return {
        ...r,
        state,
        tone: getTone(state.tone),
        splitHex: state.key === 'a_vencer' ? '#10B981' : null
      };
    });
  }, [results, contractThresholdDays]);

  const showDropdown = open && query.trim().length >= 2;

  useEffect(() => { setActiveIndex(0); }, [query]);

  // Fecha ao clicar fora (mesmo padrão da bubble de filtros das telas).
  useEffect(() => {
    if (!open && !mobileOpen) return;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) { setOpen(false); setMobileOpen(false); }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, mobileOpen]);

  // Atalho global: Cmd/Ctrl+K foca a busca (abre a barra no mobile).
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (window.matchMedia('(min-width: 640px)').matches) {
          setOpen(true);
          deskInputRef.current?.focus();
        } else {
          setMobileOpen(true); setOpen(true);
          setTimeout(() => mobInputRef.current?.focus(), 0);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pick = useCallback((lead) => {
    if (!lead) return;
    openProfile(lead.id);
    setQuery(''); setOpen(false); setMobileOpen(false);
  }, [openProfile]);

  const onInputKeyDown = (e) => {
    if (!showDropdown || rows.length === 0) {
      if (e.key === 'Escape') { setQuery(''); setOpen(false); setMobileOpen(false); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(rows[activeIndex]?.lead || rows[0]?.lead); }
    else if (e.key === 'Escape') { setQuery(''); setOpen(false); setMobileOpen(false); }
  };

  const inputCls = 'w-full h-9 rounded-xl bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] pl-9 pr-16 placeholder:text-slate-400 transition';

  const renderInput = (ref, isMobile) => (
    <div className="relative w-full">
      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        ref={ref}
        type="text"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls="global-search-list"
        aria-autocomplete="list"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onInputKeyDown}
        placeholder="Buscar leads e clientes"
        className={inputCls}
      />
      {isMobile ? (
        <button onClick={() => { setMobileOpen(false); setQuery(''); }} aria-label="Fechar busca"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white">
          <X className="w-4 h-4" />
        </button>
      ) : (
        <kbd className="hidden md:flex items-center absolute right-2.5 top-1/2 -translate-y-1/2 text-[10.5px] text-slate-400 border border-slate-200 dark:border-white/[0.1] rounded px-1.5 py-0.5">⌘K</kbd>
      )}
    </div>
  );

  const dropdown = showDropdown && (
    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-white/[0.08] shadow-[0_16px_40px_-12px_rgba(2,6,23,0.35)] overflow-hidden">
      <div className="px-3.5 py-2 text-[11px] text-slate-400 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-2">
        <span>Nome, sobrenome, CPF ou telefone</span>
        {rows.length > 0 && <span className="tabular-nums shrink-0">{rows.length} de {total}</span>}
      </div>
      {searchLoading && rows.length === 0 ? (
        <div className="px-3.5 py-6 text-center">
          <p className="text-[13px] text-slate-500 dark:text-neutral-400">Buscando…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="px-3.5 py-6 text-center">
          <p className="text-[13px] text-slate-500 dark:text-neutral-400">Nenhum lead ou cliente encontrado</p>
          {onAddLead && (
            <button onClick={() => { onAddLead(); setQuery(''); setOpen(false); setMobileOpen(false); }}
              className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-600 dark:text-brand-400 hover:opacity-80">
              <UserPlus className="w-3.5 h-3.5" /> Cadastrar novo lead
            </button>
          )}
        </div>
      ) : (
        <ul id="global-search-list" role="listbox" className="max-h-[380px] overflow-y-auto p-1.5 custom-scrollbar">
          {rows.map((r, i) => {
            const lead = r.lead;
            const sub = r.matchKind === 'cpf'
              ? `CPF ${fmtCpf(lead.cpf)}`
              : (fmtPhone(lead.whatsapp) || r.state.hint);
            return (
              <li
                key={lead.id}
                role="option"
                aria-selected={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(lead); }}
                className={cn('flex items-center gap-3 px-2.5 py-2 rounded-xl cursor-pointer', i === activeIndex && 'bg-slate-100 dark:bg-white/[0.05]')}
              >
                <StateRingAvatar name={lead.name} toneName={r.state.tone} splitHex={r.splitHex} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-gray-900 dark:text-white truncate">
                    <HighlightedName name={lead.name || 'Sem nome'} range={r.matchRange} />
                  </div>
                  <div className="text-[11.5px] text-slate-400 truncate">{sub}</div>
                </div>
                <span className={cn('text-[10.5px] font-semibold px-2 py-0.5 rounded-lg shrink-0 whitespace-nowrap', r.tone.soft, r.tone.text, r.tone.darkSoft, r.tone.darkText)}>
                  {r.state.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <div ref={wrapRef} className="flex-none sm:flex-1 min-w-0">
      {/* Mobile: só a lupa no header */}
      <button
        onClick={() => { setMobileOpen(true); setOpen(true); setTimeout(() => mobInputRef.current?.focus(), 0); }}
        aria-label="Buscar leads e clientes"
        className="sm:hidden p-2 rounded-xl text-slate-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition"
      >
        <Search className="w-5 h-5" />
      </button>

      {/* Desktop: barra inline centralizada */}
      <div className="hidden sm:block relative w-full max-w-md mx-auto">
        {renderInput(deskInputRef, false)}
        {!mobileOpen && dropdown}
      </div>

      {/* Mobile: barra expandida sobre o header */}
      {mobileOpen && (
        <div className="sm:hidden fixed inset-x-0 top-0 h-16 px-4 z-50 flex items-center bg-white dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800">
          <div className="relative w-full">
            {renderInput(mobInputRef, true)}
            {dropdown}
          </div>
        </div>
      )}
    </div>
  );
}
