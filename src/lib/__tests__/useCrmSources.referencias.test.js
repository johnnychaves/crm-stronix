// @vitest-environment jsdom
// A carga do painel CRM (useCrmSources) entrega o mesmo objeto, com os mesmos
// months e leadsById, enquanto nada mudou. A tela dos Relatórios (e o painel
// CRM) guardam o último resultado bom num ajuste de estado feito no render, que
// só para de rodar porque o resultado das contas, que depende desses dois, é o
// mesmo entre um render e outro. Se a carga passasse a devolver objetos novos a
// cada render, a tela entraria num laço de renderização: este teste o pega
// antes. Sem Firestore: com db nulo as buscas nem começam, e o que se confere é
// só a identidade do que o hook devolve.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../firebase.js', () => ({
  appId: 'acad', db: {}, auth: {}, storage: {},
  LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', AULAS_PATH: 'aulas', DAILY_GOAL_HISTORY_PATH: 'hist',
}));

const { useCrmSources } = await import('../../hooks/useCrmSources.js');

let root = null;
let container = null;
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  container?.remove();
  root = null;
  container = null;
});

// Registra o que o hook devolve a cada render.
function Sonda({ saidas, args }) {
  saidas.push(useCrmSources(args));
  return null;
}

describe('useCrmSources: referências entre renders', () => {
  it('o objeto, os months e o leadsById são os mesmos enquanto os dados de entrada são os mesmos', async () => {
    const monthKeys = ['2026-08', '2026-09'];
    const liveLeads = [];
    const liveInteractions = [];
    const saidas = [];
    // Cada render traz um objeto de argumentos e um `now` novos, como a tela faz a cada minuto: o que não pode
    // mudar é o que o hook devolve, porque só o mês de agora (texto) e os dados entram nas dependências dele.
    const render = (now) => act(async () => {
      root.render(h(Sonda, { saidas, args: { db: null, enabled: true, now, monthKeys, liveInteractions, liveLeads } }));
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await render(new Date(2026, 8, 14, 12, 0));
    await render(new Date(2026, 8, 14, 12, 1));
    await render(new Date(2026, 8, 14, 12, 2));

    expect(saidas.length).toBeGreaterThanOrEqual(3);
    for (const saida of saidas) {
      expect(saida).toBe(saidas[0]);
      expect(saida.months).toBe(saidas[0].months);
      expect(saida.leadsById).toBe(saidas[0].leadsById);
    }
  });

  it('muda quando o dado muda: uma lista de leads ao vivo nova entrega um leadsById novo', async () => {
    const monthKeys = ['2026-09'];
    const liveInteractions = [];
    const saidas = [];
    const render = (liveLeads) => act(async () => {
      root.render(h(Sonda, { saidas, args: { db: null, enabled: true, now: new Date(2026, 8, 14, 12, 0), monthKeys, liveInteractions, liveLeads } }));
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await render([]);
    const antes = saidas.at(-1);
    await render([{ id: 'novo', createdAt: new Date(2026, 8, 14, 9, 0), consultantId: 'ana' }]);
    const depois = saidas.at(-1);
    expect(depois).not.toBe(antes);
    expect(depois.leadsById).not.toBe(antes.leadsById);
    expect(depois.leadsById.has('novo')).toBe(true);
  });
});
