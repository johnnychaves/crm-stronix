import { useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { useToast } from '../../contexts/ToastContext.jsx';
import {
  ALL_DAYS, MAX_TASKS_PER_MODEL, ROUTINE_ON_TIME_MINUTES, TASK_HOW_MAX, TASK_TITLE_MAX, firstName, namesText,
  newTaskId, normalizeTask, removeTask, taskProblems, upsertTask,
} from '../../lib/rotinas.js';
import { MODEL_GONE, TASK_GONE, TASK_LIMIT, taskGone, taskLimit, updateModel } from '../../lib/rotinasWrites.js';
import { DayChips, FieldError, Segmented } from './FormBits.jsx';

const initialForm = (task) => ({
  title: task?.title ?? '',
  how: task?.how ?? '',
  daysMode: !task || task.days === ALL_DAYS ? 'all' : 'week',
  days: task && task.days !== ALL_DAYS ? task.days : [1, 2, 3, 4, 5],
  timeMode: task && task.time === null ? 'none' : 'time',
  time: task?.time ?? '09:00',
  active: task?.active !== false,
});

const LIMIT_TEXT = `O modelo já tem ${MAX_TASKS_PER_MODEL} tarefas, o máximo.`;
const hasTask = (m, id) => (m.tasks || []).some((t) => t.id === id);

// Painel Nova tarefa / Editar tarefa. O pai monta com key nova a cada
// abertura, então o formulário sempre começa do que está gravado.
// onCloseAutoFocus vai direto para o SheetContent: é o pai quem sabe para onde
// o foco volta. onTaskRemoved avisa que a tarefa saiu do modelo (excluída
// aqui ou em outra aba), porque aí o botão Editar dela some junto.
export function TaskSheet({ open, onOpenChange, onCloseAutoFocus, onTaskRemoved, db, appUser, model, followers, task }) {
  const toast = useToast();
  const [form, setForm] = useState(() => initialForm(task));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  // O estado só desliga os botões no render seguinte. A ref barra o segundo
  // clique que chega antes disso, que criaria a tarefa duas vezes.
  const savingRef = useRef(false);
  const editing = Boolean(task);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const whoSees = followers.length
    ? `${namesText(followers.map((p) => firstName(p.name)))} ${followers.length === 1 ? 'vê' : 'veem'} a mudança na Meta diária a partir de hoje.`
    : 'Ninguém segue este modelo ainda.';

  const write = async (edit, ok, fail, { removes = false } = {}) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await updateModel({ db, appUser, modelId: model.id, edit });
      toast.success(ok);
      if (removes) onTaskRemoved?.();
      onOpenChange(false);
    } catch (err) {
      if (err?.code === TASK_GONE) {
        toast.error('Essa tarefa foi excluída.');
        onTaskRemoved?.();
        onOpenChange(false);
        return;
      }
      if (err?.code === TASK_LIMIT) {
        toast.error(LIMIT_TEXT);
        return;
      }
      console.error('rotinas: tarefa falhou', err);
      toast.error(err?.code === MODEL_GONE ? 'Esse modelo foi excluído.' : fail);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // Salvar e Pausar/Reativar passam pela mesma conferência e gravam o
  // formulário inteiro: pausar não joga fora o que a pessoa digitou. O modelo
  // que vale é o lido na transação: a tarefa editada precisa continuar nele
  // (senão o upsert a recriaria), e a nova precisa caber no máximo.
  const submit = (active, ok) => {
    const input = {
      title: form.title,
      how: form.how,
      days: form.daysMode === 'all' ? ALL_DAYS : form.days,
      time: form.timeMode === 'none' ? null : form.time,
      active,
    };
    const problems = taskProblems(input);
    if (!editing && (model.tasks || []).length >= MAX_TASKS_PER_MODEL) problems.title = LIMIT_TEXT;
    setErrors(problems);
    if (Object.keys(problems).length) return;
    const next = normalizeTask(input, task?.id ?? newTaskId());
    write((m) => {
      if (editing && !hasTask(m, next.id)) throw taskGone();
      if (!editing && (m.tasks || []).length >= MAX_TASKS_PER_MODEL) throw taskLimit();
      return { tasks: upsertTask(m.tasks, next) };
    }, ok, 'Não deu para salvar a tarefa. Tente de novo.');
  };

  const save = () => submit(form.active, editing ? 'Alterações salvas.' : 'Tarefa criada.');
  const togglePause = () => submit(!form.active, form.active ? 'Tarefa pausada.' : 'Tarefa reativada.');

  const remove = () => write(
    (m) => {
      if (!hasTask(m, task.id)) throw taskGone();
      return { tasks: removeTask(m.tasks, task.id) };
    },
    'Tarefa excluída. O histórico continua com ela.',
    'Não deu para excluir a tarefa. Tente de novo.',
    { removes: true },
  );

  const toggleDay = (d) => set({ days: form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d] });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" onCloseAutoFocus={onCloseAutoFocus} className="flex w-full flex-col gap-0 p-0 sm:max-w-[460px]">
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="font-display text-[19px]">{editing ? 'Editar tarefa' : 'Nova tarefa'}</SheetTitle>
          <SheetDescription>No modelo {model.name}. {whoSees}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold">Nome da tarefa</span>
            <Input
              autoFocus
              value={form.title}
              maxLength={TASK_TITLE_MAX}
              placeholder="Ex.: Conferir a agenda do dia na recepção"
              aria-invalid={Boolean(errors.title)}
              onChange={(e) => set({ title: e.target.value })}
            />
            <FieldError>{errors.title}</FieldError>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold">Como fazer <span className="font-normal text-muted-foreground">(opcional)</span></span>
            <textarea
              value={form.how}
              maxLength={TASK_HOW_MAX}
              rows={3}
              placeholder="O que o consultor precisa saber para fazer do jeito certo."
              onChange={(e) => set({ how: e.target.value })}
              className="min-h-[70px] resize-y rounded-md border border-border bg-card px-3 py-2 text-[13.5px] placeholder:text-muted-foreground"
            />
            <FieldError>{errors.how}</FieldError>
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] font-semibold">Em que dias</span>
            <Segmented
              label="Em que dias"
              value={form.daysMode}
              onChange={(v) => set({ daysMode: v })}
              options={[{ value: 'all', label: 'Todos os dias de trabalho' }, { value: 'week', label: 'Dias da semana' }]}
            />
            {form.daysMode === 'week'
              ? <DayChips days={form.days} onToggle={toggleDay} />
              : <p className="text-[11.5px] text-muted-foreground">Os dias da Meta da academia, definidos em Configurações.</p>}
            <FieldError>{errors.days}</FieldError>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] font-semibold">Horário</span>
            <Segmented
              label="Horário"
              value={form.timeMode}
              onChange={(v) => set({ timeMode: v })}
              options={[{ value: 'time', label: 'Com horário' }, { value: 'none', label: 'Sem horário' }]}
            />
            {form.timeMode === 'time' ? (
              <>
                <Input type="time" value={form.time} aria-label="Horário da tarefa" onChange={(e) => set({ time: e.target.value })} className="w-[120px] font-display font-semibold" />
                <p className="text-[11.5px] text-muted-foreground">Até {ROUTINE_ON_TIME_MINUTES} minutos depois do horário ela aparece como "agora". Depois disso, como atrasada.</p>
              </>
            ) : (
              <p className="text-[11.5px] text-muted-foreground">Vale até o fim do dia.</p>
            )}
            <FieldError>{errors.time}</FieldError>
          </div>

          {editing && (
            <p className="flex gap-2 rounded-[10px] bg-brand-600/[0.08] px-3 py-2.5 text-[12px]">
              <Info size={15} className="mt-px shrink-0 text-brand-600" />
              A mudança vale a partir de hoje. Os dias anteriores continuam como estavam no histórico.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-border px-5 py-3.5">
          {editing && (
            <div className="flex gap-1">
              <button type="button" disabled={saving} onClick={togglePause} className="h-[34px] rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-medium">
                {form.active ? 'Pausar tarefa' : 'Reativar tarefa'}
              </button>
              <button type="button" disabled={saving} onClick={remove} className="h-[34px] rounded-[9px] px-3 text-[12.5px] font-medium text-rose-600 dark:text-rose-300">
                Excluir tarefa
              </button>
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className="h-[38px] rounded-[10px] border border-border bg-card px-3.5 text-[13px] font-medium">
              Cancelar
            </button>
            <button type="button" disabled={saving} onClick={save} className="h-[38px] rounded-[10px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white disabled:opacity-60">
              {editing ? 'Salvar alterações' : 'Criar tarefa'}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
