// O rascunho da trilha do editor de Configurações → Plano de carreira (plano
// 2026-11-26-plano-de-carreira-02, tarefa 1): cada operação devolve uma trilha
// nova, sem mexer na que recebeu.
import { describe, it, expect } from 'vitest';
import { trilhasDe } from '../carreira/trilhas.js';
import { problemaDaTrilha } from '../carreira/validacao.js';
import {
  acrescentarNivel, apagarNivel, com, ligarNumero, metasEmBranco, MOTIVO_DO_ARQUIVAR, motivoDoApagar, mudou, novaTrilha,
  novoId, pessoasPorNivel, renomearNivel, SEM_NIVEL, totalDePessoas, trilhaParaGravar, trocarAjuste, trocarBase,
  trocarFrequencia, trocarMeses, trocarMeta, trocarSugestao,
} from '../carreira/rascunho.js';

const TRILHAS = trilhasDe(null);
const [PROFESSOR, ESTAGIARIO, CONSULTOR] = TRILHAS;
const zero = () => 0;
const ids = (t) => t.niveis.map((n) => n.id);

describe('novoId', () => {
  it('é o prefixo com 6 letras ou números sorteados', () => {
    expect(novoId('trilha', [], zero)).toBe('trilha-000000');
    expect(novoId('trilha', [], () => 0.5)).toBe('trilha-i00000');
    expect(novoId('nivel', [], Math.random)).toMatch(/^nivel-[0-9a-z]{6}$/);
  });

  it('sorteia de novo quando o id já existe, e desiste depois de 50 tentativas', () => {
    const vez = [0, 0.5];
    let i = 0;
    expect(novoId('trilha', ['trilha-000000'], () => vez[i++])).toBe('trilha-i00000');
    expect(() => novoId('trilha', ['trilha-000000'], zero)).toThrow('Não deu para gerar um id novo.');
  });
});

describe('novaTrilha', () => {
  it('de professor: um nível, os quatro números ligados em branco, anual em dezembro e depois da última', () => {
    expect(novaTrilha('professor', TRILHAS, zero)).toEqual({
      id: 'trilha-000000',
      nome: '',
      base: 'professor',
      sugestao: { vinculo: 'qualquer', modalidadeIds: [] },
      frequencia: 'anual',
      mes: 12,
      janelaRenovacao: '12meses',
      niveis: [{ id: 'nivel-000000', nome: 'Nível 1', mesesMinimos: null }],
      numeros: {
        renovacao: { ligado: true, metas: { 'nivel-000000': null } },
        nps: { ligado: true, metas: { 'nivel-000000': null } },
        conversao: { ligado: true, metas: { 'nivel-000000': null } },
        aderencia: { ligado: true, metas: { 'nivel-000000': null } },
      },
      ajustes: { janelaDias: 30, barra: 2, faixaMax: 70 },
      arquivada: false,
      ordem: 3,
    });
  });

  it('de consultor: os quatro números do consultor e as vendas em reais', () => {
    const t = novaTrilha('consultor', TRILHAS, zero);
    expect(Object.keys(t.numeros)).toEqual(['consultorConversao', 'vendas', 'consultorRenovacao', 'metaDiaria']);
    expect(t.ajustes).toEqual({ vendasEm: 'reais' });
  });

  it('sem trilha nenhuma, a ordem é 0; e só falta o nome para gravar', () => {
    const t = novaTrilha('professor', [], zero);
    expect(t.ordem).toBe(0);
    expect(problemaDaTrilha(t)).toEqual({ campo: 'nome', texto: 'Dê um nome à trilha.' });
    expect(problemaDaTrilha(com(t, { nome: 'Pilates' }))).toBeNull();
  });
});

