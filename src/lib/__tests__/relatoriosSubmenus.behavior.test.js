// @vitest-environment jsdom
// Os três submenus do PR 2 na tela de verdade (jsdom): Visitas e aulas
// experimentais, Perdas e Leads parados. Os números que filtram a lista, os
// recortes, as colunas, o aviso do dado, a planilha e, em Leads parados, o
// corte de dias no lugar do período e a carga que não pede mês nenhum. O molde
// é o do relatoriosTela.behavior.test.js: a carga do painel é trocada pelas
// fixtures do CRM e responde como a de verdade (o mesmo objeto enquanto o
// pedido é o mesmo), e só o Date e o intervalo do relógio da tela são falsos.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';
import { VISITAS_COLUMNS } from '../relatorios/leads/visitas.js';
import { PERDAS_COLUMNS } from '../relatorios/leads/perdas.js';
import { PARADOS_COLUMNS } from '../relatorios/leads/parados.js';
import { makeCtx, NOW, D, L, A } from './fixtures/crmCtx.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

const m = vi.hoisted(() => ({ all: null, args: null, cache: new Map(), download: vi.fn() }));

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useCrmSources.js', () => ({ useCrmSources }));
vi.mock('../csvExport.js', async (importOriginal) => ({ ...(await importOriginal()), downloadCsv: m.download }));

function useCrmSources(args) {
  m.args = args;
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

// Setembro em andamento e agosto fechado, com nome em cada lead e julho vazio.
function fontesDoPainel() {
  const c = makeCtx();
  const months = Object.fromEntries(Object.entries(c.months).map(([key, mes]) => [key, {
    ...mes, leadsCreated: mes.leadsCreated.map(nomeado), converted: mes.converted.map(nomeado), lost: mes.lost.map(nomeado),
  }]));
  return { months: { '2026-07': MES_VAZIO, ...months }, leadsById: new Map([...c.leadsById].map(([id, l]) => [id, nomeado(l)])) };
}
const fixtures = makeCtx();
const TELA = {
  db: {}, appUser: GESTORA, usersList: EQUIPE, funnels: fixtures.funnels,
  sources: [{ name: 'Instagram', channel: 'Pago' }, { name: 'Indicação' }, { name: 'Site' }],
  // Os leads em aberto que o app tem na memória e as interações do mês, para Leads parados.
  liveLeads: fixtures.liveLeads.map(nomeado), interactions: fixtures.months['2026-09'].interactions,
  onSection: () => {},
};

function Sonda() {
  return h('output', { 'data-sonda': '' }, useLocation().search);
}

let root = null;
let container = null;
let avisos = [];
const arvore = (url, props) => h(MemoryRouter, { initialEntries: [url] },
  h(LeadProfileContext.Provider, { value: profile }, h(RelatoriosView, { ...TELA, ...props })),
  h(Sonda));
async function montar(url, props) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(arvore(url, props)); });
}
beforeEach(() => {
  avisos = [];
  vi.spyOn(console, 'error').mockImplementation((...args) => { avisos.push(args.map(String).join(' ')); });
  vi.spyOn(console, 'warn').mockImplementation((...args) => { avisos.push(`aviso: ${args.map(String).join(' ')}`); });
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(NOW);
  m.download.mockClear();
  m.args = null;
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
const tecla = async (el, key) => {
  await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); });
};
const botao = (texto) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
const recorte = (nome) => container.querySelector(`button [title^="${nome}"]`)?.closest('button');
const gatilho = (nome) => container.querySelector(`button[aria-label="${nome}"]`);
const opcao = (texto) => [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent.trim() === texto);
const submenu = (texto) => [...container.querySelectorAll('nav[aria-label="Relatórios"] button')].find((b) => b.textContent.includes(texto));
const sonda = () => container.querySelector('output[data-sonda]').textContent;
const linhas = () => [...container.querySelectorAll('tbody tr')];
const nomesDaLista = () => linhas().map((tr) => tr.firstElementChild.textContent);
const fichas = () => [...container.querySelectorAll('tbody a[href]')].map((a) => a.getAttribute('href').split('/').pop()).sort();
const linhaDe = (id) => linhas().find((tr) => tr.querySelector(`a[href$="/ficha/${id}"]`));
const celula = (tr, coluna) => tr.children[[...container.querySelectorAll('thead th')].findIndex((th) => th.textContent === coluna)];
const heroi = () => container.querySelector('.num.font-display')?.textContent;
const cartao = (titulo) => [...container.querySelectorAll('h3')].find((t) => t.textContent === titulo).closest('section');
const grade = (titulo) => cartao(titulo).parentElement;
const AVISO = 'os agendamentos estão incompletos';

