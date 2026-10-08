// @vitest-environment jsdom
// O balão "Novo" das Rotinas (RotinasNovo), no item Rotinas do menu (mockup
// 2026-10-08-balao-novo-rotinas.html, opção C): aparece até 07/11/2026,
// inclusive, e no clique abre a apresentação em seis passos (mockup
// 2026-10-08-rotinas-intro-e-polimento.html, Pop-up 1, com o passo da aba Hoje
// do 2026-10-08-rotinas-aba-hoje.html).
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NOVO_ATE, RotinasNovo } from '../../components/rotinas/RotinasIntro.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

const HOJE = new Date(2026, 9, 8, 9, 0);
const montar = async (props) => {
  await act(async () => { root.render(h(RotinasNovo, props)); });
};
const balao = () => document.body.querySelector('[aria-label="Novo: o que é esta tela"]');
const dialogo = () => document.body.querySelector('[role="dialog"]');
const botao = (rotulo) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
const clicar = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.click(); });
};
const passo = () => {
  const titulo = dialogo().querySelector('h2');
  return { kicker: titulo.previousElementSibling.textContent, titulo: titulo.textContent };
};
const descricao = () => document.getElementById(dialogo().getAttribute('aria-describedby')).textContent;
const ilustracao = () => dialogo().querySelector('[data-ilustracao]');
const abrir = async () => {
  await montar({ now: HOJE, tone: 'alert' });
  await clicar(balao());
};
const ateOUltimo = async () => {
  await clicar(botao('Ver como configurar'));
  for (let i = 0; i < 4; i += 1) await clicar(botao('Próximo'));
};

describe('RotinasNovo', () => {
  it('vale até 07/11/2026', () => {
    expect(NOVO_ATE).toBe('2026-11-07');
  });

  it.each([
    ['um mês antes', new Date(2026, 9, 8, 9, 0)],
    ['no último dia, à noite', new Date(2026, 10, 7, 23, 59)],
  ])('aparece %s', async (_quando, now) => {
    await montar({ now });
    expect(balao()).not.toBeNull();
    expect(balao().textContent.trim()).toBe('Novo');
  });

  it('some no dia seguinte ao último', async () => {
    await montar({ now: new Date(2026, 10, 8, 0, 0) });
    expect(balao()).toBeNull();
    expect(container.innerHTML).toBe('');
  });

  it('repassa o tom ao balão', async () => {
    await montar({ now: HOJE, tone: 'alert' });
    expect(balao().className).toContain('bg-red-600');
  });
});

