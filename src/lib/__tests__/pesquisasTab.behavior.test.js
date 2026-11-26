// @vitest-environment jsdom
// A aba Pesquisas do gestor (plano 2026-11-25-perfil-do-professor-04, tarefa 7,
// mockup B): o destaque da aberta com o andamento de cada professor, o
// rascunho que vem a seguir, o histórico e o formulário de três passos.
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const w = vi.hoisted(() => ({
  salvarRascunho: vi.fn(async (_db, id) => id ?? 'novo'),
  abrirPesquisa: vi.fn(async () => {}),
  encerrarPesquisa: vi.fn(async () => {}),
  excluirRascunho: vi.fn(async () => {}),
  gerarLinksQueFaltam: vi.fn(async (_db, ids) => ids.length),
}));
vi.mock('../npsWrites.js', () => w);
vi.mock('../firebase.js', () => ({ appId: 'acad', db: {}, auth: {} }));

const { ToastContext } = await import('../../contexts/ToastContext.jsx');
const { PesquisasTab } = await import('../../views/professores/PesquisasTab.jsx');
const { PERGUNTA_PRINCIPAL_PADRAO } = await import('../professor/pesquisas.js');

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const PERGS = [{ id: 'p1', texto: PERGUNTA_PRINCIPAL_PADRAO, principal: true }, { id: 'p2', texto: 'As aulas ajudam?', principal: false }];
const PROFS = [{ id: 'b', nome: 'Bruno Carvalho' }, { id: 'c', nome: 'Camila Rocha' }];
const ABERTA = { id: 'jun', nome: 'Junho de 2027', inicio: '2027-06-01', fim: '2027-06-20', ciclo: 2027, situacao: 'aberta', perguntas: PERGS, turmas: { b: 20, c: 24 } };
const RASCUNHO = { id: 'dez', nome: 'Dezembro de 2027', inicio: '2027-12-01', fim: '2027-12-15', ciclo: 2027, situacao: 'rascunho', perguntas: PERGS };
const TOTAIS = [{ pesquisaId: 'jun', professorId: 'b', respostas: 14 }, { pesquisaId: 'jun', professorId: 'c', respostas: 9 }];

let container;
let root;
beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (props = {}) => act(() => {
  root.render(h(ToastContext.Provider, { value: toast }, h(PesquisasTab, {
    db: {}, appUser: { id: 'g1' }, pesquisas: [ABERTA, RASCUNHO], totais: TOTAIS, professores: PROFS,
    turmasHoje: { b: 21, c: 25 }, hoje: '2027-06-14', agora: new Date(2027, 5, 14, 10), ...props,
  })));
});
const botao = (texto) => [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === texto);
const clicar = async (el) => { await act(async () => { el.click(); }); };
const digitar = (el, valor) => act(() => {
  const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
  set.call(el, valor);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});

describe('o link de cada professor', () => {
  it('avisa quem da turma aberta está sem link e gera os que faltam', async () => {
    render({ professores: [{ id: 'b', nome: 'Bruno Carvalho' }, { id: 'c', nome: 'Camila Rocha', npsCode: 'k7q2mx9pza' }] });
    const destaque = container.querySelector('[aria-labelledby="pesq-destaque"]');
    expect(destaque.textContent).toContain('Bruno ainda está sem o link da pesquisa');
    await clicar(botao('Gerar o link'));
    expect(w.gerarLinksQueFaltam).toHaveBeenCalledWith({}, ['b']);
    expect(toast.success).toHaveBeenCalledWith('Link gerado. Ele fica no perfil do professor.');
    expect(document.activeElement?.id).toBe('pesq-destaque');
  });

  it('cada professor com link tem o Copiar link na pesquisa aberta', async () => {
    const escrever = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escrever }, configurable: true });
    render({ tenantId: 'acad', professores: [{ id: 'b', nome: 'Bruno Carvalho', npsCode: 'k7q2mx9pza' }, { id: 'c', nome: 'Camila Rocha' }] });
    const copiar = [...container.querySelectorAll('button')].filter((b) => b.textContent.startsWith('Copiar link'));
    expect(copiar.map((b) => b.textContent)).toEqual(['Copiar link de Bruno Carvalho']);
    await clicar(copiar[0]);
    expect(escrever).toHaveBeenCalledWith(`${window.location.origin}/avaliar/acad/k7q2mx9pza`);
    expect(toast.success).toHaveBeenCalledWith('Link de Bruno copiado.');
  });

  it('com todos os links, não avisa nada', () => {
    render({ professores: PROFS.map((p) => ({ ...p, npsCode: 'k7q2mx9pza' })) });
    expect(container.textContent).not.toContain('sem o link');
    expect(botao('Gerar o link')).toBeUndefined();
    expect(botao('Gerar os links')).toBeUndefined();
  });
});

