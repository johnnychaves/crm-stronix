// Clientes com o papel professor (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "O que ele
// vê"). A tela não tem botão de criar cadastro nem de exportar, para ninguém:
// o "Cadastrar lead" mora no topo do App, que o esconde pelo LEAD_CRIAR. O que
// muda aqui é o convite para matricular da lista vazia, que é de quem
// matricula, e o filtro de responsável do gestor, que não lista professor. A
// tela é renderizada em node, como em listRowLinks.test.js.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/usePagedLeads.js', () => ({
  usePagedLeads: () => ({ items: [], loading: false, hasMore: false, loadMore: () => {} }),
}));

const { ClientsView } = await import('../../views/ClientsView.jsx');

const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: 'clientes' };
const GESTOR = { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad', authUid: 'auth-1' };
const CONSULTOR = { id: 'u2', name: 'Ana Duarte', role: 'consultant', tenantId: 'acad', authUid: 'auth-2' };
const PROFESSOR = { id: 'u3', name: 'Rafa Lemos', role: 'professor', professorId: 'prof1', tenantId: 'acad', authUid: 'auth-3' };

const render = (appUser, url = '/acad/clientes') => renderToString(
  createElement(MemoryRouter, { initialEntries: [url] },
    createElement(LeadProfileContext.Provider, { value: profile },
      createElement(ClientsView, { appUser, usersList: [GESTOR, CONSULTOR, PROFESSOR], db: {} }))));

describe('Clientes com o papel professor', () => {
  it('lista vazia: o consultor recebe o convite para matricular, o professor não', () => {
    expect(render(CONSULTOR)).toContain('Matricule um lead pelo Kanban');
    const prof = render(PROFESSOR);
    expect(prof).toContain('Nenhum cliente encontrado');
    expect(prof).not.toContain('Matricule um lead');
  });

  it('a tela não tem botão de criar nem de exportar, para ninguém', () => {
    [GESTOR, CONSULTOR, PROFESSOR].forEach((u) => {
      const html = render(u);
      expect(html).not.toContain('Exportar');
      expect(html).not.toContain('Cadastrar lead');
      expect(html).not.toContain('Novo lead');
    });
  });

  it('o filtro de responsável do gestor aceita consultor e ignora professor no endereço', () => {
    // O chip do filtro ativo só aparece quando o id do endereço é aceito.
    expect(render(GESTOR, '/acad/clientes?resp=u2')).toContain('Ana Duarte');
    const comProfessor = render(GESTOR, '/acad/clientes?resp=u3');
    expect(comProfessor).not.toContain('Rafa Lemos');
    expect(comProfessor).not.toContain('Limpar tudo');
  });
});
