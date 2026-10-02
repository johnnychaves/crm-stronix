import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import inviteCreate from '../invite-create.js';
import inviteAccept from '../invite-accept.js';
import adminUsers from '../admin-users.js';
import { PROFESSOR_LINK_MESSAGES } from '../../src/lib/teamRoles.js';

// O acesso de professor pelos caminhos que criam gente na academia (convite,
// aceite e cadastro pelo gestor), pela troca de papel (set-role) e pela
// exclusão. O Firebase Admin é falso, mas a conta das vagas é a de verdade
// (api/_plans.js): é ela que prova que o professor não ocupa vaga de
// consultor nem de gestor. Sem a coleção plans/, o starter é o da semente:
// 1 gestor e 2 consultores, sem extra pago.

const T = 'academia-teste';
const banco = vi.hoisted(() => ({ docs: new Map(), sessao: null, ultimoId: 0 }));
const contas = vi.hoisted(() => ({
  createUser: vi.fn(), setCustomUserClaims: vi.fn(), getUser: vi.fn(), getUserByEmail: vi.fn(),
  updateUser: vi.fn(), deleteUser: vi.fn(), revokeRefreshTokens: vi.fn(),
}));
const cobranca = vi.hoisted(() => ({ sincronizar: vi.fn() }));

vi.mock('../_firebaseAdmin.js', () => {
  const APAGAR = Symbol('apagar');
  const aplicar = (antes, mudanca) => {
    const depois = { ...(antes || {}) };
    for (const [campo, valor] of Object.entries(mudanca)) {
      if (valor === APAGAR) delete depois[campo];
      else depois[campo] = valor;
    }
    return depois;
  };
  // Documento quando o caminho tem número par de partes, coleção quando ímpar.
  const ref = (caminho, filtros = []) => {
    const chave = caminho.join('/');
    const filhos = () => [...banco.docs.entries()]
      .filter(([k]) => k.startsWith(`${chave}/`) && !k.slice(chave.length + 1).includes('/'))
      .filter(([, d]) => filtros.every(({ campo, valor }) => d[campo] === valor))
      .map(([k, d]) => {
        const id = k.slice(chave.length + 1);
        return { id, exists: true, data: () => ({ ...d }), ref: ref([...caminho, id]) };
      });
    return {
      id: caminho.at(-1),
      collection: (nome) => ref([...caminho, nome]),
      doc: (id) => ref([...caminho, id]),
      where: (campo, _op, valor) => ref(caminho, [...filtros, { campo, valor }]),
      limit: () => ref(caminho, filtros),
      count: () => ({ get: async () => ({ data: () => ({ count: filhos().length }) }) }),
      get: async () => {
        if (caminho.length % 2 === 0) {
          const d = banco.docs.get(chave);
          return { id: caminho.at(-1), exists: d != null, data: () => (d ? { ...d } : undefined), ref: ref(caminho) };
        }
        const docs = filhos();
        return { empty: docs.length === 0, size: docs.length, docs, forEach: (fn) => docs.forEach(fn) };
      },
      set: async (dados, opcoes) => {
        banco.docs.set(chave, aplicar(opcoes?.merge ? banco.docs.get(chave) : {}, dados));
      },
      update: async (dados) => {
        if (!banco.docs.has(chave)) throw Object.assign(new Error('documento não existe'), { code: 5 });
        banco.docs.set(chave, aplicar(banco.docs.get(chave), dados));
      },
      add: async (dados) => {
        const id = `auto-${++banco.ultimoId}`;
        banco.docs.set(`${chave}/${id}`, aplicar({}, dados));
        return ref([...caminho, id]);
      },
      delete: async () => { banco.docs.delete(chave); },
    };
  };
  return {
    adminDb: ref([]),
    adminAuth: contas,
    admin: {
      firestore: {
        FieldValue: { serverTimestamp: () => 'agora', delete: () => APAGAR },
        Timestamp: { fromMillis: (ms) => ({ toMillis: () => ms }) },
      },
    },
    verifyRequest: async () => banco.sessao,
  };
});

vi.mock('../_rateLimit.js', () => ({
  checkRateLimit: async () => ({ ok: true }),
  clientIp: () => '203.0.113.9',
}));
vi.mock('../_asaas.js', () => ({ syncSubscriptionValue: async (...args) => cobranca.sincronizar(...args) }));
// O SDK do Sentry fica sem rede, mesmo com um SENTRY_DSN no ambiente.
vi.mock('@sentry/node', () => ({
  init: () => {},
  captureException: () => {},
  flush: async () => true,
  httpIntegration: () => ({ name: 'Http' }),
}));

