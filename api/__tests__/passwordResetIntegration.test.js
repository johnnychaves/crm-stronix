import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import util from 'node:util';
import querystring from 'node:querystring';
import handler from '../tenant-resolve.js';
import adminUsers from '../admin-users.js';
import { CONFIRM_MIN_MS } from '../_passwordResetRoute.js';
import {
  RESET_ACTION_REQUEST, RESET_ACTION_CONFIRM, RESET_CODES_PER_DAY,
  CODE_REFUSED_MESSAGE, TOO_MANY_MESSAGE, SEND_FAILED_MESSAGE, SAVE_FAILED_MESSAGE,
} from '../../src/lib/passwordReset.js';

// O "Esqueci a senha" de ponta a ponta, pelo handler do tenant-resolve. A rota,
// o fluxo, o repositório, a impressão do código e o limitador são os de verdade.
// Só o Firebase Admin (Auth e Firestore, com transação), o waitUntil da Vercel e
// a rede (o Resend e o SDK do Sentry) são falsos. Os outros testes olham cada
// peça com as vizinhas falsas; este prova que elas se encaixam. O e-mail de
// login trocado pelo gestor passa pela ação set-email de verdade, do
// api/admin-users.js, com os mesmos falsos.

const h = vi.hoisted(() => ({
  docs: new Map(), contas: new Map(), senhas: [], emails: [], revogadas: [], adiados: [], enviados: [], sessao: null,
}));

vi.mock('../_firebaseAdmin.js', () => {
  const copia = (v) => (v === undefined ? undefined : structuredClone(v));
  const foto = (caminho) => {
    const dados = h.docs.get(caminho);
    return { exists: dados !== undefined, id: caminho.split('/').at(-1), ref: doc(caminho), data: () => copia(dados) };
  };
  const doc = (caminho) => ({
    caminho,
    id: caminho.split('/').at(-1),
    collection: (nome) => colecao(`${caminho}/${nome}`),
    get: async () => foto(caminho),
    update: async (dados) => {
      if (!h.docs.has(caminho)) throw new Error(`NOT_FOUND: ${caminho}`);
      h.docs.set(caminho, { ...h.docs.get(caminho), ...copia(dados) });
    },
  });
  const colecao = (caminho, filtros = [], limite = Infinity) => ({
    doc: (id) => doc(`${caminho}/${id}`),
    where: (campo, _op, valor) => colecao(caminho, [...filtros, [campo, valor]], limite),
    limit: (n) => colecao(caminho, filtros, n),
    add: async (dados) => {
      const id = `auto-${h.docs.size}`;
      h.docs.set(`${caminho}/${id}`, copia(dados));
      return doc(`${caminho}/${id}`);
    },
    // Como a busca do SDK: só os documentos da coleção, ordenados pelo id.
    get: async () => {
      const prefixo = `${caminho}/`;
      const docs = [...h.docs.keys()]
        .filter((k) => k.startsWith(prefixo) && !k.slice(prefixo.length).includes('/'))
        .sort()
        .map(foto)
        .filter((f) => filtros.every(([campo, valor]) => f.data()?.[campo] === valor))
        .slice(0, limite);
      return { empty: docs.length === 0, docs };
    },
  });
  const adminDb = {
    collection: (nome) => colecao(nome),
    // Como o SDK: as leituras vêm antes das escritas, e as escritas só valem no fim.
    runTransaction: async (fn) => {
      const escritas = [];
      const tx = {
        get: async (ref) => {
          if (escritas.length) throw new Error('Firestore transactions require all reads to be executed before all writes.');
          return ref.get();
        },
        set: (ref, dados) => { escritas.push(() => h.docs.set(ref.caminho, copia(dados))); },
        update: (ref, dados) => {
          escritas.push(() => {
            if (!h.docs.has(ref.caminho)) throw new Error(`NOT_FOUND: ${ref.caminho}`);
            h.docs.set(ref.caminho, { ...h.docs.get(ref.caminho), ...copia(dados) });
          });
        },
      };
      const saida = await fn(tx);
      for (const escrita of escritas) escrita();
      return saida;
    },
  };
  // Como o Firebase: trocar a senha e revogar as sessões adiantam a marca das
  // sessões. Trocar o e-mail não adianta aqui, de propósito: o teste do e-mail
  // trocado prova que quem mata o código pendente é a revogação da ação
  // set-email, e não um efeito do Firebase que pode mudar.
  const adiantaMarca = (uid) => {
    for (const c of h.contas.values()) if (c.uid === uid) c.tokensValidAfterTime = new Date(Date.now() + 1000).toUTCString();
  };
  const semConta = () => Object.assign(new Error('There is no user record'), { code: 'auth/user-not-found' });
  const contaPorUid = (uid) => [...h.contas.values()].find((c) => c.uid === uid);
  const adminAuth = {
    getUser: async (uid) => {
      const c = contaPorUid(uid);
      if (!c) throw semConta();
      return copia(c);
    },
    getUserByEmail: async (email) => {
      const c = h.contas.get(String(email).toLowerCase());
      if (!c) throw semConta();
      return copia(c);
    },
    updateUser: async (uid, patch) => {
      const c = contaPorUid(uid);
      if (!c) throw semConta();
      if ('email' in patch) {
        // As contas moram pelo e-mail, como o getUserByEmail as acha.
        h.contas.delete(c.email);
        c.email = patch.email;
        if ('emailVerified' in patch) c.emailVerified = patch.emailVerified;
        h.contas.set(c.email, c);
        h.emails.push({ uid, email: patch.email, emailVerified: patch.emailVerified });
      }
      if ('password' in patch) {
        h.senhas.push({ uid, password: patch.password });
        adiantaMarca(uid);
      }
    },
    revokeRefreshTokens: async (uid) => {
      h.revogadas.push(uid);
      adiantaMarca(uid);
    },
  };
  return {
    adminDb,
    adminAuth,
    admin: { firestore: { FieldValue: { serverTimestamp: () => 'agora' } } },
    // A sessão de quem chama o api/admin-users.js. O tenant-resolve não usa.
    verifyRequest: async () => copia(h.sessao),
  };
});
// Como o de verdade, que só aceita promessa. Guarda o trabalho de depois da resposta.
vi.mock('@vercel/functions', () => ({
  waitUntil: (p) => {
    if (p === null || typeof p !== 'object' || typeof p.then !== 'function') throw new TypeError('waitUntil só aceita promessa');
    h.adiados.push(p);
  },
}));
// O SDK do Sentry fica sem rede, mesmo com um SENTRY_DSN no ambiente.
vi.mock('@sentry/node', () => ({
  init: () => {},
  captureException: () => {},
  flush: async () => true,
  httpIntegration: () => ({ name: 'Http' }),
}));

