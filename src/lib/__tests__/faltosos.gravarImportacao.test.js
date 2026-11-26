// A gravação da importação da Next Fit (src/lib/faltosos/gravarImportacao.js).
// Sem Firebase de verdade: firebase/firestore e ../firebase.js são falsos, e os
// documentos vivem num Map em memória que imita o set com e sem merge e o
// delete. Assim o teste refaz a importação, derruba um lote no meio e confere
// o banco no fim. O plano refeito antes de gravar é um dublê que só devolve o
// que muda, como o planejarImportacao. Os dados são inventados.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const m = vi.hoisted(() => ({
  banco: new Map(),
  lotes: [],
  falharNoCommit: null,
  falharLeitura: false,
  ts: 'TS1',
}));

// O appId vivo é de outra academia de propósito: a gravação só pode usar a
// academia que recebe de quem chama.
vi.mock('../firebase.js', () => ({
  appId: 'outra',
  CONFIG_PATH: 'stronix_config',
  CONFIG_FALTOSOS_ID: 'faltosos',
  FALTOSOS_PATH: 'stronix_faltosos',
  PRESENCAS_PATH: 'stronix_presencas',
  IMPORTACOES_NEXTFIT_PATH: 'stronix_importacoes_nextfit',
  NEXTFIT_ALUNOS_PATH: 'stronix_nextfit_alunos',
  INTERACTIONS_PATH: 'stronix_interactions',
}));

const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const juntar = (velho, novo) => {
  const out = { ...(ehObjeto(velho) ? velho : {}) };
  for (const [k, v] of Object.entries(novo)) out[k] = ehObjeto(v) && ehObjeto(out[k]) ? juntar(out[k], v) : v;
  return out;
};

vi.mock('firebase/firestore', () => ({
  collection: (_db, ...p) => ({ path: p.join('/') }),
  doc: (_db, ...p) => ({ path: p.join('/'), id: p[p.length - 1] }),
  serverTimestamp: () => m.ts,
  getDocFromServer: async (ref) => {
    if (m.falharLeitura) throw Object.assign(new Error('offline'), { code: 'unavailable' });
    const d = m.banco.get(ref.path);
    return { id: ref.id, exists: () => d !== undefined, data: () => d };
  },
  getDocsFromServer: async (col) => {
    if (m.falharLeitura) throw Object.assign(new Error('offline'), { code: 'unavailable' });
    const prefixo = `${col.path}/`;
    const docs = [...m.banco.entries()]
      .filter(([p]) => p.startsWith(prefixo) && !p.slice(prefixo.length).includes('/'))
      .map(([p, d]) => ({ id: p.slice(prefixo.length), data: () => d }));
    return { docs };
  },
  writeBatch: () => {
    const ops = [];
    return {
      set: (ref, dados, opcoes) => { ops.push({ path: ref.path, dados, merge: Boolean(opcoes?.merge) }); },
      delete: (ref) => { ops.push({ path: ref.path, apagar: true }); },
      commit: async () => {
        const n = m.lotes.length + 1;
        if (m.falharNoCommit === n) throw Object.assign(new Error('falhou'), { code: 'permission-denied' });
        m.lotes.push(ops);
        for (const op of ops) {
          if (op.apagar) m.banco.delete(op.path);
          else m.banco.set(op.path, op.merge ? juntar(m.banco.get(op.path), op.dados) : op.dados);
        }
      },
    };
  },
}));

const { gravarImportacao, lerRegistroDaImportacao } = await import('../faltosos/gravarImportacao.js');

