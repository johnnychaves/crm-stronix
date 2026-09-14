// Render das abas "Em breve" (CRM e Gerencial) sem jsdom (renderToString), no
// mesmo formato do MetaDaysCalendar.test.js.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { DashboardComingSoonView } from '../../views/dashboard/DashboardComingSoonView.jsx';

describe('DashboardComingSoonView (render)', () => {
  it.each([
    ['crm', 'CRM'],
    ['gerencial', 'Gerencial']
  ])('%s mostra o título, o "Em breve" e o caminho para o Operacional', (page, title) => {
    const html = renderToString(createElement(DashboardComingSoonView, { page, onNavigate: () => {} }));
    expect(html).toContain(`>${title}</h2>`);
    expect(html).toContain('Em breve');
    expect(html).toContain('Abrir o Operacional');
  });
});
