import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';

// A rota roda numa função da Vercel, com o processo em UTC (lá o TZ é variável
// reservada). A máquina de desenvolvimento fica em Brasília, e teste no fuso
// dela esconde defeito de fuso. Por isso o processo vai para UTC antes de
// importar a rota, como em zapFuso.test.js (PR #227).
const fusoDaMaquina = vi.hoisted(() => {
  const antes = process.env.TZ;
  process.env.TZ = 'UTC';
  return antes;
});

import { generateZapKey } from '../_zapAuth.js';
import { zapMatchKey } from '../_zapPhone.js';
import handler from '../zap.js';
import { buildNewLeadDoc } from '../../src/lib/newLead.js';
import { buildNotificationFeed } from '../../src/lib/notifications.js';

// A rota inteira, com o Firestore trocado por um banco em memória.
//
// O banco falso imita o SDK de SERVIDOR (firebase-admin), não o do navegador:
// aqui `snap.exists` é propriedade booleana, e chamar `snap.exists()` estoura
// TypeError, igual em produção. Em src/ é o contrário (`exists()` é função),
// e foi essa troca que derrubou o cartão do Zap em 2026-09-10 para todo
// contato cadastrado. Um fake com `exists` como função teria aprovado o erro.
//
// Ele também recusa o que o Firestore real recusa: id de documento que não é
// texto, vazio ou com barra, consulta `in` com 0 ou mais de 30 valores,
// leitura depois de escrita dentro da transação, create de documento que já
// existe e update de documento que não existe. O `select` devolve só os
// campos pedidos, e o increment soma no valor gravado. Um fake mais tolerante
// que produção deixa passar exatamente o erro que importa. E tudo fica
// guardado por academia, para dar para provar que a chave de uma não lê a
// outra.
const banco = vi.hoisted(() => ({
  tenants: {}, leads: {}, config: {}, users: {}, catalogos: {}, interacoes: {}, aulas: {},
  gravacoes: [], falhaEm: null, ultimoId: 0
}));
// Quem está logado no CRM (verifyRequest), se é admin (isTenantAdmin) e
// quantas vezes o caminho do login foi consultado.
const sessao = vi.hoisted(() => ({ auth: null, admin: false, consultasDoLogin: 0 }));
// O limitador por academia (api/_rateLimit.js): o que ele responde e com que
// chave foi chamado.
const limitador = vi.hoisted(() => ({ ok: true, chamadas: [] }));

