import { useId, useRef, useState } from 'react';
import { ArrowLeft, Clock, Copy, Pencil, Plus, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '../../contexts/ToastContext.jsx';
import { MODEL_NAME_MAX, daysText, firstName, modelNameProblem, modelOfUser, namesText } from '../../lib/rotinas.js';
import { gapText, modelChips, modelDayRows, modelFreeTasks, modelPausedTasks } from '../../lib/rotinasTela.js';
import { MODEL_GONE, deleteModel, duplicateModel, setPersonModel, updateModel } from '../../lib/rotinasWrites.js';
import { FieldError } from './FormBits.jsx';
import { PersonInitials } from './PersonInitials.jsx';
import { RoutinePreview } from './RoutinePreview.jsx';
import { TaskSheet } from './TaskSheet.jsx';

// Dentro de um modelo (spec 2026-10-06, "Dentro de um modelo"; mockup
// 2026-10-08-rotinas-intro-e-polimento.html, Página B · Linha do dia): o dia
// do modelo numa linha que desce, com os vãos de 90 minutos ou mais
// (modelDayRows), as tarefas sem horário em quadrinhos, as pausadas no fim, e
// ao lado quem segue, a prévia da Meta diária e o aviso.

// O lápis de editar aparece ao passar o mouse na linha ou no foco do teclado
// (o grupo tem um :focus-visible dentro). No toque (pointer-coarse) fica
// sempre à vista, porque ali não existe hover.
const EDIT_REVEAL = 'opacity-0 transition-opacity group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 pointer-coarse:opacity-100';
const SECTION_LABEL = 'text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground';

function EditButton({ task, onEdit, className }) {
  return (
    <button
      type="button"
      aria-label={`Editar ${task.title}`}
      onClick={(e) => onEdit(task, e.currentTarget)}
      className={cn('grid size-[30px] shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground', EDIT_REVEAL, className)}
    >
      <Pencil aria-hidden="true" className="size-4" />
    </button>
  );
}

// Uma tarefa com horário na linha do dia, ou uma pausada no grupo do fim (com
// o pino cinza, o nome apagado e o selo, o mesmo tratamento de antes).
function DayRow({ task, onEdit }) {
  const paused = task.active === false;
  return (
    <li className="group grid grid-cols-[62px_22px_minmax(0,1fr)_auto] items-start gap-3 rounded-[10px] py-[9px] pl-2.5 pr-3.5 hover:bg-muted/60">
      <span className={cn('num pt-px text-right text-[13px] font-semibold leading-[1.6]', paused && 'text-muted-foreground')}>
        {task.time ?? <Repeat aria-label="Sem horário" className="ml-auto mt-1 size-[13px]" />}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'relative z-10 ml-[5px] mt-[5px] size-3 rounded-full border-[2.5px] bg-card dark:bg-[#0c1126]',
          paused ? 'border-slate-300 dark:border-white/20' : 'border-brand-600',
        )}
      />
      <div className="min-w-0">
        <p className={cn('text-[13.5px] font-semibold', paused && 'text-muted-foreground')}>{task.title}</p>
        {task.how && <p className="mt-0.5 text-[12px] text-muted-foreground">{task.how}</p>}
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex h-[22px] items-center rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground">{daysText(task.days)}</span>
          {paused && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold">Pausada</span>}
        </p>
      </div>
      <EditButton task={task} onEdit={onEdit} />
    </li>
  );
}

function GapRow({ minutes }) {
  return (
    <li className="grid grid-cols-[62px_22px_minmax(0,1fr)] gap-3 py-0.5 pl-2.5 pr-3.5 text-[11px] italic text-muted-foreground">
      <span />
      <span />
      <span>{gapText(minutes)}</span>
    </li>
  );
}

