// Peça solta da tela Gerencial: o painel único da academia que ainda não tem
// contrato nenhum (handoff v2, §4). Ele substitui o corpo inteiro da tela, sem
// cabeçalho de seção e sem card de zeros. O botão aponta para onde o dado
// nasce, em vez de deixar o gestor numa tela morta.
import { FileText } from 'lucide-react';

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
        className="mt-5 h-10 rounded-xl bg-brand-600 px-[18px] text-[13px] font-semibold text-white outline-none transition hover:bg-brand-700 focus-visible:anel-foco focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Ir para o pipeline
      </button>
    </div>
  );
}
