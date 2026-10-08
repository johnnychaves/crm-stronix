import { Building2, Check, ChevronDown, Dumbbell, Phone, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { firstName } from '../../lib/rotinas.js';
import { PersonInitials } from './PersonInitials.jsx';
import { StateMark } from './StateMark.jsx';

// Os desenhos da apresentação das Rotinas, um por passo (mockup
// 2026-10-08-rotinas-intro-e-polimento.html, Pop-up 1, e o passo da aba Hoje
// do 2026-10-08-rotinas-aba-hoje.html). São desenhos: os nomes e os números
// são inventados, e o pop-up os esconde do leitor de tela (aria-hidden no
// lugar deles). O do último passo não tem a linha do dia de ninguém, como a
// aba Hoje.

const MINI = 'w-full rounded-[14px] border border-border bg-card p-3.5 text-left shadow-[0_12px_30px_-14px_rgba(14,26,64,.35)]';
const FIELD_LABEL = 'mb-1 mt-2.5 text-[10.5px] font-semibold text-muted-foreground';
const FAKE_INPUT = 'flex h-[30px] items-center rounded-lg border border-border bg-card px-[9px] text-[12px]';
const FOCUS = 'border-brand-600 ring-[3px] ring-brand-600/10';

function MiniHead({ title, children }) {
  return (
    <p className="flex items-baseline justify-between gap-2">
      <span className="font-display text-[13.5px] font-semibold">{title}</span>
      {children}
    </p>
  );
}

// O botão de verdade que o passo manda clicar ("+ Novo modelo").
function Where({ children }) {
  return (
    <span className="inline-flex h-[22px] items-center gap-[5px] whitespace-nowrap rounded-[7px] bg-brand-600 px-2 text-[11px] font-semibold text-white">
      <Plus className="size-3" />
      {children}
    </span>
  );
}

function MiniCheck({ done }) {
  return (
    <span
      className={cn(
        'grid size-3.5 shrink-0 place-items-center rounded-full border-2',
        done ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500' : 'border-slate-300 dark:border-white/20',
      )}
    >
      {done && <Check className="size-2" strokeWidth={3.5} />}
    </span>
  );
}

// Passo 0: a Meta diária (leads) e a Rotina (o dia) lado a lado.
export function IntroWhat() {
  const leads = [[Building2, 'Visita da Marina, 18h'], [Phone, 'Ligar para o Rafael'], [Dumbbell, 'Aula experimental da Bia']];
  const rotina = [[true, 'Abrir a recepção'], [false, 'Postar o story da aula'], [false, 'Atualizar o Stronilead']];
  return (
    <div className="grid w-full max-w-[440px] grid-cols-2 gap-2.5">
      <div className="min-w-0">
        <p className="mb-[5px] ml-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Meta diária · leads</p>
        <ul className={cn(MINI, 'flex flex-col gap-[5px] p-2.5 opacity-75 shadow-none')}>
          {leads.map(([Icon, label]) => (
            <li key={label} className="flex items-center gap-[7px] rounded-[7px] px-[5px] py-1 text-[11.5px]">
              <span className="grid size-[18px] shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                <Icon className="size-[11px]" />
              </span>
              <span className="min-w-0 truncate">{label}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="min-w-0">
        <p className="mb-[5px] ml-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-300">Rotina · o dia</p>
        <ul className={cn(MINI, 'flex flex-col gap-[5px] border-brand-600/45 p-2.5 shadow-[0_12px_30px_-14px_rgba(43,89,255,.55)]')}>
          {rotina.map(([done, label]) => (
            <li key={label} className="flex items-center gap-[7px] rounded-[7px] px-[5px] py-1 text-[11.5px]">
              <MiniCheck done={done} />
              <span className={cn('min-w-0 truncate', done && 'text-muted-foreground line-through decoration-muted-foreground/60')}>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Passo 1: o painel Novo modelo.
export function IntroCreateModel() {
  return (
    <div className={cn(MINI, 'max-w-[300px]')}>
      <MiniHead title="Novo modelo"><Where>Novo modelo</Where></MiniHead>
      <p className={FIELD_LABEL}>Nome do modelo</p>
      <p className={cn(FAKE_INPUT, FOCUS)}>Consultor manhã</p>
      <p className={FIELD_LABEL}>Começar</p>
      <p className="grid grid-cols-2 gap-[3px] rounded-[9px] bg-muted p-[3px] text-center text-[11px]">
        <span className="rounded-[7px] bg-card py-[5px] font-semibold shadow-card">Em branco</span>
        <span className="py-[5px] text-muted-foreground">Cópia de um modelo</span>
      </p>
      <p className="mt-3 grid h-[30px] place-items-center rounded-lg bg-brand-600 text-[12px] font-semibold text-white">Criar modelo</p>
    </div>
  );
}

// Passo 2: o painel Nova tarefa.
export function IntroAddTasks() {
  const days = [['Seg', true], ['Ter', true], ['Qua', true], ['Qui', true], ['Sex', true], ['Sáb', false]];
  return (
    <div className={cn(MINI, 'max-w-[300px]')}>
      <MiniHead title="Nova tarefa"><Where>Nova tarefa</Where></MiniHead>
      <p className={FIELD_LABEL}>O que fazer</p>
      <p className={cn(FAKE_INPUT, FOCUS)}>Postar o story da aula</p>
      <p className={FIELD_LABEL}>Dias</p>
      <p className="flex gap-1">
        {days.map(([day, on]) => (
          <span key={day} className={cn('grid h-6 w-[30px] place-items-center rounded-[7px] text-[10.5px] font-semibold', on ? 'bg-brand-600 text-white' : 'bg-muted text-muted-foreground')}>
            {day}
          </span>
        ))}
      </p>
      <p className={FIELD_LABEL}>Horário (se quiser)</p>
      <p className={cn(FAKE_INPUT, 'w-[90px]')}>09:00</p>
    </div>
  );
}

// Passo 3: a lista Consultores, com quem está sem modelo em destaque.
export function IntroFollowers() {
  const rows = [['Ana Souza', 'Consultor manhã', false], ['Bruno Lima', 'Consultor manhã', false], ['Carla Dias', 'Escolher modelo', true]];
  return (
    <div className={cn(MINI, 'max-w-[320px]')}>
      <MiniHead title="Consultores"><span className="text-[11px] font-medium text-muted-foreground">um modelo para cada</span></MiniHead>
      <ul className="mt-2">
        {rows.map(([name, pick, off]) => (
          <li key={name} className={cn('flex items-center gap-2 rounded-[9px] border-t border-border px-2 py-[7px] text-[12px] first:border-t-0', off && 'bg-amber-500/[0.06]')}>
            <PersonInitials name={name} size={26} />
            <span className="min-w-0 truncate">{name}</span>
            <span
              className={cn(
                'ml-auto inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-[7px] border border-border bg-card px-2 text-[11px]',
                off && 'border-brand-600 font-semibold text-brand-600 ring-[3px] ring-brand-600/10 dark:text-brand-300',
              )}
            >
              {pick}
              <ChevronDown className="size-3.5" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Passo 4: o cartão "Rotina de hoje" da Meta diária, com uma observação.
export function IntroCheck() {
  const rows = [['06:00', 'Abrir a recepção', 'done'], ['06:30', 'Conferir a agenda', 'done'], ['07:00', 'Lista de contatos', 'now'], ['07:30', 'Follow-ups', 'later']];
  return (
    <div className={cn(MINI, 'max-w-[280px]')}>
      <p className="flex items-baseline justify-between">
        <span className="font-display text-[13px] font-semibold">Rotina de hoje</span>
        <span className="text-[11px] text-muted-foreground">2 de 8</span>
      </p>
      <ul className="mt-2.5 flex flex-col gap-1">
        {rows.map(([time, label, state]) => (
          <li
            key={time}
            className={cn('grid grid-cols-[38px_18px_minmax(0,1fr)] items-center gap-2 rounded-lg px-1.5 py-[5px] text-[12px]', state === 'now' && 'bg-brand-600/[0.08] shadow-[inset_2px_0_0_var(--color-brand-600)]')}
          >
            <span className="num text-[11px] font-medium text-muted-foreground">{time}</span>
            <StateMark state={state} className="size-4" />
            <span className={cn('min-w-0 truncate', state === 'done' && 'text-muted-foreground line-through decoration-muted-foreground/60')}>
              {label}
              {state === 'now' && <span className="ml-1.5 text-[9.5px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-300">agora</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="ml-16 mt-0.5 text-[11px] italic text-muted-foreground">“3 experimentais hoje”</p>
    </div>
  );
}

// Passo 5: a aba Hoje em miniatura, uma pessoa por linha com a contagem, e a
// tarefa atrasada em vermelho. Sem linha do dia. Os textos são os do cartão de
// verdade ("1 atrasada", "nada atrasado", PersonDayCard).
export function IntroToday() {
  const rows = [['Ana Souza', '5 de 11', '1 atrasada', true], ['Bruno Lima', '6 de 11', 'nada atrasado', false], ['Carla Dias', '0 de 6', 'nada atrasado', false]];
  return (
    <div className={cn(MINI, 'max-w-[330px] py-3')}>
      <p className="flex items-baseline justify-between">
        <span className="font-display text-[13px] font-semibold">Hoje</span>
        <span className="text-[11px] text-muted-foreground">Ao vivo · 10:47</span>
      </p>
      <ul className="mt-1.5">
        {rows.map(([name, count, status, late]) => (
          <li key={name} className="flex items-center gap-2 border-t border-border py-1.5 text-[12px] first:border-t-0">
            <PersonInitials name={name} size={24} />
            <span className="font-semibold">{firstName(name)}</span>
            <span className="num ml-auto font-display font-semibold">{count}</span>
            <span className={cn('w-[78px] shrink-0 whitespace-nowrap text-right text-[10.5px]', late ? 'font-semibold text-rose-600 dark:text-rose-300' : 'text-muted-foreground')}>{status}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 rounded-[9px] bg-rose-50 px-[9px] py-[7px] text-[11.5px] font-semibold text-rose-600 dark:bg-[#2a1326] dark:text-rose-300">
        Ana · Ligações para leads novos ·{' '}
        <span className="whitespace-nowrap">atrasada há 47 min</span>
      </p>
    </div>
  );
}
