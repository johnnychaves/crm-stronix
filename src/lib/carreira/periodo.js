// Os períodos de avaliação de uma trilha do plano de carreira (spec
// 2026-11-26-plano-de-carreira-configuravel, "Os períodos"). Anual: os 12
// meses que terminam no fim do mês anterior ao mês da avaliação. Semestral:
// dois períodos de 6 meses por ano, com as avaliações a 6 meses de distância.
// A chave é o ano da avaliação ('2027') ou o ano com a vez dela ('2027-1',
// '2027-2'). Datas no fuso local, como o ciclo.js de antes. Puro e sem
// pacote: a api/ também vai ler (carreiraImports.test.js).
import { getSafeDateOrNull } from '../dates.js';

const SEMESTRAL = 'semestral';

// Os meses da avaliação, de 1 a 12. Mês fora da regra cai no padrão:
// dezembro no anual, junho e dezembro no semestral.
export function mesesDaAvaliacao(trilha) {
  const mes = Number(trilha?.mes);
  if (trilha?.frequencia === SEMESTRAL) {
    const primeiro = Number.isInteger(mes) && mes >= 1 && mes <= 6 ? mes : 6;
    return [primeiro, primeiro + 6];
  }
  return [Number.isInteger(mes) && mes >= 1 && mes <= 12 ? mes : 12];
}

const mesesDoPeriodo = (trilha) => (trilha?.frequencia === SEMESTRAL ? 6 : 12);

// [inicio, fim): fim é o dia 1º do mês da avaliação, às 00:00, fora do período.
function periodoQueTerminaEm(trilha, ano, mes, chave) {
  return {
    chave,
    inicio: new Date(ano, mes - 1 - mesesDoPeriodo(trilha), 1),
    fim: new Date(ano, mes - 1, 1),
  };
}

// O período de uma chave, ou null quando a chave não serve para a trilha.
export function periodoPorChave(trilha, chave) {
  const m = /^(\d{4})(?:-([12]))?$/.exec(String(chave ?? ''));
  if (!m) return null;
  const ano = Number(m[1]);
  const meses = mesesDaAvaliacao(trilha);
  if (meses.length === 1) return m[2] ? null : periodoQueTerminaEm(trilha, ano, meses[0], m[1]);
  if (!m[2]) return null;
  return periodoQueTerminaEm(trilha, ano, meses[Number(m[2]) - 1], `${m[1]}-${m[2]}`);
}

// O período em que a data cai, ou null com data inválida.
export function periodoDe(trilha, data) {
  const d = getSafeDateOrNull(data);
  if (!d) return null;
  const mes = d.getMonth() + 1;
  const ano = d.getFullYear();
  const [primeiro, segundo] = mesesDaAvaliacao(trilha);
  if (segundo == null) return periodoPorChave(trilha, String(mes < primeiro ? ano : ano + 1));
  if (mes < primeiro) return periodoPorChave(trilha, `${ano}-1`);
  if (mes < segundo) return periodoPorChave(trilha, `${ano}-2`);
  return periodoPorChave(trilha, `${ano + 1}-1`);
}

// Os vizinhos, para as setas do perfil.
export const periodoAnterior = (trilha, periodo) => periodoDe(trilha, new Date(periodo.inicio.getTime() - 1));
export const periodoSeguinte = (trilha, periodo) => periodoDe(trilha, periodo.fim);

// A janela da renovação: o período, ou, no semestral com 12 meses (o padrão),
// os 12 meses que terminam no fim do período.
export function janelaDaRenovacao(trilha, periodo) {
  if (trilha?.frequencia !== SEMESTRAL || trilha?.janelaRenovacao === 'periodo') {
    return { inicio: periodo.inicio, fim: periodo.fim };
  }
  return { inicio: new Date(periodo.fim.getFullYear(), periodo.fim.getMonth() - 12, 1), fim: periodo.fim };
}

// Os pedaços da aderência: os semestres do calendário (janeiro a junho e julho
// a novembro, sem dezembro) que caem no período, cortados nas pontas dele.
export function pecasDaAderencia({ inicio, fim }) {
  const pecas = [];
  for (let ano = inicio.getFullYear(); ano <= fim.getFullYear(); ano += 1) {
    [[0, 6], [6, 11]].forEach(([de, ate]) => {
      const i = new Date(Math.max(inicio.getTime(), new Date(ano, de, 1).getTime()));
      const f = new Date(Math.min(fim.getTime(), new Date(ano, ate, 1).getTime()));
      if (i < f) pecas.push({ inicio: i, fim: f });
    });
  }
  return pecas;
}

// A chave da avaliação em que a pesquisa conta: a primeira da trilha no mês
// em que ela abre ou depois. `inicio` é o dia 'AAAA-MM-DD' da pesquisa. O dia
// 0 do mês é o último dia do mês anterior, e o período dele termina na
// primeira avaliação a partir do mês da pesquisa.
export function chaveDaPesquisa(trilha, inicio) {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(inicio ?? ''));
  if (!m) return null;
  return periodoDe(trilha, new Date(Number(m[1]), Number(m[2]) - 1, 0))?.chave ?? null;
}
