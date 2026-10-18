import { useState } from 'react';
import { Check, CheckCircle, ChevronRight, Sparkles, X } from 'lucide-react';
import { DG_CATEGORY_META } from '../../../lib/dailyGoal.js';
import { DAILY_GOAL_CATEGORIES as C } from '../../../lib/leads.js';
import { CATEGORY_ONE, focoRules } from '../../../lib/metaFocoTexts.js';
import { cn } from '../../../lib/utils.js';
import { Avatar } from '../../ui/Avatar.jsx';
import { Tabs, TabsList, TabsTrigger } from '../../ui/tabs.jsx';

// As peças da Meta nova (mockup B) em volta do bloco Agora: a barra "Foco em",
// a fila "Depois", o Ritmo do mês, as seções curtas da lateral e os estados do
// dia. Só apresentam: a ordem mora em metaFoco.js e os textos, em metaFocoTexts.js.

const CARD = 'rounded-2xl border border-border bg-card shadow-card';

// O tom do motivo nos fundos claros, com o par do tema escuro.
const WHY_TEXT = {
  late: 'text-rose-700 dark:text-rose-300',
  now: 'text-brand-700 dark:text-brand-300',
  warn: 'text-amber-700 dark:text-amber-300',
  calm: 'text-muted-foreground',
};

