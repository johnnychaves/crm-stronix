import { useId, useState } from 'react';
import { Calendar, Check, CheckCircle2, X } from 'lucide-react';
import { getSafeDateOrNull } from '../lib/dates.js';
import { formatHourLabel } from '../lib/format.js';
import { logInteractions } from '../lib/interactions.js';
import { CONTRACT_CANCEL_REASONS } from '../lib/contracts.js';
import { renewalDecline, renewalReschedule } from '../lib/renewalGoal.js';
import { expiredLabel } from '../lib/expiredGoal.js';
import { DAILY_GOAL_CATEGORIES } from '../lib/leads.js';
import { whenFromPreset, whenInstant, whenProblem } from '../lib/whenPicker.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { ChoiceChips, MotivoField, NoteToggle, PopupButton, PopupLabel, PopupNote, PopupShell } from '../components/dailygoal/popup/PopupShell.jsx';
import { OutcomeCards } from '../components/dailygoal/popup/OutcomeCards.jsx';
import { WhenPicker } from '../components/dailygoal/popup/WhenPicker.jsx';

// Pop-up de desfecho da Renovação e dos Vencidos da Meta Diária, na família de
// pop-ups da Meta (components/dailygoal/popup). Fino de propósito: a regra
// (patches e a entrada na Meta) vive em src/lib/renewalGoal.js. Nunca muda
// status nem lifecycleStage: não renovar não é perda de funil.
//
// onDone(outcome) — outcome ∈ 'renovou' | 'nao_renova' | 'reagendar'. No
// 'renovou' o pop-up não grava nada: fecha, e quem chamou abre o ContractModal
// em mode='renovacao', que já zera os campos de renovação.

const OUTCOMES = {
  RENOVOU: 'renovou',
  NAO_RENOVA: 'nao_renova',
  REAGENDAR: 'reagendar'
};

// Os dois funis de cliente usam o mesmo pop-up: os três desfechos são iguais,
// muda o vocabulário. 'renovacao' cobra antes de vencer; 'vencido' cobra
// depois (ver src/lib/expiredGoal.js).
const VARIANTS = {
  renovacao: {
    title: 'Renovação de contrato',
    question: 'Qual o desfecho desta renovação?',
    category: DAILY_GOAL_CATEGORIES.RENOVACAO,
    categoryLabel: 'Renovação',
    ends: 'vence',
    okLabel: 'Renovou',
    noLabel: 'Não vai renovar',
    okFooter: 'Renovar',
    okHint: 'Ao confirmar, abrimos o fluxo de nova matrícula com os dados do cliente.',
    noDoneText: '✅ Renovação — Meta Diária concluída (não vai renovar).',
    noToast: 'Perda de renovação registrada. O cliente continua ativo e só sai desta cobrança.'
  },
  vencido: {
    title: 'Contrato vencido',
    question: 'Qual o desfecho deste contrato vencido?',
    category: DAILY_GOAL_CATEGORIES.VENCIDO,
    categoryLabel: 'Contrato vencido',
    ends: 'venceu',
    okLabel: 'Reativou',
    noLabel: 'Não vai voltar',
    okFooter: 'Reativar',
    okHint: 'Ao confirmar, abrimos o fluxo de matrícula para reativar este cliente.',
    noDoneText: '✅ Contrato vencido — Meta Diária concluída (não vai voltar).',
    noToast: 'Registrado. Este cliente sai da cobrança de vencidos.'
  }
};

const REASONS = CONTRACT_CANCEL_REASONS.map((r) => ({ id: r, label: r }));

