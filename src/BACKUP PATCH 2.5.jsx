import React, { useState, useEffect, useMemo, useRef } from 'react'; import { 
  LayoutDashboard, Users, Search, Plus, Calendar, 
  MessageCircle, CheckCircle, Clock, LogOut, 
  Activity, Phone, User, X, Shield, Lock, Mail, ScanFace,
  Trash2, Menu, Bell, AlertCircle, Pencil, Trash, 
  ExternalLink, GripVertical, ChevronRight, ArrowRightLeft, 
  RefreshCw, FileText, Settings, Kanban, Filter, Check, BarChart3,
  Trophy, ThumbsDown, Tag, Download
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, getDoc, setDoc, addDoc, serverTimestamp, getDocs, deleteDoc, writeBatch, query, where, updateDoc } from 'firebase/firestore';

// --- INICIALIZAÇÃO FIREBASE (OFICIAL STRONIX) ---
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
  yellow: "from-yellow-600 to-orange-400",
  red: "from-red-600 to-pink-500",
  purple: "from-purple-600 to-indigo-500",
  orange: "from-orange-600 to-amber-500",
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
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-10 shadow-2xl">
        <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-3">
          STRONIX
        </h1>
        <p className="text-neutral-400 text-sm font-bold uppercase tracking-widest mb-8">
          Pesquisa de satisfação do atendimento
        </p>

        {loading && (
          <p className="text-neutral-500 font-bold">Carregando...</p>
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
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5">
              <p className="text-white font-black text-lg">{leadName}</p>
              <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mt-2">
                Avaliação do atendimento comercial ({stageLabel})
              </p>
            </div>

            <div>
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-3">
                Sua nota
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setScore(n)}
                    className={`py-4 rounded-xl font-black text-lg transition-all border ${
                      score === n
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-3">
                Comentário
              </label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl p-4 h-28 text-white outline-none"
                placeholder="Comentário opcional sobre o atendimento"
              />
            </div>

            <button
              onClick={handleSubmit}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl uppercase tracking-[0.2em] text-[10px]"
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
      
      if (currentUser && currentUser.displayName) {
        try {
          const userSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', USERS_PATH, currentUser.displayName));
          if (userSnap.exists()) {
            setAppUser({ id: userSnap.id, ...userSnap.data() });
          }
        } catch (e) {
          console.error("Erro ao recuperar sessão do usuário", e);
        }
      }
      setIsAuthChecking(false);
    });

    signInAnonymously(auth).catch(err => {
      setIsAuthChecking(false);
      if (err.code === 'auth/operation-not-allowed') setAuthSetupError("Ative o login Anônimo no Firebase.");
    });
    
    return () => unsubscribe();
  }, []);

  // 2. Leitura de Dados
  useEffect(() => {
    if (!firebaseUser || !appUser) return;
    setLoadingData(true);
    
    const unsubLeads = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH), (snapshot) => {
      const leadsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id, 
          ...data, 
          createdAt: getSafeDate(data.createdAt),
          nextFollowUp: getSafeDateOrNull(data.nextFollowUp)
        };
      });
      // BLINDAGEM MASTER: Só o admin vê todos os leads.
      setLeads(leadsData.filter(l => appUser?.email === 'johnnycbittencourt@gmail.com' || l.consultantId === appUser.id));
      setLoadingData(false);
    });

    const unsubInteractions = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), (snapshot) => {
      setInteractions(snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data, createdAt: getSafeDate(data.createdAt) };
      }));
    });

    const unsubSources = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', SOURCES_PATH), (snapshot) => {
      setSources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubStatuses = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', STATUSES_PATH), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
      setStatuses(data);
    });

    const unsubTags = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', TAGS_PATH), (snapshot) => {
      setTags(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', USERS_PATH), (snapshot) => {
      setUsersList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubLossReasons = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', LOSS_REASONS_PATH), (snapshot) => {
      setLossReasons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubLeads(); unsubInteractions(); unsubSources(); unsubStatuses(); unsubUsers(); unsubTags(); unsubLossReasons(); };
  }, [firebaseUser, appUser]);

  const handleLogout = async () => { 
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: "" });
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
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
        <Activity className="w-12 h-12 text-orange-500 mb-4 animate-pulse" />
        <p className="text-neutral-500 text-sm font-bold uppercase tracking-widest">Carregando Sessão...</p>
      </div>
    );
  }

  if (!appUser) return <LoginScreen setAppUser={setAppUser} firebaseUser={firebaseUser} db={db} authSetupError={authSetupError} />;

  return (
    <div className="flex h-[100dvh] bg-neutral-900 text-neutral-100 selection:bg-orange-500 selection:text-white overflow-hidden" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, sans-serif' }}>
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 md:w-64 bg-neutral-950 border-r border-neutral-800 flex flex-col transition-transform duration-300 ease-in-out transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        <div className="p-6 flex items-center justify-between md:justify-start gap-3">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-orange-500" />
            <h1 className="text-xl font-bold tracking-wider text-white uppercase">STRONIX</h1>
          </div>
          <button className="md:hidden text-neutral-400 hover:text-white p-2" onClick={() => setIsMobileMenuOpen(false)}><X className="w-6 h-6" /></button>
        </div>
        
        <div className="px-6 pb-4 mb-4 border-b border-neutral-800">
          <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1 font-semibold">{appUser?.email === 'johnnycbittencourt@gmail.com' ? 'Acesso Master' : 'Consultor'}</p>
          <div className="flex items-center gap-2">
            {appUser?.email === 'johnnycbittencourt@gmail.com' ? <Shield className="w-4 h-4 text-orange-500 shrink-0" /> : <User className="w-4 h-4 text-blue-500 shrink-0" />}
            <p className="font-semibold truncate text-orange-400">{appUser.name}</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          <SidebarItem icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard Geral" active={activeTab === 'dashboard'} onClick={() => changeTab('dashboard')} />
          <SidebarItem icon={<Kanban className="w-5 h-5" />} label="Quadro Kanban" active={activeTab === 'kanban'} onClick={() => changeTab('kanban')} />
          <SidebarItem icon={<Users className="w-5 h-5" />} label="Todos os Leads" active={activeTab === 'leads'} onClick={() => changeTab('leads')} />
          {appUser?.email === 'johnnycbittencourt@gmail.com' && <SidebarItem icon={<Settings className="w-5 h-5" />} label="Configurações" active={activeTab === 'settings'} onClick={() => changeTab('settings')} />}
        </nav>

        <div className="p-4 border-t border-neutral-800 space-y-2 pb-8 md:pb-4">
          <BiometricSetupButton appUser={appUser} setAppUser={setAppUser} db={db} />
          <button onClick={handleLogout} className="flex items-center gap-3 text-neutral-400 hover:text-red-400 bg-neutral-900/50 hover:bg-neutral-900 rounded-xl transition-all w-full px-4 py-3 font-medium text-sm">
            <LogOut className="w-5 h-5" /><span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-16 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-md flex items-center px-4 md:px-8 z-10 shrink-0">
          <button className="md:hidden mr-4 text-neutral-400 hover:text-white p-1" onClick={() => setIsMobileMenuOpen(true)}><Menu className="w-6 h-6" /></button>
          <h2 className="text-xl font-bold text-white capitalize truncate">
            {activeTab === 'dashboard' && 'Visão Geral'}
            {activeTab === 'kanban' && 'Pipeline de Vendas'}
            {activeTab === 'leads' && 'Gestão de Leads'}
            {activeTab === 'settings' && 'Configurações'}
          </h2>
        </header>
        
        <div className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 relative custom-scrollbar">
          {loadingData ? (
             <div className="flex h-full items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>
          ) : (
            <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto w-full h-full transition-all duration-300">
              {activeTab === 'dashboard' && <DashboardView leads={leads} changeTab={changeTab} appUser={appUser} usersList={usersList} />}
              {activeTab === 'kanban' && <KanbanView leads={leads} interactions={interactions} appUser={appUser} statuses={statuses} usersList={usersList} tags={tags} lossReasons={lossReasons} db={db} />}
              {activeTab === 'leads' && <LeadsView leads={leads} interactions={interactions} appUser={appUser} sources={sources} statuses={statuses} usersList={usersList} tags={tags} lossReasons={lossReasons} db={db} />}
              {activeTab === 'settings' && appUser?.email === 'johnnycbittencourt@gmail.com' && <SettingsView sources={sources} statuses={statuses} db={db} usersList={usersList} appUser={appUser} tags={tags} lossReasons={lossReasons} />}
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
    <button onClick={handleRegisterBiometrics} disabled={isRegistering} className="flex items-center gap-3 text-orange-400 hover:text-white bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 rounded-xl transition-all w-full px-4 py-3 font-medium text-sm disabled:opacity-50">
      <ScanFace className="w-5 h-5 shrink-0" /><span>{isRegistering ? 'Aguardando...' : 'Ativar Face ID'}</span>
    </button>
  );
}

function LoginScreen({ setAppUser, firebaseUser, db, authSetupError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault(); setError('');
    if (!firebaseUser) return setError('Conectando ao Firebase...');
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      // JOHNNY ADMIN RECOVERY LOGIC
      if (normalizedEmail === 'johnnycbittencourt@gmail.com' && password === '123456') {
        const snap = await getDocs(query(collection(db, 'artifacts', appId, 'public', 'data', USERS_PATH), where("email", "==", normalizedEmail)));
        let userObj;
        if (!snap.empty) {
          const userDoc = snap.docs[0];
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', USERS_PATH, userDoc.id), { role: 'admin' });
          userObj = { id: userDoc.id, ...userDoc.data(), role: 'admin' };
        } else {
          const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', USERS_PATH), { name: 'Johnny Master', email: normalizedEmail, password: '123456', role: 'admin', createdAt: serverTimestamp() });
          userObj = { id: docRef.id, name: 'Johnny Master', email: normalizedEmail, role: 'admin' };
        }
        await updateProfile(auth.currentUser, { displayName: userObj.id });
        setAppUser(userObj);
        setLoading(false);
        return;
      }
      const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', USERS_PATH));
      let found = null;
      snap.forEach(d => { if (d.data().email?.toLowerCase() === normalizedEmail && d.data().password === password) found = { id: d.id, ...d.data() }; });
      if (found) {
        await updateProfile(auth.currentUser, { displayName: found.id });
        setAppUser(found);
      } else {
        setError('E-mail ou senha inválidos.');
      }
    } catch (err) { setError('Erro ao conectar com o banco. Verifique as chaves.'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-600 to-yellow-500"></div>
        <div className="flex flex-col items-center mb-8">
          <Activity className="w-12 h-12 text-orange-500 mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tighter uppercase">STRONIX</h1>
          <p className="text-neutral-400 text-sm font-medium uppercase tracking-widest">Painel de Vendas</p>
        </div>
        {authSetupError && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs text-center">{authSetupError}</div>}
        {error && <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm text-center">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" /><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-mail" className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-3.5 pl-12 pr-4 text-white focus:border-orange-500 outline-none font-medium" required /></div>
          <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-3.5 pl-12 pr-4 text-white focus:border-orange-500 outline-none font-medium" required /></div>
          <button type="submit" disabled={loading} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-orange-500/20 uppercase tracking-widest active:scale-95">Entrar</button>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTES AUXILIARES
// ==========================================
function SidebarItem({ icon, label, active, onClick }) {
  return <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-orange-500/10 text-orange-500 font-bold' : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'}`}>{icon} <span className="text-sm tracking-tight">{label}</span></button>;
}