const ACADEMIA = 'academia-teste';
const EQUIPE = `artifacts/${ACADEMIA}/public/data/stronix_users`;
const IP = '203.0.113.7';
const SENHA = 'Nova@Senha1';
const JSON_HEADERS = { 'content-type': 'application/json' };
// Escrito por extenso: a outra metade da cota grátis do Resend é do Stronizap.
const TETO = 50;
const QUINZE_MINUTOS = 15 * 60 * 1000;

let consoles;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-29T12:00:00Z'));
  vi.stubEnv('FIREBASE_ADMIN_PRIVATE_KEY', 'chave-privada-de-teste');
  vi.stubEnv('RESEND_API_KEY', 're_chave_de_teste_0123456789');
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('MAIL_FROM', '');
  h.docs.clear();
  h.contas.clear();
  h.senhas = [];
  h.emails = [];
  h.revogadas = [];
  h.adiados = [];
  h.enviados = [];
  h.sessao = null;
  // O Resend falso. Qualquer outro endereço é rede de verdade, e o teste falha.
  vi.stubGlobal('fetch', async (url, init) => {
    if (url !== 'https://api.resend.com/emails') throw new Error(`fetch inesperado: ${url}`);
    h.enviados.push(JSON.parse(init.body));
    return { ok: true, status: 200, json: async () => ({ id: `em_${h.enviados.length}` }) };
  });
  // Tudo que a rota, o fluxo e o repositório escrevem no console fica aqui.
  consoles = ['info', 'error', 'warn', 'log'].map((nivel) => vi.spyOn(console, nivel).mockImplementation(() => {}));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Contas da academia, cada uma com o cadastro na equipe: pessoa0@academia.com e
