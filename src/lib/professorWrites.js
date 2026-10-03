// O que as ações do professor gravam no Firestore, tirado dos montadores de
// verdade. É a lista que o firestore.rules repete nas travas do professor
// (professorLeadFields, professorOutcomeFields e professorInteractionTypes), e
// o src/lib/__tests__/professorRules.test.js cobra que as duas sejam iguais.
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

// O desfecho do agendamento. O Agendar o grava sempre vazio (compromisso novo
// nasce sem desfecho), e a regra só deixa o professor gravá-lo vazio: marcar
// Compareceu ou Não compareceu não é dele.
export const PROFESSOR_OUTCOME_FIELDS = sortedUnique(
  SCHEDULE_PATCH_FIELDS.filter((campo) => campo.startsWith('appointmentOutcome'))
);

// Os tipos de interação que o professor cria. A Anotação sai do
// planProfileNote; o WhatsApp, a Ligação e a nota do Agendar gravam 'note'
// direto na LeadProfileView, e o teste varre esses handlers.
export const PROFESSOR_INTERACTION_TYPES = sortedUnique([planProfileNote('-').type, 'note']);
