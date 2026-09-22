import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../provision-tenant.js';

// O provisionamento é a autoridade sobre o identificador da academia: é o
// único ponto que cria tenants/{id}. Palavra reservada (pipeline, console...)
// vira academia só se passar por aqui, então a recusa mora aqui, antes de
// qualquer leitura.

const banco = vi.hoisted(() => ({ tenants: {}, leituras: [] }));

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
    adminAuth: {},
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
