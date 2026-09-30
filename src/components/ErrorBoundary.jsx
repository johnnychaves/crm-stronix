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

// Aviso que toma o lugar de uma tela inteira fora do app logado. Ele não pode
// depender de nada do app: se o que quebrou foi a moldura da tela (AuthLayout),
// um contexto ou o roteador, um aviso que use qualquer um deles quebraria junto
// e a página ficaria em branco do mesmo jeito. Por isso não tem hook, logotipo,
// toast nem dado, só tokens semânticos, o Button e um ícone. O botão recarrega
// a página, porque quem chegou aqui ainda não tem sessão nem rascunho a perder.
function ScreenErrorFallback({ eventId }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-16 text-foreground">
      <div className="flex w-full max-w-[420px] flex-col items-center text-center">
        <span className="mb-4 inline-grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" />
        </span>
        <div role="alert">
          <h1 className="font-display text-[20px] font-semibold tracking-tight">
            Não deu para abrir esta tela.
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
            Recarregue a página para tentar de novo. Se o erro continuar, fale com o suporte e passe o código abaixo.
          </p>
        </div>
        <Button type="button" onClick={() => window.location.reload()} className="mt-6 h-11 rounded-xl px-5 text-[13.5px] font-semibold">
          Recarregar
        </Button>
        {eventId && (
          <p className="mt-5 text-[11.5px] text-muted-foreground">
            Código do erro: <span className="font-mono">{eventId}</span>
          </p>
        )}
      </div>
    </main>
  );
}

// Proteção de uma tela inteira fora do app logado: o login, o "Esqueci a
// senha", o convite e a indicação pública, que o App.jsx desenha antes de
// qualquer outra proteção. Um erro de render numa delas deixava a página toda
// branca para quem tentava entrar. O erro chega ao Sentry como nos outros: o
// Sentry.ErrorBoundary captura e o gancho do createRoot, no main.jsx, também. O
// aviso é uma função fixa pelo mesmo motivo do modal (o Sentry o monta como
// componente). Telas que se revezam no mesmo lugar do App.jsx levam key própria,
// senão o aviso de uma ficaria preso quando a tela trocasse.
export function ScreenErrorBoundary({ children }) {
  return (
    <Sentry.ErrorBoundary fallback={ScreenErrorFallback}>
      {children}
    </Sentry.ErrorBoundary>
  );
}