describe('níveis', () => {
  it('acrescentar põe "Nível N" no fim, com meta em branco, e o antigo último ganha 12 meses', () => {
    const t = acrescentarNivel(PROFESSOR, zero);
    expect(t.niveis).toEqual([
      { id: 'junior', nome: 'Júnior', mesesMinimos: 12 },
      { id: 'pleno', nome: 'Pleno', mesesMinimos: 24 },
      { id: 'senior', nome: 'Sênior', mesesMinimos: 12 },
      { id: 'nivel-000000', nome: 'Nível 4', mesesMinimos: null },
    ]);
    Object.values(t.numeros).forEach((n) => expect(n.metas['nivel-000000']).toBeNull());
    expect(t.numeros.renovacao.metas.junior).toBe(45);
    expect(ids(PROFESSOR)).toEqual(['junior', 'pleno', 'senior']);
  });

  it('acrescentar pula o nome que já existe e para no limite de 6', () => {
    const doisNiveis = { ...PROFESSOR, niveis: [{ id: 'a', nome: 'A', mesesMinimos: 6 }, { id: 'b', nome: 'nível 3', mesesMinimos: null }] };
    expect(acrescentarNivel(doisNiveis, zero).niveis[2].nome).toBe('Nível 4');
    const seis = { ...PROFESSOR, niveis: Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, nome: `N${i}`, mesesMinimos: i === 5 ? null : 6 })) };
    expect(acrescentarNivel(seis, zero)).toBe(seis);
  });

  it('apagar o último tira as metas dele e o novo último perde o tempo mínimo', () => {
    const t = apagarNivel(PROFESSOR, 'senior');
    expect(t.niveis).toEqual([
      { id: 'junior', nome: 'Júnior', mesesMinimos: 12 },
      { id: 'pleno', nome: 'Pleno', mesesMinimos: null },
    ]);
    expect(t.numeros.renovacao.metas).toEqual({ junior: 45, pleno: 55 });
  });

  it('apagar do meio mantém o tempo dos outros; o único nível e o que não existe ficam', () => {
    expect(apagarNivel(PROFESSOR, 'pleno').niveis.map((n) => n.mesesMinimos)).toEqual([12, null]);
    const um = apagarNivel(apagarNivel(PROFESSOR, 'senior'), 'pleno');
    expect(apagarNivel(um, 'junior')).toBe(um);
    expect(apagarNivel(PROFESSOR, 'xyz')).toBe(PROFESSOR);
  });

  it('renomear e trocar os meses mexem só no nível pedido', () => {
    expect(renomearNivel(PROFESSOR, 'pleno', 'Pleno I').niveis[1].nome).toBe('Pleno I');
    expect(trocarMeses(PROFESSOR, 'junior', 18).niveis.map((n) => n.mesesMinimos)).toEqual([18, 24, null]);
    expect(PROFESSOR.niveis[0].mesesMinimos).toBe(12);
  });

  it('o motivo para não apagar: o único nível e o nível com gente', () => {
    const pessoas = { junior: 2, pleno: 0, senior: 0 };
    expect(motivoDoApagar(PROFESSOR, PROFESSOR.niveis[0], pessoas)).toBe('Júnior tem gente. Passe as pessoas para outro nível antes de apagar.');
    expect(motivoDoApagar(PROFESSOR, PROFESSOR.niveis[1], pessoas)).toBeNull();
    const um = apagarNivel(apagarNivel(PROFESSOR, 'senior'), 'pleno');
    expect(motivoDoApagar(um, um.niveis[0], {})).toBe('A trilha precisa de pelo menos um nível.');
  });
});

describe('números, metas e ajustes', () => {
  it('desligar guarda as metas, para ligar de novo devolver', () => {
    const off = ligarNumero(PROFESSOR, 'nps', false);
    expect(off.numeros.nps).toEqual({ ligado: false, metas: { junior: 9, pleno: 9, senior: 9 } });
    expect(off.numeros.renovacao).toBe(PROFESSOR.numeros.renovacao);
    expect(ligarNumero(off, 'nps', true).numeros.nps.ligado).toBe(true);
  });

  it('trocar a meta de um nível', () => {
    const t = trocarMeta(PROFESSOR, 'renovacao', 'junior', 50);
    expect(t.numeros.renovacao.metas).toEqual({ junior: 50, pleno: 55, senior: 65 });
    expect(PROFESSOR.numeros.renovacao.metas.junior).toBe(45);
  });

  it('trocar vendas entre reais e quantidade apaga as metas de vendas', () => {
    const comMeta = trocarMeta(CONSULTOR, 'vendas', 'junior', 12000);
    const emQuantidade = trocarAjuste(comMeta, 'vendasEm', 'quantidade');
    expect(emQuantidade.ajustes.vendasEm).toBe('quantidade');
    expect(emQuantidade.numeros.vendas.metas).toEqual({ junior: null, pleno: null, senior: null });
    expect(trocarAjuste(comMeta, 'vendasEm', 'reais').numeros.vendas.metas.junior).toBe(12000);
    expect(trocarAjuste(PROFESSOR, 'barra', 3).ajustes).toEqual({ janelaDias: 30, barra: 3, faixaMax: 70 });
  });

  it('metas em branco contam só os números ligados', () => {
    expect(metasEmBranco(CONSULTOR)).toBe(12);
    expect(metasEmBranco(ligarNumero(CONSULTOR, 'vendas', false))).toBe(9);
    expect(metasEmBranco(PROFESSOR)).toBe(0);
    expect(metasEmBranco(trocarMeta(PROFESSOR, 'nps', 'pleno', null))).toBe(1);
  });
});

describe('calendário, base e sugestão', () => {
  it('trocar a frequência leva o mês ao padrão dela', () => {
    expect(trocarFrequencia(PROFESSOR, 'semestral')).toMatchObject({ frequencia: 'semestral', mes: 6 });
    expect(trocarFrequencia(ESTAGIARIO, 'anual')).toMatchObject({ frequencia: 'anual', mes: 12 });
    expect(trocarFrequencia(PROFESSOR, 'anual')).toBe(PROFESSOR);
  });

  it('trocar a base refaz os números e os ajustes, com metas em branco', () => {
    const t = trocarBase(novaTrilha('professor', TRILHAS, zero), 'consultor');
    expect(t.base).toBe('consultor');
    expect(t.numeros).toEqual({
      consultorConversao: { ligado: true, metas: { 'nivel-000000': null } },
      vendas: { ligado: true, metas: { 'nivel-000000': null } },
      consultorRenovacao: { ligado: true, metas: { 'nivel-000000': null } },
      metaDiaria: { ligado: true, metas: { 'nivel-000000': null } },
    });
    expect(t.ajustes).toEqual({ vendasEm: 'reais' });
    expect(trocarBase(PROFESSOR, 'professor')).toBe(PROFESSOR);
  });

  it('trocar a sugestão junta com a que existe', () => {
    expect(trocarSugestao(PROFESSOR, { modalidadeIds: ['func'] }).sugestao).toEqual({ vinculo: 'formado', modalidadeIds: ['func'] });
  });
});

