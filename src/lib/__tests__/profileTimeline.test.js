// A linha do tempo da ficha diz o dia e a hora de cada registro. Antes, os
// blocos eram Hoje, Ontem, Esta semana e Este mês e a linha mostrava só a
// hora, então uma nota sozinha em "Esta semana" ficava sem o dia.
// A faixa de contrato (matrícula, renovação, cancelamento) lê o plano e o valor
// do texto do próprio evento, e trancamento, reativação e correção ficam numa
// linha comum. O texto dos eventos aqui é o que o app grava de verdade
// (contracts.js): a faixa só nasce de um texto que o contractEventOf reconhece.
// O LeadProfileView lê window.location.origin no render (link de indicação),
// por isso o window falso, como em profileLinks.test.js.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';
import { fmtBRL } from '../format.js';

// Mais recente primeiro, como o useLeadTimeline entrega. `timeline.atual` é o que
// o hook devolve na hora: o ficha() troca a cada render, então a lista própria de
// um teste não vaza para o seguinte.
const { REGISTROS, timeline } = vi.hoisted(() => ({
  REGISTROS: [
    { id: 'n1', type: 'note', text: 'Pediu horário da aula de sábado', consultantName: 'Johnny', createdAt: new Date(2026, 8, 25, 14, 32) },
    { id: 'n2', type: 'note', text: 'Vai conversar com o marido', consultantName: 'Ana', createdAt: new Date(2026, 8, 22, 11, 2) },
    { id: 'c1', type: 'status_change', text: 'Matrícula realizada — Plano Anual (R$ 1.308,00). Vigência até 01/09/2027.', consultantName: 'Ana', createdAt: new Date(2026, 8, 3, 18, 45) },
    { id: 'n3', type: 'note', text: 'Chegou pelo Instagram', consultantName: 'Ana', createdAt: new Date(2026, 7, 30, 16, 20) },
  ],
  timeline: { atual: [] },
}));

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useLeadTimeline.js', () => ({ useLeadTimeline: () => timeline.atual }));
vi.stubGlobal('window', { location: { origin: 'https://stronilead.com.br' } });

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');

const TENANT = 'acad';
const profile = {
  openProfile: () => {},
  leadHref: (leadId) => hrefFor(TENANT, 'ficha', { leadId }),
  from: null,
};

const LEAD = {
  id: 'abc123', name: 'Ana Lima', whatsapp: '11999990000', status: 'Novo',
  createdAt: new Date(2026, 7, 20, 10, 0),
};

// `lead` sobrescreve campos do LEAD e `registros` troca o que o hook devolve.
const ficha = ({ lead = {}, registros = REGISTROS } = {}) => {
  timeline.atual = registros;
  return renderToString(
    createElement(MemoryRouter, { initialEntries: ['/acad/ficha/abc123'] },
      createElement(LeadProfileContext.Provider, { value: profile },
        createElement(LeadProfileView, {
          lead: { ...LEAD, ...lead }, onTab: () => {}, onBack: () => {},
          appUser: { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad', authUid: 'auth-1' },
          statuses: [], tags: [], lossReasons: [], usersList: [], db: {}, funnels: [],
        }))));
};

describe('linha do tempo da ficha: dia e hora em cada registro', () => {
  // Sexta, 25/09/2026 às 15h: com os blocos antigos, n1 caía em Hoje, n2 em
  // Esta semana e c1 em Este mês.
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 25, 15, 0)); });
  afterAll(() => { vi.useRealTimers(); });

  it('cada linha mostra o dia e a hora em que foi registrada', () => {
    const html = ficha();
    expect(html).toContain('>25/09 14:32<');
    expect(html).toContain('>22/09 11:02<');
    expect(html).toContain('>30/08 16:20<');
  });

  it('a faixa da matrícula também mostra o dia e a hora', () => {
    const html = ficha();
    // Só a faixa de marco leva a régua border-t-2, e a matrícula é o único marco
    // da lista: sem isso a linha podia ser comum e o teste passar do mesmo jeito.
    expect(html).toContain('border-t-2');
    expect(html).toContain('>03/09 18:45<');
  });

  it('os blocos são o mês com o ano, sem Hoje, Ontem, Esta semana ou Este mês', () => {
    const html = ficha();
    expect(html).toContain('>Setembro de 2026<');
    expect(html).toContain('>Agosto de 2026<');
    expect(html).not.toMatch(/>(Hoje|Ontem|Esta semana|Este mês)</);
  });
});

