// @vitest-environment jsdom
// O editor da trilha (plano 2026-11-26-plano-de-carreira-02, tarefa 7): a
// grade de níveis e metas, as regras, a barra de salvar e a trava do
// calendário da trilha Professor até o PR 3.
import { act, createElement as h, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O Popper do Radix mede o conteúdo com ResizeObserver, que o jsdom não tem.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
vi.mock('../firebase.js', () => ({ appId: 'acad', db: {}, auth: {} }));

const { trilhasDe } = await import('../carreira/trilhas.js');
const { MOTIVO_DO_ARQUIVAR, novaTrilha, SEM_NIVEL } = await import('../carreira/rascunho.js');
const { ToastContext } = await import('../../contexts/ToastContext.jsx');
const { TrilhaEditor } = await import('../../views/settings/carreira/TrilhaEditor.jsx');

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const [PROFESSOR, ESTAGIARIO, CONSULTOR] = trilhasDe(null);
const GENTE = { junior: 2, pleno: 1, senior: 0, [SEM_NIVEL]: 0 };
const NINGUEM = { junior: 0, pleno: 0, senior: 0, [SEM_NIVEL]: 0 };

const ed = { aba: null };
function Editor({ abaInicial = 'metas', ...props }) {
  const [aba, setAba] = useState(abaInicial);
  useEffect(() => { ed.aba = aba; });
  return h(TrilhaEditor, {
    outras: [], voltarHref: '/acad/configuracoes/carreira', modalities: [{ id: 'func', name: 'Funcional' }],
    onSalvar: vi.fn(async () => {}), onArquivar: vi.fn(), onDescartarNova: vi.fn(),
    ...props, aba, onAba: setAba,
  });
}

let container;
let root;
beforeEach(() => {
  vi.clearAllMocks();
  ed.aba = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

const render = async (props) => {
  await act(async () => {
    root.render(h(MemoryRouter, null, h(ToastContext.Provider, { value: toast }, h(Editor, props))));
  });
};
const campo = (rotulo) => document.body.querySelector(`input[aria-label="${rotulo}"]`);
const botao = (rotulo) => [...document.body.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === rotulo || b.textContent.trim() === rotulo);
const radio = (texto) => [...document.body.querySelectorAll('[role="radio"]')].find((r) => r.textContent.trim() === texto);
const aba = (texto) => [...document.body.querySelectorAll('[role="tab"]')].find((t) => t.textContent.trim() === texto);
const status = () => document.body.querySelector('[role="status"]').textContent;
const clicar = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.click(); });
};
// O Radix troca de aba no mousedown do botão esquerdo, e não no click.
const mousedown = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 })); });
};
const digitar = async (el, v) => {
  expect(el).toBeTruthy();
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('a grade de níveis e metas', () => {
  it('meta em branco fica tracejada com "sem meta", e a barra conta as que faltam', async () => {
    await render({ inicial: CONSULTOR, gravada: CONSULTOR, pessoas: NINGUEM });
    const vendas = campo('Vendas, Júnior');
    expect(vendas.value).toBe('');
    expect(vendas.placeholder).toBe('sem meta');
    expect(vendas.closest('label').className).toContain('border-dashed');
    expect(status()).toBe('12 metas em branco. A trilha salva assim.');
    expect(botao('Salvar trilha').disabled).toBe(true);
  });

  // A conta de largura está no comentário de TrilhaGrade.jsx: o campo mais
  // largo (em branco, com "% dos dias") cabe na coluna mínima com folga.
  it('o campo cabe na coluna mínima do nível', async () => {
    await render({ inicial: CONSULTOR, gravada: CONSULTOR, pessoas: NINGUEM });
    const linha = campo('Meta diária batida, Júnior').closest('[style]');
    expect(linha.style.gridTemplateColumns).toContain('minmax(180px,1fr)');
    const rotulo = campo('Meta diária batida, Júnior').closest('label');
    expect(rotulo.className).toContain('px-2');
    expect(rotulo.className).toContain('gap-1');
    expect(rotulo.className).not.toContain('px-[11px]');
    expect(campo('Meta diária batida, Júnior').className).toContain('w-[54px]');
    expect(campo('Meta diária batida, Júnior').className).toContain('placeholder:text-[11.5px]');
  });

  it('o rodapé acompanha a largura das linhas, com o texto à vista', async () => {
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE });
    const grade = document.body.querySelector('section[aria-label="Níveis e metas"]');
    expect(grade.className).toContain('overscroll-x-contain');
    expect(grade.className).toContain('@container');
    const linha = campo('Renovação da carteira, Júnior').closest('[style]');
    const rodape = grade.querySelector('p');
    expect(rodape.style.minWidth).toBe(linha.style.minWidth);
    expect(rodape.firstElementChild.className).toContain('sticky');
  });

  it('desligar o número ocupa a linha com "Não conta nesta trilha" e tira as metas da conta', async () => {
    await render({ inicial: CONSULTOR, gravada: CONSULTOR, pessoas: NINGUEM });
    await clicar(botao('Vendas conta nesta trilha'));
    expect(campo('Vendas, Júnior')).toBeNull();
    expect(document.body.textContent).toContain('Não conta nesta trilha');
    expect(status()).toBe('9 metas em branco. A trilha salva assim.');
    expect(botao('Salvar trilha').disabled).toBe(false);
    await clicar(botao('Vendas conta nesta trilha'));
    expect(campo('Vendas, Júnior')).toBeTruthy();
  });

  it('vendas em reais: o campo é em mil e a meta vai em reais', async () => {
    const onSalvar = vi.fn(async () => {});
    await render({ inicial: CONSULTOR, gravada: CONSULTOR, pessoas: NINGUEM, onSalvar });
    expect(campo('Vendas, Júnior').closest('label').textContent).toContain('R$');
    await digitar(campo('Vendas, Júnior'), '12,5');
    await clicar(botao('Salvar trilha'));
    expect(onSalvar.mock.calls[0][0].numeros.vendas.metas.junior).toBe(12500);
    expect(toast.success).toHaveBeenCalledWith('Trilha salva.');
  });

  it('apagar nível com gente fica desligado com o motivo; sem gente, apaga', async () => {
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE });
    expect(botao('Apagar o nível Júnior').getAttribute('aria-disabled')).toBe('true');
    await clicar(botao('Apagar o nível Júnior'));
    expect(toast.warning).toHaveBeenCalledWith('Júnior tem gente. Passe as pessoas para outro nível antes de apagar.');
    expect(campo('Nome do nível 1').value).toBe('Júnior');
    expect(botao('Apagar o nível Sênior').getAttribute('aria-disabled')).toBeNull();
    await clicar(botao('Apagar o nível Sênior'));
    expect(campo('Nome do nível 3')).toBeNull();
    expect(campo('Meses mínimos em Pleno antes de subir')).toBeNull();
    expect(document.body.textContent).toContain('último nível');
  });

  it('"+ Nível" acrescenta uma coluna no fim', async () => {
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE });
    await clicar(botao('Acrescentar nível'));
    expect(campo('Nome do nível 4').value).toBe('Nível 4');
    expect(campo('Meses mínimos em Sênior antes de subir').value).toBe('12');
    expect(campo('Renovação da carteira, Nível 4').placeholder).toBe('sem meta');
  });

  it('renomear o nível muda o rótulo dos campos da coluna', async () => {
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE });
    await digitar(campo('Nome do nível 2'), 'Pleno I');
    expect(campo('Renovação da carteira, Pleno I').value).toBe('55');
  });
});