// seguintes, com o uid u0 e seguintes.
function semear(quantas) {
  h.docs.set(`tenants/${ACADEMIA}`, { status: 'active', displayName: 'Academia Teste' });
  for (let i = 0; i < quantas; i += 1) {
    const email = `pessoa${i}@academia.com`;
    h.contas.set(email, {
      uid: `u${i}`, email, displayName: `Pessoa ${i}`, disabled: false,
      customClaims: { tenantId: ACADEMIA },
      metadata: { lastSignInTime: 'Sun, 28 Sep 2026 10:00:00 GMT' },
      tokensValidAfterTime: 'Sun, 28 Sep 2026 09:00:00 GMT',
    });
    h.docs.set(`${EQUIPE}/u${i}`, { authUid: `u${i}`, email, name: `Pessoa ${i}` });
  }
}

const resposta = () => ({
  statusCode: 0,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});
const post = (body, ip, headers) => ({ method: 'POST', headers: { ...headers, 'x-forwarded-for': ip }, body });

// O pedido, com o trabalho que ficou no waitUntil já terminado.
async function pedir(email, ip = IP) {
  const res = resposta();
  const antes = h.adiados.length;
  await handler(post({ action: RESET_ACTION_REQUEST, email }, ip, JSON_HEADERS), res);
  await Promise.all(h.adiados.slice(antes));
  return res;
}

// A troca, com o relógio falso andando o piso inteiro.
async function trocar({ email, code, newPassword = SENHA }, ip = IP) {
  const res = resposta();
  const feito = handler(post({ action: RESET_ACTION_CONFIRM, email, code, newPassword }, ip, JSON_HEADERS), res);
  await vi.advanceTimersByTimeAsync(CONFIRM_MIN_MS);
  await feito;
  return res;
}

// O código como a pessoa o lê: a linha de 6 números do texto do e-mail.
const codigoDo = (enviado) => enviado.text.split('\n').find((linha) => /^\d{6}$/.test(linha));

// Pede um código diferente do dado. O sorteio repete uma vez em um milhão, e um
// pedido novo troca o código. Três vezes igual é sorteio preso, e o teste falha.
async function pedirOutroCodigo(email, diferenteDe) {
  await pedir(email);
  for (let i = 0; i < 3 && codigoDo(h.enviados.at(-1)) === diferenteDe; i += 1) await pedir(email);
  const codigo = codigoDo(h.enviados.at(-1));
  expect(codigo).not.toBe(diferenteDe);
  return codigo;
}
const auditoria = () => [...h.docs.entries()].filter(([k]) => k.startsWith('superadmin_audit/')).map(([, v]) => v);
// Tudo o que foi para o console, como texto e sem corte: o inspect para em 100
// itens por padrão.
const linhas = () => util.inspect(consoles.flatMap((spy) => spy.mock.calls), {
  depth: null, maxArrayLength: Infinity, maxStringLength: Infinity, breakLength: Infinity,
});

