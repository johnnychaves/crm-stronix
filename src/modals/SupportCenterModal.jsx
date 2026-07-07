import { useEffect, useMemo, useRef, useState } from 'react';
import { LifeBuoy, Plus, Send, ChevronLeft, MessageCircle } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { cn } from '../lib/utils.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog.jsx';
import { ticketMessages, isUnreadForClient, nextMessageState } from '../lib/ticketThread.js';

// ==========================================================================
// CENTRAL DE SUPORTE (cliente) — lista de chamados do tenant + conversa com
// o suporte + novo chamado. Dados chegam via props (listener único no App).
// Escritas do cliente ficam dentro do hasOnly das rules: mensagens/lastMsgAt/
// lastMsgBy/clienteLeuEmMs/status/updatedAt.
// ==========================================================================

const ST = {
  aberto: { t: 'Aberto', cls: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' },
  em_andamento: { t: 'Em andamento', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  resolvido: { t: 'Resolvido', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
};
const stOf = (t) => ST[t?.status] || ST.aberto;
const lastMs = (t) => t.lastMsgAt || t.createdAt?.toMillis?.() || 0;
const fmtDia = (ms) => (ms ? new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '');
const fmtMsg = (ms) => (ms ? new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

function StatusChip({ ticket, className }) {
  return <span className={cn('inline-flex items-center px-2 h-[20px] rounded-md text-[10.5px] font-bold uppercase tracking-wide', stOf(ticket).cls, className)}>{stOf(ticket).t}</span>;
}

function SupportCenterModal({ appUser, tickets, onClose }) {
  const toast = useToast();
  // sel: null = lista (mobile) / empty-state (desktop) · 'new' = novo chamado · senão id do ticket
  const [sel, setSel] = useState(null);
  const [reply, setReply] = useState('');
  const [novoTexto, setNovoTexto] = useState('');
  const [novaPrioridade, setNovaPrioridade] = useState('media');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const sorted = useMemo(() => [...(tickets || [])].sort((a, b) => lastMs(b) - lastMs(a)), [tickets]);
  const selTicket = sel && sel !== 'new' ? sorted.find((t) => t.id === sel) || null : null;
  const thread = selTicket ? ticketMessages(selTicket) : [];

  // Conversa aberta = lida (converge: depois do write, isUnreadForClient vira false).
  useEffect(() => {
    if (selTicket && isUnreadForClient(selTicket)) {
      updateDoc(doc(db, 'tickets', selTicket.id), { clienteLeuEmMs: Date.now() })
        .catch((e) => console.error('ticket read', e));
    }
  }, [selTicket]);

  // Autoscroll para a última mensagem.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [selTicket?.id, thread.length]);

  const send = () => {
    const texto = reply.trim();
    if (!texto || !selTicket || sending) return;
    setSending(true);
    const { msg, status } = nextMessageState(selTicket, { de: 'cliente', autor: appUser.name || appUser.email || null, texto, emMs: Date.now() });
    updateDoc(doc(db, 'tickets', selTicket.id), {
      mensagens: arrayUnion(msg), lastMsgAt: msg.emMs, lastMsgBy: 'cliente',
      clienteLeuEmMs: msg.emMs, ...(status ? { status } : {}), updatedAt: serverTimestamp(),
    }).then(() => setReply(''))
      .catch((e) => { console.error('ticket msg', e); toast.error('Não foi possível enviar a mensagem.'); })
      .finally(() => setSending(false));
  };

  const create = () => {
    const texto = novoTexto.trim();
    if (!texto) { toast.warning('Descreva o problema ou a dúvida.'); return; }
    if (sending) return;
    setSending(true);
    const emMs = Date.now();
    addDoc(collection(db, 'tickets'), {
      tenantId: appUser.tenantId,
      assunto: texto.slice(0, 500),
      prioridade: novaPrioridade,
      status: 'aberto',
      agente: '—',
      createdAt: serverTimestamp(),
      createdBy: appUser.name || appUser.email || appUser.id || null,
      mensagens: [{ de: 'cliente', autor: appUser.name || appUser.email || null, texto: texto.slice(0, 2000), emMs }],
      lastMsgAt: emMs,
      lastMsgBy: 'cliente',
    }).then((ref) => { toast.success('Chamado aberto! Nossa equipe responde por aqui.'); setNovoTexto(''); setNovaPrioridade('media'); setSel(ref.id); })
      .catch((e) => { console.error('ticket create', e); toast.error('Não foi possível abrir o chamado.'); })
      .finally(() => setSending(false));
  };

  const paneOpen = sel !== null; // mobile: mostra painel direito
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="p-0 gap-0 w-[calc(100vw-2rem)] sm:max-w-3xl overflow-hidden rounded-2xl h-[min(640px,85dvh)] flex flex-col" showCloseButton>
        <DialogTitle className="sr-only">Central de suporte</DialogTitle>
        <DialogDescription className="sr-only">Seus chamados com o suporte STRONILEAD</DialogDescription>
        <div className="flex flex-1 min-h-0">
          {/* ---- painel esquerdo: lista ---- */}
          <div className={cn('w-full md:w-[264px] md:shrink-0 flex-col border-r border-slate-200 dark:border-white/[0.08] min-h-0', paneOpen ? 'hidden md:flex' : 'flex')}>
            <div className="px-4 pt-4 pb-3 border-b border-slate-200 dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <span className="size-9 rounded-xl bg-brand-600 text-white grid place-items-center shadow-[0_6px_16px_-6px_rgba(43,89,255,.65)]"><LifeBuoy className="size-[18px]" /></span>
                <div>
                  <div className="font-display text-[16px] font-bold tracking-tight leading-none text-slate-900 dark:text-white">Suporte</div>
                  <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">A gente responde por aqui</div>
                </div>
              </div>
              <button onClick={() => setSel('new')}
                className="mt-3 w-full h-9 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[12px] font-bold flex items-center justify-center gap-1.5 transition active:scale-[.98]">
                <Plus className="size-4" /> Novo chamado
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sorted.length === 0 && (
                <div className="text-center px-4 py-10">
                  <MessageCircle className="size-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-3">Nenhum chamado ainda.<br />Precisa de ajuda? Abra o primeiro.</p>
                </div>
              )}
              {sorted.map((t) => {
                const unread = isUnreadForClient(t);
                return (
                  <button key={t.id} onClick={() => setSel(t.id)}
                    className={cn('w-full text-left px-3 py-2.5 rounded-xl transition',
                      sel === t.id ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]')}>
                    <div className="flex items-center gap-2">
                      {unread && <span className="size-2 rounded-full bg-accent-500 shrink-0" />}
                      <span className={cn('flex-1 truncate text-[13px]', unread ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-200')}>{t.assunto}</span>
                      <span className="text-[10.5px] text-slate-400 tabular-nums shrink-0">{fmtDia(lastMs(t))}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2"><StatusChip ticket={t} /></div>
                  </button>
                );
              })}
            </div>
          </div>
          {/* ---- painel direito: conversa / novo / vazio ---- */}
          <div className={cn('flex-1 min-w-0 flex-col min-h-0', paneOpen ? 'flex' : 'hidden md:flex')}>
            {sel === 'new' ? (
              <div className="flex-1 flex flex-col p-5 overflow-y-auto">
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={() => setSel(null)} aria-label="Voltar" className="md:hidden size-8 grid place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06]"><ChevronLeft className="size-4" /></button>
                  <h3 className="font-display text-[16px] font-bold tracking-tight text-slate-900 dark:text-white">Novo chamado</h3>
                </div>
                <label className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 mb-1.5">O que está acontecendo?</label>
                <textarea value={novoTexto} onChange={(e) => setNovoTexto(e.target.value)} rows={5} autoFocus placeholder="Descreva o problema ou a dúvida…"
                  className="w-full p-3.5 rounded-xl text-[13.5px] bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12 resize-none" />
                <label className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 mt-4 mb-1.5">Prioridade</label>
                <div className="flex gap-2">
                  {[['baixa', 'Baixa'], ['media', 'Média'], ['alta', 'Alta']].map(([v, l]) => (
                    <button key={v} onClick={() => setNovaPrioridade(v)}
                      className={cn('flex-1 h-10 rounded-xl text-[12.5px] font-bold border transition',
                        novaPrioridade === v ? 'bg-brand-600 text-white border-brand-600' : 'bg-white dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:border-brand-400')}>{l}</button>
                  ))}
                </div>
                <button onClick={create} disabled={sending || !novoTexto.trim()}
                  className="mt-5 h-11 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[13px] font-bold shadow-xl shadow-brand-500/20 transition active:scale-[.98] disabled:opacity-50">
                  {sending ? 'Enviando…' : 'Abrir chamado'}
                </button>
              </div>
            ) : selTicket ? (
              <>
                <div className="px-4 py-3 border-b border-slate-200 dark:border-white/[0.08] flex items-center gap-2.5">
                  <button onClick={() => setSel(null)} aria-label="Voltar" className="md:hidden size-8 grid place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] shrink-0"><ChevronLeft className="size-4" /></button>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-bold text-slate-900 dark:text-white truncate">{selTicket.assunto}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Chamado #{String(selTicket.id).slice(0, 5)}</div>
                  </div>
                  <StatusChip ticket={selTicket} className="shrink-0" />
                </div>
                <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50/60 dark:bg-white/[0.02]">
                  {thread.map((m, i) => (
                    <div key={i} className={cn('flex flex-col max-w-[85%]', m.de === 'cliente' ? 'ml-auto items-end' : 'items-start')}>
                      <div className={cn('px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]',
                        m.de === 'cliente'
                          ? 'bg-brand-600 text-white rounded-br-md'
                          : 'bg-white dark:bg-white/[0.06] text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-white/[0.08] rounded-bl-md')}>
                        {m.texto}
                      </div>
                      <span className="text-[10.5px] text-slate-400 mt-1 px-1">{m.de === 'suporte' ? 'Suporte STRONILEAD' : 'Você'}{m.emMs ? ` · ${fmtMsg(m.emMs)}` : ''}</span>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-slate-200 dark:border-white/[0.08] flex items-end gap-2">
                  <textarea rows={1} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={selTicket.status === 'resolvido' ? 'Responder reabre o chamado…' : 'Escreva sua mensagem…'}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    className="flex-1 max-h-28 p-2.5 rounded-xl text-[13px] bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12 resize-none" />
                  <button onClick={send} disabled={sending || !reply.trim()} aria-label="Enviar"
                    className="size-10 shrink-0 rounded-xl bg-brand-600 hover:bg-brand-700 text-white grid place-items-center transition active:scale-95 disabled:opacity-40">
                    <Send className="size-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 hidden md:grid place-items-center">
                <div className="text-center px-8">
                  <span className="size-12 mx-auto rounded-2xl bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-300 grid place-items-center"><MessageCircle className="size-6" /></span>
                  <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-4">Selecione um chamado ao lado<br />ou abra um novo.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { SupportCenterModal };
