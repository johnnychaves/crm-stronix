// Fiação do Sentry do front (src/lib/sentry.js) com o SDK simulado. Quem
// limpa o dado é o sentryScrub, testado à parte. Aqui a trava é outra: que os
// ganchos continuem ligados. Tirar o beforeSendSpan, por exemplo, deixa a
// span do INP sair sem limpeza nenhuma, e nenhum outro teste veria isso.
// O sentry.js lê o DSN quando é carregado, por isso cada caso limpa o
// registro de módulos e importa de novo depois de trocar a variável.
import { describe, it, expect, vi, afterEach } from 'vitest';

const m = vi.hoisted(() => ({
  init: vi.fn(),
  tracing: vi.fn((options) => ({ name: 'BrowserTracing', options })),
  setUser: vi.fn(),
  setTags: vi.fn(),
}));

vi.mock('@sentry/react', () => ({
  init: m.init,
  browserTracingIntegration: m.tracing,
  setUser: m.setUser,
  setTags: m.setTags,
}));

async function loadWithDsn(dsn) {
  vi.resetModules();
  vi.stubEnv('VITE_SENTRY_DSN', dsn);
  const sentry = await import('../sentry.js');
  const scrub = await import('../sentryScrub.js');
  const routes = await import('../routes.js');
  return { sentry, scrub, routes };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('initSentry', () => {
  it('com DSN, liga os quatro ganchos de limpeza no init', async () => {
    const { sentry, scrub } = await loadWithDsn('https://publica@o0.ingest.sentry.io/0');
    expect(sentry.initSentry()).toBe(true);
    expect(m.init).toHaveBeenCalledTimes(1);
    const options = m.init.mock.calls[0][0];
    expect(options.dsn).toBe('https://publica@o0.ingest.sentry.io/0');
    expect(options.beforeSend).toBe(scrub.scrubEvent);
    expect(options.beforeSendTransaction).toBe(scrub.scrubEvent);
    expect(options.beforeSendSpan).toBe(scrub.scrubSpan);
    expect(options.beforeBreadcrumb).toBe(scrub.scrubBreadcrumb);
    expect(options.dataCollection).toEqual({ userInfo: false, httpBodies: [] });
    expect(options.tracesSampleRate).toBe(0.1);
  });

  it('usa a integração de navegação do navegador, com o molde da tela no nome', async () => {
    const { sentry } = await loadWithDsn('https://publica@o0.ingest.sentry.io/0');
    sentry.initSentry();
    expect(m.tracing).toHaveBeenCalledTimes(1);
    expect(typeof m.tracing.mock.calls[0][0].beforeStartSpan).toBe('function');
    const options = m.init.mock.calls[0][0];
    expect(options.integrations).toEqual([m.tracing.mock.results[0].value]);
  });

  it('o nome da span é o molde da tela de destino, sem academia e sem id do lead', async () => {
    const { sentry, routes } = await loadWithDsn('https://publica@o0.ingest.sentry.io/0');
    sentry.initSentry();
    const { beforeStartSpan } = m.tracing.mock.calls[0][0];
    const path = '/stronix-crm-app/ficha/Ab12Cd34Ef56Gh78Ij90';
    // Na navegação o SDK chama o gancho antes de o endereço trocar: a barra
    // ainda está na tela de antes, e o destino vem em options.name. O nome
    // sai do destino, senão a transação levaria o molde da tela anterior.
    vi.stubGlobal('window', { location: { pathname: '/stronix-crm-app/pipeline' } });
    const attributes = { 'sentry.source': 'url' };
    const out = beforeStartSpan({ name: path, op: 'navigation', attributes });
    expect(out.name).toBe('/:tenant/ficha/:leadId');
    expect(out.name).toBe(routes.routeTemplate(path));
    expect(out.op).toBe('navigation');
    expect(out.attributes).toBe(attributes);
    expect(out.name).not.toContain('Ab12Cd34Ef56Gh78Ij90');
    expect(out.name).not.toContain('stronix-crm-app');
  });

  it('sem DSN, não sobe nada', async () => {
    const { sentry } = await loadWithDsn('');
    expect(sentry.initSentry()).toBe(false);
    expect(m.init).not.toHaveBeenCalled();
    expect(m.tracing).not.toHaveBeenCalled();
  });
});
