import { useState } from 'react';
import { collection, doc, deleteDoc, getDocs, writeBatch, query, where, serverTimestamp } from 'firebase/firestore';
import { appId, LEADS_PATH, INTERACTIONS_PATH, CONTRACTS_PATH } from '../lib/firebase.js';
import { logInteraction } from '../lib/interactions.js';
import { useLeadTimeline } from '../hooks/useLeadTimeline.js';
import { useReferrals } from '../hooks/useReferrals.js';
import { withBucket } from '../lib/leadDerived.js';
import { isAdminUser, canEditLead, isLeadConverted, isConvertedStatusName } from '../lib/leads.js';
import { normalizeAppointmentType, getSafeDateOrNull } from '../lib/dates.js';
import { fmtBRL } from '../lib/format.js';
import { deriveContractStatus, deriveLeadContractStatus, CONTRACT_STATUS, CONTRACT_STATUS_LABEL } from '../lib/contracts.js';
import { contractVigencia, daysBetween, missedCheckpointsLabel } from '../lib/renewal.js';
import { getDefaultFunnel } from '../lib/funnels.js';
import { getReferralFunnel } from '../lib/referrals.js';
import { commitReferralLink, removeReferralLink } from '../lib/referralsWrites.js';
import { deriveLeadState, getTone, phaseToneName } from '../lib/leadState.js';
import { professorNameById } from '../lib/professores.js';
import { upsertScheduledAula, markConvertingAula, unmarkConvertedAula } from '../lib/aulasWrites.js';
import { cn } from '../lib/utils.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { useLeadProfile } from '../contexts/LeadProfileContext.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Btn, IconBtn } from '../components/ui/Btn.jsx';
import { StatusBadge, TagBadge } from '../components/ui/Badges.jsx';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs.jsx';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog.jsx';
import { RingAvatar } from '../components/profile/RingAvatar.jsx';
import { PhaseChanger } from '../components/profile/PhaseChanger.jsx';
import { ReferralsSection } from '../components/profile/ReferralsSection.jsx';
import { ReferrerPicker } from '../components/profile/ReferrerPicker.jsx';
import { ScheduleWizard } from '../components/profile/ScheduleWizard.jsx';
import { LossReasonModal } from '../modals/LossReasonModal.jsx';
import { ContractModal } from '../modals/ContractModal.jsx';
import { ContractOutcomeModal } from '../modals/ContractOutcomeModal.jsx';
import { ContractEditModal } from '../modals/ContractEditModal.jsx';
import { ClientRegistrationModal } from '../modals/ClientRegistrationModal.jsx';
import {
  groupTimeline,
  groupTimelineByDay,
  classifyInteraction,
  parseAppointment,
  extractStageNameFromInteractionText,
  buildStageTransitions,
  matchesTimelineFilter,
  timelineTypeLabel,
  TIMELINE_FILTERS,
  TIMELINE_SYSTEM_KIND
} from '../lib/timeline.js';
import { ArrowLeft, ArrowRight, Ban, BookOpen, Building2, Calendar, Check, CheckCircle, Clock, Copy, CreditCard, FileText, GraduationCap, Handshake, MessageCircle, Pencil, Phone, PlayCircle, Plus, RefreshCw, Search, Tag, Target, ThumbsDown, Trash, TrendingUp, User, UserPlus, Users } from 'lucide-react';

// Tom do bloco de contagem, do chip e do preenchimento da régua — o estado do
// contrato manda na cor da aba Contratos inteira.
const CONTRACT_TONE = {
  [CONTRACT_STATUS.AGENDADO]: { block: 'bg-violet-500/10 dark:bg-violet-500/15', fg: 'text-violet-700 dark:text-violet-300', fill: 'bg-violet-500' },
  [CONTRACT_STATUS.TRANCADO]: { block: 'bg-brand-500/10 dark:bg-brand-500/15', fg: 'text-brand-700 dark:text-brand-300', fill: 'bg-brand-600' },
  [CONTRACT_STATUS.ATIVO]: { block: 'bg-emerald-500/10 dark:bg-emerald-500/15', fg: 'text-emerald-700 dark:text-emerald-400', fill: 'bg-emerald-500' },
  [CONTRACT_STATUS.A_VENCER]: { block: 'bg-amber-500/12 dark:bg-amber-500/16', fg: 'text-amber-700 dark:text-amber-400', fill: 'bg-amber-500' },
  [CONTRACT_STATUS.VENCIDO]: { block: 'bg-slate-500/10 dark:bg-slate-400/15', fg: 'text-slate-600 dark:text-slate-300', fill: 'bg-slate-400' },
  [CONTRACT_STATUS.CANCELADO]: { block: 'bg-rose-500/10 dark:bg-rose-500/15', fg: 'text-rose-700 dark:text-rose-400', fill: 'bg-rose-500' }
};

// Rótulo em versalete das células. Sempre no tom `muted`: a 9.5px ele faz
// trabalho estrutural, é o que faz a faixa ler como células.
const CapsLabel = ({ children }) => (
  <div className="text-[9.5px] font-bold uppercase tracking-[.08em] text-slate-500 dark:text-slate-400 whitespace-nowrap">
    {children}
  </div>
);

// Lacuna entre dois contratos, em dias ou meses conforme o tamanho.
const gapLabel = (days) => {
  if (days < 45) return `${days} ${days === 1 ? 'dia' : 'dias'} sem contrato`;
  const months = Math.round(days / 30.44);
  return `${months} ${months === 1 ? 'mês' : 'meses'} sem contrato`;
};

