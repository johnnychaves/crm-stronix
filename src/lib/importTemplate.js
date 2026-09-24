// Modelo de planilha do Stronilead: o único formato que a importação de
// clientes aceita. TEMPLATE_COLUMNS é a fonte única do cabeçalho: o arquivo
// gerado (importTemplateWrite.js), a conferência do cabeçalho na hora de subir
// e o mapeamento campo → cabeçalho que parseRow recebe saem dela, então o
// modelo e a importação não se desencontram. Puro: sem React, sem Firestore e
// sem ExcelJS.
// Spec: docs/superpowers/specs/2026-09-24-modelo-planilha-importacao-design.md

import { normalize } from './globalSearch.js';
import { addMonths } from './dates.js';
import { normalizeName } from './clientImport.js';

// Cabeçalho normalizado: minúsculas, sem acento, só letras e números, espaços
// únicos. "Início da vigência *" e "INICIO_DA_VIGENCIA" viram a mesma chave, e
// o asterisco das colunas obrigatórias some.
export const normalizeHeader = (h) =>
  normalize(h).replace(/[^a-z0-9]+/g, ' ').trim();

// kind: 'text' (formato @, o Excel não converte em número), 'date', 'endDate'
// (data igual ou depois do início da mesma linha), 'money' e 'list'. Lista com
// `options` é fixa e travada. Lista com `list` sai do cadastro da academia e
// só avisa, porque aluno antigo pode estar num plano que não se vende mais, e
// a importação acerta o nome na revisão.
export const TEMPLATE_COLUMNS = [
  { field: 'name', header: 'Nome', required: true, kind: 'text', width: 32, note: 'Nome completo do cliente.' },
  { field: 'cpf', header: 'CPF', required: true, kind: 'text', width: 16, note: 'Com ou sem pontos. Preencha o CPF ou o WhatsApp: pelo menos um dos dois é obrigatório.' },
  { field: 'whatsapp', header: 'WhatsApp', required: true, kind: 'text', width: 18, note: 'Com DDD. Preencha o CPF ou o WhatsApp: pelo menos um dos dois é obrigatório.' },
  { field: 'planName', header: 'Plano', required: true, kind: 'list', list: 'planos', width: 26, note: 'Escolha na lista. São os planos cadastrados no Stronilead.' },
  { field: 'contractStartsAt', header: 'Início da vigência', required: true, kind: 'date', width: 16, note: 'Dia em que o contrato atual começou.' },
  { field: 'contractEndsAt', header: 'Fim da vigência', required: true, kind: 'endDate', width: 16, note: 'Dia em que o contrato atual termina.' },
  { field: 'contractValue', header: 'Valor total do contrato', kind: 'money', width: 18, note: 'Valor do contrato inteiro, não da mensalidade. Em branco, vale o valor do plano.' },
  { field: 'contractSituation', header: 'Situação do contrato', kind: 'list', options: ['Ativo', 'Trancado'], width: 18, note: 'Em branco conta como Ativo. Contrato vencido não precisa de marca: a data de fim decide.' },
  { field: 'consultantName', header: 'Consultor', kind: 'list', list: 'equipe', width: 24, note: 'Dono do cliente no Stronilead. Em branco, vai para o consultor padrão escolhido na importação.' },
  { field: 'professorName', header: 'Professor', kind: 'list', list: 'professores', width: 24, note: 'Professor responsável, se houver.' },
  { field: 'email', header: 'E-mail', kind: 'text', width: 28 },
  { field: 'birthDate', header: 'Data de nascimento', kind: 'date', width: 16 },
  { field: 'sexo', header: 'Sexo', kind: 'list', options: ['Masculino', 'Feminino', 'Outro'], width: 12 },
  { field: 'registeredAt', header: 'Cliente desde', kind: 'date', width: 16, note: 'Quando a pessoa entrou na academia pela primeira vez. Pode ficar em branco.' },
  { field: 'dor', header: 'Objetivo', kind: 'text', width: 24 },
  { field: 'vip', header: 'VIP', kind: 'list', options: ['Sim', 'Não'], width: 8 },
  { field: 'rg', header: 'RG', kind: 'text', width: 14 },
  { field: 'addrCep', header: 'CEP', kind: 'text', width: 11 },
  { field: 'addrStreet', header: 'Endereço', kind: 'text', width: 30 },
  { field: 'addrNumber', header: 'Número', kind: 'text', width: 9 },
  { field: 'addrComplement', header: 'Complemento', kind: 'text', width: 16 },
  { field: 'addrNeighborhood', header: 'Bairro', kind: 'text', width: 18 },
  { field: 'addrCity', header: 'Cidade', kind: 'text', width: 18 }
];

// Cabeçalho como sai no arquivo: a obrigatória leva asterisco.
export const templateHeaderLabel = (col) => (col.required ? `${col.header} *` : col.header);

export const NOT_TEMPLATE_MESSAGE = 'Esse arquivo não é o modelo do Stronilead. Baixe o modelo e peça para a academia preencher.';

