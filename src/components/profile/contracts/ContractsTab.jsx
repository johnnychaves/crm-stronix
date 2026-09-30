// A aba Contratos da ficha. Saiu de dentro do LeadProfileView.jsx sem mudar de
// comportamento; a tela nova (linha do tempo, contrato em uso, próximo
// contrato e Histórico em tabela) entra nas tasks seguintes do plano
// docs/superpowers/plans/2026-09-30-contrato-em-uso-e-historico.md.
import { Ban, FileText, GraduationCap, LogIn, PauseCircle, PlayCircle, RefreshCw, TrendingUp, UserPlus } from 'lucide-react';
import { getSafeDateOrNull } from '../../../lib/dates.js';
import { fmtBRL } from '../../../lib/format.js';
import { CONTRACT_STATUS, CONTRACT_STATUS_LABEL, contractDiscountOf, deriveLeadContractStatus } from '../../../lib/contracts.js';
import { SEAM_KIND, computeSeam, contractVigencia, daysBetween, missedCheckpointsLabel, vigenciaRefDate } from '../../../lib/renewal.js';
import {
  CONTRACT_ORIGIN, HISTORY_STATUS, HISTORY_STATUS_LABEL, contractEndOf, contractOriginOf, historyStatusOf, historySuccessorOf, inUseNoteOf, runningPredecessorOf
} from '../../../lib/contractHistory.js';
import { cn } from '../../../lib/utils.js';
import { Avatar } from '../../ui/Avatar.jsx';
import { Btn } from '../../ui/Btn.jsx';

// Tom do bloco de contagem, do chip e do preenchimento da régua — o estado do
// contrato manda na cor da aba Contratos inteira.
const CONTRACT_TONE = {
  [CONTRACT_STATUS.AGENDADO]: { block: 'bg-violet-500/10 dark:bg-violet-500/15', fg: 'text-violet-700 dark:text-violet-300', fill: 'bg-violet-500' },
  [CONTRACT_STATUS.TRANCADO]: { block: 'bg-yellow-500/15', fg: 'text-yellow-800 dark:text-yellow-300', fill: 'bg-yellow-500' },
  [CONTRACT_STATUS.ATIVO]: { block: 'bg-emerald-500/10 dark:bg-emerald-500/15', fg: 'text-emerald-700 dark:text-emerald-400', fill: 'bg-emerald-500' },
  [CONTRACT_STATUS.A_VENCER]: { block: 'bg-amber-500/12 dark:bg-amber-500/16', fg: 'text-amber-700 dark:text-amber-400', fill: 'bg-amber-500' },
  [CONTRACT_STATUS.VENCIDO]: { block: 'bg-slate-500/10 dark:bg-slate-400/15', fg: 'text-slate-600 dark:text-slate-300', fill: 'bg-slate-400' },
  [CONTRACT_STATUS.CANCELADO]: { block: 'bg-rose-500/10 dark:bg-rose-500/15', fg: 'text-rose-700 dark:text-rose-400', fill: 'bg-rose-500' },
  // Selos do Histórico (lib/contractHistory.js).
  [HISTORY_STATUS.EM_USO]: { block: 'bg-emerald-500/10 dark:bg-emerald-500/15', fg: 'text-emerald-700 dark:text-emerald-400', fill: 'bg-emerald-500' },
  [HISTORY_STATUS.RENOVADO]: { block: 'bg-slate-500/10 dark:bg-slate-400/15', fg: 'text-slate-600 dark:text-slate-300', fill: 'bg-slate-400' }
};

// Rótulo em versalete das células. Sempre no tom `muted`: a 9.5px ele faz
// trabalho estrutural, é o que faz a faixa ler como células.
const CapsLabel = ({ children }) => (
  <div className="text-[9.5px] font-bold uppercase tracking-[.08em] text-slate-500 dark:text-slate-400 whitespace-nowrap">
    {children}
  </div>
);

// Lacuna entre dois contratos, em dias ou meses conforme o tamanho.
const gapLabel = (days) => {
  if (days < 45) return `${days} ${days === 1 ? 'dia' : 'dias'} sem contrato`;
  const months = Math.round(days / 30.44);
  return `${months} ${months === 1 ? 'mês' : 'meses'} sem contrato`;
};

