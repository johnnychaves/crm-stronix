// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h, useState, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ProfileComposer } from '../../components/profile/ProfileComposer.jsx';
import { EMPTY_DRAFTS } from '../quickTexts.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const BASE = {
  appUser: { id: 'u1', name: 'Júlia Andrade' },
  firstName: 'Rafael',
  lastText: null,
  canMudarFase: true,
  loading: false,
  renderStatus: () => h('div', null, 'PASSOS DA FASE'),
  renderSchedule: () => h('div', null, 'PASSOS DO AGENDAMENTO'),
};

let root = null;
// A ficha é quem guarda se o compositor está aberto, em que modo e os rascunhos
// (a aba da ficha desmonta o compositor, e o texto digitado não pode ir junto).
// O harness faz o mesmo, e o botão "alternar" desmonta e monta o compositor.
function Harness({ onSubmitText, ...props }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('note');
  const [drafts, setDrafts] = useState(EMPTY_DRAFTS);
  const [shown, setShown] = useState(true);
  return h('div', null,
    h('button', { type: 'button', onClick: () => setShown((v) => !v) }, 'alternar'),
    shown && h(ProfileComposer, {
      ...BASE, ...props, open, mode, onSubmitText, drafts, onDrafts: setDrafts,
      onOpen: (m) => { setMode(m); setOpen(true); },
      onClose: () => setOpen(false),
    }));
}
async function montar(props = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const onSubmitText = props.onSubmitText || vi.fn(async () => true);
  await act(async () => { root.render(h(Harness, { ...props, onSubmitText })); });
  return onSubmitText;
}
beforeEach(() => { window.confirm = vi.fn(() => true); });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

const botao = (texto) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === texto) || null;
const clicar = async (el) => { await act(async () => { el.click(); }); };
const caixa = () => document.body.querySelector('textarea');
async function digitar(el, valor) {
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  await act(async () => { set.call(el, valor); el.dispatchEvent(new Event('input', { bubbles: true })); });
}
const ctrlEnter = async (el) => {
  await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })); });
};
const abrir = async () => clicar(botao('Registrar o que aconteceu com Rafael'));

describe('ProfileComposer fechado', () => {
  it('é uma linha só, com um ícone para cada modo', async () => {
    await montar();
    expect(botao('Registrar o que aconteceu com Rafael')).not.toBeNull();
    ['Anotação', 'WhatsApp', 'Ligação', 'Mudar fase', 'Agendar'].forEach((m) => expect(botao(m), m).not.toBeNull());
    expect(caixa()).toBeNull();
  });

  it('quem não muda fase não tem o ícone Mudar fase', async () => {
    await montar({ canMudarFase: false });
    expect(botao('Mudar fase')).toBeNull();
    ['Anotação', 'WhatsApp', 'Ligação', 'Agendar'].forEach((m) => expect(botao(m), m).not.toBeNull());
  });

  it('clicar na linha abre a Anotação', async () => {
    await montar();
    await abrir();
    expect(caixa()).not.toBeNull();
    expect(caixa().getAttribute('placeholder')).toContain('O que aconteceu na conversa?');
  });

  it('o ícone Agendar abre o assistente de agendamento', async () => {
    await montar();
    await clicar(botao('Agendar'));
    expect(document.body.textContent).toContain('PASSOS DO AGENDAMENTO');
    expect(caixa()).toBeNull();
  });
});

