// Recortes do CRM: as datas em que cada base começa, os funis de lead, as
// etapas de um funil e o recorte de pessoa e de funil (spec §4, "Recortes").
// Puro.

import { getDefaultFunnel, isItemInFunnel } from '../funnels.js';
import { isConvertedStatusName } from '../leads.js';
import { OTHERS_ID } from '../operacional/routine.js';

export { OTHERS_ID };

// A troca de etapa passou a ser gravada em 14/09/2026 (PR #208). Antes disso
// não há base para a passagem entre etapas nem para a etapa da perda.
export const STAGE_TRACKING_MONTH = '2026-09';

// O histórico de agendamentos (stronix_aulas) só fica completo a partir de
// agosto de 2026. Antes disso agendamentos e comparecimento são parciais.
export const APPTS_COMPLETE_MONTH = '2026-08';

// Funis de cliente (Renovações, Vencidos e Upgrade) ficam fora do CRM. O de
// Indicações é funil de lead e entra. O discriminador é a flag systemKind,
// nunca o nome (src/lib/funnels.js).
const CLIENT_FUNNEL_KINDS = new Set(['renewal', 'expired', 'upgrade']);
export const isClientFunnel = (f) => CLIENT_FUNNEL_KINDS.has(f?.systemKind);

// Funis de lead da academia, na ordem das Configurações.
export const leadFunnelsOf = (funnels) => (funnels || [])
  .filter((f) => f?.id && !isClientFunnel(f))
  .sort((a, b) => (a.order || 0) - (b.order || 0));

// Etapas de um funil na ordem do campo `order`, sem Perda e sem etapa com
// nome de matrícula (Venda, "Matriculado"): a matrícula não é etapa de lead.
// Etapa sem funil cai no funil padrão, como no Kanban.
export function funnelStagesOf(statuses, funnelId, defaultFunnelId) {
  const names = (statuses || [])
    .filter((s) => s?.name && isItemInFunnel(s, funnelId, defaultFunnelId))
    .filter((s) => s.name !== 'Perda' && !isConvertedStatusName(s.name))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((s) => s.name);
  return [...new Set(names)];
}

// Pessoa = dono do lead hoje (consultantId). OTHERS_ID junta quem não está na
// equipe. Funil = o do lead, com o lead sem funil caindo no padrão; sem funil
// escolhido, todo lead que não está num funil de cliente. Lead desconhecido
// (apagado, ou busca por id que falhou) só entra na equipe toda e em Todos os
// funis, e na pessoa conta como Outros.
export function makeScope({ users, funnels, userId = null, funnelId = null }) {
  const team = new Set((users || []).map((u) => u.id));
  const clientIds = new Set((funnels || []).filter(isClientFunnel).map((f) => f.id));
  const defaultFunnelId = getDefaultFunnel(funnels)?.id || null;
  const ownerOk = (lead) => {
    if (!userId) return true;
    if (!lead || lead.unknown) return userId === OTHERS_ID;
    return userId === OTHERS_ID ? !team.has(lead.consultantId) : lead.consultantId === userId;
  };
  const funnelOk = (lead) => {
    if (!lead || lead.unknown) return !funnelId;
    if (!funnelId) return !clientIds.has(lead.funnelId);
    return isItemInFunnel(lead, funnelId, defaultFunnelId);
  };
  return { ownerOk, funnelOk, inScope: (lead) => ownerOk(lead) && funnelOk(lead), defaultFunnelId, team };
}
