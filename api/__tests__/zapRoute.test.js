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
//
// Ele também recusa o que o Firestore real recusa: id de documento que não é
// texto, vazio ou com barra, e consulta `in` com 0 ou mais de 30 valores. O
// `select` devolve só os campos pedidos. Um fake mais tolerante que produção
// deixa passar exatamente o erro que importa. E tudo fica guardado por
// academia, para dar para provar que a chave de uma não lê a outra.
const banco = vi.hoisted(() => ({ tenants: {}, leads: {}, config: {}, gravacoes: [], falhaEm: null }));
// Quem está logado no CRM (verifyRequest) e se é admin (isTenantAdmin).
const sessao = vi.hoisted(() => ({ auth: null, admin: false }));

vi.mock('../_firebaseAdmin.js', () => {
  const snapshot = (dados) => ({ exists: dados != null, data: () => dados ?? undefined });

  const idValido = (id) => typeof id === 'string' && id.length > 0 && !id.includes('/');

  // `campos` imita o select(): o documento volta só com os campos pedidos.
  const consulta = (linhas, campos = null) => {
    const docs = linhas.map(({ id, ...dados }) => {
      const visiveis = campos ? Object.fromEntries(campos.map((c) => [c, dados[c]])) : dados;
      return { id, data: () => visiveis };
    });
    return { empty: docs.length === 0, docs };
  };

  const ref = (caminho) => ({
    collection: (nome) => ref([...caminho, nome]),
    doc: (id) => {
      if (!idValido(id)) throw new Error(`id de documento inválido: ${String(id)}`);
      return ref([...caminho, id]);
    },
    where: (campo, op, valor) => {
      const linhas = () => {
        // Simula a consulta recusada pelo Firestore (índice desligado no
        // console, por exemplo) só no campo que o teste pediu. Igual ao SDK de
        // servidor: código gRPC numérico (9 é FAILED_PRECONDITION) e o valor
        // da consulta dentro da mensagem.
        if (banco.falhaEm === campo) {
          throw Object.assign(new Error(`9 FAILED_PRECONDITION: consulta em ${campo} == ${valor} recusada`), { code: 9 });
        }
        if (op === 'in' && (!Array.isArray(valor) || valor.length === 0 || valor.length > 30)) {
          throw new Error(`consulta in com ${Array.isArray(valor) ? valor.length : 0} valores`);
        }
        const daAcademia = banco.leads[caminho[1]] ?? [];
        return daAcademia.filter((l) => (op === 'in' ? valor.includes(l[campo]) : l[campo] === valor));
      };
      return {
        limit: (n) => ({ get: async () => consulta(linhas().slice(0, n)) }),
        select: (...campos) => ({ get: async () => consulta(linhas(), campos) }),
        get: async () => consulta(linhas())
      };
    },
    get: async () => {
      if (caminho[0] === 'tenants') return snapshot(banco.tenants[caminho[1]]);
      if (caminho.at(-2) === 'stronix_config') return snapshot(banco.config[caminho[1]]);
      throw new Error(`caminho sem fixture no teste: ${caminho.join('/')}`);
    },
    set: async (dados, opcoes) => {
      banco.gravacoes.push({ caminho: caminho.join('/'), dados, opcoes });
    }
  });

  return {
    adminDb: ref([]),
    adminAuth: {},
    admin: { firestore: { FieldValue: { serverTimestamp: () => 'agora' } } },
    verifyRequest: async () => sessao.auth
  };
});

vi.mock('../_auth.js', () => ({
  isTenantAdmin: async () => sessao.admin
}));

const HOJE = new Date(2026, 8, 8, 10, 0);
const TENANT = 'academia-teste';
const OUTRA = 'academia-vizinha';
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

// Mãe de menores, sem cadastro próprio. Como o Zap manda o número dela.
const MAE = '5511912345678';
const guardiaoDaMae = { name: 'Maria Souza', phone: '(11) 9 1234-5678', relationship: 'Mãe' };
const menorDe = (id, name, extra = {}) => ({
  id,
  name,
  lifecycleStage: 'lead',
  status: 'Novo',
  isMinor: true,
  guardian: guardiaoDaMae,
  guardianZapMatchKey: zapMatchKey(MAE),
  birthDate: ts(new Date(2015, 4, 10)),
  createdAt: ts(new Date(2026, 7, 1)),
  ...extra
});

