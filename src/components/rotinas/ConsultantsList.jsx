import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { firstName, modelOfUser } from '../../lib/rotinas.js';
import { modelSelectDomId, personTodayText } from '../../lib/rotinasTela.js';
import { MODEL_GONE, setPersonModel } from '../../lib/rotinasWrites.js';
import { AppLink } from '../nav/AppLink.jsx';
import { PersonInitials } from './PersonInitials.jsx';

const NONE = 'sem-modelo';

// A lista de consultores da aba Modelos (Página B do mockup
// 2026-10-08-rotinas-intro-e-polimento.html): o rosto, o nome, o dia de hoje
// da pessoa no modelo que ela segue, o seletor do modelo e o "Abrir modelo".
// Enquanto os modelos não chegam (loading), a lista não diz quem está sem
// rotina: sem os modelos, todo mundo pareceria sem modelo. modelLink(id)
// devolve o endereço e o state do "Abrir modelo", que é link de verdade.
// O seletor leva um id (modelSelectDomId): é para ele que a RotinasView leva o
// foco quando o "Escolher modelo" da aba Hoje troca para esta aba.
export function ConsultantsList({ db, appUser, people, models, loading = false, modelLink }) {
  const toast = useToast();
  const { metaWeekdays = [1, 2, 3, 4, 5] } = useGeneralConfig();
  const [busy, setBusy] = useState(null);
  const now = new Date();

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
          return (
            <div
              key={person.id}
              className={cn(
                'grid grid-cols-1 items-center gap-3 border-t border-border px-4 py-2.5 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_240px_130px]',
                !model && 'bg-amber-500/[0.06]',
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <PersonInitials name={person.name} size={28} />
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold">{person.name}</p>
                  <p className={cn('num text-[11.5px]', model ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-300')}>
                    {model ? personTodayText(model, now, metaWeekdays) : 'Sem rotina na Meta diária'}
                  </p>
                </div>
              </div>
              <Select value={model?.id ?? NONE} onValueChange={(v) => change(person, v)} disabled={busy === person.id}>
                <SelectTrigger id={modelSelectDomId(person.id)} aria-label={`Modelo que ${firstName(person.name)} segue`} className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem modelo</SelectItem>
                  {models.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="sm:text-right">
                {model && (
                  <AppLink {...modelLink(model.id)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-600 dark:text-brand-300">
                    Abrir modelo
                    <ArrowRight aria-hidden="true" className="size-[13px]" />
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
