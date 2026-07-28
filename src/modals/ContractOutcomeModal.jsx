import { useState } from 'react';
import { Ban, PauseCircle, PlayCircle } from 'lucide-react';
import {
  CONTRACT_CANCEL_REASONS,
  CONTRACT_PAUSE_REASONS,
  buildContractCancel,
  buildContractPause,
  buildContractResume
} from '../lib/contracts.js';
import { commitContractPatch } from '../lib/contractsWrites.js';
import { daysBetween, fromDateInputValue, getSafeDateOrNull, toDateInputValue } from '../lib/dates.js';
import { cn } from '../lib/utils.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog.jsx';

// Desfechos do contrato VIGENTE: cancelar, trancar e reativar. Os três têm a
// mesma forma — uma data, às vezes um motivo, e a consequência escrita antes
// de confirmar. O cancelamento era um window.confirm que gravava motivo null;
// o trancamento não existia.
//
// O que gravar vive em lib/contracts.js; o como, em lib/contractsWrites.js.

const fmtDate = (d) => (d ? d.toLocaleDateString('pt-BR') : '—');

const ACTIONS = {
  cancelar: {
    title: 'Cancelar contrato',
    icon: Ban,
    tone: 'rose',
    reasons: CONTRACT_CANCEL_REASONS,
    dateLabel: 'Data do cancelamento',
    confirm: 'Confirmar cancelamento',
    saving: 'Cancelando...'
  },
  trancar: {
    title: 'Trancar contrato',
    icon: PauseCircle,
    tone: 'brand',
    reasons: CONTRACT_PAUSE_REASONS,
    dateLabel: 'Trancar a partir de',
    confirm: 'Confirmar trancamento',
    saving: 'Trancando...'
  },
  reativar: {
    title: 'Reativar contrato',
    icon: PlayCircle,
    tone: 'emerald',
    reasons: null,
    dateLabel: 'Voltou em',
    confirm: 'Confirmar reativação',
    saving: 'Reativando...'
  }
};

