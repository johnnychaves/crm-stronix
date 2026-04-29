import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Target
} from 'lucide-react';

import { initializeApp } from 'firebase/app';

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
  blue: "from-blue-600 to-cyan-500",
  green: "from-green-600 to-emerald-400",
  yellow: "from-yellow-600 to-yellow-400",
  red: "from-red-600 to-pink-500",
  purple: "from-purple-600 to-indigo-500",
  orange: "from-blue-600 to-amber-500",
  gray: "from-neutral-600 to-neutral-400"
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

function PublicCsatView() {
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
      alert('Selecione uma nota de 1 a 5.');
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
    unsubUsers();
  };
}, [firebaseUser, appUser]);

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
              {activeTab === 'dashboard' && <DashboardView leads={leads} interactions={interactions} appUser={appUser} statuses={statuses} usersList={usersList} tags={tags} lossReasons={lossReasons} db={db} />}
              {activeTab === 'kanban' && <KanbanView leads={leads} interactions={interactions} appUser={appUser} statuses={statuses} usersList={usersList} tags={tags} lossReasons={lossReasons} db={db} />}
              {activeTab === 'dailyGoal' && <DailyGoalView leads={leads} interactions={interactions} appUser={appUser} statuses={statuses} db={db} tags={tags} lossReasons={lossReasons} usersList={usersList} />}
              {activeTab === 'leads' && <LeadsView leads={leads} interactions={interactions} appUser={appUser} sources={sources} statuses={statuses} usersList={usersList} tags={tags} lossReasons={lossReasons} db={db} />}
              {activeTab === 'settings' && isAdminUser(appUser) && <SettingsView sources={sources} statuses={statuses} db={db} usersList={usersList} appUser={appUser} tags={tags} lossReasons={lossReasons} leads={leads} />}
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
  const [isRegistering, setIsRegistering] = useState(false);
  const handleRegisterBiometrics = async () => {
    if (!window.PublicKeyCredential) return alert("Dispositivo não suporta Passkeys.");
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
      alert("Face ID Ativado!");
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
function SidebarItem({ icon, label, active, onClick }) {
  return <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-blue-600/10 text-blue-600 font-bold' : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:bg-neutral-950 hover:text-gray-800 dark:text-neutral-200'}`}>{icon} <span className="text-sm tracking-tight">{label}</span></button>;
}

function StatusBadge({ statusName, statusesArray }) {
  if (statusName === 'Venda') return <span className="px-3 py-1 rounded-full text-[9px] font-bold text-white uppercase tracking-widest bg-gradient-to-r shadow-lg from-green-600 to-emerald-400">VENDA</span>;
  if (statusName === 'Perda') return <span className="px-3 py-1 rounded-full text-[9px] font-bold text-white uppercase tracking-widest bg-gradient-to-r shadow-lg from-red-600 to-pink-500">PERDA</span>;
  const statusObj = (statusesArray || []).find(s => s.name === statusName);
  const color = statusObj?.color || 'gray';
  return (
    <span className={`px-3 py-1 rounded-full text-[9px] font-bold text-gray-900 dark:text-white uppercase tracking-widest bg-gradient-to-r shadow-lg ${statusGradientMap[color] || statusGradientMap.gray}`}>
      {statusName}
    </span>
  );
}

function TagBadge({ tagName, tagsArray }) {
  const tagObj = (tagsArray || []).find(t => t.name === tagName);
  const color = tagObj?.color || 'gray';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold text-gray-900 dark:text-white uppercase tracking-tighter bg-gradient-to-br shadow-sm ${statusGradientMap[color] || statusGradientMap.gray}`}>
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
          <button onClick={()=>{if(reason) onConfirm(reason); else alert('Selecione um motivo!');}} className="flex-1 py-4 bg-red-600 rounded-xl font-bold text-[10px] uppercase text-gray-900 dark:text-white shadow-xl shadow-red-500/20 active:scale-95 transition-all">Confirmar Perda</button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// VISÃO GERAL (DASHBOARD) - PATCH 1 (AULA E VISITA)
