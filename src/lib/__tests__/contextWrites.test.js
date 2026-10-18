import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...partes) => ({ path: partes.slice(1).join('/') })),
  updateDoc: vi.fn(async () => {}),
  serverTimestamp: vi.fn(() => 'TS'),
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
    const [, , user, interacao, patch] = logInteraction.mock.calls[0];
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
});
