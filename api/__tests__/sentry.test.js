import { describe, it, expect } from 'vitest';
import { SENTRY_OPTIONS, endpointTag } from '../_sentry.js';
import { HEADERS_PERMITIDOS, scrubEvent } from '../../src/lib/sentryScrub.js';

describe('SENTRY_OPTIONS das funções da api', () => {
  it('corta header, cookie e query na origem', () => {
    expect(SENTRY_OPTIONS.dataCollection).toMatchObject({
      userInfo: false,
      httpBodies: [],
      httpHeaders: { request: false, response: false },
      cookies: false,
      urlQueryParams: false
    });
  });

  it('passa todo evento pelo scrubEvent', () => {
    expect(SENTRY_OPTIONS.beforeSend).toBe(scrubEvent);
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
