import { useEffect, useRef, useState } from 'react';
import { ThumbsDown } from 'lucide-react';
import { useToast } from '../contexts/ToastContext.jsx';

// Modal Global de Motivo de Perda
function LossReasonModal({ lossReasons, onClose, onConfirm, returnFocusTo = null }) {
  const toast = useToast();
  const options = lossReasons?.length > 0 ? lossReasons : [{id: 'default', name: 'Sem motivo configurado'}];
  const [reason, setReason] = useState(options[0].name);
  // Trava o Confirmar enquanto a gravação corre: o clique duplo gravava a perda duas vezes.
  // A ref trava já no segundo clique; o estado só desliga o botão no render seguinte.
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const confirm = async () => {
    if (busyRef.current) return;
    if (!reason) { toast.warning('Selecione um motivo!'); return; }
    busyRef.current = true;
    setBusy(true);
    try { await onConfirm(reason); } finally { busyRef.current = false; setBusy(false); }
  };

  // A janela não é um Dialog: o Esc e a volta do foco são feitos aqui. Durante a
  // gravação o Esc não fecha, como o Cancelar não deveria largar a perda pela metade.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Lido no render, antes de o autoFocus da lista de motivos pegar o foco.
  const [opener] = useState(() => returnFocusTo || document.activeElement);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busyRef.current) { e.preventDefault(); closeRef.current?.(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const solto = !document.activeElement || document.activeElement === document.body;
      if (solto && opener && opener !== document.body && opener.isConnected) opener.focus();
    };
  }, [opener]);

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[200] p-4 animate-fade-in font-sans">
      <div className="bg-white dark:bg-neutral-900 border border-red-500/30 w-full max-w-md rounded-[2rem] p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-2">
          <ThumbsDown className="w-6 h-6 text-red-500" />
          <h3 className="text-xl font-bold text-red-500 uppercase tracking-tighter">Sinalizar Perda</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-neutral-400 font-bold mb-6">Diga por que esse lead foi perdido.</p>
        {/* autoFocus: a janela não é um Dialog e não leva o foco para dentro sozinha. */}
        <select autoFocus value={reason} onChange={e=>setReason(e.target.value)} className="w-full bg-paper-50 dark:bg-neutral-950 p-4 rounded-xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 focus:border-red-500 text-xs font-bold mb-6 appearance-none">
           {options.map(r => <option key={r.id || r.name} value={r.name}>{r.name}</option>)}
        </select>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-4 bg-gray-100 dark:bg-neutral-800 rounded-xl font-bold text-[10px] uppercase text-gray-500 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700 dark:bg-neutral-700 transition-all">Cancelar</button>
          <button onClick={confirm} disabled={busy} aria-busy={busy} className="flex-1 py-4 disabled:opacity-60 bg-red-600 rounded-xl font-bold text-[10px] uppercase text-gray-900 dark:text-white shadow-xl shadow-red-500/20 active:scale-95 transition-all">{busy ? 'Salvando…' : 'Confirmar Perda'}</button>
        </div>
      </div>
    </div>
  );
}
export { LossReasonModal };
