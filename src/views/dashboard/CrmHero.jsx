// O topo da tela do CRM (mockup A, "Jornada"): a conversão da safra do mês em
// número grande e, ao lado, o caminho que ela fez: cadastraram, agendaram,
// compareceram, matricularam, com a queda de cada passo escrita. Embaixo, o
// desfecho da safra: quem matriculou, quem segue em jogo e quem se perdeu.
//
// Safra é a turma de leads cadastrados no mês, acompanhada até hoje. Ela
// continua viva depois do mês fechar, e é por isso que a conversão dela sobe.
//
// Props:
//   cohort    { leads, sched, came, enrolled, open, lost, conv } ou null
//   monthName nome do mês, em minúsculas
//   delta     o crmDelta da conversão contra o mês comparado, ou null
//   cmpName   nome do mês comparado
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { pct } from '../../lib/crm/stats.js';
import { ChartMark } from './ChartMark.jsx';
import { DashHelpTip } from './DashPrimitives.jsx';

export const SAFRA_HELP = 'Safra é a turma de leads cadastrados no mês, acompanhada até hoje. Cada passo é cumulativo e sobre a mesma turma, então a conta nunca passa de 100%. Um lead que agendou, faltou e matriculou depois conta em agendou e em matriculou, não em compareceu.';

function Step({ name, count, width, hint }) {
  return (
    <>
      <div className="grid grid-cols-[104px_minmax(0,1fr)_44px] items-center gap-3.5 py-2 sm:grid-cols-[128px_minmax(0,1fr)_56px]">
        <span className="text-white/80">{name}</span>
        <ChartMark
          tip={`${name}: ${fmtNum(count)} (${width}% da safra)`}
          className="block h-[30px] rounded-[9px] bg-white/10"
        >
          <i className="block h-full min-w-[4px] rounded-[9px] bg-gradient-to-r from-[#4F74FF] to-[#7FA0FF]" style={{ width: `${Math.max(width, 2)}%` }} />
        </ChartMark>
        <b className="num text-right font-display text-[20px] font-bold">{fmtNum(count)}</b>
      </div>
      {hint && <div className="mb-0.5 pl-[118px] text-[12px] text-white/60 sm:pl-[142px]">{`↳ ${hint}`}</div>}
    </>
  );
}

export function CrmHero({ cohort, monthName, delta, cmpName }) {
  const leads = cohort?.leads || 0;
  const has = cohort != null && leads > 0;
  const pill = delta && (delta.none
    ? { text: delta.text, tone: 'quiet' }
    : delta.flat
      ? { text: `igual a ${cmpName}`, tone: 'quiet' }
      : { text: `${delta.up ? '▲' : '▼'} ${String(delta.text).replace(/^[+−-]\s?/, '')} sobre ${cmpName}`, tone: delta.up ? 'good' : 'bad' });
  const outTotal = Math.max(1, (cohort?.enrolled || 0) + (cohort?.open || 0) + (cohort?.lost || 0));
  const outcome = [
    { name: 'matricularam', count: cohort?.enrolled || 0, fill: 'bg-[#34D399]' },
    { name: 'em jogo', count: cohort?.open || 0, fill: 'bg-[#7FA0FF]' },
    { name: 'perdidos', count: cohort?.lost || 0, fill: 'bg-[#FB7185]' }
  ];
  const steps = has ? [
    { name: 'Cadastraram', count: leads, width: 100, hint: `${pct(cohort.sched, leads)}% dos cadastros agendaram` },
    { name: 'Agendaram', count: cohort.sched, width: pct(cohort.sched, leads), hint: `${pct(cohort.came, cohort.sched) ?? 0}% dos agendados compareceram` },
    { name: 'Compareceram', count: cohort.came, width: pct(cohort.came, leads), hint: `${pct(cohort.enrolled, cohort.came) ?? 0}% de quem veio matriculou` },
    { name: 'Matricularam', count: cohort.enrolled, width: pct(cohort.enrolled, leads), hint: null }
  ] : [];

  return (
    <section className="grid grid-cols-1 items-center gap-8 rounded-[22px] bg-ink-900 bg-[radial-gradient(900px_340px_at_90%_-30%,#22357a_0,transparent_60%)] px-6 py-8 text-white md:px-9 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]">
      <div>
        <div className="flex items-center gap-2 text-[15px] text-white/70">
          {`Conversão da safra de ${monthName}`}
          <DashHelpTip text={SAFRA_HELP} label='O que é "Conversão da safra"?' />
        </div>
        <div className="num mt-3 font-display text-[clamp(52px,7vw,92px)] font-bold leading-[0.95] tracking-[-0.045em]">
          {has && cohort.conv != null ? `${cohort.conv}%` : '—'}
        </div>
        <div className="mt-3.5 flex flex-wrap items-center gap-3">
          {pill && (
            <span
              className={cn(
                'num inline-flex h-[26px] items-center whitespace-nowrap rounded-lg px-2.5 text-[12.5px] font-bold',
                pill.tone === 'good' ? 'bg-emerald-400/15 text-emerald-300'
                  : pill.tone === 'bad' ? 'bg-rose-400/15 text-rose-300' : 'bg-white/10 text-white/70'
              )}
            >
              {pill.text}
            </span>
          )}
          {has && <span className="num text-white/80">{`${fmtNum(cohort.enrolled)} de ${fmtNum(leads)} leads`}</span>}
        </div>
        <p className="mt-4 text-pretty text-[13px] text-white/60">
          {has
            ? `Safra é a turma de leads que entrou no mês. Ela continua viva: ${fmtNum(cohort.open)} ${cohort.open === 1 ? 'segue' : 'seguem'} em jogo.`
            : 'Nenhum lead cadastrado neste mês.'}
        </p>
      </div>

      {has && (
        <div>
          {steps.map((s) => <Step key={s.name} {...s} />)}
          <div className="mt-[18px] flex h-3.5 overflow-hidden rounded-[7px] bg-white/10">
            {outcome.filter((o) => o.count > 0).map((o) => (
              <ChartMark
                key={o.name}
                tip={`${fmtNum(o.count)} ${o.name} de ${fmtNum(outTotal)} leads da safra`}
                className={cn('block h-full', o.fill)}
                style={{ width: `${Math.round((o.count / outTotal) * 100)}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-[18px] gap-y-1 text-[12.5px] text-white/75">
            {outcome.map((o) => (
              <span key={o.name} className="inline-flex items-center gap-1.5">
                <i className={cn('block size-2 rounded-full', o.fill)} />
                {`${fmtNum(o.count)} ${o.name}`}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
