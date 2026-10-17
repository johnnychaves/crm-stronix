import { useMemo, useState } from 'react';
import { ArrowUpDown, CircleDot, Layers, SlidersHorizontal, Users } from 'lucide-react';
import { normalizeLeadDoc } from '../lib/leads.js';
import { isSeller } from '../lib/acesso.js';
import { LIST_PAGE_SIZE, buildInteractionIndex, lastInteractionDateOf, isHotLeadFromDate } from '../lib/leadStatus.js';
import { usePagedLeads } from '../hooks/usePagedLeads.js';
import { useScreenParams } from '../hooks/useScreenParams.js';
import { ORDENS_DE_LEADS } from '../lib/screenParams.js';
import { allLeadsQuerySpec } from '../lib/leadQueries.js';
import { LEADS_PATH } from '../lib/firebase.js';
import { getDefaultFunnel, isItemInFunnel } from '../lib/funnels.js';
import { isClientFunnel } from '../lib/crm/scope.js';
import { getKanbanColumnAccent } from '../lib/kanban.js';
import { nextActionOf, createdAgoOf, trailOf, sortLeads, isLeadOverdue } from '../lib/leadsList.js';
import { cn } from '@/lib/utils';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Btn } from '../components/ui/Btn.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover.jsx';
import { FOCUS_RING } from '../components/focusRing.js';
import { LeadLink } from '../components/nav/AppLink.jsx';
import { ContactPhone } from '../components/profile/ContactPhone.jsx';
import { FilterBar, FilterChip } from './dashboard/DashFilterBar.jsx';
import { ConsultoresControl, MultiControl, OrigemControl } from './relatorios/RelatoriosToolbar.jsx';

// Cor da etapa (para o trilho e para o filtro de fase). Venda/Perda mapeiam para
// os mesmos tokens usados no Kanban; as demais vêm da cor configurada da etapa.
const statusColorOf = (name, statuses) =>
  name === 'Venda' ? 'green'
    : name === 'Perda' ? 'gray'
      : (statuses || []).find(s => s.name === name)?.color || 'gray';

// Colunas da lista: o cabeçalho e cada linha usam a mesma grade, sem largura
// mínima, para o texto que não cabe ser cortado em vez de estourar a linha.
const GRID = 'md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.25fr)_minmax(0,1.1fr)_120px]';

// O que cada tom da próxima ação pinta. Atrasado e hoje chamam, o resto fica quieto.
const NEXT_TONE = {
  late: 'text-rose-600 dark:text-rose-400',
  today: 'text-amber-700 dark:text-amber-400',
  soon: 'text-slate-900 dark:text-white',
  later: 'font-medium text-muted-foreground',
  none: 'font-medium text-muted-foreground',
};

// Cada ordem do endereço (ORDENS_DE_LEADS) com o nome na pílula e o fim da linha
// de apoio do título. As opções saem da lista do endereço, então ordem nova
// sem texto aqui cai no teste, e não numa tela com "undefined".
const ORDEM = {
  cadastro: { label: 'Cadastro mais novo', texto: 'do cadastro mais novo ao mais antigo' },
  acao: { label: 'Próxima ação', texto: 'pela próxima ação, com o atrasado primeiro' },
  contato: { label: 'Mais tempo sem contato', texto: 'de quem está há mais tempo sem contato' },
};
const ORDEM_OPCOES = ORDENS_DE_LEADS.map((key) => ({ key, label: ORDEM[key]?.label }));
const PERDA_HATCH = 'repeating-linear-gradient(135deg, transparent 0 4px, rgba(255,255,255,.7) 4px 8px)';

// O trilho da fase: uma barra por fase aberta do funil, cheia até a fase do lead,
// e o nome da fase embaixo. Venda enche tudo em verde, e Perda em cinza listrado.
function FaseTrail({ status, stageNames, hex }) {
  const t = trailOf(status, stageNames);
  return (
    <div className="min-w-0">
      <div aria-hidden="true" className="mb-1.5 flex gap-1">
        {stageNames.map((name, i) => (
          <span
            key={name}
            title={name}
            className={cn('h-[7px] flex-1 rounded-full', i >= t.filled && 'bg-muted')}
            style={i < t.filled
              ? (t.kind === 'perda' ? { backgroundColor: '#cbd5e1', backgroundImage: PERDA_HATCH } : { backgroundColor: hex })
              : undefined}
          />
        ))}
      </div>
      <div className="truncate text-[13px] font-semibold" style={{ color: `color-mix(in srgb, ${hex} 70%, var(--foreground))` }}>
        {t.kind === 'venda' ? 'Venda fechada' : t.kind === 'perda' ? 'Perdido' : status}
        {t.position && <span className="ml-1.5 text-[12px] font-medium text-muted-foreground">{t.position} de {t.total}</span>}
      </div>
    </div>
  );
}

