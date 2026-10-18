// @vitest-environment jsdom
// O Contexto comercial da ficha: sete campos, editados no lugar. A gravação em
// si (onSave) é um dublê: o que vale aqui é o que a tela pede para gravar e o
// que ela faz com a resposta.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act, useState } from 'react';
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
  { id: 'u5', name: 'Bruno Prado', authUid: 'a5', active: true, role: 'admin' },
];

let root = null;
const card = (props) => h(GeneralConfigContext.Provider, { value: CONFIG },
  h(ContextCard, { lead: LEAD, sources: SOURCES, usersList: EQUIPE, tagsCatalog: [], canEdit: true, ...props }));
async function montarElemento(elemento) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(elemento); });
}
async function montar({ onSave = vi.fn(async () => true), ...props } = {}) {
  await montarElemento(card({ onSave, ...props }));
  return onSave;
}
const rerender = async (props) => { await act(async () => { root.render(card(props)); }); };
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

// O nome que o leitor de tela lê: o aria-labelledby, ou o texto do botão.
const nome = (el) => {
  const ids = el.getAttribute('aria-labelledby');
  const txt = ids ? ids.split(' ').map((id) => document.getElementById(id)?.textContent || '').join(' ') : el.textContent;
  return txt.replace(/\s+/g, ' ').trim();
};
const campo = (rotulo) => [...document.body.querySelectorAll('button, [role="combobox"]')]
  .find((el) => nome(el).startsWith(`Editar ${rotulo}`)) || null;
const clicar = async (el) => { await act(async () => { el.click(); }); };
const botao = (texto) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === texto) || null;
const opcoes = () => [...document.body.querySelectorAll('[role="option"]')].map((o) => o.textContent);
async function digitar(el, valor) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
  await act(async () => { set.call(el, valor); el.dispatchEvent(new Event('input', { bubbles: true })); });
}
const tecla = async (el, key, extra = {}) => {
  await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra })); });
};
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const abrirLista = async (rotulo) => { await tecla(campo(rotulo), 'Enter'); };
const escolher = async (rotulo, texto) => {
  await abrirLista(rotulo);
  const opcao = [...document.body.querySelectorAll('[role="option"]')].find((o) => o.textContent === texto);
  await tecla(opcao, 'Enter');
  await tick();
};
const caixa = () => document.body.querySelector('textarea');
const campoEtiqueta = () => document.body.querySelector('input[aria-label="Nova etiqueta"]');

describe('ContextCard: leitura', () => {
  it('mostra os sete campos com o que está gravado', async () => {
    await montar();
    const t = document.body.textContent;
    ['Dor', 'Modalidade', 'Origem', 'Consultor', 'Professor', 'Etiquetas', 'Observação'].forEach((rotulo) => expect(t).toContain(rotulo));
    ['Emagrecimento', 'Musculação', 'Instagram', 'Júlia Andrade', 'Marcos Vieira', 'Quer treinar à noite', 'Casamento em dezembro.']
      .forEach((valor) => expect(t).toContain(valor));
  });

  it('o leitor de tela ouve a ação, o rótulo e o valor de cada campo', async () => {
    await montar();
    expect(nome(campo('Dor'))).toBe('Editar Dor Emagrecimento');
    expect(nome(campo('Consultor'))).toBe('Editar Consultor Júlia Andrade');
    expect(nome(campo('Observação'))).toBe('Editar Observação Casamento em dezembro.');
    expect(campo('Dor').getAttribute('role')).toBe('combobox');
    expect(campo('Observação').getAttribute('aria-label')).toBeNull();
  });

  it('campo vazio mostra "Adicionar"', async () => {
    await montar({ lead: { id: 'l2', name: 'Ana', tags: [] } });
    expect(nome(campo('Dor'))).toBe('Editar Dor Adicionar');
    expect(nome(campo('Etiquetas'))).toBe('Editar Etiquetas Adicionar');
  });

  it('sem permissão de editar, é só leitura: sem botão, sem lista, sem dica, e o vazio diz "Não informado"', async () => {
    await montar({ canEdit: false, lead: { ...LEAD, dor: null, tags: [] } });
    expect(document.body.querySelector('button, [role="combobox"]')).toBeNull();
    expect(document.body.textContent).not.toContain('Editar');
    expect(document.body.textContent).not.toContain('Clique em um campo para editar');
    expect(document.body.textContent).not.toContain('Adicionar');
    expect(document.body.textContent).toContain('Não informado');
    expect(document.body.textContent).toContain('Musculação');
  });
});

