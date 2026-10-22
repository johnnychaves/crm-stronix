import { useState, useMemo, useRef } from 'react';
import { collection, doc, deleteDoc, getDocs, updateDoc, writeBatch, query, where, serverTimestamp } from 'firebase/firestore';
import { appId, LEADS_PATH, INTERACTIONS_PATH, CONTRACTS_PATH, storage } from '../lib/firebase.js';
import { uploadLeadPhoto, deleteLeadPhoto } from '../lib/leadPhoto.js';
import { logInteraction } from '../lib/interactions.js';
import { useLeadTimeline } from '../hooks/useLeadTimeline.js';
import { useReferrals } from '../hooks/useReferrals.js';
import { withBucket } from '../lib/leadDerived.js';
import { planStageMove, planLoss, planUpgradeMove, planUpgradeDecline, stageMoveBlockMessage, withStageEntered, reactivationFunnels, REACTIVATED_NOTE } from '../lib/stageMove.js';
import { canEditLead, isLeadConverted } from '../lib/leads.js';
import { ACTIONS, can, isGestor, isSeller } from '../lib/acesso.js';
import { normalizeAppointmentType, getSafeDateOrNull } from '../lib/dates.js';
// firstName vira contactFirstName: o arquivo já tem um firstName local, do próprio lead.
import { contactLabel, contactOf, firstName as contactFirstName, hasPhone, isMinorNow, telHref, whatsappHref } from '../lib/guardian.js';
import { hasLiveContract } from '../lib/contracts.js';
import { isSystemFunnel } from '../lib/funnels.js';
import { planProfileNote } from '../lib/profileNote.js';
import { getReferralFunnel, getReferralEntryStage, buildReferralShareLink, buildReferralWhatsAppText, isReferralFunnel } from '../lib/referrals.js';
import { getUpgradeFunnel, upgradeStageIdOf } from '../lib/upgradeFunnel.js';
import { commitReferralLink, removeReferralLink } from '../lib/referralsWrites.js';
import { deriveLeadState, getTone } from '../lib/leadState.js';
import { professorNameById, profileProfessorOf } from '../lib/professores.js';
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
import { ProfileComposer } from '../components/profile/ProfileComposer.jsx';
import { EMPTY_DRAFTS } from '../lib/quickTexts.js';
import { lastRecordOf } from '../lib/lastRecord.js';
import { ContractsTab } from '../components/profile/contracts/ContractsTab.jsx';
import { LossReasonModal } from '../modals/LossReasonModal.jsx';
import { ReactivateLeadModal } from '../modals/ReactivateLeadModal.jsx';
import { ContractModal } from '../modals/ContractModal.jsx';
import { ContractOutcomeModal } from '../modals/ContractOutcomeModal.jsx';
import { ContractEditModal } from '../modals/ContractEditModal.jsx';
import { ContractActivateModal } from '../modals/ContractActivateModal.jsx';
import { QuickReferralModal } from '../modals/QuickReferralModal.jsx';
import { ContextCard } from '../components/profile/ContextCard.jsx';
import { CadastroTab } from '../components/profile/cadastro/CadastroTab.jsx';
import { saveCadastroSection } from '../lib/cadastroWrites.js';
import { UpNextList } from '../components/profile/UpNextList.jsx';
import { TimelineBar } from '../components/profile/TimelineBar.jsx';
import { TimelineEvent } from '../components/profile/TimelineEvent.jsx';
import { upNextOf } from '../lib/upNext.js';
import { writeAppointmentOutcome } from '../lib/appointmentOutcome.js';
import { outcomeOptionsFor, schedulePresetOf } from '../lib/fichaOutcome.js';
import { saveContextField } from '../lib/contextWrites.js';
import { FICHA_TABS } from '../lib/routes.js';
import {
  groupTimeline,
  classifyInteraction,
  buildStageTransitions,
  matchesTimelineFilter,
  TIMELINE_FILTERS,
  TIMELINE_SYSTEM_KIND,
  originLastOnTies,
  isAppointmentReschedule
} from '../lib/timeline.js';
import { ArrowLeft, Ban, Calendar, Clock, Copy, CreditCard, FileText, Handshake, IdCard, MessageCircle, Pencil, Phone, Plus, RotateCcw, Search, Tag, ThumbsDown, Trash, TrendingUp, User, UserPlus } from 'lucide-react';

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
function LeadProfileView({ lead, tab, onTab, onBack, onDeleteStart, onDeleteFailed, listenersActive = true, appUser, statuses, tags, lossReasons, usersList, db, funnels, sources = [] }) {
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
  // Pedido de abertura do Cadastro vindo do cabeçalho (lápis, "Fez 18 anos"): a
  // seção e o campo que a aba abre já em edição. O `at` remonta a aba quando o
  // pedido é novo, mesmo com ela já aberta. É consumido na troca de aba.
  const [cadastroRequest, setCadastroRequest] = useState(null);
  const [loading, setLoading] = useState(false);

  const [lossModalOpen, setLossModalOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
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

  // O compositor da Linha do tempo: aberto ou fechado, em que modo e o rascunho
  // de cada modo. Tudo mora na ficha porque a aba desmonta o compositor quando a
  // pessoa vai a Contratos e volta: o texto digitado não pode se perder na troca.
  const [composer, setComposer] = useState({ open: false, mode: 'note' });
  const [composerDrafts, setComposerDrafts] = useState(EMPTY_DRAFTS);
  // O Remarcar do "A seguir" abre o Agendar já no tipo do item, e `n` remonta o
  // assistente a cada Remarcar. Abrir o compositor por outro caminho limpa o
  // tipo, para o próximo Agendar nascer em branco.
  const [scheduleStart, setScheduleStart] = useState({ type: null, n: 0 });
  const openComposer = (mode = 'note') => {
    setScheduleStart((s) => (s.type ? { ...s, type: null } : s));
    setComposer({ open: true, mode });
  };
  const closeComposer = () => setComposer({ open: false, mode: 'note' });
  // Quem grava fecha o compositor só se ele ainda está no modo que gravou: a
  // gravação lenta não fecha o compositor que a pessoa já levou a outro modo, e
  // o Reativar lead e o Marcar perda do cabeçalho, que passam pela mudança de
  // fase, só fecham o compositor que estava no Mudar fase.
  const closeComposerIn = (mode) => setComposer((c) => (c.mode === mode ? { open: false, mode: 'note' } : c));
  const composerRef = useRef(null);
  // O registro recebe o foco quando o item marcado sai do A seguir, e o evento
  // que o "Ver no histórico" abriu fica em destaque por um instante.
  const registroRef = useRef(null);
  const [savingOutcomeId, setSavingOutcomeId] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const flashTimer = useRef(null);

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
        closeComposerIn('status');
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
        closeComposerIn('status');
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
      closeComposerIn('status');
      return true;
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível mudar a fase. Tente novamente.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Reativar lead: o lead em Perda volta a uma fase aberta pelo mesmo caminho
  // do "Mudar fase" (planStageMove limpa o motivo e a data da perda), e a linha
  // do tempo diz que ele foi reativado. Devolve se gravou, para a janela fechar.
  const handleReactivate = async ({ funnelId: targetFunnelId, targetStatus }) => {
    if (lead.status !== 'Perda') return false;
    const ok = await handlePhaseConfirm({ funnelId: targetFunnelId, targetStatus, note: REACTIVATED_NOTE });
    if (ok) toast.success(`${lead.name || 'Lead'} reativado em ${targetStatus}.`);
    return Boolean(ok);
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
  // Recebe o texto do compositor e devolve true quando gravou: só então o
  // compositor esvazia o rascunho.
  const saveInteraction = async (text) => {
    if (!canTimeline) { toast.warning('Você não tem permissão para registrar interações neste lead.'); return false; }
    const payload = planProfileNote(text);
    if (!payload) return false;
    setLoading(true);
    try {
      await logInteraction(db, lead, appUser, payload);
      closeComposerIn('note');
      setLoading(false);
      return true;
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar.');
    }
    setLoading(false);
    return false;
  };

  // Edição no lugar do Contexto comercial: grava só o campo que mudou
  // (lib/contextWrites.js). A trava é a do cadastro, a mesma do lápis do
  // cabeçalho. Devolve false quando não gravou, para o editor ficar aberto.
  // `from` é o valor da abertura do editor: as etiquetas gravam só a diferença.
  // O editor aberto mora aqui, e não no card, para o rascunho sobreviver à
  // troca de aba, como o rascunho do compositor.
  const [contextEdit, setContextEdit] = useState(null);
  const handleContextSave = async (field, value, from) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return false; }
    if (!canEditCadastro) { negarAcesso(); return false; }
    try {
      const { ok, change } = await saveContextField({ db, lead, appUser, field, value, from, usersList, professores });
      if (!ok) { toast.warning('Esse campo não pode ser salvo.'); return false; }
      if (change) toast.success(`${change.toName} agora é o responsável.`);
      return true;
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar. Tente novamente.');
      return false;
    }
  };

  // Troca de aba da ficha. O pedido de abertura do Cadastro vale uma vez só.
  const changeTab = (next) => {
    if (next !== 'cadastro') setCadastroRequest(null);
    onTab(next);
  };

  // Abre o Cadastro, opcionalmente já numa seção e num campo.
  const openCadastro = (sectionId = null, field = null) => {
    setCadastroRequest(sectionId ? { sectionId, field, at: Date.now() } : null);
    onTab('cadastro');
  };

  // O "Adicionar etiqueta" do cabeçalho: as etiquetas se editam no Contexto
  // comercial, na Linha do tempo.
  const goToContext = () => {
    changeTab('timeline');
    setTimeout(() => document.getElementById('ficha-contexto')?.scrollIntoView?.({ block: 'center' }), 0);
  };

  // Grava uma seção do Cadastro (lib/cadastroWrites.js), só com as chaves dela.
  // A trava é a do cadastro, a mesma do Contexto comercial. Devolve false quando
  // não gravou, e a seção continua aberta com o que foi digitado.
  const handleCadastroSave = async (sectionId, form) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return false; }
    if (!canEditCadastro) { negarAcesso(); return false; }
    try {
      await saveCadastroSection({ db, lead, sectionId, form });
      toast.success('Cadastro salvo!');
      return true;
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar o cadastro. Tente novamente.');
      return false;
    }
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
      closeComposerIn('schedule');
      setLoading(false);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar o agendamento.');
      setLoading(false);
    }
  };

  // Os gravadores do WhatsApp e da Ligação também recebem o texto do
  // compositor e devolvem true quando gravaram.
  const handleSendWhatsAppMessage = async (text) => {
    if (!canTimeline) { toast.warning('Você não tem permissão para registrar interações neste lead.'); return false; }
    const msg = String(text ?? '').trim();
    if (!msg) { toast.warning('Escreva a mensagem antes de enviar.'); return false; }
    const href = whatsappHref(contact.phone, msg);
    if (!href) { toast.warning('Lead sem WhatsApp cadastrado.'); return false; }
    setLoading(true);
    try {
      // Abre o WhatsApp com a mensagem digitada e registra o envio na linha do tempo.
      window.open(href, '_blank', 'noopener,noreferrer');
      await logInteraction(db, lead, appUser, {
        text: `📲 Mensagem WhatsApp enviada: ${msg}`,
        type: 'note'
      });
      closeComposerIn('whatsapp');
      setLoading(false);
      return true;
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível registrar o envio.');
    }
    setLoading(false);
    return false;
  };

  const handleLogCall = async (text) => {
    if (!canTimeline) { toast.warning('Você não tem permissão para registrar interações neste lead.'); return false; }
    const summary = String(text ?? '').trim();
    if (!summary) { toast.warning('Resuma o que rolou na ligação antes de salvar.'); return false; }
    setLoading(true);
    try {
      await logInteraction(db, lead, appUser, {
        text: `📞 Ligação: ${summary}`,
        type: 'note'
      });
      closeComposerIn('call');
      setLoading(false);
      return true;
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível registrar a ligação.');
    }
    setLoading(false);
    return false;
  };

  // O ProfileComposer manda o modo e o texto; cada modo cai no seu gravador.
  const submitComposerText = (mode, text) => {
    if (mode === 'whatsapp') return handleSendWhatsAppMessage(text);
    if (mode === 'call') return handleLogCall(text);
    return saveInteraction(text);
  };

  // ----- Derived computations -----
  const firstName = (lead.name || '').split(' ')[0] || 'lead';

  // Ciclo de vida (cliente) p/ os selos do cabeçalho e a aba Indicações.
  const isClient = lead.lifecycleStage === 'cliente' || isLeadConverted(lead);
  // Aba ativa da ficha, vinda do endereço. A aba Indicações só existe para
  // cliente, e a aba Cadastro só para quem edita cadastro (o professor e quem
  // está sem login não a veem). Um link de uma aba que a pessoa não tem abre a
  // Linha do tempo. Não é redirect de propósito: se a pessoa é cliente só se
  // sabe depois de o documento carregar, e um redirect ali trocaria o endereço
  // toda vez que a ficha demora.
  // Chave que não é aba (a antiga 'crm', por exemplo) também abre a Linha do
  // tempo, para a ficha nunca ficar sem conteúdo.
  const activeProfileTab = !Object.hasOwn(FICHA_TABS, tab || '')
    || (tab === 'referrals' && !isClient)
    || (tab === 'cadastro' && !canEditCadastro)
    ? 'timeline'
    : tab;
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
  // Os funis do "Reativar lead": os mesmos do "Mudar fase", com fase aberta, e
  // o de Indicações só para quem já tem o indicador (reactivationFunnels).
  const reactivateFunnels = isClient ? [] : reactivationFunnels(phaseChangerFunnels, statuses, {
    isReferral: isReferralFunnel, hasReferrer: Boolean(lead.referredById)
  });
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
  // Guardado pela lista que chega do Firestore, para a ficha não reclassificar
  // o histórico inteiro a cada tecla digitada no compositor.
  const interactionsWithClass = useMemo(() => originLastOnTies(
    (interactions || []).map(i => ({ ...i, _kind: classifyInteraction(i) }))
  ), [interactions]);
  // O último registro de texto, que o compositor mostra ao abrir.
  const lastText = useMemo(() => lastRecordOf(interactionsWithClass), [interactionsWithClass]);

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

  // O que vem a seguir (visita, aula, próximo contato), lido dos campos do lead.
  const upNext = upNextOf(lead);

  // Remarcar: o Agendar nasce de novo, já no tipo do item. O foco solto vai
  // para o primeiro passo dele (o StageHead só pega o foco que está no body), e
  // o compositor, que fica acima do A seguir, volta à tela. O foco só é solto
  // quando está no A seguir ou no registro, onde o desfecho o deixou: depois da
  // gravação, quem já foi digitar em outro lugar continua onde está.
  const openScheduleFor = (item) => {
    const a = document.activeElement;
    if (a && (a === registroRef.current || a.closest?.('[aria-label="A seguir"]'))) a.blur();
    setScheduleStart((s) => ({ type: schedulePresetOf(item), n: s.n + 1 }));
    setComposer({ open: true, mode: 'schedule' });
    requestAnimationFrame(() => composerRef.current?.scrollIntoView?.({ block: 'nearest' }));
  };
  const handleReschedule = (item) => {
    if (!canTimeline) { toast.warning('Você não tem permissão para agendar neste lead.'); return; }
    openScheduleFor(item);
  };

  // Marcar desfecho, só na visita e na aula de hoje: o gravador da Meta Diária
  // (writeAppointmentOutcome), com a regra da Agenda de hoje (outcomeOptionsFor). O Compareceu pode levar o lead
  // para Negociação, então a trava é a de mudar fase. Quem não veio precisa de
  // data nova: o Agendar abre na hora, no mesmo tipo, como na Meta Diária.
  const handleOutcome = async (item, choice) => {
    if (isReadOnly) { toast.warning('Você não tem permissão para alterar este lead.'); return; }
    if (!canMudarFase) { negarAcesso(); return; }
    // Só o compromisso de hoje tem desfecho (canOutcome, do upNextOf): a trava
    // vale aqui também, e não só no botão.
    if (savingOutcomeId || !item?.canOutcome || (choice !== 'attended' && choice !== 'no_show')) return;
    const options = outcomeOptionsFor(item, { lead, interactions });
    if (!options) return;
    // O balão fecha e o botão dele fica desligado, e depois o item sai do A
    // seguir: o foco espera no registro, onde o desfecho aparece, e nunca cai
    // no body.
    registroRef.current?.focus({ preventScroll: true });
    setSavingOutcomeId(item.id);
    try {
      await writeAppointmentOutcome({ db, lead, outcome: choice, appUser, statuses, ...options });
      toast.success(choice === 'attended' ? `Presença de ${firstName} confirmada.` : `${firstName} marcado como não veio.`);
      if (choice === 'no_show') openScheduleFor(item);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar o desfecho. Tente novamente.');
    } finally {
      setSavingOutcomeId(null);
    }
  };

  // "Ver no histórico": limpa o filtro e a busca, para o registro aparecer,
  // leva o foco e a tela até ele e o destaca por um instante.
  const goToEvent = (id) => {
    setTimelineFilter('all');
    setTimelineQuery('');
    setFlashId(id);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 1600);
    requestAnimationFrame(() => {
      const el = document.getElementById(`ev-${id}`);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView?.({ block: 'center' });
    });
  };

  // Histórico de contratos (aba Contratos): todos os contratos do lead, mais
  // recentes primeiro.
  const leadContracts = (Array.isArray(contratos) ? contratos : [])
    .filter(c => c.leadId === lead.id)
    .sort((a, b) => (getSafeDateOrNull(b.startsAt)?.getTime() || 0) - (getSafeDateOrNull(a.startsAt)?.getTime() || 0));

  // O contrato VIGENTE tem card próprio; a corrente do histórico lista só os
  // anteriores (repeti-lo duplicava plano, valor e vigência 42px abaixo).
  const currentContract = leadContracts.find(c => c.id === lead.currentContractId) || null;

  // ----- Render helpers -----
  const copyPhone = async (phone) => {
    try {
      await navigator.clipboard.writeText(String(phone || ''));
      toast.success('Número copiado.');
    } catch {
      toast.info('Copie o número manualmente.');
    }
  };

  const profileProfessor = profileProfessorOf(lead);

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
                  <IconBtn icon={<Pencil size={16} />} kind="default" title="Editar cadastro" onClick={() => openCadastro()} />
                )}
              </div>
              {/* status + tags */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {!isClient && (
                  <StatusBadge statusName={lead.status} statusesArray={statuses} />
                )}
                {(lead.tags || []).length === 0 && canEditCadastro && (
                  <button
                    onClick={goToContext}
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
                  {/* Lead em Perda: Venda e Perda saem, e fica só o "Reativar
                      lead", que o devolve a uma fase do funil. Reativado, os dois
                      voltam. */}
                  {lead.status === 'Perda' ? (
                    canMudarFase && (
                      <Btn
                        kind="brand"
                        size="md"
                        icon={<RotateCcw size={14} />}
                        onClick={() => setReactivateOpen(true)}
                        disabled={loading || reactivateFunnels.length === 0}
                      >
                        Reativar lead
                      </Btn>
                    )
                  ) : (
                    <>
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
                          disabled={loading}
                          title="Marcar perda"
                        >
                          Marcar perda
                        </Btn>
                      )}
                    </>
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
                        className="shrink-0 size-5 grid place-items-center rounded text-slate-400 hover:text-brand-600 dark:hover:text-brand-300 transition focus-visible:outline-none focus-visible:anel-foco"
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
                        className="shrink-0 size-5 grid place-items-center rounded text-slate-400 hover:text-brand-600 dark:hover:text-brand-300 transition focus-visible:outline-none focus-visible:anel-foco"
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
                      className="shrink-0 size-5 grid place-items-center rounded text-slate-400 hover:text-brand-600 dark:hover:text-brand-300 transition focus-visible:outline-none focus-visible:anel-foco"
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
              {profileProfessor ? (
                <>
                  <Avatar name={profileProfessor.name} size={19} />
                  <span className="truncate">{profileProfessor.name}</span>
                  {profileProfessor.modality && (
                    <span className="text-slate-400 dark:text-slate-500 font-normal truncate">· {profileProfessor.modality}</span>
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
                  onClick={() => openCadastro('identidade', 'whatsapp')}
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
      <Tabs value={activeProfileTab} onValueChange={changeTab}>
        <TabsList variant="line" className="gap-1 border-b border-slate-200 dark:border-white/[0.08] w-full justify-start rounded-none p-0 h-11">
          <TabsTrigger
            value="timeline"
            className="flex-none h-11 px-4 text-[13.5px] font-medium rounded-t-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] data-[state=active]:font-semibold data-[state=active]:bg-transparent data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:[&_svg]:text-brand-600 dark:data-[state=active]:[&_svg]:text-brand-300 after:h-[3px] after:rounded-full after:bg-brand-600"
          >
            <Clock className="size-[15px]" />
            Linha do tempo
            <TabCount n={(interactions || []).length} active={activeProfileTab === 'timeline'} />
          </TabsTrigger>
          {canEditCadastro && (
            <TabsTrigger
              value="cadastro"
              className="flex-none h-11 px-4 text-[13.5px] font-medium rounded-t-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] data-[state=active]:font-semibold data-[state=active]:bg-transparent data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:[&_svg]:text-brand-600 dark:data-[state=active]:[&_svg]:text-brand-300 after:h-[3px] after:rounded-full after:bg-brand-600"
            >
              <IdCard className="size-[15px]" />
              Cadastro
            </TabsTrigger>
          )}
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
         {/* Desenho A2: o CRM mora aqui. Contexto comercial, compositor, e o
             registro com o "A seguir" no topo, numa tela só. */}
         <div className="flex flex-col gap-4">
          <ContextCard
            lead={lead}
            sources={sources}
            usersList={usersList}
            tagsCatalog={tags}
            canEdit={canEditCadastro}
            onSave={handleContextSave}
            edit={contextEdit}
            setEdit={setContextEdit}
          />
          <div ref={composerRef}>
          <ProfileComposer
            open={composer.open}
            mode={composer.mode}
            onOpen={openComposer}
            onClose={closeComposer}
            drafts={composerDrafts}
            onDrafts={setComposerDrafts}
            appUser={appUser}
            firstName={firstName}
            whatsappName={contact.viaGuardian ? contactFirstName(contact.name) : null}
            lastText={lastText}
            onGoto={goToEvent}
            canMudarFase={canMudarFase}
            loading={loading}
            onSubmitText={submitComposerText}
            renderStatus={() => (
              <>
                {/* Cliente: só o funil Upgrade. O aviso vem ANTES para a pessoa
                    não montar a mudança inteira e descobrir no confirmar. */}
                {isClient && (
                  <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12.5px] leading-[1.45] text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                    <FileText size={14} className="mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold">{firstName} é cliente e não volta a ser lead.</span>{' '}
                      {upgradeFunnel
                        ? 'Aqui você coloca o cliente no funil Upgrade ou muda a etapa dele lá. A matrícula e o contrato ficam na '
                        : 'O funil Upgrade ainda não foi criado nesta academia: ele nasce quando um gestor abre o app. A matrícula e o contrato ficam na '}
                      <button type="button" onClick={() => changeTab('contratos')} className="font-semibold underline underline-offset-2">aba Contratos</button>.
                    </div>
                  </div>
                )}
                <PhaseChanger
                  lead={phaseChangerLead}
                  db={db}
                  funnels={phaseChangerFunnels}
                  statuses={statuses}
                  onConfirm={handlePhaseConfirm}
                  onCancel={closeComposer}
                />
              </>
            )}
            renderSchedule={() => (
              <ScheduleWizard
                key={scheduleStart.n}
                initialTypeId={scheduleStart.type}
                onConfirm={handleWizardConfirm}
                onCancel={closeComposer}
                submitting={loading}
                usersList={activeUsers}
                leadOwnerName={lead.consultantName || null}
                leadOwnerId={lead.consultantId || null}
              />
            )}
          />
          </div>
         {/* O registro vive dentro de um card branco: a barra de controles fica
             no topo, separada por uma régua que atravessa o card inteiro. */}
         <section
           ref={registroRef}
           tabIndex={-1}
           aria-label="Histórico"
           className="rounded-2xl border border-border bg-card shadow-card overflow-hidden outline-none focus-visible:anel-foco"
         >
          {(interactions || []).length > 0 && (
            <TimelineBar
              filters={TIMELINE_FILTERS}
              counts={timelineCounts}
              filter={timelineFilter}
              onFilter={setTimelineFilter}
              showSystem={showSystem}
              systemHiddenCount={systemHiddenCount}
              onToggleSystem={() => setShowSystem((v) => !v)}
              query={timelineQuery}
              onQuery={setTimelineQuery}
            />
          )}

          {/* A seguir: só no registro inteiro, sem filtro nem busca. */}
          {timelineFilter === 'all' && !timelineQuery && (
            <UpNextList
              items={upNext}
              canOutcome={canMudarFase && !isReadOnly}
              loading={loading}
              savingId={savingOutcomeId}
              onReschedule={canTimeline ? handleReschedule : null}
              onOutcome={handleOutcome}
            />
          )}

          {/* Timeline */}
          {(interactions || []).length === 0 ? (
            <div className="px-8 py-16 grid place-items-center text-center text-slate-400">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/[0.05] grid place-items-center mb-3">
                <Clock size={20} className="opacity-50" />
              </div>
              <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Sem histórico ainda</p>
              <p className="text-[12.5px] max-w-[280px] mt-0.5">Registre uma nota, mensagem ou ligação no campo acima para começar a história desta pessoa.</p>
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
                  cada linha, então o bloco não precisa de régua de dia. No
                  escuro o bg-card é translúcido: o cabeçalho fixo usa a mesma
                  cor já misturada, opaca, para não virar uma faixa clara. */}
              {groupedEvents.map(([label, events]) => (
                <section key={label} className="mb-5">
                  <header className="sticky top-0 z-10 flex items-baseline gap-2.5 bg-card/95 py-2.5 backdrop-blur dark:bg-[color-mix(in_srgb,var(--page),white_2%)]">
                    <span className="font-display text-[15px] font-semibold tracking-tight">{label}</span>
                    <span className="num text-[12.5px] text-muted-foreground">
                      {events.length} {events.length === 1 ? 'registro' : 'registros'}
                    </span>
                  </header>
                  {events.map((i) => (
                    <TimelineEvent
                      key={i.id}
                      i={i}
                      statuses={statuses}
                      stageTransitions={stageTransitions}
                      outcomeOrigin={outcomeOrigin}
                      flash={flashId === i.id}
                    />
                  ))}
                </section>
              ))}

              {/* Marco de origem: fecha o registro com a data de cadastro. */}
              {timelineFilter === 'all' && !timelineQuery && !hasOriginMarker && (
                <p className="pl-[126px] pt-1 text-[12px] text-muted-foreground whitespace-nowrap">
                  Início da jornada · {lead.createdAt?.toLocaleDateString('pt-BR') || '—'}
                </p>
              )}
            </div>
          )}
         </section>
         </div>
        </TabsContent>

        {/* ----- Aba: Cadastro (só quem edita cadastro) ----- */}
        {canEditCadastro && (
          <TabsContent value="cadastro" className="pt-2">
            <CadastroTab
              key={cadastroRequest?.at ?? 'aba'}
              lead={lead}
              db={db}
              request={cadastroRequest}
              onSave={handleCadastroSave}
            />
          </TabsContent>
        )}

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
      {reactivateOpen && (
        <ReactivateLeadModal
          lead={lead}
          funnels={reactivateFunnels}
          statuses={statuses}
          onClose={() => setReactivateOpen(false)}
          onConfirm={handleReactivate}
        />
      )}
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