vi.mock('../_firebaseAdmin.js', () => {
  // Hora do servidor. Na gravação vira um Timestamp falso, com toDate(), como
  // o documento volta do Firestore depois do commit. O increment soma no valor
  // que o documento já tinha (campo ausente conta como zero).
  const HORA_DO_SERVIDOR = Object.freeze({ horaDoServidor: true });
  const incremento = (n) => Object.freeze({ incremento: n });
  const gravado = (dados, anterior = {}) => {
    const instante = new Date();
    return Object.fromEntries(Object.entries(dados).map(([k, v]) => {
      if (v === HORA_DO_SERVIDOR) return [k, { toDate: () => instante }];
      if (v && typeof v === 'object' && 'incremento' in v) return [k, (Number(anterior[k]) || 0) + v.incremento];
      return [k, v];
    }));
  };

  const snapshot = (id, dados) => ({ id, exists: dados != null, data: () => dados ?? undefined });

  const idValido = (id) => typeof id === 'string' && id.length > 0 && !id.includes('/');

  // A lista em memória de cada coleção da academia
  // (artifacts/{academia}/public/data/{coleção}).
  const LISTAS = {
    stronix_leads: 'leads', stronix_users: 'users', stronix_interactions: 'interacoes', stronix_aulas: 'aulas'
  };
  const CATALOGOS = [
    'stronix_sources', 'stronix_dores', 'stronix_modalities', 'stronix_funnels', 'stronix_statuses',
    'stronix_units', 'stronix_professores'
  ];
  const listaDe = (caminho, criar = false) => {
    const [raiz, academia, , , nome] = caminho;
    if (raiz === 'artifacts' && caminho.length === 5) {
      if (LISTAS[nome]) {
        const porAcademia = banco[LISTAS[nome]];
        if (criar && !porAcademia[academia]) porAcademia[academia] = [];
        return porAcademia[academia] ?? [];
      }
      if (CATALOGOS.includes(nome)) return banco.catalogos[academia]?.[nome] ?? [];
    }
    throw new Error(`coleção sem fixture no teste: ${caminho.join('/')}`);
  };

  // `campos` imita o select(): o documento volta só com os campos pedidos.
  const consulta = (linhas, campos = null) => {
    const docs = linhas.map(({ id, ...dados }) => {
      const visiveis = campos ? Object.fromEntries(campos.map((c) => [c, dados[c]])) : dados;
      return { id, data: () => visiveis };
    });
    return { empty: docs.length === 0, docs };
  };

  const documento = (caminho) => {
    if (caminho[0] === 'tenants') return snapshot(caminho[1], banco.tenants[caminho[1]]);
    if (caminho.at(-2) === 'stronix_config') return snapshot(caminho.at(-1), banco.config[caminho[1]]);
    // Um documento de lista (lead, registro de aulas...) pelo id. `falhaEm:
    // 'documento'` simula a leitura recusada (Firestore fora do ar, por
    // exemplo), com o caminho dentro da mensagem, como o SDK faz.
    if (caminho[0] === 'artifacts' && caminho.length === 6 && LISTAS[caminho[4]]) {
      if (banco.falhaEm === 'documento') {
        throw Object.assign(new Error(`14 UNAVAILABLE: leitura de ${caminho.join('/')} falhou`), { code: 14 });
      }
      const linha = listaDe(caminho.slice(0, 5)).find((l) => l.id === caminho[5]);
      if (!linha) return snapshot(caminho[5], null);
      const { id, ...dados } = linha;
      return snapshot(id, dados);
    }
    throw new Error(`caminho sem fixture no teste: ${caminho.join('/')}`);
  };

  // Escritas da transação. create recusa documento que já existe e update
  // recusa documento que não existe, como o Firestore.
  const existe = (caminho) => listaDe(caminho.slice(0, -1)).some((l) => l.id === caminho.at(-1));
  const conferir = ({ tipo, caminho }) => {
    if (tipo === 'create' && existe(caminho)) throw Object.assign(new Error('6 ALREADY_EXISTS'), { code: 6 });
    if (tipo === 'update' && !existe(caminho)) throw Object.assign(new Error('5 NOT_FOUND'), { code: 5 });
  };
  const aplicar = ({ tipo, caminho, dados }) => {
    const lista = listaDe(caminho.slice(0, -1), true);
    const id = caminho.at(-1);
    const i = lista.findIndex((l) => l.id === id);
    if (tipo === 'update') lista[i] = { ...lista[i], ...gravado(dados, lista[i]) };
    else if (i >= 0) lista[i] = { id, ...gravado(dados) };
    else lista.push({ id, ...gravado(dados) });
    banco.gravacoes.push({ caminho: caminho.join('/'), dados, tipo });
  };

  const ref = (caminho) => ({
    id: caminho.at(-1),
    caminho,
    collection: (nome) => ref([...caminho, nome]),
    // Sem argumento, o id é gerado, como o doc() do SDK.
    doc: (...args) => {
      if (args.length === 0) {
        banco.ultimoId += 1;
        return ref([...caminho, `auto-${banco.ultimoId}`]);
      }
      const [id] = args;
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
        return listaDe(caminho).filter((l) => (op === 'in' ? valor.includes(l[campo]) : l[campo] === valor));
      };
      return {
        limit: (n) => ({ get: async () => consulta(linhas().slice(0, n)) }),
        select: (...campos) => ({ get: async () => consulta(linhas(), campos) }),
        get: async () => consulta(linhas())
      };
    },
    // Coleção (caminho de tamanho ímpar) devolve a lista; documento, o snapshot.
    get: async () => (caminho.length % 2 === 1 ? consulta(listaDe(caminho)) : documento(caminho)),
    set: async (dados, opcoes) => {
      banco.gravacoes.push({ caminho: caminho.join('/'), dados, opcoes });
    }
  });

  // Uma transação de cada vez, em fila: é o efeito do isolamento serializável
  // do Firestore. As escritas só valem juntas, no fim, e só se nenhuma for
  // recusada. Não existe `add` numa transação: o documento novo sai de
  // collection.doc() e é gravado com create.
  let fila = Promise.resolve();
  const runTransaction = (fn) => {
    const vez = fila.then(async () => {
      const escritas = [];
      const tx = {};
      const escrever = (tipo) => (alvo, dados) => { escritas.push({ tipo, caminho: alvo.caminho, dados }); return tx; };
      Object.assign(tx, {
        get: async (alvo) => {
          if (escritas.length > 0) throw new Error('Firestore transactions require all reads to be executed before all writes.');
          return alvo.get();
        },
        create: escrever('create'),
        set: escrever('set'),
        update: escrever('update')
      });
      const resultado = await fn(tx);
      escritas.forEach(conferir);
      escritas.forEach(aplicar);
      return resultado;
    });
    fila = vez.catch(() => {});
    return vez;
  };

  const adminDb = ref([]);
  adminDb.runTransaction = runTransaction;

  return {
    adminDb,
    adminAuth: {},
    admin: { firestore: { FieldValue: { serverTimestamp: () => HORA_DO_SERVIDOR, increment: incremento } } },
    verifyRequest: async () => {
      sessao.consultasDoLogin += 1;
      return sessao.auth;
    }
  };
});

vi.mock('../_auth.js', () => ({
  isTenantAdmin: async () => sessao.admin
}));

vi.mock('../_rateLimit.js', () => ({
  checkRateLimit: async (chave, opcoes) => {
    limitador.chamadas.push({ chave, opcoes });
    return limitador.ok ? { ok: true } : { ok: false, retryAfterMs: 60000 };
  },
  clientIp: () => '127.0.0.1'
}));

afterAll(() => {
  if (fusoDaMaquina === undefined) delete process.env.TZ;
  else process.env.TZ = fusoDaMaquina;
});

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

