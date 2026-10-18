// A faixa fina do próximo contrato: só quando existe um contrato que ainda não
// começou e outro em uso. O plano e, numa frase, quando começa, até quando,
// valor e média (desenho A2, 16/10/2026), o
// encaixe com o contrato em uso (joinTextOf) e os botões Ativar agora,
// Corrigir e Cancelar renovação. O último vira "Cancelar" quando a renovação
// não pode ser desfeita, porque o contrato renovado foi cancelado
// (isRenewalNotStarted, decidido pela aba).
// Mockup: docs/superpowers/specs/mockups/2026-09-30-aba-contratos-em-uso.html
import { Play } from 'lucide-react';
import { calendarDaysBetween, getSafeDateOrNull } from '../../../lib/dates.js';
import { fmtBRL } from '../../../lib/format.js';
import { Btn } from '../../ui/Btn.jsx';
import { LINK_BTN, LINK_BTN_DANGER } from './tone.js';

const fmtDia = (d) => (d ? d.toLocaleDateString('pt-BR') : '—');
const dias = (n) => `${n} ${n === 1 ? 'dia' : 'dias'}`;
const STRONG = 'font-semibold text-slate-900 dark:text-white';

export function NextContractStrip({ next, facts, joinText, now, canUndo, isReadOnly, loading, onActivate, onEditContract, onContractAction }) {
  const start = getSafeDateOrNull(next.startsAt);
  const end = getSafeDateOrNull(next.endsAt);
  const daysToStart = start ? Math.max(0, calendarDaysBetween(now, start) || 0) : 0;
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-border border-l-[3px] border-l-violet-500 bg-card px-[22px] py-3.5 shadow-card">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex h-6 items-center rounded-full bg-violet-500/10 px-2.5 text-[12px] font-semibold whitespace-nowrap text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">Próximo</span>
          <span className="font-display text-[17px] font-bold tracking-tight">{facts.planName || '—'}</span>
        </div>
        <p className="num mt-1.5 text-pretty text-[13.5px] leading-[1.5] text-slate-600 dark:text-slate-300">
          Começa em <b className={STRONG}>{fmtDia(start)}</b>{`, daqui a ${dias(daysToStart)}.`} {`Vai até ${fmtDia(end)}.`}{' '}
          <b className={STRONG}>{facts.value != null ? fmtBRL(facts.value) : '—'}</b>
          {facts.monthly != null ? `, ${fmtBRL(facts.monthly)} por mês.` : '.'}
        </p>
        {joinText && <p className="mt-0.5 text-[13px] text-muted-foreground">{joinText}</p>}
      </div>
      {!isReadOnly && (
        <div className="flex flex-none items-center gap-1">
          <Btn kind="brand" icon={<Play size={12} />} onClick={() => onActivate(next)} disabled={loading}>Ativar agora</Btn>
          <button type="button" onClick={() => onEditContract(next)} disabled={loading} className={LINK_BTN}>Corrigir</button>
          <button type="button" onClick={() => onContractAction('cancelar', next)} disabled={loading} className={LINK_BTN_DANGER}>
            {canUndo ? 'Cancelar renovação' : 'Cancelar'}
          </button>
        </div>
      )}
    </section>
  );
}
