import { useState, useMemo } from 'react';
import { collection, doc, deleteDoc, getDocs, updateDoc, writeBatch, query, where, serverTimestamp } from 'firebase/firestore';
import { appId, LEADS_PATH, INTERACTIONS_PATH, CONTRACTS_PATH, storage } from '../lib/firebase.js';
import { uploadLeadPhoto, deleteLeadPhoto } from '../lib/leadPhoto.js';
import { logInteraction } from '../lib/interactions.js';
import { useLeadTimeline } from '../hooks/useLeadTimeline.js';
import { useReferrals } from '../hooks/useReferrals.js';
import { withBucket } from '../lib/leadDerived.js';
import { planStageMove, planLoss, planUpgradeMove, planUpgradeDecline, stageMoveBlockMessage, withStageEntered } from '../lib/stageMove.js';
import { canEditLead, isLeadConverted, ZAP_VIA } from '../lib/leads.js';
import { ACTIONS, can, isGestor, isSeller } from '../lib/acesso.js';
import { normalizeAppointmentType, getSafeDateOrNull } from '../lib/dates.js';
// firstName vira contactFirstName: o arquivo já tem um firstName local, do próprio lead.
import { contactLabel, contactOf, firstName as contactFirstName, hasPhone, isMinorNow, telHref, whatsappHref } from '../lib/guardian.js';
import { fmtBRL } from '../lib/format.js';
import { hasLiveContract } from '../lib/contracts.js';
import { isSystemFunnel } from '../lib/funnels.js';
import { planProfileNote } from '../lib/profileNote.js';
import { getReferralFunnel, getReferralEntryStage, buildReferralShareLink, buildReferralWhatsAppText, isReferralFunnel } from '../lib/referrals.js';
import { getUpgradeFunnel, upgradeStageIdOf } from '../lib/upgradeFunnel.js';
import { commitReferralLink, removeReferralLink } from '../lib/referralsWrites.js';
import { deriveLeadState, getTone, phaseToneName } from '../lib/leadState.js';
import { professorNameById } from '../lib/professores.js';
import { recordNewAppointment, markConvertingAula } from '../lib/aulasWrites.js';
import { buildSchedulePatch, appointmentTaskOwnerFor, taskOwnerText } from '../lib/schedulePatch.js';
import { cn } from '../lib/utils.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { LeadLink } from '../components/nav/AppLink.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Btn, IconBtn } from '../components/ui/Btn.jsx';
import { StatusBadge, TagBadge } from '../components/ui/Badges.jsx';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs.jsx';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../components/ui/dropdown-menu.jsx';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog.jsx';
import { RingAvatar } from '../components/profile/RingAvatar.jsx';
import { PhotoCaptureMenu } from '../components/profile/PhotoCaptureMenu.jsx';
import { PhaseChanger } from '../components/profile/PhaseChanger.jsx';
import { ReferralsSection } from '../components/profile/ReferralsSection.jsx';
import { ReferrerPicker } from '../components/profile/ReferrerPicker.jsx';
import { ScheduleWizard } from '../components/profile/ScheduleWizard.jsx';
import { ZapSignupMarker } from '../components/profile/ZapSignupMarker.jsx';
import { ContractsTab } from '../components/profile/contracts/ContractsTab.jsx';
import { TimelineAuthor } from '../components/profile/TimelineAuthor.jsx';
import { StronizapBadge } from '../components/brand/StronizapMark.jsx';
import { LossReasonModal } from '../modals/LossReasonModal.jsx';
import { ContractModal } from '../modals/ContractModal.jsx';
import { ContractOutcomeModal } from '../modals/ContractOutcomeModal.jsx';
import { ContractEditModal } from '../modals/ContractEditModal.jsx';
import { ContractActivateModal } from '../modals/ContractActivateModal.jsx';
import { ClientRegistrationModal } from '../modals/ClientRegistrationModal.jsx';
import { QuickReferralModal } from '../modals/QuickReferralModal.jsx';
import {
  groupTimeline,
  timelineStamp,
  classifyInteraction,
  contractEventOf,
  parseAppointment,
  extractStageNameFromInteractionText,
  isOwnerChangeText,
  ownerChangeText,
  buildStageTransitions,
  matchesTimelineFilter,
  timelineTypeLabel,
  TIMELINE_FILTERS,
  TIMELINE_SYSTEM_KIND,
  originLastOnTies,
  zapScheduleTitle,
  appointmentOriginText,
  isAppointmentReschedule
} from '../lib/timeline.js';
import { ArrowLeft, ArrowRight, Ban, BookOpen, Building2, Calendar, Check, CheckCircle, Clock, Copy, CreditCard, FileText, GraduationCap, Handshake, MessageCircle, Pencil, Phone, Plus, RefreshCw, Search, Tag, Target, ThumbsDown, Trash, TrendingUp, User, UserPlus, Users } from 'lucide-react';

// Eventos de contrato que ganham faixa de destaque na linha do tempo: os que
// mudam a situação do cliente. Trancamento, reativação e correção seguem como
// linha comum do tipo "Contrato".
const CONTRACT_MILESTONE_KINDS = new Set(['matricula', 'renovacao', 'cancelamento']);

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

