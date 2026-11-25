import { describe, it, expect } from 'vitest';
import { normalizeContracts } from '../operacional/base.js';
import { carteiraAt, contratosDaModalidade, estadoEm } from '../professor/carteira.js';
import { carteiraDoCiclo } from '../professor/renovacao.js';

const ts = (iso) => ({ toDate: () => new Date(iso) });
const PROF = { id: 'p1', modalidadeIds: ['func'] };
const PLANOS = [
  { id: 'move', modalityIds: ['func', 'musc'] },
  { id: 'start', modalityIds: ['musc'] },
  { id: 'legado', modalityId: 'func' },
];
const contrato = (id, leadId, planId, over = {}) => ({
  id, leadId, planId, status: 'ativo', value: 2388,
  startsAt: new Date('2027-01-10T12:00:00'), endsAt: new Date('2028-01-10T12:00:00'),
  createdAt: new Date('2027-01-10T12:00:00'), ...over,
});

describe('contratosDaModalidade', () => {
  it('fica com o plano que tem uma modalidade do professor, inclusive o legado de modalidade única', () => {
    const lista = normalizeContracts([
      contrato('c1', 'ana', 'move'), contrato('c2', 'bia', 'start'), contrato('c3', 'caio', 'legado'),
      contrato('c4', 'dani', 'apagado'), contrato('c5', 'edu', null),
    ]);
    const mapa = contratosDaModalidade(lista, PROF, PLANOS);
    expect([...mapa.keys()].sort()).toEqual(['ana', 'caio']);
  });
});

describe('estadoEm', () => {
  it('vigente vence trancado, e sem contrato no instante é null', () => {
    const [velho, novo] = normalizeContracts([
      contrato('velho', 'ana', 'move', { status: 'trancado', pausedAt: new Date('2027-02-01T12:00:00') }),
      contrato('novo', 'ana', 'move', { startsAt: new Date('2027-01-05T12:00:00') }),
    ]);
    expect(estadoEm([velho], new Date('2027-03-01T12:00:00'))).toBe('trancado');
    expect(estadoEm([velho, novo], new Date('2027-03-01T12:00:00'))).toBe('vigente');
    expect(estadoEm([novo], new Date('2026-12-01T12:00:00'))).toBeNull();
    expect(estadoEm(undefined, new Date())).toBeNull();
  });
});

describe('carteiraAt', () => {
  const contratos = normalizeContracts([
    contrato('c-ana', 'ana', 'move'),
    contrato('c-bia', 'bia', 'move'),
    contrato('c-caio', 'caio', 'start'),
    contrato('c-dani', 'dani', 'move', { status: 'trancado', pausedAt: new Date('2027-02-01T12:00:00') }),
    contrato('c-edu', 'edu', 'move', { endsAt: new Date('2027-02-10T12:00:00') }),
  ]);
  const leads = [
    { id: 'ana', professorId: 'p1' },
    // Trocou de p2 para p1 em 01/03/2027.
    { id: 'bia', professorId: 'p1', professorHistory: [{ professorId: 'p2', since: null }, { professorId: 'p1', since: ts('2027-03-01T12:00:00') }] },
    { id: 'caio', professorId: 'p1' },
    { id: 'dani', professorId: 'p1' },
    { id: 'edu', professorId: 'p1' },
  ];
  const ids = (data) => carteiraAt({ leads, contratos, planos: PLANOS, professor: PROF, data }).map((x) => `${x.lead.id}:${x.estado}`);

  it('lê o professor da data pelo histórico, deixa de fora outra modalidade e contrato vencido, e marca o trancado', () => {
    expect(ids(new Date('2027-02-15T12:00:00'))).toEqual(['ana:vigente', 'dani:trancado']);
    expect(ids(new Date('2027-03-15T12:00:00'))).toEqual(['ana:vigente', 'bia:vigente', 'dani:trancado']);
  });
});

describe('carteiraDoCiclo', () => {
  const ASOF = new Date('2027-06-15T12:00:00');
  const base = { planId: 'move', status: 'ativo', value: 2388 };
  const raw = [
    // ana venceu em março e renovou
    { id: 'a1', leadId: 'ana', ...base, startsAt: new Date('2026-03-10T12:00:00'), endsAt: new Date('2027-03-10T12:00:00'), createdAt: new Date('2026-03-10T12:00:00') },
    { id: 'a2', leadId: 'ana', ...base, renewedFromId: 'a1', startsAt: new Date('2027-03-10T12:00:00'), endsAt: new Date('2028-03-10T12:00:00'), createdAt: new Date('2027-03-01T12:00:00') },
    // bia venceu em abril sem renovar
    { id: 'b1', leadId: 'bia', ...base, startsAt: new Date('2026-04-10T12:00:00'), endsAt: new Date('2027-04-10T12:00:00'), createdAt: new Date('2026-04-10T12:00:00') },
    // caio vence em setembro
    { id: 'c1', leadId: 'caio', ...base, startsAt: new Date('2026-09-10T12:00:00'), endsAt: new Date('2027-09-10T12:00:00'), createdAt: new Date('2026-09-10T12:00:00') },
  ];
  const leads = [
    { id: 'ana', professorId: 'p1', name: 'Ana', cpfDigits: '52998224725' },
    { id: 'bia', professorId: 'p1', name: 'Bia' },
    { id: 'caio', professorId: 'p1', name: 'Caio', cpfDigits: '11144477735' },
  ];
  const linhas = carteiraDoCiclo({ leads, contratos: normalizeContracts(raw), planos: PLANOS, professor: PROF, ciclo: 2027, asOf: ASOF });

  it('uma linha por aluno, com a situação: a vencer primeiro, depois os que venceram', () => {
    expect(linhas.map((l) => [l.lead.id, l.situacao])).toEqual([['caio', 'vencer'], ['ana', 'renovou'], ['bia', 'nao']]);
  });

  it('diz o vencimento, o contrato e se falta CPF', () => {
    const bia = linhas.find((l) => l.lead.id === 'bia');
    expect(bia.vence).toEqual(new Date('2027-04-10T12:00:00'));
    expect(bia.contrato.id).toBe('b1');
    expect(bia.semCpf).toBe(true);
    expect(linhas.find((l) => l.lead.id === 'ana').semCpf).toBe(false);
    expect(linhas.find((l) => l.lead.id === 'caio')).toMatchObject({ estado: 'vigente', vence: new Date('2027-09-10T12:00:00') });
  });
});
