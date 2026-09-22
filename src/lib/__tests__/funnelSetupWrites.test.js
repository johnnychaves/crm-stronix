// A gravação da configuração de funis só cria: doc que já existe não é tocado.
// Sem Firebase de verdade: firebase/firestore e ../firebase.js são falsos.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ existing: new Set(), sets: [] }));

vi.mock('../firebase.js', () => ({
  db: {}, FUNNELS_PATH: 'stronix_funnels', STATUSES_PATH: 'stronix_statuses', SOURCES_PATH: 'stronix_sources',
}));
vi.mock('firebase/firestore', () => ({
  collection: (...p) => ({ path: p.slice(1).join('/') }),
  doc: (...p) => ({ path: p.slice(1).join('/') }),
  serverTimestamp: () => 'TS',
  runTransaction: async (_db, fn) => fn({
    get: async (ref) => ({ exists: () => m.existing.has(ref.path) }),
    set: (ref, data) => { m.sets.push({ path: ref.path, data }); },
  }),
}));

const { writeSetupWrites, writeSetupPlan } = await import('../funnelSetupWrites.js');

beforeEach(() => { m.existing.clear(); m.sets.length = 0; });

describe('writeSetupWrites', () => {
  it('cria o doc que não existe, no caminho da academia congelada', async () => {
    await writeSetupWrites('acad', [{ collection: 'funnels', id: 'funil-padrao', data: { name: 'Comercial' } }]);
    expect(m.sets).toEqual([{ path: 'artifacts/acad/public/data/stronix_funnels/funil-padrao', data: { name: 'Comercial' } }]);
  });

  it('não toca no doc que já existe (a outra aba ou o gestor já gravou)', async () => {
    m.existing.add('artifacts/acad/public/data/stronix_funnels/funil-padrao');
    await writeSetupWrites('acad', [{ collection: 'funnels', id: 'funil-padrao', data: { name: 'Outro' } }]);
    expect(m.sets).toEqual([]);
  });

  it('grava cada coleção no caminho certo, na ordem do plano', async () => {
    await writeSetupWrites('acad', [
      { collection: 'funnels', id: 'f', data: {} },
      { collection: 'statuses', id: 's', data: {} },
      { collection: 'sources', id: 'o', data: {} },
    ]);
    expect(m.sets.map((s) => s.path)).toEqual([
      'artifacts/acad/public/data/stronix_funnels/f',
      'artifacts/acad/public/data/stronix_statuses/s',
      'artifacts/acad/public/data/stronix_sources/o',
    ]);
  });
});

describe('writeSetupPlan', () => {
  it('grava o plano com id fixo e o carimbo de hora do servidor', async () => {
    await writeSetupPlan('acad', { createFunnel: { name: 'Upgrade', systemKind: 'upgrade', order: 97 }, createStages: [] });
    expect(m.sets).toEqual([{
      path: 'artifacts/acad/public/data/stronix_funnels/funil-sistema-upgrade',
      data: { name: 'Upgrade', systemKind: 'upgrade', order: 97, createdAt: 'TS', updatedAt: 'TS' },
    }]);
  });
});