// ==========================================
function DashboardView({ leads, interactions, appUser, statuses, usersList, tags, lossReasons, db }) {
  const [periodPreset, setPeriodPreset] = useState('monthly');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [funnelDetail, setFunnelDetail] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);

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
    return (leads || []).filter(l => isWithinSelectedRange(l.createdAt));
  }, [leads, periodRange]);

  const scheduledLeads = useMemo(() => {
    return (leads || []).filter(l => {
      const appointmentType = getLeadAppointmentType(l);
      const appointmentDate = getLeadAppointmentDate(l);

      return Boolean(appointmentType && appointmentDate && isWithinSelectedRange(appointmentDate));
    });
  }, [leads, periodRange]);

  const convertedLeads = useMemo(() => {
    return (leads || []).filter(l => {
      return isLeadConverted(l) && isWithinSelectedRange(getLeadConversionDate(l));
    });
  }, [leads, periodRange]);

  const satisfactionLeads = useMemo(() => {
  const allowedStages = ['pos_agendamento', 'cliente_novo'];

  return (leads || []).filter(l => {
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
}, [leads, periodRange]);

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
    return (leads || [])
      .filter(
        l =>
          l.status !== 'Venda' &&
          l.status !== 'Perda' &&
          l.nextFollowUp instanceof Date &&
          !isNaN(l.nextFollowUp.getTime())
      )
      .sort((a, b) => a.nextFollowUp.getTime() - b.nextFollowUp.getTime());
  }, [leads]);

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
              Funil Comercial
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
function KanbanView({ leads, interactions, appUser, statuses, usersList, tags, lossReasons, db }) {
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

  const kanbanLeads = useMemo(() => {
    let filtered = leads || [];
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
  }, [leads, consultantFilter, searchTerm]);

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
      alert('Você não tem permissão para mover este lead.');
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
      alert('Você não tem permissão para alterar este lead.');
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
      alert('Você não tem permissão para alterar este lead.');
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

  const pipelineColumns = statuses || [];

  return (
    <>
      <div className="h-[calc(100vh-10rem)] flex flex-col animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Quadro Kanban
            </h3>
            <p className="text-xs font-medium text-gray-500 dark:text-neutral-400 mt-1">
              Arraste os leads entre as etapas
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-center">
            <div className="relative w-full md:w-[320px]">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar leads por nome, telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl pl-11 pr-4 py-3 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 transition-all shadow-sm"
              />
            </div>
            {isAdminUser(appUser) && (
              <div className="w-full md:w-[280px]">
                <select
                  value={consultantFilter}
                  onChange={(e) => setConsultantFilter(e.target.value)}
                  className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3 text-sm text-gray-900 dark:text-white outline-none shadow-sm cursor-pointer"
                >
                  <option value="">Todos os consultores</option>
                  {(usersList || []).map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
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
function LeadsView({ leads, interactions, appUser, sources, statuses, usersList, tags, lossReasons, db }) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [statusFilters, setStatusFilters] = useState([]);
  const [consultantFilters, setConsultantFilters] = useState([]);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const filteredLeads = useMemo(() => {
    return (leads || []).filter(l => {
      const matchSearch = (l.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (l.whatsapp || '').includes(searchTerm);
      const matchStatus = statusFilters.length === 0 || statusFilters.includes(l.status);
      const matchConsultant = consultantFilters.length === 0 || consultantFilters.includes(l.consultantId);
      const isOverdue = l.status !== 'Venda' && l.status !== 'Perda' && l.nextFollowUp && l.nextFollowUp < new Date();
      const matchOverdue = !overdueOnly || isOverdue;
      return matchSearch && matchStatus && matchOverdue && matchConsultant;
    }).sort((a,b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0));
  }, [leads, searchTerm, statusFilters, overdueOnly, consultantFilters]);

  const toggleStatus = (s) => setStatusFilters(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleConsultant = (id) => setConsultantFilters(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const allStatuses = [...(statuses || []).map(s=>s.name), 'Venda', 'Perda'];

  // EXPORTAÇÃO CSV
  const exportToCSV = () => {
    if (!filteredLeads || filteredLeads.length === 0) {
      alert("Não há leads para exportar com os filtros atuais.");
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
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-neutral-500 group-focus-within:text-blue-600 transition-colors" />
          <input type="text" placeholder="Pesquisar por nome ou telefone..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full bg-[#eaedf2] dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl py-3 pl-12 pr-4 text-gray-900 dark:text-white focus:border-blue-600 outline-none transition-all font-medium" />
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

      {isAddModalOpen && <AddLeadModal onClose={() => setIsAddModalOpen(false)} appUser={appUser} sources={sources} statuses={statuses} tags={tags} db={db} />}
      {selectedLead && <LeadDetailsModal lead={selectedLead} interactions={interactions.filter(i => i.leadId === selectedLead.id).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0))} onClose={() => setSelectedLead(null)} appUser={appUser} statuses={statuses} tags={tags} lossReasons={lossReasons} db={db} />}
    </div>
  );
}

// ==========================================
// MODAL DE CADASTRO
// ==========================================
function AddLeadModal({ onClose, appUser, sources, statuses, tags, db }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', 
    whatsapp: '', 
    source: sources?.[0]?.name || 'Instagram', 
    status: statuses?.[0]?.name || 'Novo', 
    observation: '',
    tags: []
  });

const handleSubmit = async (e) => {
  e.preventDefault();
  if (!formData.name || !formData.whatsapp) return;

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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[130] p-4"><div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.6)] animate-fade-in"><div className="p-8 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center bg-gray-50 dark:bg-neutral-950/50"><h3 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tighter">Novo Registro de Lead</h3><button onClick={onClose} className="p-2 bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-white dark:text-white rounded-full transition-all active:scale-90"><X className="w-5 h-5"/></button></div><form onSubmit={handleSubmit} className="p-10 space-y-6"><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-[10px] font-bold uppercase text-gray-400 dark:text-neutral-500 mb-2 tracking-widest">Nome do Aluno</label><input type="text" required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full bg-[#eaedf2] dark:bg-neutral-950 p-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 focus:border-blue-600 font-bold transition-all" placeholder="Nome Completo" /></div><div><label className="block text-[10px] font-bold uppercase text-gray-400 dark:text-neutral-500 mb-2 tracking-widest">WhatsApp</label><input type="tel" required value={formData.whatsapp} onChange={e=>setFormData({...formData, whatsapp: e.target.value})} className="w-full bg-[#eaedf2] dark:bg-neutral-950 p-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 focus:border-blue-600 font-bold transition-all" placeholder="(00) 00000-0000" /></div><div><label className="block text-[10px] font-bold uppercase text-gray-400 dark:text-neutral-500 mb-2 tracking-widest">Origem do Lead</label><select value={formData.source} onChange={e=>setFormData({...formData, source: e.target.value})} className="w-full bg-[#eaedf2] dark:bg-neutral-950 p-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 focus:border-blue-600 font-bold transition-all appearance-none">{(sources || []).map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</select></div><div><label className="block text-[10px] font-bold uppercase text-gray-400 dark:text-neutral-500 mb-2 tracking-widest">Fase Inicial</label><select value={formData.status} onChange={e=>setFormData({...formData, status: e.target.value})} className="w-full bg-[#eaedf2] dark:bg-neutral-950 p-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 focus:border-blue-600 font-bold transition-all appearance-none">{(statuses || []).map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</select></div></div><div><label className="block text-[10px] font-bold uppercase text-gray-400 dark:text-neutral-500 mb-2 tracking-widest">Etiquetas</label><div className="flex flex-wrap gap-2 mt-2">{(tags || []).map(t => ( <button type="button" key={t.id} onClick={() => setFormData(prev => ({...prev, tags: prev.tags.includes(t.name) ? prev.tags.filter(x=>x!==t.name) : [...prev.tags, t.name]}))} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${formData.tags.includes(t.name) ? 'bg-blue-600 border-blue-600 text-gray-900 dark:text-white' : 'bg-gray-100 dark:bg-neutral-800 border-gray-300 dark:border-neutral-700 text-gray-400 dark:text-neutral-500'}`}>{t.name}</button> ))}</div></div><div className="w-full"><label className="block text-[10px] font-bold uppercase text-gray-400 dark:text-neutral-500 mb-2 tracking-widest">Observação Adicional</label><textarea value={formData.observation} onChange={e=>setFormData({...formData, observation: e.target.value})} className="w-full bg-[#eaedf2] dark:bg-neutral-950 p-5 rounded-2xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 focus:border-blue-600 font-medium resize-none h-24" placeholder="Algum detalhe importante para o primeiro atendimento?"></textarea></div><div className="flex justify-end gap-4 pt-4"><button type="button" onClick={onClose} className="px-8 py-4 rounded-2xl text-gray-400 dark:text-neutral-500 font-bold uppercase text-[10px] hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800 tracking-widest transition-all">Cancelar</button><button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-10 py-4 rounded-2xl text-white font-bold uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-blue-600/20 active:scale-95 transition-all">{loading ? 'SALVANDO...' : 'CADASTRAR ALUNO'}</button></div></form></div></div>
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

function LeadDetailsModal({ lead, interactions, onClose, appUser, statuses, tags, lossReasons, usersList, db }) {
  const isReadOnly = !canEditLead(appUser, lead);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: lead.name, whatsapp: lead.whatsapp, source: lead.source, observation: lead.observation || '', tags: lead.tags || [], consultantId: lead.consultantId || '' });
  const [note, setNote] = useState('');
  const [status, setStatus] = useState(lead.status);
  const [loading, setLoading] = useState(false);
  const [enableFollowUp, setEnableFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpType, setFollowUpType] = useState('Mensagem');
  
  const [lossModalOpen, setLossModalOpen] = useState(false);

  const [csatStage, setCsatStage] = useState(lead.csatRequestedStage || 'pos_agendamento');
  const [sendingCsat, setSendingCsat] = useState(false);

  useEffect(() => {
    setEditData({ name: lead.name, whatsapp: lead.whatsapp, source: lead.source, observation: lead.observation || '', tags: lead.tags || [], consultantId: lead.consultantId || '' });
    setStatus(lead.status);
    setCsatStage(lead.csatRequestedStage || 'pos_agendamento');
  }, [lead]);

  const handleWhatsApp = () => { 
    let n = lead.whatsapp.replace(/\D/g, ''); 
    if(n.length <= 11) n='55'+n; 
    window.open(`https://wa.me/${n}?text=Ol%C3%A1%20${encodeURIComponent(lead.name)}`); 
  };
  
  const handleSendCsat = async () => {
    if (!lead.whatsapp) {
      alert('Este lead não possui WhatsApp cadastrado.');
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
      alert('Erro ao gerar e enviar o link de CSAT.');
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
    if (isReadOnly) { alert('Você não tem permissão para editar este lead.'); return; }
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
    if (isReadOnly) { alert('Você não tem permissão para alterar este lead.'); return; }
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
    if (isReadOnly) { alert('Você não tem permissão para alterar este lead.'); return; }
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
    if (isReadOnly) { alert('Você não tem permissão para registrar interações neste lead.'); return; }
    if (!note.trim() && status === lead.status && !enableFollowUp) return;
    if (enableFollowUp && !followUpDate) {
      alert("Por favor, selecione a data e o horário do agendamento no calendário.");
      return;
    }
    setLoading(true);
    try {
      let actionText = '';
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
        type: status !== lead.status ? 'status_change' : 'note',
        createdAt: serverTimestamp()
      });

      const up = { status };
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
      alert("Erro ao gravar agendamento.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 left-0 md:left-64 z-[100] bg-[#eaedf2] dark:bg-neutral-950 flex flex-col md:flex-row overflow-hidden animate-fade-in shadow-[-20px_0_40px_rgba(0,0,0,0.1)]">
        
        {/* RIGHT ACTION BUTTONS */}
        <div className="absolute right-6 top-6 z-50 flex gap-3">
          {!isEditing && !isReadOnly && <button onClick={()=>setIsEditing(true)} title="Editar Cadastro" className="p-3 bg-white dark:bg-neutral-800 text-blue-500 hover:bg-blue-600 hover:text-white dark:hover:text-white rounded-full transition-all shadow-xl active:scale-90"><Pencil className="w-5 h-5"/></button>}
          {isAdminUser(appUser) && <button onClick={handleDelete} title="Excluir Permanentemente" className="p-3 bg-white dark:bg-neutral-800 text-red-500 hover:bg-red-600 hover:text-white rounded-full transition-all shadow-xl active:scale-90"><Trash className="w-5 h-5"/></button>}
          <button onClick={onClose} title="Fechar Detalhes" className="p-3 bg-white dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white dark:text-white rounded-full transition-all shadow-xl active:scale-90"><X className="w-5 h-5" /></button>
        </div>

        {/* LEFT COLUMN: Lead Info & Actions */}
        <div className="w-full md:w-[450px] lg:w-[480px] shrink-0 p-6 md:p-8 border-r border-gray-200 dark:border-neutral-800 overflow-y-auto bg-white dark:bg-neutral-900 relative z-10 custom-scrollbar">
           {isEditing ? (
             <div className="space-y-6 animate-fade-in mt-12 md:mt-0">
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
                   <div>
                     <label className="text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1.5 block">Fase do Funil</label>
                     <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-transparent p-3 text-sm rounded-xl text-gray-900 dark:text-white outline-none border border-gray-300 dark:border-neutral-700 focus:border-blue-500 transition-all appearance-none font-semibold shadow-sm">
                       {(statuses || []).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
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
function SettingsView({ db, statuses, sources, usersList, appUser, tags, lossReasons, leads }) {
  const [activeTab, setActiveTab] = useState('users');
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div className="flex bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-1.5 rounded-2xl overflow-x-auto scrollbar-hide shadow-xl">
        <button onClick={()=>setActiveTab('users')} className={`flex-1 px-6 py-4 text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${activeTab==='users'?'bg-gray-100 dark:bg-neutral-800 text-blue-500 shadow-2xl':'text-gray-400 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-white dark:text-white'}`}>Consultores</button>
        <button onClick={()=>setActiveTab('transfer')} className={`flex-1 px-6 py-4 text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${activeTab==='transfer'?'bg-gray-100 dark:bg-neutral-800 text-blue-500 shadow-2xl':'text-gray-400 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-white dark:text-white'}`}>Migrar Leads</button>
        <button onClick={()=>setActiveTab('statuses')} className={`flex-1 px-6 py-4 text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${activeTab==='statuses'?'bg-gray-100 dark:bg-neutral-800 text-blue-500 shadow-2xl':'text-gray-400 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-white dark:text-white'}`}>Funil Pipeline</button>
        <button onClick={()=>setActiveTab('tags')} className={`flex-1 px-6 py-4 text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${activeTab==='tags'?'bg-gray-100 dark:bg-neutral-800 text-blue-500 shadow-2xl':'text-gray-400 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-white dark:text-white'}`}>Etiquetas</button>
        <button onClick={()=>setActiveTab('sources')} className={`flex-1 px-6 py-4 text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${activeTab==='sources'?'bg-gray-100 dark:bg-neutral-800 text-blue-500 shadow-2xl':'text-gray-400 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-white dark:text-white'}`}>Origens</button>
        <button onClick={()=>setActiveTab('lossReasons')} className={`flex-1 px-6 py-4 text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${activeTab==='lossReasons'?'bg-gray-100 dark:bg-neutral-800 text-blue-500 shadow-2xl':'text-gray-400 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-white dark:text-white'}`}>Motivos Perda</button>
      </div>
      {activeTab === 'users' && <ManageUsersTab db={db} appUser={appUser} />}
      {activeTab === 'statuses' && <ManageStatusesTab db={db} statuses={statuses} />}
      {activeTab === 'sources' && <ManageSourcesTab db={db} sources={sources} />}
      {activeTab === 'transfer' && <TransferLeadsTab db={db} usersList={usersList} appUser={appUser} leads={leads} />}
      {activeTab === 'tags' && <ManageTagsTab db={db} tags={tags} />}
      {activeTab === 'lossReasons' && <ManageLossReasonsTab db={db} lossReasons={lossReasons} />}
    </div>
  );
}

function ManageUsersTab({ db, appUser }) {
  const [users, setUsers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', authUid: '', password: '' });
  const [loadingCleanup, setLoadingCleanup] = useState(false);
  const [loadingSecuritySync, setLoadingSecuritySync] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [loadingDocIdMigration, setLoadingDocIdMigration] = useState(false);

  useEffect(() => {
    return onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', USERS_PATH),
      snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [db]);

  const resetForm = () => {
    setForm({ name: '', email: '', authUid: '', password: '' });
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

  const openEditForm = (user) => {
    setEditingUser(user);
    setForm({
      name: user.name || '',
      email: user.email || '',
      authUid: user.authUid || '',
      password: ''
    });
    setShowAdd(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const add = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      alert('Preencha nome, e-mail e senha temporária.');
      return;
    }
    if (!appUser?.authUid) {
      alert('Sessão master sem authUid. Reentre no sistema.');
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
        alert(data.error || 'Erro ao cadastrar consultor.');
        return;
      }

      alert(
        `Consultor cadastrado.\n\nE-mail: ${normalizeEmail(form.email)}\nSenha temporária: ${form.password}\n\nEntregue essas credenciais ao consultor.`
      );
      resetForm();
      setShowAdd(false);
    } catch (err) {
      console.error(err);
      alert('Falha de rede ao cadastrar consultor.');
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
          password: deleteField()
        }
      );

      if (form.password.trim()) {
        const targetUid = normalizeUid(form.authUid) || editingUser.authUid;
        if (!targetUid) {
          alert('Cadastro sem authUid. Não é possível redefinir senha.');
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
            alert(data.error || 'Erro ao redefinir senha.');
            return;
          }
          alert(`Senha redefinida.\n\nNova senha: ${form.password}`);
        }
      }

      setEditingUser(null);
      resetForm();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar alterações.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  const delUser = async (user) => {
    const target = typeof user === 'object' ? user : (users || []).find(u => u.id === user);
    if (!target) return;
    if (!window.confirm("⚠️ EXCLUIR ACESSO? Apaga a conta no Auth e o cadastro interno. Essa ação é irreversível.")) return;
    if (!appUser?.authUid) {
      alert('Sessão master sem authUid. Reentre no sistema.');
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
        alert(data.error || 'Erro ao excluir consultor.');
        return;
      }
      setEditingUser(null);
    } catch (err) {
      console.error(err);
      alert('Falha de rede ao excluir consultor.');
    }
  };

  const migrateUserDocIds = async () => {
    if (!window.confirm('Migrar IDs dos documentos de usuários para coincidir com authUid? (Necessário para Firestore Rules.)')) return;
    setLoadingDocIdMigration(true);
    try {
      const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', USERS_PATH));
      let migrated = 0;
      let skipped = 0;
      for (const d of snap.docs) {
        const data = d.data();
        const targetUid = data?.authUid;
        if (!targetUid) { skipped += 1; continue; }
        if (d.id === targetUid) { continue; }
        const targetRef = doc(db, 'artifacts', appId, 'public', 'data', USERS_PATH, targetUid);
        const existing = await getDoc(targetRef);
        if (existing.exists()) {
          await deleteDoc(d.ref);
          continue;
        }
        await setDoc(targetRef, data);
        await deleteDoc(d.ref);
        migrated += 1;
      }
      alert(`Migração concluída. Migrados: ${migrated} | Pulados (sem authUid): ${skipped}`);
    } catch (err) {
      console.error(err);
      alert('Erro durante migração.');
    } finally {
      setLoadingDocIdMigration(false);
    }
  };

  const sanitizeLegacyPasswords = async () => {
    if (!window.confirm('Remover todas as senhas legadas salvas no Firestore?')) return;

    setLoadingCleanup(true);

    try {
      const snap = await getDocs(
        collection(db, 'artifacts', appId, 'public', 'data', USERS_PATH)
      );

      const batch = writeBatch(db);
      let count = 0;

      snap.forEach((userDoc) => {
        const data = userDoc.data();
        if (Object.prototype.hasOwnProperty.call(data, 'password')) {
          batch.update(
            doc(db, 'artifacts', appId, 'public', 'data', USERS_PATH, userDoc.id),
            { password: deleteField() }
          );
          count += 1;
        }
      });

      if (count > 0) {
        await batch.commit();
      }

      alert(`Saneamento concluído. ${count} registro(s) limpo(s).`);
    } catch (err) {
      console.error(err);
      alert('Erro ao remover senhas legadas.');
    }

    setLoadingCleanup(false);
  };

  const commitOpsInChunks = async (ops, chunkSize = 400) => {
  for (let i = 0; i < ops.length; i += chunkSize) {
    const chunk = ops.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    chunk.forEach(op => {
      batch.update(op.ref, op.data);
    });

    await batch.commit();
  }
};

const backfillSecurityFields = async () => {
  if (!window.confirm('Sincronizar consultantAuthUid nos leads e leadConsultantAuthUid nas interações?')) return;

  setLoadingSecuritySync(true);

  try {
    const usersById = {};
    (users || []).forEach(user => {
      usersById[user.id] = user;
    });

    const leadsSnap = await getDocs(
      collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH)
    );

    const leadsMap = {};
    const leadOps = [];

    leadsSnap.forEach((leadDoc) => {
      const lead = leadDoc.data();
      const owner = usersById[lead.consultantId];
      const targetAuthUid = owner?.authUid || lead.consultantAuthUid || null;

      leadsMap[leadDoc.id] = {
        id: leadDoc.id,
        ...lead,
        consultantAuthUid: targetAuthUid
      };

      if ((lead.consultantAuthUid || null) !== (targetAuthUid || null)) {
        leadOps.push({
          ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, leadDoc.id),
          data: {
            consultantAuthUid: targetAuthUid
          }
        });
      }
    });

    const interactionsSnap = await getDocs(
      collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH)
    );

    const interactionOps = [];

    interactionsSnap.forEach((interactionDoc) => {
      const item = interactionDoc.data();
      if (!item.leadId) return;

      const lead = leadsMap[item.leadId];
      if (!lead) return;

      const patch = {};

      if ((item.leadConsultantId || null) !== (lead.consultantId || null)) {
        patch.leadConsultantId = lead.consultantId || null;
      }

      if ((item.leadConsultantAuthUid || null) !== (lead.consultantAuthUid || null)) {
        patch.leadConsultantAuthUid = lead.consultantAuthUid || null;
      }

      if (Object.keys(patch).length > 0) {
        interactionOps.push({
          ref: doc(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH, interactionDoc.id),
          data: patch
        });
      }
    });

    await commitOpsInChunks(leadOps);
    await commitOpsInChunks(interactionOps);

    alert(`Sincronização concluída. Leads: ${leadOps.length} | Interações: ${interactionOps.length}`);
  } catch (err) {
    console.error(err);
    alert('Erro ao sincronizar campos de segurança.');
  }

  setLoadingSecuritySync(false);
};

  return (
    <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-10 shadow-2xl animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight leading-none">
            Equipa STRONIX
          </h3>
          <p className="text-xs font-medium text-gray-500 dark:text-neutral-400 mt-2">
            Cadastro interno vinculado ao Firebase Auth
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
  type="button"
  onClick={sanitizeLegacyPasswords}
  disabled={loadingCleanup}
  className="bg-gray-100 dark:bg-neutral-800 text-gray-800 dark:text-neutral-200 px-6 py-3 rounded-xl text-xs font-semibold shadow-xl active:scale-95 transition-all disabled:opacity-50"
>
  {loadingCleanup ? 'LIMPANDO...' : 'SANEAR LEGADO'}
</button>

<button
  type="button"
  onClick={backfillSecurityFields}
  disabled={loadingSecuritySync}
  className="bg-blue-500 text-white px-6 py-3 rounded-xl text-xs font-semibold shadow-xl active:scale-95 transition-all disabled:opacity-50"
>
  {loadingSecuritySync ? 'SINCRONIZANDO...' : 'SINCRONIZAR SEGURANÇA'}
</button>

<button
  type="button"
  onClick={migrateUserDocIds}
  disabled={loadingDocIdMigration}
  className="bg-amber-500 text-white px-6 py-3 rounded-xl text-xs font-semibold shadow-xl active:scale-95 transition-all disabled:opacity-50"
  title="Migra docId dos usuários para igualar ao authUid (necessário para Firestore Rules)"
>
  {loadingDocIdMigration ? 'MIGRANDO...' : 'MIGRAR DOC IDS'}
</button>

<button
  type="button"
  onClick={openNewForm}
  className="bg-blue-600 text-white px-8 py-3 rounded-xl text-xs font-semibold shadow-xl shadow-blue-600/20 active:scale-95 transition-all"
>
  {showAdd ? 'EDITANDO' : 'NOVO CONSULTOR'}
</button>
        </div>
      </div>

      <div className="mb-10 bg-blue-500/10 border border-blue-500/20 rounded-xl p-5">
        <p className="text-[11px] font-semibold text-blue-300 uppercase  mb-2">
          Novo modelo de acesso
        </p>
        <p className="text-sm text-gray-700 dark:text-neutral-300 leading-6 font-medium">
          O login do CRM agora acontece no Firebase Authentication. O documento interno do consultor
          serve para permissões e vínculo operacional. O campo <span className="text-gray-900 dark:text-white font-bold">authUid</span> conecta o usuário interno ao acesso real.
        </p>
      </div>

      {(showAdd || editingUser) && (
        <form
          onSubmit={editingUser ? update : add}
          className="bg-[#eaedf2] dark:bg-neutral-950 p-8 rounded-xl border border-gray-200 dark:border-neutral-800 animate-fade-in mb-10 space-y-6 shadow-inner"
        >
          <div className="flex justify-between items-center border-b border-gray-200 dark:border-neutral-800 pb-4 mb-2">
            <h4 className="text-[10px] font-semibold text-blue-600 ">
              {editingUser ? `Editando: ${editingUser.name}` : 'Novo Cadastro'}
            </h4>

            {editingUser && editingUser.role !== 'admin' && (
              <button
                type="button"
                onClick={() => delUser(editingUser.id)}
                className="text-[10px] font-semibold text-red-500  flex items-center gap-1 hover:text-red-400 transition-colors"
              >
                <Trash className="w-3 h-3" />
                Excluir Consultor
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-[9px] font-semibold text-gray-600 dark:text-neutral-400 uppercase mb-2 block tracking-widest">
                Nome do Consultor
              </label>
              <input
                placeholder="Ex: Maria Vendas"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full bg-white dark:bg-neutral-900 p-4 rounded-xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-[9px] font-semibold text-gray-600 dark:text-neutral-400 uppercase mb-2 block tracking-widest">
                E-mail de Login
              </label>
              <input
                type="email"
                placeholder="maria@stronix.com"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full bg-white dark:bg-neutral-900 p-4 rounded-xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-[9px] font-semibold text-gray-600 dark:text-neutral-400 uppercase mb-2 block tracking-widest">
                {editingUser ? 'Auth UID' : 'Senha temporária'}
              </label>
              {editingUser ? (
                <input
                  type="text"
                  placeholder="Auth UID (somente leitura)"
                  value={form.authUid}
                  readOnly
                  className="w-full bg-gray-100 dark:bg-neutral-800 p-4 rounded-xl text-gray-500 dark:text-neutral-400 outline-none border border-gray-200 dark:border-neutral-800 text-xs font-bold"
                />
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Mín. 6 caracteres"
                    required
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="flex-1 bg-white dark:bg-neutral-900 p-4 rounded-xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 text-xs font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, password: generatePassword() })}
                    className="bg-blue-600 text-white px-3 rounded-xl text-[10px] font-bold shadow-xl active:scale-95 transition-all"
                  >
                    GERAR
                  </button>
                </div>
              )}
            </div>
          </div>

          {editingUser && (
            <div>
              <label className="text-[9px] font-semibold text-gray-600 dark:text-neutral-400 uppercase mb-2 block tracking-widest">
                Nova senha (opcional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Deixe em branco para não alterar"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="flex-1 bg-white dark:bg-neutral-900 p-4 rounded-xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 text-xs font-bold"
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, password: generatePassword() })}
                  className="bg-blue-600 text-white px-3 rounded-xl text-[10px] font-bold shadow-xl active:scale-95 transition-all"
                >
                  GERAR
                </button>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
            <p className="text-[10px] font-semibold text-gray-400 dark:text-neutral-500  mb-2">
              Observação operacional
            </p>
            <p className="text-xs text-gray-500 dark:text-neutral-400 font-medium leading-6">
              {editingUser
                ? <>Para redefinir a senha, preencha o campo acima. O <span className="text-gray-900 dark:text-white font-bold">authUid</span> é gerado automaticamente no cadastro e não pode ser alterado.</>
                : <>O cadastro cria a conta no Firebase Auth e o registro interno em uma única operação. Anote a senha temporária para entregar ao consultor.</>
              }
            </p>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => {
                setEditingUser(null);
                setShowAdd(false);
                resetForm();
              }}
              className="flex-1 py-4 bg-gray-100 dark:bg-neutral-800 rounded-xl font-semibold text-[10px]  transition-all hover:bg-gray-200 dark:hover:bg-neutral-700 dark:bg-neutral-700"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loadingSubmit}
              className="flex-[2] bg-blue-600 text-white py-4 rounded-xl font-semibold uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/10 active:scale-95 transition-all disabled:opacity-50"
            >
              {loadingSubmit ? 'PROCESSANDO...' : editingUser ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR NOVO'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {(users || []).map(u => (
          <div
            key={u.id}
            className="flex justify-between items-center bg-[#eaedf2] dark:bg-neutral-950 p-5 rounded-xl border border-gray-200 dark:border-neutral-800 hover:border-gray-300 dark:border-neutral-700 transition-all shadow-lg group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-lg shadow-xl shadow-blue-600/10">
                {(u.name || 'C')[0]}
              </div>

              <div>
                <p className="text-base font-semibold text-gray-900 dark:text-white leading-none tracking-tight">
                  {u.name}
                  {u.role === 'admin' && (
                    <Shield className="w-3.5 h-3.5 inline ml-2 text-blue-500" />
                  )}
                </p>

                <p className="text-[10px] text-gray-600 dark:text-neutral-400 font-bold  mt-1.5">
                  {u.email}
                </p>

                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[9px] font-semibold  ${
                      isAuthLinked(u)
                        ? 'bg-green-500/10 text-green-300'
                        : 'bg-red-500/10 text-red-300'
                    }`}
                  >
                    {isAuthLinked(u) ? 'Vinculado ao Auth' : 'Sem vínculo'}
                  </span>

                  <span className="px-2.5 py-1 rounded-full text-[9px] font-semibold  bg-white dark:bg-neutral-900 text-gray-500 dark:text-neutral-400 border border-gray-200 dark:border-neutral-800">
                    UID: {shortUid(u.authUid)}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right flex items-center gap-4">
              <button
                onClick={() => openEditForm(u)}
                className="p-3 bg-gray-100 dark:bg-neutral-800 text-blue-400 hover:bg-blue-600 hover:text-gray-900 dark:hover:text-white dark:text-white rounded-xl active:scale-90 transition-all"
              >
                <Pencil className="w-4 h-4" />
              </button>

              {u.role !== 'admin' && (
                <button
                  onClick={() => delUser(u.id)}
                  className="p-3 bg-gray-100 dark:bg-neutral-800 text-red-400 hover:bg-red-600 hover:text-gray-900 dark:hover:text-white dark:text-white rounded-xl transition-all shadow-xl active:scale-90"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ManageStatusesTab({ db, statuses }) {
  const [name, setName] = useState(''); const [color, setColor] = useState('blue');
  const add = async (e) => { e.preventDefault(); await addDoc(collection(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH), { name, color, order: statuses.length }); setName(''); };
  const drop = async (dragIdx, dropIdx) => { if(dragIdx===dropIdx) return; const arr=[...statuses]; const [item]=arr.splice(dragIdx,1); arr.splice(dropIdx,0,item); await Promise.all(arr.map((s,i)=>setDoc(doc(db,'artifacts',appId,'public', 'data', STATUSES_PATH,s.id),{order:i},{merge:true}))); };
  return (
    <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-10 shadow-2xl animate-fade-in"><h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-10 tracking-tight leading-none">Pipeline Comercial</h3><form onSubmit={add} className="flex flex-col md:flex-row gap-4 mb-12 bg-[#eaedf2] dark:bg-neutral-950 p-6 rounded-xl border border-gray-200 dark:border-neutral-800"><input placeholder="ETAPA..." required value={name} onChange={e=>setName(e.target.value)} className="flex-1 bg-white dark:bg-neutral-900 p-4 rounded-xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 text-sm font-semibold"/><select value={color} onChange={e=>setColor(e.target.value)} className="bg-white dark:bg-neutral-900 p-4 rounded-xl text-gray-900 dark:text-white border border-gray-200 dark:border-neutral-800 text-xs font-semibold uppercase"><option value="blue">AZUL-CYAN</option><option value="green">VERDE-EMERALD</option><option value="yellow">AMARELO-GOLD</option><option value="purple">ROXO-INDIGO</option><option value="red">VERMELHO-ROSE</option><option value="orange">LARANJA-VIVO</option></select><button className="bg-blue-600 text-white px-10 py-4 rounded-xl font-semibold uppercase text-[10px]  shadow-xl shadow-blue-600/20 active:scale-95">ADICIONAR</button></form>
    <div className="space-y-4">{(statuses || []).map((s,i)=><div key={s.id} draggable onDragStart={e=>e.dataTransfer.setData('idx',i)} onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e.dataTransfer.getData('idx'),i)} className="bg-[#eaedf2] dark:bg-neutral-950 p-5 rounded-xl border border-gray-200 dark:border-neutral-800 flex justify-between items-center group cursor-grab hover:border-blue-600 shadow-xl transition-all"><div className="flex items-center gap-5"><GripVertical className="text-gray-800 dark:text-neutral-200 group-hover:text-blue-600 transition-colors" /><StatusBadge statusName={s.name} statusesArray={statuses}/></div><button onClick={async ()=>{if(window.confirm('Excluir?')) await deleteDoc(doc(db,'artifacts',appId,'public','data',STATUSES_PATH,s.id))}} className="text-gray-800 dark:text-neutral-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-3 bg-white dark:bg-neutral-900 rounded-xl active:scale-90"><Trash2 className="w-4 h-4"/></button></div>)}</div></div>
  );
}

function ManageSourcesTab({ db, sources }) {
  const [name, setName] = useState('');
  const add = async (e) => { e.preventDefault(); await addDoc(collection(db, 'artifacts', appId, 'public', 'data', SOURCES_PATH), { name, createdAt: serverTimestamp() }); setName(''); };
  return (
    <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-10 shadow-2xl animate-fade-in"><h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-10 tracking-tight leading-none">Fontes de Alunos</h3><form onSubmit={add} className="flex gap-4 mb-10 bg-[#eaedf2] dark:bg-neutral-950 p-6 rounded-xl border border-gray-200 dark:border-neutral-800"><input placeholder="EX: TIKTOK, FACEBOOK ADS..." required value={name} onChange={e=>setName(e.target.value)} className="flex-1 bg-white dark:bg-neutral-900 p-4 rounded-xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 text-sm font-semibold"/><button className="bg-blue-600 text-white px-10 py-4 rounded-xl font-semibold uppercase text-[10px] tracking-widest shadow-xl active:scale-95">SALVAR FONTE</button></form>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{(sources || []).map(s=><div key={s.id} className="bg-[#eaedf2] dark:bg-neutral-950 p-5 rounded-xl border border-gray-200 dark:border-neutral-800 flex justify-between items-center group shadow-xl hover:border-gray-300 dark:border-neutral-700 transition-all"><span className="text-xs font-semibold text-gray-900 dark:text-white ">{s.name}</span><button onClick={async ()=>{if(window.confirm('Excluir?')) await deleteDoc(doc(db,'artifacts',appId,'public','data',SOURCES_PATH,s.id))}} className="text-gray-800 dark:text-neutral-200 hover:text-red-500 p-2 bg-white dark:bg-neutral-900 rounded-lg transition-colors active:scale-90"><Trash2 className="w-4 h-4"/></button></div>)}</div></div>
  );
}

function ManageTagsTab({ db, tags }) {
  const [name, setName] = useState(''); const [color, setColor] = useState('blue');
  const add = async (e) => { e.preventDefault(); await addDoc(collection(db, 'artifacts', appId, 'public', 'data', TAGS_PATH), { name, color }); setName(''); };
  return (
    <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-10 shadow-2xl animate-fade-in">
      <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-10 tracking-tight leading-none">Gestão de Etiquetas</h3>
      <form onSubmit={add} className="flex flex-col md:flex-row gap-4 mb-12 bg-[#eaedf2] dark:bg-neutral-950 p-6 rounded-xl border border-gray-200 dark:border-neutral-800">
        <input placeholder="ETIQUETA (EX: VIP)..." required value={name} onChange={e=>setName(e.target.value)} className="flex-1 bg-white dark:bg-neutral-900 p-4 rounded-xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 text-sm font-semibold"/>
        <select value={color} onChange={e=>setColor(e.target.value)} className="bg-white dark:bg-neutral-900 p-4 rounded-xl text-gray-900 dark:text-white border border-gray-200 dark:border-neutral-800 text-xs font-semibold uppercase">
          <option value="blue">AZUL-CYAN</option><option value="green">VERDE-ESMERALDA</option><option value="yellow">AMARELO-OURO</option><option value="purple">ROXO-INDIGO</option><option value="red">VERMELHO-ROSA</option><option value="orange">LARANJA-VIVO</option>
        </select>
        <button className="bg-blue-600 text-white px-10 py-4 rounded-xl font-semibold uppercase text-[10px]  shadow-xl active:scale-95">CRIAR</button>
      </form>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4"> {(tags || []).map(t => ( <div key={t.id} className="bg-[#eaedf2] dark:bg-neutral-950 p-5 rounded-xl border border-gray-200 dark:border-neutral-800 flex justify-between items-center shadow-lg"><TagBadge tagName={t.name} tagsArray={tags} /><button onClick={async ()=>{if(window.confirm('EXCLUIR?')) await deleteDoc(doc(db,'artifacts',appId,'public','data',TAGS_PATH,t.id))}} className="text-gray-800 dark:text-neutral-200 hover:text-red-500 transition-colors active:scale-90"><Trash2 className="w-4 h-4" /></button></div> ))} </div>
    </div>
  );
}

function ManageLossReasonsTab({ db, lossReasons }) {
  const [name, setName] = useState('');
  const add = async (e) => { e.preventDefault(); await addDoc(collection(db, 'artifacts', appId, 'public', 'data', LOSS_REASONS_PATH), { name, createdAt: serverTimestamp() }); setName(''); };
  return (
    <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-10 shadow-2xl animate-fade-in">
      <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-10 tracking-tight leading-none">Motivos de Perda</h3>
      <form onSubmit={add} className="flex gap-4 mb-10 bg-[#eaedf2] dark:bg-neutral-950 p-6 rounded-xl border border-gray-200 dark:border-neutral-800">
        <input placeholder="EX: ACHOU CARO, LONGE DE CASA..." required value={name} onChange={e=>setName(e.target.value)} className="flex-1 bg-white dark:bg-neutral-900 p-4 rounded-xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 text-sm font-semibold"/>
        <button className="bg-red-500 hover:bg-red-600 text-white px-10 py-4 rounded-xl font-semibold uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">SALVAR MOTIVO</button>
      </form>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(lossReasons || []).map(r => (
          <div key={r.id} className="bg-[#eaedf2] dark:bg-neutral-950 p-5 rounded-xl border border-red-500/20 flex justify-between items-center shadow-xl">
            <span className="text-xs font-semibold text-red-400 ">{r.name}</span>
            <button onClick={async ()=>{if(window.confirm('Excluir motivo?')) await deleteDoc(doc(db,'artifacts',appId,'public','data',LOSS_REASONS_PATH,r.id))}} className="text-gray-800 dark:text-neutral-200 hover:text-red-500 p-2 bg-white dark:bg-neutral-900 rounded-lg transition-colors active:scale-90"><Trash2 className="w-4 h-4"/></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TransferLeadsTab({ db, usersList, appUser, leads }) {
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

const commitOpsInChunks = async (ops, chunkSize = 400) => {
  for (let i = 0; i < ops.length; i += chunkSize) {
    const chunk = ops.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    chunk.forEach(op => {
      batch.update(op.ref, op.data);
    });

    await batch.commit();
  }
};

const handleTransfer = async () => {
  if (!fromUser || !toUser) return alert("Selecione os consultores.");
  if (fromUser === toUser) return alert("Origem e Destino são os mesmos.");
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

    await commitOpsInChunks(leadOps);

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

      await commitOpsInChunks(interactionOps);
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

    alert(`Feito! ${count} leads migrados.`);
    setFromUser('');
    setToUser('');
  } catch (err) {
    console.error(err);
    alert("Erro.");
  }

  setLoading(false);
};

  return (
    <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-12 max-w-3xl mx-auto shadow-2xl animate-fade-in">
      <div className="flex items-center gap-5 mb-10"><div className="bg-blue-500/10 p-4 rounded-xl"><ArrowRightLeft className="w-10 h-10 text-blue-500" /></div><div><h3 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight leading-none uppercase">Migração em Massa</h3><p className="text-gray-400 dark:text-neutral-500 text-[11px] font-bold  mt-2">Transfira carteiras completas</p></div></div>
      <div className="space-y-8">
        <div><label className="text-sm font-semibold text-gray-600 dark:text-neutral-400 mb-3 block">De (Consultor Antigo)</label><select value={fromUser} onChange={e=>setFromUser(e.target.value)} className="w-full bg-[#eaedf2] dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5 text-gray-900 dark:text-white outline-none focus:border-blue-500 font-bold appearance-none shadow-inner"><option value="">Selecione o consultor...</option>{(allFromConsultants || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
        <div className="flex justify-center"><RefreshCw className="w-8 h-8 text-gray-800 dark:text-neutral-200 animate-spin-slow" /></div>
        <div><label className="text-sm font-semibold text-gray-600 dark:text-neutral-400 mb-3 block">Para (Consultor Novo)</label><select value={toUser} onChange={e=>setToUser(e.target.value)} className="w-full bg-[#eaedf2] dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5 text-gray-900 dark:text-white outline-none focus:border-green-500 font-bold appearance-none shadow-inner"><option value="">Selecione o consultor...</option>{(usersList || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
        <button onClick={handleTransfer} disabled={loading} className="w-full bg-white dark:bg-neutral-900 text-gray-900 dark:text-white hover:bg-neutral-200 font-semibold py-5 rounded-2xl transition-all shadow-xl uppercase  text-[10px] disabled:opacity-50 active:scale-95">EXECUTAR MUDANÇA</button>
      </div>
    </div>
  );
}

// ==========================================
// DAILY GOAL VIEW (META DIÁRIA)
// ==========================================
function DailyGoalView({ leads, interactions, appUser, statuses, db, tags, lossReasons, usersList }) {
  const [selectedLead, setSelectedLead] = useState(null);

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

  const pending24h = pending.filter(l => l.categories.includes('Novo Lead 24h'));
  const pendingAtrasados = pending.filter(l => l.categories.includes('Atrasado'));
  const pendingVisitas = pending.filter(l => l.categories.includes('Visita Hoje'));
  const pendingAulas = pending.filter(l => l.categories.includes('Aula Experimental Hoje'));

  const renderPendingCard = (lead) => (
    <div key={lead.id} onClick={() => setSelectedLead(lead)} className="bg-[#eaedf2] dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 p-4 rounded-2xl flex flex-col gap-2 cursor-pointer hover:border-blue-500 transition-all shadow-sm group">
      <div className="flex justify-between items-start gap-4">
        <span className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">{lead.name}</span>
      </div>
      <span className="text-xs font-bold text-gray-500 dark:text-neutral-400">{lead.whatsapp}</span>
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
            {pending.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-neutral-500">
                <CheckCircle className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-xs font-bold uppercase tracking-widest">Tudo zerado!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {pendingAtrasados.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-3 border-b border-red-500/20 pb-1">Follow-ups Atrasados</h4>
                    <div className="space-y-3">{pendingAtrasados.map(renderPendingCard)}</div>
                  </div>
                )}
                {pendingVisitas.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-purple-500 uppercase tracking-widest mb-3 border-b border-purple-500/20 pb-1">Visitas Hoje</h4>
                    <div className="space-y-3">{pendingVisitas.map(renderPendingCard)}</div>
                  </div>
                )}
                {pendingAulas.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-3 border-b border-orange-500/20 pb-1">Aulas Exp. Hoje</h4>
                    <div className="space-y-3">{pendingAulas.map(renderPendingCard)}</div>
                  </div>
                )}
                {pending24h.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-3 border-b border-blue-500/20 pb-1">Novos Leads 24h</h4>
                    <div className="space-y-3">{pending24h.map(renderPendingCard)}</div>
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
        />
      )}
    </div>
  );
}