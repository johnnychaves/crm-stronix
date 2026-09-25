// Campos DERIVADOS/denormalizados do lead, gravados junto com cada escrita
// (dual-write). Puro: sem React, sem Firestore. Servem para, no futuro (PR G),
// o app assinar só uma fatia da coleção (where lifecycleBucket / where nos
// campos de busca) em vez da coleção inteira. Enquanto a assinatura ainda é
// completa, estes campos ficam "adormecidos" — só o backfill (PR D) e os
// consumidores das PRs E-F passam a lê-los.

import { isClientLead } from './leads.js';
import { normalize, onlyDigits } from './globalSearch.js';
import { zapMatchKey } from '../../api/_zapPhone.js';

// Balde de ciclo de vida do lead. É a chave da assinatura permanente da PR G:
// - 'cliente' : matriculado (lifecycleStage) OU 'Venda' legado (isClientLead)
// - 'perda'   : status 'Perda' e não-cliente
// - 'ativo'   : pipeline vivo (o resto) — é o que o Kanban carrega
// Precedência de 'cliente' sobre 'perda' espelha isClientLead (um convertido
// que depois vira Perda continua contando como cliente, igual à aba Clientes).
export const deriveLeadBucket = (leadLike) =>
  isClientLead(leadLike) ? 'cliente' : (leadLike?.status === 'Perda' ? 'perda' : 'ativo');

// Campos de busca normalizados p/ a PR F (busca global e dup-check sem carregar
// a lista inteira). nameTokens habilita array-contains por token de nome;
// whatsappDigitsRev habilita busca por SUFIXO do telefone (usuário digita os
// últimos dígitos) via prefixo na string invertida.
export const buildLeadSearchFields = ({ name, whatsapp, cpf } = {}) => {
  const nameLower = normalize(name);
  const nameTokens = nameLower.split(/\s+/).filter(Boolean);
  const whatsappDigits = onlyDigits(whatsapp);
  const cpfDigits = onlyDigits(cpf);
  return {
    nameLower,
    nameTokens,
    whatsappDigits,
    whatsappDigitsRev: whatsappDigits.split('').reverse().join(''),
    cpfDigits,
    zapMatchKey: zapMatchKey(whatsapp),
  };
};

// Mesmo telefone para o casamento do Stronizap (DDD + 8 últimos dígitos),
// então pega o número com e sem o nono dígito.
export const sameContactPhone = (a, b) => { const ka = zapMatchKey(a); return Boolean(ka) && ka === zapMatchKey(b); };

// Campos derivados do telefone do RESPONSÁVEL do lead menor de idade. Ficam
// fora de buildLeadSearchFields de propósito: ela é chamada em vários pontos
// só com nome, WhatsApp e CPF, e toda escrita que não repassasse o
// responsável apagaria estes campos. Só quem muda o responsável (cadastro e
// edição) chama esta, por buildGuardianPatch.
export const buildGuardianSearchFields = (guardian) => {
  const digits = onlyDigits(guardian?.phone);
  return {
    guardianPhoneDigits: digits || null,
    guardianPhoneDigitsRev: digits ? digits.split('').reverse().join('') : null,
    guardianZapMatchKey: zapMatchKey(guardian?.phone),
  };
};

// Tudo o que o cadastro e a edição gravam sobre o responsável. Chave
// desligada apaga o responsável e os derivados.
export const buildGuardianPatch = ({ isMinor, name, phone, relationship } = {}) => {
  const trim = (v) => String(v ?? '').trim();
  const guardian = isMinor
    ? { name: trim(name), phone: trim(phone), relationship: trim(relationship) || null }
    : null;
  return { isMinor: Boolean(isMinor), guardian, ...buildGuardianSearchFields(guardian) };
};

// Anexa lifecycleBucket a um payload de escrita de lead, derivado do ESTADO
// RESULTANTE (lead atual + o patch). Use em todo write que toque
// status/lifecycleStage/isConverted. Ex.: withBucket({ status: 'Perda' }, lead).
export const withBucket = (payload, currentLead) => ({
  ...payload,
  lifecycleBucket: deriveLeadBucket({ ...currentLead, ...payload }),
});