describe('Visitas e aulas experimentais', () => {
  const abrir = (url = '/acad/relatorios/visitas-e-aulas') => montar(url, { section: 'visitas-e-aulas' });

  it('o comparecimento, os cinco números, o aviso do mês em andamento e a lista em ordem de data', async () => {
    await abrir();
    expect(container.querySelector('h2').textContent).toBe('Visitas e aulas experimentais');
    expect(heroi()).toBe('50%');
    expect(submenu('Visitas e aulas experimentais').getAttribute('aria-current')).toBe('page');
    const numero = (nome) => botao(nome).textContent;
    expect(numero('Marcados')).toContain('3');
    expect(numero('A acontecer')).toContain('1');
    // Marcados soma os que ainda vão acontecer e fica sem variação; os outros ficam sem base contra agosto.
    expect(numero('Marcados')).not.toContain('sem base');
    expect(numero('Vieram')).toContain('sem base');
    expect(container.textContent).toContain('Marcados inclui os agendamentos que vão acontecer');
    expect(container.textContent).toContain(AVISO);
    expect(nomesDaLista()).toEqual(['Sofia Alves', 'Samuel Brito', 'Sérgio Dias']);
    expect(celula(linhaDe('s1'), 'Dia e hora').textContent).toBe('04/09 10:00');
  });

  it('"Faltaram" filtra a lista, e a célula do que não se aplica é um traço que se lê', async () => {
    await abrir();
    await clicar(botao('Faltaram'));
    expect(sonda()).toBe('?recorte=situacao%3Afaltaram');
    expect(fichas()).toEqual(['s2']);
    const modalidade = celula(linhaDe('s2'), 'Modalidade');
    expect(modalidade.querySelector('[aria-hidden="true"]').textContent).toBe('—');
    expect(modalidade.querySelector('.sr-only').textContent).toBe('não se aplica');
    expect(celula(linhaDe('s2'), 'Desfecho').firstElementChild.className).toContain('text-rose-700');
  });

  it('os cinco números numa linha a partir de xl, e os quatro recortes dois por dois, com de quem é o dado', async () => {
    await abrir();
    expect(botao('Marcados').parentElement.className).toContain('xl:grid-cols-5');
    expect(botao('Marcados').parentElement.className).not.toContain('xl:grid-cols-6');
    expect(grade('Por tipo').className).toContain('sm:grid-cols-2');
    expect(grade('Por tipo').className).not.toMatch(/grid-cols-3/);
    for (const t of ['Por consultor', 'Por unidade', 'Por modalidade']) expect(grade(t), t).toBe(grade('Por tipo'));
    expect(cartao('Por unidade').textContent).toContain('Só a visita guarda a unidade.');
    expect(cartao('Por modalidade').textContent).toContain('Só a aula experimental guarda a modalidade.');
  });

  it('no período fechado com base dos dois lados, sem o aviso e sem a frase de Marcados', async () => {
    await abrir('/acad/relatorios/visitas-e-aulas?de=2026-09-08&ate=2026-09-13');
    expect(container.textContent).not.toContain(AVISO);
    expect(container.textContent).not.toContain('Marcados inclui');
    expect(botao('Marcados').textContent).toContain('▼ 100%');
  });

  it('o exportar leva a lista até o fim do mês, com as colunas dela', async () => {
    await abrir();
    await clicar(botao('Exportar lista'));
    const [arquivo, csv] = m.download.mock.calls[0];
    expect(arquivo).toBe('leads-visitas-e-aulas-2026-09-01-a-2026-09-30.csv');
    const tabela = csv.split('\r\n');
    expect(tabela[0]).toBe(VISITAS_COLUMNS.map((c) => c.label).join(';'));
    expect(tabela).toHaveLength(1 + 3);
    expect(csv).toContain('20/09/2026 10:00');
  });

  it('o agendamento de um lead que não existe mais mostra o nome sem link, porque a ficha não abriria', async () => {
    // O registro fica no mês, o lead foi excluído (não está em leadsById): o nome vem do registro.
    const mes = m.all.months['2026-09'];
    const sumido = A('r9', 'sumido', 'attended', D(9, 6), D(9, 3), { type: 'visita', leadName: 'Lia Antiga', unit: 'Centro' });
    m.all.months['2026-09'] = { ...mes, aulas: [...mes.aulas, sumido] };
    await abrir();
    expect(nomesDaLista()).toEqual(['Sofia Alves', 'Samuel Brito', 'Lia Antiga', 'Sérgio Dias']);
    const lia = linhas()[2];
    expect(lia.querySelector('a')).toBeNull();
    expect(lia.firstElementChild.textContent).toBe('Lia Antiga');
    expect(celula(lia, 'Consultor').textContent).toBe('Sem responsável');
    // Os outros continuam com o link para a ficha.
    expect(fichas()).toEqual(['s1', 's2', 's4']);
  });
});

