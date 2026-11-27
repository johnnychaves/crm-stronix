import { describe, it, expect } from 'vitest';
import {
  lerTrilha, nivelDaPessoa, professorDasMetas, proximoNivel, TRILHA_CONSULTOR, TRILHA_ESTAGIARIO,
  TRILHA_PROFESSOR, trilhaDaPessoa, trilhasDe, trilhaSugerida,
} from '../carreira/trilhas.js';
import { metasDe } from '../professor/metas.js';

const porId = (lista, id) => lista.find((t) => t.id === id);

describe('trilhasDe', () => {
  it('sem documento, as três prontas, na ordem', () => {
    const t = trilhasDe(null);
    expect(t.map((x) => x.id)).toEqual([TRILHA_PROFESSOR, TRILHA_ESTAGIARIO, TRILHA_CONSULTOR]);
    expect(t.every((x) => x.padrao && !x.arquivada)).toBe(true);
  });

  it('a Professor lê as metas de hoje enquanto não foi gravada', () => {
    const doc = {
      renovacao: { junior: 40, pleno: 50, senior: 60 },
      nps: { meta: 8.5 },
      conversao: { tolerancia: 3, janelaDias: 20 },
      aderencia: { barra: 3, faixaMin: 55, faixaMax: 75 },
    };
    const p = porId(trilhasDe(doc), TRILHA_PROFESSOR);
    expect(p).toMatchObject({ nome: 'Professor', base: 'professor', frequencia: 'anual', mes: 12 });
    expect(p.niveis).toEqual([
      { id: 'junior', nome: 'Júnior', mesesMinimos: 12 },
      { id: 'pleno', nome: 'Pleno', mesesMinimos: 24 },
      { id: 'senior', nome: 'Sênior', mesesMinimos: null },
    ]);
    expect(p.numeros.renovacao).toEqual({ ligado: true, metas: { junior: 40, pleno: 50, senior: 60 } });
    expect(p.numeros.nps.metas).toEqual({ junior: 8.5, pleno: 8.5, senior: 8.5 });
    expect(p.numeros.conversao.metas).toEqual({ junior: -3, pleno: -3, senior: -3 });
    expect(p.numeros.aderencia.metas).toEqual({ junior: 55, pleno: 55, senior: 55 });
    expect(p.ajustes).toEqual({ janelaDias: 20, barra: 3, faixaMax: 75 });
  });

  it('tolerância 0 vira 0 ponto, e não -0', () => {
    expect(Object.is(porId(trilhasDe(null), TRILHA_PROFESSOR).numeros.conversao.metas.junior, 0)).toBe(true);
  });

  it('o Estagiário vem semestral, com 45% de renovação nos três níveis', () => {
    const e = porId(trilhasDe(null), TRILHA_ESTAGIARIO);
    expect(e).toMatchObject({ frequencia: 'semestral', mes: 6, janelaRenovacao: '12meses', sugestao: { vinculo: 'estagio', modalidadeIds: [] } });
    expect(e.niveis.map((n) => [n.nome, n.mesesMinimos])).toEqual([['Estagiário I', 6], ['Estagiário II', 6], ['Estagiário III', null]]);
    expect(Object.values(e.numeros.renovacao.metas)).toEqual([45, 45, 45]);
  });

  it('o Consultor vem com os quatro números ligados e as metas em branco', () => {
    const c = porId(trilhasDe(null), TRILHA_CONSULTOR);
    expect(c.base).toBe('consultor');
    expect(Object.keys(c.numeros)).toEqual(['consultorConversao', 'vendas', 'consultorRenovacao', 'metaDiaria']);
    expect(Object.values(c.numeros).every((n) => n.ligado && Object.values(n.metas).every((v) => v === null))).toBe(true);
    expect(c.ajustes).toEqual({ vendasEm: 'reais' });
  });

  it('a trilha gravada vence a do código, e a nova entra na lista pela ordem', () => {
    const doc = {
      trilhas: {
        professor: {
          nome: 'Professor formado', base: 'professor', frequencia: 'anual', mes: 12, ordem: 0,
          niveis: [{ id: 'junior', nome: 'Júnior', mesesMinimos: 18 }, { id: 'senior', nome: 'Sênior', mesesMinimos: 6 }],
          numeros: { renovacao: { ligado: true, metas: { junior: 50, senior: 70 } } },
        },
        pilates: { nome: 'Professor de pilates', base: 'professor', niveis: [{ id: 'a', nome: 'A' }], ordem: 5 },
      },
    };
    const t = trilhasDe(doc);
    expect(t.map((x) => x.id)).toEqual(['professor', 'estagiario', 'consultor', 'pilates']);
    expect(t[0].nome).toBe('Professor formado');
    expect(t[0].niveis).toEqual([{ id: 'junior', nome: 'Júnior', mesesMinimos: 18 }, { id: 'senior', nome: 'Sênior', mesesMinimos: null }]);
    expect(t[0].numeros.nps).toEqual({ ligado: false, metas: { junior: null, senior: null } });
    expect(t[3]).toMatchObject({ padrao: false, nome: 'Professor de pilates' });
  });

  it('a padrão gravada sem nível volta para a do código, e a nova sem nível some', () => {
    const t = trilhasDe({ trilhas: { consultor: { nome: 'X', niveis: [] }, nova: { nome: 'Sem nível' } } });
    expect(porId(t, TRILHA_CONSULTOR).nome).toBe('Consultor');
    expect(porId(t, 'nova')).toBeUndefined();
  });

  it('a arquivada continua na lista, marcada', () => {
    const t = trilhasDe({ trilhas: { estagiario: { ...trilhasDe(null)[1], arquivada: true } } });
    expect(porId(t, TRILHA_ESTAGIARIO).arquivada).toBe(true);
  });
});

