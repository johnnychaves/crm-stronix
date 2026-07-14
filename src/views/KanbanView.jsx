import { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { isAdminUser, canEditLead, isConvertedStatusName } from '../lib/leads.js';
import { logInteraction } from '../lib/interactions.js';
import { withBucket } from '../lib/leadDerived.js';
import { getSafeDateOrNull } from '../lib/dates.js';
import { getDefaultFunnel, isItemInFunnel } from '../lib/funnels.js';
import { buildInteractionIndex, lastInteractionDateOf, isLeadActive, isHotLeadFromDate, isColdLeadFromDate } from '../lib/leadStatus.js';
import { usePagedLeads } from '../hooks/usePagedLeads.js';
import { useFunnelCounts } from '../hooks/useFunnelCounts.js';
import { bucketByFunnelQuerySpec, LIFECYCLE_BUCKETS } from '../lib/leadQueries.js';
import { LEADS_PATH } from '../lib/firebase.js';
import { filterKanbanLeads, partitionLeadsByStatus, getKanbanColumnAccent, getKanbanAvatarPalette, getKanbanInitials, fmtKanbanRelDate, fmtKanbanRelDateTime } from '../lib/kanban.js';
import { cn } from '@/lib/utils';
import { useToast } from '../contexts/ToastContext.jsx';
import { FollowUpIcon } from '../components/ui/Badges.jsx';
import { useLeadProfile } from '../contexts/LeadProfileContext.jsx';
import { LossReasonModal } from '../modals/LossReasonModal.jsx';
import { MatriculaModal } from '../modals/MatriculaModal.jsx';
import { AlertCircle, ArrowRightLeft, Ban, Check, CheckCircle, SlidersHorizontal, TrendingUp, Users } from 'lucide-react';
import { FunnelTabs } from '../components/layout/FunnelTabs.jsx';

// Avatar de iniciais compacto (card 22px / bubble 24px). O KanbanAvatar
// derivaria a fonte do tamanho; o protótipo fixa 9px/9.5px weight 700.
function InitialsAvatar({ name = '', size = 22, textSize = 9 }) {
  const [bg, fg] = getKanbanAvatarPalette(name);
  return (
    <span
      className="rounded-full grid place-items-center font-bold shrink-0"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: textSize }}
    >
      {getKanbanInitials(name)}
    </span>
  );
}

// Prop estável para colunas sem leads (ver getLeadsByStatus).
const EMPTY_LEADS = [];

// Buckets contados pelo useFunnelCounts (identidade estável entre renders).
const PERDA_BUCKETS = [LIFECYCLE_BUCKETS.PERDA];

