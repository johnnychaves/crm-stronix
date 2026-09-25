import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseAuthError } from 'firebase-admin/auth';
import handler from '../provision-tenant.js';
import { PASSWORD_REJECTED_ERROR } from '../../src/lib/passwordPolicy.js';

// O provisionamento é a autoridade sobre o identificador da academia: é o
// único ponto que cria tenants/{id}. Palavra reservada (pipeline, console...)
// vira academia só se passar por aqui, então a recusa mora aqui, antes de
// qualquer leitura.

const banco = vi.hoisted(() => ({ tenants: {}, leituras: [] }));
const contas = vi.hoisted(() => ({ createUser: vi.fn() }));

// Resposta do Firebase ao createUser com a senha "dorinhavianna", copiada do
// log da Vercel de 2026-09-25. O SDK monta o erro com fromServerError, igual
// aqui, e o código sai auth/internal-error: ele não conhece esse erro.
const RECUSA_DA_POLITICA = {
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
const recusaDaPolitica = () =>
  FirebaseAuthError.fromServerError(RECUSA_DA_POLITICA.error.message, undefined, RECUSA_DA_POLITICA);

vi.mock('../_firebaseAdmin.js', () => {
  const ref = (caminho) => ({
    collection: (nome) => ref([...caminho, nome]),
    doc: (id) => ref([...caminho, id]),
    get: async () => {
      banco.leituras.push(caminho.join('/'));
      const dados = caminho[0] === 'tenants' ? banco.tenants[caminho[1]] : undefined;
      return { id: caminho.at(-1), exists: dados != null, data: () => dados };
    },
  });
  return {
    adminDb: ref([]),
    adminAuth: contas,
    admin: { firestore: { FieldValue: { serverTimestamp: () => 'agora' } } },
    // Só o super-admin chega ao POST.
    verifyRequest: async () => ({ uid: 'super-1', superAdmin: true }),
  };
});

vi.mock('../_plans.js', () => ({
  loadPlans: async () => { banco.leituras.push('plans'); return new Map(); },
}));

const pedido = (tenantId) => ({
  method: 'POST',
  headers: { authorization: 'Bearer x' },
  body: { tenantId, displayName: 'Academia Nova', adminEmail: 'dono@academia.com' },
});
const resposta = () => ({
  statusCode: 0,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});

describe('POST /api/provision-tenant: identificador', () => {
  beforeEach(() => {
    banco.tenants = {};
    banco.leituras = [];
  });

  it('palavra reservada é recusada antes de qualquer leitura', async () => {
    const res = resposta();
    await handler(pedido('pipeline'), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('O identificador "pipeline" é usado pelo sistema. Escolha outro.');
    expect(banco.leituras).toEqual([]);
  });

  it('a recusa vale depois de aparar e passar para minúsculas', async () => {
    const res = resposta();
    await handler(pedido('  Console '), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('O identificador "console" é usado pelo sistema. Escolha outro.');
  });

  it('formato inválido mantém a mensagem de hoje', async () => {
    const res = resposta();
    await handler(pedido('ab'), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Identificador inválido. Use minúsculas, números e hífen (3–40 caracteres).');
    expect(banco.leituras).toEqual([]);
  });

  it('identificador livre passa da validação e chega à checagem de duplicado', async () => {
    banco.tenants['academia-nova'] = { displayName: 'Já existe' };
    const res = resposta();
    await handler(pedido('academia-nova'), res);
    expect(res.statusCode).toBe(409);
    expect(banco.leituras).toEqual(['plans', 'tenants/academia-nova']);
  });
});

// Modo "Senha manual" do Console. A política de senha do Firebase vale também
// para o createUser do Admin SDK, e a recusa dele chegava na tela como "Erro
// interno ao provisionar organização.".
const pedidoComSenha = (adminPassword) => ({
  method: 'POST',
  headers: { authorization: 'Bearer x' },
  body: {
    tenantId: 'dorinha-vianna', displayName: 'Dorinha Vianna',
    adminEmail: 'dono@academia.com', adminName: 'Dorinha', adminPassword,
  },
});

describe('POST /api/provision-tenant: senha manual', () => {
  beforeEach(() => {
    banco.tenants = {};
    banco.leituras = [];
    contas.createUser.mockReset();
    contas.createUser.mockRejectedValue(recusaDaPolitica());
  });

  it('senha só de minúsculas é recusada com a regra, antes de criar a conta', async () => {
    const res = resposta();
    await handler(pedidoComSenha('dorinhavianna'), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('A senha precisa ter letra maiúscula, número e símbolo (como ! @ # $).');
    expect(contas.createUser).not.toHaveBeenCalled();
    expect(banco.leituras).toEqual([]);
  });

  it('recusa do Firebase a uma senha que a regra do app aceitou vira 400, não erro interno', async () => {
    // É o que acontece se a política mudar no console e src/lib/passwordPolicy.js
    // ficar para trás.
    const res = resposta();
    await handler(pedidoComSenha('Academia@2026'), res);
    expect(contas.createUser).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(PASSWORD_REJECTED_ERROR);
  });
});
