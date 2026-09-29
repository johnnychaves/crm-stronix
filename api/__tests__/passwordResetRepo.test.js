import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findAccount, issueCode, reserveAttempt, killCode, audit } from '../_passwordResetRepo.js';

const h = vi.hoisted(() => ({ usuarios: {}, tenants: {}, membros: {}, resets: {}, escritas: [], auditoria: [] }));

vi.mock('../_firebaseAdmin.js', () => {
  const ler = (caminho) => {
    if (caminho[0] === 'tenants') return h.tenants[caminho[1]];
    if (caminho[0] === '_password_reset') return h.resets[caminho[1]];
    return undefined;
  };
  const ref = (caminho, filtro = null) => ({
    caminho: caminho.join('/'),
    collection: (nome) => ref([...caminho, nome]),
    doc: (id) => ref([...caminho, id]),
    where: (campo, _op, valor) => ref(caminho, { campo, valor }),
    limit: () => ref(caminho, filtro),
    get: async () => {
      if (filtro) {
        const lista = (h.membros[caminho[1]] || []).filter((m) => m[filtro.campo] === filtro.valor);
        return { empty: lista.length === 0, docs: lista.map((m) => ({ data: () => m })) };
      }
      const dados = ler(caminho);
      return { exists: dados != null, data: () => dados };
    },
  });
  const adminDb = {
    collection: (nome) => ref([nome]),
    runTransaction: async (fn) => fn({
      get: (r) => r.get(),
      set: (r, dados) => { h.escritas.push({ tipo: 'set', caminho: r.caminho, dados }); },
      update: (r, dados) => { h.escritas.push({ tipo: 'update', caminho: r.caminho, dados }); },
    }),
  };
  const adminAuth = {
    getUserByEmail: async (email) => {
      if (email === 'invalido') throw Object.assign(new Error('inválido'), { code: 'auth/invalid-email' });
      if (email === 'quebra@academia.com') throw new Error('Firebase fora do ar');
      if (h.usuarios[email]) return h.usuarios[email];
      throw Object.assign(new Error('não achou'), { code: 'auth/user-not-found' });
    },
  };
  return { adminDb, adminAuth, admin: { firestore: { FieldValue: { serverTimestamp: () => 'agora' } } } };
});
vi.mock('../_audit.js', () => ({ logAudit: async (e) => { h.auditoria.push(e); } }));
vi.mock('../_mail.js', () => ({ sendMail: async () => {} }));

const usuario = (extra = {}) => ({
  uid: 'u-ana', email: 'ana@academia.com', displayName: 'Ana do Firebase', disabled: false,
  customClaims: { tenantId: 'academia-teste' },
  metadata: { lastSignInTime: 'Sun, 28 Sep 2026 10:00:00 GMT' },
  tokensValidAfterTime: 'Sun, 28 Sep 2026 09:00:00 GMT',
  ...extra,
});

beforeEach(() => {
  h.usuarios = { 'ana@academia.com': usuario() };
  h.tenants = { 'academia-teste': { displayName: 'Academia Teste', status: 'active' } };
  h.membros = { 'academia-teste': [{ authUid: 'u-ana', email: 'ana@academia.com', name: 'Ana Souza' }] };
  h.resets = {};
  h.escritas = [];
  h.auditoria = [];
});

