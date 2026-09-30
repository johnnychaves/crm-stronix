// Aba Indicações: o botão de cadastro à mão aparece quando a ficha passa
// onAdd, na lista e no aviso de vazio.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

vi.mock('../firebase.js', () => ({ appId: 'acad', LEADS_PATH: 'leads', db: {}, auth: {}, storage: {} }));

const { ReferralsSection } = await import('../../components/profile/ReferralsSection.jsx');

const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: 'profile' };
const render = (props) => renderToString(
  createElement(MemoryRouter, { initialEntries: ['/acad/ficha/c1/indicacoes'] },
    createElement(LeadProfileContext.Provider, { value: profile }, createElement(ReferralsSection, props))));

describe('ReferralsSection', () => {
  it('vazio com onAdd: convida a cadastrar e cita o Indicar', () => {
    const html = render({ items: [], loading: false, onAdd: () => {} });
    expect(html).toContain('Cadastrar indicação');
    expect(html).toContain('Indicar');
  });

  it('lista com onAdd: o botão fica em cima', () => {
    const html = render({ items: [{ id: 'l1', name: 'Juliana', status: 'Aguardando ação' }], loading: false, onAdd: () => {} });
    expect(html.indexOf('Cadastrar indicação')).toBeGreaterThan(-1);
    expect(html.indexOf('Cadastrar indicação')).toBeLessThan(html.indexOf('Juliana'));
  });

  it('sem onAdd, nada de botão', () => {
    expect(render({ items: [], loading: false })).not.toContain('Cadastrar indicação');
  });
});
