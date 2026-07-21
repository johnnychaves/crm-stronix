import { useState } from 'react';
import { Plus, X } from 'lucide-react';

// Chip de etiqueta selecionável.
function TagChip({ children, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold px-2 py-1 rounded-md bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-200 whitespace-nowrap">
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="text-slate-400 hover:text-slate-700 dark:hover:text-white -mr-0.5">
          <X size={11} />
        </button>
      )}
    </span>
  );
}

// Input de etiquetas: chips digitáveis + sugestões. Trabalha sobre string[].
export function TagsInput({ tags, setTags, suggestions = [] }) {
  const [val, setVal] = useState('');
  const add = () => {
    const v = val.trim();
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setVal('');
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 min-h-11 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] px-2.5 py-2 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10 transition">
        {tags.map((t) => <TagChip key={t} onRemove={() => setTags(tags.filter((x) => x !== t))}>{t}</TagChip>)}
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); add(); }
            if (e.key === 'Backspace' && !val && tags.length) setTags(tags.slice(0, -1));
          }}
          placeholder={tags.length ? '' : 'Digite e pressione Enter…'}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-[13px] h-7 placeholder:text-slate-400"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {suggestions.filter((s) => !tags.includes(s)).slice(0, 5).map((s) => (
            <button key={s} type="button" onClick={() => setTags([...tags, s])}
              className="text-[11px] font-medium px-2 py-1 rounded-md border border-slate-200 dark:border-white/10 text-slate-500 hover:text-brand-600 hover:border-brand-300 dark:text-slate-400 dark:hover:text-brand-300 transition inline-flex items-center gap-1">
              <Plus size={10} />{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
