// A configuração dos faltosos (stronix_config/faltosos), lida por
// src/lib/faltosos/configFaltosos.js do jeito que a importação e as telas a
// recebem: o que vier fora do formato cai no padrão, sem quebrar nada.
import { describe, it, expect } from 'vitest';
import {
  CONFIG_FALTOSOS_PADRAO, configDasTelas, normalizarConfigFaltosos, normalizarUltimaImportacao, periodoOuNull,
  normalizarMarcos, normalizarJanelaUrgente, normalizarProfessorLinks,
} from '../faltosos/configFaltosos.js';
import * as marcos from '../faltosos/marcos.js';
import * as ligacaoProfessores from '../faltosos/ligacaoProfessores.js';

describe('o padrão', () => {
  it('doc ausente: marcos 7, 14, 30 e 60, urgente em 90 dias, sem ligação e sem importação', () => {
    expect(CONFIG_FALTOSOS_PADRAO).toEqual({
      marcos: [7, 14, 30, 60], janelaUrgenteDias: 90, professorLinks: [], ultimaImportacao: null,
    });
    expect(Object.isFrozen(CONFIG_FALTOSOS_PADRAO)).toBe(true);
    expect(normalizarConfigFaltosos(undefined)).toEqual(CONFIG_FALTOSOS_PADRAO);
    expect(normalizarConfigFaltosos('lixo')).toEqual(CONFIG_FALTOSOS_PADRAO);
  });

  it('as regras de cada campo são as dos módulos do motor, sem segunda cópia', () => {
    expect(normalizarMarcos).toBe(marcos.normalizarMarcos);
    expect(normalizarJanelaUrgente).toBe(marcos.normalizarJanelaUrgente);
    expect(normalizarProfessorLinks).toBe(ligacaoProfessores.normalizarProfessorLinks);
  });
});

describe('normalizarConfigFaltosos', () => {
  it('lê cada campo pela regra dele', () => {
    expect(normalizarConfigFaltosos({
      marcos: [30, 7],
      janelaUrgenteDias: '45',
      professorLinks: [{ nome: ' Bruno  Tavares ', professorId: 'p-bruno' }, { nome: 'Controle (não alterar)', professorId: '' }],
      ultimaImportacao: { id: 'f2026-10-06', dataFaltantes: '2026-10-06' },
      outroCampo: 1,
    })).toEqual({
      marcos: [7, 30],
      janelaUrgenteDias: 45,
      professorLinks: [{ nome: 'Bruno Tavares', professorId: 'p-bruno' }, { nome: 'Controle (não alterar)', professorId: null }],
      ultimaImportacao: {
        id: 'f2026-10-06', dataFaltantes: '2026-10-06', dataFaltantesAnterior: null, periodoPresencas: null,
        ultimoDiaPresencas: null, importadoEm: null, importadoPorNome: '',
      },
    });
  });

  it('ler de novo o que já foi lido dá o mesmo', () => {
    const em = new Date('2026-10-06T12:12:00Z');
    const lida = normalizarConfigFaltosos({
      marcos: [7, 14], ultimaImportacao: { id: 'x', dataFaltantes: '2026-10-06', importadoEm: { toDate: () => em }, importadoPorNome: 'Johnny' },
    });
    expect(normalizarConfigFaltosos(lida)).toEqual(lida);
  });
});

describe('normalizarUltimaImportacao', () => {
  it('sem id, nunca houve importação', () => {
    expect(normalizarUltimaImportacao(null)).toBeNull();
    expect(normalizarUltimaImportacao({ dataFaltantes: '2026-10-06' })).toBeNull();
    expect(normalizarUltimaImportacao({ id: '' })).toBeNull();
  });

  it('guarda o último Faltantes, o E0 que ele usou, o último Presenças, quem importou e quando', () => {
    const em = new Date('2026-10-06T12:12:00Z');
    expect(normalizarUltimaImportacao({
      id: 'f2026-10-06_p2026-09-29_2026-10-05',
      dataFaltantes: '2026-10-06',
      dataFaltantesAnterior: '2026-09-29',
      periodoPresencas: { de: '2026-09-29', ate: '2026-10-05' },
      ultimoDiaPresencas: '2026-10-05',
      importadoEm: { toDate: () => em },
      importadoPorNome: ' Johnny ',
    })).toEqual({
      id: 'f2026-10-06_p2026-09-29_2026-10-05',
      dataFaltantes: '2026-10-06',
      dataFaltantesAnterior: '2026-09-29',
      periodoPresencas: { de: '2026-09-29', ate: '2026-10-05' },
      ultimoDiaPresencas: '2026-10-05',
      importadoEm: em,
      importadoPorNome: 'Johnny',
    });
  });

  it('sem ultimoDiaPresencas gravado, vale o fim do período; e fica o maior dos dois', () => {
    expect(normalizarUltimaImportacao({ id: 'a', periodoPresencas: { de: '2026-09-29', ate: '2026-10-05' } }).ultimoDiaPresencas).toBe('2026-10-05');
    expect(normalizarUltimaImportacao({ id: 'a', periodoPresencas: { de: '2026-09-29', ate: '2026-10-05' }, ultimoDiaPresencas: '2026-10-08' }).ultimoDiaPresencas).toBe('2026-10-08');
  });

  it('as datas fora do formato saem', () => {
    expect(normalizarUltimaImportacao({
      id: 'b', dataFaltantes: '06/10/2026', dataFaltantesAnterior: 7, periodoPresencas: { de: '2026-10-05', ate: '2026-10-01' }, importadoEm: 'x',
    })).toEqual({
      id: 'b', dataFaltantes: null, dataFaltantesAnterior: null, periodoPresencas: null, ultimoDiaPresencas: null, importadoEm: null, importadoPorNome: '',
    });
  });

  it('o período do Presenças precisa de dois dias, o primeiro antes do último', () => {
    expect(periodoOuNull({ de: '2026-10-01', ate: '2026-10-01' })).toEqual({ de: '2026-10-01', ate: '2026-10-01' });
    expect(periodoOuNull({ de: '2026-10-02', ate: '2026-10-01' })).toBeNull();
    expect(periodoOuNull({ de: '2026-10-01' })).toBeNull();
    expect(periodoOuNull(null)).toBeNull();
  });
});

describe('configDasTelas', () => {
  it('a tela sem configuração no contexto usa o padrão, marcado como ainda não lido', () => {
    expect(configDasTelas(null)).toEqual({ ...CONFIG_FALTOSOS_PADRAO, pronta: false });
    expect(configDasTelas(undefined)).toEqual({ ...CONFIG_FALTOSOS_PADRAO, pronta: false });
    const lida = { ...CONFIG_FALTOSOS_PADRAO, pronta: true };
    expect(configDasTelas(lida)).toBe(lida);
  });
});
