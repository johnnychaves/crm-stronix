// @vitest-environment jsdom
// O Mudar fase (PhaseChanger) em passos horizontais: Funil, Nova fase e, quando
// o destino é o funil de Indicações sem indicador, Indicador. O contrato de
// onConfirm ({ funnelId, targetStatus, note, referrer }) é o que o
// handlePhaseConfirm da ficha consome e não muda.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { REFERRAL_FUNNEL_KIND } from '../referrals.js';

// O seletor de indicador consulta o Firestore. Aqui só importa que o passo apareça.
vi.mock('../../components/profile/ReferrerPicker.jsx', () => ({ ReferrerPicker: () => h('div', { 'data-testid': 'picker' }, 'seletor') }));
const { PhaseChanger } = await import('../../components/profile/PhaseChanger.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const FUNNELS = [{ id: 'f1', name: 'Funil de vendas' }, { id: 'fi', name: 'Indicações', systemKind: REFERRAL_FUNNEL_KIND }];
const STATUSES = [
  { id: 's1', funnelId: 'f1', name: 'Novo lead', order: 1 },
  { id: 's2', funnelId: 'f1', name: 'Em contato', order: 2 },
  { id: 's3', funnelId: 'f1', name: 'Negociação', order: 3 },
  { id: 'i1', funnelId: 'fi', name: 'Indicado', order: 1 },
  { id: 'i2', funnelId: 'fi', name: 'Em contato', order: 2 },
];
const LEAD = { id: 'l1', name: 'Rafael Moreira', funnelId: 'f1', status: 'Em contato' };

let root = null;
async function montar(props = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const onConfirm = props.onConfirm || vi.fn();
  const onCancel = props.onCancel || vi.fn();
  await act(async () => {
    root.render(h(PhaseChanger, { lead: LEAD, funnels: FUNNELS, statuses: STATUSES, onConfirm, onCancel, ...props }));
  });
  return { onConfirm, onCancel };
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

// O botão de cada etapa leva o número da posição no começo do texto ("1Novo
// leadVolta 1 etapa"), então a busca por prefixo tira esse número antes.
const botao = (prefixo) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.replace(/^\d+/, '').trim().startsWith(prefixo)) || null;
const clicar = async (el) => { await act(async () => { el.click(); }); };
const passos = () => [...document.body.querySelectorAll('ol[aria-label="Passos da mudança de fase"] > li')];
const texto = (li) => li.textContent.replace(/^\d+/, '');

describe('PhaseChanger em passos horizontais', () => {
  it('abre no passo Nova fase, com o funil atual como passo feito', async () => {
    await montar();
    expect(passos().map(texto)).toEqual(['FunilFunil de vendas', 'Nova fase']);
    expect(passos()[1].getAttribute('aria-current')).toBe('step');
    ['Novo lead', 'Em contato', 'Negociação', 'Venda', 'Perda'].forEach((n) => expect(botao(n), n).not.toBeNull());
  });

  it('a fase atual vem tracejada e desligada, e as outras dizem quantas etapas andam', async () => {
    await montar();
    expect(botao('Em contato').disabled).toBe(true);
    expect(botao('Em contato').textContent).toContain('Fase atual');
    expect(botao('Negociação').textContent).toContain('Avança 1 etapa');
    expect(botao('Novo lead').textContent).toContain('Volta 1 etapa');
  });

  it('antes de escolher a fase o botão pede a escolha, e depois leva o nome dela', async () => {
    await montar();
    expect(botao('Escolha a nova fase')).not.toBeNull();
    await clicar(botao('Negociação'));
    expect(botao('Mover para Negociação').disabled).toBe(false);
  });

  it('confirmar manda funil, fase, nota e indicador', async () => {
    const { onConfirm } = await montar();
    await clicar(botao('Negociação'));
    const campo = document.body.querySelector('#ph-note');
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    await act(async () => { set.call(campo, 'Pediu proposta'); campo.dispatchEvent(new Event('input', { bubbles: true })); });
    await clicar(botao('Mover para Negociação'));
    expect(onConfirm).toHaveBeenCalledWith({ funnelId: 'f1', targetStatus: 'Negociação', note: 'Pediu proposta', referrer: null });
  });

  it('Venda e Perda mudam o nome do botão e a pergunta da nota', async () => {
    await montar();
    await clicar(botao('Venda'));
    expect(botao('Mover para Venda')).not.toBeNull();
    expect(document.body.textContent).toContain('Detalhes da venda');
    await clicar(botao('Perda'));
    expect(botao('Mover para Perda')).not.toBeNull();
    expect(document.body.textContent).toContain('Motivo da perda (recomendado)');
  });

  it('clicar no passo Funil volta à escolha do funil', async () => {
    await montar();
    await clicar(document.body.querySelector('button[title="Editar funil"]'));
    expect(passos()[0].getAttribute('aria-current')).toBe('step');
    expect(botao('Indicações').textContent).toContain('Mover para outro funil');
    expect(botao('Funil de vendas').textContent).toContain('Funil atual');
  });

  it('mover para o funil de Indicações, sem indicador, abre o passo Indicador e trava o botão', async () => {
    await montar();
    await clicar(document.body.querySelector('button[title="Editar funil"]'));
    await clicar(botao('Indicações'));
    await clicar(botao('Indicado'));
    expect(passos().map(texto)).toEqual(['FunilIndicações', 'Nova faseIndicado', 'Indicador']);
    expect(passos()[2].getAttribute('aria-current')).toBe('step');
    expect(document.body.querySelector('[data-testid="picker"]')).not.toBeNull();
    expect(botao('Vincule o indicador').disabled).toBe(true);
  });

  it('Limpar seleção volta ao funil e à fase de antes', async () => {
    await montar();
    await clicar(botao('Negociação'));
    await clicar(botao('Limpar seleção'));
    expect(passos().map(texto)).toEqual(['FunilFunil de vendas', 'Nova fase']);
    expect(botao('Mover para Negociação')).toBeNull();
  });

  it('Cancelar chama o onCancel', async () => {
    const { onCancel } = await montar();
    await clicar(botao('Cancelar'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('trocar de passo leva o foco ao cabeçalho do passo novo', async () => {
    await montar();
    expect(document.activeElement.textContent).toBe('Nova fase');
    await clicar(document.body.querySelector('button[title="Editar funil"]'));
    expect(document.activeElement.textContent).toBe('Funil');
    await clicar(botao('Indicações'));
    expect(document.activeElement.textContent).toBe('Nova fase');
    await clicar(botao('Indicado'));
    expect(document.activeElement.textContent).toBe('Quem indicou?');
  });
});
