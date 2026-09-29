import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import util from 'node:util';
import { realResetDeps } from '../_passwordResetRepo.js';
import { requestPasswordReset, confirmPasswordReset } from '../_passwordResetFlow.js';
import { hashResetCode } from '../_passwordReset.js';

// A fiação do "Esqueci a senha": o fluxo de verdade (_passwordResetFlow.js)
// ligado ao realResetDeps() (_passwordResetRepo.js), sobre um banco falso que
// guarda o que é gravado. O teste do repositório confere cada operação sozinha
// e o do fluxo roda com deps falsas. Este é o que prova que os dois se
// encaixam: os nomes que o fluxo lê em deps são os que o repositório entrega, e
// um pedido e uma troca passam de ponta a ponta.

const h = vi.hoisted(() => ({
  store: new Map(), membros: {}, usuarios: {}, senhas: [], revogadas: [], auditoria: [], envios: [],
}));

vi.mock('../_firebaseAdmin.js', () => {
  const ref = (caminho, filtro = null) => ({
    caminho: caminho.join('/'),
    collection: (nome) => ref([...caminho, nome]),
    doc: (id) => ref([...caminho, id]),
    where: (campo, _op, valor) => ref(caminho, { campo, valor }),
    limit: () => ref(caminho, filtro),
    get: async () => {
      if (filtro) {
        const lista = (h.membros[caminho.join('/')] || []).filter((m) => m[filtro.campo] === filtro.valor);
        return { empty: lista.length === 0, docs: lista.map((m) => ({ id: m.id, data: () => m })) };
      }
      const dados = h.store.get(caminho.join('/'));
      return { exists: dados != null, data: () => dados };
    },
  });
  const adminDb = {
    collection: (nome) => ref([nome]),
    // Como o SDK: o set troca o documento inteiro, o update num documento que
    // não existe falha, e a leitura depois de uma escrita na mesma transação
    // lança.
    runTransaction: async (fn) => {
      let escreveu = false;
      return fn({
        get: (r) => {
          if (escreveu) throw new Error('Firestore transactions require all reads to be executed before all writes.');
          return r.get();
        },
        set: (r, dados) => { escreveu = true; h.store.set(r.caminho, dados); },
        update: (r, dados) => {
          if (!h.store.has(r.caminho)) throw new Error(`NOT_FOUND: ${r.caminho}`);
          escreveu = true;
          h.store.set(r.caminho, { ...h.store.get(r.caminho), ...dados });
        },
      });
    },
  };
  const adminAuth = {
    getUserByEmail: async (email) => {
      if (h.usuarios[email]) return h.usuarios[email];
      throw Object.assign(new Error('não achou'), { code: 'auth/user-not-found' });
    },
    updateUser: async (uid, patch) => { h.senhas.push({ uid, patch }); },
    revokeRefreshTokens: async (uid) => { h.revogadas.push(uid); },
  };
  return { adminDb, adminAuth, admin: { firestore: { FieldValue: { serverTimestamp: () => 'agora' } } } };
});
vi.mock('../_audit.js', () => ({ logAudit: async (e) => { h.auditoria.push(e); } }));
vi.mock('../_mail.js', () => ({ sendMail: async (...args) => { h.envios.push(args); } }));

const SEGREDO = 'chave-privada-de-teste';
// Os cadastros da equipe ficam indexados pelo caminho inteiro da coleção.
const EQUIPE = 'artifacts/academia-teste/public/data/stronix_users';
const IP = '203.0.113.7';
const SENHA = 'Nova@Senha1';
const SIGN_IN = 'Sun, 28 Sep 2026 10:00:00 GMT';
const TOKENS = 'Sun, 28 Sep 2026 09:00:00 GMT';
const silencioso = { info: () => {}, error: () => {} };

