import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import util from 'node:util';
import handler from '../admin-users.js';
import {
  LOGIN_EMAIL_INVALID_MESSAGE, LOGIN_EMAIL_TAKEN_MESSAGE, LOGIN_EMAIL_FAILED_MESSAGE,
} from '../../src/lib/loginEmail.js';

// A ação set-email de /api/admin-users: o campo "E-mail de login" da tela da
// equipe troca o e-mail da conta no Firebase Auth e o do cadastro juntos, e
// revoga as sessões da pessoa. As travas são as do set-password, na mesma
// ordem. O Firebase Admin é falso: contas por uid, documentos por caminho e,
// em h.passos, cada gravação na ordem em que aconteceu.

const h = vi.hoisted(() => ({
  docs: new Map(),
  contas: new Map(),
  sessao: null,
  leituras: [],
  passos: [],
  // Falhas combinadas por operação, na ordem das chamadas: [null, erro] deixa
  // a primeira passar e derruba a segunda.
  falhas: {},
}));

vi.mock('../_firebaseAdmin.js', () => {
  const copia = (v) => (v === undefined ? undefined : structuredClone(v));
  const falha = (op) => h.falhas[op]?.shift() ?? null;
  const semConta = () => Object.assign(
    new Error('There is no user record corresponding to the provided identifier.'),
    { code: 'auth/user-not-found' },
  );
  const foto = (caminho) => {
    const dados = h.docs.get(caminho);
    return { exists: dados !== undefined, id: caminho.split('/').at(-1), ref: doc(caminho), data: () => copia(dados) };
  };
  const doc = (caminho) => ({
    id: caminho.split('/').at(-1),
    collection: (nome) => colecao(`${caminho}/${nome}`),
    get: async () => {
      h.leituras.push(caminho);
      return foto(caminho);
    },
    update: async (dados) => {
      h.passos.push(['cadastro', caminho.split('/').at(-1), copia(dados)]);
      const erro = falha('cadastro');
      if (erro) throw erro;
      if (!h.docs.has(caminho)) throw new Error(`5 NOT_FOUND: No document to update: ${caminho}`);
      h.docs.set(caminho, { ...h.docs.get(caminho), ...copia(dados) });
    },
  });
  // Como a busca do SDK: só os documentos da coleção, ordenados pelo id.
  const colecao = (caminho, filtros = [], limite = Infinity) => ({
    doc: (id) => doc(`${caminho}/${id}`),
    where: (campo, _op, valor) => colecao(caminho, [...filtros, [campo, valor]], limite),
    limit: (n) => colecao(caminho, filtros, n),
    get: async () => {
      h.leituras.push(caminho);
      const prefixo = `${caminho}/`;
      const docs = [...h.docs.keys()]
        .filter((k) => k.startsWith(prefixo) && !k.slice(prefixo.length).includes('/'))
        .sort()
        .map(foto)
        .filter((f) => filtros.every(([campo, valor]) => f.data()?.[campo] === valor))
        .slice(0, limite);
      return { empty: docs.length === 0, docs };
    },
  });
  const adminAuth = {
    getUser: async (uid) => {
      const conta = h.contas.get(uid);
      if (!conta) throw semConta();
      return copia(conta);
    },
    getUserByEmail: async (email) => {
      const erro = falha('getUserByEmail');
      if (erro) throw erro;
      const conta = [...h.contas.values()].find((c) => c.email === String(email).toLowerCase());
      if (!conta) {
        throw Object.assign(new Error('There is no user record corresponding to the provided email.'), { code: 'auth/user-not-found' });
      }
      return copia(conta);
    },
    updateUser: async (uid, patch) => {
      h.passos.push(['auth', uid, copia(patch)]);
      const erro = falha('auth');
      if (erro) throw erro;
      const conta = h.contas.get(uid);
      if (!conta) throw semConta();
      Object.assign(conta, copia(patch));
      return copia(conta);
    },
    revokeRefreshTokens: async (uid) => {
      h.passos.push(['revogar', uid]);
      const erro = falha('revogar');
      if (erro) throw erro;
    },
  };
  return {
    adminDb: { collection: (nome) => colecao(nome) },
    adminAuth,
    admin: { firestore: { FieldValue: { serverTimestamp: () => 'agora' } } },
    verifyRequest: async () => copia(h.sessao),
  };
});

