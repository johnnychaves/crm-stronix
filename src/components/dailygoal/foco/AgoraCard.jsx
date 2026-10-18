import { forwardRef } from 'react';
import { Calendar, Check, ChevronDown, Clock, ExternalLink, MessageCircle, Phone, SkipForward, X } from 'lucide-react';
import { DAILY_GOAL_CATEGORIES as C, getLeadAppointmentDate } from '../../../lib/leads.js';
import { DG_CATEGORY_META } from '../../../lib/dailyGoal.js';
import { followUpChannelOf } from '../../../lib/contactGoal.js';
import { CATEGORY_ONE } from '../../../lib/metaFocoTexts.js';
import { formatHourLabel } from '../../../lib/format.js';
import { firstName } from '../../../lib/guardian.js';
import { cn } from '../../../lib/utils.js';
import { LeadLink } from '../../nav/AppLink.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { ContactPhone } from '../../profile/ContactPhone.jsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../ui/dropdown-menu.jsx';

// O bloco Agora da Meta nova (mockup B): o único bloco escuro da tela, com a
// tarefa que o consultor está fazendo. Mostra por que ela está aqui, quem é, a
// última anotação, até quatro fatos e as ações da categoria. Só apresenta: quem
// grava são os handlers da Meta, os mesmos da tela de hoje.
//
// Visita e aula: Compareceu e Não compareceu a qualquer hora, antes ou depois
// do horário, e o "Mais" com Remarcar e Cancelou (decisão do Johnny, 16/10/2026).
// Só a que já passou da hora mantém o WhatsApp, para falar com quem faltou. As
// outras tarefas têm o Reagendar do card de hoje (handleRescheduleTask), que é
// o único jeito de reagendar um Novo lead.
//
// O menu "Mais" leva a chave da tarefa: quando o Agora troca de lead com ele
// aberto (o desfecho chegou por outra tela), o menu fecha, em vez de aplicar o
// Cancelou ao lead seguinte.

const TONE = {
  late: 'bg-rose-500/25 text-[#FFC2CC]',
  now: 'bg-brand-500/35 text-[#D5E0FF]',
  warn: 'bg-amber-500/25 text-[#FFDDA0]',
  calm: 'bg-white/[0.12] text-white',
};

// Foco do teclado visível no fundo escuro.
const RING = 'outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 dark:focus-visible:ring-offset-ink-700';
const ACT = cn('inline-flex h-[46px] items-center gap-2 rounded-xl border border-white/25 px-[18px] text-[14.5px] font-semibold whitespace-nowrap text-white transition hover:bg-white/10', RING);
const ACT_MAIN = 'border-accent-500 bg-accent-500 text-ink-900 hover:border-accent-400 hover:bg-accent-400';
const TAG = 'rounded-full bg-white/[0.12] px-2.5 py-0.5 text-[12px] font-semibold text-white/85';

