import crypto from 'node:crypto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  generateResetCode, hashResetCode, resetCodeMatches, accountRefusal, maskEmail,
  planIssue, planReserve, planKill, marksChanged,
} from '../_passwordReset.js';
import { RESET_CODE_TTL_MS, RESET_WINDOW_MS } from '../../src/lib/passwordReset.js';

const SEGREDO = 'segredo-de-teste';
const AGORA = 1_790_000_000_000;

afterEach(() => vi.restoreAllMocks());

const conta = (extra = {}) => ({
  uid: 'u-ana', tenantId: 'academia-teste', superAdmin: false, disabled: false,
  isMember: true, organizationActive: true, ...extra,
});

describe('generateResetCode', () => {
  it('sempre 6 números, com zero à esquerda', () => {
    expect(generateResetCode(() => 42)).toBe('000042');
    expect(generateResetCode(() => 999_999)).toBe('999999');
    for (let i = 0; i < 50; i += 1) expect(generateResetCode()).toMatch(/^\d{6}$/);
  });

  it('sorteia entre 1 milhão de combinações', () => {
    let pedido = null;
    generateResetCode((max) => { pedido = max; return 0; });
    expect(pedido).toBe(1_000_000);
  });

  it('o sorteio padrão é o crypto.randomInt de 0 até 1 milhão', () => {
    const spy = vi.spyOn(crypto, 'randomInt').mockReturnValue(7);
    expect(generateResetCode()).toBe('000007');
    expect(spy).toHaveBeenCalledWith(0, 1_000_000);
  });
});

describe('impressão do código', () => {
  const hash = hashResetCode(SEGREDO, 'u-ana', '123456');

  it('é HMAC em hex e não contém o código', () => {
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('123456');
  });

  it('valor conhecido: chave = HMAC(segredo, rótulo), impressão = HMAC(chave, "uid:código")', () => {
    const chave = crypto.createHmac('sha256', SEGREDO).update('stronilead:password-reset-code').digest();
    const esperado = crypto.createHmac('sha256', chave).update('u-ana:123456').digest('hex');
    expect(hash).toBe(esperado);
  });

  it('sem segredo lança erro, em vez de gerar impressão com chave vazia', () => {
    expect(() => hashResetCode(undefined, 'u-ana', '123456')).toThrow('falta o segredo');
    expect(() => hashResetCode('', 'u-ana', '123456')).toThrow('falta o segredo');
  });

  it('confere o código certo e recusa o errado', () => {
    expect(resetCodeMatches(SEGREDO, 'u-ana', '123456', hash)).toBe(true);
    expect(resetCodeMatches(SEGREDO, 'u-ana', '123457', hash)).toBe(false);
  });

  it('o mesmo código de outra conta ou com outro segredo não confere', () => {
    expect(resetCodeMatches(SEGREDO, 'u-bia', '123456', hash)).toBe(false);
    expect(resetCodeMatches('outro-segredo', 'u-ana', '123456', hash)).toBe(false);
  });

  it('impressão de outro formato nunca confere', () => {
    expect(resetCodeMatches(SEGREDO, 'u-ana', '123456', 'abc')).toBe(false);
    expect(resetCodeMatches(SEGREDO, 'u-ana', '123456', null)).toBe(false);
    // O Buffer.from(..., 'hex') para no primeiro par inválido e aceitaria lixo
    // no fim, e também aceitaria maiúsculas. A impressão gravada é só 64 hex em minúsculas.
    expect(resetCodeMatches(SEGREDO, 'u-ana', '123456', `${hash}zz`)).toBe(false);
    expect(resetCodeMatches(SEGREDO, 'u-ana', '123456', hash.toUpperCase())).toBe(false);
  });

  it('código fora do formato nunca confere, nem com a impressão dele guardada', () => {
    const hashDoCurto = hashResetCode(SEGREDO, 'u-ana', '12345');
    expect(resetCodeMatches(SEGREDO, 'u-ana', '12345', hashDoCurto)).toBe(false);
  });
});

describe('accountRefusal', () => {
  it('libera quem passaria no login', () => {
    expect(accountRefusal(conta())).toBeNull();
  });

  it('diz o motivo de cada recusa', () => {
    expect(accountRefusal(null)).toBe('unknown_email');
    expect(accountRefusal(conta({ superAdmin: true }))).toBe('superadmin');
    expect(accountRefusal(conta({ disabled: true }))).toBe('account_disabled');
    expect(accountRefusal(conta({ tenantId: null }))).toBe('no_tenant');
    expect(accountRefusal(conta({ isMember: false }))).toBe('not_member');
    expect(accountRefusal(conta({ organizationActive: false }))).toBe('organization_inactive');
  });
});

describe('maskEmail', () => {
  it('mostra só o começo e o domínio', () => {
    expect(maskEmail('ana@academia.com')).toBe('an***@academia.com');
    expect(maskEmail('a@x.com')).toBe('a***@x.com');
    expect(maskEmail('')).toBe('***');
    expect(maskEmail('sem-arroba')).toBe('***');
  });
});

