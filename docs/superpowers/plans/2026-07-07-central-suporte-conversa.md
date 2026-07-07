# Central de Suporte (conversa + aviso in-app) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o ticket de suporte em conversa bidirecional (superadmin responde no Console, cliente lê/responde numa Central de Suporte no app) com badge de não-lido em tempo real.

**Architecture:** Thread como array `mensagens` no próprio doc da coleção `tickets` (sem coleção nova, sem migração — tickets antigos renderizam o `assunto` como 1ª mensagem). Lógica pura (normalização, não-lido, transição de status) em `src/lib/ticketThread.js`; escritas Firestore inline nos componentes (idioma da casa). Cliente ganha `update` restrito via rules (publicação manual no console Firebase).

**Tech Stack:** React 19 + Vite, Firebase Firestore (client SDK), shadcn Dialog + Tailwind v4 (modal do cliente), console.css/inline styles (drawer do console). Sem test runner no repo → lógica pura verificada com `node -e`; componentes verificados com `npm run build` + lint + preview.

**Spec:** `docs/superpowers/specs/2026-07-07-suporte-conversa-design.md`

**Contrato de dados (referência para todas as tasks):**
- `mensagens: [{ de: 'cliente'|'suporte', autor: string|null, texto: string, emMs: number }]` (`serverTimestamp` não funciona dentro de array → `Date.now()`)
- `lastMsgAt: number` · `lastMsgBy: 'cliente'|'suporte'` · `clienteLeuEmMs: number` · `suporteLeuEmMs: number`
- Não-lido cliente = `lastMsgBy === 'suporte' && lastMsgAt > (clienteLeuEmMs||0)`; espelhado p/ suporte.
- Transições: cliente responde ticket `resolvido` → `aberto`; suporte responde ticket `aberto` → `em_andamento`.

---

### Task 1: Lógica pura da conversa — `src/lib/ticketThread.js`

**Files:**
- Create: `src/lib/ticketThread.js`

- [ ] **Step 1.0: Garantir deps do worktree**

Run: `ls node_modules >/dev/null 2>&1 || npm install`
(worktrees novos vêm sem node_modules — ver memória do projeto)

- [ ] **Step 1.1: Criar o arquivo com as funções puras**

```js
// Lógica pura da conversa de suporte (tickets). Sem imports de Firebase de
// propósito: os componentes fazem o updateDoc/arrayUnion; aqui vive só a
// regra de negócio (normalização de thread, não-lido e transição de status),
// testável em node puro. Espelha a spec docs/superpowers/specs/2026-07-07.
const MSG_MAX = 2000;

// Thread do ticket. Tickets antigos (sem `mensagens`) viram conversa de 1
// mensagem: o assunto como abertura do cliente.
function ticketMessages(t) {
  if (Array.isArray(t?.mensagens) && t.mensagens.length) return t.mensagens;
  if (!t?.assunto) return [];
  return [{
    de: 'cliente',
    autor: t.createdBy || null,
    texto: t.assunto,
    emMs: t.createdAt?.toMillis ? t.createdAt.toMillis() : 0,
  }];
}

const isUnreadForClient = (t) =>
  t?.lastMsgBy === 'suporte' && (t.lastMsgAt || 0) > (t.clienteLeuEmMs || 0);
const isUnreadForSupport = (t) =>
  t?.lastMsgBy === 'cliente' && (t.lastMsgAt || 0) > (t.suporteLeuEmMs || 0);
const countUnreadForClient = (tickets) => (tickets || []).filter(isUnreadForClient).length;

// Monta a mensagem nova + status resultante (undefined = status não muda).
// Cliente reabre ticket resolvido; resposta do suporte tira de "aberto".
function nextMessageState(ticket, { de, autor, texto, emMs }) {
  const msg = { de, autor: autor || null, texto: String(texto).trim().slice(0, MSG_MAX), emMs };
  let status;
  if (de === 'cliente' && ticket?.status === 'resolvido') status = 'aberto';
  if (de === 'suporte' && (ticket?.status || 'aberto') === 'aberto') status = 'em_andamento';
  return { msg, status };
}

export { ticketMessages, isUnreadForClient, isUnreadForSupport, countUnreadForClient, nextMessageState };
```

- [ ] **Step 1.2: Smoke test das funções puras (node)**

