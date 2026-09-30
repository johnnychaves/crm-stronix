// O Histórico da aba Contratos: uma tabela com os contratos que não são o
// destaque nem o próximo, do mais novo para o mais antigo, e a linha que abre
// no clique com o resto dos detalhes. Sem botões nas linhas (decisão do
// Johnny, 30/09/2026). Os fatos vêm de contractFactsOf (lib/contractsTab.js).
// `defaultOpenId` existe para o teste de render, que não clica.
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { fmtBRL } from '../../../lib/format.js';
import { originTextOf } from '../../../lib/contractsTab.js';
import { CONTRACT_STATUS } from '../../../lib/contracts.js';
import { cn } from '../../../lib/utils.js';
import { CONTRACT_TONE, ORIGIN_LABEL } from './tone.js';
import { OriginIcon, StatusChip } from './shared.jsx';

const fmtDia = (d) => (d ? d.toLocaleDateString('pt-BR') : '—');
const dias = (n) => `${n} ${n === 1 ? 'dia' : 'dias'}`;
const TH = 'font-bold px-3 py-2.5';
const MUTED = 'text-[11.5px] text-slate-500 dark:text-slate-400';

// Um período de trancamento: "05/01/2025 a 25/01/2025", "desde 20/09/2026",
// com a marca da pausa que veio da importação ou refeita pelo total de dias.
const pauseText = (p) => `${p.to ? `${fmtDia(p.from)} a ${fmtDia(p.to)}` : `desde ${fmtDia(p.from)}`}${
  p.fromImport ? ' (da importação)' : p.reconstructed ? ' (refeito pelo total de dias)' : ''
}`;

function Detail({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[9.5px] font-bold uppercase tracking-[.08em] text-slate-400 dark:text-slate-500 whitespace-nowrap">{label}</dt>
      <dd className="mt-1 text-[12.5px] text-slate-700 dark:text-slate-200">{children}</dd>
    </div>
  );
}

