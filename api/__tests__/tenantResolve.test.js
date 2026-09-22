import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../tenant-resolve.js';

// A leitura pública da marca da academia (GET /api/tenant-resolve?slug=).
// Palavra reservada (/pipeline, /api, /console) nunca é academia: a rota
// responde na hora, sem gastar o limitador por IP e sem ler o banco.

const banco = vi.hoisted(() => ({ tenants: {}, leituras: [] }));
const limitador = vi.hoisted(() => ({ chamadas: 0 }));

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
  return { adminDb: ref([]), adminAuth: {}, admin: {} };
});

vi.mock('../_rateLimit.js', () => ({
  checkRateLimit: async () => { limitador.chamadas += 1; return { ok: true }; },
  clientIp: () => '203.0.113.7',
}));

const pedido = (slug) => ({ method: 'GET', headers: {}, query: { slug } });
const resposta = () => ({
  statusCode: 0,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});

describe('GET /api/tenant-resolve', () => {
  beforeEach(() => {
    banco.tenants = { 'academia-teste': { displayName: 'Academia Teste' } };
    banco.leituras = [];
    limitador.chamadas = 0;
  });

  it('palavra reservada responde found false sem limitador e sem banco', async () => {
    for (const slug of ['pipeline', 'CONSOLE', 'api', 'super-admin']) {
      const res = resposta();
      await handler(pedido(slug), res);
      expect(res.statusCode, slug).toBe(200);
      expect(res.body, slug).toEqual({ found: false });
    }
    expect(limitador.chamadas).toBe(0);
    expect(banco.leituras).toEqual([]);
  });

  it('academia que existe continua devolvendo a marca', async () => {
    const res = resposta();
    await handler(pedido('academia-teste'), res);
    expect(res.body).toEqual({ found: true, tenantId: 'academia-teste', displayName: 'Academia Teste' });
    expect(limitador.chamadas).toBe(1);
    expect(banco.leituras).toEqual(['tenants/academia-teste']);
  });

  it('academia que não existe lê o banco e responde found false', async () => {
    const res = resposta();
    await handler(pedido('nao-existe'), res);
    expect(res.body).toEqual({ found: false });
    expect(banco.leituras).toEqual(['tenants/nao-existe']);
  });

  it('formato inválido continua 400', async () => {
    const res = resposta();
    await handler(pedido('Academia_Legada!'), res);
    expect(res.statusCode).toBe(400);
    expect(banco.leituras).toEqual([]);
  });
});