Run:
```bash
node --input-type=module -e "
import { ticketMessages, isUnreadForClient, isUnreadForSupport, countUnreadForClient, nextMessageState } from './src/lib/ticketThread.js';
const assert = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
// legado: assunto vira 1ª mensagem
const legado = { assunto: 'Não consigo exportar', createdBy: 'Ana', createdAt: { toMillis: () => 111 } };
const th = ticketMessages(legado);
assert(th.length === 1 && th[0].de === 'cliente' && th[0].texto === 'Não consigo exportar' && th[0].emMs === 111, 'thread legado');
assert(ticketMessages({}).length === 0, 'ticket vazio');
// não-lido
assert(isUnreadForClient({ lastMsgBy: 'suporte', lastMsgAt: 10 }) === true, 'cliente unread sem leitura');
assert(isUnreadForClient({ lastMsgBy: 'suporte', lastMsgAt: 10, clienteLeuEmMs: 10 }) === false, 'cliente leu');
assert(isUnreadForClient({ lastMsgBy: 'cliente', lastMsgAt: 10 }) === false, 'última é do próprio cliente');
assert(isUnreadForSupport({ lastMsgBy: 'cliente', lastMsgAt: 10 }) === true, 'suporte unread');
assert(countUnreadForClient([{ lastMsgBy: 'suporte', lastMsgAt: 9 }, { lastMsgBy: 'cliente', lastMsgAt: 9 }]) === 1, 'contagem');
// transições
assert(nextMessageState({ status: 'resolvido' }, { de: 'cliente', texto: 'x', emMs: 1 }).status === 'aberto', 'cliente reabre');
assert(nextMessageState({ status: 'aberto' }, { de: 'suporte', texto: 'x', emMs: 1 }).status === 'em_andamento', 'suporte avança');
assert(nextMessageState({}, { de: 'suporte', texto: 'x', emMs: 1 }).status === 'em_andamento', 'status ausente = aberto');
assert(nextMessageState({ status: 'em_andamento' }, { de: 'cliente', texto: 'x', emMs: 1 }).status === undefined, 'sem mudança');
assert(nextMessageState({}, { de: 'cliente', autor: '', texto: '  oi  ', emMs: 5 }).msg.texto === 'oi', 'trim');
assert(nextMessageState({}, { de: 'cliente', texto: 'a'.repeat(3000), emMs: 5 }).msg.texto.length === 2000, 'limite 2000');
console.log('ticketThread OK');
"
```
Expected: `ticketThread OK`

- [ ] **Step 1.3: Commit**

```bash
git add src/lib/ticketThread.js
git commit -m "feat(suporte): lógica pura da conversa do ticket (thread, não-lido, transições)"
```

---

### Task 2: Console — painel de conversa no SupportScreen

**Files:**
- Modify: `src/views/console/SuperConsole.jsx` (imports linha 3; `SupportScreen` linhas ~1254-1316)

- [ ] **Step 2.1: Adicionar imports**

Na linha 3, acrescentar `arrayUnion` ao import de `firebase/firestore`:
```js
import { collection, onSnapshot, doc, getDoc, setDoc, addDoc, deleteDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
```
Logo após a linha do import de `brazilLookups.js`, adicionar:
```js
import { ticketMessages, isUnreadForSupport, nextMessageState } from '../../lib/ticketThread.js';
```

- [ ] **Step 2.2: Estado + handlers da conversa no `SupportScreen`**

Dentro de `function SupportScreen({ tenants })`, logo após `const [form, setForm] = useState(...)`, adicionar:

```jsx
  const [sel, setSel] = useState(null); // id do ticket com conversa aberta
  const [reply, setReply] = useState('');
  const selTicket = (tickets || []).find((t) => t.id === sel) || null;
  // Abrir a conversa (ou chegar mensagem nova com ela aberta) marca como lida.
  useEffect(() => {
    if (!sel) return;
    setDoc(doc(db, 'tickets', sel), { suporteLeuEmMs: Date.now() }, { merge: true })
      .catch((e) => console.error('ticket read', e));
  }, [sel, selTicket?.lastMsgAt]);
  const sendReply = () => {
    const texto = reply.trim();
    if (!texto || !selTicket) return;
    const { msg, status } = nextMessageState(selTicket, { de: 'suporte', autor: 'Suporte STRONILEAD', texto, emMs: Date.now() });
    setDoc(doc(db, 'tickets', selTicket.id), {
      mensagens: arrayUnion(msg), lastMsgAt: msg.emMs, lastMsgBy: 'suporte',
      suporteLeuEmMs: msg.emMs, ...(status ? { status } : {}), updatedAt: serverTimestamp(),
    }, { merge: true }).then(() => setReply('')).catch((e) => console.error('ticket reply', e));
  };
```

