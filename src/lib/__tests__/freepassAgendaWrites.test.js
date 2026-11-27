import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ docs: [], filtros: [], n: 0 }));
vi.mock('../firebase.js', () => ({ appId: 'acad', AULAS_PATH: 'stronix_aulas', FREEPASS_PATH: 'stronix_freepass' }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, ...p) => ({ path: p.join('/') }),
  // doc(col) reserva um id novo; doc(col, id) aponta para um documento.
  doc: (col, id) => {
    if (id) return { path: `${col.path}/${id}`, id };
    m.n += 1;
    return { path: `${col.path}/auto${m.n}`, id: `auto${m.n}` };
  },
  query: (col, ...filtros) => ({ col, filtros }),
  where: (campo, op, valor) => ({ campo, op, valor }),
  getDocs: async (q) => { m.filtros = q.filtros; return { docs: m.docs.map(([id, d]) => ({ id, data: () => d })) }; },
  serverTimestamp: () => 'TS',
}));

const { readLeadAulas, extraAulaRecords, freepassAfterAulas, freepassLaunchParts, freepassScheduleWrites, leadAppointmentFor, reusablePendingAula } = await import('../freepassAgendaWrites.js');

const lead = { id: 'L1', name: 'Rafa', consultantId: 'u1', consultantAuthUid: 'a1', consultantName: 'Ana' };
beforeEach(() => { m.docs = []; m.n = 0; });

describe('freepassAgendaWrites', () => {
  it('readLeadAulas consulta por leadId e junta o id', async () => {
    m.docs = [['x1', { leadId: 'L1', status: 'agendada' }]];
    const r = await readLeadAulas({}, 'L1');
    expect(m.filtros).toEqual([{ campo: 'leadId', op: '==', valor: 'L1' }]);
    expect(r).toEqual([{ id: 'x1', leadId: 'L1', status: 'agendada' }]);
  });

  it('extraAulaRecords devolve ref e dados sem gravar', () => {
    const at = new Date('2026-12-01T12:00:00Z');
    const r = extraAulaRecords({ db: {}, lead, freepassId: 'fp1', aulas: [{ scheduledFor: at, professorId: 'p1', professorName: 'Carla', soloTraining: false, modality: 'Pilates' }] });
    expect(r).toHaveLength(1);
    expect(r[0].ref.path).toContain('stronix_aulas');
    expect(r[0].data).toMatchObject({
      type: 'aula', leadId: 'L1', leadName: 'Rafa', consultantId: 'u1', consultantAuthUid: 'a1', consultantName: 'Ana',
      status: 'agendada', freepassId: 'fp1', professorId: 'p1', modality: 'Pilates', scheduledFor: at, createdAt: 'TS',
    });
  });

  it('freepassAfterAulas junta o patch no freepass', () => {
    const fp = { id: 'fp1', kind: 'aulas', total: 2, aulas: 0, endsAt: null };
    const records = [
      { freepassId: 'fp1', status: 'agendada', scheduledFor: new Date(2026, 11, 1, 10) },
      { freepassId: 'fp1', status: 'agendada', scheduledFor: new Date(2026, 11, 3, 10) },
    ];
    const r = freepassAfterAulas({ freepass: fp, records });
    expect(r.patch.aulas).toBe(2);
    expect(r.patch.endsAt).toEqual(new Date(2026, 11, 3));
    expect(r.freepass).toMatchObject({ id: 'fp1', total: 2, aulas: 2 });
  });
});

// O lado do freepass do Agendar da ficha. O lote é simulado: o gancho extra
// recebe um batch que só anota as chamadas.
const fakeBatch = () => {
  const calls = [];
  return { calls, set: (ref, data) => calls.push(['set', ref.path, data]), update: (ref, data) => calls.push(['update', ref.path, data]) };
};
const now = new Date(2026, 10, 26, 10, 0);
const aula = (id, d, over = {}) => [id, { leadId: 'L1', type: 'aula', status: 'agendada', scheduledFor: d, ...over }];
const fpAulas = (over = {}) => ({
  id: 'f1', kind: 'aulas', total: 2, aulas: 1, typeName: 'Pilates 2 aulas', modalidadeId: 'm1', modalidadeName: 'Pilates',
  status: 'correndo', startsAt: new Date(2026, 10, 20), endsAt: null, contractAtStart: null, ...over,
});

