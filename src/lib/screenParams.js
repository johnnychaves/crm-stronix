// Filtro de cada tela no endereço. Tabela única do que cada tela guarda na
// query, a leitura (query para os valores da tela) e a montagem (valores para
// query). Puro de propósito (sem React, sem Firebase, sem window): a tela
// deriva o filtro no render e troca filtro navegando.
//
// Regras que não podem mudar:
// - Ausente é o padrão, e o padrão nunca é escrito. A única exceção é o funil
//   das telas de lista, cujo padrão é de cada pessoa (o último funil usado):
//   omitir faria o mesmo link abrir em funis diferentes para duas pessoas.
// - Valor inválido ou que sumiu cai no padrão, sem aviso e sem erro na tela.
// - Nome, telefone, CPF e texto de busca nunca entram na query (ver routes.js).
// - Nome de parâmetro novo nunca pode ser invite, t ou ref: o App decide o
//   convite e a indicação pública por eles, antes do roteador.
// - O saneamento depende de dado que só a tela tem (usuários, funis, etapas,
//   meses comparáveis, se a pessoa vê o controle). Isso chega no `ctx`, que a
//   tela monta com useMemo e passa no render.

import { CONTRACT_STATUS } from './contracts.js';
import { DAILY_GOAL_CATEGORIES } from './leads.js';
import { SOLO_TRAINING } from './professores.js';
import { addMonthsToKey, compareOptions } from './operacional/month.js';

const own = (obj, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key);