- [ ] **Step 2.3: Linha da tabela clicável + indicador de não-lido**

Substituir o `<tr key={t.id}>` do map de tickets por:

```jsx
                  <tr key={t.id} onClick={() => setSel(t.id)}
                    style={{ cursor: 'pointer', background: isUnreadForSupport(t) ? 'rgba(59,109,245,.07)' : undefined }}>
                    <td className="tnum" style={{ fontWeight: 600 }}>
                      {isUnreadForSupport(t) && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 99, background: 'var(--accent)', marginRight: 7 }} />}
                      #{String(t.id).slice(0, 5)}
                    </td>
                    <td style={{ fontWeight: 600 }}>{nameOf[t.tenantId] || t.academia || t.tenantId}</td>
                    <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.assunto}</td>
                    <td><span className={`badge ${(PRI[t.prioridade] || PRI.media).c}`}>{(PRI[t.prioridade] || PRI.media).t}</span></td>
                    <td><button className={`badge ${(TST[t.status] || TST.aberto).c}`} style={{ cursor: 'pointer', border: 0 }} title="Clique p/ avançar o status" onClick={(e) => { e.stopPropagation(); cycleStatus(t); }}>{(TST[t.status] || TST.aberto).t}</button></td>
                    <td className="muted tnum">{t.createdAt?.toMillis ? new Date(t.createdAt.toMillis()).toLocaleDateString('pt-BR') : '—'}</td>
                  </tr>
```
(única mudança além do clique: `e.stopPropagation()` no badge de status e ellipsis no assunto)

- [ ] **Step 2.4: Drawer de conversa**

Antes do `</>` final do return do `SupportScreen`, adicionar:

```jsx
      {selTicket && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', justifyContent: 'flex-end', background: 'rgba(4,7,18,.55)' }} onClick={() => setSel(null)}>
          <div style={{ width: 'min(460px, 100vw)', height: '100%', background: 'var(--bg-2)', borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>#{String(selTicket.id).slice(0, 5)} · {nameOf[selTicket.tenantId] || selTicket.academia || selTicket.tenantId}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selTicket.assunto}</div>
              </div>
              <span className={`badge ${(PRI[selTicket.prioridade] || PRI.media).c}`}>{(PRI[selTicket.prioridade] || PRI.media).t}</span>
              <button className={`badge ${(TST[selTicket.status] || TST.aberto).c}`} style={{ cursor: 'pointer', border: 0 }} title="Clique p/ avançar o status" onClick={() => cycleStatus(selTicket)}>{(TST[selTicket.status] || TST.aberto).t}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSel(null)} aria-label="Fechar">✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ticketMessages(selTicket).map((m, i) => (
                <div key={i} style={{ alignSelf: m.de === 'suporte' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                  <div style={{
                    padding: '9px 12px', borderRadius: 12, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                    background: m.de === 'suporte' ? 'var(--brand-600)' : 'var(--surface)',
                    color: m.de === 'suporte' ? '#fff' : 'var(--text)',
                    border: m.de === 'suporte' ? 'none' : '1px solid var(--line)',
                  }}>{m.texto}</div>
                  <div className="muted" style={{ fontSize: 10.5, marginTop: 3, textAlign: m.de === 'suporte' ? 'right' : 'left' }}>
                    {m.de === 'suporte' ? 'Suporte' : (m.autor || 'Cliente')}{m.emMs ? ` · ${new Date(m.emMs).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: 14, borderTop: '1px solid var(--line)', display: 'flex', gap: 8 }}>
              <textarea rows={2} placeholder="Escreva a resposta…" value={reply} onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                style={{ ...FLAG_INPUT, height: 'auto', flex: 1, padding: '9px 12px', resize: 'none', lineHeight: 1.5 }} />
              <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} onClick={sendReply} disabled={!reply.trim()}>Responder</button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 2.5: Build**

