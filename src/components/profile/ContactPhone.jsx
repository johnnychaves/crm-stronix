// Telefone de contato de um lead: o do responsável quando é menor, com a
// marca "resp.", ou o próprio WhatsApp. Serve às listas e à Meta Diária.
// A regra de quem é o contato mora em lib/guardian.js.
import { cn } from '@/lib/utils';
import { contactLabel, contactOf } from '../../lib/guardian.js';

export function ContactPhone({ lead, showName = false, className, now }) {
  const c = contactOf(lead, now);
  if (!c.phone) return null;
  const quem = c.viaGuardian ? contactLabel(c) : '';
  return (
    <span className={cn('num', className)} title={c.viaGuardian ? `Telefone de ${quem}, responsável` : undefined}>
      {showName && c.viaGuardian && <>{quem} · </>}
      {c.phone}
      {c.viaGuardian && (
        <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">resp.</span>
      )}
    </span>
  );
}
