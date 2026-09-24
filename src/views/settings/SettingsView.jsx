import { useCallback, useMemo, useState } from 'react';
import { ArrowRightLeft, CalendarClock, FileSpreadsheet, Gauge, Handshake, Kanban, Library, PlugZap, Target, Users } from 'lucide-react';
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
import { ImportClientsSection } from './ImportClientsSection.jsx';
import { ZapIntegrationSection } from './ZapIntegrationSection.jsx';
import { settingsRailGroups, settingsSection } from '../../lib/settingsRail.js';

// ==========================================
// CONFIGURAÇÕES — sete destinos agrupados por intenção
//
// Redesign 2026-07: as dez seções do trilho plano viraram sete, agrupadas em
// PESSOAS / COMO A OPERAÇÃO RODA / VOCABULÁRIO DO FUNIL, com uma Visão geral na
// frente respondendo "o que falta configurar e o que pede atenção". A busca ⌘K
// saiu — com sete destinos, a hierarquia resolve.
//
// Cada seção renderiza o próprio cabeçalho e as próprias ações; aqui ficam só o
// trilho, o roteamento e os dados compartilhados. A tabela do trilho (ordem,
// rótulo e id de cada destino) mora em src/lib/settingsRail.js, porque o id é
// também o segmento do endereço e precisa bater com a tabela de rotas.
// ==========================================

// Ícone de cada destino do trilho. A ordem, os rótulos e os ids moram em
// src/lib/settingsRail.js, que é puro e tem teste de contrato com a tabela de
// endereços; aqui fica só o desenho. Destino novo entra nos dois lugares.
const RAIL_ICONS = {
  overview: <Gauge size={15} />,
  team: <Users size={15} />,
  transfer: <ArrowRightLeft size={15} />,
  'referral-owners': <Handshake size={15} />,
  import: <FileSpreadsheet size={15} />,
  pace: <Target size={15} />,
  sched: <CalendarClock size={15} />,
  funnels: <Kanban size={15} />,
  catalogs: <Library size={15} />,
  zap: <PlugZap size={15} />,
};

function SettingsView({
  section, onSection, db, statuses, sources, usersList, appUser, tags, lossReasons,
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

  // A seção vem do endereço (/configuracoes/<secao>), então trocar de seção é
  // navegar. Antes ela era lida uma vez só no inicializador do useState, e por
  // isso o "Configurar agora" de uma novidade não trocava a seção com a tela
  // já aberta. O `focus` continua aqui: ele aponta um item dentro da seção, é
  // apagado assim que a seção o usa, e não tem o que fazer num link.
  const [focus, setFocus] = useState(null);

  const setup = useMemo(() => buildSetupState({
    funnels, statuses, sources, modalities, planos, lossReasons,
    metaWeekdays, slaOverdueDays, usersList,
  }), [funnels, statuses, sources, modalities, planos, lossReasons, metaWeekdays, slaOverdueDays, usersList]);

  // Atalhos da Visão geral: trocam a seção e, quando dá, apontam o item citado.
  const goTo = useCallback((next, focusId = null) => {
    setFocus(focusId);
    onSection(next);
  }, [onSection]);
  const clearFocus = useCallback(() => setFocus(null), []);

  const catalogTotal = (tags || []).length + (sources || []).length + (planos || []).length
    + (lossReasons || []).length + (dores || []).length;

  // Quantas indicações antigas ainda estão sem quem indicou (badge do trilho).
  const pendingOwnersCount = pendingReferralOwners(leads).length;

  // Importação de clientes: só na sessão assumida do super console (spec
  // 2026-09-03). Em dev local não existe "Entrar como" (a /api dá 404 no
  // vite), então o admin vê a seção para conseguir testar; em produção a
  // condição é só o claim. É trava de tela, não de permissão: as regras já
  // deixam o admin criar lead e contrato um a um.
  const canImport = Boolean(appUser?.impersonating) || import.meta.env.DEV;
  // Seção que a tela realmente desenha e trilho desta sessão, os dois de
  // src/lib/settingsRail.js.
  const secao = settingsSection(section, canImport);
  const groups = settingsRailGroups(canImport);

  // Contagem do badge de cada destino, por id. Destino sem contagem fica sem
  // badge, que é o que `undefined` faz no SettingsRailItem.
  const railCounts = {
    team: (usersList || []).length,
    'referral-owners': pendingOwnersCount || undefined,
    sched: (modalities || []).length,
    funnels: (funnels || []).length,
    catalogs: catalogTotal,
  };

  const renderRailItem = (item) => (
    <SettingsRailItem
      key={item.id}
      icon={RAIL_ICONS[item.id]}
      label={item.label}
      count={railCounts[item.id]}
      attention={setup.attention[item.id]}
      active={secao === item.id}
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
        {secao === 'overview' && (
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
        {secao === 'team' && (
          <TeamAccessSection
            db={db} appUser={appUser} usersList={usersList} leads={leads}
            focusId={focus} onFocusHandled={clearFocus}
          />
        )}
        {secao === 'transfer' && (
          <TransferSection db={db} usersList={usersList} appUser={appUser} leads={leads} />
        )}
        {secao === 'referral-owners' && (
          <ReferralOwnersSection db={db} leads={leads} funnels={funnels} statuses={statuses} appUser={appUser} />
        )}
        {secao === 'import' && canImport && (
          <ImportClientsSection db={db} appUser={appUser} usersList={usersList} funnels={funnels} planos={planos} />
        )}
        {secao === 'pace' && (
          <PaceSection db={db} usersList={usersList} metaWeekdays={metaWeekdays} />
        )}
        {secao === 'sched' && (
          <SchedulingSection
            db={db} modalities={modalities} units={units}
            trialClassOptions={trialClassOptions} leads={leads}
          />
        )}
        {secao === 'funnels' && (
          <FunnelsSection
            db={db} funnels={funnels} statuses={statuses} leads={leads}
            focusId={focus} onFocusHandled={clearFocus}
          />
        )}
        {secao === 'catalogs' && (
          <CatalogsSection
            db={db} tags={tags} sources={sources} planos={planos}
            lossReasons={lossReasons} dores={dores} modalities={modalities} leads={leads}
            focusId={focus} onFocusHandled={clearFocus}
          />
        )}
        {secao === 'zap' && (
          <ZapIntegrationSection db={db} appUser={appUser} />
        )}
      </div>
    </div>
  );
}

export { SettingsView };