const TONE_CLASS = {
  rose: { chip: 'bg-rose-500/10 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400', btn: 'bg-rose-600 hover:bg-rose-700' },
  brand: { chip: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300', btn: 'bg-brand-600 hover:bg-brand-700' },
  emerald: { chip: 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400', btn: 'bg-emerald-600 hover:bg-emerald-500' }
};

function ContractOutcomeModal({ lead, appUser, db, contract, action = 'cancelar', onClose, onDone }) {
  const toast = useToast();
  const cfg = ACTIONS[action] || ACTIONS.cancelar;
  const tone = TONE_CLASS[cfg.tone];
  const Icon = cfg.icon;

  const [dateStr, setDateStr] = useState(toDateInputValue(new Date()));
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const when = fromDateInputValue(dateStr);
  const pausedAt = getSafeDateOrNull(contract?.pausedAt);
  const endsAt = getSafeDateOrNull(contract?.endsAt);

  // Prévia da reativação: quantos dias pararam e para onde o término anda.
  const pausedDays = action === 'reativar' && pausedAt && when
    ? Math.max(0, daysBetween(pausedAt, when) || 0)
    : 0;

  const preview = (() => {
    if (action === 'reativar') {
      const novo = buildContractResume({ contract, resumedAt: when || new Date() });
      return pausedDays > 0
        ? `${pausedDays} ${pausedDays === 1 ? 'dia parado' : 'dias parados'} — o término vai de ${fmtDate(endsAt)} para ${fmtDate(novo.newEndsAt)}.`
        : 'Nenhum dia parado — a vigência segue igual.';
    }
    if (action === 'trancar') {
      return 'A vigência congela nesta data. Quando reativar, o término anda para frente pelos dias parados — o cliente não perde o que pagou.';
    }
    const primeiro = (lead?.name || '').trim().split(/\s+/)[0] || 'o cliente';
    return `O contrato é encerrado${when ? ` em ${fmtDate(when)}` : ''} e ${primeiro} passa a contar como inativo. O histórico fica registrado.`;
  })();

  const handleClose = (open) => { if (!open && !submitting) onClose && onClose(); };

  const handleConfirm = async () => {
    if (!when) { toast.warning('Informe a data.'); return; }
    if (cfg.reasons && !reason) { toast.warning('Escolha o motivo.'); return; }

    setSubmitting(true);
    try {
      const planName = contract?.planName || lead?.currentPlanName;
      const built = action === 'cancelar'
        ? buildContractCancel({ planName, cancelledAt: when, reason, note: note.trim() || null })
        : action === 'trancar'
          ? buildContractPause({ planName, pausedAt: when, reason })
          : buildContractResume({ contract, resumedAt: when });

      await commitContractPatch({
        db,
        lead,
        appUser,
        contractId: contract?.id || lead?.currentContractId,
        contractPatch: built.contractPatch,
        leadPatch: built.leadPatch,
        interactionText: built.interactionText
      });

      toast.success(
        action === 'cancelar' ? 'Contrato cancelado.'
          : action === 'trancar' ? 'Contrato trancado.'
            : 'Contrato reativado.'
      );
      onDone && onDone();
    } catch (e) {
      console.error('Erro no desfecho do contrato:', e);
      toast.error('Não foi possível salvar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent
        overlayClassName="z-[210]"
        className="z-[210] max-w-[520px] gap-0 p-0 block overflow-hidden rounded-2xl border-border"
      >
        <div className="flex items-start gap-3.5 px-6 pt-5 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
          <span className={cn('size-10 flex-none rounded-xl grid place-items-center', tone.chip)}>
            <Icon size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="font-display text-[18px] font-bold tracking-tight">{cfg.title}</DialogTitle>
            <div className="num text-[12.5px] text-slate-500 dark:text-slate-400 mt-1 truncate">
              {lead?.name || 'Cliente'} · {contract?.planName || lead?.currentPlanName || 'Plano'}
              {endsAt ? ` · até ${fmtDate(endsAt)}` : ''}
            </div>
          </div>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {cfg.reasons && (
            <div>
              <div className="text-[9.5px] font-bold uppercase tracking-[.08em] text-slate-500 dark:text-slate-400 mb-2">
                Motivo
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cfg.reasons.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={cn(
                      'h-[30px] px-3 rounded-lg border-[1.5px] text-[12px] font-semibold whitespace-nowrap transition',
                      r === reason
                        ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/15 dark:text-brand-300'
                        : 'border-border bg-card text-slate-600 dark:text-slate-300 hover:border-brand-200 dark:hover:border-brand-500/45'
                    )}
                  >{r}</button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label htmlFor="contract-outcome-date" className="text-[9.5px] font-bold uppercase tracking-[.08em] text-slate-500 dark:text-slate-400 block mb-2">
                {cfg.dateLabel}
              </label>
              <input
                id="contract-outcome-date"
                type="date"
                value={dateStr}
                onChange={e => setDateStr(e.target.value)}
                className="num h-10 w-[190px] rounded-[10px] border border-border bg-card text-[13px] px-3 outline-none focus:border-brand-400 transition"
              />
            </div>
            {action === 'reativar' && pausedAt && (
              <span className="num text-[11.5px] text-slate-500 dark:text-slate-400 pb-3">
                trancado desde {fmtDate(pausedAt)}
              </span>
            )}
          </div>

          {action === 'cancelar' && (
            <div>
              <label htmlFor="contract-cancel-note" className="text-[9.5px] font-bold uppercase tracking-[.08em] text-slate-500 dark:text-slate-400 block mb-2">
                Observação <span className="font-medium normal-case tracking-normal text-slate-400">(opcional)</span>
              </label>
              <textarea
                id="contract-cancel-note"
                rows={2}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="O que aconteceu, em uma linha."
                className="w-full rounded-[10px] border border-border bg-card text-[13px] px-3 py-2 outline-none focus:border-brand-400 transition resize-none"
              />
            </div>
          )}

          <p className="text-[12px] leading-[1.5] text-slate-600 dark:text-slate-300 text-pretty rounded-[10px] bg-slate-50 dark:bg-white/[0.03] px-3 py-2.5">
            {preview}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3.5 border-t border-slate-100 dark:border-white/[0.06]">
          <button
            type="button"
            onClick={() => onClose && onClose()}
            disabled={submitting}
            className="h-[38px] px-4 rounded-[10px] text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white transition disabled:opacity-50"
          >Voltar</button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className={cn(
              'inline-flex items-center gap-2 h-[38px] px-4 rounded-[10px] text-white text-[13px] font-semibold whitespace-nowrap transition disabled:opacity-50',
              tone.btn
            )}
          >
            <Icon size={14} />
            {submitting ? cfg.saving : cfg.confirm}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { ContractOutcomeModal };
