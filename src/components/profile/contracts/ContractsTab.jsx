// A aba Contratos da ficha: a linha do tempo, o card do contrato em destaque,
// a faixa do próximo contrato e o Histórico em tabela. Quem é o destaque e o
// próximo, os fatos e a geometria vêm de lib/contractsTab.js; aqui só há tela.
// As ações recebem o CONTRATO em que agem, porque com renovação marcada o
// card é o contrato em uso, e não o último.
// Mockup: docs/superpowers/specs/mockups/2026-09-30-aba-contratos-em-uso.html
import { Ban, FileText, UserPlus } from 'lucide-react';
import { CONTRACT_STATUS, CONTRACT_STATUS_LABEL, deriveContractStatus, isRenewalNotStarted } from '../../../lib/contracts.js';
import { contractFactsOf, contractTimelineOf, contractsTabModel, heroActionsOf, heroCountdownOf, joinTextOf } from '../../../lib/contractsTab.js';
import { contractVigencia, missedCheckpointsLabel, vigenciaRefDate } from '../../../lib/renewal.js';
import { getSafeDateOrNull } from '../../../lib/dates.js';
import { fmtBRL } from '../../../lib/format.js';
import { cn } from '../../../lib/utils.js';
import { Btn } from '../../ui/Btn.jsx';
import { CONTRACT_TONE } from './tone.js';
import { ContractTimeline } from './ContractTimeline.jsx';
import { ContractHeroCard } from './ContractHeroCard.jsx';
import { NextContractStrip } from './NextContractStrip.jsx';
import { ContractHistoryTable } from './ContractHistoryTable.jsx';

const fmtDia = (d) => (d ? d.toLocaleDateString('pt-BR') : '—');

// Lead ou cliente sem contrato vigente: matrícula.
function EmptyState({ firstName, isReadOnly, loading, onEnroll }) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 dark:border-white/[0.1] bg-card p-8 text-center">
      <div className="size-[46px] rounded-[14px] grid place-items-center mx-auto mb-3 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"><FileText size={20} /></div>
      <h3 className="font-display text-[16px] font-bold tracking-tight">Ainda não é cliente</h3>
      <p className="text-[12.5px] leading-[1.5] text-slate-500 dark:text-slate-400 mt-1.5 max-w-[300px] mx-auto text-pretty">
        Quando {firstName} fechar, registre plano, valor e vigência. A renovação passa a ser acompanhada por aqui.
      </p>
      {!isReadOnly && (
        <div className="mt-4 flex items-center justify-center">
          <Btn kind="enroll" icon={<UserPlus size={15} />} onClick={onEnroll} disabled={loading}>Matricular agora</Btn>
        </div>
      )}
    </section>
  );
}

