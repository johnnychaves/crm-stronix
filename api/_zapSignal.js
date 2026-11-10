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
// leva depois de uma parada. 600 por hora folga o uso normal. O Stronizap trata
// 429 como erro de nova tentativa (espera crescente), nunca como sinal descartado.
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

// Caracteres de direção (U+202A a U+202E e U+2066 a U+2069) deixariam o lead
// inverter o texto na ficha.
const BIDI = /[\u202A-\u202E\u2066-\u2069]/g;

// Texto de uma linha só, sem caracteres de direção nem de controle, em até
// `max` caracteres (o do trecho e o do nome passam por aqui). Array.from conta
// por caractere, então um emoji nunca é cortado ao meio. Vazio vira null.
const cleanText = (raw, max) => {
  const text = raw.replace(BIDI, '').replace(/\p{Cc}+/gu, ' ').replace(/\s+/g, ' ').trim();
  return Array.from(text).slice(0, max).join('').trim() || null;
};

// ISO 8601 com fuso. Sem fuso (ou só a data) o Date leria em UTC na Vercel e a
// linha cairia horas fora do dia certo.
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

// Lê o corpo do conversation-signal. Só o formato: o que depende da academia
// (equipe, lead, marcos) é conferido depois. Devolve { value } ou { refusal }.
export function readSignalBody(body, now = new Date()) {
  const kind = body?.kind;
  if (!SIGNAL_KINDS.includes(kind)) return { refusal: invalidData('kind', ZAP_SIGNAL_MESSAGES.kind) };

  const matchKey = typeof body.phone === 'string' ? zapMatchKey(body.phone) : null;
  if (!matchKey) return { refusal: invalidData('phone', ZAP_SIGNAL_MESSAGES.phone) };
  if (!isId(body.conversationId)) return { refusal: invalidData('conversationId', ZAP_SIGNAL_MESSAGES.conversationId) };
  if (!isId(body.messageId)) return { refusal: invalidData('messageId', ZAP_SIGNAL_MESSAGES.messageId) };

  const at = typeof body.occurredAt === 'string' && ISO.test(body.occurredAt) ? new Date(body.occurredAt) : null;
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
  const actorName = person && typeof body.actor?.name === 'string' ? cleanText(body.actor.name, NAME_MAX) : null;
  return {
    value: {
      kind,
      matchKey,
      conversationId: body.conversationId,
      messageId: body.messageId,
      at,
      answering: fromTeam ? body.answering : false,
      email: person ? emailFromActor(body.actor) : null,
      actorName,
      preview: kind === 'lead_escreveu' && typeof body.preview === 'string' ? cleanText(body.preview, PREVIEW_MAX) : null
    }
  };
}

// Cada tipo de sinal tem a sua linha no dia: o lead, a equipe (pessoa) e a IA.
const LINE_OF = Object.freeze({ lead_escreveu: 'lead', pessoa_enviou: 'equipe', ia_enviou: 'ia' });

// Id fixo da linha: por lead, dia de Brasília e tipo. É ele que faz o mesmo
// sinal, reenviado ou repetido, cair no mesmo documento em vez de abrir outro.
export function signalLineId(leadId, at, kind) {
  const dia = diaDeBrasilia(at);
  if (!leadId || Number.isNaN(dia) || !LINE_OF[kind]) throw new Error('signalLineId: dados inválidos');
  return `zap-${leadId}-${isoDoDia(dia)}-${LINE_OF[kind]}`;
}

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
    zapMessageId: signal.messageId ?? null,
    ...(signal.kind === 'ia_enviou' ? { byAi: true } : {}),
    createdAt: signal.at
  };
}

// O instante de um Date ou de um Timestamp do Firestore (toMillis ou toDate).
// Qualquer outra coisa não é instante e volta null.
const millis = (v) => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v?.toMillis === 'function') return v.toMillis();
  if (typeof v?.toDate === 'function') return v.toDate().getTime();
  return null;
};

// O que o sinal muda no lead, ou null quando nada muda. Só a marca de espera
// importa: liga com o primeiro "lead escreveu" depois de uma resposta e limpa
// com a primeira resposta (de pessoa ou da IA) a quem esperava. A segunda
// mensagem seguida, de qualquer lado, não grava nada no lead, e por isso o
// Pipeline de quem está com a tela aberta não atualiza a cada mensagem.
// `zapSignalAt` é a régua do último sinal aplicado, e a resposta sempre a
// avança, mesmo quando ninguém esperava: um "lead escreveu" mais velho que
// chegue depois dela, fora de ordem, não religa a marca. O "lead escreveu" no
// mesmo instante da régua também é ignorado, porque o WhatsApp manda a hora em
// segundos e esse caso é reenvio, não mensagem nova.
export function signalLeadPatch(lead, signal) {
  const at = signal.at.getTime();
  const last = millis(lead?.zapSignalAt);
  const waiting = millis(lead?.awaitingReplySince) != null;
  if (signal.kind === 'lead_escreveu') {
    if (waiting || (last != null && at <= last)) return null;
    return { awaitingReplySince: signal.at, zapSignalAt: signal.at };
  }
  if (!signal.answering || (last != null && at < last)) return null;
  return waiting ? { awaitingReplySince: null, zapSignalAt: signal.at } : { zapSignalAt: signal.at };
}

// Lead entra sempre. Cliente só quando o cartão já mostra uma faixa de prazo
// (visita ou aula hoje, contrato vencido, freepass, marco de renovação): é o
// que quer dizer "tem tarefa aberta na Meta". Sem isso, os alunos que
// conversam com a recepção e os professores encheriam a ficha à toa.
export function signalEligibility(lead, strip) {
  return lead?.lifecycleStage !== 'cliente' || strip != null;
}
