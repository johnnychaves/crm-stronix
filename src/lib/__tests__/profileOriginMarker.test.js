// O lead cadastrado pelo Stronizap ganha um marco de início na ficha (modelo
// C da spec): uma régua com a pílula "Início · cadastrado pelo Stronizap por
// ..." e, embaixo, o consultor responsável e o canal. Mesma montagem de
// profileTimeline.test.js: o LeadProfileView lê window.location.origin no
// render, por isso o window falso.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';
import { StronizapMark } from '../../components/brand/StronizapMark.jsx';

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
  createdAt: new Date(2026, 8, 28, 14, 32),
};

const NOTA = {
  id: 'n1', type: 'note', text: 'Pediu horário de pilates à noite, depois das 19h.',
  consultantName: 'Ana Souza', createdAt: new Date(2026, 8, 28, 15, 10),
};
const FASE = {
  id: 's1', type: 'status_change', text: 'Fase alterada para [Primeiro contato].',
  consultantName: 'Ana Souza', createdAt: new Date(2026, 8, 28, 14, 40),
};
// Johnny (gestor) cadastrou e passou para a Ana.
const MARCO = {
  id: 'z1', type: 'zap_signup',
  text: 'Cadastrado pelo Stronizap por Johnny. Consultor responsável: Ana Souza. Canal Recepção.',
  consultantName: 'Johnny', ownerName: 'Ana Souza', zapChannelName: 'Recepção',
  createdAt: new Date(2026, 8, 28, 14, 32),
};

const ficha = () => renderToString(
  createElement(MemoryRouter, { initialEntries: ['/acad/ficha/abc123'] },
    createElement(LeadProfileContext.Provider, { value: profile },
      createElement(LeadProfileView, {
        lead: LEAD, onTab: () => {}, onBack: () => {},
        appUser: { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad', authUid: 'auth-1' },
        statuses: [], tags: [], lossReasons: [], usersList: [], db: {}, funnels: [],
      }))));

describe('marco de início do cadastro pelo Stronizap na ficha', () => {
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 28, 16, 0)); });
  afterAll(() => { vi.useRealTimers(); });

  it('fecha a linha do tempo por baixo, com a pílula e o consultor responsável', () => {
    linha.registros = [NOTA, FASE, MARCO];
    const html = ficha();
    expect(html).toContain('cadastrado pelo Stronizap por Johnny em 28/09 às 14:32');
    expect(html).toContain('Consultor responsável Ana Souza · canal Recepção');
    expect(html.indexOf('cadastrado pelo Stronizap')).toBeGreaterThan(html.indexOf('Pediu horário de pilates'));
    expect(html.indexOf('cadastrado pelo Stronizap')).toBeGreaterThan(html.indexOf('>28/09 14:40<'));
  });

  it('não vira linha de nota: o texto gravado não aparece como corpo', () => {
    linha.registros = [NOTA, FASE, MARCO];
    expect(ficha()).not.toContain('Cadastrado pelo Stronizap por Johnny. Consultor responsável');
  });

  it('quem cadastrou ficou com o lead: a linha de baixo fica só com o canal', () => {
    linha.registros = [NOTA, {
      ...MARCO, consultantName: 'Ana Souza', ownerName: undefined,
      text: 'Cadastrado pelo Stronizap por Ana Souza. Canal Recepção.',
    }];
    const html = ficha();
    expect(html).toContain('cadastrado pelo Stronizap por Ana Souza em 28/09 às 14:32');
    expect(html).toContain('>Canal Recepção<');
    expect(html).not.toContain('Consultor responsável Ana Souza');
  });

  it('com o marco, a linha genérica "Início da jornada" sai; sem ele, continua', () => {
    linha.registros = [NOTA, FASE, MARCO];
    expect(ficha()).not.toContain('Início da jornada');
    linha.registros = [NOTA, FASE];
    expect(ficha()).toContain('Início da jornada');
  });

  it('conta em Marcos junto com a troca de fase', () => {
    linha.registros = [NOTA, FASE, MARCO];
    expect(ficha()).toMatch(/Marcos<span class="num opacity-65">2<\/span>/);
  });

  it('observação do cadastro no mesmo horário do marco fica acima dele, venha na ordem que vier', () => {
    const OBS = {
      id: 'o1', type: 'note', text: 'OBSERVAÇÃO DO CADASTRO: Prefere treinar de manhã.',
      consultantName: 'Johnny', createdAt: MARCO.createdAt,
    };
    for (const ordem of [[MARCO, OBS], [OBS, MARCO]]) {
      linha.registros = ordem;
      const html = ficha();
      expect(html).toContain('Prefere treinar de manhã.');
      expect(html.indexOf('cadastrado pelo Stronizap')).toBeGreaterThan(html.indexOf('Prefere treinar de manhã.'));
    }
  });

  it('a pílula leva a marca do Stronizap, com as cores dos dois temas', () => {
    linha.registros = [MARCO];
    const html = ficha();
    expect(html).toContain('viewBox="0 0 240 240"');
    expect(html).toContain('fill-[#1A1D20] dark:fill-white');
  });
});

describe('StronizapMark', () => {
  it('balão e raio do logo, com a versão clara no tema escuro', () => {
    const svg = renderToString(createElement(StronizapMark, { size: 13 }));
    expect(svg).toContain('width="13"');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('d="M 120 30 C 70 30, 30 70, 30 120');
    expect(svg).toContain('d="M 138 56 L 84 132 L 116 132 L 102 184 L 156 108 L 124 108 Z"');
    expect(svg).toContain('stroke-width="8"');
    expect(svg).toContain('stroke-linejoin="round"');
    expect(svg).toContain('fill-[#25D366] stroke-[#25D366] dark:fill-[#128C7E] dark:stroke-[#128C7E]');
  });
});
