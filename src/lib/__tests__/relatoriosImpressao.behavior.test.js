// @vitest-environment jsdom
// O Imprimir dos Relatórios (mockup docs/superpowers/specs/mockups/2026-10-15-relatorios-impressao.html):
// o botão chama o window.print com a folha já no body, a folha leva todas as
// linhas da lista com o filtro dela (e não só as 50 da tela), a ficha diz o que
// a folha mostra (período e filtros, ou o retrato de Leads parados, e o filtro
// da lista), o selo leva o símbolo que a impressora preto e branco lê, nenhum
// telefone nem CPF vai para o papel, o afterprint tira a folha e o botão fica
// desligado com a lista vazia. A carga do painel é a das fixtures do CRM, como
// no relatoriosTela.behavior.test.js.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';
import { makeCtx, NOW, L, D } from './fixtures/crmCtx.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

const m = vi.hoisted(() => ({ all: null, cache: new Map() }));

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useCrmSources.js', () => ({ useCrmSources }));

function useCrmSources(args) {
  const keys = args.monthKeys.join(',');
  if (!m.cache.has(keys)) {
    const months = Object.fromEntries(args.monthKeys.filter((k) => m.all.months[k]).map((k) => [k, m.all.months[k]]));
    m.cache.set(keys, { months, leadsById: m.all.leadsById, loading: args.monthKeys.some((k) => !m.all.months[k]), failedKeys: [] });
  }
  return m.cache.get(keys);
}

const { RelatoriosView } = await import('../../views/relatorios/RelatoriosView.jsx');

const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: 'relatorios' };
const GESTORA = { id: 'ana', name: 'Ana Ribeiro', role: 'admin', tenantId: 'acad', authUid: 'a1' };
const EQUIPE = [GESTORA, { id: 'diego', name: 'Diego Santos', role: 'consultant', tenantId: 'acad', authUid: 'd1' }];
const NOMES = { s1: 'Sofia Alves', s2: 'Samuel Brito', s3: 'Sílvia Costa', s4: 'Sérgio Dias', s5: 'Sandra Esteves', a2: 'Alice Gomes', a3: 'André Lima' };
const nomeado = (l) => (NOMES[l.id] ? { ...l, name: NOMES[l.id] } : l);
const MES_VAZIO = { leadsCreated: [], converted: [], lost: [], aulas: [], interactions: [] };
// O contato que nenhum papel pode levar.
const FONE = '51999887766';
const CPF = '12345678909';

function fontesDoPainel() {
  const c = makeCtx();
  const months = Object.fromEntries(Object.entries(c.months).map(([key, mes]) => [key, {
    ...mes, leadsCreated: mes.leadsCreated.map(nomeado), converted: mes.converted.map(nomeado), lost: mes.lost.map(nomeado),
  }]));
  return { months: { '2026-07': MES_VAZIO, ...months }, leadsById: new Map([...c.leadsById].map(([id, l]) => [id, nomeado(l)])) };
}

// 120 leads de setembro, 70 do Instagram, todos com WhatsApp e CPF.
function fontesComMuitosLeads() {
  const leads = Array.from({ length: 120 }, (_, i) => L(`m${i}`, {
    name: `Aluno ${String(i).padStart(3, '0')}`,
    source: i < 70 ? 'Instagram' : 'Indicação',
    createdAt: D(9, 7 + (i % 7), 9 + (i % 5)),
    whatsapp: FONE,
    cpf: CPF,
  }));
  return {
    months: { '2026-08': MES_VAZIO, '2026-09': { ...MES_VAZIO, leadsCreated: leads } },
    leadsById: new Map(leads.map((l) => [l.id, l])),
  };
}

const fixtures = makeCtx();
const TELA = {
  db: {}, appUser: GESTORA, tenantName: 'STRONIX Academia', usersList: EQUIPE, funnels: fixtures.funnels,
  sources: [{ name: 'Instagram', channel: 'Pago' }, { name: 'Indicação' }, { name: 'Site' }],
  liveLeads: fixtures.liveLeads.map(nomeado), interactions: fixtures.months['2026-09'].interactions,
  section: 'entrada', onSection: () => {},
};

