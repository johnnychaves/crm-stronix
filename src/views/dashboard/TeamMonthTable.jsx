// Tabela da equipe no mês: uma linha por pessoa (clicar filtra a tela por
// ela) e o rodapé com a equipe toda. Handoff linhas 583 a 661; lógica de
// exemplo 1673 a 1706. Abaixo de 768px vira lista com as três taxas numa
// linha de texto (handoff 780 a 800). Usada pela DashboardOperacionalView.
//
// A venda é de quem está no contrato (entraram, upgrades) e a carteira é de
// quem cuida do cliente hoje (taxa de renovação), README §8. A linha "Outros"
// junta o que não é de ninguém da equipe (ex-consultor ou sem responsável),
// para as linhas fecharem com o rodapé. Só aparece com algum número, não tem
// meta nem prospecção e não filtra a tela. Sem o histórico dos colegas
// (metaHidden), a meta de quem ficou sem número mostra "—", sem barra.

import { Users } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { OTHERS_ID } from '../../lib/operacional/metrics.js';
import { dashInitials } from './dashTokens.js';

const RULE = 'border-slate-100 dark:border-white/[0.06]';
const SOFT = 'bg-slate-50 dark:bg-white/[0.03]';
const HEAD = 'text-[9.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground';
const COUNT = 'num w-[78px] flex-none text-right text-[12.5px] font-semibold';
const TOTAL = 'num flex-none text-[12px] font-bold';
const OTHERS_SUB = 'fora da equipe ou sem responsável';

const pctText = (v) => (v != null ? `${v}%` : '—');
const numText = (v) => (v != null ? fmtNum(v) : '—');
const barWidth = (v) => `${Math.min(100, Math.max(0, v || 0))}%`;
const roleOf = (user) => (user.role === 'admin' ? 'Gestor' : 'Consultor');
const prospLine = (p) => (p && !p.on ? 'desligada' : pctText(p?.pct ?? null));

function Bar({ pct, fill }) {
  return (
    <div className="flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
      <span className={cn('rounded-full', fill)} style={{ width: barWidth(pct) }} />
    </div>
  );
}

function NameCell({ name, sub, others = false }) {
  return (
    <div className="flex w-[206px] flex-none items-center gap-2.5">
      <span
        className={cn(
          'grid size-7 flex-none place-items-center rounded-full text-[10px] font-bold',
          others ? 'bg-muted text-muted-foreground' : 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
        )}
      >
        {others ? <Users size={13} strokeWidth={2.2} /> : dashInitials(name)}
      </span>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold">{name}</div>
        <div className="truncate text-[10.5px] text-muted-foreground" title={others ? sub : undefined}>{sub}</div>
      </div>
    </div>
  );
}

