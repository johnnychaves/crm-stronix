import { useMemo, useState } from 'react';
import { collection, doc, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { appId, LEADS_PATH, INTERACTIONS_PATH, CONTRACTS_PATH } from '../lib/firebase.js';
import { getInteractionSecurityFields } from '../lib/leads.js';
import { buildMatriculaWrites, computeEndsAt } from '../lib/contracts.js';
import { withBucket } from '../lib/leadDerived.js';
import { fromDateInputValue, toDateInputValue } from '../lib/dates.js';
import { fmtBRL } from '../lib/format.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { Field, StyledInput, StyledSelect } from '../components/ui/Field.jsx';
import { Btn } from '../components/ui/Btn.jsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '../components/ui/dialog.jsx';
import { Calendar, Clock, DollarSign, GraduationCap, Layers, RefreshCw } from 'lucide-react';

// Modal de matrícula/renovação. Substitui o antigo window.confirm("Confirmar
// matrícula?"): captura o PLANO (catálogo), o VALOR (editável p/ desconto) e a
// DATA DE INÍCIO, mostra a vigência computada e grava — num único writeBatch —
// o contrato (stronix_contratos), o resumo no lead e o evento na timeline.
// A regra do que gravar vive em lib/contracts.js (buildMatriculaWrites), para
// os dois caminhos de conversão (ficha + Kanban) e a renovação compartilharem.
function MatriculaModal({ lead, appUser, db, onClose, onDone, mode = 'matricula', renewedFromId = null }) {
  const toast = useToast();
  const { planos } = useGeneralConfig();
  const isRenewal = mode === 'renovacao';

  // Só planos ATIVOS entram no seletor; inativos seguem no histórico de
  // contratos mas não em novas matrículas/renovações.
  const activePlans = useMemo(
    () => (planos || [])
      .filter(p => p.active !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0)),
    [planos]
  );

  const [planId, setPlanId] = useState(activePlans[0]?.id || '');
  const [value, setValue] = useState(activePlans[0] ? String(activePlans[0].value ?? '') : '');
  const [startStr, setStartStr] = useState(toDateInputValue(new Date()));
  const [submitting, setSubmitting] = useState(false);

  const selectedPlan = activePlans.find(p => p.id === planId) || null;

  // Trocar de plano repõe o valor sugerido (o consultor ainda pode editar).
  const onChangePlan = (id) => {
    setPlanId(id);
    const p = activePlans.find(x => x.id === id);
    if (p) setValue(String(p.value ?? ''));
  };

  const startsAt = fromDateInputValue(startStr);
  const endsAt = selectedPlan ? computeEndsAt(startsAt, selectedPlan.durationMonths) : null;
  const numericValue = Number(value);
  const listValue = Number(selectedPlan?.value) || 0;
  const hasDiscount = selectedPlan && Number.isFinite(numericValue) && numericValue < listValue;

  const handleClose = (open) => { if (!open && !submitting) onClose && onClose(); };

  const handleConfirm = async () => {
    if (!selectedPlan) { toast.warning('Selecione um plano.'); return; }
    if (!startsAt) { toast.warning('Informe a data de início.'); return; }
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      toast.warning('Informe um valor válido.');
      return;
    }

    setSubmitting(true);
    try {
      const {
        contract,
        leadPatch,
        interactionText,
        stampConvertedAt,
        setStatusVenda,
        stampClienteSince
      } = buildMatriculaWrites({
        lead,
        plan: selectedPlan,
        value: numericValue,
        startsAt,
        appUser,
        mode,
        renewedFromId
      });

      const batch = writeBatch(db);

      // (1) Contrato — id gerado client-side para já referenciá-lo no lead.
      const contractRef = doc(collection(db, 'artifacts', appId, 'public', 'data', CONTRACTS_PATH));
      batch.set(contractRef, { ...contract, createdAt: serverTimestamp() });

      // (2) Resumo denormalizado no lead. Os campos que dependem do SDK
      //     (serverTimestamp / status de venda) são injetados aqui conforme
      //     os sinais retornados por buildMatriculaWrites.
      const leadRef = doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id);
      const leadUpdate = {
        ...leadPatch,
        currentContractId: contractRef.id,
        lastInteractionAt: serverTimestamp(),
        interactionsCount: increment(1)
      };
      if (setStatusVenda) {
        leadUpdate.status = 'Venda';
        leadUpdate.isConverted = true;
        leadUpdate.lossReason = null;
        leadUpdate.lostAt = null;
        leadUpdate.nextFollowUp = null;
      }
      if (stampConvertedAt) leadUpdate.convertedAt = serverTimestamp();
      if (stampClienteSince) leadUpdate.clienteSince = serverTimestamp();
      // lifecycleBucket derivado do estado RESULTANTE (o patch muda
      // lifecycleStage/status/isConverted) — sempre 'cliente' aqui.
      batch.set(leadRef, withBucket(leadUpdate, lead), { merge: true });

      // (3) Timeline — mantém o histórico e (na matrícula) o auto-fechar da Meta.
      const interactionRef = doc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH));
      batch.set(interactionRef, {
        leadId: lead.id,
        consultantName: appUser?.name || null,
        ...getInteractionSecurityFields(lead, appUser),
        actorId: appUser?.id || null,
        actorAuthUid: appUser?.authUid || null,
        text: interactionText,
        type: 'status_change',
        createdAt: serverTimestamp()
      });

      await batch.commit();
      toast.success(isRenewal ? 'Renovação registrada!' : 'Matrícula realizada!');
      onDone && onDone();
    } catch (e) {
      console.error('Erro ao registrar matrícula:', e);
      toast.error('Não foi possível salvar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const Icon = isRenewal ? RefreshCw : GraduationCap;
  const noPlans = activePlans.length === 0;

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent className="z-[210] max-w-md" overlayClassName="z-[210]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg grid place-items-center bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 shrink-0">
              <Icon size={16} />
            </span>
            {isRenewal ? 'Renovar contrato' : 'Matricular cliente'}
          </DialogTitle>
          <DialogDescription>
            {lead?.name ? <span className="font-medium text-foreground">{lead.name}</span> : null}
            {isRenewal ? ' — registre a nova vigência.' : ' — registre o plano e a vigência do contrato.'}
          </DialogDescription>
        </DialogHeader>

        {noPlans ? (
          <div className="rounded-lg border border-amber-300/60 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10 px-4 py-5 text-[13px] text-amber-800 dark:text-amber-200">
            Nenhum plano ativo no catálogo. Peça a um administrador para cadastrar
            os planos em <span className="font-semibold">Configurações → Catálogos → Planos</span>.
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Plano">
              <StyledSelect value={planId} onChange={e => onChangePlan(e.target.value)}>
                {activePlans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {fmtBRL(p.value)} · {Number(p.durationMonths) || 0}m
                  </option>
                ))}
              </StyledSelect>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor (R$)" hint={hasDiscount ? `Tabela: ${fmtBRL(listValue)}` : undefined}>
                <StyledInput
                  type="number" min="0" step="1"
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

            <div className="rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-border px-4 py-3 text-[12.5px] text-slate-600 dark:text-slate-300 space-y-1">
              <div className="flex items-center gap-2">
                <Layers size={13} className="text-slate-400" />
                <span className="font-semibold text-foreground">{fmtBRL(numericValue || 0)}</span>
                {hasDiscount && (
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    desconto de {fmtBRL(listValue - numericValue)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-slate-400" />
                {startsAt && endsAt ? (
                  <span>
                    Vigência: <span className="font-medium text-foreground">{startsAt.toLocaleDateString('pt-BR')}</span>
                    {' → '}
                    <span className="font-medium text-foreground">{endsAt.toLocaleDateString('pt-BR')}</span>
                    {` · ${Number(selectedPlan?.durationMonths) || 0} ${(Number(selectedPlan?.durationMonths) || 0) === 1 ? 'mês' : 'meses'}`}
                  </span>
                ) : (
                  <span className="text-slate-400">Selecione plano e data para ver a vigência.</span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <Btn kind="soft" size="md" onClick={() => onClose && onClose()} disabled={submitting}>Cancelar</Btn>
          <Btn
            kind="success"
            size="md"
            icon={<Icon size={14} />}
            onClick={handleConfirm}
            disabled={submitting || noPlans}
          >
            {submitting ? 'Salvando...' : isRenewal ? 'Confirmar renovação' : 'Confirmar matrícula'}
          </Btn>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { MatriculaModal };
