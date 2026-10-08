// @vitest-environment jsdom
// A aba Hoje da tela Rotinas (spec 2026-10-06, "Aba Hoje"; mockup
// 2026-10-08-rotinas-aba-hoje.html, Hoje A, sem a linha do dia no cartão de
// cada pessoa). Os dados são os do mockup, às 10:47 de uma terça: a Ana e o
// Bruno seguem o Consultor manhã, a Carla o Consultor tarde, e o Diego está sem
// modelo. Os checks chegam por um useTeamRoutineMarks falso.
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const s = vi.hoisted(() => ({ marks: new Map(), loading: false, error: false, args: null }));
vi.mock('../../hooks/useTeamRoutineMarks.js', () => ({
  useTeamRoutineMarks: (args) => {
    s.args = args;
    return { marks: s.marks, loading: s.loading, error: s.error };
  },
}));

const { TodayTab } = await import('../../components/rotinas/TodayTab.jsx');

const DB = {};
const at = (hhmm, day = 6) => { const [hh, mm] = hhmm.split(':').map(Number); return new Date(2026, 9, day, hh, mm); };
const NOW = at('10:47');
const t = (id, time, title) => ({ id, title, how: '', days: 'all', time, active: true });
const MANHA = {
  id: 'manha',
  name: 'Consultor manhã',
  followerIds: ['ana', 'bruno'],
  tasks: [
    t('t1', '06:00', 'Abrir a recepção'),
    t('t2', '06:30', 'Conferir a agenda de aulas'),
    t('t3', '07:00', 'Montar a lista de contatos do dia'),
    t('t4', '07:30', 'Responder os follow-ups'),
    t('t5', '10:00', 'Ligações para leads novos'),
    t('t6', '10:30', 'Conferir as visitas da tarde'),
    t('t7', '11:00', 'Intervalo'),
    t('t8', '12:00', 'Contato com inativos'),
    t('t9', '13:00', 'Renovações do mês'),
    t('t10', null, 'Pedir indicações'),
    t('t11', null, 'Postar o story da aula'),
  ],
};
const TARDE = {
  id: 'tarde',
  name: 'Consultor tarde',
  followerIds: ['carla'],
  tasks: [
    t('u1', '13:00', 'Conferir a agenda da tarde'),
    t('u2', '14:00', 'Ligações para leads novos'),
    t('u3', '16:00', 'Follow-ups da tarde'),
    t('u4', '18:00', 'Receber as visitas'),
    t('u5', '20:30', 'Resumo do dia no grupo'),
    t('u6', null, 'Atualizar o Stronilead'),
  ],
};
// Na ordem da equipe, com o Diego antes: quem está sem modelo vai para o fim.
const PEOPLE = [
  { id: 'diego', name: 'Diego Rocha' },
  { id: 'ana', name: 'Ana Souza' },
  { id: 'bruno', name: 'Bruno Lima' },
  { id: 'carla', name: 'Carla Dias' },
];
const check = (hhmm, note = '', day = 6) => ({ id: `c-${hhmm}`, doneAt: at(hhmm, day), note });
const MARKS = () => new Map([
  ['ana', new Map([
    ['t1', check('06:04')], ['t2', check('06:41')], ['t3', check('07:58', 'Lista com 42 leads, começando pelos parados.')],
    ['t4', check('08:20')], ['t10', check('09:15', 'Pedi para 3 alunos da turma das 7h.')],
  ])],
  ['bruno', new Map([
    ['t1', check('06:02')], ['t2', check('06:33')], ['t3', check('07:05')], ['t4', check('07:40')], ['t5', check('10:12')], ['t11', check('09:30')],
  ])],
]);

let container;
let root;
let onChooseModel;
beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  s.marks = MARKS();
  s.loading = false;
  s.error = false;
  s.args = null;
  onChooseModel = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