describe('ProfileComposer aberto, modos de texto', () => {
  it('a Anotação tem atalhos, e o atalho entra na caixa, o seguinte na linha de baixo', async () => {
    await montar();
    await abrir();
    await clicar(botao('Vai pensar'));
    expect(caixa().value).toBe('Vai pensar');
    await clicar(botao('Pediu desconto'));
    expect(caixa().value).toBe('Vai pensar\nPediu desconto');
  });

  it('o WhatsApp não tem atalhos, e o botão diz que envia', async () => {
    await montar();
    await clicar(botao('WhatsApp'));
    expect(botao('Vai pensar')).toBeNull();
    expect(botao('Não atendeu')).toBeNull();
    expect(botao('Enviar pelo WhatsApp')).not.toBeNull();
    expect(caixa().getAttribute('placeholder')).toBe('Mensagem para Rafael');
  });

  it('a Ligação tem os atalhos dela', async () => {
    await montar();
    await clicar(botao('Ligação'));
    expect(botao('Não atendeu')).not.toBeNull();
    expect(botao('Vai pensar')).toBeNull();
    expect(botao('Registrar ligação')).not.toBeNull();
  });

  it('cada modo tem o próprio rascunho: o texto da Anotação não vai para a Ligação', async () => {
    await montar();
    await abrir();
    await digitar(caixa(), 'Texto da anotação');
    await clicar(botao('Ligação'));
    expect(caixa().value).toBe('');
    await digitar(caixa(), 'Texto da ligação');
    await clicar(botao('Anotação'));
    expect(caixa().value).toBe('Texto da anotação');
    await clicar(botao('Ligação'));
    expect(caixa().value).toBe('Texto da ligação');
  });

  it('o rascunho sobrevive a o compositor sair da tela e voltar (troca de aba da ficha)', async () => {
    await montar();
    await abrir();
    await digitar(caixa(), 'Não pode sumir');
    await clicar(botao('alternar'));
    expect(caixa()).toBeNull();
    await clicar(botao('alternar'));
    expect(caixa().value).toBe('Não pode sumir');
  });

  it('o WhatsApp de um menor de idade fala com o responsável', async () => {
    await montar({ whatsappName: 'Ana' });
    await clicar(botao('WhatsApp'));
    expect(caixa().getAttribute('placeholder')).toBe('Mensagem para Ana');
  });

  it('a dica de campo vazio não acompanha a pessoa para outro modo', async () => {
    await montar();
    await abrir();
    await clicar(botao('Registrar anotação'));
    expect(document.body.querySelector('[role="status"]').textContent).toBe('Escreva a anotação antes de registrar.');
    await clicar(botao('Ligação'));
    expect(document.body.querySelector('[role="status"]').textContent).toBe('');
  });

  it('registrar com a caixa vazia mostra a dica e não chama a gravação', async () => {
    const onSubmitText = await montar();
    await abrir();
    await clicar(botao('Registrar anotação'));
    expect(onSubmitText).not.toHaveBeenCalled();
    expect(document.body.querySelector('[role="status"]').textContent).toBe('Escreva a anotação antes de registrar.');
  });

  it('Ctrl mais Enter registra o texto aparado no modo atual', async () => {
    const onSubmitText = await montar();
    await abrir();
    await clicar(botao('Ligação'));
    await digitar(caixa(), '  Não atendeu  ');
    await ctrlEnter(caixa());
    expect(onSubmitText).toHaveBeenCalledWith('call', 'Não atendeu');
  });

  it('gravou: a caixa esvazia. Não gravou: o texto fica', async () => {
    const onSubmitText = vi.fn(async () => true);
    await montar({ onSubmitText });
    await abrir();
    await digitar(caixa(), 'Primeira');
    await clicar(botao('Registrar anotação'));
    expect(caixa().value).toBe('');

    onSubmitText.mockResolvedValueOnce(false);
    await digitar(caixa(), 'Segunda');
    await clicar(botao('Registrar anotação'));
    expect(caixa().value).toBe('Segunda');
  });

  it('mostra o último registro, sem o link do histórico', async () => {
    await montar({ lastText: { id: 'a', label: 'Anotação', date: new Date(2026, 9, 14, 10), text: 'Pediu para ligar depois.' } });
    await abrir();
    expect(document.body.textContent).toContain('Anotação, 14/10');
    expect(document.body.textContent).toContain('Pediu para ligar depois.');
  });
});

describe('ProfileComposer, fechar', () => {
  it('Cancelar sem texto fecha sem perguntar', async () => {
    await montar();
    await abrir();
    await clicar(botao('Cancelar'));
    expect(window.confirm).not.toHaveBeenCalled();
    expect(caixa()).toBeNull();
    expect(botao('Registrar o que aconteceu com Rafael')).not.toBeNull();
  });

  it('Cancelar com texto pergunta, e "não" mantém o texto e o compositor aberto', async () => {
    window.confirm = vi.fn(() => false);
    await montar();
    await abrir();
    await digitar(caixa(), 'Não quero perder');
    await clicar(botao('Cancelar'));
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(caixa().value).toBe('Não quero perder');
  });

  it('Cancelar com texto e "sim" descarta o texto e fecha', async () => {
    await montar();
    await abrir();
    await digitar(caixa(), 'Pode descartar');
    await clicar(botao('Cancelar'));
    expect(caixa()).toBeNull();
    await abrir();
    expect(caixa().value).toBe('');
  });

  it('texto em outro modo também conta para a pergunta', async () => {
    await montar();
    await abrir();
    await digitar(caixa(), 'Na anotação');
    await clicar(botao('Ligação'));
    await clicar(botao('Cancelar'));
    expect(window.confirm).toHaveBeenCalledTimes(1);
  });
});

