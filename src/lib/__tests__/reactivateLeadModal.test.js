// @vitest-environment jsdom
// O "Reativar lead" da ficha (21/10/2026): o lead em Perda volta a uma fase
// aberta do funil escolhido. A janela só deixa confirmar com a fase escolhida,
// troca as fases quando o funil muda e devolve à ficha o funil e a fase.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactivateLeadModal } from '../../modals/ReactivateLeadModal.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const funnels = [{ id: 'f1', name: 'Comercial' }, { id: 'f2', name: 'Pilates' }];
const statuses = [
  { id: 's1', funnelId: 'f1', name: 'Novo', order: 0 },
  { id: 's2', funnelId: 'f1', name: 'Contato', order: 1 },
  { id: 's3', funnelId: 'f1', name: 'Venda', order: 2 },
  { id: 's4', funnelId: 'f1', name: 'Perda', order: 3 },
  { id: 's5', funnelId: 'f2', name: 'Experimental', order: 0 }
];
const lead = { id: 'l9', name: 'Pedro Prado', status: 'Perda', funnelId: 'f1', lossReason: 'Preço', lostAt: new Date(2026, 8, 20) };

let root = null;
async function montar(props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(ReactivateLeadModal, { lead, funnels, statuses, onClose: () => {}, onConfirm: async () => true, ...props }));
  });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
});
const botao = (rotulo) => [...document.querySelectorAll('button')].find((el) => el.textContent.trim() === rotulo);
const radios = () => [...document.querySelectorAll('[role="radio"]')].map((el) => el.textContent.trim());
const clicar = async (el) => { await act(async () => { el.click(); }); };

describe('ReactivateLeadModal', () => {
  it('abre no funil do lead, sem Venda e Perda, e só confirma com a fase escolhida', async () => {
    const onConfirm = vi.fn(async () => true);
    const onClose = vi.fn();
    await montar({ onConfirm, onClose });
    expect(radios()).toEqual(['Comercial', 'Pilates', 'Novo', 'Contato']);
    expect(document.body.textContent).toContain('perdido em 20/09/2026 · motivo: Preço');
    expect(botao('Reativar lead').disabled).toBe(true);
    expect(document.querySelector('[role="status"]').textContent).toBe('Escolha a fase.');

    await clicar(botao('Contato'));
    expect(document.querySelector('[role="status"]').textContent).toBe('Volta para Contato.');
    await clicar(botao('Reativar lead'));
    expect(onConfirm).toHaveBeenCalledWith({ funnelId: 'f1', targetStatus: 'Contato' });
    expect(onClose).toHaveBeenCalled();
  });

  it('trocar de funil limpa a fase e mostra as fases dele', async () => {
    const onConfirm = vi.fn(async () => true);
    await montar({ onConfirm });
    await clicar(botao('Contato'));
    await clicar(botao('Pilates'));
    expect(radios()).toEqual(['Comercial', 'Pilates', 'Experimental']);
    expect(botao('Reativar lead').disabled).toBe(true);
    await clicar(botao('Experimental'));
    await clicar(botao('Reativar lead'));
    expect(onConfirm).toHaveBeenCalledWith({ funnelId: 'f2', targetStatus: 'Experimental' });
  });

  it('se a gravação falha, a janela fica aberta', async () => {
    const onClose = vi.fn();
    await montar({ onConfirm: async () => false, onClose });
    await clicar(botao('Novo'));
    await clicar(botao('Reativar lead'));
    expect(onClose).not.toHaveBeenCalled();
    expect(botao('Reativar lead').disabled).toBe(false);
  });
});
