// Estado de ciclo de vida da PESSOA (lead/cliente) → tom, rótulo, anel de
// estado e alerta contextual. Fonte única usada pelo RingAvatar, ProfileHeader,
// ContextAlert e LeadProfileView. Puro — deriva de lead + contrato.
import { deriveLeadContractStatus, CONTRACT_STATUS } from './contracts.js';
import { isLeadConverted } from './leads.js';

// Sistema de tons semânticos (paleta Tailwind). Cada tom traz as classes
// usadas em badges/dots/realces + o hex do 500 (p/ o glow do anel via alpha).
export const TONES = {
  brand:   { soft: 'bg-brand-50',   text: 'text-brand-700',   strong: 'bg-brand-600',   dot: 'bg-brand-600',   ring: 'ring-brand-500',   darkText: 'dark:text-brand-300',   darkSoft: 'dark:bg-brand-500/10',   hex: '#2B59FF' },
  emerald: { soft: 'bg-emerald-50', text: 'text-emerald-700', strong: 'bg-emerald-500', dot: 'bg-emerald-500', ring: 'ring-emerald-500', darkText: 'dark:text-emerald-300', darkSoft: 'dark:bg-emerald-500/10', hex: '#10B981' },
  amber:   { soft: 'bg-amber-50',   text: 'text-amber-700',   strong: 'bg-amber-500',   dot: 'bg-amber-500',   ring: 'ring-amber-500',   darkText: 'dark:text-amber-300',   darkSoft: 'dark:bg-amber-500/10',   hex: '#F59E0B' },
  violet:  { soft: 'bg-violet-50',  text: 'text-violet-700',  strong: 'bg-violet-500',  dot: 'bg-violet-500',  ring: 'ring-violet-500',  darkText: 'dark:text-violet-300',  darkSoft: 'dark:bg-violet-500/10',  hex: '#8B5CF6' },
  teal:    { soft: 'bg-teal-50',    text: 'text-teal-700',    strong: 'bg-teal-500',    dot: 'bg-teal-500',    ring: 'ring-teal-500',    darkText: 'dark:text-teal-300',    darkSoft: 'dark:bg-teal-500/10',    hex: '#14B8A6' },
  rose:    { soft: 'bg-rose-50',    text: 'text-rose-700',    strong: 'bg-rose-500',    dot: 'bg-rose-500',    ring: 'ring-rose-500',    darkText: 'dark:text-rose-300',    darkSoft: 'dark:bg-rose-500/10',    hex: '#F43F5E' },
  slate:   { soft: 'bg-slate-100',  text: 'text-slate-600',   strong: 'bg-slate-500',   dot: 'bg-slate-500',   ring: 'ring-slate-400',   darkText: 'dark:text-slate-300',   darkSoft: 'dark:bg-white/[0.06]',   hex: '#64748B' },
  pink:    { soft: 'bg-pink-50',    text: 'text-pink-700',    strong: 'bg-pink-500',    dot: 'bg-pink-500',    ring: 'ring-pink-500',    darkText: 'dark:text-pink-300',    darkSoft: 'dark:bg-pink-500/10',    hex: '#EC4899' }
};

export const getTone = (name) => TONES[name] || TONES.slate;

// Mapeia uma fase do pipeline (nome do estágio) para um tom. Estágios reais
// vêm do Firestore; estes são fallbacks p/ os nomes canônicos + Venda/Perda.
const PHASE_TONE = {
  'novo': 'brand',
  'em contato': 'amber',
  'visita agendada': 'violet',
  'aula experimental': 'teal',
  'negociando': 'rose',
  'negociação': 'rose',
  'venda': 'emerald',
  'perda': 'slate'
};
export const phaseToneName = (statusName, statusesArray = []) => {
  if (statusName === 'Venda') return 'emerald';
  if (statusName === 'Perda') return 'slate';
  const obj = (statusesArray || []).find(s => s.name === statusName);
  if (obj?.color && TONES[obj.color]) return obj.color;
  return PHASE_TONE[String(statusName || '').toLowerCase()] || 'brand';
};

// Estado de ciclo de vida da pessoa. Retorna { key, tone, label, hint }.
// key: lead | cliente_ativo | a_vencer | inativo | cancelado | perdido
export function deriveLeadState(lead, refDate = new Date(), thresholdDays) {
  if (!lead) return { key: 'lead', tone: 'brand', label: 'LEAD', hint: 'Em prospecção' };
  if (lead.status === 'Perda') {
    return { key: 'perdido', tone: 'rose', label: 'LEAD PERDIDO', hint: 'Oportunidade encerrada' };
  }
  const isClient = lead.lifecycleStage === 'cliente' || isLeadConverted(lead);
  if (isClient) {
    const cs = deriveLeadContractStatus(lead, refDate, thresholdDays);
    if (cs === CONTRACT_STATUS.A_VENCER) return { key: 'a_vencer', tone: 'amber', label: 'A VENCER', hint: 'Contrato perto do fim' };
    if (cs === CONTRACT_STATUS.VENCIDO) return { key: 'inativo', tone: 'slate', label: 'INATIVO', hint: 'Contrato vencido' };
    if (cs === CONTRACT_STATUS.CANCELADO) return { key: 'cancelado', tone: 'rose', label: 'CANCELADO', hint: 'Contrato cancelado' };
    return { key: 'cliente_ativo', tone: 'emerald', label: 'CLIENTE ATIVO', hint: 'Matrícula vigente' };
  }
  return { key: 'lead', tone: 'brand', label: 'LEAD', hint: 'Em prospecção' };
}

// Config do alerta contextual (faixa abaixo do header) por estado, ou null.
// `action` é um id semântico — o LeadProfileView liga ao handler real.
export function deriveContextAlert(state) {
  switch (state?.key) {
    case 'a_vencer':  return { tone: 'amber', icon: 'alert', title: 'Contrato a vencer', desc: 'O contrato deste cliente está perto do fim.', cta: 'Renovar agora', action: 'renew', ctaTone: 'accent' };
    case 'inativo':   return { tone: 'slate', icon: 'pause', title: 'Cliente inativo', desc: 'O contrato venceu. Reative a matrícula para retomar.', cta: 'Reativar matrícula', action: 'renew', ctaTone: 'brand' };
    case 'cancelado': return { tone: 'rose', icon: 'ban', title: 'Contrato cancelado', desc: 'A matrícula deste cliente foi cancelada.', cta: 'Nova matrícula', action: 'matricular', ctaTone: 'brand' };
    case 'perdido':   return { tone: 'rose', icon: 'ban', title: 'Lead perdido', desc: 'Esta oportunidade foi encerrada.', cta: 'Reabrir lead', action: 'reopen', ctaTone: 'brand' };
    default: return null;
  }
}
