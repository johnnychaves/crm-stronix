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
import { diaDeBrasilia, isoDoDia } from './_horarioDeBrasilia.js';
import { getInteractionSecurityFields, ZAP_SIGNAL_TYPE, ZAP_VIA } from '../src/lib/leads.js';

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

// Cada tipo de sinal tem a sua linha no dia: o lead, a equipe (pessoa) e a IA.
const LINE_OF = Object.freeze({ lead_escreveu: 'lead', pessoa_enviou: 'equipe', ia_enviou: 'ia' });

// Id fixo da linha: por lead, dia de Brasília e tipo. É ele que faz o mesmo
// sinal, reenviado ou repetido, cair no mesmo documento em vez de abrir outro.
export const signalLineId = (leadId, at, kind) => `zap-${leadId}-${isoDoDia(diaDeBrasilia(at))}-${LINE_OF[kind]}`;

// O texto que a ficha mostra. Só o nome de quem o Stronilead conhece entra:
// sem autor, a linha diz "da equipe".
export function signalText({ kind, answering, actorName = null, preview = null }) {
  if (kind === 'lead_escreveu') return preview ? `Lead escreveu: “${preview}”` : 'Lead escreveu.';
  if (kind === 'ia_enviou') return answering ? 'Resposta da IA.' : 'Mensagem da IA.';
  const quem = actorName ? `de ${actorName}` : 'da equipe';
  return `${answering ? 'Resposta' : 'Mensagem'} ${quem}.`;
}

// A interação que vai para stronix_interactions. Sem volumeKind: o volume da
// prospecção conta agendamento criado e lead novo, e o contato puro fica de
// fora (src/lib/dailyGoal.js, decisão de 16/06/2026). A hora é a da mensagem,
// não a do servidor, para a linha cair onde a conversa aconteceu.
export function buildSignalInteraction({ lead, actor, signal }) {
  return {
    leadId: lead.id,
    leadName: lead.name || null,
    consultantName: actor?.name ?? null,
    ...getInteractionSecurityFields(lead, actor),
    actorId: actor?.id ?? null,
    actorAuthUid: actor?.authUid ?? null,
    type: ZAP_SIGNAL_TYPE,
    signal: signal.kind,
    answering: signal.answering,
    text: signalText({
      kind: signal.kind, answering: signal.answering, actorName: actor?.name ?? null, preview: signal.preview ?? null
    }),
    via: ZAP_VIA,
    zapConversationId: signal.conversationId,
    ...(signal.kind === 'ia_enviou' ? { byAi: true } : {}),
    createdAt: signal.at
  };
}