Run: `npm run build`
Expected: `✓ built` sem erros

- [ ] **Step 2.6: Commit**

```bash
git add src/views/console/SuperConsole.jsx
git commit -m "feat(suporte): console responde ticket em drawer de conversa + não-lido"
```

---

### Task 3: Cliente — `src/modals/SupportCenterModal.jsx` (nova)

**Files:**
- Create: `src/modals/SupportCenterModal.jsx`

Invocar a skill `frontend-design` antes de escrever a UI (regra da casa p/ UI nova). O código abaixo é o contrato funcional completo: layout 2 painéis (lista | conversa) no desktop, painel único com "voltar" no mobile, visual premium seguindo `AddLeadModal` (Dialog shadcn, `cn()`, tokens slate/brand/accent, Space Grotesk via `font-display`). Ajustes estéticos da skill entram por cima deste esqueleto.

- [ ] **Step 3.1: Criar o componente**

```jsx
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
                  <div className="font-display text-[16px] font-bold tracking-tight leading-none">Suporte</div>
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
                  <button onClick={() => setSel(null)} className="md:hidden size-8 grid place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06]"><ChevronLeft className="size-4" /></button>
                  <h3 className="font-display text-[16px] font-bold tracking-tight">Novo chamado</h3>
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
                  <button onClick={() => setSel(null)} className="md:hidden size-8 grid place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] shrink-0"><ChevronLeft className="size-4" /></button>
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
```

- [ ] **Step 3.2: Build**

Run: `npm run build`
Expected: `✓ built` sem erros

- [ ] **Step 3.3: Commit**

```bash
git add src/modals/SupportCenterModal.jsx
git commit -m "feat(suporte): Central de Suporte do cliente (lista + conversa + novo chamado)"
```

---

### Task 4: App.jsx — listener, badge e troca do modal

**Files:**
- Modify: `src/App.jsx` (import linha 87; estado ~linha 159; sidebar linha 996; render linha 1185)
- Delete: `src/modals/CreateTicketModal.jsx`

- [ ] **Step 4.1: Trocar import**

Linha 87, substituir:
```js
import { CreateTicketModal } from './modals/CreateTicketModal.jsx';
```
por:
```js
import { SupportCenterModal } from './modals/SupportCenterModal.jsx';
import { countUnreadForClient } from './lib/ticketThread.js';
```

- [ ] **Step 4.2: Listener dos tickets do tenant + contagem de não-lidos**

Adicionar (depois das declarações de `appUser` e `tenantBlock` no componente — se a linha 159 vier antes delas, posicionar o bloco logo após a declaração de `tenantBlock`):

```jsx
  // Tickets de suporte do tenant (badge da sidebar + Central de Suporte).
  // Não-crítico: erro aqui não bloqueia o app (sem loadError).
  const [tickets, setTickets] = useState([]);
  useEffect(() => {
    if (!appUser?.tenantId || appUser.superAdminOnly || tenantBlock) { setTickets([]); return; }
    const q = query(collection(db, 'tickets'), where('tenantId', '==', appUser.tenantId));
    const unsub = onSnapshot(q,
      (snap) => setTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.error('onSnapshot tickets falhou', e));
    return () => unsub();
  }, [appUser?.tenantId, appUser?.superAdminOnly, tenantBlock]);
  const ticketsUnread = useMemo(() => countUnreadForClient(tickets), [tickets]);
```

Conferir que `useMemo`, `query`, `where`, `collection`, `onSnapshot` já estão importados (estão: linha 14 e usos em 381/906).

- [ ] **Step 4.3: Badge na sidebar**

Linha 996, substituir:
```jsx
<SidebarItem icon={<LifeBuoy className="w-[18px] h-[18px]" />} label="Suporte" active={false} onClick={() => setTicketModalOpen(true)} />
```
por:
```jsx
<SidebarItem icon={<LifeBuoy className="w-[18px] h-[18px]" />} label="Suporte" badge={ticketsUnread > 0 ? ticketsUnread : null} active={false} onClick={() => setTicketModalOpen(true)} />
```

- [ ] **Step 4.4: Trocar o modal renderizado**

