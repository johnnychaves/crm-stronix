import { useId, useState } from 'react';
import { BookOpen, Building2 } from 'lucide-react';
import { DAILY_GOAL_CATEGORIES } from '../lib/leads.js';
import { getSafeDateOrNull } from '../lib/dates.js';
import { dayRefText, hourOf, whenFromPreset, whenInstant, whenIsFuture } from '../lib/whenPicker.js';
import { SOLO_TRAINING, SOLO_TRAINING_LABEL, professorsForModality, professorNameById } from '../lib/professores.js';
import { cn } from '../lib/utils.js';
import { firstName } from '../lib/guardian.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { NoteToggle, PopupButton, PopupLabel, PopupShell } from '../components/dailygoal/popup/PopupShell.jsx';
import { WhenPicker } from '../components/dailygoal/popup/WhenPicker.jsx';
import { POPUP_FIELD } from '../components/dailygoal/popup/popupKit.js';
import { RadioGroup, RadioGroupOption } from '../components/ui/radio-group.jsx';

// Remarcar visita ou aula experimental, e o "Agendar próxima tentativa" que a
// Meta abre depois do Não compareceu (flow 'after_no_show'). Na família de
// pop-ups da Meta (components/dailygoal/popup). O que já vem do lead (tipo,
// modalidade, professor e aulas previstas) fica numa linha com "Alterar", e a
// observação atrás de "+ Adicionar observação". Quem grava é o handleReschedule
// da Meta, pelo onConfirm, com os mesmos argumentos de antes.

const TYPES = [
  { id: 'visita', label: 'Visita' },
  { id: 'aula_experimental', label: 'Aula experimental' },
];

