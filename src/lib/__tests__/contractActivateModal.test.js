// @vitest-environment jsdom
// O ContractActivateModal segue a regra de início da renovação
// (renewalStartProblem): a renovação começa no mínimo dois dias depois do
// início do contrato renovado. No dia seguinte ao início dele, o Ativar agora
// não encurtava nada (a véspera cairia no próprio início), a renovação perdia a
// marca de emendada e os dois contratos passavam a valer juntos, enquanto o
// Corrigir recusava a mesma data (revisão final de 01/10/2026). O modal é
// renderizado em jsdom, clicado, e o que vai para o commitContractPatch, aqui
// um dublê, é conferido.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastContext } from '../../contexts/ToastContext.jsx';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';

vi.mock('../contractsWrites.js', () => ({ commitContractPatch: vi.fn(async () => {}) }));
const { commitContractPatch } = await import('../contractsWrites.js');
const { ContractActivateModal } = await import('../../modals/ContractActivateModal.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const D = (y, m, d, hh = 0, mi = 0) => new Date(y, m - 1, d, hh, mi);
const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const appUser = { id: 'u1', name: 'Bruno', authUid: 'auth-1' };

// O Mensal fechado em 05/02/2027 às 17:13 ("Começar hoje") e o Anual, a
// renovação emendada marcada para o fim dele.
const mensal = { id: 'k2', leadId: 'l1', planName: 'Mensal', value: 150, durationMonths: 1, status: 'ativo', startsAt: D(2027, 2, 5, 17, 13), endsAt: D(2027, 3, 5, 17, 13), createdAt: D(2027, 2, 5, 17, 13) };
const anual = { id: 'k3', leadId: 'l1', planId: 'p12', planName: 'Anual', value: 1800, listValue: 1800, durationMonths: 12, status: 'ativo', renewedFromId: 'k2', seamless: true, startsAt: D(2027, 3, 6, 17, 13), endsAt: D(2028, 3, 6, 17, 13), createdAt: D(2027, 2, 5, 17, 20) };
const lead = {
  id: 'l1', name: 'Ana Lima', currentContractId: 'k3', currentPlanName: 'Anual', currentContractValue: 1800,
  currentContractStartsAt: anual.startsAt, currentContractEndsAt: anual.endsAt, currentContractStatus: 'ativo', currentContractSeamless: true,
  inUseContractId: 'k2', inUseContractStatus: 'ativo', inUseContractEndsAt: mensal.endsAt
};

let root = null;
async function montar(agora) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(agora);
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(ToastContext.Provider, { value: toast },
      h(GeneralConfigContext.Provider, { value: { planos: [], contratos: [mensal, anual] } },
        h(ContractActivateModal, { lead, appUser, db: {}, contract: anual, onClose: () => {}, onDone: () => {} }))));
  });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  vi.clearAllMocks();
  vi.useRealTimers();
});
const botao = (rotulo) => [...document.querySelectorAll('button')].find((el) => el.textContent.trim() === rotulo);
const REGRA = 'A renovação precisa começar a partir de 07/02/2027, dois dias depois do início do contrato renovado.';

describe('ContractActivateModal: a regra de início da renovação', () => {
  it('no dia seguinte ao início do contrato em uso, mostra a regra e não grava', async () => {
    await montar(D(2027, 2, 6, 6, 37));
    expect(document.body.textContent).toContain(REGRA);
    const b = botao('Ativar agora');
    expect(b).toBeTruthy();
    expect(b.disabled).toBe(true);
    await act(async () => { b.click(); });
    expect(commitContractPatch).not.toHaveBeenCalled();
  });

  it('dois dias depois, ativa como sempre: o em uso termina ontem e a renovação continua emendada', async () => {
    await montar(D(2027, 2, 7, 9, 0));
    expect(document.body.textContent).not.toContain('dois dias depois do início');
    const b = botao('Ativar agora');
    expect(b.disabled).toBe(false);
    await act(async () => { b.click(); });
    expect(commitContractPatch).toHaveBeenCalledTimes(1);
    const w = commitContractPatch.mock.calls[0][0];
    expect(w.contractId).toBe('k3');
    expect(w.linkedContractId).toBe('k2');
    expect(w.linkedContractPatch).toMatchObject({ shortenedById: 'k3', originalEndsAt: mensal.endsAt });
    expect(w.contractPatch.seamless).toBe(true);
  });
});
