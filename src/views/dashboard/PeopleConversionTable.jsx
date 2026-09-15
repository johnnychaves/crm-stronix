// Conversão por pessoa (handoff do CRM, linhas 440 a 478): uma linha por
// pessoa, clicável para filtrar a tela; clicar de novo na mesma linha limpa.
// Com uma pessoa escolhida, a tabela reduz à linha dela e ganha o botão "Ver a
// equipe toda". A linha Outros junta quem está fora da equipe e não filtra.
// É uma tabela diferente da do Operacional de propósito: outras colunas e
// outra regra de atribuição (README §2). No celular vira lista. Matrícula e
// conversão em verde, no mesmo formato do card de professores ao lado.
import { Users } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { fmtDuration, plural } from '../../lib/crm/format.js';
import { dashInitials } from './dashTokens.js';
import { CrmCard, ReadText } from './CrmParts.jsx';

const RULE = 'border-slate-100 dark:border-white/[0.06]';
const GRID = 'grid grid-cols-[minmax(0,1fr)_44px_48px_52px_48px_116px_78px] items-center gap-2.5';
const HEAD = 'text-[10px] font-bold uppercase tracking-[0.05em] text-muted-foreground';
const GREEN_TEXT = 'text-emerald-700 dark:text-emerald-300';
const GREEN_FILL = 'bg-success dark:bg-[#0E9F6E]';
const FOOT = 'Conversão da safra: dos leads que a pessoa captou no mês, quantos já matricularam. Nunca passa de 100%, e é diferente de matrículas, que conta o que ela fechou no mês vindo de qualquer safra.';
const OTHERS_SUB = 'fora da equipe ou sem responsável';

const roleOf = (user) => (user.role === 'admin' ? 'Gestor' : 'Consultor');
const pctText = (v) => (v == null ? '—' : `${v}%`);
const numText = (v) => (v == null ? '—' : fmtNum(v));
const leadsText = (v) => (v == null ? '—' : plural(v, 'lead', 'leads'));
// Verde para o número que existe; o traço de sem dado fica neutro.
const greenIf = (v) => (v == null ? 'text-muted-foreground' : GREEN_TEXT);

const valuesOf = (m) => ({
  leads: m?.leads ?? null,
  appts: m?.appts?.total ?? null,
  attend: m?.appts?.rate ?? null,
  enroll: m?.enroll ?? null,
  conv: m?.cohort?.conv ?? null,
  fc: m?.firstContact?.median ?? null
});

// O aria-label do botão da linha troca todo o conteúdo visual pro leitor de
// tela, então precisa levar os números junto: só o nome deixaria a pessoa
// cega pra tabela sem saber o que está filtrando.
const count = (v, one, many) => (v == null ? `sem dado de ${many}` : plural(v, one, many));
const rowLabel = (name, v) => `${name}: ${count(v.leads, 'lead', 'leads')}, ${count(v.appts, 'agendamento', 'agendamentos')}, comparecimento ${v.attend == null ? 'sem dado' : `${v.attend}%`}, ${count(v.enroll, 'matrícula', 'matrículas')}, conversão da safra ${v.conv == null ? 'sem dado' : `${v.conv}%`}, primeiro contato ${v.fc == null ? 'sem dado' : fmtDuration(v.fc)}. Filtrar a tela por essa pessoa.`;

const mobileLine = (v) =>
  `${leadsText(v.leads)} · ${numText(v.appts)} agend. · compar. ${pctText(v.attend)} · ${numText(v.enroll)} matr. · 1º contato ${fmtDuration(v.fc)}`;

function Avatar({ name, others = false }) {
  return (
    <span
      className={cn(
        'num grid size-8 flex-none place-items-center rounded-[9px] font-display text-[12px] font-semibold',
        others ? 'bg-muted text-muted-foreground' : 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
      )}
    >
      {others ? <Users size={14} strokeWidth={2.2} /> : dashInitials(name)}
    </span>
  );
}

