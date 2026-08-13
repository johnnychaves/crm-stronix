import { useCallback, useMemo, useState } from 'react';
import { ArrowRightLeft, CalendarClock, Gauge, Handshake, Kanban, Library, Target, Users } from 'lucide-react';
import { SettingsRailGroup, SettingsRailItem } from '../../components/ui/SettingsCard.jsx';
import { buildSetupState } from '../../lib/settingsSetup.js';
import { usePagedLeads } from '../../hooks/usePagedLeads.js';
import { allLeadsQuerySpec } from '../../lib/leadQueries.js';
import { LEADS_PATH } from '../../lib/firebase.js';
import { normalizeLeadDoc } from '../../lib/leads.js';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { OverviewSection } from './OverviewSection.jsx';
import { TeamAccessSection } from './TeamAccessSection.jsx';
import { TransferSection } from './TransferLeadsTab.jsx';
import { ReferralOwnersSection } from './ReferralOwnersSection.jsx';
import { pendingReferralOwners } from '../../lib/referrals.js';
import { PaceSection } from './PaceSection.jsx';
import { SchedulingSection } from './SchedulingSection.jsx';
import { FunnelsSection } from './FunnelsSection.jsx';
import { CatalogsSection } from './CatalogsSection.jsx';

// ==========================================
// CONFIGURAÇÕES — sete destinos agrupados por intenção
//
// Redesign 2026-07: as dez seções do trilho plano viraram sete, agrupadas em
// PESSOAS / COMO A OPERAÇÃO RODA / VOCABULÁRIO DO FUNIL, com uma Visão geral na
// frente respondendo "o que falta configurar e o que pede atenção". A busca ⌘K
// saiu — com sete destinos, a hierarquia resolve.
//
// Cada seção renderiza o próprio cabeçalho e as próprias ações; aqui ficam só o
// trilho, o roteamento e os dados compartilhados.
// ==========================================

// Mapa do tab antigo (App.jsx ainda navega por ele) para o destino novo.
const LEGACY_TABS = {
  users: 'team',
  transfer: 'transfer',
  general: 'pace',
  statuses: 'funnels',
  tags: 'catalogs',
  sources: 'catalogs',
  plans: 'catalogs',
  lossReasons: 'catalogs',
  dores: 'catalogs'
};

const LEGACY_FOCUS = { tags: 'tags', sources: 'sources', plans: 'plans', lossReasons: 'loss', dores: 'dores' };

