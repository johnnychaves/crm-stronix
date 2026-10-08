import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isDoneState } from '../../lib/rotinasTela.js';
import { CHECK_TONE } from './routineTones.js';

// O círculo do estado da tarefa, só de leitura: a aba Hoje, a prévia do modelo
// aberto e a apresentação. O círculo que marca e desmarca é o botão do cartão
// "Rotina de hoje" da Meta diária, e ele não mora aqui. É decorativo: o estado
// está sempre escrito ao lado.
export function StateMark({ state, className }) {
  return (
    <span
      aria-hidden="true"
      className={cn('grid size-[18px] shrink-0 place-items-center rounded-full border-2', CHECK_TONE[state], className)}
    >
      {isDoneState(state) && <Check size={10} strokeWidth={3.2} />}
    </span>
  );
}
