import { describe, it, expect } from 'vitest';
import {
  newLeadsOf, enrollmentsOf, lossesOf, outcomeAt, channelsOf, daysToEnrollOf, convertedAtOf, clienteSinceOf, firstEnrolledAtOf,
  isImportedEnrollment
} from '../crm/cohort.js';

const D = (m, d, h = 10) => new Date(2026, m - 1, d, h);
const TS = (date) => ({ toDate: () => date });
const SEP = { start: D(9, 1, 0), end: D(10, 1, 0) };
const all = () => true;

describe('leads novos', () => {
  it('cadastro no mês, sem importado, sem data ausente e sem repetir', () => {
    const leads = [
      { id: 'a', createdAt: D(9, 2) },
      { id: 'a', createdAt: D(9, 2) },
      { id: 'b', createdAt: D(8, 31) },
      { id: 'c', createdAt: D(9, 3), createdAtMissing: true },
      { id: 'd', createdAt: D(9, 4), importBatchId: 'lote', source: 'Importação NextFit' },
      { id: 'e', createdAt: D(9, 5), importBatchId: 'lote', source: 'Instagram' }
    ];
    expect(newLeadsOf(leads, { ...SEP, inScope: all }).map((l) => l.id)).toEqual(['a', 'e']);
  });

  it('respeita o recorte', () => {
    const leads = [{ id: 'a', createdAt: D(9, 2), consultantId: 'ana' }, { id: 'b', createdAt: D(9, 2), consultantId: 'diego' }];
    expect(newLeadsOf(leads, { ...SEP, inScope: (l) => l.consultantId === 'ana' }).map((l) => l.id)).toEqual(['a']);
  });
});

describe('matrículas do mês', () => {
  it('convertedAt no mês (Timestamp ou Date), sem importado e sem carimbo ausente', () => {
    const leads = [
      { id: 'a', convertedAt: TS(D(9, 3)), createdAt: D(8, 1) },
      { id: 'b', convertedAt: D(9, 30, 23), createdAt: D(9, 1) },
      { id: 'c', convertedAt: D(10, 1, 0), createdAt: D(9, 1) },
      { id: 'd', convertedAt: D(9, 5), createdAt: D(9, 1), importSource: 'planilha', source: 'Importação' },
      { id: 'e', status: 'Venda', createdAt: D(9, 2) }
    ];
    expect(enrollmentsOf(leads, { ...SEP, inScope: all }).map((l) => l.id)).toEqual(['a', 'b']);
    expect(convertedAtOf(leads[0])).toEqual(D(9, 3));
  });

  it('o retorno de ex-cliente regrava convertedAt mas não é matrícula nova; a primeira matrícula no mês entra', () => {
    const leads = [
      { id: 'volta', convertedAt: D(9, 10), clienteSince: D(3, 5), createdAt: D(3, 1) },
      { id: 'nova', convertedAt: D(9, 12), clienteSince: TS(D(9, 12)), createdAt: D(8, 20) },
      { id: 'legado', convertedAt: D(9, 14), createdAt: D(9, 1) }
    ];
    expect(enrollmentsOf(leads, { ...SEP, inScope: all }).map((l) => l.id)).toEqual(['nova', 'legado']);
  });

  it('primeira matrícula: a mais antiga entre convertedAt e clienteSince', () => {
    expect(firstEnrolledAtOf({ convertedAt: D(9, 10), clienteSince: TS(D(3, 5)) })).toEqual(D(3, 5));
    expect(firstEnrolledAtOf({ convertedAt: TS(D(9, 10)) })).toEqual(D(9, 10));
    expect(firstEnrolledAtOf({ clienteSince: D(3, 5) })).toEqual(D(3, 5));
    expect(firstEnrolledAtOf({})).toBeNull();
    expect(clienteSinceOf({ clienteSince: TS(D(3, 5)) })).toEqual(D(3, 5));
  });

  it('conta pela primeira matrícula: com a primeira em março e o retorno em setembro, conta em março e não em setembro', () => {
    // O retorno regravou o convertedAt; o clienteSince ficou na primeira matrícula.
    const volta = { id: 'volta', convertedAt: D(9, 10), clienteSince: TS(D(3, 5)), createdAt: D(2, 20) };
    const MAR = { start: D(3, 1, 0), end: D(4, 1, 0) };
    expect(enrollmentsOf([volta], { ...MAR, inScope: all }).map((l) => l.id)).toEqual(['volta']);
    expect(enrollmentsOf([volta], { ...SEP, inScope: all })).toEqual([]);
  });
});

