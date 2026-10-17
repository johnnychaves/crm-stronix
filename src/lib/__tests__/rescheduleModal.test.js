// @vitest-environment jsdom
// O Remarcar da Meta (RescheduleModal) e o "Agendar próxima tentativa" do Não
// compareceu: só aceitam data e hora futuras (antes um dia digitado errado
// virava Atrasado e ainda fechava a tarefa de hoje), sugerem amanhã no horário
// do agendamento e mostram o que já vem do lead numa linha com "Alterar".
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastContext } from '../../contexts/ToastContext.jsx';

const { RescheduleModal } = await import('../../modals/RescheduleModal.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const lead = { id: 'l1', name: 'Mateus Brandão', appointmentType: 'visita' };

let root = null;
async function montar(currentDate, extra = {}) {
  const onConfirm = vi.fn(async () => {});
  const onClose = vi.fn();
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(ToastContext.Provider, { value: toast },
      h(RescheduleModal, { lead, categorySlug: 'visita_hoje', currentDate, currentType: 'visita', onConfirm, onClose, ...extra })));
  });
  return { onConfirm, onClose };
}
const botao = (rotulo) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
const clicar = async (rotulo) => { await act(async () => { botao(rotulo).click(); }); };
const status = () => document.querySelector('[role="status"]').textContent;
const digitarHora = async (valor) => {
  const hora = document.querySelector('input[type="time"]');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setter.call(hora, valor);
    hora.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  vi.clearAllMocks();
});

describe('RescheduleModal', () => {
  // Sexta, 16/10/2026, 14:00.
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 16, 14, 0)); });
  afterAll(() => { vi.useRealTimers(); });

  it('sugere amanhã no horário da visita, e a confirmação grava esse instante', async () => {
    const { onConfirm } = await montar(new Date(2026, 9, 16, 16, 30));
    expect(document.querySelector('[role="dialog"]').textContent).toContain('Remarcar visita');
    expect(document.body.textContent).toContain('Visita marcada para hoje às 16:30');
    expect(document.body.textContent).toContain('Mateus volta à sua Meta no sábado, 17/10, às 16:30.');
    // O foco abre no atalho escolhido.
    expect(document.activeElement.textContent).toBe('Amanhã');
    await clicar('Remarcar');
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const [data, nota, tipo] = onConfirm.mock.calls[0];
    expect(data).toEqual(new Date(2026, 9, 17, 16, 30));
    expect([nota, tipo]).toEqual(['', 'visita']);
  });

  it('o horário que já passou desliga o botão e o rodapé diz por quê', async () => {
    const { onConfirm } = await montar(new Date(2026, 9, 16, 16, 30));
    await clicar('Hoje');
    await digitarHora('09:00');
    expect(botao('Remarcar').disabled).toBe(true);
    expect(status()).toBe('Escolha um dia e horário futuros.');
    expect(document.body.textContent).toContain('Esse horário já passou.');
    await clicar('Remarcar');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('o envio confere de novo no relógio: o pop-up aberto há muito tempo não grava o passado', async () => {
    const { onConfirm } = await montar(new Date(2026, 9, 16, 16, 30));
    await clicar('Hoje');
    await digitarHora('14:05');
    expect(botao('Remarcar').disabled).toBe(false);
    vi.setSystemTime(new Date(2026, 9, 16, 14, 10));
    await clicar('Remarcar');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith('Escolha uma data e hora futuras.');
    vi.setSystemTime(new Date(2026, 9, 16, 14, 0));
  });

  it('depois do Não compareceu, é o "Agendar próxima tentativa", com o Agora não', async () => {
    const { onClose } = await montar(new Date(2026, 9, 16, 16, 30), { flow: 'after_no_show' });
    expect(document.body.textContent).toContain('Agendar próxima tentativa');
    expect(document.body.textContent).toContain('Não compareceu hoje às 16:30');
    expect(botao('Agendar tentativa')).toBeTruthy();
    await clicar('Agora não');
    expect(onClose).toHaveBeenCalled();
  });

  it('o Alterar troca a visita por aula experimental, que vai na gravação', async () => {
    const { onConfirm } = await montar(new Date(2026, 9, 16, 16, 30));
    expect(document.querySelector('select')).toBeNull();
    await clicar('Alterar');
    const aula = [...document.querySelectorAll('[role="radio"]')].find((b) => b.textContent === 'Aula experimental');
    await act(async () => { aula.click(); });
    expect(document.body.textContent).toContain('Remarcar aula experimental');
    expect(document.querySelectorAll('select')).toHaveLength(3);
    await clicar('Pronto');
    expect(document.body.textContent).toContain('Sem modalidade · sem professor · 1 aula');
    await clicar('Remarcar');
    expect(onConfirm.mock.calls[0][2]).toBe('aula_experimental');
  });

  it('a observação fica atrás do "+ Adicionar observação" e vai na gravação', async () => {
    const { onConfirm } = await montar(new Date(2026, 9, 16, 16, 30));
    expect(document.querySelector('textarea')).toBeNull();
    await clicar('+ Adicionar observação');
    const campo = document.querySelector('textarea');
    expect(document.activeElement).toBe(campo);
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    await act(async () => {
      setter.call(campo, 'Prefere de manhã');
      campo.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await clicar('Remarcar');
    expect(onConfirm.mock.calls[0][1]).toBe('Prefere de manhã');
  });

  it('Esc fecha', async () => {
    const { onClose } = await montar(new Date(2026, 9, 16, 16, 30));
    await act(async () => {
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalled();
  });
});
