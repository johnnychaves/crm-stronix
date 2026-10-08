import { CalendarClock, CircleCheck, History, Users } from 'lucide-react';
import { NewFeatureBadge } from '../NewFeatureBadge.jsx';

// O balão "Novo" da tela Rotinas, no item Rotinas do menu lateral (mockup
// 2026-10-08-balao-novo-rotinas.html, opção C, escolhida pelo Johnny em
// 08/10/2026, em vermelho). O clique no balão abre a explicação da tela; o
// clique no resto do item abre a tela.

// Último dia do balão "Novo" (e do ponto vermelho do menu recolhido): aparece
// por 30 dias depois do lançamento.
export const NOVO_ATE = '2026-11-07';

// O que o balão "Novo" explica. Cada linha tem o ícone do assunto dela.
const SOBRE_ROTINAS = [
  [CalendarClock, 'Cada tarefa tem os dias em que vale e, se quiser, um horário.'],
  [Users, 'Cada consultor segue um modelo só, e um modelo pode ter várias pessoas. Para uma rotina diferente, duplique o modelo e ajuste.'],
  [CircleCheck, 'O consultor vê a rotina do dia na Meta diária, num cartão próprio, e dá check em cada tarefa. A rotina não conta para o dia batido.'],
  [History, 'Mudou um modelo? Vale a partir de hoje. Os dias anteriores ficam como estavam.'],
];

// `tone`, `now` e `className` vão direto para o NewFeatureBadge.
export function RotinasNovo(props) {
  return (
    <NewFeatureBadge
      {...props}
      until={NOVO_ATE}
      title="Rotinas"
      description="O dia de trabalho de cada consultor, com as tarefas que não envolvem lead."
    >
      <div className="flex flex-col gap-3 text-[13.5px] leading-relaxed">
        <p>
          Aqui você monta modelos com as tarefas que se repetem, como abrir a recepção, postar o story da aula ou mandar o
          resumo do dia, e escolhe quem segue cada modelo.
        </p>
        <ul className="flex flex-col gap-2.5">
          {SOBRE_ROTINAS.map(([Icon, item]) => (
            <li key={item} className="flex items-start gap-2.5">
              <Icon aria-hidden="true" className="mt-[3px] size-4 shrink-0 text-brand-600 dark:text-brand-300" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </NewFeatureBadge>
  );
}
