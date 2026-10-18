// O que cada campo do Contexto comercial da ficha grava. Um campo por vez, só
// ele: o buildClientRegistrationPatch reescreve nome, telefone, CPF e endereço
// a partir do formulário inteiro, e apagaria uma edição feita em outra aba. O
// consultor continua levando o trio id, nome e authUid junto (a regra do
// Firestore exige o par id mais authUid). Puro.
import { professorNameById } from './professores.js';

const str = (v) => String(v ?? '').trim();
const nullify = (v) => (str(v) ? str(v) : null);

export const CONTEXT_FIELDS = Object.freeze(['dor', 'modalidade', 'source', 'consultantId', 'professorId', 'tags', 'observation']);

export function buildContextPatch(field, value, { usersList = [], professores = [] } = {}) {
  switch (field) {
    case 'dor':
    case 'modalidade':
      return { [field]: nullify(value) };
    case 'source':
      return { source: str(value) };
    case 'observation':
      return { observation: str(value) };
    case 'professorId':
      return value
        ? { professorId: value, professorName: professorNameById(professores, value) }
        : { professorId: null, professorName: null };
    case 'tags':
      return { tags: [...new Set((Array.isArray(value) ? value : []).map(str).filter(Boolean))] };
    case 'consultantId': {
      const member = (usersList || []).find((u) => u.id === value);
      if (!member) return null;
      return { consultantId: value, consultantName: member.name, consultantAuthUid: member.authUid || null };
    }
    default:
      return null;
  }
}
