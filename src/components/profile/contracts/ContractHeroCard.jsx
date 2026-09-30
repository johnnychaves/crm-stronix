// O card do contrato em destaque na aba Contratos: a contagem, o plano, o
// valor, a origem, quem fechou e os botões da situação (heroActionsOf, em
// lib/contractsTab.js). Com próximo contrato marcado, o selo diz "Em uso" e o
// card só tranca (ou reativa) e cancela; agendado sem contrato em uso, ele
// ativa agora. O aviso dos marcos que passaram sem contato fica no rodapé e
// some com próximo, porque o cliente já renovou. A régua de vigência que
// ficava no rodapé virou a linha do tempo, acima do card.
// Mockup: docs/superpowers/specs/mockups/2026-09-30-aba-contratos-em-uso.html
import { Fragment } from 'react';
import { PauseCircle, Play, PlayCircle, RefreshCw } from 'lucide-react';
import { CONTRACT_STATUS, CONTRACT_STATUS_LABEL } from '../../../lib/contracts.js';
import { CONTRACT_ORIGIN, HISTORY_STATUS } from '../../../lib/contractHistory.js';
import { gapText, shortContractId } from '../../../lib/contractsTab.js';
import { fmtBRL } from '../../../lib/format.js';
import { cn } from '../../../lib/utils.js';
import { Avatar } from '../../ui/Avatar.jsx';
import { Btn } from '../../ui/Btn.jsx';
import { CONTRACT_TONE, DIVIDER, LINK_BTN, LINK_BTN_DANGER } from './tone.js';
import { CapsLabel } from './shared.jsx';

const fmtDia = (d) => (d ? d.toLocaleDateString('pt-BR') : '—');