describe('ContextCard: listas', () => {
  it('dor abre com as opções do catálogo e a de limpar', async () => {
    await montar();
    await abrirLista('Dor');
    expect(opcoes()).toEqual(['Sem dor', 'Emagrecimento', 'Saúde']);
  });

  it('escolher grava o valor, a opção de limpar grava null, e a lista fecha', async () => {
    const onSave = await montar();
    await escolher('Dor', 'Saúde');
    expect(onSave).toHaveBeenLastCalledWith('dor', 'Saúde');
    await escolher('Dor', 'Sem dor');
    expect(onSave).toHaveBeenLastCalledWith('dor', null);
    expect(document.body.querySelector('[role="listbox"]')).toBeNull();
  });

  it('escolher o valor que já está gravado não grava', async () => {
    const onSave = await montar();
    await escolher('Dor', 'Emagrecimento');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('letra com a lista fechada não escolhe nem grava', async () => {
    const onSave = await montar();
    await tecla(campo('Consultor'), 'B');
    await tecla(campo('Dor'), 'S');
    await tick();
    expect(onSave).not.toHaveBeenCalled();
    expect(document.body.querySelector('[role="listbox"]')).toBeNull();
  });

  it('origem vem do catálogo de origens da academia', async () => {
    await montar();
    await abrirLista('Origem');
    expect(opcoes()).toEqual(['Instagram', 'Indicação']);
  });

  it('consultor lista só quem vende, está ativo e tem login', async () => {
    await montar();
    await abrirLista('Consultor');
    expect(opcoes()).toEqual(['Júlia Andrade', 'Bruno Prado']);
  });

  it('valor gravado que saiu do catálogo continua na lista, para o campo não abrir em branco', async () => {
    await montar({ lead: { ...LEAD, dor: 'Dor antiga' } });
    await abrirLista('Dor');
    expect(opcoes()).toContain('Dor antiga');
  });
});

describe('ContextCard: observação', () => {
  it('abre com o foco no texto e o cursor no fim, salva com o valor da abertura, fecha e devolve o foco', async () => {
    const onSave = await montar();
    await clicar(campo('Observação'));
    expect(document.activeElement).toBe(caixa());
    expect(caixa().selectionStart).toBe('Casamento em dezembro.'.length);
    await digitar(caixa(), 'Casamento adiado para janeiro.');
    await clicar(botao('Salvar'));
    expect(onSave).toHaveBeenCalledWith('observation', 'Casamento adiado para janeiro.', 'Casamento em dezembro.');
    expect(caixa()).toBeNull();
    expect(document.activeElement).toBe(campo('Observação'));
  });

  it('Ctrl mais Enter salva e Esc cancela', async () => {
    const onSave = await montar();
    await clicar(campo('Observação'));
    await digitar(caixa(), 'Novo texto');
    await tecla(caixa(), 'Enter', { ctrlKey: true });
    expect(onSave).toHaveBeenCalledWith('observation', 'Novo texto', 'Casamento em dezembro.');
    await clicar(campo('Observação'));
    await tecla(caixa(), 'Escape');
    expect(caixa()).toBeNull();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('salvar sem mudar nada só fecha, mesmo que outra aba tenha gravado outro texto', async () => {
    const onSave = await montar();
    await clicar(campo('Observação'));
    await rerender({ onSave, lead: { ...LEAD, observation: 'Texto que chegou de outra aba.' } });
    await clicar(botao('Salvar'));
    expect(onSave).not.toHaveBeenCalled();
    expect(caixa()).toBeNull();
  });

  it('cancelar não grava', async () => {
    const onSave = await montar();
    await clicar(campo('Observação'));
    await digitar(caixa(), 'Mudei de ideia');
    await clicar(botao('Cancelar'));
    expect(onSave).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Casamento em dezembro.');
  });

  it('se a gravação falha, o editor continua aberto com o texto, e o foco volta a ele', async () => {
    const onSave = vi.fn(async () => false);
    await montar({ onSave });
    await clicar(campo('Observação'));
    await digitar(caixa(), 'Texto que não gravou');
    await clicar(botao('Salvar'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(caixa().value).toBe('Texto que não gravou');
    expect(document.activeElement).toBe(caixa());
  });
});

describe('ContextCard: etiquetas', () => {
  it('o foco vai para o campo de digitar, que tem nome, e a dica do Enter fica à vista', async () => {
    await montar();
    await clicar(campo('Etiquetas'));
    expect(document.activeElement).toBe(campoEtiqueta());
    expect(document.body.querySelector('[aria-label="Remover Quer treinar à noite"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Enter acrescenta a etiqueta');
  });

  it('acrescenta uma com Enter e salva a lista, com a da abertura', async () => {
    const onSave = await montar();
    await clicar(campo('Etiquetas'));
    await digitar(campoEtiqueta(), 'vip');
    await tecla(campoEtiqueta(), 'Enter');
    await clicar(botao('Salvar'));
    expect(onSave).toHaveBeenCalledWith('tags', ['Quer treinar à noite', 'vip'], ['Quer treinar à noite']);
  });

  it('a etiqueta digitada sem Enter entra no Salvar', async () => {
    const onSave = await montar();
    await clicar(campo('Etiquetas'));
    await digitar(campoEtiqueta(), 'noite ');
    await clicar(botao('Salvar'));
    expect(onSave).toHaveBeenCalledWith('tags', ['Quer treinar à noite', 'noite'], ['Quer treinar à noite']);
  });

  it('salvar sem mexer não grava, nem apaga a etiqueta que outra aba pôs', async () => {
    const onSave = await montar();
    await clicar(campo('Etiquetas'));
    await rerender({ onSave, lead: { ...LEAD, tags: ['Quer treinar à noite', 'vip'] } });
    await clicar(botao('Salvar'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('Esc cancela e devolve o foco', async () => {
    const onSave = await montar();
    await clicar(campo('Etiquetas'));
    await digitar(campoEtiqueta(), 'vip');
    await tecla(campoEtiqueta(), 'Escape');
    expect(campoEtiqueta()).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(campo('Etiquetas'));
  });
});

describe('ContextCard: rascunho e gravação lenta', () => {
  it('a resposta lenta não fecha o editor de outro campo aberto depois', async () => {
    let terminar;
    const onSave = vi.fn(() => new Promise((r) => { terminar = r; }));
    await montar({ onSave });
    await clicar(campo('Etiquetas'));
    await digitar(campoEtiqueta(), 'vip');
    await clicar(botao('Salvar'));
    await tecla(campoEtiqueta(), 'Escape');
    await clicar(campo('Observação'));
    await act(async () => { terminar(true); });
    expect(caixa()).not.toBeNull();
  });

  it('reabrir o mesmo campo durante a gravação lenta não perde o texto novo', async () => {
    let terminar;
    const onSave = vi.fn(() => new Promise((r) => { terminar = r; }));
    await montar({ onSave });
    await clicar(campo('Observação'));
    await digitar(caixa(), 'Primeiro texto');
    await clicar(botao('Salvar'));
    await tecla(caixa(), 'Escape');
    await clicar(campo('Observação'));
    await digitar(caixa(), 'Segundo texto, ainda digitando');
    await act(async () => { terminar(true); });
    expect(caixa()?.value).toBe('Segundo texto, ainda digitando');
  });

  it('trocar de campo com o rascunho mudado pergunta antes de descartar', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await montar();
    await clicar(campo('Observação'));
    await digitar(caixa(), 'Alergia a amendoim');
    await clicar(campo('Etiquetas'));
    expect(confirmar).toHaveBeenCalledWith('Descartar a alteração em observação?');
    expect(caixa().value).toBe('Alergia a amendoim');
    expect(document.activeElement).toBe(caixa());
    confirmar.mockReturnValue(true);
    await clicar(campo('Etiquetas'));
    expect(caixa()).toBeNull();
    expect(campoEtiqueta()).not.toBeNull();
  });

  it('trocar de campo sem ter mudado nada não pergunta', async () => {
    const confirmar = vi.spyOn(window, 'confirm');
    await montar();
    await clicar(campo('Observação'));
    await clicar(campo('Etiquetas'));
    expect(confirmar).not.toHaveBeenCalled();
    expect(campoEtiqueta()).not.toBeNull();
  });

  it('com o editor guardado fora do card, o rascunho sobrevive ao card sair da tela e voltar', async () => {
    // O estado mora na casca, que fica montada: só o card sai, como na troca de aba da ficha.
    function Casca() {
      const [aberto, setAberto] = useState(true);
      const [edit, setEdit] = useState(null);
      return h('div', null,
        h('button', { type: 'button', onClick: () => setAberto((v) => !v) }, 'Trocar de aba'),
        aberto ? card({ onSave: async () => true, edit, setEdit }) : h('p', null, 'Contratos'));
    }
    await montarElemento(h(Casca));
    await clicar(campo('Observação'));
    await digitar(caixa(), 'Rascunho guardado');
    await clicar(botao('Trocar de aba'));
    expect(caixa()).toBeNull();
    await clicar(botao('Trocar de aba'));
    expect(caixa().value).toBe('Rascunho guardado');
    // Na volta, o editor não rouba o foco.
    expect(document.activeElement).not.toBe(caixa());
  });
});
