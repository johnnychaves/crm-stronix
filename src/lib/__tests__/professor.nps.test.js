import { describe, it, expect } from 'vitest';
import { npsDe, npsDoAno } from '../professor/nps.js';

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
