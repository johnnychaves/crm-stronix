import { useRef, useState } from 'react';
import { Calendar, Check, MessageCircle, Pencil, Phone, RefreshCw } from 'lucide-react';
import { appendQuickText, EMPTY_DRAFTS, QUICK_TEXTS } from '../../lib/quickTexts.js';
import { cn } from '../../lib/utils.js';
import { Avatar } from '../ui/Avatar.jsx';
import { Btn } from '../ui/Btn.jsx';

// O compositor da ficha (desenho A2). Fechado, é uma linha: "Registrar o que
// aconteceu com Rafael", com um ícone para cada modo. Aberto, mostra os modos em
// botões coloridos e, embaixo, o que o modo pede: uma caixa de texto (Anotação,
// WhatsApp, Ligação) ou o assistente (Mudar fase, Agendar), que a ficha entrega
// pelas funções renderStatus e renderSchedule.
//
// Quem guarda se está aberto e em que modo é a ficha (open, mode, onOpen,
// onClose), porque os gravadores que fecham o compositor depois de gravar moram
// lá. Os rascunhos de cada modo (drafts, onDrafts) também moram na ficha: a aba
// Linha do tempo desmonta o compositor quando a pessoa vai a outra aba, e o texto
// digitado não pode ir junto. O compositor guarda só a dica de campo vazio. O
// texto de um modo nunca vai para outro, e fechar com texto digitado pergunta
// antes de descartar.
//
// onSubmitText(mode, text) devolve uma promessa de true quando gravou. Só então
// a caixa do modo esvazia.

const MODES = [
  { id: 'note', label: 'Anotação', Icon: Pencil, color: 'ink' },
  { id: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle, color: 'green' },
  { id: 'call', label: 'Ligação', Icon: Phone, color: 'brand' },
  { id: 'status', label: 'Mudar fase', Icon: RefreshCw, color: 'amber' },
  { id: 'schedule', label: 'Agendar', Icon: Calendar, color: 'violet' },
];

