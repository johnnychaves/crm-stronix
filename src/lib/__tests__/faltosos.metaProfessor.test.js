// A regra da Meta diária do professor (src/lib/faltosos/metaProfessor.js).
import { describe, it, expect } from 'vitest';
import {
  pendentesDe, feitosDaSemana, gruposDaSemana, diasSemVir, motivoDe, fraseDe, resultadoTexto,
  RESULTADOS, CANAIS,
} from '../faltosos/metaProfessor.js';

const HOJE = '2026-11-27';
const est = (id, extra = {}) => ({
  id, leadId: id, status: 'faltando', professorId: 'p1', ultimaPresenca: '2026-11-06', inicioFalta: '2026-11-06',
  urgente: false, contratoTerminaEm: '2027-06-11',
  tarefa: { marco: 14, urgente: false, status: 'pendente', inicioFalta: '2026-11-06', criadaEm: '2026-11-23', importacaoId: 'f2026-11-23', feitaEm: null },
  ...extra,
});
const ts = (iso) => ({ toMillis: () => Date.parse(iso) });

describe('pendentes', () => {
  it('só faltando, com tarefa pendente do período atual', () => {
    const docs = [
      est('a'),
      est('b', { status: 'voltou' }),
      est('c', { tarefa: { ...est('c').tarefa, status: 'feita' } }),
      est('d', { tarefa: { ...est('d').tarefa, inicioFalta: '2026-09-01' } }),
      est('e', { tarefa: null }),
    ];
    expect(pendentesDe(docs, HOJE).map((d) => d.id)).toEqual(['a']);
  });

  it('urgentes primeiro, depois mais dias sem vir, depois o nome', () => {
    const docs = [
      est('x', { ultimaPresenca: '2026-11-16' }),
      est('y', { ultimaPresenca: '2026-10-21' }),
      est('z', { ultimaPresenca: '2026-11-20', urgente: true }),
      est('w', { ultimaPresenca: '2026-10-21' }),
    ];
    const nomes = { x: 'Xavier', y: 'Yara', z: 'Zeca', w: 'Wagner' };
    expect(pendentesDe(docs, HOJE, (id) => nomes[id]).map((d) => d.id)).toEqual(['z', 'w', 'y', 'x']);
  });
});

describe('feitos da semana', () => {
  it('feita ou voltou com feitaEm a partir da última importação', () => {
    const desde = new Date('2026-11-23T12:00:00Z');
    const docs = [
      est('a', { tarefa: { ...est('a').tarefa, status: 'feita', feitaEm: ts('2026-11-24T10:00:00Z') } }),
      est('b', { status: 'voltou', tarefa: { ...est('b').tarefa, status: 'voltou', feitaEm: ts('2026-11-25T10:00:00Z') } }),
      est('c', { tarefa: { ...est('c').tarefa, status: 'feita', feitaEm: ts('2026-11-20T10:00:00Z') } }),
      est('d', { status: 'voltou', tarefa: { ...est('d').tarefa, status: 'voltou', feitaEm: null } }),
    ];
    expect(feitosDaSemana(docs, desde).map((d) => d.id)).toEqual(['b', 'a']);
  });

  it('sem importação, nada conta como da semana', () => {
    expect(feitosDaSemana([est('a', { tarefa: { ...est('a').tarefa, status: 'feita', feitaEm: ts('2026-11-24T10:00:00Z') } })], null)).toEqual([]);
  });
});

describe('grupos e textos', () => {
  it('conta urgentes e cada marco', () => {
    const docs = [est('a', { urgente: true }), est('b'), est('c', { tarefa: { ...est('c').tarefa, marco: 30 } })];
    expect(gruposDaSemana(docs, [7, 14, 30, 60])).toEqual([
      { id: 'urgentes', nome: 'Urgentes', total: 1 },
      { id: '60', nome: '60 dias sem vir', total: 0 },
      { id: '30', nome: '30 dias sem vir', total: 1 },
      { id: '14', nome: '14 dias sem vir', total: 1 },
      { id: '7', nome: '7 dias sem vir', total: 0 },
    ]);
  });

  it('dias sem vir até hoje, em Brasília', () => {
    expect(diasSemVir(est('a'), HOJE)).toBe(21);
    expect(diasSemVir(est('a', { ultimaPresenca: null }), HOJE)).toBeNull();
  });

  it('motivo e frase', () => {
    expect(motivoDe(est('a'))).toBe('Marco dos 14 dias sem vir');
    expect(motivoDe(est('a', { urgente: true, contratoTerminaEm: '2026-12-10' }))).toBe('Urgente: o contrato termina em 10/12');
    expect(fraseDe(est('a'), HOJE)).toEqual({ dias: 21, desde: '06/11', termina: null });
    expect(fraseDe(est('a', { urgente: true, contratoTerminaEm: '2026-12-10' }), HOJE)).toEqual({ dias: 21, desde: '06/11', termina: '10/12' });
  });

  it('listas e texto do resultado', () => {
    expect(RESULTADOS.map((r) => r.id)).toEqual(['vai_voltar', 'respondeu', 'nao_respondeu', 'quer_cancelar']);
    expect(CANAIS.map((c) => c.id)).toEqual(['whatsapp', 'ligacao', 'pessoalmente']);
    expect(resultadoTexto('quer_cancelar')).toBe('Quer cancelar');
    expect(resultadoTexto(null)).toBe('');
  });
});
