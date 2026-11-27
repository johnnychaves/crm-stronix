// Configurações → Agendamento: com o módulo Stronix 2.0, quem diz quantas aulas
// experimentais são é o freepass, e o painel de quantidades sai. Sem o módulo,
// fica como antes.
import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { ToastContext } from '../../contexts/ToastContext.jsx';

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', CONFIG_PATH: 'stronix_config', CONFIG_GENERAL_ID: 'general',
  MODALITIES_PATH: 'mod', UNITS_PATH: 'units', db: {},
}));
const { SchedulingSection } = await import('../../views/settings/SchedulingSection.jsx');

const toast = { show() {}, success() {}, error() {}, info() {}, warning() {}, dismiss() {} };
const render = (freepassOn) => renderToString(h(ToastContext.Provider, { value: toast }, h(SchedulingSection, {
  db: {}, modalities: [{ id: 'm1', name: 'Pilates' }], units: [], trialClassOptions: [1, 2], freepassTypes: [],
  freepassOn, leads: [], onLeadsChanged: () => {},
})));

describe('SchedulingSection e o freepass', () => {
  it('sem o módulo, mostra o painel de aulas experimentais e não o de freepass', () => {
    const html = render(false);
    expect(html).toContain('Aulas experimentais');
    expect(html).toContain('Novo pacote');
    expect(html).not.toContain('Novo freepass');
  });
  it('com o módulo, o painel de quantidades sai e entra o de freepass', () => {
    const html = render(true);
    expect(html).not.toContain('Aulas experimentais');
    expect(html).not.toContain('Novo pacote');
    expect(html).toContain('Novo freepass');
  });
});