export const AgoraCard = forwardRef(function AgoraCard(
  { entry, why, facts, now, meId, pinned, onUnpin, onSkip, onOutcome, onReschedule, onPostpone, onGoalDone, onWhatsapp, onCall },
  ref
) {
  const { slug, lead } = entry;
  const Icon = DG_CATEGORY_META[slug].Icon;
  const isAppt = slug === C.VISITA_HOJE || slug === C.AULA_HOJE;
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
    <button type="button" className={cn(ACT, main && ACT_MAIN)} onClick={() => onWhatsapp(lead)}>
      <MessageCircle size={18} aria-hidden="true" /> WhatsApp
    </button>
  );
  const ligar = (main) => (
    <button type="button" className={cn(ACT, main && ACT_MAIN)} onClick={() => onCall(lead)}>
      <Phone size={18} aria-hidden="true" /> Ligar
    </button>
  );

  return (
    <article
      ref={ref}
      tabIndex={-1}
      aria-label={`Agora: ${lead.name || 'lead sem nome'}`}
      className="relative mt-3.5 scroll-mt-48 rounded-[22px] bg-ink-900 px-[30px] pb-5 pt-[26px] text-white shadow-[0_20px_44px_-26px_rgba(14,26,64,0.6)] outline-none dark:bg-ink-700 dark:ring-1 dark:ring-white/10"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn('inline-flex h-7 items-center gap-[7px] rounded-full px-3 text-[13px] font-semibold', TONE[why.tone])}>
          <Clock size={14} aria-hidden="true" /> {why.text}
        </span>
        <span className="inline-flex items-center gap-[7px] text-[13.5px] text-white/70">
          <Icon size={15} aria-hidden="true" />
          {CATEGORY_ONE[slug]}{hora ? ` às ${formatHourLabel(hora)}` : ''}
        </span>
        {colega && <span className={TAG}>{colega}</span>}
        {lead.hasOtherActivityToday && <span className={TAG}>Já interagido. Feche pela Meta</span>}
        {pinned && (
          <span className="ml-auto text-[12.5px] text-white/70">
            Você escolheu esta tarefa.
            <button type="button" onClick={onUnpin} className={cn('ml-1 rounded font-semibold text-white underline underline-offset-[3px]', RING)}>Voltar à ordem sugerida</button>
          </span>
        )}
      </div>

      <div className="mt-[22px] flex items-center gap-[18px]">
        <Avatar name={lead.name} size={64} photoUrl={lead.photoUrl || null} />
        <div className="min-w-0">
          <h2 className="font-display text-[36px] font-bold leading-[1.05] tracking-[-0.03em]">
            <LeadLink leadId={lead.id} draggable={false} tabIndex={-1} className="rounded underline-offset-4 hover:underline">
              {lead.name || 'Lead sem nome'}
            </LeadLink>
          </h2>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[14.5px] text-white/70 [&_.text-muted-foreground]:text-white/60">
            <ContactPhone lead={lead} showName now={now} />
            {sub && <><span aria-hidden="true">·</span><span>{sub}</span></>}
          </p>
        </div>
      </div>

      {note && (
        <p className="mt-5 max-w-[64ch] text-[15.5px] leading-relaxed text-white/90">
          <small className="mb-0.5 block text-[12.5px] text-white/55">Sua última anotação</small>
          {note}
        </p>
      )}

      {facts.length > 0 && (
        <dl className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-x-[26px] gap-y-3 border-t border-white/[0.14] pt-4">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[12.5px] text-white/55">{k}</dt>
              <dd className="mt-px text-[14.5px] font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        {isAppt ? (
          <>
            <button type="button" className={cn(ACT, ACT_MAIN)} onClick={() => onOutcome(lead, 'attended', slug)}>
              <Check size={18} aria-hidden="true" /> Compareceu
            </button>
            <button type="button" className={ACT} onClick={() => onOutcome(lead, 'no_show', slug)}>
              <X size={18} aria-hidden="true" /> Não compareceu
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
            {ligacao ? ligar(true) : whatsapp(true)}
            {ligacao ? whatsapp(false) : ligar(false)}
            <button type="button" className={ACT} onClick={() => onGoalDone(lead, slug, '')}>
              <Check size={18} aria-hidden="true" /> Concluir
            </button>
            <button type="button" className={ACT} onClick={() => onPostpone(lead, slug)}>
              <Calendar size={18} aria-hidden="true" /> Reagendar
            </button>
          </>
        )}
      </div>

      <div className="mt-5 flex items-center gap-5 border-t border-white/[0.12] pt-3.5">
        <button type="button" onClick={onSkip} className={cn('inline-flex items-center gap-2 rounded px-0.5 py-0.5 text-[13.5px] font-medium text-white/75 hover:text-white', RING)}>
          <SkipForward size={15} aria-hidden="true" /> Pular por agora
        </button>
        <LeadLink leadId={lead.id} draggable={false} className={cn('inline-flex items-center gap-2 rounded px-0.5 py-0.5 text-[13.5px] font-medium text-white/75 hover:text-white', RING)}>
          <ExternalLink size={14} aria-hidden="true" /> Abrir ficha
        </LeadLink>
      </div>
    </article>
  );
});
