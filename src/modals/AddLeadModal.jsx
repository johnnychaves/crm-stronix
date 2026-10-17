import { useState, useEffect, useRef } from 'react';
import {
  Check, ChevronDown, ChevronRight, Plus, AlertTriangle, X, Baby, ExternalLink, Calendar, IdCard, Mail,
  LockKeyhole,
} from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { useDuplicateLead, findDuplicateLeadRemote } from '../hooks/useDuplicateLead.js';
import { logInteraction } from '../lib/interactions.js';
import { sameContactPhone } from '../lib/leadDerived.js';
import { buildNewLeadDoc, leadEntryFunnels } from '../lib/newLead.js';
import { formatPhone } from '../lib/masks.js';
import { GUARDIAN_RELATIONSHIPS, guardianIssue, turnedAdult } from '../lib/guardian.js';
import { phoneNoticeLines } from '../lib/phoneNotice.js';
import { useGuardianMatches } from '../hooks/useGuardianMatches.js';
import { fromDateInputValue } from '../lib/dates.js';
import { getDefaultFunnel } from '../lib/funnels.js';
import { getReferralFunnel, getReferralEntryStage, referralSourceOf, REFERRAL_FUNNEL_NAME } from '../lib/referrals.js';
import { isRenewalFunnel } from '../lib/renewalFunnel.js';
import { isExpiredFunnel } from '../lib/expiredFunnel.js';
import { isUpgradeFunnel } from '../lib/upgradeFunnel.js';
import { commitReferralLink } from '../lib/referralsWrites.js';
import { signupFlow, firstOpenStep, missingText } from '../lib/leadSignupSteps.js';
import { ReferrerPicker } from '../components/profile/ReferrerPicker.jsx';
import { LeadLink } from '../components/nav/AppLink.jsx';
import { Switch } from '../components/ui/switch.jsx';
import { cn } from '../lib/utils.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '../components/ui/sheet.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { RingAvatar } from '../components/profile/RingAvatar.jsx';
import { settingsColorTone } from '../components/ui/ColorPicker.jsx';

// ==========================================================================
// "NOVO LEAD" em gaveta, passo a passo (desenho C escolhido pelo Johnny em
// 16/10/2026, mockups em docs/superpowers/specs/mockups/2026-10-16-cadastro-lead-*).
// Os passos se liberam um depois do outro, como o assistente de agendar da ficha
// (ScheduleWizard): o passo aberto mostra as opções, o feito vira um resumo com
// "Editar" e o que vem depois espera. A ordem parte do número, porque a conferência
// de duplicidade vem antes de qualquer outro campo. O que é opcional fica em
// "Mais detalhes". As regras de gravação não mudaram: o lead sai de buildNewLeadDoc.
// ==========================================================================

// ---------- helpers de apresentação ----------
const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
// 000.000.000-00
const fmtCPF = (raw) => {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return d;
};

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent);
const SUBMIT_KEYS = isMac ? '⌘↵' : 'Ctrl+Enter';

const inputCls =
  'w-full h-11 px-3.5 rounded-xl text-[14px] font-medium bg-white dark:bg-white/[0.04] ' +
  'border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white ' +
  'placeholder:text-slate-400 placeholder:font-normal outline-none transition ' +
  'focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12';

const chipCls = (on) => cn(
  'inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full border text-[13.5px] font-medium transition active:scale-[.98] focus-visible:anel-foco',
  on
    ? 'border-brand-600 bg-brand-50 text-brand-700 font-semibold dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-200'
    : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200 dark:border-white/[0.1] dark:bg-white/[0.03] dark:text-slate-200 dark:hover:border-white/20'
);

const BTN_PRIMARY =
  'h-11 px-5 rounded-xl text-[13.5px] font-semibold inline-flex items-center justify-center gap-2 transition active:scale-[.98] ' +
  'bg-brand-600 text-white hover:bg-brand-700 shadow-[0_10px_24px_-8px_rgba(43,89,255,.7)] ' +
  'focus-visible:anel-foco focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
  'disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed';

const STEP_TITLE = {
  contato: (minor) => (minor ? 'WhatsApp do responsável' : 'WhatsApp'),
  nome: (minor) => (minor ? 'Nome do aluno' : 'Nome'),
  responsavel: () => 'Responsável',
  origem: () => 'Como chegou',
  dor: () => 'Dor',
  modalidade: () => 'Modalidade de interesse',
  funil: () => 'Onde entra',
};
const STEP_HINT = {
  contato: 'Comece pelo número. Se a pessoa já existe, você descobre antes de digitar o resto.',
  nome: 'Como a pessoa se apresentou.',
  responsavel: 'Quem responde pelo aluno. É com essa pessoa que o time vai falar.',
  origem: 'De onde veio esse contato?',
  dor: 'O que a pessoa quer resolver?',
  modalidade: 'Qual treino a pessoa quer fazer? Dá para pular.',
  funil: 'Em qual funil e etapa o lead aparece no Pipeline.',
};

// ---------- átomos ----------
function Label({ children, hint }) {
  return (
    <div className="flex items-baseline justify-between mb-1.5 gap-2">
      <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">{children}</span>
      {hint && <span className="text-[12px] text-slate-400 dark:text-slate-500">{hint}</span>}
    </div>
  );
}

const IconInput = ({ icon, className = '', inputRef, ...p }) => (
  <div className="relative">
    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">{icon}</span>
    <input ref={inputRef} autoComplete="off" {...p} className={cn(inputCls, 'pl-10', className)} />
  </div>
);

const Select = ({ icon, children, className = '', ...p }) => (
  <div className="relative">
    {icon && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">{icon}</span>}
    <select {...p} className={cn(inputCls, 'appearance-none cursor-pointer pr-9', icon && 'pl-10', className)}>{children}</select>
    <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
  </div>
);

// Escolha única em chips. options: [{ value, label?, dot? }]. O primeiro chip
// recebe o foco quando o passo abre (ou o marcado, com autoFocusSelected), para o
// teclado seguir sem mouse.
function Chips({ label, options, value, onPick, autoFocusFirst = false, autoFocusSelected = false }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o, i) => {
        const on = value === o.value;
        return (
          <button
            type="button" key={o.value} role="radio" aria-checked={on}
            autoFocus={autoFocusFirst ? i === 0 : autoFocusSelected && on}
            onClick={() => onPick(o.value)} className={chipCls(on)}
          >
            {on ? <Check size={14} /> : o.dot && <span className={cn('size-2 rounded-full', o.dot)} />}
            {o.label ?? o.value}
          </button>
        );
      })}
    </div>
  );
}

