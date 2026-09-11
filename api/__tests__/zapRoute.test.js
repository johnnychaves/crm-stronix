import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateZapKey } from '../_zapAuth.js';
import { zapMatchKey } from '../_zapPhone.js';
import handler from '../zap.js';

// A rota inteira, com o Firestore trocado por um banco em memória.
//
// O banco falso imita o SDK de SERVIDOR (firebase-admin), não o do navegador:
// aqui `snap.exists` é propriedade booleana, e chamar `snap.exists()` estoura
// TypeError, igual em produção. Em src/ é o contrário (`exists()` é função),
// e foi essa troca que derrubou o cartão do Zap em 2026-09-10 para todo
// contato cadastrado. Um fake com `exists` como função teria aprovado o erro.
const banco = vi.hoisted(() => ({ tenant: null, leads: [], config: null }));

vi.mock('../_firebaseAdmin.js', () => {
  const snapshot = (dados) => ({ exists: dados != null, data: () => dados ?? undefined });

  const ref = (caminho) => ({
    collection: (nome) => ref([...caminho, nome]),
    doc: (id) => ref([...caminho, id]),
    where: (campo, _op, valor) => ({
      limit: (n) => ({
        get: async () => {
          const docs = banco.leads
            .filter((l) => l[campo] === valor)
            .slice(0, n)
            .map(({ id, ...dados }) => ({ id, data: () => dados }));
          return { empty: docs.length === 0, docs };
        }
      })
    }),
    get: async () => {
      if (caminho[0] === 'tenants') return snapshot(banco.tenant);
      if (caminho.at(-2) === 'stronix_config') return snapshot(banco.config);
      throw new Error(`caminho sem fixture no teste: ${caminho.join('/')}`);
    }
  });

  return {
    adminDb: ref([]),
    adminAuth: {},
    admin: { firestore: { FieldValue: { serverTimestamp: () => 'agora' } } },
    verifyRequest: async () => null
  };
});

const HOJE = new Date(2026, 8, 8, 10, 0);
const TENANT = 'academia-teste';
// Como o Zap manda: com 55 e com o nono dígito.
const TELEFONE = '5511987654321';
// Timestamp do Firestore: a rota converte com toDate().
const ts = (d) => ({ toDate: () => d });

// Mesmo cliente do zapCard.test.js: o contrato vence 45 dias depois de HOJE.
// Com os marcos da academia (45 e 20) a faixa diz 45 dias. No padrão 90/60/30
// diria outra coisa, e é essa diferença que prova que a rota leu a config.
const clienteAVencer = {
  id: 'c1',
  name: 'Cliente Teste',
  lifecycleStage: 'cliente',
  currentContractStatus: 'ativo',
  currentContractStartsAt: ts(new Date(2025, 8, 8)),
  currentContractEndsAt: ts(new Date(2026, 9, 23)),
  zapMatchKey: zapMatchKey(TELEFONE)
};

let chave;

const pedido = () => ({
  method: 'GET',
  headers: { 'x-stronizap-key': chave },
  query: { tenant: TENANT, phone: TELEFONE }
});

const resposta = () => ({
  statusCode: 0,
  body: undefined,
  headers: {},
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
  setHeader(k, v) { this.headers[k.toLowerCase()] = v; }
});

describe('GET /api/zap', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(HOJE);
    const gerada = generateZapKey();
    chave = gerada.key;
    banco.tenant = {
      integrations: { zap: { keyHash: gerada.keyHash, keyPrefix: gerada.keyPrefix, revokedAt: null } }
    };
    banco.leads = [];
    banco.config = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('contato cadastrado: devolve o cartão com os marcos da academia', async () => {
    banco.leads = [clienteAVencer];
    banco.config = { renewalCheckpoints: [45, 20] };
    const res = resposta();

    await handler(pedido(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      found: true,
      leadId: 'c1',
      kind: 'cliente',
      strip: { kind: 'renovacao', tone: 'avencer', text: 'Marco de renovação · 45 dias' }
    });
  });

  it('contato cadastrado em academia que nunca salvou os marcos: devolve o cartão', async () => {
    banco.leads = [clienteAVencer];
    // banco.config continua null: o doc não existe e snap.exists é false.
    const res = resposta();

    await handler(pedido(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ found: true, leadId: 'c1' });
    expect(res.body.strip?.text).not.toBe('Marco de renovação · 45 dias');
  });

  it('contato sem cadastro: devolve found false', async () => {
    const res = resposta();

    await handler(pedido(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ found: false });
  });
});