describe('findAccount', () => {
  it('e-mail sem conta devolve null', async () => {
    expect(await findAccount('bia@academia.com')).toBeNull();
  });

  it('monta a conta com o nome do cadastro, o e-mail e as duas marcas do Firebase', async () => {
    expect(await findAccount('ana@academia.com')).toEqual({
      uid: 'u-ana', email: 'ana@academia.com', tenantId: 'academia-teste', superAdmin: false, disabled: false,
      isMember: true, organizationActive: true, name: 'Ana Souza',
      signInMark: 'Sun, 28 Sep 2026 10:00:00 GMT', tokensMark: 'Sun, 28 Sep 2026 09:00:00 GMT',
    });
  });

  it('acha o cadastro pelo e-mail quando falta o authUid, como o login', async () => {
    h.membros['academia-teste'] = [{ email: 'ana@academia.com', name: 'Ana Legada' }];
    const c = await findAccount('ana@academia.com');
    expect(c.isMember).toBe(true);
    expect(c.name).toBe('Ana Legada');
  });

  it('sem cadastro na equipe, não é da equipe e fica com o nome do Firebase', async () => {
    h.membros['academia-teste'] = [];
    const c = await findAccount('ana@academia.com');
    expect(c.isMember).toBe(false);
    expect(c.name).toBe('Ana do Firebase');
  });

  it('academia suspensa ou arquivada não está ativa; teste vencido e sem documento estão', async () => {
    h.tenants['academia-teste'] = { status: 'suspended' };
    expect((await findAccount('ana@academia.com')).organizationActive).toBe(false);
    h.tenants['academia-teste'] = { status: 'active', archived: true };
    expect((await findAccount('ana@academia.com')).organizationActive).toBe(false);
    h.tenants['academia-teste'] = { status: 'trial' };
    expect((await findAccount('ana@academia.com')).organizationActive).toBe(true);
    delete h.tenants['academia-teste'];
    expect((await findAccount('ana@academia.com')).organizationActive).toBe(true);
  });

  it('super-admin e conta desativada saem com a marca certa e com o e-mail', async () => {
    h.usuarios['ana@academia.com'] = usuario({ customClaims: { superAdmin: true } });
    expect(await findAccount('ana@academia.com')).toMatchObject({ superAdmin: true, tenantId: null, email: 'ana@academia.com' });
    h.usuarios['ana@academia.com'] = usuario({ disabled: true });
    expect(await findAccount('ana@academia.com')).toMatchObject({ disabled: true, email: 'ana@academia.com' });
  });

  it('conta sem academia também sai com o e-mail', async () => {
    h.usuarios['ana@academia.com'] = usuario({ customClaims: {} });
    expect(await findAccount('ana@academia.com')).toMatchObject({ tenantId: null, isMember: false, email: 'ana@academia.com' });
  });

  it('e-mail que o Firebase não aceita vira null, e outro erro sobe', async () => {
    expect(await findAccount('invalido')).toBeNull();
    await expect(findAccount('quebra@academia.com')).rejects.toThrow('Firebase fora do ar');
  });
});

describe('transações no documento da conta', () => {
  const entrada = { now: 1_790_000_000_000, codeHash: 'h1', tenantId: 'academia-teste', signInMark: 's1', tokensMark: 't1' };

  it('issueCode grava o código em _password_reset/<uid>', async () => {
    expect(await issueCode('u-ana', entrada)).toEqual({ ok: true });
    expect(h.escritas).toHaveLength(1);
    expect(h.escritas[0]).toMatchObject({ tipo: 'set', caminho: '_password_reset/u-ana' });
    expect(h.escritas[0].dados).toMatchObject({ codeHash: 'h1', attempts: 0, usedAtMs: null, updatedAt: 'agora' });
  });

  it('issueCode no limite do dia não grava nada', async () => {
    h.resets['u-ana'] = { requestsMs: [1, 2, 3, 4, 5].map((i) => entrada.now - i) };
    expect(await issueCode('u-ana', entrada)).toEqual({ ok: false, reason: 'daily_limit' });
    expect(h.escritas).toEqual([]);
  });

  it('reserveAttempt soma a tentativa no código vivo', async () => {
    h.resets['u-ana'] = { codeHash: 'h1', expiresAtMs: entrada.now + 1000, attempts: 1, usedAtMs: null, signInMark: 's1', tokensMark: 't1' };
    expect(await reserveAttempt('u-ana', entrada.now))
      .toEqual({ ok: true, attempt: 2, code: { codeHash: 'h1', signInMark: 's1', tokensMark: 't1' } });
    expect(h.escritas).toEqual([{ tipo: 'update', caminho: '_password_reset/u-ana', dados: { attempts: 2, updatedAt: 'agora' } }]);
  });

  it('reserveAttempt sem código não grava nada', async () => {
    expect(await reserveAttempt('u-ana', entrada.now)).toEqual({ ok: false });
    expect(h.escritas).toEqual([]);
  });

  it('killCode só mata o código que ainda está lá', async () => {
    h.resets['u-ana'] = { codeHash: 'h1', usedAtMs: null };
    await killCode('u-ana', 'h2', entrada.now);
    expect(h.escritas).toEqual([]);
    await killCode('u-ana', 'h1', entrada.now);
    expect(h.escritas).toEqual([{ tipo: 'update', caminho: '_password_reset/u-ana', dados: { usedAtMs: entrada.now, updatedAt: 'agora' } }]);
  });

  it('audit grava password.reset com a academia e a conta', async () => {
    await audit({ uid: 'u-ana', tenantId: 'academia-teste' });
    expect(h.auditoria).toEqual([{ action: 'password.reset', tenantId: 'academia-teste', actorUid: 'u-ana', details: { via: 'codigo-por-email' } }]);
  });
});
