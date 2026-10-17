// @vitest-environment jsdom
// A marca de feito que o ContactOutcomeModal grava (daily_goal_done do contato,
// no "Contato feito" e no Reagendar) leva quem tinha o contato na hora
// (goalOwnerId, com o contactOwnerId do lead). O crédito do contato na Meta
// segue esse campo (hasGoalDoneTodayFor, em src/lib/leads.js): sem ele, o
// contato que um colega recebeu e concluiu sumia da Meta dele e aparecia feito
// na Meta do dono do lead. O modal é renderizado de verdade em jsdom (o Dialog
// vai para um portal), clicado, e o que vai para o logInteraction, aqui um
// dublê, é conferido.
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastContext } from '../../contexts/ToastContext.jsx';

vi.mock('../interactions.js', () => ({
  logInteraction: vi.fn(async () => 'i1'),
  logInteractions: vi.fn(async (db, lead, user, payloads) => payloads.map((_, n) => `i${n + 1}`)),
}));
const { logInteraction, logInteractions } = await import('../interactions.js');
const { ContactOutcomeModal } = await import('../../modals/ContactOutcomeModal.jsx');
const { DAILY_GOAL_CATEGORIES } = await import('../leads.js');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const CONTATO = DAILY_GOAL_CATEGORIES.CONTATO_HOJE;
const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
// O Bruno recebeu da Ana o contato de hoje com a Carla.
const bruno = { id: 'u-bruno', name: 'Bruno', authUid: 'auth-bruno' };
const ana = { id: 'u-ana', name: 'Ana', authUid: 'auth-ana' };
const delegado = {
  id: 'l1', name: 'Carla Souza', consultantId: 'u-ana', consultantName: 'Ana',
  nextFollowUp: new Date(2026, 6, 15, 11, 0), nextFollowUpType: 'Mensagem',
  nextFollowUpOwnerId: 'u-bruno', nextFollowUpOwnerName: 'Bruno',
};

let root = null;
async function montar({ lead, appUser = bruno, categorySlug = CONTATO, initialOutcome = null }) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(ToastContext.Provider, { value: toast },
      h(ContactOutcomeModal, { open: true, lead, categorySlug, initialOutcome, appUser, db: {}, onClose: () => {}, onDone: () => {} })));
  });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  vi.clearAllMocks();
});

// Os desfechos são cartões (role="radio"), com o nome e uma linha de descrição;
// o botão do rodapé tem só o rótulo.
const botoes = (rotulo) => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === rotulo);
const escolher = async (rotulo) => {
  const card = [...document.querySelectorAll('[role="radio"]')].find((b) => b.textContent.startsWith(rotulo));
  expect(card, `desfecho "${rotulo}"`).toBeTruthy();
  await act(async () => { card.click(); });
};
const clicar = async (rotulo, qual = 0) => {
  const b = botoes(rotulo).at(qual);
  expect(b, `botão "${rotulo}"`).toBeTruthy();
  await act(async () => { b.click(); });
};
// O motivo é controlado pelo React: o valor entra pelo setter nativo e o
// evento de input, que é o que o onChange ouve.
const escreverMotivo = async (texto) => {
  const campo = document.querySelector('textarea');
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  await act(async () => {
    setter.call(campo, texto);
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
// O "Contato feito" grava pelo logInteraction; o Reagendar grava a nota e a
// marca juntas pelo logInteractions, num batch só.
const marcasGravadas = () => [
  ...logInteraction.mock.calls.map(([, , , payload]) => payload),
  ...logInteractions.mock.calls.flatMap(([, , , payloads]) => payloads),
].filter((p) => p.type === 'daily_goal_done');

describe('ContactOutcomeModal: a marca de feito leva quem tinha o contato', () => {
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 6, 15, 10, 0)); });
  afterAll(() => { vi.useRealTimers(); });

  it('"Contato feito" do contato delegado: a marca é de quem recebeu, e não da dona do lead', async () => {
    await montar({ lead: delegado });
    await clicar('Concluir');
    const [marca] = marcasGravadas();
    expect(marcasGravadas()).toHaveLength(1);
    expect(marca).toMatchObject({ dailyGoalCategory: CONTATO, goalOwnerId: 'u-bruno' });
  });

  it('Reagendar do contato delegado: a marca também é de quem recebeu', async () => {
    await montar({ lead: delegado });
    await escolher('Reagendar');
    await escreverMotivo('Pediu para falar amanhã.');
    await clicar('Reagendar', -1);
    const [marca] = marcasGravadas();
    expect(marcasGravadas()).toHaveLength(1);
    expect(marca).toMatchObject({ dailyGoalCategory: CONTATO, goalOwnerId: 'u-bruno', volumeKind: 'mensagem' });
  });

  it('o contato da própria dona leva o id dela, mesmo com a visita do lead com outra pessoa', async () => {
    const daAna = { ...delegado, nextFollowUpOwnerId: null, nextFollowUpOwnerName: null, appointmentOwnerId: 'u-bruno' };
    await montar({ lead: daAna, appUser: { id: 'u-ana', name: 'Ana', authUid: 'auth-ana' } });
    await clicar('Concluir');
    expect(marcasGravadas()[0]).toMatchObject({ dailyGoalCategory: CONTATO, goalOwnerId: 'u-ana' });
  });
});

