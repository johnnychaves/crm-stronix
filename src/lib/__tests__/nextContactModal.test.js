// @vitest-environment jsdom
// O "Quando voltar a falar?" da Meta, depois do Compareceu e do Cancelou: agenda
// o próximo contato no futuro, ou fecha sem nenhum. Antes os atalhos gravavam
// no clique, com a hora de agora, e o campo de data aceitava o passado.
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastContext } from '../../contexts/ToastContext.jsx';

const { NextContactModal } = await import('../../modals/NextContactModal.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const lead = { id: 'l1', name: 'Mateus Brandão' };

let root = null;
async function montar() {
  const onPick = vi.fn(async () => {});
  const onSkip = vi.fn(async () => {});
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(ToastContext.Provider, { value: toast },
      h(NextContactModal, { lead, contextLabel: 'Comparecimento registrado', onPick, onSkip, onClose: () => {} })));
  });
  return { onPick, onSkip };
}
const botao = (rotulo) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
const clicar = async (rotulo) => { await act(async () => { botao(rotulo).click(); }); };

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  vi.clearAllMocks();
});

describe('NextContactModal', () => {
  // Sexta, 16/10/2026, 14:00.
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 16, 14, 0)); });
  afterAll(() => { vi.useRealTimers(); });

  it('pergunta pelo primeiro nome e agenda amanhã às 09:00', async () => {
    const { onPick } = await montar();
    expect(document.body.textContent).toContain('Quando voltar a falar com Mateus?');
    expect(document.body.textContent).toContain('Comparecimento registrado');
    await clicar('Agendar contato');
    expect(onPick).toHaveBeenCalledWith(new Date(2026, 9, 17, 9, 0), '');
  });

  it('o atalho só escolhe o dia, e a gravação espera o botão', async () => {
    const { onPick } = await montar();
    await clicar('Em 7 dias');
    expect(onPick).not.toHaveBeenCalled();
    await clicar('Agendar contato');
    expect(onPick).toHaveBeenCalledWith(new Date(2026, 9, 23, 9, 0), '');
  });

  it('"Sem próximo contato" fecha sem agendar', async () => {
    const { onPick, onSkip } = await montar();
    await clicar('Sem próximo contato');
    expect(onSkip).toHaveBeenCalledWith('');
    expect(onPick).not.toHaveBeenCalled();
  });

  // Decisão do Johnny em 21/10/2026: o próximo contato vale a partir de amanhã.
  it('não oferece hoje: o dia de hoje deixa o botão desligado e o rodapé diz por quê', async () => {
    const { onPick } = await montar();
    expect(botao('Hoje')).toBeUndefined();
    await clicar('Outro dia');
    const dia = document.querySelector('input[type="date"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    await act(async () => {
      setter.call(dia, '2026-10-16');
      dia.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(botao('Agendar contato').disabled).toBe(true);
    expect(document.querySelector('[role="status"]').textContent).toBe('Escolha um dia a partir de amanhã.');
    await clicar('Agendar contato');
    expect(onPick).not.toHaveBeenCalled();
  });
});
