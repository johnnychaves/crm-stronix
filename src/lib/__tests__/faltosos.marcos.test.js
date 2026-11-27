// Marcos de falta (src/lib/faltosos/marcos.js): a configuração e o marco
// atravessado entre o Faltantes anterior (E0) e o de agora (E).
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MARCOS, DEFAULT_JANELA_URGENTE, JANELA_DA_PRIMEIRA_IMPORTACAO, normalizarMarcos, normalizarJanelaUrgente,
  marcoAtravessado, marcoAlcancado,
} from '../faltosos/marcos.js';
import { somarDias } from '../faltosos/dias.js';

const E = '2026-10-06';
// Última presença de quem está há `dias` dias sem vir em E.
const ha = (dias, e = E) => somarDias(e, -dias);

describe('configuração', () => {
  it('o padrão é 7, 14, 30 e 60, a janela do urgente é 90 e a primeira importação olha 7 dias para trás', () => {
    expect(DEFAULT_MARCOS).toEqual([7, 14, 30, 60]);
    expect(Object.isFrozen(DEFAULT_MARCOS)).toBe(true);
    expect(DEFAULT_JANELA_URGENTE).toBe(90);
    expect(JANELA_DA_PRIMEIRA_IMPORTACAO).toBe(7);
  });

  it('de 1 a 6 números de 1 a 365, sem repetir, em ordem', () => {
    expect(normalizarMarcos([30, 7, 14])).toEqual([7, 14, 30]);
    expect(normalizarMarcos([1, 2, 3, 4, 5, 365])).toEqual([1, 2, 3, 4, 5, 365]);
  });

  it('qualquer coisa fora disso cai no padrão, numa lista nova', () => {
    for (const ruim of [[], [7, 7], [0, 7], [7, 366], [7.5], ['7'], [1, 2, 3, 4, 5, 6, 7], null, 'x']) {
      expect(normalizarMarcos(ruim), JSON.stringify(ruim)).toEqual([7, 14, 30, 60]);
    }
    expect(normalizarMarcos(null)).not.toBe(DEFAULT_MARCOS);
  });

  it('janela do urgente: inteiro de 1 a 365, em número ou em texto, senão 90', () => {
    expect(normalizarJanelaUrgente(60)).toBe(60);
    expect(normalizarJanelaUrgente('60')).toBe(60);
    expect(normalizarJanelaUrgente(' 45 ')).toBe(45);
    for (const ruim of [0, 366, 1.5, '1.5', '', '  ', 'x', null, undefined, true]) {
      expect(normalizarJanelaUrgente(ruim), String(ruim)).toBe(90);
    }
  });
});

describe('marcoAtravessado', () => {
  const primeira = (dias) => marcoAtravessado({ ultimaPresenca: ha(dias), e0: somarDias(E, -7), e: E, marcos: DEFAULT_MARCOS });

  it('primeira importação: E0 é E menos 7, como na simulação do levantamento', () => {
    // 38 alunos de 7 a 13 dias, 22 de 14 a 20, 9 de 30 a 36 e 4 de 60 a 66.
    expect([7, 13].map(primeira)).toEqual([7, 7]);
    expect([14, 20].map(primeira)).toEqual([14, 14]);
    expect([30, 36].map(primeira)).toEqual([30, 30]);
    expect([60, 66].map(primeira)).toEqual([60, 60]);
  });

  it('quem não atravessou nenhum marco na janela fica só na lista', () => {
    expect([6, 21, 29, 37, 59, 67, 400].map(primeira)).toEqual([null, null, null, null, null, null, null]);
  });

  it('de semana em semana, o marco que caiu na semana', () => {
    const e0 = '2026-09-29';
    expect(marcoAtravessado({ ultimaPresenca: ha(14), e0, e: E, marcos: DEFAULT_MARCOS })).toBe(14);
    expect(marcoAtravessado({ ultimaPresenca: ha(16), e0, e: E, marcos: DEFAULT_MARCOS })).toBe(14);
    expect(marcoAtravessado({ ultimaPresenca: ha(22), e0, e: E, marcos: DEFAULT_MARCOS })).toBeNull();
  });

  it('intervalo longo entre importações: o maior marco atravessado', () => {
    expect(marcoAtravessado({ ultimaPresenca: ha(30), e0: somarDias(E, -21), e: E, marcos: DEFAULT_MARCOS })).toBe(30);
  });

  it('o aluno que voltou e sumiu de novo depois de E0 atravessa a partir do zero', () => {
    expect(marcoAtravessado({ ultimaPresenca: ha(8), e0: somarDias(E, -21), e: E, marcos: DEFAULT_MARCOS })).toBe(7);
  });

  it('depois do último marco, nada', () => {
    expect(marcoAtravessado({ ultimaPresenca: ha(90), e0: somarDias(E, -7), e: E, marcos: DEFAULT_MARCOS })).toBeNull();
  });

  it('E0 igual a E, ou data inválida: nada', () => {
    expect(marcoAtravessado({ ultimaPresenca: ha(7), e0: E, e: E, marcos: DEFAULT_MARCOS })).toBeNull();
    expect(marcoAtravessado({ ultimaPresenca: null, e0: somarDias(E, -7), e: E, marcos: DEFAULT_MARCOS })).toBeNull();
  });

  it('com os marcos da academia', () => {
    expect(marcoAtravessado({ ultimaPresenca: ha(10), e0: somarDias(E, -7), e: E, marcos: [5, 10] })).toBe(10);
  });
});

describe('marcoAlcancado', () => {
  it('o maior marco já alcançado, ou null antes do primeiro', () => {
    expect(marcoAlcancado({ ultimaPresenca: ha(6), e: E, marcos: DEFAULT_MARCOS })).toBeNull();
    expect(marcoAlcancado({ ultimaPresenca: ha(29), e: E, marcos: DEFAULT_MARCOS })).toBe(14);
    expect(marcoAlcancado({ ultimaPresenca: ha(400), e: E, marcos: DEFAULT_MARCOS })).toBe(60);
    expect(marcoAlcancado({ ultimaPresenca: 'x', e: E, marcos: DEFAULT_MARCOS })).toBeNull();
  });
});