const BASE = 'artifacts/acad/public/data';
const QUEM = { uid: 'uid-g1', id: 'g1', nome: 'Johnny' };
const ID = 'f2026-10-06_p2026-09-29_2026-10-05';
const PERIODO = { de: '2026-09-29', ate: '2026-10-05' };
const IMPORTACAO = { id: ID, dataFaltantes: '2026-10-06', dataFaltantesAnterior: '2026-09-29', periodoPresencas: PERIODO };
const ULTIMA = { id: ID, dataFaltantes: '2026-10-06', dataFaltantesAnterior: '2026-09-29', periodoPresencas: PERIODO, ultimoDiaPresencas: '2026-10-05' };
const REGISTRO = {
  dataFaltantes: '2026-10-06',
  dataFaltantesAnterior: '2026-09-29',
  periodoPresencas: PERIODO,
  numeros: { voltaram: 1 },
  avisos: [],
  naoLigados: [],
};
const ESTADO = (leadId, extra = {}) => ({
  leadId, professorId: 'p1', professorNextFit: 'Ana Prof', contratoNextFit: 'Clube+ Start',
  ultimaPresenca: '2026-09-25', inicioFalta: '2026-09-25', status: 'faltando',
  voltouEm: null, voltouEntre: null, diasNaImportacao: 11, urgente: false,
  contratoTerminaEm: '2027-03-01', querCancelarEm: null, atualizadoNaImportacao: ID, tarefa: null,
  ...extra,
});
const DIA = (hora, origens = ['catraca'], modalidades = []) => ({ hora, origens, modalidades });
const VOLTA_L1 = {
  id: 'volta_L1_2026-09-25', leadId: 'L1', inicioFalta: '2026-09-25',
  voltouEm: '2026-10-03', voltouEntre: null, text: 'Voltou a treinar em 03/10', importacaoId: ID,
  lead: { id: 'L1', name: 'Bia Lima', consultantId: 'c1', consultantAuthUid: 'uid-c1' },
};

// O que a importação quer deixar no banco: L1 voltou em 03/10 (com presença no
// Presenças), L2 segue faltando, L3 só tem presença, e um nome da Next Fit.
const ALVO = {
  estados: {
    L1: ESTADO('L1', { status: 'voltou', voltouEm: '2026-10-03' }),
    L2: ESTADO('L2', { ultimaPresenca: '2026-09-20', inicioFalta: '2026-09-20', diasNaImportacao: 16 }),
  },
  voltas: [VOLTA_L1],
  presencasPorDoc: [
    { id: 'L1_2026-10', doc: { leadId: 'L1', mes: '2026-10', dias: { '2026-10-03': DIA('07:10') } } },
    { id: 'L3_2026-09', doc: { leadId: 'L3', mes: '2026-09', dias: { '2026-09-30': DIA('19:00', ['agenda'], ['Pilates']) } } },
  ],
  nomesAlunos: [{ id: 'bia lima', doc: { nomeNextFit: 'Bia Lima', leadIds: ['L1'], origem: 'telefone' } }],
  professorLinks: [{ nome: 'Ana Prof', professorId: 'p1' }],
};

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Dublê do planejarImportacao: devolve só os estados que mudam em relação aos
// lidos, e só a linha da volta de quem ainda não voltou. É o que o plano de
// verdade faz, e é por isso que a importação refeita não duplica nada.
const planoPara = (alvo, estadosAtuais = {}) => ({
  recusa: null,
  prontoParaGravar: true,
  pendencias: { professoresNovos: [] },
  importacao: IMPORTACAO,
  estados: Object.entries(alvo.estados)
    .filter(([leadId, doc]) => !igual(estadosAtuais[leadId], doc))
    .map(([leadId, doc]) => ({ leadId, doc })),
  voltas: (alvo.voltas || []).filter((v) => estadosAtuais[v.leadId]?.status !== 'voltou'),
  voltasDesfeitas: alvo.voltasDesfeitas || [],
  presencasPorDoc: alvo.presencasPorDoc || [],
  nomesAlunos: alvo.nomesAlunos || [],
  config: { ultimaImportacao: ULTIMA, ...(alvo.professorLinks ? { professorLinks: alvo.professorLinks } : {}) },
  registro: REGISTRO,
});

