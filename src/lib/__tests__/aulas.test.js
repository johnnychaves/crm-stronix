import { describe, it, expect } from 'vitest';
import { AULA_STATUS, isAulaRecord, outcomeToAulaStatus, pickConvertingAula, pickMirrorAppointment, aulaRecordFields, rescheduleRecordPlan } from '../aulas.js';

describe('outcomeToAulaStatus', () => {
  it('mapeia os desfechos que resolvem a aula', () => {
    expect(outcomeToAulaStatus('attended')).toBe('attended');
    expect(outcomeToAulaStatus('no_show')).toBe('no_show');
    expect(outcomeToAulaStatus('cancelled')).toBe('cancelled');
  });
  it('rescheduled/desconhecido não vira status de aula', () => {
    expect(outcomeToAulaStatus('rescheduled')).toBeNull();
    expect(outcomeToAulaStatus(undefined)).toBeNull();
  });
});

describe('pickConvertingAula', () => {
  const d = (s) => new Date(s);
  it('escolhe a atendida de maior scheduledFor', () => {
    const aulas = [
      { id: 'a', status: 'attended', scheduledFor: d('2026-07-01') },
      { id: 'b', status: 'attended', scheduledFor: d('2026-07-10') },
      { id: 'c', status: 'no_show',  scheduledFor: d('2026-07-20') },
    ];
    expect(pickConvertingAula(aulas).id).toBe('b');
  });
  it('ignora visita mesmo com data maior (contaminação)', () => {
    const aulas = [
      { id: 'aula', type: 'aula', status: 'attended', scheduledFor: d('2026-07-01') },
      { id: 'visita', type: 'visita', status: 'attended', scheduledFor: d('2026-07-20') },
    ];
    expect(pickConvertingAula(aulas).id).toBe('aula');
  });
  it('só visitas atendidas devolve null', () => {
    expect(pickConvertingAula([
      { id: 'v', type: 'visita', status: 'attended', scheduledFor: d('2026-07-20') },
    ])).toBeNull();
  });
  it('documento histórico sem type continua valendo como aula', () => {
    expect(pickConvertingAula([
      { id: 'legado', status: 'attended', scheduledFor: d('2026-07-01') },
    ]).id).toBe('legado');
  });
  it('ignora não-atendidas e retorna null se nenhuma foi atendida', () => {
    expect(pickConvertingAula([{ id: 'x', status: 'agendada', scheduledFor: d('2026-07-01') }])).toBeNull();
    expect(pickConvertingAula([])).toBeNull();
    expect(pickConvertingAula(null)).toBeNull();
  });
  it('uma única atendida é a escolhida', () => {
    expect(pickConvertingAula([{ id: 'u', status: 'attended', scheduledFor: d('2026-07-05') }]).id).toBe('u');
  });
});

describe('aulaRecordFields', () => {
  it('preenche defaults e normaliza flags', () => {
    const r = aulaRecordFields({ leadId: 'L1', professorId: 'P1', professorName: 'Ana', modality: 'Musculação', scheduledFor: 'X', status: 'agendada' });
    expect(r).toMatchObject({
      leadId: 'L1', professorId: 'P1', professorName: 'Ana', soloTraining: false,
      modality: 'Musculação', scheduledFor: 'X', status: 'agendada',
      converted: false, convertedAt: null, outcomeAt: null,
    });
  });
  it('sem professor + solo', () => {
    const r = aulaRecordFields({ leadId: 'L1', soloTraining: true, scheduledFor: 'X' });
    expect(r.professorId).toBeNull();
    expect(r.soloTraining).toBe(true);
    expect(r.status).toBe('agendada'); // default
  });
});

describe('isAulaRecord', () => {
  it('type ausente conta como aula (documento histórico)', () => {
    expect(isAulaRecord({ id: 'a', status: 'attended' })).toBe(true);
  });
  it('type explícito decide', () => {
    expect(isAulaRecord({ type: 'aula' })).toBe(true);
    expect(isAulaRecord({ type: 'visita' })).toBe(false);
  });
  it('null/undefined não quebra', () => {
    expect(isAulaRecord(null)).toBe(true);
    expect(isAulaRecord(undefined)).toBe(true);
  });
});

describe('aulaRecordFields — type e unit', () => {
  it('sem type explícito, nasce aula com unit nula', () => {
    const r = aulaRecordFields({ leadId: 'l1' });
    expect(r.type).toBe('aula');
    expect(r.unit).toBeNull();
  });
  it('visita guarda a unidade', () => {
    const r = aulaRecordFields({ leadId: 'l1', type: 'visita', unit: 'Centro' });
    expect(r.type).toBe('visita');
    expect(r.unit).toBe('Centro');
  });
  it('type inválido cai para aula', () => {
    expect(aulaRecordFields({ leadId: 'l1', type: 'mensagem' }).type).toBe('aula');
  });
});

