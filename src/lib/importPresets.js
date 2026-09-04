// Presets de importação por sistema de origem (NextFit hoje; Pacto, Evo, SCA e
// Tecnofit entram conforme a primeira exportação de cada um chegar) e o chute
// inicial do mapeamento manual. Puro: sem React, sem Firestore.
// Spec: docs/superpowers/specs/2026-09-03-importacao-clientes-design.md
//
// Um preset é assinatura + colunas. A assinatura é o conjunto mínimo de
// cabeçalhos (normalizados) que identifica o sistema; as colunas dizem qual
// cabeçalho alimenta cada campo do Stronilead. O que nenhum preset reconhece
// cai no chute por sinônimo, e o que sobrar o gestor mapeia na tela.

import { normalize } from './globalSearch.js';

// Cabeçalho normalizado: minúsculas, sem acento, só letras e números, espaços
// únicos. "Situação do contrato" e "SITUACAO_DO_CONTRATO" viram a mesma chave.
export const normalizeHeader = (h) =>
  normalize(h).replace(/[^a-z0-9]+/g, ' ').trim();

// Campos-alvo do importador. `group` só organiza a tela de mapeamento.
export const TARGET_FIELDS = [
  { id: 'name', label: 'Nome', group: 'pessoa', required: true },
  { id: 'whatsapp', label: 'Telefone / WhatsApp', group: 'pessoa' },
  { id: 'cpf', label: 'CPF', group: 'pessoa' },
  { id: 'email', label: 'E-mail', group: 'pessoa' },
  { id: 'rg', label: 'RG', group: 'pessoa' },
  { id: 'birthDate', label: 'Data de nascimento', group: 'pessoa' },
  { id: 'sexo', label: 'Sexo', group: 'pessoa' },
  { id: 'dor', label: 'Objetivo', group: 'pessoa' },
  { id: 'vip', label: 'VIP', group: 'pessoa' },
  { id: 'registeredAt', label: 'Data de cadastro', group: 'pessoa' },
  { id: 'consultantName', label: 'Consultor', group: 'pessoa' },
  { id: 'professorName', label: 'Professor', group: 'pessoa' },
  { id: 'addrStreet', label: 'Endereço (rua)', group: 'endereco' },
  { id: 'addrNumber', label: 'Número', group: 'endereco' },
  { id: 'addrComplement', label: 'Complemento', group: 'endereco' },
  { id: 'addrNeighborhood', label: 'Bairro', group: 'endereco' },
  { id: 'addrCep', label: 'CEP', group: 'endereco' },
  { id: 'addrCity', label: 'Cidade', group: 'endereco' },
  { id: 'planName', label: 'Plano / contrato', group: 'contrato' },
  { id: 'contractSituation', label: 'Situação do contrato', group: 'contrato' },
  { id: 'clientSituation', label: 'Situação do cliente', group: 'contrato' },
  { id: 'contractStartsAt', label: 'Início da vigência', group: 'contrato' },
  { id: 'contractEndsAt', label: 'Fim da vigência', group: 'contrato' },
  { id: 'contractValue', label: 'Valor', group: 'contrato' }
];

export const TARGET_GROUP_LABEL = { pessoa: 'Pessoa', endereco: 'Endereço', contrato: 'Contrato' };

