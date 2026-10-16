// @vitest-environment jsdom
// As peças do redesenho dos Relatórios (handoff em docs/superpowers/specs/
// handoff-relatorios/) em uso: o painel de números com as células que filtram,
// o gráfico por dia com a dica no foco do teclado, os recortes em abas, o selo
// de situação, a célula do nome e a lista vazia com os textos do handoff.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ReportBand, BandCell, DayBars, CutTabs, StatusPill, NameCell, ReportList, ReportNotice, DAY_BARS_MAX,
} from '../../views/relatorios/ReportParts.jsx';
import { FOCUS_RING } from '../../components/focusRing.js';
import { porDia } from '../relatorios/leads/porDia.js';
import { monthPeriod } from '../period.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root = null;
let container = null;
let avisos = [];
async function montar(el) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(el); });
}
const remontar = (el) => act(async () => { root.render(el); });
beforeEach(() => {
  avisos = [];
  vi.spyOn(console, 'error').mockImplementation((...args) => { avisos.push(args.map(String).join(' ')); });
  // A dica do Radix mede o gatilho, e o jsdom não tem ResizeObserver.
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  container = null;
  vi.restoreAllMocks();
  expect(avisos).toEqual([]);
});

const botao = (texto) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
const clicar = async (el) => { await act(async () => { el.click(); }); };
const tecla = async (el, key) => { await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); }); };
const comAnel = (el) => FOCUS_RING.split(/\s+/).every((c) => el.classList.contains(c));

