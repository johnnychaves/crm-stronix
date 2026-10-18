// @vitest-environment jsdom
// O Contexto comercial da ficha: sete campos, clique para editar no lugar. A
// gravação em si (onSave) é um dublê: o que vale aqui é o que a tela pede para
// gravar e o que ela faz com a resposta.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';
import { ContextCard } from '../../components/profile/ContextCard.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O Radix mede e rola a lista; o jsdom não tem essas APIs.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

const LEAD = {
  id: 'l1', name: 'Rafael Moreira', dor: 'Emagrecimento', modalidade: 'Musculação', source: 'Instagram',
  consultantId: 'u1', consultantName: 'Júlia Andrade', professorId: 'p1', professorName: 'Marcos Vieira',
  tags: ['Quer treinar à noite'], observation: 'Casamento em dezembro.',
};
const CONFIG = {
  dores: [{ id: 'd1', name: 'Emagrecimento' }, { id: 'd2', name: 'Saúde' }],
  modalities: [{ id: 'm1', name: 'Musculação' }, { id: 'm2', name: 'Pilates' }],
  professores: [{ id: 'p1', nome: 'Marcos Vieira' }],
};
const SOURCES = [{ id: 's1', name: 'Instagram' }, { id: 's2', name: 'Indicação' }];
const EQUIPE = [
  { id: 'u1', name: 'Júlia Andrade', authUid: 'a1', active: true, role: 'consultant' },
  { id: 'u2', name: 'Rafa Professor', authUid: 'a2', active: true, role: 'professor', professorId: 'p1' },
  { id: 'u3', name: 'Ex Consultor', authUid: 'a3', active: false, role: 'consultant' },
  { id: 'u4', name: 'Sem Login', authUid: null, active: true, role: 'consultant' },
];

let root = null;
async function montar({ canEdit = true, onSave = vi.fn(async () => true), lead = LEAD } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(GeneralConfigContext.Provider, { value: CONFIG },
      h(ContextCard, { lead, sources: SOURCES, usersList: EQUIPE, tagsCatalog: [], canEdit, onSave })));
  });
  return onSave;
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

const porLabel = (texto) => document.body.querySelector(`[aria-label="${texto}"]`);
const clicar = async (el) => { await act(async () => { el.click(); }); };
const botao = (texto) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === texto) || null;
const opcoes = () => [...document.body.querySelectorAll('[role="option"]')].map((o) => o.textContent);
async function digitar(el, valor) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
  await act(async () => { set.call(el, valor); el.dispatchEvent(new Event('input', { bubbles: true })); });
}
const tecla = async (el, key, extra = {}) => {
  await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...extra })); });
};

