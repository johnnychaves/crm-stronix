// @vitest-environment jsdom
// O ContractEditModal só grava o resumo do lead (currentContract*) quando o
// contrato corrigido é o último (currentContractId). Corrigir outro contrato,
// o em uso com o último cancelado, reescrevia o resumo com os dados dele
// (revisão final de 01/10/2026). O modal é renderizado em jsdom, clicado, e o
// que vai para o commitContractPatch, aqui um dublê, é conferido.
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastContext } from '../../contexts/ToastContext.jsx';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';

vi.mock('../contractsWrites.js', () => ({ commitContractPatch: vi.fn(async () => {}) }));
const { commitContractPatch } = await import('../contractsWrites.js');
const { ContractEditModal } = await import('../../modals/ContractEditModal.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const D = (y, m, d) => new Date(y, m - 1, d);
const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const appUser = { id: 'u1', name: 'Bruno', authUid: 'auth-1' };
const plano = { id: 'p1', name: 'Start', value: 1200, durationMonths: 12, active: true };
const start = { id: 'k1', leadId: 'l1', planId: 'p1', planName: 'Start', value: 1200, listValue: 1200, durationMonths: 12, status: 'ativo', startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11), createdAt: D(2025, 10, 9) };
// A renovação, cancelada com a data depois do início: continua o último contrato.
const flowCancelado = { id: 'k2', leadId: 'l1', planId: 'p2', planName: 'Flow', value: 1788, listValue: 1788, durationMonths: 12, status: 'cancelado', renewedFromId: 'k1', seamless: true, startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12), cancelledAt: D(2026, 10, 20), createdAt: D(2026, 9, 28) };
const leadCom = (atual, extra = {}) => ({
  id: 'l1', name: 'Ana Lima', currentContractId: atual.id, currentPlanName: atual.planName, currentContractValue: atual.value,
  currentContractStartsAt: atual.startsAt, currentContractEndsAt: atual.endsAt, currentContractStatus: atual.status, currentContractSeamless: Boolean(atual.seamless),
  ...extra
});

let root = null;
async function montar({ lead, contract, contratos }) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(ToastContext.Provider, { value: toast },
      h(GeneralConfigContext.Provider, { value: { planos: [plano], contratos } },
        h(ContractEditModal, { lead, appUser, db: {}, contract, onClose: () => {}, onDone: () => {} }))));
  });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  vi.clearAllMocks();
});
const clicar = async (rotulo) => {
  const b = [...document.querySelectorAll('button')].find((el) => el.textContent.trim() === rotulo);
  expect(b, `botão "${rotulo}"`).toBeTruthy();
  await act(async () => { b.click(); });
};
const gravado = () => {
  expect(commitContractPatch).toHaveBeenCalledTimes(1);
  return commitContractPatch.mock.calls[0][0];
};
const CAMPOS = ['currentPlanName', 'currentContractValue', 'currentContractStartsAt', 'currentContractEndsAt', 'currentContractSeamless'];

describe('ContractEditModal: em que contrato age', () => {
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 30, 10, 0)); });
  afterAll(() => { vi.useRealTimers(); });

  it('o último contrato: grava o resumo do lead, como sempre', async () => {
    await montar({ lead: leadCom(start), contract: start, contratos: [start] });
    await clicar('Salvar correção');
    const w = gravado();
    expect(w.contractId).toBe('k1');
    CAMPOS.forEach((k) => expect(w.leadPatch, k).toHaveProperty(k));
    expect(w.leadPatch.currentContractEndsAt).toEqual(D(2026, 10, 11));
  });

  it('outro contrato (o em uso, com o último cancelado): nada de currentContract*, só o bloco "em uso"', async () => {
    const lead = leadCom(flowCancelado, { inUseContractId: 'k1', inUseContractStatus: 'ativo', inUseContractEndsAt: start.endsAt });
    await montar({ lead, contract: start, contratos: [start, flowCancelado] });
    await clicar('Salvar correção');
    const w = gravado();
    expect(w.contractId).toBe('k1');
    CAMPOS.forEach((k) => expect(w.leadPatch, k).not.toHaveProperty(k));
    expect(w.leadPatch).toEqual({ inUseContractId: 'k1', inUseContractStatus: 'ativo', inUseContractEndsAt: D(2026, 10, 11) });
  });
});
