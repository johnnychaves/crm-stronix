// O freepass na Meta Diária: a regra do Remarcar (metaFreepassChoice e
// metaFreepassPlan), a gravação do lado do freepass (com o
// freepassScheduleWrites que a ficha usa) e o Cancelou (writeFreepassAfterCancel).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ byPath: {}, n: 0, commits: [] }));
vi.mock('../firebase.js', () => ({ appId: 'acad', AULAS_PATH: 'stronix_aulas', FREEPASS_PATH: 'stronix_freepass', LEADS_PATH: 'stronix_leads' }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, ...p) => ({ path: p.join('/') }),
  doc: (col, id) => {
    if (id) return { path: `${col.path}/${id}`, id };
    m.n += 1;
    return { path: `${col.path}/auto${m.n}`, id: `auto${m.n}` };
  },
  query: (col) => ({ col }),
  where: () => ({}),
  getDocs: async (q) => ({ docs: (m.byPath[q.col.path] || []).map(([id, d]) => ({ id, data: () => d })) }),
  serverTimestamp: () => 'TS',
  writeBatch: () => {
    const calls = [];
    return { update: (ref, data) => calls.push(['update', ref.path, data]), commit: async () => { m.commits.push(calls); } };
  },
}));

const closeOpenAppointment = vi.fn(async () => null);
vi.mock('../aulasWrites.js', () => ({ closeOpenAppointment: (...a) => closeOpenAppointment(...a) }));

const { metaFreepassChoice, metaFreepassPlan, writeSlotAfterCancel } = await import('../freepassMetaWrites.js');
const { freepassScheduleWrites } = await import('../freepassAgendaWrites.js');
const { freepassChoiceText } = await import('../visitante.js');

const AULAS = 'artifacts/acad/public/data/stronix_aulas';
const FPS = 'artifacts/acad/public/data/stronix_freepass';
const LEADS = 'artifacts/acad/public/data/stronix_leads';
const now = new Date(2026, 10, 26, 10, 0);
const consultor = { id: 'u1', name: 'Ana', authUid: 'a1', role: 'consultant' };
const professor = { id: 'p9', name: 'Leo', authUid: 'a9', role: 'professor' };
const modalities = [{ id: 'm1', name: 'Pilates' }];
const tipo = { id: 't1', name: 'Pilates 2 aulas', modalidadeId: 'm1', kind: 'aulas', quantity: 2, padrao: true, ativo: true };
const fpAulas = (over = {}) => ({
  id: 'f1', leadId: 'L1', kind: 'aulas', total: 2, aulas: 1, typeName: 'Pilates 2 aulas', modalidadeId: 'm1', modalidadeName: 'Pilates',
  status: 'correndo', startsAt: new Date(2026, 10, 20), endsAt: null, contractAtStart: null, ...over,
});
const aula = (id, d, over = {}) => [id, { leadId: 'L1', type: 'aula', status: 'agendada', scheduledFor: d, modality: 'Pilates', ...over }];
const lead = (over = {}) => ({
  id: 'L1', name: 'Rafa', status: 'Agendado', consultantId: 'u1', consultantName: 'Ana',
  appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 10, 26, 18), currentAulaId: 'a1', ...over,
});
const choiceOf = (over) => metaFreepassChoice({
  lead: lead(), freepasses: [], records: [], types: [tipo], modalities, modalidadeName: 'Pilates', appUser: consultor, now, ...over,
}).choice;

beforeEach(() => { m.byPath = {}; m.n = 0; m.commits = []; closeOpenAppointment.mockClear(); });

