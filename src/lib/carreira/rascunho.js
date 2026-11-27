// O rascunho de uma trilha no editor de Configurações → Plano de carreira
// (spec 2026-11-26-plano-de-carreira-configuravel, "Configurações → Plano de
// carreira (mockup A)"). Cada operação recebe a trilha no formato do lerTrilha
// e devolve outra, sem mexer na que recebeu. Quem diz o que pode gravar é o
// problemaDaTrilha (validacao.js), que a tela roda a cada mudança e o
// salvarTrilha roda de novo. Puro e sem pacote (carreiraImports.test.js).
import { roleOf, ROLES } from '../acesso.js';
import { AJUSTES, NUMEROS, numerosDaBase } from './numeros.js';
import { mesesDaAvaliacao } from './periodo.js';
import { MAX_NIVEIS, nivelDaPessoa, trilhaDaPessoa } from './trilhas.js';

// A chave de pessoasPorNivel de quem está na trilha sem um nível que exista nela.
export const SEM_NIVEL = '_semNivel';
export const MOTIVO_DO_ARQUIVAR = 'Só dá para arquivar a trilha sem ninguém nela.';
// Arquivar grava a trilha como está no banco, e o rascunho se perderia.
export const MOTIVO_DO_ARQUIVAR_COM_MUDANCA = 'Salve ou descarte as mudanças antes de arquivar.';
// O tempo mínimo que o nível ganha quando deixa de ser o último.
const MESES_DO_NIVEL_NOVO = 12;

export const com = (t, patch) => ({ ...t, ...patch });
const comNumeros = (t, f) => ({
  ...t,
  numeros: Object.fromEntries(Object.entries(t.numeros).map(([id, n]) => [id, f(n, id)])),
});
const metasEmBrancoDe = (niveis) => Object.fromEntries(niveis.map((n) => [n.id, null]));
const numerosNovos = (base, niveis) => Object.fromEntries(
  numerosDaBase(base).map((id) => [id, { ligado: true, metas: metasEmBrancoDe(niveis) }]),
);
function ajustesNovos(base) {
  const out = {};
  Object.entries(AJUSTES).forEach(([k, a]) => {
    if (NUMEROS[a.numero].base === base) out[k] = a.padrao;
  });
  if (base === 'consultor') out.vendasEm = 'reais';
  return out;
}

// Id novo que não colide com os usados: o prefixo e 6 letras ou números
// sorteados. Sorteado, e não sequencial, para duas abas criando trilha ao mesmo
// tempo não gravarem no mesmo campo. O formato serve para o endereço
// (isValidLeadId) e para o caminho do campo no updateDoc.
export function novoId(prefixo, usados = [], aleatorio = Math.random) {
  const ja = new Set(usados);
  for (let tentativa = 0; tentativa < 50; tentativa += 1) {
    const id = `${prefixo}-${Math.floor(aleatorio() * 36 ** 6).toString(36).padStart(6, '0')}`;
    if (!ja.has(id)) return id;
  }
  throw new Error('Não deu para gerar um id novo.');
}

// A trilha nova: um nível, os números da base ligados com metas em branco,
// anual em dezembro e depois da última da lista. O nome nasce vazio, para o
// gestor digitar.
export function novaTrilha(base, trilhas = [], aleatorio = Math.random) {
  const b = base === 'consultor' ? 'consultor' : 'professor';
  const niveis = [{ id: novoId('nivel', [], aleatorio), nome: 'Nível 1', mesesMinimos: null }];
  const ordens = trilhas.map((t) => t.ordem).filter(Number.isFinite);
  return {
    id: novoId('trilha', trilhas.map((t) => t.id), aleatorio),
    nome: '',
    base: b,
    sugestao: { vinculo: 'qualquer', modalidadeIds: [] },
    frequencia: 'anual',
    mes: 12,
    janelaRenovacao: '12meses',
    niveis,
    numeros: numerosNovos(b, niveis),
    ajustes: ajustesNovos(b),
    arquivada: false,
    ordem: ordens.length ? Math.max(...ordens) + 1 : 0,
  };
}

