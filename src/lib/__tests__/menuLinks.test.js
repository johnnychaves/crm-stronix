// Menu lateral e aviso de mensalidade como links de verdade (endereço por
// tela, PR 2). Com link, Ctrl+clique, botão do meio e "Abrir em nova aba"
// funcionam. Render sem jsdom (renderToString) dentro de um MemoryRouter,
// porque o Link do React Router só existe dentro de um roteador.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { SidebarItem, SidebarSubItem } from '../../components/layout/Sidebar.jsx';
import { PaymentDueBanner } from '../../components/layout/Banners.jsx';

const render = (el) => renderToString(createElement(MemoryRouter, { initialEntries: ['/acad'] }, el));
// Classes do elemento de fora: o primeiro class="" do html.
const rootClass = (html) => html.match(/class="([^"]*)"/)?.[1];
const DAY = 24 * 60 * 60 * 1000;

describe('SidebarItem', () => {
  it('com endereço vira link e marca a tela atual', () => {
    const html = render(createElement(SidebarItem, { label: 'Pipeline', href: '/acad/pipeline', active: true }));
    expect(html.startsWith('<a ')).toBe(true);
    expect(html).toContain('href="/acad/pipeline"');
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('<button');
  });

  it('link de uma tela que não é a atual não leva aria-current', () => {
    const html = render(createElement(SidebarItem, { label: 'Pipeline', href: '/acad/pipeline', active: false }));
    expect(html.startsWith('<a ')).toBe(true);
    expect(html).not.toContain('aria-current');
  });

  it('sem endereço continua botão, para o que abre janela (Suporte)', () => {
    const html = render(createElement(SidebarItem, { label: 'Suporte', active: false, onClick: () => {} }));
    expect(html.startsWith('<button type="button"')).toBe(true);
    expect(html).not.toContain('href=');
  });

  it('link e botão têm a mesma aparência, ativo ou não', () => {
    for (const active of [true, false]) {
      const link = render(createElement(SidebarItem, { label: 'Pipeline', href: '/acad/pipeline', active }));
      const button = render(createElement(SidebarItem, { label: 'Pipeline', active }));
      expect(rootClass(link)).toBe(rootClass(button));
    }
  });

  it('o selo de pendências continua dentro do link', () => {
    const html = render(createElement(SidebarItem, { label: 'Meta diária', href: '/acad/meta-diaria', active: false, badge: 3 }));
    expect(html.startsWith('<a ')).toBe(true);
    expect(html).toContain('>3</span>');
  });
});

describe('SidebarSubItem', () => {
  it('com endereço vira link e marca a tela atual', () => {
    const html = render(createElement(SidebarSubItem, { label: 'Aulas experimentais', href: '/acad/leads/aulas', active: true }));
    expect(html.startsWith('<a ')).toBe(true);
    expect(html).toContain('href="/acad/leads/aulas"');
    expect(html).toContain('aria-current="page"');
  });

  it('sem endereço continua botão, com a mesma aparência do link', () => {
    const button = render(createElement(SidebarSubItem, { label: 'CRM', active: false, onClick: () => {} }));
    const link = render(createElement(SidebarSubItem, { label: 'CRM', href: '/acad/visao-geral/crm', active: false }));
    expect(button.startsWith('<button type="button"')).toBe(true);
    expect(rootClass(link)).toBe(rootClass(button));
  });
});

describe('PaymentDueBanner', () => {
  const dueSoon = () => Date.now() + 2 * DAY;

  it('sem fatura, "Ver faturas" é link para Plano e faturas', () => {
    const html = render(createElement(PaymentDueBanner, {
      dueAtMs: dueSoon(), overdue: false, invoiceUrl: null, billingHref: '/acad/plano-e-faturas',
    }));
    expect(html).toContain('href="/acad/plano-e-faturas"');
    expect(html).toContain('Ver faturas');
    expect(html).not.toContain('<button');
  });

  it('com fatura, mostra só o link de pagar, que abre fora do app', () => {
    const html = render(createElement(PaymentDueBanner, {
      dueAtMs: dueSoon(), overdue: false, invoiceUrl: 'https://www.asaas.com/i/abc123', billingHref: '/acad/plano-e-faturas',
    }));
    expect(html).toContain('href="https://www.asaas.com/i/abc123"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('Pagar fatura');
    expect(html).not.toContain('Ver faturas');
  });

  it('sem fatura e sem endereço não mostra um "Ver faturas" que não leva a lugar nenhum', () => {
    const html = render(createElement(PaymentDueBanner, { dueAtMs: dueSoon(), overdue: false, invoiceUrl: null }));
    expect(html).toContain('Sua mensalidade vence em 2 dias');
    expect(html).not.toContain('Ver faturas');
  });
});