function RowCells({ m, lateN, running, others = false }) {
  const meta = m.meta?.pct ?? null;
  const prosp = m.prosp;
  const rate = m.renewal?.rate ?? null;
  const good = rate != null && rate >= 75;
  const dash = <span className="num text-[11.5px] font-semibold text-muted-foreground">—</span>;
  return (
    <>
      <div className="flex w-[132px] flex-none items-center gap-2">
        {others || m.metaHidden ? dash : (
          <>
            <Bar pct={meta} fill="bg-brand-600" />
            <span className="num flex-none text-[11.5px] font-semibold">{pctText(meta)}</span>
          </>
        )}
      </div>
      <div className="flex w-[132px] flex-none items-center gap-2">
        {others ? dash : prosp && !prosp.on ? (
          <span className="flex h-5 items-center whitespace-nowrap rounded-md bg-muted px-2 text-[10.5px] font-semibold text-muted-foreground">
            Desligada
          </span>
        ) : (
          <>
            <Bar pct={prosp?.pct} fill="bg-accent-500 dark:bg-accent-600" />
            <span className="num flex-none text-[11.5px] font-semibold">{pctText(prosp?.pct ?? null)}</span>
          </>
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <Bar pct={rate} fill={good ? 'bg-success dark:bg-[#0E9F6E]' : 'bg-amber-500 dark:bg-amber-600'} />
        <span
          className={cn(
            'num flex-none text-[11.5px] font-semibold',
            rate == null ? 'text-muted-foreground' : good ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
          )}
        >
          {pctText(rate)}
        </span>
      </div>
      <span className={COUNT}>{numText(m.entered)}</span>
      <span className={COUNT}>{numText(m.upgrades)}</span>
      {running && (
        <span
          className={cn(
            'num w-[92px] flex-none text-right text-[12.5px] font-semibold',
            lateN == null ? 'text-muted-foreground' : lateN >= 8 ? 'text-rose-700 dark:text-rose-300' : 'text-foreground'
          )}
        >
          {numText(lateN)}
        </span>
      )}
    </>
  );
}

export function TeamMonthTable({ rows, others, total, running, onPick }) {
  const list = rows || [];
  // Atrasados é o retrato da equipe inteira; o número de cada um está em byUser.
  const lateOf = (id) => (total?.late ? (total.late.byUser.get(id) ?? 0) : null);
  const othersLate = lateOf(OTHERS_ID) || 0;
  const showOthers = Boolean(others) && (
    (others.entered || 0) > 0 || (others.upgrades || 0) > 0 || (others.renewal?.cohort || 0) > 0 || othersLate > 0
  );

  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-card md:block">
        <div className="overflow-x-auto">
          <div className="min-w-[860px]">
            <div className={cn('flex items-center gap-3.5 border-b px-[18px] py-[11px]', RULE, SOFT)}>
              <span className={cn('w-[206px] flex-none', HEAD)}>Pessoa</span>
              <span className={cn('w-[132px] flex-none', HEAD)}>Meta diária</span>
              <span className={cn('w-[132px] flex-none', HEAD)}>Prospecção</span>
              <span className={cn('min-w-0 flex-1', HEAD)}>Taxa de renovação</span>
              <span className={cn('w-[78px] flex-none text-right', HEAD)}>Entraram</span>
              <span className={cn('w-[78px] flex-none text-right', HEAD)}>Upgrades</span>
              {running && <span className={cn('w-[92px] flex-none text-right', HEAD)}>Atrasados agora</span>}
            </div>

            {list.map(({ user, m }) => (
              <button
                key={user.id}
                type="button"
                onClick={() => onPick(user.id)}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-3.5 border-b px-[18px] py-[11px] text-left outline-none hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/40',
                  RULE
                )}
              >
                <NameCell name={user.name || 'Sem nome'} sub={roleOf(user)} />
                <RowCells m={m} lateN={lateOf(user.id)} running={running} />
              </button>
            ))}

            {showOthers && (
              <div className={cn('flex items-center gap-3.5 border-b px-[18px] py-[11px]', RULE)}>
                <NameCell name="Outros" sub={OTHERS_SUB} others />
                <RowCells m={others} lateN={othersLate} running={running} others />
              </div>
            )}

            <div className={cn('flex items-center gap-3.5 px-[18px] py-[11px]', SOFT)}>
              <span className="w-[206px] flex-none text-[11.5px] font-bold text-foreground/80">Equipe toda</span>
              <span className={cn(TOTAL, 'w-[132px]')}>{pctText(total?.meta?.pct ?? null)}</span>
              <span className={cn(TOTAL, 'w-[132px]')}>{total?.prosp && !total.prosp.on ? 'Desligada' : pctText(total?.prosp?.pct ?? null)}</span>
              <span className={cn(TOTAL, 'min-w-0 flex-1')}>{pctText(total?.renewal?.rate ?? null)}</span>
              <span className={cn(TOTAL, 'w-[78px] text-right')}>{numText(total?.entered)}</span>
              <span className={cn(TOTAL, 'w-[78px] text-right')}>{numText(total?.upgrades)}</span>
              {running && (
                <span className={cn(TOTAL, 'w-[92px] text-right text-rose-700 dark:text-rose-300')}>{numText(total?.late?.total ?? null)}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[14px] border border-border bg-card p-[13px] shadow-card md:hidden">
        <div className="flex flex-col gap-[9px]">
          {list.map(({ user, m }) => {
            const lateN = lateOf(user.id);
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => onPick(user.id)}
                className="flex w-full items-center gap-2.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                <span className="grid size-[26px] flex-none place-items-center rounded-full bg-brand-50 text-[9.5px] font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  {dashInitials(user.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold">{user.name || 'Sem nome'}</div>
                  <div className="num truncate text-[10.5px] text-muted-foreground">
                    {`meta ${pctText(m.meta?.pct ?? null)} · prosp. ${prospLine(m.prosp)} · renov. ${pctText(m.renewal?.rate ?? null)}`}
                  </div>
                </div>
                {running && (
                  <span className={cn('num flex-none text-[12px] font-bold', lateN ? 'text-rose-700 dark:text-rose-300' : 'text-muted-foreground')}>
                    {numText(lateN)}
                  </span>
                )}
              </button>
            );
          })}
          {showOthers && (
            <div className="flex items-center gap-2.5">
              <span className="grid size-[26px] flex-none place-items-center rounded-full bg-muted text-muted-foreground">
                <Users size={12} strokeWidth={2.2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold">Outros</div>
                <div className="num truncate text-[10.5px] text-muted-foreground">
                  {`${OTHERS_SUB} · renov. ${pctText(others.renewal?.rate ?? null)}`}
                </div>
              </div>
              {running && (
                <span className={cn('num flex-none text-[12px] font-bold', othersLate ? 'text-rose-700 dark:text-rose-300' : 'text-muted-foreground')}>
                  {fmtNum(othersLate)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
