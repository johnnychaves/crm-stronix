// Marca do Stronizap: o balão de conversa com o raio, no traçado do logo dele
// (viewBox 240). Vai no marco de início do lead cadastrado pelo Stronizap, do
// mesmo jeito que o Stronizap mostra a marca do Stronilead (StronileadMark).
// As cores são as do outro produto, sem token semântico que as represente, e
// por isso o dark: explícito: no tema claro, balão escuro com raio verde; no
// escuro, a versão clara da marca, balão branco com raio verde-escuro.
import { cn } from '@/lib/utils';

const BALAO = 'M 120 30 C 70 30, 30 70, 30 120 C 30 148, 43.5 173.5, 64 190.5 C 61 201, 56.5 213, 50.5 222 C 49 224, 51 226, 53 225 C 64 222, 79 217, 92 211 C 101 213, 110 214, 120 214 C 170 214, 210 173, 210 122 C 210 71, 170 30, 120 30 Z';
const RAIO = 'M 138 56 L 84 132 L 116 132 L 102 184 L 156 108 L 124 108 Z';

export function StronizapMark({ size = 13, className }) {
  return (
    <svg viewBox="0 0 240 240" width={size} height={size} aria-hidden="true" className={cn('shrink-0', className)}>
      <path d={BALAO} className="fill-[#1A1D20] dark:fill-white" />
      <path
        d={RAIO}
        strokeWidth={8}
        strokeLinejoin="round"
        className="fill-[#25D366] stroke-[#25D366] dark:fill-[#128C7E] dark:stroke-[#128C7E]"
      />
    </svg>
  );
}
