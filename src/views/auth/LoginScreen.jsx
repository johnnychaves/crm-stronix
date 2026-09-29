import { useState, useRef } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail, setPersistence } from 'firebase/auth';
import { auth, persistenceFor } from '../../lib/firebase.js';
import { AlertTriangle, ArrowRight, Check, CheckCircle, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { AuthLayout, AuthTenantChip } from './AuthLayout.jsx';
import { AuthField, AuthInput } from './AuthField.jsx';

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
      // "Manter conectado" grava no mesmo lugar que o getAuth vigia (IndexedDB),
      // senão abrir outra aba derruba esta. Desmarcado, a sessão fica só nesta
      // aba. Falha aqui não bloqueia o login.
      await persistenceFor(remember).then((p) => setPersistence(auth, p)).catch(() => {});
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

  return (
    <AuthLayout>
      <div className="mb-7">
        {urlTenant?.found && <AuthTenantChip name={urlTenant.displayName} />}
        <h1 className="font-display text-[26px] font-semibold tracking-tight">Bem-vindo de volta</h1>
        <p className="text-[14px] text-gray-500 dark:text-neutral-400 mt-1.5">
          {urlTenant?.found
            ? <>Entre para acessar o painel da <span className="font-semibold text-gray-700 dark:text-neutral-200">{urlTenant.displayName}</span>.</>
            : 'Entre para acessar seu painel de vendas.'}
        </p>
        {urlTenant && urlTenant.found === false && (
          <p className="mt-2 text-[12px] text-amber-600 dark:text-amber-400">
            Academia “{urlTenant.slug}” não encontrada. Confira o link. Você ainda pode entrar normalmente.
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
        <AuthField label="E-mail" icon={Mail}>
          <AuthInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@stronilead.com.br" autoComplete="username" required />
        </AuthField>

        <div>
          <AuthField label="Senha" icon={Lock}>
            <AuthInput type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
            <span className="pr-2">
              <button type="button" onClick={() => setShowPass(s => !s)} title={showPass ? 'Ocultar' : 'Mostrar'} className="w-9 h-9 grid place-items-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition">
                {showPass ? <EyeOff className="w-[17px] h-[17px]" /> : <Eye className="w-[17px] h-[17px]" />}
              </button>
            </span>
          </AuthField>
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
    </AuthLayout>
  );
}
export { LoginScreen };
