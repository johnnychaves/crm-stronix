// @vitest-environment jsdom
// A tela dos Relatórios em uso (jsdom): o que o relatoriosTela.test.js, que só
// lê o HTML, não alcança. O número que filtra a lista e escreve o recorte no
// endereço, o submenu que leva o período e os filtros mas não o recorte, o
// período escolhido na barra, a grade dos recortes, a planilha com as linhas da
// lista, o botão que some para quem não exporta e a lista que volta aos 50
// primeiros quando o período ou o filtro mudam (e não quando o relógio vira o
// minuto), sem ser montada de novo. A carga do painel é trocada pelas fixtures
// do CRM. Só o Date e o intervalo do relógio da tela são falsos, para andar um
// minuto: o setTimeout do Radix precisa continuar de verdade.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';
import { ENTRADA_COLUMNS } from '../relatorios/leads/entrada.js';
import { makeCtx, NOW, L, D } from './fixtures/crmCtx.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O Popper do Radix mede o conteúdo com ResizeObserver, e a lista do Select leva
// a opção marcada para a vista com scrollIntoView. O jsdom não tem nenhum dos dois.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

const m = vi.hoisted(() => ({ sources: null, download: vi.fn() }));

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useCrmSources.js', () => ({ useCrmSources: () => m.sources }));
// Só o download é falso: o toCsv é o de verdade, e é ele que monta o que o teste confere.
vi.mock('../csvExport.js', async (importOriginal) => ({ ...(await importOriginal()), downloadCsv: m.download }));

const { RelatoriosView } = await import('../../views/relatorios/RelatoriosView.jsx');

const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: 'relatorios' };
const GESTORA = { id: 'ana', name: 'Ana Ribeiro', role: 'admin', tenantId: 'acad', authUid: 'a1' };
const EQUIPE = [GESTORA, { id: 'diego', name: 'Diego Santos', role: 'consultant', tenantId: 'acad', authUid: 'd1' }];
const TELA = {
  db: {}, appUser: GESTORA, usersList: EQUIPE, funnels: makeCtx().funnels,
  sources: [{ name: 'Instagram', channel: 'Pago' }, { name: 'Indicação' }],
  liveLeads: [], interactions: [], section: 'entrada', onSection: () => {},
};

// As fixtures não dão nome aos leads, e a planilha só se confere por nome.
const NOMES = { s1: 'Sofia Alves', s2: 'Samuel Brito', s3: 'Sílvia Costa', s4: 'Sérgio Dias', s5: 'Sandra Esteves' };
const MES_VAZIO = { leadsCreated: [], converted: [], lost: [], aulas: [], interactions: [] };

// Setembro em andamento e agosto fechado, com nome em cada lead e julho vazio,
// que o comparado de agosto pede.
function fontesDoPainel() {
  const c = makeCtx();
  const nomeado = (l) => (NOMES[l.id] ? { ...l, name: NOMES[l.id] } : l);
  const months = Object.fromEntries(Object.entries(c.months).map(([key, mes]) => [key, {
    ...mes, leadsCreated: mes.leadsCreated.map(nomeado), converted: mes.converted.map(nomeado), lost: mes.lost.map(nomeado),
  }]));
  return {
    months: { '2026-07': MES_VAZIO, ...months },
    leadsById: new Map([...c.leadsById].map(([id, l]) => [id, nomeado(l)])),
    loading: false,
    failedKeys: [],
  };
}

// 120 leads de 7 a 13 de setembro, dentro do mês e dentro da semana passada:
// 70 do Instagram e 50 da Indicação. Passam dos 50 da primeira página nos três recortes.
function fontesComMuitosLeads() {
  const leads = Array.from({ length: 120 }, (_, i) => L(`m${i}`, {
    name: `Aluno ${String(i).padStart(3, '0')}`,
    source: i < 70 ? 'Instagram' : 'Indicação',
    createdAt: D(9, 7 + (i % 7), 9 + (i % 5)),
  }));
  return {
    months: { '2026-08': MES_VAZIO, '2026-09': { ...MES_VAZIO, leadsCreated: leads } },
    leadsById: new Map(leads.map((l) => [l.id, l])),
    loading: false,
    failedKeys: [],
  };
}

