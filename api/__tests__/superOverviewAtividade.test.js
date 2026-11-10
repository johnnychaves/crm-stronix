// A última atividade e o total de interações de cada academia no console
// (api/super-overview.js): a linha de sinal da conversa pelo Stronizap não conta
// em nenhum dos dois. Sem isso, uma academia parada viraria "Ativa" porque um
// lead escreveu, e o total de interações cresceria sem ninguém registrar nada.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../super-overview.js';

const banco = vi.hoisted(() => ({ tenants: {}, interacoes: {}, filtros: [], leituras: [] }));

vi.mock('../_firebaseAdmin.js', () => {
  const ts = (ms) => ({ toMillis: () => ms });
  // Consulta mínima do Firestore sobre artifacts/{academia}/public/data/{coleção}.
  const consulta = (caminho, estado = {}) => ({
    collection: (nome) => consulta([...caminho, nome]),
    doc: (id) => consulta([...caminho, id]),
    where: (campo, _op, valor) => {
      banco.filtros.push(campo);
      return consulta(caminho, { ...estado, filtro: { campo, valor } });
    },
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
      if (caminho[4] === 'stronix_interactions') banco.leituras.push({ n: estado.n, depois: Boolean(estado.depois) });
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

const COM_ZAP = { zap: { keyHash: 'h' } };

beforeEach(() => {
  banco.tenants = { gym: { displayName: 'Gym', status: 'active', createdAt: 1000, integrations: COM_ZAP } };
  banco.interacoes = {};
  banco.filtros = [];
  banco.leituras = [];
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

  it('com mais de 1.000 sinais seguidos e nenhuma de quem atende, a academia fica com a data de criação, nunca a de um sinal', async () => {
    banco.interacoes.gym = sinais(1200, 10000);
    expect((await academia()).lastActivityAt).toBe(1000);
  });

  it('a academia que desconectou o Stronizap continua descontando os sinais antigos', async () => {
    banco.tenants.gym.integrations = { zap: { revokedAt: 7000 } };
    banco.interacoes.gym = [{ type: 'note', createdAt: 5000 }, ...sinais(3, 9000)];
    expect((await academia()).interactionCount).toBe(1);
  });
});

describe('GET /api/super-overview: academia sem Stronizap não paga a mais', () => {
  const humanas = [{ type: 'note', createdAt: 5000 }, { type: 'status_change', createdAt: 4000 }, { createdAt: 3000 }];

  it('sem integrations.zap não consulta o type e lê uma interação só para a última atividade', async () => {
    banco.tenants.gym = { displayName: 'Gym', status: 'active', createdAt: 1000 };
    banco.interacoes.gym = humanas;
    const gym = await academia();
    expect(gym).toMatchObject({ interactionCount: 3, lastActivityAt: 5000 });
    expect(banco.filtros).not.toContain('type');
    expect(banco.leituras).toEqual([{ n: 1, depois: false }]);
  });

  it('com sinais no topo dá o mesmo resultado que a mesma academia sem os sinais', async () => {
    banco.interacoes.gym = humanas;
    const semSinais = await academia();
    banco.interacoes.gym = [...humanas, ...sinais(130, 9000)];
    const comSinais = await academia();
    expect(comSinais.interactionCount).toBe(semSinais.interactionCount);
    expect(comSinais.lastActivityAt).toBe(semSinais.lastActivityAt);
  });
});