describe('a lista das pesquisas', () => {
  it('mostra a aberta com o andamento de cada professor', () => {
    render();
    const destaque = container.querySelector('[aria-labelledby="pesq-destaque"]');
    expect(destaque.textContent).toContain('De 01/06 a 20/06/2027, faltam 6 dias.');
    expect(destaque.textContent).toContain('23de 44 alunos já responderam');
    expect(destaque.textContent).toContain('14 de 20 alunos responderam (70%)');
    expect(destaque.textContent).toContain('Já vale');
    expect(destaque.textContent).toContain('9 de 24 alunos responderam (38%)');
    expect(destaque.textContent).toContain('Faltam 3 respostas');
  });

  it('o rascunho só abre depois que a aberta encerrar, e o histórico diz as respostas', () => {
    render();
    expect(container.textContent).toContain('Próxima: Dezembro de 2027');
    expect(botao('Abrir pesquisa').disabled).toBe(true);
    expect(container.textContent).toContain('Só abre depois que a Junho de 2027 encerrar.');
    const linhas = [...container.querySelectorAll('[aria-label="Todas as pesquisas"] li')].map((li) => li.textContent);
    expect(linhas[0]).toContain('ainda não abriu');
    expect(linhas[1]).toContain('23 de 44');
  });

  it('sem aberta, o destaque diz isso e o rascunho abre com confirmação', async () => {
    render({ pesquisas: [RASCUNHO], totais: [], hoje: '2027-11-28' });
    expect(container.textContent).toContain('Nenhuma pesquisa aberta');
    await clicar(botao('Abrir pesquisa'));
    const confirma = container.querySelector('[role="alertdialog"]');
    expect(confirma.textContent).toContain('46 alunos');
    expect(document.activeElement.textContent).toBe('Voltar');
    await clicar([...confirma.querySelectorAll('button')].find((b) => b.textContent === 'Abrir pesquisa'));
    expect(w.abrirPesquisa).toHaveBeenCalledWith({}, 'dez', expect.objectContaining({ turmas: { b: 21, c: 25 } }));
    expect(toast.success).toHaveBeenCalledWith('Pesquisa aberta.');
  });

  it('o rascunho não abre mais de uma semana antes do início, e diz quando abre', () => {
    render({ pesquisas: [RASCUNHO], totais: [], hoje: '2027-06-14' });
    expect(botao('Abrir pesquisa').disabled).toBe(true);
    expect(container.textContent).toContain('Abre a partir de 24/11, uma semana antes do início');
  });

  it('encerrar pede confirmação', async () => {
    render();
    await clicar(botao('Encerrar agora'));
    const confirma = container.querySelector('[role="alertdialog"]');
    expect(confirma.textContent).toContain('Os alunos param de conseguir responder agora.');
    await clicar([...confirma.querySelectorAll('button')].find((b) => b.textContent === 'Encerrar agora'));
    expect(w.encerrarPesquisa).toHaveBeenCalledWith({}, 'jun');
    // A pesquisa encerrada sai do destaque: o foco vai para o título dele.
    render({ pesquisas: [RASCUNHO], totais: [] });
    await act(async () => { await new Promise((ok) => requestAnimationFrame(ok)); });
    expect(document.activeElement.id).toBe('pesq-destaque');
  });

  it('abrir pela Próxima leva o foco ao destaque quando a pesquisa aberta chega, mesmo depois', async () => {
    render({ pesquisas: [RASCUNHO], totais: [], hoje: '2027-11-28' });
    await clicar(botao('Abrir pesquisa'));
    const confirma = container.querySelector('[role="alertdialog"]');
    await clicar([...confirma.querySelectorAll('button')].find((b) => b.textContent === 'Abrir pesquisa'));
    // A resposta do servidor ainda não chegou: o destaque segue sem pesquisa.
    await act(async () => { await new Promise((ok) => requestAnimationFrame(ok)); });
    expect(document.activeElement.id).not.toBe('pesq-destaque');
    render({ pesquisas: [{ ...RASCUNHO, situacao: 'aberta', turmas: { b: 21 } }], totais: [], hoje: '2027-12-02' });
    await act(async () => { await new Promise((ok) => requestAnimationFrame(ok)); });
    expect(document.activeElement.id).toBe('pesq-destaque');
    expect(document.activeElement.textContent).toContain('Dezembro de 2027');
  });

  it('a Próxima é o rascunho que ainda pode abrir, e não o que já passou do fim', () => {
    const velho = { ...RASCUNHO, id: 'out', nome: 'Outubro de 2027', inicio: '2027-10-01', fim: '2027-10-20' };
    render({ pesquisas: [velho, RASCUNHO], totais: [], hoje: '2027-11-28' });
    expect(container.textContent).toContain('Próxima: Dezembro de 2027');
  });

  it('o rascunho com o fim já passado não abre e diz por quê', () => {
    render({ pesquisas: [RASCUNHO], totais: [], hoje: '2027-12-16' });
    expect(botao('Abrir pesquisa').disabled).toBe(true);
    expect(container.textContent).toContain('O fim desta pesquisa já passou. Edite as datas para abrir.');
  });
});

