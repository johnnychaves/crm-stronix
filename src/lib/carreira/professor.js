// Os números do professor e do estagiário pela trilha (plano de carreira, PR
// 3). As contas são as de src/lib/professor/; aqui se escolhe o período, a
// janela da renovação, a aderência pela frequência e os ajustes da trilha.
// Puro e sem pacote (carreiraImports.test.js).
import { aderenciaPorSemana, aderenciaResumo, aderenciaSomada } from '../professor/aderencia.js';
import { conversaoDoCiclo, pessoasDasAulas } from '../professor/conversao.js';
import { npsDoCiclo } from '../professor/pesquisas.js';
import { carteiraDoCiclo, renovacaoDoCiclo } from '../professor/renovacao.js';
import { janelaDaRenovacao, pecasDaAderencia, periodoDe, periodoValido } from './periodo.js';
import { nivelDaPessoa } from './trilhas.js';

// O período escolhido, quando a chave vale para a trilha; senão o de agora.
export const periodoDaPessoa = (trilha, chave, agora = new Date()) =>
  (chave ? periodoValido(trilha, chave, agora) : null) ?? periodoDe(trilha, agora);

// O que as telas leem das aulas e das presenças: do início mais antigo ao fim
// mais novo dos períodos. Null sem período.
export function janelaDeLeitura(periodos) {
  const ps = (periodos || []).filter(Boolean);
  if (!ps.length) return null;
  return {
    inicio: new Date(Math.min(...ps.map((p) => p.inicio.getTime()))),
    fim: new Date(Math.max(...ps.map((p) => p.fim.getTime()))),
  };
}

// A aderência pela frequência: semestral soma as semanas do período, anual
// tira a média dos semestres do calendário (decisão 7 do plano).
export function aderenciaDaTrilha(trilha, semanas, periodo, agora = new Date()) {
  const pecas = pecasDaAderencia(periodo);
  return trilha?.frequencia === 'semestral' ? aderenciaSomada(semanas, pecas, agora) : aderenciaResumo(semanas, pecas, agora);
}

// Tudo o que a lista e o perfil mostram de um professor no período, mais os
// `resultados` que o placarDe recebe. A meta do NPS é a do nível de agora;
// sem ela, vale 9, só para o npsDoCiclo calcular (o estado sai do placar).
export function contasDoProfessor({ trilha, periodo, prof, clientes, contratos, planos, aulas, presencas, nps, agora = new Date() }) {
  const ajustes = trilha?.ajustes || {};
  const base = { leads: clientes, contratos, planos, professor: prof, periodo: janelaDaRenovacao(trilha, periodo), asOf: agora };
  const daAula = { aulas, contratos, professorId: prof.id, periodo, asOf: agora, janelaDias: ajustes.janelaDias ?? 30 };
  const semanas = aderenciaPorSemana({ presencas, leads: clientes, contratos, planos, professor: prof, asOf: agora, barra: ajustes.barra ?? 2 });
  const nivel = nivelDaPessoa(prof, trilha);
  const metaNps = nivel ? trilha.numeros?.nps?.metas?.[nivel.id] ?? null : null;
  const renovacao = renovacaoDoCiclo(base);
  const conversao = conversaoDoCiclo(daAula);
  const aderencia = aderenciaDaTrilha(trilha, semanas, periodo, agora);
  const notaDoPeriodo = npsDoCiclo({ pesquisas: nps?.pesquisas, totais: nps?.totais, professorId: prof.id, trilha, chave: periodo.chave, meta: metaNps ?? 9 });
  return {
    renovacao,
    carteira: carteiraDoCiclo(base),
    conversao,
    pessoas: pessoasDasAulas(daAula),
    semanas,
    aderencia,
    nps: notaDoPeriodo,
    metaNps,
    resultados: {
      renovacao: { valor: renovacao.taxa },
      nps: { valor: notaDoPeriodo.nota },
      conversao: { valor: conversao.professor.taxa, academia: conversao.academia.taxa },
      aderencia: { valor: aderencia.taxa },
    },
  };
}
