import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { LayoutDashboard, Users, Plus, AlertTriangle, Activity, X, Menu, Settings, Kanban, Moon, Sun, Target, Globe, LifeBuoy, GraduationCap } from 'lucide-react';

import {
  onAuthStateChanged,
  signInWithCustomToken,
  signOut,
  setPersistence
} from 'firebase/auth';

import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  getDocs,
  getDocsFromServer,
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
  persistenceFor,
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
import { getSafeDate } from './lib/dates.js';
import { isAdminUser, normalizeLeadDoc } from './lib/leads.js';
import { planExpiredSetupOps } from './lib/expiredFunnel.js';
import { planRenewalSetupOps } from './lib/renewalFunnel.js';
import { planUpgradeSetupOps } from './lib/upgradeFunnel.js';
import { computeDailyGoalSlots, buildInteractionsByLead, slotTotals, dgDateKey } from './lib/dailyGoal.js';
import { recordGoalHit as recordGoalHitDoc, goalHitKeyToRecord } from './lib/dailyGoalHistory.js';
import { useRenewalClients } from './hooks/useRenewalClients.js';
import { useClientsWithContactToday } from './hooks/useClientsWithContactToday.js';
import { useRouteScroll } from './hooks/useRouteScroll.js';
import { useActivityGate } from './hooks/useActivityGate.js';
import { getDefaultFunnel, commitOpsInChunks, ALL_FUNNELS_ID, isAllFunnels } from './lib/funnels.js';
import { planReferralSetupOps } from './lib/referrals.js';
import { planDefaultFunnel, planNegociacaoStages } from './lib/funnelSetup.js';
import { tenantCol, tenantDoc, writeSetupWrites, writeSetupPlan } from './lib/funnelSetupWrites.js';
import { IDLE_RUN, runStatusFor, settleRun, EMPTY_SETUP_FLAGS, setupFlagsFromConfig, setupFlagFor } from './lib/setupRun.js';
import { parseAppPath, routeDecision, hrefFor, screenKey, documentTitle } from './lib/routes.js';
import { funnelFromSearch } from './lib/screenParams.js';
import {
  screenState, sessionKeyFor, loginTenantSlug,
  loginBrand, logoutDestination, returnToFrom, savedFunnelKey, readSavedFunnel,
} from './lib/appShell.js';
import { ToastProvider } from './contexts/ToastContext.jsx';
import { GeneralConfigContext } from './contexts/GeneralConfigContext.jsx';
import { LeadProfileContext } from './contexts/LeadProfileContext.jsx';
import { normalizeTrialClassOptions, normalizeMetaWeekdays, normalizeSlaOverdueDays, normalizeDailyVolumeTarget, normalizeRenewalCheckpoints } from './lib/leadStatus.js';
import { normalizeRenewalGraceDays } from './lib/renewalGoal.js';
import { IMPERSONATION_KEY, readImpersonation } from './lib/superadmin.js';
import { SurgeMark, StronileadWordmark } from './components/brand/SurgeMark.jsx';
import { TrialBanner, PaymentDueBanner, ImpersonationBanner } from './components/layout/Banners.jsx';
import { ViewSkeleton } from './components/ui/Skeleton.jsx';
import { SidebarItem, SidebarGroup, SidebarSubItem, SIDEBAR_EXPANDED_ONLY } from './components/layout/Sidebar.jsx';
import { TenantBlockedScreen } from './views/auth/TenantBlockedScreen.jsx';
import { TrialActivationScreen } from './views/auth/TrialActivationScreen.jsx';
import { AcceptInviteScreen } from './views/auth/AcceptInviteScreen.jsx';
import { ReferralLandingScreen } from './views/public/ReferralLandingScreen.jsx';
import { LoginScreen } from './views/auth/LoginScreen.jsx';
import { DashboardOperacionalView } from './views/dashboard/DashboardOperacionalView.jsx';
import { DashboardCrmView } from './views/dashboard/DashboardCrmView.jsx';
import { DashboardGerencialView } from './views/dashboard/DashboardGerencialView.jsx';
import { KanbanView } from './views/KanbanView.jsx';
import { AppointmentTrackingView } from './views/AppointmentTrackingView.jsx';
import { LeadsView } from './views/LeadsView.jsx';
import { ClientsView } from './views/ClientsView.jsx';
import { LeadProfileRoute } from './views/LeadProfileRoute.jsx';
import { AddLeadModal } from './modals/AddLeadModal.jsx';
import { DailyGoalView } from './views/DailyGoalView.jsx';
import { SettingsView } from './views/settings/SettingsView.jsx';
import { WhatsNewModal } from './components/WhatsNewModal.jsx';
import { WalkthroughModal } from './components/WalkthroughModal.jsx';
import { HelpCenterModal } from './components/HelpCenterModal.jsx';
import { NotificationBell } from './components/layout/NotificationBell.jsx';
import { useNotificationsSeen } from './hooks/useNotificationsSeen.js';
import { useHandoffs } from './hooks/useHandoffs.js';
import { GymProfileTab } from './views/settings/GymProfileTab.jsx';
import { PlanInvoicesTab } from './views/settings/PlanInvoicesTab.jsx';
import { PersonaMenu } from './components/layout/PersonaMenu.jsx';
import { GlobalSearch } from './components/layout/GlobalSearch.jsx';
import { SuperAdminView } from './views/superadmin/SuperAdminView.jsx';
import { SuperConsole } from './views/console/SuperConsole.jsx';
import { SupportCenterModal } from './modals/SupportCenterModal.jsx';
import { countUnreadForClient } from './lib/ticketThread.js';
import { AppErrorBoundary } from './components/ErrorBoundary.jsx';
import { RouteRedirect } from './components/RouteRedirect.jsx';
import { setSentryUser, clearSentryUser } from './lib/sentry.js';

// ==========================================
// COMPONENTE PRINCIPAL (APP)
// ==========================================
export default function App() {
  // Rotas públicas, decididas uma vez aqui e fora das telas do app logado
  // (src/lib/routes.js). /?invite=<token>&t=<tenantId> abre o aceite de
  // convite. Por isso invite, t e ref nunca podem virar parâmetro de tela.
  const [invite] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return { token: p.get('invite'), tenantId: p.get('t') };
    } catch {
      return { token: null, tenantId: null };
    }
  });
  // /i/<slug>?ref=<idDoCliente> abre a página PÚBLICA de indicação (fase 2).
  // O segmento "i" é palavra reservada (src/lib/tenantSlug.js): nenhuma
  // academia pode ter esse identificador.
  const [referralRoute] = useState(() => {
    try {
      const m = String(window.location.pathname || '').match(/^\/i\/([a-z0-9][a-z0-9-]{0,63})\/?$/i);
      if (!m) return null;
      const p = new URLSearchParams(window.location.search);
      return { slug: m[1].toLowerCase(), refId: p.get('ref') || '' };
    } catch {
      return null;
    }
  });
  return (
    <ToastProvider>
      {referralRoute
        ? <ReferralLandingScreen slug={referralRoute.slug} refId={referralRoute.refId} />
        : invite.token && invite.tenantId
          ? <AcceptInviteScreen token={invite.token} tenantId={invite.tenantId} />
          : <AppInner />}
    </ToastProvider>
  );
}

