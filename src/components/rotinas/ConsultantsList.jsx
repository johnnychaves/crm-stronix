import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { firstName, modelOfUser, spanText, tasksForDay } from '../../lib/rotinas.js';
import { MODEL_GONE, setPersonModel } from '../../lib/rotinasWrites.js';
import { AppLink } from '../nav/AppLink.jsx';

const NONE = 'sem-modelo';

// Enquanto os modelos não chegam (loading), a lista não diz quem está sem
// rotina: sem os modelos, todo mundo pareceria sem modelo. modelLink(id) devolve
// o endereço e o state do "Abrir modelo", que é link de verdade.
export function ConsultantsList({ db, appUser, people, models, loading = false, modelLink }) {
  const toast = useToast();
  const { metaWeekdays = [1, 2, 3, 4, 5] } = useGeneralConfig();
  const [busy, setBusy] = useState(null);

  const change = async (person, value) => {
    const modelId = value === NONE ? null : value;
    setBusy(person.id);
    try {
      await setPersonModel({ db, appUser, models, userId: person.id, modelId });
      const name = firstName(person.name);
      toast.success(modelId ? `${name} agora segue o modelo ${models.find((m) => m.id === modelId)?.name}.` : `${name} ficou sem modelo.`);
    } catch (err) {
      console.error('rotinas: troca de modelo falhou', err);
      toast.error(err?.code === MODEL_GONE ? 'Esse modelo foi excluído.' : 'Não deu para trocar o modelo. Tente de novo.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h2 className="font-display text-[16px] font-semibold">Consultores</h2>
        <p className="text-[12.5px] text-muted-foreground">Cada um segue um modelo. Trocar aqui muda a rotina da pessoa a partir de hoje.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {loading && <p className="p-5 text-[13px] text-muted-foreground">Carregando os modelos de cada consultor…</p>}
        {!loading && people.length === 0 && (
          <p className="p-5 text-[13px] text-muted-foreground">Nenhum consultor na equipe ainda. Cadastre em Configurações, em Equipe & acessos.</p>
        )}
        {!loading && people.map((person) => {
          const model = modelOfUser(models, person.id);
          const today = model ? tasksForDay(model, new Date(), metaWeekdays).length : 0;
          const span = model ? spanText(model) : '';
          return (
            <div
              key={person.id}
              className={cn(
                'grid grid-cols-1 items-center gap-3 border-t border-border px-4 py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_240px_110px]',
                !model && 'bg-amber-500/[0.06]',
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold">{person.name}</p>
                <p className={cn('num text-[11.5px]', model ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-300')}>
                  {model ? `${today} ${today === 1 ? 'tarefa' : 'tarefas'} hoje${span ? ` · ${span}` : ''}` : 'Sem rotina na Meta diária'}
                </p>
              </div>
              <Select value={model?.id ?? NONE} onValueChange={(v) => change(person, v)} disabled={busy === person.id}>
                <SelectTrigger aria-label={`Modelo que ${firstName(person.name)} segue`} className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem modelo</SelectItem>
                  {models.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <span>
                {model && (
                  <AppLink {...modelLink(model.id)} className="text-[13px] font-medium text-brand-600 underline underline-offset-[3px]">
                    Abrir modelo
                  </AppLink>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
