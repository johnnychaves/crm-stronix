import React, { createContext, useCallback, useContext, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard,
  Users,
  Search,
  Plus,
  Calendar,
  MessageCircle,
  CheckCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  AlertTriangle,
  ArrowRight,
  Clock,
  LogOut,
  Activity,
  Phone,
  User,
  X,
  Shield,
  Lock,
  Mail,
  Trash2,
  Menu,
  Bell,
  AlertCircle,
  Pencil,
  Trash,
  GripVertical,
  ArrowRightLeft,
  RefreshCw,
  FileText,
  Settings,
  Kanban,
  Filter,
  Check,
  BarChart3,
  Trophy,
  ThumbsDown,
  Tag,
  Download,
  Moon,
  Sun,
  Target,
  Globe,
  Info,
  Flame,
  Zap,
  Building2,
  DollarSign,
  BookOpen,
  MessageSquare,
  MoreHorizontal,
  TrendingUp,
  ChevronRight,
  ChevronDown,
  Dumbbell,
  SlidersHorizontal,
  Ban,
  HelpCircle
} from 'lucide-react';

import confetti from 'canvas-confetti';

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  sendPasswordResetEmail,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';

import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  addDoc,
  serverTimestamp,
  getDocs,
  deleteDoc,
  writeBatch,
  query,
  where,
  updateDoc,
  deleteField
} from 'firebase/firestore';

// Firebase init + collection paths now live in src/lib/firebase.js
import {
  auth,
  db,
  appId,
  DEFAULT_TENANT_ID,
  setTenantId,
  LEADS_PATH,
  INTERACTIONS_PATH,
  USERS_PATH,
  SOURCES_PATH,
  STATUSES_PATH,
  TAGS_PATH,
  LOSS_REASONS_PATH,
  FUNNELS_PATH,
  MODALITIES_PATH,
  UNITS_PATH,
  CONFIG_PATH,
  CONFIG_GENERAL_ID,
  DAILY_GOAL_HISTORY_PATH
} from './lib/firebase.js';
// Pure utilities — see src/lib/{constants,dates,auth,leads,funnels}.js
import { statusGradientMap } from './lib/constants.js';
import { getSafeDate, getSafeDateOrNull, normalizeAppointmentType } from './lib/dates.js';
import {
  getLeadAppointmentType,
  getLeadAppointmentDate,
  isLeadConverted,
  getLeadConversionDate,
  isLeadAttended,
  getLeadAttendanceDate,
  getAppointmentOutcomeMeta,
  APPOINTMENT_OUTCOMES,
  DAILY_GOAL_CATEGORIES,
  DAILY_GOAL_CATEGORY_LABEL,
  hasGoalDoneToday,
  isLeadResolvedToday,
  hasActiveInteractionToday,
  isRegistrationNote,
  isAdminUser,
  canEditLead,
  getLeadOwnershipFields,
  getInteractionSecurityFields
} from './lib/leads.js';
import { getDefaultFunnel, isItemInFunnel, commitOpsInChunks, ALL_FUNNELS_ID, isAllFunnels } from './lib/funnels.js';

// ============================================================
// MARCA STRONILEAD — símbolo "The Surge" + wordmark
// (apenas apresentação; usados no login, sidebar e header)
// ============================================================

// Símbolo: três chevrons ascendentes (funil → conversão → matrícula).
// Os dois inferiores em brand; o topo em accent (laranja) = resultado.
// tone: 'brand' (chevrons em brand-600) | 'onDark' (chevrons brancos).
function SurgeMark({ size = 32, tone = 'brand', className = '' }) {
  const lower = tone === 'onDark' ? '#FFFFFF' : 'var(--color-brand-600)';
  const top = 'var(--color-accent-500)';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="STRONILEAD"
      className={className}
    >
      <path d="M11 39 L24 29 L37 39" stroke={lower} strokeWidth="4.4" />
      <path d="M13.5 30 L24 21.5 L34.5 30" stroke={lower} strokeWidth="4.4" />
      <path d="M16 21 L24 14 L32 21" stroke={top} strokeWidth="4.4" />
    </svg>
  );
}

// Wordmark: STRONI (peso 500) + LEAD (peso 700).
// leadOnDark → "LEAD" em brand-300 sobre fundo escuro; senão brand-600.
function StronileadWordmark({ className = '', leadOnDark = false }) {
  return (
    <span className={`font-display tracking-tight leading-none whitespace-nowrap ${className}`}>
      <span className="font-medium">STRONI</span>
      <span className={`font-bold ${leadOnDark ? 'text-brand-300' : 'text-brand-600'}`}>LEAD</span>
    </span>
  );
}

// Tela de bloqueio quando a academia está suspensa ou com trial expirado.
// O usuário autenticou, mas a organização não está liberada — só resta sair.
// Banner de contagem regressiva do período de teste (mostrado ao cliente quando
// a academia está em trial ATIVO). Fica âmbar (urgência) quando faltam <= 3 dias.
function TrialBanner({ endsAtMs }) {
  const DAY = 24 * 60 * 60 * 1000;
  const daysLeft = Math.max(0, Math.ceil((endsAtMs - Date.now()) / DAY));
  const dateLabel = new Date(endsAtMs).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const urgent = daysLeft <= 3;
  const msg = daysLeft <= 0
    ? 'Seu período de teste termina hoje'
    : daysLeft === 1
      ? 'Falta 1 dia do seu período de teste'
      : `Faltam ${daysLeft} dias do seu período de teste`;
  return (
    <div className={`shrink-0 px-4 md:px-8 py-2 flex items-center justify-center gap-2 text-[12.5px] font-medium border-b ${urgent
      ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20'
      : 'bg-brand-50 text-brand-700 border-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:border-white/[0.06]'}`}>
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>{msg} <span className="opacity-70">· termina em {dateLabel}</span></span>
    </div>
  );
}

function TenantBlockedScreen({ reason, onLogout }) {
  const suspended = reason === 'suspended';
  const Icon = suspended ? Ban : Clock;
  const title = suspended ? 'Academia suspensa' : 'Período de teste encerrado';
  const message = suspended
    ? 'Esta academia está temporariamente suspensa. Entre em contato com o suporte do STRONILEAD para regularizar o acesso.'
    : 'O período de teste desta academia terminou. Fale com o suporte do STRONILEAD para ativar um plano e continuar usando o sistema.';
  return (
    <div className="min-h-screen bg-paper-50 dark:bg-ink-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] shadow-card-lg p-8">
        <div className="flex items-center justify-center gap-2 mb-6">
          <SurgeMark size={26} />
          <StronileadWordmark className="text-[18px] text-gray-900 dark:text-white" />
        </div>
        <span className={`mx-auto mb-4 w-14 h-14 rounded-2xl grid place-items-center ${suspended ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-accent-50 text-accent-500 dark:bg-accent-500/10'}`}>
          <Icon className="w-7 h-7" />
        </span>
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-gray-900 dark:text-white">{title}</h1>
        <p className="mt-2 text-[14px] text-gray-500 dark:text-neutral-400 leading-relaxed">{message}</p>
        <button
          onClick={onLogout}
          className="mt-7 w-full h-11 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[14px] font-semibold transition active:scale-[.99]"
        >
          Sair
        </button>
      </div>
    </div>
  );
}

// Tela pública de aceite de convite (/?invite=<token>&t=<tenantId>). Cria a
// conta do convidado (e-mail vem do convite) e faz login automático.
function AcceptInviteScreen({ token, tenantId }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const fieldWrap = 'mt-1.5 relative flex items-center rounded-xl border bg-white dark:bg-white/[0.03] transition border-gray-200 dark:border-white/[0.08] focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/15';
  const inputClass = 'w-full h-12 bg-transparent outline-none text-[14px] px-3 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-neutral-500';

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    if (!name.trim()) { setError('Informe seu nome.'); return; }
    if (password.length < 6) { setError('A senha precisa ter ao menos 6 caracteres.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/invite-accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, token, password, name: name.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Não foi possível aceitar o convite.');
        setLoading(false);
        return;
      }
      // Login automático e entrada no app (recarrega sem o ?invite).
      try {
        await signInWithEmailAndPassword(auth, data.email, password);
        window.location.replace('/');
        return;
      } catch {
        // Conta criada mas auto-login falhou: orienta login manual.
        setDone(true);
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao aceitar o convite. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper-50 dark:bg-ink-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[400px] rounded-3xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] shadow-card-lg p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <SurgeMark size={24} />
          <StronileadWordmark className="text-[17px] text-gray-900 dark:text-white" />
        </div>
        {done ? (
          <div className="text-center">
            <span className="mx-auto mb-4 w-12 h-12 rounded-2xl grid place-items-center bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Check className="w-6 h-6" />
            </span>
            <h1 className="font-display text-[20px] font-semibold tracking-tight text-gray-900 dark:text-white">Conta criada!</h1>
            <p className="mt-2 text-[13.5px] text-gray-500 dark:text-neutral-400">Faça login com seu e-mail e a senha que você acabou de definir.</p>
            <button onClick={() => window.location.replace('/')} className="mt-6 w-full h-11 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[14px] font-semibold transition">Ir para o login</button>
          </div>
        ) : (
          <>
            <h1 className="font-display text-[22px] font-semibold tracking-tight text-gray-900 dark:text-white">Você foi convidado</h1>
            <p className="mt-1.5 text-[13.5px] text-gray-500 dark:text-neutral-400">
              Crie sua conta para acessar a academia <span className="font-semibold text-gray-700 dark:text-neutral-200 num">{tenantId}</span>.
            </p>
            {error && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-3.5 py-2.5 text-[12.5px] text-rose-700 dark:text-rose-300">
                <AlertTriangle className="w-[15px] h-[15px] mt-px shrink-0" /><span>{error}</span>
              </div>
            )}
            <form onSubmit={submit} className="mt-5 space-y-4">
              <label className="block">
                <span className="text-[12.5px] font-semibold text-gray-700 dark:text-neutral-300">Seu nome</span>
                <div className={fieldWrap}>
                  <span className="pl-3.5 text-gray-400 dark:text-neutral-500"><User className="w-[17px] h-[17px]" /></span>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" className={inputClass} required />
                </div>
              </label>
              <label className="block">
                <span className="text-[12.5px] font-semibold text-gray-700 dark:text-neutral-300">Senha</span>
                <div className={fieldWrap}>
                  <span className="pl-3.5 text-gray-400 dark:text-neutral-500"><Lock className="w-[17px] h-[17px]" /></span>
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="mín. 6 caracteres" className={inputClass} required />
                  <span className="pr-2">
                    <button type="button" onClick={() => setShowPass(s => !s)} className="w-9 h-9 grid place-items-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition">
                      {showPass ? <EyeOff className="w-[17px] h-[17px]" /> : <Eye className="w-[17px] h-[17px]" />}
                    </button>
                  </span>
                </div>
              </label>
              <button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[14px] font-semibold inline-flex items-center justify-center gap-2 transition active:scale-[.99] disabled:opacity-90">
                {loading ? (<><span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white spin"></span> Criando…</>) : (<>Aceitar convite <ArrowRight className="w-4 h-4" /></>)}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// --- HELPERS DE TEMPERATURA DO LEAD ---
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Normaliza a lista de opções de quantidade de aulas experimentais:
// inteiros positivos, sem repetição, ordenados. Aceita também um número
// legado `fallbackMax` (config antiga com maxTrialClasses) → vira [1..max].
// Nunca retorna vazio: cai para [1, 2, 3].
const normalizeTrialClassOptions = (raw, fallbackMax) => {
  let list = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (Number.isFinite(Number(fallbackMax)) && Number(fallbackMax) > 0) {
    const max = Math.floor(Number(fallbackMax));
    list = Array.from({ length: max }, (_, i) => i + 1);
  }
  const clean = Array.from(new Set(
    list.map(n => Math.floor(Number(n))).filter(n => Number.isFinite(n) && n >= 1 && n <= 99)
  )).sort((a, b) => a - b);
  return clean.length ? clean : [1, 2, 3];
};

// Dias da semana (0=dom..6=sáb) em que a Meta Diária vale. Default seg–sex.
const normalizeMetaWeekdays = (raw) => {
  if (!Array.isArray(raw)) return [1, 2, 3, 4, 5];
  const clean = Array.from(new Set(
    raw.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6)
  )).sort((a, b) => a - b);
  return clean.length ? clean : [1, 2, 3, 4, 5];
};

// Índice leadId -> { count, lastDate } construído UMA vez em O(interações).
// Antes, cada card/linha recomputava interactions.filter() por lead — dava
// O(leads × interações) a cada render/tecla. Monte num useMemo([interactions])
// e passe lastDate aos badges (LeadTemperatureBadge/DaysSinceContactBadge) e
// use nos filtros (ex: "Apenas Hot").
const buildInteractionIndex = (interactions) => {
  const idx = new Map();
  (interactions || []).forEach(i => {
    let e = idx.get(i.leadId);
    if (!e) { e = { count: 0, lastDate: null }; idx.set(i.leadId, e); }
    e.count += 1;
    if (i.createdAt instanceof Date && (!e.lastDate || i.createdAt > e.lastDate)) {
      e.lastDate = i.createdAt;
    }
  });
  return idx;
};

const isLeadActive = (lead) => {
  return lead && lead.status !== 'Venda' && lead.status !== 'Perda';
};

// --- Predicados de temperatura/recência. Recebem a última data de interação
// já resolvida (via buildInteractionIndex.get(id)?.lastDate), sem varrer o
// array por lead — O(1) por lead em listas. ---

const getDaysSinceFromDate = (lead, lastInteractionDate) => {
  const last = (lastInteractionDate instanceof Date ? lastInteractionDate : null) || lead?.createdAt;
  if (!(last instanceof Date) || isNaN(last.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - last.getTime()) / DAY_MS));
};

const isHotLeadFromDate = (lead, lastInteractionDate) => {
  if (!isLeadActive(lead)) return false;
  const now = Date.now();

  // Critério 1: lead recém-criado (últimas 6 horas)
  if (lead.createdAt instanceof Date) {
    const ageMs = now - lead.createdAt.getTime();
    if (ageMs >= 0 && ageMs <= 6 * HOUR_MS) return true;
  }

  // Critério 2: interação nas últimas 24h
  if (lastInteractionDate instanceof Date) {
    const sinceMs = now - lastInteractionDate.getTime();
    if (sinceMs >= 0 && sinceMs <= 24 * HOUR_MS) return true;
  }

  // Critério 3: visita ou aula experimental agendada nas próximas 48h
  const appointmentType = getLeadAppointmentType(lead);
  const appointmentDate = getLeadAppointmentDate(lead);
  if (appointmentType && appointmentDate instanceof Date && !isNaN(appointmentDate.getTime())) {
    const untilMs = appointmentDate.getTime() - now;
    if (untilMs >= 0 && untilMs <= 48 * HOUR_MS) return true;
  }

  return false;
};

const isColdLeadFromDate = (lead, lastInteractionDate) => {
  if (!isLeadActive(lead)) return false;
  // Hot e cold são mutuamente exclusivos — hot tem prioridade
  if (isHotLeadFromDate(lead, lastInteractionDate)) return false;
  const days = getDaysSinceFromDate(lead, lastInteractionDate);
  return days !== null && days >= 7;
};

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
function KanbanAvatar({ name = '', size = 32 }) {
  const [bg, fg] = getKanbanAvatarPalette(name);
  return (
    <div
      className="rounded-full grid place-items-center font-semibold shrink-0 ring-1 ring-black/5"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.36) }}
    >
      {getKanbanInitials(name)}
    </div>
  );
}

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

// ==========================================
// COMPONENTE PRINCIPAL (APP)
// ==========================================
export default function App() {
  // Roteamento mínimo por query-param (app single-page, sem react-router):
  // /?invite=<token>&t=<tenantId> abre a tela pública de aceite de convite.
  const [invite] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return { token: p.get('invite'), tenantId: p.get('t') };
    } catch {
      return { token: null, tenantId: null };
    }
  });
  return (
    <ToastProvider>
      {invite.token && invite.tenantId
        ? <AcceptInviteScreen token={invite.token} tenantId={invite.tenantId} />
        : <AppInner />}
    </ToastProvider>
  );
}

// Lê o slug da academia da URL: primeiro o PATH (stronilead.com.br/<slug>) e,
// como compatibilidade com links antigos, o HASH (#<slug>, #/slug, #/t/slug).
// Retorna '' se não houver/for inválido.
function getTenantSlug() {
  const re = /^[a-z0-9][a-z0-9-]{0,63}$/;
  try {
    // 1) path-based: /<slug>
    const seg = String(window.location.pathname || '').replace(/^\/+/, '').split('/')[0].trim().toLowerCase();
    if (re.test(seg)) return seg;
    // 2) fallback: hash
    const raw = String(window.location.hash || '').replace(/^#\/?(t\/)?/i, '').trim().toLowerCase();
    const h = raw.split(/[/?#&]/)[0];
    return re.test(h) ? h : '';
  } catch {
    return '';
  }
}

function AppInner() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [authSetupError, setAuthSetupError] = useState('');
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  // Bloqueio da academia: 'suspended' | 'trial_expired' | null. Lido do doc
  // /tenants/{id} no login (regra permite leitura ao próprio tenant).
  const [tenantBlock, setTenantBlock] = useState(null);
  // Fim do trial (ms) quando a academia está em teste ATIVO — alimenta o
  // banner de contagem regressiva. null quando não há trial ativo.
  const [trialEndsAtMs, setTrialEndsAtMs] = useState(null);
  // Academia identificada pela URL (#<slug>) — só para exibir a MARCA no login.
  // NÃO controla acesso (isso continua sendo o claim tenantId + as rules).
  // Formato: { slug, loading? , found?, displayName? }. Init lazy a partir do hash.
  const [urlTenant, setUrlTenant] = useState(() => {
    const slug = getTenantSlug();
    return slug ? { slug, loading: true } : null;
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Accordion "Leads" no menu lateral (Todos os leads / Aulas / Visitas).
  const [leadsMenuOpen, setLeadsMenuOpen] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Resolve a academia do hash da URL (#<slug>) para exibir o nome na tela de
  // login. Público (pré-auth) via /api/tenant-resolve. Roda uma vez no mount.
  useEffect(() => {
    const slug = getTenantSlug();
    if (!slug) return;
    let alive = true;
    fetch(`/api/tenant-resolve?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(d => { if (alive) setUrlTenant(d?.found ? { slug, found: true, displayName: d.displayName } : { slug, found: false }); })
      .catch(() => { if (alive) setUrlTenant({ slug, found: false }); });
    return () => { alive = false; };
  }, []);

  // Mantém a URL (/<slug>) em sincronia com o tenant real após o login — cada
  // academia fica com um link próprio e bookmarkável (stronilead.com.br/<slug>).
  // O acesso vem do claim; se a URL apontava para outra academia, é apenas
  // corrigida (sem bloquear ninguém). replaceState não recarrega a página.
  useEffect(() => {
    if (appUser && !appUser.superAdminOnly && appUser.tenantId) {
      if (getTenantSlug() !== appUser.tenantId) {
        try { window.history.replaceState(null, '', '/' + appUser.tenantId + window.location.search); } catch { /* noop */ }
      }
    }
  }, [appUser]);

  // Título da aba do navegador: nome da academia (quando resolvido) + STRONILEAD.
  useEffect(() => {
    document.title = urlTenant?.displayName ? `${urlTenant.displayName} · STRONILEAD` : 'STRONILEAD';
  }, [urlTenant]);

  const [leads, setLeads] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [sources, setSources] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [tags, setTags] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [lossReasons, setLossReasons] = useState([]); // NOVO ESTADO
  const [funnels, setFunnels] = useState([]);
  // Configurações Gerais da academia: modalidades + opções de quantidade de aulas + unidades.
  const [modalities, setModalities] = useState([]);
  const [trialClassOptions, setTrialClassOptions] = useState([1, 2, 3]);
  const [units, setUnits] = useState([]);
  // Dias da semana em que a Meta Diária vale para a equipe (0=dom..6=sáb).
  // Política da ACADEMIA — definida pelo admin nas Configurações Gerais.
  const [metaWeekdays, setMetaWeekdays] = useState([1, 2, 3, 4, 5]);
  // Valor do GeneralConfigContext (declarado aqui, antes de qualquer early return,
  // para respeitar as regras dos hooks).
  const generalConfigValue = useMemo(
    () => ({ modalities, trialClassOptions, units, metaWeekdays }),
    [modalities, trialClassOptions, units, metaWeekdays]
  );
  // Seleção de funil persistida POR TENANT (a chave inclui o appId). No init o
  // tenant ainda não foi resolvido (appId = default), o que é correto para o
  // tenant #1; para outros tenants, um id de funil "estranho" é auto-corrigido
  // pelo effect de validação de funil (cai no default).
  const [selectedFunnelId, setSelectedFunnelId] = useState(() => {
    try { return localStorage.getItem(`crm-selected-funnel:${appId}`) || null; } catch { return null; }
  });
  const [funnelsMigrationStatus, setFunnelsMigrationStatus] = useState('idle');
  const [loadingData, setLoadingData] = useState(true);
  // Erro de leitura em algum onSnapshot (permissão/rede) — evita falha silenciosa.
  const [loadError, setLoadError] = useState(false);

  // Quick-add lead: aberto pelo botão "Cadastrar Lead" no menu lateral OU
  // pelo botão dentro de LeadsView (que recebe `onAddLeadClick` via prop).
  // O modal mora aqui em App pra ficar acessível de qualquer aba.
  const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState(false);

  // Após criar o lead, abrimos o perfil dele automaticamente. Como o
  // `addDoc` retorna só o ref, esperamos o lead aparecer em `leads` via
  // onSnapshot (geralmente <100ms). justCreatedLeadId é o ID alvo;
  // appLevelSelectedLead é o doc completo já hidratado.
  const [justCreatedLeadId, setJustCreatedLeadId] = useState(null);
  const [appLevelSelectedLead, setAppLevelSelectedLead] = useState(null);

  // 1. Inicialização Auth e Persistência de Sessão
  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    setFirebaseUser(currentUser);

    if (!currentUser) {
      setAppUser(null);
      setTenantBlock(null);
      setTrialEndsAtMs(null);
      setIsAuthChecking(false);
      return;
    }

    try {
      // --- Multi-tenant: resolve o tenant ANTES de qualquer acesso ao
      // Firestore, lendo o custom claim `tenantId` do token. Se faltar (usuário
      // legado ainda sem claim), força um refresh do token e tenta de novo;
      // persistindo a ausência, cai no tenant padrão (compatível com o estado
      // mono-tenant). setTenantId precede setAppUser, então os effects de
      // data-load e seed (que gateiam em appUser) já enxergam o tenant certo.
      let tenantId;
      let superAdmin = false;
      let impersonatedBy = null;      // claim presente quando o super-admin entrou "como" este tenant
      let impersonatedTenant = null;
      try {
        let tokenResult = await currentUser.getIdTokenResult();
        tenantId = tokenResult.claims.tenantId;
        if (!tenantId) {
          tokenResult = await currentUser.getIdTokenResult(true); // force refresh
          tenantId = tokenResult.claims.tenantId;
        }
        superAdmin = tokenResult.claims.superAdmin === true;
        impersonatedBy = tokenResult.claims.impersonatedBy || null;
        impersonatedTenant = tokenResult.claims.impersonatedTenant || null;
      } catch (claimErr) {
        console.warn('Falha ao ler claim de tenant; usando tenant padrão.', claimErr);
      }
      // Conta sem organização e que NÃO é super-admin: não cair no tenant padrão
      // (evita uma sessão "logada" apontando para o tenant errado). Desloga com
      // mensagem clara. (As rules já negariam as leituras, mas isto torna o
      // comportamento explícito e seguro — sem sessão num tenant que não é o seu.)
      if (!tenantId && !superAdmin) {
        console.warn('Usuário sem claim de tenant e sem super-admin — acesso negado.');
        setAuthSetupError('Sua conta não está vinculada a nenhuma organização. Contate o suporte.');
        setAppUser(null);
        try { await signOut(auth); } catch (signOutErr) { console.error(signOutErr); }
        setIsAuthChecking(false);
        return;
      }
      setTenantId(tenantId || DEFAULT_TENANT_ID);

      // Status da academia (suspensão / trial expirado). Best-effort: se o doc
      // /tenants/{id} não existir (tenant legado) ou a leitura falhar, libera o
      // acesso. Super-admin sem tenant não tem o que checar.
      if (tenantId) {
        try {
          const tenantSnap = await getDoc(doc(db, 'tenants', tenantId));
          const tData = tenantSnap.exists() ? tenantSnap.data() : null;
          let block = null;
          let trialMs = null;
          if (tData) {
            if (tData.status === 'suspended') {
              block = 'suspended';
            } else if (tData.status === 'trial' && typeof tData.trialEndsAt?.toMillis === 'function') {
              const ms = tData.trialEndsAt.toMillis();
              if (ms < Date.now()) block = 'trial_expired';
              else trialMs = ms; // trial ativo → alimenta o banner de contagem
            }
          }
          setTenantBlock(block);
          setTrialEndsAtMs(trialMs);
        } catch (statusErr) {
          console.warn('Falha ao ler status do tenant; liberando acesso.', statusErr);
          setTenantBlock(null);
          setTrialEndsAtMs(null);
        }
      } else {
        setTenantBlock(null);
        setTrialEndsAtMs(null);
      }

      // Super-admin SEM tenant: não tem claim de tenant, então NÃO pode (nem
      // precisa) consultar stronix_users — as regras bloqueariam (permission
      // denied) e cairia no catch. Entra direto numa sessão só de super-admin
      // (tela "Organizações"), antes de qualquer acesso ao Firestore.
      if (superAdmin && !tenantId) {
        const normalizedEmail = String(currentUser.email || '').trim().toLowerCase();
        setAppUser({
          id: currentUser.uid,
          authUid: currentUser.uid,
          name: (normalizedEmail || 'Super-admin').split('@')[0],
          email: normalizedEmail,
          role: 'superadmin',
          superAdmin: true,
          superAdminOnly: true,
          tenantId: null
        });
        setAuthSetupError('');
        setIsAuthChecking(false);
        return;
      }

      const usersRef = collection(db, 'artifacts', appId, 'public', 'data', USERS_PATH);

      const byUidQuery = query(usersRef, where('authUid', '==', currentUser.uid));
      const byUidSnap = await getDocs(byUidQuery);

      if (!byUidSnap.empty) {
        const userDoc = byUidSnap.docs[0];
        setAppUser({ id: userDoc.id, ...userDoc.data(), tenantId: appId, superAdmin, impersonating: !!impersonatedBy, impersonatedTenant });
        setAuthSetupError('');
        setIsAuthChecking(false);
        return;
      }

      const normalizedEmail = String(currentUser.email || '').trim().toLowerCase();

      if (normalizedEmail) {
        const byEmailQuery = query(usersRef, where('email', '==', normalizedEmail));
        const byEmailSnap = await getDocs(byEmailQuery);

        if (!byEmailSnap.empty) {
          const userDoc = byEmailSnap.docs[0];

          await updateDoc(
            doc(db, 'artifacts', appId, 'public', 'data', USERS_PATH, userDoc.id),
            {
              authUid: currentUser.uid,
              email: normalizedEmail
            }
          );

          setAppUser({
            id: userDoc.id,
            ...userDoc.data(),
            authUid: currentUser.uid,
            email: normalizedEmail,
            tenantId: appId,
            superAdmin,
            impersonating: !!impersonatedBy,
            impersonatedTenant
          });

          setAuthSetupError('');
          setIsAuthChecking(false);
          return;
        }
      }

      // Super-admin "puro": tem o claim superAdmin mas não é membro de nenhum
      // tenant. Em vez de deslogar, deixa entrar numa sessão só de super-admin
      // (vê apenas a tela "Organizações"; não carrega dados de tenant).
      if (superAdmin) {
        const fallbackName = (normalizedEmail || 'Super-admin').split('@')[0];
        setAppUser({
          id: currentUser.uid,
          authUid: currentUser.uid,
          name: fallbackName,
          email: normalizedEmail,
          role: 'superadmin',
          superAdmin: true,
          superAdminOnly: true,
          tenantId: null
        });
        setAuthSetupError('');
        setIsAuthChecking(false);
        return;
      }

      setAppUser(null);
      setAuthSetupError('Usuário autenticado sem vínculo interno no CRM.');
      try { await signOut(auth); } catch (signOutErr) { console.error(signOutErr); }
    } catch (e) {
      console.error('Erro ao recuperar sessão do usuário', e);
      setAppUser(null);
      setAuthSetupError('Erro ao validar sessão do usuário.');
      try { await signOut(auth); } catch (signOutErr) { console.error(signOutErr); }
    }

    setIsAuthChecking(false);
  });

  return () => unsubscribe();
}, []);

  // 2. Leitura de Dados
useEffect(() => {
  if (!firebaseUser || !appUser) return;
  // Super-admin sem tenant não carrega dados de organização (só usa a tela Organizações).
  if (appUser.superAdminOnly) { setLoadingData(false); return; }
  // Academia bloqueada (suspensa / trial expirado): não tenta carregar dados —
  // a tela de bloqueio é exibida e as rules também negam no servidor. Evita
  // permission-denied silencioso nos onSnapshot.
  if (tenantBlock) { setLoadingData(false); return; }
  setLoadingData(true);
  setLoadError(false);

  // Falha em qualquer listener (permissão negada por corrida de suspensão, rede,
  // etc.) NÃO pode ser silenciosa — sinaliza erro e encerra o loading.
  const onSnapErr = (label) => (err) => {
    console.error(`onSnapshot ${label} falhou`, err);
    setLoadError(true);
    setLoadingData(false);
  };

  const leadsRef = collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH);
  const interactionsRef = collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH);
  const usersRef = collection(db, 'artifacts', appId, 'public', 'data', USERS_PATH);

  const leadsSource = isAdminUser(appUser)
    ? leadsRef
    : query(leadsRef, where('consultantAuthUid', '==', appUser.authUid));

  const interactionsSource = isAdminUser(appUser)
    ? interactionsRef
    : query(interactionsRef, where('leadConsultantAuthUid', '==', appUser.authUid));

  const unsubLeads = onSnapshot(leadsSource, (snapshot) => {
    const leadsData = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: getSafeDate(data.createdAt),
        nextFollowUp: getSafeDateOrNull(data.nextFollowUp),
        appointmentOutcomeAt: getSafeDateOrNull(data.appointmentOutcomeAt)
      };
    });

    setLeads(leadsData);
    setLoadingData(false);
  }, onSnapErr('leads'));

  const unsubInteractions = onSnapshot(interactionsSource, (snapshot) => {
    setInteractions(
      snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: getSafeDate(data.createdAt)
        };
      })
    );
  }, onSnapErr('interactions'));

  const unsubSources = onSnapshot(
    collection(db, 'artifacts', appId, 'public', 'data', SOURCES_PATH),
    (snapshot) => {
      setSources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    },
    onSnapErr('sources')
  );

  const unsubStatuses = onSnapshot(
    collection(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH),
    (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
      setStatuses(data);
    },
    onSnapErr('statuses')
  );

  const unsubTags = onSnapshot(
    collection(db, 'artifacts', appId, 'public', 'data', TAGS_PATH),
    (snapshot) => {
      setTags(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    },
    onSnapErr('tags')
  );

  const unsubLossReasons = onSnapshot(
    collection(db, 'artifacts', appId, 'public', 'data', LOSS_REASONS_PATH),
    (snapshot) => {
      setLossReasons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    },
    onSnapErr('lossReasons')
  );

  const unsubFunnels = onSnapshot(
    collection(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH),
    (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
      setFunnels(data);
    },
    onSnapErr('funnels')
  );

  const unsubModalities = onSnapshot(
    collection(db, 'artifacts', appId, 'public', 'data', MODALITIES_PATH),
    (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
      setModalities(data);
    },
    onSnapErr('modalities')
  );

  const unsubUnits = onSnapshot(
    collection(db, 'artifacts', appId, 'public', 'data', UNITS_PATH),
    (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
      setUnits(data);
    },
    onSnapErr('units')
  );

  // Config geral é um doc único (singleton). Lê a lista de opções de quantidade
  // de aulas experimentais; aceita config antiga (maxTrialClasses) como fallback.
  const unsubConfig = onSnapshot(
    doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CONFIG_GENERAL_ID),
    (snap) => {
      const data = snap.exists() ? snap.data() : null;
      setTrialClassOptions(normalizeTrialClassOptions(data?.trialClassOptions, data?.maxTrialClasses));
      setMetaWeekdays(normalizeMetaWeekdays(data?.metaWeekdays));
    },
    () => { setTrialClassOptions([1, 2, 3]); setMetaWeekdays([1, 2, 3, 4, 5]); }
  );

  let unsubUsers = () => {};
  if (isAdminUser(appUser)) {
    unsubUsers = onSnapshot(usersRef, (snapshot) => {
      setUsersList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  } else {
    setUsersList([appUser]);
  }

  return () => {
    unsubLeads();
    unsubInteractions();
    unsubSources();
    unsubStatuses();
    unsubTags();
    unsubLossReasons();
    unsubFunnels();
    unsubModalities();
    unsubUnits();
    unsubConfig();
    unsubUsers();
  };
}, [firebaseUser, appUser, tenantBlock]);

  // Persiste a seleção de funil no localStorage, com chave por tenant.
  useEffect(() => {
    try {
      if (selectedFunnelId) {
        localStorage.setItem(`crm-selected-funnel:${appId}`, selectedFunnelId);
      }
    } catch (e) { /* ignore */ }
  }, [selectedFunnelId, appUser]);

  // Quando um lead é criado pelo AddLeadModal global, ele guarda o ID em
  // justCreatedLeadId. Aqui esperamos o doc aparecer em `leads` (via
  // onSnapshot) e abrimos o perfil dele automaticamente.
  useEffect(() => {
    if (!justCreatedLeadId) return;
    const lead = (leads || []).find(l => l.id === justCreatedLeadId);
    if (lead) {
      setAppLevelSelectedLead(lead);
      setJustCreatedLeadId(null);
    }
  }, [justCreatedLeadId, leads]);

  // Garante que selectedFunnelId é sempre válido (cai para o default se sumir).
  // O sentinel ALL_FUNNELS_ID é sempre válido — não cai no fallback.
  useEffect(() => {
    if (!funnels || funnels.length === 0) return;
    if (isAllFunnels(selectedFunnelId)) return;
    if (!selectedFunnelId || !funnels.find(f => f.id === selectedFunnelId)) {
      const fallback = getDefaultFunnel(funnels);
      if (fallback) setSelectedFunnelId(fallback.id);
    }
  }, [funnels, selectedFunnelId]);

  // Cross-tab reset: o modo "Todos os funis" só existe no Dashboard.
  // Ao trocar para Kanban/Leads/Meta, voltar para o funil default.
  useEffect(() => {
    if (!isAllFunnels(selectedFunnelId)) return;
    if (activeTab === 'dashboard') return;
    const fallback = getDefaultFunnel(funnels)?.id;
    if (fallback) setSelectedFunnelId(fallback);
  }, [activeTab, selectedFunnelId, funnels]);

  // Migração idempotente: cria funil "Comercial" default e backfill de funnelId em leads/statuses
  useEffect(() => {
    if (!appUser || !isAdminUser(appUser)) return;
    if (loadingData) return;
    if (funnelsMigrationStatus !== 'idle') return;

    setFunnelsMigrationStatus('running');

    (async () => {
      try {
        // Passo 1: garantir EXATAMENTE um funil default
        const funnelsSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH));
        const allFunnels = funnelsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const defaults = allFunnels.filter(f => f.isDefault === true);

        let defaultFunnel = null;

        if (defaults.length === 0) {
          if (allFunnels.length === 0) {
            // Sem nenhum funil → cria o "Comercial" como default
            const ref = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH), {
              name: 'Comercial',
              order: 0,
              isDefault: true,
              createdAt: serverTimestamp()
            });
            defaultFunnel = { id: ref.id, name: 'Comercial', order: 0, isDefault: true };
          } else {
            // Há funis mas nenhum é default → promove o de menor order
            const sorted = [...allFunnels].sort((a, b) => (a.order || 0) - (b.order || 0));
            const promote = sorted[0];
            await setDoc(
              doc(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH, promote.id),
              { isDefault: true },
              { merge: true }
            );
            defaultFunnel = { ...promote, isDefault: true };
          }
        } else if (defaults.length === 1) {
          defaultFunnel = defaults[0];
        } else {
          // Múltiplos isDefault → manter o criado primeiro (createdAt mais antigo),
          // empate por menor order. Demove os outros.
          const getTs = (f) => {
            const c = f.createdAt;
            if (!c) return Number.POSITIVE_INFINITY;
            if (typeof c.toMillis === 'function') return c.toMillis();
            if (c.seconds) return c.seconds * 1000;
            return Number(c) || Number.POSITIVE_INFINITY;
          };
          const sorted = [...defaults].sort((a, b) => {
            const ta = getTs(a);
            const tb = getTs(b);
            if (ta !== tb) return ta - tb;
            return (a.order || 0) - (b.order || 0);
          });
          defaultFunnel = sorted[0];
          const demoteOps = sorted.slice(1).map(f => ({
            ref: doc(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH, f.id),
            data: { isDefault: false }
          }));
          if (demoteOps.length) await commitOpsInChunks(db, demoteOps, 400);
        }

        const defaultId = defaultFunnel.id;

        // Passo 2: backfill statuses sem funnelId
        const statusesSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH));
        const statusOps = [];
        statusesSnap.forEach(d => {
          const data = d.data();
          if (!data.funnelId) {
            statusOps.push({ ref: d.ref, data: { funnelId: defaultId } });
          }
        });
        if (statusOps.length) await commitOpsInChunks(db, statusOps, 400);

        // Passo 3: backfill leads sem funnelId
        const leadsSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH));
        const leadOps = [];
        leadsSnap.forEach(d => {
          const data = d.data();
          if (!data.funnelId) {
            leadOps.push({ ref: d.ref, data: { funnelId: defaultId } });
          }
        });
        if (leadOps.length) await commitOpsInChunks(db, leadOps, 400);

        // Passo 4: garantir que TODO funil tem a etapa de sistema "Negociação"
        // (criada como protegida; ManageStatusesTab bloqueia edit/delete por nome).
        const statusesAfter = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH));
        const statusesByFunnel = new Map();
        statusesAfter.forEach(d => {
          const s = { id: d.id, ...d.data() };
          if (!statusesByFunnel.has(s.funnelId)) statusesByFunnel.set(s.funnelId, []);
          statusesByFunnel.get(s.funnelId).push(s);
        });
        const allFunnelIds = (await getDocs(collection(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH)))
          .docs.map(d => d.id);
        for (const fId of allFunnelIds) {
          const stagesInFunnel = statusesByFunnel.get(fId) || [];
          const hasNegociacao = stagesInFunnel.some(s => (s.name || '').trim().toLowerCase() === 'negociação');
          if (!hasNegociacao) {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH), {
              name: 'Negociação',
              color: 'purple',
              order: stagesInFunnel.length,
              funnelId: fId,
              isSystem: true
            });
          }
        }

        // Define seleção inicial se ainda não houver
        setSelectedFunnelId(prev => prev || defaultId);

        setFunnelsMigrationStatus('done');
      } catch (err) {
        console.error('Erro na migração de funis', err);
        setFunnelsMigrationStatus('error');
      }
    })();
  }, [appUser, funnels, loadingData, funnelsMigrationStatus]);

  // Impersonação ("entrar como"): o banner e o "sair" vivem aqui (nível do app);
  // o "entrar" é feito no SuperAdminView. Ressincroniza com o sessionStorage
  // sempre que a sessão (appUser) troca — começar/voltar trocam o usuário do
  // Firebase, então o effect reflete o estado no banner.
  const [impersonation, setImpersonation] = useState(readImpersonation);
  const [exitingImpersonation, setExitingImpersonation] = useState(false);
  useEffect(() => { setImpersonation(readImpersonation()); }, [appUser]);
  const stopImpersonation = async () => {
    setExitingImpersonation(true);
    try { sessionStorage.removeItem(IMPERSONATION_KEY); } catch { /* ignore */ }
    try {
      // Pede o token de retorno on-demand (autorizado pelo claim impersonatedBy da
      // sessão atual — nada reutilizável fica guardado no cliente). Restaura a
      // persistência local e volta à conta de super-admin em 1 clique.
      const res = await fetch('/api/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.currentUser.getIdToken()}` },
        body: JSON.stringify({ action: 'return' })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.returnToken) {
        try { await setPersistence(auth, browserLocalPersistence); } catch { /* ignore */ }
        await signInWithCustomToken(auth, data.returnToken);
      } else {
        // Retorno indisponível (claim já expirado): sai com segurança para o login.
        await signOut(auth);
      }
    } catch (e) {
      console.error('stopImpersonation', e);
      try { await signOut(auth); } catch { /* ignore */ }
    }
    setImpersonation(null);
    setExitingImpersonation(false);
  };

  const handleLogout = async () => {
  try {
    await signOut(auth);
  } catch (e) {
    console.error('Erro ao sair do sistema', e);
  }

  setAppUser(null);
  setActiveTab('dashboard');
};

  const changeTab = (tab) => { setActiveTab(tab); setIsMobileMenuOpen(false); }

  // Mantém o grupo "Leads" aberto quando uma de suas sub-abas está ativa.
  const isLeadsTab = activeTab === 'leads' || activeTab === 'aulas' || activeTab === 'visitas';
  useEffect(() => {
    if (isLeadsTab) setLeadsMenuOpen(true);
  }, [isLeadsTab]);

  // Super-admin sem tenant entra direto na tela "Organizações" (única que vê).
  useEffect(() => {
    if (appUser?.superAdminOnly) setActiveTab('superadmin');
  }, [appUser]);

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-paper-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-4">
        <Activity className="w-12 h-12 text-brand-600 mb-4 animate-pulse" />
        <p className="text-gray-400 dark:text-neutral-500 text-sm font-bold uppercase tracking-widest">Carregando Sessão...</p>
      </div>
    );
  }

  if (!appUser) return <LoginScreen setAppUser={setAppUser} firebaseUser={firebaseUser} db={db} authSetupError={authSetupError} urlTenant={urlTenant} />;

  // Academia suspensa ou com trial expirado: bloqueia o acesso ao app (super-admin
  // sem tenant não é afetado). O usuário está autenticado, mas a organização não.
  if (!appUser.superAdminOnly && tenantBlock) {
    return <TenantBlockedScreen reason={tenantBlock} onLogout={handleLogout} />;
  }

  return (
    <GeneralConfigContext.Provider value={generalConfigValue}>
    <div className="flex h-[100dvh] bg-paper-50 dark:bg-neutral-950 text-gray-900 dark:text-white selection:bg-brand-600 selection:text-white overflow-hidden" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, sans-serif' }}>
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 md:w-64 bg-white dark:bg-ink-900 border-r border-slate-200 dark:border-white/[0.06] flex flex-col transition-transform duration-300 ease-in-out transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        {/* Marca */}
        <div className="h-16 px-5 flex items-center justify-between gap-3 border-b border-slate-200/80 dark:border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl grid place-items-center bg-brand-50 dark:bg-white/[0.06] ring-1 ring-brand-100 dark:ring-white/[0.08] shrink-0">
              <SurgeMark size={22} />
            </div>
            <StronileadWordmark className="text-[16px] text-gray-900 dark:text-white" />
          </div>
          <button className="md:hidden text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white p-1 shrink-0" onClick={() => setIsMobileMenuOpen(false)}><X className="w-5 h-5" /></button>
        </div>

        {/* Navegação */}
        <nav className="flex-1 px-3 pt-5 overflow-y-auto custom-scrollbar">
          {!appUser.superAdminOnly && (
            <>
              <div className="px-2.5 mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500">Workspace</div>
              <div className="space-y-1">
                <SidebarItem icon={<LayoutDashboard className="w-[18px] h-[18px]" />} label="Visão geral" active={activeTab === 'dashboard'} onClick={() => changeTab('dashboard')} />
                <SidebarItem icon={<Kanban className="w-[18px] h-[18px]" />} label="Pipeline" active={activeTab === 'kanban'} onClick={() => changeTab('kanban')} />
                <SidebarItem icon={<Target className="w-[18px] h-[18px]" />} label="Meta diária" active={activeTab === 'dailyGoal'} onClick={() => changeTab('dailyGoal')} />
                <SidebarGroup
                  icon={<Users className="w-[18px] h-[18px]" />}
                  label="Leads"
                  active={isLeadsTab}
                  open={leadsMenuOpen}
                  onToggle={() => setLeadsMenuOpen(o => !o)}
                >
                  <SidebarSubItem label="Todos os leads" active={activeTab === 'leads'} onClick={() => changeTab('leads')} />
                  <SidebarSubItem label="Aulas experimentais" active={activeTab === 'aulas'} onClick={() => changeTab('aulas')} />
                  <SidebarSubItem label="Visitas" active={activeTab === 'visitas'} onClick={() => changeTab('visitas')} />
                </SidebarGroup>
              </div>
            </>
          )}

          {(appUser?.superAdmin || (!appUser.superAdminOnly && isAdminUser(appUser))) && (
            <>
              <div className="px-2.5 mt-6 mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500">Administração</div>
              <div className="space-y-1">
                {!appUser.superAdminOnly && isAdminUser(appUser) && (
                  <SidebarItem icon={<Settings className="w-[18px] h-[18px]" />} label="Configurações" active={activeTab === 'settings'} onClick={() => changeTab('settings')} />
                )}
                {appUser?.superAdmin && (
                  <SidebarItem icon={<Globe className="w-[18px] h-[18px]" />} label="Organizações" active={activeTab === 'superadmin'} onClick={() => changeTab('superadmin')} />
                )}
              </div>
            </>
          )}
        </nav>

        {/* Cadastrar lead — só pra quem opera dentro de um tenant. */}
        {!appUser.superAdminOnly && (
          <div className="px-3 pb-2 shrink-0">
            <button
              onClick={() => { setIsAddLeadModalOpen(true); setIsMobileMenuOpen(false); }}
              title="Cadastrar Lead"
              aria-label="Cadastrar Lead"
              className="w-full h-10 rounded-xl inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 active:scale-[.99] text-white text-[13px] font-semibold shadow-[0_6px_16px_-6px_rgba(43,89,255,.65)] transition"
            >
              <Plus className="w-4 h-4" /> Cadastrar lead
            </button>
          </div>
        )}

        {/* Usuário + sair */}
        <div className="p-3 border-t border-slate-200/80 dark:border-white/[0.06] shrink-0 pb-6 md:pb-3">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.04] transition">
            {appUser.superAdminOnly ? (
              <div className="w-[34px] h-[34px] rounded-full grid place-items-center bg-brand-50 text-brand-700 dark:bg-white/[0.06] dark:text-brand-300 shrink-0"><Globe className="w-4 h-4" /></div>
            ) : (
              <Avatar name={appUser?.name} size={34} />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold truncate text-gray-900 dark:text-white">{appUser?.name}</div>
              <div className="text-[10.5px] text-brand-600 dark:text-brand-400 font-semibold whitespace-nowrap flex items-center gap-1">
                {appUser.superAdminOnly ? <Globe className="w-3 h-3" /> : isAdminUser(appUser) ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                {appUser.superAdminOnly ? 'Super-admin' : isAdminUser(appUser) ? 'Acesso Master' : 'Consultor'}
              </div>
            </div>
            <button onClick={handleLogout} title="Sair do sistema"
              className="w-8 h-8 grid place-items-center rounded-lg text-gray-500 hover:text-rose-600 hover:bg-rose-50 dark:text-neutral-400 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 transition shrink-0">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 relative">
        {(impersonation || appUser.impersonating) && (
          <ImpersonationBanner
            viewing={impersonation?.viewing || { id: appUser.impersonatedTenant, name: appUser.impersonatedTenant }}
            onExit={stopImpersonation} busy={exitingImpersonation} />
        )}
        <header className="h-16 border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 backdrop-blur-md flex items-center justify-between px-4 md:px-8 z-10 shrink-0">
          <div className="flex items-center">
            <button className="md:hidden mr-4 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white dark:text-white p-1" onClick={() => setIsMobileMenuOpen(true)}><Menu className="w-6 h-6" /></button>
            <h2 className="font-display text-xl font-bold text-gray-900 dark:text-white capitalize truncate tracking-tight">
              {activeTab === 'dashboard' && 'Visão Geral'}
              {activeTab === 'kanban' && 'Pipeline de Vendas'}
              {activeTab === 'dailyGoal' && 'Sua Meta Diária'}
              {activeTab === 'leads' && 'Gestão de Leads'}
              {activeTab === 'aulas' && 'Aulas Experimentais'}
              {activeTab === 'visitas' && 'Visitas'}
              {activeTab === 'settings' && 'Configurações'}
              {activeTab === 'superadmin' && 'Organizações (Super-admin)'}
            </h2>
          </div>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)} 
            className="p-2 rounded-xl text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-all active:scale-95 border border-transparent hover:border-gray-200 dark:hover:border-neutral-700"
            title="Alternar Tema"
          >
            {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-brand-600" />}
          </button>
        </header>

        {!appUser.superAdminOnly && trialEndsAtMs && <TrialBanner endsAtMs={trialEndsAtMs} />}

        {loadError && (
          <div className="shrink-0 px-4 md:px-8 py-2 flex items-center justify-center gap-3 text-[12.5px] font-medium border-b bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Falha ao carregar alguns dados.</span>
            <button onClick={() => window.location.reload()} className="font-semibold underline underline-offset-2 hover:opacity-80">Recarregar</button>
          </div>
        )}

        <div className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 relative custom-scrollbar">
          {appUser.superAdminOnly ? (
            <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto w-full h-full">
              <SuperAdminView />
            </div>
          ) : loadingData ? (
            <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto w-full h-full">
              <ViewSkeleton activeTab={activeTab} />
            </div>
          ) : (
            <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto w-full h-full transition-all duration-300">
              {activeTab === 'dashboard' && <DashboardView leads={leads} interactions={interactions} appUser={appUser} statuses={statuses} usersList={usersList} tags={tags} lossReasons={lossReasons} db={db} funnels={funnels} selectedFunnelId={selectedFunnelId} setSelectedFunnelId={setSelectedFunnelId} />}
              {activeTab === 'kanban' && <KanbanView leads={leads} interactions={interactions} appUser={appUser} statuses={statuses} usersList={usersList} tags={tags} lossReasons={lossReasons} db={db} funnels={funnels} selectedFunnelId={selectedFunnelId} setSelectedFunnelId={setSelectedFunnelId} />}
              {activeTab === 'dailyGoal' && <DailyGoalView leads={leads} interactions={interactions} appUser={appUser} statuses={statuses} db={db} tags={tags} lossReasons={lossReasons} usersList={usersList} funnels={funnels} />}
              {activeTab === 'leads' && <LeadsView leads={leads} interactions={interactions} appUser={appUser} sources={sources} statuses={statuses} usersList={usersList} tags={tags} lossReasons={lossReasons} db={db} funnels={funnels} selectedFunnelId={selectedFunnelId} setSelectedFunnelId={setSelectedFunnelId} onAddLeadClick={() => setIsAddLeadModalOpen(true)} />}
              {activeTab === 'aulas' && <AppointmentTrackingView leads={leads} interactions={interactions} appUser={appUser} statuses={statuses} tags={tags} lossReasons={lossReasons} db={db} funnels={funnels} usersList={usersList} appointmentType="aula_experimental" />}
              {activeTab === 'visitas' && <AppointmentTrackingView leads={leads} interactions={interactions} appUser={appUser} statuses={statuses} tags={tags} lossReasons={lossReasons} db={db} funnels={funnels} usersList={usersList} appointmentType="visita" />}
              {activeTab === 'settings' && isAdminUser(appUser) && <SettingsView sources={sources} statuses={statuses} db={db} usersList={usersList} appUser={appUser} tags={tags} lossReasons={lossReasons} leads={leads} funnels={funnels} modalities={modalities} trialClassOptions={trialClassOptions} units={units} metaWeekdays={metaWeekdays} />}
              {activeTab === 'superadmin' && appUser?.superAdmin && <SuperAdminView />}
            </div>
          )}
        </div>
      </main>

      {/* Quick-add lead, alcançável de qualquer aba pelo botão do menu lateral
          ou pelo botão da LeadsView. Ao salvar, abrimos automaticamente o
          perfil do lead recém-criado (via justCreatedLeadId → useEffect). */}
      {isAddLeadModalOpen && (
        <AddLeadModal
          onClose={() => setIsAddLeadModalOpen(false)}
          appUser={appUser}
          sources={sources}
          statuses={statuses}
          tags={tags}
          db={db}
          funnels={funnels}
          selectedFunnelId={selectedFunnelId}
          leads={leads}
          onCreated={(newLeadId) => setJustCreatedLeadId(newLeadId)}
        />
      )}
      {appLevelSelectedLead && (
        <LeadDetailsModal
          lead={appLevelSelectedLead}
          interactions={(interactions || []).filter(i => i.leadId === appLevelSelectedLead.id).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0))}
          onClose={() => setAppLevelSelectedLead(null)}
          appUser={appUser}
          statuses={statuses}
          tags={tags}
          lossReasons={lossReasons}
          db={db}
          funnels={funnels}
        />
      )}
    </div>
    </GeneralConfigContext.Provider>
  );
}

// ==========================================
// SUPER-ADMIN — provisionamento de organizações (tenants)
// ==========================================
// Visível só para quem tem o claim superAdmin. Cria uma organização nova
// (tenant + 1º admin + claim + doc) via /api/provision-tenant. Os padrões
// (funil "Comercial" + etapa "Negociação") são semeados no 1º login do admin.
const slugify = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 40);

// Limites de seats por plano (espelha api/_plans.js) — só p/ exibição no painel.
const PLAN_MAX_USERS = { starter: 3, pro: 10, enterprise: Infinity };
const planLabel = (p) => ({ starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' }[p] || p || 'starter');
const tenantSeatLabel = (t) => {
  if (typeof t.userCount !== 'number') return null;
  const max = PLAN_MAX_USERS[t.plan] ?? 3;
  return max === Infinity ? `${t.userCount} usuários` : `${t.userCount}/${max} seats`;
};

// "Entrar como" (impersonação): o token de retorno + dados do cliente ficam no
// sessionStorage (escopo da aba). É a fonte de verdade do banner — ver o App
// (banner + "sair") e o SuperAdminView (o "entrar").
const IMPERSONATION_KEY = 'crm-impersonation';
const readImpersonation = () => {
  try { return JSON.parse(sessionStorage.getItem(IMPERSONATION_KEY) || 'null'); }
  catch { return null; }
};

// Faixa fixa exibida no topo enquanto o super-admin visualiza como um cliente.
function ImpersonationBanner({ viewing, onExit, busy }) {
  return (
    <div className="shrink-0 flex items-center justify-center gap-3 px-4 py-2 bg-amber-500 text-amber-950 text-[12.5px] font-semibold">
      <Eye className="w-4 h-4 shrink-0" />
      <span className="truncate">Visualizando como <b>{viewing?.name || viewing?.id}</b> — você está dentro da conta deste cliente.</span>
      <button onClick={onExit} disabled={busy}
        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-950/90 text-amber-50 hover:bg-amber-950 disabled:opacity-60 transition">
        <LogOut className="w-3.5 h-3.5" /> Sair da visualização
      </button>
    </div>
  );
}

// Formatação dos números do painel (BRL inteiro — os preços são redondos).
const fmtBRL = (n) => `R$ ${Number(n || 0).toLocaleString('pt-BR')}`;
const fmtNum = (n) => Number(n || 0).toLocaleString('pt-BR');

// Saúde do cliente pela última atividade: ativo ≤7d, ocioso 8–14d, em risco >14d
// (alinhado ao KPI "Clientes em risco"). Usado nos badges da lista e do modal.
const HEALTH = {
  active: { key: 'active', label: 'Ativo',    cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  idle:   { key: 'idle',   label: 'Ocioso',   cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
  risk:   { key: 'risk',   label: 'Em risco', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' },
};
const tenantHealth = (lastActivityAt) => {
  if (!lastActivityAt) return HEALTH.risk;
  const days = (Date.now() - lastActivityAt) / 86400000;
  if (days <= 7) return HEALTH.active;
  if (days <= 14) return HEALTH.idle;
  return HEALTH.risk;
};
// Rótulo curto da última atividade ("há X dias").
const lastActivityLabel = (ms) => {
  if (!ms) return 'sem atividade registrada';
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days <= 0) return 'ativo hoje';
  if (days === 1) return 'última atividade ontem';
  return `última atividade há ${days} dias`;
};

// Tempo relativo curto para o feed de auditoria.
const timeAgo = (ms) => {
  if (!ms) return '';
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return 'agora';
  const m = Math.floor(s / 60); if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60); if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24); return `há ${d}d`;
};
// Descrição legível de uma entrada do log de auditoria do super-admin.
const auditActionLabel = (e) => {
  const t = e.tenantId || '—';
  switch (e.action) {
    case 'impersonate.start': return `Entrou como ${e.details?.tenantName || t}`;
    case 'tenant.provision': return `Criou a organização ${e.details?.displayName || t}`;
    case 'tenant.update': {
      const ch = (e.details?.changed || []).join(', ');
      return `Atualizou ${t}${ch ? ` (${ch})` : ''}`;
    }
    default: return `${e.action} · ${t}`;
  }
};

// KPIs de negócio no topo do painel super-admin: clientes ativos, MRR estimado,
// leads e usuários da plataforma, alerta de trials vencendo e mini-gráfico de
// novas organizações por mês. Alimentado por GET /api/super-overview (totals).
function SuperOverviewCards({ overview }) {
  if (!overview) return null;
  const arpu = overview.active > 0 ? Math.round(overview.mrr / overview.active) : 0;
  const kpis = [
    { label: 'MRR estimado', value: fmtBRL(overview.mrr), sub: 'receita recorrente/mês', icon: <TrendingUp size={15} /> },
    { label: 'Clientes ativos', value: fmtNum(overview.active), sub: `${overview.trial} em trial · ${overview.suspended} susp.`, icon: <Building2 size={15} /> },
    { label: 'Ticket médio', value: fmtBRL(arpu), sub: 'por cliente ativo', icon: <DollarSign size={15} /> },
    { label: 'Clientes em risco', value: fmtNum(overview.atRisk), sub: 'sem uso há 14+ dias', icon: <AlertCircle size={15} />, danger: overview.atRisk > 0 },
  ];
  const expiring = overview.trialsExpiring || [];
  const months = overview.newByMonth || [];
  const maxMonth = Math.max(1, ...months.map(m => m.count));
  const newTotal = months.reduce((s, m) => s + m.count, 0);

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {kpis.map(k => (
          <div key={k.label} className="rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span className="text-brand-600 dark:text-brand-400 shrink-0">{k.icon}</span>
              <span className="truncate">{k.label}</span>
            </div>
            <div className={`num text-[22px] font-semibold tracking-tight mt-1.5 leading-none ${k.danger ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>{k.value}</div>
            <div className="text-[10.5px] text-slate-400 dark:text-slate-500 mt-1 truncate num">{k.sub}</div>
          </div>
        ))}
      </div>

      {expiring.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/[0.08] px-3.5 py-2.5">
          <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0 text-[12px] text-amber-800 dark:text-amber-200">
            <span className="font-semibold">{expiring.length} trial{expiring.length === 1 ? '' : 's'} vencendo em até 7 dias.</span>{' '}
            <span className="text-amber-700/90 dark:text-amber-300/90">
              {expiring.slice(0, 3).map(e => `${e.displayName} (${e.daysLeft <= 0 ? 'hoje' : e.daysLeft + 'd'})`).join(' · ')}
              {expiring.length > 3 ? ` +${expiring.length - 3}` : ''}
            </span>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <BarChart3 size={15} className="text-brand-600 dark:text-brand-400" /> Novas organizações
          </div>
          <span className="text-[10.5px] text-slate-400 dark:text-slate-500 num">{newTotal} em 6 meses</span>
        </div>
        <div className="mt-2.5 flex items-end gap-1.5 h-12">
          {months.map(m => (
            <div key={m.ym} className="flex-1 flex flex-col items-center justify-end h-full" title={`${m.label}: ${m.count}`}>
              <div className="w-full max-w-[26px] rounded-md bg-brand-500/70 dark:bg-brand-500/60"
                style={{ height: `${Math.max(m.count ? 10 : 2, (m.count / maxMonth) * 100)}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5">
          {months.map(m => (
            <div key={m.ym} className="flex-1 text-center text-[9.5px] text-slate-400 dark:text-slate-500 capitalize">{m.label.replace('.', '')}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SuperAdminView() {
  const toast = useToast();
  const [tenants, setTenants] = useState([]);
  const [overview, setOverview] = useState(null);     // totais agregados da plataforma (KPIs)
  const [audit, setAudit] = useState([]);             // log de atividade do super-admin
  const [loadingList, setLoadingList] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ displayName: '', tenantId: '', adminName: '', adminEmail: '', adminPassword: '', plan: 'starter', trialDays: '' });
  const [slugTouched, setSlugTouched] = useState(false);
  const [manage, setManage] = useState(null);          // org aberta no painel de detalhe
  const [stats, setStats] = useState(null);            // { loading, data }
  const [manageBusy, setManageBusy] = useState(null);  // ação em andamento no detalhe
  const [search, setSearch] = useState('');            // busca por nome/slug/e-mail
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | trial | suspended | risk | internal
  const [sortBy, setSortBy] = useState('name');        // name | activity | revenue

  // Copia o link de acesso da academia (stronilead.com.br/<slug>).
  const copyTenantLink = async (slug) => {
    const url = `${window.location.origin}/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`Link copiado: ${url}`);
    } catch {
      toast.info(url);
    }
  };

  const authHeader = async () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${await auth.currentUser.getIdToken()}`
  });

  // "Entrar como": gera o acesso de visualização e troca a sessão para o admin
  // do cliente. Guarda o token de retorno no sessionStorage (o banner e o "sair"
  // ficam no App). A sessão troca e este painel desmonta — não reseto o busy.
  const enterAs = async (tenant) => {
    if (manageBusy) return;
    setManageBusy('impersonate');
    try {
      const res = await fetch('/api/impersonate', {
        method: 'POST', headers: await authHeader(),
        body: JSON.stringify({ tenantId: tenant.id })
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Não foi possível entrar como esta organização.'); setManageBusy(null); return; }
      try {
        // Só metadados de exibição (sem token) — o retorno é emitido on-demand.
        sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify({
          viewing: { id: tenant.id, name: data.tenantName || tenant.displayName },
          at: Date.now()
        }));
      } catch { /* ignore */ }
      // Persistência de SESSÃO (por aba): a sessão impersonada nunca "gruda" além
      // da aba — fechar/reabrir sai da visualização (volta ao login) em vez de
      // prender o dono dentro da conta do cliente.
      try { await setPersistence(auth, browserSessionPersistence); } catch { /* ignore */ }
      await signInWithCustomToken(auth, data.token);
      // onAuthStateChanged remonta o app como o admin do cliente; o banner aparece.
    } catch (e) {
      console.error('enterAs', e);
      toast.error('Não foi possível entrar como esta organização.');
      setManageBusy(null);
    }
  };

  // Carrega a visão geral (totais agregados + tenants enriquecidos) num único GET.
  const loadTenants = async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/super-overview', { headers: await authHeader() });
      const data = await res.json();
      if (res.ok) { setTenants(data.tenants || []); setOverview(data.totals || null); setAudit(data.audit || []); }
      else toast.error(data.error || 'Erro ao carregar a visão geral.');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar a visão geral.');
    }
    setLoadingList(false);
  };

  useEffect(() => { loadTenants(); }, []);

  // Abre o painel de detalhe e busca as estatísticas de uso (Admin SDK).
  const openManage = async (t) => {
    setManage(t);
    setStats({ loading: true });
    try {
      const res = await fetch(`/api/tenant-stats?tenantId=${encodeURIComponent(t.id)}`, { headers: await authHeader() });
      const data = await res.json();
      setStats(res.ok ? { data } : { error: data.error || 'Erro ao carregar uso.' });
    } catch (e) {
      console.error(e);
      setStats({ error: 'Erro ao carregar uso.' });
    }
  };
  const closeManage = () => { setManage(null); setStats(null); };

  // Patch genérico no tenant-status (plano / trial / status / arquivar).
  const patchTenant = async (tenantId, body, successMsg, action) => {
    if (manageBusy) return false;
    setManageBusy(action || 'patch');
    let ok = false;
    try {
      const res = await fetch('/api/tenant-status', {
        method: 'POST', headers: await authHeader(),
        body: JSON.stringify({ tenantId, ...body })
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erro ao atualizar organização.'); }
      else {
        ok = true;
        if (successMsg) toast.success(successMsg);
        setManage(m => (m && m.id === tenantId ? { ...m, ...body } : m));
        loadTenants();
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao atualizar organização.');
    }
    setManageBusy(null);
    return ok;
  };

  const changePlan = (tenantId, plan) => patchTenant(tenantId, { plan }, `Plano alterado para ${planLabel(plan)}.`, 'plan');
  const extendTrial = (tenantId, days) => patchTenant(tenantId, { trialDays: Number(days) }, Number(days) > 0 ? `Trial de ${days} dias aplicado.` : 'Trial encerrado.', 'trial');
  const setActive = (tenantId, status) => patchTenant(tenantId, { status }, status === 'active' ? 'Organização ativada.' : 'Organização suspensa.', 'status');
  const setInternal = (tenantId, internal) => patchTenant(tenantId, { internal }, internal ? 'Marcada como interna/teste — fora dos números.' : 'Voltou a contar como cliente.', 'internal');
  const saveInternalMeta = (tenantId, body) => patchTenant(tenantId, body, 'Dados internos salvos.', 'meta');
  const setArchived = async (tenantId, archived) => {
    if (archived && !window.confirm('Desativar esta organização? Os usuários perdem o acesso (dados preservados). Você pode restaurar depois.')) return;
    const ok = await patchTenant(tenantId, { archived }, archived ? 'Organização desativada.' : 'Organização restaurada.', 'archive');
    if (ok && archived) closeManage();
  };

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const onNameChange = (v) => {
    setForm(f => ({ ...f, displayName: v, tenantId: slugTouched ? f.tenantId : slugify(v) }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.displayName.trim() || !form.tenantId.trim() || !form.adminName.trim() || !form.adminEmail.trim() || !form.adminPassword) {
      toast.warning('Preencha todos os campos.');
      return;
    }
    if (form.adminPassword.length < 6) { toast.warning('Senha precisa ter ao menos 6 caracteres.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/provision-tenant', {
        method: 'POST',
        headers: await authHeader(),
        body: JSON.stringify({
          tenantId: form.tenantId.trim(),
          displayName: form.displayName.trim(),
          adminName: form.adminName.trim(),
          adminEmail: form.adminEmail.trim(),
          adminPassword: form.adminPassword,
          plan: form.plan,
          trialDays: form.trialDays ? Number(form.trialDays) : 0
        })
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erro ao criar organização.'); setSubmitting(false); return; }
      toast.success(`Organização "${form.displayName.trim()}" criada. Admin: ${form.adminEmail.trim()}`, { duration: 8000, title: 'Organização provisionada' });
      setForm({ displayName: '', tenantId: '', adminName: '', adminEmail: '', adminPassword: '', plan: 'starter', trialDays: '' });
      setSlugTouched(false);
      loadTenants();
    } catch (e2) {
      console.error(e2);
      toast.error('Erro ao criar organização.');
    }
    setSubmitting(false);
  };

  const activeTenants = tenants.filter(t => !t.archived);
  const archivedTenants = tenants.filter(t => t.archived);

  // Busca + filtro + ordenação (client-side, sobre as organizações não arquivadas).
  const visibleTenants = useMemo(() => {
    let list = tenants.filter(t => !t.archived);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(t =>
      t.displayName.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      (t.primaryAdminEmail || '').toLowerCase().includes(q)
    );
    if (statusFilter === 'active') list = list.filter(t => !t.internal && t.status === 'active');
    else if (statusFilter === 'trial') list = list.filter(t => !t.internal && t.status === 'trial');
    else if (statusFilter === 'suspended') list = list.filter(t => t.status === 'suspended');
    else if (statusFilter === 'risk') list = list.filter(t => !t.internal && (t.status === 'active' || t.status === 'trial') && tenantHealth(t.lastActivityAt).key === 'risk');
    else if (statusFilter === 'internal') list = list.filter(t => t.internal);
    const arr = [...list];
    if (sortBy === 'activity') arr.sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0));
    else if (sortBy === 'revenue') arr.sort((a, b) => (b.price || 0) - (a.price || 0));
    else arr.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return arr;
  }, [tenants, search, statusFilter, sortBy]);

  return (
    <div className="animate-fade-in font-sans space-y-6 max-w-3xl">
      <section>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Globe size={13} className="text-brand-600" /> Super-admin
        </div>
        <h2 className="mt-1.5 font-display text-[24px] font-semibold tracking-tight leading-tight">Organizações</h2>
        <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
          Crie uma organização nova (cliente) com dados totalmente isolados e o primeiro admin dela.
        </p>
      </section>

      <SuperOverviewCards overview={overview} />

      <SettingsCard title="Nova organização" hint="Provisiona o tenant + o primeiro admin" icon={<Plus size={16} />}>
        <form onSubmit={submit} className="space-y-4 p-4 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nome da organização">
              <StyledInput placeholder="Ex: Studio Corpo & Movimento" value={form.displayName} onChange={e => onNameChange(e.target.value)} required />
            </Field>
            <Field label="Identificador (slug)" hint="minúsculas, números e hífen">
              <StyledInput placeholder="ex: corpo-e-movimento" value={form.tenantId}
                onChange={e => { setSlugTouched(true); setField('tenantId', slugify(e.target.value)); }} required />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Nome do admin">
              <StyledInput placeholder="Nome completo" value={form.adminName} onChange={e => setField('adminName', e.target.value)} required />
            </Field>
            <Field label="E-mail do admin">
              <StyledInput type="email" placeholder="admin@organizacao.com" value={form.adminEmail} onChange={e => setField('adminEmail', e.target.value)} required />
            </Field>
            <Field label="Senha temporária">
              <StyledInput type="text" placeholder="mín. 6 caracteres" value={form.adminPassword} onChange={e => setField('adminPassword', e.target.value)} required />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Plano">
              <StyledSelect value={form.plan} onChange={e => setField('plan', e.target.value)}>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </StyledSelect>
            </Field>
            <Field label="Dias de teste" hint="0 = já ativa, sem trial">
              <StyledInput type="number" min="0" placeholder="0" value={form.trialDays} onChange={e => setField('trialDays', e.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Btn kind="brand" type="submit" icon={<Check size={13} />} disabled={submitting}>
              {submitting ? 'Criando...' : 'Criar organização'}
            </Btn>
          </div>
        </form>
      </SettingsCard>

      <SettingsCard
        title="Organizações"
        hint={visibleTenants.length === activeTenants.length
          ? `${activeTenants.length} ativa${activeTenants.length === 1 ? '' : 's'}`
          : `${visibleTenants.length} de ${activeTenants.length} ativas`}
        icon={<Globe size={16} />}
      >
        {/* busca + filtros */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, slug ou e-mail..."
              className="w-full h-9 pl-8 pr-3 rounded-lg text-[12.5px] bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] outline-none focus:border-brand-500" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="h-9 px-2.5 rounded-lg text-[12px] bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] outline-none focus:border-brand-500 cursor-pointer">
            <option value="all">Todas</option>
            <option value="active">Ativas</option>
            <option value="trial">Trial</option>
            <option value="suspended">Suspensas</option>
            <option value="risk">Em risco</option>
            <option value="internal">Internas</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="h-9 px-2.5 rounded-lg text-[12px] bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] outline-none focus:border-brand-500 cursor-pointer">
            <option value="name">Ordenar: Nome</option>
            <option value="activity">Ordenar: Atividade</option>
            <option value="revenue">Ordenar: Receita</option>
          </select>
        </div>

        {loadingList ? (
          <div className="text-center text-[12.5px] text-slate-400 py-10">Carregando...</div>
        ) : activeTenants.length === 0 ? (
          <div className="text-center text-[12.5px] text-slate-400 italic py-10">Nenhuma organização ativa.</div>
        ) : visibleTenants.length === 0 ? (
          <div className="text-center text-[12.5px] text-slate-400 italic py-10">Nenhuma organização encontrada com esses filtros.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
            {visibleTenants.map(t => {
              const statusStyle = t.status === 'active'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                : t.status === 'trial'
                  ? 'bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-400'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
              const statusLabel = t.status === 'active' ? 'Ativa' : t.status === 'trial' ? 'Trial' : t.status === 'suspended' ? 'Suspensa' : t.status;
              const seats = tenantSeatLabel(t);
              // Saúde só para clientes reais (não-internos) ativos/trial.
              const health = (!t.internal && (t.status === 'active' || t.status === 'trial')) ? tenantHealth(t.lastActivityAt) : null;
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-7 h-7 rounded-lg grid place-items-center bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 shrink-0">
                    <Globe size={13} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium text-slate-800 dark:text-slate-100 truncate">
                      {t.displayName}
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{planLabel(t.plan)}</span>
                      {t.internal && <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 dark:bg-white/[0.08] dark:text-slate-400" title="Conta interna/teste — fora dos números de negócio">Interna</span>}
                    </div>
                    <div className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate num">
                      {t.id}{seats ? ` · ${seats}` : ''}
                    </div>
                  </div>
                  {t.internalNotes && <FileText size={13} className="text-slate-400 dark:text-slate-500 shrink-0" title="Tem nota interna" />}
                  {health && health.key !== 'active' && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap ${health.cls}`} title={lastActivityLabel(t.lastActivityAt)}>
                      {health.label}
                    </span>
                  )}
                  <span className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap ${statusStyle}`}>
                    {statusLabel}
                  </span>
                  {!t.archived && (t.status === 'active' || t.status === 'trial') && (
                    <button onClick={() => enterAs(t)} disabled={!!manageBusy} title="Entrar como esta organização (ver o que o cliente vê)"
                      className="text-[11.5px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300 disabled:opacity-50 transition inline-flex items-center gap-1 whitespace-nowrap">
                      <Eye size={12} /> Entrar
                    </button>
                  )}
                  <button onClick={() => copyTenantLink(t.id)} title={`Copiar link de acesso · /${t.id}`}
                    className="text-[11.5px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300 transition whitespace-nowrap">
                    Copiar link
                  </button>
                  <button onClick={() => openManage(t)}
                    className="text-[11.5px] font-semibold px-2.5 py-1 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition inline-flex items-center gap-1 whitespace-nowrap">
                    <Settings size={12} /> Gerenciar
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </SettingsCard>

      {archivedTenants.length > 0 && (
        <SettingsCard title="Desativadas" hint={`${archivedTenants.length} arquivada${archivedTenants.length === 1 ? '' : 's'}`} icon={<Ban size={16} />}>
          <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
            {archivedTenants.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 opacity-90">
                <span className="w-7 h-7 rounded-lg grid place-items-center bg-slate-100 text-slate-400 dark:bg-white/[0.06] dark:text-slate-500 shrink-0">
                  <Ban size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium text-slate-700 dark:text-slate-200 truncate">{t.displayName}</div>
                  <div className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate num">{t.id}</div>
                </div>
                <button onClick={() => setArchived(t.id, false)} disabled={!!manageBusy}
                  className="text-[11.5px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 disabled:opacity-50 transition whitespace-nowrap">
                  Restaurar
                </button>
              </div>
            ))}
          </div>
        </SettingsCard>
      )}

      {audit.length > 0 && (
        <SettingsCard title="Atividade recente" hint="Últimas ações no painel (auditoria)" icon={<Activity size={16} />}>
          <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
            {audit.map(e => (
              <div key={e.id} className="flex items-center gap-3 py-2.5 text-[12.5px]">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${e.action === 'impersonate.start' ? 'bg-amber-500' : 'bg-brand-500'}`} />
                <span className="flex-1 text-slate-700 dark:text-slate-200 truncate">{auditActionLabel(e)}</span>
                <span className="text-[11px] text-slate-400 shrink-0">{timeAgo(e.at)}</span>
              </div>
            ))}
          </div>
        </SettingsCard>
      )}

      {manage && (
        <TenantManageModal
          t={manage} stats={stats} busy={manageBusy}
          onClose={closeManage}
          onCopy={() => copyTenantLink(manage.id)}
          onChangePlan={(p) => changePlan(manage.id, p)}
          onExtendTrial={(d) => extendTrial(manage.id, d)}
          onSetActive={(s) => setActive(manage.id, s)}
          onSetInternal={(v) => setInternal(manage.id, v)}
          onSaveMeta={(body) => saveInternalMeta(manage.id, body)}
          onEnterAs={() => enterAs(manage)}
          onArchive={() => setArchived(manage.id, true)}
        />
      )}
    </div>
  );
}

// Painel de detalhe/gestão de uma organização (super-admin): uso, plano, trial,
// status e desativar. Props são handlers do SuperAdminView.
function TenantManageModal({ t, stats, busy, onClose, onCopy, onChangePlan, onExtendTrial, onSetActive, onSetInternal, onSaveMeta, onEnterAs, onArchive }) {
  const [trialDays, setTrialDays] = useState('');
  const [notes, setNotes] = useState(t.internalNotes || '');
  const [price, setPrice] = useState(t.monthlyPrice != null ? String(t.monthlyPrice) : '');
  const metaDirty = notes !== (t.internalNotes || '') || price !== (t.monthlyPrice != null ? String(t.monthlyPrice) : '');
  const d = stats?.data;
  const seatLabel = d
    ? (d.maxUsers == null ? `${d.userCount} usuários (ilimitado)` : `${d.userCount}/${d.maxUsers} seats`)
    : '—';
  const statRow = (label, value) => (
    <div className="rounded-xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] p-3 text-center">
      <div className="num text-[20px] font-semibold tracking-tight text-slate-900 dark:text-white">{value}</div>
      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{label}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/55 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative w-full max-w-[520px] max-h-[92vh] overflow-y-auto custom-scrollbar rounded-2xl bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/[0.08] shadow-[0_30px_80px_-20px_rgba(8,13,34,.55)]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200/80 dark:border-white/[0.07]">
          <div className="min-w-0">
            <h2 className="font-display text-[17px] font-bold tracking-tight truncate text-gray-900 dark:text-white">{t.displayName}</h2>
            <div className="text-[11.5px] text-slate-500 dark:text-slate-400 num truncate flex items-center gap-2">
              <span className="truncate">{t.id}</span>
              {!t.internal && (t.status === 'active' || t.status === 'trial') && (() => {
                const h = tenantHealth(t.lastActivityAt);
                return <span className={`text-[9.5px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${h.cls}`} title={lastActivityLabel(t.lastActivityAt)}>{h.label}</span>;
              })()}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-white/[0.06] transition shrink-0"><X size={17} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* uso */}
          <div className="grid grid-cols-3 gap-2.5">
            {statRow('Leads', d ? d.leadCount : (stats?.loading ? '…' : '—'))}
            {statRow('Interações', d ? d.interactionCount : (stats?.loading ? '…' : '—'))}
            {statRow('Usuários', d ? seatLabel : (stats?.loading ? '…' : '—'))}
          </div>

          {/* plano */}
          <div>
            <div className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Plano</div>
            <div className="flex gap-1.5">
              {['starter', 'pro', 'enterprise'].map(p => (
                <button key={p} type="button" disabled={!!busy} onClick={() => p !== t.plan && onChangePlan(p)}
                  className={`flex-1 h-9 rounded-lg text-[12.5px] font-semibold transition disabled:opacity-50 ${t.plan === p ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.04] dark:text-slate-300'}`}>
                  {planLabel(p)}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Starter: 3 seats · Pro: 10 · Enterprise: ilimitado.</p>
          </div>

          {/* trial */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Trial</span>
              {t.status === 'trial' && t.trialEndsAt && (
                <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                  {(() => {
                    const left = Math.max(0, Math.ceil((t.trialEndsAt - Date.now()) / 86400000));
                    const dt = new Date(t.trialEndsAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                    return left <= 0 ? `termina hoje (${dt})` : `${left} dia${left === 1 ? '' : 's'} restante${left === 1 ? '' : 's'} (${dt})`;
                  })()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min="0" value={trialDays} onChange={e => setTrialDays(e.target.value)} placeholder="dias"
                className="w-24 h-9 px-3 rounded-lg text-[13px] num bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] outline-none focus:border-brand-500" />
              <button type="button" disabled={!!busy || trialDays === ''} onClick={() => { onExtendTrial(trialDays); setTrialDays(''); }}
                className="h-9 px-3 rounded-lg text-[12.5px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-200 disabled:opacity-50 transition">
                Aplicar
              </button>
              <span className="text-[11px] text-slate-400">0 = encerra o trial (ativa)</span>
            </div>
          </div>

          {/* classificação: conta interna/teste (fora dos KPIs de negócio) */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-white/[0.07] px-3.5 py-2.5">
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Conta interna / teste</div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500">Fora do MRR, clientes e em risco. Continua na lista.</div>
            </div>
            <button type="button" disabled={!!busy} onClick={() => onSetInternal(!t.internal)}
              role="switch" aria-checked={!!t.internal} title="Marcar como conta interna/teste"
              className={`relative w-11 h-6 rounded-full transition shrink-0 disabled:opacity-50 ${t.internal ? 'bg-brand-600' : 'bg-slate-300 dark:bg-white/[0.15]'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${t.internal ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* interno: preço por cliente + notas (só o super-admin vê) */}
          <div className="space-y-2.5 rounded-xl border border-slate-200 dark:border-white/[0.07] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                <FileText size={13} className="text-slate-400" /> Interno (só você vê)
              </div>
              {metaDirty && (
                <button type="button" disabled={!!busy} onClick={() => onSaveMeta({ internalNotes: notes, monthlyPrice: price === '' ? null : Number(price) })}
                  className="h-7 px-3 rounded-lg text-[11.5px] font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition">
                  Salvar
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11.5px] text-slate-500 dark:text-slate-400 whitespace-nowrap">Preço mensal</span>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 pointer-events-none">R$</span>
                <input type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} placeholder={`padrão (${planLabel(t.plan)})`}
                  className="w-40 h-9 pl-8 pr-3 rounded-lg text-[13px] num bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] outline-none focus:border-brand-500" />
              </div>
              <span className="text-[10.5px] text-slate-400">vazio = preço do plano · entra no MRR</span>
            </div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} maxLength={2000}
              placeholder="Anotações sobre este cliente: contato, negociação, observações..."
              className="w-full px-3 py-2 rounded-lg text-[12.5px] bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] outline-none focus:border-brand-500 resize-none custom-scrollbar" />
          </div>

          {/* status + ações */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button onClick={onCopy} className="h-9 px-3 rounded-lg text-[12.5px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-200 transition">Copiar link</button>
            {!t.archived && (t.status === 'active' || t.status === 'trial') && (
              <button onClick={onEnterAs} disabled={!!busy}
                className="h-9 px-3 rounded-lg text-[12.5px] font-semibold bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-300 disabled:opacity-50 transition inline-flex items-center gap-1"><Eye size={13} /> Entrar como</button>
            )}
            {t.status === 'suspended' ? (
              <button onClick={() => onSetActive('active')} disabled={!!busy}
                className="h-9 px-3 rounded-lg text-[12.5px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 disabled:opacity-50 transition">Reativar</button>
            ) : (
              <button onClick={() => onSetActive('suspended')} disabled={!!busy}
                className="h-9 px-3 rounded-lg text-[12.5px] font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300 disabled:opacity-50 transition inline-flex items-center gap-1"><Ban size={13} /> Suspender</button>
            )}
            <button onClick={onArchive} disabled={!!busy}
              className="ml-auto h-9 px-3 rounded-lg text-[12.5px] font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 disabled:opacity-50 transition">Desativar</button>
          </div>
          {stats?.error && <p className="text-[11.5px] text-rose-600 dark:text-rose-400">{stats.error}</p>}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// TELA DE LOGIN & RECUPERAÇÃO ADMIN
// ==========================================
function LoginScreen({ setAppUser, firebaseUser, db, authSetupError, urlTenant }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const formRef = useRef(null);

  // Dispara a animação de shake no card do formulário ao falhar.
  const triggerShake = () => {
    const el = formRef.current;
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth; // reflow para reiniciar a animação
    el.classList.add('shake');
  };

  const handleLogin = async (e) => {
  e.preventDefault();
  setError('');
  setResetMessage('');
  setLoading(true);

  try {
    // "Manter conectado": local (padrão do Firebase = comportamento atual)
    // quando marcado; sessão quando desmarcado. Falha aqui não bloqueia o login.
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence).catch(() => {});
    const normalizedEmail = email.trim().toLowerCase();
    await signInWithEmailAndPassword(auth, normalizedEmail, password);
  } catch (err) {
    console.error(err);

    if (
      err.code === 'auth/invalid-credential' ||
      err.code === 'auth/wrong-password' ||
      err.code === 'auth/user-not-found'
    ) {
      setError('E-mail ou senha inválidos.');
    } else {
      setError('Erro ao autenticar. Verifique a configuração do Firebase Auth.');
    }
    triggerShake();
  }

  setLoading(false);
};

  const handleForgotPassword = async () => {
    setError('');
    setResetMessage('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Informe o e-mail antes de solicitar redefinição.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setResetMessage('Enviamos um link de redefinição para o e-mail informado.');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/user-not-found') {
        setError('Não há conta cadastrada para esse e-mail.');
      } else {
        setError('Não foi possível enviar o e-mail de redefinição.');
      }
    }
  };
  const inputClass =
    'w-full h-12 bg-transparent outline-none text-[14px] px-3 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-neutral-500';
  const fieldWrap =
    'mt-1.5 relative flex items-center rounded-xl border bg-white dark:bg-white/[0.03] transition border-gray-200 dark:border-white/[0.08] focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/15';

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-paper-50 dark:bg-ink-950 text-gray-900 dark:text-white">
      {/* ===== Painel de marca (esquerda) ===== */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-ink-950 text-white p-10 xl:p-12">
        <div className="absolute inset-0 brandgrid opacity-60" aria-hidden="true"></div>
        <div className="absolute -top-24 -left-16 w-[420px] h-[420px] rounded-full bg-brand-600/40 glow" aria-hidden="true"></div>
        <div className="absolute bottom-0 right-0 w-[360px] h-[360px] rounded-full bg-accent-500/20 glow" aria-hidden="true"></div>

        {/* topo: wordmark */}
        <div className="relative z-10 flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl grid place-items-center bg-white/10 ring-1 ring-white/15">
            <SurgeMark size={26} tone="onDark" />
          </span>
          <div>
            <StronileadWordmark className="text-[18px] text-white" leadOnDark />
            <div className="text-[11.5px] text-white/55 -mt-0.5">Gestão de leads para academias</div>
          </div>
        </div>

        {/* centro: cards flutuantes de preview */}
        <div className="relative z-10 my-8 h-[300px]">
          <div className="floaty absolute left-2 top-4 rounded-2xl bg-white/95 dark:bg-white/10 backdrop-blur shadow-float border border-white/40 dark:border-white/10 p-4 w-[200px]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-300">Leads no mês</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="num text-[26px] font-semibold tracking-tight text-slate-900 dark:text-white">1.284</span>
              <span className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 num inline-flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />+12%</span>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full" style={{ width: '72%' }}></div>
            </div>
          </div>

          <div className="floaty2 absolute right-0 top-24 rounded-2xl bg-white/95 dark:bg-white/10 backdrop-blur shadow-float border border-white/40 dark:border-white/10 p-3.5 w-[220px]">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-300">Meta diária</span>
              <span className="num text-[11px] font-bold text-brand-600 dark:text-brand-300">86%</span>
            </div>
            <div className="mt-2.5 space-y-2">
              {[['Mariana Costa', 'bg-emerald-500'], ['Bruno Tavares', 'bg-brand-500'], ['Júlia Pacheco', 'bg-accent-500']].map(([n, c], i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full grid place-items-center text-white ${c}`}><Check className="w-3 h-3" /></span>
                  <span className="text-[12px] text-slate-700 dark:text-slate-200 font-medium">{n}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute left-6 bottom-2 floaty2 rounded-2xl bg-white/95 dark:bg-white/10 backdrop-blur shadow-float border border-white/40 dark:border-white/10 px-4 py-3 w-[210px]">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-accent-500/15 text-accent-500 grid place-items-center"><Calendar className="w-4 h-4" /></span>
              <div>
                <div className="num text-[18px] font-semibold text-slate-900 dark:text-white leading-none">7 visitas</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-300 mt-0.5">agendadas hoje</div>
              </div>
            </div>
          </div>
        </div>

        {/* base: headline */}
        <div className="relative z-10 max-w-md">
          <h2 className="font-display text-[26px] xl:text-[30px] font-semibold leading-tight tracking-tight">
            Transforme cada lead em matrícula.
          </h2>
          <p className="mt-3 text-[14px] text-white/60 leading-relaxed">
            Pipeline, meta diária e agendamentos num só lugar — sua equipe focada no que importa: fechar.
          </p>
          <div className="mt-6 flex items-center gap-5 text-[12px] text-white/50">
            <span className="inline-flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Dados criptografados</span>
            <span className="inline-flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Pipeline em tempo real</span>
          </div>
        </div>
      </div>

      {/* ===== Formulário (direita) ===== */}
      <div className="relative flex flex-col min-h-screen lg:min-h-0 px-6 py-8 sm:px-10 bg-paper-50 dark:bg-ink-950">
        {/* wordmark mobile */}
        <div className="lg:hidden flex items-center gap-2.5 mb-10">
          <SurgeMark size={22} />
          <StronileadWordmark className="text-[16px]" />
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <div className="w-full max-w-[380px] mx-auto rise">
            <div className="mb-7">
              {urlTenant?.found && (
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-50 dark:bg-white/[0.06] ring-1 ring-brand-100 dark:ring-white/[0.08] px-2.5 py-1 text-[12px] font-semibold text-brand-700 dark:text-brand-300">
                  <Building2 className="w-3.5 h-3.5" /> {urlTenant.displayName}
                </div>
              )}
              <h1 className="font-display text-[26px] font-semibold tracking-tight">Bem-vindo de volta</h1>
              <p className="text-[14px] text-gray-500 dark:text-neutral-400 mt-1.5">
                {urlTenant?.found
                  ? <>Entre para acessar o painel da <span className="font-semibold text-gray-700 dark:text-neutral-200">{urlTenant.displayName}</span>.</>
                  : 'Entre para acessar seu painel de vendas.'}
              </p>
              {urlTenant && urlTenant.found === false && (
                <p className="mt-2 text-[12px] text-amber-600 dark:text-amber-400">
                  Academia “{urlTenant.slug}” não encontrada — confira o link. Você ainda pode entrar normalmente.
                </p>
              )}
            </div>

            {authSetupError && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-3.5 py-2.5 text-[12.5px] text-rose-700 dark:text-rose-300">
                <AlertTriangle className="w-[15px] h-[15px] mt-px shrink-0" />
                <span>{authSetupError}</span>
              </div>
            )}
            {error && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-3.5 py-2.5 text-[12.5px] text-rose-700 dark:text-rose-300">
                <AlertTriangle className="w-[15px] h-[15px] mt-px shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {resetMessage && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3.5 py-2.5 text-[12.5px] text-emerald-700 dark:text-emerald-300">
                <CheckCircle className="w-[15px] h-[15px] mt-px shrink-0" />
                <span>{resetMessage}</span>
              </div>
            )}

            <form ref={formRef} onSubmit={handleLogin} className="space-y-4">
              <label className="block">
                <span className="text-[12.5px] font-semibold text-gray-700 dark:text-neutral-300">E-mail</span>
                <div className={fieldWrap}>
                  <span className="pl-3.5 text-gray-400 dark:text-neutral-500"><Mail className="w-[17px] h-[17px]" /></span>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@stronilead.com.br" autoComplete="username" className={inputClass} required />
                </div>
              </label>

              <div>
                <label className="block">
                  <span className="text-[12.5px] font-semibold text-gray-700 dark:text-neutral-300">Senha</span>
                  <div className={fieldWrap}>
                    <span className="pl-3.5 text-gray-400 dark:text-neutral-500"><Lock className="w-[17px] h-[17px]" /></span>
                    <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" className={inputClass} required />
                    <span className="pr-2">
                      <button type="button" onClick={() => setShowPass(s => !s)} title={showPass ? 'Ocultar' : 'Mostrar'} className="w-9 h-9 grid place-items-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition">
                        {showPass ? <EyeOff className="w-[17px] h-[17px]" /> : <Eye className="w-[17px] h-[17px]" />}
                      </button>
                    </span>
                  </div>
                </label>
                <div className="mt-2.5 flex items-center justify-between">
                  <button type="button" onClick={() => setRemember(r => !r)} className="inline-flex items-center gap-2 group">
                    <span className={`w-[18px] h-[18px] rounded-[6px] grid place-items-center border transition ${remember ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-300 dark:border-white/20 text-transparent group-hover:border-gray-400'}`}>
                      <Check className="w-3 h-3" />
                    </span>
                    <span className="text-[12.5px] text-gray-600 dark:text-neutral-300 font-medium">Manter conectado</span>
                  </button>
                  <button type="button" onClick={handleForgotPassword} className="text-[12.5px] font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 hover:underline">
                    Esqueci a senha
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[14px] font-semibold inline-flex items-center justify-center gap-2 transition active:scale-[.99] shadow-sm shadow-brand-600/20 disabled:opacity-90 disabled:cursor-default">
                {loading
                  ? (<><span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white spin"></span> Entrando…</>)
                  : (<>Entrar <ArrowRight className="w-4 h-4" /></>)}
              </button>
            </form>

            <p className="mt-7 text-center text-[12.5px] text-gray-500 dark:text-neutral-400">
              Problemas para acessar?{' '}
              <button type="button" onClick={handleForgotPassword} className="font-semibold text-gray-700 dark:text-neutral-200 hover:underline">Recuperar acesso</button>
            </p>
          </div>
        </div>

        <div className="pt-8 flex items-center justify-center gap-1.5 text-[11.5px] text-gray-400 dark:text-neutral-500">
          <Shield className="w-3.5 h-3.5" /> Conexão segura · STRONILEAD © 2026
        </div>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTES AUXILIARES
// ==========================================
function FunnelSelector({ funnels, value, onChange, compact = false, variant = 'standalone', allowAll = false, className = '' }) {
  const list = Array.isArray(funnels) ? funnels : [];
  if (list.length === 0) {
    return (
      <div className={`text-xs font-medium text-gray-400 dark:text-neutral-500 italic px-4 py-3 ${className}`}>
        Sem funis cadastrados
      </div>
    );
  }
  const padY = compact ? 'py-2.5' : 'py-3';
  const padX = compact ? 'pl-10 pr-10' : 'pl-12 pr-11';
  const textSize = compact ? 'text-xs' : 'text-sm';
  const bg = variant === 'soft'
    ? 'bg-paper-50 dark:bg-neutral-950'
    : 'bg-white dark:bg-neutral-900';
  const iconPos = compact ? 'left-3.5' : 'left-4';
  const chevronPos = compact ? 'right-3' : 'right-4';
  const iconSize = compact ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <div className={`relative group ${className}`}>
      <Kanban className={`absolute ${iconPos} top-1/2 -translate-y-1/2 ${iconSize} text-gray-400 dark:text-neutral-500 group-focus-within:text-brand-600 transition-colors pointer-events-none`} />
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full ${bg} border border-gray-200 dark:border-neutral-800 rounded-2xl ${padX} ${padY} ${textSize} font-semibold text-gray-900 dark:text-white outline-none focus:border-brand-600 transition-all shadow-sm cursor-pointer appearance-none`}
      >
        {allowAll && (
          <option value={ALL_FUNNELS_ID}>★ Todos os funis</option>
        )}
        {list.map((f) => (
          <option key={f.id} value={f.id}>{f.name}{f.isDefault ? ' • Padrão' : ''}</option>
        ))}
      </select>
      <svg className={`absolute ${chevronPos} top-1/2 -translate-y-1/2 ${iconSize} text-gray-400 dark:text-neutral-500 pointer-events-none`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
      </svg>
    </div>
  );
}

// --- TOAST NOTIFICATIONS ---
const ToastContext = createContext(null);

const TOAST_DEFAULT_DURATION = 4000;

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message, options = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const toast = {
      id,
      message,
      type: options.type || 'info',
      duration: options.duration === 0 ? 0 : (options.duration || TOAST_DEFAULT_DURATION),
      title: options.title || null
    };
    setToasts(prev => [...prev, toast]);
    if (toast.duration > 0) {
      setTimeout(() => removeToast(id), toast.duration);
    }
    return id;
  }, [removeToast]);

  const api = useMemo(() => ({
    show: showToast,
    success: (msg, opts = {}) => showToast(msg, { ...opts, type: 'success' }),
    error: (msg, opts = {}) => showToast(msg, { ...opts, type: 'error' }),
    info: (msg, opts = {}) => showToast(msg, { ...opts, type: 'info' }),
    warning: (msg, opts = {}) => showToast(msg, { ...opts, type: 'warning' }),
    dismiss: removeToast
  }), [showToast, removeToast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback seguro: caso algum componente seja renderizado fora do Provider
    return {
      show: (msg) => { console.warn('Toast fora do Provider:', msg); },
      success: (msg) => { console.warn('Toast fora do Provider:', msg); },
      error: (msg) => { console.warn('Toast fora do Provider:', msg); window.alert(msg); },
      info: (msg) => { console.warn('Toast fora do Provider:', msg); },
      warning: (msg) => { console.warn('Toast fora do Provider:', msg); },
      dismiss: () => {}
    };
  }
  return ctx;
}

// Config geral (modalidades + nº máx de aulas experimentais) exposta via
// Context para evitar threading por todos os componentes que renderizam o
// LeadDetailsModal / RescheduleModal. Funciona através de portais (createPortal
// mantém a posição na árvore React).
const GeneralConfigContext = createContext({ modalities: [], trialClassOptions: [1, 2, 3], units: [], metaWeekdays: [1, 2, 3, 4, 5] });
function useGeneralConfig() {
  return useContext(GeneralConfigContext) || { modalities: [], trialClassOptions: [1, 2, 3], units: [], metaWeekdays: [1, 2, 3, 4, 5] };
}

function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none max-w-md w-[calc(100%-3rem)]">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const config = {
    success: {
      Icon: CheckCircle,
      iconClass: 'text-green-500',
      bar: 'from-green-500 to-emerald-400'
    },
    error: {
      Icon: AlertCircle,
      iconClass: 'text-red-500',
      bar: 'from-red-500 to-pink-500'
    },
    warning: {
      Icon: AlertCircle,
      iconClass: 'text-yellow-500',
      bar: 'from-yellow-500 to-amber-400'
    },
    info: {
      Icon: Info,
      iconClass: 'text-brand-500',
      bar: 'from-brand-500 to-brand-400'
    }
  };
  const { Icon, iconClass, bar } = config[toast.type] || config.info;

  return (
    <div
      role="status"
      className="pointer-events-auto bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
    >
      <div className={`h-1 bg-gradient-to-r ${bar}`} />
      <div className="flex items-start gap-3 p-4">
        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconClass}`} />
        <div className="flex-1 min-w-0">
          {toast.title && (
            <p className="text-sm font-bold text-gray-900 dark:text-white mb-0.5">{toast.title}</p>
          )}
          <p className="text-sm text-gray-700 dark:text-neutral-300 font-medium leading-snug break-words">
            {toast.message}
          </p>
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className="text-gray-400 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-200 transition-colors shrink-0"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// --- SKELETON LOADING ---
function Skeleton({ className = '', rounded = 'rounded-2xl' }) {
  return (
    <div
      className={`animate-pulse bg-gray-200/70 dark:bg-neutral-800/70 ${rounded} ${className}`}
      aria-hidden="true"
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-12 w-[260px]" />
        <Skeleton className="h-12 w-[360px]" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" rounded="rounded-[2.5rem]" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28" rounded="rounded-[2.5rem]" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="lg:col-span-2 h-96" rounded="rounded-[2.5rem]" />
        <Skeleton className="h-96" rounded="rounded-[2.5rem]" />
      </div>
    </div>
  );
}

function KanbanSkeleton() {
  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <Skeleton className="h-6 w-48 mb-2" rounded="rounded-lg" />
            <Skeleton className="h-3 w-40" rounded="rounded-md" />
          </div>
          <Skeleton className="h-12 w-[280px]" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-12 w-[320px]" />
          <Skeleton className="h-12 w-[280px]" />
        </div>
      </div>
      <div className="flex gap-5 min-w-max h-full pb-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-[320px] rounded-[2rem] bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-5 flex flex-col gap-3">
            <Skeleton className="h-6 w-28 mb-2" rounded="rounded-full" />
            {Array.from({ length: 2 + (i % 3) }).map((_, j) => (
              <Skeleton key={j} className="h-28" rounded="rounded-2xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function LeadsSkeleton() {
  return (
    <div className="h-full flex flex-col space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-5 rounded-[2rem] shadow-xl">
        <Skeleton className="h-12 w-[280px]" />
        <Skeleton className="h-12 flex-1" />
        <Skeleton className="h-12 w-12" />
        <Skeleton className="h-12 w-28" />
        <Skeleton className="h-12 w-32" />
      </div>
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden flex-1 shadow-2xl p-6 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16" rounded="rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function DailyGoalSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <Skeleton className="h-32" rounded="rounded-[2.5rem]" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-[500px]" rounded="rounded-[2.5rem]" />
        <Skeleton className="h-[500px]" rounded="rounded-[2.5rem]" />
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="h-full flex flex-col md:flex-row gap-6 animate-fade-in max-w-7xl mx-auto w-full">
      <div className="w-full md:w-64 shrink-0 flex flex-col gap-2">
        <Skeleton className="h-8 w-40 mb-4" rounded="rounded-lg" />
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-2 rounded-2xl shadow-xl space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-11" rounded="rounded-xl" />
          ))}
        </div>
      </div>
      <div className="flex-1">
        <Skeleton className="h-[600px]" rounded="rounded-[2rem]" />
      </div>
    </div>
  );
}

function ViewSkeleton({ activeTab }) {
  switch (activeTab) {
    case 'kanban': return <KanbanSkeleton />;
    case 'dailyGoal': return <DailyGoalSkeleton />;
    case 'leads': return <LeadsSkeleton />;
    case 'aulas':
    case 'visitas': return <LeadsSkeleton />;
    case 'settings': return <SettingsSkeleton />;
    case 'dashboard':
    default:
      return <DashboardSkeleton />;
  }
}

function SidebarItem({ icon, label, active, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`group relative w-full h-11 pl-3.5 pr-3 rounded-xl flex items-center gap-3 text-[13.5px] font-medium transition-all ${active
        ? 'bg-brand-600 text-white shadow-[0_6px_16px_-6px_rgba(43,89,255,.65)]'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-neutral-300 dark:hover:bg-white/[0.06] dark:hover:text-white'}`}
    >
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-accent-500" />}
      <span className={active ? 'text-white' : 'text-gray-400 group-hover:text-brand-600 dark:text-neutral-500 dark:group-hover:text-white transition-colors'}>{icon}</span>
      <span className="flex-1 text-left whitespace-nowrap tracking-tight">{label}</span>
      {badge != null && (
        <span className={`text-[10.5px] font-bold px-1.5 h-[18px] rounded-md min-w-[18px] grid place-items-center tabular-nums shrink-0 ${active ? 'bg-white/20 text-white' : 'bg-accent-500/12 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400'}`}>{badge}</span>
      )}
    </button>
  );
}

// Item-pai recolhível: abre um "slide para baixo" com os sub-itens.
function SidebarGroup({ icon, label, active, open, onToggle, children }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className={`group w-full h-11 pl-3.5 pr-3 rounded-xl flex items-center gap-3 text-[13.5px] font-medium transition-all ${active
          ? 'bg-brand-50 text-brand-700 dark:bg-white/[0.06] dark:text-brand-300'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-neutral-300 dark:hover:bg-white/[0.06] dark:hover:text-white'}`}
      >
        <span className={active ? 'text-brand-600 dark:text-brand-300' : 'text-gray-400 group-hover:text-brand-600 dark:text-neutral-500 dark:group-hover:text-white transition-colors'}>{icon}</span>
        <span className="flex-1 text-left whitespace-nowrap tracking-tight">{label}</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${active ? 'text-brand-500 dark:text-brand-300' : 'text-gray-400 dark:text-neutral-500'}`} />
      </button>
      <div className={`grid transition-all duration-200 ease-in-out ${open ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="ml-[26px] pl-3 border-l border-slate-200 dark:border-white/[0.08] space-y-0.5 py-0.5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarSubItem({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`group w-full flex items-center gap-2.5 pl-3 pr-2.5 h-9 rounded-lg text-[13px] font-medium transition-all ${active ? 'bg-brand-600 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-white'}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-white' : 'bg-gray-300 group-hover:bg-brand-500 dark:bg-neutral-600'}`} />
      <span className="tracking-tight truncate">{label}</span>
    </button>
  );
}

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

// Modal Global de Motivo de Perda
function LossReasonModal({ lossReasons, onClose, onConfirm }) {
  const toast = useToast();
  const options = lossReasons?.length > 0 ? lossReasons : [{id: 'default', name: 'Sem motivo configurado'}];
  const [reason, setReason] = useState(options[0].name);

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[200] p-4 animate-fade-in font-sans">
      <div className="bg-white dark:bg-neutral-900 border border-red-500/30 w-full max-w-md rounded-[2rem] p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-2">
          <ThumbsDown className="w-6 h-6 text-red-500" />
          <h3 className="text-xl font-bold text-red-500 uppercase tracking-tighter">Sinalizar Perda</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-neutral-400 font-bold mb-6">Por favor, informe o motivo da perda deste lead.</p>
        <select value={reason} onChange={e=>setReason(e.target.value)} className="w-full bg-paper-50 dark:bg-neutral-950 p-4 rounded-xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 focus:border-red-500 text-xs font-bold mb-6 appearance-none">
           {options.map(r => <option key={r.id || r.name} value={r.name}>{r.name}</option>)}
        </select>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-4 bg-gray-100 dark:bg-neutral-800 rounded-xl font-bold text-[10px] uppercase text-gray-500 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700 dark:bg-neutral-700 transition-all">Cancelar</button>
          <button onClick={()=>{if(reason) onConfirm(reason); else toast.warning('Selecione um motivo!');}} className="flex-1 py-4 bg-red-600 rounded-xl font-bold text-[10px] uppercase text-gray-900 dark:text-white shadow-xl shadow-red-500/20 active:scale-95 transition-all">Confirmar Perda</button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// VISÃO GERAL (DASHBOARD) - PATCH 1 (AULA E VISITA)
// ==========================================
// ==========================================
// DASHBOARD — DESIGN PRIMITIVES
// ==========================================
// Extended color tones for dashboard (adds brand/emerald/slate vs Meta Diária's set).
// Uses `text-*` for stroke so SVG `stroke="currentColor"` resolves cleanly.
const DASH_TONES = {
  brand:   { dot: 'bg-brand-600',   strong: 'bg-brand-600',   stroke: 'text-brand-600',   text: 'text-brand-700',   soft: 'bg-brand-50',   darkText: 'dark:text-brand-300',   darkSoft: 'dark:bg-brand-500/10' },
  amber:   { dot: 'bg-amber-500',   strong: 'bg-amber-500',   stroke: 'text-amber-500',   text: 'text-amber-700',   soft: 'bg-amber-50',   darkText: 'dark:text-amber-300',   darkSoft: 'dark:bg-amber-500/10' },
  violet:  { dot: 'bg-violet-500',  strong: 'bg-violet-500',  stroke: 'text-violet-500',  text: 'text-violet-700',  soft: 'bg-violet-50',  darkText: 'dark:text-violet-300',  darkSoft: 'dark:bg-violet-500/10' },
  emerald: { dot: 'bg-emerald-500', strong: 'bg-emerald-500', stroke: 'text-emerald-500', text: 'text-emerald-700', soft: 'bg-emerald-50', darkText: 'dark:text-emerald-300', darkSoft: 'dark:bg-emerald-500/10' },
  rose:    { dot: 'bg-rose-500',    strong: 'bg-rose-500',    stroke: 'text-rose-500',    text: 'text-rose-700',    soft: 'bg-rose-50',    darkText: 'dark:text-rose-300',    darkSoft: 'dark:bg-rose-500/10' },
  teal:    { dot: 'bg-teal-500',    strong: 'bg-teal-500',    stroke: 'text-teal-500',    text: 'text-teal-700',    soft: 'bg-teal-50',    darkText: 'dark:text-teal-300',    darkSoft: 'dark:bg-teal-500/10' },
  slate:   { dot: 'bg-slate-400',   strong: 'bg-slate-400',   stroke: 'text-slate-400',   text: 'text-slate-700',   soft: 'bg-slate-100',  darkText: 'dark:text-slate-300',   darkSoft: 'dark:bg-white/[0.05]' }
};

function DashCard({ title, hint, icon, action, children, padded = true }) {
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-card">
      {title && (
        <header className="px-5 py-4 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-white/[0.05]">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <span className="w-7 h-7 rounded-md grid place-items-center bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300 shrink-0">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold whitespace-nowrap">{title}</h3>
              {hint && <p className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">{hint}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

function DashSparkline({ data, accent = 'brand', height = 42 }) {
  const w = 120;
  const h = height;
  const p = 3;
  const safeData = (data && data.length > 0) ? data : [0];
  const min = Math.min(...safeData);
  const max = Math.max(...safeData);
  const range = max - min || 1;
  const stepX = safeData.length > 1 ? (w - p * 2) / (safeData.length - 1) : 0;
  const pts = safeData.map((v, i) => [p + i * stepX, h - p - ((v - min) / range) * (h - p * 2)]);
  const path = pts.map((pt, i) => (i === 0 ? 'M' : 'L') + pt[0].toFixed(1) + ',' + pt[1].toFixed(1)).join(' ');
  const area = path + ` L${(w - p).toFixed(1)},${(h - p).toFixed(1)} L${p.toFixed(1)},${(h - p).toFixed(1)} Z`;
  const t = DASH_TONES[accent] || DASH_TONES.brand;
  const gradId = useMemo(() => `g-${accent}-${Math.random().toString(36).slice(2, 7)}`, [accent]);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`w-full ${t.stroke}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} stroke="none" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      {pts.length > 0 && (
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" stroke="currentColor" strokeWidth="1.5" fill="white" />
      )}
    </svg>
  );
}

// Ícone "?" com tooltip on hover/focus. Acessível via teclado (Tab),
// fecha ao tirar o foco. Tooltip aparece acima do ícone, alinhado ao
// canto esquerdo do próprio ícone para evitar sair do viewport quando
// o card está colado na borda direita. Largura fixa para texto longo
// quebrar bonito.
function DashHelpTip({ text, label = 'O que isso significa?' }) {
  return (
    <span className="relative inline-flex group">
      <button
        type="button"
        aria-label={label}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 transition cursor-help peer"
      >
        <HelpCircle size={12} strokeWidth={2.2} />
      </button>
      <span
        role="tooltip"
        // whitespace-normal/break-words: o pai do tooltip tem
        // whitespace-nowrap (label do KPI não pode quebrar). Como
        // white-space é HERDADO, sem override o texto do balão sai
        // numa linha só e o bg fica preso aos 280px declarados,
        // vazando o texto.
        className="pointer-events-none absolute left-0 bottom-full mb-2 z-40 w-72 p-3 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[11.5px] leading-relaxed font-normal whitespace-normal break-words shadow-xl opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 peer-focus-visible:opacity-100 peer-focus-visible:translate-y-0 transition duration-150"
      >
        {text}
        <span className="absolute top-full left-3 w-0 h-0 border-[5px] border-transparent border-t-slate-900 dark:border-t-slate-100" />
      </span>
    </span>
  );
}

function DashKpiCard({ label, value, delta, accent = 'brand', series, sub, help }) {
  const up = delta == null ? null : delta >= 0;
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
          <span>{label}</span>
          {help && <DashHelpTip text={help} label={`O que é "${label}"?`} />}
        </div>
        {delta != null && (
          <span className={`inline-flex items-center gap-1 px-1.5 h-5 rounded-md text-[11px] font-semibold num whitespace-nowrap ${
            up
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
          }`}>
            {up ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="num text-[32px] font-semibold tracking-tight leading-none">{value}</span>
      </div>
      <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1 whitespace-nowrap truncate">
        {sub || 'vs. período anterior'}
      </div>
      {series && series.length > 0 && (
        <div className="mt-3 -mx-1">
          <DashSparkline data={series} accent={accent} height={42} />
        </div>
      )}
    </div>
  );
}

function DashPeriodTabs({ value, onChange }) {
  const opts = [
    { id: 'today',       label: 'Hoje' },
    { id: 'weekly',      label: 'Semana' },
    { id: 'monthly',     label: 'Mês atual' },
    { id: 'monthlyPrev', label: 'Mês anterior' },
    { id: 'custom',      label: 'Personalizado' }
  ];
  return (
    <div className="inline-flex p-1 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06]">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`h-8 px-3.5 rounded-lg text-[12.5px] font-semibold whitespace-nowrap transition ${
            value === o.id
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DashFunnel({ steps, onStepClick }) {
  if (!steps || steps.length === 0) return null;
  const max = Math.max(...steps.map((s) => s.count), 1);
  const top = steps[0].count || 0;
  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const t = DASH_TONES[s.color] || DASH_TONES.brand;
        const widthPct = Math.max(2, (s.count / max) * 100);
        const prev = i > 0 ? steps[i - 1].count : null;
        const conv = prev ? Math.round((s.count / prev) * 100) : 100;
        const drop = prev != null ? prev - s.count : 0;
        const topPct = top > 0 ? Math.round((s.count / top) * 100) : 0;
        const clickable = Boolean(onStepClick);
        return (
          <div
            key={s.id}
            onClick={clickable ? () => onStepClick(s) : undefined}
            className={clickable ? 'cursor-pointer hover:opacity-90 transition' : ''}
          >
            <div className="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`}></span>
                <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">{s.label}</span>
                {s.hint && <span className="text-[11.5px] text-slate-400 dark:text-slate-500 truncate">· {s.hint}</span>}
              </div>
              <div className="flex items-center gap-3 text-[12px] num whitespace-nowrap">
                {i > 0 && drop > 0 && (
                  <span className="text-slate-400 dark:text-slate-500">
                    <span className={conv >= 60 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold'}>{conv}%</span>
                    <span className="mx-1">·</span>
                    <span>−{drop}</span>
                  </span>
                )}
                <span className="font-semibold text-slate-900 dark:text-white">{s.count}</span>
              </div>
            </div>
            <div className="h-9 rounded-lg bg-slate-100 dark:bg-white/[0.04] overflow-hidden flex items-center px-1">
              <div
                className={`h-7 rounded-md ${t.strong} flex items-center px-2.5 text-white text-[12px] font-semibold num`}
                style={{ width: `${widthPct}%` }}
              >
                <span className="opacity-90 whitespace-nowrap">{topPct}% do topo</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


function DashRingStat({ value, accent = 'brand', size = 80 }) {
  const R = 30;
  const C = 2 * Math.PI * R;
  const t = DASH_TONES[accent] || DASH_TONES.brand;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={R} stroke="currentColor" className="text-slate-100 dark:text-white/[0.06]" strokeWidth="7" fill="none" />
        <circle
          cx="40"
          cy="40"
          r={R}
          stroke="currentColor"
          className={t.stroke}
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C - (C * pct) / 100}
          style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.7,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="num text-[14px] font-semibold">{pct}%</span>
      </div>
    </div>
  );
}



function DashTeamRow({ row, maxLeads }) {
  return (
    <tr className="border-t border-slate-100 dark:border-white/[0.05] hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition">
      <td className="py-3 pl-5 pr-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={row.name} size={30} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-semibold text-slate-900 dark:text-white whitespace-nowrap">{row.name}</span>
              {row.isYou && (
                <span className="text-[10px] font-semibold px-1.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">você</span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <span className="num text-[13px] font-semibold text-slate-700 dark:text-slate-200 w-7 text-right">{row.total}</span>
          <div className="w-24 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.05] overflow-hidden">
            <div className="h-full bg-brand-600 rounded-full" style={{ width: `${maxLeads > 0 ? (row.total / maxLeads) * 100 : 0}%` }}></div>
          </div>
        </div>
      </td>
      <td className="py-3 px-3 num text-[13px] text-center text-slate-700 dark:text-slate-200">{row.agendadosVisita}</td>
      <td className="py-3 px-3 num text-[13px] text-center text-slate-700 dark:text-slate-200">{row.agendadosAula}</td>
      <td className="py-3 px-3 num text-[13px] text-center font-semibold text-emerald-600 dark:text-emerald-400">{row.convertidos}</td>
      <td className="py-3 pr-5 pl-3 num text-[13px] text-right font-semibold text-slate-900 dark:text-white">
        {row.txConversaoGlobal == null ? (
          <span className="text-slate-400 dark:text-slate-500" title="Sem leads captados no período">—</span>
        ) : `${row.txConversaoGlobal}%`}
      </td>
    </tr>
  );
}

function DashTeamTable({ rows, appUser }) {
  const maxLeads = Math.max(...rows.map((r) => r.total), 1);
  return (
    <div className="overflow-x-auto thin-scroll">
      <table className="w-full text-left min-w-[640px]">
        <thead>
          <tr className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <th className="py-2.5 pl-5 pr-3 font-semibold">Consultor</th>
            <th className="py-2.5 px-3 font-semibold">Leads</th>
            <th className="py-2.5 px-3 font-semibold text-center">Visitas</th>
            <th className="py-2.5 px-3 font-semibold text-center">Aulas</th>
            <th className="py-2.5 px-3 font-semibold text-center">Matr.</th>
            <th className="py-2.5 pr-5 pl-3 font-semibold text-right">Conv. global</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <DashTeamRow key={r.name + i} row={{ ...r, isYou: r.name === appUser?.name }} maxLeads={maxLeads} />
          ))}
        </tbody>
      </table>
    </div>
  );
}


function DashSourceList({ items }) {
  const total = items.reduce((s, x) => s + x.count, 0);
  const palette = ['brand', 'rose', 'emerald', 'teal', 'amber', 'slate'];
  return (
    <div className="space-y-3">
      {items.map((s, i) => {
        const t = DASH_TONES[s.color || palette[i % palette.length]] || DASH_TONES.slate;
        const pct = total ? Math.round((s.count / total) * 100) : 0;
        return (
          <div key={s.name}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-slate-200 whitespace-nowrap">
                <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`}></span>
                <span className="font-medium truncate max-w-[140px]">{s.name}</span>
              </div>
              <div className="num text-[12px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                <span className="font-semibold text-slate-900 dark:text-white">{s.count}</span>
                <span className="mx-1 opacity-50">·</span>
                <span>{pct}%</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.05] overflow-hidden">
              <div className={`h-full ${t.strong}`} style={{ width: `${pct}%` }}></div>
            </div>
          </div>
        );
      })}
      {items.length === 0 && (
        <p className="text-[12px] text-slate-400 dark:text-slate-500 italic py-2">Nenhum dado captado no período.</p>
      )}
    </div>
  );
}

function DashTaskItem({ lead, onClick }) {
  const apptDate = getLeadAppointmentDate(lead) || lead.nextFollowUp;
  const apptType = getLeadAppointmentType(lead);
  const isOverdue = apptDate && apptDate < new Date();
  const when = apptDate ? `${apptDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · ${formatHourLabel(apptDate)}` : '';
  const TypeIcon = apptType === 'visita' || apptType === 'aula_experimental' ? Calendar : Phone;
  return (
    <div
      onClick={() => onClick && onClick(lead)}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.05] hover:border-slate-300 dark:hover:border-white/10 transition cursor-pointer"
    >
      <Avatar name={lead.name} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[13px] truncate">{lead.name}</span>
          {isOverdue && (
            <span className="text-[10px] font-semibold px-1.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 whitespace-nowrap">atrasado</span>
          )}
        </div>
        <div className="text-[11.5px] text-slate-500 dark:text-slate-400 num">{lead.whatsapp}</div>
      </div>
      <div className="text-[11.5px] text-slate-500 dark:text-slate-400 num whitespace-nowrap inline-flex items-center gap-1 shrink-0">
        <TypeIcon size={12} />
        {when}
      </div>
    </div>
  );
}

function DashActivityRow({ item }) {
  const t = DASH_TONES[item.tone] || DASH_TONES.slate;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className={`mt-0.5 w-2 h-2 rounded-full ${t.dot} ring-4 ring-white dark:ring-ink-900 shrink-0`}></div>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] text-slate-700 dark:text-slate-200 leading-snug">
          <span className="font-semibold text-slate-900 dark:text-white">{item.who}</span>
          <span className="text-slate-500 dark:text-slate-400"> {item.what} </span>
          <span className="font-medium">{item.who2}</span>
        </div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500 num mt-0.5">{item.when}</div>
      </div>
    </div>
  );
}

// ==========================================
// DASHBOARD VIEW
// ==========================================
function DashboardView({ leads, interactions, appUser, statuses, usersList, tags, lossReasons, db, funnels, selectedFunnelId, setSelectedFunnelId }) {
  const [periodPreset, setPeriodPreset] = useState('monthly');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [funnelDetail, setFunnelDetail] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);

  const defaultFunnelId = useMemo(() => getDefaultFunnel(funnels)?.id || null, [funnels]);
  const hasFunnels = (funnels || []).length > 0;
  const currentFunnel = useMemo(
    () => (funnels || []).find(f => f.id === selectedFunnelId) || null,
    [funnels, selectedFunnelId]
  );
  const funnelLeads = useMemo(() => {
    if (isAllFunnels(selectedFunnelId)) return leads || [];
    return (leads || []).filter(l => isItemInFunnel(l, selectedFunnelId, defaultFunnelId));
  }, [leads, selectedFunnelId, defaultFunnelId]);

 const periodRange = useMemo(() => {
  const now = new Date();

  if (periodPreset === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  if (periodPreset === 'weekly') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day; // semana iniciando na segunda
    start.setDate(start.getDate() + diff);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  if (periodPreset === 'custom') {
    if (!customStartDate || !customEndDate) return null;

    const start = new Date(`${customStartDate}T00:00:00`);
    const end = new Date(`${customEndDate}T23:59:59.999`);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return null;

    return { start, end };
  }

  if (periodPreset === 'monthlyPrev') {
    // Mês civil anterior completo (jan → dez do ano anterior auto-rola
    // pelo construtor Date).
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start, end };
  }

  // Default: 'monthly' (mês atual).
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  return { start, end };
}, [periodPreset, customStartDate, customEndDate]);

  const isWithinSelectedRange = (date) => {
    const safeDate = getSafeDateOrNull(date);
    if (!periodRange || !safeDate) return false;
    return safeDate >= periodRange.start && safeDate <= periodRange.end;
  };

  const capturedLeads = useMemo(() => {
    return funnelLeads.filter(l => isWithinSelectedRange(l.createdAt));
  }, [funnelLeads, periodRange]);

  const scheduledLeads = useMemo(() => {
    return funnelLeads.filter(l => {
      const appointmentType = getLeadAppointmentType(l);
      const appointmentDate = getLeadAppointmentDate(l);

      return Boolean(appointmentType && appointmentDate && isWithinSelectedRange(appointmentDate));
    });
  }, [funnelLeads, periodRange]);

  const convertedLeads = useMemo(() => {
    return funnelLeads.filter(l => {
      return isLeadConverted(l) && isWithinSelectedRange(getLeadConversionDate(l));
    });
  }, [funnelLeads, periodRange]);

  // Breakdown de aulas experimentais agendadas por modalidade (no período/funil).
  const aulasPorModalidade = useMemo(() => {
    const map = new Map();
    scheduledLeads.forEach(l => {
      if (getLeadAppointmentType(l) !== 'aula_experimental') return;
      const key = (l.appointmentModality || '').trim() || 'Sem modalidade';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [scheduledLeads]);

  const stats = useMemo(() => {
    const total = capturedLeads.length;

    // Contadores operacionais (eventos cuja DATA caiu no período).
    // Usados como números absolutos nos KPIs e no funil.
    const agendadosVisita = scheduledLeads.filter(
      l => getLeadAppointmentType(l) === 'visita'
    ).length;

    const agendadosAula = scheduledLeads.filter(
      l => getLeadAppointmentType(l) === 'aula_experimental'
    ).length;

    const convertidos = convertedLeads.length;

    const convertidosVisita = convertedLeads.filter(
      l => getLeadAppointmentType(l) === 'visita'
    ).length;

    const convertidosAula = convertedLeads.filter(
      l => getLeadAppointmentType(l) === 'aula_experimental'
    ).length;

    // Taxas calculadas SOBRE A COORTE de captação do período (mesmo
    // denominador e numerador). Evita o paradoxo de mostrar "150% de
    // conversão" quando o numerador vem de uma coorte e o denominador
    // de outra (leads captados em meses anteriores que matricularam
    // agora, etc.).
    const coorteVisita = capturedLeads.filter(l =>
      getLeadAppointmentType(l) === 'visita' && getLeadAppointmentDate(l)
    ).length;
    const coorteAula = capturedLeads.filter(l =>
      getLeadAppointmentType(l) === 'aula_experimental' && getLeadAppointmentDate(l)
    ).length;
    const coorteConvertidos = capturedLeads.filter(isLeadConverted).length;
    const coorteConvVisita = capturedLeads.filter(l =>
      getLeadAppointmentType(l) === 'visita' && isLeadConverted(l)
    ).length;
    const coorteConvAula = capturedLeads.filter(l =>
      getLeadAppointmentType(l) === 'aula_experimental' && isLeadConverted(l)
    ).length;

    const txAgVisita = total > 0 ? Math.round((coorteVisita / total) * 100) : 0;
    const txAgAula = total > 0 ? Math.round((coorteAula / total) * 100) : 0;
    const txConv = total > 0 ? Math.round((coorteConvertidos / total) * 100) : 0;

    const txConvVisita = coorteVisita > 0 ? Math.round((coorteConvVisita / coorteVisita) * 100) : 0;
    const txConvAula = coorteAula > 0 ? Math.round((coorteConvAula / coorteAula) * 100) : 0;

    return {
      total,
      agendadosVisita,
      agendadosAula,
      convertidos,
      convertidosVisita,
      convertidosAula,
      coorteVisita,
      coorteAula,
      coorteConvertidos,
      txAgVisita,
      txAgAula,
      txConv,
      txConvVisita,
      txConvAula
    };
  }, [capturedLeads, scheduledLeads, convertedLeads]);

  const pendingFollowUps = useMemo(() => {
    return funnelLeads
      .filter(
        l =>
          l.status !== 'Venda' &&
          l.status !== 'Perda' &&
          l.nextFollowUp instanceof Date &&
          !isNaN(l.nextFollowUp.getTime())
      )
      .sort((a, b) => a.nextFollowUp.getTime() - b.nextFollowUp.getTime());
  }, [funnelLeads]);

const teamMetrics = useMemo(() => {
  const metrics = {};

  const ensureConsultant = (lead) => {
    const cId = lead.consultantId || 'unassigned';

    if (!metrics[cId]) {
      metrics[cId] = {
        name: lead.consultantName || 'Desconhecido',
        total: 0,
        agendadosVisita: 0,
        agendadosAula: 0,
        convertidos: 0,
        convertidosVisita: 0,
        convertidosAula: 0,
        txVisita: 0,
        txAula: 0,
        txConvVisita: 0,
        txConvAula: 0,
        txConversaoGlobal: 0
      };
    }

    return cId;
  };

  [...capturedLeads, ...scheduledLeads, ...convertedLeads].forEach(ensureConsultant);

  capturedLeads.forEach(l => {
    const cId = ensureConsultant(l);
    metrics[cId].total += 1;
  });

  scheduledLeads.forEach(l => {
    const cId = ensureConsultant(l);
    const type = getLeadAppointmentType(l);

    if (type === 'visita') metrics[cId].agendadosVisita += 1;
    if (type === 'aula_experimental') metrics[cId].agendadosAula += 1;
  });

  convertedLeads.forEach(l => {
    const cId = ensureConsultant(l);
    const type = getLeadAppointmentType(l);

    metrics[cId].convertidos += 1;

    if (type === 'visita') metrics[cId].convertidosVisita += 1;
    if (type === 'aula_experimental') metrics[cId].convertidosAula += 1;
  });

  Object.values(metrics).forEach(m => {
    // null quando não há coorte de captação no período — evita
    // mostrar "0%" para consultor que fechou leads captados antes.
    m.txVisita = m.total > 0 ? Math.round((m.agendadosVisita / m.total) * 100) : null;
    m.txAula = m.total > 0 ? Math.round((m.agendadosAula / m.total) * 100) : null;
    m.txConvVisita = m.agendadosVisita > 0 ? Math.round((m.convertidosVisita / m.agendadosVisita) * 100) : null;
    m.txConvAula = m.agendadosAula > 0 ? Math.round((m.convertidosAula / m.agendadosAula) * 100) : null;
    m.txConversaoGlobal = m.total > 0 ? Math.round((m.convertidos / m.total) * 100) : null;
  });

  return Object.values(metrics).sort(
    (a, b) => b.convertidos - a.convertidos || b.total - a.total
  );
}, [capturedLeads, scheduledLeads, convertedLeads]);
  const sourceMetrics = useMemo(() => {
    const metrics = {};
    capturedLeads.forEach(l => {
      const src = l.source || 'Desconhecida';
      metrics[src] = (metrics[src] || 0) + 1;
    });

    return Object.entries(metrics)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [capturedLeads]);

  // --- TABELA "MÉTRICAS POR FUNIL" (modo Geral) ---
  // Agnóstica de etapas: cada linha agrega leads/visitas/aulas/matrículas/taxa
  // usando os mesmos campos usados pelos KPIs globais. Funcione para qualquer
  // funil criado pelo usuário (ou por tenants futuros).
  const funnelComparisonRows = useMemo(() => {
    if (!isAllFunnels(selectedFunnelId)) return [];
    if (!Array.isArray(funnels) || funnels.length === 0) return [];

    const rows = funnels.map(funnel => {
      const scope = (leads || []).filter(l => isItemInFunnel(l, funnel.id, defaultFunnelId));
      const captured = scope.filter(l => isWithinSelectedRange(l.createdAt));
      const visits = scope.filter(l => {
        const t = getLeadAppointmentType(l);
        const d = getLeadAppointmentDate(l);
        return t === 'visita' && d && isWithinSelectedRange(d);
      });
      const classes = scope.filter(l => {
        const t = getLeadAppointmentType(l);
        const d = getLeadAppointmentDate(l);
        return t === 'aula_experimental' && d && isWithinSelectedRange(d);
      });
      const converted = scope.filter(l => isLeadConverted(l) && isWithinSelectedRange(getLeadConversionDate(l)));
      const rate = captured.length > 0 ? Math.round((converted.length / captured.length) * 100) : 0;
      return {
        funnel,
        captured: captured.length,
        visits: visits.length,
        classes: classes.length,
        converted: converted.length,
        rate
      };
    });

    // Ordenação: matrículas DESC → leads DESC → ordem de criação ASC (tie-break)
    rows.sort((a, b) => {
      if (b.converted !== a.converted) return b.converted - a.converted;
      if (b.captured !== a.captured) return b.captured - a.captured;
      return (a.funnel.order || 0) - (b.funnel.order || 0);
    });

    return rows;
  }, [selectedFunnelId, leads, funnels, defaultFunnelId, periodRange]);

  // Totais da tabela. Taxa é recalculada do agregado (não média de rates) — Simpson's paradox.
  const funnelComparisonTotals = useMemo(() => {
    if (funnelComparisonRows.length === 0) return null;
    const sum = funnelComparisonRows.reduce((acc, r) => ({
      captured: acc.captured + r.captured,
      visits: acc.visits + r.visits,
      classes: acc.classes + r.classes,
      converted: acc.converted + r.converted
    }), { captured: 0, visits: 0, classes: 0, converted: 0 });
    const rate = sum.captured > 0 ? Math.round((sum.converted / sum.captured) * 100) : 0;
    return { ...sum, rate };
  }, [funnelComparisonRows]);

  // --- NEW DASHBOARD COMPUTATIONS ---

  // Taxa de comparecimento: numerador e denominador SAEM DA MESMA BASE
  // — apenas agendamentos cuja data já passou. Contar comparecimento
  // sobre todos os agendados (incluindo futuros já marcados como
  // atendidos, ex.: lead que virou Venda antes da aula marcada) inflava
  // o numerador e a taxa podia passar de 100% ("2 compareceram / 1
  // realizado"). Agendamentos futuros entram só como "+N futuros".
  const { compareceram, apptPassados } = useMemo(() => {
    const now = new Date();
    const passados = scheduledLeads.filter(l => {
      const t = getLeadAppointmentType(l);
      const d = getLeadAppointmentDate(l);
      return (t === 'visita' || t === 'aula_experimental') && d && d <= now;
    });
    return {
      compareceram: passados.filter(isLeadAttended).length,
      apptPassados: passados.length
    };
  }, [scheduledLeads]);
  const totalAppt = stats.agendadosVisita + stats.agendadosAula;
  const taxaComp = apptPassados > 0 ? Math.round((compareceram / apptPassados) * 100) : 0;

  // Série diária dos sparklines. Quando o período já TERMINOU (ex.: "Mês
  // anterior"), o gráfico acompanha o próprio período — mostra a
  // distribuição dia a dia do que compõe cada KPI naquele intervalo.
  // Quando o período inclui hoje (Hoje/Semana/Mês atual), mostra os
  // últimos 14 dias até hoje: tendência recente "cheia", sem a zona
  // morta dos dias que ainda não chegaram.
  const sparklines = useMemo(() => {
    const DAY = 86400000;
    let firstDay, nDays;
    if (periodRange && periodRange.end < new Date()) {
      const start = new Date(periodRange.start); start.setHours(0, 0, 0, 0);
      const end = new Date(periodRange.end); end.setHours(0, 0, 0, 0);
      nDays = Math.round((end - start) / DAY) + 1;
      firstDay = start;
    } else {
      firstDay = new Date(); firstDay.setHours(0, 0, 0, 0);
      firstDay.setDate(firstDay.getDate() - 13);
      nDays = 14;
    }

    const series = { leads: [], visitas: [], aulas: [], matriculas: [] };
    for (let i = 0; i < nDays; i++) {
      const dayStart = new Date(firstDay);
      dayStart.setDate(dayStart.getDate() + i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const inDay = (d) => d && d >= dayStart && d <= dayEnd;

      series.leads.push(funnelLeads.filter((l) => inDay(l.createdAt)).length);
      series.visitas.push(funnelLeads.filter((l) => getLeadAppointmentType(l) === 'visita' && inDay(getLeadAppointmentDate(l))).length);
      series.aulas.push(funnelLeads.filter((l) => getLeadAppointmentType(l) === 'aula_experimental' && inDay(getLeadAppointmentDate(l))).length);
      series.matriculas.push(funnelLeads.filter((l) => isLeadConverted(l) && inDay(getLeadConversionDate(l))).length);
    }
    return series;
  }, [funnelLeads, periodRange]);

  // Período equivalente anterior usado nos deltas (▲▼ dos KPIs).
  // Calculado por PRESET (não por span em ms) para casar com o
  // calendário civil: "Mês" vira mês civil anterior completo, etc.
  // — assim a comparação não desliza pelos meses de 28/30/31 dias.
  const previousRange = useMemo(() => {
    if (!periodRange) return null;

    if (periodPreset === 'today') {
      // Ontem inteiro.
      const start = new Date(periodRange.start);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    if (periodPreset === 'weekly') {
      // Semana anterior (seg-dom).
      const start = new Date(periodRange.start);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    if (periodPreset === 'monthly' || periodPreset === 'monthlyPrev') {
      // Sempre o mês civil completo IMEDIATAMENTE ANTES do mês exibido:
      // - 'monthly'     (mês atual)    → previous = mês passado
      // - 'monthlyPrev' (mês passado)  → previous = mês retrasado
      // jan→dez do ano anterior auto-rola pelo construtor Date.
      const y = periodRange.start.getFullYear();
      const m = periodRange.start.getMonth();
      const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
      const end = new Date(y, m, 0, 23, 59, 59, 999);
      return { start, end };
    }

    // 'custom' — janela de mesma duração imediatamente antes (sem
    // alternativa civil razoável quando o usuário escolheu datas
    // arbitrárias).
    const span = periodRange.end - periodRange.start;
    const start = new Date(periodRange.start.getTime() - span - 1);
    const end = new Date(periodRange.start.getTime() - 1);
    return { start, end };
  }, [periodPreset, periodRange]);

  // Delta % vs período anterior equivalente.
  const deltas = useMemo(() => {
    if (!previousRange) return { leads: null, visitas: null, aulas: null, matriculas: null };
    const within = (d) => d && d >= previousRange.start && d <= previousRange.end;

    const prevLeads = funnelLeads.filter((l) => within(l.createdAt)).length;
    const prevVisitas = funnelLeads.filter((l) => getLeadAppointmentType(l) === 'visita' && within(getLeadAppointmentDate(l))).length;
    const prevAulas = funnelLeads.filter((l) => getLeadAppointmentType(l) === 'aula_experimental' && within(getLeadAppointmentDate(l))).length;
    const prevMatriculas = funnelLeads.filter((l) => isLeadConverted(l) && within(getLeadConversionDate(l))).length;

    const pct = (curr, prev) => (prev > 0 ? ((curr - prev) / prev) * 100 : (curr > 0 ? 100 : null));
    return {
      leads: pct(stats.total, prevLeads),
      visitas: pct(stats.agendadosVisita, prevVisitas),
      aulas: pct(stats.agendadosAula, prevAulas),
      matriculas: pct(stats.convertidos, prevMatriculas)
    };
  }, [funnelLeads, previousRange, stats]);

  // Activity feed: last 5 interactions in period, mapped to a UI shape.
  // Filtra por funnelLeads para respeitar o filtro de funil selecionado
  // — o restante do Dashboard já filtra; o feed precisa acompanhar.
  const activityFeed = useMemo(() => {
    if (!periodRange) return [];
    const leadById = new Map(funnelLeads.map((l) => [l.id, l]));
    const myAuthUid = appUser?.authUid || appUser?.id || null;
    return (interactions || [])
      .filter((i) => leadById.has(i.leadId))
      .filter((i) => i.createdAt instanceof Date && i.createdAt >= periodRange.start && i.createdAt <= periodRange.end)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 6)
      .map((i) => {
        const lead = leadById.get(i.leadId);
        const isYou =
          myAuthUid &&
          (i.consultantAuthUid === myAuthUid || i.leadConsultantAuthUid === myAuthUid || i.consultantName === appUser?.name);
        const who = isYou ? 'Você' : (i.consultantName || 'Sistema');
        let what = 'registrou atividade em';
        let tone = 'slate';
        const txt = String(i.text || '');
        if (i.type === 'daily_goal_done') {
          if (i.appointmentOutcome === 'attended' || /compareceu/i.test(txt)) {
            what = 'marcou comparecimento de'; tone = 'emerald';
          } else if (i.appointmentOutcome === 'no_show' || /não veio/i.test(txt)) {
            what = 'marcou Não veio de'; tone = 'rose';
          } else if (i.appointmentOutcome === 'rescheduled' || /remarc/i.test(txt)) {
            what = 'remarcou'; tone = 'amber';
          } else if (i.appointmentOutcome === 'cancelled' || /cancelou/i.test(txt)) {
            what = 'cancelou agendamento de'; tone = 'slate';
          } else {
            what = 'concluiu tarefa de'; tone = 'brand';
          }
        } else if (i.type === 'status_change') {
          if (lead?.status === 'Venda' || /matrícul/i.test(txt)) {
            what = 'fechou matrícula de'; tone = 'emerald';
          } else if (lead?.status === 'Perda' || /perd/i.test(txt)) {
            what = 'registrou perda de'; tone = 'rose';
          } else if (/agendou|retorno agendado/i.test(txt)) {
            what = 'agendou retorno para'; tone = 'violet';
          } else {
            what = 'atualizou fase de'; tone = 'amber';
          }
        } else if (i.type === 'note') {
          if (isRegistrationNote(txt)) {
            what = 'cadastrou'; tone = 'brand';
          } else {
            what = 'anotou em'; tone = 'slate';
          }
        }
        return {
          id: i.id,
          who,
          what,
          who2: lead?.name || 'lead',
          when: humanizeAge(i.createdAt, new Date()),
          tone
        };
      });
  }, [interactions, funnelLeads, periodRange, appUser]);

  // Human-friendly period label for the hero.
  const periodLabel = useMemo(() => {
    if (!periodRange) return '—';
    const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    const sameDay = periodRange.start.toDateString() === periodRange.end.toDateString();
    if (sameDay) return periodRange.start.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    return `${fmt(periodRange.start)} – ${fmt(periodRange.end)}`;
  }, [periodRange]);

  const firstName = (appUser?.name || '').split(' ')[0] || 'consultor';
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  // Listas da COORTE de captação (mesma base das taxas e do funil).
  // O funil exibe a jornada dos leads que CAPTAMOS no período — então
  // cada etapa filtra capturedLeads, garantindo monotonicidade
  // (etapa N ≤ etapa N-1) e taxas entre etapas ≤ 100%.
  const coorteAgendamentoLeads = useMemo(
    () => capturedLeads.filter(l => {
      const t = getLeadAppointmentType(l);
      return (t === 'visita' || t === 'aula_experimental') && getLeadAppointmentDate(l);
    }),
    [capturedLeads]
  );
  const coorteCompareceramLeads = useMemo(
    () => coorteAgendamentoLeads.filter(l => isLeadAttended(l)),
    [coorteAgendamentoLeads]
  );
  const coorteMatriculaLeads = useMemo(
    () => capturedLeads.filter(isLeadConverted),
    [capturedLeads]
  );

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* ---- Hero ---- */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <LayoutDashboard size={13} className="text-brand-600" /> Dashboard
          </div>
          <h2 className="mt-1.5 font-display text-[26px] font-semibold tracking-tight leading-tight">
            {greeting}, {firstName}. <span className="text-slate-500 dark:text-slate-400 font-medium">Aqui está o panorama do período.</span>
          </h2>
          <p className="mt-1 text-[13.5px] text-slate-500 dark:text-slate-400">
            Período: <span className="font-medium text-slate-700 dark:text-slate-200">{periodLabel}</span> · <span className="num">{stats.total}</span> {stats.total === 1 ? 'lead' : 'leads'} · taxa de conversão global <span className="font-medium text-emerald-600 dark:text-emerald-400 num">{stats.txConv}%</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {hasFunnels && (
            <FunnelSelector
              funnels={funnels}
              value={selectedFunnelId}
              onChange={setSelectedFunnelId}
              allowAll={true}
              className="w-full sm:w-[220px]"
            />
          )}
          <DashPeriodTabs value={periodPreset} onChange={setPeriodPreset} />
        </div>
      </section>

      {periodPreset === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] shadow-card">
          <span className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Período personalizado</span>
          <input
            type="date"
            value={customStartDate}
            onChange={(e) => setCustomStartDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[13px] num focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
          <span className="text-slate-400 text-[12.5px] font-medium">até</span>
          <input
            type="date"
            value={customEndDate}
            onChange={(e) => setCustomEndDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[13px] num focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
          {!periodRange && (
            <span className="text-[11.5px] font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap">
              Preencha início e fim para ver os resultados.
            </span>
          )}
        </div>
      )}

      {/* ---- Primary KPIs ---- */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <DashKpiCard
          label="Leads captados"
          value={stats.total}
          delta={deltas.leads}
          accent="brand"
          series={sparklines.leads}
          help="Leads novos que chegaram no período, contados pelo dia em que foram cadastrados. O gráfico mostra a evolução dia a dia."
        />
        <DashKpiCard
          label="Visitas agendadas"
          value={stats.agendadosVisita}
          delta={deltas.visitas}
          accent="amber"
          series={sparklines.visitas}
          sub={`${stats.txAgVisita}% dos leads · ${stats.txConvVisita}% conv.`}
          help="Visitas marcadas para o período — inclui leads que chegaram antes. Abaixo: de cada 100 leads que chegaram no período, quantos marcaram visita e, desses, quantos viraram matrícula."
        />
        <DashKpiCard
          label="Aulas experimentais"
          value={stats.agendadosAula}
          delta={deltas.aulas}
          accent="violet"
          series={sparklines.aulas}
          sub={`${stats.txAgAula}% dos leads · ${stats.txConvAula}% conv.`}
          help="Aulas experimentais marcadas para o período — inclui leads que chegaram antes. Abaixo: de cada 100 leads que chegaram no período, quantos marcaram aula e, desses, quantos viraram matrícula."
        />
        <DashKpiCard
          label="Matrículas"
          value={stats.convertidos}
          delta={deltas.matriculas}
          accent="emerald"
          series={sparklines.matriculas}
          sub={`${stats.txConv}% fechamento geral`}
          help="Leads que fecharam matrícula no período — inclui quem chegou em meses anteriores e fechou agora. Abaixo: dos leads que chegaram neste período, quantos por cento já se matricularam."
        />
      </div>

      {/* ---- Secondary KPIs ---- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DashCard padded>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                <span>Taxa de comparecimento</span>
                <DashHelpTip
                  label="O que é Taxa de comparecimento?"
                  text="Das visitas e aulas cuja data já passou, em quantas o lead realmente apareceu. Os agendamentos que ainda vão acontecer aparecem como 'futuros' e não entram na conta — assim a taxa não fica baixa à toa no começo do período."
                />
              </div>
              <div className="num text-[32px] font-semibold tracking-tight leading-none mt-1.5">{taxaComp}%</div>
              <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                <span className="num font-medium text-slate-700 dark:text-slate-200">{compareceram}</span> {compareceram === 1 ? 'compareceu' : 'compareceram'} / <span className="num">{apptPassados}</span> {apptPassados === 1 ? 'já realizado' : 'já realizados'}
                {totalAppt > apptPassados && (
                  <> · <span className="num text-slate-400">+{totalAppt - apptPassados} {(totalAppt - apptPassados) === 1 ? 'futuro' : 'futuros'}</span></>
                )}
              </div>
            </div>
            <DashRingStat value={taxaComp} accent="teal" />
          </div>
        </DashCard>

        <DashCard padded>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                <span>Conversão global</span>
                <DashHelpTip
                  label="O que é Conversão global?"
                  text="Dos leads que chegaram no período, quantos por cento já viraram matrícula. Esse número costuma começar baixo e ir subindo conforme você trabalha cada lead."
                />
              </div>
              <div className="num text-[32px] font-semibold tracking-tight leading-none mt-1.5">{stats.txConv}%</div>
              <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                lead → matrícula · <span className="num">{stats.coorteConvertidos}</span> de <span className="num">{stats.total}</span> {stats.total === 1 ? 'captado' : 'captados'}
              </div>
            </div>
            <DashRingStat value={stats.txConv} accent="emerald" />
          </div>
        </DashCard>
      </div>

      {/* ---- Main grid ---- */}
      <div className="grid grid-cols-12 gap-4">

        {/* LEFT — funnel + tables */}
        <div className="col-span-12 xl:col-span-8 space-y-4">

          <DashCard
            title={isAllFunnels(selectedFunnelId)
              ? 'Funil comercial · todos os funis'
              : currentFunnel?.name ? `Funil · ${currentFunnel.name}` : 'Funil comercial'}
            hint="Jornada dos leads captados no período · clique para ver os leads"
            icon={<Filter size={14} />}
          >
            <DashFunnel
              steps={[
                { id: 'leads',  label: 'Leads recebidos', count: stats.total, color: 'brand' },
                { id: 'agend',  label: 'Agendamentos',    count: stats.coorteVisita + stats.coorteAula, color: 'amber',  hint: `${stats.coorteVisita} ${stats.coorteVisita === 1 ? 'visita' : 'visitas'} · ${stats.coorteAula} ${stats.coorteAula === 1 ? 'aula exp.' : 'aulas exp.'}` },
                { id: 'comp',   label: 'Compareceram',    count: coorteCompareceramLeads.length, color: 'teal' },
                { id: 'matric', label: 'Matrículas',      count: stats.coorteConvertidos, color: 'emerald' }
              ]}
              onStepClick={(s) => {
                if (s.id === 'leads')  setFunnelDetail({ title: 'Leads Recebidos', data: capturedLeads });
                if (s.id === 'agend')  setFunnelDetail({ title: 'Agendamentos',    data: coorteAgendamentoLeads });
                if (s.id === 'comp')   setFunnelDetail({ title: 'Compareceram',    data: coorteCompareceramLeads });
                if (s.id === 'matric') setFunnelDetail({ title: 'Matrículas',      data: coorteMatriculaLeads });
              }}
            />
          </DashCard>

          {aulasPorModalidade.length > 0 && (
            <DashCard
              title="Aulas experimentais por modalidade"
              hint="Distribuição das aulas agendadas no período"
              icon={<Dumbbell size={14} />}
            >
              <div className="space-y-2.5">
                {(() => {
                  const max = aulasPorModalidade.reduce((m, x) => Math.max(m, x.count), 0) || 1;
                  const total = aulasPorModalidade.reduce((s, x) => s + x.count, 0) || 1;
                  return aulasPorModalidade.map(({ name, count }) => (
                    <div key={name} className="flex items-center gap-3">
                      <span className="text-[12.5px] font-medium text-slate-700 dark:text-slate-200 w-32 shrink-0 truncate">{name}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-white/[0.05] overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full" style={{ width: `${max > 0 ? Math.round((count / max) * 100) : 0}%` }} />
                      </div>
                      <span className="num text-[12px] text-slate-500 dark:text-slate-400 w-9 text-right whitespace-nowrap">{total > 0 ? Math.round((count / total) * 100) : 0}%</span>
                      <span className="num text-[13px] font-semibold text-slate-800 dark:text-slate-100 w-7 text-right">{count}</span>
                    </div>
                  ));
                })()}
              </div>
            </DashCard>
          )}

          {isAllFunnels(selectedFunnelId) && funnels.length > 1 && (
            <DashCard
              title="Métricas por funil"
              hint="Comparativo no período selecionado"
              icon={<Kanban size={14} />}
              padded={false}
            >
              <div className="overflow-x-auto thin-scroll">
                <table className="w-full text-left min-w-[640px]">
                  <thead>
                    <tr className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      <th className="py-2.5 pl-5 pr-3 font-semibold">Funil</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Leads</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Visitas</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Aulas</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Matr.</th>
                      <th className="py-2.5 pr-5 pl-3 font-semibold text-right">Tx. Conv.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funnelComparisonRows.map((row) => {
                      const rateTone = row.rate >= 20 ? 'text-emerald-600 dark:text-emerald-400' : row.rate >= 10 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400';
                      return (
                        <tr key={row.funnel.id} className="border-t border-slate-100 dark:border-white/[0.05] hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition">
                          <td className="py-3 pl-5 pr-3">
                            <button
                              type="button"
                              onClick={() => setSelectedFunnelId(row.funnel.id)}
                              className="text-[13px] font-semibold text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition flex items-center gap-1.5 text-left whitespace-nowrap"
                              title={`Ver Dashboard apenas do funil ${row.funnel.name}`}
                            >
                              {row.funnel.name}
                              {row.funnel.isDefault && (
                                <span className="text-[9px] uppercase tracking-widest font-bold px-1.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">Padrão</span>
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-3 num text-[13px] text-center text-slate-700 dark:text-slate-200">{row.captured}</td>
                          <td className="py-3 px-3 num text-[13px] text-center text-slate-700 dark:text-slate-200">{row.visits}</td>
                          <td className="py-3 px-3 num text-[13px] text-center text-slate-700 dark:text-slate-200">{row.classes}</td>
                          <td className="py-3 px-3 num text-[13px] text-center font-semibold text-emerald-600 dark:text-emerald-400">{row.converted}</td>
                          <td className={`py-3 pr-5 pl-3 num text-[13px] text-right font-semibold ${rateTone}`}>{row.rate}%</td>
                        </tr>
                      );
                    })}
                    {funnelComparisonRows.length === 0 && (
                      <tr>
                        <td colSpan="6" className="py-6 text-center text-[12px] text-slate-400 italic">Sem dados no período</td>
                      </tr>
                    )}
                  </tbody>
                  {funnelComparisonTotals && funnelComparisonRows.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 dark:border-white/[0.06]">
                        <td className="py-3 pl-5 pr-3 text-[12px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">Total</td>
                        <td className="py-3 px-3 num text-[13px] text-center font-semibold text-slate-900 dark:text-white">{funnelComparisonTotals.captured}</td>
                        <td className="py-3 px-3 num text-[13px] text-center font-semibold text-slate-900 dark:text-white">{funnelComparisonTotals.visits}</td>
                        <td className="py-3 px-3 num text-[13px] text-center font-semibold text-slate-900 dark:text-white">{funnelComparisonTotals.classes}</td>
                        <td className="py-3 px-3 num text-[13px] text-center font-semibold text-emerald-600 dark:text-emerald-400">{funnelComparisonTotals.converted}</td>
                        <td className="py-3 pr-5 pl-3 num text-[13px] text-right font-semibold text-slate-900 dark:text-white">{funnelComparisonTotals.rate}%</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </DashCard>
          )}

          {isAdminUser(appUser) && (
            <DashCard
              title="Desempenho da equipe"
              hint="Consultores ranqueados por matrículas"
              icon={<BarChart3 size={14} />}
              padded={false}
            >
              {teamMetrics.length > 0 ? (
                <DashTeamTable rows={teamMetrics} appUser={appUser} />
              ) : (
                <div className="px-5 py-8 text-center text-[12px] text-slate-400 italic">Sem dados no período</div>
              )}
            </DashCard>
          )}

        </div>

        {/* RIGHT — widgets */}
        <div className="col-span-12 xl:col-span-4 space-y-4">

          <DashCard
            title="Canais de aquisição"
            hint={`${stats.total} ${stats.total === 1 ? 'lead' : 'leads'} · top ${Math.min(sourceMetrics.length, 6)}`}
            icon={<Zap size={14} />}
          >
            <DashSourceList items={sourceMetrics.slice(0, 6)} />
          </DashCard>

          <DashCard
            title="Próximos follow-ups"
            hint="Tarefas pendentes"
            icon={<Bell size={14} />}
            action={
              <span className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400 num whitespace-nowrap">{pendingFollowUps.length}</span>
            }
          >
            <div className="space-y-2 max-h-[360px] overflow-y-auto thin-scroll -mx-1 px-1">
              {pendingFollowUps.length === 0 ? (
                <div className="py-8 text-center text-[12.5px] text-slate-400 italic">Tudo em dia.</div>
              ) : (
                pendingFollowUps.map((lead) => (
                  <DashTaskItem key={lead.id} lead={lead} onClick={setSelectedLead} />
                ))
              )}
            </div>
          </DashCard>

          <DashCard
            title="Atividade recente"
            hint="Últimas ações no período"
            icon={<Clock size={14} />}
          >
            {activityFeed.length === 0 ? (
              <div className="py-6 text-center text-[12.5px] text-slate-400 italic">Sem atividade no período.</div>
            ) : (
              <div className="-my-1">
                {activityFeed.map((a) => <DashActivityRow key={a.id} item={a} />)}
              </div>
            )}
          </DashCard>
        </div>
      </div>

      <footer className="pt-2 pb-2 text-center text-[11.5px] text-slate-400 whitespace-nowrap">
        Atualizado agora · Período: {periodLabel}
      </footer>

      {funnelDetail && <FunnelDetailModal detail={funnelDetail} onClose={() => setFunnelDetail(null)} onLeadClick={(lead) => { setSelectedLead(lead); setFunnelDetail(null); }} />}

      {selectedLead && (
        <LeadDetailsModal
          lead={selectedLead}
          interactions={interactions.filter(i => i.leadId === selectedLead.id).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0))}
          onClose={() => setSelectedLead(null)}
          appUser={appUser}
          statuses={statuses}
          tags={tags}
          lossReasons={lossReasons}
          usersList={usersList}
          db={db}
          funnels={funnels}
        />
      )}

    </div>
  );
}


function StatCard({ title, value, subtitle, icon }) {
  return <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-6 rounded-[2.5rem] flex items-center justify-between shadow-2xl relative overflow-hidden group hover:border-gray-300 dark:border-neutral-700 transition-all"><div><p className="text-gray-400 dark:text-neutral-500 text-xs font-bold uppercase tracking-widest">{title}</p><p className="text-4xl font-bold text-gray-900 dark:text-white mt-1">{value}</p><p className="text-[10px] text-gray-600 dark:text-neutral-400 font-bold mt-2 uppercase tracking-tighter">{subtitle}</p></div><div className="bg-paper-50 dark:bg-neutral-800 p-5 rounded-2xl border border-gray-200 dark:border-neutral-700 group-hover:scale-110 transition-transform">{icon}</div></div>;
}

function FunnelBar({ label, count, max, color, onClick }) {
  const p = max > 0 ? (count / max) * 100 : 0;
  return <div onClick={onClick} className={onClick ? "cursor-pointer hover:opacity-80 transition-opacity active:scale-95" : ""}><div className="flex justify-between text-xs font-bold uppercase tracking-widest mb-3"><span className="text-gray-500 dark:text-neutral-400">{label}</span><span className="text-gray-900 dark:text-white">{count} ({Math.round(p)}%)</span></div><div className="w-full bg-paper-50 dark:bg-neutral-950 rounded-full h-4 overflow-hidden border border-gray-200 dark:border-neutral-800 shadow-inner"><div className={`h-full rounded-full ${color} transition-all duration-1000 shadow-lg`} style={{ width: `${p}%` }} /></div></div>;
}

function FunnelDetailModal({ detail, onClose, onLeadClick }) {
  if (!detail) return null;
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[150] p-4 animate-fade-in">
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 w-full max-w-lg max-h-[80vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl relative">
        <div className="p-6 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center bg-paper-50 dark:bg-neutral-950">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-widest">
            {detail.title} <span className="text-brand-500">({detail.data.length})</span>
          </h3>
          <button onClick={onClose} className="p-2 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white rounded-full bg-white dark:bg-neutral-800 shadow-sm transition-all active:scale-95"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-3">
          {detail.data.length === 0 ? (
            <p className="text-sm font-medium text-gray-500 dark:text-neutral-400 text-center py-6">Nenhum registro encontrado neste período.</p>
          ) : (
            detail.data.map(lead => (
              <div 
                key={lead.id} 
                onClick={() => onLeadClick && onLeadClick(lead)}
                className="bg-paper-50 dark:bg-neutral-950 p-4 rounded-xl border border-gray-200 dark:border-neutral-800 flex flex-col gap-1 shadow-sm cursor-pointer hover:bg-white dark:hover:bg-neutral-900 transition-colors active:scale-95 group"
              >
                <div className="flex justify-between items-start">
                  <span className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-brand-600 transition-colors">{lead.name}</span>
                  <span className="text-[10px] font-bold px-2 py-1 bg-white dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 rounded-md uppercase border border-gray-200 dark:border-neutral-700">{lead.status}</span>
                </div>
                <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 mt-1">{lead.whatsapp}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// KANBAN VIEW (COM VENDA E PERDA FIXAS)
// ==========================================
function KanbanView({ leads, interactions, appUser, statuses, usersList, tags, lossReasons, db, funnels, selectedFunnelId, setSelectedFunnelId }) {
  const toast = useToast();
  const [selectedLead, setSelectedLead] = useState(null);
  const [moveLead, setMoveLead] = useState(null); // lead com o menu "Mover" aberto (toque/teclado)
  const [consultantFilter, setConsultantFilter] = useState('');
  const [lossModalLeadId, setLossModalLeadId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [draggingLeadId, setDraggingLeadId] = useState(null);
  const [draggedOverColumn, setDraggedOverColumn] = useState(null);
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const kanbanScrollRef = useRef(null);
const dragScrollRef = useRef({
  isDown: false,
  startX: 0,
  scrollLeft: 0
});
const [isPanning, setIsPanning] = useState(false);

  const defaultFunnelId = useMemo(() => getDefaultFunnel(funnels)?.id || null, [funnels]);
  const currentFunnel = useMemo(
    () => (funnels || []).find(f => f.id === selectedFunnelId) || null,
    [funnels, selectedFunnelId]
  );

  const funnelLeads = useMemo(
    () => (leads || []).filter(l => isItemInFunnel(l, selectedFunnelId, defaultFunnelId)),
    [leads, selectedFunnelId, defaultFunnelId]
  );

  // Escopo dos KPIs: aplica apenas o recorte "de quem" (filtro de
  // consultor), NÃO os filtros de visualização do board (busca, "Em
  // atraso"). Sem isso, ligar "Em atraso" — que exclui Venda/Perda —
  // zerava os KPIs de Vendas/Perdas/Taxa, e buscar um nome distorcia
  // os totais. Os KPIs refletem o pipeline (do consultor) inteiro.
  const kpiScopeLeads = useMemo(() => {
    if (!consultantFilter) return funnelLeads;
    return funnelLeads.filter(l => l.consultantId === consultantFilter);
  }, [funnelLeads, consultantFilter]);

  const kanbanLeads = useMemo(() => {
    let filtered = kpiScopeLeads;
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      const searchDigits = searchTerm.replace(/\D/g, '');
      filtered = filtered.filter(l =>
        (l.name && l.name.toLowerCase().includes(lowerSearch)) ||
        (l.whatsapp && (l.whatsapp.includes(searchTerm) ||
          (searchDigits && String(l.whatsapp).replace(/\D/g, '').includes(searchDigits)))) ||
        (l.observation && l.observation.toLowerCase().includes(lowerSearch))
      );
    }
    if (onlyOverdue) {
      const now = new Date();
      filtered = filtered.filter(l =>
        l.status !== 'Venda' && l.status !== 'Perda' &&
        l.nextFollowUp instanceof Date && !isNaN(l.nextFollowUp.getTime()) &&
        l.nextFollowUp < now
      );
    }
    return filtered;
  }, [kpiScopeLeads, searchTerm, onlyOverdue]);

  const kanbanKpis = useMemo(() => {
    const now = new Date();
    const active = kpiScopeLeads.filter(l => l.status !== 'Venda' && l.status !== 'Perda');
    const won = kpiScopeLeads.filter(l => l.status === 'Venda');
    const lost = kpiScopeLeads.filter(l => l.status === 'Perda');
    const overdue = active.filter(l =>
      l.nextFollowUp instanceof Date && !isNaN(l.nextFollowUp.getTime()) && l.nextFollowUp < now
    );
    const winRate = (won.length + lost.length) > 0
      ? Math.round((won.length / (won.length + lost.length)) * 100)
      : 0;
    return {
      active: active.length,
      won: won.length,
      lost: lost.length,
      overdue: overdue.length,
      winRate
    };
  }, [kpiScopeLeads]);

  // Índice leadId → { count, lastDate }. Percorre interactions UMA vez,
  // evitando que cada card refaça interactions.filter()/getLastInteraction
  // (era O(cards × interações) a cada render/drag).
  const interactionIndex = useMemo(() => buildInteractionIndex(interactions), [interactions]);

  const stopKanbanPan = () => {
  dragScrollRef.current.isDown = false;
  setIsPanning(false);
};

const handleKanbanMouseDown = (e) => {
  if (e.button !== 0) return;

  // Não iniciar pan se clicou em card draggable
  if (e.target.closest('[data-no-pan="true"]')) return;

  const container = kanbanScrollRef.current;
  if (!container) return;

  dragScrollRef.current = {
    isDown: true,
    startX: e.pageX,
    scrollLeft: container.scrollLeft
  };

  setIsPanning(true);
};

const handleKanbanMouseMove = (e) => {
  const container = kanbanScrollRef.current;
  const state = dragScrollRef.current;

  if (!container || !state.isDown) return;

  e.preventDefault();

  const walk = e.pageX - state.startX;
  container.scrollLeft = state.scrollLeft - walk;
};

  // ── Lógica core de movimentação, compartilhada entre o drag (desktop)
  //    e o menu "Mover" (toque/teclado). ──────────────────────────────

  // Move para uma etapa normal (não Venda/Perda). Mover só muda a FASE:
  // não inventa agendamento (ver P4). Ao sair de Venda/Perda, limpa os
  // campos de resolução da origem para o lead não seguir contando como
  // matrícula/perda nas métricas.
  const applyMoveToStage = async (lead, newStatus) => {
    try {
      const payload = { status: newStatus };
      if (selectedFunnelId && !lead.funnelId) payload.funnelId = selectedFunnelId;
      if (lead.status === 'Venda') { payload.isConverted = false; payload.convertedAt = null; }
      if (lead.status === 'Perda') { payload.lossReason = null; payload.lostAt = null; }

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), payload);
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: `Movido para a etapa [${newStatus}] via Kanban.`,
        type: 'status_change',
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Erro Kanban:", err);
      toast.error('Não foi possível mover o lead. Tente novamente.');
    }
  };

  const applyWin = async (lead) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), {
        status: 'Venda',
        nextFollowUp: null,
        isConverted: true,
        convertedAt: serverTimestamp(),
        lossReason: null,
        lostAt: null
      });
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: `Matrícula realizada com sucesso! (Venda)`,
        type: 'status_change',
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Erro Venda:", err);
      toast.error('Não foi possível registrar a matrícula. Tente novamente.');
    }
  };

  // Despacha um destino (etapa / Venda / Perda) com checagem de permissão.
  // Usada pelo menu "Mover" — funciona em toque, mouse e teclado, sem
  // depender do drag-and-drop nativo (que não dispara em telas de toque).
  const moveLeadToStatus = (lead, statusName) => {
    if (!lead || lead.status === statusName) return;
    if (!canEditLead(appUser, lead)) {
      toast.warning('Você não tem permissão para mover este lead.');
      return;
    }
    if (statusName === 'Venda') return applyWin(lead);
    if (statusName === 'Perda') { setLossModalLeadId(lead.id); return; }
    return applyMoveToStage(lead, statusName);
  };

  // ── Handlers de drag (desktop): extraem o leadId e delegam ao core ──
  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    const lead = leadId && leads.find(l => l.id === leadId);
    if (!lead || lead.status === newStatus) return;
    if (!canEditLead(appUser, lead)) {
      toast.warning('Você não tem permissão para mover este lead.');
      return;
    }
    applyMoveToStage(lead, newStatus);
  };

  const handleWinDrop = (e) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    const lead = leadId && leads.find(l => l.id === leadId);
    if (!lead || lead.status === 'Venda') return;
    if (!canEditLead(appUser, lead)) {
      toast.warning('Você não tem permissão para alterar este lead.');
      return;
    }
    applyWin(lead);
  };

  const handleLossDrop = (e) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    const lead = leadId && leads.find(l => l.id === leadId);
    if (!lead || lead.status === 'Perda') return;
    if (!canEditLead(appUser, lead)) {
      toast.warning('Você não tem permissão para alterar este lead.');
      return;
    }
    setLossModalLeadId(lead.id);
  };

  const confirmKanbanLoss = async (reason) => {
    if (!lossModalLeadId) return;
const lead = leads.find(l => l.id === lossModalLeadId);
if (!lead) return;
    try {
      await updateDoc(
        doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lossModalLeadId),
        {
          status: 'Perda',
          lossReason: reason,
          nextFollowUp: null,
          lostAt: serverTimestamp(),
          // Limpa resquício caso o lead viesse da coluna Venda.
          isConverted: false,
          convertedAt: null
        }
      );

      await addDoc(
        collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH),
        {
          leadId: lossModalLeadId,
          consultantName: appUser.name,
          ...getInteractionSecurityFields(lead, appUser),
          text: `Lead perdido. Motivo: ${reason}`,
          type: 'status_change',
          createdAt: serverTimestamp()
        }
      );

      setLossModalLeadId(null);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível registrar a perda. Tente novamente.');
    }
  };

  const handleDragStart = (e, leadId) => {
    e.dataTransfer.setData('leadId', leadId);
    e.dataTransfer.effectAllowed = 'move';
    // Timeout to prevent the browser from capturing the modified styles in the drag ghost
    setTimeout(() => setDraggingLeadId(leadId), 0);
  };

  const handleDragEnd = () => {
    setDraggingLeadId(null);
    setDraggedOverColumn(null);
  };

  const getLeadsByStatus = (statusName) => {
    const now = new Date();
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

    return (kanbanLeads || [])
      .filter(l => l.status === statusName)
      .sort((a, b) => {
        const pA = getPriority(a);
        const pB = getPriority(b);
        if (pA !== pB) return pA - pB;
        if (pA !== 4 && a.nextFollowUp && b.nextFollowUp) {
          return a.nextFollowUp.getTime() - b.nextFollowUp.getTime();
        }
        return (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0);
      });
  };

  const renderLeadCard = (lead, columnColor = 'gray') => {
    const isWon = lead.status === 'Venda';
    const isLost = lead.status === 'Perda';
    const isOverdue =
      !isWon && !isLost &&
      lead.nextFollowUp instanceof Date &&
      !isNaN(lead.nextFollowUp.getTime()) &&
      lead.nextFollowUp < new Date();
    const isDraggingThis = draggingLeadId === lead.id;
    const accent = getKanbanColumnAccent(columnColor);
    const idxEntry = interactionIndex.get(lead.id);
    const interactionCount = idxEntry?.count || 0;
    const convertedAt = getSafeDateOrNull(lead.convertedAt);
    let daysSince = null;
    if (!isWon && !isLost) {
      const last = idxEntry?.lastDate || lead.createdAt;
      if (last instanceof Date && !isNaN(last.getTime())) {
        daysSince = Math.max(0, Math.floor((Date.now() - last.getTime()) / 86400000));
      }
    }

    return (
      <article
        key={lead.id}
        data-no-pan="true"
        draggable
        onDragStart={(e) => handleDragStart(e, lead.id)}
        onDragEnd={handleDragEnd}
        onClick={() => setSelectedLead(lead)}
        style={{ borderTopColor: accent.border, borderTopWidth: 2 }}
        className={`group relative rounded-xl border bg-white dark:bg-neutral-900 cursor-grab active:cursor-grabbing shadow-sm transition-all ${
          isDraggingThis
            ? 'opacity-80 z-50 shadow-xl border-brand-500'
            : isOverdue
              ? 'border-rose-200 dark:border-rose-500/20 hover:border-rose-300 dark:hover:border-rose-500/40 hover:shadow-md'
              : 'border-gray-200 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700 hover:shadow-md'
        }`}
      >
        <div className="absolute top-2 right-2 z-10">
          <LeadTemperatureBadge lead={lead} lastInteractionDate={idxEntry?.lastDate} compact />
        </div>

        <div className="p-3 pb-2.5">
          <div className="flex items-start gap-2.5">
            <KanbanAvatar name={lead.name || ''} size={32} />
            <div className="min-w-0 flex-1 pr-14">
              <div
                className={`font-semibold text-[13.5px] leading-tight truncate ${
                  isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'
                }`}
                title={lead.name}
              >
                {lead.name}
              </div>
              <div
                className="text-[11.5px] text-gray-500 dark:text-neutral-400 truncate"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {lead.whatsapp}
              </div>
            </div>
          </div>

          {(lead.tags || []).length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {lead.tags.slice(0, 2).map(tagName => (
                <TagBadge key={tagName} tagName={tagName} tagsArray={tags} />
              ))}
              {lead.tags.length > 2 && (
                <span
                  className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400"
                  title={lead.tags.slice(2).join(', ')}
                >
                  +{lead.tags.length - 2}
                </span>
              )}
            </div>
          )}

          {(lead.source || interactionCount > 0) && (
            <div className="mt-2.5 flex items-center gap-2 text-[11px] text-gray-500 dark:text-neutral-400 min-w-0">
              {lead.source && (
                <span className="inline-flex items-center gap-1 truncate" title={lead.source}>
                  {lead.source}
                </span>
              )}
              {lead.source && interactionCount > 0 && (
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-neutral-700 shrink-0" />
              )}
              {interactionCount > 0 && (
                <span
                  className="inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  <MessageCircle className="w-3 h-3" /> {interactionCount}
                </span>
              )}
            </div>
          )}
        </div>

        <footer className="px-3 py-2 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between gap-2">
          {isWon ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap min-w-0 truncate">
              <CheckCircle className="w-3 h-3 shrink-0" />
              Matriculado{convertedAt ? ` ${fmtKanbanRelDate(convertedAt)}` : ''}
            </span>
          ) : isLost ? (
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-neutral-400 min-w-0 truncate"
              title={lead.lossReason || 'Perdido'}
            >
              <Ban className="w-3 h-3 shrink-0" />
              <span className="truncate">{lead.lossReason || 'Perdido'}</span>
            </span>
          ) : lead.nextFollowUp instanceof Date && !isNaN(lead.nextFollowUp.getTime()) ? (
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap ${
                isOverdue ? 'text-rose-600 dark:text-rose-300' : 'text-gray-600 dark:text-neutral-300'
              }`}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              <FollowUpIcon type={lead.nextFollowUpType} className="w-3 h-3" />
              {fmtKanbanRelDateTime(lead.nextFollowUp)}
            </span>
          ) : daysSince !== null && daysSince >= 1 ? (
            <DaysSinceContactBadge lead={lead} lastInteractionDate={idxEntry?.lastDate} />
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300 whitespace-nowrap">
              <AlertCircle className="w-3 h-3" /> Sem agendamento
            </span>
          )}
          <div className="flex items-center gap-1.5 shrink-0">
            {lead.consultantName && isAdminUser(appUser) && (
              <span title={lead.consultantName} className="shrink-0">
                <KanbanAvatar name={lead.consultantName} size={20} />
              </span>
            )}
            <button
              type="button"
              data-no-pan="true"
              onClick={(e) => { e.stopPropagation(); setMoveLead(lead); }}
              title="Mover para outra etapa"
              aria-label="Mover lead para outra etapa"
              className="w-6 h-6 rounded-md grid place-items-center text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:text-neutral-500 dark:hover:text-brand-300 dark:hover:bg-brand-500/10 transition shrink-0"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </footer>
      </article>
    );
  };

  const renderKanbanColumn = ({ key, name, color, special, columnLeads, onDropHandler, renderLimit = 0 }) => {
    const accent = getKanbanColumnAccent(color);
    const isHovered = draggedOverColumn === name;
    const isWinCol = special === 'win';
    const isLossCol = special === 'loss';
    // Colunas terminais (Venda/Perda) acumulam histórico; renderizar
    // todos os cards trava o board. Mostra os mais recentes e indica
    // quantos restam (acessíveis pela busca ou pelo Dashboard).
    const shownLeads = renderLimit > 0 && columnLeads.length > renderLimit
      ? columnLeads.slice(0, renderLimit)
      : columnLeads;
    const hiddenCount = columnLeads.length - shownLeads.length;
    const emptyText = isWinCol
      ? 'Arraste para fechar venda'
      : isLossCol
        ? 'Arraste para marcar perda'
        : isHovered
          ? 'Soltar aqui'
          : 'Sem leads';

    return (
      <section
        key={key}
        onDragOver={(e) => {
          e.preventDefault();
          if (draggedOverColumn !== name) setDraggedOverColumn(name);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget)) return;
          if (draggedOverColumn === name) setDraggedOverColumn(null);
        }}
        onDrop={(e) => {
          setDraggedOverColumn(null);
          setDraggingLeadId(null);
          onDropHandler(e);
        }}
        className={`w-[300px] shrink-0 rounded-2xl flex flex-col transition-colors border ${
          isHovered
            ? 'bg-brand-50/60 dark:bg-brand-500/[0.06] ring-2 ring-brand-100 dark:ring-brand-500/30 border-brand-100 dark:border-brand-500/30'
            : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800'
        }`}
      >
        <header className="px-3 pt-3 pb-2 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2">
          {isWinCol ? (
            <span className="w-5 h-5 rounded-md grid place-items-center bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 shrink-0">
              <TrendingUp className="w-3 h-3" />
            </span>
          ) : isLossCol ? (
            <span className="w-5 h-5 rounded-md grid place-items-center bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400 shrink-0">
              <Ban className="w-3 h-3" />
            </span>
          ) : (
            <span className={`w-2 h-2 rounded-full shrink-0 ${accent.dot}`} />
          )}
          <h3 className="text-[13px] font-semibold whitespace-nowrap text-gray-900 dark:text-white truncate" title={name}>
            {name}
          </h3>
          <span
            className="text-[11px] font-semibold px-1.5 h-[18px] rounded-md grid place-items-center min-w-[20px] bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-300 shrink-0"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {columnLeads.length}
          </span>
        </header>

        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2 custom-scrollbar">
          {columnLeads.length === 0 ? (
            <div
              className={`min-h-[120px] rounded-xl border-2 border-dashed grid place-items-center text-[11px] font-semibold uppercase tracking-wider transition text-center px-3 ${
                isHovered
                  ? 'border-brand-300 text-brand-600 dark:border-brand-500/40 dark:text-brand-300'
                  : isWinCol
                    ? 'border-emerald-200 text-emerald-600/70 dark:border-emerald-500/20 dark:text-emerald-300/60'
                    : isLossCol
                      ? 'border-rose-200 text-rose-600/70 dark:border-rose-500/20 dark:text-rose-300/60'
                      : 'border-gray-200 text-gray-400 dark:border-neutral-800 dark:text-neutral-500'
              }`}
            >
              {emptyText}
            </div>
          ) : (
            <>
              {shownLeads.map(lead => renderLeadCard(lead, color))}
              {hiddenCount > 0 && (
                <div className="py-2 text-center text-[11px] font-medium text-gray-400 dark:text-neutral-500">
                  + {hiddenCount} {hiddenCount === 1 ? 'lead mais antigo' : 'leads mais antigos'} · use a busca para encontrar
                </div>
              )}
            </>
          )}
        </div>
      </section>
    );
  };

  const pipelineColumns = (statuses || []).filter(s => isItemInFunnel(s, selectedFunnelId, defaultFunnelId));
  const kanbanTitle = currentFunnel?.name || 'Quadro Kanban';
  const hasFunnels = (funnels || []).length > 0;
  const totalFunnelLeads = funnelLeads.length;
  const isAdmin = isAdminUser(appUser);
  const isMineActive = !!(consultantFilter && appUser?.id && consultantFilter === appUser.id);

  const kpiCards = [
    { key: 'active',  icon: Users,       label: 'Leads ativos',         value: kanbanKpis.active,        sub: 'no pipeline',              tone: 'slate' },
    { key: 'won',     icon: TrendingUp,  label: 'Vendas',               value: kanbanKpis.won,           sub: 'matrículas',               tone: 'emerald' },
    { key: 'lost',    icon: Ban,         label: 'Perdas',               value: kanbanKpis.lost,          sub: 'motivos em relatórios',    tone: 'slate' },
    { key: 'overdue', icon: AlertCircle, label: 'Em atraso',            value: kanbanKpis.overdue,       sub: 'follow-ups vencidos',      tone: kanbanKpis.overdue > 0 ? 'rose' : 'slate' },
    { key: 'rate',    icon: Activity,    label: 'Taxa de fechamento',   value: `${kanbanKpis.winRate}%`, sub: 'vendas / (vendas + perdas)', tone: 'blue' }
  ];

  const kpiToneStyles = {
    slate:   'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    blue:    'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    rose:    'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
  };

  return (
    <>
      <div className="h-[calc(100vh-10rem)] flex flex-col animate-fade-in">
        {/* Title + funnel selector */}
        <div className="flex items-center gap-4 flex-wrap mb-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
              {kanbanTitle}
            </h3>
            <p className="text-xs font-medium text-gray-500 dark:text-neutral-400 mt-1">
              Arraste os leads entre as etapas. Use as colunas{' '}
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">Venda</span> e{' '}
              <span className="font-semibold text-gray-700 dark:text-neutral-200">Perda</span> para concluir.
            </p>
          </div>
          {hasFunnels && (
            <FunnelSelector
              funnels={funnels}
              value={selectedFunnelId}
              onChange={setSelectedFunnelId}
              className="w-full md:w-[280px]"
            />
          )}
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-5 gap-3 mb-4">
          {kpiCards.map((card) => {
            const KpiIcon = card.icon;
            return (
              <div
                key={card.key}
                className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3.5 flex items-center gap-3"
              >
                <span className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${kpiToneStyles[card.tone]}`}>
                  <KpiIcon className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-gray-500 dark:text-neutral-400 whitespace-nowrap truncate">
                    {card.label}
                  </div>
                  <div
                    className="text-[18px] font-semibold tracking-tight leading-none mt-0.5 text-gray-900 dark:text-white"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {card.value}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-neutral-400 mt-0.5 truncate">
                    {card.sub}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar lead, telefone ou observação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 focus:border-brand-500 dark:focus:border-brand-500 outline-none text-sm pl-9 pr-3 placeholder:text-gray-400 dark:placeholder:text-neutral-500 text-gray-900 dark:text-white shadow-sm transition-all"
            />
          </div>

          {isAdmin && (
            <select
              value={consultantFilter}
              onChange={(e) => setConsultantFilter(e.target.value)}
              className="h-10 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 outline-none text-sm pl-3 pr-8 text-gray-900 dark:text-white shadow-sm cursor-pointer font-medium"
            >
              <option value="">Todos os consultores</option>
              {(usersList || []).map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          )}

          {isAdmin && appUser?.id && (
            <div className="inline-flex p-1 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow-sm">
              <button
                type="button"
                onClick={() => setConsultantFilter('')}
                className={`h-7 px-3 rounded-md text-[12px] font-semibold whitespace-nowrap transition ${
                  !isMineActive
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'text-gray-500 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                Toda equipe
              </button>
              <button
                type="button"
                onClick={() => setConsultantFilter(appUser.id)}
                className={`h-7 px-3 rounded-md text-[12px] font-semibold whitespace-nowrap transition ${
                  isMineActive
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'text-gray-500 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                Apenas meus
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setOnlyOverdue(o => !o)}
            className={`h-10 px-3 rounded-lg text-[12.5px] font-semibold whitespace-nowrap transition inline-flex items-center gap-1.5 shadow-sm ${
              onlyOverdue
                ? 'bg-rose-600 text-white border border-rose-600'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 dark:bg-neutral-900 dark:text-neutral-200 dark:border-neutral-800 dark:hover:bg-neutral-800'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" /> Em atraso
          </button>

          <div className="flex-1" />

          <div
            className="text-[11.5px] text-gray-500 dark:text-neutral-400 whitespace-nowrap"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            <span className="font-semibold text-gray-700 dark:text-neutral-200">{kanbanLeads.length}</span>{' '}
            de {totalFunnelLeads} leads
          </div>
        </div>

        {/* Board */}
        <div
          ref={kanbanScrollRef}
          onMouseDown={handleKanbanMouseDown}
          onMouseMove={handleKanbanMouseMove}
          onMouseUp={stopKanbanPan}
          onMouseLeave={stopKanbanPan}
          className={`flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar select-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <div className="flex gap-3 min-w-max h-full pb-2">
            {pipelineColumns.map((column) =>
              renderKanbanColumn({
                key: column.id,
                name: column.name,
                color: column.color,
                special: null,
                columnLeads: getLeadsByStatus(column.name),
                onDropHandler: (e) => handleDrop(e, column.name)
              })
            )}

            {renderKanbanColumn({
              key: '__venda',
              name: 'Venda',
              color: 'green',
              special: 'win',
              columnLeads: getLeadsByStatus('Venda'),
              onDropHandler: handleWinDrop,
              renderLimit: 50
            })}

            {renderKanbanColumn({
              key: '__perda',
              name: 'Perda',
              color: 'gray',
              special: 'loss',
              columnLeads: getLeadsByStatus('Perda'),
              onDropHandler: handleLossDrop,
              renderLimit: 50
            })}
          </div>
        </div>
      </div>

      {selectedLead && (
        <LeadDetailsModal
          lead={selectedLead}
          interactions={(interactions || [])
            .filter(i => i.leadId === selectedLead.id)
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))}
          onClose={() => setSelectedLead(null)}
          appUser={appUser}
          statuses={statuses}
          tags={tags}
          lossReasons={lossReasons}
          db={db}
          funnels={funnels}
        />
      )}

      {lossModalLeadId && (
        <LossReasonModal
          lossReasons={lossReasons}
          onClose={() => setLossModalLeadId(null)}
          onConfirm={confirmKanbanLoss}
        />
      )}

      {moveLead && (
        <MoveLeadModal
          lead={moveLead}
          columns={pipelineColumns}
          onMove={(statusName) => { moveLeadToStatus(moveLead, statusName); setMoveLead(null); }}
          onClose={() => setMoveLead(null)}
        />
      )}
    </>
  );
}

// Seletor de etapa para mover um lead sem arrastar (toque/teclado).
// Lista as etapas do funil + Venda + Perda, exceto a fase atual.
function MoveLeadModal({ lead, columns, onMove, onClose }) {
  const targets = [
    ...(columns || []).map(c => ({ name: c.name, color: c.color, kind: 'stage' })),
    { name: 'Venda', color: 'green', kind: 'win' },
    { name: 'Perda', color: 'gray', kind: 'loss' }
  ].filter(t => t.name !== lead.status);

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-[200] p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
          <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">Mover lead</h3>
          <p className="text-[12px] text-gray-500 dark:text-neutral-400 truncate mt-0.5">
            <span className="font-medium text-gray-700 dark:text-neutral-200">{lead.name}</span> · de <span className="font-medium">{lead.status}</span>
          </p>
        </div>
        <div className="p-2 overflow-y-auto custom-scrollbar">
          {targets.map((t) => {
            const accent = getKanbanColumnAccent(t.color);
            return (
              <button
                key={t.name}
                type="button"
                onClick={() => onMove(t.name)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
              >
                {t.kind === 'win' ? (
                  <span className="w-6 h-6 rounded-md grid place-items-center bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 shrink-0"><TrendingUp className="w-3.5 h-3.5" /></span>
                ) : t.kind === 'loss' ? (
                  <span className="w-6 h-6 rounded-md grid place-items-center bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400 shrink-0"><Ban className="w-3.5 h-3.5" /></span>
                ) : (
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${accent.dot}`} />
                )}
                <span className="text-[13.5px] font-medium text-gray-900 dark:text-white truncate">{t.name}</span>
                {t.kind === 'win' && <span className="ml-auto text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">matrícula</span>}
              </button>
            );
          })}
        </div>
        <div className="px-3 py-3 border-t border-gray-100 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-gray-600 dark:text-neutral-300 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// LEADS VIEW (LISTA E EXPORTAÇÃO CSV)
// ==========================================
// ==========================================
// LEADS VIEW — DESIGN PRIMITIVES
// ==========================================
function StatPill({ label, value, accent = 'slate' }) {
  const tones = {
    brand:   'bg-brand-50 text-brand-700 border-brand-200/60 dark:bg-brand-500/10 dark:text-brand-300 dark:border-brand-500/20',
    amber:   'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
    rose:    'bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20',
    slate:   'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/[0.04] dark:text-slate-200 dark:border-white/[0.08]'
  };
  return (
    <div className={`inline-flex items-center gap-2 px-3 h-9 rounded-lg border ${tones[accent] || tones.slate}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider opacity-70 whitespace-nowrap">{label}</span>
      <span className="num text-[14px] font-bold">{value}</span>
    </div>
  );
}

function ActiveFilterChip({ label, onRemove, accent = 'slate' }) {
  const tones = {
    brand:   'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
    amber:   'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    rose:    'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    slate:   'bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-slate-200'
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 h-7 rounded-md text-[11.5px] font-medium ${tones[accent] || tones.slate}`}>
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="opacity-60 hover:opacity-100 transition"
        title="Remover filtro"
      >
        <X size={11} />
      </button>
    </span>
  );
}

// ==========================================
// APPOINTMENT TRACKING VIEW (AULAS EXPERIMENTAIS / VISITAS)
// ==========================================
// Tela SOMENTE LEITURA: lista os leads agendados para um tipo de
// compromisso ('aula_experimental' ou 'visita'), mostrando data marcada,
// comparecimento e finalização. NADA é criado aqui — o cadastro e o
// acompanhamento continuam pela Linha do Tempo (LeadDetailsModal) e pela
// Meta Diária. Clicar numa linha apenas abre o perfil do lead p/ consulta.
// Os dados já chegam escopados por consultor (regra do Firestore): admin
// vê todos, consultor vê só os seus.

// Estado de comparecimento derivado do appointmentOutcome persistido no lead
// (ou de conversão legada). Helpers puros, fora do componente.
function getApptAttendanceState(lead) {
  const outcome = lead.appointmentOutcome;
  const meta = outcome ? getAppointmentOutcomeMeta(outcome) : null;
  if (meta) return { key: outcome, label: meta.label, icon: meta.icon, badgeClass: meta.badgeClass };
  // Sem desfecho explícito: se converteu, obviamente compareceu (legado).
  if (isLeadConverted(lead)) {
    const a = getAppointmentOutcomeMeta('attended');
    return { key: 'attended', label: a.label, icon: a.icon, badgeClass: a.badgeClass };
  }
  const d = getLeadAppointmentDate(lead);
  if (d && d.getTime() < Date.now()) {
    return { key: 'pending', label: 'Aguardando desfecho', icon: '⏳', badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' };
  }
  return { key: 'scheduled', label: 'Agendado', icon: '📅', badgeClass: 'bg-brand-500/10 text-brand-700 dark:text-brand-300' };
}

function getApptFinalState(lead) {
  if (lead.status === 'Venda' || isLeadConverted(lead)) return { label: 'Matriculado', Icon: TrendingUp, tone: 'emerald' };
  if (lead.status === 'Perda') return { label: 'Perdido', Icon: Ban, tone: 'rose', reason: lead.lossReason };
  return { label: 'Em andamento', Icon: Clock, tone: 'slate' };
}

function isApptSameDay(d, ref = new Date()) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return false;
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

function AppointmentTrackingView({ leads, interactions, appUser, statuses, tags, lossReasons, db, funnels, usersList, appointmentType }) {
  const [selectedLead, setSelectedLead] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [consultantFilter, setConsultantFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | today | waiting | attended | finished

  const isAdmin = isAdminUser(appUser);
  const isAula = appointmentType === 'aula_experimental';
  const typeLabelSingular = isAula ? 'aula experimental' : 'visita';
  const typeLabelPlural = isAula ? 'aulas experimentais' : 'visitas';
  const HeaderIcon = isAula ? BookOpen : Building2;

  // 1) Leads do tipo de compromisso (com data marcada).
  const typeLeads = useMemo(
    () => (leads || []).filter(l => getLeadAppointmentType(l) === appointmentType && getLeadAppointmentDate(l)),
    [leads, appointmentType]
  );

  // 2) Escopo por consultor (admin) — "de quem são os agendamentos".
  //    Aplica ANTES dos contadores, pra que StatPills e chips reflitam o
  //    consultor selecionado. Sem isso, o chip dizia "Hoje 12" e o clique
  //    entregava 3 (o filtro só agia na lista, não no badge). A busca textual
  //    é uma lupa à parte: mexe só na lista, não nos contadores — mesmo
  //    padrão do LeadsView.
  const scopedLeads = useMemo(
    () => (consultantFilter ? typeLeads.filter(l => l.consultantId === consultantFilter) : typeLeads),
    [typeLeads, consultantFilter]
  );

  // 3) Contadores para stats + chips (sobre o escopo de consultor).
  const counts = useMemo(() => {
    let attended = 0, waiting = 0, finished = 0, today = 0, matriculados = 0;
    scopedLeads.forEach(l => {
      const a = getApptAttendanceState(l);
      if (a.key === 'attended') attended++;
      if (a.key === 'scheduled' || a.key === 'pending') waiting++;
      if (l.status === 'Venda' || l.status === 'Perda') finished++;
      if (l.status === 'Venda' || isLeadConverted(l)) matriculados++;
      if (isApptSameDay(getLeadAppointmentDate(l))) today++;
    });
    return { total: scopedLeads.length, attended, waiting, finished, today, matriculados };
  }, [scopedLeads]);

  // 4) Busca (nome ou telefone) + filtro de status + ordenação (futuros mais
  //    próximos no topo; depois passados mais recentes). O telefone casa tanto
  //    pelo texto cru quanto pelos dígitos normalizados, então "(51) 99999-8888"
  //    e "5199999" acham o mesmo lead (mesmo padrão canônico do LeadsView).
  const filtered = useMemo(() => {
    let list = scopedLeads;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const digits = searchTerm.replace(/\D/g, '');
      list = list.filter(l =>
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.whatsapp && l.whatsapp.includes(searchTerm)) ||
        (digits && String(l.whatsapp || '').replace(/\D/g, '').includes(digits))
      );
    }
    if (statusFilter === 'today') list = list.filter(l => isApptSameDay(getLeadAppointmentDate(l)));
    else if (statusFilter === 'waiting') list = list.filter(l => { const k = getApptAttendanceState(l).key; return k === 'scheduled' || k === 'pending'; });
    else if (statusFilter === 'attended') list = list.filter(l => getApptAttendanceState(l).key === 'attended');
    else if (statusFilter === 'finished') list = list.filter(l => l.status === 'Venda' || l.status === 'Perda');

    const now = Date.now();
    return [...list].sort((a, b) => {
      const da = getLeadAppointmentDate(a)?.getTime() ?? 0;
      const db2 = getLeadAppointmentDate(b)?.getTime() ?? 0;
      const aF = da >= now, bF = db2 >= now;
      if (aF !== bF) return aF ? -1 : 1;
      return aF ? (da - db2) : (db2 - da);
    });
  }, [scopedLeads, searchTerm, statusFilter]);

  const chips = [
    { id: 'all', label: 'Todos', count: counts.total },
    { id: 'today', label: 'Hoje', count: counts.today },
    { id: 'waiting', label: 'Aguardando', count: counts.waiting },
    { id: 'attended', label: 'Compareceram', count: counts.attended },
    { id: 'finished', label: 'Finalizados', count: counts.finished },
  ];

  const finToneClass = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    slate: 'bg-slate-100 text-slate-600 dark:bg-white/[0.05] dark:text-slate-300',
  };

  return (
    <>
      <div className="animate-fade-in space-y-5">
        {/* Header + stats */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl grid place-items-center bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300 shrink-0">
              <HeaderIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">{typeLabelPlural}</h3>
              <p className="text-xs font-medium text-gray-500 dark:text-neutral-400 mt-0.5">
                Controle de {typeLabelPlural} agendadas — somente leitura
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatPill label="Total" value={counts.total} />
            <StatPill label="Compareceram" value={counts.attended} accent="emerald" />
            <StatPill label="Aguardando" value={counts.waiting} accent="amber" />
            <StatPill label="Matriculados" value={counts.matriculados} accent="brand" />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-600 transition pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] pl-9 pr-3 placeholder:text-slate-400 transition"
            />
          </div>
          {isAdmin && (
            <select
              value={consultantFilter}
              onChange={(e) => setConsultantFilter(e.target.value)}
              className="h-10 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] outline-none text-[13px] pl-3 pr-8 text-slate-700 dark:text-slate-200 cursor-pointer font-medium"
            >
              <option value="">Todos os consultores</option>
              {(usersList || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <div className="flex-1" />
          <div className="text-[11.5px] text-slate-500 dark:text-slate-400 whitespace-nowrap num">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{filtered.length}</span> de {counts.total}
          </div>
        </div>

        {/* Filtros (chips) */}
        <div className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07]">
          {chips.map(c => {
            const active = statusFilter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setStatusFilter(c.id)}
                className={`h-8 px-3 rounded-md text-[12px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition ${active ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
              >
                {c.label}
                <span className={`num text-[10.5px] px-1 h-[15px] rounded grid place-items-center min-w-[15px] ${active ? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900' : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'}`}>{c.count}</span>
              </button>
            );
          })}
        </div>

        {/* Tabela */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-card overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/[0.05]">
                <tr className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <th className="py-3 pl-5 pr-3">Aluno</th>
                  <th className="py-3 px-3">Data marcada</th>
                  {isAula && <th className="py-3 px-3">Modalidade</th>}
                  <th className="py-3 px-3 text-center">Compareceu</th>
                  <th className="py-3 pr-5 pl-3 text-center">Finalizou</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const d = getLeadAppointmentDate(l);
                  const att = getApptAttendanceState(l);
                  const fin = getApptFinalState(l);
                  const FinIcon = fin.Icon;
                  const isPast = att.key === 'pending';
                  return (
                    <tr
                      key={l.id}
                      onClick={() => setSelectedLead(l)}
                      className="border-t border-slate-100 dark:border-white/[0.05] hover:bg-slate-50/60 dark:hover:bg-white/[0.02] cursor-pointer transition"
                    >
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={l.name} size={32} />
                          <div className="min-w-0">
                            <div className="text-[13.5px] font-semibold tracking-tight text-slate-900 dark:text-white truncate">{l.name}</div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400 num flex-wrap">
                              <span className="inline-flex items-center gap-1"><Phone size={11} /> {l.whatsapp}</span>
                              {isAdmin && l.consultantName && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-white/20" />
                                  <span className="text-[11px] text-brand-600 dark:text-brand-300">@{l.consultantName}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        {d ? (
                          <div className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium num whitespace-nowrap ${isPast ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'}`}>
                            <Calendar size={13} />
                            <span>{d.toLocaleDateString('pt-BR')} às {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        ) : (
                          <span className="text-[11.5px] text-slate-400 italic">—</span>
                        )}
                      </td>
                      {isAula && (
                        <td className="py-3.5 px-3">
                          {l.appointmentModality ? (
                            <div className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-700 dark:text-slate-200">
                              <Dumbbell size={12} className="text-brand-600 dark:text-brand-300 shrink-0" />
                              <span className="truncate max-w-[140px]">{l.appointmentModality}</span>
                              {Number(l.trialClassesPlanned) > 0 && (
                                <span className="num text-[10.5px] font-semibold px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300 whitespace-nowrap">{l.trialClassesPlanned}x</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11.5px] text-slate-400 italic">—</span>
                          )}
                        </td>
                      )}
                      <td className="py-3.5 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${att.badgeClass}`}>
                          <span aria-hidden="true">{att.icon}</span> {att.label}
                        </span>
                      </td>
                      <td className="py-3.5 pr-5 pl-3 text-center">
                        <span title={fin.reason || ''} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${finToneClass[fin.tone]}`}>
                          <FinIcon size={12} /> {fin.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={isAula ? 5 : 4} className="py-16 text-center text-slate-400">
                      <div className="grid place-items-center gap-2">
                        <HeaderIcon size={22} className="opacity-40" />
                        <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Nenhuma {typeLabelSingular} por aqui</p>
                        <p className="text-[12.5px]">As {typeLabelPlural} agendadas pela Linha do Tempo e Meta Diária aparecem aqui.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedLead && (
        <LeadDetailsModal
          lead={selectedLead}
          interactions={(interactions || []).filter(i => i.leadId === selectedLead.id).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))}
          onClose={() => setSelectedLead(null)}
          appUser={appUser}
          statuses={statuses}
          tags={tags}
          lossReasons={lossReasons}
          db={db}
          funnels={funnels}
        />
      )}
    </>
  );
}

function LeadsView({ leads, interactions, appUser, sources, statuses, usersList, tags, lossReasons, db, funnels, selectedFunnelId, setSelectedFunnelId, onAddLeadClick }) {
  const toast = useToast();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [statusFilters, setStatusFilters] = useState([]);
  const [consultantFilters, setConsultantFilters] = useState([]);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [hotOnly, setHotOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  // O AddLeadModal mora no App-level. O botão local apenas dispara o
  // callback `onAddLeadClick` recebido por prop.

  const defaultFunnelId = useMemo(() => getDefaultFunnel(funnels)?.id || null, [funnels]);
  const hasFunnels = (funnels || []).length > 0;

  // Quando o funil ativo muda, limpamos filtros de status para evitar listar etapas inexistentes
  useEffect(() => {
    setStatusFilters([]);
  }, [selectedFunnelId]);

  // Índice leadId -> última interação, construído uma vez (O(interações)).
  // Alimenta o filtro "Apenas Hot" e os badges da tabela sem recomputar
  // interactions.filter() por linha (era O(leads × interações) a cada tecla).
  const interactionIndex = useMemo(() => buildInteractionIndex(interactions), [interactions]);

  // Busca deferida: o input atualiza na hora (searchTerm), mas a filtragem
  // pesada da base roda sobre o valor deferido — o React mantém a digitação
  // fluida e refiltra quando sobra tempo, sem debounce manual/timeout.
  const deferredSearch = useDeferredValue(searchTerm);

  const filteredLeads = useMemo(() => {
    const lowerSearch = deferredSearch.toLowerCase();
    const searchDigits = deferredSearch.replace(/\D/g, '');
    return (leads || []).filter(l => {
      const matchFunnel = isItemInFunnel(l, selectedFunnelId, defaultFunnelId);
      const matchSearch =
        (l.name || '').toLowerCase().includes(lowerSearch) ||
        (l.whatsapp || '').includes(deferredSearch) ||
        (searchDigits && String(l.whatsapp || '').replace(/\D/g, '').includes(searchDigits));
      const matchStatus = statusFilters.length === 0 || statusFilters.includes(l.status);
      const matchConsultant = consultantFilters.length === 0 || consultantFilters.includes(l.consultantId);
      const isOverdue = l.status !== 'Venda' && l.status !== 'Perda' && l.nextFollowUp && l.nextFollowUp < new Date();
      const matchOverdue = !overdueOnly || isOverdue;
      const matchHot = !hotOnly || isHotLeadFromDate(l, interactionIndex.get(l.id)?.lastDate);
      return matchFunnel && matchSearch && matchStatus && matchOverdue && matchConsultant && matchHot;
    }).sort((a,b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0));
  }, [leads, interactionIndex, deferredSearch, statusFilters, overdueOnly, hotOnly, consultantFilters, selectedFunnelId, defaultFunnelId]);

  const toggleStatus = (s) => setStatusFilters(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleConsultant = (id) => setConsultantFilters(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const statusesForFunnel = (statuses || []).filter(s => isItemInFunnel(s, selectedFunnelId, defaultFunnelId));
  const allStatuses = [...statusesForFunnel.map(s=>s.name), 'Venda', 'Perda'];

  // EXPORTAÇÃO CSV
  const exportToCSV = () => {
    if (!filteredLeads || filteredLeads.length === 0) {
      toast.warning("Não há leads para exportar com os filtros atuais.");
      return;
    }
    
    // Sanitiza cada célula: escapa aspas (em TODOS os campos) e neutraliza
    // fórmulas (CSV injection) — um valor começando com = + - @ tab/CR seria
    // executado pelo Excel/Sheets ao abrir o arquivo. Tudo entre aspas.
    const csvCell = (value) => {
      let s = String(value ?? '');
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };
    // Separador ';' — o Excel em pt-BR usa ponto-e-vírgula como separador de
    // lista; com vírgula o arquivo abriria tudo numa coluna só.
    const SEP = ';';
    const headers = ["Nome", "WhatsApp", "Origem", "Fase do Funil", "Consultor", "Data Cadastro", "Observação", "Motivo Perda"];
    const csvRows = filteredLeads.map(l => [
      l.name, l.whatsapp, l.source, l.status, l.consultantName,
      l.createdAt ? l.createdAt.toLocaleDateString('pt-BR') : '',
      l.observation, l.lossReason
    ].map(csvCell).join(SEP));

    const csvContent = [headers.map(csvCell).join(SEP), ...csvRows].join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // \uFEFF força o Excel a ler UTF-8
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `leads_stronix_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Counts for hero stat pills.
  const baseLeads = (leads || []).filter(l => isItemInFunnel(l, selectedFunnelId, defaultFunnelId));
  const totalLeads = baseLeads.length;
  const ativos = baseLeads.filter(l => l.status !== 'Venda' && l.status !== 'Perda').length;
  const overdueCount = baseLeads.filter(l => l.status !== 'Venda' && l.status !== 'Perda' && l.nextFollowUp && l.nextFollowUp < new Date()).length;
  const vendas = baseLeads.filter(l => l.status === 'Venda').length;

  const filterCount = statusFilters.length + consultantFilters.length + (overdueOnly ? 1 : 0) + (hotOnly ? 1 : 0);
  const clearAllFilters = () => { setStatusFilters([]); setConsultantFilters([]); setOverdueOnly(false); setHotOnly(false); };

  return (
    <div className="h-full flex flex-col space-y-4 animate-fade-in relative font-sans">
      {/* Page hero */}
      <section className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
            <Users size={13} className="text-brand-600" /> Base de leads
          </div>
          <h2 className="mt-1.5 font-display text-[24px] font-semibold tracking-tight leading-tight">
            Todos os leads
          </h2>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
            Pesquise, filtre e gerencie toda a sua base em um só lugar.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatPill label="Total" value={totalLeads} accent="brand" />
          <StatPill label="Ativos" value={ativos} accent="amber" />
          <StatPill label="Em atraso" value={overdueCount} accent="rose" />
          <StatPill label="Vendas" value={vendas} accent="emerald" />
        </div>
      </section>

      {/* Toolbar */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-card p-3 flex flex-col md:flex-row gap-2 items-stretch md:items-center">
        {hasFunnels && (
          <FunnelSelector
            funnels={funnels}
            value={selectedFunnelId}
            onChange={setSelectedFunnelId}
            variant="soft"
            className="w-full md:w-[220px]"
          />
        )}
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-600 transition pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] pl-9 pr-3 placeholder:text-slate-400 transition"
          />
        </div>
        <div className="flex items-center gap-2">
          <Btn kind="secondary" icon={<Download size={13} />} onClick={exportToCSV}>Exportar</Btn>
          <Btn
            kind={filterCount > 0 ? 'primary' : 'soft'}
            icon={<Filter size={13} />}
            onClick={() => setIsFilterOpen(true)}
          >
            Filtros{filterCount > 0 ? ` (${filterCount})` : ''}
          </Btn>
          <Btn kind="brand" icon={<Plus size={13} />} onClick={() => onAddLeadClick && onAddLeadClick()}>Novo lead</Btn>
        </div>
      </div>

      {/* Active filter chips */}
      {filterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1">Filtros ativos</span>
          {hotOnly && <ActiveFilterChip label="🔥 Hot leads" onRemove={() => setHotOnly(false)} accent="amber" />}
          {overdueOnly && <ActiveFilterChip label="Em atraso" onRemove={() => setOverdueOnly(false)} accent="rose" />}
          {statusFilters.map(s => (
            <ActiveFilterChip key={s} label={s} onRemove={() => toggleStatus(s)} accent="brand" />
          ))}
          {consultantFilters.map(id => {
            const u = (usersList || []).find(x => x.id === id);
            return (
              <ActiveFilterChip key={id} label={u?.name || id} onRemove={() => toggleConsultant(id)} />
            );
          })}
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-[11.5px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white ml-1 whitespace-nowrap"
          >
            Limpar tudo
          </button>
        </div>
      )}

      {/* Results count */}
      <div className="text-[12.5px] text-slate-500 dark:text-slate-400">
        Exibindo <span className="num font-semibold text-slate-700 dark:text-slate-200">{filteredLeads.length}</span> de <span className="num">{totalLeads}</span> leads
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-card overflow-hidden flex-1">
        <div className="overflow-x-auto h-full thin-scroll">
          <table className="w-full text-left min-w-[950px]">
            <thead className="sticky top-0 bg-white dark:bg-white/[0.02] z-10 border-b border-slate-100 dark:border-white/[0.05]">
              <tr className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <th className="py-3 pl-5 pr-3">Informações do aluno</th>
                <th className="py-3 px-3 text-center">Status no funil</th>
                <th className="py-3 px-3">Ação agendada</th>
                <th className="py-3 pr-5 pl-3 text-right">Data de cadastro</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map(l => {
                const isOverdue = l.status !== 'Venda' && l.status !== 'Perda' && l.nextFollowUp && l.nextFollowUp < new Date();
                return (
                  <tr
                    key={l.id}
                    onClick={() => setSelectedLead(l)}
                    className="border-t border-slate-100 dark:border-white/[0.05] hover:bg-slate-50/60 dark:hover:bg-white/[0.02] cursor-pointer transition"
                  >
                    <td className="py-3.5 pl-5 pr-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={l.name} size={32} />
                        <div className="min-w-0">
                          <div className={`text-[13.5px] font-semibold tracking-tight ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>{l.name}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400 num flex-wrap">
                            <span className="inline-flex items-center gap-1"><Phone size={11} /> {l.whatsapp}</span>
                            {isAdminUser(appUser) && l.consultantName && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-white/20"></span>
                                <span className="text-[11px] text-brand-600 dark:text-brand-300">@{l.consultantName}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                        <StatusBadge statusName={l.status} statusesArray={statuses} />
                        <LeadTemperatureBadge lead={l} lastInteractionDate={interactionIndex.get(l.id)?.lastDate} compact />
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      {l.nextFollowUp ? (
                        <div className={`inline-flex items-center gap-1.5 text-[12px] font-medium num whitespace-nowrap ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {isOverdue ? <AlertCircle size={13} /> : <FollowUpIcon type={l.nextFollowUpType} className="w-3.5 h-3.5" />}
                          <span>
                            {l.nextFollowUp.toLocaleDateString('pt-BR')} às {l.nextFollowUp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="text-[11.5px] text-slate-400 dark:text-slate-500 italic">Sem agendamento</span>
                          <DaysSinceContactBadge lead={l} lastInteractionDate={interactionIndex.get(l.id)?.lastDate} />
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 pr-5 pl-3 text-right num text-[12px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {l.createdAt?.toLocaleDateString('pt-BR') || ''}
                    </td>
                  </tr>
                );
              })}
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-16 text-center text-slate-400">
                    <div className="grid place-items-center gap-2">
                      <Search size={22} className="opacity-40" />
                      <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Nenhum lead encontrado</p>
                      <p className="text-[12.5px]">Ajuste a busca ou limpe os filtros.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isFilterOpen && (
        <div className="fixed inset-0 z-[120] overflow-hidden flex justify-end animate-fade-in">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={()=>setIsFilterOpen(false)} />
          <div className="relative w-full max-w-sm bg-paper-50 dark:bg-neutral-950 shadow-[0_0_50px_rgba(0,0,0,0.5)] border-l border-gray-200 dark:border-neutral-800 p-8 flex flex-col h-full animate-slide-in-right">
            
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-wider">Filtros</h3>
                <p className="text-xs font-medium text-gray-500 dark:text-neutral-400 mt-1">Otimize sua visão</p>
              </div>
              <button onClick={()=>setIsFilterOpen(false)} className="p-2 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white dark:text-white bg-white dark:bg-neutral-900 rounded-xl transition-all shadow-xl active:scale-90"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 space-y-8 overflow-y-auto pr-2 custom-scrollbar">
              <section>
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-brand-600 mb-4 flex items-center gap-2"><Clock className="w-3 h-3" /> Situação Operacional</p>
                <div className="grid grid-cols-1 gap-2">
                  <button onClick={()=>setHotOnly(!hotOnly)} className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${hotOnly ? 'bg-accent-500/10 border-accent-500/50 text-accent-500' : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800'}`}>
                    <span className="font-bold text-xs uppercase tracking-widest flex items-center gap-2">🔥 Apenas Hot Leads</span>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 ${hotOnly ? 'bg-accent-500 border-accent-500 text-white' : 'border-gray-300 dark:border-neutral-700'}`}>{hotOnly && <Check className="w-3 h-3 font-bold" />}</div>
                  </button>
                  <button onClick={()=>setOverdueOnly(!overdueOnly)} className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${overdueOnly ? 'bg-red-500/10 border-red-500/50 text-red-400' : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800'}`}>
                    <span className="font-bold text-xs uppercase tracking-widest">Em Atraso</span>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 ${overdueOnly ? 'bg-red-500 border-red-500 text-white' : 'border-gray-300 dark:border-neutral-700'}`}>{overdueOnly && <Check className="w-3 h-3 font-bold" />}</div>
                  </button>
                </div>
              </section>

              {isAdminUser(appUser) && (
                <section>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-brand-600 mb-4 flex items-center gap-2"><Users className="w-3 h-3" /> Consultores</p>
                  <div className="grid grid-cols-1 gap-2">
                    {(usersList || []).map(u => (
                      <button key={u.id} onClick={()=>toggleConsultant(u.id)} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${consultantFilters.includes(u.id) ? 'bg-brand-500/10 border-brand-500/50 text-brand-400' : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800'}`}>
                        <span className="text-xs font-semibold">{u.name}</span>
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 ${consultantFilters.includes(u.id) ? 'bg-brand-500 border-brand-500 text-white' : 'border-gray-300 dark:border-neutral-700'}`}>{consultantFilters.includes(u.id) && <Check className="w-3 h-3" />}</div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-brand-600 mb-4 flex items-center gap-2"><Tag className="w-3 h-3" /> Fase do Funil</p>
                <div className="grid grid-cols-1 gap-2">
                  {allStatuses.map(s => (
                    <button key={s} onClick={()=>toggleStatus(s)} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${statusFilters.includes(s) ? 'bg-brand-600/10 border-brand-600/50 text-brand-500' : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800'}`}>
                      <span className="text-xs font-semibold">{s}</span>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 ${statusFilters.includes(s) ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-300 dark:border-neutral-700'}`}>{statusFilters.includes(s) && <Check className="w-3 h-3" />}</div>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <div className="pt-6 mt-4 border-t border-gray-200 dark:border-neutral-800 grid grid-cols-2 gap-3">
              <button onClick={()=>{setStatusFilters([]); setOverdueOnly(false); setHotOnly(false); setConsultantFilters([]);}} className="py-3 rounded-xl text-gray-400 dark:text-neutral-500 font-bold hover:bg-white dark:bg-neutral-900 transition-all text-[10px] uppercase tracking-[0.2em]">Limpar</button>
              <button onClick={()=>setIsFilterOpen(false)} className="py-3 rounded-xl bg-brand-600 text-gray-900 dark:text-white font-bold shadow-xl text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all">Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {selectedLead && <LeadDetailsModal lead={selectedLead} interactions={interactions.filter(i => i.leadId === selectedLead.id).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0))} onClose={() => setSelectedLead(null)} appUser={appUser} statuses={statuses} tags={tags} lossReasons={lossReasons} db={db} funnels={funnels} />}
    </div>
  );
}

// ==========================================
// MODAL DE CADASTRO
// ==========================================
// --- helpers do AddLeadModal (apresentação) ---
const addLeadOnlyDigits = (s) => String(s || '').replace(/\D/g, '');
const addLeadFmtPhone = (raw) => {
  const d = addLeadOnlyDigits(raw).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
};
// pontinho de cor por status — bate com os valores do statusGradientMap.
const ADDLEAD_STATUS_DOT = {
  blue: 'bg-brand-500', green: 'bg-emerald-500', yellow: 'bg-amber-500',
  red: 'bg-rose-500', purple: 'bg-violet-500', orange: 'bg-accent-500',
  gray: 'bg-slate-400', teal: 'bg-teal-500', pink: 'bg-pink-500',
  indigo: 'bg-indigo-500', lime: 'bg-lime-500',
};
const addLeadInputCls = 'w-full h-11 px-3.5 rounded-xl text-[14px] font-medium bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-normal outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15';

function AddLeadField({ label, hint, children }) {
  return (
    <div>
      <label className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">{label}</span>
        {hint && <span className="text-[11px] text-slate-400 dark:text-slate-500">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function AddLeadModal({ onClose, appUser, sources, statuses, tags, db, funnels, selectedFunnelId, leads, onCreated }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const nameRef = useRef(null);
  const submittingRef = useRef(false); // guarda síncrona contra duplo-submit
  useEffect(() => { nameRef.current?.focus(); }, []);

  const safeFunnels = Array.isArray(funnels) ? funnels : [];
  const initialFunnelId = selectedFunnelId || getDefaultFunnel(safeFunnels)?.id || null;
  const initialStatuses = (statuses || []).filter(s => s.funnelId === initialFunnelId);
  // Normaliza WhatsApp para apenas dígitos. Aceita o caso vazio sem trocar
  // por undefined pra evitar match acidental ("" === "" → true).
  const normalizePhone = (raw) => String(raw || '').replace(/\D/g, '');

  const [formData, setFormData] = useState({
    name: '',
    whatsapp: '',
    source: sources?.[0]?.name || 'Instagram',
    funnelId: initialFunnelId,
    status: initialStatuses?.[0]?.name || 'Novo',
    observation: '',
    tags: []
  });

  const statusesForFunnel = useMemo(
    () => (statuses || []).filter(s => s.funnelId === formData.funnelId),
    [statuses, formData.funnelId]
  );
  const statusObj = (statuses || []).find(s => s.name === formData.status);

  const handleFunnelChange = (newFunnelId) => {
    const nextStatuses = (statuses || []).filter(s => s.funnelId === newFunnelId);
    setFormData(prev => ({
      ...prev,
      funnelId: newFunnelId,
      status: nextStatuses[0]?.name || 'Novo'
    }));
  };

  const toggleTag = (name) =>
    setFormData(prev => ({ ...prev, tags: prev.tags.includes(name) ? prev.tags.filter(x => x !== name) : [...prev.tags, name] }));

  // validações ao vivo (mesma regra do modal original)
  const phoneDigits = normalizePhone(formData.whatsapp);
  const phoneTooShort = phoneDigits.length > 0 && phoneDigits.length < 10;
  const duplicate = phoneDigits.length >= 8
    ? (leads || []).find(l => normalizePhone(l.whatsapp) === phoneDigits)
    : null;
  const canSubmit = formData.name.trim() && phoneDigits.length >= 8 && !duplicate && formData.funnelId;

const handleSubmit = async (e) => {
  e.preventDefault();
  if (!formData.name || !formData.whatsapp) return;
  if (!formData.funnelId) {
    toast.warning('Selecione um funil para o lead. Crie um em Configurações → Funil Pipeline se não houver opções.');
    return;
  }

  // Bloqueio de duplicidade por WhatsApp.
  // Comparamos versões com apenas dígitos para ignorar formatação ((11) 9..., +55, etc).
  // Validação de defesa em profundidade: a UI bloqueia aqui; em paralelo seria
  // ideal ter uma regra Firestore + índice unique, mas isso é fora de escopo.
  const newPhoneDigits = normalizePhone(formData.whatsapp);
  if (newPhoneDigits.length < 8) {
    toast.warning('Informe um número de WhatsApp válido (com DDD).');
    return;
  }
  const duplicate = (leads || []).find(l => normalizePhone(l.whatsapp) === newPhoneDigits);
  if (duplicate) {
    const ownerLabel = duplicate.consultantName ? ` (consultor: ${duplicate.consultantName})` : '';
    const statusLabel = duplicate.status ? ` · etapa "${duplicate.status}"` : '';
    toast.warning(`Já existe um lead com este WhatsApp: ${duplicate.name}${ownerLabel}${statusLabel}.`);
    return;
  }

  // Guarda contra duplo-submit (o `loading`/`disabled` não atualiza a tempo de um
  // clique duplo rápido; a ref é síncrona e impede o 2º addDoc → evita duplicata).
  if (submittingRef.current) return;
  submittingRef.current = true;
  setLoading(true);

  try {
    const leadRef = await addDoc(
      collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH),
      {
        ...formData,
        ...getLeadOwnershipFields(appUser),
        createdAt: serverTimestamp(),
        nextFollowUp: null,
        nextFollowUpType: null,
        appointmentType: null,
        appointmentScheduledFor: null
      }
    );

    if (formData.observation.trim()) {
      await addDoc(
        collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH),
        {
          leadId: leadRef.id,
          consultantName: appUser.name,
          ...getInteractionSecurityFields(
            {
              consultantId: appUser.id,
              consultantAuthUid: appUser.authUid
            },
            appUser
          ),
          text: `OBSERVAÇÃO DO CADASTRO: ${formData.observation}`,
          type: 'note',
          createdAt: serverTimestamp()
        }
      );
    }

    // Notifica o App pra abrir o perfil do lead recém-criado.
    // O App espera o doc aparecer em `leads` via onSnapshot e abre o
    // LeadDetailsModal — assim o consultor já pode agendar visita/aula.
    if (onCreated) onCreated(leadRef.id);
    onClose();
  } catch (error) {
    console.error(error);
    toast.error?.('Erro ao cadastrar lead.');
  } finally {
    submittingRef.current = false;
    setLoading(false);
  }
};

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-ink-950/55 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative w-full max-w-[840px] max-h-[92vh] flex flex-col rounded-2xl overflow-hidden bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/[0.08] shadow-[0_30px_80px_-20px_rgba(8,13,34,.55)] animate-fade-in">
        {/* header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-200/80 dark:border-white/[0.07] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl grid place-items-center bg-brand-50 dark:bg-white/[0.06] ring-1 ring-brand-100 dark:ring-white/[0.08]">
              <SurgeMark size={21} />
            </div>
            <div>
              <h2 className="font-display text-[18px] font-bold tracking-tight leading-none text-gray-900 dark:text-white">Novo lead</h2>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">Cadastre um contato no pipeline</p>
            </div>
          </div>
          <button onClick={onClose} title="Fechar"
            className="w-9 h-9 grid place-items-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-white/[0.06] transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 grid md:grid-cols-[1fr_280px]">
            {/* form */}
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <AddLeadField label="Nome do lead">
                  <input ref={nameRef} autoComplete="off" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome completo" className={addLeadInputCls} />
                </AddLeadField>
                <AddLeadField label="WhatsApp" hint={duplicate ? '' : 'com DDD'}>
                  <input type="tel" autoComplete="off" value={addLeadFmtPhone(formData.whatsapp)} onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    placeholder="(51) 9 0000-0000"
                    className={`${addLeadInputCls} ${duplicate ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/15' : phoneTooShort ? 'border-amber-400' : ''}`} />
                  {duplicate ? (
                    <div className="mt-1.5 flex items-start gap-1.5 text-[11.5px] text-rose-600 dark:text-rose-400">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      <span>Já existe: <strong>{duplicate.name}</strong>{duplicate.consultantName ? ` · ${duplicate.consultantName}` : ''}{duplicate.status ? ` (${duplicate.status})` : ''}</span>
                    </div>
                  ) : phoneTooShort ? (
                    <div className="mt-1.5 text-[11.5px] text-amber-600 dark:text-amber-400">Número incompleto — inclua DDD.</div>
                  ) : null}
                </AddLeadField>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <AddLeadField label="Origem">
                  <select value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })} className={`${addLeadInputCls} pr-9 cursor-pointer appearance-none`}>
                    {(sources || []).map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </AddLeadField>
                <AddLeadField label="Funil">
                  <select value={formData.funnelId || ''} onChange={(e) => handleFunnelChange(e.target.value)} className={`${addLeadInputCls} pr-9 cursor-pointer appearance-none`}>
                    {safeFunnels.length === 0 && <option value="">Nenhum funil disponível</option>}
                    {safeFunnels.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </AddLeadField>
              </div>

              <AddLeadField label="Fase inicial">
                <div className="flex flex-wrap gap-1.5">
                  {statusesForFunnel.length === 0 && <span className="text-[12.5px] text-slate-400">Novo</span>}
                  {statusesForFunnel.map((s) => {
                    const active = formData.status === s.name;
                    return (
                      <button type="button" key={s.id} onClick={() => setFormData({ ...formData, status: s.name })}
                        className={`h-9 px-3 rounded-lg text-[12.5px] font-semibold inline-flex items-center gap-2 transition ${active ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 dark:bg-white/[0.04] dark:text-slate-300 dark:border-white/[0.08]'}`}>
                        <span className={`w-2 h-2 rounded-full ${active ? 'bg-white' : (ADDLEAD_STATUS_DOT[s.color] || 'bg-slate-400')}`} />
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </AddLeadField>

              <AddLeadField label="Etiquetas" hint={`${formData.tags.length} selecionada${formData.tags.length === 1 ? '' : 's'}`}>
                <div className="flex flex-wrap gap-1.5">
                  {(tags || []).map((t) => {
                    const on = formData.tags.includes(t.name);
                    return (
                      <button type="button" key={t.id} onClick={() => toggleTag(t.name)}
                        className={`h-8 px-3 rounded-lg text-[12.5px] font-medium inline-flex items-center gap-1.5 transition ${on ? 'bg-accent-500/12 text-accent-600 border border-accent-500/30 dark:bg-accent-500/15 dark:text-accent-400' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 dark:bg-white/[0.04] dark:text-slate-400 dark:border-white/[0.08]'}`}>
                        {on && <Check size={12} />}{t.name}
                      </button>
                    );
                  })}
                </div>
              </AddLeadField>

              <AddLeadField label="Observação" hint="opcional">
                <textarea value={formData.observation} onChange={(e) => setFormData({ ...formData, observation: e.target.value })} autoComplete="off"
                  placeholder="Algum detalhe importante para o primeiro atendimento?"
                  className={`${addLeadInputCls} h-24 py-3 resize-none leading-relaxed`} />
              </AddLeadField>
            </div>

            {/* preview */}
            <div className="hidden md:flex flex-col gap-4 p-6 bg-slate-50/70 dark:bg-white/[0.02] border-l border-slate-200/80 dark:border-white/[0.06]">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Pré-visualização</div>
              <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/[0.07] overflow-hidden">
                <div className="h-1 w-full" style={{ background: formData.name ? '#2B59FF' : '#e3e6ee' }} />
                <div className="p-3.5">
                  <div className="font-semibold text-[14px] text-slate-900 dark:text-white truncate">
                    {formData.name || <span className="text-slate-300 dark:text-slate-600">Nome do lead</span>}
                  </div>
                  <div className="text-[12px] text-slate-500 dark:text-slate-400">{formData.whatsapp ? addLeadFmtPhone(formData.whatsapp) : '(00) 0 0000-0000'}</div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.05]">
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
                      <span className={`w-2 h-2 rounded-full ${ADDLEAD_STATUS_DOT[statusObj?.color] || 'bg-slate-300'}`} />{formData.status}
                    </span>
                    <span className="text-[11px] text-slate-400">{formData.source}</span>
                  </div>
                </div>
              </div>
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-start gap-1.5">
                <Users size={13} className="mt-0.5 text-brand-600 dark:text-brand-400 shrink-0" />
                O lead será atribuído a <strong className="text-slate-700 dark:text-slate-200">{appUser?.name}</strong> e aparecerá na Meta diária.
              </p>
            </div>
          </div>

          {/* footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-ink-900 shrink-0">
            <div className="text-[11.5px] text-slate-400 dark:text-slate-500 hidden sm:flex items-center gap-1.5">
              <CheckCircle2 size={13} /> Verificação de duplicidade ativa
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button type="button" onClick={onClose}
                className="h-11 px-4 rounded-xl text-[13.5px] font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06] transition">
                Cancelar
              </button>
              <button type="submit" disabled={!canSubmit || loading}
                className="h-11 px-5 rounded-xl text-[13.5px] font-semibold inline-flex items-center gap-2 transition active:scale-[.98] bg-brand-600 text-white hover:bg-brand-700 shadow-[0_8px_20px_-8px_rgba(43,89,255,.7)] disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed">
                {loading ? <><span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Salvando…</>
                         : <><Zap size={15} /> Cadastrar lead</>}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
const interactionToneMap = {
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



const extractStageNameFromInteractionText = (text = '') => {
  const match = String(text).match(/\[([^\]]+)\]/);
  return match ? match[1].trim() : '';
};

const getStageTone = (statusName, statusesArray = []) => {
  if (statusName === 'Venda') return interactionToneMap.green;
  if (statusName === 'Perda') return interactionToneMap.red;

  const statusObj = (statusesArray || []).find(s => s.name === statusName);
  const color = statusObj?.color || 'orange';

  return interactionToneMap[color] || interactionToneMap.orange;
};

const getInteractionVisual = (interaction, statusesArray = []) => {
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

// ==========================================
// SCHEDULE WIZARD (agendamento passo a passo)
// ==========================================
// Recriação do design_agendamento/wizard.jsx no nosso stack. Reaproveita
// modalidades, opções de aulas (trialClassOptions) e unidades das Config
// Gerais (via GeneralConfigContext). onConfirm devolve o agendamento montado
// e o LeadDetailsModal grava nos campos canônicos.
const WIZ_TONES = {
  brand:   { dot:'bg-brand-600',   text:'text-brand-700',   soft:'bg-brand-50',   strong:'bg-brand-600',   ring:'ring-brand-300',   darkText:'dark:text-brand-300',   darkSoft:'dark:bg-brand-500/10',   darkRing:'dark:ring-brand-500/40' },
  emerald: { dot:'bg-emerald-500', text:'text-emerald-700', soft:'bg-emerald-50', strong:'bg-emerald-500', ring:'ring-emerald-300', darkText:'dark:text-emerald-300', darkSoft:'dark:bg-emerald-500/10', darkRing:'dark:ring-emerald-500/40' },
  amber:   { dot:'bg-amber-500',   text:'text-amber-700',   soft:'bg-amber-50',   strong:'bg-amber-500',   ring:'ring-amber-300',   darkText:'dark:text-amber-300',   darkSoft:'dark:bg-amber-500/10',   darkRing:'dark:ring-amber-500/40' },
  violet:  { dot:'bg-violet-500',  text:'text-violet-700',  soft:'bg-violet-50',  strong:'bg-violet-500',  ring:'ring-violet-300',  darkText:'dark:text-violet-300',  darkSoft:'dark:bg-violet-500/10',  darkRing:'dark:ring-violet-500/40' },
  teal:    { dot:'bg-teal-500',    text:'text-teal-700',    soft:'bg-teal-50',    strong:'bg-teal-500',    ring:'ring-teal-300',    darkText:'dark:text-teal-300',    darkSoft:'dark:bg-teal-500/10',    darkRing:'dark:ring-teal-500/40' },
};

const WIZ_TYPES = [
  { id:'mensagem', label:'Mensagem',          followUpLabel:'Mensagem',          desc:'Follow-up por WhatsApp', Icon: MessageCircle, color:'emerald', flow:['datahora'] },
  { id:'ligacao',  label:'Ligação',           followUpLabel:'Ligação',           desc:'Retorno por telefone',   Icon: Phone,         color:'amber',   flow:['datahora'] },
  { id:'visita',   label:'Visita',            followUpLabel:'Visita',            desc:'Conhecer a unidade',     Icon: Building2,     color:'violet',  flow:['unidade','datahora'] },
  { id:'aula',     label:'Aula experimental', followUpLabel:'Aula Experimental', desc:'Treino de experiência',  Icon: BookOpen,      color:'teal',    flow:['modalidade','quantidade','datahora'] },
];

const WIZ_STEP_INFO = {
  modalidade: { title: 'Modalidade',                 hint: 'Qual treino o lead vai experimentar?' },
  quantidade: { title: 'Quantas aulas experimentais', hint: 'O que foi combinado com o aluno.' },
  unidade:    { title: 'Unidade',                    hint: 'Onde a visita vai acontecer?' },
  datahora:   { title: 'Dia e horário',              hint: 'Quando vai ser?' },
};

const wizFmtDateTime = (d) => {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'short' }).replace('.', '');
  const time = d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  return `${day} · ${time}`;
};
const wizToLocalInput = (d) => {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const wizQuickSlots = () => {
  const mk = (daysAhead, h, m = 0) => { const d = new Date(); d.setDate(d.getDate()+daysAhead); d.setHours(h, m, 0, 0); return d; };
  const nextSat = () => { const d = new Date(); const add = (6 - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate()+add); d.setHours(10,0,0,0); return d; };
  return [
    { id:'today18', label:'Hoje',   time:'18:00', date: mk(0,18) },
    { id:'tmw09',   label:'Amanhã', time:'09:00', date: mk(1,9)  },
    { id:'tmw18',   label:'Amanhã', time:'18:00', date: mk(1,18) },
    { id:'sat10',   label:'Sábado', time:'10:00', date: nextSat() },
  ];
};

function WizStepDot({ state, n, color = 'brand' }) {
  const t = WIZ_TONES[color] || WIZ_TONES.brand;
  if (state === 'done') {
    return <span className={`w-7 h-7 rounded-full grid place-items-center ${t.strong} text-white shrink-0 check-pop`}><Check size={14} /></span>;
  }
  if (state === 'active') {
    return <span className={`w-7 h-7 rounded-full grid place-items-center bg-white dark:bg-neutral-900 ring-2 ${t.ring} ${t.darkRing} ${t.text} ${t.darkText} text-[12px] font-bold num shrink-0`}>{n}</span>;
  }
  return <span className="w-7 h-7 rounded-full grid place-items-center bg-slate-100 dark:bg-white/[0.05] text-slate-400 dark:text-slate-500 text-[12px] font-bold num shrink-0">{n}</span>;
}

function WizOptionCard({ Icon, label, hint, selected, color = 'brand', badge, onClick, index = 0 }) {
  const t = WIZ_TONES[color] || WIZ_TONES.brand;
  return (
    <button type="button" onClick={onClick} style={{ animationDelay: `${index*40}ms` }}
      className={`opt-in relative text-left rounded-xl border p-3 transition group ${
        selected
          ? `${t.soft} ${t.darkSoft} border-transparent ring-2 ${t.ring} ${t.darkRing}`
          : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-white/[0.02] dark:border-white/[0.07] dark:hover:border-white/15'
      }`}>
      {badge && <span className={`absolute top-2 right-2 text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${t.strong} text-white`}>{badge}</span>}
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 transition ${selected ? `${t.strong} text-white` : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-white/[0.1]'}`}>
            <Icon size={16} />
          </span>
        )}
        <div className="min-w-0">
          <div className={`text-[13.5px] font-semibold leading-tight ${selected ? `${t.text} ${t.darkText}` : 'text-slate-900 dark:text-white'}`}>{label}</div>
          {hint && <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{hint}</div>}
        </div>
        {selected && <span className={`ml-auto w-5 h-5 rounded-full grid place-items-center ${t.strong} text-white check-pop shrink-0`}><Check size={12} /></span>}
      </div>
    </button>
  );
}

function WizPill({ label, hint, selected, color = 'brand', badge, onClick, index = 0 }) {
  const t = WIZ_TONES[color] || WIZ_TONES.brand;
  return (
    <button type="button" onClick={onClick} style={{ animationDelay: `${index*40}ms` }}
      className={`opt-in relative rounded-xl border px-3 py-2.5 text-center transition ${
        selected
          ? `${t.soft} ${t.darkSoft} border-transparent ring-2 ${t.ring} ${t.darkRing}`
          : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-white/[0.02] dark:border-white/[0.07] dark:hover:border-white/15'
      }`}>
      {badge && <span className={`absolute -top-1.5 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${t.strong} text-white whitespace-nowrap`}>{badge}</span>}
      <div className={`text-[14px] font-semibold ${selected ? `${t.text} ${t.darkText}` : 'text-slate-900 dark:text-white'}`}>{label}</div>
      {hint && <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap">{hint}</div>}
    </button>
  );
}

function ScheduleWizard({ onConfirm, onCancel, submitting = false }) {
  const { modalities, trialClassOptions, units } = useGeneralConfig();
  const [typeId, setTypeId] = useState(null);
  const [values, setValues] = useState({});
  const [editing, setEditing] = useState(null);
  const [note, setNote] = useState('');

  const type = WIZ_TYPES.find(t => t.id === typeId) || null;
  const flow = type ? type.flow : [];
  const color = type ? type.color : 'brand';

  const firstIncomplete = useMemo(() => {
    for (const s of flow) { if (values[s] == null || values[s] === '') return s; }
    return null;
  }, [flow, values]);

  const activeStep = editing || firstIncomplete;
  const complete = Boolean(type) && firstIncomplete === null;

  const setVal = (key, val) => {
    setValues(v => {
      const next = { ...v, [key]: val };
      const idx = flow.indexOf(key);
      if (idx !== -1) flow.slice(idx + 1).forEach(s => { delete next[s]; });
      return next;
    });
    setEditing(null);
  };

  const pickType = (id) => { setTypeId(id); setValues({}); setEditing(null); };
  const resetAll = () => { setTypeId(null); setValues({}); setEditing(null); setNote(''); };

  const stepState = (stepId) => {
    if (stepId === activeStep) return 'active';
    if (values[stepId] != null && values[stepId] !== '') return 'done';
    const idx = flow.indexOf(stepId);
    const firstIdx = activeStep ? flow.indexOf(activeStep) : flow.length;
    return idx < firstIdx ? 'done' : 'locked';
  };

  const summaryFor = (stepId) => {
    switch (stepId) {
      case 'modalidade': return values.modalidade || null;
      case 'quantidade': return values.quantidade ? `${values.quantidade} ${values.quantidade === 1 ? 'aula' : 'aulas'}` : null;
      case 'unidade':    return values.unidade ? `Unidade ${values.unidade}` : null;
      case 'datahora':   return values.datahora ? wizFmtDateTime(values.datahora) : null;
      default: return null;
    }
  };

  const quickSlots = useMemo(() => wizQuickSlots(), []);
  const qtyOptions = (trialClassOptions && trialClassOptions.length ? trialClassOptions : [1]);

  const renderStepBody = (stepId) => {
    if (stepId === 'modalidade') {
      if (!(modalities || []).length) {
        return <p className="text-[12.5px] text-slate-500 dark:text-slate-400">Nenhuma modalidade cadastrada. Adicione em <span className="font-semibold">Configurações → Configurações Gerais</span>.</p>;
      }
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {modalities.map((m, i) => (
            <WizOptionCard key={m.id} index={i} Icon={Dumbbell} label={m.name} color={color}
              selected={values.modalidade === m.name} onClick={() => setVal('modalidade', m.name)} />
          ))}
        </div>
      );
    }
    if (stepId === 'quantidade') {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {qtyOptions.map((n, i) => (
            <WizPill key={n} index={i} label={`${n} ${n === 1 ? 'aula' : 'aulas'}`} color={color}
              selected={values.quantidade === n} onClick={() => setVal('quantidade', n)} />
          ))}
        </div>
      );
    }
    if (stepId === 'unidade') {
      if (!(units || []).length) {
        return <p className="text-[12.5px] text-slate-500 dark:text-slate-400">Nenhuma unidade cadastrada. Adicione em <span className="font-semibold">Configurações → Configurações Gerais</span>.</p>;
      }
      return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {units.map((u, i) => (
            <WizOptionCard key={u.id} index={i} Icon={Building2} label={u.name} hint={u.address} color={color}
              selected={values.unidade === u.name} onClick={() => setVal('unidade', u.name)} />
          ))}
        </div>
      );
    }
    // datahora
    const selectedISO = values.datahora ? wizToLocalInput(values.datahora) : '';
    return (
      <div className="space-y-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Horários sugeridos</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {quickSlots.map((s, i) => (
              <WizPill key={s.id} index={i} label={s.label} hint={s.time} color={color}
                selected={values.datahora && wizToLocalInput(values.datahora) === wizToLocalInput(s.date)}
                onClick={() => setVal('datahora', s.date)} />
            ))}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Ou escolha manualmente</div>
          <div className="relative">
            <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input type="datetime-local" value={selectedISO}
              onChange={(e) => setVal('datahora', e.target.value ? new Date(e.target.value) : null)}
              className="w-full h-11 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-slate-400 dark:focus:border-white/20 outline-none text-[13.5px] num pl-9 pr-3 transition" />
          </div>
        </div>
      </div>
    );
  };

  const renderStepRow = (stepId, n, isLast) => {
    const info = WIZ_STEP_INFO[stepId];
    const t = WIZ_TONES[color] || WIZ_TONES.brand;
    const state = stepState(stepId);
    const summary = summaryFor(stepId);
    return (
      <div key={stepId} className="relative flex gap-3">
        <div className="flex flex-col items-center">
          <WizStepDot state={state} n={n} color={color} />
          {!isLast && <div className={`conn w-px flex-1 mt-1 mb-1 ${state === 'done' ? t.strong : 'bg-slate-200 dark:bg-white/[0.08]'}`} />}
        </div>
        <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-5'}`}>
          {state === 'locked' ? (
            <div className="pt-0.5 opacity-50 select-none">
              <div className="text-[13.5px] font-semibold text-slate-400 dark:text-slate-500">{info.title}</div>
            </div>
          ) : state === 'done' ? (
            <button type="button" onClick={() => setEditing(stepId)}
              className="sum-in w-full text-left group rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] px-3.5 py-2.5 hover:border-slate-300 dark:hover:border-white/10 transition flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{info.title}</div>
                <div className={`text-[13.5px] font-semibold ${t.text} ${t.darkText} truncate mt-0.5`}>{summary}</div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 whitespace-nowrap shrink-0"><RefreshCw size={12} /> Editar</span>
            </button>
          ) : (
            <div className="step-reveal pt-0.5">
              <div className="mb-2.5">
                <div className="text-[14px] font-semibold text-slate-900 dark:text-white">{info.title}</div>
                {info.hint && <div className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">{info.hint}</div>}
              </div>
              {renderStepBody(stepId)}
            </div>
          )}
        </div>
      </div>
    );
  };

  const t = WIZ_TONES[color] || WIZ_TONES.brand;
  const summaryParts = [];
  if (values.modalidade) summaryParts.push(values.modalidade);
  if (values.quantidade) summaryParts.push(`${values.quantidade} ${values.quantidade === 1 ? 'aula' : 'aulas'}`);
  if (values.unidade) summaryParts.push(`Unidade ${values.unidade}`);
  const doneCount = flow.filter(s => values[s] != null && values[s] !== '').length + 1;
  const totalCount = flow.length + 1;

  const handleConfirm = () => {
    if (!complete || !type) return;
    onConfirm({
      typeId: type.id,
      typeLabel: type.followUpLabel,
      date: values.datahora,
      modalidade: type.id === 'aula' ? (values.modalidade || null) : null,
      quantidade: type.id === 'aula' ? (values.quantidade || null) : null,
      unidade: type.id === 'visita' ? (values.unidade || null) : null,
      note: note.trim()
    });
    resetAll();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-6">
      {/* stepper */}
      <div className="min-w-0">
        <div className="relative flex gap-3">
          <div className="flex flex-col items-center">
            <WizStepDot state={type ? 'done' : 'active'} n={1} color={color} />
            <div className={`conn w-px flex-1 mt-1 mb-1 ${type ? t.strong : 'bg-slate-200 dark:bg-white/[0.08]'}`} />
          </div>
          <div className="flex-1 min-w-0 pb-5">
            {type ? (
              <button type="button" onClick={() => pickType(null)}
                className="sum-in w-full text-left group rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] px-3.5 py-2.5 hover:border-slate-300 dark:hover:border-white/10 transition flex items-center gap-3">
                <span className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${t.strong} text-white`}><type.Icon size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Tipo de agendamento</div>
                  <div className={`text-[13.5px] font-semibold ${t.text} ${t.darkText} truncate`}>{type.label}</div>
                </div>
                <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 whitespace-nowrap shrink-0"><RefreshCw size={12} /> Trocar</span>
              </button>
            ) : (
              <div className="step-reveal pt-0.5">
                <div className="mb-2.5">
                  <div className="text-[14px] font-semibold text-slate-900 dark:text-white">O que você quer agendar?</div>
                  <div className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">Escolha o tipo para liberar os próximos passos.</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {WIZ_TYPES.map((tp, i) => (
                    <WizOptionCard key={tp.id} index={i} Icon={tp.Icon} label={tp.label} hint={tp.desc} color={tp.color}
                      selected={false} onClick={() => pickType(tp.id)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {flow.map((stepId, i) => renderStepRow(stepId, i + 2, i === flow.length - 1))}

        {type && (
          <div className="mt-5 pt-5 border-t border-slate-100 dark:border-white/[0.06] step-reveal">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Anotação (opcional)</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="O que precisa ser tratado nesse contato?"
              className="w-full rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-slate-300 dark:focus:border-white/15 outline-none text-[13px] p-3 placeholder:text-slate-400 resize-none transition" />
          </div>
        )}
      </div>

      {/* summary + actions */}
      <aside className="lg:sticky lg:top-4 self-start space-y-3">
        {type ? (
          <div className={`rounded-xl border p-3.5 ${complete ? `${t.soft} ${t.darkSoft} border-transparent` : 'bg-slate-50 border-slate-200 dark:bg-white/[0.02] dark:border-white/[0.06]'}`}>
            <div className="flex items-start gap-3">
              <span className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${complete ? `${t.strong} text-white` : 'bg-white text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'}`}><type.Icon size={16} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Resumo do agendamento</div>
                <div className="text-[14px] font-semibold text-slate-900 dark:text-white mt-0.5">{type.label}</div>
                {summaryParts.length > 0 && <div className="text-[12px] text-slate-600 dark:text-slate-300 mt-0.5">{summaryParts.join(' · ')}</div>}
                {values.datahora ? (
                  <div className={`inline-flex items-center gap-1.5 mt-2 text-[12.5px] font-semibold ${t.text} ${t.darkText}`}><Calendar size={13} /> {wizFmtDateTime(values.datahora)}</div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 mt-2 text-[12px] text-slate-400 dark:text-slate-500"><Clock size={12} /> Falta definir dia e horário</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/[0.1] p-5 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/[0.05] grid place-items-center mx-auto mb-2 text-slate-400"><Calendar size={18} /></div>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">Escolha o tipo de agendamento para começar.</p>
          </div>
        )}

        {type && (
          <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Progresso</span>
              <span className="num text-[11.5px] font-semibold text-slate-700 dark:text-slate-200">{doneCount}/{totalCount}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.05] overflow-hidden">
              <div className={`h-full ${t.strong}`} style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%`, transition: 'width .4s' }} />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Btn kind="brand" icon={<Check size={15} />} disabled={!complete || submitting} onClick={handleConfirm}>
            {submitting ? 'Salvando...' : complete ? 'Confirmar agendamento' : 'Complete os passos'}
          </Btn>
          <Btn kind="soft" onClick={() => { resetAll(); onCancel && onCancel(); }}>Cancelar</Btn>
        </div>
      </aside>
    </div>
  );
}

function LeadDetailsModal({ lead, interactions, onClose, appUser, statuses, tags, lossReasons, usersList, db, funnels }) {
  const toast = useToast();
  const isReadOnly = !canEditLead(appUser, lead);
  const safeFunnels = Array.isArray(funnels) ? funnels : [];
  const fallbackFunnelId = lead.funnelId || getDefaultFunnel(safeFunnels)?.id || null;

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: lead.name, whatsapp: lead.whatsapp, source: lead.source, observation: lead.observation || '', tags: lead.tags || [], consultantId: lead.consultantId || '' });
  const [note, setNote] = useState('');
  const [status, setStatus] = useState(lead.status);
  const [funnelId, setFunnelId] = useState(fallbackFunnelId);
  const [loading, setLoading] = useState(false);
  // Agendamento agora é feito pelo ScheduleWizard (aba "Agendar" do composer).

  const [lossModalOpen, setLossModalOpen] = useState(false);

  // Composer tab — drives which form is shown in the activity Composer card.
  const [composerTab, setComposerTab] = useState('note');

  // Timeline filter + search
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [timelineQuery, setTimelineQuery] = useState('');

  const statusesForFunnel = (statuses || []).filter(s => s.funnelId === funnelId);

  useEffect(() => {
    setEditData({ name: lead.name, whatsapp: lead.whatsapp, source: lead.source, observation: lead.observation || '', tags: lead.tags || [], consultantId: lead.consultantId || '' });
    setStatus(lead.status);
    setFunnelId(lead.funnelId || getDefaultFunnel(safeFunnels)?.id || null);
  }, [lead]);

  const handleFunnelChange = (newFunnelId) => {
    setFunnelId(newFunnelId);
    // Se o lead estava em uma etapa que não existe no novo funil, alinhar para a primeira
    const nextStatuses = (statuses || []).filter(s => s.funnelId === newFunnelId);
    if (status !== 'Venda' && status !== 'Perda') {
      const stillValid = nextStatuses.some(s => s.name === status);
      if (!stillValid) {
        setStatus(nextStatuses[0]?.name || status);
      }
    }
  };

  const handleWhatsApp = () => { 
    let n = lead.whatsapp.replace(/\D/g, ''); 
    if(n.length <= 11) n='55'+n; 
    window.open(`https://wa.me/${n}?text=Ol%C3%A1%20${encodeURIComponent(lead.name)}`); 
  };
  

  const handleDelete = async () => {
    if (!window.confirm("⚠️ AÇÃO IRREVERSÍVEL: Deseja EXCLUIR este lead permanentemente?")) return;
    setLoading(true);
    try {
      // Apaga as interações ligadas ao lead (senão ficam órfãs na coleção).
      // Em lotes de 450 (limite do writeBatch é 500) para suportar qualquer volume.
      const interSnap = await getDocs(query(
        collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH),
        where('leadId', '==', lead.id)
      ));
      const interDocs = interSnap.docs;
      for (let i = 0; i < interDocs.length; i += 450) {
        const batch = writeBatch(db);
        interDocs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id));
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao excluir o lead. Tente novamente.');
      setLoading(false);
    }
  };

  const handleUpdateLead = async () => {
    if (isReadOnly) { toast.warning('Você não tem permissão para editar este lead.'); return; }
    setLoading(true);
    try {
      let finalData = { ...editData };
      if (finalData.consultantId) {
        const c = (usersList || []).find(u => u.id === finalData.consultantId);
        if (c) finalData.consultantName = c.name;
      }
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), finalData);
      setIsEditing(false);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleWin = async () => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (!window.confirm("Confirmar matrícula deste lead?")) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), {
        status: 'Venda',
        nextFollowUp: null,
        isConverted: true,
        convertedAt: serverTimestamp(),
        // Limpa resquício caso o lead viesse de Perda.
        lossReason: null,
        lostAt: null
      });
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: `Matrícula realizada com sucesso! (Venda)`,
        type: 'status_change',
        createdAt: serverTimestamp()
      });
      setStatus('Venda');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao registrar a matrícula. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const confirmLoss = async (reason) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    setLoading(true);
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), {
        status: 'Perda',
        lossReason: reason,
        nextFollowUp: null,
        lostAt: serverTimestamp(),
        // Limpa resquício caso o lead viesse de Venda.
        isConverted: false,
        convertedAt: null
      });
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: `Lead perdido. Motivo: ${reason}`,
        type: 'status_change',
        createdAt: serverTimestamp()
      });
      setLossModalOpen(false);
      setStatus('Perda');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao registrar a perda. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Anotação / Mudar fase / Mover funil. O agendamento é tratado pelo
  // ScheduleWizard via handleWizardConfirm.
  const saveInteraction = async () => {
    if (isReadOnly) { toast.warning('Você não tem permissão para registrar interações neste lead.'); return; }
    const funnelChanged = Boolean(lead.funnelId) && funnelId && funnelId !== lead.funnelId;
    if (!note.trim() && status === lead.status && !funnelChanged) return;
    setLoading(true);
    try {
      let actionText = '';
      if (funnelChanged) {
        const newFunnelName = safeFunnels.find(f => f.id === funnelId)?.name || 'outro funil';
        actionText += `Lead movido para o funil [${newFunnelName}]. `;
      }
      if (status !== lead.status) actionText += `Fase alterada para [${status}]. `;
      if (note) actionText += `Obs: ${note}. `;

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: actionText || 'Atualização registrada.',
        type: (status !== lead.status || funnelChanged) ? 'status_change' : 'note',
        createdAt: serverTimestamp()
      });

      const up = { status };
      if (funnelChanged) up.funnelId = funnelId;
      // Saindo de Venda/Perda para outra fase: limpa os campos de
      // resolução, senão o lead segue contando como matrícula/perda.
      if (lead.status === 'Venda' && status !== 'Venda') {
        up.isConverted = false;
        up.convertedAt = null;
      }
      if (lead.status === 'Perda' && status !== 'Perda') {
        up.lossReason = null;
        up.lostAt = null;
      }
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), up, { merge: true });

      setNote('');
      setLoading(false);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar.');
      setLoading(false);
    }
  };

  // Grava o agendamento montado no ScheduleWizard. Mantém os campos canônicos
  // (nextFollowUp/nextFollowUpType/appointmentType/appointmentScheduledFor) e
  // grava os extras por tipo (modalidade+quantidade p/ aula; unidade p/ visita).
  const handleWizardConfirm = async ({ typeLabel, date, modalidade, quantidade, unidade, note: wizNote }) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para agendar neste lead.'); return; }
    if (!(date instanceof Date) || isNaN(date.getTime())) { toast.warning('Selecione o dia e o horário.'); return; }
    setLoading(true);
    try {
      const appointmentType = normalizeAppointmentType(typeLabel); // 'visita' | 'aula_experimental' | null
      const isAula = appointmentType === 'aula_experimental';
      const isVisita = appointmentType === 'visita';

      let extra = '';
      if (isAula) {
        const q = quantidade || 1;
        extra = ` (${modalidade ? modalidade + ' · ' : ''}${q} ${q === 1 ? 'aula' : 'aulas'})`;
      } else if (isVisita && unidade) {
        extra = ` (Unidade ${unidade})`;
      }
      const dateStr = date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const noteStr = (wizNote || '').trim();
      const text = `🔔 ${typeLabel} agendada${extra} p/ ${dateStr}.` + (noteStr ? ` Obs: ${noteStr}` : '');

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text,
        type: 'note',
        createdAt: serverTimestamp()
      });

      const up = {
        nextFollowUp: date,
        nextFollowUpType: typeLabel,
        // Observação do agendamento, exibida no card da Meta Diária.
        nextFollowUpNote: noteStr || null,
        // Limpa extras de agendamentos anteriores e grava só os do tipo atual.
        appointmentModality: isAula ? (modalidade || null) : null,
        trialClassesPlanned: isAula ? (quantidade || null) : null,
        appointmentUnit: isVisita ? (unidade || null) : null,
        appointmentType: appointmentType || null,
        appointmentScheduledFor: appointmentType ? date : null
      };
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), up, { merge: true });

      toast.success(`Agendamento criado para ${dateStr}.`);
      setComposerTab('note');
      setLoading(false);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar o agendamento.');
      setLoading(false);
    }
  };

  // Composer tab handlers — each maps to the existing Firestore patterns.
  const handleSendWhatsAppMessage = async () => {
    if (isReadOnly) { toast.warning('Você não tem permissão para registrar interações neste lead.'); return; }
    const msg = note.trim();
    if (!msg) { toast.warning('Escreva a mensagem antes de enviar.'); return; }
    setLoading(true);
    try {
      // Open WhatsApp Web with the typed message
      const num = String(lead.whatsapp || '').replace(/\D/g, '');
      const phone = num.length <= 11 ? '55' + num : num;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
      // Log the outbound message in the timeline
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: `📲 Mensagem WhatsApp enviada: ${msg}`,
        type: 'note',
        createdAt: serverTimestamp()
      });
      setNote('');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível registrar o envio.');
    }
    setLoading(false);
  };

  const handleLogCall = async () => {
    if (isReadOnly) { toast.warning('Você não tem permissão para registrar interações neste lead.'); return; }
    const summary = note.trim();
    if (!summary) { toast.warning('Resuma o que rolou na ligação antes de salvar.'); return; }
    setLoading(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: `📞 Ligação: ${summary}`,
        type: 'note',
        createdAt: serverTimestamp()
      });
      setNote('');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível registrar a ligação.');
    }
    setLoading(false);
  };

  const handleComposerSubmit = () => {
    if (composerTab === 'whatsapp') return handleSendWhatsAppMessage();
    if (composerTab === 'call')     return handleLogCall();
    // 'note' e 'status' fluem pelo saveInteraction. 'schedule' é tratado pelo
    // próprio ScheduleWizard (tem seus botões).
    return saveInteraction();
  };

  const composerSubmitLabel =
    composerTab === 'whatsapp' ? 'Enviar' :
    composerTab === 'status'   ? 'Salvar fase' :
    'Salvar';

  const resetComposer = () => {
    setNote('');
    setStatus(lead.status);
    setFunnelId(fallbackFunnelId);
  };

  // Rendered via Portal at <body> level — escapes the <main>/header stacking
  // context where the global topbar's backdrop-blur creates its own layer and
  // would otherwise sit above this modal regardless of z-index.
  // ----- Derived computations for the redesigned shell -----
  const firstName = (lead.name || '').split(' ')[0] || 'lead';
  const ageDays = lead.createdAt
    ? Math.max(0, Math.floor((Date.now() - lead.createdAt.getTime()) / 86400000))
    : 0;
  const statusChangeCount = (interactions || []).filter(i => i.type === 'status_change').length;

  const groupTimeline = (events) => {
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

  // Classify each interaction into one of the 5 design filter buckets.
  // Inference uses both the `type` field and prefixes injected by the composer.
  const classifyInteraction = (i) => {
    const t = String(i.text || '');
    if (i.type === 'status_change') return 'status';
    if (/^📲|whatsapp enviada/i.test(t) || /^📞/.test(t)) return 'conversation';
    if (/retorno agendado|🔔/i.test(t)) return 'appointment';
    if (/observação do cadastro|csat/i.test(t)) return 'system';
    if (i.type === 'note') return 'note';
    return 'system';
  };

  const TIMELINE_FILTERS = [
    { id: 'all',          label: 'Tudo' },
    { id: 'conversation', label: 'Conversas' },
    { id: 'status',       label: 'Mudanças' },
    { id: 'appointment',  label: 'Agendamentos' },
    { id: 'note',         label: 'Anotações' },
    { id: 'system',       label: 'Sistema' }
  ];

  const interactionsWithClass = (interactions || []).map(i => ({ ...i, _kind: classifyInteraction(i) }));

  const timelineCounts = (() => {
    const counts = { all: interactionsWithClass.length, conversation: 0, status: 0, appointment: 0, note: 0, system: 0 };
    interactionsWithClass.forEach(i => { counts[i._kind] = (counts[i._kind] || 0) + 1; });
    return counts;
  })();

  const filteredInteractions = (() => {
    let list = timelineFilter === 'all' ? interactionsWithClass : interactionsWithClass.filter(i => i._kind === timelineFilter);
    const q = timelineQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(i => `${i.text || ''} ${i.consultantName || ''}`.toLowerCase().includes(q));
    }
    return list;
  })();

  const groupedEvents = groupTimeline(filteredInteractions);

  // Detect appointment metadata embedded in an interaction's text so the
  // timeline can render the highlighted appointment card. Returns
  // `{ kind, label, when }` or null.
  const parseAppointment = (i) => {
    const t = String(i.text || '');
    if (!/retorno agendado|🔔/i.test(t)) return null;
    const typeMatch = t.match(/Retorno agendado \(([^)]+)\)/i);
    const dateMatch = t.match(/p\/\s*([\d/]+(?:[,\s]+[\d:]+)?)/i);
    const kindRaw = typeMatch ? typeMatch[1] : '';
    const lower = kindRaw.toLowerCase();
    let kind = 'follow', label = kindRaw || 'Próximo contato';
    if (lower.includes('aula')) { kind = 'class'; label = 'Aula experimental'; }
    else if (lower.includes('visita')) { kind = 'visit'; label = 'Visita à unidade'; }
    else if (lower.includes('ligação') || lower.includes('ligacao')) { kind = 'call'; label = 'Ligação'; }
    else if (lower.includes('mensagem')) { kind = 'message'; label = 'Mensagem'; }
    let when = null;
    if (dateMatch) {
      const raw = dateMatch[1].trim();
      const [datePart, timePart] = raw.split(/[,\s]+/);
      const dParts = (datePart || '').split('/');
      if (dParts.length === 3) {
        const [day, month, year] = dParts.map(n => parseInt(n, 10));
        const [hh, mm] = (timePart || '00:00').split(':').map(n => parseInt(n, 10) || 0);
        when = new Date(year, month - 1, day, hh, mm);
        if (isNaN(when.getTime())) when = null;
      }
    }
    return { kind, label, when };
  };

  return createPortal(
    <>
      {/* Backdrop: blur + dark overlay over the page behind the modal. Click to close. */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[100] bg-slate-900/40 dark:bg-black/60 backdrop-blur-md animate-fade-in"
      />
      <div className="fixed inset-0 z-[101] bg-paper-50 dark:bg-ink-950 md:inset-y-4 md:inset-x-4 md:rounded-3xl flex flex-col overflow-hidden animate-fade-in shadow-2xl font-sans">

        {/* TOP BAR */}
        <header className="h-16 border-b border-slate-200 dark:border-white/[0.06] bg-white/80 dark:bg-ink-900/70 backdrop-blur flex items-center justify-between gap-3 px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onClose} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12.5px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] whitespace-nowrap transition">
              <ChevronRight size={14} className="rotate-180" /> Todos os leads
            </button>
            <span className="text-slate-300 dark:text-white/15 shrink-0">/</span>
            <span className="text-[14px] font-semibold truncate">{lead.name}</span>
            <StatusBadge statusName={lead.status} statusesArray={statuses} />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!isEditing && !isReadOnly && (
              <Btn kind="secondary" icon={<RefreshCw size={13} />} onClick={() => setIsEditing(true)}>Editar</Btn>
            )}
            {!isEditing && (
              <Btn
                kind="success"
                icon={<TrendingUp size={13} />}
                onClick={handleWin}
                disabled={lead.status === 'Venda' || loading}
                title={lead.status === 'Venda' ? 'Lead já marcado como venda' : 'Marcar venda'}
              >
                Marcar venda
              </Btn>
            )}
            {!isEditing && (
              <Btn
                kind="danger"
                icon={<Ban size={13} />}
                onClick={() => setLossModalOpen(true)}
                disabled={lead.status === 'Perda' || loading}
                title={lead.status === 'Perda' ? 'Lead já marcado como perda' : 'Marcar perda'}
              >
                Marcar perda
              </Btn>
            )}
            <div className="w-px h-6 bg-slate-200 dark:bg-white/[0.08] mx-1"></div>
            {!isEditing && isAdminUser(appUser) && (
              <IconBtn icon={<Trash size={15} />} kind="danger" title="Excluir lead" onClick={handleDelete} />
            )}
            <IconBtn icon={<X size={15} />} title="Fechar" onClick={onClose} />
          </div>
        </header>

        {/* BODY: scrollable content with 12-col grid */}
        <div className="flex-1 overflow-y-auto thin-scroll">
          <div className="max-w-[1320px] mx-auto px-4 md:px-8 py-6">
            <div className="grid grid-cols-12 gap-6">

              {/* LEFT: Lead Summary (sticky) */}
              <div className="col-span-12 lg:col-span-4 xl:col-span-3">
                {isEditing ? (
                  <aside className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-card p-5 space-y-4 lg:sticky lg:top-4">
                    <h3 className="text-[15px] font-semibold">Editar cadastro</h3>
                    <Field label="Nome completo">
                      <StyledInput value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} />
                    </Field>
                    <Field label="WhatsApp">
                      <StyledInput type="tel" value={editData.whatsapp} onChange={e => setEditData({ ...editData, whatsapp: e.target.value })} />
                    </Field>
                    <Field label="Origem">
                      <StyledInput value={editData.source} onChange={e => setEditData({ ...editData, source: e.target.value })} />
                    </Field>
                    <Field label="Consultor responsável">
                      <StyledSelect value={editData.consultantId} onChange={e => setEditData({ ...editData, consultantId: e.target.value })}>
                        <option value="">Selecione um consultor...</option>
                        {(usersList || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </StyledSelect>
                    </Field>
                    <Field label="Etiquetas">
                      <div className="flex flex-wrap gap-1.5">
                        {(tags || []).map(t => {
                          const active = editData.tags.includes(t.name);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setEditData(prev => ({ ...prev, tags: active ? prev.tags.filter(x => x !== t.name) : [...prev.tags, t.name] }))}
                              className={`px-2 py-1 rounded-md text-[11.5px] font-semibold border transition ${
                                active
                                  ? 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 dark:bg-white/[0.03] dark:text-slate-300 dark:border-white/[0.07]'
                              }`}
                            >
                              {t.name}
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                    <Field label="Observação fixa (contexto inicial)">
                      <textarea
                        value={editData.observation}
                        onChange={e => setEditData({ ...editData, observation: e.target.value })}
                        rows={4}
                        className="w-full rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] p-3 placeholder:text-slate-400 transition resize-none"
                      />
                    </Field>
                    <div className="flex gap-2 pt-2">
                      <Btn kind="soft" onClick={() => setIsEditing(false)} className="flex-1">Cancelar</Btn>
                      <Btn kind="brand" icon={<Check size={13} />} onClick={handleUpdateLead} disabled={loading}>Salvar</Btn>
                    </div>
                  </aside>
                ) : (
                  <aside className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-card overflow-hidden lg:sticky lg:top-4">
                    <div className="p-5">
                      <div className="flex items-center gap-4">
                        <Avatar name={lead.name} size={56} />
                        <div className="min-w-0 flex-1">
                          <h2 className="font-display text-[20px] font-semibold tracking-tight truncate">{lead.name}</h2>
                          <button
                            onClick={handleWhatsApp}
                            className="text-[12.5px] text-brand-600 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200 font-medium num inline-flex items-center gap-1 transition"
                            title="Abrir no WhatsApp"
                          >
                            <Phone size={11} /> {lead.whatsapp}
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-1.5">
                        {(lead.tags || []).map(tName => (
                          <TagBadge key={tName} tagName={tName} tagsArray={tags} />
                        ))}
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <Btn kind="primary" icon={<MessageCircle size={14} />} onClick={handleWhatsApp}>WhatsApp</Btn>
                        <Btn kind="secondary" icon={<Phone size={14} />} onClick={() => { const num = String(lead.whatsapp || '').replace(/\D/g, ''); if (num) window.location.href = `tel:${num}`; }}>Ligar</Btn>
                      </div>
                    </div>

                    {/* Mini stats */}
                    <div className="px-5 py-4 grid grid-cols-3 gap-3 border-t border-slate-100 dark:border-white/[0.05]">
                      <div className="text-center">
                        <div className="num text-[18px] font-semibold tracking-tight leading-none">{ageDays}d</div>
                        <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1 whitespace-nowrap">Idade do lead</div>
                      </div>
                      <div className="text-center">
                        <div className="num text-[18px] font-semibold tracking-tight leading-none">{(interactions || []).length}</div>
                        <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1 whitespace-nowrap">Interações</div>
                      </div>
                      <div className="text-center">
                        <div className="num text-[18px] font-semibold tracking-tight leading-none">{statusChangeCount + 1}</div>
                        <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1 whitespace-nowrap">Etapas</div>
                      </div>
                    </div>

                    {/* Info rows */}
                    <div className="px-5 py-4 border-t border-slate-100 dark:border-white/[0.05] space-y-3.5">
                      <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-lg grid place-items-center bg-slate-100 text-slate-500 dark:bg-white/[0.05] dark:text-slate-400 shrink-0"><Tag size={13} /></span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">Origem</div>
                          <div className="text-[13px] text-slate-800 dark:text-slate-100 mt-0.5">{lead.source || '—'}</div>
                        </div>
                      </div>
                      {lead.consultantName && (
                        <div className="flex items-start gap-3">
                          <span className="w-7 h-7 rounded-lg grid place-items-center bg-slate-100 text-slate-500 dark:bg-white/[0.05] dark:text-slate-400 shrink-0"><Users size={13} /></span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">Consultor</div>
                            <div className="text-[13px] text-slate-800 dark:text-slate-100 mt-0.5 inline-flex items-center gap-2">
                              <Avatar name={lead.consultantName} size={20} />
                              <span className="truncate">{lead.consultantName}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-lg grid place-items-center bg-slate-100 text-slate-500 dark:bg-white/[0.05] dark:text-slate-400 shrink-0"><Calendar size={13} /></span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">Cadastrado em</div>
                          <div className="text-[13px] text-slate-800 dark:text-slate-100 mt-0.5 num">
                            {lead.createdAt?.toLocaleDateString('pt-BR') || '—'}
                            {lead.createdAt && <> · {lead.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-lg grid place-items-center bg-slate-100 text-slate-500 dark:bg-white/[0.05] dark:text-slate-400 shrink-0"><Clock size={13} /></span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">Próximo contato</div>
                          <div className="text-[13px] mt-0.5">
                            {lead.nextFollowUp ? (
                              <span className="num font-medium text-slate-800 dark:text-slate-100">
                                {lead.nextFollowUp.toLocaleDateString('pt-BR')} às {lead.nextFollowUp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : (
                              <span className="italic text-slate-400 dark:text-slate-500">Sem agendamento</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Loss banner */}
                    {lead.status === 'Perda' && lead.lossReason && (
                      <div className="mx-5 mb-4 p-3 rounded-xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 flex items-start gap-2.5">
                        <ThumbsDown size={14} className="text-rose-600 dark:text-rose-300 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">Motivo da perda</p>
                          <p className="text-[12.5px] font-medium text-rose-800 dark:text-rose-200 mt-0.5">{lead.lossReason}</p>
                        </div>
                      </div>
                    )}

                    {/* Observação */}
                    <div className="px-5 py-4 border-t border-slate-100 dark:border-white/[0.05]">
                      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">Contexto inicial</div>
                      <p className="text-[12.5px] leading-relaxed text-slate-700 dark:text-slate-200">
                        {lead.observation || <span className="italic text-slate-400">Nenhuma observação registrada no momento do cadastro.</span>}
                      </p>
                    </div>

                  </aside>
                )}
              </div>

              {/* RIGHT: Timeline */}
              <div className="col-span-12 lg:col-span-8 xl:col-span-9 min-w-0 space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    <Clock size={13} className="text-brand-600" /> Linha do tempo
                  </div>
                  <h2 className="mt-1.5 font-display text-[22px] font-semibold tracking-tight leading-tight">
                    Jornada de {firstName}
                  </h2>
                  <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
                    Todas as interações, agendamentos e mudanças de fase em ordem cronológica.
                  </p>
                </div>

                {/* Composer with tabs */}
                <section className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-card">
                  {/* Tabs */}
                  <div className="px-4 pt-3 flex items-center gap-1 border-b border-slate-100 dark:border-white/[0.05] overflow-x-auto thin-scroll">
                    {[
                      { id: 'note',     label: 'Anotação',   icon: <MessageCircle size={13} /> },
                      { id: 'whatsapp', label: 'WhatsApp',   icon: <MessageCircle size={13} /> },
                      { id: 'call',     label: 'Ligação',    icon: <Phone size={13} /> },
                      { id: 'status',   label: 'Mudar fase', icon: <RefreshCw size={13} /> },
                      { id: 'schedule', label: 'Agendar',    icon: <Calendar size={13} /> }
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setComposerTab(t.id)}
                        className={`inline-flex items-center gap-1.5 h-9 px-3 text-[12.5px] font-medium rounded-t-md transition border-b-2 -mb-px whitespace-nowrap ${
                          composerTab === t.id
                            ? 'text-slate-900 dark:text-white border-brand-600'
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border-transparent'
                        }`}
                      >
                        {t.icon}{t.label}
                      </button>
                    ))}
                  </div>

                  {/* Body */}
                  <div className="p-4">
                    <div className="flex gap-3">
                      <Avatar name={appUser?.name || 'Você'} size={32} />
                      <div className="flex-1 min-w-0 space-y-3">

                        {composerTab === 'note' && (
                          <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="O que rolou nessa conversa? Detalhes que vão te ajudar no próximo contato..."
                            rows={3}
                            className="w-full rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] p-3 placeholder:text-slate-400 transition resize-none"
                          />
                        )}

                        {composerTab === 'whatsapp' && (
                          <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder={`Mensagem para ${firstName}...`}
                            rows={3}
                            className="w-full rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] p-3 placeholder:text-slate-400 transition resize-none"
                          />
                        )}

                        {composerTab === 'call' && (
                          <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Resumo da ligação, próximos passos..."
                            rows={3}
                            className="w-full rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] p-3 placeholder:text-slate-400 transition resize-none"
                          />
                        )}

                        {composerTab === 'status' && (
                          <div className="space-y-3">
                            {safeFunnels.length > 1 && (
                              <Field label="Funil" hint={funnelId && funnelId !== (lead.funnelId || null) ? 'Ao mudar o funil, a etapa será redefinida para a primeira do novo funil.' : null}>
                                <StyledSelect value={funnelId || ''} onChange={e => handleFunnelChange(e.target.value)}>
                                  {safeFunnels.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </StyledSelect>
                              </Field>
                            )}
                            <Field label="Fase do funil">
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                                {statusesForFunnel.map(s => {
                                  const t = settingsColorTone(s.color || 'blue');
                                  const active = status === s.name;
                                  return (
                                    <button
                                      key={s.id}
                                      type="button"
                                      onClick={() => setStatus(s.name)}
                                      className={`h-9 px-2.5 rounded-lg border text-[12px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition ${
                                        active
                                          ? `${t.soft} ${t.text} ${t.darkSoft} ${t.darkText} border-transparent ring-1 ring-current/30`
                                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 dark:bg-white/[0.02] dark:border-white/[0.07] dark:text-slate-300'
                                      }`}
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`}></span>
                                      {s.name}
                                    </button>
                                  );
                                })}
                                {!statusesForFunnel.some(s => s.name === status) && status && (
                                  <span className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-white/[0.07] text-[12px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap text-slate-500 dark:text-slate-400 italic">
                                    {status} (atual)
                                  </span>
                                )}
                              </div>
                            </Field>
                            <Field label="Observação (opcional)">
                              <textarea
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder="Motivo da mudança, contexto..."
                                rows={2}
                                className="w-full rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] p-3 placeholder:text-slate-400 transition resize-none"
                              />
                            </Field>
                          </div>
                        )}

                        {composerTab === 'schedule' && (
                          <ScheduleWizard onConfirm={handleWizardConfirm} onCancel={resetComposer} submitting={loading} />
                        )}

                        {composerTab !== 'schedule' && (
                          <div className="flex items-center gap-1.5 pt-1">
                            <div className="flex-1"></div>
                            <Btn kind="soft" onClick={resetComposer} disabled={loading}>Cancelar</Btn>
                            <Btn kind="brand" icon={<Check size={13} />} onClick={handleComposerSubmit} disabled={loading}>
                              {composerSubmitLabel}
                            </Btn>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Timeline filters + search */}
                {(interactions || []).length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07]">
                      {TIMELINE_FILTERS.map(f => {
                        const active = timelineFilter === f.id;
                        const c = timelineCounts[f.id] || 0;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setTimelineFilter(f.id)}
                            className={`h-7 px-2.5 rounded-md text-[12px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition ${
                              active
                                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                            }`}
                          >
                            {f.label}
                            <span className={`num text-[10.5px] px-1 h-[15px] rounded grid place-items-center min-w-[15px] ${
                              active
                                ? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900'
                                : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'
                            }`}>{c}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex-1"></div>
                    <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        value={timelineQuery}
                        onChange={e => setTimelineQuery(e.target.value)}
                        placeholder="Buscar na linha do tempo..."
                        className="h-9 w-64 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[12.5px] pl-8 pr-3 placeholder:text-slate-400 transition"
                      />
                    </div>
                  </div>
                )}

                {/* Timeline */}
                {(interactions || []).length === 0 ? (
                  <div className="py-16 grid place-items-center text-slate-400">
                    <Clock size={22} className="opacity-40 mb-2" />
                    <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Nenhum evento por aqui ainda</p>
                    <p className="text-[12.5px]">Registre a primeira atividade acima.</p>
                  </div>
                ) : filteredInteractions.length === 0 ? (
                  <div className="py-16 grid place-items-center text-slate-400">
                    <Search size={22} className="opacity-40 mb-2" />
                    <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Nenhum evento por aqui</p>
                    <p className="text-[12.5px]">Tente ajustar o filtro ou a busca.</p>
                  </div>
                ) : (
                  <div className="space-y-6 pb-4">
                    {groupedEvents.map(([label, events]) => (
                      <section key={label}>
                        <header className="mb-2 px-1 py-1.5 sticky top-0 bg-paper-50/95 dark:bg-ink-950/95 backdrop-blur z-[1]">
                          <div className="flex items-center gap-2 pl-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">{label}</span>
                            {events[0]?.createdAt && (
                              <span className="text-[11.5px] text-slate-400 dark:text-slate-500 num whitespace-nowrap">· {events[0].createdAt.toLocaleDateString('pt-BR')}</span>
                            )}
                            <div className="flex-1 h-px bg-slate-200/80 dark:bg-white/[0.06] ml-1"></div>
                            <span className="text-[11px] num text-slate-400 dark:text-slate-500 whitespace-nowrap">{events.length} {events.length === 1 ? 'evento' : 'eventos'}</span>
                          </div>
                        </header>
                        <div className="relative">
                          <div className="absolute left-[18px] top-0 bottom-0 w-px bg-slate-200 dark:bg-white/[0.08]"></div>
                          <div className="space-y-1">
                            {events.map((i) => {
                              const visual = getInteractionVisual(i, statuses);
                              const Icon = visual.icon;
                              const appt = parseAppointment(i);
                              const isAppointment = i._kind === 'appointment';
                              return (
                                <article key={i.id} className="relative pl-12 pr-2 py-2.5 fade-in group">
                                  <div className={`absolute left-0 top-2.5 z-10 w-9 h-9 rounded-full grid place-items-center shrink-0 ring-4 ring-paper-50 dark:ring-ink-950 ${
                                    isAppointment
                                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                                      : visual.dot
                                  }`}>
                                    {isAppointment ? <Calendar className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Avatar name={i.consultantName || 'Sistema'} size={20} />
                                    <span className="text-[13px] font-semibold text-slate-900 dark:text-white whitespace-nowrap">{i.consultantName || 'Sistema'}</span>
                                    {isAppointment ? (
                                      <span className="text-[12px] text-brand-700 dark:text-brand-300 whitespace-nowrap">criou um agendamento</span>
                                    ) : visual.stageName ? (
                                      <span className="text-[12px] text-slate-500 dark:text-slate-400 whitespace-nowrap">moveu para</span>
                                    ) : (
                                      <span className={`text-[12px] whitespace-nowrap ${visual.meta || 'text-slate-500 dark:text-slate-400'}`}>{visual.label}</span>
                                    )}
                                    {visual.stageName && <StatusBadge statusName={visual.stageName} statusesArray={statuses} />}
                                    <span className="flex-1"></span>
                                    <span className="text-[11.5px] num text-slate-400 dark:text-slate-500 whitespace-nowrap" title={i.createdAt?.toLocaleString('pt-BR')}>
                                      {i.createdAt?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  {isAppointment && appt && appt.when ? (
                                    <div className="mt-2 max-w-[520px] rounded-xl border border-brand-200/70 dark:border-brand-500/20 bg-gradient-to-br from-brand-50 to-white dark:from-brand-500/10 dark:to-transparent p-4">
                                      <div className="flex items-center gap-3">
                                        <div className="text-center shrink-0">
                                          <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">{appt.when.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}</div>
                                          <div className="num text-[24px] font-semibold tracking-tight leading-none text-brand-700 dark:text-brand-300">{String(appt.when.getDate()).padStart(2, '0')}</div>
                                          <div className="text-[10.5px] text-brand-600 dark:text-brand-300 num mt-0.5">{appt.when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                        <div className="w-px h-12 bg-brand-200/70 dark:bg-brand-500/20"></div>
                                        <div className="flex-1 min-w-0">
                                          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
                                            {appt.kind === 'class' ? <BookOpen size={11} /> : appt.kind === 'visit' ? <Building2 size={11} /> : appt.kind === 'call' ? <Phone size={11} /> : <MessageCircle size={11} />} {appt.label}
                                          </div>
                                          <div className="text-[13.5px] font-semibold text-slate-900 dark:text-white mt-0.5">{appt.when.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
                                        </div>
                                      </div>
                                    </div>
                                  ) : i.text ? (
                                    <div className={`mt-2 rounded-xl p-3 max-w-[640px] border ${visual.card || 'bg-white border-slate-200 dark:bg-white/[0.03] dark:border-white/[0.06]'}`}>
                                      <p className={`text-[13px] leading-relaxed whitespace-pre-wrap ${visual.text || 'text-slate-700 dark:text-slate-200'}`}>{i.text}</p>
                                    </div>
                                  ) : null}
                                </article>
                              );
                            })}
                          </div>
                        </div>
                      </section>
                    ))}

                    {/* Origin marker */}
                    {timelineFilter === 'all' && !timelineQuery && (
                      <div className="relative pl-12">
                        <div className="absolute left-[15px] top-0">
                          <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-white/[0.1] ring-4 ring-paper-50 dark:ring-ink-950"></div>
                        </div>
                        <p className="text-[11.5px] text-slate-400 dark:text-slate-500 mt-0.5 whitespace-nowrap">
                          Início da jornada · {lead.createdAt?.toLocaleDateString('pt-BR') || '—'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

      {lossModalOpen && <LossReasonModal lossReasons={lossReasons} onClose={()=>setLossModalOpen(false)} onConfirm={confirmLoss} />}
      </div>
    </>,
    document.body
  );
}

// ==========================================
// CONFIGURAÇÕES (ADMIN)ADMIN)
// ==========================================
// ==========================================
// SETTINGS — DESIGN PRIMITIVES
// ==========================================

function Field({ label, hint, children, error }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {label}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-[11.5px] text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p className="text-[11.5px] text-rose-600 dark:text-rose-300">{error}</p>}
    </div>
  );
}

const StyledInput = React.forwardRef(function StyledInput({ icon, className = '', ...p }, ref) {
  return (
    <div className="relative">
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        {...p}
        className={`w-full h-10 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:focus:border-white/20 outline-none text-[13px] ${icon ? 'pl-9' : 'pl-3'} pr-3 placeholder:text-slate-400 transition ${className}`}
      />
    </div>
  );
});

function StyledSelect({ children, className = '', ...p }) {
  return (
    <select
      {...p}
      className={`w-full h-10 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:focus:border-white/20 outline-none text-[13px] pl-3 pr-8 transition appearance-none cursor-pointer ${className}`}
      style={{
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round'><path d='M3 5l3 3 3-3'/></svg>")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right .7rem center'
      }}
    >
      {children}
    </select>
  );
}

// Tailwind 4 color name → utility classnames for the pipeline/tag badges.
// Maps to the colors used historically by the app (statusGradientMap keys) so
// existing data still renders sensibly under new visual treatment.
function settingsColorTone(color) {
  const palette = {
    blue:    { dot: 'bg-blue-500',    soft: 'bg-blue-50',    text: 'text-blue-700',    darkSoft: 'dark:bg-blue-500/10',    darkText: 'dark:text-blue-300',    strong: 'bg-blue-500' },
    indigo:  { dot: 'bg-indigo-500',  soft: 'bg-indigo-50',  text: 'text-indigo-700',  darkSoft: 'dark:bg-indigo-500/10',  darkText: 'dark:text-indigo-300',  strong: 'bg-indigo-500' },
    violet:  { dot: 'bg-violet-500',  soft: 'bg-violet-50',  text: 'text-violet-700',  darkSoft: 'dark:bg-violet-500/10',  darkText: 'dark:text-violet-300',  strong: 'bg-violet-500' },
    purple:  { dot: 'bg-purple-500',  soft: 'bg-purple-50',  text: 'text-purple-700',  darkSoft: 'dark:bg-purple-500/10',  darkText: 'dark:text-purple-300',  strong: 'bg-purple-500' },
    pink:    { dot: 'bg-pink-500',    soft: 'bg-pink-50',    text: 'text-pink-700',    darkSoft: 'dark:bg-pink-500/10',    darkText: 'dark:text-pink-300',    strong: 'bg-pink-500' },
    rose:    { dot: 'bg-rose-500',    soft: 'bg-rose-50',    text: 'text-rose-700',    darkSoft: 'dark:bg-rose-500/10',    darkText: 'dark:text-rose-300',    strong: 'bg-rose-500' },
    red:     { dot: 'bg-red-500',     soft: 'bg-red-50',     text: 'text-red-700',     darkSoft: 'dark:bg-red-500/10',     darkText: 'dark:text-red-300',     strong: 'bg-red-500' },
    orange:  { dot: 'bg-orange-500',  soft: 'bg-orange-50',  text: 'text-orange-700',  darkSoft: 'dark:bg-orange-500/10',  darkText: 'dark:text-orange-300',  strong: 'bg-orange-500' },
    amber:   { dot: 'bg-amber-500',   soft: 'bg-amber-50',   text: 'text-amber-700',   darkSoft: 'dark:bg-amber-500/10',   darkText: 'dark:text-amber-300',   strong: 'bg-amber-500' },
    yellow:  { dot: 'bg-yellow-500',  soft: 'bg-yellow-50',  text: 'text-yellow-700',  darkSoft: 'dark:bg-yellow-500/10',  darkText: 'dark:text-yellow-300',  strong: 'bg-yellow-500' },
    lime:    { dot: 'bg-lime-500',    soft: 'bg-lime-50',    text: 'text-lime-700',    darkSoft: 'dark:bg-lime-500/10',    darkText: 'dark:text-lime-300',    strong: 'bg-lime-500' },
    green:   { dot: 'bg-green-500',   soft: 'bg-green-50',   text: 'text-green-700',   darkSoft: 'dark:bg-green-500/10',   darkText: 'dark:text-green-300',   strong: 'bg-green-500' },
    emerald: { dot: 'bg-emerald-500', soft: 'bg-emerald-50', text: 'text-emerald-700', darkSoft: 'dark:bg-emerald-500/10', darkText: 'dark:text-emerald-300', strong: 'bg-emerald-500' },
    teal:    { dot: 'bg-teal-500',    soft: 'bg-teal-50',    text: 'text-teal-700',    darkSoft: 'dark:bg-teal-500/10',    darkText: 'dark:text-teal-300',    strong: 'bg-teal-500' },
    cyan:    { dot: 'bg-cyan-500',    soft: 'bg-cyan-50',    text: 'text-cyan-700',    darkSoft: 'dark:bg-cyan-500/10',    darkText: 'dark:text-cyan-300',    strong: 'bg-cyan-500' },
    sky:     { dot: 'bg-sky-500',     soft: 'bg-sky-50',     text: 'text-sky-700',     darkSoft: 'dark:bg-sky-500/10',     darkText: 'dark:text-sky-300',     strong: 'bg-sky-500' },
    brand:   { dot: 'bg-brand-600',   soft: 'bg-brand-50',   text: 'text-brand-700',   darkSoft: 'dark:bg-brand-500/10',   darkText: 'dark:text-brand-300',   strong: 'bg-brand-600' },
    slate:   { dot: 'bg-slate-400',   soft: 'bg-slate-100',  text: 'text-slate-700',   darkSoft: 'dark:bg-white/[0.05]',   darkText: 'dark:text-slate-300',   strong: 'bg-slate-400' }
  };
  return palette[color] || palette.slate;
}

function ColorBadge({ color, name, size = 'md' }) {
  const t = settingsColorTone(color);
  const sizing = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-[12px] px-2.5 py-1';
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-md whitespace-nowrap ${sizing} ${t.soft} ${t.text} ${t.darkSoft} ${t.darkText}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`}></span>
      {name}
    </span>
  );
}

// Palette shown in the color pickers for Pipeline (Funil) and Tags (Etiquetas).
// Legacy values like 'green', 'yellow', 'red', 'orange', 'purple', 'gray'
// still render correctly via settingsColorTone(); they just won't be highlighted
// in the picker — editing the item lets the user pick from this canonical set.
const SETTINGS_COLOR_OPTIONS = ['blue', 'amber', 'violet', 'teal', 'rose', 'emerald', 'pink', 'indigo', 'lime', 'slate'];

function ColorDot({ color, active, onClick, size = 22 }) {
  const t = settingsColorTone(color);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ width: size, height: size }}
      className={`rounded-full grid place-items-center transition ${t.strong} ${active ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-neutral-900 scale-110' : 'ring-1 ring-black/[0.06] hover:scale-105'}`}
      title={color}
    >
      {active && <Check size={12} className="text-white" />}
    </button>
  );
}

function SettingsCard({ title, hint, icon, action, children, padded = true, className = '' }) {
  return (
    <section className={`rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-card ${className}`}>
      {(title || action) && (
        <header className="px-6 py-5 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-white/[0.05]">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <span className="w-9 h-9 rounded-lg grid place-items-center bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300 shrink-0">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold whitespace-nowrap">{title}</h3>
              {hint && <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{hint}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      <div className={padded ? 'p-6' : ''}>{children}</div>
    </section>
  );
}

function SettingsTabItem({ icon, label, hint, badge, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full p-3 rounded-xl flex items-start gap-3 text-left transition group ${
        active
          ? 'bg-brand-50 dark:bg-brand-500/10 ring-1 ring-brand-200 dark:ring-brand-500/20'
          : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
      }`}
    >
      <span className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 transition ${
        active
          ? 'bg-brand-600 text-white'
          : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-white/[0.1]'
      }`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-[13px] font-semibold whitespace-nowrap ${active ? 'text-brand-700 dark:text-brand-300' : 'text-slate-900 dark:text-white'}`}>{label}</span>
          {badge != null && (
            <span className={`text-[10.5px] font-bold num px-1.5 h-[18px] rounded-md min-w-[18px] grid place-items-center ${
              active ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-700 dark:bg-white/[0.08] dark:text-slate-300'
            }`}>{badge}</span>
          )}
        </div>
        {hint && <div className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">{hint}</div>}
      </div>
    </button>
  );
}

function SettingsRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function SettingsView({ db, statuses, sources, usersList, appUser, tags, lossReasons, leads, funnels, modalities, trialClassOptions, units, metaWeekdays }) {
  const [activeTab, setActiveTab] = useState('users');
  const [selectedFunnelInTab, setSelectedFunnelInTab] = useState(null);

  const usersCount = (usersList || []).length;
  const funnelsCount = (funnels || []).length;
  const tagsCount = (tags || []).length;
  const sourcesCount = (sources || []).length;
  const lossCount = (lossReasons || []).length;
  const modalitiesCount = (modalities || []).length;

  const tabs = [
    { id: 'users',       label: 'Consultores',      hint: 'Time, credenciais e turnos',       icon: <Users size={15} />,         badge: usersCount },
    { id: 'general',     label: 'Configurações gerais', hint: 'Modalidades e aulas experimentais', icon: <SlidersHorizontal size={15} />, badge: modalitiesCount },
    { id: 'transfer',    label: 'Migrar leads',     hint: 'Transferir base entre consultores', icon: <ArrowRightLeft size={15} />, badge: null },
    { id: 'statuses',    label: 'Funil pipeline',   hint: 'Etapas do processo comercial',     icon: <Kanban size={15} />,        badge: funnelsCount },
    { id: 'tags',        label: 'Etiquetas',        hint: 'Marcadores para segmentar leads',  icon: <Tag size={15} />,           badge: tagsCount },
    { id: 'sources',     label: 'Origens',          hint: 'De onde os leads chegam',          icon: <Filter size={15} />,        badge: sourcesCount },
    { id: 'lossReasons', label: 'Motivos de perda', hint: 'Justificativas padrão de perda',   icon: <ThumbsDown size={15} />,    badge: lossCount }
  ];

  const goToTab = (tab) => {
    setActiveTab(tab);
    if (tab !== 'statuses') setSelectedFunnelInTab(null);
  };

  const funnelInTab = (funnels || []).find(f => f.id === selectedFunnelInTab);

  return (
    <div className="animate-fade-in font-sans space-y-6">
      {/* Page hero */}
      <section>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Settings size={13} className="text-brand-600" /> Configurações
        </div>
        <h2 className="mt-1.5 font-display text-[24px] font-semibold tracking-tight leading-tight">
          Ajustes da operação
        </h2>
        <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
          Configure o seu CRM — equipe, funil, marcadores e regras de negócio.
        </p>
      </section>

      <div className="grid grid-cols-12 gap-6">
        {/* Tabs nav */}
        <aside className="col-span-12 lg:col-span-3">
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-card p-2 space-y-1 lg:sticky lg:top-20">
            {tabs.map(t => (
              <SettingsTabItem
                key={t.id}
                icon={t.icon}
                label={t.label}
                hint={t.hint}
                badge={t.badge}
                active={activeTab === t.id}
                onClick={() => goToTab(t.id)}
              />
            ))}
          </div>
        </aside>

        {/* Content */}
        <div className="col-span-12 lg:col-span-9 space-y-6" key={activeTab}>
          {activeTab === 'users' && <ManageUsersTab db={db} appUser={appUser} />}
          {activeTab === 'general' && <ManageGeneralSettingsTab db={db} modalities={modalities} trialClassOptions={trialClassOptions} units={units} leads={leads} metaWeekdays={metaWeekdays} />}
          {activeTab === 'statuses' && !selectedFunnelInTab && (
            <ManageFunnelsTab db={db} funnels={funnels} statuses={statuses} leads={leads} onSelectFunnel={setSelectedFunnelInTab} />
          )}
          {activeTab === 'statuses' && selectedFunnelInTab && (
            <div className="space-y-3">
              <button
                onClick={() => setSelectedFunnelInTab(null)}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/10 dark:hover:bg-brand-500/15 px-3 py-2 rounded-lg transition active:scale-95"
              >
                <ChevronRight size={14} className="rotate-180" />
                Voltar para funis
              </button>
              <ManageStatusesTab db={db} statuses={statuses} leads={leads} funnelId={selectedFunnelInTab} funnelName={funnelInTab?.name} />
            </div>
          )}
          {activeTab === 'sources' && <ManageSourcesTab db={db} sources={sources} leads={leads} />}
          {activeTab === 'transfer' && <TransferLeadsTab db={db} usersList={usersList} appUser={appUser} leads={leads} />}
          {activeTab === 'tags' && <ManageTagsTab db={db} tags={tags} leads={leads} />}
          {activeTab === 'lossReasons' && <ManageLossReasonsTab db={db} lossReasons={lossReasons} leads={leads} />}
        </div>
      </div>
    </div>
  );
}

function ManageUsersTab({ db, appUser }) {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', authUid: '', password: '', shiftStart: '', shiftEnd: '' });
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  // Convite por e-mail (alternativa ao cadastro direto: o convidado define a
  // própria senha via link /?invite=token&t=tenant).
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('consultant');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');

  const createInvite = async (e) => {
    e.preventDefault();
    if (inviteLoading) return;
    const email = String(inviteEmail || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast.warning('E-mail inválido.'); return; }
    setInviteLoading(true);
    setInviteLink('');
    try {
      const res = await fetch('/api/invite-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.currentUser.getIdToken()}` },
        body: JSON.stringify({ email, role: inviteRole })
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erro ao criar convite.'); setInviteLoading(false); return; }
      const link = `${window.location.origin}/?invite=${encodeURIComponent(data.token)}&t=${encodeURIComponent(data.tenantId)}`;
      setInviteLink(link);
      toast.success('Convite criado. Copie o link e envie ao convidado.', { duration: 7000 });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar convite.');
    }
    setInviteLoading(false);
  };

  const copyInviteLink = async () => {
    try { await navigator.clipboard.writeText(inviteLink); toast.success('Link copiado!'); }
    catch { toast.info('Copie o link manualmente.'); }
  };

  useEffect(() => {
    return onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', USERS_PATH),
      snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [db]);

  const resetForm = () => {
    setForm({ name: '', email: '', authUid: '', password: '', shiftStart: '', shiftEnd: '' });
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const buf = new Uint32Array(12);
    window.crypto.getRandomValues(buf);
    return Array.from(buf, n => chars[n % chars.length]).join('');
  };

  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
  const normalizeUid = (value) => String(value || '').trim();

  const isAuthLinked = (user) => Boolean(normalizeUid(user?.authUid));
  const shortUid = (uid) => {
    const raw = normalizeUid(uid);
    if (!raw) return 'Sem vínculo';
    if (raw.length <= 14) return raw;
    return `${raw.slice(0, 6)}...${raw.slice(-4)}`;
  };

  const openNewForm = () => {
    setEditingUser(null);
    resetForm();
    setShowAdd(true);
  };

  const handleToggleAddEdit = () => {
    if (showAdd || editingUser) {
      setEditingUser(null);
      setShowAdd(false);
      resetForm();
    } else {
      openNewForm();
    }
  };

  const openEditForm = (user) => {
    setEditingUser(user);
    setForm({
      name: user.name || '',
      email: user.email || '',
      authUid: user.authUid || '',
      password: '',
      shiftStart: user.shiftStart || '',
      shiftEnd: user.shiftEnd || ''
    });
    setShowAdd(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const add = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.warning('Preencha nome, e-mail e senha temporária.');
      return;
    }
    if (!appUser?.authUid) {
      toast.error('Sessão sem authUid. Reentre no sistema.');
      return;
    }

    setLoadingSubmit(true);
    try {
      const res = await fetch('/api/admin-create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await auth.currentUser.getIdToken()}`
        },
        body: JSON.stringify({
          name: form.name.trim(),
          email: normalizeEmail(form.email),
          password: form.password
        })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao cadastrar consultor.');
        return;
      }

      toast.success(`Consultor ${form.name.trim()} cadastrado. Senha temporária: ${form.password}`, { duration: 8000, title: 'Cadastrado com sucesso' });
      resetForm();
      setShowAdd(false);
    } catch (err) {
      console.error(err);
      toast.error('Falha de rede ao cadastrar consultor.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  const update = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    setLoadingSubmit(true);
    try {
      const newName = form.name.trim();
      await updateDoc(
        doc(db, 'artifacts', appId, 'public', 'data', USERS_PATH, editingUser.id),
        {
          name: newName,
          email: normalizeEmail(form.email),
          authUid: normalizeUid(form.authUid) || null,
          shiftStart: form.shiftStart || null,
          shiftEnd: form.shiftEnd || null,
          password: deleteField()
        }
      );

      // Propaga a renomeação para a base do consultor. consultantName é
      // desnormalizado nos leads (aparece no Kanban, Agendamentos, lista de
      // Leads, CSV e ranking do Dashboard); sem isso, renomear o consultor
      // deixava todos esses lugares exibindo o nome antigo. Busca direto no
      // Firestore (não só os leads em memória) pra alcançar a base inteira.
      if (editingUser.name !== newName) {
        const leadsSnap = await getDocs(query(
          collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH),
          where('consultantId', '==', editingUser.id)
        ));
        if (!leadsSnap.empty) {
          const ops = leadsSnap.docs.map(d => ({
            ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, d.id),
            data: { consultantName: newName }
          }));
          await commitOpsInChunks(db, ops, 400);
        }
      }

      if (form.password.trim()) {
        const targetUid = normalizeUid(form.authUid) || editingUser.authUid;
        if (!targetUid) {
          toast.error('Cadastro sem authUid. Não é possível redefinir senha.');
        } else {
          const res = await fetch('/api/admin-set-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${await auth.currentUser.getIdToken()}`
            },
            body: JSON.stringify({
              targetAuthUid: targetUid,
              password: form.password
            })
          });
          const data = await res.json();
          if (!res.ok) {
            toast.error(data.error || 'Erro ao redefinir senha.');
            return;
          }
          toast.success(`Senha redefinida. Nova senha: ${form.password}`, { duration: 8000 });
        }
      }

      setEditingUser(null);
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar alterações.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  const delUser = async (user) => {
    const target = typeof user === 'object' ? user : (users || []).find(u => u.id === user);
    if (!target) return;
    if (!window.confirm("⚠️ EXCLUIR ACESSO? Apaga a conta no Auth e o cadastro interno. Essa ação é irreversível.")) return;
    if (!appUser?.authUid) {
      toast.error('Sessão sem authUid. Reentre no sistema.');
      return;
    }

    try {
      const res = await fetch('/api/admin-delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await auth.currentUser.getIdToken()}`
        },
        body: JSON.stringify({
          userDocId: target.id,
          targetAuthUid: target.authUid || null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao excluir consultor.');
        return;
      }
      setEditingUser(null);
    } catch (err) {
      console.error(err);
      toast.error('Falha de rede ao excluir consultor.');
    }
  };

  return (
    <SettingsCard
      title="Consultores"
      hint="Cadastre e gerencie quem tem acesso ao CRM"
      icon={<Users size={16} />}
      action={
        <div className="flex items-center gap-2">
          <Btn
            kind={inviteOpen ? 'soft' : 'secondary'}
            icon={inviteOpen ? <X size={13} /> : <Mail size={13} />}
            onClick={() => { setInviteOpen(o => !o); setInviteLink(''); }}
          >
            {inviteOpen ? 'Fechar' : 'Convidar'}
          </Btn>
          <Btn
            kind={showAdd || editingUser ? 'soft' : 'brand'}
            icon={showAdd || editingUser ? <X size={13} /> : <Plus size={13} />}
            onClick={handleToggleAddEdit}
          >
            {showAdd || editingUser ? 'Cancelar' : 'Novo consultor'}
          </Btn>
        </div>
      }
    >
      {inviteOpen && (
        <div className="mb-8 p-5 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] animate-fade-in">
          <h4 className="text-[13px] font-bold text-gray-900 dark:text-white">Convidar por e-mail</h4>
          <p className="text-[11.5px] text-gray-500 dark:text-neutral-400 mt-0.5 mb-4">
            O convidado define a própria senha pelo link. Envie o link gerado por e-mail/WhatsApp (validade: 7 dias).
          </p>
          <form onSubmit={createInvite} className="flex flex-col sm:flex-row gap-2">
            <input
              type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@convidado.com" required
              className="flex-1 h-10 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] px-3 placeholder:text-slate-400 transition"
            />
            <StyledSelect value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="sm:w-44">
              <option value="consultant">Consultor</option>
              <option value="admin">Admin</option>
            </StyledSelect>
            <Btn kind="brand" type="submit" icon={<Mail size={13} />} disabled={inviteLoading}>
              {inviteLoading ? 'Gerando...' : 'Gerar convite'}
            </Btn>
          </form>
          {inviteLink && (
            <div className="mt-4 flex items-center gap-2 p-2.5 rounded-lg bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08]">
              <span className="flex-1 text-[12px] text-slate-600 dark:text-slate-300 truncate num">{inviteLink}</span>
              <button type="button" onClick={copyInviteLink} className="shrink-0 text-[11.5px] font-semibold px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 transition">
                Copiar
              </button>
            </div>
          )}
        </div>
      )}
      {(showAdd || editingUser) && (
        <form
          onSubmit={editingUser ? update : add}
          className="bg-white dark:bg-neutral-900/80 p-8 rounded-[2.5rem] border border-brand-100 dark:border-brand-800/30 animate-fade-in mb-10 space-y-8 shadow-2xl relative overflow-hidden"
        >
          
          <div className="flex justify-between items-center border-b border-gray-100 dark:border-neutral-800 pb-5 mb-4">
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">
                {editingUser ? `Editando: ${editingUser.name}` : 'Novo Cadastro'}
              </h4>
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-widest mt-1">
                {editingUser ? 'Atualize as informações do consultor' : 'Preencha os dados do novo membro da equipe'}
              </p>
            </div>

            {editingUser && editingUser.role !== 'admin' && (
              <button
                type="button"
                onClick={() => delUser(editingUser.id)}
                className="text-[10px] font-bold text-red-500 flex items-center gap-2 hover:text-red-600 transition-colors uppercase tracking-widest bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 px-4 py-2.5 rounded-xl active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest block">
                Nome do Consultor
              </label>
              <input
                placeholder="Ex: Maria Vendas"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-brand-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest block">
                E-mail de Login
              </label>
              <input
                type="email"
                placeholder="maria@stronilead.com.br"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-brand-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest block">
                {editingUser ? 'Auth UID' : 'Senha temporária'}
              </label>
              {editingUser ? (
                <input
                  type="text"
                  placeholder="Auth UID (somente leitura)"
                  value={form.authUid}
                  readOnly
                  className="w-full bg-gray-100/50 dark:bg-neutral-900/50 px-5 py-4 rounded-2xl text-gray-400 dark:text-neutral-600 outline-none border border-transparent text-xs font-bold cursor-not-allowed"
                />
              ) : (
                <div className="flex gap-2 relative">
                  <input
                    type="text"
                    placeholder="Mín. 6 caracteres"
                    required
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="flex-1 bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-brand-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold shadow-sm pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, password: generatePassword() })}
                    className="absolute right-2 top-2 bottom-2 bg-brand-600 hover:bg-brand-700 text-white px-4 rounded-xl text-[9px] font-bold shadow-md active:scale-95 transition-all uppercase tracking-widest"
                  >
                    Gerar
                  </button>
                </div>
              )}
            </div>
          </div>

          {editingUser && (
            <div className="space-y-2 max-w-sm">
              <label className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest block">
                Nova senha (opcional)
              </label>
              <div className="flex gap-2 relative">
                <input
                  type="text"
                  placeholder="Deixe em branco para não alterar"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="flex-1 bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-brand-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold shadow-sm pr-20"
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, password: generatePassword() })}
                  className="absolute right-2 top-2 bottom-2 bg-brand-600 hover:bg-brand-700 text-white px-4 rounded-xl text-[9px] font-bold shadow-md active:scale-95 transition-all uppercase tracking-widest"
                >
                  Gerar
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest block">
                Início do Turno
              </label>
              <input
                type="time"
                value={form.shiftStart}
                onChange={e => setForm({ ...form, shiftStart: e.target.value })}
                className="w-full bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-brand-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest block">
                Fim do Turno
              </label>
              <input
                type="time"
                value={form.shiftEnd}
                onChange={e => setForm({ ...form, shiftEnd: e.target.value })}
                className="w-full bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-brand-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold shadow-sm"
              />
            </div>
          </div>

          <div className="bg-brand-50/50 dark:bg-brand-800/10 border border-brand-100 dark:border-brand-800/30 rounded-2xl p-5 mt-4">
            <p className="text-[10px] font-bold text-brand-500 dark:text-brand-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
               <AlertCircle className="w-3.5 h-3.5" /> Observação operacional
            </p>
            <p className="text-xs text-gray-600 dark:text-neutral-400 font-medium leading-relaxed">
              {editingUser
                ? <>Para redefinir a senha, preencha o campo opcional. O <span className="text-gray-900 dark:text-white font-bold">authUid</span> é gerado automaticamente no cadastro e não pode ser alterado.</>
                : <>O cadastro cria a conta no Firebase Auth e o registro interno em uma única operação. Anote a senha temporária para entregar ao consultor.</>
              }
            </p>
          </div>

          <div className="flex gap-4 pt-4 border-t border-gray-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={handleToggleAddEdit}
              className="flex-1 py-4 bg-gray-100 dark:bg-neutral-800 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-600 dark:text-neutral-300"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loadingSubmit}
              className="flex-[2] bg-brand-600 hover:bg-brand-700 text-white py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-xl shadow-brand-600/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {loadingSubmit ? 'PROCESSANDO...' : editingUser ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR NOVO'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {(users || []).map(u => (
          <div
            key={u.id}
            className="group relative bg-white dark:bg-neutral-900 p-6 rounded-[2rem] border border-gray-100 dark:border-neutral-800 hover:border-brand-100 dark:hover:border-brand-800/50 hover:shadow-xl hover:shadow-brand-500/5 transition-all duration-300 flex flex-col"
          >
            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md p-1 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800">
              <button
                onClick={() => openEditForm(u)}
                className="p-2 text-gray-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-800/20 rounded-lg transition-colors"
                title="Editar"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>

              {u.role !== 'admin' && (
                <button
                  onClick={() => delUser(u.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-col items-center text-center mb-4 mt-2">
              <div className="w-16 h-16 bg-gradient-to-br from-brand-500 to-brand-700 text-white rounded-full flex items-center justify-center font-bold text-2xl shadow-lg shadow-brand-500/20 mb-3 relative">
                {(u.name || 'C')[0]}
                {u.role === 'admin' && (
                  <div className="absolute -bottom-1 -right-1 bg-white dark:bg-neutral-900 rounded-full p-1 shadow-sm">
                    <Shield className="w-3.5 h-3.5 text-brand-500" />
                  </div>
                )}
              </div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                {u.name}
              </h4>
              <p className="text-[10px] text-gray-500 dark:text-neutral-400 font-medium mt-1 truncate w-full px-4">
                {u.email}
              </p>
            </div>

            <div className="mt-auto space-y-2 pt-4 border-t border-gray-50 dark:border-neutral-800/50">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Status Auth</span>
                <span
                  className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest ${
                    isAuthLinked(u)
                      ? 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400'
                      : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                  }`}
                >
                  {isAuthLinked(u) ? 'Vinculado' : 'Sem vínculo'}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">UID</span>
                <span className="text-[10px] font-medium text-gray-600 dark:text-neutral-400 font-mono">
                  {shortUid(u.authUid)}
                </span>
              </div>

              {(u.shiftStart && u.shiftEnd) && (
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Turno</span>
                  <span className="px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {u.shiftStart} - {u.shiftEnd}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}

function ManageFunnelsTab({ db, funnels, statuses, leads, onSelectFunnel }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  const safeFunnels = Array.isArray(funnels) ? funnels : [];

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    // Novos funis nunca nascem como padrão. O único "padrão" é definido pelo botão dedicado.
    const funnelRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH), {
      name: trimmed,
      order: safeFunnels.length,
      isDefault: false,
      createdAt: serverTimestamp()
    });
    // Todo funil novo já nasce com a etapa de sistema "Negociação" — junto
    // com Venda/Perda (hardcoded como colunas terminais), são as três fases
    // fixas do sistema. A etapa carrega isSystem=true para o ManageStatusesTab
    // bloquear edit/delete.
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH), {
      name: 'Negociação',
      color: 'purple',
      order: 0,
      funnelId: funnelRef.id,
      isSystem: true
    });
    setName('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    const trimmed = editingName.trim();
    if (!trimmed || !editingId) return;
    await setDoc(
      doc(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH, editingId),
      { name: trimmed },
      { merge: true }
    );
    setEditingId(null);
    setEditingName('');
  };

  const handleReorder = async (dragIdx, dropIdx) => {
    if (dragIdx === dropIdx) return;
    const arr = [...safeFunnels];
    const [item] = arr.splice(dragIdx, 1);
    arr.splice(dropIdx, 0, item);
    await Promise.all(arr.map((f, i) =>
      setDoc(doc(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH, f.id), { order: i }, { merge: true })
    ));
  };

  const handleSetDefault = async (f) => {
    if (f.isDefault) return;
    const batch = writeBatch(db);
    safeFunnels.forEach(item => {
      if (item.isDefault) {
        batch.update(doc(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH, item.id), { isDefault: false });
      }
    });
    batch.update(doc(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH, f.id), { isDefault: true });
    await batch.commit();
  };

  const handleDelete = async (f) => {
    if (f.isDefault) {
      toast.warning('Não é possível excluir o funil padrão. Marque outro como padrão antes.');
      return;
    }
    const leadsInFunnel = (leads || []).filter(l => l.funnelId === f.id);
    if (leadsInFunnel.length > 0) {
      toast.warning(`Funil "${f.name}" tem ${leadsInFunnel.length} lead(s). Mova-os para outro funil antes de excluir.`);
      return;
    }
    const statusesInFunnel = (statuses || []).filter(s => s.funnelId === f.id);
    if (statusesInFunnel.length > 0) {
      if (!window.confirm(`Este funil tem ${statusesInFunnel.length} etapa(s) configurada(s). Excluir o funil também excluirá essas etapas. Confirma?`)) return;
      const batch = writeBatch(db);
      statusesInFunnel.forEach(s => {
        batch.delete(doc(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH, s.id));
      });
      batch.delete(doc(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH, f.id));
      await batch.commit();
    } else {
      if (!window.confirm(`Excluir o funil "${f.name}"?`)) return;
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH, f.id));
    }
  };

  return (
    <SettingsCard
      title="Funis ativos"
      hint="Crie funis paralelos (Comercial, Indicação, Inativos, Renovações…) e configure as etapas"
      icon={<Kanban size={16} />}
    >
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] mb-5">
        <div className="flex-1 min-w-[220px]">
          <StyledInput
            icon={<Kanban size={14} />}
            placeholder="Nome do funil (ex: Indicação)"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>
        <Btn kind="primary" type="submit" icon={<Zap size={13} />}>Adicionar funil</Btn>
      </form>

      {safeFunnels.length === 0 ? (
        <div className="text-center text-[12.5px] text-slate-400 italic py-12">
          Nenhum funil cadastrado ainda. Crie o primeiro funil acima.
        </div>
      ) : (
        <>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-dashed border-slate-300 dark:border-white/[0.1] text-center mb-3">
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
              <GripVertical size={12} /> Arraste os funis para reordenar
            </p>
          </div>
          <div className="space-y-2">
            {safeFunnels.map((f, i) => (
              <div
                key={f.id}
                draggable={editingId !== f.id}
                onDragStart={e => e.dataTransfer.setData('idx', i)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleReorder(Number(e.dataTransfer.getData('idx')), i)}
                className="group flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/10 transition cursor-grab active:cursor-grabbing"
              >
                <span className="w-8 h-8 rounded-lg grid place-items-center text-slate-300 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06] dark:text-slate-600 dark:hover:text-slate-300 transition shrink-0">
                  <GripVertical size={16} />
                </span>
                {editingId === f.id ? (
                  <form onSubmit={handleSaveEdit} className="flex gap-2 flex-1 items-center">
                    <StyledInput
                      autoFocus
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      className="flex-1"
                    />
                    <Btn kind="brand" type="submit" icon={<Check size={13} />}>Salvar</Btn>
                    <Btn kind="soft" type="button" onClick={() => { setEditingId(null); setEditingName(''); }}>Cancelar</Btn>
                  </form>
                ) : (
                  <>
                    <span className="text-[13.5px] font-semibold text-slate-900 dark:text-white truncate">{f.name}</span>
                    {f.isDefault && (
                      <span className="text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 shrink-0">
                        Padrão
                      </span>
                    )}
                    <div className="flex-1"></div>
                    <Btn kind="soft" size="sm" onClick={() => onSelectFunnel(f.id)}>Configurar etapas</Btn>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                      {!f.isDefault && (
                        <IconBtn icon={<Trophy size={14} />} title="Tornar padrão" onClick={() => handleSetDefault(f)} />
                      )}
                      <IconBtn icon={<Pencil size={14} />} kind="edit" title="Renomear" onClick={() => { setEditingId(f.id); setEditingName(f.name); }} />
                      <IconBtn icon={<Trash2 size={14} />} kind="danger" title="Excluir" onClick={() => handleDelete(f)} />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </SettingsCard>
  );
}

function ManageStatusesTab({ db, statuses, leads, funnelId, funnelName }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState('blue');
  const [editingId, setEditingId] = useState(null);

  const statusesForFunnel = (statuses || []).filter(s => s.funnelId === funnelId);

  // Etapa de sistema: junto com Venda/Perda (hardcoded), Negociação é fixa em
  // todo funil. Identificada por isSystem=true OU pelo nome (legado).
  const isSystemStage = (s) =>
    Boolean(s?.isSystem) || (s?.name || '').trim().toLowerCase() === 'negociação';

  const save = async (e) => {
    e.preventDefault();
    if (editingId) {
      const oldStatus = statuses.find(s => s.id === editingId);
      if (oldStatus && isSystemStage(oldStatus)) {
        toast.warning(`A etapa "${oldStatus.name}" é uma fase fixa do sistema e não pode ser renomeada.`);
        setEditingId(null);
        setName('');
        return;
      }
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH, editingId),
        { name, color },
        { merge: true }
      );

      // Renomeação propaga para os leads (apenas do mesmo funil)
      if (oldStatus && oldStatus.name !== name) {
        const leadsToUpdate = (leads || []).filter(
          l => l.funnelId === funnelId && l.status === oldStatus.name
        );
        if (leadsToUpdate.length > 0) {
          const ops = leadsToUpdate.map(lead => ({
            ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
            data: { status: name }
          }));
          await commitOpsInChunks(db, ops, 400);
        }
      }
      setEditingId(null);
    } else {
      // Bloqueia criação duplicada da etapa "Negociação" — ela é única por funil.
      if ((name || '').trim().toLowerCase() === 'negociação' &&
          statusesForFunnel.some(s => (s.name || '').trim().toLowerCase() === 'negociação')) {
        toast.warning('A etapa "Negociação" já existe neste funil (etapa fixa do sistema).');
        return;
      }
      await addDoc(
        collection(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH),
        { name, color, order: statusesForFunnel.length, funnelId }
      );
    }
    setName('');
  };

  const drop = async (dragIdx, dropIdx) => {
    if (dragIdx === dropIdx) return;
    const arr = [...statusesForFunnel];
    const [item] = arr.splice(dragIdx, 1);
    arr.splice(dropIdx, 0, item);
    await Promise.all(arr.map((s, i) =>
      setDoc(doc(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH, s.id), { order: i }, { merge: true })
    ));
  };

  const handleDelete = async (s) => {
    if (isSystemStage(s)) {
      toast.warning(`A etapa "${s.name}" é uma fase fixa do sistema e não pode ser excluída.`);
      return;
    }
    const leadsInStatus = (leads || []).filter(l => l.funnelId === funnelId && l.status === s.name);
    if (leadsInStatus.length > 0) {
      toast.warning(`Etapa "${s.name}" tem ${leadsInStatus.length} lead(s). Transfira-os para outra etapa antes de excluir.`);
      return;
    }
    if (window.confirm(`Tem certeza que deseja excluir a etapa "${s.name}"?`)) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH, s.id));
      if (editingId === s.id) { setEditingId(null); setName(''); }
    }
  };

  return (
    <SettingsCard
      title={`Pipeline · ${funnelName || 'Funil'}`}
      hint="Defina as etapas da jornada deste funil"
      icon={<Kanban size={16} />}
    >
      <form onSubmit={save} className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] mb-5">
        <div className="flex-1 min-w-[220px]">
          <StyledInput
            icon={<Kanban size={14} />}
            placeholder="Nome da etapa (ex: Em contato)"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 text-center">Cor</div>
          <div className="flex items-center gap-1.5 h-10">
            {SETTINGS_COLOR_OPTIONS.map(c => (
              <ColorDot key={c} color={c} active={color === c} onClick={() => setColor(c)} size={22} />
            ))}
          </div>
        </div>
        {editingId ? (
          <div className="flex gap-2">
            <Btn kind="brand" type="submit" icon={<Check size={13} />}>Salvar</Btn>
            <Btn kind="soft" onClick={() => { setEditingId(null); setName(''); }} type="button">Cancelar</Btn>
          </div>
        ) : (
          <Btn kind="primary" type="submit" icon={<Zap size={13} />}>Adicionar etapa</Btn>
        )}
      </form>

      {statusesForFunnel.length === 0 ? (
        <div className="text-center text-[12.5px] text-slate-400 italic py-12">
          Nenhuma etapa neste funil ainda. Crie a primeira etapa acima.
        </div>
      ) : (
        <>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-dashed border-slate-300 dark:border-white/[0.1] text-center mb-3">
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
              <GripVertical size={12} /> Arraste as etapas para reordenar o seu funil
            </p>
          </div>
          <div className="space-y-2">
            {statusesForFunnel.map((s, i) => {
              const leadCount = (leads || []).filter(l => l.funnelId === funnelId && l.status === s.name).length;
              const isSystem = isSystemStage(s);
              return (
                <div
                  key={s.id}
                  draggable={!isSystem}
                  onDragStart={e => { if (!isSystem) e.dataTransfer.setData('idx', i); }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => drop(Number(e.dataTransfer.getData('idx')), i)}
                  className={`group flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/10 transition ${
                    isSystem ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-lg grid place-items-center transition shrink-0 ${
                    isSystem
                      ? 'text-slate-200 dark:text-white/[0.08]'
                      : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06] dark:text-slate-600 dark:hover:text-slate-300'
                  }`}>
                    {isSystem ? <Lock size={14} /> : <GripVertical size={16} />}
                  </span>
                  <span className="text-[11px] font-semibold num text-slate-500 dark:text-slate-400 w-6 text-center shrink-0">{i + 1}</span>
                  <ColorBadge color={s.color || 'blue'} name={s.name} />
                  {isSystem && (
                    <span
                      title="Etapa fixa do sistema — não pode ser editada ou excluída"
                      className="text-[9.5px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400 shrink-0"
                    >
                      Fixa
                    </span>
                  )}
                  <div className="flex-1"></div>
                  <span className="text-[11.5px] text-slate-500 dark:text-slate-400 num whitespace-nowrap">
                    <span className="num font-semibold text-slate-700 dark:text-slate-200">{leadCount}</span> {leadCount === 1 ? 'lead na etapa' : 'leads na etapa'}
                  </span>
                  {!isSystem && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                      <IconBtn icon={<Pencil size={14} />} kind="edit" title="Editar" onClick={() => { setName(s.name); setColor(s.color || 'blue'); setEditingId(s.id); }} />
                      <IconBtn icon={<Trash2 size={14} />} kind="danger" title="Excluir" onClick={() => handleDelete(s)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </SettingsCard>
  );
}

function ManageSourcesTab({ db, sources, leads }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    if (editingId) {
      const oldSource = sources.find(s => s.id === editingId);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', SOURCES_PATH, editingId), { name }, { merge: true });

      if (oldSource && oldSource.name !== name) {
        const leadsToUpdate = (leads || []).filter(l => l.source === oldSource.name);
        if (leadsToUpdate.length > 0) {
          const ops = leadsToUpdate.map(lead => ({
            ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
            data: { source: name }
          }));
          await commitOpsInChunks(db, ops, 400);
        }
      }
      setEditingId(null);
    } else {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', SOURCES_PATH), { name, createdAt: serverTimestamp() });
    }
    setName('');
  };

  const handleDelete = async (s) => {
    const leadsWithSource = (leads || []).filter(l => l.source === s.name);
    if (leadsWithSource.length > 0) {
      toast.warning(`Origem "${s.name}" está em uso por ${leadsWithSource.length} lead(s). Não é possível excluí-la.`);
      return;
    }
    if (window.confirm(`Tem certeza que deseja excluir a origem "${s.name}"?`)) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', SOURCES_PATH, s.id));
      if (editingId === s.id) { setEditingId(null); setName(''); }
    }
  };

  return (
    <SettingsCard
      title="Origens"
      hint="Controle de onde vêm os seus leads"
      icon={<Globe size={16} />}
    >
      <form onSubmit={save} className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] mb-5">
        <div className="flex-1 min-w-[220px]">
          <StyledInput
            icon={<Zap size={14} />}
            placeholder="Nome da origem (ex: TikTok)"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>
        {editingId ? (
          <div className="flex gap-2">
            <Btn kind="brand" type="submit" icon={<Check size={13} />}>Salvar</Btn>
            <Btn kind="soft" type="button" onClick={() => { setEditingId(null); setName(''); }}>Cancelar</Btn>
          </div>
        ) : (
          <Btn kind="primary" type="submit" icon={<Zap size={13} />}>Criar origem</Btn>
        )}
      </form>

      {(() => {
        const totalLeads = (leads || []).length;
        const sourceIconFor = (name) => {
          const n = String(name || '').toLowerCase();
          if (n.includes('indica')) return Users;
          if (n.includes('whatsapp')) return MessageCircle;
          if (n.includes('site') || n.includes('web')) return LayoutDashboard;
          if (n.includes('instagram') || n.includes('facebook') || n.includes('tiktok') || n.includes('rede')) return Activity;
          if (n.includes('tráfego') || n.includes('trafego') || n.includes('ads')) return Zap;
          return Zap;
        };
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {(sources || []).map(s => {
              const sourceLeads = (leads || []).filter(l => l.source === s.name).length;
              const pct = totalLeads > 0 ? Math.round((sourceLeads / totalLeads) * 100) : 0;
              const Icon = sourceIconFor(s.name);
              return (
                <div
                  key={s.id}
                  className="group rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4 hover:border-slate-300 dark:hover:border-white/10 transition relative"
                >
                  <div className="absolute top-3 right-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                    <IconBtn icon={<Pencil size={13} />} kind="edit" title="Editar" onClick={() => { setName(s.name); setEditingId(s.id); }} />
                    <IconBtn icon={<Trash2 size={13} />} kind="danger" title="Excluir" onClick={() => handleDelete(s)} />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-lg grid place-items-center bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300 shrink-0">
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-[14px] truncate">{s.name}</div>
                      <div className="text-[11.5px] text-slate-500 dark:text-slate-400 num whitespace-nowrap">
                        {sourceLeads} {sourceLeads === 1 ? 'lead' : 'leads'} · {pct}%
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.05] overflow-hidden">
                    <div className="h-full bg-brand-600 rounded-full" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </SettingsCard>
  );
}

function ManageTagsTab({ db, tags, leads }) {
  const toast = useToast();
  const [name, setName] = useState(''); const [color, setColor] = useState('blue');
  const [editingId, setEditingId] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    if (editingId) {
      const oldTag = tags.find(t => t.id === editingId);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', TAGS_PATH, editingId), { name, color }, { merge: true });

      if (oldTag && oldTag.name !== name) {
        const leadsToUpdate = (leads || []).filter(l => (l.tags || []).includes(oldTag.name));
        if (leadsToUpdate.length > 0) {
          const ops = leadsToUpdate.map(lead => ({
            ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
            data: { tags: (lead.tags || []).map(t => t === oldTag.name ? name : t) }
          }));
          await commitOpsInChunks(db, ops, 400);
        }
      }
      setEditingId(null);
    } else {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', TAGS_PATH), { name, color });
    }
    setName('');
  };

  const handleDelete = async (t) => {
    const leadsWithTag = (leads || []).filter(l => (l.tags || []).includes(t.name));
    if (leadsWithTag.length > 0) {
      toast.warning(`Etiqueta "${t.name}" está em ${leadsWithTag.length} lead(s). Remova-a desses leads antes de excluir.`);
      return;
    }
    if (window.confirm(`Tem certeza que deseja excluir a etiqueta "${t.name}"?`)) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', TAGS_PATH, t.id));
      if (editingId === t.id) { setEditingId(null); setName(''); }
    }
  };

  return (
    <SettingsCard
      title="Etiquetas"
      hint="Marcadores rápidos para segmentar e filtrar leads"
      icon={<Tag size={16} />}
    >
      <form onSubmit={save} className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] mb-5">
        <div className="flex-1 min-w-[220px]">
          <StyledInput
            icon={<Tag size={14} />}
            placeholder="Nome da etiqueta (ex: Plano anual)"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 text-center">Cor</div>
          <div className="flex items-center gap-1.5 h-10">
            {SETTINGS_COLOR_OPTIONS.map(c => (
              <ColorDot key={c} color={c} active={color === c} onClick={() => setColor(c)} size={22} />
            ))}
          </div>
        </div>
        {editingId ? (
          <div className="flex gap-2">
            <Btn kind="brand" type="submit" icon={<Check size={13} />}>Salvar</Btn>
            <Btn kind="soft" onClick={() => { setEditingId(null); setName(''); setColor('blue'); }} type="button">Cancelar</Btn>
          </div>
        ) : (
          <Btn kind="primary" type="submit" icon={<Zap size={13} />}>Criar etiqueta</Btn>
        )}
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {(tags || []).map(t => {
          const tagLeads = (leads || []).filter(l => Array.isArray(l.tags) && l.tags.includes(t.name)).length;
          return (
            <div
              key={t.id}
              className="group flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/10 transition"
            >
              <ColorBadge color={t.color || 'blue'} name={t.name} />
              <div className="flex-1"></div>
              <span className="num text-[11.5px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{tagLeads}</span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                <IconBtn icon={<Pencil size={13} />} kind="edit" title="Editar" onClick={() => { setName(t.name); setColor(t.color || 'blue'); setEditingId(t.id); }} />
                <IconBtn icon={<Trash2 size={13} />} kind="danger" title="Excluir" onClick={() => handleDelete(t)} />
              </div>
            </div>
          );
        })}
      </div>
    </SettingsCard>
  );
}

function ManageLossReasonsTab({ db, lossReasons, leads }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    if (editingId) {
      const oldReason = lossReasons.find(r => r.id === editingId);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', LOSS_REASONS_PATH, editingId), { name }, { merge: true });

      if (oldReason && oldReason.name !== name) {
        const leadsToUpdate = (leads || []).filter(l => l.lossReason === oldReason.name);
        if (leadsToUpdate.length > 0) {
          const ops = leadsToUpdate.map(lead => ({
            ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
            data: { lossReason: name }
          }));
          await commitOpsInChunks(db, ops, 400);
        }
      }
      setEditingId(null);
    } else {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', LOSS_REASONS_PATH), { name, createdAt: serverTimestamp() });
    }
    setName('');
  };

  const handleDelete = async (r) => {
    const leadsWithReason = (leads || []).filter(l => l.lossReason === r.name);
    if (leadsWithReason.length > 0) {
      toast.warning(`Motivo "${r.name}" está em uso por ${leadsWithReason.length} lead(s). Não é possível excluí-lo.`);
      return;
    }
    if (window.confirm(`Tem certeza que deseja excluir o motivo "${r.name}"?`)) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', LOSS_REASONS_PATH, r.id));
      if (editingId === r.id) { setEditingId(null); setName(''); }
    }
  };

  return (
    <SettingsCard
      title="Motivos de perda"
      hint="Justificativas padronizadas para análise de perdas"
      icon={<ThumbsDown size={16} />}
    >
      <form onSubmit={save} className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] mb-5">
        <div className="flex-1 min-w-[220px]">
          <StyledInput
            icon={<ThumbsDown size={14} />}
            placeholder="Novo motivo (ex: Mudou de cidade)"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>
        {editingId ? (
          <div className="flex gap-2">
            <Btn kind="brand" type="submit" icon={<Check size={13} />}>Salvar</Btn>
            <Btn kind="soft" type="button" onClick={() => { setEditingId(null); setName(''); }}>Cancelar</Btn>
          </div>
        ) : (
          <Btn kind="primary" type="submit" icon={<Zap size={13} />}>Criar motivo</Btn>
        )}
      </form>

      {(() => {
        const counts = (lossReasons || []).map(r => ({
          r,
          n: (leads || []).filter(l => l.status === 'Perda' && l.lossReason === r.name).length
        }));
        const total = counts.reduce((s, x) => s + x.n, 0);
        const max = counts.reduce((m, x) => Math.max(m, x.n), 0);
        if (counts.length === 0) {
          return <div className="text-center text-[12.5px] text-slate-400 italic py-12">Nenhum motivo cadastrado ainda.</div>;
        }
        return (
          <div>
            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-white/[0.05] text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              <span>Motivo</span>
              <span>Ocorrências</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
              {counts.map(({ r, n }) => {
                const pct = max ? Math.round((n / max) * 100) : 0;
                const share = total ? Math.round((n / total) * 100) : 0;
                return (
                  <div key={r.id} className="group flex items-center gap-4 px-4 py-3 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition">
                    <span className="w-7 h-7 rounded-lg grid place-items-center bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 shrink-0">
                      <ThumbsDown size={13} />
                    </span>
                    <span className="text-[13.5px] font-medium text-slate-800 dark:text-slate-100 min-w-[160px] flex-shrink-0 truncate">{r.name}</span>
                    <div className="flex-1 flex items-center gap-3 min-w-0">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.05] overflow-hidden">
                        <div className="h-full bg-rose-500 rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                      <span className="num text-[12px] text-slate-500 dark:text-slate-400 w-10 text-right whitespace-nowrap">{share}%</span>
                    </div>
                    <span className="num text-[13px] font-semibold text-slate-800 dark:text-slate-100 w-10 text-right">{n}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                      <IconBtn icon={<Pencil size={13} />} kind="edit" title="Editar" onClick={() => { setName(r.name); setEditingId(r.id); }} />
                      <IconBtn icon={<Trash2 size={13} />} kind="danger" title="Excluir" onClick={() => handleDelete(r)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </SettingsCard>
  );
}

// Configurações Gerais: modalidades da academia + opções de quantidade de aulas.
function ManageGeneralSettingsTab({ db, modalities, trialClassOptions, units, leads, metaWeekdays }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState('blue');
  const [editingId, setEditingId] = useState(null);

  const [optionInput, setOptionInput] = useState('');
  const [savingOpts, setSavingOpts] = useState(false);

  // Unidades (academia) — nome + endereço opcional.
  const [unitName, setUnitName] = useState('');
  const [unitAddr, setUnitAddr] = useState('');
  const [unitEditingId, setUnitEditingId] = useState(null);

  const resetForm = () => { setName(''); setColor('blue'); setEditingId(null); };
  const resetUnitForm = () => { setUnitName(''); setUnitAddr(''); setUnitEditingId(null); };

  const saveUnit = async (e) => {
    e.preventDefault();
    const trimmed = unitName.trim();
    if (!trimmed) return;
    const dup = (units || []).some(u => u.id !== unitEditingId && (u.name || '').trim().toLowerCase() === trimmed.toLowerCase());
    if (dup) { toast.warning(`A unidade "${trimmed}" já existe.`); return; }
    try {
      if (unitEditingId) {
        const old = (units || []).find(u => u.id === unitEditingId);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', UNITS_PATH, unitEditingId), { name: trimmed, address: unitAddr.trim() }, { merge: true });
        // Propaga renomeação para os leads que já têm essa unidade gravada.
        if (old && old.name !== trimmed) {
          const leadsToUpdate = (leads || []).filter(l => l.appointmentUnit === old.name);
          if (leadsToUpdate.length > 0) {
            const ops = leadsToUpdate.map(lead => ({
              ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
              data: { appointmentUnit: trimmed }
            }));
            await commitOpsInChunks(db, ops, 400);
          }
        }
        toast.success('Unidade atualizada.');
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', UNITS_PATH), {
          name: trimmed, address: unitAddr.trim(), order: (units || []).length, createdAt: serverTimestamp()
        });
        toast.success('Unidade criada.');
      }
      resetUnitForm();
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar a unidade.');
    }
  };

  const handleDeleteUnit = async (u) => {
    const inUse = (leads || []).filter(l => l.appointmentUnit === u.name).length;
    if (inUse > 0) {
      toast.warning(`A unidade "${u.name}" está em uso por ${inUse} lead(s). Não é possível excluí-la.`);
      return;
    }
    if (window.confirm(`Excluir a unidade "${u.name}"?`)) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', UNITS_PATH, u.id));
      if (unitEditingId === u.id) resetUnitForm();
    }
  };

  const saveModality = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    // Evita duplicada (case-insensitive), exceto a própria em edição.
    const dup = (modalities || []).some(m => m.id !== editingId && (m.name || '').trim().toLowerCase() === trimmed.toLowerCase());
    if (dup) { toast.warning(`A modalidade "${trimmed}" já existe.`); return; }
    try {
      if (editingId) {
        const old = (modalities || []).find(m => m.id === editingId);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', MODALITIES_PATH, editingId), { name: trimmed, color }, { merge: true });
        // Propaga renomeação para os leads que já têm essa modalidade gravada.
        if (old && old.name !== trimmed) {
          const leadsToUpdate = (leads || []).filter(l => l.appointmentModality === old.name);
          if (leadsToUpdate.length > 0) {
            const ops = leadsToUpdate.map(lead => ({
              ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
              data: { appointmentModality: trimmed }
            }));
            await commitOpsInChunks(db, ops, 400);
          }
        }
        toast.success('Modalidade atualizada.');
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', MODALITIES_PATH), {
          name: trimmed, color, order: (modalities || []).length, createdAt: serverTimestamp()
        });
        toast.success('Modalidade criada.');
      }
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar a modalidade.');
    }
  };

  const handleDelete = async (m) => {
    const inUse = (leads || []).filter(l => l.appointmentModality === m.name).length;
    if (inUse > 0) {
      toast.warning(`A modalidade "${m.name}" está em uso por ${inUse} lead(s). Não é possível excluí-la.`);
      return;
    }
    if (window.confirm(`Excluir a modalidade "${m.name}"?`)) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', MODALITIES_PATH, m.id));
      if (editingId === m.id) resetForm();
    }
  };

  // Persiste a lista completa de opções no config doc.
  const persistOptions = async (next) => {
    const clean = normalizeTrialClassOptions(next);
    setSavingOpts(true);
    try {
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CONFIG_GENERAL_ID),
        { trialClassOptions: clean },
        { merge: true }
      );
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar as opções de aulas.');
    }
    setSavingOpts(false);
  };

  // Liga/desliga um dia da semana na política de Meta Diária (config da
  // academia). 0=dom..6=sáb. Persiste no config geral (write só admin).
  const toggleMetaWeekday = async (dow) => {
    const set = new Set(Array.isArray(metaWeekdays) ? metaWeekdays : [1, 2, 3, 4, 5]);
    if (set.has(dow)) {
      // Não deixa zerar: ao menos um dia precisa valer, senão a Meta Diária
      // nunca dispara (todo dia vira "folga") e o ritmo do mês trava.
      if (set.size === 1) { toast.warning('Mantenha ao menos um dia ativo na meta.'); return; }
      set.delete(dow);
    } else set.add(dow);
    const next = Array.from(set).sort((a, b) => a - b);
    try {
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CONFIG_GENERAL_ID),
        { metaWeekdays: next },
        { merge: true }
      );
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar os dias da meta.');
    }
  };

  const addOption = async (e) => {
    if (e) e.preventDefault();
    const n = Math.floor(Number(optionInput));
    if (!Number.isFinite(n) || n < 1 || n > 99) {
      toast.warning('Informe um número entre 1 e 99.');
      return;
    }
    if ((trialClassOptions || []).includes(n)) {
      toast.warning(`A opção "${n}" já existe.`);
      setOptionInput('');
      return;
    }
    await persistOptions([...(trialClassOptions || []), n]);
    setOptionInput('');
  };

  const removeOption = async (n) => {
    const next = (trialClassOptions || []).filter(x => x !== n);
    if (next.length === 0) {
      toast.warning('Mantenha ao menos uma opção de quantidade.');
      return;
    }
    await persistOptions(next);
  };

  return (
    <>
      <SettingsCard
        title="Dias da meta diária"
        hint="Dias da semana em que a Meta Diária vale para a equipe. A sequência do ritmo do mês pula os dias desligados."
        icon={<Target size={16} />}
      >
        <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06]">
          <div className="flex flex-wrap items-center gap-2">
            {DG_WEEKDAY_NAMES.map((name, dow) => {
              const on = (metaWeekdays || []).includes(dow);
              return (
                <button
                  key={dow}
                  type="button"
                  onClick={() => toggleMetaWeekday(dow)}
                  aria-pressed={on}
                  className={`px-3 h-9 rounded-lg text-[12.5px] font-semibold transition border ${
                    on
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 dark:bg-white/[0.03] dark:text-slate-400 dark:border-white/[0.07] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
          <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-3">
            Dias desligados não contam como meta (folga) e não quebram a sequência do consultor.
          </p>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Aulas experimentais"
        hint="Opções de quantidade que o consultor pode escolher ao agendar (ex: 1, 2, 5, 10, 15)"
        icon={<BookOpen size={16} />}
      >
        <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] space-y-4">
          <form onSubmit={addOption} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[160px]">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Adicionar opção de quantidade
              </label>
              <input
                type="number"
                min={1}
                max={99}
                value={optionInput}
                onChange={e => setOptionInput(e.target.value)}
                placeholder="ex: 15"
                className="w-full h-10 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[14px] num px-3 transition placeholder:text-slate-400"
              />
            </div>
            <Btn kind="primary" type="submit" icon={<Plus size={13} />} disabled={savingOpts}>Adicionar</Btn>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 flex-1 min-w-[200px]">
              O consultor escolhe uma destas opções ao agendar uma aula experimental — o que foi combinado com o aluno.
            </p>
          </form>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Opções disponíveis</div>
            <div className="flex flex-wrap gap-2">
              {(trialClassOptions || []).map(n => (
                <span key={n} className="inline-flex items-center gap-1.5 h-8 pl-3 pr-1.5 rounded-lg bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                  <span className="num">{n} {n === 1 ? 'aula' : 'aulas'}</span>
                  <button
                    type="button"
                    onClick={() => removeOption(n)}
                    title="Remover opção"
                    className="w-5 h-5 grid place-items-center rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Modalidades"
        hint="Modalidades da academia (ex: Musculação, Funcional, Cross)"
        icon={<Dumbbell size={16} />}
      >
        <form onSubmit={saveModality} className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] mb-5">
          <div className="flex-1 min-w-[220px]">
            <StyledInput
              icon={<Dumbbell size={14} />}
              placeholder="Nova modalidade (ex: Musculação)"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="flex items-center gap-1.5">
            {SETTINGS_COLOR_OPTIONS.map(c => (
              <ColorDot key={c} color={c} active={color === c} onClick={() => setColor(c)} />
            ))}
          </div>
          {editingId ? (
            <div className="flex gap-2">
              <Btn kind="brand" type="submit" icon={<Check size={13} />}>Salvar</Btn>
              <Btn kind="soft" type="button" onClick={resetForm}>Cancelar</Btn>
            </div>
          ) : (
            <Btn kind="primary" type="submit" icon={<Zap size={13} />}>Criar modalidade</Btn>
          )}
        </form>

        {(modalities || []).length === 0 ? (
          <div className="text-center text-[12.5px] text-slate-400 italic py-12">Nenhuma modalidade cadastrada ainda.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
            {(modalities || []).map(m => {
              const inUse = (leads || []).filter(l => l.appointmentModality === m.name).length;
              return (
                <div key={m.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition">
                  <ColorDot color={m.color || 'blue'} active={false} onClick={() => {}} size={18} />
                  <span className="text-[13.5px] font-medium text-slate-800 dark:text-slate-100 flex-1 truncate">{m.name}</span>
                  {inUse > 0 && (
                    <span className="num text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">{inUse} lead(s)</span>
                  )}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <IconBtn icon={<Pencil size={13} />} kind="edit" title="Editar" onClick={() => { setName(m.name); setColor(m.color || 'blue'); setEditingId(m.id); }} />
                    <IconBtn icon={<Trash2 size={13} />} kind="danger" title="Excluir" onClick={() => handleDelete(m)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SettingsCard>

      <SettingsCard
        title="Unidades"
        hint="Unidades/endereços da academia (usadas ao agendar uma visita)"
        icon={<Building2 size={16} />}
      >
        <form onSubmit={saveUnit} className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] mb-5">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Nome</label>
            <StyledInput icon={<Building2 size={14} />} placeholder="Ex: Moinhos" value={unitName} onChange={e => setUnitName(e.target.value)} required />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Endereço (opcional)</label>
            <StyledInput placeholder="Ex: R. Padre Chagas, 320" value={unitAddr} onChange={e => setUnitAddr(e.target.value)} />
          </div>
          {unitEditingId ? (
            <div className="flex gap-2">
              <Btn kind="brand" type="submit" icon={<Check size={13} />}>Salvar</Btn>
              <Btn kind="soft" type="button" onClick={resetUnitForm}>Cancelar</Btn>
            </div>
          ) : (
            <Btn kind="primary" type="submit" icon={<Zap size={13} />}>Criar unidade</Btn>
          )}
        </form>

        {(units || []).length === 0 ? (
          <div className="text-center text-[12.5px] text-slate-400 italic py-12">Nenhuma unidade cadastrada ainda.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
            {(units || []).map(u => {
              const inUse = (leads || []).filter(l => l.appointmentUnit === u.name).length;
              return (
                <div key={u.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition">
                  <span className="w-7 h-7 rounded-lg grid place-items-center bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300 shrink-0">
                    <Building2 size={13} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium text-slate-800 dark:text-slate-100 truncate">{u.name}</div>
                    {u.address && <div className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">{u.address}</div>}
                  </div>
                  {inUse > 0 && <span className="num text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">{inUse} lead(s)</span>}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <IconBtn icon={<Pencil size={13} />} kind="edit" title="Editar" onClick={() => { setUnitName(u.name); setUnitAddr(u.address || ''); setUnitEditingId(u.id); }} />
                    <IconBtn icon={<Trash2 size={13} />} kind="danger" title="Excluir" onClick={() => handleDeleteUnit(u)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SettingsCard>
    </>
  );
}

function TransferLeadsTab({ db, usersList, appUser, leads }) {
  const toast = useToast();
  const [fromUser, setFromUser] = useState('');
  const [toUser, setToUser] = useState('');
  const [loading, setLoading] = useState(false);

  const orphanedConsultants = useMemo(() => {
    if (!leads || !usersList) return [];
    const activeIds = new Set(usersList.map(u => u.id));
    const orphans = new Map();
    leads.forEach(l => {
      if (l.consultantId && !activeIds.has(l.consultantId)) {
        if (!orphans.has(l.consultantId)) {
          orphans.set(l.consultantId, {
            id: l.consultantId,
            name: l.consultantName ? `${l.consultantName} (Excluído)` : `Consultor Excluído (${l.consultantId.substring(0, 4)})`
          });
        }
      }
    });
    return Array.from(orphans.values());
  }, [leads, usersList]);

  const allFromConsultants = [...(usersList || []), ...orphanedConsultants];

  const handleTransfer = async () => {
    if (!fromUser || !toUser) { toast.warning('Selecione consultor de origem e de destino.'); return; }
    if (fromUser === toUser) { toast.warning('Origem e destino são os mesmos.'); return; }
    // Confirmação informativa: operação em massa e irreversível. Mostra
    // quantos leads, de quem para quem, e o escopo (base inteira + interações).
    const fromObj = (allFromConsultants || []).find(u => u.id === fromUser);
    const toObj = (usersList || []).find(u => u.id === toUser);
    const totalToMove = (leads || []).filter(l => l.consultantId === fromUser).length;
    if (!window.confirm(
      `Migrar ${totalToMove} lead(s) de "${fromObj?.name || 'origem'}" para "${toObj?.name || 'destino'}"?\n\n` +
      `Inclui toda a base do consultor de origem (ativos, Venda e Perda) e todas as interações vinculadas. Esta ação não pode ser desfeita.`
    )) return;

    setLoading(true);

    try {
      const q = query(
        collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH),
        where("consultantId", "==", fromUser)
      );

      const snap = await getDocs(q);
      const targetUser = (usersList || []).find(u => u.id === toUser);

      const movedLeadIds = [];
      const leadOps = [];
      let count = 0;

      snap.forEach(l => {
        movedLeadIds.push(l.id);

        leadOps.push({
          ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, l.id),
          data: {
            consultantId: toUser,
            consultantName: targetUser?.name || "Consultor",
            consultantAuthUid: targetUser?.authUid || null
          }
        });

        count++;
      });

      await commitOpsInChunks(db, leadOps);

      if (movedLeadIds.length > 0) {
        const movedSet = new Set(movedLeadIds);
        const interactionsSnap = await getDocs(
          collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH)
        );

        const interactionOps = [];

        interactionsSnap.forEach(interactionDoc => {
          const item = interactionDoc.data();
          if (!item.leadId || !movedSet.has(item.leadId)) return;

          interactionOps.push({
            ref: doc(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH, interactionDoc.id),
            data: {
              leadConsultantId: toUser,
              leadConsultantAuthUid: targetUser?.authUid || null
            }
          });
        });

        await commitOpsInChunks(db, interactionOps);
      }

      await addDoc(
        collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH),
        {
          text: `MIGRAÇÃO MASTER: ${count} leads movidos para [${targetUser?.name || "Novo Consultor"}].`,
          consultantName: appUser.name,
          type: 'note',
          createdAt: serverTimestamp()
        }
      );

      toast.success(`${count} lead(s) migrado(s) com sucesso.`);
      setFromUser('');
      setToUser('');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao migrar leads. Tente novamente.');
    }

    setLoading(false);
  };

  return (
    <SettingsCard
      title="Migrar leads"
      hint="Transfira a base de um consultor para outro"
      icon={<ArrowRightLeft size={16} />}
    >
      {(() => {
        const fromObj = (allFromConsultants || []).find(u => u.id === fromUser);
        const toObj = (usersList || []).find(u => u.id === toUser);
        const fromLeadsCount = fromUser ? (leads || []).filter(l => l.consultantId === fromUser && l.status !== 'Venda' && l.status !== 'Perda').length : 0;
        const toLeadsCount = toUser ? (leads || []).filter(l => l.consultantId === toUser && l.status !== 'Venda' && l.status !== 'Perda').length : 0;
        const totalFromBase = fromUser ? (leads || []).filter(l => l.consultantId === fromUser).length : 0;
        const canSubmit = fromUser && toUser && fromUser !== toUser && !loading;

        return (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
              {/* ORIGEM */}
              <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/60 dark:bg-white/[0.02] p-4">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">Origem</div>
                <StyledSelect value={fromUser} onChange={e => setFromUser(e.target.value)}>
                  <option value="">Selecione o consultor de origem...</option>
                  {(allFromConsultants || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </StyledSelect>
                {fromObj && (
                  <div className="mt-4 flex items-center gap-3">
                    <Avatar name={fromObj.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[13.5px] truncate">{fromObj.name}</div>
                      {fromObj.email && <div className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">{fromObj.email}</div>}
                    </div>
                    <div className="ml-auto text-right shrink-0">
                      <div className="num text-[20px] font-semibold tracking-tight leading-none">{fromLeadsCount}</div>
                      <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap">leads ativos</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Arrow */}
              <div className="hidden lg:flex flex-col items-center justify-center px-2">
                <div className="w-10 h-10 rounded-full bg-brand-600 text-white grid place-items-center shadow-card">
                  <ArrowRightLeft size={16} />
                </div>
              </div>

              {/* DESTINO */}
              <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/60 dark:bg-white/[0.02] p-4">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">Destino</div>
                <StyledSelect value={toUser} onChange={e => setToUser(e.target.value)}>
                  <option value="">Selecione o consultor de destino...</option>
                  {(usersList || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </StyledSelect>
                {toObj && (
                  <div className="mt-4 flex items-center gap-3">
                    <Avatar name={toObj.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[13.5px] truncate">{toObj.name}</div>
                      {toObj.email && <div className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">{toObj.email}</div>}
                    </div>
                    <div className="ml-auto text-right shrink-0">
                      <div className="num text-[20px] font-semibold tracking-tight leading-none">{toLeadsCount}</div>
                      <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap">leads ativos</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Summary */}
            {fromObj && toObj && (
              <div className="mt-6 p-4 rounded-xl bg-amber-50/70 dark:bg-amber-500/[0.06] border border-amber-200/70 dark:border-amber-500/20 flex items-start gap-3">
                <AlertCircle size={16} className="text-amber-600 dark:text-amber-300 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-amber-900 dark:text-amber-200">
                    <span className="num font-semibold">{totalFromBase}</span> {totalFromBase === 1 ? 'lead será migrado' : 'leads serão migrados'} de <span className="font-semibold">{fromObj.name}</span> para <span className="font-semibold">{toObj.name}</span>.
                  </p>
                  <p className="text-[12px] text-amber-800/80 dark:text-amber-200/80 mt-0.5">
                    Inclui toda a base do consultor de origem (ativos, Venda e Perda) + todas as interações vinculadas.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <Btn kind="soft" onClick={() => { setFromUser(''); setToUser(''); }}>Cancelar</Btn>
              <Btn kind="brand" icon={<ArrowRightLeft size={13} />} onClick={handleTransfer} disabled={!canSubmit}>
                {loading ? 'Migrando...' : 'Confirmar migração'}
              </Btn>
            </div>
          </>
        );
      })()}
    </SettingsCard>
  );
}

// ==========================================
// DAILY GOAL VIEW — DESIGN PRIMITIVES
// ==========================================

const initials = (name) =>
  (name || '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

const AVATAR_PALETTES = [
  ['#fde68a', '#92400e'],
  ['#bbf7d0', '#065f46'],
  ['#bae6fd', '#075985'],
  ['#fbcfe8', '#9d174d'],
  ['#ddd6fe', '#5b21b6'],
  ['#fecaca', '#9f1212'],
  ['#a7f3d0', '#065f46'],
  ['#fef08a', '#854d0e']
];

const avatarTone = (seed) => {
  const s = String(seed || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTES[h % AVATAR_PALETTES.length];
};

function Avatar({ name, size = 36 }) {
  const [bg, fg] = avatarTone(name);
  return (
    <div
      className="rounded-full grid place-items-center font-semibold shrink-0 ring-1 ring-black/[0.04]"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </div>
  );
}

// Slug-keyed metadata for the 4 daily goal categories (matches src/lib/leads.js).
const DG_CATEGORY_META = {
  [DAILY_GOAL_CATEGORIES.NOVO_24H]: { label: DAILY_GOAL_CATEGORY_LABEL.novo_24h, short: 'Novos leads', color: 'blue', Icon: Zap },
  [DAILY_GOAL_CATEGORIES.VISITA_HOJE]: { label: DAILY_GOAL_CATEGORY_LABEL.visita_hoje, short: 'Visitas', color: 'violet', Icon: Building2 },
  [DAILY_GOAL_CATEGORIES.AULA_HOJE]: { label: DAILY_GOAL_CATEGORY_LABEL.aula_hoje, short: 'Aulas exp.', color: 'amber', Icon: BookOpen },
  [DAILY_GOAL_CATEGORIES.CONTATO_HOJE]: { label: DAILY_GOAL_CATEGORY_LABEL.contato_hoje, short: 'Contatos', color: 'teal', Icon: MessageSquare },
  [DAILY_GOAL_CATEGORIES.ATRASADO]: { label: DAILY_GOAL_CATEGORY_LABEL.atrasado, short: 'Atrasados', color: 'rose', Icon: AlertCircle }
};

const DG_CATEGORY_ORDER = [
  DAILY_GOAL_CATEGORIES.NOVO_24H,
  DAILY_GOAL_CATEGORIES.VISITA_HOJE,
  DAILY_GOAL_CATEGORIES.AULA_HOJE,
  DAILY_GOAL_CATEGORIES.CONTATO_HOJE,
  DAILY_GOAL_CATEGORIES.ATRASADO
];

const COLOR_TONES = {
  blue: { dot: 'bg-blue-500', text: 'text-blue-700', soft: 'bg-blue-50', strong: 'bg-blue-600', border: 'border-blue-200', darkText: 'dark:text-blue-300', darkSoft: 'dark:bg-blue-500/10' },
  violet: { dot: 'bg-violet-500', text: 'text-violet-700', soft: 'bg-violet-50', strong: 'bg-violet-600', border: 'border-violet-200', darkText: 'dark:text-violet-300', darkSoft: 'dark:bg-violet-500/10' },
  amber: { dot: 'bg-amber-500', text: 'text-amber-700', soft: 'bg-amber-50', strong: 'bg-amber-600', border: 'border-amber-200', darkText: 'dark:text-amber-300', darkSoft: 'dark:bg-amber-500/10' },
  teal: { dot: 'bg-teal-500', text: 'text-teal-700', soft: 'bg-teal-50', strong: 'bg-teal-600', border: 'border-teal-200', darkText: 'dark:text-teal-300', darkSoft: 'dark:bg-teal-500/10' },
  rose: { dot: 'bg-rose-500', text: 'text-rose-700', soft: 'bg-rose-50', strong: 'bg-rose-600', border: 'border-rose-200', darkText: 'dark:text-rose-300', darkSoft: 'dark:bg-rose-500/10' }
};

function humanizeAge(date, now = new Date()) {
  if (!date) return '';
  const diff = Math.max(0, now - date);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function humanizeUntil(date, now = new Date()) {
  if (!date) return '';
  const diff = date - now;
  if (diff < -60000) return humanizeAge(date, now);
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 1) return 'agora';
  if (mins < 60) return `em ${mins}min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `em ${h}h`;
  const d = Math.floor(h / 24);
  return `em ${d}d`;
}

function formatHourLabel(date) {
  if (!date) return '';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function WhatsappGlyph({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12a8 8 0 1 1-3.2-6.4L20 4l-1.4 3.2A8 8 0 0 1 20 12z" />
      <path d="M8.5 9.5c0 3 2 5 5 5l1.5-1.5-2-1-1 1c-1 0-2-1-2-2l1-1-1-2L9 7c-.5 1-.5 2-.5 2.5z" />
    </svg>
  );
}

function DgCategoryChip({ slug }) {
  const m = DG_CATEGORY_META[slug];
  if (!m) return null;
  const t = COLOR_TONES[m.color];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap ${t.soft} ${t.text} ${t.darkSoft} ${t.darkText}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`}></span>
      {m.short}
    </span>
  );
}

function TimePill({ icon, children, tone = 'slate' }) {
  const toneMap = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-200',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    amber: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap ${toneMap[tone]}`}>
      {icon}
      {children}
    </span>
  );
}

function Btn({ kind = 'secondary', icon, children, onClick, type = 'button', disabled, size = 'sm', className = '' }) {
  const styles = {
    primary:   'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-sm',
    brand:     'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
    secondary: 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 dark:bg-white/[0.04] dark:text-slate-200 dark:border-white/10 dark:hover:bg-white/[0.08]',
    success:   'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm',
    soft:      'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/[0.12]',
    danger:    'bg-white text-rose-600 hover:bg-rose-50 border border-slate-200 dark:bg-white/[0.04] dark:border-white/10 dark:hover:bg-rose-500/10',
    ghost:     'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06]'
  };
  const sizing = size === 'md' ? 'h-9 px-3.5 text-[12.5px]' : 'h-8 px-3 text-[12px]';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 ${sizing} rounded-lg font-semibold whitespace-nowrap transition active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed ${styles[kind] || styles.secondary} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

function IconBtn({ icon, title, onClick, kind = 'default', className = '' }) {
  const styles = {
    default: 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06]',
    edit:    'text-slate-400 hover:text-brand-700 hover:bg-brand-50 dark:hover:text-brand-300 dark:hover:bg-brand-500/10',
    danger:  'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-300 dark:hover:bg-rose-500/10'
  };
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`w-8 h-8 grid place-items-center rounded-lg transition ${styles[kind] || styles.default} ${className}`}
    >
      {icon}
    </button>
  );
}

function Dial({ progress }) {
  const R = 38;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative w-[96px] h-[96px]">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={R} stroke="currentColor" className="text-slate-100 dark:text-white/[0.06]" strokeWidth="8" fill="none" />
        <circle
          cx="50"
          cy="50"
          r={R}
          stroke="currentColor"
          className="text-brand-600"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C - (C * progress) / 100}
          style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.7,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <Target size={26} className="text-brand-600" />
      </div>
    </div>
  );
}

function ProgressHero({ firstName, greeting, counts, totalSlots, doneSlots, progress }) {
  const pendingCount = totalSlots - doneSlots;
  const segs = DG_CATEGORY_ORDER
    .map((c) => ({ c, n: counts[c] || 0 }))
    .filter((s) => s.n > 0);
  const sum = segs.reduce((s, x) => s + x.n, 0) || 1;

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-6 shadow-card">
      <div className="flex items-start justify-between gap-8 flex-wrap">
        <div className="max-w-xl min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Target size={13} className="text-brand-600" /> Meta diária
          </div>
          <h2 className="mt-1.5 font-display text-[26px] font-semibold tracking-tight leading-tight">
            {greeting}, {firstName}.{' '}
            {pendingCount > 0 ? (
              <>
                Você tem <span className="text-brand-600">{pendingCount} {pendingCount === 1 ? 'tarefa' : 'tarefas'}</span> antes de fechar o dia.
              </>
            ) : totalSlots === 0 ? (
              <span className="text-slate-500">Nenhuma tarefa por hoje. Aproveite o turno.</span>
            ) : (
              <span className="text-emerald-600">Meta batida!</span>
            )}
          </h2>
          <p className="mt-2 text-[13.5px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Foque nos novos leads recentes e nas visitas/aulas agendadas. Os atrasados podem esperar o fim do turno.
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-5">
          <div className="text-right">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Concluído hoje</div>
            <div className="num text-[44px] font-semibold leading-none tracking-tight mt-1">
              {progress}
              <span className="text-[22px] text-slate-400 dark:text-slate-500">%</span>
            </div>
            <div className="text-[12px] text-slate-500 dark:text-slate-400 num mt-1">
              {doneSlots} de {totalSlots} tarefas
            </div>
          </div>
          <Dial progress={progress} />
        </div>
      </div>

      <div className="mt-6">
        <div className="h-2 rounded-full bg-slate-100 dark:bg-white/[0.05] overflow-hidden flex gap-[2px]">
          {segs.map((s) => {
            const m = DG_CATEGORY_META[s.c];
            const t = COLOR_TONES[m.color];
            return (
              <div
                key={s.c}
                className={`seg h-full ${t.strong} opacity-90`}
                style={{ flexBasis: `${(s.n / sum) * 100}%` }}
                title={`${m.short}: ${s.n}`}
              />
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px]">
          {segs.map((s) => {
            const m = DG_CATEGORY_META[s.c];
            const t = COLOR_TONES[m.color];
            return (
              <span key={s.c} className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className={`w-2 h-2 rounded-full ${t.dot}`}></span>
                <span className="font-medium">{m.short}</span>
                <span className="num text-slate-400">{s.n}</span>
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FilterChip({ active, label, count, color, onClick }) {
  const t = color ? COLOR_TONES[color] : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 px-3 rounded-lg text-[12.5px] font-medium inline-flex items-center gap-2 transition whitespace-nowrap ${active ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 dark:bg-white/[0.03] dark:text-slate-300 dark:border-white/[0.07] dark:hover:bg-white/[0.06]'}`}
    >
      {t && <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`}></span>}
      {label}
      <span className={`num text-[11px] px-1.5 h-[18px] rounded-md grid place-items-center min-w-[18px] ${active ? 'bg-white/15 text-white dark:bg-slate-900/10 dark:text-slate-900' : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'}`}>{count}</span>
    </button>
  );
}

function NextUp({ task, slug, countdownLabel, appointmentLabel, onWhatsapp, onOutcome }) {
  if (!task) return null;
  const m = DG_CATEGORY_META[slug] || DG_CATEGORY_META[DAILY_GOAL_CATEGORIES.VISITA_HOJE];
  const t = COLOR_TONES[m.color];
  // Tipo do compromisso (Visita / Aula Experimental). Sendo aula, mostra
  // também a modalidade e a quantidade de aulas previstas.
  const isAula = slug === DAILY_GOAL_CATEGORIES.AULA_HOJE;
  const TypeIcon = m.Icon;
  const typeLabel = isAula ? 'Aula Experimental' : 'Visita';
  const modality = String(task.appointmentModality || '').trim();
  const qty = Number(task.trialClassesPlanned);
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Próximo compromisso</div>
        {countdownLabel && <span className="num text-[11px] text-slate-400 whitespace-nowrap">{countdownLabel}</span>}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Avatar name={task.name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[14px] truncate">{task.name}</div>
          <div className="text-[12px] text-slate-500 dark:text-slate-400 num">{task.whatsapp}</div>
        </div>
        {appointmentLabel && (
          <div className={`px-2.5 py-1 rounded-lg text-[11.5px] font-semibold whitespace-nowrap ${t.soft} ${t.text} ${t.darkSoft} ${t.darkText}`}>
            {appointmentLabel}
          </div>
        )}
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${t.soft} ${t.text} ${t.darkSoft} ${t.darkText}`}>
          <TypeIcon size={11} /> {typeLabel}{isAula && Number.isFinite(qty) && qty > 0 ? ` · ${qty} ${qty === 1 ? 'aula' : 'aulas'}` : ''}
        </span>
        {isAula && modality && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
            <Dumbbell size={11} /> {modality}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <Btn kind="soft" icon={<WhatsappGlyph size={13} />} onClick={() => onWhatsapp && onWhatsapp(task)}>WhatsApp</Btn>
        {/* NextUp deriva de pendingBySlug (categoria sempre pendente). O campo
            appointmentOutcome no doc pode estar stale de um agendamento anterior,
            por isso não condicionamos o botão a ele. */}
        <Btn kind="success" icon={<CheckCircle size={13} />} onClick={(e) => onOutcome && onOutcome(task, 'attended', slug, e)}>Compareceu</Btn>
      </div>
    </div>
  );
}

// Tipo (ícone + label) do compromisso, usado no card "Amanhã".
function dgApptTypeMeta(lead) {
  const t = getLeadAppointmentType(lead); // 'visita' | 'aula_experimental' | null
  if (t === 'visita') return { Icon: Building2, label: 'Visita' };
  if (t === 'aula_experimental') return { Icon: BookOpen, label: 'Aula exp.' };
  const ft = String(lead?.nextFollowUpType || '');
  if (/liga/i.test(ft)) return { Icon: Phone, label: 'Ligação' };
  if (/mensagem|whats/i.test(ft)) return { Icon: MessageCircle, label: 'Mensagem' };
  return { Icon: MessageSquare, label: 'Contato' };
}

// Nomes dos dias da semana (0=dom..6=sáb), usados no seletor de dias da
// meta nas Configurações Gerais.
const DG_WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Ritmo do mês: dias batidos / sequência / 14 dias. 100% real — lê o
// histórico persistido (não mais mockado). A config de dias é da academia.
function StreakCard({ history14, monthHits, monthTarget, streak }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Ritmo do mês</div>
        <Flame size={14} className="text-amber-500" />
      </div>
      <div className="mt-2 flex items-baseline gap-2 whitespace-nowrap">
        <span className="num text-[22px] font-semibold tracking-tight">{monthHits}/{monthTarget}</span>
        <span className="text-[12px] text-slate-500 dark:text-slate-400">{monthTarget === 1 ? 'dia batido' : 'dias batidos'}</span>
      </div>
      <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: 'repeat(14,minmax(0,1fr))' }}>
        {history14.map((day, i) => (
          <div
            key={i}
            className={`h-5 rounded-[3px] ${
              day.isToday ? 'bg-brand-600/20 ring-1 ring-brand-500'
                : day.hit ? 'bg-emerald-500/80'
                  : day.active ? 'bg-slate-100 dark:bg-white/[0.05]'
                    : 'bg-slate-50 dark:bg-white/[0.02]'
            }`}
            title={`${day.label}${day.hit ? ' · meta batida' : day.active ? ' · não batida' : ' · fora da meta'}`}
          />
        ))}
      </div>
      <div className="mt-2 text-[11.5px] text-slate-500 dark:text-slate-400">
        Sequência atual: <span className="font-semibold text-slate-700 dark:text-slate-200 num">{streak} {streak === 1 ? 'dia' : 'dias'}</span>
      </div>
    </div>
  );
}

function DgSection({ slug, tasks, render }) {
  const m = DG_CATEGORY_META[slug];
  if (!m || !tasks.length) return null;
  const t = COLOR_TONES[m.color];
  const Icon = m.Icon;
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <span className={`w-6 h-6 rounded-md grid place-items-center ${t.soft} ${t.text} ${t.darkSoft} ${t.darkText}`}>
          <Icon size={13} />
        </span>
        <h3 className="text-[13px] font-semibold text-slate-900 dark:text-white">{m.label}</h3>
        <span className="num text-[11.5px] text-slate-500 dark:text-slate-400">{tasks.length}</span>
        <div className="flex-1 h-px bg-slate-100 dark:bg-white/[0.06] ml-1"></div>
      </div>
      <div className="space-y-2.5">
        {tasks.map((task) => render(task, slug))}
      </div>
    </div>
  );
}

// Renders a single (lead × categorySlug) task card.
// Same lead with two pending categories renders TWICE — once per slug — with independent actions per main's per-category status model.
function TaskCard({ task, slug, now, onOpen, onSnooze, onOutcome, onReschedule, onGoalDone, onWhatsapp, onCall }) {
  const m = DG_CATEGORY_META[slug];
  if (!m) return null;
  const t = COLOR_TONES[m.color];
  const isAppt = slug === DAILY_GOAL_CATEGORIES.VISITA_HOJE || slug === DAILY_GOAL_CATEGORIES.AULA_HOJE;
  const isOverdue = slug === DAILY_GOAL_CATEGORIES.ATRASADO;
  const isNovo = slug === DAILY_GOAL_CATEGORIES.NOVO_24H;
  const isContato = slug === DAILY_GOAL_CATEGORIES.CONTATO_HOJE;
  const Icon = m.Icon;

  // Contato: especifica se o follow-up agendado é Ligação ou Mensagem
  // (lido de nextFollowUpType). Fallback "Contato" p/ tipo genérico/legado.
  const followUpType = String(task.nextFollowUpType || '');
  const isLigacao = /liga/i.test(followUpType);
  const isMensagem = /mensagem|whats/i.test(followUpType);
  const contatoTypeLabel = isLigacao ? 'Ligação' : isMensagem ? 'Mensagem' : 'Contato';
  const ContatoIcon = isLigacao ? Phone : MessageCircle;
  const contatoDate = isContato && task.nextFollowUp instanceof Date && !isNaN(task.nextFollowUp.getTime())
    ? task.nextFollowUp : null;
  // Observação que o consultor registrou ao agendar o contato.
  const followUpNote = String(task.nextFollowUpNote || '').trim();
  // TaskCard só renderiza para categorias pendentes (filtro em pendingBySlug),
  // então qualquer appointmentOutcome no documento é de um agendamento ANTERIOR
  // já tratado (o campo persiste entre agendamentos). Ignorar para não
  // bloquear as ações do agendamento atual com um "Desfecho registrado" stale.
  const outcome = null;
  const outcomeMeta = null;

  const apptDate = getLeadAppointmentDate(task);
  const appointmentLabel = (isAppt && apptDate) ? `Hoje · ${formatHourLabel(apptDate)}` : null;
  const enteredAtLabel = (isNovo && task.createdAt) ? formatHourLabel(task.createdAt) : null;
  const age = isNovo ? humanizeAge(task.createdAt, now) : null;
  // TODO: substituir por critério Hot/Cold real (src/lib/leads) quando integrado aqui
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const isHot = isNovo && task.createdAt && task.createdAt >= oneHourAgo;
  const overdueDays = (isOverdue && task.nextFollowUp)
    ? Math.max(1, Math.ceil((new Date().setHours(0, 0, 0, 0) - task.nextFollowUp) / 86400000))
    : 0;
  const note = task.observation || '';

  return (
    <div className="task-card group bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200/80 dark:border-white/[0.06] shadow-card hover:shadow-card-lg hover:border-slate-300 dark:hover:border-white/10 transition fade-in">
      <div className="p-3.5 flex items-start gap-3 cursor-pointer" onClick={() => onOpen && onOpen(task)}>
        <Avatar name={task.name} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="font-semibold text-[14px] text-slate-900 dark:text-white truncate">{task.name}</span>
            {isHot && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-300">
                <Flame size={11} /> Quente
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[12px] text-slate-500 dark:text-slate-400 num flex-wrap">
            <span>{task.whatsapp}</span>
            {task.source && (
              <>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-white/20"></span>
                <span className="truncate">{task.source}</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            <DgCategoryChip slug={slug} />
            {isContato && (
              <TimePill icon={<ContatoIcon size={11} />}>
                {contatoTypeLabel}{contatoDate ? <span className="opacity-60"> · Hoje {formatHourLabel(contatoDate)}</span> : null}
              </TimePill>
            )}
            {appointmentLabel && (
              <TimePill icon={<Calendar size={11} />}>{appointmentLabel}</TimePill>
            )}
            {enteredAtLabel && (
              <TimePill icon={<Clock size={11} />}>
                Entrou {enteredAtLabel}{age ? <span className="opacity-60"> · {age}</span> : null}
              </TimePill>
            )}
            {isOverdue && overdueDays > 0 && (
              <TimePill icon={<AlertCircle size={11} />} tone="rose">{overdueDays} {overdueDays === 1 ? 'dia' : 'dias'} atrasado</TimePill>
            )}
            {task.hasOtherActivityToday && (
              <TimePill icon={<Check size={11} />} tone="amber">Já interagido — feche pela Meta</TimePill>
            )}
            {outcomeMeta && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${outcomeMeta.badgeClass}`}>
                {outcomeMeta.icon} {outcomeMeta.label}
              </span>
            )}
          </div>

          {followUpNote && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.05] px-2.5 py-1.5 text-[12.5px] leading-snug text-slate-600 dark:text-slate-300">
              <MessageSquare size={12} className="mt-0.5 shrink-0 text-slate-400" />
              <span className="clip-2">{followUpNote}</span>
            </div>
          )}
          {note && (
            <p className="text-[12.5px] leading-snug text-slate-500 dark:text-slate-400 mt-2 clip-1">{note}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className={`w-8 h-8 grid place-items-center rounded-lg ${t.soft} ${t.text} ${t.darkSoft} ${t.darkText}`}>
            <Icon size={15} />
          </div>
          <IconBtn icon={<MoreHorizontal size={16} />} title="Mais" onClick={(e) => { e.stopPropagation(); onOpen && onOpen(task); }} />
        </div>
      </div>

      <div className="px-3.5 pb-3 pt-1 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Btn kind="soft" icon={<WhatsappGlyph size={14} />} onClick={(e) => { e.stopPropagation(); onWhatsapp && onWhatsapp(task); }}>WhatsApp</Btn>
          <IconBtn icon={<Phone size={15} />} title="Ligar" onClick={(e) => { e.stopPropagation(); onCall && onCall(task); }} />
          {!isAppt && (
            <IconBtn icon={<Calendar size={15} />} title="Adiar p/ amanhã" onClick={(e) => onSnooze && onSnooze(task, e)} />
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {isAppt ? (
            <>
              <Btn kind="success" icon={<Check size={13} />} onClick={(e) => onOutcome && onOutcome(task, 'attended', slug, e)}>Compareceu</Btn>
              <Btn kind="secondary" icon={<X size={13} />} onClick={(e) => onOutcome && onOutcome(task, 'no_show', slug, e)}>Não veio</Btn>
              <Btn kind="soft" onClick={(e) => { e.stopPropagation(); onReschedule && onReschedule(task, slug); }}>Remarcou</Btn>
              <Btn kind="soft" onClick={(e) => onOutcome && onOutcome(task, 'cancelled', slug, e)}>Cancelou</Btn>
            </>
          ) : (
            <Btn kind="primary" icon={<Check size={14} />} onClick={(e) => { e.stopPropagation(); onGoalDone && onGoalDone(task, slug, '', e); }}>Concluir</Btn>
          )}
        </div>
      </div>
    </div>
  );
}

function DoneCard({ lead, onOpen, onReschedule }) {
  const firstDoneSlug = (lead.categorySlugs || []).find(s => lead.categoryStatus?.[s]);
  const outcomeMeta = lead.appointmentOutcome ? getAppointmentOutcomeMeta(lead.appointmentOutcome) : null;
  const apptSlug = (lead.categorySlugs || []).find(
    s => s === DAILY_GOAL_CATEGORIES.VISITA_HOJE || s === DAILY_GOAL_CATEGORIES.AULA_HOJE
  );
  return (
    <div
      onClick={() => onOpen && onOpen(lead)}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.05] cursor-pointer hover:bg-white dark:hover:bg-white/[0.04] transition"
    >
      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 grid place-items-center pop">
        <Check size={13} />
      </div>
      <Avatar name={lead.name} size={28} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-[13px] text-slate-800 dark:text-slate-100 line-through decoration-slate-400/60 truncate">{lead.name}</span>
          {firstDoneSlug && <DgCategoryChip slug={firstDoneSlug} />}
        </div>
        {outcomeMeta ? (
          <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{outcomeMeta.icon} {outcomeMeta.label}</div>
        ) : (
          <div className="text-[11.5px] text-slate-500 dark:text-slate-400">Concluído</div>
        )}
      </div>
      {apptSlug && onReschedule && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onReschedule(lead, apptSlug); }}
          title="Remarcar agendamento"
          className="w-7 h-7 grid place-items-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] transition shrink-0"
        >
          <RefreshCw size={13} />
        </button>
      )}
      <ChevronRight size={16} className="text-slate-400" />
    </div>
  );
}

// Build a `YYYY-MM-DDTHH:MM` string in LOCAL time for <input type="datetime-local">.
function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Chave de dia em hora LOCAL ('YYYY-MM-DD'), usada como ID do histórico de
// metas batidas. Local (não UTC) para o dia bater com o fuso do consultor.
function dgDateKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Botão de tipo do RescheduleModal — fora do componente pai para não ser
// recriado a cada render (evitava perder foco/estado dos inputs irmãos do modal).
function RescheduleTypeBtn({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 h-9 px-3 rounded-lg text-[12.5px] font-semibold transition border ${
        active
          ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-white/[0.03] dark:text-slate-300 dark:border-white/[0.07] dark:hover:bg-white/[0.06]'
      }`}
    >
      {label}
    </button>
  );
}

function RescheduleModal({ lead, categorySlug, currentDate, currentType, flow = 'manual', onConfirm, onClose }) {
  const isAfterNoShow = flow === 'after_no_show';
  const { modalities, trialClassOptions } = useGeneralConfig();

  const defaultValue = useMemo(() => {
    const base = currentDate ? new Date(currentDate) : new Date();
    base.setDate(base.getDate() + 1);
    return toDatetimeLocalValue(base);
  }, [currentDate]);

  const initialType = currentType === 'aula_experimental' || categorySlug === DAILY_GOAL_CATEGORIES.AULA_HOJE
    ? 'aula_experimental'
    : 'visita';

  const [dateValue, setDateValue] = useState(defaultValue);
  const [apptType, setApptType] = useState(initialType);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Aula experimental: modalidade + quantidade (semeadas do lead, se houver).
  const [modality, setModality] = useState(lead?.appointmentModality || '');
  const [qty, setQty] = useState(() => {
    const n = Number(lead?.trialClassesPlanned);
    return Number.isFinite(n) && n > 0 ? n : ((trialClassOptions && trialClassOptions[0]) || 1);
  });

  // Garante que a opção semeada do lead apareça no select mesmo que não esteja
  // mais na lista configurada (ex.: opção removida depois do agendamento).
  const qtyOptions = useMemo(() => {
    const base = (trialClassOptions && trialClassOptions.length ? trialClassOptions : [1]);
    return base.includes(qty) ? base : [...base, qty].sort((a, b) => a - b);
  }, [trialClassOptions, qty]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dateValue || submitting) return;
    const newDate = new Date(dateValue);
    if (isNaN(newDate.getTime())) return;
    const isAula = apptType === 'aula_experimental';
    const finalQty = Number(qty) > 0 ? Math.floor(Number(qty)) : ((trialClassOptions && trialClassOptions[0]) || 1);
    setSubmitting(true);
    await onConfirm(newDate, note, apptType, isAula ? (modality || '').trim() : null, isAula ? finalQty : null);
    setSubmitting(false);
  };

  const title = isAfterNoShow
    ? 'Agendar próxima tentativa'
    : `Remarcar ${apptType === 'aula_experimental' ? 'aula experimental' : 'visita'}`;

  const helperText = isAfterNoShow
    ? 'A tarefa de hoje já foi marcada como "Não veio". O lead voltará à Meta Diária na nova data.'
    : 'A tarefa de hoje será concluída e o lead voltará para a sua Meta Diária na nova data.';

  return createPortal(
    <>
      <div onClick={onClose} className="fixed inset-0 z-[110] bg-slate-900/40 dark:bg-black/60 backdrop-blur-md animate-fade-in" />
      <div className="fixed inset-0 z-[111] grid place-items-center p-4 animate-fade-in pointer-events-none">
        <form onSubmit={handleSubmit} className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full p-6 pointer-events-auto">
          <div className="flex items-start gap-3 mb-5">
            <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 text-lg ${
              isAfterNoShow
                ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
            }`}>
              {isAfterNoShow ? '↻' : '🔄'}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">{title}</h3>
              <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{lead.name} · <span className="num">{lead.whatsapp}</span></p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Tipo
              </label>
              <div className="flex gap-2">
                <RescheduleTypeBtn active={apptType === 'visita'} onClick={() => setApptType('visita')} label="Visita" />
                <RescheduleTypeBtn active={apptType === 'aula_experimental'} onClick={() => setApptType('aula_experimental')} label="Aula Experimental" />
              </div>
            </div>
            <div>
              <label className="block text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Nova data e horário
              </label>
              <input
                type="datetime-local"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[14px] num focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                required
                autoFocus
              />
            </div>
            {apptType === 'aula_experimental' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Modalidade
                  </label>
                  <select
                    value={modality}
                    onChange={(e) => setModality(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 appearance-none cursor-pointer"
                  >
                    <option value="">{(modalities || []).length ? 'Selecione...' : 'Cadastre em Config. Gerais'}</option>
                    {(modalities || []).map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Aulas previstas
                  </label>
                  <select
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[14px] num focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 appearance-none cursor-pointer"
                  >
                    {qtyOptions.map(n => (
                      <option key={n} value={n}>{n} {n === 1 ? 'aula' : 'aulas'}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div>
              <label className="block text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Observação (opcional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder={isAfterNoShow ? 'Ex: combinar pela manhã, ligar antes' : 'Ex: lead pediu para remarcar por motivo de trabalho'}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none"
              />
            </div>
          </div>

          <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-4 leading-relaxed">{helperText}</p>

          <div className="mt-5 flex items-center justify-end gap-2">
            <Btn kind="secondary" onClick={onClose}>
              {isAfterNoShow ? 'Não remarcar agora' : 'Cancelar'}
            </Btn>
            <button
              type="submit"
              disabled={submitting || !dateValue}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold whitespace-nowrap transition active:scale-[.98] bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={14} />
              {submitting ? 'Salvando...' : (isAfterNoShow ? 'Confirmar agendamento' : 'Confirmar remarcação')}
            </button>
          </div>
        </form>
      </div>
    </>,
    document.body
  );
}

// ==========================================
// DAILY GOAL VIEW (META DIÁRIA)
// ==========================================

function DailyGoalView({ leads, interactions, appUser, statuses, db, tags, lossReasons, usersList, funnels }) {
  const toast = useToast();
  const [selectedLead, setSelectedLead] = useState(null);
  const [filter, setFilter] = useState('all');
  const [now, setNow] = useState(() => new Date());
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const prevProgress = useRef(0);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Ritmo do mês (histórico de metas batidas, por consultor) ──────────
  // Dias da semana em que a meta vale (0=dom..6=sáb) — política da ACADEMIA,
  // definida pelo admin nas Configurações Gerais. A sequência pula os dias
  // inativos (não quebram nem contam). Default seg–sex.
  const { metaWeekdays = [1, 2, 3, 4, 5] } = useGeneralConfig();

  // Histórico persistido: 1 doc por dia que o consultor zerou a meta.
  const [dailyHistory, setDailyHistory] = useState([]);
  useEffect(() => {
    if (!appUser?.authUid) return;
    const ref = collection(db, 'artifacts', appId, 'public', 'data', DAILY_GOAL_HISTORY_PATH);
    const unsub = onSnapshot(
      query(ref, where('consultantAuthUid', '==', appUser.authUid)),
      (snap) => setDailyHistory(snap.docs.map(d => d.data())),
      () => { /* regras ainda não publicadas → mantém vazio sem quebrar a UI */ }
    );
    return () => unsub();
  }, [db, appUser]);

  // Grava (idempotente) a marca de "meta batida hoje". ID determinístico
  // por (consultor, dia) → setDoc/merge não duplica.
  const recordGoalHit = async () => {
    if (!appUser?.authUid) return;
    const key = dgDateKey(new Date());
    try {
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', DAILY_GOAL_HISTORY_PATH, `${appUser.id}_${key}`),
        {
          consultantId: appUser.id,
          consultantAuthUid: appUser.authUid,
          consultantName: appUser.name || null,
          date: key,
          hitAt: serverTimestamp()
        },
        { merge: true }
      );
    } catch { /* regras podem não estar publicadas ainda — silencioso */ }
  };

  const ritmoMes = useMemo(() => {
    const hits = new Set(dailyHistory.map(h => h.date).filter(Boolean));
    const isActive = (d) => metaWeekdays.includes(d.getDay());

    const history14 = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      history14.push({ hit: hits.has(dgDateKey(d)), active: isActive(d), isToday: i === 0, label: d.toLocaleDateString('pt-BR') });
    }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    let monthHits = 0, monthTarget = 0;
    for (let day = 1; day <= today.getDate(); day++) {
      const d = new Date(today.getFullYear(), today.getMonth(), day);
      if (!isActive(d)) continue;
      monthTarget++;
      if (hits.has(dgDateKey(d))) monthHits++;
    }

    // Sequência: anda para trás a partir de hoje; pula dias inativos; um dia
    // ativo SEM hit quebra (exceto hoje, que ainda está em andamento).
    let streak = 0;
    for (let i = 0; i < 400; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      if (!isActive(d)) continue;
      if (hits.has(dgDateKey(d))) streak++;
      else if (i === 0) continue;
      else break;
    }

    return { history14, monthHits, monthTarget, streak };
  }, [dailyHistory, metaWeekdays]);

  const processedLeads = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayEnd = new Date();
    todayEnd.setHours(23,59,59,999);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const myLeads = (leads || []).filter(l => l.consultantId === appUser.id);
    const allTargetLeadsMap = new Map();

    // Índice de interações por leadId — antes varria TODAS as interações por lead
    // (O(leads × interações), travava a UI em volume). Agora O(interações) p/ montar
    // + lookups O(1). hasGoalDoneToday/hasActiveInteractionToday filtram por leadId
    // internamente, então passar só as do lead dá EXATAMENTE o mesmo resultado.
    const interactionsByLead = new Map();
    (interactions || []).forEach(i => {
      const arr = interactionsByLead.get(i.leadId);
      if (arr) arr.push(i); else interactionsByLead.set(i.leadId, [i]);
    });
    const leadInteractions = (id) => interactionsByLead.get(id) || [];

    // Regra única: tarefa é considerada "feita" SOMENTE se
    //   (a) lead virou Venda/Perda hoje (auto-conclui todas as
    //       categorias do lead — decisão de produto), OU
    //   (b) há uma interaction type='daily_goal_done' criada hoje
    //       com dailyGoalCategory matching aquela categoria.
    // Mover no Kanban, anotar no LeadDetailsModal, mudar fase, etc
    // NÃO marcam a tarefa. O consultor precisa confirmar pela Meta.
    const isCategoryDone = (lead, categorySlug) => {
      if (isLeadResolvedToday(lead, todayStart)) return true;
      return hasGoalDoneToday(lead, categorySlug, leadInteractions(lead.id), todayStart);
    };

    const addTarget = (lead, categoryLabel, categorySlug) => {
      if (!allTargetLeadsMap.has(lead.id)) {
        allTargetLeadsMap.set(lead.id, {
          ...lead,
          categories: [],
          categorySlugs: [],
          categoryStatus: {},
          hasOtherActivityToday: hasActiveInteractionToday(lead, leadInteractions(lead.id), todayStart)
        });
      }
      const entry = allTargetLeadsMap.get(lead.id);
      if (!entry.categorySlugs.includes(categorySlug)) {
        entry.categories.push(categoryLabel);
        entry.categorySlugs.push(categorySlug);
        entry.categoryStatus[categorySlug] = isCategoryDone(lead, categorySlug);
      }
    };

    myLeads.forEach(lead => {
      // 1. Novo Lead 24h
      // A regra entra em vigor APENAS no dia seguinte ao cadastro: leads
      // criados hoje não aparecem nessa categoria (o consultor acabou de
      // cadastrar — não precisa de lembrete imediato). Critério: criado
      // antes do início de hoje E dentro das últimas 24h.
      if (
        lead.createdAt &&
        lead.createdAt < todayStart &&
        lead.createdAt >= oneDayAgo &&
        lead.status !== 'Venda' && lead.status !== 'Perda'
      ) {
        addTarget(lead, DAILY_GOAL_CATEGORY_LABEL.novo_24h, DAILY_GOAL_CATEGORIES.NOVO_24H);
      }

      // 2. Atrasados
      if (lead.status !== 'Venda' && lead.status !== 'Perda' && lead.nextFollowUp && lead.nextFollowUp < todayStart) {
        addTarget(lead, DAILY_GOAL_CATEGORY_LABEL.atrasado, DAILY_GOAL_CATEGORIES.ATRASADO);
      }

      // 3. Visitas Hoje
      if (lead.status !== 'Venda' && lead.status !== 'Perda') {
        const apptType = getLeadAppointmentType(lead);
        const apptDate = getLeadAppointmentDate(lead);
        if (apptType === 'visita' && apptDate >= todayStart && apptDate <= todayEnd) {
          addTarget(lead, DAILY_GOAL_CATEGORY_LABEL.visita_hoje, DAILY_GOAL_CATEGORIES.VISITA_HOJE);
        }
      }

      // 4. Aulas Exp. Hoje
      if (lead.status !== 'Venda' && lead.status !== 'Perda') {
        const apptType = getLeadAppointmentType(lead);
        const apptDate = getLeadAppointmentDate(lead);
        if (apptType === 'aula_experimental' && apptDate >= todayStart && apptDate <= todayEnd) {
          addTarget(lead, DAILY_GOAL_CATEGORY_LABEL.aula_hoje, DAILY_GOAL_CATEGORIES.AULA_HOJE);
        }
      }

      // 5. Contato Hoje — follow-up via Mensagem/Ligação agendado para hoje
      // (qualquer tipo que NÃO seja visita/aula). Pega WhatsApp + ligações sem
      // duplicar quem já está nas seções de visita/aula.
      if (
        lead.status !== 'Venda' &&
        lead.status !== 'Perda' &&
        lead.nextFollowUp &&
        lead.nextFollowUp >= todayStart &&
        lead.nextFollowUp <= todayEnd
      ) {
        const apptType = getLeadAppointmentType(lead);
        if (apptType !== 'visita' && apptType !== 'aula_experimental') {
          addTarget(lead, DAILY_GOAL_CATEGORY_LABEL.contato_hoje, DAILY_GOAL_CATEGORIES.CONTATO_HOJE);
        }
      }
    });

    return Array.from(allTargetLeadsMap.values()).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [leads, appUser, interactions]);

  // Helper para filtragem por categoria. Lead com 2 categorias pode
  // estar "feito" em uma e "pendente" na outra.
  const isLeadDoneForCategory = (lead, categorySlug) =>
    Boolean(lead.categoryStatus?.[categorySlug]);

  // Agora cada lead pode estar em múltiplas categorias e cada uma
  // tem status independente. Total de "slots" = soma das categorias
  // de cada lead. Done = slots concluídos.
  const totalSlots = processedLeads.reduce((acc, l) => acc + l.categorySlugs.length, 0);
  const doneSlots = processedLeads.reduce(
    (acc, l) => acc + l.categorySlugs.filter(s => isLeadDoneForCategory(l, s)).length,
    0
  );
  const total = totalSlots;
  const progress = totalSlots > 0 ? Math.round((doneSlots / totalSlots) * 100) : 100;

  // Para a coluna "Feitos Hoje" — mostra leads que têm AO MENOS uma
  // categoria concluída. Lead pendente em qualquer categoria continua
  // aparecendo na coluna "A Fazer".
  const done = processedLeads.filter(l => l.categorySlugs.some(s => isLeadDoneForCategory(l, s)));
  const pending = processedLeads.filter(l => l.categorySlugs.some(s => !isLeadDoneForCategory(l, s)));


  useEffect(() => {
    if (progress === 100 && prevProgress.current !== 100 && total > 0) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 }, zIndex: 99999 });
      // Registra o dia como "meta batida" (idempotente). Só quando havia
      // tarefa (total > 0) — dia de folga não conta no ritmo.
      recordGoalHit();
    }
    prevProgress.current = progress;
  }, [progress, total]);

  const handleSnooze = async (lead, e) => {
    e.stopPropagation();
    if (!window.confirm("Adiar o contato deste lead para amanhã?")) return;
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), {
        nextFollowUp: tomorrow,
        // A3: limpa o agendamento formal antigo (visita/aula que já passou e
        // virou "Atrasado") para o lead não ficar preso com a data velha em
        // getLeadAppointmentDate — assim ele aparece corretamente em "Amanhã".
        // O tipo de contato (nextFollowUpType: Ligação/Mensagem) é preservado.
        appointmentScheduledFor: null,
        appointmentType: null
      });
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: `Contato adiado para amanhã via Meta Diária.`,
        type: 'note',
        createdAt: serverTimestamp()
      });
    } catch(err) { console.error(err); toast.error('Não foi possível adiar o lead. Tente novamente.'); }
  };

  const handleOutcome = async (lead, outcome, categorySlug, e) => {
    if (e) e.stopPropagation();
    if (!APPOINTMENT_OUTCOMES.includes(outcome)) return;
    const meta = getAppointmentOutcomeMeta(outcome);
    // Auto-move "Compareceu" em visita/aula → fase Negociação no mesmo funil.
    // Só dispara se: (a) a etapa Negociação existe pro funil do lead
    // (a migration garante isso) E (b) o lead ainda não está em Negociação/Venda/Perda.
    const isAttendedAppt =
      outcome === 'attended' &&
      (categorySlug === DAILY_GOAL_CATEGORIES.VISITA_HOJE ||
       categorySlug === DAILY_GOAL_CATEGORIES.AULA_HOJE);
    const negStatus = isAttendedAppt
      ? (statuses || []).find(s =>
          s.funnelId === lead.funnelId &&
          (s.name || '').trim().toLowerCase() === 'negociação'
        )
      : null;
    const shouldPromoteToNegociacao =
      Boolean(negStatus) &&
      lead.status !== negStatus.name &&
      lead.status !== 'Venda' &&
      lead.status !== 'Perda';

    try {
      const leadUpdate = {
        appointmentOutcome: outcome,
        appointmentOutcomeAt: serverTimestamp(),
        appointmentOutcomeBy: appUser.authUid || appUser.id || null
      };
      if (shouldPromoteToNegociacao) {
        leadUpdate.status = negStatus.name; // 'Negociação'
      }
      await updateDoc(
        doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
        leadUpdate
      );
      // Marca a tarefa da Meta como concluída para essa categoria
      // específica. Type='daily_goal_done' é a fonte ÚNICA de verdade
      // para "tarefa cumprida" no fluxo da Meta Diária.
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: `${meta.icon} ${meta.label} — Meta Diária (${DAILY_GOAL_CATEGORY_LABEL[categorySlug] || categorySlug})`,
        type: 'daily_goal_done',
        dailyGoalCategory: categorySlug,
        appointmentOutcome: outcome,
        createdAt: serverTimestamp()
      });
      // Log adicional da mudança de fase para o feed do lead.
      if (shouldPromoteToNegociacao) {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
          leadId: lead.id,
          consultantName: appUser.name,
          ...getInteractionSecurityFields(lead, appUser),
          text: `Fase alterada para [${negStatus.name}] após comparecimento em ${DAILY_GOAL_CATEGORY_LABEL[categorySlug] || categorySlug}.`,
          type: 'status_change',
          createdAt: serverTimestamp()
        });
      }
      if (shouldPromoteToNegociacao) {
        toast.success(`${meta.label} registrado. ${lead.name} → Negociação.`);
      } else {
        toast.success(`${meta.label} registrado para ${lead.name}.`);
      }
      // After 'no_show', immediately offer to reschedule. Today's task is
      // already closed; the modal in 'after_no_show' flow only updates the
      // appointment date without writing another daily_goal_done.
      if (outcome === 'no_show') {
        setRescheduleTarget({ lead, categorySlug, flow: 'after_no_show' });
      }
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível registrar o comparecimento. Tente novamente.');
    }
  };

  const handleGoalDone = async (lead, categorySlug, note, e) => {
    if (e) e.stopPropagation();
    if (!Object.values(DAILY_GOAL_CATEGORIES).includes(categorySlug)) return;
    const categoryLabel = DAILY_GOAL_CATEGORY_LABEL[categorySlug] || categorySlug;
    if (!window.confirm(`Concluir a tarefa "${categoryLabel}" deste lead?`)) return;
    const noteText = (note || '').trim();
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: noteText
          ? `✅ ${categoryLabel} — Meta Diária. Obs: ${noteText}`
          : `✅ ${categoryLabel} — Meta Diária concluída.`,
        type: 'daily_goal_done',
        dailyGoalCategory: categorySlug,
        createdAt: serverTimestamp()
      });
      toast.success(`Tarefa "${categoryLabel}" concluída.`);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível concluir a tarefa. Tente novamente.');
    }
  };

  // Reschedule: opens the date dialog (set on TaskCard click or after no_show), then this commits.
  // Three flows:
  //   - flow='manual', cross-day  → writes daily_goal_done (today's task closes)
  //   - flow='manual', same-day   → writes plain 'note' (task remains pending, just new time)
  //   - flow='after_no_show'      → writes plain 'note' (task already closed via no_show)
  // Always updates appointment fields and clears appointmentOutcome so the
  // new appointment is fresh.
  const handleReschedule = async (newDate, note, newApptType, newModality, newQty) => {
    if (!rescheduleTarget) return;
    const { lead, categorySlug, flow = 'manual' } = rescheduleTarget;
    const categoryLabel = DAILY_GOAL_CATEGORY_LABEL[categorySlug] || categorySlug;
    const formattedDate = newDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formattedTime = newDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const noteText = (note || '').trim();

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const isStillToday = newDate >= todayStart && newDate <= todayEnd;
    const isAfterNoShow = flow === 'after_no_show';
    // Cross-day manual reschedule is the only path that needs to close today's task.
    const shouldCloseToday = !isAfterNoShow && !isStillToday;

    // Type may change during reschedule (decision 4): user can flip Visita ↔ Aula.
    const finalApptType = newApptType || getLeadAppointmentType(lead) || 'visita';
    const finalApptTypeLabel = finalApptType === 'aula_experimental' ? 'Aula Experimental' : 'Visita';
    const isAula = finalApptType === 'aula_experimental';
    const finalModality = isAula ? ((newModality || '').trim() || null) : null;
    const finalQty = isAula ? (Number(newQty) > 0 ? Number(newQty) : null) : null;

    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), {
        appointmentScheduledFor: newDate,
        nextFollowUp: newDate, // keep legacy field in sync so the lead doesn't show up as "Atrasado" after rescheduling
        appointmentType: finalApptType,
        nextFollowUpType: finalApptTypeLabel,
        nextFollowUpNote: noteText || null,
        appointmentModality: finalModality,
        trialClassesPlanned: finalQty,
        appointmentOutcome: null,
        appointmentOutcomeAt: null,
        appointmentOutcomeBy: null
      });

      let baseText;
      if (isAfterNoShow) {
        baseText = `🔄 Próxima tentativa marcada (${finalApptTypeLabel}) para ${formattedDate} às ${formattedTime}, após "Não veio".`;
      } else if (isStillToday) {
        baseText = `🔄 Horário ajustado: ${finalApptTypeLabel.toLowerCase()} para hoje às ${formattedTime}.`;
      } else {
        baseText = `🔄 Remarcou ${finalApptTypeLabel.toLowerCase()} para ${formattedDate} às ${formattedTime} — Meta Diária.`;
      }

      const interactionPayload = {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: noteText ? `${baseText} Obs: ${noteText}` : baseText,
        type: shouldCloseToday ? 'daily_goal_done' : 'note',
        rescheduledFor: newDate,
        createdAt: serverTimestamp()
      };
      if (shouldCloseToday) {
        interactionPayload.dailyGoalCategory = categorySlug;
        interactionPayload.appointmentOutcome = 'rescheduled';
      }

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), interactionPayload);

      if (isAfterNoShow) {
        toast.success(`Próxima tentativa em ${formattedDate} às ${formattedTime}.`);
      } else if (isStillToday) {
        toast.success(`Horário ajustado para hoje às ${formattedTime}.`);
      } else {
        toast.success(`Remarcado para ${formattedDate} às ${formattedTime}.`);
      }
      setRescheduleTarget(null);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar a remarcação. Tente novamente.');
    }
  };

  const handleWhatsapp = (lead) => {
    const num = String(lead.whatsapp || '').replace(/\D/g, '');
    if (num) window.open(`https://wa.me/${num}`, '_blank', 'noopener,noreferrer');
  };

  const handleCall = (lead) => {
    const num = String(lead.whatsapp || '').replace(/\D/g, '');
    if (num) window.location.href = `tel:${num}`;
  };

  // Per-slug pending tasks. A lead with two pending categories renders TWICE — once per slug — preserving main's per-category status model.
  const pendingBySlug = useMemo(() => {
    const groups = {
      [DAILY_GOAL_CATEGORIES.NOVO_24H]: [],
      [DAILY_GOAL_CATEGORIES.VISITA_HOJE]: [],
      [DAILY_GOAL_CATEGORIES.AULA_HOJE]: [],
      [DAILY_GOAL_CATEGORIES.CONTATO_HOJE]: [],
      [DAILY_GOAL_CATEGORIES.ATRASADO]: []
    };
    processedLeads.forEach(lead => {
      (lead.categorySlugs || []).forEach(slug => {
        if (!isLeadDoneForCategory(lead, slug) && groups[slug]) groups[slug].push(lead);
      });
    });
    return groups;
  }, [processedLeads]);

  const counts = {
    [DAILY_GOAL_CATEGORIES.NOVO_24H]: pendingBySlug[DAILY_GOAL_CATEGORIES.NOVO_24H].length,
    [DAILY_GOAL_CATEGORIES.VISITA_HOJE]: pendingBySlug[DAILY_GOAL_CATEGORIES.VISITA_HOJE].length,
    [DAILY_GOAL_CATEGORIES.AULA_HOJE]: pendingBySlug[DAILY_GOAL_CATEGORIES.AULA_HOJE].length,
    [DAILY_GOAL_CATEGORIES.CONTATO_HOJE]: pendingBySlug[DAILY_GOAL_CATEGORIES.CONTATO_HOJE].length,
    [DAILY_GOAL_CATEGORIES.ATRASADO]: pendingBySlug[DAILY_GOAL_CATEGORIES.ATRASADO].length
  };
  const totalPendingSlots = Object.values(counts).reduce((a, b) => a + b, 0);

  const nextAppt = useMemo(() => {
    const apptLeads = [
      ...pendingBySlug[DAILY_GOAL_CATEGORIES.VISITA_HOJE].map(l => ({ l, slug: DAILY_GOAL_CATEGORIES.VISITA_HOJE })),
      ...pendingBySlug[DAILY_GOAL_CATEGORIES.AULA_HOJE].map(l => ({ l, slug: DAILY_GOAL_CATEGORIES.AULA_HOJE }))
    ];
    return apptLeads
      .map(x => ({ ...x, when: getLeadAppointmentDate(x.l) }))
      .filter(x => x.when)
      .sort((a, b) => a.when - b.when)[0] || null;
  }, [pendingBySlug]);

  const nextApptDate = nextAppt ? getLeadAppointmentDate(nextAppt.l) : null;
  const countdownLabel = nextApptDate ? humanizeUntil(nextApptDate, now) : null;
  const nextApptLabel = nextApptDate ? `Hoje · ${formatHourLabel(nextApptDate)}` : null;

  // Agendamentos de AMANHÃ (prévia) — visitas, aulas e contatos do consultor
  // marcados para o dia seguinte. NÃO entram na meta de hoje (não tocam em
  // processedLeads/totalSlots): é só uma antecipação do que vem pela frente.
  const tomorrowAppts = useMemo(() => {
    const tStart = new Date(); tStart.setHours(0, 0, 0, 0); tStart.setDate(tStart.getDate() + 1);
    const tEnd = new Date(tStart); tEnd.setHours(23, 59, 59, 999);
    return (leads || [])
      .filter(l => l.consultantId === appUser.id && l.status !== 'Venda' && l.status !== 'Perda')
      .map(l => {
        const when = getLeadAppointmentDate(l) ||
          (l.nextFollowUp instanceof Date && !isNaN(l.nextFollowUp.getTime()) ? l.nextFollowUp : null);
        return { lead: l, when };
      })
      .filter(x => x.when && x.when >= tStart && x.when <= tEnd)
      .sort((a, b) => a.when - b.when);
  }, [leads, appUser]);

  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }, [now]);

  const todayLabel = useMemo(() =>
    now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
  [now]);

  const firstName = (appUser.name || '').split(' ')[0] || 'consultor';

  const renderTaskCard = (task, slug) => (
    <TaskCard
      key={`${task.id}-${slug}`}
      task={task}
      slug={slug}
      now={now}
      onOpen={setSelectedLead}
      onSnooze={handleSnooze}
      onOutcome={handleOutcome}
      onReschedule={(t, s) => setRescheduleTarget({ lead: t, categorySlug: s })}
      onGoalDone={handleGoalDone}
      onWhatsapp={handleWhatsapp}
      onCall={handleCall}
    />
  );

  const isTomorrowView = filter === 'tomorrow';
  const visibleSlugs = filter === 'all' ? DG_CATEGORY_ORDER : [filter];
  const visibleCount = filter === 'all'
    ? totalPendingSlots
    : isTomorrowView
      ? tomorrowAppts.length
      : (counts[filter] || 0);

  return (
    <div className="h-full flex flex-col gap-6 animate-fade-in relative font-sans">
      <ProgressHero
        firstName={firstName}
        greeting={greeting}
        counts={counts}
        totalSlots={totalSlots}
        doneSlots={doneSlots}
        progress={progress}
      />


      <div className="grid grid-cols-12 gap-6 flex-1 min-h-[400px]">
        {/* LEFT — A FAZER */}
        <section className="col-span-12 lg:col-span-8">
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-card overflow-hidden h-full flex flex-col">
            <div className="px-5 pt-5 pb-3 flex items-center gap-2.5 border-b border-slate-100 dark:border-white/[0.05]">
              <h2 className="text-[15px] font-semibold">{isTomorrowView ? 'Amanhã' : 'A fazer hoje'}</h2>
              <span className="num text-[11.5px] px-1.5 h-[20px] rounded-md grid place-items-center bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">{visibleCount}</span>
            </div>

            <div className="px-5 py-3 border-b border-slate-100 dark:border-white/[0.05] flex flex-wrap gap-1.5">
              <FilterChip active={filter === 'all'} label="Todos" count={totalPendingSlots} onClick={() => setFilter('all')} />
              {DG_CATEGORY_ORDER.map(slug => (
                <FilterChip
                  key={slug}
                  active={filter === slug}
                  color={DG_CATEGORY_META[slug].color}
                  label={DG_CATEGORY_META[slug].short}
                  count={counts[slug] || 0}
                  onClick={() => setFilter(slug)}
                />
              ))}
              {/* Prévia: agendamentos de amanhã — não conta na meta de hoje,
                  por isso fica separado por um divisor das categorias acima. */}
              <span className="w-px h-5 bg-slate-200 dark:bg-white/10 self-center mx-0.5" aria-hidden="true" />
              <FilterChip
                active={isTomorrowView}
                label="Amanhã"
                count={tomorrowAppts.length}
                onClick={() => setFilter('tomorrow')}
              />
            </div>

            <div className={`p-5 flex-1 overflow-y-auto thin-scroll ${isTomorrowView ? 'space-y-2.5' : 'space-y-7'}`}>
              {isTomorrowView ? (
                tomorrowAppts.length === 0 ? (
                  <div className="py-14 grid place-items-center text-slate-400">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/[0.05] grid place-items-center mb-3">
                      <Calendar size={22} className="text-slate-400" />
                    </div>
                    <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Nada agendado para amanhã</p>
                    <p className="text-[12.5px] mt-1">Sem visitas, aulas ou contatos marcados para o dia seguinte.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400">
                      Prévia do dia seguinte — <span className="font-medium text-slate-600 dark:text-slate-300">não conta na meta de hoje</span>.
                    </p>
                    {tomorrowAppts.map(({ lead, when }) => {
                      const { Icon, label } = dgApptTypeMeta(lead);
                      return (
                        <button
                          key={lead.id}
                          type="button"
                          onClick={() => setSelectedLead(lead)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] hover:border-slate-300 dark:hover:border-white/10 transition text-left"
                        >
                          <Avatar name={lead.name} size={38} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[14px] font-semibold text-slate-900 dark:text-white truncate">{lead.name}</div>
                            <div className="text-[12px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1"><Icon size={12} /> {label}</span>
                              {lead.whatsapp && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-white/20" />
                                  <span className="num">{lead.whatsapp}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <span className="num text-[12.5px] font-semibold text-slate-600 dark:text-slate-300 shrink-0">{formatHourLabel(when)}</span>
                        </button>
                      );
                    })}
                  </>
                )
              ) : totalSlots === 0 ? (
                <div className="py-14 grid place-items-center text-slate-400">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-500/10 grid place-items-center mb-3">
                    <CheckCircle size={22} className="text-emerald-500" />
                  </div>
                  <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Sua meta está vazia hoje</p>
                  <p className="text-[12.5px] mt-1">Aproveite o turno para prospectar novos leads.</p>
                </div>
              ) : visibleCount === 0 ? (
                <div className="py-14 grid place-items-center text-slate-400">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-500/10 grid place-items-center mb-3">
                    <CheckCircle size={22} className="text-emerald-500" />
                  </div>
                  <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Nenhuma tarefa por aqui</p>
                  <p className="text-[12.5px] mt-1">Você está em dia com essa categoria. Bom trabalho!</p>
                </div>
              ) : (
                visibleSlugs.map(slug => (
                  <DgSection
                    key={slug}
                    slug={slug}
                    tasks={pendingBySlug[slug] || []}
                    render={renderTaskCard}
                  />
                ))
              )}
            </div>
          </div>
        </section>

        {/* RIGHT — Sidebar */}
        <section className="col-span-12 lg:col-span-4 flex flex-col gap-3">
          <NextUp
            task={nextAppt?.l}
            slug={nextAppt?.slug}
            countdownLabel={countdownLabel}
            appointmentLabel={nextApptLabel}
            onWhatsapp={handleWhatsapp}
            onOutcome={handleOutcome}
          />

          <StreakCard
            history14={ritmoMes.history14}
            monthHits={ritmoMes.monthHits}
            monthTarget={ritmoMes.monthTarget}
            streak={ritmoMes.streak}
          />

          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-card flex-1 min-h-0 flex flex-col">
            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-white/[0.05]">
              <div className="flex items-center gap-2">
                <h3 className="text-[13.5px] font-semibold">Feitos hoje</h3>
                <span className="num text-[11px] px-1.5 h-[18px] rounded-md grid place-items-center bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{done.length}</span>
              </div>
            </div>
            <div className="p-3 space-y-2 flex-1 overflow-y-auto thin-scroll">
              {done.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-[12.5px]">
                  Nenhuma tarefa concluída ainda — a primeira virá em breve.
                </div>
              ) : (
                done.map(lead => (
                  <DoneCard
                    key={lead.id}
                    lead={lead}
                    onOpen={setSelectedLead}
                    onReschedule={(l, s) => setRescheduleTarget({ lead: l, categorySlug: s })}
                  />
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      <footer className="pt-1 pb-2 text-center text-[11.5px] text-slate-400">
        Atualizado agora · {todayLabel} · <span className="font-display font-medium">STRONI</span><span className="font-display font-bold text-brand-600 dark:text-brand-400">LEAD</span>
      </footer>

      {rescheduleTarget && (
        <RescheduleModal
          lead={rescheduleTarget.lead}
          categorySlug={rescheduleTarget.categorySlug}
          currentDate={getLeadAppointmentDate(rescheduleTarget.lead)}
          currentType={getLeadAppointmentType(rescheduleTarget.lead)}
          flow={rescheduleTarget.flow || 'manual'}
          onConfirm={handleReschedule}
          onClose={() => setRescheduleTarget(null)}
        />
      )}

      {selectedLead && (
        <LeadDetailsModal
          lead={selectedLead}
          interactions={(interactions || []).filter(i => i.leadId === selectedLead.id).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0))}
          onClose={() => setSelectedLead(null)}
          appUser={appUser}
          statuses={statuses}
          tags={tags}
          lossReasons={lossReasons}
          usersList={usersList}
          db={db}
          funnels={funnels}
        />
      )}
    </div>
  );
}