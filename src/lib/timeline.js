// Helpers puros da LINHA DO TEMPO da ficha (lead/cliente). Extraídos do
// LeadDetailsModal para serem compartilhados pela nova LeadProfileView.
// Sem React state — só apresentação/classificação/parse de interactions.

import { monthKeyOf, monthLabel } from './operacional/month.js';
import { parseValorBRL } from './format.js';

export const extractStageNameFromInteractionText = (text = '') => {
  const match = String(text).match(/\[([^\]]+)\]/);
  return match ? match[1].trim() : '';
};

const validDate = (d) => (d instanceof Date && !isNaN(d.getTime()) ? d : null);

// Agrupa eventos por mês, com o nome e o ano ("Setembro de 2026"), inclusive o
// mês corrente. Retorna [ [label, eventos[]], ... ] preservando a ordem de
// entrada. Os blocos eram Hoje, Ontem, Esta semana e Este mês, e a nota que
// ficava sozinha num deles aparecia sem o dia. O dia e a hora agora vão em
// cada linha (timelineStamp). A chave é o mês em horário LOCAL: 23h do dia 31
// no Brasil ainda é o mês de antes.
export const groupTimeline = (events) => {
  const map = new Map();
  (events || []).forEach((e) => {
    const d = validDate(e.createdAt);
    if (!d) return;
    const label = `${monthLabel(monthKeyOf(d), { withYear: false })} de ${d.getFullYear()}`;
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(e);
  });
  return Array.from(map.entries());
};

const pad2 = (n) => String(n).padStart(2, '0');