function Who({ name, sub, others = false }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar name={name} others={others} />
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold">{name}</div>
        <div className="truncate text-[11px] text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}

function Cells({ v }) {
  return (
    <>
      <span className="num text-right text-[13px]">{numText(v.leads)}</span>
      <span className="num text-right text-[13px] text-muted-foreground">{numText(v.appts)}</span>
      <span className="num text-right text-[13px] text-muted-foreground">{pctText(v.attend)}</span>
      <span className={cn('num text-right text-[13px] font-semibold', greenIf(v.enroll))}>{numText(v.enroll)}</span>
      <div className="flex items-center gap-[9px]">
        <span className="relative block h-2.5 flex-1 overflow-hidden rounded-[5px] bg-muted">
          <i className={cn('absolute inset-y-0 left-0 rounded-[5px]', GREEN_FILL)} style={{ width: `${Math.min(100, v.conv || 0)}%` }} />
        </span>
        <span className={cn('num w-[34px] text-right text-[13px] font-bold', greenIf(v.conv))}>{pctText(v.conv)}</span>
      </div>
      <span className={cn('num text-right text-[12px]', v.fc != null && v.fc > 240 ? 'text-rose-700 dark:text-rose-300' : 'text-muted-foreground')}>
        {fmtDuration(v.fc)}
      </span>
    </>
  );
}

export function PeopleConversionTable({ rows, others, person, personName, onPick, onClear }) {
  const list = rows || [];
  const o = others ? valuesOf(others) : null;
  const showOthers = Boolean(o) && ((o.leads || 0) > 0 || (o.appts || 0) > 0 || (o.enroll || 0) > 0);
  const action = person ? (
    <button
      type="button"
      onClick={onClear}
      className="h-7 flex-none rounded-[9px] border border-border bg-card px-[11px] text-[11.5px] font-semibold text-foreground/80 hover:bg-muted/70"
    >
      Ver a equipe toda
    </button>
  ) : null;

  return (
    <CrmCard title="Conversão por pessoa" hint={person ? personName : 'clique numa linha para filtrar a tela por essa pessoa'} action={action}>
      <div className="px-[18px] pb-4 pt-2.5">
        <div className="hidden overflow-x-auto md:block">
          <div className="min-w-[560px]">
            <div className={cn(GRID, 'h-[26px]', HEAD)}>
              <span>Pessoa</span>
              <span className="text-right">Leads</span>
              <span className="text-right">Agend.</span>
              <span className="text-right">Compar.</span>
              <span className="text-right">Matr.</span>
              <span>Conversão da safra</span>
              <span className="text-right">1º contato</span>
            </div>
            {list.map(({ user, m }) => {
              const v = valuesOf(m);
              const name = user.name || 'Sem nome';
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => onPick(user.id)}
                  aria-label={rowLabel(name, v)}
                  aria-pressed={person === user.id}
                  className={cn(
                    GRID,
                    'h-[52px] w-full cursor-pointer rounded-lg border-t text-left outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/40',
                    RULE,
                    person === user.id && 'bg-brand-50 dark:bg-brand-500/10'
                  )}
                >
                  <Who name={name} sub={roleOf(user)} />
                  <Cells v={v} />
                </button>
              );
            })}
            {showOthers && (
              <div className={cn(GRID, 'h-[52px] border-t', RULE)}>
                <Who name="Outros" sub={OTHERS_SUB} others />
                <Cells v={o} />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-px md:hidden">
          {list.map(({ user, m }) => {
            const v = valuesOf(m);
            const name = user.name || 'Sem nome';
            const selected = person === user.id;
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => onPick(user.id)}
                aria-label={rowLabel(name, v)}
                aria-pressed={selected}
                className={cn(
                  '-mx-2 flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                  selected && 'bg-brand-50 dark:bg-brand-500/10'
                )}
              >
                <Avatar name={user.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold">{name}</div>
                  <div className="num truncate text-[10.5px] text-muted-foreground">{mobileLine(v)}</div>
                </div>
                <span className={cn('num flex-none text-[15px] font-bold', greenIf(v.conv))}>{pctText(v.conv)}</span>
              </button>
            );
          })}
          {showOthers && (
            <div className="-mx-2 flex items-center gap-2.5 px-2 py-1">
              <Avatar others />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold">Outros</div>
                <div className="num truncate text-[10.5px] text-muted-foreground">{mobileLine(o)}</div>
              </div>
              <span className={cn('num flex-none text-[15px] font-bold', greenIf(o.conv))}>{pctText(o.conv)}</span>
            </div>
          )}
        </div>
        <ReadText>{FOOT}</ReadText>
      </div>
    </CrmCard>
  );
}
