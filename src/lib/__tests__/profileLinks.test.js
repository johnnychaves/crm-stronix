// Da ficha para outra ficha: "Indicado por" e a aba Indicações. O LeadProfileView
// lê window.location.origin no render (link de indicação), por isso o window
// falso.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor, FICHA_TABS } from '../routes.js';

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
const ficha = (lead = LEAD, tab = undefined) => render(createElement(LeadProfileView, {
  lead, tab, onTab: () => {},
  onBack: () => {}, appUser: { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad', authUid: 'auth-1' },
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

  it('"Indicado por" não é arrastável', () => {
    // Sem draggable={false} arrastar o texto leva o endereço da ficha para
    // outra aba ou para um campo de texto, e o clique com tremida não abre.
    const html = ficha();
    const i = html.indexOf('Indicado por');
    expect(html.slice(html.lastIndexOf('<a ', i), i)).toContain('draggable="false"');
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

// As abas desenhadas, na ordem, pelo que o Radix escreve no botão: o id termina
// em `-trigger-<value>` e o estado vem em data-state. Só a abertura da tag entra
// na conta, para nenhum data-state de dentro do botão ser confundido com o dele.
const abasDaFicha = (html) => html.split('<button')
  .map((pedaco) => pedaco.slice(0, pedaco.indexOf('>')))
  .filter((tag) => tag.includes('role="tab"'))
  .map((tag) => ({ aba: tag.match(/-trigger-([A-Za-z-]+)"/)?.[1] ?? null, ativa: tag.includes('data-state="active"') }));
const abaAtiva = (html) => abasDaFicha(html).find((t) => t.ativa)?.aba ?? null;

// A aba da ficha vem do endereço (/ficha/<id>/<aba>), e o segmento de cada uma
// mora em FICHA_TABS. Aqui os dois lados se encontram: a ficha renderiza com
// cada chave da tabela e a aba que acende tem que ser aquela. Aba nova na ficha
// sem entrada na tabela, ou o contrário, cai aqui.
describe('abas da ficha no endereço', () => {
  const CLIENTE = { ...LEAD, lifecycleStage: 'cliente' };

  it('cada aba da tabela de endereços acende a aba de mesmo nome', () => {
    for (const aba of Object.keys(FICHA_TABS)) {
      // Indicações só existe na ficha de cliente.
      expect(abaAtiva(ficha(aba === 'referrals' ? CLIENTE : LEAD, aba)), aba).toBe(aba);
    }
  });

  it('toda aba desenhada na ficha é uma aba da tabela de endereços', () => {
    const desenhadas = abasDaFicha(ficha(CLIENTE, 'timeline')).map((t) => t.aba);
    expect(desenhadas.length).toBe(Object.keys(FICHA_TABS).length);
    for (const aba of desenhadas) {
      expect(Object.prototype.hasOwnProperty.call(FICHA_TABS, aba), aba).toBe(true);
    }
  });

  it('sem aba no endereço, a ficha abre na Linha do tempo', () => {
    expect(abaAtiva(ficha())).toBe('timeline');
  });

  it('link da aba Indicações num lead abre a Linha do tempo', () => {
    // A aba Indicações não existe enquanto a pessoa não é cliente, e quem só é
    // lead não pode ficar com a ficha sem aba acesa.
    const html = ficha(LEAD, 'referrals');
    expect(abaAtiva(html)).toBe('timeline');
    expect(abasDaFicha(html).map((t) => t.aba)).not.toContain('referrals');
  });
});

describe('aba Indicações', () => {
  const lista = (id = 'zzz999') => render(createElement(ReferralsSection, {
    items: [{ id, name: 'Carla Dias', referredAt: new Date('2026-09-10') }],
    loading: false,
  }));

  it('cada indicado é um link para a ficha', () => {
    const html = lista();
    expect(html).toContain('href="/acad/ficha/zzz999"');
    expect(html).toContain('Carla Dias');
  });

  it('a linha inteira é o link, com hover, anel de foco e sem arrasto', () => {
    // A âncora é a linha inteira: sem draggable={false} arrastar em qualquer
    // ponto dela leva o endereço para outra aba, e o clique com tremida não
    // abre a ficha.
    const html = lista();
    const i = html.indexOf('href="/acad/ficha/zzz999"');
    const linha = html.slice(html.lastIndexOf('<a ', i), i + 300);
    expect(linha).toContain('w-full flex items-center gap-3');
    expect(linha).toContain('hover:bg-slate-50');
    expect(linha).toContain('draggable="false"');
    expect(linha).toContain('focus-visible:ring-inset');
  });

  it('id que não serve para endereço vira linha sem link e sem hover', () => {
    const html = lista('a/b');
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('hover:bg-slate-50');
    expect(html).toContain('Carla Dias');
  });
});
