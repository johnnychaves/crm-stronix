// Meta diária: todo nome que abre a ficha virou link. No
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
    // Só o que importa: `relative` e o padding que identifica o cabeçalho.
    // Prender a lista inteira de classes quebraria o teste a cada reordenação
    // de utilitário Tailwind, sem nenhuma mudança de comportamento.
    expect(taskCard()).toMatch(/class="relative [^"]*p-3\.5/);
  });

  it('TaskCard: a camada esticada arredonda só os cantos de cima', () => {
    // A camada cobre o cabeçalho, não o card inteiro. Com after:rounded-xl
    // sobram dois cantinhos mortos na divisa com o rodapé e o anel de foco
    // desenha canto arredondado no meio do card.
    const html = taskCard();
    expect(html).toContain('after:rounded-t-xl');
    expect(html).not.toContain('after:rounded-xl');
  });

  it('TaskCard: o atalho do canto abre a ficha por cima do link esticado', () => {
    const html = taskCard();
    const i = html.indexOf('title="Abrir ficha"');
    expect(i).toBeGreaterThan(-1);
    // A tag inteira: o class sai depois do title no HTML renderizado.
    const abertura = html.lastIndexOf('<a ', i);
    const tag = html.slice(abertura, html.indexOf('>', i));
    expect(tag).toContain('relative z-10');
    // Sem isto o leitor de tela anuncia um link sem nome nenhum, porque o
    // conteúdo é só o ícone de reticências.
    expect(tag).toContain('aria-label="Abrir ficha de Ana Lima"');
  });

  it('TaskCard: lead sem nome não vira "Abrir ficha de undefined"', () => {
    const html = render(createElement(TaskCard, {
      task: { ...TASK, name: '' }, slug: 'novo_24h', now: new Date('2026-09-22T10:00:00'),
    }));
    expect(html).toContain('aria-label="Abrir ficha de lead sem nome"');
  });

  it('os links da Meta não são arrastáveis', () => {
    // A camada esticada é da âncora, então sem draggable={false} arrastar em
    // qualquer ponto do card arrastaria o endereço da ficha para outra aba ou
    // para um campo de texto.
    expect(taskCard().match(/draggable="false"/g)).toHaveLength(2);
    expect(doneCard().match(/draggable="false"/g)).toHaveLength(1);
  });

  it('TaskCard: id que não serve para endereço vira texto sem link', () => {
    const html = render(createElement(TaskCard, {
      task: { ...TASK, id: 'a/b' }, slug: 'novo_24h', now: new Date('2026-09-22T10:00:00'),
    }));
    expect(html).not.toContain('<a ');
    expect(html).toContain('Ana Lima');
  });

  it('TaskCard: WhatsApp, Ligar, Adiar e Concluir continuam botões', () => {
    const html = taskCard();
    for (const rotulo of ['WhatsApp', 'title="Ligar"', 'title="Adiar p/ amanhã"', 'Concluir']) {
      const i = html.indexOf(rotulo);
      expect(html.lastIndexOf('<button', i)).toBeGreaterThan(html.lastIndexOf('<a ', i));
    }
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

  it('os containers não voltam a ter onClick', () => {
    // O renderToString não mostra handler, então a trava é olhar o elemento.
    // Com onClick no container o clique abriria a ficha duas vezes e o voltar
    // do navegador passaria a exigir dois cliques. Nenhum dos dois usa hook,
    // então dá para chamá-los como função.
    const card = TaskCard({ task: TASK, slug: 'novo_24h', now: new Date('2026-09-22T10:00:00') });
    // Pelo className, não pela posição: inserir qualquer elemento antes do
    // cabeçalho moveria children[0] e o teste seguiria verde sem conferir nada.
    const cabecalho = card.props.children.find(
      (f) => typeof f?.props?.className === 'string' && f.props.className.startsWith('relative p-3.5')
    );
    expect(cabecalho).toBeDefined();
    expect(cabecalho.props.onClick).toBeUndefined();
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

  it('TaskCard de visita: os quatro botões viraram o Marcar desfecho', () => {
    const html = render(createElement(TaskCard, {
      task: { ...TASK, categorySlugs: ['visita_hoje'] }, slug: 'visita_hoje', now: new Date('2026-09-22T10:00:00'),
    }));
    expect(html).toContain('Marcar desfecho');
    expect(html).not.toContain('>Não veio<');
    expect(html).not.toContain('>Remarcou<');
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
