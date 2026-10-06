// O que as ações do professor gravam no Firestore, tirado dos montadores de
// verdade. É a lista que o firestore.rules repete nas travas do professor
// (professorLeadFields, professorOutcomeFields, professorTaskOwnerFields e
// professorInteractionTypes), e o src/lib/__tests__/professorRules.test.js
// cobra que as duas sejam iguais.
// Spec em docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md,
// "As regras do Firestore".
//
// No PR 1 o professor grava pela ficha: Anotação, WhatsApp e Ligação do
// composer, e o Agendar. As quatro passam pelo logInteraction
// (src/lib/interactions.js), que soma lastInteractionAt e interactionsCount no
// lead, e só o Agendar manda patch, o do buildSchedulePatch. O "Registrar
// contato" da Meta do professor (absence_contact) entra no PR 3, aqui e na
// regra juntos.
//
// Puro: nada de firebase.js aqui, para o teste rodar em node.

import { buildSchedulePatch } from './schedulePatch.js';
import { planProfileNote } from './profileNote.js';

const sortedUnique = (xs) => Object.freeze([...new Set(xs)].sort());

// Os rótulos que o ScheduleWizard manda em typeLabel (o followUpLabel de cada
// tipo). O teste confere a lista contra o próprio ScheduleWizard.jsx.
export const SCHEDULE_TYPE_LABELS = Object.freeze(['Mensagem', 'Ligação', 'Visita', 'Aula Experimental']);

// O que o logInteraction grava no lead em toda interação, além do patch.
export const LEAD_BUMP_FIELDS = sortedUnique(['lastInteractionAt', 'interactionsCount']);

// As chaves do patch do Agendar, somando os dois ramos (contato e
// compromisso). Elas dependem só do tipo, nunca dos valores.
export const SCHEDULE_PATCH_FIELDS = sortedUnique(
  SCHEDULE_TYPE_LABELS.flatMap((typeLabel) => Object.keys(buildSchedulePatch({ typeLabel, date: new Date(0) })))
);

// Os campos do lead que o professor altera.
export const PROFESSOR_LEAD_FIELDS = sortedUnique([...SCHEDULE_PATCH_FIELDS, ...LEAD_BUMP_FIELDS]);

// O desfecho do agendamento no lead. O Agendar o grava sempre vazio
// (compromisso novo nasce sem desfecho), e a regra só deixa o professor
// gravá-lo vazio no lead. A trava cobre só o espelho do lead: no registro da
// aula (stronix_aulas) o professor grava como os outros membros, inclusive o
// status e o desfecho, e é esse registro que a conversão por professor lê.
export const PROFESSOR_OUTCOME_FIELDS = sortedUnique(
  SCHEDULE_PATCH_FIELDS.filter((campo) => campo.startsWith('appointmentOutcome'))
);

// O dono da tarefa da visita e da aula no lead. O professor não participa da
// Meta, então o Agendar dele grava os dois vazios (appointmentTaskOwnerFor, em
// schedulePatch.js), e a regra só o deixa zerar os dois ou deixá-los como
// estavam: quem acabou de virar professor ainda tem o papel de consultor na
// sessão aberta e, sem a trava, pegaria de volta a tarefa que o set-role
// devolveu ao dono do lead.
export const PROFESSOR_TASK_OWNER_FIELDS = sortedUnique(
  SCHEDULE_PATCH_FIELDS.filter((campo) => campo.startsWith('appointmentOwner'))
);

// Os tipos de interação que o professor cria. A Anotação sai do
// planProfileNote; o WhatsApp, a Ligação e a nota do Agendar gravam 'note'
// direto na LeadProfileView, e o teste varre esses handlers.
export const PROFESSOR_INTERACTION_TYPES = sortedUnique([planProfileNote('-').type, 'note']);
