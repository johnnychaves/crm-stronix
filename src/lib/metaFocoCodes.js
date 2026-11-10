import { DAILY_GOAL_CATEGORIES as C } from './leads.js';

// Os grupos da barra "Foco em" da Meta Diária, no único lugar onde eles são
// escritos. Mora num arquivo à parte porque o screenParams.js (puro) precisa
// lê-los e não pode importar o metaFoco.js, que traz o dailyGoal.js e, com ele,
// o lucide-react. Este arquivo só importa o leads.js, que o screenParams.js já usa.
// Os valores são os mesmos do `cat` do endereço.

export const FOCO_COMPROMISSOS = 'compromissos';

// "Respondeu, aguardando você" (PR 4 da Parte B): o lead escreveu no WhatsApp
// e ninguém respondeu ainda. Não é categoria da meta (não está em
// DAILY_GOAL_CATEGORIES, nunca fica feita e não conta no dia): as entradas
// saem de metaEspera.js. A aba só aparece com espera (focoTabs).
export const FOCO_ESPERA = 'aguardando_resposta';

// Na ordem em que aparecem na barra. 'all' é a barra inteira.
export const FOCO_ORDER = Object.freeze([
  'all', FOCO_COMPROMISSOS, C.CONTATO_HOJE, C.NOVO_24H, C.ATRASADO, FOCO_ESPERA, C.RENOVACAO, C.VENCIDO,
]);

// Os grupos que juntam mais de uma categoria. Todo foco que não está aqui é a
// própria categoria.
export const FOCO_GRUPOS = Object.freeze({
  [FOCO_COMPROMISSOS]: Object.freeze([C.VISITA_HOJE, C.AULA_HOJE]),
});