const EQUIPE = `artifacts/${T}/public/data/stronix_users`;
const CATALOGO = `artifacts/${T}/public/data/stronix_professores`;
const SENHA = 'Academia@2026';
const PLANO_COM_EXTRA = { slug: 'starter', name: 'Starter', maxManagers: 1, maxConsultants: 2, extraUserPrice: 30, maxExtraUsers: 5 };

const cadastro = (id) => banco.docs.get(`${EQUIPE}/${id}`);
const convites = () => [...banco.docs.entries()]
  .filter(([k]) => k.startsWith(`tenants/${T}/invites/`))
  .map(([, d]) => d);
const consultorDe = (id) => ({ name: id, email: `${id}@academia.com`, authUid: id, role: 'consultant' });
const professorDe = (id, professorId) => ({ name: id, email: `${id}@academia.com`, authUid: id, role: 'professor', professorId });

// Academia STRONIX de teste: módulo ligado, um gestor, as duas vagas de
// consultor ocupadas (Ana e Bia) e três professores no cadastro.
function semear({ modules = ['faltosos'], plano = null, equipe = {} } = {}) {
  banco.docs = new Map([
    [`tenants/${T}`, { plan: 'starter', status: 'active', modules, primaryAdminUid: 'gestor-1' }],
    [`${EQUIPE}/gestor-1`, { name: 'Gestor', email: 'gestor@academia.com', authUid: 'gestor-1', role: 'admin' }],
    [`${EQUIPE}/uid-ana`, { name: 'Ana', email: 'ana@academia.com', authUid: 'uid-ana', role: 'consultant' }],
    [`${EQUIPE}/uid-bia`, { name: 'Bia', email: 'bia@academia.com', authUid: 'uid-bia', role: 'consultant' }],
    [`${CATALOGO}/prof-rafa`, { nome: 'Rafael Menezes', ativo: true }],
    [`${CATALOGO}/prof-lu`, { nome: 'Luana Prado' }],
    [`${CATALOGO}/prof-velho`, { nome: 'Carlos Antigo', ativo: false }],
  ]);
  if (plano) banco.docs.set(`plans/${plano.slug}`, plano);
  for (const [id, dados] of Object.entries(equipe)) {
    if (dados === null) banco.docs.delete(`${EQUIPE}/${id}`);
    else banco.docs.set(`${EQUIPE}/${id}`, dados);
  }
}

const resposta = () => ({
  statusCode: 0,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});
async function chamar(handler, body) {
  const res = resposta();
  await handler({ method: 'POST', headers: { authorization: 'Bearer x' }, body }, res);
  return res;
}
const criar = (extra) => chamar(adminUsers, { action: 'create', name: 'Luana', email: 'lu@academia.com', password: SENHA, ...extra });
const trocarPapel = (extra) => chamar(adminUsers, { action: 'set-role', ...extra });

let logErro;
let logInfo;
beforeEach(() => {
  semear();
  banco.sessao = { uid: 'gestor-1', tenantId: T, superAdmin: false };
  banco.ultimoId = 0;
  for (const fn of Object.values(contas)) fn.mockReset();
  contas.createUser.mockImplementation(async ({ email }) => ({ uid: `uid-${email.split('@')[0]}` }));
  contas.getUser.mockImplementation(async (uid) => ({ uid, customClaims: { tenantId: T } }));
  cobranca.sincronizar.mockReset();
  logErro = vi.spyOn(console, 'error').mockImplementation(() => {});
  logInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  logErro.mockRestore();
  logInfo.mockRestore();
});

