import { useMemo, useState } from 'react';
import { Calendar, DollarSign, Pencil } from 'lucide-react';
import { buildContractEdit } from '../lib/contracts.js';
import { commitContractPatch } from '../lib/contractsWrites.js';
import { fromDateInputValue, getSafeDateOrNull, toDateInputValue } from '../lib/dates.js';
import { fmtBRL, parseValorBRL, valorToInput } from '../lib/format.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { Field, StyledInput, StyledSelect } from '../components/ui/Field.jsx';
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog.jsx';

// Correção de um contrato já gravado. Existe porque errar o valor ou a data
// era irreversível: a única saída era cancelar e refazer, o que sujava a
// corrente do histórico e contava uma renovação a mais.
//
// NÃO é renovação nem matrícula: não cria contrato, não mexe nos marcos de
// renovação e não recarimba a conversão. Só conserta o registro.

function ContractEditModal({ lead, appUser, db, contract, onClose, onDone }) {
  const toast = useToast();
  const { planos } = useGeneralConfig();

  // O plano do contrato pode ter saído do catálogo — ele continua na lista
  // para a correção não trocar o plano sem querer.
  const options = useMemo(() => {
    const ativos = (planos || [])
      .filter(p => p.active !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    if (contract?.planId && !ativos.some(p => p.id === contract.planId)) {
      return [...ativos, {
        id: contract.planId,
        name: `${contract.planName || 'Plano'} (fora do catálogo)`,
        value: contract.listValue || contract.value,
        durationMonths: contract.durationMonths
      }];
    }
    return ativos;
  }, [planos, contract]);

  const [planId, setPlanId] = useState(contract?.planId || options[0]?.id || '');
  const [value, setValue] = useState(valorToInput(contract?.value));
  const [startStr, setStartStr] = useState(toDateInputValue(getSafeDateOrNull(contract?.startsAt) || new Date()));
  const [submitting, setSubmitting] = useState(false);

  const plan = options.find(p => p.id === planId) || null;
  const startsAt = fromDateInputValue(startStr);
  const numericValue = parseValorBRL(value);

  const preview = plan && startsAt
    ? buildContractEdit({ contract, plan, value: numericValue, startsAt })
    : null;
  const novoFim = getSafeDateOrNull(preview?.contractPatch?.endsAt);
  const fimAtual = getSafeDateOrNull(contract?.endsAt);
  const pausedDaysTotal = Number(contract?.pausedDaysTotal) || 0;

  const onChangePlan = (id) => {
    setPlanId(id);
    const p = options.find(x => x.id === id);
    if (p) setValue(valorToInput(p.value));
  };

  const handleClose = (open) => { if (!open && !submitting) onClose && onClose(); };

  const handleConfirm = async () => {
    if (!plan) { toast.warning('Selecione um plano.'); return; }
    if (!startsAt) { toast.warning('Informe a data de início.'); return; }
    if (!Number.isFinite(numericValue) || numericValue < 0) { toast.warning('Informe um valor válido.'); return; }

    setSubmitting(true);
    try {
      const built = buildContractEdit({ contract, plan, value: numericValue, startsAt });
      await commitContractPatch({
        db,
        lead,
        appUser,
        contractId: contract?.id || lead?.currentContractId,
        contractPatch: built.contractPatch,
        leadPatch: built.leadPatch,
        interactionText: built.interactionText
      });
      toast.success('Contrato corrigido.');
      onDone && onDone();
    } catch (e) {
      console.error('Erro ao corrigir contrato:', e);
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
          <span className="size-10 flex-none rounded-xl grid place-items-center bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
            <Pencil size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="font-display text-[18px] font-bold tracking-tight">Corrigir contrato</DialogTitle>
            <div className="num text-[12.5px] text-slate-500 dark:text-slate-400 mt-1 truncate">
              {lead?.name || 'Cliente'} · #{String(contract?.id || lead?.currentContractId || '').slice(0, 8).toUpperCase()}
            </div>
          </div>
        </div>

        <div className="px-6 py-5 flex flex-col gap-3.5">
          <Field label="Plano">
            <StyledSelect value={planId} onChange={e => onChangePlan(e.target.value)}>
              {options.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} · {fmtBRL(p.value)} · {Number(p.durationMonths) || 0}m
                </option>
              ))}
            </StyledSelect>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$)" hint={plan && Number(plan.value) !== numericValue ? `Tabela: ${fmtBRL(plan.value)}` : undefined}>
              <StyledInput
                type="text"
                inputMode="decimal"
                icon={<DollarSign size={14} />}
                value={value}
                onChange={e => setValue(e.target.value)}
              />
            </Field>
            <Field label="Início">
              <StyledInput
                type="date"
                icon={<Calendar size={14} />}
                value={startStr}
                onChange={e => setStartStr(e.target.value)}
              />
            </Field>
          </div>

          <div className="rounded-[10px] bg-slate-50 dark:bg-white/[0.03] px-3 py-2.5 text-[12px] leading-[1.5] text-slate-600 dark:text-slate-300 text-pretty">
            {novoFim ? (
              <>
                A vigência passa a terminar em <span className="num font-semibold text-slate-900 dark:text-white">{novoFim.toLocaleDateString('pt-BR')}</span>
                {fimAtual && novoFim.getTime() !== fimAtual.getTime() && (
                  <span className="num"> (era {fimAtual.toLocaleDateString('pt-BR')})</span>
                )}.
                {pausedDaysTotal > 0 && <> Os {pausedDaysTotal} dias já trancados seguem contados.</>}
                {' '}Isto corrige o registro — não cria contrato novo nem mexe nos marcos de renovação.
              </>
            ) : 'Escolha plano e data de início para ver a nova vigência.'}
          </div>
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
            className="inline-flex items-center gap-2 h-[38px] px-4 rounded-[10px] bg-brand-600 hover:bg-brand-700 text-white text-[13px] font-semibold whitespace-nowrap transition disabled:opacity-50"
          >
            <Pencil size={14} />
            {submitting ? 'Salvando...' : 'Salvar correção'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { ContractEditModal };
