import { cn } from '../../lib/utils.js';
import { FOCUS_RING } from '../focusRing.js';

// As classes do link de um item, aceso ou não. Quem usa junta o espaço entre
// o ícone e o nome e o recuo da direita, que mudam de uma lista para a outra.
export const railItemClassName = (active) => cn(
  'relative flex w-full items-center rounded-xl border py-[7px] pl-[7px] text-left',
  'transition-[border-color,background-color,box-shadow] duration-150 motion-reduce:transition-none',
  FOCUS_RING,
  active
    // O before é o traço azul em cima da linha que liga os itens ao grupo: 13px é o pl-3 da lista mais a borda do item.
    ? 'border-border bg-card shadow-[0_1px_0_rgba(15,23,42,.04),0_10px_24px_-12px_rgba(15,23,42,.22)] before:absolute before:inset-y-[9px] before:-left-[13px] before:w-0.5 before:rounded-full before:bg-brand-600 dark:shadow-[0_14px_30px_-14px_rgba(0,0,0,.7)]'
    : 'border-transparent hover:bg-muted'
);
