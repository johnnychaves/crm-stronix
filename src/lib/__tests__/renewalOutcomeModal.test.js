// @vitest-environment jsdom
// O pop-up da Renovação e dos Vencidos da Meta Diária, na família nova: o
// Renovou não grava nada (a Meta abre o ContractModal), o "Não vai renovar"
// exige o motivo da lista e o Reagendar exige o motivo escrito e o horário
// futuro. Nota, marca e patch vão num batch só. O logInteractions é um dublê.
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastContext } from '../../contexts/ToastContext.jsx';

vi.mock('../interactions.js', () => ({
  logInteraction: vi.fn(async () => 'i1'),
  logInteractions: vi.fn(async (db, lead, user, payloads) => payloads.map((_, n) => `i${n + 1}`)),
}));
const { logInteractions } = await import('../interactions.js');
const { RenewalOutcomeModal } = await import('../../modals/RenewalOutcomeModal.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const ana = { id: 'u-ana', name: 'Ana', authUid: 'auth-ana' };
const cliente = {
  id: 'c1', name: 'Paula Reis', consultantId: 'u-ana', lifecycleStage: 'cliente', status: 'Venda',
  currentPlanName: 'Musculação anual', currentContractEndsAt: new Date(2026, 10, 15), renewalHandledCheckpoints: [],
};

let root = null;
async function montar(extra = {}) {
  const onDone = vi.fn();
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(ToastContext.Provider, { value: toast },
      h(RenewalOutcomeModal, { lead: cliente, appUser: ana, db: {}, activeCheckpoint: 30, onClose: () => {}, onDone, ...extra })));
  });
  return { onDone };
}
const botao = (rotulo) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
const clicar = async (rotulo) => { await act(async () => { botao(rotulo).click(); }); };
const escolher = async (rotulo) => {
  const card = [...document.querySelectorAll('[role="radio"]')].find((b) => b.textContent.startsWith(rotulo));
  await act(async () => { card.click(); });
};
const escrever = async (campo, texto) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  await act(async () => {
    setter.call(campo, texto);
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const status = () => document.querySelector('[role="status"]').textContent;

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  vi.clearAllMocks();
});

describe('RenewalOutcomeModal', () => {
  // Sexta, 16/10/2026, 14:00.
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 16, 14, 0)); });
  afterAll(() => { vi.useRealTimers(); });

  it('mostra o plano, o vencimento e o marco, e o Renovou só devolve o desfecho', async () => {
    const { onDone } = await montar();
    expect(document.body.textContent).toContain('Renovação de contrato');
    expect(document.body.textContent).toContain('Musculação anual · vence em 15/11/2026');
    expect(document.body.textContent).toContain('Marco de 30 dias');
    await clicar('Renovar');
    expect(onDone).toHaveBeenCalledWith('renovou');
    expect(logInteractions).not.toHaveBeenCalled();
  });

  it('o "Não vai renovar" exige o motivo da lista, e o botão é o vermelho', async () => {
    const { onDone } = await montar();
    await escolher('Não vai renovar');
    expect(status()).toBe('Escolha o motivo da perda.');
    const registrar = botao('Registrar perda');
    expect(registrar.disabled).toBe(true);
    expect(registrar.className).toContain('bg-rose-600');
    await clicar('Financeiro');
    await clicar('+ Adicionar observação');
    await escrever(document.querySelector('textarea'), 'Vai voltar em março.');
    await clicar('Registrar perda');
    expect(logInteractions).toHaveBeenCalledTimes(1);
    const [, , , payloads, patch] = logInteractions.mock.calls[0];
    expect(payloads.map((p) => p.type)).toEqual(['note', 'daily_goal_done']);
    expect(payloads[0]).toMatchObject({ text: 'Motivo da perda de renovação: Financeiro. Vai voltar em março.', renewalDeclineReason: 'Financeiro' });
    expect(payloads[1]).toMatchObject({ dailyGoalCategory: 'renovacao' });
    expect(patch).toMatchObject({ renewalDeclined: true });
    expect(onDone).toHaveBeenCalledWith('nao_renova');
  });

  it('o Reagendar exige o motivo e grava o contato de amanhã às 09:00', async () => {
    await montar();
    await escolher('Reagendar contato');
    expect(status()).toBe('Escreva o motivo do reagendamento.');
    await clicar('Pediu para ligar depois');
    await clicar('Reagendar');
    const [, , , payloads, patch] = logInteractions.mock.calls[0];
    expect(payloads[0].text).toContain('Motivo do reagendamento: Pediu para ligar depois');
    expect(patch).toMatchObject({ nextFollowUp: new Date(2026, 9, 17, 9, 0), renewalHandledCheckpoints: [30] });
  });

  it('o Vencido troca o vocabulário e mostra há quanto tempo venceu', async () => {
    await montar({ variant: 'vencido', activeCheckpoint: null, lead: { ...cliente, currentContractEndsAt: new Date(2026, 9, 13) } });
    expect(document.body.textContent).toContain('Contrato vencido');
    expect(document.body.textContent).toContain('venceu em 13/10/2026');
    expect(document.body.textContent).toContain('Venceu há 3 dias');
    expect(botao('Reativar')).toBeTruthy();
    await escolher('Não vai voltar');
    await clicar('Mudou de cidade');
    await clicar('Registrar perda');
    expect(logInteractions.mock.calls[0][3][1]).toMatchObject({ dailyGoalCategory: 'vencido' });
  });

  it('abre no Reagendar quando o card pede', async () => {
    await montar({ initialOutcome: 'reagendar' });
    expect(document.activeElement.textContent.startsWith('Reagendar contato')).toBe(true);
    expect(botao('Reagendar')).toBeTruthy();
  });
});