describe('pedido e troca de verdade', () => {
  it('o código chega no e-mail, a troca com ele grava a senha nova e só o HMAC fica no banco', async () => {
    semear(1);
    const pedido = await pedir('  Pessoa0@Academia.com ');
    expect([pedido.statusCode, pedido.body]).toEqual([200, { ok: true }]);
    expect(h.enviados).toHaveLength(1);
    expect(h.enviados[0].to).toEqual(['pessoa0@academia.com']);
    const codigo = codigoDo(h.enviados[0]);
    expect(codigo).toMatch(/^\d{6}$/);
    expect(h.enviados[0].subject).not.toMatch(/\d/);
    expect(Object.values(h.docs.get('_password_reset/u0'))).not.toContain(codigo);

    const troca = await trocar({ email: 'pessoa0@academia.com', code: codigo });
    expect([troca.statusCode, troca.body]).toEqual([200, { ok: true }]);
    expect(h.senhas).toEqual([{ uid: 'u0', password: SENHA }]);
    expect(h.revogadas).toEqual(['u0']);
    expect(h.docs.get('_password_reset/u0').usedAtMs).toEqual(expect.any(Number));
    expect(auditoria()).toEqual([{
      action: 'password.reset', tenantId: ACADEMIA, actorUid: 'u0',
      details: { via: 'codigo-por-email', ambiente: 'production' }, at: 'agora',
    }]);
  });

  it('o código da conta A usado na conta B dá 400 e não troca nada', async () => {
    semear(2);
    await pedir('pessoa0@academia.com');
    const codigoA = codigoDo(h.enviados[0]);
    await pedirOutroCodigo('pessoa1@academia.com', codigoA);

    const res = await trocar({ email: 'pessoa1@academia.com', code: codigoA });
    expect([res.statusCode, res.body]).toEqual([400, { error: CODE_REFUSED_MESSAGE }]);
    expect(h.senhas).toEqual([]);
    expect(h.revogadas).toEqual([]);
    expect(auditoria()).toEqual([]);
    // A tentativa gasta é a de B. O código de A continua vivo para A.
    expect(h.docs.get('_password_reset/u1')).toMatchObject({ attempts: 1, usedAtMs: null });
    expect(h.docs.get('_password_reset/u0')).toMatchObject({ attempts: 0, usedAtMs: null });
  });

  it('o mesmo código não vale duas vezes', async () => {
    semear(1);
    await pedir('pessoa0@academia.com');
    const codigo = codigoDo(h.enviados[0]);
    expect((await trocar({ email: 'pessoa0@academia.com', code: codigo })).statusCode).toBe(200);

    const segunda = await trocar({ email: 'pessoa0@academia.com', code: codigo, newPassword: 'Outra@Senha2' });
    expect([segunda.statusCode, segunda.body]).toEqual([400, { error: CODE_REFUSED_MESSAGE }]);
    expect(h.senhas).toHaveLength(1);
  });
});

describe('limites', () => {
  it('o 21º pedido do mesmo IP no dia dá 429, mesmo com a janela de 15 minutos livre', async () => {
    semear(5);
    const status = [];
    // Quatro janelas de 15 minutos, com 5 pedidos em cada.
    for (let janela = 0; janela < 4; janela += 1) {
      for (let i = 0; i < 5; i += 1) status.push((await pedir(`pessoa${i}@academia.com`)).statusCode);
      vi.advanceTimersByTime(QUINZE_MINUTOS);
    }
    expect(status).toEqual(Array(20).fill(200));
    expect(h.enviados).toHaveLength(20);

    const vigesimoPrimeiro = await pedir('pessoa0@academia.com');
    expect([vigesimoPrimeiro.statusCode, vigesimoPrimeiro.body]).toEqual([429, { error: TOO_MANY_MESSAGE }]);
    expect(h.enviados).toHaveLength(20);
    // O limite é do IP: outro IP pede para a mesma conta.
    expect((await pedir('pessoa0@academia.com', '198.51.100.1')).statusCode).toBe(200);
    expect(h.enviados).toHaveLength(21);
  });

  it('o teto de e-mails do dia para de mandar, sem emitir código e com mail_cap no log', async () => {
    // Cada conta recebe 5 códigos por dia, então o teto precisa de 10 contas, e a
    // 11ª ainda não pediu nada. Um IP por pedido, para o limite por IP não entrar.
    const cheias = TETO / RESET_CODES_PER_DAY;
    semear(cheias + 1);
    let n = 0;
    for (let i = 0; i < cheias; i += 1) {
      for (let j = 0; j < RESET_CODES_PER_DAY; j += 1) {
        n += 1;
        expect((await pedir(`pessoa${i}@academia.com`, `198.51.100.${n}`)).statusCode).toBe(200);
      }
    }
    expect(h.enviados).toHaveLength(TETO);

    const res = await pedir(`pessoa${cheias}@academia.com`, '198.51.100.99');
    // A resposta não muda: o teto não pode dizer quem tem conta.
    expect([res.statusCode, res.body]).toEqual([200, { ok: true }]);
    expect(h.enviados).toHaveLength(TETO);
    // Nenhum código emitido: a conta nem ganhou documento.
    expect(h.docs.has(`_password_reset/u${cheias}`)).toBe(false);
    // O teto estourado sai como aviso, para aparecer no filtro de avisos da Vercel.
    const linhaDoTeto = ['esqueci-a-senha: pedido sem envio', { motivo: 'mail_cap', conta: `u${cheias}`, academia: ACADEMIA, ip: '198.51.100.99' }];
    expect(console.warn).toHaveBeenCalledWith(...linhaDoTeto);
    expect(console.info).not.toHaveBeenCalledWith(...linhaDoTeto);
  });

  it('a conta que já gastou os 5 códigos do dia não gasta vaga do teto', async () => {
    // Sem a leitura do espaço do dia antes da vaga, o e-mail de um membro só e 3
    // IPs esgotariam as 50 vagas sem mandar e-mail.
    const outras = TETO / RESET_CODES_PER_DAY - 1;
    semear(outras + 2);
    let n = 0;
    const pedirDeOutroIp = (email) => { n += 1; return pedir(email, `198.51.100.${n}`); };

    for (let i = 0; i < RESET_CODES_PER_DAY + 1; i += 1) {
      expect((await pedirDeOutroIp('pessoa0@academia.com')).statusCode).toBe(200);
    }
    expect(h.enviados).toHaveLength(RESET_CODES_PER_DAY);
    expect(linhas()).toContain("motivo: 'daily_limit'");
    // O sexto parou antes da vaga: o teto contou só os 5 e-mails.
    expect(h.docs.get('_ratelimit/pw-reset-mail-day')).toMatchObject({ count: RESET_CODES_PER_DAY });

    // O teto continua com 45 vagas: mais 45 e-mails saem, e o seguinte não.
    for (let i = 1; i <= outras; i += 1) {
      for (let j = 0; j < RESET_CODES_PER_DAY; j += 1) {
        expect((await pedirDeOutroIp(`pessoa${i}@academia.com`)).statusCode).toBe(200);
      }
    }
    expect(h.enviados).toHaveLength(TETO);
    await pedirDeOutroIp(`pessoa${outras + 1}@academia.com`);
    expect(h.enviados).toHaveLength(TETO);
    expect(console.warn).toHaveBeenCalledWith('esqueci-a-senha: pedido sem envio', expect.objectContaining({ motivo: 'mail_cap' }));
  });
});