beforeEach(() => {
  vi.stubEnv('FIREBASE_ADMIN_PRIVATE_KEY', SEGREDO);
  h.store = new Map([['tenants/academia-teste', { status: 'active' }]]);
  h.membros = { [EQUIPE]: [{ id: 'u-ana', authUid: 'u-ana', email: 'ana@academia.com', name: 'Ana Souza' }] };
  // O Firebase guarda o e-mail com a grafia dele, que pode diferir da digitada.
  h.usuarios = {
    'ana@academia.com': {
      uid: 'u-ana', email: 'Ana@Academia.com', displayName: 'Ana do Firebase', disabled: false,
      customClaims: { tenantId: 'academia-teste' },
      metadata: { lastSignInTime: SIGN_IN },
      tokensValidAfterTime: TOKENS,
    },
  };
  h.senhas = [];
  h.revogadas = [];
  h.auditoria = [];
  h.envios = [];
});
afterEach(() => {
  vi.unstubAllEnvs();
});

// As deps de verdade, só com o log calado para o teste não escrever no terminal.
// O log entra por atribuição: o spread deixaria o secret para trás, porque ele
// não é enumerável.
const deps = () => {
  const d = realResetDeps();
  d.log = silencioso;
  return d;
};
const mensagens = () => h.envios.map(([msg]) => msg);

// Faz o pedido e devolve o código que saiu no texto do e-mail.
async function pedir(digitado = 'ana@academia.com') {
  expect(await requestPasswordReset(digitado, IP, deps())).toEqual({ sent: true });
  return mensagens().at(-1).text.split('\n').find((linha) => /^\d{6}$/.test(linha));
}

const trocar = (code, extra = {}) =>
  confirmPasswordReset({ email: 'ana@academia.com', code, newPassword: SENHA, ip: IP, ...extra }, deps());

// Os nomes que o fluxo lê em deps, tirados do código dele sem os comentários.
function depsUsadasPeloFluxo() {
  const fonte = fs.readFileSync(new URL('../_passwordResetFlow.js', import.meta.url), 'utf8');
  const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  return [...new Set([...codigo.matchAll(/\bdeps\.(\w+)/g)].map((m) => m[1]))].sort();
}

describe('realResetDeps entrega o que o fluxo usa', () => {
  it('as chaves que o fluxo lê em deps são as que o módulo entrega', () => {
    // getOwnPropertyNames traz também o secret, que não é enumerável.
    expect(depsUsadasPeloFluxo()).toEqual(Object.getOwnPropertyNames(realResetDeps()).sort());
  });

  it('cada chave tem o tipo com que o fluxo a usa', () => {
    const d = realResetDeps();
    const tipos = Object.fromEntries(Object.getOwnPropertyNames(d).map((nome) => [nome, typeof d[nome]]));
    expect(tipos).toEqual({
      findAccount: 'function', issueCode: 'function', reserveAttempt: 'function', killCode: 'function',
      setPassword: 'function', revokeSessions: 'function', audit: 'function', sendMail: 'function',
      now: 'function', randomInt: 'function', secret: 'string', log: 'object',
    });
    expect(d.secret).toBe(SEGREDO);
    expect(d.log).toBe(console);
  });

  it('now devolve o relógio de agora e randomInt sorteia de 0 até antes do máximo', () => {
    const d = realResetDeps();
    const antes = Date.now();
    const agora = d.now();
    expect(agora).toBeGreaterThanOrEqual(antes);
    expect(agora).toBeLessThanOrEqual(Date.now());
    const sorteios = Array.from({ length: 2000 }, () => d.randomInt(1_000_000));
    expect(sorteios.every((n) => Number.isInteger(n) && n >= 0 && n < 1_000_000)).toBe(true);
    expect(d.randomInt(1)).toBe(0);
  });

  it('o segredo lê normalmente, mas não aparece em JSON.stringify nem em util.inspect', () => {
    const d = realResetDeps();
    expect(d.secret).toBe(SEGREDO);
    expect(Object.keys(d)).not.toContain('secret');
    expect(JSON.stringify(d)).not.toContain(SEGREDO);
    expect(util.inspect(d)).not.toContain(SEGREDO);
    expect(util.inspect(d, { depth: null })).not.toContain(SEGREDO);
  });

  it('copiar o deps com spread deixa o segredo para trás, e o fluxo falha em vez de seguir sem ele', async () => {
    const copia = { ...realResetDeps(), log: silencioso };
    expect(copia.secret).toBeUndefined();
    await expect(requestPasswordReset('ana@academia.com', IP, copia)).rejects.toThrow('falta o segredo');
    expect(mensagens()).toEqual([]);
    expect(h.store.has('_password_reset/u-ana')).toBe(false);
  });

  it('sendMail entrega ao _mail.js só a mensagem', async () => {
    const msg = { to: 'a@b.com', subject: 'assunto', html: '<p>oi</p>', text: 'oi' };
    await realResetDeps().sendMail(msg);
    expect(h.envios).toEqual([[msg]]);
  });
});

