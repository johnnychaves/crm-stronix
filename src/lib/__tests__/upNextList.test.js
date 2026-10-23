// @vitest-environment jsdom
// As ações do "A seguir" da ficha: Remarcar em todo item e Marcar desfecho só
// no compromisso de hoje, para quem muda fase.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { UpNextList } from '../../components/profile/UpNextList.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O balão do desfecho é um Popover do Radix, que mede o gatilho; o jsdom não tem isso.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const D = (m, d, h2 = 19) => new Date(2026, m - 1, d, h2);
const visitaHoje = { id: 'appointment', type: 'visita', kind: 'visit', title: 'Visita', detail: 'Unidade Centro', when: D(10, 16), overdue: false, canOutcome: true };
const visitaFutura = { ...visitaHoje, id: 'appointment-futura', when: D(10, 21), canOutcome: false };
const ligacao = { id: 'contact', type: 'ligacao', kind: 'call', title: 'Ligação', detail: '', when: D(10, 19, 18), overdue: false, canOutcome: false };

let root = null;
async function montar(props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(h(UpNextList, props)); });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});
const botoes = (texto) => [...document.body.querySelectorAll('button')].filter((b) => b.textContent.trim() === texto);
const clicar = async (el) => { await act(async () => { el.click(); }); };
const gatilho = () => document.body.querySelector('[aria-label="Marcar desfecho: Visita"]');

describe('UpNextList com ações', () => {
  it('cada item tem uma âncora que o Próximo passo do cabeçalho usa, focável só pelo código', async () => {
    await montar({ items: [visitaHoje, ligacao] });
    const item = document.body.querySelector('#next-appointment');
    expect(item).toBeTruthy();
    expect(document.body.querySelector('#next-contact')).toBeTruthy();
    expect(item.getAttribute('tabindex')).toBe('-1');
    expect(item.className).toContain('focus-visible:anel-foco');
  });

  it('sem as funções, só mostra: nenhum botão', async () => {
    await montar({ items: [visitaHoje] });
    expect(document.body.querySelectorAll('button')).toHaveLength(0);
  });

  it('Remarcar aparece em todo item, diz de qual é, e chama onReschedule com o item', async () => {
    const onReschedule = vi.fn();
    await montar({ items: [visitaHoje, ligacao], onReschedule });
    const remarcar = botoes('Remarcar');
    expect(remarcar.map((b) => b.getAttribute('aria-label'))).toEqual(['Remarcar: Visita', 'Remarcar: Ligação']);
    await clicar(remarcar[1]);
    expect(onReschedule).toHaveBeenCalledWith(ligacao);
  });

  it('Marcar desfecho só no compromisso de hoje, e só para quem pode', async () => {
    const onOutcome = vi.fn();
    await montar({ items: [visitaHoje, visitaFutura, ligacao], canOutcome: true, onOutcome });
    expect(document.body.querySelectorAll('[aria-label="Marcar desfecho: Visita"]')).toHaveLength(1);

    await act(async () => { root.unmount(); });
    document.body.innerHTML = '';
    await montar({ items: [visitaHoje], canOutcome: false, onOutcome });
    expect(document.body.querySelector('[aria-label^="Marcar desfecho"]')).toBeNull();
  });

  it('escolher Compareceu no balão chama onOutcome com o item e a escolha', async () => {
    const onOutcome = vi.fn();
    await montar({ items: [visitaHoje], canOutcome: true, onOutcome });
    await clicar(gatilho());
    await clicar(document.body.querySelector('[data-outcome-item="attended"]'));
    expect(onOutcome).toHaveBeenCalledWith(visitaHoje, 'attended');
  });

  it('o balão do A seguir só oferece Compareceu e Não compareceu', async () => {
    await montar({ items: [visitaHoje], canOutcome: true, onOutcome: vi.fn() });
    await clicar(gatilho());
    const ids = [...document.body.querySelectorAll('[data-outcome-item]')].map((b) => b.dataset.outcomeItem);
    expect(ids).toEqual(['attended', 'no_show']);
  });

  it('com a ficha gravando, Remarcar e Marcar desfecho ficam desligados', async () => {
    const onReschedule = vi.fn();
    await montar({ items: [visitaHoje], canOutcome: true, onOutcome: vi.fn(), onReschedule, loading: true });
    const remarcar = botoes('Remarcar')[0];
    expect(remarcar.disabled).toBe(true);
    expect(gatilho().disabled).toBe(true);
    await clicar(remarcar);
    expect(onReschedule).not.toHaveBeenCalled();
  });

  it('com o desfecho de um item gravando, as ações dos outros também esperam', async () => {
    const aulaHoje = { ...visitaHoje, id: 'outro', type: 'aula_experimental', kind: 'class', title: 'Aula experimental' };
    await montar({ items: [visitaHoje, aulaHoje], canOutcome: true, onOutcome: vi.fn(), onReschedule: vi.fn(), savingId: 'appointment' });
    expect(botoes('Remarcar').every((b) => b.disabled)).toBe(true);
    expect(document.body.querySelector('[aria-label="Marcar desfecho: Aula experimental"]').disabled).toBe(true);
  });

  it('salvando, o botão de desfecho fica desligado', async () => {
    await montar({ items: [visitaHoje], canOutcome: true, onOutcome: vi.fn(), savingId: 'appointment' });
    expect(gatilho().disabled).toBe(true);
  });
});
