// Peças soltas da tela Gerencial: a nota tracejada dos contratos sem valor
// (handoff, linhas 304 a 310) e o painel único da academia que ainda não tem
// contrato nenhum (linhas 137 a 146).
//
// Contrato sem valor se distingue por FORMA, nunca por tom: borda tracejada,
// fundo neutro e a contagem escrita (README §1). Ele é gente de verdade que
// vence, e o dinheiro ainda vai ser preenchido em Contratos.
import { FileText } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';

// Cartão tracejado ao lado do total de risco: quantas pessoas vencem no período
// sem valor gravado. `context` diz por que elas não entram na conta ao lado.
export function BlindValueNote({ count, context, className }) {
  return (
    <div className={cn('w-full flex-none rounded-xl border-[1.5px] border-dashed border-border bg-muted/50 px-[13px] py-[11px] sm:w-[168px]', className)}>
      <div className="num font-display text-[22px] font-bold leading-none tracking-[-0.02em]">{fmtNum(count)}</div>
      <div className="mt-1 text-[11px] font-semibold text-foreground/80">pessoas sem valor</div>
      <div className="mt-[3px] text-[10.5px] leading-[1.4] text-muted-foreground">{context}</div>
    </div>
  );
}

// Academia sem contrato nenhum: o painel substitui o corpo inteiro da tela, sem
// cabeçalho de seção e sem card de zeros (README §5). O botão aponta para onde
// o dado nasce, em vez de deixar o gestor numa tela morta.
export function GerencialEmpty({ onGoToPipeline }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card px-[26px] py-14 text-center">
      <span className="mx-auto mb-[15px] grid size-[50px] place-items-center rounded-[15px] bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
        <FileText size={23} strokeWidth={2} />
      </span>
      <div className="font-display text-[19px] font-bold tracking-[-0.02em]">Ainda não há contratos</div>
      <p className="mx-auto mt-2 max-w-[420px] text-pretty text-[13px] leading-[1.6] text-muted-foreground">
        Esta tela ganha vida na primeira matrícula registrada. Enquanto isso, o funil de leads continua no painel CRM.
      </p>
      <button
        type="button"
        onClick={onGoToPipeline}
        className="mt-5 h-10 rounded-xl bg-brand-600 px-[18px] text-[13px] font-semibold text-white outline-none transition hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500/40"
      >
        Ir para o pipeline
      </button>
    </div>
  );
}
