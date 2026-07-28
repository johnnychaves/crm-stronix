import { useMemo, useState } from 'react';
import { Check, GraduationCap, RefreshCw, Search, X } from 'lucide-react';
import { computeEndsAt } from '../lib/contracts.js';
import { commitMatricula } from '../lib/contractsWrites.js';
import { fromDateInputValue, getSafeDateOrNull, toDateInputValue } from '../lib/dates.js';
import { fmtBRL } from '../lib/format.js';
import {
  DISCOUNT_MODES,
  DISCOUNT_REASONS,
  SEAM_KIND,
  computeDiscount,
  computeSeam,
  daysBetween,
  plansWithSales,
  searchPlans,
  seamLabel,
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
const monthlyLabel = (value, months) => (Number(months) > 0 ? `${fmtBRL(Number(value) / Number(months))}/mês` : '—');
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

const StepLabel = ({ n, children, hint }) => (
  <div className="flex items-center gap-2.5 mb-3">
    <span className="size-[18px] flex-none rounded-full grid place-items-center text-[10px] font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900">
      {n}
    </span>
    <span className="text-[13.5px] font-semibold">{children}</span>
    {hint && <span className="num text-[11.5px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{hint}</span>}
  </div>
);

// Rótulo em versalete. Sempre no tom `muted` — a 9.5px ele faz trabalho
// estrutural, e o tom mais claro não passa contraste nesse tamanho.
const Caps = ({ children, className }) => (
  <div className={cn('text-[9.5px] font-bold uppercase tracking-[.08em] text-slate-500 dark:text-slate-400', className)}>
    {children}
  </div>
);

const Chip = ({ tone = 'amber', children }) => (
  <span className={cn(
    'inline-flex items-center h-[19px] px-[7px] rounded-[5px] text-[9.5px] font-bold uppercase tracking-[.05em] whitespace-nowrap',
    tone === 'amber' && 'bg-amber-500/12 text-amber-700 dark:bg-amber-500/16 dark:text-amber-400',
    tone === 'success' && 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    tone === 'brand' && 'bg-brand-50 text-brand-700 dark:bg-brand-500/18 dark:text-brand-300',
    tone === 'slate' && 'bg-slate-500/10 text-slate-600 dark:bg-slate-400/15 dark:text-slate-300'
  )}>{children}</span>
);

function ContractModal({
  lead,
  appUser,
  db,
  mode = 'matricula',
  currentContract = null,
  renewedFromId = null,
  onClose,
  onDone
}) {
  const toast = useToast();
  const { planos, contratos } = useGeneralConfig();
  const isRenewal = mode === 'renovacao';

  // Só planos ATIVOS entram; inativos seguem no histórico de contratos.
  const activePlans = useMemo(
    () => plansWithSales(
      (planos || []).filter(p => p.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0)),
      contratos
    ),
    [planos, contratos]
  );
  const topPlans = useMemo(() => topSellingPlans(activePlans, 3), [activePlans]);

  // Contrato de referência: o vigente na renovação, o encerrado na nova
  // matrícula de quem já foi cliente. O resumo do lead basta; o doc completo
  // entra quando o chamador tem ele à mão (duração exata p/ o comparativo).
  const refEnd = getSafeDateOrNull(lead?.currentContractEndsAt);
  const refStart = getSafeDateOrNull(lead?.currentContractStartsAt);
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
  const [startMode, setStartMode] = useState(emendaDate ? 'emendar' : 'hoje');
  const [customStart, setCustomStart] = useState(toDateInputValue(emendaDate || new Date()));
  const [discountMode, setDiscountMode] = useState(DISCOUNT_MODES.NENHUM);
  const [discountInput, setDiscountInput] = useState('');
  const [reason, setReason] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const plan = activePlans.find(p => p.id === planId) || null;
  const planMonths = Number(plan?.durationMonths) || 0;
  const listValue = Number(plan?.value) || 0;

  // Fora dos 3 mais vendidos, o plano escolhido entra como quarto cartão.
  const cards = plan && !topPlans.some(p => p.id === plan.id) ? [...topPlans, plan] : topPlans;
  const results = searchPlans(activePlans, planSearch);
  const searchOpen = Boolean(planSearch.trim());

  const startsAt = startMode === 'emendar' ? emendaDate
    : startMode === 'hoje' ? new Date()
      : fromDateInputValue(customStart);
  const endsAt = plan && startsAt ? computeEndsAt(startsAt, planMonths) : null;

  // Renovação: o encaixe com o contrato atual. Matrícula: só o desvio de hoje.
  const seam = isRenewal ? computeSeam(refEnd, startsAt) : null;
  const offsetDays = startsAt ? (daysBetween(startOfToday(), startsAt) || 0) : 0;
  const warning = isRenewal
    ? seamWarning(seam, startsAt)
    : offsetDays < 0
      ? `Matrícula retroativa — a vigência começa em ${fmtDate(startsAt)}, então ${Math.abs(offsetDays)} ${Math.abs(offsetDays) === 1 ? 'dia já terá passado' : 'dias já terão passado'} quando o contrato for criado.`
      : offsetDays > 0
        ? `A vigência só começa em ${fmtDate(startsAt)} — até lá o cliente não conta como ativo nos relatórios.`
        : null;
  const warningIsSevere = isRenewal && seam?.kind === SEAM_KIND.SOBREPOSICAO;

  const { finalValue, discountValue, discountPct, hasDiscount } = computeDiscount({
    listValue, mode: discountMode, input: discountInput
  });

  const newMonthly = planMonths > 0 ? finalValue / planMonths : 0;
  const oldMonthly = refMonths > 0 ? refValue / refMonths : 0;
  const deltaPct = oldMonthly > 0 ? Math.round(((newMonthly - oldMonthly) / oldMonthly) * 100) : 0;

  // Escala comum das duas vigências: do início mais antigo ao término mais
  // distante. A sobreposição aparece como barras que se cruzam.
  const bars = (() => {
    if (!isRenewal || !refStart || !refEnd || !startsAt || !endsAt) return null;
    const t0 = Math.min(refStart.getTime(), startsAt.getTime());
    const t1 = Math.max(refEnd.getTime(), endsAt.getTime());
    const span = Math.max(t1 - t0, 1);
    const pos = (d) => Math.max(0, Math.min(100, ((d.getTime() - t0) / span) * 100));
    return {
      curLeft: pos(refStart), curWidth: pos(refEnd) - pos(refStart),
      newLeft: pos(startsAt), newWidth: pos(endsAt) - pos(startsAt)
    };
  })();

  const pickPlan = (id) => {
    setPlanId(id);
    setPlanSearch('');
    // Trocar de plano zera o desconto: 10% de outro valor não é o mesmo desconto.
    setDiscountMode(DISCOUNT_MODES.NENHUM);
    setDiscountInput('');
    setReason(null);
  };

  const handleClose = (open) => { if (!open && !submitting) onClose && onClose(); };

  const handleConfirm = async () => {
    if (!plan) { toast.warning('Selecione um plano.'); return; }
    if (!startsAt) { toast.warning('Informe a data de início.'); return; }
    if (hasDiscount && !reason) { toast.warning('Escolha o motivo do desconto.'); return; }

    setSubmitting(true);
    try {
      await commitMatricula({
        db,
        lead,
        appUser,
        plan,
        value: finalValue,
        startsAt,
        mode,
        renewedFromId: isRenewal ? (renewedFromId || lead?.currentContractId || null) : null,
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
    } finally {
      setSubmitting(false);
    }
  };

  const noPlans = activePlans.length === 0;

  const startOptions = [
    emendaDate && {
      id: 'emendar',
      label: 'Emendar no fim do atual',
      hint: `começa em ${fmtDate(emendaDate)}`,
      chip: 'Sem lacuna'
    },
    {
      id: 'hoje',
      label: 'Começar hoje',
      hint: isRenewal && refDaysLeft != null && refDaysLeft > 0
        ? `${fmtDate(new Date())} · encerra o atual ${refDaysLeft} dias antes`
        : fmtDate(new Date()),
      chip: isRenewal ? null : 'Padrão'
    },
    { id: 'outra', label: 'Outra data', hint: 'define manualmente', custom: true }
  ].filter(Boolean);

  const isUpgrade = isRenewal && plan && (finalValue > refValue || planMonths > refMonths);
  const upgradeLabel = planMonths > refMonths ? 'Upgrade' : 'Acima do atual';

  // Numa nova matrícula de quem já foi cliente, o cabeçalho mostra o contrato
  // que se encerrou — é o contexto de quem está voltando.
  const hadContract = Boolean(lead?.currentContractId && refEnd);
  const Icon = isRenewal ? RefreshCw : GraduationCap;

  const writes = isRenewal
    ? [
      `Contrato novo, ligado ao ${lead?.currentContractId ? `#${shortId(lead.currentContractId)}` : 'contrato atual'}`,
      'Resumo no cliente: plano, valor e vigência',
      'Evento na linha do tempo',
      'Renovação concluída na Meta Diária de hoje'
    ]
    : [
      'Contrato com plano, valor e vigência',
      'O lead vira cliente — fase Venda no funil',
      'Evento na linha do tempo',
      'Conversão atribuída à última aula experimental atendida'
    ];

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[210]"
        className="z-[210] block p-0 gap-0 w-[940px] max-w-[calc(100vw-2rem)] sm:max-w-[940px] rounded-2xl overflow-hidden border-border"
      >
        {/* Cabeçalho: o que está sendo fechado */}
        <div className="flex items-start gap-4 px-6 pt-5 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
          <span className={cn(
            'size-10 flex-none rounded-xl grid place-items-center',
            isRenewal
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
              : 'bg-orange-50 text-[#C2410C] dark:bg-orange-500/15 dark:text-orange-300'
          )}>
            <Icon size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="font-display text-[20px] font-bold tracking-tight">
              {isRenewal ? 'Renovar contrato' : 'Matricular cliente'}
            </DialogTitle>
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              <span className="text-[13px] font-semibold">{lead?.name || 'Cliente'}</span>
              <span className="text-slate-400 dark:text-slate-500">·</span>
              {isRenewal || hadContract ? (
                <>
                  <span className="num text-[12.5px] text-slate-500 dark:text-slate-400">
                    {!isRenewal && 'último contrato: '}
                    {lead?.currentPlanName || 'Contrato'}
                    {lead?.currentContractId ? ` #${shortId(lead.currentContractId)}` : ''}
                    {refValue ? ` · ${fmtBRL(refValue)}` : ''}
                    {refEnd ? ` · ${refDaysLeft != null && refDaysLeft < 0 ? 'venceu' : 'vence'} ${fmtDate(refEnd)}` : ''}
                  </span>
                  {refDaysLeft != null && (
                    <Chip tone={refDaysLeft < 0 ? 'slate' : 'amber'}>
                      {refDaysLeft < 0 ? `sem contrato há ${Math.abs(refDaysLeft)} dias` : `restam ${refDaysLeft} dias`}
                    </Chip>
                  )}
                </>
              ) : (
                <>
                  <span className="text-[12.5px] text-slate-500 dark:text-slate-400">primeira matrícula</span>
                  {lead?.status && <Chip tone="slate">{lead.status}</Chip>}
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onClose && onClose()}
            title="Fechar"
            aria-label="Fechar"
            className="size-8 flex-none rounded-[9px] grid place-items-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white transition"
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
          <div className="flex items-stretch max-h-[70vh] overflow-y-auto">
            {/* ===== Decisões ===== */}
            <div className="flex-1 min-w-0 px-6 pt-5 pb-6">
              {/* 1. Plano */}
              <div className="flex items-center gap-2.5 mb-3">
                <span className="size-[18px] flex-none rounded-full grid place-items-center text-[10px] font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900">1</span>
                <span className="text-[13.5px] font-semibold">Plano</span>
                <span className="text-[11.5px] text-slate-500 dark:text-slate-400 whitespace-nowrap">3 mais vendidos</span>
                <div className="flex-1"></div>
                <div className="relative flex-none">
                  <Search size={13} className="absolute left-2.5 top-[9px] text-slate-400 dark:text-slate-500" />
                  <input
                    value={planSearch}
                    onChange={e => setPlanSearch(e.target.value)}
                    placeholder="Buscar outro plano"
                    className="h-[31px] w-[196px] rounded-[9px] border border-border bg-card text-[12px] pl-[27px] pr-7 outline-none focus:border-brand-400 dark:focus:border-brand-500/60 transition"
                  />
                  {searchOpen && (
                    <button
                      type="button"
                      onClick={() => setPlanSearch('')}
                      title="Limpar"
                      aria-label="Limpar busca"
                      className="absolute right-1.5 top-1.5 size-5 rounded-md grid place-items-center text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/[0.06] dark:hover:text-white transition"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {searchOpen ? (
                <div className="rounded-xl border border-border overflow-hidden shadow-card">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03]">
                    <Caps>{results.length === 1 ? '1 plano' : `${results.length} planos`}</Caps>
                    <div className="flex-1"></div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">catálogo ativo · Configurações → Catálogos</span>
                  </div>
                  {results.length === 0 ? (
                    <div className="px-3 py-4 text-[12.5px] text-slate-500 dark:text-slate-400">
                      Nenhum plano ativo com esse nome. Cadastre em <span className="font-semibold text-slate-700 dark:text-slate-200">Configurações → Catálogos → Planos</span>.
                    </div>
                  ) : results.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pickPlan(p.id)}
                      className={cn(
                        'flex items-center gap-3 w-full text-left px-3 py-2.5 border-b border-slate-100 dark:border-white/[0.06] last:border-0 transition',
                        p.id === planId ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                      )}
                    >
                      <span className={cn('min-w-0 flex-[1.4] truncate text-[12.5px] font-semibold', p.id === planId && 'text-brand-700 dark:text-brand-300')}>{p.name}</span>
                      <span className="num w-[70px] flex-none text-[11.5px] text-slate-500 dark:text-slate-400">{monthsLabel(p.durationMonths)}</span>
                      <span className="num w-[92px] flex-none text-right text-[12.5px] font-semibold">{fmtBRL(p.value)}</span>
                      <span className="num w-[92px] flex-none text-right text-[11px] text-slate-500 dark:text-slate-400">{monthlyLabel(p.value, p.durationMonths)}</span>
                      <span className="w-[86px] flex-none flex justify-end">
                        {topPlans.some(t => t.id === p.id) && <Chip tone="success">Mais vendido</Chip>}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex gap-2">
                  {cards.map(p => {
                    const on = p.id === planId;
                    const offTop = !topPlans.some(t => t.id === p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => pickPlan(p.id)}
                        className={cn(
                          'relative flex-1 min-w-0 text-left px-[11px] pt-[11px] pb-3 rounded-xl border-[1.5px] transition',
                          on
                            ? 'border-brand-600 bg-brand-50 dark:border-brand-500 dark:bg-brand-500/15'
                            : 'border-border bg-card hover:border-brand-200 dark:hover:border-brand-500/45'
                        )}
                      >
                        {offTop && (
                          <span className="absolute -top-[7px] right-2">
                            <Chip tone="brand">Buscado</Chip>
                          </span>
                        )}
                        <div className={cn('truncate text-[12.5px] font-semibold', on && 'text-brand-700 dark:text-brand-300')}>{p.name}</div>
                        <div className="num text-[10.5px] text-slate-500 dark:text-slate-400 mt-px">
                          {monthsLabel(p.durationMonths)} · {p.sold === 1 ? '1 venda' : `${p.sold} vendas`}
                        </div>
                        <div className={cn('num font-display text-[16px] font-bold tracking-tight mt-2', on && 'text-brand-700 dark:text-brand-300')}>{fmtBRL(p.value)}</div>
                        <div className="num text-[10.5px] text-slate-500 dark:text-slate-400 mt-px">{monthlyLabel(p.value, p.durationMonths)}</div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 2. Início da vigência */}
              <div className="mt-6">
                <StepLabel n={2}>Início da vigência</StepLabel>
                <div className="flex flex-col gap-[7px]">
                  {startOptions.map(o => {
                    const on = o.id === startMode;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setStartMode(o.id)}
                        className={cn(
                          'flex items-center gap-[11px] text-left px-3 py-2.5 rounded-[11px] border-[1.5px] transition',
                          on
                            ? 'border-brand-600 bg-brand-50 dark:border-brand-500 dark:bg-brand-500/15'
                            : 'border-border bg-card hover:border-brand-200 dark:hover:border-brand-500/45'
                        )}
                      >
                        <span className={cn(
                          'size-4 flex-none rounded-full border-[1.5px] grid place-items-center',
                          on ? 'border-brand-600 dark:border-brand-400' : 'border-slate-300 dark:border-white/20'
                        )}>
                          {on && <span className="size-2 rounded-full bg-brand-600 dark:bg-brand-400"></span>}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className={cn('text-[12.5px] font-semibold', on && 'text-brand-700 dark:text-brand-300')}>{o.label}</div>
                          <div className="num text-[11px] text-slate-500 dark:text-slate-400 mt-px">{o.hint}</div>
                        </div>
                        {o.custom && (
                          <input
                            type="date"
                            value={customStart}
                            onChange={e => { setCustomStart(e.target.value); setStartMode('outra'); }}
                            onClick={e => { e.stopPropagation(); setStartMode('outra'); }}
                            className="num flex-none h-8 rounded-lg border border-border bg-card text-[12px] px-2.5 outline-none focus:border-brand-400 transition"
                          />
                        )}
                        {o.chip && <Chip tone="success">{o.chip}</Chip>}
                      </button>
                    );
                  })}
                </div>

                {warning && (
                  <div className={cn(
                    'flex items-start gap-2.5 mt-2.5 px-3 py-2.5 rounded-[11px] border',
                    warningIsSevere
                      ? 'border-rose-300/60 bg-rose-500/[0.07] dark:border-rose-500/40 dark:bg-rose-500/10'
                      : 'border-amber-300/60 bg-amber-500/[0.09] dark:border-amber-500/40 dark:bg-amber-500/10'
                  )}>
                    <span className={cn(
                      'flex-none mt-0.5',
                      warningIsSevere ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'
                    )}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
                      </svg>
                    </span>
                    <p className="min-w-0 flex-1 text-[12px] leading-[1.5] text-slate-600 dark:text-slate-300 text-pretty">{warning}</p>
                  </div>
                )}
              </div>

              {/* 3. Valor */}
              <div className="mt-6">
                <StepLabel n={3} hint={plan ? `tabela ${fmtBRL(listValue)}` : undefined}>Valor</StepLabel>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="flex gap-0.5 p-[3px] rounded-[10px] bg-slate-100 dark:bg-white/[0.06]">
                    {[
                      { id: DISCOUNT_MODES.NENHUM, label: 'Sem desconto' },
                      { id: DISCOUNT_MODES.PERCENT, label: '%' },
                      { id: DISCOUNT_MODES.REAIS, label: 'R$' },
                      { id: DISCOUNT_MODES.FINAL, label: 'Valor final' }
                    ].map(d => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => { setDiscountMode(d.id); setDiscountInput(''); setReason(null); }}
                        className={cn(
                          'h-[30px] px-[11px] rounded-lg text-[12px] font-semibold whitespace-nowrap transition',
                          discountMode === d.id
                            ? 'bg-card text-slate-900 dark:text-white shadow-card'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        )}
                      >{d.label}</button>
                    ))}
                  </div>

                  {discountMode !== DISCOUNT_MODES.NENHUM && (
                    <div className="relative flex-none">
                      <span className="num absolute left-3 top-[9px] text-[12.5px] font-semibold text-slate-500 dark:text-slate-400">
                        {discountMode === DISCOUNT_MODES.PERCENT ? '%' : 'R$'}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={discountInput}
                        onChange={e => setDiscountInput(e.target.value)}
                        placeholder={discountMode === DISCOUNT_MODES.PERCENT ? '10' : discountMode === DISCOUNT_MODES.REAIS ? '150' : '1.240'}
                        className={cn(
                          'num w-[132px] h-9 rounded-[10px] border-[1.5px] border-brand-200 dark:border-brand-500/45 bg-card text-[13.5px] font-semibold pr-3 outline-none focus:border-brand-600 dark:focus:border-brand-400 transition',
                          discountMode === DISCOUNT_MODES.PERCENT ? 'pl-7' : 'pl-[38px]'
                        )}
                      />
                    </div>
                  )}

                  {hasDiscount && (
                    <span className="num text-[12px] font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      − {fmtBRL(discountValue)} ({discountPct}%)
                    </span>
                  )}
                </div>

                {hasDiscount && (
                  <div className="mt-2.5">
                    <Caps className="mb-2">Motivo do desconto</Caps>
                    <div className="flex flex-wrap gap-1.5">
                      {DISCOUNT_REASONS.map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setReason(r)}
                          className={cn(
                            'h-[29px] px-[11px] rounded-lg border-[1.5px] text-[12px] font-semibold whitespace-nowrap transition',
                            r === reason
                              ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/15 dark:text-brand-300'
                              : 'border-border bg-card text-slate-600 dark:text-slate-300 hover:border-brand-200 dark:hover:border-brand-500/45'
                          )}
                        >{r}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ===== Recibo ===== */}
            <div className="w-[344px] flex-none border-l border-slate-100 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03] flex flex-col">
              <div className="px-[22px] pt-5 pb-[18px]">
                <Caps>{isRenewal ? 'Novo contrato' : 'Nova matrícula'}</Caps>

                <div className="flex items-center gap-2.5 mt-2.5 flex-wrap">
                  <span className="font-display text-[22px] font-bold tracking-tight">{plan?.name || '—'}</span>
                  {isUpgrade && <Chip tone="success">{upgradeLabel}</Chip>}
                </div>
                <div className="num text-[11.5px] text-slate-500 dark:text-slate-400 mt-1">
                  {monthsLabel(planMonths)}
                  {isRenewal && lead?.currentPlanName ? ` · renovação de ${lead.currentPlanName}` : ''}
                  {isRenewal && lead?.currentContractId ? ` #${shortId(lead.currentContractId)}` : ''}
                </div>

                {/* Vigência */}
                <div className="mt-[18px] pt-4 border-t border-border">
                  <Caps className="mb-3">Vigência</Caps>
                  {isRenewal ? (
                    <>
                      <div className="flex flex-col gap-2.5">
                        <div>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">Atual · {lead?.currentPlanName || '—'}</span>
                            <span className="num text-[10.5px] text-slate-400 dark:text-slate-500 flex-none">até {fmtDate(refEnd)}</span>
                          </div>
                          <div className="relative h-2 mt-1 rounded-full bg-slate-200/70 dark:bg-white/[0.06]">
                            {bars && (
                              <span
                                className="absolute top-0 bottom-0 rounded-full bg-slate-300 dark:bg-slate-600"
                                style={{ left: `${bars.curLeft}%`, width: `${bars.curWidth}%` }}
                              />
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[11.5px] font-semibold text-brand-700 dark:text-brand-300 truncate">Novo · {plan?.name || '—'}</span>
                            <span className="num text-[10.5px] text-slate-500 dark:text-slate-400 flex-none">{fmtDate(startsAt)} → {fmtDate(endsAt)}</span>
                          </div>
                          <div className="relative h-2 mt-1 rounded-full bg-slate-200/70 dark:bg-white/[0.06]">
                            {bars && (
                              <span
                                className="absolute top-0 bottom-0 rounded-full bg-brand-600"
                                style={{ left: `${bars.newLeft}%`, width: `${bars.newWidth}%` }}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                      {seam && (
                        <div className={cn(
                          'num text-[11px] mt-2.5',
                          seam.kind === SEAM_KIND.EMENDA && 'text-emerald-700 dark:text-emerald-400',
                          seam.kind === SEAM_KIND.LACUNA && 'text-amber-700 dark:text-amber-400',
                          seam.kind === SEAM_KIND.SOBREPOSICAO && 'text-rose-700 dark:text-rose-400'
                        )}>{seamLabel(seam)}</div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col gap-[7px]">
                      <div className="flex items-baseline justify-between gap-2.5">
                        <span className="text-[11.5px] text-slate-500 dark:text-slate-400">Início</span>
                        <span className="num text-[12px] font-semibold">{fmtDate(startsAt)}</span>
                      </div>
                      <div className="relative h-2 rounded-full overflow-hidden bg-slate-200/70 dark:bg-white/[0.06]">
                        <span className="absolute inset-0 rounded-full bg-brand-600" />
                      </div>
                      <div className="flex items-baseline justify-between gap-2.5">
                        <span className="text-[11.5px] text-slate-500 dark:text-slate-400">Término</span>
                        <span className="num text-[12px] font-semibold text-brand-700 dark:text-brand-300">{fmtDate(endsAt)}</span>
                      </div>
                      <div className="num text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {monthsLabel(planMonths)} de vigência{offsetDays === 0 ? ', a partir de hoje' : ''}
                      </div>
                    </div>
                  )}
                </div>

                {/* Conta */}
                <div className="mt-[18px] pt-4 border-t border-border flex flex-col gap-[7px]">
                  <div className="flex items-baseline justify-between gap-2.5">
                    <span className="text-[12px] text-slate-500 dark:text-slate-400">Tabela</span>
                    <span className="num text-[12.5px] text-slate-600 dark:text-slate-300">{fmtBRL(listValue)}</span>
                  </div>
                  {hasDiscount && (
                    <div className="flex items-baseline justify-between gap-2.5">
                      <span className="text-[12px] text-slate-500 dark:text-slate-400 truncate">
                        Desconto{reason ? ` · ${reason.toLowerCase()}` : ''}
                      </span>
                      <span className="num text-[12.5px] font-semibold text-emerald-700 dark:text-emerald-400 flex-none">− {fmtBRL(discountValue)}</span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-2.5 pt-2 border-t border-border">
                    <span className="text-[12.5px] font-semibold">Valor do contrato</span>
                    <span className="num font-display text-[22px] font-bold tracking-tight leading-none">{fmtBRL(finalValue)}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2.5">
                    <span className="text-[11.5px] text-slate-500 dark:text-slate-400">Equivalente mensal</span>
                    <span className="num text-[11.5px] text-slate-500 dark:text-slate-400">{monthlyLabel(finalValue, planMonths)}</span>
                  </div>
                  {isRenewal && oldMonthly > 0 && (
                    <div className="flex items-baseline justify-between gap-2.5">
                      <span className="text-[11.5px] text-slate-500 dark:text-slate-400">Hoje paga</span>
                      <span className={cn(
                        'num text-[11.5px] font-semibold',
                        deltaPct > 0 ? 'text-amber-700 dark:text-amber-400'
                          : deltaPct < 0 ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-500 dark:text-slate-400'
                      )}>
                        {fmtBRL(oldMonthly)} → {fmtBRL(newMonthly)}{deltaPct === 0 ? '' : ` (${deltaPct > 0 ? '+' : ''}${deltaPct}%)`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1"></div>

              {/* O que será gravado */}
              <div className="px-[22px] pt-4 pb-[18px] border-t border-border">
                <Caps className="mb-2.5">Ao confirmar</Caps>
                <div className="flex flex-col gap-1.5">
                  {writes.map(text => (
                    <div key={text} className="flex items-start gap-2">
                      <Check size={13} strokeWidth={2.4} className="flex-none mt-0.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-[11.5px] leading-[1.45] text-slate-600 dark:text-slate-300 text-pretty">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rodapé */}
        <div className="flex items-center gap-2.5 px-6 py-3.5 border-t border-slate-100 dark:border-white/[0.06]">
          <span className="num text-[11.5px] text-slate-500 dark:text-slate-400 truncate">
            {plan && startsAt && endsAt ? `${plan.name} · ${fmtDate(startsAt)} → ${fmtDate(endsAt)} · ${fmtBRL(finalValue)}` : ''}
          </span>
          <div className="flex-1"></div>
          <button
            type="button"
            onClick={() => onClose && onClose()}
            disabled={submitting}
            className="h-[38px] px-4 rounded-[10px] text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white whitespace-nowrap transition disabled:opacity-50"
          >Cancelar</button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || noPlans}
            className={cn(
              'inline-flex items-center gap-[7px] h-[38px] px-[17px] rounded-[10px] text-white text-[13px] font-semibold whitespace-nowrap transition disabled:opacity-50',
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
