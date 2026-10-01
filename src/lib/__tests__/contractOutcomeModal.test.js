// @vitest-environment jsdom
// O ContractOutcomeModal sabe em que contrato age (revisão de 30/09/2026): o
// último contrato (currentContractId) grava o resumo do lead como sempre; o
// contrato em uso, com a renovação marcada, grava só o bloco "em uso", nunca
// desfaz renovação e tira a marca de emendada da renovação no mesmo batch. O
// modal é renderizado de verdade em jsdom (o Dialog vai para um portal, então
// renderToString não serve), clicado, e o que vai para o commitContractPatch,
// aqui um dublê, é conferido.
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastContext } from '../../contexts/ToastContext.jsx';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';

vi.mock('../contractsWrites.js', () => ({ commitContractPatch: vi.fn(async () => {}) }));
const { commitContractPatch } = await import('../contractsWrites.js');
const { ContractOutcomeModal } = await import('../../modals/ContractOutcomeModal.jsx');
const { CLEAR_IN_USE_BLOCK } = await import('../contracts.js');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const D = (y, m, d) => new Date(y, m - 1, d);
const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const appUser = { id: 'u1', name: 'Bruno', authUid: 'auth-1' };

// O Start em uso (11/10/2025 a 11/10/2026) e o Flow, a renovação emendada
// marcada para 12/10/2026. Hoje é 30/09/2026.
const start = { id: 'k1', leadId: 'l1', planName: 'Start', value: 1200, durationMonths: 12, status: 'ativo', startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11), createdAt: D(2025, 10, 9) };
const flow = { id: 'k2', leadId: 'l1', planName: 'Flow', value: 1788, durationMonths: 12, status: 'ativo', renewedFromId: 'k1', seamless: true, startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12), createdAt: D(2026, 9, 28) };
const leadCom = (atual) => ({
  id: 'l1', name: 'Ana Lima', currentContractId: atual.id, currentPlanName: atual.planName, currentContractValue: atual.value,
  currentContractStartsAt: atual.startsAt, currentContractEndsAt: atual.endsAt, currentContractStatus: atual.status, currentContractSeamless: Boolean(atual.seamless)
});

let root = null;
async function montar({ lead, contract, contratos, action }) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(ToastContext.Provider, { value: toast },
      h(GeneralConfigContext.Provider, { value: { contratos } },
        h(ContractOutcomeModal, { lead, appUser, db: {}, contract, action, onClose: () => {}, onDone: () => {} }))));
  });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  vi.clearAllMocks();
});

