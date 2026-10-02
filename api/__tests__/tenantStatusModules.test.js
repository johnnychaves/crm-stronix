// Módulos da academia pela api/tenant-status.js. O super-admin liga e desliga
// no console, a rota confere a lista contra src/lib/modules.js e grava em
// tenants/{id}.modules. O app lê o campo no login e as regras leem pela
// hasModule, então o que passa daqui é o que vale em todo lugar. O GET da
// mesma rota leva ao console os professores e os módulos das vagas.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../tenant-status.js';

const banco = vi.hoisted(() => ({ tenants: {}, gravacoes: [], auditoria: [], sessao: null, vagas: {} }));
const contas = vi.hoisted(() => ({ revokeRefreshTokens: vi.fn() }));

vi.mock('../_firebaseAdmin.js', () => {
  const ref = (caminho) => ({
    collection: (nome) => ref([...caminho, nome]),
    doc: (id) => ref([...caminho, id]),
    count: () => ({ get: async () => ({ data: () => ({ count: 0 }) }) }),
    get: async () => {
      const dados = caminho[0] === 'tenants' && caminho.length === 2 ? banco.tenants[caminho[1]] : undefined;
      return { id: caminho.at(-1), exists: dados != null, data: () => dados };
    },
    set: async (dados, opcoes) => { banco.gravacoes.push({ caminho: caminho.join('/'), dados, opcoes }); },
  });
  return {
    adminDb: ref([]),
    adminAuth: contas,
    admin: { firestore: { FieldValue: { serverTimestamp: () => 'agora', delete: () => 'apagar' } } },
    verifyRequest: async () => banco.sessao,
  };
});
vi.mock('../_audit.js', () => ({ logAudit: async (entrada) => { banco.auditoria.push(entrada); } }));
vi.mock('../_plans.js', () => ({ loadPlans: async () => new Map(), getSeatUsage: async () => banco.vagas }));
vi.mock('../_tenantPrivate.js', () => ({ writeTenantPrivate: async () => [] }));

const SUPER = { uid: 'super-1', superAdmin: true };
const resposta = () => ({
  statusCode: 0,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});
const enviar = async (body) => {
  const res = resposta();
  await handler({ method: 'POST', headers: { authorization: 'Bearer x' }, body }, res);
  return res;
};
const consultar = async (tenantId) => {
  const res = resposta();
  await handler({ method: 'GET', headers: { authorization: 'Bearer x' }, query: { tenantId } }, res);
  return res;
};
const gravado = () => banco.gravacoes.find((g) => g.caminho === 'tenants/stronix-crm-app')?.dados;
const RECUSA = 'Módulo inválido. Os módulos que existem são: faltosos.';

beforeEach(() => {
  banco.tenants = { 'stronix-crm-app': { displayName: 'STRONIX', status: 'active' } };
  banco.gravacoes = [];
  banco.auditoria = [];
  banco.sessao = SUPER;
  banco.vagas = {};
  contas.revokeRefreshTokens.mockReset();
});

