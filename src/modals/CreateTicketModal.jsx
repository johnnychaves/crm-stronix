import { useState } from 'react';
import { LifeBuoy } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { useToast } from '../contexts/ToastContext.jsx';

// Abertura de chamado pelo cliente (tenant). Escreve em `tickets` (as rules
// permitem create quando data.tenantId == claim tenantId). O super-admin
// gerencia no Console (tela Suporte).
function CreateTicketModal({ appUser, onClose }) {
  const toast = useToast();
  const [assunto, setAssunto] = useState('');
  const [prioridade, setPrioridade] = useState('media');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!assunto.trim()) { toast.warning('Descreva o assunto do chamado.'); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, 'tickets'), {
        tenantId: appUser.tenantId,
        assunto: assunto.trim().slice(0, 500),
        prioridade,
        status: 'aberto',
        agente: '—',
        createdAt: serverTimestamp(),
        createdBy: appUser.name || appUser.email || appUser.id || null,
      });
      toast.success('Chamado aberto! Nossa equipe vai responder em breve.');
      onClose();
    } catch (e) {
      console.error('ticket create', e);
      toast.error('Não foi possível abrir o chamado.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[200] p-4 animate-fade-in font-sans">
      <div className="bg-white dark:bg-neutral-900 border border-brand-500/30 w-full max-w-md rounded-[2rem] p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-2">
          <LifeBuoy className="w-6 h-6 text-brand-500" />
          <h3 className="text-xl font-bold text-brand-600 dark:text-brand-400 uppercase tracking-tighter">Abrir chamado</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-neutral-400 font-bold mb-6">Conte o que você precisa — nossa equipe responde por aqui.</p>
        <textarea value={assunto} onChange={(e) => setAssunto(e.target.value)} rows={4} placeholder="Descreva o problema ou a dúvida…"
          className="w-full bg-paper-50 dark:bg-neutral-950 p-4 rounded-xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 focus:border-brand-500 text-xs font-medium mb-4 resize-none" />
        <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)}
          className="w-full bg-paper-50 dark:bg-neutral-950 p-4 rounded-xl text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-neutral-800 focus:border-brand-500 text-xs font-bold mb-6 appearance-none">
          <option value="baixa">Prioridade: Baixa</option>
          <option value="media">Prioridade: Média</option>
          <option value="alta">Prioridade: Alta</option>
        </select>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-4 bg-gray-100 dark:bg-neutral-800 rounded-xl font-bold text-[10px] uppercase text-gray-500 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-all">Cancelar</button>
          <button onClick={submit} disabled={saving} className="flex-1 py-4 bg-brand-600 rounded-xl font-bold text-[10px] uppercase text-white shadow-xl shadow-brand-500/20 active:scale-95 transition-all disabled:opacity-50">{saving ? 'Enviando…' : 'Abrir chamado'}</button>
        </div>
      </div>
    </div>
  );
}

export { CreateTicketModal };
