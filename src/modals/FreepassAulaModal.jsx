// Remarcar uma aula do freepass que não é a da vez (cartão do freepass na aba
// Contratos, mockup A, #cartao): uma linha do "Marcar as aulas", já com o dia,
// o horário e o professor da aula. Não repete o dia de outra aula do freepass
// nem aceita horário que já passou. A aula da vez remarca pelo Agendar da
// ficha. Quem grava é a ficha (writeFreepassAulaMove).
import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Btn } from '../components/ui/Btn.jsx';
import { AulasPlanner } from '../components/profile/AulasPlanner.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { professorsForModality } from '../lib/professores.js';
import { aulaRowOf, aulasForConfirm, aulasProblem, dayOptions, resolveAulaRows, shortDay } from '../lib/aulasPlan.js';

const hhmm = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

// number: o número da aula no cartão. taken: os dias das outras aulas do freepass.
export function FreepassAulaModal({ open, onOpenChange, aula, number, taken, firstName, loading, onConfirm }) {
  const { professores, modalities, metaWeekdays } = useGeneralConfig();
  const [rows, setRows] = useState(() => [aulaRowOf(aula)]);
  // Só redesenha: o Remarcar que achou a aula no passado mostra o aviso.
  const [, setRecheck] = useState(0);
  const resolved = resolveAulaRows(rows);
  const opts = { first: number, taken };
  const issue = aulasProblem(resolved, new Date(), opts);
  const planned = issue ? null : aulasForConfirm(resolved)[0];

  const submit = () => {
    if (loading) return;
    if (aulasProblem(resolved, new Date(), opts)) { setRecheck((n) => n + 1); return; }
    onConfirm(planned);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Remarcar a aula {number}</DialogTitle>
          <DialogDescription>{firstName}{aula.modality ? `, ${aula.modality}` : ''}. A aula muda de dia e continua no freepass.</DialogDescription>
        </DialogHeader>
        <AulasPlanner
          rows={rows} onChange={setRows} days={dayOptions(5, metaWeekdays)}
          professors={professorsForModality(professores, modalities, aula.modality)} firstName={firstName}
          first={number} taken={taken}
          doneText={planned ? `A aula ${number} passa para ${shortDay(planned.date)} às ${hhmm(planned.date)}.` : null}
        />
        <DialogFooter className="gap-2">
          <Btn kind="secondary" onClick={() => onOpenChange(false)}>Cancelar</Btn>
          <Btn kind="visit" icon={<CalendarClock size={14} />} onClick={submit} disabled={Boolean(issue) || loading}>Remarcar</Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