// O gestor corrige o e-mail de login em Equipe & acessos. A tela chama a ação
// set-email do api/admin-users.js, que troca o e-mail no Auth e no cadastro e
// revoga as sessões. Aqui ela roda de verdade, com os mesmos falsos.
describe('e-mail de login trocado pelo gestor', () => {
  const ANTIGO = 'pessoa0@academia.com';
  const NOVO = 'pessoa0.nova@academia.com';

  function semearGestor() {
    h.contas.set('gestor@academia.com', {
      uid: 'gestor', email: 'gestor@academia.com', displayName: 'Gestor', disabled: false,
      customClaims: { tenantId: ACADEMIA },
      metadata: { lastSignInTime: 'Sun, 28 Sep 2026 10:00:00 GMT' },
      tokensValidAfterTime: 'Sun, 28 Sep 2026 09:00:00 GMT',
    });
    h.docs.set(`${EQUIPE}/gestor`, { authUid: 'gestor', email: 'gestor@academia.com', name: 'Gestor', role: 'admin' });
  }

  async function trocarEmail(email) {
    h.sessao = { uid: 'gestor', tenantId: ACADEMIA, superAdmin: false, impersonatedBy: null };
    const res = resposta();
    await adminUsers(post({ action: 'set-email', targetAuthUid: 'u0', email }, IP, JSON_HEADERS), res);
    return res;
  }

  it('o pedido com o e-mail novo manda o código para o e-mail novo, e o pedido com o antigo não manda nada', async () => {
    semear(1);
    semearGestor();
    const troca = await trocarEmail(NOVO);
    expect([troca.statusCode, troca.body]).toEqual([200, { ok: true, changed: true }]);
    expect(h.emails).toEqual([{ uid: 'u0', email: NOVO, emailVerified: false }]);
    expect(h.docs.get(`${EQUIPE}/u0`).email).toBe(NOVO);

    expect((await pedir(NOVO)).statusCode).toBe(200);
    expect(h.enviados).toHaveLength(1);
    expect(h.enviados[0].to).toEqual([NOVO]);

    expect((await pedir(ANTIGO)).statusCode).toBe(200);
    expect(h.enviados).toHaveLength(1);
    expect(linhas()).toContain("motivo: 'unknown_email'");

    // O código do e-mail novo troca a senha.
    const senha = await trocar({ email: NOVO, code: codigoDo(h.enviados[0]) });
    expect([senha.statusCode, senha.body]).toEqual([200, { ok: true }]);
    expect(h.senhas).toEqual([{ uid: 'u0', password: SENHA }]);
  });

  it('o código pedido antes da troca é recusado, com o e-mail novo e com o antigo', async () => {
    semear(1);
    semearGestor();
    await pedir(ANTIGO);
    expect(h.enviados[0].to).toEqual([ANTIGO]);
    const codigo = codigoDo(h.enviados[0]);

    expect((await trocarEmail(NOVO)).statusCode).toBe(200);
    expect(h.revogadas).toEqual(['u0']);

    const comNovo = await trocar({ email: NOVO, code: codigo });
    expect([comNovo.statusCode, comNovo.body]).toEqual([400, { error: CODE_REFUSED_MESSAGE }]);
    const comAntigo = await trocar({ email: ANTIGO, code: codigo });
    expect([comAntigo.statusCode, comAntigo.body]).toEqual([400, { error: CODE_REFUSED_MESSAGE }]);
    expect(h.senhas).toEqual([]);
    // A revogação mudou a marca das sessões, e o código morreu com ela.
    expect(linhas()).toContain("motivo: 'account_changed'");
    expect(h.docs.get('_password_reset/u0').usedAtMs).toEqual(expect.any(Number));
  });
});

