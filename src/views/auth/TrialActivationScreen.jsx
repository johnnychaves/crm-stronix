import { useEffect, useState } from 'react';
import { ArrowRight, Check, Clock, ExternalLink, RefreshCw, UserCog, Users } from 'lucide-react';
import { auth } from '../../lib/firebase.js';
import { SurgeMark, StronileadWordmark } from '../../components/brand/SurgeMark.jsx';

// Tela de ATIVAÇÃO pós-trial (Direção "Painel único"). Substitui o beco sem
// saída da TenantBlockedScreen quando o trial expira: o admin escolhe um plano,
// informa CPF/CNPJ e ativa a 1ª assinatura (/api/asaas action:'activate'). Mostra
// o link da 1ª fatura; o webhook libera o acesso sozinho ao pagar. Consultor
// (não-admin) vê apenas um aviso para pedir ao administrador.
// Planos e PREÇOS vêm do catálogo dinâmico (o que está no superadmin).

const brl = (n) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR');

// "1 gestor", "5 consultores" — null = ilimitado.
function seatLabel(n, one, many, unlimited) {
  if (n == null) return unlimited;
  return `${n} ${n === 1 ? one : many}`;
}

function TrialActivationScreen({ isAdmin, onLogout }) {
  const [plans, setPlans] = useState(null);
  const [sel, setSel] = useState('');
  const [cycle, setCycle] = useState('monthly');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [invoiceUrl, setInvoiceUrl] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    (async () => {
      try {
        const token = await auth.currentUser.getIdToken();
        const res = await fetch('/api/asaas', { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (res.ok) {
          const list = (json.availablePlans || []).filter((p) => Number(p.priceMonthly) > 0);
          setPlans(list);
          setSel(list.find((p) => p.slug === json.plan)?.slug || list[0]?.slug || '');
        } else setErr(json.error || 'Não foi possível carregar os planos.');
      } catch (e) { console.error('activation load', e); setErr('Erro ao carregar os planos.'); }
      finally { setLoading(false); }
    })();
  }, [isAdmin]);

  const selPlan = (plans || []).find((p) => p.slug === sel) || null;
  const priceOf = (p) => (cycle === 'annual' ? p?.priceAnnual : p?.priceMonthly);

  const activate = async () => {
    if (!selPlan) { setErr('Escolha um plano.'); return; }
    const digits = cpfCnpj.replace(/\D/g, '');
    if (digits.length !== 11 && digits.length !== 14) { setErr('Informe um CPF ou CNPJ válido.'); return; }
    setBusy(true); setErr('');
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/asaas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'activate', plan: sel, cpfCnpj: digits, cycle }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json.error || 'Não foi possível ativar a assinatura.'); return; }
      setInvoiceUrl(json.invoiceUrl || null);
      setDone(true);
    } catch (e) { console.error('activate', e); setErr('Erro ao ativar a assinatura.'); }
    finally { setBusy(false); }
  };

  const Shell = ({ children }) => (
    <div className="min-h-screen bg-paper-50 dark:bg-ink-950 flex flex-col items-center justify-center p-6">
      <div className="flex items-center justify-center gap-2 mb-6">
        <SurgeMark size={26} />
        <StronileadWordmark className="text-[18px] text-gray-900 dark:text-white" />
      </div>
      {children}
      <button onClick={onLogout} className="mt-6 text-[13px] font-semibold text-gray-500 hover:text-gray-800 dark:text-neutral-400 dark:hover:text-white transition">Sair</button>
    </div>
  );

  // Consultor (não-admin): não gerencia cobrança.
  if (!isAdmin) {
    return (
      <Shell>
        <div className="w-full max-w-md rounded-3xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] shadow-card-lg p-8 text-center">
          <span className="mx-auto mb-4 w-14 h-14 rounded-2xl grid place-items-center bg-accent-50 text-accent-500 dark:bg-accent-500/10"><Clock className="w-7 h-7" /></span>
          <h1 className="font-display text-[22px] font-semibold tracking-tight text-gray-900 dark:text-white">Período de teste encerrado</h1>
          <p className="mt-2 text-[14px] text-gray-500 dark:text-neutral-400 leading-relaxed">Peça ao administrador da academia para ativar um plano e o acesso volta para todo o time.</p>
        </div>
      </Shell>
    );
  }

  // Estado pós-ativação: fatura gerada.
  if (done) {
    return (
      <Shell>
        <div className="w-full max-w-md rounded-3xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] shadow-card-lg p-8 text-center">
          <span className="mx-auto mb-4 w-14 h-14 rounded-2xl grid place-items-center bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"><Check className="w-7 h-7" /></span>
          <h1 className="font-display text-[22px] font-semibold tracking-tight text-gray-900 dark:text-white">Assinatura criada!</h1>
          <p className="mt-2 text-[14px] text-gray-500 dark:text-neutral-400 leading-relaxed">Pague a 1ª fatura por Pix ou cartão. Assim que o pagamento for confirmado, o acesso é liberado automaticamente.</p>
          {invoiceUrl ? (
            <a href={invoiceUrl} target="_blank" rel="noreferrer" className="mt-6 w-full h-12 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2 transition active:scale-[.99]">
              Pagar agora <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            <p className="mt-6 text-[13px] text-amber-700 dark:text-amber-300">A fatura está sendo gerada — atualize em instantes.</p>
          )}
          <button onClick={() => window.location.reload()} className="mt-3 w-full h-11 rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-neutral-200 text-[14px] font-semibold inline-flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition">
            <RefreshCw className="w-4 h-4" /> Já paguei — atualizar
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="w-full max-w-3xl rounded-3xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] shadow-card-lg p-7 sm:p-8">
        <div className="text-center">
          <h1 className="font-display text-[24px] font-bold tracking-tight text-gray-900 dark:text-white">Seu teste terminou</h1>
          <p className="mt-1.5 text-[14px] text-gray-500 dark:text-neutral-400">Escolha um plano e continue de onde parou — seus leads e histórico estão salvos.</p>
        </div>

        {/* Ciclo */}
        <div className="mt-5 flex justify-center">
          <div className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-white/[0.05] text-[13px] font-semibold">
            {[['monthly', 'Mensal'], ['annual', 'Anual']].map(([k, lbl]) => (
              <button key={k} onClick={() => setCycle(k)} className={`px-4 h-9 rounded-lg transition ${cycle === k ? 'bg-white dark:bg-white/[0.12] text-brand-700 dark:text-white shadow-sm' : 'text-gray-500 dark:text-neutral-400'}`}>{lbl}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center text-[13px] text-gray-400 py-12">Carregando planos…</div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(plans || []).map((p) => {
                const active = p.slug === sel;
                const price = priceOf(p);
                return (
                  <button key={p.slug} type="button" onClick={() => setSel(p.slug)}
                    className={`text-left rounded-2xl border p-4 transition ${active ? 'border-brand-500 ring-2 ring-brand-500/20 bg-brand-50/40 dark:bg-brand-500/[0.06]' : 'border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/20'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-bold text-gray-900 dark:text-white">{p.name}</span>
                      {active && <span className="w-5 h-5 rounded-full bg-brand-600 text-white grid place-items-center"><Check className="w-3 h-3" /></span>}
                    </div>
                    <div className="mt-1 font-display text-[22px] font-bold text-gray-900 dark:text-white num">
                      {price ? brl(price) : '—'}<span className="text-[12px] text-gray-400 font-medium">/{cycle === 'annual' ? 'ano' : 'mês'}</span>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center gap-2 text-[12.5px] text-gray-600 dark:text-neutral-300"><UserCog className="w-3.5 h-3.5 text-brand-600 shrink-0" />{seatLabel(p.maxManagers, 'gestor', 'gestores', 'gestores ilimitados')}</div>
                      <div className="flex items-center gap-2 text-[12.5px] text-gray-600 dark:text-neutral-300"><Users className="w-3.5 h-3.5 text-brand-600 shrink-0" />{p.maxConsultants == null ? 'consultores ilimitados' : `até ${seatLabel(p.maxConsultants, 'consultor', 'consultores')}`}</div>
                      {p.extraUserPrice > 0 && p.maxConsultants != null && (
                        <div className="text-[11.5px] text-accent-600 dark:text-accent-400 pl-[22px]">+ {brl(p.extraUserPrice)}/consultor extra</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* CPF/CNPJ + ativar */}
            <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:items-stretch">
              <input
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                placeholder="CPF ou CNPJ do responsável"
                className="flex-1 h-12 rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.1] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[14px] px-4 placeholder:text-gray-400 transition num"
              />
              <button onClick={activate} disabled={busy || !selPlan}
                className="h-12 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-[14.5px] font-semibold inline-flex items-center justify-center gap-2 transition active:scale-[.99] whitespace-nowrap">
                {busy ? 'Ativando…' : <>Ativar {selPlan ? `· ${brl(priceOf(selPlan))}/${cycle === 'annual' ? 'ano' : 'mês'}` : ''} <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
            {err && <p className="mt-3 text-center text-[13px] text-rose-600 dark:text-rose-300">{err}</p>}
            <p className="mt-3 text-center text-[11.5px] text-gray-400">Geramos a 1ª fatura na hora (Pix ou cartão). O acesso libera automaticamente após o pagamento.</p>
          </>
        )}
      </div>
    </Shell>
  );
}

export { TrialActivationScreen };
