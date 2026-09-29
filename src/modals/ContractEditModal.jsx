import { useMemo, useState } from 'react';
import { Calendar, DollarSign, Pencil } from 'lucide-react';
import { buildContractEdit, correctionNeedsReason, editListValueOf, renewalStartProblem } from '../lib/contracts.js';
import { commitContractPatch } from '../lib/contractsWrites.js';
import { fromDateInputValue, getSafeDateOrNull, toDateInputValue } from '../lib/dates.js';
import { fmtBRL, parseValorBRL, valorToInput } from '../lib/format.js';
import { DISCOUNT_REASONS } from '../lib/renewal.js';
import { cn } from '../lib/utils.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { Field, StyledInput, StyledSelect } from '../components/ui/Field.jsx';
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog.jsx';

// Correção de um contrato já gravado. Existe porque errar o valor ou a data
// era irreversível: a única saída era cancelar e refazer, o que sujava a
// corrente do histórico e contava uma renovação a mais.
//
// NÃO é renovação nem matrícula: não cria contrato, não mexe nos marcos de
// renovação e não recarimba a conversão. Só conserta o registro. O desconto é
// recalculado junto, e valor abaixo da tabela pede o motivo, como na matrícula.

function ContractEditModal({ lead, appUser, db, contract, onClose, onDone }) {
  const toast = useToast();
  const { planos, contratos } = useGeneralConfig();
  // O contrato que esta renovação renova: corrigir o início pode mudar o fim
  // dele (buildContractEdit).
  const previous = contract?.renewedFromId
    ? (contratos || []).find(c => c.id === contract.renewedFromId) || null
    : null;

  // O plano do contrato pode ter saído do catálogo: ele continua na lista
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
  const [reason, setReason] = useState(contract?.discountReason || null);
  const [submitting, setSubmitting] = useState(false);

  const plan = options.find(p => p.id === planId) || null;
  const startsAt = fromDateInputValue(startStr);
  const numericValue = parseValorBRL(value);
  // A tabela que vale na correção (editListValueOf): a do contrato quando o
  // plano não muda. Valor abaixo dela é desconto e pede motivo.
  const listValue = plan ? editListValueOf(contract, plan) : 0;
  const hasDiscount = listValue > 0 && Number.isFinite(numericValue) && listValue - numericValue > 0.005;
  const discountReason = hasDiscount ? reason : null;
  const needsReason = correctionNeedsReason({ contract, plan, value: numericValue, hasDiscount });

  // A renovação começa no mínimo dois dias depois do início do contrato que ela
  // renova. Sem o status: a trava do trancado é para renovar, não para corrigir.
  const startProblem = previous && startsAt
    ? renewalStartProblem({ startsAt: previous.startsAt || previous.createdAt }, startsAt)
    : null;
  const preview = plan && startsAt
    ? buildContractEdit({ contract, plan, value: numericValue, startsAt, discountReason, previous })
    : null;
  const novoFim = getSafeDateOrNull(preview?.contractPatch?.endsAt);
  const fimAtual = getSafeDateOrNull(contract?.endsAt);
  const pausedDaysTotal = Number(contract?.pausedDaysTotal) || 0;
  // O que a correção faz com o fim do contrato anterior: encurta (a marca de
  // quem encurtou fica) ou devolve o fim original (a marca sai).
  const anteriorFim = getSafeDateOrNull(preview?.previousPatch?.endsAt);
  const anteriorVolta = Boolean(anteriorFim && !preview.previousPatch.shortenedById);

  const onChangePlan = (id) => {
    setPlanId(id);
    const p = options.find(x => x.id === id);
    if (!p) return;
    // Voltar ao plano do contrato devolve o valor gravado: o preço de hoje do
    // catálogo pode ter sido reajustado depois da venda.
    setValue(valorToInput(id === contract?.planId ? contract?.value : p.value));
  };

  const handleClose = (open) => { if (!open && !submitting) onClose && onClose(); };

  const handleConfirm = async () => {
    if (!plan) { toast.warning('Selecione um plano.'); return; }
    if (!startsAt) { toast.warning('Informe a data de início.'); return; }
    if (!Number.isFinite(numericValue) || numericValue < 0) { toast.warning('Informe um valor válido.'); return; }
    if (needsReason && !reason) { toast.warning('Escolha o motivo do desconto.'); return; }
    if (startProblem) { toast.warning(startProblem); return; }

    setSubmitting(true);
    try {
      const built = buildContractEdit({ contract, plan, value: numericValue, startsAt, discountReason, previous });
      // O fim novo do contrato anterior vai no mesmo batch.
      await commitContractPatch({
        db,
        lead,
        appUser,
        contractId: contract?.id || lead?.currentContractId,
        contractPatch: built.contractPatch,
        leadPatch: built.leadPatch,
        interactionText: built.interactionText,
        previousContractId: built.previousPatch ? previous.id : null,
        previousContractPatch: built.previousPatch || null
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
            <Field label="Valor (R$)" hint={plan && listValue !== numericValue ? `${plan.id === contract?.planId && listValue !== Number(plan.value) ? 'Tabela na venda' : 'Tabela'}: ${fmtBRL(listValue)}` : undefined}>
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

          {hasDiscount && (
            <Field label="Motivo do desconto">
              <div className="flex flex-wrap gap-1.5">
                {DISCOUNT_REASONS.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={cn(
                      'h-[29px] px-[11px] rounded-lg border-[1.5px] text-[12px] font-semibold whitespace-nowrap transition',
                      r === reason
                        ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/15 dark:text-brand-300'
                        : 'border-border bg-card text-slate-600 dark:text-slate-300 hover:border-brand-200 dark:hover:border-brand-500/45'
                    )}
                  >{r}</button>
                ))}
              </div>
            </Field>
          )}

          {startProblem && (
            <p className="rounded-[10px] border border-rose-300/60 bg-rose-500/[0.07] dark:border-rose-500/40 dark:bg-rose-500/10 px-3 py-2.5 text-[12px] font-semibold text-rose-700 dark:text-rose-300 text-pretty">
              {startProblem}
            </p>
          )}

          <div className="rounded-[10px] bg-slate-50 dark:bg-white/[0.03] px-3 py-2.5 text-[12px] leading-[1.5] text-slate-600 dark:text-slate-300 text-pretty">
            {novoFim ? (
              <>
                A vigência passa a terminar em <span className="num font-semibold text-slate-900 dark:text-white">{novoFim.toLocaleDateString('pt-BR')}</span>
                {fimAtual && novoFim.getTime() !== fimAtual.getTime() && (
                  <span className="num"> (era {fimAtual.toLocaleDateString('pt-BR')})</span>
                )}.
                {pausedDaysTotal > 0 && <> Os {pausedDaysTotal} dias já trancados seguem contados.</>}
                {anteriorFim && (
                  <>
                    {' '}O contrato anterior{previous?.planName ? ` (${previous.planName})` : ''} {anteriorVolta ? 'volta' : 'passa'} a terminar em <span className="num font-semibold text-slate-900 dark:text-white">{anteriorFim.toLocaleDateString('pt-BR')}</span>.
                  </>
                )}
                {' '}Isto corrige o registro. Não cria contrato novo nem mexe nos marcos de renovação.
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
