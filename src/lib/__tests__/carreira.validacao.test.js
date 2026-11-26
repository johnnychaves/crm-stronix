import { describe, it, expect } from 'vitest';
import { podeArquivar, problemaDaTrilha } from '../carreira/validacao.js';
import { trilhasDe } from '../carreira/trilhas.js';

const trilha = (id = 'professor') => structuredClone(trilhasDe(null).find((t) => t.id === id));
const problema = (t, ctx) => problemaDaTrilha(t, ctx)?.campo ?? null;

describe('problemaDaTrilha', () => {
  it('as três padrão passam', () => {
    expect(problemaDaTrilha(trilha('professor'))).toBeNull();
    expect(problemaDaTrilha(trilha('estagiario'))).toBeNull();
    expect(problemaDaTrilha(trilha('consultor'))).toBeNull();
  });

  it('nome vazio ou repetido em outra trilha não arquivada', () => {
    expect(problema({ ...trilha(), nome: '  ' })).toBe('nome');
    const outras = [{ id: 'x', nome: 'professor', arquivada: false }];
    expect(problemaDaTrilha(trilha(), { outras })).toEqual({ campo: 'nome', texto: 'Já existe uma trilha com esse nome.' });
    expect(problema(trilha(), { outras: [{ ...outras[0], arquivada: true }] })).toBeNull();
    expect(problema(trilha(), { outras: [{ id: 'professor', nome: 'Professor' }] })).toBeNull();
  });

  it('de 1 a 6 níveis, com nome e sem repetir', () => {
    expect(problema({ ...trilha(), niveis: [] })).toBe('niveis');
    const sete = Array.from({ length: 7 }, (_, i) => ({ id: `n${i}`, nome: `N${i}`, mesesMinimos: 6 }));
    expect(problema({ ...trilha(), niveis: sete })).toBe('niveis');
    const t = trilha();
    t.niveis[1].nome = '';
    expect(problema(t)).toBe('nivel-1');
    const r = trilha();
    r.niveis[2].nome = 'júnior';
    expect(problemaDaTrilha(r)).toEqual({ campo: 'nivel-2', texto: 'Dois níveis têm o mesmo nome.' });
  });

  it('tempo mínimo inteiro de 1 a 120 meses, menos no último nível', () => {
    const t = trilha();
    t.niveis[0].mesesMinimos = 0;
    expect(problema(t)).toBe('meses-0');
    t.niveis[0].mesesMinimos = 1.5;
    expect(problema(t)).toBe('meses-0');
    t.niveis[0].mesesMinimos = 121;
    expect(problema(t)).toBe('meses-0');
    t.niveis[0].mesesMinimos = 12;
    t.niveis[2].mesesMinimos = null;
    expect(problema(t)).toBeNull();
  });

  it('meta fora do limite do número ligado; meta em branco passa', () => {
    const t = trilha();
    t.numeros.renovacao.metas.junior = 101;
    expect(problemaDaTrilha(t)).toEqual({ campo: 'meta-renovacao-junior', texto: 'Use um número de 0 a 100.' });
    t.numeros.renovacao.metas.junior = null;
    expect(problema(t)).toBeNull();
    t.numeros.nps.metas.pleno = 10.5;
    expect(problema(t)).toBe('meta-nps-pleno');
    t.numeros.nps.ligado = false;
    expect(problema(t)).toBeNull();
  });

  it('ajuste fora do limite só conta com o número ligado', () => {
    const t = trilha();
    t.ajustes.barra = 0;
    expect(problema(t)).toBe('ajuste-barra');
    t.numeros.aderencia.ligado = false;
    expect(problema(t)).toBeNull();
    const c = trilha();
    c.ajustes.janelaDias = 91;
    expect(problema(c)).toBe('ajuste-janelaDias');
  });

  it('a meta da aderência fica abaixo do fim da faixa', () => {
    const t = trilha();
    t.numeros.aderencia.metas.senior = 70;
    expect(problemaDaTrilha(t)).toEqual({ campo: 'meta-aderencia-senior', texto: 'A meta precisa ficar abaixo do fim da faixa.' });
  });

  it('as vendas do consultor contam em reais ou em quantidade', () => {
    const c = trilha('consultor');
    c.ajustes.vendasEm = 'dolar';
    expect(problema(c)).toBe('ajuste-vendasEm');
    c.numeros.vendas.ligado = false;
    expect(problema(c)).toBeNull();
  });

  it('com gente na trilha, a base não muda e o nível com gente não sai', () => {
    const gravada = trilha();
    const outraBase = { ...trilha(), base: 'consultor', numeros: {} };
    expect(problema(outraBase, { gravada, pessoasPorNivel: { junior: 2 } })).toBe('base');
    expect(problema(outraBase, { gravada, pessoasPorNivel: {} })).toBeNull();
    const semPleno = trilha();
    semPleno.niveis = semPleno.niveis.filter((n) => n.id !== 'pleno');
    expect(problemaDaTrilha(semPleno, { gravada, pessoasPorNivel: { pleno: 1 } }))
      .toEqual({ campo: 'niveis', texto: 'Pleno tem gente. Passe as pessoas para outro nível antes de apagar.' });
    expect(problema(semPleno, { gravada, pessoasPorNivel: { junior: 3 } })).toBeNull();
  });
});

describe('podeArquivar', () => {
  it('só a trilha sem ninguém', () => {
    expect(podeArquivar({})).toBe(true);
    expect(podeArquivar({ junior: 0 })).toBe(true);
    expect(podeArquivar({ junior: 0, pleno: 1 })).toBe(false);
    expect(podeArquivar(undefined)).toBe(true);
  });
});
