import { useState } from 'react';
import { Calendar, Check } from 'lucide-react';
import { getSafeDateOrNull } from '../lib/dates.js';
import { logInteraction, logInteractions } from '../lib/interactions.js';
import { formatHourLabel } from '../lib/format.js';
import { contactDone, contactReschedule, followUpChannelOf } from '../lib/contactGoal.js';
import { DAILY_GOAL_CATEGORIES, DAILY_GOAL_CATEGORY_LABEL, goalOwnerFields } from '../lib/leads.js';
import { overdueDaysOf } from '../lib/dailyGoal.js';
import { dayRefText, whenFromPreset, whenInstant, whenIsFuture } from '../lib/whenPicker.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { MotivoField, PopupButton, PopupShell } from '../components/dailygoal/popup/PopupShell.jsx';
import { OutcomeCards } from '../components/dailygoal/popup/OutcomeCards.jsx';
import { WhenPicker } from '../components/dailygoal/popup/WhenPicker.jsx';

// Pop-up de desfecho da tarefa de contato da Meta Diária (contato de hoje,
// Atrasado e o Reagendar do Novo lead), na família de pop-ups da Meta
// (components/dailygoal/popup). Fino: a regra (patches) vive em
// src/lib/contactGoal.js, e aqui só se monta a tela e se grava. Nunca toca
// status nem funil.
//
// onDone(outcome) — outcome ∈ 'feito' | 'reagendar'.

const OUTCOMES = {
  FEITO: 'feito',
  REAGENDAR: 'reagendar'
};

const CARDS = [
  { id: OUTCOMES.FEITO, label: 'Contato feito', desc: 'Conclui a tarefa, sem novo contato.', Icon: Check, tone: 'ok' },
  { id: OUTCOMES.REAGENDAR, label: 'Reagendar', desc: 'Volta à sua Meta em outra data.', Icon: Calendar, tone: 'later' }
];

const FOOTER_LABEL = {
  [OUTCOMES.FEITO]: 'Concluir',
  [OUTCOMES.REAGENDAR]: 'Reagendar'
};

// A linha de contexto sob o nome: o atraso, a hora do contato de hoje ou o
// cadastro do lead novo.
function contextOf(lead, categorySlug, now) {
  if (categorySlug === DAILY_GOAL_CATEGORIES.ATRASADO) {
    if (!lead?.nextFollowUp) return 'Sem próximo passo desde o cadastro';
    const days = overdueDaysOf(lead, now);
    return `Atrasado, ${days} ${days === 1 ? 'dia' : 'dias'}`;
  }
  if (categorySlug === DAILY_GOAL_CATEGORIES.NOVO_24H) {
    const created = getSafeDateOrNull(lead?.createdAt);
    return created ? `Lead novo, cadastrado ${dayRefText(created, now)}` : 'Lead novo';
  }
  const next = getSafeDateOrNull(lead?.nextFollowUp);
  return next ? `${followUpChannelOf(lead).type} marcada para ${dayRefText(next, now)}` : DAILY_GOAL_CATEGORY_LABEL[categorySlug] || 'Contato';
}

// initialOutcome: o desfecho que abre escolhido. O Reagendar do card abre com
// 'reagendar'; sem ele, abre em "Contato feito".
function ContactOutcomeModal({ onClose, lead, categorySlug = DAILY_GOAL_CATEGORIES.CONTATO_HOJE, initialOutcome = null, appUser, db, onDone }) {
  const toast = useToast();
  // O instante da montagem: o render segue puro, e o envio confere de novo no
  // relógio, para nunca agendar um contato no passado. Marcar para hoje mais
  // tarde é caso real (mensagem sem resposta de manhã) e não joga o lead em
  // Atrasados: a Meta classifica o atraso por dia (dailyGoal.js).
  const [nowMs] = useState(() => Date.now());
  const [outcome, setOutcome] = useState(Object.values(OUTCOMES).includes(initialOutcome) ? initialOutcome : OUTCOMES.FEITO);
  const [motivo, setMotivo] = useState('');
  // Amanhã às 09:00, o mesmo horário que o assistente de agendamento sugere.
  const [when, setWhen] = useState(() => whenFromPreset('amanha', '09:00', new Date(nowMs)));
  const [submitting, setSubmitting] = useState(false);

  const motivoTrimmed = motivo.trim();
  const categoryLabel = DAILY_GOAL_CATEGORY_LABEL[categorySlug] || 'Contato';
  const reagendar = outcome === OUTCOMES.REAGENDAR;
  const hint = !reagendar ? ''
    : !whenIsFuture(when, nowMs) ? 'Escolha um dia e horário futuros.'
      : !motivoTrimmed ? 'Escreva o motivo do reagendamento.' : '';

  const handleConfirm = async () => {
    if (hint || submitting) return;
    const at = reagendar ? whenInstant(when) : null;
    if (reagendar && !(at && at.getTime() > Date.now())) {
      toast.warning('Escolha uma data e hora futuras.');
      return;
    }
    setSubmitting(true);
    try {
      if (!reagendar) {
        // Conclui e limpa o próximo contato num único write (o patch junto da
        // marca). A marca guarda quem tem o contato agora (goalOwnerFields),
        // que pode ser o colega que o recebeu, e o crédito fica com essa pessoa
        // mesmo depois que o próximo contato é limpo ou passa para outra.
        await logInteraction(db, lead, appUser, {
          text: `✅ ${categoryLabel} — Meta Diária concluída (contato feito).`,
          type: 'daily_goal_done',
          dailyGoalCategory: categorySlug,
          ...goalOwnerFields(lead, categorySlug)
        }, contactDone());
        toast.success('Contato concluído.');
      } else {
        // Agenda o próximo toque preservando o canal, conta como reaquecimento
        // (volumeKind) e registra o motivo.
        const patch = contactReschedule(lead, at);
        const { volumeKind } = followUpChannelOf(lead);
        const dateFmt = `${at.toLocaleDateString('pt-BR')} às ${formatHourLabel(at)}`;
        // A nota do motivo, a marca e o patch num batch só (logInteractions).
        await logInteractions(db, lead, appUser, [{
          text: `Motivo do reagendamento: ${motivoTrimmed} — próximo contato em ${dateFmt}.`,
          type: 'note'
        }, {
          text: `✅ ${categoryLabel} — Meta Diária concluída (contato reagendado para ${dateFmt}).`,
          type: 'daily_goal_done',
          dailyGoalCategory: categorySlug,
          ...goalOwnerFields(lead, categorySlug),
          volumeKind,
          rescheduledFor: at
        }], patch);
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
    <PopupShell
      title="Concluir contato"
      lead={lead}
      context={contextOf(lead, categorySlug, new Date(nowMs))}
      busy={submitting}
      onClose={onClose}
      hint={hint}
      actions={(
        <>
          <PopupButton kind="ghost" onClick={() => onClose && onClose()} disabled={submitting}>Cancelar</PopupButton>
          <PopupButton onClick={handleConfirm} disabled={Boolean(hint) || submitting}>
            {submitting ? 'Salvando...' : FOOTER_LABEL[outcome]}
          </PopupButton>
        </>
      )}
    >
      <OutcomeCards question="O contato foi feito?" options={CARDS} value={outcome} onChange={setOutcome} />
      {reagendar && (
        <>
          <WhenPicker value={when} onChange={setWhen} who="O contato" nowMs={nowMs} />
          <MotivoField value={motivo} onChange={setMotivo} />
        </>
      )}
    </PopupShell>
  );
}

export { ContactOutcomeModal };
