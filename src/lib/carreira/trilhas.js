// As trilhas do plano de carreira (spec 2026-11-26-plano-de-carreira-
// configuravel, "As trilhas"). Moram em stronix_config/carreira, no campo
// `trilhas`, um mapa por id. As três padrão moram aqui, com ids fixos, e a
// gravada com o mesmo id vence a daqui. Enquanto a Professor não foi gravada,
// ela lê as metas de hoje do topo do mesmo documento (metasDe). A leitura é
// tolerante, como o metasDe: campo fora do formato vale o padrão, para um
// documento velho não derrubar a tela. Quem confere o que o gestor digita é o
// problemaDaTrilha (validacao.js).
import { metasDe } from '../professor/metas.js';
import { AJUSTES, metaValida, NUMEROS, numerosDaBase, VENDAS_EM } from './numeros.js';
import { mesesDaAvaliacao } from './periodo.js';

export const MAX_NIVEIS = 6;
export const MESES_MAX = 120;
export const TRILHA_PROFESSOR = 'professor';
export const TRILHA_ESTAGIARIO = 'estagiario';
export const TRILHA_CONSULTOR = 'consultor';
export const VINCULOS = Object.freeze(['qualquer', 'formado', 'estagio']);

const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const porNivel = (niveis, f) => Object.fromEntries(niveis.map((n) => [n.id, f(n)]));

const NIVEIS_PROFESSOR = [
  { id: 'junior', nome: 'Júnior', mesesMinimos: 12 },
  { id: 'pleno', nome: 'Pleno', mesesMinimos: 24 },
  { id: 'senior', nome: 'Sênior', mesesMinimos: null },
];
const NIVEIS_ESTAGIARIO = [
  { id: 'estagiario1', nome: 'Estagiário I', mesesMinimos: 6 },
  { id: 'estagiario2', nome: 'Estagiário II', mesesMinimos: 6 },
  { id: 'estagiario3', nome: 'Estagiário III', mesesMinimos: null },
];

// A trilha Professor a partir das metas de hoje (o resultado do metasDe). A
// tolerância da conversão vira pontos negativos: 3 de folga é "academia − 3".
export function professorDasMetas(m) {
  const pontos = m.conversao.tolerancia ? -m.conversao.tolerancia : 0;
  return {
    id: TRILHA_PROFESSOR,
    nome: 'Professor',
    base: 'professor',
    sugestao: { vinculo: 'formado', modalidadeIds: [] },
    frequencia: 'anual',
    mes: 12,
    janelaRenovacao: '12meses',
    niveis: NIVEIS_PROFESSOR.map((n) => ({ ...n })),
    numeros: {
      renovacao: { ligado: true, metas: porNivel(NIVEIS_PROFESSOR, (n) => m.renovacao[n.id]) },
      nps: { ligado: true, metas: porNivel(NIVEIS_PROFESSOR, () => m.nps.meta) },
      conversao: { ligado: true, metas: porNivel(NIVEIS_PROFESSOR, () => pontos) },
      aderencia: { ligado: true, metas: porNivel(NIVEIS_PROFESSOR, () => m.aderencia.faixaMin) },
    },
    ajustes: { janelaDias: m.conversao.janelaDias, barra: m.aderencia.barra, faixaMax: m.aderencia.faixaMax },
    arquivada: false,
    ordem: 0,
  };
}

const ESTAGIARIO = {
  nome: 'Estagiário',
  base: 'professor',
  sugestao: { vinculo: 'estagio', modalidadeIds: [] },
  frequencia: 'semestral',
  mes: 6,
  janelaRenovacao: '12meses',
  niveis: NIVEIS_ESTAGIARIO,
  numeros: {
    renovacao: { ligado: true, metas: porNivel(NIVEIS_ESTAGIARIO, () => 45) },
    nps: { ligado: true, metas: porNivel(NIVEIS_ESTAGIARIO, () => 9) },
    conversao: { ligado: true, metas: porNivel(NIVEIS_ESTAGIARIO, () => 0) },
    aderencia: { ligado: true, metas: porNivel(NIVEIS_ESTAGIARIO, () => 60) },
  },
  ajustes: { janelaDias: 30, barra: 2, faixaMax: 70 },
  ordem: 1,
};

const CONSULTOR = {
  nome: 'Consultor',
  base: 'consultor',
  sugestao: { vinculo: 'qualquer', modalidadeIds: [] },
  frequencia: 'anual',
  mes: 12,
  niveis: NIVEIS_PROFESSOR,
  numeros: Object.fromEntries(numerosDaBase('consultor').map((id) => [id, { ligado: true, metas: porNivel(NIVEIS_PROFESSOR, () => null) }])),
  ajustes: { vendasEm: 'reais' },
  ordem: 2,
};

