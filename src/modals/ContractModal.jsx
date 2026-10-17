import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { AlertTriangle, Calendar, Check, Clock, GraduationCap, Link2, RefreshCw, Search, X } from 'lucide-react';
import { buildMatriculaWrites, computeEndsAt, liveRenewalOf, renewalStartProblem } from '../lib/contracts.js';
import { commitMatricula } from '../lib/contractsWrites.js';
import { calendarDaysBetween, fromDateInputValue, getSafeDateOrNull, toDateInputValue } from '../lib/dates.js';
import { fmtBRL } from '../lib/format.js';
import { confirmBlockOf, reasonHintOf, startStatusOf } from '../lib/contractModalView.js';
import {
  DISCOUNT_MODES,
  DISCOUNT_REASONS,
  SEAM_KIND,
  computeDiscount,
  computeSeam,
  daysBetween,
  plansWithSales,
  searchPlans,
  seamStart,
  seamWarning,
  topSellingPlans
} from '../lib/renewal.js';
import { cn } from '../lib/utils.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog.jsx';

// Modal de MATRÍCULA e RENOVAÇÃO — o mesmo desenho para as duas decisões, que
// no fundo são a mesma: qual plano, quando começa, por quanto. Antes eram três
// campos empilhados num max-w-md que não sabiam qual dos dois estavam fazendo;
// na renovação, o início nascia em `new Date()` e criava contrato sobreposto
// sempre que ela era fechada antes do vencimento.
//
// A aritmética vive em lib/renewal.js; a gravação, em lib/contractsWrites.js.
// Entre os modos mudam: o contexto do cabeçalho, a opção de emendar (só existe
// com contrato vigente), os avisos e a lista do que será gravado.

const shortId = (id) => (id ? String(id).slice(0, 8).toUpperCase() : '');
const fmtDate = (d) => (d ? d.toLocaleDateString('pt-BR') : '—');
const monthsLabel = (n) => (Number(n) === 1 ? '1 mês' : `${Number(n) || 0} meses`);
const monthlyLabel = (value, months) => (Number(months) > 0 ? `${fmtBRL(Number(value) / Number(months))} por mês` : '—');
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const daysLabel = (n) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

// Aviso do contrato que já tem renovação de pé: qual é e onde ver. O plano ou a
// data que faltarem saem da frase.
const renewedAlreadyText = (renewal) => {
  const start = getSafeDateOrNull(renewal?.startsAt);
  const when = start
    ? `${calendarDaysBetween(start, new Date()) > 0 ? 'começou' : 'começa'} em ${fmtDate(start)}`
    : '';
  const detail = [renewal?.planName ? `Plano ${renewal.planName}` : '', when].filter(Boolean).join(', ');
  return `Este contrato já foi renovado${detail ? ` (${detail})` : ''}. Abra a ficha do cliente para ver o contrato novo.`;
};

// Cabeça de cada seção: título, uma linha de apoio e, à direita, o controle da
// seção (a busca de plano, a data de "Outra data", o valor do desconto).
const SectionHead = ({ title, hint, hintLive = false, children }) => (
  <div className="flex min-h-9 items-start justify-between gap-4 mb-2.5">
    <div className="min-w-0">
      <h3 className="text-[14.5px] font-semibold leading-tight">{title}</h3>
      {hint && <p aria-live={hintLive ? 'polite' : undefined} className="mt-0.5 text-[12.5px] text-muted-foreground">{hint}</p>}
    </div>
    {children}
  </div>
);

// Etiqueta em pílula, minúscula. Texto no passo 700 no claro e 300/400 no escuro.
const Chip = ({ tone = 'amber', children }) => (
  <span className={cn(
    'inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold whitespace-nowrap',
    tone === 'amber' && 'bg-amber-500/12 text-amber-800 dark:bg-amber-500/16 dark:text-amber-400',
    tone === 'success' && 'bg-emerald-500/10 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400',
    tone === 'brand' && 'bg-brand-50 text-brand-700 dark:bg-brand-500/18 dark:text-brand-300',
    tone === 'slate' && 'bg-slate-500/10 text-slate-600 dark:bg-slate-400/15 dark:text-slate-300'
  )}>{children}</span>
);

// Faixa embaixo das opções de início: a vigência, ou o aviso do encaixe. Reserva
// três linhas, o máximo que os avisos de sobreposição e da regra dos dois dias
// ocupam, então o modal não pula quando o texto muda. A faixa visível e o texto do
// rodapé atualizam na hora, mas ficam escondidos do leitor de tela (aria-hidden) e
// não são regiões vivas: digitando a data, cada pedaço é uma data válida e o texto
// muda a cada tecla. Quem fala é um anunciador só, sr-only e sempre montado (o
// leitor só anuncia a troca de texto de uma região que já existia), que recebe o
// texto da faixa e o do rodapé, sem repetir, depois de uma pausa: só o final é lido.
const ANNOUNCE_DELAY_MS = 700;
const STATUS_TONE = {
  ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  warn: 'border border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200',
  bad: 'border border-rose-300/60 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300'
};
function StartStatus({ tone, text }) {
  const Icon = tone === 'ok' ? Check : AlertTriangle;
  return (
    <div
      data-slot="start-status"
      aria-hidden="true"
      className={cn('mt-2.5 flex min-h-[78px] items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] leading-[1.45]', STATUS_TONE[tone])}
    >
      <Icon size={16} className="flex-none" />
      <p className="min-w-0 text-pretty">{text}</p>
    </div>
  );
}

