import { describe, it, expect, vi, beforeEach } from 'vitest';
import { canAddSeat, getSeatUsage } from '../_plans.js';
import { hasModule, MODULES } from '../../src/lib/modules.js';

// Vagas do plano: só o consultor ocupa vaga de consultor, só o gestor ocupa
// vaga de gestor, e o professor não ocupa nenhuma nem entra no extra pago. É a
// mesma conta que o convite, o aceite, o cadastro, a troca de papel e a
// cobrança usam. O getSeatUsage já lê tenants/{id} para saber o plano, e
// devolve também os módulos da academia, para quem cria acesso de professor
// não ler o documento de novo.

const banco = vi.hoisted(() => ({ tenants: {}, usuarios: [], planos: [], leituras: [] }));

vi.mock('../_firebaseAdmin.js', () => {
  const ref = (caminho, filtro = null) => ({
    collection: (nome) => ref([...caminho, nome]),
    doc: (id) => ref([...caminho, id]),
    where: (campo, _op, valor) => ref(caminho, { campo, valor }),
    count: () => ({
      get: async () => ({
        data: () => ({ count: banco.usuarios.filter((u) => !filtro || u[filtro.campo] === filtro.valor).length }),
      }),
    }),
    get: async () => {
      banco.leituras.push(caminho.join('/'));
      if (caminho.join('/') === 'plans') {
        const docs = banco.planos.map((p) => ({ id: p.slug, data: () => p }));
        return { empty: docs.length === 0, size: docs.length, docs, forEach: (fn) => docs.forEach(fn) };
      }
      const dados = caminho[0] === 'tenants' ? banco.tenants[caminho[1]] : undefined;
      return { exists: dados != null, data: () => dados };
    },
  });
  return { adminDb: ref([]), admin: { firestore: { FieldValue: { serverTimestamp: () => 'agora' } } } };
});

const T = 'academia-teste';
const GESTOR = { role: 'admin' };
const CONSULTOR = { role: 'consultant' };
const PROFESSOR = { role: 'professor', professorId: 'prof-1' };
const LEGADO = {};

beforeEach(() => {
  banco.tenants = { [T]: { plan: 'starter', modules: ['faltosos'] } };
  banco.usuarios = [];
  banco.planos = [];
  banco.leituras = [];
});

describe('getSeatUsage: vagas por papel', () => {
  it('conta o professor à parte: nem consultor nem gestor', async () => {
    banco.usuarios = [GESTOR, CONSULTOR, CONSULTOR, PROFESSOR, PROFESSOR];
    expect(await getSeatUsage(T)).toMatchObject({
      managers: 1, consultants: 2, professors: 2, currentUsers: 5, maxManagers: 1, maxConsultants: 2,
    });
  });

  it('cadastro antigo sem papel continua contando como consultor', async () => {
    banco.usuarios = [GESTOR, LEGADO, PROFESSOR];
    expect(await getSeatUsage(T)).toMatchObject({ consultants: 1, professors: 1 });
  });

  it('o extra pago não conta professor', async () => {
    banco.planos = [{ slug: 'starter', maxManagers: 1, maxConsultants: 1, extraUserPrice: 30, maxExtraUsers: 5 }];
    banco.usuarios = [GESTOR, CONSULTOR, PROFESSOR, PROFESSOR];
    expect(await getSeatUsage(T)).toMatchObject({ consultants: 1, professors: 2, extraConsultants: 0 });
  });
});

describe('getSeatUsage: módulos da academia', () => {
  it('academia com o módulo ligado: a lista vem junto com as vagas', async () => {
    const seats = await getSeatUsage(T);
    expect(seats.modules).toEqual(['faltosos']);
    expect(hasModule(seats, MODULES.FALTOSOS)).toBe(true);
  });

  it('sem documento, sem o campo ou com lixo no campo: lista vazia', async () => {
    const casos = [undefined, { plan: 'starter' }, { modules: 'faltosos' }, { modules: ['catraca', 'Faltosos'] }];
    for (const dados of casos) {
      banco.tenants = dados ? { a: dados } : {};
      const seats = await getSeatUsage('a');
      expect(seats.modules, JSON.stringify(dados)).toEqual([]);
      expect(hasModule(seats, MODULES.FALTOSOS)).toBe(false);
    }
  });

  it('não lê o documento da academia uma segunda vez', async () => {
    await getSeatUsage(T);
    expect(banco.leituras.filter((l) => l.startsWith('tenants/'))).toEqual([`tenants/${T}`]);
  });
});

describe('canAddSeat', () => {
  const cheio = {
    plan: 'starter', managers: 1, maxManagers: 1, consultants: 2, maxConsultants: 2,
    extraUserPrice: null, maxExtraUsers: null,
  };

  it('professor sempre cabe, mesmo com as vagas de gestor e de consultor cheias', () => {
    expect(canAddSeat(cheio, 'professor')).toEqual({ ok: true });
  });

  it('gestor e consultor continuam barrados como antes', () => {
    expect(canAddSeat(cheio, 'admin')).toMatchObject({ ok: false, code: 'managers_limit' });
    expect(canAddSeat(cheio, 'consultant')).toMatchObject({ ok: false, code: 'consultants_limit' });
  });
});
