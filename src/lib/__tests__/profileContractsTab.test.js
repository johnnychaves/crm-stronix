// A aba Contratos da ficha nas situações da tabela "Botões em cada situação"
// da spec, renderizada pelo LeadProfileView inteiro (renderToString). Hoje é
// 30/09/2026, o Start está em uso até 11/10 e o Flow começa em 12/10, como no
// mockup aprovado. O LeadProfileView lê window.location.origin no render
// (link de indicação), por isso o window falso, como em profileTimeline.test.js.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';
import { hrefFor } from '../routes.js';

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useLeadTimeline.js', () => ({ useLeadTimeline: () => [] }));
vi.stubGlobal('window', { location: { origin: 'https://stronilead.com.br' } });

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');

const D = (y, m, d) => new Date(y, m - 1, d);
const ADMIN = { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad', authUid: 'auth-1' };
// Sem authUid não pode editar (canEditLead): a aba não mostra botão.
const SEM_VINCULO = { id: 'u2', name: 'Visita', role: 'consultor', tenantId: 'acad' };
const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: null };
const CONFIG = {
  modalities: [], trialClassOptions: [1, 2, 3], units: [], metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3,
  dailyVolumeTarget: 0, planos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30],
  renewalGraceDays: 15, professores: [], dores: []
};

// O Start, de 11/10/2025 a 11/10/2026, em uso hoje.
const start = {
  id: 'k1', leadId: 'l1', planId: 'p1', planName: 'Start', value: 1200, listValue: 1200, durationMonths: 12,
  status: 'ativo', startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11), createdAt: D(2025, 10, 11), consultantName: 'Ana'
};
// A renovação emendada, de 12/10/2026 a 12/10/2027.
const flow = {
  id: 'k2', leadId: 'l1', planId: 'p2', planName: 'Flow', value: 1788, listValue: 1788, durationMonths: 12,
  status: 'ativo', renewedFromId: 'k1', seamless: true,
  startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12), createdAt: D(2026, 9, 28), consultantName: 'Ana'
};
// A mesma renovação, depois de um intervalo de 8 dias.
const flowDepois = { ...flow, seamless: false, startsAt: D(2026, 10, 20), endsAt: D(2027, 10, 20) };
const trancado = { ...start, status: 'trancado', pausedAt: D(2026, 9, 20), pauseReason: 'Viagem' };
const cancelado = { ...start, status: 'cancelado', cancelledAt: D(2026, 9, 25), cancelReason: 'Financeiro' };
// A renovação depois de o contrato em uso ser cancelado: o cancelamento tira a
// marca de emendada dela (buildContractCancel), senão ela contaria como ativa.
const flowSemEmenda = { ...flow, seamless: false };

// A ficha com o contrato `atual` no resumo do lead, aberta na aba Contratos.
// Devolve o painel em três pedaços: a linha do tempo mais o card (`hero`), a
// faixa do próximo (`strip`, vazia quando não há) e o Histórico.
const aba = (atual, contratos, appUser = ADMIN) => {
  const lead = {
    id: 'l1', name: 'Ana Lima', whatsapp: '11999990000', status: 'Venda', lifecycleStage: 'cliente', isConverted: true,
    clienteSince: D(2025, 10, 11), createdAt: D(2025, 9, 1), consultantName: 'Ana',
    currentContractId: atual.id, currentPlanName: atual.planName, currentContractValue: atual.value,
    currentContractStartsAt: atual.startsAt, currentContractEndsAt: atual.endsAt,
    currentContractStatus: atual.status, currentContractSeamless: Boolean(atual.seamless)
  };
  const html = renderToString(
    createElement(MemoryRouter, { initialEntries: ['/acad/ficha/l1/contratos'] },
      createElement(LeadProfileContext.Provider, { value: profile },
        createElement(GeneralConfigContext.Provider, { value: { ...CONFIG, contratos } },
          createElement(LeadProfileView, {
            lead, tab: 'contratos', onTab: () => {}, onBack: () => {}, appUser,
            statuses: [], tags: [], lossReasons: [], usersList: [], db: {}, funnels: [],
          })))));
  const inicio = html.indexOf('role="tabpanel"');
  const historico = html.indexOf('>Histórico<');
  expect(inicio).toBeGreaterThan(-1);
  expect(historico).toBeGreaterThan(inicio);
  const painel = html.slice(inicio, historico);
  const faixa = painel.indexOf('border-l-violet-500');
  return {
    hero: faixa === -1 ? painel : painel.slice(0, faixa),
    strip: faixa === -1 ? '' : painel.slice(faixa),
    historico: html.slice(historico)
  };
};