// Avatar do preview: anel azul (lead em prospecção) reusando o RingAvatar do
// #123; estado vazio (sem nome) = círculo cinza com travessão.
function LeadAvatar({ name, size = 44 }) {
  if (name) return <RingAvatar name={name} size={size} toneName="brand" />;
  return (
    <div className="relative shrink-0" style={{ padding: 4 }}>
      <div
        className="rounded-full ring-[2.5px] ring-offset-[3px] ring-offset-white dark:ring-offset-[#0e1326]"
        style={{ '--tw-ring-color': '#cbd5e1', boxShadow: '0 0 0 6px #cbd5e155' }}
      >
        <div className="rounded-full grid place-items-center font-semibold bg-paper-200 text-slate-400" style={{ width: size, height: size, fontSize: size * 0.36 }}>–</div>
      </div>
    </div>
  );
}

// ---------- passo ----------
function StepDot({ state, n }) {
  if (state === 'done') {
    return <span className="size-7 rounded-full grid place-items-center shrink-0 bg-brand-600 text-white check-pop"><Check size={14} /></span>;
  }
  if (state === 'active') {
    return <span className="size-7 rounded-full grid place-items-center shrink-0 bg-white dark:bg-ink-900 ring-2 ring-brand-300 dark:ring-brand-500/40 text-brand-700 dark:text-brand-300 text-[12px] font-bold num">{n}</span>;
  }
  return <span className="size-7 rounded-full grid place-items-center shrink-0 bg-slate-100 dark:bg-white/[0.05] text-slate-400 dark:text-slate-500 text-[12px] font-bold num">{n}</span>;
}

