import { describe, it, expect } from 'vitest';
import { zapIntegrationState, ZAP_STATE, STRONILEAD_URL, zapConnectionFields } from '../zapIntegration.js';

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

describe('dados que o Stronizap pede', () => {
  it('o endereço é só a base do Stronilead, sem /api/zap', () => {
    // O Stronizap acrescenta /api/zap sozinho. Com o caminho aqui, quem copiava
    // ficava com /api/zap/api/zap e a conexão dava 404.
    expect(STRONILEAD_URL).toBe(new URL(STRONILEAD_URL).origin);
    expect(STRONILEAD_URL.startsWith('https://')).toBe(true);
  });

  it('vêm com os mesmos nomes e na mesma ordem do formulário do Stronizap', () => {
    const campos = zapConnectionFields('corpo-e-movimento');
    expect(campos.map((c) => c.label)).toEqual(['Endereço do CRM', 'Identificador da academia']);
    expect(campos[0].value).toBe(STRONILEAD_URL);
    expect(campos[1].value).toBe('corpo-e-movimento');
  });

  it('sem academia identificada, o identificador fica vazio', () => {
    expect(zapConnectionFields(undefined)[1].value).toBe('');
  });
});
