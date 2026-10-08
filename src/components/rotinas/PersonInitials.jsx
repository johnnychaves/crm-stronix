import { cn } from '@/lib/utils';
import { getKanbanAvatarPalette, getKanbanInitials } from '../../lib/kanban.js';

// O rosto de iniciais das telas das rotinas. É todo de span, porque mora
// também dentro do link do cartão do modelo, e link não aceita div (o Avatar
// do app é uma div). A cor sai do nome, com a mesma conta do avatar do
// Pipeline, e a cor do texto muda no tema escuro. É decorativo: o nome da
// pessoa está sempre escrito ao lado.
export function PersonInitials({ name, size = 26, className }) {
  const [bg, fg, fgDark] = getKanbanAvatarPalette(String(name || ''));
  return (
    <span
      aria-hidden="true"
      className={cn('grid shrink-0 place-items-center rounded-full font-bold [color:var(--pi-fg)] dark:[color:var(--pi-fg-dark)]', className)}
      style={{ width: size, height: size, background: bg, fontSize: Math.round(size * 0.38), '--pi-fg': fg, '--pi-fg-dark': fgDark || fg }}
    >
      {getKanbanInitials(name)}
    </span>
  );
}