describe('o anel do foco', () => {
  // O anel-foco é um @utility que o cn não conhece: sem o ring-2 ring-ring
  // escrito, o anel de 50% do primitivo fica por cima dele.
  it('a chave e a lista do mês não levam o anel de 50% do primitivo', async () => {
    await render({ inicial: ESTAGIARIO, gravada: ESTAGIARIO, pessoas: NINGUEM });
    const chave = document.body.querySelector('[role="switch"]');
    const mes = document.body.querySelector('button[aria-label="Meses da avaliação"]');
    for (const el of [chave, mes]) {
      expect(el.className).toContain('focus-visible:anel-foco');
      expect(el.className).toContain('focus-visible:ring-ring');
      expect(el.className).not.toContain('ring-ring/50');
      expect(el.className).not.toContain('ring-[3px]');
    }
  });
});

describe('o rascunho e a barra de salvar', () => {
  it('trocar de aba não perde o que foi digitado', async () => {
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE });
    await digitar(campo('Renovação da carteira, Júnior'), '50');
    await mousedown(aba('Regras da trilha'));
    expect(ed.aba).toBe('regras');
    expect(document.body.textContent).toContain('Como cada número conta');
    expect(campo('Renovação da carteira, Júnior').closest('[role="tabpanel"]').hidden).toBe(true);
    await mousedown(aba('Níveis e metas'));
    expect(campo('Renovação da carteira, Júnior').value).toBe('50');
    expect(campo('Renovação da carteira, Júnior').closest('[role="tabpanel"]').hidden).toBe(false);
    expect(campo('Aulas na semana para contar').closest('[role="tabpanel"]').hidden).toBe(true);
    expect(botao('Salvar trilha').disabled).toBe(false);
  });

  it('o valor inválido continua no campo ao trocar de aba, e a barra diz qual é', async () => {
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE });
    await digitar(campo('Renovação da carteira, Pleno'), '4o');
    expect(status()).toBe('Renovação da carteira, Pleno: use um número de 0 a 100.');
    await mousedown(aba('Regras da trilha'));
    expect(status()).toBe('Renovação da carteira, Pleno: use um número de 0 a 100.');
    await mousedown(aba('Níveis e metas'));
    expect(campo('Renovação da carteira, Pleno').value).toBe('4o');
    expect(campo('Renovação da carteira, Pleno').getAttribute('aria-invalid')).toBe('true');
    expect(botao('Salvar trilha').disabled).toBe(true);
  });

  it('Descartar volta ao que está gravado', async () => {
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE });
    expect(botao('Descartar').disabled).toBe(true);
    await digitar(campo('Renovação da carteira, Júnior'), '50');
    expect(status()).toBe('Tudo certo para salvar.');
    await clicar(botao('Descartar'));
    expect(campo('Renovação da carteira, Júnior').value).toBe('45');
    expect(botao('Salvar trilha').disabled).toBe(true);
    expect(status()).toBe('Nenhuma mudança ainda.');
  });

  it('Salvar manda o rascunho inteiro', async () => {
    const onSalvar = vi.fn(async () => {});
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE, onSalvar });
    await digitar(campo('Renovação da carteira, Júnior'), '50');
    await clicar(botao('Salvar trilha'));
    expect(onSalvar).toHaveBeenCalledTimes(1);
    const enviado = onSalvar.mock.calls[0][0];
    expect(enviado.id).toBe('professor');
    expect(enviado.numeros.renovacao.metas).toEqual({ junior: 50, pleno: 55, senior: 65 });
  });

  it('a falha ao salvar vira aviso, com o texto da tela quando há', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onSalvar = vi.fn(async () => { throw Object.assign(new Error('Já existe uma trilha com esse nome.'), { paraTela: true }); });
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE, onSalvar });
    await digitar(campo('Renovação da carteira, Júnior'), '50');
    await clicar(botao('Salvar trilha'));
    expect(toast.error).toHaveBeenCalledWith('Já existe uma trilha com esse nome.');
    onSalvar.mockImplementation(async () => { throw new Error('rede'); });
    await clicar(botao('Salvar trilha'));
    expect(toast.error).toHaveBeenLastCalledWith('Não deu para salvar a trilha. Tente de novo.');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('nome vazio: a barra diz o que falta e o Salvar fica desligado', async () => {
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE });
    await digitar(campo('Nome da trilha'), '');
    expect(status()).toBe('Dê um nome à trilha.');
    expect(botao('Salvar trilha').disabled).toBe(true);
  });

  it('meta fora do limite: a barra diz o limite', async () => {
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE });
    await digitar(campo('Nota dos alunos, Júnior'), '11');
    expect(status()).toBe('Nota dos alunos, Júnior: use um número de 0 a 10.');
    expect(botao('Salvar trilha').disabled).toBe(true);
  });
});

