import { describe, it, expect } from 'vitest';
import { SENTRY_OPTIONS, endpointTag } from '../_sentry.js';
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

  it('desliga o corpo do pedido na integração http', () => {
    const http = SENTRY_OPTIONS.integrations?.find((i) => i.name === 'Http');
    expect(http).toBeDefined();
  });

  it('passa todo evento pelo scrubEvent', () => {
    expect(SENTRY_OPTIONS.beforeSend).toBe(scrubEvent);
  });

  it('passa todo breadcrumb pelo scrubBreadcrumb', () => {
    expect(SENTRY_OPTIONS.beforeBreadcrumb).toBe(scrubBreadcrumb);
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
