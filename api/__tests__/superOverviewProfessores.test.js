// A lista de academias do super console (api/super-overview.js). Ela leva os
// módulos de cada academia, para o cartão Módulos mostrar a chave certa, e
// conta o professor à parte: professor não ocupa vaga de consultor e não entra
// no preço dos consultores extras, que vira o MRR do console. É a mesma conta
// do getSeatUsage (api/_plans.js).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../super-overview.js';

const banco = vi.hoisted(() => ({ tenants: {}, equipe: {} }));
const precos = vi.hoisted(() => ({ effectivePrice: vi.fn() }));

vi.mock('../_firebaseAdmin.js', () => {
  const ref = (caminho, filtro = null) => ({
    collection: (nome) => ref([...caminho, nome]),
    doc: (id) => ref([...caminho, id]),
    where: (campo, _op, valor) => ref(caminho, { campo, valor }),
    orderBy: () => ref(caminho, filtro),
    limit: () => ref(caminho, filtro),
    count: () => ({
      get: async () => {
        // artifacts/{academia}/public/data/{coleção}
        const [, academia, , , colecao] = caminho;
        const lista = colecao === 'stronix_users' ? (banco.equipe[academia] || []) : [];
        const n = filtro ? lista.filter((u) => u[filtro.campo] === filtro.valor).length : lista.length;
        return { data: () => ({ count: n }) };
      },
    }),
    get: async () => {
      if (caminho.length === 1 && caminho[0] === 'tenants') {
        return { docs: Object.entries(banco.tenants).map(([id, dados]) => ({ id, data: () => dados })) };
      }
      return { empty: true, docs: [] };
    },
  });
  return { adminDb: ref([]), verifyRequest: async () => ({ uid: 'super-1', superAdmin: true }) };
});
vi.mock('../_plans.js', () => ({ loadPlans: async () => new Map(), effectivePrice: precos.effectivePrice }));
vi.mock('../_asaas.js', () => ({ isAsaasConfigured: () => false }));
vi.mock('../_tenantPrivate.js', () => ({ readTenantPrivate: async () => ({ profile: null, responsiblePhone: '' }) }));

const resposta = () => ({
  statusCode: 0,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});
const consultar = async () => {
  const res = resposta();
  await handler({ method: 'GET', headers: { authorization: 'Bearer x' } }, res);
  return res;
};
const academia = (res, id) => res.body.tenants.find((t) => t.id === id);

describe('GET /api/super-overview: professores e módulos', () => {
  beforeEach(() => {
    banco.tenants = {};
    banco.equipe = {};
    precos.effectivePrice.mockReset();
    precos.effectivePrice.mockImplementation(({ consultantCount }) => 100 + consultantCount * 10);
  });

  it('professor fica fora dos consultores e do preço dos extras', async () => {
    banco.tenants['stronix-crm-app'] = { displayName: 'STRONIX', status: 'active', plan: 'starter', modules: ['faltosos'] };
    // Um gestor, dois consultores, um cadastro antigo sem papel (conta como
    // consultor) e dois professores.
    banco.equipe['stronix-crm-app'] = [
      { role: 'admin' }, { role: 'consultant' }, { role: 'consultant' }, {},
      { role: 'professor' }, { role: 'professor' },
    ];
    const res = await consultar();
    expect(res.statusCode).toBe(200);
    expect(academia(res, 'stronix-crm-app')).toMatchObject({
      userCount: 6, managerCount: 1, professorCount: 2, consultantCount: 3, price: 130,
    });
    expect(precos.effectivePrice).toHaveBeenCalledWith(expect.objectContaining({ consultantCount: 3 }), expect.any(Map));
  });

  it('academia sem professor: a conta de antes', async () => {
    banco.tenants['shape-one'] = { displayName: 'Shape One', status: 'active', plan: 'starter' };
    banco.equipe['shape-one'] = [{ role: 'admin' }, { role: 'consultant' }];
    const res = await consultar();
    expect(academia(res, 'shape-one')).toMatchObject({ userCount: 2, managerCount: 1, professorCount: 0, consultantCount: 1 });
  });

  it('os módulos vão normalizados para o console', async () => {
    banco.tenants['stronix-crm-app'] = { displayName: 'STRONIX', modules: ['catraca', 'faltosos', 'faltosos'] };
    banco.tenants['shape-one'] = { displayName: 'Shape One' };
    banco.tenants['power-club'] = { displayName: 'Power Club', modules: 'faltosos' };
    const res = await consultar();
    expect(academia(res, 'stronix-crm-app').modules).toEqual(['faltosos']);
    expect(academia(res, 'shape-one').modules).toEqual([]);
    expect(academia(res, 'power-club').modules).toEqual([]);
  });
});