function HistoryRow({ facts: f, open, onToggle }) {
  const tone = CONTRACT_TONE[f.status] || CONTRACT_TONE[CONTRACT_STATUS.VENCIDO];
  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          'border-t border-slate-100 dark:border-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/[0.03] cursor-pointer transition',
          open && 'bg-slate-50 dark:bg-white/[0.03]'
        )}
      >
        <td className="pl-[22px] pr-3 py-3">
          <div className="flex items-center gap-2.5">
            <span className={cn('size-7 flex-none rounded-full grid place-items-center', tone.block, tone.fg)} title={ORIGIN_LABEL[f.origin.kind]}>
              <OriginIcon kind={f.origin.kind} size={12} />
              <span className="sr-only">{ORIGIN_LABEL[f.origin.kind]}</span>
            </span>
            <div className="min-w-0">
              <div className="font-semibold truncate">{f.planName || '—'}</div>
              <div className={MUTED}>{originTextOf(f.origin)}</div>
            </div>
            <button
              type="button"
              aria-expanded={open}
              aria-label={open ? 'Fechar os detalhes do contrato' : 'Abrir os detalhes do contrato'}
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              className="ml-1 size-6 flex-none grid place-items-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-white/[0.06] transition"
            >
              <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} aria-hidden="true" />
            </button>
          </div>
        </td>
        <td className="num px-3 py-3">{fmtDia(f.start)}</td>
        <td className="num px-3 py-3">{fmtDia(f.plannedEnd)}</td>
        <td className="px-3 py-3">
          <div className="num">{fmtDia(f.actualEnd)}</div>
          {f.endReason.text && <div className={MUTED}>{f.endReason.text}</div>}
        </td>
        <td className="px-3 py-3">
          {f.pauseCount ? (
            <>
              <div className="num">{dias(f.pausedDays)}</div>
              <div className={MUTED}>{f.pauseCount === 1 ? '1 vez' : `${f.pauseCount} vezes`}</div>
            </>
          ) : <span className="text-slate-400 dark:text-slate-500">Nunca</span>}
        </td>
        <td className="num px-3 py-3 text-right font-semibold">{f.value != null ? fmtBRL(f.value) : '—'}</td>
        <td className="num px-3 py-3 text-right">{f.monthly != null ? fmtBRL(f.monthly) : '—'}</td>
        <td className="pl-3 pr-[22px] py-3 text-right"><StatusChip status={f.status} /></td>
      </tr>
      {open && (
        <tr className="bg-slate-50 dark:bg-white/[0.03]">
          <td colSpan={8} className="px-[22px] pb-4 pt-1">
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
              <Detail label="Desconto">
                {f.discount > 0.005 ? (
                  <>
                    <span className="num">{`−${fmtBRL(f.discount)}`}</span>{f.discountReason ? ` · ${f.discountReason.toLowerCase()}` : ''}
                    {f.listValue > 0 && <div className={cn('num', MUTED)}>{`tabela ${fmtBRL(f.listValue)}`}</div>}
                  </>
                ) : 'Sem desconto'}
              </Detail>
              <Detail label="Fechado por">
                {f.closedBy ? <span className="font-semibold">{f.closedBy}</span> : '—'}
                {f.closedAt && <div className={cn('num', MUTED)}>{`em ${fmtDia(f.closedAt)}`}</div>}
              </Detail>
              <Detail label="Código">
                <span className="num">{`#${f.shortId}`}</span>{f.months ? ` · ${f.months === 1 ? '1 mês' : `${f.months} meses`}` : ''}
              </Detail>
              {f.cancelledAt && (
                <Detail label="Cancelamento">
                  <span className="num">{fmtDia(f.cancelledAt)}</span>{f.cancelReason ? ` · ${f.cancelReason}` : ''}
                  {f.cancelNote && <div className={MUTED}>{f.cancelNote}</div>}
                </Detail>
              )}
              <Detail label="Trancamentos">
                {f.pauses.length ? f.pauses.map((p, i) => <div key={i} className="num">{pauseText(p)}</div>) : 'Nunca trancado'}
                {f.lockedAtRenewalStart && <div className={MUTED}>Estava trancado quando a renovação começou e voltou a correr junto com ela.</div>}
              </Detail>
            </dl>
          </td>
        </tr>
      )}
    </>
  );
}

export function ContractHistoryTable({ rows, firstName, hasContract, defaultOpenId = null }) {
  const [openId, setOpenId] = useState(defaultOpenId);
  const count = rows.length;
  return (
    <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-[22px] py-4 border-b border-slate-100 dark:border-white/[0.06]">
        <h3 className="text-[14.5px] font-semibold tracking-tight">Histórico</h3>
        <span className="num text-[10.5px] font-bold px-[7px] py-0.5 rounded-md bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
          {count === 1 ? '1 anterior' : `${count} anteriores`}
        </span>
        <div className="flex-1"></div>
        <span className={cn(MUTED, 'hidden sm:inline')}>A linha abre o desconto, quem fechou e o motivo</span>
      </div>
      {count === 0 ? (
        <div className="py-7 text-center">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">Nenhum contrato anterior</p>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
            {hasContract ? `Este é o primeiro contrato de ${firstName}.` : 'O histórico de planos aparecerá aqui.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="text-[9.5px] font-bold uppercase tracking-[.08em] text-slate-400 dark:text-slate-500">
                <th className="font-bold pl-[22px] pr-3 py-2.5">Contrato</th>
                <th className={TH}>Início</th>
                <th className={TH}>Fim previsto</th>
                <th className={TH}>Fim de fato</th>
                <th className={TH}>Trancado</th>
                <th className={cn(TH, 'text-right')}>Valor</th>
                <th className={cn(TH, 'text-right')}>Média/mês</th>
                <th className="font-bold pl-3 pr-[22px] py-2.5 text-right">Situação</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {rows.map((f) => (
                <HistoryRow key={f.id} facts={f} open={openId === f.id} onToggle={() => setOpenId(openId === f.id ? null : f.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