let chave;

function zerarBanco() {
  banco.tenants = {};
  banco.leads = {};
  banco.config = {};
  banco.gravacoes = [];
  banco.falhaEm = null;
  sessao.auth = null;
  sessao.admin = false;
}

// Cria a academia com uma chave gerada e devolve a chave em claro, do jeito
// que o Stronizap a guarda.
function academia(tenantId) {
  const gerada = generateZapKey();
  banco.tenants[tenantId] = {
    integrations: { zap: { keyHash: gerada.keyHash, keyPrefix: gerada.keyPrefix, revokedAt: null } }
  };
  banco.leads[tenantId] = [];
  return gerada.key;
}

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
    zerarBanco();
    chave = academia(TENANT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('contato cadastrado: devolve o cartão com os marcos da academia', async () => {
    banco.leads[TENANT] = [clienteAVencer];
    banco.config[TENANT] = { renewalCheckpoints: [45, 20] };
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
    banco.leads[TENANT] = [clienteAVencer];
    // banco.config[TENANT] não existe: o doc não existe e snap.exists é false.
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

  it('chave de uma academia não abre o cartão de outra', async () => {
    academia(OUTRA);
    banco.leads[OUTRA] = [clienteAVencer];
    const res = resposta();
    const p = pedido();
    p.query.tenant = OUTRA;

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.found).toBeUndefined();
  });

  it('identificador com barra no GET responde 401 sem chegar ao banco', async () => {
    const res = resposta();
    const p = pedido();
    p.query.tenant = 'academia/teste';

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Credencial inválida' });
  });

  it('identificador com maiúscula no GET responde 401 mesmo que a academia exista assim', async () => {
    const chaveDela = academia('Academia-Teste');
    banco.leads['Academia-Teste'] = [clienteAVencer];
    const res = resposta();
    const p = pedido();
    p.headers['x-stronizap-key'] = chaveDela;
    p.query.tenant = 'Academia-Teste';

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Credencial inválida' });
  });

  it('identificador de 64 caracteres é aceito no GET', async () => {
    const limite = 'a'.repeat(64);
    const chaveDela = academia(limite);
    banco.leads[limite] = [clienteAVencer];
    const res = resposta();
    const p = pedido();
    p.headers['x-stronizap-key'] = chaveDela;
    p.query.tenant = limite;

    await handler(p, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ found: true, leadId: 'c1' });
  });

  it('identificador repetido na query (a Vercel entrega lista) responde 401', async () => {
    const res = resposta();
    const p = pedido();
    p.query.tenant = [TENANT, OUTRA];

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Credencial inválida' });
  });

  it('identificador com espaço responde 401: não existe mais o .trim()', async () => {
    const res = resposta();
    const p = pedido();
    p.query.tenant = ' academia-teste ';

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Credencial inválida' });
  });

  const pedidoDaMae = () => { const p = pedido(); p.query.phone = MAE; return p; };

  it('mãe sem cadastro: cartão do tipo responsável com os dois filhos em ordem de nome', async () => {
    banco.leads[TENANT] = [menorDe('k1', 'Pedro Souza'), menorDe('k2', 'Ana Souza')];
    const res = resposta();
    await handler(pedidoDaMae(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ found: true, kind: 'responsavel', name: 'Maria Souza' });
    expect(Object.keys(res.body).sort()).toEqual(['found', 'kind', 'name', 'wards']);
    expect(res.body.wards.map((w) => w.name)).toEqual(['Ana Souza', 'Pedro Souza']);
    expect(res.body.wards[0]).toMatchObject({ kind: 'lead', relationship: 'Mãe' });
  });

  it('mãe que também é cliente: o cartão dela, com os filhos em wards', async () => {
    banco.leads[TENANT] = [{ ...clienteAVencer, zapMatchKey: zapMatchKey(MAE) }, menorDe('k1', 'Pedro Souza')];
    const res = resposta();
    await handler(pedidoDaMae(), res);
    expect(res.body).toMatchObject({ found: true, kind: 'cliente', leadId: 'c1' });
    expect(res.body.wards.map((w) => w.leadId)).toEqual(['k1']);
  });

  it('cartão sem filhos não ganha a chave wards', async () => {
    banco.leads[TENANT] = [clienteAVencer];
    const res = resposta();
    await handler(pedido(), res);
    expect('wards' in res.body).toBe(false);
  });

  it('quem fez 18 com WhatsApp próprio sai da lista; sem ninguém, found false', async () => {
    banco.leads[TENANT] = [menorDe('k1', 'Pedro Souza', { birthDate: ts(new Date(2008, 0, 1)), whatsapp: '(11) 9 5555-4444' })];
    const res = resposta();
    await handler(pedidoDaMae(), res);
    expect(res.body).toEqual({ found: false });
  });

  it('quem fez 18 sem WhatsApp próprio continua na lista', async () => {
    banco.leads[TENANT] = [menorDe('k1', 'Pedro Souza', { birthDate: ts(new Date(2008, 0, 1)) })];
    const res = resposta();
    await handler(pedidoDaMae(), res);
    expect(res.body.wards.map((w) => w.leadId)).toEqual(['k1']);
  });

  it('o próprio dono do número não aparece como filho dele mesmo', async () => {
    banco.leads[TENANT] = [menorDe('k1', 'Pedro Souza', { zapMatchKey: zapMatchKey(MAE) })];
    const res = resposta();
    await handler(pedidoDaMae(), res);
    expect(res.body).toMatchObject({ found: true, kind: 'lead', leadId: 'k1' });
    expect('wards' in res.body).toBe(false);
  });

  it('cartão só do responsável também sai com o cache privado de 2 minutos', async () => {
    banco.leads[TENANT] = [menorDe('k1', 'Pedro Souza')];
    const res = resposta();
    await handler(pedidoDaMae(), res);
    expect(res.body.kind).toBe('responsavel');
    expect(res.headers['cache-control']).toBe('private, max-age=120');
  });

  it('menor que já é cliente vem em wards com o cartão de cliente e o parentesco', async () => {
    // Contrato do clienteAVencer, sem o número próprio: quem responde é a mãe.
    banco.leads[TENANT] = [menorDe('k1', 'Pedro Souza', {
      ...clienteAVencer, id: 'k1', name: 'Pedro Souza', zapMatchKey: undefined, currentPlanName: 'Musculação Kids'
    })];
    const res = resposta();
    await handler(pedidoDaMae(), res);
    expect(res.body.kind).toBe('responsavel');
    const [pedro] = res.body.wards;
    expect(pedro).toMatchObject({ leadId: 'k1', kind: 'cliente', contractStatus: 'ativo', planName: 'Musculação Kids', relationship: 'Mãe' });
    expect(pedro).toHaveProperty('daysLeft');
    expect(pedro).toHaveProperty('contractEndsAt');
    expect('found' in pedro).toBe(false);
  });

  it('busca dos menores falhando não derruba o cartão do dono do número', async () => {
    banco.leads[TENANT] = [clienteAVencer, { ...menorDe('k1', 'Pedro Souza'), guardianZapMatchKey: zapMatchKey(TELEFONE) }];
    banco.falhaEm = 'guardianZapMatchKey';
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = resposta();
    await handler(pedido(), res);
    // Avisa que a busca falhou com o código do erro, e nada que leve o
    // telefone: nem a mensagem do Firestore, nem os dígitos.
    expect(erro).toHaveBeenCalledWith('zap: busca dos menores falhou', 9);
    const registrado = JSON.stringify(erro.mock.calls);
    expect(registrado).not.toContain(zapMatchKey(TELEFONE));
    expect(registrado).not.toContain(TELEFONE);
    erro.mockRestore();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ found: true, kind: 'cliente', leadId: 'c1' });
    expect('wards' in res.body).toBe(false);
  });

  it('nome do responsável vem do menor cadastrado por último', async () => {
    banco.leads[TENANT] = [
      menorDe('k1', 'Pedro Souza', { guardian: { ...guardiaoDaMae, name: 'Maria' }, createdAt: ts(new Date(2026, 5, 1)) }),
      menorDe('k2', 'Ana Souza', { guardian: { ...guardiaoDaMae, name: 'Maria Souza Lima' }, createdAt: ts(new Date(2026, 7, 20)) })
    ];
    const res = resposta();
    await handler(pedidoDaMae(), res);
    expect(res.body.name).toBe('Maria Souza Lima');
  });
});

