import { useMemo, useState } from 'react';
import { GraduationCap, Layers, SlidersHorizontal } from 'lucide-react';
import { isClientLead } from '../lib/leads.js';
import { ACTIONS, can, isSeller } from '../lib/acesso.js';
import { LIST_PAGE_SIZE } from '../lib/leadStatus.js';
import { usePagedLeads } from '../hooks/usePagedLeads.js';
import { useScreenParams } from '../hooks/useScreenParams.js';
import { SEM_CONTRATO } from '../lib/screenParams.js';
import { clientsAllQuerySpec } from '../lib/leadQueries.js';
import { LEADS_PATH } from '../lib/firebase.js';
import { deriveLeadContractStatus, CONTRACT_STATUS, CONTRACT_STATUS_LABEL } from '../lib/contracts.js';
import { getSafeDateOrNull } from '../lib/dates.js';
import { vigenciaOf } from '../lib/clientsList.js';
import { cn } from '@/lib/utils';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { LeadLink } from '../components/nav/AppLink.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Btn } from '../components/ui/Btn.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover.jsx';
import { FOCUS_RING } from '../components/focusRing.js';
import { ContactPhone } from '../components/profile/ContactPhone.jsx';
import { FilterBar } from './dashboard/DashFilterBar.jsx';
import { ConsultoresControl, MultiControl } from './relatorios/RelatoriosToolbar.jsx';

// Status "vivo" do CLIENTE a partir do resumo denormalizado no lead. Legados
// (Venda antiga sem contrato) não têm endsAt → 'sem_contrato'. O sentinela vem
// do screenParams porque é ele quem lê e escreve a situação no endereço: duas
// escritas do mesmo literal, e um dia o filtro do endereço deixa de casar com
// a lista sem ninguém reclamar.
const clientStatus = (lead, now, threshold) =>
  deriveLeadContractStatus(lead, now, threshold) || SEM_CONTRATO;

// Valor do contrato SEMPRE em BRL com centavos (R$ 199,00). O fmtBRL global é
// inteiro de propósito (painel usa valores redondos), então formatamos aqui.
const fmtBRLValor = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_TONE = {
  [CONTRACT_STATUS.AGENDADO]: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
  [CONTRACT_STATUS.ATIVO]:    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  [CONTRACT_STATUS.A_VENCER]: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  [CONTRACT_STATUS.TRANCADO]: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300',
  // Vencido cinza e cancelado vermelho, como na ficha e no cabeçalho. Antes
  // os dois estavam trocados só aqui.
  [CONTRACT_STATUS.VENCIDO]:  'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
  [CONTRACT_STATUS.CANCELADO]:'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
  [SEM_CONTRATO]:             'bg-slate-100 text-slate-400 dark:bg-white/[0.04] dark:text-slate-500'
};
// A cor cheia de cada situação: a faixa da carteira, o quadradinho da legenda e
// a régua de vigência da linha.
const STATUS_FILL = {
  [CONTRACT_STATUS.AGENDADO]: 'bg-violet-500',
  [CONTRACT_STATUS.ATIVO]:    'bg-emerald-500',
  [CONTRACT_STATUS.A_VENCER]: 'bg-amber-500',
  [CONTRACT_STATUS.TRANCADO]: 'bg-yellow-500',
  [CONTRACT_STATUS.VENCIDO]:  'bg-slate-400',
  [CONTRACT_STATUS.CANCELADO]:'bg-rose-500',
  [SEM_CONTRATO]:             'bg-slate-300 dark:bg-slate-600'
};
const STATUS_LABEL = { ...CONTRACT_STATUS_LABEL, [SEM_CONTRATO]: 'Sem contrato' };

// Ordem das situações na faixa da carteira, na legenda e no filtro.
const STATUS_OPTIONS = [
  CONTRACT_STATUS.ATIVO,
  CONTRACT_STATUS.A_VENCER,
  CONTRACT_STATUS.AGENDADO,
  CONTRACT_STATUS.TRANCADO,
  CONTRACT_STATUS.VENCIDO,
  CONTRACT_STATUS.CANCELADO,
  SEM_CONTRATO
];

// Colunas da lista: o cabeçalho e cada linha usam a mesma grade. Sem largura
// mínima de propósito: com o menu lateral aberto o conteúdo é estreito, e o
// texto que não cabe é cortado em vez de estourar a linha.
const GRID = 'md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_112px_minmax(0,1.5fr)_100px]';

