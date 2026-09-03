// Regra pura da IMPORTAÇÃO DE CLIENTES de outros sistemas (NextFit, Pacto,
// Evo, SCA, Tecnofit): normalizadores, linha → candidato, dedupe no arquivo,
// escopo, casamento com a base, classificação e o construtor das escritas.
// Sem React e sem Firestore: o COMO gravar fica em clientImportWrites.js
// (padrão contracts.js / contractsWrites.js).
// Spec: docs/superpowers/specs/2026-09-03-importacao-clientes-design.md

import { normalize, onlyDigits } from './globalSearch.js';
import { addMonths, daysBetween, getSafeDateOrNull } from './dates.js';
import { formatCPF, formatPhone } from './masks.js';
import { parseValorBRL } from './format.js';
import { buildLeadSearchFields, deriveLeadBucket } from './leadDerived.js';
import { isClientLead } from './leads.js';
import { CONTRACT_STATUS, deriveContractStatus } from './contracts.js';

// ---------------------------------------------------------------------------
// Normalizadores
// ---------------------------------------------------------------------------

// Telefone como o app grava: DDD + número, 10 ou 11 dígitos, sem o 55 do país
// (formatPhone, em masks.js, corta em 11; exportação com 5571... nunca
// casaria). Fora disso devolve null: a linha guarda o bruto e não casa.
export const normalizePhoneDigits = (raw) => {
  let d = onlyDigits(raw);
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2);
  return d.length === 10 || d.length === 11 ? d : null;
};

// Dígito verificador do CPF. Sequência de um só algarismo é inválida (é o que
// sistema antigo grava quando ninguém informou, e amarraria dez pessoas numa).
export const isValidCpf = (digits) => {
  const d = String(digits || '');
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const check = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i += 1) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
};

// { digits, invalid }: digits só quando válido; invalid marca CPF preenchido
// mas errado (vira aviso na linha, sem barrar).
export const normalizeCpfDigits = (raw) => {
  const d = onlyDigits(raw);
  if (!d) return { digits: null, invalid: false };
  return isValidCpf(d) ? { digits: d, invalid: false } : { digits: null, invalid: true };
};

// Igual ao nameLower que buildLeadSearchFields grava, com espaços colapsados.
export const normalizeName = (raw) => normalize(String(raw ?? '').replace(/\s+/g, ' ').trim());

const localDate = (y, m, d) => {
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
};

// Data de célula → meia-noite LOCAL (igual ao fromDateInputValue do modal de
// matrícula). Aceita Date (SheetJS com cellDates), serial do Excel (número),
// 'dd/mm/aaaa', 'dd/mm/aa' e 'aaaa-mm-dd', com ou sem hora atrás. Ano de dois
// dígitos: até (ano atual + 10) é 20xx, acima é 19xx: contrato vence daqui a
// poucos anos, nascimento é décadas atrás.
export const parseImportDate = (raw, now = new Date()) => {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    // 25569 = dias entre 30/12/1899 (época do Excel) e 01/01/1970.
    const utc = new Date(Math.round((raw - 25569) * 86400000));
    return localDate(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
  }
  const s = String(raw).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?:\D.*)?$/);
  if (m) {
    let y = Number(m[3]);
    if (m[3].length === 2) y += y <= (now.getFullYear() % 100) + 10 ? 2000 : 1900;
    return localDate(y, Number(m[2]), Number(m[1]));
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:\D.*)?$/);
  if (m) return localDate(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
};

// Valores que o select de sexo do app conhece (AddLeadModal /
// ClientRegistrationModal). Texto desconhecido passa como veio.
export const normalizeSexo = (raw) => {
  const s = normalizeName(raw);
  if (!s) return null;
  if (s === 'm' || s.startsWith('masc')) return 'Masculino';
  if (s === 'f' || s.startsWith('fem')) return 'Feminino';
  if (s === 'o' || s.startsWith('outro')) return 'Outro';
  return String(raw).trim();
};

export const isTruthyCell = (raw) => {
  if (raw === true) return true;
  if (typeof raw === 'number') return raw > 0;
  return /^(sim|s|x|true|1|vip|yes|y)$/i.test(String(raw ?? '').trim());
};

export const CONTRACT_SITUATION = {
  ATIVO: 'ativo',
  A_VENCER: 'a_vencer',
  VENCIDO: 'vencido',
  CANCELADO: 'cancelado',
  TRANCADO: 'trancado',
  DESCONHECIDO: 'desconhecido'
};

// Texto livre da coluna "Situação do contrato" → slug. A ordem importa:
// "a vencer" contém "vencer" e "inativo" contém "ativ".
export const contractSituationFromText = (raw) => {
  const s = normalizeName(raw);
  if (!s) return null;
  if (/cancel/.test(s)) return CONTRACT_SITUATION.CANCELADO;
  if (/tranc|pausa|suspens|congel/.test(s)) return CONTRACT_SITUATION.TRANCADO;
  if (/a vencer|vencendo|renov/.test(s)) return CONTRACT_SITUATION.A_VENCER;
  if (/venc|expir|inativ|encerr|finaliz/.test(s)) return CONTRACT_SITUATION.VENCIDO;
  if (/ativ|vigente|em dia|normal|regular/.test(s)) return CONTRACT_SITUATION.ATIVO;
  return CONTRACT_SITUATION.DESCONHECIDO;
};

// "Situação do cliente" → 'ativo' | 'inativo' | null (desconhecido conta como
// não-inativo no escopo).
export const clientSituationFromText = (raw) => {
  const s = normalizeName(raw);
  if (!s) return null;
  if (/inativ|cancel|bloque|desativ/.test(s)) return 'inativo';
  if (/ativ/.test(s)) return 'ativo';
  return null;
};

const fmtDia = (d) => {
  const x = getSafeDateOrNull(d);
  return x ? x.toLocaleDateString('pt-BR') : '';
};

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const earliest = (...dates) => {
  const list = dates.map(getSafeDateOrNull).filter(Boolean);
  if (!list.length) return null;
  return list.reduce((min, d) => (d.getTime() < min.getTime() ? d : min));
};

// Mantém os imports usados pelas próximas tasks referenciados desde já (o
// lint acusa import sem uso). Cada task abaixo substitui o uso de verdade.
export const __IMPORT_INTERNALS = { addMonths, daysBetween, formatCPF, formatPhone, parseValorBRL, buildLeadSearchFields, deriveLeadBucket, isClientLead, CONTRACT_STATUS, deriveContractStatus, fmtDia, sameDay, earliest };
