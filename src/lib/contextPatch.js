// O que cada campo do Contexto comercial da ficha grava. Um campo por vez, só
// ele: o buildClientRegistrationPatch reescreve nome, telefone, CPF e endereço
// a partir do formulário inteiro, e apagaria uma edição feita em outra aba. O
// consultor continua levando o trio id, nome e authUid junto (a regra do
// Firestore exige o par id mais authUid). Puro.
//
// Dor, modalidade, origem e etiqueta vão com o nome como veio do catálogo, sem
// aparar: há catálogo gravado com espaço no fim, e Todos os leads e as
// Configurações comparam o nome exato. Só o valor em branco vira vazio.
import { professorNameById } from './professores.js';

const str = (v) => String(v ?? '').trim();
const filled = (v) => (str(v) ? String(v) : null);
const tagList = (v) => [...new Set((Array.isArray(v) ? v : []).filter((t) => str(t)).map(String))];

export const CONTEXT_FIELDS = Object.freeze(['dor', 'modalidade', 'source', 'consultantId', 'professorId', 'tags', 'observation']);

export function buildContextPatch(field, value, { usersList = [], professores = [] } = {}) {
  switch (field) {
    case 'dor':
    case 'modalidade':
      return { [field]: filled(value) };
    case 'source':
      return { source: filled(value) ?? '' };
    case 'observation':
      return { observation: str(value) };
    case 'professorId':
      return value
        ? { professorId: value, professorName: professorNameById(professores, value) }
        : { professorId: null, professorName: null };
    case 'tags':
      return { tags: tagList(value) };
    case 'consultantId': {
      const member = (usersList || []).find((u) => u.id === value);
      if (!member) return null;
      return { consultantId: value, consultantName: member.name, consultantAuthUid: member.authUid || null };
    }
    default:
      return null;
  }
}

// O que mudou nas etiquetas desde que o editor abriu. A gravação manda só a
// diferença (arrayUnion e arrayRemove), para não apagar a etiqueta que outra
// aba gravou nesse meio tempo.
export function tagsDiff(opened, draft) {
  const from = tagList(opened);
  const to = tagList(draft);
  return { added: to.filter((t) => !from.includes(t)), removed: from.filter((t) => !to.includes(t)) };
}
