// Helpers puros da LINHA DO TEMPO da ficha (lead/cliente). Extraídos do
// LeadDetailsModal para serem compartilhados pela nova LeadProfileView.
// Sem React state — só apresentação/classificação/parse de interactions.
import { Calendar, CheckCircle, MessageCircle, Phone, RefreshCw, ThumbsDown, Trophy, Users } from 'lucide-react';

export const interactionToneMap = {
  blue: {
    dot: 'bg-blue-500 text-white',
    card: 'border-blue-500/20 bg-blue-500/5',
    pill: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    text: 'text-gray-900 dark:text-white',
    meta: 'text-blue-600 dark:text-blue-200/70'
  },
  green: {
    dot: 'bg-green-500 text-white',
    card: 'border-green-500/20 bg-green-500/5',
    pill: 'bg-green-500/10 text-green-700 dark:text-green-300',
    text: 'text-gray-900 dark:text-white',
    meta: 'text-green-600 dark:text-green-200/70'
  },
  yellow: {
    dot: 'bg-yellow-400 text-yellow-900',
    card: 'border-yellow-500/30 bg-yellow-500/10',
    pill: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
    text: 'text-gray-900 dark:text-white',
    meta: 'text-yellow-600 dark:text-yellow-400/80'
  },
  purple: {
    dot: 'bg-purple-500 text-white',
    card: 'border-purple-500/20 bg-purple-500/5',
    pill: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
    text: 'text-gray-900 dark:text-white',
    meta: 'text-purple-600 dark:text-purple-200/70'
  },
  red: {
    dot: 'bg-red-500 text-white',
    card: 'border-red-500/20 bg-red-500/5',
    pill: 'bg-red-500/10 text-red-700 dark:text-red-300',
    text: 'text-gray-900 dark:text-white',
    meta: 'text-red-600 dark:text-red-200/70'
  },
  orange: {
    dot: 'bg-blue-600 text-white',
    card: 'border-blue-600/20 bg-blue-600/5',
    pill: 'bg-blue-600/10 text-blue-700 dark:text-blue-400',
    text: 'text-gray-900 dark:text-white',
    meta: 'text-blue-600 dark:text-blue-400/70'
  },
  gray: {
    dot: 'bg-gray-200 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300',
    card: 'border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60',
    pill: 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300',
    text: 'text-gray-800 dark:text-neutral-200',
    meta: 'text-gray-500 dark:text-neutral-500'
  }
};

export const extractStageNameFromInteractionText = (text = '') => {
  const match = String(text).match(/\[([^\]]+)\]/);
  return match ? match[1].trim() : '';
};

export const getStageTone = (statusName, statusesArray = []) => {
  if (statusName === 'Venda') return interactionToneMap.green;
  if (statusName === 'Perda') return interactionToneMap.red;

  const statusObj = (statusesArray || []).find(s => s.name === statusName);
  const color = statusObj?.color || 'orange';

  return interactionToneMap[color] || interactionToneMap.orange;
};

export const getInteractionVisual = (interaction, statusesArray = []) => {
  const text = String(interaction?.text || '');
  const lower = text.toLowerCase();
  const stageName = extractStageNameFromInteractionText(text);

  if (stageName) {
    return {
      stageName,
      label: 'Mudança de etapa',
      icon: RefreshCw,
      ...getStageTone(stageName, statusesArray)
    };
  }

  if (lower.includes('matrícula') || lower.includes('venda')) {
    return { label: 'Venda', icon: Trophy, ...interactionToneMap.green };
  }

  if (lower.includes('perda') || lower.includes('perdido')) {
    return { label: 'Perda', icon: ThumbsDown, ...interactionToneMap.red };
  }

  if (lower.includes('aula')) {
    return { label: 'Aula experimental', icon: Calendar, ...interactionToneMap.purple };
  }

  if (lower.includes('visita')) {
    return { label: 'Visita', icon: Users, ...interactionToneMap.yellow };
  }

  if (lower.includes('csat')) {
    return { label: 'CSAT', icon: CheckCircle, ...interactionToneMap.blue };
  }

  if (lower.includes('ligação')) {
    return { label: 'Ligação', icon: Phone, ...interactionToneMap.orange };
  }

  if (lower.includes('mensagem')) {
    return { label: 'Mensagem', icon: MessageCircle, ...interactionToneMap.gray };
  }

  return interaction?.type === 'status_change'
    ? { label: 'Atualização', icon: RefreshCw, ...interactionToneMap.orange }
    : { label: 'Observação', icon: MessageCircle, ...interactionToneMap.gray };
};

// Agrupa eventos por janela temporal (Hoje / Ontem / Esta semana / Este mês /
// mês-ano). Retorna [ [label, eventos[]], ... ] preservando a ordem de entrada.
export const groupTimeline = (events) => {
  const now = new Date();
  const dayKey = (d) => d.toISOString().slice(0, 10);
  const todayKey = dayKey(now);
  const yKey = (() => { const y = new Date(now); y.setDate(y.getDate() - 1); return dayKey(y); })();
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0);
  const map = new Map();
  events.forEach((e) => {
    const d = e.createdAt instanceof Date ? e.createdAt : null;
    if (!d) return;
    const k = dayKey(d);
    let label;
    if (k === todayKey) label = 'Hoje';
    else if (k === yKey) label = 'Ontem';
    else if (d >= startOfWeek) label = 'Esta semana';
    else if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) label = 'Este mês';
    else label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(e);
  });
  return Array.from(map.entries());
};

// Detecta eventos de CONTRATO (matrícula/renovação/cancelamento/troca de plano)
// pelo texto da interaction. Usado como bucket próprio na timeline.
const CONTRACT_RE = /matrícula|matricula|renova(ç|c)ão|contrato cancelado|plano /i;

// Classifica uma interaction num dos buckets de filtro da timeline.
// Usa o campo `type` e prefixos injetados pelo composer.
export const classifyInteraction = (i) => {
  const t = String(i.text || '');
  // Contrato vem ANTES das demais regras: matrícula/renovação são gravadas como
  // status_change, mas pertencem ao bucket de contrato.
  if (CONTRACT_RE.test(t)) return 'contract';
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

export const TIMELINE_FILTERS = [
  { id: 'all',          label: 'Tudo' },
  { id: 'conversation', label: 'Conversas' },
  { id: 'status',       label: 'Mudanças' },
  { id: 'appointment',  label: 'Agendamentos' },
  { id: 'note',         label: 'Anotações' },
  { id: 'contract',     label: 'Contrato' },
  { id: 'system',       label: 'Sistema' }
];

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
  return { kind, label, when, location };
};