function AppInner() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [authSetupError, setAuthSetupError] = useState('');
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  // Saindo (Sair, ou fim da visualização sem volta): a página vai recarregar no
  // login. Até lá, nada de tela de login nem de /api/tenant-resolve.
  const [leaving, setLeaving] = useState(false);
  // Bloqueio da academia: 'suspended' | 'trial_expired' | null. Lido do doc
  // /tenants/{id} no login (regra permite leitura ao próprio tenant).
  const [tenantBlock, setTenantBlock] = useState(null);
  // Fim do trial (ms) quando a academia está em teste ATIVO — alimenta o
  // banner de contagem regressiva. null quando não há trial ativo.
  const [trialEndsAtMs, setTrialEndsAtMs] = useState(null);
  const [billingDue, setBillingDue] = useState(null); // { dueAtMs, overdue, invoiceUrl } | null
  // Resposta do /api/tenant-resolve para a MARCA da academia na tela de login:
  // { slug, found, displayName? }. NÃO controla acesso (isso continua sendo o
  // claim tenantId + as rules). A marca mostrada (urlTenant) é derivada abaixo.
  const [resolvedBrand, setResolvedBrand] = useState(null);
  // Volta do "Sair da visualização": { fromTenant, path, key }. routeDecision
  // leva ao endereço do "Acessar como", só na entrada do histórico `key`.
  const [returnTo, setReturnTo] = useState(null);
  // Nome da academia da sessão, lido do doc tenants/{id} no login. Vai no
  // título da aba.
  const [tenantDisplayName, setTenantDisplayName] = useState('');

  // O endereço manda na tela (src/lib/routes.js). Nada disto é estado: a tela,
  // a ficha e a subaba do super-admin saem do endereço a cada render, e
  // routeDecision diz se o endereço vale para esta sessão. Quando não vale, a
  // tela de destino já é desenhada neste render (shown) e o <RouteRedirect>
  // troca o endereço com replace. Assim a tela barrada nunca pisca e nenhum
  // effect lê o endereço para dar setState.
  const location = useLocation();
  const navigate = useNavigate();
  const route = useMemo(() => parseAppPath(location.pathname), [location.pathname]);
  const decision = routeDecision(route, appUser, { search: location.search, returnTo: returnTo?.key === location.key ? returnTo : null });
  const shown = decision.kind === 'redirect' && decision.target ? decision.target : route;
  // activeTab, resolvedTab, profileLeadId e superTab continuam com os nomes de
  // sempre (src/lib/appShell.js). 'dashboard' é o endereço curto /<academia> e
  // abre o Operacional. Com a ficha aberta, activeTab é a tela de onde ela foi
  // aberta (menu aceso e título da origem), ou 'ficha' quando ela foi aberta
  // direto numa aba nova.
  const { fichaOpen, profileLeadId, activeTab, resolvedTab, superTab } = screenState(shown, location.state, appUser);
  // As três abas da Visão geral. O grupo do menu fica aberto enquanto uma
  // delas está ativa; fora delas, vale o toggle do usuário.
  const isDashTab = resolvedTab === 'dashOperacional' || resolvedTab === 'dashCrm' || resolvedTab === 'dashGerencial';
  // Academia da sessão para montar endereços. Vem do claim, nunca do endereço.
  const sessionTenant = appUser && !appUser.superAdminOnly ? appUser.tenantId : null;
  // Chave da sessão da ficha: sair e entrar, ou o "Acessar como", refazem a
  // leitura da ficha na academia certa mesmo com o mesmo id no endereço.
  const sessionKey = sessionKeyFor(appUser);
  // Rolagem do conteúdo por entrada do histórico: voltar devolve a posição. A
  // chave é a da tela mostrada (a mesma da key do AppErrorBoundary), e não a do
  // endereço: num endereço barrado as duas diferem por um render.
  const contentScrollRef = useRef(null);
  const onContentScroll = useRouteScroll(contentScrollRef, screenKey(shown));
  const [consoleOpen, setConsoleOpen] = useState(false); // overlay do novo Console dark (super-admin)
  const [ticketModalOpen, setTicketModalOpen] = useState(false); // abrir chamado de suporte (cliente)
  // Tickets de suporte do tenant (badge da sidebar + Central de Suporte).
  // Não-crítico: erro aqui não bloqueia o app (sem loadError). Fora do gate
  // (superadmin puro / academia bloqueada) o estado antigo fica ignorado via
  // `ticketsOn` em vez de reset síncrono no effect (react-hooks/set-state-in-effect).
  const [rawTickets, setRawTickets] = useState([]);
  // Portão de atividade (auditoria de 28/07/2026): sem ninguém mexer por 15 min,
  // TODA assinatura ao vivo é derrubada. Não desloga nem limpa a tela — só corta
  // o plantão com o Firestore, que é o que a recobrança dos 30 min tarifava a
  // noite inteira numa máquina esquecida ligada. Volta ao 1º sinal de vida.
  const listenersActive = useActivityGate();
  const ticketsOn = !!appUser?.tenantId && !appUser?.superAdminOnly && !tenantBlock;
  useEffect(() => {
    if (!ticketsOn || !listenersActive) return;
    const q = query(collection(db, 'tickets'), where('tenantId', '==', appUser.tenantId));
    const unsub = onSnapshot(q,
      (snap) => setRawTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.error('onSnapshot tickets falhou', e));
    return () => unsub();
  }, [ticketsOn, appUser?.tenantId, listenersActive]);
  const tickets = useMemo(() => (ticketsOn ? rawTickets : []), [ticketsOn, rawTickets]);
  const ticketsUnread = useMemo(() => countUnreadForClient(tickets), [tickets]);
  const [tutorialsOpen, setTutorialsOpen] = useState(false); // Central de ajuda (ícone 🎓 do topo)
  // Artigo em que a Central de ajuda abre. O sino manda o leitor direto para o
  // assunto da novidade em que ele clicou.
  const [helpArticleId, setHelpArticleId] = useState(null);
  // "Já li" do sino: ids das novidades vistas + carimbo das indicações.
  const { seenIds, lastSeenReferralsAt, markAllSeen } = useNotificationsSeen({ db, appUser });
  // Leads/clientes que passaram pra carteira desta pessoa (grupo do sino).
  const handoffLeads = useHandoffs({ db, appUser, enabled: !!appUser && !appUser.superAdminOnly });
  // Menu do celular: aberto enquanto o endereço for o mesmo em que ele abriu
  // (location.key). Qualquer troca de endereço fecha o menu sozinha, inclusive
  // o voltar do navegador e o replace de um aviso de rota, sem effect. Os links
  // do menu zeram a chave no clique (onNavigate), então voltar até a entrada
  // onde ele abriu não o reabre.
  const [drawerKey, setDrawerKey] = useState(null);
  const isMobileMenuOpen = drawerKey !== null && drawerKey === location.key;
  const closeDrawer = () => setDrawerKey(null);
  // Accordion "Leads" no menu lateral (Todos os leads / Aulas / Visitas).
  const [leadsMenuOpen, setLeadsMenuOpen] = useState(false);
  // Accordion "Visão geral" (Operacional / Gerencial) — split do dashboard.
  const [overviewMenuOpen, setOverviewMenuOpen] = useState(false);
  
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

  // Marca da academia na tela de login. O /api/tenant-resolve só é chamado
  // quando a tela de login vai aparecer: com sessão, o nome vem do doc
  // tenants/{id} que o login já lê (tenantDisplayName), e o F5 de quem já está
  // logado deixa de gastar a cota por IP da recepção. Enquanto a resposta não
  // chega, a marca fica "carregando" (loginBrand), sem setState no effect.
  const loginSlug = !isAuthChecking && !appUser && !leaving ? loginTenantSlug(location) : null;
  useEffect(() => {
    if (!loginSlug) return undefined;
    let alive = true;
    fetch(`/api/tenant-resolve?slug=${encodeURIComponent(loginSlug)}`)
      .then(r => r.json())
      .then(d => { if (alive) setResolvedBrand(d?.found ? { slug: loginSlug, found: true, displayName: d.displayName } : { slug: loginSlug, found: false }); })
      .catch(() => { if (alive) setResolvedBrand({ slug: loginSlug, found: false }); });
    return () => { alive = false; };
  }, [loginSlug]);
  const urlTenant = loginBrand(loginSlug, resolvedBrand);

  // Título da aba: "<Tela> · <Academia> · STRONILEAD". Na ficha, só "Ficha",
  // nunca o nome da pessoa, porque o título fica no histórico do navegador.
  // Antes do login continua "<Academia> · STRONILEAD".
  const titleScreen = appUser && !appUser.superAdminOnly && !tenantBlock ? (fichaOpen ? 'ficha' : resolvedTab) : null;
  const titleTenant = appUser ? (appUser.superAdminOnly ? '' : tenantDisplayName) : (urlTenant?.displayName || '');
  useEffect(() => {
    document.title = documentTitle({ screen: titleScreen, tenantName: titleTenant });
  }, [titleScreen, titleTenant]);

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
  // Marcos (dias antes do vencimento) que disparam a categoria Renovação da
  // Meta Diária — SUBSTITUEM o threshold único como gatilho da Meta (o
  // threshold acima continua valendo só pro status "A vencer" do sistema).
  // Default [90, 60, 30] — ver src/lib/renewalGoal.js.
  const [renewalCheckpoints, setRenewalCheckpoints] = useState([90, 60, 30]);
  const [renewalGraceDays, setRenewalGraceDays] = useState(15);
  // Valor do GeneralConfigContext (declarado aqui, antes de qualquer early return,
  // para respeitar as regras dos hooks).
  const generalConfigValue = useMemo(
    () => ({ modalities, trialClassOptions, units, metaWeekdays, slaOverdueDays, dailyVolumeTarget, planos, contratos, contractThresholdDays, renewalCheckpoints, renewalGraceDays, professores, dores }),
    [modalities, trialClassOptions, units, metaWeekdays, slaOverdueDays, dailyVolumeTarget, planos, contratos, contractThresholdDays, renewalCheckpoints, renewalGraceDays, professores, dores]
  );
  // Seleção de funil persistida POR ACADEMIA (savedFunnelKey). Começa vazia: a
  // academia só é conhecida no login, e é lá que o funil salvo é lido
  // (readSavedFunnel, logo depois do setTenantId). Sem nada salvo, o effect de
  // validação de funil escolhe o padrão.
  const [selectedFunnelId, setSelectedFunnelId] = useState(null);
  // Configuração de funis do primeiro login de gestor: cinco máquinas em cadeia
  // (funis, Indicações, Vencidos, Renovações, Upgrade). Cada execução guarda
  // de qual academia é ({ tenant, status }), e o status que vale é derivado
  // logo abaixo para a academia atual. O "Acessar como" troca de academia sem
  // recarregar a página, e um 'done' da anterior travaria a próxima até o F5
  // (src/lib/setupRun.js).
  const [funnelsRun, setFunnelsRun] = useState(IDLE_RUN);
  const [referralRun, setReferralRun] = useState(IDLE_RUN);
  const [expiredRun, setExpiredRun] = useState(IDLE_RUN);
  const [renewalRun, setRenewalRun] = useState(IDLE_RUN);
  const [upgradeRun, setUpgradeRun] = useState(IDLE_RUN);
  // Marcas de que cada configuração já rodou nesta academia. Vêm do doc de
  // config, que já é assinado e não custa leitura, junto com a academia de
  // onde vieram. A marca derivada logo abaixo é null enquanto o config desta
  // academia não chega. Sem a marca de funis, a migração relia a coleção
  // INTEIRA de leads em toda carga de admin só pra concluir que não havia nada
  // a fazer (auditoria de 28/07/2026: ~400 leituras por carga, jogadas fora).
  // Indicações tem marca própria (referralSetupDoneAt) porque
  // funnelsSetupDoneAt já está carimbado nos tenants antigos, e esse passo
  // precisa rodar uma vez em todos.
  const [setupFlags, setSetupFlags] = useState(EMPTY_SETUP_FLAGS);
  // O que vale para a academia atual. Estado de outra academia conta como
  // parado ('idle') e como config ainda não chegada (null).
  const setupTenant = appUser?.tenantId || null;
  const funnelsMigrationStatus = runStatusFor(funnelsRun, setupTenant);
  const referralMigrationStatus = runStatusFor(referralRun, setupTenant);
  const expiredFunnelStatus = runStatusFor(expiredRun, setupTenant);
  const renewalFunnelStatus = runStatusFor(renewalRun, setupTenant);
  const upgradeFunnelStatus = runStatusFor(upgradeRun, setupTenant);
  const funnelsSetupDone = setupFlagFor(setupFlags, 'funnels', setupTenant);
  const referralSetupDone = setupFlagFor(setupFlags, 'referral', setupTenant);
  const expiredSetupDone = setupFlagFor(setupFlags, 'expired', setupTenant);
  const renewalSetupDone = setupFlagFor(setupFlags, 'renewal', setupTenant);
  const upgradeSetupDone = setupFlagFor(setupFlags, 'upgrade', setupTenant);
  const [loadingData, setLoadingData] = useState(true);
  // Academia cujos contratos já chegaram. A ficha espera por eles, e não só
  // pelo loadingData, que vira false com os leads ativos: sem isso, a ficha de
  // um cliente aberta direto numa aba nova mostraria a aba Contratos vazia.
  const [contractsTenant, setContractsTenant] = useState(null);
  // Já baixamos os dados ao menos uma vez nesta sessão? Serve pra reassinar
  // (volta da ociosidade) sem piscar a tela de carregando por cima de um dado
  // que já está na mão.
  const hasLoadedOnceRef = useRef(false);
  // Erro de leitura em algum onSnapshot (permissão/rede) — evita falha silenciosa.
  const [loadError, setLoadError] = useState(false);

  // Quick-add lead: aberto pelo botão "Cadastrar Lead" no menu lateral OU
  // pelo botão dentro de LeadsView (que recebe `onAddLeadClick` via prop).
  // O modal mora aqui em App pra ficar acessível de qualquer aba.
  const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState(false);

  // Contexto do Sentry: qual academia e qual papel, para saber quem está
  // sofrendo sem mandar nome nem e-mail para fora. Um effect só, em vez de
  // instrumentar os oito pontos que mexem em appUser.
  useEffect(() => {
    if (appUser) {
      setSentryUser({
        uid: firebaseUser?.uid,
        tenantId: appUser.tenantId,
        role: appUser.role,
        impersonating: !!appUser.impersonating,
      });
    } else {
      clearSentryUser();
    }
  }, [appUser, firebaseUser?.uid]);

  // 1. Inicialização Auth e Persistência de Sessão
  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    setFirebaseUser(currentUser);

    if (!currentUser) {
      setAppUser(null);
      setTenantBlock(null);
      setTrialEndsAtMs(null);
      setTenantDisplayName('');
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
      // Funil escolhido no Pipeline, salvo por academia. Só aqui se sabe qual é
      // a academia; lida antes disso, a chave era a da academia padrão e o F5
      // perdia a escolha em toda academia que não é a STRONIX.
      setSelectedFunnelId(readSavedFunnel(localStorage, tenantId || DEFAULT_TENANT_ID));

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
          setTenantDisplayName(tData?.displayName || tenantId);
        } catch (statusErr) {
          console.warn('Falha ao ler status do tenant; liberando acesso.', statusErr);
          setTenantBlock(null);
          setTrialEndsAtMs(null);
          setBillingDue(null);
          setTenantDisplayName(tenantId);
        }
      } else {
        setTenantBlock(null);
        setTrialEndsAtMs(null);
        setBillingDue(null);
        setTenantDisplayName('');
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
  // eslint-disable-next-line react-hooks/set-state-in-effect -- effect que assina o Firestore (sistema externo); encerrar o loading no guard é o padrão correto de effect.
  if (appUser.superAdminOnly) { setLoadingData(false); return; }
  // Academia bloqueada (suspensa / trial expirado): não tenta carregar dados —
  // a tela de bloqueio é exibida e as rules também negam no servidor. Evita
  // permission-denied silencioso nos onSnapshot.
  if (tenantBlock) { setLoadingData(false); return; }
  // Ociosidade (auditoria de 28/07/2026): o cleanup deste effect já derrubou as
  // assinaturas quando listenersActive virou false. Aqui é só NÃO reassinar.
  // De propósito não mexe em loadingData nem zera leads/interactions: a tela
  // segue mostrando o último estado, e quem voltar não vê nada piscar.
  // O `hasLoadedOnceRef` na condição é trava de segurança: o portão só pode
  // SUSPENDER uma sessão que já carregou. Sem ele, ficar ocioso durante a carga
  // fria deixaria a tela presa no "carregando" até alguém mexer no mouse.
  if (!listenersActive && hasLoadedOnceRef.current) return;
  if (!hasLoadedOnceRef.current) setLoadingData(true);
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
  // Academia desta assinatura. As marcas de "já configurado" saem com ela, para
  // a academia assumida pelo "Acessar como" não herdar as da anterior.
  const configTenant = appId;

  // FLIP (G1-flip): a assinatura ao vivo carrega SÓ os leads ATIVOS (pipeline
  // vivo). É onde a leitura cai — clientes e perdas não entram mais na coleção
  // inteira em memória. Os consumidores que precisam de não-ativos já têm fonte
  // própria: aba Clientes (E1b), coluna Perda do Kanban (E1c), LeadsView (G1a),
  // Busca (G1b), dashboards admin (G1c), Meta (G1d, via renewalClients), ficha
  // (useProfileLead por id) e dup-check (query remota). O dono fica em
  // consultantAuthUid p/ atribuição/ranking; telas pessoais filtram pelo dono.
  const leadsSource = query(leadsRef, where('lifecycleBucket', '==', 'ativo'));
  // G2: interações ao vivo só do MÊS CORRENTE pra cá (limite inferior em
  // createdAt) — é onde a leitura de interações CAI (antes: coleção inteira, que
  // cresce sem limite). É `>=` (não range): novas interações seguem aparecendo ao
  // vivo e a janela se renova a cada abertura do app. Os consumidores precisam só
  // do mês corrente (volume, feito-hoje, badge quente via denorm lead.lastInteractionAt);
  // a timeline da ficha tem query própria (useLeadTimeline). Range de 1 campo →
  // índice automático. O filtro por consultor segue client-side, como antes.
  const _now = new Date();
  const monthStart = new Date(_now.getFullYear(), _now.getMonth(), 1);
  const interactionsSource = query(interactionsRef, where('createdAt', '>=', monthStart));

  const unsubLeads = onSnapshot(leadsSource, (snapshot) => {
    // Normalização única (normalizeLeadDoc em lib/leads) — a MESMA que a query
    // do dashboard do consultor (E2a) usa, pra os shapes não divergirem.
    setLeads(snapshot.docs.map(normalizeLeadDoc));
    hasLoadedOnceRef.current = true;
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
      setContractsTenant(configTenant);
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
      // "A vencer" é padrão FIXO do sistema (30 dias) — não configurável.
      setRenewalCheckpoints(normalizeRenewalCheckpoints(data?.renewalCheckpoints));
      setRenewalGraceDays(normalizeRenewalGraceDays(data?.renewalGraceDays));
      // Doc inexistente (academia nova, antes do provision gravar) conta como
      // "não semeado": a migração roda e carimba. O Vencidos lê a chave v2
      // (expiredFunnelSetupV2DoneAt): ela mudou para o provisionamento rodar
      // uma vez a mais e renomear a etapa de entrada de 'Vencido' para
      // 'Aguardando contato'. Ela é protegida, então ninguém consegue arrumar
      // pela tela.
      setSetupFlags(setupFlagsFromConfig(configTenant, data));
    },
    () => { setTrialClassOptions([1, 2, 3]); setMetaWeekdays([1, 2, 3, 4, 5]); setSlaOverdueDays(3); setDailyVolumeTarget(0); setContractThresholdDays(30); setRenewalCheckpoints([90, 60, 30]); }
  );

  let unsubUsers = () => {};
  if (isAdminUser(appUser)) {
    unsubUsers = onSnapshot(usersRef, (snapshot) => {
      setUsersList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  } else {
    // A equipe inteira, não só o próprio usuário: o consultor precisa dela para
    // passar um lead adiante e para delegar tarefa de contato. É uma coleção
    // pequena e que quase não muda, então vale UMA leitura por sessão em vez de
    // mais uma assinatura ao vivo. Falhou, fica só o próprio usuário e o app
    // segue funcionando como antes.
    setUsersList([appUser]);
    getDocs(usersRef)
      .then((snap) => setUsersList(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch((e) => { console.error('usersList', e); });
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
}, [firebaseUser, appUser, tenantBlock, listenersActive]);

  // Persiste a seleção de funil no localStorage, com chave por tenant.
  useEffect(() => {
    try {
      if (selectedFunnelId) {
        localStorage.setItem(savedFunnelKey(appId), selectedFunnelId);
      }
    } catch { /* ignore */ }
  }, [selectedFunnelId, appUser]);

  // Garante que selectedFunnelId é sempre válido (cai para o default se sumir).
  // O sentinel ALL_FUNNELS_ID é sempre válido — não cai no fallback.
  useEffect(() => {
    if (!funnels || funnels.length === 0) return;
    if (isAllFunnels(selectedFunnelId)) return;
    if (!selectedFunnelId || !funnels.find(f => f.id === selectedFunnelId)) {
      const fallback = getDefaultFunnel(funnels);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- corrige seleção de funil inválida quando a lista de funis muda; roda raramente.
      if (fallback) setSelectedFunnelId(fallback.id);
    }
  }, [funnels, selectedFunnelId]);

  // Cross-tab reset: o modo "Todos os funis" era do Gerencial antigo. Alternar
  // entre as abas da Visão geral não derruba a seleção; ao trocar para
  // Kanban/Leads/Meta, volta para o funil default.
  useEffect(() => {
    if (!isAllFunnels(selectedFunnelId)) return;
    if (isDashTab) return;
    const fallback = getDefaultFunnel(funnels)?.id;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- corrige seleção de funil ao sair das abas de dashboard; roda raramente.
    if (fallback) setSelectedFunnelId(fallback);
  }, [isDashTab, selectedFunnelId, funnels]);

  // Migração idempotente: cria funil "Comercial" default e backfill de funnelId em leads/statuses
  useEffect(() => {
    if (!appUser || !isAdminUser(appUser)) return;
    // Academia desta execução, congelada aqui: é a chave do estado da máquina e
    // o destino de toda leitura e gravação, mesmo que a conta troque no meio
    // (ver funnelSetupWrites.js e setupRun.js).
    const tenant = appUser.tenantId;
    // Janela da troca de conta: o appId já é da academia nova e o appUser ainda
    // é o antigo. Não começa nada aqui; o effect roda de novo quando chega o
    // appUser novo (appUser está nas deps).
    if (appId !== tenant) return;
    if (loadingData) return;
    if (funnelsMigrationStatus !== 'idle') return;
    // Config ainda não chegou: espera. Sem ela não dá pra saber se já semeou.
    if (funnelsSetupDone === null) return;
    // Já semeado: sai sem NENHUMA leitura. A seleção de funil não depende daqui
    // — o effect de fallback logo acima já resolve pelo `funnels` em memória.
    if (funnelsSetupDone) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- encerra a máquina de estados; guardado por status !== 'idle'.
      setFunnelsRun({ tenant, status: 'done' });
      return;
    }

    // Gatilho one-shot da migração idempotente (guardado por status !== 'idle').
    setFunnelsRun({ tenant, status: 'running' });

    (async () => {
      try {
        // As leituras da configuração vêm sempre do servidor: um cache
        // velho planejaria criar de novo um funil que já existe com id antigo, e
        // sem internet a configuração falha sem carimbar em vez de planejar no
        // escuro.

        // Passo 1: garantir EXATAMENTE um funil default. O Comercial criado tem
        // id fixo e só é criado se ainda não existir, então duas abas rodando
        // juntas caem no mesmo documento.
        const funnelsSnap = await getDocsFromServer(tenantCol(tenant, FUNNELS_PATH));
        const step1 = planDefaultFunnel(funnelsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        if (step1.create) {
          await writeSetupWrites(tenant, [{
            collection: 'funnels',
            id: step1.defaultId,
            data: { ...step1.create, createdAt: serverTimestamp() },
          }]);
        }
        if (step1.promoteId) {
          // updateDoc, não setDoc: se o funil foi apagado no meio, falha em vez
          // de recriar um doc sem nome marcado como padrão.
          await updateDoc(tenantDoc(tenant, FUNNELS_PATH, step1.promoteId), { isDefault: true });
        }
        if (step1.demoteIds.length) {
          await commitOpsInChunks(
            db,
            step1.demoteIds.map(id => ({ ref: tenantDoc(tenant, FUNNELS_PATH, id), data: { isDefault: false } })),
            400
          );
        }

        const defaultId = step1.defaultId;

        // Passo 2: backfill statuses sem funnelId
        const statusesSnap = await getDocsFromServer(tenantCol(tenant, STATUSES_PATH));
        const statusOps = [];
        statusesSnap.forEach(d => {
          const data = d.data();
          if (!data.funnelId) {
            statusOps.push({ ref: d.ref, data: { funnelId: defaultId } });
          }
        });
        if (statusOps.length) await commitOpsInChunks(db, statusOps, 400);

        // Passo 3: backfill leads sem funnelId
        const leadsSnap = await getDocsFromServer(tenantCol(tenant, LEADS_PATH));
        const leadOps = [];
        leadsSnap.forEach(d => {
          const data = d.data();
          if (!data.funnelId) {
            leadOps.push({ ref: d.ref, data: { funnelId: defaultId } });
          }
        });
        if (leadOps.length) await commitOpsInChunks(db, leadOps, 400);

        // Passo 4: garantir que todo funil PRÓPRIO tem a etapa de sistema
        // "Negociação". Funil de sistema cuida das próprias etapas, e uma aba
        // atrasada não pode enfiar Negociação em Vencidos ou Upgrade. Id fixo:
        // duas abas caem na mesma etapa.
        const [statusesAfter, funnelsAfter] = await Promise.all([
          getDocsFromServer(tenantCol(tenant, STATUSES_PATH)),
          getDocsFromServer(tenantCol(tenant, FUNNELS_PATH)),
        ]);
        const funnelsForNeg = funnelsAfter.docs.map(d => ({ id: d.id, ...d.data() }));
        // Por garantia: se a leitura do servidor ainda não trouxer o Comercial
        // criado no passo 1, ele entra pelo id que o passo 1 já conhece. Sem
        // isso, o Comercial ficaria sem Negociação para sempre.
        if (step1.create && !funnelsForNeg.some(f => f.id === defaultId)) {
          funnelsForNeg.push({ id: defaultId, ...step1.create });
        }
        await writeSetupWrites(tenant, planNegociacaoStages({
          funnels: funnelsForNeg,
          statuses: statusesAfter.docs.map(d => ({ id: d.id, ...d.data() })),
        }));

        // Define seleção inicial se ainda não houver
        // Só mexe na seleção da tela se a conta não trocou no meio da execução.
        if (appId === tenant) setSelectedFunnelId(prev => prev || defaultId);

        // Carimba no doc de config que esta academia já foi semeada. É o que
        // impede a varredura completa de leads em toda carga futura. merge:true
        // pra não encostar nos demais campos da config.
        await setDoc(
          tenantDoc(tenant, CONFIG_PATH, CONFIG_GENERAL_ID),
          { funnelsSetupDoneAt: serverTimestamp() },
          { merge: true }
        );

        setFunnelsRun(prev => settleRun(prev, tenant, 'done'));
      } catch (err) {
        console.error('Erro na migração de funis', err);
        // Falha causada pela troca de conta no meio (a regra nega a academia
        // antiga) volta a 'idle': a academia roda de novo quando for assumida
        // outra vez. Falha de verdade, na mesma sessão, fica 'error'.
        setFunnelsRun(prev => settleRun(prev, tenant, appId === tenant ? 'error' : 'idle'));
      }
    })();
  }, [appUser, funnels, loadingData, funnelsMigrationStatus, funnelsSetupDone]);

  // Migração idempotente do funil de INDICAÇÕES: cria o funil de sistema com a
  // etapa de entrada fixa ("Aguardando ação") + Negociação, e semeia a origem
  // 'Indicação' se o catálogo não tiver nenhuma. A decisão do que falta é pura
  // (planReferralSetupOps, testada); aqui só se executam as ops. Serializada
  // DEPOIS da migração de funis: garante que existe um default antes — o funil
  // de indicações nunca pode virar o default de facto (fallback legado de
  // isItemInFunnel despejaria os leads sem funnelId nele).
  useEffect(() => {
    if (!appUser || !isAdminUser(appUser)) return;
    // Academia desta execução, congelada aqui: chave do estado e destino das
    // gravações (ver funnelSetupWrites.js e setupRun.js).
    const tenant = appUser.tenantId;
    if (appId !== tenant) return;
    if (loadingData) return;
    if (funnelsMigrationStatus !== 'done') return;
    if (referralMigrationStatus !== 'idle') return;
    // Config ainda não chegou: espera (mesma guarda da migração de funis).
    if (referralSetupDone === null) return;
    if (referralSetupDone) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- encerra a máquina de estados; guardado por status !== 'idle'.
      setReferralRun({ tenant, status: 'done' });
      return;
    }

    // Gatilho one-shot (guardado por status !== 'idle').
    setReferralRun({ tenant, status: 'running' });

    (async () => {
      try {
        // Snapshots frescos por getDocsFromServer (não os props): elimina a corrida com
        // as assinaturas ao vivo ainda vazias no boot. Três leituras pequenas,
        // uma única vez por tenant na vida.
        const [funnelsSnap, statusesSnap, sourcesSnap] = await Promise.all([
          getDocsFromServer(tenantCol(tenant, FUNNELS_PATH)),
          getDocsFromServer(tenantCol(tenant, STATUSES_PATH)),
          getDocsFromServer(tenantCol(tenant, SOURCES_PATH))
        ]);
        const plan = planReferralSetupOps({
          funnels: funnelsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          statuses: statusesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          sources: sourcesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        });

        // Id fixo no funil, nas etapas e na origem: duas abas caem no mesmo doc.
        await writeSetupPlan(tenant, plan);

        // Carimba a flag própria — impede qualquer leitura nas cargas futuras.
        await setDoc(
          tenantDoc(tenant, CONFIG_PATH, CONFIG_GENERAL_ID),
          { referralSetupDoneAt: serverTimestamp() },
          { merge: true }
        );

        setReferralRun(prev => settleRun(prev, tenant, 'done'));
      } catch (err) {
        console.error('Erro na migração do funil de indicações', err);
        setReferralRun(prev => settleRun(prev, tenant, appId === tenant ? 'error' : 'idle'));
      }
    })();
  }, [appUser, loadingData, funnelsMigrationStatus, referralMigrationStatus, referralSetupDone]);

  // Funil VENCIDOS do board. Mesmo desenho do provisionamento de indicações
  // acima, e guardado por ele estar 'done' para as duas escritas não correrem
  // juntas no primeiro login de admin de uma academia nova.
  useEffect(() => {
    if (!appUser || !isAdminUser(appUser)) return;
    // Academia desta execução, congelada aqui: chave do estado e destino das
    // gravações (ver funnelSetupWrites.js e setupRun.js).
    const tenant = appUser.tenantId;
    if (appId !== tenant) return;
    if (loadingData) return;
    if (referralMigrationStatus !== 'done') return;
    if (expiredFunnelStatus !== 'idle') return;
    if (expiredSetupDone === null) return;
    if (expiredSetupDone) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- encerra a máquina de estados; guardado por status !== 'idle'.
      setExpiredRun({ tenant, status: 'done' });
      return;
    }

    setExpiredRun({ tenant, status: 'running' });

    (async () => {
      try {
        // Snapshots frescos por getDocsFromServer (não os props): elimina a corrida com
        // as assinaturas ao vivo ainda vazias no boot.
        const [funnelsSnap, statusesSnap] = await Promise.all([
          getDocsFromServer(tenantCol(tenant, FUNNELS_PATH)),
          getDocsFromServer(tenantCol(tenant, STATUSES_PATH))
        ]);
        const plan = planExpiredSetupOps({
          funnels: funnelsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          statuses: statusesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        });

        // Id fixo no funil e nas etapas: duas abas caem no mesmo doc.
        await writeSetupPlan(tenant, plan);
        for (const ren of (plan.renameStages || [])) {
          await updateDoc(tenantDoc(tenant, STATUSES_PATH, ren.id), { name: ren.name });
        }

        await setDoc(
          tenantDoc(tenant, CONFIG_PATH, CONFIG_GENERAL_ID),
          { expiredFunnelSetupV2DoneAt: serverTimestamp() },
          { merge: true }
        );

        setExpiredRun(prev => settleRun(prev, tenant, 'done'));
      } catch (err) {
        console.error('Erro no provisionamento do funil de vencidos', err);
        setExpiredRun(prev => settleRun(prev, tenant, appId === tenant ? 'error' : 'idle'));
      }
    })();
  }, [appUser, loadingData, referralMigrationStatus, expiredFunnelStatus, expiredSetupDone]);

  // Funil RENOVAÇÕES do board. Mesmo desenho dos dois provisionamentos acima, e
  // guardado pelo Vencidos estar 'done' para as escritas não correrem juntas no
  // primeiro login de admin de uma academia nova.
  //
  // Mais simples que os irmãos: as colunas deste funil são VIRTUAIS (derivadas
  // dos marcos de renovação), então não há etapa nenhuma para criar.
  useEffect(() => {
    if (!appUser || !isAdminUser(appUser)) return;
    // Academia desta execução, congelada aqui: chave do estado e destino das
    // gravações (ver funnelSetupWrites.js e setupRun.js).
    const tenant = appUser.tenantId;
    if (appId !== tenant) return;
    if (loadingData) return;
    if (expiredFunnelStatus !== 'done') return;
    if (renewalFunnelStatus !== 'idle') return;
    if (renewalSetupDone === null) return;
    if (renewalSetupDone) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- encerra a máquina de estados; guardado por status !== 'idle'.
      setRenewalRun({ tenant, status: 'done' });
      return;
    }

    setRenewalRun({ tenant, status: 'running' });

    (async () => {
      try {
        // Snapshot fresco por getDocsFromServer (não o prop): elimina a corrida com a
        // assinatura ao vivo ainda vazia no boot.
        const funnelsSnap = await getDocsFromServer(tenantCol(tenant, FUNNELS_PATH));
        const plan = planRenewalSetupOps({
          funnels: funnelsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        });

        // Id fixo no funil: duas abas caem no mesmo doc.
        await writeSetupPlan(tenant, plan);

        await setDoc(
          tenantDoc(tenant, CONFIG_PATH, CONFIG_GENERAL_ID),
          { renewalFunnelSetupDoneAt: serverTimestamp() },
          { merge: true }
        );

        setRenewalRun(prev => settleRun(prev, tenant, 'done'));
      } catch (err) {
        console.error('Erro no provisionamento do funil de renovações', err);
        setRenewalRun(prev => settleRun(prev, tenant, appId === tenant ? 'error' : 'idle'));
      }
    })();
  }, [appUser, loadingData, expiredFunnelStatus, renewalFunnelStatus, renewalSetupDone]);

  // Funil UPGRADE do board. Mesmo desenho dos três provisionamentos acima, e
  // guardado pelo Renovações estar 'done' para as escritas não correrem juntas
  // no primeiro login de admin de uma academia nova. Só a etapa de entrada
  // nasce; as demais a academia cria em Configurações.
  useEffect(() => {
    if (!appUser || !isAdminUser(appUser)) return;
    // Academia desta execução, congelada aqui: chave do estado e destino das
    // gravações (ver funnelSetupWrites.js e setupRun.js).
    const tenant = appUser.tenantId;
    if (appId !== tenant) return;
    if (loadingData) return;
    if (renewalFunnelStatus !== 'done') return;
    if (upgradeFunnelStatus !== 'idle') return;
    if (upgradeSetupDone === null) return;
    if (upgradeSetupDone) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- encerra a máquina de estados; guardado por status !== 'idle'.
      setUpgradeRun({ tenant, status: 'done' });
      return;
    }

    setUpgradeRun({ tenant, status: 'running' });

    (async () => {
      try {
        // Snapshots frescos por getDocsFromServer (não os props): elimina a corrida com
        // as assinaturas ao vivo ainda vazias no boot.
        const [funnelsSnap, statusesSnap] = await Promise.all([
          getDocsFromServer(tenantCol(tenant, FUNNELS_PATH)),
          getDocsFromServer(tenantCol(tenant, STATUSES_PATH))
        ]);
        const plan = planUpgradeSetupOps({
          funnels: funnelsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          statuses: statusesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        });

        // Id fixo no funil e na entrada: duas abas caem no mesmo doc.
        await writeSetupPlan(tenant, plan);

        await setDoc(
          tenantDoc(tenant, CONFIG_PATH, CONFIG_GENERAL_ID),
          { upgradeFunnelSetupDoneAt: serverTimestamp() },
          { merge: true }
        );

        setUpgradeRun(prev => settleRun(prev, tenant, 'done'));
      } catch (err) {
        console.error('Erro no provisionamento do funil de upgrade', err);
        setUpgradeRun(prev => settleRun(prev, tenant, appId === tenant ? 'error' : 'idle'));
      }
    })();
  }, [appUser, loadingData, renewalFunnelStatus, upgradeFunnelStatus, upgradeSetupDone]);

  // Impersonação ("entrar como"): o banner e o "sair" vivem aqui (nível do app);
  // o "entrar" é feito no SuperAdminView. Ressincroniza com o sessionStorage
  // sempre que a sessão (appUser) troca — começar/voltar trocam o usuário do
  // Firebase, então o effect reflete o estado no banner.
  const [impersonation, setImpersonation] = useState(readImpersonation);
  const [exitingImpersonation, setExitingImpersonation] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza a partir do sessionStorage (fonte externa) ao trocar de usuário.
  useEffect(() => { setImpersonation(readImpersonation()); }, [appUser]);
  // Sai da conta e recarrega a página no destino. A recarga zera a ficha, as
  // listas em memória, a academia do módulo (appId) e as configurações de
  // funil: num computador de recepção, quem entra depois não vê nada da sessão
  // anterior. O await garante que a sessão já saiu do navegador antes da recarga.
  const leaveTo = async (destino) => {
    setLeaving(true);
    try { await signOut(auth); } catch (e) { console.error('Erro ao sair do sistema', e); }
    try { sessionStorage.removeItem(IMPERSONATION_KEY); } catch { /* ignore */ }
    window.location.replace(destino);
  };

  const stopImpersonation = async () => {
    setExitingImpersonation(true);
    // Endereço de onde o super-admin entrou na visualização (returnPath, gravado
    // no "Acessar como"). Sem ele, a volta cai na tela inicial da academia.
    const back = returnToFrom(readImpersonation(), appUser);
    // Vale só nesta entrada do histórico: depois do replace da volta, a key muda
    // e o caminho guardado deixa de mandar.
    setReturnTo(back && { ...back, key: location.key });
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
        // Primeiro volta à conta do super-admin, ainda na sessão desta aba, e só
        // depois leva a conta para o armazenamento que as outras abas vigiam. Na
        // ordem inversa a conta do cliente passaria por lá e as outras abas
        // entrariam como o cliente por um instante.
        await signInWithCustomToken(auth, data.returnToken);
        try { await setPersistence(auth, await persistenceFor(true)); } catch { /* ignore */ }
      } else {
        // Retorno indisponível (claim já expirado): sai com segurança para o
        // login geral, e não para o da academia que estava sendo vista.
        await leaveTo('/');
        return;
      }
    } catch (e) {
      console.error('stopImpersonation', e);
      await leaveTo('/');
      return;
    }
    setImpersonation(null);
    setExitingImpersonation(false);
  };

  // Sair: login da própria academia para membro, login geral para o super-admin
  // puro e para quem está vendo outra academia (logoutDestination).
  const handleLogout = () => leaveTo(logoutDestination(appUser));

  // Trocar de tela é trocar de endereço. Clicar na tela em que já se está troca
  // a entrada atual em vez de empilhar outra (senão o voltar parece não fazer
  // nada). extra leva a subaba do super-admin: { superTab: 'plans' }.
  const changeTab = (tab, extra) => {
    const href = hrefFor(sessionTenant, tab, extra);
    if (href) navigate(href, { replace: href === location.pathname });
    closeDrawer();
  };
  // Tela de onde a próxima ficha é aberta. Vai no state da navegação (só o id
  // da tela, nunca dado da pessoa) para o menu continuar aceso e o título
  // continuar o da origem. Numa ficha aberta direto não há origem.
  const profileFrom = activeTab === 'ficha' ? null : activeTab;
  // Abrir a ficha empilha o endereço /<academia>/ficha/<id>, e o Voltar da ficha
  // é o voltar do navegador (LeadProfileRoute). A mesma ficha não empilha de
  // novo. Continua memoizado: o KanbanCard é memo e recebe esta função.
  const openProfile = useCallback((leadId) => {
    const href = hrefFor(sessionTenant, 'ficha', { leadId });
    if (!href) return;
    navigate(href, { replace: href === location.pathname, state: profileFrom ? { from: profileFrom } : null });
  }, [navigate, sessionTenant, location.pathname, profileFrom]);
  // Endereço da ficha, para os links que abrem em outra aba (LeadLink).
  const leadHref = useCallback((leadId) => hrefFor(sessionTenant, 'ficha', { leadId }), [sessionTenant]);
  const leadProfileValue = useMemo(() => ({ openProfile, leadHref, from: profileFrom }), [openProfile, leadHref, profileFrom]);
  // Endereço dos itens do menu, do menu da conta e do aviso de mensalidade.
  // Sai da academia da sessão (claim), nunca da barra de endereço.
  const menuHref = (screen, extra) => hrefFor(sessionTenant, screen, extra);
  // Funil em que o cadastro rápido nasce: o do endereço quando a tela de lista
  // traz um, e senão o último funil usado. O "Novo lead" do cabeçalho e o da
  // busca global aparecem em qualquer tela, e fora das telas de lista o
  // endereço não tem funil, então ali vale o guardado, como sempre valeu.
  const entryFunnelId = funnelFromSearch(resolvedTab, location.search, { funis: funnels, funilPadrao: selectedFunnelId });
  // "Configurar agora" da novidade abre Configurações já em Metas e ritmo. A
  // seção vai no state da navegação (SettingsView lê location.state.secao), e
  // o menu, sem state, abre em Equipe e acessos. Com Configurações já aberta
  // nada muda, igual a antes: a seção no endereço é da entrega 2.
  const openGoalSettings = () => {
    const href = menuHref('settings');
    if (href) navigate(href, { state: { secao: 'general' }, replace: href === location.pathname });
    closeDrawer();
  };

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

  // Clientes com contrato "a vencer" por query (E2c) — fonte da categoria
  // Renovação da Meta e do badge âmbar de Clientes. Definido AQUI (antes da Meta)
  // porque dailyGoalPending, metaLeads e clientsAVencer dependem dele. dayKey
  // força o refetch na virada do dia.
  // enabled só com appUser pronto: sem isso o getDocs dispara antes do claim de
  // tenant estar no token (a assinatura onSnapshot já espera appUser) e toma
  // permission-denied na carga fria — e, pós-flip, renewalCandidates é a ÚNICA
  // fonte dos clientes a vencer/em marco da Meta, então a falha derrubaria a
  // Renovação. `clients` (o filtro A_VENCER exato) segue só pro badge âmbar de
  // Clientes; `candidates` é o pool cru (janela mais larga, até o maior marco)
  // que a Meta usa pra avaliar os marcos configuráveis (ver useRenewalClients.js).
  const { clients: renewalClients, candidates: renewalCandidates, loading: renewalLoading } = useRenewalClients({ db, contractThresholdDays, renewalCheckpoints, expiredWindowDays: renewalGraceDays, reloadKey: dayKey, enabled: !!appUser });
  // Base da META (G1d): ativo (prop) ∪ candidatos a renovação (renewalCandidates),
  // dedupe por id (global primeiro). PRÉ-flip o prop já contém os clientes →
  // no-op → números idênticos; PÓS-flip o prop vira só 'ativo' e os
  // renewalCandidates repõem os clientes em qualquer marco. Alimenta a Meta
  // pessoal (DailyGoalView), a badge de pendências (dailyGoalPending) e o
  // Operacional (liveLeads).
  // Terceira fonte: cliente com contato marcado para hoje. Sem ela, aluno com
  // contrato longe de vencer não entra na base e o contato marcado com ele some
  // da Meta em silêncio (a categoria 5 prevê o caso, mas nunca é avaliada
  // porque o lead não chega a ser carregado).
  const { clients: clientsContactToday, loading: contactTodayLoading } = useClientsWithContactToday({ db, reloadKey: dayKey, enabled: !!appUser });
  const metaLeads = useMemo(() => {
    const byId = new Map();
    (leads || []).forEach((l) => byId.set(l.id, l));
    (renewalCandidates || []).forEach((c) => { if (!byId.has(c.id)) byId.set(c.id, c); });
    (clientsContactToday || []).forEach((c) => { if (!byId.has(c.id)) byId.set(c.id, c); });
    return Array.from(byId.values());
  }, [leads, renewalCandidates, clientsContactToday]);

  // Tarefas pendentes HOJE do usuário logado (mesma regra Meta-only da tela).
  const dailyGoalProgress = useMemo(() => {
    if (!appUser?.id) return { total: 0, pending: 0 };
    void dayKey; // recalcula na virada do dia
    const slots = computeDailyGoalSlots(metaLeads, buildInteractionsByLead(interactions), appUser.id, renewalCheckpoints, renewalGraceDays);
    const { totalSlots, doneSlots } = slotTotals(slots);
    return { total: totalSlots, pending: totalSlots - doneSlots };
  }, [metaLeads, interactions, appUser, dayKey, renewalCheckpoints, renewalGraceDays]);
  const dailyGoalPending = dailyGoalProgress.pending;
  const dailyGoalTotal = dailyGoalProgress.total;

  // Dia batido gravado de QUALQUER tela: antes só a Meta Diária aberta gravava,
  // e quem fechava a última tarefa pelo Pipeline ficava sem o dia. Só grava com
  // a base carregada, inclusive os clientes com contato hoje (senão uma
  // pendência ainda não carregada parece zerada). Olha os números e não o
  // objeto, que muda a cada interação nova. O ref guarda o dia já gravado, por
  // pessoa: o doc é o mesmo, e regravar na mesma sessão só gastaria escrita.
  // A decisão (qual chave gravar, ou se grava) é a função pura
  // goalHitKeyToRecord em lib/dailyGoalHistory.js, testada isoladamente.
  const goalHitRecordedRef = useRef(null);
  useEffect(() => {
    if (!db || !appUser?.id) return;
    const ready = listenersActive && !loadingData && !renewalLoading && !contactTodayLoading;
    const key = goalHitKeyToRecord({
      userId: appUser.id,
      dayKey,
      ready,
      total: dailyGoalTotal,
      pending: dailyGoalPending,
      recordedKey: goalHitRecordedRef.current
    });
    if (!key) return;
    goalHitRecordedRef.current = key;
    recordGoalHitDoc(db, appUser);
    // db é o singleton do módulo (lib/firebase.js) — não é dependência válida.
  }, [appUser, listenersActive, loadingData, renewalLoading, contactTodayLoading, dailyGoalTotal, dailyGoalPending, dayKey]);

  // Base do Kanban: a assinatura de leads ATIVOS, igual para todo mundo. Quem
  // recorta por carteira é o filtro de responsável da própria tela, que abre na
  // carteira do consultor e é livre para ele trocar (lib/kanban.js).
  const clientsAVencer = useMemo(() => {
    if (!appUser) return 0;
    const scope = isAdminUser(appUser) ? renewalClients : renewalClients.filter(l => l.consultantId === appUser.id);
    return scope.filter(l => l.lifecycleStage === 'cliente').length;
  }, [renewalClients, appUser]);

  // Mantém o grupo "Leads" aberto quando uma de suas sub-abas está ativa.
  const isLeadsTab = activeTab === 'leads' || activeTab === 'aulas' || activeTab === 'visitas';
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- abre o grupo do menu ao navegar para uma aba de leads (efeito de navegação; o usuário ainda pode recolher).
    if (isLeadsTab) setLeadsMenuOpen(true);
  }, [isLeadsTab]);

  if (isAuthChecking || leaving) {
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
    // O Console não tem endereços nesta entrega: a barra fica em "/", para não
    // mostrar a academia da visualização de onde o super-admin acabou de sair.
    return (
      <>
        {decision.kind === 'redirect' && <RouteRedirect key={location.key} to={decision.to} notice={decision.notice} />}
        <SuperConsole appUser={appUser} onClose={handleLogout} />
      </>
    );
  }

  return (
    <GeneralConfigContext.Provider value={generalConfigValue}>
    <LeadProfileContext.Provider value={leadProfileValue}>
    {/* Endereço que não vale para esta sessão: a tela de destino já está
        desenhada abaixo, e isto só troca o endereço (replace) e mostra o
        aviso. A key nova a cada endereço dá uma troca por endereço barrado. */}
    {decision.kind === 'redirect' && <RouteRedirect key={location.key} to={decision.to} notice={decision.notice} />}
    <div className="flex h-[100dvh] bg-paper-50 dark:bg-neutral-950 text-gray-900 dark:text-white selection:bg-brand-600 selection:text-white overflow-hidden" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, sans-serif' }}>
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity" onClick={closeDrawer} />}

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
          <button className="md:hidden text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white p-1 shrink-0" onClick={closeDrawer}><X className="w-5 h-5" /></button>
        </div>

        {/* Navegação. Cada tela é um link de verdade: Ctrl+clique, botão do
            meio e "Abrir em nova aba" funcionam. onNavigate fecha o menu do
            celular quando o clique troca de tela nesta aba. Os acordeões
            (Visão geral, Leads, Organizações) e o Suporte continuam botão. */}
        <nav className="flex-1 px-3 pt-5 pb-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {!appUser.superAdminOnly && (
            <>
              <div className={`px-2.5 mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500 whitespace-nowrap ${SIDEBAR_EXPANDED_ONLY}`}>Workspace</div>
              <div className="space-y-1">
                <SidebarGroup
                  icon={<LayoutDashboard className="w-[18px] h-[18px]" />}
                  label="Visão geral"
                  active={isDashTab}
                  open={overviewMenuOpen || isDashTab}
                  onToggle={() => setOverviewMenuOpen(o => !o)}
                >
                  <SidebarSubItem label="Operacional" href={menuHref('dashOperacional')} onNavigate={closeDrawer} active={resolvedTab === 'dashOperacional'} />
                  <SidebarSubItem label="CRM" href={menuHref('dashCrm')} onNavigate={closeDrawer} active={resolvedTab === 'dashCrm'} />
                  <SidebarSubItem label="Gerencial" href={menuHref('dashGerencial')} onNavigate={closeDrawer} active={resolvedTab === 'dashGerencial'} />
                </SidebarGroup>
                <SidebarItem icon={<Kanban className="w-[18px] h-[18px]" />} label="Pipeline" href={menuHref('kanban')} onNavigate={closeDrawer} active={activeTab === 'kanban'} />
                <SidebarItem icon={<GraduationCap className="w-[18px] h-[18px]" />} label="Clientes" badge={clientsAVencer > 0 ? clientsAVencer : null} href={menuHref('clientes')} onNavigate={closeDrawer} active={activeTab === 'clientes'} />
                <SidebarItem icon={<Target className="w-[18px] h-[18px]" />} label="Meta diária" badge={dailyGoalPending > 0 ? dailyGoalPending : null} href={menuHref('dailyGoal')} onNavigate={closeDrawer} active={activeTab === 'dailyGoal'} />
                <SidebarGroup
                  icon={<Users className="w-[18px] h-[18px]" />}
                  label="Leads"
                  active={isLeadsTab}
                  open={leadsMenuOpen}
                  onToggle={() => setLeadsMenuOpen(o => !o)}
                >
                  <SidebarSubItem label="Todos os leads" href={menuHref('leads')} onNavigate={closeDrawer} active={activeTab === 'leads'} />
                  <SidebarSubItem label="Aulas experimentais" href={menuHref('aulas')} onNavigate={closeDrawer} active={activeTab === 'aulas'} />
                  <SidebarSubItem label="Visitas" href={menuHref('visitas')} onNavigate={closeDrawer} active={activeTab === 'visitas'} />
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
                  <SidebarItem icon={<Settings className="w-[18px] h-[18px]" />} label="Configurações" href={menuHref('settings')} onNavigate={closeDrawer} active={activeTab === 'settings'} />
                )}
                {appUser?.superAdmin && (
                  <SidebarGroup
                    icon={<Globe className="w-[18px] h-[18px]" />}
                    label="Organizações"
                    active={activeTab === 'superadmin'}
                    open={activeTab === 'superadmin'}
                    onToggle={() => changeTab('superadmin', { superTab: 'overview' })}
                  >
                    <SidebarSubItem label="Visão Geral" href={menuHref('superadmin', { superTab: 'overview' })} onNavigate={closeDrawer} active={activeTab === 'superadmin' && superTab === 'overview'} />
                    <SidebarSubItem label="Clientes" href={menuHref('superadmin', { superTab: 'clients' })} onNavigate={closeDrawer} active={activeTab === 'superadmin' && superTab === 'clients'} />
                    <SidebarSubItem label="Financeiro" href={menuHref('superadmin', { superTab: 'finance' })} onNavigate={closeDrawer} active={activeTab === 'superadmin' && superTab === 'finance'} />
                    <SidebarSubItem label="Planos" href={menuHref('superadmin', { superTab: 'plans' })} onNavigate={closeDrawer} active={activeTab === 'superadmin' && superTab === 'plans'} />
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
            <button className="md:hidden mr-4 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white dark:text-white p-1" onClick={() => setDrawerKey(location.key)}><Menu className="w-6 h-6" /></button>
            <h2 className="font-display text-xl font-bold text-gray-900 dark:text-white capitalize truncate tracking-tight">
              {resolvedTab === 'dashOperacional' && 'Operacional'}
              {resolvedTab === 'dashCrm' && 'CRM'}
              {resolvedTab === 'dashGerencial' && 'Gerencial'}
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
              {activeTab === 'ficha' && 'Ficha'}
            </h2>
          </div>
          {!appUser.superAdminOnly && (
            <GlobalSearch onAddLead={() => setIsAddLeadModalOpen(true)} db={db} />
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
            {/* 🎓 e tema saem do header no celular (o sino ocupa o lugar) e
                viram itens do menu da conta — ver PersonaMenu. */}
            {!appUser.superAdminOnly && (
              <button
                onClick={() => setTutorialsOpen(true)}
                className="hidden sm:block p-2 rounded-xl text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-all active:scale-95 border border-transparent hover:border-gray-200 dark:hover:border-neutral-700"
                title="Central de ajuda"
                aria-label="Central de ajuda"
              >
                <GraduationCap className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="hidden sm:block p-2 rounded-xl text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-all active:scale-95 border border-transparent hover:border-gray-200 dark:hover:border-neutral-700"
              title="Alternar Tema"
            >
              {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-brand-600" />}
            </button>
            {!appUser.superAdminOnly && (
              <NotificationBell
                appUser={appUser}
                leads={leads}
                handoffLeads={handoffLeads}
                seenIds={seenIds}
                lastSeenReferralsAt={lastSeenReferralsAt}
                onMarkAllSeen={markAllSeen}
                onOpenArticle={(id) => { setHelpArticleId(id); setTutorialsOpen(true); }}
              />
            )}
            <PersonaMenu
              appUser={appUser}
              isAdmin={!appUser.superAdminOnly && isAdminUser(appUser)}
              profileHref={menuHref('profile')}
              billingHref={menuHref('billing')}
              onLogout={handleLogout}
              onHelp={!appUser.superAdminOnly ? () => setTutorialsOpen(true) : null}
              onToggleTheme={() => setIsDarkMode(!isDarkMode)}
              isDarkMode={isDarkMode}
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
            billingHref={menuHref('billing')}
          />
        )}

        {loadError && (
          <div className="shrink-0 px-4 md:px-8 py-2 flex items-center justify-center gap-3 text-[12.5px] font-medium border-b bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Falha ao carregar alguns dados.</span>
            <button onClick={() => window.location.reload()} className="font-semibold underline underline-offset-2 hover:opacity-80">Recarregar</button>
          </div>
        )}

        <div ref={contentScrollRef} onScroll={onContentScroll} className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 relative custom-scrollbar">
          {/* Envolve só o conteúdo, não o shell: view que quebra não leva
              junto a barra lateral nem o cabeçalho. A key é a tela mostrada:
              trocar de tela limpa a tela de erro, sem precisar do "Tentar de novo". */}
          <AppErrorBoundary key={screenKey(shown)}>
          {fichaOpen ? (
            // A ficha vem antes do loadingData: a leitura do documento começa na
            // hora, mas ela só aparece pronta depois dos catálogos e dos
            // contratos (dataReady). "Não encontrada" e erro não esperam a carga.
            <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto w-full h-full">
              <LeadProfileRoute
                key={profileLeadId ?? 'sem-id'}
                leadId={profileLeadId}
                tenantId={appUser.tenantId}
                sessionKey={sessionKey}
                dataReady={!loadingData && (contractsTenant === appUser.tenantId || loadError)}
                listenersActive={listenersActive}
                db={db}
                appUser={appUser}
                statuses={statuses}
                tags={tags}
                lossReasons={lossReasons}
                usersList={usersList}
                funnels={funnels}
              />
            </div>
          ) : loadingData ? (
            <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto w-full h-full">
              <ViewSkeleton activeTab={activeTab} />
            </div>
          ) : (
            <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto w-full h-full transition-all duration-300">
              {/* Operacional: a mesma tela para todos os perfis, por mês de
                  competência. Base ao vivo = metaLeads (ativos, clientes a vencer e
                  contato de hoje). As interações vão sem filtro: as regras já deixam
                  qualquer membro ler. */}
              {resolvedTab === 'dashOperacional' && <DashboardOperacionalView appUser={appUser} usersList={usersList} liveLeads={metaLeads} interactions={interactions} db={db} listenersActive={listenersActive} />}
              {/* CRM: o funil de leads por mês, a mesma tela para todos. A mesma
                  base ao vivo do Operacional (metaLeads e as interações do mês),
                  mais funis e etapas para o filtro de funil e a passagem. */}
              {resolvedTab === 'dashCrm' && <DashboardCrmView usersList={usersList} liveLeads={metaLeads} interactions={interactions} db={db} listenersActive={listenersActive} funnels={funnels} statuses={statuses} />}
              {/* Gerencial: o dinheiro vendido no mês, a carteira e o risco. Os contratos
                  já chegam pelo useGeneralConfig, então a tela só busca os leads das
                  vendas do mês, para a origem. */}
              {resolvedTab === 'dashGerencial' && <DashboardGerencialView usersList={usersList} liveLeads={metaLeads} db={db} listenersActive={listenersActive} onNavigate={changeTab} />}
              {activeTab === 'kanban' && <KanbanView leads={leads} interactions={interactions} appUser={appUser} statuses={statuses} usersList={usersList} tags={tags} lossReasons={lossReasons} db={db} funnels={funnels} selectedFunnelId={selectedFunnelId} setSelectedFunnelId={setSelectedFunnelId} />}
              {activeTab === 'clientes' && <ClientsView appUser={appUser} statuses={statuses} usersList={usersList} tags={tags} lossReasons={lossReasons} db={db} funnels={funnels} />}
              {/* Meta Diária (G1d): base = ativo ∪ clientes a vencer (metaLeads),
                  flip-safe. computeDailyGoalSlots filtra por consultor e categoria
                  internamente. interactions segue global (G2). */}
              {activeTab === 'dailyGoal' && <DailyGoalView leads={metaLeads} interactions={interactions} appUser={appUser} statuses={statuses} db={db} tags={tags} lossReasons={lossReasons} usersList={usersList} funnels={funnels} listenersActive={listenersActive} />}
              {activeTab === 'leads' && <LeadsView interactions={interactions} appUser={appUser} sources={sources} statuses={statuses} usersList={usersList} tags={tags} lossReasons={lossReasons} db={db} funnels={funnels} selectedFunnelId={selectedFunnelId} setSelectedFunnelId={setSelectedFunnelId} onAddLeadClick={() => setIsAddLeadModalOpen(true)} />}
              {/* Aulas e Visitas são SOMENTE CONSULTA: não gravam desfecho, então
                  não precisam mais de interactions/statuses (que serviam ao antigo
                  atalho de presença, hoje exclusividade da Meta Diária). */}
              {activeTab === 'aulas' && <AppointmentTrackingView appUser={appUser} tags={tags} lossReasons={lossReasons} db={db} funnels={funnels} usersList={usersList} appointmentType="aula_experimental" />}
              {activeTab === 'visitas' && <AppointmentTrackingView appUser={appUser} tags={tags} lossReasons={lossReasons} db={db} funnels={funnels} usersList={usersList} appointmentType="visita" />}
              {activeTab === 'settings' && isAdminUser(appUser) && <SettingsView initialTab={location.state?.secao ?? 'users'} sources={sources} statuses={statuses} db={db} usersList={usersList} appUser={appUser} tags={tags} lossReasons={lossReasons} dores={dores} funnels={funnels} modalities={modalities} planos={planos} trialClassOptions={trialClassOptions} units={units} metaWeekdays={metaWeekdays} />}
              {activeTab === 'profile' && isAdminUser(appUser) && <div className="max-w-4xl mx-auto"><GymProfileTab /></div>}
              {activeTab === 'billing' && isAdminUser(appUser) && <div className="max-w-4xl mx-auto"><PlanInvoicesTab /></div>}
              {activeTab === 'superadmin' && appUser?.superAdmin && <SuperAdminView tab={superTab} onOpenConsole={() => setConsoleOpen(true)} />}
            </div>
          )}
          </AppErrorBoundary>
        </div>
      </main>

      {/* Quick-add lead, alcançável de qualquer aba pelo botão do menu lateral
          ou pelo botão da LeadsView. O "Ver ficha" abre na hora a ficha do lead
          recém-criado, porque ela lê o documento pelo id. */}
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
          selectedFunnelId={entryFunnelId}
          onCreated={openProfile}
        />
      )}
      {consoleOpen && appUser?.superAdmin && (
        <SuperConsole appUser={appUser} onClose={() => setConsoleOpen(false)} />
      )}
      {ticketModalOpen && <SupportCenterModal appUser={appUser} tickets={tickets} onClose={() => setTicketModalOpen(false)} />}
      <WhatsNewModal appUser={appUser} onConfigure={openGoalSettings} />
      <WalkthroughModal appUser={appUser} />
      <HelpCenterModal
        open={tutorialsOpen}
        initialArticleId={helpArticleId}
        onClose={() => { setTutorialsOpen(false); setHelpArticleId(null); }}
      />
    </div>
    </LeadProfileContext.Provider>
    </GeneralConfigContext.Provider>
  );
}
