import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { periodoAnterior, periodoSeguinte, periodoTexto, periodoValido } from '../../lib/carreira/periodo.js';

// Peças divididas pela lista Carreira e pelo perfil do professor: o seletor
// do período e o desenho das abas.
export const TAB_TRIGGER = 'h-10 flex-none rounded-t-lg px-3 text-[13.5px] font-medium text-muted-foreground hover:text-foreground data-[state=active]:font-semibold data-[state=active]:text-foreground after:rounded-full after:bg-brand-600 group-data-[orientation=horizontal]/tabs:after:bottom-[-1px]';
export const TAB_CONTAGEM = 'rounded-full bg-muted px-[7px] py-px text-[12px] font-semibold text-muted-foreground';

const SETA = 'grid size-[30px] flex-none place-items-center rounded-[9px] outline-none focus-visible:anel-foco disabled:pointer-events-none disabled:opacity-35';

// O seletor do período da trilha: setas para o anterior e o próximo, do
// primeiro período com dado até o de agora. Versão clara (cabeçalho da lista)
// e escura (placar do perfil).
export function PeriodoControl({ trilha, periodo, agora, onChave, escuro = false }) {
  const seta = cn(SETA, escuro ? 'text-white/85 hover:bg-white/10 hover:text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground');
  const anterior = periodoAnterior(trilha, periodo);
  const seguinte = periodoSeguinte(trilha, periodo);
  const voltar = anterior && periodoValido(trilha, anterior.chave, agora);
  const ir = seguinte && periodoValido(trilha, seguinte.chave, agora);
  return (
    <div
      role="group"
      aria-label="Período de avaliação"
      className={cn(
        'flex h-[38px] items-center gap-0.5 rounded-xl border p-[3px]',
        escuro ? 'border-white/15 bg-white/[0.06] text-white' : 'border-border bg-card shadow-card',
      )}
    >
      <button type="button" aria-label="Período anterior" disabled={!voltar} onClick={() => onChave(anterior.chave)} className={seta}>
        <ChevronLeft size={15} strokeWidth={2} />
      </button>
      <span className="num whitespace-nowrap px-1.5 text-[13px] font-semibold">{periodoTexto(periodo)}</span>
      <button type="button" aria-label="Próximo período" disabled={!ir} onClick={() => onChave(seguinte.chave)} className={seta}>
        <ChevronRight size={15} strokeWidth={2} />
      </button>
    </div>
  );
}
