import { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '../../contexts/ToastContext.jsx';
import { MODEL_NAME_MAX, modelNameProblem, modelOfUser } from '../../lib/rotinas.js';
import { MODEL_GONE, createModel } from '../../lib/rotinasWrites.js';
import { FieldError, Segmented } from './FormBits.jsx';

// Painel Novo modelo. O pai monta com key nova a cada abertura.
export function NewModelSheet({ open, onOpenChange, db, appUser, models, people, onCreated }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [start, setStart] = useState('blank');
  const [copyFrom, setCopyFrom] = useState(models[0]?.id ?? null);
  const [followerIds, setFollowerIds] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const toggle = (id, checked) => setFollowerIds((ids) => (checked ? [...ids, id] : ids.filter((x) => x !== id)));

  const save = async () => {
    const problem = modelNameProblem(name, models);
    setError(problem);
    if (problem) return;
    setSaving(true);
    try {
      const id = await createModel({ db, appUser, models, name, copyFrom: start === 'copy' ? copyFrom : null, followerIds });
      toast.success('Modelo criado.');
      onOpenChange(false);
      onCreated(id);
    } catch (err) {
      console.error('rotinas: criar modelo falhou', err);
      toast.error(err?.code === MODEL_GONE ? 'O modelo que você quis copiar foi excluído.' : 'Não deu para criar o modelo. Tente de novo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[460px]">
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="font-display text-[19px]">Novo modelo</SheetTitle>
          <SheetDescription>Depois de criar, você põe as tarefas dentro dele.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold">Nome do modelo</span>
            <Input
              autoFocus
              value={name}
              maxLength={MODEL_NAME_MAX}
              placeholder="Ex.: Consultor do fim de semana"
              aria-invalid={Boolean(error)}
              onChange={(e) => setName(e.target.value)}
            />
            <FieldError>{error}</FieldError>
          </label>

          {models.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[12.5px] font-semibold">Começar</span>
              <Segmented
                label="Começar"
                value={start}
                onChange={setStart}
                options={[{ value: 'blank', label: 'Em branco' }, { value: 'copy', label: 'Cópia de um modelo' }]}
              />
              {start === 'copy' && (
                <>
                  <Select value={copyFrom ?? undefined} onValueChange={setCopyFrom}>
                    <SelectTrigger aria-label="Modelo para copiar" className="h-9 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name} ({(m.tasks || []).length} tarefas)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11.5px] text-muted-foreground">As tarefas são copiadas. Mudar a cópia não mexe no original.</p>
                </>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] font-semibold">Quem segue <span className="font-normal text-muted-foreground">(opcional, dá para escolher depois)</span></span>
            {people.length === 0 && <p className="text-[12.5px] text-muted-foreground">Nenhum consultor na equipe ainda.</p>}
            {people.map((p) => {
              const current = modelOfUser(models, p.id);
              return (
                <label key={p.id} className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-border px-3 py-2 text-[13px]">
                  <Checkbox checked={followerIds.includes(p.id)} onCheckedChange={(v) => toggle(p.id, v === true)} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="text-[11.5px] text-muted-foreground">{current ? `sai do ${current.name}` : 'sem modelo'}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">
          <button type="button" onClick={() => onOpenChange(false)} className="h-[38px] rounded-[10px] border border-border bg-card px-3.5 text-[13px] font-medium">
            Cancelar
          </button>
          <button type="button" disabled={saving} onClick={save} className="h-[38px] rounded-[10px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white disabled:opacity-60">
            Criar modelo
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
