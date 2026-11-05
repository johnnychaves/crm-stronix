// @vitest-environment jsdom
// Plano & faturas mostra a fatura a pagar (a mais antiga em aberto), e não a
// última cobrança criada pelo Asaas. Caso de uma academia em 05/11/2026:
// novembro em aberto e a tela apontando dezembro, com "Em dia".
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../firebase.js', () => ({ auth: { currentUser: { getIdToken: async () => 't' } } }));
vi.mock('../../contexts/ToastContext.jsx', () => ({ useToast: () => ({ error: () => {}, success: () => {} }) }));

const { PlanInvoicesTab } = await import('../../views/settings/PlanInvoicesTab.jsx');

const base = {
  plan: 'starter', planName: 'Starter', priceMonthly: 97, billingCycle: 'monthly',
  paymentStatus: 'paid', hasSubscription: true, nextBillingAt: Date.parse('2026-12-05T12:00:00'),
  lastInvoiceUrl: 'https://asaas/i/dez', availablePlans: [],
};
const dez = { id: 'dez', status: 'PENDING', value: 97, dueDate: '2026-12-05', invoiceUrl: 'https://asaas/i/dez' };

let root, el;
async function render(json) {
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(json), { status: 200 }));
  el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => { root.render(h(PlanInvoicesTab)); });
  await act(async () => {});
}
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-06T10:00:00')); });
afterEach(() => { act(() => root.unmount()); el.remove(); vi.useRealTimers(); });

describe('PlanInvoicesTab, fatura a pagar', () => {
  it('novembro atrasado com dezembro criado: mostra Atrasada e leva a novembro', async () => {
    const nov = { id: 'nov', status: 'OVERDUE', value: 97, dueDate: '2026-11-05', invoiceUrl: 'https://asaas/i/nov' };
    await render({ ...base, invoices: [dez, nov], openInvoice: nov });
    expect(el.textContent).toContain('Atrasada');
    expect(el.textContent).toContain('fatura de 05/11/2026 em aberto');
    const pagar = [...el.querySelectorAll('a')].find((a) => a.textContent.includes('Pagar fatura'));
    expect(pagar.getAttribute('href')).toBe('https://asaas/i/nov');
    expect(el.textContent).not.toContain('Em dia');
  });

  it('fatura vencendo hoje não aparece como Em dia', async () => {
    vi.setSystemTime(new Date('2026-11-05T10:00:00'));
    const nov = { id: 'nov', status: 'PENDING', value: 97, dueDate: '2026-11-05', invoiceUrl: 'https://asaas/i/nov' };
    await render({ ...base, invoices: [dez, nov], openInvoice: nov });
    expect(el.textContent).toContain('Vence hoje');
  });

  it('falha ao buscar as faturas aparece como falha, não como lista vazia', async () => {
    await render({ ...base, invoices: [], openInvoice: null, invoicesError: true });
    expect(el.textContent).toContain('Não deu para buscar as faturas');
    expect(el.textContent).not.toContain('Nenhuma fatura emitida ainda');
  });

  it('tudo pago: Em dia e nada em aberto', async () => {
    await render({ ...base, invoices: [{ ...dez, status: 'RECEIVED' }], openInvoice: null });
    expect(el.textContent).toContain('Em dia');
    expect(el.textContent).toContain('Nada em aberto');
  });
});
