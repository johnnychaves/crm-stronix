import { beforeEach, describe, expect, it, vi } from 'vitest';

const s = vi.hoisted(() => ({ docs: new Map(), ops: [], seq: 0 }));

vi.mock('../firebase.js', () => ({
  appId: 'acad',
  ROUTINE_MODELS_PATH: 'stronix_rotina_modelos',
  ROUTINE_VERSIONS_PATH: 'stronix_rotina_versoes',
  ROUTINE_MARKS_PATH: 'stronix_rotina_marcas',
  USERS_PATH: 'stronix_users',
}));

vi.mock('firebase/firestore', () => {
  const path = (...p) => p.join('/');
  return {
    collection: (_db, ...p) => ({ kind: 'col', path: path(...p) }),
    doc: (a, ...p) => {
      if (a?.kind === 'col' && p.length === 0) { s.seq += 1; return { path: `${a.path}/novo-${s.seq}`, id: `novo-${s.seq}` }; }
      return { path: path(...p), id: p[p.length - 1] };
    },
    serverTimestamp: () => 'agora',
    setDoc: vi.fn(async (ref, data, opts) => { s.ops.push({ op: 'set', path: ref.path, data, ...(opts ? { opts } : {}) }); }),
    updateDoc: vi.fn(async (ref, data) => { s.ops.push({ op: 'update', path: ref.path, data }); }),
    deleteDoc: vi.fn(async (ref) => { s.ops.push({ op: 'delete', path: ref.path }); }),
    // Como o SDK: depois da primeira gravação, ler na mesma transação é erro.
    runTransaction: vi.fn(async (_db, fn) => {
      let wrote = false;
      return fn({
        get: async (ref) => {
          if (wrote) throw new Error('reads before writes');
          const d = s.docs.get(ref.path);
          return { id: ref.id, exists: () => d !== undefined, data: () => ({ ...d }) };
        },
        set: (ref, data, opts) => { wrote = true; s.ops.push({ op: 'set', path: ref.path, data, opts }); },
        delete: (ref) => { wrote = true; s.ops.push({ op: 'delete', path: ref.path }); },
      });
    }),
  };
});

const { createModel, deleteModel, dismissRotinasIntro, duplicateModel, markDone, saveMarkNote, setPersonModel, undoMark, updateModel } = await import('../rotinasWrites.js');

const M = 'artifacts/acad/public/data/stronix_rotina_modelos';
const V = 'artifacts/acad/public/data/stronix_rotina_versoes';
const K = 'artifacts/acad/public/data/stronix_rotina_marcas';
const NOW = new Date(2026, 9, 6, 11, 5);
const gestor = { id: 'g1', authUid: 'g1' };
const carla = { id: 'carla', authUid: 'uid-carla' };
const TASK = { id: 't1', title: 'Conferir a agenda', how: '', days: 'all', time: '08:00', active: true };
const op = (kind, p) => s.ops.find((o) => o.op === kind && o.path === p);

beforeEach(() => {
  s.docs.clear(); s.ops.length = 0; s.seq = 0;
  s.docs.set(`${M}/m1`, { name: 'Manhã', tasks: [TASK], followerIds: ['carla', 'diego'] });
  s.docs.set(`${M}/m2`, { name: 'Tarde', tasks: [], followerIds: ['ana'] });
});
const models = () => [...s.docs.entries()].map(([k, d]) => ({ id: k.split('/').pop(), ...d }));