Linha 1185, substituir:
```jsx
{ticketModalOpen && <CreateTicketModal appUser={appUser} onClose={() => setTicketModalOpen(false)} />}
```
por:
```jsx
{ticketModalOpen && <SupportCenterModal appUser={appUser} tickets={tickets} onClose={() => setTicketModalOpen(false)} />}
```

- [ ] **Step 4.5: Remover o modal antigo**

Run: `grep -rn "CreateTicketModal" src/ || echo "sem referências"` → deve restar nenhuma referência; então `git rm src/modals/CreateTicketModal.jsx`

- [ ] **Step 4.6: Build + lint**

Run: `npm run build && npm run lint`
Expected: build ✓; lint sem erros novos (warnings pré-existentes de outros arquivos são ok)

- [ ] **Step 4.7: Commit**

```bash
git add -A src/App.jsx src/modals/
git commit -m "feat(suporte): badge de não-lido na sidebar + Central de Suporte no lugar do form"
```

---

### Task 5: Rules do Firestore (arquivo fonte no repo)

**Files:**
- Modify: `firestore.rules:218-222`

- [ ] **Step 5.1: Atualizar o bloco de tickets**

Substituir:
```
    match /tickets/{ticketId} {
      allow read: if isSuperAdmin() || (isSignedIn() && resource.data.tenantId == request.auth.token.tenantId);
      allow create: if isSuperAdmin() || (isSignedIn() && request.resource.data.tenantId == request.auth.token.tenantId);
      allow update, delete: if isSuperAdmin();
    }
```
por:
```
    match /tickets/{ticketId} {
      allow read: if isSuperAdmin() || (isSignedIn() && resource.data.tenantId == request.auth.token.tenantId);
      allow create: if isSuperAdmin() || (isSignedIn() && request.resource.data.tenantId == request.auth.token.tenantId);
      // Cliente conversa no próprio ticket: só campos da thread/leitura,
      // sem trocar tenantId (reabrir ticket resolvido muda `status`).
      allow update: if isSuperAdmin() || (
        isSignedIn()
        && resource.data.tenantId == request.auth.token.tenantId
        && request.resource.data.tenantId == resource.data.tenantId
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['mensagens', 'lastMsgAt', 'lastMsgBy', 'clienteLeuEmMs', 'status', 'updatedAt'])
      );
      allow delete: if isSuperAdmin();
    }
```

- [ ] **Step 5.2: Commit**

```bash
git add firestore.rules
git commit -m "feat(suporte): rules — cliente atualiza a conversa do próprio ticket (publicação manual)"
```

**IMPORTANTE (deploy):** as rules são publicadas MANUALMENTE no console Firebase e devem ir ao ar ANTES do merge do front (são retrocompatíveis — o app atual não faz update de ticket como cliente). Incluir isso no corpo da PR e no report final.

---

### Task 6: Verificação + PR

- [ ] **Step 6.1: Suite completa**

Run: smoke test da Task 1 (`node --input-type=module -e ...`) + `npm run build && npm run lint`
Expected: tudo verde

- [ ] **Step 6.2: Preview manual**

Subir `npm run dev` (porta 5180 via `.claude/launch.json`, `preview_start`) e verificar o que for alcançável sem login real; capturar screenshot. Login E2E completo fica para o Johnny validar (padrão das entregas anteriores).

- [ ] **Step 6.3: Push + PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(suporte): Central de Suporte — conversa no ticket + aviso in-app" --body "<resumo + ordem de deploy: publicar rules antes do merge + link da spec>"
```

---

## Self-review do plano

- **Cobertura da spec:** modelo de dados (T1), console responde + não-lido do suporte (T2), central do cliente + reabrir resolvido + marcar lido (T3), badge tempo real + listener (T4), rules com hasOnly (T5), critérios de aceite verificáveis (T6 + validação manual do Johnny). ✓
- **Sem placeholders:** todo step de código tem o código; único "conferir" é guarda de posicionamento (T4.2) com instrução concreta. ✓
- **Consistência de nomes:** `ticketMessages` / `isUnreadForClient` / `isUnreadForSupport` / `countUnreadForClient` / `nextMessageState` idênticos em T1/T2/T3/T4; campos Firestore idênticos ao hasOnly das rules (T5) — `suporteLeuEmMs` fica fora do hasOnly de propósito (só superadmin escreve). ✓