describe('metaFreepassChoice', () => {
  it('a aula pendente do freepass cheio continua nele (moving)', () => {
    const records = [{ id: 'a1', ...aula('a1', new Date(2026, 10, 26, 18), { freepassId: 'f1' })[1] }, { id: 'a0', ...aula('a0', new Date(2026, 10, 24, 18), { freepassId: 'f1', status: 'attended' })[1] }];
    const c = choiceOf({ freepasses: [fpAulas({ aulas: 2 })], records });
    expect(c).toMatchObject({ kind: 'use', moving: true });
    expect(freepassChoiceText(c, 'Pilates')).toBe('Continua no freepass Pilates 2 aulas');
  });

  it('depois do Não compareceu a aula é outra: o freepass cheio vira avulsa', () => {
    const records = [{ id: 'a1', ...aula('a1', new Date(2026, 10, 26, 18), { freepassId: 'f1' })[1] }];
    const c = choiceOf({ freepasses: [fpAulas({ aulas: 2 })], records, afterNoShow: true });
    expect(freepassChoiceText(c, 'Pilates')).toBe('Aula avulsa: o freepass já tem as 2 aulas');
  });

  it('nunca teve freepass: nasce o do tipo padrão; o professor não lança', () => {
    expect(freepassChoiceText(choiceOf({}), 'Pilates')).toBe('Nasce o freepass Pilates 2 aulas');
    expect(freepassChoiceText(choiceOf({ appUser: professor }), 'Pilates')).toBe('Aula avulsa: só o consultor lança freepass');
  });

  it('já teve freepass na modalidade: avulsa', () => {
    const c = choiceOf({ freepasses: [fpAulas({ status: 'encerrado' })] });
    expect(freepassChoiceText(c, 'Pilates')).toBe('Aula avulsa: já teve freepass de Pilates em 20/11');
  });
});

// O Remarcar grava o registro (o upsert da Meta) entre o plano e o
// freepassScheduleWrites; aqui o upsert é simulado trocando os registros.
const at = new Date(2026, 11, 2, 18);
const aulaCampos = { scheduledFor: at, modality: 'Pilates', professorId: 'p1', professorName: 'Leo', soloTraining: false };
const gravar = async (fp, l, currentAulaId) => {
  const side = await freepassScheduleWrites({ db: {}, lead: l, freepasses: fp.freepasses, targetId: fp.targetId, leftId: fp.leftId, launch: fp.launch, currentAulaId, now });
  const calls = [];
  side.extra({ set: (ref, data) => calls.push(['set', ref.path, data]), update: (ref, data) => calls.push(['update', ref.path, data]) });
  return { side, calls };
};

