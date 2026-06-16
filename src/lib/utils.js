import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Padrão shadcn: composição de classes condicionais com dedupe de utilitários
// Tailwind conflitantes. Use em todo componente novo no lugar de template
// literals com ternários.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
