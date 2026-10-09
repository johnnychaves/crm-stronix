import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../tenant-resolve.js';

// A leitura pública da marca da academia (GET /api/tenant-resolve?slug=).
// Palavra reservada (/pipeline, /api, /console) nunca é academia: a rota
// responde na hora, sem gastar o limitador por IP e sem ler o banco.

const banco = vi.hoisted(() => ({ tenants: {}, leituras: [], colecoes: {}, adicionados: [] }));
const limitador = vi.hoisted(() => ({ chamadas: 0 }));

// `colecoes` guarda as listas por caminho ('artifacts/<academia>/public/data/
// stronix_leads'), para a indicação pública achar o indicador e o duplicado.
vi.mock('../_firebaseAdmin.js', () => {
  const lista = (caminho) => banco.colecoes[caminho.join('/')] ?? [];
  const ref = (caminho) => ({
    collection: (nome) => ref([...caminho, nome]),
    doc: (id) => ref([...caminho, id]),
    get: async () => {
      banco.leituras.push(caminho.join('/'));
      const dados = caminho[0] === 'tenants'
        ? banco.tenants[caminho[1]]
        : (() => { const l = lista(caminho.slice(0, -1)).find((x) => x.id === caminho.at(-1)); return l ? { ...l } : undefined; })();
      return { id: caminho.at(-1), exists: dados != null, data: () => dados };
    },
    where: (campo, op, valor) => ({
      limit: () => ({
        get: async () => {
          const docs = lista(caminho).filter((l) => l[campo] === valor).map((l) => ({ id: l.id, data: () => ({ ...l }) }));
          return { empty: docs.length === 0, docs };
        },
      }),
    }),
    add: async (dados) => { banco.adicionados.push({ caminho: caminho.join('/'), dados }); return { id: 'nova' }; },
  });
  return { adminDb: ref([]), adminAuth: {}, admin: { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } } };
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

// A página pública de indicação procura o duplicado pela chave do telefone
// (zapMatchKey), como o Novo lead e o Stronizap. Antes procurava pelos dígitos
// exatos, e quem já era lead entrava de novo digitando o número sem o nono
// dígito.
describe('POST /api/tenant-resolve com referral-signup', () => {
  const LEADS = 'artifacts/academia-teste/public/data/stronix_leads';
  const INTERACOES = 'artifacts/academia-teste/public/data/stronix_interactions';
  const indicacao = (whatsapp) => ({
    method: 'POST', headers: {},
    body: { action: 'referral-signup', slug: 'academia-teste', ref: 'cliente-1', name: 'Gabriel Leão', whatsapp },
  });

  beforeEach(() => {
    banco.tenants = { 'academia-teste': { displayName: 'Academia Teste' } };
    banco.leituras = [];
    banco.adicionados = [];
    banco.colecoes = {
      [LEADS]: [
        { id: 'cliente-1', name: 'Joana Prado', lifecycleBucket: 'cliente', consultantId: 'u1' },
        { id: 'gabriel', name: 'Gabriel', whatsapp: '(31) 9 7198-3969', whatsappDigits: '31971983969', zapMatchKey: '3171983969', consultantId: 'u2' },
      ],
    };
  });

  it.each([
    ['sem o nono dígito', '(31) 7198-3969'],
    ['com 55 na frente', '+55 31 97198-3969'],
  ])('quem já é lead e digita o número %s não vira lead novo', async (_, whatsapp) => {
    const res = resposta();
    await handler(indicacao(whatsapp), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, firstName: 'Gabriel' });
    // A tentativa vai para a linha do tempo do lead que já existe.
    expect(banco.adicionados).toEqual([
      expect.objectContaining({ caminho: INTERACOES, dados: expect.objectContaining({ leadId: 'gabriel', type: 'referral' }) }),
    ]);
  });
});