describe('o formulário', () => {
  it('passa pelos três passos e abre a pesquisa nova', async () => {
    render({ pesquisas: [], totais: [], hoje: '2027-11-28' });
    await clicar(botao('Nova pesquisa'));
    expect(document.activeElement.textContent).toBe('Nome e datas');
    expect(botao('Continuar').disabled).toBe(true);
    expect(container.querySelector('[role="status"]').textContent).toBe('Dê um nome à pesquisa.');
    digitar(container.querySelector('#pesq-nome'), 'Dezembro de 2027');
    digitar(container.querySelector('#pesq-inicio'), '2027-12-01');
    digitar(container.querySelector('#pesq-fim'), '2027-12-15');
    expect([...container.querySelector('#pesq-ciclo').options].map((o) => o.textContent)).toEqual(['dez/2026 a nov/2027', 'dez/2027 a nov/2028']);
    await clicar(botao('Continuar'));
    expect(container.querySelector('textarea').value).toBe(PERGUNTA_PRINCIPAL_PADRAO);
    await clicar(botao('Adicionar pergunta'));
    expect(botao('Continuar').disabled).toBe(true);
    digitar(container.querySelectorAll('textarea')[1], 'De 0 a 10, as aulas ajudam?');
    await clicar(botao('Continuar'));
    expect(container.textContent).toContain('46 alunos da carteira dos professores, hoje');
    await clicar(botao('Abrir pesquisa'));
    const confirma = container.querySelector('[role="alertdialog"]');
    await clicar([...confirma.querySelectorAll('button')].find((b) => b.textContent === 'Abrir pesquisa'));
    expect(w.salvarRascunho).toHaveBeenCalledWith({}, null, expect.objectContaining({ nome: 'Dezembro de 2027', ciclo: 2027 }), 'g1');
    expect(w.abrirPesquisa).toHaveBeenCalledWith({}, 'novo', expect.anything());
    expect(container.textContent).toContain('Nova pesquisa');
  });

  it('edita o rascunho e salva, e o rascunho se exclui com confirmação', async () => {
    render();
    await clicar(botao('Editar'));
    expect(container.querySelector('#pesq-nome').value).toBe('Dezembro de 2027');
    await clicar(botao('Salvar rascunho'));
    expect(w.salvarRascunho).toHaveBeenCalledWith({}, 'dez', expect.objectContaining({ nome: 'Dezembro de 2027' }), 'g1');
    expect(document.activeElement.textContent).toBe('Nova pesquisa');
    await clicar(botao('Editar'));
    await clicar(botao('Excluir rascunho'));
    const confirma = container.querySelector('[role="alertdialog"]');
    await clicar([...confirma.querySelectorAll('button')].find((b) => b.textContent === 'Excluir rascunho'));
    expect(w.excluirRascunho).toHaveBeenCalledWith({}, 'dez');
  });

  it('com outra aberta, o último passo não abre e diz por quê', async () => {
    render();
    await clicar(botao('Editar'));
    await clicar(botao('Continuar'));
    await clicar(botao('Continuar'));
    expect(botao('Abrir pesquisa').disabled).toBe(true);
    expect(container.querySelector('[role="status"]').textContent).toContain('A pesquisa Junho de 2027 está aberta.');
  });
});
