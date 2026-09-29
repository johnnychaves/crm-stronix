import { describe, it, expect, vi } from 'vitest';
import {
  RESET_PATH, RESET_ACTION_REQUEST, RESET_ACTION_CONFIRM, RESET_CODE_TTL_MS, MAX_EMAIL_LENGTH,
  normalizeEmail, isEmailFormat, normalizeResetCode, isResetCodeFormat, resendWaitSeconds,
  isPasswordResetPath, readResetMemory, writeResetMemory, clearResetMemory, readResetApiError,
  resetLinkState, readResetEntry, loginPathFor, readLoginArrival, postResetAction,
} from '../passwordReset.js';

// Um sessionStorage de mentira, para a memória da aba rodar em node.
function armazenamento() {
  const dados = new Map();
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => { dados.set(k, String(v)); },
    removeItem: (k) => { dados.delete(k); },
  };
}

describe('e-mail', () => {
  it('normaliza como o login: sem espaço nas pontas e em minúsculas', () => {
    expect(normalizeEmail('  Ana@Academia.COM ')).toBe('ana@academia.com');
    expect(normalizeEmail(undefined)).toBe('');
  });

  it('aceita texto com @ e até 254 caracteres', () => {
    expect(isEmailFormat('ana@academia.com')).toBe(true);
    expect(isEmailFormat('ana.academia.com')).toBe(false);
    expect(isEmailFormat(`${'a'.repeat(MAX_EMAIL_LENGTH)}@x.com`)).toBe(false);
    expect(isEmailFormat(42)).toBe(false);
  });
});

describe('código', () => {
  it('fica só com os números, até 6', () => {
    expect(normalizeResetCode('123 456')).toBe('123456');
    expect(normalizeResetCode('123-456')).toBe('123456');
    expect(normalizeResetCode('12a3b4')).toBe('1234');
    expect(normalizeResetCode('1234567')).toBe('123456');
    expect(normalizeResetCode(null)).toBe('');
  });

  it('o formato certo é texto com exatamente 6 números', () => {
    expect(isResetCodeFormat('012345')).toBe(true);
    expect(isResetCodeFormat('12345')).toBe(false);
    expect(isResetCodeFormat('12a456')).toBe(false);
    expect(isResetCodeFormat(123456)).toBe(false);
  });
});

describe('resendWaitSeconds', () => {
  it('conta 60 segundos a partir do envio e para no zero', () => {
    expect(resendWaitSeconds(0, 0)).toBe(60);
    expect(resendWaitSeconds(0, 59_001)).toBe(1);
    expect(resendWaitSeconds(0, 60_000)).toBe(0);
    expect(resendWaitSeconds(0, 90_000)).toBe(0);
  });

  it('nunca passa de 60 segundos, mesmo com o envio marcado no futuro', () => {
    // O relógio do aparelho pode ter sido mexido depois do envio.
    expect(resendWaitSeconds(3_600_000, 0)).toBe(60);
    expect(resendWaitSeconds(60_001, 0)).toBe(60);
    expect(resendWaitSeconds(1, 0)).toBe(60);
  });
});

describe('isPasswordResetPath', () => {
  it('reconhece /recuperar-senha, com barra no fim e em maiúsculas', () => {
    expect(isPasswordResetPath(RESET_PATH)).toBe(true);
    expect(isPasswordResetPath('/recuperar-senha/')).toBe(true);
    expect(isPasswordResetPath('/Recuperar-Senha')).toBe(true);
  });

  it('não confunde com outras telas', () => {
    expect(isPasswordResetPath('/')).toBe(false);
    expect(isPasswordResetPath('/academia/recuperar-senha')).toBe(false);
    expect(isPasswordResetPath(undefined)).toBe(false);
  });
});

