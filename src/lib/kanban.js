import { isClientLead } from './leads.js';

// --- KANBAN: recorte do board ---
// Clientes (matriculados) e leads 'Venda' legados saem do Kanban — vivem na
// aba Clientes. A coluna "Venda" segue existindo só como alvo de conversão.
// `now` é injetável para teste; o default preserva o comportamento da tela.
export function filterKanbanLeads(funnelLeads, { respFilter = [], onlyOverdue = false, now = new Date() } = {}) {
  let filtered = (funnelLeads || []).filter(l => !isClientLead(l));
  if (respFilter.length > 0) {
    filtered = filtered.filter(l => respFilter.includes(l.consultantId));
  }
  if (onlyOverdue) {
    filtered = filtered.filter(l =>
      l.status !== 'Venda' && l.status !== 'Perda' &&
      l.nextFollowUp instanceof Date && !isNaN(l.nextFollowUp.getTime()) &&
      l.nextFollowUp < now
    );
  }
  return filtered;
}

// --- KANBAN: particionamento por coluna, UMA passada p/ o board inteiro ---
// Ordena cada coluna por prioridade de follow-up: 1 atrasado · 2 hoje ·
// 3 futuro · 4 sem follow-up; empate por follow-up mais próximo, depois
// createdAt desc. Retorna Map<statusName, lead[]> (colunas de statusNames
// sempre presentes, mesmo vazias).
export function partitionLeadsByStatus(kanbanLeads, statusNames = [], now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTomorrow = startOfToday + 86400000;

  const getPriority = (lead) => {
    if (!lead.nextFollowUp || !(lead.nextFollowUp instanceof Date) || isNaN(lead.nextFollowUp.getTime())) {
      return 4; // Lowest priority
    }
    const time = lead.nextFollowUp.getTime();
    if (time < now.getTime()) return 1; // Overdue
    if (time >= startOfToday && time < startOfTomorrow) return 2; // Today
    return 3; // Future
  };

  const map = new Map(statusNames.map((name) => [name, []]));
  (kanbanLeads || []).forEach((lead) => {
    if (!map.has(lead.status)) map.set(lead.status, []);
    map.get(lead.status).push(lead);
  });

  map.forEach((columnLeads) => {
    columnLeads.sort((a, b) => {
      const pA = getPriority(a);
      const pB = getPriority(b);
      if (pA !== pB) return pA - pB;
      if (pA !== 4 && a.nextFollowUp && b.nextFollowUp) {
        return a.nextFollowUp.getTime() - b.nextFollowUp.getTime();
      }
      return (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0);
    });
  });

  return map;
}

// --- KANBAN: cor de destaque por coluna (faixa do card + bolinha do header) ---
const KANBAN_COLUMN_ACCENT = {
  blue:   { dot: 'bg-blue-500',    border: '#3b82f6' },
  green:  { dot: 'bg-emerald-500', border: '#10b981' },
  yellow: { dot: 'bg-amber-500',   border: '#f59e0b' },
  red:    { dot: 'bg-rose-500',    border: '#f43f5e' },
  purple: { dot: 'bg-violet-500',  border: '#8b5cf6' },
  orange: { dot: 'bg-orange-500',  border: '#f97316' },
  gray:   { dot: 'bg-slate-400',   border: '#94a3b8' },
  teal:   { dot: 'bg-teal-500',    border: '#14b8a6' },
  pink:   { dot: 'bg-pink-500',    border: '#ec4899' },
  indigo: { dot: 'bg-indigo-500',  border: '#6366f1' },
  lime:   { dot: 'bg-lime-500',    border: '#84cc16' },
};
const getKanbanColumnAccent = (color) => KANBAN_COLUMN_ACCENT[color] || KANBAN_COLUMN_ACCENT.gray;

// --- KANBAN: avatar com iniciais (cor estável por hash do nome) ---
const KANBAN_AVATAR_PALETTES = [
  ['#fde68a','#92400e'], ['#bbf7d0','#065f46'], ['#bae6fd','#075985'],
  ['#fbcfe8','#9d174d'], ['#ddd6fe','#5b21b6'], ['#fecaca','#9f1212'],
  ['#a7f3d0','#065f46'], ['#fef08a','#854d0e'],
];
const getKanbanAvatarPalette = (seed = '') => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return KANBAN_AVATAR_PALETTES[h % KANBAN_AVATAR_PALETTES.length];
};
const getKanbanInitials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map(p => p[0] || '').join('').toUpperCase() || '?';
};

// --- KANBAN: formatação relativa de datas ---
const fmtKanbanRelDate = (d) => {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startThat - startToday) / 86400000);
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Amanhã';
  if (days === -1) return 'Ontem';
  if (days > 1 && days < 7) return `Em ${days}d`;
  if (days < -1 && days > -7) return `${Math.abs(days)}d atrás`;
  return d.toLocaleDateString('pt-BR');
};
const fmtKanbanRelDateTime = (d) => {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  return `${fmtKanbanRelDate(d)} · ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};
export { KANBAN_COLUMN_ACCENT, getKanbanColumnAccent, KANBAN_AVATAR_PALETTES, getKanbanAvatarPalette, getKanbanInitials, fmtKanbanRelDate, fmtKanbanRelDateTime };
