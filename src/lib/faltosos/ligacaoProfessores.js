// Ligação dos professores da Next Fit com o cadastro de professores
// (stronix_professores, campos `nome` e `ativo`). A ligação fica em
// stronix_config/faltosos, no campo professorLinks, como lista
// [{ nome, professorId | null }]: lista, e não mapa, porque o nome tem espaço e
// acento. professorId null quer dizer "Sem professor": o aluno fica com o
// gestor e não entra na Meta de ninguém.
//
// Puro. A Next Fit corta o nome do professor em 29 caracteres
// (levantamento), por isso a sugestão aceita o começo do nome.
// Spec: docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md ("A ligação dos professores").
import { nomeChave, palavrasDoNome } from './ligacaoAlunos.js';
import { isActiveProfessor } from '../teamRoles.js';

// Tamanho em que a Next Fit corta o nome do professor.
export const CORTE_DO_NOME = 29;

// A sugestão para um nome novo, entre os professores ativos: o de nome igual;
// senão o único cujo nome começa com o texto da Next Fit (inteiro até um
// espaço, ou cortado no meio da palavra quando o texto tem o tamanho do
// corte); senão o único com mais palavras em comum, desde que sejam pelo menos
// duas, sem contar "de", "da", "do", "das", "dos" e "e". Empate ou nada
// parecido: null, e o gestor escolhe.
export function sugerirProfessor(nomeNextFit, professores) {
  const alvo = nomeChave(nomeNextFit);
  if (!alvo) return null;
  const cortado = String(nomeNextFit ?? '').trim().length >= CORTE_DO_NOME;
  const ativos = (professores || [])
    .filter((p) => p?.id && isActiveProfessor(p))
    .map((p) => ({ id: p.id, chave: nomeChave(p.nome) }))
    .filter((p) => p.chave);

  const iguais = ativos.filter((p) => p.chave === alvo);
  if (iguais.length) return iguais.length === 1 ? iguais[0].id : null;

  const comecam = ativos.filter((p) => p.chave.startsWith(`${alvo} `) || (cortado && p.chave.startsWith(alvo)));
  if (comecam.length) return comecam.length === 1 ? comecam[0].id : null;

  const doAlvo = palavrasDoNome(alvo);
  const pontos = ativos
    .map((p) => ({ id: p.id, n: [...palavrasDoNome(p.chave)].filter((w) => doAlvo.has(w)).length }))
    .filter((p) => p.n >= 2);
  if (!pontos.length) return null;
  const max = Math.max(...pontos.map((p) => p.n));
  const melhores = pontos.filter((p) => p.n === max);
  return melhores.length === 1 ? melhores[0].id : null;
}

// A lista que vale: nome com texto (espaços juntados), professorId texto ou
// null, um item por nome (pela chave; a última escolha ganha), em ordem de
// nome. O que não é lista vira lista vazia. É a leitura de professorLinks em
// todo lugar: a importação, a configuração (configFaltosos.js) e o bloco de
// Configurações.
export function normalizarProfessorLinks(raw) {
  if (!Array.isArray(raw)) return [];
  const porChave = new Map();
  for (const item of raw) {
    const nome = typeof item?.nome === 'string' ? item.nome.replace(/\s+/g, ' ').trim() : '';
    const chave = nomeChave(nome);
    if (!chave) continue;
    const professorId = typeof item.professorId === 'string' && item.professorId ? item.professorId : null;
    porChave.set(chave, { nome, professorId });
  }
  return [...porChave.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

// As ligações guardadas mais as escolhas do passo curto (as escolhas ganham).
export const juntarProfessorLinks = (atuais, escolhas) => normalizarProfessorLinks([...(atuais || []), ...(escolhas || [])]);

// O professor da linha: o professorId ligado, null para "Sem professor" (ou
// professor vazio na Next Fit) e undefined para nome que ainda não foi ligado.
export function professorDaLinha(nomeNextFit, ligacoes) {
  const chave = nomeChave(nomeNextFit);
  if (!chave) return null;
  const link = (ligacoes || []).find((l) => nomeChave(l?.nome) === chave);
  if (!link) return undefined;
  return typeof link.professorId === 'string' && link.professorId ? link.professorId : null;
}

// Os nomes de professor do arquivo que ainda não têm ligação, para o passo
// curto: [{ nome, alunos, sugestao }], de quem tem mais alunos para quem tem
// menos.
export function professoresNovos(linhas, ligacoes, professores) {
  const porChave = new Map();
  for (const l of linhas || []) {
    const nome = String(l?.professorNextFit ?? '').replace(/\s+/g, ' ').trim();
    if (!nome || professorDaLinha(nome, ligacoes) !== undefined) continue;
    const chave = nomeChave(nome);
    const item = porChave.get(chave);
    if (item) item.alunos += 1;
    else porChave.set(chave, { nome, alunos: 1 });
  }
  return [...porChave.values()]
    .map((x) => ({ ...x, sugestao: sugerirProfessor(x.nome, professores) }))
    .sort((a, b) => b.alunos - a.alunos || a.nome.localeCompare(b.nome, 'pt-BR'));
}
