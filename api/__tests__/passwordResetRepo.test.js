import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { findAccount, issueCode, reserveAttempt, killCode, audit } from '../_passwordResetRepo.js';

const h = vi.hoisted(() => ({ usuarios: {}, tenants: {}, membros: {}, resets: {}, escritas: [], auditoria: [], leituras: [] }));

// Os cadastros da equipe ficam indexados pelo caminho inteiro da coleção, como
// no banco: uma busca em outro caminho não acha ninguém.
const EQUIPE = 'artifacts/academia-teste/public/data/stronix_users';

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
      h.leituras.push(filtro ? `${caminho.join('/')} where ${filtro.campo} == ${filtro.valor}` : caminho.join('/'));
      if (filtro) {
        const lista = (h.membros[caminho.join('/')] || []).filter((m) => m[filtro.campo] === filtro.valor);
        return { empty: lista.length === 0, docs: lista.map((m) => ({ id: m.id, data: () => m })) };
      }
      const dados = ler(caminho);
      return { exists: dados != null, data: () => dados };
    },
  });
  const adminDb = {
    collection: (nome) => ref([nome]),
    // Como o SDK: a leitura depois de uma escrita na mesma transação lança.
    runTransaction: async (fn) => {
      let escreveu = false;
      return fn({
        get: (r) => {
          if (escreveu) throw new Error('Firestore transactions require all reads to be executed before all writes.');
          return r.get();
        },
        set: (r, dados) => { escreveu = true; h.escritas.push({ tipo: 'set', caminho: r.caminho, dados }); },
        update: (r, dados) => { escreveu = true; h.escritas.push({ tipo: 'update', caminho: r.caminho, dados }); },
      });
    },
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
  h.membros = { [EQUIPE]: [{ id: 'u-ana', authUid: 'u-ana', email: 'ana@academia.com', name: 'Ana Souza' }] };
  h.resets = {};
  h.escritas = [];
  h.auditoria = [];
  h.leituras = [];
});
afterEach(() => {
  vi.unstubAllEnvs();
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

  it('lê a academia em tenants/<id> e a equipe em artifacts/<id>/public/data/stronix_users', async () => {
    await findAccount('ana@academia.com');
    expect(h.leituras).toEqual(expect.arrayContaining(['tenants/academia-teste', `${EQUIPE} where authUid == u-ana`]));
  });

  it('acha o cadastro pelo authUid, qualquer que seja o id do documento', async () => {
    h.membros[EQUIPE] = [{ id: 'doc-qualquer', authUid: 'u-ana', email: 'outro@academia.com', name: 'Ana Convidada' }];
    const c = await findAccount('ana@academia.com');
    expect(c.isMember).toBe(true);
    expect(c.name).toBe('Ana Convidada');
  });

  it('acha o cadastro legado pelo e-mail quando o id do documento é o uid, como o login', async () => {
    h.membros[EQUIPE] = [{ id: 'u-ana', email: 'ana@academia.com', name: 'Ana Legada' }];
    const c = await findAccount('ana@academia.com');
    expect(c.isMember).toBe(true);
    expect(c.name).toBe('Ana Legada');
  });

  it('cadastro achado pelo e-mail com id de outra conta não conta: o login não consegue vinculá-lo', async () => {
    // O cadastro do Bruno, com o e-mail da Ana por engano.
    h.membros[EQUIPE] = [{ id: 'u-bruno', authUid: 'u-bruno', email: 'ana@academia.com', name: 'Bruno Lima' }];
    const bruno = await findAccount('ana@academia.com');
    expect(bruno.isMember).toBe(false);
    expect(bruno.name).toBe('Ana do Firebase');
    // Cadastro antigo, sem authUid e com id automático.
    h.membros[EQUIPE] = [{ id: 'doc-antigo', email: 'ana@academia.com', name: 'Ana Antiga' }];
    const antigo = await findAccount('ana@academia.com');
    expect(antigo.isMember).toBe(false);
    expect(antigo.name).toBe('Ana do Firebase');
  });

  it('o legado é procurado pelo e-mail da conta em minúsculas, mesmo com outra grafia no digitado e no Firebase', async () => {
    // Digitado em maiúsculas, e o Firebase guarda o e-mail com a grafia dele.
    h.usuarios['ANA@ACADEMIA.COM'] = usuario({ email: 'Ana@Academia.com' });
    h.membros[EQUIPE] = [{ id: 'u-ana', email: 'ana@academia.com', name: 'Ana Legada' }];
    const c = await findAccount('ANA@ACADEMIA.COM');
    expect(c.isMember).toBe(true);
    expect(c.name).toBe('Ana Legada');
    // O código continua indo para a grafia que o Firebase guarda.
    expect(c.email).toBe('Ana@Academia.com');
    expect(h.leituras).toContain(`${EQUIPE} where email == ana@academia.com`);
    expect(h.leituras.filter((l) => l.includes(' where email == '))).toHaveLength(1);
  });

  it('o legado usa o e-mail que o Firebase guarda para a conta, e não o digitado', async () => {
    // O Firebase acha a conta pelo digitado, e o e-mail dela é outro.
    h.usuarios['ana@academia.com'] = usuario({ email: 'ana.souza@academia.com' });
    h.membros[EQUIPE] = [
      { id: 'u-ana', email: 'ana.souza@academia.com', name: 'Ana Legada' },
      { id: 'u-bia', email: 'ana@academia.com', name: 'Bia Costa' },
    ];
    const c = await findAccount('ana@academia.com');
    expect(c.isMember).toBe(true);
    expect(c.name).toBe('Ana Legada');
    expect(h.leituras).toContain(`${EQUIPE} where email == ana.souza@academia.com`);
    expect(h.leituras).not.toContain(`${EQUIPE} where email == ana@academia.com`);
  });

  it('conta sem e-mail no Firebase não é procurada pelo e-mail', async () => {
    h.usuarios['ana@academia.com'] = usuario({ email: '' });
    h.membros[EQUIPE] = [{ id: 'u-ana', email: '', name: 'Sem E-mail' }];
    const c = await findAccount('ana@academia.com');
    expect(c.email).toBeNull();
    expect(c.isMember).toBe(false);
    expect(h.leituras.some((l) => l.includes(' where email == '))).toBe(false);
  });

  it('sem cadastro na equipe, não é da equipe e fica com o nome do Firebase', async () => {
    h.membros[EQUIPE] = [];
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

  // Cada caso sai por um corte só do retorno antecipado: o super-admin e a conta
  // desativada trazem a academia no claim, e só a conta sem academia fica sem ela.
  it.each([
    ['super-admin', { customClaims: { tenantId: 'academia-teste', superAdmin: true } }, { superAdmin: true, tenantId: 'academia-teste' }],
    ['conta desativada', { disabled: true }, { disabled: true, tenantId: 'academia-teste' }],
    ['conta sem academia', { customClaims: {} }, { tenantId: null }],
  ])('%s sai com o e-mail e sem ler a academia nem a equipe', async (_caso, extra, esperado) => {
    h.usuarios['ana@academia.com'] = usuario(extra);
    expect(await findAccount('ana@academia.com')).toMatchObject({ ...esperado, email: 'ana@academia.com' });
    expect(h.leituras).toEqual([]);
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

  it('audit grava password.reset com a academia, a conta e o ambiente', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    await audit({ uid: 'u-ana', tenantId: 'academia-teste' });
    expect(h.auditoria).toEqual([{
      action: 'password.reset', tenantId: 'academia-teste', actorUid: 'u-ana',
      details: { via: 'codigo-por-email', ambiente: 'production' },
    }]);
  });

  it('a troca feita no Preview fica diferente da de produção na auditoria', async () => {
    // O Preview usa o Firebase de produção, e lá o código sai no log da Vercel.
    vi.stubEnv('VERCEL_ENV', 'preview');
    await audit({ uid: 'u-ana', tenantId: 'academia-teste' });
    expect(h.auditoria[0].details).toEqual({ via: 'codigo-por-email', ambiente: 'preview' });
  });

  it('sem VERCEL_ENV, o ambiente vai como null', async () => {
    for (const valor of [undefined, '']) {
      vi.stubEnv('VERCEL_ENV', valor);
      await audit({ uid: 'u-ana', tenantId: 'academia-teste' });
    }
    expect(h.auditoria.map((e) => e.details)).toEqual([
      { via: 'codigo-por-email', ambiente: null },
      { via: 'codigo-por-email', ambiente: null },
    ]);
  });
});