describe('freepassScheduleWrites', () => {
  it('use: conta a aula no freepass, grava o resumo e aponta para a aula mais cedo', async () => {
    m.docs = [
      aula('antes', new Date(2026, 10, 28, 18), { freepassId: 'f1' }),
      aula('nova', new Date(2026, 11, 4, 18), { freepassId: 'f1' }),
    ];
    const r = await freepassScheduleWrites({ db: {}, lead, freepasses: [fpAulas()], targetId: 'f1', currentAulaId: 'nova', now });
    expect(r.daVez.id).toBe('antes');
    expect(r.notes).toEqual([]);
    expect(r.leadPatch).toMatchObject({ freepassId: 'f1', freepassAulas: 2, freepassEndsAt: new Date(2026, 11, 4) });
    const b = fakeBatch();
    r.extra(b);
    expect(b.calls).toEqual([['update', 'artifacts/acad/public/data/stronix_freepass/f1', { aulas: 2, endsAt: new Date(2026, 11, 4) }]]);
  });

  it('aula que sai do freepass (avulsa ou troca de freepass): o freepass antigo recalcula e volta a ter vaga', async () => {
    m.docs = [aula('movida', new Date(2026, 10, 28, 18), { freepassId: null })];
    const r = await freepassScheduleWrites({ db: {}, lead, freepasses: [fpAulas()], targetId: null, leftId: 'f1', currentAulaId: 'movida', now });
    expect(r.daVez).toBeNull();
    const b = fakeBatch();
    r.extra(b);
    expect(b.calls).toEqual([['update', 'artifacts/acad/public/data/stronix_freepass/f1', { aulas: 0, endsAt: null }]]);
    expect(r.leadPatch).toMatchObject({ freepassId: 'f1', freepassAulas: 0 });
  });

  it('launch por aulas: cria o freepass com as N aulas, as aulas 2..N e a nota do lançamento', async () => {
    const tipo = { id: 't1', name: 'Pilates 2 aulas', modalidadeId: 'm1', kind: 'aulas', quantity: 2, padrao: true, ativo: true };
    const aulas = [
      { scheduledFor: new Date(2026, 10, 27, 18), professorId: 'p1', professorName: 'Leo', soloTraining: false, modality: 'Pilates' },
      { scheduledFor: new Date(2026, 11, 4, 18), professorId: 'p1', professorName: 'Leo', soloTraining: false, modality: 'Pilates' },
    ];
    const launch = freepassLaunchParts({ db: {}, lead, appUser: { id: 'u1', name: 'Ana', authUid: 'a1' }, type: tipo, modalidadeName: 'Pilates', aulas });
    expect(launch.ref.path).toBe('artifacts/acad/public/data/stronix_freepass/auto1');
    expect(launch.extras).toHaveLength(1);
    expect(launch.extras[0].data).toMatchObject({ freepassId: 'auto1', scheduledFor: aulas[1].scheduledFor, professorId: 'p1' });
    // A aula 1 foi gravada pelo recordNewAppointment, com o id do freepass reservado.
    m.docs = [aula('a1', aulas[0].scheduledFor, { freepassId: 'auto1' })];
    const r = await freepassScheduleWrites({ db: {}, lead, freepasses: [], targetId: 'auto1', launch, currentAulaId: 'a1', now });
    expect(r.daVez).toBeNull();
    expect(r.notes).toEqual([{ type: 'freepass', text: 'Freepass lançado: Pilates 2 aulas (Pilates), 2 aulas marcadas.', freepassId: 'auto1' }]);
    expect(r.leadPatch).toMatchObject({ freepassId: 'auto1', freepassKind: 'aulas', freepassAulas: 2, freepassEndsAt: new Date(2026, 11, 4) });
    const b = fakeBatch();
    r.extra(b);
    expect(b.calls.map(([op, path]) => [op, path])).toEqual([
      ['set', 'artifacts/acad/public/data/stronix_freepass/auto1'],
      ['set', launch.extras[0].ref.path],
    ]);
    expect(b.calls[0][2]).toMatchObject({
      leadId: 'L1', typeId: 't1', via: 'agendar', aulas: 2, total: 2, startsAt: new Date(2026, 10, 27), endsAt: new Date(2026, 11, 4), createdAt: 'TS',
    });
    expect(b.calls[0][2]).not.toHaveProperty('id');
  });

  // O recordNewAppointment engole a falha e devolve o id antigo. Sem a aula
  // gravada no freepass, o lote não pode seguir: o freepass nasceria com uma
  // aula a menos e a aula da vez seria a segunda.
  it('a aula gravada não está no freepass de destino: lança erro e nada vai para o lote', async () => {
    const tipo = { id: 't1', name: 'Pilates 2 aulas', modalidadeId: 'm1', kind: 'aulas', quantity: 2, padrao: true, ativo: true };
    const aulas = [
      { scheduledFor: new Date(2026, 10, 27, 18), modality: 'Pilates' },
      { scheduledFor: new Date(2026, 11, 4, 18), modality: 'Pilates' },
    ];
    const launch = freepassLaunchParts({ db: {}, lead, appUser: null, type: tipo, modalidadeName: 'Pilates', aulas });
    m.docs = [];
    await expect(freepassScheduleWrites({ db: {}, lead, freepasses: [], targetId: launch.ref.id, launch, currentAulaId: 'velha', now }))
      .rejects.toThrow(/aula/);
    m.docs = [aula('velha', new Date(2026, 10, 20, 18), { freepassId: null })];
    await expect(freepassScheduleWrites({ db: {}, lead, freepasses: [fpAulas()], targetId: 'f1', currentAulaId: 'velha', now }))
      .rejects.toThrow(/aula/);
  });

  it('launch por dias: começa no dia da aula e conta a aula', async () => {
    const tipo = { id: 't2', name: 'Pilates 7 dias', modalidadeId: 'm1', kind: 'dias', quantity: 7, padrao: true, ativo: true };
    const launch = freepassLaunchParts({ db: {}, lead, appUser: null, type: tipo, modalidadeName: 'Pilates', aulas: [{ scheduledFor: new Date(2026, 10, 28, 9), modality: 'Pilates' }] });
    expect(launch.extras).toEqual([]);
    m.docs = [aula('a1', new Date(2026, 10, 28, 9), { freepassId: launch.ref.id })];
    const r = await freepassScheduleWrites({ db: {}, lead, freepasses: [], targetId: launch.ref.id, launch, currentAulaId: 'a1', now });
    const b = fakeBatch();
    r.extra(b);
    expect(b.calls[0][2]).toMatchObject({ startsAt: new Date(2026, 10, 28), endsAt: new Date(2026, 11, 4), aulas: 1 });
  });
});

