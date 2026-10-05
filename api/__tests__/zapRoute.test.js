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
// Com o vi.mock abaixo, este é o adminDb falso: os testes do banco falso o usam
// direto, sem passar pela rota.
import { adminDb } from '../_firebaseAdmin.js';
import { buildNewLeadDoc } from '../../src/lib/newLead.js';
import { buildNotificationFeed } from '../../src/lib/notifications.js';
import { appointmentsOf } from '../../src/lib/crm/appointments.js';
import { getSafeDateOrNull } from '../../src/lib/dates.js';

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
// leitura depois de escrita dentro da transação, leitura dentro da transação
// que não passa pelo tx.get (no SDK ela não é transacional, e o resultado
// seria gravação dupla), campo undefined numa gravação da transação (o adminDb
// do projeto não liga ignoreUndefinedProperties), create de documento que já
// existe e update de documento que não existe. O `select` devolve só os
// campos pedidos, e o increment soma no valor gravado. Um fake mais tolerante
// que produção deixa passar exatamente o erro que importa. E tudo fica
// guardado por academia, para dar para provar que a chave de uma não lê a
// outra.
//
// O que ele NÃO imita, para ninguém supor que imita:
//   - `set` com `merge` não mescla: dentro da transação substitui o documento,
//     e fora dela (o `set` direto do generate e do revoke) só registra a
//     gravação, sem mexer no documento e sem recusar undefined;
//   - `Date` gravado volta como `Date`, e não como `Timestamp`;
//   - ids que só o servidor recusa (`.`, `..`, `__x__`, mais de 1.500 bytes)
//     passam;
//   - não há contenção nem repetição do callback: cada transação roda uma vez,
//     em fila.
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

