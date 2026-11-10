// A ficha com as linhas do Stronizap (Parte B, PR 3, desenho B): as três
// linhas de um dia viram um cartão só, as pílulas e o "N registros" do mês
// contam o cartão como um, e o número da aba Linha do tempo continua contando
// as linhas gravadas. Mesma montagem de profileTimeline.test.js: o
// LeadProfileView lê window.location.origin no render, por isso o window falso.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

const { timeline } = vi.hoisted(() => ({ timeline: { atual: [] } }));

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useLeadTimeline.js', () => ({ useLeadTimeline: () => timeline.atual }));
vi.stubGlobal('window', { location: { origin: 'https://stronilead.com.br' } });

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');

const profile = {
  openProfile: () => {},
  leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }),
  from: null,
};
const LEAD = { id: 'abc123', name: 'Mateus Ferreira', whatsapp: '51999990000', status: 'Novo', createdAt: new Date(2026, 10, 8, 17, 58) };

// O HTML sem os comentários que o React põe entre textos vizinhos.
const ficha = (registros) => {
  timeline.atual = registros;
  return renderToString(
    createElement(MemoryRouter, { initialEntries: ['/acad/ficha/abc123'] },
      createElement(LeadProfileContext.Provider, { value: profile },
        createElement(LeadProfileView, {
          lead: LEAD, onTab: () => {}, onBack: () => {},
          appUser: { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad', authUid: 'auth-1' },
          statuses: [], tags: [], lossReasons: [], usersList: [], db: {}, funnels: [],
        })))).replace(/<!-- -->/g, '');
};

const at = (d, hh, mm = 0) => new Date(2026, 10, d, hh, mm);
const zap = (tipo, signal, createdAt, extra) => ({ id: `zap-abc123-2026-11-09-${tipo}`, leadId: 'abc123', type: 'zap_signal', signal, via: 'stronizap', createdAt, ...extra });
// Mais recente primeiro, como o useLeadTimeline entrega.
const NOTA = { id: 'n1', leadId: 'abc123', type: 'note', text: 'Pediu valores e perguntou de horário à noite.', consultantName: 'Ana Souza', createdAt: at(9, 14, 50) };
const EQUIPE = zap('equipe', 'pessoa_enviou', at(9, 14, 40), { answering: true, consultantName: 'Ana Souza', actorId: 'u-ana', text: 'Resposta de Ana Souza.' });
const IA = zap('ia', 'ia_enviou', at(9, 14, 33), { answering: true, byAi: true, consultantName: null, text: 'Resposta da IA.' });
const LEAD_ESCREVEU = zap('lead', 'lead_escreveu', at(9, 14, 32), { answering: false, consultantName: null, text: 'Lead escreveu: “Oi, queria saber o valor da musculação”' });
const ONTEM = { id: 'n0', leadId: 'abc123', type: 'note', text: 'Origem Instagram, interesse em musculação.', consultantName: 'Ana Souza', createdAt: at(8, 17, 58) };
const REGISTROS = [NOTA, EQUIPE, IA, LEAD_ESCREVEU, ONTEM];

describe('ficha: o cartão do dia do Stronizap', () => {
  it('as três linhas do dia viram um cartão só, entre a anotação e o registro de ontem', () => {
    const html = ficha(REGISTROS);
    expect(html.split('Conversa no Stronizap').length - 1).toBe(1);
    const iNota = html.indexOf('Pediu valores');
    const iCartao = html.indexOf('Conversa no Stronizap');
    const iOntem = html.indexOf('Origem Instagram');
    expect(iNota).toBeGreaterThan(-1);
    expect(iNota).toBeLessThan(iCartao);
    expect(iCartao).toBeLessThan(iOntem);
    expect(html).toContain('8 min depois');
    expect(html).not.toContain('Ver no Stronizap');
  });

  it('as pílulas e o mês contam o cartão como um registro', () => {
    const html = ficha(REGISTROS);
    expect(html).toContain('aria-label="Tudo, 3"');
    expect(html).toContain('aria-label="Conversas, 1"');
    expect(html).toContain('aria-label="Anotações, 2"');
    expect(html).toContain('>3 registros<');
  });

  it('o número da aba Linha do tempo continua contando as linhas gravadas', () => {
    const html = ficha(REGISTROS);
    expect(html).toMatch(/Linha do tempo<span class="num text-\[10\.5px\][^"]*">5<\/span>/);
  });
});

describe('Quem não usa o Stronizap: a ficha fica como hoje', () => {
  it('sem linha do Stronizap, nada de cartão, e as contagens são as de sempre', () => {
    const html = ficha([NOTA, ONTEM]);
    expect(html).not.toContain('Conversa no Stronizap');
    expect(html).toContain('aria-label="Tudo, 2"');
    expect(html).toContain('aria-label="Conversas, 0"');
    expect(html).toContain('>2 registros<');
    expect(html).toMatch(/Linha do tempo<span class="num text-\[10\.5px\][^"]*">2<\/span>/);
  });
});
