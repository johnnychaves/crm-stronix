import { FirebaseAuthError } from 'firebase-admin/auth';

// Resposta do Firebase ao createUser com a senha "dorinhavianna", copiada do
// log da Vercel de 2026-09-25. O SDK monta o erro com fromServerError, igual
// aqui, e o código sai auth/internal-error: ele não conhece esse erro.
export const RECUSA_DA_POLITICA = {
  error: {
    code: 400,
    message: 'PASSWORD_DOES_NOT_MEET_REQUIREMENTS : Missing password requirements: [Password must contain an upper case character, Password must contain a numeric character, Password must contain a non-alphanumeric character]',
    errors: [{
      message: 'PASSWORD_DOES_NOT_MEET_REQUIREMENTS : Missing password requirements: [Password must contain an upper case character, Password must contain a numeric character, Password must contain a non-alphanumeric character]',
      domain: 'global',
      reason: 'invalid',
    }],
  },
};

export const recusaDaPolitica = () =>
  FirebaseAuthError.fromServerError(RECUSA_DA_POLITICA.error.message, undefined, RECUSA_DA_POLITICA);