function StatusBadge({ statusName, statusesArray }) {
  if (statusName === 'Venda') return <span className="px-3 py-1 rounded-full text-[9px] font-black text-white uppercase tracking-widest bg-gradient-to-r shadow-lg from-green-600 to-emerald-400">VENDA</span>;
  if (statusName === 'Perda') return <span className="px-3 py-1 rounded-full text-[9px] font-black text-white uppercase tracking-widest bg-gradient-to-r shadow-lg from-red-600 to-pink-500">PERDA</span>;
  const statusObj = (statusesArray || []).find(s => s.name === statusName);
  const color = statusObj?.color || 'gray';
  return (
    <span className={`px-3 py-1 rounded-full text-[9px] font-black text-white uppercase tracking-widest bg-gradient-to-r shadow-lg ${statusGradientMap[color] || statusGradientMap.gray}`}>
      {statusName}
    </span>
  );
}

function TagBadge({ tagName, tagsArray }) {
  const tagObj = (tagsArray || []).find(t => t.name === tagName);
  const color = tagObj?.color || 'gray';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold text-white uppercase tracking-tighter bg-gradient-to-br shadow-sm ${statusGradientMap[color] || statusGradientMap.gray}`}>
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
      <div className="bg-neutral-900 border border-red-500/30 w-full max-w-md rounded-[2rem] p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-2">
          <ThumbsDown className="w-6 h-6 text-red-500" />
          <h3 className="text-xl font-black text-red-500 uppercase tracking-tighter">Sinalizar Perda</h3>
        </div>
        <p className="text-xs text-neutral-400 font-bold mb-6">Por favor, informe o motivo da perda deste lead.</p>
        <select value={reason} onChange={e=>setReason(e.target.value)} className="w-full bg-neutral-950 p-4 rounded-xl text-white outline-none border border-neutral-800 focus:border-red-500 text-xs font-bold mb-6 appearance-none">
           {options.map(r => <option key={r.id || r.name} value={r.name}>{r.name}</option>)}
        </select>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-4 bg-neutral-800 rounded-xl font-black text-[10px] uppercase text-neutral-400 hover:bg-neutral-700 transition-all">Cancelar</button>
          <button onClick={()=>{if(reason) onConfirm(reason); else alert('Selecione um motivo!');}} className="flex-1 py-4 bg-red-600 rounded-xl font-black text-[10px] uppercase text-white shadow-xl shadow-red-500/20 active:scale-95 transition-all">Confirmar Perda</button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// VISÃO GERAL (DASHBOARD) - PATCH 1 (AULA E VISITA)
// ==========================================
function DashboardView({ leads, changeTab, appUser, usersList }) {
  const [periodPreset, setPeriodPreset] = useState('monthly');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

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
        <div className="flex bg-neutral-900 border border-neutral-800 p-1 rounded-xl shadow-2xl">
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
                  ? 'bg-neutral-800 text-orange-400 shadow-xl'
                  : 'text-neutral-500'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {periodPreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 bg-neutral-900 border border-neutral-800 p-3 rounded-xl shadow-2xl">
            <input
              type="date"
              value={customStartDate}
              onChange={e => setCustomStartDate(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-sm text-white outline-none"
            />
            <span className="text-neutral-500 text-sm font-bold">até</span>
            <input
              type="date"
              value={customEndDate}
              onChange={e => setCustomEndDate(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-sm text-white outline-none"
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
          <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-8 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-8 uppercase tracking-widest">
              Funil Comercial
            </h3>

            <div className="space-y-8">
              <FunnelBar
                label="Leads Recebidos"
                count={stats.total}
                max={stats.total}
                color="bg-blue-500"
              />
              <FunnelBar
                label="Agendamentos (Visita)"
                count={stats.agendadosVisita}
                max={stats.total}
                color="bg-yellow-500"
              />
              <FunnelBar
                label="Agendamentos (Aula Exp.)"
                count={stats.agendadosAula}
                max={stats.total}
                color="bg-purple-500"
              />
              <FunnelBar
                label="Matrículas"
                count={stats.convertidos}
                max={stats.total}
                color="bg-green-500"
              />
            </div>
          </div>

          {appUser?.email === 'johnnycbittencourt@gmail.com' && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-8 shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3 uppercase tracking-widest">
                <BarChart3 className="w-6 h-6 text-blue-500" />
                Relatório de Desempenho
              </h3>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b border-neutral-800 text-neutral-500 text-[10px] font-black uppercase tracking-widest">
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
                      <tr key={i} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-all">
                        <td className="py-4 px-4 font-bold text-white flex items-center gap-2">
                          {i === 0 && m.convertidos > 0 && <span className="text-yellow-500">🏆</span>}
                          {m.name}
                        </td>
<td className="py-4 px-4 text-center text-neutral-400 font-bold">{m.total}</td>

<td className="py-4 px-4 text-center">
  <div className="flex flex-col items-center leading-tight">
    <span className="text-yellow-400 font-bold">{m.agendadosVisita}</span>
    <span className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">
      {m.txVisita}%
    </span>
  </div>
</td>

<td className="py-4 px-4 text-center">
  <div className="flex flex-col items-center leading-tight">
    <span className="text-purple-400 font-bold">{m.agendadosAula}</span>
    <span className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">
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
    <span className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">
      {m.txConvVisita}%
    </span>
  </div>
</td>

<td className="py-4 px-4 text-center">
  <div className="flex flex-col items-center leading-tight">
    <span className="text-purple-300 font-bold">{m.convertidosAula}</span>
    <span className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">
      {m.txConvAula}%
    </span>
  </div>
</td>

<td className="py-4 px-4 text-right text-white font-black">
  {m.txConversaoGlobal}%
</td>
                      </tr>
                    ))}

                    {teamMetrics.length === 0 && (
                      <tr>
<td colSpan="8" className="py-6 text-center text-neutral-500 text-xs font-bold uppercase tracking-widest">                          Sem dados no período
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {appUser?.email === 'johnnycbittencourt@gmail.com' && (
  <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-8 shadow-2xl">
    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3 uppercase tracking-widest">
      <CheckCircle className="w-6 h-6 text-blue-500" />
      CSAT por Consultor
    </h3>

    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-left border-collapse min-w-[700px]">
        <thead>
          <tr className="border-b border-neutral-800 text-neutral-500 text-[10px] font-black uppercase tracking-widest">
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
              className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-all"
            >
              <td className="py-4 px-4 font-bold text-white">{m.name}</td>
              <td className="py-4 px-4 text-center text-neutral-400 font-bold">
                {m.totalAvaliacoes}
              </td>
              <td className="py-4 px-4 text-center text-blue-400 font-black">
                {m.media}
              </td>
              <td className="py-4 px-4 text-right text-white font-black">
                {m.pctSatisfeitos}%
              </td>
            </tr>
          ))}

          {consultantSatisfactionMetrics.length === 0 && (
            <tr>
              <td
                colSpan="4"
                className="py-6 text-center text-neutral-500 text-xs font-bold uppercase tracking-widest"
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
          <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-8 flex flex-col max-h-[450px] shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-white flex items-center gap-2 uppercase tracking-widest">
                <Bell className="w-5 h-5 text-orange-500" />
                Tarefas
              </h3>
              <span className="bg-orange-500/10 text-orange-500 text-xs px-2 py-1 rounded-full font-black">
                {pendingFollowUps.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
              {pendingFollowUps.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-2">
                  <CheckCircle className="w-10 h-10 opacity-20" />
                  <p className="text-sm font-medium">Tudo em dia!</p>
                </div>
              ) : (
                pendingFollowUps.map(lead => {
                  const isOverdue = lead.nextFollowUp < new Date();

                  return (
                    <div key={lead.id} className="bg-neutral-950 border border-neutral-800 p-4 rounded-2xl flex justify-between items-start relative overflow-hidden group">
                      <div className={`absolute top-0 left-0 w-1 h-full ${isOverdue ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                      <div className="pl-1">
                        <p className="font-bold text-sm text-neutral-200">{lead.name}</p>
                        <p className="text-[10px] text-neutral-500 font-bold uppercase">{lead.whatsapp}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-[10px] font-black uppercase ${isOverdue ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`}>
                          {isOverdue ? 'Atrasado' : 'Agendado'}
                        </p>
                        <div className="text-[10px] text-neutral-500 mt-1 flex items-center justify-end gap-1 font-bold">
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

          <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-8 shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-500" />
              Canais de Aquisição
            </h3>

            <div className="space-y-5">
              {sourceMetrics.map((s, i) => (
                <div key={i}>
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1.5">
                    <span className="text-neutral-400">{s.name}</span>
                    <span className="text-white">{s.count}</span>
                  </div>
                  <div className="w-full bg-neutral-950 rounded-full h-2.5 overflow-hidden border border-neutral-800">
                    <div
                      className="h-full bg-gradient-to-r from-orange-600 to-amber-400 rounded-full"
                      style={{ width: `${stats.total > 0 ? (s.count / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}

              {sourceMetrics.length === 0 && (
                <p className="text-xs text-neutral-500 font-bold italic py-4">
                  Nenhum dado captado.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon }) {
  return <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[2.5rem] flex items-center justify-between shadow-2xl relative overflow-hidden group hover:border-neutral-700 transition-all"><div><p className="text-neutral-500 text-xs font-black uppercase tracking-widest">{title}</p><p className="text-4xl font-black text-white mt-1">{value}</p><p className="text-[10px] text-neutral-600 font-bold mt-2 uppercase tracking-tighter">{subtitle}</p></div><div className="bg-neutral-950/50 p-5 rounded-2xl border border-neutral-800/50 group-hover:scale-110 transition-transform">{icon}</div></div>;
}

function FunnelBar({ label, count, max, color }) {
  const p = max > 0 ? (count / max) * 100 : 0;
  return <div><div className="flex justify-between text-xs font-black uppercase tracking-widest mb-3"><span className="text-neutral-400">{label}</span><span className="text-white">{count} ({Math.round(p)}%)</span></div><div className="w-full bg-neutral-950 rounded-full h-4 overflow-hidden border border-neutral-800 shadow-inner"><div className={`h-full rounded-full ${color} transition-all duration-1000 shadow-lg`} style={{ width: `${p}%` }} /></div></div>;
}

// ==========================================
// KANBAN VIEW (COM VENDA E PERDA FIXAS)
// ==========================================
function KanbanView({ leads, interactions, appUser, statuses, usersList, tags, lossReasons, db }) {
  const [selectedLead, setSelectedLead] = useState(null);
  const [consultantFilter, setConsultantFilter] = useState('');
  const [lossModalLeadId, setLossModalLeadId] = useState(null);

  const kanbanScrollRef = useRef(null);
const dragScrollRef = useRef({
  isDown: false,
  startX: 0,
  scrollLeft: 0
});
const [isPanning, setIsPanning] = useState(false);

  const kanbanLeads = useMemo(() => {
    return consultantFilter
      ? (leads || []).filter(l => l.consultantId === consultantFilter)
      : (leads || []);
  }, [leads, consultantFilter]);

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

    setLossModalLeadId(leadId);
  };

  const confirmKanbanLoss = async (reason) => {
    if (!lossModalLeadId) return;

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
  };

  const getLeadsByStatus = (statusName) => {
    return (kanbanLeads || [])
      .filter(l => l.status === statusName)
      .sort((a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0));
  };

  const renderLeadCard = (lead) => {
    const isOverdue =
      lead.status !== 'Venda' &&
      lead.status !== 'Perda' &&
      lead.nextFollowUp instanceof Date &&
      !isNaN(lead.nextFollowUp.getTime()) &&
      lead.nextFollowUp < new Date();

    return (
      <div
  key={lead.id}
  data-no-pan="true"
  draggable
  onDragStart={(e) => handleDragStart(e, lead.id)}
  onClick={() => setSelectedLead(lead)}
  className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 cursor-pointer hover:border-orange-500/40 transition-all shadow-xl active:scale-[0.99]"
>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className={`font-black text-sm leading-tight ${isOverdue ? 'text-red-400' : 'text-white'}`}>
              {lead.name}
            </p>
            <p className="text-[10px] text-neutral-500 font-bold uppercase mt-1">
              {lead.whatsapp}
            </p>
          </div>
          <GripVertical className="w-4 h-4 text-neutral-700 shrink-0" />
        </div>

        <div className="flex items-center justify-between gap-2 mb-3">
          <StatusBadge statusName={lead.status} statusesArray={statuses} />
          {lead.consultantName && appUser?.email === 'johnnycbittencourt@gmail.com' && (
            <span className="text-[9px] font-black uppercase tracking-widest text-orange-500/60">
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
          <div className={`mt-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider ${isOverdue ? 'text-red-400' : 'text-yellow-400'}`}>
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
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">
              Quadro Kanban
            </h3>
            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">
              Arraste os leads entre as etapas
            </p>
          </div>

          {appUser?.email === 'johnnycbittencourt@gmail.com' && (
            <div className="w-full md:w-[280px]">
              <select
                value={consultantFilter}
                onChange={(e) => setConsultantFilter(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white outline-none"
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
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, column.name)}
                  className="w-[320px] bg-neutral-900 border border-neutral-800 rounded-[2rem] flex flex-col shadow-2xl"
                >
                  <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StatusBadge statusName={column.name} statusesArray={statuses} />
                    </div>
                    <span className="text-[10px] font-black text-neutral-500 bg-neutral-950 px-2.5 py-1 rounded-full">
                      {columnLeads.length}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {columnLeads.length === 0 ? (
                      <div className="h-24 rounded-2xl border border-dashed border-neutral-800 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-neutral-700">
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
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleWinDrop}
              className="w-[320px] bg-neutral-900 border border-green-500/20 rounded-[2rem] flex flex-col shadow-2xl"
            >
              <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-green-400 font-black uppercase tracking-widest">
                      Venda
                    </p>
                    <p className="text-xs text-neutral-500 font-bold uppercase">
                      Matrículas concluídas
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-black text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full">
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
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleLossDrop}
              className="w-[320px] bg-neutral-900 border border-red-500/20 rounded-[2rem] flex flex-col shadow-2xl"
            >
              <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center">
                    <ThumbsDown className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-red-400 font-black uppercase tracking-widest">
                      Perda
                    </p>
                    <p className="text-xs text-neutral-500 font-bold uppercase">
                      Leads perdidos
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-black text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full">
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
      <div className="flex flex-col md:flex-row gap-4 bg-neutral-900 border border-neutral-800 p-5 rounded-[2rem] shadow-xl">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 group-focus-within:text-orange-500 transition-colors" />
          <input type="text" placeholder="Pesquisar por nome ou telefone..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:border-orange-500 outline-none transition-all font-medium" />
        </div>
        <div className="flex gap-3">
          <button onClick={exportToCSV} title="Exportar para Excel" className="px-5 py-3 rounded-2xl font-bold flex items-center gap-2 bg-neutral-800 text-white border border-neutral-700 hover:bg-neutral-700 transition-all">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={()=>setIsFilterOpen(true)} className={`px-6 py-3 rounded-2xl font-bold flex items-center gap-2 border transition-all ${statusFilters.length > 0 || overdueOnly || consultantFilters.length > 0 ? 'bg-orange-500 text-white border-orange-500' : 'bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700'}`}>
            <Filter className="w-4 h-4" /> Filtros {(statusFilters.length + consultantFilters.length + (overdueOnly?1:0)) > 0 && `(${(statusFilters.length + consultantFilters.length + (overdueOnly?1:0))})`}
          </button>
          <button onClick={()=>setIsAddModalOpen(true)} className="bg-orange-500 hover:bg-orange-600 text-white px-7 py-3 rounded-2xl font-black flex items-center gap-2 shadow-xl active:scale-95 transition-all text-xs uppercase tracking-widest"><Plus className="w-5 h-5" /> Novo Lead</button>
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden flex-1 shadow-2xl">
        <div className="overflow-x-auto h-full scrollbar-hide">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead className="sticky top-0 bg-neutral-900 z-10 border-b border-neutral-800">
              <tr className="text-neutral-500 text-[10px] font-black uppercase tracking-[0.2em]">
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
                  <tr key={l.id} onClick={()=>setSelectedLead(l)} className="border-b border-neutral-800/30 hover:bg-neutral-800/40 cursor-pointer transition-all group">
                    <td className="py-5 px-8">
                      <div className="flex flex-col">
                        <span className={`font-black text-base tracking-tight ${isOverdue ? 'text-red-500' : 'text-neutral-200'}`}>{l.name}</span>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-neutral-500 font-bold flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {l.whatsapp}</span>
                          {appUser?.email === 'johnnycbittencourt@gmail.com' && <span className="text-[10px] font-black text-orange-500/40 uppercase tracking-widest">@{l.consultantName}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-8 text-center"><StatusBadge statusName={l.status} statusesArray={statuses} /></td>
                    <td className="py-5 px-8">
                      {l.nextFollowUp ? (
                        <div className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-wider ${isOverdue ? 'text-red-400' : 'text-yellow-400'}`}>
                          {isOverdue ? <AlertCircle className="w-4 h-4 animate-pulse" /> : <FollowUpIcon type={l.nextFollowUpType} className="w-4 h-4" />}
                          <span>{l.nextFollowUp.toLocaleDateString('pt-BR')} às {l.nextFollowUp.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
                        </div>
                      ) : <span className="text-neutral-700 text-[10px] font-bold italic uppercase tracking-widest">Sem agendamento</span>}
                    </td>
                    <td className="py-5 px-8 text-right text-neutral-600 text-[10px] font-black uppercase tracking-widest">{l.createdAt?.toLocaleDateString('pt-BR') || ""}</td>
                  </tr>
                );
              })}
              {filteredLeads.length === 0 && (
                <tr><td colSpan="4" className="py-10 text-center text-neutral-500 font-bold uppercase tracking-widest text-xs">Nenhum lead encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isFilterOpen && (
        <div className="fixed inset-0 z-[120] overflow-hidden flex justify-end animate-fade-in">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={()=>setIsFilterOpen(false)} />
          <div className="relative w-full max-w-sm bg-neutral-950 shadow-[0_0_50px_rgba(0,0,0,0.5)] border-l border-neutral-800 p-8 flex flex-col h-full animate-slide-in-right">
            
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-wider">Filtros</h3>
                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Otimize sua visão</p>
              </div>
              <button onClick={()=>setIsFilterOpen(false)} className="p-2 text-neutral-400 hover:text-white bg-neutral-900 rounded-xl transition-all shadow-xl active:scale-90"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 space-y-8 overflow-y-auto pr-2 custom-scrollbar">
              <section>
                <p className="text-[10px] uppercase tracking-[0.2em] font-black text-orange-500 mb-4 flex items-center gap-2"><Clock className="w-3 h-3" /> Situação Operacional</p>
                <button onClick={()=>setOverdueOnly(!overdueOnly)} className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${overdueOnly ? 'bg-red-500/10 border-red-500/50 text-red-400' : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:bg-neutral-800'}`}>
                  <span className="font-black text-xs uppercase tracking-widest">Em Atraso</span>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 ${overdueOnly ? 'bg-red-500 border-red-500 text-white' : 'border-neutral-700'}`}>{overdueOnly && <Check className="w-3 h-3 font-black" />}</div>
                </button>
              </section>

              {appUser?.email === 'johnnycbittencourt@gmail.com' && (
                <section>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-black text-orange-500 mb-4 flex items-center gap-2"><Users className="w-3 h-3" /> Consultores</p>
                  <div className="grid grid-cols-1 gap-2">
                    {(usersList || []).map(u => (
                      <button key={u.id} onClick={()=>toggleConsultant(u.id)} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${consultantFilters.includes(u.id) ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:bg-neutral-800'}`}>
                        <span className="text-[10px] font-black uppercase tracking-widest">{u.name}</span>
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 ${consultantFilters.includes(u.id) ? 'bg-blue-500 border-blue-500 text-white' : 'border-neutral-700'}`}>{consultantFilters.includes(u.id) && <Check className="w-3 h-3" />}</div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <p className="text-[10px] uppercase tracking-[0.2em] font-black text-orange-500 mb-4 flex items-center gap-2"><Tag className="w-3 h-3" /> Fase do Funil</p>
                <div className="grid grid-cols-1 gap-2">
                  {allStatuses.map(s => (
                    <button key={s} onClick={()=>toggleStatus(s)} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${statusFilters.includes(s) ? 'bg-orange-500/10 border-orange-500/50 text-orange-400' : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:bg-neutral-800'}`}>
                      <span className="text-[10px] font-black uppercase tracking-widest">{s}</span>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 ${statusFilters.includes(s) ? 'bg-orange-500 border-orange-500 text-white' : 'border-neutral-700'}`}>{statusFilters.includes(s) && <Check className="w-3 h-3" />}</div>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <div className="pt-6 mt-4 border-t border-neutral-800 grid grid-cols-2 gap-3">
              <button onClick={()=>{setStatusFilters([]); setOverdueOnly(false); setConsultantFilters([]);}} className="py-3 rounded-xl text-neutral-500 font-black hover:bg-neutral-900 transition-all text-[10px] uppercase tracking-[0.2em]">Limpar</button>
              <button onClick={()=>setIsFilterOpen(false)} className="py-3 rounded-xl bg-orange-500 text-white font-black shadow-xl text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all">Aplicar</button>
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
    consultantId: appUser.id,
    consultantName: appUser.name,
    createdAt: serverTimestamp(),
    nextFollowUp: null,
    nextFollowUpType: null,
    appointmentType: null,
    appointmentScheduledFor: null
  }
);    
      if (formData.observation.trim()) {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), { 
          leadId: leadRef.id, consultantName: appUser.name, text: `OBSERVAÇÃO DO CADASTRO: ${formData.observation}`, type: 'note', createdAt: serverTimestamp()
        });
      }
      onClose(); 
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[130] p-4"><div className="bg-neutral-900 border border-neutral-800 w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.6)] animate-fade-in"><div className="p-8 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50"><h3 className="text-2xl font-black text-white uppercase tracking-tighter">Novo Registro de Lead</h3><button onClick={onClose} className="p-2 bg-neutral-800 text-neutral-500 hover:text-white rounded-full transition-all active:scale-90"><X className="w-5 h-5"/></button></div><form onSubmit={handleSubmit} className="p-10 space-y-6"><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-[10px] font-black uppercase text-neutral-500 mb-2 tracking-widest">Nome do Aluno</label><input type="text" required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full bg-neutral-950 p-4 rounded-2xl text-white outline-none border border-neutral-800 focus:border-orange-500 font-bold transition-all" placeholder="Nome Completo" /></div><div><label className="block text-[10px] font-black uppercase text-neutral-500 mb-2 tracking-widest">WhatsApp</label><input type="tel" required value={formData.whatsapp} onChange={e=>setFormData({...formData, whatsapp: e.target.value})} className="w-full bg-neutral-950 p-4 rounded-2xl text-white outline-none border border-neutral-800 focus:border-orange-500 font-bold transition-all" placeholder="(00) 00000-0000" /></div><div><label className="block text-[10px] font-black uppercase text-neutral-500 mb-2 tracking-widest">Origem do Lead</label><select value={formData.source} onChange={e=>setFormData({...formData, source: e.target.value})} className="w-full bg-neutral-950 p-4 rounded-2xl text-white outline-none border border-neutral-800 focus:border-orange-500 font-bold transition-all appearance-none">{(sources || []).map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</select></div><div><label className="block text-[10px] font-black uppercase text-neutral-500 mb-2 tracking-widest">Fase Inicial</label><select value={formData.status} onChange={e=>setFormData({...formData, status: e.target.value})} className="w-full bg-neutral-950 p-4 rounded-2xl text-white outline-none border border-neutral-800 focus:border-orange-500 font-bold transition-all appearance-none">{(statuses || []).map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</select></div></div><div><label className="block text-[10px] font-black uppercase text-neutral-500 mb-2 tracking-widest">Etiquetas</label><div className="flex flex-wrap gap-2 mt-2">{(tags || []).map(t => ( <button type="button" key={t.id} onClick={() => setFormData(prev => ({...prev, tags: prev.tags.includes(t.name) ? prev.tags.filter(x=>x!==t.name) : [...prev.tags, t.name]}))} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${formData.tags.includes(t.name) ? 'bg-orange-500 border-orange-500 text-white' : 'bg-neutral-800 border-neutral-700 text-neutral-500'}`}>{t.name}</button> ))}</div></div><div className="w-full"><label className="block text-[10px] font-black uppercase text-neutral-500 mb-2 tracking-widest">Observação Adicional</label><textarea value={formData.observation} onChange={e=>setFormData({...formData, observation: e.target.value})} className="w-full bg-neutral-950 p-5 rounded-2xl text-white outline-none border border-neutral-800 focus:border-orange-500 font-medium resize-none h-24" placeholder="Algum detalhe importante para o primeiro atendimento?"></textarea></div><div className="flex justify-end gap-4 pt-4"><button type="button" onClick={onClose} className="px-8 py-4 rounded-2xl text-neutral-500 font-black uppercase text-[10px] hover:bg-neutral-800 tracking-widest transition-all">Cancelar</button><button type="submit" disabled={loading} className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 px-10 py-4 rounded-2xl text-white font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-orange-500/20 active:scale-95 transition-all">{loading ? 'SALVANDO...' : 'CADASTRAR ALUNO'}</button></div></form></div></div>
  );
}

function LeadDetailsModal({ lead, interactions, onClose, appUser, statuses, tags, lossReasons, db }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: lead.name, whatsapp: lead.whatsapp, source: lead.source, observation: lead.observation || '', tags: lead.tags || [] });
  const [note, setNote] = useState('');
  const [status, setStatus] = useState(lead.status);
  const [loading, setLoading] = useState(false);
  const [enableFollowUp, setEnableFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpType, setFollowUpType] = useState('Mensagem');
  
  const [lossModalOpen, setLossModalOpen] = useState(false);

  const [csatStage, setCsatStage] = useState(
  lead.csatRequestedStage || 'pos_agendamento'
);
const [sendingCsat, setSendingCsat] = useState(false);

  useEffect(() => {
    setEditData({ name: lead.name, whatsapp: lead.whatsapp, source: lead.source, observation: lead.observation || '', tags: lead.tags || [] });
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
    const confirmSend = window.confirm(
      'Este lead ainda não está em Venda. Deseja mesmo enviar o CSAT de pós-matrícula?'
    );
    if (!confirmSend) return;
  }

  setSendingCsat(true);

  try {
    const token = bufferToBase64url(generateRandomBuffer(24));
    const csatUrl = buildCsatUrl(token);

    await setDoc(
      doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
      {
        csatToken: token,
        csatStatus: 'pending',
        csatRequestedAt: serverTimestamp(),
        csatRequestedStage: csatStage,
        csatLinkSentById: appUser.id,
        csatLinkSentByName: appUser.name
      },
      { merge: true }
    );

    const stageLabel =
      csatStage === 'cliente_novo' ? 'pós-matrícula' : 'pós-agendamento';

    await addDoc(
      collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH),
      {
        leadId: lead.id,
        consultantName: appUser.name,
        text: `Link de CSAT enviado (${stageLabel}).`,
        type: 'note',
        createdAt: serverTimestamp()
      }
    );

    let n = lead.whatsapp.replace(/\D/g, '');
    if (n.length <= 11) n = '55' + n;

    const message =
      `Olá, ${lead.name}! ` +
      `Aqui é da STRONIX. ` +
      `Queremos avaliar seu atendimento comercial (${stageLabel}). ` +
      `Sua resposta leva menos de 1 minuto:\n\n${csatUrl}`;

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
    setLoading(true);
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), editData);
      setIsEditing(false);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // Botão 🏆 MATRICULAR (Venda Direta)
  const handleWin = async () => {
    if (window.confirm("Confirmar matrícula deste lead?")) {
      setLoading(true);
await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), {
  status: 'Venda',
  nextFollowUp: null,
  isConverted: true,
  convertedAt: serverTimestamp()
});      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), { leadId: lead.id, consultantName: appUser.name, text: `Matrícula realizada com sucesso! (Venda)`, type: 'status_change', createdAt: serverTimestamp() });
      setLoading(false);
      setStatus('Venda');
    }
  };

  // Botão ❌ PERDA (Confirmado via Modal)
  const confirmLoss = async (reason) => {
    setLoading(true);
await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), {
  status: 'Perda',
  lossReason: reason,
  nextFollowUp: null,
  lostAt: serverTimestamp()
});    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), { leadId: lead.id, consultantName: appUser.name, text: `Lead perdido. Motivo: ${reason}`, type: 'status_change', createdAt: serverTimestamp() });
    setLossModalOpen(false);
    setLoading(false);
    setStatus('Perda');
  };

  const saveInteraction = async () => {
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

    await addDoc(
      collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH),
      {
        leadId: lead.id,
        consultantName: appUser.name,
        text: actionText || 'Atualização registrada.',
        type: status !== lead.status ? 'status_change' : 'note',
        createdAt: serverTimestamp()
      }
    );

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

    await setDoc(
      doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
      up,
      { merge: true }
    );

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
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[110] p-4 animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-6xl h-[95vh] rounded-[3rem] flex flex-col md:flex-row overflow-hidden relative shadow-2xl border-orange-500/10">
        
        <div className="absolute right-8 top-8 z-30 flex gap-3">
          {!isEditing && <button onClick={()=>setIsEditing(true)} title="Editar Cadastro" className="p-3 bg-neutral-800 text-blue-400 hover:bg-blue-600 hover:text-white rounded-full transition-all shadow-xl active:scale-90"><Pencil className="w-5 h-5"/></button>}
          {appUser?.email === 'johnnycbittencourt@gmail.com' && <button onClick={handleDelete} title="Excluir Permanentemente" className="p-3 bg-neutral-800 text-red-400 hover:bg-red-600 hover:text-white rounded-full transition-all shadow-xl active:scale-90"><Trash className="w-5 h-5"/></button>}
          <button onClick={onClose} title="Fechar Detalhes" className="p-3 bg-neutral-800 text-neutral-400 hover:text-white rounded-full transition-all shadow-xl active:scale-90"><X className="w-5 h-5" /></button>
        </div>

        <div className="w-full md:w-5/12 p-12 border-r border-neutral-800 overflow-y-auto bg-neutral-900 shadow-2xl relative z-10 custom-scrollbar">
           {isEditing ? (
             <div className="space-y-6 animate-fade-in">
               <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Editar Cadastro</h3>
               <div><label className="text-[10px] font-black text-neutral-600 uppercase mb-2 block tracking-widest">Nome Completo</label><input type="text" value={editData.name} onChange={e=>setEditData({...editData, name: e.target.value})} className="w-full bg-neutral-950 p-4 rounded-xl text-white outline-none border border-neutral-800 focus:border-blue-500 font-bold" /></div>
               <div><label className="text-[10px] font-black text-neutral-600 uppercase mb-2 block tracking-widest">WhatsApp</label><input type="tel" value={editData.whatsapp} onChange={e=>setEditData({...editData, whatsapp: e.target.value})} className="w-full bg-neutral-950 p-4 rounded-xl text-white outline-none border border-neutral-800 focus:border-blue-500 font-bold" /></div>
               <div><label className="text-[10px] font-black text-neutral-600 uppercase mb-2 block tracking-widest">Origem</label><input type="text" value={editData.source} onChange={e=>setEditData({...editData, source: e.target.value})} className="w-full bg-neutral-950 p-4 rounded-xl text-white outline-none border border-neutral-800 focus:border-blue-500 font-bold" /></div>
               <div><label className="text-[10px] font-black text-neutral-600 uppercase mb-2 block tracking-widest">Etiquetas</label><div className="flex flex-wrap gap-2 mt-2">{(tags || []).map(t => ( <button key={t.id} onClick={() => setEditData(prev => ({...prev, tags: prev.tags.includes(t.name) ? prev.tags.filter(x=>x!==t.name) : [...prev.tags, t.name]}))} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${editData.tags.includes(t.name) ? 'bg-orange-500 border-orange-500 text-white' : 'bg-neutral-800 border-neutral-700 text-neutral-500'}`}>{t.name}</button> ))}</div></div>
               <div><label className="text-[10px] font-black text-neutral-600 uppercase mb-2 block tracking-widest">Observação Fixa (Contexto Inicial)</label><textarea value={editData.observation} onChange={e=>setEditData({...editData, observation: e.target.value})} className="w-full bg-neutral-950 p-4 rounded-xl text-white outline-none border border-neutral-800 focus:border-blue-500 font-medium h-32 resize-none" /></div>
               <div className="flex gap-3"><button onClick={()=>setIsEditing(false)} className="flex-1 py-4 bg-neutral-800 rounded-2xl font-black text-[10px] uppercase">Cancelar</button><button onClick={handleUpdateLead} disabled={loading} className="flex-1 py-4 bg-blue-600 rounded-2xl font-black text-[10px] uppercase shadow-xl shadow-blue-500/20">Gravar Mudanças</button></div>
             </div>
           ) : (
             <div className="animate-fade-in">
               <h2 className="text-4xl font-black text-white mb-2 leading-none tracking-tighter">{lead.name}</h2>
               <div className="flex flex-wrap gap-2 mb-6"> {(lead.tags || []).map(tName => <TagBadge key={tName} tagName={tName} tagsArray={tags} />)} </div>
               
               {lead.status === 'Perda' && lead.lossReason && (
                 <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl mb-6 flex items-center gap-3">
                   <ThumbsDown className="w-5 h-5 text-red-500" />
                   <div><p className="text-[9px] font-black text-red-500 uppercase tracking-widest">Lead Perdido</p><p className="text-sm font-bold text-red-400">{lead.lossReason}</p></div>
                 </div>
               )}

               <div className="bg-orange-500/5 border border-orange-500/10 p-5 rounded-2xl mb-10 shadow-inner">
                  <div className="flex items-center gap-2 mb-3"><FileText className="w-3.5 h-3.5 text-orange-500" /><span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Contexto do Cadastro</span></div>
                  <p className="text-sm text-neutral-300 font-medium leading-relaxed italic">{lead.observation || "Sem observações no cadastro."}</p>
               </div>
               
               <div className="grid grid-cols-3 gap-2 mb-10">
                 <button onClick={handleWin} className="bg-green-500 hover:bg-green-600 text-white p-4 rounded-[1.5rem] text-[9px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-1 shadow-xl shadow-green-500/20 active:scale-95"><Trophy className="w-5 h-5 mb-1"/> Matricular</button>
                 <button onClick={()=>setLossModalOpen(true)} className="bg-red-500 hover:bg-red-600 text-white p-4 rounded-[1.5rem] text-[9px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-1 shadow-xl shadow-red-500/20 active:scale-95"><ThumbsDown className="w-5 h-5 mb-1"/> Perda</button>
                 <button onClick={handleWhatsApp} className="bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-[1.5rem] text-[9px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-1 shadow-xl shadow-blue-500/20 active:scale-95"><MessageCircle className="w-5 h-5 mb-1"/> WhatsApp</button>
               </div>
<div className="bg-neutral-950 p-8 rounded-[2rem] border border-neutral-800 space-y-6 shadow-2xl mb-10">
  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 border-b border-neutral-800 pb-4">
    Enviar CSAT ao Cliente
  </h4>

  <div>
    <label className="text-[10px] font-black text-neutral-600 uppercase mb-2 block tracking-widest">
      Momento da Pesquisa
    </label>

    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => setCsatStage('pos_agendamento')}
        className={`py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
          csatStage === 'pos_agendamento'
            ? 'bg-blue-500 border-blue-500 text-white shadow-xl shadow-blue-500/20'
            : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-600'
        }`}
      >
        Pós-Agendamento
      </button>

      <button
        type="button"
        onClick={() => setCsatStage('cliente_novo')}
        className={`py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
          csatStage === 'cliente_novo'
            ? 'bg-blue-500 border-blue-500 text-white shadow-xl shadow-blue-500/20'
            : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-600'
        }`}
      >
        Pós-Matrícula
      </button>
    </div>
  </div>

  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
    <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">
      Status atual do envio
    </p>
    <p className="text-sm font-bold text-white mt-2">
      {lead.csatStatus === 'answered'
        ? 'Respondido pelo cliente'
        : lead.csatStatus === 'pending'
        ? 'Link enviado e aguardando resposta'
        : 'Nenhum envio realizado ainda'}
    </p>
  </div>

  <button
    type="button"
    onClick={handleSendCsat}
    disabled={sendingCsat}
    className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-black py-5 rounded-2xl shadow-xl uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all"
  >
    {sendingCsat ? 'GERANDO LINK...' : 'ENVIAR CSAT POR WHATSAPP'}
  </button>
</div>
               <div className="bg-neutral-950 p-8 rounded-[2rem] border border-neutral-800 space-y-6 shadow-2xl">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500 border-b border-neutral-800 pb-4">Fazer Nova Nota</h4>
                  <div><label className="text-[10px] font-black text-neutral-600 uppercase mb-2 block tracking-widest">Mudar Fase do Funil</label><select value={status} onChange={e=>setStatus(e.target.value)} className="w-full bg-neutral-900 p-4 rounded-xl text-white outline-none border border-neutral-800 focus:border-orange-500 text-xs font-bold transition-all appearance-none">{(statuses || []).map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
                  <div><label className="text-[10px] font-black text-neutral-600 uppercase mb-2 block tracking-widest">Nota da Atividade</label><textarea value={note} onChange={e=>setNote(e.target.value)} className="w-full bg-neutral-900 p-4 rounded-xl text-white h-28 outline-none border border-neutral-800 focus:border-orange-500 text-xs font-bold resize-none transition-all shadow-inner" placeholder="O que foi conversado hoje?"/></div>
                  <div className="p-5 bg-neutral-900 rounded-[1.5rem] border border-neutral-800 shadow-inner">
  <label className="flex items-center gap-3 text-[11px] font-black text-neutral-400 cursor-pointer uppercase tracking-widest">
    <input
      type="checkbox"
      checked={enableFollowUp}
      onChange={e => setEnableFollowUp(e.target.checked)}
      className="w-5 h-5 rounded-lg border-neutral-700 text-orange-500 bg-neutral-950 focus:ring-0 shadow-lg transition-all"
    />
    Próximo Contato?
  </label>

  {enableFollowUp && (
    <div className="mt-6 space-y-4 animate-fade-in">
      <div className="flex flex-wrap gap-2">
        {['Mensagem', 'Ligação', 'Visita', 'Aula Experimental'].map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setFollowUpType(t)}
            className={`flex-1 min-w-[110px] py-3 px-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
              followUpType === t
                ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/20'
                : 'bg-neutral-950 text-neutral-500 border border-neutral-800 hover:border-neutral-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="relative group bg-neutral-950 rounded-2xl p-4 border border-neutral-800 shadow-inner flex items-center gap-4">
        <Calendar className="w-5 h-5 text-orange-500" />
        <input
          type="datetime-local"
          value={followUpDate}
          onChange={e => setFollowUpDate(e.target.value)}
          className="bg-transparent text-white border-none outline-none font-bold text-xs w-full"
        />
      </div>
    </div>
  )}
</div>
                  <button onClick={saveInteraction} disabled={loading} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-5 rounded-2xl shadow-xl uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all">REGISTRAR ATIVIDADE</button>
               </div>
             </div>
           )}
        </div>

        <div className="w-full md:w-7/12 bg-neutral-950 p-12 overflow-y-auto relative custom-scrollbar">
          <div className="flex flex-col gap-6 mb-12 sticky top-0 bg-neutral-950/95 backdrop-blur-2xl pb-8 border-b border-neutral-900/80 z-20">
            <h3 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-tighter"><Clock className="w-7 h-7 text-orange-500" /> Histórico de Ações</h3>
          </div>
          
          <div className="space-y-10 border-l-2 border-neutral-800 ml-5 pl-10 relative pb-10">
            {interactions.map(i => (
              <div key={i.id} className="relative group animate-fade-in">
                <div className={`absolute -left-[57px] top-0 w-10 h-10 rounded-full border-4 border-neutral-950 flex items-center justify-center shadow-xl ${i.type==='status_change'?'bg-orange-500 text-white':'bg-neutral-800 text-neutral-400'}`}>{i.type==='status_change' ? <RefreshCw className="w-4 h-4"/> : <MessageCircle className="w-4 h-4"/>}</div>
                <div className="flex justify-between items-center mb-3"><p className="text-[11px] font-black text-white uppercase tracking-widest">{i.consultantName}</p><p className="text-[9px] text-neutral-600 font-black uppercase tracking-tighter bg-neutral-900 px-3 py-1 rounded-full border border-neutral-800">{i.createdAt?.toLocaleString('pt-BR')}</p></div>
                <p className="text-neutral-400 text-sm leading-relaxed font-bold bg-neutral-900/30 p-5 rounded-[1.5rem] border border-neutral-800/50 group-hover:border-neutral-700 transition-all">{i.text}</p>
              </div>
            ))}
            <div className="relative animate-fade-in"><div className="absolute -left-[57px] top-0 w-10 h-10 rounded-full bg-green-500 text-white border-4 border-neutral-950 flex items-center justify-center shadow-2xl shadow-green-500/20"><Plus className="w-6 h-6"/></div><p className="text-[11px] font-black text-white uppercase tracking-widest mb-3">Sistema STRONIX</p><p className="text-neutral-500 text-xs font-bold italic px-5 py-3 bg-neutral-900/50 rounded-xl border border-neutral-800/50">Lead registrado oficialmente em {lead.createdAt?.toLocaleDateString('pt-BR') || "data"} às {lead.createdAt?.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) || "hora"}.</p></div>
          </div>
        </div>
      </div>
      {lossModalOpen && <LossReasonModal lossReasons={lossReasons} onClose={()=>setLossModalOpen(false)} onConfirm={confirmLoss} />}
    </div>
  );
}

