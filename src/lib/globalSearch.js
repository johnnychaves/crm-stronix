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

// Specs de CANDIDATOS pra busca remota (G1b) — o Firestore não faz substring,
// então usamos os search fields materializados (leadDerived.buildLeadSearchFields)
// pra puxar um conjunto PEQUENO de candidatos por PREFIXO/TOKEN; o chamador roda
// searchPeople() sobre esses candidatos pra reproduzir EXATAMENTE o ranking/tier/
// destaque de hoje. Cada spec é single-field (índice automático, sem composto):
//   - nome:     range em nameLower (prefixo do nome completo)
//               + array-contains qNorm em nameTokens (TOKEN exato — acha o
//                 primeiro nome OU o sobrenome INTEIRO; sobrenome parcial não).
//   - telefone: range em whatsappDigits (prefixo) + range em whatsappDigitsRev
//                 (sufixo = últimos dígitos digitados).
//   - cpf:      range em cpfDigits (prefixo).
// '' é um code point alto da BMP: [q, q+'') captura todo prefixo de q.
// Mesmos limiares de searchPeople (nome ≥2, dígitos ≥3). Sem query aplicável → [].
const SEARCH_HIGH = '';
export const searchCandidateSpecs = (query, pageSize = 20) => {
  const qNorm = normalize(String(query || '').trim());
  const qDigits = onlyDigits(query);
  const specs = [];
  if (qNorm.length >= 2) {
    specs.push({
      wheres: [
        { field: 'nameLower', op: '>=', value: qNorm },
        { field: 'nameLower', op: '<', value: qNorm + SEARCH_HIGH },
      ],
      orderBy: { field: 'nameLower', dir: 'asc' },
      limit: pageSize,
    });
    specs.push({
      wheres: [{ field: 'nameTokens', op: 'array-contains', value: qNorm }],
      limit: pageSize,
    });
  }
  if (qDigits.length >= 3) {
    specs.push({
      wheres: [
        { field: 'whatsappDigits', op: '>=', value: qDigits },
        { field: 'whatsappDigits', op: '<', value: qDigits + SEARCH_HIGH },
      ],
      orderBy: { field: 'whatsappDigits', dir: 'asc' },
      limit: pageSize,
    });
    const rev = qDigits.split('').reverse().join('');
    specs.push({
      wheres: [
        { field: 'whatsappDigitsRev', op: '>=', value: rev },
        { field: 'whatsappDigitsRev', op: '<', value: rev + SEARCH_HIGH },
      ],
      orderBy: { field: 'whatsappDigitsRev', dir: 'asc' },
      limit: pageSize,
    });
    specs.push({
      wheres: [
        { field: 'cpfDigits', op: '>=', value: qDigits },
        { field: 'cpfDigits', op: '<', value: qDigits + SEARCH_HIGH },
      ],
      orderBy: { field: 'cpfDigits', dir: 'asc' },
      limit: pageSize,
    });
  }
  return specs;
};