vi.mock('../_plans.js', () => ({ getSeatUsage: async () => ({}), canAddSeat: () => ({ ok: true }) }));
vi.mock('../_asaas.js', () => ({ syncSubscriptionValue: async () => {} }));
// O SDK do Sentry fica sem rede, mesmo com um SENTRY_DSN no ambiente.
vi.mock('@sentry/node', () => ({
  init: () => {},
  captureException: () => {},
  flush: async () => true,
  httpIntegration: () => ({ name: 'Http' }),
}));

const ACADEMIA = 'academia-nova';
const VIZINHA = 'academia-vizinha';
const EQUIPE = `artifacts/${ACADEMIA}/public/data/stronix_users`;
const SESSAO_DO_GESTOR = { uid: 'gestor-1', tenantId: ACADEMIA, superAdmin: false, impersonatedBy: null };

function conta(uid, email, claims, emailVerified = true) {
  h.contas.set(uid, { uid, email, emailVerified, customClaims: claims });
}
function cadastro(id, dados) {
  h.docs.set(`${EQUIPE}/${id}`, dados);
}

let consoles;

beforeEach(() => {
  h.docs.clear();
  h.contas.clear();
  h.leituras = [];
  h.passos = [];
  h.falhas = {};
  h.sessao = { ...SESSAO_DO_GESTOR };
  conta('gestor-1', 'gestor@academia.com', { tenantId: ACADEMIA });
  cadastro('gestor-1', { role: 'admin', authUid: 'gestor-1', name: 'Gestor', email: 'gestor@academia.com' });
  // Ana foi cadastrada com o domínio digitado errado.
  conta('uid-ana', 'ana@gmial.com', { tenantId: ACADEMIA });
  cadastro('uid-ana', { role: 'consultant', authUid: 'uid-ana', name: 'Ana', email: 'ana@gmial.com' });
  consoles = ['info', 'warn', 'error', 'log'].map((nivel) => vi.spyOn(console, nivel).mockImplementation(() => {}));
});
afterEach(() => vi.restoreAllMocks());

const pedido = (body) => ({ method: 'POST', headers: { authorization: 'Bearer x' }, body });
const resposta = () => ({
  statusCode: 0,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});

// Troca o e-mail de Ana para ana@gmail.com, salvo o que o teste mudar.
async function trocar(corpo = {}) {
  const res = resposta();
  await handler(pedido({ action: 'set-email', targetAuthUid: 'uid-ana', email: 'ana@gmail.com', ...corpo }), res);
  return res;
}

const emailDaConta = (uid) => h.contas.get(uid)?.email;
const emailDoCadastro = (id) => h.docs.get(`${EQUIPE}/${id}`)?.email;
// Tudo o que foi para o console, como texto e sem corte.
const linhas = () => util.inspect(consoles.flatMap((spy) => spy.mock.calls), {
  depth: null, maxArrayLength: Infinity, maxStringLength: Infinity, breakLength: Infinity,
});