// ==========================================
// CONFIGURAÇÕES (ADMIN)
// ==========================================
function SettingsView({ db, statuses, sources, usersList, appUser, tags, lossReasons }) {
  const [activeTab, setActiveTab] = useState('users');
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div className="flex bg-neutral-900 border border-neutral-800 p-1.5 rounded-2xl overflow-x-auto scrollbar-hide shadow-xl">
        <button onClick={()=>setActiveTab('users')} className={`flex-1 px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all whitespace-nowrap ${activeTab==='users'?'bg-neutral-800 text-orange-400 shadow-2xl':'text-neutral-500 hover:text-white'}`}>Consultores</button>
        <button onClick={()=>setActiveTab('transfer')} className={`flex-1 px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all whitespace-nowrap ${activeTab==='transfer'?'bg-neutral-800 text-orange-400 shadow-2xl':'text-neutral-500 hover:text-white'}`}>Migrar Leads</button>
        <button onClick={()=>setActiveTab('statuses')} className={`flex-1 px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all whitespace-nowrap ${activeTab==='statuses'?'bg-neutral-800 text-orange-400 shadow-2xl':'text-neutral-500 hover:text-white'}`}>Funil Pipeline</button>
        <button onClick={()=>setActiveTab('tags')} className={`flex-1 px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all whitespace-nowrap ${activeTab==='tags'?'bg-neutral-800 text-orange-400 shadow-2xl':'text-neutral-500 hover:text-white'}`}>Etiquetas</button>
        <button onClick={()=>setActiveTab('sources')} className={`flex-1 px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all whitespace-nowrap ${activeTab==='sources'?'bg-neutral-800 text-orange-400 shadow-2xl':'text-neutral-500 hover:text-white'}`}>Origens</button>
        <button onClick={()=>setActiveTab('lossReasons')} className={`flex-1 px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all whitespace-nowrap ${activeTab==='lossReasons'?'bg-neutral-800 text-orange-400 shadow-2xl':'text-neutral-500 hover:text-white'}`}>Motivos Perda</button>
      </div>
      {activeTab === 'users' && <ManageUsersTab db={db} />}
      {activeTab === 'statuses' && <ManageStatusesTab db={db} statuses={statuses} />}
      {activeTab === 'sources' && <ManageSourcesTab db={db} sources={sources} />}
      {activeTab === 'transfer' && <TransferLeadsTab db={db} usersList={usersList} appUser={appUser} />}
      {activeTab === 'tags' && <ManageTagsTab db={db} tags={tags} />}
      {activeTab === 'lossReasons' && <ManageLossReasonsTab db={db} lossReasons={lossReasons} />}
    </div>
  );
}