describe('a apresentação em passos', () => {
  it('abre no primeiro passo: o que é a rotina', async () => {
    await abrir();
    expect(passo()).toEqual({ kicker: 'Novidade', titulo: 'O que é a rotina' });
    expect(descricao()).toContain('São as tarefas que o consultor faz todo dia e que não dependem de um lead, como abrir a recepção, postar o story da aula ou atualizar o Stronilead antes de sair.');
    expect(descricao()).toContain('Você monta a lista uma vez, num modelo.');
    expect(descricao()).toContain('Ela aparece todo dia na Meta diária de quem segue o modelo, num cartão à parte.');
    expect(descricao()).toContain('O consultor marca o que fez. A meta de leads não muda, e a rotina não conta para o dia batido.');
    expect(ilustracao().textContent).toContain('Meta diária · leads');
    expect(ilustracao().textContent).toContain('Rotina · o dia');
    expect(botao('Ver como configurar')).toBeTruthy();
    expect(botao('Voltar').className.split(/\s+/)).toContain('hidden');
    expect(botao('Entendi')).toBeUndefined();
  });

  it('os quatro passos de configurar, com Voltar e Próximo', async () => {
    await abrir();
    await clicar(botao('Ver como configurar'));
    expect(passo()).toEqual({ kicker: 'Como configurar · 1 de 4', titulo: 'Crie um modelo' });
    expect(descricao()).toBe('Aqui em Rotinas, clique em Novo modelo e dê um nome, como "Consultor manhã". Pode começar em branco ou copiar um modelo que já existe.');
    expect(botao('Voltar').className.split(/\s+/)).not.toContain('hidden');
    await clicar(botao('Próximo'));
    expect(passo()).toEqual({ kicker: 'Como configurar · 2 de 4', titulo: 'Coloque as tarefas' });
    expect(descricao()).toBe('Dentro do modelo, clique em Nova tarefa. Escreva o que fazer, explique como fazer se precisar, escolha os dias e, se quiser, o horário.');
    await clicar(botao('Próximo'));
    expect(passo()).toEqual({ kicker: 'Como configurar · 3 de 4', titulo: 'Escolha quem segue' });
    expect(descricao()).toBe('Na lista Consultores, escolha o modelo de cada pessoa. Cada consultor segue um modelo só, e um modelo pode ter várias pessoas. Para alguém com uma rotina diferente, duplique o modelo e ajuste a cópia.');
    await clicar(botao('Próximo'));
    expect(passo()).toEqual({ kicker: 'Como configurar · 4 de 4', titulo: 'Pronto: o consultor dá check' });
    expect(descricao()).toContain('No mesmo dia, a rotina aparece na Meta diária do consultor. A tarefa com horário fica em destaque até 30 minutos depois e, passado isso, aparece como atrasada. Ele marca o que fez e pode deixar uma observação.');
    expect(descricao()).toContain('Bom saber: o que você muda num modelo vale a partir de hoje. Os dias anteriores ficam como estavam.');
  });

  it('o último passo mostra a aba Hoje sem a linha do dia, e o Entendi fecha', async () => {
    await abrir();
    await ateOUltimo();
    expect(passo()).toEqual({ kicker: 'Acompanhar', titulo: 'Acompanhe o dia na aba Hoje' });
    expect(descricao()).toBe('Na aba Hoje, aqui em Rotinas, você vê quanto cada consultor já fez, o que está atrasado agora e as observações que eles deixaram. A tela se atualiza sozinha. Você acompanha, mas o check é sempre de quem fez a tarefa.');
    const desenho = ilustracao().textContent;
    for (const trecho of ['Ana', '5 de 11', '1 atrasada', 'Bruno', '6 de 11', 'nada atrasado', 'Ana · Ligações para leads novos · atrasada há 47 min']) {
      expect(desenho).toContain(trecho);
    }
    // Sem trilho com pontos: nada posicionado na horizontal.
    expect(ilustracao().querySelector('[style*="left"]')).toBeNull();
    expect(botao('Próximo')).toBeUndefined();
    await clicar(botao('Entendi'));
    expect(dialogo()).toBeNull();
    expect(balao()).not.toBeNull();
  });

  it('o botão principal é o mesmo em todos os passos, para o foco não se perder', async () => {
    await abrir();
    const principal = botao('Ver como configurar');
    await clicar(principal);
    expect(botao('Próximo')).toBe(principal);
    for (let i = 0; i < 4; i += 1) await clicar(botao('Próximo'));
    expect(botao('Entendi')).toBe(principal);
  });

  it('o Voltar volta um passo e, no primeiro, leva o foco ao botão principal', async () => {
    await abrir();
    await clicar(botao('Ver como configurar'));
    await clicar(botao('Próximo'));
    await clicar(botao('Voltar'));
    expect(passo().titulo).toBe('Crie um modelo');
    await clicar(botao('Voltar'));
    expect(passo().titulo).toBe('O que é a rotina');
    expect(document.activeElement).toBe(botao('Ver como configurar'));
  });

  it('os pontinhos levam direto a cada passo', async () => {
    await abrir();
    const grupo = dialogo().querySelector('[role="group"][aria-label="Passos"]');
    const pontos = () => [...grupo.querySelectorAll('button')];
    expect(pontos().map((p) => p.getAttribute('aria-label'))).toEqual([
      'O que é a rotina', 'Crie um modelo', 'Coloque as tarefas', 'Escolha quem segue', 'Pronto: o consultor dá check', 'Acompanhe o dia na aba Hoje',
    ]);
    expect(pontos().map((p) => p.getAttribute('aria-current'))).toEqual(['step', null, null, null, null, null]);
    await clicar(pontos()[3]);
    expect(passo().titulo).toBe('Escolha quem segue');
    expect(pontos().map((p) => p.getAttribute('aria-current'))).toEqual([null, null, null, 'step', null, null]);
  });

  it('fechar no meio e reabrir volta ao primeiro passo', async () => {
    await abrir();
    await clicar(botao('Ver como configurar'));
    await clicar(botao('Próximo'));
    await clicar(botao('Fechar'));
    expect(dialogo()).toBeNull();
    await clicar(balao());
    expect(passo().titulo).toBe('O que é a rotina');
  });

  it('o desenho fica fora do leitor de tela', async () => {
    await abrir();
    expect(ilustracao().getAttribute('aria-hidden')).toBe('true');
  });
});