const render = async (props = {}) => {
  await act(async () => {
    root.render(h(MemoryRouter, null, h(TodayTab, {
      db: DB,
      people: PEOPLE,
      models: [MANHA, TARDE],
      modelsLoading: false,
      tenantId: 'acad',
      listenersActive: true,
      modelLink: (id) => ({ to: `/acad/rotinas/modelos/${id}`, state: { fromList: true } }),
      onChooseModel,
      ...props,
    })));
  });
};
const card = (name) => container.querySelector(`section[aria-label="${name}"]`);
const rowOf = (section, title) => [...section.querySelectorAll('button')].find((b) => b.textContent.includes(title));
const side = (title) => [...container.querySelectorAll('h2')].find((el) => el.textContent.startsWith(title))?.closest('section');
const detalhe = () => container.querySelector('[aria-label="Detalhe da tarefa"]');
const click = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.click(); });
};

describe('a leitura', () => {
  it('lê os checks de hoje da academia, presa ao portão de ociosidade', async () => {
    await render();
    expect(s.args).toEqual({ db: DB, enabled: true, tenantId: 'acad', dayKey: '2026-10-06' });
    await render({ listenersActive: false });
    expect(s.args.enabled).toBe(false);
  });

  it('carregando os modelos ou os checks, e a falha', async () => {
    await render({ modelsLoading: true });
    expect(container.textContent).toBe('Carregando a rotina de hoje…');
    s.loading = true;
    await render();
    expect(container.textContent).toBe('Carregando a rotina de hoje…');
    s.loading = false;
    s.error = true;
    await render();
    expect(container.textContent).toBe('Não deu para carregar os checks de hoje. Recarregue a página.');
  });
});

describe('o topo', () => {
  it('a conta da equipe, com o destaque, e o Ao vivo', async () => {
    await render();
    const titulo = container.querySelector('h1');
    expect(titulo.textContent).toBe('A equipe fez 11 de 28 tarefas da rotina até agora, e 1 está atrasada.');
    expect([...titulo.querySelectorAll('em')].map((em) => em.textContent)).toEqual(['11 de 28', '1 está atrasada']);
    expect(container.textContent).toContain('Ao vivo · 10:47');
  });

  it('o relógio anda sozinho a cada minuto', async () => {
    vi.useFakeTimers({ now: NOW });
    await render();
    await act(async () => { vi.advanceTimersByTime(60_100); });
    expect(container.textContent).toContain('Ao vivo · 10:48');
    expect(container.querySelector('[data-relogio]').getAttribute('data-relogio')).toBe('ao-vivo');
  });
});