// De onde veio o contrato. Renovação só quando está ligada ao contrato
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
          {prev ? `#${shortContractId(prev.id)} · ` : ''}<span className="whitespace-nowrap">{`${origin.ordinal}ª renovação`}</span>
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
    const endText = coverageEnd ? `até ${fmtDia(coverageEnd)}` : null;
    const gap = origin?.gapDays ? `${gapText(origin.gapDays)} sem contrato` : null;
    const detail = [endText, gap].filter(Boolean).join(' · ');
    return (
      <>
        <CapsLabel>{kind === CONTRACT_ORIGIN.UPGRADE ? 'Upgrade' : 'Retorno'}</CapsLabel>
        <div className="text-[13px] font-semibold mt-[7px] truncate" title={detail ? `${main} · ${detail}` : main}>{main}</div>
        {endText && <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-[3px]">{endText}</div>}
        {gap && <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{gap}</div>}
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

// Os botões pequenos, pelo nome que heroActionsOf devolve.
const ACTION = {
  corrigir: { label: 'Corrigir', danger: false },
  trancar: { label: 'Trancar', danger: false },
  reativar: { label: 'Reativar', danger: false },
  cancelar: { label: 'Cancelar', danger: true }
};

function ActionButton({ action, hero, loading, onEditContract, onContractAction, className }) {
  const cfg = ACTION[action];
  const onClick = action === 'corrigir' ? () => onEditContract(hero) : () => onContractAction(action, hero);
  return (
    <button type="button" onClick={onClick} disabled={loading} className={cn(cfg.danger ? LINK_BTN_DANGER : LINK_BTN, className)}>
      {cfg.label}
    </button>
  );
}

export function ContractHeroCard({
  lead, hero, status, hasNext, countdown, facts, missed, actions, isReadOnly, loading,
  onRenew, onEditContract, onContractAction, onActivate
}) {
  const tone = CONTRACT_TONE[status] || CONTRACT_TONE[CONTRACT_STATUS.ATIVO];
  const paused = status === CONTRACT_STATUS.TRANCADO;
  // Com próximo, o selo do plano diz "Em uso", em verde, seja qual for a
  // situação de hoje. Sem próximo, o selo é a situação (Ativo, A vencer...).
  const chipTone = hasNext ? CONTRACT_TONE[HISTORY_STATUS.EM_USO] : tone;
  const closedBy = facts.closedBy || lead.consultantName;

  return (
    <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-stretch flex-wrap">
        {/* A contagem é o que importa */}
        <div className={cn('w-[186px] flex-none px-[22px] py-5', tone.block)}>
          <div className={cn('flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-[.08em]', tone.fg)}>
            {paused && <PauseCircle size={11} aria-hidden="true" />}
            {countdown.label}
          </div>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className={cn('num font-display text-[40px] font-bold leading-none tracking-[-.03em]', tone.fg)}>{countdown.days}</span>
            <span className={cn('text-[13px] font-semibold', tone.fg)}>{countdown.days === 1 ? 'dia' : 'dias'}</span>
          </div>
          <div className="num text-[11.5px] text-slate-600 dark:text-slate-300 mt-[7px]">{countdown.note}</div>
        </div>

        {/* Quatro células divididas por régua */}
        <div className="flex-1 min-w-0 flex items-stretch flex-wrap">
          <div className="flex-[1.2] min-w-[160px] px-[22px] py-5">
            <CapsLabel>Plano</CapsLabel>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="font-display text-[18px] font-bold tracking-tight">{facts.planName || 'Plano'}</span>
              <span className={cn('inline-flex items-center h-[19px] px-[7px] rounded-[5px] text-[9.5px] font-bold uppercase tracking-[.05em]', chipTone.block, chipTone.fg)}>
                {hasNext ? 'Em uso' : CONTRACT_STATUS_LABEL[status]}
              </span>
            </div>
            <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-[5px]">
              {`#${facts.shortId}${facts.months ? ` · ${facts.months === 1 ? '1 mês' : `${facts.months} meses`}` : ''}`}
            </div>
          </div>

          <div className="flex-1 min-w-[130px] px-[22px] py-5 border-l border-slate-100 dark:border-white/[0.06]">
            <CapsLabel>Valor</CapsLabel>
            <div className="num font-display text-[18px] font-bold tracking-tight mt-1.5">{facts.value != null ? fmtBRL(facts.value) : '—'}</div>
            <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-[5px]">
              {facts.monthly != null ? `${fmtBRL(facts.monthly)}/mês` : '—'}
            </div>
            {/* Só o desconto e o motivo: a célula não comporta o valor de
                tabela junto sem truncar. Ele fica no title. */}
            {facts.discount > 0.005 && facts.listValue > 0 && (
              <div
                className="text-[11.5px] text-emerald-700 dark:text-emerald-400 mt-[3px] truncate"
                title={`Tabela ${fmtBRL(facts.listValue)} · desconto de ${fmtBRL(facts.discount)}`}
              >
                <span className="num">{`−${fmtBRL(facts.discount)}`}</span>
                {facts.discountReason ? ` · ${facts.discountReason.toLowerCase()}` : ' de desconto'}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-[130px] px-[22px] py-5 border-l border-slate-100 dark:border-white/[0.06]">
            <OriginCell origin={facts.origin} />
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
            {facts.closedAt && <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-[3px]">{`em ${fmtDia(facts.closedAt)}`}</div>}
          </div>
        </div>

        {/* As ações da situação. Com próximo, só os botões pequenos, em
            coluna, como no mockup. */}
        {!isReadOnly && (
          <div className="flex-none flex flex-col justify-center gap-2 px-[22px] py-[18px] border-l border-slate-100 dark:border-white/[0.06]">
            {actions.primary === 'renovar' && (
              <Btn kind="brand" icon={<RefreshCw size={14} />} onClick={onRenew} disabled={loading}>Renovar contrato</Btn>
            )}
            {actions.primary === 'reativar' && (
              <Btn kind="success" icon={<PlayCircle size={14} />} onClick={() => onContractAction('reativar', hero)} disabled={loading}>Reativar contrato</Btn>
            )}
            {actions.primary === 'ativar' && (
              <Btn kind="brand" icon={<Play size={13} />} onClick={() => onActivate(hero)} disabled={loading}>Ativar agora</Btn>
            )}
            <div className={cn('flex gap-0.5', hasNext ? 'flex-col items-stretch' : 'items-center')}>
              {actions.actions.map((action, i) => (
                <Fragment key={action}>
                  {i > 0 && !hasNext && <span className={DIVIDER}></span>}
                  <ActionButton
                    action={action}
                    hero={hero}
                    loading={loading}
                    onEditContract={onEditContract}
                    onContractAction={onContractAction}
                    className={hasNext ? 'text-left' : 'flex-1'}
                  />
                </Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {missed && (
        <div className="flex items-center gap-2.5 px-[22px] py-[9px] border-t border-slate-100 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03]">
          <span className="text-[11.5px] text-slate-500 dark:text-slate-400">{missed}</span>
        </div>
      )}
    </section>
  );
}
