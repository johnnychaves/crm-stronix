// Aderência da carteira: por aluno-semana, de segunda a sexta, pelas
// presenças na aula de funcional importadas da Next Fit
// (stronix_presencas/{leadId}_{segunda}: { leadId, semana: 'AAAA-MM-DD',
// presencas }). A semana é aderente com presenças iguais ou acima da barra (2).
// O aluno conta na semana quando:
//   - o professor dele na segunda-feira (professorAt) é o professor;
//   - ele tem contrato da modalidade vigente na segunda às 00:00;
//   - ele já tinha contrato da modalidade (vigente ou trancado) no fim da
//     sexta anterior: é assim que a primeira semana do contrato fica fora, e a
//     renovação emendada não perde semana;
//   - nenhum dia de segunda a sexta, ao meio-dia, o encontra trancado.
// Só entram as semanas que já têm registro importado e que acabaram (sábado
// às 00:00 até o corte). Aluno sem registro na semana teve nenhuma presença.
// Sem nenhuma presença de aluno da turma em semana nenhuma, a lista volta
// vazia: o relatório importado não cobre a modalidade do professor.
import { pct } from '../crm/stats.js';
import { fromDateInputValue } from '../dates.js';
import { professorAt } from '../professorHistory.js';
import { contratosDaModalidade, estadoEm } from './carteira.js';

export const BARRA_PADRAO = 2;

const dia = (segunda, n, hora = 0) => new Date(segunda.getFullYear(), segunda.getMonth(), segunda.getDate() + n, hora);

function contaNaSemana(contratos, segunda) {
  if (estadoEm(contratos, segunda) !== 'vigente') return false;
  if (!estadoEm(contratos, new Date(dia(segunda, -2).getTime() - 1))) return false;
  for (let n = 0; n < 5; n += 1) {
    if (estadoEm(contratos, dia(segunda, n, 12)) === 'trancado') return false;
  }
  return true;
}

// [{ semana, contam, aderentes, umaPresenca, nenhuma, taxa, umaIds, nenhumaIds }],
// da semana mais nova para a mais antiga. umaIds e nenhumaIds são os leads que
// vieram uma vez e os que não vieram: o "Ver quem chamar" da aba.
export function aderenciaPorSemana({ presencas, leads, contratos, planos, professor, asOf = new Date(), barra = BARRA_PADRAO }) {
  const porChave = new Map();
  const semanas = new Set();
  (presencas || []).forEach((p) => {
    if (!p?.leadId || !p?.semana) return;
    semanas.add(p.semana);
    porChave.set(`${p.leadId}_${p.semana}`, Number(p.presencas) || 0);
  });
  const leadsById = new Map((leads || []).map((l) => [l.id, l]));
  const daModalidade = contratosDaModalidade(contratos, professor, planos);
  const linhas = [];
  let algumRegistro = false;
  [...semanas].sort().reverse().forEach((semana) => {
    const segunda = fromDateInputValue(semana);
    if (!segunda || dia(segunda, 5) > asOf) return;
    const linha = { semana, contam: 0, aderentes: 0, umaPresenca: 0, nenhuma: 0, umaIds: [], nenhumaIds: [] };
    daModalidade.forEach((lista, leadId) => {
      const lead = leadsById.get(leadId);
      if (!lead || professorAt(lead, segunda) !== professor?.id || !contaNaSemana(lista, segunda)) return;
      const n = porChave.get(`${leadId}_${semana}`) || 0;
      if (n > 0) algumRegistro = true;
      linha.contam += 1;
      if (n >= barra) linha.aderentes += 1;
      else if (n === 1) { linha.umaPresenca += 1; linha.umaIds.push(leadId); } else if (n === 0) { linha.nenhuma += 1; linha.nenhumaIds.push(leadId); }
    });
    linhas.push({ ...linha, taxa: pct(linha.aderentes, linha.contam) });
  });
  // Nenhum aluno da turma tem presença importada: a modalidade dele não entra
  // no relatório importado (hoje só o funcional), e a aderência é "sem dados",
  // não 0%.
  return algumRegistro ? linhas : [];
}

// Aluno-semanas aderentes ÷ que contam, nas semanas com a segunda-feira em
// [inicio, fim).
export function aderenciaDoSemestre(linhas, { inicio, fim }) {
  let contam = 0;
  let aderentes = 0;
  (linhas || []).forEach((l) => {
    const segunda = fromDateInputValue(l?.semana);
    if (!segunda || segunda < inicio || segunda >= fim) return;
    contam += l.contam;
    aderentes += l.aderentes;
  });
  return { contam, aderentes, taxa: pct(aderentes, contam) };
}

// Os pedaços do período (pecasDaAderencia, em src/lib/carreira/periodo.js) e
// a nota: a média das taxas dos pedaços fechados (fim até o corte). Com um só
// fechado, vale ele.
export function aderenciaDoAno(linhas, pecas, asOf = new Date()) {
  const semestres = (pecas || []).map((s) => ({ ...s, fechado: s.fim <= asOf, ...aderenciaDoSemestre(linhas, s) }));
  const taxas = semestres.filter((s) => s.fechado && s.taxa != null).map((s) => s.taxa);
  return { semestres, nota: taxas.length ? Math.round(taxas.reduce((a, b) => a + b, 0) / taxas.length) : null };
}

// O número da lista e do placar: a nota quando já há pedaço fechado; antes
// disso, a taxa do pedaço em andamento (emAndamento). Null sem semana.
export function aderenciaResumo(linhas, pecas, asOf = new Date()) {
  const ano = aderenciaDoAno(linhas, pecas, asOf);
  if (ano.nota != null) return { ...ano, taxa: ano.nota, emAndamento: false };
  const atual = [...ano.semestres].reverse().find((sm) => sm.inicio <= asOf && sm.taxa != null) ?? null;
  return { ...ano, taxa: atual?.taxa ?? null, emAndamento: atual != null };
}