describe('arquivar e a trilha nova', () => {
  it('Arquivar trilha com gente fica desligado com o motivo', async () => {
    const onArquivar = vi.fn();
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE, onArquivar });
    const arquivar = botao('Arquivar trilha');
    expect(arquivar.getAttribute('aria-disabled')).toBe('true');
    expect(document.getElementById(arquivar.getAttribute('aria-describedby')).textContent).toBe(MOTIVO_DO_ARQUIVAR);
    await clicar(arquivar);
    expect(toast.warning).toHaveBeenCalledWith(MOTIVO_DO_ARQUIVAR);
    expect(onArquivar).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('3 pessoas nesta trilha');
  });

  it('Arquivar trilha sem gente chama o arquivar', async () => {
    const onArquivar = vi.fn();
    await render({ inicial: CONSULTOR, gravada: CONSULTOR, pessoas: NINGUEM, onArquivar });
    expect(document.body.textContent).toContain('Ninguém nesta trilha');
    await clicar(botao('Arquivar trilha'));
    expect(onArquivar).toHaveBeenCalledTimes(1);
  });

  it('com o rascunho mudado, Arquivar fica desligado até salvar ou descartar', async () => {
    const onArquivar = vi.fn();
    await render({ inicial: CONSULTOR, gravada: CONSULTOR, pessoas: NINGUEM, onArquivar });
    await digitar(campo('Nome da trilha'), 'Consultor II');
    const arquivar = botao('Arquivar trilha');
    expect(arquivar.getAttribute('aria-disabled')).toBe('true');
    expect(document.getElementById(arquivar.getAttribute('aria-describedby')).textContent)
      .toBe('Salve ou descarte as mudanças antes de arquivar.');
    await clicar(arquivar);
    expect(toast.warning).toHaveBeenCalledWith('Salve ou descarte as mudanças antes de arquivar.');
    expect(onArquivar).not.toHaveBeenCalled();
    await clicar(botao('Descartar'));
    expect(botao('Arquivar trilha').getAttribute('aria-disabled')).toBeNull();
  });

  it('a trilha nova não tem Arquivar, e Descartar chama o descarte', async () => {
    const onDescartarNova = vi.fn();
    await render({ inicial: novaTrilha('professor', [], () => 0), gravada: null, pessoas: {}, onDescartarNova });
    expect(botao('Arquivar trilha')).toBeUndefined();
    expect(campo('Nome da trilha').value).toBe('');
    expect(botao('Salvar trilha').disabled).toBe(true);
    await clicar(botao('Descartar'));
    expect(onDescartarNova).toHaveBeenCalledTimes(1);
  });
});

