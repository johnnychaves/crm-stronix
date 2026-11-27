import { forwardRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { cn } from '../../../lib/utils.js';
import { LeadLink } from '../../nav/AppLink.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { contactOf, whatsappHref } from '../../../lib/guardian.js';
import { fraseDe, motivoDe, canalTexto, resultadoTexto } from '../../../lib/faltosos/metaProfessor.js';

const BOTAO = 'inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-[13px] font-semibold hover:border-brand-200 focus-visible:outline-none focus-visible:anel-foco';

export const AgoraFalta = forwardRef(function AgoraFalta({ estado, lead, hojeDia, now, entrando, ultimo, onRegistrar, onJaVoltou, onPular }, ref) {
  const f = fraseDe(estado, hojeDia);
  const contato = lead ? contactOf(lead, now) : null;
  const href = contato ? whatsappHref(contato.phone) : null;
  const textoContato = contato?.viaGuardian
    ? `${contato.name}${contato.relationship ? `, ${contato.relationship.toLowerCase()}` : ''} (responsável)`
    : contato?.phone;
  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-label="Agora"
      className={cn(
        'rounded-[18px] border border-border border-l-[6px] bg-card px-6 pt-5 pb-5 focus-visible:outline-none focus-visible:anel-foco',
        estado.urgente ? 'border-l-rose-500' : 'border-l-amber-500',
        entrando && 'meta-entra',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-brand-700 dark:text-brand-300">Agora</span>
        <span className={cn('rounded-full px-2.5 py-1 text-[12.5px] font-semibold', estado.urgente ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300')}>{motivoDe(estado)}</span>
      </div>
      <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-[18px]">
        <span className={cn('inline-grid rounded-full p-[3px]', estado.urgente ? 'bg-rose-500' : 'bg-amber-500')}>
          <Avatar name={lead?.name || ''} size={64} photoUrl={lead?.photoUrl} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="font-display text-[26px] font-bold tracking-[-0.02em]">{lead?.name || 'Aluno'}</h2>
            <LeadLink leadId={estado.id} draggable={false} className="text-[13px] font-semibold text-brand-700 hover:underline dark:text-brand-300">Abrir ficha</LeadLink>
          </div>
          <p className="mt-1.5 text-[17px] text-slate-700 dark:text-slate-200">
            Não vem há <b className="num text-foreground">{f.dias} dias</b>, desde {f.desde}.
            {f.termina && <> O contrato termina em <b className="num text-rose-700 dark:text-rose-300">{f.termina}</b>.</>}
          </p>
          <p className="mt-3 mb-4 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-muted-foreground">
            {textoContato && <span>{contato.viaGuardian ? 'Falar com' : 'Contato'} <b className="num font-semibold text-foreground">{textoContato}</b></span>}
            <span>{ultimo ? `${canalTexto(ultimo.canal)} em ${ultimo.dia}, por ${ultimo.por}: ${resultadoTexto(ultimo.resultado).toLowerCase()}` : 'Nenhum contato de falta neste período'}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap gap-2">
          {href && <a href={href} target="_blank" rel="noopener noreferrer" className={cn(BOTAO, 'text-emerald-700 dark:text-emerald-300')}><MessageCircle aria-hidden="true" className="size-4" />WhatsApp</a>}
          <button type="button" onClick={onRegistrar} className="inline-flex h-9 items-center rounded-full bg-brand-600 px-4 text-[13px] font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:anel-foco focus-visible:ring-offset-2 focus-visible:ring-offset-background">Registrar contato</button>
          <button type="button" onClick={onJaVoltou} className={BOTAO}>Já voltou</button>
        </div>
        <button type="button" onClick={onPular} className="rounded text-[13px] font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:anel-foco">Pular por agora</button>
      </div>
    </section>
  );
});