describe('painel de números', () => {
  const celulas = (cut, onCut) => [
    { key: 'total', label: 'Leads da safra', value: 20, active: cut === null, onClick: () => onCut(null) },
    { key: 'agendaram', label: 'Agendaram', value: 9, arrow: true, active: cut === 'agendaram', onClick: () => onCut(cut === 'agendaram' ? null : 'agendaram') },
    { key: 'matricularam', label: 'Matricularam', value: 4, tone: 'emerald', arrow: true, delta: { up: true, text: '25%' }, active: false, onClick: () => {} },
    { key: 'perderam', label: 'Perderam', value: 3, rule: true, lowerBetter: true, delta: { up: true, text: '50%' }, active: false, onClick: () => {} },
    { key: 'aberto', label: 'Em aberto', value: 4, note: 'ainda no funil', active: false, onClick: () => {} },
  ];

  it('a célula filtra, a mesma célula de novo limpa, e a acesa leva a barra de cima e o fundo azul', async () => {
    const onCut = vi.fn();
    const painel = (cut) => h(ReportBand, { label: 'Conversão da safra', value: 20, percent: true, tone: 'emerald', sub: 'vs. setembro de 2026', cells: celulas(cut, onCut) });
    await montar(painel(null));
    expect(botao('Leads da safra').getAttribute('aria-pressed')).toBe('true');
    expect(botao('Agendaram').getAttribute('aria-pressed')).toBe('false');
    await clicar(botao('Agendaram'));
    expect(onCut).toHaveBeenLastCalledWith('agendaram');
    await remontar(painel('agendaram'));
    const acesa = botao('Agendaram');
    expect(acesa.getAttribute('aria-pressed')).toBe('true');
    expect(acesa.className).toContain('bg-brand-50');
    expect(acesa.firstElementChild.className).toContain('opacity-100');
    expect(botao('Leads da safra').firstElementChild.className).toContain('opacity-0');
    await clicar(acesa);
    expect(onCut).toHaveBeenLastCalledWith(null);
  });

  it('as células são botões de verdade, alcançados pelo Tab e com o anel do teclado', async () => {
    await montar(h(ReportBand, { label: 'x', value: 1, cells: celulas(null, () => {}) }));
    const botoes = [...container.querySelectorAll('button')];
    expect(botoes).toHaveLength(5);
    for (const b of botoes) {
      expect(b.getAttribute('type')).toBe('button');
      expect(b.tabIndex).toBe(0);
      expect(comAnel(b), b.textContent).toBe(true);
    }
    botoes[1].focus();
    expect(document.activeElement).toBe(botoes[1]);
  });

  it('seta entre as etapas, régua antes do que não é etapa, e as duas ficam fora do leitor de tela', async () => {
    await montar(h(ReportBand, { label: 'x', value: 1, cells: celulas(null, () => {}) }));
    const antes = (nome) => [...botao(nome).parentElement.children].slice(0, -1);
    expect(antes('Leads da safra')).toHaveLength(0);
    expect(antes('Agendaram')).toHaveLength(1);
    expect(antes('Agendaram')[0].querySelector('svg')).not.toBeNull();
    expect(antes('Perderam')).toHaveLength(1);
    expect(antes('Perderam')[0].className).toContain('w-px');
    for (const el of [...antes('Agendaram'), ...antes('Perderam')]) expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('a variação pinta pela regra do número: perder mais é vermelho, matricular mais é verde, e a nota fica sem pílula', async () => {
    await montar(h(ReportBand, { label: 'x', value: 1, cells: celulas(null, () => {}) }));
    const pilula = (nome) => [...botao(nome).querySelectorAll('span')].filter((s) => s.textContent.startsWith('▲')).at(-1);
    expect(pilula('Matricularam').className).toContain('bg-emerald-50');
    expect(pilula('Perderam').className).toContain('bg-rose-50');
    expect(pilula('Em aberto')).toBeUndefined();
    expect(botao('Em aberto').textContent).toContain('ainda no funil');
    // O número verde fica no passo 700.
    expect([...botao('Matricularam').querySelectorAll('span')].find((s) => s.textContent === '4').className).toContain('text-emerald-700');
  });

  it('o herói: rótulo, número, pílula e o comparado; sem base, apagado e sem pílula', async () => {
    await montar(h(ReportBand, { label: 'Perdas', value: 12, delta: { up: true, text: '20%' }, lowerBetter: true, sub: 'vs. setembro de 2026' }));
    expect(container.textContent).toContain('Perdas12▲ 20%vs. setembro de 2026');
    expect([...container.querySelectorAll('span')].find((s) => s.textContent === '▲ 20%').className).toContain('bg-rose-50');
    await remontar(h(ReportBand, { label: 'Conversão da safra', value: null, percent: true, tone: 'emerald', delta: { none: true, text: 'sem base' }, sub: 'vs. 14/10' }));
    expect(container.textContent.split('sem base')).toHaveLength(2);
    const numero = [...container.querySelectorAll('div')].find((d) => d.textContent === 'sem base');
    expect(numero.className).toContain('text-muted-foreground');
    expect(numero.className).not.toContain('text-emerald');
    expect(container.textContent).toContain('vs. 14/10');
  });

  it('sem células nem gráfico, ou com o gráfico de um dia só, o herói ocupa a largura', async () => {
    const heroi = () => container.querySelector('section').firstElementChild;
    await montar(h(ReportBand, { label: 'Leads novos', value: 3 }));
    expect(heroi().className).not.toContain('md:w-[236px]');
    expect(container.querySelector('section').children).toHaveLength(1);
    const now = new Date(2026, 9, 15, 10);
    const umDia = porDia([], { start: new Date(2026, 9, 15), fullEnd: new Date(2026, 9, 16) }, () => null, now);
    await remontar(h(ReportBand, { label: 'Leads novos', value: 3, chart: { days: umDia, label: 'Por dia de cadastro' } }));
    expect(container.querySelector('section').children).toHaveLength(1);
    const mes = porDia([], monthPeriod('2026-10', now), () => null, now);
    await remontar(h(ReportBand, { label: 'Leads novos', value: 3, chart: { days: mes, label: 'Por dia de cadastro' } }));
    expect(heroi().className).toContain('md:w-[236px]');
    expect(container.querySelector('[role="group"]').getAttribute('aria-label')).toBe('Por dia de cadastro');
    // Personalizado longo: acima de dois meses de colunas o gráfico sai e o herói fica sozinho.
    const dias = (n) => Array.from({ length: n }, (_, i) => ({ key: `d${i}`, date: new Date(2026, 0, 1 + i), count: 1, today: false }));
    await remontar(h(ReportBand, { label: 'Leads novos', value: 3, chart: { days: dias(DAY_BARS_MAX), label: 'Por dia de cadastro' } }));
    expect(container.querySelector('[role="group"]')).not.toBeNull();
    await remontar(h(ReportBand, { label: 'Leads novos', value: 3, chart: { days: dias(DAY_BARS_MAX + 1), label: 'Por dia de cadastro' } }));
    expect(container.querySelector('section').children).toHaveLength(1);
    expect(heroi().className).not.toContain('md:w-[236px]');
  });
});

describe('gráfico por dia', () => {
  const now = new Date(2026, 9, 15, 14, 30);
  const rows = [
    { when: new Date(2026, 9, 2, 9) }, { when: new Date(2026, 9, 2, 18) }, { when: new Date(2026, 9, 2, 20) },
    { when: new Date(2026, 9, 6, 9) }, { when: new Date(2026, 9, 15, 8) },
  ];
  const days = porDia(rows, monthPeriod('2026-10', now), (r) => r.when, now);
  const barras = () => [...container.querySelectorAll('[role="group"] > [role="img"]')];

  it('uma barra por dia, o pico, o primeiro dia e "hoje" no último, e a soma das barras é o total', async () => {
    await montar(h(DayBars, { days, label: 'Por dia de cadastro', unit: ['lead', 'leads'] }));
    expect(barras()).toHaveLength(15);
    expect(container.textContent).toContain('pico de 3 em 02/10');
    expect(container.textContent).toContain('01/10');
    expect(container.textContent).toContain('hoje, 15/10');
    expect(days.reduce((s, d) => s + d.count, 0)).toBe(rows.length);
    expect(barras()[1].getAttribute('aria-label')).toBe('02/10: 3 leads');
    expect(barras()[5].getAttribute('aria-label')).toBe('06/10: 1 lead');
    expect(barras()[14].getAttribute('aria-label')).toBe('15/10, em andamento: 1 lead até agora');
    // A legenda das listras de hoje fica na linha do título, junto do pico.
    expect(container.textContent).toContain('hoje, em andamento');
    expect(container.querySelector('i[aria-hidden="true"]').className).toContain('repeating-linear-gradient');
  });

  it('o dia zerado fica no tom mais claro, todo dia no mesmo azul, hoje listrado, e o mais alto tem 72px', async () => {
    await montar(h(DayBars, { days, label: 'Por dia de cadastro' }));
    const fill = (i) => barras()[i].firstElementChild;
    expect(fill(0).className).toContain('bg-muted');
    expect(fill(0).style.height).toBe('3px');
    expect(fill(1).style.height).toBe('72px');
    expect(fill(1).className).toContain('bg-brand-600');
    // 04/10 é domingo: o fim de semana não tem mais tom próprio.
    const domingo = porDia([{ when: new Date(2026, 9, 4, 9) }], monthPeriod('2026-10', now), (r) => r.when, now);
    await remontar(h(DayBars, { days: domingo, label: 'Por dia de cadastro' }));
    expect(fill(3).className).toContain('bg-brand-600');
    await remontar(h(DayBars, { days, label: 'Por dia de cadastro' }));
    expect(fill(14).className).toContain('bg-[repeating-linear-gradient(135deg,var(--color-brand-600)');
    expect(fill(14).className).toContain('dark:bg-brand-500/20');
    expect(fill(1).className).not.toContain('repeating-linear-gradient');
    expect(fill(1).className).toContain('motion-reduce:transition-none');
  });

  it('hoje zerado fica no toco claro, sem listras e sem a legenda', async () => {
    const semHoje = porDia(rows.filter((r) => r.when.getDate() !== 15), monthPeriod('2026-10', now), (r) => r.when, now);
    await montar(h(DayBars, { days: semHoje, label: 'Por dia de cadastro' }));
    expect(barras()[14].firstElementChild.className).toContain('bg-muted');
    expect(barras()[14].getAttribute('aria-label')).toBe('15/10, em andamento: 0 leads até agora');
    expect(container.textContent).not.toContain('em andamento');
  });

  it('cada barra recebe o foco do teclado, com o anel, e a dica aparece no foco', async () => {
    await montar(h(DayBars, { days, label: 'Por dia de cadastro' }));
    const barra = barras()[1];
    expect(barra.tabIndex).toBe(0);
    expect(comAnel(barra)).toBe(true);
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    await act(async () => { barra.focus(); });
    expect(document.activeElement).toBe(barra);
    expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('02/10: 3 leads');
  });

  it('mês fechado termina na data, sem "hoje", e o mês sem nada não diz pico', async () => {
    const setembro = porDia([], monthPeriod('2026-09', now), () => null, now);
    await montar(h(DayBars, { days: setembro, label: 'Por dia da perda', unit: ['perda', 'perdas'] }));
    expect(container.textContent).toContain('30/09');
    expect(container.textContent).not.toContain('hoje');
    expect(container.textContent).not.toContain('pico');
    expect(barras()[0].getAttribute('aria-label')).toBe('01/09: 0 perdas');
  });
});

describe('recortes em abas', () => {
  const tabs = [
    {
      value: 'origem', label: 'Por origem',
      rows: [
        { key: 'origem:Instagram', name: 'Instagram', channel: 'redes sociais', count: 6 },
        { key: 'origem:Indicação', name: 'Indicação', count: 2 },
      ],
    },
    { value: 'consultor', label: 'Por consultor', rows: [] },
    {
      value: 'professor', label: 'Por professor', kind: 'conv', countLabel: 'Aulas', countNoun: ['aula', 'aulas'],
      hint: 'só aulas experimentais · quantos matricularam depois da aula',
      rows: [
        { key: 'prof:bia', name: 'Bianca Alves', channel: 'Funcional', leads: 5, enrolled: 2, conv: 40 },
        { key: 'prof:sozinho', name: 'Treinou sozinho', channel: 'sem professor', leads: 1, enrolled: 0, conv: null },
      ],
    },
  ];
  const abas = () => [...container.querySelectorAll('[role="tab"]')];
  const recortes = (props) => h(CutTabs, { tabs, value: 'origem', onValueChange: () => {}, activeRow: null, onRow: () => {}, ...props });

  it('mostra a aba aberta, a dica, a barra com o número ao lado e a fatia', async () => {
    await montar(recortes());
    expect(abas().map((t) => t.textContent)).toEqual(['Por origem', 'Por consultor', 'Por professor']);
    expect(abas()[0].getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('[role="tablist"]').getAttribute('aria-label')).toBe('Recortes');
    expect(container.textContent).toContain('Clique numa linha para filtrar a lista');
    const insta = botao('Instagram');
    expect(insta.getAttribute('aria-label')).toBe('Instagram (redes sociais): 6 de 8, 75%');
    expect(insta.textContent).toContain('6');
    expect(insta.textContent).toContain('75%');
    expect(insta.querySelector('[aria-hidden="true"] > span').style.width).toBe('100%');
    expect(botao('Indicação').querySelector('[aria-hidden="true"] > span').style.width).toBe('33.33333333333333%');
  });

  it('a linha filtra, a acesa de novo limpa, e a acesa é a única com aria-pressed', async () => {
    const onRow = vi.fn();
    await montar(recortes({ onRow }));
    await clicar(botao('Instagram'));
    expect(onRow).toHaveBeenLastCalledWith('origem:Instagram');
    await remontar(recortes({ onRow, activeRow: 'origem:Instagram' }));
    expect(container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
    expect(botao('Instagram').getAttribute('aria-pressed')).toBe('true');
    await clicar(botao('Instagram'));
    expect(onRow).toHaveBeenLastCalledWith(null);
    await clicar(botao('Indicação'));
    expect(onRow).toHaveBeenLastCalledWith('origem:Indicação');
  });

  it('a aba troca pelo clique e pelas setas do teclado, e quem guarda a aba é a seção', async () => {
    const onValueChange = vi.fn();
    await montar(recortes({ onValueChange }));
    // O Radix ativa a aba no mousedown, e não no click.
    await act(async () => { abas()[2].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })); });
    expect(onValueChange).toHaveBeenLastCalledWith('professor');
    // Controlada: sem a seção devolver o valor, a aba aberta continua a mesma.
    expect(abas()[0].getAttribute('aria-selected')).toBe('true');
    await act(async () => { abas()[0].focus(); });
    await tecla(abas()[0], 'ArrowRight');
    // O Radix move o foco das setas num setTimeout.
    await act(async () => { await new Promise((r) => { setTimeout(r, 0); }); });
    expect(document.activeElement).toBe(abas()[1]);
    expect(onValueChange).toHaveBeenLastCalledWith('consultor');
    for (const aba of abas()) expect(comAnel(aba)).toBe(true);
  });

  it('aba de conversão: cabeçalho "Aulas", leitura com aulas, matrícula verde e traço sem conversão', async () => {
    await montar(recortes({ value: 'professor' }));
    expect(container.textContent).toContain('só aulas experimentais · quantos matricularam depois da aula · clique numa linha para filtrar a lista');
    const cabecalho = container.querySelector('[role="tabpanel"] > div[aria-hidden="true"]');
    expect([...cabecalho.children].map((c) => c.textContent)).toEqual(['', 'Aulas', 'Matr.', 'Conversão', '']);
    expect(cabecalho.className).toContain('text-[11px]');
    expect(cabecalho.className).not.toMatch(/uppercase|tracking-/);
    expect(botao('Bianca Alves').getAttribute('aria-label')).toBe('Bianca Alves (Funcional): 5 aulas, 2 matrículas, 40% de conversão');
    expect(botao('Treinou sozinho').getAttribute('aria-label')).toBe('Treinou sozinho (sem professor): 1 aula, 0 matrículas, sem conversão');
    const span = (b, t) => [...b.querySelectorAll('span')].find((s) => s.textContent === t);
    expect(span(botao('Bianca Alves'), '40%').className).toContain('text-emerald-700');
    expect(span(botao('Treinou sozinho'), '—').className).toContain('text-muted-foreground');
    expect(botao('Bianca Alves').querySelector('.bg-emerald-500').style.width).toBe('40%');
  });

  it('aba sem linhas diz que não há nada, e aba que sumiu abre a primeira', async () => {
    await montar(recortes({ value: 'consultor' }));
    expect(container.querySelector('[role="tabpanel"][data-state="active"]').textContent).toBe('Nada no período.');
    await remontar(recortes({ value: 'unidade' }));
    expect(abas()[0].getAttribute('aria-selected')).toBe('true');
    expect(botao('Instagram')).toBeDefined();
  });

  it('cada linha leva o anel do teclado e o nome inteiro no title', async () => {
    await montar(recortes());
    for (const b of container.querySelectorAll('[role="tabpanel"] button')) expect(comAnel(b)).toBe(true);
    expect(botao('Instagram').querySelector('[title]').getAttribute('title')).toBe('Instagram');
  });
});

