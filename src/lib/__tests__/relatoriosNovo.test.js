// @vitest-environment jsdom
// O balão "Novo" dos Relatórios cita os mesmos submenus da lista ao lado, com o
// mesmo nome, para quem lê o aviso reconhecer cada um na tela.
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RelatoriosNovo } from '../../views/relatorios/RelatoriosNovo.jsx';
import { RELATORIOS_RAIL_GROUPS } from '../relatoriosRail.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

describe('balão Novo dos Relatórios', () => {
  it('cita todos os submenus da lista ao lado, com o mesmo nome', async () => {
    await act(async () => { root.render(h(RelatoriosNovo, { now: new Date(2026, 9, 15) })); });
    await act(async () => { document.body.querySelector('[aria-label="Novo: o que é esta tela"]').click(); });
    const itens = [...document.body.querySelectorAll('[role="dialog"] li')].map((li) => li.textContent);
    for (const { label } of RELATORIOS_RAIL_GROUPS.flatMap((g) => g.items)) {
      expect(itens.some((t) => t.startsWith(`${label}:`)), label).toBe(true);
    }
  });
});
