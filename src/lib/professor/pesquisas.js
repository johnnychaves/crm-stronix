// A pesquisa de NPS dos alunos (spec 2026-11-24-perfil-do-professor, plano do
// PR 4). Início e fim são o dia inteiro, em texto 'AAAA-MM-DD', sem fuso: o
// navegador compara com o dia local e o servidor, com o dia de Brasília. A
// situação gravada só muda pelo gestor, e a pesquisa aberta cujo fim passou
// conta como encerrada sem ninguém gravar nada.
import { cicloDe } from './ciclo.js';
import { carteiraAt } from './carteira.js';
import { npsDe, npsDoAno, RESPOSTAS_MINIMAS } from './nps.js';
import { pct } from '../crm/stats.js';

export const PERGUNTA_PRINCIPAL_PADRAO = 'De 0 a 10, quanto você recomendaria o professor a um amigo?';
export const MAX_PERGUNTAS = 5;

// Date local do dia 'AAAA-MM-DD', ou null quando o texto não é um dia que existe.
function diaDe(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto || '')) return null;
  const [a, m, d] = texto.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  return dt.getFullYear() === a && dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null;
}

// Os ciclos que a pesquisa pode contar: o do ano do início (o padrão, a de
// dezembro de 2027 conta para o ciclo de 2027) e o ciclo em que o início cai.
export function ciclosDaPesquisa(inicio) {
  const d = diaDe(inicio);
  return d ? [...new Set([d.getFullYear(), cicloDe(d)])] : [];
}

export const novaPesquisa = () => ({
  nome: '',
  inicio: '',
  fim: '',
  ciclo: null,
  perguntas: [{ texto: PERGUNTA_PRINCIPAL_PADRAO, principal: true }],
});

// { campo, texto } do primeiro problema do formulário, ou null.
export function problemaDaPesquisa(f) {
  if (!String(f?.nome || '').trim()) return { campo: 'nome', texto: 'Dê um nome à pesquisa.' };
  if (!diaDe(f.inicio)) return { campo: 'inicio', texto: 'Escolha o dia em que a pesquisa começa.' };
  if (!diaDe(f.fim)) return { campo: 'fim', texto: 'Escolha o dia em que a pesquisa termina.' };
  if (f.fim < f.inicio) return { campo: 'fim', texto: 'O fim vem antes do começo.' };
  if (!ciclosDaPesquisa(f.inicio).includes(f.ciclo)) return { campo: 'ciclo', texto: 'Escolha o ciclo da pesquisa.' };
  const perguntas = f.perguntas || [];
  if (perguntas.length < 1 || perguntas.length > MAX_PERGUNTAS) return { campo: 'perguntas', texto: 'A pesquisa tem de 1 a 5 perguntas.' };
  const vazia = perguntas.findIndex((p) => !String(p?.texto || '').trim());
  if (vazia >= 0) return { campo: `pergunta-${vazia}`, texto: `Escreva a pergunta ${vazia + 1} ou tire ela.` };
  if (perguntas.filter((p) => p.principal).length !== 1) return { campo: 'perguntas', texto: 'Marque uma pergunta como principal.' };
  return null;
}

// O que vai para o banco. As perguntas ganham o id pela posição: elas só mudam
// em rascunho, antes de qualquer resposta, então o id fica estável depois de
// aberta.
export function paraGravar(f) {
  return {
    nome: f.nome.trim(),
    inicio: f.inicio,
    fim: f.fim,
    ciclo: f.ciclo,
    perguntas: f.perguntas.map((p, i) => ({ id: `p${i + 1}`, texto: p.texto.trim(), principal: Boolean(p.principal) })),
  };
}

export const principalDe = (pesquisa) => (pesquisa?.perguntas || []).find((q) => q.principal) ?? null;

