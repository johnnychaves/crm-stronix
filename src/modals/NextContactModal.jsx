import { useState } from 'react';
import { whenFromPreset, whenInstant, whenIsFuture } from '../lib/whenPicker.js';
import { firstName } from '../lib/guardian.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { NoteToggle, PopupButton, PopupShell } from '../components/dailygoal/popup/PopupShell.jsx';
import { WhenPicker } from '../components/dailygoal/popup/WhenPicker.jsx';

// "Quando voltar a falar?", que a Meta abre depois do Compareceu e do Cancelou
// de uma visita ou aula, na família de pop-ups da Meta. O lead sai com um
// próximo contato no futuro ou sem nenhum, nunca com a data parada no passado,
// que o trazia de volta como Atrasado no dia seguinte. Quem grava é a Meta, pelo
// onPick(data, observação) e pelo onSkip(observação).

export function NextContactModal({ lead, contextLabel = 'Tarefa concluída', onPick, onSkip, onClose }) {
  const toast = useToast();
  // O instante da montagem: o render segue puro, e o envio confere de novo no
  // relógio.
  const [nowMs] = useState(() => Date.now());
  const [when, setWhen] = useState(() => whenFromPreset('amanha', '09:00', new Date(nowMs)));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const hint = whenIsFuture(when, nowMs) ? '' : 'Escolha um dia e horário futuros.';

  const run = async (fn) => {
    if (submitting) return;
    setSubmitting(true);
    try { await fn(); } finally { setSubmitting(false); }
  };
  const pick = () => run(async () => {
    const at = whenInstant(when);
    if (!(at && at.getTime() > Date.now())) {
      toast.warning('Escolha uma data e hora futuras.');
      return;
    }
    await onPick(at, note);
  });
  const skip = () => run(async () => { await onSkip(note); });

  return (
    <PopupShell
      title={`Quando voltar a falar com ${firstName(lead?.name) || 'o lead'}?`}
      lead={lead}
      context={contextLabel}
      busy={submitting}
      onClose={onClose}
      hint={hint}
      actions={(
        <>
          <PopupButton kind="ghost" onClick={skip} disabled={submitting}>Sem próximo contato</PopupButton>
          <PopupButton onClick={pick} disabled={Boolean(hint) || submitting}>{submitting ? 'Salvando...' : 'Agendar contato'}</PopupButton>
        </>
      )}
    >
      <WhenPicker value={when} onChange={setWhen} who="O contato" nowMs={nowMs} autoFocus />
      <NoteToggle placeholder="Ex: respondeu no WhatsApp, retornar a proposta" value={note} onChange={setNote} />
      <p className="-mt-1.5 text-[12.5px] text-muted-foreground">Agendar conta como reaquecimento.</p>
    </PopupShell>
  );
}
