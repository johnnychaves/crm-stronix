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
  onLaunchFreepass: vi.fn(), onEndFreepass: vi.fn(), freepassOn: true
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
  it('o lead em Perda não lança freepass e é mandado reativar', async () => {
    await montar({ lead: { id: 'L', status: 'Perda' }, isClient: false, freepasses: [], canFreepass: true });
    expect(botao('Lançar freepass')).toBeUndefined();
    expect(texto()).toContain('Rafa está em Perda. Reative o lead no alto da ficha para lançar o freepass.');
  });
  it('com freepass correndo, a vazia diz que a matrícula é pelo Marcar venda e oferece outro freepass', async () => {
    await montar({ lead: { id: 'L', status: 'Novo' }, isClient: false, freepasses: [fp], canFreepass: true });
    expect(texto()).toContain('Rafa está experimentando a academia. A matrícula é pelo Marcar venda, no alto da ficha.');
    await act(async () => { botao('Lançar outro freepass').click(); });
    expect(props.onLaunchFreepass).toHaveBeenCalled();
  });
  it('o Lançar freepass fica desligado até os freepass chegarem', async () => {
    await montar({ lead: { id: 'L', status: 'Novo' }, isClient: false, freepasses: [], canFreepass: true, freepassesLoading: true });
    expect(botao('Lançar freepass').disabled).toBe(true);
  });
  it('o ex-aluno com contrato vencido tem Lançar freepass ao lado de Nova matrícula', async () => {
    const c1 = { id: 'c1', leadId: 'L', planName: 'Start', value: 1200, durationMonths: 12, status: 'ativo', startsAt: new Date(2024, 0, 1), endsAt: new Date(2024, 11, 31), createdAt: new Date(2024, 0, 1) };
    await montar({ lead: { id: 'L', lifecycleStage: 'cliente', status: 'Venda', currentContractId: 'c1' }, leadContracts: [c1], isClient: true, freepasses: [], canFreepass: true });
    expect(botao('Nova matrícula')).toBeTruthy();
    expect(botao('Lançar freepass')).toBeTruthy();
  });
  it('o card por dias mostra a data do fim embaixo e o por aulas, nenhuma ainda', async () => {
    const fd = { ...fp, id: 'f2', kind: 'dias', total: 7, startsAt: new Date(), endsAt: new Date(Date.now() + 6 * 86400000) };
    await montar({ lead: { id: 'L', status: 'Novo' }, isClient: false, freepasses: [fp, fd], canFreepass: true });
    expect(texto()).toContain('nenhuma ainda');
    expect(texto()).toMatch(/até \d{2}\/\d{2}/);
  });
  it('sem o módulo, a aba é a de antes: Matricular agora, texto original, sem freepass', async () => {
    await montar({ lead: { id: 'L', status: 'Novo' }, isClient: false, freepasses: [fp], canFreepass: true, freepassOn: false });
    expect(botao('Matricular agora')).toBeTruthy();
    expect(botao('Lançar freepass')).toBeUndefined();
    expect(botao('Lançar outro freepass')).toBeUndefined();
    expect(botao('Encerrar freepass')).toBeUndefined();
    expect(texto()).not.toContain('Pilates 2 aulas');
    expect(texto()).toContain('Quando Rafa fechar, registre plano, valor e vigência. A renovação passa a ser acompanhada por aqui.');
  });
});