describe('set-email: quem pode', () => {
  it('sem sessão dá 401 e não lê nada', async () => {
    h.sessao = null;
    const res = await trocar();
    expect([res.statusCode, res.body]).toEqual([401, { error: 'Não autenticado.' }]);
    expect(h.leituras).toEqual([]);
    expect(h.passos).toEqual([]);
  });

  it('o super-admin sem academia no token dá 401, como no set-password', async () => {
    h.sessao = { uid: 'dono', tenantId: null, superAdmin: true, impersonatedBy: null };
    const res = await trocar();
    expect(res.statusCode).toBe(401);
    expect(h.passos).toEqual([]);
  });

  it('consultor não troca e-mail de ninguém: 403', async () => {
    // Ana, consultora, tentando pôr o e-mail dela na conta do gestor.
    h.sessao = { uid: 'uid-ana', tenantId: ACADEMIA, superAdmin: false, impersonatedBy: null };
    const res = await trocar({ targetAuthUid: 'gestor-1', email: 'ana.dona@gmail.com' });
    expect([res.statusCode, res.body]).toEqual([403, { error: 'Apenas o master pode trocar o e-mail de login.' }]);
    expect(h.passos).toEqual([]);
    expect(emailDaConta('gestor-1')).toBe('gestor@academia.com');
  });

  it('alvo de outra academia é recusado, mesmo com um cadastro nesta apontando para ele', async () => {
    // O documento da equipe é escrito pelo próprio gestor. Quem prova que a
    // conta é desta academia é o claim do Auth.
    conta('uid-vizinho', 'vizinho@outra.com', { tenantId: VIZINHA });
    cadastro('forjado', { role: 'consultant', authUid: 'uid-vizinho', name: 'Vizinho', email: 'vizinho@outra.com' });
    const res = await trocar({ targetAuthUid: 'uid-vizinho', email: 'gestor.dono@gmail.com' });
    expect([res.statusCode, res.body]).toEqual([404, { error: 'Usuário não encontrado neste tenant.' }]);
    expect(h.passos).toEqual([]);
    expect(emailDaConta('uid-vizinho')).toBe('vizinho@outra.com');
  });

  it('conta sem academia no claim é recusada do mesmo jeito', async () => {
    conta('uid-solto', 'solto@gmail.com', {});
    cadastro('uid-solto', { role: 'consultant', authUid: 'uid-solto', name: 'Solto', email: 'solto@gmail.com' });
    const res = await trocar({ targetAuthUid: 'uid-solto', email: 'solto.novo@gmail.com' });
    expect([res.statusCode, res.body]).toEqual([404, { error: 'Usuário não encontrado neste tenant.' }]);
    expect(h.passos).toEqual([]);
  });

  it('o e-mail do super-admin nunca é trocado, nem com claim e cadastro desta academia', async () => {
    conta('uid-dono', 'dono@stronix.com', { superAdmin: true, tenantId: ACADEMIA });
    cadastro('uid-dono', { role: 'admin', authUid: 'uid-dono', name: 'Dono', email: 'dono@stronix.com' });
    const res = await trocar({ targetAuthUid: 'uid-dono', email: 'dono.novo@gmail.com' });
    expect([res.statusCode, res.body]).toEqual([403, { error: 'Esta conta não pode ser alterada por aqui.' }]);
    expect(h.passos).toEqual([]);
    expect(emailDaConta('uid-dono')).toBe('dono@stronix.com');
  });

  it('conta desta academia sem cadastro na equipe dá 404', async () => {
    conta('uid-sem-cadastro', 'sem@gmail.com', { tenantId: ACADEMIA });
    const res = await trocar({ targetAuthUid: 'uid-sem-cadastro', email: 'sem.novo@gmail.com' });
    expect([res.statusCode, res.body]).toEqual([404, { error: 'Usuário não encontrado neste tenant.' }]);
    expect(h.passos).toEqual([]);
  });

  it('o gestor troca o próprio e-mail, e as sessões dele caem junto', async () => {
    const res = await trocar({ targetAuthUid: 'gestor-1', email: 'gestor.novo@academia.com' });
    expect([res.statusCode, res.body]).toEqual([200, { ok: true, changed: true }]);
    expect(emailDaConta('gestor-1')).toBe('gestor.novo@academia.com');
    expect(h.passos.at(-1)).toEqual(['revogar', 'gestor-1']);
  });
});