// O parser da Vercel entrega o corpo de um <form method="post"> como objeto, e o
// formulário de outro site não passa por preflight.
describe('POST de formulário', () => {
  const formulario = { 'content-type': 'application/x-www-form-urlencoded' };

  it('o pedido dá 415, sem limitador, sem código e sem e-mail', async () => {
    semear(1);
    const res = resposta();
    await handler(post(querystring.parse('action=password-reset-request&email=pessoa0%40academia.com'), IP, formulario), res);
    expect([res.statusCode, res.body]).toEqual([415, { error: SEND_FAILED_MESSAGE }]);
    expect(h.adiados).toEqual([]);
    expect(h.enviados).toEqual([]);
    expect([...h.docs.keys()].filter((k) => k.startsWith('_'))).toEqual([]);
  });

  it('a troca dá 415 na hora, sem o piso e sem trocar nada', async () => {
    semear(1);
    const res = resposta();
    const corpo = querystring.parse('action=password-reset-confirm&email=pessoa0%40academia.com&code=123456&newPassword=Nova%40Senha1');
    const feito = handler(post(corpo, IP, formulario), res);
    await vi.advanceTimersByTimeAsync(1);
    expect([res.statusCode, res.body]).toEqual([415, { error: SAVE_FAILED_MESSAGE }]);
    expect(vi.getTimerCount()).toBe(0);
    await feito;
    expect(h.senhas).toEqual([]);
  });
});

describe('o que vai para o console', () => {
  it('nada de código nem de senha, nem nas recusas', async () => {
    semear(2);
    await pedir('pessoa0@academia.com');
    const codigoA = codigoDo(h.enviados[0]);
    const codigoB = await pedirOutroCodigo('pessoa1@academia.com', codigoA);
    const errado = codigoA === '000000' ? '111111' : '000000';

    await trocar({ email: 'pessoa0@academia.com', code: errado });
    await trocar({ email: 'pessoa1@academia.com', code: codigoA });
    await trocar({ email: 'ninguem@academia.com', code: codigoA });
    await trocar({ email: 'pessoa0@academia.com', code: codigoA });
    await trocar({ email: 'pessoa0@academia.com', code: codigoA, newPassword: 'Outra@Senha2' });
    expect(h.senhas).toEqual([{ uid: 'u0', password: SENHA }]);

    const saida = linhas();
    // O console registrou o caminho: pedidos, recusas e a troca.
    expect(saida).toContain('código enviado');
    expect(saida).toContain('troca recusada');
    expect(saida).toContain('senha trocada');
    for (const segredo of [codigoA, codigoB, errado, SENHA, 'Outra@Senha2', 'chave-privada-de-teste', 're_chave_de_teste']) {
      expect(saida).not.toContain(segredo);
    }
  });
});
