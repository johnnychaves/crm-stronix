// Helpers puros do catálogo de professores. Isolados aqui p/ serem óbvios de
// conferir e reusados no wizard, na Meta Diária, na lista de Aulas e no cadastro.
// O professor guarda IDS de modalidade (rename-proof); as telas resolvem p/ nome.

// Sentinela do agendamento sem professor responsável ("Treina sozinho"). É um
// valor não-vazio de propósito: no wizard o passo do professor é obrigatório, e
// escolher "Treina sozinho" conta como preenchido.
export const SOLO_TRAINING = '__solo__';
export const SOLO_TRAINING_LABEL = 'Treina sozinho';

// Nomes das modalidades de um professor. Ignora ids órfãos (modalidade excluída).
export function professorModalityNames(prof, modalities) {
  const byId = new Map((modalities || []).map((m) => [m.id, m.name]));
  return (prof?.modalidadeIds || []).map((id) => byId.get(id)).filter(Boolean);
}

// Professores ATIVOS que atuam numa modalidade, buscada pelo NOME (que é o que o
// wizard/agenda guardam). Retorna [] se a modalidade não existir mais.
export function professorsForModality(professores, modalities, modalityName) {
  const mod = (modalities || []).find((m) => m.name === modalityName);
  if (!mod) return [];
  return (professores || []).filter(
    (p) => p.ativo !== false && (p.modalidadeIds || []).includes(mod.id)
  );
}

// Nome do professor por id (p/ desnormalizar no lead e exibir na lista de Aulas).
export function professorNameById(professores, id) {
  if (!id) return null;
  const p = (professores || []).find((x) => x.id === id);
  return p ? p.nome : null;
}