// Classes escritas por extenso, porque o Tailwind não enxerga nome montado.
const COLOR = {
  // A Anotação inverte no escuro (fundo claro e texto tinta), como o filtro do registro.
  ink: { on: 'border-[#0E1A40] bg-[#0E1A40] text-white dark:border-white dark:bg-white dark:text-[#0E1A40]', onTile: 'bg-white/20 text-white dark:bg-[#0E1A40]/10 dark:text-[#0E1A40]', tile: 'bg-[#0E1A40]/10 text-[#0E1A40] dark:bg-white/10 dark:text-white', hover: 'hover:border-[#0E1A40]/40 hover:bg-[#0E1A40]/5' },
  green: { on: 'border-emerald-700 bg-emerald-700 text-white', tile: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300', hover: 'hover:border-emerald-500/45 hover:bg-emerald-500/5' },
  brand: { on: 'border-brand-600 bg-brand-600 text-white', tile: 'bg-brand-500/12 text-brand-700 dark:text-brand-300', hover: 'hover:border-brand-500/45 hover:bg-brand-500/5' },
  amber: { on: 'border-amber-700 bg-amber-700 text-white', tile: 'bg-amber-500/12 text-amber-700 dark:text-amber-300', hover: 'hover:border-amber-500/45 hover:bg-amber-500/5' },
  violet: { on: 'border-violet-600 bg-violet-600 text-white', tile: 'bg-violet-500/12 text-violet-700 dark:text-violet-300', hover: 'hover:border-violet-500/45 hover:bg-violet-500/5' },
};

const TEXT_MODES = {
  note: { placeholder: () => 'O que aconteceu na conversa? Registre o que ajuda no próximo contato.', submit: 'Registrar anotação', empty: 'Escreva a anotação antes de registrar.' },
  // Menor de idade: a mensagem vai para o responsável (contactOf), então o
  // placeholder usa o nome dele (whatsappName), e não o do aluno.
  whatsapp: { placeholder: (first, waName) => `Mensagem para ${waName || first}`, submit: 'Enviar pelo WhatsApp', empty: 'Escreva a mensagem antes de enviar.' },
  call: { placeholder: () => 'Resumo da ligação e o que combinaram.', submit: 'Registrar ligação', empty: 'Resuma a ligação antes de registrar.' },
};
const LAST_ICON = { Anotação: Pencil, WhatsApp: MessageCircle, Ligação: Phone };
const dm = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export function ProfileComposer({
  open, mode, onOpen, onClose,
  drafts = EMPTY_DRAFTS, onDrafts,
  appUser, firstName, whatsappName = null, lastText = null,
  canMudarFase = true, loading = false,
  onSubmitText, renderStatus, renderSchedule,
}) {
  // A dica de campo vazio é de um modo só: trocar de modo a esconde.
  const [hintState, setHintState] = useState({ mode: null, text: '' });
  const hint = hintState.mode === mode ? hintState.text : '';
  const setHint = (text) => setHintState({ mode, text });

  const modes = MODES.filter((m) => m.id !== 'status' || canMudarFase);
  const textMode = TEXT_MODES[mode];
  const draft = drafts[mode] ?? '';
  const dirty = Object.values(drafts).some((v) => v.trim());

  // onDrafts aceita o valor ou uma função (é o setState da ficha), e a gravação
  // assíncrona usa a função para não regravar um rascunho velho.
  const setDraft = (value) => { onDrafts((d) => ({ ...d, [mode]: value })); setHint(''); };
  const tryClose = () => {
    if (dirty && !window.confirm('Descartar o texto digitado?')) return;
    onDrafts(EMPTY_DRAFTS);
    setHint('');
    onClose();
  };
  // Gravação em andamento neste compositor: o botão fica desligado pelo
  // `loading`, e esta trava segura o Ctrl e Enter repetido antes de a ficha
  // redesenhar.
  const sending = useRef(false);
  const submit = async () => {
    if (loading || sending.current) return;
    const sent = draft;
    const text = sent.trim();
    if (!text) { setHint(textMode.empty); return; }
    sending.current = true;
    try {
      const ok = await onSubmitText(mode, text);
      // Só esvazia o rascunho que ainda é o texto enviado: o que a pessoa
      // escreveu depois, com a rede lenta, fica.
      if (ok) { onDrafts((d) => (d[mode] === sent ? { ...d, [mode]: '' } : d)); setHint(''); }
    } finally {
      sending.current = false;
    }
  };

  if (!open) {
    return (
      <section
        aria-label="Registrar"
        className="flex items-center gap-2 rounded-2xl border border-border bg-card py-2.5 pl-4 pr-3 shadow-card transition hover:border-brand-200 focus-within:border-brand-300"
      >
        <Avatar name={appUser?.name || 'Você'} size={30} />
        <button
          type="button"
          onClick={() => onOpen('note')}
          className="min-w-0 flex-1 rounded-lg py-1.5 text-left text-[14.5px] text-muted-foreground focus-visible:outline-none focus-visible:anel-foco"
        >
          Registrar o que aconteceu com {firstName}
        </button>
        <div className="flex gap-1">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              title={m.label}
              onClick={() => onOpen(m.id)}
              className="grid size-8 place-items-center rounded-[9px] bg-slate-100 text-muted-foreground transition hover:bg-slate-200 hover:text-foreground focus-visible:outline-none focus-visible:anel-foco dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
            >
              <m.Icon size={15} aria-hidden="true" />
              <span className="sr-only">{m.label}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  const LastIcon = lastText ? (LAST_ICON[lastText.label] || Pencil) : null;
  return (
    <section aria-label="Registrar" className="rounded-2xl border border-border bg-card p-[18px] shadow-card">
      <div role="group" aria-label="Tipo de registro" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {modes.map((m) => {
          const on = mode === m.id;
          const c = COLOR[m.color];
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={on}
              disabled={loading}
              onClick={() => onOpen(m.id)}
              className={cn(
                'flex h-[50px] items-center gap-2.5 whitespace-nowrap rounded-[15px] border px-3 text-[14.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
                'focus-visible:outline-none focus-visible:anel-foco focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                on ? cn(c.on, 'shadow-card') : cn('border-border bg-card text-slate-700 dark:text-slate-200', c.hover)
              )}
            >
              <span className={cn('grid size-8 flex-none place-items-center rounded-[11px]', on ? (c.onTile || 'bg-white/20 text-white') : c.tile)}>
                <m.Icon size={17} aria-hidden="true" />
              </span>
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {mode === 'status' && renderStatus()}
        {mode === 'schedule' && renderSchedule()}
        {textMode && (
          <>
            {lastText && (
              <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-border bg-slate-50 px-3 py-2.5 text-[13px] dark:bg-white/[0.02]">
                <LastIcon size={15} className="mt-0.5 flex-none text-slate-400" aria-hidden="true" />
                <p className="line-clamp-2 min-w-0 flex-1 leading-[1.45]">
                  <span className="text-muted-foreground">{lastText.label}, {dm(lastText.date)}:</span> {lastText.text}
                </p>
              </div>
            )}
            <label htmlFor="composer-text" className="sr-only">{MODES.find((m) => m.id === mode).label}</label>
            <textarea
              id="composer-text"
              autoFocus
              rows={4}
              readOnly={loading}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}
              placeholder={textMode.placeholder(firstName, whatsappName)}
              className="block min-h-[112px] w-full resize-y rounded-[14px] border border-border bg-slate-50 px-[15px] py-[13px] text-[14.5px] leading-[1.55] outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:bg-card focus-visible:anel-foco dark:bg-white/[0.03]"
            />
            {QUICK_TEXTS[mode] && (
              <div role="group" aria-label="Atalhos de texto" className="mt-2.5 flex flex-wrap gap-1.5">
                {QUICK_TEXTS[mode].map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={loading}
                    onClick={() => setDraft(appendQuickText(draft, q))}
                    className="h-7 rounded-full border border-border bg-card px-3 text-[12.5px] transition disabled:cursor-not-allowed disabled:opacity-60 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:anel-foco dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div role="status" className="mt-1.5 min-h-[18px] text-[12.5px] text-rose-700 dark:text-rose-300">{hint}</div>
            <div className="mt-2 flex items-center gap-2.5">
              <span className="flex min-w-0 flex-1 items-center gap-2 text-[12.5px] text-muted-foreground">
                <Avatar name={appUser?.name || 'Você'} size={22} />
                <span className="truncate">Registrando como {appUser?.name || 'você'}</span>
              </span>
              <span className="hidden text-[12px] text-muted-foreground sm:inline">Ctrl e Enter registram</span>
              <Btn kind="soft" onClick={tryClose} disabled={loading}>Cancelar</Btn>
              <Btn kind="brand" icon={<Check size={13} />} onClick={submit} disabled={loading}>{textMode.submit}</Btn>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
