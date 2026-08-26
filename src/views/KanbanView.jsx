import { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react';
import { serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { canEditLead, isConvertedStatusName } from '../lib/leads.js';
import { logInteraction } from '../lib/interactions.js';
import { withBucket } from '../lib/leadDerived.js';
import { getSafeDateOrNull } from '../lib/dates.js';
import { getDefaultFunnel, isItemInFunnel } from '../lib/funnels.js';
import { buildInteractionIndex, lastInteractionDateOf } from '../lib/leadStatus.js';
import { usePagedLeads } from '../hooks/usePagedLeads.js';
import { useRenewalBoard } from '../hooks/useRenewalBoard.js';
import { getExpiredFunnel, splitExpiredForBoard } from '../lib/expiredFunnel.js';
import { getRenewalFunnel, renewalColumnsFromCheckpoints, splitRenewalForBoard } from '../lib/renewalFunnel.js';
import { renewalDecline, daysToExpiryOf } from '../lib/renewalGoal.js';
import { useFunnelCounts } from '../hooks/useFunnelCounts.js';
import { bucketByFunnelQuerySpec, wonInMonthQuerySpec, LIFECYCLE_BUCKETS, expiredClientsQuerySpec } from '../lib/leadQueries.js';
import { LEADS_PATH, appId } from '../lib/firebase.js';
import { fmtBRL } from '../lib/format.js';
import { filterKanbanLeads, partitionLeadsByStatus, getKanbanColumnAccent, getKanbanAvatarPalette, getKanbanInitials, fmtKanbanRelDate, fmtKanbanRelDateTime, KANBAN_PAGE_SIZE, kanbanSilence, monthWindow, defaultRespFilterFor, isDefaultRespFilter } from '../lib/kanban.js';
import { markConvertingAula, unmarkConvertedAula } from '../lib/aulasWrites.js';
import { cn } from '@/lib/utils';
import { useToast } from '../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { FollowUpIcon } from '../components/ui/Badges.jsx';
import { useLeadProfile } from '../contexts/LeadProfileContext.jsx';
import { LossReasonModal } from '../modals/LossReasonModal.jsx';
import { ContractModal } from '../modals/ContractModal.jsx';
import { AlertCircle, ArrowRightLeft, ArrowUpRight, Ban, Check, CheckCircle, SlidersHorizontal, TrendingUp, Users } from 'lucide-react';
import { FunnelTabs } from '../components/layout/FunnelTabs.jsx';

// Avatar de iniciais compacto (card 22px / bubble 24px). O KanbanAvatar
// derivaria a fonte do tamanho; o protótipo fixa 9px/9.5px weight 700.
function InitialsAvatar({ name = '', size = 22, textSize = 9 }) {
  const [bg, fg, fgDark] = getKanbanAvatarPalette(name);
  return (
    <span
      className="rounded-full grid place-items-center font-bold shrink-0 [color:var(--ka-fg)] dark:[color:var(--ka-fg-dark)]"
      style={{ width: size, height: size, background: bg, fontSize: textSize, '--ka-fg': fg, '--ka-fg-dark': fgDark || fg }}
    >
      {getKanbanInitials(name)}
    </span>
  );
}

// --- Card do Kanban: leitura do lead → o que a ficha mostra -----------------

// Etiqueta da linha 1. Só aparece quando informa algo: agendado para amanhã ou
// semana que vem não é notícia, então não leva selo.
function cardBadge({ isWon, isLost, isOverdue, isToday, hasFollowUp, renewalDaysLeft }) {
  // Card do funil Renovações: o que importa é o relógio do contrato, não o
  // follow-up. Quanto menos tempo sobra, mais quente a etiqueta.
  if (Number.isFinite(renewalDaysLeft)) {
    const tom = renewalDaysLeft <= 7
      ? 'bg-rose-500/[0.07] text-[#E11D48] dark:text-rose-400'
      : renewalDaysLeft <= 30
        ? 'bg-amber-500/10 text-[#B45309] dark:text-amber-300'
        : 'bg-[#EAF0FF] text-[#1C3FC4] dark:bg-brand-500/15 dark:text-brand-300';
    // <= 0 pega os três casos do último dia de uma vez: o -0 do contrato que
    // vence mais cedo hoje, o 0 redondo, e o negativo da aba aberta desde antes
    // do vencimento. "Vence em 0d" não é como uma pessoa fala.
    const label = renewalDaysLeft <= 0 ? 'Vence hoje' : `Vence em ${renewalDaysLeft}d`;
    return { label, className: tom };
  }
  if (isWon) return { label: 'Matriculado', className: 'bg-emerald-500/[0.08] text-[#0F9D6E] dark:text-emerald-300' };
  if (isLost) return { label: 'Perdido', className: 'bg-[#eef0f5] text-slate-500 dark:bg-white/[0.06] dark:text-neutral-400' };
  if (isOverdue) return { label: 'Atrasado', className: 'bg-rose-500/[0.07] text-[#E11D48] dark:text-rose-400' };
  if (isToday) return { label: 'Hoje', className: 'bg-[#EAF0FF] text-[#1C3FC4] dark:bg-brand-500/15 dark:text-brand-300' };
  if (!hasFollowUp) return { label: 'Sem agenda', className: 'bg-amber-500/10 text-[#B45309] dark:text-amber-300' };
  return null;
}

// "ontem 15:30" — o "·" da linha de compromisso separa o TIPO da data, então a
// data em si não leva outro (fmtKanbanRelDateTime traria um no meio).
const relWhen = (dt) =>
  `${fmtKanbanRelDate(dt).toLowerCase()} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

// Rótulo curto do tipo de follow-up, casando com os ícones de FollowUpIcon.
const followUpLabel = (type) => {
  if (type === 'Ligação') return 'Ligação';
  if (type === 'Presencial' || type === 'Visita') return 'Visita';
  if (type === 'Aula Experimental' || type === 'Aula experimental') return 'Aula';
  return 'Mensagem';
};

// Cor do bloco de compromisso e do rodapé — é o que faz uma coluna cheia de
// atrasados aparecer como bloco, em vez de card a card.
const COMMITMENT_TONE = {
  overdue: 'text-[#E11D48] dark:text-rose-400',
  none: 'text-[#B45309] dark:text-amber-400',
  today: 'text-[#1C3FC4] dark:text-brand-300',
  won: 'text-[#0F9D6E] dark:text-emerald-300',
  normal: 'text-slate-700 dark:text-neutral-300'
};
const FOOTER_TONE = {
  overdue: 'bg-rose-500/[0.07]',
  none: 'bg-amber-500/10',
  won: 'bg-emerald-500/[0.08]',
  normal: 'bg-slate-50 dark:bg-white/[0.03]'
};
const SILENCE_TONE = {
  muted: 'text-slate-400 dark:text-neutral-500',
  warn: 'text-[#B45309] dark:text-amber-400',
  cold: 'text-slate-500 dark:text-neutral-400'
};

// Prop estável para colunas sem leads (ver getLeadsByStatus).
const EMPTY_LEADS = [];

// Buckets contados pelo useFunnelCounts (identidade estável entre renders).
const PERDA_BUCKETS = [LIFECYCLE_BUCKETS.PERDA];

// Ficha de 115px: nome + etiqueta, compromisso, chips de contexto e um rodapé
// que mede SILÊNCIO (dias sem contato). Anatomia uniforme — todo card tem as
// mesmas linhas, o que muda é a cor.
// React.memo: durante o drag só o card arrastado muda de prop (isDragging);
// os demais não re-renderizam. Handlers vêm estáveis (useCallback) do pai.
const KanbanCard = memo(function KanbanCard({ lead, columnColor, isDragging, lastDate, onDragStart, onDragEnd, onOpenProfile, onMoveRequest }) {
  const isWon = lead.status === 'Venda';
  const isLost = lead.status === 'Perda';
  const hasFollowUp = lead.nextFollowUp instanceof Date && !isNaN(lead.nextFollowUp.getTime());
  const now = new Date();
  const isOverdue = !isWon && !isLost && hasFollowUp && lead.nextFollowUp < now;
  const isToday = !isWon && !isLost && hasFollowUp && !isOverdue &&
    lead.nextFollowUp.toDateString() === now.toDateString();
  const accent = getKanbanColumnAccent(columnColor);
  const convertedAt = getSafeDateOrNull(lead.convertedAt);

  // Card projetado do funil Renovações: dias até vencer e se o marco daquela
  // coluna já foi tratado (a Meta grava isso em renewalHandledCheckpoints).
  const renewalDaysLeft = lead._renewalCard
    ? daysToExpiryOf(lead.currentContractEndsAt, now)
    : null;
  const marcoTratado = Boolean(
    lead._renewalCard &&
    Array.isArray(lead.renewalHandledCheckpoints) &&
    lead.renewalHandledCheckpoints.includes(lead._renewalDays)
  );

  const badge = cardBadge({ isWon, isLost, isOverdue, isToday, hasFollowUp, renewalDaysLeft });
  const tone = isWon ? 'won' : isLost ? 'normal' : isOverdue ? 'overdue' : !hasFollowUp ? 'none' : isToday ? 'today' : 'normal';
  const footerTone = isWon ? 'won' : isLost ? 'normal' : isOverdue ? 'overdue' : !hasFollowUp ? 'none' : 'normal';
  const silence = kanbanSilence(lastDate, now);

  // Chips de contexto: contorno e não preenchimento — são contexto, não status.
  const chips = [lead.source, lead.modalidade || lead.appointmentModality || lead.dor].filter(Boolean);
  // Valor do plano fechado; sem valor, o rodapé cai no silêncio como os demais.
  const wonValue = isWon && lead.currentContractValue != null && Number.isFinite(Number(lead.currentContractValue))
    ? fmtBRL(lead.currentContractValue)
    : null;

  return (
    <article
      data-no-pan="true"
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onDragEnd={onDragEnd}
      onClick={() => onOpenProfile(lead.id)}
      className={cn(
        // shrink-0: sem isto o card (filho flex do container flex-col da coluna)
        // encolhe verticalmente pra caber quando a lista cresce, em vez de a
        // coluna rolar — é o bug dos cards "espremidos".
        'group relative shrink-0 rounded-[10px] bg-white dark:bg-neutral-900 border overflow-hidden cursor-grab active:cursor-grabbing transition-[border-color,box-shadow]',
        isDragging
          ? 'border-2 border-brand-600 shadow-[0_14px_30px_-12px_rgba(15,23,42,.35)] z-50'
          : 'border-[#e8ecf3] dark:border-neutral-800 hover:border-[#C9D6FF] dark:hover:border-brand-500/45 hover:shadow-[0_10px_24px_-10px_rgba(15,23,42,.22)]',
        isLost && !isDragging && 'opacity-[.72]'
      )}
    >
      <div className="px-[11px] pt-2.5 pb-[9px]">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="size-1.5 rounded-full shrink-0" style={{ background: accent.border }} />
          {/* O nome NUNCA muda de cor: é identidade. Urgência é trabalho da
              etiqueta e do rodapé. */}
          <span
            className={cn('flex-1 min-w-0 truncate text-[13.5px] font-semibold leading-[1.3]',
              isLost ? 'text-slate-700 dark:text-neutral-300' : 'text-gray-900 dark:text-white')}
            title={lead.name}
          >
            {lead.name}
          </span>
          {badge && (
            <span className={cn(
              'shrink-0 h-[17px] px-1.5 rounded-[5px] inline-flex items-center text-[9.5px] font-bold uppercase tracking-[.05em] whitespace-nowrap',
              badge.className
            )}>
              {badge.label}
            </span>
          )}
        </div>

        <div className={cn('mt-1 flex items-center gap-[5px] text-[11.5px] font-semibold', COMMITMENT_TONE[tone])}>
          {lead._renewalCard ? (
            marcoTratado ? (
              <>
                <Check className="size-[11px] shrink-0" strokeWidth={2.2} />
                <span className="truncate">Marco de {lead._renewalDays} dias tratado</span>
              </>
            ) : (
              <>
                <AlertCircle className="size-[11px] shrink-0" strokeWidth={2.2} />
                <span className="truncate">Aguardando contato</span>
              </>
            )
          ) : isWon ? (
            <>
              <CheckCircle className="size-[11px] shrink-0" strokeWidth={2.2} />
              <span className="truncate tabular-nums">
                {convertedAt ? `Fechou ${fmtKanbanRelDateTime(convertedAt).toLowerCase()}` : 'Matriculado'}
              </span>
            </>
          ) : isLost ? (
            <>
              <Ban className="size-[11px] shrink-0" strokeWidth={2.2} />
              <span className="truncate" title={lead.lossReason || 'Perdido'}>{lead.lossReason || 'Perdido'}</span>
            </>
          ) : hasFollowUp ? (
            <>
              <FollowUpIcon type={lead.nextFollowUpType} className="size-[11px] shrink-0" />
              <span className="truncate tabular-nums">
                {followUpLabel(lead.nextFollowUpType)} · {relWhen(lead.nextFollowUp)}
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="size-[11px] shrink-0" strokeWidth={2.2} />
              <span className="truncate">Sem agendamento</span>
            </>
          )}
        </div>

        {chips.length > 0 && (
          <div className="mt-2 flex items-center gap-1">
            {chips.map((c) => (
              <span
                key={c}
                title={c}
                className="h-[19px] px-[7px] inline-flex items-center rounded-md border border-[#e8ecf3] dark:border-neutral-800 text-[10.5px] text-slate-700 dark:text-neutral-300 max-w-[112px] truncate"
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className={cn(
        'flex items-center gap-1.5 border-t border-[#e8ecf3] dark:border-neutral-800 px-[11px] py-1.5 text-[11px]',
        FOOTER_TONE[footerTone]
      )}>
        {lead.consultantName && <InitialsAvatar name={lead.consultantName} size={17} textSize={8} />}
        <span className="flex-1 min-w-0 truncate text-slate-500 dark:text-neutral-400" title={lead.consultantName ? `Consultor: ${lead.consultantName}` : undefined}>
          {lead.consultantName || 'Sem responsável'}
        </span>

        {/* Ações no rodapé — nunca sobrepostas ao conteúdo. No hover cedem o
            espaço do nome; em telas de toque ficam sempre visíveis. */}
        <span className="shrink-0 hidden group-hover:flex group-focus-within:flex pointer-coarse:flex items-center gap-0.5">
          <button
            type="button"
            data-no-pan="true"
            onClick={(e) => { e.stopPropagation(); onMoveRequest(lead); }}
            title="Mover para outra etapa"
            aria-label="Mover lead para outra etapa"
            className="size-[25px] grid place-items-center rounded-[7px] text-slate-400 hover:bg-[#EAF0FF] hover:text-brand-600 dark:hover:bg-brand-500/15 dark:hover:text-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 transition-colors"
          >
            <ArrowRightLeft className="size-3" />
          </button>
          <button
            type="button"
            data-no-pan="true"
            onClick={(e) => { e.stopPropagation(); onOpenProfile(lead.id); }}
            title="Abrir perfil"
            aria-label="Abrir perfil do lead"
            className="size-[25px] grid place-items-center rounded-[7px] text-slate-400 hover:bg-[#EAF0FF] hover:text-brand-600 dark:hover:bg-brand-500/15 dark:hover:text-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 transition-colors"
          >
            <ArrowUpRight className="size-3" />
          </button>
        </span>

        <span className={cn(
          'shrink-0 font-semibold tabular-nums group-hover:hidden group-focus-within:hidden pointer-coarse:hidden',
          wonValue ? 'text-[#0F9D6E] dark:text-emerald-300' : SILENCE_TONE[silence.tone]
        )}>
          {wonValue || silence.text}
        </span>
      </div>
    </article>
  );
});

// Coluna densa: sem card de fundo — header com régua na cor da etapa,
// cards em lista compacta com scroll interno. React.memo: o hover do drag
// (draggedOverColumn) re-renderiza SÓ as 2 colunas afetadas via isHovered.
const KanbanColumn = memo(function KanbanColumn({
  name, color, special, columnLeads, note = null, isHovered, totalCount = null,
  draggingLeadId, interactionIndex, hasMore = false, onLoadMore = null, loadingMore = false,
  onColumnDragOver, onColumnDragLeave, onDropLead,
  onDragStart, onDragEnd, onOpenProfile, onMoveRequest,
}) {
  const accent = getKanbanColumnAccent(color);
  const isWinCol = special === 'win';
  const isLossCol = special === 'loss';
  // Paginação da coluna: 10 por vez. Renderizar a lista inteira enche uma
  // coluna de 264px que ninguém rola até o fim — e, nas terminais, trava o
  // board. "Carregar mais" revela os próximos 10 do que já está em memória;
  // quando acaba, cede a vez ao onLoadMore (que busca a próxima página no
  // Firestore, hoje só na coluna Perda).
  const [visibleCount, setVisibleCount] = useState(KANBAN_PAGE_SIZE);
  const shownLeads = columnLeads.length > visibleCount ? columnLeads.slice(0, visibleCount) : columnLeads;
  const localHasMore = columnLeads.length > shownLeads.length;
  const emptyText = isWinCol
    ? (isHovered ? 'Soltar aqui' : 'Nenhuma venda no mês')
    : isLossCol
      ? 'Arraste para marcar perda'
      : isHovered
        ? 'Soltar aqui'
        : 'Sem leads';

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault();
        onColumnDragOver(name);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        onColumnDragLeave(name);
      }}
      onDrop={(e) => onDropLead(e, name, special)}
      className={cn(
        'w-[264px] shrink-0 flex flex-col max-h-full rounded-xl transition-colors',
        isHovered && 'bg-brand-50/60 dark:bg-brand-500/[0.06] ring-2 ring-brand-100 dark:ring-brand-500/30'
      )}
    >
      <header
        className="px-0.5 pb-3 mb-3 flex items-center gap-2 border-b-2 shrink-0"
        style={{ borderBottomColor: accent.border }}
      >
        <h3
          className="text-[12px] font-bold uppercase tracking-[.05em] text-gray-700 dark:text-neutral-200 whitespace-nowrap truncate"
          title={name}
        >
          {name}
        </h3>
        <span className="text-[11px] font-semibold text-slate-400 dark:text-neutral-500 tabular-nums shrink-0">
          {totalCount != null ? totalCount : columnLeads.length}
        </span>
        {note && (
          <span className="text-[10.5px] font-medium text-slate-400 dark:text-neutral-500 truncate normal-case" title={note}>
            {note}
          </span>
        )}
        {isWinCol && <TrendingUp className="ml-auto size-[13px] shrink-0 text-emerald-700 dark:text-emerald-400" />}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pb-2 custom-scrollbar">
        {columnLeads.length === 0 ? (
          <div
            className={cn(
              // 115px = a altura do card, pra não haver salto ao soltar.
              'min-h-[115px] rounded-[10px] border-2 border-dashed grid place-items-center text-[10.5px] font-semibold uppercase tracking-[.06em] text-center px-3 transition-colors',
              isHovered
                ? 'border-brand-300 text-brand-600 dark:border-brand-500/40 dark:text-brand-300'
                : 'border-slate-300 text-slate-400 dark:border-neutral-700 dark:text-neutral-500'
            )}
          >
            {emptyText}
          </div>
        ) : (
          <>
            {shownLeads.map(lead => (
              <KanbanCard
                key={lead.id}
                lead={lead}
                columnColor={color}
                isDragging={draggingLeadId === lead.id}
                lastDate={lastInteractionDateOf(lead, interactionIndex)}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onOpenProfile={onOpenProfile}
                onMoveRequest={onMoveRequest}
              />
            ))}
            {localHasMore ? (
              <button
                type="button"
                onClick={() => setVisibleCount(v => v + KANBAN_PAGE_SIZE)}
                className="mt-0.5 py-2 text-center text-[11px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
              >
                Carregar mais <span className="tabular-nums font-normal text-slate-400 dark:text-neutral-500">({columnLeads.length - shownLeads.length})</span>
              </button>
            ) : onLoadMore && hasMore ? (
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="mt-0.5 py-2 text-center text-[11px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 disabled:opacity-50 transition-colors"
              >
                {loadingMore ? 'Carregando…' : 'Carregar mais'}
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
});

function KanbanView({ leads, interactions, appUser, statuses, usersList, lossReasons, db, funnels, selectedFunnelId, setSelectedFunnelId }) {
  const toast = useToast();
  const { openProfile } = useLeadProfile();
  const [moveLead, setMoveLead] = useState(null); // lead com o menu "Mover" aberto (toque/teclado)
  // Filtro de responsáveis multi-seleção: conjunto vazio = toda a equipe. Abre
  // na carteira do próprio consultor (o gestor abre na equipe inteira) e daí em
  // diante é ele quem manda — regra em lib/kanban.js.
  const [respFilter, setRespFilter] = useState(() => defaultRespFilterFor(appUser));
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [lossModalLeadId, setLossModalLeadId] = useState(null);
  // Lead aguardando matrícula no ContractModal (caminho de Venda do Kanban).
  const [matriculaLead, setMatriculaLead] = useState(null);
  const [draggingLeadId, setDraggingLeadId] = useState(null);
  const [draggedOverColumn, setDraggedOverColumn] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const kanbanScrollRef = useRef(null);
const dragScrollRef = useRef({
  isDown: false,
  startX: 0,
  scrollLeft: 0
});
const [isPanning, setIsPanning] = useState(false);

  const defaultFunnelId = useMemo(() => getDefaultFunnel(funnels)?.id || null, [funnels]);

  const funnelLeads = useMemo(
    () => (leads || []).filter(l => isItemInFunnel(l, selectedFunnelId, defaultFunnelId)),
    [leads, selectedFunnelId, defaultFunnelId]
  );

  // Recorte do board extraído p/ lib/kanban.js (clientes/convertidos saem;
  // filtros de responsável e atraso) — coberto por teste de caracterização.
  // FUNIL VENCIDOS (funil de sistema): cliente com contrato vencido, carregado
  // por query própria e SÓ quando a aba está aberta — quem nunca abrir não paga
  // leitura. Regra e projeção em lib/expiredFunnel.js.
  const expiredFunnel = useMemo(() => getExpiredFunnel(funnels), [funnels]);
  const isExpiredView = Boolean(expiredFunnel && selectedFunnelId === expiredFunnel.id);
  // Corte do "venceu": fixado uma vez na montagem. useState com inicializador
  // roda fora do render, então não fere a pureza — e um contrato que vence no
  // meio da sessão é caso de borda que o próximo carregamento resolve.
  const [expiredCutoffMs] = useState(() => Date.now());
  const expiredSpec = useMemo(
    () => (isExpiredView ? expiredClientsQuerySpec(expiredCutoffMs, KANBAN_PAGE_SIZE) : null),
    [isExpiredView, expiredCutoffMs]
  );
  const {
    items: expiredDocs, hasMore: expiredHasMore, loadMore: expiredLoadMore,
  } = usePagedLeads({
    db, path: LEADS_PATH, spec: expiredSpec, specKey: `vencidos:${isExpiredView ? '1' : '0'}`,
    enabled: !!db && isExpiredView,
  });
  // O status EXIBIDO vira o nome da etapa derivada (o real continua 'Venda').
  // O respFilter continua valendo; onlyOverdue não faz sentido aqui (cliente
  // vencido não tem follow-up de prospecção), então é ignorado.
  // Divide entre as ETAPAS e a coluna PERDA: quem recusou (renewalDeclined) vai
  // para a Perda, que o board já renderiza em todo funil. Ele continua CLIENTE —
  // muda só onde o card aparece, nunca o lifecycleBucket.
  const expiredSplit = useMemo(() => {
    if (!isExpiredView) return { cards: EMPTY_LEADS, declined: EMPTY_LEADS };
    const { cards, declined } = splitExpiredForBoard(expiredDocs || [], statuses, expiredFunnel?.id);
    if (respFilter.length === 0) return { cards, declined };
    const meu = (l) => respFilter.includes(l.consultantId);
    return { cards: cards.filter(meu), declined: declined.filter(meu) };
  }, [isExpiredView, expiredDocs, statuses, expiredFunnel, respFilter]);
  const expiredLeads = expiredSplit.cards;

  // FUNIL RENOVAÇÕES (funil de sistema): cliente cujo contrato entrou na janela
  // dos marcos. Mesmo molde do Vencidos — projeção em memória, o status real
  // continua 'Venda' — com uma diferença: as COLUNAS são virtuais, derivadas
  // dos marcos da config, e ninguém arrasta entre elas. Regras em
  // lib/renewalFunnel.js.
  const { renewalCheckpoints } = useGeneralConfig();
  const renewalFunnel = useMemo(() => getRenewalFunnel(funnels), [funnels]);
  const isRenewalView = Boolean(renewalFunnel && selectedFunnelId === renewalFunnel.id);
  const renewalColumns = useMemo(
    // `[]` literal é estável aqui porque está dentro do useMemo (EMPTY_LEADS é
    // para leads e o nome mentiria).
    () => (isRenewalView ? renewalColumnsFromCheckpoints(renewalCheckpoints) : []),
    [isRenewalView, renewalCheckpoints]
  );
  // Mesmo corte do Vencidos, fixado uma vez na montagem: os dois boards partem o
  // eixo no MESMO ponto, senão um cliente aparece nos dois ou some dos dois.
  const {
    pages: renewalPages, hasMore: renewalHasMore, loadMore: renewalLoadMore,
    reload: renewalReload, patchLead: renewalPatchLead,
  } = useRenewalBoard({
    db, columns: renewalColumns, cutoffMs: expiredCutoffMs,
    pageSize: KANBAN_PAGE_SIZE, enabled: !!db && isRenewalView,
  });
  // Mesmo recorte do Vencidos: o respFilter continua valendo, mas onlyOverdue é
  // ignorado — cliente em renovação não tem follow-up de prospecção, então o
  // filtro não se aplica às colunas de marco nem à Perda daqui. Com ele ligado o
  // que muda na tela é só a coluna Venda, que tem fonte própria (wonLeads).
  const renewalSplit = useMemo(() => {
    if (!isRenewalView) return { cardsByColumn: new Map(), declined: EMPTY_LEADS };
    const { cardsByColumn, declined } = splitRenewalForBoard(renewalPages, renewalColumns);
    if (respFilter.length === 0) return { cardsByColumn, declined };
    const meu = (l) => respFilter.includes(l.consultantId);
    const filtrado = new Map();
    cardsByColumn.forEach((cards, nome) => filtrado.set(nome, cards.filter(meu)));
    return { cardsByColumn: filtrado, declined: declined.filter(meu) };
  }, [isRenewalView, renewalPages, renewalColumns, respFilter]);

  const kanbanLeads = useMemo(
    // No funil Vencidos os cards vêm da query própria já projetada, não da
    // assinatura de leads ativos — cliente não está no board de prospecção.
    () => (isExpiredView ? expiredLeads : filterKanbanLeads(funnelLeads, { respFilter, onlyOverdue })),
    [isExpiredView, expiredLeads, funnelLeads, respFilter, onlyOverdue]
  );

  // Índice leadId → { count, lastDate }. Percorre interactions UMA vez,
  // evitando que cada card refaça interactions.filter()/getLastInteraction
  // (era O(cards × interações) a cada render/drag).
  const interactionIndex = useMemo(() => buildInteractionIndex(interactions), [interactions]);

  // Coluna Perda (E1c): em vez de fatiar TODAS as perdas do prop global, busca
  // uma página (LIST_PAGE_SIZE) das mais recentes do funil por query (getDocs) +
  // "Carregar mais". Ordena
  // por createdAt (índice #2 via bucketByFunnelQuerySpec) e NÃO por lostAt: o
  // backfill não materializou lostAt, e orderBy lostAt derrubaria perdas legadas
  // sem o campo. Não é ao vivo — recarrega (lostReload) ao marcar/desfazer perda.
  const lostFunnelId = selectedFunnelId || defaultFunnelId;
  const lostSpec = useMemo(
    () => bucketByFunnelQuerySpec(LIFECYCLE_BUCKETS.PERDA, lostFunnelId, KANBAN_PAGE_SIZE),
    [lostFunnelId]
  );
  const {
    items: lostDocs, loading: lostLoading, hasMore: lostHasMore,
    loadMore: lostLoadMore, reload: lostReload,
  } = usePagedLeads({
    db, path: LEADS_PATH, spec: lostSpec, specKey: `perda:${lostFunnelId || ''}`,
    enabled: !!db && !!lostFunnelId,
  });
  // Refino client-side sobre a página carregada, espelhando filterKanbanLeads
  // para perdas: respFilter por consultantId; onlyOverdue exclui perdas (elas
  // não têm follow-up ativo), então a coluna fica vazia com o filtro ligado.
  const lostLeads = useMemo(() => {
    if (onlyOverdue) return [];
    const base = lostDocs || [];
    return respFilter.length === 0 ? base : base.filter(l => respFilter.includes(l.consultantId));
  }, [lostDocs, respFilter, onlyOverdue]);

  // Coluna Venda: matrículas fechadas no MÊS CORRENTE, com fonte própria.
  // Pós-flip o prop `leads` é só o balde 'ativo', então o card sumia no instante
  // em que a venda fechava e a coluna vivia vazia. Agora ela mostra o mês —
  // e vira sozinha na virada, porque a janela é recalculada a cada render
  // (monthKey muda no dia 1 e refaz a spec).
  const monthRef = new Date();
  const monthYear = monthRef.getFullYear();
  const monthIndex = monthRef.getMonth();
  const month = useMemo(() => monthWindow(new Date(monthYear, monthIndex, 1)), [monthYear, monthIndex]);
  const wonSpec = useMemo(() => wonInMonthQuerySpec(month.startMs, month.endMs), [month]);
  const {
    items: wonDocs, loading: wonLoading, reload: wonReload,
  } = usePagedLeads({
    db, path: LEADS_PATH, spec: wonSpec, specKey: `venda:${monthYear}-${monthIndex}`, enabled: !!db,
  });
  // A query não escopa por funil (evita índice novo) — o refino acontece aqui,
  // sobre o MÊS INTEIRO, então a contagem da coluna é exata.
  const wonLeads = useMemo(() => {
    if (onlyOverdue) return [];
    const base = (wonDocs || []).filter(l => !lostFunnelId || l.funnelId === lostFunnelId);
    return respFilter.length === 0 ? base : base.filter(l => respFilter.includes(l.consultantId));
  }, [wonDocs, respFilter, onlyOverdue, lostFunnelId]);

  // Lookup dos leads ARRASTÁVEIS por id: ativos (prop) + as páginas das colunas
  // terminais (Perda e Venda). Pós-flip o prop é só 'ativo', então sem incluir
  // esses docs os handlers de drag não achavam o card pelo id — quebrava
  // DESFAZER (arrastar de volta pra uma etapa). Ativo tem prioridade no id.
  const draggableById = useMemo(() => {
    const m = new Map();
    (leads || []).forEach((l) => m.set(l.id, l));
    (lostDocs || []).forEach((l) => { if (!m.has(l.id)) m.set(l.id, l); });
    (wonDocs || []).forEach((l) => { if (!m.has(l.id)) m.set(l.id, l); });
    // Cards PROJETADOS do funil Renovações. Eles não existem em nenhuma das três
    // fontes acima: são cópias em memória que só o board conhece. Sem isto o
    // arrasto não acha o card pelo id e não faz nada — e, pior, o cliente que
    // fechou contrato ESTE mês está em wonDocs como documento CRU, sem a flag
    // _renewalCard: o guard não pegaria e o handler gravaria o nome da coluna no
    // status dele, que é a corrupção que a projeção existe para impedir.
    //
    // Entram por ÚLTIMO e SOBRESCREVENDO (m.set, não o `if (!m.has)` das linhas
    // acima), porque a versão projetada é a que os handlers precisam ver.
    if (isRenewalView) {
      renewalSplit.cardsByColumn.forEach((cards) => cards.forEach((l) => m.set(l.id, l)));
      (renewalSplit.declined || []).forEach((l) => m.set(l.id, l));
    }
    return m;
  }, [leads, lostDocs, wonDocs, isRenewalView, renewalSplit]);

  // E1d: total REAL de perdas do funil via getCountFromServer (o header da
  // coluna, depois do E1c, mostraria só a página carregada). Recontado quando
  // uma perda é marcada/desfeita (countEpoch).
  const [countEpoch, setCountEpoch] = useState(0);
  const { counts: funnelBucketCounts } = useFunnelCounts({
    db, path: LEADS_PATH, funnelId: lostFunnelId, buckets: PERDA_BUCKETS,
    enabled: !!db && !!lostFunnelId, reloadKey: countEpoch,
  });
  // Recarrega a página E reconta a coluna Perda juntas.
  const refreshLost = useCallback(() => {
    lostReload();
    setCountEpoch((e) => e + 1);
  }, [lostReload]);
  // Total no header da Perda: a contagem do servidor vale quando NÃO há refino
  // client-side (respFilter/onlyOverdue). Com refino, cai no tamanho da página
  // refinada (undefined → a coluna usa columnLeads.length), como era antes.
  //
  // LIMITAÇÕES CONHECIDAS E ACEITAS (revisão do E1, revisitar na PR H de
  // paginação real):
  //  A) respFilter na Perda filtra só a página carregada — num funil com mais
  //     perdas que a página, um responsável com perdas antigas aparece
  //     subcontado até "Carregar mais". Caminho comum (sem filtro) é exato.
  //  B) perdas sem createdAt (legado/importado, ver App.createdAtMissing) somem
  //     do orderBy. É AUTO-DETECTÁVEL: se este total do servidor (que conta tudo)
  //     passar do total de cards carregáveis, é esse caso — aí rodar backfill de
  //     createdAt. Empiricamente 0 nos funis testados.
  const perdaHeaderCount = (respFilter.length === 0 && !onlyOverdue)
    ? funnelBucketCounts[LIFECYCLE_BUCKETS.PERDA]
    : undefined;

  // ── Abas de funil: contagem por funil (mesmo recorte de funnelLeads) ──
  const funnelCounts = useMemo(() => {
    const map = new Map();
    (funnels || []).forEach(f => {
      map.set(f.id, (leads || []).filter(l => isItemInFunnel(l, f.id, defaultFunnelId)).length);
    });
    return map;
  }, [funnels, leads, defaultFunnelId]);

  // Bubble de filtros fecha em clique fora / Esc (o overflow "+N" das abas
  // é tratado internamente pelo FunnelTabs).
  const filterWrapRef = useRef(null);
  useEffect(() => {
    if (!filterOpen) return;
    const onPointerDown = (e) => { if (!filterWrapRef.current?.contains(e.target)) setFilterOpen(false); };
    const onKeyDown = (e) => { if (e.key === 'Escape') setFilterOpen(false); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [filterOpen]);

  const stopKanbanPan = () => {
  dragScrollRef.current.isDown = false;
  setIsPanning(false);
};

const handleKanbanMouseDown = (e) => {
  if (e.button !== 0) return;

  // Não iniciar pan se clicou em card draggable
  if (e.target.closest('[data-no-pan="true"]')) return;

  const container = kanbanScrollRef.current;
  if (!container) return;

  dragScrollRef.current = {
    isDown: true,
    startX: e.pageX,
    scrollLeft: container.scrollLeft
  };

  setIsPanning(true);
};

const handleKanbanMouseMove = (e) => {
  const container = kanbanScrollRef.current;
  const state = dragScrollRef.current;

  if (!container || !state.isDown) return;

  e.preventDefault();

  const walk = e.pageX - state.startX;
  container.scrollLeft = state.scrollLeft - walk;
};

  // ── Lógica core de movimentação, compartilhada entre o drag (desktop)
  //    e o menu "Mover" (toque/teclado). ──────────────────────────────

  // Move para uma etapa normal (não Venda/Perda). Mover só muda a FASE:
  // não inventa agendamento (ver P4). Ao sair de Venda/Perda, limpa os
  // campos de resolução da origem para o lead não seguir contando como
  // matrícula/perda nas métricas.
  const applyMoveToStage = useCallback(async (lead, newStatus) => {
    try {
      const leadPatch = { status: newStatus };
      if (selectedFunnelId && !lead.funnelId) leadPatch.funnelId = selectedFunnelId;
      // Etapa customizada com nome de matrícula ("Matriculado", "Convertido"...)
      // conta como conversão nas métricas — então precisa do carimbo de data.
      // Sem ele, a matrícula caía no mês do CADASTRO do lead, não no do
      // fechamento. Destino convertido também não limpa os campos ao sair
      // de Venda (continuaria matrícula, só que sem data).
      const destinoConvertido = isConvertedStatusName(newStatus);
      if (lead.status === 'Venda' && !destinoConvertido) { leadPatch.isConverted = false; leadPatch.convertedAt = null; }
      if (lead.status === 'Perda') { leadPatch.lossReason = null; leadPatch.lostAt = null; }
      if (destinoConvertido && !getSafeDateOrNull(lead.convertedAt)) leadPatch.convertedAt = serverTimestamp();

      await logInteraction(
        db, lead, appUser,
        { text: `Movido para a etapa [${newStatus}] via Kanban.`, type: 'status_change' },
        withBucket(leadPatch, lead)
      );
      // Histórico de aulas (dual-write best-effort): atribui/retira a
      // conversão da última aula atendida do lead.
      if (destinoConvertido && !getSafeDateOrNull(lead.convertedAt)) {
        try { await markConvertingAula({ db, leadId: lead.id }); } catch (e) { console.error('markConvertingAula falhou', e); }
      }
      if (lead.status === 'Venda' && !destinoConvertido) {
        try { await unmarkConvertedAula({ db, leadId: lead.id }); } catch (e) { console.error('unmarkConvertedAula falhou', e); }
      }
      if (lead.status === 'Perda') refreshLost(); // saiu da Perda: refaz query+contagem
      // Saiu da Venda (desfez a matrícula): a coluna do mês tem fonte própria e
      // não é ao vivo — recarrega pra o card sumir de lá.
      if (lead.status === 'Venda' && !destinoConvertido) wonReload();
    } catch (err) {
      console.error("Erro Kanban:", err);
      toast.error('Não foi possível mover o lead. Tente novamente.');
    }
  }, [db, appUser, selectedFunnelId, toast, refreshLost, wonReload]);

  // A Venda no Kanban agora abre o ContractModal (plano/valor/vigência) em vez
  // de gravar direto — mesmo fluxo da ficha. A escrita do contrato + resumo do
  // lead + timeline acontece dentro do modal (lib/contracts.js).
  const openMatricula = useCallback((lead) => setMatriculaLead(lead), []);

  // ── Desfechos do card projetado de Renovações, num lugar só ──────────
  // O arrasto e o menu "Mover" chamam os MESMOS dois helpers. Estavam escritos
  // quatro vezes e já tinham divergido: o arrasto para a Perda gravava sem
  // checar permissão. Por isso a checagem mora aqui DENTRO — as rules deixam
  // qualquer membro do tenant atualizar qualquer lead desde que não troque o
  // dono, então canEditLead é a única política que existe.
  //
  // Os dois NÃO recarregam o board: aplicam o mesmo patch na cópia local
  // (renewalPatchLead) depois do ack do servidor. Recarregar aqui era caro e
  // mentia — o reload devolve TODAS as colunas para os 10 primeiros, então quem
  // paginou perde o lugar e o card que veio da página 2 SOME da tela ao ser
  // recusado (a coluna do marco volta sem ele, e a Perda só mostra recusados das
  // páginas carregadas). Como splitRenewalForBoard já decide coluna x Perda pelo
  // renewalDeclined, mudar o campo na cópia local basta para o card andar.
  //
  // O patch vai no .then e não antes: se a escrita falhar, a tela não pode ter
  // mostrado o card no lugar novo.

  // "Não vai renovar": a MESMA flag que a Meta Diária usa. A pessoa NÃO vira
  // lead perdido — segue cliente, com ficha e contratos, e continua na aba
  // Clientes. Perda de venda != perda de funil.
  const declineRenewal = useCallback((lead) => {
    if (!canEditLead(appUser, lead)) {
      toast.warning('Você não tem permissão para alterar este lead.');
      return;
    }
    // Marca o marco atual como tratado junto: sem isso o cliente continuaria
    // sendo cobrado hoje na Meta, no mesmo marco que ele acabou de recusar.
    // O MESMO objeto vai para o banco e para a cópia local — só assim o card já
    // troca a linha de compromisso para "Marco de X dias tratado", que lê
    // renewalHandledCheckpoints.
    const patch = renewalDecline(lead, lead._renewalDays);
    updateDoc(
      doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
      patch
    ).then(() => renewalPatchLead(lead.id, patch)).catch(err => {
      console.error('Erro ao marcar recusa de renovação', err);
      toast.error('Não foi possível marcar a recusa.');
    });
  }, [appUser, db, toast, renewalPatchLead]);

  // Desfazer a recusa (sair da Perda de volta para um marco). NÃO tira o marco
  // de renewalHandledCheckpoints de propósito: o consultor conversou com o
  // cliente naquele marco, e quem pega ele de novo é o marco seguinte.
  const undoRenewalDecline = useCallback((lead) => {
    if (!canEditLead(appUser, lead)) {
      toast.warning('Você não tem permissão para mover este lead.');
      return;
    }
    const patch = { renewalDeclined: false };
    updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), patch)
      .then(() => renewalPatchLead(lead.id, patch)).catch(err => {
        console.error('Erro ao desfazer a recusa de renovação', err);
        toast.error('Não foi possível mover o card.');
      });
  }, [appUser, db, toast, renewalPatchLead]);

  // Despacha um destino (etapa / Venda / Perda) com checagem de permissão.
  // Usada pelo menu "Mover" — funciona em toque, mouse e teclado, sem
  // depender do drag-and-drop nativo (que não dispara em telas de toque).
  const moveLeadToStatus = (lead, statusName) => {
    if (!lead || lead.status === statusName) return;
    if (!canEditLead(appUser, lead)) {
      toast.warning('Você não tem permissão para mover este lead.');
      return;
    }
    // BIFURCAÇÃO do card projetado do funil Renovações. applyMoveToStage grava
    // `status` no documento, e o status real de um cliente é 'Venda' — gravar o
    // nome da coluna ali corromperia o estado de cliente e a aba Clientes.
    if (lead._renewalCard) {
      if (statusName === 'Venda') return openMatricula(lead);
      if (statusName === 'Perda') return declineRenewal(lead);
      // Sair da Perda de volta para um marco desfaz a recusa — a MESMA volta que
      // o arrasto permite (handleDrop). Sem isto o menu divergiria do mouse e no
      // celular não haveria como desfazer.
      if (lead.renewalDeclined) return undoRenewalDecline(lead);
      toast.warning('As colunas de Renovações seguem o vencimento do contrato e não podem ser movidas à mão.');
      return;
    }
    if (statusName === 'Venda') return openMatricula(lead);
    if (statusName === 'Perda') { setLossModalLeadId(lead.id); return; }
    return applyMoveToStage(lead, statusName);
  };

  // ── Handlers de drag (desktop): extraem o leadId e delegam ao core ──
  const handleDrop = useCallback((e, newStatus) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    const lead = leadId && draggableById.get(leadId);
    if (!lead || lead.status === newStatus) return;
    if (!canEditLead(appUser, lead)) {
      toast.warning('Você não tem permissão para mover este lead.');
      return;
    }
    // FUNIL RENOVAÇÕES: as colunas são faixas de tempo, não etapas de conversa.
    // Mover à mão mentiria na tela — o card voltaria para a coluna do relógio na
    // próxima carga. A única volta permitida é sair da Perda (desfazer a recusa).
    if (lead._renewalCard) {
      if (newStatus === 'Perda' || newStatus === 'Venda') return; // tratados pelos handlers próprios
      if (!lead.renewalDeclined) {
        toast.warning('As colunas de Renovações seguem o vencimento do contrato e não podem ser movidas à mão.');
        return;
      }
      undoRenewalDecline(lead);
      return;
    }
    // BIFURCAÇÃO do funil Vencidos. O card ali é um CLIENTE, cujo status real é
    // 'Venda' — gravar a etapa em `status` corromperia o estado de cliente e a
    // aba Clientes. A etapa dele mora num campo próprio, reactivationStageId.
    // O `status` que chega aqui é o projetado (nome da etapa), não o do banco.
    if (lead._expiredCard) {
      const etapa = (statuses || []).find(
        st => st.funnelId === expiredFunnel?.id && st.name === newStatus
      );
      if (!etapa) return;
      updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), {
        reactivationStageId: etapa.id,
        // Saindo da Perda de volta para uma etapa: a recusa deixa de valer,
        // senão o card sumiria das etapas na próxima renderização.
        renewalDeclined: false
      }).catch(err => {
        console.error('Erro ao mover card do funil de vencidos', err);
        toast.error('Não foi possível mover o card.');
      });
      return;
    }
    applyMoveToStage(lead, newStatus);
  }, [draggableById, appUser, toast, applyMoveToStage, undoRenewalDecline, statuses, expiredFunnel, db]);

  const handleWinDrop = useCallback((e) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    const lead = leadId && draggableById.get(leadId);
    if (!lead || lead.status === 'Venda') return;
    if (!canEditLead(appUser, lead)) {
      toast.warning('Você não tem permissão para alterar este lead.');
      return;
    }
    openMatricula(lead);
  }, [draggableById, appUser, toast, openMatricula]);

  const handleLossDrop = useCallback((e) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    const alvo = leadId && draggableById.get(leadId);
    // FUNIL RENOVAÇÕES: "não vai renovar" é a MESMA flag que a Meta Diária usa.
    // A pessoa NÃO vira lead perdido — segue cliente, com ficha e contratos, e
    // continua na aba Clientes. Perda de venda != perda de funil.
    // A permissão é checada DENTRO do helper: este ramo corre antes do
    // canEditLead lá de baixo, e sem isso um consultor arrastaria o cliente de
    // outro para a Perda.
    if (alvo?._renewalCard) {
      declineRenewal(alvo);
      return;
    }
    // Funil VENCIDOS: "não volta" é venda perdida, mas a pessoa NÃO vira lead
    // perdido — ela segue cliente, com ficha e contratos, e continua na aba
    // Clientes. O que muda é só a flag que já existe e que a Meta também usa.
    if (alvo?._expiredCard) {
      updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, alvo.id), {
        renewalDeclined: true, reactivationStageId: null
      }).catch(err => {
        console.error('Erro ao marcar recusa no funil de vencidos', err);
        toast.error('Não foi possível mover o card.');
      });
      return;
    }
    if (!alvo || alvo.status === 'Perda') return;
    if (!canEditLead(appUser, alvo)) {
      toast.warning('Você não tem permissão para alterar este lead.');
      return;
    }
    setLossModalLeadId(alvo.id);
  }, [draggableById, appUser, toast, declineRenewal, db]);

  const confirmKanbanLoss = async (reason) => {
    if (!lossModalLeadId) return;
const lead = leads.find(l => l.id === lossModalLeadId);
if (!lead) return;
    try {
      await logInteraction(
        db, lead, appUser,
        { text: `Lead perdido. Motivo: ${reason}`, type: 'status_change' },
        withBucket(
          {
            status: 'Perda',
            lossReason: reason,
            nextFollowUp: null,
            lostAt: serverTimestamp(),
            // Limpa resquício caso o lead viesse da coluna Venda.
            isConverted: false,
            convertedAt: null
          },
          lead
        )
      );
      // #8: Perda é CHURN, então NÃO desfaz a conversão histórica da aula. A
      // matrícula aconteceu; o churn é medido pela taxa de renovação, não
      // reescrevendo a conversão passada do professor. (Sair de Venda p/ fase de
      // lead ainda desfaz, ver handlePhaseConfirm/saveInteraction: venda por engano.)

      setLossModalLeadId(null);
      refreshLost(); // query da coluna Perda não é ao vivo — refaz fetch+contagem
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível registrar a perda. Tente novamente.');
    }
  };

  const handleDragStart = useCallback((e, leadId) => {
    e.dataTransfer.setData('leadId', leadId);
    e.dataTransfer.effectAllowed = 'move';
    // Timeout to prevent the browser from capturing the modified styles in the drag ghost
    setTimeout(() => setDraggingLeadId(leadId), 0);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingLeadId(null);
    setDraggedOverColumn(null);
  }, []);

  // Callbacks estáveis p/ colunas/cards memoizados. O set funcional com
  // bail-out (prev === name) reproduz o guard antigo "if (draggedOverColumn
  // !== name)" sem depender do valor no closure.
  const onColumnDragOver = useCallback((name) => {
    setDraggedOverColumn(prev => (prev === name ? prev : name));
  }, []);
  const onColumnDragLeave = useCallback((name) => {
    setDraggedOverColumn(prev => (prev === name ? null : prev));
  }, []);
  // Despacho único de drop: limpa o estado de drag (mesma ordem do código
  // antigo) e roteia por tipo de coluna.
  const onDropLead = useCallback((e, name, special) => {
    setDraggedOverColumn(null);
    setDraggingLeadId(null);
    if (special === 'win') return handleWinDrop(e);
    if (special === 'loss') return handleLossDrop(e);
    return handleDrop(e, name);
  }, [handleDrop, handleWinDrop, handleLossDrop]);
  const onMoveRequest = useCallback((lead) => setMoveLead(lead), []);

  // Particiona o board inteiro numa passada (lib/kanban.js, coberto por
  // teste), memoizado: só recalcula quando o recorte de leads muda — não
  // em cada mudança de estado de drag/filtro/modal. O fallback EMPTY_LEADS
  // (constante de módulo) mantém a prop columnLeads estável em colunas
  // vazias — um [] literal novo por render anularia o React.memo delas.
  // No funil Renovações o agrupamento já vem pronto por coluna (cada coluna tem
  // sua própria query), então não há o que particionar.
  const leadsByStatus = useMemo(
    () => (isRenewalView ? renewalSplit.cardsByColumn : partitionLeadsByStatus(kanbanLeads)),
    [isRenewalView, renewalSplit, kanbanLeads]
  );
  const getLeadsByStatus = (statusName) => leadsByStatus.get(statusName) || EMPTY_LEADS;

  // No funil Renovações as colunas NÃO vêm de stronix_statuses: são derivadas
  // dos marcos, em memória. Nos demais, seguem sendo as etapas do funil.
  const pipelineColumns = isRenewalView
    ? renewalColumns
    : (statuses || []).filter(s => isItemInFunnel(s, selectedFunnelId, defaultFunnelId));
  const totalFunnelLeads = funnelLeads.length;
  // A carteira padrão do papel não conta como filtro: o consultor abre na
  // própria e o botão fica apagado, como o do gestor na equipe inteira.
  const respIsDefault = isDefaultRespFilter(appUser, respFilter);
  const hasActiveFilters = !respIsDefault || onlyOverdue;
  // Consultor vendo "toda a equipe" tem respFilter vazio e ainda assim saiu do
  // padrão — o `|| 1` mantém isso visível no badge.
  const activeFilterCount = (respIsDefault ? 0 : (respFilter.length || 1)) + (onlyOverdue ? 1 : 0);

  // Resumo à esquerda do botão de filtro: sem recorte de responsável mostra
  // "X de Y leads"; com recorte, de quem é a carteira ("Ana · 12 leads").
  const filterSummary = useMemo(() => {
    // Renovações não tem contagem de pipeline: os cards vêm das queries por
    // coluna, então kanbanLeads e totalFunnelLeads dariam "0 de 0" num board
    // cheio. Sem recorte ativo o resumo some; com recorte ele volta, porque aí
    // descreve de quem é a carteira e não quantos são.
    if (isRenewalView && !hasActiveFilters) return '';
    const parts = [];
    if (respFilter.length === 1) {
      const user = (usersList || []).find(u => u.id === respFilter[0]);
      parts.push(user?.name || '1 responsável');
    } else if (respFilter.length > 1) {
      parts.push(`${respFilter.length} responsáveis`);
    }
    if (onlyOverdue) parts.push('Em atraso');
    parts.push(parts.length === 0 ? `${kanbanLeads.length} de ${totalFunnelLeads} leads` : `${kanbanLeads.length} leads`);
    return parts.join(' · ');
  }, [isRenewalView, hasActiveFilters, kanbanLeads.length, totalFunnelLeads, respFilter, onlyOverdue, usersList]);

  // Lista do filtro: o próprio usuário primeiro (é a carteira que ele mais
  // procura), o resto em ordem alfabética.
  const respOptions = useMemo(() => {
    const list = (usersList || []).filter(u => u?.id);
    return [...list].sort((a, b) => {
      if (a.id === appUser?.id) return -1;
      if (b.id === appUser?.id) return 1;
      return (a.name || '').localeCompare(b.name || '', 'pt-BR');
    });
  }, [usersList, appUser]);

  const toggleResp = (id) => {
    setRespFilter(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  // "Limpar" devolve a tela ao estado de abertura do papel — para o consultor
  // isso é a própria carteira, não a equipe inteira.
  const clearFilters = () => {
    setRespFilter(defaultRespFilterFor(appUser));
    setOnlyOverdue(false);
  };

  return (
    <>
      {/* Full-bleed: cancela o padding do container p/ o header da página
          colar no header global e o board correr de borda a borda. */}
      <div className="-m-4 md:-m-8 h-[calc(100vh-4rem)] flex flex-col animate-fade-in">
        {/* Linha de header da página: abas de funil + resumo + filtro único */}
        <div className="h-16 shrink-0 relative z-20 bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 flex items-center gap-3 md:gap-5 px-4 md:px-7">
          <FunnelTabs
            funnels={funnels}
            counts={funnelCounts}
            selectedId={selectedFunnelId}
            onSelect={setSelectedFunnelId}
          />

          {filterSummary && (
            <div className="hidden md:block text-[11.5px] text-slate-500 dark:text-neutral-400 whitespace-nowrap tabular-nums shrink-0">
              <span className="font-semibold text-gray-700 dark:text-neutral-200">{filterSummary}</span>
            </div>
          )}

          <div ref={filterWrapRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setFilterOpen(o => !o)}
              title="Filtros"
              aria-haspopup="dialog"
              aria-expanded={filterOpen}
              className={cn(
                'relative size-[38px] rounded-[11px] border grid place-items-center transition-colors',
                hasActiveFilters
                  ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-500/15 dark:border-brand-500/30 dark:text-brand-300'
                  : 'bg-paper-50 border-slate-200 text-gray-600 hover:border-brand-200 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-brand-500/40'
              )}
            >
              <SlidersHorizontal className="size-[17px]" />
              {hasActiveFilters && (
                <span className="absolute -top-[5px] -right-[5px] min-w-4 h-4 px-1 rounded-full bg-accent-500 text-white text-[9.5px] font-bold grid place-items-center ring-2 ring-white dark:ring-neutral-900 tabular-nums">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {filterOpen && (
              <div className="absolute right-0 top-[46px] w-[264px] rounded-[14px] bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-700 shadow-[0_16px_40px_-8px_rgba(14,26,64,.22)] overflow-hidden z-30">
                <div className="px-3.5 pt-3 pb-2.5 flex items-center justify-between border-b border-slate-100 dark:border-white/10">
                  <span className="text-[12.5px] font-bold text-gray-900 dark:text-white">Filtros</span>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-[11.5px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
                  >
                    Limpar
                  </button>
                </div>

                {/* Carteira: aberta para a equipe inteira, gestor ou consultor.
                    Quem manda no que aparece é este filtro — a base que chega na
                    tela é sempre a academia toda (ver lib/kanban.js). */}
                <div className="pt-2.5 px-2 pb-1">
                  <div className="px-1.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[.07em] text-gray-400 dark:text-neutral-500">
                    Responsável
                  </div>
                  <button
                    type="button"
                    onClick={() => setRespFilter([])}
                    className={cn(
                      'w-full flex items-center gap-[9px] px-2 py-[7px] rounded-[9px] text-left transition-colors',
                      respFilter.length === 0 ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-paper-50 dark:hover:bg-white/5'
                    )}
                  >
                    <span className="size-6 rounded-full grid place-items-center bg-paper-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400 shrink-0">
                      <Users className="size-[13px]" />
                    </span>
                    <span className={cn('flex-1 text-[12.5px] text-gray-900 dark:text-white truncate', respFilter.length === 0 ? 'font-bold' : 'font-medium')}>
                      Toda a equipe
                    </span>
                    {respFilter.length === 0 && <Check className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" strokeWidth={2.6} />}
                  </button>
                  {respOptions.map(u => {
                    const selected = respFilter.includes(u.id);
                    const isSelf = u.id === appUser?.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleResp(u.id)}
                        className={cn(
                          'w-full flex items-center gap-[9px] px-2 py-[7px] rounded-[9px] text-left transition-colors',
                          selected ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-paper-50 dark:hover:bg-white/5'
                        )}
                      >
                        <InitialsAvatar name={u.name} size={24} textSize={9.5} />
                        <span className={cn('flex-1 text-[12.5px] text-gray-900 dark:text-white truncate', selected ? 'font-bold' : 'font-medium')}>
                          {u.name}
                        </span>
                        {isSelf && (
                          <span className="text-[10px] font-semibold uppercase tracking-[.06em] text-slate-400 dark:text-neutral-500 shrink-0">
                            você
                          </span>
                        )}
                        {selected && <Check className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" strokeWidth={2.6} />}
                      </button>
                    );
                  })}
                </div>

                <div className="mx-3.5 mt-1.5 border-t border-slate-100 dark:border-white/10" />

                <div className="px-3.5 pt-2.5 pb-3.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={onlyOverdue}
                    onClick={() => setOnlyOverdue(o => !o)}
                    className="w-full flex items-center justify-between gap-2.5"
                  >
                    <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-gray-900 dark:text-white">
                      <AlertCircle className={cn('size-3.5', onlyOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-neutral-500')} />
                      Somente em atraso
                    </span>
                    <span
                      className={cn(
                        'relative w-[34px] h-5 rounded-full transition-colors duration-150 shrink-0',
                        onlyOverdue ? 'bg-brand-600' : 'bg-slate-300 dark:bg-neutral-700'
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 size-4 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,.3)] transition-[left] duration-150',
                          onlyOverdue ? 'left-4' : 'left-0.5'
                        )}
                      />
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Board denso */}
        <div
          ref={kanbanScrollRef}
          onMouseDown={handleKanbanMouseDown}
          onMouseMove={handleKanbanMouseMove}
          onMouseUp={stopKanbanPan}
          onMouseLeave={stopKanbanPan}
          className={cn(
            'flex-1 min-h-0 overflow-x-auto overflow-y-hidden custom-scrollbar select-none px-4 md:px-7 pt-5 pb-6',
            isPanning ? 'cursor-grabbing' : 'cursor-grab'
          )}
        >
          <div className="flex gap-6 min-w-max h-full">
            {pipelineColumns.map((column) => (
              <KanbanColumn
                key={column.id}
                name={column.name}
                color={column.color}
                special={null}
                columnLeads={getLeadsByStatus(column.name)}
                // Vencidos: o volume mora na coluna de entrada, e é ela que
                // pagina. Renovações: cada coluna tem sua query e pagina sozinha.
                hasMore={
                  isRenewalView ? Boolean(renewalHasMore[column.days])
                    : isExpiredView && column.isEntry ? expiredHasMore
                      : false
                }
                onLoadMore={
                  isRenewalView ? () => renewalLoadMore(column.days)
                    : isExpiredView && column.isEntry ? expiredLoadMore
                      : null
                }
                isHovered={draggedOverColumn === column.name}
                draggingLeadId={draggingLeadId}
                interactionIndex={interactionIndex}
                onColumnDragOver={onColumnDragOver}
                onColumnDragLeave={onColumnDragLeave}
                onDropLead={onDropLead}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onOpenProfile={openProfile}
                onMoveRequest={onMoveRequest}
              />
            ))}

            <KanbanColumn
              key="__venda"
              name="Venda"
              color="green"
              special="win"
              columnLeads={wonLeads}
              loadingMore={wonLoading}
              note={month.label}
              isHovered={draggedOverColumn === 'Venda'}
              draggingLeadId={draggingLeadId}
              interactionIndex={interactionIndex}
              onColumnDragOver={onColumnDragOver}
              onColumnDragLeave={onColumnDragLeave}
              onDropLead={onDropLead}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onOpenProfile={openProfile}
              onMoveRequest={onMoveRequest}
            />

            <KanbanColumn
              key="__perda"
              name="Perda"
              color="gray"
              special="loss"
              columnLeads={
                isRenewalView ? renewalSplit.declined
                  : isExpiredView ? expiredSplit.declined
                    : lostLeads
              }

              totalCount={perdaHeaderCount}
              hasMore={lostHasMore}
              onLoadMore={lostLoadMore}
              loadingMore={lostLoading}
              isHovered={draggedOverColumn === 'Perda'}
              draggingLeadId={draggingLeadId}
              interactionIndex={interactionIndex}
              onColumnDragOver={onColumnDragOver}
              onColumnDragLeave={onColumnDragLeave}
              onDropLead={onDropLead}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onOpenProfile={openProfile}
              onMoveRequest={onMoveRequest}
            />
          </div>
        </div>
      </div>

      {lossModalLeadId && (
        <LossReasonModal
          lossReasons={lossReasons}
          onClose={() => setLossModalLeadId(null)}
          onConfirm={confirmKanbanLoss}
        />
      )}

      {matriculaLead && (
        <ContractModal
          // Card do funil Renovações: é renovação, não primeira matrícula. O
          // modal em modo renovação NÃO carimba convertedAt e emenda a vigência
          // no fim do contrato atual (ver src/lib/renewal.js, seamStart).
          mode={matriculaLead._renewalCard ? 'renovacao' : 'matricula'}
          lead={matriculaLead}
          appUser={appUser}
          db={db}
          onClose={() => setMatriculaLead(null)}
          onDone={() => {
            // Matricular um lead que estava na Perda tira ele do bucket 'perda':
            // como a coluna Perda não é ao vivo, refaz a query+contagem senão
            // fica card fantasma / total inflado. Só quando veio da Perda.
            const wasPerda = matriculaLead?.status === 'Perda';
            // Renovação fechada: o ÚNICO desfecho de Renovações que ainda
            // recarrega o board — e aqui a recarga é a resposta certa, porque a
            // vigência nova tira o cliente da janela e ele precisa sumir de
            // verdade (patch local não daria conta). Sem ela o card ficaria no
            // mesmo marco com a vigência VELHA, o consultor acharia que não
            // gravou e repetiria o gesto — e o modal emendaria um SEGUNDO
            // contrato a partir da data antiga (seamStart, em lib/renewal.js).
            // Custa N queries, mas é uma vez por cliente por ciclo.
            const wasRenewal = Boolean(matriculaLead?._renewalCard);
            setMatriculaLead(null);
            if (wasPerda) refreshLost();
            if (wasRenewal) renewalReload();
            // A venda recém-fechada precisa aparecer na coluna do mês, que
            // também não é ao vivo.
            wonReload();
          }}
        />
      )}

      {moveLead && (
        <MoveLeadModal
          lead={moveLead}
          columns={pipelineColumns}
          onMove={(statusName) => { moveLeadToStatus(moveLead, statusName); setMoveLead(null); }}
          onClose={() => setMoveLead(null)}
        />
      )}
    </>
  );
}

// Seletor de etapa para mover um lead sem arrastar (toque/teclado).
// Lista as etapas do funil + Venda + Perda, exceto a fase atual.
function MoveLeadModal({ lead, columns, onMove, onClose }) {
  const targets = [
    ...(columns || []).map(c => ({ name: c.name, color: c.color, kind: 'stage' })),
    { name: 'Venda', color: 'green', kind: 'win' },
    { name: 'Perda', color: 'gray', kind: 'loss' }
  ].filter(t => t.name !== lead.status);

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-[200] p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
          <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">Mover lead</h3>
          <p className="text-[12px] text-gray-500 dark:text-neutral-400 truncate mt-0.5">
            <span className="font-medium text-gray-700 dark:text-neutral-200">{lead.name}</span> · de <span className="font-medium">{lead.status}</span>
          </p>
        </div>
        <div className="p-2 overflow-y-auto custom-scrollbar">
          {targets.map((t) => {
            const accent = getKanbanColumnAccent(t.color);
            return (
              <button
                key={t.name}
                type="button"
                onClick={() => onMove(t.name)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
              >
                {t.kind === 'win' ? (
                  <span className="w-6 h-6 rounded-md grid place-items-center bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 shrink-0"><TrendingUp className="w-3.5 h-3.5" /></span>
                ) : t.kind === 'loss' ? (
                  <span className="w-6 h-6 rounded-md grid place-items-center bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400 shrink-0"><Ban className="w-3.5 h-3.5" /></span>
                ) : (
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${accent.dot}`} />
                )}
                <span className="text-[13.5px] font-medium text-gray-900 dark:text-white truncate">{t.name}</span>
                {t.kind === 'win' && <span className="ml-auto text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">matrícula</span>}
              </button>
            );
          })}
        </div>
        <div className="px-3 py-3 border-t border-gray-100 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-gray-600 dark:text-neutral-300 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
export { KanbanView };
