import { useRef } from 'react';
import { Ban, MoreHorizontal, Trash } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu.jsx';

// "Mais ações" do cabeçalho da ficha: as ações que não se repetem todo dia e
// que encerram ou apagam (marcar perda, excluir). Cada uma só entra para quem
// tem a permissão (canLoss, canDelete), e o lead em Perda não recebe o
// canLoss; sem nenhuma, o botão não existe. O gatilho é o DropdownMenuTrigger,
// pelo mesmo motivo do ReferralsMenu.
//
// O Marcar perda abre o LossReasonModal, que ainda não é um Dialog e leva o foco
// para a lista de motivos. Ela só abre depois de o menu fechar (a lista do menu
// prende o foco enquanto existe), e o menu não devolve o foco ao botão nesse
// caso, senão ele ficaria atrás do fundo escuro da janela.
export function MoreActionsMenu({ isClient, canLoss, lossDisabled, onLoss, canDelete, onDelete }) {
  const afterClose = useRef(null);
  if (!canLoss && !canDelete) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Mais ações"
        title="Mais ações"
        className="grid size-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:anel-foco data-[state=open]:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white dark:data-[state=open]:bg-white/[0.06]"
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-52 rounded-xl"
        onCloseAutoFocus={(e) => {
          const run = afterClose.current;
          afterClose.current = null;
          if (run) { e.preventDefault(); run(); }
        }}
      >
        {canLoss && (
          <DropdownMenuItem disabled={lossDisabled} onSelect={() => { afterClose.current = onLoss; }} className="cursor-pointer">
            <Ban className="size-4 text-slate-500 dark:text-slate-400" aria-hidden="true" /> Marcar perda
          </DropdownMenuItem>
        )}
        {canLoss && canDelete && <DropdownMenuSeparator />}
        {canDelete && (
          <DropdownMenuItem onSelect={onDelete} className="cursor-pointer text-rose-700 focus:text-rose-700 dark:text-rose-300 dark:focus:text-rose-300">
            <Trash className="size-4 text-rose-600 dark:text-rose-300" aria-hidden="true" /> {isClient ? 'Excluir cliente' : 'Excluir lead'}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
