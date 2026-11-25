import { describe, it, expect } from 'vitest';
import { METAS_PADRAO, NIVEIS, metasDe, problemaDasMetas, referenciaDaRenovacao, nivelTexto } from '../professor/metas.js';

describe('metasDe', () => {
  it('sem documento, valem as metas padrão', () => {
    expect(metasDe(null)).toEqual(METAS_PADRAO);
    expect(METAS_PADRAO).toEqual({
      renovacao: { junior: 45, pleno: 55, senior: 65 },
      nps: { meta: 9 },
      conversao: { tolerancia: 0, janelaDias: 30 },
      aderencia: { barra: 2, faixaMin: 60, faixaMax: 70 },
    });
  });

  it('campo ausente ou fora do formato cai no padrão, campo bom fica', () => {
    const m = metasDe({ renovacao: { junior: 50, pleno: 'x' }, nps: { meta: 9.5 }, aderencia: { faixaMin: 80, faixaMax: 70 } });
    expect(m.renovacao).toEqual({ junior: 50, pleno: 55, senior: 65 });
    expect(m.nps.meta).toBe(9.5);
    // Faixa invertida volta inteira para o padrão.
    expect(m.aderencia).toEqual({ barra: 2, faixaMin: 60, faixaMax: 70 });
  });
});

describe('problemaDasMetas', () => {
  it('aceita as metas padrão', () => {
    expect(problemaDasMetas(METAS_PADRAO)).toBeNull();
  });

  it('recusa porcentagem fora de 0 a 100, nota fora de 0 a 10 e faixa invertida', () => {
    expect(problemaDasMetas({ ...METAS_PADRAO, renovacao: { junior: 120, pleno: 55, senior: 65 } }))
      .toEqual({ campo: 'renovacao.junior', texto: 'Use um número de 0 a 100.' });
    expect(problemaDasMetas({ ...METAS_PADRAO, nps: { meta: 11 } }))
      .toEqual({ campo: 'nps.meta', texto: 'Use uma nota de 0 a 10.' });
    expect(problemaDasMetas({ ...METAS_PADRAO, aderencia: { barra: 2, faixaMin: 70, faixaMax: 70 } }))
      .toEqual({ campo: 'aderencia.faixaMin', texto: 'O começo da faixa precisa ser menor que o fim.' });
  });
});

describe('nível', () => {
  it('três níveis, com texto e referência da renovação', () => {
    expect(NIVEIS).toEqual(['junior', 'pleno', 'senior']);
    expect(nivelTexto('pleno')).toBe('Pleno');
    expect(nivelTexto(undefined)).toBe('Sem nível');
    expect(referenciaDaRenovacao(METAS_PADRAO, 'senior')).toBe(65);
    expect(referenciaDaRenovacao(METAS_PADRAO, null)).toBeNull();
  });
});
