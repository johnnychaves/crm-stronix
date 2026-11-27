import { forwardRef, Fragment, useEffect, useRef } from 'react';
import { Calendar, Check, ChevronDown, Clock, ExternalLink, MessageCircle, Phone, SkipForward, X } from 'lucide-react';
import { DAILY_GOAL_CATEGORIES as C, getLeadAppointmentDate } from '../../../lib/leads.js';
import { DG_CATEGORY_META } from '../../../lib/dailyGoal.js';
import { followUpChannelOf } from '../../../lib/contactGoal.js';
import { CATEGORY_ONE, zapProofText } from '../../../lib/metaFocoTexts.js';
import { FOCO_ESPERA } from '../../../lib/metaFocoCodes.js';
import { formatHourLabel } from '../../../lib/format.js';
import { firstName } from '../../../lib/guardian.js';
import { cn } from '../../../lib/utils.js';
import { LeadLink } from '../../nav/AppLink.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { StronizapBadge } from '../../brand/StronizapMark.jsx';
import { ContactPhone } from '../../profile/ContactPhone.jsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../ui/dropdown-menu.jsx';

// O bloco Agora da Meta, com a tarefa
// que o consultor está fazendo. Mostra por que ela está aqui, quem é, a última
// anotação, até quatro fatos e as ações da categoria. Só apresenta: quem grava
// são os handlers da DailyGoalView.
//
// Visita e aula: Compareceu e Não compareceu a qualquer hora, antes ou depois
// do horário, e o "Mais" com Remarcar e Cancelou (decisão do Johnny, 16/10/2026).
// Só a que já passou da hora mantém o WhatsApp, para falar com quem faltou. As
// outras tarefas têm o Reagendar (handleRescheduleTask), que é o único jeito
// de reagendar um Novo lead.
//
// A espera ("Respondeu, aguardando você") não tem ação de concluir: a
// resposta pelo Stronizap é que a tira da fila. Ela mostra só o pular e o
// "Abrir ficha". O botão que abre a conversa entra com o projeto Conversar.
//
// O menu "Mais" leva a chave da tarefa: quando o Agora troca de lead com ele
// aberto (o desfecho chegou por outra tela), o menu fecha, em vez de aplicar o
// Cancelou ao lead seguinte.

