// As entradas "Respondeu, aguardando você" da Meta: nascem só da marca
// awaitingReplySince, seguem o dono do lead e somem depois de 72 horas.
import { describe, it, expect } from 'vitest';
import { awaitingEntriesOf, esperaSince, ESPERA_TETO_HORAS, ESPERA_URGENTE_MIN } from '../metaEspera.js';
import { FOCO_ESPERA, FOCO_ORDER } from '../metaFocoCodes.js';
import { taskKey } from '../metaFoco.js';
import { DG_CATEGORY_META } from '../dailyGoal.js';
import { DAILY_GOAL_CATEGORIES } from '../leads.js';

const NOW = new Date('2026-11-09T17:32:00.000Z');
const antes = (min) => new Date(NOW.getTime() - min * 60 * 1000);
const lead = (id, extra = {}) => ({ id, name: id, consultantId: 'eu', ...extra });

describe('awaitingEntriesOf', () => {
  it('sem marca, nenhuma entrada', () => {
    expect(awaitingEntriesOf([lead('a'), lead('b', { awaitingReplySince: null })], 'eu', NOW)).toEqual([]);
    expect(awaitingEntriesOf(undefined, 'eu', NOW)).toEqual([]);
  });

  it('o dono do lead recebe a entrada, com a chave de tarefa de sempre', () => {
    const l = lead('a', { awaitingReplySince: antes(42) });
    expect(awaitingEntriesOf([l], 'eu', NOW)).toEqual([{ key: taskKey(l, FOCO_ESPERA), slug: FOCO_ESPERA, lead: l }]);
  });

  it('a espera é do dono do lead: o contato delegado, o lead de outro e o sem dono ficam de fora', () => {
    const leads = [
      lead('delegado', { consultantId: 'outro', nextFollowUpOwnerId: 'eu', awaitingReplySince: antes(42) }),
      lead('outro', { consultantId: 'outro', awaitingReplySince: antes(42) }),
      lead('semdono', { consultantId: null, awaitingReplySince: antes(42) }),
    ];
    expect(awaitingEntriesOf(leads, 'eu', NOW)).toEqual([]);
  });

  it('sem usuário, nenhuma entrada', () => {
    expect(awaitingEntriesOf([lead('a', { awaitingReplySince: antes(5) })], null, NOW)).toEqual([]);
  });

  it('a mãe de dois menores: cada menor vira uma entrada na fila do dono dele', () => {
    const leads = [
      lead('pedro', { awaitingReplySince: antes(10) }),
      lead('ana', { awaitingReplySince: antes(10) }),
      lead('lia', { consultantId: 'outro', awaitingReplySince: antes(10) }),
    ];
    expect(awaitingEntriesOf(leads, 'eu', NOW).map((e) => e.lead.id)).toEqual(['pedro', 'ana']);
  });

  it(`a espera some depois de ${ESPERA_TETO_HORAS} horas`, () => {
    expect(ESPERA_TETO_HORAS).toBe(72);
    expect(awaitingEntriesOf([lead('a', { awaitingReplySince: antes(71 * 60) })], 'eu', NOW)).toHaveLength(1);
    expect(awaitingEntriesOf([lead('a', { awaitingReplySince: antes(73 * 60) })], 'eu', NOW)).toEqual([]);
  });

  it('a marca com hora adiantada continua valendo', () => {
    expect(awaitingEntriesOf([lead('a', { awaitingReplySince: new Date(NOW.getTime() + 60000) })], 'eu', NOW)).toHaveLength(1);
  });

  it('entende o Timestamp do Firestore', () => {
    const since = antes(42);
    const l = lead('a', { awaitingReplySince: { toDate: () => since } });
    expect(esperaSince(l)).toEqual(since);
    expect(awaitingEntriesOf([l], 'eu', NOW)).toHaveLength(1);
  });
});

describe('o slug da espera', () => {
  it('fica no Foco em entre os atrasados e as renovações, e não é categoria da meta', () => {
    expect(FOCO_ESPERA).toBe('aguardando_resposta');
    expect(FOCO_ORDER.indexOf(FOCO_ESPERA)).toBe(FOCO_ORDER.indexOf(DAILY_GOAL_CATEGORIES.ATRASADO) + 1);
    expect(Object.values(DAILY_GOAL_CATEGORIES)).not.toContain(FOCO_ESPERA);
  });

  it('tem ícone e rótulo para a fila e o Agora', () => {
    expect(DG_CATEGORY_META[FOCO_ESPERA]).toMatchObject({ label: 'Respondeu, aguardando você', short: 'Aguardando você' });
    expect(DG_CATEGORY_META[FOCO_ESPERA].Icon).toBeTruthy();
  });

  it('vira urgente com 30 minutos de expediente', () => {
    expect(ESPERA_URGENTE_MIN).toBe(30);
  });
});
