import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  Info
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import confetti from 'canvas-confetti';

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from 'firebase/auth';

import {
  getFirestore,
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

const firebaseConfig = {
  apiKey: "AIzaSyC641_wb--R8B4SklAIQjXWSLp8egz9U-E",
  authDomain: "crm-stronix.firebaseapp.com",
  projectId: "crm-stronix",
  storageBucket: "crm-stronix.firebasestorage.app",
  messagingSenderId: "963219155705",
  appId: "1:963219155705:web:42aa0decf0d942dc779028",
  measurementId: "G-4XDH5H2VY0"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "stronix-crm-app"; 

const LEADS_PATH = 'stronix_leads';
const INTERACTIONS_PATH = 'stronix_interactions';
const USERS_PATH = 'stronix_users';
const SOURCES_PATH = 'stronix_sources';
const STATUSES_PATH = 'stronix_statuses';
const TAGS_PATH = 'stronix_tags';
const LOSS_REASONS_PATH = 'stronix_loss_reasons'; // NOVO CAMINHO
const FUNNELS_PATH = 'stronix_funnels';

// --- BLINDAGEM DE DADOS (EVITA TELA BRANCA E ERROS DE DATA) ---
const getSafeDate = (val) => {
  if (!val) return new Date();
  if (typeof val.toDate === 'function') return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
};

const getSafeDateOrNull = (val) => {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const normalizeAppointmentType = (value) => {
  if (!value) return null;

  const raw = String(value).trim().toLowerCase();

  if (raw.includes('aula')) return 'aula_experimental';
  if (raw.includes('visita')) return 'visita';

  return null;
};

const getLeadAppointmentType = (lead) => {
  return lead?.appointmentType || normalizeAppointmentType(lead?.nextFollowUpType);
};

const getLeadAppointmentDate = (lead) => {
  return (
    getSafeDateOrNull(lead?.appointmentScheduledFor) ||
    (getLeadAppointmentType(lead) ? getSafeDateOrNull(lead?.nextFollowUp) : null)
  );
};

const isLeadConverted = (lead) => {
  return Boolean(
    lead?.isConverted ||
    lead?.status === 'Venda' ||
    String(lead?.status || '').toLowerCase().includes('convertid') ||
    String(lead?.status || '').toLowerCase().includes('matricul')
  );
};

const getLeadConversionDate = (lead) => {
  return getSafeDateOrNull(lead?.convertedAt) || getSafeDateOrNull(lead?.createdAt);
};

const getLeadSatisfactionDate = (lead) => {
  return getSafeDateOrNull(lead?.satisfactionAt);
};

// --- MAPA DE CORES GRADIENTES (GLOBAL) ---
const statusGradientMap = {
  blue: "from-blue-600 to-cyan-500 text-white",
  green: "from-green-600 to-emerald-400 text-white",
  yellow: "from-yellow-500 to-amber-400 text-gray-900",
  red: "from-red-600 to-pink-500 text-white",
  purple: "from-purple-600 to-indigo-500 text-white",
  orange: "from-orange-500 to-amber-500 text-white",
  gray: "from-neutral-600 to-neutral-400 text-white",
  teal: "from-teal-600 to-cyan-600 text-white",
  pink: "from-pink-500 to-rose-400 text-white",
  indigo: "from-indigo-600 to-blue-600 text-white",
  lime: "from-lime-500 to-green-500 text-gray-900"
};

// --- FUNÇÕES DE BIOMETRIA ---
const bufferToBase64url = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (let char of bytes) str += String.fromCharCode(char);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};
const generateRandomBuffer = (length) => {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return array;
};

const buildCsatUrl = (token) => {
  return `${window.location.origin}/?csat=${encodeURIComponent(token)}`;
};

const isAdminUser = (user) => user?.role === 'admin';

const canEditLead = (user, lead) =>
  isAdminUser(user) || (Boolean(lead?.consultantAuthUid) && lead.consultantAuthUid === user?.authUid);

const getLeadOwnershipFields = (user) => ({
  consultantId: user?.id || null,
  consultantName: user?.name || null,
  consultantAuthUid: user?.authUid || null
});

const getInteractionSecurityFields = (lead, user) => ({
  leadConsultantId: lead?.consultantId || user?.id || null,
  leadConsultantAuthUid: lead?.consultantAuthUid || user?.authUid || null
});

// --- HELPERS DE FUNIS ---
const getDefaultFunnel = (funnels) => {
  if (!Array.isArray(funnels) || funnels.length === 0) return null;
  return funnels.find(f => f.isDefault === true) || funnels[0] || null;
};

const isItemInFunnel = (item, selectedFunnelId, defaultFunnelId) => {
  if (!selectedFunnelId) return true;
  if (item?.funnelId === selectedFunnelId) return true;
  if (!item?.funnelId && selectedFunnelId === defaultFunnelId) return true;
  return false;
};

const commitOpsInChunks = async (dbInstance, ops, chunkSize = 400) => {
  for (let i = 0; i < ops.length; i += chunkSize) {
    const chunk = ops.slice(i, i + chunkSize);
    const batch = writeBatch(dbInstance);
    chunk.forEach(op => {
      batch.update(op.ref, op.data);
    });
    await batch.commit();
  }
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
        nextFollowUp: getSafeDateOrNull(data.nextFollowUp)
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

  // Garante que selectedFunnelId é sempre válido (cai para o default se sumir)
  useEffect(() => {
    if (!funnels || funnels.length === 0) return;
    if (!selectedFunnelId || !funnels.find(f => f.id === selectedFunnelId)) {
      const fallback = getDefaultFunnel(funnels);
      if (fallback) setSelectedFunnelId(fallback.id);
    }
  }, [funnels, selectedFunnelId]);

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
             <div className="flex h-full items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
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
function FunnelSelector({ funnels, value, onChange, compact = false, variant = 'standalone', className = '' }) {
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        {hasFunnels && (
          <FunnelSelector
            funnels={funnels}
            value={selectedFunnelId}
            onChange={setSelectedFunnelId}
            className="w-full sm:w-[260px]"
          />
        )}
        <div className="flex bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-1 rounded-xl shadow-2xl">
          {[
            { id: 'today', label: 'Hoje' },
            { id: 'weekly', label: 'Semana' },
            { id: 'monthly', label: 'Mês' },
            { id: 'custom', label: 'Período' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriodPreset(p.id)}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                periodPreset === p.id
                  ? 'bg-gray-100 dark:bg-neutral-800 text-blue-500 shadow-xl'
                  : 'text-gray-400 dark:text-neutral-500'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {periodPreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-3 rounded-xl shadow-2xl">
            <input
              type="date"
              value={customStartDate}
              onChange={e => setCustomStartDate(e.target.value)}
              className="bg-[#eaedf2] dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white outline-none"
            />
            <span className="text-gray-400 dark:text-neutral-500 text-sm font-bold">até</span>
            <input
              type="date"
              value={customEndDate}
              onChange={e => setCustomEndDate(e.target.value)}
              className="bg-[#eaedf2] dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white outline-none"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Leads Captados"
          value={stats.total}
          subtitle="No período"
          icon={<Users className="w-8 h-8 text-blue-500" />}
        />

        <StatCard
          title="Visitas Agendadas"
          value={stats.agendadosVisita}
          subtitle={`${stats.txAgVisita}% dos leads | ${stats.txConvVisita}% conv.`}
          icon={<Users className="w-8 h-8 text-yellow-500" />}
        />

        <StatCard
          title="Aulas Exp. Agendadas"
          value={stats.agendadosAula}
          subtitle={`${stats.txAgAula}% dos leads | ${stats.txConvAula}% conv.`}
          icon={<Calendar className="w-8 h-8 text-purple-500" />}
        />

        <StatCard
          title="Matrículas"
          value={stats.convertidos}
          subtitle={`${stats.txConv}% fechamento geral`}
          icon={<Trophy className="w-8 h-8 text-green-500" />}
        />
      </div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  <StatCard
    title="CSAT Médio"
    value={satisfactionStats.media}
    subtitle={`${satisfactionStats.total} avaliações`}
    icon={<CheckCircle className="w-8 h-8 text-blue-500" />}
  />

  <StatCard
    title="% Satisfeitos"
    value={`${satisfactionStats.pctSatisfeitos}%`}
    subtitle="Notas 4 e 5"
    icon={<CheckCircle className="w-8 h-8 text-green-500" />}
  />

  <StatCard
    title="% Insatisfeitos"
    value={`${satisfactionStats.pctInsatisfeitos}%`}
    subtitle="Notas 1 e 2"
    icon={<AlertCircle className="w-8 h-8 text-red-500" />}
  />
</div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-[2.5rem] p-8 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-8 uppercase tracking-widest">
              {currentFunnel?.name ? `Funil ${currentFunnel.name}` : 'Funil Comercial'}
            </h3>

            <div className="space-y-8">
              <FunnelBar
                label="Leads Recebidos"
                count={stats.total}
                max={stats.total}
                color="bg-blue-500"
                onClick={() => setFunnelDetail({ title: 'Leads Recebidos', data: capturedLeads })}
              />
              <FunnelBar
                label="Agendamentos (Visita)"
                count={stats.agendadosVisita}
                max={stats.total}
                color="bg-yellow-500"
                onClick={() => setFunnelDetail({ title: 'Visitas Agendadas', data: scheduledLeads.filter(l => getLeadAppointmentType(l) === 'Visita') })}
              />
              <FunnelBar
                label="Agendamentos (Aula Exp.)"
                count={stats.agendadosAula}
                max={stats.total}
                color="bg-purple-500"
                onClick={() => setFunnelDetail({ title: 'Aulas Exp. Agendadas', data: scheduledLeads.filter(l => getLeadAppointmentType(l) === 'Aula Experimental') })}
              />
              <FunnelBar
                label="Matrículas"
                count={stats.convertidos}
                max={stats.total}
                color="bg-green-500"
                onClick={() => setFunnelDetail({ title: 'Matrículas', data: convertedLeads })}
              />
            </div>
          </div>

          {isAdminUser(appUser) && (
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-[2.5rem] p-8 shadow-2xl">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3 uppercase tracking-widest">
                <BarChart3 className="w-6 h-6 text-blue-500" />
                Relatório de Desempenho
              </h3>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-neutral-800 text-gray-400 dark:text-neutral-500 text-xs font-semibold">
                      <th className="py-4 px-4">Consultor</th>
                      <th className="py-4 px-4 text-center">Leads</th>
<th className="py-4 px-4 text-center">Visitas</th>
<th className="py-4 px-4 text-center">Aulas Exp.</th>
<th className="py-4 px-4 text-center">Matrículas</th>
<th className="py-4 px-4 text-center">Conv. Visita</th>
<th className="py-4 px-4 text-center">Conv. Aula</th>
<th className="py-4 px-4 text-right">Tx. Conv. Global</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMetrics.map((m, i) => (
                      <tr key={i} className="border-b border-gray-200 dark:border-neutral-800/50 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800/30 transition-all">
                        <td className="py-4 px-4 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          {i === 0 && m.convertidos > 0 && <span className="text-yellow-500">🏆</span>}
                          {m.name}
                        </td>
<td className="py-4 px-4 text-center text-gray-500 dark:text-neutral-400 font-bold">{m.total}</td>

<td className="py-4 px-4 text-center">
  <div className="flex flex-col items-center leading-tight">
    <span className="text-yellow-400 font-bold">{m.agendadosVisita}</span>
    <span className="text-[10px] text-gray-400 dark:text-neutral-500 font-bold uppercase tracking-widest">
      {m.txVisita}%
    </span>
  </div>
</td>

<td className="py-4 px-4 text-center">
  <div className="flex flex-col items-center leading-tight">
    <span className="text-purple-400 font-bold">{m.agendadosAula}</span>
    <span className="text-[10px] text-gray-400 dark:text-neutral-500 font-bold uppercase tracking-widest">
      {m.txAula}%
    </span>
  </div>
</td>

<td className="py-4 px-4 text-center text-green-400 font-bold">
  {m.convertidos}
</td>

<td className="py-4 px-4 text-center">
  <div className="flex flex-col items-center leading-tight">
    <span className="text-yellow-300 font-bold">{m.convertidosVisita}</span>
    <span className="text-[10px] text-gray-400 dark:text-neutral-500 font-bold uppercase tracking-widest">
      {m.txConvVisita}%
    </span>
  </div>
</td>

<td className="py-4 px-4 text-center">
  <div className="flex flex-col items-center leading-tight">
    <span className="text-purple-300 font-bold">{m.convertidosAula}</span>
    <span className="text-[10px] text-gray-400 dark:text-neutral-500 font-bold uppercase tracking-widest">
      {m.txConvAula}%
    </span>
  </div>
</td>

<td className="py-4 px-4 text-right text-gray-900 dark:text-white font-bold">
  {m.txConversaoGlobal}%
</td>
                      </tr>
                    ))}

                    {teamMetrics.length === 0 && (
                      <tr>
<td colSpan="8" className="py-6 text-center text-gray-400 dark:text-neutral-500 text-xs font-bold uppercase tracking-widest">                          Sem dados no período
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {isAdminUser(appUser) && (
  <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-[2.5rem] p-8 shadow-2xl">
    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3 uppercase tracking-widest">
      <CheckCircle className="w-6 h-6 text-blue-500" />
      CSAT por Consultor
    </h3>

    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-left border-collapse min-w-[700px]">
        <thead>
          <tr className="border-b border-gray-200 dark:border-neutral-800 text-gray-400 dark:text-neutral-500 text-xs font-semibold">
            <th className="py-4 px-4">Consultor</th>
            <th className="py-4 px-4 text-center">Avaliações</th>
            <th className="py-4 px-4 text-center">CSAT Médio</th>
            <th className="py-4 px-4 text-right">% Satisfeitos</th>
          </tr>
        </thead>
        <tbody>
          {consultantSatisfactionMetrics.map((m, i) => (
            <tr
              key={i}
              className="border-b border-gray-200 dark:border-neutral-800/50 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800/30 transition-all"
            >
              <td className="py-4 px-4 font-bold text-gray-900 dark:text-white">{m.name}</td>
              <td className="py-4 px-4 text-center text-gray-500 dark:text-neutral-400 font-bold">
                {m.totalAvaliacoes}
              </td>
              <td className="py-4 px-4 text-center text-blue-400 font-bold">
                {m.media}
              </td>
              <td className="py-4 px-4 text-right text-gray-900 dark:text-white font-bold">
                {m.pctSatisfeitos}%
              </td>
            </tr>
          ))}

          {consultantSatisfactionMetrics.length === 0 && (
            <tr>
              <td
                colSpan="4"
                className="py-6 text-center text-gray-400 dark:text-neutral-500 text-xs font-bold uppercase tracking-widest"
              >
                Sem avaliações no período
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
)}
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-[2.5rem] p-8 flex flex-col max-h-[450px] shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-widest">
                <Bell className="w-5 h-5 text-blue-600" />
                Tarefas
              </h3>
              <span className="bg-blue-600/10 text-blue-600 text-xs px-2 py-1 rounded-full font-bold">
                {pendingFollowUps.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
              {pendingFollowUps.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-neutral-500 gap-2">
                  <CheckCircle className="w-10 h-10 opacity-20" />
                  <p className="text-sm font-medium">Tudo em dia!</p>
                </div>
              ) : (
                pendingFollowUps.map(lead => {
                  const isOverdue = lead.nextFollowUp < new Date();

                  return (
                    <div key={lead.id} className="bg-[#eaedf2] dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 p-4 rounded-2xl flex justify-between items-start relative overflow-hidden group">
                      <div className={`absolute top-0 left-0 w-1 h-full ${isOverdue ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                      <div className="pl-1">
                        <p className="font-bold text-sm text-gray-800 dark:text-neutral-200">{lead.name}</p>
                        <p className="text-[10px] text-gray-400 dark:text-neutral-500 font-bold uppercase">{lead.whatsapp}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-[10px] font-bold uppercase ${isOverdue ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`}>
                          {isOverdue ? 'Atrasado' : 'Agendado'}
                        </p>
                        <div className="text-[10px] text-gray-400 dark:text-neutral-500 mt-1 flex items-center justify-end gap-1 font-bold">
                          <FollowUpIcon type={lead.nextFollowUpType} className="w-3 h-3" />
                          <span>
                            {lead.nextFollowUp.toLocaleDateString('pt-BR')} às{' '}
                            {lead.nextFollowUp.toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-[2.5rem] p-8 shadow-2xl">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-6 uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              Canais de Aquisição
            </h3>

            <div className="space-y-5">
              {sourceMetrics.map((s, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span className="text-gray-500 dark:text-neutral-400">{s.name}</span>
                    <span className="text-gray-900 dark:text-white">{s.count}</span>
                  </div>
                  <div className="w-full bg-[#eaedf2] dark:bg-neutral-950 rounded-full h-2.5 overflow-hidden border border-gray-200 dark:border-neutral-800">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-amber-400 rounded-full"
                      style={{ width: `${stats.total > 0 ? (s.count / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}

              {sourceMetrics.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-neutral-500 font-bold italic py-4">
                  Nenhum dado captado.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      
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
          <StatusBadge statusName={lead.status} statusesArray={statuses} />
          {lead.consultantName && isAdminUser(appUser) && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-blue-600/60">
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

        {lead.nextFollowUp && (
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
function LeadsView({ leads, interactions, appUser, sources, statuses, usersList, tags, lossReasons, db, funnels, selectedFunnelId, setSelectedFunnelId }) {
  const toast = useToast();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [statusFilters, setStatusFilters] = useState([]);
  const [consultantFilters, setConsultantFilters] = useState([]);
  const [overdueOnly, setOverdueOnly] = useState(false);
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
      return matchFunnel && matchSearch && matchStatus && matchOverdue && matchConsultant;
    }).sort((a,b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0));
  }, [leads, searchTerm, statusFilters, overdueOnly, consultantFilters, selectedFunnelId, defaultFunnelId]);

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

  return (
    <div className="h-full flex flex-col space-y-6 animate-fade-in relative">
      <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-5 rounded-[2rem] shadow-xl">
        {hasFunnels && (
          <FunnelSelector
            funnels={funnels}
            value={selectedFunnelId}
            onChange={setSelectedFunnelId}
            variant="soft"
            className="w-full md:w-[280px]"
          />
        )}
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-neutral-500 group-focus-within:text-blue-600 transition-colors pointer-events-none" />
          <input type="text" placeholder="Pesquisar por nome ou telefone..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full bg-[#eaedf2] dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl py-3 pl-12 pr-4 text-gray-900 dark:text-white focus:border-blue-600 outline-none transition-all font-medium placeholder:text-gray-400 placeholder:font-medium" />
        </div>
        <div className="flex gap-3">
          <button onClick={exportToCSV} title="Exportar para Excel" className="px-5 py-3 rounded-2xl font-bold flex items-center gap-2 bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white border border-gray-300 dark:border-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-700 dark:bg-neutral-700 transition-all">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={()=>setIsFilterOpen(true)} className={`px-6 py-3 rounded-2xl font-bold flex items-center gap-2 border transition-all ${statusFilters.length > 0 || overdueOnly || consultantFilters.length > 0 ? 'bg-blue-600 text-gray-900 dark:text-white border-blue-600' : 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white border-gray-300 dark:border-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-700 dark:bg-neutral-700'}`}>
            <Filter className="w-4 h-4" /> Filtros {(statusFilters.length + consultantFilters.length + (overdueOnly?1:0)) > 0 && `(${(statusFilters.length + consultantFilters.length + (overdueOnly?1:0))})`}
          </button>
          <button onClick={()=>setIsAddModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-gray-900 dark:text-white px-7 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-xl active:scale-95 transition-all text-xs uppercase tracking-widest"><Plus className="w-5 h-5" /> Novo Lead</button>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden flex-1 shadow-2xl">
        <div className="overflow-x-auto h-full scrollbar-hide">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead className="sticky top-0 bg-white dark:bg-neutral-900 z-10 border-b border-gray-200 dark:border-neutral-800">
              <tr className="text-gray-400 dark:text-neutral-500 text-[10px] font-bold uppercase tracking-[0.2em]">
                <th className="py-6 px-8">Informações do Aluno</th>
                <th className="py-6 px-8 text-center">Status no Funil</th>
                <th className="py-6 px-8">Ação Agendada</th>
                <th className="py-6 px-8 text-right">Data de Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map(l => {
                const isOverdue = l.status !== 'Venda' && l.status !== 'Perda' && l.nextFollowUp && l.nextFollowUp < new Date();
                return (
                  <tr key={l.id} onClick={()=>setSelectedLead(l)} className="border-b border-gray-200 dark:border-neutral-800/30 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800/40 cursor-pointer transition-all group">
                    <td className="py-5 px-8">
                      <div className="flex flex-col">
                        <span className={`font-bold text-base tracking-tight ${isOverdue ? 'text-red-500' : 'text-gray-800 dark:text-neutral-200'}`}>{l.name}</span>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-400 dark:text-neutral-500 font-bold flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {l.whatsapp}</span>
                          {isAdminUser(appUser) && <span className="text-[10px] font-bold text-blue-600/40 uppercase tracking-widest">@{l.consultantName}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-8 text-center"><StatusBadge statusName={l.status} statusesArray={statuses} /></td>
                    <td className="py-5 px-8">
                      {l.nextFollowUp ? (
                        <div className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider ${isOverdue ? 'text-red-400' : 'text-yellow-400'}`}>
                          {isOverdue ? <AlertCircle className="w-4 h-4 animate-pulse" /> : <FollowUpIcon type={l.nextFollowUpType} className="w-4 h-4" />}
                          <span>{l.nextFollowUp.toLocaleDateString('pt-BR')} às {l.nextFollowUp.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
                        </div>
                      ) : <span className="text-gray-700 dark:text-neutral-300 text-[10px] font-bold italic uppercase tracking-widest">Sem agendamento</span>}
                    </td>
                    <td className="py-5 px-8 text-right text-gray-600 dark:text-neutral-400 text-xs font-semibold">{l.createdAt?.toLocaleDateString('pt-BR') || ""}</td>
                  </tr>
                );
              })}
              {filteredLeads.length === 0 && (
                <tr><td colSpan="4" className="py-10 text-center text-gray-400 dark:text-neutral-500 font-bold uppercase tracking-widest text-xs">Nenhum lead encontrado</td></tr>
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
                <button onClick={()=>setOverdueOnly(!overdueOnly)} className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${overdueOnly ? 'bg-red-500/10 border-red-500/50 text-red-400' : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800'}`}>
                  <span className="font-bold text-xs uppercase tracking-widest">Em Atraso</span>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 ${overdueOnly ? 'bg-red-500 border-red-500 text-white' : 'border-gray-300 dark:border-neutral-700'}`}>{overdueOnly && <Check className="w-3 h-3 font-bold" />}</div>
                </button>
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
              <button onClick={()=>{setStatusFilters([]); setOverdueOnly(false); setConsultantFilters([]);}} className="py-3 rounded-xl text-gray-400 dark:text-neutral-500 font-bold hover:bg-white dark:bg-neutral-900 transition-all text-[10px] uppercase tracking-[0.2em]">Limpar</button>
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

  return (
    <div className="fixed inset-y-0 right-0 left-0 md:left-64 z-[100] bg-[#eaedf2] dark:bg-neutral-950 flex flex-col md:flex-row overflow-hidden animate-fade-in shadow-[-20px_0_40px_rgba(0,0,0,0.1)]">
        
        {/* LEFT COLUMN: Lead Info & Actions */}
        <div className="w-full md:w-[450px] lg:w-[480px] shrink-0 p-6 md:p-8 border-r border-gray-200 dark:border-neutral-800 overflow-y-auto bg-white dark:bg-neutral-900 relative z-10 custom-scrollbar">
           
           <div className="flex justify-end gap-2 mb-4">
             {!isEditing && !isReadOnly && <button onClick={()=>setIsEditing(true)} title="Editar Cadastro" className="p-2 bg-gray-100 dark:bg-neutral-800 text-blue-500 hover:bg-blue-600 hover:text-white rounded-full transition-all shadow-sm active:scale-90"><Pencil className="w-4 h-4"/></button>}
             {!isEditing && isAdminUser(appUser) && <button onClick={handleDelete} title="Excluir Permanentemente" className="p-2 bg-gray-100 dark:bg-neutral-800 text-red-500 hover:bg-red-600 hover:text-white rounded-full transition-all shadow-sm active:scale-90"><Trash className="w-4 h-4"/></button>}
             <button onClick={onClose} title="Fechar Detalhes" className="p-2 bg-gray-100 dark:bg-neutral-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-neutral-700 dark:text-neutral-400 dark:hover:text-white rounded-full transition-all shadow-sm active:scale-90"><X className="w-4 h-4" /></button>
           </div>

           {isEditing ? (
             <div className="space-y-6 animate-fade-in">
               <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Editar Cadastro</h3>
               <div><label className="text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1 block">Nome Completo</label><input type="text" value={editData.name} onChange={e=>setEditData({...editData, name: e.target.value})} className="w-full bg-[#eaedf2] dark:bg-neutral-950 p-3 text-sm rounded-xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 focus:border-blue-500 font-bold" /></div>
               <div><label className="text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1 block">WhatsApp</label><input type="tel" value={editData.whatsapp} onChange={e=>setEditData({...editData, whatsapp: e.target.value})} className="w-full bg-[#eaedf2] dark:bg-neutral-950 p-3 text-sm rounded-xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 focus:border-blue-500 font-bold" /></div>
               <div><label className="text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1 block">Origem</label><input type="text" value={editData.source} onChange={e=>setEditData({...editData, source: e.target.value})} className="w-full bg-[#eaedf2] dark:bg-neutral-950 p-3 text-sm rounded-xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 focus:border-blue-500 font-bold" /></div>
               <div>
                 <label className="text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1 block">Consultor Responsável</label>
                 <select value={editData.consultantId} onChange={e=>setEditData({...editData, consultantId: e.target.value})} className="w-full bg-[#eaedf2] dark:bg-neutral-950 p-3 text-sm rounded-xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 focus:border-blue-500 font-bold appearance-none cursor-pointer">
                   <option value="">Selecione um consultor...</option>
                   {(usersList || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                 </select>
               </div>
               <div><label className="text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1 block">Etiquetas</label><div className="flex flex-wrap gap-2 mt-2">{(tags || []).map(t => ( <button key={t.id} onClick={() => setEditData(prev => ({...prev, tags: prev.tags.includes(t.name) ? prev.tags.filter(x=>x!==t.name) : [...prev.tags, t.name]}))} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${editData.tags.includes(t.name) ? 'bg-blue-600 border-blue-600 text-gray-900 dark:text-white' : 'bg-gray-100 dark:bg-neutral-800 border-gray-300 dark:border-neutral-700 text-gray-400 dark:text-neutral-500'}`}>{t.name}</button> ))}</div></div>
               <div><label className="text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1 block">Observação Fixa (Contexto Inicial)</label><textarea value={editData.observation} onChange={e=>setEditData({...editData, observation: e.target.value})} className="w-full bg-[#eaedf2] dark:bg-neutral-950 p-3 text-sm rounded-xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 focus:border-blue-500 font-medium h-32 resize-none" /></div>
               <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-neutral-800"><button onClick={()=>setIsEditing(false)} className="flex-1 py-3 bg-gray-100 dark:bg-neutral-800 rounded-xl font-semibold text-sm text-gray-700 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-all">Cancelar</button><button onClick={handleUpdateLead} disabled={loading} className="flex-1 py-3 bg-blue-600 rounded-xl font-semibold text-sm text-white shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all">Salvar</button></div>
             </div>
           ) : (
             <div className="animate-fade-in mt-12 md:mt-0">
               {/* Header Info */}
               <div className="mb-8">
                 <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">{lead.name}</h2>
                 <div className="flex flex-wrap gap-2 mb-4"> {(lead.tags || []).map(tName => <TagBadge key={tName} tagName={tName} tagsArray={tags} />)} </div>
                 <button onClick={handleWhatsApp} className="text-sm font-semibold text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-2 mt-2 transition-all hover:underline" title="Chamar no WhatsApp">
                   <Phone className="w-4 h-4" /> {lead.whatsapp}
                 </button>
                 <div className="text-xs font-semibold text-gray-500 dark:text-neutral-500 flex items-center gap-2 mt-2">
                   <Tag className="w-3.5 h-3.5" /> Origem: <span className="text-gray-700 dark:text-neutral-300">{lead.source || 'Não informada'}</span>
                 </div>
                 {lead.consultantName && (
                   <div className="text-xs font-semibold text-gray-500 dark:text-neutral-500 flex items-center gap-2 mt-2">
                     <Users className="w-3.5 h-3.5" /> Responsável: <span className="text-blue-600 dark:text-blue-400">@{lead.consultantName}</span>
                   </div>
                 )}
               </div>

               {/* Clean Action Buttons */}
               <div className="flex gap-3 mb-8 border-b border-gray-200 dark:border-neutral-800 pb-8">
                 <button onClick={handleWin} className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"><Trophy className="w-3.5 h-3.5"/> Ganho</button>
                 <button onClick={()=>setLossModalOpen(true)} className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"><ThumbsDown className="w-3.5 h-3.5"/> Perda</button>
               </div>

               {/* Lead Lost Banner */}
               {lead.status === 'Perda' && lead.lossReason && (
                 <div className="mb-8 p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 flex items-start gap-3">
                   <ThumbsDown className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                   <div><p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest mb-1">Motivo da Perda</p><p className="text-sm font-semibold text-red-800 dark:text-red-300">{lead.lossReason}</p></div>
                 </div>
               )}

               {/* Contexto Minimalista */}
               <div className="mb-8">
                 <h4 className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest mb-3">Contexto Inicial</h4>
                 <p className="text-sm text-gray-800 dark:text-neutral-200 leading-relaxed font-medium">
                   {lead.observation || "Nenhuma observação registrada no momento do cadastro."}
                 </p>
               </div>

               {/* Registrar Atividade Minimalista */}
               <div className="mb-8 border-t border-gray-200 dark:border-neutral-800 pt-8">
                 <h4 className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Clock className="w-4 h-4"/> Registrar Atividade</h4>
                 
                 <div className="space-y-4">
                   {safeFunnels.length > 0 && (
                     <div>
                       <label className="text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1.5 block">Funil</label>
                       <select value={funnelId || ''} onChange={e => handleFunnelChange(e.target.value)} className="w-full bg-transparent p-3 text-sm rounded-xl text-gray-900 dark:text-white outline-none border border-gray-300 dark:border-neutral-700 focus:border-blue-500 transition-all appearance-none font-semibold shadow-sm">
                         {safeFunnels.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                       </select>
                       {funnelId && funnelId !== (lead.funnelId || null) && (
                         <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mt-1.5">A etapa será redefinida para a primeira do novo funil.</p>
                       )}
                     </div>
                   )}
                   <div>
                     <label className="text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1.5 block">Fase do Funil</label>
                     <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-transparent p-3 text-sm rounded-xl text-gray-900 dark:text-white outline-none border border-gray-300 dark:border-neutral-700 focus:border-blue-500 transition-all appearance-none font-semibold shadow-sm">
                       {statusesForFunnel.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                       {/* Inclui status atual caso não esteja no funil (ex.: Venda/Perda) */}
                       {!statusesForFunnel.some(s => s.name === status) && status && (
                         <option value={status}>{status}</option>
                       )}
                     </select>
                   </div>
                   
                   <div>
                     <label className="text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1.5 block">Anotações da Conversa</label>
                     <textarea value={note} onChange={e => setNote(e.target.value)} className="w-full bg-transparent p-3 text-sm rounded-xl text-gray-900 dark:text-white h-24 outline-none border border-gray-300 dark:border-neutral-700 focus:border-blue-500 font-medium resize-none transition-all shadow-sm" placeholder="O que foi discutido?" />
                   </div>

                   <div className="p-4 rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/30">
                     <label className="flex items-center gap-3 text-sm font-semibold text-gray-800 dark:text-neutral-200 cursor-pointer">
                       <input type="checkbox" checked={enableFollowUp} onChange={e => setEnableFollowUp(e.target.checked)} className="w-4 h-4 rounded border-gray-300 dark:border-neutral-700 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer" />
                       Agendar Próximo Contato
                     </label>
                     {enableFollowUp && (
                       <div className="mt-4 space-y-4 animate-fade-in border-t border-gray-200 dark:border-neutral-800 pt-4">
                         <div className="grid grid-cols-2 gap-2">
                           {['Mensagem', 'Ligação', 'Visita', 'Aula Experimental'].map(t => (
                             <button key={t} type="button" onClick={() => setFollowUpType(t)} className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all border ${followUpType === t ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300 shadow-sm' : 'bg-transparent border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:border-gray-300 dark:hover:border-neutral-600'}`}>{t}</button>
                           ))}
                         </div>
                         <div>
                           <label className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 mb-1.5 block uppercase tracking-widest">Data e Hora</label>
                           <div className="flex items-center gap-3">
                             <Calendar className="w-5 h-5 text-gray-400 dark:text-neutral-500 shrink-0" />
                             <input type="datetime-local" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} className="w-full bg-transparent p-3 text-sm rounded-xl text-gray-900 dark:text-white outline-none border border-gray-300 dark:border-neutral-700 focus:border-blue-500 transition-all font-semibold" />
                           </div>
                         </div>
                       </div>
                     )}
                   </div>
                   
                   <button onClick={saveInteraction} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold tracking-widest uppercase py-4 rounded-xl shadow-md text-xs transition-all active:scale-95">Salvar Atividade</button>
                 </div>
               </div>

               {/* CSAT Minimalista */}
               <div className="border-t border-gray-200 dark:border-neutral-800 pt-8 pb-4">
                 <div className="flex items-center justify-between mb-5">
                   <h4 className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest flex items-center gap-2"><CheckCircle className="w-4 h-4"/> Pesquisa CSAT</h4>
                   <span className="text-xs font-semibold text-gray-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 px-2 py-1 rounded-md">
                     {lead.csatStatus === 'answered' ? 'Respondido' : lead.csatStatus === 'pending' ? 'Aguardando' : 'Não enviado'}
                   </span>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-2 mb-4">
                   <button type="button" onClick={() => setCsatStage('pos_agendamento')} className={`py-3 px-3 rounded-xl text-xs font-semibold transition-all border ${csatStage === 'pos_agendamento' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300 shadow-sm' : 'bg-transparent border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:border-gray-300 dark:hover:border-neutral-600'}`}>Pós-Agendamento</button>
                   <button type="button" onClick={() => setCsatStage('cliente_novo')} className={`py-3 px-3 rounded-xl text-xs font-semibold transition-all border ${csatStage === 'cliente_novo' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300 shadow-sm' : 'bg-transparent border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:border-gray-300 dark:hover:border-neutral-600'}`}>Pós-Matrícula</button>
                 </div>
                 
                 <button type="button" onClick={handleSendCsat} disabled={sendingCsat} className="w-full bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-800 dark:text-neutral-200 font-bold py-3 rounded-xl shadow-sm text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2 active:scale-95">
                   {sendingCsat ? 'Gerando...' : <><MessageCircle className="w-4 h-4"/> Enviar Link por WhatsApp</>}
                 </button>
               </div>

             </div>
           )}
        </div>

        {/* RIGHT COLUMN: Alternating Timeline */}
        <div className="flex-1 bg-[#eaedf2] dark:bg-neutral-950 p-6 md:p-12 overflow-y-auto relative custom-scrollbar">          
          <div className="flex flex-col gap-4 mb-12">
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Clock className="w-8 h-8 text-blue-600" />
              Jornada do Cliente
            </h3>
            <p className="text-sm text-gray-500 dark:text-neutral-400 font-medium">Histórico completo de interações e mudanças de fase.</p>
          </div>
          
          <div className="relative max-w-4xl mx-auto pb-12">
            {/* The vertical connecting line */}
            <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-1 bg-gray-200 dark:bg-neutral-800 md:-translate-x-1/2 rounded-full"></div>

            {interactions.map((i, index) => {
              const visual = getInteractionVisual(i, statuses);
              const Icon = visual.icon;
              const isEven = index % 2 === 0;
              const lineClasses = isEven
                ? "absolute top-1/2 -translate-y-1/2 h-0.5 bg-gray-300 dark:bg-neutral-700 z-0 left-6 w-14 md:left-auto md:right-1/2 md:w-[calc(8%+3rem)]"
                : "absolute top-1/2 -translate-y-1/2 h-0.5 bg-gray-300 dark:bg-neutral-700 z-0 left-6 w-14 md:left-1/2 md:right-auto md:w-[calc(8%+3rem)]";

              return (
                <div key={i.id} className={`relative flex items-center md:justify-between mb-10 ${isEven ? 'md:flex-row-reverse' : ''} animate-fade-in group`}>
                  <div className={lineClasses}></div>
                  {/* Empty space for the opposite side on desktop */}
                  <div className="hidden md:block md:w-[42%]"></div>
                  
                  {/* The dot icon */}
                  <div className={`absolute left-6 md:left-1/2 w-12 h-12 rounded-full border-4 border-[#eaedf2] dark:border-neutral-950 flex items-center justify-center shadow-xl -translate-x-1/2 z-10 transition-transform group-hover:scale-110 ${visual.dot}`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  {/* Content Card */}
                  <div className={`w-full ml-20 md:ml-0 md:w-[42%] ${isEven ? 'md:pr-12' : 'md:pl-12'}`}>
                    <div className={`rounded-2xl border p-6 transition-all hover:shadow-lg ${visual.card}`}>
                      <div className="flex flex-col gap-2 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {visual.stageName ? (
                            <StatusBadge statusName={visual.stageName} statusesArray={statuses} />
                          ) : (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${visual.pill}`}>
                              {visual.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            {i.consultantName}
                          </p>
                          <p className={`text-[10px] font-bold uppercase tracking-wider ${visual.meta}`}>
                            {i.createdAt?.toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <p className={`${visual.text} text-sm leading-relaxed mt-2 font-medium`}>
                        {i.text}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Creation node */}
            <div className="relative flex items-center md:justify-between animate-fade-in md:flex-row-reverse">
              <div className="absolute top-1/2 -translate-y-1/2 h-0.5 bg-gray-300 dark:bg-neutral-700 z-0 left-6 w-14 md:left-auto md:right-1/2 md:w-[calc(8%+3rem)]"></div>
              <div className="hidden md:block md:w-[42%]"></div>
              <div className="absolute left-6 md:left-1/2 w-12 h-12 rounded-full border-4 border-[#eaedf2] dark:border-neutral-950 flex items-center justify-center shadow-xl -translate-x-1/2 z-10 bg-green-500 text-white">
                <Plus className="w-5 h-5" />
              </div>
              <div className="w-full ml-20 md:ml-0 md:w-[42%] md:pr-12">
                <div className="rounded-2xl border p-6 bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800">
                  <div className="flex flex-col gap-2 mb-3">
                    <span className="self-start px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400">
                      Cadastro Original
                    </span>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">Sistema STRONIX</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-neutral-500">
                        {lead.createdAt?.toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-neutral-400 leading-relaxed font-medium">
                    Lead registrado no CRM na data oficial de {lead.createdAt?.toLocaleDateString('pt-BR') || "data"}.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      {lossModalOpen && <LossReasonModal lossReasons={lossReasons} onClose={()=>setLossModalOpen(false)} onConfirm={confirmLoss} />}
    </div>
  );
}

// ==========================================
// CONFIGURAÇÕES (ADMIN)ADMIN)
// ==========================================
function SettingsView({ db, statuses, sources, usersList, appUser, tags, lossReasons, leads, funnels }) {
  const [activeTab, setActiveTab] = useState('users');
  const [selectedFunnelInTab, setSelectedFunnelInTab] = useState(null);

  const tabs = [
    { id: 'users', label: 'Consultores', icon: Users },
    { id: 'transfer', label: 'Migrar Leads', icon: ArrowRightLeft },
    { id: 'statuses', label: 'Funil Pipeline', icon: Kanban },
    { id: 'tags', label: 'Etiquetas', icon: Tag },
    { id: 'sources', label: 'Origens', icon: Filter },
    { id: 'lossReasons', label: 'Motivos de Perda', icon: ThumbsDown }
  ];

  const goToTab = (tab) => {
    setActiveTab(tab);
    if (tab !== 'statuses') setSelectedFunnelInTab(null);
  };

  const funnelInTab = (funnels || []).find(f => f.id === selectedFunnelInTab);

  return (
    <div className="h-full flex flex-col md:flex-row gap-6 animate-fade-in max-w-7xl mx-auto w-full">
      {/* Sidebar */}
      <div className="w-full md:w-64 shrink-0 flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 px-2">Configurações</h2>
        <div className="flex flex-col gap-1 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-2 rounded-2xl shadow-xl">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => goToTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${isActive
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                    : 'text-gray-500 hover:bg-gray-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
                  }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-x-hidden">
        {activeTab === 'users' && <ManageUsersTab db={db} appUser={appUser} />}
        {activeTab === 'statuses' && !selectedFunnelInTab && (
          <ManageFunnelsTab db={db} funnels={funnels} statuses={statuses} leads={leads} onSelectFunnel={setSelectedFunnelInTab} />
        )}
        {activeTab === 'statuses' && selectedFunnelInTab && (
          <div className="space-y-4">
            <button
              onClick={() => setSelectedFunnelInTab(null)}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 bg-blue-500/10 hover:bg-blue-500/20 px-5 py-3 rounded-2xl transition-all active:scale-95"
            >
              ← Voltar para Funis
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
    <div className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-[2rem] p-8 shadow-sm animate-fade-in flex flex-col">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8 border-b border-gray-100 dark:border-neutral-800 pb-5">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Users className="w-6 h-6 text-blue-500" /> Equipe STRONIX
          </h3>
          <p className="text-xs font-semibold text-gray-400 mt-2 uppercase tracking-widest">
            Cadastro interno e credenciais de acesso
          </p>
        </div>

        <div className="flex justify-end w-full md:w-auto mt-4 md:mt-0">
          <button
            type="button"
            onClick={handleToggleAddEdit}
            className="text-blue-500 hover:text-blue-600 font-bold uppercase tracking-widest text-[10px] transition-colors"
          >
            {showAdd || editingUser ? 'CANCELAR EDIÇÃO' : '+ ADICIONAR NOVO CONSULTOR'}
          </button>
        </div>
      </div>

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
    </div>
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
    <div className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-[2rem] p-8 shadow-sm animate-fade-in flex flex-col">
      <div className="mb-8 border-b border-gray-100 dark:border-neutral-800 pb-5">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Kanban className="w-6 h-6 text-blue-500" /> Funis Ativos
        </h3>
        <p className="text-xs font-semibold text-gray-400 mt-2 uppercase tracking-widest">
          Crie funis paralelos (Comercial, Indicação, Inativos, Renovações…) e configure as etapas de cada um
        </p>
      </div>

      <form onSubmit={handleAdd} className="relative bg-white dark:bg-neutral-900/80 p-6 rounded-[2rem] border border-blue-100 dark:border-blue-900/30 shadow-xl flex flex-col md:flex-row gap-4 mb-8">
        <input
          placeholder="NOME DO FUNIL (EX: INDICAÇÃO)..."
          value={name}
          onChange={e => setName(e.target.value)}
          className="flex-1 bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold shadow-sm"
        />
        <button type="submit" className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all">
          ADICIONAR FUNIL
        </button>
      </form>

      <div className="space-y-4">
        {safeFunnels.length === 0 ? (
          <div className="text-center text-xs font-semibold text-gray-400 dark:text-neutral-500 py-12 uppercase tracking-widest">
            Nenhum funil cadastrado ainda. Crie o primeiro funil acima.
          </div>
        ) : (
          <p className="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-widest text-center mb-2 flex items-center justify-center gap-2 bg-blue-50 dark:bg-blue-900/10 py-3 rounded-2xl border border-blue-100 dark:border-blue-900/30">
            <GripVertical className="w-4 h-4" />
            Segure e arraste os funis para reordenar
          </p>
        )}
        {safeFunnels.map((f, i) => (
          <div
            key={f.id}
            draggable={editingId !== f.id}
            onDragStart={e => e.dataTransfer.setData('idx', i)}
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleReorder(Number(e.dataTransfer.getData('idx')), i)}
            className="group relative bg-white dark:bg-neutral-900 p-6 rounded-[2rem] border border-gray-100 dark:border-neutral-800 flex justify-between items-center cursor-grab active:cursor-grabbing hover:border-blue-200 dark:hover:border-blue-900/50 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300"
          >
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="flex items-center justify-center p-2 rounded-xl bg-gray-50 dark:bg-neutral-800 text-gray-400 group-hover:text-blue-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-all shadow-sm border border-gray-100 dark:border-neutral-700 shrink-0" title="Segure para arrastar">
                <GripVertical className="w-5 h-5" />
              </div>
              {editingId === f.id ? (
                <form onSubmit={handleSaveEdit} className="flex gap-2 flex-1">
                  <input
                    autoFocus
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    className="flex-1 bg-gray-50 dark:bg-neutral-950 px-4 py-3 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-blue-500 transition-all text-xs font-bold shadow-sm"
                  />
                  <button type="submit" className="bg-blue-600 text-white px-5 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all">SALVAR</button>
                  <button type="button" onClick={() => { setEditingId(null); setEditingName(''); }} className="bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 px-5 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-sm hover:bg-gray-200 dark:hover:bg-neutral-700 active:scale-95 transition-all">CANCELAR</button>
                </form>
              ) : (
                <>
                  <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{f.name}</span>
                  {f.isDefault && (
                    <span className="text-[9px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 shrink-0">
                      Padrão
                    </span>
                  )}
                </>
              )}
            </div>
            {editingId !== f.id && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onSelectFunnel(f.id)}
                  className="text-[10px] uppercase font-bold tracking-widest text-blue-600 hover:text-white hover:bg-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:dark:bg-blue-600 border border-blue-100 dark:border-blue-900/30 px-4 py-3 rounded-2xl transition-all active:scale-95"
                >
                  Configurar Etapas
                </button>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md p-1 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800">
                  {!f.isDefault && (
                    <button
                      title="Tornar padrão"
                      onClick={() => handleSetDefault(f)}
                      className="text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 p-2 rounded-lg active:scale-90 transition-all"
                    >
                      <Trophy className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    title="Renomear"
                    onClick={() => { setEditingId(f.id); setEditingName(f.name); }}
                    className="text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 rounded-lg active:scale-90 transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    title="Excluir"
                    onClick={() => handleDelete(f)}
                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg active:scale-90 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
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
    <div className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-[2rem] p-8 shadow-sm animate-fade-in flex flex-col">
      <div className="mb-8 border-b border-gray-100 dark:border-neutral-800 pb-5">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Kanban className="w-6 h-6 text-blue-500" /> Pipeline: {funnelName || 'Funil'}
        </h3>
        <p className="text-xs font-semibold text-gray-400 mt-2 uppercase tracking-widest">Defina as etapas da jornada deste funil</p>
      </div>

      <form onSubmit={save} className="relative bg-white dark:bg-neutral-900/80 p-6 rounded-[2rem] border border-blue-100 dark:border-blue-900/30 shadow-xl flex flex-col md:flex-row gap-4 mb-8">
        <input placeholder="ETAPA..." required value={name} onChange={e => setName(e.target.value)} className="flex-1 bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold shadow-sm" />
        <select value={color} onChange={e => setColor(e.target.value)} className="bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold uppercase shadow-sm">
          <option value="blue">AZUL-CYAN</option>
          <option value="green">VERDE-EMERALD</option>
          <option value="yellow">AMARELO-GOLD</option>
          <option value="purple">ROXO-INDIGO</option>
          <option value="red">VERMELHO-ROSE</option>
          <option value="orange">LARANJA-VIVO</option>
          <option value="teal">TEAL-OCEAN</option>
          <option value="pink">ROSA-PINK</option>
          <option value="indigo">INDIGO-DEEP</option>
          <option value="lime">LIMA-NEON</option>
          <option value="gray">CINZA-SLATE</option>
        </select>
        {editingId ? (
          <div className="flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all">SALVAR</button>
            <button type="button" onClick={() => { setEditingId(null); setName(''); }} className="bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 px-8 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-sm hover:bg-gray-200 dark:hover:bg-neutral-700 active:scale-95 transition-all">CANCELAR</button>
          </div>
        ) : (
          <button type="submit" className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all">ADICIONAR</button>
        )}
      </form>

      <div className="space-y-4">
        {statusesForFunnel.length === 0 ? (
          <div className="text-center text-xs font-semibold text-gray-400 dark:text-neutral-500 py-12 uppercase tracking-widest">
            Nenhuma etapa neste funil ainda. Crie a primeira etapa acima.
          </div>
        ) : (
          <p className="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-widest text-center mb-2 flex items-center justify-center gap-2 bg-blue-50 dark:bg-blue-900/10 py-3 rounded-2xl border border-blue-100 dark:border-blue-900/30">
            <GripVertical className="w-4 h-4" />
            Segure e arraste as etapas para reordenar o funil
          </p>
        )}
        {statusesForFunnel.map((s, i) => (
          <div key={s.id} draggable onDragStart={e => e.dataTransfer.setData('idx', i)} onDragOver={e => e.preventDefault()} onDrop={e => drop(Number(e.dataTransfer.getData('idx')), i)} className="group relative bg-white dark:bg-neutral-900 p-6 rounded-[2rem] border border-gray-100 dark:border-neutral-800 flex justify-between items-center cursor-grab active:cursor-grabbing hover:border-blue-200 dark:hover:border-blue-900/50 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center p-2 rounded-xl bg-gray-50 dark:bg-neutral-800 text-gray-400 group-hover:text-blue-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-all shadow-sm border border-gray-100 dark:border-neutral-700" title="Segure para arrastar">
                <GripVertical className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest bg-gray-100 dark:bg-neutral-800 px-3 py-1.5 rounded-lg shadow-inner">
                Etapa {i + 1}
              </span>
              <div className="scale-110 origin-left ml-2">
                <StatusBadge statusName={s.name} statusesArray={statuses} />
              </div>
            </div>
            <div className="absolute right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md p-1 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800">
              <button onClick={() => { setName(s.name); setColor(s.color || 'blue'); setEditingId(s.id); }} className="text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 rounded-lg active:scale-90 transition-all" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => handleDelete(s)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg active:scale-90 transition-all" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
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
          const { writeBatch } = await import('firebase/firestore');
          const batchSize = 400;
          for (let i = 0; i < leadsToUpdate.length; i += batchSize) {
            const chunk = leadsToUpdate.slice(i, i + batchSize);
            const batch = writeBatch(db);
            chunk.forEach(lead => {
              batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'stronix_leads', lead.id), {
                source: name
              });
            });
            await batch.commit();
          }
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
    <div className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-[2rem] p-8 shadow-sm animate-fade-in flex flex-col">
      <div className="mb-8 border-b border-gray-100 dark:border-neutral-800 pb-5">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Globe className="w-6 h-6 text-blue-500" /> Origens de Alunos
        </h3>
        <p className="text-xs font-semibold text-gray-400 mt-2 uppercase tracking-widest">Controle de onde vêm os seus leads</p>
      </div>

      <form onSubmit={save} className="relative bg-white dark:bg-neutral-900/80 p-6 rounded-[2rem] border border-blue-100 dark:border-blue-900/30 shadow-xl flex flex-col md:flex-row gap-4 mb-8">
        <input placeholder="Ex: TikTok, Facebook Ads..." required value={name} onChange={e => setName(e.target.value)} className="flex-1 bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold shadow-sm" />
        {editingId ? (
          <div className="flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all">SALVAR</button>
            <button type="button" onClick={() => { setEditingId(null); setName(''); }} className="bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 px-8 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-sm hover:bg-gray-200 dark:hover:bg-neutral-700 active:scale-95 transition-all">CANCELAR</button>
          </div>
        ) : (
          <button type="submit" className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all">CRIAR ORIGEM</button>
        )}
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {(sources || []).map(s => (
          <div key={s.id} className="group relative bg-white dark:bg-neutral-900 p-6 rounded-[2rem] border border-gray-100 dark:border-neutral-800 hover:border-blue-200 dark:hover:border-blue-900/50 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 flex justify-between items-center">
            <span className="text-sm font-bold text-gray-900 dark:text-white">{s.name}</span>
            <div className="absolute right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md p-1 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800">
              <button onClick={() => { setName(s.name); setEditingId(s.id); }} className="text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 rounded-lg active:scale-90 transition-all" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => handleDelete(s)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg active:scale-90 transition-all" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
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
          const { writeBatch } = await import('firebase/firestore');
          const batchSize = 400;
          for (let i = 0; i < leadsToUpdate.length; i += batchSize) {
            const chunk = leadsToUpdate.slice(i, i + batchSize);
            const batch = writeBatch(db);
            chunk.forEach(lead => {
              const newTags = (lead.tags || []).map(t => t === oldTag.name ? name : t);
              batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'stronix_leads', lead.id), {
                tags: newTags
              });
            });
            await batch.commit();
          }
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
    <div className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-[2rem] p-8 shadow-sm animate-fade-in flex flex-col">
      <div className="mb-8 border-b border-gray-100 dark:border-neutral-800 pb-5">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Tag className="w-6 h-6 text-blue-500" /> Etiquetas
        </h3>
        <p className="text-xs font-semibold text-gray-400 mt-2 uppercase tracking-widest">Organize e classifique seus leads</p>
      </div>

      <form onSubmit={save} className="relative bg-white dark:bg-neutral-900/80 p-6 rounded-[2rem] border border-blue-100 dark:border-blue-900/30 shadow-xl flex flex-col md:flex-row gap-4 mb-8">
        <input placeholder="ETIQUETA (EX: VIP)..." required value={name} onChange={e => setName(e.target.value)} className="flex-1 bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold shadow-sm" />
        <select value={color} onChange={e => setColor(e.target.value)} className="bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold uppercase shadow-sm">
          <option value="blue">AZUL-CYAN</option>
          <option value="green">VERDE-EMERALD</option>
          <option value="yellow">AMARELO-GOLD</option>
          <option value="purple">ROXO-INDIGO</option>
          <option value="red">VERMELHO-ROSE</option>
          <option value="orange">LARANJA-VIVO</option>
          <option value="teal">TEAL-OCEAN</option>
          <option value="pink">ROSA-PINK</option>
          <option value="indigo">INDIGO-DEEP</option>
          <option value="lime">LIMA-NEON</option>
          <option value="gray">CINZA-SLATE</option>
        </select>
        {editingId ? (
          <div className="flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all">SALVAR</button>
            <button type="button" onClick={() => { setEditingId(null); setName(''); setColor('blue'); }} className="bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 px-8 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-sm hover:bg-gray-200 dark:hover:bg-neutral-700 active:scale-95 transition-all">CANCELAR</button>
          </div>
        ) : (
          <button type="submit" className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all">CRIAR</button>
        )}
      </form>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {(tags || []).map(t => (
          <div key={t.id} className="group relative bg-white dark:bg-neutral-900 p-6 rounded-[2rem] border border-gray-100 dark:border-neutral-800 hover:border-blue-200 dark:hover:border-blue-900/50 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 flex justify-between items-center">
            <div className="scale-110 origin-left">
              <TagBadge tagName={t.name} tagsArray={tags} />
            </div>
            <div className="absolute right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md p-1 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800">
              <button onClick={() => { setName(t.name); setColor(t.color || 'blue'); setEditingId(t.id); }} className="text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 rounded-lg active:scale-90 transition-all" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => handleDelete(t)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg active:scale-90 transition-all" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
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
          const { writeBatch } = await import('firebase/firestore');
          const batchSize = 400;
          for (let i = 0; i < leadsToUpdate.length; i += batchSize) {
            const chunk = leadsToUpdate.slice(i, i + batchSize);
            const batch = writeBatch(db);
            chunk.forEach(lead => {
              batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'stronix_leads', lead.id), {
                lossReason: name
              });
            });
            await batch.commit();
          }
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
    <div className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-[2rem] p-8 shadow-sm animate-fade-in flex flex-col">
      <div className="mb-8 border-b border-gray-100 dark:border-neutral-800 pb-5">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <ThumbsDown className="w-6 h-6 text-red-500" /> Motivos de Perda
        </h3>
        <p className="text-xs font-semibold text-gray-400 mt-2 uppercase tracking-widest">Categorize por que os leads não fecharam</p>
      </div>

      <form onSubmit={save} className="relative bg-white dark:bg-neutral-900/80 p-6 rounded-[2rem] border border-red-100 dark:border-red-900/30 shadow-xl flex flex-col md:flex-row gap-4 mb-8">
        <input placeholder="Ex: Achou caro, Longe de casa..." required value={name} onChange={e => setName(e.target.value)} className="flex-1 bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-red-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold shadow-sm" />
        {editingId ? (
          <div className="flex gap-2">
            <button type="submit" className="bg-red-600 text-white px-8 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-red-600/20 hover:bg-red-700 active:scale-95 transition-all">SALVAR</button>
            <button type="button" onClick={() => { setEditingId(null); setName(''); }} className="bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 px-8 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-sm hover:bg-gray-200 dark:hover:bg-neutral-700 active:scale-95 transition-all">CANCELAR</button>
          </div>
        ) : (
          <button type="submit" className="bg-red-600 text-white px-8 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-red-600/20 hover:bg-red-700 active:scale-95 transition-all">CRIAR MOTIVO</button>
        )}
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {(lossReasons || []).map(r => (
          <div key={r.id} className="group relative bg-white dark:bg-neutral-900 p-6 rounded-[2rem] border border-gray-100 dark:border-neutral-800 hover:border-red-200 dark:hover:border-red-900/50 hover:shadow-xl hover:shadow-red-500/5 transition-all duration-300 flex justify-between items-center">
            <span className="text-sm font-bold text-red-500 dark:text-red-400">{r.name}</span>
            <div className="absolute right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md p-1 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800">
              <button onClick={() => { setName(r.name); setEditingId(r.id); }} className="text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 rounded-lg active:scale-90 transition-all" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => handleDelete(r)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg active:scale-90 transition-all" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
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
    <div className="relative bg-white dark:bg-neutral-900/80 p-8 sm:p-10 rounded-[2.5rem] border border-blue-100 dark:border-blue-900/30 shadow-2xl max-w-3xl mx-auto flex flex-col mt-4 animate-fade-in">
      
      <div className="mb-8 text-center flex flex-col items-center justify-center border-b border-gray-100 dark:border-neutral-800 pb-8">
        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4 shadow-inner">
          <ArrowRightLeft className="w-8 h-8 text-blue-500" />
        </div>
        <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-wider">
          Migração em Massa
        </h3>
        <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 mt-2 uppercase tracking-widest max-w-sm">
          Transfira carteiras completas de leads de um consultor para outro de forma segura
        </p>
      </div>

      <div className="space-y-6 relative">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 block uppercase tracking-widest px-2">De (Consultor Antigo)</label>
          <select value={fromUser} onChange={e => setFromUser(e.target.value)} className="w-full bg-gray-50 dark:bg-neutral-950 border border-transparent focus:border-blue-500 dark:focus:border-blue-500 rounded-2xl px-5 py-4 text-gray-900 dark:text-white outline-none transition-all text-sm font-bold shadow-sm appearance-none cursor-pointer">
            <option value="">Selecione o consultor de origem...</option>
            {(allFromConsultants || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        <div className="flex justify-center -my-2 relative z-10">
          <div className="bg-white dark:bg-neutral-900 p-3.5 rounded-full border border-gray-100 dark:border-neutral-800 shadow-lg text-blue-500">
            <RefreshCw className="w-5 h-5 animate-[spin_3s_linear_infinite]" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 block uppercase tracking-widest px-2">Para (Consultor Novo)</label>
          <select value={toUser} onChange={e => setToUser(e.target.value)} className="w-full bg-gray-50 dark:bg-neutral-950 border border-transparent focus:border-green-500 dark:focus:border-green-500 rounded-2xl px-5 py-4 text-gray-900 dark:text-white outline-none transition-all text-sm font-bold shadow-sm appearance-none cursor-pointer">
            <option value="">Selecione o consultor de destino...</option>
            {(usersList || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-10">
        <button onClick={handleTransfer} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 rounded-2xl transition-all shadow-xl shadow-blue-600/20 uppercase text-[11px] tracking-widest disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2">
          {loading ? (
            <>PROCESSANDO MIGRAÇÃO...</>
          ) : (
            <>
              EXECUTAR MUDANÇA
              <ArrowRightLeft className="w-4 h-4 ml-1" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ==========================================
// DAILY GOAL VIEW (META DIÁRIA)
// ==========================================

function DailyGoalView({ leads, interactions, appUser, statuses, db, tags, lossReasons, usersList, funnels }) {
  const toast = useToast();
  const [selectedLead, setSelectedLead] = useState(null);
  const prevProgress = useRef(0);

  const processedLeads = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayEnd = new Date();
    todayEnd.setHours(23,59,59,999);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const firstStatusName = statuses && statuses.length > 0 ? statuses[0].name : '';

    const myLeads = (leads || []).filter(l => l.consultantId === appUser.id);
    const allTargetLeadsMap = new Map();

    const hasInteractionToday = (lead) => (interactions || []).some(i => i.leadId === lead.id && i.createdAt && i.createdAt >= todayStart);
    const isVendaOrPerdaToday = (lead) => (lead.status === 'Venda' && lead.convertedAt && lead.convertedAt >= todayStart) || (lead.status === 'Perda' && lead.lostAt && lead.lostAt >= todayStart);
    const isTouchedToday = (lead) => hasInteractionToday(lead) || isVendaOrPerdaToday(lead);

    const addTarget = (lead, category, extraCheckIsDone = false) => {
        if (!allTargetLeadsMap.has(lead.id)) {
            allTargetLeadsMap.set(lead.id, { 
              ...lead, 
              categories: [category], 
              isDone: isTouchedToday(lead) || extraCheckIsDone 
            });
        } else {
            if (!allTargetLeadsMap.get(lead.id).categories.includes(category)) {
              allTargetLeadsMap.get(lead.id).categories.push(category);
            }
        }
    };

    myLeads.forEach(lead => {
      // 1. Leads 24h
      if (lead.createdAt && lead.createdAt >= oneDayAgo) {
        const movedOut = lead.status !== firstStatusName && lead.status !== 'Novo';
        addTarget(lead, 'Novo Lead 24h', movedOut);
      }

      // 2. Atrasados
      if (lead.status !== 'Venda' && lead.status !== 'Perda' && lead.nextFollowUp && lead.nextFollowUp < todayStart) {
        addTarget(lead, 'Atrasado');
      }

      // 3. Visitas Hoje
      if (lead.status !== 'Venda' && lead.status !== 'Perda') {
        const apptType = getLeadAppointmentType(lead);
        const apptDate = getLeadAppointmentDate(lead);
        if (apptType === 'visita' && apptDate >= todayStart && apptDate <= todayEnd) {
          addTarget(lead, 'Visita Hoje');
        }
      }

      // 4. Aulas Exp. Hoje
      if (lead.status !== 'Venda' && lead.status !== 'Perda') {
        const apptType = getLeadAppointmentType(lead);
        const apptDate = getLeadAppointmentDate(lead);
        if (apptType === 'aula_experimental' && apptDate >= todayStart && apptDate <= todayEnd) {
          addTarget(lead, 'Aula Experimental Hoje');
        }
      }
    });

    return Array.from(allTargetLeadsMap.values()).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [leads, appUser, interactions, statuses]);

  const pending = processedLeads.filter(l => !l.isDone);
  const done = processedLeads.filter(l => l.isDone);
  const total = processedLeads.length;
  const progress = total > 0 ? Math.round((done.length / total) * 100) : 100;

  const total24h = processedLeads.filter(l => l.categories.includes('Novo Lead 24h'));
  const pending24h = pending.filter(l => l.categories.includes('Novo Lead 24h'));
  const done24hCount = total24h.filter(l => l.isDone).length;

  const totalAtrasados = processedLeads.filter(l => l.categories.includes('Atrasado'));
  const pendingAtrasados = pending.filter(l => l.categories.includes('Atrasado'));
  const doneAtrasadosCount = totalAtrasados.filter(l => l.isDone).length;

  const totalVisitas = processedLeads.filter(l => l.categories.includes('Visita Hoje'));
  const pendingVisitas = pending.filter(l => l.categories.includes('Visita Hoje'));
  const doneVisitasCount = totalVisitas.filter(l => l.isDone).length;

  const totalAulas = processedLeads.filter(l => l.categories.includes('Aula Experimental Hoje'));
  const pendingAulas = pending.filter(l => l.categories.includes('Aula Experimental Hoje'));
  const doneAulasCount = totalAulas.filter(l => l.isDone).length;

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

  const renderPendingCard = (lead) => (
    <div key={lead.id} onClick={() => setSelectedLead(lead)} className="bg-[#eaedf2] dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 p-4 rounded-2xl flex flex-col gap-2 cursor-pointer hover:border-blue-500 transition-all shadow-sm group">
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col">
          <span className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">{lead.name}</span>
          <span className="text-xs font-bold text-gray-500 dark:text-neutral-400 mt-1">{lead.whatsapp}</span>
        </div>
        <button onClick={(e) => handleSnooze(lead, e)} className="p-2 bg-white dark:bg-neutral-900 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all shadow-sm active:scale-90" title="Adiar para amanhã">
          <Calendar className="w-4 h-4" />
        </button>
      </div>
      <div className="text-[10px] text-gray-400 mt-2 font-semibold">Entrou em: {lead.createdAt?.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</div>
    </div>
  );

  return (
    <div className="h-full flex flex-col space-y-6 animate-fade-in relative">
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 opacity-5 dark:opacity-10 pointer-events-none">
          <Target className="w-64 h-64" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white uppercase tracking-tighter">Sua Meta Diária</h2>
            <p className="text-sm text-gray-500 dark:text-neutral-400 font-medium mt-2 max-w-md">
              Sua lista de tarefas matadora: atenda os novos leads, recupere os atrasados e foque nas visitas e aulas experimentais de hoje. Vamos lá, {appUser.name.split(' ')[0]}!
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-4xl font-bold text-gray-900 dark:text-white">{progress}%</p>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Concluído</p>
            </div>
            <div className="w-24 h-24 rounded-full border-[6px] border-gray-100 dark:border-neutral-800 relative flex items-center justify-center bg-[#eaedf2] dark:bg-neutral-950 shadow-inner">
               <svg className="w-full h-full absolute top-0 left-0 -rotate-90">
                 <circle cx="50%" cy="50%" r="42" fill="transparent" stroke="currentColor" strokeWidth="6" className="text-blue-500" strokeDasharray="264" strokeDashoffset={264 - (264 * progress) / 100} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease-in-out' }} />
               </svg>
               <Target className={`w-8 h-8 ${progress === 100 ? 'text-green-500' : 'text-blue-500'}`} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-[400px]">
        {/* PENDENTES */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-[2.5rem] p-6 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 text-red-500">
              <Clock className="w-4 h-4" /> A Fazer
            </h3>
            <span className="bg-red-500/10 text-red-500 text-xs font-bold px-2.5 py-1 rounded-full">{pending.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2">
            {total === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-neutral-500">
                <CheckCircle className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-xs font-bold uppercase tracking-widest">Sua meta está vazia hoje!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {total24h.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-blue-500 mb-3 border-b border-blue-500/20 pb-2 flex justify-between items-center">
                      <span>Novos Leads 24 horas</span>
                      <span className="text-[10px] font-bold bg-blue-500/10 px-2 py-1 rounded-md">{done24hCount}/{total24h.length}</span>
                    </h4>
                    {pending24h.length > 0 ? <div className="space-y-3">{pending24h.map(renderPendingCard)}</div> : <div className="text-[10px] font-bold text-blue-500/50 uppercase tracking-widest py-1 flex items-center gap-2"><CheckCircle className="w-4 h-4"/> Limpo!</div>}
                  </div>
                )}
                {totalVisitas.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-purple-500 mb-3 border-b border-purple-500/20 pb-2 flex justify-between items-center">
                      <span>Visitas</span>
                      <span className="text-[10px] font-bold bg-purple-500/10 px-2 py-1 rounded-md">{doneVisitasCount}/{totalVisitas.length}</span>
                    </h4>
                    {pendingVisitas.length > 0 ? <div className="space-y-3">{pendingVisitas.map(renderPendingCard)}</div> : <div className="text-[10px] font-bold text-purple-500/50 uppercase tracking-widest py-1 flex items-center gap-2"><CheckCircle className="w-4 h-4"/> Limpo!</div>}
                  </div>
                )}
                {totalAulas.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-orange-500 mb-3 border-b border-orange-500/20 pb-2 flex justify-between items-center">
                      <span>Aulas Experimentais</span>
                      <span className="text-[10px] font-bold bg-orange-500/10 px-2 py-1 rounded-md">{doneAulasCount}/{totalAulas.length}</span>
                    </h4>
                    {pendingAulas.length > 0 ? <div className="space-y-3">{pendingAulas.map(renderPendingCard)}</div> : <div className="text-[10px] font-bold text-orange-500/50 uppercase tracking-widest py-1 flex items-center gap-2"><CheckCircle className="w-4 h-4"/> Limpo!</div>}
                  </div>
                )}
                {totalAtrasados.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-red-500 mb-3 border-b border-red-500/20 pb-2 flex justify-between items-center">
                      <span>Follow-ups Atrasados</span>
                      <span className="text-[10px] font-bold bg-red-500/10 px-2 py-1 rounded-md">{doneAtrasadosCount}/{totalAtrasados.length}</span>
                    </h4>
                    {pendingAtrasados.length > 0 ? <div className="space-y-3">{pendingAtrasados.map(renderPendingCard)}</div> : <div className="text-[10px] font-bold text-red-500/50 uppercase tracking-widest py-1 flex items-center gap-2"><CheckCircle className="w-4 h-4"/> Limpo!</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CONCLUÍDOS */}
        <div className="bg-[#f4f5f7] dark:bg-neutral-900/50 border border-gray-200 dark:border-neutral-800 rounded-[2.5rem] p-6 shadow-inner flex flex-col opacity-80">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 text-green-500">
              <CheckCircle className="w-4 h-4" /> Feitos Hoje
            </h3>
            <span className="bg-green-500/10 text-green-500 text-xs font-bold px-2.5 py-1 rounded-full">{done.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
            {done.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-neutral-500">
                <Target className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-xs font-bold uppercase tracking-widest">Nenhum ainda</p>
              </div>
            ) : (
              done.map(lead => (
                <div key={lead.id} onClick={() => setSelectedLead(lead)} className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-4 rounded-2xl flex justify-between items-center cursor-pointer hover:border-gray-400 transition-all shadow-sm">
                  <div>
                    <span className="font-bold text-sm text-gray-800 dark:text-neutral-200 line-through decoration-green-500/50">{lead.name}</span>
                    <p className="text-[10px] text-gray-400 mt-1 font-bold uppercase truncate">
                      {(lead.categories || []).join(' • ')}
                    </p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

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