let root = null;
let container = null;
let avisos = [];
let print = null;
async function montar(url, props = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: [url] },
      h(LeadProfileContext.Provider, { value: profile }, h(RelatoriosView, { ...TELA, ...props }))));
  });
}
beforeEach(() => {
  avisos = [];
  vi.spyOn(console, 'error').mockImplementation((...args) => { avisos.push(args.map(String).join(' ')); });
  vi.spyOn(console, 'warn').mockImplementation((...args) => { avisos.push(`aviso: ${args.map(String).join(' ')}`); });
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(NOW);
  // A folha precisa estar no body na hora em que o navegador imprime.
  print = vi.spyOn(window, 'print').mockImplementation(() => {
    expect(folha()).not.toBeNull();
  });
  m.all = fontesDoPainel();
  m.cache.clear();
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  container = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
  expect(avisos).toEqual([]);
});

const clicar = async (el) => { await act(async () => { el.click(); }); };
const botao = (texto) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
const imprimir = () => clicar(botao('Imprimir'));
const fimDaImpressao = () => act(async () => { window.dispatchEvent(new Event('afterprint')); });
const folha = () => document.body.querySelector(':scope > [data-relatorio-impresso]');
const linhasDaFolha = () => [...folha().querySelectorAll('tbody tr')];
// Cada campo da ficha: o rótulo e o que ele diz.
const ficha = () => [...folha().querySelectorAll('dl > div')].map((d) => [d.querySelector('dt').textContent, d.querySelector('dd').textContent]);
const cabecalhoDaLista = () => folha().querySelector('.ri-lista-cab').textContent;

