// Regra pura das seções do Cadastro da ficha (aba Cadastro). O cadastro
// completo é feito de quatro seções que se editam uma de cada vez. Cada uma lê
// o lead quando abre e grava só as chaves dela: assim editar o endereço não
// apaga o que outra aba ou outra pessoa mudou no meio tempo. Dor, modalidade,
// origem, consultor, professor, etiquetas e observação são do Contexto
// comercial (contextPatch.js) e não passam por aqui.
import {
  COMPLETENESS_ITEMS,
  buildClientRegistrationPatch,
  readClientRegistration,
  registrationGuardianIssue,
} from './clientRegistration.js';

export const CADASTRO_SECTIONS = Object.freeze([
  { id: 'identidade', title: 'Identidade' },
  { id: 'endereco', title: 'Endereço' },
  { id: 'emergencia', title: 'Contato de emergência' },
  { id: 'pessoais', title: 'Dados pessoais' },
]);

// As chaves do formulário (readClientRegistration) que cada seção edita.
const FORM_KEYS = Object.freeze({
  identidade: [
    'name', 'whatsapp', 'cpf', 'rg', 'birthDate', 'sexo', 'email',
    'isMinor', 'minorAtOpen', 'adultSince', 'guardianName', 'guardianPhone', 'guardianRelation',
  ],
  endereco: ['cep', 'street', 'number', 'complement', 'neighborhood', 'city', 'state'],
  emergencia: ['emgName', 'emgPhone', 'emgRelation'],
  pessoais: ['maritalStatus', 'profession'],
});

// As chaves do documento do lead que cada seção grava, e só elas. Os derivados
// de busca andam com a identidade porque nascem do nome, do WhatsApp e do CPF.
// As do responsável só entram quando o patch as traz (quem fez 18 anos sem
// WhatsApp próprio não tem o responsável tocado).
const PATCH_KEYS = Object.freeze({
  identidade: [
    'name', 'whatsapp', 'cpf', 'rg', 'birthDate', 'sexo', 'email',
    'nameLower', 'nameTokens', 'whatsappDigits', 'whatsappDigitsRev', 'cpfDigits', 'zapMatchKey',
    'isMinor', 'guardian', 'guardianPhoneDigits', 'guardianPhoneDigitsRev', 'guardianZapMatchKey',
  ],
  endereco: ['address'],
  emergencia: ['emergencyContact'],
  pessoais: ['maritalStatus', 'profession'],
});

const str = (v) => String(v ?? '').trim();

// A dica do Editar e dos atalhos desligados enquanto outra seção está aberta.
export const LOCKED_HINT = 'Salve ou cancele a seção que está aberta';

export function readSectionForm(lead, sectionId, now = new Date()) {
  const keys = FORM_KEYS[sectionId];
  if (!keys) throw new Error(`Seção de cadastro desconhecida: ${sectionId}`);
  const full = readClientRegistration(lead, now);
  return Object.fromEntries(keys.map((k) => [k, full[k]]));
}

// O patch da seção: monta o formulário inteiro do lead com os valores da seção
// por cima, passa pelo montador de sempre e fica só com as chaves dela.
export function buildSectionPatch(sectionId, sectionForm, lead, now = new Date()) {
  const keys = PATCH_KEYS[sectionId];
  if (!keys) throw new Error(`Seção de cadastro desconhecida: ${sectionId}`);
  const form = { ...readClientRegistration(lead, now), ...sectionForm };
  const patch = buildClientRegistrationPatch(form);
  return Object.fromEntries(keys.filter((k) => k in patch).map((k) => [k, patch[k]]));
}

// O que impede salvar a seção, ou null. Só a identidade tem regra: nome e a
// parte do responsável do menor (a mesma do cadastro completo).
export function sectionIssue(sectionId, form, now = new Date()) {
  if (sectionId !== 'identidade') return null;
  if (!str(form.name)) return 'Informe o nome.';
  return registrationGuardianIssue(form, now);
}

export const missingOf = (form) => COMPLETENESS_ITEMS.filter((item) => item.label && !item.ok(form));

// O campo onde o atalho de um item que falta põe o cursor: o primeiro vazio do
// grupo (endereço e emergência), ou o campo do item.
export const shortcutFieldOf = (item, form) => (item.fields || [item.field]).find((k) => !str(form[k])) || item.field;

