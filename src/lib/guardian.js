// Responsável do lead menor de idade. Regra única de quem é menor agora e de
// quem o consultor chama, usada pela tela, pelas listas, pela busca e pela
// api/ (cartão do Stronizap). Pura: sem React e sem Firebase. Nunca importar
// daqui src/lib/dailyGoal.js, que puxa lucide-react e quebra a api/, nem
// leads.js, globalSearch.js ou leadDerived.js (ciclo de import:
// leads.js → globalSearch.js → guardian.js). É por isso que onlyDigits é
// local em vez de vir de globalSearch.js.
//
// Nada é gravado no aniversário: a regra roda toda vez que o lead é lido.
// Spec: docs/superpowers/specs/2026-09-24-responsavel-do-menor-design.md
import { getSafeDateOrNull } from './dates.js';

export const GUARDIAN_RELATIONSHIPS = Object.freeze(['Mãe', 'Pai', 'Avó', 'Avô', 'Tia', 'Tio', 'Outro']);

const MIN_PHONE_DIGITS = 10;
const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '');
// Tem telefone de verdade: 10 dígitos ou mais (DDD + número).
export const hasPhone = (v) => onlyDigits(v).length >= MIN_PHONE_DIGITS;
const hasGuardian = (lead) => Boolean(lead?.guardian) && hasPhone(lead.guardian.phone);

// Dia em que a pessoa faz 18 anos. new Date(ano + 18, mês, dia) já leva o
// 29 de fevereiro para 1º de março nos anos que não são bissextos. As partes
// da data (ano/mês/dia) saem do fuso horário do ambiente que roda esta
// função. A data de nascimento é salva à meia-noite local do Brasil (03:00Z),
// então no servidor (Vercel, UTC) o dia do calendário está certo, mas a
// virada pra adulto acontece às 21h de Brasília da véspera, aceito pela
// spec, a mesma noção de "hoje" de api/_zapStrip.js.
export function adultSince(birthDate) {
  const d = getSafeDateOrNull(birthDate);
  if (!d) return null;
  return new Date(d.getFullYear() + 18, d.getMonth(), d.getDate());
}

// A chave está ligada, mas a data de nascimento já passou dos 18 anos.
export function turnedAdult(lead, now = new Date()) {
  if (lead?.isMinor !== true) return false;
  const since = adultSince(lead.birthDate);
  return Boolean(since) && now.getTime() >= since.getTime();
}

export function isMinorNow(lead, now = new Date()) {
  return lead?.isMinor === true && hasGuardian(lead) && !turnedAdult(lead, now);
}

// Quem o consultor chama. `viaGuardian` diz se é o responsável e
// `missingOwnPhone` que a pessoa fez 18 anos sem WhatsApp próprio.
export function contactOf(lead, now = new Date()) {
  const own = {
    phone: lead?.whatsapp || '',
    name: lead?.name || '',
    relationship: null,
    viaGuardian: false,
    missingOwnPhone: false,
  };
  if (lead?.isMinor !== true || !hasGuardian(lead)) return own;
  const guardian = {
    phone: lead.guardian.phone,
    name: lead.guardian.name || '',
    relationship: lead.guardian.relationship || null,
    viaGuardian: true,
  };
  if (!turnedAdult(lead, now)) return { ...guardian, missingOwnPhone: false };
  if (!hasPhone(lead.whatsapp)) return { ...guardian, missingOwnPhone: true };
  return own;
}

// "Maria Souza (mãe)". Sem parentesco, ou com "Outro", só o nome.
export function contactLabel(c) {
  const { name, relationship } = c ?? {};
  const nome = String(name ?? '').trim();
  if (!relationship || relationship === 'Outro') return nome;
  return `${nome} (${String(relationship).toLowerCase()})`;
}

export const firstName = (name) => String(name ?? '').trim().split(/\s+/)[0] || '';

// Link do wa.me. Número de até 11 dígitos ganha o 55 na frente.
export function whatsappHref(phone, text) {
  let n = onlyDigits(phone);
  if (!n) return null;
  if (n.length <= 11) n = `55${n}`;
  return text ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : `https://wa.me/${n}`;
}

export function telHref(phone) {
  const n = onlyDigits(phone);
  return n ? `tel:${n}` : null;
}

// O que impede salvar o bloco do responsável, ou null. `birthDate` é Date
// (ou Timestamp); o formulário converte a string do input antes.
export function guardianIssue({ isMinor, name, phone, birthDate, now = new Date() }) {
  if (!isMinor) return null;
  if (String(name ?? '').trim().length <= 1) return 'Informe o nome do responsável.';
  if (!hasPhone(phone)) return 'Informe o telefone do responsável com DDD.';
  const since = adultSince(birthDate);
  if (since && now.getTime() >= since.getTime()) {
    return 'Pela data, já tem 18 anos. Confira a data ou desligue a chave.';
  }
  return null;
}
