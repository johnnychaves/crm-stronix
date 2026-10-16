// Corpo da tela do CRM, só apresentação (mockup A, "Jornada"): o herói com a
// conversão da safra e o caminho dela, a faixa de quatro números, a faixa que
// mostra onde os leads travam, e abaixo as demais, uma pergunta por faixa.
// Recebe as métricas prontas de DashboardCrmView; os textos que dependem dos
// números saem de src/lib/crm/texts.js.
import { crmDelta } from '../../lib/crm/metrics.js';
import { channelRead, summaryItems, safraNote } from '../../lib/crm/texts.js';
import { STAGE_TRACKING_MONTH } from '../../lib/crm/scope.js';
import { DashedNote } from './CrmParts.jsx';
import { CrmHero } from './CrmHero.jsx';
import { CrmTape } from './CrmTape.jsx';
import { StageStuckBand } from './StageStuckBand.jsx';
import { ChannelTable } from './ChannelTable.jsx';
import { LossCard } from './LossCard.jsx';
import { PeopleConversionTable } from './PeopleConversionTable.jsx';
import { ProfessorCard } from './ProfessorCard.jsx';
import { FirstContactCard, DaysToEnrollCard } from './SpeedCards.jsx';
import { PipelineNowCard, NoNextContactCard } from './PipelineNowCards.jsx';

const TWO = 'grid grid-cols-1 items-start gap-5 xl:grid-cols-2';

export function CrmDashboard({
  cur, cmp, series, team, compareOn, shownName, cmpName,
  person, personName, funnelId, funnelName, onPick, onClear
}) {
  const speedDelta = (pick, kind) => (compareOn ? crmDelta(pick(cur), cmp ? pick(cmp) : null, { kind }) : null);
  const convDelta = compareOn ? crmDelta(cur.cohort?.conv ?? null, cmp?.cohort?.conv ?? null, { kind: 'pp' }) : null;
  // A conversão da safra mora no herói; a faixa fica com os outros quatro.
  const items = summaryItems({ cur, cmp, series, compareOn, shownName }).filter((k) => k.key !== 'conv');
  // Sem fonte ainda ou fonte que falhou: metricsOf devolve tudo null e as
  // faixas do meio não têm número pra mostrar. O herói e a faixa de números
  // cobrem o próprio caso (traço) e a carteira de agora é dado vivo, então
  // seguem de pé; só o meio da tela vira um aviso.
  const unavailable = !cur.hasSource || cur.failed;

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 pt-2 md:px-8">
      <CrmHero cohort={cur.cohort} monthName={shownName} delta={convDelta} cmpName={cmpName} />
      <CrmTape
        items={items}
        note={safraNote({ enroll: cur.enroll, fromCohort: cur.fromCohort, conv: cur.cohort?.conv ?? null, monthName: shownName })}
      />

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
          <StageStuckBand
            passage={cur.passage}
            nowRows={cur.now?.rows || null}
            needFunnel={!funnelId}
            hasBase={cur.stageBase}
            funnelName={funnelName}
            monthName={shownName}
            academyMedian={Boolean(person)}
            since={cur.monthKey === STAGE_TRACKING_MONTH ? '14 de setembro' : null}
          />

          <div className={TWO}>
            <ChannelTable rows={cur.channels} read={channelRead(cur)} />
            <PeopleConversionTable
              rows={team?.rows || []}
              others={team?.others || null}
              person={person}
              personName={personName}
              onPick={onPick}
              onClear={onClear}
            />
          </div>

          <div className={TWO}>
            <LossCard losses={cur.losses} lossStages={cur.lossStages} stageBase={cur.stageBase} monthName={shownName} />
            <div className="flex flex-col gap-5">
              <FirstContactCard fc={cur.firstContact} delta={speedDelta((m) => m.firstContact?.median ?? null, 'min')} />
              <DaysToEnrollCard dte={cur.daysToEnroll} delta={speedDelta((m) => m.daysToEnroll?.median ?? null, 'days')} />
            </div>
          </div>
        </>
      )}

      <div className={TWO}>
        {cur.running && cur.now ? (
          <div className="flex flex-col gap-5">
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
        {!unavailable && <ProfessorCard professors={cur.professors} monthName={shownName} scoped={Boolean(person || funnelId)} />}
      </div>
    </div>
  );
}