// O visual é o da Meta do professor (AgoraFalta, pedido do Johnny em
// 27/11/2026): cartão claro, com a borda da esquerda e o anel da foto na cor do
// motivo, e as ações em pílula. Antes era o bloco escuro do mockup B.
const TONE = {
  late: { pill: 'bg-rose-500/10 text-rose-700 dark:text-rose-300', edge: 'border-l-rose-500', ring: 'bg-rose-500' },
  now: { pill: 'bg-brand-500/10 text-brand-700 dark:text-brand-300', edge: 'border-l-brand-500', ring: 'bg-brand-500' },
  warn: { pill: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', edge: 'border-l-amber-500', ring: 'bg-amber-500' },
  calm: { pill: 'bg-slate-500/10 text-slate-600 dark:text-slate-300', edge: 'border-l-slate-400', ring: 'bg-slate-400' },
};

const RING = 'outline-none focus-visible:anel-foco';
const ACT = cn('inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-[13px] font-semibold whitespace-nowrap transition hover:border-brand-200 dark:hover:border-brand-700', RING);
const ACT_MAIN = 'border-brand-600 bg-brand-600 text-white hover:border-brand-700 hover:bg-brand-700 focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const TAG = 'rounded-full bg-muted px-2.5 py-0.5 text-[12px] font-semibold text-foreground/80';

// A tecla do atalho no botão (useAgoraShortcuts). Some no celular, onde não há
// teclado; para o leitor de tela o atalho vai no aria-keyshortcuts do botão.
const Kbd = ({ children }) => (
  <kbd aria-hidden="true" className="ml-0.5 hidden h-[18px] min-w-[18px] place-items-center rounded-[5px] border border-current px-[5px] font-sans text-[11px] font-semibold leading-none opacity-55 md:inline-grid">
    {children}
  </kbd>
);

export const AgoraCard = forwardRef(function AgoraCard(
  { entry, why, facts, frase, now, meId, pinned, retorno = false, onUnpin, onSkip, onOutcome, onReschedule, onPostpone, onGoalDone, onWhatsapp, onCall, onRetornoSim, onRetornoNao },
  ref
) {
  const { slug, lead } = entry;
  const tone = TONE[why.tone] || TONE.calm;
  // A pergunta da volta toma o lugar das ações, e o botão em que o foco estava
  // some: o foco vai para o "Sim".
  const simRef = useRef(null);
  useEffect(() => {
    if (retorno) simRef.current?.focus();
  }, [retorno]);
  const Icon = DG_CATEGORY_META[slug].Icon;
  const isAppt = slug === C.VISITA_HOJE || slug === C.AULA_HOJE;
  const espera = slug === FOCO_ESPERA;
  // A prova do contato de hoje pelo Stronizap (zapProofToday, de
  // computeDailyGoalSlots). Visita e aula não usam: o próximo passo é o desfecho.
  const prova = isAppt ? null : (lead.zapProofToday || null);
  const temProva = Boolean(prova);
  const provaRef = useRef(null);
  // A chave da tarefa da pergunta: o AgoraCard não tem key por tarefa, e a
  // pergunta aberta para um lead não pode levar o foco ao Concluir de outro.
  const perguntava = useRef(retorno ? entry.key : null);
  useEffect(() => {
    // A prova chegou com a pergunta na tela: o "Sim" sumiu com o foco, que vai
    // para o Concluir da faixa. Em efeito, porque ref não se escreve no render.
    const solto = !document.activeElement || document.activeElement === document.body;
    if (perguntava.current === entry.key && !retorno && temProva && solto) provaRef.current?.focus();
    perguntava.current = retorno ? entry.key : null;
  }, [retorno, temProva, entry.key]);
  const apptAt = isAppt ? getLeadAppointmentDate(lead) : null;
  const hora = isAppt ? apptAt : (slug === C.CONTATO_HOJE ? lead.nextFollowUp : null);
  const passou = Boolean(apptAt && apptAt < now);
  const note = String(lead.nextFollowUpNote || lead.observation || '').trim();
  const ligacao = followUpChannelOf(lead).type === 'Ligação';
  const cliente = slug === C.RENOVACAO || slug === C.VENCIDO;
  const sub = cliente ? lead.currentPlanName : lead.source;
  // Tarefa no lead de um colega: a visita ou a aula que este consultor agendou,
  // ou o contato que o dono passou para ele.
  const colega = lead.consultantId && lead.consultantId !== meId && lead.consultantName
    ? (isAppt ? `Lead de ${firstName(lead.consultantName)}` : `Contato passado por ${firstName(lead.consultantName)}`)
    : null;

  const whatsapp = (main) => (
    <button type="button" aria-keyshortcuts="W" className={cn(ACT, main ? ACT_MAIN : 'text-emerald-700 dark:text-emerald-300')} onClick={() => onWhatsapp(lead)}>
      <MessageCircle size={15} aria-hidden="true" /> WhatsApp <Kbd>W</Kbd>
    </button>
  );
  const ligar = (main) => (
    <button type="button" aria-keyshortcuts="L" className={cn(ACT, main && ACT_MAIN)} onClick={() => onCall(lead)}>
      <Phone size={15} aria-hidden="true" /> Ligar <Kbd>L</Kbd>
    </button>
  );

  return (
    <article
      ref={ref}
      tabIndex={-1}
      aria-label={`Agora: ${lead.name || 'lead sem nome'}`}
      className={cn('relative mt-3.5 scroll-mt-48 rounded-[18px] border border-l-[6px] border-border bg-card px-6 pb-4 pt-5 outline-none', tone.edge)}
    >
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
        <span className="text-[13px] font-semibold text-brand-700 dark:text-brand-300">Agora</span>
        <span className={cn('inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold', tone.pill)}>
          <Clock size={13} aria-hidden="true" /> {why.text}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Icon size={14} aria-hidden="true" />
          {CATEGORY_ONE[slug]}{hora ? ` às ${formatHourLabel(hora)}` : ''}
        </span>
        {colega && <span className={TAG}>{colega}</span>}
        {lead.hasOtherActivityToday && <span className={TAG}>Já interagido. Feche pela Meta</span>}
        {pinned && (
          <span className="ml-auto text-[12.5px] text-muted-foreground">
            Você escolheu esta tarefa.
            <button type="button" onClick={onUnpin} className={cn('ml-1 rounded font-semibold text-brand-700 underline underline-offset-[3px] dark:text-brand-300', RING)}>Voltar à ordem sugerida</button>
          </span>
        )}
      </div>

      <div className="mt-3.5 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-[18px] max-[560px]:grid-cols-1">
        <span className={cn('inline-grid self-start rounded-full p-[3px]', tone.ring)}>
          <Avatar name={lead.name} size={64} photoUrl={lead.photoUrl || null} />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em]">
            <LeadLink leadId={lead.id} draggable={false} tabIndex={-1} className="rounded underline-offset-4 hover:underline">
              {lead.name || 'Lead sem nome'}
            </LeadLink>
          </h2>
          {frase?.length > 0 && (
            <p className="mt-1.5 text-[17px] text-slate-700 dark:text-slate-200">
              {frase.map((p, i) => (typeof p === 'string'
                ? <Fragment key={i}>{p}</Fragment>
                : <b key={i} className={cn('num font-bold', p.u ? 'text-rose-700 dark:text-rose-300' : 'text-foreground')}>{p.b}</b>))}
            </p>
          )}
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
            <ContactPhone lead={lead} showName now={now} />
            {sub && <><span aria-hidden="true">·</span><span>{sub}</span></>}
          </p>
          {facts.length > 0 && (
            <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
              {facts.map(([k, v]) => (
                <div key={k} className="flex min-w-0 gap-1.5">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="min-w-0 break-words font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {note && (
            <p className="mt-3 max-w-[64ch] text-[14px] leading-relaxed text-slate-700 dark:text-slate-200">
              <small className="mr-1.5 text-[12.5px] text-muted-foreground">Sua última anotação:</small>
              {note}
            </p>
          )}
        </div>
      </div>

      {retorno ? (
        // Na volta do WhatsApp ou da ligação, a pergunta toma o lugar das ações.
        <div role="group" aria-label="Confirmar contato" className="mt-5 flex flex-wrap items-center gap-3 rounded-[14px] bg-muted px-4 py-3">
          <p className="mr-auto text-[14.5px] font-medium">Conversou com {firstName(lead.name) || 'o lead'}?</p>
          <button ref={simRef} type="button" aria-keyshortcuts="C" className={cn(ACT, ACT_MAIN)} onClick={onRetornoSim}>
            <Check size={15} aria-hidden="true" /> Sim, concluir <Kbd>C</Kbd>
          </button>
          <button type="button" className={ACT} onClick={onRetornoNao}>Ainda não</button>
        </div>
      ) : espera ? (
        // A espera vem antes da prova: ela não se conclui pelo Agora.
        <p className="mt-5 max-w-[64ch] border-t border-border pt-4 text-[14px] text-muted-foreground">
          Responda pelo Stronizap. A tarefa sai daqui quando a resposta chega.
        </p>
      ) : prova ? (
        // A prova toma o lugar da pergunta, e o Concluir é a ação principal.
        // shortcut: sem o "Ver conversa" até existir a rota que abre a conversa a partir do lead (projeto Conversar); ele entra na faixa, depois do Concluir.
        <>
          <div role="group" aria-label="Contato pelo Stronizap" className="mt-5 flex flex-wrap items-center gap-3 rounded-[14px] bg-emerald-500/10 px-4 py-3 text-emerald-800 dark:text-emerald-200">
            <p className="mr-auto flex min-w-0 items-center gap-2 text-[14.5px] font-medium">
              <Check size={15} aria-hidden="true" className="shrink-0 text-emerald-600 dark:text-emerald-300" />
              <span className="min-w-0 break-words">{zapProofText(prova, { id: meId })}</span>
              <StronizapBadge />
            </p>
            <button ref={provaRef} type="button" aria-keyshortcuts="C" className={cn(ACT, ACT_MAIN)} onClick={() => onGoalDone(lead, slug, '')}>
              <Check size={15} aria-hidden="true" /> Concluir <Kbd>C</Kbd>
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
            {ligacao ? ligar(false) : whatsapp(false)}
            {ligacao ? whatsapp(false) : ligar(false)}
            <button type="button" className={ACT} onClick={() => onPostpone(lead, slug)}>
              <Calendar size={15} aria-hidden="true" /> Reagendar
            </button>
          </div>
        </>
      ) : (
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {isAppt ? (
          <>
            <button type="button" aria-keyshortcuts="C" className={cn(ACT, ACT_MAIN)} onClick={() => onOutcome(lead, 'attended', slug)}>
              <Check size={15} aria-hidden="true" /> Compareceu <Kbd>C</Kbd>
            </button>
            <button type="button" aria-keyshortcuts="N" className={ACT} onClick={() => onOutcome(lead, 'no_show', slug)}>
              <X size={15} aria-hidden="true" /> Não compareceu <Kbd>N</Kbd>
            </button>
            {passou && whatsapp(false)}
            <DropdownMenu key={entry.key}>
              <DropdownMenuTrigger asChild>
                <button type="button" className={ACT}>Mais <ChevronDown size={14} aria-hidden="true" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[170px]">
                <DropdownMenuItem onSelect={() => onReschedule(lead, slug)}><Calendar size={15} aria-hidden="true" /> Remarcar</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onOutcome(lead, 'cancelled', slug)}><X size={15} aria-hidden="true" /> Cancelou</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <>
            {ligacao ? ligar(false) : whatsapp(false)}
            {ligacao ? whatsapp(false) : ligar(false)}
            <button type="button" aria-keyshortcuts="C" className={cn(ACT, ACT_MAIN)} onClick={() => onGoalDone(lead, slug, '')}>
              <Check size={15} aria-hidden="true" /> Concluir <Kbd>C</Kbd>
            </button>
            <button type="button" className={ACT} onClick={() => onPostpone(lead, slug)}>
              <Calendar size={15} aria-hidden="true" /> Reagendar
            </button>
          </>
        )}
      </div>
      )}

      <div className="mt-3.5 flex items-center gap-5">
        <button type="button" aria-keyshortcuts="S" onClick={onSkip} className={cn('inline-flex items-center gap-2 rounded px-0.5 py-0.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground', RING)}>
          <SkipForward size={15} aria-hidden="true" /> Pular por agora <Kbd>S</Kbd>
        </button>
        <LeadLink leadId={lead.id} draggable={false} className={cn('inline-flex items-center gap-2 rounded px-0.5 py-0.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground', RING)}>
          <ExternalLink size={14} aria-hidden="true" /> Abrir ficha
        </LeadLink>
      </div>
    </article>
  );
});