// Trancado mostra só o título, feito vira resumo com Editar, aberto mostra as opções.
// `fixed` troca o "Editar" por um cadeado com esse texto: passo feito que não muda.
// `render` monta o corpo do passo, e só é chamado com o passo aberto.
function StepRow({ n, title, hint, state, summary, onEdit, fixed = null, isLast, render }) {
  return (
    // O passo aberto leva z-10: a animação de entrada (step-reveal, com transform)
    // dá ao passo uma camada própria, e sem isso o resumo de um passo feito logo
    // abaixo pintava por cima da lista de resultados do "Quem indicou?".
    <div className={cn('relative flex gap-3', state === 'active' && 'z-10')}>
      <div className="flex flex-col items-center">
        <StepDot state={state} n={n} />
        {!isLast && <div className={cn('conn w-px flex-1 my-1', state === 'done' ? 'bg-brand-600' : 'bg-slate-200 dark:bg-white/[0.08]')} />}
      </div>
      <div className={cn('flex-1 min-w-0', isLast ? 'pb-0' : 'pb-5')}>
        {state === 'locked' ? (
          <div className="pt-1 opacity-50 select-none text-[14px] font-semibold text-slate-400 dark:text-slate-500">{title}</div>
        ) : state === 'done' && fixed ? (
          <div className="sum-in w-full rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/70 dark:bg-white/[0.02] px-3.5 py-2.5 flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-[12px] font-medium text-slate-400 dark:text-slate-500">{title}</span>
              <span className="block text-[14px] font-semibold truncate mt-0.5 text-slate-700 dark:text-slate-200">{summary}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-400 shrink-0"><LockKeyhole size={12} /> {fixed}</span>
          </div>
        ) : state === 'done' ? (
          <button
            type="button" onClick={onEdit}
            className="sum-in w-full text-left group rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] px-3.5 py-2.5 hover:border-slate-300 dark:hover:border-white/10 transition flex items-center justify-between gap-3 focus-visible:anel-foco"
          >
            <span className="min-w-0">
              <span className="block text-[12px] font-medium text-slate-400 dark:text-slate-500">{title}</span>
              <span className="block text-[14px] font-semibold truncate mt-0.5 text-brand-700 dark:text-brand-300">{summary}</span>
            </span>
            <span className="text-[12px] font-medium text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 shrink-0">Editar</span>
          </button>
        ) : (
          <div className="step-reveal pt-0.5">
            <div className="mb-3">
              <div className="text-[15px] font-semibold text-slate-900 dark:text-white">{title}</div>
              {hint && <div className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{hint}</div>}
            </div>
            {render()}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- etiquetas ----------
function TagToggles({ tags, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(tags || []).map((tag) => {
        const t = settingsColorTone(tag.color);
        const on = selected.includes(tag.name);
        return (
          <button
            type="button"
            key={tag.id}
            onClick={() => onToggle(tag.name)}
            className={cn('h-8 px-3 rounded-lg text-[12.5px] font-medium inline-flex items-center gap-1.5 transition active:scale-[.97] focus-visible:anel-foco',
              on
                ? `${t.soft} ${t.darkSoft} ${t.text} ${t.darkText} ring-1 ${t.ring}`
                : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 dark:bg-white/[0.03] dark:text-slate-400 dark:border-white/[0.08]')}
          >
            {on ? <Check size={12} /> : <Plus size={12} className="opacity-60" />}{tag.name}
          </button>
        );
      })}
      {(tags || []).length === 0 && (
        <span className="text-[12.5px] text-slate-400 dark:text-slate-500">Nenhuma etiqueta cadastrada.</span>
      )}
    </div>
  );
}

const byOrder = (a, b) => (a.order || 0) - (b.order || 0);

// ==========================================================================
function AddLeadModal({ onClose, appUser, sources, statuses, tags, db, funnels, selectedFunnelId, onCreated, dores = [] }) {
  const toast = useToast();
  const { modalities = [] } = useGeneralConfig();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [createdId, setCreatedId] = useState(null);
  const [more, setMore] = useState(false);
  const phoneRef = useRef(null);
  const submitRef = useRef(null);
  const submittingRef = useRef(false);

  const safeFunnels = Array.isArray(funnels) ? funnels : [];
  // Porta de entrada do cadastro: a aba de funil aberta na tela, mas só quando
  // ela é um funil em que o lead PODE nascer. Ficam de fora o de Renovações
  // (sem etapa nenhuma, o lead nasceria com etapa vazia), Vencidos e Upgrade
  // (projetam clientes por query, o lead nunca apareceria em board nenhum) e
  // o "Todos os funis" do dashboard, que é um sentinel e não um funil. Nos
  // casos acima o cadastro cai no funil padrão em vez de abrir travado num
  // funil sem fase.
  const entryFunnelId = safeFunnels.some((f) => f.id === selectedFunnelId && !isRenewalFunnel(f) && !isExpiredFunnel(f) && !isUpgradeFunnel(f))
    ? selectedFunnelId
    : null;
  const initialFunnelId = entryFunnelId || getDefaultFunnel(safeFunnels)?.id || null;
  const initialStatuses = (statuses || []).filter((s) => s.funnelId === initialFunnelId).sort(byOrder);

  // Indicação: funil de sistema + etapa de entrada fixa. Sem eles (o admin
  // ainda não logou para a migração rodar), a origem Indicação é uma origem
  // comum e o cadastro segue idêntico ao normal.
  const referralFunnel = getReferralFunnel(safeFunnels);
  const referralEntry = getReferralEntryStage(statuses, referralFunnel?.id);
  const canReferral = Boolean(referralFunnel && referralEntry);
  // A origem que liga o modo indicação (funil Indicações e "Quem indicou?"): só
  // uma do catálogo (referralSourceOf), as outras com "indica" no nome são comuns.
  const referralSource = referralSourceOf(sources);
  // O funil de indicações não aparece nas opções de funil: só entra pela origem
  // Indicação. Renovações, Vencidos e Upgrade projetam CLIENTES e não recebem
  // lead novo (ele sumiria de todo board).
  const pickerFunnels = leadEntryFunnels(safeFunnels);
  // Modal aberto já na aba do funil de indicações → modo indicação nasce ligado.
  const initialIsReferral = canReferral && initialFunnelId === referralFunnel.id;

  // A origem nasce vazia: ela alimenta os painéis por origem, então uma origem
  // pré-escolhida em silêncio vira dado errado quando ninguém repara.
  const blankForm = () => ({
    name: '',
    whatsapp: '',
    isMinor: false,
    guardianName: '',
    guardianPhone: '',
    guardianRelation: '',
    source: initialIsReferral ? 'Indicação' : '',
    funnelId: initialFunnelId,
    status: initialIsReferral ? referralEntry.name : (initialStatuses?.[0]?.name || ''),
    tags: [],
    dor: '',
    modalidade: '',
    birthDate: '',
    cpf: '',
    sexo: '',
    email: '',
    observation: '',
  });
  const [form, setForm] = useState(blankForm);
  const [isReferral, setIsReferral] = useState(initialIsReferral);
  const [referrer, setReferrer] = useState(null);
  // Passos de texto (número, nome, responsável) só contam como feitos depois do
  // Continuar. Os de escolha (origem, dor) se completam no próprio clique.
  const [confirmed, setConfirmed] = useState({});
  const [editing, setEditing] = useState(null);
  // Fechar com algo preenchido pede confirmação (clique fora, Esc e o X).
  const [askDiscard, setAskDiscard] = useState(false);
  const lastFocus = useRef(null);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const statusObj = (statuses || []).find((s) => s.name === form.status && s.funnelId === form.funnelId)
    || (statuses || []).find((s) => s.name === form.status);
  const funnel = safeFunnels.find((f) => f.id === form.funnelId);
  const stageList = (statuses || []).filter((s) => s.funnelId === form.funnelId).sort(byOrder);

  const handleFunnel = (id) => {
    const next = (statuses || []).filter((s) => s.funnelId === id).sort(byOrder);
    setForm((f) => ({ ...f, funnelId: id, status: next[0]?.name || '' }));
  };
  const toggleTag = (name) =>
    setForm((f) => ({ ...f, tags: f.tags.includes(name) ? f.tags.filter((x) => x !== name) : [...f.tags, name] }));

  // Liga/desliga o modo indicação. Ligado trava funil (Indicações) e etapa
  // (entrada fixa) e guarda a origem escolhida. Desligado volta pro funil da
  // tela (ou o padrão), com a origem em branco.
  const setReferralMode = (on, sourceName) => {
    setIsReferral(on);
    setConfirmed((c) => ({ ...c, funil: false }));
    if (on) {
      setForm((f) => ({ ...f, funnelId: referralFunnel.id, status: referralEntry.name, source: sourceName || 'Indicação' }));
      return;
    }
    setReferrer(null);
    const backId =
      (entryFunnelId && entryFunnelId !== referralFunnel?.id ? entryFunnelId : null) ||
      getDefaultFunnel(pickerFunnels)?.id || null;
    const next = (statuses || []).filter((s) => s.funnelId === backId).sort(byOrder);
    setForm((f) => ({ ...f, funnelId: backId, status: next[0]?.name || '', source: '' }));
  };
  // Indicação é uma origem como as outras: escolher ela liga o modo indicação, e
  // escolher outra desliga.
  // Origem comum completa o passo no clique, então encerra o "Editar" (a
  // indicação só completa depois do "Quem indicou?", em pickReferrer).
  const pickSource = (name) => {
    if (canReferral && name === referralSource) {
      if (isReferral) {
        set({ source: name });
        // Voltou pelo Editar com o indicador já escolhido: não há mais o que
        // responder, então o passo fecha (sem indicador, ele espera a busca).
        if (referrer) setEditing(null);
      } else {
        setReferralMode(true, name);
      }
      return;
    }
    if (isReferral) setReferralMode(false);
    set({ source: name });
    setEditing(null);
  };
  const pickReferrer = (r) => {
    setReferrer(r);
    if (r) setEditing(null);
  };

  // O número do passo 1 é o do lead; com "menor de idade", é o do responsável.
  // Trocar a chave troca os dois campos de lugar: o número que está no passo 1
  // continua nele, e o outro (o WhatsApp do aluno, ou o do responsável guardado
  // enquanto a chave está desligada) fica à espera. Ligar e desligar de novo
  // devolve cada número ao seu lugar, sem perder nenhum. Com a chave desligada o
  // responsável não é gravado (buildGuardianPatch), então o número guardado é inofensivo.
  const setMinor = (on) => {
    setForm((f) => ({ ...f, isMinor: on, whatsapp: f.guardianPhone, guardianPhone: f.whatsapp }));
    // Data já mostra 18+: abre "Mais detalhes" para o nascimento aparecer.
    if (on && turnedAdult({ isMinor: true, birthDate: fromDateInputValue(form.birthDate) })) setMore(true);
  };

  const phoneDigits = onlyDigits(form.whatsapp);
  const phoneTooShort = phoneDigits.length > 0 && phoneDigits.length < 10;
  // Dup-check remoto (G1-flip / PR F): query pela chave do telefone, cobre todos
  // os buckets (cliente/perda também) em vez de varrer o prop global 'ativo'.
  const { duplicate, loading: dupLoading } = useDuplicateLead({ db, phoneDigits });
  const guardianDigits = onlyDigits(form.guardianPhone);
  // O aluno não pode ter o mesmo número do responsável: recria o problema que
  // a feature resolve (whatsappDigits/zapMatchKey do menor viram os da mãe).
  const sameAsGuardian = form.isMinor && sameContactPhone(form.whatsapp, form.guardianPhone);
  // Avisos que nunca barram: número de um responsável no campo do lead (o dono
  // do número já é o useDuplicateLead quem acha, por isso withOwner: false) e
  // número de alguém, dono ou responsável, no campo do responsável.
  const ownMatches = useGuardianMatches({ db, phoneDigits, withOwner: false });
  const guardianMatches = useGuardianMatches({ db, phoneDigits: form.isMinor ? guardianDigits : '' });
  const ownNotice = duplicate ? [] : phoneNoticeLines({ field: 'own', ...ownMatches });
  const guardianNotice = phoneNoticeLines({ field: 'guardian', ...guardianMatches });
  const guardianError = guardianIssue({
    isMinor: form.isMinor,
    name: form.guardianName,
    phone: form.guardianPhone,
    birthDate: fromDateInputValue(form.birthDate),
  });
  // Mensagem de maioridade calculada direto da data, sem depender da ordem de
  // checagem nem da redação de guardianError (que pode voltar outro motivo
  // primeiro, como nome vazio).
  const adultByDate = form.isMinor && turnedAdult({ isMinor: true, birthDate: fromDateInputValue(form.birthDate) });
  // Com a chave ligada o WhatsApp do aluno é opcional, mas, preenchido, precisa
  // estar completo.
  const ownPhoneOk = form.isMinor ? (phoneDigits.length === 0 || phoneDigits.length >= 10) : phoneDigits.length >= 10;
  const contactDigits = form.isMinor ? guardianDigits : phoneDigits;
  const contactTooShort = contactDigits.length > 0 && contactDigits.length < 10;
  const contactChecking = form.isMinor ? guardianMatches.pending : (dupLoading || ownMatches.pending);
  const contactValid = contactDigits.length >= 10 && (form.isMinor || !duplicate);
  const nameOk = form.name.trim().length > 1;
  const guardianNameOk = form.guardianName.trim().length > 1;
  const dorOk = form.dor.trim().length > 0;
  const sourceOk = !!form.source && (!isReferral || !!referrer);

  const flow = signupFlow({ isMinor: form.isMinor, withModality: modalities.length > 0 });
  const stepDone = {
    contato: Boolean(confirmed.contato) && contactValid,
    nome: Boolean(confirmed.nome) && nameOk,
    responsavel: Boolean(confirmed.responsavel) && guardianNameOk,
    // Academia sem origem no catálogo cadastra sem origem, depois do "Continuar
    // sem origem": quem cadastra pode não ter acesso a Configurações para criá-la.
    origem: (sources || []).length === 0 ? Boolean(confirmed.origem) : sourceOk,
    dor: dorOk,
    // Escolher a modalidade ou pular conta como feito: o valor pode ficar vazio.
    modalidade: Boolean(confirmed.modalidade),
    // Na indicação o destino é fixo e já está feito. Nos outros casos a pessoa
    // confirma a etapa, mesmo com o funil padrão já marcado.
    funil: isReferral || (Boolean(confirmed.funil) && !!form.funnelId && !!form.status),
  };
  const pending = firstOpenStep(flow, stepDone);
  const active = editing && flow.includes(editing) ? editing : pending;
  const canSubmit = pending === null && ownPhoneOk && !duplicate && !sameAsGuardian && !guardianError && !!form.funnelId;

  const stepState = (id) => (id === active ? 'active' : stepDone[id] ? 'done' : 'locked');
  const confirmStep = (id, valid) => {
    if (!valid) return;
    setConfirmed((c) => ({ ...c, [id]: true }));
    setEditing(null);
  };
  // Modalidade é opcional: um chip escolhe, "Pular" deixa vazio, e os dois fecham o passo.
  const pickModalidade = (v) => {
    set({ modalidade: v });
    setConfirmed((c) => ({ ...c, modalidade: true }));
    setEditing(null);
  };
  // Enter num campo de texto continua o passo. Ctrl/⌘+Enter é do envio.
  const onEnter = (id, valid) => (e) => {
    if (e.key !== 'Enter' || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    confirmStep(id, valid);
  };

  // Terminou o último passo, ou voltou num passo pelo Editar e o fechou: o foco
  // vai para o botão de cadastrar.
  const idle = pending === null && !editing;
  const wasIdle = useRef(false);
  useEffect(() => {
    if (idle && !wasIdle.current) submitRef.current?.focus();
    wasIdle.current = idle;
  }, [idle]);

  // O que impede o envio, na ordem em que a pessoa resolve.
  const statusLine = (() => {
    if (duplicate) return { tone: 'bad', text: 'Esse número já tem cadastro.' };
    if (pending) {
      const falta = missingText(flow, stepDone);
      return { tone: 'wait', text: `Falta ${isReferral && !referrer ? falta.replace('origem', 'quem indicou') : falta}.` };
    }
    if (sameAsGuardian) return { tone: 'bad', text: 'O WhatsApp do aluno é o do responsável.' };
    if (!ownPhoneOk) return { tone: 'wait', text: 'O WhatsApp do aluno está incompleto.' };
    if (guardianError) return { tone: 'bad', text: guardianError };
    if (!form.funnelId) return { tone: 'bad', text: 'Escolha um funil.' };
    return { tone: 'ok', text: 'Tudo certo para cadastrar.' };
  })();

  // Problema que mora em "Mais detalhes" abre a seção sozinho.
  const moreOpen = more || (form.isMinor && (adultByDate || sameAsGuardian || Boolean(duplicate) || (phoneTooShort && !pending)));

  // Qualquer coisa já digitada ou escolhida conta. O cadastro salvo não pede nada.
  const dirty = !saved && Boolean(
    phoneDigits || guardianDigits || form.name.trim() || form.guardianName.trim() || form.source || form.dor
    || form.modalidade || form.tags.length || form.cpf || form.email || form.birthDate || form.observation.trim()
  );
  const dismissDiscard = () => {
    setAskDiscard(false);
    // O foco volta para onde estava, senão ele se perde com o aviso que some.
    setTimeout(() => lastFocus.current?.focus?.(), 0);
  };
  const requestClose = () => {
    if (loading) return;
    if (askDiscard) { dismissDiscard(); return; }
    if (!dirty) { onClose(); return; }
    lastFocus.current = document.activeElement;
    setAskDiscard(true);
  };

  const reset = () => {
    setForm(blankForm());
    setMore(false);
    setIsReferral(initialIsReferral);
    setReferrer(null);
    setConfirmed({});
    setEditing(null);
    setSaved(false);
    setCreatedId(null);
    setTimeout(() => phoneRef.current?.focus(), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // canSubmit já exige funil, etapa e dor: os passos só fecham com eles.
    if (!canSubmit) return;
    const dup = await findDuplicateLeadRemote({ db, phoneDigits });
    if (dup) {
      const ownerLabel = dup.consultantName ? ` (consultor: ${dup.consultantName})` : '';
      const statusLabel = dup.status ? ` · etapa "${dup.status}"` : '';
      toast.warning(`Já existe um lead com este WhatsApp: ${dup.name}${ownerLabel}${statusLabel}.`);
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);

    try {
      const leadRef = await addDoc(
        collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH),
        {
          // O mesmo montador do cadastro pelo Stronizap (src/lib/newLead.js):
          // campo novo do lead entra lá e os dois cadastros gravam igual. As
          // datas do servidor ficam aqui, porque cada lado usa um SDK.
          ...buildNewLeadDoc(form, { owner: appUser, referrer: isReferral ? referrer : null }),
          createdAt: serverTimestamp(),
          statusEnteredAt: serverTimestamp(),
        }
      );

      // Eventos 🤝 dos dois lados + referredAt no indicado. Best-effort fora
      // do caminho crítico (padrão markConvertingAula): o vínculo em si já
      // está no doc criado acima.
      if (isReferral && referrer) {
        try {
          await commitReferralLink({
            db,
            lead: { id: leadRef.id, name: form.name.trim(), consultantId: appUser.id, consultantAuthUid: appUser.authUid },
            appUser,
            referrer
          });
        } catch (err) {
          console.error('commitReferralLink falhou', err);
        }
      }

      if (form.observation.trim()) {
        await logInteraction(
          db,
          { id: leadRef.id, consultantId: appUser.id, consultantAuthUid: appUser.authUid },
          appUser,
          {
            text: `OBSERVAÇÃO DO CADASTRO: ${form.observation}`,
            type: 'note',
          }
        );
      }

      setCreatedId(leadRef.id);
      setSaved(true);
    } catch (error) {
      console.error(error);
      toast.error?.('Erro ao cadastrar lead.');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  // Ctrl/⌘+Enter cadastra de qualquer campo.
  const onFormKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (canSubmit && !loading) handleSubmit(e);
    }
  };

  // ---------- corpo de cada passo ----------
  const continueBtn = (id, valid, label = 'Continuar') => (
    <div className="mt-4 flex justify-end">
      <button type="button" disabled={!valid} onClick={() => confirmStep(id, valid)} className={cn(BTN_PRIMARY, 'h-10 px-4')}>
        {label}
      </button>
    </div>
  );

  const numberResult = () => {
    if (contactDigits.length === 0) {
      return <p className="text-[13px] text-slate-500 dark:text-slate-400">Digite com o DDD. Eu confiro se a pessoa já está no sistema.</p>;
    }
    if (contactTooShort) {
      return <p className="text-[13px] text-amber-600 dark:text-amber-400">Número incompleto. Inclua DDD + 9 dígitos.</p>;
    }
    if (!form.isMinor && duplicate) {
      const where = [duplicate.status, duplicate.consultantName && `responsável ${duplicate.consultantName}`].filter(Boolean).join(' · ');
      return (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-300/70 bg-rose-50 p-3 dark:border-rose-500/30 dark:bg-rose-500/10">
          <Avatar name={duplicate.name} size={38} />
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-slate-900 dark:text-white truncate">{duplicate.name}</div>
            {where && <div className="text-[12px] text-slate-500 dark:text-slate-400 truncate">{where}</div>}
          </div>
          <LeadLink
            leadId={duplicate.id} onNavigate={onClose}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-800 hover:bg-slate-50 shrink-0 focus-visible:anel-foco dark:border-white/[0.12] dark:bg-white/[0.06] dark:text-white"
          >
            Abrir ficha <ExternalLink size={13} />
          </LeadLink>
        </div>
      );
    }
    if (contactChecking) {
      return (
        <p className="inline-flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400">
          <span className="size-3.5 rounded-full border-2 border-slate-300 border-t-brand-600 animate-spin" /> Conferindo se já existe…
        </p>
      );
    }
    const notice = form.isMinor ? guardianNotice : ownNotice;
    if (notice.length > 0) {
      return <div className="flex flex-col gap-0.5 text-[12.5px] text-slate-500 dark:text-slate-400">{notice.map((linha) => <span key={linha}>{linha}</span>)}</div>;
    }
    return (
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">
        <Check size={14} /> {form.isMinor ? 'Número do responsável anotado.' : 'Número novo. Ninguém tem esse WhatsApp ainda.'}
      </p>
    );
  };

  const stepBody = {
    contato: () => (
      <>
        <div className="relative">
          <input
            ref={phoneRef} type="tel" inputMode="numeric" autoComplete="off" autoFocus
            aria-label={STEP_TITLE.contato(form.isMinor)}
            value={formatPhone(form.isMinor ? form.guardianPhone : form.whatsapp)}
            onChange={(e) => set(form.isMinor ? { guardianPhone: formatPhone(e.target.value) } : { whatsapp: formatPhone(e.target.value) })}
            onKeyDown={onEnter('contato', contactValid && !contactChecking)}
            placeholder="(51) 9 0000-0000"
            className={cn(inputCls, 'h-14 text-[20px] font-display font-semibold tracking-tight num',
              !form.isMinor && duplicate ? 'pr-36 !border-rose-400 focus:!ring-rose-400/15' : 'pr-4',
              contactTooShort && '!border-amber-400')}
          />
          {!form.isMinor && duplicate && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[12.5px] font-semibold text-rose-600 dark:text-rose-400 pointer-events-none">Já cadastrado</span>
          )}
        </div>
        <div className="min-h-14 mt-3">{numberResult()}</div>
        <label className="mt-1 flex items-center justify-between gap-3 cursor-pointer">
          <span className="flex items-center gap-2.5 min-w-0">
            <span className={cn('size-8 rounded-lg grid place-items-center shrink-0', form.isMinor ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600 dark:bg-brand-500/12 dark:text-brand-300')}><Baby size={16} /></span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-slate-800 dark:text-slate-100 leading-tight">Menor de idade</span>
              <span className="block text-[12px] text-slate-500 dark:text-slate-400">Este número é do responsável</span>
            </span>
          </span>
          <Switch checked={form.isMinor} onCheckedChange={setMinor} aria-label="Menor de idade" />
        </label>
        {continueBtn('contato', contactValid && !contactChecking)}
      </>
    ),
    nome: () => (
      <>
        <input
          type="text" autoComplete="off" autoFocus aria-label={STEP_TITLE.nome(form.isMinor)}
          value={form.name} onChange={(e) => set({ name: e.target.value })}
          onKeyDown={onEnter('nome', nameOk)}
          placeholder="Nome completo" className={cn(inputCls, 'h-12 text-[15px]')}
        />
        {continueBtn('nome', nameOk)}
      </>
    ),
    responsavel: () => (
      <>
        <input
          type="text" autoComplete="off" autoFocus aria-label="Nome do responsável"
          value={form.guardianName} onChange={(e) => set({ guardianName: e.target.value })}
          onKeyDown={onEnter('responsavel', guardianNameOk)}
          placeholder="Nome de quem responde pelo aluno" className={cn(inputCls, 'h-12 text-[15px]')}
        />
        <div className="mt-4">
          <Label hint="opcional">Parentesco</Label>
          <div role="radiogroup" aria-label="Parentesco" className="flex flex-wrap gap-2">
            {GUARDIAN_RELATIONSHIPS.map((r) => (
              <button
                type="button" key={r} role="radio" aria-checked={form.guardianRelation === r}
                onClick={() => set({ guardianRelation: form.guardianRelation === r ? '' : r })}
                className={cn(chipCls(form.guardianRelation === r), 'h-9')}
              >
                {form.guardianRelation === r && <Check size={14} />}{r}
              </button>
            ))}
          </div>
        </div>
        {continueBtn('responsavel', guardianNameOk)}
      </>
    ),
    origem: () => (
      <>
        {(sources || []).length === 0 ? (
          <>
            <p className="text-[13px] text-slate-500 dark:text-slate-400">Nenhuma origem cadastrada. O gestor cria em Configurações → Origens. Dá para cadastrar sem origem.</p>
            {continueBtn('origem', true, 'Continuar sem origem')}
          </>
        ) : (
          <Chips
            label="Como chegou" autoFocusFirst
            options={(sources || []).map((s) => ({ value: s.name }))}
            value={form.source} onPick={pickSource}
          />
        )}
        {isReferral && (
          <div className="mt-4">
            <Label>Quem indicou?</Label>
            <ReferrerPicker db={db} value={referrer} onSelect={pickReferrer} autoFocus />
          </div>
        )}
      </>
    ),
    dor: () => (
      dores.length > 0 ? (
        <Chips
          label="Dor" autoFocusFirst
          options={dores.map((d) => ({ value: d.name }))}
          value={form.dor} onPick={(v) => { set({ dor: v }); setEditing(null); }}
        />
      ) : (
        <p className="text-[13px] text-slate-500 dark:text-slate-400">Nenhuma dor cadastrada. Adicione em Configurações → Catálogos → Dores.</p>
      )
    ),
    modalidade: () => (
      <>
        <Chips
          label="Modalidade de interesse" autoFocusFirst
          options={modalities.map((m) => ({ value: m.name }))}
          value={form.modalidade} onPick={pickModalidade}
        />
        <button
          type="button" onClick={() => pickModalidade('')}
          className="mt-3 rounded text-[13px] font-semibold text-slate-500 hover:text-slate-800 hover:underline dark:text-slate-400 dark:hover:text-slate-200 focus-visible:anel-foco"
        >Pular, ainda não sabe</button>
      </>
    ),
    // Funil e etapa à vista. Trocar de funil leva a etapa para a primeira dele, e
    // o passo só fecha no clique numa etapa (o funil padrão já vem marcado).
    funil: () => (
      <>
        <Label>Funil</Label>
        {pickerFunnels.length === 0 ? (
          <p className="text-[13px] text-slate-500 dark:text-slate-400">Nenhum funil disponível. Crie um em Configurações → Funil Pipeline.</p>
        ) : (
          <Chips
            label="Funil"
            options={pickerFunnels.map((f) => ({ value: f.id, label: f.name }))}
            value={form.funnelId} onPick={handleFunnel}
          />
        )}
        <div className="mt-4">
          <Label>Etapa em que entra</Label>
          {stageList.length === 0 ? (
            <p className="text-[13px] text-amber-600 dark:text-amber-400">Este funil ainda não tem etapas. Escolha outro funil.</p>
          ) : (
            <Chips
              label="Etapa" autoFocusSelected
              options={stageList.map((s) => ({ value: s.name, dot: settingsColorTone(s.color).strong }))}
              value={form.status}
              onPick={(v) => { set({ status: v }); setConfirmed((c) => ({ ...c, funil: true })); setEditing(null); }}
            />
          )}
        </div>
      </>
    ),
  };

  const summaryOf = {
    contato: () => formatPhone(form.isMinor ? form.guardianPhone : form.whatsapp),
    nome: () => form.name.trim(),
    responsavel: () => `${form.guardianName.trim()}${form.guardianRelation ? ` (${form.guardianRelation})` : ''}`,
    origem: () => (!form.source ? 'Sem origem' : referrer ? `${form.source} · ${referrer.name}` : form.source),
    dor: () => form.dor,
    modalidade: () => form.modalidade || 'Sem preferência',
    funil: () => (isReferral
      ? `${referralFunnel?.name || REFERRAL_FUNNEL_NAME} › ${referralEntry?.name}`
      : `${funnel?.name || ''} › ${form.status}`),
  };

  const stepNumber = Math.max(1, flow.indexOf(active) + 1);

  return (
    <Sheet open onOpenChange={(o) => { if (!o) requestClose(); }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        onOpenAutoFocus={(e) => { e.preventDefault(); phoneRef.current?.focus(); }}
        overlayClassName="z-[130] bg-ink-950/35"
        className="z-[130] w-full gap-0 p-0 sm:max-w-[468px] bg-white dark:bg-ink-900 border-slate-200 dark:border-white/[0.08] shadow-[0_0_60px_-20px_rgba(8,13,34,.55)] data-[state=open]:duration-300"
      >
        {saved ? (
          <>
            <SheetTitle className="sr-only">Lead cadastrado</SheetTitle>
            <SheetDescription className="sr-only">O lead foi cadastrado no funil.</SheetDescription>
            <SuccessView
              form={form} statusObj={statusObj} tags={tags} funnelName={funnel?.name} referrerName={referrer?.name}
              onClose={onClose}
              onView={() => { if (createdId && onCreated) onCreated(createdId); onClose(); }}
              onAgain={reset}
            />
          </>
        ) : (
          <form onSubmit={handleSubmit} onKeyDown={onFormKeyDown} autoComplete="off" inert={askDiscard} className="flex-1 min-h-0 flex flex-col">
            {/* cabeçalho */}
            <div className="flex items-start justify-between gap-3 px-7 pt-6">
              <div className="min-w-0">
                <SheetTitle className="font-display text-[24px] font-bold tracking-tight leading-tight">Novo lead</SheetTitle>
                <SheetDescription className="mt-1 text-[13.5px] text-slate-500 dark:text-slate-400 leading-snug">Cada passo libera o próximo.</SheetDescription>
              </div>
              <button
                type="button" onClick={requestClose} aria-label="Fechar"
                className="size-9 -mr-2 grid place-items-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-white/[0.06] transition focus-visible:anel-foco"
              ><X size={18} /></button>
            </div>

            {/* progresso: um segmento por passo */}
            <div className="flex gap-1.5 px-7 pt-4" aria-hidden="true">
              {flow.map((id) => (
                <span key={id} className={cn('h-1 flex-1 rounded-full transition-colors duration-300',
                  stepDone[id] ? 'bg-brand-600' : id === active ? 'bg-brand-300 dark:bg-brand-500/50' : 'bg-slate-200 dark:bg-white/[0.08]')} />
              ))}
            </div>
            <p className="sr-only" aria-live="polite">
              {active ? `Passo ${stepNumber} de ${flow.length}: ${STEP_TITLE[active](form.isMinor)}.` : 'Todos os passos feitos.'}
            </p>

            {/* passos */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain thin-scroll px-7 pt-6 pb-4">
              {flow.map((id, i) => (
                <StepRow
                  key={id} n={i + 1} state={stepState(id)} isLast={i === flow.length - 1}
                  title={STEP_TITLE[id](form.isMinor)} hint={STEP_HINT[id]}
                  summary={stepDone[id] ? summaryOf[id]() : ''}
                  fixed={id === 'funil' && isReferral ? 'Fixo na indicação' : null}
                  onEdit={() => setEditing(id)} render={stepBody[id]}
                />
              ))}

              {/* opcionais */}
              <div className="mt-7 pt-5 border-t border-slate-100 dark:border-white/[0.06]">
                <button
                  type="button" onClick={() => setMore((m) => !m)} aria-expanded={moreOpen}
                  className="flex w-full items-center gap-2 text-left rounded-lg focus-visible:anel-foco"
                >
                  <ChevronRight size={15} className={cn('text-brand-600 dark:text-brand-300 transition shrink-0', moreOpen && 'rotate-90')} />
                  <span className="text-[13.5px] font-semibold text-brand-700 dark:text-brand-300">Mais detalhes</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-500 dark:text-slate-400">etiquetas, nascimento, CPF, e-mail e observação</span>
                </button>
                {moreOpen && (
                  <div className="mt-4 flex flex-col gap-4 fade-in">
                    {form.isMinor && (
                      <div>
                        <Label hint="opcional">WhatsApp do aluno</Label>
                        <IconInput
                          type="tel" inputMode="numeric" icon={<Baby size={15} />}
                          value={formatPhone(form.whatsapp)} onChange={(e) => set({ whatsapp: formatPhone(e.target.value) })}
                          placeholder="(51) 9 0000-0000"
                          className={duplicate ? '!border-rose-400 focus:!ring-rose-400/15' : ((phoneTooShort || sameAsGuardian) ? '!border-amber-400' : '')}
                        />
                        {duplicate ? (
                          <div className="mt-1.5 flex items-start gap-1.5 text-[11.5px] text-rose-600 dark:text-rose-400">
                            <AlertTriangle size={13} className="mt-0.5 shrink-0" /><span>Já existe: <strong>{duplicate.name}</strong>{duplicate.consultantName ? ` · ${duplicate.consultantName}` : ''}{duplicate.status ? ` (${duplicate.status})` : ''}</span>
                          </div>
                        ) : sameAsGuardian ? (
                          <div className="mt-1.5 flex items-start gap-1.5 text-[11.5px] text-amber-600 dark:text-amber-400">
                            <AlertTriangle size={13} className="mt-0.5 shrink-0" /><span>Esse é o telefone do responsável. Se o aluno não tem WhatsApp próprio, deixe em branco.</span>
                          </div>
                        ) : phoneTooShort ? (
                          <div className="mt-1.5 text-[11.5px] text-amber-600 dark:text-amber-400">Número incompleto. Inclua DDD + 9 dígitos.</div>
                        ) : ownNotice.length > 0 ? (
                          <div className="mt-1.5 text-[11.5px] text-muted-foreground">{ownNotice[0]}</div>
                        ) : null}
                      </div>
                    )}

                    <div>
                      <Label hint={`${form.tags.length} selecionada${form.tags.length === 1 ? '' : 's'}`}>Etiquetas</Label>
                      <TagToggles tags={tags} selected={form.tags} onToggle={toggleTag} />
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <Label hint="opcional">Nascimento</Label>
                        <IconInput type="date" icon={<Calendar size={15} />} value={form.birthDate} onChange={(e) => set({ birthDate: e.target.value })} />
                      </div>
                      <div>
                        <Label hint="opcional">CPF</Label>
                        <IconInput icon={<IdCard size={15} />} value={form.cpf} onChange={(e) => set({ cpf: fmtCPF(e.target.value) })} inputMode="numeric" placeholder="000.000.000-00" />
                      </div>
                      <div>
                        <Label hint="opcional">Sexo</Label>
                        <Select value={form.sexo} onChange={(e) => set({ sexo: e.target.value })} aria-label="Sexo">
                          <option value="">Selecione…</option>
                          <option value="Feminino">Feminino</option>
                          <option value="Masculino">Masculino</option>
                          <option value="Outro">Outro</option>
                        </Select>
                      </div>
                      <div>
                        <Label hint="opcional">E-mail</Label>
                        <IconInput type="email" icon={<Mail size={15} />} value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="email@exemplo.com" />
                      </div>
                    </div>
                    {adultByDate && (
                      <div className="flex items-start gap-1.5 text-[11.5px] text-amber-600 dark:text-amber-400">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0" /><span>Pela data, já tem 18 anos. Confira a data ou desligue a chave Menor de idade.</span>
                      </div>
                    )}

                    <div>
                      <Label hint="opcional">Observação</Label>
                      <textarea
                        value={form.observation} onChange={(e) => set({ observation: e.target.value })}
                        placeholder="Algum detalhe importante para o primeiro atendimento?" autoComplete="off"
                        className={cn(inputCls, '!h-auto py-3 resize-none leading-relaxed')} rows={2}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* rodapé: o que falta e o envio */}
            <div className="border-t border-slate-200/80 dark:border-white/[0.07] px-7 pt-3.5 pb-5">
              <div className="flex items-center justify-between gap-3">
                <p role="status" className={cn('flex items-center gap-2 min-w-0 text-[13px]',
                  statusLine.tone === 'bad' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300')}>
                  <span className={cn('size-2 rounded-full shrink-0', statusLine.tone === 'ok' ? 'bg-emerald-500' : statusLine.tone === 'bad' ? 'bg-rose-500' : 'bg-amber-500')} />
                  <span className="min-w-0">{statusLine.text}</span>
                </p>
                <button ref={submitRef} type="submit" disabled={!canSubmit || loading} className={cn(BTN_PRIMARY, 'shrink-0')}>
                  {loading
                    ? <><span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin"></span> Salvando…</>
                    : <>Cadastrar lead <kbd className="hidden sm:inline font-sans text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-white/20">{SUBMIT_KEYS}</kbd></>}
                </button>
              </div>
            </div>
          </form>
        )}

        {askDiscard && (
          <div
            role="alertdialog" aria-labelledby="descartar-titulo" aria-describedby="descartar-texto"
            className="absolute inset-0 z-30 grid place-items-center bg-white/85 px-7 backdrop-blur-[2px] dark:bg-ink-900/85"
          >
            <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-card-lg dark:border-white/[0.08] dark:bg-ink-800">
              <h3 id="descartar-titulo" className="font-display text-[18px] font-bold tracking-tight">Descartar este cadastro?</h3>
              <p id="descartar-texto" className="mt-1 text-[13.5px] text-slate-500 dark:text-slate-400">O que você já preencheu vai ser perdido.</p>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button type="button" autoFocus onClick={dismissDiscard} className={cn(BTN_PRIMARY, 'h-10 px-4')}>Continuar cadastrando</button>
                <button
                  type="button" onClick={onClose}
                  className="h-10 rounded-xl px-4 text-[13.5px] font-semibold text-rose-600 transition hover:bg-rose-50 focus-visible:anel-foco dark:text-rose-400 dark:hover:bg-rose-500/10"
                >Descartar</button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Tela de sucesso ──
// Um comprovante, na linguagem dos passos: o nome em destaque e, embaixo, o que
// foi gravado, linha a linha. É assim que a pessoa confere o destino do lead sem
// reabrir o formulário. Alinhada ao topo e com o rodapé fixo, como o formulário,
// para a gaveta não mudar de forma quando o cadastro termina.
function SuccessView({ form, statusObj, tags, funnelName, referrerName, onClose, onView, onAgain }) {
  const tone = statusObj ? settingsColorTone(statusObj.color) : settingsColorTone('slate');
  const phone = form.isMinor ? form.guardianPhone : form.whatsapp;
  const rows = [
    ['Entra em', (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>{funnelName || 'Sem funil'}</span>
        <ChevronRight size={14} className="text-slate-400" />
        <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold', tone.soft, tone.text, tone.darkSoft, tone.darkText)}>
          <span className={cn('size-1.5 rounded-full', tone.strong)} />{form.status}
        </span>
      </span>
    )],
    ['Origem', !form.source ? 'Sem origem' : referrerName ? `${form.source} · ${referrerName}` : form.source],
    ['Dor', form.dor],
    form.modalidade && ['Modalidade', form.modalidade],
    form.isMinor && ['Responsável', `${form.guardianName.trim()}${form.guardianRelation ? ` (${form.guardianRelation})` : ''}`],
    form.tags.length > 0 && ['Etiquetas', (
      <span className="flex flex-wrap gap-1.5">
        {form.tags.map((name) => {
          const tg = (tags || []).find((x) => x.name === name);
          const tt = settingsColorTone(tg ? tg.color : 'slate');
          return <span key={name} className={cn('rounded-md px-2 py-0.5 text-[12px] font-semibold', tt.soft, tt.text, tt.darkSoft, tt.darkText)}>{name}</span>;
        })}
      </span>
    )],
    ['Consultor', 'Você'],
  ].filter(Boolean);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 px-7 pt-6">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">
          <span className="check-pop grid size-6 place-items-center rounded-full bg-emerald-500 text-white"><Check size={14} /></span>
          Lead cadastrado
        </span>
        <button
          type="button" onClick={onClose} aria-label="Fechar"
          className="-mr-2 grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:anel-foco dark:hover:bg-white/[0.06] dark:hover:text-white"
        ><X size={18} /></button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain thin-scroll px-7 pb-4 pt-8">
        <div className="fade-in flex items-center gap-4">
          <LeadAvatar name={form.name} size={56} />
          <div className="min-w-0">
            <h3 className="break-words font-display text-[28px] font-bold leading-tight tracking-tight">{form.name.trim()}</h3>
            <p className="num mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-slate-500 dark:text-slate-400">
              {formatPhone(phone)}
              {form.isMinor && <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[12px] font-semibold text-brand-700 dark:bg-brand-500/12 dark:text-brand-300">Menor de idade</span>}
            </p>
          </div>
        </div>

        <dl className="mt-8 border-t border-slate-100 dark:border-white/[0.06]">
          {rows.map(([label, value], i) => (
            <div
              key={label} style={{ animationDelay: `${i * 50}ms` }}
              className="opt-in grid grid-cols-[96px_minmax(0,1fr)] gap-3 border-b border-slate-100 py-3.5 dark:border-white/[0.06]"
            >
              <dt className="text-[13px] text-slate-500 dark:text-slate-400">{label}</dt>
              <dd className="min-w-0 break-words text-[14px] font-semibold text-slate-900 dark:text-white">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200/80 px-7 pb-5 pt-3.5 dark:border-white/[0.07]">
        <button
          type="button" onClick={onView}
          className="h-11 rounded-xl bg-slate-100 px-5 text-[13.5px] font-semibold text-slate-700 transition hover:bg-slate-200 focus-visible:anel-foco dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/[0.1]"
        >Ver ficha</button>
        <button type="button" onClick={onAgain} autoFocus className={BTN_PRIMARY}>Cadastrar outro</button>
      </div>
    </div>
  );
}

export { AddLeadModal };