// Número curto do contrato, igual em todo o card.
const shortContractId = (id) => String(id || '').slice(0, 8).toUpperCase();

// De onde veio o contrato vigente. Renovação só quando está ligada ao contrato
// anterior (renewedFromId). Contrato sem ligação é retorno, como no Gerencial.
function OriginCell({ origin }) {
  const kind = origin?.kind || CONTRACT_ORIGIN.PRIMEIRA;
  const prev = origin?.previous || null;
  if (kind === CONTRACT_ORIGIN.RENOVACAO) {
    return (
      <>
        <CapsLabel>Renovado de</CapsLabel>
        <div className="text-[13px] font-semibold mt-[7px] truncate" title={prev?.planName || undefined}>{prev?.planName || '—'}</div>
        <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-[3px]">
          {prev ? `#${shortContractId(prev.id)} · ` : ''}<span className="whitespace-nowrap">{origin.ordinal}ª renovação</span>
        </div>
      </>
    );
  }
  if (kind === CONTRACT_ORIGIN.RETORNO || kind === CONTRACT_ORIGIN.UPGRADE) {
    // Três linhas curtas: a célula é estreita, e numa linha só o intervalo sem
    // contrato ficava cortado. A data é o fim da cobertura anterior, a mesma de
    // onde o intervalo é medido.
    const coverageEnd = origin?.coverageEnd || null;
    const main = prev?.planName || (kind === CONTRACT_ORIGIN.UPGRADE ? 'pelo funil Upgrade' : '—');
    const endText = coverageEnd ? `até ${coverageEnd.toLocaleDateString('pt-BR')}` : null;
    const gapText = origin?.gapDays ? gapLabel(origin.gapDays) : null;
    const detail = [endText, gapText].filter(Boolean).join(' · ');
    return (
      <>
        <CapsLabel>{kind === CONTRACT_ORIGIN.UPGRADE ? 'Upgrade' : 'Retorno'}</CapsLabel>
        <div className="text-[13px] font-semibold mt-[7px] truncate" title={detail ? `${main} · ${detail}` : main}>{main}</div>
        {endText && <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-[3px]">{endText}</div>}
        {gapText && <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{gapText}</div>}
      </>
    );
  }
  return (
    <>
      <CapsLabel>Renovado de</CapsLabel>
      <div className="text-[13px] font-semibold mt-[7px]">Matrícula inicial</div>
      <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-[3px]">primeiro contrato</div>
    </>
  );
}

// Ícone do nó do Histórico pela origem do contrato.
function OriginIcon({ kind }) {
  if (kind === CONTRACT_ORIGIN.RETORNO) return <LogIn size={14} aria-hidden="true" />;
  if (kind === CONTRACT_ORIGIN.UPGRADE) return <TrendingUp size={14} aria-hidden="true" />;
  if (kind === CONTRACT_ORIGIN.RENOVACAO) return <RefreshCw size={14} aria-hidden="true" />;
  return <GraduationCap size={14} aria-hidden="true" />;
}

// Nome da origem, para o title e o leitor de tela do nó do Histórico.
const ORIGIN_LABEL = {
  [CONTRACT_ORIGIN.RENOVACAO]: 'Renovação',
  [CONTRACT_ORIGIN.UPGRADE]: 'Upgrade',
  [CONTRACT_ORIGIN.RETORNO]: 'Retorno',
  [CONTRACT_ORIGIN.PRIMEIRA]: 'Primeira matrícula'
};

export function ContractsTab({
  lead, leadContracts, currentContract, firstName, isReadOnly, loading, contractThresholdDays, renewalCheckpoints,
  onEnroll, onRenew, onContractAction, onEditContract
}) {
  const pastContracts = leadContracts.filter(c => c.id !== lead.currentContractId);
  // De onde veio o contrato vigente: renovação, upgrade, retorno ou primeira
  // matrícula, na ordem do Gerencial (lib/contractHistory.js). Antes contava
  // qualquer contrato anterior como renovação.
  const contractOrigin = currentContract ? contractOriginOf(currentContract, leadContracts) : null;

  // Estado do contrato vigente + a régua de vigência com os marcos de
  // renovação da academia (Configurações → Metas & ritmo, nunca hardcode).
  //
  // A aba lê o CONTRATO (currentContractId), não as marcas de cliente
  // (isClient). É a mesma fonte do chip de contagem da aba: quando as marcas
  // estavam erradas (mudança de fase antiga que zerava lifecycleStage), a aba
  // dizia "Ainda não é cliente" com o chip em 1 e o contrato ainda gravado.
  const curStatus = lead.currentContractId
    ? (deriveLeadContractStatus(lead, new Date(), contractThresholdDays) || CONTRACT_STATUS.ATIVO)
    : null;
  const curStartsAt = getSafeDateOrNull(lead.currentContractStartsAt);
  const curEndsAt = getSafeDateOrNull(lead.currentContractEndsAt);
  const hasCurrentContract = Boolean(lead.currentContractId && curEndsAt);
  const curClosed = curStatus === CONTRACT_STATUS.VENCIDO || curStatus === CONTRACT_STATUS.CANCELADO;
  // Trancado congela a régua na data em que parou, e cancelado para na data do
  // cancelamento (vigenciaRefDate). Sem isso a porcentagem do cancelado subia
  // todo dia.
  const curPaused = curStatus === CONTRACT_STATUS.TRANCADO;
  const curPausedAt = getSafeDateOrNull(currentContract?.pausedAt);
  const curCancelledAt = getSafeDateOrNull(currentContract?.cancelledAt);
  const vigencia = hasCurrentContract
    ? contractVigencia({
      startsAt: curStartsAt,
      endsAt: curEndsAt,
      checkpoints: renewalCheckpoints,
      handled: lead.renewalHandledCheckpoints,
      now: vigenciaRefDate({ status: curStatus, pausedAt: curPausedAt, cancelledAt: curCancelledAt }, new Date())
    })
    : null;

  return (
          <div className="space-y-4">
            {!hasCurrentContract ? (
              /* Lead/cliente sem contrato vigente → matrícula. */
              <section className="rounded-2xl border border-dashed border-slate-300 dark:border-white/[0.1] bg-card p-8 text-center">
                <div className="size-[46px] rounded-[14px] grid place-items-center mx-auto mb-3 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"><FileText size={20} /></div>
                <h3 className="font-display text-[16px] font-bold tracking-tight">Ainda não é cliente</h3>
                <p className="text-[12.5px] leading-[1.5] text-slate-500 dark:text-slate-400 mt-1.5 max-w-[300px] mx-auto text-pretty">
                  Quando {firstName} fechar, registre plano, valor e vigência — a renovação passa a ser acompanhada por aqui.
                </p>
                {!isReadOnly && (
                  <div className="mt-4 flex items-center justify-center">
                    <Btn kind="enroll" icon={<UserPlus size={15} />} onClick={onEnroll} disabled={loading}>Matricular agora</Btn>
                  </div>
                )}
              </section>
            ) : curClosed ? (
              /* Vencido ou cancelado: o card encolhe e a ação vira nova matrícula. */
              (() => {
                const cancelled = curStatus === CONTRACT_STATUS.CANCELADO;
                const tone = CONTRACT_TONE[curStatus];
                const pct = vigencia ? vigencia.elapsedPct : 100;
                return (
                  <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
                    <div className="flex items-start gap-3.5 px-5 pt-[18px] pb-4">
                      <span className={cn('size-[38px] flex-none rounded-xl grid place-items-center', tone.block, tone.fg)}>
                        {cancelled ? <Ban size={17} /> : <FileText size={17} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display text-[17px] font-bold tracking-tight">{lead.currentPlanName || 'Plano'}</h3>
                          <span className={cn('inline-flex items-center h-5 px-[7px] rounded-md text-[9.5px] font-bold uppercase tracking-[.05em]', tone.block, tone.fg)}>
                            {CONTRACT_STATUS_LABEL[curStatus]}
                          </span>
                        </div>
                        <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-1">
                          {cancelled
                            ? `Cancelado${curCancelledAt ? ` em ${curCancelledAt.toLocaleDateString('pt-BR')}` : ''}${currentContract?.cancelReason ? ` · ${currentContract.cancelReason}` : ''}`
                            : `Venceu há ${Math.abs(vigencia?.daysLeft ?? 0)} dias · ${curEndsAt.toLocaleDateString('pt-BR')}`}
                        </div>
                      </div>
                      <span className={cn('num flex-none font-display text-[19px] font-bold text-slate-500 dark:text-slate-400', cancelled && 'line-through')}>
                        {lead.currentContractValue != null ? fmtBRL(lead.currentContractValue) : '—'}
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
              })()
            ) : (
              /* Contrato vivo: quem abre esta aba quer saber quantos dias faltam. */
              (() => {
                const tone = CONTRACT_TONE[curStatus] || CONTRACT_TONE[CONTRACT_STATUS.ATIVO];
                const daysLeft = Math.max(0, vigencia?.daysLeft ?? 0);
                // Contrato agendado: a contagem é até COMEÇAR, não até vencer —
                // e os marcos de renovação ainda não têm o que dizer.
                const scheduled = curStatus === CONTRACT_STATUS.AGENDADO;
                const paused = curPaused;
                const daysToStart = scheduled && curStartsAt
                  ? Math.max(0, Math.ceil((curStartsAt.getTime() - new Date().getTime()) / 86400000))
                  : 0;
                // Mesma conta da reativação (buildContractResume), que reativa na
                // meia-noite do dia escolhido: por isso a conta vai até o início
                // de hoje. Contando até agora, à tarde o card dizia um dia a mais.
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                const pausedDays = paused && curPausedAt
                  ? Math.max(0, daysBetween(curPausedAt, todayStart) || 0)
                  : 0;
                const missed = scheduled || paused ? null : missedCheckpointsLabel(vigencia?.missedCount);
                // Desconto = tabela menos o valor fechado, a mesma conta do
                // Gerencial (contractDiscountOf). O discountValue gravado não é
                // lido: depois de uma correção ele mostrava o desconto antigo.
                const listValue = Number(currentContract?.listValue) || 0;
                const discount = currentContract ? contractDiscountOf(currentContract) : 0;
                const discountReason = currentContract?.discountReason || null;
                const closedBy = currentContract?.consultantName || lead.consultantName;
                const closedAt = getSafeDateOrNull(currentContract?.createdAt);
                const months = Number(currentContract?.durationMonths) || 0;
                const value = lead.currentContractValue;
                // Contrato que ainda não começou, com o anterior em uso: a
                // régua não marca hoje e a faixa diz qual contrato vale agora.
                const notStarted = Boolean(curStartsAt && curStartsAt.getTime() > new Date().getTime());
                const inUse = notStarted ? runningPredecessorOf(currentContract, leadContracts, new Date()) : null;
                const inUseEnd = contractEndOf(inUse);
                const seamlessNow = Boolean(currentContract?.seamless || lead.currentContractSeamless);
                const inUseGap = inUse && inUseEnd && curStartsAt ? computeSeam(inUseEnd, curStartsAt) : null;
                const inUseNote = inUse && inUseEnd
                  ? inUseNoteOf({
                    planName: inUse.planName,
                    end: inUseEnd,
                    seamless: seamlessNow,
                    gapDays: inUseGap?.kind === SEAM_KIND.LACUNA ? inUseGap.gapDays : 0
                  })
                  : null;
                return (
                  <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
                    <div className="flex items-stretch flex-wrap">
                      {/* A contagem é o que importa */}
                      <div className={cn('w-[186px] flex-none px-[22px] py-5', tone.block)}>
                        <div className={cn('flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-[.08em]', tone.fg)}>
                          {paused && <PauseCircle size={11} aria-hidden="true" />}
                          {scheduled ? 'Começa em' : paused ? 'Trancado há' : 'Restam'}
                        </div>
                        <div className="flex items-baseline gap-1.5 mt-1.5">
                          <span className={cn('num font-display text-[40px] font-bold leading-none tracking-[-.03em]', tone.fg)}>
                            {scheduled ? daysToStart : paused ? pausedDays : daysLeft}
                          </span>
                          <span className={cn('text-[13px] font-semibold', tone.fg)}>
                            {(scheduled ? daysToStart : paused ? pausedDays : daysLeft) === 1 ? 'dia' : 'dias'}
                          </span>
                        </div>
                        <div className="num text-[11.5px] text-slate-600 dark:text-slate-300 mt-[7px]">
                          {scheduled
                            ? `início ${curStartsAt ? curStartsAt.toLocaleDateString('pt-BR') : '—'}`
                            : paused
                              ? `desde ${curPausedAt ? curPausedAt.toLocaleDateString('pt-BR') : '—'}`
                              : `vence ${curEndsAt.toLocaleDateString('pt-BR')}`}
                        </div>
                      </div>

                      {/* Quatro células divididas por régua */}
                      <div className="flex-1 min-w-0 flex items-stretch flex-wrap">
                        <div className="flex-[1.2] min-w-[160px] px-[22px] py-5">
                          <CapsLabel>Plano</CapsLabel>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="font-display text-[18px] font-bold tracking-tight">{lead.currentPlanName || 'Plano'}</span>
                            <span className={cn('inline-flex items-center h-[19px] px-[7px] rounded-[5px] text-[9.5px] font-bold uppercase tracking-[.05em]', tone.block, tone.fg)}>
                              {CONTRACT_STATUS_LABEL[curStatus]}
                            </span>
                          </div>
                          <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-[5px]">
                            #{shortContractId(lead.currentContractId)}{months ? ` · ${months === 1 ? '1 mês' : `${months} meses`}` : ''}
                          </div>
                        </div>

                        <div className="flex-1 min-w-[130px] px-[22px] py-5 border-l border-slate-100 dark:border-white/[0.06]">
                          <CapsLabel>Valor</CapsLabel>
                          <div className="num font-display text-[18px] font-bold tracking-tight mt-1.5">{value != null ? fmtBRL(value) : '—'}</div>
                          <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-[5px]">
                            {value != null && months > 0 ? `${fmtBRL(Number(value) / months)}/mês` : '—'}
                          </div>
                          {/* Só o desconto e o motivo: a célula não comporta o
                              valor de tabela junto sem truncar. Ele fica no title. */}
                          {discount > 0.005 && listValue > 0 && (
                            <div
                              className="text-[11.5px] text-emerald-700 dark:text-emerald-400 mt-[3px] truncate"
                              title={`Tabela ${fmtBRL(listValue)} · desconto de ${fmtBRL(discount)}`}
                            >
                              <span className="num">−{fmtBRL(discount)}</span>
                              {discountReason ? ` · ${discountReason.toLowerCase()}` : ' de desconto'}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-[130px] px-[22px] py-5 border-l border-slate-100 dark:border-white/[0.06]">
                          <OriginCell origin={contractOrigin} />
                        </div>

                        <div className="flex-1 min-w-[140px] px-[22px] py-5 border-l border-slate-100 dark:border-white/[0.06]">
                          <CapsLabel>Fechado por</CapsLabel>
                          <div className="flex items-center gap-[7px] mt-[7px] min-w-0">
                            {closedBy ? (
                              <>
                                <Avatar name={closedBy} size={19} />
                                <span className="text-[13px] font-semibold truncate">{closedBy}</span>
                              </>
                            ) : <span className="text-[13px] text-slate-400 dark:text-slate-500">—</span>}
                          </div>
                          {closedAt && <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-[3px]">em {closedAt.toLocaleDateString('pt-BR')}</div>}
                        </div>
                      </div>

                      {/* Ações. O contrato que ainda não começou não tem
                          Renovar: o modal recusa, e trocar o plano ou a data
                          dele é pelo Corrigir. */}
                      {!isReadOnly && (
                        <div className="flex-none flex flex-col justify-center gap-2 px-[22px] py-[18px] border-l border-slate-100 dark:border-white/[0.06]">
                          {paused ? (
                            <Btn kind="success" icon={<PlayCircle size={14} />} onClick={() => onContractAction('reativar')} disabled={loading}>Reativar contrato</Btn>
                          ) : !notStarted && (
                            <Btn kind="brand" icon={<RefreshCw size={14} />} onClick={onRenew} disabled={loading}>Renovar contrato</Btn>
                          )}
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={onEditContract}
                              disabled={loading}
                              className="flex-1 h-8 px-2 rounded-[9px] text-[12px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] whitespace-nowrap transition disabled:opacity-50"
                            >
                              Corrigir
                            </button>
                            {!paused && (
                              <>
                                <span className="w-px h-[18px] flex-none bg-slate-100 dark:bg-white/[0.06]"></span>
                                <button
                                  type="button"
                                  onClick={() => onContractAction('trancar')}
                                  disabled={loading}
                                  className="flex-1 h-8 px-2 rounded-[9px] text-[12px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] whitespace-nowrap transition disabled:opacity-50"
                                >
                                  Trancar
                                </button>
                              </>
                            )}
                            <span className="w-px h-[18px] flex-none bg-slate-100 dark:bg-white/[0.06]"></span>
                            <button
                              type="button"
                              onClick={() => onContractAction('cancelar')}
                              disabled={loading}
                              className="flex-1 h-8 px-2 rounded-[9px] text-[12px] font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-300 dark:hover:bg-rose-500/10 whitespace-nowrap transition disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Faixa de vigência: os marcos de renovação na posição real */}
                    <div className="flex items-center gap-2.5 flex-wrap px-[22px] py-[11px] border-t border-slate-100 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03]">
                      <span className="num text-[11.5px] text-slate-500 dark:text-slate-400 flex-none">
                        {curStartsAt ? curStartsAt.toLocaleDateString('pt-BR') : '—'}
                      </span>
                      <div className="relative flex-1 min-w-[80px] h-4">
                        <span className="absolute left-0 right-0 top-1.5 h-1 rounded-full bg-slate-200/80 dark:bg-white/[0.08]"></span>
                        <span className={cn('absolute left-0 top-1.5 h-1 rounded-full', tone.fill)} style={{ width: `${vigencia?.elapsedPct ?? 0}%` }}></span>
                        {(vigencia?.marks || []).map(m => (
                          <span
                            key={m.days}
                            title={`Marco de ${m.days} dias · ${m.date ? m.date.toLocaleDateString('pt-BR') : ''}${m.handled ? ' · contato feito' : m.passed ? ' · passou sem contato' : ''}`}
                            className={cn(
                              'absolute top-0.5 w-0.5 h-3 -translate-x-1/2 rounded-[1px]',
                              m.active ? 'bg-amber-500' : 'bg-slate-300 dark:bg-white/25'
                            )}
                            style={{ left: `${m.pos}%` }}
                          ></span>
                        ))}
                        {/* O marcador de hoje só existe dentro da vigência. */}
                        {!notStarted && (
                          <span
                            className="absolute top-0 w-[3px] h-4 -translate-x-1/2 rounded-sm bg-slate-900 dark:bg-white"
                            style={{ left: `${vigencia?.elapsedPct ?? 0}%` }}
                          ></span>
                        )}
                      </div>
                      <span className={cn('num text-[11.5px] font-semibold flex-none', tone.fg)}>{curEndsAt.toLocaleDateString('pt-BR')}</span>
                      {(scheduled || inUseNote) && (
                        <>
                          <span className="w-px h-4 flex-none bg-slate-200 dark:bg-white/[0.08]"></span>
                          <span className={cn('text-[11.5px] font-semibold', tone.fg)}>{inUseNote || 'A vigência ainda não começou'}</span>
                        </>
                      )}
                      {paused && (
                        <>
                          <span className="w-px h-4 flex-none bg-slate-200 dark:bg-white/[0.08]"></span>
                          <span className={cn('text-[11.5px] font-semibold flex-none', tone.fg)}>
                            Vigência congelada · restam {Math.max(0, vigencia?.daysLeft ?? 0)} dias quando voltar
                          </span>
                        </>
                      )}
                      {missed && (
                        <>
                          <span className="w-px h-4 flex-none bg-slate-200 dark:bg-white/[0.08]"></span>
                          <span className="text-[11.5px] text-slate-500 dark:text-slate-400 flex-none">{missed}</span>
                        </>
                      )}
                    </div>
                  </section>
                );
              })()
            )}

            {/* A corrente de renovações — só os anteriores; o vigente tem card próprio. */}
            <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
              <div className="flex items-center gap-2.5 px-[22px] py-4 border-b border-slate-100 dark:border-white/[0.06]">
                <h3 className="text-[14.5px] font-semibold tracking-tight">Histórico</h3>
                <span className="num text-[10.5px] font-bold px-[7px] py-0.5 rounded-md bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                  {pastContracts.length === 1 ? '1 anterior' : `${pastContracts.length} anteriores`}
                </span>
                <div className="flex-1"></div>
                <span className="text-[11.5px] text-slate-500 dark:text-slate-400 hidden sm:inline">Do contrato anterior à matrícula</span>
              </div>

              <div className="px-[22px] pt-2 pb-5">
                {pastContracts.length === 0 ? (
                  <div className="py-7 text-center">
                    <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">Nenhum contrato anterior</p>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {hasCurrentContract ? `Este é o primeiro contrato de ${firstName}.` : 'O histórico de planos aparecerá aqui.'}
                    </p>
                  </div>
                ) : pastContracts.map((c, i) => {
                  // "Em uso" e "Renovado" no contrato que já tem renovação
                  // ligada. Antes ele aparecia "A vencer" com o aluno renovado.
                  const hStatus = historyStatusOf(c, leadContracts, new Date(), contractThresholdDays);
                  const hTone = CONTRACT_TONE[hStatus] || CONTRACT_TONE[CONTRACT_STATUS.VENCIDO];
                  const hStart = getSafeDateOrNull(c.startsAt);
                  const hEnd = getSafeDateOrNull(c.endsAt);
                  const hMonths = Number(c.durationMonths)
                    || (hStart && hEnd ? Math.max(1, Math.round(daysBetween(hStart, hEnd) / 30.44)) : 0);
                  const hOrigin = contractOriginOf(c, leadContracts);
                  // A lacuna aparece ACIMA do nó: os dias sem contrato antes do
                  // contrato que veio depois dele de verdade, pela mesma conta
                  // da célula de origem (fim da cobertura anterior, em dias do
                  // calendário). Não é o vizinho de cima: ele pode ser uma
                  // renovação desfeita, que nunca valeu (historySuccessorOf).
                  const successor = historySuccessorOf(c, leadContracts, lead.currentContractId);
                  const successorOrigin = !successor ? null
                    : successor === currentContract ? contractOrigin : contractOriginOf(successor, leadContracts);
                  const gapDays = successorOrigin?.gapDays || 0;
                  const isFirstEver = i === pastContracts.length - 1;
                  return (
                    <div key={c.id}>
                      {gapDays > 0 && (
                        <div className="flex items-center gap-2.5 py-2 pl-[15px]">
                          <span className="h-[26px] flex-none border-l-2 border-dashed border-slate-300 dark:border-white/20"></span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 pl-2">{gapLabel(gapDays)}</span>
                        </div>
                      )}

                      <div className="relative flex items-center gap-3.5 py-3 pr-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.03] transition">
                        {!isFirstEver && <span className="absolute left-[15px] top-0 -bottom-px w-0.5 bg-slate-100 dark:bg-white/[0.06]"></span>}
                        <span
                          title={ORIGIN_LABEL[hOrigin.kind]}
                          className={cn(
                            'relative z-[1] size-8 flex-none rounded-full grid place-items-center ring-4 ring-white dark:ring-[#0e1326]',
                            hTone.block, hTone.fg
                          )}
                        >
                          <OriginIcon kind={hOrigin.kind} />
                          <span className="sr-only">{ORIGIN_LABEL[hOrigin.kind]}</span>
                        </span>

                        <div className="min-w-0 flex-[1.4]">
                          <div className="text-[13.5px] font-semibold truncate">{c.planName || '—'}</div>
                          <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {hStart ? hStart.toLocaleDateString('pt-BR') : '—'} → {hEnd ? hEnd.toLocaleDateString('pt-BR') : '—'}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 hidden sm:block">
                          <div className="num text-[11px] text-slate-500 dark:text-slate-400">
                            {hMonths === 1 ? '1 mês' : `${hMonths} meses`}
                          </div>
                          <div className="h-[5px] rounded-full bg-slate-100 dark:bg-white/[0.06] mt-[5px] overflow-hidden max-w-[150px]">
                            <div
                              className={cn('h-full rounded-full', hStatus === CONTRACT_STATUS.CANCELADO ? 'bg-rose-400' : 'bg-slate-300 dark:bg-slate-600')}
                              style={{ width: `${Math.min(100, Math.round((hMonths / 12) * 100))}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="num w-[92px] flex-none text-right text-[13.5px] font-semibold">{c.value != null ? fmtBRL(c.value) : '—'}</div>

                        <span className="w-[88px] flex-none flex justify-end">
                          <span className={cn('inline-flex items-center h-5 px-2 rounded-md text-[10px] font-bold uppercase tracking-[.05em] whitespace-nowrap', hTone.block, hTone.fg)}>
                            {CONTRACT_STATUS_LABEL[hStatus] || HISTORY_STATUS_LABEL[hStatus]}
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
  );
}