// Célula da faixa de metadados do cabeçalho: rótulo em versalete sobre o valor.
// Substituiu a fila de ícones — sem rótulo, "(51) 99184-2270" e "Ana Duarte"
// pareciam a mesma categoria de informação.
const MetaCell = ({ label, children }) => (
  <div className="min-w-0 px-5 first:pl-0 py-0.5">
    <div className="text-[9.5px] font-bold uppercase tracking-[.07em] text-slate-400 dark:text-slate-500 whitespace-nowrap">
      {label}
    </div>
    <div className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-700 dark:text-slate-200 min-w-0">
      {children}
    </div>
  </div>
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

function LeadProfileView({ lead, onBack, appUser, statuses, tags, lossReasons, usersList, db, funnels }) {
  // Timeline por query própria (G2): histórico COMPLETO do lead (índice #10),
  // ao vivo. Antes vinha do prop global filtrado por leadId — que pós-G2 é só o
  // mês corrente. A ficha remonta por lead (key), então o hook não reseta.
  const interactions = useLeadTimeline({ db, leadId: lead?.id });
  const toast = useToast();
  const { openProfile } = useLeadProfile();
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
  // 'matricula' (nova/retroativa) | 'renovacao' — controla o modo do ContractModal.
  const [matriculaMode, setMatriculaMode] = useState('matricula');
  // Desfecho do contrato vigente: 'cancelar' | 'trancar' | 'reativar'.
  const [contractAction, setContractAction] = useState(null);
  const [editingContract, setEditingContract] = useState(false);
  // Threshold de vencimento do contexto (sem prop-drilling) p/ a seção Contrato.
  const { contractThresholdDays, contratos, professores, renewalCheckpoints } = useGeneralConfig();

  // Composer tab — drives which form is shown in the activity Composer card.
  const [composerTab, setComposerTab] = useState('note');

  // Aba ativa da ficha (timeline | crm | contratos | referrals).
  const [activeProfileTab, setActiveProfileTab] = useState('timeline');

  // Vínculo de indicação: dialog de vincular/editar/remover + escolha do picker.
  const [referrerDialogOpen, setReferrerDialogOpen] = useState(false);
  const [referrerPick, setReferrerPick] = useState(null);

  // Timeline filter + search
  const [timelineFilter, setTimelineFilter] = useState('all');
  // Eventos de sistema (Meta Diária, etiquetas, "lead criado") entram só sob
  // demanda: não têm o mesmo peso de uma conversa.
  const [showSystem, setShowSystem] = useState(false);
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

  // A matrícula deixou de ser um simples confirm: abre o ContractModal, que
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
  // Cancelar, trancar e reativar passam pelo ContractOutcomeModal: os três
  // pedem data e os dois primeiros pedem motivo — o cancelamento gravava
  // motivo null desde sempre.
  const openContractAction = (action) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (!lead.currentContractId) { toast.warning('Não há contrato vigente.'); return; }
    setContractAction(action);
  };

  const confirmLoss = async (reason) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    setLoading(true);
    try {
      await logInteraction(db, lead, appUser,
        { text: `Lead perdido. Motivo: ${reason}`, type: 'status_change' },
        withBucket({
          status: 'Perda',
          lossReason: reason,
          nextFollowUp: null,
          lostAt: serverTimestamp(),
          // Limpa resquício caso o lead viesse de Venda.
          isConverted: false,
          convertedAt: null
        }, lead)
      );
      // #8: Perda é CHURN, então NÃO desfaz a conversão histórica da aula. A
      // matrícula aconteceu; o churn é medido pela taxa de renovação, não
      // reescrevendo a conversão passada do professor. (Sair de Venda p/ fase de
      // lead ainda desfaz, ver handlePhaseConfirm/saveInteraction: venda por engano.)
      setLossModalOpen(false);
      setStatus('Perda');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao registrar a perda. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Confirmação do PhaseChanger (composer → "Mudar fase"). Venda/Perda caem nos
  // fluxos existentes (MatriculaModal / LossReasonModal); demais fases gravam o
  // status (+funil, se mudou) e registram a transição na timeline.
  const handlePhaseConfirm = async ({ funnelId: targetFunnelId, targetStatus, note: phaseNote, referrer }) => {
    if (targetStatus === 'Venda') { setMatriculaMode('matricula'); setMatriculaOpen(true); return; }
    if (targetStatus === 'Perda') { setLossModalOpen(true); return; }
    if (!canTimeline) { toast.warning('Você não tem permissão para registrar interações neste lead.'); return; }
    // Mover PRO funil de Indicações exige o vínculo (o PhaseChanger coleta o
    // indicador; isto é cinto de segurança pra manter o coorte rastreável).
    const movingToReferral = Boolean(referralFunnel && targetFunnelId === referralFunnel.id && targetFunnelId !== lead.funnelId);
    if (movingToReferral && !lead.referredById && !referrer) {
      toast.warning('Para mover para o funil de Indicações, vincule o cliente indicador.');
      return;
    }
    setLoading(true);
    try {
      // Vínculo retroativo primeiro (eventos 🤝 dos dois lados + referredAt);
      // a mudança de fase segue no caminho normal logo abaixo.
      if (movingToReferral && referrer && !lead.referredById) {
        await commitReferralLink({ db, lead, appUser, referrer });
      }
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
      await logInteraction(db, lead, appUser,
        { text: `Fase alterada para [${targetStatus}]${phaseNote ? ' — ' + phaseNote : ''}.`, type: 'status_change' },
        withBucket(up, lead)
      );
      // Histórico de aulas (dual-write best-effort): atribui/retira a
      // conversão da última aula atendida do lead.
      if (destinoConvertido && !getSafeDateOrNull(lead.convertedAt)) {
        try { await markConvertingAula({ db, leadId: lead.id }); } catch (e) { console.error('markConvertingAula falhou', e); }
      }
      if (lead.status === 'Venda' && targetStatus !== 'Venda' && !destinoConvertido) {
        try { await unmarkConvertedAula({ db, leadId: lead.id }); } catch (e) { console.error('unmarkConvertedAula falhou', e); }
      }
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

  // Vincular/trocar/remover o indicador direto da ficha — corrige vínculo
  // errado e é o caminho retroativo para leads antigos com origem Indicação.
  const handleSaveReferral = async () => {
    if (!referrerPick) return;
    setLoading(true);
    try {
      await commitReferralLink({ db, lead, appUser, referrer: referrerPick });
      toast.success?.(`Indicação vinculada a ${referrerPick.name}.`);
      setReferrerDialogOpen(false);
      setReferrerPick(null);
      reloadReferrals();
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar o vínculo.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveReferral = async () => {
    setLoading(true);
    try {
      await removeReferralLink({ db, lead, appUser });
      toast.success?.('Vínculo de indicação removido.');
      setReferrerDialogOpen(false);
      setReferrerPick(null);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível remover o vínculo.');
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

      await logInteraction(db, lead, appUser,
        {
          text: actionText || 'Atualização registrada.',
          type: (status !== lead.status || funnelChanged) ? 'status_change' : 'note'
        },
        withBucket(up, lead)
      );
      // Histórico de aulas: saindo de Venda desfaz a conversão (best-effort).
      if (lead.status === 'Venda' && status !== 'Venda') {
        try { await unmarkConvertedAula({ db, leadId: lead.id }); } catch (e) { console.error('unmarkConvertedAula falhou', e); }
      }

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

      // Dual-write best-effort no histórico de aulas (stronix_aulas): a regra
      // do Firestore pode ainda não estar publicada, então falha aqui NÃO
      // pode quebrar o agendamento do lead — por isso o try/catch isolado.
      let currentAulaId = lead.currentAulaId || null;
      if (isAula) {
        try {
          currentAulaId = await upsertScheduledAula({
            db, lead,
            fields: {
              professorId: professorId || null,
              professorName: professorId ? professorNameById(professores, professorId) : null,
              soloTraining: Boolean(soloTraining),
              modality: modalidade || null,
              scheduledFor: date,
            },
          });
        } catch (e) {
          console.error('upsertScheduledAula falhou', e);
        }
      }

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
        appointmentScheduledFor: appointmentType ? date : null,
        // Compromisso NOVO nasce sem desfecho. Sem isto, o "não veio" do
        // agendamento anterior ficava colado no lead e a tela de Aulas/Visitas
        // mostrava o compromisso novo como já resolvido antes da data chegar.
        appointmentOutcome: null,
        appointmentOutcomeAt: null,
        appointmentOutcomeBy: null,
        currentAulaId
      };

      await logInteraction(db, lead, appUser,
        {
          text,
          type: 'note',
          // Meta por VOLUME: todo agendamento criado pelo wizard conta como ação
          // de pipeline (visita/aula/mensagem/ligação) — ver lib/dailyGoal.js.
          volumeKind: appointmentType || (/liga/i.test(typeLabel) ? 'ligacao' : 'mensagem')
        },
        up
      );

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
      await logInteraction(db, lead, appUser, {
        text: `📲 Mensagem WhatsApp enviada: ${msg}`,
        type: 'note'
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
      await logInteraction(db, lead, appUser, {
        text: `📞 Ligação: ${summary}`,
        type: 'note'
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

  // Indicações: funil de sistema (pro cinto do PhaseChanger e pro chip
  // "Vincular indicador") + dados da aba do CLIENTE. Contagem quando a ficha
  // de cliente abre; lista só quando a aba ativa.
  const referralFunnel = getReferralFunnel(safeFunnels);
  const isInReferralFunnel = Boolean(referralFunnel && lead.funnelId === referralFunnel.id);
  const { count: referralsCount, items: referralItems, loading: referralsLoading, reload: reloadReferrals } =
    useReferrals({ db, leadId: lead.id, enabled: isClient, active: activeProfileTab === 'referrals' });

  // Classificação + filtro da timeline (helpers compartilhados em lib/timeline.js).
  const interactionsWithClass = (interactions || []).map(i => ({ ...i, _kind: classifyInteraction(i) }));

  // Origem de cada mudança de fase, reconstruída da transição anterior: a origem
  // de uma transição é o destino da transição imediatamente anterior (em ordem
  // cronológica). Permite exibir "[origem] → [destino]" na timeline como no
  // protótipo, mesmo gravando só o destino. Best-effort: a 1ª transição fica sem
  // origem (mostra só o destino); eventos sem etapa entre [colchetes] (ex.: Perda
  // "Lead perdido…", reabertura) não entram na cadeia.
  // Origem de cada mudança de fase + quanto tempo o lead ficou na anterior.
  // A origem é o destino da transição anterior (só o destino é gravado); a
  // duração sai da diferença entre transições, com o cadastro do lead como
  // régua da primeira. Ver buildStageTransitions em lib/timeline.js.
  const stageTransitions = buildStageTransitions(
    interactionsWithClass.filter(i => i._kind === 'status'),
    lead.createdAt
  );

  // O desfecho aponta de volta para o agendamento que o originou: o
  // agendamento mais recente ANTES dele. Dado real — não há campo ligando os
  // dois, mas a ordem cronológica resolve.
  const outcomeOrigin = (() => {
    const chrono = interactionsWithClass
      .filter(i => i.createdAt instanceof Date)
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const map = {};
    let lastScheduled = null;
    chrono.forEach(i => {
      if (i.appointmentOutcome) {
        if (lastScheduled) map[i.id] = { at: lastScheduled.createdAt, by: lastScheduled.consultantName };
      } else if (i._kind === 'appointment') {
        lastScheduled = i;
      }
    });
    return map;
  })();

  // O interruptor de Sistema é aplicado ANTES do filtro e da busca — assim os
  // cinco contadores saem da MESMA lista que o clique realmente exibe (o mockup
  // errava isso: mostrava o total bruto em "Tudo").
  const timelineVisible = showSystem
    ? interactionsWithClass
    : interactionsWithClass.filter(i => i._kind !== TIMELINE_SYSTEM_KIND);
  const systemHiddenCount = interactionsWithClass.length - timelineVisible.length;

  const timelineSearched = (() => {
    const q = timelineQuery.trim().toLowerCase();
    if (!q) return timelineVisible;
    return timelineVisible.filter(i => `${i.text || ''} ${i.consultantName || ''}`.toLowerCase().includes(q));
  })();

  const timelineCounts = Object.fromEntries(
    TIMELINE_FILTERS.map(f => [f.id, timelineSearched.filter(i => matchesTimelineFilter(i._kind, f.id)).length])
  );

  const filteredInteractions = timelineSearched.filter(i => matchesTimelineFilter(i._kind, timelineFilter));

  const groupedEvents = groupTimeline(filteredInteractions);

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

  // O contrato VIGENTE tem card próprio; a corrente do histórico lista só os
  // anteriores (repeti-lo duplicava plano, valor e vigência 42px abaixo).
  const currentContract = leadContracts.find(c => c.id === lead.currentContractId) || null;
  const pastContracts = leadContracts.filter(c => c.id !== lead.currentContractId);
  // "3ª renovação": quantos contratos vieram antes do vigente.
  const renewalOrdinal = pastContracts.length;
  const renewedFrom = currentContract?.renewedFromId
    ? leadContracts.find(c => c.id === currentContract.renewedFromId) || null
    : null;

  // Estado do contrato vigente + a régua de vigência com os marcos de
  // renovação da academia (Configurações → Metas & ritmo, nunca hardcode).
  const curStatus = isClient && lead.currentContractId ? (clientContractStatus || CONTRACT_STATUS.ATIVO) : null;
  const curStartsAt = getSafeDateOrNull(lead.currentContractStartsAt);
  const curEndsAt = getSafeDateOrNull(lead.currentContractEndsAt);
  const hasCurrentContract = Boolean(isClient && lead.currentContractId && curEndsAt);
  const curClosed = curStatus === CONTRACT_STATUS.VENCIDO || curStatus === CONTRACT_STATUS.CANCELADO;
  // Trancado congela a régua na data em que parou: o contrato não corre.
  const curPaused = curStatus === CONTRACT_STATUS.TRANCADO;
  const curPausedAt = getSafeDateOrNull(currentContract?.pausedAt);
  const vigencia = hasCurrentContract
    ? contractVigencia({
      startsAt: curStartsAt,
      endsAt: curEndsAt,
      checkpoints: renewalCheckpoints,
      handled: lead.renewalHandledCheckpoints,
      now: curPaused && curPausedAt ? curPausedAt : new Date()
    })
    : null;

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
                db={db}
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

  // Chip de etapa da linha do tempo. A tinta sai do `hex` do tom (12% no fundo,
  // 30% na borda do destino) e o TEXTO nunca usa o passo 500 — só o 700/300,
  // senão 11px sobre fundo claro reprova AA (âmbar dá 2.15:1).
  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(String(lead.whatsapp || ''));
      toast.success('Número copiado.');
    } catch {
      toast.info('Copie o número manualmente.');
    }
  };

  const phaseChip = (name, isDestination) => {
    const t = getTone(phaseToneName(name, statuses));
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 h-[22px] px-2 rounded-md whitespace-nowrap text-[11px] font-semibold shrink-0',
          isDestination ? cn('border', t.text, t.darkText) : 'text-slate-500 dark:text-slate-400'
        )}
        style={{
          background: `${t.hex}1f`,
          ...(isDestination ? { borderColor: `${t.hex}4d` } : null)
        }}
      >
        <span className="size-1.5 rounded-full shrink-0" style={{ background: t.hex }} />
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
  // Uma linha do REGISTRO. Quatro colunas alinhadas em todas as variantes:
  // hora (38px) · tipo em versalete (74px) · corpo (resto) · autor (110px).
  // Cor no feed só aparece em chip de fase, selo de aula e faixa de marco —
  // todo o resto é neutro, senão vinte eventos viram um arco-íris.
  const renderTimelineEvent = (i) => {
    const time = i.createdAt?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const typeLabel = timelineTypeLabel(i);
    const author = i.consultantName || 'Sistema';
    const appt = i._kind === 'appointment' ? parseAppointment(i) : null;
    const stageName = i._kind === 'status' ? extractStageNameFromInteractionText(i.text) : '';
    const isContract = i._kind === 'contract';
    const contractCancel = isContract && /cancel/i.test(i.text || '');
    const lowerText = String(i.text || '').toLowerCase();
    // Perda: o status_change que encerra a oportunidade não traz etapa entre
    // colchetes — vem como "Lead perdido. Motivo: ...".
    const isLoss = i._kind === 'status' && !stageName && /perdid|perda/i.test(lowerText);
    const isWin = i._kind === 'status' && /^venda$/i.test(stageName);

    // Corpo limpo: tira os prefixos que o composer injeta (📲/📞 das conversas,
    // "Obs:" das notas, ✅/🔄/🔔 dos eventos de sistema). A coluna de TIPO já
    // diz o que a linha é.
    const cleanBody = String(i.text || '')
      .replace(/^📲\s*Mensagem WhatsApp enviada:\s*/i, '')
      .replace(/^📞\s*Ligação:\s*/i, '')
      .replace(/^OBSERVAÇÃO DO CADASTRO:\s*/i, '')
      .replace(/^Obs:\s*/i, '')
      .replace(/^[✅🔄🔔]\s*/u, '')
      .trim();

    // ---- Variante 4: marco (matrícula, venda, perda) ----------------------
    // Quebra o padrão tabular numa faixa full-width com régua no topo.
    if (isContract || isWin || isLoss) {
      const lossReason = isLoss
        ? (String(i.text || '').match(/motivo:\s*([^.·\n]+)/i)?.[1] || '').trim()
        : '';
      const band = contractCancel || isLoss
        ? { ring: 'border-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10', dot: 'bg-rose-500', Icon: Ban }
        : isWin
          ? { ring: 'border-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', dot: 'bg-emerald-500', Icon: CheckCircle }
          : { ring: 'border-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', dot: 'bg-emerald-500', Icon: GraduationCap };

      const title = isLoss
        ? `Oportunidade encerrada${lossReason ? ` · ${lossReason}` : ''}`
        : isWin
          ? 'Virou cliente — etapa Venda'
          : contractCancel ? 'Contrato cancelado'
            : /renova/i.test(i.text || '') ? 'Contrato renovado'
              : (lead.currentPlanName || 'Matrícula fechada');

      const subtitle = isWin ? `Fase alterada por ${author}` : cleanBody;

      // Valor só na matrícula, e só se o contrato realmente tiver valor.
      const showValue = isContract && !contractCancel && lead.currentContractValue != null
        && Number.isFinite(Number(lead.currentContractValue));

      return (
        <div key={i.id} className={cn('flex items-center gap-3 border-t-2 px-3.5 py-2.5 my-1', band.ring, band.bg)}>
          <span className={cn('size-[26px] rounded-full grid place-items-center shrink-0 text-white', band.dot)}>
            <band.Icon className="size-[13px]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-slate-900 dark:text-white truncate" title={title}>{title}</div>
            {subtitle && <div className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate" title={subtitle}>{subtitle}</div>}
          </div>
          {showValue && (
            <span className="font-display text-[17px] font-bold text-emerald-700 dark:text-emerald-300 num shrink-0">
              {fmtBRL(lead.currentContractValue)}
            </span>
          )}
          <span className="text-[11px] num text-slate-400 dark:text-slate-500 shrink-0" title={i.createdAt?.toLocaleString('pt-BR')}>{time}</span>
        </div>
      );
    }

    // ---- Corpo das variantes tabulares ------------------------------------
    let body = null;
    let typeToneClass = 'text-slate-400 dark:text-slate-500';

    if (i._kind === 'status' && stageName) {
      // Variante 2: mudança de fase — dois chips e a duração na etapa anterior.
      const t = stageTransitions[i.id] || {};
      const destTone = getTone(phaseToneName(stageName, statuses));
      typeToneClass = cn(destTone.text, destTone.darkText);
      const durationText = t.days == null
        ? null
        : t.fromCreation
          ? `após ${t.days}d desde o cadastro`
          : t.from ? `após ${t.days}d em ${t.from}` : null;

      body = (
        <div className="flex items-center gap-2 flex-wrap">
          {t.from && (
            <>
              {phaseChip(t.from, false)}
              <ArrowRight size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
            </>
          )}
          {phaseChip(stageName, true)}
          {durationText && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500">{durationText}</span>
          )}
        </div>
      );
    } else if ((appt && appt.when) || i.appointmentOutcome) {
      // Variante 3: agendamento e desfecho compartilham o bloco.
      // O selo sai do campo REAL appointmentOutcome quando existe; o
      // agendamento em si (ainda sem desfecho) fica em "Agendado".
      const OUTCOME_SEALS = {
        attended: { label: 'Compareceu', className: 'bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-300' },
        no_show: { label: 'Faltou', className: 'bg-rose-500/[0.12] text-rose-700 dark:text-rose-300' },
        rescheduled: { label: 'Reagendado', className: 'bg-amber-500/[0.12] text-amber-700 dark:text-amber-300' },
        cancelled: { label: 'Cancelado', className: 'bg-slate-500/[0.12] text-slate-600 dark:text-slate-300' }
      };
      const outcome = OUTCOME_SEALS[i.appointmentOutcome]
        || { label: 'Agendado', className: 'bg-brand-500/[0.12] text-brand-700 dark:text-brand-300' };
      const isDone = Boolean(i.appointmentOutcome);
      // No desfecho não há data no texto: a régua é o próprio evento.
      const when = (appt && appt.when) || i.createdAt;
      const title = appt?.label || cleanBody || 'Agendamento';
      const detail = appt
        ? [appt.location, appt.note, when.toLocaleDateString('pt-BR', { weekday: 'long' })].filter(Boolean).join(' · ')
        : when.toLocaleDateString('pt-BR', { weekday: 'long' });
      const origin = outcomeOrigin[i.id];

      body = (
        <div className="rounded-lg border border-slate-200 dark:border-white/[0.07] bg-slate-50 dark:bg-white/[0.02] px-2.5 py-[7px]">
          <div className="flex items-center gap-2.5">
            <div className="w-[34px] shrink-0 text-center">
              <div className={cn(
                'font-display text-[16px] font-bold leading-none num',
                isDone ? 'text-emerald-700 dark:text-emerald-400' : 'text-brand-700 dark:text-brand-300'
              )}>
                {String(when.getDate()).padStart(2, '0')}
              </div>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-0.5">
                {when.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}
              </div>
            </div>
            <div className="w-px h-[26px] bg-slate-200 dark:bg-white/[0.08] shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[12.5px] font-semibold text-slate-900 dark:text-white truncate">{title}</span>
                <span className="text-[11px] num text-slate-500 dark:text-slate-400 shrink-0">
                  {when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{detail}</div>
            </div>
            <span className={cn(
              'shrink-0 h-[17px] px-1.5 rounded inline-flex items-center text-[9.5px] font-bold uppercase tracking-[.05em]',
              outcome.className
            )}>
              {outcome.label}
            </span>
          </div>

          {/* O desfecho aponta de volta pro agendamento que o originou. */}
          {origin && (
            <div className="mt-[7px] pt-[7px] border-t border-slate-200 dark:border-white/[0.07] text-[11px] text-slate-400 dark:text-slate-500">
              Agendada em {origin.at.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              {origin.by ? ` por ${origin.by}` : ''}
            </div>
          )}
        </div>
      );
    } else if (cleanBody) {
      // Variante 1: linha simples (nota, conversa, sistema).
      const meta = i.pinned ? 'Anotação fixada' : null;
      body = (
        <div>
          <p className="text-[12.5px] leading-[1.5] text-slate-700 dark:text-slate-200 text-pretty whitespace-pre-wrap">{cleanBody}</p>
          {meta && <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{meta}</div>}
        </div>
      );
    }

    if (!body) return null;

    return (
      <div
        key={i.id}
        className="grid grid-cols-[38px_74px_1fr_110px] gap-3 items-start py-1.5 border-b border-slate-100 dark:border-white/[0.05] hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="text-[11px] num text-slate-400 dark:text-slate-500 text-right pt-0.5" title={i.createdAt?.toLocaleString('pt-BR')}>{time}</div>
        <div className={cn('text-[9.5px] font-bold uppercase tracking-[.07em] pt-1', typeToneClass)}>{typeLabel}</div>
        <div className="min-w-0">{body}</div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 text-right truncate pt-0.5" title={author}>{author}</div>
      </div>
    );
  };

  return (
    // 1160px centralizado (medida do handoff). O shell do app libera até
    // 1400/1600px, e nessa largura a linha do tempo vira uma linha de texto
    // longa demais entre a hora e o autor — a leitura do registro depende da
    // coluna curta.
    <div className="animate-fade-in font-sans max-w-[1160px] mx-auto w-full">
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
            {/* Sem o ponto: o anel, o ponto e o texto "CLIENTE ATIVO" diziam a
                mesma coisa três vezes. Fica o anel. */}
            <RingAvatar name={lead.name} size={64} toneName={profileState.tone} showDot={false} splitHex={profileState.key === 'a_vencer' ? '#10B981' : null} />

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
                {(lead.referredById || lead.referredByName) ? (
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <Handshake size={11} />
                    <button
                      type="button"
                      onClick={() => lead.referredById && openProfile(lead.referredById)}
                      className={cn('hover:underline', !lead.referredById && 'pointer-events-none')}
                    >
                      Indicado por {lead.referredByName || 'cliente'}
                    </button>
                    {!isReadOnly && (
                      <button
                        type="button"
                        title="Editar vínculo de indicação"
                        onClick={() => { setReferrerPick(null); setReferrerDialogOpen(true); }}
                        className="text-emerald-600/70 hover:text-emerald-700 dark:text-emerald-300/70 dark:hover:text-emerald-300 transition"
                      >
                        <Pencil size={10} />
                      </button>
                    )}
                  </span>
                ) : (isInReferralFunnel && !isReadOnly && (
                  <button
                    type="button"
                    onClick={() => { setReferrerPick(null); setReferrerDialogOpen(true); }}
                    className="inline-flex items-center gap-1 text-[11.5px] font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-md border border-dashed border-emerald-300 dark:border-emerald-500/30 transition"
                  >
                    <Handshake size={11} /> Vincular indicador
                  </button>
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

          {/* Faixa de metadados: quatro células rotuladas, separadas por régua. */}
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/[0.05] grid grid-cols-2 lg:grid-cols-4 gap-y-3 divide-x divide-slate-100 dark:divide-white/[0.06]">
            <MetaCell label="Contato">
              <span className="num truncate">{lead.whatsapp || '—'}</span>
              {lead.whatsapp && (
                <button
                  type="button"
                  onClick={copyPhone}
                  title="Copiar número"
                  aria-label="Copiar número"
                  className="shrink-0 size-5 grid place-items-center rounded text-slate-400 hover:text-brand-600 dark:hover:text-brand-300 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                >
                  <Copy size={12} />
                </button>
              )}
            </MetaCell>

            <MetaCell label="Consultor resp.">
              {lead.consultantName ? (
                <>
                  <Avatar name={lead.consultantName} size={19} />
                  <span className="truncate">{lead.consultantName}</span>
                </>
              ) : <span className="text-slate-400 dark:text-slate-500 font-normal">Sem responsável</span>}
            </MetaCell>

            <MetaCell label="Professor resp.">
              {lead.appointmentProfessorName ? (
                <>
                  <Avatar name={lead.appointmentProfessorName} size={19} />
                  <span className="truncate">{lead.appointmentProfessorName}</span>
                  {lead.appointmentModality && (
                    <span className="text-slate-400 dark:text-slate-500 font-normal truncate">· {lead.appointmentModality}</span>
                  )}
                </>
              ) : <span className="text-slate-400 dark:text-slate-500 font-normal">—</span>}
            </MetaCell>

            <MetaCell label="Próximo passo">
              {lead.nextFollowUp ? (
                <>
                  <Calendar size={13} className="shrink-0 text-slate-400 dark:text-slate-500" />
                  <span className="text-brand-700 dark:text-brand-300 truncate">
                    {lead.nextFollowUpType || 'Próximo contato'}
                  </span>
                  {/* A data cede espaço antes do rótulo: em coluna estreita ela
                      trunca, mas o compromisso (o que importa) continua legível. */}
                  <span className="num font-normal text-slate-500 dark:text-slate-400 truncate">
                    {/* "seg 03/08" — o pt-BR devolve "seg., 03/08". */}
                    {lead.nextFollowUp.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.,', '').replace(',', '')} · {lead.nextFollowUp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </>
              ) : (
                <>
                  <Calendar size={13} className="shrink-0 text-slate-400 dark:text-slate-500" />
                  <span className="text-slate-400 dark:text-slate-500 font-normal">Sem próximo contato</span>
                </>
              )}
            </MetaCell>
          </div>
        </div>
      </section>

      {/* ===== Abas ===== */}
      <Tabs value={activeProfileTab} onValueChange={setActiveProfileTab}>
        <TabsList variant="line" className="gap-1 border-b border-slate-200 dark:border-white/[0.08] w-full justify-start rounded-none p-0 h-11">
          <TabsTrigger
            value="timeline"
            className="flex-none h-11 px-4 text-[13.5px] font-medium rounded-t-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] data-[state=active]:font-semibold data-[state=active]:bg-transparent data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:[&_svg]:text-brand-600 dark:data-[state=active]:[&_svg]:text-brand-300 after:h-[3px] after:rounded-full after:bg-brand-600"
          >
            <Clock className="size-[15px]" />
            Linha do tempo
            <TabCount n={(interactions || []).length} active={activeProfileTab === 'timeline'} />
          </TabsTrigger>
          <TabsTrigger
            value="crm"
            className="flex-none h-11 px-4 text-[13.5px] font-medium rounded-t-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] data-[state=active]:font-semibold data-[state=active]:bg-transparent data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:[&_svg]:text-brand-600 dark:data-[state=active]:[&_svg]:text-brand-300 after:h-[3px] after:rounded-full after:bg-brand-600"
          >
            <Target className="size-[15px]" />
            CRM
          </TabsTrigger>
          <TabsTrigger
            value="contratos"
            className="flex-none h-11 px-4 text-[13.5px] font-medium rounded-t-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] data-[state=active]:font-semibold data-[state=active]:bg-transparent data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:[&_svg]:text-brand-600 dark:data-[state=active]:[&_svg]:text-brand-300 after:h-[3px] after:rounded-full after:bg-brand-600"
          >
            <FileText className="size-[15px]" />
            Contratos
            <TabCount n={leadContracts.length} active={activeProfileTab === 'contratos'} />
          </TabsTrigger>
          {isClient && (
            <TabsTrigger
              value="referrals"
              className="flex-none h-11 px-4 text-[13.5px] font-medium rounded-t-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] data-[state=active]:font-semibold data-[state=active]:bg-transparent data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:[&_svg]:text-brand-600 dark:data-[state=active]:[&_svg]:text-brand-300 after:h-[3px] after:rounded-full after:bg-brand-600"
            >
              <Handshake className="size-[15px]" />
              Indicações
              <TabCount n={referralsCount ?? 0} active={activeProfileTab === 'referrals'} />
            </TabsTrigger>
          )}
        </TabsList>

        {/* ----- Aba: Linha do tempo ----- */}
        <TabsContent value="timeline" className="pt-2">
         {/* O registro vive dentro de um card branco: a barra de controles fica
             no topo, separada por uma régua que atravessa o card inteiro. */}
         <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          {/* Barra de controles */}
          {(interactions || []).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap px-8 py-3 border-b border-border">
              {TIMELINE_FILTERS.map(f => {
                const active = timelineFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTimelineFilter(f.id)}
                    className={cn(
                      'h-[29px] px-2.5 rounded-lg text-[12px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                      active
                        ? 'bg-[#0E1A40] text-white dark:bg-white dark:text-[#0E1A40]'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    )}
                  >
                    {f.label}
                    <span className="num opacity-65">{timelineCounts[f.id] || 0}</span>
                  </button>
                );
              })}

              <div className="flex-1" />

              {/* Interruptor de Sistema: quando desligado, anuncia o que esconde. */}
              {(systemHiddenCount > 0 || showSystem) && (
                <button
                  type="button"
                  onClick={() => setShowSystem(v => !v)}
                  aria-pressed={showSystem}
                  className={cn(
                    'h-[29px] px-2 rounded-lg text-[12px] font-semibold inline-flex items-center gap-2 whitespace-nowrap border transition',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                    showSystem
                      ? 'border-brand-500/40 text-brand-700 dark:text-brand-300'
                      : 'border-slate-200 dark:border-white/[0.07] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  )}
                >
                  {/* Chave de verdade (trilho + botão), não um ponto. */}
                  <span className={cn(
                    'w-[26px] h-[15px] rounded-full shrink-0 relative transition-colors',
                    showSystem ? 'bg-brand-600' : 'bg-slate-200 dark:bg-white/[0.14]'
                  )}>
                    <span className={cn(
                      'absolute top-[2px] size-[11px] rounded-full bg-white shadow-sm transition-[left]',
                      showSystem ? 'left-[13px]' : 'left-[2px]'
                    )} />
                  </span>
                  <span className="whitespace-nowrap">
                    Sistema{!showSystem && systemHiddenCount > 0 ? ` +${systemHiddenCount}` : ''}
                  </span>
                </button>
              )}

              <div className="relative basis-[220px] shrink min-w-0">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  value={timelineQuery}
                  onChange={e => setTimelineQuery(e.target.value)}
                  placeholder="Buscar no histórico"
                  className="h-[30px] w-full rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[12.5px] pl-8 pr-3 placeholder:text-slate-400 transition"
                />
              </div>
            </div>
          )}

          {/* Timeline */}
          {(interactions || []).length === 0 ? (
            <div className="px-8 py-16 grid place-items-center text-center text-slate-400">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/[0.05] grid place-items-center mb-3">
                <Clock size={20} className="opacity-50" />
              </div>
              <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Sem histórico ainda</p>
              <p className="text-[12.5px] max-w-[280px] mt-0.5">Registre uma nota, mensagem ou ligação na aba CRM para começar a história desta pessoa.</p>
            </div>
          ) : filteredInteractions.length === 0 ? (
            <div className="px-8 py-16 grid place-items-center text-center text-slate-400">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/[0.05] grid place-items-center mb-3">
                <Search size={20} className="opacity-50" />
              </div>
              <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Nenhum evento por aqui</p>
              <p className="text-[12.5px]">Tente ajustar o filtro ou a busca.</p>
            </div>
          ) : (
            <div className="px-8 pt-1 pb-7">
              {groupedEvents.map(([label, events]) => {
                const days = groupTimelineByDay(events);
                // Grupos de um dia só (Hoje, Ontem) não repetem a sub-régua —
                // o cabeçalho da janela já diz qual dia é.
                const showDayRule = days.length > 1;
                return (
                  <section key={label} className="mb-5">
                    <header className="sticky top-0 z-10 flex items-center gap-2 py-2 bg-card/95 backdrop-blur">
                      <span className="text-[11px] font-semibold uppercase tracking-[.07em] text-slate-500 dark:text-slate-400 whitespace-nowrap">{label}</span>
                      <div className="flex-1 h-px bg-slate-200/80 dark:bg-white/[0.06]" />
                      <span className="text-[11px] num text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {events.length} {events.length === 1 ? 'evento' : 'eventos'}
                      </span>
                    </header>

                    {days.map(([dayKey, date, dayEvents]) => (
                      <div key={dayKey}>
                        {showDayRule && (
                          <div className="flex items-center gap-2 pl-[38px] py-1.5">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap num">
                              {(() => {
                                // "Qui 23/07" — o pt-BR devolve "qui." minúsculo.
                                const wd = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
                                return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}`;
                              })()} {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                            </span>
                            <div className="flex-1 h-px bg-slate-100 dark:bg-white/[0.04]" />
                            <span className="text-[11px] num text-slate-400 dark:text-slate-500">{dayEvents.length}</span>
                          </div>
                        )}
                        {dayEvents.map(renderTimelineEvent)}
                      </div>
                    ))}
                  </section>
                );
              })}

              {/* Marco de origem: fecha o registro com a data de cadastro. */}
              {timelineFilter === 'all' && !timelineQuery && (
                <p className="pl-[38px] pt-1 text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                  Início da jornada · {lead.createdAt?.toLocaleDateString('pt-BR') || '—'}
                </p>
              )}
            </div>
          )}
         </section>
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
          <div className="space-y-4">
            {!hasCurrentContract ? (
              /* Lead/cliente sem contrato vigente → matrícula. */
              <section className="rounded-2xl border border-dashed border-slate-300 dark:border-white/[0.1] bg-card p-8 text-center">
                <div className="size-[46px] rounded-[14px] grid place-items-center mx-auto mb-3 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"><FileText size={20} /></div>
                <h3 className="font-display text-[16px] font-bold tracking-tight">Ainda não é cliente</h3>
                <p className="text-[12.5px] leading-[1.5] text-slate-500 dark:text-slate-400 mt-1.5 max-w-[300px] mx-auto text-pretty">
                  Quando {firstName} fechar, registre plano, valor e vigência — a renovação passa a ser acompanhada por aqui.
                </p>
                {!isReadOnly && (
                  <div className="mt-4 flex items-center justify-center">
                    <Btn kind="enroll" icon={<UserPlus size={15} />} onClick={handleWin} disabled={loading}>Matricular agora</Btn>
                  </div>
                )}
              </section>
            ) : curClosed ? (
              /* Vencido ou cancelado: o card encolhe e a ação vira nova matrícula. */
              (() => {
                const cancelled = curStatus === CONTRACT_STATUS.CANCELADO;
                const tone = CONTRACT_TONE[curStatus];
                const cancelledAt = getSafeDateOrNull(currentContract?.cancelledAt);
                const pct = vigencia ? vigencia.elapsedPct : 100;
                return (
                  <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
                    <div className="flex items-start gap-3.5 px-5 pt-[18px] pb-4">
                      <span className={cn('size-[38px] flex-none rounded-xl grid place-items-center', tone.block, tone.fg)}>
                        {cancelled ? <Ban size={17} /> : <FileText size={17} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display text-[17px] font-bold tracking-tight">{lead.currentPlanName || 'Plano'}</h3>
                          <span className={cn('inline-flex items-center h-5 px-[7px] rounded-md text-[9.5px] font-bold uppercase tracking-[.05em]', tone.block, tone.fg)}>
                            {CONTRACT_STATUS_LABEL[curStatus]}
                          </span>
                        </div>
                        <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-1">
                          {cancelled
                            ? `Cancelado${cancelledAt ? ` em ${cancelledAt.toLocaleDateString('pt-BR')}` : ''}${currentContract?.cancelReason ? ` · ${currentContract.cancelReason}` : ''}`
                            : `Venceu há ${Math.abs(vigencia?.daysLeft ?? 0)} dias · ${curEndsAt.toLocaleDateString('pt-BR')}`}
                        </div>
                      </div>
                      <span className={cn('num flex-none font-display text-[19px] font-bold text-slate-500 dark:text-slate-400', cancelled && 'line-through')}>
                        {lead.currentContractValue != null ? fmtBRL(lead.currentContractValue) : '—'}
                      </span>
                    </div>
                    <div className="flex h-1 bg-slate-100 dark:bg-white/[0.06]">
                      <span className={cn('h-full', cancelled ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600')} style={{ width: `${pct}%` }}></span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap px-5 py-3 bg-slate-50 dark:bg-white/[0.03]">
                      {!isReadOnly && <Btn kind="enroll" icon={<UserPlus size={14} />} onClick={handleWin} disabled={loading}>Nova matrícula</Btn>}
                      <span className="text-[11.5px] text-slate-500 dark:text-slate-400">
                        {cancelled ? `Interrompido a ${pct}% da vigência.` : 'O cliente conta como inativo até renovar.'}
                      </span>
                    </div>
                  </section>
                );
              })()
            ) : (
              /* Contrato vivo: quem abre esta aba quer saber quantos dias faltam. */
              (() => {
                const tone = CONTRACT_TONE[curStatus] || CONTRACT_TONE[CONTRACT_STATUS.ATIVO];
                const daysLeft = Math.max(0, vigencia?.daysLeft ?? 0);
                // Contrato agendado: a contagem é até COMEÇAR, não até vencer —
                // e os marcos de renovação ainda não têm o que dizer.
                const scheduled = curStatus === CONTRACT_STATUS.AGENDADO;
                const paused = curPaused;
                const daysToStart = scheduled && curStartsAt
                  ? Math.max(0, Math.ceil((curStartsAt.getTime() - Date.now()) / 86400000))
                  : 0;
                const pausedDays = paused && curPausedAt
                  ? Math.max(0, Math.ceil((Date.now() - curPausedAt.getTime()) / 86400000))
                  : 0;
                const missed = scheduled || paused ? null : missedCheckpointsLabel(vigencia?.missedCount);
                // Desconto do contrato. Contrato antigo não tem discountValue:
                // aí a diferença para a tabela é o que sobrou de registro.
                const listValue = Number(currentContract?.listValue) || 0;
                const discount = Number(currentContract?.discountValue)
                  || Math.max(listValue - (Number(lead.currentContractValue) || 0), 0);
                const discountReason = currentContract?.discountReason || null;
                const closedBy = currentContract?.consultantName || lead.consultantName;
                const closedAt = getSafeDateOrNull(currentContract?.createdAt);
                const months = Number(currentContract?.durationMonths) || 0;
                const value = lead.currentContractValue;
                return (
                  <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
                    <div className="flex items-stretch flex-wrap">
                      {/* A contagem é o que importa */}
                      <div className={cn('w-[186px] flex-none px-[22px] py-5', tone.block)}>
                        <div className={cn('text-[9.5px] font-bold uppercase tracking-[.08em]', tone.fg)}>
                          {scheduled ? 'Começa em' : paused ? 'Trancado há' : 'Restam'}
                        </div>
                        <div className="flex items-baseline gap-1.5 mt-1.5">
                          <span className={cn('num font-display text-[40px] font-bold leading-none tracking-[-.03em]', tone.fg)}>
                            {scheduled ? daysToStart : paused ? pausedDays : daysLeft}
                          </span>
                          <span className={cn('text-[13px] font-semibold', tone.fg)}>
                            {(scheduled ? daysToStart : paused ? pausedDays : daysLeft) === 1 ? 'dia' : 'dias'}
                          </span>
                        </div>
                        <div className="num text-[11.5px] text-slate-600 dark:text-slate-300 mt-[7px]">
                          {scheduled
                            ? `início ${curStartsAt ? curStartsAt.toLocaleDateString('pt-BR') : '—'}`
                            : paused
                              ? `desde ${curPausedAt ? curPausedAt.toLocaleDateString('pt-BR') : '—'}`
                              : `vence ${curEndsAt.toLocaleDateString('pt-BR')}`}
                        </div>
                      </div>

                      {/* Quatro células divididas por régua */}
                      <div className="flex-1 min-w-0 flex items-stretch flex-wrap">
                        <div className="flex-[1.2] min-w-[160px] px-[22px] py-5">
                          <CapsLabel>Plano</CapsLabel>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="font-display text-[18px] font-bold tracking-tight">{lead.currentPlanName || 'Plano'}</span>
                            <span className={cn('inline-flex items-center h-[19px] px-[7px] rounded-[5px] text-[9.5px] font-bold uppercase tracking-[.05em]', tone.block, tone.fg)}>
                              {CONTRACT_STATUS_LABEL[curStatus]}
                            </span>
                          </div>
                          <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-[5px]">
                            #{String(lead.currentContractId).slice(0, 8).toUpperCase()}{months ? ` · ${months === 1 ? '1 mês' : `${months} meses`}` : ''}
                          </div>
                        </div>

                        <div className="flex-1 min-w-[130px] px-[22px] py-5 border-l border-slate-100 dark:border-white/[0.06]">
                          <CapsLabel>Valor</CapsLabel>
                          <div className="num font-display text-[18px] font-bold tracking-tight mt-1.5">{value != null ? fmtBRL(value) : '—'}</div>
                          <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-[5px]">
                            {value != null && months > 0 ? `${fmtBRL(Number(value) / months)}/mês` : '—'}
                          </div>
                          {/* Só o desconto e o motivo: a célula não comporta o
                              valor de tabela junto sem truncar. Ele fica no title. */}
                          {discount > 0.005 && listValue > 0 && (
                            <div
                              className="text-[11.5px] text-emerald-700 dark:text-emerald-400 mt-[3px] truncate"
                              title={`Tabela ${fmtBRL(listValue)} · desconto de ${fmtBRL(discount)}`}
                            >
                              <span className="num">−{fmtBRL(discount)}</span>
                              {discountReason ? ` · ${discountReason.toLowerCase()}` : ' de desconto'}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-[130px] px-[22px] py-5 border-l border-slate-100 dark:border-white/[0.06]">
                          <CapsLabel>Renovado de</CapsLabel>
                          {renewalOrdinal > 0 ? (
                            <>
                              <div className="text-[13px] font-semibold mt-[7px] truncate">{renewedFrom?.planName || pastContracts[0]?.planName || '—'}</div>
                              <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-[3px]">
                                {renewedFrom ? `#${String(renewedFrom.id).slice(0, 4).toUpperCase()} · ` : ''}{renewalOrdinal}ª renovação
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-[13px] font-semibold mt-[7px]">Matrícula inicial</div>
                              <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-[3px]">primeiro contrato</div>
                            </>
                          )}
                        </div>

                        <div className="flex-1 min-w-[140px] px-[22px] py-5 border-l border-slate-100 dark:border-white/[0.06]">
                          <CapsLabel>Fechado por</CapsLabel>
                          <div className="flex items-center gap-[7px] mt-[7px] min-w-0">
                            {closedBy ? (
                              <>
                                <Avatar name={closedBy} size={19} />
                                <span className="text-[13px] font-semibold truncate">{closedBy}</span>
                              </>
                            ) : <span className="text-[13px] text-slate-400 dark:text-slate-500">—</span>}
                          </div>
                          {closedAt && <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-[3px]">em {closedAt.toLocaleDateString('pt-BR')}</div>}
                        </div>
                      </div>

                      {/* Ações */}
                      {!isReadOnly && (
                        <div className="flex-none flex flex-col justify-center gap-2 px-[22px] py-[18px] border-l border-slate-100 dark:border-white/[0.06]">
                          {paused ? (
                            <Btn kind="success" icon={<PlayCircle size={14} />} onClick={() => openContractAction('reativar')} disabled={loading}>Reativar contrato</Btn>
                          ) : (
                            <Btn kind="brand" icon={<RefreshCw size={14} />} onClick={handleRenew} disabled={loading}>Renovar contrato</Btn>
                          )}
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => { if (!isReadOnly) setEditingContract(true); }}
                              disabled={loading}
                              className="flex-1 h-8 px-2 rounded-[9px] text-[12px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] whitespace-nowrap transition disabled:opacity-50"
                            >
                              Corrigir
                            </button>
                            {!paused && (
                              <>
                                <span className="w-px h-[18px] flex-none bg-slate-100 dark:bg-white/[0.06]"></span>
                                <button
                                  type="button"
                                  onClick={() => openContractAction('trancar')}
                                  disabled={loading}
                                  className="flex-1 h-8 px-2 rounded-[9px] text-[12px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] whitespace-nowrap transition disabled:opacity-50"
                                >
                                  Trancar
                                </button>
                              </>
                            )}
                            <span className="w-px h-[18px] flex-none bg-slate-100 dark:bg-white/[0.06]"></span>
                            <button
                              type="button"
                              onClick={() => openContractAction('cancelar')}
                              disabled={loading}
                              className="flex-1 h-8 px-2 rounded-[9px] text-[12px] font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-300 dark:hover:bg-rose-500/10 whitespace-nowrap transition disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Faixa de vigência: os marcos de renovação na posição real */}
                    <div className="flex items-center gap-2.5 flex-wrap px-[22px] py-[11px] border-t border-slate-100 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03]">
                      <span className="num text-[11.5px] text-slate-500 dark:text-slate-400 flex-none">
                        {curStartsAt ? curStartsAt.toLocaleDateString('pt-BR') : '—'}
                      </span>
                      <div className="relative flex-1 min-w-[80px] h-4">
                        <span className="absolute left-0 right-0 top-1.5 h-1 rounded-full bg-slate-200/80 dark:bg-white/[0.08]"></span>
                        <span className={cn('absolute left-0 top-1.5 h-1 rounded-full', tone.fill)} style={{ width: `${vigencia?.elapsedPct ?? 0}%` }}></span>
                        {(vigencia?.marks || []).map(m => (
                          <span
                            key={m.days}
                            title={`Marco de ${m.days} dias · ${m.date ? m.date.toLocaleDateString('pt-BR') : ''}${m.handled ? ' · contato feito' : m.passed ? ' · passou sem contato' : ''}`}
                            className={cn(
                              'absolute top-0.5 w-0.5 h-3 -translate-x-1/2 rounded-[1px]',
                              m.active ? 'bg-amber-500' : 'bg-slate-300 dark:bg-white/25'
                            )}
                            style={{ left: `${m.pos}%` }}
                          ></span>
                        ))}
                        {/* O marcador de hoje só existe dentro da vigência. */}
                        {!scheduled && (
                          <span
                            className="absolute top-0 w-[3px] h-4 -translate-x-1/2 rounded-sm bg-slate-900 dark:bg-white"
                            style={{ left: `${vigencia?.elapsedPct ?? 0}%` }}
                          ></span>
                        )}
                      </div>
                      <span className={cn('num text-[11.5px] font-semibold flex-none', tone.fg)}>{curEndsAt.toLocaleDateString('pt-BR')}</span>
                      {scheduled && (
                        <>
                          <span className="w-px h-4 flex-none bg-slate-200 dark:bg-white/[0.08]"></span>
                          <span className={cn('text-[11.5px] font-semibold flex-none', tone.fg)}>A vigência ainda não começou</span>
                        </>
                      )}
                      {paused && (
                        <>
                          <span className="w-px h-4 flex-none bg-slate-200 dark:bg-white/[0.08]"></span>
                          <span className={cn('text-[11.5px] font-semibold flex-none', tone.fg)}>
                            Vigência congelada · restam {Math.max(0, vigencia?.daysLeft ?? 0)} dias quando voltar
                          </span>
                        </>
                      )}
                      {missed && (
                        <>
                          <span className="w-px h-4 flex-none bg-slate-200 dark:bg-white/[0.08]"></span>
                          <span className="text-[11.5px] text-slate-500 dark:text-slate-400 flex-none">{missed}</span>
                        </>
                      )}
                    </div>
                  </section>
                );
              })()
            )}

            {/* A corrente de renovações — só os anteriores; o vigente tem card próprio. */}
            <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
              <div className="flex items-center gap-2.5 px-[22px] py-4 border-b border-slate-100 dark:border-white/[0.06]">
                <h3 className="text-[14.5px] font-semibold tracking-tight">Histórico</h3>
                <span className="num text-[10.5px] font-bold px-[7px] py-0.5 rounded-md bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                  {pastContracts.length === 1 ? '1 anterior' : `${pastContracts.length} anteriores`}
                </span>
                <div className="flex-1"></div>
                <span className="text-[11.5px] text-slate-500 dark:text-slate-400 hidden sm:inline">Do contrato anterior à matrícula</span>
              </div>

              <div className="px-[22px] pt-2 pb-5">
                {pastContracts.length === 0 ? (
                  <div className="py-7 text-center">
                    <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">Nenhum contrato anterior</p>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {hasCurrentContract ? `Este é o primeiro contrato de ${firstName}.` : 'O histórico de planos aparecerá aqui.'}
                    </p>
                  </div>
                ) : pastContracts.map((c, i) => {
                  const hStatus = deriveContractStatus(c, new Date(), contractThresholdDays) || CONTRACT_STATUS.VENCIDO;
                  const hTone = CONTRACT_TONE[hStatus] || CONTRACT_TONE[CONTRACT_STATUS.VENCIDO];
                  const hStart = getSafeDateOrNull(c.startsAt);
                  const hEnd = getSafeDateOrNull(c.endsAt);
                  const hMonths = Number(c.durationMonths)
                    || (hStart && hEnd ? Math.max(1, Math.round(daysBetween(hStart, hEnd) / 30.44)) : 0);
                  // A lacuna aparece ACIMA do nó: o intervalo entre o fim deste
                  // contrato e o início do próximo (mais novo) — inclusive o vigente.
                  const newer = i === 0 ? currentContract : pastContracts[i - 1];
                  const rawGap = hEnd && newer ? daysBetween(hEnd, getSafeDateOrNull(newer.startsAt)) : null;
                  const gapDays = rawGap != null && rawGap > 1 ? rawGap - 1 : 0;
                  const isFirstEver = i === pastContracts.length - 1;
                  return (
                    <div key={c.id}>
                      {gapDays > 0 && (
                        <div className="flex items-center gap-2.5 py-2 pl-[15px]">
                          <span className="h-[26px] flex-none border-l-2 border-dashed border-slate-300 dark:border-white/20"></span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 pl-2">{gapLabel(gapDays)}</span>
                        </div>
                      )}

                      <div className="relative flex items-center gap-3.5 py-3 pr-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.03] transition">
                        {!isFirstEver && <span className="absolute left-[15px] top-0 -bottom-px w-0.5 bg-slate-100 dark:bg-white/[0.06]"></span>}
                        <span className={cn(
                          'relative z-[1] size-8 flex-none rounded-full grid place-items-center ring-4 ring-white dark:ring-[#0e1326]',
                          hTone.block, hTone.fg
                        )}>
                          {isFirstEver ? <GraduationCap size={14} /> : <RefreshCw size={14} />}
                        </span>

                        <div className="min-w-0 flex-[1.4]">
                          <div className="text-[13.5px] font-semibold truncate">{c.planName || '—'}</div>
                          <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {hStart ? hStart.toLocaleDateString('pt-BR') : '—'} → {hEnd ? hEnd.toLocaleDateString('pt-BR') : '—'}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 hidden sm:block">
                          <div className="num text-[11px] text-slate-500 dark:text-slate-400">
                            {hMonths === 1 ? '1 mês' : `${hMonths} meses`}
                          </div>
                          <div className="h-[5px] rounded-full bg-slate-100 dark:bg-white/[0.06] mt-[5px] overflow-hidden max-w-[150px]">
                            <div
                              className={cn('h-full rounded-full', hStatus === CONTRACT_STATUS.CANCELADO ? 'bg-rose-400' : 'bg-slate-300 dark:bg-slate-600')}
                              style={{ width: `${Math.min(100, Math.round((hMonths / 12) * 100))}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="num w-[92px] flex-none text-right text-[13.5px] font-semibold">{c.value != null ? fmtBRL(c.value) : '—'}</div>

                        <span className="w-[88px] flex-none flex justify-end">
                          <span className={cn('inline-flex items-center h-5 px-2 rounded-md text-[10px] font-bold uppercase tracking-[.05em] whitespace-nowrap', hTone.block, hTone.fg)}>
                            {CONTRACT_STATUS_LABEL[hStatus]}
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </TabsContent>

        {/* ----- Aba: Indicações (só cliente) ----- */}
        {isClient && (
          <TabsContent value="referrals" className="pt-2">
            <ReferralsSection items={referralItems} loading={referralsLoading} />
          </TabsContent>
        )}

      </Tabs>

      {/* Overlays */}
      <ClientRegistrationModal
        open={isEditing}
        onClose={() => setIsEditing(false)}
        lead={lead}
        appUser={appUser}
        db={db}
        usersList={usersList}
        tags={tags}
      />
      {lossModalOpen && <LossReasonModal lossReasons={lossReasons} onClose={() => setLossModalOpen(false)} onConfirm={confirmLoss} />}
      {referrerDialogOpen && (
        <Dialog open onOpenChange={(o) => { if (!o) setReferrerDialogOpen(false); }}>
          <DialogContent className="max-w-[440px] rounded-2xl p-5 gap-0">
            <DialogTitle className="text-[16px] font-bold tracking-tight">
              {lead.referredById ? 'Editar vínculo de indicação' : 'Vincular indicador'}
            </DialogTitle>
            <DialogDescription className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-1">
              {lead.referredByName
                ? <>Hoje: indicado por <strong className="text-slate-700 dark:text-slate-200">{lead.referredByName}</strong>. Escolha outro cliente para trocar.</>
                : 'Escolha o cliente que indicou esta pessoa.'}
            </DialogDescription>
            <div className="mt-4">
              <ReferrerPicker db={db} value={referrerPick} onSelect={setReferrerPick} excludeId={lead.id} autoFocus />
            </div>
            <div className="mt-5 flex items-center gap-2">
              {lead.referredById && (
                <Btn kind="danger" size="sm" disabled={loading} onClick={handleRemoveReferral}>Remover vínculo</Btn>
              )}
              <div className="flex-1"></div>
              <Btn kind="soft" size="sm" onClick={() => setReferrerDialogOpen(false)}>Cancelar</Btn>
              <Btn kind="success" size="sm" icon={<Handshake size={13} />} disabled={!referrerPick || loading} onClick={handleSaveReferral}>
                Salvar vínculo
              </Btn>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {contractAction && (
        <ContractOutcomeModal
          lead={lead}
          appUser={appUser}
          db={db}
          contract={currentContract}
          action={contractAction}
          onClose={() => setContractAction(null)}
          onDone={() => setContractAction(null)}
        />
      )}
      {editingContract && (
        <ContractEditModal
          lead={lead}
          appUser={appUser}
          db={db}
          contract={currentContract}
          onClose={() => setEditingContract(false)}
          onDone={() => setEditingContract(false)}
        />
      )}
      {matriculaOpen && (
        <ContractModal
          lead={lead}
          appUser={appUser}
          db={db}
          mode={matriculaMode}
          currentContract={currentContract}
          renewedFromId={matriculaMode === 'renovacao' ? lead.currentContractId : null}
          onClose={() => setMatriculaOpen(false)}
          onDone={() => { setMatriculaOpen(false); if (matriculaMode === 'matricula') setStatus('Venda'); }}
        />
      )}
    </div>
  );
}

export { LeadProfileView };