describe('ContextCard', () => {
  it('mostra os sete campos com o que está gravado', async () => {
    await montar();
    const t = document.body.textContent;
    ['Dor', 'Modalidade', 'Origem', 'Consultor', 'Professor', 'Etiquetas', 'Observação'].forEach((rotulo) => expect(t).toContain(rotulo));
    ['Emagrecimento', 'Musculação', 'Instagram', 'Júlia Andrade', 'Marcos Vieira', 'Quer treinar à noite', 'Casamento em dezembro.']
      .forEach((valor) => expect(t).toContain(valor));
  });

  it('campo vazio mostra "Adicionar"', async () => {
    await montar({ lead: { id: 'l2', name: 'Ana', tags: [] } });
    expect(document.body.textContent).toContain('Adicionar');
  });

  it('sem permissão de editar, campo vazio diz "Não informado" e não convida a adicionar', async () => {
    await montar({ canEdit: false, lead: { id: 'l2', name: 'Ana', tags: [] } });
    expect(document.body.textContent).not.toContain('Adicionar');
    expect(document.body.textContent).toContain('Não informado');
  });

  it('sem permissão de editar, não tem botão de editar nem a dica', async () => {
    await montar({ canEdit: false });
    expect(document.body.querySelector('[aria-label^="Editar"]')).toBeNull();
    expect(document.body.querySelector('button')).toBeNull();
    expect(document.body.textContent).not.toContain('Clique em um campo para editar');
    expect(document.body.textContent).toContain('Emagrecimento');
  });

  it('editar a observação abre o texto, salva só ela, fecha e devolve o foco ao campo', async () => {
    const onSave = await montar();
    await clicar(porLabel('Editar observação'));
    const caixa = document.body.querySelector('textarea');
    expect(caixa.value).toBe('Casamento em dezembro.');
    expect(document.activeElement).toBe(caixa);
    await digitar(caixa, 'Casamento adiado para janeiro.');
    await clicar(botao('Salvar'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('observation', 'Casamento adiado para janeiro.');
    expect(document.body.querySelector('textarea')).toBeNull();
    expect(document.activeElement).toBe(porLabel('Editar observação'));
  });

  it('Ctrl mais Enter salva e Esc cancela a observação', async () => {
    const onSave = await montar();
    await clicar(porLabel('Editar observação'));
    await digitar(document.body.querySelector('textarea'), 'Novo texto');
    await tecla(document.body.querySelector('textarea'), 'Enter', { ctrlKey: true });
    expect(onSave).toHaveBeenCalledWith('observation', 'Novo texto');

    await clicar(porLabel('Editar observação'));
    await tecla(document.body.querySelector('textarea'), 'Escape');
    expect(document.body.querySelector('textarea')).toBeNull();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('salvar a observação sem mudar nada só fecha, sem gravar', async () => {
    const onSave = await montar();
    await clicar(porLabel('Editar observação'));
    await clicar(botao('Salvar'));
    expect(onSave).not.toHaveBeenCalled();
    expect(document.body.querySelector('textarea')).toBeNull();
  });

  it('cancelar não grava', async () => {
    const onSave = await montar();
    await clicar(porLabel('Editar observação'));
    await digitar(document.body.querySelector('textarea'), 'Mudei de ideia');
    await clicar(botao('Cancelar'));
    expect(onSave).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Casamento em dezembro.');
  });

  it('se a gravação falha, o editor continua aberto com o que foi digitado', async () => {
    const onSave = vi.fn(async () => false);
    await montar({ onSave });
    await clicar(porLabel('Editar observação'));
    await digitar(document.body.querySelector('textarea'), 'Texto que não gravou');
    await clicar(botao('Salvar'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('textarea').value).toBe('Texto que não gravou');
  });

  it('etiquetas: acrescenta uma com Enter e salva a lista inteira', async () => {
    const onSave = await montar();
    await clicar(porLabel('Editar etiquetas'));
    const campo = document.body.querySelector('input');
    await digitar(campo, 'vip');
    await tecla(campo, 'Enter');
    await clicar(botao('Salvar'));
    expect(onSave).toHaveBeenCalledWith('tags', ['Quer treinar à noite', 'vip']);
  });

  it('dor: abre a lista com as opções do catálogo e a opção de limpar', async () => {
    await montar();
    await clicar(porLabel('Editar dor'));
    expect(opcoes()).toEqual(['Sem dor', 'Emagrecimento', 'Saúde']);
  });

  it('escolher na lista grava o valor, e a opção de limpar grava null', async () => {
    const onSave = await montar();
    const escolher = async (rotulo, texto) => {
      await clicar(porLabel(rotulo));
      const opcao = [...document.body.querySelectorAll('[role="option"]')].find((o) => o.textContent === texto);
      await tecla(opcao, 'Enter');
    };
    await escolher('Editar dor', 'Saúde');
    expect(onSave).toHaveBeenLastCalledWith('dor', 'Saúde');
    await escolher('Editar dor', 'Sem dor');
    expect(onSave).toHaveBeenLastCalledWith('dor', null);
    expect(document.body.querySelector('[role="listbox"]')).toBeNull();
  });

  it('escolher o valor que já está gravado não grava', async () => {
    const onSave = await montar();
    await clicar(porLabel('Editar dor'));
    const opcao = [...document.body.querySelectorAll('[role="option"]')].find((o) => o.textContent === 'Emagrecimento');
    await tecla(opcao, 'Enter');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('origem vem do catálogo de origens da academia', async () => {
    await montar();
    await clicar(porLabel('Editar origem'));
    expect(opcoes()).toEqual(['Instagram', 'Indicação']);
  });

  it('consultor lista só quem vende, está ativo e tem login', async () => {
    await montar();
    await clicar(porLabel('Editar consultor'));
    expect(opcoes()).toEqual(['Júlia Andrade']);
  });

  it('valor gravado que saiu do catálogo continua na lista, para o campo não abrir em branco', async () => {
    await montar({ lead: { ...LEAD, dor: 'Dor antiga' } });
    await clicar(porLabel('Editar dor'));
    expect(opcoes()).toContain('Dor antiga');
  });
});