describe('modelos', () => {
  it('criar grava o modelo e a versão do dia, e tira quem segue do modelo anterior', async () => {
    const id = await createModel({ db: {}, appUser: gestor, models: models(), name: ' Noite ', followerIds: ['ana'], now: NOW });
    expect(id).toBe('novo-1');
    expect(op('set', `${M}/novo-1`).data).toMatchObject({ name: 'Noite', tasks: [], followerIds: ['ana'], createdAt: 'agora', createdBy: 'g1', updatedBy: 'g1' });
    expect(op('set', `${V}/novo-1_2026-10-06`).data).toMatchObject({ modelId: 'novo-1', date: '2026-10-06', followerIds: ['ana'], deleted: false, savedBy: 'g1', savedAt: 'agora' });
    expect(op('set', `${M}/m2`).data).toMatchObject({ followerIds: [] });
    expect(op('set', `${M}/m2`).data.createdAt).toBeUndefined();
    expect(op('set', `${V}/m2_2026-10-06`).data).toMatchObject({ followerIds: [] });
    expect(op('set', `${M}/m1`)).toBeUndefined();
  });

  it('criar a partir de uma cópia copia as tarefas com ids novos', async () => {
    await createModel({ db: {}, appUser: gestor, models: models(), name: 'Manhã 2', copyFrom: 'm1', now: NOW });
    const tasks = op('set', `${M}/novo-1`).data.tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ title: 'Conferir a agenda', time: '08:00' });
    expect(tasks[0].id).not.toBe('t1');
  });

  it('copiar de um modelo que sumiu falha com o código e não grava nada', async () => {
    await expect(createModel({ db: {}, appUser: gestor, models: models(), name: 'Cópia', copyFrom: 'mx', now: NOW })).rejects.toMatchObject({ message: 'modelo-sumiu', code: 'modelo-sumiu' });
    expect(s.ops).toEqual([]);
  });

  it('copiar de um modelo que a tela não tinha na lista lê o modelo e copia as tarefas', async () => {
    const semM1 = models().filter((m) => m.id !== 'm1');
    await createModel({ db: {}, appUser: gestor, models: semM1, name: 'Manhã 2', copyFrom: 'm1', now: NOW });
    const tasks = op('set', `${M}/novo-1`).data.tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ title: 'Conferir a agenda' });
    expect(tasks[0].id).not.toBe('t1');
    expect(op('set', `${M}/m1`)).toBeUndefined();
  });

  it('duplicar dá o nome "Cópia de" e ninguém segue', async () => {
    const id = await duplicateModel({ db: {}, appUser: gestor, models: models(), source: { id: 'm1', name: 'Manhã' }, now: NOW });
    expect(op('set', `${M}/${id}`).data).toMatchObject({ name: 'Cópia de Manhã', followerIds: [] });
  });

  it('editar grava o modelo e a versão do dia com o que a função devolve', async () => {
    await updateModel({ db: {}, appUser: gestor, modelId: 'm1', edit: (m) => ({ name: `${m.name} cedo` }), now: NOW });
    expect(op('set', `${M}/m1`).data).toMatchObject({ name: 'Manhã cedo', tasks: [TASK], followerIds: ['carla', 'diego'], updatedBy: 'g1' });
    expect(op('set', `${M}/m1`).data.createdAt).toBeUndefined();
    expect(op('set', `${M}/m1`).opts).toEqual({ merge: true });
    expect(op('set', `${V}/m1_2026-10-06`).data).toMatchObject({ name: 'Manhã cedo', followerIds: ['carla', 'diego'] });
    expect(op('set', `${V}/m1_2026-10-06`).opts).toBeUndefined();
  });

  it('editar só aceita nome e tarefas: quem segue e a exclusão não passam pelo edit', async () => {
    await updateModel({ db: {}, appUser: gestor, modelId: 'm1', edit: () => ({ followerIds: [], deleted: true }), now: NOW });
    expect(op('delete', `${M}/m1`)).toBeUndefined();
    expect(op('set', `${M}/m1`).data).toMatchObject({ name: 'Manhã', tasks: [TASK], followerIds: ['carla', 'diego'] });
    expect(op('set', `${V}/m1_2026-10-06`).data).toMatchObject({ deleted: false, followerIds: ['carla', 'diego'] });
  });

  it('editar um modelo que sumiu falha com o código', async () => {
    await expect(updateModel({ db: {}, appUser: gestor, modelId: 'mx', edit: () => ({}), now: NOW })).rejects.toMatchObject({ message: 'modelo-sumiu', code: 'modelo-sumiu' });
    expect(s.ops).toEqual([]);
  });

  it('pôr a pessoa num modelo tira ela do outro; "sem modelo" só tira', async () => {
    await setPersonModel({ db: {}, appUser: gestor, models: models(), userId: 'ana', modelId: 'm1', now: NOW });
    expect(op('set', `${M}/m1`).data.followerIds).toEqual(['carla', 'diego', 'ana']);
    expect(op('set', `${M}/m2`).data.followerIds).toEqual([]);
    s.ops.length = 0;
    await setPersonModel({ db: {}, appUser: gestor, models: models(), userId: 'carla', modelId: null, now: NOW });
    expect(op('set', `${M}/m1`).data.followerIds).toEqual(['diego']);
    expect(op('set', `${V}/m1_2026-10-06`).data.followerIds).toEqual(['diego']);
    expect(op('set', `${M}/m2`)).toBeUndefined();
  });

  it('"sem modelo" tira a pessoa de todo modelo que a tem', async () => {
    s.docs.set(`${M}/m2`, { name: 'Tarde', tasks: [], followerIds: ['ana', 'carla'] });
    await setPersonModel({ db: {}, appUser: gestor, models: models(), userId: 'carla', modelId: null, now: NOW });
    expect(op('set', `${M}/m1`).data.followerIds).toEqual(['diego']);
    expect(op('set', `${M}/m2`).data.followerIds).toEqual(['ana']);
    expect(op('set', `${V}/m1_2026-10-06`).data.followerIds).toEqual(['diego']);
    expect(op('set', `${V}/m2_2026-10-06`).data.followerIds).toEqual(['ana']);
  });

  it('pôr a pessoa num modelo que sumiu falha com o código e não grava nada', async () => {
    await expect(setPersonModel({ db: {}, appUser: gestor, models: [...models(), { id: 'mx' }], userId: 'ana', modelId: 'mx', now: NOW })).rejects.toMatchObject({ message: 'modelo-sumiu', code: 'modelo-sumiu' });
    expect(s.ops).toEqual([]);
  });

  it('excluir apaga o modelo e grava a versão excluída, sem ninguém', async () => {
    await deleteModel({ db: {}, appUser: gestor, modelId: 'm1', now: NOW });
    expect(op('delete', `${M}/m1`)).toBeDefined();
    expect(op('set', `${V}/m1_2026-10-06`).data).toMatchObject({ deleted: true, followerIds: [], name: 'Manhã' });
  });
});

