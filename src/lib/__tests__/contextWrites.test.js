import { describe, it, expect, vi, beforeEach } from 'vitest';

const batch = { update: vi.fn(), commit: vi.fn(async () => {}) };
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...partes) => ({ path: partes.slice(1).join('/') })),
  updateDoc: vi.fn(async () => {}),
  serverTimestamp: vi.fn(() => 'TS'),
  writeBatch: vi.fn(() => batch),
  arrayUnion: vi.fn((...v) => ({ union: v })),
  arrayRemove: vi.fn((...v) => ({ remove: v })),
}));
vi.mock('../firebase.js', () => ({ appId: 'acad', LEADS_PATH: 'leads' }));
vi.mock('../interactions.js', () => ({ logInteraction: vi.fn(async () => {}) }));

const { updateDoc } = await import('firebase/firestore');
const { logInteraction } = await import('../interactions.js');
const { saveContextField } = await import('../contextWrites.js');

const appUser = { id: 'u9', name: 'Carla Gestora', authUid: 'auth-9' };
const usersList = [
  { id: 'u1', name: 'Ana Souza', authUid: 'auth-1' },
  { id: 'u2', name: 'Bruno Lima', authUid: 'auth-2' },
];
const lead = { id: 'l1', name: 'Rafael', consultantId: 'u1', consultantName: 'Ana Souza' };
const base = { db: {}, lead, appUser, usersList, professores: [] };

beforeEach(() => vi.clearAllMocks());

describe('saveContextField', () => {
  it('campo comum grava só o campo, direto no lead', async () => {
    const r = await saveContextField({ ...base, field: 'dor', value: 'Emagrecimento' });
    expect(r).toEqual({ ok: true, change: null });
    expect(updateDoc).toHaveBeenCalledTimes(1);
    expect(updateDoc.mock.calls[0][0].path).toBe('artifacts/acad/public/data/leads/l1');
    expect(updateDoc.mock.calls[0][1]).toEqual({ dor: 'Emagrecimento' });
    expect(logInteraction).not.toHaveBeenCalled();
  });

  it('trocar o consultor deixa nota na linha do tempo e o carimbo do sino, no mesmo batch', async () => {
    const r = await saveContextField({ ...base, field: 'consultantId', value: 'u2' });
    expect(r.ok).toBe(true);
    expect(r.change).toMatchObject({ fromName: 'Ana Souza', toName: 'Bruno Lima' });
    expect(updateDoc).not.toHaveBeenCalled();
    expect(logInteraction).toHaveBeenCalledTimes(1);
    const [, leadArg, user, interacao, patch] = logInteraction.mock.calls[0];
    // A interação grava o dono do lead do dia do fato (o de antes da troca),
    // e não o novo: o logInteraction lê o dono do lead que recebe.
    expect(leadArg).toBe(lead);
    expect(user).toBe(appUser);
    expect(interacao).toEqual({ text: 'Responsável alterado de [Ana Souza] para [Bruno Lima].', type: 'status_change' });
    expect(patch).toEqual({
      consultantId: 'u2', consultantName: 'Bruno Lima', consultantAuthUid: 'auth-2',
      consultantChangedAt: 'TS', consultantChangedByName: 'Carla Gestora', consultantChangedByAuthUid: 'auth-9',
    });
  });

  it('escolher o consultor que já é o responsável não grava nada', async () => {
    const r = await saveContextField({ ...base, field: 'consultantId', value: 'u1' });
    expect(r).toEqual({ ok: true, change: null });
    expect(updateDoc).not.toHaveBeenCalled();
    expect(logInteraction).not.toHaveBeenCalled();
  });

  it('campo ou consultor inválido devolve ok falso e não grava', async () => {
    expect(await saveContextField({ ...base, field: 'cpf', value: '1' })).toEqual({ ok: false, change: null });
    expect(await saveContextField({ ...base, field: 'consultantId', value: 'zzz' })).toEqual({ ok: false, change: null });
    expect(updateDoc).not.toHaveBeenCalled();
    expect(logInteraction).not.toHaveBeenCalled();
  });

  it('deixa o erro do Firestore subir para quem chama mostrar o aviso', async () => {
    updateDoc.mockRejectedValueOnce(new Error('permission-denied'));
    await expect(saveContextField({ ...base, field: 'observation', value: 'x' })).rejects.toThrow('permission-denied');
  });

  it('etiquetas com o valor da abertura gravam só a diferença, sem apagar o que outra aba pôs', async () => {
    const r = await saveContextField({ ...base, field: 'tags', value: ['b', 'c'], from: ['a', 'b'] });
    expect(r).toEqual({ ok: true, change: null });
    expect(updateDoc).not.toHaveBeenCalled();
    expect(batch.update.mock.calls.map(([ref, p]) => [ref.path, p])).toEqual([
      ['artifacts/acad/public/data/leads/l1', { tags: { remove: ['a'] } }],
      ['artifacts/acad/public/data/leads/l1', { tags: { union: ['c'] } }],
    ]);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('etiquetas iguais às da abertura não gravam nada', async () => {
    expect(await saveContextField({ ...base, field: 'tags', value: ['a'], from: ['a'] })).toEqual({ ok: true, change: null });
    expect(batch.commit).not.toHaveBeenCalled();
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('só acrescentar etiqueta manda uma gravação só', async () => {
    await saveContextField({ ...base, field: 'tags', value: ['a', 'vip'], from: ['a'] });
    expect(batch.update.mock.calls.map(([, p]) => p)).toEqual([{ tags: { union: ['vip'] } }]);
  });
});
