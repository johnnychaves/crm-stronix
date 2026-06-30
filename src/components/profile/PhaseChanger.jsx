import { useState } from 'react';
import { Kanban, ArrowRight, Check, TrendingUp, Ban } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Btn } from '../ui/Btn.jsx';
import { phaseToneName, getTone } from '../../lib/leadState.js';

// ── Mudar fase: funil selecionável + pipeline visual + outcomes + transição ──
// Porte fiel do protótipo (design_handoff_perfil_cadastro/prototype/phase.jsx)
// usando DADOS REAIS do app. Props:
//   lead     : { funnelId, status, ... }
//   funnels  : [{ id, name }]
//   statuses : [{ id, name, funnelId, color, order }]
//   onConfirm({ funnelId, targetStatus, note }) (targetStatus = NOME) · onCancel()
// Outcomes do funil são fixos: win = 'Venda', loss = 'Perda'.
// Token: azul primário do protótipo (brand-500=#2B59FF) → brand-600 no app.

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

const PhaseNode = ({ stage, i, len, progressIdx, curIdx, targetIdx, hasTarget, sameFunnel, statuses, onClick }) => {
  const t = getTone(phaseToneName(stage.name, statuses));
  const isTarget = i === targetIdx;
  const done = i < progressIdx;
  const isCurrent = !hasTarget && sameFunnel && i === curIdx;
  const leftPassed = i <= progressIdx;
  const rightPassed = i + 1 <= progressIdx;
  return (
    <button type="button" onClick={onClick} className="flex-1 min-w-[78px] group">
      <div className="flex items-center">
        <div
          className={cn(
            'h-[3px] flex-1 rounded-full transition-colors',
            i === 0 ? 'invisible' : leftPassed ? 'bg-brand-600' : 'bg-slate-200 dark:bg-white/[0.08]'
          )}
        ></div>
        <span
          className={cn(
            'relative w-7 h-7 rounded-full grid place-items-center shrink-0 transition',
            isTarget
              ? cn(t.strong, 'text-white ring-4', `${t.ring}/30`)
              : done
                ? 'bg-brand-600 text-white'
                : isCurrent
                  ? cn('bg-white dark:bg-ink-900 ring-2', t.ring, t.text, t.darkText)
                  : 'bg-slate-100 dark:bg-white/[0.05] text-slate-400 dark:text-slate-500 group-hover:bg-slate-200 dark:group-hover:bg-white/[0.1]'
          )}
        >
          {done || isTarget ? (
            <Check size={13} />
          ) : isCurrent ? (
            <span className={cn('w-2 h-2 rounded-full', t.strong)}></span>
          ) : (
            <span className="text-[11px] font-bold num">{i + 1}</span>
          )}
        </span>
        <div
          className={cn(
            'h-[3px] flex-1 rounded-full transition-colors',
            i === len - 1 ? 'invisible' : rightPassed ? 'bg-brand-600' : 'bg-slate-200 dark:bg-white/[0.08]'
          )}
        ></div>
      </div>
      <div
        className={cn(
          'text-center mt-2 text-[11px] font-semibold leading-tight px-0.5',
          isCurrent ? 'text-slate-900 dark:text-white' : isTarget ? cn(t.text, t.darkText) : 'text-slate-500 dark:text-slate-400'
        )}
      >
        {stage.name}
      </div>
    </button>
  );
};

const OutcomeCard = ({ name, icon, color, desc, selected, onClick }) => {
  const t = getTone(color);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 text-left rounded-xl border p-3 transition group',
        selected
          ? cn(t.soft, t.darkSoft, 'border-transparent ring-2', `${t.ring}/40`)
          : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-white/[0.02] dark:border-white/[0.07] dark:hover:border-white/15'
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'w-9 h-9 rounded-lg grid place-items-center shrink-0',
            selected ? cn(t.strong, 'text-white') : cn(t.soft, t.text, t.darkSoft, t.darkText)
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className={cn('text-[13.5px] font-semibold', selected ? cn(t.text, t.darkText) : 'text-slate-900 dark:text-white')}>{name}</div>
          <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{desc}</div>
        </div>
        {selected && (
          <span className={cn('ml-auto w-5 h-5 rounded-full grid place-items-center text-white shrink-0', t.strong)}>
            <Check size={12} />
          </span>
        )}
      </div>
    </button>
  );
};

