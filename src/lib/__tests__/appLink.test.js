// AppLink e LeadLink em node, sem jsdom: renderToString dentro de um
// MemoryRouter. O Link do React Router é embrulhado por um espião que guarda
// as props, para conferir o state levado e para simular o clique chamando o
// onClick que o AppLink entregou ao Link.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { AppLink, LeadLink } from '../../components/nav/AppLink.jsx';
import { LeadProfileContext, useLeadProfile } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor, parseAppPath } from '../routes.js';

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

const TENANT = 'acad';
const profile = (from = 'kanban') => ({
  openProfile: () => {},
  leadHref: (leadId) => hrefFor(TENANT, 'ficha', { leadId }),
  from,
});

function render(element, { value = profile(), path = '/acad/pipeline' } = {}) {
  return renderToString(
    createElement(MemoryRouter, { initialEntries: [path] },
      createElement(LeadProfileContext.Provider, { value }, element)));
}

function click(overrides = {}) {
  return {
    button: 0,
    metaKey: false,
    altKey: false,
    ctrlKey: false,
    shiftKey: false,
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    ...overrides,
  };
}

const lastLinkProps = () => m.linkProps[m.linkProps.length - 1];

beforeEach(() => {
  m.linkProps.length = 0;
});

describe('AppLink', () => {
  it('é um <a> com o endereço de destino', () => {
    const html = render(createElement(AppLink, { to: '/acad/pipeline', className: 'px-2' }, 'Pipeline'));
    expect(html).toContain('<a');
    expect(html).toContain('href="/acad/pipeline"');
    expect(html).toContain('class="px-2"');
    expect(html).toContain('>Pipeline</a>');
  });

  it('stretched estica a área do link sobre o card', () => {
    const html = render(createElement(AppLink, { to: '/acad/clientes', stretched: true, className: 'font-semibold' }, 'Ana'));
    expect(html).toContain('class="after:absolute after:inset-0 font-semibold"');
  });

  it('repassa ao Link o que não é dele (aria-current, tabIndex, draggable, title, ref)', () => {
    const ref = { current: null };
    const html = render(createElement(AppLink, { to: '/acad', 'aria-current': 'page', tabIndex: -1, draggable: false, title: 'Operacional', ref }, 'Início'));
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('draggable="false"');
    expect(html).toContain('title="Operacional"');
    expect(lastLinkProps().ref).toBe(ref);
  });

  it('onNavigate roda no clique esquerdo simples, depois do onClick', () => {
    const calls = [];
    render(createElement(AppLink, {
      to: '/acad/pipeline',
      onClick: () => calls.push('onClick'),
      onNavigate: () => calls.push('onNavigate'),
    }, 'Pipeline'));
    lastLinkProps().onClick(click());
    expect(calls).toEqual(['onClick', 'onNavigate']);
  });

  it('onNavigate não roda com Ctrl, Cmd, Shift, Alt, botão do meio ou botão direito', () => {
    const onNavigate = vi.fn();
    const onClick = vi.fn();
    render(createElement(AppLink, { to: '/acad/pipeline', onClick, onNavigate }, 'Pipeline'));
    const handle = lastLinkProps().onClick;
    handle(click({ ctrlKey: true }));
    handle(click({ metaKey: true }));
    handle(click({ shiftKey: true }));
    handle(click({ altKey: true }));
    handle(click({ button: 1 }));
    handle(click({ button: 2 }));
    expect(onClick).toHaveBeenCalledTimes(6);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('onNavigate não roda quando o onClick cancela o clique', () => {
    const onNavigate = vi.fn();
    render(createElement(AppLink, { to: '/acad/pipeline', onClick: (e) => e.preventDefault(), onNavigate }, 'Pipeline'));
    lastLinkProps().onClick(click());
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('onNavigate não roda quando o link abre em outra janela', () => {
    const onNavigate = vi.fn();
    render(createElement(AppLink, { to: '/acad/pipeline', target: '_blank', onNavigate }, 'Pipeline'));
    lastLinkProps().onClick(click());
    expect(onNavigate).not.toHaveBeenCalled();
  });
});

describe('LeadProfileContext', () => {
  it('sem Provider, não monta endereço e não tem tela de origem', () => {
    function Probe() {
      const { leadHref, from, openProfile } = useLeadProfile();
      return createElement('i', null, `${leadHref('abc123')}|${from}|${typeof openProfile}`);
    }
    expect(renderToString(createElement(Probe))).toBe('<i>null|null|function</i>');
  });
});

describe('LeadLink', () => {
  it('aponta para a ficha e leva a tela de origem no state', () => {
    const html = render(createElement(LeadLink, { leadId: 'abc123', className: 'grid' }, 'Ana Lima'));
    expect(html).toContain('href="/acad/ficha/abc123"');
    expect(html).toContain('class="grid"');
    expect(lastLinkProps().to).toBe('/acad/ficha/abc123');
    expect(lastLinkProps().state).toEqual({ from: 'kanban' });
  });

  it('o endereço volta como a mesma ficha, com espaço, acento e %', () => {
    for (const leadId of ['id com espaço', 'José', '50%', 'Ab12Cd34Ef56Gh78Ij90']) {
      const html = render(createElement(LeadLink, { leadId }, 'x'));
      const href = html.match(/href="([^"]*)"/)[1];
      const route = parseAppPath(href);
      expect(route.screen).toBe('ficha');
      expect(route.leadId).toBe(leadId);
    }
  });

  it('id que não serve para endereço vira texto sem link', () => {
    for (const leadId of ['', 'a/b', '..', '__x__', null, undefined]) {
      const html = render(createElement(LeadLink, { leadId, className: 'truncate' }, 'Ana'));
      expect(html).toBe('<span class="truncate">Ana</span>');
    }
    expect(m.linkProps).toHaveLength(0);
  });

  it('fora do Provider vira texto sem link', () => {
    const html = renderToString(
      createElement(MemoryRouter, null, createElement(LeadLink, { leadId: 'abc123' }, 'Ana')));
    expect(html).toBe('<span>Ana</span>');
  });

  it('repassa onNavigate e tabIndex ao AppLink', () => {
    const onNavigate = vi.fn();
    const html = render(createElement(LeadLink, { leadId: 'abc123', tabIndex: -1, onNavigate }, 'Ana'));
    expect(html).toContain('tabindex="-1"');
    lastLinkProps().onClick(click());
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
