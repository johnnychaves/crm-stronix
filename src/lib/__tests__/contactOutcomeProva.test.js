// @vitest-environment jsdom
// A linha de prova do Stronizap no pop-up Concluir contato (Parte B, PR 3, a
// linha da proposta C do mockup). Fica embaixo de quem é o lead, sem papel de
// região viva e sem foco: a primeira [role="status"] do pop-up continua sendo
// o aviso do rodapé. A prova só mostra, e o que o pop-up grava não muda.
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastContext } from '../../contexts/ToastContext.jsx';

vi.mock('../interactions.js', () => ({
  logInteraction: vi.fn(async () => 'i1'),
  logInteractions: vi.fn(async (db, lead, user, payloads) => payloads.map((_, n) => `i${n + 1}`)),
}));
const { logInteraction } = await import('../interactions.js');
const { ContactOutcomeModal } = await import('../../modals/ContactOutcomeModal.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O pop-up grava a hora do clique (newLeadHandledAt): sem relógio parado, as
// duas gravações do teste "não muda o que o Concluir grava" diferem em ms. Só
// o Date é falso, como no contactOutcomeModal.test.js.
beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 9, 15, 0)); });
afterAll(() => { vi.useRealTimers(); });

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const ana = { id: 'u-ana', name: 'Ana Souza', authUid: 'auth-ana' };
const CARLA = {
  id: 'l1', name: 'Carla Souza', consultantId: 'u-ana', consultantName: 'Ana Souza',
  nextFollowUp: new Date(2026, 10, 9, 16, 0), nextFollowUpType: 'Mensagem',
};
const linha = (extra = {}) => ({
  id: 'zap-l1-2026-11-09-equipe', leadId: 'l1', type: 'zap_signal', signal: 'pessoa_enviou', answering: true,
  actorId: 'u-ana', actorAuthUid: 'auth-ana', consultantName: 'Ana Souza', via: 'stronizap',
  createdAt: new Date(2026, 10, 9, 14, 40), ...extra,
});

let root = null;
let container = null;
const montar = async (lead, appUser = ana) => {
  if (!root) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  }
  await act(async () => {
    root.render(h(ToastContext.Provider, { value: toast },
      h(ContactOutcomeModal, { lead, categorySlug: 'contato_hoje', appUser, db: {}, onClose: () => {}, onDone: () => {} })));
  });
};
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  vi.clearAllMocks();
});

const dialogo = () => document.querySelector('[role="dialog"]');
// O PopupNote: um div com o ícone e um span com o texto.
const notaDaProva = () => [...dialogo().querySelectorAll('span')]
  .find((s) => s.textContent.includes('pelo Stronizap'))?.parentElement || null;
const concluir = async () => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Concluir');
  await act(async () => { b.click(); });
};

describe('Concluir contato: a prova do Stronizap', () => {
  it('com a linha da equipe, a prova aparece embaixo de quem é o lead, antes dos desfechos', async () => {
    await montar({ ...CARLA, zapProofToday: linha() });
    const nota = notaDaProva();
    expect(nota.textContent).toContain('Você respondeu às 14:40 pelo Stronizap');
    expect(nota.textContent).not.toMatch(/[—–]/);
    const nome = [...dialogo().querySelectorAll('span')].find((s) => s.textContent === 'Carla Souza');
    const primeiroCartao = dialogo().querySelector('[role="radio"]');
    expect(nome.compareDocumentPosition(nota) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(nota.compareDocumentPosition(primeiroCartao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('a linha de prova não é região viva nem recebe foco', async () => {
    await montar({ ...CARLA, zapProofToday: linha() });
    const nota = notaDaProva();
    expect(nota.getAttribute('role')).toBeNull();
    expect(nota.hasAttribute('tabindex')).toBe(false);
    expect(nota.querySelector('[tabindex], button, a')).toBeNull();
    expect(nota.closest('[role="status"]')).toBeNull();
    expect(dialogo().querySelector('[role="status"]').textContent).toBe('');
  });

  it('de um colega, o primeiro nome dele', async () => {
    await montar({ ...CARLA, zapProofToday: linha({ actorId: 'u-bruno', actorAuthUid: 'auth-bruno', consultantName: 'Bruno Lima' }) });
    expect(notaDaProva().textContent).toContain('Bruno respondeu às 14:40 pelo Stronizap');
  });

  it('a prova não muda o que o Concluir grava', async () => {
    await montar(CARLA);
    await concluir();
    await act(async () => { root.unmount(); });
    root = null;
    await montar({ ...CARLA, zapProofToday: linha() });
    await concluir();
    expect(logInteraction).toHaveBeenCalledTimes(2);
    expect(logInteraction.mock.calls[1][3]).toEqual(logInteraction.mock.calls[0][3]);
    expect(logInteraction.mock.calls[1][4]).toEqual(logInteraction.mock.calls[0][4]);
  });
});

describe('Quem não usa o Stronizap: o pop-up fica como hoje', () => {
  it('sem o campo e com o campo null, o pop-up é o mesmo, sem linha de prova', async () => {
    await montar(CARLA);
    const antes = dialogo().outerHTML;
    await montar({ ...CARLA, zapProofToday: null });
    expect(dialogo().outerHTML).toBe(antes);
    expect(document.body.textContent).not.toContain('pelo Stronizap');
  });
});
