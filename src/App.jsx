import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
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
  signInWithCustomToken,
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
import { getSafeDate, getSafeDateOrNull } from './lib/dates.js';
import {
  getLeadAppointmentType,
  getLeadAppointmentDate,
  isLeadConverted,
  getLeadAttendanceDate,
  getAppointmentOutcomeMeta,
  APPOINTMENT_OUTCOMES,
  DAILY_GOAL_CATEGORIES,
  DAILY_GOAL_CATEGORY_LABEL,
  hasGoalDoneToday,
  isLeadResolvedToday,
  hasActiveInteractionToday,
  isAdminUser,
  getLeadOwnershipFields,
  getInteractionSecurityFields
} from './lib/leads.js';
import { getDefaultFunnel, isItemInFunnel, commitOpsInChunks, ALL_FUNNELS_ID, isAllFunnels } from './lib/funnels.js';
import { ToastProvider, useToast } from './contexts/ToastContext.jsx';
import { GeneralConfigContext, useGeneralConfig } from './contexts/GeneralConfigContext.jsx';
import { LIST_PAGE_SIZE, normalizeTrialClassOptions, normalizeMetaWeekdays, buildInteractionIndex, isHotLeadFromDate } from './lib/leadStatus.js';
import { fmtBRL, fmtNum, timeAgo, humanizeAge, humanizeUntil, formatHourLabel } from './lib/format.js';
import { slugify, planLabel, tenantSeatLabel, IMPERSONATION_KEY, readImpersonation, tenantHealth, lastActivityLabel, auditActionLabel } from './lib/superadmin.js';
import { SurgeMark, StronileadWordmark } from './components/brand/SurgeMark.jsx';
import { TrialBanner, ImpersonationBanner } from './components/layout/Banners.jsx';
import { Avatar, KanbanAvatar } from './components/ui/Avatar.jsx';
import { FunnelSelector } from './components/ui/FunnelSelector.jsx';
import { ViewSkeleton } from './components/ui/Skeleton.jsx';
import { SidebarItem, SidebarGroup, SidebarSubItem } from './components/layout/Sidebar.jsx';
import { StatusBadge, TagBadge, LeadTemperatureBadge, DaysSinceContactBadge, FollowUpIcon } from './components/ui/Badges.jsx';
import { Field, StyledInput, StyledSelect } from './components/ui/Field.jsx';
import { ColorBadge, SETTINGS_COLOR_OPTIONS, ColorDot } from './components/ui/ColorPicker.jsx';
import { SettingsCard, SettingsTabItem, SettingsRow } from './components/ui/SettingsCard.jsx';
import { Btn, IconBtn } from './components/ui/Btn.jsx';
import { TenantBlockedScreen } from './views/auth/TenantBlockedScreen.jsx';
import { AcceptInviteScreen } from './views/auth/AcceptInviteScreen.jsx';
import { LoginScreen } from './views/auth/LoginScreen.jsx';
import { LossReasonModal } from './modals/LossReasonModal.jsx';
import { FunnelDetailModal } from './modals/FunnelDetailModal.jsx';
import { LeadDetailsModal } from './modals/LeadDetailsModal.jsx';
import { DashboardView } from './views/DashboardView.jsx';
import { KanbanView } from './views/KanbanView.jsx';

// ============================================================
// MARCA STRONILEAD — símbolo "The Surge" + wordmark
// (apenas apresentação; usados no login, sidebar e header)
// ============================================================







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
  const [superTab, setSuperTab] = useState('overview'); // sub-seção do super-admin (no menu lateral)
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
                  <SidebarGroup
                    icon={<Globe className="w-[18px] h-[18px]" />}
                    label="Organizações"
                    active={activeTab === 'superadmin'}
                    open={activeTab === 'superadmin'}
                    onToggle={() => { changeTab('superadmin'); setSuperTab('overview'); }}
                  >
                    <SidebarSubItem label="Visão Geral" active={activeTab === 'superadmin' && superTab === 'overview'} onClick={() => { changeTab('superadmin'); setSuperTab('overview'); }} />
                    <SidebarSubItem label="Clientes" active={activeTab === 'superadmin' && superTab === 'clients'} onClick={() => { changeTab('superadmin'); setSuperTab('clients'); }} />
                    <SidebarSubItem label="Financeiro" active={activeTab === 'superadmin' && superTab === 'finance'} onClick={() => { changeTab('superadmin'); setSuperTab('finance'); }} />
                    <SidebarSubItem label="Planos" active={activeTab === 'superadmin' && superTab === 'plans'} onClick={() => { changeTab('superadmin'); setSuperTab('plans'); }} />
                  </SidebarGroup>
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
              {activeTab === 'superadmin' && (({ overview: 'Visão Geral', clients: 'Clientes', finance: 'Financeiro', plans: 'Planos' }[superTab] || 'Organizações') + ' · Super-admin')}
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
              <SuperAdminView tab={superTab} />
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
              {activeTab === 'superadmin' && appUser?.superAdmin && <SuperAdminView tab={superTab} />}
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



