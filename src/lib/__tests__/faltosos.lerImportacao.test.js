// A leitura da base antes da prévia da importação
// (src/lib/faltosos/lerImportacao.js): tudo do servidor, da academia que a
// janela congelou, e no formato que o plano recebe. O Firestore é um dublê que
// guarda o que foi pedido.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const pedidos = vi.hoisted(() => []);
const banco = vi.hoisted(() => ({ colecoes: {}, docs: {} }));

vi.mock('../firebase.js', () => ({
  LEADS_PATH: 'stronix_leads',
  CONFIG_PATH: 'stronix_config',
  CONFIG_FALTOSOS_ID: 'faltosos',
  FALTOSOS_PATH: 'stronix_faltosos',
  PRESENCAS_PATH: 'stronix_presencas',
  NEXTFIT_ALUNOS_PATH: 'stronix_nextfit_alunos',
}));
vi.mock('firebase/firestore', () => {
  const snapDe = (lista) => ({ docs: lista.map(([id, data]) => ({ id, data: () => data })) });
  return {
    collection: (_db, ...caminho) => ({ caminho: caminho.join('/') }),
    doc: (_db, ...caminho) => ({ caminho: caminho.join('/') }),
    query: (ref, ...filtros) => ({ caminho: ref.caminho, filtros }),
    where: (campo, op, valor) => ({ campo, op, valor }),
    getDocsFromServer: async (q) => {
      pedidos.push(['lista', q.caminho, q.filtros || []]);
      const lista = banco.colecoes[q.caminho] || [];
      const filtro = (q.filtros || [])[0];
      if (!filtro) return snapDe(lista);
      if (filtro.op === 'in') return snapDe(lista.filter(([, d]) => filtro.valor.includes(d[filtro.campo])));
      return snapDe(lista.filter(([, d]) => d[filtro.campo] === filtro.valor));
    },
    getDocFromServer: async (ref) => {
      pedidos.push(['doc', ref.caminho]);
      const data = banco.docs[ref.caminho];
      return { exists: () => data !== undefined, data: () => data };
    },
  };
});

const { lerBaseDaImportacao } = await import('../faltosos/lerImportacao.js');

const T = 'academia-teste';
const P = (col) => `artifacts/${T}/public/data/${col}`;

beforeEach(() => {
  pedidos.length = 0;
  banco.colecoes = {
    [P('stronix_leads')]: [
      ['l-ana', { name: 'Ana Lima', lifecycleBucket: 'cliente', lifecycleStage: 'cliente', createdAt: new Date('2026-01-10') }],
      ['l-leo', { name: 'Léo Lead', lifecycleBucket: 'ativo', status: 'Novo', createdAt: new Date('2026-09-10') }],
      ['l-torto', { name: 'Balde torto', lifecycleBucket: 'cliente', status: 'Novo', createdAt: new Date('2026-09-10') }],
    ],
    [P('stronix_faltosos')]: [
      ['l-ana', { status: 'faltando', ultimaPresenca: '2026-09-25', professorId: 'p-rafa' }],
      ['l-ex', { status: 'voltou', ultimaPresenca: '2026-08-01' }],
    ],
    [P('stronix_nextfit_alunos')]: [
      ['ana lima', { nomeNextFit: 'ANA LIMA', leadIds: ['l-ana'], origem: 'telefone' }],
    ],
    [P('stronix_presencas')]: [
      ['l-ana_2026-09', { leadId: 'l-ana', mes: '2026-09', dias: { '2026-09-25': { hora: '07:00', origens: ['catraca'], modalidades: [] } } }],
      ['l-ana_2026-10', { leadId: 'l-ana', mes: '2026-10', dias: {} }],
      ['l-ana_2026-08', { leadId: 'l-ana', mes: '2026-08', dias: {} }],
    ],
  };
  banco.docs = {
    [P('stronix_config/faltosos')]: {
      marcos: [7, 14, 30, 60], janelaUrgenteDias: 60,
      professorLinks: [{ nome: 'LUANA PRADO', professorId: 'p-lu' }],
      ultimaImportacao: { id: 'f2026-09-29', dataFaltantes: '2026-09-29', dataFaltantesAnterior: '2026-09-22' },
    },
  };
});

describe('lerBaseDaImportacao', () => {
  it('lê da academia congelada, só do servidor, e só os clientes', async () => {
    const base = await lerBaseDaImportacao({ db: {}, tenant: T, mesesPresencas: ['2026-09', '2026-10'] });
    for (const p of pedidos) expect(p[1].startsWith(`artifacts/${T}/`), p[1]).toBe(true);
    expect(pedidos.find((p) => p[1] === P('stronix_leads'))[2]).toEqual([{ campo: 'lifecycleBucket', op: '==', valor: 'cliente' }]);
    // O balde torto (cliente no balde, lead no estágio) sai pela rede de segurança da aba Clientes.
    expect(base.clientes.map((c) => c.id)).toEqual(['l-ana']);
  });

  it('traz os estados de todo status, os nomes guardados por chave e as presenças só dos meses do arquivo', async () => {
    const base = await lerBaseDaImportacao({ db: {}, tenant: T, mesesPresencas: ['2026-10', '2026-09', '2026-10'] });
    expect(Object.keys(base.estadosAtuais).sort()).toEqual(['l-ana', 'l-ex']);
    expect(base.nomesGuardados).toEqual({ 'ana lima': { nomeNextFit: 'ANA LIMA', leadIds: ['l-ana'], origem: 'telefone' } });
    expect(Object.keys(base.presencasAtuais).sort()).toEqual(['l-ana_2026-09', 'l-ana_2026-10']);
    const consulta = pedidos.find((p) => p[1] === P('stronix_presencas'));
    expect(consulta[2]).toEqual([{ campo: 'mes', op: 'in', valor: ['2026-10', '2026-09'] }]);
  });

  it('sem Presenças, não lê presença nenhuma', async () => {
    const base = await lerBaseDaImportacao({ db: {}, tenant: T });
    expect(pedidos.some((p) => p[1] === P('stronix_presencas'))).toBe(false);
    expect(base.presencasAtuais).toEqual({});
  });

  it('a configuração vem como está gravada, inclusive o E0 da última importação; sem o doc, vazia', async () => {
    let base = await lerBaseDaImportacao({ db: {}, tenant: T });
    expect(base.configDoc.ultimaImportacao).toEqual({ id: 'f2026-09-29', dataFaltantes: '2026-09-29', dataFaltantesAnterior: '2026-09-22' });
    expect(base.configDoc.janelaUrgenteDias).toBe(60);
    banco.docs = {};
    base = await lerBaseDaImportacao({ db: {}, tenant: T });
    expect(base.configDoc).toEqual({});
  });

  it('sem academia, nem começa', async () => {
    await expect(lerBaseDaImportacao({ db: {}, tenant: null })).rejects.toThrow('Academia da importação');
    expect(pedidos).toEqual([]);
  });
});
