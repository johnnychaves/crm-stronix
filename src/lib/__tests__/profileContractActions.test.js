// As ações do card do contrato atual, na aba Contratos da ficha. O contrato
// que ainda não começou não oferece "Renovar contrato": o modal recusa renovar
// esse contrato, mesmo o emendado, e trocar o plano ou a data dele é pelo
// Corrigir. Corrigir e Cancelar continuam, e a coluna das ações fica só com
// elas. O LeadProfileView lê window.location.origin no render (link de
// indicação), por isso o window falso, como em profileTimeline.test.js.
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
const appUser = { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad', authUid: 'auth-1' };
const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: null };
const CONFIG = {
  modalities: [], trialClassOptions: [1, 2, 3], units: [], metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3,
  dailyVolumeTarget: 0, planos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30],
  renewalGraceDays: 15, professores: [], dores: []
};

// O Start, de 11/10/2025 a 11/10/2026, em uso hoje (29/09/2026).
const start = {
  id: 'k1', leadId: 'l1', planId: 'p1', planName: 'Start', value: 1200, listValue: 1200, durationMonths: 12,
  status: 'ativo', startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11), createdAt: D(2025, 10, 11), consultantName: 'Ana'
};
// A renovação dele, que começa depois de um intervalo.
const agendada = {
  id: 'k2', leadId: 'l1', planId: 'p2', planName: 'Flow', value: 1308, listValue: 1308, durationMonths: 12,
  status: 'ativo', renewedFromId: 'k1', seamless: false,
  startsAt: D(2026, 10, 20), endsAt: D(2027, 10, 20), createdAt: D(2026, 9, 28), consultantName: 'Ana'
};
const emendada = { ...agendada, seamless: true, startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12) };

// A ficha com o contrato `atual` no resumo do lead, aberta na aba Contratos.
// Devolve só o card do contrato atual, do painel da aba até o Histórico.
const card = (atual, contratos) => {
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
  const fim = html.indexOf('>Histórico<');
  expect(inicio).toBeGreaterThan(-1);
  expect(fim).toBeGreaterThan(inicio);
  return html.slice(inicio, fim);
};

// A coluna das ações e o que vem logo dentro dela.
const COLUNA = 'flex-none flex flex-col justify-center gap-2 px-[22px] py-[18px] border-l border-slate-100 dark:border-white/[0.06]">';
const inicioDaColuna = (html) => {
  const i = html.indexOf(COLUNA);
  expect(i).toBeGreaterThan(-1);
  return html.slice(i + COLUNA.length, i + COLUNA.length + 40);
};

describe('card do contrato atual: ações', () => {
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 29, 10, 0)); });
  afterAll(() => { vi.useRealTimers(); });

  it('contrato em uso: Renovar contrato no topo da coluna, com Corrigir, Trancar e Cancelar embaixo', () => {
    const html = card(start, [start]);
    expect(html).toContain('>Renovar contrato<');
    expect(inicioDaColuna(html)).toMatch(/^<button/);
    ['>Corrigir<', '>Trancar<', '>Cancelar<'].forEach((acao) => expect(html).toContain(acao));
  });

  it('renovação que ainda não começou, depois de um intervalo: sem Renovar contrato, com Corrigir e Cancelar', () => {
    const html = card(agendada, [start, agendada]);
    expect(html).not.toContain('Renovar contrato');
    expect(html).toContain('>Corrigir<');
    expect(html).toContain('>Cancelar<');
    // A coluna começa direto na linha das ações menores.
    expect(inicioDaColuna(html)).toMatch(/^<div class="flex items-center gap-0.5">/);
  });

  it('renovação emendada que ainda não começou: também sem Renovar contrato', () => {
    const html = card(emendada, [start, emendada]);
    expect(html).not.toContain('Renovar contrato');
    expect(html).toContain('>Corrigir<');
    expect(html).toContain('>Cancelar<');
    expect(inicioDaColuna(html)).toMatch(/^<div class="flex items-center gap-0.5">/);
  });

  it('trancado continua com Reativar contrato no lugar de Renovar', () => {
    const trancado = { ...start, status: 'trancado', pausedAt: D(2026, 9, 1), pauseReason: 'Viagem' };
    const html = card(trancado, [trancado]);
    expect(html).toContain('>Reativar contrato<');
    expect(html).not.toContain('Renovar contrato');
    expect(html).toContain('>Corrigir<');
    expect(html).toContain('>Cancelar<');
  });
});
