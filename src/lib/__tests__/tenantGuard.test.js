import { describe, it, expect } from 'vitest';
import {
  targetVerdict, targetAllowed, targetVerdictError,
  TARGET_OK, TARGET_FOREIGN, TARGET_SUPERADMIN, TARGET_UNCLAIMED, TARGET_NO_ACCOUNT
} from '../tenantGuard.js';

describe('targetVerdict', () => {
  it('libera alvo com o mesmo claim de tenant do admin', () => {
    expect(targetVerdict({ tenantId: 'academia-a' }, 'academia-a')).toBe(TARGET_OK);
  });

  it('barra alvo de outra academia', () => {
    expect(targetVerdict({ tenantId: 'academia-b' }, 'academia-a')).toBe(TARGET_FOREIGN);
  });

  it('barra o super-admin mesmo quando o claim de tenant bate', () => {
    expect(targetVerdict({ superAdmin: true, tenantId: 'academia-a' }, 'academia-a'))
      .toBe(TARGET_SUPERADMIN);
  });

  it('barra super-admin sem tenant', () => {
    expect(targetVerdict({ superAdmin: true }, 'academia-a')).toBe(TARGET_SUPERADMIN);
  });

  it('barra conta sem claim de tenant', () => {
    expect(targetVerdict({}, 'academia-a')).toBe(TARGET_UNCLAIMED);
    expect(targetVerdict(null, 'academia-a')).toBe(TARGET_UNCLAIMED);
    expect(targetVerdict(undefined, 'academia-a')).toBe(TARGET_UNCLAIMED);
  });

  it('barra quando o tenant de quem chama esta vazio', () => {
    expect(targetVerdict({ tenantId: 'academia-a' }, '')).toBe(TARGET_FOREIGN);
    expect(targetVerdict({ tenantId: 'academia-a' }, null)).toBe(TARGET_FOREIGN);
  });

  it('nao aceita superAdmin em valor que apenas parece verdadeiro', () => {
    expect(targetVerdict({ superAdmin: 'sim', tenantId: 'academia-a' }, 'academia-a'))
      .toBe(TARGET_OK);
  });
});

describe('targetAllowed', () => {
  it('so e verdadeiro no veredito ok', () => {
    expect(targetAllowed({ tenantId: 'a' }, 'a')).toBe(true);
    expect(targetAllowed({ tenantId: 'b' }, 'a')).toBe(false);
    expect(targetAllowed({ superAdmin: true, tenantId: 'a' }, 'a')).toBe(false);
    expect(targetAllowed({}, 'a')).toBe(false);
  });
});

describe('targetVerdictError', () => {
  it('nao entrega ao admin em qual academia o alvo esta', () => {
    const foreign = targetVerdictError(TARGET_FOREIGN);
    const unclaimed = targetVerdictError(TARGET_UNCLAIMED);
    expect(foreign.status).toBe(404);
    // Mesma resposta nos dois casos: distinguir "existe, mas e de outra
    // academia" de "nao existe" confirmaria contas fora do tenant de quem chama.
    expect(foreign.error).toBe(unclaimed.error);
    expect(foreign.status).toBe(unclaimed.status);
    expect(foreign.error).not.toMatch(/outr[ao]|academia-[ab]|super/i);
  });

  it('recusa acao sobre o super-admin com 403', () => {
    expect(targetVerdictError(TARGET_SUPERADMIN).status).toBe(403);
  });

  it('devolve null quando o veredito e ok', () => {
    expect(targetVerdictError(TARGET_OK)).toBe(null);
  });

  it('trata conta inexistente como nao encontrada, sem vazar a diferenca', () => {
    const noAccount = targetVerdictError(TARGET_NO_ACCOUNT);
    expect(noAccount.status).toBe(404);
    expect(noAccount.error).toBe(targetVerdictError(TARGET_FOREIGN).error);
  });
});

// O doc de membro pode existir sem conta no Auth (cadastro orfao, conta apagada
// por fora). Esse caso e o unico em que o delete segue e limpa so o cadastro
// interno, entao ele precisa ser distinguivel de "e de outra academia".
describe('TARGET_NO_ACCOUNT', () => {
  it('e um veredito distinto dos demais', () => {
    const todos = [TARGET_OK, TARGET_FOREIGN, TARGET_SUPERADMIN, TARGET_UNCLAIMED];
    expect(todos).not.toContain(TARGET_NO_ACCOUNT);
  });
});
