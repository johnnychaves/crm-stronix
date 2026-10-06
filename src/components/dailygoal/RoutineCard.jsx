import { useState } from 'react';
import { Check, ListChecks, MessageSquare, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useMyRoutine } from '../../hooks/useMyRoutine.js';
import { NOTE_MAX, hhmmOf, markDoneAt, markIdOf, minutesOf, routineDayKey, stateText, taskStateAt, tasksForDay } from '../../lib/rotinas.js';
import { markDone, saveMarkNote, undoMark } from '../../lib/rotinasWrites.js';

// Cartão "Rotina de hoje" da Meta diária (spec
// docs/superpowers/specs/2026-10-06-rotinas-dos-consultores-design.md, mockup
// 2026-10-06-rotina-na-meta-diaria.html, opção A). Fica fora da conta da Meta:
// não entra no ProgressHero, nos filtros da lista nem no dia batido.

const DONE = new Set(['done', 'doneLate']);

// No escuro o bg-card é translúcido e a régua da linha do tempo aparece por
// dentro do círculo vazio, por isso os estados sem check levam fundo sólido.
const CHECK_TONE = {
  done: 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500',
  doneLate: 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500',
  late: 'border-rose-400 bg-rose-50 dark:bg-[#2a1326]',
  now: 'border-brand-600 bg-card ring-4 ring-brand-600/15 dark:bg-[#0c1126]',
  later: 'border-slate-300 bg-card dark:border-white/20 dark:bg-[#0c1126]',
  open: 'border-slate-300 bg-card dark:border-white/20 dark:bg-[#0c1126]',
};

const META_TONE = {
  done: 'text-emerald-700 dark:text-emerald-300',
  doneLate: 'text-amber-700 dark:text-amber-300',
  late: 'text-rose-600 dark:text-rose-300',
  now: 'font-medium text-brand-600 dark:text-brand-300',
  later: 'text-muted-foreground',
  open: 'text-muted-foreground',
};

const SEG_TONE = {
  done: 'bg-emerald-600 dark:bg-emerald-500',
  doneLate: 'bg-emerald-600 dark:bg-emerald-500',
  late: 'bg-rose-500',
  now: 'bg-brand-600',
  later: 'bg-slate-200 dark:bg-white/15',
  open: 'bg-slate-200 dark:bg-white/15',
};

function Needle({ now }) {
  return (
    <li aria-hidden="true" className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-2.5 px-2 py-0.5">
      <span className="num rounded-[5px] bg-brand-600 py-[3px] text-center text-[11px] font-semibold text-white">
        {hhmmOf(now.getHours() * 60 + now.getMinutes())}
      </span>
      <span className="relative h-0.5 rounded bg-brand-600">
        <span className="absolute -top-[3px] left-[7px] size-2 rounded-full bg-brand-600" />
        <span className="absolute -top-4 right-0 text-[10px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300">agora</span>
      </span>
    </li>
  );
}

