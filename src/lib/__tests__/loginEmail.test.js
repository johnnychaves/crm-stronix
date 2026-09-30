import { describe, it, expect } from 'vitest';
import * as regra from '../loginEmail.js';
import {
  SET_EMAIL_ACTION,
  LOGIN_EMAIL_INVALID_MESSAGE,
  LOGIN_EMAIL_TAKEN_MESSAGE,
  normalizeLoginEmail,
  loginEmailError,
  planLoginEmailChange,
  loginEmailConfirmText,
} from '../loginEmail.js';

// O e-mail de login de quem está na equipe. A tela de Equipe & acessos decide
// com estas funções o que o Salvar faz com o campo, e a ação set-email do
// api/admin-users.js confere o formato com a mesma regra.

describe('normalizeLoginEmail', () => {
  it('tira o espaço das pontas e passa para minúsculas, como o login', () => {
    expect(normalizeLoginEmail('  Ana@Gmail.COM ')).toBe('ana@gmail.com');
  });

  it('vazio, nulo ou ausente vira texto vazio', () => {
    expect(normalizeLoginEmail('')).toBe('');
    expect(normalizeLoginEmail(null)).toBe('');
    expect(normalizeLoginEmail(undefined)).toBe('');
  });
});

describe('loginEmailError', () => {
  it('aceita e-mail com usuário, arroba e domínio com ponto', () => {
    expect(loginEmailError('ana@gmail.com')).toBeNull();
    expect(loginEmailError('  Ana.Duarte+crm@academia.com.br ')).toBeNull();
  });

  it.each([
    ['vazio', ''],
    ['sem arroba', 'ana.gmail.com'],
    ['sem usuário', '@gmail.com'],
    ['sem domínio', 'ana@'],
    ['domínio sem ponto', 'ana@gmail'],
    ['espaço no meio', 'ana @gmail.com'],
    ['duas arrobas', 'ana@@gmail.com'],
  ])('recusa %s', (_caso, email) => {
    expect(loginEmailError(email)).toBe(LOGIN_EMAIL_INVALID_MESSAGE);
  });

  it('recusa acima de 254 caracteres, o teto de um endereço de e-mail', () => {
    const noTeto = `${'a'.repeat(254 - '@academia.com'.length)}@academia.com`;
    expect(noTeto).toHaveLength(254);
    expect(loginEmailError(noTeto)).toBeNull();
    expect(loginEmailError(`a${noTeto}`)).toBe(LOGIN_EMAIL_INVALID_MESSAGE);
  });
});

describe('planLoginEmailChange: o que o Salvar faz com o e-mail', () => {
  const ana = { id: 'doc-ana', authUid: 'uid-ana', name: 'Ana', email: 'ana@gmial.com' };

  it('e-mail igual ao do cadastro não faz nada, mesmo com maiúscula e espaço', () => {
    expect(planLoginEmailChange(ana, ' ANA@gmial.com ')).toEqual({ kind: 'none' });
  });

  it('quem tem conta troca pelo servidor, com o e-mail normalizado', () => {
    expect(planLoginEmailChange(ana, ' Ana@Gmail.com ')).toEqual({
      kind: 'account',
      email: 'ana@gmail.com',
      body: { action: 'set-email', targetAuthUid: 'uid-ana', email: 'ana@gmail.com' },
    });
  });

  it('e-mail em formato ruim para tudo, e nada vai para a API', () => {
    expect(planLoginEmailChange(ana, 'ana@gmail')).toEqual({ kind: 'invalid', error: LOGIN_EMAIL_INVALID_MESSAGE });
    expect(planLoginEmailChange(ana, '')).toEqual({ kind: 'invalid', error: LOGIN_EMAIL_INVALID_MESSAGE });
  });

  it('cadastro sem conta só troca o cadastro, pelo cliente', () => {
    for (const authUid of [undefined, null, '', '   ']) {
      expect(planLoginEmailChange({ ...ana, authUid }, 'ana@gmail.com')).toEqual({ kind: 'record', email: 'ana@gmail.com' });
    }
  });

  it('o uid vai sem espaço nas pontas, como o selo "Vinculado" da lista o lê', () => {
    expect(planLoginEmailChange({ ...ana, authUid: ' uid-ana ' }, 'ana@gmail.com').body.targetAuthUid).toBe('uid-ana');
  });

  it('cadastro sem e-mail ganha o e-mail digitado', () => {
    expect(planLoginEmailChange({ ...ana, email: undefined }, 'ana@gmail.com').kind).toBe('account');
  });
});

describe('loginEmailConfirmText', () => {
  it('para outra pessoa, diz o nome, o e-mail novo e que as sessões dela caem', () => {
    const texto = loginEmailConfirmText({ name: 'Ana', email: 'ana@gmail.com', self: false });
    expect(texto).toContain('Trocar o e-mail de login de "Ana" para ana@gmail.com?');
    expect(texto).toContain('A pessoa passa a entrar com o e-mail novo, e as sessões abertas dela são encerradas.');
  });

  it('para o próprio gestor, fala com ele e pede para entrar de novo', () => {
    const texto = loginEmailConfirmText({ name: 'Gestor', email: 'gestor@academia.com', self: true });
    expect(texto).toContain('Trocar o seu e-mail de login para gestor@academia.com?');
    expect(texto).toContain('entre de novo');
    expect(texto).not.toContain('Gestor');
  });
});

describe('as frases', () => {
  it('são as combinadas com a tela', () => {
    expect(SET_EMAIL_ACTION).toBe('set-email');
    expect(LOGIN_EMAIL_TAKEN_MESSAGE).toBe('Esse e-mail já é de outra conta.');
  });

  it('não têm travessão', () => {
    const frases = [
      ...Object.values(regra).filter((v) => typeof v === 'string'),
      loginEmailConfirmText({ name: 'Ana', email: 'ana@gmail.com', self: false }),
      loginEmailConfirmText({ name: 'Ana', email: 'ana@gmail.com', self: true }),
    ];
    expect(frases.length).toBeGreaterThan(5);
    for (const frase of frases) expect(frase).not.toMatch(/[\u2013\u2014]/);
  });
});