const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DIA_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// Lista separada por vírgula, sem vazio e sem espaço em volta.
const lista = (raw) => String(raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const mesmaLista = (a = [], b = []) => a.length === b.length && a.every((x, i) => x === b[i]);

// Código da situação do contrato mais o sentinela de quem nunca teve contrato.
export const SEM_CONTRATO = 'sem_contrato';
export const SITUACOES = Object.freeze([...Object.values(CONTRACT_STATUS), SEM_CONTRATO]);

// As duas colunas terminais de Todos os leads não são etapa cadastrada, então
// não têm id de documento: viajam por código.
export const FASE_VENDA = 'venda';
export const FASE_PERDA = 'perda';

// Atalho de dia de Aulas e Visitas: código do endereço para o id da tela.
const DIA_POR_CODIGO = Object.freeze({ hoje: 'today', ontem: 'yesterday', amanha: 'tomorrow', andamento: 'ongoing' });
const CODIGO_POR_DIA = Object.freeze(Object.fromEntries(Object.entries(DIA_POR_CODIGO).map(([c, d]) => [d, c])));

// Categoria da Meta diária: os sete slugs do dia, mais a prévia de amanhã.
const CAT_POR_CODIGO = Object.freeze({
  ...Object.fromEntries(Object.values(DAILY_GOAL_CATEGORIES).map((s) => [s, s])),
  amanha: 'tomorrow',
});
const CODIGO_POR_CAT = Object.freeze(Object.fromEntries(Object.entries(CAT_POR_CODIGO).map(([c, v]) => [v, c])));

// Definição de um parâmetro: em que campo da tela ele cai, como se lê um valor
// cru (null quando o nome não está no endereço) e como se escreve de volta
// (null quando é o padrão, ou quando não vale). As duas funções recebem o ctx
// e o que já foi lido nesta passada, porque comparar-com depende do mês.
const param = (campo, ler, escrever) => Object.freeze({ campo, ler, escrever });

const janelaDoMes = (v, ctx) =>
  MES_RE.test(v || '') && v <= ctx.currentKey && v >= addMonthsToKey(ctx.currentKey, -11);

const mes = param(
  'monthKey',
  (raw, ctx) => (janelaDoMes(raw, ctx) ? raw : ctx.currentKey),
  (v, ctx) => (janelaDoMes(v, ctx) && v !== ctx.currentKey ? v : null),
);

const comparar = param(
  'compareOn',
  (raw) => raw !== '0',
  (v) => (v === false ? '0' : null),
);

// Mês da comparação. O Gerencial passa a própria peneira (só mês com venda);
// as outras duas telas usam os doze meses anteriores ao mês exibido.
const mesesComparaveis = (ctx, monthKey) =>
  (typeof ctx.mesesComparaveis === 'function' ? ctx.mesesComparaveis(monthKey) : compareOptions(monthKey)) || [];

// O padrão é sempre o PRIMEIRO da lista de comparáveis: o mês anterior no
// Operacional e no CRM, o mês anterior com venda no Gerencial. Ele não é
// escrito, senão escolher na barra justamente a opção que já estava marcada
// sujaria o endereço com um valor que ninguém mudou.
const compararCom = param(
  'compareKey',
  (raw, ctx, ja) => (mesesComparaveis(ctx, ja.monthKey).includes(raw) ? raw : null),
  (v, ctx, ja) => {
    const opts = mesesComparaveis(ctx, ja.monthKey);
    return v && opts.includes(v) && v !== opts[0] ? v : null;
  },
);

const existe = (fonte, id) => (fonte || []).some((x) => x?.id === id);

const pessoa = param(
  'person',
  (raw, ctx) => (existe(ctx.users, raw) ? raw : 'all'),
  (v, ctx) => (v && v !== 'all' && existe(ctx.users, v) ? v : null),
);

// Funil do recorte do dashboard CRM: "todos" é o padrão, e funil apagado
// também vale "todos".
const funilRecorte = param(
  'funnel',
  (raw, ctx) => (existe(ctx.funis, raw) ? raw : 'all'),
  (v, ctx) => (v && v !== 'all' && existe(ctx.funis, v) ? v : null),
);

// Funil do Pipeline e de Todos os leads. O padrão é o último funil usado por
// esta pessoa, então ele é escrito sempre que vale, para o link querer dizer a
// mesma coisa para quem abrir do outro lado.
const funilDaTela = param(
  'funnel',
  (raw, ctx) => (existe(ctx.funis, raw) ? raw : (ctx.funilPadrao ?? null)),
  (v, ctx) => (existe(ctx.funis, v) ? v : null),
);

// Responsável, nos três estados: ausente é o padrão do papel, vazio é toda a
// equipe, e com ids é a lista escolhida. Quem não vê o controle na tela não é
// recortado por link nenhum.
const resp = param(
  'resp',
  (raw, ctx) => {
    const padrao = ctx.respPadrao || [];
    if (!ctx.podeResp || raw === null) return padrao;
    if (raw === '') return [];
    const ids = lista(raw).filter((id) => existe(ctx.users, id));
    return ids.length ? ids : padrao;
  },
  (v, ctx) => {
    if (!ctx.podeResp) return null;
    const ids = (Array.isArray(v) ? v : []).filter((id) => existe(ctx.users, id));
    return mesmaLista(ids, ctx.respPadrao || []) ? null : ids.join(',');
  },
);

const prof = param(
  'prof',
  (raw, ctx) => {
    if (!ctx.podeResp || !raw) return [];
    const podem = [SOLO_TRAINING, ...(ctx.professores || []).map((p) => p?.id)];
    return lista(raw).filter((id) => podem.includes(id));
  },
  (v, ctx) => {
    if (!ctx.podeResp) return null;
    const podem = [SOLO_TRAINING, ...(ctx.professores || []).map((p) => p?.id)];
    const ids = (Array.isArray(v) ? v : []).filter((id) => podem.includes(id));
    return ids.length ? ids.join(',') : null;
  },
);

const sit = param(
  'status',
  (raw, ctx) => (raw ? lista(raw).filter((s) => (ctx.situacoes || SITUACOES).includes(s)) : []),
  (v, ctx) => {
    const ids = (Array.isArray(v) ? v : []).filter((s) => (ctx.situacoes || SITUACOES).includes(s));
    return ids.length ? ids.join(',') : null;
  },
);

// Fase do funil. A tela guarda o NOME da etapa e o endereço leva o CÓDIGO (o id
// do documento, ou venda e perda nas duas colunas terminais), então renomear a
// etapa não quebra o link.
// A lista de etapas depende do funil, e o funil é lido antes da fase na mesma
// passada. Por isso ctx.etapas pode ser a lista pronta ou uma função que
// recebe o funil escolhido, que é como a tela de Todos os leads passa.
//
// As duas terminais vêm POR ÚLTIMO de propósito. O catálogo de etapas é livre,
// então nada impede uma academia de cadastrar uma etapa chamada "Venda". Na
// tela as duas já são a mesma opção (o filtro guarda o nome), e aqui o mapa de
// escrita é por nome, com o último ganhando: assim esse nome sempre vira o
// código `venda`, que é curto, estável e não muda se a etapa for apagada.
const codigosDeFase = (ctx, ja) => {
  const etapas = typeof ctx.etapas === 'function' ? ctx.etapas(ja?.funnel ?? null) : ctx.etapas;
  const pares = [];
  for (const e of etapas || []) if (e?.id && e?.name) pares.push([e.id, e.name]);
  pares.push([FASE_VENDA, 'Venda'], [FASE_PERDA, 'Perda']);
  return pares;
};

const fase = param(
  'stage',
  (raw, ctx, ja) => {
    if (!raw) return [];
    const por = new Map(codigosDeFase(ctx, ja));
    return lista(raw).filter((c) => por.has(c)).map((c) => por.get(c));
  },
  (v, ctx, ja) => {
    const por = new Map(codigosDeFase(ctx, ja).map(([c, nome]) => [nome, c]));
    const cods = (Array.isArray(v) ? v : []).filter((nome) => por.has(nome)).map((nome) => por.get(nome));
    return cods.length ? cods.join(',') : null;
  },
);

const ligado = (campo, quando = '1') => param(
  campo,
  (raw) => raw === quando,
  (v) => (v === true ? quando : null),
);

const dia = param(
  'day',
  (raw, ctx) => {
    const id = own(DIA_POR_CODIGO, raw) ? DIA_POR_CODIGO[raw] : null;
    if (id === 'ongoing' && !ctx.temAndamento) return 'today';
    return id || 'today';
  },
  (v, ctx) => {
    if (v === 'ongoing' && !ctx.temAndamento) return null;
    return v && v !== 'today' && own(CODIGO_POR_DIA, v) ? CODIGO_POR_DIA[v] : null;
  },
);

const dataDoPeriodo = (campo) => param(
  campo,
  (raw) => (DIA_RE.test(raw || '') ? raw : null),
  (v) => (DIA_RE.test(v || '') ? v : null),
);

const cat = param(
  'cat',
  (raw) => (own(CAT_POR_CODIGO, raw) ? CAT_POR_CODIGO[raw] : 'all'),
  (v) => (v && v !== 'all' && own(CODIGO_POR_CAT, v) ? CODIGO_POR_CAT[v] : null),
);

// Um dia em milissegundos, para o teto de 30 dias do período. As datas são
// lidas em UTC de propósito: só interessa a distância entre elas, e assim o
// horário de verão não muda a conta.
const DIA_MS = 24 * 60 * 60 * 1000;
const emUTC = (s) => {
  const [a, m, d] = s.split('-').map(Number);
  const t = Date.UTC(a, m - 1, d);
  return new Date(t).getUTCDate() === d ? t : NaN;
};

// Regra que cruza dois parâmetros de Aulas e Visitas: o par de datas ganha do
// atalho de dia, e período torto (data que não existe, fim antes do início,
// mais de 30 dias, metade do par) cai fora inteiro, sem erro na tela.
function ajustaPeriodo(valores) {
  const ini = valores.de ? emUTC(valores.de) : NaN;
  const fim = valores.ate ? emUTC(valores.ate) : NaN;
  const vale = Number.isFinite(ini) && Number.isFinite(fim) && fim >= ini && (fim - ini) / DIA_MS <= 30;
  if (!vale) return { ...valores, de: null, ate: null };
  return { ...valores, day: null };
}

// Tabela por tela. A ordem aqui é a ordem no endereço.
const TABELA = {
  dashOperacional: { mes, comparar, 'comparar-com': compararCom, pessoa },
  dashCrm: { mes, comparar, 'comparar-com': compararCom, pessoa, funil: funilRecorte },
  dashGerencial: { mes, comparar, 'comparar-com': compararCom },
  kanban: { funil: funilDaTela, resp, atraso: ligado('overdue') },
  clientes: { sit, resp },
  leads: { funil: funilDaTela, fase, resp, atraso: ligado('overdue'), quente: ligado('hot') },
  aulas: { dia, de: dataDoPeriodo('de'), ate: dataDoPeriodo('ate'), resp, prof },
  visitas: { dia, de: dataDoPeriodo('de'), ate: dataDoPeriodo('ate'), resp },
  dailyGoal: { cat },
};
// O endereço curto /<academia> é a mesma tela do Operacional.
TABELA.dashboard = TABELA.dashOperacional;
Object.freeze(TABELA);

const AJUSTES = Object.freeze({ aulas: ajustaPeriodo, visitas: ajustaPeriodo });

// Os nomes de cada tela, na ordem do endereço. Serve à varredura e ao teste.
export const SCREEN_PARAM_NAMES = Object.freeze(
  Object.fromEntries(Object.entries(TABELA).map(([tela, defs]) => [tela, Object.freeze(Object.keys(defs))])),
);

// Valores da tela a partir da query. Tela sem filtro devolve objeto vazio.
export function readScreenParams(screen, search, ctx = {}) {
  const defs = own(TABELA, screen) ? TABELA[screen] : null;
  if (!defs) return {};
  const q = new URLSearchParams(typeof search === 'string' ? search : '');
  const out = {};
  for (const [nome, def] of Object.entries(defs)) {
    out[def.campo] = def.ler(q.has(nome) ? q.get(nome) : null, ctx, out);
  }
  return own(AJUSTES, screen) ? AJUSTES[screen](out, ctx) : out;
}

// A vírgula separa lista e fica legível no endereço; o resto é codificado.
const escapa = (s) => encodeURIComponent(String(s)).replace(/%2C/g, ',');

// Query a partir dos valores da tela, na ordem da tabela e sem o que é padrão.
// Devolve '' ou '?a=b&c=d', pronto para colar depois do caminho.
export function screenParamsQuery(screen, valores, ctx = {}) {
  const defs = own(TABELA, screen) ? TABELA[screen] : null;
  if (!defs) return '';
  const v = valores || {};
  const partes = [];
  for (const [nome, def] of Object.entries(defs)) {
    const escrito = def.escrever(v[def.campo], ctx, v);
    if (escrito !== null && escrito !== undefined) partes.push(`${nome}=${escapa(escrito)}`);
  }
  return partes.length ? `?${partes.join('&')}` : '';
}

// O funil que uma tela de lista está mostrando, do endereço ou do último funil
// usado. É o único pedaço do filtro que faz sentido fora da tela: o App precisa
// dele para o cadastro rápido nascer no mesmo funil do quadro. Sem isso, abrir
// /leads?funil=<outro> por link e clicar em "Novo lead" cadastraria no funil
// de antes, porque o localStorage só muda quando alguém clica na aba de funil.
export function funnelFromSearch(screen, search, ctx = {}) {
  const defs = own(TABELA, screen) ? TABELA[screen] : null;
  if (!defs || defs.funil !== funilDaTela) return ctx.funilPadrao ?? null;
  const q = new URLSearchParams(typeof search === 'string' ? search : '');
  return funilDaTela.ler(q.has('funil') ? q.get('funil') : null, ctx);
}
