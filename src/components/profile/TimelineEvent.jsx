import { ArrowRight, Ban, Calendar, CheckCircle, Circle, FileText, GraduationCap, Handshake, MessageCircle, Pencil, Phone, Route, Users } from 'lucide-react';
import { fmtBRL } from '../../lib/format.js';
import { ZAP_VIA } from '../../lib/leads.js';
import { getTone, phaseToneName } from '../../lib/leadState.js';
import {
  timelineStamp,
  timelineTypeLabel,
  contractEventOf,
  parseAppointment,
  extractStageNameFromInteractionText,
  isOwnerChangeText,
  ownerChangeText,
  zapScheduleTitle,
  appointmentOriginText,
} from '../../lib/timeline.js';
import { cn } from '../../lib/utils.js';
import { StronizapBadge } from '../brand/StronizapMark.jsx';
import { TimelineAuthor } from './TimelineAuthor.jsx';
import { ZapSignupMarker } from './ZapSignupMarker.jsx';

// Uma linha do registro da ficha, no desenho A2: o carimbo à esquerda, um nó
// numa régua vertical e, à direita, o tipo e o autor no cabeçalho com o corpo
// embaixo. A cor do feed só aparece no nó, no chip de fase, no selo do
// agendamento e na faixa de marco: o resto é neutro, senão vinte eventos viram
// um arco-íris. A leitura de cada evento é a que a LeadProfileView tinha
// (renderTimelineEvent), movida sem mudar.
//
// Props: i (a interação com _kind, de classifyInteraction), statuses (as etapas,
// para a cor dos chips), stageTransitions (de buildStageTransitions),
// outcomeOrigin (o agendamento que originou cada desfecho) e flash (o evento que
// o "Ver no histórico" do compositor acabou de abrir). O id de cada evento é
// `ev-<id da interação>`, e ele aceita o foco sem entrar no Tab, para o "Ver no
// histórico" levar o foco até ele.

// Eventos de contrato que ganham faixa de destaque: os que mudam a situação do
// cliente. Trancamento, reativação e correção seguem como linha comum.
const CONTRACT_MILESTONE_KINDS = new Set(['matricula', 'renovacao', 'cancelamento']);

const OUTCOME_SEALS = {
  attended: { label: 'Compareceu', className: 'bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-300' },
  no_show: { label: 'Faltou', className: 'bg-rose-500/[0.12] text-rose-700 dark:text-rose-300' },
  rescheduled: { label: 'Reagendado', className: 'bg-amber-500/[0.12] text-amber-700 dark:text-amber-300' },
  cancelled: { label: 'Cancelado', className: 'bg-slate-500/[0.12] text-slate-600 dark:text-slate-300' },
};

// Cores do nó, por extenso porque o Tailwind não enxerga nome montado.
const NODE = {
  slate: 'border-slate-300 text-slate-600 dark:border-white/20 dark:text-slate-300',
  green: 'border-emerald-300 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-300',
  brand: 'border-brand-300 text-brand-700 dark:border-brand-500/40 dark:text-brand-300',
  violet: 'border-violet-300 text-violet-700 dark:border-violet-500/40 dark:text-violet-300',
};

// O ícone e a cor do nó de cada tipo de evento.
function nodeOf(i, ownerChange) {
  if (i._kind === 'conversation') return /^📞/.test(String(i.text || '')) ? { Icon: Phone, tone: 'brand' } : { Icon: MessageCircle, tone: 'green' };
  if (i._kind === 'status') return { Icon: ownerChange ? Users : Route, tone: 'slate' };
  if (i._kind === 'appointment') return { Icon: Calendar, tone: 'violet' };
  if (i._kind === 'contract') return { Icon: FileText, tone: 'slate' };
  if (i._kind === 'referral') return { Icon: Handshake, tone: 'green' };
  if (i._kind === 'system') return { Icon: Circle, tone: 'slate' };
  return { Icon: Pencil, tone: 'slate' };
}

