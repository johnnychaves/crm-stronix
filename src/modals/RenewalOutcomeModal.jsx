import { useMemo, useState } from 'react';
import { Ban, Calendar, CheckCircle2, Info, RefreshCw } from 'lucide-react';
import { fromDateInputValue, toDateInputValue } from '../lib/dates.js';
import { fmtBRL } from '../lib/format.js';
import { logInteraction } from '../lib/interactions.js';
import { renewalDecline, renewalReschedule } from '../lib/renewalGoal.js';
import { DAILY_GOAL_CATEGORIES } from '../lib/leads.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { cn } from '../lib/utils.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '../components/ui/dialog.jsx';

// Popup de desfecho da tarefa de Renovação (Meta Diária) — design "8b" do
// handoff (seletor segmentado). Fino de propósito: toda a regra (patches,
// gate de entrada) vive em src/lib/renewalGoal.js; este componente só monta
// a UI e grava via logInteraction. NUNCA muda status/lifecycleStage — perda
// de venda (não renova) é diferente de perda de funil.
//
// onDone(outcome) — outcome ∈ 'renovou' | 'nao_renova' | 'reagendar'. Pra
// 'renovou' o modal não grava nada (fecha e o caller abre o MatriculaModal
// existente em mode='renovacao', que já reseta os campos de renovação).

const OUTCOMES = {
  RENOVOU: 'renovou',
  NAO_RENOVA: 'nao_renova',
  REAGENDAR: 'reagendar'
};

const SEGMENTS = [
  { key: OUTCOMES.RENOVOU, label: 'Renovou', Icon: CheckCircle2, tone: 'emerald' },
  { key: OUTCOMES.NAO_RENOVA, label: 'Não vai renovar', Icon: Ban, tone: 'rose' },
  { key: OUTCOMES.REAGENDAR, label: 'Reagendar contato', Icon: Calendar, tone: 'amber' }
];

const TONE = {
  emerald: {
    segmentActive: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    panel: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    button: 'bg-[#059669] hover:bg-emerald-700 text-white shadow-[0_4px_14px_-4px_rgba(5,150,105,0.6)]'
  },
  rose: {
    segmentActive: 'bg-rose-100 text-rose-700 ring-1 ring-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
    panel: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
    button: 'bg-[#e11d48] hover:bg-rose-700 text-white shadow-[0_4px_14px_-4px_rgba(225,29,72,0.6)]'
  },
  amber: {
    segmentActive: 'bg-amber-100 text-amber-700 ring-1 ring-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
    panel: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    button: 'bg-[#d97706] hover:bg-amber-700 text-white shadow-[0_4px_14px_-4px_rgba(217,119,6,0.6)]'
  }
};

const FOOTER_LABEL = {
  [OUTCOMES.RENOVOU]: 'Renovar',
  [OUTCOMES.NAO_RENOVA]: 'Registrar perda',
  [OUTCOMES.REAGENDAR]: 'Reagendar'
};

