// Helpers puros do catálogo de planos. O plano guarda IDS de modalidade em
// modalityIds (array, rename-proof). Planos antigos têm o campo único legado
// modalityId — a leitura cai nele como fallback, sem migração. Um modalityIds
// já presente (mesmo vazio) tem prioridade: significa que o plano já foi salvo
// no formato novo.

export function planModalityIds(plan) {
  if (Array.isArray(plan?.modalityIds)) return plan.modalityIds;
  return plan?.modalityId ? [plan.modalityId] : [];
}

// Nomes das modalidades de um plano. Ignora ids órfãos (modalidade excluída).
export function planModalityNames(plan, modalities) {
  const byId = new Map((modalities || []).map((m) => [m.id, m.name]));
  return planModalityIds(plan).map((id) => byId.get(id)).filter(Boolean);
}