describe('Imprimir', () => {
  it('chama o window.print com a folha no body, nas colunas da tela, e o afterprint tira a folha', async () => {
    await montar('/acad/relatorios/conversao', { section: 'conversao' });
    expect(folha()).toBeNull();
    // Ao lado do exportar, antes dele.
    const acoes = botao('Imprimir').parentElement;
    expect([...acoes.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Imprimir', 'Exportar lista']);

    await imprimir();
    expect(print).toHaveBeenCalledTimes(1);
    expect(folha().querySelector('.ri-academia').textContent).toBe('STRONIX Academia');
    expect(folha().querySelector('h1').textContent).toBe('Conversão');
    expect(folha().textContent).toContain('Dos leads que chegaram no período, quantos agendaram, vieram e se matricularam até hoje.');
    expect(ficha()).toEqual([
      ['Período', '1 a 14 de setembro de 2026 (mês em andamento)'],
      ['Consultor', 'Equipe toda'],
      ['Origem', 'Todas'],
      ['Funil', 'Todos'],
    ]);
    expect(cabecalhoDaLista()).toBe('5 leads da safraLista completa, sem filtro');
    const colunasDaTela = [...container.querySelectorAll('thead th')].map((th) => th.textContent);
    expect([...folha().querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(colunasDaTela);
    expect(linhasDaFolha()).toHaveLength(5);
    // O selo leva o símbolo da situação: ✓ para quem matriculou, ✕ para a perda, ○ para quem está em aberto.
    expect(folha().querySelectorAll('[data-mark="✓"]')).toHaveLength(1);
    expect(folha().querySelectorAll('[data-mark="✕"]')).toHaveLength(1);
    expect(folha().querySelectorAll('[data-mark="○"]')).toHaveLength(3);
    // O rodapé de cada folha vai nas caixas de margem do @page, com quem gerou e o número da folha.
    const pagina = folha().querySelector('style').textContent;
    expect(pagina).toContain('size: A4');
    expect(pagina).toContain('"Gerado pelo Stronilead em 14/09/2026 às 12:00 por Ana Ribeiro"');
    expect(pagina).toContain('"Folha " counter(page) " de " counter(pages)');
    expect(folha().textContent).toContain('Fim da lista: 5 leads da safra');

    await fimDaImpressao();
    expect(folha()).toBeNull();
  });

  it('leva todas as linhas com o filtro da lista, passando das 50 da tela, e diz o filtro na ficha', async () => {
    m.all = fontesComMuitosLeads();
    await montar(`/acad/relatorios?recorte=${encodeURIComponent('origem:Instagram')}`);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(50);

    await imprimir();
    expect(linhasDaFolha()).toHaveLength(70);
    expect(new Set(linhasDaFolha().map((tr) => tr.children[1].textContent))).toEqual(new Set(['Instagram']));
    expect(ficha().at(-1)).toEqual(['Lista filtrada por', 'Origem: Instagram (70 dos 120 leads do período)']);
    expect(cabecalhoDaLista()).toBe('70 leadsLista filtrada por origem');
    // Nem telefone nem CPF: o papel fica na recepção.
    const texto = folha().textContent;
    expect(texto).not.toContain(FONE);
    expect(texto).not.toContain(CPF);
    expect(texto).not.toMatch(/WhatsApp|CPF|Telefone/);
  });

  it('os filtros da barra vão para a ficha', async () => {
    await montar('/acad/relatorios?resp=diego&origem=Indica%C3%A7%C3%A3o&funil=ind');
    await imprimir();
    expect(ficha()).toEqual([
      ['Período', '1 a 14 de setembro de 2026 (mês em andamento)'],
      ['Consultor', 'Diego Santos'],
      ['Origem', 'Indicação'],
      ['Funil', 'Indicações'],
    ]);
  });

  it('em Leads parados, a ficha é o retrato de agora, e o contato atrasado leva o "!"', async () => {
    const atrasado = L('t1', { name: 'Tiago Lopes', createdAt: D(8, 1), nextFollowUp: D(9, 10) });
    await montar('/acad/relatorios/parados', { section: 'parados', liveLeads: [...TELA.liveLeads, atrasado] });
    await imprimir();
    expect(folha().querySelector('h1').textContent).toBe('Leads parados');
    expect(ficha()).toEqual([
      ['Retrato de', '14/09/2026 às 12:00'],
      ['Sem registro há mais de', '7 dias'],
      ['Consultor', 'Equipe toda'],
      ['Origem e funil', 'Todas, todos'],
    ]);
    expect(cabecalhoDaLista()).toBe('5 leads paradosQuem está há mais dias sem registro vem primeiro');
    expect(folha().querySelectorAll('[data-mark="!"]')).toHaveLength(1);
    expect(folha().querySelectorAll('[data-mark="–"]')).toHaveLength(3);
    await fimDaImpressao();

    // Com um número do painel como filtro da lista.
    await clicar(botao('Sem próximo passo'));
    await imprimir();
    expect(linhasDaFolha()).toHaveLength(3);
    expect(ficha().at(-1)).toEqual(['Lista filtrada por', 'Sem próximo passo (3 dos 5 leads parados)']);
    expect(cabecalhoDaLista()).toBe('3 leads paradosLista filtrada: Sem próximo passo');
  });

  it('com a lista vazia o botão fica desligado, e quem não exporta não imprime', async () => {
    m.all = { months: { '2026-08': MES_VAZIO, '2026-09': MES_VAZIO }, leadsById: new Map() };
    await montar('/acad/relatorios');
    expect(botao('Imprimir').disabled).toBe(true);
    await imprimir();
    expect(print).not.toHaveBeenCalled();
    expect(folha()).toBeNull();
    await act(async () => { root.unmount(); });
    root = null;

    m.all = fontesDoPainel();
    m.cache.clear();
    await montar('/acad/relatorios', { appUser: { id: 'p', role: 'professor', tenantId: 'acad', authUid: 'p1' } });
    expect(botao('Imprimir')).toBeUndefined();
  });
});