function ManageUsersTab({ db }) { 
  const [users, setUsers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ name:'', email:'', password:''});

  useEffect(() => onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', USERS_PATH), snap => setUsers(snap.docs.map(d=>({id:d.id,...d.data()}))) ), [db]);

  const add = async (e) => { 
    e.preventDefault(); 
    if(!form.name) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', USERS_PATH), {...form, role:'consultant', createdAt: serverTimestamp()}); 
    setForm({name:'',email:'',password:''}); setShowAdd(false); 
  };

  const update = async (e) => {
    e.preventDefault();
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', USERS_PATH, editingUser.id), form);
    setEditingUser(null); setForm({name:'',email:'',password:''});
  };

  const delUser = async (id) => { 
    if(window.confirm("⚠️ EXCLUIR ACESSO? O consultor não conseguirá mais entrar no sistema.")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', USERS_PATH, id)); 
      setEditingUser(null);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-[2rem] p-10 shadow-2xl animate-fade-in">
      <div className="flex justify-between items-center mb-10">
        <div><h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">Equipa STRONIX</h3><p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-2">Gestão de acessos autorizados</p></div>
        <button onClick={()=>{setShowAdd(!showAdd); setEditingUser(null); setForm({name:'', email:'', password:''});}} className="bg-orange-500 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-orange-500/20 active:scale-95 transition-all">{showAdd?'CANCELAR':'NOVO CONSULTOR'}</button>
      </div>

      {(showAdd || editingUser) && (
        <form onSubmit={editingUser ? update : add} className="bg-neutral-950 p-8 rounded-[1.5rem] border border-neutral-800 animate-fade-in mb-10 space-y-6 shadow-inner">
          <div className="flex justify-between items-center border-b border-neutral-800 pb-4 mb-2">
            <h4 className="text-[10px] font-black text-orange-500 uppercase tracking-widest">{editingUser ? `Editando: ${editingUser.name}` : 'Novo Cadastro'}</h4>
            {editingUser && editingUser.email !== 'johnnycbittencourt@gmail.com' && <button type="button" onClick={()=>delUser(editingUser.id)} className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1 hover:text-red-400 transition-colors"><Trash className="w-3 h-3"/> Excluir Consultor</button>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><label className="text-[9px] font-black text-neutral-600 uppercase mb-2 block tracking-widest">Nome do Consultor</label><input placeholder="Ex: Maria Vendas" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full bg-neutral-900 p-4 rounded-xl text-white outline-none border border-neutral-800 text-xs font-bold"/></div>
            <div><label className="text-[9px] font-black text-neutral-600 uppercase mb-2 block tracking-widest">E-mail de Login</label><input type="email" placeholder="maria@stronix.com" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="w-full bg-neutral-900 p-4 rounded-xl text-white outline-none border border-neutral-800 text-xs font-bold"/></div>
            <div><label className="text-[9px] font-black text-neutral-600 uppercase mb-2 block tracking-widest">Senha de Acesso</label><input placeholder="Mínimo 6 caracteres" required value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className="w-full bg-neutral-900 p-4 rounded-xl text-white outline-none border border-neutral-800 text-xs font-bold"/></div>
          </div>
          <div className="flex gap-4"><button type="button" onClick={()=>{setEditingUser(null); setShowAdd(false); setForm({name:'', email:'', password:''});}} className="flex-1 py-4 bg-neutral-800 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-neutral-700">Cancelar</button><button type="submit" className="flex-[2] bg-orange-500 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-orange-500/10 active:scale-95 transition-all">{editingUser ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR NOVO'}</button></div>
        </form>
      )}

      <div className="space-y-3">
        {(users || []).map(u=>(
          <div key={u.id} className="flex justify-between items-center bg-neutral-950 p-5 rounded-[1.5rem] border border-neutral-800 hover:border-neutral-700 transition-all shadow-lg group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-500 text-white rounded-full flex items-center justify-center font-black text-lg shadow-xl shadow-orange-500/10">{(u.name || 'C')[0]}</div>
              <div><p className="text-base font-black text-white leading-none tracking-tight">{u.name} {u.email === 'johnnycbittencourt@gmail.com' && <Shield className="w-3.5 h-3.5 inline ml-2 text-orange-400" />}</p><p className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest mt-1.5">{u.email}</p></div>
            </div>
            <div className="text-right flex items-center gap-4 group-hover:translate-x-[-10px] transition-transform">
              <div className="hidden group-hover:flex items-center gap-3">
                <div className="text-right"><p className="text-[9px] font-black text-neutral-700 uppercase mb-1">Senha</p><p className="text-xs font-mono text-orange-400 bg-neutral-900 px-3 py-1 rounded-lg border border-neutral-800">{u.password}</p></div>
                <button onClick={()=>{setEditingUser(u); setForm({name:u.name || '', email:u.email || '', password:u.password || ''}); setShowAdd(false); window.scrollTo({top: 0, behavior: 'smooth'});}} className="p-3 bg-neutral-800 text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl active:scale-90 transition-all"><Pencil className="w-4 h-4" /></button>
                {u.email !== 'johnnycbittencourt@gmail.com' && <button onClick={()=>delUser(u.id)} className="p-3 bg-neutral-800 text-red-400 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-xl active:scale-90"><Trash2 className="w-4 h-4" /></button>}
              </div>
              <ChevronRight className="text-neutral-900 group-hover:text-neutral-700 transition-colors" />
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
    <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-10 shadow-2xl animate-fade-in"><h3 className="text-2xl font-black text-white mb-10 uppercase tracking-tighter leading-none">Pipeline Comercial</h3><form onSubmit={add} className="flex flex-col md:flex-row gap-4 mb-12 bg-neutral-950 p-6 rounded-[1.5rem] border border-neutral-800"><input placeholder="ETAPA..." required value={name} onChange={e=>setName(e.target.value)} className="flex-1 bg-neutral-900 p-4 rounded-xl text-white outline-none border border-neutral-800 text-xs font-black uppercase tracking-widest"/><select value={color} onChange={e=>setColor(e.target.value)} className="bg-neutral-900 p-4 rounded-xl text-white border border-neutral-800 text-xs font-black uppercase"><option value="blue">AZUL-CYAN</option><option value="green">VERDE-EMERALD</option><option value="yellow">AMARELO-GOLD</option><option value="purple">ROXO-INDIGO</option><option value="red">VERMELHO-ROSE</option><option value="orange">LARANJA-VIVO</option></select><button className="bg-orange-500 text-white px-10 py-4 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-orange-500/20 active:scale-95">ADICIONAR</button></form>
    <div className="space-y-4">{(statuses || []).map((s,i)=><div key={s.id} draggable onDragStart={e=>e.dataTransfer.setData('idx',i)} onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e.dataTransfer.getData('idx'),i)} className="bg-neutral-950 p-5 rounded-[1.5rem] border border-neutral-800 flex justify-between items-center group cursor-grab hover:border-orange-500 shadow-xl transition-all"><div className="flex items-center gap-5"><GripVertical className="text-neutral-800 group-hover:text-orange-500 transition-colors" /><StatusBadge statusName={s.name} statusesArray={statuses}/></div><button onClick={async ()=>{if(window.confirm('Excluir?')) await deleteDoc(doc(db,'artifacts',appId,'public','data',STATUSES_PATH,s.id))}} className="text-neutral-800 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-3 bg-neutral-900 rounded-xl active:scale-90"><Trash2 className="w-4 h-4"/></button></div>)}</div></div>
  );
}

function ManageSourcesTab({ db, sources }) {
  const [name, setName] = useState('');
  const add = async (e) => { e.preventDefault(); await addDoc(collection(db, 'artifacts', appId, 'public', 'data', SOURCES_PATH), { name, createdAt: serverTimestamp() }); setName(''); };
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-10 shadow-2xl animate-fade-in"><h3 className="text-2xl font-black text-white mb-10 uppercase tracking-tighter leading-none">Fontes de Alunos</h3><form onSubmit={add} className="flex gap-4 mb-10 bg-neutral-950 p-6 rounded-[1.5rem] border border-neutral-800"><input placeholder="EX: TIKTOK, FACEBOOK ADS..." required value={name} onChange={e=>setName(e.target.value)} className="flex-1 bg-neutral-900 p-4 rounded-xl text-white outline-none border border-neutral-800 text-xs font-black uppercase tracking-widest"/><button className="bg-orange-500 text-white px-10 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95">SALVAR FONTE</button></form>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{(sources || []).map(s=><div key={s.id} className="bg-neutral-950 p-5 rounded-[1.5rem] border border-neutral-800 flex justify-between items-center group shadow-xl hover:border-neutral-700 transition-all"><span className="text-xs font-black text-white uppercase tracking-widest">{s.name}</span><button onClick={async ()=>{if(window.confirm('Excluir?')) await deleteDoc(doc(db,'artifacts',appId,'public','data',SOURCES_PATH,s.id))}} className="text-neutral-800 hover:text-red-500 p-2 bg-neutral-900 rounded-lg transition-colors active:scale-90"><Trash2 className="w-4 h-4"/></button></div>)}</div></div>
  );
}

function ManageTagsTab({ db, tags }) {
  const [name, setName] = useState(''); const [color, setColor] = useState('blue');
  const add = async (e) => { e.preventDefault(); await addDoc(collection(db, 'artifacts', appId, 'public', 'data', TAGS_PATH), { name, color }); setName(''); };
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-10 shadow-2xl animate-fade-in">
      <h3 className="text-2xl font-black text-white mb-10 uppercase tracking-tighter leading-none">Gestão de Etiquetas</h3>
      <form onSubmit={add} className="flex flex-col md:flex-row gap-4 mb-12 bg-neutral-950 p-6 rounded-[1.5rem] border border-neutral-800">
        <input placeholder="ETIQUETA (EX: VIP)..." required value={name} onChange={e=>setName(e.target.value)} className="flex-1 bg-neutral-900 p-4 rounded-xl text-white outline-none border border-neutral-800 text-xs font-black uppercase tracking-widest"/>
        <select value={color} onChange={e=>setColor(e.target.value)} className="bg-neutral-900 p-4 rounded-xl text-white border border-neutral-800 text-xs font-black uppercase">
          <option value="blue">AZUL-CYAN</option><option value="green">VERDE-ESMERALDA</option><option value="yellow">AMARELO-OURO</option><option value="purple">ROXO-INDIGO</option><option value="red">VERMELHO-ROSA</option><option value="orange">LARANJA-VIVO</option>
        </select>
        <button className="bg-orange-500 text-white px-10 py-4 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl active:scale-95">CRIAR</button>
      </form>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4"> {(tags || []).map(t => ( <div key={t.id} className="bg-neutral-950 p-5 rounded-[1.5rem] border border-neutral-800 flex justify-between items-center shadow-lg"><TagBadge tagName={t.name} tagsArray={tags} /><button onClick={async ()=>{if(window.confirm('EXCLUIR?')) await deleteDoc(doc(db,'artifacts',appId,'public','data',TAGS_PATH,t.id))}} className="text-neutral-800 hover:text-red-500 transition-colors active:scale-90"><Trash2 className="w-4 h-4" /></button></div> ))} </div>
    </div>
  );
}

function ManageLossReasonsTab({ db, lossReasons }) {
  const [name, setName] = useState('');
  const add = async (e) => { e.preventDefault(); await addDoc(collection(db, 'artifacts', appId, 'public', 'data', LOSS_REASONS_PATH), { name, createdAt: serverTimestamp() }); setName(''); };
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-10 shadow-2xl animate-fade-in">
      <h3 className="text-2xl font-black text-white mb-10 uppercase tracking-tighter leading-none">Motivos de Perda</h3>
      <form onSubmit={add} className="flex gap-4 mb-10 bg-neutral-950 p-6 rounded-[1.5rem] border border-neutral-800">
        <input placeholder="EX: ACHOU CARO, LONGE DE CASA..." required value={name} onChange={e=>setName(e.target.value)} className="flex-1 bg-neutral-900 p-4 rounded-xl text-white outline-none border border-neutral-800 text-xs font-black uppercase tracking-widest"/>
        <button className="bg-red-500 hover:bg-red-600 text-white px-10 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">SALVAR MOTIVO</button>
      </form>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(lossReasons || []).map(r => (
          <div key={r.id} className="bg-neutral-950 p-5 rounded-[1.5rem] border border-red-500/20 flex justify-between items-center shadow-xl">
            <span className="text-xs font-black text-red-400 uppercase tracking-widest">{r.name}</span>
            <button onClick={async ()=>{if(window.confirm('Excluir motivo?')) await deleteDoc(doc(db,'artifacts',appId,'public','data',LOSS_REASONS_PATH,r.id))}} className="text-neutral-800 hover:text-red-500 p-2 bg-neutral-900 rounded-lg transition-colors active:scale-90"><Trash2 className="w-4 h-4"/></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TransferLeadsTab({ db, usersList, appUser }) {
  const [fromUser, setFromUser] = useState('');
  const [toUser, setToUser] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTransfer = async () => {
    if (!fromUser || !toUser) return alert("Selecione os consultores.");
    if (fromUser === toUser) return alert("Origem e Destino são os mesmos.");
    if (!window.confirm("CONFIRMAR MIGRAÇÃO TOTAL?")) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH), where("consultantId", "==", fromUser));
      const snap = await getDocs(q);
      const targetUser = (usersList || []).find(u => u.id === toUser);
      const batch = writeBatch(db);
      let count = 0;
      snap.forEach(l => { batch.update(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, l.id), { consultantId: toUser, consultantName: targetUser?.name || "Consultor" }); count++; });
      await batch.commit();
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), { text: `MIGRAÇÃO MASTER: ${count} leads movidos para [${targetUser?.name || "Novo Consultor"}].`, consultantName: appUser.name, type: 'note', createdAt: serverTimestamp() });
      alert(`Feito! ${count} leads migrados.`);
      setFromUser(''); setToUser('');
    } catch (err) { alert("Erro."); }
    setLoading(false);
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-12 max-w-3xl mx-auto shadow-2xl animate-fade-in">
      <div className="flex items-center gap-5 mb-10"><div className="bg-blue-500/10 p-4 rounded-[1.5rem]"><ArrowRightLeft className="w-10 h-10 text-blue-500" /></div><div><h3 className="text-2xl font-black text-white tracking-tight leading-none uppercase">Migração em Massa</h3><p className="text-neutral-500 text-[11px] font-bold uppercase tracking-widest mt-2">Transfira carteiras completas</p></div></div>
      <div className="space-y-8">
        <div><label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 mb-3 block">De (Consultor Antigo)</label><select value={fromUser} onChange={e=>setFromUser(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl p-5 text-white outline-none focus:border-blue-500 font-bold appearance-none shadow-inner">{(usersList || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
        <div className="flex justify-center"><RefreshCw className="w-8 h-8 text-neutral-800 animate-spin-slow" /></div>
        <div><label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 mb-3 block">Para (Consultor Novo)</label><select value={toUser} onChange={e=>setToUser(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl p-5 text-white outline-none focus:border-green-500 font-bold appearance-none shadow-inner">{(usersList || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
        <button onClick={handleTransfer} disabled={loading} className="w-full bg-white text-neutral-950 hover:bg-neutral-200 font-black py-5 rounded-2xl transition-all shadow-xl uppercase tracking-[0.3em] text-[10px] disabled:opacity-50 active:scale-95">EXECUTAR MUDANÇA</button>
      </div>
    </div>
  );
}