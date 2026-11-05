// Aulas e Visitas: quem já era cliente na hora do compromisso é "upgrade", não
// "matriculado". Datas em horário LOCAL, como o app faz.

import { describe, it, expect } from 'vitest';
import { isUpgradeAppointment, upgradeClosed } from '../apptUpgrade.js';

const AULA = new Date(2026, 10, 10, 18, 0); // 10/11/2026 18:00

const cliente = (extra = {}) => ({
  id: 'l1',
  status: 'Venda',
  isConverted: true,
  lifecycleStage: 'cliente',
  clienteSince: new Date(2026, 8, 1),
  convertedAt: new Date(2026, 8, 1),
  appointmentType: 'aula_experimental',
  appointmentScheduledFor: AULA,
  ...extra
});

describe('isUpgradeAppointment', () => {
  it('cliente ativo que ganha aula experimental é upgrade', () => {
    expect(isUpgradeAppointment(cliente())).toBe(true);
  });

  it('lead que matriculou depois da aula continua sendo matrícula', () => {
    const lead = cliente({
      clienteSince: new Date(2026, 10, 12),
      convertedAt: new Date(2026, 10, 12)
    });
    expect(isUpgradeAppointment(lead)).toBe(false);
  });

  it('lead que ainda não matriculou não é upgrade', () => {
    const lead = { id: 'l2', status: 'Em contato', appointmentType: 'aula_experimental', appointmentScheduledFor: AULA };
    expect(isUpgradeAppointment(lead)).toBe(false);
  });

  it('cliente legado sem data de matrícula segue como antes (sem como saber)', () => {
    const lead = cliente({ clienteSince: null, convertedAt: null });
    expect(isUpgradeAppointment(lead)).toBe(false);
  });

  it('sem compromisso marcado não é upgrade', () => {
    expect(isUpgradeAppointment(cliente({ appointmentScheduledFor: null, appointmentType: null }))).toBe(false);
  });
});

describe('upgradeClosed', () => {
  const lead = cliente();
  const venda = (extra = {}) => ({
    id: 'c1',
    leadId: 'l1',
    createdAt: new Date(2026, 10, 10, 19, 30),
    startsAt: new Date(2026, 10, 11),
    cancelledAt: null,
    ...extra
  });

  it('contrato vendido depois da aula fecha o upgrade', () => {
    expect(upgradeClosed(lead, [venda()])).toBe(true);
  });

  it('contrato vendido antes da aula não conta', () => {
    expect(upgradeClosed(lead, [venda({ createdAt: new Date(2026, 8, 1) })])).toBe(false);
  });

  it('sem createdAt vale o início do contrato', () => {
    expect(upgradeClosed(lead, [venda({ createdAt: null })])).toBe(true);
  });

  it('contrato de outra pessoa não conta', () => {
    expect(upgradeClosed(lead, [venda({ leadId: 'outro' })])).toBe(false);
  });

  it('contrato cancelado antes de valer (renovação desfeita) não conta', () => {
    const c = venda({ startsAt: new Date(2026, 10, 15), cancelledAt: new Date(2026, 10, 11) });
    expect(upgradeClosed(lead, [c])).toBe(false);
  });

  it('contrato cancelado depois de valer continua sendo venda feita', () => {
    const c = venda({ cancelledAt: new Date(2026, 11, 20) });
    expect(upgradeClosed(lead, [c])).toBe(true);
  });

  it('contrato importado não conta', () => {
    expect(upgradeClosed(lead, [venda({ importBatchId: 'b1' })])).toBe(false);
  });

  it('sem contratos ou sem aula, não fechou', () => {
    expect(upgradeClosed(lead, [])).toBe(false);
    expect(upgradeClosed(lead, undefined)).toBe(false);
    expect(upgradeClosed(cliente({ appointmentScheduledFor: null, appointmentType: null }), [venda()])).toBe(false);
  });
});