// O anunciador do modal. Começa com o texto de agora: o que já estava na tela ao
// abrir não é um anúncio novo.
function Announcer({ text }) {
  const [announced, setAnnounced] = useState(text);
  useEffect(() => {
    const timer = setTimeout(() => setAnnounced(text), ANNOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);
  return <div data-slot="contract-announcer" role="status" className="sr-only">{announced}</div>;
}

// Texto de apoio sobre o fundo brand-50 do item marcado: text-muted-foreground
// dá cerca de 4,2:1 ali, e o slate-600 passa dos 4,5:1. No escuro fica o de antes.
const SUPPORT_ON = 'text-slate-600 dark:text-muted-foreground';

// Teclado de um grupo de rádios (padrão ARIA), dos dois grupos do modal. As setas
// movem o foco para o próximo ou o anterior, com volta; Home e End vão às pontas.
// Com Shift, Ctrl, Alt ou Meta não faz nada, para o navegador agir. `ids` é a
// ordem dos rádios na tela. Com `pick`, o rádio que recebe o foco também é
// escolhido (ativação automática, o Início); sem ele, só o foco anda e Enter,
// Espaço ou o clique escolhem (ativação manual, o Plano).
const RADIO_STEP = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
const radioKeyDown = (ids, pick) => (e) => {
  if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
  const radios = [...e.currentTarget.querySelectorAll('[role="radio"]')];
  const at = radios.indexOf(e.target);
  if (at < 0 || radios.length !== ids.length) return;
  let to;
  if (e.key in RADIO_STEP) to = (at + RADIO_STEP[e.key] + radios.length) % radios.length;
  else if (e.key === 'Home') to = 0;
  else if (e.key === 'End') to = radios.length - 1;
  else return;
  e.preventDefault();
  radios[to].focus();
  pick?.(ids[to]);
};
// Quem fica no Tab: o marcado, ou o primeiro quando nenhum dos mostrados está marcado.
const tabStopId = (ids, selectedId) => (ids.includes(selectedId) ? selectedId : ids[0] ?? null);

// Uma linha da lista de planos. O seletor redondo é só desenho: a linha inteira
// é o botão, com role="radio" para o leitor de tela.
function PlanRow({ plan, on, tabStop, tag, onPick, onFocus }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      tabIndex={tabStop ? 0 : -1}
      onFocus={() => onFocus(plan.id)}
      onClick={() => onPick(plan.id)}
      className={cn(
        'grid min-h-[52px] w-full grid-cols-[18px_minmax(0,1fr)_62px_88px] items-center gap-3 px-3.5 py-2 text-left transition',
        'focus-visible:outline-none focus-visible:anel-foco focus-visible:ring-inset',
        on ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]'
      )}
    >
      <span className={cn('relative size-[18px] rounded-full border-[1.5px] bg-card', on ? 'border-brand-600 dark:border-brand-400' : 'border-slate-500 dark:border-slate-400')}>
        {on && <span className="absolute inset-[3px] rounded-full bg-brand-600 dark:bg-brand-400" />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className={cn('truncate text-[13.5px] font-semibold', on && 'text-brand-700 dark:text-brand-300')}>{plan.name}</span>
          {tag && <Chip tone={tag.tone}>{tag.label}</Chip>}
        </span>
        <span className={cn('num block text-[12px]', on ? SUPPORT_ON : 'text-muted-foreground')}>{monthlyLabel(plan.value, plan.durationMonths)}</span>
      </span>
      <span className={cn('num text-right text-[12.5px]', on ? SUPPORT_ON : 'text-muted-foreground')}>{monthsLabel(plan.durationMonths)}</span>
      <span className={cn('num text-right font-display text-[15px] font-bold', on && 'text-brand-700 dark:text-brand-300')}>{fmtBRL(plan.value)}</span>
    </button>
  );
}

// Um cartão das opções de início.
function StartCard({ option, on, tabStop, onPick }) {
  const { Icon } = option;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      tabIndex={tabStop ? 0 : -1}
      title={option.tip}
      onClick={() => onPick(option.id)}
      className={cn(
        'flex min-w-0 items-center gap-2.5 rounded-xl border-[1.5px] py-2.5 pl-2.5 pr-3 text-left transition',
        'focus-visible:outline-none focus-visible:anel-foco',
        on
          ? 'border-brand-600 bg-brand-50 dark:border-brand-500 dark:bg-brand-500/15'
          : 'border-border bg-card hover:border-brand-200 dark:hover:border-brand-500/45'
      )}
    >
      <span className={cn('grid size-[30px] flex-none place-items-center rounded-[9px]', on ? 'bg-brand-600 text-white' : 'bg-slate-100 text-muted-foreground dark:bg-white/[0.06]')}>
        <Icon size={15} />
      </span>
      <span className="min-w-0">
        <span className={cn('block truncate text-[13.5px] font-semibold', on && 'text-brand-700 dark:text-brand-300')}>{option.label}</span>
        <span className={cn('num block truncate text-[12.5px]', on ? SUPPORT_ON : 'text-muted-foreground')}>{option.hint}</span>
      </span>
    </button>
  );
}

