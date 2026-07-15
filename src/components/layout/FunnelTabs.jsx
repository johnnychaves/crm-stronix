import { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Espaço (px) entre as abas — precisa bater com o gap-1 do container real E
// da linha fantasma de medição, senão o cálculo de overflow erra.
const TAB_GAP = 4;

// Aba de funil. Usada na linha visível e na linha fantasma de medição
// (mesmas classes ⇒ mesma largura medida).
function FunnelTab({ funnel, count, active, onClick, tabIndex }) {
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={tabIndex}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'h-full px-3 inline-flex items-center gap-2 text-[13.5px] font-semibold whitespace-nowrap transition-colors',
        active
          ? 'text-brand-700 dark:text-brand-300 shadow-[inset_0_-2px_0_var(--color-brand-600)]'
          : 'text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200'
      )}
    >
      {funnel.name}
      <span
        className={cn(
          'text-[11px] font-bold px-1.5 py-px rounded-md tabular-nums',
          active
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
            : 'bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400'
        )}
      >
        {count}
      </span>
    </button>
  );
}

// Abas de funil com overflow "+N": mede a linha fantasma via ResizeObserver e
// agrupa o excedente num menu "Outros funis". O funil ativo nunca fica
// escondido — troca de lugar com a última aba visível. Compartilhado entre o
// Pipeline (Kanban) e a tela de Todos os Leads.
//
// Props: funnels [{id,name}], counts (Map id→n ou objeto), selectedId, onSelect(id).
function FunnelTabs({ funnels, counts, selectedId, onSelect }) {
  const getCount = (id) =>
    (counts && typeof counts.get === 'function' ? counts.get(id) : counts?.[id]) || 0;

  // Ordem de exibição das abas (sincroniza com os funis cadastrados).
  const [tabOrder, setTabOrder] = useState(() => (funnels || []).map(f => f.id));
  useEffect(() => {
    const ids = (funnels || []).map(f => f.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reconcilia a ordem das abas (estado de drag) com a lista de funis vinda por prop.
    setTabOrder(prev => {
      const kept = prev.filter(id => ids.includes(id));
      const added = ids.filter(id => !kept.includes(id));
      const next = [...kept, ...added];
      return next.length === prev.length && next.every((id, i) => id === prev[i]) ? prev : next;
    });
  }, [funnels]);

  const orderedFunnels = useMemo(
    () => tabOrder.map(id => (funnels || []).find(f => f.id === id)).filter(Boolean),
    [tabOrder, funnels]
  );

  const tabsAreaRef = useRef(null);
  const ghostRef = useRef(null);
  const [tabsAreaW, setTabsAreaW] = useState(0);
  const [visibleTabCount, setVisibleTabCount] = useState(Number.MAX_SAFE_INTEGER);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowWrapRef = useRef(null);

  useEffect(() => {
    const el = tabsAreaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(entries => setTabsAreaW(entries[0]?.contentRect?.width || 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tabsSig = orderedFunnels.map(f => `${f.id}:${f.name}:${getCount(f.id)}`).join('|');

  useLayoutEffect(() => {
    const ghost = ghostRef.current;
    const area = tabsAreaRef.current;
    if (!ghost || !area) return;
    const width = area.clientWidth;
    const kids = Array.from(ghost.children);
    if (kids.length < 2) return; // sem funis: nada a medir
    const moreW = kids[kids.length - 1].offsetWidth; // fantasma do "+N"
    const tabWidths = kids.slice(0, -1).map(el => el.offsetWidth);
    const totalAll = tabWidths.reduce((sum, w, i) => sum + w + (i > 0 ? TAB_GAP : 0), 0);
    let count = tabWidths.length;
    if (totalAll > width) {
      count = 0;
      let acc = 0;
      for (let i = 0; i < tabWidths.length; i++) {
        const next = acc + (i > 0 ? TAB_GAP : 0) + tabWidths[i];
        if (next + TAB_GAP + moreW <= width) { acc = next; count = i + 1; } else break;
      }
      count = Math.max(1, count);
    }
    setVisibleTabCount(prev => (prev === count ? prev : count));
  }, [tabsAreaW, tabsSig]);

  // Garante que o funil ativo está sempre entre as abas visíveis.
  useEffect(() => {
    if (!selectedId) return;
    const idx = tabOrder.indexOf(selectedId);
    if (idx === -1 || idx < visibleTabCount || visibleTabCount >= tabOrder.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- traz a aba selecionada para a faixa visível (reordenação dependente de layout medido).
    setTabOrder(prev => {
      const next = [...prev];
      const last = Math.min(visibleTabCount, prev.length) - 1;
      if (last < 0 || last === idx) return prev;
      [next[last], next[idx]] = [next[idx], next[last]];
      return next;
    });
  }, [selectedId, visibleTabCount, tabOrder]);

  // Menu "+N" fecha em clique fora / Esc.
  useEffect(() => {
    if (!overflowOpen) return;
    const onPointerDown = (e) => { if (!overflowWrapRef.current?.contains(e.target)) setOverflowOpen(false); };
    const onKeyDown = (e) => { if (e.key === 'Escape') setOverflowOpen(false); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [overflowOpen]);

  const visibleFunnels = orderedFunnels.slice(0, visibleTabCount);
  const hiddenFunnels = orderedFunnels.slice(visibleTabCount);

  return (
    <div ref={tabsAreaRef} className="relative flex-1 min-w-0 h-full flex items-stretch gap-1">
      {visibleFunnels.map(f => (
        <FunnelTab key={f.id} funnel={f} count={getCount(f.id)} active={f.id === selectedId} onClick={() => onSelect(f.id)} />
      ))}

      {hiddenFunnels.length > 0 && (
        <div ref={overflowWrapRef} className="relative flex items-center">
          <button
            type="button"
            onClick={() => setOverflowOpen(o => !o)}
            aria-haspopup="menu"
            aria-expanded={overflowOpen}
            className="h-[34px] px-3 rounded-[9px] border border-dashed border-brand-200 dark:border-brand-500/40 bg-brand-50 dark:bg-brand-500/15 text-[12.5px] font-bold text-brand-700 dark:text-brand-300 inline-flex items-center gap-[5px] whitespace-nowrap transition-colors hover:border-brand-300"
          >
            +{hiddenFunnels.length}
            <ChevronDown className="size-[13px]" strokeWidth={2.2} />
          </button>

          {overflowOpen && (
            <div
              role="menu"
              className="absolute left-0 top-[54px] w-[224px] rounded-[14px] bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-700 shadow-[0_16px_40px_-8px_rgba(14,26,64,.22)] overflow-hidden z-30"
            >
              <div className="px-3.5 pt-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[.07em] text-gray-400 dark:text-neutral-500">
                Outros funis
              </div>
              <div className="px-2 pb-2 flex flex-col gap-0.5">
                {hiddenFunnels.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    role="menuitem"
                    onClick={() => { onSelect(f.id); setOverflowOpen(false); }}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-[9px] text-left text-[13px] font-semibold text-gray-900 dark:text-white hover:bg-paper-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <span className="truncate">{f.name}</span>
                    <span className="ml-auto text-[11px] font-bold px-1.5 py-px rounded-md bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400 tabular-nums shrink-0">
                      {getCount(f.id)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Linha fantasma p/ medir a largura das abas e do "+N" (invisível) */}
      <div
        ref={ghostRef}
        aria-hidden="true"
        className="absolute left-0 top-0 h-0 overflow-hidden invisible pointer-events-none flex items-stretch gap-1"
      >
        {orderedFunnels.map(f => (
          <FunnelTab key={f.id} funnel={f} count={getCount(f.id)} active={false} tabIndex={-1} />
        ))}
        <div className="flex items-center">
          <span className="h-[34px] px-3 rounded-[9px] border border-dashed text-[12.5px] font-bold inline-flex items-center gap-[5px] whitespace-nowrap">
            +{Math.max(orderedFunnels.length - 1, 1)}
            <ChevronDown className="size-[13px]" />
          </span>
        </div>
      </div>
    </div>
  );
}
export { FunnelTabs };
