// O agendamento feito pelo Stronizap aparece na ficha como o agendamento do
// assistente (a variante 3 da linha do tempo), com a marca do Stronizap antes
// do nome de quem agendou e o canal no detalhe ao passar o mouse (modelo A da
// spec). A marca vale só para a linha de agendamento, o nome inteiro continua
// no title do nome e o detalhe também chega ao leitor de tela. O desfecho que
// aponta para esse agendamento diz que ele veio do Stronizap. Mesma montagem
// de profileOriginMarker.test.js: o LeadProfileView lê window.location.origin
// no render, por isso o window falso.
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

// Uma nota e uma conversa que levam o campo via. Hoje só o agendamento grava
// esse campo, mas a ponte pode reaproveitá-lo em outras linhas.
const NOTA_COM_VIA = {
  id: 'n1', type: 'note', via: 'stronizap', zapChannelName: 'Recepção',
  text: 'Pediu horário de pilates à noite.', consultantName: 'Ana Souza', createdAt: new Date(2026, 8, 29, 16, 0),
};
const CONVERSA_COM_VIA = {
  id: 'c1', type: 'note', via: 'stronizap', zapChannelName: 'Recepção',
  text: '📲 Mensagem WhatsApp enviada: Oi, Mariana!', consultantName: 'Ana Souza', createdAt: new Date(2026, 8, 29, 16, 5),
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

  it('o mouse em cima do nome mostra o nome inteiro, e em cima da marca mostra o detalhe do Stronizap', () => {
    const nome = 'Ana Carolina de Albuquerque Souza';
    linha.registros = [{ ...AGENDA, consultantName: nome }];
    const html = ficha();
    // A célula guarda o detalhe, e com ela a marca.
    expect(html).toMatch(/<div class="[^"]*" title="Agendado pelo Stronizap, canal Recepção">/);
    // O nome corta na coluna estreita ao lado da marca: o title dele guarda o nome inteiro.
    expect(html).toContain(`<span class="truncate" title="${nome}">${nome}</span>`);
  });

  it('o detalhe do Stronizap chega ao leitor de tela, e a marca fica só decorativa', () => {
    linha.registros = [AGENDA];
    const html = ficha();
    // O title não chega a leitor de tela nem ao toque: o texto também vai dentro da célula.
    expect(html).toContain('<span class="sr-only">Agendado pelo Stronizap, canal Recepção</span>');
    expect(html).toMatch(/<svg viewBox="0 0 240 240"[^>]*aria-hidden="true"/);
  });

  it('sem o nome do canal, o detalhe diz só que foi pelo Stronizap', () => {
    linha.registros = [{ ...AGENDA, zapChannelName: null }];
    const html = ficha();
    expect(html).toContain('title="Agendado pelo Stronizap"');
    expect(html).toContain('<span class="sr-only">Agendado pelo Stronizap</span>');
  });

  it('agendamento feito na ficha continua sem a marca, com o nome no detalhe', () => {
    linha.registros = [AGENDA_DA_FICHA];
    const html = ficha();
    expect(marcas(html)).toBe(0);
    expect(html).toContain('title="Ana Souza"');
    expect(html).not.toContain('Agendado pelo Stronizap');
  });

  it.each([
    ['uma nota', NOTA_COM_VIA, 'Pediu horário de pilates à noite.'],
    ['uma conversa', CONVERSA_COM_VIA, 'Oi, Mariana!'],
  ])('%s com o campo via sai sem a marca e com o nome de sempre', (_tipo, registro, corpo) => {
    linha.registros = [registro];
    const html = ficha();
    expect(html).toContain(corpo);
    expect(marcas(html)).toBe(0);
    expect(html).not.toContain('Agendado pelo Stronizap');
    // A coluna do autor sai como a de qualquer linha comum: o nome direto na célula, com o title dele.
    expect(html).toMatch(/<div class="[^"]*truncate[^"]*" title="Ana Souza">Ana Souza<\/div>/);
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

  // Com dois agendamentos antes do desfecho, o rodapé aponta para o mais
  // recente e leva a origem dele. Quem pega o mais antigo erra nos dois
  // sentidos abaixo.
  it('dois agendamentos antes do desfecho, o antigo pelo Stronizap e o novo pela ficha: o rodapé é o do novo, sem a marca', () => {
    const antigo = { ...AGENDA, id: 'a0', createdAt: new Date(2026, 8, 28, 10, 5) };
    const novo = { ...AGENDA_DA_FICHA, id: 'a3', consultantName: 'Bruno Lima', createdAt: new Date(2026, 8, 30, 9, 15) };
    linha.registros = [DESFECHO, novo, antigo];
    const html = ficha();
    expect(html).toContain('Agendada em 30/09 por Bruno Lima<');
    expect(html).not.toContain(', pelo Stronizap');
    // Uma marca só: a do autor do agendamento antigo. O rodapé não leva nenhuma.
    expect(marcas(html)).toBe(1);
  });

  it('dois agendamentos antes do desfecho, o antigo pela ficha e o novo pelo Stronizap: o rodapé é o do novo, com a marca', () => {
    const antigo = { ...AGENDA_DA_FICHA, id: 'a0', consultantName: 'Bruno Lima', createdAt: new Date(2026, 8, 28, 10, 5) };
    const novo = { ...AGENDA, id: 'a3', createdAt: new Date(2026, 8, 30, 9, 15) };
    linha.registros = [DESFECHO, novo, antigo];
    const html = ficha();
    expect(html).toContain('Agendada em 30/09 por Ana Souza, pelo Stronizap');
    // Duas marcas: a do autor do agendamento novo e a do rodapé.
    expect(marcas(html)).toBe(2);
  });
});
