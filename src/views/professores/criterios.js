// O resumo de cada critério do plano de carreira para a tela: o número, o
// texto de referência embaixo dele e o estado (bateu, ficou abaixo ou sem
// dados). As contas são as de src/lib/professor/; aqui só se decide o texto.
import { referenciaDaRenovacao } from '../../lib/professor/metas.js';

export const ESTADO_TEXTO = Object.freeze({ ok: 'bateu', baixo: 'ficou abaixo', sem: 'sem dados no ciclo' });

const pctTexto = (n) => `${n}%`;
export const notaTexto = (n) => n.toFixed(2).replace('.', ',');

// A renovação bate quando chega à média esperada do nível. Sem nível não há
// com o que comparar.
export function criterioRenovacao(renovacao, metas, nivel) {
  if (renovacao.taxa == null) return { valor: null, ref: 'nenhum contrato venceu', estado: 'sem' };
  const esperado = referenciaDaRenovacao(metas, nivel);
  if (esperado == null) return { valor: pctTexto(renovacao.taxa), ref: 'defina o nível', estado: 'sem' };
  return { valor: pctTexto(renovacao.taxa), ref: `esperado ${esperado}%`, estado: renovacao.taxa >= esperado ? 'ok' : 'baixo' };
}

// A conversão passa pela regra do conversaoDoCiclo (acima da academia menos a
// tolerância; empate não passa).
export function criterioConversao(conversao) {
  if (conversao.professor.taxa == null) return { valor: null, ref: 'ninguém veio', estado: 'sem' };
  const ref = conversao.academia.taxa == null ? 'academia sem dados' : `academia ${conversao.academia.taxa}%`;
  return { valor: pctTexto(conversao.professor.taxa), ref, estado: conversao.passa ? 'ok' : 'baixo' };
}

// A nota dos alunos: a nota do ano (npsDoCiclo) contra a meta. Pesquisa que
// não valeu não dá nota.
export function criterioNps(nps, metas) {
  if (!nps?.itens?.length) return { valor: null, ref: 'sem pesquisa ainda', estado: 'sem' };
  if (nps.nota == null) return { valor: null, ref: 'sem nota válida', estado: 'sem' };
  return { valor: notaTexto(nps.nota), ref: `meta ${metas.nps.meta}`, estado: nps.passa ? 'ok' : 'baixo' };
}
// A aderência pelo aderenciaResumo: a nota do ano, ou o semestre em andamento.
// Bate com a taxa a partir do começo da faixa da meta; acima dela também bate.
export function criterioAderencia(resumo, metas) {
  const { faixaMin, faixaMax } = metas.aderencia;
  if (resumo?.taxa == null) return { valor: null, ref: 'sem dados ainda', estado: 'sem' };
  const ref = `meta ${faixaMin}% a ${faixaMax}%`;
  return { valor: pctTexto(resumo.taxa), ref: resumo.emAndamento ? `semestre em andamento, ${ref}` : ref, estado: resumo.taxa >= faixaMin ? 'ok' : 'baixo' };
}

// Escala da régua da renovação, no placar do perfil e na prévia das metas: as
// três médias (e o resultado, no perfil) com folga dos dois lados, em dezenas,
// dentro de 0 a 100. Com 0 a 100 fixo, Júnior, Pleno e Sênior ficavam um em
// cima do outro no celular.
export function escalaDaRenovacao(valores) {
  const lo = Math.max(0, Math.floor((Math.min(...valores) - 15) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...valores) + 15) / 10) * 10);
  return [lo, hi];
}
