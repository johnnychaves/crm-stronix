// As peças da aba Contratos renderizadas sozinhas, em node (renderToString),
// com a geometria e os fatos vindos das funções puras de lib/contractsTab.js.
// Nenhuma delas tem link nem lê contexto, então não precisam de Router.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { ContractTimeline, HATCH_VIOLET } from '../../components/profile/contracts/ContractTimeline.jsx';
import { contractFactsOf, contractTimelineOf } from '../contractsTab.js';
import { ContractHistoryTable } from '../../components/profile/contracts/ContractHistoryTable.jsx';

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

describe('ContractHistoryTable', () => {
  const todos = [trimestral, start24, emUso, proximo];

  it('uma linha por contrato, com origem, datas, motivo, trancamento, valores e situação', () => {
    const rows = [start24, trimestral].map((c) => contractFactsOf(c, todos, HOJE, 30));
    const html = renderToString(createElement(ContractHistoryTable, { rows, firstName: 'Ana', hasContract: true }));
    expect(html).toContain('>Histórico<');
    expect(html).toContain('>2 anteriores<');
    ['>Contrato<', '>Início<', '>Fim previsto<', '>Fim de fato<', '>Trancado<', '>Valor<', '>Média/mês<', '>Situação<'].forEach((th) => expect(html).toContain(th));
    expect(html).toContain('retorno, 89 dias depois');
    expect(html).toContain('>20/09/2024<');
    expect(html).toContain('>20/09/2025<');
    expect(html).toContain('>10/10/2025<');
    expect(html).toContain('20 dias depois, pelo trancamento');
    expect(html).toContain('>20 dias<');
    expect(html).toContain('>1 vez<');
    expect(html).toContain('R$ 1.188,00');
    expect(html).toContain('R$ 99,00');
    expect(html).toContain('>Renovado<');
    expect(html).toContain('primeira matrícula');
    expect(html).toContain('cancelado · Financeiro');
    expect(html).toContain('>Nunca<');
    expect(html).toContain('>Cancelado<');
    expect(html).toContain('overflow-x-auto overscroll-x-contain');
    // Fechada, a linha não mostra os detalhes.
    expect(html).not.toContain('>Fechado por<');
  });

  it('a linha aberta mostra desconto, quem fechou, código, cancelamento e trancamentos', () => {
    const cancelado = { ...emUso, status: 'cancelado', cancelledAt: D(2026, 9, 25), cancelReason: 'Financeiro', cancelNote: 'Vai voltar em janeiro' };
    const rows = [contractFactsOf(cancelado, [start24, cancelado], HOJE, 30)];
    const html = renderToString(createElement(ContractHistoryTable, { rows, firstName: 'Ana', hasContract: false, defaultOpenId: 'k1' }));
    expect(html).toContain('>Desconto<');
    expect(html).toContain('−R$ 120,00');
    expect(html).toContain('fidelidade');
    expect(html).toContain('tabela R$ 1.428,00');
    expect(html).toContain('>Fechado por<');
    expect(html).toContain('>Ana<');
    expect(html).toContain('em 09/10/2025');
    expect(html).toContain('>Código<');
    expect(html).toContain('#K1');
    expect(html).toContain('12 meses');
    expect(html).toContain('>Cancelamento<');
    expect(html).toContain('25/09/2026');
    expect(html).toContain('Vai voltar em janeiro');
    expect(html).toContain('>Trancamentos<');
    expect(html).toContain('Nunca trancado');
    expect(html).toContain('aria-expanded="true"');
  });

  it('trancado quando a renovação começou: renovado, com a nota na linha aberta e os períodos', () => {
    const trancado = { ...emUso, status: 'trancado', pausedAt: D(2026, 9, 20), pausedDaysTotal: 5, pauseHistory: [{ pausedAt: D(2026, 3, 1), resumedAt: D(2026, 3, 6) }] };
    const rows = [contractFactsOf(trancado, [trancado, proximo], D(2026, 10, 15), 30)];
    const html = renderToString(createElement(ContractHistoryTable, { rows, firstName: 'Ana', hasContract: true, defaultOpenId: 'k1' }));
    expect(html).toContain('>Renovado<');
    expect(html).toContain('Estava trancado quando a renovação começou.');
    expect(html).toContain('01/03/2026 a 06/03/2026');
    expect(html).toContain('desde 20/09/2026');
    expect(html).toContain('>2 vezes<');
  });

  it('sem contrato anterior', () => {
    const comContrato = renderToString(createElement(ContractHistoryTable, { rows: [], firstName: 'Ana', hasContract: true }));
    expect(comContrato).toContain('Nenhum contrato anterior');
    expect(comContrato).toContain('Este é o primeiro contrato de Ana.');
    const semContrato = renderToString(createElement(ContractHistoryTable, { rows: [], firstName: 'Ana', hasContract: false }));
    expect(semContrato).toContain('O histórico de planos aparecerá aqui.');
  });
});
