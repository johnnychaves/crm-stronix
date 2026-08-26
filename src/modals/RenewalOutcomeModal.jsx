import { useMemo, useState } from 'react';
import { Ban, Calendar, CheckCircle2, Info, RefreshCw } from 'lucide-react';
import { fromDateTimeInputValue, toDateTimeInputValue } from '../lib/dates.js';
import { fmtBRL, formatHourLabel } from '../lib/format.js';
import { logInteraction } from '../lib/interactions.js';
import { renewalDecline, renewalReschedule } from '../lib/renewalGoal.js';
import { expiredLabel } from '../lib/expiredGoal.js';
import { DAILY_GOAL_CATEGORIES } from '../lib/leads.js';
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

// Popup de desfecho da tarefa de Renovação (Meta Diária) — design "8b" do
// handoff (seletor segmentado). Fino de propósito: toda a regra (patches,
// gate de entrada) vive em src/lib/renewalGoal.js; este componente só monta
// a UI e grava via logInteraction. NUNCA muda status/lifecycleStage — perda
// de venda (não renova) é diferente de perda de funil.
//
// onDone(outcome) — outcome ∈ 'renovou' | 'nao_renova' | 'reagendar'. Pra
// 'renovou' o modal não grava nada (fecha e o caller abre o ContractModal
// existente em mode='renovacao', que já reseta os campos de renovação).

const OUTCOMES = {
  RENOVOU: 'renovou',
  NAO_RENOVA: 'nao_renova',
  REAGENDAR: 'reagendar'
};

const FOOTER_LABEL = {
  [OUTCOMES.RENOVOU]: 'Renovar',
  [OUTCOMES.NAO_RENOVA]: 'Registrar perda',
  [OUTCOMES.REAGENDAR]: 'Reagendar'
};

// Os dois funis de CLIENTE usam o mesmo popup: a mecânica dos três desfechos é
// idêntica, muda o vocabulário. 'renovacao' cobra antes de vencer; 'vencido'
// cobra depois (ver src/lib/expiredGoal.js).
const VARIANTS = {
  renovacao: {
    title: 'Renovação de contrato',
    question: 'Qual o desfecho desta renovação?',
    category: DAILY_GOAL_CATEGORIES.RENOVACAO,
    categoryLabel: 'Renovação',
    okLabel: 'Renovou',
    noLabel: 'Não vai renovar',
    okFooter: 'Renovar',
    okHint: 'Ao confirmar, abrimos o fluxo de nova matrícula com os dados do cliente.',
    noDoneText: '✅ Renovação — Meta Diária concluída (não vai renovar).',
    noToast: 'Perda de renovação registrada. O cliente continua ativo — só sai desta cobrança.'
  },
  vencido: {
    title: 'Contrato vencido',
    question: 'Qual o desfecho deste contrato vencido?',
    category: DAILY_GOAL_CATEGORIES.VENCIDO,
    categoryLabel: 'Contrato vencido',
    okLabel: 'Reativou',
    noLabel: 'Não vai voltar',
    okFooter: 'Reativar',
    okHint: 'Ao confirmar, abrimos o fluxo de matrícula para reativar este cliente.',
    noDoneText: '✅ Contrato vencido — Meta Diária concluída (não vai voltar).',
    noToast: 'Registrado. Este cliente sai da cobrança de vencidos.'
  }
};

