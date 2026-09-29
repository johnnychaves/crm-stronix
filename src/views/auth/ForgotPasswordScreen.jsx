import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowLeft, KeyRound, Lock, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AuthLayout, AuthTenantChip } from './AuthLayout.jsx';
import { AuthField, AuthInput, AuthPasswordToggle } from './AuthField.jsx';
import { AuthAlert, AuthStatus } from './AuthNotice.jsx';
import { PASSWORD_RULE_TEXT, passwordPolicyError } from '../../lib/passwordPolicy.js';
import {
  RESET_ACTION_REQUEST, RESET_ACTION_CONFIRM, RESET_CODE_TTL_MS, RESET_CODE_MAX_ATTEMPTS,
  CODE_REFUSED_MESSAGE, EMAIL_INVALID_MESSAGE, SAVE_FAILED_MESSAGE, SEND_FAILED_MESSAGE, TOO_MANY_MESSAGE,
  normalizeResetCode, resendWaitSeconds, readResetEntry, readResetMemory, writeResetMemory, clearResetMemory,
  readResetApiError, postResetAction, loginPathFor,
} from '../../lib/passwordReset.js';

const TITLE = 'font-display text-[26px] font-semibold tracking-tight';
const LEAD = 'text-[14px] text-gray-500 dark:text-neutral-400 mt-1.5';
// Enquanto espera a resposta, os botões ficam com aria-disabled e não com
// disabled: no Chrome, o botão focado que vira disabled solta o foco no body, e
// o foco não volta. O clique que chega nesse meio tempo é barrado pelo inFlight,
// dentro do componente. O visual da espera muda numa coisa, de propósito: o
// botão disabled ainda encolhia ao ser apertado (o Chrome aplica :active a ele),
// e o aria-disabled:active:scale-100 faz o botão indisponível não responder ao
// aperto.
const PRIMARY = 'w-full h-12 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[14px] font-semibold inline-flex items-center justify-center gap-2 transition active:scale-[.99] shadow-sm shadow-brand-600/20 aria-disabled:opacity-90 aria-disabled:cursor-default aria-disabled:active:scale-100';
const CODE_TTL_MINUTES = RESET_CODE_TTL_MS / 60000;

// Junta os ids do aria-describedby, sem os vazios.
const describedBy = (...ids) => ids.filter(Boolean).join(' ') || undefined;

