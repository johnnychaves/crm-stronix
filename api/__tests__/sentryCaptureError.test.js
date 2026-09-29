import { describe, it, expect, vi, afterEach } from 'vitest';

const h = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn(), flush: vi.fn(async () => true) }));

vi.mock('@sentry/node', () => ({
  init: h.init,
  captureException: h.capture,
  flush: h.flush,
  httpIntegration: () => ({ name: 'Http' }),
}));

const DSN = 'https://chave@o1.ingest.sentry.io/1';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  // mockReset, e não mockClear: limpa também o que um teste deixou na fila do
  // mockImplementationOnce, para uma falha não vazar para o teste seguinte.
  h.init.mockReset();
  h.capture.mockReset();
  h.flush.mockReset().mockImplementation(async () => true);
});

// Deixa o próximo flush pendente. Devolve a função que o termina.
function travarProximoEnvio() {
  let terminar;
  h.flush.mockImplementationOnce(() => new Promise((ok) => { terminar = ok; }));
  return () => terminar(true);
}

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

  it('sem DSN também não chama init nem flush', async () => {
    vi.stubEnv('SENTRY_DSN', '');
    const { captureError } = await import('../_sentry.js');
    await captureError(new Error('x'), { url: '/api/tenant-resolve' });
    expect(h.init).not.toHaveBeenCalled();
    expect(h.flush).not.toHaveBeenCalled();
  });

  it('só termina quando o envio termina', async () => {
    vi.stubEnv('SENTRY_DSN', DSN);
    const terminarEnvio = travarProximoEnvio();
    const { captureError } = await import('../_sentry.js');
    let terminou = false;
    const pronto = captureError(new Error('x'), { url: '/api/tenant-resolve' }).then(() => { terminou = true; });
    await vi.waitFor(() => expect(h.flush).toHaveBeenCalled());
    await Promise.resolve();
    expect(terminou).toBe(false);
    terminarEnvio();
    await pronto;
    expect(terminou).toBe(true);
  });

  it('dois erros iniciam o SDK uma vez só e capturam duas', async () => {
    vi.stubEnv('SENTRY_DSN', DSN);
    const { captureError } = await import('../_sentry.js');
    await captureError(new Error('a'), { url: '/api/tenant-resolve' });
    await captureError(new Error('b'), { url: '/api/tenant-resolve' });
    expect(h.init).toHaveBeenCalledTimes(1);
    expect(h.capture).toHaveBeenCalledTimes(2);
  });

  // Telemetria não derruba a função. Um teste por passo que poderia lançar.
  it('não lança quando o envio falha', async () => {
    vi.stubEnv('SENTRY_DSN', DSN);
    h.flush.mockRejectedValueOnce(new Error('rede fora'));
    const { captureError } = await import('../_sentry.js');
    await expect(captureError(new Error('x'), { url: '/api/tenant-resolve' })).resolves.toBeUndefined();
  });

  it('não lança quando o SDK falha ao iniciar', async () => {
    vi.stubEnv('SENTRY_DSN', DSN);
    h.init.mockImplementationOnce(() => { throw new Error('init quebrou'); });
    const { captureError } = await import('../_sentry.js');
    await expect(captureError(new Error('x'), { url: '/api/tenant-resolve' })).resolves.toBeUndefined();
  });

  it('não lança quando o SDK falha ao capturar', async () => {
    vi.stubEnv('SENTRY_DSN', DSN);
    h.capture.mockImplementationOnce(() => { throw new Error('captura quebrou'); });
    const { captureError } = await import('../_sentry.js');
    await expect(captureError(new Error('x'), { url: '/api/tenant-resolve' })).resolves.toBeUndefined();
  });

  it('não lança quando a url do pedido não vira texto', async () => {
    vi.stubEnv('SENTRY_DSN', DSN);
    const req = { url: { toString() { throw new Error('toString quebrou'); } } };
    const { captureError } = await import('../_sentry.js');
    await expect(captureError(new Error('x'), req)).resolves.toBeUndefined();
  });
});

// O withSentry usa o captureError no catch: a resposta do handler não muda.
describe('withSentry', () => {
  it('sem erro, devolve o que o handler devolveu e não captura nada', async () => {
    vi.stubEnv('SENTRY_DSN', DSN);
    const { withSentry } = await import('../_sentry.js');
    await expect(withSentry(async () => 'resposta')({ url: '/api/zap' }, {})).resolves.toBe('resposta');
    expect(h.capture).not.toHaveBeenCalled();
    expect(h.flush).not.toHaveBeenCalled();
  });

  it('captura o erro com o endpoint sem a query, espera o envio e relança o mesmo erro', async () => {
    vi.stubEnv('SENTRY_DSN', DSN);
    const { withSentry } = await import('../_sentry.js');
    const erro = new Error('handler quebrou');
    await expect(withSentry(async () => { throw erro; })({ url: '/api/zap?tenant=t&phone=5511987654321' }, {}))
      .rejects.toBe(erro);
    expect(h.init).toHaveBeenCalledTimes(1);
    expect(h.capture).toHaveBeenCalledWith(erro, { tags: { endpoint: '/api/zap' } });
    expect(h.flush).toHaveBeenCalledWith(2000);
  });

  it('só relança quando o envio termina', async () => {
    vi.stubEnv('SENTRY_DSN', DSN);
    const terminarEnvio = travarProximoEnvio();
    const { withSentry } = await import('../_sentry.js');
    const erro = new Error('handler quebrou');
    let respondeu = false;
    const resposta = withSentry(async () => { throw erro; })({ url: '/api/zap' }, {})
      .catch((e) => { respondeu = true; return e; });
    await vi.waitFor(() => expect(h.flush).toHaveBeenCalled());
    await Promise.resolve();
    expect(respondeu).toBe(false);
    terminarEnvio();
    expect(await resposta).toBe(erro);
    expect(respondeu).toBe(true);
  });

  it('relança o erro do handler, e não o do SDK, quando o SDK falha', async () => {
    vi.stubEnv('SENTRY_DSN', DSN);
    h.capture.mockImplementationOnce(() => { throw new Error('captura quebrou'); });
    const { withSentry } = await import('../_sentry.js');
    const erro = new Error('handler quebrou');
    await expect(withSentry(async () => { throw erro; })({ url: '/api/zap' }, {})).rejects.toBe(erro);
  });
});
