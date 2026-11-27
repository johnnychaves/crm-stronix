import { describe, it, expect } from 'vitest';
import { aderenciaDaTrilha, contasDoProfessor, janelaDeLeitura, periodoDaPessoa } from '../carreira/professor.js';
import { pecasDaAderencia, periodoPorChave } from '../carreira/periodo.js';
import { trilhasDe } from '../carreira/trilhas.js';

const [professor, estagiario] = trilhasDe(null);
const agora = new Date(2027, 2, 10);

describe('período da pessoa', () => {
  it('a chave válida vale; a inválida ou ausente cai no período de agora', () => {
    expect(periodoDaPessoa(professor, '2026', agora).chave).toBe('2026');
    expect(periodoDaPessoa(professor, '2030', agora).chave).toBe('2027');
    expect(periodoDaPessoa(professor, null, agora).chave).toBe('2027');
    expect(periodoDaPessoa(estagiario, null, agora).chave).toBe('2027-1');
  });
});

describe('janela de leitura', () => {
  it('do início mais antigo ao fim mais novo', () => {
    const j = janelaDeLeitura([periodoPorChave(professor, '2027'), periodoPorChave(estagiario, '2027-1')]);
    expect(j.inicio).toEqual(new Date(2026, 11, 1));
    expect(j.fim).toEqual(new Date(2027, 11, 1));
  });
  it('sem período, null', () => {
    expect(janelaDeLeitura([])).toBeNull();
    expect(janelaDeLeitura([null])).toBeNull();
  });
});

describe('aderência pela frequência da trilha', () => {
  const periodo = periodoPorChave(estagiario, '2027-2');
  const linhas = [
    { semana: '2027-06-07', contam: 10, aderentes: 2 },
    { semana: '2027-07-05', contam: 40, aderentes: 32 },
  ];
  it('semestral soma; anual tira a média dos semestres fechados', () => {
    expect(aderenciaDaTrilha(estagiario, linhas, periodo, new Date(2027, 11, 5)).taxa).toBe(68);
    const anual = aderenciaDaTrilha(professor, linhas, periodoPorChave(professor, '2027'), new Date(2027, 11, 5));
    expect(anual.taxa).toBe(50); // média de 20% (jan a jun) e 80% (jul a nov)
    expect(pecasDaAderencia(periodo)).toHaveLength(2);
  });
});

describe('contasDoProfessor', () => {
  it('sem dado nenhum, os quatro resultados vazios', () => {
    const r = contasDoProfessor({
      trilha: professor,
      periodo: periodoPorChave(professor, '2027'),
      prof: { id: 'p1', nivel: 'junior', modalidadeIds: [] },
      clientes: [], contratos: [], planos: [], aulas: [], presencas: [],
      nps: { pesquisas: [], totais: [] },
      agora,
    });
    expect(r.resultados).toEqual({
      renovacao: { valor: null },
      nps: { valor: null },
      conversao: { valor: null, academia: null },
      aderencia: { valor: null },
    });
    expect(r.carteira).toEqual([]);
    expect(r.pessoas).toEqual([]);
  });
});