// "+ Nível": "Nível N" no fim, com o primeiro N livre, e metas em branco. O
// nível que deixa de ser o último ganha tempo mínimo. No limite, nada muda.
export function acrescentarNivel(t, aleatorio = Math.random) {
  if (t.niveis.length >= MAX_NIVEIS) return t;
  const nomes = new Set(t.niveis.map((n) => String(n.nome).trim().toLocaleLowerCase('pt-BR')));
  let k = t.niveis.length + 1;
  while (nomes.has(`nível ${k}`)) k += 1;
  const novo = { id: novoId('nivel', t.niveis.map((n) => n.id), aleatorio), nome: `Nível ${k}`, mesesMinimos: null };
  const ultimo = t.niveis.length - 1;
  const niveis = [
    ...t.niveis.map((n, i) => (i === ultimo ? { ...n, mesesMinimos: n.mesesMinimos ?? MESES_DO_NIVEL_NOVO } : n)),
    novo,
  ];
  return comNumeros({ ...t, niveis }, (n) => ({ ...n, metas: { ...n.metas, [novo.id]: null } }));
}

// Tira o nível e as metas dele. O que fica por último perde o tempo mínimo. O
// único nível e o nível que não existe ficam. Quem confere se o nível tem gente
// é o motivoDoApagar (na tela) e o problemaDaTrilha (ao gravar).
export function apagarNivel(t, nivelId) {
  if (t.niveis.length <= 1 || !t.niveis.some((n) => n.id === nivelId)) return t;
  const restantes = t.niveis.filter((n) => n.id !== nivelId);
  const niveis = restantes.map((n, i) => (i === restantes.length - 1 ? { ...n, mesesMinimos: null } : n));
  return comNumeros({ ...t, niveis }, (n) => ({
    ...n,
    metas: Object.fromEntries(Object.entries(n.metas).filter(([id]) => id !== nivelId)),
  }));
}

const comNivel = (t, nivelId, patch) => ({ ...t, niveis: t.niveis.map((n) => (n.id === nivelId ? { ...n, ...patch } : n)) });
export const renomearNivel = (t, nivelId, nome) => comNivel(t, nivelId, { nome });
export const trocarMeses = (t, nivelId, mesesMinimos) => comNivel(t, nivelId, { mesesMinimos });

// Desligar guarda as metas, para ligar de novo devolver o que estava.
export const ligarNumero = (t, numeroId, ligado) => comNumeros(t, (n, id) => (id === numeroId ? { ...n, ligado } : n));
export const trocarMeta = (t, numeroId, nivelId, valor) => comNumeros(t, (n, id) => (id === numeroId ? { ...n, metas: { ...n.metas, [nivelId]: valor } } : n));

export function trocarAjuste(t, chave, valor) {
  const proxima = { ...t, ajustes: { ...t.ajustes, [chave]: valor } };
  if (chave !== 'vendasEm' || valor === t.ajustes?.vendasEm || !t.numeros.vendas) return proxima;
  // Reais e quantidade não se comparam: a meta de um não serve no outro.
  return { ...proxima, numeros: { ...proxima.numeros, vendas: { ...proxima.numeros.vendas, metas: metasEmBrancoDe(t.niveis) } } };
}

// O mês volta ao padrão da frequência: dezembro no anual, junho no semestral.
export const trocarFrequencia = (t, frequencia) => (frequencia === t.frequencia
  ? t
  : { ...t, frequencia, mes: mesesDaAvaliacao({ frequencia })[0] });

// Só sem gente na trilha (a tela trava, e o problemaDaTrilha recusa ao gravar).
export function trocarBase(t, base) {
  if (base === t.base) return t;
  return {
    ...t,
    base,
    sugestao: { vinculo: 'qualquer', modalidadeIds: [] },
    numeros: numerosNovos(base, t.niveis),
    ajustes: ajustesNovos(base),
  };
}

export const trocarSugestao = (t, patch) => ({ ...t, sugestao: { ...t.sugestao, ...patch } });