describe('cadastro pelo gestor (create)', () => {
  it('professor entra ligado ao professor do cadastro, mesmo com as vagas de consultor cheias', async () => {
    const res = await criar({ role: 'professor', professorId: 'prof-lu' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, authUid: 'uid-lu', role: 'professor', isExtra: false });
    expect(cadastro('uid-lu')).toMatchObject({ role: 'professor', professorId: 'prof-lu', authUid: 'uid-lu', tenantId: T });
    expect(contas.setCustomUserClaims).toHaveBeenCalledWith('uid-lu', { tenantId: T });
  });

  it('consultor continua barrado com as duas vagas ocupadas', async () => {
    const res = await criar({});
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('Limite de consultores do plano starter');
    expect(contas.createUser).not.toHaveBeenCalled();
  });

  it('professor não ocupa vaga: com um professor e um consultor, ainda cabe o segundo consultor', async () => {
    semear({ equipe: { 'uid-bia': null, 'uid-rafa': professorDe('uid-rafa', 'prof-rafa') } });
    const res = await criar({});
    expect(res.statusCode).toBe(200);
    expect(cadastro('uid-lu')).toMatchObject({ role: 'consultant' });
    expect(cadastro('uid-lu')).not.toHaveProperty('professorId');
  });

  it('sem o módulo, o papel Professor é recusado e nenhuma conta é criada', async () => {
    semear({ modules: [] });
    const res = await criar({ role: 'professor', professorId: 'prof-lu' });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe(PROFESSOR_LINK_MESSAGES.moduleOff);
    expect(contas.createUser).not.toHaveBeenCalled();
  });

  it('sem professor escolhido, recusa e não cria a conta', async () => {
    const res = await criar({ role: 'professor' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(PROFESSOR_LINK_MESSAGES.missing);
    expect(contas.createUser).not.toHaveBeenCalled();
  });

  it.each([
    ['professor inativo', 'prof-velho', 422, PROFESSOR_LINK_MESSAGES.inactive],
    ['professor fora do cadastro', 'prof-sumido', 422, PROFESSOR_LINK_MESSAGES.notFound],
    ['professor que já tem login', 'prof-rafa', 409, PROFESSOR_LINK_MESSAGES.taken],
  ])('%s é recusado', async (_caso, professorId, status, erro) => {
    semear({ equipe: { 'uid-rafa': professorDe('uid-rafa', 'prof-rafa') } });
    const res = await criar({ role: 'professor', professorId });
    expect(res.statusCode).toBe(status);
    expect(res.body.error).toBe(erro);
    expect(contas.createUser).not.toHaveBeenCalled();
  });
});

describe('convite de professor', () => {
  const convidar = (extra) => chamar(inviteCreate, { email: 'lu@academia.com', role: 'professor', professorId: 'prof-lu', ...extra });
  const aceitar = (token) => chamar(inviteAccept, { tenantId: T, token, password: SENHA, name: 'Luana' });

  it('o convite guarda o professor, e o aceite cria o cadastro ligado a ele', async () => {
    const convite = await convidar();
    expect(convite.statusCode).toBe(200);
    expect(convite.body).toMatchObject({ role: 'professor', professorId: 'prof-lu' });
    expect(convites()).toEqual([
      expect.objectContaining({ email: 'lu@academia.com', role: 'professor', professorId: 'prof-lu', status: 'pending' }),
    ]);

    const aceite = await aceitar(convite.body.token);
    expect(aceite.statusCode).toBe(200);
    expect(aceite.body.role).toBe('professor');
    expect(cadastro('uid-lu')).toMatchObject({ name: 'Luana', role: 'professor', professorId: 'prof-lu', tenantId: T });
  });

  it('com a vaga de gestor e as de consultor cheias, o convite de professor passa e o de gestor não', async () => {
    expect((await convidar()).statusCode).toBe(200);
    const gestor = await chamar(inviteCreate, { email: 'outro@academia.com', role: 'admin' });
    expect(gestor.statusCode).toBe(403);
  });

  it('sem o módulo, o convite de professor é recusado', async () => {
    semear({ modules: [] });
    const res = await convidar();
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe(PROFESSOR_LINK_MESSAGES.moduleOff);
    expect(convites()).toEqual([]);
  });

  it('convite de professor sem professor é recusado', async () => {
    const res = await convidar({ professorId: undefined });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(PROFESSOR_LINK_MESSAGES.missing);
    expect(convites()).toEqual([]);
  });

  it('o aceite recusa se o professor ganhou outro login depois do convite', async () => {
    const convite = await convidar();
    banco.docs.set(`${EQUIPE}/uid-outra`, professorDe('uid-outra', 'prof-lu'));
    const aceite = await aceitar(convite.body.token);
    expect(aceite.statusCode).toBe(409);
    expect(aceite.body.error).toBe(PROFESSOR_LINK_MESSAGES.inviteStale);
    expect(contas.createUser).not.toHaveBeenCalled();
  });

  it('o aceite recusa se o módulo foi desligado depois do convite', async () => {
    const convite = await convidar();
    banco.docs.set(`tenants/${T}`, { ...banco.docs.get(`tenants/${T}`), modules: [] });
    const aceite = await aceitar(convite.body.token);
    expect(aceite.statusCode).toBe(409);
    expect(aceite.body.error).toBe(PROFESSOR_LINK_MESSAGES.inviteStale);
    expect(contas.createUser).not.toHaveBeenCalled();
  });
});

describe('troca de papel (set-role)', () => {
  it('consultor vira professor: grava o papel e o professor, tira a meta de prospecção e derruba as sessões da pessoa', async () => {
    banco.docs.set(`${EQUIPE}/uid-ana`, { ...cadastro('uid-ana'), dailyVolumeTarget: 20 });
    const res = await trocarPapel({ userDocId: 'uid-ana', role: 'professor', professorId: 'prof-lu' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, changed: true, role: 'professor' });
    expect(cadastro('uid-ana')).toMatchObject({ name: 'Ana', role: 'professor', professorId: 'prof-lu' });
    expect(cadastro('uid-ana')).not.toHaveProperty('dailyVolumeTarget');
    expect(contas.revokeRefreshTokens).toHaveBeenCalledWith('uid-ana');
    expect(cobranca.sincronizar).not.toHaveBeenCalled();
  });

  it('consultor com leads não vira professor antes de migrar a carteira', async () => {
    banco.docs.set(`artifacts/${T}/public/data/stronix_leads/L1`, { name: 'Mariana', consultantId: 'uid-ana' });
    const res = await trocarPapel({ userDocId: 'uid-ana', role: 'professor', professorId: 'prof-lu' });
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe(PROFESSOR_LINK_MESSAGES.ownsLeads('Ana'));
    expect(res.body.error).toContain('Configurações → Migrar leads');
    expect(cadastro('uid-ana').role).toBe('consultant');
    expect(contas.revokeRefreshTokens).not.toHaveBeenCalled();
  });

  // A carteira conta tudo o que tem o consultantId da pessoa, não só o lead
  // em aberto: o cliente que ficasse com ela passaria o consultantId para cada
  // indicação nova pelo link público.
  it.each([
    ['cliente', { name: 'Mariana', consultantId: 'uid-ana', lifecycleStage: 'cliente' }],
    ['perda', { name: 'Mariana', consultantId: 'uid-ana', status: 'Perda' }],
  ])('%s na carteira também barra', async (_caso, lead) => {
    banco.docs.set(`artifacts/${T}/public/data/stronix_leads/L1`, lead);
    const res = await trocarPapel({ userDocId: 'uid-ana', role: 'professor', professorId: 'prof-lu' });
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe(PROFESSOR_LINK_MESSAGES.ownsLeads('Ana'));
    expect(cadastro('uid-ana').role).toBe('consultant');
  });

  it('lead de outra pessoa não barra', async () => {
    banco.docs.set(`artifacts/${T}/public/data/stronix_leads/L1`, { name: 'Mariana', consultantId: 'uid-bia' });
    const res = await trocarPapel({ userDocId: 'uid-ana', role: 'professor', professorId: 'prof-lu' });
    expect(res.statusCode).toBe(200);
    expect(cadastro('uid-ana').role).toBe('professor');
  });

  it('cadastro antigo, de id diferente do uid da conta, não vira professor', async () => {
    semear({ equipe: { 'doc-antigo': { name: 'Beto', email: 'beto@academia.com', authUid: 'uid-beto', role: 'consultant' } } });
    const res = await trocarPapel({ userDocId: 'doc-antigo', role: 'professor', professorId: 'prof-lu' });
    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe(PROFESSOR_LINK_MESSAGES.legacyRecord('Beto'));
    expect(cadastro('doc-antigo').role).toBe('consultant');
  });

  it('consultor extra que vira professor libera a vaga paga, e a assinatura é ajustada', async () => {
    semear({ plano: PLANO_COM_EXTRA, equipe: { 'uid-cris': consultorDe('uid-cris') } });
    const res = await trocarPapel({ userDocId: 'uid-cris', role: 'professor', professorId: 'prof-lu' });
    expect(res.statusCode).toBe(200);
    expect(cobranca.sincronizar).toHaveBeenCalledWith(T, { actorUid: 'gestor-1' });
  });

  it('professor só volta a consultor com vaga: com as vagas cheias, recusa e não mexe no cadastro', async () => {
    semear({ equipe: { 'uid-rafa': professorDe('uid-rafa', 'prof-rafa') } });
    const antes = { ...cadastro('uid-rafa') };
    const res = await trocarPapel({ userDocId: 'uid-rafa', role: 'consultant' });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('Limite de consultores');
    expect(cadastro('uid-rafa')).toEqual(antes);
    expect(contas.revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it('professor vira consultor extra só com a confirmação do gestor, e a assinatura é ajustada', async () => {
    semear({ plano: PLANO_COM_EXTRA, equipe: { 'uid-rafa': professorDe('uid-rafa', 'prof-rafa') } });
    const semConfirmar = await trocarPapel({ userDocId: 'uid-rafa', role: 'consultant' });
    expect(semConfirmar.statusCode).toBe(409);
    expect(semConfirmar.body).toMatchObject({ requiresExtraConfirmation: true, extraUserPrice: 30 });
    expect(cadastro('uid-rafa').role).toBe('professor');

    const confirmado = await trocarPapel({ userDocId: 'uid-rafa', role: 'consultant', allowExtra: true });
    expect(confirmado.statusCode).toBe(200);
    expect(confirmado.body).toMatchObject({ changed: true, role: 'consultant', isExtra: true });
    expect(cadastro('uid-rafa').role).toBe('consultant');
    expect(cadastro('uid-rafa')).not.toHaveProperty('professorId');
    expect(cobranca.sincronizar).toHaveBeenCalledTimes(1);
    expect(contas.revokeRefreshTokens).toHaveBeenCalledWith('uid-rafa');
  });

  it('trocar o professor ligado não esbarra no próprio vínculo e não derruba a sessão', async () => {
    semear({ equipe: { 'uid-rafa': professorDe('uid-rafa', 'prof-rafa') } });
    const res = await trocarPapel({ userDocId: 'uid-rafa', role: 'professor', professorId: 'prof-lu' });
    expect(res.statusCode).toBe(200);
    expect(cadastro('uid-rafa').professorId).toBe('prof-lu');
    expect(contas.revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it('o mesmo papel com o mesmo professor não grava nada; o professor de outra pessoa é recusado', async () => {
    semear({ equipe: { 'uid-rafa': professorDe('uid-rafa', 'prof-rafa') } });
    const igual = await trocarPapel({ userDocId: 'uid-rafa', role: 'professor', professorId: 'prof-rafa' });
    expect(igual.statusCode).toBe(200);
    expect(igual.body).toEqual({ ok: true, changed: false });

    const ocupado = await trocarPapel({ userDocId: 'uid-ana', role: 'professor', professorId: 'prof-rafa' });
    expect(ocupado.statusCode).toBe(409);
    expect(ocupado.body.error).toBe(PROFESSOR_LINK_MESSAGES.taken);
    expect(cadastro('uid-ana').role).toBe('consultant');
  });

  it('sem o módulo, ninguém vira professor', async () => {
    semear({ modules: [] });
    const res = await trocarPapel({ userDocId: 'uid-ana', role: 'professor', professorId: 'prof-lu' });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe(PROFESSOR_LINK_MESSAGES.moduleOff);
    expect(cadastro('uid-ana').role).toBe('consultant');
  });

  it('o papel do gestor não muda por aqui, nem o próprio', async () => {
    semear({ equipe: { 'gestor-2': { name: 'Gestora', email: 'g2@academia.com', authUid: 'gestor-2', role: 'admin' } } });
    const outroGestor = await trocarPapel({ userDocId: 'gestor-2', role: 'consultant' });
    expect(outroGestor.statusCode).toBe(400);
    expect(outroGestor.body.error).toBe('O papel do gestor não muda por aqui.');

    const proprio = await trocarPapel({ userDocId: 'gestor-1', role: 'consultant' });
    expect(proprio.statusCode).toBe(400);
    expect(proprio.body.error).toBe('Você não pode trocar o seu próprio papel.');
  });

  it('só o gestor troca papel', async () => {
    banco.sessao = { uid: 'uid-ana', tenantId: T, superAdmin: false };
    const res = await trocarPapel({ userDocId: 'uid-bia', role: 'professor', professorId: 'prof-lu' });
    expect(res.statusCode).toBe(403);
    expect(cadastro('uid-bia').role).toBe('consultant');
  });

  // O gestor escreve qualquer campo do stronix_users da própria academia, então
  // um cadastro dele pode apontar id e authUid para a conta de outra academia.
  // Quem prova de quem é a conta é o claim do Auth, e sem essa trava o set-role
  // derrubaria as sessões de uma pessoa de fora.
  describe('conta de fora da academia', () => {
    const claimsDe = (alvo, claims) => async (uid) => ({ uid, customClaims: uid === alvo ? claims : { tenantId: T } });

    it.each([
      ['consultor que viraria professor', consultorDe('uid-x'), { role: 'professor', professorId: 'prof-lu' }],
      ['professor que voltaria a consultor', professorDe('uid-x', 'prof-rafa'), { role: 'consultant' }],
    ])('%s com a conta de outra academia: recusa sem mexer no cadastro nem na sessão', async (_caso, dados, pedido) => {
      semear({ equipe: { 'uid-bia': null, 'uid-x': dados } });
      contas.getUser.mockImplementation(claimsDe('uid-x', { tenantId: 'outra-academia' }));
      const antes = { ...cadastro('uid-x') };
      const res = await trocarPapel({ userDocId: 'uid-x', ...pedido });
      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('Usuário não encontrado neste tenant.');
      expect(contas.getUser).toHaveBeenCalledWith('uid-x');
      expect(cadastro('uid-x')).toEqual(antes);
      expect(contas.revokeRefreshTokens).not.toHaveBeenCalled();
      expect(cobranca.sincronizar).not.toHaveBeenCalled();
    });

    it('a conta do super-admin não muda de papel por aqui', async () => {
      semear({ equipe: { 'uid-x': consultorDe('uid-x') } });
      contas.getUser.mockImplementation(claimsDe('uid-x', { superAdmin: true, tenantId: T }));
      const res = await trocarPapel({ userDocId: 'uid-x', role: 'professor', professorId: 'prof-lu' });
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('Esta conta não pode ser alterada por aqui.');
      expect(cadastro('uid-x').role).toBe('consultant');
      expect(cadastro('uid-x')).not.toHaveProperty('professorId');
      expect(contas.revokeRefreshTokens).not.toHaveBeenCalled();
    });

    it('cadastro cuja conta não existe mais troca o papel, sem sessão para derrubar', async () => {
      semear({ equipe: { 'uid-bia': null, 'uid-x': professorDe('uid-x', 'prof-rafa') } });
      contas.getUser.mockImplementation(async (uid) => {
        if (uid === 'uid-x') throw Object.assign(new Error('conta não existe'), { code: 'auth/user-not-found' });
        return { uid, customClaims: { tenantId: T } };
      });
      const res = await trocarPapel({ userDocId: 'uid-x', role: 'consultant' });
      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ ok: true, changed: true, role: 'consultant' });
      expect(cadastro('uid-x').role).toBe('consultant');
      expect(cadastro('uid-x')).not.toHaveProperty('professorId');
      expect(contas.revokeRefreshTokens).not.toHaveBeenCalled();
    });
  });

  it('por aqui o papel muda só entre Consultor e Professor', async () => {
    const res = await trocarPapel({ userDocId: 'uid-ana', role: 'admin' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Por aqui o papel muda só entre Consultor e Professor.');
  });
});

describe('exclusão', () => {
  it('excluir professor não mexe na assinatura; excluir consultor extra mexe', async () => {
    semear({
      plano: PLANO_COM_EXTRA,
      equipe: { 'uid-cris': consultorDe('uid-cris'), 'uid-rafa': professorDe('uid-rafa', 'prof-rafa') },
    });
    const professor = await chamar(adminUsers, { action: 'delete', userDocId: 'uid-rafa' });
    expect(professor.statusCode).toBe(200);
    expect(cadastro('uid-rafa')).toBeUndefined();
    expect(cobranca.sincronizar).not.toHaveBeenCalled();

    const consultor = await chamar(adminUsers, { action: 'delete', userDocId: 'uid-cris' });
    expect(consultor.statusCode).toBe(200);
    expect(cobranca.sincronizar).toHaveBeenCalledTimes(1);
  });
});
