import { describe, it, expect } from 'vitest';
import { requestPasswordReset, confirmPasswordReset } from '../_passwordResetFlow.js';
import { planIssue, planReserve, planKill, hashResetCode } from '../_passwordReset.js';
import { RESET_CODE_TTL_MS, RESET_WINDOW_MS } from '../../src/lib/passwordReset.js';
import { recusaDaPolitica } from './_recusaDaPolitica.js';

const SEGREDO = 'segredo-de-teste';
const EMAIL = 'ana@academia.com';
const SENHA = 'Nova@Senha1';
const IP = '203.0.113.7';

const conta = (extra = {}) => ({
  uid: 'u-ana', tenantId: 'academia-teste', superAdmin: false, disabled: false,
  isMember: true, organizationActive: true, name: 'Ana Souza',
  signInMark: 'Sun, 28 Sep 2026 10:00:00 GMT', tokensMark: 'Sun, 28 Sep 2026 09:00:00 GMT',
  ...extra,
});

// Banco, conta, envio, relógio e sorteio falsos. As transações usam os mesmos
// planejadores do repositório de verdade, sobre um Map.
function montar(contaInicial = conta()) {
  const docs = new Map();
  const s = {
    conta: contaInicial, agora: 1_790_000_000_000, sorteios: [123456],
    enviados: [], senhas: [], revogadas: [], auditoria: [], logs: [],
    falharEnvio: false, falharSenha: null,
  };
  const deps = {
    findAccount: async (email) => (email === EMAIL ? s.conta : null),
    issueCode: async (uid, input) => {
      const plano = planIssue(docs.get(uid) ?? null, input);
      if (!plano.ok) return plano;
      docs.set(uid, plano.doc);
      return { ok: true };
    },
    reserveAttempt: async (uid, now) => {
      const atual = docs.get(uid) ?? null;
      const plano = planReserve(atual, now);
      if (!plano.ok) return { ok: false };
      docs.set(uid, { ...atual, ...plano.patch });
      return { ok: true, attempt: plano.attempt, code: plano.code };
    },
    killCode: async (uid, codeHash, now) => {
      const atual = docs.get(uid) ?? null;
      const patch = planKill(atual, codeHash, now);
      if (patch) docs.set(uid, { ...atual, ...patch });
    },
    setPassword: async (uid, senha) => {
      if (s.falharSenha) throw s.falharSenha;
      s.senhas.push({ uid, senha });
    },
    revokeSessions: async (uid) => { s.revogadas.push(uid); },
    audit: async (e) => { s.auditoria.push(e); },
    sendMail: async (msg) => {
      if (s.falharEnvio) throw new Error('Resend fora do ar');
      s.enviados.push(msg);
    },
    now: () => s.agora,
    randomInt: () => s.sorteios.shift() ?? 0,
    secret: SEGREDO,
    log: { info: (...a) => s.logs.push(a), error: (...a) => s.logs.push(a) },
  };
  return { deps, docs, s };
}

const trocar = (deps, code, extra = {}) =>
  confirmPasswordReset({ email: EMAIL, code, newPassword: SENHA, ip: IP, ...extra }, deps);

// A recusa do Resend como o _mail.js a monta: mensagem com o status e o
// status também em err.status.
const erroDoResend = () =>
  Object.assign(new Error('O Resend recusou o e-mail (403): domínio sem verificação'), { status: 403 });

