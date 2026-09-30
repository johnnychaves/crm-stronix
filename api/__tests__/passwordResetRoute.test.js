import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import util from 'node:util';
import handler from '../tenant-resolve.js';
import { CONFIRM_MIN_MS, rateKeyIp } from '../_passwordResetRoute.js';
import { PASSWORD_REJECTED_ERROR } from '../../src/lib/passwordPolicy.js';
import {
  CODE_REFUSED_MESSAGE, MAIL_OFF_MESSAGE, TOO_MANY_MESSAGE, EMAIL_INVALID_MESSAGE, SAVE_FAILED_MESSAGE, SEND_FAILED_MESSAGE,
} from '../../src/lib/passwordReset.js';

// As duas ações do "Esqueci a senha" no POST do tenant-resolve. O teste chama o
// handler de verdade e troca o fluxo, o repositório, o envio, o limitador, o
// Sentry e o waitUntil por versões falsas. O fluxo já tem teste próprio: aqui
// vale o que a rota responde, quando responde e o que ela põe no log.

const h = vi.hoisted(() => ({
  limiteOk: true, limiteErro: null, recusadas: [], chamadas: [], status: 'resend', ip: '203.0.113.7',
  adiados: [], capturados: [], sentryTravado: false, depsErro: null,
  pedido: vi.fn(), troca: vi.fn(),
}));

