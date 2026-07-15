import { useState, useRef } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { auth } from '../../lib/firebase.js';
import { AlertTriangle, ArrowRight, Building2, Calendar, Check, CheckCircle, Eye, EyeOff, Lock, Mail, Shield, TrendingUp, Zap } from 'lucide-react';
import { SurgeMark, StronileadWordmark } from '../../components/brand/SurgeMark.jsx';

function LoginScreen({ authSetupError, urlTenant }) {
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
export { LoginScreen };
