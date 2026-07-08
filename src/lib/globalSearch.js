// Busca global de pessoas (leads + clientes) sobre o array em memória.
// Puro: sem React, sem Firestore. Nome/sobrenome saem dos tokens do nome
// completo; telefone e CPF comparam só os dígitos. A normalização preserva o
// tamanho caractere a caractere para que a posição do trecho encontrado no
// nome normalizado aponte para a mesma posição no nome original (destaque).

export const onlyDigits = (s) => String(s || '').replace(/\D/g, '');

// minúsculas + sem acento, 1 char -> 1 char (índices preservados).
export const normalize = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const NAME_MIN = 2;   // busca por nome dispara a partir de 2 caracteres
const DIGITS_MIN = 3; // telefone/CPF só a partir de 3 dígitos (abaixo é ruído)

// searchPeople(leads, query, { limit }) -> { results, total }.
// Cada result: { lead, matchKind: 'name'|'phone'|'cpf', matchRange:[s,e]|null }.
export function searchPeople(leads, query, { limit = 8 } = {}) {
  const qNorm = normalize(String(query || '').trim());
  const qDigits = onlyDigits(query);
  const nameOn = qNorm.length >= NAME_MIN;
  const digitsOn = qDigits.length >= DIGITS_MIN;
  if (!nameOn && !digitsOn) return { results: [], total: 0 };

  const matched = [];
  for (const lead of leads || []) {
    const nameNorm = normalize(lead && lead.name);
    let tier = -1;
    let matchKind = null;
    let matchRange = null;

    if (nameOn) {
      // camada 0: algum token do nome começa com qNorm (prefixo nome/sobrenome)
      let idx = 0;
      let tokenStart = -1;
      for (const tok of nameNorm.split(/\s+/)) {
        if (!tok) continue;
        const pos = nameNorm.indexOf(tok, idx);
        idx = pos + tok.length;
        if (tok.startsWith(qNorm)) { tokenStart = pos; break; }
      }
      if (tokenStart >= 0) {
        tier = 0; matchKind = 'name'; matchRange = [tokenStart, tokenStart + qNorm.length];
      } else {
        // camada 1: qNorm em qualquer posição do nome
        const pos = nameNorm.indexOf(qNorm);
        if (pos >= 0) { tier = 1; matchKind = 'name'; matchRange = [pos, pos + qNorm.length]; }
      }
    }
    if (tier === -1 && digitsOn) {
      // camada 2: dígitos do telefone
      if (onlyDigits(lead && lead.whatsapp).includes(qDigits)) { tier = 2; matchKind = 'phone'; }
      // camada 3: dígitos do CPF
      else if (onlyDigits(lead && lead.cpf).includes(qDigits)) { tier = 3; matchKind = 'cpf'; }
    }

    if (tier >= 0) matched.push({ lead, tier, matchKind, matchRange });
  }

  matched.sort((a, b) =>
    a.tier !== b.tier
      ? a.tier - b.tier
      : String(a.lead && a.lead.name || '').localeCompare(String(b.lead && b.lead.name || ''), 'pt-BR')
  );

  return {
    total: matched.length,
    results: matched.slice(0, limit).map(({ lead, matchKind, matchRange }) => ({ lead, matchKind, matchRange }))
  };
}
