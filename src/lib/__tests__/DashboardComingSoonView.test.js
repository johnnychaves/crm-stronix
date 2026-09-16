// Render da aba Gerencial "Em breve" sem jsdom (renderToString).
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { DashboardComingSoonView } from '../../views/dashboard/DashboardComingSoonView.jsx';

describe('DashboardComingSoonView (render)', () => {
  it('gerencial mostra o título, o "Em breve" e o caminho para o Operacional', () => {
    const html = renderToString(createElement(DashboardComingSoonView, { page: 'gerencial', onNavigate: () => {} }));
    expect(html).toContain('>Gerencial</h2>');
    expect(html).toContain('Em breve');
    expect(html).toContain('Abrir o Operacional');
    expect(html).toContain('Lead e funil estão no CRM.');
  });
});
