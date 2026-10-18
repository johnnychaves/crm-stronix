// @vitest-environment jsdom
// O contador de urgentes da Meta que vai para o título da aba: conta o que já
// é urgente, anda com o relógio sem depender de dado novo e zera ao sair.
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MetaUrgentCount } from '../../components/dailygoal/MetaUrgentCount.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const at = (hh, mm = 0) => new Date(2026, 9, 16, hh, mm);
const lead = (id, slug, extra) => ({ id, name: id, categorySlugs: [slug], categoryStatus: {}, ...extra });
// Visita às 17h (urgente a partir das 15:30), contato às 15h e uma visita já feita.
const SLOTS = [
  lead('visita', 'visita_hoje', { appointmentType: 'visita', appointmentScheduledFor: at(17) }),
  lead('contato', 'contato_hoje', { nextFollowUp: at(15), nextFollowUpType: 'Ligação' }),
  lead('feita', 'visita_hoje', { appointmentType: 'visita', appointmentScheduledFor: at(14), categoryStatus: { visita_hoje: true } }),
];

let root, host, onChange;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'], now: at(14, 0) });
  host = document.createElement('div');
  root = createRoot(host);
  onChange = vi.fn();
});
afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

describe('MetaUrgentCount', () => {
  it('conta só o que é urgente e está pendente', () => {
    act(() => root.render(h(MetaUrgentCount, { slots: SLOTS, onChange })));
    // Às 14h só o contato das 15h está nos 90 minutos; a visita feita não conta.
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('anda com o relógio, sem precisar de dado novo', () => {
    act(() => root.render(h(MetaUrgentCount, { slots: SLOTS, onChange })));
    act(() => { vi.advanceTimersByTime(91 * 60 * 1000); });
    // 15:31: a visita das 17h entrou nos 90 minutos.
    expect(onChange).toHaveBeenLastCalledWith(2);
  });

  it('só avisa quando o número muda', () => {
    act(() => root.render(h(MetaUrgentCount, { slots: SLOTS, onChange })));
    const antes = onChange.mock.calls.length;
    act(() => { vi.advanceTimersByTime(10 * 60 * 1000); });
    expect(onChange.mock.calls.length).toBe(antes);
  });

  it('zera o título ao sair', () => {
    act(() => root.render(h(MetaUrgentCount, { slots: SLOTS, onChange })));
    act(() => root.unmount());
    expect(onChange).toHaveBeenLastCalledWith(0);
    root = createRoot(host);
  });
});