describe('Perdas', () => {
  // As fixtures param antes de a etapa da perda começar a ser gravada (14/09, 18h10). Em 20/09 setembro tem a etapa.
  beforeEach(() => { vi.setSystemTime(D(9, 20, 12)); });
  const abrir = (url = '/acad/relatorios/perdas') => montar(url, { section: 'perdas' });

  it('o total, o aviso fixo, a etapa parcial e a lista com há quanto tempo foi a perda', async () => {
    await abrir();
    expect(container.querySelector('h2').textContent).toBe('Perdas');
    expect(heroi()).toBe('1');
    expect(container.textContent).toContain('Esta conta mostra só quem continua perdido hoje.');
    expect(cartao('Por etapa').textContent).toContain('Parcial: a etapa só é gravada desde 14/09/2026.');
    expect(cartao('Por etapa').textContent).toContain('Contato feito');
    expect(nomesDaLista()).toEqual(['Sílvia Costa']);
    expect(celula(linhaDe('s3'), 'Perda').textContent).toBe('06/09 · há 14 dias');
    // O número grande não leva cor.
    expect(container.querySelector('.num.font-display').className).not.toMatch(/text-(rose|emerald)/);
  });

  it('em agosto a etapa fica sem base, e a lista e a planilha dizem o mesmo que o cartão', async () => {
    // Uma perda de agosto, para a lista ter linha no período sem etapa gravada.
    const p2 = L('p2', { name: 'Paulo Dias', createdAt: D(8, 1), status: 'Perda', lostAt: D(8, 10), lossReason: 'Preço' });
    const mes = m.all.months['2026-08'];
    m.all.months['2026-08'] = { ...mes, lost: [p2] };
    m.all.leadsById = new Map([...m.all.leadsById, ['p2', p2]]);
    await abrir('/acad/relatorios/perdas?mes=2026-08');
    expect(cartao('Por etapa').textContent).toContain('Sem base: a etapa da perda só é gravada desde 14/09/2026.');
    expect(nomesDaLista()).toEqual(['Paulo Dias']);
    expect(celula(linhaDe('p2'), 'Etapa').textContent).toBe('Sem base');
    await clicar(botao('Exportar lista'));
    const [linhaCsv] = m.download.mock.calls[0][1].split('\r\n').slice(1);
    const colunas = PERDAS_COLUMNS.map((c) => c.label);
    expect(linhaCsv.split(';')[colunas.indexOf('Etapa')]).toBe('Sem base');
  });

  it('no período parcial a perda sem troca gravada continua em "Sem etapa", como no cartão', async () => {
    // Perdida em setembro, sem a troca para Perda gravada: a etapa não se sabe, e o cartão já usa "Sem etapa".
    const p5 = L('p5', { name: 'Pedro Alves', status: 'Perda', lostAt: D(9, 15), lossReason: 'Preço' });
    const mes = m.all.months['2026-09'];
    m.all.months['2026-09'] = { ...mes, lost: [...mes.lost, p5] };
    m.all.leadsById = new Map([...m.all.leadsById, ['p5', p5]]);
    await abrir();
    expect(cartao('Por etapa').textContent).toContain('Sem etapa');
    expect(cartao('Por etapa').textContent).not.toContain('Sem base');
    expect(celula(linhaDe('p5'), 'Etapa').textContent).toBe('Sem etapa');
  });

  it('um motivo filtra a lista e o exportar baixa a lista de repescagem', async () => {
    await abrir();
    await clicar(recorte('Preço'));
    expect(sonda()).toBe(`?recorte=${encodeURIComponent('motivo:Preço')}`);
    expect(container.textContent).toContain('Motivo: Preço');
    await clicar(botao('Exportar lista'));
    const [arquivo, csv] = m.download.mock.calls[0];
    expect(arquivo).toBe('leads-perdas-2026-09-01-a-2026-09-20.csv');
    expect(csv.split('\r\n')[0]).toBe(PERDAS_COLUMNS.map((c) => c.label).join(';'));
    expect(csv.split('\r\n')[1]).toContain('Sílvia Costa;');
  });
});