vi.mock('../_firebaseAdmin.js', () => ({ adminDb: {}, adminAuth: {}, admin: {} }));
vi.mock('../_rateLimit.js', () => ({
  // Guarda a chave e os números de cada contagem, para o teste conferir os
  // limites. O limiteOk recusa todas as chaves, e o recusadas só as dadas.
  checkRateLimit: async (chave, opcoes) => {
    h.chamadas.push({ chave, limit: opcoes?.limit, windowMs: opcoes?.windowMs });
    if (h.limiteErro) throw h.limiteErro;
    return { ok: h.limiteOk && !h.recusadas.includes(chave) };
  },
  clientIp: () => h.ip,
}));
// Como o de verdade, que só aceita promessa e lança TypeError para o resto.
vi.mock('@vercel/functions', () => ({
  waitUntil: (p) => {
    if (p === null || typeof p !== 'object' || typeof p.then !== 'function') {
      throw new TypeError(`waitUntil can only be called with a Promise, got ${typeof p}`);
    }
    h.adiados.push(p);
  },
}));
vi.mock('../_mail.js', () => ({ mailStatus: () => h.status, sendMail: async () => {} }));
vi.mock('../_passwordResetFlow.js', () => ({ requestPasswordReset: h.pedido, confirmPasswordReset: h.troca }));
vi.mock('../_passwordResetRepo.js', () => ({
  // Como o de verdade: o secret não é enumerável, então copiar o deps o perde. O
  // teste também pode fazê-lo lançar (h.depsErro).
  realResetDeps: () => {
    if (h.depsErro) throw h.depsErro;
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

// A tela manda o corpo em JSON (postResetAction, em src/lib/passwordReset.js).
// Node entrega os nomes dos cabeçalhos em minúsculas.
const JSON_HEADERS = { 'content-type': 'application/json' };
const post = (body, headers = JSON_HEADERS) => ({ method: 'POST', headers, body });
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

const QUINZE_MINUTOS = 15 * 60 * 1000;
const UM_DIA = 24 * 60 * 60 * 1000;
// O piso da troca, escrito por extenso: se alguém mexer no valor, os testes de
// tempo avisam em vez de acompanhar a mudança.
const PISO = 2500;
const chaves = () => h.chamadas.map((c) => c.chave);

// console.error e console.info, como texto, para procurar o que não pode estar lá.
let log;
let info;
const saidaDe = (spy) => util.inspect(spy.mock.calls, { depth: null });

beforeEach(() => {
  h.limiteOk = true;
  h.limiteErro = null;
  h.recusadas = [];
  h.chamadas = [];
  h.status = 'resend';
  h.ip = '203.0.113.7';
  h.adiados = [];
  h.capturados = [];
  h.sentryTravado = false;
  h.depsErro = null;
  h.pedido.mockReset();
  h.pedido.mockResolvedValue({ sent: true });
  h.troca.mockReset();
  h.troca.mockResolvedValue({ ok: true });
  log = vi.spyOn(console, 'error').mockImplementation(() => {});
  info = vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  log.mockRestore();
  info.mockRestore();
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

  it('realResetDeps que lança cai no mesmo catch: vai ao Sentry e a resposta continua 200', async () => {
    const erro = new Error('deps quebrou');
    h.depsErro = erro;
    const res = resposta();
    await handler(pedirCodigo(), res);
    await h.adiados[0];
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(h.capturados).toEqual([erro]);
    expect(h.pedido).not.toHaveBeenCalled();
  });

  it('o log da falha leva o status, o código do erro e o motivo da rede, e nunca o e-mail', async () => {
    const erro = Object.assign(new Error('O Resend recusou o e-mail (422)'), {
      status: 422, code: 'validation_error', cause: { code: 'ECONNRESET' },
    });
    h.pedido.mockRejectedValue(erro);
    await handler(pedirCodigo(), resposta());
    await h.adiados[0];
    expect(log).toHaveBeenCalledWith('esqueci-a-senha: pedido falhou', {
      erro: 'O Resend recusou o e-mail (422)', status: 422, codigo: 'validation_error', causa: 'ECONNRESET',
    });
    expect(saidaDe(log)).not.toContain('ana@academia.com');
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
    expect(chaves()).toEqual(['pw-reset-request:203.0.113.7']);
    expect(h.pedido).not.toHaveBeenCalled();
  });

  it('limita a 5 pedidos a cada 15 minutos e depois a 20 por dia, por IP', async () => {
    await handler(pedirCodigo(), resposta());
    await h.adiados[0];
    expect(h.chamadas).toEqual([
      { chave: 'pw-reset-request:203.0.113.7', limit: 5, windowMs: QUINZE_MINUTOS },
      { chave: 'pw-reset-request-day:203.0.113.7', limit: 20, windowMs: UM_DIA },
    ]);
  });

  it('429 no limite do dia, com a mesma frase, mesmo com a janela de 15 minutos livre', async () => {
    // Só a janela de 15 minutos deixaria um IP fazer 480 pedidos por dia: ela
    // reinicia 96 vezes em 24 horas.
    h.recusadas = ['pw-reset-request-day:203.0.113.7'];
    const res = resposta();
    await handler(pedirCodigo(), res);
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: TOO_MANY_MESSAGE });
    expect(h.pedido).not.toHaveBeenCalled();
    expect(h.adiados).toEqual([]);
  });

  it('quem estoura os 15 minutos não gasta a cota do dia', async () => {
    h.recusadas = ['pw-reset-request:203.0.113.7'];
    const res = resposta();
    await handler(pedirCodigo(), res);
    expect(res.statusCode).toBe(429);
    expect(chaves()).toEqual(['pw-reset-request:203.0.113.7']);
  });

  it('conta o IPv6 pelo bloco /64 e passa o IP inteiro ao fluxo', async () => {
    h.ip = '2001:db8:1:2:aaaa::1';
    await handler(pedirCodigo(), resposta());
    await h.adiados[0];
    expect(chaves()).toEqual(['pw-reset-request:2001:db8:1:2', 'pw-reset-request-day:2001:db8:1:2']);
    expect(h.pedido).toHaveBeenCalledWith('ana@academia.com', '2001:db8:1:2:aaaa::1', expect.anything());
  });

  it('400 para e-mail fora do formato', async () => {
    const res = resposta();
    await handler(pedirCodigo('sem-arroba'), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: EMAIL_INVALID_MESSAGE });
    expect(h.pedido).not.toHaveBeenCalled();
  });
});

// Toda resposta da troca espera o piso. Os testes usam relógio falso: começam o
// pedido, avançam o tempo e esperam o fim.
describe('POST password-reset-confirm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function trocar(pedido, res = resposta()) {
    const feito = handler(pedido, res);
    await vi.advanceTimersByTimeAsync(PISO);
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
    expect(chaves()).toEqual(['pw-reset-confirm:203.0.113.7']);
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

  it('e-mail sem arroba ou com mais de 254 caracteres dá a frase única sem chamar o fluxo', async () => {
    for (const email of ['a@' + 'x'.repeat(300), 'sem-arroba']) {
      const res = await trocar(trocarSenha({ email }));
      expect(res.statusCode, email.slice(0, 12)).toBe(400);
      expect(res.body, email.slice(0, 12)).toEqual({ error: CODE_REFUSED_MESSAGE });
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

  it('a 429 sai na hora, sem ligar o piso: ela depende só do IP', async () => {
    // Com o piso, cada pedido barrado ocuparia a função 2,5 s em vez de uns 100
    // ms, e isso gasta o tempo de função do plano Hobby.
    h.limiteOk = false;
    const res = resposta();
    const feito = handler(trocarSenha(), res);
    await vi.advanceTimersByTimeAsync(1);
    expect([res.statusCode, res.body]).toEqual([429, { error: TOO_MANY_MESSAGE }]);
    // Nenhum relógio ficou ligado: o piso nem começou.
    expect(vi.getTimerCount()).toBe(0);
    await feito;
    expect(h.troca).not.toHaveBeenCalled();
    // A troca barrada não entra no log de quanto o trabalho levou.
    expect(info).not.toHaveBeenCalled();
  });

  it('limita a 10 trocas a cada 15 minutos por IP', async () => {
    await trocar(trocarSenha());
    expect(h.chamadas).toEqual([{ chave: 'pw-reset-confirm:203.0.113.7', limit: 10, windowMs: QUINZE_MINUTOS }]);
  });

  it('conta o IPv6 pelo bloco /64 e passa o IP inteiro ao fluxo', async () => {
    h.ip = '2001:db8:1:2:aaaa::1';
    await trocar(trocarSenha());
    expect(chaves()).toEqual(['pw-reset-confirm:2001:db8:1:2']);
    expect(h.troca).toHaveBeenCalledWith(expect.objectContaining({ ip: '2001:db8:1:2:aaaa::1' }), expect.anything());
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
      expect(info).toHaveBeenCalledWith('esqueci-a-senha: troca respondida', { status: 500, ms: 0 });
    });

    it('responde sem esperar o Sentry', async () => {
      h.sentryTravado = true;
      h.troca.mockRejectedValue(new Error('Firebase fora do ar'));
      const res = await trocar(trocarSenha());
      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: SAVE_FAILED_MESSAGE });
      expect(h.adiados).toHaveLength(1);
    });

    it('realResetDeps que lança dá 500 com a frase e vai para o Sentry', async () => {
      const erro = new Error('deps quebrou');
      h.depsErro = erro;
      const res = await trocar(trocarSenha());
      expect([res.statusCode, res.body]).toEqual([500, { error: SAVE_FAILED_MESSAGE }]);
      expect(h.capturados).toEqual([erro]);
      expect(h.troca).not.toHaveBeenCalled();
    });

    it('erro fora do fluxo (o limitador lança) ainda respeita o piso e responde 500 com a frase', async () => {
      const erro = new Error('Firestore fora do ar');
      h.limiteErro = erro;
      const res = resposta();
      const feito = handler(trocarSenha(), res);
      await vi.advanceTimersByTimeAsync(PISO - 1);
      expect(res.statusCode).toBe(0);
      await vi.advanceTimersByTimeAsync(1);
      await feito;
      expect([res.statusCode, res.body]).toEqual([500, { error: SAVE_FAILED_MESSAGE }]);
      expect(h.capturados).toEqual([erro]);
      expect(h.adiados).toHaveLength(1);
      expect(h.troca).not.toHaveBeenCalled();
    });

    it('o log leva o status, o código do erro e o motivo da rede, e nunca e-mail, código nem senha', async () => {
      const erro = Object.assign(new Error('Firebase fora do ar'), {
        status: 503, code: 'auth/internal-error', cause: { code: 'ETIMEDOUT' },
      });
      h.troca.mockRejectedValue(erro);
      await trocar(trocarSenha());
      expect(log).toHaveBeenCalledWith('esqueci-a-senha: troca falhou', {
        erro: 'Firebase fora do ar', status: 503, codigo: 'auth/internal-error', causa: 'ETIMEDOUT',
      });
      const saida = saidaDe(log);
      for (const segredo of ['ana@academia.com', '123456', 'Nova@Senha1']) {
        expect(saida).not.toContain(segredo);
      }
    });
  });

  describe('tempo mínimo', () => {
    it('vale 2500 ms', () => {
      expect(CONFIRM_MIN_MS).toBe(PISO);
    });

    // Cada caso: como preparar, o pedido e o status esperado. A 429 e o 415 ficam
    // de fora: dependem só do IP e do pedido, e saem na hora.
    const casos = [
      ['200 quando troca', () => {}, () => trocarSenha(), 200],
      ['400 de código recusado', () => h.troca.mockResolvedValue({ ok: false, reason: 'wrong_code' }), () => trocarSenha(), 400],
      ['400 de senha recusada pelo Firebase', () => h.troca.mockResolvedValue({ ok: false, reason: 'password_rejected' }), () => trocarSenha(), 400],
      ['400 de senha fora da regra', () => {}, () => trocarSenha({ newPassword: 'fraca' }), 400],
      ['400 de código que não é texto', () => {}, () => trocarSenha({ code: 123456 }), 400],
      ['400 de e-mail comprido demais', () => {}, () => trocarSenha({ email: 'a@' + 'x'.repeat(300) }), 400],
      ['500 de erro inesperado', () => h.troca.mockRejectedValue(new Error('Firebase fora do ar')), () => trocarSenha(), 500],
      ['500 do limitador que lança', () => { h.limiteErro = new Error('Firestore fora do ar'); }, () => trocarSenha(), 500],
    ];

    it.each(casos)('%s só sai aos 2500 ms', async (_nome, preparar, pedido, esperado) => {
      preparar();
      const res = resposta();
      const feito = handler(pedido(), res);
      await vi.advanceTimersByTimeAsync(PISO - 1);
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

      await vi.advanceTimersByTimeAsync(PISO - 1);
      expect(h.troca).toHaveBeenCalledTimes(2);
      expect(semConta.statusCode).toBe(0);
      expect(comConta.statusCode).toBe(0);

      await vi.advanceTimersByTimeAsync(1);
      await Promise.all([a, b]);
      expect([semConta.statusCode, semConta.body]).toEqual([comConta.statusCode, comConta.body]);
      expect(comConta.statusCode).toBe(400);
    });

    it('o piso não soma ao trabalho: quem demora mais responde quando o trabalho termina', async () => {
      const trabalho = PISO + 500;
      h.troca.mockImplementation(() => new Promise((r) => setTimeout(() => r({ ok: true }), trabalho)));
      const res = resposta();
      const feito = handler(trocarSenha(), res);
      await vi.advanceTimersByTimeAsync(trabalho - 1);
      expect(res.statusCode).toBe(0);
      await vi.advanceTimersByTimeAsync(1);
      await feito;
      expect(res.statusCode).toBe(200);
      // O log mostra o trabalho inteiro, sem o corte do piso: é assim que se vê um piso curto.
      expect(info).toHaveBeenCalledWith('esqueci-a-senha: troca respondida', { status: 200, ms: trabalho });
    });

    it('registra quanto o trabalho levou, medido antes do piso, sem e-mail nem código', async () => {
      h.troca.mockImplementation(() => new Promise((r) => setTimeout(() => r({ ok: false, reason: 'wrong_code' }), 600)));
      await trocar(trocarSenha());
      expect(info).toHaveBeenCalledTimes(1);
      expect(info).toHaveBeenCalledWith('esqueci-a-senha: troca respondida', { status: 400, ms: 600 });
      const saida = saidaDe(info);
      for (const segredo of ['ana@academia.com', '123456', 'Nova@Senha1']) {
        expect(saida).not.toContain(segredo);
      }
    });
  });
});