// Quantas metas dos números ligados estão em branco (a barra de salvar avisa).
export function metasEmBranco(t) {
  return numerosDaBase(t.base).reduce((soma, id) => {
    const n = t.numeros[id];
    return n?.ligado ? soma + t.niveis.filter((nivel) => n.metas[nivel.id] == null).length : soma;
  }, 0);
}

// Quem está em cada nível da trilha: os professores ativos (o sem trilha é da
// Professor) e os usuários com o papel consultor. Quem está na trilha com um
// nível que não existe nela conta em SEM_NIVEL. Chame com a trilha como está
// gravada, para o nível apagado no rascunho continuar contando quem está nele.
export function pessoasPorNivel(trilha, { professores = [], usuarios = [] } = {}) {
  const out = Object.fromEntries(trilha.niveis.map((n) => [n.id, 0]));
  out[SEM_NIVEL] = 0;
  const contar = (p) => {
    const nivel = nivelDaPessoa(p, trilha);
    out[nivel ? nivel.id : SEM_NIVEL] += 1;
  };
  (professores || []).filter((p) => p?.ativo !== false && trilhaDaPessoa(p, [trilha], { professor: true })).forEach(contar);
  (usuarios || []).filter((u) => roleOf(u) === ROLES.CONSULTOR && trilhaDaPessoa(u, [trilha])).forEach(contar);
  return out;
}

export const totalDePessoas = (pessoas) => Object.values(pessoas || {}).reduce((s, n) => s + (Number(n) || 0), 0);

// Por que o nível não pode sair agora, ou null. O texto do nível com gente é o
// mesmo do problemaDaTrilha.
export function motivoDoApagar(t, nivel, pessoas) {
  if (t.niveis.length <= 1) return 'A trilha precisa de pelo menos um nível.';
  if ((Number(pessoas?.[nivel.id]) || 0) > 0) return `${nivel.nome} tem gente. Passe as pessoas para outro nível antes de apagar.`;
  return null;
}

const finitoOu = (v, outro) => (typeof v === 'number' && Number.isFinite(v) ? v : outro);

// O campo trilhas.<id> do documento: o que o lerTrilha lê, sem o id e sem a
// marca de padrão, com os nomes aparados. Meta que não é número vira branco, e
// ajuste que não é número vira o padrão (o problemaDaTrilha já recusou o que
// conta; isto cobre o número desligado). A ordem das chaves é fixa, porque o
// `mudou` compara o texto.
export function trilhaParaGravar(t) {
  const ultimo = t.niveis.length - 1;
  const niveis = t.niveis.map((n, i) => ({
    id: n.id,
    nome: String(n.nome ?? '').trim(),
    mesesMinimos: i === ultimo ? null : n.mesesMinimos,
  }));
  const numeros = Object.fromEntries(numerosDaBase(t.base).map((id) => [id, {
    ligado: t.numeros?.[id]?.ligado === true,
    metas: Object.fromEntries(niveis.map((n) => [n.id, finitoOu(t.numeros?.[id]?.metas?.[n.id], null)])),
  }]));
  const padroes = ajustesNovos(t.base);
  const ajustes = Object.fromEntries(Object.entries(padroes).map(([k, p]) => [
    k, typeof p === 'number' ? finitoOu(t.ajustes?.[k], p) : (t.ajustes?.[k] ?? p),
  ]));
  return {
    nome: String(t.nome ?? '').trim(),
    base: t.base,
    sugestao: { vinculo: t.sugestao?.vinculo ?? 'qualquer', modalidadeIds: [...(t.sugestao?.modalidadeIds ?? [])] },
    frequencia: t.frequencia,
    mes: t.mes,
    janelaRenovacao: t.janelaRenovacao,
    niveis,
    numeros,
    ajustes,
    arquivada: t.arquivada === true,
    ordem: t.ordem,
  };
}

// Se o rascunho difere do que está gravado. A trilha nova (sem gravada) sempre difere.
export const mudou = (rascunho, gravada) => !gravada
  || JSON.stringify(trilhaParaGravar(rascunho)) !== JSON.stringify(trilhaParaGravar(gravada));
