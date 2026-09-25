import { describe, it, expect } from 'vitest';
import { FirebaseAuthError } from 'firebase-admin/auth';
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_SYMBOLS,
  PASSWORD_REJECTED_ERROR,
  passwordPolicyError,
  passwordRejectedByFirebase,
  generateTemporaryPassword,
} from '../passwordPolicy.js';

// A regra do app espelha a política de senha do Firebase Auth do projeto, lida
// em GET identitytoolkit.googleapis.com/v2/passwordPolicy em 2026-09-25. Ela
// vale também para o Admin SDK: foi o createUser do provision-tenant que
// recusou "dorinhavianna" naquele dia. Se a política mudar no console, é aqui
// que os números e a lista mudam junto.

// allowedNonAlphanumericCharacters devolvido pelo Firebase, na ordem dele.
const SIMBOLOS_DO_FIREBASE = [
  '^', '$', '*', '.', '[', ']', '{', '}', '(', ')', '?', '"', '!', '@', '#',
  '%', '&', '/', '\\', ',', '>', '<', "'", ':', ';', '|', '_', '~', '`', '-',
];

describe('passwordPolicy: a regra do Firebase', () => {
  it('pede 8 caracteres ou mais', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });

  it('conta como símbolo exatamente a lista do Firebase', () => {
    expect([...PASSWORD_SYMBOLS].sort()).toEqual([...SIMBOLOS_DO_FIREBASE].sort());
  });

  it('aceita senha com as quatro exigências no tamanho mínimo', () => {
    expect(passwordPolicyError('Abcdef1!')).toBeNull();
    expect(passwordPolicyError('Academia@2026')).toBeNull();
  });

  it('recusa a senha de 2026-09-25 dizendo o que falta', () => {
    expect(passwordPolicyError('dorinhavianna'))
      .toBe('A senha precisa ter letra maiúscula, número e símbolo (como ! @ # $).');
  });

  it('cita uma exigência sozinha', () => {
    expect(passwordPolicyError('ACADEMIA@2026')).toBe('A senha precisa ter letra minúscula.');
    expect(passwordPolicyError('academia@2026')).toBe('A senha precisa ter letra maiúscula.');
    expect(passwordPolicyError('Academia@')).toBe('A senha precisa ter número.');
    expect(passwordPolicyError('Academia2026')).toBe('A senha precisa ter símbolo (como ! @ # $).');
    expect(passwordPolicyError('Ab1!ab1')).toBe('A senha precisa ter 8 caracteres ou mais.');
  });

  it('junta duas exigências com "e"', () => {
    expect(passwordPolicyError('Abcdef1')).toBe('A senha precisa ter 8 caracteres ou mais e símbolo (como ! @ # $).');
  });

  it('senha vazia ou ausente lista tudo', () => {
    const tudo = 'A senha precisa ter 8 caracteres ou mais, letra minúscula, letra maiúscula, número e símbolo (como ! @ # $).';
    expect(passwordPolicyError('')).toBe(tudo);
    expect(passwordPolicyError(undefined)).toBe(tudo);
    expect(passwordPolicyError(null)).toBe(tudo);
  });

  // O Firebase confere letra e número pela faixa ASCII e símbolo pela lista
  // dele. Letra com acento não é maiúscula nem minúscula, e +, = e espaço não
  // são símbolo. Aceitar aqui o que o Firebase recusa é o defeito de 2026-09-25.
  it('letra com acento não conta como letra', () => {
    expect(passwordPolicyError('Ágil@2026')).toBe('A senha precisa ter letra maiúscula.');
    expect(passwordPolicyError('ÁGIL@2026é')).toBe('A senha precisa ter letra minúscula.');
  });

  it('símbolo fora da lista do Firebase não conta', () => {
    expect(passwordPolicyError('Academia+2026')).toBe('A senha precisa ter símbolo (como ! @ # $).');
    expect(passwordPolicyError('Academia=2026')).toBe('A senha precisa ter símbolo (como ! @ # $).');
    expect(passwordPolicyError('Academia 2026')).toBe('A senha precisa ter símbolo (como ! @ # $).');
  });
});

describe('passwordPolicy: recusa do Firebase', () => {
  // Formato que o firebase-admin 13.8 devolve: ele não conhece o erro, então o
  // código sai auth/internal-error e a resposta do servidor vai na mensagem.
  const resposta = {
    error: {
      code: 400,
      message: 'PASSWORD_DOES_NOT_MEET_REQUIREMENTS : Missing password requirements: [Password must contain an upper case character, Password must contain a numeric character, Password must contain a non-alphanumeric character]',
    },
  };

  it('reconhece a recusa do jeito que ela chegou em produção', () => {
    const err = FirebaseAuthError.fromServerError(resposta.error.message, undefined, resposta);
    expect(err.code).toBe('auth/internal-error');
    expect(passwordRejectedByFirebase(err)).toBe(true);
  });

  it('reconhece o código próprio, se uma versão nova do SDK passar a usar', () => {
    const err = { code: 'auth/password-does-not-meet-requirements', message: 'Missing password requirements: [Password must contain a numeric character]' };
    expect(passwordRejectedByFirebase(err)).toBe(true);
  });

  it('não confunde com outros erros', () => {
    expect(passwordRejectedByFirebase({ code: 'auth/email-already-exists', message: 'The email address is already in use by another account.' })).toBe(false);
    expect(passwordRejectedByFirebase(new Error('deadline exceeded'))).toBe(false);
    expect(passwordRejectedByFirebase(null)).toBe(false);
    expect(passwordRejectedByFirebase(undefined)).toBe(false);
  });

  it('a mensagem da recusa diz o que tentar, sem falar em erro interno', () => {
    expect(PASSWORD_REJECTED_ERROR).toMatch(/maiúscula/);
    expect(PASSWORD_REJECTED_ERROR).not.toMatch(/interno|Firebase/i);
  });
});

describe('passwordPolicy: senha temporária', () => {
  // Antes, o botão "Gerar" da equipe criava a senha só com letras e números, e
  // o Firebase recusava todas por falta de símbolo.
  const amostra = Array.from({ length: 500 }, () => generateTemporaryPassword());

  it('toda senha gerada passa na regra', () => {
    expect(amostra.filter((s) => passwordPolicyError(s) !== null)).toEqual([]);
  });

  it('tem 12 caracteres e nenhum que se confunde ao ditar', () => {
    for (const s of amostra) {
      expect(s).toHaveLength(12);
      expect(s).not.toMatch(/[0O1lI]/);
    }
  });

  it('não repete a mesma senha', () => {
    expect(new Set(amostra).size).toBe(amostra.length);
  });
});
