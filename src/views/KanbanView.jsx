import { useState, useMemo, useRef } from 'react';
import { collection, doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { appId, LEADS_PATH, INTERACTIONS_PATH } from '../lib/firebase.js';
import { isAdminUser, canEditLead, getInteractionSecurityFields } from '../lib/leads.js';
import { getSafeDateOrNull } from '../lib/dates.js';
import { getDefaultFunnel, isItemInFunnel } from '../lib/funnels.js';
import { buildInteractionIndex } from '../lib/leadStatus.js';
import { getKanbanColumnAccent, fmtKanbanRelDate, fmtKanbanRelDateTime } from '../lib/kanban.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { KanbanAvatar } from '../components/ui/Avatar.jsx';
import { FunnelSelector } from '../components/ui/FunnelSelector.jsx';
import { TagBadge, LeadTemperatureBadge, DaysSinceContactBadge, FollowUpIcon } from '../components/ui/Badges.jsx';
import { LeadDetailsModal } from '../modals/LeadDetailsModal.jsx';
import { LossReasonModal } from '../modals/LossReasonModal.jsx';
import { Activity, AlertCircle, ArrowRightLeft, Ban, CheckCircle, Kanban, MessageCircle, Search, TrendingUp, Users } from 'lucide-react';

function KanbanView({ leads, interactions, appUser, statuses, usersList, tags, lossReasons, db, funnels, selectedFunnelId, setSelectedFunnelId }) {
  const toast = useToast();
  const [selectedLead, setSelectedLead] = useState(null);
  const [moveLead, setMoveLead] = useState(null); // lead com o menu "Mover" aberto (toque/teclado)
  const [consultantFilter, setConsultantFilter] = useState('');
  const [lossModalLeadId, setLossModalLeadId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [draggingLeadId, setDraggingLeadId] = useState(null);
  const [draggedOverColumn, setDraggedOverColumn] = useState(null);
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const kanbanScrollRef = useRef(null);
const dragScrollRef = useRef({
  isDown: false,
  startX: 0,
  scrollLeft: 0
});
const [isPanning, setIsPanning] = useState(false);

  const defaultFunnelId = useMemo(() => getDefaultFunnel(funnels)?.id || null, [funnels]);
  const currentFunnel = useMemo(
    () => (funnels || []).find(f => f.id === selectedFunnelId) || null,
    [funnels, selectedFunnelId]
  );

  const funnelLeads = useMemo(
    () => (leads || []).filter(l => isItemInFunnel(l, selectedFunnelId, defaultFunnelId)),
    [leads, selectedFunnelId, defaultFunnelId]
  );

  // Escopo dos KPIs: aplica apenas o recorte "de quem" (filtro de
  // consultor), NÃO os filtros de visualização do board (busca, "Em
  // atraso"). Sem isso, ligar "Em atraso" — que exclui Venda/Perda —
  // zerava os KPIs de Vendas/Perdas/Taxa, e buscar um nome distorcia
  // os totais. Os KPIs refletem o pipeline (do consultor) inteiro.
  const kpiScopeLeads = useMemo(() => {
    if (!consultantFilter) return funnelLeads;
    return funnelLeads.filter(l => l.consultantId === consultantFilter);
  }, [funnelLeads, consultantFilter]);

  const kanbanLeads = useMemo(() => {
    let filtered = kpiScopeLeads;
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      const searchDigits = searchTerm.replace(/\D/g, '');
      filtered = filtered.filter(l =>
        (l.name && l.name.toLowerCase().includes(lowerSearch)) ||
        (l.whatsapp && (l.whatsapp.includes(searchTerm) ||
          (searchDigits && String(l.whatsapp).replace(/\D/g, '').includes(searchDigits)))) ||
        (l.observation && l.observation.toLowerCase().includes(lowerSearch))
      );
    }
    if (onlyOverdue) {
      const now = new Date();
      filtered = filtered.filter(l =>
        l.status !== 'Venda' && l.status !== 'Perda' &&
        l.nextFollowUp instanceof Date && !isNaN(l.nextFollowUp.getTime()) &&
        l.nextFollowUp < now
      );
    }
    return filtered;
  }, [kpiScopeLeads, searchTerm, onlyOverdue]);

  const kanbanKpis = useMemo(() => {
    const now = new Date();
    const active = kpiScopeLeads.filter(l => l.status !== 'Venda' && l.status !== 'Perda');
    const won = kpiScopeLeads.filter(l => l.status === 'Venda');
    const lost = kpiScopeLeads.filter(l => l.status === 'Perda');
    const overdue = active.filter(l =>
      l.nextFollowUp instanceof Date && !isNaN(l.nextFollowUp.getTime()) && l.nextFollowUp < now
    );
    const winRate = (won.length + lost.length) > 0
      ? Math.round((won.length / (won.length + lost.length)) * 100)
      : 0;
    return {
      active: active.length,
      won: won.length,
      lost: lost.length,
      overdue: overdue.length,
      winRate
    };
  }, [kpiScopeLeads]);

  // Índice leadId → { count, lastDate }. Percorre interactions UMA vez,
  // evitando que cada card refaça interactions.filter()/getLastInteraction
  // (era O(cards × interações) a cada render/drag).
  const interactionIndex = useMemo(() => buildInteractionIndex(interactions), [interactions]);

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
  const applyMoveToStage = async (lead, newStatus) => {
    try {
      const payload = { status: newStatus };
      if (selectedFunnelId && !lead.funnelId) payload.funnelId = selectedFunnelId;
      if (lead.status === 'Venda') { payload.isConverted = false; payload.convertedAt = null; }
      if (lead.status === 'Perda') { payload.lossReason = null; payload.lostAt = null; }

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), payload);
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: `Movido para a etapa [${newStatus}] via Kanban.`,
        type: 'status_change',
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Erro Kanban:", err);
      toast.error('Não foi possível mover o lead. Tente novamente.');
    }
  };

  const applyWin = async (lead) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), {
        status: 'Venda',
        nextFollowUp: null,
        isConverted: true,
        convertedAt: serverTimestamp(),
        lossReason: null,
        lostAt: null
      });
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: `Matrícula realizada com sucesso! (Venda)`,
        type: 'status_change',
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Erro Venda:", err);
      toast.error('Não foi possível registrar a matrícula. Tente novamente.');
    }
  };

  // Despacha um destino (etapa / Venda / Perda) com checagem de permissão.
  // Usada pelo menu "Mover" — funciona em toque, mouse e teclado, sem
  // depender do drag-and-drop nativo (que não dispara em telas de toque).
  const moveLeadToStatus = (lead, statusName) => {
    if (!lead || lead.status === statusName) return;
    if (!canEditLead(appUser, lead)) {
      toast.warning('Você não tem permissão para mover este lead.');
      return;
    }
    if (statusName === 'Venda') return applyWin(lead);
    if (statusName === 'Perda') { setLossModalLeadId(lead.id); return; }
    return applyMoveToStage(lead, statusName);
  };

  // ── Handlers de drag (desktop): extraem o leadId e delegam ao core ──
  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    const lead = leadId && leads.find(l => l.id === leadId);
    if (!lead || lead.status === newStatus) return;
    if (!canEditLead(appUser, lead)) {
      toast.warning('Você não tem permissão para mover este lead.');
      return;
    }
    applyMoveToStage(lead, newStatus);
  };

  const handleWinDrop = (e) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    const lead = leadId && leads.find(l => l.id === leadId);
    if (!lead || lead.status === 'Venda') return;
    if (!canEditLead(appUser, lead)) {
      toast.warning('Você não tem permissão para alterar este lead.');
      return;
    }
    applyWin(lead);
  };

  const handleLossDrop = (e) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    const lead = leadId && leads.find(l => l.id === leadId);
    if (!lead || lead.status === 'Perda') return;
    if (!canEditLead(appUser, lead)) {
      toast.warning('Você não tem permissão para alterar este lead.');
      return;
    }
    setLossModalLeadId(lead.id);
  };

  const confirmKanbanLoss = async (reason) => {
    if (!lossModalLeadId) return;
const lead = leads.find(l => l.id === lossModalLeadId);
if (!lead) return;
    try {
      await updateDoc(
        doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lossModalLeadId),
        {
          status: 'Perda',
          lossReason: reason,
          nextFollowUp: null,
          lostAt: serverTimestamp(),
          // Limpa resquício caso o lead viesse da coluna Venda.
          isConverted: false,
          convertedAt: null
        }
      );

      await addDoc(
        collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH),
        {
          leadId: lossModalLeadId,
          consultantName: appUser.name,
          ...getInteractionSecurityFields(lead, appUser),
          text: `Lead perdido. Motivo: ${reason}`,
          type: 'status_change',
          createdAt: serverTimestamp()
        }
      );

      setLossModalLeadId(null);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível registrar a perda. Tente novamente.');
    }
  };

  const handleDragStart = (e, leadId) => {
    e.dataTransfer.setData('leadId', leadId);
    e.dataTransfer.effectAllowed = 'move';
    // Timeout to prevent the browser from capturing the modified styles in the drag ghost
    setTimeout(() => setDraggingLeadId(leadId), 0);
  };

  const handleDragEnd = () => {
    setDraggingLeadId(null);
    setDraggedOverColumn(null);
  };

  const getLeadsByStatus = (statusName) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfTomorrow = startOfToday + 86400000;

    const getPriority = (lead) => {
      if (!lead.nextFollowUp || !(lead.nextFollowUp instanceof Date) || isNaN(lead.nextFollowUp.getTime())) {
        return 4; // Lowest priority
      }
      const time = lead.nextFollowUp.getTime();
      if (time < now.getTime()) return 1; // Overdue
      if (time >= startOfToday && time < startOfTomorrow) return 2; // Today
      return 3; // Future
    };

    return (kanbanLeads || [])
      .filter(l => l.status === statusName)
      .sort((a, b) => {
        const pA = getPriority(a);
        const pB = getPriority(b);
        if (pA !== pB) return pA - pB;
        if (pA !== 4 && a.nextFollowUp && b.nextFollowUp) {
          return a.nextFollowUp.getTime() - b.nextFollowUp.getTime();
        }
        return (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0);
      });
  };

  const renderLeadCard = (lead, columnColor = 'gray') => {
    const isWon = lead.status === 'Venda';
    const isLost = lead.status === 'Perda';
    const isOverdue =
      !isWon && !isLost &&
      lead.nextFollowUp instanceof Date &&
      !isNaN(lead.nextFollowUp.getTime()) &&
      lead.nextFollowUp < new Date();
    const isDraggingThis = draggingLeadId === lead.id;
    const accent = getKanbanColumnAccent(columnColor);
    const idxEntry = interactionIndex.get(lead.id);
    const interactionCount = idxEntry?.count || 0;
    const convertedAt = getSafeDateOrNull(lead.convertedAt);
    let daysSince = null;
    if (!isWon && !isLost) {
      const last = idxEntry?.lastDate || lead.createdAt;
      if (last instanceof Date && !isNaN(last.getTime())) {
        daysSince = Math.max(0, Math.floor((Date.now() - last.getTime()) / 86400000));
      }
    }

    return (
      <article
        key={lead.id}
        data-no-pan="true"
        draggable
        onDragStart={(e) => handleDragStart(e, lead.id)}
        onDragEnd={handleDragEnd}
        onClick={() => setSelectedLead(lead)}
        style={{ borderTopColor: accent.border, borderTopWidth: 2 }}
        className={`group relative rounded-xl border bg-white dark:bg-neutral-900 cursor-grab active:cursor-grabbing shadow-sm transition-all ${
          isDraggingThis
            ? 'opacity-80 z-50 shadow-xl border-brand-500'
            : isOverdue
              ? 'border-rose-200 dark:border-rose-500/20 hover:border-rose-300 dark:hover:border-rose-500/40 hover:shadow-md'
              : 'border-gray-200 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700 hover:shadow-md'
        }`}
      >
        <div className="absolute top-2 right-2 z-10">
          <LeadTemperatureBadge lead={lead} lastInteractionDate={idxEntry?.lastDate} compact />
        </div>

        <div className="p-3 pb-2.5">
          <div className="flex items-start gap-2.5">
            <KanbanAvatar name={lead.name || ''} size={32} />
            <div className="min-w-0 flex-1 pr-14">
              <div
                className={`font-semibold text-[13.5px] leading-tight truncate ${
                  isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'
                }`}
                title={lead.name}
              >
                {lead.name}
              </div>
              <div
                className="text-[11.5px] text-gray-500 dark:text-neutral-400 truncate"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {lead.whatsapp}
              </div>
            </div>
          </div>

          {(lead.tags || []).length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {lead.tags.slice(0, 2).map(tagName => (
                <TagBadge key={tagName} tagName={tagName} tagsArray={tags} />
              ))}
              {lead.tags.length > 2 && (
                <span
                  className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400"
                  title={lead.tags.slice(2).join(', ')}
                >
                  +{lead.tags.length - 2}
                </span>
              )}
            </div>
          )}

          {(lead.source || interactionCount > 0) && (
            <div className="mt-2.5 flex items-center gap-2 text-[11px] text-gray-500 dark:text-neutral-400 min-w-0">
              {lead.source && (
                <span className="inline-flex items-center gap-1 truncate" title={lead.source}>
                  {lead.source}
                </span>
              )}
              {lead.source && interactionCount > 0 && (
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-neutral-700 shrink-0" />
              )}
              {interactionCount > 0 && (
                <span
                  className="inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  <MessageCircle className="w-3 h-3" /> {interactionCount}
                </span>
              )}
            </div>
          )}
        </div>

        <footer className="px-3 py-2 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between gap-2">
          {isWon ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap min-w-0 truncate">
              <CheckCircle className="w-3 h-3 shrink-0" />
              Matriculado{convertedAt ? ` ${fmtKanbanRelDate(convertedAt)}` : ''}
            </span>
          ) : isLost ? (
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-neutral-400 min-w-0 truncate"
              title={lead.lossReason || 'Perdido'}
            >
              <Ban className="w-3 h-3 shrink-0" />
              <span className="truncate">{lead.lossReason || 'Perdido'}</span>
            </span>
          ) : lead.nextFollowUp instanceof Date && !isNaN(lead.nextFollowUp.getTime()) ? (
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap ${
                isOverdue ? 'text-rose-600 dark:text-rose-300' : 'text-gray-600 dark:text-neutral-300'
              }`}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              <FollowUpIcon type={lead.nextFollowUpType} className="w-3 h-3" />
              {fmtKanbanRelDateTime(lead.nextFollowUp)}
            </span>
          ) : daysSince !== null && daysSince >= 1 ? (
            <DaysSinceContactBadge lead={lead} lastInteractionDate={idxEntry?.lastDate} />
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300 whitespace-nowrap">
              <AlertCircle className="w-3 h-3" /> Sem agendamento
            </span>
          )}
          <div className="flex items-center gap-1.5 shrink-0">
            {lead.consultantName && (
              <span title={`Consultor: ${lead.consultantName}`} className="shrink-0">
                <KanbanAvatar name={lead.consultantName} size={20} />
              </span>
            )}
            <button
              type="button"
              data-no-pan="true"
              onClick={(e) => { e.stopPropagation(); setMoveLead(lead); }}
              title="Mover para outra etapa"
              aria-label="Mover lead para outra etapa"
              className="w-6 h-6 rounded-md grid place-items-center text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:text-neutral-500 dark:hover:text-brand-300 dark:hover:bg-brand-500/10 transition shrink-0"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </footer>
      </article>
    );
  };

  const renderKanbanColumn = ({ key, name, color, special, columnLeads, onDropHandler, renderLimit = 0 }) => {
    const accent = getKanbanColumnAccent(color);
    const isHovered = draggedOverColumn === name;
    const isWinCol = special === 'win';
    const isLossCol = special === 'loss';
    // Colunas terminais (Venda/Perda) acumulam histórico; renderizar
    // todos os cards trava o board. Mostra os mais recentes e indica
    // quantos restam (acessíveis pela busca ou pelo Dashboard).
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
        key={key}
        onDragOver={(e) => {
          e.preventDefault();
          if (draggedOverColumn !== name) setDraggedOverColumn(name);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget)) return;
          if (draggedOverColumn === name) setDraggedOverColumn(null);
        }}
        onDrop={(e) => {
          setDraggedOverColumn(null);
          setDraggingLeadId(null);
          onDropHandler(e);
        }}
        className={`w-[300px] shrink-0 rounded-2xl flex flex-col transition-colors border ${
          isHovered
            ? 'bg-brand-50/60 dark:bg-brand-500/[0.06] ring-2 ring-brand-100 dark:ring-brand-500/30 border-brand-100 dark:border-brand-500/30'
            : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800'
        }`}
      >
        <header className="px-3 pt-3 pb-2 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2">
          {isWinCol ? (
            <span className="w-5 h-5 rounded-md grid place-items-center bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 shrink-0">
              <TrendingUp className="w-3 h-3" />
            </span>
          ) : isLossCol ? (
            <span className="w-5 h-5 rounded-md grid place-items-center bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400 shrink-0">
              <Ban className="w-3 h-3" />
            </span>
          ) : (
            <span className={`w-2 h-2 rounded-full shrink-0 ${accent.dot}`} />
          )}
          <h3 className="text-[13px] font-semibold whitespace-nowrap text-gray-900 dark:text-white truncate" title={name}>
            {name}
          </h3>
          <span
            className="text-[11px] font-semibold px-1.5 h-[18px] rounded-md grid place-items-center min-w-[20px] bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-300 shrink-0"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {columnLeads.length}
          </span>
        </header>

        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2 custom-scrollbar">
          {columnLeads.length === 0 ? (
            <div
              className={`min-h-[120px] rounded-xl border-2 border-dashed grid place-items-center text-[11px] font-semibold uppercase tracking-wider transition text-center px-3 ${
                isHovered
                  ? 'border-brand-300 text-brand-600 dark:border-brand-500/40 dark:text-brand-300'
                  : isWinCol
                    ? 'border-emerald-200 text-emerald-600/70 dark:border-emerald-500/20 dark:text-emerald-300/60'
                    : isLossCol
                      ? 'border-rose-200 text-rose-600/70 dark:border-rose-500/20 dark:text-rose-300/60'
                      : 'border-gray-200 text-gray-400 dark:border-neutral-800 dark:text-neutral-500'
              }`}
            >
              {emptyText}
            </div>
          ) : (
            <>
              {shownLeads.map(lead => renderLeadCard(lead, color))}
              {hiddenCount > 0 && (
                <div className="py-2 text-center text-[11px] font-medium text-gray-400 dark:text-neutral-500">
                  + {hiddenCount} {hiddenCount === 1 ? 'lead mais antigo' : 'leads mais antigos'} · use a busca para encontrar
                </div>
              )}
            </>
          )}
        </div>
      </section>
    );
  };

  const pipelineColumns = (statuses || []).filter(s => isItemInFunnel(s, selectedFunnelId, defaultFunnelId));
  const kanbanTitle = currentFunnel?.name || 'Quadro Kanban';
  const hasFunnels = (funnels || []).length > 0;
  const totalFunnelLeads = funnelLeads.length;
  const isAdmin = isAdminUser(appUser);
  const isMineActive = !!(consultantFilter && appUser?.id && consultantFilter === appUser.id);

  const kpiCards = [
    { key: 'active',  icon: Users,       label: 'Leads ativos',         value: kanbanKpis.active,        sub: 'no pipeline',              tone: 'slate' },
    { key: 'won',     icon: TrendingUp,  label: 'Vendas',               value: kanbanKpis.won,           sub: 'matrículas',               tone: 'emerald' },
    { key: 'lost',    icon: Ban,         label: 'Perdas',               value: kanbanKpis.lost,          sub: 'motivos em relatórios',    tone: 'slate' },
    { key: 'overdue', icon: AlertCircle, label: 'Em atraso',            value: kanbanKpis.overdue,       sub: 'follow-ups vencidos',      tone: kanbanKpis.overdue > 0 ? 'rose' : 'slate' },
    { key: 'rate',    icon: Activity,    label: 'Taxa de fechamento',   value: `${kanbanKpis.winRate}%`, sub: 'vendas / (vendas + perdas)', tone: 'blue' }
  ];

  const kpiToneStyles = {
    slate:   'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    blue:    'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    rose:    'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
  };

  return (
    <>
      <div className="h-[calc(100vh-10rem)] flex flex-col animate-fade-in">
        {/* Title + funnel selector */}
        <div className="flex items-center gap-4 flex-wrap mb-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
              {kanbanTitle}
            </h3>
            <p className="text-xs font-medium text-gray-500 dark:text-neutral-400 mt-1">
              Arraste os leads entre as etapas. Use as colunas{' '}
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">Venda</span> e{' '}
              <span className="font-semibold text-gray-700 dark:text-neutral-200">Perda</span> para concluir.
            </p>
          </div>
          {hasFunnels && (
            <FunnelSelector
              funnels={funnels}
              value={selectedFunnelId}
              onChange={setSelectedFunnelId}
              className="w-full md:w-[280px]"
            />
          )}
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-5 gap-3 mb-4">
          {kpiCards.map((card) => {
            const KpiIcon = card.icon;
            return (
              <div
                key={card.key}
                className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3.5 flex items-center gap-3"
              >
                <span className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${kpiToneStyles[card.tone]}`}>
                  <KpiIcon className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-gray-500 dark:text-neutral-400 whitespace-nowrap truncate">
                    {card.label}
                  </div>
                  <div
                    className="text-[18px] font-semibold tracking-tight leading-none mt-0.5 text-gray-900 dark:text-white"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {card.value}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-neutral-400 mt-0.5 truncate">
                    {card.sub}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar lead, telefone ou observação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 focus:border-brand-500 dark:focus:border-brand-500 outline-none text-sm pl-9 pr-3 placeholder:text-gray-400 dark:placeholder:text-neutral-500 text-gray-900 dark:text-white shadow-sm transition-all"
            />
          </div>

          {isAdmin && (
            <select
              value={consultantFilter}
              onChange={(e) => setConsultantFilter(e.target.value)}
              className="h-10 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 outline-none text-sm pl-3 pr-8 text-gray-900 dark:text-white shadow-sm cursor-pointer font-medium"
            >
              <option value="">Todos os consultores</option>
              {(usersList || []).map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          )}

          {isAdmin && appUser?.id && (
            <div className="inline-flex p-1 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow-sm">
              <button
                type="button"
                onClick={() => setConsultantFilter('')}
                className={`h-7 px-3 rounded-md text-[12px] font-semibold whitespace-nowrap transition ${
                  !isMineActive
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'text-gray-500 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                Toda equipe
              </button>
              <button
                type="button"
                onClick={() => setConsultantFilter(appUser.id)}
                className={`h-7 px-3 rounded-md text-[12px] font-semibold whitespace-nowrap transition ${
                  isMineActive
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'text-gray-500 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                Apenas meus
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setOnlyOverdue(o => !o)}
            className={`h-10 px-3 rounded-lg text-[12.5px] font-semibold whitespace-nowrap transition inline-flex items-center gap-1.5 shadow-sm ${
              onlyOverdue
                ? 'bg-rose-600 text-white border border-rose-600'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 dark:bg-neutral-900 dark:text-neutral-200 dark:border-neutral-800 dark:hover:bg-neutral-800'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" /> Em atraso
          </button>

          <div className="flex-1" />

          <div
            className="text-[11.5px] text-gray-500 dark:text-neutral-400 whitespace-nowrap"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            <span className="font-semibold text-gray-700 dark:text-neutral-200">{kanbanLeads.length}</span>{' '}
            de {totalFunnelLeads} leads
          </div>
        </div>

        {/* Board */}
        <div
          ref={kanbanScrollRef}
          onMouseDown={handleKanbanMouseDown}
          onMouseMove={handleKanbanMouseMove}
          onMouseUp={stopKanbanPan}
          onMouseLeave={stopKanbanPan}
          className={`flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar select-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <div className="flex gap-3 min-w-max h-full pb-2">
            {pipelineColumns.map((column) =>
              renderKanbanColumn({
                key: column.id,
                name: column.name,
                color: column.color,
                special: null,
                columnLeads: getLeadsByStatus(column.name),
                onDropHandler: (e) => handleDrop(e, column.name)
              })
            )}

            {renderKanbanColumn({
              key: '__venda',
              name: 'Venda',
              color: 'green',
              special: 'win',
              columnLeads: getLeadsByStatus('Venda'),
              onDropHandler: handleWinDrop,
              renderLimit: 50
            })}

            {renderKanbanColumn({
              key: '__perda',
              name: 'Perda',
              color: 'gray',
              special: 'loss',
              columnLeads: getLeadsByStatus('Perda'),
              onDropHandler: handleLossDrop,
              renderLimit: 50
            })}
          </div>
        </div>
      </div>

      {selectedLead && (
        <LeadDetailsModal
          lead={selectedLead}
          interactions={(interactions || [])
            .filter(i => i.leadId === selectedLead.id)
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))}
          onClose={() => setSelectedLead(null)}
          appUser={appUser}
          statuses={statuses}
          tags={tags}
          lossReasons={lossReasons}
          db={db}
          funnels={funnels}
        />
      )}

      {lossModalLeadId && (
        <LossReasonModal
          lossReasons={lossReasons}
          onClose={() => setLossModalLeadId(null)}
          onConfirm={confirmKanbanLoss}
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
