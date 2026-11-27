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
    expect(problemaDaTrilha(t)).toEqual({ campo: 'meses-0', texto: 'Tempo mínimo em Júnior: use um número de meses de 1 a 120.' });
    t.niveis[0].mesesMinimos = NaN;
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
    expect(problemaDaTrilha(t)).toEqual({ campo: 'meta-renovacao-junior', texto: 'Renovação da carteira, Júnior: use um número de 0 a 100.' });
    t.numeros.renovacao.metas.junior = NaN;
    expect(problemaDaTrilha(t)).toEqual({ campo: 'meta-renovacao-junior', texto: 'Renovação da carteira, Júnior: use um número de 0 a 100.' });
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

  it('o limite das vendas em reais sai em mil reais, como o campo mostra', () => {
    const c = trilha('consultor');
    c.numeros.vendas.metas[c.niveis[0].id] = 10000001;
    expect(problemaDaTrilha(c).texto).toBe(`Vendas, ${c.niveis[0].nome}: use um valor de 0 a 10.000 mil reais.`);
    c.ajustes.vendasEm = 'quantidade';
    expect(problemaDaTrilha(c).texto).toBe(`Vendas, ${c.niveis[0].nome}: use um número de 0 a 10000000.`);
  });

  // A trava do PR 2: o PR 3 a tira, junto com este teste.
  it('a trilha Professor muda a frequência e o mês, como as outras', () => {
    const gravada = trilha();
    expect(problema({ ...trilha(), frequencia: 'semestral', mes: 6 }, { gravada })).toBeNull();
    expect(problema({ ...trilha(), mes: 3 }, { gravada })).toBeNull();
  });

  it('as três trilhas que vêm prontas não mudam de base, com ou sem gente', () => {
    const gravada = trilha('estagiario');
    expect(gravada.padrao).toBe(true);
    const outraBase = { ...trilha('estagiario'), base: 'consultor', numeros: {} };
    expect(problemaDaTrilha(outraBase, { gravada, pessoasPorNivel: {} }))
      .toEqual({ campo: 'base', texto: 'A trilha Estagiário vem pronta e continua sendo de professores.' });
    const criada = { ...gravada, id: 'minha', padrao: false };
    expect(problema({ ...criada, base: 'consultor', numeros: {} }, { gravada: criada, pessoasPorNivel: {} })).toBeNull();
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
    const minha = { ...trilha(), id: 'minha', nome: 'Minha', padrao: false };
    const outraBase = { ...minha, base: 'consultor', numeros: {} };
    expect(problemaDaTrilha(outraBase, { gravada: minha, pessoasPorNivel: { junior: 2 } }))
      .toEqual({ campo: 'base', texto: 'Com gente na trilha, ela continua sendo de professores.' });
    expect(problema(outraBase, { gravada: minha, pessoasPorNivel: {} })).toBeNull();
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
