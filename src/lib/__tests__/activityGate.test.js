import { describe, it, expect } from 'vitest';
import { shouldListen, IDLE_TIMEOUT_MS } from '../activityGate.js';

const T0 = 1_700_000_000_000; // instante fixo qualquer, em ms

describe('shouldListen', () => {
  it('mantém ligado logo após uma atividade', () => {
    expect(shouldListen({ lastActivityMs: T0, nowMs: T0 })).toBe(true);
  });

  it('mantém ligado um segundo antes de estourar o limite', () => {
    const now = T0 + IDLE_TIMEOUT_MS - 1000;
    expect(shouldListen({ lastActivityMs: T0, nowMs: now })).toBe(true);
  });

  it('desliga exatamente no limite de ociosidade', () => {
    const now = T0 + IDLE_TIMEOUT_MS;
    expect(shouldListen({ lastActivityMs: T0, nowMs: now })).toBe(false);
  });

  it('segue desligado bem depois do limite (a madrugada inteira)', () => {
    const oitoHoras = 8 * 60 * 60 * 1000;
    expect(shouldListen({ lastActivityMs: T0, nowMs: T0 + oitoHoras })).toBe(false);
  });

  it('respeita um limite customizado', () => {
    const umMinuto = 60 * 1000;
    expect(shouldListen({ lastActivityMs: T0, nowMs: T0 + 30_000, idleTimeoutMs: umMinuto })).toBe(true);
    expect(shouldListen({ lastActivityMs: T0, nowMs: T0 + 90_000, idleTimeoutMs: umMinuto })).toBe(false);
  });

  // A máquina de recepção volta de suspensão e o relógio pode ter sido ajustado
  // pra trás. Isso NÃO pode derrubar as assinaturas de quem acabou de sentar.
  it('mantém ligado quando o relógio anda pra trás', () => {
    expect(shouldListen({ lastActivityMs: T0, nowMs: T0 - 60_000 })).toBe(true);
  });

  // Na dúvida o app fica ligado: é melhor pagar leitura do que deixar a tela
  // congelada em cima de um dado inválido.
  it('mantém ligado com entrada inválida', () => {
    expect(shouldListen({ lastActivityMs: undefined, nowMs: T0 })).toBe(true);
    expect(shouldListen({ lastActivityMs: T0, nowMs: NaN })).toBe(true);
    expect(shouldListen({})).toBe(true);
  });
});
