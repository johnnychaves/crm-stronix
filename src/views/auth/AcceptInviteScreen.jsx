import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase.js';
import { Check, AlertTriangle, User, Lock, EyeOff, Eye, ArrowRight } from 'lucide-react';
import { SurgeMark, StronileadWordmark } from '../../components/brand/SurgeMark.jsx';

// Tela pública de aceite de convite (/?invite=<token>&t=<tenantId>). Cria a
// conta do convidado (e-mail vem do convite) e faz login automático.
function AcceptInviteScreen({ token, tenantId }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const fieldWrap = 'mt-1.5 relative flex items-center rounded-xl border bg-white dark:bg-white/[0.03] transition border-gray-200 dark:border-white/[0.08] focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/15';
  const inputClass = 'w-full h-12 bg-transparent outline-none text-[14px] px-3 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-neutral-500';

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    if (!name.trim()) { setError('Informe seu nome.'); return; }
    if (password.length < 6) { setError('A senha precisa ter ao menos 6 caracteres.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/invite-accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, token, password, name: name.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Não foi possível aceitar o convite.');
        setLoading(false);
        return;
      }
      // Login automático e entrada no app (recarrega sem o ?invite).
      try {
        await signInWithEmailAndPassword(auth, data.email, password);
        window.location.replace('/');
        return;
      } catch {
        // Conta criada mas auto-login falhou: orienta login manual.
        setDone(true);
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao aceitar o convite. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper-50 dark:bg-ink-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[400px] rounded-3xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] shadow-card-lg p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <SurgeMark size={24} />
          <StronileadWordmark className="text-[17px] text-gray-900 dark:text-white" />
        </div>
        {done ? (
          <div className="text-center">
            <span className="mx-auto mb-4 w-12 h-12 rounded-2xl grid place-items-center bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Check className="w-6 h-6" />
            </span>
            <h1 className="font-display text-[20px] font-semibold tracking-tight text-gray-900 dark:text-white">Conta criada!</h1>
            <p className="mt-2 text-[13.5px] text-gray-500 dark:text-neutral-400">Faça login com seu e-mail e a senha que você acabou de definir.</p>
            <button onClick={() => window.location.replace('/')} className="mt-6 w-full h-11 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[14px] font-semibold transition">Ir para o login</button>
          </div>
        ) : (
          <>
            <h1 className="font-display text-[22px] font-semibold tracking-tight text-gray-900 dark:text-white">Você foi convidado</h1>
            <p className="mt-1.5 text-[13.5px] text-gray-500 dark:text-neutral-400">
              Crie sua conta para acessar a academia <span className="font-semibold text-gray-700 dark:text-neutral-200 num">{tenantId}</span>.
            </p>
            {error && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-3.5 py-2.5 text-[12.5px] text-rose-700 dark:text-rose-300">
                <AlertTriangle className="w-[15px] h-[15px] mt-px shrink-0" /><span>{error}</span>
              </div>
            )}
            <form onSubmit={submit} className="mt-5 space-y-4">
              <label className="block">
                <span className="text-[12.5px] font-semibold text-gray-700 dark:text-neutral-300">Seu nome</span>
                <div className={fieldWrap}>
                  <span className="pl-3.5 text-gray-400 dark:text-neutral-500"><User className="w-[17px] h-[17px]" /></span>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" className={inputClass} required />
                </div>
              </label>
              <label className="block">
                <span className="text-[12.5px] font-semibold text-gray-700 dark:text-neutral-300">Senha</span>
                <div className={fieldWrap}>
                  <span className="pl-3.5 text-gray-400 dark:text-neutral-500"><Lock className="w-[17px] h-[17px]" /></span>
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="mín. 6 caracteres" className={inputClass} required />
                  <span className="pr-2">
                    <button type="button" onClick={() => setShowPass(s => !s)} className="w-9 h-9 grid place-items-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition">
                      {showPass ? <EyeOff className="w-[17px] h-[17px]" /> : <Eye className="w-[17px] h-[17px]" />}
                    </button>
                  </span>
                </div>
              </label>
              <button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[14px] font-semibold inline-flex items-center justify-center gap-2 transition active:scale-[.99] disabled:opacity-90">
                {loading ? (<><span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white spin"></span> Criando…</>) : (<>Aceitar convite <ArrowRight className="w-4 h-4" /></>)}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
export { AcceptInviteScreen };