describe('pickMirrorAppointment', () => {
  // Datas relativas a uma "agora" fixa, para o teste não depender do relógio.
  const NOW = new Date(2026, 7, 18, 14, 0, 0); // 18/08/2026 14:00
  const at = (day, hour = 10) => new Date(2026, 7, day, hour, 0, 0);
  const rec = (id, status, day, hour, extra = {}) =>
    ({ id, status, scheduledFor: at(day, hour), type: 'aula', ...extra });

  it('sem registro devolve null', () => {
    expect(pickMirrorAppointment([], NOW)).toBeNull();
    expect(pickMirrorAppointment(null, NOW)).toBeNull();
  });

  it('regra 1: entre os abertos futuros, pega o MAIS PRÓXIMO', () => {
    const out = pickMirrorAppointment([
      rec('longe', 'agendada', 25),
      rec('perto', 'agendada', 20),
      rec('medio', 'agendada', 22),
    ], NOW);
    expect(out.id).toBe('perto');
  });

  it('regra 1: compromisso de HOJE mais cedo ainda conta como futuro', () => {
    // 18/08 às 9h já passou no relógio, mas é hoje: continua sendo o
    // compromisso do dia e não pode cair na regra do atrasado.
    const out = pickMirrorAppointment([
      rec('hoje', 'agendada', 18, 9),
      rec('amanha', 'agendada', 19),
    ], NOW);
    expect(out.id).toBe('hoje');
  });

  it('regra 1 ganha da regra 2: futuro tem prioridade sobre atrasado', () => {
    const out = pickMirrorAppointment([
      rec('atrasado', 'agendada', 1),
      rec('futuro', 'agendada', 20),
    ], NOW);
    expect(out.id).toBe('futuro');
  });

  it('regra 2: só atrasados em aberto, pega o MAIS RECENTE', () => {
    const out = pickMirrorAppointment([
      rec('antigo', 'agendada', 1),
      rec('recente', 'agendada', 15),
    ], NOW);
    expect(out.id).toBe('recente');
  });

  it('regra 3: sem nada em aberto, pega o último resolvido', () => {
    const out = pickMirrorAppointment([
      rec('velho', 'attended', 1),
      rec('novo', 'no_show', 10),
    ], NOW);
    expect(out.id).toBe('novo');
  });

  it('regra 3: comparecimento PRESERVA o compromisso (regra do Johnny)', () => {
    const out = pickMirrorAppointment([rec('foi', 'attended', 10)], NOW);
    expect(out.id).toBe('foi');
  });

  it('regra 3: cancelado NUNCA entra no espelho', () => {
    expect(pickMirrorAppointment([rec('cancelou', 'cancelled', 10)], NOW)).toBeNull();
  });

  it('regra 3: cancelado não rouba a vez de um comparecimento anterior', () => {
    const out = pickMirrorAppointment([
      rec('foi', 'attended', 5),
      rec('cancelou', 'cancelled', 12),
    ], NOW);
    expect(out.id).toBe('foi');
  });

  it('aberto ganha de resolvido, mesmo que o resolvido seja mais recente', () => {
    const out = pickMirrorAppointment([
      rec('resolvido', 'attended', 17),
      rec('aberto', 'agendada', 2),
    ], NOW);
    expect(out.id).toBe('aberto');
  });

  it('visita e aula concorrem em pé de igualdade', () => {
    const out = pickMirrorAppointment([
      rec('aula', 'agendada', 22),
      rec('visita', 'agendada', 20, 10, { type: 'visita' }),
    ], NOW);
    expect(out.id).toBe('visita');
  });

  it('registro sem data é ignorado (não pode virar espelho nem quebrar)', () => {
    const out = pickMirrorAppointment([
      { id: 'sem_data', status: 'agendada', scheduledFor: null, type: 'aula' },
      rec('ok', 'agendada', 20),
    ], NOW);
    expect(out.id).toBe('ok');
    expect(pickMirrorAppointment([{ id: 'x', status: 'agendada', scheduledFor: null }], NOW)).toBeNull();
  });
});

// Remarcar da Meta Diária: o registro de stronix_aulas acompanha o agendamento
// do lead. Antes, a visita trocava de data só no lead, e o Dashboard CRM
// contava a visita na data velha e perdia o comparecimento.
describe('rescheduleRecordPlan', () => {
  it('visita remarcada como visita: nada fecha, e o registro aberto muda de data', () => {
    expect(rescheduleRecordPlan({ previousType: 'visita', finalType: 'visita', afterNoShow: false }))
      .toEqual({ close: null, upsertVisita: true });
  });

  it('visita depois do "Não veio": a visita que faltou fecha como falta, e a nova data abre outro registro', () => {
    expect(rescheduleRecordPlan({ previousType: 'visita', finalType: 'visita', afterNoShow: true }))
      .toEqual({ close: { type: 'visita', status: 'no_show' }, upsertVisita: true });
  });

  it('visita trocada por aula: a visita fecha como cancelada, e a aula fica com o upsert dela', () => {
    expect(rescheduleRecordPlan({ previousType: 'visita', finalType: 'aula_experimental', afterNoShow: false }))
      .toEqual({ close: { type: 'visita', status: 'cancelled' }, upsertVisita: false });
  });

  it('aula trocada por visita: a aula fecha como cancelada, e a visita abre', () => {
    expect(rescheduleRecordPlan({ previousType: 'aula_experimental', finalType: 'visita', afterNoShow: false }))
      .toEqual({ close: { type: 'aula', status: 'cancelled' }, upsertVisita: true });
  });

  it('aula remarcada como aula: nada fecha, porque o upsert da aula já move o registro', () => {
    expect(rescheduleRecordPlan({ previousType: 'aula_experimental', finalType: 'aula_experimental', afterNoShow: false }))
      .toEqual({ close: null, upsertVisita: false });
  });

  it('aula depois do "Não veio": fecha como falta, para o caso de o desfecho não ter chegado ao registro', () => {
    expect(rescheduleRecordPlan({ previousType: 'aula_experimental', finalType: 'aula_experimental', afterNoShow: true }))
      .toEqual({ close: { type: 'aula', status: 'no_show' }, upsertVisita: false });
  });

  it('sem agendamento anterior conhecido: não fecha nada e só abre o do tipo novo', () => {
    expect(rescheduleRecordPlan({ previousType: null, finalType: 'visita', afterNoShow: false }))
      .toEqual({ close: null, upsertVisita: true });
    expect(rescheduleRecordPlan({ previousType: undefined, finalType: 'aula_experimental', afterNoShow: true }))
      .toEqual({ close: null, upsertVisita: false });
  });
});
