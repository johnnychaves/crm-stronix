// A página pública da pesquisa de NPS (plano 2026-11-25-perfil-do-professor-05):
// as três ações da api/tenant-resolve.js com um banco falso que imita o SDK de
// servidor (snap.exists é propriedade, transação com create que recusa o
// documento que já existe).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const banco = vi.hoisted(() => ({ docs: new Map(), escritas: [], falhar: null }));
const limitador = vi.hoisted(() => ({ ok: true, chaves: [] }));
const sentry = vi.hoisted(() => ({ erros: [] }));

vi.mock('../_firebaseAdmin.js', () => {
  const chave = (caminho) => caminho.join('/');
  const snapDoc = (caminho) => {
    if (banco.falhar) throw banco.falhar;
    const d = banco.docs.get(chave(caminho));
    return { id: caminho.at(-1), exists: d !== undefined, data: () => (d === undefined ? undefined : structuredClone(d)) };
  };
  const lista = (caminho, filtros) => {
    if (banco.falhar) throw banco.falhar;
    const prefixo = `${chave(caminho)}/`;
    const docs = [...banco.docs.entries()]
      .filter(([k]) => k.startsWith(prefixo) && !k.slice(prefixo.length).includes('/'))
      .filter(([, d]) => filtros.every(([c, v]) => d[c] === v))
      .map(([k, d]) => ({ id: k.slice(prefixo.length), data: () => structuredClone(d) }));
    return { empty: docs.length === 0, docs };
  };
  const consulta = (caminho, filtros) => ({
    where: (c, _op, v) => consulta(caminho, [...filtros, [c, v]]),
    limit: () => consulta(caminho, filtros),
    get: async () => lista(caminho, filtros),
  });
  const docRef = (caminho) => ({
    id: caminho.at(-1),
    caminho,
    collection: (n) => colecao([...caminho, n]),
    get: async () => snapDoc(caminho),
  });
  const colecao = (caminho) => ({ ...consulta(caminho, []), doc: (id) => docRef([...caminho, id]) });
  const adminDb = {
    collection: (n) => colecao([n]),
    runTransaction: async (fn) => {
      const ops = [];
      const tx = {
        get: async (ref) => snapDoc(ref.caminho),
        create: (ref, d) => ops.push(['create', ref.caminho, d]),
        set: (ref, d) => ops.push(['set', ref.caminho, d]),
      };
      const r = await fn(tx);
      for (const [tipo, caminho, d] of ops) {
        if (Object.values(d).some((v) => v === undefined)) throw new Error('campo undefined');
        if (tipo === 'create' && banco.docs.has(chave(caminho))) throw Object.assign(new Error('ALREADY_EXISTS'), { code: 6 });
        banco.docs.set(chave(caminho), d);
        banco.escritas.push(`${tipo} ${chave(caminho)}`);
      }
      return r;
    },
  };
  return { adminDb, adminAuth: {}, admin: { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } } };
});
vi.mock('../_rateLimit.js', () => ({
  checkRateLimit: async (k) => { limitador.chaves.push(k); return { ok: limitador.ok }; },
  clientIp: () => '203.0.113.7',
}));
vi.mock('../_sentry.js', () => ({
  withSentry: (h) => h,
  captureError: async (err) => { sentry.erros.push(err); },
}));

const { default: handler } = await import('../tenant-resolve.js');
const { NPS_MIN_MS } = await import('../_npsPublico.js');

const T = 'academia-teste';
const BASE = `artifacts/${T}/public/data`;
const CODE = 'k7q2mx9pza';
const CPF = '52998224725';
const DIA = 864e5;
const agora = Date.now();
const put = (col, id, d) => banco.docs.set(`${BASE}/${col}/${id}`, d);
const contrato = (leadId, over = {}) => ({
  leadId, planId: 'move', status: 'ativo', value: 2388,
  startsAt: new Date(agora - 30 * DIA), endsAt: new Date(agora + 300 * DIA), createdAt: new Date(agora - 30 * DIA), ...over,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  banco.docs = new Map();
  banco.escritas = [];
  banco.falhar = null;
  limitador.ok = true;
  limitador.chaves = [];
  sentry.erros = [];
  banco.docs.set(`tenants/${T}`, { displayName: 'Academia Teste', modules: ['faltosos'], settings: { logoUrl: 'https://x/logo.png' } });
  put('stronix_professores', 'p1', { nome: 'Bruno Carvalho', npsCode: CODE, modalidadeIds: ['func'], photoUrl: 'https://x/b.jpg' });
  put('stronix_professores', 'p2', { nome: 'Camila Rocha', npsCode: 'aaaaaaaaaa', modalidadeIds: ['func'] });
  put('stronix_modalities', 'func', { name: 'Funcional' });
  put('stronix_modalities', 'musc', { name: 'Musculação' });
  put('stronix_planos', 'move', { name: 'Clube+ Move', modalityIds: ['func'] });
  put('stronix_planos', 'start', { name: 'Clube+ Start', modalityIds: ['musc'] });
  put('stronix_nps_pesquisas', 'jun', {
    nome: 'Junho', situacao: 'aberta', inicio: '2000-01-01', fim: '2999-12-31', ciclo: 2027,
    perguntas: [{ id: 'p1', texto: 'Recomendaria?', principal: true }, { id: 'p2', texto: 'As aulas ajudam?', principal: false }],
    turmas: { p1: 20 },
  });
  put('stronix_leads', 'ana', { name: 'Ana Lima Souza', cpfDigits: CPF, professorId: 'p1' });
  put('stronix_contratos', 'c-ana', contrato('ana'));
});
afterEach(() => vi.useRealTimers());

