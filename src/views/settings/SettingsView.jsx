import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightLeft, ChevronRight, CreditCard, Filter, Kanban, Search, Settings, SlidersHorizontal, Tag, ThumbsDown, Users } from 'lucide-react';
import { SettingsTabItem } from '../../components/ui/SettingsCard.jsx';
import { PlanInvoicesTab } from './PlanInvoicesTab.jsx';
import { ManageUsersTab } from './ManageUsersTab.jsx';
import { ManageFunnelsTab } from './ManageFunnelsTab.jsx';
import { ManageStatusesTab } from './ManageStatusesTab.jsx';
import { ManageSourcesTab } from './ManageSourcesTab.jsx';
import { ManageTagsTab } from './ManageTagsTab.jsx';
import { ManageLossReasonsTab } from './ManageLossReasonsTab.jsx';
import { ManageGeneralSettingsTab } from './ManageGeneralSettingsTab.jsx';
import { TransferLeadsTab } from './TransferLeadsTab.jsx';

// ==========================================
// SETTINGS — trilho agrupado + busca universal (⌘K)
// Navegação por GRUPOS (Equipe / Operação / Catálogos), busca que filtra o
// trilho por nome/descrição/sinônimos, e pontos de atenção quando uma seção
// pede ação do gestor. O conteúdo de cada aba segue nos componentes ManageX.
// ==========================================

