// Regra pura do cadastro completo do cliente. Mapeia form <-> documento do lead
// e calcula o medidor de completude. Mantém o ClientRegistrationModal fino e
// testável (padrão do repo: regra em lib + teste).
import { fromDateInputValue, toDateInputValue } from './dates.js';
import { buildLeadSearchFields } from './leadDerived.js';
import { formatCPF, formatPhone } from './masks.js';
import { professorNameById } from './professores.js';

export const MARITAL_STATUS_OPTIONS = [
  'Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)', 'Outro',
];

const str = (v) => String(v ?? '').trim();
const nullify = (v) => (str(v) ? str(v) : null);

// Monta o mapa se pelo menos um subcampo tiver valor; senão null.
const mapOrNull = (obj) => (Object.values(obj).some((v) => str(v)) ? obj : null);

// lead (documento) -> form do modal.
export function readClientRegistration(lead = {}) {
  const a = lead.address || {};
  const e = lead.emergencyContact || {};
  return {
    name: lead.name || '',
    whatsapp: formatPhone(lead.whatsapp || ''),
    cpf: lead.cpf ? formatCPF(lead.cpf) : '',
    rg: lead.rg || '',
    birthDate: toDateInputValue(lead.birthDate),
    sexo: lead.sexo || '',
    email: lead.email || '',
    dor: lead.dor || '',
    modalidade: lead.modalidade || '',
    cep: a.cep || '', street: a.street || '', number: a.number || '',
    complement: a.complement || '', neighborhood: a.neighborhood || '',
    city: a.city || '', state: a.state || '',
    emgName: e.name || '', emgPhone: formatPhone(e.phone || ''), emgRelation: e.relationship || '',
    maritalStatus: lead.maritalStatus || '',
    profession: lead.profession || '',
    source: lead.source || '',
    consultantId: lead.consultantId || '',
    professorId: lead.professorId || '',
    observation: lead.observation || '',
    tags: lead.tags || [],
  };
}

// form do modal -> patch para updateDoc no documento do lead.
export function buildClientRegistrationPatch(form, { usersList, professores } = {}) {
  const patch = {
    name: str(form.name),
    whatsapp: str(form.whatsapp),
    cpf: nullify(form.cpf),
    rg: nullify(form.rg),
    birthDate: fromDateInputValue(form.birthDate),
    sexo: nullify(form.sexo),
    email: nullify(form.email),
    dor: nullify(form.dor),
    modalidade: nullify(form.modalidade),
    maritalStatus: nullify(form.maritalStatus),
    profession: nullify(form.profession),
    source: str(form.source),
    // Professor responsável (catálogo). Sem trava de admin: é referência, não permissão.
    professorId: form.professorId || null,
    professorName: form.professorId ? professorNameById(professores, form.professorId) : null,
    observation: str(form.observation),
    tags: Array.isArray(form.tags) ? form.tags : [],
    address: mapOrNull({
      cep: str(form.cep), street: str(form.street), number: str(form.number),
      complement: str(form.complement), neighborhood: str(form.neighborhood),
      city: str(form.city), state: str(form.state),
    }),
    emergencyContact: mapOrNull({
      name: str(form.emgName), phone: str(form.emgPhone), relationship: str(form.emgRelation),
    }),
    // Dual-write: campos de busca recomputados a partir do que será gravado.
    ...buildLeadSearchFields({ name: str(form.name), whatsapp: str(form.whatsapp), cpf: nullify(form.cpf) }),
  };
  // Reatribuição de consultor: qualquer membro da equipe pode passar a bola,
  // e os três campos vão JUNTOS (consultantAuthUid é a chave de permissão e a
  // regra do Firestore exige o par id+authUid andando junto).
  if (form.consultantId) {
    const c = (usersList || []).find((u) => u.id === form.consultantId);
    if (c) {
      patch.consultantId = form.consultantId;
      patch.consultantName = c.name;
      patch.consultantAuthUid = c.authUid || null;
    }
  }
  return patch;
}

// Troca de responsável: compara o dono ATUAL do lead com o que o patch vai
// gravar. Devolve null quando ninguém mudou de mão, e é o que decide se o
// salvamento deixa rastro (nota na linha do tempo + carimbo pro sino).
export function ownerChangeFor(lead = {}, patch = {}) {
  const to = patch.consultantId || null;
  if (!to || to === (lead.consultantId || null)) return null;
  return {
    fromId: lead.consultantId || null,
    fromName: lead.consultantName || 'sem responsável',
    toId: to,
    toName: patch.consultantName || 'consultor',
  };
}

// Texto da nota. Sem as palavras de contrato (matrícula/renovação/plano), que a
// timeline usa para classificar evento de contrato.
export const ownerChangeNote = (change) =>
  `Responsável alterado de [${change.fromName}] para [${change.toName}].`;

// Medidor de completude do cadastro do cliente (0..100). Address e emergência
// contam como 1 cada se tiverem o essencial preenchido.
const COMPLETENESS_CHECKS = [
  (f) => str(f.name), (f) => str(f.whatsapp), (f) => str(f.cpf), (f) => str(f.rg),
  (f) => str(f.birthDate), (f) => str(f.sexo), (f) => str(f.email),
  (f) => str(f.street) && str(f.number) && str(f.city),
  (f) => str(f.emgName) && str(f.emgPhone),
  (f) => str(f.maritalStatus), (f) => str(f.profession),
];

export function computeCompleteness(form = {}) {
  const total = COMPLETENESS_CHECKS.length;
  const filled = COMPLETENESS_CHECKS.filter((fn) => !!fn(form)).length;
  return Math.round((filled / total) * 100);
}
