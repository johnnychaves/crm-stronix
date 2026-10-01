// A faixa fina do próximo contrato: só quando existe um contrato que ainda não
// começou e outro em uso. Plano, quando começa, até quando, valor e média, o
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
const NUM = 'num text-[12px] text-slate-600 dark:text-slate-300';
const STRONG = 'font-semibold text-slate-900 dark:text-white';

export function NextContractStrip({ next, facts, joinText, now, canUndo, isReadOnly, loading, onActivate, onEditContract, onContractAction }) {
  const start = getSafeDateOrNull(next.startsAt);
  const end = getSafeDateOrNull(next.endsAt);
  const daysToStart = start ? Math.max(0, calendarDaysBetween(now, start) || 0) : 0;
  return (
    <section className="rounded-2xl border border-border border-l-[3px] border-l-violet-500 bg-card shadow-card flex items-center gap-4 flex-wrap px-[22px] py-3.5">
      <div className="min-w-0 flex-1 flex items-center gap-x-4 gap-y-1.5 flex-wrap">
        <span className="inline-flex items-center h-[19px] px-[7px] rounded-[5px] text-[9.5px] font-bold uppercase tracking-[.05em] whitespace-nowrap bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">Próximo</span>
        <span className="font-display text-[15px] font-bold tracking-tight">{facts.planName || '—'}</span>
        <span className={NUM}>começa em <b className={STRONG}>{fmtDia(start)}</b>{`, daqui a ${dias(daysToStart)}`}</span>
        <span className={NUM}>{`até ${fmtDia(end)}`}</span>
        <span className={NUM}>
          <b className={STRONG}>{facts.value != null ? fmtBRL(facts.value) : '—'}</b>
          {facts.monthly != null ? ` · ${fmtBRL(facts.monthly)}/mês` : ''}
        </span>
        {joinText && <span className="text-[12px] text-muted-foreground">{joinText}</span>}
      </div>
      {!isReadOnly && (
        <div className="flex items-center gap-1 flex-none">
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
