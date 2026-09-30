// O agendamento feito pelo Stronizap aparece na ficha como o agendamento do
// assistente (a variante 3 da linha do tempo), com a marca do Stronizap antes
// do nome de quem agendou e o canal no detalhe ao passar o mouse (modelo A da
// spec). O desfecho que aponta para esse agendamento diz que ele veio do
// Stronizap. Mesma montagem de profileOriginMarker.test.js: o LeadProfileView
// lê window.location.origin no render, por isso o window falso.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

// A linha do tempo de cada teste, mais recente primeiro, como o useLeadTimeline
// entrega.
const linha = vi.hoisted(() => ({ registros: [] }));

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useLeadTimeline.js', () => ({ useLeadTimeline: () => linha.registros }));
vi.stubGlobal('window', { location: { origin: 'https://stronilead.com.br' } });

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');

const TENANT = 'acad';
const profile = {
  openProfile: () => {},
  leadHref: (leadId) => hrefFor(TENANT, 'ficha', { leadId }),
  from: null,
};

const LEAD = {
  id: 'abc123', name: 'Mariana Souza', whatsapp: '(51) 9 9812-4471', status: 'Primeiro contato',
  createdAt: new Date(2026, 8, 1, 10, 0),
};

// O que a ponte grava quando a Ana agenda pelo Stronizap, no canal Recepção.
const AGENDA = {
  id: 'a1', type: 'note', volumeKind: 'visita', via: 'stronizap', zapChannelName: 'Recepção',
  text: '🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 18:00. Obs: Vem depois do trabalho.',
  consultantName: 'Ana Souza', createdAt: new Date(2026, 8, 29, 15, 42),
};
// O mesmo agendamento, feito pelo assistente da ficha.
const AGENDA_DA_FICHA = { ...AGENDA, id: 'a2', via: undefined, zapChannelName: undefined };
// O comparecimento registrado pela Meta Diária.
const DESFECHO = {
  id: 'd1', type: 'daily_goal_done', dailyGoalCategory: 'visita_hoje', appointmentOutcome: 'attended',
  text: '✅ Compareceu — Meta Diária (Visita Hoje)', consultantName: 'Ana Souza', createdAt: new Date(2026, 9, 1, 18, 40),
};

const ficha = () => renderToString(
  createElement(MemoryRouter, { initialEntries: ['/acad/ficha/abc123'] },
    createElement(LeadProfileContext.Provider, { value: profile },
      createElement(LeadProfileView, {
        lead: LEAD, onTab: () => {}, onBack: () => {},
        appUser: { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad', authUid: 'auth-1' },
        statuses: [], tags: [], lossReasons: [], usersList: [], db: {}, funnels: [],
      }))));

const marcas = (html) => (html.match(/viewBox="0 0 240 240"/g) || []).length;

describe('agendamento feito pelo Stronizap na ficha', () => {
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 1, 19, 0)); });
  afterAll(() => { vi.useRealTimers(); });

  it('é o cartão de agendamento de sempre: título, hora, unidade e anotação', () => {
    linha.registros = [AGENDA];
    const html = ficha();
    expect(html).toContain('Visita à unidade');
    expect(html).toContain('Unidade Centro · Vem depois do trabalho.');
    expect(html).toContain('>Agendado<');
  });

  it('a marca do Stronizap vem antes do nome, e o canal fica no detalhe ao passar o mouse', () => {
    linha.registros = [AGENDA];
    const html = ficha();
    expect(html).toContain('title="Agendado pelo Stronizap, canal Recepção"');
    expect(marcas(html)).toBe(1);
    expect(html.indexOf('viewBox="0 0 240 240"')).toBeLessThan(html.indexOf('>Ana Souza<'));
  });

  it('sem o nome do canal, o detalhe diz só que foi pelo Stronizap', () => {
    linha.registros = [{ ...AGENDA, zapChannelName: null }];
    expect(ficha()).toContain('title="Agendado pelo Stronizap"');
  });

  it('agendamento feito na ficha continua sem a marca, com o nome no detalhe', () => {
    linha.registros = [AGENDA_DA_FICHA];
    const html = ficha();
    expect(marcas(html)).toBe(0);
    expect(html).toContain('title="Ana Souza"');
    expect(html).not.toContain('Agendado pelo Stronizap');
  });

  it('o desfecho aponta para o agendamento de origem e diz que ele veio do Stronizap', () => {
    linha.registros = [DESFECHO, AGENDA];
    const html = ficha();
    expect(html).toContain('>Compareceu<');
    expect(html).toContain('Agendada em 29/09 por Ana Souza, pelo Stronizap');
    expect(marcas(html)).toBe(2);
  });

  it('desfecho de agendamento feito na ficha: o rodapé de sempre, sem a marca', () => {
    linha.registros = [DESFECHO, AGENDA_DA_FICHA];
    const html = ficha();
    expect(html).toContain('Agendada em 29/09 por Ana Souza<');
    expect(html).not.toContain(', pelo Stronizap');
    expect(marcas(html)).toBe(0);
  });
});