describe('o cartão de cada consultor', () => {
  it('um por pessoa, na ordem da equipe, e quem está sem modelo no fim', async () => {
    await render();
    const nomes = [...container.querySelectorAll('section[aria-label]')].map((el) => el.getAttribute('aria-label'));
    expect(nomes.filter((n) => PEOPLE.some((p) => p.name === n))).toEqual(['Ana Souza', 'Bruno Lima', 'Carla Dias', 'Diego Rocha']);
  });

  it('o modelo é um link para o modelo aberto, e a contagem diz o que está atrasado', async () => {
    await render();
    const ana = card('Ana Souza');
    const link = ana.querySelector('a');
    expect(link.textContent).toBe('Consultor manhã');
    expect(link.getAttribute('href')).toBe('/acad/rotinas/modelos/manha');
    expect(ana.textContent).toContain('5 de 11');
    expect(ana.textContent).toContain('1 atrasada');
    expect(card('Bruno Lima').textContent).toContain('6 de 11');
    expect(card('Bruno Lima').textContent).toContain('nada atrasado');
  });

  it('cada tarefa com o horário, o texto do estado e a observação', async () => {
    await render();
    const ana = card('Ana Souza');
    expect(rowOf(ana, 'Abrir a recepção').textContent).toBe('06:00Abrir a recepçãoFeita às 06:04');
    expect(rowOf(ana, 'Montar a lista de contatos do dia').textContent)
      .toBe('07:00Montar a lista de contatos do diaFeita às 07:58, depois do horário · com observação');
    expect(rowOf(ana, 'Ligações para leads novos').textContent).toBe('10:00Ligações para leads novosEra às 10:00, atrasada há 47 min');
    expect(rowOf(ana, 'Conferir as visitas da tarde').textContent).toBe('10:30Conferir as visitas da tardeÉ agora');
    expect(rowOf(ana, 'Intervalo').textContent).toBe('11:00IntervaloEm 13 min');
    expect(rowOf(ana, 'Postar o story da aula').textContent).toBe('Postar o story da aulaAté o fim do dia');
    expect(ana.textContent).toContain('A qualquer hora');
  });

  it('a linha do agora entra antes da primeira tarefa que ainda não chegou', async () => {
    await render();
    const ana = card('Ana Souza');
    expect(ana.querySelectorAll('[data-agora]')).toHaveLength(1);
    const agora = ana.querySelector('[data-agora]');
    expect(agora.textContent).toBe('10:47');
    expect(agora.previousElementSibling.textContent).toContain('Conferir as visitas da tarde');
    expect(agora.nextElementSibling.textContent).toContain('Intervalo');
  });

  it('o cartão não tem a linha do dia: só o cabeçalho e a lista', async () => {
    await render();
    const ana = card('Ana Souza');
    expect([...ana.children].map((el) => el.tagName)).toEqual(['DIV', 'DIV']);
    expect(ana.querySelector('[style*="left"]')).toBeNull();
  });

  it('antes da rotina começar, e sem nada feito, só diz quando ela começa', async () => {
    await render();
    const carla = card('Carla Dias');
    expect(carla.textContent).toContain('0 de 6');
    expect(carla.textContent).toContain('A rotina começa às 13:00. 6 tarefas hoje.');
    expect(carla.querySelectorAll('button')).toHaveLength(0);
  });

  it('quem está sem modelo: o aviso e o Escolher modelo, que leva à aba Modelos', async () => {
    await render();
    const diego = card('Diego Rocha');
    expect(diego.textContent).toContain('Sem modelo');
    expect(diego.textContent).toContain('A Meta diária não mostra rotina para essa pessoa.');
    expect(diego.querySelector('a')).toBeNull();
    await click([...diego.querySelectorAll('button')].find((b) => b.textContent === 'Escolher modelo'));
    expect(onChooseModel).toHaveBeenCalledTimes(1);
    expect(onChooseModel).toHaveBeenCalledWith(expect.objectContaining({ id: 'diego', name: 'Diego Rocha' }));
  });

  it('o check de outro dia não conta', async () => {
    s.marks.get('bruno').set('t11', check('09:30', '', 5));
    await render();
    expect(card('Bruno Lima').textContent).toContain('5 de 11');
  });

  it('modelo sem tarefa hoje', async () => {
    vi.useFakeTimers({ now: at('10:47', 10), toFake: ['Date'] });
    await render();
    expect(card('Ana Souza').textContent).toContain('Nenhuma tarefa hoje neste modelo.');
    expect(card('Ana Souza').textContent).not.toContain(' de ');
  });
});

