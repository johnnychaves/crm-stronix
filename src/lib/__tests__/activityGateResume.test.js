// @vitest-environment jsdom
// A volta da pausa por inatividade pode esperar o `beforeResume` antes de
// religar as assinaturas. É ali que o app confere se saiu versão nova: se for
// recarregar, as assinaturas não religam, senão o Firestore leria tudo duas
// vezes (uma na volta e outra depois da recarga).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useActivityGate } from '../../hooks/useActivityGate.js';
import { IDLE_TIMEOUT_MS, IDLE_CHECK_MS, RESUME_HOLD_MAX_MS } from '../activityGate.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root = null;
// O valor do hook sai pelo efeito, depois de cada render.
const saida = { ativo: null };
const lerAtivo = () => saida.ativo;
async function montar(opcoes) {
  vi.useFakeTimers();
  function Sonda() {
    const ativo = useActivityGate(undefined, opcoes);
    useEffect(() => { saida.ativo = ativo; });
    return null;
  }
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(h(Sonda)); });
}
const pausar = () => act(async () => { vi.advanceTimersByTime(IDLE_TIMEOUT_MS + IDLE_CHECK_MS); });
const mexer = () => act(async () => { window.dispatchEvent(new Event('mousemove')); });

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  vi.useRealTimers();
});

describe('useActivityGate com beforeResume', () => {
  it('sem beforeResume, a volta religa na hora, como antes', async () => {
    await montar();
    await pausar();
    expect(lerAtivo()).toBe(false);
    await mexer();
    expect(lerAtivo()).toBe(true);
  });

  it('com beforeResume, a volta espera o resume', async () => {
    let retomar = null;
    const beforeResume = vi.fn((resume) => { retomar = resume; });
    await montar({ beforeResume });
    await pausar();

    await mexer();
    expect(beforeResume).toHaveBeenCalledTimes(1);
    expect(lerAtivo()).toBe(false);

    await act(async () => { retomar(); });
    expect(lerAtivo()).toBe(true);
  });

  it('enquanto espera, mais movimento não chama de novo e o relógio não religa', async () => {
    const beforeResume = vi.fn();
    await montar({ beforeResume });
    await pausar();
    // A volta começa 5 s antes da batida do relógio, para a batida cair
    // dentro da espera (mais curta que o intervalo do relógio).
    await act(async () => { vi.advanceTimersByTime(IDLE_CHECK_MS - 5000); });

    await mexer();
    await mexer();
    await act(async () => { vi.advanceTimersByTime(6000); });

    expect(6000).toBeLessThan(RESUME_HOLD_MAX_MS);
    expect(beforeResume).toHaveBeenCalledTimes(1);
    expect(lerAtivo()).toBe(false);
  });

  it('se o beforeResume não responder, religa sozinho depois do limite', async () => {
    await montar({ beforeResume: () => {} });
    await pausar();
    await mexer();

    await act(async () => { vi.advanceTimersByTime(RESUME_HOLD_MAX_MS); });
    expect(lerAtivo()).toBe(true);
  });

  it('com o app em uso, o beforeResume nunca é chamado', async () => {
    const beforeResume = vi.fn();
    await montar({ beforeResume });
    await mexer();
    await act(async () => { vi.advanceTimersByTime(IDLE_CHECK_MS * 3); });
    await mexer();

    expect(beforeResume).not.toHaveBeenCalled();
    expect(lerAtivo()).toBe(true);
  });

  it('depois de retomar, a próxima pausa e a próxima volta chamam de novo', async () => {
    const beforeResume = vi.fn((resume) => resume());
    await montar({ beforeResume });
    await pausar();
    await mexer();
    expect(lerAtivo()).toBe(true);

    await pausar();
    expect(lerAtivo()).toBe(false);
    await mexer();

    expect(beforeResume).toHaveBeenCalledTimes(2);
    expect(lerAtivo()).toBe(true);
  });
});