describe('matrícula importada', () => {
  // A importação carimba todo lead que ela toca (clientImport.js e clientImportWrites.js).
  const STAMPS = { importBatchId: 'lote', importSource: 'nextfit', importedBy: 'uid-admin' };
  const MAR = { start: D(3, 1, 0), end: D(4, 1, 0) };
  const at = (d, h, min) => new Date(2026, 8, d, h, min);

  it('data da planilha antes do cadastro no CRM: fora das matrículas e dos dias até a matrícula', () => {
    // Cadastrado no CRM em 20/09; a planilha diz que o contrato começou em 10/09.
    const l = { id: 'p', createdAt: D(9, 20), convertedAt: TS(D(9, 10, 0)), clienteSince: TS(D(9, 10, 0)), importedAt: TS(D(9, 25)), ...STAMPS };
    expect(isImportedEnrollment(l)).toBe(true);
    expect(enrollmentsOf([l], { ...SEP, inScope: all })).toEqual([]);
    expect(daysToEnrollOf([l])).toEqual({ total: 0, median: null, buckets: [0, 0, 0, 0, 0, 0] });
  });

  it('linha sem data: a matrícula a poucos minutos do importedAt fica fora', () => {
    // Sem data na planilha, clienteSince e convertedAt ficam com a hora da importação.
    const l = { id: 's', createdAt: D(3, 1), convertedAt: TS(at(4, 10, 0)), clienteSince: TS(at(4, 10, 0)), importedAt: TS(at(4, 10, 7)), ...STAMPS };
    expect(isImportedEnrollment(l)).toBe(true);
    expect(enrollmentsOf([l], { ...SEP, inScope: all })).toEqual([]);
    expect(daysToEnrollOf([l]).total).toBe(0);
  });

  it('matrícula de verdade no app, carimbada meses depois por uma importação, continua contando', () => {
    const l = { id: 'r', createdAt: D(3, 1), convertedAt: TS(D(3, 5)), clienteSince: TS(D(3, 5)), importedAt: TS(D(9, 4)), ...STAMPS };
    expect(isImportedEnrollment(l)).toBe(false);
    expect(enrollmentsOf([l], { ...MAR, inScope: all }).map((x) => x.id)).toEqual(['r']);
    expect(daysToEnrollOf([l])).toEqual({ total: 1, median: 4, buckets: [0, 0, 1, 0, 0, 0] });
  });

  it('lead sem carimbo de importação não muda, mesmo com a matrícula antes do cadastro', () => {
    const l = { id: 'n', createdAt: D(9, 20), convertedAt: D(9, 10) };
    expect(isImportedEnrollment(l)).toBe(false);
    expect(enrollmentsOf([l], { ...SEP, inScope: all }).map((x) => x.id)).toEqual(['n']);
    expect(daysToEnrollOf([l])).toMatchObject({ total: 1, median: 0 });
  });

  it('qualquer um dos três carimbos basta; sem data de cadastro real, só vale a hora da importação', () => {
    ['importBatchId', 'importSource', 'importedBy'].forEach((k) =>
      expect(isImportedEnrollment({ createdAt: D(9, 20), convertedAt: D(9, 10), [k]: 'x' })).toBe(true));
    // createdAtMissing: o normalizeLeadDoc põe "agora" no createdAt, que não serve de régua.
    const missing = { createdAt: D(9, 20), createdAtMissing: true, convertedAt: D(9, 10), clienteSince: D(9, 10), ...STAMPS };
    expect(isImportedEnrollment({ ...missing, importedAt: TS(D(9, 25)) })).toBe(false);
    expect(isImportedEnrollment({ ...missing, importedAt: TS(at(10, 10, 40)) })).toBe(true);
    expect(isImportedEnrollment({ ...missing, importedAt: TS(at(10, 11, 30)) })).toBe(false);
  });
});

