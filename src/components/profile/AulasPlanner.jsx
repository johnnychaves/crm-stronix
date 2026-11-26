import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { calendarDaysBetween, fromDateInputValue, startOfLocalDay, toDateInputValue } from '../../lib/dates.js';
import { SOLO_TRAINING, SOLO_TRAINING_LABEL } from '../../lib/professores.js';
import { aulasForConfirm, aulasProblem, aulasSentence, resolveAulaRows, shortDay } from '../../lib/aulasPlan.js';

// "Marcar as aulas" do Agendar (mockup A, #marcar-aulas). As contas moram em
// lib/aulasPlan.js; o assistente guarda as linhas cruas (rows) em values.aulas.

const CHIP = 'h-8 rounded-full border px-3 text-[12.5px] font-semibold transition focus-visible:outline-none focus-visible:anel-foco';
const FIELD = 'mt-1 h-9 w-full rounded-lg border border-border bg-card px-2.5 text-[13px] num outline-none focus-visible:anel-foco dark:[color-scheme:dark]';
const IDLE = 'border-border bg-card hover:border-slate-300 dark:hover:border-white/15';
// O tom da aula experimental no Agendar (WZ_TONES.teal), o padrão fora dele.
const TEAL = { text: 'text-teal-700', soft: 'bg-teal-50', ring: 'ring-teal-300', darkText: 'dark:text-teal-300', darkSoft: 'dark:bg-teal-500/10', darkRing: 'dark:ring-teal-500/40' };

// days: os cartões de dia (dayOptions, em lib/aulasPlan.js), { off, date }.
// professors: os professores da modalidade; "Treina sozinho" vem sempre.
// No Remarcar de uma aula do freepass: `first` é o número dela, `taken` os
// dias das outras aulas e `doneText` a frase de quando está tudo certo.
export function AulasPlanner({ rows, onChange, days, professors, tone = TEAL, firstName, now = new Date(), first = 1, taken = [], doneText = null }) {
  const [otherOpen, setOtherOpen] = useState(() => new Set());
  const resolved = resolveAulaRows(rows);
  const problem = aulasProblem(resolved, now, { first, taken });

  // Mexer numa linha a tira do automático, com o que ela mostrava mais a mudança.
  const setRow = (i, patch) => onChange(rows.map((r, k) => (k === i ? { ...resolved[i], ...patch, auto: false } : r)));
  const toggleOther = (i) => setOtherOpen((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  const chipLabel = (o) => (o.off === 0 ? 'Hoje' : o.off === 1 ? 'Amanhã' : shortDay(o.date));
  // Os atalhos do assistente, mais o dia da linha quando ele não está entre eles
  // (a semana seguinte da aula anterior, ou um "Outro dia").
  const chipsFor = (r) => {
    const list = (days || []).map((o) => ({ date: o.date, label: chipLabel(o) }));
    if (r.date && !list.some((o) => calendarDaysBetween(o.date, r.date) === 0)) {
      list.push({ date: startOfLocalDay(r.date), label: shortDay(r.date) });
      list.sort((a, b) => a.date - b.date);
    }
    return list;
  };

  return (
    <div className="flex max-w-[560px] flex-col gap-3">
      {resolved.map((r, i) => (
        <fieldset key={i} className="rounded-xl border border-border p-4">
          <legend className="sr-only">Aula {first + i}{r.auto ? `, igual à aula ${first + i - 1}, uma semana depois` : ''}</legend>
          <div aria-hidden="true" className="mb-3 flex items-center gap-2">
            <span className={cn('grid size-6 place-items-center rounded-full text-[12px] font-bold', tone.soft, tone.darkSoft, tone.text, tone.darkText)}>{first + i}</span>
            <span className="text-[15px] font-semibold">Aula {first + i}</span>
            {r.auto && <span className="text-[12px] text-muted-foreground">igual à aula {first + i - 1}, uma semana depois</span>}
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label={`Dia da aula ${first + i}`}>
            {chipsFor(r).map((o) => {
              const sel = Boolean(r.date) && calendarDaysBetween(o.date, r.date) === 0;
              return (
                <button key={o.date.getTime()} type="button" aria-pressed={sel} onClick={() => setRow(i, { date: startOfLocalDay(o.date) })}
                  className={cn(CHIP, sel ? cn(tone.soft, tone.darkSoft, tone.text, tone.darkText, 'border-transparent ring-2', tone.ring, tone.darkRing) : IDLE)}>
                  {o.label}
                </button>
              );
            })}
            <button type="button" aria-expanded={otherOpen.has(i)} onClick={() => toggleOther(i)} className={cn(CHIP, 'inline-flex items-center gap-1.5', IDLE)}>
              <CalendarDays size={13} aria-hidden="true" /> Outro dia
            </button>
            {otherOpen.has(i) && (
              <input type="date" aria-label={`Outro dia da aula ${first + i}`} min={toDateInputValue(now)}
                value={toDateInputValue(r.date)} onChange={(e) => { const d = fromDateInputValue(e.target.value); if (d) setRow(i, { date: d }); }}
                className="h-8 rounded-lg border border-border bg-card px-2 text-[12.5px] num outline-none focus-visible:anel-foco dark:[color-scheme:dark]" />
            )}
          </div>
          <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3">
            <label className="text-[12px] font-semibold text-muted-foreground">
              Horário
              <input type="time" value={r.time} onChange={(e) => setRow(i, { time: e.target.value })} className={FIELD} />
            </label>
            <label className="text-[12px] font-semibold text-muted-foreground">
              Professor
              <select value={r.professor} onChange={(e) => setRow(i, { professor: e.target.value })} className={FIELD}>
                <option value="" disabled>Escolha</option>
                {(professors || []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                <option value={SOLO_TRAINING}>{SOLO_TRAINING_LABEL}</option>
              </select>
            </label>
          </div>
        </fieldset>
      ))}
      <p role="status" className={cn('rounded-lg px-3 py-2.5 text-[12.5px] font-medium',
        problem ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' : cn(tone.soft, tone.darkSoft, tone.text, tone.darkText))}>
        {problem || doneText || aulasSentence(firstName, aulasForConfirm(resolved))}
      </p>
    </div>
  );
}