function RenewalOutcomeModal({ open = true, onClose, lead, appUser, db, activeCheckpoint, variant = 'renovacao', onDone }) {
  const v = VARIANTS[variant] || VARIANTS.renovacao;
  const toast = useToast();
  const [outcome, setOutcome] = useState(OUTCOMES.RENOVOU);
  const [motivo, setMotivo] = useState('');
  // Amanhã às 09:00, o mesmo horário que o wizard de agendamento sugere para
  // dias futuros. Dia e hora saem do mesmo campo.
  const [rescheduleStr, setRescheduleStr] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return toDateTimeInputValue(d);
  });
  const [submitting, setSubmitting] = useState(false);

  // Trava de instante futuro. Até 26/08/2026 a tela pedia só o DIA e gravava
  // meia-noite, então todo reagendamento nascia às 00h; com a hora no campo o
  // corte vira "depois de agora". Marcar para hoje mais tarde é caso real
  // (mensagem sem resposta de manhã) e não joga o lead em Atrasados: a Meta
  // classifica atraso por DIA (ver dailyGoal.js). O `nowMs` é fixado na
  // montagem para o render seguir puro; o clique confere de novo no relógio.
  const nowMs = useMemo(() => Date.now(), []);
  const minRescheduleStr = useMemo(() => toDateTimeInputValue(new Date(nowMs)), [nowMs]);
  const parsedReschedule = fromDateTimeInputValue(rescheduleStr);
  const isRescheduleFuture = Boolean(parsedReschedule) && parsedReschedule.getTime() > nowMs;
  const motivoTrimmed = motivo.trim();

  // Vencidos troca "Marco de N dias" pelo selo de vencimento — calculado aqui
  // dentro pra não chamar new Date() direto no render.
  const expiredBadge = useMemo(
    () => (variant === 'vencido' ? expiredLabel(lead) : null),
    [variant, lead]
  );

  const segments = [
    { key: OUTCOMES.RENOVOU, label: v.okLabel, Icon: CheckCircle2, tone: 'emerald' },
    { key: OUTCOMES.NAO_RENOVA, label: v.noLabel, Icon: Ban, tone: 'rose' },
    { key: OUTCOMES.REAGENDAR, label: 'Reagendar contato', Icon: Calendar, tone: 'amber' }
  ];
  const footerLabel = { ...FOOTER_LABEL, [OUTCOMES.RENOVOU]: v.okFooter };

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
    // O nowMs do render envelhece se o popup ficar aberto; confere no relógio
    // antes de gravar para nunca agendar um contato no passado.
    if (outcome === OUTCOMES.REAGENDAR && (!parsedReschedule || parsedReschedule.getTime() <= Date.now())) {
      toast.warning('Escolha uma data e hora futuras.');
      return;
    }

    if (outcome === OUTCOMES.RENOVOU) {
      // Não grava nada aqui — o caller abre o ContractModal (mode='renovacao'),
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
          text: v.noDoneText,
          type: 'daily_goal_done',
          dailyGoalCategory: v.category
        });
        toast.success(v.noToast);
      } else if (outcome === OUTCOMES.REAGENDAR) {
        // Reagendar: o marco atual conta como resolvido (handled) e o contato
        // vira um follow-up na categoria Contatos na data escolhida (nextFollowUp).
        // Volta a Renovações só no próximo marco — ver src/lib/renewalGoal.js.
        const patch = renewalReschedule(lead, parsedReschedule, activeCheckpoint);
        const dateFmt = `${parsedReschedule.toLocaleDateString('pt-BR')} às ${formatHourLabel(parsedReschedule)}`;
        await logInteraction(db, lead, appUser, {
          text: `Motivo do reagendamento: ${motivoTrimmed} — próximo contato em ${dateFmt}.`,
          type: 'note'
        }, patch);
        await logInteraction(db, lead, appUser, {
          text: `✅ ${v.categoryLabel} — Meta Diária concluída (contato reagendado para ${dateFmt}).`,
          type: 'daily_goal_done',
          dailyGoalCategory: v.category
        });
        toast.success(`Contato reagendado para ${dateFmt} — agora aparece em Contatos.`);
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
              <span className="block">{v.title}</span>
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
            {expiredBadge ? (
              <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-slate-200 whitespace-nowrap">
                {expiredBadge}
              </span>
            ) : activeCheckpoint != null && (
              <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-[#9FBCFF] whitespace-nowrap">
                Marco de {activeCheckpoint} dias
              </span>
            )}
          </div>
        </div>

        <SegmentedOutcome
          className="px-5 pt-4"
          question={v.question}
          segments={segments}
          value={outcome}
          onChange={setOutcome}
        />

        <div className="px-5 py-4">
          {outcome === OUTCOMES.RENOVOU && (
            <div className={cn('rounded-xl px-3.5 py-3 flex items-start gap-2 text-[12.5px] leading-relaxed', OUTCOME_TONE.emerald.panel)}>
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span>{v.okHint}</span>
            </div>
          )}

          {outcome === OUTCOMES.REAGENDAR && (
            <div className="space-y-3">
              <div>
                <label className="flex items-center gap-1 text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Data e hora do próximo contato
                  <span className="text-accent-500 normal-case text-[12px] leading-none">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={rescheduleStr}
                  min={minRescheduleStr}
                  onChange={(e) => setRescheduleStr(e.target.value)}
                  className="w-full h-[38px] px-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] num transition"
                />
                {rescheduleStr && !isRescheduleFuture && (
                  <p className="text-[11.5px] text-rose-600 dark:text-rose-400 mt-1.5">Escolha uma data e hora futuras.</p>
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
              outcomeButtonClass(segments.find(s => s.key === outcome).tone)
            )}
          >
            {submitting ? 'Salvando...' : footerLabel[outcome]}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { RenewalOutcomeModal };