// Equipe da academia, como mora em stronix_users. O id é o do documento.
const ANA = { id: 'u-ana', name: 'Ana Souza', email: 'ana@stronix.com.br', authUid: 'auth-ana', role: 'consultant' };
const BRUNO = { id: 'u-bruno', name: 'Bruno Lima', email: 'bruno@stronix.com.br', authUid: 'auth-bruno', role: 'consultant' };
const JOHNNY = { id: 'u-johnny', name: 'Johnny', email: 'johnny@stronix.com.br', authUid: 'auth-johnny', role: 'admin' };
// Convidada que nunca entrou no Stronilead: está na equipe, mas sem authUid.
const BIA = { id: 'u-bia', name: 'Bia Rocha', email: 'bia@stronix.com.br', role: 'consultant' };

// Catálogos da academia, no formato dos documentos. Função, porque os testes
// mexem neles.
const catalogosDaAcademia = () => ({
  stronix_sources: [{ id: 's1', name: 'Instagram' }, { id: 's2', name: 'WhatsApp' }, { id: 's3', name: 'Indicação' }],
  stronix_dores: [{ id: 'd1', name: 'Postura' }, { id: 'd2', name: 'Emagrecimento' }],
  stronix_modalities: [{ id: 'm2', name: 'Pilates', order: 2 }, { id: 'm1', name: 'Musculação', order: 1 }],
  stronix_funnels: [
    { id: 'f-com', name: 'Comercial', order: 1, isDefault: true },
    { id: 'f-kids', name: 'Kids', order: 2 },
    { id: 'f-vazio', name: 'Sem etapas', order: 3 },
    { id: 'f-ind', name: 'Indicações', order: 97, systemKind: 'referral' },
    { id: 'f-ren', name: 'Renovações', order: 98, systemKind: 'renewal' },
    { id: 'f-venc', name: 'Vencidos', order: 99, systemKind: 'expired' },
    { id: 'f-up', name: 'Upgrade', order: 100, systemKind: 'upgrade' }
  ],
  stronix_statuses: [
    { id: 'st2', funnelId: 'f-com', name: 'Primeiro contato', order: 2 },
    { id: 'st1', funnelId: 'f-com', name: 'Novo lead', order: 1 },
    { id: 'st3', funnelId: 'f-kids', name: 'Interesse', order: 1 },
    { id: 'st4', funnelId: 'f-ind', name: 'Aguardando ação', order: 1, isEntry: true },
    { id: 'st5', funnelId: 'f-venc', name: 'Aguardando contato', order: 1 }
  ],
  // Do agendamento: a Zona Sul sem endereço e a Paula desligada.
  stronix_units: [
    { id: 'un2', name: 'Zona Sul', address: '', order: 2 },
    { id: 'un1', name: 'Centro', address: 'Rua Garibaldi, 1200', order: 1 }
  ],
  stronix_professores: [
    { id: 'p1', nome: 'Carla Dias', modalidadeIds: ['m2'], order: 1 },
    { id: 'p2', nome: 'Rafael Moura', modalidadeIds: ['m2', 'm1'], order: 2 },
    { id: 'p3', nome: 'Paula Reis', modalidadeIds: ['m2'], ativo: false, order: 3 }
  ]
});

let chave;

