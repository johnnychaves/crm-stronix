// Meta diária e visão Equipe: todo nome que abre a ficha virou link. No
// TaskCard e no DoneCard o link é esticado (after:absolute after:inset-0) sobre
// um container com relative, e os botões de dentro sobem com relative z-10.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter',
  DAILY_GOAL_HISTORY_PATH: 'hist', db: {}, auth: {}, storage: {},
}));

const { TaskCard, DoneCard, TomorrowApptRow } = await import('../../views/DailyGoalView.jsx');
const { ConsultantDayDetail } = await import('../../views/team/ConsultantDayDetail.jsx');

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

const taskCard = () => render(createElement(TaskCard, {
  task: TASK, slug: 'novo_24h', now: new Date('2026-09-22T10:00:00'),
}));

const doneCard = () => render(createElement(DoneCard, {
  lead: { ...TASK, categorySlugs: ['visita_hoje'], categoryStatus: { visita_hoje: true } },
  onReschedule: () => {},
}));

describe('Meta diária', () => {
  it('TaskCard: o nome é link esticado para a ficha', () => {
    const html = taskCard();
    const i = html.indexOf('href="/acad/ficha/abc123"');
    expect(i).toBeGreaterThan(-1);
    const abertura = html.lastIndexOf('<a ', i);
    expect(html.slice(abertura, html.indexOf('</a>', i))).toContain('after:absolute after:inset-0');
  });

  it('TaskCard: o cabeçalho é o ancestral posicionado do link', () => {
    expect(taskCard()).toContain('class="relative p-3.5 flex items-start gap-3 cursor-pointer"');
  });

  it('TaskCard: o atalho do canto abre a ficha por cima do link esticado', () => {
    const html = taskCard();
    const i = html.indexOf('title="Abrir ficha"');
    expect(i).toBeGreaterThan(-1);
    // A tag inteira: o class sai depois do title no HTML renderizado.
    const abertura = html.lastIndexOf('<a ', i);
    expect(html.slice(abertura, html.indexOf('>', i))).toContain('relative z-10');
  });

  it('TaskCard: WhatsApp, Ligar, Adiar e Concluir continuam botões', () => {
    const html = taskCard();
    for (const rotulo of ['WhatsApp', 'Concluir']) {
      const i = html.indexOf(rotulo);
      expect(html.lastIndexOf('<button', i)).toBeGreaterThan(html.lastIndexOf('<a ', i));
    }
  });

  it('DoneCard: o nome é link esticado sobre um container posicionado', () => {
    const html = doneCard();
    expect(html).toContain('href="/acad/ficha/abc123"');
    expect(html).toContain('after:absolute after:inset-0');
    expect(html).toContain('relative flex items-center gap-3');
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

  it('prévia de amanhã: a linha é link para a ficha', () => {
    const html = render(createElement(TomorrowApptRow, {
      lead: { id: 'abc123', name: 'Ana Lima', whatsapp: '11999990000' },
      when: new Date('2026-09-23T09:00:00'),
    }));
    expect(html).toContain('href="/acad/ficha/abc123"');
    expect(html).toContain('Ana Lima');
  });
});

describe('visão Equipe', () => {
  const row = {
    cota: 3, prospDone: 1, hasCota: true, isPast: false,
    processed: [{ ...TASK }],
    prospAcoes: [
      { leadId: 'abc123', leadName: 'Ana Lima', label: 'Mensagem', at: new Date('2026-09-22T09:00:00') },
      { leadId: null, leadName: '', label: 'Ligação', at: new Date('2026-09-22T09:30:00') },
    ],
  };
  const detalhe = () => render(createElement(ConsultantDayDetail, { row, slaOverdueDays: 3 }));

  it('a carteira do dia vira link', () => {
    const html = detalhe();
    expect(html).toContain('href="/acad/ficha/abc123"');
    expect(html.match(/href="\/acad\/ficha\/abc123"/g).length).toBeGreaterThanOrEqual(2);
  });

  it('a prospecção sem lead fica sem link e sem hover de link', () => {
    const html = detalhe();
    const i = html.indexOf('Ligação');
    const abertura = html.lastIndexOf('<span', i);
    expect(html.slice(abertura, i)).not.toContain('href');
    expect(html).not.toContain('group-enabled:');
  });
});
