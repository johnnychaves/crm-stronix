// A última atividade e o total de interações de cada academia no console
// (api/super-overview.js): a linha de sinal da conversa pelo Stronizap não conta
// em nenhum dos dois. Sem isso, uma academia parada viraria "Ativa" porque um
// lead escreveu, e o total de interações cresceria sem ninguém registrar nada.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../super-overview.js';

const banco = vi.hoisted(() => ({ tenants: {}, interacoes: {} }));

vi.mock('../_firebaseAdmin.js', () => {
  const ts = (ms) => ({ toMillis: () => ms });
  // Consulta mínima do Firestore sobre artifacts/{academia}/public/data/{coleção}.
  const consulta = (caminho, estado = {}) => ({
    collection: (nome) => consulta([...caminho, nome]),
    doc: (id) => consulta([...caminho, id]),
    where: (campo, _op, valor) => consulta(caminho, { ...estado, filtro: { campo, valor } }),
    orderBy: () => consulta(caminho, { ...estado, ordenado: true }),
    limit: (n) => consulta(caminho, { ...estado, n }),
    startAfter: (doc) => consulta(caminho, { ...estado, depois: doc }),
    count: () => ({
      get: async () => {
        const lista = linhas(caminho).filter((l) => !estado.filtro || l[estado.filtro.campo] === estado.filtro.valor);
        return { data: () => ({ count: lista.length }) };
      },
    }),
    get: async () => {
      if (caminho.length === 1 && caminho[0] === 'tenants') {
        return { docs: Object.entries(banco.tenants).map(([id, dados]) => ({ id, data: () => ({ ...dados, createdAt: ts(dados.createdAt) }) })) };
      }
      let docs = linhas(caminho)
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((l, i) => ({ id: `${caminho[1]}-${i}`, data: () => ({ ...l, createdAt: ts(l.createdAt) }) }));
      if (estado.depois) docs = docs.slice(docs.findIndex((d) => d.id === estado.depois.id) + 1);
      if (estado.n) docs = docs.slice(0, estado.n);
      return { empty: docs.length === 0, docs };
    },
  });
  // artifacts/{academia}/public/data/{coleção}
  const linhas = (caminho) => (caminho[4] === 'stronix_interactions' ? (banco.interacoes[caminho[1]] || []) : []);
  return { adminDb: consulta([]), verifyRequest: async () => ({ uid: 'super-1', superAdmin: true }) };
});
vi.mock('../_plans.js', () => ({ loadPlans: async () => new Map(), effectivePrice: () => 0 }));
vi.mock('../_asaas.js', () => ({ isAsaasConfigured: () => false }));
vi.mock('../_tenantPrivate.js', () => ({ readTenantPrivate: async () => ({ profile: null, responsiblePhone: '' }) }));

const resposta = () => ({
  statusCode: 0,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});
const academia = async () => {
  const res = resposta();
  await handler({ method: 'GET', headers: { authorization: 'Bearer x' } }, res);
  expect(res.statusCode).toBe(200);
  return res.body.tenants.find((t) => t.id === 'gym');
};
const sinais = (n, aPartirDe) => Array.from({ length: n }, (_, i) => ({ type: 'zap_signal', createdAt: aPartirDe + i }));

beforeEach(() => {
  banco.tenants = { gym: { displayName: 'Gym', status: 'active', createdAt: 1000 } };
  banco.interacoes = {};
});

describe('GET /api/super-overview: interações e última atividade', () => {
  it('o total de interações não soma as linhas de sinal', async () => {
    banco.interacoes.gym = [
      { type: 'note', createdAt: 5000 }, { type: 'status_change', createdAt: 5001 }, { createdAt: 5002 },
      ...sinais(4, 9000),
    ];
    expect((await academia()).interactionCount).toBe(3);
  });

  it('a última atividade é a interação mais recente que não é sinal', async () => {
    banco.interacoes.gym = [{ type: 'note', createdAt: 5000 }, ...sinais(2, 9000)];
    expect((await academia()).lastActivityAt).toBe(5000);
  });

  it('acha a de quem atende atrás de várias páginas de sinais', async () => {
    banco.interacoes.gym = [{ type: 'note', createdAt: 5000 }, ...sinais(250, 9000)];
    expect((await academia()).lastActivityAt).toBe(5000);
  });

  it('só sinais: a academia fica com a data de criação, como sem interação', async () => {
    banco.interacoes.gym = sinais(50, 9000);
    const gym = await academia();
    expect(gym.lastActivityAt).toBe(1000);
    expect(gym.interactionCount).toBe(0);
  });

  it('sem nenhuma interação: a data de criação, como antes', async () => {
    expect((await academia()).lastActivityAt).toBe(1000);
  });

  it('com 1.000 sinais lidos sem achar uma de quem atende, usa a mais antiga lida', async () => {
    // 1.200 sinais, de 10000 a 11199: lidas as 1.000 mais novas, a mais antiga é 10200.
    banco.interacoes.gym = sinais(1200, 10000);
    expect((await academia()).lastActivityAt).toBe(10200);
  });
});
