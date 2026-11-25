// A carteira do professor: os clientes cujo professor na data (professorAt) é
// ele, com contrato de plano de uma modalidade que ele dá (planModalityIds do
// plano contra modalidadeIds do professor). Os contratos chegam normalizados
// pelo normalizeContracts (operacional/base.js), como no Operacional: é ele
// que dá o fim previsto, as pausas e o estado num instante.
import { contractStateAt } from '../operacional/base.js';
import { planModalityIds } from '../planos.js';
import { professorAt } from '../professorHistory.js';

// Contratos de plano da modalidade do professor, por leadId. Contrato sem
// plano no catálogo (plano apagado ou importado sem plano) fica fora.
export function contratosDaModalidade(contratos, professor, planos) {
  const minhas = new Set(professor?.modalidadeIds || []);
  const planosById = new Map((planos || []).map((p) => [p.id, p]));
  const porLead = new Map();
  (contratos || []).forEach((c) => {
    if (!c?.leadId || !planModalityIds(planosById.get(c.planId)).some((id) => minhas.has(id))) return;
    const lista = porLead.get(c.leadId);
    if (lista) lista.push(c);
    else porLead.set(c.leadId, [c]);
  });
  return porLead;
}

// Estado da pessoa num instante pelos contratos dela: 'vigente', 'trancado'
// ou null. Vigente vence trancado, como no personStatesAt do Operacional.
export function estadoEm(contratos, t) {
  let estado = null;
  for (const c of contratos || []) {
    const s = contractStateAt(c, t);
    if (s === 'vigente') return s;
    if (s) estado = s;
  }
  return estado;
}

// A carteira na data: [{ lead, estado }], com o trancado incluído. Quem só
// quer a carteira ativa filtra o estado 'vigente'.
export function carteiraAt({ leads, contratos, planos, professor, data }) {
  const porLead = contratosDaModalidade(contratos, professor, planos);
  return (leads || []).flatMap((lead) => {
    const estado = estadoEm(porLead.get(lead?.id), data);
    return estado && professorAt(lead, data) === professor?.id ? [{ lead, estado }] : [];
  });
}
