import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard,
  Users,
  Search,
  Plus,
  Calendar,
  MessageCircle,
  CheckCircle,
  Clock,
  LogOut,
  Activity,
  Phone,
  User,
  X,
  Shield,
  Lock,
  Mail,
  ScanFace,
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
  BookOpen,
  MessageSquare,
  MoreHorizontal,
  TrendingUp,
  ChevronRight,
  Ban
} from 'lucide-react';

import confetti from 'canvas-confetti';

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
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
  LEADS_PATH,
  INTERACTIONS_PATH,
  USERS_PATH,
  SOURCES_PATH,
  STATUSES_PATH,
  TAGS_PATH,
  LOSS_REASONS_PATH,
  FUNNELS_PATH
} from './lib/firebase.js';
// Pure utilities — see src/lib/{constants,dates,auth,leads,funnels}.js
import { statusGradientMap } from './lib/constants.js';
import { getSafeDate, getSafeDateOrNull, normalizeAppointmentType } from './lib/dates.js';
import { bufferToBase64url, generateRandomBuffer, buildCsatUrl } from './lib/auth.js';
import {
  getLeadAppointmentType,
  getLeadAppointmentDate,
  isLeadConverted,
  getLeadConversionDate,
  getLeadSatisfactionDate,
  isLeadAttended,
  getLeadAttendanceDate,
  getAppointmentOutcomeMeta,
  APPOINTMENT_OUTCOMES,
  DAILY_GOAL_CATEGORIES,
  DAILY_GOAL_CATEGORY_LABEL,
  hasGoalDoneToday,
  isLeadResolvedToday,
  hasActiveInteractionToday,
  isAdminUser,
  canEditLead,
  getLeadOwnershipFields,
  getInteractionSecurityFields
} from './lib/leads.js';
import { getDefaultFunnel, isItemInFunnel, commitOpsInChunks, ALL_FUNNELS_ID, isAllFunnels } from './lib/funnels.js';

// --- HELPERS DE TEMPERATURA DO LEAD ---
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const getLastInteractionDate = (lead, interactions) => {
  if (!lead || !Array.isArray(interactions)) return null;
  const fromList = interactions
    .filter(i => i.leadId === lead.id && i.createdAt instanceof Date)
    .reduce((latest, i) => (!latest || i.createdAt > latest ? i.createdAt : latest), null);
  return fromList;
};

const getDaysSinceLastContact = (lead, interactions) => {
  const last = getLastInteractionDate(lead, interactions) || lead?.createdAt;
  if (!(last instanceof Date) || isNaN(last.getTime())) return null;
  const diffMs = Date.now() - last.getTime();
  return Math.max(0, Math.floor(diffMs / DAY_MS));
};

const isLeadActive = (lead) => {
  return lead && lead.status !== 'Venda' && lead.status !== 'Perda';
};

const isHotLead = (lead, interactions) => {
  if (!isLeadActive(lead)) return false;
  const now = Date.now();

  // Critério 1: lead recém-criado (últimas 6 horas)
  if (lead.createdAt instanceof Date) {
    const ageMs = now - lead.createdAt.getTime();
    if (ageMs >= 0 && ageMs <= 6 * HOUR_MS) return true;
  }

  // Critério 2: interação nas últimas 24h
  const lastInteraction = getLastInteractionDate(lead, interactions);
  if (lastInteraction instanceof Date) {
    const sinceMs = now - lastInteraction.getTime();
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

const isColdLead = (lead, interactions) => {
  if (!isLeadActive(lead)) return false;
  // Hot e cold são mutuamente exclusivos — hot tem prioridade
  if (isHotLead(lead, interactions)) return false;
  const days = getDaysSinceLastContact(lead, interactions);
  return days !== null && days >= 7;
};

function PublicCsatView() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [stage, setStage] = useState('pos_agendamento');
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');

  const token = new URLSearchParams(window.location.search).get('csat');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/csat-load?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Não foi possível carregar a pesquisa.');
          setLoading(false);
          return;
        }

        setLeadName(data.name || '');
        setStage(data.stage || 'pos_agendamento');
        setLoading(false);
      } catch (e) {
        console.error(e);
        setError('Erro ao carregar pesquisa.');
        setLoading(false);
      }
    };

    if (!token) {
      setError('Token ausente.');
      setLoading(false);
      return;
    }

    load();
  }, [token]);

  const handleSubmit = async () => {
    if (!score) {
      toast.warning('Selecione uma nota de 1 a 5.');
      return;
    }

    try {
      const res = await fetch('/api/csat-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, score, comment })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Não foi possível enviar sua resposta.');
        return;
      }

      setSuccess(true);
    } catch (e) {
      console.error(e);
      setError('Erro ao enviar resposta.');
    }
  };

  const stageLabel =
    stage === 'cliente_novo'
      ? 'pós-matrícula'
      : 'pós-agendamento';

  return (
    <div className="min-h-screen bg-[#eaedf2] dark:bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-[2.5rem] p-10 shadow-2xl">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white uppercase tracking-tighter mb-3">
          STRONIX
        </h1>
        <p className="text-gray-500 dark:text-neutral-400 text-sm font-bold uppercase tracking-widest mb-8">
          Pesquisa de satisfação do atendimento
        </p>

        {loading && (
          <p className="text-gray-400 dark:text-neutral-500 font-bold">Carregando...</p>
        )}

        {!loading && error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-sm font-bold">
            {error}
          </div>
        )}

        {!loading && !error && success && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-6 rounded-2xl text-sm font-bold">
            Obrigado! Sua avaliação foi registrada com sucesso.
          </div>
        )}

        {!loading && !error && !success && (
          <div className="space-y-6">
            <div className="bg-[#eaedf2] dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
              <p className="text-gray-900 dark:text-white font-bold text-lg">{leadName}</p>
              <p className="text-gray-400 dark:text-neutral-500 text-xs font-bold uppercase tracking-widest mt-2">
                Avaliação do atendimento comercial ({stageLabel})
              </p>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest block mb-3">
                Sua nota
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setScore(n)}
                    className={`py-4 rounded-xl font-bold text-lg transition-all border ${
                      score === n
                        ? 'bg-blue-600 border-blue-600 text-gray-900 dark:text-white'
                        : 'bg-[#eaedf2] dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-gray-500 dark:text-neutral-400'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest block mb-3">
                Comentário
              </label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                className="w-full bg-[#eaedf2] dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 h-28 text-gray-900 dark:text-white outline-none"
                placeholder="Comentário opcional sobre o atendimento"
              />
            </div>

            <button
              onClick={handleSubmit}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl uppercase tracking-[0.2em] text-[10px]"
            >
              ENVIAR AVALIAÇÃO
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
// ==========================================
// COMPONENTE PRINCIPAL (APP)
// ==========================================
export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}

function AppInner() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [authSetupError, setAuthSetupError] = useState('');
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
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
  
  const [leads, setLeads] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [sources, setSources] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [tags, setTags] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [lossReasons, setLossReasons] = useState([]); // NOVO ESTADO
  const [funnels, setFunnels] = useState([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState(() => {
    try { return localStorage.getItem('crm-selected-funnel') || null; } catch { return null; }
  });
  const [funnelsMigrationStatus, setFunnelsMigrationStatus] = useState('idle');
  const [loadingData, setLoadingData] = useState(true);

  // 1. Inicialização Auth e Persistência de Sessão
  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    setFirebaseUser(currentUser);

    if (!currentUser) {
      setAppUser(null);
      setIsAuthChecking(false);
      return;
    }

    try {
      const usersRef = collection(db, 'artifacts', appId, 'public', 'data', USERS_PATH);

      const byUidQuery = query(usersRef, where('authUid', '==', currentUser.uid));
      const byUidSnap = await getDocs(byUidQuery);

      if (!byUidSnap.empty) {
        const userDoc = byUidSnap.docs[0];
        setAppUser({ id: userDoc.id, ...userDoc.data() });
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
            email: normalizedEmail
          });

          setAuthSetupError('');
          setIsAuthChecking(false);
          return;
        }
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
  setLoadingData(true);

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
  });

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
  });

  const unsubSources = onSnapshot(
    collection(db, 'artifacts', appId, 'public', 'data', SOURCES_PATH),
    (snapshot) => {
      setSources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
  );

  const unsubStatuses = onSnapshot(
    collection(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH),
    (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
      setStatuses(data);
    }
  );

  const unsubTags = onSnapshot(
    collection(db, 'artifacts', appId, 'public', 'data', TAGS_PATH),
    (snapshot) => {
      setTags(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
  );

  const unsubLossReasons = onSnapshot(
    collection(db, 'artifacts', appId, 'public', 'data', LOSS_REASONS_PATH),
    (snapshot) => {
      setLossReasons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
  );

  const unsubFunnels = onSnapshot(
    collection(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH),
    (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
      setFunnels(data);
    }
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
    unsubUsers();
  };
}, [firebaseUser, appUser]);

  // Persiste a seleção de funil no localStorage
  useEffect(() => {
    try {
      if (selectedFunnelId) {
        localStorage.setItem('crm-selected-funnel', selectedFunnelId);
      }
    } catch (e) { /* ignore */ }
  }, [selectedFunnelId]);

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

        // Define seleção inicial se ainda não houver
        setSelectedFunnelId(prev => prev || defaultId);

        setFunnelsMigrationStatus('done');
      } catch (err) {
        console.error('Erro na migração de funis', err);
        setFunnelsMigrationStatus('error');
      }
    })();
  }, [appUser, funnels, loadingData, funnelsMigrationStatus]);

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
const csatToken = new URLSearchParams(window.location.search).get('csat');

if (csatToken) {
  return <PublicCsatView />;
}
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#eaedf2] dark:bg-neutral-950 flex flex-col items-center justify-center p-4">
        <Activity className="w-12 h-12 text-blue-600 mb-4 animate-pulse" />
        <p className="text-gray-400 dark:text-neutral-500 text-sm font-bold uppercase tracking-widest">Carregando Sessão...</p>
      </div>
    );
  }

  if (!appUser) return <LoginScreen setAppUser={setAppUser} firebaseUser={firebaseUser} db={db} authSetupError={authSetupError} />;

  return (
    <div className="flex h-[100dvh] bg-[#eaedf2] dark:bg-neutral-950 text-gray-900 dark:text-white selection:bg-blue-600 selection:text-white overflow-hidden" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, sans-serif' }}>
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 md:w-64 bg-white dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800 flex flex-col transition-transform duration-300 ease-in-out transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        <div className="p-6 flex items-center justify-between md:justify-start gap-3">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-600" />
            <h1 className="text-xl font-bold tracking-wider text-gray-900 dark:text-white uppercase">STRONIX</h1>
          </div>
          <button className="md:hidden text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white dark:text-white p-2" onClick={() => setIsMobileMenuOpen(false)}><X className="w-6 h-6" /></button>
        </div>
        
        <div className="px-6 pb-4 mb-4 border-b border-gray-200 dark:border-neutral-800">
          <p className="text-xs text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-1 font-semibold">{isAdminUser(appUser) ? 'Acesso Master' : 'Consultor'}</p>
          <div className="flex items-center gap-2">
            {isAdminUser(appUser) ? <Shield className="w-4 h-4 text-blue-600 shrink-0" /> : <User className="w-4 h-4 text-blue-500 shrink-0" />}
            <p className="font-semibold truncate text-blue-500">{appUser.name}</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          <SidebarItem icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard Geral" active={activeTab === 'dashboard'} onClick={() => changeTab('dashboard')} />
          <SidebarItem icon={<Kanban className="w-5 h-5" />} label="Quadro Kanban" active={activeTab === 'kanban'} onClick={() => changeTab('kanban')} />
          <SidebarItem icon={<Target className="w-5 h-5" />} label="Meta Diária" active={activeTab === 'dailyGoal'} onClick={() => changeTab('dailyGoal')} />
          <SidebarItem icon={<Users className="w-5 h-5" />} label="Todos os Leads" active={activeTab === 'leads'} onClick={() => changeTab('leads')} />
          {isAdminUser(appUser) && <SidebarItem icon={<Settings className="w-5 h-5" />} label="Configurações" active={activeTab === 'settings'} onClick={() => changeTab('settings')} />}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-neutral-800 space-y-2 pb-8 md:pb-4">
          <BiometricSetupButton appUser={appUser} setAppUser={setAppUser} db={db} />
          <button onClick={handleLogout} className="flex items-center gap-3 text-gray-500 dark:text-neutral-400 hover:text-red-400 bg-gray-50 dark:bg-neutral-950/50 hover:bg-white dark:bg-neutral-900 rounded-xl transition-all w-full px-4 py-3 font-medium text-sm">
            <LogOut className="w-5 h-5" /><span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-16 border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 backdrop-blur-md flex items-center justify-between px-4 md:px-8 z-10 shrink-0">
          <div className="flex items-center">
            <button className="md:hidden mr-4 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white dark:text-white p-1" onClick={() => setIsMobileMenuOpen(true)}><Menu className="w-6 h-6" /></button>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white capitalize truncate">
              {activeTab === 'dashboard' && 'Visão Geral'}
              {activeTab === 'kanban' && 'Pipeline de Vendas'}
              {activeTab === 'dailyGoal' && 'Sua Meta Diária'}
              {activeTab === 'leads' && 'Gestão de Leads'}
              {activeTab === 'settings' && 'Configurações'}
            </h2>
          </div>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)} 
            className="p-2 rounded-xl text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-all active:scale-95 border border-transparent hover:border-gray-200 dark:hover:border-neutral-700"
            title="Alternar Tema"
          >
            {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-blue-600" />}
          </button>
        </header>
        
        <div className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 relative custom-scrollbar">
          {loadingData ? (
            <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto w-full h-full">
              <ViewSkeleton activeTab={activeTab} />
            </div>
          ) : (
            <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto w-full h-full transition-all duration-300">
              {activeTab === 'dashboard' && <DashboardView leads={leads} interactions={interactions} appUser={appUser} statuses={statuses} usersList={usersList} tags={tags} lossReasons={lossReasons} db={db} funnels={funnels} selectedFunnelId={selectedFunnelId} setSelectedFunnelId={setSelectedFunnelId} />}
              {activeTab === 'kanban' && <KanbanView leads={leads} interactions={interactions} appUser={appUser} statuses={statuses} usersList={usersList} tags={tags} lossReasons={lossReasons} db={db} funnels={funnels} selectedFunnelId={selectedFunnelId} setSelectedFunnelId={setSelectedFunnelId} />}
              {activeTab === 'dailyGoal' && <DailyGoalView leads={leads} interactions={interactions} appUser={appUser} statuses={statuses} db={db} tags={tags} lossReasons={lossReasons} usersList={usersList} funnels={funnels} />}
              {activeTab === 'leads' && <LeadsView leads={leads} interactions={interactions} appUser={appUser} sources={sources} statuses={statuses} usersList={usersList} tags={tags} lossReasons={lossReasons} db={db} funnels={funnels} selectedFunnelId={selectedFunnelId} setSelectedFunnelId={setSelectedFunnelId} />}
              {activeTab === 'settings' && isAdminUser(appUser) && <SettingsView sources={sources} statuses={statuses} db={db} usersList={usersList} appUser={appUser} tags={tags} lossReasons={lossReasons} leads={leads} funnels={funnels} />}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ==========================================
// TELA DE LOGIN & RECUPERAÇÃO ADMIN
// ==========================================
function BiometricSetupButton({ appUser, setAppUser, db }) {
  const toast = useToast();
  const [isRegistering, setIsRegistering] = useState(false);
  const handleRegisterBiometrics = async () => {
    if (!window.PublicKeyCredential) { toast.error("Dispositivo não suporta Passkeys."); return; }
    setIsRegistering(true);
    try {
      const publicKey = {
        challenge: generateRandomBuffer(32),
        rp: { name: "STRONIX CRM" },
        user: { id: generateRandomBuffer(16), name: appUser.email, displayName: appUser.name },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
        timeout: 60000,
      };
      const credential = await navigator.credentials.create({ publicKey });
      const credentialIdBase64 = bufferToBase64url(credential.rawId);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', USERS_PATH, appUser.id), { passkeyId: credentialIdBase64 }, { merge: true });
      setAppUser({ ...appUser, passkeyId: credentialIdBase64 });
      toast.success("Face ID ativado!");
    } catch (error) { console.error(error); }
    setIsRegistering(false);
  };
  if (appUser.passkeyId) return <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/10 text-green-400 font-medium w-full text-sm border border-green-500/20"><ScanFace className="w-5 h-5 shrink-0" /><span>Face ID Ativo</span></div>;
  return (
    <button onClick={handleRegisterBiometrics} disabled={isRegistering} className="flex items-center gap-3 text-blue-500 hover:text-white bg-blue-600/10 hover:bg-blue-600/20 border border-blue-600/20 rounded-xl transition-all w-full px-4 py-3 font-medium text-sm disabled:opacity-50">
      <ScanFace className="w-5 h-5 shrink-0" /><span>{isRegistering ? 'Aguardando...' : 'Ativar Face ID'}</span>
    </button>
  );
}

function LoginScreen({ setAppUser, firebaseUser, db, authSetupError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  const handleLogin = async (e) => {
  e.preventDefault();
  setError('');
  setResetMessage('');
  setLoading(true);

  try {
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
  return (
    <div className="min-h-screen bg-[#eaedf2] dark:bg-neutral-950 flex items-center justify-center p-4" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-3xl p-8 shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-blue-400"></div>
        <div className="flex flex-col items-center mb-8">
          <Activity className="w-12 h-12 text-blue-600 mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tighter uppercase">STRONIX</h1>
          <p className="text-gray-500 dark:text-neutral-400 text-sm font-medium uppercase tracking-widest">Painel de Vendas</p>
        </div>
        {authSetupError && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs text-center">{authSetupError}</div>}
        {error && <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm text-center">{error}</div>}
        {resetMessage && <div className="mb-6 p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-sm text-center">{resetMessage}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-neutral-500" /><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-mail" className="w-full bg-[#eaedf2] dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl py-3.5 pl-12 pr-4 text-gray-900 dark:text-white focus:border-blue-600 outline-none font-medium" required /></div>
          <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-neutral-500" /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" className="w-full bg-[#eaedf2] dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl py-3.5 pl-12 pr-4 text-gray-900 dark:text-white focus:border-blue-600 outline-none font-medium" required /></div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/20 uppercase tracking-widest active:scale-95">Entrar</button>
          <button type="button" onClick={handleForgotPassword} className="w-full text-xs text-gray-500 dark:text-neutral-400 hover:text-blue-500 font-semibold uppercase tracking-widest pt-2">Esqueci minha senha</button>
        </form>
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
    ? 'bg-[#eaedf2] dark:bg-neutral-950'
    : 'bg-white dark:bg-neutral-900';
  const iconPos = compact ? 'left-3.5' : 'left-4';
  const chevronPos = compact ? 'right-3' : 'right-4';
  const iconSize = compact ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <div className={`relative group ${className}`}>
      <Kanban className={`absolute ${iconPos} top-1/2 -translate-y-1/2 ${iconSize} text-gray-400 dark:text-neutral-500 group-focus-within:text-blue-600 transition-colors pointer-events-none`} />
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full ${bg} border border-gray-200 dark:border-neutral-800 rounded-2xl ${padX} ${padY} ${textSize} font-semibold text-gray-900 dark:text-white outline-none focus:border-blue-600 transition-all shadow-sm cursor-pointer appearance-none`}
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
      iconClass: 'text-blue-500',
      bar: 'from-blue-500 to-cyan-400'
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
    case 'settings': return <SettingsSkeleton />;
    case 'dashboard':
    default:
      return <DashboardSkeleton />;
  }
}

