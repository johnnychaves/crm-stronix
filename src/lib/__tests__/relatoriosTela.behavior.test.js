// @vitest-environment jsdom
// A tela dos Relatórios em uso (jsdom): o que o relatoriosTela.test.js, que só
// lê o HTML, não alcança. O número que filtra a lista e escreve o recorte no
// endereço, o submenu que leva o período e os filtros mas não o recorte (e o
// que já está aberto, que não troca nada e deixa o recorte), o período
// escolhido na barra, os filtros da barra que chegam aos números, os meses
// que a tela pede à carga, o véu enquanto o período novo carrega (com o
// comparado e o aviso do que está na tela), a região de estado, os
// agendamentos sem base, a grade dos recortes, as colunas da lista, a linha
// Outros, a planilha, o botão que some para quem não exporta e a lista que
// volta aos 50 primeiros quando o período ou o filtro mudam (e não quando o
// relógio vira o minuto), sem ser montada de novo.
//
// A carga do painel é trocada pelas fixtures do CRM, e responde como a de
// verdade: os meses que ela tem chegam de uma vez, o mês que ela não tem fica
// carregando, e o objeto devolvido é o mesmo enquanto o pedido é o mesmo (a
// useCrmSources devolve os mesmos months e leadsById enquanto nada muda). Um
// objeto novo a cada render faria o ajuste de estado do véu rodar sem parar.
// Só o Date e o intervalo do relógio da tela são falsos, para andar um minuto:
// o setTimeout do Radix precisa continuar de verdade.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';
import { ENTRADA_COLUMNS } from '../relatorios/leads/entrada.js';
import { CONVERSAO_COLUMNS } from '../relatorios/leads/conversao.js';
import { makeCtx, NOW, L, D } from './fixtures/crmCtx.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O Popper do Radix mede o conteúdo com ResizeObserver, e a lista do Select leva
// a opção marcada para a vista com scrollIntoView. O jsdom não tem nenhum dos dois.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

const m = vi.hoisted(() => ({ all: null, args: null, cache: new Map(), download: vi.fn() }));

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useCrmSources.js', () => ({ useCrmSources }));
// Só o download é falso: o toCsv é o de verdade, e é ele que monta o que o teste confere.
vi.mock('../csvExport.js', async (importOriginal) => ({ ...(await importOriginal()), downloadCsv: m.download }));

function useCrmSources(args) {
  m.args = args;
  const keys = args.monthKeys.join(',');
  if (!m.cache.has(keys)) {
    const months = Object.fromEntries(args.monthKeys.filter((k) => m.all.months[k]).map((k) => [k, m.all.months[k]]));
    const failedKeys = Object.keys(months).filter((k) => months[k].failed);
    m.cache.set(keys, { months, leadsById: m.all.leadsById, loading: args.monthKeys.some((k) => !m.all.months[k]), failedKeys });
  }
  return m.cache.get(keys);
}

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
  return { months: { '2026-07': MES_VAZIO, ...months }, leadsById: new Map([...c.leadsById].map(([id, l]) => [id, nomeado(l)])) };
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
  };
}

// Troca o que a carga tem. A resposta guardada vale para a carga antiga, e a
// tela já montada só a pede de novo no render seguinte (remontar).
function usar(all) {
  m.all = all;
  m.cache.clear();
}

// Quem lê a query do endereço: a tela navega com replace, e é por aqui que o teste enxerga o resultado.
function Sonda() {
  return h('output', { 'data-sonda': '' }, useLocation().search);
}

// O que o App faz no onSection (o goToSub): troca o endereço pelo do submenu, com a
// query que a tela mandou e com replace. O onSection falso do resto do arquivo não
// navega, e sem navegar não há como ver o recorte sumir do endereço.
function TelaQueTroca({ onSection, ...props }) {
  const navigate = useNavigate();
  return h(RelatoriosView, {
    ...props,
    onSection: (id, query) => {
      onSection(id, query);
      navigate(hrefFor('acad', 'relatorios', { sub: id }) + query, { replace: true });
    },
  });
}