describe('a gravação do Remarcar', () => {
  it('use, movendo: o registro mantém o freepass e ele reconta com a data nova', async () => {
    m.byPath[FPS] = [['f1', fpAulas({ aulas: 2 })]];
    m.byPath[AULAS] = [aula('a0', new Date(2026, 10, 24, 18), { freepassId: 'f1', status: 'attended' }), aula('a1', new Date(2026, 10, 26, 18), { freepassId: 'f1' })];
    const fp = await metaFreepassPlan({ db: {}, lead: lead(), appUser: consultor, types: [tipo], modalities, aula: aulaCampos, now });
    expect(fp).toMatchObject({ targetId: 'f1', leftId: null, launch: null });
    m.byPath[AULAS][1][1] = { ...m.byPath[AULAS][1][1], scheduledFor: at };
    const { side, calls } = await gravar(fp, lead(), 'a1');
    expect(calls).toEqual([['update', `${FPS}/f1`, { aulas: 2, endsAt: new Date(2026, 11, 2) }]]);
    expect(side.leadPatch).toMatchObject({ freepassId: 'f1', freepassAulas: 2, freepassEndsAt: new Date(2026, 11, 2) });
    expect(side.notes).toEqual([]);
  });

  it('use sem aula pendente: entra no freepass com vaga', async () => {
    m.byPath[FPS] = [['f1', fpAulas()]];
    m.byPath[AULAS] = [aula('a1', new Date(2026, 10, 24, 18), { freepassId: 'f1', status: 'no_show' })];
    const fp = await metaFreepassPlan({ db: {}, lead: lead(), appUser: consultor, types: [tipo], modalities, aula: aulaCampos, afterNoShow: true, now });
    expect(fp).toMatchObject({ targetId: 'f1', leftId: null });
    m.byPath[AULAS].push(aula('a2', at, { freepassId: 'f1' }));
    const { calls } = await gravar(fp, lead(), 'a2');
    expect(calls).toEqual([['update', `${FPS}/f1`, { aulas: 2, endsAt: new Date(2026, 11, 2) }]]);
  });

  it('launch: nasce o freepass do tipo padrão com essa aula, via Meta, e a outra fica a agendar', async () => {
    m.byPath[AULAS] = [];
    const l = lead({ currentAulaId: null, appointmentType: 'visita' });
    const fp = await metaFreepassPlan({ db: {}, lead: l, appUser: consultor, types: [tipo], modalities, aula: aulaCampos, now });
    expect(fp.targetId).toBe(fp.launch.ref.id);
    expect(fp.launch.extras).toEqual([]);
    m.byPath[AULAS] = [aula('nova', at, { freepassId: fp.targetId })];
    const { side, calls } = await gravar(fp, l, 'nova');
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('set');
    expect(calls[0][2]).toMatchObject({ typeId: 't1', via: 'meta', aulas: 1, total: 2, startsAt: new Date(2026, 11, 2), endsAt: null, createdAt: 'TS' });
    expect(side.notes).toEqual([{ type: 'freepass', text: 'Freepass lançado: Pilates 2 aulas (Pilates), 1 aula marcada, 1 para agendar.', freepassId: fp.targetId }]);
    expect(side.leadPatch).toMatchObject({ freepassId: fp.targetId, freepassAulas: 1 });
  });

  it('o professor não lança: aula avulsa, sem freepass', async () => {
    m.byPath[AULAS] = [];
    const l = lead({ currentAulaId: null, appointmentType: 'visita' });
    const fp = await metaFreepassPlan({ db: {}, lead: l, appUser: professor, types: [tipo], modalities, aula: aulaCampos, now });
    expect(fp).toMatchObject({ targetId: null, launch: null, leftId: null });
  });

  it('avulsa: a aula sai do freepass (outra modalidade) e a vaga volta', async () => {
    m.byPath[FPS] = [['f1', fpAulas({ aulas: 2 })]];
    m.byPath[AULAS] = [aula('a0', new Date(2026, 10, 24, 18), { freepassId: 'f1', status: 'attended' }), aula('a1', new Date(2026, 10, 26, 18), { freepassId: 'f1' })];
    const fp = await metaFreepassPlan({ db: {}, lead: lead(), appUser: consultor, types: [tipo], modalities, aula: { ...aulaCampos, modality: 'Funcional' }, now });
    expect(fp).toMatchObject({ targetId: null, leftId: 'f1', launch: null });
    m.byPath[AULAS][1][1] = { ...m.byPath[AULAS][1][1], scheduledFor: at, modality: 'Funcional', freepassId: null };
    const { side, calls } = await gravar(fp, lead(), 'a1');
    expect(calls).toEqual([['update', `${FPS}/f1`, { aulas: 1, endsAt: null }]]);
    expect(side.leadPatch).toMatchObject({ freepassAulas: 1, freepassEndsAt: null });
  });

  it('a visita que tira a aula pendente do freepass devolve a vaga', async () => {
    m.byPath[FPS] = [['f1', fpAulas()]];
    m.byPath[AULAS] = [aula('a1', new Date(2026, 10, 26, 18), { freepassId: 'f1' })];
    const fp = await metaFreepassPlan({ db: {}, lead: lead(), appUser: consultor, types: [tipo], modalities, aula: null, now });
    expect(fp).toMatchObject({ targetId: null, leftId: 'f1' });
  });
});

