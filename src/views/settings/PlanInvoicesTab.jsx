import { useEffect, useState } from 'react';
import { Calendar, Check, CreditCard, ExternalLink, ReceiptText } from 'lucide-react';
import { auth } from '../../lib/firebase.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { SettingsCard } from '../../components/ui/SettingsCard.jsx';

// Aba self-service do cliente: ver plano, faturas (pagas/em aberto), renovação
// e TROCAR de plano sozinho (sem suporte). Fala com /api/asaas (caminho do tenant).

const brl = (n) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR');

function invStatus(s) {
  const k = String(s || '').toUpperCase();
  if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(k)) return { t: 'Paga', c: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' };
  if (k === 'OVERDUE') return { t: 'Atrasada', c: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' };
  if (k === 'PENDING') return { t: 'Em aberto', c: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' };
  if (k === 'REFUNDED') return { t: 'Estornada', c: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300' };
  return { t: k || '—', c: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300' };
}
const PAY = {
  paid: { t: 'Em dia', c: 'text-emerald-700 dark:text-emerald-300' },
  pending: { t: 'Pendente', c: 'text-amber-700 dark:text-amber-300' },
  overdue: { t: 'Inadimplente', c: 'text-rose-700 dark:text-rose-300' },
};

function PlanInvoicesTab() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState('');

  const load = async () => {
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/asaas', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (res.ok) setData(json);
      else toast.error(json.error || 'Não foi possível carregar a assinatura.');
    } catch (e) { console.error('billing load', e); toast.error('Erro ao carregar a assinatura.'); }
    finally { setLoading(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez ao montar
  useEffect(() => { load(); }, []);

  const migrate = async (p) => {
    if (!window.confirm(`Mudar para o plano "${p.name}"${p.priceMonthly ? ` (${brl(p.priceMonthly)}/mês)` : ''}? A troca vale na hora e o valor da cobrança ajusta no próximo ciclo.`)) return;
    setMigrating(p.slug);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/asaas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'migrate', plan: p.slug }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Não foi possível mudar o plano.'); return; }
      toast.success(`Plano alterado para ${p.name}!`);
      await load();
    } catch (e) { console.error('migrate', e); toast.error('Erro ao mudar o plano.'); }
    finally { setMigrating(''); }
  };

  if (loading) return <div className="text-center text-[13px] text-slate-400 py-12">Carregando sua assinatura…</div>;
  if (!data) return <div className="text-center text-[13px] text-slate-400 py-12">Não foi possível carregar a assinatura.</div>;

  const pay = PAY[data.paymentStatus] || { t: '—', c: 'text-slate-500' };
  const renew = data.nextBillingAt ? new Date(data.nextBillingAt).toLocaleDateString('pt-BR') : null;

  return (
    <div className="space-y-6">
      <SettingsCard title="Seu plano" hint="Assinatura e renovação" icon={<CreditCard size={16} />}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-white/[0.07] p-4">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Plano atual</div>
            <div className="text-[18px] font-bold text-slate-900 dark:text-white mt-1">{data.planName}</div>
            <div className="text-[12px] text-slate-500 num">{data.priceMonthly != null ? `${brl(data.priceMonthly)}/mês` : '—'} · {data.billingCycle === 'annual' ? 'anual' : 'mensal'}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-white/[0.07] p-4">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Situação</div>
            <div className={`text-[18px] font-bold mt-1 ${pay.c}`}>{pay.t}</div>
            <div className="text-[12px] text-slate-500">{data.hasSubscription ? 'cobrança automática ativa' : 'sem cobrança automática'}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-white/[0.07] p-4">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Próxima renovação</div>
            <div className="text-[18px] font-bold text-slate-900 dark:text-white mt-1 num flex items-center gap-1.5"><Calendar size={15} className="text-slate-400" />{renew || '—'}</div>
            {data.lastInvoiceUrl && <a href={data.lastInvoiceUrl} target="_blank" rel="noreferrer" className="text-[12px] text-brand-600 hover:underline inline-flex items-center gap-1 mt-0.5">fatura atual <ExternalLink size={11} /></a>}
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Faturas" hint="Pagas e em aberto" icon={<ReceiptText size={16} />}>
        {data.invoices?.length ? (
          <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
            {data.invoices.map((inv) => {
              const st = invStatus(inv.status);
              return (
                <div key={inv.id} className="flex items-center gap-3 py-2.5">
                  <span className="num text-[13.5px] font-semibold text-slate-800 dark:text-slate-100 w-24 shrink-0">{brl(inv.value)}</span>
                  <span className="text-[12px] text-slate-500 num flex-1 truncate">venc. {inv.dueDate ? new Date(inv.dueDate + 'T12:00:00').toLocaleDateString('pt-BR') : '—'} · {inv.billingType || '—'}</span>
                  <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded shrink-0 ${st.c}`}>{st.t}</span>
                  {inv.invoiceUrl && <a href={inv.invoiceUrl} target="_blank" rel="noreferrer" className="text-[12px] text-brand-600 hover:underline inline-flex items-center gap-1 shrink-0">abrir <ExternalLink size={11} /></a>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-[12.5px] text-slate-400 italic py-6">{data.hasSubscription ? 'Nenhuma fatura emitida ainda.' : 'Cobrança automática ainda não configurada — fale com o suporte para ativar.'}</div>
        )}
      </SettingsCard>

      <SettingsCard title="Mudar de plano" hint="Você mesmo troca — sem precisar de suporte" icon={<CreditCard size={16} />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(data.availablePlans || []).map((p) => {
            const current = p.slug === data.plan;
            return (
              <div key={p.slug} className={`rounded-xl border p-4 flex flex-col ${current ? 'border-brand-400 dark:border-brand-500/40 bg-brand-50/40 dark:bg-brand-500/[0.04]' : 'border-slate-200 dark:border-white/[0.07]'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-bold text-slate-900 dark:text-white">{p.name}</span>
                  {current && <span className="text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">Atual</span>}
                </div>
                <div className="text-[20px] font-bold text-slate-900 dark:text-white num mt-1">{p.priceMonthly ? brl(p.priceMonthly) : 'sob consulta'}<span className="text-[12px] text-slate-400 font-medium">{p.priceMonthly ? '/mês' : ''}</span></div>
                <div className="text-[11.5px] text-slate-500 mt-0.5">{p.maxUsers == null ? 'Usuários ilimitados' : `até ${p.maxUsers} usuários`}</div>
                {Array.isArray(p.features) && p.features.length > 0 && (
                  <div className="mt-3 space-y-1.5 flex-1">
                    {p.features.slice(0, 4).map((f, i) => <div key={i} className="flex items-start gap-1.5 text-[12px] text-slate-600 dark:text-slate-300"><Check size={13} className="text-emerald-500 mt-0.5 shrink-0" />{f}</div>)}
                  </div>
                )}
                <div className="mt-3">
                  {current ? (
                    <button disabled className="w-full h-9 rounded-lg text-[12.5px] font-semibold bg-slate-100 text-slate-400 dark:bg-white/[0.06] dark:text-slate-500 cursor-default">Plano atual</button>
                  ) : !p.priceMonthly ? (
                    <button disabled className="w-full h-9 rounded-lg text-[12.5px] font-semibold bg-slate-100 text-slate-400 dark:bg-white/[0.06] dark:text-slate-500 cursor-default">Sob consulta</button>
                  ) : (
                    <button onClick={() => migrate(p)} disabled={!!migrating} className="w-full h-9 rounded-lg text-[12.5px] font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 transition active:scale-[.99]">{migrating === p.slug ? 'Mudando…' : 'Mudar para este'}</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11.5px] text-slate-400">A troca vale na hora; o valor da cobrança ajusta no próximo ciclo. Faturas já emitidas não mudam.</p>
      </SettingsCard>
    </div>
  );
}

export { PlanInvoicesTab };