describe('check', () => {
  it('marcar grava o check no id fixo, com a hora do servidor e a observação vazia', async () => {
    const id = await markDone({ db: {}, appUser: carla, model: { id: 'm1' }, task: TASK, now: NOW });
    expect(id).toBe('carla_2026-10-06_t1');
    expect(op('set', `${K}/carla_2026-10-06_t1`).data).toEqual({
      consultantId: 'carla', consultantAuthUid: 'uid-carla', date: '2026-10-06', modelId: 'm1',
      taskId: 't1', taskTitle: 'Conferir a agenda', taskTime: '08:00', doneAt: 'agora', note: '',
    });
  });

  it('a observação grava só o note, aparada e no limite', async () => {
    await saveMarkNote({ db: {}, markId: 'carla_2026-10-06_t1', note: `  ${'x'.repeat(150)}  ` });
    expect(op('update', `${K}/carla_2026-10-06_t1`).data).toEqual({ note: 'x'.repeat(140) });
  });

  it('a observação cortada no limite não termina em espaço', async () => {
    await saveMarkNote({ db: {}, markId: 'carla_2026-10-06_t1', note: `${'x'.repeat(139)} resto` });
    expect(op('update', `${K}/carla_2026-10-06_t1`).data).toEqual({ note: 'x'.repeat(139) });
  });

  it('desfazer apaga o check', async () => {
    await undoMark({ db: {}, markId: 'carla_2026-10-06_t1' });
    expect(op('delete', `${K}/carla_2026-10-06_t1`)).toBeDefined();
  });
});

// O "Não mostrar novamente" da apresentação das Rotinas grava no cadastro da
// própria pessoa, com merge, como o "já li" do sino (useNotificationsSeen): o
// mapa introsDismissed junta as apresentações dispensadas sem apagar as outras,
// e nada mais do cadastro muda (papel, academia e chave ficam como estão, que é
// o que as regras de stronix_users conferem).
describe('apresentação das Rotinas', () => {
  it('"Não mostrar novamente" grava introsDismissed.rotinas no próprio cadastro, com merge', async () => {
    await dismissRotinasIntro({ db: {}, userId: 'g1' });
    expect(s.ops).toEqual([{
      op: 'set',
      path: 'artifacts/acad/public/data/stronix_users/g1',
      data: { introsDismissed: { rotinas: true } },
      opts: { merge: true },
    }]);
  });

  it('sem o id do cadastro, recusa sem gravar', async () => {
    await expect(dismissRotinasIntro({ db: {}, userId: '' })).rejects.toThrow();
    await expect(dismissRotinasIntro({ db: {} })).rejects.toThrow();
    expect(s.ops).toEqual([]);
  });
});
