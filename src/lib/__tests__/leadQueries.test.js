import { describe, it, expect } from 'vitest';
import indexesConfig from '../../../firestore.indexes.json';
import {
  LIFECYCLE_BUCKETS,
  clientsQuerySpec,
  clientsAllQuerySpec,
  allLeadsQuerySpec,
  lostByFunnelQuerySpec,
  bucketByFunnelQuerySpec,
  bucketByFunnelCountSpec,
  appointmentsInWindowQuerySpec,
  renewalClientsQuerySpec,
  consultantLeadsQuerySpec,
} from '../leadQueries.js';

// Uma spec é "coberta" por um índice de stronix_leads quando as igualdades são
// um PREFIXO do índice (todas ASCENDING, mesmo conjunto) e — havendo orderBy —
// o campo seguinte do índice casa campo+direção. Mesma regra que o Firestore usa
// para escolher índice; é o que evita o erro "query requires an index" em prod.
function indexCovers(index, spec) {
  // Igualdades formam o prefixo; um range (>=,<,>,<=) tem que ser no MESMO campo
  // do orderBy (regra do Firestore: range e orderBy no mesmo campo, logo após as
  // igualdades). Assim a spec de janela (appointmentType== + appointmentScheduledFor
  // range/orderBy) casa com um índice [tipo, campoDeData].
  const eq = spec.wheres.filter((w) => w.op === '==').map((w) => w.field);
  const ranges = spec.wheres.filter((w) => w.op !== '==');
  if (ranges.length && (!spec.orderBy || ranges.some((w) => w.field !== spec.orderBy.field))) return false;
  const n = eq.length;
  if (index.fields.length < n) return false;
  const prefix = index.fields.slice(0, n);
  if (!prefix.every((f) => f.order === 'ASCENDING')) return false;
  const prefixSet = new Set(prefix.map((f) => f.fieldPath));
  if (prefixSet.size !== n || !eq.every((f) => prefixSet.has(f))) return false;
  if (!spec.orderBy) return true; // count: só o prefixo de igualdades basta
  const ob = index.fields[n];
  if (!ob) return false;
  const wantOrder = spec.orderBy.dir === 'desc' ? 'DESCENDING' : 'ASCENDING';
  return ob.fieldPath === spec.orderBy.field && ob.order === wantOrder;
}
const coveredByLeadsIndex = (spec) =>
  indexesConfig.indexes.some((idx) => idx.collectionGroup === 'stronix_leads' && indexCovers(idx, spec));

describe('leadQueries — specs puras dos consumidores da PR E', () => {
  it('clientsQuerySpec: clientes por convertedAt desc', () => {
    expect(clientsQuerySpec(50)).toEqual({
      wheres: [{ field: 'lifecycleBucket', op: '==', value: 'cliente' }],
      orderBy: { field: 'convertedAt', dir: 'desc' },
      limit: 50,
    });
  });

  it('clientsAllQuerySpec: TODOS os clientes, só a igualdade (sem orderBy/limit — Opção A do E1b)', () => {
    // orderBy no servidor excluiria clientes 'Venda' legados sem o campo
    // ordenado (Firestore filtra por existência) — por isso a spec não ordena.
    expect(clientsAllQuerySpec()).toEqual({
      wheres: [{ field: 'lifecycleBucket', op: '==', value: 'cliente' }],
    });
    expect(clientsAllQuerySpec().orderBy).toBeUndefined();
    expect(clientsAllQuerySpec().limit).toBeUndefined();
  });

  it('allLeadsQuerySpec: TODOS os leads, sem where/orderBy/limit (G1a — todos os buckets)', () => {
    // Sem where (a tela mostra todos os status, inclui Venda/Perda) e sem
    // orderBy (derrubaria legados sem o campo) — filtra/ordena/pagina client-side.
    expect(allLeadsQuerySpec()).toEqual({ wheres: [] });
    expect(allLeadsQuerySpec().orderBy).toBeUndefined();
    expect(allLeadsQuerySpec().limit).toBeUndefined();
  });

  it('lostByFunnelQuerySpec: perdas do funil por lostAt desc', () => {
    expect(lostByFunnelQuerySpec('f1', 50)).toEqual({
      wheres: [
        { field: 'lifecycleBucket', op: '==', value: 'perda' },
        { field: 'funnelId', op: '==', value: 'f1' },
      ],
      orderBy: { field: 'lostAt', dir: 'desc' },
      limit: 50,
    });
  });

  it('bucketByFunnelQuerySpec: paginação por createdAt desc', () => {
    const spec = bucketByFunnelQuerySpec(LIFECYCLE_BUCKETS.CLIENTE, 'f2', 25);
    expect(spec.wheres).toEqual([
      { field: 'lifecycleBucket', op: '==', value: 'cliente' },
      { field: 'funnelId', op: '==', value: 'f2' },
    ]);
    expect(spec.orderBy).toEqual({ field: 'createdAt', dir: 'desc' });
    expect(spec.limit).toBe(25);
  });

  it('appointmentsInWindowQuerySpec: tipo + janela [ini,fim) em appointmentScheduledFor, orderBy asc (E2b)', () => {
    const ini = new Date(2026, 6, 14).getTime();
    const fim = new Date(2026, 6, 17).getTime();
    expect(appointmentsInWindowQuerySpec('visita', ini, fim)).toEqual({
      wheres: [
        { field: 'appointmentType', op: '==', value: 'visita' },
        { field: 'appointmentScheduledFor', op: '>=', value: new Date(ini) },
        { field: 'appointmentScheduledFor', op: '<', value: new Date(fim) },
      ],
      orderBy: { field: 'appointmentScheduledFor', dir: 'asc' },
    });
  });

  it('appointmentsInWindowQuerySpec: sem limit por default (carrega a janela toda); com pageSize, limita', () => {
    const ini = new Date(2026, 6, 14).getTime();
    const fim = new Date(2026, 6, 17).getTime();
    expect(appointmentsInWindowQuerySpec('aula_experimental', ini, fim).limit).toBeUndefined();
    expect(appointmentsInWindowQuerySpec('aula_experimental', ini, fim, 30).limit).toBe(30);
  });

  it('renewalClientsQuerySpec: clientes com vencimento na janela [ini,fim), orderBy asc (E2c)', () => {
    const ini = new Date(2026, 6, 14).getTime();
    const fim = new Date(2026, 7, 14).getTime();
    expect(renewalClientsQuerySpec(ini, fim)).toEqual({
      wheres: [
        { field: 'lifecycleBucket', op: '==', value: 'cliente' },
        { field: 'currentContractEndsAt', op: '>=', value: new Date(ini) },
        { field: 'currentContractEndsAt', op: '<', value: new Date(fim) },
      ],
      orderBy: { field: 'currentContractEndsAt', dir: 'asc' },
    });
  });

  it('consultantLeadsQuerySpec: só a igualdade em consultantId, sem orderBy/limit (E2a)', () => {
    // Sem orderBy de propósito (as métricas usam createdAt/convertedAt/appt com
    // fallback; orderBy num deles derrubaria legados sem o campo).
    expect(consultantLeadsQuerySpec('u1')).toEqual({
      wheres: [{ field: 'consultantId', op: '==', value: 'u1' }],
    });
    expect(consultantLeadsQuerySpec('u1').orderBy).toBeUndefined();
    expect(consultantLeadsQuerySpec('u1').limit).toBeUndefined();
  });

  it('usa LIST_PAGE_SIZE (30) como default de paginação', () => {
    expect(clientsQuerySpec().limit).toBe(30);
    expect(lostByFunnelQuerySpec('f1').limit).toBe(30);
  });
});

