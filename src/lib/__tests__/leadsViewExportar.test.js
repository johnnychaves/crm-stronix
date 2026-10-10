// @vitest-environment jsdom
// O botão "Exportar CSV" de Todos os leads (jsdom): leva à planilha os leads que
// a lista mostra, com os filtros do endereço, pelas colunas de sempre
// (src/lib/leadsCsv.js), e avisa quando não há nada para exportar. Só o download
// é falso: a planilha é a de verdade, e é o texto dela que o teste confere.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { ToastContext } from '../../contexts/ToastContext.jsx';
import { hrefFor } from '../routes.js';

const h = vi.hoisted(() => ({ items: [], download: vi.fn() }));

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/usePagedLeads.js', () => ({
  usePagedLeads: () => ({ items: h.items, loading: false, hasMore: false, loadMore: () => {} }),
  specToConstraints: () => [],
}));
vi.mock('../csvExport.js', async (importOriginal) => ({ ...(await importOriginal()), downloadCsv: h.download }));

const { LeadsView } = await import('../../views/LeadsView.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const GESTOR = { id: 'u1', name: 'Carla Mendes', role: 'admin', tenantId: 'acad', authUid: 'auth-1' };
const BRUNO = { id: 'u2', name: 'Bruno Souza', role: 'consultant', tenantId: 'acad', authUid: 'auth-2' };
const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: 'leads' };
const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };

const lead = (extra = {}) => ({
  id: 'abc123', name: 'Ana Lima', whatsapp: '11999990000', status: 'Novo lead', source: 'Instagram',
  consultantId: 'u2', consultantName: 'Bruno Souza', createdAt: new Date(2026, 8, 1), ...extra,
});
const HEADER = 'Nome;WhatsApp;Responsável do aluno;Telefone do responsável;Origem;Indicado por;Fase do Funil;Consultor;Data Cadastro;Observação;Motivo Perda';

let root = null;
let container = null;
async function montar(url) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(MemoryRouter, { initialEntries: [url] },
      createElement(ToastContext.Provider, { value: toast },
        createElement(LeadProfileContext.Provider, { value: profile },
          createElement(LeadsView, {
            interactions: [], appUser: GESTOR, statuses: [], usersList: [GESTOR, BRUNO], funnels: [],
            selectedFunnelId: null, setSelectedFunnelId: () => {}, db: {},
          })))));
  });
}
const exportar = () => act(async () => { container.querySelector('[aria-label="Exportar CSV"]').click(); });

beforeEach(() => {
  h.download.mockClear();
  Object.values(toast).forEach((fn) => fn.mockClear());
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  container = null;
});

describe('Exportar CSV de Todos os leads', () => {
  it('leva os leads da lista para a planilha, pelas colunas de sempre', async () => {
    h.items = [lead(), lead({ id: 'zzz999', name: 'Zeca Neto', whatsapp: '', source: '', createdAt: new Date(2026, 7, 20) })];
    await montar('/acad/leads');
    await exportar();
    expect(h.download).toHaveBeenCalledTimes(1);
    const [nome, csv] = h.download.mock.calls[0];
    expect(nome).toMatch(/^leads_stronix_\d{4}-\d{2}-\d{2}\.csv$/);
    // Do mais novo para o mais antigo, como a lista.
    expect(csv).toBe([
      HEADER,
      'Ana Lima;11999990000;;;Instagram;;Novo lead;Bruno Souza;01/09/2026;;',
      'Zeca Neto;;;;;;Novo lead;Bruno Souza;20/08/2026;;',
    ].join('\r\n'));
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('respeita o filtro do endereço: só sai quem a lista mostra', async () => {
    h.items = [lead(), lead({ id: 'zzz999', name: 'Zeca Neto', consultantId: 'u1', consultantName: 'Carla Mendes' })];
    await montar('/acad/leads?resp=u1');
    await exportar();
    const [, csv] = h.download.mock.calls[0];
    expect(csv.split('\r\n')).toHaveLength(2);
    expect(csv).toContain('Zeca Neto');
    expect(csv).not.toContain('Ana Lima');
  });

  it('sem lead na lista, avisa e não baixa nada', async () => {
    h.items = [lead()];
    await montar('/acad/leads?resp=u1');
    await exportar();
    expect(toast.warning).toHaveBeenCalledWith('Não há leads para exportar com os filtros atuais.');
    expect(h.download).not.toHaveBeenCalled();
  });
});