describe('a apresentação no celular', () => {
  const classes = (el) => el.className.split(/\s+/);

  it('o primeiro passo some com o Voltar (hidden, e não invisible, que ainda ocupa lugar) e o rodapé quebra linha em tela estreita', async () => {
    await abrir();
    expect(classes(botao('Voltar'))).toContain('hidden');
    expect(classes(botao('Voltar'))).not.toContain('invisible');
    const rodape = dialogo().querySelector('[role="group"][aria-label="Passos"]').parentElement;
    expect(classes(rodape)).toContain('flex-wrap');
    // Quebrando, os botões continuam na ponta direita.
    expect(classes(botao('Ver como configurar').parentElement)).toContain('ml-auto');
    // A coluna da caixa não cresce com o conteúdo.
    expect(classes(dialogo())).toContain('grid-cols-[minmax(0,1fr)]');
  });

  it('o quadro do desenho cresce com ele e deixa a folga do X no alto; a partir do sm tem altura fixa', async () => {
    await abrir();
    const quadro = classes(ilustracao());
    expect(quadro).toEqual(expect.arrayContaining(['h-auto', 'min-h-[200px]', 'pt-10', 'pb-4', 'sm:h-[250px]', 'sm:py-0']));
    expect(quadro).not.toContain('h-[200px]');
  });
});

describe('a apresentação: foco, anúncio e detalhes', () => {
  const classes = (el) => el.className.split(/\s+/);

  it('abre com o foco no botão principal, e não no primeiro pontinho', async () => {
    await abrir();
    expect(document.activeElement).toBe(botao('Ver como configurar'));
    await clicar(botao('Ver como configurar'));
    expect(document.activeElement).toBe(botao('Próximo'));
  });

  it('reabrir também começa com o foco no botão principal', async () => {
    await abrir();
    await clicar(botao('Ver como configurar'));
    await clicar(botao('Fechar'));
    // O Radix devolve o foco ao balão num setTimeout(0); a pessoa só reabre depois disso.
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(document.activeElement).toBe(balao());
    await clicar(balao());
    expect(document.activeElement).toBe(botao('Ver como configurar'));
  });

  it('o passo novo é anunciado de uma vez, com a etapa, o título e o texto, numa região só', async () => {
    await abrir();
    const vivas = () => dialogo().querySelectorAll('[aria-live]');
    expect(vivas()).toHaveLength(1);
    const viva = vivas()[0];
    expect(viva.getAttribute('aria-live')).toBe('polite');
    expect(viva.getAttribute('aria-atomic')).toBe('true');
    expect(viva.contains(dialogo().querySelector('h2'))).toBe(true);
    expect(viva.textContent).toContain('Novidade');
    expect(viva.textContent).toContain('O que é a rotina');
    await clicar(botao('Ver como configurar'));
    // O mesmo nó, senão o leitor de tela não anuncia a troca.
    expect(vivas()).toHaveLength(1);
    expect(vivas()[0]).toBe(viva);
    expect(viva.textContent).toContain('Como configurar · 1 de 4');
    expect(viva.textContent).toContain('Crie um modelo');
    expect(viva.textContent).toContain('Aqui em Rotinas, clique em Novo modelo');
    // A descrição do pop-up continua sendo só o texto do passo.
    expect(descricao()).not.toContain('Crie um modelo');
  });

  it('a partir do sm o corpo do texto tem a altura do passo mais alto, para o rodapé não pular', async () => {
    await abrir();
    const corpo = dialogo().querySelector('h2').closest('[aria-live]');
    expect(classes(corpo)).toEqual(expect.arrayContaining(['min-h-[168px]', 'sm:min-h-[294px]']));
  });

  it('o desenho entra com o fade que respeita movimento reduzido', async () => {
    await abrir();
    const entrada = classes(ilustracao().firstElementChild);
    expect(entrada).toEqual(expect.arrayContaining(['animate-in', 'fade-in-0', 'motion-reduce:animate-none']));
    expect(entrada).not.toContain('animate-fade-in');
    expect(entrada).not.toContain('fade-in');
  });

  it('as áreas de toque dos pontinhos não se sobrepõem', async () => {
    await abrir();
    const pontos = [...dialogo().querySelectorAll('[role="group"][aria-label="Passos"] button')];
    expect(pontos).toHaveLength(6);
    for (const ponto of pontos) {
      expect(classes(ponto)).toEqual(expect.arrayContaining(['after:-inset-x-[3px]', 'after:-inset-y-2']));
      expect(classes(ponto)).not.toContain('after:-inset-2');
    }
  });

  it('a linha da tarefa atrasada não deixa o "min" sozinho na linha de baixo', async () => {
    await abrir();
    await ateOUltimo();
    const atraso = [...ilustracao().querySelectorAll('span')].find((el) => el.textContent === 'atrasada há 47 min');
    expect(atraso).toBeTruthy();
    expect(classes(atraso)).toContain('whitespace-nowrap');
  });
});
