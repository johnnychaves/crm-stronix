// Busca global e sino. Nos dois, Ctrl+clique precisa abrir a ficha em outra aba
// E deixar a lista aberta, para dar para abrir várias. O Link do React Router é
// embrulhado por um espião, para simular o clique chamando o onClick que o
// AppLink entregou a ele.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { deriveLeadState, getTone } from '../leadState.js';
import { hrefFor } from '../routes.js';

const m = vi.hoisted(() => ({ linkProps: [] }));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal();
  const { createElement: h } = await import('react');
  function SpyLink(props) {
    m.linkProps.push(props);
    return h(actual.Link, props);
  }
  return { ...actual, Link: SpyLink };
});

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', db: {}, auth: {}, storage: {},
}));

const { SearchResultRow } = await import('../../components/layout/GlobalSearch.jsx');
const { NotificationRow } = await import('../../components/layout/NotificationBell.jsx');

const TENANT = 'acad';
const profile = {
  openProfile: () => {},
  leadHref: (leadId) => hrefFor(TENANT, 'ficha', { leadId }),
  from: 'kanban',
};

const LEAD = { id: 'abc123', name: 'Ana Lima', whatsapp: '11999990000', status: 'Novo', createdAt: new Date('2026-09-20') };

function linhaDaBusca() {
  const state = deriveLeadState(LEAD, new Date(), 30);
  return { lead: LEAD, matchKind: 'phone', matchRange: null, state, tone: getTone(state.tone), splitHex: null };
}

// Menor com responsável: o próprio WhatsApp existe, mas quem o consultor chama
// é a mãe (contactOf().viaGuardian).
const MENOR = {
  id: 'kid1', name: 'Pedro Souza', whatsapp: '11999990000', status: 'Novo', createdAt: new Date('2026-09-20'),
  isMinor: true, guardian: { name: 'Maria Souza', phone: '11912345678', relationship: 'Mãe' },
};

function linhaDoMenor(matchKind) {
  const state = deriveLeadState(MENOR, new Date(), 30);
  return { lead: MENOR, matchKind, matchRange: null, state, tone: getTone(state.tone), splitHex: null };
}

function render(element) {
  return renderToString(
    createElement(MemoryRouter, { initialEntries: ['/acad/pipeline'] },
      createElement(LeadProfileContext.Provider, { value: profile }, element)));
}

function click(overrides = {}) {
  return {
    button: 0, metaKey: false, altKey: false, ctrlKey: false, shiftKey: false,
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    ...overrides,
  };
}

const ultimoLink = () => m.linkProps[m.linkProps.length - 1];

beforeEach(() => { m.linkProps.length = 0; });

describe('busca global', () => {
  it('o resultado é um link para a ficha, fora da ordem do Tab', () => {
    const html = render(createElement(SearchResultRow, {
      row: linhaDaBusca(), active: true, onHover: () => {}, onNavigate: () => {},
    }));
    expect(html).toContain('href="/acad/ficha/abc123"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('Ana Lima');
  });

  it('o mousedown do botão esquerdo segura o foco no campo', () => {
    const el = SearchResultRow({ row: linhaDaBusca(), active: false, onHover: () => {}, onNavigate: () => {} });
    const evento = click();
    el.props.onMouseDown(evento);
    expect(evento.defaultPrevented).toBe(true);
  });

  it('o mousedown do botão do meio fica com o navegador', () => {
    const el = SearchResultRow({ row: linhaDaBusca(), active: false, onHover: () => {}, onNavigate: () => {} });
    const evento = click({ button: 1 });
    el.props.onMouseDown(evento);
    expect(evento.defaultPrevented).toBe(false);
  });

  it('o clique simples fecha a busca e o Ctrl+clique não', () => {
    const onNavigate = vi.fn();
    render(createElement(SearchResultRow, {
      row: linhaDaBusca(), active: false, onHover: () => {}, onNavigate,
    }));
    ultimoLink().onClick(click());
    expect(onNavigate).toHaveBeenCalledTimes(1);
    ultimoLink().onClick(click({ ctrlKey: true }));
    ultimoLink().onClick(click({ button: 1 }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('achou o menor pelo telefone: mostra o número do próprio menor, não o do responsável', () => {
    const html = render(createElement(SearchResultRow, {
      row: linhaDoMenor('phone'), active: false, onHover: () => {}, onNavigate: () => {},
    }));
    expect(html).toContain('(11) 9 9999-0000');
    expect(html).not.toContain('resp.:');
  });

  it('achou o menor pelo nome: mostra o contato do responsável', () => {
    const html = render(createElement(SearchResultRow, {
      row: linhaDoMenor('name'), active: false, onHover: () => {}, onNavigate: () => {},
    }));
    expect(html).toContain('resp.: Maria Souza (mãe)');
  });
});

describe('sino', () => {
  const linha = (props) => render(createElement(NotificationRow, {
    icon: null, tone: 'bg-brand-50', title: 'Ana Lima é sua responsabilidade agora',
    subtitle: 'Passado por Bruno', time: 'há 2 h', unread: true, ...props,
  }));

  it('"Passaram para você" é link para a ficha', () => {
    const html = linha({ leadId: 'abc123', action: 'Abrir ficha', onNavigate: () => {} });
    expect(html).toContain('href="/acad/ficha/abc123"');
    expect(html).toContain('Ana Lima é sua responsabilidade agora');
  });

  it('a novidade, sem lead, continua botão', () => {
    const html = linha({ title: 'Novidade do sistema', onClick: () => {} });
    expect(html).toContain('<button');
    expect(html).not.toContain('<a ');
  });

  it('o clique simples fecha o sino e o Ctrl+clique não', () => {
    const onNavigate = vi.fn();
    linha({ leadId: 'abc123', onNavigate });
    ultimoLink().onClick(click());
    expect(onNavigate).toHaveBeenCalledTimes(1);
    ultimoLink().onClick(click({ metaKey: true }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
