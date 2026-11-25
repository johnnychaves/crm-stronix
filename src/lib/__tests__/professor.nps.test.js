import { describe, it, expect } from 'vitest';
import { npsDe, npsDoAno, somarResposta } from '../professor/nps.js';

// Totais de uma pergunta a partir das notas.
const pergunta = (notas) => ({
  soma: notas.reduce((a, b) => a + b, 0),
  promotores: notas.filter((n) => n >= 9).length,
  neutros: notas.filter((n) => n === 7 || n === 8).length,
  detratores: notas.filter((n) => n <= 6).length,
});
const vezes = (n, nota) => Array(n).fill(nota);
const totais = (notas, turma = notas.length, extra = {}) => ({ turma, respostas: notas.length, porPergunta: { q1: pergunta(notas), ...extra } });

describe('npsDe', () => {
  it('6 notas 10, 4 notas 9 e 2 notas 8 dão 9,33 e passam', () => {
    const r = npsDe(totais([...vezes(6, 10), ...vezes(4, 9), ...vezes(2, 8)]), { principalId: 'q1' });
    expect(r).toMatchObject({ valida: true, nota: 9.33, passa: true });
  });

  it('5 notas 10, 3 notas 9, 2 notas 8 e 2 notas 7 dão 8,92 e não passam', () => {
    const r = npsDe(totais([...vezes(5, 10), ...vezes(3, 9), ...vezes(2, 8), ...vezes(2, 7)]), { principalId: 'q1' });
    expect(r).toMatchObject({ valida: true, nota: 8.92, passa: false });
  });

  it('a meta é parâmetro', () => {
    const t = totais([...vezes(5, 10), ...vezes(3, 9), ...vezes(2, 8), ...vezes(2, 7)]);
    expect(npsDe(t, { principalId: 'q1', meta: 8.5 }).passa).toBe(true);
  });

  it('vale com metade da turma ou mais; 49% não vale', () => {
    expect(npsDe(totais(vezes(50, 10), 100), { principalId: 'q1' }).valida).toBe(true);
    const r = npsDe(totais(vezes(49, 10), 100), { principalId: 'q1' });
    expect(r).toMatchObject({ valida: false, nota: null, passa: null });
    expect(r.perguntas.q1.media).toBe(10);
  });

  it('vale com 10 respostas ou mais; 9 não vale', () => {
    expect(npsDe(totais(vezes(10, 10), 20), { principalId: 'q1' }).valida).toBe(true);
    expect(npsDe(totais(vezes(9, 10), 18), { principalId: 'q1' }).valida).toBe(false);
  });

  it('turma vazia nunca vale', () => {
    expect(npsDe(totais(vezes(12, 10), 0), { principalId: 'q1' }).valida).toBe(false);
  });

  it('promotores, detratores e o NPS clássico por pergunta, só como informação', () => {
    const notas = [...vezes(6, 10), ...vezes(2, 8), ...vezes(4, 4)];
    const r = npsDe(totais(notas, 12, { q2: pergunta(vezes(12, 9)) }), { principalId: 'q1' });
    expect(r.perguntas.q1).toEqual({ media: 7.67, promotores: 50, nps: 17 });
    expect(r.perguntas.q2).toEqual({ media: 9, promotores: 100, nps: 100 });
    expect(r.nota).toBe(7.67);
  });

  it('sem resposta não tem média', () => {
    expect(npsDe({ turma: 10, respostas: 0, porPergunta: { q1: pergunta([]) } }, { principalId: 'q1' }).perguntas.q1)
      .toEqual({ media: null, promotores: null, nps: null });
  });
});

describe('npsDoAno', () => {
  const passa = npsDe(totais([...vezes(6, 10), ...vezes(4, 9), ...vezes(2, 8)]), { principalId: 'q1' });
  const naoPassa = npsDe(totais([...vezes(5, 10), ...vezes(3, 9), ...vezes(2, 8), ...vezes(2, 7)]), { principalId: 'q1' });
  const invalida = npsDe(totais(vezes(9, 10), 18), { principalId: 'q1' });

  it('com uma pesquisa válida, vale ela', () => {
    expect(npsDoAno([passa, invalida])).toEqual({ nota: 9.33, pesquisas: 1, passa: true });
  });

  it('com duas válidas, a média das duas', () => {
    expect(npsDoAno([passa, naoPassa])).toEqual({ nota: 9.13, pesquisas: 2, passa: true });
  });

  it('sem pesquisa válida não há nota', () => {
    expect(npsDoAno([invalida])).toEqual({ nota: null, pesquisas: 0, passa: null });
    expect(npsDoAno([])).toEqual({ nota: null, pesquisas: 0, passa: null });
  });
});

describe('somarResposta', () => {
  it('soma a nota, separa promotor, neutro e detrator nas bordas e conta cada nota', () => {
    let t = somarResposta(null, { q1: 9, q2: 6 });
    t = somarResposta(t, { q1: 7, q2: 10 });
    expect(t.respostas).toBe(2);
    expect(t.porPergunta.q1).toMatchObject({ soma: 16, promotores: 1, neutros: 1, detratores: 0 });
    expect(t.porPergunta.q2).toMatchObject({ soma: 16, promotores: 1, neutros: 0, detratores: 1 });
    expect(t.porPergunta.q1.porNota).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0]);
  });

  it('não mexe nos totais de entrada e guarda os outros campos', () => {
    const antes = { pesquisaId: 'n1', professorId: 'p1', turma: 20, respostas: 1, porPergunta: { q1: { soma: 10, promotores: 1, neutros: 0, detratores: 0 } } };
    const depois = somarResposta(antes, { q1: 8 });
    expect(antes.respostas).toBe(1);
    expect(antes.porPergunta.q1.soma).toBe(10);
    expect(depois).toMatchObject({ pesquisaId: 'n1', professorId: 'p1', turma: 20, respostas: 2 });
    expect(depois.porPergunta.q1.porNota[8]).toBe(1);
  });

  it('o que sai dele passa pelo npsDe como os totais escritos à mão', () => {
    let t = { turma: 12 };
    [10, 10, 10, 10, 10, 10, 9, 9, 9, 9, 8, 8].forEach((n) => { t = somarResposta(t, { q1: n }); });
    expect(npsDe(t, { principalId: 'q1' })).toMatchObject({ valida: true, nota: 9.33, passa: true });
  });

  it('recusa nota fora de 0 a 10 ou quebrada', () => {
    expect(() => somarResposta(null, { q1: 11 })).toThrow();
    expect(() => somarResposta(null, { q1: -1 })).toThrow();
    expect(() => somarResposta(null, { q1: 8.5 })).toThrow();
    expect(() => somarResposta(null, { q1: '9' })).toThrow();
  });
});