// Busca sem acento/caixa ("critico" acha "SLA crítico").
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function SettingsView({ db, statuses, sources, usersList, appUser, tags, lossReasons, leads, funnels, modalities, trialClassOptions, units, metaWeekdays }) {
  const [activeTab, setActiveTab] = useState('users');
  const [selectedFunnelInTab, setSelectedFunnelInTab] = useState(null);
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);

  const usersCount = (usersList || []).length;
  const funnelsCount = (funnels || []).length;
  const tagsCount = (tags || []).length;
  const sourcesCount = (sources || []).length;
  const lossCount = (lossReasons || []).length;
  const modalitiesCount = (modalities || []).length;

  // Pontos de atenção: condições REAIS que pedem ação (tooltip no dot âmbar
  // + aviso no cabeçalho da seção). Nada de heurística decorativa.
  const usersNoAuth = (usersList || []).filter(u => !u.authUid).length;
  const attention = useMemo(() => ({
    users: usersNoAuth > 0 ? `${usersNoAuth} membro${usersNoAuth === 1 ? '' : 's'} da equipe sem acesso vinculado` : null,
    statuses: funnelsCount === 0 ? 'Nenhum funil configurado — o Kanban precisa de um' : null,
    sources: sourcesCount === 0 ? 'Nenhuma origem cadastrada — os leads chegam sem canal' : null,
    lossReasons: lossCount === 0 ? 'Nenhum motivo de perda — descartes ficam sem justificativa' : null,
  }), [usersNoAuth, funnelsCount, sourcesCount, lossCount]);

  // Trilho agrupado. `keywords` alimenta a busca com os sinônimos que o gestor
  // realmente digita ("sla", "tags", "senha", "transferir"...).
  const groups = useMemo(() => ([
    {
      label: 'Equipe',
      items: [
        { id: 'users', label: 'Equipe', hint: 'Time, papéis e turnos', icon: <Users size={15} />, badge: usersCount, keywords: 'consultores gestor admin vagas extra convite senha acesso turno membros' },
        { id: 'transfer', label: 'Migrar leads', hint: 'Transferir base entre consultores', icon: <ArrowRightLeft size={15} />, badge: null, keywords: 'transferir carteira redistribuir mover base' },
      ],
    },
    {
      label: 'Operação',
      items: [
        { id: 'general', label: 'Regras gerais', hint: 'Meta, SLA, aulas e modalidades', icon: <SlidersHorizontal size={15} />, badge: modalitiesCount, keywords: 'sla atraso critico meta diaria dias semana aulas experimentais quantidade modalidades unidades cidade prospeccao volume acoes piso' },
        // "Plano & faturas": por ora só quando o DONO entra via "Acessar como"
        // (impersonando). Para liberar geral, troque a condição por `true`.
        ...(appUser?.impersonating ? [{ id: 'billing', label: 'Plano & faturas', hint: 'Assinatura, faturas e renovação', icon: <CreditCard size={15} />, badge: null, keywords: 'plano fatura pagamento assinatura renovacao preco boleto pix cartao' }] : []),
      ],
    },
    {
      label: 'Catálogos',
      items: [
        { id: 'statuses', label: 'Funis', hint: 'Etapas do processo comercial', icon: <Kanban size={15} />, badge: funnelsCount, keywords: 'funil pipeline etapas fases kanban negociacao' },
        { id: 'tags', label: 'Etiquetas', hint: 'Marcadores para segmentar leads', icon: <Tag size={15} />, badge: tagsCount, keywords: 'tags marcadores segmentar rotulos' },
        { id: 'sources', label: 'Origens', hint: 'De onde os leads chegam', icon: <Filter size={15} />, badge: sourcesCount, keywords: 'fontes canais instagram facebook indicacao google whatsapp' },
        { id: 'lossReasons', label: 'Motivos de perda', hint: 'Justificativas padrão de perda', icon: <ThumbsDown size={15} />, badge: lossCount, keywords: 'perda descarte justificativa preco concorrencia' },
      ],
    },
  ]), [usersCount, modalitiesCount, funnelsCount, tagsCount, sourcesCount, lossCount, appUser]);

  // Busca universal: filtra o próprio trilho; Enter abre o 1º resultado.
  const q = norm(query.trim());
  const visibleGroups = useMemo(() => {
    if (!q) return groups;
    return groups
      .map(g => ({ ...g, items: g.items.filter(it => norm(`${it.label} ${it.hint} ${it.keywords}`).includes(q)) }))
      .filter(g => g.items.length > 0);
  }, [groups, q]);
  const firstMatch = visibleGroups[0]?.items[0] || null;

  // ⌘K / Ctrl+K foca a busca de qualquer lugar da tela.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const goToTab = (tab) => {
    setActiveTab(tab);
    setQuery('');
    if (tab !== 'statuses') setSelectedFunnelInTab(null);
  };

  const onSearchKeyDown = (e) => {
    if (e.key === 'Enter' && firstMatch) goToTab(firstMatch.id);
    if (e.key === 'Escape') setQuery('');
  };

  const allItems = groups.flatMap(g => g.items);
  const activeItem = allItems.find(i => i.id === activeTab) || allItems[0];
  const funnelInTab = (funnels || []).find(f => f.id === selectedFunnelInTab);

  return (
    <div className="animate-fade-in font-sans space-y-6">
      {/* Page hero */}
      <section>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Settings size={13} className="text-brand-600" /> Configurações
        </div>
        <h2 className="mt-1.5 font-display text-[24px] font-semibold tracking-tight leading-tight">
          Ajustes da operação
        </h2>
        <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
          Equipe, regras do jogo e catálogos do funil — tudo num lugar só.
        </p>
      </section>

      <div className="grid grid-cols-12 gap-6">
        {/* Trilho de navegação */}
        <aside className="col-span-12 lg:col-span-3">
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-card p-2 lg:sticky lg:top-20">
            {/* Busca universal */}
            <div className="relative mb-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                ref={searchRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Buscar ajuste…"
                className="w-full h-10 pl-9 pr-12 rounded-xl text-[13px] bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none placeholder:text-slate-400 transition"
              />
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 border border-slate-200 dark:border-white/[0.1] rounded px-1.5 py-0.5 pointer-events-none">⌘K</kbd>
            </div>

            {visibleGroups.map(g => (
              <div key={g.label}>
                <div className="px-3 pt-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{g.label}</div>
                <div className="space-y-0.5">
                  {g.items.map(t => (
                    <SettingsTabItem
                      key={t.id}
                      icon={t.icon}
                      label={t.label}
                      hint={t.hint}
                      badge={t.badge}
                      attention={attention[t.id]}
                      active={activeTab === t.id}
                      onClick={() => goToTab(t.id)}
                    />
                  ))}
                </div>
              </div>
            ))}

            {q && !firstMatch && (
              <div className="px-3 py-6 text-center text-[12px] text-slate-400">
                Nenhum ajuste encontrado para “{query.trim()}”.
              </div>
            )}
          </div>
        </aside>

        {/* Conteúdo da seção */}
        <div className="col-span-12 lg:col-span-9 space-y-5" key={activeTab}>
          {/* Cabeçalho da seção ativa */}
          <div className="flex items-end justify-between gap-3 flex-wrap pb-4 border-b border-slate-200/70 dark:border-white/[0.06]">
            <div>
              <h3 className="font-display text-[19px] font-bold tracking-tight leading-tight">{activeItem?.label}</h3>
              <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5">{activeItem?.hint}</p>
            </div>
            {attention[activeTab] && (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-500/12 dark:text-amber-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> {attention[activeTab]}
              </span>
            )}
          </div>

          {activeTab === 'users' && <ManageUsersTab db={db} appUser={appUser} />}
          {activeTab === 'general' && <ManageGeneralSettingsTab db={db} modalities={modalities} trialClassOptions={trialClassOptions} units={units} leads={leads} metaWeekdays={metaWeekdays} usersList={usersList} />}
          {activeTab === 'billing' && <PlanInvoicesTab />}
          {activeTab === 'statuses' && !selectedFunnelInTab && (
            <ManageFunnelsTab db={db} funnels={funnels} statuses={statuses} leads={leads} onSelectFunnel={setSelectedFunnelInTab} />
          )}
          {activeTab === 'statuses' && selectedFunnelInTab && (
            <div className="space-y-3">
              <button
                onClick={() => setSelectedFunnelInTab(null)}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/10 dark:hover:bg-brand-500/15 px-3 py-2 rounded-lg transition active:scale-95"
              >
                <ChevronRight size={14} className="rotate-180" />
                Voltar para funis
              </button>
              <ManageStatusesTab db={db} statuses={statuses} leads={leads} funnelId={selectedFunnelInTab} funnelName={funnelInTab?.name} />
            </div>
          )}
          {activeTab === 'sources' && <ManageSourcesTab db={db} sources={sources} leads={leads} />}
          {activeTab === 'transfer' && <TransferLeadsTab db={db} usersList={usersList} appUser={appUser} leads={leads} />}
          {activeTab === 'tags' && <ManageTagsTab db={db} tags={tags} leads={leads} />}
          {activeTab === 'lossReasons' && <ManageLossReasonsTab db={db} lossReasons={lossReasons} leads={leads} />}
        </div>
      </div>
    </div>
  );
}

export { SettingsView };