describe('linha do tempo da ficha: faixas de contrato', () => {
  it('a faixa da matrícula mostra o plano e o valor do próprio evento, não os do contrato de hoje', () => {
    // O contrato de hoje é outro. Lendo da ficha, a matrícula de setembro
    // apareceria como Mensal, R$ 149,00.
    const html = ficha({ lead: { currentPlanName: 'Mensal', currentContractValue: 149 } });
    expect(html).toContain('border-t-2');
    expect(html).toContain('>Anual<');
    // Com o `>` e o `<` em volta: "R$ 1.308,00" também está no subtítulo da faixa
    // (o texto do evento), então sem eles o teste passaria sem o valor na faixa.
    expect(html).toContain(`>${fmtBRL(1308)}<`);
    expect(html).not.toContain('>Mensal<');
    expect(html).not.toContain(`>${fmtBRL(149)}<`);
  });

  it('trancamento não vira faixa: fica numa linha comum do tipo Contrato', () => {
    const trancamento = {
      id: 't1', type: 'status_change', consultantName: 'Ana', createdAt: new Date(2026, 8, 10, 9, 15),
      text: 'Contrato trancado a partir de 10/09/2026 — Plano Anual — Viagem.',
    };
    const html = ficha({ registros: [trancamento] });
    expect(html).not.toContain('border-t-2');
    expect(html).toContain('>Contrato<');
    expect(html).toContain('>Contrato trancado a partir de 10/09/2026 — Plano Anual — Viagem.<');
    expect(html).toContain('>10/09 09:15<');
  });
});

// O agendamento que deixou a tarefa do dia com outra pessoa termina com
// " · tarefa de <nome>" (taskOwnerText, em schedulePatch.js). O cartão do
// agendamento mostra "Tarefa de <nome>" nos detalhes, junto da unidade e da
// anotação. É assim que o dono do lead vê, pela ficha, que outra pessoa vai
// cuidar da visita, da aula ou do contato.
describe('linha do tempo da ficha: de quem é a tarefa do agendamento', () => {
  const agendamento = (id, text) => ({ id, type: 'note', text, consultantName: 'Ana', createdAt: new Date(2026, 8, 29, 15, 42) });

  it('visita agendada por outra pessoa: "Tarefa de" entre a unidade e a anotação', () => {
    const html = ficha({ registros: [agendamento('a1', '🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 18:00 · tarefa de Bruno Lima. Obs: Vem depois do trabalho.')] });
    expect(html).toContain('>Unidade Centro · Tarefa de Bruno Lima · Vem depois do trabalho. · ');
  });

  it('aula com professor e contato delegado também mostram de quem é a tarefa', () => {
    const html = ficha({
      registros: [
        agendamento('a1', '🔔 Aula Experimental agendada (Pilates · 1 aula) · Carla Dias p/ 02/10/2026, 19:00 · tarefa de Ana Souza.'),
        agendamento('m1', '🔔 Mensagem agendada p/ 08/10/2026, 10:00 · tarefa de Bia.'),
      ],
    });
    expect(html).toContain('>Tarefa de Ana Souza · ');
    expect(html).toContain('>Tarefa de Bia · ');
  });

  it('agendamento que ficou com o dono do lead não diz de quem é a tarefa', () => {
    const html = ficha({ registros: [agendamento('a1', '🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 18:00. Obs: Vem depois do trabalho.')] });
    expect(html).toContain('>Unidade Centro · Vem depois do trabalho. · ');
    expect(html).not.toContain('Tarefa de');
  });
});
