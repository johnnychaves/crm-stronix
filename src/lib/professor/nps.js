// NPS do professor a partir dos totais de uma pesquisa
// (stronix_nps_totais: { turma, respostas, porPergunta: { [id]: { soma,
// promotores, neutros, detratores } } }). A nota é a média de 0 a 10 da
// pergunta principal, com duas casas, e a meta é 9 (parâmetro). A porcentagem
// de promotores e o NPS clássico (promotores menos detratores) são só
// informação. A pesquisa vale com 10 respostas ou mais e com pelo menos
// metade da turma.
import { pct } from '../crm/stats.js';

export const RESPOSTAS_MINIMAS = 10;
const dua = (x) => Math.round(x * 100) / 100;
const num = (v) => Number(v) || 0;

// { respostas, turma, valida, perguntas: { [id]: { media, promotores, nps } },
// nota, passa }. Sem validade, nota e passa são null ("sem nota válida").
// A meta compara a nota com duas casas, a mesma que a tela mostra.
export function npsDe(totais, { principalId, meta = 9 } = {}) {
  const respostas = num(totais?.respostas);
  const turma = num(totais?.turma);
  const valida = turma > 0 && respostas >= RESPOSTAS_MINIMAS && respostas * 2 >= turma;
  const perguntas = {};
  Object.entries(totais?.porPergunta || {}).forEach(([id, p]) => {
    perguntas[id] = respostas > 0
      ? {
        media: dua(num(p?.soma) / respostas),
        promotores: pct(num(p?.promotores), respostas),
        nps: Math.round(((num(p?.promotores) - num(p?.detratores)) / respostas) * 100),
      }
      : { media: null, promotores: null, nps: null };
  });
  const nota = valida ? (perguntas[principalId]?.media ?? null) : null;
  return { respostas, turma, valida, perguntas, nota, passa: nota == null ? null : nota >= meta };
}

// A nota do ano: média das notas das pesquisas válidas do ciclo (o resultado
// do npsDe de cada uma). Com uma só válida, vale ela; sem nenhuma, null.
export function npsDoAno(resultados, { meta = 9 } = {}) {
  const notas = (resultados || []).map((r) => r?.nota).filter(Number.isFinite);
  const nota = notas.length ? dua(notas.reduce((a, b) => a + b, 0) / notas.length) : null;
  return { nota, pesquisas: notas.length, passa: nota == null ? null : nota >= meta };
}