const chamar = async (body) => {
  const res = { statusCode: 0, body: undefined, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  const p = handler({ method: 'POST', headers: {}, query: {}, body }, res);
  await vi.runAllTimersAsync();
  await p;
  return res;
};
const info = (over = {}) => chamar({ action: 'nps-info', slug: T, code: CODE, ...over });
const check = (over = {}) => chamar({ action: 'nps-check', slug: T, code: CODE, cpf: '529.982.247-25', ...over });
const answer = (over = {}) => chamar({ action: 'nps-answer', slug: T, code: CODE, cpf: CPF, notas: { p1: 10, p2: 8 }, comentario: ' Ótimas aulas. ', ...over });

describe('nps-info', () => {
  it('devolve a marca, o primeiro nome, a foto, as modalidades e as perguntas', async () => {
    const res = await info();
    expect(res.body).toEqual({
      found: true,
      academia: 'Academia Teste',
      logoUrl: 'https://x/logo.png',
      professor: { nome: 'Bruno', photoUrl: 'https://x/b.jpg', modalidades: ['Funcional'] },
      pesquisa: { perguntas: [{ id: 'p1', texto: 'Recomendaria?' }, { id: 'p2', texto: 'As aulas ajudam?' }] },
    });
  });

  it('link inválido tem uma resposta só: sem módulo, código desconhecido, fora do formato, suspensa, professor inativo', async () => {
    const casos = [
      () => banco.docs.set(`tenants/${T}`, { displayName: 'Academia Teste', modules: [] }),
      () => {},
      () => {},
      () => banco.docs.set(`tenants/${T}`, { displayName: 'Academia Teste', modules: ['faltosos'], status: 'suspended' }),
      () => put('stronix_professores', 'p1', { nome: 'Bruno', npsCode: CODE, ativo: false }),
    ];
    const codes = [CODE, 'bbbbbbbbbb', 'ABC', CODE, CODE];
    for (let i = 0; i < casos.length; i += 1) {
      casos[i]();
      const res = await info({ code: codes[i] });
      expect(res.statusCode, String(i)).toBe(200);
      expect(res.body, String(i)).toEqual({ found: false });
    }
    expect((await info({ slug: 'nao-existe' })).body).toEqual({ found: false });
  });

  it('sem pesquisa recebendo resposta, a foto continua e a pesquisa vem null', async () => {
    put('stronix_nps_pesquisas', 'jun', { situacao: 'aberta', inicio: '2000-01-01', fim: '2001-01-01', perguntas: [], turmas: { p1: 20 } });
    expect((await info()).body).toMatchObject({ found: true, professor: { nome: 'Bruno' }, pesquisa: null });
    put('stronix_nps_pesquisas', 'jun', { situacao: 'aberta', inicio: '2000-01-01', fim: '2999-12-31', perguntas: [], turmas: { p9: 20 } });
    expect((await info()).body.pesquisa).toBeNull();
  });
});

describe('nps-check', () => {
  it('aceita o aluno da carteira e devolve só o primeiro nome', async () => {
    const res = await check();
    expect(res.body).toEqual({ ok: true, nome: 'Ana' });
  });

  it('a mesma recusa para CPF que não existe, de outra carteira, sem contrato da modalidade ou trancado', async () => {
    expect((await check({ cpf: '111.444.777-35' })).body).toEqual({ ok: false, motivo: 'fora' });
    put('stronix_leads', 'ana', { name: 'Ana Lima', cpfDigits: CPF, professorId: 'p2' });
    expect((await check()).body).toEqual({ ok: false, motivo: 'fora' });
    put('stronix_leads', 'ana', { name: 'Ana Lima', cpfDigits: CPF, professorId: 'p1' });
    put('stronix_contratos', 'c-ana', contrato('ana', { planId: 'start' }));
    expect((await check()).body).toEqual({ ok: false, motivo: 'fora' });
    put('stronix_contratos', 'c-ana', contrato('ana', { status: 'trancado', pausedAt: new Date(agora - 5 * DIA) }));
    expect((await check()).body).toEqual({ ok: false, motivo: 'fora' });
  });

  it('com dois leads do mesmo CPF, vale o da carteira', async () => {
    put('stronix_leads', 'ana-velha', { name: 'Ana Antiga', cpfDigits: CPF, professorId: 'p2' });
    expect((await check()).body).toEqual({ ok: true, nome: 'Ana' });
  });

  it('pesquisa fechada, resposta repetida, CPF inválido e link inválido', async () => {
    put('stronix_nps_respostas', 'jun_ana', { leadId: 'ana' });
    expect((await check()).body).toEqual({ ok: false, motivo: 'ja' });
    put('stronix_nps_pesquisas', 'jun', { situacao: 'encerrada', inicio: '2000-01-01', fim: '2999-12-31', perguntas: [], turmas: { p1: 20 } });
    expect((await check()).body).toEqual({ ok: false, motivo: 'fechada' });
    const invalido = await check({ cpf: '123.456.789-00' });
    expect(invalido.statusCode).toBe(400);
    expect(invalido.body).toEqual({ ok: false, motivo: 'cpf' });
    expect((await check({ code: 'bbbbbbbbbb' })).body).toEqual({ ok: false, motivo: 'link' });
  });

  it('a resposta espera o piso de tempo, e o limite estourado responde na hora', async () => {
    const res = { statusCode: 0, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    const p = handler({ method: 'POST', headers: {}, query: {}, body: { action: 'nps-check', slug: T, code: 'bbbbbbbbbb', cpf: CPF } }, res);
    await vi.advanceTimersByTimeAsync(NPS_MIN_MS - 50);
    let pronto = false;
    p.then(() => { pronto = true; });
    await Promise.resolve();
    expect(pronto).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    await p;
    expect(res.body).toEqual({ ok: false, motivo: 'link' });
    limitador.ok = false;
    expect((await check()).statusCode).toBe(429);
    expect(limitador.chaves).toContain(`nps-check:link:${T}:${CODE}`);
  });
});

describe('nps-answer', () => {
  it('grava a resposta sem CPF e soma nos totais do professor', async () => {
    const res = await answer();
    expect(res.body).toEqual({ ok: true });
    const resp = banco.docs.get(`${BASE}/stronix_nps_respostas/jun_ana`);
    expect(resp).toEqual({ pesquisaId: 'jun', professorId: 'p1', leadId: 'ana', nome: 'Ana Lima Souza', notas: { p1: 10, p2: 8 }, comentario: 'Ótimas aulas.', criadaEm: 'TS' });
    expect(JSON.stringify(resp)).not.toContain(CPF);
    const tot = banco.docs.get(`${BASE}/stronix_nps_totais/jun_p1`);
    expect(tot).toMatchObject({ pesquisaId: 'jun', professorId: 'p1', turma: 20, respostas: 1 });
    expect(tot.porPergunta.p1).toMatchObject({ soma: 10, promotores: 1 });
    expect(tot.porPergunta.p2).toMatchObject({ soma: 8, neutros: 1 });
  });

  it('a segunda resposta é recusada e os totais não mudam', async () => {
    await answer();
    const res = await answer({ notas: { p1: 0, p2: 0 } });
    expect(res.body).toEqual({ ok: false, motivo: 'ja' });
    expect(banco.docs.get(`${BASE}/stronix_nps_totais/jun_p1`).respostas).toBe(1);
  });

  it('recusa nota fora de 0 a 10, quebrada, pergunta faltando ou a mais', async () => {
    for (const notas of [{ p1: 11, p2: 5 }, { p1: 9.5, p2: 5 }, { p1: 9 }, { p1: 9, p2: 9, p3: 9 }, { p1: '9', p2: 9 }, [9, 9]]) {
      const res = await answer({ notas });
      expect(res.statusCode, JSON.stringify(notas)).toBe(400);
      expect(res.body).toEqual({ ok: false, motivo: 'notas' });
    }
    expect(banco.escritas).toEqual([]);
  });

  it('comentário longo é recusado; campo invisível responde sucesso sem gravar', async () => {
    expect((await answer({ comentario: 'a'.repeat(501) })).body).toEqual({ ok: false, motivo: 'comentario' });
    expect((await answer({ website: 'http://spam' })).body).toEqual({ ok: true });
    expect(banco.escritas).toEqual([]);
  });

  it('pesquisa fechada, aluno de fora e link inválido não gravam', async () => {
    expect((await answer({ cpf: '11144477735' })).body).toEqual({ ok: false, motivo: 'fora' });
    expect((await answer({ code: 'bbbbbbbbbb' })).body).toEqual({ ok: false, motivo: 'link' });
    banco.docs.set(`tenants/${T}`, { modules: [] });
    expect((await answer()).body).toEqual({ ok: false, motivo: 'link' });
    expect(banco.escritas).toEqual([]);
  });

  it('erro inesperado sobe ao Sentry sem o CPF', async () => {
    banco.falhar = new Error(`falha ao consultar cpfDigits == ${CPF}`);
    const res = await answer();
    expect(res.statusCode).toBe(500);
    expect(sentry.erros).toHaveLength(1);
    expect(sentry.erros[0].message).toBe('nps answer falhou (sem código)');
    expect(String(sentry.erros[0].stack)).not.toContain(CPF);
  });
});