function zerarBanco() {
  banco.tenants = {};
  banco.leads = {};
  banco.config = {};
  banco.users = {};
  banco.catalogos = {};
  banco.interacoes = {};
  banco.aulas = {};
  banco.gravacoes = [];
  banco.falhaEm = null;
  banco.ultimoId = 0;
  sessao.auth = null;
  sessao.admin = false;
  sessao.consultasDoLogin = 0;
  limitador.ok = true;
  limitador.chamadas = [];
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

// Academia com chave, equipe e catálogos: o cenário do cadastro pelo Stronizap.
function academiaComEquipe() {
  chave = academia(TENANT);
  banco.users[TENANT] = [ANA, BRUNO, JOHNNY, BIA];
  banco.catalogos[TENANT] = catalogosDaAcademia();
}

const pedidoOpcoes = (email = ANA.email) => ({
  method: 'POST',
  headers: { 'x-stronizap-key': chave },
  body: { action: 'lead-options', tenant: TENANT, actor: { email } }
});

// Mariana escreveu do WhatsApp e ainda não tem cadastro. Como o Zap manda.
const MARIANA = '5551998124471';
// Timestamp que o banco falso grava no lugar da hora do servidor.
const HORA = expect.objectContaining({ toDate: expect.any(Function) });

// Pedido de cadastro da Ana. `lead` mexe nos campos do lead; o resto troca
// campos do corpo (phone, actor, channelName).
const pedidoCadastro = ({ lead = {}, ...extra } = {}) => ({
  method: 'POST',
  headers: { 'x-stronizap-key': chave },
  body: {
    action: 'create-lead',
    tenant: TENANT,
    phone: MARIANA,
    actor: { email: ANA.email, name: 'Ana' },
    channelName: 'Recepção',
    lead: {
      name: 'Mariana Souza', source: 'WhatsApp', dor: 'Postura', modalidade: 'Pilates',
      funnelId: 'f-com', stage: 'Novo lead', ownerId: null, minor: null, ...lead
    },
    ...extra
  }
});

const leadsDaAcademia = () => banco.leads[TENANT] ?? [];
const marcosDaAcademia = () => banco.interacoes[TENANT] ?? [];

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

describe('processo em UTC, como a função da Vercel', () => {
  it('o fuso do processo é UTC de verdade', () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(0);
  });
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

  it('busca dos responsáveis falhando não derruba o lote: dono do número continua encontrado', async () => {
    banco.leads[TENANT] = [clienteAVencer, menorDe('k1', 'Pedro Souza')];
    banco.falhaEm = 'guardianZapMatchKey';
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = resposta();

    await handler(pedidoMatch([TELEFONE, MAE]), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ found: [TELEFONE] });
    expect(erro).toHaveBeenCalledWith('zap: busca dos responsáveis no match falhou', 9);
    const registrado = JSON.stringify(erro.mock.calls);
    expect(registrado).not.toContain(MAE);
    expect(registrado).not.toContain(TELEFONE);
    erro.mockRestore();
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

describe('POST /api/zap com action lead-options', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(HOJE);
    zerarBanco();
    academiaComEquipe();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('consultora: quem ela é, as listas da academia e o padrão do Novo lead, sem a equipe', async () => {
    const res = resposta();

    await handler(pedidoOpcoes(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      actor: { id: 'u-ana', name: 'Ana Souza', role: 'consultor' },
      sources: [{ name: 'Indicação' }, { name: 'Instagram' }, { name: 'WhatsApp' }],
      dores: [{ name: 'Emagrecimento' }, { name: 'Postura' }],
      modalities: [{ name: 'Musculação' }, { name: 'Pilates' }],
      funnels: [
        { id: 'f-com', name: 'Comercial', stages: [{ name: 'Novo lead' }, { name: 'Primeiro contato' }] },
        { id: 'f-kids', name: 'Kids', stages: [{ name: 'Interesse' }] }
      ],
      relationships: ['Mãe', 'Pai', 'Avó', 'Avô', 'Tia', 'Tio', 'Outro'],
      defaults: { source: 'WhatsApp', funnelId: 'f-com', stage: 'Novo lead' }
    });
    expect('team' in res.body).toBe(false);
    // Opções só leem: não gastam o limite de cadastros nem gravam nada.
    expect(limitador.chamadas).toEqual([]);
    expect(banco.gravacoes).toEqual([]);
  });

  it('gestor: recebe a equipe com id e nome, sem e-mail e sem quem nunca entrou', async () => {
    const res = resposta();

    await handler(pedidoOpcoes(JOHNNY.email), res);

    expect(res.body.actor).toEqual({ id: 'u-johnny', name: 'Johnny', role: 'gestor' });
    expect(res.body.team).toEqual([
      { id: 'u-ana', name: 'Ana Souza' },
      { id: 'u-bruno', name: 'Bruno Lima' },
      { id: 'u-johnny', name: 'Johnny' }
    ]);
    expect(JSON.stringify(res.body)).not.toContain('@');
  });

  it('e-mail com maiúsculas e espaços acha a pessoa', async () => {
    const res = resposta();

    await handler(pedidoOpcoes('  ANA@Stronix.com.br '), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.actor.id).toBe('u-ana');
  });

  it('item novo no catálogo aparece no pedido seguinte', async () => {
    banco.catalogos[TENANT].stronix_dores.push({ id: 'd3', name: 'Ansiedade' });
    const res = resposta();

    await handler(pedidoOpcoes(), res);

    expect(res.body.dores).toEqual([{ name: 'Ansiedade' }, { name: 'Emagrecimento' }, { name: 'Postura' }]);
  });

  it('pessoa fora da equipe recebe o aviso com o e-mail dela', async () => {
    const res = resposta();

    await handler(pedidoOpcoes('carla@stronix.com.br'), res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: 'fora_da_equipe',
      message: 'Seu e-mail do Stronizap, carla@stronix.com.br, não está na equipe do Stronilead. Peça ao gestor para incluir você lá com esse mesmo e-mail.'
    });
  });

  it('quem está na equipe mas nunca entrou no Stronilead também fica de fora', async () => {
    const res = resposta();

    await handler(pedidoOpcoes(BIA.email), res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('fora_da_equipe');
  });

  it('academia suspensa não abre o formulário', async () => {
    banco.tenants[TENANT].status = 'suspended';
    const res = resposta();

    await handler(pedidoOpcoes(), res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: 'academia_bloqueada',
      message: 'O Stronilead desta academia está bloqueado. Fale com o gestor.'
    });
  });

  it('sem o e-mail de quem pede, 400 no campo actor', async () => {
    const res = resposta();
    const p = pedidoOpcoes();
    delete p.body.actor;

    await handler(p, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'dados_invalidos', field: 'actor', message: 'Não deu para saber quem está cadastrando.' });
  });

  it('chave de outra academia não abre as opções', async () => {
    academia(OUTRA);
    banco.users[OUTRA] = [ANA];
    const res = resposta();
    const p = pedidoOpcoes();
    p.body.tenant = OUTRA;

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Credencial inválida' });
  });

  it('identificador com barra responde 401 sem chegar ao banco', async () => {
    const res = resposta();
    const p = pedidoOpcoes();
    p.body.tenant = 'academia/teste';

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Credencial inválida' });
  });
});