describe('o gestor só acompanha', () => {
  it('nenhum botão de check, e as tarefas são botões de mostrar o detalhe', async () => {
    await render();
    expect(container.querySelector('[aria-label^="Feita:"]')).toBeNull();
    const botoes = [...card('Ana Souza').querySelectorAll('button')];
    expect(botoes).toHaveLength(11);
    expect(botoes.every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true);
  });

  it('tocar numa tarefa mostra o detalhe no topo da lateral, e Fechar ou tocar de novo fecha', async () => {
    await render();
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
    await click(rowOf(card('Ana Souza'), 'Montar a lista de contatos do dia'));
    expect(rowOf(card('Ana Souza'), 'Montar a lista de contatos do dia').getAttribute('aria-pressed')).toBe('true');
    expect(detalhe().textContent).toContain('Detalhe');
    expect(detalhe().textContent).toContain('Ana Souza');
    expect(detalhe().textContent).toContain('07:00 · Montar a lista de contatos do dia');
    expect(detalhe().textContent).toContain('Feita às 07:58, depois do horário');
    expect(detalhe().textContent).toContain('Lista com 42 leads, começando pelos parados.');
    await click([...detalhe().querySelectorAll('button')].find((b) => b.textContent === 'Fechar'));
    expect(detalhe()).toBeNull();
    await click(rowOf(card('Ana Souza'), 'Intervalo'));
    expect(detalhe().textContent).toContain('Em 13 min');
    await click(rowOf(card('Ana Souza'), 'Intervalo'));
    expect(detalhe()).toBeNull();
  });
});

describe('a lateral', () => {
  it('Atrasadas agora, com quem, qual tarefa e há quanto tempo', async () => {
    await render();
    const atrasadas = side('Atrasadas agora');
    expect(atrasadas.querySelector('h2').textContent).toBe('Atrasadas agora 1');
    expect(atrasadas.textContent).toContain('Ana · Ligações para leads novos');
    expect(atrasadas.textContent).toContain('Era às 10:00, há 47 min');
  });

  it('Observações de hoje, a mais recente primeiro', async () => {
    await render();
    const notas = side('Observações de hoje');
    expect(notas.querySelector('h2').textContent).toBe('Observações de hoje 2');
    const texto = notas.textContent;
    expect(texto).toContain('Ana · Pedir indicações');
    expect(texto).toContain('Pedi para 3 alunos da turma das 7h.');
    expect(texto.indexOf('Às 09:15')).toBeLessThan(texto.indexOf('Às 07:58'));
  });

  it('sem atrasadas e sem observações', async () => {
    vi.useFakeTimers({ now: at('06:10'), toFake: ['Date'] });
    s.marks = new Map();
    await render();
    expect(container.querySelector('h1').textContent).toBe('A equipe fez 0 de 28 tarefas da rotina até agora. Nenhuma está atrasada.');
    expect(side('Atrasadas agora').textContent).toContain('Ninguém com tarefa atrasada.');
    expect(side('Observações de hoje').textContent).toContain('Nenhuma observação até agora.');
  });
});

describe('os casos sem conta', () => {
  it('sem consultor na equipe', async () => {
    await render({ people: [] });
    expect(container.querySelector('h1').textContent).toBe('Nenhum consultor na equipe ainda.');
    expect(container.textContent).toContain('Cadastre os consultores em Configurações, em Equipe & acessos, e escolha o modelo de cada um na aba Modelos.');
    expect(container.querySelector('section')).toBeNull();
  });

  it('ninguém segue um modelo', async () => {
    await render({ models: [{ ...MANHA, followerIds: [] }, { ...TARDE, followerIds: [] }] });
    expect(container.querySelector('h1').textContent).toBe('Ninguém segue um modelo ainda.');
    expect([...container.querySelectorAll('button')].filter((b) => b.textContent === 'Escolher modelo')).toHaveLength(4);
  });

  it('ninguém tem tarefa hoje', async () => {
    vi.useFakeTimers({ now: at('10:47', 10), toFake: ['Date'] });
    await render();
    expect(container.querySelector('h1').textContent).toBe('Hoje não tem tarefa da rotina para a equipe.');
  });
});

