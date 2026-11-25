import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRIMEIRO_CICLO } from '../../lib/screenParams.js';

// Peças divididas pela tela Professores e pelo perfil do professor: o seletor
// de ciclo e o desenho das abas. O seletor tem a versão clara (cabeçalho da
// lista) e a escura (placar do perfil).
export const TAB_TRIGGER = 'h-10 flex-none rounded-t-lg px-3 text-[13.5px] font-medium text-muted-foreground hover:text-foreground data-[state=active]:font-semibold data-[state=active]:text-foreground after:rounded-full after:bg-brand-600 group-data-[orientation=horizontal]/tabs:after:bottom-[-1px]';
export const TAB_CONTAGEM = 'rounded-full bg-muted px-[7px] py-px text-[12px] font-semibold text-muted-foreground';

const SETA = 'grid size-[30px] flex-none place-items-center rounded-[9px] outline-none focus-visible:anel-foco disabled:pointer-events-none disabled:opacity-35';

export function CicloControl({ ciclo, cicloAtual, onCiclo, escuro = false }) {
  const seta = cn(SETA, escuro ? 'text-white/85 hover:bg-white/10 hover:text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground');
  return (
    <div
      role="group"
      aria-label="Ciclo de avaliação"
      className={cn(
        'flex h-[38px] items-center gap-0.5 rounded-xl border p-[3px]',
        escuro ? 'border-white/15 bg-white/[0.06] text-white' : 'border-border bg-card shadow-card',
      )}
    >
      <button type="button" aria-label="Ciclo anterior" disabled={ciclo <= PRIMEIRO_CICLO} onClick={() => onCiclo(ciclo - 1)} className={seta}>
        <ChevronLeft size={15} strokeWidth={2} />
      </button>
      <span className="num whitespace-nowrap px-1.5 text-[13px] font-semibold">Ciclo dez/{ciclo - 1} a nov/{ciclo}</span>
      <button type="button" aria-label="Próximo ciclo" disabled={ciclo >= cicloAtual} onClick={() => onCiclo(ciclo + 1)} className={seta}>
        <ChevronRight size={15} strokeWidth={2} />
      </button>
    </div>
  );
}
