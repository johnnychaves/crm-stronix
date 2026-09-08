import { describe, it, expect } from 'vitest';
import { zapIntegrationState, ZAP_STATE } from '../zapIntegration.js';

describe('zapIntegrationState', () => {
  it('sem configuração é desconectado', () => {
    expect(zapIntegrationState(undefined)).toBe(ZAP_STATE.DESCONECTADO);
    expect(zapIntegrationState({})).toBe(ZAP_STATE.DESCONECTADO);
  });

  it('com chave válida é conectado', () => {
    expect(zapIntegrationState({ keyHash: 'a'.repeat(64), keyPrefix: 'szk_abc123' }))
      .toBe(ZAP_STATE.CONECTADO);
  });

  it('com chave revogada é revogado', () => {
    expect(zapIntegrationState({ keyHash: 'a'.repeat(64), revokedAt: new Date() }))
      .toBe(ZAP_STATE.REVOGADO);
  });
});
