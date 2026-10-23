import { useRef } from 'react';
import { Copy, MessageCircle, UserPlus, Users } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu.jsx';

// O botão Indicações do cabeçalho do cliente: o contador de indicados e as três
// saídas (cadastrar, copiar o link, mandar o link pelo WhatsApp). Quem monta
// decide quem vê o botão (canIndicar) e passa canRegister conforme a permissão
// de cadastrar. O gatilho é o próprio DropdownMenuTrigger, e não o Btn: o Btn
// não encaminha ref nem as props que o Radix injeta, e o menu não abriria.
// O Radix devolve o foco ao botão quando o menu fecha. O Cadastrar indicação
// abre uma janela que devolve o foco a quem o tinha quando ela abriu: por isso
// ela só abre depois de o menu devolver o foco ao botão (onCloseAutoFocus).
// Aberta antes, ela guardava o item do menu, que some, e ao fechar o foco
// caía no body.
export function ReferralsMenu({ count = null, canRegister, onRegister, onCopy, whatsappHref, toGuardian }) {
  const afterClose = useRef(null);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={count == null ? 'Indicações' : `Indicações, ${count}`}
        className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 text-[12.5px] font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:anel-foco active:scale-[.98] data-[state=open]:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08] dark:data-[state=open]:bg-white/[0.08]"
      >
        <Users size={14} aria-hidden="true" />
        Indicações
        {/* Sem a contagem ainda (null), sem número: um 0 diria que não há indicados. */}
        {count != null && (
          <span className="num inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-slate-100 px-1 text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
            {count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-64 rounded-xl"
        onCloseAutoFocus={() => {
          const run = afterClose.current;
          afterClose.current = null;
          if (run) setTimeout(run, 0);
        }}
      >
        {canRegister && (
          <DropdownMenuItem onSelect={() => { afterClose.current = onRegister; }} className="cursor-pointer">
            <UserPlus className="size-4 text-brand-600 dark:text-brand-300" aria-hidden="true" /> Cadastrar indicação
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onCopy} className="cursor-pointer">
          <Copy className="size-4 text-slate-500 dark:text-slate-400" aria-hidden="true" /> Copiar link de indicação
        </DropdownMenuItem>
        {whatsappHref && (
          <DropdownMenuItem asChild className="cursor-pointer">
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              {toGuardian ? 'Enviar link ao responsável pelo WhatsApp' : 'Enviar link pelo WhatsApp'}
            </a>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
