import { useState } from 'react';
import { ArrowRight, Ban, Check, Kanban, RefreshCw, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Btn } from '../ui/Btn.jsx';
import { phaseToneName, getTone } from '../../lib/leadState.js';
import { isReferralFunnel } from '../../lib/referrals.js';
import { ReferrerPicker } from './ReferrerPicker.jsx';
import { WizardFrame, WizardStepper, StageHead, WizardSummary, WizardProgress, WizardNote, WizardOption } from './WizardLayout.jsx';

// ── Mudar fase: funil, nova fase e, quando preciso, indicador ──────────────
// Desenho A2: os passos numa linha no topo, só o passo atual embaixo, e o
// resumo, a observação e os botões à direita (WizardLayout). A lógica é a de
// antes: Venda e Perda caem nos fluxos próprios da ficha, mover para o funil de
// Indicações sem vínculo exige o indicador. Props:
//   lead     : { funnelId, status, ... }
//   funnels  : [{ id, name }]
//   statuses : [{ id, name, funnelId, color, order }]
//   onConfirm({ funnelId, targetStatus, note, referrer }) · onCancel()
// Outcomes do funil são fixos: win = 'Venda', loss = 'Perda'.

const WIN_NAME = 'Venda';
const LOSS_NAME = 'Perda';

// Chip de fase a partir de {name,color}
const PhaseBadge = ({ stage, statuses, size = 'md' }) => {
  const t = getTone(phaseToneName(stage.name, statuses));
  const sizing = size === 'sm' ? 'text-[10.5px] px-1.5 py-0.5' : 'text-[11.5px] px-2 py-1';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold rounded-md whitespace-nowrap',
        sizing,
        t.soft,
        t.text,
        t.darkSoft,
        t.darkText
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', t.dot)}></span>
      {stage.name}
    </span>
  );
};

const noteTexts = (targetName) => {
  if (targetName === LOSS_NAME) return { label: 'Motivo da perda (recomendado)', placeholder: 'O que levou à perda?' };
  if (targetName === WIN_NAME) return { label: 'Detalhes da venda', placeholder: 'Plano, valor, o que foi combinado' };
  return { label: 'Observação (opcional)', placeholder: 'Por que mudou de fase?' };
};