describe('leadAppointmentFor: para onde vai o agendamento do lead com a aula a mais', () => {
  // Sexta, 16/10/2026, 10h; a aula nova é segunda, 19/10, 18h.
  const now = new Date(2026, 9, 16, 10, 0);
  const at = new Date(2026, 9, 19, 18, 0);
  const comAppt = (type, when, over = {}) => ({ name: 'Rafaela Souza', appointmentType: type, appointmentScheduledFor: when, currentAulaId: 'cur', ...over });
  const rec = (over = {}) => [{ id: 'cur', type: 'aula', status: 'agendada', ...over }];

  it('sem agendamento, passa para a aula nova', () => {
    expect(leadAppointmentFor({ lead: { name: 'Rafa' }, records: [], at, now })).toBe('switch');
  });
  it('agendamento mais cedo ou no mesmo instante, fica', () => {
    expect(leadAppointmentFor({ lead: comAppt('visita', new Date(2026, 9, 17, 9, 0)), records: [], at, now })).toBe('keep');
    expect(leadAppointmentFor({ lead: comAppt('visita', at), records: [], at, now })).toBe('keep');
  });
  it('aula atrasada sem desfecho, fica', () => {
    expect(leadAppointmentFor({ lead: comAppt('aula_experimental', new Date(2026, 9, 14, 18, 0)), records: rec(), at, now })).toBe('keep');
  });
  it('desfecho de antes de hoje, passa', () => {
    expect(leadAppointmentFor({ lead: comAppt('aula_experimental', new Date(2026, 9, 14, 18, 0), { appointmentOutcome: 'attended' }), records: rec(), at, now })).toBe('switch');
  });
  it('desfecho de hoje, fica', () => {
    expect(leadAppointmentFor({ lead: comAppt('aula_experimental', new Date(2026, 9, 16, 8, 0), { appointmentOutcome: 'attended' }), records: rec(), at, now })).toBe('keep');
  });
  it('aula de freepass mais tarde, passa (continua no cartão do freepass)', () => {
    expect(leadAppointmentFor({ lead: comAppt('aula_experimental', new Date(2026, 9, 22, 18, 0)), records: rec({ freepassId: 'f9' }), at, now })).toBe('switch');
  });
  it('visita pendente mais tarde, recusa', () => {
    expect(leadAppointmentFor({ lead: comAppt('visita', new Date(2026, 11, 3, 9, 0)), records: [], at, now }))
      .toEqual({ refuse: 'Rafaela tem uma visita marcada para 03/12. Remarque a visita ou marque esta aula depois dela.' });
  });
  it('aula avulsa pendente mais tarde, recusa', () => {
    expect(leadAppointmentFor({ lead: comAppt('aula_experimental', new Date(2026, 9, 22, 18, 0)), records: rec(), at, now }))
      .toEqual({ refuse: 'Rafaela tem uma aula experimental marcada para 22/10. Remarque a aula experimental ou marque esta aula depois dela.' });
  });
});

describe('reusablePendingAula: a pendente que o lançamento da aba Contratos reaproveita', () => {
  const pend = { id: 'p', type: 'aula', status: 'agendada', modality: 'Pilates', freepassId: null };
  it('aula da mesma modalidade, fora de freepass e sem desfecho', () => {
    expect(reusablePendingAula({ lead: {}, pendingAula: pend, modalidadeName: 'Pilates' })).toBe(pend);
  });
  it('outra modalidade, outro freepass, visita ou lead com desfecho, não', () => {
    expect(reusablePendingAula({ lead: {}, pendingAula: pend, modalidadeName: 'Funcional' })).toBeNull();
    expect(reusablePendingAula({ lead: {}, pendingAula: { ...pend, freepassId: 'f1' }, modalidadeName: 'Pilates' })).toBeNull();
    expect(reusablePendingAula({ lead: {}, pendingAula: { ...pend, type: 'visita' }, modalidadeName: 'Pilates' })).toBeNull();
    expect(reusablePendingAula({ lead: { appointmentOutcome: 'no_show' }, pendingAula: pend, modalidadeName: 'Pilates' })).toBeNull();
    expect(reusablePendingAula({ lead: {}, pendingAula: null, modalidadeName: 'Pilates' })).toBeNull();
  });
});