vi.mock('../_firebaseAdmin.js', async () => {
  // Dentro do callback de runTransaction, uma leitura que não passa por tx.get
  // não é transacional no Firestore de verdade. O falso roda cada callback
  // inteiro em fila e esconderia esse defeito (a leitura sempre veria o estado
  // já gravado pelo pedido anterior), então aqui ele é recusado.
  const { AsyncLocalStorage } = await import('node:async_hooks');
  const contexto = new AsyncLocalStorage();
  const foraDaTx = (opc, caminho) => {
    if (contexto.getStore()?.tx && !opc?.viaTx) {
      throw new Error(`leitura fora de tx.get dentro do runTransaction: ${caminho.join('/')}`);
    }
  };
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
        limit: (n) => ({ get: async (opc) => { foraDaTx(opc, caminho); return consulta(linhas().slice(0, n)); } }),
        select: (...campos) => ({ get: async (opc) => { foraDaTx(opc, caminho); return consulta(linhas(), campos); } }),
        get: async (opc) => { foraDaTx(opc, caminho); return consulta(linhas()); }
      };
    },
    // Coleção (caminho de tamanho ímpar) devolve a lista; documento, o snapshot.
    get: async (opc) => {
      foraDaTx(opc, caminho);
      return caminho.length % 2 === 1 ? consulta(listaDe(caminho)) : documento(caminho);
    },
    set: async (dados, opcoes) => {
      banco.gravacoes.push({ caminho: caminho.join('/'), dados, opcoes });
    }
  });

  // O SDK recusa `undefined` em qualquer campo: ignoreUndefinedProperties vem
  // desligado e api/_firebaseAdmin.js não liga. Campo undefined que passa no
  // teste vira erro 500 em produção.
  const semUndefined = (valor, campo = '') => {
    if (valor === undefined) throw new Error(`Cannot use "undefined" as a Firestore value (found in field "${campo}")`);
    if (Array.isArray(valor)) valor.forEach((v, i) => semUndefined(v, `${campo}.${i}`));
    else if (valor && Object.getPrototypeOf(valor) === Object.prototype) {
      Object.entries(valor).forEach(([k, v]) => semUndefined(v, campo ? `${campo}.${k}` : k));
    }
  };

  // Uma transação de cada vez, em fila: é o efeito do isolamento serializável
  // do Firestore. As escritas só valem juntas, no fim, e só se nenhuma for
  // recusada. Não existe `add` numa transação: o documento novo sai de
  // collection.doc() e é gravado com create.
  let fila = Promise.resolve();
  const runTransaction = (fn) => {
    const vez = fila.then(async () => {
      const escritas = [];
      const tx = {};
      const escrever = (tipo) => (alvo, dados) => {
        semUndefined(dados);
        escritas.push({ tipo, caminho: alvo.caminho, dados });
        return tx;
      };
      Object.assign(tx, {
        get: async (alvo) => {
          if (escritas.length > 0) throw new Error('Firestore transactions require all reads to be executed before all writes.');
          return alvo.get({ viaTx: true });
        },
        create: escrever('create'),
        set: escrever('set'),
        update: escrever('update')
      });
      const resultado = await contexto.run({ tx: true }, () => fn(tx));
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

// Estes testes travam as duas recusas que deixam o banco falso tão rígido
// quanto o firebase-admin, para elas não sumirem numa refatoração dele. Sem
// elas, "dois pedidos ao mesmo tempo gravam uma vez só" passaria mesmo com uma
// leitura fora da transação, e um campo undefined passaria no teste e viraria
// erro 500 em produção. Usam o adminDb falso direto, sem passar pela rota.
describe('o banco falso imita o firebase-admin', () => {
  beforeEach(() => {
    zerarBanco();
  });

  const leads = () => adminDb.collection('artifacts').doc(TENANT)
    .collection('public').doc('data').collection('stronix_leads');

  it('leitura dentro da transação que não passa pelo tx.get é recusada', async () => {
    banco.leads[TENANT] = [clienteAVencer];
    const recusada = /leitura fora de tx\.get dentro do runTransaction/;

    // A mesma leitura pelo tx.get passa, e fora da transação também.
    const pelaTransacao = await adminDb.runTransaction((tx) => tx.get(leads().doc('c1')));
    expect(pelaTransacao.exists).toBe(true);
    expect((await leads().doc('c1').get()).exists).toBe(true);

    // Dentro do callback, sem o tx, é recusada, mesmo depois de um tx.get e de
    // um await: o documento, a coleção e cada forma de consulta.
    const consulta = () => leads().where('zapMatchKey', '==', clienteAVencer.zapMatchKey);
    const leituras = [
      ['documento', () => leads().doc('c1').get()],
      ['coleção', () => leads().get()],
      ['consulta', () => consulta().get()],
      ['consulta com limit', () => consulta().limit(1).get()],
      ['consulta com select', () => consulta().select('name').get()]
    ];
    for (const [forma, ler] of leituras) {
      const transacao = adminDb.runTransaction(async (tx) => {
        await tx.get(leads().doc('c1'));
        return ler();
      });
      await expect(transacao, forma).rejects.toThrow(recusada);
    }
  });

  it('undefined numa gravação da transação é recusado, como no SDK', async () => {
    const recusado = (campo) => `Cannot use "undefined" as a Firestore value (found in field "${campo}")`;
    const ana = { id: 'ana', name: 'Ana', observacao: null, tags: ['a'] };

    // null passa, e fica gravado.
    await adminDb.runTransaction(async (tx) => {
      tx.create(leads().doc('ana'), { name: 'Ana', observacao: null, tags: ['a'] });
    });
    expect(leadsDaAcademia()).toEqual([ana]);

    // undefined é recusado no create, no update e no set, no campo, dentro de
    // objeto e dentro de lista.
    await expect(adminDb.runTransaction(async (tx) => {
      tx.create(leads().doc('bia'), { name: 'Bia', observacao: undefined });
    })).rejects.toThrow(recusado('observacao'));
    await expect(adminDb.runTransaction(async (tx) => {
      tx.update(leads().doc('ana'), { agenda: { unit: undefined } });
    })).rejects.toThrow(recusado('agenda.unit'));
    await expect(adminDb.runTransaction(async (tx) => {
      tx.set(leads().doc('ana'), { tags: ['a', undefined] });
    })).rejects.toThrow(recusado('tags.1'));

    // A transação recusada não gravou nada.
    expect(leadsDaAcademia()).toEqual([ana]);
    expect(banco.gravacoes).toHaveLength(1);
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
    'create-lead': pedidoCadastro(),
    'schedule-options': pedidoOpcoesAgenda(),
    schedule: pedidoAgenda(),
    'appointment-status': pedidoStatus(['L1'])
  })[action];

  it.each(['lead-options', 'create-lead', 'schedule-options', 'schedule', 'appointment-status'])('%s com login de admin e sem a chave do Zap responde 401 e não grava nada', async (action) => {
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

  it.each(['match', 'lead-options', 'create-lead', 'schedule-options', 'schedule', 'appointment-status'])('%s com a chave nunca consulta o login do CRM', async (action) => {
    // O agendamento precisa de um lead do número para dar certo.
    if (action === 'schedule') banco.leads[TENANT] = [marianaLead()];
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

// ---------------------------------------------------------------------------
// Agendamento pelo Stronizap
// ---------------------------------------------------------------------------

// Terça, 29/09/2026, às 15:40 de Brasília, como nos mockups.
const AGORA = new Date('2026-09-29T18:40:00.000Z');
// A Mariana, lead da Ana com o número da conversa. Os campos de data vêm como
// Timestamp, como o Firestore devolve.
const marianaLead = (extra = {}) => ({
  id: 'L1', name: 'Mariana Souza', lifecycleStage: 'lead', status: 'Primeiro contato', source: 'Instagram',
  consultantId: 'u-ana', consultantName: 'Ana Souza', consultantAuthUid: 'auth-ana',
  whatsapp: '(51) 9 9812-4471', zapMatchKey: zapMatchKey(MARIANA), interactionsCount: 3,
  createdAt: ts(new Date('2026-09-01T13:00:00.000Z')), ...extra
});

const pedidoOpcoesAgenda = ({ phone = MARIANA, email = ANA.email } = {}) => ({
  method: 'POST',
  headers: { 'x-stronizap-key': chave },
  body: { action: 'schedule-options', tenant: TENANT, phone, actor: { email } }
});

describe('POST /api/zap com action schedule-options', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AGORA);
    zerarBanco();
    academiaComEquipe();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('consultora em dia de meta: quem ela é, os cadastros do número, as listas e os dias', async () => {
    banco.leads[TENANT] = [marianaLead({
      appointmentType: 'visita', appointmentScheduledFor: ts(new Date('2026-09-30T21:00:00.000Z')), appointmentUnit: 'Centro'
    })];
    const res = resposta();

    await handler(pedidoOpcoesAgenda(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      actor: { id: 'u-ana', name: 'Ana Souza', role: 'consultor', countsForMeta: true },
      targets: [
        { leadId: 'L1', name: 'Mariana Souza', relationship: null, appointment: { type: 'visita', at: '2026-09-30T21:00:00.000Z', outcome: null } }
      ],
      units: [{ name: 'Centro', address: 'Rua Garibaldi, 1200' }, { name: 'Zona Sul', address: null }],
      modalities: [{ id: 'm1', name: 'Musculação' }, { id: 'm2', name: 'Pilates' }],
      professors: [
        { id: 'p1', name: 'Carla Dias', modalityIds: ['m2'] },
        { id: 'p2', name: 'Rafael Moura', modalityIds: ['m2', 'm1'] }
      ],
      trialClassOptions: [1, 2, 3],
      days: [
        { date: '2026-09-29', label: 'Hoje', defaultTime: '18:00' },
        { date: '2026-09-30', label: 'Amanhã', defaultTime: '09:00' },
        { date: '2026-10-01', label: 'Quinta', defaultTime: '09:00' },
        { date: '2026-10-02', label: 'Sexta', defaultTime: '09:00' },
        { date: '2026-10-05', label: 'Segunda', defaultTime: '09:00' }
      ]
    });
    // Opções só leem: não gastam o limite nem gravam nada.
    expect(limitador.chamadas).toEqual([]);
    expect(banco.gravacoes).toEqual([]);
  });

  it('gestor: papel gestor e fora da Meta', async () => {
    const res = resposta();

    await handler(pedidoOpcoesAgenda({ email: JOHNNY.email }), res);

    expect(res.body.actor).toEqual({ id: 'u-johnny', name: 'Johnny', role: 'gestor', countsForMeta: false });
  });

  it('a quantidade de aulas e os dias da meta são os da academia', async () => {
    banco.config[TENANT] = { trialClassOptions: [1, 2], metaWeekdays: [1, 2, 3, 4, 5, 6] };
    const res = resposta();

    await handler(pedidoOpcoesAgenda(), res);

    expect(res.body.trialClassOptions).toEqual([1, 2]);
    expect(res.body.days.map((d) => d.label)).toEqual(['Hoje', 'Amanhã', 'Quinta', 'Sexta', 'Sábado']);
  });

  it('depois das 18h de Brasília, os dias começam amanhã', async () => {
    vi.setSystemTime(new Date('2026-09-29T21:30:00.000Z'));
    const res = resposta();

    await handler(pedidoOpcoesAgenda(), res);

    expect(res.body.days[0]).toEqual({ date: '2026-09-30', label: 'Amanhã', defaultTime: '09:00' });
  });

  it('mãe sem cadastro próprio: os filhos em ordem de nome, com o parentesco e o agendamento de cada um', async () => {
    banco.leads[TENANT] = [
      menorDe('k1', 'Pedro Souza', {
        sexo: 'Masculino', appointmentType: 'aula_experimental',
        appointmentScheduledFor: ts(new Date('2026-10-02T22:00:00.000Z')), appointmentModality: 'Pilates'
      }),
      menorDe('k2', 'Ana Souza', { sexo: 'Feminino' }),
      menorDe('k3', 'Caio Souza')
    ];
    const res = resposta();

    await handler(pedidoOpcoesAgenda({ phone: MAE }), res);

    expect(res.body.targets).toEqual([
      { leadId: 'k2', name: 'Ana Souza', relationship: 'Filha', appointment: null },
      { leadId: 'k3', name: 'Caio Souza', relationship: null, appointment: null },
      { leadId: 'k1', name: 'Pedro Souza', relationship: 'Filho', appointment: { type: 'aula_experimental', at: '2026-10-02T22:00:00.000Z', outcome: null } }
    ]);
  });

  it('dona do número que também é responsável: ela primeiro, depois o filho', async () => {
    banco.leads[TENANT] = [marianaLead({ zapMatchKey: zapMatchKey(MAE) }), menorDe('k1', 'Pedro Souza', { sexo: 'Masculino' })];
    const res = resposta();

    await handler(pedidoOpcoesAgenda({ phone: MAE }), res);

    expect(res.body.targets.map((t) => [t.leadId, t.relationship])).toEqual([['L1', null], ['k1', 'Filho']]);
  });

  it('número sem cadastro: nenhum alvo, e as listas vêm do mesmo jeito', async () => {
    const res = resposta();

    await handler(pedidoOpcoesAgenda(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.targets).toEqual([]);
    expect(res.body.units).toHaveLength(2);
  });

  it('quem fez 18 anos com WhatsApp próprio sai do "Para quem?", como sai do cartão', async () => {
    banco.leads[TENANT] = [
      menorDe('k1', 'Pedro Souza'),
      menorDe('k9', 'Adulto', { birthDate: ts(new Date(2000, 0, 10)), whatsapp: '(11) 9 5555-4444' })
    ];
    const res = resposta();

    await handler(pedidoOpcoesAgenda({ phone: MAE }), res);

    expect(res.body.targets.map((t) => t.leadId)).toEqual(['k1']);
  });

  it('cadastro de outra academia com o mesmo número não aparece', async () => {
    academia(OUTRA);
    banco.leads[OUTRA] = [marianaLead({ id: 'L-outra' }), menorDe('k-outra', 'Pedro Souza', { guardianZapMatchKey: zapMatchKey(MARIANA) })];
    const res = resposta();

    await handler(pedidoOpcoesAgenda(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.targets).toEqual([]);
  });

  it('pessoa fora da equipe recebe o aviso do cadastro, com o e-mail dela', async () => {
    const res = resposta();

    await handler(pedidoOpcoesAgenda({ email: 'carla@stronix.com.br' }), res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: 'fora_da_equipe',
      message: 'Seu e-mail do Stronizap, carla@stronix.com.br, não está na equipe do Stronilead. Peça ao gestor para incluir você lá com esse mesmo e-mail.'
    });
  });

  it('academia suspensa não abre o balão', async () => {
    banco.tenants[TENANT].status = 'suspended';
    const res = resposta();

    await handler(pedidoOpcoesAgenda(), res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('academia_bloqueada');
  });

  it('número fora do formato e pedido sem e-mail: 400 no campo', async () => {
    const semNumero = resposta();
    await handler(pedidoOpcoesAgenda({ phone: '123' }), semNumero);
    expect(semNumero.statusCode).toBe(400);
    expect(semNumero.body).toMatchObject({ error: 'dados_invalidos', field: 'phone' });

    const semEmail = resposta();
    await handler(pedidoOpcoesAgenda({ email: '' }), semEmail);
    expect(semEmail.body).toEqual({ error: 'dados_invalidos', field: 'actor', message: 'Não deu para saber quem está agendando.' });
  });

  it('chave de outra academia não abre as opções', async () => {
    academia(OUTRA);
    banco.users[OUTRA] = [ANA];
    const res = resposta();
    const p = pedidoOpcoesAgenda();
    p.body.tenant = OUTRA;

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Credencial inválida' });
  });

  it('erro do banco sobe sem o telefone', async () => {
    banco.falhaEm = 'zapMatchKey';

    const erro = await handler(pedidoOpcoesAgenda(), resposta()).catch((e) => e);

    expect(erro.message).toBe('zap schedule-options falhou (9)');
    expect(String(erro.stack)).not.toContain(zapMatchKey(MARIANA));
  });

  // No GET e no match, a busca dos menores falhando só tira os filhos do cartão
  // (o cartão do dono não pode cair por causa dela). Aqui ela esconderia o
  // defeito: o "Para quem?" sairia só com o cadastro do próprio número, sem
  // aviso, e o atendente não agendaria para o filho nem saberia por quê.
  it('busca dos menores falhando sobe como erro, sem devolver só o cadastro do próprio número', async () => {
    banco.leads[TENANT] = [marianaLead({ zapMatchKey: zapMatchKey(MAE) }), menorDe('k1', 'Pedro Souza', { sexo: 'Masculino' })];
    banco.falhaEm = 'guardianZapMatchKey';
    const res = resposta();

    const erro = await handler(pedidoOpcoesAgenda({ phone: MAE }), res).catch((e) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(erro.message).toBe('zap schedule-options falhou (9)');
    expect(String(erro.stack)).not.toContain(zapMatchKey(MAE));
    expect(res.statusCode).toBe(0);
    expect(res.body).toBeUndefined();
  });
});

// Um registro de stronix_aulas como o assistente grava.
const registro = (id, extra = {}) => ({
  id, type: 'visita', unit: 'Centro', leadId: 'L1', leadName: 'Mariana Souza', professorId: null, professorName: null,
  soloTraining: false, modality: null, scheduledFor: ts(new Date('2026-09-30T21:00:00.000Z')), status: 'agendada',
  outcomeAt: null, converted: false, convertedAt: null, consultantId: 'u-ana', consultantAuthUid: 'auth-ana',
  consultantName: 'Ana Souza', ...extra
});

// Pedido de agendamento da Ana: visita da Mariana na quinta, 01/10, às 18:00.
// `schedule` mexe nos campos do agendamento; o resto troca campos do corpo.
const pedidoAgenda = ({ schedule = {}, ...extra } = {}) => ({
  method: 'POST',
  headers: { 'x-stronizap-key': chave },
  body: {
    action: 'schedule',
    tenant: TENANT,
    phone: MARIANA,
    actor: { email: ANA.email, name: 'Ana' },
    channelName: 'Recepção',
    schedule: {
      leadId: 'L1', type: 'visita', unit: 'Centro', modality: null, professorId: null, soloTraining: false,
      quantity: null, date: '2026-10-01', time: '18:00', note: 'Vem depois do trabalho.', ...schedule
    },
    ...extra
  }
});
// Aula experimental de pilates com a Carla, na sexta, 02/10, às 19:00.
const AULA_DA_CARLA = {
  type: 'aula_experimental', unit: null, modality: 'Pilates', professorId: 'p1', soloTraining: false,
  quantity: 1, date: '2026-10-02', time: '19:00', note: null
};

const aulasDaAcademia = () => banco.aulas[TENANT] ?? [];
const interacoesDaAcademia = () => banco.interacoes[TENANT] ?? [];
const leadDaAcademia = (id) => leadsDaAcademia().find((l) => l.id === id);

describe('POST /api/zap com action schedule', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AGORA);
    zerarBanco();
    academiaComEquipe();
    banco.leads[TENANT] = [marianaLead()];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const QUINTA_18H = new Date('2026-10-01T21:00:00.000Z');
  const SEXTA_19H = new Date('2026-10-02T22:00:00.000Z');

  it('visita nova: o registro, a interação e o lead, numa gravação só, e o cartão já atualizado', async () => {
    const res = resposta();

    await handler(pedidoAgenda(), res);

    expect(res.statusCode).toBe(201);
    const [rec] = aulasDaAcademia();
    expect(rec).toEqual({
      id: expect.any(String), type: 'visita', unit: 'Centro', leadId: 'L1', leadName: 'Mariana Souza',
      professorId: null, professorName: null, soloTraining: false, modality: null, scheduledFor: QUINTA_18H,
      status: 'agendada', outcomeAt: null, converted: false, convertedAt: null,
      consultantId: 'u-ana', consultantAuthUid: 'auth-ana', consultantName: 'Ana Souza', createdAt: HORA
    });
    expect(interacoesDaAcademia()).toEqual([{
      id: expect.any(String),
      leadId: 'L1',
      leadName: 'Mariana Souza',
      // O nome vem do Stronilead, e não do "Ana" que o Stronizap mandou.
      consultantName: 'Ana Souza',
      leadConsultantId: 'u-ana',
      leadConsultantAuthUid: 'auth-ana',
      actorId: 'u-ana',
      actorAuthUid: 'auth-ana',
      createdAt: HORA,
      text: '🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 18:00. Obs: Vem depois do trabalho.',
      type: 'note',
      volumeKind: 'visita',
      via: 'stronizap',
      zapChannelName: 'Recepção'
    }]);
    expect(leadDaAcademia('L1')).toMatchObject({
      status: 'Primeiro contato',
      interactionsCount: 4,
      lastInteractionAt: HORA,
      nextFollowUp: QUINTA_18H,
      nextFollowUpType: 'Visita',
      nextFollowUpNote: 'Vem depois do trabalho.',
      appointmentType: 'visita',
      appointmentScheduledFor: QUINTA_18H,
      appointmentUnit: 'Centro',
      appointmentModality: null,
      trialClassesPlanned: null,
      appointmentOutcome: null,
      currentAulaId: null
    });
    expect(res.body).toEqual({
      card: expect.objectContaining({
        found: true, leadId: 'L1', kind: 'lead',
        appointment: { type: 'visita', at: '2026-10-01T21:00:00.000Z', outcome: null }
      }),
      appointment: {
        leadId: 'L1', leadName: 'Mariana Souza', type: 'visita', at: '2026-10-01T21:00:00.000Z',
        unit: 'Centro', unitAddress: 'Rua Garibaldi, 1200', modality: null, professorName: null,
        soloTraining: false, quantity: null, outcome: null
      }
    });
    expect(limitador.chamadas).toEqual([{ chave: 'zap-schedule:academia-teste', opcoes: { limit: 60, windowMs: 3600000 } }]);
  });

  it('remarcar visita sem desfecho: o registro em aberto troca de data e de unidade, e a linha do tempo ganha outro registro', async () => {
    banco.leads[TENANT] = [marianaLead({
      appointmentType: 'visita', appointmentScheduledFor: ts(new Date('2026-09-30T21:00:00.000Z')), appointmentUnit: 'Zona Sul'
    })];
    banco.aulas[TENANT] = [
      registro('v-velha', { status: 'no_show', scheduledFor: ts(new Date('2026-09-20T21:00:00.000Z')) }),
      registro('v-aberta', { unit: 'Zona Sul' })
    ];
    const res = resposta();

    await handler(pedidoAgenda(), res);

    expect(res.statusCode).toBe(201);
    expect(aulasDaAcademia()).toHaveLength(2);
    expect(aulasDaAcademia().find((a) => a.id === 'v-aberta')).toMatchObject({ unit: 'Centro', scheduledFor: QUINTA_18H, status: 'agendada' });
    expect(aulasDaAcademia().find((a) => a.id === 'v-velha').status).toBe('no_show');
    expect(leadDaAcademia('L1')).toMatchObject({ appointmentScheduledFor: QUINTA_18H, appointmentUnit: 'Centro', appointmentOutcome: null });
    expect(interacoesDaAcademia()).toHaveLength(1);
  });

  // O desfecho da visita não é gravado no registro quando é marcado. Mover o
  // registro para a data nova apagaria a falta ou o comparecimento do Dashboard
  // CRM no mês da visita: ele fecha com o desfecho, e a data nova abre outro.
  it.each([
    ['"Não compareceu"', 'no_show'],
    ['"Compareceu"', 'attended']
  ])('visita com %s e outra visita em outro dia: o registro dela fecha com o desfecho, na data dela, e a data nova abre outro', async (_, appointmentOutcome) => {
    banco.leads[TENANT] = [marianaLead({
      appointmentType: 'visita', appointmentScheduledFor: ts(new Date('2026-09-28T21:00:00.000Z')), appointmentUnit: 'Zona Sul',
      appointmentOutcome, appointmentOutcomeAt: ts(new Date('2026-09-28T22:00:00.000Z'))
    })];
    banco.aulas[TENANT] = [registro('v-set', { unit: 'Zona Sul', scheduledFor: ts(new Date('2026-09-28T21:00:00.000Z')) })];
    const res = resposta();

    await handler(pedidoAgenda(), res);

    expect(res.statusCode).toBe(201);
    expect(aulasDaAcademia()).toHaveLength(2);
    const velha = aulasDaAcademia().find((a) => a.id === 'v-set');
    expect(velha).toMatchObject({ status: appointmentOutcome, outcomeAt: HORA, unit: 'Zona Sul' });
    expect(velha.scheduledFor.toDate()).toEqual(new Date('2026-09-28T21:00:00.000Z'));
    const nova = aulasDaAcademia().find((a) => a.id !== 'v-set');
    expect(nova).toMatchObject({ type: 'visita', leadId: 'L1', unit: 'Centro', scheduledFor: QUINTA_18H, status: 'agendada' });
    expect(leadDaAcademia('L1')).toMatchObject({ appointmentScheduledFor: QUINTA_18H, appointmentOutcome: null });
    // Uma gravação a mais que a visita nova sem nada a fechar: 4 no lugar de 3.
    expect(banco.gravacoes).toHaveLength(4);
  });

  it('visita em aberto trocada por aula: a visita fecha como cancelada, e a aula nasce', async () => {
    banco.leads[TENANT] = [marianaLead({
      appointmentType: 'visita', appointmentScheduledFor: ts(new Date('2026-09-30T21:00:00.000Z')), appointmentUnit: 'Centro'
    })];
    banco.aulas[TENANT] = [registro('v-aberta')];

    await handler(pedidoAgenda({ schedule: AULA_DA_CARLA }), resposta());

    expect(aulasDaAcademia().find((a) => a.id === 'v-aberta')).toMatchObject({ status: 'cancelled', outcomeAt: HORA });
    const aula = aulasDaAcademia().find((a) => a.id !== 'v-aberta');
    expect(aula).toMatchObject({ type: 'aula', status: 'agendada', scheduledFor: SEXTA_19H });
    expect(leadDaAcademia('L1').currentAulaId).toBe(aula.id);
  });

  it('visita com "Compareceu" e depois uma aula: a visita fecha como compareceu, e não como cancelada', async () => {
    banco.leads[TENANT] = [marianaLead({
      appointmentType: 'visita', appointmentScheduledFor: ts(new Date('2026-09-28T21:00:00.000Z')), appointmentUnit: 'Centro',
      appointmentOutcome: 'attended'
    })];
    banco.aulas[TENANT] = [registro('v-set', { scheduledFor: ts(new Date('2026-09-28T21:00:00.000Z')) })];

    await handler(pedidoAgenda({ schedule: AULA_DA_CARLA }), resposta());

    expect(aulasDaAcademia().find((a) => a.id === 'v-set')).toMatchObject({ status: 'attended' });
  });

  it('aula em aberto trocada por visita: a aula do currentAulaId fecha como cancelada, e o lead continua apontando para ela', async () => {
    banco.leads[TENANT] = [marianaLead({
      appointmentType: 'aula_experimental', appointmentScheduledFor: ts(SEXTA_19H), currentAulaId: 'a-aberta'
    })];
    banco.aulas[TENANT] = [registro('a-aberta', {
      type: 'aula', unit: null, professorId: 'p1', professorName: 'Carla Dias', modality: 'Pilates', scheduledFor: ts(SEXTA_19H)
    })];

    await handler(pedidoAgenda(), resposta());

    expect(aulasDaAcademia().find((a) => a.id === 'a-aberta')).toMatchObject({ status: 'cancelled', outcomeAt: HORA });
    expect(aulasDaAcademia().find((a) => a.id !== 'a-aberta')).toMatchObject({ type: 'visita', scheduledFor: QUINTA_18H, status: 'agendada' });
    expect(leadDaAcademia('L1')).toMatchObject({ appointmentType: 'visita', currentAulaId: 'a-aberta' });
  });

  // O que o Johnny pediu: agendar de novo depois de um desfecho não apaga o
  // desfecho do painel. Os registros chegam ao painel como o useCrmSources
  // entrega (datas em Date), com o lead de depois do agendamento.
  it.each([
    ['a falta', 'no_show', { missed: 1, came: 0 }],
    ['o comparecimento', 'attended', { missed: 0, came: 1 }]
  ])('Dashboard CRM: %s de setembro continua em setembro depois de agendar de novo em outubro', async (_, appointmentOutcome, setembro) => {
    banco.leads[TENANT] = [marianaLead({
      appointmentType: 'visita', appointmentScheduledFor: ts(new Date('2026-09-28T21:00:00.000Z')), appointmentUnit: 'Centro',
      appointmentOutcome
    })];
    banco.aulas[TENANT] = [registro('v-set', { scheduledFor: ts(new Date('2026-09-28T21:00:00.000Z')) })];

    await handler(pedidoAgenda(), resposta());

    const registros = aulasDaAcademia().map((r) => ({
      ...r, scheduledFor: getSafeDateOrNull(r.scheduledFor), createdAt: getSafeDateOrNull(r.createdAt)
    }));
    const lead = leadDaAcademia('L1');
    const noMes = (start, end) => appointmentsOf(registros, { start, end, leadOf: () => lead, inScope: () => true });
    expect(noMes(new Date(2026, 8, 1), new Date(2026, 9, 1))).toMatchObject({ total: 1, pending: 0, ...setembro });
    expect(noMes(new Date(2026, 9, 1), new Date(2026, 10, 1))).toMatchObject({ total: 1, missed: 0, came: 0, pending: 1 });
  });

  it('aula nova: o registro leva o professor, e o lead passa a apontar para ele', async () => {
    const res = resposta();

    await handler(pedidoAgenda({ schedule: AULA_DA_CARLA }), res);

    expect(res.statusCode).toBe(201);
    const [rec] = aulasDaAcademia();
    expect(rec).toMatchObject({
      type: 'aula', unit: null, professorId: 'p1', professorName: 'Carla Dias', modality: 'Pilates',
      soloTraining: false, scheduledFor: SEXTA_19H, status: 'agendada'
    });
    expect(leadDaAcademia('L1')).toMatchObject({
      appointmentType: 'aula_experimental', nextFollowUpType: 'Aula Experimental', appointmentModality: 'Pilates',
      appointmentProfessorId: 'p1', appointmentProfessorName: 'Carla Dias', trialClassesPlanned: 1,
      appointmentUnit: null, currentAulaId: rec.id
    });
    expect(interacoesDaAcademia()[0]).toMatchObject({
      text: '🔔 Aula Experimental agendada (Pilates · 1 aula) · Carla Dias p/ 02/10/2026, 19:00.',
      volumeKind: 'aula_experimental'
    });
    expect(res.body.appointment).toMatchObject({
      type: 'aula_experimental', at: '2026-10-02T22:00:00.000Z', modality: 'Pilates', professorName: 'Carla Dias', quantity: 1
    });
  });

  it('aula no registro do currentAulaId ainda agendada: o mesmo registro é atualizado', async () => {
    banco.leads[TENANT] = [marianaLead({ currentAulaId: 'a-aberta' })];
    banco.aulas[TENANT] = [registro('a-aberta', { type: 'aula', unit: null, professorId: 'p2', professorName: 'Rafael Moura', modality: 'Musculação' })];

    await handler(pedidoAgenda({ schedule: { ...AULA_DA_CARLA, quantity: 2 } }), resposta());

    expect(aulasDaAcademia()).toHaveLength(1);
    expect(aulasDaAcademia()[0]).toMatchObject({
      id: 'a-aberta', professorId: 'p1', professorName: 'Carla Dias', modality: 'Pilates', scheduledFor: SEXTA_19H
    });
    expect(leadDaAcademia('L1')).toMatchObject({ currentAulaId: 'a-aberta', trialClassesPlanned: 2 });
    expect(interacoesDaAcademia()[0].text).toBe('🔔 Aula Experimental agendada (Pilates · 2 aulas) · Carla Dias p/ 02/10/2026, 19:00.');
  });

  it('aula do currentAulaId já resolvida: nasce outro registro', async () => {
    banco.leads[TENANT] = [marianaLead({ currentAulaId: 'a-feita' })];
    banco.aulas[TENANT] = [registro('a-feita', { type: 'aula', status: 'attended' })];

    await handler(pedidoAgenda({ schedule: AULA_DA_CARLA }), resposta());

    expect(aulasDaAcademia()).toHaveLength(2);
    const nova = aulasDaAcademia().find((a) => a.id !== 'a-feita');
    expect(leadDaAcademia('L1').currentAulaId).toBe(nova.id);
    expect(aulasDaAcademia().find((a) => a.id === 'a-feita').status).toBe('attended');
  });

  // A api/ grava com poder de admin, e o documento que o currentAulaId aponta
  // já foi lido: só vale se for uma aula deste lead. O registro de outro lead,
  // sem dono ou de visita fica como estava, e a aula nasce num registro próprio.
  it.each([
    ['é de outro lead', { leadId: 'L9', leadName: 'Outra Pessoa' }],
    ['não diz de quem é', { leadId: null }],
    ['é uma visita', { type: 'visita', unit: 'Centro', professorId: null, professorName: null, modality: null }]
  ])('currentAulaId que aponta para um registro que %s não é reaproveitado: nasce outro, e ele fica como estava', async (_, extra) => {
    const alheio = registro('a-alheia', {
      type: 'aula', unit: null, professorId: 'p2', professorName: 'Rafael Moura', modality: 'Musculação', ...extra
    });
    banco.leads[TENANT] = [marianaLead({ currentAulaId: 'a-alheia' })];
    banco.aulas[TENANT] = [{ ...alheio }];
    const res = resposta();

    await handler(pedidoAgenda({ schedule: AULA_DA_CARLA }), res);

    expect(res.statusCode).toBe(201);
    expect(aulasDaAcademia()).toHaveLength(2);
    expect(aulasDaAcademia().find((a) => a.id === 'a-alheia')).toEqual(alheio);
    const nova = aulasDaAcademia().find((a) => a.id !== 'a-alheia');
    expect(nova).toMatchObject({
      type: 'aula', leadId: 'L1', professorId: 'p1', modality: 'Pilates', scheduledFor: SEXTA_19H, status: 'agendada'
    });
    expect(leadDaAcademia('L1').currentAulaId).toBe(nova.id);
  });

  it('quem treina sozinho: a aula vai sem professor', async () => {
    await handler(pedidoAgenda({ schedule: { ...AULA_DA_CARLA, professorId: null, soloTraining: true } }), resposta());

    expect(aulasDaAcademia()[0]).toMatchObject({ professorId: null, professorName: null, soloTraining: true });
    expect(interacoesDaAcademia()[0].text).toBe('🔔 Aula Experimental agendada (Pilates · 1 aula) · Treina sozinho p/ 02/10/2026, 19:00.');
  });

  it('o gestor agenda no lead da Ana: ele é o autor, e a Ana continua dona do lead e do registro', async () => {
    await handler(pedidoAgenda({ actor: { email: JOHNNY.email } }), resposta());

    expect(interacoesDaAcademia()[0]).toMatchObject({
      consultantName: 'Johnny', actorId: 'u-johnny', actorAuthUid: 'auth-johnny', leadConsultantId: 'u-ana'
    });
    expect(aulasDaAcademia()[0]).toMatchObject({ consultantId: 'u-ana', consultantName: 'Ana Souza' });
    expect(leadDaAcademia('L1').consultantId).toBe('u-ana');
    // O gestor não participa da Meta: a tarefa do dia fica com a Ana.
    expect(leadDaAcademia('L1')).toMatchObject({ appointmentOwnerId: null, appointmentOwnerName: null });
    expect(interacoesDaAcademia()[0].text).not.toContain('tarefa de');
  });

  // Regra do dono (05/10/2026): o Bruno é consultor e agenda no lead da Ana, então
  // a tarefa do dia é dele. A Ana continua dona do lead e do registro, e a ficha
  // dela diz de quem é a tarefa.
  it('consultor que agenda no lead de outro fica com a tarefa do dia', async () => {
    const res = resposta();

    await handler(pedidoAgenda({ actor: { email: BRUNO.email, name: 'Bruno' } }), res);

    expect(res.statusCode).toBe(201);
    expect(leadDaAcademia('L1')).toMatchObject({
      consultantId: 'u-ana', consultantName: 'Ana Souza', consultantAuthUid: 'auth-ana',
      appointmentOwnerId: 'u-bruno', appointmentOwnerName: 'Bruno Lima'
    });
    expect(interacoesDaAcademia()[0]).toMatchObject({
      consultantName: 'Bruno Lima', actorId: 'u-bruno', actorAuthUid: 'auth-bruno', leadConsultantId: 'u-ana', volumeKind: 'visita',
      text: '🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 18:00 · tarefa de Bruno Lima. Obs: Vem depois do trabalho.'
    });
    expect(aulasDaAcademia()[0]).toMatchObject({ consultantId: 'u-ana', consultantAuthUid: 'auth-ana', consultantName: 'Ana Souza' });
  });

  it('menor de quem o número é responsável: agenda no lead dele e devolve o cartão do responsável', async () => {
    banco.leads[TENANT] = [menorDe('k1', 'Pedro Souza', { consultantId: 'u-bruno', consultantName: 'Bruno Lima', consultantAuthUid: 'auth-bruno' })];
    const res = resposta();

    await handler(pedidoAgenda({ phone: MAE, schedule: { leadId: 'k1' } }), res);

    expect(res.statusCode).toBe(201);
    expect(res.body.card).toMatchObject({ found: true, kind: 'responsavel', name: 'Maria Souza' });
    expect(res.body.card.wards[0]).toMatchObject({ leadId: 'k1', appointment: { type: 'visita', at: '2026-10-01T21:00:00.000Z' } });
    expect(interacoesDaAcademia()[0]).toMatchObject({ leadId: 'k1', leadConsultantId: 'u-bruno', actorId: 'u-ana' });
  });

  it.each([
    ['de outro número', () => { banco.leads[TENANT].push({ ...marianaLead(), id: 'L7', zapMatchKey: zapMatchKey(TELEFONE) }); }, 'L7'],
    ['que não existe', () => {}, 'nao-existe'],
    ['que fez 18 anos com WhatsApp próprio', () => {
      banco.leads[TENANT].push(menorDe('k9', 'Adulto', { birthDate: ts(new Date(2000, 0, 10)), whatsapp: '(11) 9 5555-4444' }));
    }, 'k9']
  ])('lead %s é recusado, sem gravar nada', async (_, preparar, leadId) => {
    preparar();
    const res = resposta();

    await handler(pedidoAgenda({ phone: leadId === 'k9' ? MAE : MARIANA, schedule: { leadId } }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: 'lead_nao_confere', message: 'Esse cadastro não é deste número no Stronilead.' });
    expect(banco.gravacoes).toEqual([]);
  });

  it('o pedido idêntico repetido: 409 com o cartão e o agendamento, sem gravar e sem outro ponto', async () => {
    await handler(pedidoAgenda(), resposta());
    const gravacoes = banco.gravacoes.length;
    const res = resposta();

    await handler(pedidoAgenda(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      error: 'ja_agendado',
      message: 'Esse agendamento já estava no Stronilead.',
      card: expect.objectContaining({ found: true, leadId: 'L1' }),
      appointment: expect.objectContaining({ leadId: 'L1', type: 'visita', at: '2026-10-01T21:00:00.000Z', unit: 'Centro' })
    });
    expect(banco.gravacoes).toHaveLength(gravacoes);
    expect(interacoesDaAcademia()).toHaveLength(1);
    expect(aulasDaAcademia()).toHaveLength(1);
  });

  // O desfecho pode ser marcado antes do horário, no mesmo dia (Agenda de hoje,
  // "Marcar desfecho" ou correção do desfecho). Visita de hoje às 18:00, "Não
  // compareceu" marcado de manhã e a lead avisando ao meio-dia que vai às 18h:
  // o pedido tem o mesmo horário e as mesmas escolhas, mas o agendamento já não
  // está em aberto. Responder ja_agendado deixaria a lead com o desfecho, sem
  // interação, sem ponto e fora das pendências do dia.
  it('visita de hoje com "Não compareceu" já marcado e o mesmo horário pedido: grava, zera o desfecho e dá o ponto, e o repetido depois responde ja_agendado', async () => {
    vi.setSystemTime(new Date('2026-10-01T15:00:00.000Z'));
    banco.leads[TENANT] = [marianaLead({
      appointmentType: 'visita', appointmentScheduledFor: ts(QUINTA_18H), appointmentUnit: 'Centro',
      nextFollowUp: ts(QUINTA_18H), nextFollowUpType: 'Visita', nextFollowUpNote: 'Vem depois do trabalho.',
      appointmentOutcome: 'no_show', appointmentOutcomeAt: ts(new Date('2026-10-01T13:00:00.000Z')), appointmentOutcomeBy: 'auth-ana'
    })];
    banco.aulas[TENANT] = [registro('v1', { scheduledFor: ts(QUINTA_18H) })];
    const res = resposta();

    await handler(pedidoAgenda(), res);

    expect(res.statusCode).toBe(201);
    expect(leadDaAcademia('L1')).toMatchObject({
      appointmentType: 'visita', appointmentScheduledFor: QUINTA_18H, appointmentUnit: 'Centro',
      appointmentOutcome: null, appointmentOutcomeAt: null, appointmentOutcomeBy: null, interactionsCount: 4
    });
    expect(res.body.appointment).toMatchObject({ type: 'visita', at: '2026-10-01T21:00:00.000Z', outcome: null });
    expect(res.body.card.appointment).toEqual({ type: 'visita', at: '2026-10-01T21:00:00.000Z', outcome: null });
    expect(interacoesDaAcademia()).toHaveLength(1);
    expect(interacoesDaAcademia()[0]).toMatchObject({
      text: '🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 18:00. Obs: Vem depois do trabalho.',
      volumeKind: 'visita', via: 'stronizap'
    });
    // O registro em aberto é o mesmo, e continua um só.
    expect(aulasDaAcademia()).toHaveLength(1);
    expect(aulasDaAcademia()[0]).toMatchObject({ id: 'v1', scheduledFor: QUINTA_18H, status: 'agendada' });

    // Agora o agendamento está em aberto: o mesmo pedido de novo é o repetido.
    const gravacoes = banco.gravacoes.length;
    const repetido = resposta();
    await handler(pedidoAgenda(), repetido);
    expect(repetido.statusCode).toBe(409);
    expect(repetido.body.error).toBe('ja_agendado');
    expect(repetido.body.appointment).toMatchObject({ type: 'visita', at: '2026-10-01T21:00:00.000Z', outcome: null });
    expect(banco.gravacoes).toHaveLength(gravacoes);
    expect(interacoesDaAcademia()).toHaveLength(1);
  });

  // Mudar só a unidade, no mesmo dia e horário, é remarcação: o assistente da
  // ficha grava, e aqui também. Responder ja_agendado perderia a troca.
  it('remarcar no mesmo dia e horário com outra unidade: grava, e o pedido idêntico depois disso é o repetido', async () => {
    await handler(pedidoAgenda(), resposta());
    const res = resposta();

    await handler(pedidoAgenda({ schedule: { unit: 'Zona Sul' } }), res);

    expect(res.statusCode).toBe(201);
    expect(res.body.appointment).toMatchObject({ type: 'visita', at: '2026-10-01T21:00:00.000Z', unit: 'Zona Sul', unitAddress: null });
    expect(leadDaAcademia('L1')).toMatchObject({ appointmentUnit: 'Zona Sul', appointmentScheduledFor: QUINTA_18H, interactionsCount: 5 });
    // O registro em aberto troca de unidade, e a linha do tempo ganha outra nota.
    expect(aulasDaAcademia()).toHaveLength(1);
    expect(aulasDaAcademia()[0]).toMatchObject({ unit: 'Zona Sul', scheduledFor: QUINTA_18H, status: 'agendada' });
    expect(interacoesDaAcademia()).toHaveLength(2);
    expect(interacoesDaAcademia()[1].text).toBe('🔔 Visita agendada (Unidade Zona Sul) p/ 01/10/2026, 18:00. Obs: Vem depois do trabalho.');

    // Agora o que o lead tem é a Zona Sul: o mesmo pedido de novo é o repetido.
    const gravacoes = banco.gravacoes.length;
    const repetido = resposta();
    await handler(pedidoAgenda({ schedule: { unit: 'Zona Sul' } }), repetido);
    expect(repetido.statusCode).toBe(409);
    expect(repetido.body.appointment).toMatchObject({ unit: 'Zona Sul' });
    expect(banco.gravacoes).toHaveLength(gravacoes);
    expect(interacoesDaAcademia()).toHaveLength(2);
  });

  it('aula no mesmo horário com outro professor: grava, e o registro em aberto muda de professor', async () => {
    await handler(pedidoAgenda({ schedule: AULA_DA_CARLA }), resposta());
    const res = resposta();

    await handler(pedidoAgenda({ schedule: { ...AULA_DA_CARLA, professorId: 'p2' } }), res);

    expect(res.statusCode).toBe(201);
    expect(res.body.appointment).toMatchObject({ type: 'aula_experimental', at: '2026-10-02T22:00:00.000Z', professorName: 'Rafael Moura' });
    expect(aulasDaAcademia()).toHaveLength(1);
    expect(aulasDaAcademia()[0]).toMatchObject({ professorId: 'p2', professorName: 'Rafael Moura', scheduledFor: SEXTA_19H });
    expect(leadDaAcademia('L1')).toMatchObject({
      appointmentProfessorId: 'p2', appointmentProfessorName: 'Rafael Moura', currentAulaId: aulasDaAcademia()[0].id
    });
    expect(interacoesDaAcademia()).toHaveLength(2);
    expect(interacoesDaAcademia()[1].text).toBe('🔔 Aula Experimental agendada (Pilates · 1 aula) · Rafael Moura p/ 02/10/2026, 19:00.');
  });

  // Anotação escrita e diferente da que o lead tem é edição, e grava. Pedido
  // sem anotação nunca conta como mudança: o balão do Stronizap não recebe a
  // anotação que o lead já tem, então em branco quer dizer "não digitei".
  it('o mesmo agendamento só com a anotação trocada grava: outra interação e a anotação nova no lead', async () => {
    await handler(pedidoAgenda(), resposta());
    const res = resposta();

    await handler(pedidoAgenda({ schedule: { note: 'Vem de manhã.' } }), res);

    expect(res.statusCode).toBe(201);
    expect(leadDaAcademia('L1')).toMatchObject({
      nextFollowUpNote: 'Vem de manhã.', appointmentScheduledFor: QUINTA_18H, interactionsCount: 5
    });
    expect(interacoesDaAcademia()).toHaveLength(2);
    expect(interacoesDaAcademia()[1].text).toBe('🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 18:00. Obs: Vem de manhã.');
    // O registro em aberto continua um só.
    expect(aulasDaAcademia()).toHaveLength(1);
  });

  it('o mesmo agendamento sem anotação, em lead com anotação, responde ja_agendado e mantém a anotação', async () => {
    await handler(pedidoAgenda(), resposta());
    const gravacoes = banco.gravacoes.length;
    const res = resposta();

    await handler(pedidoAgenda({ schedule: { note: null } }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('ja_agendado');
    expect(banco.gravacoes).toHaveLength(gravacoes);
    expect(interacoesDaAcademia()).toHaveLength(1);
    expect(aulasDaAcademia()).toHaveLength(1);
    expect(leadDaAcademia('L1')).toMatchObject({ nextFollowUpNote: 'Vem depois do trabalho.', interactionsCount: 4 });
  });

  // O caminho do contrato para a resposta perdida: a gravação entrou, a leitura
  // do cartão caiu, o Stronizap recebe 5xx, tenta de novo e recebe ja_agendado.
  // Aqui cai a busca do dono do número, uma das duas consultas do schedule que
  // levam o telefone (a outra é a dos menores, nos dois testes a seguir).
  it('gravou e a leitura do cartão falhou: o erro sobe sem o telefone, e o "Tentar de novo" recebe ja_agendado sem gravar outra vez', async () => {
    banco.falhaEm = 'zapMatchKey';

    const erro = await handler(pedidoAgenda(), resposta()).catch((e) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(erro.message).toBe('zap schedule falhou (9)');
    expect(String(erro.stack)).not.toContain(zapMatchKey(MARIANA));
    // A gravação já tinha entrado, inteira.
    expect(banco.gravacoes).toHaveLength(3);

    banco.falhaEm = null;
    const res = resposta();
    await handler(pedidoAgenda(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      error: 'ja_agendado',
      message: 'Esse agendamento já estava no Stronilead.',
      card: expect.objectContaining({
        found: true, leadId: 'L1', appointment: { type: 'visita', at: '2026-10-01T21:00:00.000Z', outcome: null }
      }),
      appointment: {
        leadId: 'L1', leadName: 'Mariana Souza', type: 'visita', at: '2026-10-01T21:00:00.000Z',
        unit: 'Centro', unitAddress: 'Rua Garibaldi, 1200', modality: null, professorName: null,
        soloTraining: false, quantity: null, outcome: null
      }
    });
    expect(banco.gravacoes).toHaveLength(3);
    expect(interacoesDaAcademia()).toHaveLength(1);
    expect(aulasDaAcademia()).toHaveLength(1);
    expect(leadDaAcademia('L1').interactionsCount).toBe(4);
  });

  // A busca dos menores também é leitura do cartão. O contrato promete o cartão
  // já com o agendamento novo, e um 201 com `found: false` (número só de
  // responsável) ou sem `wards` (dona do número com filhos) mentiria ao
  // atendente. O erro sobe, e o "Tentar de novo" recebe ja_agendado com o
  // cartão inteiro. No GET e no match a busca dos menores continua tolerada.
  it('agendou o menor e a busca dos menores falhou na leitura do cartão: o erro sobe, e o "Tentar de novo" recebe ja_agendado com o cartão do responsável', async () => {
    banco.leads[TENANT] = [menorDe('k1', 'Pedro Souza')];
    banco.falhaEm = 'guardianZapMatchKey';
    const pedidoDoMenor = () => pedidoAgenda({ phone: MAE, schedule: { leadId: 'k1' } });
    const res = resposta();

    const erro = await handler(pedidoDoMenor(), res).catch((e) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(erro.message).toBe('zap schedule falhou (9)');
    expect(String(erro.stack)).not.toContain(zapMatchKey(MAE));
    expect(res.body).toBeUndefined();
    // A gravação já tinha entrado, inteira.
    expect(banco.gravacoes).toHaveLength(3);

    banco.falhaEm = null;
    const retry = resposta();
    await handler(pedidoDoMenor(), retry);

    expect(retry.statusCode).toBe(409);
    expect(retry.body.error).toBe('ja_agendado');
    expect(retry.body.card).toMatchObject({ found: true, kind: 'responsavel', name: 'Maria Souza' });
    expect(retry.body.card.wards).toHaveLength(1);
    expect(retry.body.card.wards[0]).toMatchObject({
      leadId: 'k1', appointment: { type: 'visita', at: '2026-10-01T21:00:00.000Z', outcome: null }
    });
    expect(retry.body.appointment).toMatchObject({ leadId: 'k1', type: 'visita', unit: 'Centro' });
    expect(banco.gravacoes).toHaveLength(3);
    expect(interacoesDaAcademia()).toHaveLength(1);
  });

  it('agendou a dona do número que tem filhos e a busca dos menores falhou: o erro sobe, em vez de um cartão sem wards', async () => {
    banco.leads[TENANT] = [marianaLead({ zapMatchKey: zapMatchKey(MAE) }), menorDe('k1', 'Pedro Souza')];
    banco.falhaEm = 'guardianZapMatchKey';
    const pedidoDaMae = () => pedidoAgenda({ phone: MAE });
    const res = resposta();

    const erro = await handler(pedidoDaMae(), res).catch((e) => e);

    expect(erro.message).toBe('zap schedule falhou (9)');
    expect(String(erro.stack)).not.toContain(zapMatchKey(MAE));
    expect(res.body).toBeUndefined();
    expect(banco.gravacoes).toHaveLength(3);

    banco.falhaEm = null;
    const retry = resposta();
    await handler(pedidoDaMae(), retry);

    expect(retry.statusCode).toBe(409);
    expect(retry.body.card).toMatchObject({ found: true, leadId: 'L1', kind: 'lead' });
    expect(retry.body.card.wards.map((w) => w.leadId)).toEqual(['k1']);
    expect(banco.gravacoes).toHaveLength(3);
  });

  it('lead que só existe em outra academia, com o mesmo número, é recusado, e nada é gravado lá', async () => {
    academia(OUTRA);
    banco.leads[OUTRA] = [marianaLead({ id: 'L-outra' })];
    const res = resposta();

    await handler(pedidoAgenda({ schedule: { leadId: 'L-outra' } }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe('lead_nao_confere');
    expect(banco.gravacoes).toEqual([]);
    expect(banco.leads[OUTRA][0].appointmentType).toBeUndefined();
  });

  it.each([[7], ['a/b'], ['__x__']])('currentAulaId estragado no lead (%j) não derruba o agendamento: nasce outro registro', async (estragado) => {
    banco.leads[TENANT] = [marianaLead({ currentAulaId: estragado })];
    const res = resposta();

    await handler(pedidoAgenda({ schedule: AULA_DA_CARLA }), res);

    expect(res.statusCode).toBe(201);
    expect(aulasDaAcademia()).toHaveLength(1);
    expect(leadDaAcademia('L1').currentAulaId).toBe(aulasDaAcademia()[0].id);
  });

  it('pessoa da equipe sem nome no Stronilead: vale o nome que o Stronizap mandou', async () => {
    banco.users[TENANT] = [{ ...ANA, name: '' }];

    await handler(pedidoAgenda(), resposta());

    expect(interacoesDaAcademia()[0].consultantName).toBe('Ana');
  });

  // O limite conta tentativas: vem antes da leitura da equipe e das listas.
  it.each([
    ['fora da equipe', { actor: { email: 'carla@stronix.com.br' } }, 403],
    ['item que mudou', { schedule: { unit: 'Unidade Antiga' } }, 422],
    ['horário que passou', { schedule: { date: '2026-09-29', time: '15:00' } }, 422],
    ['lead de outro número', { schedule: { leadId: 'nao-existe' } }, 422]
  ])('recusa por regra (%s) gasta o limite', async (_, mudanca, status) => {
    const res = resposta();

    await handler(pedidoAgenda(mudanca), res);

    expect(res.statusCode).toBe(status);
    expect(limitador.chamadas).toHaveLength(1);
    expect(banco.gravacoes).toEqual([]);
  });

  it('dois pedidos ao mesmo tempo gravam uma vez só', async () => {
    const [a, b] = [resposta(), resposta()];

    await Promise.all([
      handler(pedidoAgenda(), a),
      handler(pedidoAgenda({ actor: { email: BRUNO.email } }), b)
    ]);

    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409]);
    expect(interacoesDaAcademia()).toHaveLength(1);
    expect(aulasDaAcademia()).toHaveLength(1);
    expect(leadDaAcademia('L1').interactionsCount).toBe(4);
  });

  it('horário que já passou é recusado, sem gravar', async () => {
    const res = resposta();

    await handler(pedidoAgenda({ schedule: { date: '2026-09-29', time: '15:00' } }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: 'horario_passado', message: 'Esse horário já passou. Escolha outro.' });
    expect(banco.gravacoes).toEqual([]);
  });

  it.each([
    ['unit', { unit: 'Unidade Antiga' }],
    ['modality', { ...AULA_DA_CARLA, modality: 'Crossfit' }],
    ['professorId', { ...AULA_DA_CARLA, professorId: 'p3' }],
    ['professorId', { ...AULA_DA_CARLA, modality: 'Musculação' }],
    ['quantity', { ...AULA_DA_CARLA, quantity: 4 }]
  ])('item que mudou no Stronilead (%s) é recusado e diz o campo', async (field, schedule) => {
    const res = resposta();

    await handler(pedidoAgenda({ schedule }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toMatchObject({ error: 'catalogo_mudou', field });
    expect(banco.gravacoes).toEqual([]);
  });

  it('professor com modalidadeIds malformado no cadastro é recusado como item que mudou, sem derrubar a ação', async () => {
    banco.catalogos[TENANT].stronix_professores.push({ id: 'p7', nome: 'Duda Lins', modalidadeIds: 7, order: 4 });
    const res = resposta();

    await handler(pedidoAgenda({ schedule: { ...AULA_DA_CARLA, professorId: 'p7' } }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toMatchObject({ error: 'catalogo_mudou', field: 'professorId' });
    expect(banco.gravacoes).toEqual([]);
  });

  it('academia sem unidade: a visita vai sem unidade', async () => {
    banco.catalogos[TENANT].stronix_units = [];
    const res = resposta();

    await handler(pedidoAgenda({ schedule: { unit: null, note: null } }), res);

    expect(res.statusCode).toBe(201);
    expect(interacoesDaAcademia()[0].text).toBe('🔔 Visita agendada p/ 01/10/2026, 18:00.');
    expect(aulasDaAcademia()[0].unit).toBeNull();
  });

  it('com unidade cadastrada, visita sem unidade é campo a escolher', async () => {
    const res = resposta();

    await handler(pedidoAgenda({ schedule: { unit: null } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'dados_invalidos', field: 'unit', message: 'Escolha a unidade.' });
  });

  it('pessoa fora da equipe não agenda', async () => {
    const res = resposta();

    await handler(pedidoAgenda({ actor: { email: 'carla@stronix.com.br' } }), res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('fora_da_equipe');
    expect(banco.gravacoes).toEqual([]);
  });

  it('academia com teste vencido não agenda nem gasta o limite', async () => {
    Object.assign(banco.tenants[TENANT], { status: 'trial', trialEndsAt: ts(new Date('2026-09-01T00:00:00.000Z')) });
    const res = resposta();

    await handler(pedidoAgenda(), res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('academia_bloqueada');
    expect(limitador.chamadas).toEqual([]);
  });

  it('passou de 60 agendamentos na hora: recusa sem gravar', async () => {
    limitador.ok = false;
    const res = resposta();

    await handler(pedidoAgenda(), res);

    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: 'limite', message: 'Muitos agendamentos em pouco tempo. Tente de novo em alguns minutos.' });
    expect(banco.gravacoes).toEqual([]);
  });

  it('pedido com formato errado responde 400 sem gastar o limite', async () => {
    const res = resposta();

    await handler(pedidoAgenda({ schedule: { date: '2026-02-30' } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'dados_invalidos', field: 'date', message: 'Escolha o dia.' });
    expect(limitador.chamadas).toEqual([]);
  });

  it('erro do banco no meio do agendamento sobe sem o telefone e sem gravar nada', async () => {
    banco.falhaEm = 'leadId';

    const erro = await handler(pedidoAgenda(), resposta()).catch((e) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(erro.message).toBe('zap schedule falhou (9)');
    expect(String(erro.stack)).not.toContain(MARIANA);
    expect(banco.gravacoes).toEqual([]);
  });

  it('chave de outra academia não agenda', async () => {
    academia(OUTRA);
    banco.users[OUTRA] = [ANA];
    const res = resposta();
    const p = pedidoAgenda();
    p.body.tenant = OUTRA;

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(banco.gravacoes).toEqual([]);
  });
});

const pedidoStatus = (leadIds) => ({
  method: 'POST',
  headers: { 'x-stronizap-key': chave },
  body: { action: 'appointment-status', tenant: TENANT, leadIds }
});

describe('POST /api/zap com action appointment-status', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AGORA);
    zerarBanco();
    chave = academia(TENANT);
    banco.catalogos[TENANT] = catalogosDaAcademia();
    banco.leads[TENANT] = [
      marianaLead({ appointmentType: 'visita', appointmentScheduledFor: ts(new Date('2026-10-01T21:00:00.000Z')), appointmentUnit: 'Centro' }),
      menorDe('k1', 'Pedro Souza', {
        appointmentType: 'aula_experimental', appointmentScheduledFor: ts(new Date('2026-10-02T22:00:00.000Z')),
        appointmentModality: 'Pilates', appointmentProfessorName: 'Carla Dias', appointmentSoloTraining: false,
        trialClassesPlanned: 2, appointmentOutcome: 'attended'
      }),
      menorDe('k2', 'Ana Souza'),
      menorDe('k3', 'Caio Souza', {
        appointmentType: null, appointmentScheduledFor: null, nextFollowUpType: 'Visita', appointmentOutcome: 'cancelled'
      })
    ];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('devolve o agendamento de cada lead, e null para quem não tem, foi cancelado ou não existe', async () => {
    const res = resposta();

    await handler(pedidoStatus(['L1', 'k1', 'k2', 'k3', 'nao-existe']), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      appointments: {
        L1: {
          leadId: 'L1', leadName: 'Mariana Souza', type: 'visita', at: '2026-10-01T21:00:00.000Z',
          unit: 'Centro', unitAddress: 'Rua Garibaldi, 1200', modality: null, professorName: null,
          soloTraining: false, quantity: null, outcome: null
        },
        k1: {
          leadId: 'k1', leadName: 'Pedro Souza', type: 'aula_experimental', at: '2026-10-02T22:00:00.000Z',
          unit: null, unitAddress: null, modality: 'Pilates', professorName: 'Carla Dias',
          soloTraining: false, quantity: 2, outcome: 'attended'
        },
        k2: null,
        k3: null,
        'nao-existe': null
      }
    });
    expect(banco.gravacoes).toEqual([]);
    expect(limitador.chamadas).toEqual([]);
  });

  it('lead de outra academia volta null', async () => {
    academia(OUTRA);
    banco.leads[OUTRA] = [marianaLead({ id: 'L-outra', appointmentType: 'visita', appointmentScheduledFor: ts(AGORA) })];
    const res = resposta();

    await handler(pedidoStatus(['L-outra']), res);

    expect(res.body).toEqual({ appointments: { 'L-outra': null } });
  });

  it('responde mesmo com a academia bloqueada, como o GET do cartão', async () => {
    banco.tenants[TENANT].status = 'suspended';
    const res = resposta();

    await handler(pedidoStatus(['L1']), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.appointments.L1).toMatchObject({ type: 'visita' });
  });

  it.each([
    ['vazia', []],
    ['com 31 ids', Array.from({ length: 31 }, (_, i) => `L${i}`)],
    ['com id repetido', ['L1', 'L1']],
    ['com id que não é texto', ['L1', 7]]
  ])('lista %s é recusada no campo leadIds', async (_, leadIds) => {
    const res = resposta();

    await handler(pedidoStatus(leadIds), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'dados_invalidos', field: 'leadIds', message: 'Envie de 1 a 30 leads, sem repetir.' });
  });

  it('chave errada responde 401 e não lê nada', async () => {
    // Qualquer leitura de lead estouraria: o 401 sai antes dela.
    banco.falhaEm = 'documento';
    const res = resposta();
    const p = pedidoStatus(['L1']);
    p.headers['x-stronizap-key'] = generateZapKey().key;

    await handler(p, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Credencial inválida' });
  });

  it('chave revogada responde 401: só a conferência de academia bloqueada fica de fora', async () => {
    banco.tenants[TENANT].integrations.zap.revokedAt = ts(AGORA);
    const res = resposta();

    await handler(pedidoStatus(['L1']), res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Credencial inválida' });
  });

  it('erro do banco sobe sem o caminho do lead', async () => {
    banco.falhaEm = 'documento';

    const erro = await handler(pedidoStatus(['L1']), resposta()).catch((e) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(erro.message).toBe('zap appointment-status falhou (14)');
    expect(String(erro.stack)).not.toContain('stronix_leads/L1');
  });
});

// ---------------------------------------------------------------------------
// O professor na ponte (spec docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md)
// ---------------------------------------------------------------------------

// Caio, professor de pilates (p1 do cadastro de professores), com login e o
// mesmo e-mail no Stronizap, onde usa o canal dos professores. O cadastro do
// professor nasce pelo servidor, com o id igual ao uid da conta.
const CAIO = {
  id: 'auth-caio', name: 'Caio Prof', email: 'caio@stronix.com.br', authUid: 'auth-caio', role: 'professor', professorId: 'p1'
};
const PROFESSOR_NAO_CADASTRA = 'Seu acesso de professor no Stronilead não cadastra lead. Peça a um consultor ou ao gestor.';
const PROFESSOR_DESLIGADO = 'O acesso de professor está desligado nesta academia. Fale com o gestor.';

describe('POST /api/zap: o professor', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AGORA);
    zerarBanco();
    academiaComEquipe();
    banco.users[TENANT].push(CAIO);
    banco.tenants[TENANT].modules = ['faltosos'];
    banco.leads[TENANT] = [marianaLead()];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('não abre o cadastro de lead', async () => {
    const res = resposta();

    await handler(pedidoOpcoes(CAIO.email), res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'fora_da_equipe', message: PROFESSOR_NAO_CADASTRA });
  });

  it('não cadastra lead, nem com o pedido montado à mão', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ actor: { email: CAIO.email, name: 'Caio' } }), res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'fora_da_equipe', message: PROFESSOR_NAO_CADASTRA });
    expect(leadsDaAcademia().map((l) => l.id)).toEqual(['L1']);
    expect(banco.gravacoes).toEqual([]);
  });

  it('não aparece na equipe que o gestor vê no cadastro', async () => {
    const res = resposta();

    await handler(pedidoOpcoes(JOHNNY.email), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.team.map((u) => u.id)).toEqual(['u-ana', 'u-bruno', 'u-johnny']);
  });

  it('não vira dono do lead que o gestor cadastra', async () => {
    const res = resposta();

    await handler(pedidoCadastro({ actor: { email: JOHNNY.email }, lead: { ownerId: CAIO.id } }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: 'responsavel_invalido', message: 'Essa pessoa não está mais na equipe do Stronilead.' });
    expect(leadsDaAcademia().map((l) => l.id)).toEqual(['L1']);
  });

  it('abre o balão do agendamento como consultor e fora da Meta', async () => {
    const res = resposta();

    await handler(pedidoOpcoesAgenda({ email: CAIO.email }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.actor).toEqual({ id: CAIO.id, name: 'Caio Prof', role: 'consultor', countsForMeta: false });
  });

  it('agenda no nome dele, e o lead continua com a dona', async () => {
    const res = resposta();

    await handler(pedidoAgenda({ actor: { email: CAIO.email, name: 'Caio' } }), res);

    expect(res.statusCode).toBe(201);
    expect(interacoesDaAcademia()).toEqual([expect.objectContaining({
      consultantName: 'Caio Prof', actorId: CAIO.id, actorAuthUid: 'auth-caio',
      leadConsultantId: 'u-ana', leadConsultantAuthUid: 'auth-ana', type: 'note', volumeKind: 'visita'
    })]);
    expect(leadDaAcademia('L1')).toMatchObject({
      consultantId: 'u-ana', consultantAuthUid: 'auth-ana', appointmentType: 'visita', appointmentOutcome: null
    });
  });

  it('com o módulo desligado, não abre o balão nem agenda', async () => {
    banco.tenants[TENANT].modules = [];
    const opcoes = resposta();
    const agenda = resposta();

    await handler(pedidoOpcoesAgenda({ email: CAIO.email }), opcoes);
    await handler(pedidoAgenda({ actor: { email: CAIO.email, name: 'Caio' } }), agenda);

    expect(opcoes.statusCode).toBe(403);
    expect(opcoes.body).toEqual({ error: 'fora_da_equipe', message: PROFESSOR_DESLIGADO });
    expect(agenda.statusCode).toBe(403);
    expect(agenda.body).toEqual({ error: 'fora_da_equipe', message: PROFESSOR_DESLIGADO });
    expect(interacoesDaAcademia()).toEqual([]);
    expect(aulasDaAcademia()).toEqual([]);
    expect(banco.gravacoes).toEqual([]);
  });

  it('com o módulo desligado, a consultora continua agendando', async () => {
    banco.tenants[TENANT].modules = [];
    const res = resposta();

    await handler(pedidoAgenda(), res);

    expect(res.statusCode).toBe(201);
  });
});