// Anel de situação do contrato em volta do avatar, mesmo padrão do perfil do
// aluno (RingAvatar): verde = Ativo, metade âmbar e metade verde = A vencer,
// amarelo = Trancado, roxo = Agendado e cinza = Inativo (vencido, cancelado ou
// sem contrato). Hexes de getTone.
const RING_GREEN = '#10B981'; // emerald
const RING_AMBER = '#F59E0B'; // amber
const RING_YELLOW = '#EAB308'; // yellow, contrato trancado
const RING_GRAY = '#64748B';  // slate
const RING_VIOLET = '#8B5CF6'; // violet, contrato agendado
const contractRing = (status) =>
  status === CONTRACT_STATUS.ATIVO
    ? RING_GREEN
    : status === CONTRACT_STATUS.AGENDADO
      ? RING_VIOLET
      : status === CONTRACT_STATUS.TRANCADO
        ? RING_YELLOW
        : status === CONTRACT_STATUS.A_VENCER
          ? `conic-gradient(${RING_AMBER} 0deg 180deg, ${RING_GREEN} 180deg 360deg)`
          : RING_GRAY;

// Avatar com o anel, dimensão constante (32 + gap 2 + anel 2.5) para não
// desalinhar as linhas entre situações.
function ContractRingAvatar({ name, status, photoUrl = null }) {
  return (
    <span className="relative shrink-0 rounded-full" style={{ background: contractRing(status), padding: 2.5 }}>
      <span className="block rounded-full bg-white dark:bg-neutral-900" style={{ padding: 2 }}>
        <Avatar name={name} size={32} photoUrl={photoUrl} />
      </span>
    </span>
  );
}

// Selo da situação: ponto e texto escrito, a cor só reforça.
function StatusPill({ status }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold', STATUS_TONE[status])}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-70" />
      {STATUS_LABEL[status]}
    </span>
  );
}