function SidebarItem({ icon, label, active, onClick }) {
  return <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-blue-600/10 text-blue-600 font-bold' : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:bg-neutral-950 hover:text-gray-800 dark:text-neutral-200'}`}>{icon} <span className="text-sm tracking-tight">{label}</span></button>;
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

function LeadTemperatureBadge({ lead, interactions, compact = false }) {
  if (!lead || !isLeadActive(lead)) return null;
  const hot = isHotLead(lead, interactions);
  const cold = !hot && isColdLead(lead, interactions);
  if (!hot && !cold) return null;

  const size = compact ? 'text-[8px] px-1.5 py-0.5' : 'text-[9px] px-2 py-0.5';

  if (hot) {
    return (
      <span
        title="Lead com atividade recente ou agendamento próximo"
        className={`inline-flex items-center gap-1 rounded-md font-bold uppercase tracking-wider bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm ${size}`}
      >
        <span aria-hidden="true">🔥</span> Hot
      </span>
    );
  }

  return (
    <span
      title="Lead sem interação há 7 dias ou mais"
      className={`inline-flex items-center gap-1 rounded-md font-bold uppercase tracking-wider bg-gradient-to-r from-sky-400 to-blue-300 text-white shadow-sm ${size}`}
    >
      <span aria-hidden="true">❄️</span> Esfriando
    </span>
  );
}

function DaysSinceContactBadge({ lead, interactions }) {
  if (!lead || !isLeadActive(lead)) return null;
  const days = getDaysSinceLastContact(lead, interactions);
  if (days === null) return null;
  if (days < 1) return null; // Sem badge se foi hoje
  const tone = days >= 7
    ? 'text-red-500 dark:text-red-400'
    : days >= 3
    ? 'text-orange-500 dark:text-orange-400'
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
        <select value={reason} onChange={e=>setReason(e.target.value)} className="w-full bg-[#eaedf2] dark:bg-neutral-950 p-4 rounded-xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 focus:border-red-500 text-xs font-bold mb-6 appearance-none">
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

function DashKpiCard({ label, value, delta, accent = 'brand', series, sub }) {
  const up = delta == null ? null : delta >= 0;
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[12px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">{label}</div>
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
    { id: 'today',   label: 'Hoje' },
    { id: 'weekly',  label: 'Semana' },
    { id: 'monthly', label: 'Mês' },
    { id: 'custom',  label: 'Personalizado' }
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

function DashGauge({ value, max = 5 }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const R = 64;
  const C = Math.PI * R;
  const offset = C - C * pct;
  return (
    <div className="relative w-[160px] h-[90px] shrink-0">
      <svg viewBox="0 0 160 90" className="w-full h-full">
        <path d="M16 80 A64 64 0 0 1 144 80" stroke="currentColor" className="text-slate-100 dark:text-white/[0.06]" strokeWidth="12" fill="none" strokeLinecap="round" />
        <path
          d="M16 80 A64 64 0 0 1 144 80"
          stroke="currentColor"
          className="text-brand-600"
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.7,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-0">
        <div className="num text-[28px] font-semibold tracking-tight leading-none">{Number(value || 0).toFixed(1)}</div>
        <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">de {max}</div>
      </div>
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

function DashMiniStat({ label, value, tone = 'slate' }) {
  const tones = {
    emerald: 'text-emerald-700 dark:text-emerald-300',
    amber:   'text-amber-700 dark:text-amber-300',
    rose:    'text-rose-700 dark:text-rose-300',
    slate:   'text-slate-700 dark:text-slate-200'
  };
  return (
    <div className="text-center">
      <div className={`num text-[15px] font-semibold ${tones[tone] || tones.slate}`}>{value}</div>
      <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap">{label}</div>
    </div>
  );
}

function DashCsatDist({ dist, total }) {
  return (
    <div className="space-y-1.5">
      {dist.map((d) => {
        const pct = total ? Math.round((d.n / total) * 100) : 0;
        const color = d.score >= 4 ? 'bg-emerald-500' : d.score === 3 ? 'bg-amber-500' : 'bg-rose-500';
        return (
          <div key={d.score} className="flex items-center gap-2.5 text-[12px] num">
            <span className="w-3 text-slate-500 dark:text-slate-400">{d.score}</span>
            <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-white/[0.05] overflow-hidden">
              <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }}></div>
            </div>
            <span className="w-8 text-right font-semibold text-slate-700 dark:text-slate-200">{d.n}</span>
          </div>
        );
      })}
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
      <td className="py-3 pr-5 pl-3 num text-[13px] text-right font-semibold text-slate-900 dark:text-white">{row.txConversaoGlobal}%</td>
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

function DashCsatTeamGrid({ rows }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {rows.map((r, i) => {
        const pct = r.pctSatisfeitos || 0;
        const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 65 ? 'bg-amber-500' : 'bg-rose-500';
        return (
          <div key={r.name + i} className="rounded-xl border border-slate-200/70 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-3.5">
            <div className="flex items-center gap-2.5">
              <Avatar name={r.name} size={32} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold truncate">{r.name}</div>
                <div className="text-[11.5px] text-slate-500 dark:text-slate-400 num whitespace-nowrap">{r.totalAvaliacoes} avaliações</div>
              </div>
              <div className="text-right shrink-0">
                <div className="num text-[18px] font-semibold leading-none">{r.media}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">média</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.05] overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }}></div>
              </div>
              <span className="num text-[11.5px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{pct}%</span>
            </div>
          </div>
        );
      })}
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

  const satisfactionLeads = useMemo(() => {
  const allowedStages = ['pos_agendamento', 'cliente_novo'];

  return funnelLeads.filter(l => {
    const score = Number(l.satisfactionScore || 0);
    const satisfactionDate = getLeadSatisfactionDate(l);
    const stage = String(l.satisfactionStage || '');

    return (
      score >= 1 &&
      score <= 5 &&
      satisfactionDate &&
      isWithinSelectedRange(satisfactionDate) &&
      allowedStages.includes(stage)
    );
  });
}, [funnelLeads, periodRange]);

  const stats = useMemo(() => {
    const total = capturedLeads.length;

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

    const txAgVisita = total > 0 ? Math.round((agendadosVisita / total) * 100) : 0;
    const txAgAula = total > 0 ? Math.round((agendadosAula / total) * 100) : 0;
    const txConv = total > 0 ? Math.round((convertidos / total) * 100) : 0;

    const txConvVisita = agendadosVisita > 0 ? Math.round((convertidosVisita / agendadosVisita) * 100) : 0;
    const txConvAula = agendadosAula > 0 ? Math.round((convertidosAula / agendadosAula) * 100) : 0;

    return {
      total,
      agendadosVisita,
      agendadosAula,
      convertidos,
      convertidosVisita,
      convertidosAula,
      txAgVisita,
      txAgAula,
      txConv,
      txConvVisita,
      txConvAula
    };
  }, [capturedLeads, scheduledLeads, convertedLeads]);

  const satisfactionStats = useMemo(() => {
  const total = satisfactionLeads.length;

  const somaNotas = satisfactionLeads.reduce(
    (acc, l) => acc + Number(l.satisfactionScore || 0),
    0
  );

  const satisfeitos = satisfactionLeads.filter(
    l => Number(l.satisfactionScore) >= 4
  ).length;

  const insatisfeitos = satisfactionLeads.filter(
    l => Number(l.satisfactionScore) <= 2
  ).length;

  const media = total > 0 ? (somaNotas / total).toFixed(1) : '0.0';
  const pctSatisfeitos = total > 0 ? Math.round((satisfeitos / total) * 100) : 0;
  const pctInsatisfeitos = total > 0 ? Math.round((insatisfeitos / total) * 100) : 0;

  return {
    total,
    media,
    pctSatisfeitos,
    pctInsatisfeitos
  };
}, [satisfactionLeads]);

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
    m.txVisita = m.total > 0 ? Math.round((m.agendadosVisita / m.total) * 100) : 0;
    m.txAula = m.total > 0 ? Math.round((m.agendadosAula / m.total) * 100) : 0;
    m.txConvVisita = m.agendadosVisita > 0 ? Math.round((m.convertidosVisita / m.agendadosVisita) * 100) : 0;
    m.txConvAula = m.agendadosAula > 0 ? Math.round((m.convertidosAula / m.agendadosAula) * 100) : 0;
    m.txConversaoGlobal = m.total > 0 ? Math.round((m.convertidos / m.total) * 100) : 0;
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

  const consultantSatisfactionMetrics = useMemo(() => {
  const metrics = {};

  satisfactionLeads.forEach(l => {
    const cId = l.satisfactionConsultantId || l.consultantId || 'unassigned';

    if (!metrics[cId]) {
      metrics[cId] = {
        name: l.satisfactionConsultantName || l.consultantName || 'Desconhecido',
        totalAvaliacoes: 0,
        somaNotas: 0,
        satisfeitos: 0,
        media: '0.0',
        pctSatisfeitos: 0
      };
    }

    const score = Number(l.satisfactionScore || 0);

    metrics[cId].totalAvaliacoes += 1;
    metrics[cId].somaNotas += score;

    if (score >= 4) metrics[cId].satisfeitos += 1;
  });

  Object.values(metrics).forEach(m => {
    m.media =
      m.totalAvaliacoes > 0
        ? (m.somaNotas / m.totalAvaliacoes).toFixed(1)
        : '0.0';

    m.pctSatisfeitos =
      m.totalAvaliacoes > 0
        ? Math.round((m.satisfeitos / m.totalAvaliacoes) * 100)
        : 0;
  });

  return Object.values(metrics).sort(
    (a, b) => Number(b.media) - Number(a.media) || b.totalAvaliacoes - a.totalAvaliacoes
  );
}, [satisfactionLeads]);

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

  // Compareceram = scheduled leads with isLeadAttended === true (uses outcome OR conversion OR legacy hasAttended).
  const compareceram = useMemo(
    () => scheduledLeads.filter((l) => isLeadAttended(l)).length,
    [scheduledLeads]
  );
  const totalAppt = stats.agendadosVisita + stats.agendadosAula;
  const taxaComp = totalAppt > 0 ? Math.round((compareceram / totalAppt) * 100) : 0;

  // CSAT distribution (5 → 1)
  const csatDist = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    satisfactionLeads.forEach((l) => {
      const score = Math.round(Number(l.satisfactionScore || 0));
      if (counts[score] != null) counts[score]++;
    });
    return [5, 4, 3, 2, 1].map((score) => ({ score, n: counts[score] }));
  }, [satisfactionLeads]);

  const pctNeutros = satisfactionStats.total > 0
    ? Math.max(0, 100 - satisfactionStats.pctSatisfeitos - satisfactionStats.pctInsatisfeitos)
    : 0;

  // 14-day sparkline series for each KPI.
  const sparklines = useMemo(() => {
    const days = 14;
    const series = { leads: [], visitas: [], aulas: [], matriculas: [] };
    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const inDay = (d) => d && d >= dayStart && d <= dayEnd;

      series.leads.push(funnelLeads.filter((l) => inDay(l.createdAt)).length);
      series.visitas.push(funnelLeads.filter((l) => getLeadAppointmentType(l) === 'visita' && inDay(getLeadAppointmentDate(l))).length);
      series.aulas.push(funnelLeads.filter((l) => getLeadAppointmentType(l) === 'aula_experimental' && inDay(getLeadAppointmentDate(l))).length);
      series.matriculas.push(funnelLeads.filter((l) => isLeadConverted(l) && inDay(getLeadConversionDate(l))).length);
    }
    return series;
  }, [funnelLeads]);

  // Delta % vs immediately previous equivalent period.
  const deltas = useMemo(() => {
    if (!periodRange) return { leads: null, visitas: null, aulas: null, matriculas: null };
    const span = periodRange.end - periodRange.start;
    const prevStart = new Date(periodRange.start.getTime() - span - 1);
    const prevEnd = new Date(periodRange.start.getTime() - 1);
    const within = (d) => d && d >= prevStart && d <= prevEnd;

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
  }, [funnelLeads, periodRange, stats]);

  // Activity feed: last 5 interactions in period, mapped to a UI shape.
  const activityFeed = useMemo(() => {
    if (!periodRange) return [];
    const leadById = new Map((leads || []).map((l) => [l.id, l]));
    const myAuthUid = appUser?.authUid || appUser?.id || null;
    return (interactions || [])
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
          if (/observação do cadastro/i.test(txt)) {
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
  }, [interactions, leads, periodRange, appUser]);

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

  // Lead list for "Compareceram" funnel step (also used in funnel modal).
  const compareceramLeads = scheduledLeads.filter((l) => isLeadAttended(l));

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* ---- Hero ---- */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <LayoutDashboard size={13} className="text-brand-600" /> Dashboard
          </div>
          <h2 className="mt-1.5 text-[26px] font-semibold tracking-tight leading-tight">
            {greeting}, {firstName}. <span className="text-slate-500 dark:text-slate-400 font-medium">Aqui está o panorama do período.</span>
          </h2>
          <p className="mt-1 text-[13.5px] text-slate-500 dark:text-slate-400">
            Período: <span className="font-medium text-slate-700 dark:text-slate-200">{periodLabel}</span> · <span className="num">{stats.total}</span> leads · taxa de conversão global <span className="font-medium text-emerald-600 dark:text-emerald-400 num">{stats.txConv}%</span>
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
        />
        <DashKpiCard
          label="Visitas agendadas"
          value={stats.agendadosVisita}
          delta={deltas.visitas}
          accent="amber"
          series={sparklines.visitas}
          sub={`${stats.txAgVisita}% dos leads · ${stats.txConvVisita}% conv.`}
        />
        <DashKpiCard
          label="Aulas experimentais"
          value={stats.agendadosAula}
          delta={deltas.aulas}
          accent="violet"
          series={sparklines.aulas}
          sub={`${stats.txAgAula}% dos leads · ${stats.txConvAula}% conv.`}
        />
        <DashKpiCard
          label="Matrículas"
          value={stats.convertidos}
          delta={deltas.matriculas}
          accent="emerald"
          series={sparklines.matriculas}
          sub={`${stats.txConv}% fechamento geral`}
        />
      </div>

      {/* ---- Secondary KPIs ---- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DashCard padded>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">CSAT médio</div>
              <div className="num text-[32px] font-semibold tracking-tight leading-none mt-1.5">{satisfactionStats.media}</div>
              <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold num">{satisfactionStats.pctSatisfeitos}%</span> satisfeitos · <span className="num">{satisfactionStats.total}</span> avaliações
              </div>
            </div>
            <DashGauge value={Number(satisfactionStats.media) || 0} />
          </div>
        </DashCard>

        <DashCard padded>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Taxa de comparecimento</div>
              <div className="num text-[32px] font-semibold tracking-tight leading-none mt-1.5">{taxaComp}%</div>
              <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                <span className="num font-medium text-slate-700 dark:text-slate-200">{compareceram}</span> compareceram / <span className="num">{totalAppt}</span> agendados
              </div>
            </div>
            <DashRingStat value={taxaComp} accent="teal" />
          </div>
        </DashCard>

        <DashCard padded>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Conversão global</div>
              <div className="num text-[32px] font-semibold tracking-tight leading-none mt-1.5">{stats.txConv}%</div>
              <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                lead → matrícula · <span className="num">{stats.convertidos}</span> de <span className="num">{stats.total}</span>
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
            hint="Conversão por etapa · clique para ver os leads"
            icon={<Filter size={14} />}
          >
            <DashFunnel
              steps={[
                { id: 'leads',  label: 'Leads recebidos', count: stats.total, color: 'brand' },
                { id: 'agend',  label: 'Agendamentos',    count: stats.agendadosVisita + stats.agendadosAula, color: 'amber',  hint: `${stats.agendadosVisita} visitas · ${stats.agendadosAula} aulas exp.` },
                { id: 'comp',   label: 'Compareceram',    count: compareceram, color: 'teal' },
                { id: 'matric', label: 'Matrículas',      count: stats.convertidos, color: 'emerald' }
              ]}
              onStepClick={(s) => {
                if (s.id === 'leads')  setFunnelDetail({ title: 'Leads Recebidos', data: capturedLeads });
                if (s.id === 'agend')  setFunnelDetail({ title: 'Agendamentos',    data: scheduledLeads });
                if (s.id === 'comp')   setFunnelDetail({ title: 'Compareceram',    data: compareceramLeads });
                if (s.id === 'matric') setFunnelDetail({ title: 'Matrículas',      data: convertedLeads });
              }}
            />
          </DashCard>

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

          {isAdminUser(appUser) && (
            <DashCard
              title="CSAT por consultor"
              hint="Média e % de satisfeitos no período"
              icon={<CheckCircle size={14} />}
            >
              {consultantSatisfactionMetrics.length > 0 ? (
                <DashCsatTeamGrid rows={consultantSatisfactionMetrics} />
              ) : (
                <div className="py-8 text-center text-[12px] text-slate-400 italic">Sem avaliações no período</div>
              )}
            </DashCard>
          )}
        </div>

        {/* RIGHT — widgets */}
        <div className="col-span-12 xl:col-span-4 space-y-4">

          <DashCard
            title="Distribuição CSAT"
            hint={`${satisfactionStats.total} avaliações no período`}
            icon={<Activity size={14} />}
          >
            <div className="flex items-start gap-4">
              <DashGauge value={Number(satisfactionStats.media) || 0} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 whitespace-nowrap">Notas (5 → 1)</div>
                <DashCsatDist dist={csatDist} total={satisfactionStats.total} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-white/[0.05]">
              <DashMiniStat label="Satisfeitos" value={`${satisfactionStats.pctSatisfeitos}%`} tone="emerald" />
              <DashMiniStat label="Neutros" value={`${pctNeutros}%`} tone="amber" />
              <DashMiniStat label="Insatisfeitos" value={`${satisfactionStats.pctInsatisfeitos}%`} tone="rose" />
            </div>
          </DashCard>

          <DashCard
            title="Canais de aquisição"
            hint={`${stats.total} leads · top ${Math.min(sourceMetrics.length, 6)}`}
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
                pendingFollowUps.slice(0, 8).map((lead) => (
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
  return <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-6 rounded-[2.5rem] flex items-center justify-between shadow-2xl relative overflow-hidden group hover:border-gray-300 dark:border-neutral-700 transition-all"><div><p className="text-gray-400 dark:text-neutral-500 text-xs font-bold uppercase tracking-widest">{title}</p><p className="text-4xl font-bold text-gray-900 dark:text-white mt-1">{value}</p><p className="text-[10px] text-gray-600 dark:text-neutral-400 font-bold mt-2 uppercase tracking-tighter">{subtitle}</p></div><div className="bg-[#eaedf2] dark:bg-neutral-800 p-5 rounded-2xl border border-gray-200 dark:border-neutral-700 group-hover:scale-110 transition-transform">{icon}</div></div>;
}

function FunnelBar({ label, count, max, color, onClick }) {
  const p = max > 0 ? (count / max) * 100 : 0;
  return <div onClick={onClick} className={onClick ? "cursor-pointer hover:opacity-80 transition-opacity active:scale-95" : ""}><div className="flex justify-between text-xs font-bold uppercase tracking-widest mb-3"><span className="text-gray-500 dark:text-neutral-400">{label}</span><span className="text-gray-900 dark:text-white">{count} ({Math.round(p)}%)</span></div><div className="w-full bg-[#eaedf2] dark:bg-neutral-950 rounded-full h-4 overflow-hidden border border-gray-200 dark:border-neutral-800 shadow-inner"><div className={`h-full rounded-full ${color} transition-all duration-1000 shadow-lg`} style={{ width: `${p}%` }} /></div></div>;
}

function FunnelDetailModal({ detail, onClose, onLeadClick }) {
  if (!detail) return null;
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[150] p-4 animate-fade-in">
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 w-full max-w-lg max-h-[80vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl relative">
        <div className="p-6 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center bg-[#eaedf2] dark:bg-neutral-950">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-widest">
            {detail.title} <span className="text-blue-500">({detail.data.length})</span>
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
                className="bg-[#eaedf2] dark:bg-neutral-950 p-4 rounded-xl border border-gray-200 dark:border-neutral-800 flex flex-col gap-1 shadow-sm cursor-pointer hover:bg-white dark:hover:bg-neutral-900 transition-colors active:scale-95 group"
              >
                <div className="flex justify-between items-start">
                  <span className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">{lead.name}</span>
                  <span className="text-[10px] font-bold px-2 py-1 bg-white dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 rounded-md uppercase border border-gray-200 dark:border-neutral-700">{lead.status}</span>
                </div>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-1">{lead.whatsapp}</span>
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
  const [consultantFilter, setConsultantFilter] = useState('');
  const [lossModalLeadId, setLossModalLeadId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [draggingLeadId, setDraggingLeadId] = useState(null);
  const [draggedOverColumn, setDraggedOverColumn] = useState(null);

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

  const kanbanLeads = useMemo(() => {
    let filtered = (leads || []).filter(l => isItemInFunnel(l, selectedFunnelId, defaultFunnelId));
    if (consultantFilter) {
      filtered = filtered.filter(l => l.consultantId === consultantFilter);
    }
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(l =>
        (l.name && l.name.toLowerCase().includes(lowerSearch)) ||
        (l.whatsapp && l.whatsapp.includes(searchTerm)) ||
        (l.observation && l.observation.toLowerCase().includes(lowerSearch))
      );
    }
    return filtered;
  }, [leads, consultantFilter, searchTerm, selectedFunnelId, defaultFunnelId]);

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

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();

    const leadId = e.dataTransfer.getData('leadId');
    if (!leadId) return;

    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.status === newStatus) return;
    if (!canEditLead(appUser, lead)) {
      toast.warning('Você não tem permissão para mover este lead.');
      return;
    }

    try {
      const payload = { status: newStatus };
      const appointmentType = normalizeAppointmentType(newStatus);

      if (appointmentType) {
        payload.appointmentType = appointmentType;

        if (!lead.appointmentScheduledFor) {
          payload.appointmentScheduledFor = serverTimestamp();
        }
      }

      // Preserva o vínculo com o funil (corrige leads legacy sem funnelId)
      if (selectedFunnelId && !lead.funnelId) {
        payload.funnelId = selectedFunnelId;
      }

      await updateDoc(
        doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, leadId),
        payload
      );

      await addDoc(
        collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH),
        {
          leadId,
          consultantName: appUser.name,
          ...getInteractionSecurityFields(lead, appUser),
          text: `Movido para a etapa [${newStatus}] via Kanban.`,
          type: 'status_change',
          createdAt: serverTimestamp()
        }
      );
    } catch (err) {
      console.error("Erro Kanban:", err);
    }
  };

  const handleWinDrop = async (e) => {
    e.preventDefault();

    const leadId = e.dataTransfer.getData('leadId');
    if (!leadId) return;

    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.status === 'Venda') return;
    if (!canEditLead(appUser, lead)) {
      toast.warning('Você não tem permissão para alterar este lead.');
      return;
    }

    try {
      await updateDoc(
        doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, leadId),
        {
          status: 'Venda',
          nextFollowUp: null,
          isConverted: true,
          convertedAt: serverTimestamp()
        }
      );

      await addDoc(
        collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH),
        {
          leadId,
          consultantName: appUser.name,
          ...getInteractionSecurityFields(lead, appUser),
          text: `Matrícula realizada com sucesso! (Venda)`,
          type: 'status_change',
          createdAt: serverTimestamp()
        }
      );
    } catch (err) {
      console.error("Erro Venda:", err);
    }
  };

  const handleLossDrop = (e) => {
    e.preventDefault();

    const leadId = e.dataTransfer.getData('leadId');
    if (!leadId) return;

    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.status === 'Perda') return;
    if (!canEditLead(appUser, lead)) {
      toast.warning('Você não tem permissão para alterar este lead.');
      return;
    }

    setLossModalLeadId(leadId);
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
          lostAt: serverTimestamp()
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

  const renderLeadCard = (lead) => {
    const isOverdue =
      lead.status !== 'Venda' &&
      lead.status !== 'Perda' &&
      lead.nextFollowUp instanceof Date &&
      !isNaN(lead.nextFollowUp.getTime()) &&
      lead.nextFollowUp < new Date();

    const isDraggingThis = draggingLeadId === lead.id;

    return (
      <div
        key={lead.id}
        data-no-pan="true"
        draggable
        onDragStart={(e) => handleDragStart(e, lead.id)}
        onDragEnd={handleDragEnd}
        onClick={() => setSelectedLead(lead)}
        className={`bg-white dark:bg-neutral-900 border rounded-2xl p-4 cursor-pointer shadow-sm transition-all active:scale-[0.99] ${
          isDraggingThis 
            ? 'opacity-50 scale-105 border-blue-500 animate-wiggle z-50 shadow-2xl' 
            : 'border-gray-200 dark:border-neutral-800 hover:border-blue-600/40'
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className={`font-bold text-sm leading-tight ${isOverdue ? 'text-red-400' : 'text-gray-900 dark:text-white'}`}>
              {lead.name}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-neutral-500 font-bold uppercase mt-1">
              {lead.whatsapp}
            </p>
          </div>
          <GripVertical className="w-4 h-4 text-gray-700 dark:text-neutral-300 shrink-0" />
        </div>

        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <StatusBadge statusName={lead.status} statusesArray={statuses} />
            <LeadTemperatureBadge lead={lead} interactions={interactions} compact />
          </div>
          {lead.consultantName && isAdminUser(appUser) && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-blue-600/60 shrink-0">
              @{lead.consultantName}
            </span>
          )}
        </div>

        {(lead.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {lead.tags.map(tagName => (
              <TagBadge key={tagName} tagName={tagName} tagsArray={tags} />
            ))}
          </div>
        )}

        {lead.nextFollowUp ? (
          <div className={`mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider ${isOverdue ? 'text-red-400' : 'text-yellow-400'}`}>
            {isOverdue ? (
              <AlertCircle className="w-3.5 h-3.5 animate-pulse" />
            ) : (
              <FollowUpIcon type={lead.nextFollowUpType} className="w-3.5 h-3.5" />
            )}
            <span>
              {lead.nextFollowUp.toLocaleDateString('pt-BR')} às{' '}
              {lead.nextFollowUp.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        ) : (
          <div className="mt-3">
            <DaysSinceContactBadge lead={lead} interactions={interactions} />
          </div>
        )}
      </div>
    );
  };

  const pipelineColumns = (statuses || []).filter(s => isItemInFunnel(s, selectedFunnelId, defaultFunnelId));
  const kanbanTitle = currentFunnel?.name || 'Quadro Kanban';
  const hasFunnels = (funnels || []).length > 0;

  return (
    <>
      <div className="h-[calc(100vh-10rem)] flex flex-col animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {kanbanTitle}
              </h3>
              <p className="text-xs font-medium text-gray-500 dark:text-neutral-400 mt-1">
                Arraste os leads entre as etapas
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

          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-center">
            <div className="relative w-full md:w-[320px] group">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500 group-focus-within:text-blue-600 transition-colors pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar leads por nome, telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl pl-12 pr-4 py-3 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:border-blue-600 transition-all shadow-sm placeholder:font-medium placeholder:text-gray-400"
              />
            </div>
            {isAdminUser(appUser) && (
              <div className="relative w-full md:w-[280px] group">
                <Users className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500 group-focus-within:text-blue-600 transition-colors pointer-events-none" />
                <select
                  value={consultantFilter}
                  onChange={(e) => setConsultantFilter(e.target.value)}
                  className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl pl-12 pr-11 py-3 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:border-blue-600 transition-all shadow-sm cursor-pointer appearance-none"
                >
                  <option value="">Todos os consultores</option>
                  {(usersList || []).map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500 pointer-events-none" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
        </div>

        <div
  ref={kanbanScrollRef}
  onMouseDown={handleKanbanMouseDown}
  onMouseMove={handleKanbanMouseMove}
  onMouseUp={stopKanbanPan}
  onMouseLeave={stopKanbanPan}
  className={`flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar select-none ${
    isPanning ? 'cursor-grabbing' : 'cursor-grab'
  }`}
>
  <div className="flex gap-5 min-w-max h-full pb-2">
            {pipelineColumns.map((column) => {
              const columnLeads = getLeadsByStatus(column.name);

              return (
                <div
                  key={column.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (draggedOverColumn !== column.name) setDraggedOverColumn(column.name);
                  }}
                  onDrop={(e) => {
                    setDraggedOverColumn(null);
                    setDraggingLeadId(null);
                    handleDrop(e, column.name);
                  }}
                  className={`w-[320px] rounded-[2rem] flex flex-col transition-colors duration-300 border ${
                    draggedOverColumn === column.name
                      ? 'bg-gray-200 dark:bg-neutral-800 border-blue-500/50'
                      : 'bg-[#f4f5f7] dark:bg-neutral-900 border-gray-200 dark:border-neutral-800'
                  }`}
                >
                  <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StatusBadge statusName={column.name} statusesArray={statuses} />
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 bg-[#eaedf2] dark:bg-neutral-950 px-2.5 py-1 rounded-full">
                      {columnLeads.length}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {columnLeads.length === 0 ? (
                      <div className="h-24 rounded-2xl border border-dashed border-gray-200 dark:border-neutral-800 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-gray-700 dark:text-neutral-300">
                        Solte aqui
                      </div>
                    ) : (
                      columnLeads.map(renderLeadCard)
                    )}
                  </div>
                </div>
              );
            })}

            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedOverColumn !== 'Venda') setDraggedOverColumn('Venda');
              }}
              onDrop={(e) => {
                setDraggedOverColumn(null);
                setDraggingLeadId(null);
                handleWinDrop(e);
              }}
              className={`w-[320px] rounded-[2rem] flex flex-col transition-colors duration-300 border ${
                draggedOverColumn === 'Venda'
                  ? 'bg-green-100 dark:bg-green-900/40 border-green-500'
                  : 'bg-[#f4f5f7] dark:bg-neutral-900 border-green-500/20'
              }`}
            >
              <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-green-400 font-bold uppercase tracking-widest">
                      Venda
                    </p>
                    <p className="text-xs text-gray-400 dark:text-neutral-500 font-bold uppercase">
                      Matrículas concluídas
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full">
                  {getLeadsByStatus('Venda').length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {getLeadsByStatus('Venda').length === 0 ? (
                  <div className="h-24 rounded-2xl border border-dashed border-green-500/20 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-green-500/40">
                    Arraste para vender
                  </div>
                ) : (
                  getLeadsByStatus('Venda').map(renderLeadCard)
                )}
              </div>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedOverColumn !== 'Perda') setDraggedOverColumn('Perda');
              }}
              onDrop={(e) => {
                setDraggedOverColumn(null);
                setDraggingLeadId(null);
                handleLossDrop(e);
              }}
              className={`w-[320px] rounded-[2rem] flex flex-col transition-colors duration-300 border ${
                draggedOverColumn === 'Perda'
                  ? 'bg-red-100 dark:bg-red-900/40 border-red-500'
                  : 'bg-[#f4f5f7] dark:bg-neutral-900 border-red-500/20'
              }`}
            >
              <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center">
                    <ThumbsDown className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest">
                      Perda
                    </p>
                    <p className="text-xs text-gray-400 dark:text-neutral-500 font-bold uppercase">
                      Leads perdidos
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full">
                  {getLeadsByStatus('Perda').length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {getLeadsByStatus('Perda').length === 0 ? (
                  <div className="h-24 rounded-2xl border border-dashed border-red-500/20 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-red-500/40">
                    Arraste para perda
                  </div>
                ) : (
                  getLeadsByStatus('Perda').map(renderLeadCard)
                )}
              </div>
            </div>
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
    </>
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

function LeadsView({ leads, interactions, appUser, sources, statuses, usersList, tags, lossReasons, db, funnels, selectedFunnelId, setSelectedFunnelId }) {
  const toast = useToast();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [statusFilters, setStatusFilters] = useState([]);
  const [consultantFilters, setConsultantFilters] = useState([]);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [hotOnly, setHotOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const defaultFunnelId = useMemo(() => getDefaultFunnel(funnels)?.id || null, [funnels]);
  const hasFunnels = (funnels || []).length > 0;

  // Quando o funil ativo muda, limpamos filtros de status para evitar listar etapas inexistentes
  useEffect(() => {
    setStatusFilters([]);
  }, [selectedFunnelId]);

  const filteredLeads = useMemo(() => {
    return (leads || []).filter(l => {
      const matchFunnel = isItemInFunnel(l, selectedFunnelId, defaultFunnelId);
      const matchSearch = (l.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (l.whatsapp || '').includes(searchTerm);
      const matchStatus = statusFilters.length === 0 || statusFilters.includes(l.status);
      const matchConsultant = consultantFilters.length === 0 || consultantFilters.includes(l.consultantId);
      const isOverdue = l.status !== 'Venda' && l.status !== 'Perda' && l.nextFollowUp && l.nextFollowUp < new Date();
      const matchOverdue = !overdueOnly || isOverdue;
      const matchHot = !hotOnly || isHotLead(l, interactions);
      return matchFunnel && matchSearch && matchStatus && matchOverdue && matchConsultant && matchHot;
    }).sort((a,b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0));
  }, [leads, interactions, searchTerm, statusFilters, overdueOnly, hotOnly, consultantFilters, selectedFunnelId, defaultFunnelId]);

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
    
    const headers = ["Nome", "WhatsApp", "Origem", "Fase do Funil", "Consultor", "Data Cadastro", "Observação", "Motivo Perda"];
    const csvRows = filteredLeads.map(l => {
      return [
        `"${l.name || ''}"`,
        `"${l.whatsapp || ''}"`,
        `"${l.source || ''}"`,
        `"${l.status || ''}"`,
        `"${l.consultantName || ''}"`,
        `"${l.createdAt ? l.createdAt.toLocaleDateString('pt-BR') : ''}"`,
        `"${(l.observation || '').replace(/"/g, '""')}"`,
        `"${(l.lossReason || '').replace(/"/g, '""')}"`
      ].join(',');
    });
    
    const csvContent = [headers.join(','), ...csvRows].join('\n');
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
          <h2 className="mt-1.5 text-[24px] font-semibold tracking-tight leading-tight">
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
          <Btn kind="brand" icon={<Plus size={13} />} onClick={() => setIsAddModalOpen(true)}>Novo lead</Btn>
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
                        <LeadTemperatureBadge lead={l} interactions={interactions} compact />
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
                          <DaysSinceContactBadge lead={l} interactions={interactions} />
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
          <div className="relative w-full max-w-sm bg-[#eaedf2] dark:bg-neutral-950 shadow-[0_0_50px_rgba(0,0,0,0.5)] border-l border-gray-200 dark:border-neutral-800 p-8 flex flex-col h-full animate-slide-in-right">
            
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-wider">Filtros</h3>
                <p className="text-xs font-medium text-gray-500 dark:text-neutral-400 mt-1">Otimize sua visão</p>
              </div>
              <button onClick={()=>setIsFilterOpen(false)} className="p-2 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white dark:text-white bg-white dark:bg-neutral-900 rounded-xl transition-all shadow-xl active:scale-90"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 space-y-8 overflow-y-auto pr-2 custom-scrollbar">
              <section>
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-blue-600 mb-4 flex items-center gap-2"><Clock className="w-3 h-3" /> Situação Operacional</p>
                <div className="grid grid-cols-1 gap-2">
                  <button onClick={()=>setHotOnly(!hotOnly)} className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${hotOnly ? 'bg-orange-500/10 border-orange-500/50 text-orange-500' : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800'}`}>
                    <span className="font-bold text-xs uppercase tracking-widest flex items-center gap-2">🔥 Apenas Hot Leads</span>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 ${hotOnly ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-300 dark:border-neutral-700'}`}>{hotOnly && <Check className="w-3 h-3 font-bold" />}</div>
                  </button>
                  <button onClick={()=>setOverdueOnly(!overdueOnly)} className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${overdueOnly ? 'bg-red-500/10 border-red-500/50 text-red-400' : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800'}`}>
                    <span className="font-bold text-xs uppercase tracking-widest">Em Atraso</span>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 ${overdueOnly ? 'bg-red-500 border-red-500 text-white' : 'border-gray-300 dark:border-neutral-700'}`}>{overdueOnly && <Check className="w-3 h-3 font-bold" />}</div>
                  </button>
                </div>
              </section>

              {isAdminUser(appUser) && (
                <section>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-blue-600 mb-4 flex items-center gap-2"><Users className="w-3 h-3" /> Consultores</p>
                  <div className="grid grid-cols-1 gap-2">
                    {(usersList || []).map(u => (
                      <button key={u.id} onClick={()=>toggleConsultant(u.id)} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${consultantFilters.includes(u.id) ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800'}`}>
                        <span className="text-xs font-semibold">{u.name}</span>
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 ${consultantFilters.includes(u.id) ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 dark:border-neutral-700'}`}>{consultantFilters.includes(u.id) && <Check className="w-3 h-3" />}</div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-blue-600 mb-4 flex items-center gap-2"><Tag className="w-3 h-3" /> Fase do Funil</p>
                <div className="grid grid-cols-1 gap-2">
                  {allStatuses.map(s => (
                    <button key={s} onClick={()=>toggleStatus(s)} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${statusFilters.includes(s) ? 'bg-blue-600/10 border-blue-600/50 text-blue-500' : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800'}`}>
                      <span className="text-xs font-semibold">{s}</span>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 ${statusFilters.includes(s) ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-neutral-700'}`}>{statusFilters.includes(s) && <Check className="w-3 h-3" />}</div>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <div className="pt-6 mt-4 border-t border-gray-200 dark:border-neutral-800 grid grid-cols-2 gap-3">
              <button onClick={()=>{setStatusFilters([]); setOverdueOnly(false); setHotOnly(false); setConsultantFilters([]);}} className="py-3 rounded-xl text-gray-400 dark:text-neutral-500 font-bold hover:bg-white dark:bg-neutral-900 transition-all text-[10px] uppercase tracking-[0.2em]">Limpar</button>
              <button onClick={()=>setIsFilterOpen(false)} className="py-3 rounded-xl bg-blue-600 text-gray-900 dark:text-white font-bold shadow-xl text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all">Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && <AddLeadModal onClose={() => setIsAddModalOpen(false)} appUser={appUser} sources={sources} statuses={statuses} tags={tags} db={db} funnels={funnels} selectedFunnelId={selectedFunnelId} />}
      {selectedLead && <LeadDetailsModal lead={selectedLead} interactions={interactions.filter(i => i.leadId === selectedLead.id).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0))} onClose={() => setSelectedLead(null)} appUser={appUser} statuses={statuses} tags={tags} lossReasons={lossReasons} db={db} funnels={funnels} />}
    </div>
  );
}

// ==========================================
// MODAL DE CADASTRO
// ==========================================
function AddLeadModal({ onClose, appUser, sources, statuses, tags, db, funnels, selectedFunnelId }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const safeFunnels = Array.isArray(funnels) ? funnels : [];
  const initialFunnelId = selectedFunnelId || getDefaultFunnel(safeFunnels)?.id || null;
  const initialStatuses = (statuses || []).filter(s => s.funnelId === initialFunnelId);

  const [formData, setFormData] = useState({
    name: '',
    whatsapp: '',
    source: sources?.[0]?.name || 'Instagram',
    funnelId: initialFunnelId,
    status: initialStatuses?.[0]?.name || 'Novo',
    observation: '',
    tags: []
  });

  const statusesForFunnel = (statuses || []).filter(s => s.funnelId === formData.funnelId);

  const handleFunnelChange = (newFunnelId) => {
    const nextStatuses = (statuses || []).filter(s => s.funnelId === newFunnelId);
    setFormData(prev => ({
      ...prev,
      funnelId: newFunnelId,
      status: nextStatuses[0]?.name || 'Novo'
    }));
  };

const handleSubmit = async (e) => {
  e.preventDefault();
  if (!formData.name || !formData.whatsapp) return;
  if (!formData.funnelId) {
    toast.warning('Selecione um funil para o lead. Crie um em Configurações → Funil Pipeline se não houver opções.');
    return;
  }

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

    onClose();
  } catch (error) {
    console.error(error);
  }

  setLoading(false);
};

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[130] p-4">
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.6)] animate-fade-in">
        <div className="p-8 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center bg-gray-50 dark:bg-neutral-950/50">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tighter">Novo Registro de Lead</h3>
          <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-white dark:text-white rounded-full transition-all active:scale-90"><X className="w-5 h-5"/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-10 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-400 dark:text-neutral-500 mb-2 tracking-widest">Nome do Aluno</label>
              <input type="text" required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full bg-[#eaedf2] dark:bg-neutral-950 p-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 focus:border-blue-600 font-bold transition-all" placeholder="Nome Completo" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-400 dark:text-neutral-500 mb-2 tracking-widest">WhatsApp</label>
              <input type="tel" required value={formData.whatsapp} onChange={e=>setFormData({...formData, whatsapp: e.target.value})} className="w-full bg-[#eaedf2] dark:bg-neutral-950 p-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 focus:border-blue-600 font-bold transition-all" placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-400 dark:text-neutral-500 mb-2 tracking-widest">Origem do Lead</label>
              <select value={formData.source} onChange={e=>setFormData({...formData, source: e.target.value})} className="w-full bg-[#eaedf2] dark:bg-neutral-950 p-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 focus:border-blue-600 font-bold transition-all appearance-none">
                {(sources || []).map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-400 dark:text-neutral-500 mb-2 tracking-widest">Funil</label>
              <select value={formData.funnelId || ''} onChange={e=>handleFunnelChange(e.target.value)} className="w-full bg-[#eaedf2] dark:bg-neutral-950 p-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 focus:border-blue-600 font-bold transition-all appearance-none">
                {safeFunnels.length === 0 && <option value="">Nenhum funil disponível</option>}
                {safeFunnels.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold uppercase text-gray-400 dark:text-neutral-500 mb-2 tracking-widest">Fase Inicial</label>
              <select value={formData.status} onChange={e=>setFormData({...formData, status: e.target.value})} className="w-full bg-[#eaedf2] dark:bg-neutral-950 p-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 focus:border-blue-600 font-bold transition-all appearance-none">
                {statusesForFunnel.length === 0 && <option value="Novo">Novo</option>}
                {statusesForFunnel.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-400 dark:text-neutral-500 mb-2 tracking-widest">Etiquetas</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {(tags || []).map(t => (
                <button type="button" key={t.id} onClick={() => setFormData(prev => ({...prev, tags: prev.tags.includes(t.name) ? prev.tags.filter(x=>x!==t.name) : [...prev.tags, t.name]}))} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${formData.tags.includes(t.name) ? 'bg-blue-600 border-blue-600 text-gray-900 dark:text-white' : 'bg-gray-100 dark:bg-neutral-800 border-gray-300 dark:border-neutral-700 text-gray-400 dark:text-neutral-500'}`}>{t.name}</button>
              ))}
            </div>
          </div>
          <div className="w-full">
            <label className="block text-[10px] font-bold uppercase text-gray-400 dark:text-neutral-500 mb-2 tracking-widest">Observação Adicional</label>
            <textarea value={formData.observation} onChange={e=>setFormData({...formData, observation: e.target.value})} className="w-full bg-[#eaedf2] dark:bg-neutral-950 p-5 rounded-2xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 focus:border-blue-600 font-medium resize-none h-24" placeholder="Algum detalhe importante para o primeiro atendimento?"></textarea>
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <button type="button" onClick={onClose} className="px-8 py-4 rounded-2xl text-gray-400 dark:text-neutral-500 font-bold uppercase text-[10px] hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800 tracking-widest transition-all">Cancelar</button>
            <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-10 py-4 rounded-2xl text-white font-bold uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-blue-600/20 active:scale-95 transition-all">{loading ? 'SALVANDO...' : 'CADASTRAR ALUNO'}</button>
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
  const [enableFollowUp, setEnableFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpType, setFollowUpType] = useState('Mensagem');

  const [lossModalOpen, setLossModalOpen] = useState(false);

  const [csatStage, setCsatStage] = useState(lead.csatRequestedStage || 'pos_agendamento');
  const [sendingCsat, setSendingCsat] = useState(false);

  // Composer tab — drives which form is shown in the activity Composer card.
  const [composerTab, setComposerTab] = useState('note');

  const statusesForFunnel = (statuses || []).filter(s => s.funnelId === funnelId);

  useEffect(() => {
    setEditData({ name: lead.name, whatsapp: lead.whatsapp, source: lead.source, observation: lead.observation || '', tags: lead.tags || [], consultantId: lead.consultantId || '' });
    setStatus(lead.status);
    setFunnelId(lead.funnelId || getDefaultFunnel(safeFunnels)?.id || null);
    setCsatStage(lead.csatRequestedStage || 'pos_agendamento');
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
  
  const handleSendCsat = async () => {
    if (!lead.whatsapp) {
      toast.warning('Este lead não possui WhatsApp cadastrado.');
      return;
    }
    if (csatStage === 'cliente_novo' && lead.status !== 'Venda') {
      const confirmSend = window.confirm('Este lead ainda não está em Venda. Deseja mesmo enviar o CSAT de pós-matrícula?');
      if (!confirmSend) return;
    }
    setSendingCsat(true);
    try {
      const token = bufferToBase64url(generateRandomBuffer(24));
      const csatUrl = buildCsatUrl(token);

      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), {
        csatToken: token,
        csatStatus: 'pending',
        csatRequestedAt: serverTimestamp(),
        csatRequestedStage: csatStage,
        csatLinkSentById: appUser.id,
        csatLinkSentByName: appUser.name
      }, { merge: true });

      const stageLabel = csatStage === 'cliente_novo' ? 'pós-matrícula' : 'pós-agendamento';
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: `Link de CSAT enviado (${stageLabel}).`,
        type: 'note',
        createdAt: serverTimestamp()
      });

      let n = lead.whatsapp.replace(/\D/g, '');
      if (n.length <= 11) n = '55' + n;
      const message = `Olá, ${lead.name}! Aqui é da STRONIX. Queremos avaliar seu atendimento comercial (${stageLabel}). Sua resposta leva menos de 1 minuto:\n\n${csatUrl}`;
      window.open(`https://wa.me/${n}?text=${encodeURIComponent(message)}`, '_blank');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar e enviar o link de CSAT.');
    }
    setSendingCsat(false);
  };

  const handleDelete = async () => {
    if (window.confirm("⚠️ AÇÃO IRREVERSÍVEL: Deseja EXCLUIR este lead permanentemente?")) {
      setLoading(true);
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id));
      onClose();
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
    if (window.confirm("Confirmar matrícula deste lead?")) {
      setLoading(true);
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), {
        status: 'Venda',
        nextFollowUp: null,
        isConverted: true,
        convertedAt: serverTimestamp()
      });      
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), { 
        leadId: lead.id, 
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: `Matrícula realizada com sucesso! (Venda)`, 
        type: 'status_change', 
        createdAt: serverTimestamp() 
      });
      setLoading(false);
      setStatus('Venda');
    }
  };

  const confirmLoss = async (reason) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    setLoading(true);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), {
      status: 'Perda',
      lossReason: reason,
      nextFollowUp: null,
      lostAt: serverTimestamp()
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
    setLoading(false);
    setStatus('Perda');
  };

  const saveInteraction = async () => {
    if (isReadOnly) { toast.warning('Você não tem permissão para registrar interações neste lead.'); return; }
    // Só conta como mudança quando o lead já tinha um funnelId e o usuário escolheu outro
    const funnelChanged = Boolean(lead.funnelId) && funnelId && funnelId !== lead.funnelId;
    if (!note.trim() && status === lead.status && !enableFollowUp && !funnelChanged) return;
    if (enableFollowUp && !followUpDate) {
      toast.warning('Selecione a data e o horário do agendamento no calendário.');
      return;
    }
    setLoading(true);
    try {
      let actionText = '';
      if (funnelChanged) {
        const newFunnelName = safeFunnels.find(f => f.id === funnelId)?.name || 'outro funil';
        actionText += `Lead movido para o funil [${newFunnelName}]. `;
      }
      if (status !== lead.status) actionText += `Fase alterada para [${status}]. `;
      if (note) actionText += `Obs: ${note}. `;
      if (enableFollowUp) {
        actionText += `🔔 Retorno agendado (${followUpType}) p/ ${new Date(followUpDate).toLocaleString('pt-BR')}.`;
      }

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
      if (enableFollowUp) {
        const appointmentDate = new Date(followUpDate);
        const appointmentType = normalizeAppointmentType(followUpType);
        up.nextFollowUp = appointmentDate;
        up.nextFollowUpType = followUpType;
        if (appointmentType) {
          up.appointmentType = appointmentType;
          up.appointmentScheduledFor = appointmentDate;
        }
      }
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), up, { merge: true });

      setNote('');
      setEnableFollowUp(false);
      setFollowUpDate('');
      setFollowUpType('Mensagem');
      setLoading(false);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gravar agendamento.');
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
    // 'note', 'status', 'schedule' all flow through saveInteraction; for
    // 'schedule' the caller has already toggled enableFollowUp=true.
    return saveInteraction();
  };

  const composerSubmitLabel =
    composerTab === 'whatsapp' ? 'Enviar' :
    composerTab === 'status'   ? 'Salvar fase' :
    composerTab === 'schedule' ? 'Agendar' :
    'Salvar';

  const resetComposer = () => {
    setNote('');
    setEnableFollowUp(false);
    setFollowUpDate('');
    setFollowUpType('Mensagem');
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

  const groupedEvents = groupTimeline(interactions || []);

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
                          <h2 className="text-[20px] font-semibold tracking-tight truncate">{lead.name}</h2>
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

                    {/* CSAT */}
                    <div className="px-5 py-4 border-t border-slate-100 dark:border-white/[0.05]">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 inline-flex items-center gap-1.5"><CheckCircle size={12} /> Pesquisa CSAT</div>
                        <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300 whitespace-nowrap">
                          {lead.csatStatus === 'answered' ? 'Respondido' : lead.csatStatus === 'pending' ? 'Aguardando' : 'Não enviado'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                        <button
                          type="button"
                          onClick={() => setCsatStage('pos_agendamento')}
                          className={`h-9 rounded-lg border text-[11.5px] font-semibold transition ${csatStage === 'pos_agendamento' ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-500/10 dark:border-brand-500/30 dark:text-brand-300' : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-white/[0.02] dark:border-white/[0.07] text-slate-600 dark:text-slate-300'}`}
                        >Pós-agendamento</button>
                        <button
                          type="button"
                          onClick={() => setCsatStage('cliente_novo')}
                          className={`h-9 rounded-lg border text-[11.5px] font-semibold transition ${csatStage === 'cliente_novo' ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-500/10 dark:border-brand-500/30 dark:text-brand-300' : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-white/[0.02] dark:border-white/[0.07] text-slate-600 dark:text-slate-300'}`}
                        >Pós-matrícula</button>
                      </div>
                      <Btn kind="secondary" icon={<MessageCircle size={13} />} onClick={handleSendCsat} disabled={sendingCsat} className="w-full">
                        {sendingCsat ? 'Gerando...' : 'Enviar link por WhatsApp'}
                      </Btn>
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
                  <h2 className="mt-1.5 text-[22px] font-semibold tracking-tight leading-tight">
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
                        onClick={() => {
                          setComposerTab(t.id);
                          // When switching to schedule tab, auto-enable follow-up so saveInteraction picks it up
                          if (t.id === 'schedule') setEnableFollowUp(true);
                          else if (composerTab === 'schedule' && t.id !== 'schedule') setEnableFollowUp(false);
                        }}
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
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Field label="Tipo">
                                <div className="grid grid-cols-2 gap-1.5">
                                  {['Mensagem', 'Ligação', 'Visita', 'Aula Experimental'].map(t => (
                                    <button
                                      key={t}
                                      type="button"
                                      onClick={() => setFollowUpType(t)}
                                      className={`h-9 rounded-lg border text-[12px] font-semibold transition ${
                                        followUpType === t
                                          ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-500/10 dark:border-brand-500/30 dark:text-brand-300'
                                          : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-white/[0.02] dark:border-white/[0.07] text-slate-600 dark:text-slate-300'
                                      }`}
                                    >
                                      {t}
                                    </button>
                                  ))}
                                </div>
                              </Field>
                              <Field label="Data e hora">
                                <input
                                  type="datetime-local"
                                  value={followUpDate}
                                  onChange={e => setFollowUpDate(e.target.value)}
                                  className="w-full h-10 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] num px-3 transition"
                                />
                              </Field>
                            </div>
                            <Field label="Anotação (opcional)">
                              <textarea
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder="O que precisa ser tratado no próximo contato?"
                                rows={2}
                                className="w-full rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] p-3 placeholder:text-slate-400 transition resize-none"
                              />
                            </Field>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 pt-1">
                          <div className="flex-1"></div>
                          <Btn kind="soft" onClick={resetComposer} disabled={loading}>Cancelar</Btn>
                          <Btn kind="brand" icon={<Check size={13} />} onClick={handleComposerSubmit} disabled={loading}>
                            {composerSubmitLabel}
                          </Btn>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Timeline */}
                {(interactions || []).length === 0 ? (
                  <div className="py-16 grid place-items-center text-slate-400">
                    <Clock size={22} className="opacity-40 mb-2" />
                    <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Nenhum evento por aqui ainda</p>
                    <p className="text-[12.5px]">Registre a primeira atividade acima.</p>
                  </div>
                ) : (
                  <div className="space-y-6 pb-4">
                    {groupedEvents.map(([label, events]) => (
                      <section key={label}>
                        <header className="mb-2 px-1 py-1.5 sticky top-0 bg-paper-50/95 dark:bg-ink-950/95 backdrop-blur z-[1]">
                          <div className="flex items-center gap-2 pl-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">{label}</span>
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
                              return (
                                <article key={i.id} className="relative pl-12 pr-2 py-2.5 fade-in group">
                                  <div className={`absolute left-0 top-2.5 z-10 w-9 h-9 rounded-full grid place-items-center shrink-0 ring-4 ring-paper-50 dark:ring-ink-950 ${visual.dot}`}>
                                    <Icon className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Avatar name={i.consultantName || 'Sistema'} size={20} />
                                    <span className="text-[13px] font-semibold text-slate-900 dark:text-white whitespace-nowrap">{i.consultantName || 'Sistema'}</span>
                                    {visual.stageName ? (
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
                                  {i.text && (
                                    <div className={`mt-2 rounded-xl p-3 max-w-[640px] border ${visual.card || 'bg-white border-slate-200 dark:bg-white/[0.03] dark:border-white/[0.06]'}`}>
                                      <p className={`text-[13px] leading-relaxed whitespace-pre-wrap ${visual.text || 'text-slate-700 dark:text-slate-200'}`}>{i.text}</p>
                                    </div>
                                  )}
                                </article>
                              );
                            })}
                          </div>
                        </div>
                      </section>
                    ))}

                    {/* Origin marker */}
                    <div className="relative pl-12">
                      <div className="absolute left-[15px] top-0">
                        <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-white/[0.1] ring-4 ring-paper-50 dark:ring-ink-950"></div>
                      </div>
                      <p className="text-[11.5px] text-slate-400 dark:text-slate-500 mt-0.5 whitespace-nowrap">
                        Início da jornada · {lead.createdAt?.toLocaleDateString('pt-BR') || '—'}
                      </p>
                    </div>
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

function SettingsView({ db, statuses, sources, usersList, appUser, tags, lossReasons, leads, funnels }) {
  const [activeTab, setActiveTab] = useState('users');
  const [selectedFunnelInTab, setSelectedFunnelInTab] = useState(null);

  const usersCount = (usersList || []).length;
  const funnelsCount = (funnels || []).length;
  const tagsCount = (tags || []).length;
  const sourcesCount = (sources || []).length;
  const lossCount = (lossReasons || []).length;

  const tabs = [
    { id: 'users',       label: 'Consultores',      hint: 'Time, credenciais e turnos',       icon: <Users size={15} />,         badge: usersCount },
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
        <h2 className="mt-1.5 text-[24px] font-semibold tracking-tight leading-tight">
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: normalizeEmail(form.email),
          password: form.password,
          requesterAuthUid: appUser.authUid
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
      await updateDoc(
        doc(db, 'artifacts', appId, 'public', 'data', USERS_PATH, editingUser.id),
        {
          name: form.name.trim(),
          email: normalizeEmail(form.email),
          authUid: normalizeUid(form.authUid) || null,
          shiftStart: form.shiftStart || null,
          shiftEnd: form.shiftEnd || null,
          password: deleteField()
        }
      );

      if (form.password.trim()) {
        const targetUid = normalizeUid(form.authUid) || editingUser.authUid;
        if (!targetUid) {
          toast.error('Cadastro sem authUid. Não é possível redefinir senha.');
        } else {
          const res = await fetch('/api/admin-set-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              targetAuthUid: targetUid,
              password: form.password,
              requesterAuthUid: appUser?.authUid
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userDocId: target.id,
          targetAuthUid: target.authUid || null,
          requesterAuthUid: appUser.authUid
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
        <Btn
          kind={showAdd || editingUser ? 'soft' : 'brand'}
          icon={showAdd || editingUser ? <X size={13} /> : <Plus size={13} />}
          onClick={handleToggleAddEdit}
        >
          {showAdd || editingUser ? 'Cancelar' : 'Novo consultor'}
        </Btn>
      }
    >
      {(showAdd || editingUser) && (
        <form
          onSubmit={editingUser ? update : add}
          className="bg-white dark:bg-neutral-900/80 p-8 rounded-[2.5rem] border border-blue-100 dark:border-blue-900/30 animate-fade-in mb-10 space-y-8 shadow-2xl relative overflow-hidden"
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
                className="w-full bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest block">
                E-mail de Login
              </label>
              <input
                type="email"
                placeholder="maria@stronix.com"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold shadow-sm"
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
                    className="flex-1 bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold shadow-sm pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, password: generatePassword() })}
                    className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-xl text-[9px] font-bold shadow-md active:scale-95 transition-all uppercase tracking-widest"
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
                  className="flex-1 bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold shadow-sm pr-20"
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, password: generatePassword() })}
                  className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-xl text-[9px] font-bold shadow-md active:scale-95 transition-all uppercase tracking-widest"
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
                className="w-full bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold shadow-sm"
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
                className="w-full bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold shadow-sm"
              />
            </div>
          </div>

          <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-5 mt-4">
            <p className="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
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
              className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/20 active:scale-95 transition-all disabled:opacity-50"
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
            className="group relative bg-white dark:bg-neutral-900 p-6 rounded-[2rem] border border-gray-100 dark:border-neutral-800 hover:border-blue-200 dark:hover:border-blue-900/50 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 flex flex-col"
          >
            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md p-1 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800">
              <button
                onClick={() => openEditForm(u)}
                className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
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
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-full flex items-center justify-center font-bold text-2xl shadow-lg shadow-blue-500/20 mb-3 relative">
                {(u.name || 'C')[0]}
                {u.role === 'admin' && (
                  <div className="absolute -bottom-1 -right-1 bg-white dark:bg-neutral-900 rounded-full p-1 shadow-sm">
                    <Shield className="w-3.5 h-3.5 text-blue-500" />
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
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', FUNNELS_PATH), {
      name: trimmed,
      order: safeFunnels.length,
      isDefault: false,
      createdAt: serverTimestamp()
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

  const save = async (e) => {
    e.preventDefault();
    if (editingId) {
      const oldStatus = statuses.find(s => s.id === editingId);
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
              const leadCount = (leads || []).filter(l => l.status === s.name).length;
              return (
                <div
                  key={s.id}
                  draggable
                  onDragStart={e => e.dataTransfer.setData('idx', i)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => drop(Number(e.dataTransfer.getData('idx')), i)}
                  className="group flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/10 transition cursor-grab active:cursor-grabbing"
                >
                  <span className="w-8 h-8 rounded-lg grid place-items-center text-slate-300 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06] dark:text-slate-600 dark:hover:text-slate-300 transition shrink-0">
                    <GripVertical size={16} />
                  </span>
                  <span className="text-[11px] font-semibold num text-slate-500 dark:text-slate-400 w-6 text-center shrink-0">{i + 1}</span>
                  <ColorBadge color={s.color || 'blue'} name={s.name} />
                  <div className="flex-1"></div>
                  <span className="text-[11.5px] text-slate-500 dark:text-slate-400 num whitespace-nowrap">
                    <span className="num font-semibold text-slate-700 dark:text-slate-200">{leadCount}</span> {leadCount === 1 ? 'lead na etapa' : 'leads na etapa'}
                  </span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                    <IconBtn icon={<Pencil size={14} />} kind="edit" title="Editar" onClick={() => { setName(s.name); setColor(s.color || 'blue'); setEditingId(s.id); }} />
                    <IconBtn icon={<Trash2 size={14} />} kind="danger" title="Excluir" onClick={() => handleDelete(s)} />
                  </div>
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
              <span>Ocorrências no mês</span>
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
    if (!window.confirm("CONFIRMAR MIGRAÇÃO TOTAL?")) return;

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

function ProgressHero({ firstName, greeting, counts, totalSlots, doneSlots, progress, onStartFocus }) {
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
          <h2 className="mt-1.5 text-[26px] font-semibold tracking-tight leading-tight">
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
          <div className="mt-5 flex items-center gap-2 flex-wrap">
            <Btn kind="primary" icon={<Zap size={14} />} onClick={onStartFocus}>Iniciar sessão de foco</Btn>
            <Btn kind="secondary" icon={<Filter size={14} />}>Ver agenda do dia</Btn>
          </div>
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

function KpiCard({ label, value, sub, trend, icon, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.05]',
    emerald: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10',
    brand: 'text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/10'
  };
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap truncate">{label}</span>
        <span className={`w-7 h-7 shrink-0 rounded-lg grid place-items-center ${tones[tone]}`}>{icon}</span>
      </div>
      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="num text-[22px] font-semibold tracking-tight">{value}</span>
        {trend && (
          <span className={`text-[11.5px] font-medium num inline-flex items-center gap-0.5 whitespace-nowrap ${trend.startsWith('+') ? 'text-emerald-600' : 'text-rose-600'}`}>
            <TrendingUp size={11} /> {trend}
          </span>
        )}
      </div>
      {sub && <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap truncate">{sub}</div>}
    </div>
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
      <div className="mt-3 flex items-center gap-1.5">
        <Btn kind="soft" icon={<WhatsappGlyph size={13} />} onClick={() => onWhatsapp && onWhatsapp(task)}>WhatsApp</Btn>
        {!task.appointmentOutcome && (
          <Btn kind="success" icon={<CheckCircle size={13} />} onClick={(e) => onOutcome && onOutcome(task, 'attended', slug, e)}>Compareceu</Btn>
        )}
      </div>
    </div>
  );
}

function StreakCard({ history14, monthHits, monthTarget, streak }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Ritmo do mês</div>
        <Flame size={14} className="text-amber-500" />
      </div>
      <div className="mt-2 flex items-baseline gap-2 whitespace-nowrap">
        <span className="num text-[22px] font-semibold tracking-tight">{monthHits}/{monthTarget}</span>
        <span className="text-[12px] text-slate-500 dark:text-slate-400">metas batidas</span>
      </div>
      <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: 'repeat(14,minmax(0,1fr))' }}>
        {history14.map((day, i) => (
          <div
            key={i}
            className={`h-5 rounded-[3px] ${day.isToday ? 'bg-brand-600/20 ring-1 ring-brand-500' : day.hit ? 'bg-emerald-500/80' : 'bg-slate-100 dark:bg-white/[0.05]'}`}
            title={day.label || ''}
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
  const Icon = m.Icon;
  const outcome = task.appointmentOutcome || null;
  const outcomeMeta = outcome ? getAppointmentOutcomeMeta(outcome) : null;

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

          {note && (
            <p className="text-[12.5px] leading-snug text-slate-600 dark:text-slate-300 mt-2 clip-1">{note}</p>
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
          {isAppt && !outcome ? (
            <>
              <Btn kind="success" icon={<Check size={13} />} onClick={(e) => onOutcome && onOutcome(task, 'attended', slug, e)}>Compareceu</Btn>
              <Btn kind="secondary" icon={<X size={13} />} onClick={(e) => onOutcome && onOutcome(task, 'no_show', slug, e)}>Não veio</Btn>
              <Btn kind="soft" onClick={(e) => { e.stopPropagation(); onReschedule && onReschedule(task, slug); }}>Remarcou</Btn>
              <Btn kind="soft" onClick={(e) => onOutcome && onOutcome(task, 'cancelled', slug, e)}>Cancelou</Btn>
            </>
          ) : isAppt && outcome ? (
            <span className="text-[11px] font-medium text-slate-400 italic">Desfecho registrado</span>
          ) : (
            <Btn kind="primary" icon={<Check size={14} />} onClick={(e) => { e.stopPropagation(); onGoalDone && onGoalDone(task, slug, '', e); }}>Concluir</Btn>
          )}
        </div>
      </div>
    </div>
  );
}

function DoneCard({ lead, onOpen }) {
  const firstDoneSlug = (lead.categorySlugs || []).find(s => lead.categoryStatus?.[s]);
  const outcomeMeta = lead.appointmentOutcome ? getAppointmentOutcomeMeta(lead.appointmentOutcome) : null;
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
      <ChevronRight size={16} className="text-slate-400" />
    </div>
  );
}

// Build a `YYYY-MM-DDTHH:MM` string in LOCAL time for <input type="datetime-local">.
function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function RescheduleModal({ lead, categorySlug, currentDate, currentType, flow = 'manual', onConfirm, onClose }) {
  const isAfterNoShow = flow === 'after_no_show';

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dateValue || submitting) return;
    const newDate = new Date(dateValue);
    if (isNaN(newDate.getTime())) return;
    setSubmitting(true);
    await onConfirm(newDate, note, apptType);
    setSubmitting(false);
  };

  const title = isAfterNoShow
    ? 'Agendar próxima tentativa'
    : `Remarcar ${apptType === 'aula_experimental' ? 'aula experimental' : 'visita'}`;

  const helperText = isAfterNoShow
    ? 'A tarefa de hoje já foi marcada como "Não veio". O lead voltará à Meta Diária na nova data.'
    : 'A tarefa de hoje será concluída e o lead voltará para a sua Meta Diária na nova data.';

  const TypeBtn = ({ value, label }) => {
    const active = apptType === value;
    return (
      <button
        type="button"
        onClick={() => setApptType(value)}
        className={`flex-1 h-9 px-3 rounded-lg text-[12.5px] font-semibold transition border ${
          active
            ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-white/[0.03] dark:text-slate-300 dark:border-white/[0.07] dark:hover:bg-white/[0.06]'
        }`}
      >
        {label}
      </button>
    );
  };

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
                <TypeBtn value="visita" label="Visita" />
                <TypeBtn value="aula_experimental" label="Aula Experimental" />
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
  const focusAnchorRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const processedLeads = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayEnd = new Date();
    todayEnd.setHours(23,59,59,999);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const myLeads = (leads || []).filter(l => l.consultantId === appUser.id);
    const allTargetLeadsMap = new Map();

    // Regra única: tarefa é considerada "feita" SOMENTE se
    //   (a) lead virou Venda/Perda hoje (auto-conclui todas as
    //       categorias do lead — decisão de produto), OU
    //   (b) há uma interaction type='daily_goal_done' criada hoje
    //       com dailyGoalCategory matching aquela categoria.
    // Mover no Kanban, anotar no LeadDetailsModal, mudar fase, etc
    // NÃO marcam a tarefa. O consultor precisa confirmar pela Meta.
    const isCategoryDone = (lead, categorySlug) => {
      if (isLeadResolvedToday(lead, todayStart)) return true;
      return hasGoalDoneToday(lead, categorySlug, interactions, todayStart);
    };

    const addTarget = (lead, categoryLabel, categorySlug) => {
      if (!allTargetLeadsMap.has(lead.id)) {
        allTargetLeadsMap.set(lead.id, {
          ...lead,
          categories: [],
          categorySlugs: [],
          categoryStatus: {},
          hasOtherActivityToday: hasActiveInteractionToday(lead, interactions, todayStart)
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
      if (lead.createdAt && lead.createdAt >= oneDayAgo && lead.status !== 'Venda' && lead.status !== 'Perda') {
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

  const byCategory = (slug) => {
    const total = processedLeads.filter(l => l.categorySlugs.includes(slug));
    const pending = total.filter(l => !isLeadDoneForCategory(l, slug));
    const doneCount = total.length - pending.length;
    return { total, pending, doneCount };
  };
  const c24h = byCategory(DAILY_GOAL_CATEGORIES.NOVO_24H);
  const cAtrasados = byCategory(DAILY_GOAL_CATEGORIES.ATRASADO);
  const cVisitas = byCategory(DAILY_GOAL_CATEGORIES.VISITA_HOJE);
  const cAulas = byCategory(DAILY_GOAL_CATEGORIES.AULA_HOJE);

  const total24h = c24h.total;
  const pending24h = c24h.pending;
  const done24hCount = c24h.doneCount;
  const totalAtrasados = cAtrasados.total;
  const pendingAtrasados = cAtrasados.pending;
  const doneAtrasadosCount = cAtrasados.doneCount;
  const totalVisitas = cVisitas.total;
  const pendingVisitas = cVisitas.pending;
  const doneVisitasCount = cVisitas.doneCount;
  const totalAulas = cAulas.total;
  const pendingAulas = cAulas.pending;
  const doneAulasCount = cAulas.doneCount;

  useEffect(() => {
    if (progress === 100 && prevProgress.current !== 100 && total > 0) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 }, zIndex: 99999 });
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
        nextFollowUp: tomorrow
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
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), {
        appointmentOutcome: outcome,
        appointmentOutcomeAt: serverTimestamp(),
        appointmentOutcomeBy: appUser.authUid || appUser.id || null
      });
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
      toast.success(`${meta.label} registrado para ${lead.name}.`);
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
  const handleReschedule = async (newDate, note, newApptType) => {
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

    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), {
        appointmentScheduledFor: newDate,
        nextFollowUp: newDate, // keep legacy field in sync so the lead doesn't show up as "Atrasado" after rescheduling
        appointmentType: finalApptType,
        nextFollowUpType: finalApptTypeLabel,
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

  const handleStartFocus = () => {
    const el = focusAnchorRef.current?.querySelector('.task-card');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Per-slug pending tasks. A lead with two pending categories renders TWICE — once per slug — preserving main's per-category status model.
  const pendingBySlug = useMemo(() => {
    const groups = {
      [DAILY_GOAL_CATEGORIES.NOVO_24H]: [],
      [DAILY_GOAL_CATEGORIES.VISITA_HOJE]: [],
      [DAILY_GOAL_CATEGORIES.AULA_HOJE]: [],
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
    [DAILY_GOAL_CATEGORIES.ATRASADO]: pendingBySlug[DAILY_GOAL_CATEGORIES.ATRASADO].length
  };
  const totalPendingSlots = Object.values(counts).reduce((a, b) => a + b, 0);

  const yesterdayLeadCount = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const yStart = new Date(todayStart); yStart.setDate(yStart.getDate() - 1);
    return (leads || []).filter(l => l.consultantId === appUser.id && l.createdAt && l.createdAt >= yStart && l.createdAt < todayStart).length;
  }, [leads, appUser]);

  const novoDelta = total24h.length - yesterdayLeadCount;
  const trendLabelNovos = yesterdayLeadCount === 0 && total24h.length === 0
    ? null
    : (novoDelta === 0 ? null : (novoDelta > 0 ? `+${novoDelta} vs. ontem` : `${novoDelta} vs. ontem`));

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

  // V1: histórico vazio (sem coleção stronix_dailyGoalHistory).
  // TODO(stronix_dailyGoalHistory): substituir por leitura da coleção real.
  const history14 = useMemo(() => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      days.push({ hit: false, isToday: i === 0, label: d.toLocaleDateString('pt-BR') });
    }
    return days;
  }, []);

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

  const visibleSlugs = filter === 'all' ? DG_CATEGORY_ORDER : [filter];
  const visibleCount = filter === 'all' ? totalPendingSlots : (counts[filter] || 0);

  return (
    <div className="h-full flex flex-col gap-6 animate-fade-in relative font-sans">
      <ProgressHero
        firstName={firstName}
        greeting={greeting}
        counts={counts}
        totalSlots={totalSlots}
        doneSlots={doneSlots}
        progress={progress}
        onStartFocus={handleStartFocus}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Novos leads (24h)"
          value={total24h.length}
          sub={pending24h.length > 0 ? `${pending24h.length} sem contato` : 'todos atendidos'}
          icon={<Zap size={15} />}
          tone="brand"
          trend={trendLabelNovos}
        />
        <KpiCard
          label="Compromissos hoje"
          value={totalVisitas.length + totalAulas.length}
          sub={countdownLabel ? `próximo ${countdownLabel}` : '—'}
          icon={<Calendar size={15} />}
        />
        <KpiCard
          label="Contatos do dia"
          value={counts[DAILY_GOAL_CATEGORIES.CONTATO_HOJE]}
          sub={counts[DAILY_GOAL_CATEGORIES.CONTATO_HOJE] > 0 ? 'follow-up agendado' : 'todos feitos'}
          icon={<MessageSquare size={15} />}
        />
        <KpiCard
          label="Atrasados"
          value={pendingAtrasados.length}
          sub={pendingAtrasados.length > 0 ? 'recuperar hoje' : 'sem pendência'}
          icon={<AlertCircle size={15} />}
          tone={pendingAtrasados.length > 1 ? 'slate' : 'emerald'}
        />
      </div>

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-[400px]">
        {/* LEFT — A FAZER */}
        <section className="col-span-12 lg:col-span-8" ref={focusAnchorRef}>
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-card overflow-hidden h-full flex flex-col">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-white/[0.05]">
              <div className="flex items-center gap-2.5">
                <h2 className="text-[15px] font-semibold">A fazer hoje</h2>
                <span className="num text-[11.5px] px-1.5 h-[20px] rounded-md grid place-items-center bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">{visibleCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <IconBtn icon={<Filter size={15} />} title="Filtros avançados" />
              </div>
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
            </div>

            <div className="p-5 space-y-7 flex-1 overflow-y-auto thin-scroll">
              {totalSlots === 0 ? (
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
          <StreakCard history14={history14} monthHits={0} monthTarget={22} streak={0} />

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
                done.map(lead => <DoneCard key={lead.id} lead={lead} onOpen={setSelectedLead} />)
              )}
            </div>
          </div>
        </section>
      </div>

      <footer className="pt-1 pb-2 text-center text-[11.5px] text-slate-400">
        Atualizado agora · {todayLabel} · Stronix
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