function LeadsView({ interactions, statuses, usersList, funnels: allFunnels, sources, selectedFunnelId: savedFunnelId, setSelectedFunnelId: rememberFunnel, db }) {
  // Funil de clientes (Renovações, Vencidos, Upgrade) não guarda lead: o Pipeline
  // projeta os clientes dele por consulta. Aqui ele só daria lista vazia, então
  // fica fora do seletor e do endereço. O de Indicações também é de sistema,
  // mas é funil de lead e fica: quem decide é o isClientFunnel, nunca um atalho solto.
  const funnels = useMemo(() => (allFunnels || []).filter(f => !isClientFunnel(f)), [allFunnels]);
  // Responsável é quem vende: o professor não é dono de lead e fica fora do
  // filtro e do endereço (isSeller, em src/lib/acesso.js).
  const sellers = useMemo(() => (usersList || []).filter(isSeller), [usersList]);

  // Fonte dos leads (G1a): query própria em vez do prop global. allLeadsQuerySpec
  // traz TODOS os leads de TODOS os buckets (Venda/Perda inclusive) de uma vez;
  // a tela segue filtrando/ordenando/paginando client-side EXATAMENTE como antes
  // — só muda a fonte. getDocs (não ao vivo): ao trocar de aba, remonta e refaz o
  // fetch. mapDoc = normalizeLeadDoc pro shape bater com o que o App entregava
  // (mesma normalização de App.jsx). Paginação real (server-side) fica pro H.
  const leadsSpec = useMemo(() => allLeadsQuerySpec(), []);
  const { items: leads, loading: leadsLoading } = usePagedLeads({
    db, path: LEADS_PATH, spec: leadsSpec, specKey: 'leads-all', mapDoc: normalizeLeadDoc, enabled: !!db,
  });

  const defaultFunnelId = useMemo(() => getDefaultFunnel(funnels)?.id || null, [funnels]);

  // Funil, fase, responsável, origem e ordem vêm do endereço. A fase viaja
  // como CÓDIGO (o id da etapa, mais venda e perda nas duas colunas terminais)
  // e a tela recebe o nome, que é o que ela guarda: renomear a etapa em
  // Configurações não quebra um link guardado. As etapas vão como função do
  // funil, porque o funil é lido antes da fase na mesma passada, e é isso que
  // apaga sozinha a fase de um funil que deixou de ser o escolhido.
  // O funil guardado vem do Pipeline também, e lá pode ser um funil de sistema:
  // quando não serve aqui, vale o funil padrão.
  const funilPadrao = (funnels || []).some(f => f.id === savedFunnelId) ? savedFunnelId : defaultFunnelId;
  // Origem: as do catálogo mais as que algum lead guarda, que o catálogo pode ter perdido.
  const origens = useMemo(() => {
    const names = new Set((sources || []).map(s => s?.name).filter(Boolean));
    (leads || []).forEach(l => { if (l.source) names.add(l.source); });
    return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [sources, leads]);
  const paramsCtx = useMemo(() => ({
    users: sellers,
    funis: funnels,
    funilPadrao,
    podeResp: true,
    respPadrao: [],
    origens,
    etapas: (fid) => (statuses || []).filter(s => isItemInFunnel(s, fid, defaultFunnelId)),
  }), [sellers, funnels, funilPadrao, origens, statuses, defaultFunnelId]);
  const [{ funnel, stage: statusFilters, resp: consultantFilters, origem: origemFilter, order }, setParams] =
    useScreenParams('leads', paramsCtx);
  const selectedFunnelId = funnel;

  // "Carregar mais" volta às primeiras linhas quando o recorte ou a ordem mudam:
  // a contagem guarda o recorte a que pertence, sem effect para zerá-la.
  const recorte = [selectedFunnelId, statusFilters.join(), consultantFilters.join(), origemFilter || '', order].join('|');
  const [shown, setShown] = useState({ recorte, n: LIST_PAGE_SIZE });
  const visibleCount = shown.recorte === recorte ? shown.n : LIST_PAGE_SIZE;

  // Trocar de funil guarda a escolha no navegador e limpa a fase na mesma
  // navegação: as etapas do funil novo são outras.
  const pickFunnel = (id) => { rememberFunnel(id); setParams({ funnel: id, stage: [] }); };

  // Índice leadId → última interação (O(interações)); alimenta o 🔥 da tabela e
  // a ordem por tempo sem contato sem recomputar interactions.filter() por linha.
  const interactionIndex = useMemo(() => buildInteractionIndex(interactions), [interactions]);

  // Filtragem 100% pelas pílulas da barra (sem busca textual — removida no redesign 6a).
  const filteredLeads = useMemo(() => {
    const matched = (leads || []).filter(l => {
      const matchFunnel = isItemInFunnel(l, selectedFunnelId, defaultFunnelId);
      const matchStatus = statusFilters.length === 0 || statusFilters.includes(l.status);
      const matchConsultant = consultantFilters.length === 0 || consultantFilters.includes(l.consultantId);
      const matchOrigem = !origemFilter || l.source === origemFilter;
      return matchFunnel && matchStatus && matchConsultant && matchOrigem;
    });
    return sortLeads(matched, order, (l) => lastInteractionDateOf(l, interactionIndex));
  }, [leads, interactionIndex, statusFilters, origemFilter, order, consultantFilters, selectedFunnelId, defaultFunnelId]);

  const visibleLeads = filteredLeads.slice(0, visibleCount);

  // Contagem por funil (nota de cada opção do seletor de funil).
  const funnelCounts = useMemo(() => {
    const map = new Map();
    (funnels || []).forEach(f => map.set(f.id, (leads || []).filter(l => isItemInFunnel(l, f.id, defaultFunnelId)).length));
    return map;
  }, [funnels, leads, defaultFunnelId]);

  const baseLeads = useMemo(
    () => (leads || []).filter(l => isItemInFunnel(l, selectedFunnelId, defaultFunnelId)),
    [leads, selectedFunnelId, defaultFunnelId]
  );

  const statusesForFunnel = (statuses || []).filter(s => isItemInFunnel(s, selectedFunnelId, defaultFunnelId));
  // O trilho tem uma barra por fase aberta do funil, na ordem das etapas.
  const stageNames = statusesForFunnel.map(s => s.name);
  const phaseItems = [...stageNames, 'Venda', 'Perda'].map(n => ({ id: n, name: n }));
  const hexOf = (name) => getKanbanColumnAccent(statusColorOf(name, statuses)).border;

  const funnelName = (funnels || []).find(f => f.id === selectedFunnelId)?.name || '';
  const funnelOptions = (funnels || []).map(f => ({ key: f.id, label: f.name, note: String(funnelCounts.get(f.id) ?? 0) }));

  const hasActiveFilters = statusFilters.length + consultantFilters.length + (origemFilter ? 1 : 0) > 0;
  // A ordem não é filtro, então não entra na contagem do cabeçalho, mas mora no balão do celular e acende o ponto dele.
  const hasPillState = hasActiveFilters || order !== 'cadastro';

  // Pílulas da barra, as mesmas do Pipeline, dos painéis e dos Relatórios.
  // `compact` é o balão do celular, onde cada controle ocupa a largura toda.
  const filterControls = (compact) => (
    <>
      {funnelOptions.length > 0 && (
        <FilterChip icon={Layers} label="Funil" valueText={funnelName} active={false} options={funnelOptions} value={selectedFunnelId} onPick={pickFunnel} />
      )}
      <ConsultoresControl
        resp={consultantFilters}
        people={sellers}
        onResp={(ids) => setParams({ resp: ids })}
        compact={compact}
      />
      {origens.length > 0 && (
        <OrigemControl origem={origemFilter} origens={origens} onOrigem={(o) => setParams({ origem: o })} compact={compact} />
      )}
      <MultiControl
        label="Fase" icon={CircleDot} noun="fases" allText="Todas" allLabel="Todas as fases"
        items={phaseItems} value={statusFilters} onValue={(ids) => setParams({ stage: ids })} compact={compact}
      />
      <FilterChip
        icon={ArrowUpDown} label="Ordem" valueText={ORDEM_OPCOES.find(o => o.key === order)?.label || ''}
        active={order !== 'cadastro'} options={ORDEM_OPCOES} value={order} onPick={(k) => setParams({ order: k })}
      />
    </>
  );

  const loadingFirst = leadsLoading && (leads || []).length === 0;
  const subline = loadingFirst
    ? 'Carregando leads…'
    : `${hasActiveFilters ? `${filteredLeads.length} de ${baseLeads.length}` : baseLeads.length} leads${funnelName ? ` no funil ${funnelName}` : ''}, ${ORDEM[order]?.texto}`;

  const now = new Date();

  return (
    <div className="-m-4 md:-m-8 h-[calc(100%+2rem)] md:h-[calc(100%+4rem)] flex flex-col animate-fade-in">
      {/* Cabeçalho no cartão dos painéis (FilterBar, o mesmo do Pipeline, dos
          Clientes e dos Relatórios): o título e a linha de apoio à esquerda,
          as pílulas de filtro à direita. A planilha dos leads é do relatório,
          então esta tela não exporta. */}
      <FilterBar className="shrink-0 md:px-7" title="Todos os leads" subline={subline}>
        <div className="hidden md:flex items-center gap-2">{filterControls(false)}</div>

        {/* No celular os filtros entram num balão, como no Pipeline: o botão
            acende e ganha um ponto quando há filtro ligado. */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={hasPillState ? 'Filtros dos leads, há filtro ativo' : 'Filtros dos leads'}
              className={cn(
                'relative md:hidden size-[38px] shrink-0 rounded-[11px] border grid place-items-center transition-colors',
                FOCUS_RING,
                hasPillState
                  ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-500/15 dark:border-brand-500/30 dark:text-brand-300'
                  : 'bg-card border-border text-muted-foreground'
              )}
            >
              <SlidersHorizontal className="size-[17px]" aria-hidden="true" />
              {hasPillState && <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-brand-600" />}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" aria-label="Filtros" className="flex w-[288px] max-h-(--radix-popover-content-available-height) flex-col gap-2.5 overflow-y-auto overscroll-y-contain rounded-[14px] border-border shadow-card-lg [&>*]:shrink-0">
            {filterControls(true)}
          </PopoverContent>
        </Popover>
      </FilterBar>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 md:px-7 pt-1 pb-7">
        <div className="flex flex-col gap-4">
          {/* Lista em cartão */}
          <div className="bg-white dark:bg-neutral-900 border border-border rounded-[18px] overflow-hidden shadow-card">
            <div className={cn('hidden md:grid md:gap-4 h-11 items-center px-6 border-b border-slate-100 dark:border-neutral-800 text-[12.5px] font-medium text-muted-foreground', GRID)}>
              <span>Lead</span><span>Fase no funil</span><span>Próxima ação</span><span className="text-right">Cadastro</span>
            </div>

            {loadingFirst ? (
              <div className="py-16 text-center grid place-items-center gap-2">
                <Users className="size-[22px] opacity-40 text-slate-400 animate-pulse" />
                <p className="text-[13px] text-slate-400 dark:text-neutral-500">Carregando leads…</p>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="py-16 text-center grid place-items-center gap-2">
                <Users className="size-[22px] opacity-40 text-slate-400" />
                <p className="text-[14px] font-semibold text-gray-700 dark:text-neutral-200">Nenhum lead encontrado</p>
                <p className="text-[12.5px] text-slate-400 dark:text-neutral-500">Mude ou limpe os filtros da barra.</p>
              </div>
            ) : (
              visibleLeads.map(l => {
                const isOverdue = isLeadOverdue(l, now);
                const isHot = isHotLeadFromDate(l, lastInteractionDateOf(l, interactionIndex));
                const consultantFirst = (l.consultantName || '').trim().split(/\s+/)[0] || '';
                const next = nextActionOf(l, now, Boolean(isOverdue));
                return (
                  <LeadLink
                    key={l.id}
                    leadId={l.id}
                    draggable={false}
                    className={cn(
                      'grid grid-cols-1 gap-2 md:gap-4 md:items-center px-4 md:px-6 py-3 border-b border-slate-100 dark:border-neutral-800 last:border-b-0 cursor-pointer bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-white/[0.03] focus-visible:ring-inset focus-visible:anel-foco',
                      GRID
                    )}
                  >
                    {/* Lead */}
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={l.name} size={34} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[14px] font-semibold text-slate-900 dark:text-white">{l.name}</span>
                          {isHot && <span className="text-[11px] shrink-0" title="Lead com atividade recente ou agendamento próximo" aria-label="Lead quente">🔥</span>}
                        </div>
                        <div className="mt-px flex items-center gap-2.5 text-[12px] text-muted-foreground tabular-nums">
                          <span className="inline-flex"><ContactPhone lead={l} /></span>
                          {consultantFirst && <span className="font-medium text-brand-700 dark:text-brand-300">@{consultantFirst}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Fase no funil */}
                    <FaseTrail status={l.status} stageNames={stageNames} hex={hexOf(l.status)} />

                    {/* Próxima ação */}
                    <div className="min-w-0">
                      <div className={cn('truncate text-[13px] font-semibold', NEXT_TONE[next.tone])}>{next.text}</div>
                      {next.sub && <div className="truncate text-[12px] text-muted-foreground tabular-nums">{next.sub}</div>}
                    </div>

                    {/* Cadastro */}
                    <div className="md:text-right tabular-nums">
                      <span className="block text-[12.5px] font-medium text-slate-700 dark:text-neutral-200">{l.createdAt?.toLocaleDateString('pt-BR') || ''}</span>
                      <span className="text-[12px] text-muted-foreground">{l.createdAt ? createdAgoOf(l.createdAt, now) : ''}</span>
                    </div>
                  </LeadLink>
                );
              })
            )}
          </div>

          {filteredLeads.length > visibleCount && (
            <div className="flex justify-center">
              <Btn kind="soft" onClick={() => setShown({ recorte, n: visibleCount + LIST_PAGE_SIZE })}>
                Carregar mais ({visibleLeads.length} de {filteredLeads.length})
              </Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export { LeadsView };
