import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// O SDK do Firebase é mockado: o que interessa testar é a nossa decisão de
// inicializar ou não, e com quais argumentos. A implementação do Google não.
const initializeAppCheck = vi.fn(() => ({ fake: 'appcheck' }));
class ReCaptchaEnterpriseProvider {
  constructor(key) { this.key = key; }
}

vi.mock('firebase/app-check', () => ({
  initializeAppCheck: (...args) => initializeAppCheck(...args),
  ReCaptchaEnterpriseProvider,
}));

const FAKE_APP = { name: 'fake' };

describe('initAppCheck', () => {
  beforeEach(() => {
    initializeAppCheck.mockClear();
    delete globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('nao inicializa quando falta o site key', async () => {
    vi.stubEnv('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY', '');
    vi.resetModules();
    const { initAppCheck } = await import('../appCheck.js');

    expect(initAppCheck(FAKE_APP)).toBe(null);
    expect(initializeAppCheck).not.toHaveBeenCalled();
  });

  it('inicializa com o provider Enterprise quando o site key existe', async () => {
    vi.stubEnv('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY', 'chave-de-teste');
    vi.resetModules();
    const { initAppCheck } = await import('../appCheck.js');

    expect(initAppCheck(FAKE_APP)).toEqual({ fake: 'appcheck' });
    expect(initializeAppCheck).toHaveBeenCalledTimes(1);

    const [appArg, options] = initializeAppCheck.mock.calls[0];
    expect(appArg).toBe(FAKE_APP);
    expect(options.provider.key).toBe('chave-de-teste');
    expect(options.isTokenAutoRefreshEnabled).toBe(true);
  });

  it('devolve null e nao derruba o boot quando a inicializacao falha', async () => {
    vi.stubEnv('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY', 'chave-de-teste');
    vi.resetModules();
    initializeAppCheck.mockImplementationOnce(() => { throw new Error('boom'); });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { initAppCheck } = await import('../appCheck.js');
    expect(initAppCheck(FAKE_APP)).toBe(null);
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });
});
