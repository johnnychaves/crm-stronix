// O grupo recolhível das listas ao lado (Relatórios e Configurações). As
// classes do link de cada item moram em railItem.js. As duas telas desenham o mesmo grupo: o
// cabeçalho com o ícone, o nome e o resumo embaixo, a seta, e o painel que
// encolhe. O que muda de uma para a outra (o tom do ícone, a cor do resumo, o
// que vai dentro de cada item) chega por prop.
//
// O grupo é controlado: quem usa guarda se ele está aberto. Fechado, o
// conteúdo encolhe para 0fr e some (opacity), e recebe inert, para sair da
// ordem do Tab e da leitura. As durações caem para zero com
// prefers-reduced-motion. Abrir e fechar é estado da lista, nunca do endereço.
import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { FOCUS_RING } from '../focusRing.js';

export function RailGroup({ label, icon: Icon, iconClassName, summary, summaryClassName = 'text-muted-foreground', open, onToggle, children }) {
  const panelId = useId();
  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-[11px] rounded-[14px] px-[11px] py-2.5 text-left transition-colors duration-150 hover:bg-muted motion-reduce:transition-none',
          FOCUS_RING
        )}
      >
        <span aria-hidden="true" className={cn('grid size-[34px] shrink-0 place-items-center rounded-[10px]', iconClassName)}>
          <Icon size={17} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm font-bold leading-tight text-foreground">{label}</span>
          <span className={cn('mt-0.5 block text-[11.5px]', summaryClassName)}>{summary}</span>
        </span>
        <ChevronDown
          size={15}
          strokeWidth={2.2}
          aria-hidden="true"
          className={cn('shrink-0 text-muted-foreground transition-transform duration-[280ms] motion-reduce:transition-none', !open && '-rotate-90')}
        />
      </button>
      <div
        id={panelId}
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-[280ms,220ms] ease-[ease] motion-reduce:transition-none',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="min-h-0 overflow-hidden">
          {/* O before é a linha que liga os itens ao grupo. O pr e o pb deixam à vista o anel do foco, que o overflow cortaria. */}
          <div
            inert={!open}
            className="relative mb-0.5 ml-[27px] mt-1.5 flex flex-col gap-[3px] pb-[3px] pl-3 pr-[3px] pt-0.5 before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-border"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
