// Perdas do mês (handoff do CRM, linhas 371 a 426; vazio, 715 a 724): o motivo
// mais comum em destaque, a cápsula de participação com a lista, e o
// sub-bloco da etapa em que o lead se perdeu. Nenhum rótulo dentro do
// segmento (README §3): o número fica na legenda. Portado do .dc.html, e não
// com o BreakdownCard (Decisão 4 do plano).
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { pct } from '../../lib/crm/stats.js';
import { plural } from '../../lib/crm/format.js';
import { ChartMark } from './ChartMark.jsx';
import { LOSS_PALETTE } from './dashTokens.js';
import { CrmCard, DashedNote, Eyebrow } from './CrmParts.jsx';

const RULE = 'border-slate-100 dark:border-white/[0.06]';

function LossStages({ stages, stageBase, monthName }) {
  if (!stageBase) {
    return (
      <p className="mt-2 text-pretty text-[11.5px] leading-normal text-muted-foreground">
        {`A etapa da perda só existe a partir de setembro de 2026, quando o sistema passou a gravar a troca de etapa. Em ${monthName} os motivos estão completos, a etapa não tem base.`}
      </p>
    );
  }
  if (!stages.length) {
    return <p className="mt-2 text-[11.5px] leading-normal text-muted-foreground">Nenhuma perda com etapa gravada neste mês.</p>;
  }
  const total = stages.reduce((a, s) => a + s.count, 0);
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="mt-[9px] flex flex-col gap-1.5">
      {stages.map((s) => (
        <div key={s.name} className="grid grid-cols-[96px_minmax(0,1fr)_24px] items-center gap-[9px]">
          <span className="truncate text-[11.5px] text-foreground/80">{s.name}</span>
          <ChartMark
            tip={`Perdidos na etapa ${s.name}: ${fmtNum(s.count)} de ${fmtNum(total)}`}
            className="block h-2.5 min-w-[3px] rounded-[5px] bg-danger/85 dark:bg-[#E11D48]/85"
            style={{ width: `${Math.round((s.count / max) * 100)}%` }}
          />
          <span className="num text-right text-[11.5px] font-semibold">{fmtNum(s.count)}</span>
        </div>
      ))}
    </div>
  );
}

export function LossCard({ losses, lossStages, stageBase, monthName }) {
  const total = losses?.total || 0;
  const reasons = (losses?.reasons || []).map((r, i) => ({
    ...r,
    pct: pct(r.count, total),
    color: LOSS_PALETTE[i % LOSS_PALETTE.length]
  }));
  const leader = reasons[0];
  const hint = total > 0 ? `${plural(total, 'lead perdido', 'leads perdidos')} em ${monthName}` : 'nenhuma perda registrada';
  return (
    <CrmCard title="Perdas" hint={hint}>
      {total === 0 || !leader ? (
        <div className="flex flex-1 p-[18px]">
          <DashedNote
            className="grid flex-1 place-content-center py-8"
            title="Nenhum lead perdido neste mês."
            text="Ninguém marcou perda no período. Se o time descarta sem registrar o motivo, este card fica vazio mesmo com leads saindo do funil."
          />
        </div>
      ) : (
        <div className="flex-1 px-[18px] py-4">
          <Eyebrow>Motivo mais comum</Eyebrow>
          <div className="mt-1.5 flex items-center gap-2.5">
            <span className="num font-display text-[32px] font-bold leading-[0.9] text-accent-500 dark:text-accent-400">{fmtNum(leader.count)}</span>
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold">{leader.name}</div>
              <div className="num text-[11.5px] text-muted-foreground">{`${fmtNum(leader.count)} de ${fmtNum(total)} · ${leader.pct}%`}</div>
            </div>
          </div>
          <div
            className="mt-3.5 flex h-[34px] overflow-hidden rounded-[9px] bg-muted"
            role="img"
            aria-label={`Participação dos motivos: ${reasons.map((r) => `${r.name} ${r.pct}%`).join(', ')}`}
          >
            {reasons.map((r) => (
              <div key={r.name} className={cn('h-full min-w-1 border-r-2 border-white last:border-r-0 dark:border-ink-800', r.color)} style={{ width: `${r.pct}%` }} />
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-[7px]">
            {reasons.map((r) => (
              <div key={r.name} className="flex items-center gap-2">
                <i className={cn('block size-[9px] flex-none rounded-full', r.color)} />
                <span className="min-w-0 flex-1 truncate text-[12.5px]">{r.name}</span>
                <span className="num text-[12.5px] font-bold">{fmtNum(r.count)}</span>
                <span className="num w-[34px] text-right text-[11.5px] text-muted-foreground">{`${r.pct}%`}</span>
              </div>
            ))}
          </div>
          <div className={cn('mt-3.5 border-t pt-3', RULE)}>
            <Eyebrow>Etapa em que se perdeu</Eyebrow>
            <LossStages stages={lossStages || []} stageBase={stageBase} monthName={monthName} />
          </div>
        </div>
      )}
    </CrmCard>
  );
}
