import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { SettingsSectionHeader } from '../../components/ui/SettingsCard.jsx';
import { buildSetupState, railCounts, railSummaries } from '../../lib/settingsSetup.js';
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
import { GymProfileTab } from './GymProfileTab.jsx';
import { PlanInvoicesTab } from './PlanInvoicesTab.jsx';
import { SettingsRail } from './SettingsRail.jsx';
import { settingsRailGroups, settingsSection } from '../../lib/settingsRail.js';
import { hrefFor, parseAppPath } from '../../lib/routes.js';

// ==========================================
// CONFIGURAÇÕES — doze seções em sete blocos
//
// Redesign 2026-10 (mockup A, trilho em grupos): Visão geral, Academia (perfil e
// plano), Equipe, Dia a dia, Funil, Conexões e Manutenção da base. O trilho é
// recolhível, cada item é um link, e o número ao lado de um item diz quantos
// itens dele pedem ação.
//
// Cada seção renderiza o próprio cabeçalho e as próprias ações; aqui ficam só o
// trilho, o roteamento e os dados compartilhados. A tabela do trilho (ordem,
// rótulo e id de cada destino) mora em src/lib/settingsRail.js, porque o id é
// também o segmento do endereço e precisa bater com a tabela de rotas. Os
// ícones moram em settingsRailIcons.js.
// ==========================================

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

  // Quantas indicações antigas ainda estão sem quem indicou (número do
  // trilho). Memo pela lista: a varredura passa pela base inteira, e a tela
  // renderiza de novo a cada troca de seção e a cada grupo aberto ou fechado.
  const pendingOwnersCount = useMemo(() => pendingReferralOwners(leads).length, [leads]);

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

  // O número de cada item do trilho é quanto dele pede ação, e o resumo de cada
  // grupo diz o que há nele (src/lib/settingsSetup.js).
  const counts = railCounts(setup, pendingOwnersCount);
  const summaries = railSummaries(setup, {
    teamSize: (usersList || []).length,
    funnelCount: (funnels || []).length,
    catalogTotal,
    pendingOwners: pendingOwnersCount,
  });

  // Os links do trilho levam o identificador da academia, lido do endereço como
  // na tela de Relatórios. Rotinas é outra tela do menu.
  const { pathname } = useLocation();
  const tenantSlug = parseAppPath(pathname).tenantSlug;
  const hrefOf = (item) => (item.screen
    ? hrefFor(tenantSlug, item.screen)
    : hrefFor(tenantSlug, 'settings', { sub: item.id })) || pathname;

  // O trilho rola por dentro no computador. Ao trocar de seção (ou chegar por
  // link), ele mostra o item aceso, rolando só o necessário e só ele: o
  // scrollIntoView mexeria também na área de conteúdo.
  const railRef = useRef(null);
  useEffect(() => {
    const box = railRef.current;
    const cur = box?.querySelector('[aria-current="page"]');
    if (!cur) return;
    const b = box.getBoundingClientRect();
    const c = cur.getBoundingClientRect();
    if (c.top < b.top) box.scrollTop -= b.top - c.top + 8;
    else if (c.bottom > b.bottom) box.scrollTop += c.bottom - b.bottom + 8;
  }, [secao]);

  return (
    <div className="animate-fade-in font-sans flex flex-col gap-8 lg:flex-row lg:items-start">
      {/* Preso no topo da área que rola (o cabeçalho do app fica fora dela, então o desvio é só o do anel). Aberto, o trilho passa da altura de uma tela de notebook: ele rola por dentro (7rem = 4rem do cabeçalho do app, 2rem de respiro da área e 1rem de folga embaixo). O pt, o px e o pb de 2 a 4px, com a margem e o top negativos do mesmo tamanho (o top é `top-[-2px]` e não `-top-0.5` para o `fundoDaPagina.test.js` não tomar a lateral por uma barra que cobre o conteúdo), deixam à vista o anel do foco, que o overflow cortaria, sem mexer no alinhamento com o cabeçalho da seção. */}
      <aside ref={railRef} className="shrink-0 lg:sticky lg:top-[-2px] lg:-mx-1 lg:-mt-0.5 lg:w-[292px] lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:overscroll-y-contain lg:px-1 lg:py-0.5">
        <SettingsRail
          groups={groups}
          section={secao}
          summaries={summaries}
          counts={counts}
          hrefOf={hrefOf}
          onSection={goTo}
        />
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
        {secao === 'profile' && (
          <div className="flex flex-col gap-5">
            <SettingsSectionHeader
              title="Perfil da academia"
              hint="Nome, documento e endereço que aparecem na cobrança."
            />
            <GymProfileTab />
          </div>
        )}
        {secao === 'billing' && (
          <div className="flex flex-col gap-5">
            <SettingsSectionHeader
              title="Plano & faturas"
              hint="Seu plano, as faturas e a troca de plano."
            />
            <PlanInvoicesTab />
          </div>
        )}
      </div>
    </div>
  );
}

export { SettingsView };
