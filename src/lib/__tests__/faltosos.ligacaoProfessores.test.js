// A ligação dos professores da Next Fit com o cadastro de professores
// (src/lib/faltosos/ligacaoProfessores.js), e a sugestão para o nome que a
// Next Fit corta em 29 caracteres. Professores inventados, no formato de
// stronix_professores (nome e ativo).
import { describe, it, expect } from 'vitest';
import {
  CORTE_DO_NOME, sugerirProfessor, normalizarProfessorLinks, juntarProfessorLinks, professorDaLinha, professoresNovos,
} from '../faltosos/ligacaoProfessores.js';

const PROFESSORES = [
  { id: 'p-ana', nome: 'Ana Paula Ribeiro', ativo: true },
  { id: 'p-anabela', nome: 'Anabela Costa', ativo: true },
  { id: 'p-longo', nome: 'Fulano de Tal Sobrenomecomprido', ativo: true },
  { id: 'p-bruno', nome: 'Bruno Tavares' },
  { id: 'p-velho', nome: 'Carlos Inativo Souza', ativo: false },
  { id: 'p-maria', nome: 'Maria da Silva Prado', ativo: true },
];

describe('sugerirProfessor', () => {
  it('nome igual, sem acento e sem caixa', () => {
    expect(sugerirProfessor('ANA PAULA RIBEIRO', PROFESSORES)).toBe('p-ana');
    expect(sugerirProfessor('Bruno Távares', PROFESSORES)).toBe('p-bruno');
  });

  it('o começo do nome, inteiro até um espaço', () => {
    expect(sugerirProfessor('Ana Paula', PROFESSORES)).toBe('p-ana');
  });

  it('"Anab" não vira "Anabela": o começo precisa fechar uma palavra', () => {
    expect(sugerirProfessor('Anab', PROFESSORES)).toBeNull();
  });

  it('o nome cortado no meio da palavra, com o tamanho do corte', () => {
    const cortado = 'Fulano de Tal Sobrenomecompri';
    expect(cortado).toHaveLength(CORTE_DO_NOME);
    expect(sugerirProfessor(cortado, PROFESSORES)).toBe('p-longo');
  });

  it('professor inativo não é sugerido', () => {
    expect(sugerirProfessor('Carlos Inativo Souza', PROFESSORES)).toBeNull();
  });

  it('sem começo igual, o de mais palavras em comum, pelo menos duas', () => {
    expect(sugerirProfessor('Paula Ribeiro', PROFESSORES)).toBe('p-ana');
    expect(sugerirProfessor('Ribeiro', PROFESSORES)).toBeNull();
  });

  it('"da" não conta como palavra em comum', () => {
    expect(sugerirProfessor('Joana da Silva', PROFESSORES)).toBeNull();
  });

  it('empate, nome vazio e nome sem parecido dão null', () => {
    const dois = [{ id: 'a', nome: 'Pedro Lima Souza' }, { id: 'b', nome: 'Pedro Lima Rocha' }];
    expect(sugerirProfessor('Pedro Lima', dois)).toBeNull();
    expect(sugerirProfessor('Lima Pedro', dois)).toBeNull();
    expect(sugerirProfessor('', PROFESSORES)).toBeNull();
    expect(sugerirProfessor('Controle (não alterar)', PROFESSORES)).toBeNull();
    expect(sugerirProfessor('Ana Paula', null)).toBeNull();
  });
});

describe('ligações guardadas', () => {
  it('normaliza a lista: nome com texto, um item por nome, a última escolha vale, em ordem de nome', () => {
    expect(normalizarProfessorLinks([
      { nome: '  Bruno   Tavares ', professorId: 'p-bruno' },
      { nome: 'Controle (não alterar)', professorId: '' },
      { nome: '', professorId: 'x' },
      { nome: 'bruno tavares', professorId: 'p-outro' },
      'lixo',
    ])).toEqual([
      { nome: 'bruno tavares', professorId: 'p-outro' },
      { nome: 'Controle (não alterar)', professorId: null },
    ]);
    expect(normalizarProfessorLinks(null)).toEqual([]);
    expect(normalizarProfessorLinks({ 'Bruno Tavares': 'p-bruno' })).toEqual([]);
  });

  it('as escolhas do passo curto ganham das guardadas', () => {
    const guardadas = [{ nome: 'Ana Paula Ribeiro', professorId: 'p-ana' }];
    expect(juntarProfessorLinks(guardadas, [{ nome: 'Ana Paula Ribeiro', professorId: null }, { nome: 'Bruno Tavares', professorId: 'p-bruno' }]))
      .toEqual([{ nome: 'Ana Paula Ribeiro', professorId: null }, { nome: 'Bruno Tavares', professorId: 'p-bruno' }]);
  });

  it('professorDaLinha: ligado, Sem professor, vazio e nome novo', () => {
    const links = [{ nome: 'Ana Paula Ribeiro', professorId: 'p-ana' }, { nome: 'Controle (não alterar)', professorId: null }];
    expect(professorDaLinha('ana paula ribeiro', links)).toBe('p-ana');
    expect(professorDaLinha('Controle (nao alterar)', links)).toBeNull();
    expect(professorDaLinha('', links)).toBeNull();
    expect(professorDaLinha(null, links)).toBeNull();
    expect(professorDaLinha('Bruno Tavares', links)).toBeUndefined();
  });
});

describe('professoresNovos', () => {
  it('os nomes sem ligação, com quantos alunos e a sugestão, de quem tem mais alunos para quem tem menos', () => {
    const linhas = [
      { professorNextFit: 'Ana Paula Ribeiro' },
      { professorNextFit: 'Bruno Tavares' },
      { professorNextFit: 'Bruno Tavares' },
      { professorNextFit: 'Controle (não alterar)' },
      { professorNextFit: null },
    ];
    expect(professoresNovos(linhas, [{ nome: 'Ana Paula Ribeiro', professorId: 'p-ana' }], PROFESSORES)).toEqual([
      { nome: 'Bruno Tavares', alunos: 2, sugestao: 'p-bruno' },
      { nome: 'Controle (não alterar)', alunos: 1, sugestao: null },
    ]);
  });

  it('com tudo ligado, nada a perguntar', () => {
    expect(professoresNovos([{ professorNextFit: 'Ana Paula Ribeiro' }], [{ nome: 'Ana Paula Ribeiro', professorId: null }], PROFESSORES)).toEqual([]);
  });
});
