import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../admin-users.js';
import { PASSWORD_REJECTED_ERROR } from '../../src/lib/passwordPolicy.js';
import { recusaDaPolitica } from './_recusaDaPolitica.js';

// As duas ações de /api/admin-users que gravam senha no Firebase Auth: o
// cadastro de consultor e a troca de senha pelo gestor. Nas duas, a senha fora
// da regra para antes de qualquer leitura, e a recusa do Firebase vira 400.

const banco = vi.hoisted(() => ({ usuarios: {}, leituras: [] }));
const contas = vi.hoisted(() => ({
  createUser: vi.fn(), updateUser: vi.fn(), getUser: vi.fn(), setCustomUserClaims: vi.fn(),
}));

vi.mock('../_firebaseAdmin.js', () => {
  const ref = (caminho, filtro = null) => ({
    collection: (nome) => ref([...caminho, nome]),
    doc: (id) => ref([...caminho, id]),
    where: (campo, _op, valor) => ref(caminho, { campo, valor }),
    limit: () => ref(caminho, filtro),
    set: async () => {},
    get: async () => {
      banco.leituras.push(caminho.join('/'));
      if (filtro) {
        const achados = Object.values(banco.usuarios).filter((u) => u[filtro.campo] === filtro.valor);
        return { empty: achados.length === 0, docs: achados.map((u) => ({ data: () => u })) };
      }
      const dados = banco.usuarios[caminho.at(-1)];
      return { exists: dados != null, data: () => dados };
    },
  });
  return {
    adminDb: ref([]),
    adminAuth: contas,
    admin: { firestore: { FieldValue: { serverTimestamp: () => 'agora' } } },
    // Gestor da academia, logado.
    verifyRequest: async () => ({ uid: 'gestor-1', tenantId: 'academia-nova', superAdmin: false }),
  };
});

vi.mock('../_plans.js', () => ({
  getSeatUsage: async () => ({}),
  canAddSeat: () => ({ ok: true }),
}));
vi.mock('../_asaas.js', () => ({ syncSubscriptionValue: async () => {} }));

const pedido = (body) => ({ method: 'POST', headers: { authorization: 'Bearer x' }, body });
const resposta = () => ({
  statusCode: 0,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});

describe('POST /api/admin-users: senha', () => {
  let log;
  beforeEach(() => {
    banco.usuarios = {
      'gestor-1': { role: 'admin', authUid: 'gestor-1' },
      'consultor-1': { role: 'consultant', authUid: 'consultor-1' },
    };
    banco.leituras = [];
    for (const fn of Object.values(contas)) fn.mockReset();
    contas.getUser.mockResolvedValue({ customClaims: { tenantId: 'academia-nova' } });
    contas.createUser.mockRejectedValue(recusaDaPolitica());
    contas.updateUser.mockRejectedValue(recusaDaPolitica());
    log = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => log.mockRestore());

  it('cadastro com senha no formato do "Gerar" antigo, sem símbolo, é recusado antes de qualquer leitura', async () => {
    const res = resposta();
    await handler(pedido({ action: 'create', name: 'Ana', email: 'ana@academia.com', password: 'Kp7mXq2wRt9z' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('A senha precisa ter símbolo (como ! @ # $).');
    expect(banco.leituras).toEqual([]);
    expect(contas.createUser).not.toHaveBeenCalled();
  });

  it('cadastro: recusa do Firebase vira 400 e a conta não ganha claim', async () => {
    const res = resposta();
    await handler(pedido({ action: 'create', name: 'Ana', email: 'ana@academia.com', password: 'Academia@2026' }), res);
    expect(contas.createUser).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(PASSWORD_REJECTED_ERROR);
    expect(contas.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it('troca de senha fora da regra é recusada antes de qualquer leitura', async () => {
    const res = resposta();
    await handler(pedido({ action: 'set-password', targetAuthUid: 'consultor-1', password: 'academianova' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('A senha precisa ter letra maiúscula, número e símbolo (como ! @ # $).');
    expect(banco.leituras).toEqual([]);
    expect(contas.updateUser).not.toHaveBeenCalled();
  });

  it('troca de senha: recusa do Firebase vira 400', async () => {
    const res = resposta();
    await handler(pedido({ action: 'set-password', targetAuthUid: 'consultor-1', password: 'Academia@2026' }), res);
    expect(contas.updateUser).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(PASSWORD_REJECTED_ERROR);
  });

  it('troca de senha: conta que sumiu do Auth continua dando 404', async () => {
    const semConta = Object.assign(
      new Error('There is no user record corresponding to the provided identifier.'),
      { code: 'auth/user-not-found' },
    );
    contas.updateUser.mockRejectedValue(semConta);
    const res = resposta();
    await handler(pedido({ action: 'set-password', targetAuthUid: 'consultor-1', password: 'Academia@2026' }), res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Conta de autenticação não encontrada.');
  });
});
