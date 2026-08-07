import * as Sentry from '@sentry/react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { SurgeMark, StronileadWordmark } from './brand/SurgeMark.jsx';

// Tela mostrada quando uma view quebra. Substitui a tela branca de hoje.
// O código do evento aparece para o usuário poder passar ao suporte, o que
// transforma "deu erro" em algo rastreável.
function ErrorFallback({ resetError, eventId }) {
  return (
    <div className="grid place-items-center h-full py-24 px-6">
      <div className="w-full max-w-[420px] text-center">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <SurgeMark size={22} />
          <StronileadWordmark className="text-[16px]" />
        </div>

        <span className="inline-grid place-items-center size-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 mb-4">
          <AlertTriangle className="size-6" />
        </span>

        <h2 className="font-display text-[20px] font-semibold tracking-tight">
          Essa tela travou
        </h2>
        <p className="mt-2 text-[13.5px] text-gray-500 dark:text-neutral-400 leading-relaxed">
          O resto do sistema segue funcionando. Já fomos avisados e estamos olhando.
        </p>

        <button
          type="button"
          onClick={resetError}
          className="mt-6 h-11 px-5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[13.5px] font-semibold inline-flex items-center justify-center gap-2 transition active:scale-[.99]"
        >
          <RotateCw className="size-4" /> Tentar de novo
        </button>

        {eventId && (
          <p className="mt-5 text-[11.5px] text-gray-400 dark:text-neutral-500">
            Código do erro: <span className="font-mono">{eventId}</span>
          </p>
        )}
      </div>
    </div>
  );
}

// Funciona mesmo sem DSN configurado: o Sentry.ErrorBoundary continua
// capturando e renderizando o fallback, só não envia nada.
export function AppErrorBoundary({ children }) {
  return (
    <Sentry.ErrorBoundary fallback={(props) => <ErrorFallback {...props} />}>
      {children}
    </Sentry.ErrorBoundary>
  );
}