describe('o detalhe e o foco', () => {
  const abrirAna = (titulo) => click(rowOf(card('Ana Souza'), titulo));

  it('cada tarefa tem um id estável, e Fechar devolve o foco à tarefa que estava aberta', async () => {
    await render();
    const linha = () => rowOf(card('Ana Souza'), 'Montar a lista de contatos do dia');
    expect(linha().id).toBe('rot-ana-t3');
    expect(rowOf(card('Bruno Lima'), 'Abrir a recepção').id).toBe('rot-bruno-t1');
    await abrirAna('Montar a lista de contatos do dia');
    const fechar = [...detalhe().querySelectorAll('button')].find((b) => b.textContent === 'Fechar');
    await act(async () => { fechar.focus(); });
    expect(document.activeElement).toBe(fechar);
    await click(fechar);
    expect(detalhe()).toBeNull();
    expect(document.activeElement).toBe(linha());
  });

  it('o anúncio do detalhe vem de uma região escondida que só muda quando a escolha muda', async () => {
    vi.useFakeTimers({ now: NOW });
    await render();
    const regiao = () => container.querySelector('[aria-live="polite"]');
    expect(container.querySelectorAll('[aria-live]')).toHaveLength(1);
    expect(regiao().className.split(/\s+/)).toContain('sr-only');
    expect(regiao().textContent).toBe('');
    await abrirAna('Ligações para leads novos');
    expect(regiao().textContent).toBe('Detalhe: Ana, Ligações para leads novos');
    // O detalhe que se vê não é região viva: o "atrasada há N min" não é relido a cada minuto.
    expect(detalhe().closest('[aria-live]')).toBeNull();
    expect(detalhe().textContent).toContain('Era às 10:00, atrasada há 47 min');
    await act(async () => { vi.advanceTimersByTime(61_000); });
    expect(detalhe().textContent).toContain('Era às 10:00, atrasada há 48 min');
    expect(regiao().textContent).toBe('Detalhe: Ana, Ligações para leads novos');
    await abrirAna('Intervalo');
    expect(regiao().textContent).toBe('Detalhe: Ana, Intervalo');
    await click([...detalhe().querySelectorAll('button')].find((b) => b.textContent === 'Fechar'));
    expect(regiao().textContent).toBe('');
  });
});

describe('Fechar com a linha da tarefa fora da tela', () => {
  it('sem a linha, o foco vai para o cartão da pessoa e não cai no body', async () => {
    // A Carla fez a tarefa sem horário, então o cartão dela mostra a lista.
    s.marks.set('carla', new Map([['u6', check('09:00')]]));
    await render();
    const linha = rowOf(card('Carla Dias'), 'Atualizar o Stronilead');
    expect(linha).toBeTruthy();
    await click(linha);
    expect(detalhe().textContent).toContain('Carla Dias');
    // O check some (o consultor desfez): antes da primeira tarefa e sem nada
    // feito, o cartão só diz quando a rotina começa, e a lista sai da tela. O
    // detalhe continua aberto.
    s.marks.delete('carla');
    await render();
    expect(card('Carla Dias').textContent).toContain('A rotina começa às 13:00');
    expect(card('Carla Dias').querySelectorAll('button')).toHaveLength(0);
    expect(document.getElementById('rot-carla-u6')).toBeNull();
    expect(detalhe()).not.toBeNull();
    const fechar = [...detalhe().querySelectorAll('button')].find((b) => b.textContent === 'Fechar');
    await act(async () => { fechar.focus(); });
    await click(fechar);
    expect(detalhe()).toBeNull();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(card('Carla Dias'));
    expect(card('Carla Dias').getAttribute('tabindex')).toBe('-1');
    expect(card('Carla Dias').id).toBe('rotcartao-carla');
  });
});

describe('a lateral não passa da tela', () => {
  it('fica fixa no topo e rola por dentro, para uma lista longa não esconder as observações', async () => {
    await render();
    const classes = container.querySelector('aside').className.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(['lg:sticky', 'lg:top-4', 'lg:max-h-[calc(100dvh-6rem)]', 'lg:overflow-y-auto', 'overscroll-y-contain']));
  });
});

