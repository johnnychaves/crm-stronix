import { describe, it, expect } from 'vitest';
import { normalizeContracts } from '../operacional/base.js';
import { renewalCohort, summarizeCohort } from '../operacional/renewal.js';
import { renovacaoDoCiclo } from '../professor/renovacao.js';
import { limitesDoCiclo } from '../professor/ciclo.js';

const ts = (iso) => ({ toDate: () => new Date(iso) });
const PROF = { id: 'p1', modalidadeIds: ['func'] };
const PLANOS = [{ id: 'move', modalityIds: ['func'] }, { id: 'start', modalityIds: ['musc'] }];
const ASOF = new Date('2027-12-10T12:00:00');

// Contrato de 12 meses do Move que vence em 10/03/2027.
const contrato = (id, over = {}) => ({
  id, leadId: id, planId: 'move', status: 'ativo', value: 2388,
  startsAt: new Date('2026-03-10T12:00:00'), endsAt: new Date('2027-03-10T12:00:00'),
  createdAt: new Date('2026-03-10T12:00:00'), ...over,
});
const renovacao = (id, de, over = {}) => contrato(id, {
  leadId: de, renewedFromId: de, startsAt: new Date('2027-03-10T12:00:00'), endsAt: new Date('2028-03-10T12:00:00'),
  createdAt: new Date('2027-03-01T12:00:00'), ...over,
});
const conta = ({ raw, leads, ciclo = 2027, asOf = ASOF }) => renovacaoDoCiclo({
  leads, contratos: normalizeContracts(raw), planos: PLANOS, professor: PROF, ciclo, asOf,
});
const lead = (id, over = {}) => ({ id, professorId: 'p1', ...over });

describe('renovacaoDoCiclo', () => {
  it('renovados ÷ venceram, com a renovação ligada e não cancelada', () => {
    const r = conta({
      raw: [contrato('ana'), renovacao('ana-r', 'ana'), contrato('bia')],
      leads: [lead('ana'), lead('bia')],
    });
    expect(r).toMatchObject({ venceram: 2, renovados: 1, taxa: 50 });
    expect(r.linhas.map((l) => [l.contrato.id, l.renovou])).toEqual([['ana', true], ['bia', false]]);
  });

  it('lead sem histórico vale o professor atual', () => {
    expect(conta({ raw: [contrato('ana')], leads: [lead('ana')] }).venceram).toBe(1);
    expect(conta({ raw: [contrato('ana')], leads: [lead('ana', { professorId: 'p2' })] }).venceram).toBe(0);
  });

  it('professor trocado 60 dias antes do vencimento: o contrato sai da conta', () => {
    const trocou = lead('ana', { professorHistory: [{ professorId: 'p2', since: null }, { professorId: 'p1', since: ts('2027-01-09T12:00:00') }] });
    expect(conta({ raw: [contrato('ana')], leads: [trocou] }).venceram).toBe(0);
  });

  it('professor trocado 100 dias antes do vencimento: conta para o novo professor', () => {
    const trocou = lead('ana', { professorHistory: [{ professorId: 'p2', since: null }, { professorId: 'p1', since: ts('2026-11-30T12:00:00') }] });
    expect(conta({ raw: [contrato('ana')], leads: [trocou] })).toMatchObject({ venceram: 1, renovados: 0 });
    const saiu = lead('ana', { professorId: 'p2', professorHistory: [{ professorId: 'p1', since: null }, { professorId: 'p2', since: ts('2026-11-30T12:00:00') }] });
    expect(conta({ raw: [contrato('ana')], leads: [saiu] }).venceram).toBe(0);
  });

  it('contrato que nunca valeu fica fora', () => {
    const r = conta({
      raw: [contrato('ana', { status: 'cancelado', cancelledAt: new Date('2026-03-09T12:00:00') })],
      leads: [lead('ana')],
    });
    expect(r).toMatchObject({ venceram: 0, renovados: 0, taxa: null });
  });

  it('renovação cancelada não conta como renovado', () => {
    const r = conta({
      raw: [contrato('ana'), renovacao('ana-r', 'ana', { status: 'cancelado', cancelledAt: new Date('2027-03-05T12:00:00') })],
      leads: [lead('ana')],
    });
    expect(r).toMatchObject({ venceram: 1, renovados: 0, taxa: 0 });
  });

  it('ciclo com poucos contratos dá a taxa do mesmo jeito, sem aviso', () => {
    const r = conta({ raw: [contrato('ana'), renovacao('ana-r', 'ana')], leads: [lead('ana')] });
    expect(r).toEqual({ venceram: 1, renovados: 1, taxa: 100, linhas: expect.any(Array) });
  });

  it('plano de outra modalidade fica fora', () => {
    expect(conta({ raw: [contrato('ana', { planId: 'start' })], leads: [lead('ana')] }).venceram).toBe(0);
  });

  it('o vencimento manda: fora do ciclo ou depois do corte não entra, e a renovação antecipada vale pelo fim previsto', () => {
    const fora = conta({ raw: [contrato('ana')], leads: [lead('ana')], ciclo: 2026 });
    expect(fora.venceram).toBe(0);
    const antes = conta({ raw: [contrato('ana')], leads: [lead('ana')], asOf: new Date('2027-03-09T12:00:00') });
    expect(antes.venceram).toBe(0);
    // Renovação que começou antes do fim encurtou o contrato, que guarda o fim de antes.
    const encurtado = contrato('ana', { endsAt: new Date('2027-01-31T12:00:00'), originalEndsAt: new Date('2027-03-10T12:00:00') });
    const r = conta({ raw: [encurtado, renovacao('ana-r', 'ana', { startsAt: new Date('2027-02-01T12:00:00') })], leads: [lead('ana')] });
    expect(r).toMatchObject({ venceram: 1, renovados: 1 });
  });

  it('dá o mesmo número que a taxa de renovação do Operacional quando as duas se aplicam', () => {
    const raw = [
      contrato('ana'), renovacao('ana-r', 'ana'),
      contrato('bia'),
      contrato('caio', { status: 'cancelado', cancelledAt: new Date('2026-12-15T12:00:00') }),
      contrato('dani', { status: 'cancelado', cancelledAt: new Date('2026-03-09T12:00:00') }),
      contrato('edu', { status: 'trancado', pausedAt: new Date('2027-02-01T12:00:00') }),
    ];
    const leads = ['ana', 'bia', 'caio', 'dani', 'edu'].map((id) => lead(id));
    const nosso = conta({ raw, leads });
    const { inicio, fim } = limitesDoCiclo(2027);
    const operacional = summarizeCohort(renewalCohort(normalizeContracts(raw), {
      start: inicio, end: fim, asOf: ASOF, graceDays: 15, leadsById: new Map(leads.map((l) => [l.id, l])),
    }));
    expect(nosso).toMatchObject({ venceram: 2, renovados: 1, taxa: 50 });
    expect([operacional.decided, operacional.counts.renew, operacional.rate]).toEqual([nosso.venceram, nosso.renovados, nosso.taxa]);
  });
});
