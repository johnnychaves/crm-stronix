import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import util from 'node:util';
import handler from '../tenant-resolve.js';
import { CONFIRM_MIN_MS } from '../_passwordResetRoute.js';
import { PASSWORD_REJECTED_ERROR } from '../../src/lib/passwordPolicy.js';
import {
  CODE_REFUSED_MESSAGE, MAIL_OFF_MESSAGE, TOO_MANY_MESSAGE, EMAIL_INVALID_MESSAGE, SAVE_FAILED_MESSAGE,
} from '../../src/lib/passwordReset.js';

// As duas ações do "Esqueci a senha" no POST do tenant-resolve. O teste chama o
// handler de verdade e troca o fluxo, o repositório, o envio, o limitador, o
// Sentry e o waitUntil por versões falsas. O fluxo já tem teste próprio: aqui
// vale o que a rota responde, quando responde e o que ela põe no log.

const h = vi.hoisted(() => ({
  limiteOk: true, chaves: [], status: 'resend', adiados: [], capturados: [], sentryTravado: false,
  pedido: vi.fn(), troca: vi.fn(),
}));

vi.mock('../_firebaseAdmin.js', () => ({ adminDb: {}, adminAuth: {}, admin: {} }));
vi.mock('../_rateLimit.js', () => ({
  checkRateLimit: async (chave) => { h.chaves.push(chave); return { ok: h.limiteOk }; },
  clientIp: () => '203.0.113.7',
}));
vi.mock('@vercel/functions', () => ({ waitUntil: (p) => { h.adiados.push(p); } }));
vi.mock('../_mail.js', () => ({ mailStatus: () => h.status, sendMail: async () => {} }));
vi.mock('../_passwordResetFlow.js', () => ({ requestPasswordReset: h.pedido, confirmPasswordReset: h.troca }));
vi.mock('../_passwordResetRepo.js', () => ({
  // Como o de verdade: o secret não é enumerável, então copiar o deps o perde.
  realResetDeps: () => {
    const deps = { deps: 'de verdade' };
    Object.defineProperty(deps, 'secret', { value: 'segredo-de-teste', enumerable: false });
    return deps;
  },
}));
vi.mock('../_sentry.js', async (importOriginal) => ({
  ...(await importOriginal()),
  captureError: async (err) => {
    h.capturados.push(err);
    // Um Sentry que nunca responde: a rota não pode esperar por ele.
    if (h.sentryTravado) await new Promise(() => {});
  },
}));

const post = (body) => ({ method: 'POST', headers: {}, body });
const resposta = () => ({
  statusCode: 0,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});
const pedirCodigo = (email = 'ana@academia.com') => post({ action: 'password-reset-request', email });
const trocarSenha = (extra = {}) => post({
  action: 'password-reset-confirm', email: 'ana@academia.com', code: '123456', newPassword: 'Nova@Senha1', ...extra,
});

// Tudo o que foi para o console.error, como texto, para procurar o que não pode estar lá.
let log;
const saidaDoLog = () => util.inspect(log.mock.calls, { depth: null });

beforeEach(() => {
  h.limiteOk = true;
  h.chaves = [];
  h.status = 'resend';
  h.adiados = [];
  h.capturados = [];
  h.sentryTravado = false;
  h.pedido.mockReset();
  h.pedido.mockResolvedValue({ sent: true });
  h.troca.mockReset();
  h.troca.mockResolvedValue({ ok: true });
  log = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  log.mockRestore();
});