// "Esqueci a senha". O passo 1 pede o código por e-mail e o passo 2 troca a
// senha com ele. Desenho em docs/superpowers/specs/2026-09-28-esqueci-a-senha-design.md.
function ForgotPasswordScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  // O login manda o e-mail digitado e a academia no estado da navegação, que
  // sobrevive ao F5. Com um envio de menos de 15 minutos nesta aba, a tela
  // volta direto ao passo 2.
  const [entry] = useState(() => readResetEntry(location.state));
  const [memory] = useState(() => readResetMemory());
  const [step, setStep] = useState(memory ? 'code' : 'email');
  const [email, setEmail] = useState(memory ? memory.email : entry.email);
  const [sentAt, setSentAt] = useState(memory ? memory.sentAt : null);
  const [now, setNow] = useState(Date.now);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  // Um ref por campo, para levar o cursor ao primeiro que estiver com erro. O
  // foco sai direto do manipulador, sem effect: o input já está na tela, porque
  // o passo não muda quando há erro.
  const emailRef = useRef(null);
  const codeRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);
  // Diz se há pedido em andamento. O busy só muda no render seguinte, então dois
  // envios seguidos (dois Enter, dois cliques rápidos) ainda leriam busy falso e
  // mandariam dois pedidos. No passo 1 cada pedido gasta um dos 5 códigos do dia
  // e mata o anterior, e na troca gasta uma tentativa. O ref vale na hora, e o
  // busy fica só para o visual.
  const inFlight = useRef(false);
  const loginPath = loginPathFor(entry.tenant);
  const tenantName = entry.tenant?.displayName;

  // Relógio da contagem de "Mandar outro código". Só anda no passo 2.
  useEffect(() => {
    if (step !== 'code') return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  const waitSeconds = sentAt === null ? 0 : resendWaitSeconds(sentAt, now);

  // O erro de um campo some quando a pessoa mexe nele.
  const clearFieldError = (...keys) => setFieldErrors((current) => {
    if (!keys.some((key) => current[key])) return current;
    const next = { ...current };
    for (const key of keys) delete next[key];
    return next;
  });

  // Pede o código. Serve ao passo 1 e ao "Mandar outro código".
  async function sendCode(target) {
    const r = await postResetAction({ action: RESET_ACTION_REQUEST, email: target });
    if (r.status === 200 && r.body?.ok === true) {
      const at = Date.now();
      writeResetMemory({ email: target, sentAt: at });
      setSentAt(at);
      setNow(at);
      return true;
    }
    const err = readResetApiError(r.status, r.body);
    // No passo 2 não tem campo de e-mail para mostrar o aviso embaixo.
    if (err.status === 400 && step === 'email') {
      setFieldErrors({ email: EMAIL_INVALID_MESSAGE });
      emailRef.current?.focus();
    } else if (err.status === 400) setFormError(EMAIL_INVALID_MESSAGE);
    else if (err.status === 429) setFormError(err.message || TOO_MANY_MESSAGE);
    else if (err.status === 503) setFormError(err.message || SEND_FAILED_MESSAGE);
    else setFormError(SEND_FAILED_MESSAGE);
    return false;
  }

  async function onRequest(e) {
    // O preventDefault vem antes da trava: com aria-disabled, o envio feito na
    // espera (Enter num campo) chega até aqui, e sem ele o navegador faria um
    // GET da página com os campos na URL.
    e.preventDefault();
    if (inFlight.current) return;
    const target = email.trim();
    setFormError('');
    if (!target.includes('@')) {
      setFieldErrors({ email: 'Digite o e-mail que você usa para entrar.' });
      emailRef.current?.focus();
      return;
    }
    setFieldErrors({});
    inFlight.current = true;
    setBusy(true);
    try {
      const ok = await sendCode(target);
      if (!ok) return;
      setEmail(target);
      setCode('');
      setInfo('');
      setStep('code');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function onResend() {
    if (inFlight.current) return;
    setFormError('');
    setInfo('');
    inFlight.current = true;
    setBusy(true);
    try {
      const ok = await sendCode(email);
      if (!ok) return;
      setCode('');
      setFieldErrors({});
      setInfo('Mandamos outro código. Só o último vale.');
      // O campo do código acabou de ser limpo, e é nele que a pessoa digita.
      codeRef.current?.focus();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function onConfirm(e) {
    // Antes da trava, como no onRequest. Aqui o GET levaria a senha nova na URL.
    e.preventDefault();
    if (inFlight.current) return;
    const errors = {};
    if (code.length !== 6) errors.code = 'Digite os 6 números do código.';
    // Com a senha vazia a regra já aparece na dica, logo abaixo do campo, e o
    // erro só a repetiria.
    const problem = password === '' ? 'Digite a senha nova.' : passwordPolicyError(password);
    if (problem) errors.password = problem;
    else if (confirm !== password) errors.confirm = 'As duas senhas não são iguais.';
    setFieldErrors(errors);
    setFormError('');
    setInfo('');
    if (Object.keys(errors).length > 0) {
      // Na ordem da tela: código, senha nova, repetir senha.
      if (errors.code) codeRef.current?.focus();
      else if (errors.password) passwordRef.current?.focus();
      else if (errors.confirm) confirmRef.current?.focus();
      return;
    }

    inFlight.current = true;
    setBusy(true);
    let saved = false;
    try {
      const r = await postResetAction({ action: RESET_ACTION_CONFIRM, email, code, newPassword: password });
      if (r.status === 200 && r.body?.ok === true) {
        saved = true;
        clearResetMemory();
        // Roda mesmo se a pessoa saiu da tela durante a espera, e é de propósito:
        // a senha já mudou, e o login precisa do e-mail e do aviso.
        navigate(loginPath, { replace: true, state: { email, passwordReset: true } });
        return;
      }
      const err = readResetApiError(r.status, r.body);
      if (err.status === 400 && err.passwordIssue) {
        setFieldErrors({ password: err.passwordIssue });
        passwordRef.current?.focus();
      } else if (err.status === 400) {
        setFieldErrors({ code: CODE_REFUSED_MESSAGE });
        codeRef.current?.focus();
      } else if (err.status === 429) setFormError(err.message || TOO_MANY_MESSAGE);
      else setFormError(SAVE_FAILED_MESSAGE);
    } finally {
      // Na saída o busy e o inFlight ficam ligados até a tela sumir: o botão não
      // pisca de volta, e nenhum segundo envio manda outra troca.
      if (!saved) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }

  function onOtherEmail() {
    // Com pedido em andamento o botão só parece travado, e o clique não faz nada.
    if (inFlight.current) return;
    clearResetMemory();
    setStep('email');
    setSentAt(null);
    setCode('');
    setPassword('');
    setConfirm('');
    setFieldErrors({});
    setFormError('');
    setInfo('');
  }

  const header = (title, children) => (
    <div className="mb-7">
      {tenantName && <AuthTenantChip name={tenantName} />}
      <h1 className={TITLE}>{title}</h1>
      {children}
    </div>
  );

  return (
    <AuthLayout>
      {/* As keys separam os dois passos: sem elas o React reaproveitaria o
          input do e-mail no lugar do código, e o autoFocus não rodaria. */}
      {step === 'email' ? (
        <form key="email" onSubmit={onRequest} noValidate>
          {header('Esqueci a senha', (
            <p className={LEAD}>Digite o e-mail que você usa para entrar. Vamos mandar um código para você criar uma senha nova.</p>
          ))}
          <div className="flex flex-col gap-4">
            <AuthField label="E-mail" icon={Mail} error={fieldErrors.email} errorId="esqueci-email-erro">
              <AuthInput
                ref={emailRef}
                name="email"
                type="email"
                autoFocus
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
                placeholder="voce@academia.com.br"
                autoComplete="username"
                aria-invalid={fieldErrors.email ? true : undefined}
                aria-describedby={describedBy(fieldErrors.email && 'esqueci-email-erro')}
              />
            </AuthField>
            <AuthAlert message={formError} />
            <button type="submit" aria-disabled={busy || undefined} className={PRIMARY}>
              {busy ? <><Spinner /> Enviando…</> : 'Enviar código'}
            </button>
          </div>
          <p className="mt-7 text-center text-[12.5px]">
            <Link to={loginPath} className="inline-flex items-center gap-1.5 font-semibold text-brand-600 dark:text-brand-400 hover:underline">
              <ArrowLeft className="size-3.5" /> Voltar para o login
            </Link>
          </p>
        </form>
      ) : (
        <form key="code" onSubmit={onConfirm} noValidate>
          {/* O gerenciador de senhas usa este campo para saber de qual conta é a
              senha nova e salvá-la ligada ao e-mail certo. */}
          <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
          {header('Criar senha nova', (
            <>
              <p id="esqueci-codigo-intro" className={cn(LEAD, 'wrap-anywhere')}>
                Digite o código que mandamos para <strong className="font-semibold text-gray-700 dark:text-neutral-200">{email}</strong>. Ele vale por {CODE_TTL_MINUTES} minutos e aceita até {RESET_CODE_MAX_ATTEMPTS} tentativas.
              </p>
              <p className="mt-2 text-[12.5px] text-gray-500 dark:text-neutral-400">
                Se esse e-mail tiver conta no Stronilead, o código chega em alguns minutos. Confira também o spam.
              </p>
            </>
          ))}
          <div className="flex flex-col gap-4">
            <AuthField label="Código" icon={KeyRound} error={fieldErrors.code} errorId="esqueci-codigo-erro">
              <AuthInput
                ref={codeRef}
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                required
                value={code}
                onChange={(e) => { setCode(normalizeResetCode(e.target.value)); clearFieldError('code'); }}
                placeholder="000000"
                className="font-mono tracking-[0.3em]"
                aria-invalid={fieldErrors.code ? true : undefined}
                aria-describedby={describedBy('esqueci-codigo-intro', fieldErrors.code && 'esqueci-codigo-erro')}
              />
            </AuthField>
            <AuthField
              label="Senha nova"
              icon={Lock}
              hint={PASSWORD_RULE_TEXT}
              hintId="esqueci-senha-regra"
              error={fieldErrors.password}
              errorId="esqueci-senha-erro"
            >
              <AuthInput
                ref={passwordRef}
                name="newPassword"
                type={showPass ? 'text' : 'password'}
                required
                value={password}
                // A igualdade das duas senhas depende desta também, então o erro de repetir sai junto.
                onChange={(e) => { setPassword(e.target.value); clearFieldError('password', 'confirm'); }}
                autoComplete="new-password"
                aria-invalid={fieldErrors.password ? true : undefined}
                aria-describedby={describedBy('esqueci-senha-regra', fieldErrors.password && 'esqueci-senha-erro')}
              />
              <AuthPasswordToggle shown={showPass} onToggle={() => setShowPass((s) => !s)} />
            </AuthField>
            <AuthField label="Repetir senha nova" icon={Lock} error={fieldErrors.confirm} errorId="esqueci-confirma-erro">
              <AuthInput
                ref={confirmRef}
                name="confirmPassword"
                type={showPass ? 'text' : 'password'}
                required
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); clearFieldError('confirm'); }}
                autoComplete="new-password"
                aria-invalid={fieldErrors.confirm ? true : undefined}
                aria-describedby={describedBy(fieldErrors.confirm && 'esqueci-confirma-erro')}
              />
            </AuthField>
            <AuthStatus message={info} />
            <AuthAlert message={formError} />
            <button type="submit" aria-disabled={busy || undefined} className={PRIMARY}>
              {busy ? <><Spinner /> Salvando…</> : 'Salvar senha nova'}
            </button>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[12.5px] font-semibold">
            {/* Durante a contagem o botão está de fato indisponível, por isso disabled.
                Enquanto espera a resposta, só aria-disabled, pelo motivo do PRIMARY. */}
            <button
              type="button"
              onClick={onResend}
              disabled={waitSeconds > 0}
              aria-disabled={busy || undefined}
              className={cn(
                'hover:underline disabled:cursor-default disabled:no-underline aria-disabled:cursor-default aria-disabled:no-underline',
                waitSeconds > 0 ? 'text-gray-500 dark:text-neutral-400' : 'text-brand-600 dark:text-brand-400',
              )}
            >
              {waitSeconds > 0 ? `Mandar outro código em ${waitSeconds}s` : 'Mandar outro código'}
            </button>
            <button
              type="button"
              onClick={onOtherEmail}
              aria-disabled={busy || undefined}
              className="text-gray-700 dark:text-neutral-200 hover:underline aria-disabled:cursor-default aria-disabled:no-underline"
            >
              Usar outro e-mail
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

function Spinner() {
  return <span className="size-4 rounded-full border-2 border-white/40 border-t-white spin" />;
}

export { ForgotPasswordScreen };
