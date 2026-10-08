import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { firstName, namesText } from '../../lib/rotinas.js';
import { dayLineLabels, dayLinePct, modelCardSummary, modelTimes } from '../../lib/rotinasTela.js';
import { AppLink } from '../nav/AppLink.jsx';
import { PersonInitials } from './PersonInitials.jsx';

// Quantos rostos o cartão empilha. Os nomes de todos vêm escritos ao lado.
const FACES_MAX = 4;

// A linha do dia (mockup 2026-10-08-rotinas-intro-e-polimento.html, Página B):
// das 06h às 21h, um ponto por tarefa com horário, o trecho entre a primeira e
// a última em azul claro e os rótulos das pontas e do primeiro e do último
// horário (dayLineLabels). É toda de span e sem nada clicável, porque mora
// dentro do link do cartão, e link não aceita outro elemento interativo
// dentro. O trilho fica em slate-100 (white/[0.07] no escuro), e não no
// bg-muted: no escuro o token é white/[0.04], e o trilho de 2px quase some
// sobre o cartão.
export function DayLine({ model }) {
  const times = modelTimes(model);
  return (
    <span className="relative mt-2 block h-[30px]" aria-hidden="true">
      <span className="absolute inset-x-0 top-[7px] h-0.5 rounded bg-slate-100 dark:bg-white/[0.07]" />
      {times.length > 1 && (
        <span
          className="absolute top-[7px] h-0.5 rounded bg-brand-600/35"
          style={{ left: `${dayLinePct(times[0])}%`, width: `${dayLinePct(times[times.length - 1]) - dayLinePct(times[0])}%` }}
        />
      )}
      {times.map((m, i) => (
        <span
          key={`${m}-${i}`}
          className="absolute top-[3px] -ml-[5px] size-2.5 rounded-full border-2 border-brand-600 bg-card dark:bg-[#0c1126]"
          style={{ left: `${dayLinePct(m)}%` }}
        />
      ))}
      {dayLineLabels(times).map((l) => (
        <span
          key={l.pct}
          className={cn('num absolute top-4 text-[9.5px] text-muted-foreground', l.align === 'center' && '-translate-x-1/2', l.align === 'end' && '-translate-x-full')}
          style={{ left: `${l.pct}%` }}
        >
          {l.text}
        </span>
      ))}
    </span>
  );
}

// O cartão inteiro é o link do modelo (`link` traz o endereço e o state da
// navegação, montados pela RotinasView), então Ctrl+clique, botão do meio e
// "Abrir em nova aba" abrem o modelo em outra aba. O "Abrir" de dentro é só
// texto: um link só por cartão.
export function ModelCard({ model, people, link }) {
  const followers = people.filter((p) => (model.followerIds || []).includes(p.id));
  return (
    <AppLink
      {...link}
      className="flex flex-col gap-1 rounded-2xl border border-border bg-card px-4 pb-3.5 pt-4 text-left shadow-card transition hover:border-brand-500/50 hover:shadow-[0_8px_20px_-12px_rgba(43,89,255,.45)]"
    >
      <span className="flex items-baseline justify-between gap-2.5">
        <span className="min-w-0 truncate font-display text-[16px] font-semibold tracking-tight">{model.name}</span>
        <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-brand-600 dark:text-brand-300">
          Abrir <ArrowRight aria-hidden="true" className="size-[13px]" />
        </span>
      </span>
      <span className="num block text-[12px] text-muted-foreground">{modelCardSummary(model)}</span>
      <DayLine model={model} />
      <span className="mt-1.5 flex items-center gap-2 border-t border-border pt-2.5 text-[12px] text-muted-foreground">
        {followers.length ? (
          <>
            <span className="flex">
              {followers.slice(0, FACES_MAX).map((p, i) => (
                <PersonInitials key={p.id} name={p.name} className={cn('ring-2 ring-card', i > 0 && '-ml-[7px]')} />
              ))}
            </span>
            <span className="min-w-0 truncate">{namesText(followers.map((p) => firstName(p.name)))}</span>
          </>
        ) : (
          <span className="inline-flex h-[22px] items-center rounded-full bg-amber-500/[0.12] px-2 text-[11px] font-medium text-amber-700 dark:text-amber-300">
            Ninguém segue ainda
          </span>
        )}
      </span>
    </AppLink>
  );
}
