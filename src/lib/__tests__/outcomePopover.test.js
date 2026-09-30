// @vitest-environment jsdom
// Botão "Marcar desfecho": o rótulo segue o desfecho, o clique abre o balão
// com as opções certas e escolher uma fecha o balão e avisa quem grava.
import { describe, it, expect, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O Popper do Radix mede o conteúdo com ResizeObserver, que o jsdom não tem.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const { OutcomePopover } = await import('../../components/dailygoal/OutcomePopover.jsx');

let root = null;
async function montar(props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(h(OutcomePopover, props)); });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
});

const gatilho = () => document.querySelector('[data-slot="popover-trigger"]');
const opcoes = () => [...document.querySelectorAll('[data-outcome-item]')].map((b) => b.textContent.trim());
const clicar = async (el) => { await act(async () => { el.click(); }); };

describe('OutcomePopover', () => {
  it('sem desfecho mostra Marcar desfecho e abre Compareceu e Não compareceu', async () => {
    await montar({ onPick: () => {} });
    expect(gatilho().textContent).toContain('Marcar desfecho');
    await clicar(gatilho());
    expect(opcoes()).toEqual(['Compareceu', 'Não compareceu']);
  });

  it('com withMore traz Remarcou e Cancelou', async () => {
    await montar({ withMore: true, onPick: () => {} });
    await clicar(gatilho());
    expect(opcoes()).toEqual(['Compareceu', 'Não compareceu', 'Remarcou', 'Cancelou']);
  });

  it('marcado mostra o desfecho e oferece a troca e o desfazer', async () => {
    await montar({ outcome: 'attended', canUndo: true, onPick: () => {} });
    expect(gatilho().textContent).toContain('Compareceu');
    expect(gatilho().getAttribute('aria-label')).toBe('Compareceu. Abrir para corrigir');
    await clicar(gatilho());
    expect(opcoes()).toEqual(['Trocar para não compareceu', 'Desfazer marcação']);
  });

  it('escolher avisa o id e fecha o balão', async () => {
    const escolhas = [];
    await montar({ outcome: 'no_show', onPick: (id) => escolhas.push(id) });
    await clicar(gatilho());
    await clicar(document.querySelector('[data-outcome-item="attended"]'));
    expect(escolhas).toEqual(['attended']);
    expect(document.querySelector('[data-outcome-item]')).toBeNull();
  });

  it('compacto (Agenda de hoje): "Marcar" sem desfecho e só o ícone com desfecho, com o texto inteiro no rótulo', async () => {
    await montar({ compact: true, title: 'Visita de Ana · 18:00', onPick: () => {} });
    expect(gatilho().textContent.trim()).toBe('Marcar');
    expect(gatilho().getAttribute('aria-label')).toBe('Marcar desfecho: Visita de Ana · 18:00');
    await act(async () => { root.unmount(); });
    document.body.innerHTML = '';
    await montar({ compact: true, outcome: 'no_show', onPick: () => {} });
    expect(gatilho().textContent.trim()).toBe('');
    expect(gatilho().getAttribute('aria-label')).toBe('Não compareceu. Abrir para corrigir');
    expect(gatilho().getAttribute('title')).toBe('Não compareceu');
  });

  it('gravando, o botão fica desligado', async () => {
    await montar({ saving: true, onPick: () => {} });
    expect(gatilho().disabled).toBe(true);
  });
});