describe('POST /api/zap com action match', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(HOJE);
    zerarBanco();
    chave = academia(TENANT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const pedidoMatch = (phones) => ({
    method: 'POST',
    headers: { 'x-stronizap-key': chave },
    body: { action: 'match', tenant: TENANT, phones }
  });

  it('devolve só os telefones que têm cadastro', async () => {
    banco.leads[TENANT] = [clienteAVencer];
    const res = resposta();

    await handler(pedidoMatch(['5511987654321', '5511900000000']), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ found: ['5511987654321'] });
  });

  it('casa com e sem o nono dígito, e devolve as duas formas', async () => {
    banco.leads[TENANT] = [clienteAVencer];
    const res = resposta();

    await handler(pedidoMatch(['5511987654321', '551187654321']), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.found.sort()).toEqual(['551187654321', '5511987654321']);
  });

  it('telefone curto demais volta como não encontrado, sem derrubar o lote', async () => {
    banco.leads[TENANT] = [clienteAVencer];
    const res = resposta();

    await handler(pedidoMatch(['123', '5511987654321']), res);

    expect(res.body).toEqual({ found: ['5511987654321'] });
  });

  it('telefone que não é texto é ignorado, sem derrubar o lote', async () => {
    banco.leads[TENANT] = [clienteAVencer];
    const res = resposta();

    await handler(pedidoMatch([{ toString: 1 }, '5511987654321']), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ found: ['5511987654321'] });
  });

  it('lote vazio responde lista vazia sem consultar os leads', async () => {
    // O banco falso lança erro com `in` vazio, como o Firestore real. Se a
    // trava da lista vazia sumir, este teste quebra.
    const res = resposta();

    await handler(pedidoMatch([]), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ found: [] });
  });

  it('lote só com telefones inválidos responde lista vazia sem consultar os leads', async () => {
    const res = resposta();

    await handler(pedidoMatch(['123', '']), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ found: [] });
  });

  it('lote de exatamente 30 é aceito', async () => {
    const res = resposta();
    const trinta = Array.from({ length: 30 }, (_, i) => `55119876543${String(i).padStart(2, '0')}`);

    await handler(pedidoMatch(trinta), res);

    expect(res.statusCode).toBe(200);
  });

  it('lote acima de 30 é recusado', async () => {
    const res = resposta();
    const muitos = Array.from({ length: 31 }, (_, i) => `55119876543${String(i).padStart(2, '0')}`);

    await handler(pedidoMatch(muitos), res);

    expect(res.statusCode).toBe(400);
  });

  it('phones que não é lista é recusado', async () => {
    const res = resposta();

    await handler(pedidoMatch('5511987654321'), res);

    expect(res.statusCode).toBe(400);
  });

  it('sem a chave do Zap responde 401', async () => {
    const res = resposta();
    const p = pedidoMatch(['5511987654321']);
    delete p.headers['x-stronizap-key'];

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Credencial ausente' });
  });

  it('login de admin sem a chave do Zap não serve para o match', async () => {
    sessao.auth = { uid: 'admin-1', tenantId: TENANT };
    sessao.admin = true;
    banco.leads[TENANT] = [clienteAVencer];
    const res = resposta();
    const p = pedidoMatch(['5511987654321']);
    delete p.headers['x-stronizap-key'];
    p.headers.authorization = 'Bearer token-de-admin';

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.found).toBeUndefined();
  });

  it('chave errada responde 401 e não devolve lista', async () => {
    banco.leads[TENANT] = [clienteAVencer];
    const res = resposta();
    const p = pedidoMatch(['5511987654321']);
    p.headers['x-stronizap-key'] = 'szk_chave_que_nao_existe';

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Credencial inválida' });
  });

  it('chave revogada responde 401', async () => {
    banco.tenants[TENANT].integrations.zap.revokedAt = new Date();
    const res = resposta();

    await handler(pedidoMatch(['5511987654321']), res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Credencial inválida' });
  });

  it('chave de uma academia não lê os leads de outra', async () => {
    academia(OUTRA);
    banco.leads[OUTRA] = [clienteAVencer];
    const res = resposta();
    const p = pedidoMatch(['5511987654321']);
    p.body.tenant = OUTRA;

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Credencial inválida' });
  });

  it('identificador que não é texto responde 401 sem derrubar a função', async () => {
    // O banco falso lança erro com id que não é texto, como o SDK real, então se a
    // checagem de tipo for para depois do acesso ao banco este teste quebra. A
    // mensagem exata prova que quem recusou foi o match, e não o caminho do admin.
    const res = resposta();
    const p = pedidoMatch(['5511987654321']);
    p.body.tenant = { toString: 1 };

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Credencial inválida' });
  });

  it('identificador com barra responde 401 sem chegar ao banco', async () => {
    const res = resposta();
    const p = pedidoMatch(['5511987654321']);
    p.body.tenant = 'academia/teste';

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Credencial inválida' });
  });

  it('identificador com maiúscula responde 401 mesmo que a academia exista assim', async () => {
    // O banco falso aceitaria "Academia-Teste". Quem recusa é a regra de formato.
    const chaveDela = academia('Academia-Teste');
    banco.leads['Academia-Teste'] = [clienteAVencer];
    const res = resposta();
    const p = pedidoMatch(['5511987654321']);
    p.headers['x-stronizap-key'] = chaveDela;
    p.body.tenant = 'Academia-Teste';

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Credencial inválida' });
  });

  it('identificador longo demais responde 401 mesmo que a academia exista assim', async () => {
    // 65 caracteres: o banco falso aceitaria. Quem recusa é o limite da regra de formato.
    const longo = 'a'.repeat(65);
    const chaveDela = academia(longo);
    banco.leads[longo] = [clienteAVencer];
    const res = resposta();
    const p = pedidoMatch(['5511987654321']);
    p.headers['x-stronizap-key'] = chaveDela;
    p.body.tenant = longo;

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Credencial inválida' });
  });

  it('identificador de 64 caracteres é aceito no match', async () => {
    const limite = 'a'.repeat(64);
    const chaveDela = academia(limite);
    banco.leads[limite] = [clienteAVencer];
    const res = resposta();
    const p = pedidoMatch(['5511987654321']);
    p.headers['x-stronizap-key'] = chaveDela;
    p.body.tenant = limite;

    await handler(p, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ found: ['5511987654321'] });
  });

  it('a resposta tem só a lista, sem nenhum outro campo', async () => {
    banco.leads[TENANT] = [clienteAVencer];
    const res = resposta();

    await handler(pedidoMatch(['5511987654321']), res);

    expect(Object.keys(res.body)).toEqual(['found']);
  });

  it('telefone de responsável de menor conta como encontrado', async () => {
    banco.leads[TENANT] = [menorDe('k1', 'Pedro Souza')];
    const res = resposta();
    await handler(pedidoMatch([MAE, '5511900000000']), res);
    expect(res.body).toEqual({ found: [MAE] });
  });

  it('responsável de quem fez 18 com WhatsApp próprio não conta', async () => {
    banco.leads[TENANT] = [menorDe('k1', 'Pedro Souza', { birthDate: ts(new Date(2008, 0, 1)), whatsapp: '(11) 9 5555-4444' })];
    const res = resposta();
    await handler(pedidoMatch([MAE]), res);
    expect(res.body).toEqual({ found: [] });
  });
});

describe('POST /api/zap com generate e revoke', () => {
  beforeEach(() => {
    zerarBanco();
    chave = academia(TENANT);
  });

  it.each(['generate', 'revoke'])('%s só com a chave do Zap é recusado e não grava nada', async (action) => {
    const res = resposta();

    await handler(
      { method: 'POST', headers: { 'x-stronizap-key': chave }, body: { action, tenant: TENANT } },
      res
    );

    expect(res.statusCode).toBe(401);
    expect(banco.gravacoes).toEqual([]);
  });

  it('generate com login de admin grava a chave nova', async () => {
    // Controle: prova que os dois testes de cima recusam pela autenticação, e
    // não porque o banco falso não sabe gravar.
    sessao.auth = { uid: 'admin-1', tenantId: TENANT };
    sessao.admin = true;
    const res = resposta();

    await handler(
      { method: 'POST', headers: { authorization: 'Bearer token-de-admin' }, body: { action: 'generate' } },
      res
    );

    expect(res.statusCode).toBe(200);
    expect(banco.gravacoes).toHaveLength(1);
    expect(banco.gravacoes[0].caminho).toBe(`tenants/${TENANT}`);
  });
});