// Dia e hora de uma linha: "28/09 14:32". O ano fica no bloco do mês.
export const timelineStamp = (date) => {
  const d = validDate(date);
  if (!d) return '';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// Detecta eventos de CONTRATO (matrícula/renovação/cancelamento/troca de plano)
// pelo texto da interaction. Usado como bucket próprio na timeline. Só é
// consultado para type='status_change' (ver classifyInteraction) — contrato
// real é sempre gravado com esse type (contractsWrites.js); sem esse gate o
// regex também capturava notas/conclusões de sistema que só por coincidência
// mencionavam "renovação"/"plano" (ex: reagendamento de renovação na Meta
// Diária, RenewalOutcomeModal.jsx), fazendo a timeline mostrar a anotação do
// consultor como se fosse uma matrícula fechada.
const CONTRACT_RE = /matrícula|matricula|renova(ç|c)ão|contrato (cancelado|trancado|reativado|corrigido)|plano /i;

// Prefixo dos eventos do funil Upgrade (src/lib/stageMove.js).
const UPGRADE_EVENT_RE = /^Upgrade: /;

// Tipo do evento de contrato pelo começo do texto que o próprio app grava
// (src/lib/contracts.js). A ordem importa: "Renovação cancelada" é
// cancelamento, não renovação.
const CONTRACT_EVENT_RULES = [
  { kind: 'cancelamento', re: /^(contrato cancelado|renova(ç|c)ão cancelada)/i },
  { kind: 'trancamento', re: /^contrato trancado/i },
  { kind: 'reativacao', re: /^contrato reativado/i },
  { kind: 'correcao', re: /^contrato corrigido/i },
  { kind: 'renovacao', re: /^renova(ç|c)ão registrada/i },
  { kind: 'matricula', re: /^matr(í|i)cula realizada/i }
];

// Lê um evento de contrato: o tipo, o plano e o valor DELE. A ficha mostrava o
// plano e o valor do contrato de hoje em todo evento, então a matrícula de
// junho aparecia com o valor da renovação de setembro. Aceita os textos com
// travessão (os de hoje) e com vírgula (o da renovação cancelada). Sem tipo
// reconhecido devolve null. Mudou um texto em contracts.js, mude aqui e no
// timeline.test.js junto.
export function contractEventOf(text) {
  const t = String(text || '').trim();
  const rule = CONTRACT_EVENT_RULES.find((r) => r.re.test(t));
  if (!rule) return null;
  const plan = t.match(/Plano (.+?)(?= \(R\$|, | — |\. |\.$|$)/);
  const money = t.match(/\((R\$\s?[\d.,]+)\)/);
  const value = money ? parseValorBRL(money[1]) : null;
  return {
    kind: rule.kind,
    planName: plan ? plan[1].trim() : null,
    value: Number.isFinite(value) ? value : null
  };
}

// Classifica uma interaction num dos buckets de filtro da timeline.
// Usa o campo `type` e prefixos injetados pelo composer.
export const classifyInteraction = (i) => {
  const t = String(i.text || '');
  // Eventos de indicação têm bucket próprio, decidido pelo type ANTES de
  // qualquer regex de texto: o 🎉 de conversão menciona "matrícula" e sem este
  // gate cairia em 'contract' (ou, pior, no 'system' oculto por padrão).
  if (i.type === 'referral') return 'referral';
  // Cadastro importado de outro sistema (clientImportWrites.js): evento de
  // sistema, atrás do interruptor. Vem antes do regex de contrato porque o
  // texto cita o plano e a vigência.
  if (i.type === 'import') return 'system';
  // Contrato vem ANTES das demais regras: matrícula/renovação são gravadas como
  // status_change, mas pertencem ao bucket de contrato. O gate por type evita
  // que o regex capture outros types cujo texto livre só por coincidência
  // bate com essas palavras.
  // Eventos do funil Upgrade ("Upgrade: entrou na etapa Plano apresentado.")
  // são marcos de status mesmo quando a etapa ou a nota cita plano/renovação:
  // sem este gate a ficha pintava uma "matrícula fechada" com valor no meio
  // da esteira de upgrade.
  if (i.type === 'status_change' && !UPGRADE_EVENT_RE.test(t) && CONTRACT_RE.test(t)) return 'contract';
  // Desfecho de agendamento (compareceu/faltou) é gravado com
  // type='daily_goal_done', mas carrega o campo appointmentOutcome. É evento de
  // AGENDAMENTO: sem esta regra ele cai no balde 'system' e some do feed padrão,
  // que é justamente onde o desfecho da aula precisa aparecer.
  if (i.appointmentOutcome) return 'appointment';
  if (i.type === 'status_change') return 'status';
  if (/^📲|whatsapp enviada/i.test(t) || /^📞/.test(t)) return 'conversation';
  if (/retorno agendado|🔔/i.test(t)) return 'appointment';
  // daily_goal_done ("✅ … — Meta Diária …" / "🔄 Remarcou …") é evento de
  // sistema, mesmo gravado com type='daily_goal_done'. CSAT idem.
  if (i.type === 'daily_goal_done' || /meta diária|csat/i.test(t)) return 'system';
  // Observação automática do cadastro é uma NOTA normal (type='note'), então
  // cai no bucket 'note' logo abaixo — não é tratada como sistema.
  if (i.type === 'note') return 'note';
  return 'system';
};

// Cinco filtros + um interruptor. "Marcos" funde as antigas "Mudanças" e
// "Contrato" (as duas respondem "o que mudou de estado"); "Sistema" saiu da
// lista e virou interruptor, desligado por padrão — Meta Diária, etiquetas e
// "lead criado" não têm o peso de uma conversa.
export const TIMELINE_FILTERS = [
  { id: 'all',          label: 'Tudo',         kinds: null },
  { id: 'conversation', label: 'Conversas',    kinds: ['conversation'] },
  { id: 'appointment',  label: 'Agendamentos', kinds: ['appointment'] },
  { id: 'note',         label: 'Anotações',    kinds: ['note'] },
  { id: 'milestone',    label: 'Marcos',       kinds: ['status', 'contract', 'referral'] }
];

export const TIMELINE_SYSTEM_KIND = 'system';

// Um evento passa no filtro quando o bucket dele está na lista do filtro
// ('all' aceita qualquer um). O interruptor de sistema é decidido pelo caller,
// ANTES daqui — assim as contagens saem da mesma lista que a tela mostra.
export const matchesTimelineFilter = (kind, filterId) => {
  const f = TIMELINE_FILTERS.find(x => x.id === filterId);
  if (!f || !f.kinds) return true;
  return f.kinds.includes(kind);
};

// Rótulo da coluna de TIPO (versalete). O corpo do evento já vem limpo dos
// prefixos, então é esta coluna que diz o que a linha é.
export const timelineTypeLabel = (i) => {
  const t = String(i?.text || '');
  switch (i?._kind) {
    case 'contract': return 'Contrato';
    case 'status': return 'Fase';
    case 'referral': return 'Indicação';
    case 'conversation': return /^📞|ligaç/i.test(t) ? 'Ligação' : 'WhatsApp';
    case 'note': return i?.pinned ? 'Nota fixa' : 'Nota';
    case 'appointment': return /aula/i.test(t) ? 'Aula' : 'Agenda';
    default: return 'Sistema';
  }
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Para cada mudança de fase: de ONDE veio e há quanto tempo o lead estava lá.
 *
 * Não existe campo gravado — a origem é o destino da transição anterior e a
 * duração é a diferença entre as duas. Na primeira transição não há anterior;
 * aí a régua é o cadastro do lead (`leadCreatedAt`), que é dado real. Sem
 * cadastro conhecido devolve `days: null` e a tela omite o "após", em vez de
 * inventar um zero.
 *
 * @returns {Object} id → { from: string|null, days: number|null, fromCreation: boolean }
 */
export const buildStageTransitions = (statusInteractions, leadCreatedAt = null) => {
  const chrono = (statusInteractions || [])
    .filter(i => i.createdAt instanceof Date && !isNaN(i.createdAt.getTime()))
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const created = leadCreatedAt instanceof Date && !isNaN(leadCreatedAt.getTime()) ? leadCreatedAt : null;
  const out = {};
  let prevDest = null;
  let prevAt = created;

  chrono.forEach((i) => {
    const days = prevAt ? Math.max(0, Math.floor((i.createdAt.getTime() - prevAt.getTime()) / DAY_MS)) : null;
    out[i.id] = { from: prevDest, days, fromCreation: !prevDest && Boolean(created) };
    const dest = extractStageNameFromInteractionText(i.text);
    // Evento sem etapa entre [colchetes] (reabertura, "Lead perdido…") não
    // quebra a cadeia: segue valendo a última etapa conhecida.
    if (dest) { prevDest = dest; prevAt = i.createdAt; }
  });

  return out;
};

// Detecta metadados de agendamento embutidos no texto de uma interaction.
// O composer atual grava "🔔 {Tipo} agendada (extra) p/ DD/MM, HH:MM. Obs: ..."
// (ver handleWizardConfirm); legados podem usar "Retorno agendado (...)".
// Retorna { kind, label, when, location } ou null. `location` sai do bloco
// "(...)" só quando traz "Unidade ..." (visita) — nunca é fabricado.
export const parseAppointment = (i) => {
  const t = String(i.text || '');
  if (!/retorno agendado|agendad[ao]|🔔/i.test(t)) return null;
  // Tipo: tanto o formato novo ("🔔 Visita agendada (...)") quanto o legado
  // ("Retorno agendado (...)").
  const typeMatch = t.match(/(?:🔔\s*)?([^()\n]*?)\s+agendad[ao]\b/i)
    || t.match(/Retorno agendado \(([^)]+)\)/i);
  const extraMatch = t.match(/agendad[ao]\s*\(([^)]+)\)/i);
  const dateMatch = t.match(/p\/\s*([\d/]+(?:[,\s]+[\d:]+)?)/i);
  const kindRaw = (typeMatch ? typeMatch[1] : '').replace(/^🔔\s*/, '').trim();
  const lower = kindRaw.toLowerCase();
  let kind = 'follow', label = kindRaw || 'Próximo contato';
  if (lower.includes('aula')) { kind = 'class'; label = 'Aula experimental'; }
  else if (lower.includes('visita')) { kind = 'visit'; label = 'Visita à unidade'; }
  else if (lower.includes('ligação') || lower.includes('ligacao')) { kind = 'call'; label = 'Ligação'; }
  else if (lower.includes('mensagem')) { kind = 'message'; label = 'Mensagem'; }
  // Local: só o "(Unidade ...)" da visita vira local; o extra de aula
  // (modalidade/qtd) não é endereço, então fica fora do campo location.
  let location = null;
  if (extraMatch) {
    const ex = extraMatch[1].trim();
    if (/unidade/i.test(ex)) location = ex;
  }
  let when = null;
  if (dateMatch) {
    const raw = dateMatch[1].trim();
    const [datePart, timePart] = raw.split(/[,\s]+/);
    const dParts = (datePart || '').split('/').map(n => parseInt(n, 10));
    // O composer grava "DD/MM, HH:MM" (sem ano — ver handleWizardConfirm), mas
    // legados podem trazer "DD/MM/AAAA". Aceitamos ambos: sem ano, assume o ano
    // corrente (o agendamento é sempre próximo).
    if (dParts.length >= 2 && dParts.slice(0, 2).every(n => Number.isFinite(n))) {
      const [day, month] = dParts;
      const year = dParts.length >= 3 && Number.isFinite(dParts[2]) ? dParts[2] : new Date().getFullYear();
      const [hh, mm] = (timePart || '00:00').split(':').map(n => parseInt(n, 10) || 0);
      when = new Date(year, month - 1, day, hh, mm);
      if (isNaN(when.getTime())) when = null;
    }
  }
  // Observação digitada no agendamento ("… Obs: <texto>") — exibida na timeline.
  const noteMatch = t.match(/\bobs:\s*(.+)$/i);
  const note = noteMatch ? noteMatch[1].trim() : null;
  return { kind, label, when, location, note };
};