describe('leadQueries — toda spec é coberta por um índice de firestore.indexes.json', () => {
  it('clientsQuerySpec ↔ índice #3', () => {
    expect(coveredByLeadsIndex(clientsQuerySpec())).toBe(true);
  });
  it('clientsAllQuerySpec (só igualdade, sem orderBy) é runnable — prefixo do #3 cobre', () => {
    // Uma igualdade num só campo roda com o índice automático do Firestore; o
    // prefixo do #3 também cobre. Ou seja: sem "requires an index" em prod.
    expect(coveredByLeadsIndex(clientsAllQuerySpec())).toBe(true);
  });
  it('allLeadsQuerySpec (sem constraint) é sempre runnable — não exige índice', () => {
    // Coleção inteira sem where/orderBy roda sempre; o helper trata wheres:[] como
    // prefixo vazio (casa qualquer índice), refletindo que nenhum índice é exigido.
    expect(coveredByLeadsIndex(allLeadsQuerySpec())).toBe(true);
  });
  it('lostByFunnelQuerySpec ↔ índice #1', () => {
    expect(coveredByLeadsIndex(lostByFunnelQuerySpec('f1'))).toBe(true);
  });
  it('bucketByFunnelQuerySpec ↔ índice #2', () => {
    expect(coveredByLeadsIndex(bucketByFunnelQuerySpec(LIFECYCLE_BUCKETS.PERDA, 'f1'))).toBe(true);
    expect(coveredByLeadsIndex(bucketByFunnelQuerySpec(LIFECYCLE_BUCKETS.CLIENTE, 'f1'))).toBe(true);
  });
  it('bucketByFunnelCountSpec (só igualdades) usa o prefixo dos índices #1/#2', () => {
    expect(coveredByLeadsIndex(bucketByFunnelCountSpec(LIFECYCLE_BUCKETS.PERDA, 'f1'))).toBe(true);
  });
  it('appointmentsInWindowQuerySpec ↔ índice #5 (tipo + range/orderBy na data)', () => {
    const ini = new Date(2026, 6, 14).getTime();
    const fim = new Date(2026, 6, 17).getTime();
    expect(coveredByLeadsIndex(appointmentsInWindowQuerySpec('visita', ini, fim))).toBe(true);
    expect(coveredByLeadsIndex(appointmentsInWindowQuerySpec('aula_experimental', ini, fim))).toBe(true);
  });
  it('renewalClientsQuerySpec ↔ índice #4 (bucket + range/orderBy no vencimento)', () => {
    const ini = new Date(2026, 6, 14).getTime();
    const fim = new Date(2026, 7, 14).getTime();
    expect(coveredByLeadsIndex(renewalClientsQuerySpec(ini, fim))).toBe(true);
  });

  it('guarda-de-sanidade: uma spec com orderBy sem índice NÃO é coberta', () => {
    const semIndice = {
      wheres: [{ field: 'lifecycleBucket', op: '==', value: 'ativo' }],
      orderBy: { field: 'satisfactionAt', dir: 'desc' },
      limit: 50,
    };
    expect(coveredByLeadsIndex(semIndice)).toBe(false);
  });
});
