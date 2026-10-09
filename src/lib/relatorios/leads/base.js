// O que os submenus dos Relatórios de Leads dividem (spec 2026-10-09): o
// recorte da barra, os leads novos da janela, os nomes de consultor, funil e
// origem, o filtro da lista, as colunas de contato da planilha, a data e o
// nome do arquivo. Puro.

import { makeScope, OTHERS_ID } from '../../crm/scope.js';
import { newLeadsOf } from '../../crm/cohort.js';
import { getDefaultFunnel } from '../../funnels.js';
import { contactLabel, contactOf } from '../../guardian.js';
import { dayKeyOf } from '../../operacional/month.js';
import { bucketOf } from './janela.js';

// Recorte da barra: consultores (lista; vazia é a equipe toda, com quem saiu
// da equipe e os leads sem dono), funil (null é todos os funis de lead) e
// origem (o nome no catálogo; null é todas).
export function reportScope({ users, funnels, userIds = [], funnelId = null, origem = null }) {
  const scope = makeScope({ users, funnels, userIds, funnelId });
  const sourceOk = (lead) => !origem || String(lead?.source || '').trim() === origem;
  return { ...scope, sourceOk, inScope: (lead) => scope.inScope(lead) && sourceOk(lead) };
}

// Os leads cadastrados na janela [start, end), na regra do painel (newLeadsOf:
// sem importados e sem data de cadastro ausente), com a versão mais nova de
// cada lead (leadsById).
export function newLeadsIn(ctx, scope, { start, end }) {
  const fresh = bucketOf(ctx.months, 'leadsCreated').map((l) => ctx.leadsById?.get(l.id) || l);
  return newLeadsOf(fresh, { start, end, inScope: scope.inScope });
}

export const OTHERS_LABEL = 'Fora da equipe ou sem responsável';

// Nomes que os recortes e a lista mostram. Nos recortes, quem saiu da equipe e
// o lead sem dono entram juntos em OTHERS_ID, como o Outros do painel. Na
// lista, o lead mostra o nome gravado nele.
export function namesOf(ctx) {
  const team = new Map((ctx.users || []).map((u) => [u.id, u.name || 'Sem nome']));
  const defaultFunnelId = getDefaultFunnel(ctx.funnels || [])?.id || null;
  const funnels = new Map((ctx.funnels || []).map((f) => [f.id, f.name || 'Funil']));
  const channels = new Map((ctx.sources || []).map((s) => [String(s?.name || '').trim(), String(s?.channel || '').trim()]));
  return {
    ownerKey: (l) => (team.has(l?.consultantId) ? l.consultantId : OTHERS_ID),
    ownerName: (id) => (id === OTHERS_ID ? OTHERS_LABEL : team.get(id) || OTHERS_LABEL),
    ownerLabel: (l) => team.get(l?.consultantId) || l?.consultantName || (l?.consultantId ? 'Fora da equipe' : 'Sem responsável'),
    funnelId: (l) => l?.funnelId || defaultFunnelId,
    funnelName: (id) => funnels.get(id) || 'Sem funil',
    sourceName: (l) => String(l?.source || '').trim() || 'Sem origem',
    channelOf: (name) => channels.get(name) || '',
  };
}

// Filtro da lista. Cada linha leva os códigos dos recortes em que ela entra
// (situacao:matricularam, origem:Instagram, consultor:<id>). O recorte do
// endereço só vale quando algum número ou recorte do submenu tem esse código;
// senão é ignorado.
export const cutCode = (tipo, valor) => `${tipo}:${valor}`;

export function applyCut(rows, recorte, available) {
  const cut = recorte && available.has(recorte) ? recorte : null;
  return { cut, rows: cut ? rows.filter((r) => r.cuts.includes(cut)) : rows };
}

const CUT_PREFIX = Object.freeze({ origem: 'Origem', consultor: 'Consultor', funil: 'Funil', faixa: 'Primeiro contato' });

// Texto do filtro aplicado, que a lista mostra: "Origem: Instagram". Os
// números (situacao) aparecem só com o nome deles, como "Matricularam".
export function cutLabelOf(cut, items) {
  const item = (items || []).find((i) => i.key === cut);
  if (!item) return null;
  const prefix = CUT_PREFIX[cut.slice(0, cut.indexOf(':'))];
  return prefix ? `${prefix}: ${item.name}` : item.name;
}

// Colunas de contato da planilha, no molde de Todos os leads (LeadsView): o
// WhatsApp do lead e, quando quem atende é o responsável do menor, o nome e o
// telefone dele. O CPF vai pela decisão 2 de 28/09/2026.
export const CONTACT_COLUMNS = Object.freeze([
  Object.freeze({ key: 'whatsapp', label: 'WhatsApp' }),
  Object.freeze({ key: 'responsavel', label: 'Responsável do aluno' }),
  Object.freeze({ key: 'telefoneResponsavel', label: 'Telefone do responsável' }),
  Object.freeze({ key: 'cpf', label: 'CPF' }),
]);

export function contactCells(lead, now) {
  const c = contactOf(lead, now);
  return {
    whatsapp: lead?.whatsapp || '',
    responsavel: c.viaGuardian ? contactLabel(c) : '',
    telefoneResponsavel: c.viaGuardian ? c.phone : '',
    cpf: lead?.cpf || '',
  };
}

export const fmtDate = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('pt-BR') : '');

// Situação de hoje do lead, pelo deriveLeadBucket.
export const SITUACAO_LABEL = Object.freeze({ ativo: 'Em aberto', cliente: 'Cliente', perda: 'Perdido' });

// Nome do arquivo da planilha: o submenu e as datas do período, sem dado
// pessoal. O último dia é o do fim efetivo (hoje, no período em andamento).
export function exportFileName(section, period) {
  const last = new Date(Math.max(period.start.getTime(), period.end.getTime() - 1));
  return `leads-${section}-${dayKeyOf(period.start)}-a-${dayKeyOf(last)}.csv`;
}

// Ordem das listas: cadastro mais novo primeiro, depois o nome e o id.
export const byNewest = (a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0)
  || a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id);