function SettingsView({
  initialTab, db, statuses, sources, usersList, appUser, tags, lossReasons,
  dores, funnels, modalities, planos, trialClassOptions, units, metaWeekdays
}) {
  // Fonte de leads das Configurações (G1-flip): TODOS os buckets por query
  // própria em vez do prop global (que virou só 'ativo' no flip). As seções
  // contam uso e fazem cascata de renomear/excluir sobre clientes e perdas
  // também, então precisam da base COMPLETA — senão contagens (motivo de perda,
  // plano por cliente) zeram e a cascata deixa clientes/perdas com valor antigo.
  const settingsLeadsSpec = useMemo(() => allLeadsQuerySpec(), []);
  const { items: leads } = usePagedLeads({
    db, path: LEADS_PATH, spec: settingsLeadsSpec, specKey: 'settings-all-leads',
    mapDoc: normalizeLeadDoc, enabled: !!db,
  });

  const { slaOverdueDays } = useGeneralConfig();

  const [section, setSection] = useState(() => LEGACY_TABS[initialTab] || 'overview');
  const [focus, setFocus] = useState(() => LEGACY_FOCUS[initialTab] || null);

  const setup = useMemo(() => buildSetupState({
    funnels, statuses, sources, modalities, planos, lossReasons,
    metaWeekdays, slaOverdueDays, usersList,
  }), [funnels, statuses, sources, modalities, planos, lossReasons, metaWeekdays, slaOverdueDays, usersList]);

  // Atalhos da Visão geral: trocam a seção e, quando dá, apontam o item citado.
  const goTo = useCallback((next, focusId = null) => {
    setSection(next);
    setFocus(focusId);
  }, []);
  const clearFocus = useCallback(() => setFocus(null), []);

  const catalogTotal = (tags || []).length + (sources || []).length + (planos || []).length
    + (lossReasons || []).length + (dores || []).length;

  // Quantas indicações antigas ainda estão sem quem indicou (badge do trilho).
  const pendingOwnersCount = pendingReferralOwners(leads).length;

  const groups = [
    {
      label: null,
      items: [{ id: 'overview', label: 'Visão geral', icon: <Gauge size={15} /> }]
    },
    {
      label: 'Pessoas',
      items: [
        { id: 'team', label: 'Equipe & acessos', icon: <Users size={15} />, count: (usersList || []).length },
        { id: 'transfer', label: 'Migrar leads', icon: <ArrowRightLeft size={15} /> },
        { id: 'referral-owners', label: 'Indicações sem dono', icon: <Handshake size={15} />, count: pendingOwnersCount || undefined }
      ]
    },
    {
      label: 'Como a operação roda',
      items: [
        { id: 'pace', label: 'Metas & ritmo', icon: <Target size={15} /> },
        { id: 'sched', label: 'Agendamento', icon: <CalendarClock size={15} />, count: (modalities || []).length },
        { id: 'funnels', label: 'Funis & etapas', icon: <Kanban size={15} />, count: (funnels || []).length }
      ]
    },
    {
      label: 'Vocabulário do funil',
      items: [{ id: 'catalogs', label: 'Catálogos', icon: <Library size={15} />, count: catalogTotal }]
    }
  ];

  const renderRailItem = (item) => (
    <SettingsRailItem
      key={item.id}
      icon={item.icon}
      label={item.label}
      count={item.count}
      attention={setup.attention[item.id]}
      active={section === item.id}
      onClick={() => goTo(item.id)}
    />
  );

  return (
    <div className="animate-fade-in font-sans flex flex-col gap-8 lg:flex-row lg:items-start">
      <aside className="lg:w-[262px] shrink-0 lg:sticky lg:top-20">
        <div className="px-3 pb-1">
          <h1 className="font-display text-[17px] font-bold tracking-tight">Ajustes da operação</h1>
          <p className="text-[12px] text-muted-foreground mt-1">Equipe, ritmo e catálogos do funil.</p>
        </div>
        <nav className="mt-3 flex flex-col">
          {groups.map(g => (
            g.label
              ? <SettingsRailGroup key={g.label} label={g.label}>{g.items.map(renderRailItem)}</SettingsRailGroup>
              : <div key="root" className="flex flex-col gap-0.5">{g.items.map(renderRailItem)}</div>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0">
        {section === 'overview' && (
          <OverviewSection
            setup={setup}
            leads={leads}
            usersList={usersList}
            funnels={funnels}
            tags={tags}
            sources={sources}
            slaOverdueDays={slaOverdueDays}
            onNavigate={goTo}
          />
        )}
        {section === 'team' && (
          <TeamAccessSection
            db={db} appUser={appUser} usersList={usersList} leads={leads}
            focusId={focus} onFocusHandled={clearFocus}
          />
        )}
        {section === 'transfer' && (
          <TransferSection db={db} usersList={usersList} appUser={appUser} leads={leads} />
        )}
        {section === 'referral-owners' && (
          <ReferralOwnersSection db={db} leads={leads} funnels={funnels} statuses={statuses} appUser={appUser} />
        )}
        {section === 'pace' && (
          <PaceSection db={db} usersList={usersList} metaWeekdays={metaWeekdays} />
        )}
        {section === 'sched' && (
          <SchedulingSection
            db={db} modalities={modalities} units={units}
            trialClassOptions={trialClassOptions} leads={leads}
          />
        )}
        {section === 'funnels' && (
          <FunnelsSection
            db={db} funnels={funnels} statuses={statuses} leads={leads}
            focusId={focus} onFocusHandled={clearFocus}
          />
        )}
        {section === 'catalogs' && (
          <CatalogsSection
            db={db} tags={tags} sources={sources} planos={planos}
            lossReasons={lossReasons} dores={dores} modalities={modalities} leads={leads}
            focusId={focus} onFocusHandled={clearFocus}
          />
        )}
      </div>
    </div>
  );
}

export { SettingsView };