describe('set-email: o e-mail novo', () => {
  it('sem alvo ou sem e-mail dá 400', async () => {
    for (const corpo of [{ targetAuthUid: '' }, { email: '' }, { targetAuthUid: 7 }, { email: ['ana@gmail.com'] }]) {
      const res = await trocar(corpo);
      expect([res.statusCode, res.body]).toEqual([400, { error: 'Campos obrigatórios: targetAuthUid, email.' }]);
    }
    expect(h.passos).toEqual([]);
  });

  it('formato ruim dá 400 antes de qualquer leitura', async () => {
    for (const email of ['ana@gmail', 'ana gmail.com', '   ', 'ana@@gmail.com']) {
      const res = await trocar({ email });
      expect([res.statusCode, res.body]).toEqual([400, { error: LOGIN_EMAIL_INVALID_MESSAGE }]);
    }
    expect(h.leituras).toEqual([]);
    expect(h.passos).toEqual([]);
  });

  it('e-mail de outra conta no Auth dá 409, sem dizer de quem é', async () => {
    conta('uid-bia', 'bia@gmail.com', { tenantId: VIZINHA });
    const res = await trocar({ email: ' Bia@Gmail.com ' });
    expect([res.statusCode, res.body]).toEqual([409, { error: LOGIN_EMAIL_TAKEN_MESSAGE }]);
    expect(JSON.stringify(res.body)).not.toMatch(/uid-bia|vizinha/);
    expect(h.passos).toEqual([]);
    expect(emailDaConta('uid-ana')).toBe('ana@gmial.com');
  });

  it('e-mail de outro cadastro da academia dá 409, mesmo sem conta no Auth', async () => {
    cadastro('doc-caio', { role: 'consultant', name: 'Caio', email: 'caio@gmail.com' });
    const res = await trocar({ email: 'caio@gmail.com' });
    expect([res.statusCode, res.body]).toEqual([409, { error: LOGIN_EMAIL_TAKEN_MESSAGE }]);
    expect(h.passos).toEqual([]);
  });

  it('um cadastro repetido da própria pessoa não barra a troca', async () => {
    cadastro('doc-ana-antigo', { role: 'consultant', authUid: 'uid-ana', name: 'Ana', email: 'ana@gmail.com' });
    const res = await trocar();
    expect(res.statusCode).toBe(200);
  });

  it('mesmo e-mail da conta: responde ok, acerta o cadastro e não revoga nada', async () => {
    // O cadastro ficou diferente do Auth, do jeito que a tela antiga deixava.
    h.docs.get(`${EQUIPE}/uid-ana`).email = 'ana@gmail.com';
    const res = await trocar({ email: ' ANA@gmial.com ' });
    expect([res.statusCode, res.body]).toEqual([200, { ok: true, changed: false }]);
    expect(h.passos).toEqual([['cadastro', 'uid-ana', { email: 'ana@gmial.com' }]]);
    expect(emailDoCadastro('uid-ana')).toBe('ana@gmial.com');
  });

  it('mesmo e-mail com o cadastro já certo não grava nada', async () => {
    const res = await trocar({ email: 'ana@gmial.com' });
    expect([res.statusCode, res.body]).toEqual([200, { ok: true, changed: false }]);
    expect(h.passos).toEqual([]);
  });
});