// Faixa fixa exibida no topo enquanto o super-admin visualiza como um cliente.




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

function SuperAdminView({ tab }) {
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
  const [plans, setPlans] = useState(null);            // planos (GET /api/plans) — null = carregando
  const [paymentFilter, setPaymentFilter] = useState('all'); // all | paid | pending | overdue

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

  // Planos: alimentam a aba Planos e o seletor de plano dinâmico do modal.
  const loadPlans = async () => {
    try {
      const res = await fetch('/api/plans', { headers: await authHeader() });
      const data = await res.json();
      if (res.ok) setPlans(data.plans || []);
      else { toast.error(data.error || 'Erro ao carregar planos.'); setPlans([]); }
    } catch (e) { console.error('loadPlans', e); toast.error('Erro ao carregar planos.'); setPlans([]); }
  };

  useEffect(() => { loadTenants(); loadPlans(); }, []);

  // Abre o painel de detalhe e busca as estatísticas de uso (Admin SDK).
  const openManage = async (t) => {
    setManage(t);
    if (plans === null) loadPlans(); // seletor de plano dinâmico no modal
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

  const extendTrial = (tenantId, days) => patchTenant(tenantId, { trialDays: Number(days) }, Number(days) > 0 ? `Trial de ${days} dias aplicado.` : 'Trial encerrado.', 'trial');
  const setActive = (tenantId, status) => patchTenant(tenantId, { status }, status === 'active' ? 'Organização ativada.' : 'Organização suspensa.', 'status');
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
    if (paymentFilter !== 'all') list = list.filter(t => (t.paymentStatus || 'pending') === paymentFilter);
    const arr = [...list];
    if (sortBy === 'activity') arr.sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0));
    else if (sortBy === 'revenue') arr.sort((a, b) => (b.price || 0) - (a.price || 0));
    else arr.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return arr;
  }, [tenants, search, statusFilter, sortBy, paymentFilter]);

  return (
    <div className="animate-fade-in font-sans space-y-6">
      <section>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Globe size={13} className="text-brand-600" /> Super-admin
        </div>
        <h2 className="mt-1.5 font-display text-[24px] font-semibold tracking-tight leading-tight">Organizações</h2>
        <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
          Crie uma organização nova (cliente) com dados totalmente isolados e o primeiro admin dela.
        </p>
      </section>

      <div className="space-y-6" key={tab}>
      {tab === 'overview' && (
        <div className="space-y-6">
          <SuperOverviewCards overview={overview} />

          <SettingsCard title="Plataforma" hint="Volume total e distribuição por plano" icon={<Globe size={16} />}>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] p-3 text-center">
                <div className="num text-[20px] font-semibold tracking-tight text-slate-900 dark:text-white">{overview ? (overview.leadsTotal ?? 0).toLocaleString('pt-BR') : '—'}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Leads na plataforma</div>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] p-3 text-center">
                <div className="num text-[20px] font-semibold tracking-tight text-slate-900 dark:text-white">{overview ? (overview.usersTotal ?? 0).toLocaleString('pt-BR') : '—'}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Usuários na plataforma</div>
              </div>
            </div>
            {overview?.byPlan && Object.keys(overview.byPlan).length > 0 ? (
              <div className="space-y-2">
                {(() => {
                  const total = Object.values(overview.byPlan).reduce((s, x) => s + x, 0) || 1;
                  return Object.entries(overview.byPlan).sort((a, b) => b[1] - a[1]).map(([plan, n]) => (
                    <div key={plan} className="flex items-center gap-3">
                      <span className="text-[12.5px] font-medium text-slate-700 dark:text-slate-200 w-28 truncate">{planLabel(plan)}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-white/[0.05] overflow-hidden">
                        <div className="h-full bg-brand-600 rounded-full" style={{ width: `${Math.round((n / total) * 100)}%` }} />
                      </div>
                      <span className="num text-[12px] font-semibold text-slate-700 dark:text-slate-200 w-10 text-right">{n}</span>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div className="text-center text-[12px] text-slate-400 italic py-4">Sem clientes em plano ainda.</div>
            )}
          </SettingsCard>

          {overview?.trialsExpiring?.length > 0 && (
            <SettingsCard title="Trials vencendo" hint="Próximos 7 dias — aja rápido" icon={<AlertCircle size={16} />}>
              <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                {overview.trialsExpiring.map(tr => (
                  <div key={tr.id} className="flex items-center gap-2 px-1 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">{tr.displayName}</div>
                      <div className="text-[11.5px] text-slate-500 num">{tr.daysLeft <= 0 ? 'vence hoje' : `${tr.daysLeft} dia${tr.daysLeft === 1 ? '' : 's'}`} · {new Date(tr.trialEndsAt).toLocaleDateString('pt-BR')}</div>
                    </div>
                    <button disabled={!!manageBusy} onClick={() => patchTenant(tr.id, { trialDays: 7 }, 'Trial estendido por 7 dias.', 'trial')}
                      className="h-8 px-2.5 rounded-lg text-[11.5px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-200 disabled:opacity-50 transition whitespace-nowrap">+7 dias</button>
                    <button disabled={!!manageBusy} onClick={() => patchTenant(tr.id, { trialDays: 0, status: 'active' }, 'Organização ativada.', 'status')}
                      className="h-8 px-2.5 rounded-lg text-[11.5px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 disabled:opacity-50 transition whitespace-nowrap">Ativar</button>
                  </div>
                ))}
              </div>
            </SettingsCard>
          )}
        </div>
      )}

      {tab === 'finance' && <SuperFinanceTab overview={overview} tenants={tenants} onPatch={patchTenant} busy={manageBusy} />}

      {tab === 'plans' && <SuperPlansTab plans={plans} authHeader={authHeader} onReload={loadPlans} />}

      {tab === 'clients' && (
        <div className="space-y-6">
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
            <option value="revenue">Ordenar: Receita (MRR)</option>
          </select>
          <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}
            className="h-9 px-2.5 rounded-lg text-[12px] bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] outline-none focus:border-brand-500 cursor-pointer">
            <option value="all">Pgto: Todos</option>
            <option value="paid">Pago</option>
            <option value="pending">Pendente</option>
            <option value="overdue">Inadimplente</option>
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

        </div>
      )}

      {tab === 'overview' && audit.length > 0 && (
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
        </div>

      {manage && (
        <TenantManageModal
          t={manage} stats={stats} busy={manageBusy} plans={plans}
          onClose={closeManage}
          onCopy={() => copyTenantLink(manage.id)}
          onPatch={(body, msg) => patchTenant(manage.id, body, msg, 'edit')}
          onExtendTrial={(d) => extendTrial(manage.id, d)}
          onSetActive={(s) => setActive(manage.id, s)}
          onEnterAs={() => enterAs(manage)}
          onArchive={() => setArchived(manage.id, true)}
        />
      )}
    </div>
  );
}

// Painel de detalhe/gestão de uma organização (super-admin): uso, plano, trial,
// status e desativar. Props são handlers do SuperAdminView.
function TenantManageModal({ t, stats, busy, plans, onClose, onCopy, onPatch, onExtendTrial, onSetActive, onEnterAs, onArchive }) {
  const [sub, setSub] = useState('visao');
  const [trialDays, setTrialDays] = useState('');
  const [f, setF] = useState({
    displayName: t.displayName || '',
    city: t.settings?.city || '',
    state: t.settings?.state || '',
    logoUrl: t.settings?.logoUrl || '',
    paymentStatus: t.paymentStatus || '',
    nextBillingAt: t.nextBillingAt ? new Date(t.nextBillingAt).toISOString().slice(0, 10) : '',
    notes: t.internalNotes || '',
    price: t.monthlyPrice != null ? String(t.monthlyPrice) : '',
  });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const d = stats?.data;
  const seatLabel = d ? (d.maxUsers == null ? `${d.userCount} (ilimitado)` : `${d.userCount}/${d.maxUsers}`) : '—';
  const planOptions = (() => {
    const list = (plans || []).filter(p => p.isActive !== false || p.slug === t.plan);
    return list.length ? list : ['starter', 'pro', 'enterprise'].map(s => ({ slug: s, name: planLabel(s) }));
  })();

  const saveBilling = () => onPatch({
    paymentStatus: f.paymentStatus || null,
    nextBillingAt: f.nextBillingAt ? new Date(f.nextBillingAt + 'T12:00:00').getTime() : null,
    monthlyPrice: f.price === '' ? null : Number(f.price),
    internalNotes: f.notes,
  }, 'Cobrança atualizada.');
  const saveConfig = () => {
    if (!f.displayName.trim()) return;
    onPatch({ displayName: f.displayName.trim(), settings: { city: f.city.trim(), state: f.state.trim(), logoUrl: f.logoUrl.trim() } }, 'Configurações salvas.');
  };

  const statBox = (label, value) => (
    <div className="rounded-xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] p-3 text-center">
      <div className="num text-[18px] font-semibold tracking-tight text-slate-900 dark:text-white">{value}</div>
      <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">{label}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/55 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative w-full max-w-[540px] max-h-[92vh] overflow-y-auto custom-scrollbar rounded-2xl bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/[0.08] shadow-[0_30px_80px_-20px_rgba(8,13,34,.55)]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200/80 dark:border-white/[0.07]">
          <div className="min-w-0">
            <h2 className="font-display text-[17px] font-bold tracking-tight truncate text-gray-900 dark:text-white">{t.displayName}</h2>
            <div className="text-[11.5px] text-slate-500 dark:text-slate-400 num truncate">{t.id}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-white/[0.06] transition shrink-0"><X size={17} /></button>
        </div>

        {/* sub-abas */}
        <div className="px-5 pt-3 flex gap-1 flex-wrap border-b border-slate-200/80 dark:border-white/[0.07]">
          {[{ id: 'visao', label: 'Visão Geral' }, { id: 'plano', label: 'Plano & Cobrança' }, { id: 'config', label: 'Configurações' }, { id: 'acoes', label: 'Ações' }].map(s => (
            <button key={s.id} type="button" onClick={() => setSub(s.id)}
              className={`px-3 h-8 text-[12px] font-semibold transition -mb-px border-b-2 ${sub === s.id ? 'border-brand-600 text-brand-700 dark:text-brand-300' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {sub === 'visao' && (
            <>
              <div className="grid grid-cols-3 gap-2.5">
                {statBox('Leads', d ? d.leadCount : (stats?.loading ? '…' : '—'))}
                {statBox('Interações', d ? d.interactionCount : (stats?.loading ? '…' : '—'))}
                {statBox('Usuários', d ? seatLabel : (stats?.loading ? '…' : '—'))}
              </div>
              <div className="space-y-1.5 text-[12.5px]">
                <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">Plano</span><span className="font-medium text-slate-800 dark:text-slate-100">{planLabel(t.plan)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">Admin principal</span><span className="font-medium text-slate-800 dark:text-slate-100 truncate">{t.primaryAdminEmail || '—'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">Criada em</span><span className="num text-slate-800 dark:text-slate-100">{t.createdAt ? new Date(t.createdAt).toLocaleDateString('pt-BR') : '—'}</span></div>
                <div className="flex justify-between gap-3 items-center"><span className="text-slate-500 dark:text-slate-400">Link de acesso</span><button onClick={onCopy} className="font-semibold text-brand-700 dark:text-brand-300 hover:underline num">copiar /{t.id}</button></div>
              </div>
              {stats?.error && <p className="text-[11.5px] text-rose-600 dark:text-rose-400">{stats.error}</p>}
            </>
          )}

          {sub === 'plano' && (
            <>
              <div>
                <div className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Plano</div>
                <div className="flex gap-1.5 flex-wrap">
                  {planOptions.map(p => (
                    <button key={p.slug} type="button" disabled={!!busy} onClick={() => p.slug !== t.plan && onPatch({ plan: p.slug }, `Plano alterado para ${p.name || p.slug}.`)}
                      className={`h-9 px-3 rounded-lg text-[12.5px] font-semibold transition disabled:opacity-50 ${t.plan === p.slug ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.04] dark:text-slate-300'}`}>
                      {p.name || p.slug}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Trial</span>
                  {t.status === 'trial' && t.trialEndsAt && (
                    <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">{(() => { const left = Math.max(0, Math.ceil((t.trialEndsAt - Date.now()) / 86400000)); return left <= 0 ? 'termina hoje' : `${left} dia${left === 1 ? '' : 's'} restante${left === 1 ? '' : 's'}`; })()}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" value={trialDays} onChange={e => setTrialDays(e.target.value)} placeholder="dias"
                    className="w-24 h-9 px-3 rounded-lg text-[13px] num bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] outline-none focus:border-brand-500" />
                  <button type="button" disabled={!!busy || trialDays === ''} onClick={() => { onExtendTrial(trialDays); setTrialDays(''); }}
                    className="h-9 px-3 rounded-lg text-[12.5px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-200 disabled:opacity-50 transition">Aplicar</button>
                  <span className="text-[11px] text-slate-400">0 = ativa</span>
                </div>
              </div>
              <div className="space-y-3 rounded-xl border border-slate-200 dark:border-white/[0.07] p-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Pagamento">
                    <StyledSelect value={f.paymentStatus} onChange={e => set('paymentStatus', e.target.value)}>
                      <option value="">—</option>
                      <option value="paid">Pago</option>
                      <option value="pending">Pendente</option>
                      <option value="overdue">Inadimplente</option>
                    </StyledSelect>
                  </Field>
                  <Field label="Próxima cobrança"><StyledInput type="date" value={f.nextBillingAt} onChange={e => set('nextBillingAt', e.target.value)} /></Field>
                </div>
                <Field label="Valor negociado (R$/mês)" hint="vazio = preço do plano · entra no MRR">
                  <StyledInput type="number" min="0" value={f.price} onChange={e => set('price', e.target.value)} placeholder={`padrão (${planLabel(t.plan)})`} />
                </Field>
                <Field label="Notas internas (só você vê)">
                  <textarea value={f.notes} onChange={e => set('notes', e.target.value)} rows={3} maxLength={2000}
                    className="w-full px-3 py-2 rounded-lg text-[12.5px] bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] outline-none focus:border-brand-500 resize-none custom-scrollbar" placeholder="Contato, negociação, observações..." />
                </Field>
                <div className="flex justify-end"><Btn kind="brand" icon={<Check size={13} />} onClick={saveBilling} disabled={!!busy}>Salvar cobrança</Btn></div>
              </div>
            </>
          )}

          {sub === 'config' && (
            <div className="space-y-3">
              <Field label="Nome da organização"><StyledInput value={f.displayName} onChange={e => set('displayName', e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cidade"><StyledInput value={f.city} onChange={e => set('city', e.target.value)} placeholder="Ex: Porto Alegre" /></Field>
                <Field label="Estado"><StyledInput value={f.state} onChange={e => set('state', e.target.value)} placeholder="Ex: RS" /></Field>
              </div>
              <Field label="Logo (URL)" hint="opcional"><StyledInput value={f.logoUrl} onChange={e => set('logoUrl', e.target.value)} placeholder="https://..." /></Field>
              <div className="flex justify-end"><Btn kind="brand" icon={<Check size={13} />} onClick={saveConfig} disabled={!!busy}>Salvar configurações</Btn></div>
              <p className="text-[11px] text-slate-400">O identificador (slug <span className="num">{t.id}</span>) é imutável.</p>
            </div>
          )}

          {sub === 'acoes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-white/[0.07] px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Conta interna / teste</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500">Fora do MRR e dos KPIs de negócio.</div>
                </div>
                <button type="button" disabled={!!busy} onClick={() => onPatch({ internal: !t.internal }, t.internal ? 'Voltou a contar como cliente.' : 'Marcada como interna/teste.')}
                  role="switch" aria-checked={!!t.internal}
                  className={`relative w-11 h-6 rounded-full transition shrink-0 disabled:opacity-50 ${t.internal ? 'bg-brand-600' : 'bg-slate-300 dark:bg-white/[0.15]'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${t.internal ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Modal de criar/editar um plano (super-admin). POST/PUT em /api/plans.
function PlanFormModal({ plan, authHeader, onClose, onSaved }) {
  const toast = useToast();
  const editing = !!plan?.id;
  const [form, setForm] = useState({
    name: plan?.name || '',
    slug: plan?.slug || '',
    unlimited: plan?.maxUsers == null && editing,
    maxUsers: plan?.maxUsers != null ? String(plan.maxUsers) : '',
    priceMonthly: plan?.priceMonthly != null ? String(plan.priceMonthly) : '',
    priceAnnual: plan?.priceAnnual != null ? String(plan.priceAnnual) : '',
    extraUserPrice: plan?.extraUserPrice != null ? String(plan.extraUserPrice) : '',
    maxExtraUsers: plan?.maxExtraUsers != null ? String(plan.maxExtraUsers) : '',
    isActive: plan?.isActive !== false,
    isDefault: plan?.isDefault === true,
    order: plan?.order != null ? String(plan.order) : '0',
    features: Array.isArray(plan?.features) ? plan.features.join('\n') : '',
  });
  const [slugTouched, setSlugTouched] = useState(editing);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const onName = (v) => setForm(f => ({ ...f, name: v, slug: slugTouched ? f.slug : slugify(v) }));

  const save = async () => {
    if (!form.name.trim()) { toast.warning('Informe o nome do plano.'); return; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) { toast.warning('Slug inválido: minúsculas, números e hífen.'); return; }
    setSaving(true);
    const body = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      maxUsers: form.unlimited ? null : (form.maxUsers === '' ? 1 : Number(form.maxUsers)),
      priceMonthly: form.priceMonthly === '' ? 0 : Number(form.priceMonthly),
      priceAnnual: form.priceAnnual === '' ? null : Number(form.priceAnnual),
      extraUserPrice: form.extraUserPrice === '' ? null : Number(form.extraUserPrice),
      maxExtraUsers: form.maxExtraUsers === '' ? null : Number(form.maxExtraUsers),
      isActive: form.isActive,
      isDefault: form.isDefault,
      order: form.order === '' ? 0 : Number(form.order),
      features: form.features.split('\n').map(s => s.trim()).filter(Boolean),
    };
    try {
      const res = await fetch('/api/plans', {
        method: editing ? 'PUT' : 'POST',
        headers: await authHeader(),
        body: JSON.stringify(editing ? { planId: plan.id, ...body } : body),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erro ao salvar o plano.'); setSaving(false); return; }
      toast.success(editing ? 'Plano atualizado.' : 'Plano criado.');
      onSaved();
    } catch (e) { console.error('plan save', e); toast.error('Erro ao salvar o plano.'); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/55 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative w-full max-w-[480px] max-h-[92vh] overflow-y-auto custom-scrollbar rounded-2xl bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/[0.08] shadow-[0_30px_80px_-20px_rgba(8,13,34,.55)]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200/80 dark:border-white/[0.07]">
          <h2 className="font-display text-[17px] font-bold tracking-tight text-gray-900 dark:text-white">{editing ? 'Editar plano' : 'Novo plano'}</h2>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-white/[0.06] transition"><X size={17} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome"><StyledInput value={form.name} onChange={e => onName(e.target.value)} placeholder="Ex: Pro Anual" /></Field>
            <Field label="Slug" hint="referenciado no tenant"><StyledInput value={form.slug} onChange={e => { setSlugTouched(true); set('slug', slugify(e.target.value)); }} placeholder="pro-anual" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Máx. usuários">
              <div className="flex items-center gap-2">
                <StyledInput type="number" min="1" value={form.unlimited ? '' : form.maxUsers} onChange={e => set('maxUsers', e.target.value)} disabled={form.unlimited} placeholder={form.unlimited ? 'Ilimitado' : 'ex: 10'} className="flex-1" />
                <label className="flex items-center gap-1.5 text-[11.5px] text-slate-600 dark:text-slate-300 whitespace-nowrap cursor-pointer">
                  <input type="checkbox" checked={form.unlimited} onChange={e => set('unlimited', e.target.checked)} /> ∞
                </label>
              </div>
            </Field>
            <Field label="Ordem"><StyledInput type="number" value={form.order} onChange={e => set('order', e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço mensal (R$)"><StyledInput type="number" min="0" value={form.priceMonthly} onChange={e => set('priceMonthly', e.target.value)} placeholder="197" /></Field>
            <Field label="Preço anual (R$)" hint="opcional"><StyledInput type="number" min="0" value={form.priceAnnual} onChange={e => set('priceAnnual', e.target.value)} placeholder="—" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço usuário extra" hint="opcional"><StyledInput type="number" min="0" value={form.extraUserPrice} onChange={e => set('extraUserPrice', e.target.value)} placeholder="—" /></Field>
            <Field label="Máx. extras" hint="opcional"><StyledInput type="number" min="0" value={form.maxExtraUsers} onChange={e => set('maxExtraUsers', e.target.value)} placeholder="—" /></Field>
          </div>
          <Field label="Features (uma por linha)" hint="exibidas na UI">
            <textarea value={form.features} onChange={e => set('features', e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded-lg text-[12.5px] bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] outline-none focus:border-brand-500 resize-none custom-scrollbar" placeholder={'Suporte prioritário\nRelatórios avançados'} />
          </Field>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-slate-200 cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} /> Ativo
            </label>
            <label className="flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-slate-200 cursor-pointer">
              <input type="checkbox" checked={form.isDefault} onChange={e => set('isDefault', e.target.checked)} /> Padrão ao criar org
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Btn kind="soft" onClick={onClose}>Cancelar</Btn>
            <Btn kind="brand" icon={<Check size={13} />} onClick={save} disabled={saving}>{saving ? 'Salvando...' : (editing ? 'Salvar' : 'Criar plano')}</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// Aba "Planos" do super-admin: lista os planos (GET /api/plans, semeia se vazio)
// e abre o PlanFormModal para criar/editar. Excluir é bloqueado pela API se o
// plano estiver em uso por alguma organização.
function SuperPlansTab({ plans, authHeader, onReload }) {
  const toast = useToast();
  const [editing, setEditing] = useState(undefined); // undefined = fechado · null = novo · obj = editar

  const del = async (p) => {
    if (p.tenantCount > 0) { toast.warning(`"${p.name}" tem ${p.tenantCount} organização(ões). Migre-as antes de excluir.`); return; }
    if (!window.confirm(`Excluir o plano "${p.name}"?`)) return;
    try {
      const res = await fetch('/api/plans', { method: 'DELETE', headers: await authHeader(), body: JSON.stringify({ planId: p.id }) });
      const data = await res.json();
      if (!res.ok) toast.error(data.error || 'Erro ao excluir.');
      else { toast.success('Plano excluído.'); onReload(); }
    } catch (e) { console.error('plan del', e); toast.error('Erro ao excluir.'); }
  };

  return (
    <SettingsCard
      title="Planos"
      hint="Crie e edite os planos oferecidos aos clientes"
      icon={<Tag size={16} />}
      action={<Btn kind="brand" icon={<Plus size={13} />} onClick={() => setEditing(null)}>Novo plano</Btn>}
    >
      {plans === null ? (
        <div className="text-center text-[12.5px] text-slate-400 py-10">Carregando...</div>
      ) : plans.length === 0 ? (
        <div className="text-center text-[12.5px] text-slate-400 italic py-10">Nenhum plano ainda. Crie o primeiro.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {plans.map(p => (
            <div key={p.id} className="group rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-semibold text-slate-900 dark:text-white">{p.name}</span>
                    {p.isDefault && <span className="text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">Padrão</span>}
                    {p.isActive === false && <span className="text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 dark:bg-white/[0.08] dark:text-slate-400">Inativo</span>}
                  </div>
                  <div className="text-[11.5px] text-slate-500 dark:text-slate-400 num mt-0.5">{p.slug}</div>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                  <IconBtn icon={<Pencil size={13} />} kind="edit" title="Editar" onClick={() => setEditing(p)} />
                  <IconBtn icon={<Trash2 size={13} />} kind="danger" title="Excluir" onClick={() => del(p)} />
                </div>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <span className="num text-[18px] font-bold text-slate-900 dark:text-white">R$ {Number(p.priceMonthly || 0).toLocaleString('pt-BR')}</span>
                  <span className="text-[11px] text-slate-400">/mês</span>
                </div>
                <div className="text-right text-[11.5px] text-slate-500 dark:text-slate-400 num">
                  <div>{p.maxUsers == null ? 'Usuários ilimitados' : `${p.maxUsers} usuários`}</div>
                  <div>{p.tenantCount} org{p.tenantCount === 1 ? '' : 's'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing !== undefined && (
        <PlanFormModal plan={editing} authHeader={authHeader} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); onReload(); }} />
      )}
    </SettingsCard>
  );
}

// Aba "Financeiro" do super-admin. Lê os totais do super-overview (já carregado)
// + a lista de tenants. Cobrança é MANUAL (sem gateway): "Marcar pago" / "Suspender"
// usam o patch genérico (tenant-status). Receita por plano = soma do preço efetivo
// dos clientes ativos.
function SuperFinanceTab({ overview, tenants, onPatch, busy }) {
  const o = overview || {};
  const fmt = (n) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR');
  const overdue = (tenants || []).filter(t => !t.archived && !t.internal && t.paymentStatus === 'overdue');
  const upcoming = o.upcomingBilling || [];
  const byPlanRev = {};
  (tenants || []).forEach(t => { if (!t.archived && !t.internal && t.status === 'active') byPlanRev[t.plan] = (byPlanRev[t.plan] || 0) + (t.price || 0); });
  const planRows = Object.entries(byPlanRev).sort((a, b) => b[1] - a[1]);
  const maxRev = planRows.reduce((m, [, v]) => Math.max(m, v), 0) || 1;

  const kpi = (label, value, sub, tone) => {
    const tones = { brand: 'text-brand-700 dark:text-brand-300', emerald: 'text-emerald-700 dark:text-emerald-300', rose: 'text-rose-700 dark:text-rose-300', amber: 'text-amber-700 dark:text-amber-300', slate: 'text-slate-900 dark:text-white' };
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-card p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
        <div className={`num text-[22px] font-bold tracking-tight mt-1 ${tones[tone] || tones.slate}`}>{value}</div>
        {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {kpi('MRR', fmt(o.mrr), 'receita recorrente', 'brand')}
        {kpi('ARR', fmt(o.arr), 'anualizado (MRR×12)', 'emerald')}
        {kpi('MRR potencial', fmt(o.mrrPotential), 'se os trials converterem', 'slate')}
        {kpi('Churn (30d)', o.churn30d ?? 0, 'suspensos/arquivados', 'rose')}
        {kpi('Inadimplentes', o.overdueCount ?? overdue.length, 'pagamento atrasado', 'amber')}
      </div>

      <SettingsCard title="Inadimplentes" hint="Marcados como pagamento atrasado" icon={<AlertCircle size={16} />}>
        {overdue.length === 0 ? (
          <div className="text-center text-[12.5px] text-slate-400 italic py-8">Ninguém em atraso 🎉</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
            {overdue.map(t => (
              <div key={t.id} className="flex items-center gap-2 px-1 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">{t.displayName}</div>
                  <div className="text-[11.5px] text-slate-500 num">{fmt(t.price)}/mês · {t.id}</div>
                </div>
                <button disabled={!!busy} onClick={() => onPatch(t.id, { paymentStatus: 'paid', lastPaymentAt: Date.now() }, 'Pagamento marcado como pago.', 'pay')}
                  className="h-8 px-2.5 rounded-lg text-[11.5px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 disabled:opacity-50 transition whitespace-nowrap">Marcar pago</button>
                {t.status !== 'suspended' && (
                  <button disabled={!!busy} onClick={() => onPatch(t.id, { status: 'suspended' }, 'Organização suspensa.', 'status')}
                    className="h-8 px-2.5 rounded-lg text-[11.5px] font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300 disabled:opacity-50 transition whitespace-nowrap">Suspender</button>
                )}
              </div>
            ))}
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Próximos vencimentos" hint="Cobranças nos próximos 30 dias" icon={<Calendar size={16} />}>
        {upcoming.length === 0 ? (
          <div className="text-center text-[12.5px] text-slate-400 italic py-8">Nenhum vencimento nos próximos 30 dias.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
            {upcoming.map(u => (
              <div key={u.id} className="flex items-center gap-3 px-1 py-2.5">
                <div className="min-w-0 flex-1 text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">{u.displayName}</div>
                <span className="text-[11.5px] num text-slate-500">{new Date(u.nextBillingAt).toLocaleDateString('pt-BR')}</span>
                <span className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded ${u.daysLeft <= 3 ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300'}`}>{u.daysLeft <= 0 ? 'hoje' : `${u.daysLeft}d`}</span>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Receita por plano" hint="Clientes ativos — estimativa pelo plano/valor negociado" icon={<TrendingUp size={16} />}>
        {planRows.length === 0 ? (
          <div className="text-center text-[12.5px] text-slate-400 italic py-8">Sem receita registrada ainda.</div>
        ) : (
          <div className="space-y-2.5">
            {planRows.map(([plan, rev]) => (
              <div key={plan} className="flex items-center gap-3">
                <span className="text-[12.5px] font-medium text-slate-700 dark:text-slate-200 w-28 truncate">{planLabel(plan)}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-white/[0.05] overflow-hidden">
                  <div className="h-full bg-brand-600 rounded-full" style={{ width: `${Math.round((rev / maxRev) * 100)}%` }} />
                </div>
                <span className="num text-[12px] font-semibold text-slate-700 dark:text-slate-200 w-24 text-right">{fmt(rev)}</span>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>
    </div>
  );
}

// ==========================================
// TELA DE LOGIN & RECUPERAÇÃO ADMIN
// ==========================================

// ==========================================
// COMPONENTES AUXILIARES
// ==========================================







// ==========================================
// KANBAN VIEW (COM VENDA E PERDA FIXAS)
// ==========================================

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
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);

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

  // Paginação "carregar mais": renderiza só os primeiros visibleCount.
  // (Sem reset em efeito; ao filtrar, o slice já opera sobre um conjunto menor.)
  const visibleRows = filtered.slice(0, visibleCount);

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
                {visibleRows.map(l => {
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
        {filtered.length > visibleCount && (
          <div className="flex justify-center pt-1">
            <Btn kind="soft" onClick={() => setVisibleCount(c => c + LIST_PAGE_SIZE)}>
              Carregar mais ({visibleRows.length} de {filtered.length})
            </Btn>
          </div>
        )}
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
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);
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

  // Paginação "carregar mais": renderiza só os primeiros visibleCount leads.
  // O usuário expande sob demanda; ao estreitar a busca/filtros a lista
  // encolhe sozinha (slice de um conjunto menor), mantendo o DOM leve sem
  // precisar resetar estado num efeito.
  const visibleLeads = filteredLeads.slice(0, visibleCount);

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
        Exibindo <span className="num font-semibold text-slate-700 dark:text-slate-200">{visibleLeads.length}</span> de <span className="num">{filteredLeads.length}</span> leads
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
              {visibleLeads.map(l => {
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

      {filteredLeads.length > visibleCount && (
        <div className="flex justify-center">
          <Btn kind="soft" onClick={() => setVisibleCount(c => c + LIST_PAGE_SIZE)}>
            Carregar mais ({visibleLeads.length} de {filteredLeads.length})
          </Btn>
        </div>
      )}

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

// ==========================================
// CONFIGURAÇÕES (ADMIN)ADMIN)
// ==========================================
// ==========================================
// SETTINGS — DESIGN PRIMITIVES
// ==========================================




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