let root = null;
let container = null;
let avisos = [];
const arvore = (url, props, Tela = RelatoriosView) => h(MemoryRouter, { initialEntries: [url] },
  h(LeadProfileContext.Provider, { value: profile }, h(Tela, { ...TELA, ...props })),
  h(Sonda));
async function montar(url, props = {}, Tela) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(arvore(url, props, Tela)); });
}
// Outro submenu, ou a carga trocada, na mesma árvore: o endereço inicial só vale na primeira vez.
const remontar = (url, props = {}) => act(async () => { root.render(arvore(url, props)); });
// Aviso do React (key repetida, aninhamento inválido, act) ou do Radix é defeito: derruba o teste.
beforeEach(() => {
  avisos = [];
  vi.spyOn(console, 'error').mockImplementation((...args) => { avisos.push(args.map(String).join(' ')); });
  vi.spyOn(console, 'warn').mockImplementation((...args) => { avisos.push(`aviso: ${args.map(String).join(' ')}`); });
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(NOW);
  m.download.mockClear();
  m.args = null;
  usar(fontesDoPainel());
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
const recorte = (nome) => container.querySelector(`button [title^="${nome}"]`)?.closest('button');
const submenu = (texto) => [...container.querySelectorAll('nav[aria-label="Relatórios"] button')].find((b) => b.textContent.includes(texto));
const gatilho = (nome) => container.querySelector(`button[aria-label="${nome}"]`);
const balao = () => document.querySelector('[data-slot="popover-content"]');
const opcaoDoPeriodo = (texto) => [...balao().querySelectorAll('button')].find((b) => b.textContent.trim() === texto);
const sonda = () => container.querySelector('output[data-sonda]').textContent;
const linhas = () => [...container.querySelectorAll('tbody tr')];
const nomesDaLista = () => linhas().map((tr) => tr.firstElementChild.textContent);
// Os ids das fichas que a lista linka, em ordem de id: a ordem da lista não é o que se confere aqui.
const fichas = () => [...container.querySelectorAll('tbody a[href]')].map((a) => a.getAttribute('href').split('/').pop()).sort();
const linhaDe = (id) => linhas().find((tr) => tr.querySelector(`a[href$="/ficha/${id}"]`));
// A célula de uma linha, pelo texto do cabeçalho da coluna.
const celula = (tr, coluna) => tr.children[[...container.querySelectorAll('thead th')].findIndex((th) => th.textContent === coluna)];
const numeroDaLista = () => container.querySelector('p[aria-live="polite"]');
const limpar = () => container.querySelector('[aria-label="Limpar filtro da lista"]');
const heroi = () => container.querySelector('.num.font-display')?.textContent;
const regiaoDeEstado = () => container.querySelector('[role="status"]');
// A grade que reúne os cartões de recorte: o pai do cartão que tem o título.
const grade = (titulo) => [...container.querySelectorAll('h3')].find((t) => t.textContent === titulo).closest('section').parentElement;
const AVISO = 'os agendamentos estão incompletos';
// O comparado do mês em andamento (dia 14 às 12h): os mesmos primeiros dias do mês anterior, como o painel CRM diz.
const PRORATA = 'vs. os 14 primeiros dias de Agosto 2026';
// O texto do comparado ao lado do número grande.
const comparado = () => [...container.querySelectorAll('span')].find((s) => s.textContent.startsWith('vs. '))?.textContent;

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
    // A lista repete o filtro e o número de nomes que ela mostra agora, e a tabela se chama por esse número.
    expect(limpar().parentElement.textContent).toContain('Matricularam');
    expect(numeroDaLista().textContent).toBe('1 lead');
    expect(document.getElementById(container.querySelector('table').getAttribute('aria-labelledby'))).toBe(numeroDaLista());

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

  it('clicar no submenu que já está aberto não chama onSection e deixa o recorte da lista no endereço', async () => {
    const onSection = vi.fn();
    await montar('/acad/relatorios?resp=diego&recorte=origem%3AInstagram', { onSection }, TelaQueTroca);
    // O recorte está valendo: da carteira do Diego, só quem veio do Instagram, com o filtro à vista na lista.
    expect(sonda()).toBe('?resp=diego&recorte=origem%3AInstagram');
    expect(fichas()).toEqual(['s4']);
    expect(limpar()).not.toBeNull();

    await clicar(submenu('Entrada de leads'));
    expect(onSection).not.toHaveBeenCalled();
    expect(sonda()).toBe('?resp=diego&recorte=origem%3AInstagram');
    expect(fichas()).toEqual(['s4']);
    expect(limpar()).not.toBeNull();

    // Controle: o clique em outro submenu navega e leva só o recorte embora. Sem isto, o endereço
    // acima poderia ter ficado parado por a troca de endereço do teste não funcionar.
    await clicar(submenu('Conversão'));
    expect(onSection).toHaveBeenCalledTimes(1);
    expect(onSection).toHaveBeenCalledWith('conversao', '?resp=diego');
    expect(sonda()).toBe('?resp=diego');
  });

  it('não repete o título da tela, que é o do cabeçalho do App, e começa na altura da barra', async () => {
    await montar('/acad/relatorios');
    const aside = container.querySelector('aside');
    // A lista de relatórios é só a lista, sem título nem frase de apoio, e a tela não tem outro título de página.
    expect(aside.querySelector('h1, h2, h3, p')).toBeNull();
    expect(aside.textContent).not.toContain('Os números do período');
    expect(container.querySelector('h1')).toBeNull();
    expect(container.querySelector('h2').textContent).toBe('Entrada de leads');
    // Com o top-0 ela para na altura da barra; o top-20 a deixava 80px abaixo dela.
    expect(aside.className).toContain('lg:sticky');
    expect(aside.className).toContain('lg:top-0');
    expect(aside.className).not.toContain('lg:top-20');
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

describe('filtros da barra chegam aos números', () => {
  it('o consultor do endereço recorta a lista e o total', async () => {
    await montar('/acad/relatorios?resp=diego');
    expect(fichas()).toEqual(['s2', 's4']);
    expect(heroi()).toBe('2');
  });

  it('a origem do endereço recorta a lista', async () => {
    await montar('/acad/relatorios?origem=Indica%C3%A7%C3%A3o');
    expect(fichas()).toEqual(['s2']);
  });

  it('o funil do endereço recorta a lista', async () => {
    await montar('/acad/relatorios?funil=ind');
    expect(fichas()).toEqual(['s2']);
  });
});

describe('carga', () => {
  it('pede os meses do início do comparado até o mês atual e obedece ao portão de ociosidade', async () => {
    await montar('/acad/relatorios?mes=2026-08', { listenersActive: false });
    expect(m.args.monthKeys).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(m.args.enabled).toBe(false);
    await remontar('/acad/relatorios?mes=2026-08', { listenersActive: true });
    expect(m.args.enabled).toBe(true);
  });

  it('a lista de meses é a mesma quando o relógio vira o minuto, para a carga não ser pedida de novo', async () => {
    await montar('/acad/relatorios');
    const meses = m.args.monthKeys;
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(m.args.monthKeys).toBe(meses);
  });
});

describe('véu enquanto o período novo carrega', () => {
  it('mantém o último resultado sob o véu, sem exportar nem receber foco, e não o leva para outro submenu', async () => {
    await montar('/acad/relatorios?mes=2026-08');
    const antes = heroi();
    // Junho não tem carga: ao voltar para julho, os números de agosto ficam sob o véu.
    await clicar(container.querySelector('[aria-label="Mês anterior"]'));
    expect(sonda()).toBe('?mes=2026-07');
    const veu = container.querySelector('[aria-busy="true"]');
    expect(veu).not.toBeNull();
    expect(veu.className).toContain('opacity-35');
    expect(veu.className).toContain('pointer-events-none');
    expect(veu.hasAttribute('inert')).toBe(true);
    expect(heroi()).toBe(antes);
    expect(botao('Exportar lista').disabled).toBe(true);
    // O resultado de um submenu não vale para o outro: a Conversão espera a carga.
    await remontar('/acad/relatorios/conversao', { section: 'conversao' });
    expect(regiaoDeEstado().textContent).toBe('Carregando os números do período.');
    expect(container.querySelector('[aria-busy]')).toBeNull();
  });

  it.each([
    ['Entrada', '/acad/relatorios?de=2026-09-08&ate=2026-09-13', {}, false],
    ['Conversão', '/acad/relatorios/conversao?de=2026-09-08&ate=2026-09-13', { section: 'conversao' }, true],
  ])('%s: o resultado velho fica com o comparado dele, e os do período novo entram quando a carga chega', async (_, url, props, temAviso) => {
    // Agosto ainda não chegou: os dias 8 a 13 de setembro só pedem setembro, mas o mês de setembro pede agosto.
    const fontes = fontesDoPainel();
    const agosto = fontes.months['2026-08'];
    delete fontes.months['2026-08'];
    usar(fontes);
    await montar(url, props);
    expect(comparado()).toBe('vs. 2 a 7 set');
    expect(container.textContent).not.toContain(AVISO);
    expect(container.querySelector('[aria-busy="false"]').hasAttribute('inert')).toBe(false);

    await clicar(gatilho('Período'));
    await clicar(opcaoDoPeriodo('Mês'));
    expect(sonda()).toBe('');
    const veu = container.querySelector('[aria-busy="true"]');
    expect(veu.hasAttribute('inert')).toBe(true);
    // Sob o véu, os números são os dos dias 8 a 13: o "vs." (e o aviso, na Conversão) são os deles, e não os do mês escolhido.
    expect(veu.textContent).toContain('vs. 2 a 7 set');
    expect(veu.textContent).not.toContain('vs. os 14 primeiros dias');
    expect(veu.textContent).not.toContain(AVISO);

    // Agosto chega: o resultado novo entra, com o comparado do mês (e o aviso, na Conversão).
    fontes.months['2026-08'] = agosto;
    usar(fontes);
    await remontar(url, props);
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    expect(container.querySelector('[aria-busy="false"]').hasAttribute('inert')).toBe(false);
    expect(comparado()).toBe(PRORATA);
    expect(container.textContent).not.toContain('vs. 2 a 7 set');
    expect(container.textContent.includes(AVISO)).toBe(temAviso);
  });
});

describe('Conversão sem leads no período', () => {
  // Hoje (dia 14, meio-dia) ainda não chegou lead nas fixtures; ontem chegou o s4.
  const cartao = (titulo) => [...container.querySelectorAll('h3')].find((t) => t.textContent === titulo).closest('section');

  it('o número grande diz "sem base" uma vez, com o comparado, e a rapidez diz que não há nada, como os outros recortes', async () => {
    await montar('/acad/relatorios/conversao?periodo=hoje', { section: 'conversao' });
    const topo = container.querySelector('.num.font-display').parentElement.textContent;
    expect(topo.split('sem base')).toHaveLength(2);
    expect(comparado()).toBe('vs. 13 set');
    for (const titulo of ['Por origem', 'Por consultor', 'Rapidez do primeiro contato']) {
      expect(cartao(titulo).textContent, titulo).toContain('Nada no período.');
    }
    expect(recorte('Até 1 hora')).toBeFalsy();
    // Com leads no período (o mês), as quatro faixas voltam.
    await clicar(gatilho('Período'));
    await clicar(opcaoDoPeriodo('Mês'));
    expect(sonda()).toBe('');
    for (const faixa of ['Até 1 hora', 'Até 24 horas', 'Mais de 24 horas', 'Sem contato']) {
      expect(recorte(faixa), faixa).toBeTruthy();
    }
  });
});

describe('foco embaixo da barra fixa', () => {
  // O jsdom não rola nem mede: o que se confere é a margem de rolagem no lugar certo. No
  // navegador, sem ela, quem voltava com Shift+Tab pela lista via o foco sumir atrás da barra.
  it('o que recebe foco no corpo do relatório para abaixo da barra ao rolar, e a barra fica fora da margem', async () => {
    await montar('/acad/relatorios/conversao', { section: 'conversao' });
    const corpo = container.querySelector('[aria-busy]');
    expect(corpo.className).toContain('[&_:is(a,button,[tabindex])]:scroll-mt-32');
    // O que recebe foco no relatório está dentro do corpo: o exportar, os números, os recortes, os nomes e o número da lista.
    for (const el of [botao('Exportar lista'), botao('Matricularam'), linhas()[0].querySelector('a'), numeroDaLista()]) {
      expect(corpo.contains(el)).toBe(true);
    }
    // A barra é fixa e não rola até o foco: os controles dela ficam fora do corpo.
    expect(corpo.contains(gatilho('Período'))).toBe(false);
  });
});

describe('região de estado', () => {
  it('carregando, falhou e pronto passam pela mesma região, que está no DOM nos três casos', async () => {
    usar({ months: {}, leadsById: new Map() });
    await montar('/acad/relatorios');
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
    const regiao = regiaoDeEstado();
    expect(regiao.textContent).toBe('Carregando os números do período.');
    expect(container.querySelector('table')).toBeNull();

    const fontes = fontesDoPainel();
    usar({ ...fontes, months: { ...fontes.months, '2026-09': { ...fontes.months['2026-09'], failed: true } } });
    await remontar('/acad/relatorios');
    expect(regiaoDeEstado()).toBe(regiao);
    expect(regiao.textContent).toContain('Não deu para carregar o período.');
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('[aria-busy]')).toBeNull();

    usar(fontes);
    await remontar('/acad/relatorios');
    expect(regiaoDeEstado()).toBe(regiao);
    expect(regiao.textContent).toBe('');
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(container.querySelector('table')).not.toBeNull();
  });
});

describe('texto do comparado', () => {
  it.each([
    ['o mês em andamento compara os mesmos primeiros dias do mês anterior', '/acad/relatorios', PRORATA],
    ['o mês fechado mantém o nome do comparado', '/acad/relatorios?mes=2026-08', 'vs. Julho 2026'],
    ['a semana passada mantém o nome do comparado', '/acad/relatorios?periodo=semana-passada', 'vs. 31 ago a 6 set'],
    ['o intervalo mantém o nome do comparado', '/acad/relatorios?de=2026-09-08&ate=2026-09-13', 'vs. 2 a 7 set'],
  ])('na Entrada, %s', async (_, url, esperado) => {
    await montar(url);
    expect(comparado()).toBe(esperado);
  });

  it('na Conversão o mês em andamento também compara os mesmos primeiros dias', async () => {
    await montar('/acad/relatorios/conversao', { section: 'conversao' });
    expect(comparado()).toBe(PRORATA);
  });

  it('no dia 1 o comparado é o primeiro dia do mês anterior', async () => {
    vi.setSystemTime(new Date(2026, 8, 1, 12, 0));
    await montar('/acad/relatorios');
    expect(comparado()).toBe('vs. o primeiro dia de Agosto 2026');
  });
});

describe('agendamentos sem base', () => {
  it.each([
    ['o mês de setembro, contra agosto', '/acad/relatorios/conversao', true],
    ['agosto, contra julho', '/acad/relatorios/conversao?mes=2026-08', true],
    ['a semana passada, que tem o comparado a partir de 31/08', '/acad/relatorios/conversao?periodo=semana-passada', true],
    ['os dias 8 a 13 de setembro, contra os dias logo antes', '/acad/relatorios/conversao?de=2026-09-08&ate=2026-09-13', false],
    ['hoje, contra ontem', '/acad/relatorios/conversao?periodo=hoje', false],
  ])('%s: o aviso dos agendamentos aparece só quando o período ou o comparado começa antes de setembro', async (_, url, aparece) => {
    await montar(url, { section: 'conversao' });
    expect(container.textContent.includes(AVISO)).toBe(aparece);
    // O aviso diz o que acontece nos dois casos, sem apontar o lado.
    if (aparece) expect(container.textContent).toContain('Quando o período ou o comparado começa antes disso');
  });

  it('com o comparado antes de setembro, Agendaram e Vieram saem sem base e os outros números têm variação', async () => {
    await montar('/acad/relatorios/conversao', { section: 'conversao' });
    // Setembro (3 agendaram, 1 veio) contra agosto (1 e 1) teria +200% e = 0%.
    expect(botao('Agendaram').textContent).toContain('sem base');
    expect(botao('Vieram').textContent).toContain('sem base');
    expect(botao('Agendaram').textContent).not.toContain('200%');
    expect(botao('Leads da safra').textContent).toContain('▲ 25%');
  });

  it('com a base dos dois lados, Agendaram e Vieram têm a variação de sempre', async () => {
    // Os dias 8 a 13 contra os dias 2 a 7, ambos depois da base: 1 agendou contra 2, e 0 vieram contra 1.
    await montar('/acad/relatorios/conversao?de=2026-09-08&ate=2026-09-13', { section: 'conversao' });
    expect(botao('Agendaram').textContent).toContain('▼ 50%');
    expect(botao('Vieram').textContent).toContain('▼ 100%');
    expect(botao('Agendaram').textContent).not.toContain('sem base');
    expect(botao('Vieram').textContent).not.toContain('sem base');
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
    // O título do relatório é h2, e os cartões abaixo dele são h3 (e não h4, que pulava um nível).
    expect(container.querySelectorAll('h4')).toHaveLength(0);
    expect(container.querySelectorAll('h3')).toHaveLength(3);

    // Cada recorte da Conversão já traz leads, matrículas e a barra da conversão ao lado do nome.
    await remontar('/acad/relatorios/conversao', { section: 'conversao' });
    expect(grade('Por origem').className).toContain('xl:grid-cols-2');
    expect(grade('Por origem').className).not.toMatch(/grid-cols-3/);
    expect(grade('Rapidez do primeiro contato')).toBe(grade('Por origem'));
    expect(container.querySelectorAll('h4')).toHaveLength(0);
  });
});

describe('lista que não quebra linha', () => {
  it('na Entrada, situação e etapa ficam numa linha, origem, consultor e funil cortam com o texto inteiro no title, e a data sai sem o ano', async () => {
    await montar('/acad/relatorios');
    expect(linhas()).toHaveLength(5);
    // O nome do lead não encolhe de 10rem, nem na linha nem no cabeçalho: com origem, consultor e funil de nome
    // comprido, ele ficava com uns 107px a 1280px e 42 de 50 nomes quebravam.
    expect(container.querySelector('thead th').className).toContain('min-w-[10rem]');
    for (const tr of linhas()) {
      expect(celula(tr, 'Nome').className, 'Nome').toContain('min-w-[10rem]');
      for (const coluna of ['Etapa', 'Situação']) expect(celula(tr, coluna).className, coluna).toContain('whitespace-nowrap');
      for (const coluna of ['Origem', 'Consultor', 'Funil']) {
        const texto = celula(tr, coluna).firstElementChild;
        expect(texto.className, coluna).toContain('truncate');
        expect(texto.className, coluna).toContain('max-w-[9rem]');
        expect(texto.getAttribute('title'), coluna).toBe(texto.textContent);
        expect(texto.textContent, coluna).not.toBe('');
      }
    }
    // O ano de agora não aparece na tela, e a planilha continua com ele.
    expect(celula(linhaDe('s4'), 'Cadastro').textContent).toBe('13/09');
    expect(celula(linhaDe('s1'), 'Cadastro').textContent).toBe('02/09');
    expect(container.querySelector('tbody').textContent).not.toContain('/2026');
    // O verde do texto pequeno é o das tabelas do painel.
    expect(celula(linhaDe('s1'), 'Situação').firstElementChild.className).toContain('text-emerald-700 dark:text-emerald-300');
  });

  it('na Conversão, o primeiro contato diz quanto levou e em que dia, e o desfecho diz o dia sem o ano', async () => {
    await montar('/acad/relatorios/conversao', { section: 'conversao' });
    expect(container.querySelector('thead th').className).toContain('min-w-[10rem]');
    for (const tr of linhas()) {
      expect(celula(tr, 'Nome').className, 'Nome').toContain('min-w-[10rem]');
      for (const coluna of ['Agend.', 'Veio', 'Desfecho', '1º contato', 'Cadastro']) expect(celula(tr, coluna).className, coluna).toContain('whitespace-nowrap');
      for (const coluna of ['Origem', 'Consultor']) {
        expect(celula(tr, coluna).firstElementChild.className, coluna).toContain('truncate');
        expect(celula(tr, coluna).firstElementChild.className, coluna).toContain('max-w-[9rem]');
      }
    }
    // s1 foi cadastrada em 02/09 às 10h e a primeira interação da equipe foi às 10h30.
    expect(celula(linhaDe('s1'), '1º contato').textContent).toBe('30 min · 02/09');
    expect(celula(linhaDe('s1'), 'Cadastro').textContent).toBe('02/09');
    expect(celula(linhaDe('s1'), 'Desfecho').textContent).toBe('Matriculou em 05/09');
    expect(celula(linhaDe('s1'), 'Desfecho').firstElementChild.className).toContain('text-emerald-700 dark:text-emerald-300');
    // Sem interação da equipe, o texto apagado de sempre.
    const semContato = celula(linhaDe('s4'), '1º contato').firstElementChild;
    expect([semContato.textContent, semContato.className]).toEqual(['Sem contato', 'text-muted-foreground']);
    expect(container.querySelector('tbody').textContent).not.toContain('/2026');
  });
});

describe('linha Outros', () => {
  it('quem saiu da equipe e o lead sem dono se chamam Outros, com a explicação em letra menor e o texto inteiro no title', async () => {
    await montar('/acad/relatorios');
    const linha = recorte('Outros');
    expect(linha.textContent).toContain('Outros');
    expect(linha.textContent).toContain('fora da equipe ou sem responsável');
    expect(linha.querySelector('[title]').getAttribute('title')).toBe('Outros, fora da equipe ou sem responsável');
    expect(container.textContent).not.toContain('Fora da equipe ou sem responsável');

    await clicar(linha);
    expect(sonda()).toBe('?recorte=consultor%3A__outros__');
    expect(limpar().parentElement.textContent).toContain('Consultor: Outros');
    expect(fichas()).toEqual(['s5']);
    // Na lista e na planilha, o responsável do lead continua com o texto explícito.
    expect(celula(linhaDe('s5'), 'Consultor').textContent).toBe('Fora da equipe');
    await clicar(botao('Exportar lista'));
    expect(m.download.mock.calls[0][1].split('\r\n')[1]).toContain('Fora da equipe');
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
    // A planilha leva a data inteira, e a lista, sem o ano.
    expect(csv).toContain('13/09/2026');
    expect(csv).toContain('02/09/2026');

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

  it('a Conversão baixa leads-conversao com as colunas dela', async () => {
    await montar('/acad/relatorios/conversao', { section: 'conversao' });
    await clicar(botao('Exportar lista'));
    const [arquivo, csv] = m.download.mock.calls[0];
    expect(arquivo).toBe('leads-conversao-2026-09-01-a-2026-09-14.csv');
    expect(csv.split('\r\n')[0]).toBe(CONVERSAO_COLUMNS.map((c) => c.label).join(';'));
    // A planilha da Conversão também leva a data inteira.
    expect(csv).toContain('05/09/2026');
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
    usar(fontesComMuitosLeads());
    await montar('/acad/relatorios');
    expect(linhas()).toHaveLength(50);
    await clicar(botao('Mostrar mais 50'));
    expect(linhas()).toHaveLength(100);
    const numero = numeroDaLista();
    expect(numero.textContent).toBe('120 leads');

    // Passa um minuto: o relógio da tela refaz o período e as contas, com objetos novos, e a lista
    // continua aberta, porque o listId vem do endereço e não do relógio nem dos dados.
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(linhas()).toHaveLength(100);
    expect(numeroDaLista()).toBe(numero);

    // Outro período: os 120 leads continuam na lista, e ela volta à primeira página.
    await clicar(gatilho('Período'));
    await clicar(opcaoDoPeriodo('Semana passada'));
    expect(sonda()).toBe('?periodo=semana-passada');
    expect(numeroDaLista().textContent).toBe('120 leads');
    expect(linhas()).toHaveLength(50);
    expect(numeroDaLista()).toBe(numero);

    // Outro recorte da lista: com o Mostrar mais aberto, os 70 do Instagram cabem todos, e a lista
    // que não fechasse mostraria 70 linhas. Fechada, são 50 e faltam 20.
    await clicar(botao('Mostrar mais 50'));
    expect(linhas()).toHaveLength(100);
    await clicar(recorte('Instagram'));
    expect(sonda()).toBe('?periodo=semana-passada&recorte=origem%3AInstagram');
    expect(numeroDaLista().textContent).toBe('70 leads');
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
