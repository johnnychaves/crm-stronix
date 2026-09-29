import { describe, it, expect } from 'vitest';
import { SENTRY_OPTIONS, HTTP_OPTIONS, endpointTag } from '../_sentry.js';
import { scrubEvent, scrubBreadcrumb } from '../../src/lib/sentryScrub.js';

describe('SENTRY_OPTIONS das funções da api', () => {
  it('corta header, cookie, query e variável local na origem', () => {
    expect(SENTRY_OPTIONS.dataCollection).toMatchObject({
      userInfo: false,
      httpBodies: [],
      httpHeaders: { request: false, response: false },
      cookies: false,
      urlQueryParams: false,
      stackFrameVariables: false
    });
  });

  it('desliga o corpo do pedido na integração http, com o valor certo', () => {
    const http = SENTRY_OPTIONS.integrations?.find((i) => i.name === 'Http');
    expect(http).toBeDefined();
    expect(HTTP_OPTIONS.maxIncomingRequestBodySize).toBe('none');
  });

  it('passa todo evento pelo scrubEvent', () => {
    expect(SENTRY_OPTIONS.beforeSend).toBe(scrubEvent);
  });

  it('passa toda transação pelo scrubEvent também', () => {
    expect(SENTRY_OPTIONS.beforeSendTransaction).toBe(scrubEvent);
  });

  it('descarta a migalha de console, que no log da api leva uid, academia, IP e e-mail', () => {
    const migalha = {
      category: 'console',
      message: 'esqueci-a-senha: envio falhou [object Object]',
      data: { logger: 'console', arguments: ['esqueci-a-senha: envio falhou', { conta: 'uid-da-conta', ip: '203.0.113.77' }] }
    };
    expect(SENTRY_OPTIONS.beforeBreadcrumb(migalha)).toBe(null);
  });

  it('passa as outras migalhas pelo scrubBreadcrumb', () => {
    const pedido = {
      category: 'http',
      message: 'POST /api/x tel 11987654321',
      data: { url: 'https://api.exemplo.com/v1?phone=5511987654321', 'http.query': '?phone=5511987654321' }
    };
    const esperado = scrubBreadcrumb(structuredClone(pedido));
    const saiu = SENTRY_OPTIONS.beforeBreadcrumb(pedido);
    expect(saiu).toEqual(esperado);
    expect(saiu.message).toBe('POST /api/x tel [telefone]');
    expect(saiu.data.url).toBe('https://api.exemplo.com/v1');
    expect(saiu.data).not.toHaveProperty('http.query');
  });

  it('aguenta migalha nula', () => {
    expect(SENTRY_OPTIONS.beforeBreadcrumb(null)).toBe(null);
  });
});

describe('endpointTag', () => {
  it('tira o identificador e o telefone da URL', () => {
    expect(endpointTag({ url: '/api/zap?tenant=stronix-crm-app&phone=5511987654321' })).toBe('/api/zap');
  });

  it('aguenta pedido sem url', () => {
    expect(endpointTag(undefined)).toBe('');
  });
});