describe('POST /api/zap: o desvio no começo do handlePost', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(HOJE);
    zerarBanco();
    academiaComEquipe();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Os pedidos de cada ação que autentica pela chave.
  const pedidoPelaChave = (action) => ({
    match: { method: 'POST', headers: { 'x-stronizap-key': chave }, body: { action, tenant: TENANT, phones: [TELEFONE] } },
    'lead-options': pedidoOpcoes(),
    'create-lead': pedidoCadastro()
  })[action];

  it.each(['lead-options', 'create-lead'])('%s com login de admin e sem a chave do Zap responde 401 e não grava nada', async (action) => {
    sessao.auth = { uid: 'auth-johnny', tenantId: TENANT };
    sessao.admin = true;
    const p = pedidoPelaChave(action);
    delete p.headers['x-stronizap-key'];
    p.headers.authorization = 'Bearer token-de-admin';
    const res = resposta();

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Credencial ausente' });
    expect(banco.gravacoes).toEqual([]);
    expect(sessao.consultasDoLogin).toBe(0);
  });

  it.each(['match', 'lead-options', 'create-lead'])('%s com a chave nunca consulta o login do CRM', async (action) => {
    const res = resposta();

    await handler(pedidoPelaChave(action), res);

    expect(res.statusCode).toBeLessThan(300);
    expect(sessao.consultasDoLogin).toBe(0);
  });

  it('ação desconhecida com a chave cai no caminho do login e é recusada', async () => {
    const res = resposta();

    await handler({ method: 'POST', headers: { 'x-stronizap-key': chave }, body: { action: 'lead-option', tenant: TENANT } }, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Não autenticado.' });
    expect(sessao.consultasDoLogin).toBe(1);
  });
});