// initialOutcome: o desfecho que abre escolhido. O Reagendar do card abre com
// 'reagendar'; sem ele, abre em "Renovou" (ou "Reativou").
function RenewalOutcomeModal({ onClose, lead, appUser, db, activeCheckpoint, variant = 'renovacao', initialOutcome = null, onDone }) {
  const v = VARIANTS[variant] || VARIANTS.renovacao;
  const toast = useToast();
  const reasonsId = useId();
  // O instante da montagem: o render segue puro, e o envio confere de novo no
  // relógio, para nunca agendar um contato no passado.
  const [nowMs] = useState(() => Date.now());
  const [outcome, setOutcome] = useState(Object.values(OUTCOMES).includes(initialOutcome) ? initialOutcome : OUTCOMES.RENOVOU);
  // O motivo do reagendamento é obrigatório. O da perda sai de uma lista fixa
  // (o mesmo vocabulário do cancelamento de contrato), com observação à parte.
  const [motivo, setMotivo] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  // Amanhã às 09:00, o mesmo horário que o assistente de agendamento sugere.
  const [when, setWhen] = useState(() => whenFromPreset('amanha', '09:00', new Date(nowMs)));
  const [submitting, setSubmitting] = useState(false);

  const motivoTrimmed = motivo.trim();
  const endsAt = getSafeDateOrNull(lead?.currentContractEndsAt);
  const context = [lead?.currentPlanName || 'Sem plano', endsAt && `${v.ends} em ${endsAt.toLocaleDateString('pt-BR')}`].filter(Boolean).join(' · ');
  const chip = variant === 'vencido'
    ? (endsAt ? { text: expiredLabel(lead, new Date(nowMs)), muted: true } : null)
    : (activeCheckpoint != null ? { text: `Marco de ${activeCheckpoint} dias` } : null);

  const hint = outcome === OUTCOMES.NAO_RENOVA ? (reason ? '' : 'Escolha o motivo da perda.')
    : outcome !== OUTCOMES.REAGENDAR ? ''
      : whenProblem(when, nowMs, { fromTomorrow: true }) ? 'Escolha um dia a partir de amanhã.'
        : !motivoTrimmed ? 'Escreva o motivo do reagendamento.' : '';

  const cards = [
    { id: OUTCOMES.RENOVOU, label: v.okLabel, desc: 'Abre a nova matrícula com os dados dele.', Icon: Check, tone: 'ok' },
    { id: OUTCOMES.NAO_RENOVA, label: v.noLabel, desc: 'Continua cliente. Sai desta cobrança.', Icon: X, tone: 'no' },
    { id: OUTCOMES.REAGENDAR, label: 'Reagendar contato', desc: 'Volta à sua Meta em outra data.', Icon: Calendar, tone: 'later' }
  ];
  const footerLabel = { [OUTCOMES.RENOVOU]: v.okFooter, [OUTCOMES.NAO_RENOVA]: 'Registrar perda', [OUTCOMES.REAGENDAR]: 'Reagendar' };

  const handleConfirm = async () => {
    if (hint || submitting) return;
    const at = outcome === OUTCOMES.REAGENDAR ? whenInstant(when) : null;
    if (outcome === OUTCOMES.REAGENDAR && whenProblem(when, Date.now(), { fromTomorrow: true })) {
      toast.warning('Escolha um dia a partir de amanhã.');
      return;
    }

    if (outcome === OUTCOMES.RENOVOU) {
      // Não grava nada aqui: quem chamou abre o ContractModal (mode='renovacao'),
      // que grava o contrato e zera os campos de renovação num único batch.
      onDone && onDone(OUTCOMES.RENOVOU);
      return;
    }

    setSubmitting(true);
    try {
      if (outcome === OUTCOMES.NAO_RENOVA) {
        const patch = renewalDecline(lead, activeCheckpoint, { reason });
        const obs = note.trim();
        // A nota do motivo, a marca e o patch num batch só (logInteractions).
        await logInteractions(db, lead, appUser, [{
          text: `Motivo da perda de renovação: ${reason}.${obs ? ` ${obs}` : ''}`,
          type: 'note',
          renewalOutcome: 'declined',
          renewalDeclineReason: reason
        }, {
          text: v.noDoneText,
          type: 'daily_goal_done',
          dailyGoalCategory: v.category
        }], patch);
        toast.success(v.noToast);
      } else {
        // Reagendar: o marco atual conta como tratado e o contato vira um
        // próximo contato na data escolhida, que aparece em Contatos. Volta a
        // Renovações só no próximo marco (ver src/lib/renewalGoal.js).
        const patch = renewalReschedule(lead, at, activeCheckpoint);
        const dateFmt = `${at.toLocaleDateString('pt-BR')} às ${formatHourLabel(at)}`;
        await logInteractions(db, lead, appUser, [{
          text: `Motivo do reagendamento: ${motivoTrimmed} — próximo contato em ${dateFmt}.`,
          type: 'note'
        }, {
          text: `✅ ${v.categoryLabel} — Meta Diária concluída (contato reagendado para ${dateFmt}).`,
          type: 'daily_goal_done',
          dailyGoalCategory: v.category
        }], patch);
        toast.success(`Contato reagendado para ${dateFmt}. Agora aparece em Contatos.`);
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
    <PopupShell
      title={v.title}
      lead={lead}
      context={context}
      chip={chip}
      busy={submitting}
      onClose={onClose}
      hint={hint}
      actions={(
        <>
          <PopupButton kind="ghost" onClick={() => onClose && onClose()} disabled={submitting}>Cancelar</PopupButton>
          <PopupButton kind={outcome === OUTCOMES.NAO_RENOVA ? 'danger' : 'primary'} onClick={handleConfirm} disabled={Boolean(hint) || submitting}>
            {submitting ? 'Salvando...' : footerLabel[outcome]}
          </PopupButton>
        </>
      )}
    >
      <OutcomeCards question={v.question} options={cards} value={outcome} onChange={setOutcome} />
      {outcome === OUTCOMES.RENOVOU && <PopupNote tone="ok" icon={CheckCircle2}>{v.okHint}</PopupNote>}
      {outcome === OUTCOMES.NAO_RENOVA && (
        <>
          <div>
            <PopupLabel id={reasonsId}>Motivo da perda</PopupLabel>
            <ChoiceChips options={REASONS} value={reason} onChange={setReason} labelledBy={reasonsId} />
          </div>
          <NoteToggle placeholder="O que ele disse, se ajudar" value={note} onChange={setNote} />
          <PopupNote>Continua cliente. Não vai para a Perda do funil.</PopupNote>
        </>
      )}
      {outcome === OUTCOMES.REAGENDAR && (
        <>
          <WhenPicker value={when} onChange={setWhen} who="O contato" nowMs={nowMs} fromTomorrow />
          <MotivoField value={motivo} onChange={setMotivo} />
        </>
      )}
    </PopupShell>
  );
}

export { RenewalOutcomeModal };
