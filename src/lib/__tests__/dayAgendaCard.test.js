// Agenda de hoje: cada linha tem o botão de desfecho (o switch saiu) e a
// bolinha ao lado da hora fica vermelha na falta, verde no comparecimento.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { DayAgendaCard } from '../../components/dailygoal/DayAgendaCard.jsx';
import { DAILY_GOAL_CATEGORIES } from '../leads.js';

const row = (id, outcome, h) => ({
  id, name: `Pessoa ${id}`, outcome, categorySlug: DAILY_GOAL_CATEGORIES.VISITA_HOJE,
  scheduledAt: new Date(2026, 8, 29, h), isMine: true, ownerName: 'Lucas',
});

const html = () => renderToString(createElement(DayAgendaCard, {
  rows: [row('a', null, 9), row('b', 'attended', 10), row('c', 'no_show', 11)],
  pending: 1, nextIndex: 0, savingId: null, onMark: () => {},
}));

// Classe da bolinha de cada linha, na ordem das linhas.
const dots = (out) => [...out.matchAll(/class="(mt-1\.5 size-\[7px\][^"]*)"/g)].map((m) => m[1]);

describe('DayAgendaCard', () => {
  it('cada linha mostra o botão com o desfecho, e não o switch', () => {
    const out = html();
    expect(out).toContain('Marcar desfecho');
    expect(out).toContain('Compareceu');
    expect(out).toContain('Não compareceu');
    expect(out).not.toContain('segure para desmarcar');
  });

  it('a bolinha da falta é vermelha e a do comparecimento é verde', () => {
    const [, veio, faltou] = dots(html());
    expect(veio).toContain('bg-emerald-500');
    expect(faltou).toContain('bg-rose-500');
    expect(faltou).not.toContain('bg-emerald-500');
  });
});
