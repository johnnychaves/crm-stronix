import { useId, useRef, useState } from 'react';
import { Copy, Info, Plus, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '../../contexts/ToastContext.jsx';
import { MODEL_NAME_MAX, byTime, daysText, firstName, minutesOf, modelNameProblem, modelOfUser, namesText } from '../../lib/rotinas.js';
import { MODEL_GONE, deleteModel, duplicateModel, setPersonModel, updateModel } from '../../lib/rotinasWrites.js';
import { FieldError } from './FormBits.jsx';
import { TaskSheet } from './TaskSheet.jsx';

function TaskRow({ task, onEdit }) {
  const paused = task.active === false;
  return (
    <li className="grid grid-cols-[46px_14px_minmax(0,1fr)_auto] items-start gap-x-2.5 rounded-xl px-2 py-2.5 hover:bg-muted/50">
      <span className="num flex justify-end text-[13px] font-semibold leading-[18px] text-muted-foreground">
        {task.time ?? <Repeat size={13} aria-label="Sem horário" />}
      </span>
      <span className={cn('relative z-10 mt-0.5 size-3.5 rounded-full border-2 bg-card', paused ? 'border-slate-300 dark:border-white/20' : 'border-brand-600')} />
      <div className="min-w-0">
        <p className={cn('text-[13.5px] font-medium', paused && 'text-muted-foreground')}>{task.title}</p>
        {task.how && <p className="mt-0.5 text-[12px] text-muted-foreground">{task.how}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
          {daysText(task.days)}
          {paused && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold">Pausada</span>}
        </p>
      </div>
      <button type="button" aria-label={`Editar ${task.title}`} onClick={(e) => onEdit(task, e.currentTarget)} className="h-[34px] rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-medium">
        Editar
      </button>
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
  // O foco volta para quem abriu o painel (Nova tarefa ou o Editar da linha).
  // Sem SheetTrigger, o Radix o mandaria para o <body>.
  const openerRef = useRef(null);
  const newTaskRef = useRef(null);
  const followers = people.filter((p) => (model.followerIds || []).includes(p.id));
  const others = people.filter((p) => !(model.followerIds || []).includes(p.id));
  const tasks = [...(model.tasks || [])].sort((a, b) => (Number(b.active !== false) - Number(a.active !== false)) || byTime(a, b));
  const timed = tasks.filter((t) => minutesOf(t.time) != null);
  const free = tasks.filter((t) => minutesOf(t.time) == null);

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
  // A tarefa excluída leva junto o Editar que abriu o painel: o foco vai para
  // o Nova tarefa.
  const taskRemoved = () => { openerRef.current = newTaskRef.current; };
  const restoreFocus = (event) => {
    event.preventDefault();
    const target = openerRef.current?.isConnected ? openerRef.current : newTaskRef.current;
    if (target?.isConnected) target.focus();
  };
  const taskList = (list) => (
    <ol className="relative p-2.5">
      {list.map((t) => <TaskRow key={t.id} task={t} onEdit={openTask} />)}
    </ol>
  );

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
        <button type="button" onClick={onBack} className="font-medium text-brand-600">Modelos</button>
        <span>/</span>
        <span className="truncate">{model.name}</span>
      </p>

      <div className="flex flex-wrap items-end justify-between gap-3.5">
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
          <h1 className="flex items-center gap-2.5 font-display text-[28px] font-semibold tracking-tight">
            {model.name}
            <button type="button" disabled={busy} onClick={startRename} className="font-sans text-[12px] font-medium text-muted-foreground underline underline-offset-[3px]">Renomear</button>
          </h1>
        )}
        <div className="flex flex-wrap gap-1.5">
          <button type="button" disabled={busy} onClick={duplicate} className="inline-flex h-[34px] items-center gap-1.5 rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-medium disabled:opacity-60">
            <Copy size={14} /> Duplicar modelo
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)} className="h-[34px] rounded-[9px] px-3 text-[12.5px] font-medium text-rose-600 disabled:opacity-60 dark:text-rose-300">
            Excluir modelo
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

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-2xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between gap-2.5 border-b border-border px-4 py-3.5">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold">
              Tarefas
              <span className="num rounded-md bg-muted px-1.5 text-[11px] text-muted-foreground">{tasks.filter((t) => t.active !== false).length}</span>
            </h2>
            <button type="button" ref={newTaskRef} onClick={(e) => openTask(null, e.currentTarget)} className="inline-flex h-[38px] items-center gap-2 rounded-[10px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white">
              <Plus size={15} /> Nova tarefa
            </button>
          </div>
          {tasks.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">Este modelo ainda não tem tarefa. Crie a primeira.</p>}
          {timed.length > 0 && taskList(timed)}
          {free.length > 0 && (
            <div className="mx-2.5 border-t border-dashed border-slate-200 pt-1.5 dark:border-white/10">
              <p className="px-2 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Sem horário</p>
              {taskList(free)}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-3">
          <section className="rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border px-4 py-3.5">
              <h2 className="text-[14px] font-semibold">Quem segue <span className="num ml-1 rounded-md bg-muted px-1.5 text-[11px] text-muted-foreground">{followers.length}</span></h2>
            </div>
            <div className="flex flex-col gap-2 px-4 py-3">
              {followers.length === 0 && <p className="text-[11.5px] text-muted-foreground">Ninguém segue este modelo ainda.</p>}
              {followers.map((p) => (
                <div key={p.id} className="flex items-center gap-2.5 text-[13px]">
                  <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                  <button type="button" aria-label={`Tirar ${p.name} do modelo`} onClick={() => unfollow(p)} className="text-[12px] text-muted-foreground underline underline-offset-2">Tirar</button>
                </div>
              ))}
              {others.length > 0 && (
                <Select value="" onValueChange={follow}>
                  <SelectTrigger aria-label="Pôr um consultor neste modelo" className="mt-1.5 h-9 w-full">
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
            </div>
          </section>
          <p className="flex gap-2 rounded-[10px] bg-brand-600/[0.08] px-3 py-2.5 text-[12px]">
            <Info size={15} className="mt-px shrink-0 text-brand-600" />
            O que você muda aqui vale a partir de hoje para quem segue o modelo. Os dias anteriores continuam como estavam no histórico.
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
