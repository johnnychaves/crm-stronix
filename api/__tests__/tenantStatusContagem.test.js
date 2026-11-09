// O total de interações da organização no GET de api/tenant-status.js não soma a
// linha de sinal da conversa pelo Stronizap (type zap_signal).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../tenant-status.js';

const banco = vi.hoisted(() => ({ interacoes: [], contagemDeSinaisFalha: false }));

vi.mock('../_firebaseAdmin.js', () => {
  const consulta = (caminho, filtro = null) => ({
    collection: (nome) => consulta([...caminho, nome]),
    doc: (id) => consulta([...caminho, id]),
    where: (campo, _op, valor) => consulta(caminho, { campo, valor }),
    count: () => ({
      get: async () => {
        if (filtro && banco.contagemDeSinaisFalha) throw new Error('sem índice');
        const lista = caminho.at(-1) === 'stronix_interactions' ? banco.interacoes : [];
        const n = filtro ? lista.filter((l) => l[filtro.campo] === filtro.valor).length : lista.length;
        return { data: () => ({ count: n }) };
      },
    }),
  });
  return {
    adminDb: consulta([]),
    adminAuth: {},
    admin: { firestore: { FieldValue: {} } },
    verifyRequest: async () => ({ uid: 'super-1', superAdmin: true }),
  };
});
vi.mock('../_audit.js', () => ({ logAudit: async () => {} }));
vi.mock('../_plans.js', () => ({ loadPlans: async () => new Map(), getSeatUsage: async () => ({ plan: 'starter' }) }));
vi.mock('../_tenantPrivate.js', () => ({ writeTenantPrivate: async () => [] }));

const resposta = () => ({
  statusCode: 0,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});
const consultar = async () => {
  const res = resposta();
  await handler({ method: 'GET', headers: { authorization: 'Bearer x' }, query: { tenantId: 'gym' } }, res);
  return res;
};

beforeEach(() => {
  banco.interacoes = [{ type: 'note' }, { type: 'status_change' }, { type: 'zap_signal' }, { type: 'zap_signal' }, {}];
  banco.contagemDeSinaisFalha = false;
});

describe('GET /api/tenant-status: total de interações', () => {
  it('não soma as linhas de sinal', async () => {
    const res = await consultar();
    expect(res.statusCode).toBe(200);
    expect(res.body.interactionCount).toBe(3);
  });

  it('se a contagem dos sinais falhar, devolve o total sem quebrar', async () => {
    banco.contagemDeSinaisFalha = true;
    const res = await consultar();
    expect(res.statusCode).toBe(200);
    expect(res.body.interactionCount).toBe(5);
  });
});
