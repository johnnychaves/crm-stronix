import { useState } from 'react';
import { collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDocs, writeBatch, query, where, serverTimestamp } from 'firebase/firestore';
import { appId, LEADS_PATH, INTERACTIONS_PATH, CONTRACTS_PATH } from '../lib/firebase.js';
import { isAdminUser, canEditLead, getInteractionSecurityFields, isLeadConverted, isConvertedStatusName } from '../lib/leads.js';
import { normalizeAppointmentType, getSafeDateOrNull } from '../lib/dates.js';
import { fmtBRL } from '../lib/format.js';
import { deriveContractStatus, deriveLeadContractStatus, CONTRACT_STATUS, CONTRACT_STATUS_LABEL } from '../lib/contracts.js';
import { getDefaultFunnel } from '../lib/funnels.js';
import { deriveLeadState, deriveContextAlert, getTone, phaseToneName } from '../lib/leadState.js';
import { professorNameById } from '../lib/professores.js';
import { cn } from '../lib/utils.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Btn, IconBtn } from '../components/ui/Btn.jsx';
import { StatusBadge, TagBadge } from '../components/ui/Badges.jsx';
import { ContractAVencerBadge } from '../components/ui/ContractAVencerBadge.jsx';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs.jsx';
import { RingAvatar } from '../components/profile/RingAvatar.jsx';
import { ContextAlert } from '../components/profile/ContextAlert.jsx';
import { PhaseChanger } from '../components/profile/PhaseChanger.jsx';
import { ScheduleWizard } from '../components/profile/ScheduleWizard.jsx';
import { LossReasonModal } from '../modals/LossReasonModal.jsx';
import { MatriculaModal } from '../modals/MatriculaModal.jsx';
import { EditLeadModal } from '../modals/EditLeadModal.jsx';
import {
  getInteractionVisual,
  groupTimeline,
  classifyInteraction,
  parseAppointment,
  extractStageNameFromInteractionText,
  TIMELINE_FILTERS
} from '../lib/timeline.js';
import { AlertTriangle, ArrowLeft, ArrowRight, Ban, BookOpen, Building2, Calendar, Check, Clock, CreditCard, FileText, GraduationCap, MessageCircle, Pause, Pencil, Phone, Plus, RefreshCw, Search, Shield, Tag, Target, ThumbsDown, Trash, TrendingUp, User, UserPlus, Users } from 'lucide-react';

// Tom semântico (TONES) + ícone por status do contrato — espelha o
// CONTRACT_STATUS do protótipo (contracts.jsx) p/ o tile/chip do contrato vigente.
const CONTRACT_STATUS_META = {
  [CONTRACT_STATUS.ATIVO]: { tone: 'emerald', icon: Shield },
  [CONTRACT_STATUS.A_VENCER]: { tone: 'amber', icon: AlertTriangle },
  [CONTRACT_STATUS.VENCIDO]: { tone: 'slate', icon: Pause },
  [CONTRACT_STATUS.CANCELADO]: { tone: 'rose', icon: Ban }
};

// Item da faixa de meta do cabeçalho (ícone + texto), espelha o MetaItem do protótipo.
const MetaItem = ({ icon, children }) => (
  <span className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
    <span className="text-slate-400 dark:text-slate-500">{icon}</span>{children}
  </span>
);

// Chip de contagem ao lado do label da aba (Linha do tempo / Contratos).
function TabCount({ n, active }) {
  return (
    <span className={cn(
      'num text-[10.5px] font-semibold px-1 h-[16px] min-w-[16px] rounded grid place-items-center',
      active
        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
        : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'
    )}>{n}</span>
  );
}

