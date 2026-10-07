import { cn } from '@/lib/utils';
import { firstName, minutesOf, namesText, spanText } from '../../lib/rotinas.js';
import { AppLink } from '../nav/AppLink.jsx';

const DAY_START = 7 * 60;
const DAY_END = 21 * 60;
const pct = (m) => ((Math.min(Math.max(m, DAY_START), DAY_END) - DAY_START) / (DAY_END - DAY_START)) * 100;

// A faixa do dia: quando as tarefas com horário acontecem, de 07h a 21h. É
// toda de span e sem nada clicável, porque mora dentro do link do cartão, e
// link não aceita outro elemento interativo dentro. O trilho fica em slate-100 (white/[0.07] no escuro), e não
// no bg-muted: no escuro o token é white/[0.04], e o trilho de 2px quase some
// sobre o cartão.
export function DayLine({ tasks }) {
  const times = (tasks || [])
    .filter((t) => t.active !== false)
    .map((t) => minutesOf(t.time))
    .filter((m) => m != null)
    .sort((a, b) => a - b);
  return (
    <span className="relative block h-[34px]" aria-hidden="true">
      <span className="absolute inset-x-0 top-2.5 h-0.5 rounded bg-slate-100 dark:bg-white/[0.07]" />
      {times.length > 1 && (
        <span
          className="absolute top-2.5 h-0.5 rounded bg-brand-600/35"
          style={{ left: `${pct(times[0])}%`, width: `${pct(times[times.length - 1]) - pct(times[0])}%` }}
        />
      )}
      {times.map((m, i) => (
        <span key={`${m}-${i}`} className="absolute top-1.5 -ml-[5px] size-2.5 rounded-full border-2 border-brand-600 bg-card" style={{ left: `${pct(m)}%` }} />
      ))}
      <span className="num absolute left-0 top-5 text-[10px] text-muted-foreground">07h</span>
      <span className="num absolute left-1/2 top-5 -translate-x-1/2 text-[10px] text-muted-foreground">14h</span>
      <span className="num absolute right-0 top-5 text-[10px] text-muted-foreground">21h</span>
    </span>
  );
}

// O cartão inteiro é o link do modelo (`link` traz o endereço e o state da
// navegação, montados pela RotinasView), então Ctrl+clique, botão do meio e
// "Abrir em nova aba" abrem o modelo em outra aba. O "Abrir" de dentro é só
// texto: um link só por cartão.
export function ModelCard({ model, people, link }) {
  const followers = people.filter((p) => (model.followerIds || []).includes(p.id));
  const active = (model.tasks || []).filter((t) => t.active !== false).length;
  const span = spanText(model);
  return (
    <AppLink
      {...link}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-card transition hover:border-brand-500/50"
    >
      <span className="flex items-start justify-between gap-2.5">
        <span className="block min-w-0">
          <span className="block truncate font-display text-[16px] font-semibold tracking-tight">{model.name}</span>
          <span className="num mt-0.5 block text-[12px] text-muted-foreground">
            {active} {active === 1 ? 'tarefa' : 'tarefas'}{span ? ` · ${span}` : ''}
          </span>
        </span>
        <span className="shrink-0 text-[12px] font-semibold text-brand-600">Abrir</span>
      </span>
      <DayLine tasks={model.tasks} />
      <span className={cn('block text-[12.5px]', followers.length ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-300')}>
        {followers.length ? namesText(followers.map((p) => firstName(p.name))) : 'Ninguém segue este modelo'}
      </span>
    </AppLink>
  );
}