function RoutineRow({ row, now, busy, editing, draft, onDraft, onCheck, onUndo, onSave, onClose }) {
  const { task, mark, doneAt, state } = row;
  const done = DONE.has(state);
  return (
    <li className={cn('grid grid-cols-[44px_22px_minmax(0,1fr)] items-start gap-x-2.5 rounded-xl px-2 py-2', state === 'now' && 'bg-brand-600/[0.07]')}>
      <span
        className={cn(
          'num flex h-[22px] items-center justify-end text-[12.5px] font-semibold',
          state === 'now' ? 'text-brand-600 dark:text-brand-300' : state === 'late' ? 'text-rose-600 dark:text-rose-300' : 'text-muted-foreground',
        )}
      >
        {task.time ?? <Repeat size={13} />}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => (mark ? onUndo(row) : onCheck(row))}
        aria-pressed={!!mark}
        aria-label={`${mark ? 'Desmarcar' : 'Marcar como feita'}: ${task.title}`}
        className={cn('relative z-10 grid size-[22px] place-items-center rounded-full border-2 transition disabled:opacity-60', CHECK_TONE[state])}
      >
        {done && <Check size={12} strokeWidth={3.2} />}
      </button>
      <div className="min-w-0">
        <p className={cn('text-[13px] font-medium leading-snug', done && 'text-muted-foreground')}>{task.title}</p>
        <p className={cn('mt-0.5 text-[11.5px]', META_TONE[state])}>{stateText(task, state, doneAt ?? now, now)}</p>
        {task.how && !done && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{task.how}</p>}
        {editing ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <input
              autoFocus
              value={draft}
              maxLength={NOTE_MAX}
              placeholder="Observação (opcional)"
              aria-label={`Observação sobre ${task.title}`}
              onChange={(e) => onDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSave(mark.id);
                if (e.key === 'Escape') onClose(mark.id);
              }}
              className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-card px-2.5 text-[12.5px] placeholder:text-muted-foreground"
            />
            <button type="button" onClick={() => onSave(mark.id)} className="h-8 rounded-lg bg-foreground px-3 text-[12px] font-medium text-background">
              Salvar
            </button>
            <button type="button" onClick={() => onUndo(row)} className="px-1 text-[11.5px] text-muted-foreground underline underline-offset-2">
              Desfazer
            </button>
          </div>
        ) : mark?.note ? (
          <p className="mt-1.5 inline-flex items-start gap-1.5 rounded-md bg-muted px-2 py-1 text-[11.5px]">
            <MessageSquare size={12} className="mt-0.5 shrink-0 text-muted-foreground" />
            {mark.note}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function RoutineCard({ db, appUser, enabled, now, metaWeekdays }) {
  const toast = useToast();
  const dayKey = routineDayKey(now);
  const { model, marks, loading, error } = useMyRoutine({ db, enabled, userId: appUser?.id, dayKey });
  const [busy, setBusy] = useState(() => new Set()); // tarefas com gravação em andamento
  const [editing, setEditing] = useState(null); // { markId, taskId }: a observação aberta, presa ao check
  const [draft, setDraft] = useState('');

  const tasks = tasksForDay(model, now, metaWeekdays);
  // Enquanto o modelo e os checks do dia não chegam, ou se a leitura falhou, o
  // cartão não aparece: com os checks vazios, o toque marcaria de novo uma
  // tarefa já feita.
  if (loading || error || !model || tasks.length === 0) return null;

  const rows = tasks.map((task) => {
    const mark = marks.get(task.id) || null;
    // Check ainda sem a hora do servidor conta como agora; check cuja hora
    // não cai no dia não conta (markDoneAt), mas pode ser desfeito.
    const doneAt = mark ? (mark.doneAt ? markDoneAt(mark, dayKey) : now) : null;
    return { task, mark, doneAt, state: taskStateAt(task, doneAt, now) };
  });
  const doneCount = rows.filter((r) => DONE.has(r.state)).length;
  const timed = rows.filter((r) => minutesOf(r.task.time) != null);
  const free = rows.filter((r) => minutesOf(r.task.time) == null);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const needleAt = timed.findIndex((r) => minutesOf(r.task.time) > nowMinutes);
  // A observação só existe enquanto o check dela existe na tela: o de ontem, o
  // que sumiu e o que ainda não chegou do Firestore não abrem nada.
  const openMarkId = rows.find((r) => r.mark && r.mark.id === editing?.markId)?.mark.id ?? null;

  const setBusyFor = (taskId, on) =>
    setBusy((current) => {
      const next = new Set(current);
      if (on) next.add(taskId); else next.delete(taskId);
      return next;
    });
  const closeEditorOf = (markId) => setEditing((e) => (e?.markId === markId ? null : e));

  // Quem chama já fechou a observação; aqui só grava, e só texto que existe.
  const persistNote = async (markId, text) => {
    if (!text.trim()) return;
    try {
      await saveMarkNote({ db, markId, note: text });
    } catch (err) {
      console.error('rotina: observação falhou', err);
      toast.error('Não deu para salvar a observação. Tente de novo.');
    }
  };

  // O id do check é fixo (consultor, dia e tarefa), então a observação abre no
  // toque, sem esperar a gravação. Ela só aparece quando o check chega.
  const check = async ({ task }) => {
    if (busy.has(task.id)) return;
    const markId = markIdOf(appUser.id, dayKey, task.id);
    if (openMarkId && openMarkId !== markId) persistNote(openMarkId, draft);
    setEditing({ markId, taskId: task.id });
    setDraft('');
    setBusyFor(task.id, true);
    try {
      await markDone({ db, appUser, model, task });
    } catch (err) {
      console.error('rotina: check falhou', err);
      closeEditorOf(markId);
      toast.error('Não deu para marcar a tarefa. Tente de novo.');
    } finally {
      setBusyFor(task.id, false);
    }
  };

  const undo = async ({ task, mark }) => {
    if (busy.has(task.id)) return;
    setBusyFor(task.id, true);
    try {
      await undoMark({ db, markId: mark.id });
      closeEditorOf(mark.id);
    } catch (err) {
      console.error('rotina: desfazer falhou', err);
      toast.error('Não deu para desfazer. Tente de novo.');
    } finally {
      setBusyFor(task.id, false);
    }
  };

  const saveNote = (markId) => {
    closeEditorOf(markId);
    return persistNote(markId, draft);
  };

  const rowEl = (row) => (
    <RoutineRow
      key={row.task.id}
      row={row}
      now={now}
      busy={busy.has(row.task.id)}
      editing={!!row.mark && editing?.markId === row.mark.id}
      draft={draft}
      onDraft={setDraft}
      onCheck={check}
      onUndo={undo}
      onSave={saveNote}
      onClose={closeEditorOf}
    />
  );

  return (
    <section aria-label="Rotina de hoje" className="rounded-2xl border border-border bg-card shadow-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-brand-600/10 text-brand-600 dark:text-brand-300">
          <ListChecks size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13.5px] font-semibold">Rotina de hoje</h3>
          <p className="truncate text-[11px] text-muted-foreground">Montada pelo gestor. Não conta na sua meta.</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="num text-[12px] text-muted-foreground">
            <b className="text-[15px] font-semibold text-foreground">{doneCount}</b> de {rows.length}
          </p>
          <div className="mt-1 flex justify-end gap-[3px]" aria-hidden="true">
            {rows.map((r) => <span key={r.task.id} className={cn('h-1 w-2.5 rounded-sm', SEG_TONE[r.state])} />)}
          </div>
        </div>
      </div>

      {timed.length > 0 && (
        <ol className="relative p-2">
          <span aria-hidden="true" className="absolute bottom-6 left-[80px] top-6 w-0.5 rounded bg-border" />
          {timed.flatMap((row, i) => (i === needleAt ? [<Needle key="agora" now={now} />, rowEl(row)] : [rowEl(row)]))}
          {needleAt === -1 && <Needle now={now} />}
        </ol>
      )}

      {free.length > 0 && (
        <div className="mx-2.5 border-t border-dashed border-border pb-1 pt-2">
          <p className="px-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Sem horário</p>
          <ol className="p-1">{free.map(rowEl)}</ol>
        </div>
      )}
    </section>
  );
}