const PhaseChanger = ({ lead, funnels = [], statuses = [], onConfirm, onCancel }) => {
  const originalFunnelId = lead?.funnelId || funnels[0]?.id || '';
  const originalFunnel = funnels.find((f) => f.id === originalFunnelId) || funnels[0];
  const originalStage = lead?.status || '';

  const [funnelId, setFunnelId] = useState(originalFunnelId);
  const [target, setTarget] = useState(null); // {name,color}
  const [note, setNote] = useState('');

  const funnel = funnels.find((f) => f.id === funnelId) || funnels[0];
  // Estágios = statuses filtrados pelo funil + ordenados.
  const LINEAR = statuses
    .filter((s) => s.funnelId === funnelId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const sameFunnel = funnelId === originalFunnelId;
  const curIdx = sameFunnel ? LINEAR.findIndex((s) => s.name === originalStage) : -1;

  const targetIdx = target ? LINEAR.findIndex((s) => s.name === target.name) : -1;
  const hasTarget = !!target;
  const progressIdx = targetIdx >= 0 ? targetIdx : curIdx;
  const changed = hasTarget && !(sameFunnel && target.name === originalStage);
  const isAdvance = changed && targetIdx >= 0 && curIdx >= 0 && targetIdx > curIdx;

  const curStage = { name: originalStage };
  const tgtTone = target ? getTone(phaseToneName(target.name, statuses)) : null;

  const winColor = phaseToneName(WIN_NAME, statuses);
  const lossColor = phaseToneName(LOSS_NAME, statuses);

  const pickFunnel = (id) => {
    setFunnelId(id);
    setTarget(null);
  };

  return (
    <div className="space-y-4">
      {/* Seletor de funil */}
      <div>
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Funil de vendas</div>
        <div className="flex flex-wrap gap-1.5">
          {funnels.map((f) => {
            const active = f.id === funnelId;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => pickFunnel(f.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-semibold transition',
                  active
                    ? 'bg-brand-600 text-white shadow-[0_4px_12px_-4px_rgba(43,89,255,.5)]'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 dark:bg-white/[0.03] dark:text-slate-300 dark:border-white/[0.08] dark:hover:border-white/15'
                )}
              >
                <Kanban size={13} className={active ? 'text-white' : 'text-slate-400'} />
                {f.name}
                {f.id === originalFunnelId && (
                  <span
                    className={cn(
                      'text-[9px] font-bold px-1 py-0.5 rounded',
                      active ? 'bg-white/20' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400'
                    )}
                  >
                    ATUAL
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fase atual / mudança de funil */}
      <div className="flex items-center gap-2 flex-wrap text-[12px]">
        <span className="font-semibold uppercase tracking-wider text-[10.5px] text-slate-400 dark:text-slate-500">Fase atual</span>
        {originalStage && <PhaseBadge stage={curStage} statuses={statuses} />}
        {originalFunnel && (
          <span className="text-slate-400 dark:text-slate-500">
            no funil <span className="font-semibold text-slate-600 dark:text-slate-300">{originalFunnel.name}</span>
          </span>
        )}
        {!sameFunnel && funnel && (
          <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/10 px-2 py-0.5 rounded-md">
            <ArrowRight size={12} /> migrando para {funnel.name}
          </span>
        )}
      </div>

      {/* Stepper do pipeline */}
      <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/60 dark:bg-white/[0.02] p-4 overflow-x-auto thin-scroll">
        <div className="flex min-w-[440px]">
          {LINEAR.map((s, i) => (
            <PhaseNode
              key={s.id || s.name}
              stage={s}
              i={i}
              len={LINEAR.length}
              progressIdx={progressIdx}
              curIdx={curIdx}
              targetIdx={targetIdx}
              hasTarget={hasTarget}
              sameFunnel={sameFunnel}
              statuses={statuses}
              onClick={() => setTarget({ name: s.name, color: phaseToneName(s.name, statuses) })}
            />
          ))}
        </div>
      </div>

      {/* Outcomes */}
      <div>
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Encerrar o ciclo</div>
        <div className="flex gap-2.5 flex-col sm:flex-row">
          <OutcomeCard
            name={WIN_NAME}
            icon={<TrendingUp size={16} />}
            color={winColor}
            desc="Lead virou matrícula"
            selected={target && target.name === WIN_NAME}
            onClick={() => setTarget({ name: WIN_NAME, color: winColor })}
          />
          <OutcomeCard
            name={LOSS_NAME}
            icon={<Ban size={16} />}
            color={lossColor}
            desc="Oportunidade encerrada"
            selected={target && target.name === LOSS_NAME}
            onClick={() => setTarget({ name: LOSS_NAME, color: lossColor })}
          />
        </div>
      </div>

      {/* Transição + motivo */}
      {changed && (
        <div className={cn('rounded-xl border border-transparent p-4 ring-1 ring-inset', tgtTone.soft, tgtTone.darkSoft, `${tgtTone.ring}/25`)}>
          <div className="flex items-center gap-2.5 flex-wrap">
            <PhaseBadge stage={curStage} statuses={statuses} />
            <ArrowRight size={15} className="text-slate-400" />
            <PhaseBadge stage={target} statuses={statuses} />
            {!sameFunnel && (
              <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-300 ml-1">
                · {originalFunnel?.name} → {funnel?.name}
              </span>
            )}
            {isAdvance && sameFunnel && (
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-300 ml-1">
                +{targetIdx - curIdx} etapa{targetIdx - curIdx > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={
              target.name === LOSS_NAME
                ? 'Motivo da perda (recomendado)…'
                : target.name === WIN_NAME
                  ? 'Detalhes da venda (plano, valor)…'
                  : 'Por que mudou de fase? (opcional)'
            }
            className="mt-3 w-full rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] focus:border-slate-300 dark:focus:border-white/15 outline-none text-[13px] p-3 placeholder:text-slate-400 resize-none transition"
          />
        </div>
      )}

      {/* Ações */}
      <div className="flex items-center gap-1.5">
        {(target || !sameFunnel) && (
          <button
            type="button"
            onClick={() => {
              setTarget(null);
              setFunnelId(originalFunnelId);
              setNote('');
            }}
            className="text-[12px] font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            Limpar seleção
          </button>
        )}
        <div className="flex-1"></div>
        <Btn kind="soft" size="sm" onClick={onCancel}>
          Cancelar
        </Btn>
        <Btn
          kind={target && target.name === WIN_NAME ? 'success' : target && target.name === LOSS_NAME ? 'danger' : 'brand'}
          size="sm"
          icon={<Check size={13} />}
          disabled={!changed}
          onClick={() => changed && onConfirm?.({ funnelId, targetStatus: target.name, note })}
        >
          {changed ? `Mover para ${target.name}` : 'Selecione a fase'}
        </Btn>
      </div>
    </div>
  );
};

export { PhaseChanger };