// 'rascunho', 'aberta' ou 'encerrada', pelo dia `hoje` ('AAAA-MM-DD').
export function estadoDaPesquisa(p, hoje) {
  if (p?.situacao === 'encerrada') return 'encerrada';
  if (p?.situacao === 'aberta') return p.fim && hoje > p.fim ? 'encerrada' : 'aberta';
  return 'rascunho';
}

// Aberta antes do início, a pesquisa ainda não recebe resposta.
export const recebeRespostas = (p, hoje) => estadoDaPesquisa(p, hoje) === 'aberta' && hoje >= p.inicio;

// Só uma fica aberta por vez; a vencida não conta.
export const pesquisaEmCurso = (pesquisas, hoje) =>
  (pesquisas || []).find((p) => estadoDaPesquisa(p, hoje) === 'aberta') ?? null;

// A turma de cada professor ativo no instante de abrir: a carteira com contrato
// em vigor (o trancado fica fora). Professor sem aluno não entra.
export function turmasDoDia({ clientes, contratos, planos, professores, agora }) {
  const turmas = {};
  (professores || []).forEach((professor) => {
    if (!professor?.id || professor.ativo === false) return;
    const n = carteiraAt({ leads: clientes, contratos, planos, professor, data: agora })
      .filter((a) => a.estado === 'vigente').length;
    if (n > 0) turmas[professor.id] = n;
  });
  return turmas;
}

// Quanto falta para a nota da turma valer (10 respostas e metade da turma).
// A turma de menos de 10 alunos nunca vale.
export function progressoDaTurma(turma, respostas) {
  const t = Number(turma) || 0;
  const r = Number(respostas) || 0;
  const precisa = Math.max(RESPOSTAS_MINIMAS, Math.ceil(t / 2));
  return { pct: pct(r, t) ?? 0, vale: t > 0 && r >= precisa, faltam: Math.max(0, precisa - r), nuncaVale: t < RESPOSTAS_MINIMAS };
}

// O NPS do professor no ciclo: as pesquisas do ciclo que já abriram e têm turma
// dele, cada uma com o npsDe (a turma é a da pesquisa), a nota do ano e a
// porcentagem de promotores da principal, somada das pesquisas válidas.
// `totais` é a lista de stronix_nps_totais ({ pesquisaId, professorId, ... }).
export function npsDoCiclo({ pesquisas, totais, professorId, ciclo, meta = 9 }) {
  const porId = new Map((totais || []).map((t) => [`${t.pesquisaId}_${t.professorId}`, t]));
  const itens = (pesquisas || [])
    .filter((p) => p.ciclo === ciclo && p.situacao !== 'rascunho' && Number(p.turmas?.[professorId]) > 0)
    .sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)))
    .map((pesquisa) => {
      const t = porId.get(`${pesquisa.id}_${professorId}`) ?? null;
      const resultado = npsDe({ ...t, turma: pesquisa.turmas[professorId] }, { principalId: principalDe(pesquisa)?.id, meta });
      return { pesquisa, totais: t, resultado };
    });
  let promotores = 0;
  let respostas = 0;
  itens.forEach(({ pesquisa, totais: t, resultado }) => {
    if (!resultado.valida) return;
    promotores += Number(t?.porPergunta?.[principalDe(pesquisa)?.id]?.promotores) || 0;
    respostas += resultado.respostas;
  });
  return { itens, ...npsDoAno(itens.map((i) => i.resultado), { meta }), promotores: pct(promotores, respostas) };
}

// A pesquisa em curso com as respostas e a turma de todos os professores, para
// o cartão da lista de professores. Null sem pesquisa aberta.
export function resumoDaPesquisa(pesquisas, totais, hoje) {
  const pesquisa = pesquisaEmCurso(pesquisas, hoje);
  if (!pesquisa) return null;
  const respostas = (totais || []).filter((t) => t.pesquisaId === pesquisa.id).reduce((a, t) => a + (Number(t.respostas) || 0), 0);
  const turma = Object.values(pesquisa.turmas || {}).reduce((a, n) => a + (Number(n) || 0), 0);
  return { pesquisa, respostas, turma };
}