describe('planIssue', () => {
  const entrada = { now: AGORA, codeHash: 'h1', tenantId: 'academia-teste', signInMark: 's1', tokensMark: 't1' };

  it('o primeiro pedido cria o código com a validade, as marcas e a hora do pedido', () => {
    expect(planIssue(null, entrada)).toEqual({
      ok: true,
      doc: {
        tenantId: 'academia-teste', codeHash: 'h1', expiresAtMs: AGORA + RESET_CODE_TTL_MS,
        attempts: 0, usedAtMs: null, signInMark: 's1', tokensMark: 't1', requestsMs: [AGORA],
      },
    });
  });

  it('o pedido novo escreve por cima do anterior e esquece os pedidos de mais de 24 horas', () => {
    const atual = { codeHash: 'h0', attempts: 3, usedAtMs: null, requestsMs: [AGORA - RESET_WINDOW_MS, AGORA - 1000] };
    const plano = planIssue(atual, entrada);
    expect(plano.ok).toBe(true);
    expect(plano.doc.codeHash).toBe('h1');
    expect(plano.doc.attempts).toBe(0);
    expect(plano.doc.requestsMs).toEqual([AGORA - 1000, AGORA]);
  });

  it('com 5 pedidos nas últimas 24 horas, recusa', () => {
    const atual = { requestsMs: [1, 2, 3, 4, 5].map((i) => AGORA - i * 1000) };
    expect(planIssue(atual, entrada)).toEqual({ ok: false, reason: 'daily_limit' });
  });

  it('com 4 pedidos nas últimas 24 horas, aceita e fica com 5', () => {
    const atual = { requestsMs: [1, 2, 3, 4].map((i) => AGORA - i * 1000) };
    const plano = planIssue(atual, entrada);
    expect(plano.ok).toBe(true);
    expect(plano.doc.requestsMs).toEqual([...atual.requestsMs, AGORA]);
  });

  it('relógio que não é um número lança erro, em vez de gravar validade inválida', () => {
    expect(() => planIssue(null, { ...entrada, now: NaN })).toThrow('relógio inválido');
    expect(() => planIssue(null, { ...entrada, now: undefined })).toThrow('relógio inválido');
  });
});

describe('planReserve', () => {
  const vivo = { codeHash: 'h1', expiresAtMs: AGORA + 1000, attempts: 2, usedAtMs: null, signInMark: 's1', tokensMark: 't1' };

  it('reserva a próxima tentativa e devolve o que a conferência precisa', () => {
    expect(planReserve(vivo, AGORA)).toEqual({
      ok: true, attempt: 3, patch: { attempts: 3 },
      code: { codeHash: 'h1', signInMark: 's1', tokensMark: 't1' },
    });
  });

  it('recusa sem documento e com código usado, vencido, sem impressão ou com 5 tentativas', () => {
    expect(planReserve(null, AGORA)).toEqual({ ok: false });
    expect(planReserve({ ...vivo, usedAtMs: AGORA - 1 }, AGORA)).toEqual({ ok: false });
    expect(planReserve({ ...vivo, expiresAtMs: AGORA }, AGORA)).toEqual({ ok: false });
    expect(planReserve({ ...vivo, codeHash: null }, AGORA)).toEqual({ ok: false });
    expect(planReserve({ ...vivo, attempts: 5 }, AGORA)).toEqual({ ok: false });
  });

  it('a quinta tentativa ainda é reservada', () => {
    expect(planReserve({ ...vivo, attempts: 4 }, AGORA)).toMatchObject({ ok: true, attempt: 5, patch: { attempts: 5 } });
  });

  it('relógio que não é um número lança erro, em vez de deixar passar código vencido', () => {
    const vencido = { ...vivo, expiresAtMs: AGORA - 1 };
    expect(() => planReserve(vencido, NaN)).toThrow('relógio inválido');
    expect(() => planReserve(vivo, undefined)).toThrow('relógio inválido');
  });

  it('contador que não é inteiro conta como esgotado, nunca como zero', () => {
    for (const attempts of ['x', NaN, 2.5, null, undefined]) {
      expect(planReserve({ ...vivo, attempts }, AGORA), String(attempts)).toEqual({ ok: false });
    }
  });
});

describe('planKill', () => {
  it('mata só se o documento ainda tiver aquele código vivo', () => {
    expect(planKill({ codeHash: 'h1', usedAtMs: null }, 'h1', AGORA)).toEqual({ usedAtMs: AGORA });
    expect(planKill({ codeHash: 'h2', usedAtMs: null }, 'h1', AGORA)).toBeNull();
    expect(planKill({ codeHash: 'h1', usedAtMs: 5 }, 'h1', AGORA)).toBeNull();
    expect(planKill(null, 'h1', AGORA)).toBeNull();
  });

  it('sem impressão em texto, não mata nada', () => {
    expect(planKill({}, undefined, AGORA)).toBeNull();
    expect(planKill({ codeHash: null, usedAtMs: null }, null, AGORA)).toBeNull();
  });
});

describe('marksChanged', () => {
  it('compara as duas marcas guardadas com as da conta', () => {
    const guardado = { signInMark: 's1', tokensMark: 't1' };
    expect(marksChanged(guardado, { signInMark: 's1', tokensMark: 't1' })).toBe(false);
    expect(marksChanged(guardado, { signInMark: 's2', tokensMark: 't1' })).toBe(true);
    expect(marksChanged(guardado, { signInMark: 's1', tokensMark: 't2' })).toBe(true);
    expect(marksChanged({ signInMark: null, tokensMark: null }, { signInMark: undefined, tokensMark: null })).toBe(false);
  });
});
