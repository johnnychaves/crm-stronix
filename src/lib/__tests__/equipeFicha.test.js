// src/lib/__tests__/equipeFicha.test.js
import { describe, it, expect } from 'vitest';
import {
  VINCULOS, vinculoSelo, vinculoTexto, MOV, novaMovimentacao, admissaoDe, comAdmissao,
  faltasDaFicha, formDoBloco, patchDoBloco, tempoDeCasa, dataBR, hojeIso,
} from '../equipe/ficha.js';

const AGORA = new Date(2026, 10, 26, 10, 0); // 26/11/2026, 10h local
const AUTOR = { id: 'gestor-1', nome: 'Johnny' };
const prof = (extra = {}) => ({ id: 'p1', nome: 'Marina', modalidadeIds: ['m-func'], ativo: true, ...extra });

describe('vínculos', () => {
  it('lista os seis da spec, na ordem', () => {
    expect(VINCULOS.map((v) => v.id)).toEqual(['clt', 'estagio', 'pj', 'socio', 'temporario', 'outro']);
  });
  it('o selo do estágio diz quem é', () => {
    expect(vinculoSelo('estagio')).toBe('Estagiário');
    expect(vinculoTexto('estagio')).toBe('Estágio');
    expect(vinculoSelo('xyz')).toBe('Sem vínculo');
  });
});

describe('movimentações', () => {
  it('desligamento leva tipo e motivo, e não leva vínculo', () => {
    const m = novaMovimentacao({ tipo: MOV.DESLIGAMENTO, data: '2026-11-26', vinculo: 'clt', tipoDesligamento: 'acordo', motivo: '  mudou ', autor: AUTOR, agora: AGORA });
    expect(m).toEqual({
      tipo: 'desligamento', data: '2026-11-26', vinculo: null, tipoDesligamento: 'acordo', motivo: 'mudou',
      registradoPor: { id: 'gestor-1', nome: 'Johnny' }, registradoEm: AGORA.toISOString(),
    });
  });
  it('admissão ignora tipo de desligamento e motivo', () => {
    const m = novaMovimentacao({ tipo: MOV.ADMISSAO, data: '2026-01-02', vinculo: 'estagio', tipoDesligamento: 'acordo', motivo: 'x', autor: AUTOR, agora: AGORA });
    expect(m.vinculo).toBe('estagio');
    expect(m.tipoDesligamento).toBeNull();
    expect(m.motivo).toBe('');
  });
  it('a admissão de agora é a última admissão ou readmissão', () => {
    const ficha = { movimentacoes: [
      { tipo: 'admissao', data: '2022-02-07' }, { tipo: 'desligamento', data: '2023-12-15' }, { tipo: 'readmissao', data: '2024-03-12' },
    ] };
    expect(admissaoDe(ficha)).toBe('2024-03-12');
    expect(admissaoDe({})).toBeNull();
  });
  it('corrigir a admissão troca a data da última entrada, sem apagar nada', () => {
    const movs = [{ tipo: 'admissao', data: '2022-02-07' }, { tipo: 'desligamento', data: '2023-12-15' }];
    const novo = comAdmissao(movs, '2022-03-01', { vinculo: 'clt', autor: AUTOR, agora: AGORA });
    expect(novo).toHaveLength(2);
    expect(novo[0].data).toBe('2022-03-01');
    expect(movs[0].data).toBe('2022-02-07');
  });
  it('sem admissão, a primeira data cria a admissão', () => {
    const novo = comAdmissao([], '2024-03-12', { vinculo: 'clt', autor: AUTOR, agora: AGORA });
    expect(novo).toEqual([novaMovimentacao({ tipo: 'admissao', data: '2024-03-12', vinculo: 'clt', autor: AUTOR, agora: AGORA })]);
  });
});

describe('o anel', () => {
  const completa = {
    cpf: '91430211870', rg: '5093318820', nascimento: '1996-07-19', celular: '51995106624',
    emailPessoal: 'marina@gmail.com', endereco: { street: 'Rua A', number: '10', city: 'Porto Alegre' },
    vinculo: 'clt', cref: '021904-G/RS', foto: { url: 'u' }, movimentacoes: [{ tipo: 'admissao', data: '2024-03-12' }],
  };
  it('professor formado conta dez itens, com o CREF', () => {
    const r = faltasDaFicha({ funcao: 'professor', ficha: { ...completa, cref: '' }, professor: prof({ photoUrl: 'x' }) });
    expect(r.total).toBe(10);
    expect(r.faltam.map((f) => f.id)).toEqual(['cref']);
  });
  it('estagiário não tem CREF', () => {
    const r = faltasDaFicha({ funcao: 'professor', ficha: { ...completa, vinculo: 'estagio', cref: '' }, professor: prof({ photoUrl: 'x' }) });
    expect(r.total).toBe(9);
    expect(r.faltam).toEqual([]);
  });
  it('a foto do professor é a do cadastro do professor', () => {
    const r = faltasDaFicha({ funcao: 'professor', ficha: completa, professor: prof() });
    expect(r.faltam.map((f) => f.id)).toEqual(['foto']);
  });
  it('pessoa sem ficha mostra tudo faltando, com o bloco de cada item', () => {
    const r = faltasDaFicha({ funcao: 'consultor', ficha: null, professor: null });
    expect(r.total).toBe(9);
    expect(r.faltam[0]).toEqual({ id: 'foto', label: 'Foto', bloco: 'identidade' });
    expect(r.faltam.find((f) => f.id === 'endereco').bloco).toBe('contato');
  });
  it('endereço só conta com rua, número e cidade', () => {
    const r = faltasDaFicha({ funcao: 'consultor', ficha: { ...completa, endereco: { city: 'Canoas' } } });
    expect(r.faltam.map((f) => f.id)).toContain('endereco');
  });
});