describe('POST /api/tenant-status: módulos da academia', () => {
  it('liga o módulo: grava a lista em merge no documento da academia', async () => {
    const res = await enviar({ tenantId: 'stronix-crm-app', modules: ['faltosos'] });
    expect(res.statusCode).toBe(200);
    expect(banco.gravacoes).toHaveLength(1);
    expect(banco.gravacoes[0]).toMatchObject({ caminho: 'tenants/stronix-crm-app', opcoes: { merge: true } });
    expect(gravado().modules).toEqual(['faltosos']);
  });

  it('desliga com a lista vazia', async () => {
    banco.tenants['stronix-crm-app'].modules = ['faltosos'];
    const res = await enviar({ tenantId: 'stronix-crm-app', modules: [] });
    expect(res.statusCode).toBe(200);
    expect(gravado().modules).toEqual([]);
  });

  it('módulo repetido é gravado uma vez', async () => {
    const res = await enviar({ tenantId: 'stronix-crm-app', modules: ['faltosos', 'faltosos'] });
    expect(res.statusCode).toBe(200);
    expect(gravado().modules).toEqual(['faltosos']);
  });

  it('módulo desconhecido, caixa diferente ou item que não é texto: 400 e nada gravado', async () => {
    for (const modules of [['catraca'], ['Faltosos'], [' faltosos'], ['faltosos', 1], ['faltosos', null]]) {
      const res = await enviar({ tenantId: 'stronix-crm-app', modules });
      expect(res.statusCode, JSON.stringify(modules)).toBe(400);
      expect(res.body.error).toBe(RECUSA);
    }
    expect(banco.gravacoes).toEqual([]);
    expect(banco.auditoria).toEqual([]);
  });

  it('modules que não é lista: 400 e nada gravado', async () => {
    for (const modules of ['faltosos', null, { faltosos: true }, 1, true]) {
      const res = await enviar({ tenantId: 'stronix-crm-app', modules });
      expect(res.statusCode, JSON.stringify(modules)).toBe(400);
      expect(res.body.error).toBe(RECUSA);
    }
    expect(banco.gravacoes).toEqual([]);
  });

  it('só o super-admin liga módulo: o gestor da academia recebe 403', async () => {
    banco.sessao = { uid: 'gestor-1', tenantId: 'stronix-crm-app', superAdmin: false };
    const res = await enviar({ tenantId: 'stronix-crm-app', modules: ['faltosos'] });
    expect(res.statusCode).toBe(403);
    expect(banco.gravacoes).toEqual([]);
  });

  it('pedido sem modules não mexe no campo', async () => {
    banco.tenants['stronix-crm-app'].modules = ['faltosos'];
    const res = await enviar({ tenantId: 'stronix-crm-app', internal: true });
    expect(res.statusCode).toBe(200);
    expect('modules' in gravado()).toBe(false);
    expect(banco.auditoria[0].details).toEqual({ changed: ['internal'] });
  });

  it('a auditoria guarda a lista de antes e a de depois', async () => {
    banco.tenants['stronix-crm-app'].modules = ['faltosos'];
    await enviar({ tenantId: 'stronix-crm-app', modules: [] });
    expect(banco.auditoria).toHaveLength(1);
    expect(banco.auditoria[0]).toMatchObject({ action: 'tenant.update', tenantId: 'stronix-crm-app', actorUid: 'super-1' });
    expect(banco.auditoria[0].details).toEqual({ changed: ['modules'], modules: [], modulesBefore: ['faltosos'] });
  });

  it('ligar o módulo não derruba a sessão de ninguém', async () => {
    await enviar({ tenantId: 'stronix-crm-app', modules: ['faltosos'] });
    expect(contas.revokeRefreshTokens).not.toHaveBeenCalled();
  });
});

describe('GET /api/tenant-status: professores e módulos', () => {
  it('leva ao console os professores, fora das vagas, e os módulos', async () => {
    banco.vagas = {
      plan: 'starter', currentUsers: 6, maxUsers: 4, managers: 1, consultants: 3, professors: 2,
      modules: ['faltosos'], maxManagers: 1, maxConsultants: 3, extraConsultants: 0, extraUserPrice: null,
    };
    const res = await consultar('stronix-crm-app');
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ userCount: 6, managers: 1, consultants: 3, professors: 2, modules: ['faltosos'] });
  });

  it('vagas sem a contagem de professores e sem módulos: zero e lista vazia', async () => {
    banco.vagas = { plan: 'starter', currentUsers: 2, maxUsers: 4, managers: 1, consultants: 1 };
    const res = await consultar('stronix-crm-app');
    expect(res.statusCode).toBe(200);
    expect(res.body.professors).toBe(0);
    expect(res.body.modules).toEqual([]);
  });
});
