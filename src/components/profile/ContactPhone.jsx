// Telefone de contato de um lead: o do responsável quando é menor, com a
// marca "resp.", ou o próprio WhatsApp. Serve às listas e à Meta Diária.
// A regra de quem é o contato mora em lib/guardian.js.
import { cn } from '@/lib/utils';
import { contactLabel, contactOf } from '../../lib/guardian.js';

export function ContactPhone({ lead, showName = false, className, now }) {
  const c = contactOf(lead, now);
  if (!c.phone) return null;
  const quem = c.viaGuardian ? contactLabel(c) : '';
  // A marca "resp." precisa ficar fora do span com uppercase: o Chrome lê
  // para o leitor de tela o texto já transformado (RESP.), então o texto
  // por extenso mora num span irmão, não dentro do span visível.
  const marca = c.viaGuardian && (
    <>
      <span aria-hidden="true" className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        resp.
      </span>
      <span className="sr-only"> (telefone do responsável)</span>
    </>
  );
  return (
    <span
      className={cn('inline-flex min-w-0 max-w-full items-baseline', className)}
      title={c.viaGuardian ? `Telefone de ${quem}, responsável` : undefined}
    >
      {showName && c.viaGuardian ? (
        <>
          {/* Nome trunca à vontade; telefone e marca ficam num bloco que
              nunca encolhe, senão o número corta no meio na ficha e na Meta. */}
          <span className="min-w-0 truncate" title={quem}>{quem} · </span>
          <span className="shrink-0 whitespace-nowrap">
            <span className="num">{c.phone}</span>
            {marca}
          </span>
        </>
      ) : (
        <>
          <span className="num">{c.phone}</span>
          {marca}
        </>
      )}
    </span>
  );
}