const texto = () => document.body.textContent;
const botao = (rotulo) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
const clicar = async (rotulo) => {
  const b = botao(rotulo);
  expect(b, `botão "${rotulo}"`).toBeTruthy();
  await act(async () => { b.click(); });
};
// O campo de data é controlado pelo React: o valor entra pelo setter nativo
// e o evento de input, que é o que o onChange ouve.
const digitarData = async (valor) => {
  const input = document.getElementById('contract-outcome-date');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setter.call(input, valor);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const gravado = () => {
  expect(commitContractPatch).toHaveBeenCalledTimes(1);
  return commitContractPatch.mock.calls[0][0];
};

describe('ContractOutcomeModal: em que contrato age', () => {
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 30, 10, 0)); });
  afterAll(() => { vi.useRealTimers(); });

  describe('o último contrato (role current), como sempre', () => {
    it('cancelar grava o status no resumo do lead, sem contrato ligado', async () => {
      await montar({ lead: leadCom(start), contract: start, contratos: [start], action: 'cancelar' });
      expect(texto()).toContain('O contrato é encerrado em 30/09/2026 e Ana passa a contar como inativo. O histórico fica registrado.');
      await clicar('Financeiro');
      await clicar('Confirmar cancelamento');
      const w = gravado();
      expect(w.contractId).toBe('k1');
      expect(w.contractPatch).toMatchObject({ status: 'cancelado', cancelledAt: D(2026, 9, 30), cancelReason: 'Financeiro' });
      expect(w.leadPatch).toEqual({ currentContractStatus: 'cancelado' });
      expect(w.linkedContractId).toBeNull();
      expect(w.linkedContractPatch).toBeNull();
    });

    it('cancelar a renovação que ainda não começou desfaz a renovação e devolve o fim ao contrato renovado, no mesmo batch', async () => {
      const encurtado = { ...start, endsAt: D(2026, 10, 4), originalEndsAt: D(2026, 10, 11), shortenedById: 'k2' };
      const sobreposta = { ...flow, startsAt: D(2026, 10, 5), endsAt: D(2027, 10, 5) };
      await montar({ lead: leadCom(sobreposta), contract: sobreposta, contratos: [encurtado, sobreposta], action: 'cancelar' });
      expect(texto()).toContain('Cancelar renovação');
      expect(texto()).toContain('A renovação é desfeita e Ana volta ao contrato em uso (Start, até 11/10/2026).');
      await clicar('Financeiro');
      await clicar('Cancelar renovação');
      const w = gravado();
      expect(w.contractId).toBe('k2');
      expect(w.leadPatch).toMatchObject({ currentContractId: 'k1', currentContractEndsAt: D(2026, 10, 11), currentContractStatus: 'ativo' });
      expect(w.linkedContractId).toBe('k1');
      expect(w.linkedContractPatch).toEqual({ endsAt: D(2026, 10, 11), originalEndsAt: null, shortenedById: null });
    });

    it('sem contrato recebido, age no último contrato do resumo', async () => {
      await montar({ lead: leadCom(start), contract: null, contratos: [], action: 'trancar' });
      await clicar('Viagem');
      await clicar('Confirmar trancamento');
      const w = gravado();
      expect(w.contractId).toBe('k1');
      expect(w.leadPatch).toEqual({ currentContractStatus: 'trancado' });
    });

    // Decisão do Johnny (01/10/2026): com dois contratos ativos, cancelar um
    // deixa o cliente ativo pelo outro. O modal acha o contrato em uso que
    // continua (inUseReplacementOf) e o resumo do lead passa para ele.
    it('cancelar a renovação com data depois do início, com o contrato renovado ainda em uso: o resumo passa para ele', async () => {
      await montar({ lead: leadCom(flow), contract: flow, contratos: [start, flow], action: 'cancelar' });
      await digitarData('2026-10-20');
      expect(texto()).not.toContain('Cancelar renovação');
      expect(texto()).toContain('O contrato é encerrado em 20/10/2026. O cliente continua ativo pelo contrato Plano Start, que vale até 11/10/2026.');
      expect(texto()).not.toContain('passa a contar como inativo');
      await clicar('Financeiro');
      await clicar('Confirmar cancelamento');
      const w = gravado();
      expect(w.contractId).toBe('k2');
      expect(w.contractPatch).toMatchObject({ status: 'cancelado', cancelledAt: D(2026, 10, 20), cancelReason: 'Financeiro' });
      expect(w.leadPatch).toEqual({
        currentContractId: 'k1', currentPlanName: 'Start', currentContractValue: 1200,
        currentContractStartsAt: D(2025, 10, 11), currentContractEndsAt: D(2026, 10, 11),
        currentContractStatus: 'ativo', currentContractSeamless: false, ...CLEAR_IN_USE_BLOCK
      });
      expect(w.linkedContractId).toBeNull();
      expect(w.linkedContractPatch).toBeNull();
      expect(w.interactionText).toBe('Contrato cancelado — Plano Flow — Financeiro. Encerrado em 20/10/2026. O cliente continua com o contrato Plano Start.');
    });

    it('com o contrato que continua trancado, a prévia diz que ele está trancado, e o resumo passa trancado', async () => {
      const trancado = { ...start, status: 'trancado', pausedAt: D(2026, 9, 20), pauseReason: 'Viagem' };
      await montar({ lead: leadCom(flow), contract: flow, contratos: [trancado, flow], action: 'cancelar' });
      await digitarData('2026-10-20');
      expect(texto()).toContain('O contrato é encerrado em 20/10/2026. O cliente continua com o contrato Plano Start, que está trancado.');
      await clicar('Financeiro');
      await clicar('Confirmar cancelamento');
      expect(gravado().leadPatch).toMatchObject({ currentContractId: 'k1', currentContractStatus: 'trancado' });
    });

    it('cancelar o contrato paralelo mais novo deixa o cliente ativo pelo outro; o de outra pessoa não conta', async () => {
      const paralelo = { id: 'k3', leadId: 'l1', planName: 'Pilates', value: 600, durationMonths: 6, status: 'ativo', startsAt: D(2026, 6, 1), endsAt: D(2026, 12, 1), createdAt: D(2026, 6, 1) };
      const deOutra = { ...start, id: 'k9', leadId: 'l2', planName: 'Alheio', startsAt: D(2026, 8, 1), endsAt: D(2027, 8, 1) };
      await montar({ lead: leadCom(paralelo), contract: paralelo, contratos: [start, paralelo, deOutra], action: 'cancelar' });
      expect(texto()).toContain('O contrato é encerrado em 30/09/2026. O cliente continua ativo pelo contrato Plano Start, que vale até 11/10/2026.');
      await clicar('Financeiro');
      await clicar('Confirmar cancelamento');
      const w = gravado();
      expect(w.contractId).toBe('k3');
      expect(w.leadPatch).toMatchObject({ currentContractId: 'k1', currentPlanName: 'Start', currentContractStatus: 'ativo' });
      expect(w.interactionText).toBe('Contrato cancelado — Plano Pilates — Financeiro. Encerrado em 30/09/2026. O cliente continua com o contrato Plano Start.');
    });
  });

  describe('o contrato em uso, com a renovação marcada (role inUse)', () => {
    const lead = leadCom(flow);

    it('age no contrato recebido, nunca no último: cancelar grava só o bloco "em uso" e tira a marca de emendada da renovação no mesmo batch', async () => {
      await montar({ lead, contract: start, contratos: [start, flow], action: 'cancelar' });
      expect(texto()).toContain('O contrato é encerrado em 30/09/2026. A renovação (Plano Flow) continua marcada para 12/10/2026, e até lá Ana fica sem contrato.');
      await clicar('Financeiro');
      await clicar('Confirmar cancelamento');
      const w = gravado();
      expect(w.contractId).toBe('k1');
      expect(w.leadPatch).toEqual({ inUseContractId: 'k1', inUseContractStatus: 'cancelado', inUseContractEndsAt: D(2026, 10, 11), currentContractSeamless: false });
      expect(w.linkedContractId).toBe('k2');
      expect(w.linkedContractPatch).toEqual({ seamless: false });
      expect(w.interactionText).toBe('Contrato cancelado — Plano Start — Financeiro. Encerrado em 30/09/2026. A renovação continua marcada para 12/10/2026.');
    });

    it('nunca desfaz renovação: o em uso que é ele mesmo uma renovação, com a data no início dele, é cancelamento comum', async () => {
      const k0 = { id: 'k0', leadId: 'l1', planName: 'Mensal', status: 'ativo', startsAt: D(2024, 10, 11), endsAt: D(2025, 10, 11) };
      const renovado = { ...start, renewedFromId: 'k0' };
      await montar({ lead, contract: renovado, contratos: [k0, renovado, flow], action: 'cancelar' });
      await digitarData('2025-10-11');
      expect(texto()).not.toContain('Cancelar renovação');
      expect(texto()).toContain('O contrato é encerrado em 11/10/2025. A renovação (Plano Flow) continua marcada para 12/10/2026');
      await clicar('Financeiro');
      await clicar('Confirmar cancelamento');
      const w = gravado();
      expect(w.contractId).toBe('k1');
      expect(w.contractPatch).toMatchObject({ status: 'cancelado', cancelledAt: D(2025, 10, 11) });
      expect(w.leadPatch).toMatchObject({ inUseContractId: 'k1', inUseContractStatus: 'cancelado' });
      expect(w.leadPatch).not.toHaveProperty('currentContractId');
      expect(w.linkedContractId).toBe('k2');
      expect(w.linkedContractPatch).toEqual({ seamless: false });
    });

    it('trancar avisa que a renovação continua marcada e que os dias que sobram correm junto com ela; grava só o bloco', async () => {
      await montar({ lead, contract: start, contratos: [start, flow], action: 'trancar' });
      expect(texto()).toContain('A vigência congela nesta data. Quando reativar, o término anda para frente pelos dias parados, e o cliente não perde o que pagou. A renovação (Plano Flow) continua marcada para 12/10/2026. Se o contrato ainda estiver trancado nesse dia, os dias que sobram dele correm junto com ela.');
      await clicar('Viagem');
      await clicar('Confirmar trancamento');
      const w = gravado();
      expect(w.contractId).toBe('k1');
      expect(w.contractPatch).toEqual({ status: 'trancado', pausedAt: D(2026, 9, 30), pauseReason: 'Viagem' });
      expect(w.leadPatch).toEqual({ inUseContractId: 'k1', inUseContractStatus: 'trancado', inUseContractEndsAt: D(2026, 10, 11) });
      expect(w.linkedContractId).toBeNull();
      expect(w.linkedContractPatch).toBeNull();
    });

    it('reativar com o fim novo passando do início da renovação avisa que os dois valem juntos; o bloco volta a ativo com o fim novo', async () => {
      const trancado = { ...start, status: 'trancado', pausedAt: D(2026, 9, 20), pauseReason: 'Viagem' };
      await montar({ lead, contract: trancado, contratos: [trancado, flow], action: 'reativar' });
      expect(texto()).toContain('10 dias parados: o término vai de 11/10/2026 para 21/10/2026. A renovação (Plano Flow) começa em 12/10/2026 do mesmo jeito, e os dois contratos valem juntos até 21/10/2026.');
      await clicar('Confirmar reativação');
      const w = gravado();
      expect(w.contractId).toBe('k1');
      expect(w.contractPatch).toMatchObject({ status: 'ativo', endsAt: D(2026, 10, 21), pausedDaysTotal: 10 });
      expect(w.leadPatch).toEqual({ inUseContractId: 'k1', inUseContractStatus: 'ativo', inUseContractEndsAt: D(2026, 10, 21) });
      expect(w.linkedContractId).toBeNull();
    });

    // As prévias são texto de tela: sem travessão no meio da frase (revisão
    // final de 01/10/2026).
    it('reativar no mesmo dia do trancamento diz que nenhum dia parou, sem travessão', async () => {
      const trancado = { ...start, status: 'trancado', pausedAt: D(2026, 9, 30), pauseReason: 'Viagem' };
      await montar({ lead, contract: trancado, contratos: [trancado, flow], action: 'reativar' });
      expect(texto()).toContain('Nenhum dia parado: a vigência segue igual.');
      expect(texto()).not.toContain(' — ');
    });

    it('sem nome do plano, a renovação aparece sem parênteses', async () => {
      const semNome = { ...flow, planName: null };
      await montar({ lead: leadCom(semNome), contract: start, contratos: [start, semNome], action: 'trancar' });
      expect(texto()).toContain('A renovação continua marcada para 12/10/2026. Se o contrato ainda estiver trancado nesse dia, os dias que sobram dele correm junto com ela.');
      expect(texto()).not.toContain('(Plano');
    });

    // Revisão final (01/10/2026): a renovação cancelada (o último contrato,
    // cancelado com a data depois do início) não é "marcada": nada de "A
    // renovação continua marcada", sem patch nela e sem mexer na marca.
    it('a renovação cancelada é ignorada: o cancelamento do em uso é comum, no bloco', async () => {
      const cancelada = { ...flow, status: 'cancelado', cancelledAt: D(2026, 10, 20), cancelReason: 'Financeiro' };
      await montar({ lead: leadCom(cancelada), contract: start, contratos: [start, cancelada], action: 'cancelar' });
      expect(texto()).not.toContain('A renovação');
      expect(texto()).toContain('O contrato é encerrado em 30/09/2026 e Ana passa a contar como inativo. O histórico fica registrado.');
      await clicar('Financeiro');
      await clicar('Confirmar cancelamento');
      const w = gravado();
      expect(w.contractId).toBe('k1');
      expect(w.leadPatch).toEqual({ inUseContractId: 'k1', inUseContractStatus: 'cancelado', inUseContractEndsAt: D(2026, 10, 11) });
      expect(w.linkedContractId).toBeNull();
      expect(w.linkedContractPatch).toBeNull();
      expect(w.interactionText).toBe('Contrato cancelado — Plano Start — Financeiro. Encerrado em 30/09/2026.');
    });
  });
});
