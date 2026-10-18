// A gravação do Contexto comercial na ficha (handleContextSave da
// LeadProfileView): as travas de quem pode editar o cadastro, o aviso de cada
// resposta e o valor da abertura que segue para a gravação. O ContextCard é
// trocado por um dublê que guarda as props, para chamar o onSave como a tela
// chamaria, inclusive para quem a tela nunca deixaria chegar ali.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { ToastContext } from '../../contexts/ToastContext.jsx';
import { hrefFor } from '../routes.js';

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useLeadTimeline.js', () => ({ useLeadTimeline: () => [] }));
let card = null;
vi.mock('../../components/profile/ContextCard.jsx', () => ({ ContextCard: (props) => { card = props; return null; } }));
const saveContextField = vi.fn();
vi.mock('../contextWrites.js', () => ({ saveContextField: (...args) => saveContextField(...args) }));
vi.stubGlobal('window', { location: { origin: 'https://stronilead.com.br' } });

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');

const GESTOR = { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad', authUid: 'auth-1' };
const CONSULTOR = { id: 'u2', name: 'Ana', role: 'consultant', tenantId: 'acad', authUid: 'auth-2' };
const PROFESSOR = { id: 'u3', name: 'Rafa', role: 'professor', professorId: 'prof1', tenantId: 'acad', authUid: 'auth-3' };
const SEM_LOGIN = { id: 'u4', name: 'Legado', role: 'consultant', tenantId: 'acad', authUid: null };
const LEAD = { id: 'l1', name: 'Rafael Moreira', whatsapp: '11999990000', status: 'Novo', createdAt: new Date(2026, 8, 1), tags: [] };
const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: null };

const ficha = (appUser, lead = LEAD) => renderToString(
  createElement(MemoryRouter, { initialEntries: [`/acad/ficha/${lead.id}`] },
    createElement(ToastContext.Provider, { value: toast },
      createElement(LeadProfileContext.Provider, { value: profile },
        createElement(LeadProfileView, {
          lead, tab: 'timeline', onTab: () => {}, onBack: () => {}, appUser,
          statuses: [], tags: [], lossReasons: [], usersList: [GESTOR, CONSULTOR], db: {}, funnels: [],
        })))));

beforeEach(() => { vi.clearAllMocks(); card = null; });

describe('handleContextSave', () => {
  it('gestor e consultor gravam, com o valor da abertura seguindo para a gravação', async () => {
    for (const appUser of [GESTOR, CONSULTOR]) {
      saveContextField.mockResolvedValueOnce({ ok: true, change: null });
      ficha(appUser);
      expect(card.canEdit).toBe(true);
      expect(await card.onSave('tags', ['a', 'b'], ['a'])).toBe(true);
      expect(saveContextField).toHaveBeenLastCalledWith(expect.objectContaining({
        lead: LEAD, appUser, field: 'tags', value: ['a', 'b'], from: ['a'], usersList: [GESTOR, CONSULTOR],
      }));
    }
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('a troca de consultor avisa quem é o novo responsável', async () => {
    saveContextField.mockResolvedValueOnce({ ok: true, change: { toName: 'Ana' } });
    ficha(GESTOR);
    expect(await card.onSave('consultantId', 'u2')).toBe(true);
    expect(toast.success).toHaveBeenCalledWith('Ana agora é o responsável.');
  });

  it('o professor não grava, mesmo que alguém chame o onSave', async () => {
    ficha(PROFESSOR);
    expect(card.canEdit).toBe(false);
    expect(await card.onSave('dor', 'Saúde')).toBe(false);
    expect(saveContextField).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith('Essa ação não está liberada para o seu acesso.');
  });

  it('quem está sem login vinculado não grava, com o aviso de permissão', async () => {
    ficha(SEM_LOGIN);
    expect(card.canEdit).toBe(false);
    expect(await card.onSave('dor', 'Saúde')).toBe(false);
    expect(saveContextField).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith('Você não tem permissão para alterar este lead.');
  });

  it('campo que não grava devolve false, com aviso', async () => {
    saveContextField.mockResolvedValueOnce({ ok: false, change: null });
    ficha(GESTOR);
    expect(await card.onSave('cpf', '1')).toBe(false);
    expect(toast.warning).toHaveBeenCalledWith('Esse campo não pode ser salvo.');
  });

  it('erro do Firestore devolve false, com aviso, sem derrubar a ficha', async () => {
    saveContextField.mockRejectedValueOnce(new Error('permission-denied'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    ficha(GESTOR);
    expect(await card.onSave('observation', 'x')).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Não foi possível salvar. Tente novamente.');
  });
});

describe('cabeçalho: professor responsável', () => {
  // O trecho da faixa entre "Professor resp." e "Próximo passo".
  const celula = (lead) => {
    const html = ficha(GESTOR, { ...LEAD, ...lead });
    return html.slice(html.indexOf('Professor resp.'), html.indexOf('Próximo passo'));
  };

  it('mostra o professor do cadastro, o mesmo do Contexto comercial, sem a modalidade da aula', () => {
    const c = celula({ professorName: 'Carla Nunes', appointmentProfessorName: 'Marcos Vieira', appointmentModality: 'Pilates' });
    expect(c).toContain('Carla Nunes');
    expect(c).not.toContain('Marcos Vieira');
    expect(c).not.toContain('Pilates');
  });

  it('sem professor no cadastro, mostra o da aula experimental, com a modalidade', () => {
    const c = celula({ appointmentProfessorName: 'Marcos Vieira', appointmentModality: 'Pilates' });
    expect(c).toContain('Marcos Vieira');
    expect(c).toContain('Pilates');
  });

  it('o professor do cadastro que é o mesmo da aula leva a modalidade', () => {
    const c = celula({ professorName: 'Marcos Vieira', appointmentProfessorName: 'Marcos Vieira', appointmentModality: 'Pilates' });
    expect(c).toContain('Pilates');
  });

  it('sem nenhum dos dois, um traço', () => {
    expect(celula({})).toContain('—');
  });
});
