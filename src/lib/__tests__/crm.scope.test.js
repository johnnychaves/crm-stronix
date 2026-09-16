import { describe, it, expect } from 'vitest';
import { pct, median, medianWithMissing, countBy, rankCounts } from '../crm/stats.js';
import { fmtDuration, fmtDays, plural, monthName } from '../crm/format.js';
import { leadFunnelsOf, funnelStagesOf, makeScope, isClientFunnel, OTHERS_ID } from '../crm/scope.js';

const FUNNELS = [
  { id: 'ren', name: 'Renovações', systemKind: 'renewal', order: 98 },
  { id: 'ind', name: 'Indicações', systemKind: 'referral', order: 2 },
  { id: 'ven', name: 'Vendas', isDefault: true, order: 0 },
  { id: 'upg', name: 'Upgrade', systemKind: 'upgrade', order: 97 },
  { id: 'exp', name: 'Vencidos', systemKind: 'expired', order: 99 }
];
const USERS = [{ id: 'ana' }, { id: 'diego' }];

describe('stats', () => {
  it('pct arredonda e devolve null sem base', () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(0, 0)).toBeNull();
  });

  it('mediana de números', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it('mediana com os sem valor no fim da fila', () => {
    expect(medianWithMissing([10, 5, 20, null])).toBe(15);
    expect(medianWithMissing([5, 10, null, null])).toBeNull();
    expect(medianWithMissing([null, 30, 10])).toBe(30);
    expect(medianWithMissing([])).toBeNull();
  });

  it('contagem ranqueada, do maior para o menor e empate pelo nome', () => {
    const m = countBy(['b', 'a', 'b', 'c', 'a'], (x) => x);
    expect(rankCounts(m)).toEqual([{ name: 'a', count: 2 }, { name: 'b', count: 2 }, { name: 'c', count: 1 }]);
  });
});

describe('format', () => {
  it('duração em minutos, horas ou dias', () => {
    expect(fmtDuration(null)).toBe('—');
    expect(fmtDuration(42.4)).toBe('42 min');
    expect(fmtDuration(59.6)).toBe('1 h');
    expect(fmtDuration(130)).toBe('2 h 10 min');
    expect(fmtDuration(1440)).toBe('1 dia');
    expect(fmtDuration(5760)).toBe('4 dias');
  });

  it('dias com uma casa e vírgula', () => {
    expect(fmtDays(null)).toBe('—');
    expect(fmtDays(1)).toBe('1 dia');
    expect(fmtDays(6.5)).toBe('6,5 dias');
  });

  it('plural e nome do mês em texto corrido', () => {
    expect(plural(1, 'lead', 'leads')).toBe('1 lead');
    expect(plural(1200, 'lead', 'leads')).toBe('1.200 leads');
    expect(monthName('2026-08', '2026-09')).toBe('agosto');
    expect(monthName('2025-09', '2026-09')).toBe('setembro de 2025');
  });
});

describe('funis', () => {
  it('funis de lead: sem os de cliente, com Indicações, na ordem das Configurações', () => {
    expect(leadFunnelsOf(FUNNELS).map((f) => f.id)).toEqual(['ven', 'ind']);
    expect(isClientFunnel(FUNNELS[0])).toBe(true);
    expect(isClientFunnel(FUNNELS[1])).toBe(false);
  });

  it('etapas do funil na ordem, sem Perda, Venda e etapa de matrícula; etapa sem funil cai no padrão', () => {
    const statuses = [
      { name: 'Negociação', funnelId: 'ven', order: 3 },
      { name: 'Novo lead', order: 0 },
      { name: 'Contato feito', funnelId: 'ven', order: 1 },
      { name: 'Perda', funnelId: 'ven', order: 9 },
      { name: 'Matriculado', funnelId: 'ven', order: 8 },
      { name: 'Aguardando ação', funnelId: 'ind', order: 0 }
    ];
    expect(funnelStagesOf(statuses, 'ven', 'ven')).toEqual(['Novo lead', 'Contato feito', 'Negociação']);
    expect(funnelStagesOf(statuses, 'ind', 'ven')).toEqual(['Aguardando ação']);
  });
});

describe('makeScope', () => {
  const lead = (over) => ({ id: 'x', consultantId: 'ana', funnelId: 'ven', ...over });

  it('sem filtro: todo lead fora dos funis de cliente', () => {
    const s = makeScope({ users: USERS, funnels: FUNNELS });
    expect(s.inScope(lead())).toBe(true);
    expect(s.inScope(lead({ funnelId: 'ren' }))).toBe(false);
    expect(s.inScope(lead({ funnelId: null }))).toBe(true);
    expect(s.defaultFunnelId).toBe('ven');
  });

  it('pessoa: o dono do lead; Outros junta quem não está na equipe', () => {
    const ana = makeScope({ users: USERS, funnels: FUNNELS, userId: 'ana' });
    const others = makeScope({ users: USERS, funnels: FUNNELS, userId: OTHERS_ID });
    expect(ana.inScope(lead())).toBe(true);
    expect(ana.inScope(lead({ consultantId: 'diego' }))).toBe(false);
    expect(others.inScope(lead({ consultantId: 'ex' }))).toBe(true);
    expect(others.inScope(lead())).toBe(false);
  });

  it('funil: o do lead, com o lead sem funil caindo no padrão', () => {
    const ven = makeScope({ users: USERS, funnels: FUNNELS, funnelId: 'ven' });
    const ind = makeScope({ users: USERS, funnels: FUNNELS, funnelId: 'ind' });
    expect(ven.inScope(lead({ funnelId: null }))).toBe(true);
    expect(ind.inScope(lead({ funnelId: null }))).toBe(false);
    expect(ind.inScope(lead({ funnelId: 'ind' }))).toBe(true);
  });

  it('lead desconhecido só entra na equipe toda e em Todos os funis, e conta em Outros', () => {
    const unknown = { id: 'z', unknown: true };
    expect(makeScope({ users: USERS, funnels: FUNNELS }).inScope(unknown)).toBe(true);
    expect(makeScope({ users: USERS, funnels: FUNNELS, userId: 'ana' }).inScope(unknown)).toBe(false);
    expect(makeScope({ users: USERS, funnels: FUNNELS, userId: OTHERS_ID }).inScope(unknown)).toBe(true);
    expect(makeScope({ users: USERS, funnels: FUNNELS, funnelId: 'ven' }).inScope(unknown)).toBe(false);
  });
});