// A barra "Foco em". É o Tabs do shadcn: a fila abaixo é o painel da aba
// escolhida. O escolhido usa o azul-marinho do bloco Agora. O ponto avisa o que
// já passou (vermelho) ou vence em até 90 minutos (azul), e o detalhe vai no
// nome da aba para o leitor de tela.
export function FocoBar({ tabs, value, onChange, children }) {
  return (
    <Tabs value={value} onValueChange={onChange} className="gap-0">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-[13px] whitespace-nowrap text-muted-foreground">Foco em</span>
        <TabsList
          aria-label="Foco em"
          className="h-auto w-auto min-w-0 justify-start gap-0.5 overflow-x-auto overscroll-x-contain rounded-xl bg-muted p-[3px] [scrollbar-width:none] group-data-[orientation=horizontal]/tabs:h-auto"
        >
          {tabs.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              aria-label={`${t.label}: ${t.pending} pendentes${t.why ? `. ${t.why}` : ''}`}
              title={t.why || undefined}
              className={cn(
                'h-8 flex-none gap-1.5 rounded-[9px] border-0 px-2 text-[13px] font-medium text-foreground/80 shadow-none hover:bg-accent',
                // O primitivo traz o anel de 3 px a 50% (ring-ring/50), e o cn
                // não junta o anel-foco com ele. O ring-2 e o ring-ring repetem o
                // anel-foco em classes que o cn sabe trocar, para o anel ficar sólido.
                'focus-visible:border-0 focus-visible:outline-none focus-visible:ring-inset focus-visible:anel-foco focus-visible:ring-2 focus-visible:ring-ring',
                'data-[state=active]:bg-ink-900 data-[state=active]:text-white data-[state=active]:shadow-none dark:data-[state=active]:border-0 dark:data-[state=active]:bg-ink-700 dark:data-[state=active]:text-white',
              )}
            >
              {t.label}
              {t.dot && <i aria-hidden="true" className={cn('size-1.5 flex-none rounded-full', t.dot === 'late' ? 'bg-rose-500' : 'bg-brand-600')} />}
              <span className="num text-[12.5px] font-semibold opacity-70">{t.pending}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {children}
    </Tabs>
  );
}

// "Já interagido hoje": a pessoa já recebeu contato hoje por outro caminho, e
// a tarefa precisa ser fechada pela Meta para contar.
export function InteractedTag({ className }) {
  return (
    <span className={cn('rounded-full bg-muted px-2 py-px text-[11.5px] font-semibold text-muted-foreground', className)}>
      Já interagido. Feche pela Meta
    </span>
  );
}

const QUEUE_SHOWN = 7;

// A fila "Depois". A linha inteira é um botão que traz a tarefa para o Agora
// (decisão do Johnny: sem botão "Fazer agora"). Ela não abre a ficha: quem abre
// é o nome e o "Abrir ficha" do Agora.
export function FilaDepois({ items, sla, onPick, whyOf }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, QUEUE_SHOWN);
  return (
    <section aria-labelledby="meta-fila-titulo" className={cn(CARD, 'mt-4 overflow-hidden')}>
      <div className="flex flex-wrap items-baseline gap-2.5 px-5 pb-2 pt-[18px]">
        <h2 id="meta-fila-titulo" className="font-display text-[17px] font-bold">Depois</h2>
        <span className="num font-semibold text-muted-foreground">{items.length}</span>
        <details className="group ml-auto text-[12.5px] open:ml-0 open:mt-1.5 open:basis-full open:rounded-xl open:bg-muted open:px-4 open:py-3">
          <summary className="cursor-pointer list-none rounded font-semibold text-brand-700 outline-none focus-visible:anel-foco group-open:mb-2 dark:text-brand-300 [&::-webkit-details-marker]:hidden">
            Como a ordem é definida
          </summary>
          <ol className="grid list-decimal gap-1 pl-5 text-foreground/80">
            {focoRules(sla).map((r) => <li key={r}>{r}</li>)}
          </ol>
        </details>
      </div>
      {items.length === 0 ? (
        <p className="px-5 pb-6 pt-2 text-[13.5px] text-muted-foreground">Nada na fila depois desta tarefa.</p>
      ) : (
        <>
          <ul>
            {shown.map((e) => {
              const Icon = DG_CATEGORY_META[e.slug].Icon;
              const cliente = e.slug === C.RENOVACAO || e.slug === C.VENCIDO;
              const sub = cliente ? e.lead.currentPlanName : e.lead.source;
              const why = whyOf(e);
              return (
                <li key={e.key} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onPick(e)}
                    className="group grid w-full grid-cols-[34px_minmax(0,1fr)_auto_16px] items-center gap-3.5 px-5 py-[9px] text-left transition hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-inset focus-visible:anel-foco"
                  >
                    <Avatar name={e.lead.name} size={34} photoUrl={e.lead.photoUrl || null} />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold">
                        <span className="sr-only">Fazer agora: </span>{e.lead.name || 'Lead sem nome'}
                      </span>
                      <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
                        <Icon size={12} aria-hidden="true" className="flex-none" />
                        <span className="truncate">{CATEGORY_ONE[e.slug]}{sub ? ` · ${sub}` : ''}</span>
                        {e.lead.hasOtherActivityToday && <InteractedTag className="flex-none" />}
                      </span>
                    </span>
                    <span className={cn('text-right text-[13px] font-semibold whitespace-nowrap', WHY_TEXT[why.tone])}>{why.text}</span>
                    <ChevronRight size={16} aria-hidden="true" className="text-slate-300 transition group-hover:text-brand-600 dark:text-white/25" />
                  </button>
                </li>
              );
            })}
          </ul>
          {items.length > QUEUE_SHOWN && (
            <div className="flex justify-center p-3.5">
              <button type="button" onClick={() => setAll((v) => !v)} className="h-9 rounded-lg border border-border px-3.5 text-[13px] font-semibold hover:bg-muted focus-visible:outline-none focus-visible:anel-foco">
                {all ? 'Mostrar menos' : `Mostrar as outras ${items.length - QUEUE_SHOWN}`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// O Ritmo do mês, compacto. A marca escura na barra é onde ela deveria estar:
// os dias de meta do mês até ontem (`expected`). Os 14 quadradinhos são os
// últimos dias, como no cartão de hoje.
export function RitmoCard({ ritmo, expected, volumeMonth }) {
  const { history14, monthHits, monthTarget } = ritmo;
  const behind = expected - monthHits;
  const pct = (n) => (monthTarget > 0 ? Math.min(100, (n / monthTarget) * 100) : 0);
  return (
    <section aria-labelledby="meta-ritmo-titulo" className={cn(CARD, 'px-4 py-3.5')}>
      <div className="flex items-baseline justify-between gap-2.5">
        <h3 id="meta-ritmo-titulo" className="font-display text-[14px] font-bold tracking-[-0.01em]">Ritmo do mês</h3>
        <span className="text-[13px] text-muted-foreground">
          <b className="num text-[15px] font-bold text-foreground">{monthHits}</b> de {monthTarget} dias batidos
        </span>
      </div>
      <div
        role="img"
        aria-label={`${monthHits} de ${monthTarget} dias batidos. O ritmo esperado até ontem é ${expected}.`}
        className="relative mt-3 h-1.5 rounded-full bg-slate-200/80 dark:bg-white/10"
      >
        <i className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct(monthHits)}%` }} />
        {expected > 0 && <span className="absolute -top-[3px] h-3 w-0.5 rounded-sm bg-foreground" style={{ left: `calc(${pct(expected)}% - 1px)` }} />}
      </div>
      <p className={cn('mt-2 text-[12px] font-semibold', behind > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300')}>
        {behind > 0 ? `${behind} ${behind === 1 ? 'dia' : 'dias'} abaixo do ritmo` : 'No ritmo do mês'}
      </p>
      <ol aria-label="Últimos 14 dias" className="mt-3 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-[3px]">
        {history14.map((d) => {
          const state = d.isToday ? 'today' : !d.active ? 'off' : d.hit ? 'hit' : 'miss';
          const label = { hit: 'meta batida', miss: 'meta não batida', off: 'fora da meta', today: d.hit ? 'hoje, meta batida' : 'hoje' }[state];
          return (
            <li
              key={d.label}
              title={`${d.label}, ${label}`}
              className={cn(
                'grid h-4 place-items-center rounded',
                state === 'hit' && 'bg-emerald-500/90 text-white',
                state === 'miss' && 'bg-rose-50 text-rose-700 ring-[1.5px] ring-inset ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
                state === 'today' && (d.hit ? 'bg-emerald-500/90 text-white ring-2 ring-inset ring-brand-600' : 'ring-2 ring-inset ring-brand-600'),
                state === 'off' && 'bg-muted',
              )}
            >
              <span className="sr-only">{d.label}, {label}</span>
              {(state === 'hit' || (state === 'today' && d.hit)) && <Check size={10} aria-hidden="true" />}
              {state === 'miss' && <X size={10} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
      {volumeMonth && volumeMonth.target > 0 && (
        <div className="mt-3 flex items-center justify-between gap-3 text-[12.5px] text-muted-foreground">
          <span>Prospecção do mês <b className="num font-semibold text-foreground">{volumeMonth.total} de {volumeMonth.target}</b></span>
          <div role="progressbar" aria-label="Prospecção do mês" aria-valuemin={0} aria-valuemax={volumeMonth.target} aria-valuenow={volumeMonth.total} className="h-1 max-w-24 flex-1 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
            <i className="block h-full rounded-full bg-accent-500" style={{ width: `${Math.min(100, (volumeMonth.total / volumeMonth.target) * 100)}%` }} />
          </div>
        </div>
      )}
    </section>
  );
}

const SIDE_SHOWN = 4;

// Uma seção curta da lateral (Amanhã, Feitos hoje): título, uma nota, até
// quatro linhas e "Ver todas".
export function SideSection({ title, note, count, items, empty, renderItem, moreLabel = 'Ver todas' }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, SIDE_SHOWN);
  return (
    <section className="border-t border-border px-[18px] py-4 first:border-t-0">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-[14px] font-bold tracking-[-0.01em]">{title}</h3>
        {count != null ? <small className="num text-[12px] text-muted-foreground">{count}</small> : note && <small className="text-[12px] text-muted-foreground">{note}</small>}
      </div>
      {count != null && note && <p className="text-[12px] text-muted-foreground">{note}</p>}
      {items.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-muted-foreground">{empty}</p>
      ) : (
        <div className="mt-2.5 flex flex-col gap-2">{shown.map(renderItem)}</div>
      )}
      {items.length > SIDE_SHOWN && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 rounded text-[12.5px] font-semibold text-brand-700 hover:underline focus-visible:outline-none focus-visible:anel-foco dark:text-brand-300">
          {all ? 'Ver menos' : `${moreLabel} (${items.length})`}
        </button>
      )}
    </section>
  );
}

export function SideCard({ children }) {
  return <div className={cn(CARD, 'overflow-hidden')}>{children}</div>;
}

// Os estados do dia no lugar do Agora e da fila.

// A meta vazia (nenhuma tarefa hoje): o mesmo texto da tela de hoje.
export function MetaVazia() {
  return (
    <div className={cn(CARD, 'mt-3.5 grid place-items-center px-6 py-14 text-center')}>
      <span className="mb-3 grid size-12 place-items-center rounded-full bg-emerald-50 dark:bg-emerald-500/10"><CheckCircle size={22} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" /></span>
      <h2 className="text-[15px] font-semibold">Sua meta está vazia hoje</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">Aproveite o turno para prospectar novos leads.</p>
    </div>
  );
}

// O foco escolhido não tem nada pendente, mas outro tem.
export function FocoVazio({ label, onAll }) {
  return (
    <div className={cn(CARD, 'mt-3.5 grid place-items-center px-6 py-12 text-center')}>
      <span className="mb-3 grid size-12 place-items-center rounded-full bg-emerald-50 dark:bg-emerald-500/10"><CheckCircle size={22} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" /></span>
      <h2 className="text-[15px] font-semibold">Nada pendente em {label.toLowerCase()}</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">Escolha outro foco ou volte para Todos.</p>
      <button type="button" onClick={onAll} className="mt-4 h-9 rounded-lg border border-border px-3.5 text-[13px] font-semibold hover:bg-muted focus-visible:outline-none focus-visible:anel-foco">
        Ver todos
      </button>
    </div>
  );
}

// O dia fechado: tudo feito. As tarefas, a prospecção, o selo do dia perfeito
// e o que vem amanhã (`tomorrow` já vem desenhado pela Meta).
export function DiaFechado({ doneSlots, volume, perfectDay, tomorrow }) {
  return (
    <div className={cn(CARD, 'mt-3.5 px-7 py-7')}>
      <div className="flex items-start gap-4">
        <span className="grid size-12 flex-none place-items-center rounded-full bg-emerald-50 dark:bg-emerald-500/10"><CheckCircle size={24} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" /></span>
        <div className="min-w-0">
          <h2 className="font-display text-[22px] font-bold tracking-[-0.02em]">Tudo feito por hoje</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Você fechou {doneSlots === 1 ? 'a tarefa' : `as ${doneSlots} tarefas`} do dia.
            {volume.target > 0 && <> Prospecção: <span className="num font-semibold text-foreground">{volume.count} de {volume.target}</span>.</>}
          </p>
          {perfectDay && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[12.5px] font-semibold text-accent-600 dark:bg-accent-500/15 dark:text-accent-400">
              <Sparkles size={14} aria-hidden="true" /> Dia perfeito
            </p>
          )}
        </div>
      </div>
      {tomorrow}
    </div>
  );
}
