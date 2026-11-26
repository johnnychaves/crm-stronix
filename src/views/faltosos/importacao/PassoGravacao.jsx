import { AlertTriangle, CircleCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

// Passo 4 da importação: a gravação em lotes, com o andamento, e o fim. Antes
// do primeiro lote a janela relê o que está gravado e refaz o plano. Se a
// gravação parar no meio, os ids fixos deixam tentar de novo com o mesmo
// plano: o que já entrou não se repete.
export function PassoGravacao({ progresso, falha, pronto }) {
  const { gravadas = 0, total = 0 } = progresso || {};
  const pct = total ? Math.round((gravadas / total) * 100) : 0;
  if (pronto) {
    return (
      <div role="status" className="flex flex-col items-center gap-2 py-6 text-center">
        <CircleCheck aria-hidden="true" className="size-8 text-emerald-600 dark:text-emerald-400" />
        <p className="text-[14px] font-semibold">Importação gravada.</p>
        <p className="max-w-sm text-[12.5px] text-muted-foreground">
          {pronto.jaExistia
            ? 'Essa importação já tinha sido gravada. Os alunos foram gravados de novo, e os não ligados foram atualizados.'
            : 'O bloco Faltosos já mostra esta importação, e a ficha de quem voltou a treinar já tem a linha da volta.'}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 py-2">
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full transition-all', falha ? 'bg-destructive' : 'bg-primary')} style={{ width: `${pct}%` }} />
      </div>
      <p className="num text-[12px] text-muted-foreground" aria-live="polite">
        {total ? `${gravadas} de ${total} gravações` : 'Conferindo o que mudou desde a prévia…'}
      </p>
      {falha && (
        <p role="alert" className="flex items-start gap-2 text-[12.5px] text-destructive">
          <AlertTriangle aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          <span>{falha.texto}</span>
        </p>
      )}
    </div>
  );
}
