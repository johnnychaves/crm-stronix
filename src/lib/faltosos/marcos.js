// Marcos de falta: os dias sem vir em que o professor procura o aluno. Cada
// marco vale um contato. Configuráveis em Configurações → Metas & ritmo
// (stronix_config/faltosos), começando em 7, 14, 30 e 60. Mudar os marcos vale
// a partir da próxima importação. Puro.
//
// Chamando de E a data do Faltantes e de E0 a do Faltantes anterior (na
// primeira importação, E menos 7 dias), o aluno atravessou o marco de M dias
// quando a última presença mais M dias cai depois de E0 e até E.
// Spec: docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md ("Marcos e tarefas").
import { diasEntre } from './dias.js';

export const DEFAULT_MARCOS = Object.freeze([7, 14, 30, 60]);
export const DEFAULT_JANELA_URGENTE = 90;

// Dias que a primeira importação olha para trás, por não ter E0.
export const JANELA_DA_PRIMEIRA_IMPORTACAO = 7;

const MAX_MARCOS = 6;
const MAX_DIAS = 365;
const diasValidos = (n) => Number.isInteger(n) && n >= 1 && n <= MAX_DIAS;

// De 1 a 6 números inteiros de 1 a 365, sem repetir, devolvidos em ordem numa
// lista nova. Qualquer coisa fora disso cai no padrão.
export function normalizarMarcos(raw) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_MARCOS) return [...DEFAULT_MARCOS];
  if (!raw.every(diasValidos) || new Set(raw).size !== raw.length) return [...DEFAULT_MARCOS];
  return [...raw].sort((a, b) => a - b);
}

// Janela do urgente, em dias inteiros de 1 a 365. Aceita o número ou o texto
// do campo ("60"); fora disso, 90.
export function normalizarJanelaUrgente(raw) {
  const n = typeof raw === 'number' ? raw : (typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN);
  return diasValidos(n) ? n : DEFAULT_JANELA_URGENTE;
}

// O maior marco atravessado entre E0 (exclusive) e E (inclusive), ou null.
export function marcoAtravessado({ ultimaPresenca, e0, e, marcos }) {
  const antes = diasEntre(ultimaPresenca, e0);
  const agora = diasEntre(ultimaPresenca, e);
  if (antes === null || agora === null) return null;
  let maior = null;
  for (const m of normalizarMarcos(marcos)) if (m > antes && m <= agora) maior = m;
  return maior;
}

// O maior marco já alcançado em E (dias sem vir maiores ou iguais a ele), ou
// null antes do primeiro. É o marco da tarefa que nasce só pelo urgente.
export function marcoAlcancado({ ultimaPresenca, e, marcos }) {
  const dias = diasEntre(ultimaPresenca, e);
  if (dias === null) return null;
  let maior = null;
  for (const m of normalizarMarcos(marcos)) if (m <= dias) maior = m;
  return maior;
}
