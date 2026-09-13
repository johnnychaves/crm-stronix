import { describe, it, expect } from 'vitest';
import { buildGoalHitDoc, goalHitKeyToRecord } from '../dailyGoalHistory.js';

describe('buildGoalHitDoc', () => {
  const user = { id: 'ana', authUid: 'u-ana', name: 'Ana Ribeiro' };

  it('id determinístico por pessoa e dia', () => {
    expect(buildGoalHitDoc(user, '2026-09-11')).toEqual({
      id: 'ana_2026-09-11',
      data: { consultantId: 'ana', consultantAuthUid: 'u-ana', consultantName: 'Ana Ribeiro', date: '2026-09-11' }
    });
  });

  it('volume só quando há alvo', () => {
    expect(buildGoalHitDoc(user, '2026-09-11', { volumeCount: 12, volumeTarget: 10 }).data)
      .toMatchObject({ volumeCount: 12, volumeTarget: 10 });
    expect(buildGoalHitDoc(user, '2026-09-11', { volumeCount: 3, volumeTarget: 0 }).data.volumeCount).toBeUndefined();
  });
});

describe('goalHitKeyToRecord', () => {
  const base = { userId: 'ana', dayKey: '2026-09-11', ready: true, total: 5, pending: 0, recordedKey: null };

  it('sem base carregada (loadingData, renewalLoading, contactTodayLoading ou listeners desligados): null', () => {
    // As 4 origens de "não pronto" viram um único `ready: false` — combinar
    // os gates é responsabilidade de quem chama (App.jsx), não desta função.
    expect(goalHitKeyToRecord({ ...base, ready: false })).toBeNull();
  });

  it('total 0: null', () => {
    expect(goalHitKeyToRecord({ ...base, total: 0 })).toBeNull();
  });

  it('pendência maior que 0: null', () => {
    expect(goalHitKeyToRecord({ ...base, pending: 1 })).toBeNull();
  });

  it('dia já gravado (recordedKey igual à chave): null', () => {
    expect(goalHitKeyToRecord({ ...base, recordedKey: 'ana_2026-09-11' })).toBeNull();
  });

  it('nos demais casos, devolve a chave', () => {
    expect(goalHitKeyToRecord(base)).toBe('ana_2026-09-11');
  });
});
