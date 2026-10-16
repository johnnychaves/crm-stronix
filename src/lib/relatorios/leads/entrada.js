// Entrada de leads (spec 2026-10-09, submenu 1): quantos leads chegaram no
// período, de que origem e para qual consultor. Os leads novos saem da regra
// do painel CRM (newLeadsOf), então, no mês inteiro, o total é o "Leads novos"
// do painel. Puro.

import { deriveLeadBucket } from '../../leadDerived.js';
import { crmDelta } from '../../crm/metrics.js';
import {
  reportScope, newLeadsIn, namesOf, cutCode, countRows, applyCut, cutLabelOf, contactCells, CONTACT_COLUMNS, fmtDate,
  SITUACAO_LABEL, byNewest,
} from './base.js';

export const ENTRADA_COLUMNS = Object.freeze([
  Object.freeze({ key: 'nome', label: 'Nome' }),
  ...CONTACT_COLUMNS,
  Object.freeze({ key: 'origem', label: 'Origem' }),
  Object.freeze({ key: 'consultor', label: 'Consultor' }),
  Object.freeze({ key: 'funil', label: 'Funil' }),
  Object.freeze({ key: 'etapa', label: 'Etapa' }),
  Object.freeze({ key: 'cadastro', label: 'Cadastro' }),
  Object.freeze({ key: 'situacao', label: 'Situação' }),
]);

export function entradaReport(ctx, { period, cmp = null, userIds = [], funnelId = null, origem = null, recorte = null }) {
  const scope = reportScope({ users: ctx.users, funnels: ctx.funnels, userIds, funnelId, origem });
  const names = namesOf(ctx);
  const leads = newLeadsIn(ctx, scope, period);
  const before = cmp ? newLeadsIn(ctx, scope, cmp).length : null;

  const bySource = countRows(leads, names.sourceName, (id) => id, 'origem', (id) => ({ channel: names.channelOf(id) }));
  const byOwner = countRows(leads, names.ownerKey, names.ownerName, 'consultor', (id) => ({ note: names.ownerNote(id) }));
  const byFunnel = countRows(leads, names.funnelId, names.funnelName, 'funil');

  const rows = leads.map((l) => ({
    id: l.id,
    lead: l,
    name: l.name || 'Sem nome',
    source: names.sourceName(l),
    owner: names.ownerLabel(l),
    funnel: names.funnelName(names.funnelId(l)),
    stage: l.status || '',
    createdAt: l.createdAt,
    situation: SITUACAO_LABEL[deriveLeadBucket(l)],
    cuts: [cutCode('origem', names.sourceName(l)), cutCode('consultor', names.ownerKey(l)), cutCode('funil', names.funnelId(l))],
  })).sort(byNewest);

  const items = [...bySource, ...byOwner, ...byFunnel];
  const { cut, rows: visible } = applyCut(rows, recorte, new Set(items.map((i) => i.key)));

  return {
    total: leads.length,
    delta: before === null ? null : crmDelta(leads.length, before),
    bySource,
    byOwner,
    byFunnel,
    cut,
    cutLabel: cut ? cutLabelOf(cut, items) : null,
    rows: visible,
    exportColumns: ENTRADA_COLUMNS,
    exportRows: visible.map((r) => ({
      nome: r.name,
      ...contactCells(r.lead, ctx.now),
      origem: r.source,
      consultor: r.owner,
      funil: r.funnel,
      etapa: r.stage,
      cadastro: fmtDate(r.createdAt),
      situacao: r.situation,
    })),
  };
}
