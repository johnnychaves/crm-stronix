import { LeadLink } from '../../nav/AppLink.jsx';
import { cn } from '../../../lib/utils.js';

const ms = (v) => (v?.toMillis ? v.toMillis() : v instanceof Date ? v.getTime() : Number(v));
const hora = (v) => new Date(ms(v)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const estadoDe = (a, now, proximaId) => {
  if (a.status === 'attended') return { id: 'veio', texto: 'Compareceu', ponto: 'bg-emerald-500', cor: 'text-emerald-700 dark:text-emerald-300' };
  if (a.status === 'no_show') return { id: 'faltou', texto: 'Não veio', ponto: 'bg-rose-500', cor: 'text-rose-700 dark:text-rose-300' };
  if (ms(a.scheduledFor) < now.getTime()) return { id: 'sem', texto: 'Sem desfecho', ponto: 'bg-amber-500', cor: 'text-amber-700 dark:text-amber-300' };
  if (a.id === proximaId) return { id: 'proxima', texto: 'Próxima', ponto: 'bg-brand-600', cor: 'text-brand-700 dark:text-brand-300' };
  return { id: 'depois', texto: '', ponto: 'bg-slate-300 dark:bg-slate-600', cor: '' };
};

export function AgendaDoProfessor({ aulas, now, nomeVisto, gestorVendo }) {
  const lista = [...(aulas || [])].sort((a, b) => ms(a.scheduledFor) - ms(b.scheduledFor));
  const proximaId = lista.find((a) => a.status === 'agendada' && ms(a.scheduledFor) >= now.getTime())?.id;
  return (
    <section aria-label="Agenda de hoje" className="rounded-2xl border border-border bg-card p-[18px]">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-[15px] font-bold">Agenda de hoje</h3>
        {lista.length > 0 && <span className="num text-[12.5px] text-muted-foreground">{lista.length === 1 ? '1 aula' : `${lista.length} aulas`}</span>}
      </div>
      <p className="mt-0.5 mb-2 text-[12.5px] text-muted-foreground">{gestorVendo ? `Aulas experimentais com ${nomeVisto}.` : 'Suas aulas experimentais.'}</p>
      {lista.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nenhuma aula experimental hoje.</p>
      ) : (
        <>
          <ol className="flex flex-col">
            {lista.map((a) => {
              const e = estadoDe(a, now, proximaId);
              return (
                <li key={a.id} className={cn('grid grid-cols-[44px_10px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-border py-2 first:border-t-0', e.id === 'proxima' && '-mx-2.5 rounded-xl border-transparent bg-brand-50 px-2.5 dark:bg-brand-950/40')}>
                  <span className="num text-[13px] font-semibold">{hora(a.scheduledFor)}</span>
                  <i aria-hidden="true" className={cn('size-2 rounded-full', e.ponto)} />
                  <span className="flex min-w-0 flex-col">
                    <LeadLink leadId={a.leadId} className="truncate text-[13.5px] font-semibold hover:underline">{a.leadName || 'Aluno'}</LeadLink>
                    <span className="text-[12px] text-muted-foreground">{a.modality || 'Aula experimental'}</span>
                  </span>
                  {e.texto && <span className={cn('text-[12px] font-semibold whitespace-nowrap', e.cor)}>{e.texto}{e.id === 'proxima' && <span className="sr-only"> (próxima)</span>}</span>}
                </li>
              );
            })}
          </ol>
          <p className="mt-2.5 border-t border-border pt-2.5 text-[12px] text-muted-foreground">Quem marca se o aluno veio é o consultor, na Meta dele.</p>
        </>
      )}
    </section>
  );
}
