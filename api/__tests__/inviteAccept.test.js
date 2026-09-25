import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../invite-accept.js';
import { PASSWORD_REJECTED_ERROR } from '../../src/lib/passwordPolicy.js';
import { recusaDaPolitica } from './_recusaDaPolitica.js';

// O aceite de convite é por onde passa a primeira senha do dono de academia
// nova (o Console cria no modo convite por padrão) e de todo consultor
// convidado. É rota pública, então a senha é conferida antes de qualquer
// leitura, e a recusa do Firebase não pode virar "Erro interno".

const banco = vi.hoisted(() => ({ tenants: {}, convites: [], leituras: [] }));
const contas = vi.hoisted(() => ({ createUser: vi.fn(), setCustomUserClaims: vi.fn() }));

vi.mock('../_firebaseAdmin.js', () => {
  const ref = (caminho, filtro = null) => ({
    collection: (nome) => ref([...caminho, nome]),
    doc: (id) => ref([...caminho, id]),
    where: (campo, _op, valor) => ref(caminho, { campo, valor }),
    limit: () => ref(caminho, filtro),
    get: async () => {
      banco.leituras.push(caminho.join('/'));
      if (caminho.at(-1) === 'invites') {
        const achados = banco.convites.filter((c) => c[filtro.campo] === filtro.valor);
        return {
          empty: achados.length === 0,
          docs: achados.map((c) => ({ data: () => c, ref: { set: async () => {} } })),
        };
      }
      const dados = caminho[0] === 'tenants' ? banco.tenants[caminho[1]] : undefined;
      return { exists: dados != null, data: () => dados };
    },
  });
  return {
    adminDb: ref([]),
    adminAuth: contas,
    admin: { firestore: { FieldValue: { serverTimestamp: () => 'agora' } } },
  };
});

vi.mock('../_rateLimit.js', () => ({
  checkRateLimit: async () => ({ ok: true }),
  clientIp: () => '203.0.113.9',
}));
vi.mock('../_plans.js', () => ({
  getSeatUsage: async () => ({}),
  canAddSeat: () => ({ ok: true }),
}));
vi.mock('../_asaas.js', () => ({ syncSubscriptionValue: async () => {} }));

const pedido = (password) => ({
  method: 'POST',
  headers: {},
  body: { tenantId: 'academia-nova', token: 'convite-1', password, name: 'Dorinha' },
});
const resposta = () => ({
  statusCode: 0,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});

describe('POST /api/invite-accept: senha', () => {
  let log;
  beforeEach(() => {
    banco.tenants = { 'academia-nova': { status: 'trial' } };
    banco.convites = [{
      token: 'convite-1', status: 'pending', email: 'dono@academia.com', role: 'admin',
      expiresAt: { toMillis: () => Date.now() + 24 * 60 * 60 * 1000 },
    }];
    banco.leituras = [];
    contas.createUser.mockReset();
    contas.createUser.mockRejectedValue(recusaDaPolitica());
    contas.setCustomUserClaims.mockReset();
    log = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => log.mockRestore());

  it('senha fora da regra é recusada com a regra, antes de qualquer leitura', async () => {
    const res = resposta();
    await handler(pedido('academianova'), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('A senha precisa ter letra maiúscula, número e símbolo (como ! @ # $).');
    expect(banco.leituras).toEqual([]);
    expect(contas.createUser).not.toHaveBeenCalled();
  });

  it('recusa do Firebase vira 400, a conta não ganha claim e o log pede para alinhar a regra', async () => {
    const res = resposta();
    await handler(pedido('Academia@2026'), res);
    expect(contas.createUser).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(PASSWORD_REJECTED_ERROR);
    expect(contas.setCustomUserClaims).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Alinhe o arquivo'), expect.any(String));
  });
});
