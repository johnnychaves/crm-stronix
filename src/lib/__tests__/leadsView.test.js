// Todos os leads no desenho do trilho (mockup C, 16/10/2026): as pílulas da
// barra no lugar das abas e do balão de filtros, nenhum botão de exportar (a
// planilha é a do relatório) e, em cada linha, o trilho da fase e a próxima
// ação por extenso. Renderizada em node, como em clientsView.test.js.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';
import { ORDENS_DE_LEADS } from '../screenParams.js';

const h = vi.hoisted(() => ({ items: [] }));

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/usePagedLeads.js', () => ({
  usePagedLeads: () => ({ items: h.items, loading: false, hasMore: false, loadMore: () => {} }),
  specToConstraints: () => [],
}));

const { LeadsView } = await import('../../views/LeadsView.jsx');

const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: 'leads' };
const GESTOR = { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad', authUid: 'auth-1' };
const FUNIS = [{ id: 'f1', name: 'Padrão', isDefault: true }];
const FASES = [
  { id: 's1', name: 'Novo lead', color: 'blue', order: 1 },
  { id: 's2', name: 'Contato feito', color: 'violet', order: 2 },
  { id: 's3', name: 'Negociação', color: 'orange', order: 3 },
];

const DAY = 864e5;
const em = (dias, hora = 9) => { const d = new Date(Date.now() + dias * DAY); d.setHours(hora, 0, 0, 0); return d; };
const lead = (id, name, status, nextFollowUp = null, source = 'Indicação') => ({
  id, name, whatsapp: '11999990000', status, nextFollowUp, source, consultantId: 'u1', consultantName: 'Bruno', createdAt: em(-2),
});
const QUATRO = () => [
  lead('a', 'Ana Nova', 'Novo lead', null, 'Instagram'),
  lead('b', 'Bia Contato', 'Contato feito', em(1), 'Instagram'),
  lead('c', 'Caio Atrasado', 'Negociação', em(-3, 10)),
  lead('d', 'Duda Venda', 'Venda'),
];
const FONTES = [{ id: 'o1', name: 'Instagram' }, { id: 'o2', name: 'Indicação' }];

const render = (url = '/acad/leads', extra = {}) => renderToString(
  createElement(MemoryRouter, { initialEntries: [url] },
    createElement(LeadProfileContext.Provider, { value: profile },
      createElement(LeadsView, {
        interactions: [], statuses: FASES, usersList: [GESTOR], funnels: FUNIS, sources: FONTES,
        selectedFunnelId: 'f1', setSelectedFunnelId: () => {}, db: {}, ...extra,
      }))));
const pos = (html, nome) => html.indexOf(nome);

describe('Todos os leads: a barra e o trilho', () => {
  it('a barra tem as pílulas de Funil, Consultor, Fase e Situação, e nenhum Exportar', () => {
    h.items = QUATRO();
    const html = render();
    // Funil é o FilterChip dos painéis (o nome é o texto da pílula); as outras são botões com aria-label.
    expect(html).toContain('>Funil</span><span class="font-semibold">Padrão</span>');
    ['Consultor', 'Origem', 'Fase'].forEach((nome) => expect(html).toContain(`aria-label="${nome}"`));
    // Sem pílula de Situação (pedido do Johnny, 16/10/2026): o 🔥 e o "Atrasado" ficam na linha.
    expect(html).not.toContain('aria-label="Situação"');
    expect(html).toContain('>Ordem</span><span class="font-semibold">Cadastro mais novo</span>');
    expect(html).not.toContain('Exportar');
    expect(html).toContain('4 leads no funil Padrão, do cadastro mais novo ao mais antigo');
  });

  it('cada linha diz a próxima ação por extenso', () => {
    h.items = QUATRO();
    const html = render();
    expect(html).toContain('Sem agendamento');
    expect(html).toContain('Amanhã às');
    expect(html).toContain('Atrasado há 3 dias');
  });

  it('o trilho tem uma barra por fase aberta e diz a posição do lead', () => {
    h.items = QUATRO();
    const html = render();
    expect(html).toContain('title="Novo lead"');
    expect(html).toContain('title="Negociação"');
    expect(html).toMatch(/Contato feito<span[^>]*>2(<!-- -->)? de (<!-- -->)?3</);
    expect(html).toContain('Venda fechada');
  });

  it('o funil guardado que é de sistema não vale aqui: a tela abre no funil padrão', () => {
    h.items = QUATRO();
    const comSistema = [...FUNIS, { id: 'f9', name: 'Renovações', systemKind: 'renewal' }];
    const html = render('/acad/leads', { funnels: comSistema, selectedFunnelId: 'f9' });
    expect(html).toContain('4 leads no funil Padrão');
    expect(html).toContain('Ana Nova');
    // Nem pelo endereço o funil de sistema vale.
    expect(render('/acad/leads?funil=f9', { funnels: comSistema })).toContain('no funil Padrão');
  });

  it('a origem do endereço recorta a lista', () => {
    h.items = QUATRO();
    const html = render('/acad/leads?origem=Instagram');
    expect(html).toContain('Ana Nova');
    expect(html).toContain('Bia Contato');
    expect(html).not.toContain('Caio Atrasado');
    expect(html).toContain('2 de 4 leads');
  });

  it('a ordem do endereço põe o atrasado na frente e o encerrado no fim', () => {
    h.items = QUATRO();
    const html = render('/acad/leads?ordem=acao');
    expect(pos(html, 'Caio Atrasado')).toBeLessThan(pos(html, 'Bia Contato'));
    expect(pos(html, 'Bia Contato')).toBeLessThan(pos(html, 'Ana Nova'));
    expect(pos(html, 'Ana Nova')).toBeLessThan(pos(html, 'Duda Venda'));
    expect(html).toContain('>Ordem</span><span class="font-semibold text-brand-700 dark:text-brand-300">Próxima ação</span>');
    // A linha de apoio acompanha a ordem, em vez de seguir dizendo "do cadastro mais novo".
    expect(html).toContain('4 leads no funil Padrão, pela próxima ação, com o atrasado primeiro');
    expect(render('/acad/leads?ordem=contato')).toContain('de quem está há mais tempo sem contato');
  });

  it('toda ordem do endereço tem nome na pílula e texto na linha de apoio', () => {
    h.items = QUATRO();
    ORDENS_DE_LEADS.forEach((ordem) => {
      const html = render(`/acad/leads?ordem=${ordem}`);
      // O texto que falta aparece como "undefined" na linha de apoio; o nome que falta, como pílula sem valor.
      expect(html).not.toContain('undefined');
      expect(html).toMatch(/>Ordem<\/span><span class="[^"]*">[^<]+<\/span>/);
    });
  });

  it('a origem que só existe num lead, fora do catálogo, também filtra', () => {
    h.items = [...QUATRO(), lead('e', 'Eva Antiga', 'Novo lead', null, 'Panfleto')];
    const html = render('/acad/leads?origem=Panfleto');
    expect(html).toContain('Eva Antiga');
    expect(html).not.toContain('Ana Nova');
    expect(html).toContain('1 de 5 leads');
  });

  it('por tempo sem contato, quem está parado há mais tempo vem primeiro', () => {
    const parado = (id, name, dias) => ({ ...lead(id, name, 'Contato feito'), lastInteractionAt: em(-dias) });
    h.items = [parado('x', 'Xavier Recente', 1), parado('y', 'Yara Parada', 20), parado('z', 'Zilda Meio', 8)];
    const html = render('/acad/leads?ordem=contato');
    expect(pos(html, 'Yara Parada')).toBeLessThan(pos(html, 'Zilda Meio'));
    expect(pos(html, 'Zilda Meio')).toBeLessThan(pos(html, 'Xavier Recente'));
  });

  it('sem lead nenhum a lista diz que não achou', () => {
    h.items = [];
    expect(render()).toContain('Nenhum lead encontrado');
  });
});
