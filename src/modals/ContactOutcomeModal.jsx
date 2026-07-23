import { useMemo, useState } from 'react';
import { Calendar, CheckCircle2, MessageSquare } from 'lucide-react';
import { fromDateInputValue, toDateInputValue } from '../lib/dates.js';
import { logInteraction } from '../lib/interactions.js';
import { contactDone, contactReschedule, followUpChannelOf } from '../lib/contactGoal.js';
import { DAILY_GOAL_CATEGORIES, DAILY_GOAL_CATEGORY_LABEL } from '../lib/leads.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { cn } from '../lib/utils.js';
import { OUTCOME_TONE, outcomeButtonClass, SegmentedOutcome } from '../components/ui/SegmentedOutcome.jsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '../components/ui/dialog.jsx';

// Popup de desfecho da tarefa de CONTATO (Meta Diária) — mesmo idioma visual
// (8b) do RenewalOutcomeModal, com 2 opções. Fino: a regra (patches) vive em
// src/lib/contactGoal.js; aqui só monta a UI e grava via logInteraction.
// Substitui o NextContactModal SÓ para a categoria Contato (atrasado segue no
// fluxo antigo). NUNCA toca status/funil.
//
// onDone(outcome) — outcome ∈ 'feito' | 'reagendar'.

const OUTCOMES = {
  FEITO: 'feito',
  REAGENDAR: 'reagendar'
};

const SEGMENTS = [
  { key: OUTCOMES.FEITO, label: 'Contato feito', Icon: CheckCircle2, tone: 'emerald' },
  { key: OUTCOMES.REAGENDAR, label: 'Reagendar', Icon: Calendar, tone: 'amber' }
];

const FOOTER_LABEL = {
  [OUTCOMES.FEITO]: 'Concluir',
  [OUTCOMES.REAGENDAR]: 'Reagendar'
};

function ContactOutcomeModal({ open = true, onClose, lead, categorySlug = DAILY_GOAL_CATEGORIES.CONTATO_HOJE, appUser, db, onDone }) {
  const toast = useToast();
  const [outcome, setOutcome] = useState(OUTCOMES.FEITO);
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
  const categoryLabel = DAILY_GOAL_CATEGORY_LABEL[categorySlug] || 'Contato';

  const canSubmit = (() => {
    if (submitting) return false;
    if (outcome === OUTCOMES.FEITO) return true;
    if (outcome === OUTCOMES.REAGENDAR) return motivoTrimmed.length > 0 && isRescheduleFuture;
    return false;
  })();

  const handleOpenChange = (next) => { if (!next && !submitting) onClose && onClose(); };

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (outcome === OUTCOMES.FEITO) {
        // Igual ao "Sem próximo contato" de hoje: conclui e limpa o
        // nextFollowUp num único write (leadPatch junto do daily_goal_done).
        await logInteraction(db, lead, appUser, {
          text: `✅ ${categoryLabel} — Meta Diária concluída (contato feito).`,
          type: 'daily_goal_done',
          dailyGoalCategory: categorySlug
        }, contactDone());
        toast.success('Contato concluído.');
      } else if (outcome === OUTCOMES.REAGENDAR) {
        // Igual ao "Escolher data" de hoje: agenda o próximo toque preservando
        // o canal, conta como reaquecimento (volumeKind) e registra o motivo.
        const patch = contactReschedule(lead, parsedReschedule);
        const { volumeKind } = followUpChannelOf(lead);
        const dateFmt = parsedReschedule.toLocaleDateString('pt-BR');
        await logInteraction(db, lead, appUser, {
          text: `Motivo do reagendamento: ${motivoTrimmed} — próximo contato em ${dateFmt}.`,
          type: 'note'
        }, patch);
        await logInteraction(db, lead, appUser, {
          text: `✅ ${categoryLabel} — Meta Diária concluída (contato reagendado para ${dateFmt}).`,
          type: 'daily_goal_done',
          dailyGoalCategory: categorySlug,
          volumeKind,
          rescheduledFor: parsedReschedule
        });
        toast.success(`Contato reagendado para ${dateFmt}.`);
      }
      onDone && onDone(outcome);
    } catch (err) {
      console.error('ContactOutcomeModal', err);
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
            <span className="size-10 rounded-xl grid place-items-center bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300 shrink-0">
              <MessageSquare size={18} />
            </span>
            <span className="min-w-0">
              <span className="block">Concluir contato</span>
              <DialogDescription className="mt-0.5 truncate">{lead?.name || '—'}</DialogDescription>
            </span>
          </DialogTitle>
        </DialogHeader>

        <SegmentedOutcome
          className="px-5 pt-1"
          question="O contato foi feito?"
          segments={SEGMENTS}
          value={outcome}
          onChange={setOutcome}
        />

        <div className="px-5 py-4">
          {outcome === OUTCOMES.FEITO && (
            <div className={cn('rounded-xl px-3.5 py-3 flex items-start gap-2 text-[12.5px] leading-relaxed', OUTCOME_TONE.emerald.panel)}>
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span>Ao confirmar, a tarefa é concluída sem agendar um novo contato.</span>
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
              outcomeButtonClass(SEGMENTS.find(s => s.key === outcome).tone)
            )}
          >
            {submitting ? 'Salvando...' : FOOTER_LABEL[outcome]}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { ContactOutcomeModal };