describe('ProfileComposer, assistentes', () => {
  it('Mudar fase e Agendar mostram o assistente que a ficha entrega', async () => {
    await montar();
    await clicar(botao('Mudar fase'));
    expect(document.body.textContent).toContain('PASSOS DA FASE');
    await clicar(botao('Agendar'));
    expect(document.body.textContent).toContain('PASSOS DO AGENDAMENTO');
  });

  it('sem permissão para mudar fase, o modo não existe na linha de modos', async () => {
    await montar({ canMudarFase: false });
    await abrir();
    expect(botao('Mudar fase')).toBeNull();
    expect(botao('Agendar')).not.toBeNull();
  });
});

// Gravação lenta (rede ruim): o texto que a pessoa mexeu enquanto gravava não
// pode sumir quando a gravação termina, e o Ctrl e Enter não grava duas vezes.
describe('ProfileComposer, gravação lenta', () => {
  const pendente = () => {
    let resolver;
    const fn = vi.fn(() => new Promise((r) => { resolver = r; }));
    return { fn, terminar: async (ok) => { await act(async () => { resolver(ok); }); } };
  };

  it('Ctrl e Enter de novo durante a gravação não grava duas vezes', async () => {
    const { fn, terminar } = pendente();
    await montar({ onSubmitText: fn });
    await abrir();
    await digitar(caixa(), 'Vai pensar');
    await ctrlEnter(caixa());
    await ctrlEnter(caixa());
    await clicar(botao('Registrar anotação'));
    expect(fn).toHaveBeenCalledTimes(1);
    await terminar(true);
  });

  it('o texto mudado durante a gravação fica na caixa quando ela termina', async () => {
    const { fn, terminar } = pendente();
    await montar({ onSubmitText: fn });
    await abrir();
    await digitar(caixa(), 'Primeira parte');
    await ctrlEnter(caixa());
    await digitar(caixa(), 'Primeira parte e mais um pedaço');
    await terminar(true);
    expect(caixa().value).toBe('Primeira parte e mais um pedaço');
  });

  it('trocar de modo durante a gravação não perde o texto do outro modo', async () => {
    const { fn, terminar } = pendente();
    await montar({ onSubmitText: fn });
    await abrir();
    await digitar(caixa(), 'Anotação enviada');
    await ctrlEnter(caixa());
    await clicar(botao('Ligação'));
    await digitar(caixa(), 'Texto da ligação');
    await terminar(true);
    expect(caixa().value).toBe('Texto da ligação');
    // A anotação foi gravada, então o rascunho dela esvazia.
    await clicar(botao('Anotação'));
    expect(caixa().value).toBe('');
  });

  it('com a ficha gravando, a caixa fica só de leitura e os modos e atalhos ficam desligados', async () => {
    await montar({ loading: true });
    await abrir();
    expect(caixa().readOnly).toBe(true);
    ['Anotação', 'WhatsApp', 'Ligação', 'Mudar fase', 'Agendar'].forEach((m) => expect(botao(m).disabled, m).toBe(true));
    expect(botao('Vai pensar').disabled).toBe(true);
  });
});

// O foco nunca cai no body: ao fechar, ele volta para a linha fechada.
describe('ProfileComposer, foco', () => {
  const linha = () => botao('Registrar o que aconteceu com Rafael');

  it('Cancelar sem texto devolve o foco à linha fechada', async () => {
    await montar();
    await abrir();
    expect(document.activeElement).toBe(caixa());
    await clicar(botao('Cancelar'));
    expect(document.activeElement).toBe(linha());
  });

  it('Cancelar com texto e "sim" também devolve o foco à linha fechada', async () => {
    await montar();
    await abrir();
    await digitar(caixa(), 'Pode descartar');
    await clicar(botao('Cancelar'));
    expect(document.activeElement).toBe(linha());
  });

  it('fechar com o foco em outro lugar da tela não o puxa de volta', async () => {
    const fora = document.createElement('input');
    document.body.appendChild(fora);
    await montar();
    await abrir();
    fora.focus();
    await clicar(botao('Cancelar'));
    expect(document.activeElement).toBe(fora);
  });
});