// O parser da Vercel transforma application/x-www-form-urlencoded em objeto, e
// um <form method="post"> de outro site não passa por preflight. Sem esta trava,
// a página de um atacante pediria códigos com o IP de cada visitante.
describe('corpo que não vem em JSON', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const pedidoEm = (headers) => post({ action: 'password-reset-request', email: 'ana@academia.com' }, headers);
  const trocaEm = (headers) => post({
    action: 'password-reset-confirm', email: 'ana@academia.com', code: '123456', newPassword: 'Nova@Senha1',
  }, headers);

  // Cada caso: o nome e os cabeçalhos do pedido.
  const recusados = [
    ['formulário', { 'content-type': 'application/x-www-form-urlencoded' }],
    ['multipart', { 'content-type': 'multipart/form-data; boundary=----x' }],
    ['texto', { 'content-type': 'text/plain;charset=UTF-8' }],
    ['tipo que só começa parecido', { 'content-type': 'application/jsonp' }],
    ['sem content-type', {}],
  ];

  it.each(recusados)('pedido em %s dá 415 antes do limitador, sem trabalho', async (_nome, headers) => {
    const res = resposta();
    await handler(pedidoEm(headers), res);
    expect([res.statusCode, res.body]).toEqual([415, { error: SEND_FAILED_MESSAGE }]);
    expect(h.chamadas).toEqual([]);
    expect(h.adiados).toEqual([]);
    expect(h.pedido).not.toHaveBeenCalled();
  });

  it.each(recusados)('troca em %s dá 415 na hora, antes do limitador e sem o piso', async (_nome, headers) => {
    const res = resposta();
    const feito = handler(trocaEm(headers), res);
    await vi.advanceTimersByTimeAsync(1);
    expect([res.statusCode, res.body]).toEqual([415, { error: SAVE_FAILED_MESSAGE }]);
    expect(vi.getTimerCount()).toBe(0);
    await feito;
    expect(h.chamadas).toEqual([]);
    expect(h.troca).not.toHaveBeenCalled();
  });

  it.each([
    'application/json',
    'application/json; charset=utf-8',
    'Application/JSON',
    'APPLICATION/JSON;CHARSET=UTF-8',
  ])('aceita %s nas duas ações', async (tipo) => {
    const pedido = resposta();
    await handler(pedidoEm({ 'content-type': tipo }), pedido);
    await h.adiados[0];
    expect(pedido.statusCode).toBe(200);

    const troca = resposta();
    const feito = handler(trocaEm({ 'content-type': tipo }), troca);
    await vi.advanceTimersByTimeAsync(PISO);
    await feito;
    expect(troca.statusCode).toBe(200);
  });
});

