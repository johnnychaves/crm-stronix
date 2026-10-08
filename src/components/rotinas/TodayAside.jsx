import { useId } from 'react';
import { cn } from '@/lib/utils';
import { firstName, stateText } from '../../lib/rotinas.js';
import { clockText } from '../../lib/rotinasTela.js';
import { PersonInitials } from './PersonInitials.jsx';

// A lateral da aba Hoje: o detalhe da tarefa escolhida (no topo), as
// atrasadas de agora e as observações de hoje. O detalhe que se vê não é região
// viva, porque o texto do estado ("atrasada há 47 min") muda a cada minuto e o
// leitor de tela o releria o tempo todo. Quem anuncia é um parágrafo escondido
// (sr-only) que existe desde a montagem e só muda de texto quando a escolha
// muda: "Detalhe: Ana, Ligações para leads novos". Fechado, fica vazio.

function Count({ n, late = false }) {
  return (
    <span
      className={cn(
        'num rounded-md px-[7px] py-[3px] font-sans text-[11px] font-semibold',
        late && n > 0 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300' : 'bg-muted text-muted-foreground',
      )}
    >
      {n}
    </span>
  );
}

function Quote({ children }) {
  return (
    <span className="mt-1.5 block rounded-[9px] border-l-2 border-brand-600 bg-muted px-2.5 py-1.5 text-[12px] text-foreground">
      {children}
    </span>
  );
}

function Row({ person, children }) {
  return (
    <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-[9px] text-[12.5px]">
      <PersonInitials name={person.name} size={24} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Card({ title, count, late = false, children }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="rounded-2xl border border-border bg-card px-3.5 pb-3 pt-3.5 shadow-card">
      <h2 id={titleId} className="flex items-center gap-2 font-display text-[14px] font-semibold">
        {title} <Count n={count} late={late} />
      </h2>
      {children}
    </section>
  );
}

export function TodayAside({ team, detail, now, onClose }) {
  return (
    // Fixa no topo e com rolagem própria: uma lista longa de atrasadas não pode
    // empurrar as observações para fora da tela. O -m-1 com p-1 dá folga para a
    // sombra dos cartões não ser cortada pela rolagem. A altura máxima desconta
    // o cabeçalho do app (h-16, 4rem, que fica fora da área que rola) e 1rem de
    // folga em cima e em baixo. Faixa de aviso no topo (teste, mensalidade)
    // encolhe a área e não entra na conta.
    <aside className="flex flex-col gap-3 overscroll-y-contain lg:sticky lg:top-4 lg:-m-1 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:p-1">
      <p aria-live="polite" className="sr-only">
        {detail ? `Detalhe: ${firstName(detail.person.name)}, ${detail.task.title}` : ''}
      </p>
      {detail && (
        <section aria-label="Detalhe da tarefa" className="rounded-2xl border border-brand-600/45 bg-card px-3.5 pb-3 pt-3.5 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-300">Detalhe</p>
            <button type="button" onClick={onClose} className="text-[12px] text-muted-foreground hover:text-foreground">Fechar</button>
          </div>
          <Row person={detail.person}>
            <p className="font-semibold">{detail.person.name}</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">{detail.task.time ? `${detail.task.time} · ` : ''}{detail.task.title}</p>
            <p className={cn('mt-0.5 text-[11.5px]', detail.state === 'late' ? 'font-semibold text-rose-600 dark:text-rose-300' : 'text-muted-foreground')}>
              {stateText(detail.task, detail.state, detail.doneAt ?? now, now)}
            </p>
            {detail.note && <Quote>{detail.note}</Quote>}
          </Row>
        </section>
      )}

      <Card title="Atrasadas agora" count={team.lateRows.length} late>
        {team.lateRows.length === 0 && <p className="mt-2.5 text-[12px] text-muted-foreground">Ninguém com tarefa atrasada.</p>}
        {team.lateRows.map((r) => (
          <Row key={`${r.person.id}-${r.task.id}`} person={r.person}>
            <p><b className="font-semibold">{firstName(r.person.name)}</b> · {r.task.title}</p>
            <p className="mt-0.5 text-[11.5px] font-semibold text-rose-600 dark:text-rose-300">{r.text}</p>
          </Row>
        ))}
      </Card>

      <Card title="Observações de hoje" count={team.notes.length}>
        {team.notes.length === 0 && <p className="mt-2.5 text-[12px] text-muted-foreground">Nenhuma observação até agora.</p>}
        {team.notes.map((n) => (
          <Row key={`${n.person.id}-${n.task.id}`} person={n.person}>
            <p><b className="font-semibold">{firstName(n.person.name)}</b> · {n.task.title}</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">Às {clockText(n.doneAt)}</p>
            <Quote>{n.note}</Quote>
          </Row>
        ))}
      </Card>
    </aside>
  );
}