describe('as regras da trilha', () => {
  it('a trilha Professor muda o calendário', async () => {
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE, abaInicial: 'regras' });
    expect(document.body.textContent).not.toContain('O calendário da trilha Professor muda a partir do menu Carreira.');
    expect(radio('Uma vez por ano').disabled).toBe(false);
    expect(radio('Duas vezes por ano').disabled).toBe(false);
    expect(document.body.querySelector('button[aria-label="Mês da avaliação"]').disabled).toBe(false);
  });

  it('com gente na trilha, "Para quem" não muda', async () => {
    const minha = { ...PROFESSOR, id: 'minha', nome: 'Minha', padrao: false };
    await render({ inicial: minha, gravada: minha, pessoas: GENTE, abaInicial: 'regras' });
    expect(radio('Professores').disabled).toBe(true);
    expect(radio('Consultores').disabled).toBe(true);
    expect(document.body.textContent).toContain('não muda com gente na trilha');
  });

  it('a trilha que vem pronta não muda "Para quem", mesmo sem gente', async () => {
    await render({ inicial: ESTAGIARIO, gravada: ESTAGIARIO, pessoas: NINGUEM, abaInicial: 'regras' });
    expect(radio('Professores').disabled).toBe(true);
    expect(radio('Consultores').disabled).toBe(true);
    expect(document.body.textContent).toContain('não muda nas trilhas que vêm prontas');
  });

  it('as outras trilhas mudam o calendário', async () => {
    await render({ inicial: ESTAGIARIO, gravada: ESTAGIARIO, pessoas: NINGUEM, abaInicial: 'regras' });
    expect(document.body.textContent).not.toContain('O calendário da trilha Professor muda a partir do menu Carreira.');
    expect(radio('Uma vez por ano').disabled).toBe(false);
    expect(document.body.querySelector('button[aria-label="Meses da avaliação"]').disabled).toBe(false);
    expect(document.body.textContent).toContain('Os números contam de 1º de dezembro a 31 de maio e de 1º de junho a 30 de novembro.');
    expect(radio('12 meses até o fim do semestre').getAttribute('aria-checked')).toBe('true');
  });

  // Com o trilho ao lado, a coluna tem uns 632 px numa janela de 1100: a
  // regra quebra pela largura do bloco, e o seletor quebra linha em vez de
  // ser cortado.
  it('a regra quebra pelo bloco, e o seletor de duas opções quebra linha', async () => {
    await render({ inicial: ESTAGIARIO, gravada: ESTAGIARIO, pessoas: NINGUEM, abaInicial: 'regras' });
    const seletor = document.body.querySelector('[role="radiogroup"][aria-label="A renovação olha"]');
    const regra = seletor.parentElement.parentElement;
    expect(regra.className).toMatch(/@xl:grid-cols-/);
    expect(regra.className).not.toMatch(/\bmd:/);
    expect(regra.closest('section').className).toContain('@container');
    expect(seletor.className).toContain('flex-wrap');
    expect(seletor.className).toContain('max-w-full');
    expect(seletor.className).not.toContain('w-max');
  });

  it('cada número ligado diz como conta, com o ajuste', async () => {
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE, abaInicial: 'regras' });
    expect(campo('Dias de aula recente que ainda não contam').value).toBe('30');
    expect(campo('Aulas na semana para contar').value).toBe('2');
    expect(campo('Fim da faixa da meta').value).toBe('70');
  });
});
