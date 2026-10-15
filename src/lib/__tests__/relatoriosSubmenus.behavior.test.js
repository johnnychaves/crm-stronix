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
// Os submenus são links dentro do grupo Leads, que abre fechado: quem clica abre o grupo antes, como na tela.
const submenu = (texto) => [...container.querySelectorAll('nav[aria-label="Relatórios"] a')].find((a) => a.textContent.includes(texto));
const abrirGrupo = async () => {
  const fechado = container.querySelector('nav[aria-label="Relatórios"] button[aria-expanded="false"]');
  if (fechado) await act(async () => { fechado.click(); });
};
const radio = (nome) => container.querySelector(`[role="radio"][aria-label="${nome}"]`);
const sonda = () => container.querySelector('output[data-sonda]').textContent;
const linhas = () => [...container.querySelectorAll('tbody tr')];
const fichas = () => [...container.querySelectorAll('tbody a[href]')].map((a) => a.getAttribute('href').split('/').pop()).sort();
const linhaDe = (id) => linhas().find((tr) => tr.querySelector(`a[href$="/ficha/${id}"]`));
const celula = (tr, coluna) => tr.children[[...container.querySelectorAll('thead th')].findIndex((th) => th.textContent === coluna)];
// O número grande do relatório, fora da lista ao lado (que também mostra números em Space Grotesk).
const heroi = () => [...container.querySelectorAll('.num.font-display')].find((el) => !el.closest('nav'))?.textContent;
const AVISO = 'os agendamentos estão incompletos';

// Peças das telas de Visitas e aulas e de Leads parados: o nome do lead sem as
// iniciais (que são aria-hidden), as abas dos recortes e a aba aberta. O Radix
// ativa a aba no mousedown, e não no click, e só a aba aberta desenha as linhas.
const semOculto = (el) => {
  const copia = el.cloneNode(true);
  copia.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
  return copia.textContent;
};
const nomesNaLista = () => linhas().map((tr) => semOculto(tr.firstElementChild));
const abaDe = (nome) => [...container.querySelectorAll('[role="tab"]')].find((t) => t.textContent === nome);
const escolherAba = async (nome) => {
  await act(async () => { abaDe(nome).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })); });
};
const abaAberta = () => container.querySelector('[role="tab"][data-state="active"]')?.textContent;
// O número de uma célula do painel, pelo rótulo dela.
const numeroDaCelula = (rotulo) => botao(rotulo).querySelector('.num.font-display');
const comAulas = (...aulas) => {
  const mes = m.all.months['2026-09'];
  m.all.months['2026-09'] = { ...mes, aulas: [...mes.aulas, ...aulas] };
};