describe('Leads parados', () => {
  const abrir = (url = '/acad/relatorios/parados', props = {}) => montar(url, { section: 'parados', ...props });

  it('sem período na barra, sem mês para carregar, e os números saem dos leads em aberto que o app já tem', async () => {
    await abrir();
    expect(gatilho('Período')).toBeNull();
    expect(gatilho('Sem registro há mais de').textContent).toContain('7 dias');
    expect(m.args.monthKeys).toEqual([]);
    expect(container.querySelector('[role="status"]').textContent).toBe('');
    expect(heroi()).toBe('4');
    expect(container.textContent).toContain('de 5 em aberto agora');
    expect(botao('Sem próximo passo').textContent).toContain('3');
    expect(botao('Sem registro há mais de 7 dias').textContent).toContain('4');
    expect(container.textContent).toContain('A lista mostra cada um uma vez.');
    // Quem está há mais dias sem registro primeiro.
    expect(nomesDaLista()).toEqual(['Alice Gomes', 'André Lima', 'Sandra Esteves', 'Samuel Brito']);
    expect(celula(linhaDe('a3'), 'Próximo contato').textContent).toBe('Sem próximo passo');
    expect(celula(linhaDe('a3'), 'Na etapa').textContent).toBe('antes de 14/09');
  });

  it('o corte de dias vai para o endereço, muda o terceiro número e anda junto ao trocar de submenu', async () => {
    const onSection = vi.fn();
    await abrir('/acad/relatorios/parados', { onSection });
    gatilho('Sem registro há mais de').focus();
    await tecla(gatilho('Sem registro há mais de'), 'Enter');
    await tecla(opcao('30 dias'), 'Enter');
    expect(sonda()).toBe('?dias=30');
    expect(botao('Sem registro há mais de 30 dias').textContent).toContain('2');
    await clicar(submenu('Entrada de leads'));
    expect(onSection).toHaveBeenCalledWith('entrada', '?dias=30');
  });

  it('"Sem próximo passo" filtra a lista, e o exportar leva o dia de hoje no nome', async () => {
    await abrir();
    await clicar(botao('Sem próximo passo'));
    expect(sonda()).toBe('?recorte=situacao%3Asem-proximo-passo');
    expect(fichas()).toEqual(['a3', 's2', 's5']);
    await clicar(botao('Exportar lista'));
    const [arquivo, csv] = m.download.mock.calls[0];
    expect(arquivo).toBe('leads-parados-2026-09-14.csv');
    expect(csv.split('\r\n')[0]).toBe(PARADOS_COLUMNS.map((c) => c.label).join(';'));
    expect(csv.split('\r\n')).toHaveLength(1 + 3);
  });

  it('os três números ficam numa linha a partir de sm', async () => {
    await abrir();
    const numeros = botao('Sem próximo passo').parentElement.className.split(/\s+/);
    expect(numeros).toEqual(expect.arrayContaining(['sm:grid-cols-3', 'xl:grid-cols-3']));
    expect(numeros).not.toContain('xl:grid-cols-6');
  });

  it('o lead sem data de cadastro de verdade não mostra 0 nem NaN no último registro', async () => {
    // O app monta o createdAt dele com a hora da carga e marca createdAtMissing: não há dias para contar.
    const semData = L('sd', { name: 'Marta Sem Data', createdAt: NOW, createdAtMissing: true, nextFollowUp: null });
    await abrir('/acad/relatorios/parados', { liveLeads: [...TELA.liveLeads, semData] });
    const linha = linhas().find((tr) => tr.firstElementChild.textContent === 'Marta Sem Data');
    expect(linha).toBeDefined();
    expect(celula(linha, 'Último registro').textContent).toBe('Nenhum');
    expect(celula(linha, 'Na etapa').textContent).toBe('antes de 14/09');
    expect(linha.textContent).not.toMatch(/NaN|\b0 dias?\b|há 0/);
    await clicar(botao('Exportar lista'));
    const csv = m.download.mock.calls[0][1].split('\r\n');
    const colunas = PARADOS_COLUMNS.map((c) => c.label);
    const celulas = csv.find((l) => l.startsWith('Marta Sem Data;')).split(';');
    expect(celulas[colunas.indexOf('Dias sem registro')]).toBe('');
    expect(celulas[colunas.indexOf('Último registro')]).toBe('Nenhum');
  });
});
