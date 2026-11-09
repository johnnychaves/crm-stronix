// Sinais da conversa que o Stronizap manda ao Stronilead (api/zap.js, ação
// conversation-signal): o lead escreveu, uma pessoa da equipe enviou, a IA
// enviou. Regras puras, sem Firestore: a rota só as junta e grava.
//
// A ficha guarda no máximo uma linha por tipo de sinal, por lead e por dia de
// Brasília, e o lead guarda a marca de espera (awaitingReplySince). Nada daqui
// é prospecção: a linha não leva volumeKind. Spec: docs/superpowers/specs/
// 2026-11-09-parte-b-sinais-da-conversa-design.md, no repositório do Stronizap.
import { zapMatchKey } from './_zapPhone.js';
import { NAME_MAX, emailFromActor, invalidData } from './_zapLead.js';

const MINUTE_MS = 60000;
const ID_MAX = 200;
// O relógio do servidor do Stronizap pode estar um pouco adiantado. Mais que
// isso, o horário é dado errado e a marca de espera nunca mais seria limpa.
const FUTURE_TOLERANCE_MS = 10 * MINUTE_MS;

export const SIGNAL_KINDS = Object.freeze(['lead_escreveu', 'pessoa_enviou', 'ia_enviou']);
// Cada virada da conversa é um sinal, e a fila do Stronizap pode soltar uma
// leva depois de uma parada. 600 por hora folga o uso normal.
export const SIGNAL_LIMIT = Object.freeze({ limit: 600, windowMs: 60 * MINUTE_MS });
export const PREVIEW_MAX = 120;

export const ZAP_SIGNAL_MESSAGES = Object.freeze({
  kind: 'O tipo do sinal precisa ser lead_escreveu, pessoa_enviou ou ia_enviou.',
  phone: 'Informe o telefone da conversa.',
  conversationId: 'Informe o identificador da conversa.',
  messageId: 'Informe o identificador da mensagem.',
  occurredAt: 'Informe o horário da mensagem em formato ISO, sem data no futuro.',
  answering: 'Informe com true ou false se o lead estava esperando resposta.',
  rateLimited: 'Muitos sinais em pouco tempo. Tente de novo em alguns minutos.'
});

const isId = (v) => typeof v === 'string' && v.length > 0 && v.length <= ID_MAX;

// O trecho da mensagem do lead: uma linha só, sem caracteres de controle, em
// até PREVIEW_MAX caracteres. Array.from conta por caractere, então um emoji
// nunca é cortado ao meio.
const cleanPreview = (raw) => {
  const text = raw.replace(/\p{Cc}+/gu, ' ').replace(/\s+/g, ' ').trim();
  const cut = Array.from(text).slice(0, PREVIEW_MAX).join('').trim();
  return cut || null;
};

// Lê o corpo do conversation-signal. Só o formato: o que depende da academia
// (equipe, lead, marcos) é conferido depois. Devolve { value } ou { refusal }.
export function readSignalBody(body, now = new Date()) {
  const kind = body?.kind;
  if (!SIGNAL_KINDS.includes(kind)) return { refusal: invalidData('kind', ZAP_SIGNAL_MESSAGES.kind) };

  const matchKey = typeof body.phone === 'string' ? zapMatchKey(body.phone) : null;
  if (!matchKey) return { refusal: invalidData('phone', ZAP_SIGNAL_MESSAGES.phone) };
  if (!isId(body.conversationId)) return { refusal: invalidData('conversationId', ZAP_SIGNAL_MESSAGES.conversationId) };
  if (!isId(body.messageId)) return { refusal: invalidData('messageId', ZAP_SIGNAL_MESSAGES.messageId) };

  const at = typeof body.occurredAt === 'string' ? new Date(body.occurredAt) : null;
  if (!at || Number.isNaN(at.getTime()) || at.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    return { refusal: invalidData('occurredAt', ZAP_SIGNAL_MESSAGES.occurredAt) };
  }

  const fromTeam = kind !== 'lead_escreveu';
  if (fromTeam && typeof body.answering !== 'boolean') {
    return { refusal: invalidData('answering', ZAP_SIGNAL_MESSAGES.answering) };
  }

  // Só a pessoa tem autor. A IA e o lead não têm, e a mensagem enviada pelo
  // celular da academia chega como pessoa sem actor.
  const person = kind === 'pessoa_enviou';
  const name = person && typeof body.actor?.name === 'string' ? body.actor.name.trim().slice(0, NAME_MAX) : '';
  return {
    value: {
      kind,
      matchKey,
      conversationId: body.conversationId,
      messageId: body.messageId,
      at,
      answering: fromTeam ? body.answering : false,
      email: person ? emailFromActor(body.actor) : null,
      actorName: name || null,
      preview: kind === 'lead_escreveu' && typeof body.preview === 'string' ? cleanPreview(body.preview) : null
    }
  };
}
