import { describe, it, expect } from 'vitest';
import indexesConfig from '../../../firestore.indexes.json';
import { LIFECYCLE_BUCKETS, clientsQuerySpec, clientsAllQuerySpec, allLeadsQuerySpec, lostByFunnelQuerySpec, bucketByFunnelQuerySpec, bucketByFunnelCountSpec, appointmentsInWindowQuerySpec, renewalClientsQuerySpec, consultantLeadsQuerySpec, adminDashboardWindowSpecs, ADMIN_DASHBOARD_WINDOW_FIELDS, wonInMonthQuerySpec, renewalWindowMs, clientsWithContactTodayQuerySpec, expiredClientsQuerySpec, renewalColumnQuerySpec } from '../leadQueries.js';

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

  it('adminDashboardWindowSpecs: 4 janelas de campo único [>=start,<=end] orderBy asc (G1c)', () => {
    const start = new Date(2026, 5, 1).getTime();
    const end = new Date(2026, 6, 31, 23, 59, 59, 999).getTime();
    const specs = adminDashboardWindowSpecs(start, end);
    // ordem/campos fixos (createdAt, convertedAt, appointmentScheduledFor, lostAt)
    expect(ADMIN_DASHBOARD_WINDOW_FIELDS).toEqual([
      'createdAt', 'convertedAt', 'appointmentScheduledFor', 'lostAt',
    ]);
    expect(specs).toHaveLength(4);
    expect(specs.map((s) => s.orderBy.field)).toEqual(ADMIN_DASHBOARD_WINDOW_FIELDS);
    specs.forEach((s) => {
      const field = s.orderBy.field;
      expect(s.wheres).toEqual([
        { field, op: '>=', value: new Date(start) },
        { field, op: '<=', value: new Date(end) },
      ]);
      expect(s.orderBy.dir).toBe('asc');
      // range/orderBy no MESMO campo, SEM igualdade → índice de campo único
      // AUTOMÁTICO do Firestore, sem índice composto (não passa por indexCovers).
      expect(s.wheres.every((w) => w.op !== '==')).toBe(true);
    });
  });

  it('usa LIST_PAGE_SIZE (30) como default de paginação', () => {
    expect(clientsQuerySpec().limit).toBe(30);
    expect(lostByFunnelQuerySpec('f1').limit).toBe(30);
  });
});

