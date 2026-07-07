import { Clock, CreditCard, Eye, LogOut } from 'lucide-react';

// Banner de contagem regressiva do período de teste (mostrado ao cliente quando
// a academia está em trial ATIVO). Fica âmbar (urgência) quando faltam <= 3 dias.
function TrialBanner({ endsAtMs }) {
  const DAY = 24 * 60 * 60 * 1000;
  const daysLeft = Math.max(0, Math.ceil((endsAtMs - Date.now()) / DAY));
  const dateLabel = new Date(endsAtMs).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const urgent = daysLeft <= 3;
  const msg = daysLeft <= 0
    ? 'Seu período de teste termina hoje'
    : daysLeft === 1
      ? 'Falta 1 dia do seu período de teste'
      : `Faltam ${daysLeft} dias do seu período de teste`;
  return (
    <div className={`shrink-0 px-4 md:px-8 py-2 flex items-center justify-center gap-2 text-[12.5px] font-medium border-b ${urgent
      ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20'
      : 'bg-brand-50 text-brand-700 border-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:border-white/[0.06]'}`}>
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>{msg} <span className="opacity-70">· termina em {dateLabel}</span></span>
    </div>
  );
}

// Aviso de vencimento da mensalidade (mostrado só ao ADMIN da academia quando a
// próxima cobrança vence em <= 7 dias, ou já venceu). Brand (7–4 dias) →
// âmbar (<= 3 dias) → rose (vencida; o acesso é cortado após 3 dias de carência).
function PaymentDueBanner({ dueAtMs, overdue, invoiceUrl, onOpenBilling }) {
  const DAY = 24 * 60 * 60 * 1000;
  const daysLeft = dueAtMs != null ? Math.ceil((dueAtMs - Date.now()) / DAY) : null;
  const dateLabel = dueAtMs != null
    ? new Date(dueAtMs).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : null;

  let msg;
  if (overdue) msg = dateLabel ? `Mensalidade vencida desde ${dateLabel} — pague para manter o acesso` : 'Mensalidade vencida — pague para manter o acesso';
  else if (daysLeft == null) return null;
  else if (daysLeft <= 0) msg = `Sua mensalidade vence hoje · ${dateLabel}`;
  else if (daysLeft === 1) msg = `Sua mensalidade vence amanhã · ${dateLabel}`;
  else msg = `Sua mensalidade vence em ${daysLeft} dias · ${dateLabel}`;

  const tone = overdue
    ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20'
    : (daysLeft <= 3
      ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20'
      : 'bg-brand-50 text-brand-700 border-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:border-white/[0.06]');

  return (
    <div className={`shrink-0 px-4 md:px-8 py-2 flex items-center justify-center gap-2 text-[12.5px] font-medium border-b ${tone}`}>
      <CreditCard className="w-3.5 h-3.5 shrink-0" />
      <span>{msg}</span>
      {invoiceUrl ? (
        <a href={invoiceUrl} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2 hover:opacity-80">Pagar fatura</a>
      ) : (
        <button onClick={onOpenBilling} className="font-semibold underline underline-offset-2 hover:opacity-80">Ver faturas</button>
      )}
    </div>
  );
}

function ImpersonationBanner({ viewing, onExit, busy }) {
  return (
    <div className="shrink-0 flex items-center justify-center gap-3 px-4 py-2 bg-amber-500 text-amber-950 text-[12.5px] font-semibold">
      <Eye className="w-4 h-4 shrink-0" />
      <span className="truncate">Visualizando como <b>{viewing?.name || viewing?.id}</b> — você está dentro da conta deste cliente.</span>
      <button onClick={onExit} disabled={busy}
        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-950/90 text-amber-50 hover:bg-amber-950 disabled:opacity-60 transition">
        <LogOut className="w-3.5 h-3.5" /> Sair da visualização
      </button>
    </div>
  );
}
export { TrialBanner, PaymentDueBanner, ImpersonationBanner };