describe('writeSlotAfterCancel', () => {
  it('a vaga volta e o lead passa para a próxima aula do freepass, sem trocar o dono da tarefa', async () => {
    m.byPath[FPS] = [['f1', fpAulas({ aulas: 2, endsAt: new Date(2026, 11, 3) })]];
    m.byPath[AULAS] = [
      aula('a1', new Date(2026, 10, 26, 18), { freepassId: 'f1', status: 'cancelled' }),
      aula('a2', new Date(2026, 11, 3, 18), { freepassId: 'f1', professorId: 'p1', professorName: 'Leo' }),
    ];
    const next = await writeSlotAfterCancel({ db: {}, lead: lead({ appointmentOwnerId: 'u7' }), now });
    expect(next.id).toBe('a2');
    const [calls] = m.commits;
    expect(calls[0]).toEqual(['update', `${FPS}/f1`, { aulas: 1, endsAt: null }]);
    expect(calls[1][1]).toBe(`${LEADS}/L1`);
    expect(calls[1][2]).toMatchObject({
      freepassAulas: 1, appointmentScheduledFor: new Date(2026, 11, 3, 18), nextFollowUp: new Date(2026, 11, 3, 18),
      currentAulaId: 'a2', appointmentProfessorId: 'p1', appointmentOutcome: null, nextFollowUpNote: null,
    });
    expect(calls[1][2]).not.toHaveProperty('appointmentOwnerId');
    expect(closeOpenAppointment).not.toHaveBeenCalled();
  });

  it('sem próximo compromisso, só reconta; um contato de verdade marcado fica', async () => {
    m.byPath[FPS] = [['f1', fpAulas()]];
    m.byPath[AULAS] = [aula('a1', new Date(2026, 10, 26, 18), { freepassId: 'f1', status: 'cancelled' })];
    expect(await writeSlotAfterCancel({ db: {}, lead: lead(), now })).toBeNull();
    expect(m.commits[0][1][2]).not.toHaveProperty('appointmentScheduledFor');

    m.commits = [];
    m.byPath[AULAS].push(aula('a2', new Date(2026, 11, 3, 18), { freepassId: 'f1' }));
    const real = lead({ nextFollowUp: new Date(2026, 10, 28, 9), nextFollowUpType: 'Ligação' });
    await writeSlotAfterCancel({ db: {}, lead: real, now });
    const patch = m.commits[0][1][2];
    expect(patch.currentAulaId).toBe('a2');
    expect(patch).not.toHaveProperty('nextFollowUp');
    expect(patch).not.toHaveProperty('nextFollowUpType');
  });

  it('aula avulsa cancelada: o lead passa para a aula pendente mais cedo, sem freepass no lote', async () => {
    m.byPath[FPS] = [['f1', fpAulas()]];
    m.byPath[AULAS] = [
      aula('a1', new Date(2026, 10, 26, 18), { status: 'cancelled' }),
      aula('B', new Date(2026, 10, 30, 18), { freepassId: 'f1' }),
    ];
    expect((await writeSlotAfterCancel({ db: {}, lead: lead(), now })).id).toBe('B');
    const [calls] = m.commits;
    expect(calls).toHaveLength(1);
    expect(calls[0][2]).toMatchObject({ currentAulaId: 'B', appointmentType: 'aula_experimental' });
    expect(Object.keys(calls[0][2]).some((k) => k.startsWith('freepass'))).toBe(false);
  });

  it('visita cancelada: fecha o registro dela e o lead passa para a aula pendente', async () => {
    const vis = lead({ appointmentType: 'visita', appointmentScheduledFor: new Date(2026, 10, 26, 9), currentAulaId: null });
    m.byPath[AULAS] = [
      ['v1', { leadId: 'L1', type: 'visita', status: 'agendada', scheduledFor: new Date(2026, 10, 26, 9) }],
      aula('B', new Date(2026, 10, 30, 18)),
    ];
    expect((await writeSlotAfterCancel({ db: {}, lead: vis, now })).id).toBe('B');
    expect(closeOpenAppointment).toHaveBeenCalledWith(expect.objectContaining({ lead: vis, type: 'visita', status: 'cancelled' }));
  });

  it('o compromisso cancelado não volta, mesmo com o registro ainda agendado; sem outro, nada é gravado', async () => {
    m.byPath[FPS] = [['f1', fpAulas()]];
    m.byPath[AULAS] = [aula('a1', new Date(2026, 10, 26, 18), { freepassId: 'f1' })];
    expect(await writeSlotAfterCancel({ db: {}, lead: lead(), now })).toBeNull();
    expect(m.commits).toEqual([]);
  });
});
