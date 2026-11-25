import { useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils';

// A confirmação no lugar do botão (mockup B das pesquisas): uma faixa âmbar
// com a pergunta, o efeito e os dois botões. Ao aparecer, o foco vai para o
// Voltar, a saída segura. Quem a mostra cuida de devolver o foco ao fechar.
export const BOTAO = 'inline-flex h-[34px] items-center gap-[7px] whitespace-nowrap rounded-[10px] border border-border bg-card px-3 text-[13px] font-semibold outline-none hover:border-brand-200 hover:text-brand-700 focus-visible:anel-foco disabled:cursor-not-allowed disabled:opacity-45 dark:hover:text-brand-300';
export const BOTAO_PRI = 'inline-flex h-[34px] items-center gap-[7px] whitespace-nowrap rounded-[10px] border border-brand-600 bg-brand-600 px-3 text-[13px] font-semibold text-white outline-none hover:border-brand-700 hover:bg-brand-700 focus-visible:anel-foco focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-45';
const BOTAO_PERIGO = 'inline-flex h-[34px] items-center whitespace-nowrap rounded-[10px] border border-rose-600 bg-rose-600 px-3 text-[13px] font-semibold text-white outline-none hover:bg-rose-700 focus-visible:anel-foco focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-45';

export function Confirmacao({ titulo, texto, acao, perigo = false, ocupado = false, onConfirmar, onVoltar, className }) {
  const id = useId();
  const voltar = useRef(null);
  useEffect(() => { voltar.current?.focus(); }, []);
  return (
    <div role="alertdialog" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`} className={cn('flex flex-col gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100', className)}>
      <b id={`${id}-t`} className="text-[14px]">{titulo}</b>
      <p id={`${id}-d`} className="m-0 text-[13px]">{texto}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <button ref={voltar} type="button" onClick={onVoltar} disabled={ocupado} className={cn(BOTAO, 'text-foreground')}>Voltar</button>
        <button type="button" onClick={onConfirmar} disabled={ocupado} className={perigo ? BOTAO_PERIGO : BOTAO_PRI}>{ocupado ? 'Gravando…' : acao}</button>
      </div>
    </div>
  );
}
