import { describe, it, expect } from 'vitest';
import { buildGoalHitDoc } from '../dailyGoalHistory.js';

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
