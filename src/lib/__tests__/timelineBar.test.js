// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { TimelineBar } from '../../components/profile/TimelineBar.jsx';
import { TIMELINE_FILTERS } from '../timeline.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const COUNTS = { all: 13, conversation: 6, appointment: 2, note: 1, milestone: 4 };
const BASE = { filters: TIMELINE_FILTERS, counts: COUNTS, filter: 'all', onFilter: () => {}, showSystem: false, systemHiddenCount: 0, onToggleSystem: () => {}, query: '', onQuery: () => {} };

let root = null;
async function montar(props = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(h(TimelineBar, { ...BASE, ...props })); });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});
const clicar = async (el) => { await act(async () => { el.click(); }); };

describe('TimelineBar', () => {
  it('um botão por filtro, com a contagem ao lado, e o escolhido pressionado', async () => {
    await montar({ filter: 'note' });
    const pilulas = [...document.querySelectorAll('[role="group"][aria-label="Filtros do histórico"] button[aria-pressed]')];
    expect(pilulas.map((b) => b.textContent)).toEqual(['Tudo13', 'Conversas6', 'Agendamentos2', 'Anotações1', 'Marcos4']);
    expect(pilulas.find((b) => b.textContent.startsWith('Anotações')).getAttribute('aria-pressed')).toBe('true');
    expect(pilulas[0].getAttribute('aria-pressed')).toBe('false');
  });

  it('clicar numa pílula chama onFilter com o id do filtro', async () => {
    const onFilter = vi.fn();
    await montar({ onFilter });
    await clicar([...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('Marcos')));
    expect(onFilter).toHaveBeenCalledWith('milestone');
  });

  it('o interruptor de Sistema só existe com eventos escondidos ou ligado, e anuncia o que esconde', async () => {
    await montar();
    expect([...document.querySelectorAll('button')].some((b) => b.textContent.startsWith('Sistema'))).toBe(false);
    await act(async () => { root.unmount(); });
    document.body.innerHTML = '';
    await montar({ systemHiddenCount: 3 });
    const interruptor = [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('Sistema'));
    expect(interruptor.textContent).toBe('Sistema +3');
    expect(interruptor.getAttribute('aria-pressed')).toBe('false');
  });

  it('o interruptor ligado perde o "+N" e chama onToggleSystem', async () => {
    const onToggleSystem = vi.fn();
    await montar({ systemHiddenCount: 3, showSystem: true, onToggleSystem });
    const interruptor = [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('Sistema'));
    expect(interruptor.textContent).toBe('Sistema');
    await clicar(interruptor);
    expect(onToggleSystem).toHaveBeenCalledTimes(1);
  });

  it('a busca mostra o texto e avisa a cada letra', async () => {
    const onQuery = vi.fn();
    await montar({ query: 'visita', onQuery });
    const campo = document.querySelector('input[type="search"]');
    expect(campo.value).toBe('visita');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    await act(async () => { set.call(campo, 'visitas'); campo.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(onQuery).toHaveBeenCalledWith('visitas');
  });
});
