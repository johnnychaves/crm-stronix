import { Tag, Phone, Users, Calendar, MessageCircle } from 'lucide-react';
import { getTone } from '../../lib/leadState.js';
import { isLeadActive, isHotLeadFromDate, isColdLeadFromDate, getDaysSinceFromDate } from '../../lib/leadStatus.js';

// Cor configurada da etiqueta/status (blue/green/…) → tom semântico (TONES em
// leadState). Modelo "soft": fundo claro + texto na MESMA cor porém mais forte +
// ponto — espelha o StatusBadge do protótipo (design_handoff_perfil_cadastro).
const COLOR_TONE = {
  blue: 'brand', sky: 'brand', indigo: 'violet',
  green: 'emerald', lime: 'emerald', emerald: 'emerald', teal: 'teal',
  yellow: 'amber', amber: 'amber', orange: 'amber',
  red: 'rose', rose: 'rose', pink: 'pink',
  purple: 'violet', violet: 'violet',
  gray: 'slate', grey: 'slate', slate: 'slate', neutral: 'slate'
};
const toneForColor = (color) => getTone(COLOR_TONE[color] || color);

function StatusBadge({ statusName, statusesArray }) {
  const t = statusName === 'Venda'
    ? getTone('emerald')
    : statusName === 'Perda'
      ? getTone('slate')
      : toneForColor((statusesArray || []).find(s => s.name === statusName)?.color || 'gray');
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-md whitespace-nowrap text-[11.5px] px-2 py-1 ${t.soft} ${t.text} ${t.darkSoft} ${t.darkText}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`}></span>{statusName}
    </span>
  );
}

function TagBadge({ tagName, tagsArray }) {
  const t = toneForColor((tagsArray || []).find(x => x.name === tagName)?.color || 'gray');
  return (
    <span className={`inline-flex items-center gap-1 font-semibold rounded-md whitespace-nowrap text-[11.5px] px-2 py-1 ${t.soft} ${t.text} ${t.darkSoft} ${t.darkText}`}>
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