describe('pedido', () => {
  it('cria o código e manda o e-mail com o código sorteado', async () => {
    const { deps, docs, s } = montar();
    expect(await requestPasswordReset('  Ana@Academia.com ', IP, deps)).toEqual({ sent: true });
    expect(s.enviados).toHaveLength(1);
    expect(s.enviados[0].to).toBe(EMAIL);
    expect(s.enviados[0].text).toContain('123456');
    expect(s.enviados[0].text).toContain('Olá, Ana.');
    const doc = docs.get('u-ana');
    expect(doc.codeHash).toBe(hashResetCode(SEGREDO, 'u-ana', '123456'));
    expect(JSON.stringify(doc)).not.toContain('123456');
  });

  it('pedir de novo mata o anterior: só o último vale', async () => {
    const { deps, s } = montar();
    s.sorteios = [111111, 222222];
    await requestPasswordReset(EMAIL, IP, deps);
    await requestPasswordReset(EMAIL, IP, deps);
    expect(await trocar(deps, '111111')).toEqual({ ok: false, reason: 'wrong_code' });
    expect(await trocar(deps, '222222')).toEqual({ ok: true });
  });

  it('não manda nada para quem não pode receber', async () => {
    const casos = [
      [null, 'unknown_email'],
      [conta({ superAdmin: true }), 'superadmin'],
      [conta({ disabled: true }), 'account_disabled'],
      [conta({ tenantId: null }), 'no_tenant'],
      [conta({ isMember: false }), 'not_member'],
      [conta({ organizationActive: false }), 'organization_inactive'],
    ];
    for (const [c, motivo] of casos) {
      const { deps, docs, s } = montar(c);
      expect(await requestPasswordReset(EMAIL, IP, deps), motivo).toEqual({ sent: false, reason: motivo });
      expect(s.enviados, motivo).toEqual([]);
      expect(docs.size, motivo).toBe(0);
    }
  });

  it('e-mail sem conta vai mascarado para o log', async () => {
    const { deps, s } = montar(null);
    await requestPasswordReset(EMAIL, IP, deps);
    expect(JSON.stringify(s.logs)).toContain('an***@academia.com');
    expect(JSON.stringify(s.logs)).not.toContain(EMAIL);
  });

  it('o sexto pedido do dia não manda e-mail, e depois de 24 horas libera', async () => {
    const { deps, s } = montar();
    s.sorteios = [1, 2, 3, 4, 5, 6, 7];
    for (let i = 0; i < 5; i += 1) {
      expect(await requestPasswordReset(EMAIL, IP, deps)).toEqual({ sent: true });
      s.agora += 60_000;
    }
    expect(await requestPasswordReset(EMAIL, IP, deps)).toEqual({ sent: false, reason: 'daily_limit' });
    expect(s.enviados).toHaveLength(5);
    s.agora += RESET_WINDOW_MS;
    expect(await requestPasswordReset(EMAIL, IP, deps)).toEqual({ sent: true });
  });

  it('falha no envio mata o código, continua contando no dia e sobe o erro para o Sentry', async () => {
    const { deps, docs, s } = montar();
    s.falharEnvio = true;
    await expect(requestPasswordReset(EMAIL, IP, deps)).rejects.toThrow('Resend fora do ar');
    expect(docs.get('u-ana').usedAtMs).toBe(s.agora);
    expect(docs.get('u-ana').requestsMs).toHaveLength(1);
  });

  it('o log da falha de envio leva o status do Resend e não leva o código nem o e-mail', async () => {
    const { deps, s } = montar();
    deps.sendMail = async () => { throw erroDoResend(); };
    await expect(requestPasswordReset(EMAIL, IP, deps)).rejects.toMatchObject({ status: 403 });
    const log = JSON.stringify(s.logs);
    expect(log).toContain('"status":403');
    expect(log).toContain('domínio sem verificação');
    expect(log).not.toContain('123456');
    expect(log).not.toContain(EMAIL);
  });

  it('falha no envio e no killCode juntos: sobe o erro do Resend, e o log tem as duas falhas', async () => {
    const { deps, s } = montar();
    const doResend = erroDoResend();
    deps.sendMail = async () => { throw doResend; };
    deps.killCode = async () => { throw new Error('Firestore fora do ar'); };
    // O erro que sobe é o do envio, o mesmo objeto, e não o do killCode.
    await expect(requestPasswordReset(EMAIL, IP, deps)).rejects.toBe(doResend);
    // Primeiro a linha do envio, com o status. Depois a do killCode.
    expect(s.logs).toHaveLength(2);
    expect(JSON.stringify(s.logs[0])).toContain('domínio sem verificação');
    expect(JSON.stringify(s.logs[0])).toContain('"status":403');
    expect(JSON.stringify(s.logs[1])).toContain('Firestore fora do ar');
  });
});