describe('lerTrilha', () => {
  it('campo fora do formato vale o padrão', () => {
    const t = lerTrilha({
      nome: '  Pilates  ', base: 'outra', frequencia: 'mensal', mes: 15, janelaRenovacao: 'x',
      niveis: [{ id: 'a', nome: 'A', mesesMinimos: 0 }, { id: 'b', nome: 'B' }],
      numeros: { renovacao: { ligado: true, metas: { a: 120, b: 60 } } },
      ajustes: { barra: 9, faixaMax: 80 },
      sugestao: { vinculo: 'outro', modalidadeIds: ['func', 3] },
    }, 'pilates');
    expect(t).toMatchObject({ id: 'pilates', nome: 'Pilates', base: 'professor', frequencia: 'anual', mes: 12, janelaRenovacao: '12meses', arquivada: false, ordem: 99 });
    expect(t.niveis).toEqual([{ id: 'a', nome: 'A', mesesMinimos: 12 }, { id: 'b', nome: 'B', mesesMinimos: null }]);
    expect(t.numeros.renovacao.metas).toEqual({ a: null, b: 60 });
    expect(t.ajustes).toEqual({ janelaDias: 30, barra: 2, faixaMax: 80 });
    expect(t.sugestao).toEqual({ vinculo: 'qualquer', modalidadeIds: ['func'] });
  });

  it('sem nível com id e nome, null', () => {
    expect(lerTrilha({ niveis: [{ id: '', nome: 'A' }] }, 'x')).toBeNull();
    expect(lerTrilha(null, 'x')).toBeNull();
  });

  it('a Professor das metas padrão é a de hoje', () => {
    const p = professorDasMetas(metasDe(null));
    expect(p.numeros.renovacao.metas).toEqual({ junior: 45, pleno: 55, senior: 65 });
    expect(p.numeros.nps.metas.junior).toBe(9);
    expect(p.ajustes).toEqual({ janelaDias: 30, barra: 2, faixaMax: 70 });
  });
});

describe('a pessoa na trilha', () => {
  const trilhas = trilhasDe(null);

  it('o professor sem trilha está na Professor; o consultor sem trilha, em nenhuma', () => {
    expect(trilhaDaPessoa({ nivel: 'pleno' }, trilhas, { professor: true }).id).toBe(TRILHA_PROFESSOR);
    expect(trilhaDaPessoa({}, trilhas)).toBeNull();
    expect(trilhaDaPessoa({ trilhaId: 'consultor' }, trilhas).id).toBe(TRILHA_CONSULTOR);
    expect(trilhaDaPessoa({ trilhaId: 'sumiu' }, trilhas, { professor: true })).toBeNull();
  });

  it('o nível que não existe na trilha é "sem nível"', () => {
    const p = porId(trilhas, TRILHA_PROFESSOR);
    expect(nivelDaPessoa({ nivel: 'pleno' }, p).nome).toBe('Pleno');
    expect(nivelDaPessoa({ nivel: 'estagiario1' }, p)).toBeNull();
    expect(nivelDaPessoa({}, null)).toBeNull();
  });

  it('o próximo nível, e null no último', () => {
    const p = porId(trilhas, TRILHA_PROFESSOR);
    expect(proximoNivel(p, 'junior').id).toBe('pleno');
    expect(proximoNivel(p, 'senior')).toBeNull();
    expect(proximoNivel(p, 'x')).toBeNull();
  });
});

describe('trilhaSugerida', () => {
  const trilhas = trilhasDe({
    trilhas: { pilates: { nome: 'Professor de pilates', base: 'professor', ordem: -1, sugestao: { vinculo: 'formado', modalidadeIds: ['pil'] }, niveis: [{ id: 'a', nome: 'A' }] } },
  });

  it('o professor formado cai na trilha da modalidade dele, ou na Professor', () => {
    expect(trilhaSugerida({ base: 'professor', modalidadeIds: ['pil'] }, trilhas).id).toBe('pilates');
    expect(trilhaSugerida({ base: 'professor', modalidadeIds: ['func'] }, trilhas).id).toBe(TRILHA_PROFESSOR);
  });

  it('o estagiário cai na Estagiário; sem vínculo conhecido, só as de formado ou qualquer', () => {
    expect(trilhaSugerida({ base: 'professor', vinculo: 'estagio', modalidadeIds: ['func'] }, trilhas).id).toBe(TRILHA_ESTAGIARIO);
    expect(trilhaSugerida({ base: 'professor', vinculo: null, modalidadeIds: ['func'] }, trilhas).id).toBe(TRILHA_PROFESSOR);
  });

  it('o consultor cai na Consultor, e a arquivada não é sugerida', () => {
    expect(trilhaSugerida({ base: 'consultor' }, trilhas).id).toBe(TRILHA_CONSULTOR);
    const arquivada = trilhasDe({ trilhas: { consultor: { ...porId(trilhas, TRILHA_CONSULTOR), arquivada: true } } });
    expect(trilhaSugerida({ base: 'consultor' }, arquivada)).toBeNull();
  });

  it('modalidades nulas valem como nenhuma', () => {
    expect(trilhaSugerida({ base: 'professor', modalidadeIds: null }, trilhas).id).toBe(TRILHA_PROFESSOR);
  });

  it('a Professor das metas não divide a lista de níveis com quem a chamou antes', () => {
    professorDasMetas(metasDe(null)).niveis[0].nome = 'X';
    expect(porId(trilhasDe(null), TRILHA_PROFESSOR).niveis[0].nome).toBe('Júnior');
    expect(porId(trilhasDe(null), TRILHA_CONSULTOR).niveis[0].nome).toBe('Júnior');
  });
});