// Vencido ou cancelado, sem próximo: o card encolhe e a ação vira nova matrícula.
function ClosedCard({ hero, facts, status, vigencia, isReadOnly, loading, onEnroll }) {
  const cancelled = status === CONTRACT_STATUS.CANCELADO;
  const tone = CONTRACT_TONE[status];
  const pct = vigencia ? vigencia.elapsedPct : 100;
  return (
    <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-start gap-3.5 px-5 pt-[18px] pb-4">
        <span className={cn('size-[38px] flex-none rounded-xl grid place-items-center', tone.block, tone.fg)}>
          {cancelled ? <Ban size={17} /> : <FileText size={17} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-[17px] font-bold tracking-tight">{facts.planName || 'Plano'}</h3>
            <span className={cn('inline-flex items-center h-5 px-[7px] rounded-md text-[9.5px] font-bold uppercase tracking-[.05em]', tone.block, tone.fg)}>
              {CONTRACT_STATUS_LABEL[status]}
            </span>
          </div>
          <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-1">
            {cancelled
              ? `Cancelado${facts.cancelledAt ? ` em ${fmtDia(facts.cancelledAt)}` : ''}${facts.cancelReason ? ` · ${facts.cancelReason}` : ''}`
              : `Venceu há ${Math.abs(vigencia?.daysLeft ?? 0)} dias · ${fmtDia(getSafeDateOrNull(hero.endsAt))}`}
          </div>
        </div>
        <span className={cn('num flex-none font-display text-[19px] font-bold text-slate-500 dark:text-slate-400', cancelled && 'line-through')}>
          {facts.value != null ? fmtBRL(facts.value) : '—'}
        </span>
      </div>
      <div className="flex h-1 bg-slate-100 dark:bg-white/[0.06]">
        <span className={cn('h-full', cancelled ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600')} style={{ width: `${pct}%` }}></span>
      </div>
      <div className="flex items-center gap-2 flex-wrap px-5 py-3 bg-slate-50 dark:bg-white/[0.03]">
        {!isReadOnly && <Btn kind="enroll" icon={<UserPlus size={14} />} onClick={onEnroll} disabled={loading}>Nova matrícula</Btn>}
        <span className="text-[11.5px] text-slate-500 dark:text-slate-400">
          {cancelled ? `Interrompido a ${pct}% da vigência.` : 'O cliente conta como inativo até renovar.'}
        </span>
      </div>
    </section>
  );
}

export function ContractsTab({
  lead, leadContracts, firstName, isReadOnly, loading, contractThresholdDays, renewalCheckpoints,
  onEnroll, onRenew, onEditContract, onContractAction, onActivate
}) {
  const now = new Date();
  const { hero, next, history, join } = contractsTabModel({ lead, contracts: leadContracts, now });
  // A aba lê o CONTRATO, não as marcas de cliente: quando as marcas estavam
  // erradas, a aba dizia "Ainda não é cliente" com o contrato gravado.
  const hasContract = Boolean(hero && getSafeDateOrNull(hero.endsAt));
  const status = hasContract ? (deriveContractStatus(hero, now, contractThresholdDays) || CONTRACT_STATUS.ATIVO) : null;
  // Com próximo contrato, o destaque é o contrato em uso, escolhido por dia do
  // calendário (isInUseAt). No último dia dele, com o fim gravado à meia-noite,
  // o status por instante já diz vencido, mas o card continua o em uso, com
  // Trancar e Cancelar; o card fechado, com Nova matrícula, gravaria um
  // segundo contrato (revisão final de 01/10/2026).
  // O destaque que não é o último contrato (o em uso, com o último cancelado)
  // age como se tivesse próximo: só Trancar ou Reativar e Cancelar. Renovar e
  // Corrigir são do último contrato, e aqui reescreveriam o resumo do lead com
  // os dados de outro (revisão final de 01/10/2026).
  const likeNext = Boolean(next) || Boolean(hero && lead?.currentContractId && hero.id !== lead.currentContractId);
  const closed = !likeNext && (status === CONTRACT_STATUS.VENCIDO || status === CONTRACT_STATUS.CANCELADO);
  const heroStatus = likeNext && status === CONTRACT_STATUS.VENCIDO ? CONTRACT_STATUS.ATIVO : status;
  const heroFacts = hasContract ? contractFactsOf(hero, leadContracts, now, contractThresholdDays) : null;
  // A régua do destaque, congelada no trancamento e no cancelamento
  // (vigenciaRefDate): dá os dias e os marcos que passaram sem contato.
  const vigencia = hasContract
    ? contractVigencia({
      startsAt: heroFacts.start, endsAt: hero.endsAt, checkpoints: renewalCheckpoints,
      handled: lead.renewalHandledCheckpoints, now: vigenciaRefDate(hero, now)
    })
    : null;
  const timeline = contractTimelineOf({
    contracts: leadContracts,
    heroId: hasContract && !closed ? hero.id : null,
    nextId: next?.id || null,
    now,
    checkpoints: renewalCheckpoints,
    handled: lead.renewalHandledCheckpoints
  });
  const rows = history.map((c) => contractFactsOf(c, leadContracts, now, contractThresholdDays));
  // "Cancelar renovação" só quando o desfazer existe (isRenewalNotStarted):
  // com o contrato renovado cancelado, é o cancelamento comum.
  const linked = next?.renewedFromId ? leadContracts.find((c) => c.id === next.renewedFromId) || null : null;
  // O aviso dos marcos some com próximo (o cliente já renovou), no agendado e
  // no trancado, como antes.
  const missed = !next && status !== CONTRACT_STATUS.AGENDADO && status !== CONTRACT_STATUS.TRANCADO
    ? missedCheckpointsLabel(vigencia?.missedCount)
    : null;

  return (
    <div className="space-y-4">
      <ContractTimeline timeline={timeline} />
      {!hasContract ? (
        <EmptyState firstName={firstName} isReadOnly={isReadOnly} loading={loading} onEnroll={onEnroll} />
      ) : closed ? (
        <ClosedCard hero={hero} facts={heroFacts} status={status} vigencia={vigencia} isReadOnly={isReadOnly} loading={loading} onEnroll={onEnroll} />
      ) : (
        <ContractHeroCard
          lead={lead}
          hero={hero}
          status={heroStatus}
          hasNext={likeNext}
          countdown={heroCountdownOf({ contract: hero, status: heroStatus, hasNext: likeNext, now })}
          facts={heroFacts}
          missed={missed}
          actions={heroActionsOf({ status: heroStatus, hasNext: likeNext })}
          isReadOnly={isReadOnly}
          loading={loading}
          onRenew={onRenew}
          onEditContract={onEditContract}
          onContractAction={onContractAction}
          onActivate={onActivate}
        />
      )}
      {next && (
        <NextContractStrip
          next={next}
          facts={contractFactsOf(next, leadContracts, now, contractThresholdDays)}
          joinText={joinTextOf(join)}
          now={now}
          canUndo={isRenewalNotStarted(next, linked, now)}
          isReadOnly={isReadOnly}
          loading={loading}
          onActivate={onActivate}
          onEditContract={onEditContract}
          onContractAction={onContractAction}
        />
      )}
      <ContractHistoryTable rows={rows} firstName={firstName} hasContract={hasContract} />
    </div>
  );
}