describe('set-email: a troca', () => {
  it('grava no Auth com o e-mail sem verificação, depois no cadastro, e só então revoga', async () => {
    const res = await trocar({ email: ' Ana@Gmail.com ' });
    expect([res.statusCode, res.body]).toEqual([200, { ok: true, changed: true }]);
    expect(h.passos).toEqual([
      ['auth', 'uid-ana', { email: 'ana@gmail.com', emailVerified: false }],
      ['cadastro', 'uid-ana', { email: 'ana@gmail.com' }],
      ['revogar', 'uid-ana'],
    ]);
    expect(h.contas.get('uid-ana')).toMatchObject({ email: 'ana@gmail.com', emailVerified: false });
    expect(emailDoCadastro('uid-ana')).toBe('ana@gmail.com');
  });

  it('se o cadastro falhar, o Auth volta ao e-mail antigo e a resposta é 500', async () => {
    h.falhas.cadastro = [new Error('14 UNAVAILABLE: connection reset')];
    const res = await trocar();
    expect([res.statusCode, res.body]).toEqual([500, { error: LOGIN_EMAIL_FAILED_MESSAGE }]);
    expect(h.passos).toEqual([
      ['auth', 'uid-ana', { email: 'ana@gmail.com', emailVerified: false }],
      ['cadastro', 'uid-ana', { email: 'ana@gmail.com' }],
      ['auth', 'uid-ana', { email: 'ana@gmial.com', emailVerified: true }],
    ]);
    expect(h.contas.get('uid-ana')).toMatchObject({ email: 'ana@gmial.com', emailVerified: true });
    expect(emailDoCadastro('uid-ana')).toBe('ana@gmial.com');
  });

  it('se a volta do Auth também falhar, o log diz o que ficou, com os e-mails mascarados', async () => {
    h.falhas.cadastro = [new Error('14 UNAVAILABLE: connection reset')];
    h.falhas.auth = [null, new Error('503 backend indisponível')];
    const res = await trocar();
    expect([res.statusCode, res.body]).toEqual([500, { error: LOGIN_EMAIL_FAILED_MESSAGE }]);
    expect(emailDaConta('uid-ana')).toBe('ana@gmail.com');
    expect(console.error).toHaveBeenCalledWith(
      'admin-set-email: não voltou o e-mail do Auth. A conta ficou com o e-mail novo.',
      expect.objectContaining({ conta: 'uid-ana', academia: ACADEMIA, antigo: 'an***@gmial.com', novo: 'an***@gmail.com' }),
    );
  });

  it('se a revogação falhar, o cadastro e o Auth voltam e a resposta é 500', async () => {
    h.falhas.revogar = [new Error('503 backend indisponível')];
    const res = await trocar();
    expect([res.statusCode, res.body]).toEqual([500, { error: LOGIN_EMAIL_FAILED_MESSAGE }]);
    expect(h.passos).toEqual([
      ['auth', 'uid-ana', { email: 'ana@gmail.com', emailVerified: false }],
      ['cadastro', 'uid-ana', { email: 'ana@gmail.com' }],
      ['revogar', 'uid-ana'],
      ['cadastro', 'uid-ana', { email: 'ana@gmial.com' }],
      ['auth', 'uid-ana', { email: 'ana@gmial.com', emailVerified: true }],
    ]);
    expect(emailDaConta('uid-ana')).toBe('ana@gmial.com');
    expect(emailDoCadastro('uid-ana')).toBe('ana@gmial.com');
  });

  it('recusa do Firebase por e-mail em uso vira 409, sem gravar o cadastro', async () => {
    h.falhas.auth = [Object.assign(new Error('The email address is already in use by another account.'), { code: 'auth/email-already-exists' })];
    const res = await trocar();
    expect([res.statusCode, res.body]).toEqual([409, { error: LOGIN_EMAIL_TAKEN_MESSAGE }]);
    expect(h.passos).toEqual([['auth', 'uid-ana', { email: 'ana@gmail.com', emailVerified: false }]]);
    expect(emailDoCadastro('uid-ana')).toBe('ana@gmial.com');
  });

  it('recusa do Firebase por formato vira 400', async () => {
    h.falhas.auth = [Object.assign(new Error('The email address is improperly formatted.'), { code: 'auth/invalid-email' })];
    const res = await trocar();
    expect([res.statusCode, res.body]).toEqual([400, { error: LOGIN_EMAIL_INVALID_MESSAGE }]);
    expect(h.passos).toHaveLength(1);
  });

  it('conta que sumiu do Auth no meio do caminho dá 404, como no set-password', async () => {
    h.falhas.auth = [Object.assign(new Error('There is no user record corresponding to the provided identifier.'), { code: 'auth/user-not-found' })];
    const res = await trocar();
    expect([res.statusCode, res.body]).toEqual([404, { error: 'Conta de autenticação não encontrada.' }]);
  });
});

describe('set-email: o que vai para o console', () => {
  it('nenhum e-mail inteiro, nem nas falhas, e a troca fica registrada mascarada', async () => {
    conta('uid-bia', 'bia@gmail.com', { tenantId: VIZINHA });
    // A troca certa.
    expect((await trocar()).statusCode).toBe(200);
    // E-mail de outra conta.
    expect((await trocar({ email: 'bia@gmail.com' })).statusCode).toBe(409);
    // Formato ruim.
    expect((await trocar({ email: 'ana@gmail' })).statusCode).toBe(400);
    // O cadastro falha e a volta também, com o e-mail no texto do erro.
    h.falhas.cadastro = [new Error('não gravou ana.segunda@gmail.com')];
    h.falhas.auth = [null, new Error('não voltou ana@gmail.com')];
    expect((await trocar({ email: 'ana.segunda@gmail.com' })).statusCode).toBe(500);
    // Erro inesperado na busca do e-mail, também com o endereço no texto.
    h.falhas.getUserByEmail = [new Error('falha ao consultar ana.terceira@gmail.com')];
    expect((await trocar({ email: 'ana.terceira@gmail.com' })).statusCode).toBe(500);

    const saida = linhas();
    expect(saida).toContain('admin-set-email: e-mail de login trocado');
    expect(saida).toContain('an***@gmail.com');
    for (const email of ['ana@gmail.com', 'ana@gmial.com', 'bia@gmail.com', 'ana.segunda@gmail.com', 'ana.terceira@gmail.com']) {
      expect(saida).not.toContain(email);
    }
  });
});