describe('selo, nome, aviso e lista vazia', () => {
  it('o selo leva o texto escrito, com o ponto só de enfeite', async () => {
    await montar(h(StatusPill, { tone: 'emerald' }, 'Matriculou em 02/09'));
    const selo = container.firstElementChild;
    expect(selo.textContent).toBe('Matriculou em 02/09');
    expect(selo.className).toContain('text-emerald-700');
    expect(selo.firstElementChild.getAttribute('aria-hidden')).toBe('true');
    await remontar(h(StatusPill, { tone: 'rose' }, 'Perdido'));
    expect(container.firstElementChild.className).toContain('text-rose-700');
  });

  it('a célula do nome mostra as iniciais escondidas do leitor de tela e o nome inteiro no title', async () => {
    await montar(h(NameCell, { id: 'l1', name: 'Camila Ferraz Lemos' }));
    const celula = container.firstElementChild;
    expect(celula.getAttribute('title')).toBe('Camila Ferraz Lemos');
    expect(celula.firstElementChild.textContent).toBe('CL');
    expect(celula.firstElementChild.getAttribute('aria-hidden')).toBe('true');
    expect(celula.textContent).toBe('CLCamila Ferraz Lemos');
  });

  it('o aviso âmbar traz o texto, com o ícone de enfeite', async () => {
    await montar(h(ReportNotice, null, 'A etapa da perda só é registrada desde 14/09/2026.'));
    const aviso = container.firstElementChild;
    expect(aviso.textContent).toBe('A etapa da perda só é registrada desde 14/09/2026.');
    expect(aviso.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
  });

  it('a lista vazia usa os textos do handoff, com e sem filtro, e Leads parados passa o seu', async () => {
    const lista = (props) => h(ReportList, { total: 0, noun: 'leads', columns: [], rows: [], onClearCut: () => {}, ...props });
    await montar(lista({}));
    expect(container.textContent).toContain('Nada neste período.');
    expect(container.textContent).toContain('Escolha outro período ou limpe os filtros da barra.');
    expect(container.querySelector('.border-dashed')).not.toBeNull();
    await remontar(lista({ cutLabel: 'Matricularam' }));
    expect(container.textContent).toContain('Ninguém neste filtro.');
    expect(container.textContent).toContain('Limpe o filtro da lista para ver todos.');
    await remontar(lista({ emptyTitle: 'Nenhum lead parado.' }));
    expect(container.textContent).toContain('Nenhum lead parado.');
  });

  it('a lista diz quantos estão na tela, e as colunas ficam em caixa normal sobre o fundo apagado', async () => {
    const columns = [{ key: 'nome', label: 'Nome', render: (r) => r.name }];
    const rows = Array.from({ length: 60 }, (_, i) => ({ id: `l${i}`, name: `Lead ${i}` }));
    await montar(h(ReportList, { listId: 'a', total: 60, noun: 'leads', columns, rows }));
    expect(container.textContent).toContain('mostrando 50 de 60');
    expect(container.querySelector('thead tr').className).toContain('bg-muted/50');
    const th = container.querySelector('th');
    expect(th.textContent).toBe('Nome');
    expect(th.className).toContain('text-[11px]');
    expect(th.className).toContain('font-semibold');
    expect(th.className).toContain('text-muted-foreground');
    expect(th.className).not.toMatch(/uppercase|tracking-/);
    expect(container.querySelector('td').className).toContain('h-[46px]');
    await remontar(h(ReportList, { listId: 'a', total: 3, noun: 'leads', columns, rows: rows.slice(0, 3) }));
    expect(container.textContent).toContain('todos na tela');
  });
});

describe('BandCell sozinha', () => {
  it('funciona fora do painel, com o title da explicação', async () => {
    const onClick = vi.fn();
    await montar(h(BandCell, { label: 'Marcados', value: 1280, title: 'Visitas e aulas do período', onClick }));
    const b = container.querySelector('button');
    expect(b.textContent).toContain('1.280');
    expect(b.getAttribute('title')).toBe('Visitas e aulas do período');
    expect(b.getAttribute('aria-pressed')).toBe('false');
    await clicar(b);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
