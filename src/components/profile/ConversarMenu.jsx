import { ChevronDown, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StronizapMark } from '../brand/StronizapMark.jsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu.jsx';

// O botão Conversar (opção C do mockup 2026-11-27-whatsapp-ou-stronizap.html,
// escolhida pelo Johnny): toma o lugar do botão WhatsApp e sempre abre o menu
// com as duas saídas. Sem o Stronizap conectado na academia (appUser.tenantZap),
// `onStronizap` vem null e a opção aparece apagada, em preto e branco, sem
// clique (pedido do Johnny, 27/11/2026).
//
// `teclas` mostra o W e o Z nos itens: só a Meta tem esses atalhos.
// `chave` fecha o menu quando a tarefa troca com ele aberto, como o "Mais".

const KBD = 'ml-auto inline-grid h-[18px] min-w-[18px] place-items-center rounded-[5px] border border-current px-[5px] font-sans text-[11px] font-semibold leading-none opacity-55';
const ICONE = 'grid size-[30px] flex-none place-items-center rounded-[9px]';

export function ConversarMenu({ triggerClassName, onWhatsapp, onStronizap, teclas = false, chave, align = 'start' }) {
  return (
    <DropdownMenu key={chave}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-keyshortcuts={teclas ? (onStronizap ? 'W Z' : 'W') : undefined} className={triggerClassName}>
          <MessageCircle size={15} aria-hidden="true" /> Conversar
          {/* A tecla do W no próprio botão, como nos outros da Meta (some no celular). */}
          {teclas && <kbd aria-hidden="true" className="ml-0.5 hidden h-[18px] min-w-[18px] place-items-center rounded-[5px] border border-current px-[5px] font-sans text-[11px] font-semibold leading-none opacity-55 md:inline-grid">W</kbd>}
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[270px] p-1.5">
        <DropdownMenuItem onSelect={onWhatsapp} className="gap-2.5 py-2">
          <span aria-hidden="true" className={`${ICONE} bg-emerald-500/12 text-emerald-700 dark:text-emerald-300`}><MessageCircle size={16} /></span>
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold">WhatsApp</span>
            <span className="text-[12px] text-muted-foreground">Abre o WhatsApp do computador ou do celular</span>
          </span>
          {teclas && <kbd aria-hidden="true" className={KBD}>W</kbd>}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onStronizap || undefined} disabled={!onStronizap} className={cn('gap-2.5 py-2', !onStronizap && 'grayscale')}>
          <span aria-hidden="true" className={`${ICONE} bg-muted`}><StronizapMark size={18} /></span>
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold">Stronizap</span>
            <span className="text-[12px] text-muted-foreground">
              {onStronizap ? 'Abre a conversa no Stronizap, com o histórico' : 'A academia ainda não conectou o Stronizap'}
            </span>
          </span>
          {teclas && onStronizap && <kbd aria-hidden="true" className={KBD}>Z</kbd>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
