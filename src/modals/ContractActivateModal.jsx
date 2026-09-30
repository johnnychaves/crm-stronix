import { useState } from 'react';
import { Play } from 'lucide-react';
import { buildContractActivate } from '../lib/contracts.js';
import { commitContractPatch } from '../lib/contractsWrites.js';
import { getSafeDateOrNull } from '../lib/dates.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog.jsx';

// Ativar agora: o contrato que ainda não começou passa a começar hoje, com a
// duração vendida (buildContractActivate). Com o contrato em uso em vigor, ele
// passa a terminar ontem, e o modal mostra a data nova dele e os dias que se
// perdem. Vale para renovação marcada e para matrícula agendada.
//
// O que gravar vive em lib/contracts.js; o como, em lib/contractsWrites.js.
// Segue o molde do ContractEditModal: o contrato renovado sai da coleção
// assinada (contratos), e o que a tela mostra congela ao confirmar (`sent`),
// porque a escrita local chega à ficha antes de o servidor responder e o
// contrato passaria a "já começou" ao lado de "Ativando...".
// Mockup: docs/superpowers/specs/mockups/2026-09-30-aba-contratos-em-uso.html

const fmtDate = (d) => (d ? d.toLocaleDateString('pt-BR') : '—');

function ContractActivateModal({ lead, appUser, db, contract, onClose, onDone }) {
  const toast = useToast();
  const { contratos } = useGeneralConfig();
  const previous = contract?.renewedFromId
    ? (contratos || []).find((c) => c.id === contract.renewedFromId) || null
    : null;
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(null);
  const built = sent || buildContractActivate({ contract, previous, now: new Date() });
  const inicio = getSafeDateOrNull(built.contractPatch.startsAt);
  const fim = getSafeDateOrNull(built.contractPatch.endsAt);
  const anteriorFim = getSafeDateOrNull(built.previousPatch?.endsAt);
  const encurta = Boolean(anteriorFim && built.previousPatch?.shortenedById);
  const plano = contract?.planName || 'Plano';
  const planoAnterior = previous?.planName || 'O contrato em uso';

  const handleClose = (open) => { if (!open && !submitting) onClose && onClose(); };

  const handleConfirm = async () => {
    setSubmitting(true);
    setSent(built);
    try {
      // O fim novo do contrato em uso vai no mesmo batch.
      await commitContractPatch({
        db,
        lead,
        appUser,
        contractId: contract.id,
        contractPatch: built.contractPatch,
        leadPatch: built.leadPatch,
        interactionText: built.interactionText,
        linkedContractId: built.previousPatch ? previous.id : null,
        linkedContractPatch: built.previousPatch || null
      });
      toast.success('Contrato ativado.');
      onDone && onDone();
    } catch (e) {
      console.error('Erro ao ativar o contrato:', e);
      toast.error('Não foi possível salvar. Tente novamente.');
      setSent(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent
        overlayClassName="z-[210]"
        className="z-[210] max-w-[460px] gap-0 p-0 block overflow-hidden rounded-2xl border-border"
      >
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="size-9 flex-none rounded-xl grid place-items-center bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
              <Play size={16} />
            </span>
            <DialogTitle className="font-display text-[18px] font-bold tracking-tight">Ativar agora</DialogTitle>
          </div>
          <p className="num text-[12.5px] text-slate-500 dark:text-slate-400 mt-1.5 truncate">
            {lead?.name || 'Cliente'} · {plano} · marcado para {fmtDate(built.scheduledFor)}
          </p>

          <div className="mt-4 rounded-xl border border-slate-100 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03] divide-y divide-slate-100 dark:divide-white/[0.06]">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-[12.5px] text-slate-600 dark:text-slate-300">{plano} passa a valer</span>
              <span className="num text-[13px] font-semibold">{fmtDate(inicio)} → {fmtDate(fim)}</span>
            </div>
            {encurta && (
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-[12.5px] text-slate-600 dark:text-slate-300">{planoAnterior} termina em</span>
                <span className="num text-[13px] font-semibold">{fmtDate(anteriorFim)}</span>
              </div>
            )}
          </div>

          {encurta ? (
            <p className="mt-3 px-3 py-2.5 rounded-[11px] border border-rose-300/60 bg-rose-500/[0.07] dark:border-rose-500/40 dark:bg-rose-500/10 text-[12px] leading-[1.5] text-slate-600 dark:text-slate-300 text-pretty">
              O contrato em uso termina {built.daysLost} {built.daysLost === 1 ? 'dia' : 'dias'} antes do previsto, e os dias já pagos se perdem. O valor e a duração do plano novo não mudam.
            </p>
          ) : (
            <p className="mt-3 px-3 py-2.5 rounded-[11px] bg-slate-50 dark:bg-white/[0.03] text-[12px] leading-[1.5] text-slate-600 dark:text-slate-300 text-pretty">
              O valor e a duração do plano não mudam. Só o início vem para hoje, e o fim anda junto.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03]">
          <button
            type="button"
            onClick={() => onClose && onClose()}
            disabled={submitting}
            className="h-9 px-3.5 rounded-[10px] text-[13px] font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06] transition disabled:opacity-50"
          >Voltar</button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] text-[13px] font-semibold bg-brand-600 text-white hover:bg-brand-700 transition disabled:opacity-50"
          >
            <Play size={13} />
            {submitting ? 'Ativando...' : 'Ativar agora'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { ContractActivateModal };