describe('memória da aba', () => {
  it('guarda o e-mail e a hora do envio, e vence junto com o código', () => {
    const s = armazenamento();
    writeResetMemory({ email: 'ana@academia.com', sentAt: 1000 }, s);
    expect(readResetMemory(1000 + RESET_CODE_TTL_MS - 1, s)).toEqual({ email: 'ana@academia.com', sentAt: 1000 });
    expect(readResetMemory(1000 + RESET_CODE_TTL_MS, s)).toBeNull();
  });

  // Numa recepção com computador dividido, a aba pode passar para outra pessoa: o
  // e-mail de quem pediu o código não pode ficar nela depois de vencido.
  it('a memória vencida sai do storage, e a que ainda vale fica', () => {
    const s = armazenamento();
    writeResetMemory({ email: 'ana@academia.com', sentAt: 1000 }, s);
    expect(readResetMemory(1000 + RESET_CODE_TTL_MS - 1, s)).not.toBeNull();
    expect(s.getItem('stronilead:recuperar-senha')).not.toBeNull();
    expect(readResetMemory(1000 + RESET_CODE_TTL_MS, s)).toBeNull();
    expect(s.getItem('stronilead:recuperar-senha')).toBeNull();
  });

  it('se o storage não deixa apagar a memória vencida, a leitura não quebra', () => {
    const vencida = JSON.stringify({ email: 'ana@academia.com', sentAt: 1000 });
    const teimoso = {
      getItem: () => vencida,
      setItem: () => {},
      removeItem: () => { throw new Error('x'); },
    };
    expect(readResetMemory(1000 + RESET_CODE_TTL_MS, teimoso)).toBeNull();
  });

  it('nunca guarda código nem senha', () => {
    const s = armazenamento();
    writeResetMemory({ email: 'ana@academia.com', sentAt: 1000, code: '123456', password: 'x' }, s);
    expect(s.getItem('stronilead:recuperar-senha')).toBe('{"email":"ana@academia.com","sentAt":1000}');
  });

  it('apaga a memória', () => {
    const s = armazenamento();
    writeResetMemory({ email: 'ana@academia.com', sentAt: 1000 }, s);
    clearResetMemory(s);
    expect(readResetMemory(1000, s)).toBeNull();
  });

  it('não quebra sem sessionStorage, com armazenamento que lança ou com lixo guardado', () => {
    expect(readResetMemory(0, null)).toBeNull();
    const quebrado = {
      getItem: () => { throw new Error('x'); },
      setItem: () => { throw new Error('x'); },
      removeItem: () => { throw new Error('x'); },
    };
    expect(readResetMemory(0, quebrado)).toBeNull();
    expect(() => writeResetMemory({ email: 'a@b.c', sentAt: 0 }, quebrado)).not.toThrow();
    expect(() => clearResetMemory(quebrado)).not.toThrow();
    const lixo = armazenamento();
    lixo.setItem('stronilead:recuperar-senha', '{nao-e-json');
    expect(readResetMemory(0, lixo)).toBeNull();
  });

  it('em node, sem window, lê como vazia', () => {
    expect(readResetMemory()).toBeNull();
  });
});

describe('readResetApiError', () => {
  it('sem resposta, o status é nulo', () => {
    expect(readResetApiError(null, null)).toEqual({ status: null, message: null, passwordIssue: null });
  });

  it('a frase do campo da senha só vem com field newPassword', () => {
    expect(readResetApiError(400, { error: 'A senha precisa ter número.', field: 'newPassword' }))
      .toEqual({ status: 400, message: 'A senha precisa ter número.', passwordIssue: 'A senha precisa ter número.' });
    expect(readResetApiError(400, { error: 'Código errado ou vencido.' }))
      .toEqual({ status: 400, message: 'Código errado ou vencido.', passwordIssue: null });
    expect(readResetApiError(500, null)).toEqual({ status: 500, message: null, passwordIssue: null });
  });

  it('o 415 (corpo que não veio em JSON) passa como falha comum, sem frase de campo', () => {
    expect(readResetApiError(415, { error: 'Não deu para enviar agora. Tente de novo.' }))
      .toEqual({ status: 415, message: 'Não deu para enviar agora. Tente de novo.', passwordIssue: null });
  });
});