describe('rateKeyIp', () => {
  it('IPv4 fica como veio', () => {
    expect(rateKeyIp('203.0.113.7')).toBe('203.0.113.7');
  });

  it('IPv4 mapeado no IPv6 vale o IPv4', () => {
    expect(rateKeyIp('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(rateKeyIp('::FFFF:203.0.113.7')).toBe('203.0.113.7');
  });

  it('ignora espaço nas pontas, inclusive no IPv4 mapeado', () => {
    expect(rateKeyIp(' 203.0.113.7 ')).toBe('203.0.113.7');
    expect(rateKeyIp(' ::ffff:203.0.113.7')).toBe('203.0.113.7');
  });

  it('IPv6 vira o bloco /64: endereços do mesmo bloco dão a mesma chave', () => {
    expect(rateKeyIp('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2');
    expect(rateKeyIp('2001:db8:1:2:bbbb::2')).toBe(rateKeyIp('2001:db8:1:2:aaaa::1'));
  });

  it('bloco diferente dá chave diferente', () => {
    expect(rateKeyIp('2001:db8:1:3:aaaa::1')).not.toBe(rateKeyIp('2001:db8:1:2:aaaa::1'));
  });

  it('expande o :: até as quatro primeiras partes', () => {
    expect(rateKeyIp('2001:db8::1')).toBe('2001:db8:0:0');
    expect(rateKeyIp('::1')).toBe('0:0:0:0');
    // O :: vale exatamente as partes que faltam para 8: aqui 1 zero, e 3 no de baixo.
    expect(rateKeyIp('1::2:3:4:5:6:7')).toBe('1:0:2:3');
    expect(rateKeyIp('2001::a:b:c:d')).toBe('2001:0:0:0');
  });

  it('escreve o bloco sempre do mesmo jeito: minúsculas e sem zero à esquerda', () => {
    expect(rateKeyIp('2001:0DB8:0001:0002::1')).toBe('2001:db8:1:2');
    expect(rateKeyIp('2001:db8:1:2:3:4:5:6')).toBe('2001:db8:1:2');
  });

  it('o que não é endereço fica como veio', () => {
    expect(rateKeyIp('')).toBe('');
    expect(rateKeyIp(undefined)).toBe('');
    expect(rateKeyIp('desconhecido')).toBe('desconhecido');
    expect(rateKeyIp('A:B:C')).toBe('A:B:C');
    expect(rateKeyIp('zzzz:1:2:3:4:5:6:7')).toBe('zzzz:1:2:3:4:5:6:7');
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
    expect(chaves()).toEqual(['referral-info:203.0.113.7', 'referral-signup:203.0.113.7', 'referral-signup:slug:academia-teste']);
  });

  it('a indicação e a ação desconhecida não olham o content-type', async () => {
    const formulario = { 'content-type': 'application/x-www-form-urlencoded' };
    const desconhecida = resposta();
    await handler(post({ action: 'outra-coisa' }, formulario), desconhecida);
    expect(desconhecida.statusCode).toBe(405);

    h.limiteOk = false;
    for (const action of ['referral-info', 'referral-signup']) {
      const res = resposta();
      await handler(post({ action, slug: 'academia-teste' }, formulario), res);
      expect(res.statusCode, action).toBe(429);
    }
  });
});

describe('vercel.json', () => {
  it('dá ao tenant-resolve tempo para o pedido inteiro, envio de até 8 s incluso', () => {
    const config = JSON.parse(fs.readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
    expect(config.functions['api/tenant-resolve.js'].maxDuration).toBeGreaterThanOrEqual(30);
  });
});
