import { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { signInWithEmailAndPassword, setPersistence } from 'firebase/auth';
import { auth, persistenceFor } from '../../lib/firebase.js';
import { AlertTriangle, ArrowRight, Check, Lock, Mail } from 'lucide-react';
import { AuthLayout, AuthTenantChip } from './AuthLayout.jsx';
import { AuthField, AuthInput, AuthPasswordToggle } from './AuthField.jsx';
import { AuthAlert, AuthStatus } from './AuthNotice.jsx';
import { RESET_PATH, PASSWORD_SAVED_MESSAGE, readLoginArrival, resetLinkState } from '../../lib/passwordReset.js';

function LoginScreen({ authSetupError, urlTenant }) {
  const location = useLocation();
  const navigate = useNavigate();
  // Quem volta do "Esqueci a senha" chega com o e-mail e o aviso no estado da
  // navegação. O aviso vale uma vez: o estado é limpo logo depois, para o F5
  // não repetir.
  const [arrival] = useState(() => readLoginArrival(location.state));
  // O endereço de quando a tela abriu, guardado aqui e não lido no efeito:
  // limpar o estado troca o location, e um efeito que dependesse dele rodaria
  // de novo.
  const [arrivalLocation] = useState(location);
  const [email, setEmail] = useState(arrival.email);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(arrival.passwordReset ? PASSWORD_SAVED_MESSAGE : '');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const formRef = useRef(null);
  // Trava do efeito: o estado é limpo uma vez só. Sem ela, uma troca de endereço
  // depois disso refaria a limpeza e levaria a pessoa de volta ao endereço da
  // abertura.
  const arrivalCleared = useRef(false);

  useEffect(() => {
    if (!arrival.passwordReset || arrivalCleared.current) return;
    arrivalCleared.current = true;
    // O mesmo endereço, com a query e o hash, só que sem o estado. O replace
    // troca a entrada do histórico em vez de empilhar outra.
    navigate(arrivalLocation, { replace: true, state: null });
  }, [arrival.passwordReset, arrivalLocation, navigate]);

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
    setNotice('');
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

  // O "Esqueci a senha" recebe o e-mail digitado e a academia do endereço.
  const resetState = resetLinkState(email, urlTenant);

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
      <AuthAlert id="login-erro" message={error} className="mb-4" />
      <AuthStatus id="login-aviso" message={notice} className="mb-4" />

      <form ref={formRef} onSubmit={handleLogin} className="space-y-4">
        <AuthField label="E-mail" icon={Mail}>
          <AuthInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@stronilead.com.br" autoComplete="username" required />
        </AuthField>

        <div>
          <AuthField label="Senha" icon={Lock}>
            {/* Quem volta com a senha nova já tem o e-mail preenchido, então o cursor
                vai para a senha, e o leitor de tela lê o aviso junto com o campo. */}
            <AuthInput
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              autoFocus={arrival.passwordReset}
              aria-describedby={notice ? 'login-aviso' : undefined}
              required
            />
            <AuthPasswordToggle shown={showPass} onToggle={() => setShowPass(s => !s)} />
          </AuthField>
          <div className="mt-2.5 flex items-center justify-between">
            <button type="button" onClick={() => setRemember(r => !r)} className="inline-flex items-center gap-2 group">
              <span className={`w-[18px] h-[18px] rounded-[6px] grid place-items-center border transition ${remember ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-300 dark:border-white/20 text-transparent group-hover:border-gray-400'}`}>
                <Check className="w-3 h-3" />
              </span>
              <span className="text-[12.5px] text-gray-600 dark:text-neutral-300 font-medium">Manter conectado</span>
            </button>
            <Link to={RESET_PATH} state={resetState} className="text-[12.5px] font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 hover:underline">
              Esqueci a senha
            </Link>
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
        <Link to={RESET_PATH} state={resetState} className="font-semibold text-gray-700 dark:text-neutral-200 hover:underline">Recuperar acesso</Link>
      </p>
    </AuthLayout>
  );
}
export { LoginScreen };