const gravar = ({ alvo = ALVO, ...over } = {}) => gravarImportacao({
  db: {},
  tenant: 'acad',
  plano: planoPara(alvo),
  replanejar: (estadosAtuais) => planoPara(alvo, estadosAtuais),
  ultimaImportacaoLida: null,
  quem: QUEM,
  ...over,
});

const caminhos = (lote) => lote.map((op) => `${op.apagar ? 'apaga ' : ''}${op.path.replace(`${BASE}/`, '')}`);
const fotoDoBanco = () => Object.fromEntries([...m.banco.entries()].sort(([a], [b]) => a.localeCompare(b)));

beforeEach(() => {
  m.banco.clear();
  m.lotes.length = 0;
  m.falharNoCommit = null;
  m.falharLeitura = false;
  m.ts = 'TS1';
});

describe('gravarImportacao', () => {
  it('grava as ligações, os alunos e, por último e num lote só, o registro e a última importação', async () => {
    const progresso = [];
    const r = await gravar({ onProgress: (feitas, total) => progresso.push([feitas, total]) });

    expect(r).toEqual({ ok: true, importacaoId: ID, gravadas: 9, total: 9, lote: null, lotes: 2, jaExistia: false, erro: null });
    expect(m.lotes.map(caminhos)).toEqual([
      [
        'stronix_config/faltosos',
        'stronix_nextfit_alunos/bia lima',
        'stronix_faltosos/L1', 'stronix_interactions/volta_L1_2026-09-25', 'stronix_presencas/L1_2026-10',
        'stronix_faltosos/L2',
        'stronix_presencas/L3_2026-09',
      ],
      [`stronix_importacoes_nextfit/${ID}`, 'stronix_config/faltosos'],
    ]);
    expect(progresso).toEqual([[7, 9], [9, 9]]);
    expect(m.banco.get(`${BASE}/stronix_config/faltosos`)).toEqual({
      professorLinks: [{ nome: 'Ana Prof', professorId: 'p1' }],
      ultimaImportacao: { ...ULTIMA, importadoEm: 'TS1', importadoPorNome: 'Johnny' },
    });
    expect(m.banco.get(`${BASE}/stronix_importacoes_nextfit/${ID}`)).toEqual({
      ...REGISTRO, importadoPor: 'g1', importadoPorNome: 'Johnny', importadoEm: 'TS1',
    });
  });

  it('a linha "Voltou a treinar" tem id fixo e nada vai para stronix_leads', async () => {
    await gravar();
    expect(m.banco.get(`${BASE}/stronix_interactions/volta_L1_2026-09-25`)).toMatchObject({
      leadId: 'L1', type: 'presence_return', text: 'Voltou a treinar em 03/10',
      consultantName: 'Johnny', actorAuthUid: 'uid-g1', leadConsultantAuthUid: 'uid-c1', createdAt: 'TS1',
    });
    expect([...m.banco.keys()].some((p) => p.includes('/stronix_leads/'))).toBe(false);
  });

  it('a volta desfeita apaga a linha no mesmo lote do estado do aluno', async () => {
    m.banco.set(`${BASE}/stronix_interactions/volta_L2_2026-09-20`, { type: 'presence_return', leadId: 'L2' });
    m.banco.set(`${BASE}/stronix_faltosos/L2`, ESTADO('L2', { status: 'voltou', ultimaPresenca: '2026-09-20', inicioFalta: '2026-09-20', voltouEntre: { de: '2026-09-21', ate: '2026-09-29' } }));
    const alvo = { estados: { L2: ESTADO('L2', { ultimaPresenca: '2026-09-20', inicioFalta: '2026-09-20' }) }, voltasDesfeitas: ['volta_L2_2026-09-20'] };

    const r = await gravar({ alvo });

    expect(r.ok).toBe(true);
    expect(caminhos(m.lotes[0])).toEqual(['stronix_faltosos/L2', 'apaga stronix_interactions/volta_L2_2026-09-20']);
    expect(m.banco.has(`${BASE}/stronix_interactions/volta_L2_2026-09-20`)).toBe(false);
    expect(m.banco.get(`${BASE}/stronix_faltosos/L2`).status).toBe('faltando');
  });

  it('roda o plano de novo com os estados lidos do servidor e grava o plano refeito', async () => {
    // Entre a prévia e o Confirmar, a tarefa de L2 foi marcada como feita (o
    // professor, no PR 3). O plano refeito leva isso; o da prévia, não.
    const feita = { marco: 14, urgente: false, status: 'feita', inicioFalta: '2026-09-20', criadaEm: '2026-09-29', importacaoId: 'f2026-09-29', feitaEm: 'ontem', feitaPor: 'p1', feitaPorNome: 'Ana Prof', canal: 'whatsapp', resultado: 'respondeu' };
    m.banco.set(`${BASE}/stronix_faltosos/L2`, ESTADO('L2', { ultimaPresenca: '2026-09-20', inicioFalta: '2026-09-20', tarefa: feita }));
    const replanejar = vi.fn((estadosAtuais) => planoPara({
      estados: { L2: { ...estadosAtuais.L2, diasNaImportacao: 16 } },
    }, estadosAtuais));

    await gravarImportacao({
      db: {}, tenant: 'acad', plano: planoPara({ estados: { L2: ESTADO('L2', { diasNaImportacao: 16 }) } }),
      replanejar, ultimaImportacaoLida: null, quem: QUEM,
    });

    expect(replanejar).toHaveBeenCalledTimes(1);
    expect(Object.keys(replanejar.mock.calls[0][0])).toEqual(['L2']);
    expect(m.banco.get(`${BASE}/stronix_faltosos/L2`)).toMatchObject({ diasNaImportacao: 16, tarefa: feita });
  });

  it('o registro guarda os números da prévia confirmada', async () => {
    const replanejar = (estadosAtuais) => ({ ...planoPara(ALVO, estadosAtuais), registro: { ...REGISTRO, numeros: { voltaram: 0 } } });
    await gravar({ replanejar });
    expect(m.banco.get(`${BASE}/stronix_importacoes_nextfit/${ID}`).numeros).toEqual({ voltaram: 1 });
  });

  it('lotes de até 500 gravações, com cada aluno inteiro num lote só', async () => {
    const estados = {};
    const presencasPorDoc = [];
    for (let i = 0; i < 600; i += 1) {
      const leadId = `L${String(i).padStart(3, '0')}`;
      estados[leadId] = ESTADO(leadId);
      presencasPorDoc.push({ id: `${leadId}_2026-10`, doc: { leadId, mes: '2026-10', dias: { '2026-10-01': DIA('07:00') } } });
    }
    const r = await gravar({ alvo: { estados, presencasPorDoc } });

    expect(r.ok).toBe(true);
    expect(m.lotes.map((l) => l.length)).toEqual([500, 500, 200, 2]);
    for (const lote of m.lotes.slice(0, 3)) {
      const alunos = new Set(lote.map((op) => op.path.split('/').pop().split('_')[0]));
      for (const leadId of alunos) {
        expect(lote.some((op) => op.path.endsWith(`/stronix_faltosos/${leadId}`)), leadId).toBe(true);
        expect(lote.some((op) => op.path.endsWith(`/stronix_presencas/${leadId}_2026-10`)), leadId).toBe(true);
      }
    }
  });

  it('refazer a mesma importação não duplica nada e mantém os números e a hora da primeira vez', async () => {
    await gravar();
    const depoisDaPrimeira = fotoDoBanco();
    m.lotes.length = 0;
    m.ts = 'TS2';

    const naoLigados = [{ nome: 'Fulano de Tal', telefone: '(51) 9 9999-0000', relatorio: 'faltantes' }];
    const plano = { ...planoPara(ALVO), registro: { ...REGISTRO, numeros: { voltaram: 0 }, naoLigados } };
    const r = await gravar({ plano, ultimaImportacaoLida: { id: ID } });

    expect(r).toMatchObject({ ok: true, jaExistia: true, lotes: 2 });
    // Do plano refeito, só sobram as presenças, o nome e a lista de
    // professores, que voltam com o mesmo conteúdo.
    expect(caminhos(m.lotes[0])).not.toContain('stronix_faltosos/L1');
    expect(caminhos(m.lotes[0])).not.toContain('stronix_interactions/volta_L1_2026-09-25');
    expect(caminhos(m.lotes[1])).toEqual([`stronix_importacoes_nextfit/${ID}`]);
    const registro = `${BASE}/stronix_importacoes_nextfit/${ID}`;
    const nome = `${BASE}/stronix_nextfit_alunos/bia lima`;
    expect(fotoDoBanco()).toEqual({
      ...depoisDaPrimeira,
      [nome]: { ...depoisDaPrimeira[nome], atualizadoEm: 'TS2' },
      [registro]: { ...depoisDaPrimeira[registro], naoLigados, refeitaEm: 'TS2', refeitaPorNome: 'Johnny' },
    });
    expect(m.banco.get(registro)).toMatchObject({ importadoEm: 'TS1', numeros: { voltaram: 1 } });
    expect(m.banco.get(`${BASE}/stronix_config/faltosos`).ultimaImportacao.importadoEm).toBe('TS1');
  });

  it('falha no meio: devolve até onde foi, sem registro; tentar de novo completa sem duplicar', async () => {
    const estados = {};
    for (let i = 0; i < 700; i += 1) estados[`L${String(i).padStart(3, '0')}`] = ESTADO(`L${String(i).padStart(3, '0')}`);
    const alvo = { estados };
    m.falharNoCommit = 2;

    const falhou = await gravar({ alvo });

    expect(falhou).toMatchObject({ ok: false, gravadas: 500, total: 702, lote: 2, lotes: 3, jaExistia: false });
    expect(falhou.erro.code).toBe('permission-denied');
    expect(m.banco.has(`${BASE}/stronix_importacoes_nextfit/${ID}`)).toBe(false);
    expect(m.banco.has(`${BASE}/stronix_config/faltosos`)).toBe(false);
    expect(m.banco.size).toBe(500);

    // Tentar de novo, com o mesmo plano: o plano refeito só manda os 200 que
    // faltaram, e o fecho.
    m.falharNoCommit = null;
    m.lotes.length = 0;
    const refeita = await gravar({ alvo });
    expect(refeita).toMatchObject({ ok: true, jaExistia: false, total: 202 });
    const completo = fotoDoBanco();

    m.banco.clear();
    m.lotes.length = 0;
    await gravar({ alvo });
    expect(completo).toEqual(fotoDoBanco());
    expect(m.banco.size).toBe(702);
  });

  it('outra importação gravada com a janela aberta: para sem gravar nada', async () => {
    m.banco.set(`${BASE}/stronix_config/faltosos`, { ultimaImportacao: { id: 'f2026-10-13' } });
    const r = await gravar({ ultimaImportacaoLida: { id: 'f2026-09-29' } });
    expect(r).toMatchObject({ ok: false, gravadas: 0, lote: null });
    expect(r.erro).toMatchObject({ code: 'outra-importacao' });
    expect(r.erro.message).toMatch(/Nada foi gravado/);
    expect(m.lotes).toEqual([]);
  });

  it('a mesma importação já no servidor, com a resposta perdida: segue', async () => {
    m.banco.set(`${BASE}/stronix_config/faltosos`, { ultimaImportacao: { id: ID } });
    const r = await gravar({ ultimaImportacaoLida: { id: 'f2026-09-29' } });
    expect(r.ok).toBe(true);
  });

  it('sem internet na leitura, para antes de gravar qualquer coisa', async () => {
    m.falharLeitura = true;
    const replanejar = vi.fn();
    const r = await gravar({ replanejar });
    expect(r).toMatchObject({ ok: false, gravadas: 0, total: 0, lote: null });
    expect(r.erro.code).toBe('unavailable');
    expect(replanejar).not.toHaveBeenCalled();
    expect(m.lotes).toEqual([]);
  });

  it('plano refeito com defeito lança erro e não grava nada', async () => {
    const replanejar = (estadosAtuais) => ({ ...planoPara(ALVO, estadosAtuais), estados: [] });
    await expect(gravar({ replanejar })).rejects.toThrow(/sem o estado dele/);
    expect(m.lotes).toEqual([]);
  });

  it('plano refeito de outra importação lança erro e não grava nada', async () => {
    const outro = { ...IMPORTACAO, id: 'f2026-10-13', dataFaltantes: '2026-10-13', periodoPresencas: null };
    const replanejar = (estadosAtuais) => ({ ...planoPara(ALVO, estadosAtuais), importacao: outro, config: { ultimaImportacao: { ...ULTIMA, id: 'f2026-10-13' } } });
    await expect(gravar({ replanejar })).rejects.toThrow(/outra importação/);
    expect(m.lotes).toEqual([]);
  });

  it('plano confirmado com recusa ou com professor novo sem ligação não começa', async () => {
    await expect(gravar({ plano: { ...planoPara(ALVO), recusa: { codigo: 'faltantes_antigo' } } })).rejects.toThrow(/recusa/);
    await expect(gravar({ plano: { ...planoPara(ALVO), prontoParaGravar: false } })).rejects.toThrow(/professor novo/);
    expect(m.lotes).toEqual([]);
  });

  it('sem academia, sem quem importa, sem replanejar ou sem a última importação lida, não começa', async () => {
    await expect(gravar({ tenant: '' })).rejects.toThrow(/academia/);
    await expect(gravar({ quem: null })).rejects.toThrow(/quem importa/);
    await expect(gravar({ replanejar: null })).rejects.toThrow(/replanejar/);
    await expect(gravar({ ultimaImportacaoLida: undefined })).rejects.toThrow(/última importação lida/);
  });

  it('grava na academia que recebe, e não na do appId vivo', async () => {
    await gravar();
    expect(m.lotes.flat().every((op) => op.path.startsWith('artifacts/acad/'))).toBe(true);
  });
});