export function RescheduleModal({ lead, categorySlug, currentDate, currentType, flow = 'manual', onConfirm, onClose }) {
  const isAfterNoShow = flow === 'after_no_show';
  const { modalities, trialClassOptions, professores } = useGeneralConfig();
  const toast = useToast();
  const typeLabelId = useId();
  const modalityId = useId();
  const qtyId = useId();
  const professorId = useId();

  // O instante da montagem: o render segue puro, e o envio confere de novo no
  // relógio. Até 17/10/2026 o campo aceitava o passado: um dia digitado errado
  // virava Atrasado e ainda fechava a tarefa de hoje.
  const [nowMs] = useState(() => Date.now());
  const apptAt = getSafeDateOrNull(currentDate);
  // Amanhã, no horário do agendamento.
  const [when, setWhen] = useState(() => whenFromPreset('amanha', apptAt ? hourOf(apptAt) : '09:00', new Date(nowMs)));
  const [apptType, setApptType] = useState(
    currentType === 'aula_experimental' || categorySlug === DAILY_GOAL_CATEGORIES.AULA_HOJE ? 'aula_experimental' : 'visita'
  );
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Aula experimental: modalidade, quantidade e professor, semeados do lead.
  const [modality, setModality] = useState(lead?.appointmentModality || '');
  const [qty, setQty] = useState(() => {
    const n = Number(lead?.trialClassesPlanned);
    return Number.isFinite(n) && n > 0 ? n : ((trialClassOptions && trialClassOptions[0]) || 1);
  });
  const [professorSel, setProfessorSel] = useState(
    lead?.appointmentSoloTraining ? SOLO_TRAINING : (lead?.appointmentProfessorId || '')
  );

  // A opção semeada do lead aparece na lista mesmo que tenha saído do catálogo.
  const baseQty = trialClassOptions && trialClassOptions.length ? trialClassOptions : [1];
  const qtyOptions = baseQty.includes(qty) ? baseQty : [...baseQty, qty].sort((a, b) => a - b);

  const isAula = apptType === 'aula_experimental';
  const typeText = isAula ? 'Aula experimental' : 'Visita';
  const professorText = professorSel === SOLO_TRAINING
    ? SOLO_TRAINING_LABEL
    : (professorSel ? professorNameById(professores, professorSel) || 'Professor' : 'sem professor');
  const now = new Date(nowMs);
  const context = isAfterNoShow
    ? (apptAt ? `Não compareceu ${dayRefText(apptAt, now)}` : 'Não compareceu')
    : (apptAt ? `${typeText} marcada para ${dayRefText(apptAt, now)}` : 'Sem horário marcado');
  const hint = whenIsFuture(when, nowMs) ? '' : 'Escolha um dia e horário futuros.';

  const handleConfirm = async () => {
    if (hint || submitting) return;
    const newDate = whenInstant(when);
    if (!(newDate && newDate.getTime() > Date.now())) {
      toast.warning('Escolha uma data e hora futuras.');
      return;
    }
    const finalQty = Number(qty) > 0 ? Math.floor(Number(qty)) : ((trialClassOptions && trialClassOptions[0]) || 1);
    const isSolo = professorSel === SOLO_TRAINING;
    const chosenProfessorId = isAula && !isSolo ? (professorSel || null) : null;
    const professorName = chosenProfessorId ? professorNameById(professores, chosenProfessorId) : null;
    setSubmitting(true);
    try {
      await onConfirm(newDate, note, apptType, isAula ? (modality || '').trim() : null, isAula ? finalQty : null, chosenProfessorId, professorName, isAula && isSolo);
    } finally {
      setSubmitting(false);
    }
  };

  const TypeIcon = isAula ? BookOpen : Building2;

  return (
    <PopupShell
      title={isAfterNoShow ? 'Agendar próxima tentativa' : `Remarcar ${isAula ? 'aula experimental' : 'visita'}`}
      lead={lead}
      context={context}
      busy={submitting}
      onClose={onClose}
      hint={hint}
      actions={(
        <>
          <PopupButton kind="ghost" onClick={() => onClose && onClose()} disabled={submitting}>{isAfterNoShow ? 'Agora não' : 'Cancelar'}</PopupButton>
          <PopupButton onClick={handleConfirm} disabled={Boolean(hint) || submitting}>
            {submitting ? 'Salvando...' : (isAfterNoShow ? 'Agendar tentativa' : 'Remarcar')}
          </PopupButton>
        </>
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13.5px]">
        <TypeIcon size={17} className="text-muted-foreground" aria-hidden="true" />
        <b className="font-semibold">{typeText}</b>
        {isAula && (
          <span className="text-muted-foreground">
            {modality || 'Sem modalidade'} · {professorText} · {qty} {qty === 1 ? 'aula' : 'aulas'}
          </span>
        )}
        <button
          type="button"
          aria-expanded={editing}
          onClick={() => setEditing((on) => !on)}
          className="ml-auto rounded-md text-[13px] font-semibold text-brand-700 hover:underline outline-none focus-visible:anel-foco dark:text-[#9FBCFF]"
        >
          {editing ? 'Pronto' : 'Alterar'}
        </button>
      </div>

      {editing && (
        <div className="grid gap-3">
          <div>
            <PopupLabel id={typeLabelId}>Tipo</PopupLabel>
            <RadioGroup value={apptType} onValueChange={setApptType} aria-labelledby={typeLabelId} className="flex gap-1 rounded-xl bg-muted p-[3px]">
              {TYPES.map((t) => (
                <RadioGroupOption
                  key={t.id}
                  value={t.id}
                  className={cn(
                    'h-[34px] flex-1 rounded-[9px] text-[13px] transition',
                    t.id === apptType ? 'bg-card font-semibold text-foreground shadow-sm' : 'font-medium text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t.label}
                </RadioGroupOption>
              ))}
            </RadioGroup>
          </div>
          {isAula && (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <PopupLabel htmlFor={modalityId}>Modalidade</PopupLabel>
                <select
                  id={modalityId}
                  value={modality}
                  onChange={(e) => { setModality(e.target.value); setProfessorSel(''); }}
                  className={cn(POPUP_FIELD, 'w-full cursor-pointer')}
                >
                  <option value="">{(modalities || []).length ? 'Selecione' : 'Cadastre em Configurações'}</option>
                  {(modalities || []).map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <PopupLabel htmlFor={qtyId}>Aulas previstas</PopupLabel>
                <select id={qtyId} value={qty} onChange={(e) => setQty(Number(e.target.value))} className={cn(POPUP_FIELD, 'num w-full cursor-pointer')}>
                  {qtyOptions.map((n) => <option key={n} value={n}>{n} {n === 1 ? 'aula' : 'aulas'}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <PopupLabel htmlFor={professorId}>Professor</PopupLabel>
                <select id={professorId} value={professorSel} onChange={(e) => setProfessorSel(e.target.value)} className={cn(POPUP_FIELD, 'w-full cursor-pointer')}>
                  <option value="">Selecione</option>
                  {professorsForModality(professores, modalities, modality).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  <option value={SOLO_TRAINING}>{SOLO_TRAINING_LABEL}</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      <WhenPicker value={when} onChange={setWhen} who={firstName(lead?.name) || 'O lead'} nowMs={nowMs} autoFocus />
      <NoteToggle
        placeholder={isAfterNoShow ? 'Ex: combinar pela manhã, ligar antes' : 'Ex: lead pediu para remarcar por motivo de trabalho'}
        value={note}
        onChange={setNote}
      />
    </PopupShell>
  );
}