// Card compacto (uma linha): barra de accent da etapa à esquerda, nome +
// temperatura, estado do follow-up e avatar do consultor à direita.
// React.memo: durante o drag só o card arrastado muda de prop (isDragging);
// os demais não re-renderizam. Handlers vêm estáveis (useCallback) do pai.
const KanbanCard = memo(function KanbanCard({ lead, columnColor, isDragging, lastDate, onDragStart, onDragEnd, onOpenProfile, onMoveRequest }) {
  const isWon = lead.status === 'Venda';
  const isLost = lead.status === 'Perda';
  const isOverdue =
    !isWon && !isLost &&
    lead.nextFollowUp instanceof Date &&
    !isNaN(lead.nextFollowUp.getTime()) &&
    lead.nextFollowUp < new Date();
  const accent = getKanbanColumnAccent(columnColor);
  // Mesma lógica do LeadTemperatureBadge, em emoji compacto.
  const isActiveLead = isLeadActive(lead);
  const isHot = isActiveLead && isHotLeadFromDate(lead, lastDate);
  const isCold = isActiveLead && !isHot && isColdLeadFromDate(lead, lastDate);
  const convertedAt = getSafeDateOrNull(lead.convertedAt);
  const hasFollowUp = lead.nextFollowUp instanceof Date && !isNaN(lead.nextFollowUp.getTime());

  return (
    <article
      data-no-pan="true"
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onDragEnd={onDragEnd}
      onClick={() => onOpenProfile(lead.id)}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-[10px] bg-white dark:bg-neutral-900 border py-2.5 pr-2.5 pl-3 overflow-hidden cursor-grab active:cursor-grabbing transition-all',
        isDragging
          ? 'opacity-80 z-50 shadow-xl border-brand-500'
          : 'border-[#e8ecf3] dark:border-neutral-800 hover:border-brand-200 dark:hover:border-brand-500/40 hover:shadow-[0_3px_10px_-2px_rgba(15,23,42,.10)]'
      )}
    >
      <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: accent.border }} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'text-[13px] font-semibold leading-[1.3] truncate',
              isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'
            )}
            title={lead.name}
          >
            {lead.name}
          </span>
          {isHot && (
            <span className="text-[10px] shrink-0" title="Lead com atividade recente ou agendamento próximo" aria-label="Lead quente">🔥</span>
          )}
          {isCold && (
            <span className="text-[10px] shrink-0" title="Lead sem interação há 7 dias ou mais" aria-label="Lead esfriando">❄️</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center text-[11px] whitespace-nowrap overflow-hidden">
          {isWon ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
              <CheckCircle className="size-[11px] shrink-0" />
              Matriculado{convertedAt ? ` ${fmtKanbanRelDate(convertedAt)}` : ''}
            </span>
          ) : isLost ? (
            <span
              className="inline-flex items-center gap-1 font-semibold text-slate-500 dark:text-neutral-400 min-w-0"
              title={lead.lossReason || 'Perdido'}
            >
              <Ban className="size-[11px] shrink-0" />
              <span className="truncate">{lead.lossReason || 'Perdido'}</span>
            </span>
          ) : hasFollowUp ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 font-semibold tabular-nums',
                isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-neutral-300'
              )}
            >
              <FollowUpIcon type={lead.nextFollowUpType} className="size-[11px] shrink-0" />
              {fmtKanbanRelDateTime(lead.nextFollowUp)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
              <AlertCircle className="size-[11px] shrink-0" />
              Sem agendamento
            </span>
          )}
        </div>
      </div>

      {/* O protótipo omite o botão "Mover"; preservamos a função para
          toque/teclado — aparece no hover (desktop) e sempre em telas
          de toque (pointer-coarse). */}
      <button
        type="button"
        data-no-pan="true"
        onClick={(e) => { e.stopPropagation(); onMoveRequest(lead); }}
        title="Mover para outra etapa"
        aria-label="Mover lead para outra etapa"
        className="absolute right-9 top-1/2 -translate-y-1/2 size-6 rounded-md grid place-items-center bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 shadow-sm text-gray-400 hover:text-brand-600 hover:border-brand-200 dark:text-neutral-500 dark:hover:text-brand-300 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100 transition-opacity"
      >
        <ArrowRightLeft className="size-3" />
      </button>

      {lead.consultantName && (
        <span title={`Consultor: ${lead.consultantName}`} className="shrink-0">
          <InitialsAvatar name={lead.consultantName} size={22} textSize={9} />
        </span>
      )}
    </article>
  );
});

