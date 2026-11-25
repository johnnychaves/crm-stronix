// O ciclo da avaliação do plano de carreira: de 1º de dezembro a 30 de
// novembro, no fuso local, com o nome do ano em que termina (o ciclo 2027 vai
// de 01/12/2026 a 30/11/2027 e é avaliado em dezembro de 2027). Os semestres
// da aderência são de janeiro a junho e de julho a novembro: dezembro fica
// fora de qualquer ciclo na aderência (spec 2026-11-24-perfil-do-professor).
import { getSafeDateOrNull } from '../dates.js';

// O ciclo de uma data, ou null com data inválida.
export function cicloDe(data) {
  const d = getSafeDateOrNull(data);
  if (!d) return null;
  return d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
}

// [inicio, fim): fim é 1º de dezembro às 00:00, fora do ciclo.
export const limitesDoCiclo = (ciclo) => ({ inicio: new Date(ciclo - 1, 11, 1), fim: new Date(ciclo, 11, 1) });

// Os dois semestres da aderência na avaliação de dezembro. O segundo para em
// 30 de novembro, o fim do ciclo.
export const semestresDoCiclo = (ciclo) => [
  { inicio: new Date(ciclo, 0, 1), fim: new Date(ciclo, 6, 1) },
  { inicio: new Date(ciclo, 6, 1), fim: new Date(ciclo, 11, 1) },
];
