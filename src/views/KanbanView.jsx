import { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react';
import { serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { canEditLead, normalizeLeadDoc } from '../lib/leads.js';
import { isSeller } from '../lib/acesso.js';
import { logInteraction } from '../lib/interactions.js';
import { withBucket } from '../lib/leadDerived.js';
import { planStageMove, planLoss, planUpgradeMove, planUpgradeDecline, stageMoveBlockMessage, STAGE_MOVE_BLOCK, withStageEntered } from '../lib/stageMove.js';
import { getSafeDateOrNull } from '../lib/dates.js';
import { hasLiveContract } from '../lib/contracts.js';
import { getDefaultFunnel, isItemInFunnel } from '../lib/funnels.js';
import { isClientFunnel } from '../lib/crm/scope.js';
import { buildInteractionIndex, lastInteractionDateOf } from '../lib/leadStatus.js';
import { usePagedLeads } from '../hooks/usePagedLeads.js';
import { useLatestRef } from '../hooks/useLatestRef.js';
import { useRenewalBoard } from '../hooks/useRenewalBoard.js';
import { useLeadCount } from '../hooks/useLeadCount.js';
import { getExpiredFunnel, splitExpiredForBoard } from '../lib/expiredFunnel.js';
import { getUpgradeFunnel, projectUpgradeLeads } from '../lib/upgradeFunnel.js';
import { getRenewalFunnel, renewalColumnsFromCheckpoints, splitRenewalForBoard } from '../lib/renewalFunnel.js';
import { renewalDecline, renewalDeclineStamp, renewalUndoDecline, daysToExpiryOf } from '../lib/renewalGoal.js';
import { useFunnelCounts } from '../hooks/useFunnelCounts.js';
import { useScreenParams } from '../hooks/useScreenParams.js';
import { bucketByFunnelQuerySpec, bucketByFunnelInMonthQuerySpec, wonInMonthQuerySpec, LIFECYCLE_BUCKETS, expiredClientsQuerySpec, upgradeClientsQuerySpec } from '../lib/leadQueries.js';
import { LEADS_PATH, appId } from '../lib/firebase.js';
import { fmtBRL } from '../lib/format.js';
import { filterKanbanLeads, partitionLeadsByStatus, getKanbanColumnAccent, getKanbanAvatarPalette, getKanbanInitials, fmtKanbanRelDate, KANBAN_PAGE_SIZE, stageParts, funnelSummary, kanbanSilence, monthWindow, defaultRespFilterFor, isDefaultRespFilter, isOverdueLead, kanbanMonthOptions, createdInWindow, expiredWindowOf, KANBAN_ALL_MONTHS } from '../lib/kanban.js';
import { monthKeyOf, monthRange } from '../lib/operacional/month.js';
import { isImportCreatedLead } from '../lib/operacional/routine.js';
import { markConvertingAula } from '../lib/aulasWrites.js';
import { cn } from '@/lib/utils';
import { useToast } from '../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { FollowUpIcon } from '../components/ui/Badges.jsx';
import { LeadLink } from '../components/nav/AppLink.jsx';
import { LossReasonModal } from '../modals/LossReasonModal.jsx';
import { ContractModal } from '../modals/ContractModal.jsx';
import { AlertCircle, ArrowRightLeft, ArrowUpRight, Ban, Check, CheckCircle, SlidersHorizontal, TrendingUp } from 'lucide-react';
import { FunnelSwitcher, StageBar } from '../components/layout/FunnelSwitcher.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover.jsx';
import { FOCUS_RING } from '../components/focusRing.js';
import { FilterBar, FilterChip, PeriodControl } from './dashboard/DashFilterBar.jsx';
import { ConsultoresControl } from './relatorios/RelatoriosToolbar.jsx';

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

// Etiqueta da linha 1, em letra normal e 11px (era 9,5px em caixa alta). Só
// aparece quando informa algo: agendado para amanhã ou semana que vem não é
// notícia, então não leva selo.
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

// "ontem às 15:30". O tipo e a data ficam em pedaços separados da linha do
// compromisso, então a data não leva o "·" que o fmtKanbanRelDateTime traria.
const relWhen = (dt) =>
  `${fmtKanbanRelDate(dt).toLowerCase()} às ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

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
  lost: 'text-slate-500 dark:text-neutral-400',
  normal: 'text-slate-700 dark:text-neutral-300'
};
// Borda de urgência à esquerda do card (no lugar do rodapé pintado).
const EDGE_TONE = {
  overdue: 'bg-rose-500',
  none: 'bg-amber-500',
  won: 'bg-emerald-500',
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

// Pílula Situação: o antigo "Somente em atraso" (parâmetro `atraso`).
const SITUACAO_OPTIONS = [{ key: 'todos', label: 'Todos' }, { key: 'atraso', label: 'Em atraso' }];

// O que soltar em Venda e em Perda faz em cada funil.
const EXIT_LABELS = {
  lead: { win: 'Soltar para matricular', loss: 'Soltar para marcar perda' },
  renewal: { win: 'Soltar para renovar', loss: 'Soltar se não vai renovar' },
  expired: { win: 'Soltar para matricular de novo', loss: 'Soltar se não volta' },
  upgrade: { win: 'Soltar para fechar o upgrade', loss: 'Soltar e escolher o motivo' },
};

// Faixa de saída do arrasto: Venda e Perda no pé do quadro, só enquanto um
// card é arrastado. Fica fora da leitura de tela de propósito: quem usa teclado
// ou toque move pelo botão Mover do card, que já lista Venda e Perda.
function ExitDock({ visible, labels, hovered, onColumnDragOver, onColumnDragLeave, onDropLead }) {
  const target = (name, special, Icon, text) => {
    const over = hovered === name;
    const win = special === 'win';
    return (
      <div
        onDragOver={(e) => { e.preventDefault(); onColumnDragOver(name); }}
        onDragLeave={(e) => { if (e.currentTarget.contains(e.relatedTarget)) return; onColumnDragLeave(name); }}
        onDrop={(e) => onDropLead(e, name, special)}
        className={cn(
          'flex h-16 w-[min(240px,40vw)] items-center gap-3 rounded-xl border-[1.5px] border-dashed px-4 transition-colors',
          win
            ? 'border-emerald-500 text-[#0F9D6E] dark:text-emerald-300'
            : 'border-slate-300 text-slate-500 dark:border-neutral-600 dark:text-neutral-400',
          over && (win ? 'bg-emerald-500/10' : 'bg-slate-100 dark:bg-white/5')
        )}
      >
        <Icon className="size-[22px] shrink-0" strokeWidth={2} />
        <span className="min-w-0">
          <span className="block text-[14px] font-bold">{name}</span>
          <span className="block truncate text-[12px] opacity-85">{text}</span>
        </span>
      </div>
    );
  };
  return (
    <div
      aria-hidden="true"
      data-no-pan="true"
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center transition-[opacity,transform] duration-150 motion-reduce:transition-none',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      )}
    >
      <div className={cn(
        'flex gap-3 rounded-[18px] border border-slate-200 bg-white p-2.5 shadow-[0_20px_50px_-14px_rgba(14,26,64,.45)] dark:border-neutral-700 dark:bg-neutral-900',
        visible && 'pointer-events-auto'
      )}>
        {target('Venda', 'win', CheckCircle, labels.win)}
        {target('Perda', 'loss', Ban, labels.loss)}
      </div>
    </div>
  );
}

// Ficha de 115px: nome + etiqueta, compromisso, chips de contexto e um rodapé
// que mede SILÊNCIO (dias sem contato). Anatomia uniforme — todo card tem as
// mesmas linhas, o que muda é a cor.
// React.memo: durante o drag só o card arrastado muda de prop (isDragging);
// os demais não re-renderizam. Handlers vêm estáveis (useCallback) do pai.
// Exportado para o teste em node conferir os links do card sem montar a tela.
export const KanbanCard = memo(function KanbanCard({ lead, isDragging, lastDate, onDragStart, onDragEnd, onMoveRequest }) {
  const isWon = lead.status === 'Venda';
  const isLost = lead.status === 'Perda';
  const hasFollowUp = lead.nextFollowUp instanceof Date && !isNaN(lead.nextFollowUp.getTime());
  const now = new Date();
  const isOverdue = isOverdueLead(lead, now);
  const isToday = !isWon && !isLost && hasFollowUp && !isOverdue &&
    lead.nextFollowUp.toDateString() === now.toDateString();
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
  const tone = isWon ? 'won' : isLost ? 'lost' : isOverdue ? 'overdue' : !hasFollowUp ? 'none' : isToday ? 'today' : 'normal';
  // A urgência mora numa borda à esquerda do card, e não mais num rodapé
  // pintado: a coluna cheia de atrasados continua aparecendo como bloco, sem
  // o quadro virar uma colcha. O card do Renovações não leva borda: o relógio
  // dele é a etiqueta "Vence em".
  const edge = lead._renewalCard ? null : EDGE_TONE[tone];
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
      className={cn(
        // shrink-0: sem isto o card (filho flex do container flex-col da coluna)
        // encolhe verticalmente pra caber quando a lista cresce, em vez de a
        // coluna rolar — é o bug dos cards "espremidos".
        'group relative shrink-0 rounded-[11px] bg-white dark:bg-neutral-900 border overflow-hidden cursor-grab active:cursor-grabbing transition-[border-color,box-shadow]',
        isDragging
          ? 'border-2 border-brand-600 shadow-[0_14px_30px_-12px_rgba(15,23,42,.35)] z-50'
          : 'border-[#e6eaf2] shadow-[0_1px_2px_rgba(14,26,64,.05)] dark:border-neutral-800 dark:shadow-none hover:border-brand-200 dark:hover:border-brand-500/45 hover:shadow-[0_10px_24px_-12px_rgba(14,26,64,.28)]',
        isLost && !isDragging && 'opacity-[.72]'
      )}
    >
      {edge && <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-[3px]', edge)} />}
      {/* O link ENVOLVE o conteúdo em vez de esticar uma camada por cima: com
          uma camada, os tooltips dos chips, do motivo da perda e do consultor
          parariam de aparecer. draggable={false} deixa o arrasto com o
          <article>, então a imagem arrastada continua sendo o card e o arrasto
          não leva a URL. */}
      <LeadLink
        leadId={lead.id}
        draggable={false}
        className="block rounded-t-[11px] pl-[13px] pr-3 pt-2.5 pb-[9px] cursor-grab active:cursor-grabbing outline-none focus-visible:ring-inset focus-visible:anel-foco"
      >
        <div className="flex items-center gap-2">
          {/* O nome NUNCA muda de cor: é identidade. Urgência é trabalho da
              etiqueta, da borda e da linha do compromisso. */}
          <span
            className={cn('flex-1 min-w-0 truncate text-[14px] font-semibold leading-[1.3]',
              isLost ? 'text-slate-700 dark:text-neutral-300' : 'text-gray-900 dark:text-white')}
            title={lead.name}
          >
            {lead.name}
          </span>
          {badge && (
            <span className={cn(
              'shrink-0 h-5 px-2 rounded-full inline-flex items-center text-[11px] font-semibold whitespace-nowrap',
              badge.className
            )}>
              {badge.label}
            </span>
          )}
        </div>

        <div className={cn('mt-[3px] flex items-center gap-1.5 min-w-0 text-[12px] font-semibold', COMMITMENT_TONE[tone])}>
          {lead._renewalCard ? (
            marcoTratado ? (
              <>
                <Check className="size-3 shrink-0" strokeWidth={2.2} />
                <span className="truncate">Marco de {lead._renewalDays} dias tratado</span>
              </>
            ) : (
              <>
                <AlertCircle className="size-3 shrink-0" strokeWidth={2.2} />
                <span className="truncate">Aguardando contato</span>
              </>
            )
          ) : isWon ? (
            <>
              <CheckCircle className="size-3 shrink-0" strokeWidth={2.2} />
              <span className="shrink-0">{convertedAt ? 'Fechou' : 'Matriculado'}</span>
              {convertedAt && <span className="truncate font-medium tabular-nums">{relWhen(convertedAt)}</span>}
            </>
          ) : isLost ? (
            <>
              <Ban className="size-3 shrink-0" strokeWidth={2.2} />
              <span className="truncate font-medium" title={lead.lossReason || 'Perdido'}>{lead.lossReason || 'Perdido'}</span>
            </>
          ) : hasFollowUp ? (
            <>
              <FollowUpIcon type={lead.nextFollowUpType} className="size-3 shrink-0" />
              <span className="shrink-0">{followUpLabel(lead.nextFollowUpType)}</span>
              <span className={cn('truncate font-medium tabular-nums', tone === 'normal' && 'text-slate-500 dark:text-neutral-400')}>
                {relWhen(lead.nextFollowUp)}
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="size-3 shrink-0" strokeWidth={2.2} />
              <span className="truncate">Sem agendamento</span>
            </>
          )}
        </div>

        {chips.length > 0 && (
          // Chip em bloco, com reticências: o inline-flex de antes cortava a
          // palavra no meio ("Condicionamento físic"). Com dois chips, o
          // segundo encolhe antes do primeiro.
          <div className="mt-2 flex min-w-0 gap-1">
            {chips.map((c, i) => (
              <span
                key={c}
                title={c}
                className={cn(
                  'block h-5 min-w-0 max-w-full truncate rounded-md border border-[#e3e7ef] dark:border-neutral-800 px-[7px] text-[11px] leading-[18px] text-slate-600 dark:text-neutral-400',
                  chips.length > 1 && i === 0 && 'shrink-0 max-w-[48%]'
                )}
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </LeadLink>

      <div className="flex h-8 items-center gap-1.5 border-t border-[#e6eaf2] dark:border-neutral-800 pl-[13px] pr-2.5 text-[11.5px]">
        {lead.consultantName && <InitialsAvatar name={lead.consultantName} size={18} textSize={8} />}
        {/* Segundo link do card, para o lado esquerdo do rodapé também abrir a
            ficha. Fora da ordem do Tab, como a setinha: os três links do card
            levam ao mesmo lugar, então o teclado para uma vez só, no link de
            cima. O aria-label começa pelo texto que está na tela e só
            depois diz para onde vai: sem ele, quem usa leitor de tela ouve um
            link chamado "Sem responsável", que não leva a lugar nenhum pelo
            nome; e sem o nome do consultor dentro dele, some da leitura quem é
            o dono do lead. O title continua sendo o tooltip do mouse. */}
        <LeadLink
          leadId={lead.id}
          draggable={false}
          tabIndex={-1}
          className="flex-1 min-w-0 truncate text-slate-500 dark:text-neutral-400 cursor-grab active:cursor-grabbing outline-none"
          title={lead.consultantName ? `Consultor: ${lead.consultantName}` : undefined}
          aria-label={`${lead.consultantName || 'Sem responsável'}, abrir ficha de ${lead.name}`}
        >
          {lead.consultantName || 'Sem responsável'}
        </LeadLink>

        {/* Ações no rodapé — nunca sobrepostas ao conteúdo. No hover cedem o
            espaço do silêncio; em telas de toque ficam sempre visíveis.
            has-[:focus-visible] e não focus-within: depois de um clique de
            mouse no link o foco FICA no link, e com focus-within o card
            continuava mostrando as ações e escondendo o valor até a pessoa
            clicar em outro lugar. O teclado continua abrindo as ações, porque
            aí o foco é visível. */}
        <span className="shrink-0 hidden group-hover:flex group-has-[:focus-visible]:flex pointer-coarse:flex items-center gap-0.5">
          <button
            type="button"
            data-no-pan="true"
            onClick={() => onMoveRequest(lead)}
            title="Mover para outra etapa"
            aria-label="Mover lead para outra etapa"
            className="size-6 grid place-items-center rounded-[7px] text-slate-400 hover:bg-[#EAF0FF] hover:text-brand-600 dark:hover:bg-brand-500/15 dark:hover:text-brand-300 focus-visible:outline-none focus-visible:anel-foco transition-colors"
          >
            <ArrowRightLeft className="size-3" />
          </button>
          {/* Clique simples aqui abre a ficha em OUTRA GUIA e o Pipeline fica
              intacto nesta. É assim que o consultor abre vários cards sem sair
              do quadro. Ctrl+clique e botão do meio abrem a guia em segundo
              plano, coisa que nenhum site consegue forçar num clique comum.
              pointer-coarse:hidden porque abrir vários cards é coisa de mouse:
              no celular e no tablet um toque aqui sairia do app para uma guia
              nova, com o app carregando do zero e sem o Voltar. Ali o toque no
              corpo do card já abre a ficha na mesma tela.
              O data-no-pan é redundante (o <article> já tem, e o pan procura
              com closest), e fica de propósito: é a mesma defesa do botão
              Mover ao lado, e ninguém precisa ir conferir o ancestral.
              tabIndex={-1} pelo mesmo motivo do link do consultor: é o terceiro
              caminho para a MESMA ficha, e sem ele o Tab pararia três vezes em
              cada card. Quem usa teclado abre em outra guia pelo link de cima,
              com Ctrl+Enter. */}
          <LeadLink
            leadId={lead.id}
            draggable={false}
            data-no-pan="true"
            tabIndex={-1}
            target="_blank"
            rel="noopener"
            title="Abrir ficha em outra guia"
            aria-label="Abrir ficha em outra guia"
            className="size-6 pointer-coarse:hidden grid place-items-center rounded-[7px] text-slate-400 hover:bg-[#EAF0FF] hover:text-brand-600 dark:hover:bg-brand-500/15 dark:hover:text-brand-300 focus-visible:outline-none focus-visible:anel-foco transition-colors"
          >
            <ArrowUpRight className="size-3" />
          </LeadLink>
        </span>

        <span className={cn(
          'shrink-0 font-semibold tabular-nums group-hover:hidden group-has-[:focus-visible]:hidden pointer-coarse:hidden',
          wonValue ? 'text-[#0F9D6E] dark:text-emerald-300' : SILENCE_TONE[silence.tone]
        )}>
          {wonValue || silence.text}
        </span>
      </div>
    </article>
  );
});

// Coluna como faixa: fundo próprio, a régua da cor da etapa no alto, o nome em
// letra normal, o total e quantos estão atrasados. A lista reserva o lugar da
// barra de rolagem (scrollbar-gutter: stable), então o card tem a mesma
// largura na coluna que rola e na que não rola, e a barra não encosta nele.
// React.memo: o hover do drag (draggedOverColumn) re-renderiza SÓ as 2
// colunas afetadas via isHovered.
const KanbanColumn = memo(function KanbanColumn({
  name, color, special, columnLeads, note = null, isHovered, totalCount = null, showLate = true,
  draggingLeadId, interactionIndex, hasMore = false, onLoadMore = null, loadingMore = false,
  onColumnDragOver, onColumnDragLeave, onDropLead,
  onDragStart, onDragEnd, onMoveRequest,
}) {
  const accent = getKanbanColumnAccent(color);
  const isWinCol = special === 'win';
  const isLossCol = special === 'loss';
  // Paginação da coluna: 10 por vez. Renderizar a lista inteira enche uma
  // coluna que ninguém rola até o fim — e, nas terminais, trava o board.
  // "Carregar mais" revela os próximos 10 do que já está em memória; quando
  // acaba, cede a vez ao onLoadMore (que busca a próxima página no
  // Firestore, hoje só na coluna Perda).
  const [visibleCount, setVisibleCount] = useState(KANBAN_PAGE_SIZE);
  const shownLeads = columnLeads.length > visibleCount ? columnLeads.slice(0, visibleCount) : columnLeads;
  const localHasMore = columnLeads.length > shownLeads.length;
  const now = new Date();
  const late = !special && showLate ? columnLeads.filter((l) => isOverdueLead(l, now)).length : 0;
  // A Venda soma o valor dos contratos que estão na coluna (contrato sem valor
  // fica de fora, como no Gerencial).
  const money = isWinCol
    ? columnLeads.reduce((sum, l) => {
      const v = Number(l.currentContractValue);
      return l.currentContractValue != null && Number.isFinite(v) ? sum + v : sum;
    }, 0)
    : 0;
  const emptyText = isHovered
    ? 'Soltar aqui'
    : isWinCol
      ? 'Nenhuma venda aqui'
      : isLossCol
        ? 'Arraste para marcar perda'
        : 'Nenhum lead nesta etapa';

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
        'relative w-[280px] shrink-0 flex flex-col max-h-full rounded-[14px] border transition-colors',
        isHovered
          ? 'border-brand-200 bg-brand-50 ring-2 ring-brand-100 dark:border-brand-500/40 dark:bg-brand-500/[0.08] dark:ring-brand-500/30'
          : 'border-paper-200 bg-paper-100/80 dark:border-white/[0.06] dark:bg-white/[0.03]'
      )}
    >
      <span aria-hidden="true" className="absolute inset-x-3 top-0 h-[3px] rounded-b-[3px]" style={{ background: accent.border }} />
      <header className="flex shrink-0 items-center gap-2 px-3.5 pt-3.5 pb-2.5">
        <h3 className="min-w-0 truncate text-[13.5px] font-semibold text-gray-900 dark:text-white" title={name}>
          {name}
        </h3>
        <span className="shrink-0 rounded-[7px] border border-paper-200 bg-white px-1.5 text-[11.5px] font-bold leading-[18px] text-slate-500 tabular-nums dark:border-white/[0.08] dark:bg-neutral-900 dark:text-neutral-400">
          {totalCount != null ? totalCount : columnLeads.length}
        </span>
        {note && (
          <span className="min-w-0 truncate text-[11.5px] text-slate-500 dark:text-neutral-400" title={note}>
            {note}
          </span>
        )}
        {money > 0 ? (
          <span className="ml-auto shrink-0 text-[12px] font-bold text-[#0F9D6E] tabular-nums dark:text-emerald-300">{fmtBRL(money)}</span>
        ) : late > 0 ? (
          <span className="ml-auto shrink-0 text-[11.5px] font-semibold text-[#E11D48] tabular-nums dark:text-rose-400">
            {late} {late === 1 ? 'atrasado' : 'atrasados'}
          </span>
        ) : null}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable] flex flex-col gap-2 pl-2.5 pr-1 pt-0.5 pb-3 custom-scrollbar">
        {columnLeads.length === 0 ? (
          <div
            className={cn(
              // A altura do card, pra não haver salto ao soltar.
              'min-h-[116px] rounded-[11px] border-[1.5px] border-dashed grid place-items-center text-[12.5px] text-center px-3 transition-colors',
              isHovered
                ? 'border-brand-300 text-brand-600 dark:border-brand-500/40 dark:text-brand-300'
                : 'border-slate-300 text-slate-500 dark:border-neutral-700 dark:text-neutral-400'
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
                isDragging={draggingLeadId === lead.id}
                lastDate={lastInteractionDateOf(lead, interactionIndex)}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onMoveRequest={onMoveRequest}
              />
            ))}
            {localHasMore ? (
              <button
                type="button"
                onClick={() => setVisibleCount(v => v + KANBAN_PAGE_SIZE)}
                className="mt-0.5 py-2 text-center text-[12px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
              >
                Carregar mais <span className="tabular-nums font-normal text-slate-500 dark:text-neutral-400">({columnLeads.length - shownLeads.length})</span>
              </button>
            ) : onLoadMore && hasMore ? (
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="mt-0.5 py-2 text-center text-[12px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 disabled:opacity-50 transition-colors"
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

function KanbanView({ leads, interactions, appUser, statuses, usersList, lossReasons, db, funnels, selectedFunnelId: savedFunnelId, setSelectedFunnelId: rememberFunnel }) {
  const toast = useToast();
  const [moveLead, setMoveLead] = useState(null); // lead com o menu "Mover" aberto (toque/teclado)
  // Responsável é quem vende: o professor não é dono de lead e fica fora do
  // filtro e do endereço (isSeller, em src/lib/acesso.js).
  const sellers = useMemo(() => (usersList || []).filter(isSeller), [usersList]);
  // Funil, responsáveis e atraso vêm do endereço: F5 mantém, o link abre igual
  // e cada aba pode estar num recorte diferente. Sem funil no endereço vale o
  // último funil usado, que o App guarda por academia no navegador.
  // Responsável: conjunto vazio é toda a equipe, e sem nada no endereço vale o
  // padrão do papel (a carteira do consultor, a equipe do gestor), regra em
  // lib/kanban.js. Aqui a seção Responsável é de todos, então o parâmetro vale
  // para qualquer papel.
  // O mês de cadastro (a safra) também vem do endereço. Sem ele, todos os
  // meses: o quadro de sempre (spec 2026-10-16-pipeline-acertado-e-mes).
  const currentKey = monthKeyOf(new Date());
  const paramsCtx = useMemo(() => ({
    users: sellers,
    funis: funnels,
    funilPadrao: savedFunnelId,
    podeResp: true,
    respPadrao: defaultRespFilterFor(appUser),
    currentKey,
  }), [sellers, funnels, savedFunnelId, appUser, currentKey]);
  const [{ funnel, monthKey, resp: respFilter, overdue: onlyOverdue }, setParams] = useScreenParams('kanban', paramsCtx);
  const selectedFunnelId = funnel;
  const [lossModalLeadId, setLossModalLeadId] = useState(null);
  // Lead aguardando matrícula no ContractModal (caminho de Venda do Kanban).
  const [matriculaLead, setMatriculaLead] = useState(null);
  const [draggingLeadId, setDraggingLeadId] = useState(null);
  const [draggedOverColumn, setDraggedOverColumn] = useState(null);

  const kanbanScrollRef = useRef(null);
  // Lados do quadro com colunas escondidas: neles as colunas esfumam em vez
  // de serem cortadas secas. Só muda de estado quando um lado vira, então rolar
  // não renderiza a tela a cada pixel.
  const [hiddenSides, setHiddenSides] = useState({ left: false, right: false });
  const updateHiddenSides = useCallback(() => {
    const el = kanbanScrollRef.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setHiddenSides((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);
  // O ResizeObserver avisa ao montar, quando a janela muda e quando entram ou
  // saem colunas (ele observa também a fileira de colunas).
  useEffect(() => {
    const el = kanbanScrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(updateHiddenSides);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [updateHiddenSides]);
const dragScrollRef = useRef({
  isDown: false,
  startX: 0,
  scrollLeft: 0
});
const [isPanning, setIsPanning] = useState(false);

  const defaultFunnelId = useMemo(() => getDefaultFunnel(funnels)?.id || null, [funnels]);

  // Os funis de clientes não têm mês de cadastro: neles o período some e o
  // quadro é o de sempre, mesmo com `mes` no endereço.
  const isClientFunnelView = isClientFunnel((funnels || []).find((f) => f.id === selectedFunnelId));
  const safra = useMemo(() => {
    if (!monthKey) return null;
    const { start, end } = monthRange(monthKey);
    return { startMs: start.getTime(), endMs: end.getTime() };
  }, [monthKey]);
  const boardSafra = isClientFunnelView ? null : safra;

  const funnelLeads = useMemo(
    () => (leads || []).filter(l => isItemInFunnel(l, selectedFunnelId, defaultFunnelId)
      && (!boardSafra || createdInWindow(l, boardSafra.startMs, boardSafra.endMs))),
    [leads, selectedFunnelId, defaultFunnelId, boardSafra]
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
  // Neste funil o mês do endereço é o de VENCIMENTO do contrato (nos funis de
  // leads é o de cadastro). Sem mês, é o funil de sempre: todos que venceram.
  const expiredWindow = useMemo(() => expiredWindowOf(safra, expiredCutoffMs), [safra, expiredCutoffMs]);
  const expiredSpec = useMemo(
    () => (isExpiredView ? expiredClientsQuerySpec(expiredWindow.beforeMs, KANBAN_PAGE_SIZE, expiredWindow.afterMs) : null),
    [isExpiredView, expiredWindow]
  );
  const {
    items: expiredDocs, hasMore: expiredHasMore, loadMore: expiredLoadMore, patchItem: expiredPatchLead,
    error: expiredError,
  } = usePagedLeads({
    db, path: LEADS_PATH, spec: expiredSpec, specKey: `vencidos:${isExpiredView ? '1' : '0'}:${monthKey || ''}`,
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

  // FUNIL UPGRADE (funil de sistema): cliente que o consultor colocou à mão
  // para vender um plano melhor. Mesmo molde do Vencidos — query própria só
  // com a aba aberta, projeção em memória, o status real continua 'Venda' —
  // com uma diferença: ninguém cai aqui sozinho, a entrada é pela ficha e
  // grava upgradeStageId. Regras em lib/upgradeFunnel.js.
  const upgradeFunnel = useMemo(() => getUpgradeFunnel(funnels), [funnels]);
  const isUpgradeView = Boolean(upgradeFunnel && selectedFunnelId === upgradeFunnel.id);
  const [upgradeCountEpoch, setUpgradeCountEpoch] = useState(0);
  const upgradeSpec = useMemo(() => (isUpgradeView ? upgradeClientsQuerySpec() : null), [isUpgradeView]);
  // normalizeLeadDoc: nextFollowUp/createdAt viram Date, senão todo card sai "sem agendamento".
  const {
    items: upgradeDocs, reload: upgradeReload, patchItem: upgradePatchLead, error: upgradeError,
  } = usePagedLeads({
    db, path: LEADS_PATH, spec: upgradeSpec, specKey: `upgrade:${isUpgradeView ? '1' : '0'}`,
    enabled: !!db && isUpgradeView, mapDoc: normalizeLeadDoc,
  });
  // Mesmo recorte do Vencidos: respFilter vale, onlyOverdue é ignorado (cliente
  // não tem follow-up de prospecção). A coluna Perda deste funil fica vazia:
  // quem recusou sai do funil, não muda de coluna.
  const upgradeLeads = useMemo(() => {
    if (!isUpgradeView) return EMPTY_LEADS;
    const cards = projectUpgradeLeads(upgradeDocs || [], statuses, upgradeFunnel?.id);
    return respFilter.length === 0 ? cards : cards.filter((l) => respFilter.includes(l.consultantId));
  }, [isUpgradeView, upgradeDocs, statuses, upgradeFunnel, respFilter]);

  // FUNIL RENOVAÇÕES (funil de sistema): cliente cujo contrato entrou na janela
  // dos marcos. Mesmo molde do Vencidos — projeção em memória, o status real
  // continua 'Venda' — com uma diferença: as COLUNAS são virtuais, derivadas
  // dos marcos da config, e ninguém arrasta entre elas. Regras em
  // lib/renewalFunnel.js.
  const { renewalCheckpoints, contractThresholdDays } = useGeneralConfig();
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
    pages: renewalPages,
    reload: renewalReload, patchLead: renewalPatchLead,
  } = useRenewalBoard({
    db, columns: renewalColumns, cutoffMs: expiredCutoffMs,
    enabled: !!db && isRenewalView,
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
    // Nos funis Vencidos e Upgrade os cards vêm da query própria já projetada,
    // não da assinatura de leads ativos — cliente não está no board de prospecção.
    () => (isExpiredView ? expiredLeads : isUpgradeView ? upgradeLeads : filterKanbanLeads(funnelLeads, { respFilter, onlyOverdue })),
    [isExpiredView, expiredLeads, isUpgradeView, upgradeLeads, funnelLeads, respFilter, onlyOverdue]
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
  // Com um mês escolhido, a Perda é a da safra: perdidos cadastrados no mês.
  // Mesmo índice #2 (bucketByFunnelInMonthQuerySpec, em leadQueries.js).
  const safraKey = boardSafra ? monthKey : '';
  const lostSpec = useMemo(
    () => (boardSafra
      ? bucketByFunnelInMonthQuerySpec(LIFECYCLE_BUCKETS.PERDA, lostFunnelId, boardSafra.startMs, boardSafra.endMs, KANBAN_PAGE_SIZE)
      : bucketByFunnelQuerySpec(LIFECYCLE_BUCKETS.PERDA, lostFunnelId, KANBAN_PAGE_SIZE)),
    [lostFunnelId, boardSafra]
  );
  const {
    items: lostDocs, loading: lostLoading, hasMore: lostHasMore,
    loadMore: lostLoadMore, reload: lostReload,
  } = usePagedLeads({
    db, path: LEADS_PATH, spec: lostSpec, specKey: `perda:${lostFunnelId || ''}:${safraKey}`,
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
  // Com um mês escolhido, a Venda é a da safra: os leads do funil cadastrados
  // no mês que viraram cliente, em qualquer data depois. Sem página: o mês vem
  // inteiro, como o mês corrente.
  const wonSpec = useMemo(
    () => (boardSafra && lostFunnelId
      ? bucketByFunnelInMonthQuerySpec(LIFECYCLE_BUCKETS.CLIENTE, lostFunnelId, boardSafra.startMs, boardSafra.endMs)
      : wonInMonthQuerySpec(month.startMs, month.endMs)),
    [boardSafra, lostFunnelId, month]
  );
  const {
    items: wonDocs, loading: wonLoading, reload: wonReload,
  } = usePagedLeads({
    db, path: LEADS_PATH, spec: wonSpec,
    specKey: boardSafra ? `venda-safra:${lostFunnelId || ''}:${safraKey}` : `venda:${monthYear}-${monthIndex}`,
    enabled: !!db,
  });
  // A query do mês corrente não escopa por funil (evita índice novo) — o
  // refino acontece aqui, sobre o MÊS INTEIRO, então a contagem da coluna é
  // exata. Na safra, quem a importação de clientes criou fica de fora, como
  // nos painéis: a data de cadastro dele é a da planilha.
  const wonLeads = useMemo(() => {
    if (onlyOverdue) return [];
    const base = (wonDocs || []).filter(l => (!lostFunnelId || l.funnelId === lostFunnelId) && !(boardSafra && isImportCreatedLead(l)));
    return respFilter.length === 0 ? base : base.filter(l => respFilter.includes(l.consultantId));
  }, [wonDocs, respFilter, onlyOverdue, lostFunnelId, boardSafra]);

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
    // Mesma coisa para o funil VENCIDOS, pelo mesmo motivo. Sem isto o arrasto
    // não achava o card e saía calado — e o cliente que fechou contrato ESTE mês
    // está em wonDocs como doc CRU, sem a flag _expiredCard: o guard não pegava
    // e o handler gravava o nome da etapa no status dele.
    if (isExpiredView) {
      (expiredSplit.cards || []).forEach((l) => m.set(l.id, l));
      (expiredSplit.declined || []).forEach((l) => m.set(l.id, l));
    }
    // Mesma coisa para o funil UPGRADE: o cliente que fechou contrato ESTE mês
    // está em wonDocs como doc cru, sem a flag _upgradeCard.
    if (isUpgradeView) {
      upgradeLeads.forEach((l) => m.set(l.id, l));
    }
    return m;
  }, [leads, lostDocs, wonDocs, isRenewalView, renewalSplit, isExpiredView, expiredSplit, isUpgradeView, upgradeLeads]);

  // E1d: total REAL de perdas do funil via getCountFromServer (o header da
  // coluna, depois do E1c, mostraria só a página carregada). Recontado quando
  // uma perda é marcada/desfeita (countEpoch).
  const [countEpoch, setCountEpoch] = useState(0);
  const { counts: funnelBucketCounts } = useFunnelCounts({
    db, path: LEADS_PATH, funnelId: lostFunnelId, buckets: PERDA_BUCKETS,
    enabled: !!db && !!lostFunnelId, reloadKey: countEpoch,
  });
  // Na safra, o total da Perda é a contagem do servidor sobre a consulta do mês.
  const safraLostCount = useLeadCount({
    db, path: LEADS_PATH, spec: boardSafra ? lostSpec : null,
    specKey: `perda-safra:${lostFunnelId || ''}:${safraKey}:${countEpoch}`, enabled: !!db && !!boardSafra && !!lostFunnelId,
  });
  // Recarrega a página E reconta a coluna Perda juntas.
  const refreshLost = useCallback(() => {
    lostReload();
    setCountEpoch((e) => e + 1);
  }, [lostReload]);
  // As recargas que rodam depois de uma gravação: o `onDone` do ContractModal e os handlers que
  // esperam o `await` (mover de etapa, recusar o upgrade, marcar perda). Esses callbacks são da
  // renderização em que a pessoa agiu, e com a internet fora a gravação pode terminar depois de o
  // mês ou o funil do quadro terem mudado: pelo closure, as recargas buscariam a consulta velha e
  // poriam os leads dela na coluna de agora. Por este ref são sempre as da última renderização,
  // e toda chamada de uma delas passa por aqui (a varredura dos chamadores do modal cobra).
  const reloadsRef = useLatestRef({ refreshLost, renewalReload, upgradeReload, wonReload });
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
    ? (boardSafra ? safraLostCount : funnelBucketCounts[LIFECYCLE_BUCKETS.PERDA])
    : undefined;

  // ── Abas de funil: contagem por funil (mesmo recorte de funnelLeads) ──
  // Total do funil VENCIDOS para o badge da aba: agregação no servidor, 1
  // leitura. O board dele não exclui ninguém no cliente (só separa quem recusou
  // numa coluna), então o número do servidor é exatamente o da tela.
  const expiredCountSpec = useMemo(
    () => (expiredFunnel ? expiredClientsQuerySpec(expiredWindow.beforeMs, null, expiredWindow.afterMs) : null),
    [expiredFunnel, expiredWindow]
  );
  const expiredCount = useLeadCount({
    db, path: LEADS_PATH, spec: expiredCountSpec,
    specKey: `vencidos:${expiredCutoffMs}:${monthKey || ''}`, enabled: !!db && !!expiredFunnel,
  });

  // Total do funil UPGRADE para o badge da aba: agregação no servidor, 1
  // leitura. O board não exclui ninguém no cliente, então o número bate.
  const upgradeCountSpec = useMemo(() => (upgradeFunnel ? upgradeClientsQuerySpec() : null), [upgradeFunnel]);
  // O epoch refaz a contagem depois de recusa ou fechamento pela própria tela; sem ele o número da aba ficava velho a sessão inteira.
  const upgradeCount = useLeadCount({
    db, path: LEADS_PATH, spec: upgradeCountSpec,
    specKey: `upgrade:${upgradeCountEpoch}`, enabled: !!db && !!upgradeFunnel,
  });

  // Total do funil RENOVAÇÕES: somado do que o board carregou, não do servidor.
  // A contagem agregada incluiria contrato cancelado e trancado, que o board
  // exclui — e excluir isso no servidor exigiria filtrar por
  // currentContractStatus, campo sem backfill que derrubaria em silêncio todo
  // cliente antigo que não o tem. Como cada coluna carrega a faixa INTEIRA
  // (useRenewalBoard não pagina), esta soma é o total de verdade.
  const renewalTotal = useMemo(() => {
    if (!isRenewalView) return null;
    let n = renewalSplit.declined.length;
    renewalSplit.cardsByColumn.forEach((cards) => { n += cards.length; });
    return n;
  }, [isRenewalView, renewalSplit]);

  const funnelCounts = useMemo(() => {
    const map = new Map();
    (funnels || []).forEach(f => {
      map.set(f.id, (leads || []).filter(l => isItemInFunnel(l, f.id, defaultFunnelId)
        && (!safra || createdInWindow(l, safra.startMs, safra.endMs))).length);
    });
    // Funil de SISTEMA projeta clientes: ninguém tem funnelId apontando para
    // ele, e o prop `leads` só traz o balde 'ativo' desde o flip da PR G. Contar
    // por funnelId dava ZERO num board cheio — era o bug. Cada um tem a fonte
    // que consegue ser exata:
    //   • Vencidos: o servidor.
    //   • Renovações: o próprio board. Fora da aba fica `null`, e o badge some
    //     em vez de mostrar um número que conta cancelado.
    if (expiredFunnel) map.set(expiredFunnel.id, expiredCount);
    if (renewalFunnel) map.set(renewalFunnel.id, renewalTotal);
    if (upgradeFunnel) map.set(upgradeFunnel.id, upgradeCount);
    return map;
  }, [funnels, leads, defaultFunnelId, safra, expiredFunnel, expiredCount, renewalFunnel, renewalTotal, upgradeFunnel, upgradeCount]);

  // Etapas de cada funil de leads, para a barrinha do menu de funis. Mesma base
  // do número de cada funil: todos os leads em aberto dele, com a safra quando
  // há mês escolhido.
  const partsByFunnel = useMemo(() => {
    const map = new Map();
    (funnels || []).filter((f) => !isClientFunnel(f)).forEach((f) => {
      const counts = new Map();
      (leads || []).forEach((l) => {
        if (!isItemInFunnel(l, f.id, defaultFunnelId)) return;
        if (safra && !createdInWindow(l, safra.startMs, safra.endMs)) return;
        counts.set(l.status, (counts.get(l.status) || 0) + 1);
      });
      const stages = (statuses || []).filter((st) => isItemInFunnel(st, f.id, defaultFunnelId));
      map.set(f.id, stageParts(stages, (name) => counts.get(name)));
    });
    return map;
  }, [funnels, leads, statuses, defaultFunnelId, safra]);

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
  // não inventa agendamento (ver P4). O que pode e o que gravar é regra de
  // src/lib/stageMove.js (a MESMA da ficha): cliente não volta a ser lead —
  // o card da coluna Venda do mês é arrastável, e antes isso "desfazia" a
  // conversão de um cliente com contrato.
  const applyMoveToStage = useCallback(async (lead, newStatus) => {
    const plan = planStageMove(lead, newStatus, { funnelId: lead.funnelId ? null : selectedFunnelId });
    if (!plan.ok) {
      toast.warning(stageMoveBlockMessage(lead, plan.reason));
      return;
    }
    try {
      // Etapa customizada com nome de matrícula ("Matriculado", "Convertido"...)
      // conta como conversão nas métricas — então precisa do carimbo de data.
      // Sem ele, a matrícula caía no mês do CADASTRO do lead, não no do
      // fechamento. O carimbo é do SDK, por isso entra aqui e não na regra pura.
      const leadPatch = withStageEntered(
        plan.stampConvertedAt ? { ...plan.patch, convertedAt: serverTimestamp() } : plan.patch,
        plan.stageChange,
        serverTimestamp()
      );

      await logInteraction(
        db, lead, appUser,
        { text: `Movido para a etapa [${newStatus}] via Kanban.`, type: 'status_change', ...plan.stageChange },
        leadPatch
      );
      // Histórico de aulas (dual-write best-effort): atribui a conversão à
      // última aula atendida do lead.
      if (plan.stampConvertedAt) {
        try { await markConvertingAula({ db, leadId: lead.id }); } catch (e) { console.error('markConvertingAula falhou', e); }
      }
      // Saiu da Perda: refaz query+contagem. Pelo ref, porque a gravação acima pode terminar depois
      // de o quadro ter trocado de mês ou de funil (internet fora), e aí vale a consulta de agora.
      if (lead.status === 'Perda') reloadsRef.current.refreshLost();
    } catch (err) {
      console.error("Erro Kanban:", err);
      toast.error('Não foi possível mover o lead. Tente novamente.');
    }
  }, [db, appUser, selectedFunnelId, toast, reloadsRef]);

  // A Venda no Kanban agora abre o ContractModal (plano/valor/vigência) em vez
  // de gravar direto — mesmo fluxo da ficha. A escrita do contrato + resumo do
  // lead + timeline acontece dentro do modal (lib/contracts.js).
  const openMatricula = useCallback((lead) => setMatriculaLead(lead), []);

  // ── Desfechos do card projetado de Renovações, num lugar só ──────────
  // O arrasto e o menu "Mover" chamam os MESMOS dois helpers. Estavam escritos
  // quatro vezes e já tinham divergido: o arrasto para a Perda gravava sem
  // checar permissão. Por isso a checagem mora aqui DENTRO — canEditLead é a
  // única política que existe, e hoje ela só pede que o usuário tenha vínculo
  // (authUid): gestor e consultor mexem no card de qualquer carteira.
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

  // ── Desfechos do card projetado do funil VENCIDOS ────────────────────────
  // Os dois caminhos da tela (arrasto e menu "Mover") passam por aqui, e é o
  // que impede eles de divergirem: a permissão morava só no arrasto, e o menu
  // gravava sem checar nada. As rules deixam qualquer membro do tenant
  // atualizar qualquer lead, então canEditLead é a única política que existe.
  const moveExpiredToStage = useCallback((lead, statusName) => {
    if (!canEditLead(appUser)) {
      toast.warning('Você não tem permissão para mover este lead.');
      return;
    }
    const etapa = (statuses || []).find(
      st => st.funnelId === expiredFunnel?.id && st.name === statusName
    );
    if (!etapa) return;
    // Sair da Perda de volta para uma etapa: a recusa deixa de valer, senão o
    // card sumiria das etapas na próxima renderização. Data e motivo saem junto.
    const patch = { reactivationStageId: etapa.id, ...renewalUndoDecline() };
    updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), patch)
      .then(() => expiredPatchLead(lead.id, patch))
      .catch(err => {
        console.error('Erro ao mover card do funil de vencidos', err);
        toast.error('Não foi possível mover o card.');
      });
  }, [appUser, db, toast, statuses, expiredFunnel, expiredPatchLead]);

  const declineExpired = useCallback((lead) => {
    if (!canEditLead(appUser)) {
      toast.warning('Você não tem permissão para alterar este lead.');
      return;
    }
    // Quando e por quê, como na Meta Diária. Nem o arrasto nem o menu Mover
    // perguntam o motivo, então vai 'Outro'.
    const patch = { ...renewalDeclineStamp(), reactivationStageId: null };
    updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), patch)
      .then(() => expiredPatchLead(lead.id, patch))
      .catch(err => {
        console.error('Erro ao marcar recusa no funil de vencidos', err);
        toast.error('Não foi possível mover o card.');
      });
  }, [appUser, db, toast, expiredPatchLead]);

  // ── Desfechos do card projetado do funil UPGRADE ────────────────────────
  // Arrasto e menu "Mover" passam por aqui. A etapa mora em upgradeStageId; o
  // status real continua 'Venda' (regra em lib/stageMove.js). Cada movimento
  // deixa evento na linha do tempo, por isso logInteraction e não updateDoc.
  const moveUpgradeToStage = useCallback((lead, statusName) => {
    if (!canEditLead(appUser)) {
      toast.warning('Você não tem permissão para mover este lead.');
      return;
    }
    const etapa = (statuses || []).find(
      (st) => st.funnelId === upgradeFunnel?.id && st.name === statusName
    );
    const plan = planUpgradeMove(lead, etapa);
    if (!plan.ok) { toast.warning(stageMoveBlockMessage(lead, plan.reason)); return; }
    const patch = plan.entering ? { ...plan.patch, upgradeEnteredAt: serverTimestamp() } : plan.patch;
    logInteraction(db, lead, appUser, { text: plan.interactionText, type: 'status_change' }, patch)
      .then(() => upgradePatchLead(lead.id, plan.patch))
      .catch((err) => {
        console.error('Erro ao mover card do funil Upgrade', err);
        toast.error('Não foi possível mover o card.');
      });
  }, [appUser, db, toast, statuses, upgradeFunnel, upgradePatchLead]);

  // "Não quis o upgrade": sai do funil e mais nada — a pessoa segue cliente.
  // Recarrega o board porque o card precisa sumir de verdade.
  const declineUpgrade = useCallback(async (lead, reason) => {
    if (!canEditLead(appUser)) {
      toast.warning('Você não tem permissão para alterar este lead.');
      return;
    }
    const plan = planUpgradeDecline(lead, reason);
    try {
      await logInteraction(
        db, lead, appUser,
        { text: plan.interactionText, type: 'status_change' },
        { ...plan.patch, upgradeDeclinedAt: serverTimestamp() }
      );
      reloadsRef.current.upgradeReload(); // pelo ref: a consulta de agora, se o quadro mudou na espera
      setUpgradeCountEpoch((e) => e + 1);
      toast.success('Recusa registrada. O cliente saiu do funil Upgrade e segue cliente.');
    } catch (err) {
      console.error('Erro ao registrar recusa de upgrade', err);
      toast.error('Não foi possível registrar a recusa.');
    }
  }, [appUser, db, toast, reloadsRef]);

  // "Não vai renovar": a MESMA flag que a Meta Diária usa. A pessoa NÃO vira
  // lead perdido — segue cliente, com ficha e contratos, e continua na aba
  // Clientes. Perda de venda != perda de funil.
  const declineRenewal = useCallback((lead) => {
    if (!canEditLead(appUser)) {
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
    if (!canEditLead(appUser)) {
      toast.warning('Você não tem permissão para mover este lead.');
      return;
    }
    const patch = renewalUndoDecline();
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
    if (!canEditLead(appUser)) {
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
    // MESMA bifurcação para o funil VENCIDOS. Este é o caminho do menu "Mover",
    // que existe porque drag nativo não dispara em tela de toque — e era o único
    // que não tinha guard nenhum: em tablet, mover um card de lá gravava o nome
    // da etapa no status de um CLIENTE.
    if (lead._expiredCard) {
      if (statusName === 'Venda') return openMatricula(lead);
      if (statusName === 'Perda') return declineExpired(lead);
      return moveExpiredToStage(lead, statusName);
    }
    // Funil UPGRADE: Venda abre o contrato, Perda pede o motivo e tira do
    // funil, etapa grava upgradeStageId.
    if (lead._upgradeCard) {
      if (statusName === 'Venda') return openMatricula(lead);
      if (statusName === 'Perda') { setLossModalLeadId(lead.id); return; }
      return moveUpgradeToStage(lead, statusName);
    }
    if (statusName === 'Venda') return openMatricula(lead);
    if (statusName === 'Perda') {
      // Cliente não vira lead perdido (src/lib/stageMove.js). O card cru da
      // coluna Venda do mês chega aqui sem flag de projeção — inclusive cliente
      // que está no funil Upgrade: recusar o upgrade é gesto da aba Upgrade
      // (card projetado), não daqui, senão sumiria do funil sem aviso.
      const loss = planLoss(lead);
      if (!loss.ok || loss.kind === 'upgrade') {
        toast.warning(stageMoveBlockMessage(lead, STAGE_MOVE_BLOCK.CLIENTE_NAO_VIRA_PERDA));
        return;
      }
      setLossModalLeadId(lead.id);
      return;
    }
    return applyMoveToStage(lead, statusName);
  };

  // ── Handlers de drag (desktop): extraem o leadId e delegam ao core ──
  const handleDrop = useCallback((e, newStatus) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    const lead = leadId && draggableById.get(leadId);
    if (!lead || lead.status === newStatus) return;
    if (!canEditLead(appUser)) {
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
    if (lead._expiredCard) return moveExpiredToStage(lead, newStatus);
    if (lead._upgradeCard) return moveUpgradeToStage(lead, newStatus);
    applyMoveToStage(lead, newStatus);
  }, [draggableById, appUser, toast, applyMoveToStage, undoRenewalDecline, moveExpiredToStage, moveUpgradeToStage]);

  const handleWinDrop = useCallback((e) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    const lead = leadId && draggableById.get(leadId);
    if (!lead || lead.status === 'Venda') return;
    if (!canEditLead(appUser)) {
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
    // canEditLead lá de baixo, e sem isso o arrasto gravaria sem passar por
    // guarda nenhuma.
    if (alvo?._renewalCard) {
      declineRenewal(alvo);
      return;
    }
    // Funil VENCIDOS: "não volta" é venda perdida, mas a pessoa NÃO vira lead
    // perdido — ela segue cliente, com ficha e contratos, e continua na aba
    // Clientes. O que muda é só a flag que já existe e que a Meta também usa.
    if (alvo?._expiredCard) return declineExpired(alvo);
    if (!alvo || alvo.status === 'Perda') return;
    if (!canEditLead(appUser)) {
      toast.warning('Você não tem permissão para alterar este lead.');
      return;
    }
    // Funil UPGRADE: a Perda do card projetado é "não quis o upgrade" — abre o
    // modal de motivo e confirmKanbanLoss chama declineUpgrade.
    if (alvo._upgradeCard) { setLossModalLeadId(alvo.id); return; }
    // Cliente não vira lead perdido (src/lib/stageMove.js). O card cru da
    // coluna Venda do mês é arrastável e chega aqui sem flag de projeção —
    // inclusive cliente que está no funil Upgrade: recusar o upgrade é gesto
    // da aba Upgrade (card projetado, tratado acima), não daqui.
    const loss = planLoss(alvo);
    if (!loss.ok || loss.kind === 'upgrade') {
      toast.warning(stageMoveBlockMessage(alvo, STAGE_MOVE_BLOCK.CLIENTE_NAO_VIRA_PERDA));
      return;
    }
    setLossModalLeadId(alvo.id);
  }, [draggableById, appUser, toast, declineRenewal, declineExpired]);

  const confirmKanbanLoss = async (reason) => {
    if (!lossModalLeadId) return;
    // draggableById e não `leads`: o card projetado do Upgrade e o doc cru da
    // coluna Venda do mês não estão no prop de leads ativos.
    const lead = draggableById.get(lossModalLeadId);
    if (!lead) return;
    const loss = planLoss(lead);
    if (!loss.ok) { setLossModalLeadId(null); toast.warning(stageMoveBlockMessage(lead, loss.reason)); return; }
    // Cliente no funil Upgrade: a Perda é "não quis o upgrade". Só pelo card
    // projetado da aba Upgrade — o doc cru da coluna Venda é barrado antes.
    if (lead._upgradeCard) {
      setLossModalLeadId(null);
      await declineUpgrade(lead, reason);
      return;
    }
    if (loss.kind === 'upgrade') {
      setLossModalLeadId(null);
      toast.warning(stageMoveBlockMessage(lead, STAGE_MOVE_BLOCK.CLIENTE_NAO_VIRA_PERDA));
      return;
    }
    try {
      await logInteraction(
        db, lead, appUser,
        { text: `Lead perdido. Motivo: ${reason}`, type: 'status_change', ...loss.stageChange },
        withStageEntered(
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
          ),
          loss.stageChange,
          serverTimestamp()
        )
      );
      // Só lead chega aqui: cliente é barrado antes (planLoss). Por isso não há
      // conversão histórica de aula a desfazer.

      setLossModalLeadId(null);
      // A coluna Perda não é ao vivo: refaz fetch+contagem, pelo ref (a consulta de agora, se o
      // quadro mudou de mês ou de funil enquanto a gravação esperava a internet).
      reloadsRef.current.refreshLost();
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
  // A carteira padrão do papel não conta como filtro: o consultor abre na
  // própria e a pílula fica apagada, como a do gestor na equipe inteira.
  const respIsDefault = isDefaultRespFilter(appUser, respFilter);
  // O período vale nos funis de leads (mês de cadastro) e em Vencidos (mês de
  // vencimento); Renovações e Upgrade não têm mês.
  const showPeriod = !isClientFunnelView || isExpiredView;
  const hasActiveFilters = !respIsDefault || onlyOverdue || (showPeriod && Boolean(safra));

  // Lista do filtro: o próprio usuário primeiro (é a carteira que ele mais
  // procura), o resto em ordem alfabética.
  const respOptions = useMemo(() => {
    const list = sellers.filter(u => u?.id);
    return [...list].sort((a, b) => {
      if (a.id === appUser?.id) return -1;
      if (b.id === appUser?.id) return 1;
      return (a.name || '').localeCompare(b.name || '', 'pt-BR');
    });
  }, [sellers, appUser]);

  // Período: "Todos os meses" primeiro e os 12 últimos meses. A seta "mês
  // anterior" desce a lista (de todos os meses para o mês atual, e dele para
  // trás); a "próximo mês" sobe até o mês atual e para ali. Para voltar a todos
  // os meses, a lista.
  const monthOptions = useMemo(() => kanbanMonthOptions(currentKey), [currentKey]);
  const monthValue = monthKey || KANBAN_ALL_MONTHS;
  const monthIdx = Math.max(0, monthOptions.findIndex((o) => o.key === monthValue));
  const pickMonth = (key) => setParams({ monthKey: key === KANBAN_ALL_MONTHS ? null : key });

  // Pílulas da barra, as mesmas dos painéis e dos Relatórios. `compact` é o
  // balão do celular, onde cada controle ocupa a largura toda.
  const filterControls = (compact) => (
    <>
      {showPeriod && (
        <PeriodControl
          label={isExpiredView && monthKey ? `Venceram em ${monthOptions[monthIdx]?.label.toLowerCase()}` : monthOptions[monthIdx]?.label}
          options={monthOptions}
          value={monthValue}
          onPick={pickMonth}
          canPrev={monthIdx < monthOptions.length - 1}
          onPrev={() => pickMonth(monthOptions[monthIdx + 1].key)}
          canNext={monthIdx > 1}
          onNext={() => pickMonth(monthOptions[monthIdx - 1].key)}
          ariaLabel={isExpiredView ? 'Mês de vencimento dos contratos' : 'Mês de cadastro dos leads'}
        />
      )}
      {!compact && showPeriod && <span aria-hidden="true" className="h-[22px] w-px shrink-0 bg-border" />}
      {/* Carteira: aberta para a equipe inteira, gestor ou consultor. Quem
          manda no que aparece é este filtro — a base que chega na tela é
          sempre a academia toda (ver lib/kanban.js). */}
      <ConsultoresControl
        resp={respFilter}
        people={respOptions}
        onResp={(ids) => setParams({ resp: ids })}
        active={!respIsDefault}
        compact={compact}
      />
      <FilterChip
        icon={AlertCircle}
        label="Situação"
        valueText={onlyOverdue ? 'Em atraso' : 'Todos'}
        active={onlyOverdue}
        options={SITUACAO_OPTIONS}
        value={onlyOverdue ? 'atraso' : 'todos'}
        onPick={(k) => setParams({ overdue: k === 'atraso' })}
      />
    </>
  );

  // Linha de apoio do título: o total e a etapa mais cheia do que está no
  // quadro agora (com a carteira, a situação e o mês escolhidos).
  const boardParts = stageParts(pipelineColumns, (name) => getLeadsByStatus(name).length);
  const boardSummary = funnelSummary(boardParts, isClientFunnelView ? 'clientes' : 'leads');

  // O que soltar em Venda e em Perda faz em cada funil (os handlers são os das
  // colunas; só o texto muda).
  const exitLabels = isRenewalView ? EXIT_LABELS.renewal
    : isExpiredView ? EXIT_LABELS.expired
      : isUpgradeView ? EXIT_LABELS.upgrade
        : EXIT_LABELS.lead;

  // Trocar de funil guarda a escolha no navegador (é ela que vale quando o
  // link não traz funil) e escreve no endereço.
  const pickFunnel = (id) => { rememberFunnel(id); setParams({ funnel: id }); };

  return (
    <>
      {/* Full-bleed: cancela o padding do container para o quadro correr de
          borda a borda. A altura
          é a da área de conteúdo mais o recuo dela (100% + 2rem / 4rem), e
          não 100vh - 4rem: com a faixa do teste, da mensalidade ou do
          "Acessar como", o 100vh passava do fim da tela e a barra de
          rolagem do quadro sumia embaixo. */}
      <div className="-m-4 md:-m-8 h-[calc(100%+2rem)] md:h-[calc(100%+4rem)] flex flex-col animate-fade-in">
        {/* Cabeçalho no cartão dos painéis (FilterBar, o mesmo do Gerencial,
            do CRM e do Operacional): o funil é o título, com o seletor, e a
            linha de apoio diz o total e onde os leads estão; à direita, as
            pílulas de filtro. */}
        <FilterBar
          className="shrink-0 md:px-7"
          title={(
            <FunnelSwitcher
              funnels={funnels}
              selectedId={selectedFunnelId}
              counts={funnelCounts}
              partsOf={(id) => partsByFunnel.get(id)}
              onSelect={pickFunnel}
            />
          )}
          subline={(
            <>
              <span>{boardSummary}</span>
              <StageBar parts={boardParts} className="ml-2.5 inline-flex w-[132px] align-middle" />
            </>
          )}
        >
          <div className="hidden md:flex items-center gap-2">{filterControls(false)}</div>

          {/* No celular os filtros entram num balão, como nos Relatórios: o
              botão acende e ganha um ponto quando há filtro fora do padrão. */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={hasActiveFilters ? 'Filtros do Pipeline, há filtro ativo' : 'Filtros do Pipeline'}
                className={cn(
                  'relative md:hidden size-[38px] shrink-0 rounded-[11px] border grid place-items-center transition-colors',
                  FOCUS_RING,
                  hasActiveFilters
                    ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-500/15 dark:border-brand-500/30 dark:text-brand-300'
                    : 'bg-card border-border text-muted-foreground'
                )}
              >
                <SlidersHorizontal className="size-[17px]" aria-hidden="true" />
                {hasActiveFilters && <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-brand-600" />}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" aria-label="Filtros" className="flex w-[288px] max-h-(--radix-popover-content-available-height) flex-col gap-2.5 overflow-y-auto overscroll-y-contain rounded-[14px] border-border shadow-card-lg [&>*]:shrink-0">
              {filterControls(true)}
            </PopoverContent>
          </Popover>
        </FilterBar>

        {/* O board dos funis de sistema é alimentado por uma busca própria, e o
            número da aba vem de uma CONTAGEM separada. Quando a busca falha, o
            usePagedLeads devolve lista vazia e a tela mostrava "Sem leads" com
            a aba cheia — foi assim que o Vencidos ficou semanas parecendo um
            funil vazio. Agora ele fala. */}
        {isExpiredView && expiredError && (
          <div className="mx-4 md:mx-7 mt-1 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
            <AlertCircle className="size-4 shrink-0 mt-px text-amber-600 dark:text-amber-400" />
            <span className="text-[12.5px] text-amber-900 dark:text-amber-200">
              Não deu para carregar os clientes vencidos agora. O número na aba vem de outra
              consulta, por isso ele continua aparecendo. Recarregue a página; se persistir, avise o suporte.
            </span>
          </div>
        )}

        {isUpgradeView && upgradeError && (
          <div className="mx-4 md:mx-7 mt-1 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
            <AlertCircle className="size-4 shrink-0 mt-px text-amber-600 dark:text-amber-400" />
            <span className="text-[12.5px] text-amber-900 dark:text-amber-200">
              Não deu para carregar o funil Upgrade agora. O número na aba vem de outra
              consulta, por isso ele continua aparecendo. Recarregue a página; se persistir, avise o suporte.
            </span>
          </div>
        )}

        {/* Board denso, num invólucro que segura a faixa de saída do arrasto */}
        <div className="relative flex-1 min-h-0 flex flex-col">
        <div
          ref={kanbanScrollRef}
          onMouseDown={handleKanbanMouseDown}
          onMouseMove={handleKanbanMouseMove}
          onMouseUp={stopKanbanPan}
          onMouseLeave={stopKanbanPan}
          onScroll={updateHiddenSides}
          className={cn(
            // mx no lugar de px: a borda do quadro fica alinhada com a do
            // cartão do título, e as colunas não aparecem cortadas no recuo,
            // fora do alinhamento.
            'flex-1 min-h-0 overflow-x-auto overscroll-x-contain overflow-y-hidden custom-scrollbar select-none mx-4 md:mx-7 pt-1 pb-5',
            hiddenSides.left && hiddenSides.right && '[mask-image:linear-gradient(to_right,transparent,#000_28px,#000_calc(100%-28px),transparent)]',
            hiddenSides.left && !hiddenSides.right && '[mask-image:linear-gradient(to_right,transparent,#000_28px)]',
            !hiddenSides.left && hiddenSides.right && '[mask-image:linear-gradient(to_left,transparent,#000_28px)]',
            isPanning ? 'cursor-grabbing' : 'cursor-grab'
          )}
        >
          <div className="flex gap-4 min-w-max h-full">
            {pipelineColumns.map((column) => (
              <KanbanColumn
                key={column.id}
                name={column.name}
                color={column.color}
                special={null}
                columnLeads={getLeadsByStatus(column.name)}
                // Vencidos: o volume mora na coluna de entrada, e é ela que
                // pagina. Renovações não pagina no servidor — a coluna carrega a
                // faixa inteira e o KanbanColumn revela de 10 em 10.
                // Card do Renovações não tem "Atrasado": o relógio dele é o vencimento.
                showLate={!isRenewalView}
                hasMore={isExpiredView && column.isEntry ? expiredHasMore : false}
                onLoadMore={isExpiredView && column.isEntry ? expiredLoadMore : null}
                isHovered={draggedOverColumn === column.name}
                draggingLeadId={draggingLeadId}
                interactionIndex={interactionIndex}
                onColumnDragOver={onColumnDragOver}
                onColumnDragLeave={onColumnDragLeave}
                onDropLead={onDropLead}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
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
              // Na safra o quadro inteiro já é do mês escolhido. Sem ela, a
              // Venda é a do mês corrente e diz qual.
              note={boardSafra ? null : month.label}
              isHovered={draggedOverColumn === 'Venda'}
              draggingLeadId={draggingLeadId}
              interactionIndex={interactionIndex}
              onColumnDragOver={onColumnDragOver}
              onColumnDragLeave={onColumnDragLeave}
              onDropLead={onDropLead}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
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
                    : isUpgradeView ? EMPTY_LEADS
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
              onMoveRequest={onMoveRequest}
            />
          </div>
        </div>

        {/* Faixa de saída: aparece só enquanto um card é arrastado, para Venda
            e Perda estarem ao alcance mesmo com as colunas delas fora da tela
            (com 5 etapas o quadro passa de 2.000 px). Solta pelos mesmos
            handlers das colunas. */}
        <ExitDock
          visible={Boolean(draggingLeadId)}
          labels={exitLabels}
          hovered={draggedOverColumn}
          onColumnDragOver={onColumnDragOver}
          onColumnDragLeave={onColumnDragLeave}
          onDropLead={onDropLead}
        />
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
          // Card do funil Renovações é renovação. Card do funil Upgrade é
          // renovação quando há contrato vivo (liga ao atual e emenda a
          // vigência) e nova matrícula quando o contrato venceu ou foi
          // cancelado. O modal em modo renovação NÃO carimba convertedAt.
          mode={
            matriculaLead._renewalCard || (matriculaLead._upgradeCard && hasLiveContract(matriculaLead, new Date(), contractThresholdDays))
              ? 'renovacao'
              : 'matricula'
          }
          lead={matriculaLead}
          appUser={appUser}
          db={db}
          onClose={() => setMatriculaLead(null)}
          onDone={({ stale } = {}) => {
            // `stale`: o modal já foi fechado pelo X (gravação pendente sem internet) e pode
            // ter sido reaberto. O quadro recarrega do mesmo jeito, porque a gravação valeu,
            // mas o modal de agora não fecha.
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
            // Fechou pelo Upgrade: o contrato novo tirou o cliente do funil
            // (buildMatriculaWrites), então o board precisa recarregar.
            const wasUpgrade = Boolean(matriculaLead?._upgradeCard);
            if (!stale) setMatriculaLead(null);
            if (wasPerda) reloadsRef.current.refreshLost();
            if (wasRenewal) reloadsRef.current.renewalReload();
            if (wasUpgrade) reloadsRef.current.upgradeReload();
            if (wasUpgrade) setUpgradeCountEpoch((e) => e + 1);
            // A venda recém-fechada precisa aparecer na coluna do mês, que
            // também não é ao vivo.
            reloadsRef.current.wonReload();
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
