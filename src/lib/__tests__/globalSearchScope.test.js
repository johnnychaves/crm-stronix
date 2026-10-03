// A busca do topo do professor acha só cliente (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "O que ele
// vê"). O recorte mora no searchPeople, pelo filtro `include`, para o total e o
// limite contarem só quem pode aparecer. O componente recebe clientsOnly do App
// (quem não tem ACTIONS.LEADS_VER) e diz isso no campo.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { searchPeople } from '../globalSearch.js';
import { isClientLead } from '../leads.js';

vi.mock('../firebase.js', () => ({ appId: 'acad', LEADS_PATH: 'leads', db: {}, auth: {}, storage: {} }));

const { GlobalSearch } = await import('../../components/layout/GlobalSearch.jsx');

const pessoa = (id, name, over = {}) => ({ id, name, whatsapp: '', cpf: '', ...over });
const PESSOAS = [
  pessoa('l1', 'Ana Lima', { status: 'Novo' }),
  pessoa('c1', 'Ana Souza', { lifecycleStage: 'cliente', status: 'Venda', isConverted: true }),
  pessoa('c2', 'Mariana Alves', { status: 'Venda', isConverted: true }),
  pessoa('l2', 'Anderson Reis', { status: 'Perda' }),
];

describe('searchPeople com include', () => {
  it('sem include, nada muda: leads e clientes juntos', () => {
    const { results, total } = searchPeople(PESSOAS, 'ana');
    expect(total).toBe(3);
    expect(results.map((r) => r.lead.id)).toEqual(['l1', 'c1', 'c2']);
  });

  it('com isClientLead, só clientes, e o total conta só eles', () => {
    const { results, total } = searchPeople(PESSOAS, 'ana', { include: isClientLead });
    expect(total).toBe(2);
    expect(results.map((r) => r.lead.id)).toEqual(['c1', 'c2']);
  });

  it('o limite vale depois do recorte: dez leads não escondem o cliente', () => {
    const muitos = [
      ...Array.from({ length: 10 }, (_, i) => pessoa(`l${i}`, `Ana Lead ${i}`, { status: 'Novo' })),
      pessoa('c9', 'Ana Zuleica', { lifecycleStage: 'cliente' }),
    ];
    const { results, total } = searchPeople(muitos, 'ana', { limit: 8, include: isClientLead });
    expect(total).toBe(1);
    expect(results.map((r) => r.lead.id)).toEqual(['c9']);
  });

  it('telefone também passa pelo recorte', () => {
    const pessoas = [
      pessoa('l1', 'Lucas', { whatsapp: '11999990000', status: 'Novo' }),
      pessoa('c1', 'Carla', { whatsapp: '11999990000', isConverted: true }),
    ];
    expect(searchPeople(pessoas, '99999', { include: isClientLead }).results.map((r) => r.lead.id)).toEqual(['c1']);
  });
});

describe('GlobalSearch com clientsOnly', () => {
  it('o campo diz que acha só clientes; sem a chave, leads e clientes', () => {
    const prof = renderToString(createElement(GlobalSearch, { db: null, clientsOnly: true }));
    expect(prof).toContain('placeholder="Buscar clientes"');
    expect(prof).toContain('aria-label="Buscar clientes"');
    const todos = renderToString(createElement(GlobalSearch, { db: null }));
    expect(todos).toContain('placeholder="Buscar leads e clientes"');
    expect(todos).toContain('aria-label="Buscar leads e clientes"');
  });
});

// O App decide pela lista de permissões quem cadastra lead e quem só acha
// cliente. O App inteiro não roda em teste de node, então o texto dele é lido.
describe('o topo do App segue a lista de permissões', () => {
  const app = readFileSync(fileURLToPath(new URL('../../App.jsx', import.meta.url)), 'utf8');

  it('a busca recebe clientsOnly de quem não vê leads, e o novo lead só de quem cria lead', () => {
    expect(app).toContain('clientsOnly={!can(appUser, ACTIONS.LEADS_VER)}');
    expect(app).toContain('onAddLead={can(appUser, ACTIONS.LEAD_CRIAR) ? () => setIsAddLeadModalOpen(true) : null}');
  });

  it('o botão Cadastrar lead e o modal do cadastro rápido pedem LEAD_CRIAR', () => {
    expect(app).toContain("{!appUser.superAdminOnly && can(appUser, ACTIONS.LEAD_CRIAR) && (");
    expect(app).toContain('{isAddLeadModalOpen && can(appUser, ACTIONS.LEAD_CRIAR) && (');
  });
});