// O "Contato feito" conclui o contato e tira dele o dono (contactDone), com
// null explícito, para o próximo contato que nascer sem escolher dono ficar
// com o dono do lead. O Reagendar leva o mesmo contato para outro dia e não
// mexe no dono. O patch do lead é o quinto argumento do logInteraction.
describe('ContactOutcomeModal: o dono do contato no lead', () => {
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 6, 15, 10, 0)); });
  afterAll(() => { vi.useRealTimers(); });

  const patchDaChamada = (n) => logInteraction.mock.calls[n][4];

  it('"Contato feito" do contato delegado limpa o próximo contato e o dono dele', async () => {
    await montar({ lead: delegado });
    await clicar('Concluir');
    expect(logInteraction).toHaveBeenCalledTimes(1);
    expect(patchDaChamada(0)).toEqual({
      nextFollowUp: null, nextFollowUpType: null, nextFollowUpOwnerId: null, nextFollowUpOwnerName: null,
      newLeadHandledAt: new Date(2026, 6, 15, 10, 0),
    });
  });

  it('"Contato feito" do Atrasado, que fica com a dona do lead, também limpa o dono do contato', async () => {
    const atrasado = { ...delegado, nextFollowUp: new Date(2026, 6, 13, 11, 0) };
    await montar({ lead: atrasado, appUser: ana, categorySlug: DAILY_GOAL_CATEGORIES.ATRASADO });
    await clicar('Concluir');
    expect(patchDaChamada(0)).toMatchObject({ nextFollowUpOwnerId: null, nextFollowUpOwnerName: null });
  });

  it('Reagendar leva o mesmo contato para outro dia e não mexe no dono dele', async () => {
    await montar({ lead: delegado });
    await escolher('Reagendar');
    await escreverMotivo('Pediu para falar amanhã.');
    await clicar('Reagendar', -1);
    // A nota, a marca e o patch vão juntos, num batch só.
    expect(logInteraction).not.toHaveBeenCalled();
    expect(logInteractions).toHaveBeenCalledTimes(1);
    const [, , , payloads, patch] = logInteractions.mock.calls[0];
    expect(payloads.map((p) => p.type)).toEqual(['note', 'daily_goal_done']);
    expect(patch).toEqual({ nextFollowUp: new Date(2026, 6, 16, 9, 0), nextFollowUpType: 'Mensagem' });
  });
});

// O botão de reagendar do card da Meta (o antigo "Adiar p/ amanhã") abre este
// pop-up já no Reagendar. O motivo é obrigatório, a tarefa conta como feita, e
// nada do agendamento do lead é tocado. Até 17/10/2026 o card gravava o
// próximo contato direto: a tarefa saía da Meta sem marca e sem motivo.
describe('ContactOutcomeModal aberto pelo Reagendar do card', () => {
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 6, 15, 10, 0)); });
  afterAll(() => { vi.useRealTimers(); });

  // Atrasado que nasceu de uma visita perdida: o tipo do próximo contato é
  // 'Visita' e o agendamento ficou no passado.
  const visitaPerdida = {
    id: 'l2', name: 'Diego Prado', consultantId: 'u-ana', consultantName: 'Ana',
    nextFollowUp: new Date(2026, 6, 14, 16, 0), nextFollowUpType: 'Visita',
    appointmentType: 'visita', appointmentScheduledFor: new Date(2026, 6, 14, 16, 0),
  };

  it('abre no Reagendar e só grava com o motivo', async () => {
    await montar({ lead: visitaPerdida, appUser: ana, categorySlug: DAILY_GOAL_CATEGORIES.ATRASADO, initialOutcome: 'reagendar' });
    const confirmar = botoes('Reagendar').at(-1);
    expect(document.querySelector('textarea')).toBeTruthy();
    expect(confirmar.disabled).toBe(true);
    await escreverMotivo('Não atendeu.');
    await clicar('Reagendar', -1);
    expect(marcasGravadas()).toHaveLength(1);
    expect(marcasGravadas()[0]).toMatchObject({ dailyGoalCategory: DAILY_GOAL_CATEGORIES.ATRASADO });
  });

  it('vira contato por mensagem e não mexe no agendamento do lead', async () => {
    await montar({ lead: visitaPerdida, appUser: ana, categorySlug: DAILY_GOAL_CATEGORIES.ATRASADO, initialOutcome: 'reagendar' });
    await escreverMotivo('Pediu para falar amanhã.');
    await clicar('Reagendar', -1);
    const [, , , , patch] = logInteractions.mock.calls[0];
    // Com o tipo 'Visita' mantido e o agendamento apagado, o lead virava uma
    // visita falsa no dia seguinte.
    expect(patch).toEqual({ nextFollowUp: new Date(2026, 6, 16, 9, 0), nextFollowUpType: 'Mensagem' });
  });

  it('o Novo lead também reagenda por este pop-up', async () => {
    const novo = { id: 'l3', name: 'Bia Nunes', consultantId: 'u-ana', nextFollowUp: null, nextFollowUpType: null };
    await montar({ lead: novo, appUser: ana, categorySlug: DAILY_GOAL_CATEGORIES.NOVO_24H, initialOutcome: 'reagendar' });
    await escreverMotivo('Sem resposta.');
    await clicar('Reagendar', -1);
    expect(marcasGravadas()[0]).toMatchObject({ dailyGoalCategory: DAILY_GOAL_CATEGORIES.NOVO_24H });
  });

  it('sem o pedido, abre no Contato feito, como antes', async () => {
    await montar({ lead: delegado });
    expect(document.querySelector('textarea')).toBeNull();
    expect(botoes('Concluir')).toHaveLength(1);
  });
});