function RenewalOutcomeModal({ open = true, onClose, lead, appUser, db, activeCheckpoint, onDone }) {
  const toast = useToast();
  const [outcome, setOutcome] = useState(OUTCOMES.RENOVOU);
  const [motivo, setMotivo] = useState('');
  const [rescheduleStr, setRescheduleStr] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toDateInputValue(d);
  });
  const [submitting, setSubmitting] = useState(false);

  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const parsedReschedule = fromDateInputValue(rescheduleStr);
  const isRescheduleFuture = Boolean(parsedReschedule) && parsedReschedule.getTime() > todayStart.getTime();
  const motivoTrimmed = motivo.trim();

  const endsAtLabel = lead?.currentContractEndsAt
    ? (lead.currentContractEndsAt.toDate ? lead.currentContractEndsAt.toDate() : new Date(lead.currentContractEndsAt)).toLocaleDateString('pt-BR')
    : null;

  const canSubmit = (() => {
    if (submitting) return false;
    if (outcome === OUTCOMES.RENOVOU) return true;
    if (outcome === OUTCOMES.NAO_RENOVA) return motivoTrimmed.length > 0;
    if (outcome === OUTCOMES.REAGENDAR) return motivoTrimmed.length > 0 && isRescheduleFuture;
    return false;
  })();

  const handleOpenChange = (next) => { if (!next && !submitting) onClose && onClose(); };

  const handleConfirm = async () => {
    if (!canSubmit) return;

    if (outcome === OUTCOMES.RENOVOU) {
      // Não grava nada aqui — o caller abre o MatriculaModal (mode='renovacao'),
      // que grava o contrato E reseta os campos de renovação num único batch.
      onDone && onDone(OUTCOMES.RENOVOU);
      return;
    }

    setSubmitting(true);
    try {
      if (outcome === OUTCOMES.NAO_RENOVA) {
        const patch = renewalDecline(lead, activeCheckpoint);
        await logInteraction(db, lead, appUser, {
          text: `Motivo da perda de renovação: ${motivoTrimmed}`,
          type: 'note'
        }, patch);
        await logInteraction(db, lead, appUser, {
          text: '✅ Renovação — Meta Diária concluída (não vai renovar).',
          type: 'daily_goal_done',
          dailyGoalCategory: DAILY_GOAL_CATEGORIES.RENOVACAO
        });
        toast.success('Perda de renovação registrada. O cliente continua ativo — só sai desta cobrança.');
      } else if (outcome === OUTCOMES.REAGENDAR) {
        const patch = renewalReschedule(parsedReschedule);
        const dateFmt = parsedReschedule.toLocaleDateString('pt-BR');
        await logInteraction(db, lead, appUser, {
          text: `Motivo do reagendamento: ${motivoTrimmed} — próximo contato em ${dateFmt}.`,
          type: 'note'
        }, patch);
        await logInteraction(db, lead, appUser, {
          text: `✅ Renovação — Meta Diária concluída (reagendado para ${dateFmt}).`,
          type: 'daily_goal_done',
          dailyGoalCategory: DAILY_GOAL_CATEGORIES.RENOVACAO
        });
        toast.success(`Reagendado para ${dateFmt}.`);
      }
      onDone && onDone(outcome);
    } catch (err) {
      console.error('RenewalOutcomeModal', err);
      toast.error('Não foi possível salvar o desfecho. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="z-[210] max-w-md p-0 gap-0 overflow-hidden" overlayClassName="z-[210]">
        <DialogHeader className="p-5 pb-4 space-y-0">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="size-10 rounded-xl grid place-items-center bg-brand-50 text-brand-600 dark:bg-brand-600/20 dark:text-[#9FBCFF] shrink-0">
              <RefreshCw size={18} />
            </span>
            <span className="min-w-0">
              <span className="block">Renovação de contrato</span>
              <DialogDescription className="mt-0.5 truncate">{lead?.name || '—'}</DialogDescription>
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-5">
          <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-border px-3.5 py-2.5 flex items-center gap-2 flex-wrap text-[12px] text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-foreground">{lead?.currentPlanName || 'Sem plano'}</span>
            {Number.isFinite(Number(lead?.currentContractValue)) && (
              <>
                <span className="opacity-50">·</span>
                <span>{fmtBRL(lead.currentContractValue)}</span>
              </>
            )}
            {endsAtLabel && (
              <>
                <span className="opacity-50">·</span>
                <span>Vence em <b className="font-semibold text-foreground">{endsAtLabel}</b></span>
              </>
            )}
            {activeCheckpoint != null && (
              <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-[#9FBCFF] whitespace-nowrap">
                Marco de {activeCheckpoint} dias
              </span>
            )}
          </div>
        </div>

        <div className="px-5 pt-4">
          <label className="flex items-center gap-1 text-[13.5px] font-semibold text-foreground">
            Qual o desfecho desta renovação?
            <span className="text-accent-500 text-[12px] leading-none">*</span>
          </label>

          <div className="mt-2.5 flex items-center gap-1 p-1 rounded-xl bg-slate-50 dark:bg-white/5 border border-border">
            {SEGMENTS.map(({ key, label, Icon, tone }) => {
              const active = outcome === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setOutcome(key)}
                  className={cn(
                    'flex-1 h-9 rounded-lg text-[12.5px] font-medium inline-flex items-center justify-center gap-1.5 transition',
                    active ? TONE[tone].segmentActive : 'text-muted-foreground hover:bg-white/60 dark:hover:bg-white/[0.04]'
                  )}
                >
                  <Icon size={13} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-4">
          {outcome === OUTCOMES.RENOVOU && (
            <div className={cn('rounded-xl px-3.5 py-3 flex items-start gap-2 text-[12.5px] leading-relaxed', TONE.emerald.panel)}>
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span>Ao confirmar, abrimos o fluxo de nova matrícula com os dados do cliente.</span>
            </div>
          )}

          {outcome === OUTCOMES.REAGENDAR && (
            <div className="space-y-3">
              <div>
                <label className="flex items-center gap-1 text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Data do próximo contato
                  <span className="text-accent-500 normal-case text-[12px] leading-none">*</span>
                </label>
                <input
                  type="date"
                  value={rescheduleStr}
                  onChange={(e) => setRescheduleStr(e.target.value)}
                  className="w-full h-[38px] px-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] num transition"
                />
                {rescheduleStr && !isRescheduleFuture && (
                  <p className="text-[11.5px] text-rose-600 dark:text-rose-400 mt-1.5">Escolha uma data futura.</p>
                )}
              </div>
              <div>
                <label className="flex items-center gap-1 text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Motivo do reagendamento
                  <span className="text-accent-500 normal-case text-[12px] leading-none">*</span>
                </label>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={2}
                  placeholder="Escreva o motivo do reagendamento…"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] transition resize-none"
                />
              </div>
            </div>
          )}

          {outcome === OUTCOMES.NAO_RENOVA && (
            <div className="space-y-3">
              <div>
                <label className="flex items-center gap-1 text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Motivo da perda
                  <span className="text-accent-500 normal-case text-[12px] leading-none">*</span>
                </label>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  placeholder="Escreva o motivo da perda…"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] transition resize-none"
                />
              </div>
              <div className={cn('rounded-xl px-3.5 py-3 flex items-start gap-2 text-[12px] leading-relaxed bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-[#9FBCFF]')}>
                <Info size={15} className="mt-0.5 shrink-0" />
                <span>Continua cliente — não vai pro "Perda" do funil.</span>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-border flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => !submitting && onClose && onClose()}
            disabled={submitting}
            className="h-[38px] px-3.5 rounded-xl text-[13px] font-semibold border border-border bg-transparent text-muted-foreground hover:bg-muted/50 transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
            className={cn(
              'h-[38px] px-4 rounded-xl text-[13px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
              TONE[SEGMENTS.find(s => s.key === outcome).tone].button
            )}
          >
            {submitting ? 'Salvando...' : FOOTER_LABEL[outcome]}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { RenewalOutcomeModal };