// A carteira numa olhada: uma faixa com a fatia de cada situação e, embaixo, o
// número de cada uma. Cada situação é um botão que liga o mesmo filtro da
// pílula Situação. A faixa é só o desenho (aria-hidden): quem usa teclado e
// leitor de tela tem a legenda.
function CarteiraCard({ counts, total, selected, onToggle, onClear }) {
  const picked = STATUS_OPTIONS.filter((s) => selected.includes(s));
  return (
    <section aria-label="Situação da carteira" className="shrink-0 rounded-[18px] border border-border bg-card px-6 pb-3 pt-5 shadow-card">
      <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="m-0 font-display text-[17px] font-bold tracking-[-0.01em]">Situação da carteira</h3>
        <p className="m-0 text-[12.5px] text-muted-foreground" aria-live="polite">
          {picked.length > 0 ? (
            <>
              Filtrando por {picked.map((s) => STATUS_LABEL[s]).join(' e ')}.{' '}
              <button type="button" onClick={onClear} className={cn('rounded font-semibold text-brand-700 dark:text-brand-300', FOCUS_RING)}>Limpar filtro</button>
            </>
          ) : 'Clique numa situação para filtrar a lista.'}
        </p>
      </div>

      <div aria-hidden="true" className="flex h-4 gap-[3px]">
        {STATUS_OPTIONS.filter((s) => counts[s] > 0).map((s) => (
          <span
            key={s}
            onClick={() => onToggle(s)}
            style={{ flex: counts[s] }}
            className={cn('min-w-2 cursor-pointer rounded first:rounded-l-lg last:rounded-r-lg transition-opacity motion-reduce:transition-none', STATUS_FILL[s], picked.length > 0 && !selected.includes(s) && 'opacity-35')}
          />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-4 xl:grid-cols-7">
        {STATUS_OPTIONS.map((s) => {
          const n = counts[s] || 0;
          const on = selected.includes(s);
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(s)}
              className={cn(
                'flex flex-col items-start gap-px rounded-xl px-3 py-2.5 text-left transition-[opacity,background-color] motion-reduce:transition-none',
                FOCUS_RING,
                on ? STATUS_TONE[s] : 'hover:bg-muted',
                picked.length > 0 && !on && 'opacity-40'
              )}
            >
              <span className={cn('inline-flex items-center gap-[7px] whitespace-nowrap text-[12.5px] font-medium', !on && 'text-muted-foreground')}>
                <span aria-hidden="true" className={cn('size-[9px] rounded-[3px]', STATUS_FILL[s])} />
                {STATUS_LABEL[s]}
              </span>
              <span className="font-display text-[26px] font-bold leading-[1.15] tracking-[-0.02em] tabular-nums">{n}</span>
              <span className={cn('text-[12px] tabular-nums', !on && 'text-muted-foreground')}>{total ? Math.round((n / total) * 100) : 0}%</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ClientRow({ c, st, now }) {
  const consultantFirst = (c.consultantName || '').trim().split(/\s+/)[0] || '';
  const hasValue = Number.isFinite(Number(c.currentContractValue)) && c.currentContractValue != null;
  const vg = vigenciaOf(c, st, now);
  return (
    <LeadLink
      leadId={c.id}
      draggable={false}
      className={cn(
        'grid grid-cols-1 gap-2 md:gap-4 md:items-center px-4 md:px-6 py-3 border-b border-slate-100 dark:border-neutral-800 last:border-b-0 cursor-pointer bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-white/[0.03] focus-visible:ring-inset focus-visible:anel-foco',
        GRID
      )}
    >
      {/* Cliente */}
      <div className="flex items-center gap-3 min-w-0">
        <ContractRingAvatar name={c.name} status={st} photoUrl={c.photoUrl} />
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-slate-900 dark:text-white truncate">{c.name}</div>
          <div className="mt-px flex items-center gap-2.5 text-[12px] text-muted-foreground tabular-nums">
            <span className="inline-flex"><ContactPhone lead={c} /></span>
            {consultantFirst && <span className="font-medium text-brand-700 dark:text-brand-300">@{consultantFirst}</span>}
          </div>
        </div>
      </div>

      {/* Plano */}
      <div className="min-w-0 truncate text-[13px] text-slate-700 dark:text-neutral-200">
        {c.currentPlanName || <span className="text-muted-foreground">—</span>}
      </div>

      {/* Situação */}
      <div><StatusPill status={st} /></div>

      {/* Vigência */}
      <div className="min-w-0">
        {vg ? (
          <>
            <div className="mb-1.5 flex items-baseline justify-between gap-2.5 text-[12.5px]">
              <span title={vg.dateText} className={cn('min-w-0 truncate', vg.warn ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>{vg.text}</span>
              {/* A data só aparece com folga: abaixo de 1280px ela disputa a linha com o texto, e vai no title dele. */}
              <span className="hidden xl:inline shrink-0 tabular-nums text-muted-foreground">{vg.dateText}</span>
            </div>
            {vg.pct != null && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <span className={cn('block h-full rounded-full', STATUS_FILL[st])} style={{ width: `${Math.round(vg.pct * 100)}%` }} />
              </div>
            )}
          </>
        ) : <span className="text-muted-foreground">—</span>}
      </div>

      {/* Valor */}
      <div className="md:text-right font-display text-[14px] font-semibold tabular-nums text-slate-800 dark:text-neutral-100">
        {hasValue ? fmtBRLValor(c.currentContractValue) : <span className="text-muted-foreground">—</span>}
      </div>
    </LeadLink>
  );
}

function ClientsView({ appUser, usersList, db }) {
  const { contractThresholdDays } = useGeneralConfig();
  // Responsável por cliente é quem vende. O professor não é dono de lead
  // (isSeller, em src/lib/acesso.js), então fica fora do filtro e do endereço.
  const sellers = useMemo(() => (usersList || []).filter(isSeller), [usersList]);

  // Situação e responsável vêm do endereço. O filtro de responsável é de toda
  // a equipe, como o do gestor (decisão do Johnny, 07/10/2026), então o link
  // com responsável abre igual para quem receber. O filtro de plano fica fora
  // desta entrega, porque o dado guarda o nome do plano e não o id.
  const paramsCtx = useMemo(() => ({
    users: sellers, situacoes: STATUS_OPTIONS, podeResp: true, respPadrao: [],
  }), [sellers]);
  const [{ status: statusFilters, resp: consultantFilters }, setParams] = useScreenParams('clientes', paramsCtx);
  const [planFilters, setPlanFilters] = useState([]);         // plano (multi)
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);

  // Fonte dos clientes (E1b): query própria em vez do prop global de leads.
  // clientsAllQuerySpec traz TODOS os leads com lifecycleBucket=='cliente' de
  // uma vez (getDocs, SEM orderBy — ver leadQueries). Não é ao vivo: ao trocar
  // de aba a tela remonta e refaz o fetch. Paginação real fica pro H.
  const spec = useMemo(() => clientsAllQuerySpec(), []);
  const { items: clientDocs, loading: clientsLoading } = usePagedLeads({
    db, path: LEADS_PATH, spec, specKey: 'clientes-all', enabled: !!db,
  });
  // Clientes = matriculados. Leads 'Venda' legados também entram (aparecem como
  // "Sem contrato"); a timeline é preservada (mesmo doc). Rede de segurança
  // (D4): lifecycleBucket=='cliente' é, por construção, exatamente isClientLead
  // (ver deriveLeadBucket) — refiltra client-side pra casar a semântica da aba
  // mesmo se algum doc vier com bucket divergente. Refiltro sai na PR G.
  const clientes = useMemo(
    () => (clientDocs || []).filter(l => isClientLead(l)),
    [clientDocs]
  );

  // Um relógio só por carga: o selo da situação e o texto da vigência de cada
  // linha saem do mesmo instante, então nunca discordam (a lista não é ao vivo).
  const now = useMemo(() => new Date(), [clientes, contractThresholdDays]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cada cliente com a situação do contrato, calculada uma vez por carga.
  const withStatus = useMemo(
    () => clientes.map((c) => ({ c, st: clientStatus(c, now, contractThresholdDays) })),
    [clientes, now, contractThresholdDays]
  );

  // Planos distintos presentes nos clientes (para o filtro de plano).
  const planItems = useMemo(() => {
    const set = new Set();
    clientes.forEach(c => { if (c.currentPlanName) set.add(c.currentPlanName); });
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR')).map((p) => ({ id: p, name: p }));
  }, [clientes]);
  // Plano escolhido que deixou de existir na lista (os clientes dele mudaram de
  // plano) sai do filtro, em vez de esvaziar a lista sem aparecer na pílula.
  const planSel = useMemo(() => planFilters.filter((p) => planItems.some((i) => i.id === p)), [planFilters, planItems]);

  // A carteira que a faixa conta: o que passa pelo responsável e pelo plano, e
  // ainda não pela situação. Assim os números dizem quanto de cada situação
  // sobra no recorte, e escolher uma situação não zera as outras.
  const base = useMemo(() => withStatus.filter(({ c }) => (
    (consultantFilters.length === 0 || consultantFilters.includes(c.consultantId))
    && (planSel.length === 0 || planSel.includes(c.currentPlanName))
  )), [withStatus, consultantFilters, planSel]);

  const counts = useMemo(() => {
    const out = {};
    base.forEach(({ st }) => { out[st] = (out[st] || 0) + 1; });
    return out;
  }, [base]);

  const filtered = useMemo(() => {
    // Ordena por vencimento mais próximo primeiro; quem não tem vai ao fim.
    const endOf = (c) => getSafeDateOrNull(c.currentContractEndsAt)?.getTime() ?? Infinity;
    return base
      .filter(({ st }) => statusFilters.length === 0 || statusFilters.includes(st))
      .sort((a, b) => endOf(a.c) - endOf(b.c));
  }, [base, statusFilters]);

  const visible = filtered.slice(0, visibleCount);

  const toggleStatus = (s) => setParams((v) => ({ status: v.status.includes(s) ? v.status.filter(x => x !== s) : [...v.status, s] }));
  const hasActiveFilters = statusFilters.length + consultantFilters.length + planSel.length > 0;
  // O ponto do botão do celular só fala dos filtros que moram no balão.
  const hasPillFilters = consultantFilters.length + planSel.length > 0;

  // Pílulas da barra, as mesmas do Pipeline, dos painéis e dos Relatórios.
  // `compact` é o balão do celular, onde cada controle ocupa a largura toda.
  // A situação não tem pílula: o filtro dela é a faixa da carteira, logo abaixo.
  const filterControls = (compact) => (
    <>
      <ConsultoresControl
        resp={consultantFilters}
        people={sellers}
        onResp={(ids) => setParams({ resp: ids })}
        compact={compact}
      />
      {planItems.length > 0 && (
        <MultiControl
          label="Plano" icon={Layers} noun="planos" allText="Todos" allLabel="Todos os planos"
          items={planItems} value={planSel} onValue={setPlanFilters} compact={compact}
        />
      )}
    </>
  );

  const loadingFirst = clientsLoading && clientes.length === 0;
  const subline = loadingFirst
    ? 'Carregando clientes…'
    : `${hasActiveFilters ? `${filtered.length} de ${clientes.length}` : clientes.length} clientes, do vencimento mais próximo ao mais distante`;

  return (
    <div className="-m-4 md:-m-8 h-[calc(100%+2rem)] md:h-[calc(100%+4rem)] flex flex-col animate-fade-in">
      {/* Cabeçalho no cartão dos painéis (FilterBar, o mesmo do Pipeline, do
          Gerencial e dos Relatórios): o título e a linha de apoio à esquerda,
          as pílulas de filtro à direita. */}
      <FilterBar className="shrink-0 md:px-7" title="Clientes" subline={subline}>
        <div className="hidden md:flex items-center gap-2">{filterControls(false)}</div>

        {/* No celular os filtros entram num balão, como no Pipeline: o botão
            acende e ganha um ponto quando há filtro ligado. */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={hasPillFilters ? 'Filtros de Clientes, há filtro ativo' : 'Filtros de Clientes'}
              className={cn(
                'relative md:hidden size-[38px] shrink-0 rounded-[11px] border grid place-items-center transition-colors',
                FOCUS_RING,
                hasPillFilters
                  ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-500/15 dark:border-brand-500/30 dark:text-brand-300'
                  : 'bg-card border-border text-muted-foreground'
              )}
            >
              <SlidersHorizontal className="size-[17px]" aria-hidden="true" />
              {hasPillFilters && <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-brand-600" />}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" aria-label="Filtros" className="flex w-[288px] max-h-(--radix-popover-content-available-height) flex-col gap-2.5 overflow-y-auto overscroll-y-contain rounded-[14px] border-border shadow-card-lg [&>*]:shrink-0">
            {filterControls(true)}
          </PopoverContent>
        </Popover>
      </FilterBar>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 md:px-7 pt-1 pb-7">
        <div className="flex flex-col gap-4">
          {/* Com situação no endereço a faixa fica, mesmo com o recorte vazio: sem
              a pílula, ela é o único jeito de limpar a situação. */}
          {(base.length > 0 || statusFilters.length > 0) && (
            <CarteiraCard
              counts={counts}
              total={base.length}
              selected={statusFilters}
              onToggle={toggleStatus}
              onClear={() => setParams({ status: [] })}
            />
          )}

          {/* Lista em cartão */}
          <div className="bg-white dark:bg-neutral-900 border border-border rounded-[18px] overflow-hidden shadow-card">
            <div className={cn('hidden md:grid md:gap-4 h-11 items-center px-6 border-b border-slate-100 dark:border-neutral-800 text-[12.5px] font-medium text-muted-foreground', GRID)}>
              <span>Cliente</span><span>Plano</span><span>Situação</span><span>Vigência</span><span className="text-right">Valor</span>
            </div>

            {loadingFirst ? (
              <div className="py-16 text-center grid place-items-center gap-2">
                <GraduationCap className="size-[22px] opacity-40 text-slate-400 animate-pulse" />
                <p className="text-[13px] text-slate-400 dark:text-neutral-500">Carregando clientes…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center grid place-items-center gap-2">
                <GraduationCap className="size-[22px] opacity-40 text-slate-400" />
                <p className="text-[14px] font-semibold text-gray-700 dark:text-neutral-200">Nenhum cliente encontrado</p>
                {/* O convite para matricular é de quem matricula. O professor não matricula. */}
                {can(appUser, ACTIONS.CONTRATO_EDITAR) && (
                  <p className="text-[12.5px] text-slate-400 dark:text-neutral-500">Matricule um lead pelo Kanban ou pela ficha para vê-lo aqui.</p>
                )}
              </div>
            ) : (
              visible.map(({ c, st }) => <ClientRow key={c.id} c={c} st={st} now={now} />)
            )}
          </div>

          {filtered.length > visibleCount && (
            <div className="flex justify-center">
              <Btn kind="soft" onClick={() => setVisibleCount(n => n + LIST_PAGE_SIZE)}>
                Carregar mais ({visible.length} de {filtered.length})
              </Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { ClientsView };