// Uma trilha gravada no formato que as telas usam, sempre com objetos novos,
// ou null quando ela não tem como ser usada (nenhum nível com id e nome).
export function lerTrilha(raw, id) {
  if (!raw || typeof raw !== 'object') return null;
  const lidos = (Array.isArray(raw.niveis) ? raw.niveis : []).filter((n) => texto(n?.id) && texto(n?.nome)).slice(0, MAX_NIVEIS);
  if (!lidos.length) return null;
  const niveis = lidos.map((n, i) => ({
    id: texto(n.id),
    nome: texto(n.nome),
    mesesMinimos: i === lidos.length - 1 ? null
      : (Number.isInteger(n.mesesMinimos) && n.mesesMinimos >= 1 && n.mesesMinimos <= MESES_MAX ? n.mesesMinimos : 12),
  }));
  const base = raw.base === 'consultor' ? 'consultor' : 'professor';
  const frequencia = raw.frequencia === 'semestral' ? 'semestral' : 'anual';
  const numeros = Object.fromEntries(numerosDaBase(base).map((nid) => {
    const r = raw.numeros?.[nid];
    return [nid, {
      ligado: r?.ligado === true,
      metas: porNivel(niveis, (n) => (metaValida(nid, r?.metas?.[n.id]) ? r.metas[n.id] : null)),
    }];
  }));
  const ajustes = {};
  Object.entries(AJUSTES).forEach(([k, a]) => {
    if (NUMEROS[a.numero].base !== base) return;
    const v = raw.ajustes?.[k];
    ajustes[k] = typeof v === 'number' && Number.isFinite(v) && v >= a.min && v <= a.max ? v : a.padrao;
  });
  if (base === 'consultor') ajustes.vendasEm = VENDAS_EM.includes(raw.ajustes?.vendasEm) ? raw.ajustes.vendasEm : 'reais';
  return {
    id,
    nome: texto(raw.nome) || id,
    base,
    sugestao: {
      vinculo: VINCULOS.includes(raw.sugestao?.vinculo) ? raw.sugestao.vinculo : 'qualquer',
      modalidadeIds: (Array.isArray(raw.sugestao?.modalidadeIds) ? raw.sugestao.modalidadeIds : []).filter((m) => typeof m === 'string'),
    },
    frequencia,
    mes: mesesDaAvaliacao({ frequencia, mes: raw.mes })[0],
    janelaRenovacao: raw.janelaRenovacao === 'periodo' ? 'periodo' : '12meses',
    niveis,
    numeros,
    ajustes,
    arquivada: raw.arquivada === true,
    ordem: Number.isFinite(raw.ordem) ? raw.ordem : 99,
  };
}

// Todas as trilhas da academia, as arquivadas inclusive (com `arquivada`), na
// ordem da lista. `padrao` marca as três que vêm prontas.
export function trilhasDe(doc) {
  const gravadas = doc?.trilhas && typeof doc.trilhas === 'object' ? doc.trilhas : {};
  const padroes = {
    [TRILHA_PROFESSOR]: professorDasMetas(metasDe(doc)),
    [TRILHA_ESTAGIARIO]: ESTAGIARIO,
    [TRILHA_CONSULTOR]: CONSULTOR,
  };
  const lista = [];
  new Set([...Object.keys(padroes), ...Object.keys(gravadas)]).forEach((id) => {
    const t = lerTrilha(gravadas[id], id) ?? (padroes[id] ? lerTrilha(padroes[id], id) : null);
    if (t) lista.push({ ...t, padrao: Boolean(padroes[id]) });
  });
  return lista.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));
}

// A trilha de uma pessoa: a gravada no cadastro (trilhaId), ou a Professor
// para o professor sem trilha. O consultor sem trilha fica sem. A trilha
// arquivada continua valendo para quem está nela.
export function trilhaDaPessoa(pessoa, trilhas, { professor = false } = {}) {
  const id = texto(pessoa?.trilhaId) || (professor ? TRILHA_PROFESSOR : '');
  return (trilhas || []).find((t) => t.id === id) ?? null;
}

// O nível da pessoa na trilha, ou null ("sem nível").
export const nivelDaPessoa = (pessoa, trilha) => (trilha?.niveis || []).find((n) => n.id === pessoa?.nivel) ?? null;

// O nível seguinte, ou null no último nível e no nível que não existe.
export function proximoNivel(trilha, nivelId) {
  const niveis = trilha?.niveis || [];
  const i = niveis.findIndex((n) => n.id === nivelId);
  return i >= 0 ? niveis[i + 1] ?? null : null;
}

// A trilha que o sistema sugere: entre as não arquivadas da base da pessoa, a
// primeira na ordem da lista cujo vínculo combina e, no professor, cujas
// modalidades cruzam com as dele (trilha sem modalidade serve para todas).
// Vínculo Estágio quer as trilhas de estágio; qualquer outro vínculo, e o
// vínculo desconhecido (o cadastro da equipe ainda não está no ar), quer as
// de formado. As de vínculo "qualquer" servem para todos.
export function trilhaSugerida({ base, vinculo = null, modalidadeIds = [] }, trilhas) {
  const quer = vinculo === 'estagio' ? 'estagio' : 'formado';
  const mods = Array.isArray(modalidadeIds) ? modalidadeIds : [];
  return (trilhas || []).find((t) => !t.arquivada && t.base === base
    && (t.sugestao.vinculo === 'qualquer' || t.sugestao.vinculo === quer)
    && (base !== 'professor' || !t.sugestao.modalidadeIds.length || t.sugestao.modalidadeIds.some((m) => mods.includes(m)))) ?? null;
}