describe('troca', () => {
  it('código certo troca a senha, revoga as sessões, mata o código e grava a auditoria', async () => {
    const { deps, docs, s } = montar();
    await requestPasswordReset(EMAIL, IP, deps);
    expect(await trocar(deps, '123456')).toEqual({ ok: true });
    expect(s.senhas).toEqual([{ uid: 'u-ana', senha: SENHA }]);
    expect(s.revogadas).toEqual(['u-ana']);
    expect(s.auditoria).toEqual([{ uid: 'u-ana', tenantId: 'academia-teste' }]);
    expect(docs.get('u-ana').usedAtMs).toBe(s.agora);
    expect(await trocar(deps, '123456')).toEqual({ ok: false, reason: 'no_live_code' });
  });

  it('a quinta tentativa errada mata o código, e a sexta recusa até o código certo', async () => {
    const { deps, docs, s } = montar();
    await requestPasswordReset(EMAIL, IP, deps);
    for (let i = 1; i <= 4; i += 1) {
      expect(await trocar(deps, '000000')).toEqual({ ok: false, reason: 'wrong_code' });
      expect(docs.get('u-ana').usedAtMs).toBeNull();
    }
    expect(await trocar(deps, '000000')).toEqual({ ok: false, reason: 'wrong_code' });
    expect(docs.get('u-ana').usedAtMs).toBe(s.agora);
    expect(await trocar(deps, '123456')).toEqual({ ok: false, reason: 'no_live_code' });
    expect(s.senhas).toEqual([]);
  });

  it('código vencido é recusado', async () => {
    const { deps, s } = montar();
    await requestPasswordReset(EMAIL, IP, deps);
    s.agora += RESET_CODE_TTL_MS;
    expect(await trocar(deps, '123456')).toEqual({ ok: false, reason: 'no_live_code' });
  });

  it('login com a senha antiga ou sessões revogadas depois do pedido matam o código', async () => {
    for (const mudanca of [{ signInMark: 'Sun, 28 Sep 2026 11:00:00 GMT' }, { tokensMark: 'Sun, 28 Sep 2026 11:00:00 GMT' }]) {
      const { deps, docs, s } = montar();
      await requestPasswordReset(EMAIL, IP, deps);
      s.conta = { ...s.conta, ...mudanca };
      expect(await trocar(deps, '123456')).toEqual({ ok: false, reason: 'account_changed' });
      expect(docs.get('u-ana').usedAtMs).toBe(s.agora);
      expect(s.senhas).toEqual([]);
    }
  });

  it('código com letra ou com 5 números é recusado sem gastar tentativa', async () => {
    const { deps, docs } = montar();
    await requestPasswordReset(EMAIL, IP, deps);
    expect(await trocar(deps, '12345')).toEqual({ ok: false, reason: 'bad_format' });
    expect(await trocar(deps, '12a456')).toEqual({ ok: false, reason: 'bad_format' });
    expect(docs.get('u-ana').attempts).toBe(0);
  });

  it('conta que deixou de poder é recusada sem gastar tentativa', async () => {
    const { deps, docs, s } = montar();
    await requestPasswordReset(EMAIL, IP, deps);
    s.conta = { ...s.conta, organizationActive: false };
    expect(await trocar(deps, '123456')).toEqual({ ok: false, reason: 'organization_inactive' });
    expect(docs.get('u-ana').attempts).toBe(0);
  });

  it('recusa do Firebase à senha devolve password_rejected e deixa o código vivo', async () => {
    const { deps, docs, s } = montar();
    await requestPasswordReset(EMAIL, IP, deps);
    s.falharSenha = recusaDaPolitica();
    expect(await trocar(deps, '123456')).toEqual({ ok: false, reason: 'password_rejected' });
    expect(docs.get('u-ana').usedAtMs).toBeNull();
    s.falharSenha = null;
    expect(await trocar(deps, '123456')).toEqual({ ok: true });
  });

  it('outro erro do Firebase sobe', async () => {
    const { deps, s } = montar();
    await requestPasswordReset(EMAIL, IP, deps);
    s.falharSenha = new Error('Firebase fora do ar');
    await expect(trocar(deps, '123456')).rejects.toThrow('Firebase fora do ar');
  });

  it('falha ao marcar o código depois da troca não desfaz a troca', async () => {
    const { deps, s } = montar();
    await requestPasswordReset(EMAIL, IP, deps);
    deps.killCode = async () => { throw new Error('Firestore fora do ar'); };
    expect(await trocar(deps, '123456')).toEqual({ ok: true });
    expect(s.senhas).toHaveLength(1);
    expect(s.revogadas).toEqual(['u-ana']);
  });

  it('falha ao revogar as sessões depois da troca não desfaz a troca e só vai para o log', async () => {
    const { deps, s } = montar();
    await requestPasswordReset(EMAIL, IP, deps);
    deps.revokeSessions = async () => { throw new Error('Firebase fora do ar'); };
    expect(await trocar(deps, '123456')).toEqual({ ok: true });
    expect(s.senhas).toHaveLength(1);
    expect(s.auditoria).toHaveLength(1);
    expect(JSON.stringify(s.logs)).toContain('Firebase fora do ar');
  });

  it('falha ao gravar a auditoria depois da troca não desfaz a troca e só vai para o log', async () => {
    const { deps, s } = montar();
    await requestPasswordReset(EMAIL, IP, deps);
    deps.audit = async () => { throw new Error('Firestore fora do ar'); };
    expect(await trocar(deps, '123456')).toEqual({ ok: true });
    expect(s.senhas).toHaveLength(1);
    expect(s.revogadas).toEqual(['u-ana']);
    expect(JSON.stringify(s.logs)).toContain('Firestore fora do ar');
  });

  it('a troca normaliza o e-mail como o pedido', async () => {
    const { deps, s } = montar();
    await requestPasswordReset(EMAIL, IP, deps);
    expect(await trocar(deps, '123456', { email: '  ANA@Academia.com ' })).toEqual({ ok: true });
    expect(s.senhas).toEqual([{ uid: 'u-ana', senha: SENHA }]);
  });

  it('o código nunca vai para o log', async () => {
    const { deps, s } = montar();
    await requestPasswordReset(EMAIL, IP, deps);
    await trocar(deps, '000000');
    await trocar(deps, '123456');
    expect(JSON.stringify(s.logs)).not.toContain('123456');
  });
});
