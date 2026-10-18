// Meta diária: todo nome que abre a ficha virou link. No DoneCard o link é
// esticado (after:absolute after:inset-0) sobre um container com relative, e os
// botões de dentro sobem com relative z-10. O bloco Agora e a fila têm os
// testes deles em metaFocoView.test.js.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter',
  DAILY_GOAL_HISTORY_PATH: 'hist', db: {}, auth: {}, storage: {},
  ROUTINE_MODELS_PATH: 'rotina_modelos', ROUTINE_VERSIONS_PATH: 'rotina_versoes', ROUTINE_MARKS_PATH: 'rotina_marcas',
}));

const { DoneCard, TomorrowApptRow } = await import('../../views/DailyGoalView.jsx');

const TENANT = 'acad';
const profile = {
  openProfile: () => {},
  leadHref: (leadId) => hrefFor(TENANT, 'ficha', { leadId }),
  from: 'dailyGoal',
};

const TASK = {
  id: 'abc123', name: 'Ana Lima', whatsapp: '11999990000',
  createdAt: new Date('2026-09-22T08:00:00'), categorySlugs: ['novo_24h'], categoryStatus: {},
};

function render(element) {
  return renderToString(
    createElement(MemoryRouter, { initialEntries: ['/acad/meta-diaria'] },
      createElement(LeadProfileContext.Provider, { value: profile }, element)));
}

const doneCard = () => render(createElement(DoneCard, {
  lead: { ...TASK, categorySlugs: ['visita_hoje'], categoryStatus: { visita_hoje: true } },
  onReschedule: () => {},
}));

describe('Meta diária', () => {
  it('os links da Meta não são arrastáveis', () => {
    // A camada esticada é da âncora, então sem draggable={false} arrastar em
    // qualquer ponto do card arrastaria o endereço da ficha para outra aba ou
    // para um campo de texto.
    expect(doneCard().match(/draggable="false"/g)).toHaveLength(1);
  });

  it('DoneCard: o nome é link esticado sobre um container posicionado', () => {
    const html = doneCard();
    expect(html).toContain('href="/acad/ficha/abc123"');
    expect(html).toContain('after:absolute after:inset-0');
    // Pelo `relative` e pelo gap, não pela lista inteira de classes: prender o
    // prefixo literal quebraria o teste a cada reordenação de utilitário
    // Tailwind, sem nenhuma mudança de comportamento.
    expect(html).toMatch(/class="relative [^"]*flex items-center gap-3/);
  });

  it('DoneCard: Remarcar continua botão por cima do link', () => {
    const html = doneCard();
    const i = html.indexOf('title="Remarcar agendamento"');
    expect(i).toBeGreaterThan(-1);
    const b = html.lastIndexOf('<button', i);
    expect(b).toBeGreaterThan(html.lastIndexOf('<a ', i));
    // No <button> o React respeita a ordem das props, e class vem depois de
    // title, então de novo a tag inteira.
    expect(html.slice(b, html.indexOf('>', i))).toContain('relative z-10');
  });

  it('o container do DoneCard não volta a ter onClick', () => {
    // O renderToString não mostra handler, então a trava é olhar o elemento.
    // Com onClick no container o clique abriria a ficha duas vezes e o voltar
    // do navegador passaria a exigir dois cliques. O DoneCard não usa hook,
    // então dá para chamá-lo como função.
    const done = DoneCard({ lead: { ...TASK }, onReschedule: () => {} });
    expect(done.props.onClick).toBeUndefined();
  });

  it('prévia de amanhã: a linha é link para a ficha e não é arrastável', () => {
    const html = render(createElement(TomorrowApptRow, {
      lead: { id: 'abc123', name: 'Ana Lima', whatsapp: '11999990000' },
      when: new Date('2026-09-23T09:00:00'),
    }));
    expect(html).toContain('href="/acad/ficha/abc123"');
    expect(html).toContain('Ana Lima');
    expect(html).toContain('draggable="false"');
  });

  it('DoneCard: desfecho de hoje vira o botão de correção, por cima do link', () => {
    const now = new Date('2026-09-22T15:00:00');
    const html = render(createElement(DoneCard, {
      lead: {
        ...TASK, categorySlugs: ['visita_hoje'], categoryStatus: { visita_hoje: true },
        appointmentOutcome: 'attended',
        appointmentOutcomeAt: new Date('2026-09-22T14:00:00'),
        appointmentScheduledFor: new Date('2026-09-22T13:00:00'),
      },
      now,
      onReschedule: () => {},
      onCorrect: () => {},
    }));
    const i = html.indexOf('aria-label="Compareceu. Abrir para corrigir"');
    expect(i).toBeGreaterThan(-1);
    const b = html.lastIndexOf('<button', i);
    expect(html.slice(b, html.indexOf('>', i))).toContain('relative z-10');
  });

  it('DoneCard sem onCorrect continua mostrando só o texto do desfecho', () => {
    const html = render(createElement(DoneCard, {
      lead: {
        ...TASK, categorySlugs: ['visita_hoje'], categoryStatus: { visita_hoje: true },
        appointmentOutcome: 'attended',
        appointmentOutcomeAt: new Date('2026-09-22T14:00:00'),
        appointmentScheduledFor: new Date('2026-09-22T13:00:00'),
      },
      onReschedule: () => {},
    }));
    expect(html).not.toContain('Abrir para corrigir');
    expect(html).toContain('Compareceu');
  });
});