describe('dados parados pelo portão de ociosidade', () => {
  const titulo = () => container.querySelector('h1').textContent;
  const relogio = () => container.querySelector('[data-relogio]');
  const anaTexto = (t) => rowOf(card('Ana Souza'), t).textContent;

  it('sem assinatura, o instante fica parado: o rótulo muda e nenhuma tarefa vira atrasada sozinha', async () => {
    vi.useFakeTimers({ now: NOW });
    await render();
    expect(relogio().textContent).toBe('Ao vivo · 10:47');
    const aoVivo = titulo();

    await render({ listenersActive: false });
    expect(s.args.enabled).toBe(false);
    expect(relogio().getAttribute('data-relogio')).toBe('parado');
    expect(relogio().textContent).toBe('Atualizado às 10:47 · mexa na tela para atualizar');
    expect(relogio().textContent).not.toContain('Ao vivo');
    // O ponto verde de "ao vivo" dá lugar a um neutro.
    expect(relogio().querySelector('[aria-hidden="true"]').className).not.toContain('emerald');

    // Passam 30 minutos com o relógio andando e sem checks novos chegando.
    await act(async () => { vi.advanceTimersByTime(30 * 60_000); });
    expect(relogio().textContent).toBe('Atualizado às 10:47 · mexa na tela para atualizar');
    expect(titulo()).toBe(aoVivo);
    expect(anaTexto('Ligações para leads novos')).toBe('10:00Ligações para leads novosEra às 10:00, atrasada há 47 min');
    expect(anaTexto('Conferir as visitas da tarde')).toBe('10:30Conferir as visitas da tardeÉ agora');
    expect(anaTexto('Intervalo')).toBe('11:00IntervaloEm 13 min');
    expect(side('Atrasadas agora').textContent).toContain('Era às 10:00, há 47 min');
    expect(container.querySelector('[data-agora]').textContent).toBe('10:47');
  });

  it('ao voltar a mexer na tela, volta ao relógio de agora', async () => {
    vi.useFakeTimers({ now: NOW });
    await render();
    await render({ listenersActive: false });
    await act(async () => { vi.advanceTimersByTime(30 * 60_000 + 100); });
    const parado = titulo();
    await render({ listenersActive: true });
    expect(s.args.enabled).toBe(true);
    expect(relogio().getAttribute('data-relogio')).toBe('ao-vivo');
    expect(relogio().textContent).toBe('Ao vivo · 11:17');
    expect(titulo()).not.toBe(parado);
    expect(anaTexto('Ligações para leads novos')).toContain('atrasada há 1h 17min');
  });

  it('o dia que vira com a assinatura parada não troca o dia da leitura', async () => {
    vi.useFakeTimers({ now: at('23:50') });
    await render();
    expect(s.args.dayKey).toBe('2026-10-06');
    await render({ listenersActive: false });
    expect(relogio().textContent).toBe('Atualizado às 23:50 · mexa na tela para atualizar');
    await act(async () => { vi.advanceTimersByTime(20 * 60_000); });
    expect(s.args.dayKey).toBe('2026-10-06');
    // Já é outro dia no relógio de verdade: o rótulo diz que a leitura é de ontem.
    expect(relogio().textContent).toBe('Atualizado ontem às 23:50 · mexa na tela para atualizar');
    await render({ listenersActive: true });
    expect(s.args.dayKey).toBe('2026-10-07');
    // O relógio troca no :00 mais 50 ms: em 20 minutos exatos, o último tique é o das 00:09.
    expect(relogio().textContent).toBe('Ao vivo · 00:09');
  });

  it('no mesmo dia, o rótulo continua sem dia', async () => {
    vi.useFakeTimers({ now: at('18:30') });
    await render();
    await render({ listenersActive: false });
    await act(async () => { vi.advanceTimersByTime(5 * 60_000); });
    expect(relogio().textContent).toBe('Atualizado às 18:30 · mexa na tela para atualizar');
  });
});
