// O ciclo da avaliação do professor: a trilha anual em dezembro
// (src/lib/carreira/periodo.js), com a chave como número. As contas recebem o
// período; este arquivo fica só para as telas, que ainda leem o ciclo do
// endereço como ano, e sai no PR 3 do plano de carreira (menu Carreira).
// O teste deste arquivo é o de equivalência: a trilha anual de dezembro dá
// exatamente o ciclo de 1º de dezembro a 30 de novembro de antes.
import { pecasDaAderencia, periodoDe, periodoPorChave } from '../carreira/periodo.js';

const ANUAL_DEZEMBRO = Object.freeze({ frequencia: 'anual', mes: 12 });

// O ciclo de uma data, ou null com data inválida.
export function cicloDe(data) {
  const p = periodoDe(ANUAL_DEZEMBRO, data);
  return p ? Number(p.chave) : null;
}

// [inicio, fim): fim é 1º de dezembro às 00:00, fora do ciclo. Ciclo que não
// é ano dá datas inválidas, como antes.
export function limitesDoCiclo(ciclo) {
  const p = periodoPorChave(ANUAL_DEZEMBRO, String(ciclo));
  return p ? { inicio: p.inicio, fim: p.fim } : { inicio: new Date(NaN), fim: new Date(NaN) };
}

// Os dois semestres da aderência na avaliação de dezembro: janeiro a junho e
// julho a novembro.
export const semestresDoCiclo = (ciclo) => pecasDaAderencia(limitesDoCiclo(ciclo));