describe('POST /api/zap com action create-lead', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(HOJE);
    zerarBanco();
    academiaComEquipe();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('consultora cadastra: o lead nasce com ela de dona e o marco de início na linha do tempo', async () => {
    const res = resposta();

    await handler(pedidoCadastro(), res);

    expect(res.statusCode).toBe(201);
    const [lead] = leadsDaAcademia();
    expect(res.body).toEqual({ card: expect.objectContaining({
      found: true, leadId: lead.id, kind: 'lead', name: 'Mariana Souza',
      stage: 'Novo lead', source: 'WhatsApp', consultantName: 'Ana Souza'
    }) });
    expect(lead).toMatchObject({
      whatsapp: '(51) 9 9812-4471', zapMatchKey: '5198124471', funnelId: 'f-com', status: 'Novo lead',
      consultantId: 'u-ana', consultantName: 'Ana Souza', consultantAuthUid: 'auth-ana',
      lifecycleBucket: 'ativo', interactionsCount: 1, lastInteractionAt: HORA, createdAt: HORA, statusEnteredAt: HORA
    });
    expect('consultantChangedAt' in lead).toBe(false);
    expect(marcosDaAcademia()).toEqual([{
      id: expect.any(String),
      leadId: lead.id,
      leadName: 'Mariana Souza',
      consultantName: 'Ana Souza',
      leadConsultantId: 'u-ana',
      leadConsultantAuthUid: 'auth-ana',
      actorId: 'u-ana',
      actorAuthUid: 'auth-ana',
      type: 'zap_signup',
      text: 'Cadastrado pelo Stronizap por Ana Souza. Canal Recepção.',
      zapChannelName: 'Recepção',
      createdAt: HORA
    }]);
    expect(limitador.chamadas).toEqual([{ chave: 'zap-create-lead:academia-teste', opcoes: { limit: 60, windowMs: 3600000 } }]);
  });

  it('o lead tem os mesmos campos que o Novo lead grava, mais o que é da ponte', async () => {
    await handler(pedidoCadastro(), resposta());

    const [lead] = leadsDaAcademia();
    expect(lead).toEqual({
      ...buildNewLeadDoc(
        { name: 'Mariana Souza', whatsapp: '(51) 9 9812-4471', source: 'WhatsApp', funnelId: 'f-com', status: 'Novo lead', dor: 'Postura', modalidade: 'Pilates' },
        { owner: ANA }
      ),
      id: lead.id,
      createdAt: HORA,
      statusEnteredAt: HORA,
      lastInteractionAt: HORA,
      interactionsCount: 1
    });
  });

  it('com observação: a nota do cadastro entra na mesma gravação, como o Novo lead faz', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ lead: { observacao: '  Prefere treinar de manhã.  ' } }), res);

    expect(res.statusCode).toBe(201);
    const [lead] = leadsDaAcademia();
    expect(lead.interactionsCount).toBe(2);
    expect('observacao' in lead).toBe(false);
    expect(marcosDaAcademia().map((i) => i.type)).toEqual(['zap_signup', 'note']);
    expect(marcosDaAcademia()[1]).toEqual({
      id: expect.any(String),
      leadId: lead.id,
      leadName: 'Mariana Souza',
      consultantName: 'Ana Souza',
      leadConsultantId: 'u-ana',
      leadConsultantAuthUid: 'auth-ana',
      actorId: 'u-ana',
      actorAuthUid: 'auth-ana',
      createdAt: HORA,
      text: 'OBSERVAÇÃO DO CADASTRO: Prefere treinar de manhã.',
      type: 'note'
    });
  });

  it('observação em branco não grava nota', async () => {
    await handler(pedidoCadastro({ lead: { observacao: '   ' } }), resposta());

    expect(marcosDaAcademia().map((i) => i.type)).toEqual(['zap_signup']);
    expect(leadsDaAcademia()[0].interactionsCount).toBe(1);
  });

  it('observação longa demais é recusada no campo, sem gravar nada', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ lead: { observacao: 'x'.repeat(1001) } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: 'dados_invalidos', field: 'observacao' });
    expect(banco.gravacoes).toEqual([]);
  });

  it('gestor escolhe outra pessoa: ela vira a dona e recebe o aviso no sino', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ actor: { email: JOHNNY.email, name: 'Johnny' }, lead: { ownerId: 'u-bruno' } }), res);

    expect(res.statusCode).toBe(201);
    const [lead] = leadsDaAcademia();
    expect(lead).toMatchObject({
      consultantId: 'u-bruno', consultantName: 'Bruno Lima', consultantAuthUid: 'auth-bruno',
      consultantChangedAt: HORA, consultantChangedByName: 'Johnny', consultantChangedByAuthUid: 'auth-johnny'
    });
    expect(marcosDaAcademia()[0]).toMatchObject({
      consultantName: 'Johnny', actorId: 'u-johnny', actorAuthUid: 'auth-johnny',
      leadConsultantId: 'u-bruno', leadConsultantAuthUid: 'auth-bruno', ownerName: 'Bruno Lima',
      text: 'Cadastrado pelo Stronizap por Johnny. Consultor responsável: Bruno Lima. Canal Recepção.'
    });
    // O sino do Bruno acende com "passado para você", sem mudança no sino.
    const { handoffs } = buildNotificationFeed({
      appUser: { id: 'u-bruno', authUid: 'auth-bruno', role: 'consultant' },
      handoffLeads: [lead],
      now: HOJE
    });
    expect(handoffs).toEqual([expect.objectContaining({ id: lead.id, name: 'Mariana Souza', byName: 'Johnny', unread: true })]);
  });

  it('gestor que escolhe a si mesmo não gera aviso de troca', async () => {
    await handler(pedidoCadastro({ actor: { email: JOHNNY.email }, lead: { ownerId: 'u-johnny' } }), resposta());

    const [lead] = leadsDaAcademia();
    expect(lead.consultantId).toBe('u-johnny');
    expect('consultantChangedAt' in lead).toBe(false);
    expect('ownerName' in marcosDaAcademia()[0]).toBe(false);
  });

  it('consultora não escolhe outra pessoa como dona', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ lead: { ownerId: 'u-bruno' } }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: 'responsavel_invalido', message: 'Só o gestor escolhe outra pessoa como consultor responsável.' });
    expect(banco.gravacoes).toEqual([]);
  });

  it.each(['u-saiu', 'u-bia'])('o dono escolhido precisa estar na equipe com login (%s)', async (ownerId) => {
    const res = resposta();

    await handler(pedidoCadastro({ actor: { email: JOHNNY.email }, lead: { ownerId } }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: 'responsavel_invalido', message: 'Essa pessoa não está mais na equipe do Stronilead.' });
    expect(banco.gravacoes).toEqual([]);
  });

  it('pessoa fora da equipe não cadastra', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ actor: { email: 'carla@stronix.com.br' } }), res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('fora_da_equipe');
    expect(banco.gravacoes).toEqual([]);
  });

  it('academia com teste vencido não cadastra nem gasta o limite', async () => {
    Object.assign(banco.tenants[TENANT], { status: 'trial', trialEndsAt: ts(new Date(2026, 8, 1)) });
    const res = resposta();

    await handler(pedidoCadastro(), res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('academia_bloqueada');
    expect(limitador.chamadas).toEqual([]);
    expect(banco.gravacoes).toEqual([]);
  });

  it('mensalidade atrasada há mais de 3 dias bloqueia; há 2 dias, não', async () => {
    const atrasada = (dias) => ({ paymentStatus: 'overdue', paymentOverdueSince: ts(new Date(HOJE.getTime() - dias * 86400000)) });
    Object.assign(banco.tenants[TENANT], atrasada(4));
    const bloqueada = resposta();
    await handler(pedidoCadastro(), bloqueada);
    expect(bloqueada.statusCode).toBe(403);

    Object.assign(banco.tenants[TENANT], atrasada(2));
    const liberada = resposta();
    await handler(pedidoCadastro(), liberada);
    expect(liberada.statusCode).toBe(201);
  });

  it('número já cadastrado: devolve o cartão de quem já existe, sem gravar nada', async () => {
    banco.leads[TENANT] = [{ ...clienteAVencer, zapMatchKey: zapMatchKey(MARIANA), createdAt: ts(new Date(2026, 7, 1)), consultantName: 'Bruno Lima' }];
    const res = resposta();

    await handler(pedidoCadastro(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      error: 'ja_cadastrado',
      card: expect.objectContaining({ found: true, kind: 'cliente', leadId: 'c1' }),
      createdAt: '2026-08-01T00:00:00.000Z',
      message: 'Esse número já estava no Stronilead.'
    });
    expect(banco.gravacoes).toEqual([]);
  });

  it('cadastrado há menos de 10 minutos: diz quem cuida', async () => {
    banco.leads[TENANT] = [{
      id: 'n1', name: 'Mariana', lifecycleStage: 'lead', status: 'Novo lead', consultantName: 'Bruno Lima',
      zapMatchKey: zapMatchKey(MARIANA), createdAt: ts(new Date(HOJE.getTime() - 5 * 60000))
    }];
    const res = resposta();

    await handler(pedidoCadastro(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toBe('Esse número foi cadastrado há pouco. Quem cuida é Bruno Lima.');
  });

  it('dois pedidos ao mesmo tempo no mesmo número resultam num lead só', async () => {
    const [a, b] = [resposta(), resposta()];

    await Promise.all([
      handler(pedidoCadastro(), a),
      handler(pedidoCadastro({ actor: { email: BRUNO.email } }), b)
    ]);

    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409]);
    expect(leadsDaAcademia()).toHaveLength(1);
    expect(marcosDaAcademia()).toHaveLength(1);
    const recusado = a.statusCode === 409 ? a : b;
    expect(recusado.body.card.leadId).toBe(leadsDaAcademia()[0].id);
    expect(recusado.body.message).toMatch(/^Esse número foi cadastrado há pouco\. Quem cuida é (Ana Souza|Bruno Lima)\.$/);
  });

  it('número antigo, sem o nono dígito: o lead ganha o 9, e o número com ou sem o 9 cai no duplicado', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ phone: '555181244710' }), res);

    expect(res.statusCode).toBe(201);
    // O cartão devolvido é o do GET para o número antigo: ele continua achando a pessoa.
    expect(res.body.card).toMatchObject({ found: true, name: 'Mariana Souza' });
    expect(leadsDaAcademia()[0]).toMatchObject({ whatsapp: '(51) 9 8124-4710', whatsappDigits: '51981244710', zapMatchKey: '5181244710' });
    for (const phone of ['555181244710', '5551981244710']) {
      const repetido = resposta();
      await handler(pedidoCadastro({ phone }), repetido);
      expect(repetido.statusCode).toBe(409);
    }
    expect(leadsDaAcademia()).toHaveLength(1);
  });

  it('fixo continua com 10 dígitos', async () => {
    await handler(pedidoCadastro({ phone: '555133334444' }), resposta());

    expect(leadsDaAcademia()[0]).toMatchObject({ whatsappDigits: '5133334444', zapMatchKey: '5133334444' });
  });

  it('"Tentar de novo" depois de um cadastro feito não duplica: recebe o cartão', async () => {
    await handler(pedidoCadastro(), resposta());
    const res = resposta();

    await handler(pedidoCadastro(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.card).toMatchObject({ found: true, kind: 'lead', name: 'Mariana Souza' });
    expect(leadsDaAcademia()).toHaveLength(1);
  });

  const menorDaConversa = (extra = {}) => ({ guardianName: 'Maria Souza', relationship: 'Mãe', studentWhatsapp: null, ...extra });

  it('menor: o número da conversa vira o telefone do responsável e o cartão vira o do responsável', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ phone: MAE, lead: { name: 'Pedro Souza', minor: menorDaConversa() } }), res);

    expect(res.statusCode).toBe(201);
    expect(res.body.card).toMatchObject({ found: true, kind: 'responsavel', name: 'Maria Souza' });
    expect(res.body.card.wards.map((w) => w.name)).toEqual(['Pedro Souza']);
    expect(leadsDaAcademia()[0]).toMatchObject({
      name: 'Pedro Souza', whatsapp: '', zapMatchKey: null, isMinor: true,
      guardian: { name: 'Maria Souza', phone: '(11) 9 1234-5678', relationship: 'Mãe' },
      guardianZapMatchKey: zapMatchKey(MAE)
    });
  });

  it('irmão com o mesmo responsável entra', async () => {
    banco.leads[TENANT] = [menorDe('k1', 'Pedro Souza')];
    const res = resposta();

    await handler(pedidoCadastro({ phone: MAE, lead: { name: 'Ana Souza', minor: menorDaConversa() } }), res);

    expect(res.statusCode).toBe(201);
    expect(res.body.card.wards.map((w) => w.name)).toEqual(['Ana Souza', 'Pedro Souza']);
  });

  it('o mesmo aluno com o mesmo responsável não duplica', async () => {
    banco.leads[TENANT] = [menorDe('k1', 'Pedro Souza', { consultantName: 'Bruno Lima' })];
    const res = resposta();

    await handler(pedidoCadastro({ phone: MAE, lead: { name: ' pedro  SOUZA ', minor: menorDaConversa() } }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      error: 'ja_cadastrado',
      card: { found: true, kind: 'responsavel' },
      createdAt: '2026-08-01T00:00:00.000Z',
      message: 'Pedro Souza já tem cadastro no Stronilead com esse responsável.'
    });
    expect(banco.gravacoes).toEqual([]);
  });

  it('WhatsApp do aluno igual ao do responsável é recusado no campo', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ phone: MAE, lead: { name: 'Pedro Souza', minor: menorDaConversa({ studentWhatsapp: '(11) 9 1234-5678' }) } }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({
      error: 'menor_invalido', field: 'studentWhatsapp',
      message: 'Esse é o telefone do responsável. Se o aluno não tem WhatsApp próprio, deixe em branco.'
    });
    expect(banco.gravacoes).toEqual([]);
  });

  it('WhatsApp do aluno que já é de outro cadastro é recusado no campo', async () => {
    banco.leads[TENANT] = [clienteAVencer];
    const res = resposta();

    await handler(pedidoCadastro({ phone: MAE, lead: { name: 'Pedro Souza', minor: menorDaConversa({ studentWhatsapp: '(11) 9 8765-4321' }) } }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: 'menor_invalido', field: 'studentWhatsapp', message: 'Esse WhatsApp já está em outro cadastro do Stronilead.' });
    expect(banco.gravacoes).toEqual([]);
  });

  it('WhatsApp próprio do aluno vai para o lead do aluno', async () => {
    await handler(pedidoCadastro({ phone: MAE, lead: { name: 'Pedro Souza', minor: menorDaConversa({ studentWhatsapp: '11955554444' }) } }), resposta());

    expect(leadsDaAcademia()[0]).toMatchObject({ whatsapp: '(11) 9 5555-4444', zapMatchKey: '1155554444', guardianZapMatchKey: zapMatchKey(MAE) });
  });

  it('menor num número antigo: o telefone do responsável também ganha o 9', async () => {
    await handler(pedidoCadastro({ phone: '555181244710', lead: { name: 'Pedro Souza', minor: menorDaConversa() } }), resposta());

    expect(leadsDaAcademia()[0]).toMatchObject({
      guardian: { name: 'Maria Souza', phone: '(51) 9 8124-4710', relationship: 'Mãe' },
      guardianZapMatchKey: '5181244710'
    });
  });

  it('responsável sem nome é recusado no campo', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ phone: MAE, lead: { name: 'Pedro Souza', minor: menorDaConversa({ guardianName: 'M' }) } }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: 'menor_invalido', field: 'guardianName', message: 'Informe o nome do responsável.' });
  });

  it('adulto num número que só é de responsável entra: o telefone do responsável não barra', async () => {
    banco.leads[TENANT] = [menorDe('k1', 'Pedro Souza')];
    const res = resposta();

    await handler(pedidoCadastro({ phone: MAE, lead: { name: 'Maria Souza' } }), res);

    expect(res.statusCode).toBe(201);
    expect(res.body.card).toMatchObject({ found: true, kind: 'lead', name: 'Maria Souza' });
    expect(res.body.card.wards.map((w) => w.leadId)).toEqual(['k1']);
  });

  it.each([
    ['source', { source: 'Facebook' }, 'Essa origem não existe mais no Stronilead. Escolha de novo.'],
    ['dor', { dor: 'Ansiedade' }, 'Essa dor não existe mais no Stronilead. Escolha de novo.'],
    ['modalidade', { modalidade: 'Crossfit' }, 'Essa modalidade não existe mais no Stronilead. Escolha de novo.'],
    ['funnelId', { funnelId: 'f-ren' }, 'Esse funil não existe mais no Stronilead. Escolha de novo.'],
    ['stage', { stage: 'Interesse' }, 'Essa etapa não existe mais no Stronilead. Escolha de novo.']
  ])('item de catálogo que sumiu (%s) é recusado e diz o campo', async (field, lead, message) => {
    const res = resposta();

    await handler(pedidoCadastro({ lead }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: 'catalogo_mudou', field, message });
    expect(banco.gravacoes).toEqual([]);
  });

  it('academia sem dor cadastrada não cadastra', async () => {
    banco.catalogos[TENANT].stronix_dores = [];
    const res = resposta();

    await handler(pedidoCadastro(), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({
      error: 'sem_dor_cadastrada',
      message: 'Nenhuma dor cadastrada no Stronilead. O gestor cadastra em Configurações → Catálogos → Dores.'
    });
  });

  it('dor em branco com dores cadastradas é campo a preencher', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ lead: { dor: '' } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'dados_invalidos', field: 'dor', message: 'Escolha a dor ou necessidade.' });
  });

  it('passou de 60 cadastros na hora: recusa sem gravar', async () => {
    limitador.ok = false;
    const res = resposta();

    await handler(pedidoCadastro(), res);

    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: 'limite', message: 'Muitos cadastros em pouco tempo. Tente de novo em alguns minutos.' });
    expect(banco.gravacoes).toEqual([]);
  });

  it('pedido com formato errado responde 400 sem gastar o limite', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ phone: '123' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'dados_invalidos', field: 'phone', message: 'O número desta conversa não é um WhatsApp com DDD.' });
    expect(limitador.chamadas).toEqual([]);
  });

  it('nome com menos de 2 letras é recusado no campo', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ lead: { name: ' A ' } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'dados_invalidos', field: 'name', message: 'Informe o nome, com 2 letras ou mais.' });
  });

  it('erro do banco no meio do cadastro sobe sem o telefone e sem gravar nada', async () => {
    banco.falhaEm = 'zapMatchKey';

    const erro = await handler(pedidoCadastro(), resposta()).catch((e) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(erro.message).toBe('zap create-lead falhou (9)');
    expect(String(erro.stack)).not.toContain(zapMatchKey(MARIANA));
    expect(String(erro.stack)).not.toContain(MARIANA);
    expect(banco.gravacoes).toEqual([]);
  });

  it('chave de outra academia não cadastra', async () => {
    academia(OUTRA);
    banco.users[OUTRA] = [ANA];
    const res = resposta();
    const p = pedidoCadastro();
    p.body.tenant = OUTRA;

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(banco.leads[OUTRA]).toEqual([]);
    expect(banco.gravacoes).toEqual([]);
  });
});
