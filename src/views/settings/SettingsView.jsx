import { useState } from 'react';
import { ArrowRightLeft, ChevronRight, CreditCard, Filter, Kanban, Settings, SlidersHorizontal, Tag, ThumbsDown, Users } from 'lucide-react';
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
// SETTINGS — DESIGN PRIMITIVES
// ==========================================




function SettingsView({ db, statuses, sources, usersList, appUser, tags, lossReasons, leads, funnels, modalities, trialClassOptions, units, metaWeekdays }) {
  const [activeTab, setActiveTab] = useState('users');
  const [selectedFunnelInTab, setSelectedFunnelInTab] = useState(null);

  const usersCount = (usersList || []).length;
  const funnelsCount = (funnels || []).length;
  const tagsCount = (tags || []).length;
  const sourcesCount = (sources || []).length;
  const lossCount = (lossReasons || []).length;
  const modalitiesCount = (modalities || []).length;

  const tabs = [
    { id: 'users',       label: 'Consultores',      hint: 'Time, credenciais e turnos',       icon: <Users size={15} />,         badge: usersCount },
    { id: 'general',     label: 'Configurações gerais', hint: 'Modalidades e aulas experimentais', icon: <SlidersHorizontal size={15} />, badge: modalitiesCount },
    { id: 'billing',     label: 'Plano & Faturas',  hint: 'Assinatura, faturas e renovação',   icon: <CreditCard size={15} />,    badge: null },
    { id: 'transfer',    label: 'Migrar leads',     hint: 'Transferir base entre consultores', icon: <ArrowRightLeft size={15} />, badge: null },
    { id: 'statuses',    label: 'Funil pipeline',   hint: 'Etapas do processo comercial',     icon: <Kanban size={15} />,        badge: funnelsCount },
    { id: 'tags',        label: 'Etiquetas',        hint: 'Marcadores para segmentar leads',  icon: <Tag size={15} />,           badge: tagsCount },
    { id: 'sources',     label: 'Origens',          hint: 'De onde os leads chegam',          icon: <Filter size={15} />,        badge: sourcesCount },
    { id: 'lossReasons', label: 'Motivos de perda', hint: 'Justificativas padrão de perda',   icon: <ThumbsDown size={15} />,    badge: lossCount }
  ];

  const goToTab = (tab) => {
    setActiveTab(tab);
    if (tab !== 'statuses') setSelectedFunnelInTab(null);
  };

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
          Configure o seu CRM — equipe, funil, marcadores e regras de negócio.
        </p>
      </section>

      <div className="grid grid-cols-12 gap-6">
        {/* Tabs nav */}
        <aside className="col-span-12 lg:col-span-3">
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-card p-2 space-y-1 lg:sticky lg:top-20">
            {tabs.map(t => (
              <SettingsTabItem
                key={t.id}
                icon={t.icon}
                label={t.label}
                hint={t.hint}
                badge={t.badge}
                active={activeTab === t.id}
                onClick={() => goToTab(t.id)}
              />
            ))}
          </div>
        </aside>

        {/* Content */}
        <div className="col-span-12 lg:col-span-9 space-y-6" key={activeTab}>
          {activeTab === 'users' && <ManageUsersTab db={db} appUser={appUser} />}
          {activeTab === 'general' && <ManageGeneralSettingsTab db={db} modalities={modalities} trialClassOptions={trialClassOptions} units={units} leads={leads} metaWeekdays={metaWeekdays} />}
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
