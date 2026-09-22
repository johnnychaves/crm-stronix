// O que a rota da ficha desenha em cada estado, renderizado sem jsdom. O hook
// de leitura e a LeadProfileView são falsos: o hook devolve o status que o
// teste mandar, e a view falsa mostra as props que recebeu. Assim o teste não
// precisa de Firebase e confere a ligação inteira da rota.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';

const m = vi.hoisted(() => ({ hook: { status: 'loading', lead: null, retry: () => {} }, calls: [] }));

vi.mock('../../hooks/useProfileLead.js', () => ({
  useProfileLead: (args) => { m.calls.push(args); return m.hook; },
}));
vi.mock('../../views/LeadProfileView.jsx', () => ({
  LeadProfileView: (p) => createElement(
    'div',
    { 'data-ficha': p.lead.id },
    `ficha ${p.lead.name} ativa=${String(p.listenersActive)} voltar=${typeof p.onBack} ` +
    `inicio-exclusao=${typeof p.onDeleteStart} falha-exclusao=${typeof p.onDeleteFailed}`
  ),
}));

const { LeadProfileRoute, FichaPanel } = await import('../../views/LeadProfileRoute.jsx');

const LEAD = { id: 'AbC123xyz', name: 'Ana Duarte', lifecycleStage: 'cliente' };
const BASE = {
  leadId: 'AbC123xyz', tenantId: 'stronix-crm-app', sessionKey: 'stronix-crm-app:u1',
  dataReady: true, listenersActive: true, db: {}, appUser: { id: 'u1', tenantId: 'stronix-crm-app' },
  statuses: [], tags: [], lossReasons: [], usersList: [], funnels: [],
};

const renderRoute = (props = {}) => renderToString(
  createElement(MemoryRouter, { initialEntries: ['/stronix-crm-app/ficha/AbC123xyz'] },
    createElement(LeadProfileRoute, { ...BASE, ...props }))
);
const setHook = (status, lead = null) => { m.hook = { status, lead, retry: () => {} }; };

beforeEach(() => { m.calls.length = 0; setHook('loading'); });

describe('LeadProfileRoute', () => {
  it('passa id, sessão e o portão de ociosidade para a leitura', () => {
    renderRoute({ listenersActive: false });
    expect(m.calls[0]).toEqual({ db: BASE.db, leadId: 'AbC123xyz', sessionKey: 'stronix-crm-app:u1', active: false });
  });

  it('carregando mostra o esqueleto da ficha', () => {
    const html = renderRoute();
    expect(html).toContain('Carregando ficha…');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('data-ficha');
  });

  it('ficha pronta espera os catálogos da academia', () => {
    setHook('ready', LEAD);
    const html = renderRoute({ dataReady: false });
    expect(html).toContain('Carregando ficha…');
    expect(html).not.toContain('data-ficha');
  });

  it('ficha pronta com a carga feita mostra a ficha com os avisos de exclusão e o portão', () => {
    setHook('ready', LEAD);
    const html = renderRoute();
    expect(html).toContain('data-ficha="AbC123xyz"');
    expect(html).toContain('ficha Ana Duarte ativa=true voltar=function inicio-exclusao=function falha-exclusao=function');
  });

  it('doc ausente mostra "não encontrada" sem esperar a carga', () => {
    setHook('missing');
    const html = renderRoute({ dataReady: false });
    expect(html).toContain('Ficha não encontrada');
    expect(html).toContain('Essa pessoa pode ter sido excluída, ou o link é de outra academia.');
    expect(html).toContain('Ir para o início');
    expect(html).not.toContain('Tentar de novo');
    expect(html).not.toContain('Voltar');
  });

  it('id inválido do endereço mostra o mesmo "não encontrada"', () => {
    setHook('invalid');
    expect(renderRoute({ leadId: null })).toContain('Ficha não encontrada');
  });

  it('doc excluído com a ficha aberta avisa e oferece Voltar e início', () => {
    setHook('deleted', LEAD);
    const html = renderRoute({ dataReady: false });
    expect(html).toContain('Essa ficha foi excluída');
    expect(html).toContain('Alguém da equipe excluiu esse cadastro enquanto ele estava aberto.');
    expect(html).toContain('Voltar');
    expect(html).toContain('Ir para o início');
    expect(html).not.toContain('data-ficha');
  });

  it('erro de leitura oferece Tentar de novo e início', () => {
    setHook('error');
    const html = renderRoute({ dataReady: false });
    expect(html).toContain('Não deu para abrir a ficha');
    expect(html).toContain('Pode ser a internet. Tente de novo em alguns segundos.');
    expect(html).toContain('Tentar de novo');
    expect(html).toContain('Ir para o início');
  });
});

describe('FichaPanel', () => {
  const noop = () => {};

  it('durante a exclusão mostra "Excluindo a ficha…" sem botão', () => {
    const html = renderToString(createElement(FichaPanel, { view: 'deleting', onBack: noop, onHome: noop, onRetry: noop }));
    expect(html).toContain('Excluindo a ficha…');
    expect(html).toContain('role="status"');
    expect(html).not.toContain('<button');
  });

  it('os botões são botões de verdade, com type="button"', () => {
    const html = renderToString(createElement(FichaPanel, { view: 'deleted', onBack: noop, onHome: noop, onRetry: noop }));
    expect(html.match(/<button\b[^>]*\btype="button"/g)).toHaveLength(2);
  });

  it('nenhum texto dos avisos usa travessão', () => {
    for (const view of ['deleting', 'deleted', 'error', 'missing']) {
      const html = renderToString(createElement(FichaPanel, { view, onBack: noop, onHome: noop, onRetry: noop }));
      expect(html).not.toMatch(/[—–]/);
    }
  });
});
