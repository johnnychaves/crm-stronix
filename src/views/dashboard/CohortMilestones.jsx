// Safra do mês (handoff do CRM, linhas 271 a 321): os leads cadastrados no
// mês, acompanhados até hoje. À esquerda, as duas passagens sobre a mesma base
// (agendaram, compareceram), com a queda escrita ao lado; à direita, o
// desfecho (matricularam, seguem em jogo, perdidos). O azul de "seguem em
// jogo" fica entre o verde e o vermelho, que nunca se tocam (README §4).
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { pct } from '../../lib/crm/stats.js';
import { plural } from '../../lib/crm/format.js';
import { ChartMark } from './ChartMark.jsx';
import { DashHelpTip } from './DashPrimitives.jsx';
import { CrmCard, DashedNote, Eyebrow, ReadText } from './CrmParts.jsx';

const SAFRA_HELP = 'Safra é a turma de leads cadastrados no mês. Os marcos são cumulativos e sempre sobre a mesma turma, então a conta nunca passa de 100%. Um lead que agendou, faltou e matriculou depois conta em agendou e em matriculou, não em compareceu.';
const SEGMENT = 'block h-full min-w-[6px] border-r-2 border-white last:border-r-0 dark:border-ink-800';

export function CohortMilestones({ cohort, monthName, running }) {
  const leads = cohort?.leads || 0;
  const help = <DashHelpTip text={SAFRA_HELP} label="Como ler a safra" />;
  if (leads === 0) {
    return (
      <CrmCard title={`Safra de ${monthName}`} hint="nenhum lead cadastrado no mês" action={help}>
        <div className="p-[18px]"><DashedNote title="Nenhum lead cadastrado neste mês." /></div>
      </CrmCard>
    );
  }
  const hint = leads === 1
    ? '1 lead cadastrado no mês, acompanhado até hoje'
    : `os ${fmtNum(leads)} leads cadastrados no mês, acompanhados até hoje`;
  const passages = [
    { name: 'Agendaram', count: cohort.sched, prev: leads, bar: 'bg-brand-500', gone: 'não agendaram' },
    { name: 'Compareceram', count: cohort.came, prev: cohort.sched, bar: 'bg-brand-600', gone: 'não compareceram' }
  ];
  const outcome = [
    { name: 'Matricularam', count: cohort.enrolled, bar: 'bg-success dark:bg-[#0E9F6E]' },
    { name: 'Seguem em jogo', count: cohort.open, bar: 'bg-brand-600' },
    { name: 'Perdidos', count: cohort.lost, bar: 'bg-danger dark:bg-[#E11D48]' }
  ];
  const outTotal = Math.max(1, cohort.enrolled + cohort.open + cohort.lost);
  const passageRead = leads - cohort.sched >= cohort.sched - cohort.came
    ? 'A maior queda da safra é entre cadastrar e agendar: trazer a pessoa para uma visita ou aula é o passo que menos acontece.'
    : 'A maior queda da safra é entre agendar e comparecer: quem marca nem sempre vem.';
  const outcomeRead = running
    ? `A safra de ${monthName} ainda está viva: quem segue em jogo pode virar matrícula e a conversão vai subir até o mês fechar.`
    : `A safra de ${monthName} já fechou o mês, mas quem segue em jogo ainda pode matricular, e a conversão dela continua andando.`;

  return (
    <CrmCard title={`Safra de ${monthName}`} hint={hint} action={help}>
      <div className="grid grid-cols-1 gap-[26px] p-[18px] md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div>
          <Eyebrow>Passagem da safra</Eyebrow>
          <div className="mt-[11px] flex flex-col gap-[9px]">
            {passages.map((p) => {
              const share = pct(p.count, leads);
              const gone = p.prev - p.count;
              return (
                <div key={p.name} className="grid grid-cols-[118px_minmax(0,1fr)] items-center gap-3.5">
                  <div>
                    <div className="text-[12.5px] font-semibold">{p.name}</div>
                    <div className="num text-[11px] text-muted-foreground">{gone === 0 ? 'ninguém saiu aqui' : `−${fmtNum(gone)} ${p.gone}`}</div>
                  </div>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ChartMark
                      tip={`${p.name}: ${fmtNum(p.count)} de ${plural(leads, 'lead', 'leads')} da safra de ${monthName} (${share}%)`}
                      className={cn('block h-6 min-w-[3px] rounded-[5px]', p.bar)}
                      style={{ width: `${Math.round((p.count / leads) * 100)}%` }}
                    />
                    <span className="num whitespace-nowrap text-[13px] font-bold">{fmtNum(p.count)}</span>
                    <span className="num whitespace-nowrap text-[11.5px] text-muted-foreground">{`${share}% da safra`}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <ReadText>{passageRead}</ReadText>
        </div>
        <div>
          <Eyebrow>Desfecho da safra</Eyebrow>
          <div className="mt-[9px] flex h-[34px] overflow-hidden rounded-[9px] bg-muted">
            {outcome.filter((o) => o.count > 0).map((o) => (
              <ChartMark
                key={o.name}
                tip={`${o.name}: ${fmtNum(o.count)} de ${plural(outTotal, 'lead', 'leads')} da safra`}
                className={cn(SEGMENT, o.bar)}
                style={{ width: `${Math.round((o.count / outTotal) * 100)}%` }}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-[7px]">
            {outcome.map((o) => (
              <div key={o.name} className="flex items-center gap-2">
                <i className={cn('block size-[9px] flex-none rounded-[3px]', o.bar)} />
                <span className="min-w-0 flex-1 text-[12.5px]">{o.name}</span>
                <span className="num text-[12.5px] font-bold">{fmtNum(o.count)}</span>
                <span className="num w-[38px] text-right text-[11.5px] text-muted-foreground">{`${pct(o.count, outTotal)}%`}</span>
              </div>
            ))}
          </div>
          <ReadText>{outcomeRead}</ReadText>
        </div>
      </div>
    </CrmCard>
  );
}
