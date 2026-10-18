import { AlarmClock, Undo2 } from 'lucide-react';
import { cn } from '../../../lib/utils.js';

// A faixa de urgência da Meta nova (PR 4 do plano da Meta): avisa quando existe
// uma tarefa mais urgente que a do Agora, sem trocar o Agora sozinha. "Ir agora"
// leva a tarefa para o Agora, e "Agora não" esconde a faixa até a tarefa mudar
// de urgência (faixaFor, em metaFoco.js). Vermelha quando a visita ou a aula já
// passou da hora, azul quando algo vence em até 90 minutos. Quem lê o texto
// para o leitor de tela é a região viva da MetaFocoScreen, que existe desde a
// montagem.
export function FaixaUrgente({ texto, passou, onIr, onDepois }) {
  return (
    <div
      className={cn(
        'mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border px-4 py-3',
        passou
          ? 'border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10'
          : 'border-brand-200 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10',
      )}
    >
      <AlarmClock size={18} aria-hidden="true" className={passou ? 'text-rose-600 dark:text-rose-300' : 'text-brand-600 dark:text-brand-300'} />
      <p className="min-w-0 flex-1 text-[14px] font-semibold text-foreground">{texto}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onIr}
          className="h-9 rounded-lg bg-brand-600 px-3.5 text-[13px] font-semibold text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:anel-foco focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Ir agora
        </button>
        <button
          type="button"
          onClick={onDepois}
          className="h-9 rounded-lg px-3 text-[13px] font-semibold text-slate-600 transition hover:bg-white/70 hover:text-foreground focus-visible:outline-none focus-visible:anel-foco dark:text-slate-300 dark:hover:bg-white/[0.06]"
        >
          Agora não
        </button>
      </div>
    </div>
  );
}

// O aviso com Desfazer, embaixo e no meio da tela, como no mockup B: fundo
// azul-marinho no tema claro e claro no escuro. A região viva existe desde a
// montagem, para o leitor de tela ler cada aviso novo.
export function AvisoDesfazer({ aviso, onDesfazer }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
      {aviso && (
        <div className="pointer-events-auto flex items-center gap-3.5 rounded-xl bg-ink-900 py-2 pl-4 pr-2 text-[13px] text-white shadow-[0_12px_32px_rgba(14,26,64,0.3)] animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none dark:bg-white dark:text-ink-900">
          <span>{aviso.texto}</span>
          <button
            type="button"
            onClick={onDesfazer}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-white/30 px-2.5 text-[12.5px] font-semibold transition hover:bg-white/10 focus-visible:outline-none focus-visible:anel-foco dark:border-ink-900/30 dark:hover:bg-ink-900/10"
          >
            <Undo2 size={13} aria-hidden="true" /> Desfazer
          </button>
        </div>
      )}
    </div>
  );
}