describe('wonInMonthQuerySpec — coluna Venda do Kanban (mês corrente)', () => {
  const JUL = new Date(2026, 6, 1).getTime();       // 01/07/2026 00:00 local
  const AGO = new Date(2026, 7, 1).getTime();       // 01/08/2026 00:00 local

  it('filtra o balde cliente numa janela semiaberta de convertedAt', () => {
    const spec = wonInMonthQuerySpec(JUL, AGO);
    expect(spec.wheres).toEqual([
      { field: 'lifecycleBucket', op: '==', value: LIFECYCLE_BUCKETS.CLIENTE },
      { field: 'convertedAt', op: '>=', value: new Date(JUL) },
      { field: 'convertedAt', op: '<', value: new Date(AGO) },
    ]);
    expect(spec.orderBy).toEqual({ field: 'convertedAt', dir: 'desc' });
  });

  it('não limita: o mês inteiro vem numa página, então o refino por funil é exato', () => {
    expect(wonInMonthQuerySpec(JUL, AGO).limit).toBeUndefined();
  });

  it('a janela é semiaberta — a virada do mês zera a coluna sem sobreposição', () => {
    // 31/07 23:59 entra em julho; 01/08 00:00 já é agosto.
    const spec = wonInMonthQuerySpec(JUL, AGO);
    const fim = spec.wheres.find(w => w.op === '<').value.getTime();
    const inicioAgosto = wonInMonthQuerySpec(AGO, new Date(2026, 8, 1).getTime())
      .wheres.find(w => w.op === '>=').value.getTime();
    expect(fim).toBe(inicioAgosto);
  });

  it('é servida pelo índice que já existe (nenhuma publicação manual)', () => {
    expect(coveredByLeadsIndex(wonInMonthQuerySpec(JUL, AGO))).toBe(true);
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

describe('renewalWindowMs', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const NOW = new Date(2026, 6, 15, 10, 0, 0).getTime();

  it('vai para frente até o maior marco e para trás até o período de vencidos', () => {
    const w = renewalWindowMs(NOW, { contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30], expiredWindowDays: 15 });
    expect(w.start).toBe(NOW - 16 * DAY);
    expect(w.end).toBe(NOW + 91 * DAY);
  });

  it('o threshold do sistema entra na conta quando é maior que os marcos', () => {
    const w = renewalWindowMs(NOW, { contractThresholdDays: 120, renewalCheckpoints: [30], expiredWindowDays: 7 });
    expect(w.end).toBe(NOW + 121 * DAY);
    expect(w.start).toBe(NOW - 8 * DAY);
  });

  it('ignora marco inválido, zero e negativo', () => {
    const w = renewalWindowMs(NOW, { contractThresholdDays: 0, renewalCheckpoints: [0, -5, NaN, 'x', 45], expiredWindowDays: 0 });
    expect(w.end).toBe(NOW + 46 * DAY);
    expect(w.start).toBe(NOW - 1 * DAY);
  });

  it('sem nada configurado ainda devolve a folga de 1 dia em cada ponta', () => {
    const w = renewalWindowMs(NOW, {});
    expect(w.start).toBe(NOW - 1 * DAY);
    expect(w.end).toBe(NOW + 1 * DAY);
  });
});

describe('clientsWithContactTodayQuerySpec', () => {
  const START = new Date(2026, 7, 18, 0, 0, 0).getTime();
  const END = new Date(2026, 7, 18, 23, 59, 59, 999).getTime();

  it('filtra só CLIENTE, com nextFollowUp dentro do dia', () => {
    const spec = clientsWithContactTodayQuerySpec(START, END);
    expect(spec.wheres).toEqual([
      { field: 'lifecycleBucket', op: '==', value: 'cliente' },
      { field: 'nextFollowUp', op: '>=', value: new Date(START) },
      { field: 'nextFollowUp', op: '<=', value: new Date(END) },
    ]);
  });

  it('ordena por nextFollowUp e NÃO limita a página', () => {
    const spec = clientsWithContactTodayQuerySpec(START, END);
    expect(spec.orderBy).toEqual({ field: 'nextFollowUp', dir: 'asc' });
    expect(spec.limit).toBeUndefined();
  });

  // O índice composto precisa existir, senão a query falha em produção com
  // failed-precondition e a Meta perde os clientes de novo.
  it('o índice composto está declarado em firestore.indexes.json', async () => {
    const { default: idx } = await import('../../../firestore.indexes.json', { with: { type: 'json' } });
    const tem = idx.indexes.some((i) =>
      i.collectionGroup === 'stronix_leads' &&
      i.fields.length === 2 &&
      i.fields[0].fieldPath === 'lifecycleBucket' &&
      i.fields[1].fieldPath === 'nextFollowUp'
    );
    expect(tem).toBe(true);
  });
});

describe('expiredClientsQuerySpec', () => {
  const ANTES = new Date(2026, 7, 18, 0, 0, 0).getTime();

  it('filtra cliente com vigência anterior ao corte', () => {
    expect(expiredClientsQuerySpec(ANTES).wheres).toEqual([
      { field: 'lifecycleBucket', op: '==', value: 'cliente' },
      { field: 'currentContractEndsAt', op: '<', value: new Date(ANTES) },
    ]);
  });

  // Inverso dos Atrasados, de propósito: quem venceu ontem tem mais chance de
  // voltar que quem venceu há dois meses.
  it('ordena do vencimento mais RECENTE para o mais antigo', () => {
    expect(expiredClientsQuerySpec(ANTES).orderBy).toEqual({ field: 'currentContractEndsAt', dir: 'desc' });
  });

  it('aceita tamanho de página', () => {
    expect(expiredClientsQuerySpec(ANTES, 10).limit).toBe(10);
    expect(expiredClientsQuerySpec(ANTES).limit).toBeUndefined();
  });
});

describe('renewalColumnQuerySpec', () => {
  const DIA = 86400000;
  const corte = new Date('2026-08-20T12:00:00Z').getTime();

  it('a coluna do meio é uma faixa aberta embaixo e fechada em cima', () => {
    const spec = renewalColumnQuerySpec(corte, 60, 30, 10);
    expect(spec.wheres).toEqual([
      { field: 'lifecycleBucket', op: '==', value: 'cliente' },
      { field: 'currentContractEndsAt', op: '>', value: new Date(corte + 30 * DIA) },
      { field: 'currentContractEndsAt', op: '<=', value: new Date(corte + 60 * DIA) },
    ]);
    expect(spec.orderBy).toEqual({ field: 'currentContractEndsAt', dir: 'asc' });
    expect(spec.limit).toBe(10);
  });

  it('a coluna menor começa NO corte, inclusive: quem vence hoje ainda renova', () => {
    const spec = renewalColumnQuerySpec(corte, 30, 0, 10);
    expect(spec.wheres[1]).toEqual({
      field: 'currentContractEndsAt', op: '>=', value: new Date(corte),
    });
  });

  it('sem pageSize não emite limit', () => {
    expect(renewalColumnQuerySpec(corte, 30, 0).limit).toBeUndefined();
  });

  // A INVARIANTE DA ESTEIRA: Renovações e Vencidos partem o mesmo eixo no
  // mesmo ponto. Se este teste cair, ou um cliente aparece nos dois boards, ou
  // some dos dois.
  it('não sobrepõe nem deixa buraco com o funil Vencidos', () => {
    const colunas = [
      renewalColumnQuerySpec(corte, 90, 60),
      renewalColumnQuerySpec(corte, 60, 30),
      renewalColumnQuerySpec(corte, 30, 0),
    ];
    const vencidos = expiredClientsQuerySpec(corte);

    const casa = (spec, ms) => {
      const d = new Date(ms);
      return spec.wheres.filter(w => w.field === 'currentContractEndsAt').every(w => {
        if (w.op === '>') return d > w.value;
        if (w.op === '>=') return d >= w.value;
        if (w.op === '<') return d < w.value;
        if (w.op === '<=') return d <= w.value;
        return true;
      });
    };

    const pontos = [
      corte - DIA, corte - 1, corte, corte + 1,
      corte + 30 * DIA, corte + 30 * DIA + 1,
      corte + 60 * DIA, corte + 60 * DIA + 1,
      corte + 90 * DIA,
    ];

    pontos.forEach(ms => {
      const emColuna = colunas.filter(c => casa(c, ms)).length;
      const emVencidos = casa(vencidos, ms) ? 1 : 0;
      // exatamente UM lugar para cada instante dentro do alcance do board
      expect(emColuna + emVencidos).toBe(1);
    });
  });

  it('quem vence depois do maior marco não entra em coluna nenhuma', () => {
    const spec = renewalColumnQuerySpec(corte, 90, 60);
    const depois = new Date(corte + 91 * DIA);
    expect(depois <= spec.wheres[2].value).toBe(false);
  });
});