export function joinList(items) {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

export const capFirst = (text) => (text ? text[0].toUpperCase() + text.slice(1) : '');

export function sectionStatus(sectionId, form) {
  const faltando = missingOf(form).filter((m) => m.section === sectionId);
  if (!faltando.length) return { ok: true, n: 0, text: 'Completo' };
  return { ok: false, n: faltando.length, text: `Falta ${joinList(faltando.map((m) => m.label))}` };
}

export const missingHeadline = (n) => {
  if (n === 0) return 'Cadastro completo';
  return n === 1 ? 'Falta 1 dado para completar o cadastro' : `Faltam ${n} dados para completar o cadastro`;
};

// O cadastro está completo quando as onze conferências passam, as mesmas do anel.
export const isComplete = (form) => COMPLETENESS_ITEMS.every((item) => item.ok(form));

// O título da aba. Os atalhos só existem para o que tem rótulo; nome e WhatsApp
// contam no anel mas não são atalho (o menor de idade pode ficar sem WhatsApp
// próprio), e o título nunca pode dizer "completo" com o anel abaixo de 100%.
const BASIC_LABEL = { name: 'o nome', whatsapp: 'o WhatsApp' };
export function headlineOf(form) {
  const n = missingOf(form).length;
  if (n) return missingHeadline(n);
  const basic = COMPLETENESS_ITEMS.find((item) => !item.label && !item.ok(form));
  return basic ? `Falta ${BASIC_LABEL[basic.id]} para completar o cadastro` : missingHeadline(0);
}

// Idade em anos completos a partir de 'aaaa-mm-dd' (o valor do campo de data).
export function ageOf(inputDate, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(inputDate));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age -= 1;
  return age >= 0 ? age : null;
}

const row = (key, label, value, extra = {}) => ({ key, label, value: str(value) || null, field: key, ...extra });
const join = (parts, sep = ', ') => parts.map(str).filter(Boolean).join(sep);
const dmy = (input) => str(input).split('-').reverse().join('/');

const ADDRESS_KEYS = FORM_KEYS.endereco;
const EMERGENCY_KEYS = FORM_KEYS.emergencia;

// As linhas da leitura de cada seção. Valor vazio (value null) é um convite:
// a tela desenha "Adicionar" e o clique abre a seção no campo `field`.
export function viewRowsOf(sectionId, form, now = new Date()) {
  switch (sectionId) {
    case 'identidade': {
      const age = ageOf(form.birthDate, now);
      const rows = [
        row('name', 'Nome completo', form.name),
        row('whatsapp', form.isMinor ? 'WhatsApp do aluno' : 'WhatsApp', form.whatsapp),
        row('cpf', 'CPF', form.cpf),
        row('rg', 'RG', form.rg),
        row('birthDate', 'Nascimento', str(form.birthDate) ? `${dmy(form.birthDate)}${age == null ? '' : ` (${age} anos)`}` : ''),
        row('sexo', 'Sexo', form.sexo),
        row('email', 'E-mail', form.email),
      ];
      if (form.isMinor) {
        const quem = `${str(form.guardianName)}${str(form.guardianRelation) ? ` (${str(form.guardianRelation)})` : ''}`;
        rows.push(row('guardianName', 'Responsável', join([quem, form.guardianPhone], ' · ')));
      }
      return rows;
    }
    case 'endereco':
      // Vazio é sem nenhum campo, a mesma conta do mapOrNull que grava o address:
      // a importação grava endereço parcial (só a cidade, por exemplo).
      if (!ADDRESS_KEYS.some((k) => str(form[k]))) return [row('street', 'Endereço', '', { addLabel: 'Adicionar endereço' })];
      return [
        row('street', 'Rua', join([form.street, form.number, form.complement])),
        row('neighborhood', 'Bairro', form.neighborhood),
        row('city', 'Cidade', join([form.city, form.state])),
        row('cep', 'CEP', form.cep),
      ];
    case 'emergencia':
      if (!EMERGENCY_KEYS.some((k) => str(form[k]))) return [row('emgName', 'Contato', '', { addLabel: 'Adicionar contato' })];
      return [
        row('emgName', 'Nome', form.emgName),
        row('emgPhone', 'Telefone', form.emgPhone),
        row('emgRelation', 'Parentesco', form.emgRelation),
      ];
    default:
      return [
        row('maritalStatus', 'Estado civil', form.maritalStatus),
        row('profession', 'Profissão', form.profession),
      ];
  }
}
