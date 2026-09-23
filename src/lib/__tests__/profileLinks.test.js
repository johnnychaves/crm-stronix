// Da ficha para outra ficha: "Indicado por" e a aba Indicações. O LeadProfileView
// lê window.location.origin no render (link de indicação), por isso o window
// falso.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

// CONTRACTS_PATH entra porque a ficha o importa. Hoje ela não o usa no render,
// mas sem ele no mock o dia em que voltar a usar quebra este teste aqui, longe
// de onde a mudança aconteceu.
vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useLeadTimeline.js', () => ({ useLeadTimeline: () => [] }));
vi.stubGlobal('window', { location: { origin: 'https://stronilead.com.br' } });

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');
const { ReferralsSection } = await import('../../components/profile/ReferralsSection.jsx');

const TENANT = 'acad';
const profile = {
  openProfile: () => {},
  leadHref: (leadId) => hrefFor(TENANT, 'ficha', { leadId }),
  from: null,
};

const LEAD = {
  id: 'abc123', name: 'Ana Lima', whatsapp: '11999990000', status: 'Novo',
  createdAt: new Date('2026-09-01'), referredById: 'zzz999', referredByName: 'Carla Dias',
};

function render(element) {
  return renderToString(
    createElement(MemoryRouter, { initialEntries: ['/acad/ficha/abc123'] },
      createElement(LeadProfileContext.Provider, { value: profile }, element)));
}

// authUid é o que faz a ficha renderizar em modo de edição (canEditLead). Sem
// ele o lápis do vínculo nem aparece no HTML.
const ficha = (lead = LEAD) => render(createElement(LeadProfileView, {
  lead, onBack: () => {}, appUser: { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad', authUid: 'auth-1' },
  statuses: [], tags: [], lossReasons: [], usersList: [], db: {}, funnels: [],
}));

describe('ficha', () => {
  // "Indicado por {nome}" são dois filhos de texto, e o renderToString os
  // separa com um comentário: o HTML real é "Indicado por <!-- -->Carla Dias".
  // Por isso a busca é só pelo pedaço fixo, e o nome se confere à parte.
  it('"Indicado por" é link para a ficha de quem indicou', () => {
    const html = ficha();
    const i = html.indexOf('Indicado por');
    expect(i).toBeGreaterThan(-1);
    const abertura = html.lastIndexOf('<a ', i);
    expect(html.slice(abertura, i)).toContain('href="/acad/ficha/zzz999"');
    expect(html).toContain('Carla Dias');
  });

  it('indicação sem id fica texto sem link', () => {
    const html = ficha({ ...LEAD, referredById: null });
    const i = html.indexOf('Indicado por');
    expect(i).toBeGreaterThan(-1);
    expect(html.slice(html.lastIndexOf('<', i), i)).not.toContain('href');
  });

  it('o lápis do vínculo continua botão', () => {
    const html = ficha();
    const i = html.indexOf('title="Editar vínculo de indicação"');
    expect(i).toBeGreaterThan(-1);
    expect(html.lastIndexOf('<button', i)).toBeGreaterThan(html.lastIndexOf('<a ', i));
  });
});

describe('aba Indicações', () => {
  const lista = () => render(createElement(ReferralsSection, {
    items: [{ id: 'zzz999', name: 'Carla Dias', referredAt: new Date('2026-09-10') }],
    loading: false,
  }));

  it('cada indicado é um link para a ficha', () => {
    const html = lista();
    expect(html).toContain('href="/acad/ficha/zzz999"');
    expect(html).toContain('Carla Dias');
  });

  it('a linha mantém as classes de antes', () => {
    const html = lista();
    const i = html.indexOf('href="/acad/ficha/zzz999"');
    const linha = html.slice(html.lastIndexOf('<a ', i), i + 300);
    expect(linha).toContain('w-full flex items-center gap-3');
    expect(linha).toContain('hover:bg-slate-50');
  });
});
