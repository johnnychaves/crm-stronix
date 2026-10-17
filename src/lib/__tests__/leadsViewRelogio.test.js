// @vitest-environment jsdom
// Todos os leads anda com o relógio: a ordem por ação depende da hora, porque o
// lead novo sem próximo passo passa a atrasado quando a janela de 24h fecha.
// Sem o relógio da tela, a linha dizia "Atrasado" e o lead continuava no bloco
// de quem não tem agendamento até um filtro ou um dado mudar.
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

const m = vi.hoisted(() => ({ items: [] }));

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/usePagedLeads.js', () => ({
  usePagedLeads: () => ({ items: m.items, loading: false, hasMore: false, loadMore: () => {} }),
  specToConstraints: () => [],
}));

const { LeadsView } = await import('../../views/LeadsView.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: 'leads' };
const GESTOR = { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad', authUid: 'auth-1' };
const FASES = [{ id: 's1', name: 'Novo lead', color: 'blue', order: 1 }];
const lead = (id, name, over) => ({
  id, name, whatsapp: '11999990000', status: 'Novo lead', source: 'Instagram', consultantId: 'u1', consultantName: 'Bruno', ...over,
});

let root = null;
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
});

describe('Todos os leads: a ordem por ação segue o relógio', () => {
  // Domingo, 18/10/2026, 08:58. A janela da Nina fecha às 09:00.
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(2026, 9, 18, 8, 58));
  });
  afterAll(() => { vi.useRealTimers(); });

  it('o lead novo vai para a frente quando a janela fecha, sem esperar dado novo', async () => {
    m.items = [
      lead('b', 'Bia Futuro', { nextFollowUp: new Date(2026, 9, 20, 9, 0), createdAt: new Date(2026, 9, 10, 9, 0) }),
      lead('n', 'Nina Nova', { nextFollowUp: null, createdAt: new Date(2026, 9, 17, 9, 0) }),
    ];
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(h(MemoryRouter, { initialEntries: ['/acad/leads?ordem=acao'] },
        h(LeadProfileContext.Provider, { value: profile },
          h(LeadsView, {
            interactions: [], statuses: FASES, usersList: [GESTOR], funnels: [{ id: 'f1', name: 'Padrão', isDefault: true }],
            sources: [], selectedFunnelId: 'f1', setSelectedFunnelId: () => {}, db: {},
          }))));
    });
    const ordem = () => {
      const t = container.textContent;
      return t.indexOf('Nina Nova') < t.indexOf('Bia Futuro') ? ['Nina Nova', 'Bia Futuro'] : ['Bia Futuro', 'Nina Nova'];
    };
    expect(ordem()).toEqual(['Bia Futuro', 'Nina Nova']);

    await act(async () => { vi.advanceTimersByTime(3 * 60_000); });
    expect(ordem()).toEqual(['Nina Nova', 'Bia Futuro']);
    expect(container.textContent).toContain('sem próximo passo');
  });
});
