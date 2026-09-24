// Modelo de planilha do Stronilead: o único formato que a importação de
// clientes aceita. TEMPLATE_COLUMNS é a fonte única do cabeçalho: o arquivo
// gerado (importTemplateWrite.js), a conferência do cabeçalho na hora de subir
// e o mapeamento campo → cabeçalho que parseRow recebe saem dela, então o
// modelo e a importação não se desencontram. Puro: sem React, sem Firestore e
// sem ExcelJS.
// Spec: docs/superpowers/specs/2026-09-24-modelo-planilha-importacao-design.md

import { normalize } from './globalSearch.js';

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
