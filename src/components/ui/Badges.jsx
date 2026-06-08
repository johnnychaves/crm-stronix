import { Tag, Phone, Users, Calendar, MessageCircle } from 'lucide-react';
import { statusGradientMap } from '../../lib/constants.js';
import { isLeadActive, isHotLeadFromDate, isColdLeadFromDate, getDaysSinceFromDate } from '../../lib/leadStatus.js';

function StatusBadge({ statusName, statusesArray }) {
  if (statusName === 'Venda') return <span className="px-3 py-1 rounded-full text-[9px] font-bold text-white uppercase tracking-widest bg-gradient-to-r shadow-lg from-green-600 to-emerald-400">VENDA</span>;
  if (statusName === 'Perda') return <span className="px-3 py-1 rounded-full text-[9px] font-bold text-white uppercase tracking-widest bg-gradient-to-r shadow-lg from-red-600 to-pink-500">PERDA</span>;
  const statusObj = (statusesArray || []).find(s => s.name === statusName);
  const color = statusObj?.color || 'gray';
  return (
    <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest bg-gradient-to-r shadow-lg ${statusGradientMap[color] || statusGradientMap.gray}`}>
      {statusName}
    </span>
  );
}

function TagBadge({ tagName, tagsArray }) {
  const tagObj = (tagsArray || []).find(t => t.name === tagName);
  const color = tagObj?.color || 'gray';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-tighter bg-gradient-to-br shadow-sm ${statusGradientMap[color] || statusGradientMap.gray}`}>
      <Tag className="w-2.5 h-2.5" /> {tagName}
    </span>
  );
}

function LeadTemperatureBadge({ lead, lastInteractionDate, compact = false }) {
  if (!lead || !isLeadActive(lead)) return null;
  const hot = isHotLeadFromDate(lead, lastInteractionDate);
  const cold = !hot && isColdLeadFromDate(lead, lastInteractionDate);
  if (!hot && !cold) return null;

  const size = compact ? 'text-[8px] px-1.5 py-0.5' : 'text-[9px] px-2 py-0.5';

  if (hot) {
    return (
      <span
        title="Lead com atividade recente ou agendamento próximo"
        className={`inline-flex items-center gap-1 rounded-md font-bold uppercase tracking-wider bg-gradient-to-r from-accent-500 to-red-500 text-white shadow-sm ${size}`}
      >
        <span aria-hidden="true">🔥</span> Hot
      </span>
    );
  }

  return (
    <span
      title="Lead sem interação há 7 dias ou mais"
      className={`inline-flex items-center gap-1 rounded-md font-bold uppercase tracking-wider bg-gradient-to-r from-sky-400 to-brand-300 text-white shadow-sm ${size}`}
    >
      <span aria-hidden="true">❄️</span> Esfriando
    </span>
  );
}

function DaysSinceContactBadge({ lead, lastInteractionDate }) {
  if (!lead || !isLeadActive(lead)) return null;
  const days = getDaysSinceFromDate(lead, lastInteractionDate);
  if (days === null) return null;
  if (days < 1) return null; // Sem badge se foi hoje
  const tone = days >= 7
    ? 'text-red-500 dark:text-red-400'
    : days >= 3
    ? 'text-accent-500 dark:text-accent-400'
    : 'text-gray-400 dark:text-neutral-500';
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider ${tone}`}>
      {days === 1 ? '1 dia sem contato' : `${days} dias sem contato`}
    </span>
  );
}

function FollowUpIcon({ type, className }) {
  if (type === 'Ligação') return <Phone className={className} />;
  if (type === 'Presencial' || type === 'Visita') return <Users className={className} />;
  if (type === 'Aula Experimental' || type === 'Aula experimental') return <Calendar className={className} />;
  return <MessageCircle className={className} />;
}
export { StatusBadge, TagBadge, LeadTemperatureBadge, DaysSinceContactBadge, FollowUpIcon };
