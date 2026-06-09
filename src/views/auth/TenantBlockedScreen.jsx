import { Ban, Clock } from 'lucide-react';
import { SurgeMark, StronileadWordmark } from '../../components/brand/SurgeMark.jsx';

// Tela de bloqueio quando a academia está suspensa ou com trial expirado.
// O usuário autenticou, mas a organização não está liberada — só resta sair.

function TenantBlockedScreen({ reason, onLogout }) {
  const overdue = reason === 'payment_overdue';
  const suspended = reason === 'suspended';
  const danger = suspended || overdue;
  const Icon = danger ? Ban : Clock;
  const title = overdue ? 'Pagamento pendente' : suspended ? 'Academia suspensa' : 'Período de teste encerrado';
  const message = overdue
    ? 'O pagamento desta academia está em atraso. Assim que a fatura for paga, o acesso é liberado automaticamente. Em caso de dúvida, fale com o suporte do STRONILEAD.'
    : suspended
      ? 'Esta academia está temporariamente suspensa. Entre em contato com o suporte do STRONILEAD para regularizar o acesso.'
      : 'O período de teste desta academia terminou. Fale com o suporte do STRONILEAD para ativar um plano e continuar usando o sistema.';
  return (
    <div className="min-h-screen bg-paper-50 dark:bg-ink-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] shadow-card-lg p-8">
        <div className="flex items-center justify-center gap-2 mb-6">
          <SurgeMark size={26} />
          <StronileadWordmark className="text-[18px] text-gray-900 dark:text-white" />
        </div>
        <span className={`mx-auto mb-4 w-14 h-14 rounded-2xl grid place-items-center ${danger ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-accent-50 text-accent-500 dark:bg-accent-500/10'}`}>
          <Icon className="w-7 h-7" />
        </span>
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-gray-900 dark:text-white">{title}</h1>
        <p className="mt-2 text-[14px] text-gray-500 dark:text-neutral-400 leading-relaxed">{message}</p>
        <button
          onClick={onLogout}
          className="mt-7 w-full h-11 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[14px] font-semibold transition active:scale-[.99]"
        >
          Sair
        </button>
      </div>
    </div>
  );
}
export { TenantBlockedScreen };