describe('lerRegistroDaImportacao', () => {
  it('devolve o registro com o id, ou null', async () => {
    expect(await lerRegistroDaImportacao({ db: {}, tenant: 'acad', id: ID })).toBeNull();
    m.banco.set(`${BASE}/stronix_importacoes_nextfit/${ID}`, { importadoPorNome: 'Johnny' });
    expect(await lerRegistroDaImportacao({ db: {}, tenant: 'acad', id: ID })).toEqual({ id: ID, importadoPorNome: 'Johnny' });
  });
});

describe('os caminhos do dublê são os de verdade', () => {
  it('firebase.js tem os mesmos nomes e valores que o teste usa', () => {
    const fonte = readFileSync(fileURLToPath(new URL('../firebase.js', import.meta.url)), 'utf8');
    const esperado = {
      CONFIG_PATH: 'stronix_config',
      CONFIG_FALTOSOS_ID: 'faltosos',
      FALTOSOS_PATH: 'stronix_faltosos',
      PRESENCAS_PATH: 'stronix_presencas',
      IMPORTACOES_NEXTFIT_PATH: 'stronix_importacoes_nextfit',
      NEXTFIT_ALUNOS_PATH: 'stronix_nextfit_alunos',
      INTERACTIONS_PATH: 'stronix_interactions',
    };
    for (const [nome, valor] of Object.entries(esperado)) {
      expect(fonte, nome).toContain(`export const ${nome} = '${valor}';`);
    }
  });
});