describe('POST password-reset-request', () => {
  it('responde 200 antes de o pedido terminar e entrega o trabalho ao waitUntil', async () => {
    let terminar;
    h.pedido.mockReturnValue(new Promise((r) => { terminar = r; }));
    const res = resposta();
    await handler(pedirCodigo(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(h.adiados).toHaveLength(1);
    expect(h.pedido).toHaveBeenCalledWith('ana@academia.com', '203.0.113.7', { deps: 'de verdade' });
    terminar({ sent: true });
    await h.adiados[0];
  });

  it('responde igual exista a conta ou não', async () => {
    h.pedido.mockResolvedValueOnce({ sent: true }).mockResolvedValueOnce({ sent: false, reason: 'unknown_email' });
    const a = resposta();
    const b = resposta();
    await handler(pedirCodigo('ana@academia.com'), a);
    await handler(pedirCodigo('ninguem@academia.com'), b);
    expect([a.statusCode, a.body]).toEqual([200, { ok: true }]);
    expect([b.statusCode, b.body]).toEqual([a.statusCode, a.body]);
  });

  it('passa o realResetDeps() direto ao fluxo, sem copiar, para o secret chegar', async () => {
    await handler(pedirCodigo(), resposta());
    await h.adiados[0];
    expect(h.pedido.mock.calls[0][2].secret).toBe('segredo-de-teste');
  });

  it('erro depois da resposta vai para o Sentry e não chega à tela', async () => {
    const erro = new Error('Firestore fora do ar');
    h.pedido.mockRejectedValue(erro);
    const res = resposta();
    await handler(pedirCodigo(), res);
    await h.adiados[0];
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(h.capturados).toEqual([erro]);
  });

  it('o log da falha leva o status do Resend e o motivo da rede, e nunca o e-mail', async () => {
    const erro = Object.assign(new Error('O Resend recusou o e-mail (422)'), { status: 422, cause: { code: 'ECONNRESET' } });
    h.pedido.mockRejectedValue(erro);
    await handler(pedirCodigo(), resposta());
    await h.adiados[0];
    expect(log).toHaveBeenCalledWith('esqueci-a-senha: pedido falhou', {
      erro: 'O Resend recusou o e-mail (422)', status: 422, causa: 'ECONNRESET',
    });
    expect(saidaDoLog()).not.toContain('ana@academia.com');
  });

  it('503 com o envio desligado, sem pedir nada', async () => {
    h.status = 'off';
    const res = resposta();
    await handler(pedirCodigo(), res);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: MAIL_OFF_MESSAGE });
    expect(h.pedido).not.toHaveBeenCalled();
  });

  it('com o envio no modo log (Preview) o pedido segue', async () => {
    h.status = 'log';
    const res = resposta();
    await handler(pedirCodigo(), res);
    expect(res.statusCode).toBe(200);
    expect(h.pedido).toHaveBeenCalledTimes(1);
  });

  it('429 no limite por IP, com chave própria', async () => {
    h.limiteOk = false;
    const res = resposta();
    await handler(pedirCodigo(), res);
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: TOO_MANY_MESSAGE });
    expect(h.chaves).toEqual(['pw-reset-request:203.0.113.7']);
    expect(h.pedido).not.toHaveBeenCalled();
  });

  it('400 para e-mail fora do formato', async () => {
    const res = resposta();
    await handler(pedirCodigo('sem-arroba'), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: EMAIL_INVALID_MESSAGE });
    expect(h.pedido).not.toHaveBeenCalled();
  });
});

