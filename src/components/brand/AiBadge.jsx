// A marca da IA do Stronizap na ficha: uma pílula "IA" do tamanho do círculo
// do Stronizap (StronizapBadge), ao lado dele. Vai no autor de um agendamento
// que a IA fez, no rodapé do desfecho desse agendamento e no marco de início
// do lead que a IA cadastrou. O texto inteiro ("Agendado pela IA do
// Stronizap") fica no title e no sr-only de quem a usa.
import { cn } from '@/lib/utils';

export function AiBadge({ className }) {
  return (
    <span
      aria-hidden="true"
      className={cn('grid h-[17px] shrink-0 place-items-center rounded-full bg-muted px-1.5 text-[9.5px] font-semibold leading-none text-foreground', className)}
    >
      IA
    </span>
  );
}
