// @vitest-environment jsdom
// A página pública da pesquisa de NPS (plano 2026-11-25-perfil-do-professor-05,
// tarefa 3): o CPF conferido antes de enviar, as recusas, uma pergunta por
// tela, o comentário com o resumo e o obrigado. O servidor é um fetch falso.
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { AvaliarScreen } = await import('../../views/public/AvaliarScreen.jsx');

const INFO = {
  found: true,
  academia: 'Academia Teste',
  logoUrl: null,
  professor: { nome: 'Bruno', photoUrl: null, modalidades: ['Funcional'] },
  pesquisa: { perguntas: [{ id: 'p1', texto: 'Recomendaria as aulas?' }, { id: 'p2', texto: 'As aulas ajudam?' }] },
};
let respostas;
let pedidos;
let container;
let root;
beforeEach(() => {
  pedidos = [];
  respostas = { 'nps-info': [200, INFO], 'nps-check': [200, { ok: true, nome: 'Ana' }], 'nps-answer': [200, { ok: true }] };
  globalThis.fetch = vi.fn(async (_url, opts) => {
    const body = JSON.parse(opts.body);
    pedidos.push(body);
    const [status, dados] = respostas[body.action];
    return { status, json: async () => dados };
  });
  window.matchMedia = () => ({ matches: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.head.querySelectorAll('link[data-avaliar-fontes]').forEach((l) => l.remove());
});

const abrir = async () => {
  await act(async () => { root.render(h(AvaliarScreen, { slug: 'academia-teste', code: 'k7q2mx9pza' })); });
};
const botao = (texto) => [...container.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(texto));
const clicar = async (el) => { await act(async () => { el.click(); }); };
const digitar = async (el, valor) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const enviarCpf = async (cpf) => {
  await digitar(container.querySelector('#avl-cpf'), cpf);
  await act(async () => { container.querySelector('form').requestSubmit(); });
};
const darNota = async (n) => {
  const s = container.querySelector('input[type="range"]');
  await digitar(s, String(n));
};

describe('a página pública da pesquisa', () => {
  it('abre com o professor e confere o CPF antes de enviar', async () => {
    await abrir();
    expect(pedidos[0]).toEqual({ action: 'nps-info', slug: 'academia-teste', code: 'k7q2mx9pza' });
    expect(container.textContent).toContain('Avalie as aulas de Bruno');
    expect(container.textContent).toContain('2 perguntas');
    await enviarCpf('');
    expect(container.querySelector('#avl-cpf-erro').textContent).toBe('Digite o seu CPF.');
    await enviarCpf('123.456.789-00');
    expect(container.querySelector('#avl-cpf-erro').textContent).toBe('Esse CPF não é válido. Confira os números.');
    expect(container.querySelector('#avl-cpf').getAttribute('aria-invalid')).toBe('true');
    expect(pedidos).toHaveLength(1);
  });

  it('a máscara do CPF e as recusas do servidor', async () => {
    await abrir();
    await digitar(container.querySelector('#avl-cpf'), '52998224725');
    expect(container.querySelector('#avl-cpf').value).toBe('529.982.247-25');
    respostas['nps-check'] = [200, { ok: false, motivo: 'fora' }];
    await act(async () => { container.querySelector('form').requestSubmit(); });
    expect(container.querySelector('[role="alert"]').textContent).toContain('Não encontramos esse CPF na turma.');
    expect(pedidos[1]).toMatchObject({ action: 'nps-check', cpf: '52998224725' });
    respostas['nps-check'] = [200, { ok: false, motivo: 'ja' }];
    await act(async () => { container.querySelector('form').requestSubmit(); });
    expect(container.querySelector('[role="alert"]').textContent).toContain('Você já respondeu esta pesquisa.');
  });

  it('uma pergunta por tela, o resumo das notas e o envio', async () => {
    await abrir();
    await enviarCpf('529.982.247-25');
    expect(container.textContent).toContain('Oi, Ana!');
    expect(document.activeElement.textContent).toBe('Recomendaria as aulas?');
    expect(botao('Próxima').getAttribute('aria-disabled')).toBe('true');
    await clicar(botao('Próxima'));
    expect(container.querySelector('[role="status"]').textContent).toBe('Arraste a régua para dar a nota.');
    await darNota(10);
    expect(container.textContent).toContain('Excelente');
    await clicar(botao('Próxima'));
    expect(document.activeElement.textContent).toBe('As aulas ajudam?');
    await darNota(7);
    await clicar(botao('Continuar'));
    expect(container.textContent).toContain('Quer contar mais alguma coisa?');
    const mini = [...container.querySelectorAll('[aria-label="Suas notas"] button')].map((b) => b.getAttribute('aria-label'));
    expect(mini).toEqual(['Pergunta 1, nota 10. Mudar a nota', 'Pergunta 2, nota 7. Mudar a nota']);
    await digitar(container.querySelector('#avl-com'), 'Muito boas.');
    await clicar(botao('Enviar resposta'));
    expect(pedidos.at(-1)).toEqual({ action: 'nps-answer', slug: 'academia-teste', code: 'k7q2mx9pza', cpf: '52998224725', website: '', notas: { p1: 10, p2: 7 }, comentario: 'Muito boas.' });
    expect(container.textContent).toContain('Obrigado!');
    expect(document.activeElement.textContent).toBe('Obrigado!');
  });

  it('mudar uma nota pelo resumo volta para ele', async () => {
    await abrir();
    await enviarCpf('529.982.247-25');
    await darNota(10);
    await clicar(botao('Próxima'));
    await darNota(7);
    await clicar(botao('Continuar'));
    await clicar(container.querySelector('[aria-label="Pergunta 1, nota 10. Mudar a nota"]'));
    await darNota(6);
    await clicar(botao('Salvar nota'));
    expect(container.querySelector('[aria-label="Pergunta 1, nota 6. Mudar a nota"]')).toBeTruthy();
  });

  it('sem pesquisa aberta e link inválido', async () => {
    respostas['nps-info'] = [200, { ...INFO, pesquisa: null }];
    await abrir();
    expect(container.textContent).toContain('Nenhuma pesquisa aberta agora.');
    act(() => root.unmount());
    root = createRoot(container);
    respostas['nps-info'] = [200, { found: false }];
    await abrir();
    expect(container.textContent).toContain('Link fora do ar');
    expect(container.textContent).not.toContain('Bruno');
  });
});