// Toda resposta da troca espera CONFIRM_MIN_MS. Os testes usam relógio falso:
// começam o pedido, avançam o tempo e esperam o fim.
describe('POST password-reset-confirm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function trocar(pedido, res = resposta()) {
    const feito = handler(pedido, res);
    await vi.advanceTimersByTimeAsync(CONFIRM_MIN_MS);
    await feito;
    return res;
  }

  it('200 quando troca', async () => {
    h.troca.mockResolvedValue({ ok: true });
    const res = await trocar(trocarSenha());
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(h.troca).toHaveBeenCalledWith(
      { email: 'ana@academia.com', code: '123456', newPassword: 'Nova@Senha1', ip: '203.0.113.7' },
      { deps: 'de verdade' },
    );
    expect(h.chaves).toEqual(['pw-reset-confirm:203.0.113.7']);
  });

  it('passa o realResetDeps() direto ao fluxo, sem copiar, para o secret chegar', async () => {
    await trocar(trocarSenha());
    expect(h.troca.mock.calls[0][1].secret).toBe('segredo-de-teste');
  });

  it('qualquer recusa de conta ou de código dá a mesma frase', async () => {
    for (const reason of ['unknown_email', 'wrong_code', 'no_live_code', 'account_changed', 'bad_format']) {
      h.troca.mockResolvedValueOnce({ ok: false, reason });
      const res = await trocar(trocarSenha());
      expect(res.statusCode, reason).toBe(400);
      expect(res.body, reason).toEqual({ error: CODE_REFUSED_MESSAGE });
    }
  });

  it('senha fora da regra volta com o campo, sem chamar o fluxo', async () => {
    const res = await trocar(trocarSenha({ newPassword: 'fraca' }));
    expect(res.statusCode).toBe(400);
    expect(res.body.field).toBe('newPassword');
    expect(res.body.error).toMatch(/^A senha precisa ter/);
    expect(h.troca).not.toHaveBeenCalled();
  });

  it('recusa do Firebase à senha volta com o campo', async () => {
    h.troca.mockResolvedValue({ ok: false, reason: 'password_rejected' });
    const res = await trocar(trocarSenha());
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: PASSWORD_REJECTED_ERROR, field: 'newPassword' });
  });

  it('e-mail ou código que não é texto dá a frase única sem chamar o fluxo', async () => {
    for (const extra of [{ code: 123456 }, { email: ['ana@academia.com'] }]) {
      const res = await trocar(trocarSenha(extra));
      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: CODE_REFUSED_MESSAGE });
    }
    expect(h.troca).not.toHaveBeenCalled();
  });

  it('429 no limite por IP', async () => {
    h.limiteOk = false;
    const res = await trocar(trocarSenha());
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: TOO_MANY_MESSAGE });
    expect(h.troca).not.toHaveBeenCalled();
  });

  describe('erro inesperado', () => {
    it('dá 500 com a frase e entrega o erro ao Sentry pelo waitUntil', async () => {
      const erro = new Error('Firebase fora do ar');
      h.troca.mockRejectedValue(erro);
      const res = await trocar(trocarSenha());
      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: SAVE_FAILED_MESSAGE });
      expect(h.capturados).toEqual([erro]);
      expect(h.adiados).toHaveLength(1);
    });

    it('responde sem esperar o Sentry', async () => {
      h.sentryTravado = true;
      h.troca.mockRejectedValue(new Error('Firebase fora do ar'));
      const res = await trocar(trocarSenha());
      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: SAVE_FAILED_MESSAGE });
      expect(h.adiados).toHaveLength(1);
    });

    it('o log leva o status e o motivo da rede, e nunca e-mail, código nem senha', async () => {
      const erro = Object.assign(new Error('Firebase fora do ar'), { status: 503, cause: { code: 'ETIMEDOUT' } });
      h.troca.mockRejectedValue(erro);
      await trocar(trocarSenha());
      expect(log).toHaveBeenCalledWith('esqueci-a-senha: troca falhou', {
        erro: 'Firebase fora do ar', status: 503, causa: 'ETIMEDOUT',
      });
      const saida = saidaDoLog();
      for (const segredo of ['ana@academia.com', '123456', 'Nova@Senha1']) {
        expect(saida).not.toContain(segredo);
      }
    });
  });

  describe('tempo mínimo', () => {
    it('vale CONFIRM_MIN_MS, 1500 ms', () => {
      expect(CONFIRM_MIN_MS).toBe(1500);
    });

    // Cada caso: como preparar, o pedido e o status esperado.
    const casos = [
      ['200 quando troca', () => {}, () => trocarSenha(), 200],
      ['400 de código recusado', () => h.troca.mockResolvedValue({ ok: false, reason: 'wrong_code' }), () => trocarSenha(), 400],
      ['400 de senha recusada pelo Firebase', () => h.troca.mockResolvedValue({ ok: false, reason: 'password_rejected' }), () => trocarSenha(), 400],
      ['400 de senha fora da regra', () => {}, () => trocarSenha({ newPassword: 'fraca' }), 400],
      ['400 de código que não é texto', () => {}, () => trocarSenha({ code: 123456 }), 400],
      ['429 no limite por IP', () => { h.limiteOk = false; }, () => trocarSenha(), 429],
      ['500 de erro inesperado', () => h.troca.mockRejectedValue(new Error('Firebase fora do ar')), () => trocarSenha(), 500],
    ];

    it.each(casos)('%s só sai depois de CONFIRM_MIN_MS', async (_nome, preparar, pedido, esperado) => {
      preparar();
      const res = resposta();
      const feito = handler(pedido(), res);
      await vi.advanceTimersByTimeAsync(CONFIRM_MIN_MS - 1);
      expect(res.statusCode).toBe(0);
      await vi.advanceTimersByTimeAsync(1);
      await feito;
      expect(res.statusCode).toBe(esperado);
    });

    it('e-mail sem conta e código errado de conta que existe respondem no mesmo instante', async () => {
      // O fluxo de verdade gasta mais quando a conta existe: leitura da equipe,
      // transação da tentativa. O teste simula 600 ms a mais para esse caso.
      h.troca.mockImplementation(async ({ email }) => {
        if (email === 'ninguem@academia.com') return { ok: false, reason: 'unknown_email' };
        await new Promise((r) => setTimeout(r, 600));
        return { ok: false, reason: 'wrong_code' };
      });
      const semConta = resposta();
      const comConta = resposta();
      const a = handler(trocarSenha({ email: 'ninguem@academia.com' }), semConta);
      const b = handler(trocarSenha(), comConta);

      await vi.advanceTimersByTimeAsync(CONFIRM_MIN_MS - 1);
      expect(h.troca).toHaveBeenCalledTimes(2);
      expect(semConta.statusCode).toBe(0);
      expect(comConta.statusCode).toBe(0);

      await vi.advanceTimersByTimeAsync(1);
      await Promise.all([a, b]);
      expect([semConta.statusCode, semConta.body]).toEqual([comConta.statusCode, comConta.body]);
      expect(comConta.statusCode).toBe(400);
    });

    it('o piso não soma ao trabalho: quem demora mais responde quando o trabalho termina', async () => {
      h.troca.mockImplementation(() => new Promise((r) => setTimeout(() => r({ ok: true }), 2000)));
      const res = resposta();
      const feito = handler(trocarSenha(), res);
      await vi.advanceTimersByTimeAsync(1999);
      expect(res.statusCode).toBe(0);
      await vi.advanceTimersByTimeAsync(1);
      await feito;
      expect(res.statusCode).toBe(200);
    });
  });
});

describe('o resto do POST do tenant-resolve', () => {
  it('ação desconhecida continua 405', async () => {
    const res = resposta();
    await handler(post({ action: 'outra-coisa' }), res);
    expect(res.statusCode).toBe(405);
  });

  it('as duas ações da indicação continuam no lugar', async () => {
    h.limiteOk = false;
    for (const action of ['referral-info', 'referral-signup']) {
      const res = resposta();
      await handler(post({ action, slug: 'academia-teste' }), res);
      expect(res.statusCode, action).toBe(429);
    }
    expect(h.chaves).toEqual(['referral-info:203.0.113.7', 'referral-signup:203.0.113.7', 'referral-signup:slug:academia-teste']);
  });
});

describe('vercel.json', () => {
  it('dá ao tenant-resolve tempo para o pedido inteiro, envio de até 8 s incluso', () => {
    const config = JSON.parse(fs.readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
    expect(config.functions['api/tenant-resolve.js'].maxDuration).toBeGreaterThanOrEqual(30);
  });
});
