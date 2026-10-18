// Opções do balão "Marcar desfecho" da Meta Diária (OutcomePopover). Puro.
//   outcome  : desfecho atual ('attended', 'no_show' ou null)
//   canUndo  : com desfecho, oferece Desfazer marcação (só a Agenda de hoje)
// Os ids são o que o onPick recebe: 'attended', 'no_show' e 'undo'. Remarcou e
// Cancelou ficam no menu "Mais" do bloco Agora (AgoraCard).

const LABEL = { attended: 'Compareceu', no_show: 'Não compareceu' };

export function outcomeMenuItems({ outcome = null, canUndo = false } = {}) {
  if (outcome === 'attended' || outcome === 'no_show') {
    const other = outcome === 'attended' ? 'no_show' : 'attended';
    const items = [{
      id: other,
      label: `Trocar para ${LABEL[other].toLowerCase()}`,
      tone: other === 'attended' ? 'success' : 'danger',
    }];
    if (canUndo) items.push({ id: 'undo', label: 'Desfazer marcação', tone: 'neutral' });
    return items;
  }
  return [
    { id: 'attended', label: LABEL.attended, tone: 'success' },
    { id: 'no_show', label: LABEL.no_show, tone: 'danger' },
  ];
}

export const outcomeTriggerLabel = (outcome) => LABEL[outcome] || 'Marcar desfecho';