describe('perdas do mês', () => {
  it('quem está em Perda hoje, com lostAt no mês, por motivo', () => {
    const leads = [
      { id: 'a', status: 'Perda', lostAt: TS(D(9, 2)), lossReason: 'Preço' },
      { id: 'b', status: 'Perda', lostAt: D(9, 3), lossReason: 'Preço' },
      { id: 'c', status: 'Perda', lostAt: D(9, 4), lossReason: '' },
      { id: 'd', status: 'Contato feito', lostAt: D(9, 4), lossReason: 'Preço' },
      { id: 'e', status: 'Perda', lostAt: D(8, 30), lossReason: 'Preço' },
      { id: 'f', status: 'Perda', isConverted: true, lostAt: D(9, 6), lossReason: 'Preço' }
    ];
    const r = lossesOf(leads, { ...SEP, inScope: all });
    expect(r).toMatchObject({ total: 3, reasons: [{ name: 'Preço', count: 2 }, { name: 'Sem motivo', count: 1 }] });
    // A lista vai junto: a etapa da perda sai dos mesmos leads.
    expect(r.leads.map((l) => l.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('desfecho da safra', () => {
  it('matriculou até o instante, perdeu até o instante, ou segue em jogo', () => {
    const asOf = D(9, 14);
    expect(outcomeAt({ convertedAt: D(9, 10) }, asOf)).toBe('enrolled');
    expect(outcomeAt({ convertedAt: D(9, 20) }, asOf)).toBe('open');
    expect(outcomeAt({ status: 'Perda', lostAt: TS(D(9, 5)) }, asOf)).toBe('lost');
    expect(outcomeAt({ status: 'Perda', lostAt: D(9, 20) }, asOf)).toBe('open');
    expect(outcomeAt({ status: 'Contato feito' }, asOf)).toBe('open');
  });

  it('quem voltou depois conta pela primeira matrícula, não pelo retorno', () => {
    expect(outcomeAt({ convertedAt: D(9, 10), clienteSince: D(3, 5) }, D(3, 20))).toBe('enrolled');
    expect(outcomeAt({ convertedAt: D(9, 10), clienteSince: D(3, 25) }, D(3, 20))).toBe('open');
  });
});

describe('canais', () => {
  it('origem do cadastro com a matrícula até o instante, do maior volume para o menor', () => {
    const asOf = D(9, 14);
    const cohort = [
      { id: 'a', source: 'Instagram', convertedAt: D(9, 5) },
      { id: 'b', source: 'Instagram' },
      { id: 'c', source: 'Indicação', convertedAt: D(9, 6) },
      { id: 'd', source: '' },
      { id: 'e', source: 'Instagram', convertedAt: D(9, 20) }
    ];
    expect(channelsOf(cohort, asOf)).toEqual([
      { name: 'Instagram', leads: 3, enrolled: 1 },
      { name: 'Indicação', leads: 1, enrolled: 1 },
      { name: 'Sem origem', leads: 1, enrolled: 0 }
    ]);
  });
});

describe('dias até a matrícula', () => {
  it('dias inteiros do cadastro à matrícula, nas seis faixas, com a mediana', () => {
    const list = [
      { createdAt: D(9, 1, 10), convertedAt: D(9, 1, 18) },
      { createdAt: D(9, 1, 10), convertedAt: D(9, 3, 9) },
      { createdAt: D(9, 1, 10), convertedAt: D(9, 6, 10) },
      { createdAt: D(8, 1, 10), convertedAt: D(9, 12, 10) },
      { createdAt: D(9, 1, 10), convertedAt: D(9, 2, 10), createdAtMissing: true }
    ];
    const r = daysToEnrollOf(list);
    expect(r.total).toBe(4);
    expect(r.buckets).toEqual([2, 0, 1, 0, 0, 1]);
    expect(r.median).toBe(3);
  });

  it('sem matrícula: nada nas faixas e sem mediana', () => {
    expect(daysToEnrollOf([])).toEqual({ total: 0, median: null, buckets: [0, 0, 0, 0, 0, 0] });
  });

  it('conta até a primeira matrícula, não até o retorno', () => {
    const r = daysToEnrollOf([{ createdAt: D(2, 20), convertedAt: D(9, 10), clienteSince: TS(D(3, 5)) }]);
    expect(r).toEqual({ total: 1, median: 13, buckets: [0, 0, 0, 1, 0, 0] });
  });
});
