// @vitest-environment jsdom
// O Remarcar da Meta (RescheduleModal) só aceita data e hora futuras. Antes o
// campo aceitava o passado: um dia digitado errado virava Atrasado e ainda
// fechava a tarefa de hoje.
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastContext } from '../../contexts/ToastContext.jsx';

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter',
  DAILY_GOAL_HISTORY_PATH: 'hist', db: {}, auth: {}, storage: {},
  ROUTINE_MODELS_PATH: 'rotina_modelos', ROUTINE_VERSIONS_PATH: 'rotina_versoes', ROUTINE_MARKS_PATH: 'rotina_marcas',
}));

const { RescheduleModal } = await import('../../views/DailyGoalView.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const lead = { id: 'l1', name: 'Mateus Brandão', appointmentType: 'visita' };

let root = null;
async function montar(currentDate) {
  const onConfirm = vi.fn(async () => {});
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(ToastContext.Provider, { value: toast },
      h(RescheduleModal, { lead, categorySlug: 'visita_hoje', currentDate, currentType: 'visita', onConfirm, onClose: () => {} })));
  });
  return onConfirm;
}
const confirmar = () => document.querySelector('button[type="submit"]');

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  vi.clearAllMocks();
});

describe('RescheduleModal: só data e hora futuras', () => {
  // Sexta, 16/10/2026, 14:00.
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 16, 14, 0)); });
  afterAll(() => { vi.useRealTimers(); });

  it('a data no passado desliga o botão, diz o motivo e não grava', async () => {
    // Visita de anteontem às 16:30: a sugestão é o dia seguinte a ela, ontem.
    const onConfirm = await montar(new Date(2026, 9, 14, 16, 30));
    expect(confirmar().disabled).toBe(true);
    expect(document.body.textContent).toContain('Escolha uma data e hora futuras.');
    // O envio confere de novo, mesmo que o formulário seja enviado.
    await act(async () => {
      confirmar().closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith('Escolha uma data e hora futuras.');
  });

  it('a data futura grava', async () => {
    // Visita de hoje às 16:30: a sugestão é amanhã no mesmo horário.
    const onConfirm = await montar(new Date(2026, 9, 16, 16, 30));
    expect(confirmar().disabled).toBe(false);
    await act(async () => { confirmar().click(); });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toEqual(new Date(2026, 9, 17, 16, 30));
  });
});