// Quem lê a query do endereço: a tela navega com replace, e é por aqui que o teste enxerga o resultado.
function Sonda() {
  return h('output', { 'data-sonda': '' }, useLocation().search);
}

let root = null;
let container = null;
let avisos = [];
const arvore = (url, props) => h(MemoryRouter, { initialEntries: [url] },
  h(LeadProfileContext.Provider, { value: profile }, h(RelatoriosView, { ...TELA, ...props })),
  h(Sonda));
async function montar(url, props = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(arvore(url, props)); });
}
// Outro submenu na mesma árvore, como o App faz ao trocar de sub-tela: o endereço inicial só vale na primeira vez.
const remontar = (url, props = {}) => act(async () => { root.render(arvore(url, props)); });
// Aviso do React (key repetida, aninhamento inválido, act) ou do Radix é defeito: derruba o teste.
beforeEach(() => {
  avisos = [];
  vi.spyOn(console, 'error').mockImplementation((...args) => { avisos.push(args.map(String).join(' ')); });
  vi.spyOn(console, 'warn').mockImplementation((...args) => { avisos.push(`aviso: ${args.map(String).join(' ')}`); });
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(NOW);
  m.download.mockClear();
  m.sources = fontesDoPainel();
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
// Quem clica com o mouse já deixa o foco no botão: o teste faz o mesmo antes do clique.
const clicarComFoco = async (el) => { el.focus(); await clicar(el); };
const botao = (texto) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
// A linha de recorte tem o nome no title, e o canal da origem entra no texto do botão.
const recorte = (nome) => container.querySelector(`button [title="${nome}"]`)?.closest('button');
const submenu = (texto) => [...container.querySelectorAll('nav[aria-label="Relatórios"] button')].find((b) => b.textContent.includes(texto));
const gatilho = (nome) => container.querySelector(`button[aria-label="${nome}"]`);
const balao = () => document.querySelector('[data-slot="popover-content"]');
const opcaoDoPeriodo = (texto) => [...balao().querySelectorAll('button')].find((b) => b.textContent.trim() === texto);
const sonda = () => container.querySelector('output[data-sonda]').textContent;
const linhas = () => [...container.querySelectorAll('tbody tr')];
const nomesDaLista = () => linhas().map((tr) => tr.firstElementChild.textContent);
// Os ids das fichas que a lista linka, em ordem de id: a ordem da lista não é o que se confere aqui.
const fichas = () => [...container.querySelectorAll('tbody a[href]')].map((a) => a.getAttribute('href').split('/').pop()).sort();
const numeroDaLista = () => container.querySelector('p[aria-live="polite"]');
const limpar = () => container.querySelector('[aria-label="Limpar filtro da lista"]');
// A grade que reúne os cartões de recorte: o pai do cartão que tem o título.
const grade = (titulo) => [...container.querySelectorAll('h4')].find((t) => t.textContent === titulo).closest('section').parentElement;

describe('número que filtra a lista', () => {
  it('"Matricularam" escreve o recorte no endereço e deixa na lista só quem matriculou; de novo, limpa', async () => {
    await montar('/acad/relatorios/conversao', { section: 'conversao' });
    expect(sonda()).toBe('');
    expect(fichas()).toEqual(['s1', 's2', 's3', 's4', 's5']);
    expect(botao('Leads da safra').getAttribute('aria-pressed')).toBe('true');
    // A rapidez do primeiro contato chega com as quatro faixas do painel.
    for (const faixa of ['Até 1 hora', 'Até 24 horas', 'Mais de 24 horas', 'Sem contato']) {
      expect(recorte(faixa), faixa).toBeTruthy();
    }

    await clicar(botao('Matricularam'));
    expect(sonda()).toBe('?recorte=situacao%3Amatricularam');
    expect(fichas()).toEqual(['s1']);
    expect(botao('Matricularam').getAttribute('aria-pressed')).toBe('true');
    expect(botao('Leads da safra').getAttribute('aria-pressed')).toBe('false');
    // A lista repete o filtro e o número de nomes que ela mostra agora.
    expect(limpar().parentElement.textContent).toContain('Matricularam');
    expect(numeroDaLista().textContent).toBe('1lead');

    await clicar(botao('Matricularam'));
    expect(sonda()).toBe('');
    expect(fichas()).toEqual(['s1', 's2', 's3', 's4', 's5']);
    expect(limpar()).toBeNull();
  });
});

describe('lista ao lado', () => {
  it('"Conversão" chama onSection com o período e os filtros e sem o recorte da lista', async () => {
    const onSection = vi.fn();
    await montar('/acad/relatorios?periodo=semana-passada&resp=diego&origem=Instagram&funil=ven&recorte=origem%3AInstagram', { onSection });
    await clicar(submenu('Conversão'));
    expect(onSection).toHaveBeenCalledTimes(1);
    expect(onSection).toHaveBeenCalledWith('conversao', '?periodo=semana-passada&resp=diego&origem=Instagram&funil=ven');
    // Quem troca de submenu é o App, com essa query: a tela não navega sozinha.
    expect(sonda()).toBe('?periodo=semana-passada&resp=diego&origem=Instagram&funil=ven&recorte=origem%3AInstagram');
  });
});

describe('período da barra', () => {
  it('"Hoje" escreve periodo=hoje e tira o mês do endereço', async () => {
    await montar('/acad/relatorios?mes=2026-08');
    expect(sonda()).toBe('?mes=2026-08');
    expect(gatilho('Mês de competência')).not.toBeNull();
    await clicar(gatilho('Período'));
    await clicar(opcaoDoPeriodo('Hoje'));
    expect(sonda()).toBe('?periodo=hoje');
    expect(balao()).toBeNull();
    // O botão passa a dizer o dia, e o mês e as setas saem da barra com o modo mês.
    expect(gatilho('Período').textContent).toContain('Hoje');
    expect(gatilho('Mês de competência')).toBeNull();
  });
});

describe('grade dos recortes', () => {
  it('a Entrada põe três cartões lado a lado só a partir de xl, e a Conversão nunca põe três', async () => {
    await montar('/acad/relatorios');
    // Com a lista de relatórios ao lado, três colunas a partir de lg deixavam o nome sem espaço.
    expect(grade('Por origem').className).toContain('sm:grid-cols-2');
    expect(grade('Por origem').className).toContain('xl:grid-cols-3');
    expect(grade('Por origem').className).not.toContain('lg:grid-cols');
    expect(grade('Por consultor')).toBe(grade('Por origem'));
    expect(grade('Por funil')).toBe(grade('Por origem'));

    // Cada recorte da Conversão já traz leads, matrículas e a barra da conversão ao lado do nome.
    await remontar('/acad/relatorios/conversao', { section: 'conversao' });
    expect(grade('Por origem').className).toContain('xl:grid-cols-2');
    expect(grade('Por origem').className).not.toMatch(/grid-cols-3/);
    expect(grade('Rapidez do primeiro contato')).toBe(grade('Por origem'));
  });
});

describe('exportar', () => {
  it('"Exportar lista" baixa a planilha com exatamente as linhas que a lista mostra, com e sem filtro', async () => {
    await montar('/acad/relatorios');
    const cabecalho = ENTRADA_COLUMNS.map((c) => c.label).join(';');

    await clicar(botao('Exportar lista'));
    expect(m.download).toHaveBeenCalledTimes(1);
    const [arquivo, csv] = m.download.mock.calls[0];
    expect(arquivo).toBe('leads-entrada-2026-09-01-a-2026-09-14.csv');
    let tabela = csv.split('\r\n');
    expect(tabela[0]).toBe(cabecalho);
    expect(tabela.slice(1).map((linha) => linha.split(';')[0]).sort()).toEqual(nomesDaLista().sort());
    expect(tabela).toHaveLength(1 + 5);

    // Com o recorte, a lista encolhe e a planilha encolhe junto; o nome do arquivo é o do período.
    await clicar(recorte('Indicação'));
    expect(nomesDaLista()).toEqual(['Samuel Brito']);
    await clicar(botao('Exportar lista'));
    expect(m.download).toHaveBeenCalledTimes(2);
    const [arquivoFiltrado, csvFiltrado] = m.download.mock.calls[1];
    expect(arquivoFiltrado).toBe(arquivo);
    tabela = csvFiltrado.split('\r\n');
    expect(tabela[0]).toBe(cabecalho);
    expect(tabela.slice(1).map((linha) => linha.split(';')[0])).toEqual(['Samuel Brito']);
    expect(tabela[1]).toContain('Indicação');
  });

  it('quem não pode exportar vê os números e a lista, mas não o botão', async () => {
    const professor = { id: 'p', role: 'professor', tenantId: 'acad', authUid: 'p1' };
    await montar('/acad/relatorios', { appUser: professor });
    expect(container.textContent).toContain('Entrada de leads');
    expect(fichas()).toHaveLength(5);
    expect(botao('Exportar lista')).toBeUndefined();
  });
});

describe('lista com mais de uma página', () => {
  it('volta aos 50 quando o período ou o recorte mudam, e não é montada de novo', async () => {
    m.sources = fontesComMuitosLeads();
    await montar('/acad/relatorios');
    expect(linhas()).toHaveLength(50);
    await clicar(botao('Mostrar mais 50'));
    expect(linhas()).toHaveLength(100);
    const numero = numeroDaLista();
    expect(numero.textContent).toBe('120leads');

    // Passa um minuto: o relógio da tela refaz o período e as contas, com objetos novos, e a lista
    // continua aberta, porque o listId vem do endereço e não do relógio nem dos dados.
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(linhas()).toHaveLength(100);
    expect(numeroDaLista()).toBe(numero);

    // Outro período: os 120 leads continuam na lista, e ela volta à primeira página.
    await clicar(gatilho('Período'));
    await clicar(opcaoDoPeriodo('Semana passada'));
    expect(sonda()).toBe('?periodo=semana-passada');
    expect(numeroDaLista().textContent).toBe('120leads');
    expect(linhas()).toHaveLength(50);
    expect(numeroDaLista()).toBe(numero);

    // Outro recorte da lista: com o Mostrar mais aberto, os 70 do Instagram cabem todos, e a lista
    // que não fechasse mostraria 70 linhas. Fechada, são 50 e faltam 20.
    await clicar(botao('Mostrar mais 50'));
    expect(linhas()).toHaveLength(100);
    await clicar(recorte('Instagram'));
    expect(sonda()).toBe('?periodo=semana-passada&recorte=origem%3AInstagram');
    expect(numeroDaLista().textContent).toBe('70leads');
    expect(linhas()).toHaveLength(50);
    expect(botao('Mostrar mais 20')).toBeTruthy();
    expect(numeroDaLista()).toBe(numero);

    // Dentro do mesmo recorte o Mostrar mais se mantém, e limpar o filtro leva o foco ao número da
    // lista, que continua o mesmo elemento: se a lista fosse montada de novo, o foco cairia no body.
    await clicar(botao('Mostrar mais 20'));
    expect(linhas()).toHaveLength(70);
    await clicarComFoco(limpar());
    expect(sonda()).toBe('?periodo=semana-passada');
    expect(limpar()).toBeNull();
    expect(linhas()).toHaveLength(50);
    expect(numeroDaLista()).toBe(numero);
    expect(document.activeElement).toBe(numero);
  });
});
