import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutDashboard, Users, Plus, AlertTriangle, Activity, X, Menu, Settings, Kanban, Moon, Sun, Target, Globe, LifeBuoy, GraduationCap } from 'lucide-react';

import {
  onAuthStateChanged,
  signInWithCustomToken,
  signOut,
  setPersistence,
  browserLocalPersistence
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
  DORES_PATH,
  FUNNELS_PATH,
  MODALITIES_PATH,
  UNITS_PATH,
  PROFESSORS_PATH,
  PLANS_PATH,
  CONTRACTS_PATH,
  CONFIG_PATH,
  CONFIG_GENERAL_ID,
  DAILY_GOAL_HISTORY_PATH
} from './lib/firebase.js';
// Pure utilities — see src/lib/{constants,dates,auth,leads,funnels}.js
import { getSafeDate, getSafeDateOrNull } from './lib/dates.js';
import { isAdminUser } from './lib/leads.js';
import { computeDailyGoalSlots, buildInteractionsByLead, slotTotals, dgDateKey } from './lib/dailyGoal.js';
import { deriveLeadContractStatus, CONTRACT_STATUS } from './lib/contracts.js';
import { getDefaultFunnel, commitOpsInChunks, ALL_FUNNELS_ID, isAllFunnels } from './lib/funnels.js';
import { ToastProvider } from './contexts/ToastContext.jsx';
import { GeneralConfigContext } from './contexts/GeneralConfigContext.jsx';
import { LeadProfileContext } from './contexts/LeadProfileContext.jsx';
import { normalizeTrialClassOptions, normalizeMetaWeekdays, normalizeSlaOverdueDays, normalizeDailyVolumeTarget } from './lib/leadStatus.js';
import { IMPERSONATION_KEY, readImpersonation } from './lib/superadmin.js';
import { SurgeMark, StronileadWordmark } from './components/brand/SurgeMark.jsx';
import { TrialBanner, PaymentDueBanner, ImpersonationBanner } from './components/layout/Banners.jsx';
import { ViewSkeleton } from './components/ui/Skeleton.jsx';
import { SidebarItem, SidebarGroup, SidebarSubItem, SIDEBAR_EXPANDED_ONLY } from './components/layout/Sidebar.jsx';
import { TenantBlockedScreen } from './views/auth/TenantBlockedScreen.jsx';
import { TrialActivationScreen } from './views/auth/TrialActivationScreen.jsx';
import { AcceptInviteScreen } from './views/auth/AcceptInviteScreen.jsx';
import { LoginScreen } from './views/auth/LoginScreen.jsx';
import { DashboardView } from './views/DashboardView.jsx';
import { KanbanView } from './views/KanbanView.jsx';
import { AppointmentTrackingView } from './views/AppointmentTrackingView.jsx';
import { LeadsView } from './views/LeadsView.jsx';
import { ClientsView } from './views/ClientsView.jsx';
import { LeadProfileView } from './views/LeadProfileView.jsx';
import { AddLeadModal } from './modals/AddLeadModal.jsx';
import { DailyGoalView } from './views/DailyGoalView.jsx';
import { SettingsView } from './views/settings/SettingsView.jsx';
import { WhatsNewModal } from './components/WhatsNewModal.jsx';
import { WalkthroughModal } from './components/WalkthroughModal.jsx';
import { TutorialsHubModal } from './components/TutorialsHubModal.jsx';
import { GymProfileTab } from './views/settings/GymProfileTab.jsx';
import { PlanInvoicesTab } from './views/settings/PlanInvoicesTab.jsx';
import { PersonaMenu } from './components/layout/PersonaMenu.jsx';
import { GlobalSearch } from './components/layout/GlobalSearch.jsx';
import { SuperAdminView } from './views/superadmin/SuperAdminView.jsx';
import { SuperConsole } from './views/console/SuperConsole.jsx';
import { SupportCenterModal } from './modals/SupportCenterModal.jsx';
import { countUnreadForClient } from './lib/ticketThread.js';

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
  const [billingDue, setBillingDue] = useState(null); // { dueAtMs, overdue, invoiceUrl } | null
  // Academia identificada pela URL (#<slug>) — só para exibir a MARCA no login.
  // NÃO controla acesso (isso continua sendo o claim tenantId + as rules).
  // Formato: { slug, loading? , found?, displayName? }. Init lazy a partir do hash.
  const [urlTenant, setUrlTenant] = useState(() => {
    const slug = getTenantSlug();
    return slug ? { slug, loading: true } : null;
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  // Ficha-página (lead/cliente): id em foco. A ficha SOBREPÕE o conteúdo da
  // aba ativa (não troca activeTab), então o "Voltar" só limpa este id e a
  // aba reaparece sozinha.
  const [profileLeadId, setProfileLeadId] = useState(null);
  // Aba-alvo ao abrir Configurações de fora (ex.: link "Regras gerais" do Perfil).
  // SettingsView remonta ao entrar na view e aplica este initialTab no mount.
  const [settingsTab, setSettingsTab] = useState('users');
  const [superTab, setSuperTab] = useState('overview'); // sub-seção do super-admin (no menu lateral)
  const [consoleOpen, setConsoleOpen] = useState(false); // overlay do novo Console dark (super-admin)
  const [ticketModalOpen, setTicketModalOpen] = useState(false); // abrir chamado de suporte (cliente)
  // Tickets de suporte do tenant (badge da sidebar + Central de Suporte).
  // Não-crítico: erro aqui não bloqueia o app (sem loadError). Fora do gate
  // (superadmin puro / academia bloqueada) o estado antigo fica ignorado via
  // `ticketsOn` em vez de reset síncrono no effect (react-hooks/set-state-in-effect).
  const [rawTickets, setRawTickets] = useState([]);
  const ticketsOn = !!appUser?.tenantId && !appUser?.superAdminOnly && !tenantBlock;
  useEffect(() => {
    if (!ticketsOn) return;
    const q = query(collection(db, 'tickets'), where('tenantId', '==', appUser.tenantId));
    const unsub = onSnapshot(q,
      (snap) => setRawTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.error('onSnapshot tickets falhou', e));
    return () => unsub();
  }, [ticketsOn, appUser?.tenantId]);
  const tickets = useMemo(() => (ticketsOn ? rawTickets : []), [ticketsOn, rawTickets]);
  const ticketsUnread = useMemo(() => countUnreadForClient(tickets), [tickets]);
  const [tutorialsOpen, setTutorialsOpen] = useState(false); // central de tutoriais (ícone 🎓 do topo) — hoje "em breve"
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
  const [dores, setDores] = useState([]); // catálogo de dores (necessidades do lead)
  const [funnels, setFunnels] = useState([]);
  // Catálogo de planos/serviços oferecidos na matrícula (feature lead→cliente).
  const [planos, setPlanos] = useState([]);
  // Contratos de matrícula/renovação (feature lead→cliente). 1 doc por
  // matrícula e por renovação — histórico imutável, ligado ao lead por leadId.
  const [contratos, setContratos] = useState([]);
  // Configurações Gerais da academia: modalidades + opções de quantidade de aulas + unidades.
  const [modalities, setModalities] = useState([]);
  const [trialClassOptions, setTrialClassOptions] = useState([1, 2, 3]);
  const [units, setUnits] = useState([]);
  const [professores, setProfessores] = useState([]);
  // Dias da semana em que a Meta Diária vale para a equipe (0=dom..6=sáb).
  // Política da ACADEMIA — definida pelo admin nas Configurações Gerais.
  const [metaWeekdays, setMetaWeekdays] = useState([1, 2, 3, 4, 5]);
  // SLA de atrasados: dias de atraso a partir dos quais o lead vira "crítico"
  // (alerta no painel da Equipe + destaque na meta). Política da academia.
  const [slaOverdueDays, setSlaOverdueDays] = useState(3);
  // Meta por VOLUME: piso default de ações/dia da academia (0 = desligado);
  // alvo individual do consultor (doc do usuário) tem precedência.
  const [dailyVolumeTarget, setDailyVolumeTarget] = useState(0);
  // Janela (dias) p/ contrato ser "a vencer" — política da academia (feature
  // lead→cliente). Default 30 (= DEFAULT_CONTRACT_THRESHOLD_DAYS em contracts.js).
  const [contractThresholdDays, setContractThresholdDays] = useState(30);
  // Valor do GeneralConfigContext (declarado aqui, antes de qualquer early return,
  // para respeitar as regras dos hooks).
  const generalConfigValue = useMemo(
    () => ({ modalities, trialClassOptions, units, metaWeekdays, slaOverdueDays, dailyVolumeTarget, planos, contratos, contractThresholdDays, professores }),
    [modalities, trialClassOptions, units, metaWeekdays, slaOverdueDays, dailyVolumeTarget, planos, contratos, contractThresholdDays, professores]
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

  // Após criar o lead, abrimos a ficha-página dele automaticamente. Como o
  // `addDoc` retorna só o ref, esperamos o lead aparecer em `leads` via
  // onSnapshot (geralmente <100ms). justCreatedLeadId é o ID alvo; ao chegar,
  // viramos profileLeadId (abre a LeadProfileView).
  const [justCreatedLeadId, setJustCreatedLeadId] = useState(null);

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
          let billingWarn = null;
          if (tData) {
            if (tData.status === 'suspended') {
              block = 'suspended';
            } else if (tData.status === 'trial' && typeof tData.trialEndsAt?.toMillis === 'function') {
              const ms = tData.trialEndsAt.toMillis();
              // Trial vencido só bloqueia se AINDA não pagou. Se o pagamento já
              // entrou (webhook marcou 'paid'), libera mesmo que o status ainda
              // esteja 'trial' — rede de segurança do fix do webhook.
              if (ms < Date.now()) { if (tData.paymentStatus !== 'paid') block = 'trial_expired'; }
              else trialMs = ms; // trial ativo → alimenta o banner de contagem
            }
            // Inadimplência além da carência (3 dias) corta o acesso automaticamente,
            // independente do status. Pagou → webhook marca 'paid' → libera sozinho.
            if (!block && tData.paymentStatus === 'overdue' && typeof tData.paymentOverdueSince?.toMillis === 'function'
                && Date.now() - tData.paymentOverdueSince.toMillis() > 3 * 24 * 60 * 60 * 1000) {
              block = 'payment_overdue';
            }
            // Aviso de vencimento da mensalidade (banner p/ o admin): cobrança
            // vencendo em <= 7 dias ou já vencida (dentro da carência). A janela
            // inferior de -1 dia evita banner permanente em tenant de cobrança
            // manual com nextBillingAt antigo e nunca marcado como 'overdue'.
            if (!block) {
              const DAY = 24 * 60 * 60 * 1000;
              const dueAtMs = typeof tData.nextBillingAt?.toMillis === 'function' ? tData.nextBillingAt.toMillis() : null;
              const invoiceUrl = tData.lastInvoiceUrl || null;
              if (tData.paymentStatus === 'overdue') {
                billingWarn = { dueAtMs, overdue: true, invoiceUrl };
              } else if (dueAtMs != null && dueAtMs - Date.now() <= 7 * DAY && dueAtMs - Date.now() > -DAY) {
                billingWarn = { dueAtMs, overdue: false, invoiceUrl };
              }
            }
          }
          setTenantBlock(block);
          setTrialEndsAtMs(trialMs);
          setBillingDue(billingWarn);
        } catch (statusErr) {
          console.warn('Falha ao ler status do tenant; liberando acesso.', statusErr);
          setTenantBlock(null);
          setTrialEndsAtMs(null);
          setBillingDue(null);
        }
      } else {
        setTenantBlock(null);
        setTrialEndsAtMs(null);
        setBillingDue(null);
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

  // Base COMPARTILHADA: todos os consultores carregam todos os leads/interações da
  // academia (o DONO fica em consultantAuthUid p/ atribuição/ranking/meta). As telas
  // pessoais (Dashboard/Meta Diária) filtram pelo dono na própria tela.
  const leadsSource = leadsRef;
  const interactionsSource = interactionsRef;

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

  const unsubDores = onSnapshot(
    collection(db, 'artifacts', appId, 'public', 'data', DORES_PATH),
    (snapshot) => {
      setDores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    },
    onSnapErr('dores')
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

  const unsubProfessores = onSnapshot(
    collection(db, 'artifacts', appId, 'public', 'data', PROFESSORS_PATH),
    (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
      setProfessores(data);
    },
    onSnapErr('professores')
  );

  const unsubPlanos = onSnapshot(
    collection(db, 'artifacts', appId, 'public', 'data', PLANS_PATH),
    (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
      setPlanos(data);
    },
    onSnapErr('planos')
  );

  const unsubContratos = onSnapshot(
    collection(db, 'artifacts', appId, 'public', 'data', CONTRACTS_PATH),
    (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setContratos(data);
    },
    onSnapErr('contratos')
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
      setSlaOverdueDays(normalizeSlaOverdueDays(data?.slaOverdueDays));
      setDailyVolumeTarget(normalizeDailyVolumeTarget(data?.dailyVolumeTarget));
      const t = Math.floor(Number(data?.contractThresholdDays));
      setContractThresholdDays(Number.isFinite(t) && t > 0 ? Math.min(t, 365) : 30);
    },
    () => { setTrialClassOptions([1, 2, 3]); setMetaWeekdays([1, 2, 3, 4, 5]); setSlaOverdueDays(3); setDailyVolumeTarget(0); setContractThresholdDays(30); }
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
    unsubDores();
    unsubFunnels();
    unsubModalities();
    unsubProfessores();
    unsubPlanos();
    unsubContratos();
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
      setProfileLeadId(lead.id);
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

  // Trocar de aba SEMPRE fecha a ficha-página aberta (senão o gate profileLead
  // continuaria sobrepondo o conteúdo e a navegação parecia "travada").
  const changeTab = (tab) => { setActiveTab(tab); setProfileLeadId(null); setIsMobileMenuOpen(false); }
  // Abre a ficha-página de um lead/cliente (sobrepõe o conteúdo da aba ativa);
  // lembra a aba de origem para o "Voltar". closeProfile volta para ela.
  const openProfile = useCallback((leadId) => {
    if (leadId) setProfileLeadId(leadId);
  }, []);
  const closeProfile = useCallback(() => { setProfileLeadId(null); }, []);
  const leadProfileValue = useMemo(() => ({ openProfile }), [openProfile]);
  // Lead/cliente em foco na ficha-página (derivado de `leads` p/ refletir o
  // onSnapshot ao vivo). null = nenhuma ficha aberta (mostra a aba ativa).
  const profileLead = profileLeadId ? (leads || []).find(l => l.id === profileLeadId) || null : null;
  // Abre Configurações já numa aba específica (sidebar e link "Regras gerais" do Perfil).
  const openSettingsTab = (tab) => { setSettingsTab(tab); changeTab('settings'); };

  // ── Badge de pendências da Meta Diária no menu lateral ──────────────────
  // dayKey vira na meia-noite (timeout re-armado a cada virada) para o badge
  // não ficar preso no dia anterior com a aba aberta — mesmo princípio do fix
  // A5 da Meta. Um re-render por dia, custo zero no resto do tempo.
  const [dayKey, setDayKey] = useState(() => dgDateKey(new Date()));
  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 5, 0); // 00:00:05 do dia seguinte
    const t = setTimeout(() => setDayKey(dgDateKey(new Date())), nextMidnight - now);
    return () => clearTimeout(t);
  }, [dayKey]);

  // Tarefas pendentes HOJE do usuário logado (mesma regra Meta-only da tela).
  const dailyGoalPending = useMemo(() => {
    if (!appUser?.id) return 0;
    void dayKey; // recalcula na virada do dia
    const slots = computeDailyGoalSlots(leads, buildInteractionsByLead(interactions), appUser.id, contractThresholdDays);
    const { totalSlots, doneSlots } = slotTotals(slots);
    return totalSlots - doneSlots;
  }, [leads, interactions, appUser, dayKey, contractThresholdDays]);

  // Clientes com contrato "a vencer" no escopo do usuário (admin vê todos;
  // consultor vê os seus) — badge âmbar no item Clientes da sidebar.
  const clientsAVencer = useMemo(() => {
    if (!appUser) return 0;
    void dayKey; // reavalia na virada do dia
    const scope = isAdminUser(appUser) ? (leads || []) : (leads || []).filter(l => l.consultantId === appUser.id);
    const now = new Date();
    return scope.filter(l =>
      l.lifecycleStage === 'cliente' &&
      deriveLeadContractStatus(l, now, contractThresholdDays) === CONTRACT_STATUS.A_VENCER
    ).length;
  }, [leads, appUser, dayKey, contractThresholdDays]);

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
    // Trial expirado → tela de ativação (escolhe plano + paga e libera sozinho).
    // Suspensa / inadimplente seguem na TenantBlockedScreen.
    if (tenantBlock === 'trial_expired') {
      return <TrialActivationScreen isAdmin={isAdminUser(appUser)} onLogout={handleLogout} />;
    }
    return <TenantBlockedScreen reason={tenantBlock} onLogout={handleLogout} />;
  }

  // Super-admin "puro" (dono da plataforma): entra DIRETO no Console dark — ele é
  // a interface principal. (O SuperAdminView antigo segue como fallback p/ super-admin
  // que também é membro de um tenant; o botão "beta" continua lá pra eles.)
  if (appUser.superAdminOnly) {
    return <SuperConsole appUser={appUser} onClose={handleLogout} />;
  }

  return (
    <GeneralConfigContext.Provider value={generalConfigValue}>
    <LeadProfileContext.Provider value={leadProfileValue}>
    <div className="flex h-[100dvh] bg-paper-50 dark:bg-neutral-950 text-gray-900 dark:text-white selection:bg-brand-600 selection:text-white overflow-hidden" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, sans-serif' }}>
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />}

      {/* Desktop: trilho recolhido (só ícones) que expande por cima do
          conteúdo no hover ou foco de teclado. Mobile: drawer como antes. */}
      <aside className={`group/sidebar fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-ink-900 border-r border-border flex flex-col overflow-hidden transition-[transform,width,box-shadow] duration-300 ease-in-out transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:w-18 md:hover:w-64 md:has-[:focus-visible]:w-64 md:hover:shadow-[0_12px_40px_-12px_rgba(14,26,64,.35)] md:has-[:focus-visible]:shadow-[0_12px_40px_-12px_rgba(14,26,64,.35)]`}>
        {/* Marca */}
        <div className="h-16 px-5 flex items-center justify-between gap-3 border-b border-slate-200/80 dark:border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl grid place-items-center bg-brand-50 dark:bg-white/[0.06] ring-1 ring-brand-100 dark:ring-white/[0.08] shrink-0">
              <SurgeMark size={22} />
            </div>
            <span className={`min-w-0 ${SIDEBAR_EXPANDED_ONLY}`}>
              <StronileadWordmark className="text-[16px] text-gray-900 dark:text-white" />
            </span>
          </div>
          <button className="md:hidden text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white p-1 shrink-0" onClick={() => setIsMobileMenuOpen(false)}><X className="w-5 h-5" /></button>
        </div>

        {/* Navegação */}
        <nav className="flex-1 px-3 pt-5 pb-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {!appUser.superAdminOnly && (
            <>
              <div className={`px-2.5 mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500 whitespace-nowrap ${SIDEBAR_EXPANDED_ONLY}`}>Workspace</div>
              <div className="space-y-1">
                <SidebarItem icon={<LayoutDashboard className="w-[18px] h-[18px]" />} label="Visão geral" active={activeTab === 'dashboard'} onClick={() => changeTab('dashboard')} />
                <SidebarItem icon={<Kanban className="w-[18px] h-[18px]" />} label="Pipeline" active={activeTab === 'kanban'} onClick={() => changeTab('kanban')} />
                <SidebarItem icon={<GraduationCap className="w-[18px] h-[18px]" />} label="Clientes" badge={clientsAVencer > 0 ? clientsAVencer : null} active={activeTab === 'clientes'} onClick={() => changeTab('clientes')} />
                <SidebarItem icon={<Target className="w-[18px] h-[18px]" />} label="Meta diária" badge={dailyGoalPending > 0 ? dailyGoalPending : null} active={activeTab === 'dailyGoal'} onClick={() => changeTab('dailyGoal')} />
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
                <SidebarItem icon={<LifeBuoy className="w-[18px] h-[18px]" />} label="Suporte" badge={ticketsUnread > 0 ? ticketsUnread : null} active={false} onClick={() => setTicketModalOpen(true)} />
              </div>
            </>
          )}

          {(appUser?.superAdmin || (!appUser.superAdminOnly && isAdminUser(appUser))) && (
            <>
              <div className={`px-2.5 mt-6 mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500 whitespace-nowrap ${SIDEBAR_EXPANDED_ONLY}`}>Administração</div>
              <div className="space-y-1">
                {!appUser.superAdminOnly && isAdminUser(appUser) && (
                  <SidebarItem icon={<Settings className="w-[18px] h-[18px]" />} label="Configurações" active={activeTab === 'settings'} onClick={() => openSettingsTab('users')} />
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
      </aside>

      {/* Reserva a largura do trilho recolhido no layout (a sidebar é fixed
          e expande por cima do conteúdo sem empurrá-lo). */}
      <div aria-hidden="true" className="hidden md:block w-18 shrink-0" />

      <main className="flex-1 flex flex-col min-w-0 relative">
        {(impersonation || appUser.impersonating) && (
          <ImpersonationBanner
            viewing={impersonation?.viewing || { id: appUser.impersonatedTenant, name: appUser.impersonatedTenant }}
            onExit={stopImpersonation} busy={exitingImpersonation} />
        )}
        <header className="h-16 border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 backdrop-blur-md flex items-center justify-between px-4 md:px-8 z-10 shrink-0">
          <div className="flex items-center min-w-0">
            <button className="md:hidden mr-4 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white dark:text-white p-1" onClick={() => setIsMobileMenuOpen(true)}><Menu className="w-6 h-6" /></button>
            <h2 className="font-display text-xl font-bold text-gray-900 dark:text-white capitalize truncate tracking-tight">
              {activeTab === 'dashboard' && 'Visão Geral'}
              {activeTab === 'kanban' && 'Pipeline de Vendas'}
              {activeTab === 'clientes' && 'Clientes'}
              {activeTab === 'dailyGoal' && 'Sua Meta Diária'}
              {activeTab === 'leads' && 'Todos os Leads'}
              {activeTab === 'aulas' && 'Aulas Experimentais'}
              {activeTab === 'visitas' && 'Visitas'}
              {activeTab === 'settings' && 'Configurações'}
              {activeTab === 'profile' && 'Perfil da academia'}
              {activeTab === 'billing' && 'Plano & faturas'}
              {activeTab === 'superadmin' && (({ overview: 'Visão Geral', clients: 'Clientes', finance: 'Financeiro', plans: 'Planos' }[superTab] || 'Organizações') + ' · Super-admin')}
            </h2>
          </div>
          {!appUser.superAdminOnly && (
            <GlobalSearch leads={leads} onAddLead={() => setIsAddLeadModalOpen(true)} />
          )}
          <div className="flex items-center gap-2 md:gap-3">
            {!appUser.superAdminOnly && (
              <div className="hidden sm:flex items-center mr-1">
                <button
                  onClick={() => setIsAddLeadModalOpen(true)}
                  className="text-[13px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition whitespace-nowrap"
                >
                  Cadastrar lead
                </button>
              </div>
            )}
            {!appUser.superAdminOnly && (
              <button
                onClick={() => setTutorialsOpen(true)}
                className="p-2 rounded-xl text-brand-600 dark:text-brand-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-all active:scale-95 border border-transparent hover:border-gray-200 dark:hover:border-neutral-700"
                title="Tutoriais"
                aria-label="Tutoriais"
              >
                <GraduationCap className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-xl text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-all active:scale-95 border border-transparent hover:border-gray-200 dark:hover:border-neutral-700"
              title="Alternar Tema"
            >
              {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-brand-600" />}
            </button>
            <PersonaMenu
              appUser={appUser}
              isAdmin={!appUser.superAdminOnly && isAdminUser(appUser)}
              onProfile={() => changeTab('profile')}
              onBilling={() => changeTab('billing')}
              onLogout={handleLogout}
            />
          </div>
        </header>

        {!appUser.superAdminOnly && trialEndsAtMs && <TrialBanner endsAtMs={trialEndsAtMs} />}

        {/* Aviso de mensalidade: só p/ o admin (consultor não gerencia cobrança).
            Com o banner de trial visível, só aparece se já estiver VENCIDA. */}
        {!appUser.superAdminOnly && isAdminUser(appUser) && billingDue && (billingDue.overdue || !trialEndsAtMs) && (
          <PaymentDueBanner
            dueAtMs={billingDue.dueAtMs}
            overdue={billingDue.overdue}
            invoiceUrl={billingDue.invoiceUrl}
            onOpenBilling={() => changeTab('billing')}
          />
        )}

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
              <SuperAdminView tab={superTab} onOpenConsole={() => setConsoleOpen(true)} />
            </div>
          ) : loadingData ? (
            <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto w-full h-full">
              <ViewSkeleton activeTab={activeTab} />
            </div>
          ) : (
            <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto w-full h-full transition-all duration-300">
              {profileLead ? (
                <LeadProfileView
                  key={profileLead.id}
                  lead={profileLead}
                  interactions={(interactions || []).filter(i => i.leadId === profileLead.id).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))}
                  onBack={closeProfile}
                  appUser={appUser}
                  statuses={statuses}
                  tags={tags}
                  lossReasons={lossReasons}
                  usersList={usersList}
                  db={db}
                  funnels={funnels}
                />
              ) : (<>
              {activeTab === 'dashboard' && <DashboardView leads={isAdminUser(appUser) ? leads : (leads || []).filter(l => l.consultantId === appUser.id)} interactions={isAdminUser(appUser) ? interactions : (interactions || []).filter(i => i.consultantAuthUid === appUser.authUid || i.leadConsultantAuthUid === appUser.authUid)} appUser={appUser} statuses={statuses} usersList={usersList} tags={tags} lossReasons={lossReasons} db={db} funnels={funnels} selectedFunnelId={selectedFunnelId} setSelectedFunnelId={setSelectedFunnelId} />}
              {activeTab === 'kanban' && <KanbanView leads={leads} interactions={interactions} appUser={appUser} statuses={statuses} usersList={usersList} tags={tags} lossReasons={lossReasons} db={db} funnels={funnels} selectedFunnelId={selectedFunnelId} setSelectedFunnelId={setSelectedFunnelId} />}
              {activeTab === 'clientes' && <ClientsView leads={leads} interactions={interactions} appUser={appUser} statuses={statuses} usersList={usersList} tags={tags} lossReasons={lossReasons} db={db} funnels={funnels} />}
              {activeTab === 'dailyGoal' && <DailyGoalView leads={leads} interactions={interactions} appUser={appUser} statuses={statuses} db={db} tags={tags} lossReasons={lossReasons} usersList={usersList} funnels={funnels} />}
              {activeTab === 'leads' && <LeadsView leads={leads} interactions={interactions} appUser={appUser} sources={sources} statuses={statuses} usersList={usersList} tags={tags} lossReasons={lossReasons} db={db} funnels={funnels} selectedFunnelId={selectedFunnelId} setSelectedFunnelId={setSelectedFunnelId} onAddLeadClick={() => setIsAddLeadModalOpen(true)} />}
              {activeTab === 'aulas' && <AppointmentTrackingView leads={leads} interactions={interactions} appUser={appUser} statuses={statuses} tags={tags} lossReasons={lossReasons} db={db} funnels={funnels} usersList={usersList} appointmentType="aula_experimental" />}
              {activeTab === 'visitas' && <AppointmentTrackingView leads={leads} interactions={interactions} appUser={appUser} statuses={statuses} tags={tags} lossReasons={lossReasons} db={db} funnels={funnels} usersList={usersList} appointmentType="visita" />}
              {activeTab === 'settings' && isAdminUser(appUser) && <SettingsView initialTab={settingsTab} sources={sources} statuses={statuses} db={db} usersList={usersList} appUser={appUser} tags={tags} lossReasons={lossReasons} dores={dores} leads={leads} funnels={funnels} modalities={modalities} planos={planos} trialClassOptions={trialClassOptions} units={units} metaWeekdays={metaWeekdays} />}
              {activeTab === 'profile' && isAdminUser(appUser) && <div className="max-w-4xl mx-auto"><GymProfileTab /></div>}
              {activeTab === 'billing' && isAdminUser(appUser) && <div className="max-w-4xl mx-auto"><PlanInvoicesTab /></div>}
              {activeTab === 'superadmin' && appUser?.superAdmin && <SuperAdminView tab={superTab} onOpenConsole={() => setConsoleOpen(true)} />}
              </>)}
            </div>
          )}
        </div>
      </main>

      {/* Quick-add lead, alcançável de qualquer aba pelo botão do menu lateral
          ou pelo botão da LeadsView. Ao salvar, abrimos automaticamente o
          perfil do lead recém-criado (via justCreatedLeadId → useEffect). */}
      {isAddLeadModalOpen && (
        <AddLeadModal
          dores={dores}
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
      {consoleOpen && appUser?.superAdmin && (
        <SuperConsole appUser={appUser} onClose={() => setConsoleOpen(false)} />
      )}
      {ticketModalOpen && <SupportCenterModal appUser={appUser} tickets={tickets} onClose={() => setTicketModalOpen(false)} />}
      <WhatsNewModal appUser={appUser} onConfigure={() => openSettingsTab('general')} />
      <WalkthroughModal appUser={appUser} />
      <TutorialsHubModal open={tutorialsOpen} onClose={() => setTutorialsOpen(false)} />
    </div>
    </LeadProfileContext.Provider>
    </GeneralConfigContext.Provider>
  );
}
