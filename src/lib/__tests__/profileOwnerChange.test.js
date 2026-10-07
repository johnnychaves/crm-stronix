// A troca de responsável aparece na ficha como linha própria. Ela é gravada
// como status_change, "Responsável alterado de [Ana] para [Bruno]."
// (ownerChangeNote, em clientRegistration.js), e a ficha lia o primeiro
// colchete como etapa: a troca saía como mudança de fase, com o nome de quem
// saía num chip, e esse nome virava a origem da fase seguinte ("após 4d em Ana
// Souza"). Mesma montagem de profileZapSchedule.test.js: o LeadProfileView lê
// window.location.origin no render, por isso o window falso.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';
import { ownerChangeNote } from '../clientRegistration.js';

// A linha do tempo, mais recente primeiro, como o useLeadTimeline entrega.
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
  id: 'abc123', name: 'Mariana Souza', whatsapp: '(51) 9 9812-4471', status: 'Negociação',
  createdAt: new Date(2026, 8, 1, 10, 0),
};

const fase = (id, day, stage) => ({
  id, type: 'status_change', text: `Movido para a etapa [${stage}] via Kanban.`,
  consultantName: 'Ana Souza', createdAt: new Date(2026, 8, day, 10, 0),
});
// A troca feita pelo cadastro completo da ficha, gravada pelo logInteraction.
const TROCA = {
  id: 'r1', type: 'status_change', text: ownerChangeNote({ fromName: 'Ana Souza', toName: 'Bruno Lima' }),
  consultantName: 'Carla Gestora', createdAt: new Date(2026, 8, 5, 10, 0),
};

const ficha = () => renderToString(
  createElement(MemoryRouter, { initialEntries: ['/acad/ficha/abc123'] },
    createElement(LeadProfileContext.Provider, { value: profile },
      createElement(LeadProfileView, {
        lead: LEAD, onTab: () => {}, onBack: () => {},
        appUser: { id: 'u1', name: 'Carla Gestora', role: 'admin', tenantId: 'acad', authUid: 'auth-1' },
        statuses: [], tags: [], lossReasons: [], usersList: [], db: {}, funnels: [],
      }))));

describe('troca de responsável na linha do tempo da ficha', () => {
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 1, 19, 0)); });
  afterAll(() => { vi.useRealTimers(); });

  it('aparece como linha própria, com o texto sem colchetes e o tipo Responsável', () => {
    linha.registros = [TROCA];
    const html = ficha();
    expect(html).toContain('Responsável alterado de Ana Souza para Bruno Lima.');
    expect(html).not.toContain('[Ana Souza]');
    expect(html).toContain('>Responsável<');
  });

  // Sem etapa, a linha passa pela regra da perda, que procura "perda" ou
  // "perdid" no texto. Um nome assim não pode pintar a faixa de oportunidade
  // encerrada.
  it('não vira faixa de perda quando um nome tem "perdid" ou "perda"', () => {
    const texto = ownerChangeNote({ fromName: 'Ana Souza', toName: 'Carteira de perdidos' });
    linha.registros = [{ ...TROCA, text: texto }];
    const html = ficha();
    expect(html).not.toContain('Oportunidade encerrada');
    expect(html).toContain('Responsável alterado de Ana Souza para Carteira de perdidos.');
  });

  it('não vira origem da mudança de fase seguinte', () => {
    linha.registros = [fase('c', 9, 'Negociação'), TROCA, fase('a', 2, 'Contato feito')];
    const html = ficha();
    expect(html).toContain('após 7d em Contato feito');
    expect(html).not.toContain('em Ana Souza');
  });
});
