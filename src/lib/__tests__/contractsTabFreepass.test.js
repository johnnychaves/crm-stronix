// @vitest-environment jsdom
// src/lib/__tests__/contractsTabFreepass.test.js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';

const { ContractsTab } = await import('../../components/profile/contracts/ContractsTab.jsx');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const props = {
  leadContracts: [], firstName: 'Rafa', isReadOnly: false, loading: false, contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30],
  onEnroll: vi.fn(), onRenew: vi.fn(), onEditContract: vi.fn(), onContractAction: vi.fn(), onActivate: vi.fn(),
  onLaunchFreepass: vi.fn(), onEndFreepass: vi.fn()
};
const fp = { id: 'f1', kind: 'aulas', total: 2, aulas: 0, typeName: 'Pilates 2 aulas', modalidadeName: 'Pilates', status: 'correndo', startsAt: new Date(), endsAt: null, contractAtStart: null };

let root = null;
async function montar(extra) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => { root.render(h(ContractsTab, { ...props, ...extra })); });
}
afterEach(async () => { await act(async () => { root?.unmount(); }); document.body.innerHTML = ''; root = null; vi.clearAllMocks(); });
const texto = () => document.body.textContent;
const botao = (rotulo) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);

describe('aba Contratos com freepass', () => {
  it('o lead sem contrato tem Lançar freepass no lugar de Matricular agora', async () => {
    await montar({ lead: { id: 'L', status: 'Novo' }, isClient: false, freepasses: [], canFreepass: true });
    expect(botao('Matricular agora')).toBeUndefined();
    await act(async () => { botao('Lançar freepass').click(); });
    expect(props.onLaunchFreepass).toHaveBeenCalled();
  });
  it('o cliente sem contrato continua com Matricular agora', async () => {
    await montar({ lead: { id: 'L', lifecycleStage: 'cliente' }, isClient: true, freepasses: [], canFreepass: true });
    expect(botao('Matricular agora')).toBeTruthy();
  });
  it('mostra o freepass que corre, com Encerrar', async () => {
    await montar({ lead: { id: 'L', status: 'Novo' }, isClient: false, freepasses: [fp], canFreepass: true });
    expect(texto()).toContain('Pilates 2 aulas');
    expect(texto()).toContain('0 de 2 aulas agendadas');
    await act(async () => { botao('Encerrar freepass').click(); });
    expect(props.onEndFreepass).toHaveBeenCalledWith(fp);
  });
  it('sem a ação, nenhum botão de freepass', async () => {
    await montar({ lead: { id: 'L', status: 'Novo' }, isClient: false, freepasses: [fp], canFreepass: false });
    expect(botao('Lançar freepass')).toBeUndefined();
    expect(botao('Encerrar freepass')).toBeUndefined();
  });
});