// A família nova de pop-ups (PR 2 da Meta Diária): Dialog com nome e
// descrição, o rodapé que diz o que falta e os atalhos de motivo.
describe('ContactOutcomeModal na família de pop-ups', () => {
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 6, 15, 10, 0)); });
  afterAll(() => { vi.useRealTimers(); });

  it('é um diálogo com o nome do lead e a hora do contato de hoje', async () => {
    await montar({ lead: delegado });
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')).textContent).toBe('Concluir contato');
    expect(document.getElementById(dialog.getAttribute('aria-describedby')).textContent).toContain('Mensagem marcada para hoje às 11:00');
    // O foco abre no desfecho escolhido.
    expect(document.activeElement.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement.textContent.startsWith('Contato feito')).toBe(true);
  });

  it('o Atrasado diz há quantos dias, e o lead novo sem próximo passo diz isso', async () => {
    await montar({ lead: { ...delegado, nextFollowUp: new Date(2026, 6, 13, 11, 0) }, appUser: ana, categorySlug: DAILY_GOAL_CATEGORIES.ATRASADO });
    expect(document.body.textContent).toContain('Atrasado, 2 dias');
    await act(async () => { root.unmount(); });
    document.body.innerHTML = '';
    await montar({ lead: { ...delegado, nextFollowUp: null }, appUser: ana, categorySlug: DAILY_GOAL_CATEGORIES.ATRASADO });
    expect(document.body.textContent).toContain('Sem próximo passo desde o cadastro');
  });

  it('o rodapé diz o que falta, e o atalho de motivo preenche o campo', async () => {
    await montar({ lead: delegado, initialOutcome: 'reagendar' });
    const status = document.querySelector('[role="status"]');
    expect(status.textContent).toBe('Escreva o motivo do reagendamento.');
    expect(botoes('Reagendar').at(-1).disabled).toBe(true);
    await clicar('Não atendeu');
    expect(document.querySelector('textarea').value).toBe('Não atendeu');
    expect(status.textContent).toBe('');
    await clicar('Reagendar', -1);
    const [, , , payloads] = logInteractions.mock.calls[0];
    expect(payloads[0].text).toContain('Motivo do reagendamento: Não atendeu');
  });

  it('o horário que já passou trava o Reagendar e diz por quê', async () => {
    await montar({ lead: delegado, initialOutcome: 'reagendar' });
    await escreverMotivo('Pediu para falar depois.');
    await clicar('Hoje');
    const hora = document.querySelector('input[type="time"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    await act(async () => {
      setter.call(hora, '09:30');
      hora.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(document.querySelector('[role="status"]').textContent).toBe('Escolha um dia e horário futuros.');
    expect(document.body.textContent).toContain('Esse horário já passou.');
    expect(botoes('Reagendar').at(-1).disabled).toBe(true);
  });

  it('as setas trocam o desfecho', async () => {
    await montar({ lead: delegado });
    const feito = document.activeElement;
    await act(async () => { feito.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
    expect(document.activeElement.textContent.startsWith('Reagendar')).toBe(true);
    expect(document.activeElement.getAttribute('aria-checked')).toBe('true');
    expect(document.querySelector('textarea')).toBeTruthy();
  });
});
