// Velocidade (handoff do CRM, linhas 523 a 584). O tempo até o primeiro
// contato tem a mediana e a distribuição em quatro faixas; a mediana entra
// com os sem contato no fim da fila (censura à direita). Os dias do cadastro
// até a matrícula vão num histograma de seis faixas, que no celular mantém as
// colunas e perde o número de cima.
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { pct } from '../../lib/crm/stats.js';
import { fmtDuration, fmtDays, plural } from '../../lib/crm/format.js';
import { DAYS_BUCKETS } from '../../lib/crm/cohort.js';
import { ChartMark } from './ChartMark.jsx';
import { DashHelpTip } from './DashPrimitives.jsx';
import { CrmCard, DashedNote, DeltaPill, ReadText } from './CrmParts.jsx';

const FC_HELP = 'Tempo corrido entre o cadastro do lead e a primeira interação registrada por alguém da equipe. A mediana entra com os leads sem contato no fim da fila, então ela não fica bonita por esconder quem nunca foi atendido.';
const FC_READ = 'A mediana entra com os leads sem contato no fim da fila, em vez de calcular só entre quem foi atendido. Lead que espera mais de um dia costuma já ter marcado em outra academia.';
const SEGMENT = 'block h-full min-w-[6px] border-r-2 border-white last:border-r-0 dark:border-ink-800';
const BAR_MAX_PX = 88;

function BigNumber({ value, delta }) {
  return (
    <div className="flex flex-wrap items-end gap-3 gap-y-1">
      <span className="num whitespace-nowrap font-display text-[34px] font-bold leading-[0.9] tracking-[-0.02em]">{value}</span>
      <span className="pb-[3px] text-[11.5px] text-muted-foreground">de mediana</span>
      {delta && <span className="ml-auto"><DeltaPill delta={delta} lowerBetter /></span>}
    </div>
  );
}

export function FirstContactCard({ fc, delta }) {
  const help = <DashHelpTip text={FC_HELP} label="Como o tempo até o primeiro contato é medido" />;
  const title = 'Tempo até o primeiro contato';
  const hint = 'do cadastro até a primeira interação da equipe';
  // fc null (diferente de total 0): a safra passou do fim do mês e o mês
  // seguinte ainda não carregou ou falhou, então não existe como medir.
  if (fc == null) {
    return (
      <CrmCard title={title} hint={hint} action={help}>
        <div className="p-[18px]">
          <DashedNote title="Falta o mês seguinte ao do cadastro para medir o primeiro contato." />
        </div>
      </CrmCard>
    );
  }
  const total = fc.total || 0;
  if (!total) {
    return (
      <CrmCard title={title} hint={hint} action={help}>
        <div className="p-[18px]"><DashedNote title="Nenhum lead cadastrado neste mês." /></div>
      </CrmCard>
    );
  }
  const buckets = [
    { name: 'Até 1 hora', count: fc.h1, bar: 'bg-success dark:bg-[#0E9F6E]' },
    { name: 'Até 24 horas', count: fc.h24, bar: 'bg-amber-500 dark:bg-amber-600' },
    { name: 'Mais de 24 horas', count: fc.over, bar: 'bg-danger dark:bg-[#E11D48]' },
    { name: 'Sem contato', count: fc.none, bar: 'bg-slate-400 dark:bg-slate-500' }
  ];
  return (
    <CrmCard title={title} hint={hint} action={help}>
      <div className="px-[18px] py-4">
        <BigNumber value={fmtDuration(fc.median)} delta={delta} />
        <div className="mt-4 flex h-[34px] overflow-hidden rounded-[9px] bg-muted">
          {buckets.filter((b) => b.count > 0).map((b) => (
            <ChartMark
              key={b.name}
              tip={`${b.name}: ${plural(b.count, 'lead', 'leads')} de ${fmtNum(total)} (${pct(b.count, total)}%)`}
              className={cn(SEGMENT, b.bar)}
              style={{ width: `${Math.round((b.count / total) * 100)}%` }}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-[7px]">
          {buckets.map((b) => (
            <div key={b.name} className="flex items-center gap-2">
              <i className={cn('block size-[9px] flex-none rounded-[3px]', b.bar)} />
              <span className="min-w-0 flex-1 text-[12.5px]">{b.name}</span>
              <span className="num text-[12.5px] font-bold">{fmtNum(b.count)}</span>
              <span className="num w-[38px] text-right text-[11.5px] text-muted-foreground">{`${pct(b.count, total)}%`}</span>
            </div>
          ))}
        </div>
        <ReadText>{FC_READ}</ReadText>
      </div>
    </CrmCard>
  );
}

function daysRead(counts, total) {
  const fast = counts[0] + counts[1] + counts[2];
  if (total === 1) {
    return fast === 1 ? 'A única matrícula do mês fechou em até 7 dias.' : 'A única matrícula do mês levou mais de 7 dias.';
  }
  const lead = `${fmtNum(fast)} das ${fmtNum(total)} matrículas ${fast === 1 ? 'fechou' : 'fecharam'} em até 7 dias.`;
  return fast < total
    ? `${lead} O resto é acompanhamento longo, o tipo de lead que cai do radar quando ninguém marca o próximo contato.`
    : lead;
}

export function DaysToEnrollCard({ dte, delta }) {
  const total = dte?.total || 0;
  const title = 'Dias até a matrícula';
  const hint = 'entre o cadastro do lead e a matrícula';
  if (!total) {
    return (
      <CrmCard title={title} hint={hint}>
        <div className="p-[18px]"><DashedNote title="Nenhuma matrícula neste mês." /></div>
      </CrmCard>
    );
  }
  const counts = dte.buckets;
  const max = Math.max(1, ...counts);
  return (
    <CrmCard title={title} hint={hint}>
      <div className="px-[18px] py-4">
        <BigNumber value={fmtDays(dte.median)} delta={delta} />
        <div className="mt-4 grid h-[132px] grid-cols-6 items-end gap-2">
          {DAYS_BUCKETS.map((b, i) => (
            <div key={b.name} className="flex h-full flex-col items-center justify-end gap-1.5">
              <span className={cn('num hidden text-[11.5px] font-bold md:block', counts[i] === 0 ? 'text-muted-foreground' : 'text-foreground')}>
                {fmtNum(counts[i])}
              </span>
              <ChartMark
                tip={`${b.name} dias entre cadastro e matrícula: ${fmtNum(counts[i])} de ${plural(total, 'matrícula', 'matrículas')} (${pct(counts[i], total)}%)`}
                className={cn('block w-full min-h-[3px] rounded-t-md', i <= 2 ? 'bg-brand-600' : 'bg-brand-300 dark:bg-brand-200')}
                style={{ height: `${Math.round((counts[i] / max) * BAR_MAX_PX)}px` }}
              />
              <span className="num whitespace-nowrap text-[10.5px] text-muted-foreground">{i === DAYS_BUCKETS.length - 1 ? b.name : `${b.name} d`}</span>
            </div>
          ))}
        </div>
        <ReadText className="mt-3.5">{daysRead(counts, total)}</ReadText>
      </div>
    </CrmCard>
  );
}
