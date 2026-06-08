import React, { useEffect, useMemo, useState } from 'react';
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
  query,
  where,
  updateDoc
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
  getLeadAttendanceDate,
  APPOINTMENT_OUTCOMES,
  DAILY_GOAL_CATEGORIES,
  DAILY_GOAL_CATEGORY_LABEL,
  isAdminUser
} from './lib/leads.js';
import { getDefaultFunnel, commitOpsInChunks, ALL_FUNNELS_ID, isAllFunnels } from './lib/funnels.js';
import { ToastProvider, useToast } from './contexts/ToastContext.jsx';
import { GeneralConfigContext } from './contexts/GeneralConfigContext.jsx';
import { LIST_PAGE_SIZE, normalizeTrialClassOptions, normalizeMetaWeekdays } from './lib/leadStatus.js';
import { fmtBRL, fmtNum, timeAgo } from './lib/format.js';
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
import { AppointmentTrackingView } from './views/AppointmentTrackingView.jsx';
import { LeadsView } from './views/LeadsView.jsx';
import { AddLeadModal } from './modals/AddLeadModal.jsx';
import { DailyGoalView, DG_WEEKDAY_NAMES } from './views/DailyGoalView.jsx';
import { SettingsView } from './views/settings/SettingsView.jsx';

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





// ==========================================
// CONFIGURAÇÕES (ADMIN)ADMIN)
// ==========================================

// ==========================================