// O logInteractions grava várias interações do mesmo lead e o patch dele num
// batch só, e o logInteraction é ele com uma interação. No lote, o batchSeq
// guarda a ordem em que as interações foram passadas, porque todas saem com a
// mesma hora do servidor, e a linha do tempo da ficha desempata por ele. A
// interação sozinha não leva o campo, e o contador do lead soma o número de
// interações do batch (o professor, que só grava pelo logInteraction, soma 1).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sets = [];
let seq = 0;
vi.mock('firebase/firestore', () => ({
  writeBatch: () => ({ set: (ref, data, opts) => sets.push({ ref, data, opts }), commit: async () => {} }),
  // doc(colecao) cria o id da interação; doc(db, ...caminho) é o lead.
  doc: (...args) => (args.length === 1 ? { id: `i${++seq}` } : { id: args.at(-1) }),
  collection: () => ({}),
  serverTimestamp: () => 'HORA_DO_SERVIDOR',
  increment: (n) => ({ increment: n }),
}));
vi.mock('../firebase.js', () => ({ appId: 'acad', INTERACTIONS_PATH: 'inter', LEADS_PATH: 'leads' }));

const { logInteraction, logInteractions } = await import('../interactions.js');

const LEAD = { id: 'l1', name: 'Ana', consultantId: 'c1' };
const USER = { id: 'u1', authUid: 'a1', name: 'Bruno' };
const interacoes = () => sets.filter((s) => s.ref.id !== LEAD.id).map((s) => s.data);
const escritaDoLead = () => sets.find((s) => s.ref.id === LEAD.id);

beforeEach(() => { sets.length = 0; seq = 0; });

describe('logInteractions', () => {
  it('o lote leva o batchSeq na ordem passada e soma o número de interações', async () => {
    const ids = await logInteractions({}, LEAD, USER, [{ type: 'note', text: 'Motivo' }, { type: 'daily_goal_done' }], { nextFollowUp: null });
    expect(ids).toEqual(['i1', 'i2']);
    expect(interacoes().map((i) => [i.type, i.batchSeq])).toEqual([['note', 0], ['daily_goal_done', 1]]);
    expect(interacoes().every((i) => i.createdAt === 'HORA_DO_SERVIDOR' && i.leadId === 'l1')).toBe(true);
    const lead = escritaDoLead();
    expect(lead.data).toEqual({ lastInteractionAt: 'HORA_DO_SERVIDOR', interactionsCount: { increment: 2 }, nextFollowUp: null });
    expect(lead.opts).toEqual({ merge: true });
  });

  it('o logInteraction grava uma interação sem batchSeq e soma 1', async () => {
    const id = await logInteraction({}, LEAD, USER, { type: 'note', text: 'Ligou' });
    expect(id).toBe('i1');
    expect(interacoes()).toHaveLength(1);
    expect(interacoes()[0]).not.toHaveProperty('batchSeq');
    expect(escritaDoLead().data.interactionsCount).toEqual({ increment: 1 });
  });
});