describe('ida e volta entre o login e a tela', () => {
  it('o login manda o e-mail e a academia, e o nome só quando já achou a academia', () => {
    expect(resetLinkState(' ana@academia.com ', { slug: 'academia-teste', found: true, displayName: 'Academia Teste' }))
      .toEqual({ email: 'ana@academia.com', tenant: { slug: 'academia-teste', displayName: 'Academia Teste' } });
    expect(resetLinkState('', { slug: 'academia-teste', loading: true }))
      .toEqual({ email: '', tenant: { slug: 'academia-teste', displayName: null } });
    expect(resetLinkState('', { slug: 'nao-existe', found: false })).toEqual({ email: '', tenant: null });
    expect(resetLinkState('', null)).toEqual({ email: '', tenant: null });
  });

  it('a tela lê o estado da navegação sem confiar no formato', () => {
    expect(readResetEntry({ email: 'ana@academia.com', tenant: { slug: 'academia-teste', displayName: 'Academia Teste' } }))
      .toEqual({ email: 'ana@academia.com', tenant: { slug: 'academia-teste', displayName: 'Academia Teste' } });
    expect(readResetEntry(null)).toEqual({ email: '', tenant: null });
    expect(readResetEntry({ email: 7, tenant: { slug: 3 } })).toEqual({ email: '', tenant: null });
  });

  it('a volta cai no login da academia, ou no login geral sem academia', () => {
    expect(loginPathFor({ slug: 'academia-teste' })).toBe('/academia-teste');
    expect(loginPathFor(null)).toBe('/');
  });

  it('o login só mostra o aviso quando chega da troca de senha', () => {
    expect(readLoginArrival({ email: 'ana@academia.com', passwordReset: true }))
      .toEqual({ passwordReset: true, email: 'ana@academia.com' });
    expect(readLoginArrival({ email: 'ana@academia.com' })).toEqual({ passwordReset: false, email: '' });
    expect(readLoginArrival(null)).toEqual({ passwordReset: false, email: '' });
  });
});

describe('postResetAction', () => {
  it('manda JSON para o tenant-resolve e devolve o status e o corpo', async () => {
    const f = vi.fn(async () => ({ status: 200, json: async () => ({ ok: true }) }));
    const r = await postResetAction({ action: RESET_ACTION_REQUEST, email: 'ana@academia.com' }, f);
    expect(r).toEqual({ status: 200, body: { ok: true } });
    expect(f).toHaveBeenCalledWith('/api/tenant-resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: RESET_ACTION_REQUEST, email: 'ana@academia.com' }),
    });
  });

  it('corpo sem JSON vira nulo, e rede fora vira status nulo', async () => {
    expect(await postResetAction({ action: RESET_ACTION_CONFIRM }, async () => ({ status: 502, json: async () => { throw new Error('html'); } })))
      .toEqual({ status: 502, body: null });
    expect(await postResetAction({ action: RESET_ACTION_CONFIRM }, async () => { throw new Error('offline'); }))
      .toEqual({ status: null, body: null });
  });

  it('sem fetch injetado, usa o fetch global na hora da chamada', async () => {
    const mockFetch = vi.fn(async () => ({ status: 200, json: async () => ({ ok: true }) }));
    vi.stubGlobal('fetch', mockFetch);
    const r = await postResetAction({ action: RESET_ACTION_REQUEST, email: 'ana@academia.com' });
    expect(r).toEqual({ status: 200, body: { ok: true } });
    expect(mockFetch).toHaveBeenCalledWith('/api/tenant-resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: RESET_ACTION_REQUEST, email: 'ana@academia.com' }),
    });
    vi.unstubAllGlobals();
  });
});
