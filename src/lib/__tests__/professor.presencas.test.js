import { describe, it, expect } from 'vitest';
import {
  casarComLeads, colunasDoRelatorio, diaDaAula, presencasDoRelatorio, semanaDe, semanasInteiras,
} from '../professor/presencas.js';

const CPF_A = '52998224725';
const CPF_B = '11144477735';

describe('colunas e datas', () => {
  it('acha as colunas pelo apelido, sem caixa e sem espaço nas pontas', () => {
    expect(colunasDoRelatorio([' Cliente ', 'CPF', 'Data da aula', 'Status', 'Modalidade'])).toEqual({
      cpf: 'CPF', data: 'Data da aula', situacao: 'Status', modalidade: 'Modalidade', nome: ' Cliente ',
    });
    expect(colunasDoRelatorio(['Cliente', 'Data'])).toMatchObject({ cpf: null, situacao: null, modalidade: null });
  });

  it('lê a data em texto, em Date e em número do Excel', () => {
    expect(diaDaAula('03/11/2026 18:00')).toEqual(new Date(2026, 10, 3));
    expect(diaDaAula(new Date(2026, 10, 3, 18, 30))).toEqual(new Date(2026, 10, 3));
    expect(diaDaAula(46329)).toEqual(new Date(2026, 10, 3));
    expect(diaDaAula('31/02/2026')).toBeNull();
    expect(diaDaAula('')).toBeNull();
  });

  it('a semana é a segunda-feira, e só entram as semanas inteiras do período', () => {
    expect(semanaDe(new Date(2026, 10, 6))).toBe('2026-11-02');
    expect(semanaDe(new Date(2026, 10, 2))).toBe('2026-11-02');
    expect(semanaDe(new Date(2026, 10, 8))).toBe('2026-11-02');
    expect(semanasInteiras('2026-11-01', '2026-11-30')).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']);
    expect(semanasInteiras('2026-11-03', '2026-11-26')).toEqual(['2026-11-09', '2026-11-16']);
    expect(semanasInteiras('2026-11-30', '2026-11-01')).toEqual([]);
  });
});

describe('presencasDoRelatorio', () => {
  const col = { cpf: 'CPF', data: 'Data', situacao: 'Status', modalidade: 'Modalidade', nome: 'Cliente' };
  const l = (cpf, data, status = 'Presente', mod = 'Treinamento Funcional') => ({ CPF: cpf, Data: data, Status: status, Modalidade: mod, Cliente: 'X' });

  it('soma as presenças por CPF e semana e conta o que ficou fora', () => {
    const r = presencasDoRelatorio([
      l('529.982.247-25', '03/11/2026'), l(CPF_A, '05/11/2026'), l(CPF_A, '10/11/2026'),
      l(CPF_B, '04/11/2026', 'Faltou'),
      l(CPF_B, '04/11/2026', 'Presente', 'Pilates'),
      l(CPF_B, '07/11/2026'),
      l('', '04/11/2026'),
      l(CPF_B, '26/10/2026'),
      l(CPF_B, 'sem data'),
    ], col, { de: '2026-11-01', ate: '2026-11-15' });
    expect([...r.contagem.entries()]).toEqual([[`${CPF_A}_2026-11-02`, 2], [`${CPF_A}_2026-11-09`, 1]]);
    expect(r.resumo).toEqual({ linhas: 9, presencas: 3, falta: 1, outraModalidade: 1, fimDeSemana: 1, semData: 1, foraDoPeriodo: 1, semCpf: 1 });
    expect(r.semCpf).toHaveLength(1);
    expect(r.semanas).toEqual(['2026-11-02', '2026-11-09']);
  });

  it('sem coluna de situação nem de modalidade, toda linha é presença', () => {
    const r = presencasDoRelatorio([{ CPF: CPF_A, Data: '03/11/2026' }], { cpf: 'CPF', data: 'Data', situacao: null, modalidade: null }, { de: '2026-11-02', ate: '2026-11-06' });
    expect(r.contagem.get(`${CPF_A}_2026-11-02`)).toBe(1);
  });
});

describe('casarComLeads', () => {
  it('casa pelo CPF, prefere o cliente e separa sem lead e duplicado', () => {
    const contagem = new Map([[`${CPF_A}_2026-11-02`, 2], [`${CPF_A}_2026-11-09`, 1], [`${CPF_B}_2026-11-02`, 1], ['12345678909_2026-11-02', 3]]);
    const leads = [
      { id: 'ana-lead', cpfDigits: CPF_A, lifecycleBucket: 'lead' },
      { id: 'ana', cpfDigits: CPF_A, lifecycleBucket: 'cliente' },
      { id: 'b1', cpfDigits: CPF_B, lifecycleBucket: 'cliente' },
      { id: 'b2', cpfDigits: CPF_B, lifecycleBucket: 'cliente' },
    ];
    expect(casarComLeads(contagem, leads)).toEqual({
      registros: [{ leadId: 'ana', semana: '2026-11-02', presencas: 2 }, { leadId: 'ana', semana: '2026-11-09', presencas: 1 }],
      semLead: ['12345678909'],
      duplicados: [CPF_B],
    });
  });
});