describe('Visitas e aulas experimentais', () => {
  const abrir = (url = '/acad/relatorios/visitas-e-aulas') => montar(url, { section: 'visitas-e-aulas' });

  it('o comparecimento em verde, os cinco números, o aviso do mês em andamento e a lista em ordem de data', async () => {
    await abrir();
    expect(container.querySelector('h2').textContent).toBe('Visitas e aulas experimentais');
    expect(heroi()).toBe('50%');
    const herói = [...container.querySelectorAll('.num.font-display')].find((el) => !el.closest('nav'));
    expect(herói.className).toContain('text-emerald-700');
    expect(container.textContent).toContain('vieram ÷ (vieram + faltaram) · vs. os 14 primeiros dias de Agosto 2026');
    expect(submenu('Visitas e aulas').getAttribute('aria-current')).toBe('page');
    const numero = (nome) => botao(nome).textContent;
    expect(numero('Marcados')).toContain('3');
    expect(numero('A acontecer')).toContain('1');
    // Marcados soma os que ainda vão acontecer e fica sem variação; os outros ficam sem base contra agosto.
    expect(numero('Marcados')).not.toContain('sem base');
    expect(numero('Marcados')).toContain('com os que virão');
    expect(botao('Marcados').title).toBe('Inclui os agendamentos que vão acontecer, por isso fica sem variação.');
    expect(numero('Vieram')).toContain('sem base');
    expect(numero('A acontecer')).toContain('data ainda vem');
    expect(numeroDaCelula('Vieram').className).toContain('text-emerald-700');
    expect(numeroDaCelula('Faltaram').className).toContain('text-rose-700');
    expect(numeroDaCelula('Sem desfecho').className).toContain('text-amber-700');
    // O aviso diz o que a tela mostra: a pílula "sem base".
    expect(container.textContent).toContain(AVISO);
    expect(container.textContent).toContain('a variação dos números aparece como "sem base"');
    expect(container.textContent).not.toContain('ficam sem variação');
    expect(nomesNaLista()).toEqual(['Sofia Alves', 'Samuel Brito', 'Sérgio Dias']);
    expect(celula(linhaDe('s1'), 'Dia e hora').textContent).toBe('04/09 10:00');
    expect(celula(linhaDe('s1'), 'Tipo').textContent).toBe('Aula');
  });

  it('o desfecho é um selo: veio em verde, faltou em vermelho, sem desfecho em âmbar e a acontecer em cinza', async () => {
    // Uma visita de 09/09 que ninguém marcou.
    comAulas(A('r9', 's5', 'agendada', D(9, 9), D(9, 8), { type: 'visita', unit: 'Centro' }));
    await abrir();
    const selo = (id) => celula(linhaDe(id), 'Desfecho').firstElementChild;
    expect([selo('s1').textContent, selo('s1').className]).toEqual(['Veio', expect.stringContaining('text-emerald-700')]);
    expect([selo('s2').textContent, selo('s2').className]).toEqual(['Faltou', expect.stringContaining('text-rose-700')]);
    expect([selo('s5').textContent, selo('s5').className]).toEqual(['Sem desfecho', expect.stringContaining('text-amber-700')]);
    expect([selo('s4').textContent, selo('s4').className]).toEqual(['A acontecer', expect.stringContaining('text-slate-700')]);
    expect(numeroDaCelula('Sem desfecho').textContent).toBe('1');
  });

  it('"Faltaram" filtra a lista e clicar de novo limpa, e a célula do que não se aplica é um traço que se lê', async () => {
    await abrir();
    await clicar(botao('Faltaram'));
    expect(sonda()).toBe('?recorte=situacao%3Afaltaram');
    expect(botao('Faltaram').getAttribute('aria-pressed')).toBe('true');
    expect(botao('Marcados').getAttribute('aria-pressed')).toBe('false');
    expect(fichas()).toEqual(['s2']);
    const modalidade = celula(linhaDe('s2'), 'Modalidade');
    expect(modalidade.querySelector('[aria-hidden="true"]').textContent).toBe('—');
    expect(modalidade.querySelector('.sr-only').textContent).toBe('não se aplica');
    await clicar(botao('Faltaram'));
    expect(sonda()).toBe('');
    expect(fichas()).toEqual(['s1', 's2', 's4']);
    expect(botao('Marcados').getAttribute('aria-pressed')).toBe('true');
  });

  it('os recortes em abas, com Por professor em segundo, e a linha do professor filtra a lista com a mesma regra', async () => {
    // Uma falta da Paula: não entra na aba nem na lista filtrada pela linha dela.
    comAulas(A('r9', 's5', 'no_show', D(9, 9), D(9, 8), { professorId: 'p1', professorName: 'Paula Nunes', modality: 'Funcional' }));
    await abrir();
    expect([...container.querySelectorAll('[role="tab"]')].map((t) => t.textContent))
      .toEqual(['Visita ou aula', 'Por professor', 'Por consultor', 'Por unidade', 'Por modalidade']);
    expect(abaAberta()).toBe('Visita ou aula');
    await escolherAba('Por professor');
    expect(abaAberta()).toBe('Por professor');
    expect(container.textContent).toContain('só aulas experimentais · quantos matricularam depois da aula · clique numa linha para filtrar a lista');
    const paula = recorte('Paula Nunes');
    expect(paula.getAttribute('aria-label')).toBe('Paula Nunes (Funcional): 1 aula, 1 matrícula, 100% de conversão');
    await clicar(paula);
    expect(sonda()).toBe('?recorte=professor%3Ap1');
    expect(fichas()).toEqual(['s1']);
    expect(container.textContent).toContain('Professor: Paula Nunes');
    // A aba fica na do recorte, e clicar de novo na linha limpa o filtro.
    expect(abaAberta()).toBe('Por professor');
    await clicar(recorte('Paula Nunes'));
    expect(sonda()).toBe('');
    expect(fichas()).toEqual(['s1', 's2', 's4', 's5']);
  });

  it('quem treinou sozinho é uma linha própria, e o link com o recorte de professor abre na aba dele', async () => {
    comAulas(A('r9', 's5', 'attended', D(9, 9), D(9, 8), { soloTraining: true, modality: 'Musculação' }));
    await abrir('/acad/relatorios/visitas-e-aulas?recorte=sozinho%3Asim');
    expect(abaAberta()).toBe('Por professor');
    expect(recorte('Treinou sozinho').getAttribute('aria-pressed')).toBe('true');
    expect(semOculto(recorte('Treinou sozinho').firstElementChild)).toBe('Treinou sozinho sem professor');
    expect(fichas()).toEqual(['s5']);
    expect(container.textContent).toContain('Treinou sozinho');
  });

  it('o exportar leva a lista até o fim do mês, com as colunas dela, e só o recorte quando há um', async () => {
    await abrir();
    await clicar(botao('Exportar lista'));
    const [arquivo, csv] = m.download.mock.calls[0];
    expect(arquivo).toBe('leads-visitas-e-aulas-2026-09-01-a-2026-09-30.csv');
    const tabela = csv.split('\r\n');
    expect(tabela[0]).toBe(VISITAS_COLUMNS.map((c) => c.label).join(';'));
    expect(tabela).toHaveLength(1 + 3);
    expect(csv).toContain('20/09/2026 10:00');
    await clicar(botao('Faltaram'));
    await clicar(botao('Exportar lista'));
    expect(m.download.mock.calls[1][1].split('\r\n')).toHaveLength(1 + 1);
  });

  it('o agendamento de um lead não encontrado mostra o nome sem link', async () => {
    // O registro fica no mês, e o lead não está em leadsById (excluído, ou a leitura falhou): o nome vem do registro.
    comAulas(A('r9', 'sumido', 'attended', D(9, 6), D(9, 3), { type: 'visita', leadName: 'Lia Antiga', unit: 'Centro' }));
    await abrir();
    expect(nomesNaLista()).toEqual(['Sofia Alves', 'Samuel Brito', 'Lia Antiga', 'Sérgio Dias']);
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
  // Peças da tela das Perdas, daqui só: o nome do lead fica no title da célula do nome (NameCell, com as iniciais),
  // e só a aba aberta dos recortes desenha as linhas. O Radix ativa a aba no mousedown, e não no click.
  const nomes = () => linhas().map((tr) => tr.firstElementChild.querySelector('[title]').getAttribute('title'));
  const numeroGrande = () => [...container.querySelectorAll('.num.font-display')].find((el) => !el.closest('nav'));
  const aba = (nome) => [...container.querySelectorAll('[role="tab"]')].find((t) => t.textContent === nome);
  const abrirAba = async (nome) => {
    await act(async () => { aba(nome).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })); });
  };
  const painelAberto = () => container.querySelector('[role="tabpanel"]:not([hidden])');
  const somaDasBarras = () => [...container.querySelectorAll('[role="group"][aria-label="Por dia da perda"] [role="img"]')]
    .reduce((s, b) => s + Number(b.getAttribute('aria-label').match(/: (\d+) /)[1]), 0);
  // Mais perdas no mês, com o nome e o lead na carga.
  const comPerdas = (key, ...leads) => {
    const mes = m.all.months[key];
    m.all.months[key] = { ...mes, lost: [...mes.lost, ...leads] };
    m.all.leadsById = new Map([...m.all.leadsById, ...leads.map((l) => [l.id, l])]);
  };

  it('o total, o gráfico por dia, os avisos, a etapa parcial e a lista com há quanto tempo foi a perda', async () => {
    await abrir();
    expect(container.querySelector('h2').textContent).toBe('Perdas');
    expect(heroi()).toBe('1');
    expect(somaDasBarras()).toBe(1);
    expect(container.textContent).toContain('Esta conta mostra só quem continua perdido hoje.');
    expect(container.textContent).toContain('A etapa da perda só é gravada desde 14/09/2026. As perdas de antes ficam em Sem etapa.');
    await abrirAba('Por etapa');
    expect(painelAberto().textContent).toContain('Contato feito');
    expect(nomes()).toEqual(['Sílvia Costa']);
    expect(celula(linhaDe('s3'), 'Perdeu em').textContent).toBe('06/09');
    expect(celula(linhaDe('s3'), 'Há').textContent).toBe('14 dias');
    // O número grande não leva cor.
    expect(numeroGrande().className).not.toMatch(/text-(rose|emerald)/);
  });

  it('subir as perdas pinta a variação de vermelho', async () => {
    // Agosto, de 1 a 20, com uma perda; setembro, de 1 a 20, com duas: subiu 100%, e subir é ruim.
    comPerdas('2026-08', L('p1', { name: 'Paula Reis', createdAt: D(8, 1), status: 'Perda', lostAt: D(8, 10), lossReason: 'Preço' }));
    comPerdas('2026-09', L('p3', { name: 'Pietra Melo', createdAt: D(9, 1), status: 'Perda', lostAt: D(9, 12), lossReason: 'Horário' }));
    await abrir();
    expect(heroi()).toBe('2');
    const pilula = [...numeroGrande().parentElement.querySelectorAll('span')].find((s) => s.textContent.startsWith('▲'));
    expect(pilula.textContent).toBe('▲ 100%');
    expect(pilula.className).toContain('text-rose-700');
    expect(pilula.className).not.toContain('text-emerald-700');
  });

  it('a perda de hoje diz "hoje", e não "0 dias"', async () => {
    comPerdas('2026-09', L('p4', { name: 'Priscila Nunes', createdAt: D(9, 1), status: 'Perda', lostAt: D(9, 20, 9), lossReason: 'Preço' }));
    await abrir();
    expect(celula(linhaDe('p4'), 'Perdeu em').textContent).toBe('20/09');
    expect(celula(linhaDe('p4'), 'Há').textContent).toBe('hoje');
    expect(linhaDe('p4').textContent).not.toMatch(/\b0 dias?\b|há 0/);
  });

  it('em agosto a etapa fica sem base, e a lista e a planilha dizem o mesmo que a aba', async () => {
    // Uma perda de agosto, para a lista ter linha no período sem etapa gravada.
    comPerdas('2026-08', L('p2', { name: 'Paulo Dias', createdAt: D(8, 1), status: 'Perda', lostAt: D(8, 10), lossReason: 'Preço' }));
    await abrir('/acad/relatorios/perdas?mes=2026-08');
    expect(container.textContent).toContain('Neste período ela fica como Sem base.');
    await abrirAba('Por etapa');
    expect(painelAberto().textContent).toContain('Sem base: a etapa da perda só é gravada desde 14/09/2026.');
    expect(nomes()).toEqual(['Paulo Dias']);
    expect(celula(linhaDe('p2'), 'Etapa').textContent).toBe('Sem base');
    await clicar(botao('Exportar lista'));
    const [linhaCsv] = m.download.mock.calls[0][1].split('\r\n').slice(1);
    const colunas = PERDAS_COLUMNS.map((c) => c.label);
    expect(linhaCsv.split(';')[colunas.indexOf('Etapa')]).toBe('Sem base');
  });

  it('no período parcial a perda sem troca gravada continua em "Sem etapa", como na aba', async () => {
    // Perdida em setembro, sem a troca para Perda gravada: a etapa não se sabe, e a aba já usa "Sem etapa".
    comPerdas('2026-09', L('p5', { name: 'Pedro Alves', status: 'Perda', lostAt: D(9, 15), lossReason: 'Preço' }));
    await abrir();
    await abrirAba('Por etapa');
    expect(painelAberto().textContent).toContain('Sem etapa');
    expect(painelAberto().textContent).not.toContain('Sem base');
    expect(celula(linhaDe('p5'), 'Etapa').textContent).toBe('Sem etapa');
  });

  it('um motivo filtra a lista com o número dele, de novo limpa, e o exportar baixa a lista de repescagem', async () => {
    comPerdas('2026-09', L('p3', { name: 'Pietra Melo', createdAt: D(9, 1), status: 'Perda', lostAt: D(9, 12), lossReason: 'Horário' }));
    await abrir();
    expect(recorte('Preço').getAttribute('aria-label')).toBe('Preço: 1 de 2, 50%');
    await clicar(recorte('Preço'));
    expect(sonda()).toBe(`?recorte=${encodeURIComponent('motivo:Preço')}`);
    expect(recorte('Preço').getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('[aria-label="Limpar filtro da lista"]').parentElement.textContent).toContain('Motivo: Preço');
    expect(nomes()).toEqual(['Sílvia Costa']);
    // Filtrar a lista não muda o total nem o gráfico.
    expect(heroi()).toBe('2');
    expect(somaDasBarras()).toBe(2);
    await clicar(botao('Exportar lista'));
    const [arquivo, csv] = m.download.mock.calls[0];
    expect(arquivo).toBe('leads-perdas-2026-09-01-a-2026-09-20.csv');
    expect(csv.split('\r\n')[0]).toBe(PERDAS_COLUMNS.map((c) => c.label).join(';'));
    expect(csv.split('\r\n')).toHaveLength(1 + 1);
    expect(csv.split('\r\n')[1]).toContain('Sílvia Costa;');
    await clicar(recorte('Preço'));
    expect(sonda()).toBe('');
    expect(nomes()).toHaveLength(2);
  });

  it('o recorte de consultor do endereço abre a aba Por consultor', async () => {
    await abrir('/acad/relatorios/perdas?recorte=consultor%3Aana');
    expect(aba('Por consultor').getAttribute('aria-selected')).toBe('true');
    expect(recorte('Ana Ribeiro').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('números da lista ao lado', () => {
  const numeroDe = (texto) => submenu(texto).querySelector('.font-display')?.textContent ?? null;

  it('cada item mostra o número principal do relatório dele, pela mesma conta da tela', async () => {
    await montar('/acad/relatorios/visitas-e-aulas', { section: 'visitas-e-aulas' });
    expect(numeroDe('Visitas e aulas')).toBe(heroi());
    for (const nome of ['Entrada de leads', 'Conversão', 'Perdas']) expect(numeroDe(nome), nome).not.toBeNull();
    // Leads parados sai das listas ao vivo, então tem número em qualquer submenu.
    expect(numeroDe('Leads parados')).toBe('4');
  });

  it('em Leads parados, que não carrega mês, os relatórios de período ficam sem número', async () => {
    await montar('/acad/relatorios/parados', { section: 'parados' });
    expect(numeroDe('Leads parados')).toBe(heroi());
    for (const nome of ['Entrada de leads', 'Conversão', 'Visitas e aulas', 'Perdas']) expect(numeroDe(nome), nome).toBeNull();
  });
});

describe('Leads parados', () => {
  const abrir = (url = '/acad/relatorios/parados', props = {}) => montar(url, { section: 'parados', ...props });
  const linhaChamada = (nome) => linhas().find((tr) => semOculto(tr.firstElementChild) === nome);

  it('sem período na barra, sem mês para carregar, e os números saem dos leads em aberto que o app já tem', async () => {
    await abrir();
    expect(gatilho('Período')).toBeNull();
    expect(radio('7 dias').getAttribute('aria-checked')).toBe('true');
    expect(m.args.monthKeys).toEqual([]);
    expect(container.querySelector('[role="status"]').textContent).toBe('');
    expect(heroi()).toBe('4');
    expect(container.textContent).toContain('de 5 em aberto agora, 14/09 às 12:00 · cada lead conta uma vez');
    // Retrato de agora: nenhuma variação no painel.
    expect(container.textContent).not.toContain('sem base');
    expect(botao('Sem próximo passo').textContent).toContain('3');
    expect(botao('Sem registro há +7 dias').textContent).toContain('4');
    expect(botao('Sem registro há +7 dias').title).toBe('Sem registro há mais de 7 dias');
    expect(numeroDaCelula('Sem próximo passo').className).toContain('text-amber-700');
    expect(numeroDaCelula('Contato atrasado').className).toContain('text-rose-700');
    // Quem está há mais dias sem registro primeiro.
    expect(nomesNaLista()).toEqual(['Alice Gomes', 'André Lima', 'Sandra Esteves', 'Samuel Brito']);
    const semPasso = celula(linhaDe('a3'), 'Próximo contato').firstElementChild;
    expect([semPasso.textContent, semPasso.className]).toEqual(['Sem próximo passo', expect.stringContaining('text-amber-700')]);
    expect(celula(linhaDe('a3'), 'Na etapa').textContent).toBe('antes de 14/09');
  });

  it('o corte de dias vai para o endereço, muda o terceiro número e anda junto ao trocar de submenu', async () => {
    const onSection = vi.fn();
    await abrir('/acad/relatorios/parados', { onSection });
    await clicar(radio('30 dias'));
    expect(sonda()).toBe('?dias=30');
    expect(radio('30 dias').getAttribute('aria-checked')).toBe('true');
    expect(botao('Sem registro há +30 dias').textContent).toContain('2');
    // Pelo teclado também: a seta volta um corte e escreve no endereço.
    radio('30 dias').focus();
    await tecla(radio('30 dias'), 'ArrowLeft');
    expect(sonda()).toBe('?dias=15');
    expect(document.activeElement).toBe(radio('15 dias'));
    await clicar(radio('30 dias'));
    await abrirGrupo();
    await clicar(submenu('Entrada de leads'));
    expect(onSection).toHaveBeenCalledWith('entrada', '?dias=30');
  });

  it('"Sem próximo passo" filtra a lista e clicar de novo limpa, e o exportar leva o dia de hoje no nome', async () => {
    await abrir();
    await clicar(botao('Sem próximo passo'));
    expect(sonda()).toBe('?recorte=situacao%3Asem-proximo-passo');
    expect(fichas()).toEqual(['a3', 's2', 's5']);
    await clicar(botao('Exportar lista'));
    const [arquivo, csv] = m.download.mock.calls[0];
    expect(arquivo).toBe('leads-parados-2026-09-14.csv');
    expect(csv.split('\r\n')[0]).toBe(PARADOS_COLUMNS.map((c) => c.label).join(';'));
    expect(csv.split('\r\n')).toHaveLength(1 + 3);
    await clicar(botao('Sem próximo passo'));
    expect(sonda()).toBe('');
    expect(fichas()).toEqual(['a2', 'a3', 's2', 's5']);
  });

  it('a aba Por consultor diz que é o dono de hoje, e a linha filtra a lista pelo mesmo dono', async () => {
    await abrir();
    expect([...container.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(['Por consultor']);
    expect(container.textContent).toContain('o dono de hoje, mesmo com o contato delegado · clique numa linha para filtrar a lista');
    const diego = recorte('Diego Santos');
    expect(diego.getAttribute('aria-label')).toBe('Diego Santos: 2 de 4, 50%');
    await clicar(diego);
    expect(sonda()).toBe('?recorte=consultor%3Adiego');
    expect(fichas()).toEqual(['a2', 's2']);
    expect(container.textContent).toContain('Consultor: Diego Santos');
    await clicar(recorte('Diego Santos'));
    expect(sonda()).toBe('');
  });

  it('o último registro, os dias na etapa e o contato atrasado em cada caso', async () => {
    // Registro e entrada na etapa de hoje, com o contato atrasado desde 10/09.
    const hoje = L('h1', { name: 'Hugo Hoje', nextFollowUp: D(9, 10), lastInteractionAt: D(9, 14, 9), statusEnteredAt: D(9, 14, 8) });
    // Registro de 03/09 e a entrada na etapa gravada no futuro (relógio adiantado): fica "hoje", nunca -1.
    const antigo = L('h2', { name: 'Iara Antiga', nextFollowUp: null, lastInteractionAt: D(9, 3, 12), statusEnteredAt: D(9, 15, 9) });
    // Sem registro nenhum: conta do cadastro, em 01/09.
    const semRegistro = L('h3', { name: 'Júlio Novo', createdAt: D(9, 1), nextFollowUp: null });
    await abrir('/acad/relatorios/parados', { liveLeads: [...TELA.liveLeads, hoje, antigo, semRegistro] });
    expect(celula(linhaChamada('Hugo Hoje'), 'Último registro').textContent).toBe('14/09');
    expect(celula(linhaChamada('Hugo Hoje'), 'Na etapa').textContent).toBe('hoje');
    const atraso = celula(linhaChamada('Hugo Hoje'), 'Próximo contato').firstElementChild;
    expect([atraso.textContent, atraso.className]).toEqual(['Atrasado 4 dias', expect.stringContaining('text-rose-700')]);
    expect(celula(linhaChamada('Iara Antiga'), 'Último registro').textContent).toBe('03/09 · há 11 dias');
    expect(celula(linhaChamada('Iara Antiga'), 'Na etapa').textContent).toBe('hoje');
    expect(celula(linhaChamada('Júlio Novo'), 'Último registro').textContent).toBe('Nenhum · cadastro há 13 dias');
    expect(container.querySelector('tbody').textContent).not.toMatch(/-1 dia|\b0 dias?\b/);
  });

  it('o lead sem data de cadastro de verdade não mostra 0 nem NaN no último registro', async () => {
    // O app monta o createdAt dele com a hora da carga e marca createdAtMissing: não há dias para contar.
    const semData = L('sd', { name: 'Marta Sem Data', createdAt: NOW, createdAtMissing: true, nextFollowUp: null });
    await abrir('/acad/relatorios/parados', { liveLeads: [...TELA.liveLeads, semData] });
    const linha = linhaChamada('Marta Sem Data');
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

  it('sem lead parado, a lista diz que não há nenhum', async () => {
    await abrir('/acad/relatorios/parados', { liveLeads: [] });
    expect(container.textContent).toContain('Nenhum lead parado.');
  });
});
