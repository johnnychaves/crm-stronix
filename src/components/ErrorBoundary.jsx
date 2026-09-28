import { createContext, useContext, useMemo } from 'react';
import * as Sentry from '@sentry/react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { SurgeMark, StronileadWordmark } from './brand/SurgeMark.jsx';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog.jsx';
import { Button } from './ui/button.jsx';

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

// O `open` e o `onClose` do modal protegido. O Sentry monta o fallback como
// componente (createElement), então ele precisa ser uma função fixa: uma
// arrow nova a cada render remontaria o aviso toda vez que o App renderiza,
// e o Dialog abriria de novo. Por isso os dois chegam por contexto.
const ModalBoundaryContext = createContext({ open: true, onClose: null });

// Aviso que toma o lugar de um modal que quebrou.
function ModalErrorFallback({ resetError, eventId }) {
  const { open, onClose } = useContext(ModalBoundaryContext);
  // Modal fechado que quebra não mostra aviso: ninguém pediu para abrir nada.
  if (!open) return null;
  // Fechar também limpa o erro, para a próxima abertura voltar limpa.
  const fechar = () => {
    resetError();
    onClose?.();
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) fechar(); }}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[130] bg-ink-950/60 backdrop-blur-[3px]"
        className="z-[130] flex flex-col items-center gap-0 p-7 text-center rounded-2xl border-border sm:max-w-[400px]"
      >
        <span className="inline-grid place-items-center size-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 mb-4">
          <AlertTriangle className="size-6" />
        </span>
        <DialogTitle className="font-display text-[20px] font-semibold tracking-tight">
          Essa janela travou
        </DialogTitle>
        <DialogDescription className="mt-2 text-[13.5px] leading-relaxed">
          O resto do sistema segue funcionando. Feche e abra de novo para continuar.
        </DialogDescription>
        <Button type="button" onClick={fechar} className="mt-6 h-11 px-5 rounded-xl text-[13.5px] font-semibold">
          Fechar
        </Button>
        {eventId && (
          <p className="mt-5 text-[11.5px] text-muted-foreground">
            Código do erro: <span className="font-mono">{eventId}</span>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Proteção de um modal de topo, montado fora do AppErrorBoundary (fim do
// App.jsx). Um erro dentro dele troca o modal pelo aviso e o resto do app
// fica de pé. No modal que abre por condição, a proteção some junto com ele.
// No que fica sempre montado e abre pelo `open` (HelpCenterModal), o `open`
// diz se há aviso a mostrar.
export function ModalErrorBoundary({ open = true, onClose, children }) {
  const value = useMemo(() => ({ open, onClose }), [open, onClose]);
  return (
    <ModalBoundaryContext.Provider value={value}>
      <Sentry.ErrorBoundary fallback={ModalErrorFallback}>
        {children}
      </Sentry.ErrorBoundary>
    </ModalBoundaryContext.Provider>
  );
}

function EmptyFallback() {
  return null;
}

// Proteção de uma peça que pode sumir sem aviso quando quebra: o título, a
// busca, o sino e o menu da conta no cabeçalho, e os pop-ups que abrem
// sozinhos (novidades e tour). O erro vai para o Sentry e o resto segue igual.
export function SilentErrorBoundary({ children }) {
  return (
    <Sentry.ErrorBoundary fallback={EmptyFallback}>
      {children}
    </Sentry.ErrorBoundary>
  );
}
