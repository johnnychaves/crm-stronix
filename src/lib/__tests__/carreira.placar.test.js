import { describe, it, expect } from 'vitest';
import { alvoDe, duracaoTexto, estadoDe, mesesEntre, placarDe, tempoNoNivel } from '../carreira/placar.js';
import { trilhasDe } from '../carreira/trilhas.js';

const [professor, estagiario, consultor] = trilhasDe(null);

describe('alvo e estado de um número', () => {
  it('o alvo é a meta, ou a academia mais os pontos no número contra a academia', () => {
    expect(alvoDe('renovacao', 50)).toBe(50);
    expect(alvoDe('conversao', 3, 27)).toBe(30);
    expect(alvoDe('conversao', -3, 27)).toBe(24);
    expect(alvoDe('conversao', 3, null)).toBeNull();
    expect(alvoDe('renovacao', null)).toBeNull();
  });

  it('sem resultado é sem; sem meta é semMeta; senão bate ou fica abaixo', () => {
    expect(estadoDe('renovacao', { valor: null, meta: 50 })).toBe('sem');
    expect(estadoDe('renovacao', { valor: 40, meta: null })).toBe('semMeta');
    expect(estadoDe('renovacao', { valor: 50, meta: 50 })).toBe('ok');
    expect(estadoDe('renovacao', { valor: 49, meta: 50 })).toBe('baixo');
    expect(estadoDe('conversao', { valor: 28, meta: 0, academia: 27 })).toBe('ok');
    expect(estadoDe('conversao', { valor: 27, meta: 0, academia: 27 })).toBe('baixo');
    expect(estadoDe('conversao', { valor: 28, meta: 0, academia: null })).toBe('sem');
  });

  it('a folga de 3 de hoje vira −3 pontos e dá o mesmo resultado', () => {
    // conversaoDoCiclo com tolerancia 3: passa com taxa > academia − 3
    expect(estadoDe('conversao', { valor: 25, meta: -3, academia: 27 })).toBe('ok');
    expect(estadoDe('conversao', { valor: 24, meta: -3, academia: 27 })).toBe('baixo');
  });
});

describe('placarDe', () => {
  it('só os números ligados, com a meta do nível e a do próximo', () => {
    const p = placarDe(professor, 'junior', { renovacao: { valor: 47 }, nps: { valor: 9.2 }, conversao: { valor: 30, academia: 27 }, aderencia: { valor: null } });
    expect(p.nivel.id).toBe('junior');
    expect(p.proximo.id).toBe('pleno');
    expect(p.itens.map((i) => i.id)).toEqual(['renovacao', 'nps', 'conversao', 'aderencia']);
    const renov = p.itens[0];
    expect(renov).toMatchObject({ valor: 47, meta: 45, metaProxima: 55, estado: 'ok' });
    expect(p.itens[3].estado).toBe('sem');
    expect(p.naMeta).toBe(3);
    expect(p.comMeta).toBe(4);
  });

  it('número desligado não aparece', () => {
    const t = { ...professor, numeros: { ...professor.numeros, nps: { ...professor.numeros.nps, ligado: false } } };
    expect(placarDe(t, 'junior', {}).itens.map((i) => i.id)).toEqual(['renovacao', 'conversao', 'aderencia']);
  });

  it('no último nível não há próxima meta; sem nível não há meta', () => {
    const ult = placarDe(professor, 'senior', { renovacao: { valor: 60 } });
    expect(ult.proximo).toBeNull();
    expect(ult.itens[0].metaProxima).toBeNull();
    const sem = placarDe(professor, 'x', { renovacao: { valor: 60 } });
    expect(sem.nivel).toBeNull();
    expect(sem.itens[0]).toMatchObject({ meta: null, estado: 'semMeta' });
    expect(sem.comMeta).toBe(0);
  });

  it('a trilha Consultor nasce com as metas em branco', () => {
    const p = placarDe(consultor, 'junior', { vendas: { valor: 12000 } });
    expect(p.itens.every((i) => i.meta == null)).toBe(true);
    expect(p.itens.find((i) => i.id === 'vendas').estado).toBe('semMeta');
  });

  it('sem trilha, nada', () => {
    expect(placarDe(null, 'junior', {})).toMatchObject({ nivel: null, proximo: null, itens: [], naMeta: 0, comMeta: 0 });
  });
});

describe('tempo no nível', () => {
  it('conta meses inteiros', () => {
    expect(mesesEntre(new Date(2026, 0, 15), new Date(2026, 1, 14))).toBe(0);
    expect(mesesEntre(new Date(2026, 0, 15), new Date(2026, 1, 15))).toBe(1);
    expect(mesesEntre(new Date(2026, 0, 31), new Date(2027, 0, 31))).toBe(12);
    expect(mesesEntre(new Date(2027, 0, 1), new Date(2026, 0, 1))).toBe(0);
  });

  it('escreve a duração em anos e meses', () => {
    expect(duracaoTexto(0)).toBe('menos de 1 mês');
    expect(duracaoTexto(1)).toBe('1 mês');
    expect(duracaoTexto(8)).toBe('8 meses');
    expect(duracaoTexto(12)).toBe('1 ano');
    expect(duracaoTexto(18)).toBe('1 ano e 6 meses');
    expect(duracaoTexto(25)).toBe('2 anos e 1 mês');
  });

  it('antes do mínimo, quanto falta; depois, cumprido; no último nível, só o tempo', () => {
    const agora = new Date(2027, 7, 1);
    expect(tempoNoNivel(professor, { nivel: 'junior', nivelDesde: new Date(2026, 11, 1) }, agora))
      .toEqual({ meses: 8, minimo: 12, pct: 67, texto: '8 meses de 1 ano', falta: 'Faltam 4 meses para Pleno' });
    expect(tempoNoNivel(professor, { nivel: 'junior', nivelDesde: new Date(2026, 0, 1) }, agora))
      .toMatchObject({ pct: 100, texto: 'Tempo mínimo cumprido', falta: null });
    expect(tempoNoNivel(professor, { nivel: 'senior', nivelDesde: new Date(2025, 7, 1) }, agora))
      .toEqual({ meses: 24, minimo: null, pct: null, texto: '2 anos no nível', falta: null });
    expect(tempoNoNivel(estagiario, { nivel: 'estagiario1', nivelDesde: new Date(2027, 4, 1) }, agora).texto).toBe('3 meses de 6 meses');
  });

  it('sem nível ou sem data, null', () => {
    expect(tempoNoNivel(professor, { nivel: 'junior' })).toBeNull();
    expect(tempoNoNivel(professor, { nivel: 'x', nivelDesde: new Date() })).toBeNull();
    expect(tempoNoNivel(null, { nivel: 'junior', nivelDesde: new Date() })).toBeNull();
  });
});
