import { useRef, useState } from 'react';
import { Check, ListChecks, MessageSquare, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useMyRoutine } from '../../hooks/useMyRoutine.js';
import { NOTE_MAX, hhmmOf, markDoneAt, markIdOf, minutesOf, routineDayKey, stateText, taskStateAt, tasksForDay } from '../../lib/rotinas.js';
import { markDone, saveMarkNote, undoMark } from '../../lib/rotinasWrites.js';
import { CHECK_TONE, META_TONE, SEG_TONE } from '../rotinas/routineTones.js';

// Cartão "Rotina de hoje" da Meta diária (spec
// docs/superpowers/specs/2026-10-06-rotinas-dos-consultores-design.md, mockup
// 2026-10-06-rotina-na-meta-diaria.html, opção A). Fica fora da conta da Meta:
// não entra no ProgressHero, nos filtros da lista nem no dia batido.

const DONE = new Set(['done', 'doneLate']);

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

function RoutineRow({ row, now, busy, editing, draft, onDraft, onToggle, onUndo, onSave, onClose }) {
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
      {/* Botão de alternar: o nome fica fixo e o aria-pressed diz se a tarefa
          conta como feita, o mesmo estado do círculo. */}
      <button
        type="button"
        disabled={busy}
        onClick={() => onToggle(row)}
        aria-pressed={done}
        aria-label={`Feita: ${task.title}`}
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
            <button
              type="button"
              disabled={busy}
              onClick={() => onUndo(row)}
              className="px-1 text-[11.5px] text-muted-foreground underline underline-offset-2 disabled:opacity-60"
            >
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
  const [busy, setBusy] = useState(() => new Set()); // tarefas com gravação em andamento, para o desenho
  // A mesma lista, para barrar o segundo toque que chega antes de o círculo
  // desligar no render seguinte.
  const busyRef = useRef(new Set());
  const [editing, setEditing] = useState(null); // { markId, taskId }: a observação aberta, presa ao check
  const [draft, setDraft] = useState('');

  const tasks = tasksForDay(model, now, metaWeekdays);
  // Enquanto o modelo e os checks do dia não chegam, ou se a leitura falhou, o
  // cartão não aparece: com os checks vazios, o toque marcaria de novo uma
  // tarefa já feita.
  if (loading || error || !model || tasks.length === 0) return null;

  const rows = tasks.map((task) => {
    const mark = marks.get(task.id) || null;
    // Check ainda sem a hora do servidor conta como agora. Check cuja hora não
    // cai no dia dele não conta (markDoneAt): o círculo mostra a tarefa por
    // fazer, e o toque refaz o check (redo).
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
  // Cada tarefa grava uma coisa de cada vez. Quem pega a tarefa solta no fim,
  // inclusive no refazer, que segura a tarefa nas duas gravações.
  const claim = (taskId) => {
    if (busyRef.current.has(taskId)) return false;
    busyRef.current.add(taskId);
    setBusyFor(taskId, true);
    return true;
  };
  const release = (taskId) => {
    busyRef.current.delete(taskId);
    setBusyFor(taskId, false);
  };
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
  //
  // O instante é um só por toque: o `now` do cartão só anda a cada minuto, e
  // perto da meia-noite ele pode estar no dia de ontem enquanto a gravação, que
  // usava a hora dela, caía no dia de hoje. O id da observação e o do check
  // gravado saem do mesmo `at`. Se a lista ainda está no dia anterior, o check
  // novo e a observação aparecem quando o relógio do cartão passa para o dia
  // novo, no próximo minuto.
  //
  // Quem chama já pegou a tarefa (claim). `dropped` é o check que o refazer
  // acabou de apagar: a observação aberta nele não é gravada.
  const writeCheck = async (task, dropped = null) => {
    const at = new Date();
    const markId = markIdOf(appUser.id, routineDayKey(at), task.id);
    if (openMarkId && openMarkId !== markId && openMarkId !== dropped) persistNote(openMarkId, draft);
    setEditing({ markId, taskId: task.id });
    setDraft('');
    try {
      await markDone({ db, appUser, model, task, now: at });
    } catch (err) {
      console.error('rotina: check falhou', err);
      closeEditorOf(markId);
      toast.error('Não deu para marcar a tarefa. Tente de novo.');
    }
  };

  const check = async ({ task }) => {
    if (!claim(task.id)) return;
    try {
      await writeCheck(task);
    } finally {
      release(task.id);
    }
  };

  // O check que existe e não conta, porque a hora dele caiu fora do dia dele
  // (relógio do aparelho adiantado ou atrasado perto da meia-noite), aparece
  // como tarefa por fazer, e o toque o refaz: apaga e grava de novo, com um
  // instante novo, como no toque comum. As regras só deixam apagar até 24
  // horas depois do check. Se o apagar for recusado, nada mais é gravado e o
  // cartão continua como estava.
  const redo = async ({ task, mark }) => {
    if (!claim(task.id)) return;
    try {
      try {
        await undoMark({ db, markId: mark.id });
      } catch (err) {
        console.error('rotina: refazer o check falhou', err);
        toast.error('Não deu para refazer o check desta tarefa.');
        return;
      }
      closeEditorOf(mark.id);
      await writeCheck(task, mark.id);
    } finally {
      release(task.id);
    }
  };

  const undo = async ({ task, mark }) => {
    if (!claim(task.id)) return;
    try {
      await undoMark({ db, markId: mark.id });
      closeEditorOf(mark.id);
    } catch (err) {
      console.error('rotina: desfazer falhou', err);
      toast.error('Não deu para desfazer. Tente de novo.');
    } finally {
      release(task.id);
    }
  };

  // O círculo segue o estado que conta: feita desfaz, check que não conta é
  // refeito e tarefa sem check é marcada.
  const toggle = (row) => {
    if (DONE.has(row.state)) return undo(row);
    if (row.mark) return redo(row);
    return check(row);
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
      onToggle={toggle}
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
