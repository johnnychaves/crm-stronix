// Tempo até a primeira resposta do dia (PR 4 da Parte B), por quem respondeu.
// Puro. Sai das linhas zap_signal do PR 1, que a aba CRM já carrega com as
// interações do mês: no máximo uma linha por tipo, por lead e por dia de
// Brasília ("lead escreveu", "mensagem da equipe", "mensagem da IA").
//
// Vale só o par honesto: a primeira mensagem do lead no dia e a primeira da
// equipe no mesmo dia, depois dela, respondendo (answering), com autor e sem a
// IA ter respondido no meio. Fica de fora o que as linhas não sabem medir: a
// segunda conversa do dia, a espera que passa da meia-noite e a resposta pelo
// celular da academia, que não tem autor.
// shortcut: número da "primeira conversa do dia"; o fiel exige gravar no servidor o início da espera e quem respondeu (Tarefa 14 do plano do PR 4).

import { diaDeBrasilia } from '../../../api/_horarioDeBrasilia.js';
import { isZapSignalInteraction } from '../leads.js';
import { median } from './stats.js';

const msOf = (d) => (d instanceof Date ? d.getTime() : NaN);

export function firstReplyPairsOf(interactions, { start, end }) {
  const dias = new Map();
  const seen = new Set();
  for (const i of interactions || []) {
    if (!isZapSignalInteraction(i) || !i.leadId || !Number.isFinite(msOf(i.createdAt))) continue;
    if (i.id) {
      if (seen.has(i.id)) continue;
      seen.add(i.id);
    }
    const k = `${i.leadId}|${diaDeBrasilia(i.createdAt)}`;
    const dia = dias.get(k) || {};
    if (i.signal === 'lead_escreveu') dia.L = i;
    else if (i.signal === 'pessoa_enviou') dia.E = i;
    else if (i.signal === 'ia_enviou') dia.I = i;
    dias.set(k, dia);
  }
  const out = [];
  for (const { L, E, I } of dias.values()) {
    if (!L || !E || E.answering !== true || !E.actorId) continue;
    const l = msOf(L.createdAt);
    const e = msOf(E.createdAt);
    if (!(e > l) || l < start.getTime() || l >= end.getTime()) continue;
    const ia = I ? msOf(I.createdAt) : NaN;
    if (I && I.answering === true && ia > l && ia < e) continue;
    out.push({ leadId: L.leadId, actorId: E.actorId, actorName: E.consultantName || null, minutes: (e - l) / 60000 });
  }
  return out;
}

// A mediana, quantas conversas foram medidas e cada pessoa, do mais rápido
// para o mais lento. Com userId, só as respostas dessa pessoa. Sem par, null:
// a tela some com o card em vez de mostrar um zero.
export function firstReplyOf(interactions, { start, end, userId = null, users = [] }) {
  const pairs = firstReplyPairsOf(interactions, { start, end }).filter((p) => !userId || p.actorId === userId);
  if (!pairs.length) return null;
  const byActor = new Map();
  pairs.forEach((p) => byActor.set(p.actorId, [...(byActor.get(p.actorId) || []), p]));
  const nameOf = (id, list) => (users || []).find((u) => u.id === id)?.name || list.find((p) => p.actorName)?.actorName || 'Sem nome';
  const people = [...byActor.entries()]
    .map(([id, list]) => ({ id, name: nameOf(id, list), pairs: list.length, median: median(list.map((p) => p.minutes)) }))
    .sort((a, b) => a.median - b.median || a.name.localeCompare(b.name, 'pt-BR'));
  return { pairs: pairs.length, median: median(pairs.map((p) => p.minutes)), people };
}
