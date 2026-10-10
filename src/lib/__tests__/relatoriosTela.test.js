// A tela dos Relatórios, sem jsdom (renderToString), com a carga do painel
// trocada pelas fixtures do CRM (setembro de 2026 em andamento, até dia 14 ao
// meio-dia). O relógio é falso para o "agora" da tela cair nessa data.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';
import { makeCtx, NOW } from './fixtures/crmCtx.js';

const h = vi.hoisted(() => ({ sources: null }));

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useCrmSources.js', () => ({ useCrmSources: () => h.sources }));

const { RelatoriosView } = await import('../../views/relatorios/RelatoriosView.jsx');

const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: 'relatorios' };
const GESTORA = { id: 'ana', name: 'Ana Ribeiro', role: 'admin', tenantId: 'acad', authUid: 'a1' };
const EQUIPE = [GESTORA, { id: 'diego', name: 'Diego Santos', role: 'consultant', tenantId: 'acad', authUid: 'd1' }];
const ficha = (leadId) => `href="${hrefFor('acad', 'ficha', { leadId })}"`;

const render = (url, props = {}) => renderToString(createElement(MemoryRouter, { initialEntries: [url] },
  createElement(LeadProfileContext.Provider, { value: profile },
    createElement(RelatoriosView, {
      db: {}, appUser: GESTORA, usersList: EQUIPE, funnels: makeCtx().funnels,
      sources: [{ name: 'Instagram', channel: 'Pago' }, { name: 'Indicação' }],
      liveLeads: [], interactions: [], section: 'entrada', onSection: () => {}, ...props,
    }))));

const noRelogio = () => { vi.useFakeTimers(); vi.setSystemTime(NOW); };
const carregado = () => {
  const c = makeCtx();
  h.sources = { months: c.months, leadsById: c.leadsById, loading: false, failedKeys: [] };
};
afterEach(() => vi.useRealTimers());

describe('tela dos Relatórios', () => {
  it('abre na Entrada de leads do mês, com os recortes, a lista e o exportar', () => {
    noRelogio();
    carregado();
    const out = render('/acad/relatorios');
    expect(out).toContain('Entrada de leads');
    expect(out).toContain('leads novos');
    expect(out).toContain('Por origem');
    expect(out).toContain('Instagram');
    expect(out).toContain('Exportar lista');
    expect(out).toContain(ficha('s4'));
  });

  it('a Conversão mostra a conversão da safra e a lista filtrada pelo número', () => {
    noRelogio();
    carregado();
    const out = render('/acad/relatorios/conversao?recorte=situacao%3Amatricularam', { section: 'conversao' });
    expect(out).toContain('Conversão');
    expect(out).toContain('20%');
    expect(out).toContain('Rapidez do primeiro contato');
    // O primeiro contato é qualquer interação registrada da equipe, e não só conversa (isContactInteraction).
    expect(out).toContain('Do cadastro à primeira interação da equipe.');
    expect(out).toContain('aria-label="Limpar filtro da lista"');
    expect(out).toContain(ficha('s1'));
    expect(out).not.toContain(ficha('s4'));
  });

  it('enquanto carrega, avisa; com mês que falhou, não mostra número', () => {
    noRelogio();
    h.sources = { months: {}, leadsById: new Map(), loading: true, failedKeys: [] };
    expect(render('/acad/relatorios')).toContain('Carregando os números do período.');
    const c = makeCtx();
    h.sources = { months: c.months, leadsById: c.leadsById, loading: false, failedKeys: ['2026-09'] };
    const out = render('/acad/relatorios');
    expect(out).toContain('Não deu para carregar o período.');
    expect(out).not.toContain('leads novos');
  });

  it('quem não pode exportar não vê o botão', () => {
    noRelogio();
    carregado();
    const professor = { id: 'p', role: 'professor', tenantId: 'acad', authUid: 'p1' };
    expect(render('/acad/relatorios', { appUser: professor })).not.toContain('Exportar lista');
  });
});
