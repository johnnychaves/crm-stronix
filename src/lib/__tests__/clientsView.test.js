// A tela Clientes no desenho da carteira (mockup A, 16/10/2026): o filtro de
// situação mora na faixa da carteira, e a barra do cabeçalho tem só as pílulas
// de Consultor e Plano, as mesmas do Pipeline e dos Relatórios. Renderizada em
// node, como em clientsProfessor.test.js.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

const h = vi.hoisted(() => ({ items: [] }));

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/usePagedLeads.js', () => ({
  usePagedLeads: () => ({ items: h.items, loading: false, hasMore: false, loadMore: () => {} }),
}));

const { ClientsView } = await import('../../views/ClientsView.jsx');

const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: 'clientes' };
const GESTOR = { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad', authUid: 'auth-1' };

const DAY = 864e5;
const em = (dias) => new Date(Date.now() + dias * DAY);
const cliente = (id, name, dias, extra = {}) => ({
  id, name, whatsapp: '11999990000', lifecycleStage: 'cliente', consultantId: 'u1', consultantName: 'Bruno',
  currentPlanName: 'Anual Musculação', currentContractValue: 2388, currentContractStatus: 'ativo',
  currentContractStartsAt: em(dias - 365), currentContractEndsAt: em(dias), ...extra,
});
const TRES = () => [cliente('a', 'Ana Ativa', 200), cliente('b', 'Bia Avencer', 10), cliente('c', 'Caio Vencido', -10)];

const DIEGO = { id: 'u9', name: 'Diego Prado', role: 'consultant', tenantId: 'acad', authUid: 'auth-9' };

const render = (url = '/acad/clientes', usersList = [GESTOR]) => renderToString(
  createElement(MemoryRouter, { initialEntries: [url] },
    createElement(LeadProfileContext.Provider, { value: profile },
      createElement(ClientsView, { appUser: GESTOR, usersList, db: {} }))));

describe('Clientes: a carteira e a barra de filtros', () => {
  it('a barra tem só Consultor e Plano, e a situação mora na faixa da carteira', () => {
    h.items = TRES();
    const html = render();
    expect(html).toContain('aria-label="Consultor"');
    expect(html).toContain('aria-label="Plano"');
    expect(html).not.toContain('aria-label="Situação"');
    expect(html).toContain('Situação da carteira');
  });

  it('o cabeçalho conta os clientes, e cada linha diz quanto falta do contrato', () => {
    h.items = TRES();
    const html = render();
    expect(html).toContain('3 clientes, do vencimento mais próximo');
    expect(html).toContain('vence em 10 dias');
    expect(html).toContain('venceu há 10 dias');
  });

  it('a situação do endereço recorta a lista e acende o botão da faixa', () => {
    h.items = TRES();
    const html = render('/acad/clientes?sit=a_vencer');
    expect(html).toContain('Bia Avencer');
    expect(html).not.toContain('Ana Ativa');
    expect(html).not.toContain('Caio Vencido');
    expect(html).toMatch(/aria-pressed="true"(?:(?!<\/button>)[\s\S])*A vencer/);
    expect(html).toContain('1 de 3 clientes');
  });

  it('com situação no endereço e o recorte vazio, a faixa fica para limpar o filtro', () => {
    h.items = TRES();
    // Diego não tem cliente: sem a pílula de Situação, a faixa é o único jeito de tirar a situação.
    const html = render('/acad/clientes?sit=a_vencer&resp=u9', [GESTOR, DIEGO]);
    expect(html).toContain('Nenhum cliente encontrado');
    expect(html).toContain('Situação da carteira');
    expect(html).toContain('Limpar filtro');
  });

  it('sem cliente nenhum não há faixa da carteira', () => {
    h.items = [];
    expect(render()).not.toContain('Situação da carteira');
  });
});