function LeadProfileView({ lead, interactions, onBack, appUser, statuses, tags, lossReasons, usersList, db, funnels }) {
  const toast = useToast();
  const isReadOnly = !canEditLead(appUser, lead);
  // Linha do tempo COLABORATIVA: qualquer consultor do tenant pode escrever
  // notas/interações e agendar na timeline de QUALQUER lead (base compartilhada,
  // PR #101) — mesmo não sendo o responsável. Edição dos dados do lead,
  // Venda/Perda, reatribuição de responsável e exclusão seguem com dono/admin
  // (isReadOnly / isAdminUser). As regras do Firestore já permitem interações
  // por qualquer membro do tenant, então não há mudança de rules.
  const canTimeline = Boolean(appUser?.authUid);
  const safeFunnels = Array.isArray(funnels) ? funnels : [];
  const fallbackFunnelId = lead.funnelId || getDefaultFunnel(safeFunnels)?.id || null;

  // Estado inicializado DIRETO do lead. A view é remontada via key={lead.id}
  // pelo App quando o lead muda, então não há useEffect de re-sync.
  const [isEditing, setIsEditing] = useState(false);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState(lead.status);
  const [funnelId, setFunnelId] = useState(fallbackFunnelId);
  const [loading, setLoading] = useState(false);

  const [lossModalOpen, setLossModalOpen] = useState(false);
  const [matriculaOpen, setMatriculaOpen] = useState(false);
  // 'matricula' (nova/retroativa) | 'renovacao' — controla o modo do MatriculaModal.
  const [matriculaMode, setMatriculaMode] = useState('matricula');
  // Threshold de vencimento do contexto (sem prop-drilling) p/ a seção Contrato.
  const { contractThresholdDays, contratos, professores } = useGeneralConfig();

  // Composer tab — drives which form is shown in the activity Composer card.
  const [composerTab, setComposerTab] = useState('note');

  // Aba ativa da ficha (timeline | crm | contratos).
  const [activeProfileTab, setActiveProfileTab] = useState('timeline');

  // Timeline filter + search
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [timelineQuery, setTimelineQuery] = useState('');

  const handleWhatsApp = () => {
    let n = String(lead.whatsapp || '').replace(/\D/g, '');
    if (!n) { toast.warning('Lead sem WhatsApp cadastrado.'); return; }
    if(n.length <= 11) n='55'+n;
    window.open(`https://wa.me/${n}?text=Ol%C3%A1%20${encodeURIComponent(lead.name || '')}`);
  };


  const handleDelete = async () => {
    if (!window.confirm("Excluir este lead permanentemente? Não dá pra desfazer.")) return;
    setLoading(true);
    try {
      // Apaga as interações ligadas ao lead (senão ficam órfãs na coleção).
      // Em lotes de 450 (limite do writeBatch é 500) para suportar qualquer volume.
      const interSnap = await getDocs(query(
        collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH),
        where('leadId', '==', lead.id)
      ));
      const interDocs = interSnap.docs;
      for (let i = 0; i < interDocs.length; i += 450) {
        const batch = writeBatch(db);
        interDocs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id));
      onBack();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao excluir o lead. Tente novamente.');
      setLoading(false);
    }
  };

  // A matrícula deixou de ser um simples confirm: abre o MatriculaModal, que
  // captura plano/valor/vigência e grava o contrato + o resumo no lead + a
  // timeline num único batch (regra em lib/contracts.js). Os dois caminhos de
  // conversão (esta ficha e o Kanban) passam pelo MESMO modal.
  const handleWin = () => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    setMatriculaMode('matricula');
    setMatriculaOpen(true);
  };

  // Renovação: abre o MESMO modal em modo renovação (não re-carimba
  // convertedAt/status — ver lib/contracts.js), apontando ao contrato vigente.
  const handleRenew = () => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    setMatriculaMode('renovacao');
    setMatriculaOpen(true);
  };

  // Cancela o contrato vigente: grava status terminal no doc do contrato e no
  // resumo do lead, e registra na timeline. Não mexe em status/convertedAt do
  // lead (continua cliente; só o contrato fica cancelado).
  const handleCancelContract = async () => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (!lead.currentContractId) { toast.warning('Não há contrato vigente para cancelar.'); return; }
    if (!window.confirm('Cancelar o contrato vigente deste cliente?')) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      batch.set(
        doc(db, 'artifacts', appId, 'public', 'data', CONTRACTS_PATH, lead.currentContractId),
        { status: CONTRACT_STATUS.CANCELADO, cancelledAt: serverTimestamp(), cancelReason: null },
        { merge: true }
      );
      batch.set(
        doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
        { currentContractStatus: CONTRACT_STATUS.CANCELADO },
        { merge: true }
      );
      batch.set(
        doc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH)),
        {
          leadId: lead.id,
          consultantName: appUser?.name || null,
          ...getInteractionSecurityFields(lead, appUser),
          text: `Contrato cancelado${lead.currentPlanName ? ` — Plano ${lead.currentPlanName}` : ''}.`,
          type: 'status_change',
          createdAt: serverTimestamp()
        }
      );
      await batch.commit();
      toast.success('Contrato cancelado.');
    } catch (e) {
      console.error('Erro ao cancelar contrato:', e);
      toast.error('Não foi possível cancelar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const confirmLoss = async (reason) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    setLoading(true);
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), {
        status: 'Perda',
        lossReason: reason,
        nextFollowUp: null,
        lostAt: serverTimestamp(),
        // Limpa resquício caso o lead viesse de Venda.
        isConverted: false,
        convertedAt: null
      });
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: `Lead perdido. Motivo: ${reason}`,
        type: 'status_change',
        createdAt: serverTimestamp()
      });
      setLossModalOpen(false);
      setStatus('Perda');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao registrar a perda. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Reabre um lead em Perda: tira de "Perda", volta ao primeiro estágio do
  // funil do lead (fallback 'Novo'), limpa os campos de resolução de perda e
  // registra na timeline. Disparado pelo ContextAlert (action 'reopen').
  const handleReopen = async () => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    const firstStage = (statuses || [])
      .filter(s => s.funnelId === (lead.funnelId || fallbackFunnelId))
      .sort((a, b) => (a.order || 0) - (b.order || 0))[0]?.name || 'Novo';
    setLoading(true);
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), {
        status: firstStage,
        lossReason: null,
        lostAt: null
      });
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: 'Lead reaberto.',
        type: 'status_change',
        createdAt: serverTimestamp()
      });
      setStatus(firstStage);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível reabrir o lead. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Liga o CTA do alerta contextual (deriveContextAlert) ao handler real.
  const handleAlertAction = (action) => {
    if (action === 'renew') return handleRenew();
    if (action === 'matricular') return handleWin();
    if (action === 'reopen') return handleReopen();
  };

  // Confirmação do PhaseChanger (composer → "Mudar fase"). Venda/Perda caem nos
  // fluxos existentes (MatriculaModal / LossReasonModal); demais fases gravam o
  // status (+funil, se mudou) e registram a transição na timeline.
  const handlePhaseConfirm = async ({ funnelId: targetFunnelId, targetStatus, note: phaseNote }) => {
    if (targetStatus === 'Venda') { setMatriculaMode('matricula'); setMatriculaOpen(true); return; }
    if (targetStatus === 'Perda') { setLossModalOpen(true); return; }
    if (!canTimeline) { toast.warning('Você não tem permissão para registrar interações neste lead.'); return; }
    setLoading(true);
    try {
      const up = { status: targetStatus };
      if (targetFunnelId && targetFunnelId !== lead.funnelId) up.funnelId = targetFunnelId;
      // Etapa customizada com nome de matrícula conta como conversão nas
      // métricas — carimba a data do fechamento se faltar (senão a matrícula
      // cai no mês do cadastro). Destino convertido também não limpa a
      // resolução ao sair de Venda: a pessoa continua matriculada/cliente.
      const destinoConvertido = isConvertedStatusName(targetStatus);
      // Saindo de Venda/Perda para outra fase: limpa os campos de resolução.
      if (lead.status === 'Venda' && targetStatus !== 'Venda' && !destinoConvertido) {
        up.isConverted = false;
        up.convertedAt = null;
        // Desfaz o "cliente": senão lifecycleStage='cliente' segue tratando a
        // pessoa como cliente (some do Kanban, header de cliente) numa fase de lead.
        up.lifecycleStage = null;
      }
      if (lead.status === 'Perda' && targetStatus !== 'Perda') {
        up.lossReason = null;
        up.lostAt = null;
      }
      if (destinoConvertido && !getSafeDateOrNull(lead.convertedAt)) up.convertedAt = serverTimestamp();
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), up, { merge: true });
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: `Fase alterada para [${targetStatus}]${phaseNote ? ' — ' + phaseNote : ''}.`,
        type: 'status_change',
        createdAt: serverTimestamp()
      });
      setStatus(targetStatus);
      if (up.funnelId) setFunnelId(up.funnelId);
      setComposerTab('note');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível mudar a fase. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Anotação / Mudar fase / Mover funil. O agendamento é tratado pelo
  // ScheduleWizard via handleWizardConfirm.
  const saveInteraction = async () => {
    if (!canTimeline) { toast.warning('Você não tem permissão para registrar interações neste lead.'); return; }
    const funnelChanged = Boolean(lead.funnelId) && funnelId && funnelId !== lead.funnelId;
    if (!note.trim() && status === lead.status && !funnelChanged) return;
    setLoading(true);
    try {
      let actionText = '';
      if (funnelChanged) {
        const newFunnelName = safeFunnels.find(f => f.id === funnelId)?.name || 'outro funil';
        actionText += `Lead movido para o funil [${newFunnelName}]. `;
      }
      if (status !== lead.status) actionText += `Fase alterada para [${status}]. `;
      if (note) actionText += `Obs: ${note}. `;

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: actionText || 'Atualização registrada.',
        type: (status !== lead.status || funnelChanged) ? 'status_change' : 'note',
        createdAt: serverTimestamp()
      });

      const up = { status };
      if (funnelChanged) up.funnelId = funnelId;
      // Saindo de Venda/Perda para outra fase: limpa os campos de
      // resolução, senão o lead segue contando como matrícula/perda.
      if (lead.status === 'Venda' && status !== 'Venda') {
        up.isConverted = false;
        up.convertedAt = null;
        // Desfaz o "cliente" (ver handlePhaseConfirm): some do Kanban se não limpar.
        up.lifecycleStage = null;
      }
      if (lead.status === 'Perda' && status !== 'Perda') {
        up.lossReason = null;
        up.lostAt = null;
      }
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), up, { merge: true });

      setNote('');
      setLoading(false);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar.');
      setLoading(false);
    }
  };

  // Grava o agendamento montado no ScheduleWizard. Mantém os campos canônicos
  // (nextFollowUp/nextFollowUpType/appointmentType/appointmentScheduledFor) e
  // grava os extras por tipo (modalidade+professor+quantidade p/ aula; unidade p/ visita).
  const handleWizardConfirm = async ({ typeLabel, date, modalidade, professorId, soloTraining, quantidade, unidade, note: wizNote }) => {
    if (!canTimeline) { toast.warning('Você não tem permissão para agendar neste lead.'); return; }
    if (!(date instanceof Date) || isNaN(date.getTime())) { toast.warning('Selecione o dia e o horário.'); return; }
    setLoading(true);
    try {
      const appointmentType = normalizeAppointmentType(typeLabel); // 'visita' | 'aula_experimental' | null
      const isAula = appointmentType === 'aula_experimental';
      const isVisita = appointmentType === 'visita';

      let extra = '';
      if (isAula) {
        const q = quantidade || 1;
        extra = ` (${modalidade ? modalidade + ' · ' : ''}${q} ${q === 1 ? 'aula' : 'aulas'})`;
        if (professorId) extra += ` · ${professorNameById(professores, professorId)}`;
        else if (soloTraining) extra += ' · Treina sozinho';
      } else if (isVisita && unidade) {
        extra = ` (Unidade ${unidade})`;
      }
      // Inclui o ANO: sem ele, parseAppointment assume o ano corrente e um
      // agendamento dez→jan aparece na data errada até virar o ano.
      const dateStr = date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const noteStr = (wizNote || '').trim();
      const text = `🔔 ${typeLabel} agendada${extra} p/ ${dateStr}.` + (noteStr ? ` Obs: ${noteStr}` : '');

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text,
        type: 'note',
        // Meta por VOLUME: todo agendamento criado pelo wizard conta como ação
        // de pipeline (visita/aula/mensagem/ligação) — ver lib/dailyGoal.js.
        volumeKind: appointmentType || (/liga/i.test(typeLabel) ? 'ligacao' : 'mensagem'),
        createdAt: serverTimestamp()
      });

      const up = {
        nextFollowUp: date,
        nextFollowUpType: typeLabel,
        // Observação do agendamento, exibida no card da Meta Diária.
        nextFollowUpNote: noteStr || null,
        // Limpa extras de agendamentos anteriores e grava só os do tipo atual.
        appointmentModality: isAula ? (modalidade || null) : null,
        appointmentProfessorId: isAula ? (professorId || null) : null,
        appointmentProfessorName: isAula ? (professorId ? professorNameById(professores, professorId) : null) : null,
        appointmentSoloTraining: isAula ? Boolean(soloTraining) : false,
        trialClassesPlanned: isAula ? (quantidade || null) : null,
        appointmentUnit: isVisita ? (unidade || null) : null,
        appointmentType: appointmentType || null,
        appointmentScheduledFor: appointmentType ? date : null
      };
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), up, { merge: true });

      toast.success(`Agendamento criado para ${dateStr}.`);
      setComposerTab('note');
      setLoading(false);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar o agendamento.');
      setLoading(false);
    }
  };

  // Composer tab handlers — each maps to the existing Firestore patterns.
  const handleSendWhatsAppMessage = async () => {
    if (!canTimeline) { toast.warning('Você não tem permissão para registrar interações neste lead.'); return; }
    const msg = note.trim();
    if (!msg) { toast.warning('Escreva a mensagem antes de enviar.'); return; }
    setLoading(true);
    try {
      // Open WhatsApp Web with the typed message
      const num = String(lead.whatsapp || '').replace(/\D/g, '');
      const phone = num.length <= 11 ? '55' + num : num;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
      // Log the outbound message in the timeline
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: `📲 Mensagem WhatsApp enviada: ${msg}`,
        type: 'note',
        createdAt: serverTimestamp()
      });
      setNote('');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível registrar o envio.');
    }
    setLoading(false);
  };

  const handleLogCall = async () => {
    if (!canTimeline) { toast.warning('Você não tem permissão para registrar interações neste lead.'); return; }
    const summary = note.trim();
    if (!summary) { toast.warning('Resuma o que rolou na ligação antes de salvar.'); return; }
    setLoading(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: `📞 Ligação: ${summary}`,
        type: 'note',
        createdAt: serverTimestamp()
      });
      setNote('');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível registrar a ligação.');
    }
    setLoading(false);
  };

  const handleComposerSubmit = () => {
    if (composerTab === 'whatsapp') return handleSendWhatsAppMessage();
    if (composerTab === 'call')     return handleLogCall();
    // 'note' flui pelo saveInteraction. 'status' (Mudar fase) tem o PhaseChanger
    // com seus próprios botões; 'schedule' é tratado pelo ScheduleWizard.
    return saveInteraction();
  };

  const composerSubmitLabel =
    composerTab === 'whatsapp' ? 'Enviar' : 'Salvar';

  const resetComposer = () => {
    setNote('');
    setStatus(lead.status);
    setFunnelId(fallbackFunnelId);
  };

  // ----- Derived computations -----
  const firstName = (lead.name || '').split(' ')[0] || 'lead';

  // Ciclo de vida + status do contrato (cliente) p/ os selos do cabeçalho.
  const isClient = lead.lifecycleStage === 'cliente' || isLeadConverted(lead);
  const clientContractStatus = isClient ? deriveLeadContractStatus(lead, new Date(), contractThresholdDays) : null;
  // Estado de ciclo de vida da pessoa (fonte única em lib/leadState.js): dita o
  // tom/rótulo/hint do cabeçalho, o anel do RingAvatar e o alerta contextual.
  const profileState = deriveLeadState(lead, new Date(), contractThresholdDays);
  const profileTone = getTone(profileState.tone);
  const contextAlert = deriveContextAlert(profileState);

  // Classificação + filtro da timeline (helpers compartilhados em lib/timeline.js).
  const interactionsWithClass = (interactions || []).map(i => ({ ...i, _kind: classifyInteraction(i) }));

  // Origem de cada mudança de fase, reconstruída da transição anterior: a origem
  // de uma transição é o destino da transição imediatamente anterior (em ordem
  // cronológica). Permite exibir "[origem] → [destino]" na timeline como no
  // protótipo, mesmo gravando só o destino. Best-effort: a 1ª transição fica sem
  // origem (mostra só o destino); eventos sem etapa entre [colchetes] (ex.: Perda
  // "Lead perdido…", reabertura) não entram na cadeia.
  const statusFromMap = (() => {
    const chrono = interactionsWithClass
      .filter(i => i._kind === 'status')
      .slice()
      .sort((a, b) => (a.createdAt?.getTime?.() || 0) - (b.createdAt?.getTime?.() || 0));
    const map = {};
    let prevDest = null;
    chrono.forEach(i => {
      map[i.id] = prevDest;
      const dest = extractStageNameFromInteractionText(i.text);
      if (dest) prevDest = dest;
    });
    return map;
  })();

  const timelineCounts = (() => {
    const counts = { all: interactionsWithClass.length, conversation: 0, status: 0, appointment: 0, note: 0, contract: 0, system: 0 };
    interactionsWithClass.forEach(i => { counts[i._kind] = (counts[i._kind] || 0) + 1; });
    return counts;
  })();

  const filteredInteractions = (() => {
    let list = timelineFilter === 'all' ? interactionsWithClass : interactionsWithClass.filter(i => i._kind === timelineFilter);
    const q = timelineQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(i => `${i.text || ''} ${i.consultantName || ''}`.toLowerCase().includes(q));
    }
    return list;
  })();

  const groupedEvents = groupTimeline(filteredInteractions);

  // Resolve o tom semântico (TONES) de um evento da timeline pelo seu _kind +
  // texto. Usado p/ o nó (círculo) da trilha e o realce do card.
  const eventToneName = (i) => {
    const lower = String(i.text || '').toLowerCase();
    if (i._kind === 'contract') {
      // Cancelamento = rose; matrícula/renovação = emerald.
      return /cancel/.test(lower) ? 'rose' : 'emerald';
    }
    if (i._kind === 'appointment') return 'brand';
    if (i._kind === 'conversation') return /^📞|ligaç/i.test(i.text || '') ? 'amber' : 'emerald';
    if (i._kind === 'status') {
      const stage = extractStageNameFromInteractionText(i.text);
      return stage ? phaseToneName(stage, statuses) : 'violet';
    }
    if (i._kind === 'note') return 'slate';
    return 'slate';
  };

  // Próximos agendamentos (aba CRM): agendamentos futuros, em ordem ascendente.
  const upcomingAppointments = interactionsWithClass
    .filter(i => i._kind === 'appointment')
    .map(i => ({ i, appt: parseAppointment(i) }))
    .filter(({ appt }) => appt && appt.when instanceof Date && appt.when.getTime() >= Date.now())
    .sort((a, b) => a.appt.when.getTime() - b.appt.when.getTime());

  // Histórico de contratos (aba Contratos): todos os contratos do lead, mais
  // recentes primeiro.
  const leadContracts = (Array.isArray(contratos) ? contratos : [])
    .filter(c => c.leadId === lead.id)
    .sort((a, b) => (getSafeDateOrNull(b.startsAt)?.getTime() || 0) - (getSafeDateOrNull(a.startsAt)?.getTime() || 0));

  // ----- Render helpers -----
  const renderComposer = () => (
    <section className="rounded-2xl border border-border bg-card shadow-card">
      {/* Tabs */}
      <div className="px-4 pt-3 flex items-center gap-1 border-b border-slate-100 dark:border-white/[0.05] overflow-x-auto thin-scroll">
        {[
          { id: 'note',     label: 'Anotação',   icon: <MessageCircle size={13} /> },
          { id: 'whatsapp', label: 'WhatsApp',   icon: <MessageCircle size={13} /> },
          { id: 'call',     label: 'Ligação',    icon: <Phone size={13} /> },
          { id: 'status',   label: 'Mudar fase', icon: <RefreshCw size={13} /> },
          { id: 'schedule', label: 'Agendar',    icon: <Calendar size={13} /> }
        ].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setComposerTab(t.id)}
            className={cn(
              'inline-flex items-center gap-1.5 h-9 px-3 text-[12.5px] font-medium rounded-t-md transition border-b-2 -mb-px whitespace-nowrap',
              composerTab === t.id
                ? 'text-slate-900 dark:text-white border-brand-600'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border-transparent'
            )}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex gap-3">
          <Avatar name={appUser?.name || 'Você'} size={32} />
          <div className="flex-1 min-w-0 space-y-3">

            {composerTab === 'note' && (
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="O que rolou nessa conversa? Detalhes que vão te ajudar no próximo contato..."
                rows={3}
                className="w-full rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] p-3 placeholder:text-slate-400 transition resize-none"
              />
            )}

            {composerTab === 'whatsapp' && (
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={`Mensagem para ${firstName}...`}
                rows={3}
                className="w-full rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] p-3 placeholder:text-slate-400 transition resize-none"
              />
            )}

            {composerTab === 'call' && (
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Resumo da ligação, próximos passos..."
                rows={3}
                className="w-full rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] p-3 placeholder:text-slate-400 transition resize-none"
              />
            )}

            {composerTab === 'status' && (
              <PhaseChanger
                lead={lead}
                funnels={safeFunnels}
                statuses={statuses}
                onConfirm={handlePhaseConfirm}
                onCancel={() => setComposerTab('note')}
              />
            )}

            {composerTab === 'schedule' && (
              <ScheduleWizard onConfirm={handleWizardConfirm} onCancel={resetComposer} submitting={loading} />
            )}

            {composerTab !== 'schedule' && composerTab !== 'status' && (
              <div className="flex items-center gap-1.5 pt-1">
                <div className="flex-1"></div>
                <Btn kind="soft" onClick={resetComposer} disabled={loading}>Cancelar</Btn>
                <Btn kind="brand" icon={<Check size={13} />} onClick={handleComposerSubmit} disabled={loading}>
                  {composerSubmitLabel}
                </Btn>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );

  // Link "Adicionar à agenda" do card de agendamento: monta uma URL de criação
  // de evento no Google Agenda (1h de duração) a partir do agendamento, sem
  // backend — abre em nova aba. Espelha o botão do appointment_scheduled do
  // protótipo (timeline.jsx).
  const gcalLink = (when, title) => {
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    const end = new Date(when.getTime() + 60 * 60 * 1000);
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${title} — ${lead.name}`,
      dates: `${stamp(when)}/${stamp(end)}`
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  // Badge de fase no estilo do protótipo (PhaseBadge do status_change): ponto +
  // nome na cor da etapa sobre fundo suave, rounded-md, compacto (size sm). NÃO
  // usar o StatusBadge do app aqui — ele é uma pílula sólida em maiúsculas e
  // destoa do protótipo.
  const phaseTag = (name) => {
    const t = getTone(phaseToneName(name, statuses));
    return (
      <span className={cn('inline-flex items-center gap-1.5 font-semibold rounded-md whitespace-nowrap text-[10.5px] px-1.5 py-0.5', t.soft, t.text, t.darkSoft, t.darkText)}>
        <span className={cn('w-1.5 h-1.5 rounded-full', t.dot)}></span>
        {name}
      </span>
    );
  };

  // Renderiza UM evento da trilha (nó + card por tipo). Usa _kind +
  // getInteractionVisual (ícone) + eventToneName (tom). Só apresentação.
  // Port fiel, classe por classe, dos corpos de evento de prototype/timeline.jsx,
  // adaptado às nossas interactions reais — sem fabricar dados que não temos
  // (✓✓ de leitura, duração/resultado de ligação): a FORMA do card é mantida,
  // o subelemento ausente é omitido.
  const renderTimelineEvent = (i) => {
    const visual = getInteractionVisual(i, statuses);
    const toneName = eventToneName(i);
    const tone = getTone(toneName);
    const time = i.createdAt?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const appt = i._kind === 'appointment' ? parseAppointment(i) : null;
    const stageName = i._kind === 'status' ? extractStageNameFromInteractionText(i.text) : '';
    const isContract = i._kind === 'contract';
    const contractCancel = isContract && /cancel/i.test(i.text || '');
    // Conversa: distingue mensagem (bolha) de ligação (card próprio), espelhando
    // os corpos message_out/call_out do protótipo.
    const isCall = i._kind === 'conversation' && /^📞|ligaç/i.test(i.text || '');
    const isMessage = i._kind === 'conversation' && !isCall;
    // Eventos "de sistema" que viram LINHA SIMPLES no protótipo (created/etiqueta).
    const lowerText = String(i.text || '').toLowerCase();
    const isCreated = i._kind === 'system' && /lead criado|cadastro do lead|criou o lead|via /i.test(i.text || '');
    const isTag = i._kind === 'system' && /etiqueta|tag\b/i.test(lowerText);
    // Anotação fixada (selo âmbar do protótipo). NÃO fabricamos: só aparece se a
    // interaction realmente trouxer i.pinned. Sem o campo, cai no card slate.
    const isPinned = i._kind === 'note' && Boolean(i.pinned);
    // Corpo limpo: tira os prefixos emoji/rótulo que o composer injeta no texto
    // (📲/📞 das conversas, "Obs:" das notas, emoji ✅/🔄 dos eventos da Meta,
    // o literal "OBSERVAÇÃO DO CADASTRO:"). O TIPO do card já comunica o que é,
    // então o corpo fica como no protótipo.
    const cleanBody = String(i.text || '')
      .replace(/^📲\s*Mensagem WhatsApp enviada:\s*/i, '')
      .replace(/^📞\s*Ligação:\s*/i, '')
      .replace(/^OBSERVAÇÃO DO CADASTRO:\s*/i, '')
      .replace(/^Obs:\s*/i, '')
      .replace(/^[✅🔄🔔]\s*/u, '')
      .trim();
    // Evento de sistema da Meta Diária ("✅ … — Meta Diária …" / "🔄 Remarcou …"
    // / legado "✅ … Meta Diária concluída."): linha discreta, sem o emoji cru.
    const isDailyGoal = i.type === 'daily_goal_done' || /meta diária/i.test(lowerText);
    const isSimpleSystem = isCreated || isTag || isDailyGoal;
    // Ícone do nó: agendamento/contrato têm ícone fixo; demais usam o visual.
    const NodeIcon = i._kind === 'appointment' ? Calendar : isContract ? GraduationCap : visual.icon;

    // Cabeçalho comum (avatar + autor + ação + canal + horário), como o
    // EventHeader do protótipo.
    const header = (
      <div className="flex items-center gap-2 flex-wrap">
        <Avatar name={i.consultantName || 'Sistema'} size={20} />
        <span className="text-[13px] font-semibold text-slate-900 dark:text-white whitespace-nowrap">{i.consultantName || 'Sistema'}</span>
        <span className={cn('text-[12px] whitespace-nowrap', tone.text, tone.darkText)}>
          {i._kind === 'appointment' ? 'criou um agendamento'
            : isContract ? (contractCancel ? 'cancelou o contrato' : 'registrou matrícula')
            : i._kind === 'status' && stageName ? 'alterou a fase'
            : isMessage ? 'enviou uma mensagem'
            : isCall ? 'registrou uma ligação'
            : isPinned ? 'fixou uma anotação'
            : i._kind === 'note' ? 'adicionou uma anotação'
            : isCreated ? 'cadastrou o lead'
            : isTag ? 'editou as etiquetas'
            : isDailyGoal ? 'concluiu a Meta Diária'
            : visual.label}
        </span>
        <span className="flex-1"></span>
        <span className="text-[11.5px] num text-slate-400 dark:text-slate-500 whitespace-nowrap" title={i.createdAt?.toLocaleString('pt-BR')}>
          {time}
        </span>
      </div>
    );

    return (
      <article key={i.id} className="relative pl-12 pr-2 py-2.5 fade-in group">
        {/* Nó da trilha — círculo de 36px no tom do tipo, com ring na cor do
            fundo (paper-50/ink-950), espelhando o EventDot do protótipo. */}
        <div className={cn(
          'absolute left-0 top-2.5 z-10 w-9 h-9 rounded-full grid place-items-center shrink-0 ring-4 ring-paper-50 dark:ring-ink-950',
          tone.soft, tone.text, tone.darkSoft, tone.darkText
        )}>
          <NodeIcon className="w-3.5 h-3.5" />
        </div>

        {header}

        {/* Corpo do card por tipo */}
        {i._kind === 'appointment' && appt && appt.when ? (
          // Agendamento: bloco de data (mês/dia/hora) + tipo + local, espelhando
          // appointment_scheduled. "Confirmado" só se o dado existir (i.confirmed).
          <div className="mt-2 max-w-[480px] rounded-xl border border-brand-200/70 dark:border-brand-500/20 bg-gradient-to-br from-brand-50 to-white dark:from-brand-500/10 dark:to-transparent p-4">
            <div className="flex items-center gap-3">
              <div className="text-center shrink-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">{appt.when.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}</div>
                <div className="num text-[24px] font-semibold tracking-tight leading-none text-brand-700 dark:text-brand-300">{String(appt.when.getDate()).padStart(2, '0')}</div>
                <div className="text-[10.5px] text-brand-600 dark:text-brand-300 num mt-0.5">{appt.when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div className="w-px h-12 bg-brand-200/70 dark:bg-brand-500/20"></div>
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
                  {appt.kind === 'class' ? <BookOpen size={11} /> : appt.kind === 'visit' ? <Building2 size={11} /> : appt.kind === 'call' ? <Phone size={11} /> : <MessageCircle size={11} />} {appt.label}
                </div>
                <div className="text-[13.5px] font-semibold text-slate-900 dark:text-white mt-0.5">{appt.when.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
                {appt.location && <div className="text-[12px] text-slate-500 dark:text-slate-400 truncate">{appt.location}</div>}
                {appt.note && <div className="text-[12px] text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap">{appt.note}</div>}
              </div>
              {i.confirmed && (
                <span className="text-[10.5px] font-semibold px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 whitespace-nowrap">Confirmado</span>
              )}
            </div>
            {/* Ações do card de agendamento — port do appointment_scheduled do
                protótipo: exportar p/ Google Agenda + remarcar (abre o wizard). */}
            <div className="mt-3 flex items-center gap-1.5">
              <Btn kind="secondary" size="sm" icon={<Calendar size={12} />} onClick={() => window.open(gcalLink(appt.when, appt.label), '_blank', 'noopener,noreferrer')}>Adicionar à agenda</Btn>
              <Btn kind="soft" size="sm" icon={<RefreshCw size={12} />} onClick={() => { setActiveProfileTab('crm'); setComposerTab('schedule'); }}>Remarcar</Btn>
            </div>
          </div>
        ) : isContract && i.text ? (
          // Matrícula/renovação (emerald) ou cancelamento (rose) — card destacado
          // com ícone no tom forte, espelhando enrollment/renewal.
          <div className={cn(
            'mt-2 max-w-[480px] rounded-xl p-4 ring-1 ring-inset',
            contractCancel
              ? 'bg-rose-50 dark:bg-rose-500/10 ring-rose-500/25'
              : 'bg-emerald-50 dark:bg-emerald-500/10 ring-emerald-500/25'
          )}>
            <div className="flex items-center gap-3">
              <span className={cn(
                'w-10 h-10 rounded-xl grid place-items-center shrink-0 text-white',
                contractCancel ? 'bg-rose-500' : 'bg-emerald-500'
              )}>
                {contractCancel ? <Ban size={18} /> : <GraduationCap size={18} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className={cn(
                  'text-[11px] font-bold uppercase tracking-wider',
                  contractCancel ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'
                )}>
                  {contractCancel ? 'Contrato cancelado' : /renova/i.test(i.text) ? 'Contrato renovado' : 'Matrícula fechada'}
                </div>
                <p className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-200 num mt-0.5 whitespace-pre-wrap">{i.text}</p>
              </div>
            </div>
          </div>
        ) : i._kind === 'status' && stageName ? (
          // Mudança de fase: "[origem] → [destino]" espelhando o status_change do
          // protótipo. A origem vem de statusFromMap (destino da transição
          // anterior). Sem origem conhecida (1ª transição) cai no "Movido para".
          <div className="mt-2 inline-flex items-center gap-2 flex-wrap">
            {statusFromMap[i.id] ? (
              <>
                {phaseTag(statusFromMap[i.id])}
                <ArrowRight size={13} className="text-slate-400" />
                {phaseTag(stageName)}
              </>
            ) : (
              <>
                <span className="text-[12px] text-slate-500 dark:text-slate-400 whitespace-nowrap">Movido para</span>
                {phaseTag(stageName)}
              </>
            )}
          </div>
        ) : isMessage ? (
          // Mensagem enviada: balão estilo chat (espelha message_out), com a
          // "rabicho" da bolha. Sem o ✓✓ — não temos status de leitura.
          <div className="mt-2 flex">
            <div className="relative max-w-[440px] rounded-xl px-3 py-2 text-[13px] leading-relaxed bg-emerald-100/70 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-50 bubble-out">
              <p className="whitespace-pre-wrap">{cleanBody || i.text}</p>
              <div className="text-[10.5px] num mt-1 opacity-60 text-right">{time}</div>
            </div>
          </div>
        ) : isCall ? (
          // Ligação: card com ícone/tom próprios (espelha call_out), sem inventar
          // resultado/duração — exibe só o resumo escrito pelo consultor.
          <div className="mt-2 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-3 max-w-[440px]">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg grid place-items-center shrink-0 bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                <Phone size={14} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-slate-900 dark:text-white">Ligação registrada</div>
                {cleanBody && <p className="text-[12.5px] text-slate-600 dark:text-slate-300 mt-0.5 leading-snug whitespace-pre-wrap">{cleanBody}</p>}
              </div>
              <Btn kind="soft" size="sm" icon={<Phone size={12} />} onClick={() => { const num = String(lead.whatsapp || '').replace(/\D/g, ''); if (num) window.location.href = `tel:${num}`; }}>Retornar</Btn>
            </div>
          </div>
        ) : isSimpleSystem ? (
          // Criado / etiqueta / Meta Diária: LINHA SIMPLES (sem card), como
          // created/tag_change. Corpo já vem sem o emoji cru (cleanBody).
          (cleanBody ? (
            <div className="mt-1 text-[12.5px] text-slate-500 dark:text-slate-400 whitespace-pre-wrap">{cleanBody}</div>
          ) : null)
        ) : i._kind === 'note' && cleanBody ? (
          // Anotação: card slate, ou variante FIXADO (amber + selo) se i.pinned —
          // espelha o corpo note do protótipo.
          <div className={cn(
            'mt-2 rounded-xl p-3 max-w-[520px] border',
            isPinned
              ? 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20'
              : 'bg-slate-50 border-slate-200 dark:bg-white/[0.03] dark:border-white/[0.06]'
          )}>
            {isPinned && (
              <div className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-1">
                <Target size={10} /> Fixado
              </div>
            )}
            <p className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{cleanBody}</p>
          </div>
        ) : cleanBody ? (
          // Fallback (system genérico, ou agendamento legado cuja data não
          // parseou): card no tom do evento, com o corpo já limpo de prefixos.
          <div className={cn(
            'mt-2 rounded-xl p-3 max-w-[640px] ring-1 ring-inset',
            tone.soft, tone.darkSoft,
            toneName === 'slate' ? 'ring-slate-200 dark:ring-white/[0.06]' : `${tone.ring}/20`
          )}>
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-200">{cleanBody}</p>
          </div>
        ) : null}
      </article>
    );
  };

  return (
    <div className="animate-fade-in font-sans">
      {/* ===== Voltar (a topbar é o shell do app; mantemos o Voltar acima do card) ===== */}
      <button
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12.5px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] whitespace-nowrap transition"
      >
        <ArrowLeft size={14} /> Voltar
      </button>

      {/* ===== Cabeçalho (card) — port fiel de header.jsx ===== */}
      <section className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-card overflow-hidden mb-5">
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4 sm:gap-5 flex-wrap">
            <RingAvatar name={lead.name} size={64} toneName={profileState.tone} splitHex={profileState.key === 'a_vencer' ? '#10B981' : null} />

            <div className="min-w-[240px] flex-1">
              {/* lifecycle label */}
              <div className="flex items-center gap-2 mb-1.5 whitespace-nowrap overflow-hidden">
                {profileState.key === 'a_vencer' && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider shrink-0 text-emerald-700 dark:text-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>Ativo
                  </span>
                )}
                <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider shrink-0', profileTone.text, profileTone.darkText)}>
                  <span className={cn('w-2 h-2 rounded-full', profileTone.strong)}></span>{profileState.label}
                </span>
                <span className="text-[11.5px] text-slate-400 dark:text-slate-500 truncate">· {profileState.hint}</span>
              </div>
              {/* name + edit */}
              <div className="flex items-center gap-2">
                <h1 className="font-display text-[26px] sm:text-[28px] font-bold tracking-tight leading-none truncate">{lead.name}</h1>
                {!isReadOnly && (
                  <IconBtn icon={<Pencil size={16} />} kind="default" title="Editar cadastro" onClick={() => setIsEditing(true)} />
                )}
              </div>
              {/* status + tags */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {!isClient && (
                  <StatusBadge statusName={lead.status} statusesArray={statuses} />
                )}
                {(lead.tags || []).length === 0 && !isReadOnly && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-1 text-[11.5px] font-medium text-slate-400 hover:text-brand-600 dark:hover:text-brand-300 px-2 py-1 rounded-md border border-dashed border-slate-300 dark:border-white/15 transition"
                  >
                    <Plus size={11} /> Adicionar etiqueta
                  </button>
                )}
                {(lead.tags || []).map(tName => (
                  <TagBadge key={tName} tagName={tName} tagsArray={tags} />
                ))}
              </div>
            </div>

            {/* actions */}
            <div className="flex items-center gap-2 flex-wrap ml-auto">
              <Btn kind="primary" size="md" icon={<MessageCircle size={14} />} onClick={handleWhatsApp}>WhatsApp</Btn>
              <Btn
                kind="secondary"
                size="md"
                icon={<Phone size={14} />}
                onClick={() => { const num = String(lead.whatsapp || '').replace(/\D/g, ''); if (num) window.location.href = `tel:${num}`; }}
              >
                Ligar
              </Btn>
              {/* Venda/Perda só fazem sentido p/ LEAD: cliente já converteu e gere
                  o contrato pela aba Contratos (Renovar / Cancelar). */}
              {!isClient && (
                <>
                  <div className="w-px h-6 bg-slate-200 dark:bg-white/[0.08] mx-0.5 hidden sm:block"></div>
                  <Btn
                    kind="success"
                    size="md"
                    icon={<TrendingUp size={14} />}
                    onClick={handleWin}
                    disabled={lead.status === 'Venda' || loading}
                    title={lead.status === 'Venda' ? 'Lead já marcado como venda' : 'Marcar venda'}
                  >
                    Marcar venda
                  </Btn>
                  <Btn
                    kind="danger"
                    size="md"
                    icon={<Ban size={14} />}
                    onClick={() => setLossModalOpen(true)}
                    disabled={lead.status === 'Perda' || loading}
                    title={lead.status === 'Perda' ? 'Lead já marcado como perda' : 'Marcar perda'}
                  >
                    Marcar perda
                  </Btn>
                </>
              )}
              {isAdminUser(appUser) && (
                <IconBtn icon={<Trash size={15} />} kind="danger" title="Excluir lead" onClick={handleDelete} />
              )}
            </div>
          </div>

          {/* meta strip */}
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/[0.05] flex items-center gap-x-5 gap-y-2 flex-wrap">
            <MetaItem icon={<MessageCircle size={13} />}><span className="num">{lead.whatsapp}</span></MetaItem>
            {lead.consultantName && <MetaItem icon={<Users size={13} />}>{lead.consultantName}</MetaItem>}
            <MetaItem icon={<Clock size={13} />}>
              {lead.nextFollowUp
                ? <span className="num">Próx. contato {lead.nextFollowUp.toLocaleDateString('pt-BR')} · {lead.nextFollowUp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                : <span className="italic text-slate-400 dark:text-slate-500">Sem próximo contato</span>}
            </MetaItem>
          </div>
        </div>
      </section>

      {/* Alerta contextual (a_vencer/inativo/cancelado/perdido) — CTA → handleAlertAction */}
      {contextAlert && (
        <div className="mb-5">
          <ContextAlert alert={contextAlert} onAction={handleAlertAction} />
        </div>
      )}

      {/* ===== Abas ===== */}
      <Tabs value={activeProfileTab} onValueChange={setActiveProfileTab}>
        <TabsList variant="line" className="gap-1 border-b border-slate-200 dark:border-white/[0.08] w-full justify-start rounded-none p-0">
          <TabsTrigger
            value="timeline"
            className="flex-none px-4 pb-2.5 text-[13px] data-[state=active]:text-slate-900 dark:data-[state=active]:text-white [&_svg]:data-[state=active]:text-brand-600 after:bg-brand-600"
          >
            <Clock />
            Linha do tempo
            <TabCount n={(interactions || []).length} active={activeProfileTab === 'timeline'} />
          </TabsTrigger>
          <TabsTrigger
            value="crm"
            className="flex-none px-4 pb-2.5 text-[13px] data-[state=active]:text-slate-900 dark:data-[state=active]:text-white [&_svg]:data-[state=active]:text-brand-600 after:bg-brand-600"
          >
            <Target />
            CRM
          </TabsTrigger>
          <TabsTrigger
            value="contratos"
            className="flex-none px-4 pb-2.5 text-[13px] data-[state=active]:text-slate-900 dark:data-[state=active]:text-white [&_svg]:data-[state=active]:text-brand-600 after:bg-brand-600"
          >
            <FileText />
            Contratos
            <TabCount n={leadContracts.length} active={activeProfileTab === 'contratos'} />
          </TabsTrigger>
        </TabsList>

        {/* ----- Aba: Linha do tempo ----- */}
        <TabsContent value="timeline" className="space-y-4 pt-2">
          {/* Timeline filters + search */}
          {(interactions || []).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07]">
                {TIMELINE_FILTERS.map(f => {
                  const active = timelineFilter === f.id;
                  const c = timelineCounts[f.id] || 0;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setTimelineFilter(f.id)}
                      className={cn(
                        'h-7 px-2.5 rounded-md text-[12px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition',
                        active
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      )}
                    >
                      {f.label}
                      <span className={cn(
                        'num text-[10.5px] px-1 h-[15px] rounded grid place-items-center min-w-[15px]',
                        active
                          ? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900'
                          : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'
                      )}>{c}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex-1"></div>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  value={timelineQuery}
                  onChange={e => setTimelineQuery(e.target.value)}
                  placeholder="Buscar na linha do tempo..."
                  className="h-9 w-64 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[12.5px] pl-8 pr-3 placeholder:text-slate-400 transition"
                />
              </div>
            </div>
          )}

          {/* Timeline */}
          {(interactions || []).length === 0 ? (
            <div className="py-16 grid place-items-center text-center text-slate-400">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/[0.05] grid place-items-center mb-3">
                <Clock size={20} className="opacity-50" />
              </div>
              <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Sem histórico ainda</p>
              <p className="text-[12.5px] max-w-[280px] mt-0.5">Registre uma nota, mensagem ou ligação na aba CRM para começar a história desta pessoa.</p>
            </div>
          ) : filteredInteractions.length === 0 ? (
            <div className="py-16 grid place-items-center text-center text-slate-400">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/[0.05] grid place-items-center mb-3">
                <Search size={20} className="opacity-50" />
              </div>
              <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Nenhum evento por aqui</p>
              <p className="text-[12.5px]">Tente ajustar o filtro ou a busca.</p>
            </div>
          ) : (
            <div className="space-y-6 pb-8">
              {groupedEvents.map(([label, events]) => {
                // dateLabel: só em Hoje/Ontem mostra a data absoluta ao lado do
                // rótulo, como o DateGroup do protótipo (demais grupos já trazem
                // mês/ano no próprio label).
                const dateLabel = (label === 'Hoje' || label === 'Ontem') && events[0]?.createdAt
                  ? events[0].createdAt.toLocaleDateString('pt-BR')
                  : null;
                return (
                  <section key={label} className="relative">
                    {/* Cabeçalho de grupo sticky (label + data + nº de eventos).
                        Usa utilitários sticky do Tailwind (a classe .sticky-date
                        do protótipo não existe no nosso index.css). */}
                    <header className="sticky top-0 z-10 -mx-1 mb-2 px-1 py-2 bg-paper-50/95 dark:bg-ink-950/95 backdrop-blur">
                      <div className="flex items-center gap-2 pl-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">{label}</span>
                        {dateLabel && (
                          <span className="text-[11.5px] text-slate-400 dark:text-slate-500 num whitespace-nowrap">· {dateLabel}</span>
                        )}
                        <div className="flex-1 h-px bg-slate-200/80 dark:bg-white/[0.06] ml-1"></div>
                        <span className="text-[11px] num text-slate-400 dark:text-slate-500 whitespace-nowrap">{events.length} {events.length === 1 ? 'evento' : 'eventos'}</span>
                      </div>
                    </header>
                    <div className="relative">
                      {/* Trilha vertical */}
                      <div className="absolute left-[18px] top-0 bottom-0 w-px bg-slate-200 dark:bg-white/[0.08]"></div>
                      <div className="space-y-1">
                        {events.map(renderTimelineEvent)}
                      </div>
                    </div>
                  </section>
                );
              })}

              {/* Origin marker */}
              {timelineFilter === 'all' && !timelineQuery && (
                <div className="relative pl-12">
                  <div className="absolute left-[15px] top-0">
                    <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-white/[0.1] ring-4 ring-paper-50 dark:ring-ink-950"></div>
                  </div>
                  <p className="text-[11.5px] text-slate-400 dark:text-slate-500 mt-0.5 whitespace-nowrap">
                    Início da jornada · {lead.createdAt?.toLocaleDateString('pt-BR') || '—'}
                  </p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ----- Aba: CRM ----- */}
        <TabsContent value="crm" className="pt-2">
          {/* Coluna única (port de crm.jsx) — sem card de cadastro (vive no modal Editar). */}
          <div className="space-y-5">
            {renderComposer()}

              {/* Próximos agendamentos — port de crm.jsx (AppointmentsList) */}
              <section className="rounded-2xl border border-border bg-card shadow-card">
                <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-white/[0.05]">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg grid place-items-center bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"><Calendar size={14} /></span>
                    <h3 className="text-[14px] font-semibold tracking-tight">Próximos agendamentos</h3>
                    {upcomingAppointments.length > 0 && (
                      <span className="num text-[11px] font-bold px-1.5 h-[18px] grid place-items-center rounded-md bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">{upcomingAppointments.length}</span>
                    )}
                  </div>
                  <Btn kind="soft" size="sm" icon={<Plus size={13} />} onClick={() => { setActiveProfileTab('crm'); setComposerTab('schedule'); }}>Agendar</Btn>
                </div>
                <div className="p-4">
                  {upcomingAppointments.length === 0 ? (
                    <div className="py-8 grid place-items-center text-center">
                      <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-white/[0.05] grid place-items-center mb-2.5 text-slate-400"><Calendar size={18} /></div>
                      <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">Nenhum agendamento</p>
                      <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-[260px]">Use o painel acima para agendar uma visita, aula, mensagem ou ligação.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {upcomingAppointments.map(({ i, appt }) => {
                        const apptToneName = appt.kind === 'class' ? 'teal' : appt.kind === 'visit' ? 'violet' : appt.kind === 'call' ? 'amber' : 'emerald';
                        const aTone = getTone(apptToneName);
                        const ApptIcon = appt.kind === 'class' ? BookOpen : appt.kind === 'visit' ? Building2 : appt.kind === 'call' ? Phone : MessageCircle;
                        const apptTime = appt.when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                        const isToday = appt.when.toDateString() === new Date().toDateString();
                        const dayLabel = isToday
                          ? `Hoje · ${apptTime}`
                          : `${appt.when.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace('.', '')} · ${apptTime}`;
                        return (
                          <div key={i.id} className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-3.5 flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-white/12 transition">
                            <div className="text-center shrink-0 w-12">
                              <div className={cn('text-[10px] font-bold uppercase tracking-wider', aTone.text, aTone.darkText)}>{appt.when.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}</div>
                              <div className="num text-[22px] font-bold tracking-tight leading-none text-slate-900 dark:text-white">{String(appt.when.getDate()).padStart(2, '0')}</div>
                            </div>
                            <div className="w-px h-10 bg-slate-200 dark:bg-white/[0.08]"></div>
                            <span className={cn('w-9 h-9 rounded-lg grid place-items-center shrink-0', aTone.soft, aTone.text, aTone.darkSoft, aTone.darkText)}><ApptIcon size={16} /></span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[13.5px] font-semibold text-slate-900 dark:text-white truncate">{appt.label}</span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 whitespace-nowrap">Agendado</span>
                              </div>
                              <div className="text-[12px] text-slate-500 dark:text-slate-400 num mt-0.5">{dayLabel}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
          </div>
        </TabsContent>

        {/* ----- Aba: Contratos ----- */}
        <TabsContent value="contratos" className="pt-2">
          <div className="space-y-5">
            {/* Contrato vigente (ContractCard) / estado vazio "Matricular" */}
            {isClient && lead.currentContractId && getSafeDateOrNull(lead.currentContractEndsAt) ? (() => {
              const cStatus = clientContractStatus || CONTRACT_STATUS.ATIVO;
              const cStartsAt = getSafeDateOrNull(lead.currentContractStartsAt);
              const cEndsAt = getSafeDateOrNull(lead.currentContractEndsAt);
              const cancelled = cStatus === CONTRACT_STATUS.CANCELADO;
              const expired = cStatus === CONTRACT_STATUS.VENCIDO;
              const closed = cancelled || expired;
              const meta = CONTRACT_STATUS_META[cStatus] || CONTRACT_STATUS_META[CONTRACT_STATUS.CANCELADO];
              const t = getTone(meta.tone);
              const StIcon = meta.icon;

              // Vigência: percentual decorrido + dias restantes/vencidos. Sem
              // inventar parcelas/forma de pagamento — só usamos vigência real.
              const MS_DAY = 86400000;
              const now = Date.now();
              let progressPct = 0;
              let daysLeft = null;
              if (cStartsAt && cEndsAt) {
                const span = cEndsAt.getTime() - cStartsAt.getTime();
                progressPct = span > 0
                  ? Math.max(0, Math.min(100, Math.round(((now - cStartsAt.getTime()) / span) * 100)))
                  : (now >= cEndsAt.getTime() ? 100 : 0);
                daysLeft = Math.ceil((cEndsAt.getTime() - now) / MS_DAY);
              }
              const barClass = cancelled ? 'bg-rose-400' : t.strong;
              const barPct = cancelled ? 60 : progressPct;

              return (
                <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
                  {/* header band */}
                  <div className="px-5 sm:px-6 py-5 border-b border-slate-100 dark:border-white/[0.05] flex items-start gap-4 flex-wrap">
                    <span className={cn('w-12 h-12 rounded-xl grid place-items-center shrink-0', t.soft, t.text, t.darkSoft, t.darkText)}><FileText size={22} /></span>
                    <div className="min-w-[200px] flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display text-[18px] font-bold tracking-tight leading-tight whitespace-nowrap">{lead.currentPlanName || 'Plano'}</h3>
                        {cStatus === CONTRACT_STATUS.A_VENCER ? (
                          <ContractAVencerBadge variant="pill" />
                        ) : (
                          <span className={cn('inline-flex items-center gap-1.5 font-semibold rounded-full whitespace-nowrap text-[12px] px-2.5 py-1 h-[26px]', t.soft, t.text, t.darkSoft, t.darkText)}>
                            <StIcon size={12} />{CONTRACT_STATUS_LABEL[cStatus] || cStatus}
                          </span>
                        )}
                      </div>
                      <div className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-1">
                        contrato <span className="num">#{String(lead.currentContractId).slice(0, 8).toUpperCase()}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[24px] font-bold tracking-tight num text-slate-900 dark:text-white leading-none">
                        {lead.currentContractValue != null ? fmtBRL(lead.currentContractValue) : '—'}
                      </div>
                    </div>
                  </div>

                  {/* vigência */}
                  <div className="px-5 sm:px-6 py-5 border-b border-slate-100 dark:border-white/[0.05]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Vigência</span>
                      {cStatus === CONTRACT_STATUS.ATIVO && daysLeft != null && <span className="text-[11.5px] num text-slate-500 dark:text-slate-400">{Math.max(0, daysLeft)} dias restantes</span>}
                      {cStatus === CONTRACT_STATUS.A_VENCER && daysLeft != null && <span className="text-[11.5px] num font-semibold text-amber-600 dark:text-amber-300">vence em {Math.max(0, daysLeft)} dias</span>}
                      {expired && daysLeft != null && <span className="text-[11.5px] num font-semibold text-slate-500">venceu há {Math.abs(daysLeft)} dias</span>}
                      {cancelled && <span className="text-[11.5px] num font-semibold text-rose-500 dark:text-rose-300">contrato cancelado</span>}
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                      <div className={cn('h-full rounded-full', barClass)} style={{ width: `${barPct}%` }}></div>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[12px] num text-slate-500 dark:text-slate-400">
                      <span>Início · {cStartsAt ? cStartsAt.toLocaleDateString('pt-BR') : '—'}</span>
                      <span>Término · {cEndsAt ? cEndsAt.toLocaleDateString('pt-BR') : '—'}</span>
                    </div>
                  </div>

                  {/* details grid — só os campos que temos (plano/valor/vigência) */}
                  <div className="px-5 sm:px-6 py-5 grid grid-cols-2 sm:grid-cols-3 gap-5 border-b border-slate-100 dark:border-white/[0.05]">
                    <div>
                      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Plano</div>
                      <div className="text-[16px] font-bold tracking-tight mt-1 text-slate-900 dark:text-white">{lead.currentPlanName || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Valor</div>
                      <div className="text-[16px] font-bold tracking-tight mt-1 num text-slate-900 dark:text-white">{lead.currentContractValue != null ? fmtBRL(lead.currentContractValue) : '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Vigência</div>
                      <div className="text-[16px] font-bold tracking-tight mt-1 num text-slate-900 dark:text-white">{progressPct}%</div>
                      <div className="text-[11.5px] text-slate-500 dark:text-slate-400 num mt-0.5">decorrido</div>
                    </div>
                  </div>

                  {/* actions */}
                  {!isReadOnly && (
                    <div className="px-5 sm:px-6 py-4 flex items-center gap-2 flex-wrap">
                      {closed ? (
                        <Btn kind="accent" icon={<UserPlus size={14} />} onClick={handleWin} disabled={loading}>Nova matrícula</Btn>
                      ) : (
                        <>
                          <Btn kind="brand" icon={<RefreshCw size={14} />} onClick={handleRenew} disabled={loading}>Renovar contrato</Btn>
                          <div className="flex-1"></div>
                          <Btn kind="danger" icon={<Ban size={14} />} onClick={handleCancelContract} disabled={loading}>Cancelar contrato</Btn>
                        </>
                      )}
                    </div>
                  )}
                </section>
              );
            })() : (
              // Estado vazio — lead/cliente sem contrato vigente → matrícula.
              <section className="rounded-2xl border border-dashed border-slate-300 dark:border-white/[0.1] bg-card p-10 text-center">
                <div className="w-16 h-16 rounded-2xl grid place-items-center mx-auto mb-4 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"><FileText size={28} /></div>
                <h3 className="font-display text-[18px] font-bold tracking-tight">Sem contrato ativo</h3>
                <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1.5 max-w-[380px] mx-auto">
                  {firstName} ainda não tem contrato vigente. Quando fechar a matrícula, registre o plano, valor e vigência para acompanhar a renovação por aqui.
                </p>
                {!isReadOnly && (
                  <div className="mt-5 flex items-center justify-center gap-2">
                    <Btn kind="accent" size="lg" icon={<UserPlus size={16} />} onClick={handleWin} disabled={loading}>Matricular agora</Btn>
                  </div>
                )}
              </section>
            )}

            {/* Histórico de contratos (HistoryRow) */}
            <section className="rounded-2xl border border-border bg-card shadow-card">
              <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-white/[0.05]">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg grid place-items-center bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-300"><Clock size={14} /></span>
                  <h3 className="text-[14px] font-semibold tracking-tight">Histórico de contratos</h3>
                  {leadContracts.length > 0 && (
                    <span className="num text-[11px] font-bold px-1.5 h-[18px] grid place-items-center rounded-md bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">{leadContracts.length}</span>
                  )}
                </div>
              </div>
              <div className="p-2">
                {leadContracts.length === 0 ? (
                  <div className="py-8 grid place-items-center text-center">
                    <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">Nenhum contrato anterior</p>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">O histórico de planos aparecerá aqui.</p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {leadContracts.map(c => {
                      const cStatus = deriveContractStatus(c, new Date(), contractThresholdDays);
                      const cStartsAt = getSafeDateOrNull(c.startsAt);
                      const cEndsAt = getSafeDateOrNull(c.endsAt);
                      const isCurrent = lead.currentContractId && c.id === lead.currentContractId;
                      const hMeta = cStatus ? (CONTRACT_STATUS_META[cStatus] || CONTRACT_STATUS_META[CONTRACT_STATUS.CANCELADO]) : CONTRACT_STATUS_META[CONTRACT_STATUS.VENCIDO];
                      const ht = getTone(hMeta.tone);
                      return (
                        <div key={c.id} className="flex items-center gap-3.5 px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.03] transition">
                          <span className={cn('w-9 h-9 rounded-lg grid place-items-center shrink-0', ht.soft, ht.text, ht.darkSoft, ht.darkText)}><FileText size={15} /></span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[13.5px] font-semibold text-slate-900 dark:text-white truncate">{c.planName || '—'}</span>
                              {isCurrent && (
                                <span className="inline-flex items-center px-1.5 h-5 rounded text-[10px] font-semibold bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300 shrink-0">Vigente</span>
                              )}
                            </div>
                            <div className="text-[12px] text-slate-500 dark:text-slate-400 num">
                              {cStartsAt ? cStartsAt.toLocaleDateString('pt-BR') : '—'} → {cEndsAt ? cEndsAt.toLocaleDateString('pt-BR') : '—'}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[13px] font-semibold num text-slate-700 dark:text-slate-200">{c.value != null ? fmtBRL(c.value) : '—'}</div>
                            {cStatus && <div className="text-[11px] text-slate-400 dark:text-slate-500">{CONTRACT_STATUS_LABEL[cStatus] || cStatus}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>
        </TabsContent>
      </Tabs>

      {/* Overlays */}
      <EditLeadModal
        open={isEditing}
        onClose={() => setIsEditing(false)}
        lead={lead}
        appUser={appUser}
        db={db}
        usersList={usersList}
        tags={tags}
      />
      {lossModalOpen && <LossReasonModal lossReasons={lossReasons} onClose={() => setLossModalOpen(false)} onConfirm={confirmLoss} />}
      {matriculaOpen && (
        <MatriculaModal
          lead={lead}
          appUser={appUser}
          db={db}
          mode={matriculaMode}
          renewedFromId={matriculaMode === 'renovacao' ? lead.currentContractId : null}
          onClose={() => setMatriculaOpen(false)}
          onDone={() => { setMatriculaOpen(false); if (matriculaMode === 'matricula') setStatus('Venda'); }}
        />
      )}
    </div>
  );
}

export { LeadProfileView };