// onBack é o Voltar da rota (voltar do navegador, ou a lista quando a ficha
// abriu direto numa aba nova). onDeleteStart e onDeleteFailed avisam a rota
// para trocar a ficha por "Excluindo a ficha…" e devolver se a exclusão falhar.
// listenersActive é o portão de ociosidade do App, repassado à linha do tempo.
function LeadProfileView({ lead, tab, onTab, onBack, onDeleteStart, onDeleteFailed, listenersActive = true, appUser, statuses, tags, lossReasons, usersList, db, funnels }) {
  // Timeline por query própria (G2): histórico COMPLETO do lead (índice #10),
  // ao vivo. Antes vinha do prop global filtrado por leadId — que pós-G2 é só o
  // mês corrente. A ficha remonta por lead (key), então o hook não reseta.
  const interactions = useLeadTimeline({ db, leadId: lead?.id, active: listenersActive });
  const toast = useToast();
  const isReadOnly = !canEditLead(appUser);
  // Linha do tempo COLABORATIVA: qualquer consultor do tenant pode escrever
  // notas/interações e agendar na timeline de QUALQUER lead (base compartilhada,
  // PR #101) — mesmo não sendo o responsável. Edição do cadastro, Venda/Perda,
  // contrato e reatribuição de responsável: além do isReadOnly, que barra quem
  // está sem vínculo de authUid (ver canEditLead), cada ação pergunta à lista de
  // permissões (can, de src/lib/acesso.js). A exclusão é a única coisa que
  // continua no gestor (isGestor).
  const canTimeline = Boolean(appUser?.authUid);
  // O que o papel libera na ficha, pela lista única de src/lib/acesso.js. O
  // professor registra Anotação, WhatsApp, Ligação e Agendar e vê Contratos e
  // Indicações sem botão. O isReadOnly continua valendo para quem está sem
  // authUid, do jeito de antes.
  const canEditCadastro = !isReadOnly && can(appUser, ACTIONS.CADASTRO_EDITAR);
  const canMudarFase = can(appUser, ACTIONS.FICHA_MUDAR_FASE);
  const canContrato = can(appUser, ACTIONS.CONTRATO_EDITAR);
  const canIndicar = can(appUser, ACTIONS.INDICACAO_CADASTRAR);
  // Última trava dos handlers. O botão já some, mas a ação não pode passar
  // por outro caminho.
  const negarAcesso = () => toast.warning('Essa ação não está liberada para o seu acesso.');
  const safeFunnels = Array.isArray(funnels) ? funnels : [];

  // Só estado de interface. Nada aqui copia campo do lead: ele chega ao vivo
  // (useProfileLead) e muda com a ficha aberta quando outra pessoa mexe nele,
  // então fase e funil são lidos direto do `lead`.
  const [isEditing, setIsEditing] = useState(false);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const [lossModalOpen, setLossModalOpen] = useState(false);
  const [matriculaOpen, setMatriculaOpen] = useState(false);
  // 'matricula' (nova/retroativa) | 'renovacao' — controla o modo do ContractModal.
  const [matriculaMode, setMatriculaMode] = useState('matricula');
  // Desfecho de um contrato da aba: { action: 'cancelar' | 'trancar' |
  // 'reativar', contractId }. Com renovação marcada, o contrato pode ser o em
  // uso, e não o último.
  const [contractAction, setContractAction] = useState(null);
  // O contrato a corrigir e o contrato a ativar agora, pelo id: o documento
  // vem vivo da coleção assinada (contractById), como antes.
  const [editingContractId, setEditingContractId] = useState(null);
  const [activatingId, setActivatingId] = useState(null);
  // Threshold de vencimento do contexto (sem prop-drilling) p/ a seção Contrato.
  const { contractThresholdDays, contratos, professores, renewalCheckpoints } = useGeneralConfig();

  // Composer tab — drives which form is shown in the activity Composer card.
  const [composerTab, setComposerTab] = useState('note');

  // Foto do cliente: menu (galeria/câmera) + gravação. No perfil não há botão
  // Salvar — escolheu/capturou, sobe pro Storage e grava na hora.
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const handlePhotoPicked = async (blob) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (!canEditCadastro) { negarAcesso(); return; }
    setPhotoBusy(true);
    try {
      const { url, path } = await uploadLeadPhoto(storage, appId, lead.id, blob);
      await updateDoc(
        doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
        { photoUrl: url, photoPath: path, photoUpdatedAt: serverTimestamp() }
      );
      toast.success('Foto atualizada.');
    } catch (e) {
      console.error('Erro ao salvar a foto:', e);
      toast.error(
        e?.code === 'storage/unauthorized'
          ? 'Sem permissão no Storage. Publique as regras no console do Firebase.'
          : 'Não foi possível salvar a foto. Tente novamente.'
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const handlePhotoRemove = async () => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (!canEditCadastro) { negarAcesso(); return; }
    setPhotoBusy(true);
    try {
      await updateDoc(
        doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
        { photoUrl: null, photoPath: null, photoUpdatedAt: serverTimestamp() }
      );
      // Best-effort: o doc já não aponta mais pro objeto.
      if (lead.photoPath) deleteLeadPhoto(storage, lead.photoPath).catch(() => {});
      toast.success('Foto removida.');
    } catch (e) {
      console.error('Erro ao remover a foto:', e);
      toast.error('Não foi possível remover a foto.');
    } finally {
      setPhotoBusy(false);
    }
  };

  // Vínculo de indicação: dialog de vincular/editar/remover + escolha do picker.
  const [referrerDialogOpen, setReferrerDialogOpen] = useState(false);
  const [referrerPick, setReferrerPick] = useState(null);

  // Timeline filter + search
  const [timelineFilter, setTimelineFilter] = useState('all');
  // Eventos de sistema (Meta Diária, etiquetas, "lead criado") entram só sob
  // demanda: não têm o mesmo peso de uma conversa.
  const [showSystem, setShowSystem] = useState(false);
  const [timelineQuery, setTimelineQuery] = useState('');

  // Quem o consultor chama: o responsável, quando o lead é menor.
  const contact = contactOf(lead);

  const handleWhatsApp = () => {
    const href = whatsappHref(contact.phone, `Olá ${contactFirstName(contact.name)}`);
    if (!href) { toast.warning('Lead sem WhatsApp cadastrado.'); return; }
    window.open(href);
  };


  const handleDelete = async () => {
    if (!isGestor(appUser)) { negarAcesso(); return; }
    if (!window.confirm("Excluir este lead permanentemente? Não dá pra desfazer.")) return;
    // A rota troca a ficha por "Excluindo a ficha…" até terminar. Sem isso, o
    // aviso de doc apagado chega antes do fim e a tela piscaria "excluída".
    onDeleteStart?.();
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
      onDeleteFailed?.();
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
    if (!canContrato) { negarAcesso(); return; }
    setMatriculaMode('matricula');
    setMatriculaOpen(true);
  };

  // Renovação: abre o MESMO modal em modo renovação (não re-carimba
  // convertedAt/status — ver lib/contracts.js), apontando ao contrato vigente.
  const handleRenew = () => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (!canContrato) { negarAcesso(); return; }
    setMatriculaMode('renovacao');
    setMatriculaOpen(true);
  };

  // Cancelar, trancar e reativar passam pelo ContractOutcomeModal: os três
  // pedem data e os dois primeiros pedem motivo. Recebem o CONTRATO em que
  // agem: com renovação marcada, o card da aba é o contrato em uso.
  const openContractAction = (action, contract) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (!canContrato) { negarAcesso(); return; }
    if (!contract?.id) { toast.warning('Não há contrato vigente.'); return; }
    setContractAction({ action, contractId: contract.id });
  };

  // Corrigir (ContractEditModal) e Ativar agora (ContractActivateModal) de um
  // contrato da aba. A trava de leitura fica aqui, como nas outras ações.
  const openContractEdit = (contract) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (!canContrato) { negarAcesso(); return; }
    if (contract?.id) setEditingContractId(contract.id);
  };
  const openActivate = (contract) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (!canContrato) { negarAcesso(); return; }
    if (contract?.id) setActivatingId(contract.id);
  };
  // O documento de um contrato da aba, vivo. Sem reserva: cair no último
  // contrato (currentContract) para outro id faria o modal agir no contrato
  // errado, e para o próprio último o find já o devolve.
  const contractById = (id) => leadContracts.find((c) => c.id === id) || null;

  const confirmLoss = async (reason) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (!canMudarFase) { negarAcesso(); setLossModalOpen(false); return; }
    // Cliente não vira lead perdido (src/lib/stageMove.js). O botão e o
    // PhaseChanger já barram antes; aqui é a última trava.
    const loss = planLoss(lead);
    if (!loss.ok) { toast.warning(stageMoveBlockMessage(lead, loss.reason)); setLossModalOpen(false); return; }
    // Cliente no funil Upgrade: a Perda é "não quis o upgrade". Sai do funil
    // com o motivo e segue cliente — nada de status Perda.
    if (loss.kind === 'upgrade') {
      setLoading(true);
      try {
        const plan = planUpgradeDecline(lead, reason);
        await logInteraction(db, lead, appUser,
          { text: plan.interactionText, type: 'status_change' },
          { ...plan.patch, upgradeDeclinedAt: serverTimestamp() }
        );
        setLossModalOpen(false);
        setComposerTab('note');
      } catch (e) {
        console.error(e);
        toast.error('Não foi possível registrar a recusa.');
      } finally {
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      await logInteraction(db, lead, appUser,
        { text: `Lead perdido. Motivo: ${reason}`, type: 'status_change', ...loss.stageChange },
        withStageEntered(
          withBucket({
            status: 'Perda',
            lossReason: reason,
            nextFollowUp: null,
            lostAt: serverTimestamp(),
            // Limpa resquício caso o lead viesse de Venda.
            isConverted: false,
            convertedAt: null
          }, lead),
          loss.stageChange,
          serverTimestamp()
        )
      );
      // #8: Perda é CHURN, então NÃO desfaz a conversão histórica da aula. A
      // matrícula aconteceu; o churn é medido pela taxa de renovação, não
      // reescrevendo a conversão passada do professor. (Sair de Venda p/ fase de
      // lead ainda desfaz, ver handlePhaseConfirm/saveInteraction: venda por engano.)
      setLossModalOpen(false);
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
    if (!canMudarFase) { negarAcesso(); return; }
    if (targetStatus === 'Venda') {
      // Venda abre o contrato, então pede também a ação de contrato.
      if (!canContrato) { negarAcesso(); return; }
      // Cliente com contrato vivo renova (o contrato novo se liga ao atual);
      // lead, ou cliente vencido/cancelado, faz matrícula.
      setMatriculaMode(isClient && hasLiveContract(lead, new Date(), contractThresholdDays) ? 'renovacao' : 'matricula');
      setMatriculaOpen(true);
      return;
    }
    if (targetStatus === 'Perda') {
      const loss = planLoss(lead);
      if (!loss.ok) { toast.warning(stageMoveBlockMessage(lead, loss.reason)); return; }
      setLossModalOpen(true);
      return;
    }
    // Cliente só anda no funil UPGRADE, e a etapa mora em upgradeStageId.
    if (isClient) {
      if (!canTimeline) { toast.warning('Você não tem permissão para registrar interações neste lead.'); return; }
      const etapa = (statuses || []).find((s) => s.funnelId === upgradeFunnel?.id && s.name === targetStatus);
      const plan = planUpgradeMove(lead, etapa);
      if (!plan.ok) { toast.warning(stageMoveBlockMessage(lead, plan.reason)); return; }
      setLoading(true);
      try {
        const patch = plan.entering ? { ...plan.patch, upgradeEnteredAt: serverTimestamp() } : plan.patch;
        await logInteraction(db, lead, appUser,
          { text: `${plan.interactionText}${phaseNote ? ` Obs: ${phaseNote}` : ''}`, type: 'status_change' },
          patch
        );
        setComposerTab('note');
      } catch (e) {
        console.error(e);
        toast.error('Não foi possível mudar a etapa. Tente novamente.');
      } finally {
        setLoading(false);
      }
      return;
    }
    if (!canTimeline) { toast.warning('Você não tem permissão para registrar interações neste lead.'); return; }
    // O que gravar (e se pode gravar) é regra única em src/lib/stageMove.js, a
    // MESMA do Kanban. Cliente não volta a ser lead por aqui: antes a mudança
    // de fase zerava lifecycleStage e a aba Contratos passava a dizer "Ainda
    // não é cliente" com o contrato ainda gravado.
    const plan = planStageMove(lead, targetStatus, { funnelId: targetFunnelId || null });
    if (!plan.ok) { toast.warning(stageMoveBlockMessage(lead, plan.reason)); return; }
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
      // Etapa customizada com nome de matrícula conta como conversão nas
      // métricas — carimba a data do fechamento se faltar (senão a matrícula
      // cai no mês do cadastro). O carimbo é do SDK, por isso entra aqui.
      const up = withStageEntered(
        plan.stampConvertedAt ? { ...plan.patch, convertedAt: serverTimestamp() } : plan.patch,
        plan.stageChange,
        serverTimestamp()
      );
      await logInteraction(db, lead, appUser,
        { text: `Fase alterada para [${targetStatus}]${phaseNote ? ' — ' + phaseNote : ''}.`, type: 'status_change', ...plan.stageChange },
        up
      );
      // Histórico de aulas (dual-write best-effort): atribui a conversão à
      // última aula atendida do lead.
      if (plan.stampConvertedAt) {
        try { await markConvertingAula({ db, leadId: lead.id }); } catch (e) { console.error('markConvertingAula falhou', e); }
      }
      setComposerTab('note');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível mudar a fase. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Link público de indicação deste cliente. O menu do cabeçalho oferece as
  // duas saídas: copiar, ou abrir o WhatsApp DELE com a mensagem pronta para
  // ele repassar aos amigos.
  const referralLink = buildReferralShareLink(window.location.origin, appId, lead.id);
  const referralWaHref = whatsappHref(
    contact.phone,
    buildReferralWhatsAppText({ firstName: contactFirstName(contact.name), link: referralLink })
  );

  const copyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success('Link de indicação copiado.');
    } catch {
      toast.info(`Copie manualmente: ${referralLink}`);
    }
  };

  // Vincular/trocar/remover o indicador direto da ficha — corrige vínculo
  // errado e é o caminho retroativo para leads antigos com origem Indicação.
  const handleSaveReferral = async () => {
    if (!canIndicar) { negarAcesso(); return; }
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
    if (!canIndicar) { negarAcesso(); return; }
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

  // Nota comum do composer: só a anotação na timeline (planProfileNote), sem
  // patch no lead. Mudar fase e mover funil ficam no PhaseChanger
  // (handlePhaseConfirm); o agendamento, no ScheduleWizard.
  const saveInteraction = async () => {
    if (!canTimeline) { toast.warning('Você não tem permissão para registrar interações neste lead.'); return; }
    const payload = planProfileNote(note);
    if (!payload) return;
    setLoading(true);
    try {
      await logInteraction(db, lead, appUser, payload);
      setNote('');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar.');
    }
    setLoading(false);
  };

  // Grava o agendamento montado no ScheduleWizard. Mantém os campos canônicos
  // (nextFollowUp/nextFollowUpType/appointmentType/appointmentScheduledFor) e
  // grava os extras por tipo (modalidade+professor+quantidade p/ aula; unidade p/ visita).
  // Só usuários ATIVOS podem receber tarefa: delegar para quem saiu da academia
  // deixaria a tarefa órfã, sem aparecer para ninguém. O professor também não
  // recebe tarefa de contato, porque não vende (isSeller, em src/lib/acesso.js).
  const activeUsers = useMemo(
    () => (usersList || []).filter(u => u?.id && u.name && u.active !== false && isSeller(u)),
    [usersList]
  );

  const handleWizardConfirm = async ({ typeLabel, date, modalidade, professorId, soloTraining, quantidade, unidade, note: wizNote, contactOwnerId: wizOwnerId, contactOwnerName: wizOwnerName }) => {
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
      // Dono da TAREFA do dia. No contato, quem foi escolhido no passo
      // "Responsável". Na visita e na aula, quem está agendando, quando é
      // consultor e não é o dono do lead (appointmentTaskOwnerFor, em
      // lib/schedulePatch.js, a mesma regra do agendamento pelo Stronizap).
      // Gestor, professor e o dono do lead deixam a tarefa com o dono.
      const apptOwner = appointmentType ? appointmentTaskOwnerFor({ scheduler: appUser, lead }) : null;
      // Rastro do dono da TAREFA: quando ela vai para outra pessoa, só essa
      // pessoa a vê na Meta (decisão de produto). A nota é como o dono do lead
      // fica sabendo que outra pessoa vai cuidar do contato ou do compromisso.
      const contatoDelegado = !appointmentType && wizOwnerId && wizOwnerId !== lead.consultantId;
      const delegado = apptOwner ? taskOwnerText(apptOwner.name) : contatoDelegado ? taskOwnerText(wizOwnerName) : '';
      const text = `🔔 ${typeLabel} agendada${extra} p/ ${dateStr}${delegado}.` + (noteStr ? ` Obs: ${noteStr}` : '');

      // Dual-write best-effort no histórico de aulas (stronix_aulas), na regra
      // do Remarcar da Meta Diária (recordNewAppointment, em
      // lib/aulasWrites.js): o registro do agendamento que o lead tinha fecha
      // quando ele não vai mais acontecer (com o "Compareceu" ou o "Não veio"
      // que o lead tem, ou cancelado na troca de tipo), e o do tipo novo muda
      // de data ou nasce. Falha ali não derruba o agendamento do lead.
      // Mensagem e ligação não têm registro.
      const currentAulaId = await recordNewAppointment({
        db, lead, appointmentType,
        fields: isAula
          ? {
              professorId: professorId || null,
              professorName: professorId ? professorNameById(professores, professorId) : null,
              soloTraining: Boolean(soloTraining),
              modality: modalidade || null,
              scheduledFor: date,
            }
          : { unit: unidade || null, scheduledFor: date },
      });

      // Patch em src/lib/schedulePatch.js: mensagem e ligação mexem SÓ no
      // próximo contato; visita e aula mexem no contato E no compromisso. Vive
      // fora da view porque foi solto aqui dentro que o bug de 18/08/2026
      // nasceu, sem teste possível.
      const up = buildSchedulePatch({
        typeLabel, date, modalidade, professorId,
        professorName: professorId ? professorNameById(professores, professorId) : null,
        soloTraining, quantidade, unidade, note: noteStr, currentAulaId,
        contactOwnerId: wizOwnerId || null, contactOwnerName: wizOwnerName || null,
        appointmentOwnerId: apptOwner?.id || null, appointmentOwnerName: apptOwner?.name || null,
      });

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
    const href = whatsappHref(contact.phone, msg);
    if (!href) { toast.warning('Lead sem WhatsApp cadastrado.'); return; }
    setLoading(true);
    try {
      // Open WhatsApp Web with the typed message
      window.open(href, '_blank', 'noopener,noreferrer');
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
  };

  // ----- Derived computations -----
  const firstName = (lead.name || '').split(' ')[0] || 'lead';

  // Ciclo de vida (cliente) p/ os selos do cabeçalho e a aba Indicações.
  const isClient = lead.lifecycleStage === 'cliente' || isLeadConverted(lead);
  // Aba ativa da ficha, vinda do endereço. A aba Indicações só existe para
  // cliente, então um link dela numa ficha de lead abre a Linha do tempo. Não é
  // redirect de propósito: se a pessoa é cliente só se sabe depois de o
  // documento carregar, e um redirect ali trocaria o endereço toda vez que a
  // ficha demora.
  const activeProfileTab = tab === 'referrals' && !isClient ? 'timeline' : (tab || 'timeline');
  // Funil UPGRADE (lib/upgradeFunnel.js): é o único funil que um cliente pode
  // ocupar, e a etapa dele mora em upgradeStageId, não em status.
  const upgradeFunnel = getUpgradeFunnel(safeFunnels);
  // upgradeStageIdOf cai na entrada quando a etapa gravada foi apagada em
  // Configurações — mesma regra do board, senão ficha e card discordariam.
  const upgradeStage = lead.upgradeStageId
    ? (statuses || []).find((s) => s.id === upgradeStageIdOf(lead, statuses, upgradeFunnel?.id)) || null
    : null;
  // O PhaseChanger destaca a etapa atual pelo `status`. Para o cliente, passa
  // uma cópia com o status igual ao nome da etapa de Upgrade, só para o
  // destaque — a escrita continua em upgradeStageId (handlePhaseConfirm).
  const phaseChangerLead = isClient
    ? { ...lead, funnelId: upgradeFunnel?.id || '', status: upgradeStage?.name || '' }
    : lead;
  // Lead não entra em funil de sistema pela ficha: Renovações, Vencidos e
  // Upgrade projetam CLIENTES por query, então um lead com funnelId apontando
  // para eles sumiria de todo board. Indicações fica: é fluxo de lead.
  const phaseChangerFunnels = isClient
    ? (upgradeFunnel ? [upgradeFunnel] : [])
    : safeFunnels.filter((f) => !isSystemFunnel(f) || isReferralFunnel(f));
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
  // Cadastro à mão de indicações (menu Indicar e aba Indicações). Só existe
  // com o funil Indicações e a etapa de entrada, a mesma trava do "É uma
  // indicação?" do Novo lead, e só para quem pode editar e cadastrar indicação.
  const referralEntry = referralFunnel ? getReferralEntryStage(statuses, referralFunnel.id) : null;
  const canQuickReferral = isClient && !isReadOnly && canIndicar && Boolean(referralFunnel && referralEntry);
  const [quickReferralOpen, setQuickReferralOpen] = useState(false);

  // Classificação + filtro da timeline (helpers compartilhados em lib/timeline.js).
  // O marco de início fica embaixo da observação do cadastro, que nasce no
  // mesmo horário que ele quando o lead vem do Stronizap.
  const interactionsWithClass = originLastOnTies(
    (interactions || []).map(i => ({ ...i, _kind: classifyInteraction(i) }))
  );

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
  // dois, mas a ordem cronológica resolve. `via` diz se ele veio do Stronizap.
  // O Remarcar da Meta Diária também conta como agendamento
  // (isAppointmentReschedule): a nota dele não é linha de agendamento, e sem
  // ele o desfecho apontaria para o agendamento de antes do Remarcar. O
  // Remarcar de outro dia é as duas coisas na mesma linha, o desfecho
  // "reagendado" do agendamento de antes e o agendamento novo: por isso o
  // rodapé sai antes de ele virar a origem.
  const outcomeOrigin = (() => {
    const chrono = interactionsWithClass
      .filter(i => i.createdAt instanceof Date)
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const map = {};
    let lastScheduled = null;
    chrono.forEach(i => {
      if (i.appointmentOutcome && lastScheduled) {
        map[i.id] = { at: lastScheduled.createdAt, by: lastScheduled.consultantName, via: lastScheduled.via ?? null };
      }
      if (isAppointmentReschedule(i) || (!i.appointmentOutcome && i._kind === 'appointment')) lastScheduled = i;
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

  // Lead cadastrado pelo Stronizap já fecha a linha do tempo com o marco de
  // início (ZapSignupMarker). Com ele, a linha genérica "Início da jornada" sai,
  // senão o começo aparece duas vezes.
  const hasOriginMarker = interactionsWithClass.some(i => i._kind === 'origin');

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

  // ----- Render helpers -----
  const renderComposer = () => (
    <section className="rounded-2xl border border-border bg-card shadow-card">
      {/* Tabs */}
      <div className="px-4 pt-3 flex items-center gap-1 border-b border-slate-100 dark:border-white/[0.05] overflow-x-auto overscroll-x-contain thin-scroll">
        {[
          { id: 'note',     label: 'Anotação',   icon: <MessageCircle size={13} /> },
          { id: 'whatsapp', label: 'WhatsApp',   icon: <MessageCircle size={13} /> },
          { id: 'call',     label: 'Ligação',    icon: <Phone size={13} /> },
          // Mudar fase fica fora de quem não muda fase (o professor).
          ...(canMudarFase ? [{ id: 'status', label: 'Mudar fase', icon: <RefreshCw size={13} /> }] : []),
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
                placeholder={`Mensagem para ${contact.viaGuardian ? contactFirstName(contact.name) : firstName}...`}
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

            {composerTab === 'status' && canMudarFase && (
              <>
                {/* Cliente: só o funil Upgrade. O aviso vem ANTES para a pessoa
                    não montar a mudança inteira e descobrir no confirmar. */}
                {isClient && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12.5px] leading-[1.45] text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                    <FileText size={14} className="mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold">{firstName} é cliente e não volta a ser lead.</span>{' '}
                      {upgradeFunnel
                        ? 'Aqui você coloca o cliente no funil Upgrade ou muda a etapa dele lá. A matrícula e o contrato ficam na '
                        : 'O funil Upgrade ainda não foi criado nesta academia: ele nasce quando um gestor abre o app. A matrícula e o contrato ficam na '}
                      <button type="button" onClick={() => onTab('contratos')} className="font-semibold underline underline-offset-2">aba Contratos</button>.
                    </div>
                  </div>
                )}
                <PhaseChanger
                  lead={phaseChangerLead}
                  db={db}
                  funnels={phaseChangerFunnels}
                  statuses={statuses}
                  onConfirm={handlePhaseConfirm}
                  onCancel={() => setComposerTab('note')}
                />
              </>
            )}

            {composerTab === 'schedule' && (
              <ScheduleWizard onConfirm={handleWizardConfirm} onCancel={resetComposer} submitting={loading}
                usersList={activeUsers} leadOwnerName={lead.consultantName || null}
                leadOwnerId={lead.consultantId || null} />
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
  const copyPhone = async (phone) => {
    try {
      await navigator.clipboard.writeText(String(phone || ''));
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
  // dia e hora (68px) · tipo em versalete (74px) · corpo (resto) · autor (110px).
  // Cor no feed só aparece em chip de fase, selo de aula e faixa de marco —
  // todo o resto é neutro, senão vinte eventos viram um arco-íris.
  const renderTimelineEvent = (i) => {
    // ---- Variante 5: marco de início do cadastro pelo Stronizap -----------
    // Régua com a pílula, fora do padrão tabular (modelo C da spec). É o
    // registro mais antigo do lead, então fecha a linha do tempo por baixo.
    if (i._kind === 'origin') return <ZapSignupMarker key={i.id} interaction={i} />;

    // "28/09 14:32". O ano fica no bloco do mês.
    const stamp = timelineStamp(i.createdAt);
    const typeLabel = timelineTypeLabel(i);
    const author = i.consultantName || 'Sistema';
    // Agendamento feito pelo Stronizap: a marca antes do nome e o canal no
    // detalhe ao passar o mouse (modelo A da spec do agendamento). Só a linha
    // de agendamento leva isso: o campo via pode aparecer em outras linhas.
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
    // colchetes — vem como "Lead perdido. Motivo: ...".
    // Evento do funil Upgrade nunca é perda de lead, mesmo que o motivo
    // configurado diga "Perda de contato".
    const isLoss = i._kind === 'status' && !stageName && !ownerChange && !/^upgrade: /.test(lowerText) && /perdid|perda/i.test(lowerText);
    const isWin = i._kind === 'status' && /^venda$/i.test(stageName);

    // Corpo limpo: tira os prefixos que o composer injeta (📲/📞 das conversas,
    // "Obs:" das notas, ✅/🔄/🔔 dos eventos de sistema). A coluna de TIPO já
    // diz o que a linha é.
    const cleanBody = ownerChange ? ownerChangeText(i.text) : String(i.text || '')
      .replace(/^📲\s*Mensagem WhatsApp enviada:\s*/i, '')
      .replace(/^📞\s*Ligação:\s*/i, '')
      .replace(/^OBSERVAÇÃO DO CADASTRO:\s*/i, '')
      .replace(/^Obs:\s*/i, '')
      .replace(/^[✅🔄🔔]\s*/u, '')
      .trim();

    // ---- Variante 4: marco (matrícula, venda, perda) ----------------------
    // Quebra o padrão tabular numa faixa full-width com régua no topo.
    if (isContractMilestone || isWin || isLoss) {
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
          : contractCancel
            ? (/^renova/i.test(cleanBody) ? 'Renovação cancelada' : 'Contrato cancelado')
            : contractEvent?.kind === 'renovacao' ? 'Contrato renovado'
              : (contractEvent?.planName || 'Matrícula fechada');

      const subtitle = isWin ? `Fase alterada por ${author}` : cleanBody;

      // Valor só na matrícula e na renovação, e o do próprio evento.
      const eventValue = isContractMilestone && !contractCancel ? contractEvent.value : null;
      const showValue = eventValue != null;

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
              {fmtBRL(eventValue)}
            </span>
          )}
          <span className="text-[11px] num text-slate-400 dark:text-slate-500 shrink-0 whitespace-nowrap" title={i.createdAt?.toLocaleString('pt-BR')}>{stamp}</span>
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
      // "Tarefa de <nome>" quando a tarefa do dia ficou com outra pessoa (o
      // " · tarefa de" do texto, lido pelo parseAppointment): é por aqui que o
      // dono do lead vê quem vai cuidar da visita, da aula ou do contato.
      const detail = appt
        ? [appt.location, appt.taskOwner && `Tarefa de ${appt.taskOwner}`, appt.note, when.toLocaleDateString('pt-BR', { weekday: 'long' })].filter(Boolean).join(' · ')
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
            <div className="mt-[7px] pt-[7px] border-t border-slate-200 dark:border-white/[0.07] text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              {origin.via === ZAP_VIA && <StronizapBadge />}
              <span>{appointmentOriginText(origin)}</span>
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
        className="grid grid-cols-[68px_74px_1fr_110px] gap-3 items-start py-1.5 border-b border-slate-100 dark:border-white/[0.05] hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="text-[11px] num text-slate-400 dark:text-slate-500 text-right whitespace-nowrap pt-0.5" title={i.createdAt?.toLocaleString('pt-BR')}>{stamp}</div>
        <div className={cn('text-[9.5px] font-bold uppercase tracking-[.07em] pt-1', typeToneClass)}>{typeLabel}</div>
        <div className="min-w-0">{body}</div>
        <TimelineAuthor author={author} zapTitle={zapTitle} />
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
            <RingAvatar
              name={lead.name}
              size={64}
              toneName={profileState.tone}
              showDot={false}
              splitHex={profileState.key === 'a_vencer' ? '#10B981' : null}
              photoUrl={lead.photoUrl}
              onPhotoClick={!canEditCadastro || photoBusy ? null : () => setPhotoMenuOpen(true)}
            />

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
                {upgradeStage && (
                  <span className="inline-flex items-center gap-1 h-[18px] px-1.5 rounded-md text-[10px] font-bold uppercase tracking-[.05em] shrink-0 bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                    <TrendingUp size={10} /> Upgrade · {upgradeStage.name}
                  </span>
                )}
                <span className="text-[11.5px] text-slate-400 dark:text-slate-500 truncate">· {profileState.hint}</span>
              </div>
              {/* name + edit */}
              <div className="flex items-center flex-wrap gap-2 gap-y-1">
                <h1 className="font-display text-[26px] sm:text-[28px] font-bold tracking-tight leading-none truncate">{lead.name}</h1>
                {isMinorNow(lead) && (
                  <span className="shrink-0 inline-flex items-center h-[20px] px-2 rounded-md text-[10.5px] font-bold uppercase tracking-[.05em] bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                    Menor de idade
                  </span>
                )}
                {canEditCadastro && (
                  <IconBtn icon={<Pencil size={16} />} kind="default" title="Editar cadastro" onClick={() => setIsEditing(true)} />
                )}
              </div>
              {/* status + tags */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {!isClient && (
                  <StatusBadge statusName={lead.status} statusesArray={statuses} />
                )}
                {(lead.tags || []).length === 0 && canEditCadastro && (
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
                    {/* draggable={false}: sem isto arrastar o texto arrastaria
                        o endereço da ficha para outra aba ou para um campo de
                        texto, e um clique com tremida não abriria nada. */}
                    <LeadLink
                      leadId={lead.referredById}
                      draggable={false}
                      className={cn('hover:underline', !lead.referredById && 'pointer-events-none')}
                    >
                      Indicado por {lead.referredByName || 'cliente'}
                    </LeadLink>
                    {!isReadOnly && canIndicar && (
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
                ) : (isInReferralFunnel && !isReadOnly && canIndicar && (
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
              {/* Ações de contato sem moldura: só ícone e rótulo. O que precisa
                  de peso visual são Venda e Perda, logo ao lado. */}
              <Btn kind="ghost" size="md" icon={<MessageCircle size={14} />} onClick={handleWhatsApp}>WhatsApp</Btn>
              {/* O menu Indicar inteiro (cadastrar, copiar e enviar o link) é de
                  quem cadastra indicação. O professor fica sem ele. */}
              {isClient && canIndicar && (
                <DropdownMenu>
                  {/* Botão do próprio trigger, não o Btn: o Btn não encaminha
                      ref nem as props que o Radix injeta, então com `asChild`
                      o menu não abria. Estilo espelha o Btn ghost tamanho md. */}
                  <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[12.5px] rounded-lg font-semibold whitespace-nowrap transition active:scale-[.98] text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] data-[state=open]:bg-slate-100 dark:data-[state=open]:bg-white/[0.06]">
                    <Handshake size={14} /> Indicar
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={6} className="w-56 rounded-xl">
                    {canQuickReferral && (
                      <DropdownMenuItem onSelect={() => setQuickReferralOpen(true)} className="cursor-pointer">
                        <UserPlus className="size-4 text-brand-600 dark:text-brand-300" /> Cadastrar indicação
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={copyReferralLink} className="cursor-pointer">
                      <Copy className="size-4 text-slate-500" /> Copiar link
                    </DropdownMenuItem>
                    {referralWaHref && (
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <a href={referralWaHref} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="size-4 text-emerald-600 dark:text-emerald-400" /> {contact.viaGuardian ? 'Enviar pro responsável' : 'Enviar pro cliente'}
                        </a>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Btn
                kind="ghost"
                size="md"
                icon={<Phone size={14} />}
                onClick={() => { const href = telHref(contact.phone); if (href) window.location.href = href; }}
              >
                Ligar
              </Btn>
              {/* Venda/Perda só fazem sentido p/ LEAD: cliente já converteu e gere
                  o contrato pela aba Contratos (Renovar / Cancelar). Venda abre o
                  contrato e Perda muda a fase, então cada um segue a sua ação. */}
              {!isClient && (canContrato || canMudarFase) && (
                <>
                  <div className="w-px h-6 bg-slate-200 dark:bg-white/[0.08] mx-0.5 hidden sm:block"></div>
                  {canContrato && (
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
                  )}
                  {canMudarFase && (
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
                  )}
                </>
              )}
              {isGestor(appUser) && (
                <IconBtn icon={<Trash size={15} />} kind="danger" title="Excluir lead" onClick={handleDelete} />
              )}
            </div>
          </div>

          {/* Faixa de metadados: quatro células rotuladas, separadas por régua. */}
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/[0.05] grid grid-cols-2 lg:grid-cols-4 gap-y-3 divide-x divide-slate-100 dark:divide-white/[0.06]">
            <MetaCell label={contact.viaGuardian ? 'Contato (responsável)' : 'Contato'}>
              {contact.viaGuardian ? (
                <div className="min-w-0 flex flex-col gap-0.5">
                  {/* O número nunca trunca: é o dado que o consultor precisa
                      discar, e "(mãe)" pode ceder espaço antes dele. */}
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="num whitespace-nowrap">{contact.phone || '—'}</span>
                    {contact.phone && (
                      <button
                        type="button"
                        onClick={() => copyPhone(contact.phone)}
                        title="Copiar número do responsável"
                        aria-label="Copiar número do responsável"
                        className="shrink-0 size-5 grid place-items-center rounded text-slate-400 hover:text-brand-600 dark:hover:text-brand-300 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                      >
                        <Copy size={12} />
                      </button>
                    )}
                  </span>
                  <span className="truncate text-[11.5px] font-medium text-muted-foreground" title={contactLabel(contact)}>
                    {contactLabel(contact)}
                  </span>
                  {hasPhone(lead.whatsapp) && (
                    <span className="flex items-center gap-1.5 min-w-0 text-[11.5px] font-medium text-muted-foreground">
                      <span className="num whitespace-nowrap">Aluno · {lead.whatsapp}</span>
                      <button
                        type="button"
                        onClick={() => copyPhone(lead.whatsapp)}
                        title="Copiar número do aluno"
                        aria-label="Copiar número do aluno"
                        className="shrink-0 size-5 grid place-items-center rounded text-slate-400 hover:text-brand-600 dark:hover:text-brand-300 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                      >
                        <Copy size={12} />
                      </button>
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <span className="num truncate">{contact.phone || '—'}</span>
                  {contact.phone && (
                    <button
                      type="button"
                      onClick={() => copyPhone(contact.phone)}
                      title="Copiar número"
                      aria-label="Copiar número"
                      className="shrink-0 size-5 grid place-items-center rounded text-slate-400 hover:text-brand-600 dark:hover:text-brand-300 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                    >
                      <Copy size={12} />
                    </button>
                  )}
                </>
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
          {contact.missingOwnPhone && (
            <div className="mt-3 flex items-center flex-wrap gap-2">
              <p className="text-[12px] font-medium text-amber-700 dark:text-amber-300">
                Fez 18 anos. Cadastre o WhatsApp próprio.
              </p>
              {canEditCadastro && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1 text-[11.5px] font-medium text-slate-400 hover:text-brand-600 dark:hover:text-brand-300 px-2 py-1 rounded-md border border-dashed border-slate-300 dark:border-white/15 transition"
                >
                  Editar cadastro
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ===== Abas ===== */}
      <Tabs value={activeProfileTab} onValueChange={onTab}>
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
              {/* Um bloco por mês ("Setembro de 2026"). O dia e a hora vão em
                  cada linha, então o bloco não precisa de régua de dia. */}
              {groupedEvents.map(([label, events]) => (
                <section key={label} className="mb-5">
                  <header className="sticky top-0 z-10 flex items-center gap-2 py-2 bg-card/95 backdrop-blur">
                    <span className="text-[11px] font-semibold uppercase tracking-[.07em] text-slate-500 dark:text-slate-400 whitespace-nowrap">{label}</span>
                    <div className="flex-1 h-px bg-slate-200/80 dark:bg-white/[0.06]" />
                    <span className="text-[11px] num text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {events.length} {events.length === 1 ? 'evento' : 'eventos'}
                    </span>
                  </header>
                  {events.map(renderTimelineEvent)}
                </section>
              ))}

              {/* Marco de origem: fecha o registro com a data de cadastro. */}
              {timelineFilter === 'all' && !timelineQuery && !hasOriginMarker && (
                <p className="pl-[68px] pt-1 text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
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
                  <Btn kind="soft" size="sm" icon={<Plus size={13} />} onClick={() => { onTab('crm'); setComposerTab('schedule'); }}>Agendar</Btn>
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
          <ContractsTab
            lead={lead}
            leadContracts={leadContracts}
            firstName={firstName}
            // Contratos ficam só para leitura para quem não mexe em contrato
            // (o professor): todo botão da aba já segue o isReadOnly.
            isReadOnly={isReadOnly || !canContrato}
            loading={loading}
            contractThresholdDays={contractThresholdDays}
            renewalCheckpoints={renewalCheckpoints}
            onEnroll={handleWin}
            onRenew={handleRenew}
            onContractAction={openContractAction}
            onEditContract={openContractEdit}
            onActivate={openActivate}
          />
        </TabsContent>

        {/* ----- Aba: Indicações (só cliente) ----- */}
        {isClient && (
          <TabsContent value="referrals" className="pt-2">
            <ReferralsSection
              items={referralItems}
              loading={referralsLoading}
              onAdd={canQuickReferral ? () => setQuickReferralOpen(true) : null}
              canRefer={canIndicar}
            />
          </TabsContent>
        )}

      </Tabs>

      {/* Overlays */}
      <PhotoCaptureMenu
        open={photoMenuOpen}
        onClose={() => setPhotoMenuOpen(false)}
        onPicked={handlePhotoPicked}
        onRemove={lead.photoUrl ? handlePhotoRemove : null}
      />
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
      {quickReferralOpen && (
        <QuickReferralModal
          db={db}
          appUser={appUser}
          referrer={lead}
          referralFunnelId={referralFunnel?.id}
          entryStageName={referralEntry?.name}
          onClose={() => setQuickReferralOpen(false)}
          onCreated={reloadReferrals}
        />
      )}
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
          contract={contractById(contractAction.contractId)}
          action={contractAction.action}
          onClose={() => setContractAction(null)}
          onDone={() => setContractAction(null)}
        />
      )}
      {editingContractId && (
        <ContractEditModal
          lead={lead}
          appUser={appUser}
          db={db}
          contract={contractById(editingContractId)}
          onClose={() => setEditingContractId(null)}
          onDone={() => setEditingContractId(null)}
        />
      )}
      {activatingId && (
        <ContractActivateModal
          lead={lead}
          appUser={appUser}
          db={db}
          contract={contractById(activatingId)}
          onClose={() => setActivatingId(null)}
          onDone={() => setActivatingId(null)}
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
          onDone={() => setMatriculaOpen(false)}
        />
      )}
    </div>
  );
}

export { LeadProfileView };
