import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { AlertTriangle, ArrowLeft, CheckCircle, KeyRound, Lock, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AuthLayout, AuthTenantChip } from './AuthLayout.jsx';
import { AuthField, AuthInput, AuthPasswordToggle } from './AuthField.jsx';
import { PASSWORD_RULE_TEXT, passwordPolicyError } from '../../lib/passwordPolicy.js';
import {
  RESET_ACTION_REQUEST, RESET_ACTION_CONFIRM,
  CODE_REFUSED_MESSAGE, EMAIL_INVALID_MESSAGE, MAIL_OFF_MESSAGE, SAVE_FAILED_MESSAGE, SEND_FAILED_MESSAGE, TOO_MANY_MESSAGE,
  normalizeResetCode, resendWaitSeconds, readResetEntry, readResetMemory, writeResetMemory, clearResetMemory,
  readResetApiError, postResetAction, loginPathFor,
} from '../../lib/passwordReset.js';

const TITLE = 'font-display text-[26px] font-semibold tracking-tight';
const LEAD = 'text-[14px] text-gray-500 dark:text-neutral-400 mt-1.5';
const PRIMARY = 'w-full h-12 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[14px] font-semibold inline-flex items-center justify-center gap-2 transition active:scale-[.99] shadow-sm shadow-brand-600/20 disabled:opacity-90 disabled:cursor-default';

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
  const loginPath = loginPathFor(entry.tenant);
  const tenantName = entry.tenant?.displayName;

  // Relógio da contagem de "Mandar outro código". Só anda no passo 2.
  useEffect(() => {
    if (step !== 'code') return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  const waitSeconds = sentAt === null ? 0 : resendWaitSeconds(sentAt, now);

  // Pede o código. Serve ao passo 1 e ao "Mandar outro código".
  async function sendCode(target) {
    const r = await postResetAction({ action: RESET_ACTION_REQUEST, email: target });
    if (r.status === 200) {
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
    else if (err.status === 503) setFormError(err.message || MAIL_OFF_MESSAGE);
    else setFormError(SEND_FAILED_MESSAGE);
    return false;
  }

  async function onRequest(e) {
    e.preventDefault();
    const target = email.trim();
    setFormError('');
    if (!target.includes('@')) {
      setFieldErrors({ email: 'Digite o e-mail que você usa para entrar.' });
      emailRef.current?.focus();
      return;
    }
    setFieldErrors({});
    setBusy(true);
    const ok = await sendCode(target);
    setBusy(false);
    if (!ok) return;
    setEmail(target);
    setCode('');
    setInfo('');
    setStep('code');
  }

  async function onResend() {
    setFormError('');
    setInfo('');
    setBusy(true);
    const ok = await sendCode(email);
    setBusy(false);
    if (!ok) return;
    setCode('');
    setFieldErrors({});
    setInfo('Mandamos outro código. Só o último vale.');
  }

  async function onConfirm(e) {
    e.preventDefault();
    const errors = {};
    if (code.length !== 6) errors.code = 'Digite os 6 números do código.';
    const problem = passwordPolicyError(password);
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

    setBusy(true);
    const r = await postResetAction({ action: RESET_ACTION_CONFIRM, email, code, newPassword: password });
    if (r.status === 200) {
      clearResetMemory();
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
    setBusy(false);
  }

  function onOtherEmail() {
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@academia.com.br"
                autoComplete="username"
                aria-invalid={fieldErrors.email ? true : undefined}
                aria-describedby={describedBy(fieldErrors.email && 'esqueci-email-erro')}
              />
            </AuthField>
            <FormAlert message={formError} />
            <button type="submit" disabled={busy} className={PRIMARY}>
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
          {header('Criar senha nova', (
            <>
              <p id="esqueci-codigo-intro" className={cn(LEAD, 'break-words')}>
                Digite o código que mandamos para <strong className="font-semibold text-gray-700 dark:text-neutral-200">{email}</strong>. Ele vale por 15 minutos e aceita até 5 tentativas.
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
                value={code}
                onChange={(e) => setCode(normalizeResetCode(e.target.value))}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                aria-invalid={fieldErrors.confirm ? true : undefined}
                aria-describedby={describedBy(fieldErrors.confirm && 'esqueci-confirma-erro')}
              />
            </AuthField>
            <FormStatus message={info} />
            <FormAlert message={formError} />
            <button type="submit" disabled={busy} className={PRIMARY}>
              {busy ? <><Spinner /> Salvando…</> : 'Salvar senha nova'}
            </button>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[12.5px] font-semibold">
            <button
              type="button"
              onClick={onResend}
              disabled={busy || waitSeconds > 0}
              className={cn(
                'hover:underline disabled:cursor-default disabled:no-underline',
                waitSeconds > 0 ? 'text-gray-400 dark:text-neutral-500' : 'text-brand-600 dark:text-brand-400',
              )}
            >
              {waitSeconds > 0 ? `Mandar outro código em ${waitSeconds}s` : 'Mandar outro código'}
            </button>
            <button
              type="button"
              onClick={onOtherEmail}
              disabled={busy}
              className="text-gray-700 dark:text-neutral-200 hover:underline disabled:cursor-default disabled:no-underline"
            >
              Usar outro e-mail
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

// Erro que não é de um campo só. Fica sempre montado para o leitor de tela
// anunciar a troca.
function FormAlert({ message }) {
  return (
    <div
      role="alert"
      className={cn(message
        ? 'flex items-start gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-3.5 py-2.5 text-[12.5px] text-rose-700 dark:text-rose-300'
        : 'sr-only')}
    >
      {message && <AlertTriangle className="size-[15px] mt-px shrink-0" />}
      <span>{message}</span>
    </div>
  );
}

// Aviso que não é erro, como o de código reenviado. Fica montado pelo mesmo motivo.
function FormStatus({ message }) {
  return (
    <div
      role="status"
      className={cn(message
        ? 'flex items-start gap-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3.5 py-2.5 text-[12.5px] text-emerald-700 dark:text-emerald-300'
        : 'sr-only')}
    >
      {message && <CheckCircle className="size-[15px] mt-px shrink-0" />}
      <span>{message}</span>
    </div>
  );
}

function Spinner() {
  return <span className="size-4 rounded-full border-2 border-white/40 border-t-white spin" />;
}

export { ForgotPasswordScreen };
