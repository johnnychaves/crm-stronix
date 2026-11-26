// Os números que uma trilha pode ligar (spec 2026-11-26-plano-de-carreira-
// configuravel, "Os números e as metas"). Cada um sabe a base (professor ou
// consultor), o limite da meta e quando a meta bate. As contas moram em
// src/lib/professor/ (professor) e, a partir do PR 4, em
// src/lib/carreira/consultor.js. A ordem das chaves é a ordem da grade.
export const BASES = Object.freeze(['professor', 'consultor']);

export const NUMEROS = Object.freeze({
  renovacao: Object.freeze({ base: 'professor', nome: 'Renovação da carteira', min: 0, max: 100 }),
  nps: Object.freeze({ base: 'professor', nome: 'Nota dos alunos', min: 0, max: 10 }),
  conversao: Object.freeze({ base: 'professor', nome: 'Conversão em matrícula', min: -50, max: 50, contraAcademia: true }),
  aderencia: Object.freeze({ base: 'professor', nome: 'Aderência às aulas', min: 0, max: 100 }),
  consultorConversao: Object.freeze({ base: 'consultor', nome: 'Conversão em matrícula', min: -50, max: 50, contraAcademia: true }),
  vendas: Object.freeze({ base: 'consultor', nome: 'Vendas', min: 0, max: 10000000 }),
  consultorRenovacao: Object.freeze({ base: 'consultor', nome: 'Renovação da carteira', min: 0, max: 100 }),
  metaDiaria: Object.freeze({ base: 'consultor', nome: 'Meta diária batida', min: 0, max: 100 }),
});

export const numerosDaBase = (base) => Object.keys(NUMEROS).filter((id) => NUMEROS[id].base === base);

export function metaValida(id, valor) {
  const n = NUMEROS[id];
  return Boolean(n) && typeof valor === 'number' && Number.isFinite(valor) && valor >= n.min && valor <= n.max;
}

// true, false ou null (sem meta ou sem resultado). O número contra a academia
// bate quando passa da academia mais os pontos da meta, e empate não bate,
// como a conversão do professor de hoje. Os outros batem ao chegar na meta.
export function metaBatida(id, { valor, meta, academia = null }) {
  if (!NUMEROS[id] || meta == null || valor == null) return null;
  if (NUMEROS[id].contraAcademia) return academia == null ? null : valor > academia + meta;
  return valor >= meta;
}

// Os ajustes da trilha, cada um ligado a um número. Os padrões são os de hoje
// (src/lib/professor/metas.js).
export const AJUSTES = Object.freeze({
  janelaDias: Object.freeze({ numero: 'conversao', min: 0, max: 90, padrao: 30 }),
  barra: Object.freeze({ numero: 'aderencia', min: 1, max: 5, padrao: 2 }),
  faixaMax: Object.freeze({ numero: 'aderencia', min: 0, max: 100, padrao: 70 }),
});

export const VENDAS_EM = Object.freeze(['reais', 'quantidade']);
