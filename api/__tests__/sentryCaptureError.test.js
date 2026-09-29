import { describe, it, expect, vi, afterEach } from 'vitest';

const h = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn(), flush: vi.fn(async () => true) }));

vi.mock('@sentry/node', () => ({
  init: h.init,
  captureException: h.capture,
  flush: h.flush,
  httpIntegration: () => ({ name: 'Http' }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  h.init.mockClear();
  h.capture.mockClear();
  h.flush.mockClear();
});

describe('captureError', () => {
  it('sem DSN, não manda nada', async () => {
    vi.stubEnv('SENTRY_DSN', '');
    const { captureError } = await import('../_sentry.js');
    await captureError(new Error('x'), { url: '/api/tenant-resolve' });
    expect(h.capture).not.toHaveBeenCalled();
  });

  it('com DSN, captura com o endpoint sem a query e espera o envio', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://chave@o1.ingest.sentry.io/1');
    const { captureError } = await import('../_sentry.js');
    const erro = new Error('Resend fora do ar');
    await captureError(erro, { url: '/api/tenant-resolve?slug=academia-teste' });
    expect(h.init).toHaveBeenCalledTimes(1);
    expect(h.capture).toHaveBeenCalledWith(erro, { tags: { endpoint: '/api/tenant-resolve' } });
    expect(h.flush).toHaveBeenCalledWith(2000);
  });
});
