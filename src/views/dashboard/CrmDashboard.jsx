// Corpo da tela do CRM, só apresentação (handoff do CRM, linhas 156 a 639):
// destaques, faixa de resumo e as cinco seções, uma por pergunta. Recebe as
// métricas prontas de DashboardCrmView; os textos que dependem dos números
// saem de src/lib/crm/texts.js.
import { crmDelta } from '../../lib/crm/metrics.js';
import { channelRead, summaryItems, scopeNote } from '../../lib/crm/texts.js';
import { STAGE_TRACKING_MONTH } from '../../lib/crm/scope.js';
import { DashSummaryBand } from './DashSummaryBand.jsx';
import { DashHighlights } from './DashHighlights.jsx';
import { CrmSection, DashedNote } from './CrmParts.jsx';
import { ChannelTable } from './ChannelTable.jsx';
import { CohortMilestones } from './CohortMilestones.jsx';
import { StagePassageTable } from './StagePassageTable.jsx';
import { LossCard } from './LossCard.jsx';
import { PeopleConversionTable } from './PeopleConversionTable.jsx';
import { ProfessorCard } from './ProfessorCard.jsx';
import { FirstContactCard, DaysToEnrollCard } from './SpeedCards.jsx';
import { PipelineNowCard, NoNextContactCard } from './PipelineNowCards.jsx';

const WIDE_NARROW = 'grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]';

export function CrmDashboard({
  cur, cmp, series, team, highlights, compareOn, shownName,
  person, personName, funnelId, funnelName, onPick, onClear
}) {
  const scope = scopeNote(person ? personName : null, funnelId ? funnelName : null);
  const speedDelta = (pick, kind) => (compareOn ? crmDelta(pick(cur), cmp ? pick(cmp) : null, { kind }) : null);
  // Sem fonte ainda ou fonte que falhou: metricsOf devolve tudo null e as
  // quatro seções de baixo não têm número pra mostrar. A faixa de resumo já
  // cobre o próprio caso (traço com o aviso) e a carteira de agora é dado
  // vivo, então as duas seguem de pé; só o meio da tela vira um aviso.
  const unavailable = !cur.hasSource || cur.failed;
  return (
    <>
      {compareOn && highlights.length > 0 && (
        <div className="px-4 md:px-8 pt-[18px]"><DashHighlights items={highlights} fit /></div>
      )}
      <div className="flex flex-col gap-[22px] px-4 md:px-8 pb-8 pt-5">
        <DashSummaryBand items={summaryItems({ cur, cmp, series, compareOn, shownName })} stackPillsOnMobile />

        {unavailable ? (
          <DashedNote
            className="rounded-2xl"
            title={cur.failed ? `Os números de ${shownName} não carregaram` : `Carregando os números de ${shownName}`}
            text={cur.failed
              ? 'Origem, funil, pessoas e velocidade voltam quando o mês carregar. Recarregue a página para tentar de novo.'
              : 'Os cards aparecem assim que os dados chegarem.'}
          />
        ) : (
          <>
            <CrmSection title="Origem" question="de onde vêm os leads?" note={scope}>
              <ChannelTable rows={cur.channels} read={channelRead(cur)} />
            </CrmSection>

            <CrmSection title="Funil" question="onde os leads se perdem?" note={scope}>
              <div className="flex flex-col gap-3.5">
                <CohortMilestones cohort={cur.cohort} monthName={shownName} running={cur.running} />
                {/* align-items start: cada card com a altura que tem (README §3). */}
                <div className={`${WIDE_NARROW} items-start`}>
                  <StagePassageTable
                    passage={cur.passage}
                    needFunnel={!funnelId}
                    hasBase={cur.stageBase}
                    funnelName={funnelName}
                    monthName={shownName}
                    academyMedian={Boolean(person)}
                    since={cur.monthKey === STAGE_TRACKING_MONTH ? '14 de setembro' : null}
                  />
                  <LossCard losses={cur.losses} lossStages={cur.lossStages} stageBase={cur.stageBase} monthName={shownName} />
                </div>
              </div>
            </CrmSection>

            <CrmSection title="Pessoas" question="quem converte?" note={scope}>
              <div className={`${WIDE_NARROW} items-start`}>
                <PeopleConversionTable
                  rows={team?.rows || []}
                  others={team?.others || null}
                  person={person}
                  personName={personName}
                  onPick={onPick}
                  onClear={onClear}
                />
                <ProfessorCard professors={cur.professors} monthName={shownName} scoped={Boolean(person || funnelId)} />
              </div>
            </CrmSection>

            <CrmSection title="Velocidade" question="com que rapidez o lead é atendido e fecha?" note={scope}>
              <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
                <FirstContactCard fc={cur.firstContact} delta={speedDelta((m) => m.firstContact?.median ?? null, 'min')} />
                <DaysToEnrollCard dte={cur.daysToEnroll} delta={speedDelta((m) => m.daysToEnroll?.median ?? null, 'days')} />
              </div>
            </CrmSection>
          </>
        )}

        <CrmSection title="Carteira agora" question="o que está em jogo neste momento?" tag={cur.running ? 'Agora' : null}>
          {cur.running && cur.now ? (
            <div className={WIDE_NARROW}>
              <PipelineNowCard now={cur.now} funnelName={funnelId ? funnelName : null} personName={person ? personName : null} />
              <NoNextContactCard count={cur.now.noNext} total={cur.now.total} />
            </div>
          ) : (
            <DashedNote
              className="rounded-2xl"
              title="A carteira agora só existe no mês em andamento"
              text={`É um retrato deste instante, não um número de ${shownName}. Em mês fechado, o que interessa da mesma turma de leads está no desfecho da safra, lá em cima.`}
            />
          )}
        </CrmSection>
      </div>
    </>
  );
}
