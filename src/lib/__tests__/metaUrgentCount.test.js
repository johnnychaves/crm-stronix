// @vitest-environment jsdom
// O contador de urgentes da Meta que vai para o título da aba: conta o que já
// é urgente, anda com o relógio sem depender de dado novo, acompanha a troca de
// categoria (o Novo lead que vira Atrasado) e zera ao sair.
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MetaUrgentCount } from '../../components/dailygoal/MetaUrgentCount.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Terça, 20/10/2026: depois de 17/10, quando o lead novo sem próximo passo
// passou a virar Atrasado.
const at = (hh, mm = 0, dias = 0) => new Date(2026, 9, 20 + dias, hh, mm);
const base = (id, extra) => ({
  id, name: id, whatsapp: '51999990000', consultantId: 'u1', consultantName: 'Ana',
  status: 'Novo', funnelId: 'f1', createdAt: at(10, 0, -10), source: 'Site', ...extra,
});
// Visita às 17h (urgente a partir das 15:30) e contato às 15h.
const VISITA = base('visita', { appointmentType: 'visita', appointmentScheduledFor: at(17), nextFollowUp: at(17), nextFollowUpType: 'Visita' });
const CONTATO = base('contato', { nextFollowUp: at(15), nextFollowUpType: 'Ligação' });
// Cadastrado ontem às 15h: a janela de 24h fecha hoje às 15h.
const NOVO = base('novo', { createdAt: at(15, 0, -1) });

let root, host, onChange;
const montar = (leads) => act(() => root.render(h(MetaUrgentCount, {
  leads, interactions: [], userId: 'u1', renewalCheckpoints: [90, 60, 30], renewalGraceDays: undefined, onChange,
})));

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
  it('conta só o que é urgente', () => {
    montar([VISITA, CONTATO]);
    // Às 14h só o contato das 15h está nos 90 minutos.
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('anda com o relógio, sem precisar de dado novo', () => {
    montar([VISITA, CONTATO]);
    act(() => { vi.advanceTimersByTime(91 * 60 * 1000); });
    // 15:31: a visita das 17h entrou nos 90 minutos.
    expect(onChange).toHaveBeenLastCalledWith(2);
  });

  it('o Novo lead que passa da janela de 24h vira Atrasado e deixa de contar', () => {
    montar([NOVO]);
    // 14h: a janela fecha em 60 minutos, então é urgente.
    expect(onChange).toHaveBeenLastCalledWith(1);
    act(() => { vi.advanceTimersByTime(91 * 60 * 1000); });
    // 15:31: a janela fechou, e o Atrasado não é urgente.
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('só avisa quando o número muda', () => {
    montar([VISITA, CONTATO]);
    const antes = onChange.mock.calls.length;
    act(() => { vi.advanceTimersByTime(10 * 60 * 1000); });
    expect(onChange.mock.calls.length).toBe(antes);
  });

  it('zera o título ao sair', () => {
    montar([VISITA, CONTATO]);
    act(() => root.unmount());
    expect(onChange).toHaveBeenLastCalledWith(0);
    root = createRoot(host);
  });
});