// Sinônimos (já normalizados) por campo. Alimentam o chute do mapeamento manual
// e cobrem coluna faltando num preset. A ordem dentro de cada lista é a
// preferência.
const ALIASES = {
  name: ['nome', 'nome completo', 'aluno', 'cliente', 'nome do aluno', 'nome do cliente'],
  whatsapp: ['telefone', 'celular', 'whatsapp', 'fone', 'telefone celular', 'tel'],
  cpf: ['cpf', 'cpf cnpj', 'documento'],
  email: ['e mail', 'email'],
  rg: ['rg', 'identidade'],
  birthDate: ['data de nascimento', 'nascimento', 'dt nascimento', 'data nascimento', 'aniversario'],
  sexo: ['sexo', 'genero'],
  dor: ['objetivo', 'objetivos', 'dor', 'meta'],
  vip: ['vip'],
  registeredAt: ['data de cadastro', 'cadastro', 'dt cadastro', 'data cadastro', 'cadastrado em', 'data de entrada'],
  consultantName: ['consultor', 'vendedor', 'consultor responsavel', 'responsavel'],
  professorName: ['professor', 'instrutor', 'personal', 'treinador'],
  addrStreet: ['endereco', 'logradouro', 'rua', 'endereco rua'],
  addrNumber: ['numero', 'num', 'n'],
  addrComplement: ['complemento'],
  addrNeighborhood: ['bairro'],
  addrCep: ['cep'],
  addrCity: ['cidade', 'municipio'],
  planName: ['contrato', 'plano', 'nome do plano', 'nome do contrato', 'produto'],
  contractSituation: ['situacao do contrato', 'status do contrato', 'situacao contrato', 'status contrato', 'situacao'],
  clientSituation: ['situacao do cliente', 'status do cliente', 'situacao cliente', 'status cliente', 'status do aluno', 'situacao do aluno'],
  contractStartsAt: ['data de inicio', 'inicio', 'data inicio', 'inicio do contrato', 'inicio da vigencia', 'vigencia inicio', 'data inicial', 'dt inicio'],
  contractEndsAt: ['data de fim', 'fim', 'data fim', 'vencimento', 'data de vencimento', 'termino', 'data de termino', 'fim do contrato', 'fim da vigencia', 'vigencia fim', 'validade', 'data final', 'dt fim', 'dt vencimento'],
  contractValue: ['valor', 'valor do contrato', 'valor pago', 'mensalidade', 'valor total', 'preco']
};

export const IMPORT_PRESETS = [
  {
    id: 'nextfit',
    label: 'NextFit',
    // Cinco cabeçalhos que, juntos, só a exportação de cadastro do NextFit tem.
    signature: ['nome', 'cpf', 'situacao do contrato', 'situacao do cliente', 'data de cadastro'],
    columns: {
      name: 'Nome',
      email: 'E-mail',
      planName: 'Contrato',
      whatsapp: 'Telefone',
      contractSituation: 'Situação do contrato',
      clientSituation: 'Situação do cliente',
      cpf: 'CPF',
      rg: 'RG',
      birthDate: 'Data de nascimento',
      registeredAt: 'Data de cadastro',
      dor: 'Objetivo',
      sexo: 'Sexo',
      vip: 'VIP',
      addrStreet: 'Endereco',
      addrNumber: 'Número',
      addrNeighborhood: 'Bairro',
      addrCep: 'Cep',
      addrCity: 'Cidade',
      addrComplement: 'Complemento',
      consultantName: 'Consultor',
      professorName: 'Professor'
    }
  }
];

export const detectPreset = (headers) => {
  const set = new Set((headers || []).map(normalizeHeader));
  return IMPORT_PRESETS.find((p) => p.signature.every((s) => set.has(s))) || null;
};

// Mapa campo-alvo → cabeçalho REAL do arquivo (string exata), ou null. Primeiro
// as colunas do preset, depois o chute por sinônimo para o que ficou vazio. Um
// cabeçalho nunca alimenta dois campos.
export const buildMapping = (headers, preset) => {
  const byNorm = new Map();
  (headers || []).forEach((h) => { const k = normalizeHeader(h); if (k && !byNorm.has(k)) byNorm.set(k, h); });
  const used = new Set();
  const out = {};
  TARGET_FIELDS.forEach((f) => { out[f.id] = null; });
  const assign = (field, header) => {
    if (!header || used.has(header) || out[field]) return;
    out[field] = header;
    used.add(header);
  };
  if (preset) {
    Object.entries(preset.columns).forEach(([field, col]) => assign(field, byNorm.get(normalizeHeader(col))));
  }
  TARGET_FIELDS.forEach((f) => {
    if (out[f.id]) return;
    const hit = (ALIASES[f.id] || []).find((a) => byNorm.has(a) && !used.has(byNorm.get(a)));
    if (hit) assign(f.id, byNorm.get(hit));
  });
  return out;
};

// Rótulo humano da origem, para o campo `source` do lead e o texto da timeline.
export const importSourceLabel = (preset) => preset?.label || 'planilha';