// O arquivo conta como o modelo com pelo menos 4 das 6 colunas obrigatórias.
// A exportação de outro sistema divide só Nome e CPF com elas e cai em "não é
// o modelo"; o modelo com uma ou duas obrigatórias apagadas ou renomeadas
// ouve qual coluna falta.
const REQUIRED_TO_RECOGNIZE = 4;

const joinList = (items) => new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' }).format(items);

const missingMessage = (missing) => (missing.length === 1
  ? `Falta a coluna ${missing[0]}.`
  : `Faltam as colunas ${joinList(missing)}.`);

// { ok, missing, message }. Ordem, caixa, acento e asterisco não importam;
// coluna opcional apagada não atrapalha.
export const checkTemplateHeaders = (headers) => {
  const present = new Set((headers || []).map(normalizeHeader));
  const required = TEMPLATE_COLUMNS.filter((col) => col.required);
  const missing = required.filter((col) => !present.has(normalizeHeader(col.header))).map((col) => col.header);
  if (required.length - missing.length < REQUIRED_TO_RECOGNIZE) return { ok: false, missing, message: NOT_TEMPLATE_MESSAGE };
  if (missing.length) return { ok: false, missing, message: missingMessage(missing) };
  return { ok: true, missing: [], message: null };
};

// Campo → cabeçalho REAL do arquivo (string exata), ou null. É o formato que
// parseRow (clientImport.js) recebe. Nada é adivinhado: só a tabela vale.
export const templateMapping = (headers) => {
  const byNorm = new Map();
  (headers || []).forEach((h) => {
    const k = normalizeHeader(h);
    if (k && !byNorm.has(k)) byNorm.set(k, h);
  });
  return Object.fromEntries(TEMPLATE_COLUMNS.map((col) => [col.field, byNorm.get(normalizeHeader(col.header)) ?? null]));
};

// ---------------------------------------------------------------------------
// Descrição do arquivo: o que importTemplateWrite.js transforma em .xlsx
// ---------------------------------------------------------------------------

export const TEMPLATE_SHEETS = { CLIENTES: 'Clientes', AJUDA: 'Como preencher', LISTAS: 'Listas' };

// Última linha com formato e validação na aba Clientes (a 1 é o cabeçalho).
// Fica acima da maior academia: o teto de escala é de 2 a 3 mil clientes.
export const TEMPLATE_LAST_ROW = 5001;

// Listas que saem do cadastro da academia e a coluna de cada uma na aba Listas.
const LISTS = {
  planos: { letter: 'A', title: 'Planos' },
  equipe: { letter: 'B', title: 'Equipe' },
  professores: { letter: 'C', title: 'Professores' }
};

const NUMFMT = { text: '@', list: '@', date: 'dd/mm/yyyy', endDate: 'dd/mm/yyyy', money: '"R$" #,##0.00' };

// Limites da data: serial 1 do Excel (que ele mostra como 01/01/1900) a 73415
// (31/12/2100). Na validação de data o ExcelJS converte Date pela hora UTC e
// lê número como milissegundos desde 1970, então os limites vão como Date em
// meia-noite UTC. Na fórmula da coluna Fim eles vão como o próprio serial.
const EXCEL_SERIAL_MIN = 1;
const EXCEL_SERIAL_MAX = 73415;
const EXCEL_DAY_MIN = new Date(Date.UTC(1899, 11, 31));
const EXCEL_DAY_MAX = new Date(Date.UTC(2100, 11, 31));

const ERRORS = {
  date: 'Digite uma data, como 15/03/2026.',
  endDate: 'O fim precisa ser uma data igual ou depois do início, como 15/03/2026.',
  money: 'Digite o valor em número, como 1200,00.',
  fixed: 'Escolha uma opção da lista.',
  loose: 'Esse nome não está na lista. Se continuar, ele é acertado na importação.'
};

// 0 → A, 25 → Z, 26 → AA.
const columnLetter = (i) => (i < 26
  ? String.fromCharCode(65 + i)
  : columnLetter(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));

// Nomes para a lista suspensa: sem vazio, sem repetido pelo nome normalizado
// (a mesma chave com que enrichCandidate casa), aparados e em ordem pt-BR.
// Fica o primeiro que aparecer.
export const uniqueSortedNames = (items) => {
  const seen = new Map();
  (items || []).forEach((x) => {
    const name = String(x?.name ?? '').replace(/\s+/g, ' ').trim();
    const key = normalizeName(name);
    if (key && !seen.has(key)) seen.set(key, name);
  });
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
};