describe('patch de cada bloco', () => {
  const pessoa = { id: 'p1', funcao: 'professor', nome: 'Marina', ficha: { movimentacoes: [] }, professor: prof() };
  const ctx = { pessoa, autor: AUTOR, agora: AGORA, professores: [prof(), { id: 'p2', nome: 'Tiago' }] };

  it('identidade: grava só as chaves dela, CPF em dígitos', () => {
    const r = patchDoBloco('identidade', { nome: ' Marina Prado ', cpf: '529.982.247-25', rg: ' 5093 ', nascimento: '1996-07-19' }, ctx);
    expect(r).toEqual({ ficha: { nome: 'Marina Prado', cpf: '52998224725', rg: '5093', nascimento: '1996-07-19' } });
  });
  it('identidade: CPF inválido aponta o campo', () => {
    expect(patchDoBloco('identidade', { nome: 'Marina', cpf: '111.111.111-11', rg: '', nascimento: '' }, ctx))
      .toEqual({ erro: 'CPF inválido.', campo: 'cpf' });
  });
  it('identidade: professor não repete o nome de outro professor', () => {
    expect(patchDoBloco('identidade', { nome: 'tiago', cpf: '', rg: '', nascimento: '' }, ctx))
      .toEqual({ erro: 'Já existe um professor com o nome "tiago".', campo: 'nome' });
  });
  it('identidade: nascimento no futuro é recusado', () => {
    expect(patchDoBloco('identidade', { nome: 'Marina', cpf: '', rg: '', nascimento: '2030-01-01' }, ctx).campo).toBe('nascimento');
  });
  it('contato: celular em dígitos, endereço vazio vira null', () => {
    const r = patchDoBloco('contato', { celular: '(51) 99510-6624', emailPessoal: ' a@b.com ', cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }, ctx);
    expect(r).toEqual({ ficha: { celular: '51995106624', emailPessoal: 'a@b.com', endereco: null } });
  });
  it('contato: celular curto e e-mail torto são recusados', () => {
    expect(patchDoBloco('contato', { celular: '9999', emailPessoal: '' }, ctx).campo).toBe('celular');
    expect(patchDoBloco('contato', { celular: '', emailPessoal: 'semarroba' }, ctx).campo).toBe('emailPessoal');
  });
  it('trabalho: vínculo, admissão vira movimentação e as modalidades vão para o professor', () => {
    const r = patchDoBloco('trabalho', { vinculo: 'clt', admissao: '2024-03-12', cref: ' 021904-G/RS ', modalidadeIds: ['m-func'] }, ctx);
    expect(r.ficha.vinculo).toBe('clt');
    expect(r.ficha.cref).toBe('021904-G/RS');
    expect(r.ficha.movimentacoes).toHaveLength(1);
    expect(r.ficha.movimentacoes[0]).toMatchObject({ tipo: 'admissao', data: '2024-03-12', vinculo: 'clt' });
    expect(r.professor).toEqual({ modalidadeIds: ['m-func'] });
  });
  it('trabalho: estagiário não guarda CREF, e quem não é professor não mexe em professor', () => {
    const r = patchDoBloco('trabalho', { vinculo: 'estagio', admissao: '2026-02-02', cref: 'X' }, ctx);
    expect(r.ficha.cref).toBeNull();
    const c = patchDoBloco('trabalho', { vinculo: 'pj', admissao: '2026-11-24', cref: 'X' }, { ...ctx, pessoa: { ...pessoa, funcao: 'consultor', professor: null } });
    expect(c.ficha.cref).toBeNull();
    expect(c.professor).toBeNull();
  });
  it('trabalho: admissão depois de hoje é recusada', () => {
    expect(patchDoBloco('trabalho', { vinculo: 'clt', admissao: '2026-11-27' }, ctx))
      .toEqual({ erro: 'A admissão precisa ser hoje ou antes.', campo: 'admissao' });
  });
  it('o formulário de cada bloco sai da ficha e, sem ela, do login e do professor', () => {
    expect(formDoBloco('identidade', { nome: 'Ana', ficha: null }).nome).toBe('Ana');
    expect(formDoBloco('trabalho', { funcao: 'professor', ficha: null, professor: prof() }).modalidadeIds).toEqual(['m-func']);
    expect(formDoBloco('contato', { ficha: { endereco: { city: 'Canoas' } } }).city).toBe('Canoas');
  });
});

describe('datas', () => {
  it('tempo de casa em anos e meses', () => {
    expect(tempoDeCasa('2024-03-12', AGORA)).toBe('2 anos e 8 meses');
    expect(tempoDeCasa('2025-11-26', AGORA)).toBe('1 ano');
    expect(tempoDeCasa('2026-11-24', AGORA)).toBe('2 dias');
    expect(tempoDeCasa('2026-11-26', AGORA)).toBe('desde hoje');
    expect(tempoDeCasa('', AGORA)).toBe('');
  });
  it('data em dd/mm/aaaa e o dia de hoje no fuso do aparelho', () => {
    expect(dataBR('2024-03-12')).toBe('12/03/2024');
    expect(hojeIso(AGORA)).toBe('2026-11-26');
  });
});
