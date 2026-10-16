// Fixtures do painel CRM (setembro de 2026 em andamento, até dia 14 ao
// meio-dia, e agosto fechado), divididas pelo crm.metrics.test.js e pelos
// testes dos Relatórios de Leads, que comparam o relatório com o metricsOf
// nos mesmos dados.

export const NOW = new Date(2026, 8, 14, 12, 0);
export const D = (m, d, h = 10, min = 0) => new Date(2026, m - 1, d, h, min);
export const USERS = [{ id: 'ana', name: 'Ana Ribeiro' }, { id: 'diego', name: 'Diego Santos' }];
export const FUNNELS = [
  { id: 'ven', name: 'Vendas', isDefault: true, order: 0 },
  { id: 'ind', name: 'Indicações', systemKind: 'referral', order: 1 },
  { id: 'ren', name: 'Renovações', systemKind: 'renewal', order: 98 }
];
export const STATUSES = [
  { name: 'Novo lead', funnelId: 'ven', order: 0 },
  { name: 'Contato feito', funnelId: 'ven', order: 1 },
  { name: 'Aguardando ação', funnelId: 'ind', order: 0 }
];
export const L = (id, over) => ({ id, consultantId: 'ana', funnelId: 'ven', source: 'Instagram', status: 'Novo lead', createdAt: D(9, 2), ...over });
export const N = (id, leadId, at, text = 'Falei com a pessoa') => ({ id, leadId, type: 'note', text, createdAt: at });
export const MV = (id, leadId, from, to, at) => ({ id, leadId, type: 'status_change', fromStatus: from, toStatus: to, funnelId: 'ven', createdAt: at });
export const A = (id, leadId, status, at, booked, over = {}) => ({ id, leadId, type: 'aula', status, scheduledFor: at, createdAt: booked, ...over });

export const s1 = L('s1', { status: 'Venda', isConverted: true, convertedAt: D(9, 5) });
export const s2 = L('s2', { consultantId: 'diego', source: 'Indicação', funnelId: 'ind', nextFollowUp: null });
export const s3 = L('s3', { status: 'Perda', lostAt: D(9, 6), lossReason: 'Preço' });
export const s4 = L('s4', { consultantId: 'diego', createdAt: D(9, 13), nextFollowUp: D(9, 15) });
export const s5 = L('s5', { consultantId: 'ex', nextFollowUp: null });
export const imp = L('imp', { importBatchId: 'lote', source: 'Importação' });
export const ren = L('ren', { funnelId: 'ren' });
export const o1 = L('o1', { consultantId: 'diego', createdAt: D(8, 10), status: 'Venda', isConverted: true, convertedAt: D(9, 8) });
export const a1 = L('a1', { createdAt: D(8, 3), status: 'Venda', isConverted: true, convertedAt: D(8, 20) });
export const a2 = L('a2', { consultantId: 'diego', source: 'Site', createdAt: D(8, 5), nextFollowUp: D(9, 20) });
export const a3 = L('a3', { createdAt: D(8, 12), nextFollowUp: null });

// Setembro em andamento (até dia 14, meio-dia) e agosto fechado.
export function makeCtx() {
  const everyone = [s1, s2, s3, s4, s5, imp, ren, o1, a1, a2, a3];
  return {
    now: NOW,
    users: USERS,
    funnels: FUNNELS,
    statuses: STATUSES,
    liveLeads: [s2, s4, s5, a2, a3],
    leadsById: new Map(everyone.map((l) => [l.id, l])),
    months: {
      '2026-09': {
        leadsCreated: [s1, s2, s3, s4, s5, imp, ren],
        converted: [s1, o1],
        lost: [s3],
        aulas: [
          A('r1', 's1', 'attended', D(9, 4), D(9, 3), { professorId: 'p1', professorName: 'Paula Nunes', modality: 'Funcional', converted: true }),
          A('r2', 's2', 'no_show', D(9, 5), D(9, 3), { type: 'visita' }),
          A('r3', 's4', 'agendada', D(9, 20), D(9, 13), { professorId: 'p1', professorName: 'Paula Nunes' })
        ],
        interactions: [
          N('i1', 's1', D(9, 2, 10, 30)),
          N('i2', 's2', D(9, 3, 12)),
          N('i3', 's3', D(9, 2, 10), 'OBSERVAÇÃO DO CADASTRO: veio pelo Instagram'),
          N('i4', 's5', D(9, 2, 15)),
          MV('m1', 's1', 'Novo lead', 'Contato feito', D(9, 3)),
          MV('m2', 's3', 'Novo lead', 'Contato feito', D(9, 4)),
          MV('m4', 's1', 'Contato feito', 'Venda', D(9, 5)),
          MV('m3', 's3', 'Contato feito', 'Perda', D(9, 6))
        ]
      },
      '2026-08': {
        leadsCreated: [a1, a2, a3, o1],
        converted: [a1],
        lost: [],
        aulas: [A('r4', 'a1', 'attended', D(8, 8), D(8, 6), { professorId: 'p1', professorName: 'Paula Nunes', modality: 'Musculação', converted: true })],
        interactions: [N('j1', 'a1', D(8, 3, 10, 20)), N('j2', 'a2', D(8, 7)), N('j3', 'o1', D(8, 10, 10, 45))]
      }
    }
  };
}