describe('pessoas por nível', () => {
  const PROFESSORES = [
    { id: 'p1', nivel: 'junior' },
    { id: 'p2', nivel: 'junior', ativo: true },
    { id: 'p3', nivel: 'pleno' },
    { id: 'p4', nivel: 'senior', ativo: false },
    { id: 'p5', trilhaId: 'estagiario', nivel: 'estagiario1' },
    { id: 'p6', nivel: 'xyz' },
  ];
  const USUARIOS = [
    { id: 'c1', role: 'consultant', trilhaId: 'consultor', nivel: 'pleno' },
    { id: 'g1', role: 'admin', trilhaId: 'consultor', nivel: 'junior' },
    { id: 'c2', role: 'consultant' },
  ];

  it('o professor sem trilha é da Professor, o inativo fica fora e o nível que não existe vai para sem nível', () => {
    expect(pessoasPorNivel(PROFESSOR, { professores: PROFESSORES, usuarios: USUARIOS })).toEqual({ junior: 2, pleno: 1, senior: 0, [SEM_NIVEL]: 1 });
    expect(pessoasPorNivel(ESTAGIARIO, { professores: PROFESSORES })).toEqual({ estagiario1: 1, estagiario2: 0, estagiario3: 0, [SEM_NIVEL]: 0 });
  });

  it('na trilha de consultor conta só o papel consultor com a trilha gravada', () => {
    expect(pessoasPorNivel(CONSULTOR, { professores: PROFESSORES, usuarios: USUARIOS })).toEqual({ junior: 0, pleno: 1, senior: 0, [SEM_NIVEL]: 0 });
  });

  it('o total soma todas as chaves', () => {
    expect(totalDePessoas({ junior: 2, pleno: 1, [SEM_NIVEL]: 1 })).toBe(4);
    expect(totalDePessoas({})).toBe(0);
  });

  it('o motivo do arquivar é o mesmo texto da gravação', () => {
    expect(MOTIVO_DO_ARQUIVAR).toBe('Só dá para arquivar a trilha sem ninguém nela.');
  });
});

describe('a trilha no formato de gravar', () => {
  it('leva o que o lerTrilha lê, sem o id e sem a marca de padrão', () => {
    expect(trilhaParaGravar(PROFESSOR)).toEqual({
      nome: 'Professor',
      base: 'professor',
      sugestao: { vinculo: 'formado', modalidadeIds: [] },
      frequencia: 'anual',
      mes: 12,
      janelaRenovacao: '12meses',
      niveis: [
        { id: 'junior', nome: 'Júnior', mesesMinimos: 12 },
        { id: 'pleno', nome: 'Pleno', mesesMinimos: 24 },
        { id: 'senior', nome: 'Sênior', mesesMinimos: null },
      ],
      numeros: {
        renovacao: { ligado: true, metas: { junior: 45, pleno: 55, senior: 65 } },
        nps: { ligado: true, metas: { junior: 9, pleno: 9, senior: 9 } },
        conversao: { ligado: true, metas: { junior: 0, pleno: 0, senior: 0 } },
        aderencia: { ligado: true, metas: { junior: 60, pleno: 60, senior: 60 } },
      },
      ajustes: { janelaDias: 30, barra: 2, faixaMax: 70 },
      arquivada: false,
      ordem: 0,
    });
  });

  it('apara os nomes e troca número que não vale por branco (meta) ou pelo padrão (ajuste)', () => {
    let t = com(PROFESSOR, { nome: '  Professor  ' });
    t = renomearNivel(t, 'pleno', ' Pleno ');
    t = trocarMeta(ligarNumero(t, 'nps', false), 'nps', 'junior', Number.NaN);
    t = trocarAjuste(ligarNumero(t, 'conversao', false), 'janelaDias', Number.NaN);
    const g = trilhaParaGravar(t);
    expect(g.nome).toBe('Professor');
    expect(g.niveis[1].nome).toBe('Pleno');
    expect(g.numeros.nps.metas.junior).toBeNull();
    expect(g.ajustes.janelaDias).toBe(30);
  });

  it('o que conta como mudança', () => {
    expect(mudou(PROFESSOR, PROFESSOR)).toBe(false);
    expect(mudou({ ...PROFESSOR }, PROFESSOR)).toBe(false);
    expect(mudou(trocarMeta(PROFESSOR, 'renovacao', 'junior', 50), PROFESSOR)).toBe(true);
    expect(mudou(PROFESSOR, null)).toBe(true);
  });
});