describe('o fluxo de verdade sobre as operações de verdade', () => {
  it('o pedido manda o código ao e-mail que o Firebase guarda, e não ao digitado', async () => {
    await pedir('  ana@academia.com ');
    expect(mensagens()).toHaveLength(1);
    expect(mensagens()[0].to).toBe('Ana@Academia.com');
  });

  it('o pedido grava em _password_reset/<uid> só a impressão do código', async () => {
    const codigo = await pedir();
    const doc = h.store.get('_password_reset/u-ana');
    expect(Object.keys(doc).sort()).toEqual([
      'attempts', 'codeHash', 'expiresAtMs', 'requestsMs', 'signInMark', 'tenantId', 'tokensMark', 'updatedAt', 'usedAtMs',
    ]);
    expect(doc).toMatchObject({
      tenantId: 'academia-teste', attempts: 0, usedAtMs: null, updatedAt: 'agora', signInMark: SIGN_IN, tokensMark: TOKENS,
    });
    expect(doc.requestsMs).toHaveLength(1);
    // A impressão sai do segredo do ambiente e do uid, e o código em si não fica.
    expect(doc.codeHash).toBe(hashResetCode(SEGREDO, 'u-ana', codigo));
    expect(Object.values(doc)).not.toContain(codigo);
  });

  it('a tentativa errada gasta uma das cinco e não troca a senha', async () => {
    const codigo = await pedir();
    const errado = codigo === '000000' ? '111111' : '000000';
    expect(await trocar(errado)).toEqual({ ok: false, reason: 'wrong_code' });
    expect(h.store.get('_password_reset/u-ana')).toMatchObject({ attempts: 1, usedAtMs: null });
    expect(h.senhas).toEqual([]);
    expect(h.revogadas).toEqual([]);
    expect(h.auditoria).toEqual([]);
  });

  it('o código certo troca a senha, revoga as sessões, audita e marca o código como usado', async () => {
    const codigo = await pedir();
    expect(await trocar(codigo)).toEqual({ ok: true });
    expect(h.senhas).toEqual([{ uid: 'u-ana', patch: { password: SENHA } }]);
    expect(h.revogadas).toEqual(['u-ana']);
    expect(h.auditoria).toEqual([
      { action: 'password.reset', tenantId: 'academia-teste', actorUid: 'u-ana', details: { via: 'codigo-por-email' } },
    ]);
    expect(h.store.get('_password_reset/u-ana').usedAtMs).toEqual(expect.any(Number));
  });

  it('o mesmo código não serve duas vezes', async () => {
    const codigo = await pedir();
    expect(await trocar(codigo)).toEqual({ ok: true });
    expect(await trocar(codigo, { newPassword: 'Outra@Senha2' })).toEqual({ ok: false, reason: 'no_live_code' });
    expect(h.senhas).toHaveLength(1);
  });

  it('conta sem e-mail no Firebase é recusada com no_email e nada é gravado', async () => {
    h.usuarios['ana@academia.com'].email = '';
    expect(await requestPasswordReset('ana@academia.com', IP, deps())).toEqual({ sent: false, reason: 'no_email' });
    expect(mensagens()).toEqual([]);
    expect(h.store.has('_password_reset/u-ana')).toBe(false);
  });

  it('o quinto pedido do dia ainda sai e o sexto é barrado', async () => {
    const resultados = [];
    for (let i = 0; i < 6; i += 1) resultados.push(await requestPasswordReset('ana@academia.com', IP, deps()));
    expect(resultados).toEqual([...Array(5).fill({ sent: true }), { sent: false, reason: 'daily_limit' }]);
    expect(mensagens()).toHaveLength(5);
  });

  it('academia suspensa não recebe código', async () => {
    h.store.set('tenants/academia-teste', { status: 'suspended' });
    expect(await requestPasswordReset('ana@academia.com', IP, deps())).toEqual({ sent: false, reason: 'organization_inactive' });
    expect(mensagens()).toEqual([]);
  });
});