function AnyTimeTile({ task, onEdit }) {
  return (
    <li className="group relative rounded-xl border border-border bg-muted/50 py-[11px] pl-3 pr-10">
      <p className="text-[13px] font-semibold">{task.title}</p>
      {task.how && <p className="mt-[3px] text-[11.5px] text-muted-foreground">{task.how}</p>}
      <p className="mt-1.5 text-[11px] text-muted-foreground">{daysText(task.days)}</p>
      <EditButton task={task} onEdit={onEdit} className="absolute right-1.5 top-1.5" />
    </li>
  );
}

export function ModelDetail({ db, appUser, model, models, people, startRenaming = false, onBack, onDeleted, onDuplicated }) {
  const toast = useToast();
  const [renaming, setRenaming] = useState(startRenaming);
  const [nameDraft, setNameDraft] = useState(model.name);
  const [nameError, setNameError] = useState(null);
  const nameErrorId = useId();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sheet, setSheet] = useState(null); // { key, task }
  // Renomear, duplicar e excluir: uma gravação de cada vez. O estado desliga
  // os botões; a ref barra o segundo clique que chega antes do render, que
  // criaria dois modelos com o mesmo nome e empilharia duas entradas.
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  // O foco volta para quem abriu o painel (Nova tarefa ou o lápis da linha).
  // Sem SheetTrigger, o Radix o mandaria para o <body>.
  const openerRef = useRef(null);
  const newTaskRef = useRef(null);
  const followers = people.filter((p) => (model.followerIds || []).includes(p.id));
  const others = people.filter((p) => !(model.followerIds || []).includes(p.id));
  const activeCount = (model.tasks || []).filter((t) => t.active !== false).length;
  const dayRows = modelDayRows(model);
  const timedCount = dayRows.filter((r) => r.kind === 'task').length;
  const free = modelFreeTasks(model);
  const paused = modelPausedTasks(model);
  const chips = modelChips(model);

  const run = async (fn, ok, fail) => {
    try {
      await fn();
      if (ok) toast.success(ok);
      return true;
    } catch (err) {
      console.error('rotinas:', err);
      toast.error(err?.code === MODEL_GONE ? 'Esse modelo foi excluído.' : fail);
      return false;
    }
  };

  const guarded = async (fn) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const startRename = () => {
    setNameDraft(model.name);
    setNameError(null);
    setRenaming(true);
  };
  const cancelRename = () => {
    setRenaming(false);
    setNameDraft(model.name);
    setNameError(null);
  };

  const saveName = () => guarded(async () => {
    const problem = modelNameProblem(nameDraft, models, model.id);
    setNameError(problem);
    if (problem) return;
    const ok = await run(() => updateModel({ db, appUser, modelId: model.id, edit: () => ({ name: nameDraft.trim() }) }), 'Nome salvo.', 'Não deu para salvar o nome. Tente de novo.');
    if (ok) setRenaming(false);
  });

  const duplicate = () => guarded(async () => {
    try {
      const id = await duplicateModel({ db, appUser, models, source: model });
      toast.success('Modelo duplicado. Dê um nome e escolha quem segue.');
      onDuplicated(id);
    } catch (err) {
      console.error('rotinas: duplicar falhou', err);
      toast.error(err?.code === MODEL_GONE ? 'Esse modelo foi excluído.' : 'Não deu para duplicar o modelo. Tente de novo.');
    }
  });

  const remove = () => guarded(async () => {
    const ok = await run(() => deleteModel({ db, appUser, modelId: model.id }), 'Modelo excluído. O histórico continua com ele.', 'Não deu para excluir o modelo. Tente de novo.');
    if (ok) onDeleted();
  });

  const unfollow = (p) => run(
    () => setPersonModel({ db, appUser, models, userId: p.id, modelId: null }),
    `${firstName(p.name)} ficou sem modelo.`,
    'Não deu para tirar a pessoa do modelo. Tente de novo.',
  );

  const follow = (pid) => {
    const p = people.find((x) => x.id === pid);
    if (!p) return;
    run(
      () => setPersonModel({ db, appUser, models, userId: pid, modelId: model.id }),
      `${firstName(p.name)} agora segue o modelo ${model.name}.`,
      'Não deu para pôr a pessoa no modelo. Tente de novo.',
    );
  };

  const openTask = (task, opener) => {
    openerRef.current = opener ?? null;
    setSheet({ key: `${task?.id ?? 'nova'}-${Date.now()}`, task });
  };
  // A tarefa excluída leva junto o lápis que abriu o painel: o foco vai para
  // o Nova tarefa.
  const taskRemoved = () => { openerRef.current = newTaskRef.current; };
  const restoreFocus = (event) => {
    event.preventDefault();
    const target = openerRef.current?.isConnected ? openerRef.current : newTaskRef.current;
    if (target?.isConnected) target.focus();
  };

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      {/* O mesmo Voltar da ficha: volta para a lista de modelos. */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-8 items-center gap-1.5 self-start whitespace-nowrap rounded-lg px-2.5 text-[12.5px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft size={14} /> Voltar
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        {renaming ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                autoFocus
                value={nameDraft}
                maxLength={MODEL_NAME_MAX}
                aria-label="Nome do modelo"
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? nameErrorId : undefined}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName();
                  if (e.key === 'Escape') cancelRename();
                }}
                className="h-11 min-w-[280px] font-display text-[22px] font-semibold"
              />
              <button type="button" disabled={busy} onClick={saveName} className="h-[38px] rounded-[10px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white disabled:opacity-60">Salvar nome</button>
              <button type="button" disabled={busy} onClick={cancelRename} className="h-[38px] rounded-[10px] border border-border bg-card px-3.5 text-[13px] font-medium disabled:opacity-60">Cancelar</button>
            </div>
            <FieldError id={nameErrorId}>{nameError}</FieldError>
          </div>
        ) : (
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 font-display text-[28px] font-semibold leading-tight tracking-tight">
              <span className="min-w-0 break-words">{model.name}</span>
              <button
                type="button"
                aria-label="Renomear"
                disabled={busy}
                onClick={startRename}
                className="grid size-[30px] shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
              >
                <Pencil aria-hidden="true" className="size-4" />
              </button>
            </h1>
            {chips.length > 0 && (
              <p className="mt-1.5 flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <span key={c} className="num inline-flex h-[22px] items-center rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground">{c}</span>
                ))}
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          <button type="button" disabled={busy} onClick={duplicate} className="inline-flex h-[38px] items-center gap-1.5 rounded-[10px] border border-border bg-card px-3.5 text-[13px] font-medium disabled:opacity-60">
            <Copy size={15} /> Duplicar
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)} className="h-[38px] rounded-[10px] px-2.5 text-[13px] font-medium text-rose-600 hover:bg-rose-500/10 disabled:opacity-60 dark:text-rose-300">
            Excluir
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-destructive/10 px-3.5 py-3 text-[13px]">
          <span>
            {followers.length
              ? `${namesText(followers.map((p) => firstName(p.name)))} ${followers.length === 1 ? 'fica' : 'ficam'} sem rotina até você escolher outro modelo.`
              : 'Ninguém segue este modelo.'}{' '}
            O histórico dos dias anteriores continua.
          </span>
          <span className="flex gap-1.5">
            <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)} className="h-[34px] rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-medium disabled:opacity-60">Cancelar</button>
            <button type="button" disabled={busy} onClick={remove} className="h-[34px] rounded-[9px] bg-rose-600 px-3 text-[12.5px] font-medium text-white disabled:opacity-60">Excluir modelo</button>
          </span>
        </div>
      )}

      <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_310px]">
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between gap-2.5 border-b border-border py-3 pl-4 pr-3.5">
            <h2 className="flex items-center gap-2 font-display text-[14px] font-semibold">
              O dia do modelo <span className="num rounded-md bg-muted px-[7px] py-[3px] font-sans text-[11px] text-muted-foreground">{activeCount}</span>
            </h2>
            <button type="button" ref={newTaskRef} onClick={(e) => openTask(null, e.currentTarget)} className="inline-flex h-[38px] items-center gap-2 rounded-[10px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white">
              <Plus size={15} /> Nova tarefa
            </button>
          </div>
          {(model.tasks || []).length === 0 && <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">Este modelo ainda não tem tarefa. Crie a primeira.</p>}
          {dayRows.length > 0 && (
            <div className="relative pb-1 pt-1.5">
              {/* A linha que desce, do primeiro ao último pino. Fica fora da
                  lista: <ol> só aceita <li>. */}
              {timedCount > 1 && <span aria-hidden="true" className="absolute bottom-[26px] left-[94px] top-[22px] w-0.5 rounded bg-gradient-to-b from-brand-600 to-brand-600/25" />}
              <ol>
                {dayRows.map((row) => (row.kind === 'gap'
                  ? <GapRow key={row.key} minutes={row.minutes} />
                  : <DayRow key={row.key} task={row.task} onEdit={openTask} />))}
              </ol>
            </div>
          )}
          {free.length > 0 && (
            <div className="mt-1.5 border-t border-border px-3.5 pb-3.5 pt-3">
              <h3 className={SECTION_LABEL}>A qualquer hora do dia</h3>
              <ul className="mt-2.5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {free.map((t) => <AnyTimeTile key={t.id} task={t} onEdit={openTask} />)}
              </ul>
            </div>
          )}
          {paused.length > 0 && (
            <div className="border-t border-dashed border-border pb-1.5 pt-2.5">
              <h3 className={cn(SECTION_LABEL, 'px-4')}>Pausadas</h3>
              <ol className="mt-1">{paused.map((t) => <DayRow key={t.id} task={t} onEdit={openTask} />)}</ol>
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-3">
          <section className="rounded-2xl border border-border bg-card px-4 py-3.5 shadow-card">
            <h2 className="flex items-center gap-2 font-display text-[14px] font-semibold">
              Quem segue <span className="num rounded-md bg-muted px-[7px] py-[3px] font-sans text-[11px] text-muted-foreground">{followers.length}</span>
            </h2>
            {followers.length === 0 && <p className="mt-2.5 text-[12px] text-muted-foreground">Ninguém segue este modelo ainda.</p>}
            {followers.map((p) => (
              <div key={p.id} className="mt-2.5 flex items-center gap-2.5 text-[13px]">
                <PersonInitials name={p.name} size={26} />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <button type="button" aria-label={`Tirar ${p.name} do modelo`} onClick={() => unfollow(p)} className="text-[12px] text-muted-foreground hover:text-rose-600 dark:hover:text-rose-300">Tirar</button>
              </div>
            ))}
            {others.length > 0 && (
              <Select value="" onValueChange={follow}>
                <SelectTrigger aria-label="Pôr um consultor neste modelo" className="mt-3 h-9 w-full">
                  <SelectValue placeholder="Pôr um consultor neste modelo" />
                </SelectTrigger>
                <SelectContent>
                  {others.map((p) => {
                    const current = modelOfUser(models, p.id);
                    return <SelectItem key={p.id} value={p.id}>{p.name} {current ? `(sai do ${current.name})` : '(sem modelo)'}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            )}
          </section>
          <RoutinePreview model={model} />
          <p className="flex gap-2.5 rounded-xl border border-dashed border-border px-3.5 py-3 text-[12px] text-muted-foreground">
            <Clock aria-hidden="true" className="mt-px size-4 shrink-0" />
            O que você muda aqui vale a partir de hoje. Os dias anteriores continuam como estavam.
          </p>
        </aside>
      </div>

      {sheet && (
        <TaskSheet
          key={sheet.key}
          open
          onOpenChange={(open) => { if (!open) setSheet(null); }}
          onCloseAutoFocus={restoreFocus}
          onTaskRemoved={taskRemoved}
          db={db}
          appUser={appUser}
          model={model}
          followers={followers}
          task={sheet.task}
        />
      )}
    </div>
  );
}
