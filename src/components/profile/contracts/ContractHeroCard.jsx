// O card do contrato em destaque na aba Contratos: a contagem, o plano, o
// valor, a origem, quem fechou e os botões da situação (heroActionsOf, em
// lib/contractsTab.js). Com próximo contrato marcado, o selo diz "Em uso" e o
// card só tranca (ou reativa) e cancela; agendado sem contrato em uso, ele
// ativa agora. O aviso dos marcos que passaram sem contato fica no rodapé e
// some com próximo, porque o cliente já renovou. A régua de vigência que
// ficava no rodapé virou a linha do tempo, acima do card.
// O desenho A2 (16/10/2026) põe o plano como título e três dados embaixo
// (valor, origem, fechado por), com rótulos em minúsculas.
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
import { FieldLabel } from './shared.jsx';

const fmtDia = (d) => (d ? d.toLocaleDateString('pt-BR') : '—');

// De onde veio o contrato. Renovação só quando está ligada ao contrato
// anterior (renewedFromId). Contrato sem ligação é retorno, como no Gerencial.
function OriginCell({ origin }) {
  const kind = origin?.kind || CONTRACT_ORIGIN.PRIMEIRA;
  const prev = origin?.previous || null;
  if (kind === CONTRACT_ORIGIN.RENOVACAO) {
    return (
      <>
        <FieldLabel>Renovado de</FieldLabel>
        <div className="mt-1 text-[15.5px] font-semibold leading-tight [overflow-wrap:anywhere]" title={prev?.planName || undefined}>{prev?.planName || '—'}</div>
        <div className="num mt-[3px] text-[12.5px] text-muted-foreground">
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
        <FieldLabel>{kind === CONTRACT_ORIGIN.UPGRADE ? 'Upgrade' : 'Retorno'}</FieldLabel>
        <div className="mt-1 text-[15.5px] font-semibold leading-tight [overflow-wrap:anywhere]" title={detail ? `${main} · ${detail}` : main}>{main}</div>
        {endText && <div className="num mt-[3px] text-[12.5px] text-muted-foreground">{endText}</div>}
        {gap && <div className="text-[12.5px] text-muted-foreground">{gap}</div>}
      </>
    );
  }
  return (
    <>
      <FieldLabel>Renovado de</FieldLabel>
      <div className="mt-1 text-[15.5px] font-semibold leading-tight">Matrícula inicial</div>
      <div className="mt-[3px] text-[12.5px] text-muted-foreground">primeiro contrato</div>
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

  // As colunas quebram pela largura do card (@container), não da tela: na
  // ficha, o menu e o recuo comem 136 px, e a 881 px de tela o card tem 745.
  // Três faixas: a partir de 1024 px de card, três colunas (contagem, plano e
  // ações); de 672 a 1023, a contagem e o plano lado a lado e as ações numa
  // faixa embaixo; abaixo de 672 (uma tela de 800 px dá 664), tudo empilha. Os
  // três dados ficam em três colunas a partir de 448 px de card.
  return (
    <section className="@container rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="grid grid-cols-1 @2xl:grid-cols-[208px_minmax(0,1fr)] @5xl:grid-cols-[208px_minmax(0,1fr)_auto]">
        {/* A contagem é o que importa */}
        <div className={cn('flex flex-col justify-center px-6 py-6', tone.block)}>
          <div className={cn('flex items-center gap-1.5 text-[13px] font-semibold', tone.fg)}>
            {paused && <PauseCircle size={13} aria-hidden="true" />}
            {countdown.label}
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className={cn('num font-display text-[48px] font-bold leading-none tracking-[-.035em]', tone.fg)}>{countdown.days}</span>
            <span className={cn('text-[15px] font-semibold', tone.fg)}>{countdown.days === 1 ? 'dia' : 'dias'}</span>
          </div>
          <div className="num mt-2 text-[13px] text-slate-600 dark:text-slate-300">{countdown.note}</div>
        </div>

        {/* O plano como título e, embaixo, três dados */}
        <div className="min-w-0 px-7 py-[22px]">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="min-w-0 font-display text-[20px] font-bold tracking-tight [overflow-wrap:anywhere]">{facts.planName || 'Plano'}</span>
            <span className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold whitespace-nowrap', chipTone.block, chipTone.fg)}>
              {hasNext ? 'Em uso' : CONTRACT_STATUS_LABEL[status]}
            </span>
            <span className="num text-[13px] text-muted-foreground">
              {`#${facts.shortId}${facts.months ? `, ${facts.months === 1 ? '1 mês' : `${facts.months} meses`}` : ''}`}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-[22px] @md:grid-cols-3">
            <div className="min-w-0">
              <FieldLabel>Valor</FieldLabel>
              <div className="num mt-1 font-display text-[18px] font-bold leading-tight tracking-tight">{facts.value != null ? fmtBRL(facts.value) : '—'}</div>
              <div className="num mt-[3px] text-[12.5px] text-muted-foreground">
                {facts.monthly != null ? `${fmtBRL(facts.monthly)} por mês` : '—'}
              </div>
              {/* Só o desconto e o motivo, que quebram linha como no mockup.
                  O valor de tabela fica no title. */}
              {facts.discount > 0.005 && facts.listValue > 0 && (
                <div
                  className="mt-[3px] text-[12.5px] text-emerald-700 dark:text-emerald-400"
                  title={`Tabela ${fmtBRL(facts.listValue)} · desconto de ${fmtBRL(facts.discount)}`}
                >
                  <span className="num">{`−${fmtBRL(facts.discount)}`}</span>
                  {facts.discountReason ? ` · ${facts.discountReason.toLowerCase()}` : ' de desconto'}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <OriginCell origin={facts.origin} />
            </div>

            <div className="min-w-0">
              <FieldLabel>Fechado por</FieldLabel>
              <div className="mt-1.5 flex min-w-0 items-center gap-2">
                {closedBy ? (
                  <>
                    <Avatar name={closedBy} size={21} />
                    <span className="truncate text-[15.5px] font-semibold">{closedBy}</span>
                  </>
                ) : <span className="text-[15.5px] text-slate-400 dark:text-slate-500">—</span>}
              </div>
              {facts.closedAt && <div className="num mt-[3px] text-[12.5px] text-muted-foreground">{`em ${fmtDia(facts.closedAt)}`}</div>}
            </div>
          </div>
        </div>

        {/* As ações da situação. Na coluna da direita, com próximo, só os
            botões pequenos, em coluna; no card mais estreito, numa faixa. */}
        {!isReadOnly && (
          <div className="flex flex-col justify-center gap-2 border-t border-border px-6 py-[22px] @2xl:col-span-2 @2xl:flex-row @2xl:items-center @2xl:justify-end @2xl:py-3 @5xl:col-span-1 @5xl:flex-col @5xl:items-stretch @5xl:justify-center @5xl:border-l @5xl:border-t-0 @5xl:py-[22px]">
            {actions.primary === 'renovar' && (
              <Btn kind="brand" icon={<RefreshCw size={14} />} onClick={onRenew} disabled={loading}>Renovar contrato</Btn>
            )}
            {actions.primary === 'reativar' && (
              <Btn kind="success" icon={<PlayCircle size={14} />} onClick={() => onContractAction('reativar', hero)} disabled={loading}>Reativar contrato</Btn>
            )}
            {actions.primary === 'ativar' && (
              <Btn kind="brand" icon={<Play size={13} />} onClick={() => onActivate(hero)} disabled={loading}>Ativar agora</Btn>
            )}
            <div className={cn('flex gap-0.5', hasNext ? 'items-center @5xl:flex-col @5xl:items-stretch' : 'items-center justify-center')}>
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
        <div className="flex items-center gap-2.5 border-t border-border bg-slate-50 px-7 py-[11px] dark:bg-white/[0.03]">
          <span className="text-[13px] text-amber-700 dark:text-amber-300">{missed}</span>
        </div>
      )}
    </section>
  );
}
