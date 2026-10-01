import { useState } from 'react';
import { Ban, PauseCircle, PlayCircle } from 'lucide-react';
import {
  CONTRACT_CANCEL_REASONS,
  CONTRACT_PAUSE_REASONS,
  CONTRACT_STATUS,
  buildContractCancel,
  buildContractPause,
  buildContractResume,
  buildRenewalCancel,
  isRenewalNotStarted
} from '../lib/contracts.js';
import { commitContractPatch } from '../lib/contractsWrites.js';
import { inUseReplacementOf } from '../lib/contractsTab.js';
import { calendarDaysBetween, daysBetween, fromDateInputValue, getSafeDateOrNull, toDateInputValue } from '../lib/dates.js';
import { cn } from '../lib/utils.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog.jsx';

// Desfechos do contrato VIGENTE, ou do contrato em uso quando há renovação
// marcada: cancelar, trancar e reativar. Os três têm a mesma forma — uma data,
// às vezes um motivo, e a consequência escrita antes de confirmar. O
// cancelamento era um window.confirm que gravava motivo null; o trancamento
// não existia.
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
    tone: 'yellow',
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
  // Só o ícone fica amarelo. O botão segue azul: texto branco em amarelo não tem contraste.
  yellow: { chip: 'bg-yellow-500/15 text-yellow-800 dark:text-yellow-300', btn: 'bg-brand-600 hover:bg-brand-700' },
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
  // A renovação desfeita que foi confirmada. Enquanto grava, a escrita local já
  // chega à ficha, que passa ao modal o contrato de volta: sem isto, o título e
  // a prévia virariam os do cancelamento comum até a janela fechar.
  const [sentUndo, setSentUndo] = useState(null);

  const when = fromDateInputValue(dateStr);
  const pausedAt = getSafeDateOrNull(contract?.pausedAt);
  const endsAt = getSafeDateOrNull(contract?.endsAt);

  // Cancelar uma renovação que ainda não começou desfaz a renovação: o cliente
  // volta ao contrato que ela renovava (buildRenewalCancel). A data decide: até
  // o dia do início, desfaz; depois dele, é o cancelamento comum.
  const { contratos } = useGeneralConfig();
  const previous = contract?.renewedFromId
    ? (contratos || []).find(c => c.id === contract.renewedFromId) || null
    : null;
  // Em que contrato o desfecho age. O último (currentContractId) grava o resumo
  // do lead como sempre; o contrato em uso, com renovação marcada, grava só o
  // bloco "em uso" (role 'inUse' dos construtores de contracts.js), e `next` é
  // a renovação marcada: o cancelamento tira dela a marca de emendada, e o
  // trancamento avisa que ela começa do mesmo jeito. O papel sai do contrato
  // recebido, nunca do resumo do lead.
  const isCurrent = !contract?.id || contract.id === lead?.currentContractId;
  const role = isCurrent ? 'current' : 'inUse';
  // O último contrato cancelado não é renovação marcada: o em uso é desfeito
  // sem aviso de renovação e sem patch ligado (revisão final de 01/10/2026).
  const latest = isCurrent ? null : (contratos || []).find(c => c.id === lead?.currentContractId) || null;
  const next = latest && latest.status !== CONTRACT_STATUS.CANCELADO ? latest : null;
  const nextStart = getSafeDateOrNull(next?.startsAt);
  const renovacao = next?.planName ? `A renovação (Plano ${next.planName})` : 'A renovação';
  // Só o último contrato desfaz renovação: o contrato em uso que é ele mesmo
  // uma renovação, com a data no início dele, é cancelamento comum.
  const undo = sentUndo || (isCurrent && action === 'cancelar' && when && isRenewalNotStarted(contract, previous, when)
    ? buildRenewalCancel({ contract, previous, cancelledAt: when, reason, note: note.trim() || null })
    : null);
  const primeiro = (lead?.name || '').trim().split(/\s+/)[0] || 'o cliente';
  // Decisão do Johnny (01/10/2026): com dois contratos ativos, cancelar um
  // deixa o cliente ativo pelo outro. Cancelando o último contrato (fora o
  // desfazer da renovação), o contrato que continua é o em uso de início
  // mais recente entre os da pessoa (inUseReplacementOf), e o resumo do lead
  // passa para ele (buildContractCancel com `replacement`). Trancar não
  // passa: o Reativar mora no card do contrato trancado.
  const replacement = isCurrent && action === 'cancelar' && !undo
    ? inUseReplacementOf({
      contracts: (contratos || []).filter((c) => c?.leadId === lead?.id),
      excludeId: contract?.id || lead?.currentContractId || null,
      now: new Date()
    })
    : null;

  // Prévia da reativação: quantos dias pararam e para onde o término anda.
  const pausedDays = action === 'reativar' && pausedAt && when
    ? Math.max(0, daysBetween(pausedAt, when) || 0)
    : 0;

  const preview = (() => {
    if (undo) {
      // O contrato renovado pode já ter vencido, quando a renovação começaria
      // depois de um intervalo. O último dia ainda é dele.
      // Contrato importado pode vir sem nome de plano: a frase sai sem ele.
      const plano = String(undo.leadPatch.currentPlanName || '').trim();
      const fim = undo.leadPatch.currentContractEndsAt;
      if (fim && calendarDaysBetween(undo.contractPatch.cancelledAt, fim) < 0) {
        return `A renovação é desfeita e ${primeiro} volta ao contrato anterior${plano ? ` (${plano})` : ''}, que venceu em ${fmtDate(fim)}.`;
      }
      const detalhe = [plano, fim ? `até ${fmtDate(fim)}` : ''].filter(Boolean).join(', ');
      return `A renovação é desfeita e ${primeiro} volta ao contrato em uso${detalhe ? ` (${detalhe})` : ''}.`;
    }
    if (action === 'reativar') {
      const novo = buildContractResume({ contract, resumedAt: when || new Date(), role });
      const base = pausedDays > 0
        ? `${pausedDays} ${pausedDays === 1 ? 'dia parado' : 'dias parados'}: o término vai de ${fmtDate(endsAt)} para ${fmtDate(novo.newEndsAt)}.`
        : 'Nenhum dia parado: a vigência segue igual.';
      // O fim novo passa do início da renovação: os dois valem juntos nesse trecho.
      const cruza = nextStart && novo.newEndsAt && novo.newEndsAt.getTime() >= nextStart.getTime();
      return cruza ? `${base} ${renovacao} começa em ${fmtDate(nextStart)} do mesmo jeito, e os dois contratos valem juntos até ${fmtDate(novo.newEndsAt)}.` : base;
    }
    if (action === 'trancar') {
      const base = 'A vigência congela nesta data. Quando reativar, o término anda para frente pelos dias parados, e o cliente não perde o que pagou.';
      // Ainda trancado no dia em que a renovação começa, os dias que sobram
      // correm junto com ela (decisão do Johnny, 30/09/2026).
      return nextStart
        ? `${base} ${renovacao} continua marcada para ${fmtDate(nextStart)}. Se o contrato ainda estiver trancado nesse dia, os dias que sobram dele correm junto com ela.`
        : base;
    }
    if (nextStart) {
      return `O contrato é encerrado${when ? ` em ${fmtDate(when)}` : ''}. ${renovacao} continua marcada para ${fmtDate(nextStart)}, e até lá ${primeiro} fica sem contrato.`;
    }
    if (replacement) {
      // O cliente continua pelo contrato em uso: ativo até o fim dele, ou
      // trancado, sem data, porque o fim do trancado ainda anda.
      const plano = replacement.planName ? `o contrato Plano ${replacement.planName}` : 'o outro contrato';
      const fim = getSafeDateOrNull(replacement.endsAt);
      const continua = replacement.status === CONTRACT_STATUS.TRANCADO
        ? `O cliente continua com ${plano}, que está trancado.`
        : `O cliente continua ativo ${replacement.planName ? `pelo contrato Plano ${replacement.planName}` : 'pelo outro contrato'}${fim ? `, que vale até ${fmtDate(fim)}` : ''}.`;
      return `O contrato é encerrado${when ? ` em ${fmtDate(when)}` : ''}. ${continua}`;
    }
    return `O contrato é encerrado${when ? ` em ${fmtDate(when)}` : ''} e ${primeiro} passa a contar como inativo. O histórico fica registrado.`;
  })();

  const handleClose = (open) => { if (!open && !submitting) onClose && onClose(); };

  const handleConfirm = async () => {
    if (!when) { toast.warning('Informe a data.'); return; }
    if (cfg.reasons && !reason) { toast.warning('Escolha o motivo.'); return; }

    setSubmitting(true);
    if (undo) setSentUndo(undo);
    try {
      const planName = contract?.planName || lead?.currentPlanName;
      const built = undo || (action === 'cancelar'
        ? buildContractCancel({ planName, cancelledAt: when, reason, note: note.trim() || null, role, contract, next, replacement })
        : action === 'trancar'
          ? buildContractPause({ planName, pausedAt: when, reason, role, contract })
          : buildContractResume({ contract, resumedAt: when, role }));

      // O contrato gravado é o recebido; só sem ele vale o último do resumo. O
      // contrato ligado do batch: desfeita a renovação que encurtou o contrato
      // renovado, o fim de antes volta a ele; cancelado o contrato em uso, a
      // renovação marcada perde a marca de emendada (nextPatch).
      await commitContractPatch({
        db,
        lead,
        appUser,
        contractId: contract ? contract.id : lead?.currentContractId,
        contractPatch: built.contractPatch,
        leadPatch: built.leadPatch,
        interactionText: built.interactionText,
        linkedContractId: undo?.previousPatch ? previous.id : (built.nextPatch ? next.id : null),
        linkedContractPatch: undo?.previousPatch || built.nextPatch || null
      });

      toast.success(
        undo ? 'Renovação cancelada.'
          : action === 'cancelar' ? 'Contrato cancelado.'
            : action === 'trancar' ? 'Contrato trancado.'
              : 'Contrato reativado.'
      );
      onDone && onDone();
    } catch (e) {
      console.error('Erro no desfecho do contrato:', e);
      toast.error('Não foi possível salvar. Tente novamente.');
      setSentUndo(null);
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
            <DialogTitle className="font-display text-[18px] font-bold tracking-tight">{undo ? 'Cancelar renovação' : cfg.title}</DialogTitle>
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
            {submitting ? cfg.saving : undo ? 'Cancelar renovação' : cfg.confirm}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { ContractOutcomeModal };
