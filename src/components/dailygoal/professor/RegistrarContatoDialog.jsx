import { useState } from 'react';
import { Check, MessageCircle, PhoneOff, X } from 'lucide-react';
import { PopupShell, PopupButton, PopupLabel, ChoiceChips, NoteToggle } from '../popup/PopupShell.jsx';
import { OutcomeCards } from '../popup/OutcomeCards.jsx';
import { CANAIS, RESULTADOS } from '../../../lib/faltosos/metaProfessor.js';

const ICONES = { vai_voltar: Check, respondeu: MessageCircle, nao_respondeu: PhoneOff, quer_cancelar: X };
const OPCOES = RESULTADOS.map((r) => ({ ...r, Icon: ICONES[r.id] }));

export function RegistrarContatoDialog({ lead, contexto, onConfirm, onClose }) {
  const [canal, setCanal] = useState('whatsapp');
  const [resultado, setResultado] = useState('');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const confirmar = async () => {
    if (!resultado) return;
    setSalvando(true);
    setErro('');
    try {
      await onConfirm({ canal, resultado, observacao });
      onClose();
    } catch {
      setErro('Não deu para registrar. Tente de novo.');
      setSalvando(false);
    }
  };
  return (
    <PopupShell
      title="Registrar contato"
      lead={lead}
      context={contexto}
      busy={salvando}
      onClose={onClose}
      hint={erro || (resultado ? '' : 'Escolha o que aconteceu.')}
      actions={<PopupButton onClick={confirmar} disabled={!resultado || salvando}>Registrar contato</PopupButton>}
    >
      <PopupLabel id="contato-canal">Como foi o contato</PopupLabel>
      <ChoiceChips options={CANAIS} value={canal} onChange={setCanal} labelledBy="contato-canal" />
      <OutcomeCards question="O que aconteceu" options={OPCOES} value={resultado} onChange={setResultado} />
      <NoteToggle placeholder="Observação (opcional)" value={observacao} onChange={setObservacao} />
    </PopupShell>
  );
}