// Chip de etapa. A tinta sai do `hex` do tom (12% no fundo, 30% na borda do
// destino) e o texto nunca usa o passo 500, só o 700 e o 300.
function PhaseChip({ name, destination, statuses }) {
  const t = getTone(phaseToneName(name, statuses));
  return (
    <span
      className={cn(
        'inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[11px] font-semibold',
        destination ? cn('border', t.text, t.darkText) : 'text-slate-500 dark:text-slate-400'
      )}
      style={{ background: `${t.hex}1f`, ...(destination ? { borderColor: `${t.hex}4d` } : null) }}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: t.hex }} />
      {name}
    </span>
  );
}

export function TimelineEvent({ i, statuses, stageTransitions, outcomeOrigin, flash = false }) {
  // Marco de início do cadastro pelo Stronizap: régua com a pílula, fora do
  // padrão do nó. É o registro mais antigo do lead e fecha a linha do tempo.
  if (i._kind === 'origin') return <ZapSignupMarker interaction={i} />;

  // "28/09 14:32". O ano fica no bloco do mês.
  const stamp = timelineStamp(i.createdAt);
  const typeLabel = timelineTypeLabel(i);
  const author = i.consultantName || 'Sistema';
  // Agendamento feito pelo Stronizap: a marca antes do nome e o canal no
  // detalhe. Só a linha de agendamento leva isso: o campo via pode aparecer em
  // outras linhas.
  const zapTitle = i._kind === 'appointment' ? zapScheduleTitle(i) : null;
  const appt = i._kind === 'appointment' ? parseAppointment(i) : null;
  const stageName = i._kind === 'status' ? extractStageNameFromInteractionText(i.text) : '';
  // Troca de responsável: linha simples com o texto sem colchetes, nunca
  // mudança de fase nem perda (isOwnerChangeText, em lib/timeline.js).
  const ownerChange = i._kind === 'status' && isOwnerChangeText(i.text);
  // O evento de contrato vem do próprio texto: tipo, plano e valor dele, e não
  // os do contrato de hoje (contractEventOf, em lib/timeline.js).
  const contractEvent = i._kind === 'contract' ? contractEventOf(i.text) : null;
  const isContractMilestone = Boolean(contractEvent && CONTRACT_MILESTONE_KINDS.has(contractEvent.kind));
  const contractCancel = contractEvent?.kind === 'cancelamento';
  const lowerText = String(i.text || '').toLowerCase();
  // Perda: o status_change que encerra a oportunidade não traz etapa entre
  // colchetes, vem como "Lead perdido. Motivo: ...". Evento do funil Upgrade
  // nunca é perda de lead, mesmo que o motivo configurado diga "Perda de contato".
  const isLoss = i._kind === 'status' && !stageName && !ownerChange && !/^upgrade: /.test(lowerText) && /perdid|perda/i.test(lowerText);
  const isWin = i._kind === 'status' && /^venda$/i.test(stageName);

  // Corpo limpo: tira os prefixos que o compositor injeta (📲 e 📞 das
  // conversas, "Obs:" das notas, ✅, 🔄 e 🔔 dos eventos de sistema). O tipo no
  // cabeçalho já diz o que a linha é.
  const cleanBody = ownerChange ? ownerChangeText(i.text) : String(i.text || '')
    .replace(/^📲\s*Mensagem WhatsApp enviada:\s*/i, '')
    .replace(/^📞\s*Ligação:\s*/i, '')
    .replace(/^OBSERVAÇÃO DO CADASTRO:\s*/i, '')
    .replace(/^Obs:\s*/i, '')
    .replace(/^[✅🔄🔔]\s*/u, '')
    .trim();

  // ---- Faixa de marco (matrícula, venda, perda): largura inteira, régua no topo.
  if (isContractMilestone || isWin || isLoss) {
    const lossReason = isLoss ? (String(i.text || '').match(/motivo:\s*([^.·\n]+)/i)?.[1] || '').trim() : '';
    const band = contractCancel || isLoss
      ? { ring: 'border-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10', dot: 'bg-rose-500', Icon: Ban }
      : isWin
        ? { ring: 'border-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', dot: 'bg-emerald-500', Icon: CheckCircle }
        : { ring: 'border-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', dot: 'bg-emerald-500', Icon: GraduationCap };

    const title = isLoss
      ? `Oportunidade encerrada${lossReason ? ` · ${lossReason}` : ''}`
      : isWin
        ? 'Virou cliente, etapa Venda'
        : contractCancel
          ? (/^renova/i.test(cleanBody) ? 'Renovação cancelada' : 'Contrato cancelado')
          : contractEvent?.kind === 'renovacao' ? 'Contrato renovado'
            : (contractEvent?.planName || 'Matrícula fechada');

    const subtitle = isWin ? `Fase alterada por ${author}` : cleanBody;
    // Valor só na matrícula e na renovação, e o do próprio evento.
    const eventValue = isContractMilestone && !contractCancel ? contractEvent.value : null;

    return (
      <div
        id={`ev-${i.id}`}
        data-ev={i.id}
        tabIndex={-1}
        className={cn('my-1 flex items-center gap-3 border-t-2 px-3.5 py-2.5 outline-none focus-visible:anel-foco', band.ring, band.bg, flash && 'ring-2 ring-brand-300 dark:ring-brand-500/60')}
      >
        <span className={cn('grid size-[26px] shrink-0 place-items-center rounded-full text-white', band.dot)}>
          <band.Icon className="size-[13px]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold text-slate-900 dark:text-white" title={title}>{title}</div>
          {subtitle && <div className="truncate text-[12.5px] text-muted-foreground" title={subtitle}>{subtitle}</div>}
        </div>
        {eventValue != null && (
          <span className="num shrink-0 font-display text-[17px] font-bold text-emerald-700 dark:text-emerald-300">{fmtBRL(eventValue)}</span>
        )}
        <span className="num shrink-0 whitespace-nowrap text-[12px] text-muted-foreground" title={i.createdAt?.toLocaleString('pt-BR')}>{stamp}</span>
      </div>
    );
  }

  // ---- Corpo das variantes com nó.
  let body = null;
  let stageTone = null;

  if (i._kind === 'status' && stageName) {
    // Mudança de fase: dois chips e a duração na etapa anterior. O nó leva a
    // cor da etapa de destino.
    stageTone = getTone(phaseToneName(stageName, statuses));
    const t = stageTransitions[i.id] || {};
    const durationText = t.days == null
      ? null
      : t.fromCreation
        ? `após ${t.days}d desde o cadastro`
        : t.from ? `após ${t.days}d em ${t.from}` : null;
    body = (
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {t.from && (
          <>
            <PhaseChip name={t.from} destination={false} statuses={statuses} />
            <ArrowRight size={13} className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          </>
        )}
        <PhaseChip name={stageName} destination statuses={statuses} />
        {durationText && <span className="text-[12.5px] text-muted-foreground">{durationText}</span>}
      </div>
    );
  } else if ((appt && appt.when) || i.appointmentOutcome) {
    // Agendamento e desfecho dividem o cartão. O selo sai do campo real
    // appointmentOutcome quando existe; o agendamento sem desfecho fica em
    // "Agendado".
    const outcome = OUTCOME_SEALS[i.appointmentOutcome]
      || { label: 'Agendado', className: 'bg-brand-500/[0.12] text-brand-700 dark:text-brand-300' };
    const isDone = Boolean(i.appointmentOutcome);
    // No desfecho não há data no texto: a régua é o próprio evento.
    const when = (appt && appt.when) || i.createdAt;
    const title = appt?.label || cleanBody || 'Agendamento';
    // "Tarefa de <nome>" quando a tarefa do dia ficou com outra pessoa (o
    // " · tarefa de" do texto, lido pelo parseAppointment): é por aqui que o
    // dono do lead vê quem vai cuidar da visita, da aula ou do contato.
    const detail = appt
      ? [appt.location, appt.taskOwner && `Tarefa de ${appt.taskOwner}`, appt.note, when.toLocaleDateString('pt-BR', { weekday: 'long' })].filter(Boolean).join(' · ')
      : when.toLocaleDateString('pt-BR', { weekday: 'long' });
    const origin = outcomeOrigin[i.id];
    body = (
      <>
        <div className="mt-1.5 flex max-w-[560px] items-center gap-3 rounded-[14px] border border-border bg-card py-2.5 pl-2.5 pr-3.5">
          <div className="w-[42px] flex-none text-center">
            <div className={cn('num font-display text-[20px] font-bold leading-none', isDone ? 'text-emerald-700 dark:text-emerald-300' : 'text-violet-700 dark:text-violet-300')}>
              {String(when.getDate()).padStart(2, '0')}
            </div>
            <div className="mt-[3px] text-[11.5px] text-muted-foreground">{when.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}</div>
          </div>
          <div className="w-px self-stretch bg-border" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="truncate text-[13.5px] font-semibold">{title}</span>
              <span className="num shrink-0 text-[12px] text-muted-foreground">{when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="truncate text-[12.5px] text-muted-foreground">{detail}</div>
          </div>
          <span className={cn('inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold', outcome.className)}>{outcome.label}</span>
        </div>
        {/* O desfecho aponta de volta para o agendamento que o originou. */}
        {origin && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            {origin.via === ZAP_VIA && <StronizapBadge />}
            <span>{appointmentOriginText(origin)}</span>
          </div>
        )}
      </>
    );
  } else if (cleanBody) {
    // Linha simples: nota, conversa, sistema.
    body = (
      <div>
        <p className={cn('mt-0.5 max-w-[72ch] whitespace-pre-wrap text-pretty leading-[1.55]', i._kind === 'system' ? 'text-[13px] text-muted-foreground' : 'text-[14px] text-slate-700 dark:text-slate-200')}>{cleanBody}</p>
        {i.pinned && <div className="mt-0.5 text-[12px] text-muted-foreground">Anotação fixada</div>}
      </div>
    );
  }

  if (!body) return null;

  const node = nodeOf(i, ownerChange);
  return (
    <article
      id={`ev-${i.id}`}
      data-ev={i.id}
      tabIndex={-1}
      className={cn(
        'group/ev relative grid grid-cols-[68px_30px_minmax(0,1fr)] gap-x-3.5 rounded-xl py-2.5 pr-2 outline-none transition-colors motion-reduce:transition-none focus-visible:anel-foco',
        flash ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-slate-50/70 dark:hover:bg-white/[0.02]'
      )}
    >
      {/* A régua, em dois trechos, que param 4 px antes do nó e emendam com
          os do vizinho. O primeiro evento do mês não tem o de cima, e o último
          não tem o de baixo. */}
      <span aria-hidden="true" className="absolute left-[96px] top-0 h-1.5 w-0.5 bg-border group-first-of-type/ev:hidden" />
      <span aria-hidden="true" className="absolute bottom-0 left-[96px] top-11 w-0.5 bg-border group-last-of-type/ev:hidden" />
      <div className="num pt-px text-right text-[12.5px] leading-tight text-muted-foreground" title={i.createdAt?.toLocaleString('pt-BR')}>{stamp}</div>
      <div
        className={cn('relative grid size-[30px] place-items-center rounded-full border-[1.5px] bg-card', NODE[node.tone])}
        style={stageTone ? { borderColor: `${stageTone.hex}61`, color: stageTone.hex } : undefined}
      >
        <node.Icon size={14} aria-hidden="true" />
      </div>
      <div className="min-w-0 pt-[3px]">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[13.5px] font-semibold">{typeLabel}</span>
          <div className="min-w-0 max-w-[220px]">
            <TimelineAuthor author={author} zapTitle={zapTitle} />
          </div>
        </div>
        {body}
      </div>
    </article>
  );
}