// Validação de dados de uma coluna, no formato do ExcelJS, ou null.
function validationOf(col, letter, startLetter, lists) {
  const base = { allowBlank: true, showErrorMessage: true };
  if (col.kind === 'date') {
    return { ...base, type: 'date', operator: 'between', formulae: [EXCEL_DAY_MIN, EXCEL_DAY_MAX], errorStyle: 'stop', error: ERRORS.date };
  }
  if (col.kind === 'endDate') {
    // Referência relativa à linha 2: o Excel desloca para cada linha do intervalo.
    return { ...base, type: 'custom', formulae: [`AND(ISNUMBER(${letter}2),${letter}2>=${EXCEL_SERIAL_MIN},${letter}2<=${EXCEL_SERIAL_MAX},OR(${startLetter}2="",${letter}2>=${startLetter}2))`], errorStyle: 'stop', error: ERRORS.endDate };
  }
  if (col.kind === 'money') {
    return { ...base, type: 'decimal', operator: 'greaterThanOrEqual', formulae: [0], errorStyle: 'stop', error: ERRORS.money };
  }
  if (col.kind === 'list' && col.options) {
    return { ...base, type: 'list', formulae: [`"${col.options.join(',')}"`], errorStyle: 'stop', error: ERRORS.fixed };
  }
  if (col.kind === 'list' && col.list) {
    const { letter: listLetter, names } = lists[col.list];
    if (!names.length) return null;
    // Aponta para o intervalo da aba Listas: lista escrita dentro da validação
    // tem limite de 255 caracteres no Excel.
    return { ...base, type: 'list', formulae: [`'${TEMPLATE_SHEETS.LISTAS}'!$${listLetter}$2:$${listLetter}$${names.length + 1}`], errorStyle: 'warning', error: ERRORS.loose };
  }
  return null;
}

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDia = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const fileSlug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'academia';

// Aba "Como preencher": linhas de texto e um exemplo com as nove primeiras
// colunas. O exemplo mora nesta aba de propósito: na aba Clientes ele seria
// importado como aluno.
function helpOf({ tenantId, windowDays, now, lists, planos }) {
  const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const plan = lists.planos.names[0] || 'Plano Semestral';
  // A vigência do exemplo segue a duração do plano mostrado, senão um "Anual"
  // apareceria com seis meses.
  const planMonths = Number((planos || []).find((p) => normalizeName(p?.name) === normalizeName(plan))?.durationMonths);
  const end = addMonths(start, planMonths > 0 ? planMonths : 6);
  const consultant = lists.equipe.names[0] || '';
  return {
    lines: [
      { text: 'Modelo de importação de clientes do Stronilead', bold: true },
      { text: `Gerado para ${tenantId || 'a academia'} em ${fmtDia(now)}.` },
      { text: '' },
      { text: 'Quem entra na lista', bold: true },
      { text: `Clientes com contrato ativo, trancados e quem venceu há no máximo ${windowDays} dias. Cancelados e vencidos há mais tempo ficam de fora.` },
      { text: 'Uma linha por cliente, com o contrato atual. Quem tem dois contratos ao mesmo tempo entra com o que termina por último, e o outro é lançado depois na ficha.' },
      { text: '' },
      { text: 'Como preencher', bold: true },
      { text: 'As colunas com cabeçalho laranja são obrigatórias. De CPF e WhatsApp, basta um dos dois.' },
      { text: 'Datas no formato dia/mês/ano, como 15/03/2026.' },
      { text: 'O valor é o total do contrato, não a mensalidade. Em branco, vale o valor do plano no Stronilead.' },
      { text: 'Plano, consultor e professor têm lista. Se o nome não estiver nela, pode digitar: o Excel avisa e o nome é acertado na importação.' },
      { text: 'Pare o mouse sobre o cabeçalho de cada coluna para ver o que vai nela.' },
      { text: 'Não mude o nome das colunas nem a ordem das abas. A aba Clientes precisa continuar sendo a primeira.' },
      { text: '' },
      { text: 'Exemplo (não copie para a aba Clientes)', bold: true }
    ],
    example: {
      headers: TEMPLATE_COLUMNS.slice(0, 9).map(templateHeaderLabel),
      rows: [
        ['Maria Souza', '123.456.789-09', '(71) 99999-0000', plan, fmtDia(start), fmtDia(end), '1.200,00', 'Ativo', consultant],
        ['João Pereira', '', '(71) 98888-1234', plan, fmtDia(start), fmtDia(end), '', 'Trancado', '']
      ]
    }
  };
}

// Tudo que importTemplateWrite.js precisa para montar o .xlsx, a partir do
// que a tela de importação já tem carregado. `now` vem de quem chama.
export function buildTemplateSpec({ planos, users, professores, windowDays, tenantId, now }) {
  const sources = { planos, equipe: users, professores };
  const lists = Object.fromEntries(Object.entries(LISTS).map(([id, meta]) => [id, { ...meta, names: uniqueSortedNames(sources[id]) }]));
  const startLetter = columnLetter(TEMPLATE_COLUMNS.findIndex((c) => c.field === 'contractStartsAt'));
  const columns = TEMPLATE_COLUMNS.map((col, i) => {
    const letter = columnLetter(i);
    return {
      ...col,
      letter,
      label: templateHeaderLabel(col),
      numFmt: NUMFMT[col.kind],
      range: `${letter}2:${letter}${TEMPLATE_LAST_ROW}`,
      validation: validationOf(col, letter, startLetter, lists)
    };
  });
  return {
    fileName: `modelo-stronilead-${fileSlug(tenantId)}-${dayKey(now)}.xlsx`,
    sheets: TEMPLATE_SHEETS,
    columns,
    lists: Object.values(lists),
    help: helpOf({ tenantId, windowDays, now, lists, planos })
  };
}