const PhaseChanger = ({ lead, db = null, funnels = [], statuses = [], onConfirm, onCancel }) => {
  const originalFunnelId = lead?.funnelId || funnels[0]?.id || '';
  const originalFunnel = funnels.find((f) => f.id === originalFunnelId) || funnels[0];
  const originalStage = lead?.status || '';
  const firstName = (lead?.name || '').split(' ')[0] || 'o lead';

  const [funnelId, setFunnelId] = useState(originalFunnelId);
  const [target, setTarget] = useState(null); // {name,color}
  const [note, setNote] = useState('');
  const [referrer, setReferrer] = useState(null); // cliente indicador (funil de Indicações)
  const [editing, setEditing] = useState(null); // passo reaberto pelo clique na linha

  const funnel = funnels.find((f) => f.id === funnelId) || funnels[0];
  // Estágios = statuses filtrados pelo funil + ordenados.
  const LINEAR = statuses
    .filter((s) => s.funnelId === funnelId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const sameFunnel = funnelId === originalFunnelId;
  const curIdx = sameFunnel ? LINEAR.findIndex((s) => s.name === originalStage) : -1;

  const targetIdx = target ? LINEAR.findIndex((s) => s.name === target.name) : -1;
  const hasTarget = !!target;
  const changed = hasTarget && !(sameFunnel && target.name === originalStage);
  const isAdvance = changed && targetIdx >= 0 && curIdx >= 0 && targetIdx > curIdx;

  // Mover PRO funil de Indicações sem vínculo exige escolher o indicador —
  // mantém o coorte do funil 100% rastreável. Venda/Perda ficam de fora:
  // esses alvos caem nos fluxos próprios sem trocar o funil.
  const movingToReferral = Boolean(funnel && isReferralFunnel(funnel) && funnelId !== originalFunnelId);
  const needsReferrer =
    movingToReferral && !lead?.referredById && hasTarget &&
    target.name !== WIN_NAME && target.name !== LOSS_NAME;

  const curStage = { name: originalStage };
  const idleTone = getTone(phaseToneName(originalStage, statuses));
  const tgtTone = target ? getTone(phaseToneName(target.name, statuses)) : idleTone;
  const winTone = getTone(phaseToneName(WIN_NAME, statuses));
  const lossTone = getTone(phaseToneName(LOSS_NAME, statuses));
  const brand = getTone('brand');

  // O passo aberto embaixo: o que a pessoa reabriu pela linha, ou o que falta.
  const active = editing || (!target ? 'fase' : needsReferrer && !referrer ? 'indicador' : 'fase');
  const steps = [
    { key: 'funil', title: 'Funil', value: funnel?.name || '' },
    { key: 'fase', title: 'Nova fase', value: target?.name || '' },
    ...(needsReferrer ? [{ key: 'indicador', title: 'Indicador', value: referrer?.name || '' }] : []),
  ].map((s) => ({ ...s, state: s.key === active ? 'active' : s.value ? 'done' : 'locked', onEdit: () => setEditing(s.key) }));
  const doneCount = steps.filter((s) => s.value).length;

  const pickFunnel = (id) => {
    setFunnelId(id);
    setTarget(null);
    setReferrer(null);
    setEditing(null);
  };
  const pickTarget = (name) => {
    setTarget({ name, color: phaseToneName(name, statuses) });
    setEditing(null);
  };
  const ready = changed && !(needsReferrer && !referrer);
  const nt = noteTexts(target?.name);

  const stage = active === 'funil' ? (
    <>
      <StageHead title="Funil" hint={`Em qual funil ${firstName} deve ficar?`} />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {funnels.map((f) => (
          <WizardOption
            key={f.id}
            tone={brand}
            Icon={Kanban}
            label={f.name}
            hint={f.id === originalFunnelId ? 'Funil atual' : 'Mover para outro funil'}
            selected={f.id === funnelId}
            onClick={() => pickFunnel(f.id)}
          />
        ))}
      </div>
    </>
  ) : active === 'indicador' ? (
    <>
      <StageHead title="Quem indicou?" hint="O funil de Indicações só recebe leads ligados a um cliente indicador." />
      <ReferrerPicker db={db} value={referrer} onSelect={(r) => { setReferrer(r); setEditing(null); }} excludeId={lead?.id} />
    </>
  ) : (
    <>
      <StageHead title="Nova fase" hint={`Para onde ${firstName} vai agora?`} />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {LINEAR.map((s, i) => {
          const isCurrent = sameFunnel && s.name === originalStage;
          const hint = isCurrent
            ? 'Fase atual'
            : curIdx >= 0
              ? `${i > curIdx ? 'Avança' : 'Volta'} ${Math.abs(i - curIdx)} ${Math.abs(i - curIdx) === 1 ? 'etapa' : 'etapas'}`
              : `Etapa ${i + 1}`;
          return (
            <WizardOption
              key={s.id || s.name}
              tone={getTone(phaseToneName(s.name, statuses))}
              tile={<b className="num text-[14px]">{i + 1}</b>}
              label={s.name}
              hint={hint}
              selected={target?.name === s.name}
              current={isCurrent}
              onClick={() => pickTarget(s.name)}
            />
          );
        })}
      </div>
      <div className="mt-4 border-t border-border pt-3.5">
        <div className="mb-2 text-[12.5px] text-muted-foreground">Encerrar o ciclo</div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <WizardOption tone={winTone} Icon={TrendingUp} label={WIN_NAME} hint="Lead virou matrícula" selected={target?.name === WIN_NAME} onClick={() => pickTarget(WIN_NAME)} />
          <WizardOption tone={lossTone} Icon={Ban} label={LOSS_NAME} hint="Oportunidade encerrada" selected={target?.name === LOSS_NAME} onClick={() => pickTarget(LOSS_NAME)} />
        </div>
      </div>
    </>
  );

  const kindText = !changed ? ''
    : target.name === LOSS_NAME || target.name === WIN_NAME ? 'Encerra o ciclo.'
      : !sameFunnel ? `${originalFunnel?.name} para ${funnel?.name}.`
        : isAdvance ? `Avança ${targetIdx - curIdx} ${targetIdx - curIdx === 1 ? 'etapa' : 'etapas'}.`
          : curIdx >= 0 && targetIdx >= 0 ? `Volta ${curIdx - targetIdx} ${curIdx - targetIdx === 1 ? 'etapa' : 'etapas'}.` : '';

  const aside = (
    <>
      <WizardSummary tone={tgtTone} Icon={RefreshCw} label="Resumo da mudança" complete={changed}>
        {changed ? (
          <>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {originalStage && <PhaseBadge stage={curStage} statuses={statuses} />}
              <ArrowRight size={14} className="text-slate-400" aria-hidden="true" />
              <PhaseBadge stage={target} statuses={statuses} />
            </div>
            {kindText && <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-300">{kindText}</p>}
          </>
        ) : (
          <p className="mt-0.5 text-[13px] text-slate-600 dark:text-slate-300">
            {originalStage ? `${firstName} está em ${originalStage}.` : 'Escolha a nova fase.'}
          </p>
        )}
      </WizardSummary>
      <WizardProgress done={doneCount} total={steps.length} tone={tgtTone} />
      {hasTarget && <WizardNote id="ph-note" label={nt.label} placeholder={nt.placeholder} value={note} onChange={setNote} />}
      <div className="mt-auto flex flex-col gap-2">
        {(target || !sameFunnel) && (
          <button
            type="button"
            onClick={() => { setTarget(null); setFunnelId(originalFunnelId); setNote(''); setReferrer(null); setEditing(null); }}
            className="self-start text-[12.5px] font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:anel-foco"
          >
            Limpar seleção
          </button>
        )}
        <Btn
          kind={target && target.name === WIN_NAME ? 'success' : target && target.name === LOSS_NAME ? 'danger' : 'brand'}
          icon={<Check size={13} />}
          disabled={!ready}
          onClick={() => ready && onConfirm?.({ funnelId, targetStatus: target.name, note, referrer })}
        >
          {changed ? (needsReferrer && !referrer ? 'Vincule o indicador' : `Mover para ${target.name}`) : 'Escolha a nova fase'}
        </Btn>
        <Btn kind="soft" onClick={onCancel}>Cancelar</Btn>
      </div>
    </>
  );

  return <WizardFrame stepper={<WizardStepper steps={steps} label="Passos da mudança de fase" tone={tgtTone} />} stage={stage} aside={aside} />;
};

export { PhaseChanger };
