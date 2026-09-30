// As peças da aba Contratos renderizadas sozinhas, em node (renderToString),
// com a geometria e os fatos vindos das funções puras de lib/contractsTab.js.
// Nenhuma delas tem link nem lê contexto, então não precisam de Router.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { ContractTimeline, HATCH_VIOLET } from '../../components/profile/contracts/ContractTimeline.jsx';
import { contractTimelineOf } from '../contractsTab.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const HOJE = new Date(2026, 8, 30, 10, 0);
const K = (id, extra) => ({
  id, leadId: 'l1', planName: `Plano ${id}`, value: 1200, listValue: 1200, durationMonths: 12, status: 'ativo', consultantName: 'Ana', ...extra
});
const trimestral = K('t1', {
  planName: 'Trimestral', value: 447, listValue: 447, durationMonths: 3, status: 'cancelado',
  startsAt: D(2024, 5, 6), endsAt: D(2024, 8, 6), cancelledAt: D(2024, 6, 22), cancelReason: 'Financeiro', createdAt: D(2024, 5, 6)
});
const start24 = K('s1', {
  planName: 'Start', value: 1188, listValue: 1188, startsAt: D(2024, 9, 20), endsAt: D(2025, 10, 10), createdAt: D(2024, 9, 20),
  pausedDaysTotal: 20, resumedAt: D(2025, 1, 25), pauseHistory: [{ pausedAt: D(2025, 1, 5), resumedAt: D(2025, 1, 25) }]
});
const emUso = K('k1', {
  planName: 'Start', value: 1308, listValue: 1428, discountReason: 'Fidelidade', renewedFromId: 's1',
  startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11), createdAt: D(2025, 10, 9)
});
const proximo = K('k2', {
  planName: 'Flow', value: 1788, listValue: 1788, renewedFromId: 'k1', seamless: true,
  startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12), createdAt: D(2026, 9, 28)
});

describe('ContractTimeline', () => {
  it('desenha os segmentos com title, a hachura do próximo, a pausa, os marcos e o hoje', () => {
    const timeline = contractTimelineOf({ contracts: [trimestral, start24, emUso, proximo], heroId: 'k1', nextId: 'k2', now: HOJE, checkpoints: [90, 60, 30] });
    const html = renderToString(createElement(ContractTimeline, { timeline }));
    expect(html).toContain('>Vigência<');
    expect(html).toContain('title="Trimestral · cancelado em 22/06/2024"');
    expect(html).toContain('title="Start · 20/09/2024 a 10/10/2025"');
    expect(html).toContain('title="Start · em uso até 11/10/2026"');
    expect(html).toContain('title="Flow · começa em 12/10/2026"');
    expect(html).toContain('title="Trancado de 05/01/2025 a 25/01/2025"');
    expect(html).toContain('title="Marco de 30 dias · 11/09/2026 · passou sem contato"');
    expect(html).toContain('>hoje<');
    expect(html).toContain('>2026<');
    expect(html).toContain(`background-image:${HATCH_VIOLET}`);
    // O em uso encosta nos dois vizinhos: sem canto arredondado nas pontas.
    expect(html).toMatch(/class="absolute top-0 h-2\.5 bg-emerald-500" style="left:[\d.]+%;width:[\d.]+%"/);
    // O cancelado, solto, tem os dois cantos.
    expect(html).toMatch(/class="absolute top-0 h-2\.5 bg-rose-400 rounded-l-full rounded-r-full"/);
  });

  it('sem linha do tempo, não desenha nada', () => {
    expect(renderToString(createElement(ContractTimeline, { timeline: null }))).toBe('');
  });
});
