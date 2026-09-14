// Nota comum da ficha: só a anotação na timeline, sem patch no lead.
//
// Nunca muda fase nem funil. A troca de etapa tem o caminho próprio no
// PhaseChanger (handlePhaseConfirm, em LeadProfileView). Antes, a nota
// comparava uma cópia da etapa e do funil feita ao abrir a ficha com o lead ao
// vivo; se outro consultor movia o lead com a ficha aberta, a próxima nota o
// devolvia à etapa antiga.
export function planProfileNote(note) {
  const text = String(note ?? '').trim();
  return text ? { text: `Obs: ${text}.`, type: 'note' } : null;
}
