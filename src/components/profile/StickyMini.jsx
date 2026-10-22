import { MessageCircle, Phone } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { RingAvatar } from './RingAvatar.jsx';

// A barra fina da ficha: quando o cabeçalho sai por cima da área que rola
// (useHeaderGone), ela desce e fica presa no alto, com o nome, o estado e os
// dois botões de contato. O wrapper tem altura zero e `sticky top-0`, então não
// ocupa lugar no fluxo; a barra de verdade é absoluta dentro dele. A área que
// rola tem um respiro (p-4 md:p-8) acima do conteúdo, e o wrapper nasce nele:
// por isso a barra escondida, além de subir 110%, fica transparente, e só o
// translate deixaria uma faixa à vista no topo.
//
// Ela repete o WhatsApp e o Ligar do cabeçalho, que continuam sendo os do
// teclado e do leitor de tela: a barra fica fora da leitura (aria-hidden), os
// botões fora do Tab (tabIndex -1) e o clique não leva o foco para ela
// (preventDefault no mousedown). Assim ela nunca guarda o foco, e quando some
// (inert) o foco não cai no body.
const keepFocus = (e) => e.preventDefault();
const BTN = 'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[12px] font-semibold transition active:scale-[.98]';

export function StickyMini({ visible, name, photoUrl, tone, stateText, onWhatsApp, onCall }) {
  return (
    <div className="pointer-events-none sticky top-0 z-30 h-0">
      <div
        data-slot="ficha-mini"
        aria-hidden="true"
        inert={!visible}
        className={cn(
          'absolute inset-x-0 top-0 transition-[transform,opacity] duration-200 motion-reduce:transition-none',
          visible ? 'pointer-events-auto translate-y-0 opacity-100' : '-translate-y-[110%] opacity-0'
        )}
      >
        <div className="flex h-14 items-center gap-3 rounded-b-2xl border border-t-0 border-border bg-card/95 px-4 shadow-card-lg backdrop-blur dark:bg-[color-mix(in_srgb,var(--page),white_4%)]">
          <RingAvatar name={name} size={30} toneName={tone} showDot={false} photoUrl={photoUrl} />
          <b className="min-w-0 truncate font-display text-[16px] tracking-tight">{name}</b>
          {stateText && (
            <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-slate-100 px-2.5 text-[12.5px] font-semibold text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
              {stateText}
            </span>
          )}
          <span className="flex-1" />
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={keepFocus}
            onClick={onWhatsApp}
            className={cn(BTN, 'bg-brand-600 text-white shadow-sm hover:bg-brand-700')}
          >
            <MessageCircle size={14} aria-hidden="true" />WhatsApp
          </button>
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={keepFocus}
            onClick={onCall}
            className={cn(BTN, 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]')}
          >
            <Phone size={14} aria-hidden="true" />Ligar
          </button>
        </div>
      </div>
    </div>
  );
}