// Coluna densa: sem card de fundo — header com régua na cor da etapa,
// cards em lista compacta com scroll interno. React.memo: o hover do drag
// (draggedOverColumn) re-renderiza SÓ as 2 colunas afetadas via isHovered.
const KanbanColumn = memo(function KanbanColumn({
  name, color, special, columnLeads, renderLimit = 0, isHovered, totalCount = null,
  draggingLeadId, interactionIndex, hasMore = false, onLoadMore = null, loadingMore = false,
  onColumnDragOver, onColumnDragLeave, onDropLead,
  onDragStart, onDragEnd, onOpenProfile, onMoveRequest,
}) {
  const accent = getKanbanColumnAccent(color);
  const isWinCol = special === 'win';
  const isLossCol = special === 'loss';
  // Colunas terminais (Venda/Perda) acumulam histórico; renderizar
  // todos os cards trava o board. Mostra os mais recentes e indica
  // quantos restam (acessíveis pela busca da tela de Leads).
  const shownLeads = renderLimit > 0 && columnLeads.length > renderLimit
    ? columnLeads.slice(0, renderLimit)
    : columnLeads;
  const hiddenCount = columnLeads.length - shownLeads.length;
  const emptyText = isWinCol
    ? 'Arraste para fechar venda'
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
        {isWinCol && <TrendingUp className="ml-auto size-[13px] shrink-0 text-emerald-700 dark:text-emerald-400" />}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pb-2 custom-scrollbar">
        {columnLeads.length === 0 ? (
          <div
            className={cn(
              'min-h-24 rounded-[10px] border-2 border-dashed grid place-items-center text-[10.5px] font-semibold uppercase tracking-[.06em] text-center px-3 transition-colors',
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
            {hiddenCount > 0 && (
              <div className="py-1.5 text-center text-[11px] font-medium text-slate-400 dark:text-neutral-500">
                + {hiddenCount} {hiddenCount === 1 ? 'lead mais antigo' : 'leads mais antigos'} · use a busca
              </div>
            )}
            {onLoadMore && hasMore && (
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="mt-0.5 py-2 text-center text-[11px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 disabled:opacity-50 transition-colors"
              >
                {loadingMore ? 'Carregando…' : 'Carregar mais'}
              </button>
            )}
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
  // Filtro de responsáveis multi-seleção: conjunto vazio = toda a equipe.
  const [respFilter, setRespFilter] = useState([]);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [lossModalLeadId, setLossModalLeadId] = useState(null);
  // Lead aguardando matrícula no MatriculaModal (caminho de Venda do Kanban).
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
  const kanbanLeads = useMemo(
    () => filterKanbanLeads(funnelLeads, { respFilter, onlyOverdue }),
    [funnelLeads, respFilter, onlyOverdue]
  );

  // Índice leadId → { count, lastDate }. Percorre interactions UMA vez,
  // evitando que cada card refaça interactions.filter()/getLastInteraction
  // (era O(cards × interações) a cada render/drag).
  const interactionIndex = useMemo(() => buildInteractionIndex(interactions), [interactions]);

  // Coluna Perda (E1c): em vez de fatiar TODAS as perdas do prop global, busca
  // as 50 mais recentes do funil por query (getDocs) + "Carregar mais". Ordena
  // por createdAt (índice #2 via bucketByFunnelQuerySpec) e NÃO por lostAt: o
  // backfill não materializou lostAt, e orderBy lostAt derrubaria perdas legadas
  // sem o campo. Não é ao vivo — recarrega (lostReload) ao marcar/desfazer perda.
  const lostFunnelId = selectedFunnelId || defaultFunnelId;
  const lostSpec = useMemo(
    () => bucketByFunnelQuerySpec(LIFECYCLE_BUCKETS.PERDA, lostFunnelId),
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
      if (lead.status === 'Perda') refreshLost(); // saiu da Perda: refaz query+contagem
    } catch (err) {
      console.error("Erro Kanban:", err);
      toast.error('Não foi possível mover o lead. Tente novamente.');
    }
  }, [db, appUser, selectedFunnelId, toast, refreshLost]);

  // A Venda no Kanban agora abre o MatriculaModal (plano/valor/vigência) em vez
  // de gravar direto — mesmo fluxo da ficha. A escrita do contrato + resumo do
  // lead + timeline acontece dentro do modal (lib/contracts.js).
  const openMatricula = useCallback((lead) => setMatriculaLead(lead), []);

  // Despacha um destino (etapa / Venda / Perda) com checagem de permissão.
  // Usada pelo menu "Mover" — funciona em toque, mouse e teclado, sem
  // depender do drag-and-drop nativo (que não dispara em telas de toque).
  const moveLeadToStatus = (lead, statusName) => {
    if (!lead || lead.status === statusName) return;
    if (!canEditLead(appUser, lead)) {
      toast.warning('Você não tem permissão para mover este lead.');
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
    const lead = leadId && leads.find(l => l.id === leadId);
    if (!lead || lead.status === newStatus) return;
    if (!canEditLead(appUser, lead)) {
      toast.warning('Você não tem permissão para mover este lead.');
      return;
    }
    applyMoveToStage(lead, newStatus);
  }, [leads, appUser, toast, applyMoveToStage]);

  const handleWinDrop = useCallback((e) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    const lead = leadId && leads.find(l => l.id === leadId);
    if (!lead || lead.status === 'Venda') return;
    if (!canEditLead(appUser, lead)) {
      toast.warning('Você não tem permissão para alterar este lead.');
      return;
    }
    openMatricula(lead);
  }, [leads, appUser, toast, openMatricula]);

  const handleLossDrop = useCallback((e) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    const lead = leadId && leads.find(l => l.id === leadId);
    if (!lead || lead.status === 'Perda') return;
    if (!canEditLead(appUser, lead)) {
      toast.warning('Você não tem permissão para alterar este lead.');
      return;
    }
    setLossModalLeadId(lead.id);
  }, [leads, appUser, toast]);

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
  const leadsByStatus = useMemo(() => partitionLeadsByStatus(kanbanLeads), [kanbanLeads]);
  const getLeadsByStatus = (statusName) => leadsByStatus.get(statusName) || EMPTY_LEADS;

  const pipelineColumns = (statuses || []).filter(s => isItemInFunnel(s, selectedFunnelId, defaultFunnelId));
  const totalFunnelLeads = funnelLeads.length;
  const isAdmin = isAdminUser(appUser);

  const hasActiveFilters = respFilter.length > 0 || onlyOverdue;
  const activeFilterCount = respFilter.length + (onlyOverdue ? 1 : 0);

  // Resumo à esquerda do botão de filtro: sem filtros mostra "X de Y leads";
  // com filtros, o recorte ativo ("Ana · Em atraso", "2 responsáveis"...).
  const filterSummary = useMemo(() => {
    if (!hasActiveFilters) return `${kanbanLeads.length} de ${totalFunnelLeads} leads`;
    const parts = [];
    if (respFilter.length === 1) {
      const user = (usersList || []).find(u => u.id === respFilter[0]);
      parts.push(user?.name || '1 responsável');
    } else if (respFilter.length > 1) {
      parts.push(`${respFilter.length} responsáveis`);
    }
    if (onlyOverdue) parts.push('Em atraso');
    return parts.join(' · ');
  }, [hasActiveFilters, kanbanLeads.length, totalFunnelLeads, respFilter, onlyOverdue, usersList]);

  const toggleResp = (id) => {
    setRespFilter(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const clearFilters = () => {
    setRespFilter([]);
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

          <div className="hidden md:block text-[11.5px] text-slate-500 dark:text-neutral-400 whitespace-nowrap tabular-nums shrink-0">
            <span className="font-semibold text-gray-700 dark:text-neutral-200">{filterSummary}</span>
          </div>

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

                {/* Consultor (não-admin) só vê os próprios leads — sem seção Responsável. */}
                {isAdmin && (
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
                    {(usersList || []).map(u => {
                      const selected = respFilter.includes(u.id);
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
                          {selected && <Check className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" strokeWidth={2.6} />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {isAdmin && <div className="mx-3.5 mt-1.5 border-t border-slate-100 dark:border-white/10" />}

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
              columnLeads={getLeadsByStatus('Venda')}
              renderLimit={50}
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
              columnLeads={lostLeads}
              renderLimit={0}
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
        <MatriculaModal
          lead={matriculaLead}
          appUser={appUser}
          db={db}
          onClose={() => setMatriculaLead(null)}
          onDone={() => setMatriculaLead(null)}
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