function ContractModal({
  lead: liveLead,
  appUser,
  db,
  mode = 'matricula',
  currentContract: liveCurrentContract = null,
  renewedFromId: liveRenewedFromId = null,
  onClose,
  onDone
}) {
  const toast = useToast();
  const { planos: livePlanos, contratos: liveContratos } = useGeneralConfig();
  const isRenewal = mode === 'renovacao';

  // O que vem de fora do modal, congelado ao confirmar, como o sentUndo do
  // ContractOutcomeModal. A escrita local chega às listas antes de o servidor
  // confirmar: no Kanban e na Meta Diária, `contratos` já traz a renovação nova
  // enquanto o lead da lista ainda aponta para o contrato renovado, e na ficha
  // o lead passa para o contrato novo. Sem isto, o modal mostrava "Este
  // contrato já foi renovado" ou a regra dos dois dias ao lado de
  // "Salvando...". Tudo o que a tela mostra sai daqui. Se a gravação falha, o
  // modal volta a seguir os dados de agora; se dá certo, fica assim até fechar.
  const [sent, setSent] = useState(null);
  const { lead, currentContract, renewedFromId, planos, contratos } = sent || {
    lead: liveLead,
    currentContract: liveCurrentContract,
    renewedFromId: liveRenewedFromId,
    planos: livePlanos,
    contratos: liveContratos
  };

  // Só planos ATIVOS entram; inativos seguem no histórico de contratos.
  const activePlans = useMemo(
    () => plansWithSales(
      (planos || []).filter(p => p.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0)),
      contratos
    ),
    [planos, contratos]
  );
  const topPlans = useMemo(() => topSellingPlans(activePlans, 3), [activePlans]);

  // O documento do contrato atual: a ficha passa, e a Meta Diária e o Kanban
  // não. Sem ele, a renovação não encurta nada (commitMatricula).
  const currentDoc = currentContract || (contratos || []).find(c => c.id === lead?.currentContractId) || null;

  // Contrato de referência: o vigente na renovação, o encerrado na nova
  // matrícula de quem já foi cliente. Na renovação, fim, início e status saem
  // do mesmo documento que a gravação usa, e na mesma condição
  // (buildMatriculaWrites): o Kanban e a Meta Diária passam o lead da lista, e
  // o resumo dele pode estar velho. Sem esse documento, e na matrícula, vale o
  // resumo do lead. O doc do chamador também dá a duração exata do comparativo.
  const refDoc = isRenewal && currentDoc?.id && currentDoc.id === lead?.currentContractId ? currentDoc : null;
  const refEnd = getSafeDateOrNull(refDoc ? refDoc.endsAt : lead?.currentContractEndsAt);
  // Importado pode vir sem início, e aí vale a criação, como na gravação.
  const refStart = refDoc
    ? getSafeDateOrNull(refDoc.startsAt) || getSafeDateOrNull(refDoc.createdAt)
    : getSafeDateOrNull(lead?.currentContractStartsAt);
  const refStatus = refDoc ? refDoc.status : lead?.currentContractStatus;
  const refValue = Number(lead?.currentContractValue) || 0;
  const refMonths = Number(currentContract?.durationMonths)
    || (refStart && refEnd ? Math.max(1, Math.round(daysBetween(refStart, refEnd) / 30.44)) : 0);
  const refDaysLeft = refEnd ? Math.ceil((refEnd.getTime() - Date.now()) / 86400000) : null;
  // Emendar só faz sentido com contrato VIGENTE — numa nova matrícula depois de
  // um contrato vencido a lacuna já aconteceu, e datar no passado não a desfaz.
  const emendaDate = isRenewal ? seamStart(refEnd) : null;

  // A renovação começa oferecendo o plano que o cliente já tem; a matrícula, o
  // mais vendido.
  const initialPlan = (isRenewal && activePlans.find(p => p.name === lead?.currentPlanName))
    || topPlans[0]
    || activePlans[0]
    || null;

  const [planId, setPlanId] = useState(initialPlan?.id || '');
  const [planSearch, setPlanSearch] = useState('');
  const searchRef = useRef(null);
  // O rádio do Plano que tem o foco: o Tab itinerante acompanha o foco enquanto as
  // setas o movem sem escolher.
  const [focusedPlanId, setFocusedPlanId] = useState(null);
  const dateRef = useRef(null);
  const [startMode, setStartMode] = useState(emendaDate ? 'emendar' : 'hoje');
  const [customStart, setCustomStart] = useState(toDateInputValue(emendaDate || new Date()));
  const [discountMode, setDiscountMode] = useState(DISCOUNT_MODES.NENHUM);
  const [discountInput, setDiscountInput] = useState('');
  const [reason, setReason] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // A falha ao gravar aparece dentro do modal: com ele aberto o Radix esconde o
  // resto da página do leitor de tela, e o toast fica de fora. Sai assim que a
  // pessoa mexe em plano, início, desconto ou motivo (ajuste de estado no render,
  // sem effect) e a cada nova tentativa.
  const [saveError, setSaveError] = useState(false);
  const formKey = [planId, startMode, customStart, discountMode, discountInput, reason].join('|');
  const [seenFormKey, setSeenFormKey] = useState(formKey);
  if (formKey !== seenFormKey) {
    setSeenFormKey(formKey);
    setSaveError(false);
  }

  const plan = activePlans.find(p => p.id === planId) || null;
  const planMonths = Number(plan?.durationMonths) || 0;
  const listValue = Number(plan?.value) || 0;

  // Fora dos 3 mais vendidos, o plano escolhido entra como quarto cartão.
  const cards = plan && !topPlans.some(p => p.id === plan.id) ? [...topPlans, plan] : topPlans;
  const results = searchPlans(activePlans, planSearch);
  const searchOpen = Boolean(planSearch.trim());

  const today = new Date();
  const startsAt = startMode === 'emendar' ? emendaDate
    : startMode === 'hoje' ? today
      : fromDateInputValue(customStart);
  const endsAt = plan && startsAt ? computeEndsAt(startsAt, planMonths) : null;

  const { finalValue, discountValue, discountPct, hasDiscount } = computeDiscount({
    listValue, mode: discountMode, input: discountInput
  });

  // O contrato renovado: o mesmo id que a gravação recebe.
  const renewFromId = isRenewal ? (renewedFromId || lead?.currentContractId || null) : null;
  // Prévia do que a gravação faz com o contrato atual, pela própria função que
  // grava (buildMatriculaWrites é pura). É dela que sai se o atual é encurtado e
  // até quando: a tela não refaz essa conta.
  const previewFor = (at) => buildMatriculaWrites({
    lead, plan, value: finalValue, startsAt: at, appUser, mode, renewedFromId: renewFromId, previousContract: currentDoc
  });
  const shortenTo = isRenewal && plan && startsAt ? previewFor(startsAt).previousPatch?.endsAt || null : null;

  // Renovação: o encaixe com o contrato atual. Matrícula: só o desvio de hoje.
  const seam = isRenewal ? computeSeam(refEnd, startsAt) : null;
  const offsetDays = startsAt ? (calendarDaysBetween(startOfToday(), startsAt) || 0) : 0;
  // Na sobreposição, o aviso só promete encurtar o contrato atual quando a
  // gravação encurta. Sem o documento dele, ou com ele já encurtado por outra
  // renovação, os dois contratos valem juntos.
  const warning = isRenewal
    ? seam?.kind === SEAM_KIND.SOBREPOSICAO && !shortenTo
      ? `O contrato atual continua até ${fmtDate(refEnd)}, e os dois valem juntos por ${daysLabel(seam.overlapDays)}.`
      : seamWarning(seam, startsAt)
    : offsetDays < 0
      ? `Matrícula retroativa. A vigência começa em ${fmtDate(startsAt)}, então ${Math.abs(offsetDays)} ${Math.abs(offsetDays) === 1 ? 'dia já terá passado' : 'dias já terão passado'} quando o contrato for criado.`
      : offsetDays > 0
        ? `A vigência só começa em ${fmtDate(startsAt)}. Até lá, o cliente não conta como ativo nos relatórios.`
        : null;
  const warningIsSevere = isRenewal && seam?.kind === SEAM_KIND.SOBREPOSICAO;

  // Renovação que não pode ser gravada: contrato trancado, início a menos de
  // dois dias do início do contrato renovado, ou contrato que já foi renovado
  // (o lead da lista do Kanban e da Meta Diária ainda pode apontar para ele).
  const liveRenewal = isRenewal ? liveRenewalOf(renewFromId, contratos) : null;
  const startProblem = isRenewal
    ? renewalStartProblem({ status: refStatus, startsAt: refStart }, startsAt)
      || (liveRenewal ? renewedAlreadyText(liveRenewal) : null)
    : null;

  // Cartão "Hoje": quantos dias do contrato atual ele toma, em dias do
  // calendário, e se a gravação encurtaria o atual com início hoje.
  const todaySeam = isRenewal && refEnd ? computeSeam(refEnd, today) : null;
  const todayOverlap = todaySeam?.kind === SEAM_KIND.SOBREPOSICAO ? todaySeam.overlapDays : 0;
  const todayShortens = Boolean(todayOverlap && plan && previewFor(today).previousPatch);

  const newMonthly = planMonths > 0 ? finalValue / planMonths : 0;
  const oldMonthly = refMonths > 0 ? refValue / refMonths : 0;
  const deltaPct = oldMonthly > 0 ? Math.round(((newMonthly - oldMonthly) / oldMonthly) * 100) : 0;

  // Escala comum das duas vigências: do início mais antigo ao término mais
  // distante. A sobreposição aparece como barras que se cruzam. Quando a
  // gravação encurta o atual, a barra dele para no fim novo, e o trecho até o
  // fim de antes são os dias que ele perde. A escala continua indo até o fim de
  // antes, para as duas barras seguirem alinhadas.
  const bars = (() => {
    if (!isRenewal || !refStart || !refEnd || !startsAt || !endsAt) return null;
    const t0 = Math.min(refStart.getTime(), startsAt.getTime());
    const t1 = Math.max(refEnd.getTime(), endsAt.getTime());
    const span = Math.max(t1 - t0, 1);
    const pos = (d) => Math.max(0, Math.min(100, ((d.getTime() - t0) / span) * 100));
    const curEnd = shortenTo || refEnd;
    return {
      curLeft: pos(refStart), curWidth: pos(curEnd) - pos(refStart),
      lostLeft: pos(curEnd), lostWidth: pos(refEnd) - pos(curEnd),
      newLeft: pos(startsAt), newWidth: pos(endsAt) - pos(startsAt)
    };
  })();

  // A faixa de vigência e o que falta para confirmar (lib/contractModalView.js).
  const startStatus = startStatusOf({
    problem: startProblem, warning, severe: warningIsSevere, startsAt, endsAt, seam, planMonths
  });
  // Sem plano ativo no catálogo o corpo já avisa, e o botão fica desligado pelo
  // noPlans: o rodapé não pede um plano que não existe.
  const noPlans = activePlans.length === 0;
  const blockText = noPlans ? '' : confirmBlockOf({ plan, startsAt, startProblem, hasDiscount, reason });
  const reasonHint = reasonHintOf({ hasDiscount, reason });
  // O que o leitor de tela ouve: a faixa e, se for outra frase, o rodapé. Sem plano
  // ativo, o corpo do modal já avisa e não há faixa para ler.
  const announcement = noPlans
    ? ''
    : [startStatus.text, blockText && blockText !== startStatus.text ? blockText : ''].filter(Boolean).join(' ');

  const pickPlan = (id) => {
    setFocusedPlanId(null);
    // O plano que já está marcado só limpa a busca: o valor de tabela é o mesmo,
    // então o desconto e o motivo continuam valendo.
    if (id === planId) { setPlanSearch(''); return; }
    setPlanId(id);
    setPlanSearch('');
    // Trocar de plano zera o desconto: 10% de outro valor não é o mesmo desconto.
    setDiscountMode(DISCOUNT_MODES.NENHUM);
    setDiscountInput('');
    setReason(null);
  };

  // Escolher o cartão "Outra data" (clique, Enter ou Espaço) leva o foco ao campo
  // de data. A seta só marca o cartão, sem mexer no foco: com o foco no campo, a
  // seta seguinte somaria ou tiraria um dia da data.
  const pickStart = (id) => {
    if (id !== 'outra') { setStartMode(id); return; }
    flushSync(() => setStartMode('outra'));
    dateRef.current?.focus();
  };

  const handleClose = (open) => { if (!open && !submitting) onClose && onClose(); };

  const handleConfirm = async () => {
    // Durante o envio o botão fica focável (aria-disabled), então o clique é ignorado aqui.
    if (submitting) return;
    if (!plan) { toast.warning('Selecione um plano.'); return; }
    if (!startsAt) { toast.warning('Informe a data de início.'); return; }
    if (startProblem) { toast.warning(startProblem); return; }
    if (hasDiscount && !reason) { toast.warning('Escolha o motivo do desconto.'); return; }

    setSaveError(false);
    setSubmitting(true);
    setSent({ lead, currentContract, renewedFromId, planos, contratos });
    try {
      await commitMatricula({
        db,
        lead,
        appUser,
        plan,
        value: finalValue,
        startsAt,
        mode,
        renewedFromId: renewFromId,
        previousContract: isRenewal ? currentDoc : null,
        contractExtra: {
          discountMode: hasDiscount ? discountMode : DISCOUNT_MODES.NENHUM,
          discountValue: hasDiscount ? discountValue : 0,
          discountReason: hasDiscount ? reason : null
        }
      });
      toast.success(isRenewal ? 'Renovação registrada!' : 'Matrícula realizada!');
      onDone && onDone();
    } catch (e) {
      console.error('Erro ao registrar contrato:', e);
      toast.error('Não foi possível salvar. Tente novamente.');
      setSaveError(true);
      setSent(null);
    } finally {
      setSubmitting(false);
    }
  };

  // Os cartões do início. O texto longo (quantos dias do atual a data toma) vai na
  // dica do mouse e, com a opção marcada, na faixa de vigência.
  const startOptions = [
    emendaDate && {
      id: 'emendar',
      label: 'Emendar',
      hint: fmtDate(emendaDate),
      tip: 'Começa no dia seguinte ao fim do contrato atual, sem lacuna.',
      Icon: Link2
    },
    {
      id: 'hoje',
      label: 'Hoje',
      hint: fmtDate(today),
      tip: todayOverlap
        ? `Começa hoje. ${todayShortens
          ? `Encerra o atual ${daysLabel(todayOverlap)} antes.`
          : `Os dois valem juntos por ${daysLabel(todayOverlap)}.`}`
        : 'Começa hoje.',
      Icon: Clock
    },
    {
      id: 'outra',
      label: 'Outra data',
      hint: startMode === 'outra' && startsAt ? fmtDate(startsAt) : 'Escolher',
      tip: 'Defina a data manualmente.',
      Icon: Calendar
    }
  ].filter(Boolean);

  const isUpgrade = isRenewal && plan && (finalValue > refValue || planMonths > refMonths);
  const upgradeLabel = planMonths > refMonths ? 'Upgrade' : 'Acima do atual';

  // Numa nova matrícula de quem já foi cliente, o cabeçalho mostra o contrato
  // que se encerrou — é o contexto de quem está voltando.
  const hadContract = Boolean(lead?.currentContractId && refEnd);
  const Icon = isRenewal ? RefreshCw : GraduationCap;

  const headerSub = isRenewal || hadContract
    ? `${isRenewal ? 'Contrato atual' : 'Último contrato'}: ${lead?.currentPlanName || 'Contrato'}${lead?.currentContractId ? ` #${shortId(lead.currentContractId)}` : ''}${refValue ? `, ${fmtBRL(refValue)}` : ''}${refEnd ? `, ${refDaysLeft != null && refDaysLeft < 0 ? 'venceu' : 'vence'} em ${fmtDate(refEnd)}` : ''}`
    : 'Primeira matrícula';
  const headerChip = isRenewal || hadContract
    ? (refDaysLeft != null
      ? <Chip tone={refDaysLeft < 0 ? 'slate' : 'amber'}>{refDaysLeft < 0 ? `sem contrato há ${daysLabel(Math.abs(refDaysLeft))}` : `restam ${daysLabel(refDaysLeft)}`}</Chip>
      : null)
    : (lead?.status ? <Chip tone="slate">{lead.status}</Chip> : null);

  const writes = isRenewal
    ? [
      `Contrato novo, ligado ao ${lead?.currentContractId ? `#${shortId(lead.currentContractId)}` : 'contrato atual'}`,
      ...(shortenTo ? [`O contrato atual passa a terminar em ${fmtDate(shortenTo)}`] : []),
      'Resumo do cliente e linha do tempo atualizados',
      'Renovação concluída na Meta Diária de hoje'
    ]
    : [
      'Contrato com plano, valor e vigência',
      'O lead vira cliente, na fase Venda do funil',
      'Evento na linha do tempo',
      'Conversão atribuída à última aula experimental atendida'
    ];

  // Quem fica no Tab em cada grupo de rádios.
  const planList = searchOpen ? results : cards;
  const planIds = planList.map(p => p.id);
  const startIds = startOptions.map(o => o.id);
  const planTabStop = planIds.includes(focusedPlanId) ? focusedPlanId : tabStopId(planIds, planId);
  const startTabStop = tabStopId(startIds, startMode);

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        overlayClassName="z-[210]"
        className="z-[210] block p-0 gap-0 w-[920px] max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] rounded-2xl overflow-hidden border-border"
      >
        {/* Cabeçalho: o que está sendo fechado, numa linha só */}
        <div className="flex items-center gap-4 px-6 py-[18px] border-b border-border">
          <span className={cn(
            'size-11 flex-none rounded-[14px] grid place-items-center',
            isRenewal
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
              : 'bg-orange-50 text-[#C2410C] dark:bg-orange-500/15 dark:text-orange-300'
          )}>
            <Icon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <DialogTitle className="font-display text-[21px] font-bold tracking-tight">
                {isRenewal ? 'Renovar contrato' : 'Matricular cliente'}
              </DialogTitle>
              {headerChip}
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
              <span className="flex-none font-semibold text-foreground">{lead?.name || 'Cliente'}</span>
              <span className="num truncate">{headerSub}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onClose && onClose()}
            disabled={submitting}
            title="Fechar"
            aria-label="Fechar"
            className="size-8 flex-none rounded-[9px] grid place-items-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white transition disabled:opacity-50 focus-visible:outline-none focus-visible:anel-foco"
          >
            <X size={16} />
          </button>
        </div>

        {noPlans ? (
          <div className="px-6 py-8">
            <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10 px-4 py-5 text-[13px] text-amber-800 dark:text-amber-200">
              Nenhum plano ativo no catálogo. Peça a um administrador para cadastrar
              os planos em <span className="font-semibold">Configurações → Catálogos → Planos</span>.
            </div>
          </div>
        ) : (
          <div className="grid max-h-[70vh] grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_320px]">
            {/* ===== Decisões ===== */}
            <div className="flex min-w-0 flex-col gap-[22px] px-6 py-[22px]">
              {/* Plano */}
              <section>
                <SectionHead
                  title="Plano"
                  hintLive
                  hint={searchOpen ? (results.length === 1 ? '1 plano no catálogo ativo' : `${results.length} planos no catálogo ativo`) : 'Os 3 mais vendidos.'}
                >
                  <div className="relative flex-none">
                    <Search size={13} className="absolute left-3 top-[10px] text-slate-400 dark:text-slate-500" />
                    <input
                      ref={searchRef}
                      value={planSearch}
                      onChange={e => setPlanSearch(e.target.value)}
                      placeholder="Buscar outro plano"
                      aria-label="Buscar outro plano"
                      className="h-8 w-[210px] rounded-full border border-border bg-card pl-8 pr-8 text-[13px] outline-none transition placeholder:text-slate-500 dark:placeholder:text-slate-400 focus-visible:anel-foco"
                    />
                    {searchOpen && (
                      <button
                        type="button"
                        onClick={() => { setPlanSearch(''); searchRef.current?.focus(); }}
                        title="Limpar"
                        aria-label="Limpar busca"
                        className="absolute right-1 top-1 size-6 rounded-full grid place-items-center text-muted-foreground hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/[0.06] dark:hover:text-white transition focus-visible:outline-none focus-visible:anel-foco"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </SectionHead>
                <div
                  role="radiogroup"
                  aria-label="Plano"
                  // Plano usa ativação manual: escolher um plano zera o desconto e limpa a busca,
                  // então a seta só move o foco e Enter, Espaço ou o clique escolhem.
                  onKeyDown={radioKeyDown(planIds)}
                  onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocusedPlanId(null); }}
                  className="max-h-[208px] min-h-[156px] divide-y divide-border overflow-y-auto rounded-xl border border-border"
                >
                  {searchOpen && results.length === 0 ? (
                    <div className="px-3.5 py-4 text-[13px] text-muted-foreground">
                      Nenhum plano ativo com esse nome. Cadastre em <span className="font-semibold text-foreground">Configurações → Catálogos → Planos</span>.
                    </div>
                  ) : planList.map(p => {
                    const top = topPlans.some(t => t.id === p.id);
                    const tag = searchOpen
                      ? (top ? { tone: 'success', label: 'Mais vendido' } : null)
                      : (top ? null : { tone: 'brand', label: 'Buscado' });
                    return <PlanRow key={p.id} plan={p} on={p.id === planId} tabStop={p.id === planTabStop} tag={tag} onPick={pickPlan} onFocus={setFocusedPlanId} />;
                  })}
                </div>
              </section>

              {/* Início da vigência */}
              <section>
                <SectionHead title="Início da vigência" hint="Quando o contrato novo começa a valer?">
                  {startMode === 'outra' && (
                    <input
                      type="date"
                      ref={dateRef}
                      value={customStart}
                      aria-label="Data de início"
                      onChange={e => { setCustomStart(e.target.value); setStartMode('outra'); }}
                      className="num h-8 flex-none rounded-lg border border-border bg-card px-2.5 text-[13px] outline-none transition focus-visible:anel-foco dark:[color-scheme:dark]"
                    />
                  )}
                </SectionHead>
                <div
                  role="radiogroup"
                  aria-label="Início da vigência"
                  onKeyDown={radioKeyDown(startIds, setStartMode)}
                  className={cn('grid gap-2.5', startOptions.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}
                >
                  {startOptions.map(o => (
                    <StartCard key={o.id} option={o} on={o.id === startMode} tabStop={o.id === startTabStop} onPick={pickStart} />
                  ))}
                </div>
                <StartStatus tone={startStatus.tone} text={startStatus.text} />
              </section>

              {/* Valor e desconto */}
              <section>
                <SectionHead title="Valor e desconto" hint={plan ? `Tabela de ${fmtBRL(listValue)}. Dê um desconto se foi combinado.` : undefined}>
                  {hasDiscount && (
                    <span className="num flex-none self-center rounded-full bg-emerald-50 px-3 py-1 text-[12.5px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      − {fmtBRL(discountValue)} ({discountPct}%)
                    </span>
                  )}
                </SectionHead>
                <div className="flex min-h-10 flex-wrap items-center gap-2.5">
                  <div className="flex gap-0.5 rounded-full bg-slate-100 p-[3px] dark:bg-white/[0.06]" role="group" aria-label="Tipo de desconto">
                    {[
                      { id: DISCOUNT_MODES.NENHUM, label: 'Sem desconto' },
                      { id: DISCOUNT_MODES.PERCENT, label: '%', name: '% de desconto' },
                      { id: DISCOUNT_MODES.REAIS, label: 'R$', name: 'R$ de desconto' },
                      { id: DISCOUNT_MODES.FINAL, label: 'Valor final' }
                    ].map(d => (
                      <button
                        key={d.id}
                        type="button"
                        aria-pressed={discountMode === d.id}
                        aria-label={d.name}
                        onClick={() => { setDiscountMode(d.id); setDiscountInput(''); setReason(null); }}
                        className={cn(
                          'h-8 rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap transition focus-visible:outline-none focus-visible:anel-foco',
                          discountMode === d.id
                            ? 'bg-card text-brand-700 shadow-card ring-1 ring-inset ring-brand-600 dark:bg-white/[0.14] dark:text-brand-300 dark:ring-brand-400'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        )}
                      >{d.label}</button>
                    ))}
                  </div>

                  {discountMode !== DISCOUNT_MODES.NENHUM && (
                    <div className="relative flex-none">
                      <span className="num absolute left-3 top-[11px] text-[13px] font-semibold text-muted-foreground">
                        {discountMode === DISCOUNT_MODES.PERCENT ? '%' : 'R$'}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={discountInput}
                        aria-label={discountMode === DISCOUNT_MODES.FINAL ? 'Valor final do contrato' : 'Valor do desconto'}
                        onChange={e => {
                          const next = e.target.value;
                          setDiscountInput(next);
                          // Sem desconto, o motivo de antes sai: não volta marcado sozinho quando a pessoa digita outro valor.
                          if (!computeDiscount({ listValue, mode: discountMode, input: next }).hasDiscount) setReason(null);
                        }}
                        placeholder={discountMode === DISCOUNT_MODES.PERCENT ? 'ex.: 10' : discountMode === DISCOUNT_MODES.REAIS ? 'ex.: 150' : 'ex.: 1.240'}
                        className={cn(
                          'num h-10 w-[128px] rounded-[11px] border-[1.5px] border-brand-200 bg-card pr-3 text-[14.5px] font-semibold outline-none transition placeholder:text-[13px] placeholder:font-normal placeholder:text-slate-500 dark:placeholder:text-slate-400 focus-visible:anel-foco dark:border-brand-500/45 focus:border-brand-600 dark:focus:border-brand-400',
                          discountMode === DISCOUNT_MODES.PERCENT ? 'pl-7' : 'pl-[38px]'
                        )}
                      />
                    </div>
                  )}
                </div>

                <div className="mt-3.5">
                  <span className="text-[12.5px] text-muted-foreground">
                    Motivo do desconto
                    {reasonHint && (
                      <span className={cn('ml-1', hasDiscount ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>
                        ({reasonHint})
                      </span>
                    )}
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Motivo do desconto">
                    {DISCOUNT_REASONS.map(r => (
                      <button
                        key={r}
                        type="button"
                        disabled={!hasDiscount}
                        aria-pressed={hasDiscount && r === reason}
                        onClick={() => setReason(r)}
                        className={cn(
                          'h-[34px] rounded-full border px-3.5 text-[13px] font-medium whitespace-nowrap transition focus-visible:outline-none focus-visible:anel-foco',
                          'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-45 dark:disabled:bg-white/[0.03]',
                          hasDiscount && r === reason
                            ? 'border-brand-600 bg-brand-50 font-semibold text-brand-700 dark:border-brand-500 dark:bg-brand-500/15 dark:text-brand-300'
                            : 'border-border bg-card enabled:hover:border-brand-200 dark:enabled:hover:border-brand-500/45'
                        )}
                      >{r}</button>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            {/* ===== Recibo ===== */}
            <aside aria-label="Recibo" className="flex flex-col border-t border-border bg-slate-50 dark:bg-white/[0.03] md:border-l md:border-t-0">
              <div className="px-[22px] pt-5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-display text-[21px] font-bold leading-tight tracking-tight">{plan?.name || '—'}</span>
                  {isUpgrade && <Chip tone="success">{upgradeLabel}</Chip>}
                </div>
                <div className="num mt-1 text-[12.5px] text-muted-foreground">
                  {monthsLabel(planMonths)}
                  {isRenewal && lead?.currentPlanName ? `, renovação de ${lead.currentPlanName}` : ''}
                  {isRenewal && lead?.currentContractId ? ` #${shortId(lead.currentContractId)}` : ''}
                </div>

                {/* Vigência */}
                <div className="mt-4 border-t border-border pt-3.5">
                  <div className="mb-2.5 text-[12.5px] text-muted-foreground">Vigência</div>
                  {isRenewal ? (
                    <div className="flex flex-col gap-2.5">
                      <div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[12.5px] text-muted-foreground">Atual, {lead?.currentPlanName || 'sem plano'}</span>
                          <span className="num flex-none text-[12px] text-muted-foreground">{shortenTo || refEnd ? `até ${fmtDate(shortenTo || refEnd)}` : 'sem data'}</span>
                        </div>
                        <div className="relative mt-1 h-2 rounded-full bg-slate-200/70 dark:bg-white/[0.06]">
                          {bars && (
                            <span
                              className={cn('absolute bottom-0 top-0', shortenTo ? 'rounded-l-full' : 'rounded-full', 'bg-slate-300 dark:bg-slate-600')}
                              style={{ left: `${bars.curLeft}%`, width: `${bars.curWidth}%` }}
                            />
                          )}
                          {bars && shortenTo && (
                            <span
                              title="Dias que o contrato atual perde"
                              className="absolute bottom-0 top-0 rounded-r-full bg-rose-200 dark:bg-rose-500/35"
                              style={{ left: `${bars.lostLeft}%`, width: `${bars.lostWidth}%` }}
                            />
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[12.5px] font-semibold text-brand-700 dark:text-brand-300">Novo, {plan?.name || 'sem plano'}</span>
                          <span className="num flex-none text-[12px] text-muted-foreground">{startsAt && endsAt ? `${fmtDate(startsAt)} a ${fmtDate(endsAt)}` : 'sem data'}</span>
                        </div>
                        <div className="relative mt-1 h-2 rounded-full bg-slate-200/70 dark:bg-white/[0.06]">
                          {bars && (
                            <span
                              className="absolute bottom-0 top-0 rounded-full bg-brand-600"
                              style={{ left: `${bars.newLeft}%`, width: `${bars.newWidth}%` }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-[7px]">
                      <div className="flex items-baseline justify-between gap-2.5">
                        <span className="text-[12.5px] text-muted-foreground">Início</span>
                        <span className="num text-[13px] font-semibold">{fmtDate(startsAt)}</span>
                      </div>
                      <div className="relative h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/[0.06]">
                        <span className="absolute inset-0 rounded-full bg-brand-600" />
                      </div>
                      <div className="flex items-baseline justify-between gap-2.5">
                        <span className="text-[12.5px] text-muted-foreground">Término</span>
                        <span className="num text-[13px] font-semibold text-brand-700 dark:text-brand-300">{fmtDate(endsAt)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Conta */}
                <div className="mt-4 flex flex-col gap-[7px] border-t border-border pt-3.5">
                  <div className="flex items-baseline justify-between gap-2.5">
                    <span className="text-[12.5px] text-muted-foreground">Tabela</span>
                    <span className="num text-[13px]">{fmtBRL(listValue)}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2.5">
                    <span className="truncate text-[12.5px] text-muted-foreground">
                      Desconto{hasDiscount && reason ? `, ${reason.toLowerCase()}` : ''}
                    </span>
                    {hasDiscount
                      ? <span className="num flex-none text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">− {fmtBRL(discountValue)}</span>
                      : <span className="text-[13px] text-muted-foreground">Nenhum</span>}
                  </div>
                  <div className="flex items-baseline justify-between gap-2.5 border-t border-border pt-2.5">
                    <span className="text-[13px] font-semibold">Valor do contrato</span>
                    <span className="num font-display text-[24px] font-bold leading-none tracking-tight">{fmtBRL(finalValue)}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2.5">
                    <span className="text-[12.5px] text-muted-foreground">{isRenewal && oldMonthly > 0 ? 'Mensal novo' : 'Por mês'}</span>
                    <span className="num text-[12.5px]">
                      {fmtBRL(newMonthly)}
                      {isRenewal && oldMonthly > 0 && deltaPct !== 0 && (
                        <span className={cn('ml-1 text-[12px] font-bold', deltaPct > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400')}>
                          {deltaPct > 0 ? '+' : ''}{deltaPct}%
                        </span>
                      )}
                    </span>
                  </div>
                  {isRenewal && oldMonthly > 0 && (
                    <div className="flex items-baseline justify-between gap-2.5">
                      <span className="text-[12.5px] text-muted-foreground">Mensal atual</span>
                      <span className="num text-[12.5px] text-muted-foreground">{fmtBRL(oldMonthly)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1" />

              {/* O que será gravado */}
              <div className="mt-4 border-t border-border px-[22px] pb-[18px] pt-3.5">
                <div className="mb-2 text-[12.5px] text-muted-foreground">Ao confirmar</div>
                <div className="flex flex-col gap-1.5">
                  {writes.map(text => (
                    <div key={text} className="flex items-start gap-2">
                      <Check size={13} strokeWidth={2.4} className="mt-0.5 flex-none text-emerald-600 dark:text-emerald-400" />
                      <span className="text-pretty text-[12px] leading-[1.45] text-slate-600 dark:text-slate-300">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Rodapé: o que falta, à esquerda; as ações, à direita */}
        <div data-slot="contract-footer" className="flex min-h-[62px] items-center gap-2.5 border-t border-border px-6 py-3.5">
          <Announcer text={announcement} />
          {blockText && (
            <span aria-hidden="true" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-amber-700 dark:text-amber-300">
              <AlertTriangle size={15} />
              {blockText}
            </span>
          )}
          {saveError && (
            <span role="alert" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-rose-700 dark:text-rose-300">
              <AlertTriangle size={15} aria-hidden="true" />
              Não foi possível salvar. Tente de novo.
            </span>
          )}
          <div className="flex-1"></div>
          <button
            type="button"
            onClick={() => onClose && onClose()}
            disabled={submitting}
            className="h-[38px] px-4 rounded-[10px] text-[13px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white whitespace-nowrap transition disabled:opacity-50 focus-visible:outline-none focus-visible:anel-foco"
          >Cancelar</button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={noPlans || Boolean(blockText)}
            aria-disabled={submitting || undefined}
            className={cn(
              'inline-flex items-center gap-[7px] h-[38px] px-[17px] rounded-[10px] text-white text-[13px] font-semibold whitespace-nowrap transition disabled:opacity-50 aria-disabled:opacity-50 focus-visible:outline-none focus-visible:anel-foco focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              isRenewal ? 'bg-brand-600 hover:bg-brand-700' : 'bg-[#C2410C] hover:bg-[#9A3412]'
            )}
          >
            <Icon size={14} />
            {submitting ? 'Salvando...' : isRenewal ? 'Confirmar renovação' : 'Confirmar matrícula'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { ContractModal };