describe('aba Contratos: os botões em cada situação', () => {
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 30, 10, 0)); });
  afterAll(() => { vi.useRealTimers(); });

  it('contrato em uso, sem próximo: Renovar contrato, Corrigir, Trancar e Cancelar', () => {
    const { hero, strip, historico } = aba(start, [start]);
    expect(hero).toContain('>Renovar contrato<');
    ['>Corrigir<', '>Trancar<', '>Cancelar<'].forEach((acao) => expect(hero).toContain(acao));
    expect(hero).not.toContain('Ativar agora');
    expect(hero).toContain('>Restam<');
    expect(hero).toContain('>A vencer<');
    expect(hero).toContain('>Vigência<');
    expect(strip).toBe('');
    expect(historico).toContain('Este é o primeiro contrato de Ana.');
  });

  it('contrato em uso trancado, sem próximo: Reativar contrato, Corrigir e Cancelar', () => {
    const { hero, strip } = aba(trancado, [trancado]);
    expect(hero).toContain('>Reativar contrato<');
    expect(hero).toContain('>Corrigir<');
    expect(hero).toContain('>Cancelar<');
    expect(hero).not.toContain('>Trancar<');
    expect(hero).not.toContain('Renovar contrato');
    expect(hero).toContain('Trancado há');
    expect(strip).toBe('');
  });

  it('contrato em uso com próximo marcado: o card só tranca e cancela; a faixa ativa, corrige e cancela a renovação', () => {
    const { hero, strip, historico } = aba(flow, [start, flow]);
    expect(hero).toContain('>Trancar<');
    expect(hero).toContain('>Cancelar<');
    expect(hero).not.toContain('>Corrigir<');
    expect(hero).not.toContain('Renovar contrato');
    expect(hero).not.toContain('Ativar agora');
    expect(hero).toContain('>Em uso<');
    expect(hero).toContain('Em uso · restam');
    expect(hero).toContain('>Start<');
    expect(strip).toContain('>Próximo<');
    expect(strip).toContain('>Flow<');
    expect(strip).toContain('Ativar agora');
    expect(strip).toContain('>Corrigir<');
    expect(strip).toContain('>Cancelar renovação<');
    expect(strip).toContain('>12/10/2026<');
    expect(strip).toContain('daqui a 12 dias');
    expect(strip).toContain('até 12/10/2027');
    expect(strip).toContain('R$ 1.788,00');
    expect(strip).toContain('R$ 149,00/mês');
    expect(strip).toContain('sem intervalo');
    // O contrato em uso não vai para o Histórico.
    expect(historico).toContain('Nenhum contrato anterior');
  });

  it('com intervalo até o próximo, a faixa diz os dias sem contrato; trancado, o card reativa', () => {
    expect(aba(flowDepois, [start, flowDepois]).strip).toContain('8 dias sem contrato antes');
    const { hero } = aba(flow, [trancado, flow]);
    expect(hero).toContain('>Reativar<');
    expect(hero).toContain('>Cancelar<');
    expect(hero).not.toContain('>Trancar<');
    expect(hero).toContain('Trancado há');
  });

  it('contrato agendado sem nenhum em uso: Ativar agora, Corrigir e Cancelar, sem Trancar', () => {
    const { hero, strip, historico } = aba(flowSemEmenda, [cancelado, flowSemEmenda]);
    expect(hero).toContain('Ativar agora');
    expect(hero).toContain('>Corrigir<');
    expect(hero).toContain('>Cancelar<');
    expect(hero).not.toContain('>Trancar<');
    expect(hero).not.toContain('Renovar contrato');
    expect(hero).toContain('Começa em');
    expect(hero).toContain('>Agendado<');
    expect(strip).toBe('');
    expect(historico).toContain('>Cancelado<');
  });

  it('vencido ou cancelado, sem próximo: Nova matrícula', () => {
    const vencido = { ...start, endsAt: D(2026, 9, 10) };
    expect(aba(vencido, [vencido]).hero).toContain('>Nova matrícula<');
    const { hero, strip } = aba(cancelado, [cancelado]);
    expect(hero).toContain('>Nova matrícula<');
    expect(hero).toContain('>Cancelado<');
    expect(strip).toBe('');
  });

  it('quem não pode editar não vê botão nenhum', () => {
    const { hero, strip } = aba(flow, [start, flow], SEM_VINCULO);
    expect(hero).not.toContain('>Trancar<');
    expect(hero).not.toContain('>Cancelar<');
    expect(strip).not.toContain('Ativar agora');
    expect(strip).not.toContain('>Corrigir<');
    expect(strip).toContain('>Próximo<');
  });
});
