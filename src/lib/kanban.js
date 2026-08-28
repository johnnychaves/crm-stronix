import { isAdminUser, isClientLead } from './leads.js';

// Carteira padrão do board por PAPEL.
//
// Todo mundo enxerga o pipeline da academia inteira: a assinatura de leads
// ativos já é global (roda igual para gestor e consultor) e a seção
// "Responsável" do filtro fica aberta para todos. O que muda por papel é só o
// PADRÃO com que a tela abre — o consultor começa na própria carteira e troca no
// filtro quando quiser a de outro (ou a de todos); o gestor começa na equipe
// inteira. Até 26/08/2026 o consultor ficava preso aos próprios leads por
// recorte de dados, sem filtro nenhum para mexer.
export const defaultRespFilterFor = (user) =>
  (!user || isAdminUser(user) || !user.id) ? [] : [user.id];

// O padrão não conta como filtro ativo: é o estado natural da tela, então não
// pinta o botão nem soma no badge. Qualquer desvio conta — inclusive o
// consultor abrindo o board para a equipe inteira, que precisa ficar visível
// para ele não achar que está olhando só a própria carteira.
export const isDefaultRespFilter = (user, respFilter = []) => {
  const padrao = defaultRespFilterFor(user);
  return respFilter.length === padrao.length && padrao.every((id, i) => respFilter[i] === id);
};

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
  // APELIDOS. O seletor de cores das Configurações (SETTINGS_COLOR_OPTIONS, em
  // components/ui/ColorPicker.jsx) nomeia as cores como o Tailwind; este mapa
  // nasceu com nomes semânticos. As duas convenções se separaram, e cinco das
  // dez cores oferecidas na tela não existiam aqui — etapa salva como 'amber'
  // caía no fallback cinza em silêncio, que é por que as colunas do funil
  // Vencidos estavam cinzas. Não é cor nova: é a MESMA cor com o outro nome.
  // Tem teste travando que toda opção do seletor existe neste mapa.
  amber:   { dot: 'bg-amber-500',   border: '#f59e0b' }, // = yellow
  violet:  { dot: 'bg-violet-500',  border: '#8b5cf6' }, // = purple
  rose:    { dot: 'bg-rose-500',    border: '#f43f5e' }, // = red
  emerald: { dot: 'bg-emerald-500', border: '#10b981' }, // = green
  slate:   { dot: 'bg-slate-400',   border: '#94a3b8' }, // = gray
};
const getKanbanColumnAccent = (color) => KANBAN_COLUMN_ACCENT[color] || KANBAN_COLUMN_ACCENT.gray;

// --- KANBAN: avatar com iniciais (cor estável por hash do nome) ---
// Cores de categoria do app a ~15%, texto no tom 700 — mesma mecânica de hash
// da paleta pastel anterior, sem o confete. [fundo, texto claro, texto dark].
const KANBAN_AVATAR_PALETTES = [
  ['rgba(43,89,255,.14)',  '#1C3FC4', '#9FBCFF'],
  ['rgba(139,92,246,.16)', '#6D28D9', '#C4B5FD'],
  ['rgba(255,106,43,.16)', '#C2410C', '#FDBA74'],
  ['rgba(16,185,129,.16)', '#047857', '#6EE7B7'],
  ['rgba(6,182,212,.16)',  '#0E7490', '#67E8F9'],
  ['rgba(236,72,153,.16)', '#BE185D', '#F9A8D4'],
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
// Página do Kanban: 10 por vez. É menor que a LIST_PAGE_SIZE (30) das listas
// longas de propósito — a coluna tem 264px e rola sozinha, então 30 cards de
// uma vez enchem a coluna sem ninguém ler o fim.
const KANBAN_PAGE_SIZE = 10;

// Rodapé do card: quanto tempo o lead está em SILÊNCIO (dias desde a última
// interação). Substitui o emoji 🔥/❄️ pelo número que existia atrás dele — os
// cortes espelham isHotLeadFromDate/isColdLeadFromDate (lib/leadStatus.js).
const kanbanSilence = (lastDate, now = new Date()) => {
  if (!(lastDate instanceof Date) || isNaN(lastDate.getTime())) {
    return { text: 'sem contato', tone: 'muted' };
  }
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startThat = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate()).getTime();
  const days = Math.max(0, Math.round((startToday - startThat) / 86400000));
  if (days === 0) return { text: 'contato hoje', tone: 'muted' };
  if (days <= 3) return { text: `${days}d sem contato`, tone: 'muted' };
  if (days <= 6) return { text: `${days}d sem contato`, tone: 'warn' };
  return { text: `${days}d sem contato`, tone: 'cold' };
};

// Janela do mês corrente em horário LOCAL, para a coluna Venda. Vira à meia-noite
// do dia 1: no mês novo a coluna nasce vazia, sem ninguém precisar limpar nada.
const monthWindow = (ref = new Date()) => {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
  return {
    startMs: start.getTime(),
    endMs: end.getTime(),
    label: start.toLocaleDateString('pt-BR', { month: 'long' }),
  };
};

export { KANBAN_COLUMN_ACCENT, getKanbanColumnAccent, KANBAN_AVATAR_PALETTES, getKanbanAvatarPalette, getKanbanInitials, fmtKanbanRelDate, fmtKanbanRelDateTime, KANBAN_PAGE_SIZE, kanbanSilence, monthWindow };
